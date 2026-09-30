-- Phase 5 enum values. Kept in their own migration: Postgres does not allow a new
-- enum value to be used in the same transaction that adds it.

alter type public.ledger_entry_type add value if not exists 'creator_earning';
alter type public.ledger_entry_type add value if not exists 'payout_debit';
alter type public.ledger_entry_type add value if not exists 'campaign_refund';
alter type public.ledger_transaction_kind add value if not exists 'creator_payout';
alter type public.ledger_transaction_kind add value if not exists 'campaign_refund';
alter type public.notification_type add value if not exists 'campaign_refunded';
