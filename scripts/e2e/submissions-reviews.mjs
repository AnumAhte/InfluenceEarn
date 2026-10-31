// Phase 4 end-to-end: campaign work, proof validation, submission, changes requested,
// resubmission, approval, admin payout-queue visibility, campaign completion.
//
// Run from the repo root against the production build: MODE=prod node scripts/e2e/submissions-reviews.mjs
import { randomUUID } from "node:crypto";

import { createClient, SUPABASE_URL, PUBLISHABLE_KEY, PASSWORD, check, finish, form, newUser, psql, sameCampaign } from "./harness.mjs";

// ── Setup: funded campaign with Reel + Comment + Follow, one selected creator ──
const adv = await newUser("adv4", "advertiser", "Brand Owner");
const draft = {
  title: "Phase4 Smoke Campaign",
  description: "Promote our summer drop with one Instagram Reel showing two outfits from the collection.",
  categorySlug: "fashion", campaignType: "product_launch",
  eligibility: { minFollowers: null, genders: [], ageMin: null, ageMax: null, creatorCategories: [], locations: [] },
  platforms: ["instagram"],
  tasks: [
    { platform: "instagram", taskType: "instagram_reel", quantity: 1 },
    { platform: "instagram", taskType: "comment", quantity: 1 },
    { platform: "instagram", taskType: "follow", quantity: 1 },
  ],
  instructions: "Tag the brand", captionInstructions: "", hashtags: [], mentions: [], referenceUrl: "",
  applicationDeadline: new Date(Date.now() + 10 * 864e5).toISOString().slice(0, 10),
  taskDeadline: new Date(Date.now() + 20 * 864e5).toISOString().slice(0, 10),
  paymentPerCreator: "40", creatorsRequired: 1,
};
let r = await adv.action("/campaigns/new", "saveCampaignDraft", [{ campaignId: null, intent: "save", draft }]);
const campaignId = (r.text.match(/"campaignId":"([0-9a-f-]{36})"/) ?? [])[1];
await adv.action(`/campaigns/${campaignId}/edit`, "saveCampaignDraft", [{ campaignId, intent: "continue", draft }]);
const sb = createClient(SUPABASE_URL, PUBLISHABLE_KEY, { auth: { persistSession: false } });
await sb.auth.signInWithPassword({ email: adv.email, password: PASSWORD });
const key = randomUUID();
await sb.rpc("record_test_deposit", { p_amount_cents: 4800, p_currency: "USD", p_provider_reference: `mock_${key.slice(0, 12)}`, p_status: "succeeded", p_idempotency_key: key });
r = await adv.action(`/campaigns/${campaignId}/fund`, "fundCampaign", [{ status: "idle" }, form({ campaignId, idempotencyKey: randomUUID() })]);
check("campaign funded", r.redirect?.includes("funded=1"), r.text);

const cre = await newUser("cre4", "influencer", "Ayesha Creator");
await cre.action("/settings/social", "connectSocialAccount", [{ status: "idle" }, form({ platform: "instagram", handle: "ayesha.four", followerCount: "12000" })]);
r = await cre.action(`/discover/${campaignId}`, "applyToCampaign", [{ status: "idle" }, form({ campaignId, pitch: "" })]);
check("creator applied", r.redirect?.includes("applied=1"), r.text);
r = await adv.get(`/campaigns/${campaignId}/applicants`);
const applicationId = (r.text.match(/name="applicationId" value="([0-9a-f-]{36})"/) ?? [])[1];
r = await adv.action(`/campaigns/${campaignId}/applicants`, "decideApplication", [{ status: "idle" }, form({ applicationId, campaignId, action: "select" })]);
check("advertiser selects the creator", !r.text.includes('"status":"error"'), r.text);
await adv.action(`/campaigns/${campaignId}`, "closeApplications", [form({ campaignId })]);
r = await adv.action(`/campaigns/${campaignId}`, "startCampaignWork", [form({ campaignId })]);
check("advertiser starts campaign work", sameCampaign(r.redirect, campaignId), r.redirect);

// ── Creator works on the task ──
r = await cre.get("/tasks");
check("selected task appears under Active tasks", r.text.includes("Phase4 Smoke Campaign"));
const assignmentId = (r.text.match(/href="\/tasks\/([0-9a-f-]{36})"/) ?? [])[1];
r = await cre.get(`/tasks/${assignmentId}`);
check("task page shows the completion form (no screenshot field)", r.text.includes("Submit completion") && !/type="file"/.test(r.text));
const urlIds = [...r.text.matchAll(/name="url:([0-9a-f-]{36})"/g)].map((m) => m[1]);
const commentIds = [...r.text.matchAll(/name="comment:([0-9a-f-]{36})"/g)].map((m) => m[1]);
check("form asks for 2 links (reel, comment post) and 1 comment; follow needs none", urlIds.length === 2 && commentIds.length === 1, `${urlIds.length}/${commentIds.length}`);
const reelId = urlIds.find((t) => !commentIds.includes(t));
const commentId = commentIds[0];

r = await cre.action(`/tasks/${assignmentId}`, "submitWork", [{ status: "idle" }, form({ assignmentId, [`url:${reelId}`]: "https://evil.example/reel/1", [`url:${commentId}`]: "https://www.instagram.com/p/abc/", [`comment:${commentId}`]: "" })]);
check("wrong-domain link and missing comment are flagged", r.text.includes("instagram.com") && r.text.includes("Paste the comment"), r.text);
r = await cre.action(`/tasks/${assignmentId}`, "submitWork", [{ status: "idle" }, form({ assignmentId, [`url:${reelId}`]: "https://www.instagram.com/reel/first/", [`url:${commentId}`]: "https://www.instagram.com/p/abc/", [`comment:${commentId}`]: "Love it", note: "Here you go" })]);
check("creator submits completion", r.redirect?.includes("submitted=1"), `${r.redirect} ${r.text}`);
r = await cre.get(`/tasks/${assignmentId}`);
check("task shows Waiting for review", r.text.includes("Waiting for review"));

// ── Advertiser reviews ──
r = await adv.get("/notifications");
check("advertiser notified: work submitted", r.text.includes("Work submitted for review"));
r = await adv.get("/reviews");
check("Tasks & reviews inbox lists the submission", r.text.includes("Ayesha Creator") && r.text.includes("Phase4 Smoke Campaign"));
r = await adv.get(`/campaigns/${campaignId}`);
check("campaign status is Review pending", r.text.includes("Review pending"));
r = await adv.get(`/campaigns/${campaignId}/submissions?status=submitted`);
check("submission shows proof links and comment", r.text.includes("https://www.instagram.com/reel/first/") && r.text.includes("Love it"));
let submissionId = (r.text.match(/name="submissionId" value="([0-9a-f-]{36})"/) ?? [])[1];

r = await cre.action(`/campaigns/${campaignId}/submissions`, "reviewSubmission", [{ status: "idle" }, form({ submissionId, campaignId, decision: "approved", reason: "" })]);
check("the creator cannot approve their own work", r.text.includes("Not found"), r.text);
r = await adv.action(`/campaigns/${campaignId}/submissions`, "reviewSubmission", [{ status: "idle" }, form({ submissionId, campaignId, decision: "rejected", reason: "" })]);
check("rejecting without a reason is refused", r.text.includes("what needs to change"), r.text);
r = await adv.action(`/campaigns/${campaignId}`, "completeCampaign", [form({ campaignId })]);
check("campaign cannot complete while work awaits review", r.redirect?.includes("error=work_outstanding"), r.redirect);
r = await adv.action(`/campaigns/${campaignId}/submissions`, "reviewSubmission", [{ status: "idle" }, form({ submissionId, campaignId, decision: "rejected", reason: "Please tag the brand account.", allowResubmission: "on" })]);
check("advertiser requests changes", !r.text.includes('"status":"error"'), r.text);

r = await cre.get(`/tasks/${assignmentId}`);
check("creator sees Changes requested with the reason", r.text.includes("Changes requested") && r.text.includes("Please tag the brand account."));
r = await cre.get("/notifications");
check("creator notified: changes requested", r.text.includes("Changes requested"));
r = await cre.action(`/tasks/${assignmentId}`, "submitWork", [{ status: "idle" }, form({ assignmentId, [`url:${reelId}`]: "https://www.instagram.com/reel/second/", [`url:${commentId}`]: "https://www.instagram.com/p/abc/", [`comment:${commentId}`]: "Love it @brand" })]);
check("creator resubmits", r.redirect?.includes("submitted=1"), `${r.redirect} ${r.text}`);

// An agency admin exists before the approval, so they should be notified.
const admin = await newUser("admin4", "advertiser", "Agency Admin");
psql(`insert into public.user_roles (user_id, role) select id, 'admin' from auth.users where email = '${admin.email}'`);
r = await adv.get(`/campaigns/${campaignId}/submissions?status=submitted`);
submissionId = (r.text.match(/name="submissionId" value="([0-9a-f-]{36})"/) ?? [])[1];
r = await adv.action(`/campaigns/${campaignId}/submissions`, "reviewSubmission", [{ status: "idle" }, form({ submissionId, campaignId, decision: "approved", reason: "" })]);
check("advertiser approves completion", !r.text.includes('"status":"error"'), r.text);
r = await cre.get(`/tasks/${assignmentId}`);
check("creator sees Approved", r.text.includes("Approved"));
r = await cre.get("/tasks?view=completed");
check("task moves to Completed tasks", r.text.includes("Phase4 Smoke Campaign"));

// ── Admin sees it ready for payout ──
r = await admin.get("/admin/payouts");
check("admin payout queue lists the approved work", r.text.includes("Ayesha Creator") && r.text.includes("$40.00") && r.text.includes("Ready for payout"));
r = await cre.get("/admin");
check("non-admins still get 404 on /admin", r.status === 404, r.status);
r = await admin.get("/notifications");
check("the admin received a Ready for payout notification", r.text.includes("Ready for payout") && r.text.includes("Phase4 Smoke Campaign"));

// ── Complete the campaign ──
r = await adv.action(`/campaigns/${campaignId}`, "completeCampaign", [form({ campaignId })]);
check("advertiser marks the campaign complete", sameCampaign(r.redirect, campaignId), r.redirect);
r = await adv.get(`/campaigns/${campaignId}`);
check("campaign shows Completed", r.text.includes("Completed"));
r = await cre.action(`/tasks/${assignmentId}`, "submitWork", [{ status: "idle" }, form({ assignmentId, [`url:${reelId}`]: "https://www.instagram.com/reel/third/", [`url:${commentId}`]: "https://www.instagram.com/p/abc/", [`comment:${commentId}`]: "again" })]);
check("no submissions after approval", /can(&#x27;|')t submit right now/.test(r.text), r.text);

finish();
