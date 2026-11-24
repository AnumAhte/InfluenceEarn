-- Phase 6: campaigns can't be funded or published without a verified funding source.
-- Run with: npx supabase test db
begin;

create extension if not exists pgtap with schema extensions;

select plan(9);

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('aaaaaaaa-0000-0000-0000-0000000000f1', 'gate-adv@test.local', '{"full_name":"Gate Advertiser"}', 'authenticated', 'authenticated');

-- Fund the wallet while test mode is on (local development), then switch it off (production).
update public.platform_settings set test_funds_enabled = true where id;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-0000000000f1","role":"authenticated"}', true);

select public.save_campaign_draft(
  p_campaign => jsonb_build_object(
    'title', 'Gate Campaign',
    'description', 'Promote our summer drop with one Instagram Reel showing two outfits from the collection.',
    'category_slug', 'fashion', 'campaign_type', 'product_launch',
    'application_deadline', (now() + interval '10 days'), 'task_deadline', (now() + interval '20 days'),
    'payment_per_creator_cents', 1000, 'creators_required', 2),
  p_platforms => array['instagram']::public.social_platform[],
  p_tasks => jsonb_build_array(jsonb_build_object('platform', 'instagram', 'task_type', 'instagram_reel', 'quantity', 1)),
  p_categories => array['fashion'], p_locations => '[]'::jsonb, p_requirements => '{}'::jsonb);
create temp table t_gate as select id as campaign_id from public.campaigns where title = 'Gate Campaign';
grant select on t_gate to authenticated;
select public.request_campaign_funding((select campaign_id from t_gate));
select * from public.record_test_deposit(5000, 'USD', 'mock_gate_1', 'succeeded', 'gate-deposit-1');

select is(public.campaign_funding_available(), true, 'funding is available in local test mode');

reset role;
update public.platform_settings set test_funds_enabled = false where id;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-0000000000f1","role":"authenticated"}', true);

select is(public.campaign_funding_available(), false, 'funding is unavailable without a verified provider (production)');
select throws_ok($$ select * from public.fund_and_publish_campaign((select campaign_id from t_gate), 'gate-fund-1') $$,
  'P0001', 'funding_unavailable', 'a direct RPC call cannot fund a campaign without a verified provider');
select is((select status::text from public.campaigns where id = (select campaign_id from t_gate)), 'funding_required',
  'the refused campaign is not published');
select is((select balance_cents from public.wallet_account_balances where kind = 'user_wallet'), 5000::bigint,
  'the refused attempt debits nothing');

reset role;
select is((select count(*)::int from public.campaign_funding where campaign_id = (select campaign_id from t_gate)), 0,
  'no funding record is written');
select is((select count(*)::int from public.ledger_transactions where kind = 'campaign_funding'
           and initiated_by = 'aaaaaaaa-0000-0000-0000-0000000000f1'), 0,
  'no funding journal is written');
select throws_ok($$ insert into public.campaign_funding (campaign_id) values ((select campaign_id from t_gate)) $$,
  'P0001', 'funding_unavailable', 'even the database owner cannot insert a funding record without a provider');
select ok(not has_function_privilege('anon', 'public.campaign_funding_available()', 'execute'),
  'anonymous users cannot call the gate function');

select * from finish();
rollback;
