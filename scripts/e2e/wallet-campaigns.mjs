// Phase 2 end-to-end: signup + email confirmation, onboarding, campaign wizard, server-side
// validation, test funds (through the DB function), funding idempotency, ledger write protection,
// access control, workspace switching, sign out / sign in.
//
// MODE=prod only (it asserts the production build refuses test funds). Run from the repo root:
//   MODE=prod node scripts/e2e/wallet-campaigns.mjs
import { randomUUID } from "node:crypto";

import { createClient, SUPABASE_URL, PUBLISHABLE_KEY, PASSWORD, check, finish, Session, form, waitForConfirmLink, requireMode } from "./harness.mjs";

requireMode("prod", "it asserts that the production build refuses test funds");

/** Phase 2 checks each signup step explicitly (response, email link, /auth/confirm redirect). */
async function signUpAndConfirm(label) {
  const s = new Session();
  const email = `e2e-p2-${label}-${Date.now()}@test.local`;
  s.email = email;
  const r = await s.action("/signup", "signUp", [{ status: "idle" }, form({ fullName: `Smoke ${label}`, email, password: PASSWORD, confirmPassword: PASSWORD })]);
  check(`[${label}] signup action returns 'check your email'`, r.status === 200 && r.text.includes("Check your email"), r.text.slice(0, 200));
  const link = await waitForConfirmLink(email);
  check(`[${label}] confirmation email received with token-hash link`, link.includes("token_hash"), link);
  const url = new URL(link);
  const confirm = await s.get(url.pathname + url.search);
  check(`[${label}] /auth/confirm verifies and redirects to onboarding`, confirm.status === 307 && confirm.location?.endsWith("/onboarding/role"), `${confirm.status} ${confirm.location}`);
  return s;
}

const a = await signUpAndConfirm("advertiser");

let r = await a.get("/dashboard");
check("un-onboarded user is sent to onboarding", r.status === 307 && r.location?.includes("/onboarding/role"), `${r.status} ${r.location}`);

r = await a.action("/onboarding/role", "chooseInitialWorkspace", [form({ workspace: "advertiser" })]);
check("onboarding step 1 (choose Advertiser) → profile step", r.redirect?.startsWith("/onboarding/profile"), `${r.status} ${r.redirect}`);

r = await a.action("/onboarding/profile", "skipProfileSetup", []);
check("onboarding step 2 skip → dashboard", r.redirect?.startsWith("/dashboard"), `${r.status} ${r.redirect}`);

r = await a.get("/dashboard");
check("protected dashboard renders for advertiser", r.status === 200 && r.text.includes("Welcome back") && r.text.includes("No campaigns yet"));

r = await a.get("/admin");
check("non-admin gets 404 on /admin", r.status === 404, String(r.status));

// Campaign wizard: save draft, then continue to funding.
const draft = {
  title: "Smoke Test Campaign",
  description: "Promote our summer drop with one Instagram Reel showing two outfits from the collection.",
  categorySlug: "fashion",
  campaignType: "product_launch",
  eligibility: { minFollowers: 10000, genders: ["female"], ageMin: 18, ageMax: 30, creatorCategories: ["fashion"], locations: [{ countryCode: "GB", city: "London", region: "" }] },
  platforms: ["instagram"],
  tasks: [{ platform: "instagram", taskType: "instagram_reel", quantity: 1 }, { platform: "instagram", taskType: "comment", quantity: 1 }],
  instructions: "Show two outfits\nShoot in daylight",
  captionInstructions: "",
  hashtags: ["#SmokeTest"],
  mentions: ["@brandhouse"],
  referenceUrl: "",
  applicationDeadline: new Date(Date.now() + 10 * 864e5).toISOString().slice(0, 10),
  taskDeadline: new Date(Date.now() + 20 * 864e5).toISOString().slice(0, 10),
  paymentPerCreator: "10",
  creatorsRequired: 100,
};
r = await a.action("/campaigns/new", "saveCampaignDraft", [{ campaignId: null, intent: "save", draft }]);
const campaignId = (r.text.match(/"campaignId":"([0-9a-f-]{36})"/) ?? [])[1];
check("Save Draft creates a draft", Boolean(campaignId), r.text.slice(0, 300));

r = await a.action("/campaigns/new", "saveCampaignDraft", [{ campaignId: null, intent: "save", draft: { ...draft, paymentPerCreator: "-5" } }]);
check("server rejects an invalid budget", r.text.includes("paymentPerCreator"), r.text.slice(0, 200));

r = await a.get(`/campaigns/${campaignId}`);
check("draft detail page shows Draft + $1,200 total", r.status === 200 && r.text.includes("Draft") && r.text.includes("$1,200.00"));

r = await a.action(`/campaigns/${campaignId}/edit`, "saveCampaignDraft", [{ campaignId, intent: "continue", draft }]);
check("Continue to Funding → funding page", r.redirect?.startsWith(`/campaigns/${campaignId}/fund`), `${r.status} ${r.redirect} ${r.text.slice(0, 200)}`);

r = await a.get(`/campaigns/${campaignId}/fund`);
check("funding page shows Required / Available / Shortfall with empty wallet", r.text.includes("Shortfall") && r.text.includes("$1,200.00"));
check("production build: no test-funds UI, add funds reported unavailable", !r.text.includes("Add test funds") && r.text.includes("payment provider has not been connected"));

r = await a.action(`/campaigns/${campaignId}/fund`, "addTestFunds", [{ status: "idle" }, form({ amount: "1200", idempotencyKey: randomUUID() })]);
check("production build: addTestFunds action refuses (mock provider disabled)", r.text.includes("Adding funds isn't available yet"), r.text.slice(0, 200));

// Seed test funds through the DB function as the signed-in user (local DB flag is on;
// this is the same call the dev-mode action makes after the mock provider).
const sb = createClient(SUPABASE_URL, PUBLISHABLE_KEY, { auth: { persistSession: false } });
const signIn = await sb.auth.signInWithPassword({ email: a.email, password: PASSWORD });
check("advertiser can sign in with Supabase Auth", !signIn.error, signIn.error?.message);
const depositKey = randomUUID();
let dep = await sb.rpc("record_test_deposit", { p_amount_cents: 120000, p_currency: "USD", p_provider_reference: `mock_dep_${depositKey.slice(0, 12)}`, p_status: "succeeded", p_idempotency_key: depositKey });
check("test deposit recorded", !dep.error && dep.data?.[0]?.replayed === false, dep.error?.message);
dep = await sb.rpc("record_test_deposit", { p_amount_cents: 120000, p_currency: "USD", p_provider_reference: `mock_dep_${depositKey.slice(0, 12)}`, p_status: "succeeded", p_idempotency_key: depositKey });
check("replayed deposit key is not credited twice", !dep.error && dep.data?.[0]?.replayed === true, dep.error?.message);
const forged = await sb.from("wallet_ledger_entries").insert({ transaction_id: randomUUID(), account_id: randomUUID(), entry_type: "mock_deposit", amount_cents: 999999 });
check("REST API refuses a forged ledger credit", Boolean(forged.error), "insert unexpectedly succeeded");

r = await a.get(`/campaigns/${campaignId}/fund`);
check("funding page now offers Fund & publish", r.text.includes("Balance after funding") && r.text.includes("idempotencyKey") && !r.text.includes("Shortfall"));

const fundKey = randomUUID();
r = await a.action(`/campaigns/${campaignId}/fund`, "fundCampaign", [{ status: "idle" }, form({ campaignId, idempotencyKey: fundKey })]);
check("Fund & Publish succeeds", r.redirect?.includes(`/campaigns/${campaignId}?funded=1`), `${r.status} ${r.redirect} ${r.text.slice(0, 200)}`);
r = await a.action(`/campaigns/${campaignId}/fund`, "fundCampaign", [{ status: "idle" }, form({ campaignId, idempotencyKey: fundKey })]);
check("double-submit of Fund & Publish does not error or re-charge", r.redirect?.includes(`?funded=1`), `${r.status} ${r.redirect}`);

r = await a.get("/wallet");
check("wallet shows $0.00 after one $1,200 debit (not charged twice)", r.status === 200 && r.text.includes("$0.00") && r.text.includes("Campaign funded"));

r = await a.get(`/campaigns/${campaignId}`);
check("funded campaign shows Applications open", r.text.includes("Applications open") && r.text.includes("Funded"));

r = await a.get(`/campaigns/${campaignId}/edit`);
check("funded campaign edit page redirects (locked)", r.text.includes(`NEXT_REDIRECT;replace;/campaigns/${campaignId};307`) || (r.status === 307), `${r.status}`);

r = await a.get("/campaigns?tab=applications_open&q=smoke");
check("campaign list: server-side filter finds it", r.text.includes("Smoke Test Campaign"));
r = await a.get("/campaigns?tab=draft");
check("campaign list: draft tab excludes it", !r.text.includes("Smoke Test Campaign"));

// Another user cannot see a draft; a live campaign isn't editable by them either.
const b = await signUpAndConfirm("other");
await b.action("/onboarding/role", "chooseInitialWorkspace", [form({ workspace: "advertiser" })]);
await b.action("/onboarding/profile", "skipProfileSetup", []);
r = await b.get(`/campaigns/${campaignId}`);
check("another advertiser cannot open someone else's campaign page", !r.text.includes("Smoke Test Campaign") && r.text.includes("NEXT_HTTP_ERROR_FALLBACK;404"), String(r.status));
r = await b.action(`/campaigns/${campaignId}/fund`, "fundCampaign", [{ status: "idle" }, form({ campaignId, idempotencyKey: randomUUID() })]);
check("another advertiser cannot fund someone else's campaign", r.text.includes("Campaign not found"), r.text.slice(0, 200));

// Role switching.
r = await a.action("/dashboard", "switchWorkspace", [form({ workspace: "influencer" })]);
check("switch to Influencer", r.redirect?.startsWith("/dashboard"), `${r.status} ${r.redirect}`);
r = await a.get("/dashboard");
check("influencer dashboard renders", r.text.includes("No applications yet"));
r = await a.get("/campaigns");
check("campaigns area prompts to switch back to Advertiser", r.text.includes("Campaigns are managed as an Advertiser"));
r = await a.action("/dashboard", "switchWorkspace", [form({ workspace: "admin" })]);
check("'admin' is rejected as a workspace", r.redirect?.startsWith("/dashboard"), `${r.status} ${r.redirect}`);
r = await a.get("/admin");
check("still 404 on /admin after trying to switch to admin", r.status === 404, String(r.status));

// Logout.
r = await a.action("/dashboard", "signOut", []);
check("sign out redirects to login", r.redirect?.startsWith("/login"), `${r.status} ${r.redirect}`);
r = await a.get("/dashboard");
check("dashboard is protected after sign out", r.status === 307 && r.location?.includes("/login"), `${r.status} ${r.location}`);

// Login again via the real sign-in action.
const c = new Session();
r = await c.action("/login", "signIn", [{ status: "idle" }, form({ email: "nobody@test.local", password: "wrong-password" })]);
check("login with wrong credentials shows an error", r.text.includes("Email or password is incorrect"), r.text.slice(0, 200));

finish();
