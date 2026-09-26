-- =============================================================================
-- Phase 2b: internal wallet accounting ledger + campaign funding.
--
-- IMPORTANT: this is an internal development accounting model. It does not mean
-- InfluencEarn holds customer money. Real money movement requires a payment
-- provider, which has not been selected. Only a development-only test-funds path
-- exists, and it is disabled unless `platform_settings.test_funds_enabled` is true
-- (set only by supabase/seed.sql for local development).
--
-- Model (double entry):
--   ledger_transactions      one row per financial operation (journal header)
--   wallet_ledger_entries    signed amounts per account; each transaction sums to 0
--   wallet_accounts          user wallets + system accounts (campaign reserve,
--                            platform revenue, provider clearing)
--   Balances are always derived from entries; there is no mutable balance column.
--
-- Clients have SELECT-only access (own rows). Every write happens inside
-- SECURITY DEFINER functions below. Entries are append-only (trigger-enforced).
-- =============================================================================

create type public.wallet_account_kind as enum (
  'user_wallet',
  'campaign_reserve',
  'platform_revenue',
  'provider_clearing'
);

create type public.ledger_transaction_kind as enum ('test_deposit', 'campaign_funding');

-- Only the entry types needed in this phase. Refunds, creator earnings and payouts
-- will be added with their own flows.
create type public.ledger_entry_type as enum (
  'mock_deposit',
  'campaign_funding_debit',
  'campaign_funding_reserve',
  'platform_fee'
);

create type public.payment_transaction_status as enum (
  'pending',
  'processing',
  'succeeded',
  'failed',
  'cancelled'
);

create type public.campaign_funding_status as enum ('succeeded');

-- -----------------------------------------------------------------------------
-- Platform settings (singleton). Writable only by the database owner.
-- -----------------------------------------------------------------------------
create table public.platform_settings (
  id                 boolean primary key default true check (id),
  test_funds_enabled boolean not null default false,
  updated_at         timestamptz not null default now()
);

insert into public.platform_settings (id, test_funds_enabled) values (true, false);

comment on column public.platform_settings.test_funds_enabled is
  'Development/test only. Must stay false in production. Enabled by supabase/seed.sql locally.';

-- -----------------------------------------------------------------------------
-- Accounts
-- -----------------------------------------------------------------------------
create table public.wallet_accounts (
  id          uuid primary key default gen_random_uuid(),
  kind        public.wallet_account_kind not null,
  owner_id    uuid references public.profiles (id) on delete restrict,
  campaign_id uuid references public.campaigns (id) on delete restrict,
  provider    text check (provider is null or provider ~ '^[a-z][a-z0-9_]{1,39}$'),
  currency    char(3) not null default 'USD' check (currency = 'USD'),
  created_at  timestamptz not null default now(),
  constraint wallet_accounts_shape check (
    case kind
      when 'user_wallet'       then owner_id is not null and campaign_id is null and provider is null
      when 'campaign_reserve'  then campaign_id is not null and owner_id is null and provider is null
      when 'platform_revenue'  then owner_id is null and campaign_id is null and provider is null
      when 'provider_clearing' then provider is not null and owner_id is null and campaign_id is null
    end
  )
);

create unique index wallet_accounts_user_idx on public.wallet_accounts (owner_id, currency)
  where kind = 'user_wallet';
create unique index wallet_accounts_campaign_idx on public.wallet_accounts (campaign_id, currency)
  where kind = 'campaign_reserve';
create unique index wallet_accounts_platform_idx on public.wallet_accounts (currency)
  where kind = 'platform_revenue';
create unique index wallet_accounts_provider_idx on public.wallet_accounts (provider, currency)
  where kind = 'provider_clearing';

-- -----------------------------------------------------------------------------
-- Provider-level payment records (deposits in this phase; mock provider only)
-- -----------------------------------------------------------------------------
create table public.payment_transactions (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.profiles (id) on delete restrict,
  wallet_account_id  uuid not null references public.wallet_accounts (id) on delete restrict,
  provider           text not null check (provider ~ '^[a-z][a-z0-9_]{1,39}$'),
  direction          text not null default 'deposit' check (direction in ('deposit')),
  amount_cents       bigint not null check (amount_cents > 0),
  currency           char(3) not null default 'USD' check (currency = 'USD'),
  status             public.payment_transaction_status not null,
  provider_reference text not null check (char_length(provider_reference) between 3 and 200),
  failure_reason     text check (failure_reason is null or char_length(failure_reason) <= 500),
  idempotency_key    text not null check (char_length(idempotency_key) between 8 and 200),
  is_test            boolean not null,
  created_at         timestamptz not null default now(),
  completed_at       timestamptz,
  unique (user_id, idempotency_key),
  unique (provider, provider_reference)
);

create index payment_transactions_user_created_idx
  on public.payment_transactions (user_id, created_at desc, id desc);

-- -----------------------------------------------------------------------------
-- Journal
-- -----------------------------------------------------------------------------
create table public.ledger_transactions (
  id                     uuid primary key default gen_random_uuid(),
  kind                   public.ledger_transaction_kind not null,
  initiated_by           uuid not null references public.profiles (id) on delete restrict,
  idempotency_key        text not null check (char_length(idempotency_key) between 8 and 200),
  campaign_id            uuid references public.campaigns (id) on delete restrict,
  payment_transaction_id uuid unique references public.payment_transactions (id) on delete restrict,
  is_test                boolean not null default false,
  description            text not null check (char_length(description) between 3 and 200),
  created_at             timestamptz not null default now(),
  unique (initiated_by, idempotency_key),
  constraint ledger_transactions_reference check (
    case kind
      when 'test_deposit'     then payment_transaction_id is not null and campaign_id is null
      when 'campaign_funding' then campaign_id is not null and payment_transaction_id is null
    end
  )
);

create index ledger_transactions_campaign_idx on public.ledger_transactions (campaign_id)
  where campaign_id is not null;

create table public.wallet_ledger_entries (
  id             bigint generated always as identity primary key,
  transaction_id uuid not null references public.ledger_transactions (id) on delete restrict,
  account_id     uuid not null references public.wallet_accounts (id) on delete restrict,
  entry_type     public.ledger_entry_type not null,
  amount_cents   bigint not null check (amount_cents <> 0),
  currency       char(3) not null default 'USD' check (currency = 'USD'),
  created_at     timestamptz not null default now()
);

create index wallet_ledger_entries_account_idx
  on public.wallet_ledger_entries (account_id, created_at desc, id desc);
create index wallet_ledger_entries_transaction_idx on public.wallet_ledger_entries (transaction_id);

-- Append-only: no one (including admins) edits or deletes entries or journal rows.
create or replace function public.ledger_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'ledger_is_append_only' using errcode = '42501';
end;
$$;

create trigger wallet_ledger_entries_append_only
  before update or delete on public.wallet_ledger_entries
  for each row execute function public.ledger_append_only();
create trigger ledger_transactions_append_only
  before update or delete on public.ledger_transactions
  for each row execute function public.ledger_append_only();

-- Every journal transaction must balance to zero (checked at commit).
-- SECURITY DEFINER: the check must see every entry of the transaction, including
-- system accounts the initiating user cannot read under RLS.
create or replace function public.ledger_assert_balanced()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sum bigint;
begin
  select coalesce(sum(amount_cents), 0) into v_sum
  from public.wallet_ledger_entries where transaction_id = new.transaction_id;
  if v_sum <> 0 then
    raise exception 'ledger_unbalanced: transaction % sums to %', new.transaction_id, v_sum
      using errcode = '23514';
  end if;
  return null;
end;
$$;

create constraint trigger wallet_ledger_entries_balanced
  after insert on public.wallet_ledger_entries
  deferrable initially deferred
  for each row execute function public.ledger_assert_balanced();

-- -----------------------------------------------------------------------------
-- Campaign funding record (one per campaign)
-- -----------------------------------------------------------------------------
create table public.campaign_funding (
  id                    uuid primary key default gen_random_uuid(),
  campaign_id           uuid not null unique references public.campaigns (id) on delete restrict,
  payer_id              uuid not null references public.profiles (id) on delete restrict,
  wallet_account_id     uuid not null references public.wallet_accounts (id) on delete restrict,
  ledger_transaction_id uuid not null unique references public.ledger_transactions (id) on delete restrict,
  creators_required     integer not null check (creators_required > 0),
  payment_per_creator_cents bigint not null check (payment_per_creator_cents > 0),
  creator_budget_cents  bigint not null check (creator_budget_cents > 0),
  platform_fee_bps      integer not null check (platform_fee_bps between 0 and 10000),
  platform_fee_cents    bigint not null check (platform_fee_cents >= 0),
  total_cents           bigint not null,
  currency              char(3) not null default 'USD' check (currency = 'USD'),
  status                public.campaign_funding_status not null default 'succeeded',
  created_at            timestamptz not null default now(),
  constraint campaign_funding_budget check (creator_budget_cents = payment_per_creator_cents * creators_required),
  constraint campaign_funding_total check (total_cents = creator_budget_cents + platform_fee_cents)
);

create index campaign_funding_payer_idx on public.campaign_funding (payer_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Balances (derived) — security_invoker so RLS on the base tables applies
-- -----------------------------------------------------------------------------
create view public.wallet_account_balances
with (security_invoker = true)
as
select
  a.id as account_id,
  a.kind,
  a.owner_id,
  a.campaign_id,
  a.currency,
  coalesce(sum(e.amount_cents), 0)::bigint as balance_cents
from public.wallet_accounts a
left join public.wallet_ledger_entries e on e.account_id = a.id
group by a.id;

-- Per-entry statement for user wallets with a running balance. Partitioned by account,
-- so it stays correct for admins who can see many accounts.
create view public.wallet_statement
with (security_invoker = true)
as
select
  e.id,
  e.account_id,
  a.owner_id,
  e.entry_type,
  e.amount_cents,
  sum(e.amount_cents) over (partition by e.account_id order by e.created_at, e.id)::bigint as balance_after_cents,
  e.created_at,
  t.kind as transaction_kind,
  t.description,
  t.campaign_id,
  t.is_test
from public.wallet_ledger_entries e
join public.wallet_accounts a on a.id = e.account_id and a.kind = 'user_wallet'
join public.ledger_transactions t on t.id = e.transaction_id;

-- -----------------------------------------------------------------------------
-- Money helpers (mirrored in src/domain/money.ts + pricing.ts)
-- -----------------------------------------------------------------------------
create or replace function public.platform_fee_bps()
returns integer
language sql
immutable
set search_path = ''
as $$ select 2000 $$;

-- Round half away from zero; amounts here are always positive.
create or replace function public.platform_fee_cents(_creator_budget_cents bigint)
returns bigint
language sql
immutable
set search_path = ''
as $$
  select ((_creator_budget_cents * public.platform_fee_bps() + 5000) / 10000)::bigint;
$$;

create or replace function public._account_balance(_account_id uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(amount_cents), 0)::bigint
  from public.wallet_ledger_entries where account_id = _account_id;
$$;

create or replace function public._ensure_user_wallet(_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.wallet_accounts (kind, owner_id)
  values ('user_wallet', _user_id)
  on conflict (owner_id, currency) where kind = 'user_wallet' do nothing;
  select id into v_id from public.wallet_accounts
  where kind = 'user_wallet' and owner_id = _user_id and currency = 'USD';
  return v_id;
end;
$$;

create or replace function public._system_account(
  _kind public.wallet_account_kind,
  _campaign_id uuid default null,
  _provider text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if _kind = 'campaign_reserve' then
    insert into public.wallet_accounts (kind, campaign_id) values (_kind, _campaign_id)
    on conflict (campaign_id, currency) where kind = 'campaign_reserve' do nothing;
    select id into v_id from public.wallet_accounts where kind = _kind and campaign_id = _campaign_id;
  elsif _kind = 'platform_revenue' then
    insert into public.wallet_accounts (kind) values (_kind)
    on conflict (currency) where kind = 'platform_revenue' do nothing;
    select id into v_id from public.wallet_accounts where kind = _kind;
  elsif _kind = 'provider_clearing' then
    insert into public.wallet_accounts (kind, provider) values (_kind, _provider)
    on conflict (provider, currency) where kind = 'provider_clearing' do nothing;
    select id into v_id from public.wallet_accounts where kind = _kind and provider = _provider;
  else
    raise exception 'unsupported_system_account' using errcode = '22023';
  end if;
  return v_id;
end;
$$;

revoke all on function public._account_balance(uuid) from public, anon, authenticated;
revoke all on function public._ensure_user_wallet(uuid) from public, anon, authenticated;
revoke all on function public._system_account(public.wallet_account_kind, uuid, text) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Development-only test deposit (mock provider)
-- -----------------------------------------------------------------------------
-- Records the outcome reported by MockWalletFundingProvider. Refuses to run unless
-- test funds are enabled in platform_settings (never in production).
create or replace function public.record_test_deposit(
  p_amount_cents bigint,
  p_currency text,
  p_provider_reference text,
  p_status public.payment_transaction_status,
  p_idempotency_key text,
  p_failure_reason text default null
)
returns table (payment_transaction_id uuid, status public.payment_transaction_status, replayed boolean)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_existing public.payment_transactions%rowtype;
  v_wallet uuid;
  v_clearing uuid;
  v_payment uuid;
  v_tx uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not coalesce((select s.test_funds_enabled from public.platform_settings s where s.id), false) then
    raise exception 'test_funds_disabled' using errcode = '42501';
  end if;
  if p_currency is distinct from 'USD' then
    raise exception 'unsupported_currency' using errcode = '22023';
  end if;
  if p_amount_cents is null or p_amount_cents <= 0 or p_amount_cents > 10000000 then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;
  if p_status not in ('succeeded', 'failed') then
    raise exception 'invalid_final_status' using errcode = '22023';
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 8 and 150 then
    raise exception 'invalid_idempotency_key' using errcode = '22023';
  end if;

  v_wallet := public._ensure_user_wallet(v_uid);
  -- Serialise money operations per wallet.
  perform 1 from public.wallet_accounts where id = v_wallet for update;

  select * into v_existing from public.payment_transactions
  where user_id = v_uid and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.amount_cents <> p_amount_cents then
      raise exception 'idempotency_key_reused' using errcode = '22023';
    end if;
    return query select v_existing.id, v_existing.status, true;
    return;
  end if;

  insert into public.payment_transactions (
    user_id, wallet_account_id, provider, amount_cents, currency, status,
    provider_reference, failure_reason, idempotency_key, is_test, completed_at
  ) values (
    v_uid, v_wallet, 'mock', p_amount_cents, 'USD', p_status,
    p_provider_reference, case when p_status = 'failed' then left(p_failure_reason, 500) end,
    p_idempotency_key, true, now()
  )
  returning id into v_payment;

  if p_status = 'succeeded' then
    v_clearing := public._system_account('provider_clearing', null, 'mock');
    insert into public.ledger_transactions (
      kind, initiated_by, idempotency_key, payment_transaction_id, is_test, description
    ) values (
      'test_deposit', v_uid, 'deposit:' || p_idempotency_key, v_payment, true, 'Test funds (development only)'
    )
    returning id into v_tx;

    insert into public.wallet_ledger_entries (transaction_id, account_id, entry_type, amount_cents) values
      (v_tx, v_wallet, 'mock_deposit', p_amount_cents),
      (v_tx, v_clearing, 'mock_deposit', -p_amount_cents);
  end if;

  return query select v_payment, p_status, false;
end;
$$;

revoke all on function public.record_test_deposit(bigint, text, text, public.payment_transaction_status, text, text)
  from public, anon;
grant execute on function public.record_test_deposit(bigint, text, text, public.payment_transaction_status, text, text)
  to authenticated;

-- -----------------------------------------------------------------------------
-- Fund & publish (atomic, idempotent)
-- -----------------------------------------------------------------------------
-- 1. lock campaign, verify owner + state   2. recompute amounts server-side
-- 3. lock wallet, verify balance            4. balanced journal: wallet −total,
--    campaign reserve +budget, platform revenue +fee
-- 5. campaign_funding row                   6. funding_required → published → applications_open
-- A retry (same or different key) after success returns the existing funding.
create or replace function public.fund_and_publish_campaign(
  p_campaign_id uuid,
  p_idempotency_key text
)
returns table (
  funding_id uuid,
  total_cents bigint,
  already_funded boolean,
  campaign_status public.campaign_status
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_campaign public.campaigns%rowtype;
  v_existing public.campaign_funding%rowtype;
  v_wallet uuid;
  v_reserve uuid;
  v_revenue uuid;
  v_budget bigint;
  v_fee bigint;
  v_total bigint;
  v_balance bigint;
  v_tx uuid;
  v_funding uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 8 and 150 then
    raise exception 'invalid_idempotency_key' using errcode = '22023';
  end if;

  select * into v_campaign from public.campaigns where id = p_campaign_id for update;
  if not found or v_campaign.owner_id <> v_uid then
    raise exception 'campaign_not_found' using errcode = 'P0002';
  end if;

  select * into v_existing from public.campaign_funding where campaign_id = p_campaign_id;
  if found then
    return query select v_existing.id, v_existing.total_cents, true, v_campaign.status;
    return;
  end if;

  if v_campaign.status <> 'funding_required' then
    raise exception 'invalid_campaign_state: %', v_campaign.status using errcode = 'P0001';
  end if;

  perform public._assert_campaign_fundable(p_campaign_id);

  v_budget := v_campaign.payment_per_creator_cents * v_campaign.creators_required;
  v_fee := public.platform_fee_cents(v_budget);
  v_total := v_budget + v_fee;

  v_wallet := public._ensure_user_wallet(v_uid);
  perform 1 from public.wallet_accounts where id = v_wallet for update;
  v_balance := public._account_balance(v_wallet);

  if v_balance < v_total then
    raise exception 'insufficient_funds'
      using errcode = 'P0001',
            detail = json_build_object('required_cents', v_total, 'available_cents', v_balance)::text;
  end if;

  v_reserve := public._system_account('campaign_reserve', p_campaign_id, null);
  v_revenue := public._system_account('platform_revenue', null, null);

  insert into public.ledger_transactions (kind, initiated_by, idempotency_key, campaign_id, description)
  values ('campaign_funding', v_uid, 'fund:' || p_idempotency_key, p_campaign_id,
          left('Campaign funding · ' || v_campaign.title, 200))
  returning id into v_tx;

  insert into public.wallet_ledger_entries (transaction_id, account_id, entry_type, amount_cents) values
    (v_tx, v_wallet, 'campaign_funding_debit', -v_total),
    (v_tx, v_reserve, 'campaign_funding_reserve', v_budget);
  if v_fee > 0 then
    insert into public.wallet_ledger_entries (transaction_id, account_id, entry_type, amount_cents)
    values (v_tx, v_revenue, 'platform_fee', v_fee);
  end if;

  insert into public.campaign_funding (
    campaign_id, payer_id, wallet_account_id, ledger_transaction_id, creators_required,
    payment_per_creator_cents, creator_budget_cents, platform_fee_bps, platform_fee_cents, total_cents
  ) values (
    p_campaign_id, v_uid, v_wallet, v_tx, v_campaign.creators_required,
    v_campaign.payment_per_creator_cents, v_budget, public.platform_fee_bps(), v_fee, v_total
  )
  returning id into v_funding;

  update public.campaigns set status = 'published', published_at = now() where id = p_campaign_id;
  update public.campaigns set status = 'applications_open' where id = p_campaign_id;

  return query select v_funding, v_total, false, 'applications_open'::public.campaign_status;
end;
$$;

revoke all on function public.fund_and_publish_campaign(uuid, text) from public, anon;
grant execute on function public.fund_and_publish_campaign(uuid, text) to authenticated;

-- -----------------------------------------------------------------------------
-- Privileges + RLS: read-only for clients
-- -----------------------------------------------------------------------------
revoke all on table
  public.platform_settings, public.wallet_accounts, public.payment_transactions,
  public.ledger_transactions, public.wallet_ledger_entries, public.campaign_funding
from anon, authenticated;
revoke all on public.wallet_account_balances, public.wallet_statement from anon, authenticated;

grant select on public.platform_settings to authenticated;
grant select on public.wallet_accounts, public.payment_transactions, public.ledger_transactions,
  public.wallet_ledger_entries, public.campaign_funding to authenticated;
grant select on public.wallet_account_balances, public.wallet_statement to authenticated;

alter table public.platform_settings enable row level security;
alter table public.wallet_accounts enable row level security;
alter table public.payment_transactions enable row level security;
alter table public.ledger_transactions enable row level security;
alter table public.wallet_ledger_entries enable row level security;
alter table public.campaign_funding enable row level security;

create policy "platform_settings: readable" on public.platform_settings
  for select to authenticated using (true);

create policy "wallet_accounts: owner reads own wallet" on public.wallet_accounts
  for select to authenticated using (kind = 'user_wallet' and owner_id = (select auth.uid()));
create policy "wallet_accounts: admin reads all" on public.wallet_accounts
  for select to authenticated using ((select public.is_admin()));

create policy "wallet_ledger_entries: owner reads own wallet entries" on public.wallet_ledger_entries
  for select to authenticated using (
    exists (
      select 1 from public.wallet_accounts a
      where a.id = account_id and a.kind = 'user_wallet' and a.owner_id = (select auth.uid())
    )
  );
create policy "wallet_ledger_entries: admin reads all" on public.wallet_ledger_entries
  for select to authenticated using ((select public.is_admin()));

create policy "ledger_transactions: initiator reads own" on public.ledger_transactions
  for select to authenticated using (initiated_by = (select auth.uid()));
create policy "ledger_transactions: readable when touching own wallet" on public.ledger_transactions
  for select to authenticated using (
    exists (
      select 1
      from public.wallet_ledger_entries e
      join public.wallet_accounts a on a.id = e.account_id
      where e.transaction_id = ledger_transactions.id and a.kind = 'user_wallet' and a.owner_id = (select auth.uid())
    )
  );
create policy "ledger_transactions: admin reads all" on public.ledger_transactions
  for select to authenticated using ((select public.is_admin()));

create policy "payment_transactions: owner reads own" on public.payment_transactions
  for select to authenticated using (user_id = (select auth.uid()));
create policy "payment_transactions: admin reads all" on public.payment_transactions
  for select to authenticated using ((select public.is_admin()));

create policy "campaign_funding: campaign owner reads" on public.campaign_funding
  for select to authenticated using (payer_id = (select auth.uid()));
create policy "campaign_funding: admin reads all" on public.campaign_funding
  for select to authenticated using ((select public.is_admin()));
