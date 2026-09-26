-- Local development seed. Runs only on `supabase db reset` / `supabase start`
-- against the LOCAL database. Never applied to hosted projects.

-- Allow the development-only "Add test funds" flow locally.
update public.platform_settings set test_funds_enabled = true, updated_at = now() where id;
