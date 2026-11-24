-- Account notices (emailed regardless of preferences). Separate migration: new enum values
-- must be committed before they are used.
alter type public.notification_type add value if not exists 'account_suspended';
alter type public.notification_type add value if not exists 'account_reinstated';
