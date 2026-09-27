-- =============================================================================
-- Phase 3a: creator eligibility details + linked social accounts.
--
-- * creator_profiles holds eligibility facts (country, date of birth, gender,
--   categories). It is private to its owner (and admins). Advertisers never read
--   it; they see a snapshot captured on each application instead.
-- * social_accounts are linked MANUALLY in V1 (handle + self-reported follower
--   count). Nothing is verified automatically; `verification_status` can only be
--   changed by trusted server code (no client grant). OAuth arrives later behind
--   the SocialAccountProvider interface.
-- =============================================================================

create type public.social_connection_method as enum ('manual', 'oauth');
create type public.social_verification_status as enum ('unverified', 'verified');
create type public.social_account_status as enum ('connected', 'disconnected');

-- -----------------------------------------------------------------------------
-- creator_profiles (1:1 with profiles; optional)
-- -----------------------------------------------------------------------------
create table public.creator_profiles (
  user_id       uuid primary key references public.profiles (id) on delete cascade,
  country_code  char(2) check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  date_of_birth date check (date_of_birth is null or date_of_birth >= date '1900-01-01'),
  gender        public.creator_gender,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.creator_profiles is
  'Private creator eligibility facts. Never exposed to advertisers directly.';

create trigger creator_profiles_set_updated_at
  before update on public.creator_profiles
  for each row execute function public.set_updated_at();

-- Minimum age 13, checked on write (CHECK constraints cannot use the current date).
create or replace function public.creator_profiles_validate()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.date_of_birth is not null and new.date_of_birth > (current_date - interval '13 years')::date then
    raise exception 'creator_too_young' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger creator_profiles_validate
  before insert or update on public.creator_profiles
  for each row execute function public.creator_profiles_validate();

create table public.creator_profile_categories (
  user_id       uuid not null references public.creator_profiles (user_id) on delete cascade,
  category_slug text not null references public.creator_categories (slug),
  primary key (user_id, category_slug)
);

-- -----------------------------------------------------------------------------
-- social_accounts
-- -----------------------------------------------------------------------------
create table public.social_accounts (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  platform            public.social_platform not null,
  handle              text not null check (handle ~ '^[A-Za-z0-9._-]{1,50}$'),
  -- Self-reported in V1. Advertisers check the live profile before selecting.
  follower_count      integer check (follower_count is null or follower_count between 0 and 2000000000),
  connection_method   public.social_connection_method not null default 'manual',
  verification_status public.social_verification_status not null default 'unverified',
  provider_account_id text check (provider_account_id is null or char_length(provider_account_id) <= 200),
  status              public.social_account_status not null default 'connected',
  disconnected_at     timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint social_accounts_disconnected_at check ((status = 'disconnected') = (disconnected_at is not null))
);

comment on column public.social_accounts.follower_count is
  'Self-reported by the creator in V1. Not verified.';

-- One connected account per platform per user.
create unique index social_accounts_one_connected_idx
  on public.social_accounts (user_id, platform) where status = 'connected';
create index social_accounts_user_idx on public.social_accounts (user_id, status);

create trigger social_accounts_set_updated_at
  before update on public.social_accounts
  for each row execute function public.set_updated_at();

-- Keep disconnected_at consistent with status on client updates.
create or replace function public.social_accounts_status_timestamps()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'disconnected' and old.status is distinct from 'disconnected' then
    new.disconnected_at := now();
  elsif new.status = 'connected' then
    new.disconnected_at := null;
  end if;
  return new;
end;
$$;

create trigger social_accounts_status_timestamps
  before update on public.social_accounts
  for each row execute function public.social_accounts_status_timestamps();

-- -----------------------------------------------------------------------------
-- Canonical profile URL (always points at the platform's own domain)
-- -----------------------------------------------------------------------------
create or replace function public.social_profile_url(_platform public.social_platform, _handle text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case _platform
    when 'instagram' then 'https://www.instagram.com/' || _handle || '/'
    when 'tiktok'    then 'https://www.tiktok.com/@' || _handle
    when 'facebook'  then 'https://www.facebook.com/' || _handle
    when 'youtube'   then 'https://www.youtube.com/@' || _handle
  end;
$$;

-- -----------------------------------------------------------------------------
-- Privileges + RLS
-- -----------------------------------------------------------------------------
revoke all on public.creator_profiles, public.creator_profile_categories, public.social_accounts from anon, authenticated;

grant select on public.creator_profiles to authenticated;
grant insert (user_id, country_code, date_of_birth, gender) on public.creator_profiles to authenticated;
grant update (country_code, date_of_birth, gender) on public.creator_profiles to authenticated;

grant select, insert, delete on public.creator_profile_categories to authenticated;

grant select on public.social_accounts to authenticated;
-- No grant on verification_status, connection_method or provider_account_id.
grant insert (platform, handle, follower_count) on public.social_accounts to authenticated;
grant update (handle, follower_count, status) on public.social_accounts to authenticated;

alter table public.creator_profiles enable row level security;
alter table public.creator_profile_categories enable row level security;
alter table public.social_accounts enable row level security;

create policy "creator_profiles: owner reads" on public.creator_profiles
  for select to authenticated using (user_id = (select auth.uid()));
create policy "creator_profiles: admin reads" on public.creator_profiles
  for select to authenticated using ((select public.is_admin()));
create policy "creator_profiles: owner creates" on public.creator_profiles
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "creator_profiles: owner updates" on public.creator_profiles
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "creator_profile_categories: owner reads" on public.creator_profile_categories
  for select to authenticated using (user_id = (select auth.uid()));
create policy "creator_profile_categories: admin reads" on public.creator_profile_categories
  for select to authenticated using ((select public.is_admin()));
create policy "creator_profile_categories: owner writes" on public.creator_profile_categories
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "creator_profile_categories: owner deletes" on public.creator_profile_categories
  for delete to authenticated using (user_id = (select auth.uid()));

create policy "social_accounts: owner reads" on public.social_accounts
  for select to authenticated using (user_id = (select auth.uid()));
create policy "social_accounts: admin reads" on public.social_accounts
  for select to authenticated using ((select public.is_admin()));
create policy "social_accounts: owner links" on public.social_accounts
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "social_accounts: owner updates" on public.social_accounts
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
-- No DELETE: disconnecting keeps the row so past applications stay explainable.

-- -----------------------------------------------------------------------------
-- Atomic save of creator details + categories (SECURITY INVOKER → RLS applies)
-- -----------------------------------------------------------------------------
-- Omitted parameters clear the field (null = not provided).
create or replace function public.save_creator_profile(
  p_country_code text default null,
  p_date_of_birth date default null,
  p_gender public.creator_gender default null,
  p_categories text[] default '{}'
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  insert into public.creator_profiles (user_id, country_code, date_of_birth, gender)
  values (v_uid, nullif(upper(btrim(p_country_code)), ''), p_date_of_birth, p_gender)
  on conflict (user_id) do update
    set country_code = excluded.country_code,
        date_of_birth = excluded.date_of_birth,
        gender = excluded.gender;

  delete from public.creator_profile_categories where user_id = v_uid;
  insert into public.creator_profile_categories (user_id, category_slug)
  select v_uid, c from unnest(coalesce(p_categories, '{}')) as c;
end;
$$;

revoke all on function public.save_creator_profile(text, date, public.creator_gender, text[]) from public, anon;
grant execute on function public.save_creator_profile(text, date, public.creator_gender, text[]) to authenticated;
