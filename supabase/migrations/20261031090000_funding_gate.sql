-- =============================================================================
-- Phase 6 — production funding gate
--
-- Campaign funding (and therefore publishing) is allowed only when a verified
-- funding source exists. No real payment provider is integrated yet, so the only
-- source is the development mock, which is on only while
-- platform_settings.test_funds_enabled is true (set by supabase/seed.sql locally).
--
-- The gate is a BEFORE INSERT trigger on campaign_funding, so it also covers a
-- direct RPC call to fund_and_publish_campaign that bypasses the app. The funding
-- function, fee maths and ledger are unchanged; a refused insert rolls back the
-- whole funding transaction (no ledger rows, no status change).
--
-- When a real provider is integrated, its migration must redefine
-- campaign_funding_available() to require a provider-verified deposit source.
-- =============================================================================

create or replace function public.campaign_funding_available()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select test_funds_enabled from public.platform_settings where id), false);
$$;

comment on function public.campaign_funding_available() is
  'True only when a verified funding source exists. Today: development test mode only. A real-provider migration must redefine this.';

revoke all on function public.campaign_funding_available() from public, anon;
grant execute on function public.campaign_funding_available() to authenticated;

create or replace function public.campaign_funding_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.campaign_funding_available() then
    raise exception 'funding_unavailable' using errcode = 'P0001',
      hint = 'No verified payment provider is configured; campaigns cannot be funded or published.';
  end if;
  return new;
end;
$$;

revoke all on function public.campaign_funding_guard() from public, anon, authenticated;

create trigger campaign_funding_require_provider
  before insert on public.campaign_funding
  for each row execute function public.campaign_funding_guard();
