// Browser QA seed: realistic data for all roles (advertiser, two creators, admin) → .qa/users.json.
// Run from the repo root against a running app: MODE=prod node scripts/qa/seed.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { createFundedCampaign, form, newUser, psql } from "../e2e/harness.mjs";

const adv = await newUser("qa-adv", "advertiser", "Glowify Studio");
const cre = await newUser("qa-cre", "influencer", "Ayesha Rahman");
const cre2 = await newUser("qa-cre2", "influencer", "Daniel Osei");
const admin = await newUser("qa-admin", "advertiser", "Ops Admin");
psql(`insert into user_roles (user_id, role) select id, 'admin' from auth.users where email = '${admin.email}'`);

// Campaign in progress with submitted work.
const live = await createFundedCampaign(adv, "Summer Collection Reel", { paymentPerCreator: "40", creatorsRequired: 2 });
for (const [c, handle] of [[cre, "ayesha.creates"], [cre2, "daniel.films"]]) {
  await c.action("/settings/social", "connectSocialAccount", [{ status: "idle" }, form({ platform: "instagram", handle, followerCount: "12500" })]);
  await c.action(`/discover/${live.campaignId}`, "applyToCampaign", [{ status: "idle" }, form({ campaignId: live.campaignId, pitch: "I shoot outfit reels every week and my audience is mostly 18-30." })]);
}
let r = await adv.get(`/campaigns/${live.campaignId}/applicants`);
const appIds = [...r.text.matchAll(/name="applicationId" value="([0-9a-f-]{36})"/g)].map((m) => m[1]);
await adv.action(`/campaigns/${live.campaignId}/applicants`, "decideApplication", [{ status: "idle" }, form({ applicationId: appIds[0], campaignId: live.campaignId, action: "select" })]);
await adv.action(`/campaigns/${live.campaignId}/applicants`, "decideApplication", [{ status: "idle" }, form({ applicationId: appIds[1], campaignId: live.campaignId, action: "shortlist" })]);

// A second campaign still open for applications, and a draft.
const open = await createFundedCampaign(adv, "Spring Menu Teaser", { paymentPerCreator: "25", creatorsRequired: 3 });
await cre2.action(`/discover/${open.campaignId}`, "applyToCampaign", [{ status: "idle" }, form({ campaignId: open.campaignId, pitch: "" })]);

await adv.action(`/campaigns/${live.campaignId}`, "closeApplications", [form({ campaignId: live.campaignId })]);
await adv.action(`/campaigns/${live.campaignId}`, "startCampaignWork", [form({ campaignId: live.campaignId })]);

// Whichever creator was selected submits work.
for (const c of [cre, cre2]) {
  r = await c.get("/tasks");
  const assignmentId = (r.text.match(/href="\/tasks\/([0-9a-f-]{36})"/) ?? [])[1];
  if (!assignmentId) continue;
  r = await c.get(`/tasks/${assignmentId}`);
  const urlId = (r.text.match(/name="url:([0-9a-f-]{36})"/) ?? [])[1];
  await c.action(`/tasks/${assignmentId}`, "submitWork", [{ status: "idle" }, form({ assignmentId, [`url:${urlId}`]: "https://www.instagram.com/reel/qa123/", note: "Posted this morning." })]);
}

mkdirSync(resolve(".qa"), { recursive: true });
writeFileSync(resolve(".qa/users.json"), JSON.stringify({ adv: adv.email, cre: cre.email, cre2: cre2.email, admin: admin.email, live: live.campaignId, open: open.campaignId }, null, 2));
console.log("seeded");
process.exit(0);
