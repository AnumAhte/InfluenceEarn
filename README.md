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

## Notification emails

In-app notifications are queued for email by the database. `POST /api/internal/notification-emails`
(header `Authorization: Bearer $EMAIL_WORKER_SECRET`) sends up to 20 queued emails over SMTP and records
each result. It only processes queued notification rows — it can't send arbitrary email.

- Statuses: `pending` → `sent` (the SMTP server **accepted** it — not proof of inbox delivery), `failed`
  (5 attempts, backoff 1/2/4/8 min) or `skipped` (opted out, unconfirmed email, or suspended).
- Delivery is at-least-once: a crash between SMTP acceptance and recording can resend after the 2-minute lease.
- Locally, `.env.local` points SMTP at Mailpit (`127.0.0.1:54325`, view at http://127.0.0.1:54324). Trigger a run:
  `curl -X POST -H "Authorization: Bearer $EMAIL_WORKER_SECRET" http://localhost:3000/api/internal/notification-emails`
- Production: set `SUPABASE_SECRET_KEY`, the `SMTP_*` variables, `EMAIL_FROM` and `EMAIL_WORKER_SECRET` (see
  `.env.example`), and call the endpoint from a scheduler every minute (e.g. Vercel Cron, or Supabase `pg_cron` +
  `pg_net`). Without SMTP configured the endpoint returns 503 and emails stay `pending`.

## Rate limits

- **Data API writes** (every `POST`/`PATCH`/`DELETE` by a signed-in user, from server actions or directly) are
  counted per user and endpoint in the database's PostgREST pre-request hook: 120/min by default, stricter
  per-endpoint rules in `rate_limit_rules` (e.g. 30 applications/hour). Over the limit → HTTP 429 `rate_limited`.
- **Sign-in / sign-up / password reset / password and email changes / uploads** are limited in the app
  (`src/lib/rate-limit.ts`) by client IP, email or user, through `check_rate_limit` (service-role only).
  These calls reach Supabase Auth from the server, so Supabase's own per-IP limits see the server's IP.
- Requires `SUPABASE_SECRET_KEY`; without it the app-level limits are disabled (logged at startup).
- Per-IP limits trust `TRUSTED_IP_HEADER` (default `x-forwarded-for`); deploy behind a proxy that sets it.

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
