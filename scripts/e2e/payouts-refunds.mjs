// Phase 5 end-to-end: admin payout queue, hold, release, activity log, unused-budget refund and
// settlement idempotency — through the real server actions against a local Supabase.
//
//   MODE=prod: against `next build && next start -p 3100` — release must be refused (no provider).
//   MODE=dev:  against `next dev -p 3100` — full release through the development-only mock provider.
//
// Needs: local Supabase running (npx supabase start) with seed.sql applied, Mailpit on :54324.
// Run from the repo root: MODE=prod node scripts/e2e/payouts-refunds.mjs
import { randomUUID } from "node:crypto";

import { createClient, MODE, SUPABASE_URL, PUBLISHABLE_KEY, PASSWORD, check, finish, form, newUser, psql, sameCampaign, isNotFound } from "./harness.mjs";

// ── Phase 5 end-to-end: payout queue, hold, release (dev only), activity log, refund ──
console.log(`mode: ${MODE}`);

const adv = await newUser("adv5", "advertiser", "Brand Owner");
const draft = {
  title: "Phase5 Payout Campaign",
  description: "Promote our summer drop with one Instagram Reel showing two outfits from the collection.",
  categorySlug: "fashion", campaignType: "product_launch",
  eligibility: { minFollowers: null, genders: [], ageMin: null, ageMax: null, creatorCategories: [], locations: [] },
  platforms: ["instagram"],
  tasks: [{ platform: "instagram", taskType: "instagram_reel", quantity: 1 }],
  instructions: "Tag the brand", captionInstructions: "", hashtags: [], mentions: [], referenceUrl: "",
  applicationDeadline: new Date(Date.now() + 10 * 864e5).toISOString().slice(0, 10),
  taskDeadline: new Date(Date.now() + 20 * 864e5).toISOString().slice(0, 10),
  paymentPerCreator: "40", creatorsRequired: 2,
};
let r = await adv.action("/campaigns/new", "saveCampaignDraft", [{ campaignId: null, intent: "save", draft }]);
const campaignId = (r.text.match(/"campaignId":"([0-9a-f-]{36})"/) ?? [])[1];
await adv.action(`/campaigns/${campaignId}/edit`, "saveCampaignDraft", [{ campaignId, intent: "continue", draft }]);
const sb = createClient(SUPABASE_URL, PUBLISHABLE_KEY, { auth: { persistSession: false } });
await sb.auth.signInWithPassword({ email: adv.email, password: PASSWORD });
const key = randomUUID();
await sb.rpc("record_test_deposit", { p_amount_cents: 9600, p_currency: "USD", p_provider_reference: `mock_${key.slice(0, 12)}`, p_status: "succeeded", p_idempotency_key: key });
r = await adv.action(`/campaigns/${campaignId}/fund`, "fundCampaign", [{ status: "idle" }, form({ campaignId, idempotencyKey: randomUUID() })]);
check("campaign funded ($80 budget + $16 fee)", r.redirect?.includes("funded=1"), r.text);

// Only one of the two creator slots is filled, so $40 of budget stays unused.
const cre = await newUser("cre5", "influencer", "Bilal Creator");
await cre.action("/settings/social", "connectSocialAccount", [{ status: "idle" }, form({ platform: "instagram", handle: "bilal.five", followerCount: "9000" })]);
await cre.action(`/discover/${campaignId}`, "applyToCampaign", [{ status: "idle" }, form({ campaignId, pitch: "" })]);
r = await adv.get(`/campaigns/${campaignId}/applicants`);
const applicationId = (r.text.match(/name="applicationId" value="([0-9a-f-]{36})"/) ?? [])[1];
await adv.action(`/campaigns/${campaignId}/applicants`, "decideApplication", [{ status: "idle" }, form({ applicationId, campaignId, action: "select" })]);
await adv.action(`/campaigns/${campaignId}`, "closeApplications", [form({ campaignId })]);
r = await adv.action(`/campaigns/${campaignId}`, "startCampaignWork", [form({ campaignId })]);
check("work started with one selected creator", sameCampaign(r.redirect, campaignId), r.redirect);

r = await cre.get("/tasks");
const assignmentId = (r.text.match(/href="\/tasks\/([0-9a-f-]{36})"/) ?? [])[1];
r = await cre.get(`/tasks/${assignmentId}`);
const reelId = (r.text.match(/name="url:([0-9a-f-]{36})"/) ?? [])[1];
r = await cre.action(`/tasks/${assignmentId}`, "submitWork", [{ status: "idle" }, form({ assignmentId, [`url:${reelId}`]: "https://www.instagram.com/reel/p5/" })]);
check("creator submits the reel", r.redirect?.includes("submitted=1"), `${r.redirect} ${r.text}`);
r = await adv.get(`/campaigns/${campaignId}/submissions?status=submitted`);
const submissionId = (r.text.match(/name="submissionId" value="([0-9a-f-]{36})"/) ?? [])[1];
r = await adv.action(`/campaigns/${campaignId}/submissions`, "reviewSubmission", [{ status: "idle" }, form({ submissionId, campaignId, decision: "approved", reason: "" })]);
check("advertiser approves", !r.text.includes('"status":"error"'), r.text);

// ── Admin queue ──
const admin = await newUser("admin5", "advertiser", "Agency Admin");
psql(`insert into public.user_roles (user_id, role) select id, 'admin' from auth.users where email = '${admin.email}'`);
r = await admin.get("/admin");
check("admin dashboard shows payout counts", r.text.includes("Ready for payout") && r.text.includes("/admin/payouts"));
r = await admin.get("/admin/payouts");
check("queue lists the approved work with its proof link", r.text.includes("Bilal Creator") && r.text.includes("$40.00") && r.text.includes("https://www.instagram.com/reel/p5/"));
if (MODE === "prod") {
  check("production: no provider callout shown", r.text.includes("No payout provider is connected"));
} else {
  check("development: mock-provider warning shown", r.text.includes("No real money moves"));
}

r = await cre.get("/admin/payouts");
check("non-admin gets 404 on /admin/payouts", isNotFound(r), r.status);
r = await cre.action("/admin/payouts", "releasePayout", [{ status: "idle" }, form({ assignmentId })]);
check("non-admin cannot release a payout", !r.text.includes("Payment released") && (r.text.includes("Only agency admins") || isNotFound(r)), r.text.slice(0, 300));
r = await cre.action("/admin/payouts", "holdPayout", [{ status: "idle" }, form({ assignmentId, reason: "nope" })]);
check("non-admin cannot hold a payout", !r.text.includes("put on hold") && (r.text.includes("Only agency admins") || isNotFound(r)), r.text.slice(0, 300));

// ── Hold ──
r = await admin.action("/admin/payouts", "holdPayout", [{ status: "idle" }, form({ assignmentId, reason: "" })]);
check("hold without a reason is refused", r.text.includes("Add a reason"), r.text.slice(0, 300));
r = await admin.action("/admin/payouts", "holdPayout", [{ status: "idle" }, form({ assignmentId, reason: "Checking the reel is still live" })]);
check("admin puts the payout on hold", r.text.includes("Payout put on hold"), r.text.slice(0, 300));
r = await admin.get("/admin/payouts?tab=on_hold");
check("On hold tab shows the item and the reason", r.text.includes("Bilal Creator") && r.text.includes("Checking the reel is still live"));

// ── Release ──
r = await admin.action("/admin/payouts", "releasePayout", [{ status: "idle" }, form({ assignmentId })]);
if (MODE === "prod") {
  check("production refuses to release (no provider)", r.text.includes("No payout provider is connected"), r.text.slice(0, 300));
  check("nothing was paid", psql(`select count(*) from public.payouts where assignment_id = '${assignmentId}' and status = 'paid'`) === "0");
} else {
  check("admin releases the payment (mock provider)", r.text.includes("Payment released"), r.text.slice(0, 300));
  r = await admin.action("/admin/payouts", "releasePayout", [{ status: "idle" }, form({ assignmentId })]);
  check("releasing again is refused (already paid)", r.text.includes("already been paid"), r.text.slice(0, 300));
  check("exactly one payout ledger transaction", psql(`select count(*) from public.ledger_transactions where kind = 'creator_payout' and campaign_id = '${campaignId}'`) === "1");
  r = await admin.get("/admin/payouts?tab=paid");
  check("Paid tab shows the item with a provider reference", r.text.includes("Bilal Creator") && r.text.includes("mock_po_"));
  r = await cre.get("/wallet");
  check("creator wallet shows earning and paid-out entries", r.text.includes("Campaign earning") && r.text.includes("Paid out"));
  r = await cre.get("/notifications");
  check("creator notified: Payment released", r.text.includes("Payment released"));
  r = await cre.get("/tasks?view=completed");
  check("creator task shows Paid", r.text.includes("Paid"));
}

r = await admin.get("/admin/activity");
check("activity log records the hold", r.text.includes("Put payout on hold") && r.text.includes("Checking the reel is still live"));
if (MODE === "dev") check("activity log records release and paid", r.text.includes("Released payout") && r.text.includes("Payout paid"));
r = await cre.get("/admin/activity");
check("non-admin gets 404 on /admin/activity", isNotFound(r), r.status);

// ── Completion refunds the unused creator budget (fee kept) ──
r = await adv.action(`/campaigns/${campaignId}`, "completeCampaign", [form({ campaignId })]);
check("advertiser completes the campaign", sameCampaign(r.redirect, campaignId), r.redirect);
r = await adv.get(`/campaigns/${campaignId}`);
check("campaign page shows the $40 refund and that the fee is kept", r.text.includes("$40.00") && r.text.includes("unused creator budget was returned") && r.text.includes("platform fee isn"));
r = await adv.get("/wallet?filter=refunds");
check("advertiser wallet shows the refund entry", r.text.includes("Unused budget refunded") && /\+(<!-- -->)?\$40\.00/.test(r.text));
r = await adv.get("/notifications");
check("advertiser notified: Unused budget refunded", r.text.includes("Unused budget refunded"));
// ── Settlement idempotency: completing / settling twice must not refund twice ──
const refundCount = () => psql(`select count(*) from public.ledger_transactions where kind = 'campaign_refund' and campaign_id = '${campaignId}'`);
const advBalance = () => psql(`select balance_cents from public.wallet_account_balances where kind = 'user_wallet' and owner_id = (select id from auth.users where email = '${adv.email}')`);
const balanceAfterFirst = advBalance();
check("exactly one refund transaction after completion", refundCount() === "1", refundCount());
r = await adv.action(`/campaigns/${campaignId}`, "completeCampaign", [form({ campaignId })]);
check("completing the campaign a second time is a harmless no-op", sameCampaign(r.redirect, campaignId), r.redirect);
check("settlement run again directly returns 0", psql(`select public._refund_unused_budget('${campaignId}')`) === "0");
check("still exactly one refund transaction", refundCount() === "1", refundCount());
check("advertiser balance unchanged by the repeat attempts", advBalance() === balanceAfterFirst, `${balanceAfterFirst} -> ${advBalance()}`);

const expectedReserve = MODE === "dev" ? "0" : "4000";
check(`campaign reserve holds ${expectedReserve === "0" ? "nothing" : "only the unpaid $40"}`,
  psql(`select coalesce(sum(e.amount_cents),0) from public.wallet_ledger_entries e join public.wallet_accounts a on a.id = e.account_id where a.kind = 'campaign_reserve' and a.campaign_id = '${campaignId}'`) === expectedReserve);

finish();
