-- Phase 2: campaigns, wallet ledger and funding. Run with: npx supabase test db
begin;

create extension if not exists pgtap with schema extensions;

select plan(44);

-- Fixtures ------------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'adv@test.local',   '{"full_name":"Advertiser A"}', 'authenticated', 'authenticated'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'other@test.local', '{"full_name":"Advertiser B"}', 'authenticated', 'authenticated'),
  ('cccccccc-0000-0000-0000-000000000003', 'creator@test.local','{"full_name":"Creator C"}',   'authenticated', 'authenticated'),
  ('dddddddd-0000-0000-0000-000000000004', 'admin@test.local', '{"full_name":"Admin D"}',      'authenticated', 'authenticated');
insert into public.user_roles (user_id, role) values ('dddddddd-0000-0000-0000-000000000004', 'admin');

-- Tests run with test funds enabled (as in local dev).
update public.platform_settings set test_funds_enabled = true where id;

-- A complete draft owned by A: 100 creators × $10 → $1,000 + $200 fee = $1,200.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);

select lives_ok($$
  select public.save_campaign_draft(
    p_campaign => jsonb_build_object(
      'title', 'Summer Collection Promotion',
      'description', 'Promote our summer drop with one Instagram Reel showing two outfits from the collection.',
      'category_slug', 'fashion',
      'campaign_type', 'product_launch',
      'application_deadline', (now() + interval '10 days'),
      'task_deadline', (now() + interval '20 days'),
      'payment_per_creator_cents', 1000,
      'creators_required', 100,
      'hashtags', jsonb_build_array('#SummerDrop')
    ),
    p_platforms => array['instagram']::public.social_platform[],
    p_tasks => jsonb_build_array(jsonb_build_object('platform', 'instagram', 'task_type', 'instagram_reel', 'quantity', 1)),
    p_categories => array['fashion'],
    p_locations => jsonb_build_array(jsonb_build_object('country_code', 'gb', 'city', 'London')),
    p_requirements => jsonb_build_object('min_followers', 10000, 'genders', jsonb_build_array('female'), 'age_min', 18, 'age_max', 30)
  )
$$, 'advertiser can create their own campaign draft');

create temp table t_ids as
  select id as campaign_id from public.campaigns where title = 'Summer Collection Promotion';
grant select on t_ids to authenticated;

select is((select status::text from public.campaigns c join t_ids t on t.campaign_id = c.id), 'draft',
  'a new campaign starts as draft');
select is((select owner_id from public.campaigns c join t_ids t on t.campaign_id = c.id),
  'aaaaaaaa-0000-0000-0000-000000000001'::uuid, 'owner is the signed-in user');
select is((select country_code::text from public.campaign_locations l join t_ids t on t.campaign_id = l.campaign_id),
  'GB', 'location country codes are normalised');

select throws_ok($$
  update public.campaigns set status = 'applications_open' where id = (select campaign_id from t_ids)
$$, '42501', null, 'owner cannot set status directly');

select throws_ok($$
  insert into public.campaign_tasks (campaign_id, platform, task_type)
  select campaign_id, 'tiktok', 'tiktok_video' from t_ids
$$, '23503', null, 'a task platform must be one of the campaign platforms');

-- Another advertiser ------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}', true);
select is((select count(*)::int from public.campaigns where id in (select campaign_id from t_ids)), 0, 'draft campaigns are private to their owner');
update public.campaigns set title = 'Hijacked' where id = (select campaign_id from t_ids);
select throws_ok($$
  select public.save_campaign_draft(
    p_campaign => jsonb_build_object('title', 'Hijacked'),
    p_platforms => '{}'::public.social_platform[], p_tasks => '[]'::jsonb,
    p_categories => '{}'::text[], p_locations => '[]'::jsonb,
    p_campaign_id => (select campaign_id from t_ids))
$$, '42501', null, 'another advertiser cannot save over someone else''s campaign');
select throws_ok($$ select public.request_campaign_funding((select campaign_id from t_ids)) $$,
  'P0002', null, 'another advertiser cannot move the campaign to funding');
select throws_ok($$ select public.cancel_campaign((select campaign_id from t_ids)) $$,
  'P0002', null, 'another advertiser cannot cancel the campaign');

-- Creator ----------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-000000000003","role":"authenticated"}', true);
select is((select count(*)::int from public.campaigns where id in (select campaign_id from t_ids)), 0, 'creators cannot see drafts');
select is((select count(*)::int from public.campaign_tasks where campaign_id in (select campaign_id from t_ids)), 0, 'creators cannot see draft tasks');
update public.campaigns set title = 'Creator edit' where id = (select campaign_id from t_ids);

-- Admin ------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-000000000004","role":"authenticated"}', true);
select is((select count(*)::int from public.campaigns where id in (select campaign_id from t_ids)), 1, 'admin can inspect campaigns, including drafts');
update public.campaigns set title = 'Admin edit' where id = (select campaign_id from t_ids);

-- Wallet: clients cannot write financial rows -------------------------------------
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-000000000003","role":"authenticated"}', true);
select throws_ok($$
  insert into public.wallet_accounts (kind, owner_id) values ('user_wallet', 'cccccccc-0000-0000-0000-000000000003')
$$, '42501', null, 'users cannot create wallet accounts directly');
select throws_ok($$
  insert into public.ledger_transactions (kind, initiated_by, idempotency_key, campaign_id, description)
  values ('campaign_funding', 'cccccccc-0000-0000-0000-000000000003', 'forged-key-1', (select campaign_id from t_ids), 'forged')
$$, '42501', null, 'users cannot create ledger transactions');
select throws_ok($$
  insert into public.wallet_ledger_entries (transaction_id, account_id, entry_type, amount_cents)
  values (gen_random_uuid(), gen_random_uuid(), 'mock_deposit', 100000)
$$, '42501', null, 'users cannot insert an arbitrary ledger credit');

-- Test deposit for the advertiser -----------------------------------------------
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);
select throws_ok($$ select * from public.record_test_deposit(50000, 'EUR', 'mock_ref_eur', 'succeeded', 'key-eur-00001') $$,
  '22023', null, 'non-USD deposits are rejected');
select throws_ok($$ select * from public.record_test_deposit(0, 'USD', 'mock_ref_zero', 'succeeded', 'key-zero-0001') $$,
  '22023', null, 'zero deposits are rejected');
select throws_ok($$ select * from public.record_test_deposit(-100, 'USD', 'mock_ref_neg', 'succeeded', 'key-neg-00001') $$,
  '22023', null, 'negative deposits are rejected');

select is((select replayed from public.record_test_deposit(50000, 'USD', 'mock_ref_a1', 'succeeded', 'deposit-key-a1')),
  false, 'a $500 test deposit is recorded');
select is((select replayed from public.record_test_deposit(50000, 'USD', 'mock_ref_a1', 'succeeded', 'deposit-key-a1')),
  true, 'replaying the same deposit key does not credit twice');
select is((select balance_cents from public.wallet_account_balances where kind = 'user_wallet'), 50000::bigint,
  'wallet balance is derived from ledger entries');
-- Deferred "balanced journal" trigger normally fires at COMMIT, which never happens in
-- a rolled-back test; force it now, as the user who initiated the writes.
select lives_ok($$ set constraints public.wallet_ledger_entries_balanced immediate $$,
  'a user-initiated deposit passes the balanced-journal check at commit time');
set constraints public.wallet_ledger_entries_balanced deferred;

select throws_ok($$ update public.wallet_ledger_entries set amount_cents = 99999999 $$,
  '42501', null, 'users cannot alter ledger entries');
select throws_ok($$ delete from public.wallet_ledger_entries $$,
  '42501', null, 'users cannot delete ledger entries');

-- Funding ------------------------------------------------------------------------
select is(public.request_campaign_funding((select campaign_id from t_ids))::text, 'funding_required',
  'a complete draft moves to funding_required');

select throws_ok($$ select * from public.fund_and_publish_campaign((select campaign_id from t_ids), 'fund-key-0001') $$,
  'P0001', 'insufficient_funds', 'funding fails when the wallet balance is too low ($500 < $1,200)');

select is((select replayed from public.record_test_deposit(100000, 'USD', 'mock_ref_a2', 'succeeded', 'deposit-key-a2')),
  false, 'a further $1,000 test deposit is recorded');

select is((select already_funded from public.fund_and_publish_campaign((select campaign_id from t_ids), 'fund-key-0001')),
  false, 'owner funds the campaign');
select is((select already_funded from public.fund_and_publish_campaign((select campaign_id from t_ids), 'fund-key-0002')),
  true, 'a retry (even with a new key) does not charge twice');
select is((select balance_cents from public.wallet_account_balances where kind = 'user_wallet'), 30000::bigint,
  'exactly $1,200 was debited once ($1,500 − $1,200 = $300)');
select is((select status::text from public.campaigns c join t_ids t on t.campaign_id = c.id), 'applications_open',
  'a funded campaign is published with applications open');
select lives_ok($$ set constraints public.wallet_ledger_entries_balanced immediate $$,
  'campaign funding passes the balanced-journal check at commit time');
set constraints public.wallet_ledger_entries_balanced deferred;
update public.campaigns set payment_per_creator_cents = 1 where id = (select campaign_id from t_ids);
select is((select payment_per_creator_cents from public.campaigns c join t_ids t on t.campaign_id = c.id), 1000::bigint,
  'the owner cannot edit financial fields of a funded campaign (RLS)');

-- Another user cannot charge A's wallet for A's campaign, nor their own for it.
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}', true);
select throws_ok($$ select * from public.fund_and_publish_campaign((select campaign_id from t_ids), 'fund-key-b001') $$,
  'P0002', null, 'campaign funding cannot be triggered by (or charge) another user');

-- Statement, counts and visibility after funding ---------------------------------
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);
select is((select balance_after_cents from public.wallet_statement order by created_at desc, id desc limit 1), 30000::bigint,
  'the wallet statement shows the running balance after funding');
select is((select total from public.my_campaign_status_counts() where status = 'applications_open'), 1::bigint,
  'status counts reflect the published campaign');

select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-000000000003","role":"authenticated"}', true);
select is((select count(*)::int from public.campaigns where id in (select campaign_id from t_ids)), 1, 'signed-in creators can see a funded, live campaign');
select is((select count(*)::int from public.wallet_statement), 0, 'creators cannot see the advertiser''s wallet');

-- Test funds switched off (as in production) --------------------------------------
reset role;
update public.platform_settings set test_funds_enabled = false where id;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-000000000003","role":"authenticated"}', true);
select throws_ok($$ select * from public.record_test_deposit(100000, 'USD', 'mock_ref_c1', 'succeeded', 'deposit-key-c1') $$,
  '42501', 'test_funds_disabled', 'test deposits are refused when test funds are disabled (production)');

-- Owner-level integrity checks -----------------------------------------------------
reset role;
select is(
  (select sum(amount_cents)::bigint from public.wallet_ledger_entries),
  0::bigint,
  'the ledger is balanced (all entries sum to zero)'
);
select is(
  (select title from public.campaigns c join t_ids t on t.campaign_id = c.id),
  'Summer Collection Promotion',
  'neither another advertiser, a creator, nor an admin edited the campaign'
);
select throws_ok($$ update public.campaigns set creators_required = 1 where id = (select campaign_id from t_ids) $$,
  '42501', 'campaign_locked', 'even privileged updates cannot change a funded campaign''s liability (trigger)');

-- An unbalanced journal is rejected at commit.
insert into public.ledger_transactions (kind, initiated_by, idempotency_key, campaign_id, description)
values ('campaign_funding', 'aaaaaaaa-0000-0000-0000-000000000001', 'unbalanced-test-1', (select campaign_id from t_ids), 'unbalanced');
insert into public.wallet_ledger_entries (transaction_id, account_id, entry_type, amount_cents)
select (select id from public.ledger_transactions where idempotency_key = 'unbalanced-test-1'),
       (select id from public.wallet_accounts where kind = 'platform_revenue'), 'platform_fee', 500;
select throws_ok($$ set constraints public.wallet_ledger_entries_balanced immediate $$,
  '23514', null, 'an unbalanced journal is rejected by the balance check');

select * from finish();
rollback;
