-- Phase 4: assignments, submissions, reviews, campaign lifecycle. Run with: npx supabase test db
begin;

create extension if not exists pgtap with schema extensions;

select plan(37);

-- Fixtures (as table owner) ----------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('a4000000-0000-0000-0000-00000000000a', 'adv4@t.local',   '{"full_name":"Brand Owner"}',   'authenticated', 'authenticated'),
  ('b4000000-0000-0000-0000-00000000000b', 'adv4b@t.local',  '{"full_name":"Other Brand"}',   'authenticated', 'authenticated'),
  ('c4100000-0000-0000-0000-0000000000c1', 'c41@t.local',    '{"full_name":"Creator One"}',   'authenticated', 'authenticated'),
  ('c4200000-0000-0000-0000-0000000000c2', 'c42@t.local',    '{"full_name":"Creator Two"}',   'authenticated', 'authenticated'),
  ('d4000000-0000-0000-0000-00000000000d', 'admin4@t.local', '{"full_name":"Agency Admin"}',  'authenticated', 'authenticated');
insert into public.user_roles (user_id, role) values ('d4000000-0000-0000-0000-00000000000d', 'admin');

insert into public.campaigns (id, owner_id, title, description, category_slug, campaign_type,
  application_deadline, task_deadline, payment_per_creator_cents, creators_required)
values ('e4000000-0000-0000-0000-00000000000e', 'a4000000-0000-0000-0000-00000000000a', 'Reel + Comment + Follow',
  'A campaign description that is certainly longer than forty characters.', 'fashion', 'product_launch',
  now() + interval '7 days', now() + interval '14 days', 2500, 2);
insert into public.campaign_platforms values ('e4000000-0000-0000-0000-00000000000e', 'instagram');
insert into public.campaign_tasks (id, campaign_id, platform, task_type, position) values
  ('f4000000-0000-0000-0000-000000000001', 'e4000000-0000-0000-0000-00000000000e', 'instagram', 'instagram_reel', 0),
  ('f4000000-0000-0000-0000-000000000002', 'e4000000-0000-0000-0000-00000000000e', 'instagram', 'comment', 1),
  ('f4000000-0000-0000-0000-000000000003', 'e4000000-0000-0000-0000-00000000000e', 'instagram', 'follow', 2);
update public.campaigns set status = 'funding_required' where id = 'e4000000-0000-0000-0000-00000000000e';
update public.campaigns set status = 'published' where id = 'e4000000-0000-0000-0000-00000000000e';
update public.campaigns set status = 'applications_open' where id = 'e4000000-0000-0000-0000-00000000000e';

insert into public.campaign_applications (id, campaign_id, creator_id, creator_name, search_text) values
  ('a4a00000-0000-0000-0000-000000000001', 'e4000000-0000-0000-0000-00000000000e', 'c4100000-0000-0000-0000-0000000000c1', 'Creator One', 'creator one'),
  ('a4a00000-0000-0000-0000-000000000002', 'e4000000-0000-0000-0000-00000000000e', 'c4200000-0000-0000-0000-0000000000c2', 'Creator Two', 'creator two');

create temp table ids (k text primary key, v uuid);
grant select, insert, update on ids to authenticated;

set local role authenticated;

-- Selection creates assignments ---------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"a4000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select public.decide_application('a4a00000-0000-0000-0000-000000000001', 'select');
select public.decide_application('a4a00000-0000-0000-0000-000000000002', 'select');
insert into ids select 'c1', id from public.campaign_assignments where creator_id = 'c4100000-0000-0000-0000-0000000000c1';
insert into ids select 'c2', id from public.campaign_assignments where creator_id = 'c4200000-0000-0000-0000-0000000000c2';

select is((select count(*)::int from public.campaign_assignments where campaign_id = 'e4000000-0000-0000-0000-00000000000e'), 2,
  'selecting a creator creates their assignment');
select is((select reward_cents from public.campaign_assignments where id = (select v from ids where k = 'c1')), 2500::bigint,
  'the assignment snapshots the reward');
select is(public.close_campaign_applications('e4000000-0000-0000-0000-00000000000e')::text, 'selection_in_progress', 'applications closed');
select is(public.start_campaign_work('e4000000-0000-0000-0000-00000000000e')::text, 'in_progress', 'the owner starts the work');

-- Creator Two's deadline has already passed (as table owner).
reset role;
update public.campaign_assignments set due_at = now() - interval '1 day' where id = (select v from ids where k = 'c2');
set local role authenticated;

-- Visibility ----------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"c4200000-0000-0000-0000-0000000000c2","role":"authenticated"}', true);
select is((select count(*)::int from public.campaign_assignments), 1, 'a creator sees only their own assignment');
select throws_ok($$ select public.submit_task_completion((select v from ids where k = 'c1'), '[]'::jsonb) $$,
  'P0002', null, 'a creator cannot submit on someone else''s assignment');
select throws_ok($$ select public.submit_task_completion((select v from ids where k = 'c2'),
  jsonb_build_array(
    jsonb_build_object('task_id', 'f4000000-0000-0000-0000-000000000001', 'url', 'https://www.instagram.com/reel/abc123/'),
    jsonb_build_object('task_id', 'f4000000-0000-0000-0000-000000000002', 'url', 'https://www.instagram.com/p/xyz/', 'comment_text', 'Love it'),
    jsonb_build_object('task_id', 'f4000000-0000-0000-0000-000000000003'))) $$,
  'P0001', 'deadline_passed', 'nobody can submit after the task deadline');

select set_config('request.jwt.claims', '{"sub":"b4000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select is((select count(*)::int from public.campaign_assignments), 0, 'other advertisers cannot see assignments');

-- Proof validation ----------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"c4100000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select throws_ok($$ insert into public.task_submissions (assignment_id, attempt) values ((select v from ids where k = 'c1'), 1) $$,
  '42501', null, 'submissions cannot be inserted directly');
select throws_ok($$ update public.campaign_assignments set status = 'approved' $$,
  '42501', null, 'a creator cannot approve their own work');
select throws_ok($$ select public.submit_task_completion((select v from ids where k = 'c1'), jsonb_build_array(
    jsonb_build_object('task_id', 'f4000000-0000-0000-0000-000000000001'),
    jsonb_build_object('task_id', 'f4000000-0000-0000-0000-000000000002', 'url', 'https://www.instagram.com/p/xyz/', 'comment_text', 'Love it'),
    jsonb_build_object('task_id', 'f4000000-0000-0000-0000-000000000003'))) $$,
  '22023', null, 'a reel without its URL is rejected');
select throws_ok($$ select public.submit_task_completion((select v from ids where k = 'c1'), jsonb_build_array(
    jsonb_build_object('task_id', 'f4000000-0000-0000-0000-000000000001', 'url', 'https://evil.example/reel/abc'),
    jsonb_build_object('task_id', 'f4000000-0000-0000-0000-000000000002', 'url', 'https://www.instagram.com/p/xyz/', 'comment_text', 'Love it'),
    jsonb_build_object('task_id', 'f4000000-0000-0000-0000-000000000003'))) $$,
  '22023', null, 'links must be on the task platform''s own domain');
select throws_ok($$ select public.submit_task_completion((select v from ids where k = 'c1'), jsonb_build_array(
    jsonb_build_object('task_id', 'f4000000-0000-0000-0000-000000000001', 'url', 'https://www.instagram.com/reel/abc123/'),
    jsonb_build_object('task_id', 'f4000000-0000-0000-0000-000000000002', 'url', 'https://www.instagram.com/p/xyz/'),
    jsonb_build_object('task_id', 'f4000000-0000-0000-0000-000000000003'))) $$,
  '22023', null, 'a comment task needs the comment text');
select throws_ok($$ select public.submit_task_completion((select v from ids where k = 'c1'), jsonb_build_array(
    jsonb_build_object('task_id', 'f4000000-0000-0000-0000-000000000001', 'url', 'https://www.instagram.com/reel/abc123/'))) $$,
  '22023', null, 'every task needs an entry');

-- First submission --------------------------------------------------------------------------
select lives_ok($$ select public.submit_task_completion((select v from ids where k = 'c1'), jsonb_build_array(
    jsonb_build_object('task_id', 'f4000000-0000-0000-0000-000000000001', 'url', 'https://www.instagram.com/reel/abc123/'),
    jsonb_build_object('task_id', 'f4000000-0000-0000-0000-000000000002', 'url', 'https://instagram.com/p/xyz/', 'comment_text', 'Love this drop!'),
    jsonb_build_object('task_id', 'f4000000-0000-0000-0000-000000000003', 'url', 'https://www.instagram.com/ignored/')),
    'First try') $$,
  'a valid submission is accepted (follow needs no link; screenshots never required)');
select is((select status::text from public.campaign_assignments where id = (select v from ids where k = 'c1')), 'submitted',
  'the assignment waits for review');
select is((select proof_url from public.task_submission_items where campaign_task_id = 'f4000000-0000-0000-0000-000000000003'), null,
  'no link is stored for a follow task');
select throws_ok($$ select public.submit_task_completion((select v from ids where k = 'c1'), '[]'::jsonb) $$,
  'P0001', null, 'a creator cannot resubmit while a review is pending');
insert into ids select 's1', id from public.task_submissions where attempt = 1;
select throws_ok($$ select public.review_task_submission((select v from ids where k = 's1'), 'approved') $$,
  'P0002', null, 'a creator cannot approve their own submission');

select set_config('request.jwt.claims', '{"sub":"b4000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select is((select count(*)::int from public.task_submission_items), 0, 'other advertisers cannot see submitted proof');
select throws_ok($$ select public.review_task_submission((select v from ids where k = 's1'), 'approved') $$,
  'P0002', null, 'other advertisers cannot review');

-- Review ------------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"a4000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select is((select status::text from public.campaigns where id = 'e4000000-0000-0000-0000-00000000000e'), 'review_pending',
  'the campaign moves to review_pending when work is submitted');
select is((select count(*)::int from public.notifications where type = 'task_submitted'), 1, 'the advertiser is notified of the submission');
select throws_ok($$ select public.complete_campaign('e4000000-0000-0000-0000-00000000000e') $$,
  'P0001', 'work_outstanding', 'a campaign cannot complete while work awaits review');
select throws_ok($$ select public.review_task_submission((select v from ids where k = 's1'), 'rejected') $$,
  '22023', 'reason_required', 'a rejection needs a reason');
select is(public.review_task_submission((select v from ids where k = 's1'), 'rejected', 'Please tag the brand account.', true)::text,
  'revision_requested', 'rejecting with resubmission allowed requests changes');
select is((select status::text from public.campaigns where id = 'e4000000-0000-0000-0000-00000000000e'), 'in_progress',
  'the campaign returns to in_progress when nothing awaits review');

-- Resubmission ------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"c4100000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select is((select count(*)::int from public.notifications where type = 'task_rejected'), 1, 'the creator is told what to change');
select is((select reason from public.task_reviews), 'Please tag the brand account.', 'the creator can read the rejection reason');
select lives_ok($$ select public.submit_task_completion((select v from ids where k = 'c1'), jsonb_build_array(
    jsonb_build_object('task_id', 'f4000000-0000-0000-0000-000000000001', 'url', 'https://www.instagram.com/reel/abc124/'),
    jsonb_build_object('task_id', 'f4000000-0000-0000-0000-000000000002', 'url', 'https://www.instagram.com/p/xyz/', 'comment_text', 'Love this drop @brand!'),
    jsonb_build_object('task_id', 'f4000000-0000-0000-0000-000000000003'))) $$,
  'the creator can resubmit after changes are requested');
insert into ids select 's2', id from public.task_submissions where attempt = 2;

-- Approval ----------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"a4000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select throws_ok($$ select public.review_task_submission((select v from ids where k = 's1'), 'approved') $$,
  'P0001', null, 'an old submission cannot be reviewed again');
select is(public.review_task_submission((select v from ids where k = 's2'), 'approved')::text, 'approved',
  'the owner approves the resubmission (ready for payout)');
select throws_ok($$ select public.review_task_submission((select v from ids where k = 's2'), 'rejected', 'Changed my mind', false) $$,
  'P0001', null, 'an approval is final');
select is(public.complete_campaign('e4000000-0000-0000-0000-00000000000e')::text, 'completed',
  'the campaign completes once nothing is outstanding');
select is((select status::text from public.campaign_assignments where id = (select v from ids where k = 'c2')), 'expired',
  'an unfinished assignment past its deadline is marked expired');

-- Admin -------------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"d4000000-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select is((select count(*)::int from public.notifications where type = 'payout_ready'), 1, 'admins are notified when work is ready for payout');
select is((select count(*)::int from public.campaign_assignments where status = 'approved' and campaign_id = 'e4000000-0000-0000-0000-00000000000e'), 1,
  'admins can see approved work in the payout queue');

select * from finish();
rollback;
