# InfluencEarn

Influencer campaign marketplace: advertisers fund campaigns from a wallet, select creators manually,
review submitted work, and the agency releases payouts.

Stack: Next.js 16 (App Router) · TypeScript (strict) · Tailwind CSS v4 · Radix primitives ·
Supabase (Postgres, Auth, Storage, RLS) · Zod · React Hook Form · Vitest · pgTAP.

See [`docs/architecture.md`](docs/architecture.md) for the design audit, conflicts, data model and roadmap.
Design references (not runtime code) are in `design/`.

## Getting started

Requirements: Node 20.9+, Docker (for the local Supabase stack).

```bash
npm install
npm run db:start          # starts local Supabase and applies supabase/migrations
cp .env.example .env.local
# paste the "API URL" and "Publishable key" printed by db:start into .env.local
npm run dev               # http://localhost:3000
```

Local auth emails (confirmation, password reset) are captured by Mailpit at http://127.0.0.1:54324.

Lighter local stack (skips Studio, storage, realtime, analytics):
`npx supabase start -x studio,imgproxy,vector,logflare,edge-runtime,realtime,supavisor,postgres-meta,storage-api`
(profile photo uploads need `storage-api`).

### Test funds (development only)

`npm run dev` shows an **Add test funds** panel on the Wallet and funding pages. It uses a mock provider and
works only when `NODE_ENV` is not `production` **and** the local database flag set by `supabase/seed.sql` is on.
Amounts ending in `.13` are declined, to exercise failures. No real payment provider is integrated.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js |
| `npm run lint` | ESLint |
| `npm run typecheck` | Route type generation + `tsc --noEmit` |
| `npm test` | Unit tests (Vitest) |
| `npm run db:reset` | Re-create the local DB from migrations |
| `npm run db:test` | pgTAP RLS tests in `supabase/tests` |
| `npm run db:types` | Regenerate `src/lib/supabase/database.types.ts` |
| `npm run check` | lint + typecheck + unit tests |

## Granting the admin role

Platform roles can't be granted from the app (no RLS write policy exists by design). Use SQL as the
database owner, e.g. in the Supabase SQL editor:

```sql
insert into public.user_roles (user_id, role)
select id, 'admin' from auth.users where email = 'someone@example.com';
```

## Hosted Supabase checklist

1. Apply migrations: `npx supabase link --project-ref <ref>` then `npx supabase db push`.
2. Auth → URL configuration: Site URL = your domain; add `https://<domain>/auth/confirm` to redirect URLs.
3. Auth → Email templates: use the templates in `supabase/templates/` (token-hash links to `/auth/confirm`).
4. Auth → Providers → Email: enable "Confirm email"; minimum password length 8.
5. Configure a production SMTP provider (the built-in sender is rate limited).
6. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL` in hosting.
