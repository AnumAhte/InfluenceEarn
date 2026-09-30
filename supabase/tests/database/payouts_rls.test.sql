-- Phase 5: payouts, refunds, admin activity log. Run with: npx supabase test db
begin;

create extension if not exists pgtap with schema extensions;

select plan(32);

-- Fixtures ----------------------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('a5000000-0000-0000-0000-00000000000a', 'adv5@t.local',   '{"full_name":"Brand Owner"}', 'authenticated', 'authenticated'),
  ('c5100000-0000-0000-0000-0000000000c1', 'c51@t.local',    '{"full_name":"Creator One"}', 'authenticated', 'authenticated'),
  ('c5200000-0000-0000-0000-0000000000c2', 'c52@t.local',    '{"full_name":"Creator Two"}', 'authenticated', 'authenticated'),
  ('c5300000-0000-0000-0000-0000000000c3', 'c53@t.local',    '{"full_name":"Creator Three"}', 'authenticated', 'authenticated'),
  ('d5000000-0000-0000-0000-00000000000d', 'admin5@t.local', '{"full_name":"Agency Admin"}', 'authenticated', 'authenticated');
insert into public.user_roles (user_id, role) values ('d5000000-0000-0000-0000-00000000000d', 'admin');
update public.platform_settings set test_funds_enabled = true where id;

create temp table ids (k text primary key, v uuid);
grant select, insert on ids to authenticated;

set local role authenticated;

-- Advertiser funds a campaign: 3 creators × $10 = $30 + $6 fee = $36.
select set_config('request.jwt.claims', '{"sub":"a5000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
insert into ids select 'campaign', public.save_campaign_draft(
  p_campaign => jsonb_build_object(
    'title', 'Payout Test', 'description', 'A campaign description that is certainly longer than forty characters.',
    'category_slug', 'fashion', 'campaign_type', 'product_launch',
    'application_deadline', now() + interval '7 days', 'task_deadline', now() + interval '14 days',
    'payment_per_creator_cents', 1000, 'creators_required', 3),
  p_platforms => array['instagram']::public.social_platform[],
  p_tasks => jsonb_build_array(jsonb_build_object('platform', 'instagram', 'task_type', 'follow', 'quantity', 1)),
  p_categories => '{}'::text[], p_locations => '[]'::jsonb);
select * from public.record_test_deposit(3600, 'USD', 'mock_ref_p5', 'succeeded', 'deposit-key-p5');
select public.request_campaign_funding((select v from ids where k = 'campaign'));
select * from public.fund_and_publish_campaign((select v from ids where k = 'campaign'), 'fund-key-p5');

-- Applications + selection (fixtures inserted as table owner).
reset role;
insert into public.campaign_applications (id, campaign_id, creator_id, creator_name, search_text)
select gen_random_uuid(), (select v from ids where k = 'campaign'), u, n, lower(n)
from (values ('c5100000-0000-0000-0000-0000000000c1'::uuid, 'Creator One'),
             ('c5200000-0000-0000-0000-0000000000c2'::uuid, 'Creator Two'),
             ('c5300000-0000-0000-0000-0000000000c3'::uuid, 'Creator Three')) as t(u, n);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a5000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select public.decide_application(id, 'select') from public.campaign_applications where campaign_id = (select v from ids where k = 'campaign');
select public.close_campaign_applications((select v from ids where k = 'campaign'));
select public.start_campaign_work((select v from ids where k = 'campaign'));
insert into ids select 'a1', id from public.campaign_assignments where creator_id = 'c5100000-0000-0000-0000-0000000000c1';
insert into ids select 'a2', id from public.campaign_assignments where creator_id = 'c5200000-0000-0000-0000-0000000000c2';
insert into ids select 'a3', id from public.campaign_assignments where creator_id = 'c5300000-0000-0000-0000-0000000000c3';

-- C1 and C2 approved; C3 missed the deadline (set as table owner to skip the submission step).
reset role;
update public.campaign_assignments set status = 'approved', decided_at = now()
where id in ((select v from ids where k = 'a1'), (select v from ids where k = 'a2'));
update public.campaign_assignments set due_at = now() - interval '1 day' where id = (select v from ids where k = 'a3');
set local role authenticated;

-- Only admins can pay out ----------------------------------------------------------------------
select throws_ok($$ select * from public.start_payout((select v from ids where k = 'a1'), 'mock') $$,
  '42501', 'admin_required', 'the advertiser cannot release payouts');
select set_config('request.jwt.claims', '{"sub":"c5100000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select throws_ok($$ select * from public.start_payout((select v from ids where k = 'a1'), 'mock') $$,
  '42501', 'admin_required', 'a creator cannot release their own payout');
select throws_ok($$ insert into public.payouts (assignment_id, campaign_id, creator_id, amount_cents, status)
  values ((select v from ids where k = 'a1'), (select v from ids where k = 'campaign'), 'c5100000-0000-0000-0000-0000000000c1', 1000, 'paid') $$,
  '42501', null, 'payouts cannot be inserted directly');
select throws_ok($$ insert into public.admin_activity_logs (actor_id, action, target_type) values ('c5100000-0000-0000-0000-0000000000c1', 'payout.paid', 'payout') $$,
  '42501', null, 'the activity log cannot be written directly');

-- Admin releases C1 ------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"d5000000-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select is((select already_processing from public.start_payout((select v from ids where k = 'a1'), 'mock')), false,
  'an admin starts the payout (processing)');
select is((select already_processing from public.start_payout((select v from ids where k = 'a1'), 'mock')), true,
  'starting again while processing is idempotent');
insert into ids select 'p1', id from public.payouts where assignment_id = (select v from ids where k = 'a1');
select is(public.record_payout_result((select v from ids where k = 'p1'), 1::smallint, 'paid', 'mock_po_1')::text, 'paid',
  'the provider result is recorded as paid');
select is(public.record_payout_result((select v from ids where k = 'p1'), 1::smallint, 'paid', 'mock_po_1')::text, 'paid',
  'recording paid again is a no-op');
select is((select count(*)::int from public.ledger_transactions where kind = 'creator_payout'), 1,
  'a payout is booked in the ledger exactly once');
select is((select status::text from public.campaign_assignments where id = (select v from ids where k = 'a1')), 'paid',
  'the assignment is marked paid');
select lives_ok($$ set constraints public.wallet_ledger_entries_balanced immediate $$,
  'the payout journal balances (checked as at commit)');
set constraints public.wallet_ledger_entries_balanced deferred;

-- Hold, fail, retry for C2 ------------------------------------------------------------------------
select throws_ok($$ select public.hold_payout((select v from ids where k = 'a2'), '') $$,
  '22023', 'reason_required', 'holding a payout needs a reason');
select is(public.hold_payout((select v from ids where k = 'a2'), 'Checking the post is still live')::text, 'on_hold',
  'an admin can put approved work on hold');
select is((select attempt from public.start_payout((select v from ids where k = 'a2'), 'mock')), 1::smallint,
  'releasing from hold starts attempt 1');
insert into ids select 'p2', id from public.payouts where assignment_id = (select v from ids where k = 'a2');
select is(public.record_payout_result((select v from ids where k = 'p2'), 1::smallint, 'failed', null, 'Declined by the mock provider')::text,
  'failed', 'a failed attempt is recorded');
select is((select count(*)::int from public.ledger_transactions where kind = 'creator_payout'), 1, 'a failed payout moves no money');
select throws_ok($$ select public.record_payout_result((select v from ids where k = 'p2'), 1::smallint, 'paid') $$,
  'P0001', 'stale_payout_attempt', 'a result for an old attempt is rejected');
select is((select attempt from public.start_payout((select v from ids where k = 'a2'), 'mock')), 2::smallint, 'retrying starts attempt 2');

reset role;
update public.platform_settings set test_funds_enabled = false where id;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"d5000000-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select throws_ok($$ select public.record_payout_result((select v from ids where k = 'p2'), 2::smallint, 'paid') $$,
  '42501', 'test_mode_disabled', 'mock payouts cannot complete when test mode is off (production)');
reset role;
update public.platform_settings set test_funds_enabled = true where id;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"d5000000-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select is(public.record_payout_result((select v from ids where k = 'p2'), 2::smallint, 'paid', 'mock_po_2')::text, 'paid', 'the retry succeeds');
select ok((select count(*) from public.admin_activity_logs) >= 7, 'every admin payout action is logged');

-- Creator view ---------------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"c5100000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select is((select count(*)::int from public.payouts), 1, 'a creator sees only their own payout');
select is((select count(*)::int from public.notifications where type = 'payout_released'), 1, 'the creator is notified the payment was released');
select is((select sum(amount_cents)::bigint from public.wallet_statement where entry_type = 'creator_earning'), 1000::bigint,
  'the creator''s statement shows the $10 earning');
select is((select count(*)::int from public.admin_activity_logs), 0, 'non-admins cannot read the activity log');

-- Completion + refund ------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"a5000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select is((select count(*)::int from public.payouts), 2, 'the advertiser sees payouts for their campaign');
select is(public.complete_campaign((select v from ids where k = 'campaign'))::text, 'completed', 'the advertiser completes the campaign');
select is((select status::text from public.campaign_assignments where id = (select v from ids where k = 'a3')), 'expired',
  'unfinished past-deadline work expires');
select is((select balance_cents from public.wallet_account_balances where kind = 'user_wallet' and owner_id = 'a5000000-0000-0000-0000-00000000000a'),
  1000::bigint, 'the unused creator budget ($10) is refunded; the platform fee is kept');

reset role;
select is(public._refund_unused_budget((select v from ids where k = 'campaign')), 0::bigint, 'the refund happens only once');
select is((select balance_cents from public.wallet_account_balances where kind = 'campaign_reserve' and campaign_id = (select v from ids where k = 'campaign')),
  0::bigint, 'the campaign reserve is fully settled');
select lives_ok($$ set constraints public.wallet_ledger_entries_balanced immediate $$,
  'every journal balances after payouts and refund');

select * from finish();
rollback;
