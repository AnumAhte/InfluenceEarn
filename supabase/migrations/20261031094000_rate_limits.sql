-- =============================================================================
-- Phase 6 — rate limiting (fixed windows, stored in Postgres)
--
-- 1. Every write request to the Data API (POST/PATCH/PUT/DELETE) by a signed-in user is
--    counted per user and endpoint in the PostgREST pre-request hook, so server actions
--    and direct API calls share one limit. Default 120 per minute; stricter rules for
--    sensitive endpoints live in rate_limit_rules. Over the limit → HTTP 429 'rate_limited'.
-- 2. check_rate_limit() (service_role only) lets the app limit flows that don't go through
--    the Data API as the user: sign-in / sign-up / password reset (by client IP and email)
--    and file uploads. Only the server can call it, so nobody can exhaust someone else's limit.
-- =============================================================================

create table public.rate_limit_counters (
  subject      text not null check (char_length(subject) <= 200),
  action       text not null check (char_length(action) <= 120),
  window_start timestamptz not null,
  hits         integer not null default 0,
  primary key (subject, action, window_start)
);

create index rate_limit_counters_window_idx on public.rate_limit_counters (window_start);

create table public.rate_limit_rules (
  path           text primary key check (path ~ '^/'),
  max_hits       integer not null check (max_hits > 0),
  window_seconds integer not null check (window_seconds between 1 and 86400)
);

comment on table public.rate_limit_rules is 'Per-endpoint limits for Data API writes (per user). Unlisted endpoints: 120 per minute.';

insert into public.rate_limit_rules (path, max_hits, window_seconds) values
  ('/rpc/apply_to_campaign',          30, 3600),
  ('/rpc/submit_task_completion',     30, 3600),
  ('/rpc/review_task_submission',    120, 3600),
  ('/rpc/decide_application',        300, 3600),
  ('/rpc/save_campaign_draft',        60,  600),
  ('/rpc/fund_and_publish_campaign',  20, 3600),
  ('/rpc/record_test_deposit',        30, 3600),
  ('/rpc/save_creator_profile',       30,  600),
  ('/rpc/suspend_user',               30, 3600),
  ('/rpc/unsuspend_user',             30, 3600),
  ('/social_accounts',                30, 3600),
  ('/notification_preferences',       30,  600),
  ('/creator_media_kits',             30, 3600),
  ('/profiles',                       30,  600);

-- No client access to either table.
revoke all on public.rate_limit_counters, public.rate_limit_rules from anon, authenticated;
alter table public.rate_limit_counters enable row level security;
alter table public.rate_limit_rules enable row level security;

-- Counts one hit; true while the subject is within the limit for the current window.
create or replace function public._hit_rate_limit(_subject text, _action text, _max integer, _window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / _window_seconds) * _window_seconds);
  v_hits integer;
begin
  insert into public.rate_limit_counters as c (subject, action, window_start, hits)
  values (left(_subject, 200), left(_action, 120), v_window, 1)
  on conflict (subject, action, window_start) do update set hits = c.hits + 1
  returning hits into v_hits;

  -- Occasional cleanup of expired windows.
  if random() < 0.01 then
    delete from public.rate_limit_counters where window_start < now() - interval '1 day';
  end if;

  return v_hits <= _max;
end;
$$;

revoke all on function public._hit_rate_limit(text, text, integer, integer) from public, anon, authenticated;

-- Server-side limiter for flows outside the Data API (sign-in by IP/email, uploads).
create or replace function public.check_rate_limit(p_subject text, p_action text, p_max integer, p_window_seconds integer)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select public._hit_rate_limit(p_subject, p_action, p_max, p_window_seconds);
$$;

revoke all on function public.check_rate_limit(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.check_rate_limit(text, text, integer, integer) to service_role;

-- -----------------------------------------------------------------------------
-- Pre-request hook: suspension check (unchanged) + write rate limits
-- -----------------------------------------------------------------------------
create or replace function public.reject_suspended_requests()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_method text := current_setting('request.method', true);
  v_path text := current_setting('request.path', true);
  v_rule public.rate_limit_rules;
begin
  if v_uid is null then
    return;
  end if;
  if public.is_user_suspended(v_uid) then
    raise exception 'account_suspended' using errcode = '42501', hint = 'This account has been suspended.';
  end if;

  -- Reads (and read-only calls to stable functions) run in read-only transactions; only writes count.
  if v_method in ('POST', 'PATCH', 'PUT', 'DELETE') and current_setting('transaction_read_only') = 'off' and v_path is not null then
    select * into v_rule from public.rate_limit_rules where path = v_path;
    if not public._hit_rate_limit(v_uid::text, 'api:' || v_path,
                                  coalesce(v_rule.max_hits, 120), coalesce(v_rule.window_seconds, 60)) then
      raise exception 'rate_limited' using errcode = 'PT429', hint = 'Too many requests. Please wait and try again.';
    end if;
  end if;
end;
$$;
