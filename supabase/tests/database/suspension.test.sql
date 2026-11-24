-- Phase 6: admin account suspension. Run with: npx supabase test db
begin;

create extension if not exists pgtap with schema extensions;

select plan(30);

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data, aud, role) values
  ('5a000000-0000-0000-0000-00000000000a', 'susp-admin-a@test.local', now(), '{"full_name":"Admin A"}', 'authenticated', 'authenticated'),
  ('5a000000-0000-0000-0000-00000000000b', 'susp-admin-b@test.local', now(), '{"full_name":"Admin B"}', 'authenticated', 'authenticated'),
  ('5a000000-0000-0000-0000-000000000001', 'susp-user@test.local',    now(), '{"full_name":"Some User"}', 'authenticated', 'authenticated'),
  ('5a000000-0000-0000-0000-000000000002', 'susp-other@test.local',   now(), '{"full_name":"Other User"}', 'authenticated', 'authenticated');
insert into public.user_roles (user_id, role) values
  ('5a000000-0000-0000-0000-00000000000a', 'admin'), ('5a000000-0000-0000-0000-00000000000b', 'admin');
insert into auth.sessions (id, user_id, created_at, updated_at) values
  (gen_random_uuid(), '5a000000-0000-0000-0000-000000000001', now(), now());

-- Non-admins ---------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"5a000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select throws_ok($$ select public.suspend_user('5a000000-0000-0000-0000-000000000001', 'Spam campaigns') $$,
  '42501', 'admin_required', 'a non-admin cannot suspend users');
select throws_ok($$ select * from public.admin_list_users() $$, '42501', 'admin_required', 'a non-admin cannot list users');
select throws_ok($$ select public.admin_get_user_email('5a000000-0000-0000-0000-000000000001') $$, '42501', 'admin_required',
  'a non-admin cannot read user emails');
select is((select count(*)::int from public.user_suspensions), 0, 'a non-admin cannot read suspensions');
select throws_ok($$ insert into public.user_suspensions (user_id, reason, suspended_by) values
  ('5a000000-0000-0000-0000-000000000001', 'direct insert', '5a000000-0000-0000-0000-000000000002') $$,
  '42501', null, 'nobody can write suspensions directly');

-- Admin A ------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"5a000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select throws_ok($$ select public.suspend_user('5a000000-0000-0000-0000-000000000001', '  ') $$,
  '22023', 'suspension_reason_required', 'a reason is required');
select throws_ok($$ select public.suspend_user('5a000000-0000-0000-0000-00000000000a', 'Testing myself') $$,
  'P0001', 'cannot_suspend_self', 'an admin cannot suspend themselves');
select lives_ok($$ select public.suspend_user('5a000000-0000-0000-0000-000000000001', 'Repeated fake proof links') $$,
  'an admin suspends a user with a reason');
select throws_ok($$ select public.suspend_user('5a000000-0000-0000-0000-000000000001', 'Again please') $$,
  'P0001', 'already_suspended', 'an active suspension is not duplicated');
select is((select suspended_by::text || '|' || reason from public.user_suspensions where user_id = '5a000000-0000-0000-0000-000000000001'),
  '5a000000-0000-0000-0000-00000000000a|Repeated fake proof links', 'who suspended and why is recorded');
select is((select count(*)::int from public.admin_list_users(null, 'suspended')), 1, 'the suspended filter lists the user');
select is((select email from public.admin_list_users('susp-user', 'all')), 'susp-user@test.local', 'admins can search users by email');
select is((select count(*)::int from public.admin_list_users('%', 'all')), 0, 'search treats % literally');

reset role;
select is((select banned_until > now() + interval '99 years' from auth.users where id = '5a000000-0000-0000-0000-000000000001'), true,
  'sign-in is blocked in Auth (banned)');
select is((select count(*)::int from auth.sessions where user_id = '5a000000-0000-0000-0000-000000000001'), 0,
  'existing sessions are ended');
select is((select action || ':' || (details->>'reason') from public.admin_activity_logs
           where target_id = '5a000000-0000-0000-0000-000000000001' order by id desc limit 1),
  'user.suspended:Repeated fake proof links', 'the suspension is in the activity log');
select is((select count(*)::int from public.notifications where recipient_id = '5a000000-0000-0000-0000-000000000001' and type = 'account_suspended'),
  1, 'the user gets an account notice');
select is(public._email_skip_reason('5a000000-0000-0000-0000-000000000001', 'account_suspended'), null,
  'account notices are still emailed to a suspended user');
select is(public._email_skip_reason('5a000000-0000-0000-0000-000000000001', 'task_approved'), 'account_suspended',
  'other emails are skipped while suspended');

-- The suspended user's still-valid token -----------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"5a000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select throws_ok($$ select public.reject_suspended_requests() $$, '42501', 'account_suspended',
  'every API request from a suspended user is rejected (pre-request hook)');
select is((select count(*)::int from storage.objects), 0, 'a suspended user has no storage access');
select set_config('request.jwt.claims', '{"sub":"5a000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select lives_ok($$ select public.reject_suspended_requests() $$, 'other users are not affected');

-- Admins and the last-admin rule ----------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"5a000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select lives_ok($$ select public.suspend_user('5a000000-0000-0000-0000-00000000000b', 'Compromised admin account') $$,
  'an admin can suspend another admin while an active admin remains');
select set_config('request.jwt.claims', '{"sub":"5a000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select throws_ok($$ select public.suspend_user('5a000000-0000-0000-0000-00000000000a', 'Retaliation attempt') $$,
  '42501', 'admin_required', 'a suspended admin fails every admin check (so the last active admin can''t be suspended)');
select throws_ok($$ select public.unsuspend_user('5a000000-0000-0000-0000-00000000000b') $$,
  '42501', 'admin_required', 'a suspended admin cannot reinstate themselves');

-- Reinstatement --------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"5a000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select lives_ok($$ select public.unsuspend_user('5a000000-0000-0000-0000-000000000001', 'Appeal accepted') $$, 'an admin reinstates a user');
select throws_ok($$ select public.unsuspend_user('5a000000-0000-0000-0000-000000000001') $$, 'P0001', 'not_suspended',
  'reinstating an active user is refused');
reset role;
select is((select banned_until from auth.users where id = '5a000000-0000-0000-0000-000000000001'), null, 'sign-in is allowed again');
select is((select lifted_by::text || '|' || lift_reason from public.user_suspensions where user_id = '5a000000-0000-0000-0000-000000000001'),
  '5a000000-0000-0000-0000-00000000000a|Appeal accepted', 'who reinstated and why is recorded (history kept)');
select is((select count(*)::int from public.admin_activity_logs where target_id = '5a000000-0000-0000-0000-000000000001' and action = 'user.unsuspended'),
  1, 'the reinstatement is in the activity log');

select * from finish();
rollback;
