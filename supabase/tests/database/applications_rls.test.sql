-- Phase 3: social accounts, eligibility, applications, selection, notifications.
-- Run with: npx supabase test db
begin;

create extension if not exists pgtap with schema extensions;

select plan(39);

-- Fixtures (as table owner) ---------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('a0000000-0000-0000-0000-00000000000a', 'adv@t.local',   '{"full_name":"Brand Owner"}', 'authenticated', 'authenticated'),
  ('b0000000-0000-0000-0000-00000000000b', 'adv2@t.local',  '{"full_name":"Other Brand"}', 'authenticated', 'authenticated'),
  ('c1000000-0000-0000-0000-0000000000c1', 'c1@t.local',    '{"full_name":"Creator One"}', 'authenticated', 'authenticated'),
  ('c2000000-0000-0000-0000-0000000000c2', 'c2@t.local',    '{"full_name":"Creator Two"}', 'authenticated', 'authenticated'),
  ('c3000000-0000-0000-0000-0000000000c3', 'c3@t.local',    '{"full_name":"Creator Three"}', 'authenticated', 'authenticated'),
  ('c4000000-0000-0000-0000-0000000000c4', 'c4@t.local',    '{"full_name":"Creator Four"}', 'authenticated', 'authenticated'),
  ('d0000000-0000-0000-0000-00000000000d', 'admin@t.local', '{"full_name":"Admin"}',       'authenticated', 'authenticated');
insert into public.user_roles (user_id, role) values ('d0000000-0000-0000-0000-00000000000d', 'admin');
update public.profiles set city = 'London'
where id in ('c1000000-0000-0000-0000-0000000000c1', 'c2000000-0000-0000-0000-0000000000c2',
             'c3000000-0000-0000-0000-0000000000c3', 'c4000000-0000-0000-0000-0000000000c4');

-- A live campaign owned by A: Instagram, 10k+ followers, female, 18–30, fashion, London (GB), 1 creator.
insert into public.campaigns (id, owner_id, title, description, category_slug, campaign_type,
  application_deadline, task_deadline, payment_per_creator_cents, creators_required)
values ('e0000000-0000-0000-0000-00000000000e', 'a0000000-0000-0000-0000-00000000000a', 'Summer Reels',
  'A campaign description that is certainly longer than forty characters.', 'fashion', 'product_launch',
  now() + interval '7 days', now() + interval '14 days', 1000, 1);
insert into public.campaign_platforms values ('e0000000-0000-0000-0000-00000000000e', 'instagram');
insert into public.campaign_tasks (campaign_id, platform, task_type) values ('e0000000-0000-0000-0000-00000000000e', 'instagram', 'instagram_reel');
insert into public.campaign_requirements (campaign_id, min_followers, genders, age_min, age_max)
values ('e0000000-0000-0000-0000-00000000000e', 10000, '{female}', 18, 30);
insert into public.campaign_creator_categories values ('e0000000-0000-0000-0000-00000000000e', 'fashion');
insert into public.campaign_locations (campaign_id, country_code, city) values ('e0000000-0000-0000-0000-00000000000e', 'GB', 'London');
update public.campaigns set status = 'funding_required' where id = 'e0000000-0000-0000-0000-00000000000e';
update public.campaigns set status = 'published' where id = 'e0000000-0000-0000-0000-00000000000e';
update public.campaigns set status = 'applications_open' where id = 'e0000000-0000-0000-0000-00000000000e';

set local role authenticated;

-- Creator details + social accounts (each creator acting as themselves) -------------
select set_config('request.jwt.claims', '{"sub":"c1000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select lives_ok($$ select public.save_creator_profile('gb', (current_date - interval '25 years')::date, 'female', array['fashion']) $$,
  'a creator can save their eligibility details');
select lives_ok($$ insert into public.social_accounts (platform, handle, follower_count) values ('instagram', 'creator.one', 20000) $$,
  'a creator can link a social account manually');
select throws_ok($$ update public.social_accounts set verification_status = 'verified' $$,
  '42501', null, 'a creator cannot mark their own account as verified');
select throws_ok($$ select public.save_creator_profile('GB', (current_date - interval '10 years')::date, 'female', '{}') $$,
  '23514', 'creator_too_young', 'creators must be at least 13');
select is((select count(*)::int from public.my_campaign_eligibility('e0000000-0000-0000-0000-00000000000e')), 0,
  'an eligible creator has no eligibility issues');

select set_config('request.jwt.claims', '{"sub":"c2000000-0000-0000-0000-0000000000c2","role":"authenticated"}', true);
select public.save_creator_profile('GB', (current_date - interval '25 years')::date, 'female', array['fashion']);
select is((select count(*)::int from public.social_accounts), 0, 'creators cannot see other creators'' social accounts');
select ok(
  exists (select 1 from public.my_campaign_eligibility('e0000000-0000-0000-0000-00000000000e') where code = 'missing_platform' and platform = 'instagram'),
  'a creator without Instagram is told an Instagram account is required');
select is(
  (select issues from public.discover_campaigns() where id = 'e0000000-0000-0000-0000-00000000000e'),
  array['missing_platform:instagram'],
  'discovery shows the same eligibility issues');
select is((select count(*)::int from public.discover_campaigns(p_eligible_only => true)), 0,
  '"eligible only" hides campaigns the creator cannot apply to');
select throws_ok($$ select public.apply_to_campaign('e0000000-0000-0000-0000-00000000000e') $$,
  'P0001', 'not_eligible', 'an ineligible creator cannot apply');

select set_config('request.jwt.claims', '{"sub":"c3000000-0000-0000-0000-0000000000c3","role":"authenticated"}', true);
select public.save_creator_profile('GB', (current_date - interval '25 years')::date, 'male', array['fashion']);
insert into public.social_accounts (platform, handle, follower_count) values ('instagram', 'creator.three', 500);
select is(
  (select array_agg(code order by code) from public.my_campaign_eligibility('e0000000-0000-0000-0000-00000000000e')),
  array['followers_below_minimum', 'gender_mismatch'],
  'follower minimum and gender are checked');

select set_config('request.jwt.claims', '{"sub":"c4000000-0000-0000-0000-0000000000c4","role":"authenticated"}', true);
select public.save_creator_profile('GB', (current_date - interval '22 years')::date, 'female', array['fashion', 'beauty']);
insert into public.social_accounts (platform, handle, follower_count) values ('instagram', 'creator.four', 15000);

-- Advertisers never see private creator details --------------------------------------
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select is((select count(*)::int from public.creator_profiles), 0, 'advertisers cannot read creator profiles (date of birth stays private)');
select throws_ok($$ select public.apply_to_campaign('e0000000-0000-0000-0000-00000000000e') $$,
  'P0001', 'own_campaign', 'an advertiser cannot apply to their own campaign');

-- Applying ------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"c1000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select lives_ok($$ select public.apply_to_campaign('e0000000-0000-0000-0000-00000000000e', 'I love this brand.') $$,
  'an eligible creator can apply');
select throws_ok($$ select public.apply_to_campaign('e0000000-0000-0000-0000-00000000000e') $$,
  'P0001', 'already_applied', 'a creator cannot apply twice');
select throws_ok($$ insert into public.campaign_applications (campaign_id, creator_id, creator_name, search_text)
  values ('e0000000-0000-0000-0000-00000000000e', 'c1000000-0000-0000-0000-0000000000c1', 'x', 'x') $$,
  '42501', null, 'applications cannot be inserted directly');
select throws_ok($$ update public.campaign_applications set status = 'selected' $$,
  '42501', null, 'a creator cannot change an application status directly');
select throws_ok($$ select public.decide_application((select id from public.campaign_applications limit 1), 'select') $$,
  'P0002', null, 'a creator cannot approve (select) their own application');

select set_config('request.jwt.claims', '{"sub":"c4000000-0000-0000-0000-0000000000c4","role":"authenticated"}', true);
select public.apply_to_campaign('e0000000-0000-0000-0000-00000000000e');
select is((select count(*)::int from public.campaign_applications), 1, 'a creator sees only their own application');
select is((select count(*)::int from public.application_social_accounts where handle = 'creator.one'), 0,
  'a creator cannot see another creator''s application details');

-- Another advertiser --------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select is((select count(*)::int from public.campaign_applications), 0, 'other advertisers cannot see applications to someone else''s campaign');
select throws_ok($$ select public.decide_application(
    (select a.id from public.campaign_applications a limit 1), 'reject') $$,
  'P0002', null, 'other advertisers cannot decide on applications (no row visible)');

-- Owner reviews manually -----------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
create temp table t_apps as
  select id, creator_id from public.campaign_applications where campaign_id = 'e0000000-0000-0000-0000-00000000000e';
grant select on t_apps to authenticated;

select is((select count(*)::int from t_apps), 2, 'the campaign owner sees every application to their campaign');
select is((select count(*)::int from public.notifications where type = 'application_received'), 2,
  'the advertiser is notified of each new application');
select ok(
  (select profile_url from public.application_social_accounts where handle = 'creator.one') = 'https://www.instagram.com/creator.one/',
  'the advertiser sees the snapshot profile link on the platform''s own domain');
select is(public.decide_application((select id from t_apps where creator_id = 'c1000000-0000-0000-0000-0000000000c1'), 'shortlist')::text,
  'shortlisted', 'the owner can shortlist');
select is(public.decide_application((select id from t_apps where creator_id = 'c1000000-0000-0000-0000-0000000000c1'), 'select')::text,
  'selected', 'the owner can select');
select throws_ok($$ select public.decide_application((select id from t_apps where creator_id = 'c4000000-0000-0000-0000-0000000000c4'), 'select') $$,
  'P0001', 'selection_full', 'selection is capped at the number of creators needed');
select throws_ok($$ select public.decide_application((select id from t_apps where creator_id = 'c1000000-0000-0000-0000-0000000000c1'), 'reject') $$,
  'P0001', null, 'selection is final in this phase (selected → rejected is invalid)');
select is(public.decide_application((select id from t_apps where creator_id = 'c4000000-0000-0000-0000-0000000000c4'), 'reject')::text,
  'rejected', 'the owner can reject');
select is(public.decide_application((select id from t_apps where creator_id = 'c4000000-0000-0000-0000-0000000000c4'), 'reconsider')::text,
  'pending', 'a rejection can be reconsidered');
select is(public.close_campaign_applications('e0000000-0000-0000-0000-00000000000e')::text, 'selection_in_progress',
  'the owner can close applications');

-- After closing -------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"c1000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select is((select count(*)::int from public.notifications where type = 'application_selected'), 1,
  'the selected creator is notified');
select is(public.mark_notifications_read(), 1, 'a user can mark their notifications read');
select is((select count(*)::int from public.campaigns where id = 'e0000000-0000-0000-0000-00000000000e'), 1,
  'an applicant still sees the campaign after applications close');

select set_config('request.jwt.claims', '{"sub":"c2000000-0000-0000-0000-0000000000c2","role":"authenticated"}', true);
insert into public.social_accounts (platform, handle, follower_count) values ('instagram', 'creator.two', 30000);
select throws_ok($$ select public.apply_to_campaign('e0000000-0000-0000-0000-00000000000e') $$,
  'P0002', null, 'nobody can apply once applications are closed');
select is((select count(*)::int from public.notifications), 0, 'users only see their own notifications');
select is((select count(*)::int from public.campaigns where id = 'e0000000-0000-0000-0000-00000000000e'), 0,
  'non-applicants cannot see a campaign once applications are closed');

-- Admin ---------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"d0000000-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select is((select count(*)::int from public.campaign_applications where campaign_id = 'e0000000-0000-0000-0000-00000000000e'), 2,
  'admins can inspect applications');

select * from finish();
rollback;
