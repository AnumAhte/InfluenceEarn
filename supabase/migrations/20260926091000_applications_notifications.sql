-- =============================================================================
-- Phase 3b: eligibility, applications, manual selection, notifications, discovery.
--
-- * Eligibility has ONE implementation: _campaign_eligibility_issues(). The apply
--   function enforces it; discovery and the campaign page display it.
-- * Applications are written only by SECURITY DEFINER functions. Creators can
--   apply and read their own; campaign owners read and decide on applications to
--   their campaigns; admins read all. Nobody can decide on their own application.
-- * Selecting is manual, final in this phase, and capped at creators_required.
-- * Notifications are in-app now; email_status lets an email worker pick them up later.
-- =============================================================================

create type public.application_status as enum ('pending', 'shortlisted', 'selected', 'rejected');

create type public.notification_type as enum (
  'application_received',
  'application_selected',
  'campaign_published',
  -- Reserved for later phases:
  'task_submitted',
  'task_approved',
  'task_rejected',
  'payout_ready',
  'payout_released'
);

create type public.notification_email_status as enum ('pending', 'sent', 'failed', 'skipped');

-- -----------------------------------------------------------------------------
-- Notifications
-- -----------------------------------------------------------------------------
create table public.notifications (
  id           uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  type         public.notification_type not null,
  title        text not null check (char_length(title) between 1 and 140),
  body         text not null check (char_length(body) between 1 and 500),
  link_path    text check (link_path is null or (link_path ~ '^/[^/]' and char_length(link_path) <= 300)),
  data         jsonb not null default '{}'::jsonb,
  read_at      timestamptz,
  email_status public.notification_email_status not null default 'pending',
  created_at   timestamptz not null default now()
);

create index notifications_recipient_idx on public.notifications (recipient_id, created_at desc, id desc);
create index notifications_unread_idx on public.notifications (recipient_id) where read_at is null;
create index notifications_email_pending_idx on public.notifications (created_at) where email_status = 'pending';

create or replace function public._notify(
  _recipient uuid,
  _type public.notification_type,
  _title text,
  _body text,
  _link text,
  _data jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (recipient_id, type, title, body, link_path, data)
  values (_recipient, _type, left(_title, 140), left(_body, 500), _link, coalesce(_data, '{}'::jsonb));
$$;

revoke all on function public._notify(uuid, public.notification_type, text, text, text, jsonb) from public, anon, authenticated;

create or replace function public.mark_notifications_read(p_ids uuid[] default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  update public.notifications
  set read_at = now()
  where recipient_id = (select auth.uid())
    and read_at is null
    and (p_ids is null or id = any (p_ids));
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.mark_notifications_read(uuid[]) from public, anon;
grant execute on function public.mark_notifications_read(uuid[]) to authenticated;

-- Campaign funded → tell the advertiser it is live.
create or replace function public.campaign_funding_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_title text;
begin
  select title into v_title from public.campaigns where id = new.campaign_id;
  perform public._notify(
    new.payer_id, 'campaign_published', 'Campaign funded and published',
    '"' || v_title || '" is live and open for applications.',
    '/campaigns/' || new.campaign_id::text,
    jsonb_build_object('campaign_id', new.campaign_id)
  );
  return new;
end;
$$;

create trigger campaign_funding_notify
  after insert on public.campaign_funding
  for each row execute function public.campaign_funding_notify();

-- -----------------------------------------------------------------------------
-- Eligibility (single source of truth)
-- -----------------------------------------------------------------------------
-- Returns one row per unmet requirement. No rows = eligible.
-- Codes: missing_platform, followers_below_minimum (both per platform),
-- gender_not_set, gender_mismatch, age_not_set, age_out_of_range,
-- category_not_set, category_mismatch, location_not_set, location_mismatch.
create or replace function public._campaign_eligibility_issues(_campaign_id uuid, _user_id uuid)
returns table (code text, platform public.social_platform)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  r public.campaign_requirements%rowtype;
  cp public.creator_profiles%rowtype;
  v_city text;
  v_age integer;
  p public.social_platform;
  v_followers integer;
  v_found boolean;
begin
  select * into r from public.campaign_requirements where campaign_id = _campaign_id;
  select * into cp from public.creator_profiles where user_id = _user_id;
  select city into v_city from public.profiles where id = _user_id;

  for p in select cp2.platform from public.campaign_platforms cp2 where cp2.campaign_id = _campaign_id order by cp2.platform loop
    select true, sa.follower_count into v_found, v_followers
    from public.social_accounts sa
    where sa.user_id = _user_id and sa.platform = p and sa.status = 'connected';
    if not coalesce(v_found, false) then
      code := 'missing_platform'; platform := p; return next;
    elsif r.min_followers is not null and coalesce(v_followers, -1) < r.min_followers then
      code := 'followers_below_minimum'; platform := p; return next;
    end if;
    v_found := null; v_followers := null;
  end loop;

  platform := null;

  if coalesce(cardinality(r.genders), 0) > 0 then
    if cp.gender is null then
      code := 'gender_not_set'; return next;
    elsif not (cp.gender = any (r.genders)) then
      code := 'gender_mismatch'; return next;
    end if;
  end if;

  if r.age_min is not null or r.age_max is not null then
    if cp.date_of_birth is null then
      code := 'age_not_set'; return next;
    else
      v_age := extract(year from age(current_date, cp.date_of_birth))::integer;
      if (r.age_min is not null and v_age < r.age_min) or (r.age_max is not null and v_age > r.age_max) then
        code := 'age_out_of_range'; return next;
      end if;
    end if;
  end if;

  if exists (select 1 from public.campaign_creator_categories where campaign_id = _campaign_id) then
    if not exists (select 1 from public.creator_profile_categories where user_id = _user_id) then
      code := 'category_not_set'; return next;
    elsif not exists (
      select 1 from public.campaign_creator_categories cc
      join public.creator_profile_categories pc on pc.category_slug = cc.category_slug
      where cc.campaign_id = _campaign_id and pc.user_id = _user_id
    ) then
      code := 'category_mismatch'; return next;
    end if;
  end if;

  if exists (select 1 from public.campaign_locations where campaign_id = _campaign_id) then
    if cp.country_code is null then
      code := 'location_not_set'; return next;
    elsif not exists (
      select 1 from public.campaign_locations l
      where l.campaign_id = _campaign_id
        and l.country_code = cp.country_code
        and (l.city is null or lower(btrim(l.city)) = lower(btrim(coalesce(v_city, ''))))
    ) then
      code := 'location_mismatch'; return next;
    end if;
  end if;
end;
$$;

revoke all on function public._campaign_eligibility_issues(uuid, uuid) from public, anon, authenticated;

-- The signed-in user's issues for a campaign they can see.
create or replace function public.my_campaign_eligibility(p_campaign_id uuid)
returns table (code text, platform public.social_platform)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not public.can_view_campaign(p_campaign_id) then
    raise exception 'campaign_not_found' using errcode = 'P0002';
  end if;
  return query select * from public._campaign_eligibility_issues(p_campaign_id, (select auth.uid()));
end;
$$;

revoke all on function public.my_campaign_eligibility(uuid) from public, anon;
grant execute on function public.my_campaign_eligibility(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Applications
-- -----------------------------------------------------------------------------
create table public.campaign_applications (
  id                   uuid primary key default gen_random_uuid(),
  campaign_id          uuid not null references public.campaigns (id) on delete restrict,
  creator_id           uuid not null references public.profiles (id) on delete restrict,
  status               public.application_status not null default 'pending',
  pitch                text check (pitch is null or char_length(pitch) <= 1000),

  -- Snapshot of what the creator had when applying (advertisers see this, not the
  -- creator's private profile).
  creator_name         text not null,
  creator_city         text,
  creator_country_code char(2),
  creator_age          smallint,
  creator_gender       public.creator_gender,
  creator_categories   text[] not null default '{}',
  max_follower_count   integer,
  search_text          text not null,

  status_changed_at    timestamptz not null default now(),
  decided_by           uuid references public.profiles (id) on delete set null,
  created_at           timestamptz not null default now(),
  unique (campaign_id, creator_id)
);

create index campaign_applications_campaign_status_idx
  on public.campaign_applications (campaign_id, status, created_at desc, id desc);
create index campaign_applications_campaign_created_idx
  on public.campaign_applications (campaign_id, created_at desc, id desc);
create index campaign_applications_campaign_followers_idx
  on public.campaign_applications (campaign_id, max_follower_count desc nulls last, id desc);
create index campaign_applications_creator_idx
  on public.campaign_applications (creator_id, created_at desc, id desc);
create index campaign_applications_search_trgm_idx
  on public.campaign_applications using gin (search_text extensions.gin_trgm_ops);

create table public.application_social_accounts (
  application_id    uuid not null references public.campaign_applications (id) on delete cascade,
  social_account_id uuid not null references public.social_accounts (id) on delete restrict,
  platform          public.social_platform not null,
  handle            text not null,
  profile_url       text not null,
  follower_count    integer,
  primary key (application_id, platform)
);

create index application_social_accounts_platform_idx
  on public.application_social_accounts (platform, follower_count, application_id);

create table public.campaign_application_events (
  id             bigint generated always as identity primary key,
  application_id uuid not null references public.campaign_applications (id) on delete cascade,
  from_status    public.application_status,
  to_status      public.application_status not null,
  actor_id       uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now()
);

create index campaign_application_events_app_idx on public.campaign_application_events (application_id, created_at);

-- Mirrored in src/domain/applications/state-machine.ts.
create or replace function public.application_transition_allowed(
  _from public.application_status,
  _to public.application_status
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select (_from, _to) in (
    ('pending'::public.application_status, 'shortlisted'::public.application_status),
    ('pending', 'selected'),
    ('pending', 'rejected'),
    ('shortlisted', 'pending'),
    ('shortlisted', 'selected'),
    ('shortlisted', 'rejected'),
    ('rejected', 'pending')
  );
$$;

create or replace function public.campaign_applications_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.campaign_id is distinct from old.campaign_id or new.creator_id is distinct from old.creator_id then
    raise exception 'application_immutable' using errcode = '42501';
  end if;
  if new.status is distinct from old.status then
    if not public.application_transition_allowed(old.status, new.status) then
      raise exception 'invalid_application_transition: % -> %', old.status, new.status using errcode = 'P0001';
    end if;
    new.status_changed_at := now();
    insert into public.campaign_application_events (application_id, from_status, to_status, actor_id)
    values (new.id, old.status, new.status, auth.uid());
  end if;
  return new;
end;
$$;

create trigger campaign_applications_guard
  before update on public.campaign_applications
  for each row execute function public.campaign_applications_guard();

-- -----------------------------------------------------------------------------
-- Apply
-- -----------------------------------------------------------------------------
create or replace function public.apply_to_campaign(p_campaign_id uuid, p_pitch text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  c public.campaigns%rowtype;
  cp public.creator_profiles%rowtype;
  v_profile public.profiles%rowtype;
  v_issues jsonb;
  v_id uuid;
  v_handles text;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  -- Share lock: blocks concurrent status changes while we apply.
  select * into c from public.campaigns where id = p_campaign_id for share;
  if not found or c.status not in ('published', 'applications_open') then
    raise exception 'campaign_not_found' using errcode = 'P0002';
  end if;
  if c.owner_id = v_uid then
    raise exception 'own_campaign' using errcode = 'P0001';
  end if;
  if c.status <> 'applications_open' or c.application_deadline <= now() then
    raise exception 'applications_closed' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.campaign_applications where campaign_id = p_campaign_id and creator_id = v_uid) then
    raise exception 'already_applied' using errcode = 'P0001';
  end if;
  if p_pitch is not null and char_length(p_pitch) > 1000 then
    raise exception 'pitch_too_long' using errcode = '22023';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('code', i.code, 'platform', i.platform)), '[]'::jsonb)
  into v_issues
  from public._campaign_eligibility_issues(p_campaign_id, v_uid) i;
  if jsonb_array_length(v_issues) > 0 then
    raise exception 'not_eligible' using errcode = 'P0001', detail = v_issues::text;
  end if;

  select * into v_profile from public.profiles where id = v_uid;
  select * into cp from public.creator_profiles where user_id = v_uid;

  select string_agg(sa.handle, ' ') into v_handles
  from public.social_accounts sa
  join public.campaign_platforms p on p.platform = sa.platform and p.campaign_id = p_campaign_id
  where sa.user_id = v_uid and sa.status = 'connected';

  insert into public.campaign_applications (
    campaign_id, creator_id, pitch, creator_name, creator_city, creator_country_code, creator_age,
    creator_gender, creator_categories, max_follower_count, search_text
  ) values (
    p_campaign_id, v_uid, nullif(btrim(coalesce(p_pitch, '')), ''),
    coalesce(nullif(v_profile.full_name, ''), 'Creator'), v_profile.city, cp.country_code,
    case when cp.date_of_birth is null then null
         else extract(year from age(current_date, cp.date_of_birth))::smallint end,
    cp.gender,
    coalesce((select array_agg(category_slug order by category_slug) from public.creator_profile_categories where user_id = v_uid), '{}'),
    (select max(sa.follower_count) from public.social_accounts sa
       join public.campaign_platforms p on p.platform = sa.platform and p.campaign_id = p_campaign_id
      where sa.user_id = v_uid and sa.status = 'connected'),
    lower(coalesce(v_profile.full_name, '') || ' ' || coalesce(v_handles, ''))
  )
  returning id into v_id;

  insert into public.application_social_accounts (application_id, social_account_id, platform, handle, profile_url, follower_count)
  select v_id, sa.id, sa.platform, sa.handle, public.social_profile_url(sa.platform, sa.handle), sa.follower_count
  from public.social_accounts sa
  join public.campaign_platforms p on p.platform = sa.platform and p.campaign_id = p_campaign_id
  where sa.user_id = v_uid and sa.status = 'connected';

  insert into public.campaign_application_events (application_id, from_status, to_status, actor_id)
  values (v_id, null, 'pending', v_uid);

  perform public._notify(
    c.owner_id, 'application_received', 'New application',
    coalesce(nullif(v_profile.full_name, ''), 'A creator') || ' applied to "' || c.title || '".',
    '/campaigns/' || c.id::text || '/applicants',
    jsonb_build_object('campaign_id', c.id, 'application_id', v_id)
  );

  return v_id;
end;
$$;

revoke all on function public.apply_to_campaign(uuid, text) from public, anon;
grant execute on function public.apply_to_campaign(uuid, text) to authenticated;

-- -----------------------------------------------------------------------------
-- Manual review by the campaign owner
-- -----------------------------------------------------------------------------
-- p_action: shortlist | unshortlist | select | reject | reconsider
create or replace function public.decide_application(p_application_id uuid, p_action text)
returns public.application_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  a public.campaign_applications%rowtype;
  c public.campaigns%rowtype;
  v_next public.application_status;
  v_selected integer;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into a from public.campaign_applications where id = p_application_id;
  if not found then
    raise exception 'application_not_found' using errcode = 'P0002';
  end if;
  -- Lock the campaign first so selection capacity checks are serialised.
  select * into c from public.campaigns where id = a.campaign_id for update;
  if c.owner_id is distinct from v_uid then
    raise exception 'application_not_found' using errcode = 'P0002';
  end if;
  select * into a from public.campaign_applications where id = p_application_id for update;

  if c.status not in ('applications_open', 'selection_in_progress') then
    raise exception 'selection_closed' using errcode = 'P0001';
  end if;

  v_next := case p_action
    when 'shortlist' then 'shortlisted'
    when 'unshortlist' then 'pending'
    when 'select' then 'selected'
    when 'reject' then 'rejected'
    when 'reconsider' then 'pending'
  end::public.application_status;

  if v_next is null then
    raise exception 'invalid_action' using errcode = '22023';
  end if;
  if a.status = v_next then
    return v_next; -- idempotent
  end if;
  if not public.application_transition_allowed(a.status, v_next)
     or (p_action = 'unshortlist' and a.status <> 'shortlisted')
     or (p_action = 'reconsider' and a.status <> 'rejected') then
    raise exception 'invalid_application_transition: % -> %', a.status, v_next using errcode = 'P0001';
  end if;

  if v_next = 'selected' then
    select count(*) into v_selected
    from public.campaign_applications where campaign_id = c.id and status = 'selected';
    if v_selected >= c.creators_required then
      raise exception 'selection_full' using errcode = 'P0001',
        detail = json_build_object('selected', v_selected, 'required', c.creators_required)::text;
    end if;
  end if;

  update public.campaign_applications
  set status = v_next, decided_by = v_uid
  where id = a.id;

  if v_next = 'selected' then
    perform public._notify(
      a.creator_id, 'application_selected', 'You were selected',
      'You were selected for "' || c.title || '". Tasks and deadlines will appear in your workspace.',
      '/applications',
      jsonb_build_object('campaign_id', c.id, 'application_id', a.id)
    );
  end if;

  return v_next;
end;
$$;

revoke all on function public.decide_application(uuid, text) from public, anon;
grant execute on function public.decide_application(uuid, text) to authenticated;

-- applications_open → selection_in_progress (stops new applications)
create or replace function public.close_campaign_applications(p_campaign_id uuid)
returns public.campaign_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.campaign_status;
begin
  select status into v_status from public.campaigns
  where id = p_campaign_id and owner_id = (select auth.uid())
  for update;
  if not found then
    raise exception 'campaign_not_found' using errcode = 'P0002';
  end if;
  if v_status = 'selection_in_progress' then
    return v_status;
  end if;
  if v_status <> 'applications_open' then
    raise exception 'invalid_campaign_transition: % -> selection_in_progress', v_status using errcode = 'P0001';
  end if;
  update public.campaigns set status = 'selection_in_progress' where id = p_campaign_id;
  return 'selection_in_progress';
end;
$$;

revoke all on function public.close_campaign_applications(uuid) from public, anon;
grant execute on function public.close_campaign_applications(uuid) to authenticated;

-- Counts per status for the owner's campaign (SECURITY INVOKER → RLS applies).
create or replace function public.campaign_application_counts(p_campaign_id uuid)
returns table (status public.application_status, total bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select a.status, count(*)::bigint
  from public.campaign_applications a
  where a.campaign_id = p_campaign_id
  group by a.status;
$$;

revoke all on function public.campaign_application_counts(uuid) from public, anon;
grant execute on function public.campaign_application_counts(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Discovery (public campaign fields only)
-- -----------------------------------------------------------------------------
create or replace function public.campaign_advertiser_name(p_campaign_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(nullif(p.full_name, ''), 'Advertiser')
  from public.campaigns c
  join public.profiles p on p.id = c.owner_id
  where c.id = p_campaign_id and public.can_view_campaign(c.id);
$$;

revoke all on function public.campaign_advertiser_name(uuid) from public, anon;
grant execute on function public.campaign_advertiser_name(uuid) to authenticated;

create or replace function public.discover_campaigns(
  p_search text default null,
  p_platform public.social_platform default null,
  p_category text default null,
  p_sort text default 'newest',
  p_eligible_only boolean default false,
  p_limit integer default 12,
  p_offset integer default 0
)
returns table (
  id uuid,
  title text,
  description text,
  category_slug text,
  campaign_type public.campaign_type,
  application_deadline timestamptz,
  task_deadline timestamptz,
  payment_per_creator_cents bigint,
  creators_required integer,
  platforms public.social_platform[],
  task_types public.campaign_task_type[],
  min_followers integer,
  advertiser_name text,
  applied boolean,
  issues text[],
  total_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with live as (
    select c.*
    from public.campaigns c
    where c.status = 'applications_open'
      and c.application_deadline > now()
      and c.owner_id <> (select auth.uid())
      and (p_search is null or c.title ilike '%' || replace(replace(replace(p_search, '\', '\\'), '%', '\%'), '_', '\_') || '%')
      and (p_category is null or c.category_slug = p_category)
      and (p_platform is null or exists (
        select 1 from public.campaign_platforms cp where cp.campaign_id = c.id and cp.platform = p_platform))
  ),
  enriched as (
    select
      l.*,
      array(select cp.platform from public.campaign_platforms cp where cp.campaign_id = l.id order by cp.platform) as platforms_arr,
      array(select distinct t.task_type from public.campaign_tasks t where t.campaign_id = l.id) as task_types_arr,
      (select r.min_followers from public.campaign_requirements r where r.campaign_id = l.id) as min_followers_val,
      exists (select 1 from public.campaign_applications a where a.campaign_id = l.id and a.creator_id = (select auth.uid())) as applied_val,
      array(
        select i.code || coalesce(':' || i.platform::text, '')
        from public._campaign_eligibility_issues(l.id, (select auth.uid())) i
      ) as issues_arr
    from live l
  ),
  filtered as (
    select * from enriched e
    where not p_eligible_only or cardinality(e.issues_arr) = 0
  )
  select
    f.id, f.title, left(coalesce(f.description, ''), 280), f.category_slug, f.campaign_type,
    f.application_deadline, f.task_deadline, f.payment_per_creator_cents, f.creators_required,
    f.platforms_arr, f.task_types_arr, f.min_followers_val,
    coalesce(nullif(p.full_name, ''), 'Advertiser'),
    f.applied_val, f.issues_arr,
    count(*) over ()
  from filtered f
  join public.profiles p on p.id = f.owner_id
  order by
    case when p_sort = 'highest_reward' then f.payment_per_creator_cents end desc nulls last,
    case when p_sort = 'ending_soon' then f.application_deadline end asc,
    f.published_at desc nulls last,
    f.id desc
  limit least(greatest(coalesce(p_limit, 12), 1), 50)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

revoke all on function public.discover_campaigns(text, public.social_platform, text, text, boolean, integer, integer) from public, anon;
grant execute on function public.discover_campaigns(text, public.social_platform, text, text, boolean, integer, integer) to authenticated;

-- -----------------------------------------------------------------------------
-- Privileges + RLS (read-only for clients; writes via functions above)
-- -----------------------------------------------------------------------------
revoke all on public.notifications, public.campaign_applications, public.application_social_accounts,
  public.campaign_application_events from anon, authenticated;

grant select on public.notifications, public.campaign_applications, public.application_social_accounts,
  public.campaign_application_events to authenticated;

alter table public.notifications enable row level security;
alter table public.campaign_applications enable row level security;
alter table public.application_social_accounts enable row level security;
alter table public.campaign_application_events enable row level security;

create policy "notifications: recipient reads" on public.notifications
  for select to authenticated using (recipient_id = (select auth.uid()));

create policy "applications: creator reads own" on public.campaign_applications
  for select to authenticated using (creator_id = (select auth.uid()));
create policy "applications: campaign owner reads" on public.campaign_applications
  for select to authenticated using (public.is_campaign_owner(campaign_id));
create policy "applications: admin reads" on public.campaign_applications
  for select to authenticated using ((select public.is_admin()));

create or replace function public.can_view_application(_application_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.campaign_applications a
    where a.id = _application_id
      and (a.creator_id = (select auth.uid()) or public.is_campaign_owner(a.campaign_id) or public.is_admin())
  );
$$;

revoke all on function public.can_view_application(uuid) from public, anon;
grant execute on function public.can_view_application(uuid) to authenticated;

-- Applicants keep read access to campaigns they applied to (even after applications close).
create or replace function public.has_applied_to_campaign(_campaign_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.campaign_applications a
    where a.campaign_id = _campaign_id and a.creator_id = (select auth.uid())
  );
$$;

revoke all on function public.has_applied_to_campaign(uuid) from public, anon;
grant execute on function public.has_applied_to_campaign(uuid) to authenticated;

create policy "campaigns: applicants read campaigns they applied to" on public.campaigns
  for select to authenticated using (public.has_applied_to_campaign(id));

-- Child rows (platforms, tasks, requirements…) follow the same rule.
create or replace function public.can_view_campaign(_campaign_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.campaigns c
    where c.id = _campaign_id
      and (
        c.owner_id = (select auth.uid())
        or c.status in ('published', 'applications_open')
        or public.is_admin()
        or public.has_applied_to_campaign(c.id)
      )
  );
$$;

create policy "application_social_accounts: visible with application" on public.application_social_accounts
  for select to authenticated using (public.can_view_application(application_id));
create policy "campaign_application_events: visible with application" on public.campaign_application_events
  for select to authenticated using (public.can_view_application(application_id));
