-- =============================================================================
-- Phase 2a: campaigns (normalised), eligibility requirements, state machine.
--
-- * A campaign belongs to exactly one owner (advertiser).
-- * `status` is never writable by clients: it is excluded from column grants and
--   changes only through SECURITY DEFINER functions, validated by a trigger.
-- * Once a campaign leaves draft/funding_required, liability-affecting fields are
--   frozen by trigger (defence in depth on top of RLS).
-- =============================================================================

create extension if not exists pg_trgm with schema extensions;

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
create type public.campaign_status as enum (
  'draft',
  'funding_required',
  'published',
  'applications_open',
  'selection_in_progress',
  'in_progress',
  'review_pending',
  'completed',
  'cancelled'
);

create type public.campaign_type as enum (
  'product_launch',
  'product_review',
  'brand_awareness',
  'event_promotion'
);

create type public.social_platform as enum ('instagram', 'tiktok', 'facebook', 'youtube');

create type public.campaign_task_type as enum (
  'instagram_feed_post',
  'instagram_reel',
  'instagram_story',
  'tiktok_video',
  'youtube_video',
  'youtube_short',
  'facebook_post',
  'facebook_share',
  'comment',
  'like',
  'share_post',
  'follow',
  'product_review',
  'ugc',
  'custom'
);

-- What a creator must submit as proof of completion. Screenshots are never required.
create type public.proof_url_requirement as enum ('required', 'optional', 'none');

create type public.creator_gender as enum ('female', 'male', 'non_binary');

-- -----------------------------------------------------------------------------
-- Reference data
-- -----------------------------------------------------------------------------
create table public.creator_categories (
  slug       text primary key check (slug ~ '^[a-z][a-z_]{1,39}$'),
  label      text not null check (char_length(label) between 2 and 60),
  sort_order smallint not null default 0
);

insert into public.creator_categories (slug, label, sort_order) values
  ('fashion', 'Fashion', 10),
  ('beauty', 'Beauty', 20),
  ('food', 'Food', 30),
  ('tech', 'Tech', 40),
  ('fitness', 'Fitness', 50),
  ('travel', 'Travel', 60),
  ('lifestyle', 'Lifestyle', 70),
  ('gaming', 'Gaming', 80),
  ('other', 'Other', 1000);

-- Proof rules per task type (single source of truth in the database;
-- mirrored in src/domain/campaigns/catalog.ts for the UI).
create table public.campaign_task_type_rules (
  task_type             public.campaign_task_type primary key,
  platform              public.social_platform, -- null = any selected platform
  proof_url             public.proof_url_requirement not null,
  requires_comment_text boolean not null default false
);

insert into public.campaign_task_type_rules (task_type, platform, proof_url, requires_comment_text) values
  ('instagram_feed_post', 'instagram', 'required', false),
  ('instagram_reel',      'instagram', 'required', false),
  ('instagram_story',     'instagram', 'optional', false),
  ('tiktok_video',        'tiktok',    'required', false),
  ('youtube_video',       'youtube',   'required', false),
  ('youtube_short',       'youtube',   'required', false),
  ('facebook_post',       'facebook',  'required', false),
  ('facebook_share',      'facebook',  'optional', false),
  ('comment',             null,        'required', true),
  ('like',                null,        'optional', false),
  ('share_post',          null,        'optional', false),
  ('follow',              null,        'none',     false),
  ('product_review',      null,        'required', false),
  ('ugc',                 null,        'required', false),
  ('custom',              null,        'optional', false);

-- -----------------------------------------------------------------------------
-- campaigns
-- -----------------------------------------------------------------------------
create table public.campaigns (
  id                         uuid primary key default gen_random_uuid(),
  owner_id                   uuid not null default auth.uid()
                               references public.profiles (id) on delete restrict,
  status                     public.campaign_status not null default 'draft',

  -- Step 1 — details
  title                      text not null check (char_length(btrim(title)) between 3 and 120),
  description                text check (description is null or char_length(description) <= 5000),
  category_slug              text references public.creator_categories (slug),
  campaign_type              public.campaign_type,

  -- Step 3 — instructions & dates
  instructions               text check (instructions is null or char_length(instructions) <= 5000),
  caption_instructions       text check (caption_instructions is null or char_length(caption_instructions) <= 2000),
  hashtags                   text[] not null default '{}'
                               check (cardinality(hashtags) <= 30),
  mentions                   text[] not null default '{}'
                               check (cardinality(mentions) <= 30),
  reference_url              text check (reference_url is null or (reference_url ~* '^https://' and char_length(reference_url) <= 2048)),
  application_deadline       timestamptz,
  task_deadline              timestamptz,

  -- Step 4 — budget (integer cents, USD only in V1)
  currency                   char(3) not null default 'USD' check (currency = 'USD'),
  payment_per_creator_cents  bigint check (payment_per_creator_cents is null
                                          or payment_per_creator_cents between 100 and 100000000),
  creators_required          integer check (creators_required is null or creators_required between 1 and 10000),

  -- Lifecycle timestamps
  funding_requested_at       timestamptz,
  published_at               timestamptz,
  cancelled_at               timestamptz,
  cancellation_reason        text check (cancellation_reason is null or char_length(cancellation_reason) <= 500),
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),

  constraint campaigns_deadline_order check (
    application_deadline is null or task_deadline is null or task_deadline > application_deadline
  )
);

comment on column public.campaigns.status is
  'Changed only by SECURITY DEFINER functions; transitions validated by trigger.';

create index campaigns_owner_created_idx on public.campaigns (owner_id, created_at desc, id desc);
create index campaigns_owner_status_created_idx on public.campaigns (owner_id, status, created_at desc, id desc);
create index campaigns_owner_category_idx on public.campaigns (owner_id, category_slug);
create index campaigns_title_trgm_idx on public.campaigns using gin (title extensions.gin_trgm_ops);
-- Discovery (phase 3): live campaigns by deadline.
create index campaigns_discovery_idx on public.campaigns (application_deadline, id)
  where status in ('published', 'applications_open');

create trigger campaigns_set_updated_at
  before update on public.campaigns
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Child tables
-- -----------------------------------------------------------------------------
create table public.campaign_platforms (
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  platform    public.social_platform not null,
  primary key (campaign_id, platform)
);

create index campaign_platforms_platform_idx on public.campaign_platforms (platform, campaign_id);

create table public.campaign_tasks (
  id                 uuid primary key default gen_random_uuid(),
  campaign_id        uuid not null references public.campaigns (id) on delete cascade,
  platform           public.social_platform not null,
  task_type          public.campaign_task_type not null,
  quantity           smallint not null default 1 check (quantity between 1 and 20),
  custom_description text check (custom_description is null or char_length(custom_description) between 3 and 500),
  position           smallint not null default 0 check (position between 0 and 49),
  created_at         timestamptz not null default now(),
  -- A task's platform must be one of the campaign's selected platforms.
  foreign key (campaign_id, platform)
    references public.campaign_platforms (campaign_id, platform) on delete cascade,
  constraint campaign_tasks_custom_needs_description check (
    task_type <> 'custom' or custom_description is not null
  ),
  constraint campaign_tasks_platform_matches_type check (
    case task_type
      when 'instagram_feed_post' then platform = 'instagram'
      when 'instagram_reel'      then platform = 'instagram'
      when 'instagram_story'     then platform = 'instagram'
      when 'tiktok_video'        then platform = 'tiktok'
      when 'youtube_video'       then platform = 'youtube'
      when 'youtube_short'       then platform = 'youtube'
      when 'facebook_post'       then platform = 'facebook'
      when 'facebook_share'      then platform = 'facebook'
      else true
    end
  )
);

create index campaign_tasks_campaign_idx on public.campaign_tasks (campaign_id, position);

-- Eligibility (all optional; absence means "no restriction").
create table public.campaign_requirements (
  campaign_id   uuid primary key references public.campaigns (id) on delete cascade,
  min_followers integer check (min_followers is null or min_followers between 0 and 1000000000),
  genders       public.creator_gender[] not null default '{}',
  age_min       smallint check (age_min is null or age_min between 13 and 100),
  age_max       smallint check (age_max is null or age_max between 13 and 100),
  constraint campaign_requirements_age_order check (age_min is null or age_max is null or age_min <= age_max)
);

create table public.campaign_creator_categories (
  campaign_id   uuid not null references public.campaigns (id) on delete cascade,
  category_slug text not null references public.creator_categories (slug),
  primary key (campaign_id, category_slug)
);

-- Global location targeting: country is required per row, region/city optional.
create table public.campaign_locations (
  id           uuid primary key default gen_random_uuid(),
  campaign_id  uuid not null references public.campaigns (id) on delete cascade,
  country_code char(2) not null check (country_code ~ '^[A-Z]{2}$'),
  region       text check (region is null or char_length(region) between 1 and 100),
  city         text check (city is null or char_length(city) between 1 and 100)
);

create unique index campaign_locations_unique_idx
  on public.campaign_locations (campaign_id, country_code, coalesce(region, ''), coalesce(city, ''));

-- Audit trail of status changes (used for the campaign timeline).
create table public.campaign_status_events (
  id          bigint generated always as identity primary key,
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  from_status public.campaign_status,
  to_status   public.campaign_status not null,
  actor_id    uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);

create index campaign_status_events_campaign_idx on public.campaign_status_events (campaign_id, created_at);

-- -----------------------------------------------------------------------------
-- State machine (mirrored in src/domain/campaigns/state-machine.ts)
-- -----------------------------------------------------------------------------
create or replace function public.campaign_transition_allowed(
  _from public.campaign_status,
  _to public.campaign_status
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select (_from, _to) in (
    ('draft'::public.campaign_status, 'funding_required'::public.campaign_status),
    ('draft', 'cancelled'),
    ('funding_required', 'draft'),
    ('funding_required', 'published'),
    ('funding_required', 'cancelled'),
    ('published', 'applications_open'),
    ('applications_open', 'selection_in_progress'),
    ('selection_in_progress', 'in_progress'),
    ('in_progress', 'review_pending'),
    ('review_pending', 'in_progress'),
    ('review_pending', 'completed')
  );
$$;

create or replace function public.campaign_is_editable(_status public.campaign_status)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select _status in ('draft'::public.campaign_status, 'funding_required'::public.campaign_status);
$$;

create or replace function public.campaigns_guard_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.owner_id is distinct from old.owner_id or new.id is distinct from old.id then
    raise exception 'campaign_owner_immutable' using errcode = '42501';
  end if;

  if new.status is distinct from old.status then
    if not public.campaign_transition_allowed(old.status, new.status) then
      raise exception 'invalid_campaign_transition: % -> %', old.status, new.status
        using errcode = 'P0001';
    end if;
    insert into public.campaign_status_events (campaign_id, from_status, to_status, actor_id)
    values (new.id, old.status, new.status, auth.uid());
  end if;

  -- After funding, anything that affects liability or what creators agreed to is frozen.
  if not public.campaign_is_editable(old.status) and (
       new.title is distinct from old.title
    or new.description is distinct from old.description
    or new.category_slug is distinct from old.category_slug
    or new.campaign_type is distinct from old.campaign_type
    or new.instructions is distinct from old.instructions
    or new.caption_instructions is distinct from old.caption_instructions
    or new.hashtags is distinct from old.hashtags
    or new.mentions is distinct from old.mentions
    or new.reference_url is distinct from old.reference_url
    or new.application_deadline is distinct from old.application_deadline
    or new.task_deadline is distinct from old.task_deadline
    or new.currency is distinct from old.currency
    or new.payment_per_creator_cents is distinct from old.payment_per_creator_cents
    or new.creators_required is distinct from old.creators_required
  ) then
    raise exception 'campaign_locked' using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger campaigns_guard_update
  before update on public.campaigns
  for each row execute function public.campaigns_guard_update();

create or replace function public.campaigns_record_creation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.campaign_status_events (campaign_id, from_status, to_status, actor_id)
  values (new.id, null, new.status, auth.uid());
  return new;
end;
$$;

create trigger campaigns_record_creation
  after insert on public.campaigns
  for each row execute function public.campaigns_record_creation();

-- Child rows of a locked campaign cannot change either.
create or replace function public.campaign_children_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_campaign_id uuid := coalesce(new.campaign_id, old.campaign_id);
  v_status public.campaign_status;
begin
  select status into v_status from public.campaigns where id = v_campaign_id;
  -- Parent already deleted (cascade) → nothing to protect.
  if v_status is not null and not public.campaign_is_editable(v_status) then
    raise exception 'campaign_locked' using errcode = '42501';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger campaign_platforms_guard before insert or update or delete on public.campaign_platforms
  for each row execute function public.campaign_children_guard();
create trigger campaign_tasks_guard before insert or update or delete on public.campaign_tasks
  for each row execute function public.campaign_children_guard();
create trigger campaign_requirements_guard before insert or update or delete on public.campaign_requirements
  for each row execute function public.campaign_children_guard();
create trigger campaign_creator_categories_guard before insert or update or delete on public.campaign_creator_categories
  for each row execute function public.campaign_children_guard();
create trigger campaign_locations_guard before insert or update or delete on public.campaign_locations
  for each row execute function public.campaign_children_guard();

-- -----------------------------------------------------------------------------
-- Visibility helpers
-- -----------------------------------------------------------------------------
create or replace function public.is_campaign_owner(_campaign_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.campaigns c
    where c.id = _campaign_id and c.owner_id = (select auth.uid())
  );
$$;

create or replace function public.can_edit_campaign(_campaign_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.campaigns c
    where c.id = _campaign_id
      and c.owner_id = (select auth.uid())
      and public.campaign_is_editable(c.status)
  );
$$;

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
      )
  );
$$;

revoke all on function public.is_campaign_owner(uuid) from public, anon;
revoke all on function public.can_edit_campaign(uuid) from public, anon;
revoke all on function public.can_view_campaign(uuid) from public, anon;
grant execute on function public.is_campaign_owner(uuid) to authenticated;
grant execute on function public.can_edit_campaign(uuid) to authenticated;
grant execute on function public.can_view_campaign(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Privileges
-- -----------------------------------------------------------------------------
revoke all on table
  public.creator_categories, public.campaign_task_type_rules, public.campaigns,
  public.campaign_platforms, public.campaign_tasks, public.campaign_requirements,
  public.campaign_creator_categories, public.campaign_locations, public.campaign_status_events
from anon, authenticated;

grant select on public.creator_categories, public.campaign_task_type_rules to authenticated;

grant select, delete on public.campaigns to authenticated;
-- No `status`, `owner_id` (defaults to auth.uid()), or lifecycle timestamps.
grant insert (
  title, description, category_slug, campaign_type, instructions, caption_instructions,
  hashtags, mentions, reference_url, application_deadline, task_deadline, currency,
  payment_per_creator_cents, creators_required
) on public.campaigns to authenticated;
grant update (
  title, description, category_slug, campaign_type, instructions, caption_instructions,
  hashtags, mentions, reference_url, application_deadline, task_deadline,
  payment_per_creator_cents, creators_required
) on public.campaigns to authenticated;

grant select, insert, delete on public.campaign_platforms to authenticated;
grant select, insert, update, delete on public.campaign_tasks to authenticated;
grant select, insert, update, delete on public.campaign_requirements to authenticated;
grant select, insert, delete on public.campaign_creator_categories to authenticated;
grant select, insert, update, delete on public.campaign_locations to authenticated;
grant select on public.campaign_status_events to authenticated;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.creator_categories enable row level security;
alter table public.campaign_task_type_rules enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_platforms enable row level security;
alter table public.campaign_tasks enable row level security;
alter table public.campaign_requirements enable row level security;
alter table public.campaign_creator_categories enable row level security;
alter table public.campaign_locations enable row level security;
alter table public.campaign_status_events enable row level security;

create policy "creator_categories: readable" on public.creator_categories
  for select to authenticated using (true);
create policy "task_type_rules: readable" on public.campaign_task_type_rules
  for select to authenticated using (true);

create policy "campaigns: owner reads own" on public.campaigns
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "campaigns: signed-in users read live campaigns" on public.campaigns
  for select to authenticated using (status in ('published', 'applications_open'));
create policy "campaigns: admin reads all" on public.campaigns
  for select to authenticated using ((select public.is_admin()));
create policy "campaigns: owner creates drafts" on public.campaigns
  for insert to authenticated with check (owner_id = (select auth.uid()) and status = 'draft');
create policy "campaigns: owner edits editable campaigns" on public.campaigns
  for update to authenticated
  using (owner_id = (select auth.uid()) and public.campaign_is_editable(status))
  with check (owner_id = (select auth.uid()) and public.campaign_is_editable(status));
create policy "campaigns: owner deletes drafts" on public.campaigns
  for delete to authenticated using (owner_id = (select auth.uid()) and status = 'draft');

-- Child tables: visible with the parent; writable by the owner while editable.
create policy "campaign_platforms: visible with campaign" on public.campaign_platforms
  for select to authenticated using (public.can_view_campaign(campaign_id));
create policy "campaign_platforms: owner writes" on public.campaign_platforms
  for all to authenticated
  using (public.can_edit_campaign(campaign_id)) with check (public.can_edit_campaign(campaign_id));

create policy "campaign_tasks: visible with campaign" on public.campaign_tasks
  for select to authenticated using (public.can_view_campaign(campaign_id));
create policy "campaign_tasks: owner writes" on public.campaign_tasks
  for all to authenticated
  using (public.can_edit_campaign(campaign_id)) with check (public.can_edit_campaign(campaign_id));

create policy "campaign_requirements: visible with campaign" on public.campaign_requirements
  for select to authenticated using (public.can_view_campaign(campaign_id));
create policy "campaign_requirements: owner writes" on public.campaign_requirements
  for all to authenticated
  using (public.can_edit_campaign(campaign_id)) with check (public.can_edit_campaign(campaign_id));

create policy "campaign_creator_categories: visible with campaign" on public.campaign_creator_categories
  for select to authenticated using (public.can_view_campaign(campaign_id));
create policy "campaign_creator_categories: owner writes" on public.campaign_creator_categories
  for all to authenticated
  using (public.can_edit_campaign(campaign_id)) with check (public.can_edit_campaign(campaign_id));

create policy "campaign_locations: visible with campaign" on public.campaign_locations
  for select to authenticated using (public.can_view_campaign(campaign_id));
create policy "campaign_locations: owner writes" on public.campaign_locations
  for all to authenticated
  using (public.can_edit_campaign(campaign_id)) with check (public.can_edit_campaign(campaign_id));

create policy "campaign_status_events: owner and admin read" on public.campaign_status_events
  for select to authenticated
  using (public.is_campaign_owner(campaign_id) or (select public.is_admin()));

-- -----------------------------------------------------------------------------
-- Atomic draft save (SECURITY INVOKER: runs under the caller's grants + RLS)
-- -----------------------------------------------------------------------------
-- p_campaign: scalar fields; p_platforms: enum[]; p_tasks / p_locations: jsonb arrays;
-- p_categories: text[]; p_requirements: jsonb object or null; p_campaign_id: null creates
-- a new draft. Child rows are replaced wholesale.
create or replace function public.save_campaign_draft(
  p_campaign jsonb,
  p_platforms public.social_platform[],
  p_tasks jsonb,
  p_categories text[],
  p_locations jsonb,
  p_requirements jsonb default null,
  p_campaign_id uuid default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid := p_campaign_id;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if v_id is null then
    insert into public.campaigns (
      title, description, category_slug, campaign_type, instructions, caption_instructions,
      hashtags, mentions, reference_url, application_deadline, task_deadline,
      payment_per_creator_cents, creators_required
    )
    select
      r.title, r.description, r.category_slug, r.campaign_type, r.instructions, r.caption_instructions,
      coalesce(r.hashtags, '{}'), coalesce(r.mentions, '{}'), r.reference_url,
      r.application_deadline, r.task_deadline, r.payment_per_creator_cents, r.creators_required
    from jsonb_populate_record(null::public.campaigns, p_campaign) r
    returning id into v_id;
  else
    update public.campaigns c
    set title = r.title,
        description = r.description,
        category_slug = r.category_slug,
        campaign_type = r.campaign_type,
        instructions = r.instructions,
        caption_instructions = r.caption_instructions,
        hashtags = coalesce(r.hashtags, '{}'),
        mentions = coalesce(r.mentions, '{}'),
        reference_url = r.reference_url,
        application_deadline = r.application_deadline,
        task_deadline = r.task_deadline,
        payment_per_creator_cents = r.payment_per_creator_cents,
        creators_required = r.creators_required
    from jsonb_populate_record(null::public.campaigns, p_campaign) r
    where c.id = v_id;

    if not found then
      raise exception 'campaign_not_editable' using errcode = '42501';
    end if;

    delete from public.campaign_platforms where campaign_id = v_id; -- cascades to tasks
    delete from public.campaign_requirements where campaign_id = v_id;
    delete from public.campaign_creator_categories where campaign_id = v_id;
    delete from public.campaign_locations where campaign_id = v_id;
  end if;

  insert into public.campaign_platforms (campaign_id, platform)
  select v_id, p from unnest(coalesce(p_platforms, '{}')) as p;

  insert into public.campaign_tasks (campaign_id, platform, task_type, quantity, custom_description, position)
  select v_id, t.platform, t.task_type, coalesce(t.quantity, 1), t.custom_description, (t.ord - 1)::smallint
  from rows from (
    jsonb_to_recordset(coalesce(p_tasks, '[]'))
      as (platform public.social_platform, task_type public.campaign_task_type,
          quantity smallint, custom_description text)
  ) with ordinality as t(platform, task_type, quantity, custom_description, ord);

  if p_requirements is not null and p_requirements <> 'null'::jsonb then
    insert into public.campaign_requirements (campaign_id, min_followers, genders, age_min, age_max)
    select v_id, r.min_followers, coalesce(r.genders, '{}'), r.age_min, r.age_max
    from jsonb_populate_record(null::public.campaign_requirements, p_requirements) r;
  end if;

  insert into public.campaign_creator_categories (campaign_id, category_slug)
  select v_id, c from unnest(coalesce(p_categories, '{}')) as c;

  insert into public.campaign_locations (campaign_id, country_code, region, city)
  select v_id, upper(l.country_code), nullif(btrim(l.region), ''), nullif(btrim(l.city), '')
  from jsonb_to_recordset(coalesce(p_locations, '[]')) as l(country_code text, region text, city text);

  return v_id;
end;
$$;

revoke all on function public.save_campaign_draft(jsonb, public.social_platform[], jsonb, text[], jsonb, jsonb, uuid)
  from public, anon;
grant execute on function public.save_campaign_draft(jsonb, public.social_platform[], jsonb, text[], jsonb, jsonb, uuid)
  to authenticated;

-- -----------------------------------------------------------------------------
-- Funding readiness (used by request + funding functions)
-- -----------------------------------------------------------------------------
create or replace function public._assert_campaign_fundable(_campaign_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  c public.campaigns%rowtype;
begin
  select * into c from public.campaigns where id = _campaign_id;
  if c.description is null or char_length(btrim(c.description)) < 40 then
    raise exception 'campaign_incomplete: description' using errcode = 'P0001';
  end if;
  if c.category_slug is null or c.campaign_type is null then
    raise exception 'campaign_incomplete: category_or_type' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.campaign_platforms where campaign_id = _campaign_id) then
    raise exception 'campaign_incomplete: platforms' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.campaign_tasks where campaign_id = _campaign_id) then
    raise exception 'campaign_incomplete: tasks' using errcode = 'P0001';
  end if;
  if c.application_deadline is null or c.task_deadline is null then
    raise exception 'campaign_incomplete: dates' using errcode = 'P0001';
  end if;
  if c.application_deadline <= now() then
    raise exception 'campaign_incomplete: application_deadline_passed' using errcode = 'P0001';
  end if;
  if c.payment_per_creator_cents is null or c.creators_required is null then
    raise exception 'campaign_incomplete: budget' using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public._assert_campaign_fundable(uuid) from public, anon, authenticated;

-- draft → funding_required
create or replace function public.request_campaign_funding(p_campaign_id uuid)
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
  if v_status = 'funding_required' then
    return v_status; -- idempotent
  end if;
  if v_status <> 'draft' then
    raise exception 'invalid_campaign_transition: % -> funding_required', v_status using errcode = 'P0001';
  end if;

  perform public._assert_campaign_fundable(p_campaign_id);

  update public.campaigns
  set status = 'funding_required', funding_requested_at = now()
  where id = p_campaign_id;

  return 'funding_required';
end;
$$;

-- Cancelling is only possible before funding in this phase (refunds come later).
create or replace function public.cancel_campaign(p_campaign_id uuid, p_reason text default null)
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
  if v_status = 'cancelled' then
    return v_status;
  end if;
  if v_status not in ('draft', 'funding_required') then
    raise exception 'cancel_requires_refund_flow' using errcode = 'P0001';
  end if;
  update public.campaigns
  set status = 'cancelled', cancelled_at = now(),
      cancellation_reason = nullif(left(btrim(coalesce(p_reason, '')), 500), '')
  where id = p_campaign_id;
  return 'cancelled';
end;
$$;

revoke all on function public.request_campaign_funding(uuid) from public, anon;
revoke all on function public.cancel_campaign(uuid, text) from public, anon;
grant execute on function public.request_campaign_funding(uuid) to authenticated;
grant execute on function public.cancel_campaign(uuid, text) to authenticated;

-- -----------------------------------------------------------------------------
-- Tab counts for the advertiser's campaign list (SECURITY INVOKER → RLS applies)
-- -----------------------------------------------------------------------------
create or replace function public.my_campaign_status_counts()
returns table (status public.campaign_status, total bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select c.status, count(*)::bigint
  from public.campaigns c
  where c.owner_id = (select auth.uid())
  group by c.status;
$$;

revoke all on function public.my_campaign_status_counts() from public, anon;
grant execute on function public.my_campaign_status_counts() to authenticated;
