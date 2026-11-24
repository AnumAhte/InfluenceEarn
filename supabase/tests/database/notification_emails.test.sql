-- Phase 6: notification email queue, statuses, idempotency, preferences. Run with: npx supabase test db
begin;

create extension if not exists pgtap with schema extensions;

select plan(27);

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data, aud, role) values
  ('e0000000-0000-0000-0000-000000000001', 'mail-a@test.local', now(), '{"full_name":"Mail A"}', 'authenticated', 'authenticated'),
  ('e0000000-0000-0000-0000-000000000002', 'mail-b@test.local', now(), '{"full_name":"Mail B"}', 'authenticated', 'authenticated'),
  ('e0000000-0000-0000-0000-000000000003', 'mail-c@test.local', null,  '{"full_name":"Mail C"}', 'authenticated', 'authenticated');

-- Anything left over from other runs must not interfere with this test's claims.
update public.notifications set email_status = 'skipped' where email_status = 'pending';

select public._notify('e0000000-0000-0000-0000-000000000001', 'task_approved', 'Work approved', 'Your work was approved.', '/tasks');
select public._notify('e0000000-0000-0000-0000-000000000003', 'task_approved', 'Unconfirmed', 'No confirmed email.', '/tasks');
create temp table t_n as select id, recipient_id from public.notifications where recipient_id in
  ('e0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000003');
grant select on t_n to authenticated, service_role;

-- Clients ------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e0000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select throws_ok($$ select * from public.claim_notification_emails(10, 60) $$, '42501', null, 'users cannot claim the email queue');
select throws_ok($$ select public.record_notification_email_result(gen_random_uuid(), 1::smallint, true) $$, '42501', null, 'users cannot record email results');
select is((select email_status::text from public.notifications where recipient_id = 'e0000000-0000-0000-0000-000000000001'), 'pending',
  'the recipient can see the email status');
select throws_ok($$ select email_error from public.notifications $$, '42501', null, 'delivery errors are not readable by users');
select throws_ok($$ update public.notifications set email_status = 'sent' $$, '42501', null, 'users cannot change the email status');

-- Preferences
select lives_ok($$ insert into public.notification_preferences (user_id, email_work) values ('e0000000-0000-0000-0000-000000000001', true) $$,
  'a user can save their own preferences');
select lives_ok($$ insert into public.notification_preferences (user_id, email_work) values ('e0000000-0000-0000-0000-000000000001', true)
  on conflict (user_id) do update set user_id = excluded.user_id, email_work = excluded.email_work $$,
  'a user can upsert their own preferences (as the API does)');
select throws_ok($$ insert into public.notification_preferences (user_id, email_work) values ('e0000000-0000-0000-0000-000000000002', false) $$,
  '42501', null, 'a user cannot save preferences for someone else');
select set_config('request.jwt.claims', '{"sub":"e0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select is((select count(*)::int from public.notification_preferences), 0, 'users cannot read other users'' preferences');
update public.notification_preferences set email_work = false where user_id = 'e0000000-0000-0000-0000-000000000001';
reset role;
select is((select email_work from public.notification_preferences where user_id = 'e0000000-0000-0000-0000-000000000001'), true,
  'users cannot change other users'' preferences');

-- Worker: claim + send -----------------------------------------------------------
set local role service_role;
create temp table t_claim as select * from public.claim_notification_emails(10, 60);
select is((select count(*)::int from t_claim), 1, 'one deliverable notification is claimed');
select is((select recipient_email from t_claim), 'mail-a@test.local', 'the claim carries the recipient''s confirmed email');
select is((select attempt from t_claim), 1::smallint, 'the first claim is attempt 1');
select is((select email_status::text || ':' || email_error from public.notifications where recipient_id = 'e0000000-0000-0000-0000-000000000003'),
  'skipped:no_confirmed_email', 'a recipient without a confirmed email is skipped');
select is((select count(*)::int from public.claim_notification_emails(10, 60)), 0, 'a leased notification is not claimed twice');

select throws_ok($$ select public.record_notification_email_result((select notification_id from t_claim), 2::smallint, true) $$,
  'P0001', 'stale_email_attempt', 'a result for a different attempt is refused');
select is(public.record_notification_email_result((select notification_id from t_claim), 1::smallint, true, '<m1@test>'), 'sent',
  'an accepted message is recorded as sent');
select is(public.record_notification_email_result((select notification_id from t_claim), 1::smallint, false, null, 'late failure'), 'sent',
  'a later result cannot change a sent email');
reset role;
select is((select email_message_id from public.notifications where id = (select notification_id from t_claim)), '<m1@test>',
  'the provider message id is stored');
select is((select count(*)::int from public.notifications where id = (select notification_id from t_claim) and email_sent_at is not null), 1,
  'the sent time is stored');

-- Worker: opt-out ------------------------------------------------------------------
insert into public.notification_preferences (user_id, email_applications) values ('e0000000-0000-0000-0000-000000000002', false);
select public._notify('e0000000-0000-0000-0000-000000000002', 'application_received', 'New application', 'Someone applied.', '/campaigns');
select public._notify('e0000000-0000-0000-0000-000000000002', 'payout_released', 'Payment released', 'You were paid.', '/wallet');
set local role service_role;
select is((select count(*)::int from public.claim_notification_emails(10, 60)), 1, 'only the category the user kept is claimed');
reset role;
select is((select email_status::text || ':' || email_error from public.notifications
           where recipient_id = 'e0000000-0000-0000-0000-000000000002' and type = 'application_received'),
  'skipped:opted_out', 'an opted-out category is skipped');

-- Worker: retries and final failure ------------------------------------------------
create temp table t_fail as select id from public.notifications
  where recipient_id = 'e0000000-0000-0000-0000-000000000002' and type = 'payout_released';
grant select on t_fail to service_role;
set local role service_role;
select is(public.record_notification_email_result((select id from t_fail), 1::smallint, false, null, 'ECONNREFUSED'), 'pending',
  'a failed attempt stays pending for a retry');
select is((select count(*)::int from public.claim_notification_emails(10, 60)), 0, 'a retry waits for its backoff');
reset role;
update public.notifications set email_attempts = 5, email_next_attempt_at = null where id = (select id from t_fail);
set local role service_role;
select is(public.record_notification_email_result((select id from t_fail), 5::smallint, false, null, 'ECONNREFUSED'), 'failed',
  'the fifth failed attempt is final');
reset role;
select is((select email_error from public.notifications where id = (select id from t_fail)), 'ECONNREFUSED', 'the failure reason is kept');
select is((select count(*)::int from public.notifications n join t_fail f on f.id = n.id where n.email_sent_at is null), 1,
  'a failed email is never marked as sent');

select * from finish();
rollback;
