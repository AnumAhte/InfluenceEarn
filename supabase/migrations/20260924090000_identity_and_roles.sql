-- =============================================================================
-- Phase 1: identity, profiles, workspace (Advertiser ↔ Influencer) and platform roles.
--
-- Model
--   * One auth user  → one profile.
--   * Every user can act as Advertiser AND Influencer. `profiles.active_workspace`
--     only remembers which workspace the UI shows; it grants no extra privileges.
--   * Privileged platform roles (Agency Admin) live in `user_roles`. Users can read
--     their own rows but can never write them; grants happen via service role / SQL.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
create type public.workspace_role as enum ('advertiser', 'influencer');
create type public.platform_role as enum ('admin');

-- -----------------------------------------------------------------------------
-- Shared trigger: keep updated_at current
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- profiles
-- -----------------------------------------------------------------------------
create table public.profiles (
  id                      uuid primary key references auth.users (id) on delete cascade,
  full_name               text not null default ''
                            check (char_length(full_name) <= 120),
  phone                   text
                            check (phone is null or phone ~ '^\+?[0-9][0-9 ()-]{5,23}$'),
  city                    text
                            check (city is null or char_length(city) between 1 and 80),
  bio                     text
                            check (bio is null or char_length(bio) <= 160),
  -- Object path inside the private `avatars` bucket; must live in the user's own folder.
  avatar_path             text
                            check (avatar_path is null or avatar_path like (id::text || '/%')),
  active_workspace        public.workspace_role not null default 'advertiser',
  workspace_chosen_at     timestamptz,
  onboarding_completed_at timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

comment on table public.profiles is
  'One row per auth user. Holds personal details and the currently active workspace.';
comment on column public.profiles.active_workspace is
  'UI preference only (advertiser | influencer). Never used for authorization.';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- user_roles (privileged platform roles)
-- -----------------------------------------------------------------------------
create table public.user_roles (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  role       public.platform_role not null,
  granted_by uuid references public.profiles (id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);

comment on table public.user_roles is
  'Privileged platform roles. Writable only by the service role / database owner.';

create index user_roles_role_idx on public.user_roles (role);

-- -----------------------------------------------------------------------------
-- Role helpers (SECURITY DEFINER so RLS policies can call them without recursion)
-- -----------------------------------------------------------------------------
create or replace function public.has_platform_role(_role public.platform_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.role = _role
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_platform_role('admin'::public.platform_role);
$$;

revoke all on function public.has_platform_role(public.platform_role) from public, anon;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.has_platform_role(public.platform_role) to authenticated;
grant execute on function public.is_admin() to authenticated;

-- -----------------------------------------------------------------------------
-- Create a profile for every new auth user
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    left(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), 120)
  );
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- Privileges: least privilege first, then RLS narrows rows.
-- -----------------------------------------------------------------------------
revoke all on table public.profiles from anon, authenticated;
revoke all on table public.user_roles from anon, authenticated;

grant select on table public.profiles to authenticated;
-- Column-level grant: users can never change id, created_at or updated_at directly.
grant update (
  full_name,
  phone,
  city,
  bio,
  avatar_path,
  active_workspace,
  workspace_chosen_at,
  onboarding_completed_at
) on table public.profiles to authenticated;

grant select on table public.user_roles to authenticated;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;

create policy "profiles: owner can read"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()));

create policy "profiles: admin can read all"
  on public.profiles for select
  to authenticated
  using ((select public.is_admin()));

create policy "profiles: owner can update"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- No INSERT / DELETE policies: rows are created by handle_new_user() and removed
-- by the auth.users cascade.

create policy "user_roles: owner can read own roles"
  on public.user_roles for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "user_roles: admin can read all"
  on public.user_roles for select
  to authenticated
  using ((select public.is_admin()));

-- No INSERT / UPDATE / DELETE policies: platform roles are granted out-of-band.

-- -----------------------------------------------------------------------------
-- Storage: private avatars bucket (JPG/PNG, max 2 MB), one folder per user.
-- Files are served through short-lived signed URLs.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 2097152, array['image/jpeg', 'image/png'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "avatars: owner can read"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "avatars: admin can read"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'avatars' and (select public.is_admin()));

create policy "avatars: owner can upload"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "avatars: owner can replace"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "avatars: owner can delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
