// Phase 5 end-to-end (MODE=dev only): failed payout → retry → paid.
// Verifies a failed attempt books nothing, the retry books exactly one payout transaction, the creator
// is credited once, and concurrent/repeated release attempts cannot double-pay.
// Uses the mock provider rule "amounts ending in .14 fail on the first attempt only".
//
// Needs: `next dev -p 3100`, local Supabase with seed.sql applied, Mailpit on :54324.
// Run from the repo root: MODE=dev node scripts/e2e/payout-retry.mjs
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const ROOT = resolve(process.cwd());

const require = createRequire(resolve(ROOT, "package.json"));
const { createClient } = require("@supabase/supabase-js");
const APP = "http://localhost:3100";
const MAILPIT = "http://127.0.0.1:54324";
const SUPABASE_URL = "http://127.0.0.1:54321";
const KEY = "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";
const PASSWORD = "correct-horse-9";
const MODE = process.env.MODE ?? "prod";
const MANIFEST = MODE === "dev" ? resolve(ROOT, ".next/dev/server/server-reference-manifest.json") : resolve(ROOT, ".next/server/server-reference-manifest.json");
let ACTION = {};
const loadActions = () => { try { const m = JSON.parse(readFileSync(MANIFEST, "utf8")); ACTION = Object.fromEntries(Object.entries(m.node).map(([id, v]) => [v.exportedName, id])); } catch {} };
loadActions();

let passed = 0, failed = 0;
const check = (name, ok, detail = "") => {
  if (ok) { passed++; console.log(`PASS  ${name}`); } else { failed++; console.log(`FAIL  ${name}  ${String(detail).slice(0, 300)}`); }
};

class Session {
  jar = new Map();
  store(res) {
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(";");
      const i = pair.indexOf("=");
      const name = pair.slice(0, i), value = pair.slice(i + 1);
      if (value === "" || /max-age=0/i.test(c)) this.jar.delete(name); else this.jar.set(name, value);
    }
  }
  cookie() { return [...this.jar].map(([k, v]) => `${k}=${v}`).join("; "); }
  async get(path) {
    const res = await fetch(APP + path, { redirect: "manual", headers: { cookie: this.cookie() } });
    this.store(res);
    return { status: res.status, location: res.headers.get("location"), text: await res.text() };
  }
  async action(page, name, args) {
    if (!ACTION[name]) { await this.get(page); loadActions(); }
    const id = ACTION[name];
    if (!id) throw new Error(`No action ${name}`);
    let body; const headers = { "Next-Action": id, cookie: this.cookie(), Accept: "text/x-component" };
    const formIndex = args.findIndex((a) => a instanceof FormData);
    if (formIndex === -1) { body = JSON.stringify(args); headers["Content-Type"] = "text/plain;charset=UTF-8"; }
    else {
      body = new FormData();
      for (const [k, v] of args[formIndex].entries()) body.append(`_1_${k}`, v);
      body.append("0", JSON.stringify(args.map((a, i) => (i === formIndex ? "$K1" : a))));
    }
    const res = await fetch(APP + page, { method: "POST", redirect: "manual", headers, body });
    this.store(res);
    return { status: res.status, redirect: res.headers.get("x-action-redirect"), text: await res.text() };
  }
}
const form = (obj) => { const f = new FormData(); for (const [k, v] of Object.entries(obj)) { if (Array.isArray(v)) v.forEach((x) => f.append(k, x)); else f.append(k, v); } return f; };

async function newUser(label, workspace, fullName) {
  const s = new Session();
  s.email = `p5-${label}-${Date.now()}@test.local`;
  await s.action("/signup", "signUp", [{ status: "idle" }, form({ fullName, email: s.email, password: PASSWORD, confirmPassword: PASSWORD })]);
  let link;
  for (let i = 0; i < 20 && !link; i++) {
    const search = await (await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent("to:" + s.email)}`)).json();
    const id = search.messages?.[0]?.ID;
    if (id) link = ((await (await fetch(`${MAILPIT}/api/v1/message/${id}`)).json()).HTML.match(/href="([^"]*auth\/confirm[^"]*)"/) ?? [])[1];
    if (!link) await new Promise((r) => setTimeout(r, 500));
  }
  const url = new URL(link.replace(/&amp;/g, "&"));
  await s.get(url.pathname + url.search);
  await s.action("/onboarding/role", "chooseInitialWorkspace", [form({ workspace })]);
  await s.action("/onboarding/profile", "skipProfileSetup", []);
  const r = await s.get("/dashboard");
  check(`[${label}] signed up, confirmed and onboarded as ${workspace}`, r.status === 200, r.status);
  return s;
}


import { execFileSync } from "node:child_process";
const psql = (sql) => execFileSync("docker", ["exec", "supabase_db_influencearn", "psql", "-U", "postgres", "-tAc", sql], { encoding: "utf8" }).trim();

// ── Phase 5b (dev only): failed payout → retry → paid, and no double pay ──
if (MODE !== "dev") { console.log("payout-retry.mjs needs MODE=dev (the mock payout provider is refused in production)"); process.exit(1); }

const adv = await newUser("adv5b", "advertiser", "Brand Owner");
const draft = {
  title: "Phase5 Retry Campaign",
  description: "Promote our summer drop with one Instagram Reel showing two outfits from the collection.",
  categorySlug: "fashion", campaignType: "product_launch",
  eligibility: { minFollowers: null, genders: [], ageMin: null, ageMax: null, creatorCategories: [], locations: [] },
  platforms: ["instagram"],
  tasks: [{ platform: "instagram", taskType: "instagram_reel", quantity: 1 }],
  instructions: "Tag the brand", captionInstructions: "", hashtags: [], mentions: [], referenceUrl: "",
  applicationDeadline: new Date(Date.now() + 10 * 864e5).toISOString().slice(0, 10),
  taskDeadline: new Date(Date.now() + 20 * 864e5).toISOString().slice(0, 10),
  // $40.14: the mock provider declines the first attempt only.
  paymentPerCreator: "40.14", creatorsRequired: 1,
};
let r = await adv.action("/campaigns/new", "saveCampaignDraft", [{ campaignId: null, intent: "save", draft }]);
const campaignId = (r.text.match(/"campaignId":"([0-9a-f-]{36})"/) ?? [])[1];
await adv.action(`/campaigns/${campaignId}/edit`, "saveCampaignDraft", [{ campaignId, intent: "continue", draft }]);
const sb = createClient(SUPABASE_URL, KEY, { auth: { persistSession: false } });
await sb.auth.signInWithPassword({ email: adv.email, password: PASSWORD });
const key = randomUUID();
await sb.rpc("record_test_deposit", { p_amount_cents: 6000, p_currency: "USD", p_provider_reference: `mock_${key.slice(0, 12)}`, p_status: "succeeded", p_idempotency_key: key });
r = await adv.action(`/campaigns/${campaignId}/fund`, "fundCampaign", [{ status: "idle" }, form({ campaignId, idempotencyKey: randomUUID() })]);
check("campaign funded ($40.14 per creator)", r.redirect?.includes("funded=1"), r.text);

const cre = await newUser("cre5b", "influencer", "Sana Creator");
await cre.action("/settings/social", "connectSocialAccount", [{ status: "idle" }, form({ platform: "instagram", handle: "sana.fiveb", followerCount: "7000" })]);
await cre.action(`/discover/${campaignId}`, "applyToCampaign", [{ status: "idle" }, form({ campaignId, pitch: "" })]);
r = await adv.get(`/campaigns/${campaignId}/applicants`);
const applicationId = (r.text.match(/name="applicationId" value="([0-9a-f-]{36})"/) ?? [])[1];
await adv.action(`/campaigns/${campaignId}/applicants`, "decideApplication", [{ status: "idle" }, form({ applicationId, campaignId, action: "select" })]);
await adv.action(`/campaigns/${campaignId}`, "closeApplications", [form({ campaignId })]);
await adv.action(`/campaigns/${campaignId}`, "startCampaignWork", [form({ campaignId })]);
r = await cre.get("/tasks");
const assignmentId = (r.text.match(/href="\/tasks\/([0-9a-f-]{36})"/) ?? [])[1];
r = await cre.get(`/tasks/${assignmentId}`);
const reelId = (r.text.match(/name="url:([0-9a-f-]{36})"/) ?? [])[1];
await cre.action(`/tasks/${assignmentId}`, "submitWork", [{ status: "idle" }, form({ assignmentId, [`url:${reelId}`]: "https://www.instagram.com/reel/p5b/" })]);
r = await adv.get(`/campaigns/${campaignId}/submissions?status=submitted`);
const submissionId = (r.text.match(/name="submissionId" value="([0-9a-f-]{36})"/) ?? [])[1];
r = await adv.action(`/campaigns/${campaignId}/submissions`, "reviewSubmission", [{ status: "idle" }, form({ submissionId, campaignId, decision: "approved", reason: "" })]);
check("work approved and ready for payout", !r.text.includes('"status":"error"') && Boolean(assignmentId), r.text);

const admin = await newUser("admin5b", "advertiser", "Agency Admin");
psql(`insert into public.user_roles (user_id, role) select id, 'admin' from auth.users where email = '${admin.email}'`);

const payoutTx = () => psql(`select count(*) from public.ledger_transactions where kind = 'creator_payout' and campaign_id = '${campaignId}'`);
const creatorCredits = () => psql(`select count(*) || ':' || coalesce(sum(e.amount_cents),0) from public.wallet_ledger_entries e join public.wallet_accounts a on a.id = e.account_id where a.kind = 'user_wallet' and a.owner_id = (select id from auth.users where email = '${cre.email}') and e.entry_type = 'creator_earning'`);
const payoutRow = () => psql(`select status || ':' || attempt_count from public.payouts where assignment_id = '${assignmentId}'`);

// ── Attempt 1 fails ──
r = await admin.action("/admin/payouts", "releasePayout", [{ status: "idle" }, form({ assignmentId })]);
check("first release attempt fails (provider declined)", r.text.includes("Payout failed"), r.text.slice(0, 300));
check("payout is Failed after attempt 1", payoutRow() === "failed:1", payoutRow());
check("failed attempt creates no payout ledger transaction", payoutTx() === "0", payoutTx());
check("creator is not credited by the failed attempt", creatorCredits() === "0:0", creatorCredits());
check("assignment is not marked paid", psql(`select status from public.campaign_assignments where id = '${assignmentId}'`) !== "paid");
r = await admin.get("/admin/payouts?tab=failed");
check("Failed tab shows the reason and a Retry action", r.text.includes("Sana Creator") && r.text.includes("first attempt") && r.text.includes("Retry payment"));
r = await cre.get("/notifications");
check("creator not told the payment was released", !r.text.includes("Payment released"));

// ── Retry: two concurrent retries (double click / two admins) ──
const [x, y] = await Promise.all([
  admin.action("/admin/payouts", "releasePayout", [{ status: "idle" }, form({ assignmentId })]),
  admin.action("/admin/payouts", "releasePayout", [{ status: "idle" }, form({ assignmentId })]),
]);
const released = [x, y].filter((q) => q.text.includes("Payment released")).length;
const refused = [x, y].filter((q) => /already being processed|already been paid/.test(q.text)).length;
check("of two concurrent retries exactly one pays, the other is refused", released === 1 && refused === 1, `${x.text.slice(0, 160)} || ${y.text.slice(0, 160)}`);
check("payout is Paid after attempt 2", payoutRow() === "paid:2", payoutRow());
check("retry created exactly one payout ledger transaction", payoutTx() === "1", payoutTx());
check("creator credited exactly once with $40.14", creatorCredits() === "1:4014", creatorCredits());

// ── Further release / retry / hold attempts cannot double-pay ──
r = await admin.action("/admin/payouts", "releasePayout", [{ status: "idle" }, form({ assignmentId })]);
check("releasing again is refused (already paid)", r.text.includes("already been paid"), r.text.slice(0, 300));
r = await admin.action("/admin/payouts", "holdPayout", [{ status: "idle" }, form({ assignmentId, reason: "Second thoughts" })]);
check("a paid payout cannot be put on hold", r.text.includes('"status":"error"') || !r.text.includes("Payout put on hold"), r.text.slice(0, 300));
const payoutId = psql(`select id from public.payouts where assignment_id = '${assignmentId}'`);
const adminId = psql(`select id from auth.users where email = '${admin.email}'`);
const asAdmin = (sql) => psql(`select set_config('request.jwt.claims', '{"sub":"${adminId}","role":"authenticated"}', false); set role authenticated; ${sql}`).split(String.fromCharCode(10)).pop();
check("recording 'paid' again directly is a no-op", asAdmin(`select public.record_payout_result('${payoutId}', 2::smallint, 'paid', 'mock_po_dup', null)`) === "paid");
let staleOutcome;
try { staleOutcome = asAdmin(`select public.record_payout_result('${payoutId}', 1::smallint, 'paid', 'mock_po_old', null)`); } catch (e) { staleOutcome = String(e.stderr ?? e); }
check("recording a result for an old attempt pays nothing (stale error or paid no-op)", staleOutcome === "paid" || staleOutcome.includes("stale_payout_attempt"), staleOutcome.slice(0, 200));
check("still exactly one payout ledger transaction", payoutTx() === "1", payoutTx());
check("creator still credited exactly once", creatorCredits() === "1:4014", creatorCredits());
check("journals balance", psql(`select count(*) from (select transaction_id from public.wallet_ledger_entries group by transaction_id having sum(amount_cents) <> 0) t`) === "0");
r = await cre.get("/wallet");
// Count in the rendered markup only (scripts carry the RSC payload). Each row renders twice:
// desktop table + mobile list, so one entry = 2 matches.
const markup = r.text.replace(/<script[\s\S]*?<\/script>/g, "");
const earningRows = (markup.match(/Campaign earning/g) ?? []).length, paidRows = (markup.match(/Paid out/g) ?? []).length;
check("creator wallet shows one earning row and one paid-out row", earningRows === 2 && paidRows === 2, `${earningRows}/${paidRows}`);
r = await admin.get("/admin/activity");
check("activity log shows the failed attempt and the paid retry", r.text.includes("Payout failed") && r.text.includes("Payout paid"));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
