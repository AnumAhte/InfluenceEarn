# InfluencEarn — Architecture

Status: **Phase 4 complete** (work submissions, advertiser reviews, campaign lifecycle, read-only payout queue). Phase 3: social accounts, eligibility, applications. Phase 2: campaigns + wallet. Phase 1: foundation.

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
| Campaigns, Create Campaign | List/detail, 4-step wizard | `/campaigns`, `/campaigns/new`, `/campaigns/[id]`, `/edit`, `/fund` (phase 2) |
| Influencer | Marketplace, applications, tasks, submissions, wallet, social accounts | `/discover`, `/discover/[id]`, `/applications`, `/settings/social`, `/settings/creator` (phase 3); tasks/submissions phase 4 |
| Admin | Users, campaigns, task reviews, payouts, transactions, reports | Phase 4 (shell + guard now) |
| Wallet | Balance, top-up, history, withdrawals, rules | `/wallet` balance + history (phase 2); top-ups/withdrawals need a real provider |

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
| 14 | Create Campaign | Step 3 "Proof & dates" with screenshot / insights proofs | Step 3 is "Instructions & dates"; proof is derived per task type; screenshots never required |
| 15 | Create Campaign | "X" platform; card/bank/PayPal funding sources | 4 platforms only; wallet is the only funding source |
| 16 | Campaigns list | Applications / Selected columns, Pause, Duplicate, Delete | No application data yet → columns omitted; only Edit / Fund / Cancel (pre-funding) exist |
| 17 | Wallet | Cards on file, withdrawals, "held/reserved" copy, receipts | Not built; balance described as derived from transaction history, never as custody/escrow |
| 18 | Campaign detail | "Remove selection" on selected applicants | Selection is final in phase 3 (spec: Pending → Shortlist → Select or Reject) |
| 19 | Sidebar | Global "Applicants" item | Applicants are reviewed per campaign (`/campaigns/[id]/applicants`); the global item was removed |
| 20 | Influencer | Media kit upload, portfolio links, payment range / task type filters | Not built in phase 3 |

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

---

## 6. Phase 2 — campaigns + wallet foundation

### Decisions

- **Postgres is the authority for money and state.** Status changes and every ledger write happen in
  `SECURITY DEFINER` functions; clients have no write grants on financial tables and no grant on
  `campaigns.status`. TypeScript mirrors the rules (`src/domain/campaigns/state-machine.ts`,
  `src/domain/wallet/ledger.ts`) for UI and unit tests.
- **Atomic draft saves.** `save_campaign_draft` (SECURITY INVOKER, so RLS applies) writes the campaign and
  replaces its child rows in one transaction.
- **Funding in one database transaction.** `fund_and_publish_campaign` locks the campaign and wallet rows,
  recomputes the total, checks the balance, posts a balanced journal, records `campaign_funding`, and moves
  `funding_required → published → applications_open`.
- **Idempotency.** One `campaign_funding` row per campaign (unique), per-user unique idempotency keys on
  journal and payment rows, row locks to serialise concurrent requests. A retry returns `already_funded`.
- **Deadlines** are stored as timestamps at 23:59:59 UTC of the chosen date.

### Campaign state machine

`draft → funding_required → published → applications_open → selection_in_progress → in_progress ⇄ review_pending → completed`;
`draft | funding_required → cancelled`; `funding_required → draft`. Enforced by the `campaigns_guard_update`
trigger (`campaign_transition_allowed`). Content and budget are frozen once funded (trigger + RLS). Cancelling
a funded campaign is refused until a refund flow exists.

### Tables (added)

`creator_categories`, `campaign_task_type_rules` (reference data) · `campaigns` · `campaign_platforms` ·
`campaign_tasks` (FK to campaign and to (campaign, platform)) · `campaign_requirements` (1:1) ·
`campaign_creator_categories` · `campaign_locations` (ISO country + optional region/city) ·
`campaign_status_events` · `platform_settings` · `wallet_accounts` (user wallet, campaign reserve, platform
revenue, provider clearing) · `payment_transactions` · `ledger_transactions` · `wallet_ledger_entries` ·
`campaign_funding` · views `wallet_account_balances`, `wallet_statement` (security_invoker).

### Ledger

Double entry: each `ledger_transactions` row has entries that sum to 0 (deferred constraint trigger,
`SECURITY DEFINER` so it sees system accounts). Entries and journal rows are append-only (trigger rejects
UPDATE/DELETE for everyone). Entry types in use: `mock_deposit`, `campaign_funding_debit`,
`campaign_funding_reserve`, `platform_fee`.

| Operation | User wallet | Other account |
| --- | --- | --- |
| Test deposit (dev only) | +amount | mock provider clearing −amount |
| Fund campaign | −(budget + fee) | campaign reserve +budget, platform revenue +fee |

### Mock provider safeguards

1. `getWalletFundingProvider()` returns `null` when `NODE_ENV=production` (no real provider yet).
2. `MockWalletFundingProvider` throws on construction and on execution in production.
3. `record_test_deposit` refuses unless `platform_settings.test_funds_enabled` is true; that flag is only set
   by `supabase/seed.sql`, which runs on local resets, never on hosted projects.
4. Rows are flagged `is_test`; the UI labels test funds "Development only".

### Verification (phase 2)

- pgTAP: 60 assertions (16 phase 1 + 44 phase 2), run locally against Postgres.
- Vitest: 81 unit tests.
- End-to-end HTTP smoke test against the production build + local Supabase (signup → email confirm →
  onboarding → campaign draft → funding → wallet → role switch → sign out; cross-user and admin checks):
  40/40. It found a real bug (the balanced-journal trigger ran under RLS at commit), fixed in the migration and
  now covered by pgTAP.

---

## 7. Phase 3 — social accounts, eligibility, applications, notifications

### Decisions

- **Manual social linking only.** Creators enter a handle (or a profile link on the platform's own domain) and a
  follower count. Stored as `connection_method = manual`, `verification_status = unverified`; clients have no
  grant on the verification columns. The profile URL is always derived from the handle
  (`social_profile_url`), so links shown to advertisers point only at instagram.com / tiktok.com /
  facebook.com / youtube.com. `SocialAccountProvider` exists for future OAuth; nothing simulates it.
- **One eligibility implementation**: `_campaign_eligibility_issues(campaign, user)` in Postgres. The apply
  function enforces it; discovery (badges + "Eligible only") and the campaign page display it. TypeScript only
  maps issue codes to copy (`src/domain/creators/eligibility.ts`).
- **Private creator details.** Country, date of birth, gender and categories live in `creator_profiles`
  (owner/admin only). Each application stores a snapshot (name, city, country, age, gender, categories, social
  handles + follower counts at apply time) — advertisers see the snapshot, never the date of birth.
- **Manual selection.** `decide_application` (owner-only) handles shortlist / unshortlist / select / reject /
  reconsider; selecting locks the campaign row and refuses beyond `creators_required`. Selection is final.
- **Notifications** are rows created inside the same transaction as the event (`_notify`), with
  `email_status` so an email worker can deliver them later.

### Eligibility rules

| Requirement | Rule | Issue codes |
| --- | --- | --- |
| Platforms | A connected account on every campaign platform | `missing_platform:<platform>` |
| Minimum followers | Each required account's self-reported count ≥ minimum | `followers_below_minimum:<platform>` |
| Gender | Creator's gender in the allowed list | `gender_not_set`, `gender_mismatch` |
| Age | Age from date of birth within range | `age_not_set`, `age_out_of_range` |
| Categories | At least one shared category | `category_not_set`, `category_mismatch` |
| Location | Same country; city must match when the campaign sets one | `location_not_set`, `location_mismatch` |

Also enforced on apply: campaign is `applications_open` and before its deadline, not the creator's own
campaign, one application per creator.

### Tables and functions (added)

`creator_profiles`, `creator_profile_categories`, `social_accounts`, `campaign_applications`,
`application_social_accounts`, `campaign_application_events`, `notifications`. Functions:
`save_creator_profile`, `my_campaign_eligibility`, `discover_campaigns`, `campaign_advertiser_name`,
`apply_to_campaign`, `decide_application`, `close_campaign_applications`, `campaign_application_counts`,
`mark_notifications_read`. Indexes cover applicants by (campaign, status, date), by followers, by creator, and
trigram search on name + handles.

### RLS (added)

- `creator_profiles` / categories: owner reads and writes; admin reads. Advertisers: nothing.
- `social_accounts`: owner reads, links, updates handle/followers/status; no delete (disconnect keeps history).
- `campaign_applications` (+ social snapshots, events): creator reads own; campaign owner reads applications to
  their campaigns; admin reads all. **No client writes** — only the functions above.
- `campaigns`: applicants keep read access to campaigns they applied to after applications close.
- `notifications`: recipient reads own; marked read only through `mark_notifications_read`.

### Verification (phase 3)

- pgTAP: 99 assertions total (39 new).
- Vitest: 100 unit tests.
- End-to-end (production build + local Supabase): 40/40 for phase 3 and the phase 2 suite re-run 40/40.

---

## 8. Phase 4 — work submissions and advertiser reviews

### Flow

`selected` (application) → assignment `in_progress` → creator submits → `submitted` →
advertiser **approves** → `approved` (ready for payout; admins notified) **or rejects with a reason** →
`revision_requested` (resubmission allowed, before the deadline, max 3 attempts) or `rejected` (final).
When the campaign is completed, unfinished past-deadline work becomes `expired`. `payout_pending` / `paid` are
reserved for phase 5.

Campaign lifecycle: close applications → `selection_in_progress` → **Start campaign work** → `in_progress` ⇄
`review_pending` (automatic while any submission awaits review) → **Mark campaign complete** → `completed`
(blocked while anything awaits review or can still be submitted).

### Decisions

- **One assignment per selected creator**, created inside `decide_application`; snapshots reward and deadline.
- **One submission covers every campaign task.** Proof per task comes from `campaign_task_type_rules`:
  links must be `https://` on the task platform's own domain (`proof_url_matches_platform`), comment tasks
  need the comment text, follow tasks need nothing (any link sent is discarded). Screenshots are never
  required. The TypeScript mirror (`src/domain/tasks/proof.ts`) gives instant feedback; SQL decides.
- **Reviews are owner-only and final per submission.** Rejection requires a reason; the advertiser chooses
  whether the creator may resubmit.
- **Notifications:** task submitted → advertiser; changes requested / rejected / approved → creator; approved
  → every admin (`payout_ready`). Admins added later see approved work in the queue, not past notifications.
- **Admin payout queue is read-only** until a payment provider exists.

### Tables and functions (added)

`campaign_assignments`, `task_submissions`, `task_submission_items`, `task_reviews`. Functions:
`submit_task_completion`, `review_task_submission`, `start_campaign_work`, `complete_campaign`,
`campaign_assignment_counts`, `proof_url_matches_platform`; `decide_application` now creates assignments;
`campaign_transition_allowed` adds `in_progress → completed`.

### RLS (added)

Assignments, submissions, items and reviews: the creator, the campaign owner and admins can read; **nobody
writes directly** — only the functions above. A creator cannot review (approve) their own work; other
advertisers see nothing.

### Verification (phase 4)

- pgTAP: 136 assertions total (37 new).
- Vitest: 108 unit tests.
- End-to-end (production build + local Supabase): phase 4 flow 34/34; phase 2 and phase 3 suites re-run 40/40 each.
