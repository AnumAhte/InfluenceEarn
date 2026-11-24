-- =============================================================================
-- Phase 6 — admin account suspension
--
-- Suspending a user (admin only, reason required):
--   * Auth: auth.users.banned_until (+100 years) and the user's sessions are deleted, so
--     sign-in and token refresh are refused.
--   * API: a PostgREST pre-request hook rejects every request made with a still-valid
--     access token of a suspended user (server actions and direct API calls alike).
--   * Storage: a restrictive policy blocks a suspended user's file access.
--   * Nothing else changes: no data is deleted and wallets, campaigns, assignments and
--     payouts are left as they are for admins to review.
-- Every suspension and reinstatement is recorded in user_suspensions and in the
-- append-only admin activity log. An admin cannot suspend themselves or the last
-- active admin.
-- =============================================================================

create table public.user_suspensions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete restrict,
  reason        text not null check (char_length(btrim(reason)) between 5 and 500),
  suspended_by  uuid not null references public.profiles (id) on delete restrict,
  suspended_at  timestamptz not null default now(),
  lifted_by     uuid references public.profiles (id) on delete restrict,
  lifted_at     timestamptz,
  lift_reason   text check (lift_reason is null or char_length(btrim(lift_reason)) between 1 and 500),
  check ((lifted_at is null) = (lifted_by is null))
);

-- At most one active suspension per user.
create unique index user_suspensions_active_idx on public.user_suspensions (user_id) where lifted_at is null;
create index user_suspensions_user_idx on public.user_suspensions (user_id, suspended_at desc);

comment on table public.user_suspensions is 'Suspension history. Active = lifted_at is null. Written only by suspend_user / unsuspend_user.';

revoke all on public.user_suspensions from anon, authenticated;
grant select on public.user_suspensions to authenticated;
alter table public.user_suspensions enable row level security;
create policy "user_suspensions: admin reads" on public.user_suspensions
  for select to authenticated using ((select public.is_admin()));

create or replace function public.is_user_suspended(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.user_suspensions where user_id = _user_id and lifted_at is null);
$$;

revoke all on function public.is_user_suspended(uuid) from public, anon;
grant execute on function public.is_user_suspended(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Enforcement: PostgREST pre-request hook + storage
-- -----------------------------------------------------------------------------
create or replace function public.reject_suspended_requests()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is not null and public.is_user_suspended(v_uid) then
    raise exception 'account_suspended' using errcode = '42501', hint = 'This account has been suspended.';
  end if;
end;
$$;

revoke all on function public.reject_suspended_requests() from public;
grant execute on function public.reject_suspended_requests() to anon, authenticated, service_role;

alter role authenticator set pgrst.db_pre_request = 'public.reject_suspended_requests';
notify pgrst, 'reload config';

create policy "storage: suspended users have no access" on storage.objects
  as restrictive for all to authenticated
  using (not public.is_user_suspended((select auth.uid())))
  with check (not public.is_user_suspended((select auth.uid())));

-- Suspended users receive account notices only.
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
  if v_category is null then
    return null; -- account notices are always sent
  end if;
  if public.is_user_suspended(_user_id) then
    return 'account_suspended';
  end if;
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

-- -----------------------------------------------------------------------------
-- Admin actions
-- -----------------------------------------------------------------------------
-- A suspended admin fails every admin check (payouts included), even if a request
-- somehow bypassed the pre-request hook.
create or replace function public._require_admin()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not public.is_admin() or public.is_user_suspended((select auth.uid())) then
    raise exception 'admin_required' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public._require_admin() from public, anon, authenticated;

create or replace function public.suspend_user(p_user_id uuid, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  perform public._require_admin();
  if char_length(v_reason) < 5 or char_length(v_reason) > 500 then
    raise exception 'suspension_reason_required' using errcode = '22023';
  end if;
  if p_user_id = (select auth.uid()) then
    raise exception 'cannot_suspend_self' using errcode = 'P0001';
  end if;

  -- Serialise suspensions so two admins can't suspend each other at the same time.
  perform pg_advisory_xact_lock(hashtext('public.suspend_user'));

  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'user_not_found' using errcode = 'P0002';
  end if;
  if public.is_user_suspended(p_user_id) then
    raise exception 'already_suspended' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.user_roles where user_id = p_user_id and role = 'admin')
     and not exists (
       select 1 from public.user_roles r
       where r.role = 'admin' and r.user_id <> p_user_id and not public.is_user_suspended(r.user_id)
     ) then
    raise exception 'cannot_suspend_last_admin' using errcode = 'P0001';
  end if;

  insert into public.user_suspensions (user_id, reason, suspended_by)
  values (p_user_id, v_reason, (select auth.uid()))
  returning id into v_id;

  -- Far-future rather than 'infinity', which GoTrue (Go) can't parse.
  update auth.users set banned_until = now() + interval '100 years' where id = p_user_id;
  delete from auth.sessions where user_id = p_user_id;

  perform public._notify(p_user_id, 'account_suspended', 'Your InfluencEarn account has been suspended',
    'Your account has been suspended by the InfluencEarn team. You can''t sign in or use the platform while it is suspended.',
    '/login', jsonb_build_object('suspension_id', v_id));
  perform public._log_admin('user.suspended', 'user', p_user_id, jsonb_build_object('suspension_id', v_id, 'reason', v_reason));
  return v_id;
end;
$$;

create or replace function public.unsuspend_user(p_user_id uuid, p_reason text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  perform public._require_admin();
  if v_reason is not null and char_length(v_reason) > 500 then
    raise exception 'invalid_reason' using errcode = '22023';
  end if;

  update public.user_suspensions
  set lifted_at = now(), lifted_by = (select auth.uid()), lift_reason = v_reason
  where user_id = p_user_id and lifted_at is null
  returning id into v_id;
  if v_id is null then
    raise exception 'not_suspended' using errcode = 'P0001';
  end if;

  update auth.users set banned_until = null where id = p_user_id;

  perform public._notify(p_user_id, 'account_reinstated', 'Your InfluencEarn account has been reinstated',
    'Your account is active again. You can sign in as usual.', '/login', jsonb_build_object('suspension_id', v_id));
  perform public._log_admin('user.unsuspended', 'user', p_user_id,
    jsonb_build_object('suspension_id', v_id) || coalesce(jsonb_build_object('reason', v_reason), '{}'::jsonb));
  return v_id;
end;
$$;

revoke all on function public.suspend_user(uuid, text) from public, anon;
revoke all on function public.unsuspend_user(uuid, text) from public, anon;
grant execute on function public.suspend_user(uuid, text) to authenticated;
grant execute on function public.unsuspend_user(uuid, text) to authenticated;

-- -----------------------------------------------------------------------------
-- Admin user directory (emails live in auth.users, which clients can't read)
-- -----------------------------------------------------------------------------
create or replace function public.admin_list_users(
  p_search text default null,
  p_filter text default 'all',
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  id uuid,
  full_name text,
  email text,
  created_at timestamptz,
  active_workspace public.workspace_role,
  is_admin boolean,
  suspended_at timestamptz,
  campaigns_count bigint,
  applications_count bigint,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  -- Search is literal: LIKE wildcards in the input are escaped.
  v_q text := nullif(replace(replace(replace(btrim(coalesce(p_search, '')), '\', '\\'), '%', '\%'), '_', '\_'), '');
begin
  perform public._require_admin();
  if p_filter not in ('all', 'advertisers', 'influencers', 'admins', 'suspended') then
    raise exception 'invalid_filter' using errcode = '22023';
  end if;

  return query
  with base as (
    select p.id, p.full_name, u.email::text as email, p.created_at, p.active_workspace,
           exists (select 1 from public.user_roles r where r.user_id = p.id and r.role = 'admin') as is_admin,
           (select s.suspended_at from public.user_suspensions s where s.user_id = p.id and s.lifted_at is null) as suspended_at,
           (select count(*) from public.campaigns c where c.owner_id = p.id) as campaigns_count,
           (select count(*) from public.campaign_applications a where a.creator_id = p.id) as applications_count
    from public.profiles p
    join auth.users u on u.id = p.id
    where v_q is null
       or p.full_name ilike '%' || v_q || '%'
       or u.email ilike '%' || v_q || '%'
  )
  select b.*, count(*) over () as total_count
  from base b
  where case p_filter
          when 'advertisers' then b.campaigns_count > 0 or b.active_workspace = 'advertiser'
          when 'influencers' then b.applications_count > 0 or b.active_workspace = 'influencer'
          when 'admins' then b.is_admin
          when 'suspended' then b.suspended_at is not null
          else true
        end
  order by b.created_at desc, b.id desc
  limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0);
end;
$$;

create or replace function public.admin_get_user_email(p_user_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public._require_admin();
  return (select email::text from auth.users where id = p_user_id);
end;
$$;

revoke all on function public.admin_list_users(text, text, integer, integer) from public, anon;
revoke all on function public.admin_get_user_email(uuid) from public, anon;
grant execute on function public.admin_list_users(text, text, integer, integer) to authenticated;
grant execute on function public.admin_get_user_email(uuid) to authenticated;
