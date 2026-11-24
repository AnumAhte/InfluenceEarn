-- Phase 6: rate limits (pre-request hook for Data API writes + server-side limiter).
-- Run with: npx supabase test db
begin;

create extension if not exists pgtap with schema extensions;

select plan(11);

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('7a000000-0000-0000-0000-000000000001', 'rl-user@test.local', '{"full_name":"RL User"}', 'authenticated', 'authenticated'),
  ('7a000000-0000-0000-0000-000000000002', 'rl-other@test.local', '{"full_name":"RL Other"}', 'authenticated', 'authenticated');

-- Simulate PostgREST calling the pre-request hook for POST /rpc/apply_to_campaign (30 per hour).
create function pg_temp.api_call(_method text, _path text) returns void language plpgsql as $$
begin
  perform set_config('request.method', _method, true);
  perform set_config('request.path', _path, true);
  perform public.reject_suspended_requests();
end;
$$;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"7a000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select lives_ok($$ select pg_temp.api_call('POST', '/rpc/apply_to_campaign') from generate_series(1, 30) $$,
  'writes within the endpoint limit are allowed');
select throws_ok($$ select pg_temp.api_call('POST', '/rpc/apply_to_campaign') $$, 'PT429', 'rate_limited',
  'the next write over the limit gets HTTP 429');
select lives_ok($$ select pg_temp.api_call('GET', '/campaigns') from generate_series(1, 200) $$, 'reads are not rate limited');
select lives_ok($$ select pg_temp.api_call('POST', '/rpc/save_campaign_draft') $$, 'limits are per endpoint');

select set_config('request.jwt.claims', '{"sub":"7a000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select lives_ok($$ select pg_temp.api_call('POST', '/rpc/apply_to_campaign') $$, 'limits are per user');
select lives_ok($$ select pg_temp.api_call('POST', '/rpc/some_unlisted_function') from generate_series(1, 120) $$,
  'unlisted endpoints allow 120 writes per minute');
select throws_ok($$ select pg_temp.api_call('POST', '/rpc/some_unlisted_function') $$, 'PT429', 'rate_limited',
  'and refuse the 121st');

select throws_ok($$ select public.check_rate_limit('victim-ip', 'signInPerIp', 1, 60) $$, '42501', null,
  'users cannot call the server-side limiter (no one can exhaust another person''s limit)');
select throws_ok($$ select count(*) from public.rate_limit_counters $$, '42501', null, 'users cannot read the counters');

reset role;
set local role service_role;
select is((select public.check_rate_limit('hash-1', 'signInPerEmail', 2, 600) and public.check_rate_limit('hash-1', 'signInPerEmail', 2, 600)),
  true, 'the server-side limiter allows up to the limit');
select is(public.check_rate_limit('hash-1', 'signInPerEmail', 2, 600), false, 'and refuses after it');

select * from finish();
rollback;
