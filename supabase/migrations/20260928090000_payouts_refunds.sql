-- =============================================================================
-- Phase 5: payouts (behind the PayoutProvider abstraction), refunds of unused
-- campaign budget, and the admin activity log.
--
-- * "Ready for payout" = an approved assignment with no payout row yet.
-- * Admins can hold, release (→ processing) and retry. The server calls the
--   payout provider and records the outcome with record_payout_result().
-- * Only a PAID payout touches the ledger (once, idempotent):
--     campaign reserve  −reward  (creator_earning)
--     creator wallet    +reward  (creator_earning)
--     creator wallet    −reward  (payout_debit)
--     payout clearing   +reward  (payout_debit)
-- * The mock payout provider only works where test mode is enabled
--   (platform_settings.test_funds_enabled, set by the local seed only).
-- * Not escrow: the reserve is an internal accounting account.
-- =============================================================================

-- New enum values are added in 20260928085900_payout_enums.sql (a separate
-- transaction, as Postgres requires before a new enum value can be used).

create type public.payout_status as enum ('on_hold', 'processing', 'paid', 'failed');

-- Journal rows: payouts and refunds reference a campaign (payouts via their row).
alter table public.ledger_transactions drop constraint ledger_transactions_reference;
alter table public.ledger_transactions add constraint ledger_transactions_reference check (
  case kind
    when 'test_deposit'     then payment_transaction_id is not null and campaign_id is null
    when 'campaign_funding' then campaign_id is not null and payment_transaction_id is null
    when 'creator_payout'   then campaign_id is not null and payment_transaction_id is null
    when 'campaign_refund'  then campaign_id is not null and payment_transaction_id is null
  end
);

-- -----------------------------------------------------------------------------
-- Admin activity log
-- -----------------------------------------------------------------------------
create table public.admin_activity_logs (
  id          bigint generated always as identity primary key,
  actor_id    uuid not null references public.profiles (id) on delete restrict,
  action      text not null check (action ~ '^[a-z][a-z_.]{2,60}$'),
  target_type text not null check (target_type ~ '^[a-z_]{3,40}$'),
  target_id   uuid,
  details     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index admin_activity_logs_created_idx on public.admin_activity_logs (created_at desc, id desc);
create index admin_activity_logs_target_idx on public.admin_activity_logs (target_type, target_id, created_at desc);

create trigger admin_activity_logs_append_only
  before update or delete on public.admin_activity_logs
  for each row execute function public.ledger_append_only();

create or replace function public._log_admin(_action text, _target_type text, _target_id uuid, _details jsonb default '{}'::jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.admin_activity_logs (actor_id, action, target_type, target_id, details)
  values (auth.uid(), _action, _target_type, _target_id, coalesce(_details, '{}'::jsonb));
$$;

revoke all on function public._log_admin(text, text, uuid, jsonb) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Payouts
-- -----------------------------------------------------------------------------
create table public.payouts (
  id                    uuid primary key default gen_random_uuid(),
  assignment_id         uuid not null unique references public.campaign_assignments (id) on delete restrict,
  campaign_id           uuid not null references public.campaigns (id) on delete restrict,
  creator_id            uuid not null references public.profiles (id) on delete restrict,
  amount_cents          bigint not null check (amount_cents > 0),
  currency              char(3) not null default 'USD' check (currency = 'USD'),
  status                public.payout_status not null,
  provider              text check (provider is null or provider ~ '^[a-z][a-z0-9_]{1,39}$'),
  provider_reference    text check (provider_reference is null or char_length(provider_reference) between 3 and 200),
  attempt_count         smallint not null default 0 check (attempt_count between 0 and 20),
  failure_reason        text check (failure_reason is null or char_length(failure_reason) <= 500),
  hold_reason           text check (hold_reason is null or char_length(hold_reason) between 3 and 500),
  ledger_transaction_id uuid unique references public.ledger_transactions (id) on delete restrict,
  last_actor_id         uuid references public.profiles (id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  paid_at               timestamptz,
  constraint payouts_paid_has_ledger check ((status = 'paid') = (ledger_transaction_id is not null and paid_at is not null))
);

create index payouts_status_idx on public.payouts (status, updated_at);
create index payouts_creator_idx on public.payouts (creator_id, created_at desc);

create trigger payouts_set_updated_at
  before update on public.payouts
  for each row execute function public.set_updated_at();

create or replace function public._require_admin()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not public.is_admin() then
    raise exception 'admin_required' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public._require_admin() from public, anon, authenticated;

-- Put approved work (or a failed payout) on hold.
create or replace function public.hold_payout(p_assignment_id uuid, p_reason text)
returns public.payout_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  asg public.campaign_assignments%rowtype;
  p public.payouts%rowtype;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  perform public._require_admin();
  if v_reason is null or char_length(v_reason) < 3 then
    raise exception 'reason_required' using errcode = '22023';
  end if;

  select * into asg from public.campaign_assignments where id = p_assignment_id for update;
  if not found then
    raise exception 'assignment_not_found' using errcode = 'P0002';
  end if;
  select * into p from public.payouts where assignment_id = asg.id for update;

  if p.id is null then
    if asg.status <> 'approved' then
      raise exception 'payout_not_allowed: %', asg.status using errcode = 'P0001';
    end if;
    insert into public.payouts (assignment_id, campaign_id, creator_id, amount_cents, status, hold_reason, last_actor_id)
    values (asg.id, asg.campaign_id, asg.creator_id, asg.reward_cents, 'on_hold', left(v_reason, 500), auth.uid());
    update public.campaign_assignments set status = 'payout_pending' where id = asg.id;
  elsif p.status in ('failed', 'on_hold') then
    update public.payouts set status = 'on_hold', hold_reason = left(v_reason, 500), last_actor_id = auth.uid() where id = p.id;
  else
    raise exception 'payout_not_allowed: %', p.status using errcode = 'P0001';
  end if;

  perform public._log_admin('payout.hold', 'assignment', asg.id, jsonb_build_object('reason', v_reason));
  return 'on_hold';
end;
$$;

-- Ready / on hold / failed → processing. Returns what the server needs to call the
-- provider. Idempotent: if already processing, returns the current attempt.
create or replace function public.start_payout(p_assignment_id uuid, p_provider text)
returns table (payout_id uuid, attempt smallint, amount_cents bigint, already_processing boolean)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  asg public.campaign_assignments%rowtype;
  p public.payouts%rowtype;
  v_reserve uuid;
  v_reserve_balance bigint;
begin
  perform public._require_admin();
  if p_provider is null or p_provider !~ '^[a-z][a-z0-9_]{1,39}$' then
    raise exception 'invalid_provider' using errcode = '22023';
  end if;

  select * into asg from public.campaign_assignments where id = p_assignment_id for update;
  if not found then
    raise exception 'assignment_not_found' using errcode = 'P0002';
  end if;
  select * into p from public.payouts where assignment_id = asg.id for update;

  if p.id is not null and p.status = 'processing' then
    return query select p.id, p.attempt_count, p.amount_cents, true;
    return;
  end if;
  if p.id is not null and p.status = 'paid' then
    raise exception 'payout_already_paid' using errcode = 'P0001';
  end if;
  if p.id is null and asg.status <> 'approved' then
    raise exception 'payout_not_allowed: %', asg.status using errcode = 'P0001';
  end if;

  -- The campaign reserve must still hold the reward.
  select id into v_reserve from public.wallet_accounts where kind = 'campaign_reserve' and campaign_id = asg.campaign_id;
  v_reserve_balance := coalesce(public._account_balance(v_reserve), 0);
  if v_reserve is null or v_reserve_balance < asg.reward_cents then
    raise exception 'insufficient_reserve' using errcode = 'P0001',
      detail = json_build_object('reserve_cents', v_reserve_balance, 'amount_cents', asg.reward_cents)::text;
  end if;

  if p.id is null then
    insert into public.payouts (assignment_id, campaign_id, creator_id, amount_cents, status, provider, attempt_count, last_actor_id)
    values (asg.id, asg.campaign_id, asg.creator_id, asg.reward_cents, 'processing', p_provider, 1, auth.uid())
    returning * into p;
    update public.campaign_assignments set status = 'payout_pending' where id = asg.id;
  else
    update public.payouts
    set status = 'processing', provider = p_provider, attempt_count = attempt_count + 1,
        failure_reason = null, hold_reason = null, last_actor_id = auth.uid()
    where id = p.id
    returning * into p;
  end if;

  perform public._log_admin('payout.release', 'payout', p.id,
    jsonb_build_object('assignment_id', asg.id, 'attempt', p.attempt_count, 'provider', p_provider, 'amount_cents', p.amount_cents));

  return query select p.id, p.attempt_count, p.amount_cents, false;
end;
$$;

-- Records the provider's final outcome for an attempt. Idempotent for 'paid'.
create or replace function public.record_payout_result(
  p_payout_id uuid,
  p_attempt smallint,
  p_status public.payout_status,
  p_provider_reference text default null,
  p_failure_reason text default null
)
returns public.payout_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.payouts%rowtype;
  c public.campaigns%rowtype;
  v_reserve uuid;
  v_wallet uuid;
  v_clearing uuid;
  v_tx uuid;
begin
  perform public._require_admin();
  if p_status not in ('paid', 'failed') then
    raise exception 'invalid_final_status' using errcode = '22023';
  end if;

  select * into p from public.payouts where id = p_payout_id for update;
  if not found then
    raise exception 'payout_not_found' using errcode = 'P0002';
  end if;
  if p.status = 'paid' then
    return 'paid'; -- already recorded; never pay twice
  end if;
  if p.status <> 'processing' or p.attempt_count <> p_attempt then
    raise exception 'stale_payout_attempt' using errcode = 'P0001';
  end if;
  if p.provider = 'mock' and not coalesce((select s.test_funds_enabled from public.platform_settings s where s.id), false) then
    raise exception 'test_mode_disabled' using errcode = '42501';
  end if;

  select * into c from public.campaigns where id = p.campaign_id;

  if p_status = 'failed' then
    update public.payouts
    set status = 'failed', failure_reason = left(coalesce(nullif(btrim(p_failure_reason), ''), 'The payout provider reported a failure.'), 500),
        provider_reference = coalesce(p_provider_reference, provider_reference), last_actor_id = auth.uid()
    where id = p.id;
    perform public._log_admin('payout.failed', 'payout', p.id, jsonb_build_object('attempt', p_attempt, 'reason', p_failure_reason));
    return 'failed';
  end if;

  select id into v_reserve from public.wallet_accounts where kind = 'campaign_reserve' and campaign_id = p.campaign_id for update;
  if coalesce(public._account_balance(v_reserve), 0) < p.amount_cents then
    raise exception 'insufficient_reserve' using errcode = 'P0001';
  end if;
  v_wallet := public._ensure_user_wallet(p.creator_id);
  v_clearing := public._system_account('provider_clearing', null, p.provider);

  insert into public.ledger_transactions (kind, initiated_by, idempotency_key, campaign_id, is_test, description)
  values ('creator_payout', auth.uid(), 'payout:' || p.id::text, p.campaign_id, p.provider = 'mock',
          left('Payout · ' || c.title, 200))
  returning id into v_tx;

  insert into public.wallet_ledger_entries (transaction_id, account_id, entry_type, amount_cents) values
    (v_tx, v_reserve, 'creator_earning', -p.amount_cents),
    (v_tx, v_wallet, 'creator_earning', p.amount_cents),
    (v_tx, v_wallet, 'payout_debit', -p.amount_cents),
    (v_tx, v_clearing, 'payout_debit', p.amount_cents);

  update public.payouts
  set status = 'paid', paid_at = now(), ledger_transaction_id = v_tx,
      provider_reference = coalesce(p_provider_reference, provider_reference), failure_reason = null, last_actor_id = auth.uid()
  where id = p.id;
  update public.campaign_assignments set status = 'paid' where id = p.assignment_id;

  perform public._notify(
    p.creator_id, 'payout_released', 'Payment released',
    'Your payment for "' || c.title || '" was released.',
    '/wallet',
    jsonb_build_object('campaign_id', c.id, 'payout_id', p.id)
  );
  perform public._log_admin('payout.paid', 'payout', p.id,
    jsonb_build_object('attempt', p_attempt, 'provider_reference', p_provider_reference, 'amount_cents', p.amount_cents));
  return 'paid';
end;
$$;

revoke all on function public.hold_payout(uuid, text) from public, anon;
revoke all on function public.start_payout(uuid, text) from public, anon;
revoke all on function public.record_payout_result(uuid, smallint, public.payout_status, text, text) from public, anon;
grant execute on function public.hold_payout(uuid, text) to authenticated;
grant execute on function public.start_payout(uuid, text) to authenticated;
grant execute on function public.record_payout_result(uuid, smallint, public.payout_status, text, text) to authenticated;

-- -----------------------------------------------------------------------------
-- Refund of unused budget when a campaign completes
-- -----------------------------------------------------------------------------
-- BUSINESS POLICY — PENDING CLIENT SIGN-OFF.
-- Whether the 20% platform fee on the unused part of a campaign is refunded too.
-- Current behaviour: only the unused creator budget is refunded; the platform fee stays
-- in platform revenue. This function is the single switch for that policy. Turning it on
-- is NOT a one-line change: refunding the fee needs a reversal out of platform_revenue and
-- a rounding rule, which are not implemented yet, so _refund_unused_budget refuses to run
-- (fee_refund_not_implemented) rather than silently ignoring the switch.
create or replace function public.platform_fee_refundable()
returns boolean
language sql
immutable
set search_path = ''
as $$ select false $$;

create or replace function public._refund_unused_budget(_campaign_id uuid)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.campaigns%rowtype;
  v_reserve uuid;
  v_wallet uuid;
  v_owed bigint;
  v_refund bigint;
  v_tx uuid;
begin
  select * into c from public.campaigns where id = _campaign_id;
  -- Lock the reserve first so concurrent settlements of one campaign run one at a time.
  select id into v_reserve from public.wallet_accounts where kind = 'campaign_reserve' and campaign_id = _campaign_id for update;
  if exists (select 1 from public.ledger_transactions where idempotency_key = 'refund:' || _campaign_id::text) then
    return 0; -- already refunded
  end if;
  if public.platform_fee_refundable() then
    raise exception 'fee_refund_not_implemented' using errcode = 'P0001';
  end if;
  if v_reserve is null then
    return 0;
  end if;

  -- Keep what approved-but-unpaid work is still owed.
  select coalesce(sum(a.reward_cents), 0) into v_owed
  from public.campaign_assignments a
  left join public.payouts p on p.assignment_id = a.id
  where a.campaign_id = _campaign_id
    and a.status in ('approved', 'payout_pending')
    and (p.id is null or p.status <> 'paid');

  v_refund := public._account_balance(v_reserve) - v_owed;
  if v_refund <= 0 then
    return 0;
  end if;

  v_wallet := public._ensure_user_wallet(c.owner_id);
  insert into public.ledger_transactions (kind, initiated_by, idempotency_key, campaign_id, description)
  values ('campaign_refund', c.owner_id, 'refund:' || _campaign_id::text, _campaign_id,
          left('Unused budget refund · ' || c.title, 200))
  returning id into v_tx;
  insert into public.wallet_ledger_entries (transaction_id, account_id, entry_type, amount_cents) values
    (v_tx, v_reserve, 'campaign_refund', -v_refund),
    (v_tx, v_wallet, 'campaign_refund', v_refund);

  perform public._notify(
    c.owner_id, 'campaign_refunded', 'Unused budget refunded',
    'The unused creator budget of "' || c.title || '" was returned to your wallet.',
    '/wallet',
    jsonb_build_object('campaign_id', c.id, 'amount_cents', v_refund)
  );
  return v_refund;
end;
$$;

revoke all on function public._refund_unused_budget(uuid) from public, anon, authenticated;

-- complete_campaign (phase 4) + refund of unused budget.
create or replace function public.complete_campaign(p_campaign_id uuid)
returns public.campaign_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.campaign_status;
begin
  select status into v_status from public.campaigns
  where id = p_campaign_id and owner_id = (select auth.uid())
  for update;
  if not found then
    raise exception 'campaign_not_found' using errcode = 'P0002';
  end if;
  if v_status = 'completed' then
    return v_status;
  end if;
  if v_status not in ('in_progress', 'review_pending') then
    raise exception 'invalid_campaign_transition: % -> completed', v_status using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.campaign_assignments
    where campaign_id = p_campaign_id
      and (status = 'submitted' or (status in ('in_progress', 'revision_requested') and due_at >= now()))
  ) then
    raise exception 'work_outstanding' using errcode = 'P0001';
  end if;
  update public.campaign_assignments
  set status = 'expired', decided_at = now()
  where campaign_id = p_campaign_id and status in ('in_progress', 'revision_requested');
  update public.campaigns set status = 'completed' where id = p_campaign_id;
  perform public._refund_unused_budget(p_campaign_id);
  return 'completed';
end;
$$;

-- -----------------------------------------------------------------------------
-- Privileges + RLS
-- -----------------------------------------------------------------------------
revoke all on public.payouts, public.admin_activity_logs from anon, authenticated;
grant select on public.payouts, public.admin_activity_logs to authenticated;

alter table public.payouts enable row level security;
alter table public.admin_activity_logs enable row level security;

create policy "payouts: creator reads own" on public.payouts
  for select to authenticated using (creator_id = (select auth.uid()));
create policy "payouts: campaign owner reads" on public.payouts
  for select to authenticated using (public.is_campaign_owner(campaign_id));
create policy "payouts: admin reads" on public.payouts
  for select to authenticated using ((select public.is_admin()));

create policy "admin_activity_logs: admin reads" on public.admin_activity_logs
  for select to authenticated using ((select public.is_admin()));
