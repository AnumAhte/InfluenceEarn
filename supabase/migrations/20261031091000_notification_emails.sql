-- =============================================================================
-- Phase 6 — notification email delivery + email preferences
--
-- * Emails are sent only for notification rows the database itself created (_notify).
--   The worker (service_role only) claims queued rows, sends them over SMTP and records
--   the result. Nothing lets a caller choose a recipient or content.
-- * Status: pending → sent (SMTP server accepted the message) | failed (gave up after
--   5 attempts) | skipped (opted out, no confirmed email, or created before delivery
--   existed). "sent" never means "delivered to the inbox".
-- * Idempotency: a claim takes a lease and bumps email_attempts; a result is accepted
--   only for the current attempt and only while the row is still pending. Delivery is
--   at-least-once: if the worker dies after the SMTP server accepted a message but
--   before recording it, the lease expires and the message can be sent again.
-- =============================================================================

alter table public.notifications
  add column email_attempts        smallint not null default 0 check (email_attempts between 0 and 20),
  add column email_next_attempt_at timestamptz,
  add column email_locked_until    timestamptz,
  add column email_sent_at         timestamptz,
  add column email_message_id      text check (char_length(email_message_id) <= 300),
  add column email_error           text check (char_length(email_error) <= 300);

-- Rows created before email delivery existed are never emailed retroactively.
update public.notifications
set email_status = 'skipped', email_error = 'created_before_email_delivery'
where email_status = 'pending';

drop index if exists public.notifications_email_pending_idx;
create index notifications_email_queue_idx on public.notifications (created_at)
  where email_status = 'pending';

-- Delivery internals are not exposed to recipients (SMTP errors can contain server details).
revoke select on public.notifications from authenticated;
grant select (id, recipient_id, type, title, body, link_path, data, read_at, email_status, created_at)
  on public.notifications to authenticated;

-- -----------------------------------------------------------------------------
-- Email preferences (missing row = every category on)
-- -----------------------------------------------------------------------------
create table public.notification_preferences (
  user_id            uuid primary key references public.profiles (id) on delete cascade,
  email_applications boolean not null default true,
  email_work         boolean not null default true,
  email_payments     boolean not null default true,
  updated_at         timestamptz not null default now()
);

comment on table public.notification_preferences is
  'Per-user email opt-outs by category. In-app notifications are always created.';

revoke all on public.notification_preferences from anon, authenticated;
grant select on public.notification_preferences to authenticated;
-- user_id is updatable only because PostgREST upserts set it; RLS pins it to auth.uid().
grant insert (user_id, email_applications, email_work, email_payments, updated_at),
      update (user_id, email_applications, email_work, email_payments, updated_at)
  on public.notification_preferences to authenticated;

alter table public.notification_preferences enable row level security;
create policy "notification_preferences: owner reads" on public.notification_preferences
  for select to authenticated using (user_id = (select auth.uid()));
create policy "notification_preferences: owner inserts" on public.notification_preferences
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "notification_preferences: owner updates" on public.notification_preferences
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Which preference controls a notification type. NULL = always emailed (account notices).
create or replace function public.notification_email_category(_type public.notification_type)
returns text
language sql
immutable
set search_path = ''
as $$
  select case _type::text
    when 'application_received' then 'applications'
    when 'application_selected' then 'applications'
    when 'task_submitted'       then 'work'
    when 'task_approved'        then 'work'
    when 'task_rejected'        then 'work'
    when 'campaign_published'   then 'payments'
    when 'payout_ready'         then 'payments'
    when 'payout_released'      then 'payments'
    when 'campaign_refunded'    then 'payments'
    else null
  end;
$$;

-- Hook for reasons a user must not receive email (extended by the suspension migration).
create or replace function public._email_skip_reason(_user_id uuid, _type public.notification_type)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_pref public.notification_preferences;
  v_category text := public.notification_email_category(_type);
begin
  select * into v_pref from public.notification_preferences where user_id = _user_id;
  if found then
    if (v_category = 'applications' and not v_pref.email_applications)
       or (v_category = 'work' and not v_pref.email_work)
       or (v_category = 'payments' and not v_pref.email_payments) then
      return 'opted_out';
    end if;
  end if;
  return null;
end;
$$;

revoke all on function public._email_skip_reason(uuid, public.notification_type) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Worker functions (service_role only)
-- -----------------------------------------------------------------------------
create or replace function public.claim_notification_emails(p_limit integer default 20, p_lease_seconds integer default 120)
returns table (
  notification_id uuid,
  attempt smallint,
  recipient_email text,
  recipient_name text,
  type public.notification_type,
  title text,
  body text,
  link_path text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  v_email text;
  v_reason text;
begin
  if p_limit not between 1 and 100 or p_lease_seconds not between 30 and 900 then
    raise exception 'invalid_batch' using errcode = '22023';
  end if;

  for r in
    select n.id, n.recipient_id, n.type, n.title, n.body, n.link_path, n.email_attempts, p.full_name
    from public.notifications n
    join public.profiles p on p.id = n.recipient_id
    where n.email_status = 'pending'
      and (n.email_next_attempt_at is null or n.email_next_attempt_at <= now())
      and (n.email_locked_until is null or n.email_locked_until < now())
    order by n.created_at
    limit p_limit
    for update of n skip locked
  loop
    select u.email into v_email
    from auth.users u
    where u.id = r.recipient_id and u.email_confirmed_at is not null and u.email is not null;

    v_reason := case when v_email is null then 'no_confirmed_email'
                     else public._email_skip_reason(r.recipient_id, r.type) end;

    if v_reason is not null then
      update public.notifications
      set email_status = 'skipped', email_error = v_reason, email_locked_until = null
      where id = r.id;
      continue;
    end if;

    update public.notifications
    set email_attempts = r.email_attempts + 1,
        email_locked_until = now() + make_interval(secs => p_lease_seconds)
    where id = r.id;

    notification_id := r.id;
    attempt := r.email_attempts + 1;
    recipient_email := v_email;
    recipient_name := r.full_name;
    type := r.type;
    title := r.title;
    body := r.body;
    link_path := r.link_path;
    return next;
  end loop;
end;
$$;

create or replace function public.record_notification_email_result(
  p_notification_id uuid,
  p_attempt smallint,
  p_sent boolean,
  p_message_id text default null,
  p_error text default null
)
returns public.notification_email_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.notifications;
  max_attempts constant smallint := 5;
begin
  select * into v_row from public.notifications where id = p_notification_id for update;
  if not found then
    raise exception 'notification_not_found' using errcode = 'P0002';
  end if;
  -- Already final (e.g. a duplicate result): never change a sent/failed/skipped row.
  if v_row.email_status <> 'pending' then
    return v_row.email_status;
  end if;
  if v_row.email_attempts <> p_attempt then
    raise exception 'stale_email_attempt' using errcode = 'P0001';
  end if;

  if p_sent then
    update public.notifications
    set email_status = 'sent', email_sent_at = now(), email_message_id = left(p_message_id, 300),
        email_error = null, email_locked_until = null, email_next_attempt_at = null
    where id = p_notification_id;
    return 'sent';
  end if;

  if v_row.email_attempts >= max_attempts then
    update public.notifications
    set email_status = 'failed', email_error = left(coalesce(p_error, 'send_failed'), 300),
        email_locked_until = null, email_next_attempt_at = null
    where id = p_notification_id;
    return 'failed';
  end if;

  -- Retry with exponential backoff: 1, 2, 4, 8 minutes.
  update public.notifications
  set email_error = left(coalesce(p_error, 'send_failed'), 300), email_locked_until = null,
      email_next_attempt_at = now() + make_interval(mins => power(2, v_row.email_attempts - 1)::int)
  where id = p_notification_id;
  return 'pending';
end;
$$;

revoke all on function public.claim_notification_emails(integer, integer) from public, anon, authenticated;
revoke all on function public.record_notification_email_result(uuid, smallint, boolean, text, text) from public, anon, authenticated;
grant execute on function public.claim_notification_emails(integer, integer) to service_role;
grant execute on function public.record_notification_email_result(uuid, smallint, boolean, text, text) to service_role;
