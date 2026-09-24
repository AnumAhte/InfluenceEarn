# InfluencEarn — Architecture

Status: **Phase 1 complete** (foundation: design system, landing, auth, profiles, role switching, app shell).

---

## 1. Design audit

Source files live in `design/` (extracted from the supplied zip). They are **references only**; no
exported HTML is used at runtime.

| File | Screens | Used in phase 1 for |
| --- | --- | --- |
| Design System | Colour, type, controls, states | Tokens only (see conflict rule) |
| Landing | Public marketing page | `/` |
| Auth | Sign up, role setup, login, reset, profile setup, role switcher, social gate, social settings | `/signup`, `/login`, `/forgot-password`, `/reset-password`, `/onboarding/*`, header switcher |
| Advertiser Dashboard | Sidebar + top bar shell, KPIs, campaign table | App shell layout |
| Campaigns, Create Campaign | List/detail, 4-step wizard | Phase 2 |
| Influencer | Marketplace, applications, tasks, submissions, wallet, social accounts | Phase 3 |
| Admin | Users, campaigns, task reviews, payouts, transactions, reports | Phase 4 (shell + guard now) |
| Wallet | Balance, top-up, history, withdrawals, rules | Phase 2/5 (behind provider abstraction) |

### Design tokens (extracted)

Defined once in `src/app/globals.css` (`@theme`), consumed as Tailwind utilities.

- Teal `#0E8494` (primary), `#0A5F6B` (hover), tints `#E7F5F7 / #D5EEF1 / #A9DAE1 / #82C8D2`
- Ink `#08201F`, label `#2E4644`, secondary `#4A6260`, muted `#5E7573`*, subtle `#93A6A4`
- Canvas `#F6F9F8`, surface `#FFFFFF`, surface-muted `#EFF4F3`, border `#E0E8E7`
- Night (sidebar/hero) `#0B2523`, `#123331`, `#061A19`
- Logo greens `#4E8A1E` / `#8FD14F`
- Success `#16A34A` (fg `#15803D`, bg `#DCFCE7`), warning `#D97706` (fg `#B45309`, bg `#FEF3C7`),
  danger `#DC2626` (fg `#B91C1C`, bg `#FEE2E2`, border `#FECACA`) — danger taken from the Design System file
- Radii: chip 8, nav 11, control 12, card 16, panel 20
- Shadows: `xs`, `primary`, `panel`, `popover`, `hero`, `selected` (values copied from the designs)
- Type: Plus Jakarta Sans (variable, weights 200–800 incl. the 550/650 used in the designs)

\* see accessibility adjustments below.

### Design / product conflicts and how they were resolved

| # | Where | Conflict | Resolution |
| --- | --- | --- | --- |
| 1 | Design System | Verified badges, auto-shortlisting, "Verified accounts only", 14-day trial | Ignored per brief; only tokens used |
| 2 | Landing hero | Product mock shows invented metrics and a "Reach delivered" chart (reach analytics is not a product feature) | Kept the mock, tagged **Example**, replaced chart with an example "Submitted work" list |
| 3 | Landing pricing | "Most popular" badge = unsupported popularity claim | Replaced with "Free to join" |
| 4 | Landing features | "Nothing here is on a roadmap" — untrue until phases 2–5 ship | Rephrased |
| 5 | Landing marketplace & earnings | Sample campaigns/earnings look real | Each tagged **Example** |
| 6 | Landing FAQ / footer | "We answer within a day", "Talk to the team", About/Careers/Blog/Terms/Privacy links, "New York · London · Berlin" | No contact channel, pages or offices exist yet → removed. **Terms/Privacy are a launch blocker** |
| 7 | Landing FAQ | "…you can select another applicant for the slot" | Deferred; replacement rules belong to phase 3 |
| 8 | Auth reset | "Expires in 30 minutes", "Open email app" | Expiry is Supabase-configured → neutral copy; button removed (unreliable) |
| 9 | Auth sign-up | "By creating an account you agree to our Terms and Privacy Policy" | Removed until those documents exist |
| 10 | Auth profile | City as fixed chips (New York … Peshawar) on desktop, free text on mobile | Free text everywhere (global product). Structured country/location is added in phase 3 for eligibility |
| 11 | Wallet | Visa/Mastercard/PayPal/Wise, "Cards are the only way in" | Not implemented; payment provider is undecided (see §5) |
| 12 | Top bar | Wallet balance chip, notification bell, "?" | Omitted until wallet (phase 2) and notifications (phase 3) exist — no fake balances |
| 13 | Sidebar | Links to unbuilt sections | Shown as disabled "Soon" items, not links to 404s |

### Accessibility adjustments

- Muted text `#6A817F` is 4.15:1 on white and 3.92:1 on `#F6F9F8` (fails WCAG AA for body text). The token
  was darkened to `#5E7573` (4.92 / 4.64). Visually near-identical.
- White text on `#0E8494` is 4.42:1 (below AA). Solid fills behind white text (primary buttons, badges) and
  small teal text use `primary-strong` `#0C7D8C` (4.85:1). `#0E8494` remains the brand/accent token for
  borders, focus rings, icons and decorative marks. (Approved after phase 1.)
- Global `:focus-visible` outline, skip links, labelled forms with `aria-invalid`/`aria-describedby`,
  Radix primitives for menus, tabs and the mobile drawer (focus trap, Escape, roles), `prefers-reduced-motion`.

---

## 2. Architecture

```
Browser ──► proxy.ts (session refresh + coarse route guard)
          ──► Server Components (read via Supabase, RLS as the user)
          ──► Server Actions (Zod validation → Supabase as the user → redirect/revalidate)
Supabase: Postgres (RLS on every table) · Auth · Storage (private buckets)
```

- **No separate backend.** Server Actions and Route Handlers are the API. Business rules live in pure
  domain modules (`src/domain`) and are enforced again in Postgres (constraints, RLS, and — from phase 2 —
  `SECURITY DEFINER` functions for state transitions and ledger writes).
- **The client is never trusted.** Every mutation re-validates input with Zod on the server. Admin status is
  derived from `user_roles` via `is_admin()`; the active workspace is a UI preference with no privileges.
- **Service-role key** is not used in phase 1 and must never be imported in client code. When needed
  (e.g. payout execution), it will live in a `server-only` module.

### Folder structure

```
src/
  app/                    routes only (thin): (auth), (app), admin, onboarding, auth/confirm
  components/ui/          design-system primitives (Button, Input, Field, Card, StatusBadge, …)
  components/brand/       Logo
  components/feedback/    error + loading bodies
  domain/                 pure business rules (money in cents, pricing) — unit tested
  features/
    auth/                 schemas, actions, error copy, forms
    account/              profile, onboarding, workspace (role) switching, queries
    shell/                AppShell, Sidebar nav, RoleSwitcher, UserMenu, MobileNav, navigation config
    dashboard/            dashboard widgets
    marketing/            landing page sections
  lib/                    env, supabase clients, route access rules, form helpers
  proxy.ts                Next 16 proxy (formerly middleware)
supabase/
  migrations/             SQL, applied in order
  tests/database/         pgTAP RLS tests (npm run db:test)
  templates/              auth email templates (token-hash links)
```

### Routes (phase 1)

| Route | Access | Notes |
| --- | --- | --- |
| `/` | public | Landing |
| `/signup`, `/login`, `/forgot-password` | guests only | Signed-in users → `/dashboard` |
| `/reset-password` | recovery session | Signed-out → `/forgot-password` |
| `/auth/confirm` | public | Verifies email-link `token_hash` (or PKCE `code`), then safe-redirects |
| `/onboarding/role`, `/onboarding/profile` | signed in | Step 1 choose workspace, step 2 profile (skippable) |
| `/dashboard` | signed in + onboarded | Role-aware home (advertiser / influencer) |
| `/settings/profile` | signed in + onboarded | Edit profile + photo |
| `/admin` | admin only | 404 for everyone else |

---

## 3. Data model

### Phase 1 (implemented) — `supabase/migrations/20260924090000_identity_and_roles.sql`

- `profiles` (1:1 `auth.users`): name, phone, city, bio, `avatar_path`, `active_workspace`
  (`workspace_role` enum), onboarding timestamps. Check constraints on every free-text column; the avatar
  path must be inside the owner's folder.
- `user_roles` (`user_id`, `platform_role` enum = `admin`, `granted_by`, `granted_at`).
- `is_admin()`, `has_platform_role()` — `SECURITY DEFINER`, `search_path = ''`.
- `handle_new_user()` trigger creates the profile on sign-up.
- Storage bucket `avatars` — private, JPG/PNG, 2 MB, served via 1-hour signed URLs.

**Privileges & RLS**

| Table | anon | authenticated | Policies |
| --- | --- | --- | --- |
| profiles | none | `SELECT`; `UPDATE` only on editable columns | read own; admin reads all; update own |
| user_roles | none | `SELECT` | read own; admin reads all; **no write policies** |
| storage.objects (`avatars`) | none | per policy | owner read/insert/update/delete in `<uid>/…`; admin read |

Covered by `supabase/tests/database/identity_rls.test.sql` (16 assertions).

### Planned (phases 2–5)

Normalised design; names may change as each phase is built.

- **Social:** `social_accounts` (user, platform enum, handle, profile_url, follower_count *self-reported*,
  `connection_status`, provider metadata) — unique (user, platform). OAuth via a `SocialAccountProvider`
  interface; no fake "connected" state.
- **Campaigns:** `campaigns` (owner, status enum, dates, `payment_per_creator_cents`, `creators_required`,
  fee bps snapshot), `campaign_platforms`, `campaign_tasks` (task type enum + `proof_requirements`),
  `campaign_requirements` (min followers, gender, age range, location, category).
  Status machine: `draft → payment_pending → published/applications_open → selection_in_progress →
  in_progress → review_pending → completed | cancelled`, enforced by a DB function + trigger.
- **Applications:** `campaign_applications` (campaign, creator, social_account, status
  `pending|shortlisted|selected|rejected`), unique (campaign, creator). Indexes on
  (campaign_id, status, created_at), (creator_id, status), trigram index for search; keyset pagination.
- **Work:** `task_submissions` (`in_progress|submitted|approved|rejected|payout_pending|paid`, URLs,
  comment text, attempt number) and `task_reviews` (decision, reason, reviewer).
- **Money:** `wallet_accounts`, append-only `wallet_ledger_entries` (double-entry, `amount_cents bigint`,
  `idempotency_key` unique), `campaign_funding`, `payment_transactions`, `payouts`
  (`ready|processing|paid|failed|on_hold`). Balances are derived views, never the source of truth.
- **Ops:** `notifications` (type enum, payload jsonb, read_at, `email_status` for future email delivery),
  `admin_activity_logs` (actor, action, target, before/after jsonb).

---

## 4. Money rules (already encoded)

`src/domain/money.ts`, `src/domain/pricing.ts`:

- Integer cents only (`Cents` branded type). Fees in basis points (`PLATFORM_FEE_BASIS_POINTS = 2000`).
- `creatorBudget = creators × paymentPerCreator`, `platformFee = round(20% × creatorBudget)` (half away from
  zero, BigInt maths), `totalFunding = creatorBudget + platformFee`.
- The landing page's worked example is computed from these functions, not hard-coded.

## 5. Payments — provider abstraction (phase 2+)

The provider is **not selected** (Fasset or another). Nothing in phase 1 moves or pretends to move money.

Planned interfaces (`src/features/payments/providers/`):

- `WalletFundingProvider` — `createDeposit`, `getDepositStatus`, webhook verification
- `PaymentProvider` — generic charge/refund primitives if the chosen provider needs them
- `PayoutProvider` — `createPayout`, `getPayoutStatus`
- `MockProvider` — dev/test only, refuses to load when `NODE_ENV=production`; mock ledger entries are
  flagged `is_test = true` and excluded from real balances.

Campaign funding debits the internal ledger atomically in a DB function (idempotent), so swapping
providers never touches campaign logic. No "escrow" wording anywhere.
