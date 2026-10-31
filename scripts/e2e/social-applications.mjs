// Phase 3 end-to-end: social account linking, eligibility gate, applying, manual selection by
// the advertiser and in-app notifications, through the real server actions.
//
// Run from the repo root against the production build: MODE=prod node scripts/e2e/social-applications.mjs
import { randomUUID } from "node:crypto";

import { createClient, SUPABASE_URL, PUBLISHABLE_KEY, PASSWORD, check, finish, form, newUser } from "./harness.mjs";

// ── Advertiser creates and funds a campaign (Instagram, 10k+ followers, 1 creator) ──
const adv = await newUser("adv", "advertiser", "Brand Owner");
const draft = {
  title: "Phase3 Smoke Campaign",
  description: "Promote our summer drop with one Instagram Reel showing two outfits from the collection.",
  categorySlug: "fashion", campaignType: "product_launch",
  eligibility: { minFollowers: 10000, genders: [], ageMin: null, ageMax: null, creatorCategories: [], locations: [] },
  platforms: ["instagram"], tasks: [{ platform: "instagram", taskType: "instagram_reel", quantity: 1 }],
  instructions: "", captionInstructions: "", hashtags: [], mentions: [], referenceUrl: "",
  applicationDeadline: new Date(Date.now() + 10 * 864e5).toISOString().slice(0, 10),
  taskDeadline: new Date(Date.now() + 20 * 864e5).toISOString().slice(0, 10),
  paymentPerCreator: "25", creatorsRequired: 1,
};
let r = await adv.action("/campaigns/new", "saveCampaignDraft", [{ campaignId: null, intent: "save", draft }]);
const campaignId = (r.text.match(/"campaignId":"([0-9a-f-]{36})"/) ?? [])[1];
await adv.action(`/campaigns/${campaignId}/edit`, "saveCampaignDraft", [{ campaignId, intent: "continue", draft }]);
const sb = createClient(SUPABASE_URL, PUBLISHABLE_KEY, { auth: { persistSession: false } });
await sb.auth.signInWithPassword({ email: adv.email, password: PASSWORD });
const key = randomUUID();
await sb.rpc("record_test_deposit", { p_amount_cents: 3000, p_currency: "USD", p_provider_reference: `mock_${key.slice(0, 12)}`, p_status: "succeeded", p_idempotency_key: key });
r = await adv.action(`/campaigns/${campaignId}/fund`, "fundCampaign", [{ status: "idle" }, form({ campaignId, idempotencyKey: randomUUID() })]);
check("campaign funded and published", r.redirect?.includes("funded=1"), r.text);
r = await adv.get("/notifications");
check("advertiser notified: campaign funded and published", r.text.includes("Campaign funded and published"));

// ── Creator discovers the campaign ──
const cre = await newUser("creator", "influencer", "Ayesha Creator");
r = await cre.get("/discover");
check("creator sees the live campaign in discovery", r.text.includes("Phase3 Smoke Campaign"));
check("discovery shows the platform gate", r.text.includes("Instagram account required"));
r = await cre.get("/discover?eligible=1");
check("'Eligible only' hides it before an account is connected", !r.text.includes("Phase3 Smoke Campaign"));
r = await cre.get(`/discover/${campaignId}`);
check("campaign page shows 'Connect Instagram'", /Connect (<!-- -->)?Instagram/.test(r.text), r.text.match(/.{0,80}account required.{0,200}/s)?.[0]);
r = await cre.action(`/discover/${campaignId}`, "applyToCampaign", [{ status: "idle" }, form({ campaignId, pitch: "" })]);
check("server refuses to apply without the required account", r.text.includes("don&#x27;t meet") || r.text.includes("don't meet"), r.text);

// Connect Instagram with too few followers → still gated.
r = await cre.action("/settings/social", "connectSocialAccount", [{ status: "idle" }, form({ platform: "instagram", handle: "https://www.instagram.com/ayesha.creates/", followerCount: "5,000" })]);
check("Instagram connected from a profile link", r.text.includes("Instagram connected"), r.text);
r = await cre.action("/settings/social", "connectSocialAccount", [{ status: "idle" }, form({ platform: "instagram", handle: "other", followerCount: "1" })]);
check("a second Instagram account is refused", r.text.includes("already have a Instagram") || r.text.includes("already have an Instagram") || r.text.includes("already have"), r.text);
r = await cre.get(`/discover/${campaignId}`);
check("follower minimum is enforced (5,000 < 10,000)", r.text.includes("needs at least 10,000 followers"));
r = await cre.action("/settings/social", "connectSocialAccount", [{ status: "idle" }, form({ platform: "tiktok", handle: "bad handle!", followerCount: "10" })]);
check("invalid handles are rejected", r.text.includes("valid handle"), r.text);

// Update followers → eligible → apply.
r = await cre.get("/settings/social");
const accountId = (r.text.match(/name="accountId" value="([0-9a-f-]{36})"/) ?? [])[1];
r = await cre.action("/settings/social", "updateSocialAccount", [{ status: "idle" }, form({ accountId, platform: "instagram", handle: "ayesha.creates", followerCount: "24000" })]);
check("self-reported follower count updated", r.text.includes("Account updated"), r.text);
r = await cre.action("/settings/creator", "saveCreatorDetails", [{ status: "idle" }, form({ countryCode: "GB", dateOfBirth: "2001-05-04", gender: "female", categories: ["fashion", "beauty"] })]);
check("creator details saved", r.text.includes("Creator details saved"), r.text);
r = await cre.action("/settings/creator", "saveCreatorDetails", [{ status: "idle" }, form({ countryCode: "GB", dateOfBirth: "2020-01-01", gender: "", categories: [] })]);
check("under-13 date of birth rejected", r.text.includes("at least 13"), r.text);

r = await cre.get("/discover?eligible=1");
check("now listed under 'Eligible only'", r.text.includes("Phase3 Smoke Campaign"));
r = await cre.action(`/discover/${campaignId}`, "applyToCampaign", [{ status: "idle" }, form({ campaignId, pitch: "Big fan of the brand." })]);
check("creator applies", r.redirect?.includes("applied=1"), `${r.redirect} ${r.text}`);
r = await cre.action(`/discover/${campaignId}`, "applyToCampaign", [{ status: "idle" }, form({ campaignId, pitch: "" })]);
check("second application refused", r.text.includes("already applied"), r.text);
r = await cre.get("/applications");
check("My applications shows it as Pending review", r.text.includes("Phase3 Smoke Campaign") && r.text.includes("Pending review"));

// ── Another creator cannot act on it ──
const other = await newUser("other", "influencer", "Other Creator");
r = await other.get(`/campaigns/${campaignId}/applicants`);
check("another user cannot open the applicant list", !r.text.includes("Ayesha Creator"));

// ── Advertiser reviews manually ──
r = await adv.get("/notifications");
check("advertiser notified of the new application", r.text.includes("New application") && r.text.includes("Ayesha Creator"));
r = await adv.get(`/campaigns/${campaignId}/applicants`);
check("applicant list shows snapshot, handle link and pitch", r.text.includes("Ayesha Creator") && r.text.includes("https://www.instagram.com/ayesha.creates/") && r.text.includes("Big fan of the brand."));
check("applicant list shows age, not date of birth", !r.text.includes("2001-05-04") && /\d{2} yrs/.test(r.text));
const applicationId = (r.text.match(/name="applicationId" value="([0-9a-f-]{36})"/) ?? [])[1];
r = await adv.get(`/campaigns/${campaignId}/applicants?q=ayesha.cre`);
check("applicant search by handle works", r.text.includes("Ayesha Creator"));
r = await adv.get(`/campaigns/${campaignId}/applicants?minFollowers=50000`);
check("follower filter excludes the applicant", !r.text.includes("Ayesha Creator"));

r = await cre.action(`/campaigns/${campaignId}/applicants`, "decideApplication", [{ status: "idle" }, form({ applicationId, campaignId, action: "select" })]);
check("the creator cannot select themselves", r.text.includes("Application not found"), r.text);
r = await adv.action(`/campaigns/${campaignId}/applicants`, "decideApplication", [{ status: "idle" }, form({ applicationId, campaignId, action: "shortlist" })]);
check("advertiser shortlists", !r.text.includes('"status":"error"'), r.text);
r = await adv.action(`/campaigns/${campaignId}/applicants`, "decideApplication", [{ status: "idle" }, form({ applicationId, campaignId, action: "select" })]);
check("advertiser selects", !r.text.includes('"status":"error"'), r.text);
r = await adv.action(`/campaigns/${campaignId}/applicants`, "decideApplication", [{ status: "idle" }, form({ applicationId, campaignId, action: "reject" })]);
check("selection is final (reject after select refused)", r.text.includes("isn&#x27;t possible") || r.text.includes("isn't possible"), r.text);
r = await adv.get(`/campaigns/${campaignId}`);
check("campaign page shows real counts (Selected 1 / 1)", r.text.includes("1 / 1") || r.text.includes("1<!-- --> / <!-- -->1"));

r = await cre.get("/notifications");
check("creator notified: You were selected", r.text.includes("You were selected"));
const notificationId = (r.text.match(/name="id" value="([0-9a-f-]{36})"/) ?? [])[1];
r = await cre.action("/notifications", "openNotification", [form({ id: notificationId, link: "/applications" })]);
check("opening a notification marks it read and follows its link", r.redirect?.startsWith("/applications"), r.redirect);
r = await cre.action("/notifications", "openNotification", [form({ id: notificationId, link: "//evil.example" })]);
check("notification links cannot redirect off-site", r.redirect?.startsWith("/notifications"), r.redirect);
r = await cre.get("/applications?status=selected");
check("My applications shows Selected", r.text.includes("Phase3 Smoke Campaign"));

// ── Close applications ──
r = await adv.action(`/campaigns/${campaignId}`, "closeApplications", [form({ campaignId })]);
check("advertiser closes applications", r.redirect?.startsWith(`/campaigns/${campaignId}`), r.redirect);
r = await other.get(`/discover/${campaignId}`);
check("a non-applicant can no longer open the closed campaign", !r.text.includes("Phase3 Smoke Campaign"));
r = await cre.get(`/discover/${campaignId}`);
check("the applicant can still open it", r.text.includes("Phase3 Smoke Campaign"));

// ── Workspace gating ──
r = await adv.get("/discover");
check("advertiser workspace is prompted to switch for discovery", r.text.includes("Campaign discovery is in the Influencer workspace"));

finish();
