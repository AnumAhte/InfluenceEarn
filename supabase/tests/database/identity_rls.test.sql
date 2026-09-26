-- RLS / privilege tests for phase 1. Run with: npx supabase test db
begin;

create extension if not exists pgtap with schema extensions;

select plan(16);

-- Fixtures ---------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data, aud, role)
values
  ('11111111-1111-1111-1111-111111111111', 'alice@test.local', '{"full_name":"Alice"}', 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'bob@test.local',   '{"full_name":"Bob"}',   'authenticated', 'authenticated'),
  ('33333333-3333-3333-3333-333333333333', 'ada@test.local',   '{"full_name":"Ada"}',   'authenticated', 'authenticated');

insert into public.user_roles (user_id, role)
values ('33333333-3333-3333-3333-333333333333', 'admin');

select is(
  (select full_name from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  'Alice',
  'a profile is created for every new auth user'
);

select is(
  (select active_workspace::text from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  'advertiser',
  'new profiles default to the advertiser workspace'
);

-- Act as Alice (regular user) ---------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

select is((select count(*) from public.profiles)::int, 1, 'a user can only read their own profile');
select is(public.is_admin(), false, 'a regular user is not an admin');
select is((select count(*) from public.user_roles)::int, 0, 'a regular user sees no platform roles');

select lives_ok(
  $$ update public.profiles set active_workspace = 'influencer', city = 'Lahore'
     where id = '11111111-1111-1111-1111-111111111111' $$,
  'a user can switch workspace and edit their profile'
);

update public.profiles set full_name = 'hacked' where id = '22222222-2222-2222-2222-222222222222';

select throws_ok(
  $$ update public.profiles set created_at = now() where id = '11111111-1111-1111-1111-111111111111' $$,
  '42501', null,
  'a user cannot update protected columns'
);

select throws_ok(
  $$ insert into public.user_roles (user_id, role) values ('11111111-1111-1111-1111-111111111111', 'admin') $$,
  '42501', null,
  'a user cannot grant themselves the admin role'
);

select throws_ok(
  $$ insert into public.profiles (id) values ('44444444-4444-4444-4444-444444444444') $$,
  '42501', null,
  'a user cannot insert profiles directly'
);

select throws_ok(
  $$ delete from public.profiles where id = '11111111-1111-1111-1111-111111111111' $$,
  '42501', null,
  'a user cannot delete profiles'
);

select throws_ok(
  $$ update public.profiles set avatar_path = '22222222-2222-2222-2222-222222222222/avatar.png'
     where id = '11111111-1111-1111-1111-111111111111' $$,
  '23514', null,
  'avatar_path must point inside the owner''s folder'
);

-- Act as Ada (admin) --------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);

select is(public.is_admin(), true, 'an admin is recognised by is_admin()');
select is(
  (select count(*) from public.profiles where id in (
    '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333'))::int,
  3, 'an admin can read all profiles');

update public.profiles set full_name = 'edited by admin' where id = '22222222-2222-2222-2222-222222222222';

-- Anonymous visitors ------------------------------------------------------------
reset role;
set local role anon;
select throws_ok(
  $$ select count(*) from public.profiles $$,
  '42501', null,
  'anonymous visitors cannot read profiles'
);

-- Verify as owner ---------------------------------------------------------------
reset role;

select is(
  (select full_name from public.profiles where id = '22222222-2222-2222-2222-222222222222'),
  'Bob',
  'neither another user nor an admin can edit someone else''s profile'
);

select is(
  (select active_workspace::text from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  'influencer',
  'workspace switch persisted'
);

select * from finish();
rollback;
