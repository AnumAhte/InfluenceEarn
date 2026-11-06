// Phase 6 end-to-end: legal pages, account suspension, notification emails, media kits,
// account settings and rate limits, through the real app.
//
// Runs in both modes. Run from the repo root: MODE=prod node scripts/e2e/marketplace-phase6.mjs
import { APP, MODE, PASSWORD, PUBLISHABLE_KEY, SUPABASE_URL, Session, check, createClient, createFundedCampaign, envLocal, finish, form, isNotFound, mailpitMessage, mailpitMessages, newUser, psql, runEmailWorker } from "./harness.mjs";

// ── Legal pages (drafts) ──
const guest = new Session();
for (const [path, title] of [["/terms", "Terms of Service"], ["/privacy", "Privacy Policy"]]) {
  const r = await guest.get(path);
  check(`${path} is public`, r.status === 200, r.status);
  check(`${path} shows the ${title} with the draft banner`, r.text.includes(title) && r.text.includes("Draft — requires client and legal approval"));
  check(`${path} marks unconfirmed facts`, r.text.includes("[To confirm: "));
  check(`${path} is excluded from search engines while a draft`, /<meta name="robots" content="noindex, nofollow"/.test(r.text));
}
let r = await guest.get("/");
check("landing footer links to Terms and Privacy", r.text.includes('href="/terms"') && r.text.includes('href="/privacy"'));
r = await guest.get("/signup");
check("sign-up links to the draft documents without 'you agree' wording", r.text.includes('href="/terms"') && !/you agree/i.test(r.text));

// ── Notification emails (SMTP → Mailpit) ──
const adv = await newUser("adv6", "advertiser", "Email Owner");
let res = await fetch(`${APP}/api/internal/notification-emails`, { method: "POST" });
check("email worker refuses requests without the secret", res.status === 401, res.status);
res = await fetch(`${APP}/api/internal/notification-emails`, { method: "POST", headers: { authorization: "Bearer wrong-secret-wrong-secret-wrong-secret" } });
check("email worker refuses a wrong secret", res.status === 401, res.status);
res = await fetch(`${APP}/api/internal/notification-emails`);
check("email worker has no GET endpoint", res.status === 405, res.status);
check("the worker secret is configured locally", (envLocal("EMAIL_WORKER_SECRET") ?? "").length >= 32);

const first = await createFundedCampaign(adv, "Phase6 Email Campaign");
check("campaign funded (creates a 'campaign published' notification)", first.funded);
check("the notification is queued for email", psql(`select email_status from notifications n join auth.users u on u.id = n.recipient_id where u.email = '${adv.email}' and n.type = 'campaign_published'`) === "pending");
let worker = await runEmailWorker();
check("email worker sends the queued notification", worker.status === 200 && worker.sent >= 1 && worker.errors === 0, JSON.stringify(worker));
check("status is 'sent' with the provider message id", psql(`select email_status || ':' || (email_message_id is not null) from notifications n join auth.users u on u.id = n.recipient_id where u.email = '${adv.email}' and n.type = 'campaign_published'`) === "sent:true");
let mails = (await mailpitMessages(adv.email)).filter((m) => m.Subject === "Campaign funded and published");
check("Mailpit received exactly one notification email", mails.length === 1, mails.length);
const mail = mails[0] ? await mailpitMessage(mails[0].ID) : { HTML: "", Text: "" };
check("the email links to the campaign and to email preferences", mail.HTML.includes(`/campaigns/${first.campaignId}`) && mail.Text.includes("/settings/notifications"));
worker = await runEmailWorker();
mails = (await mailpitMessages(adv.email)).filter((m) => m.Subject === "Campaign funded and published");
check("running the worker again sends nothing twice", mails.length === 1 && worker.sent === 0, `${mails.length} ${JSON.stringify(worker)}`);

// Preferences: opt out of campaign and payment emails
r = await adv.get("/settings/notifications");
check("email preferences page renders with every category on", r.status === 200 && (r.text.match(/checked=""/g) ?? []).length === 3);
r = await adv.action("/settings/notifications", "saveEmailPreferences", [{ status: "idle" }, form({ applications: "on", work: "on" })]);
check("saving preferences succeeds", r.text.includes("Email preferences saved"), r.text.slice(0, 200));
r = await adv.get("/settings/notifications");
check("the saved preferences are shown", (r.text.match(/checked=""/g) ?? []).length === 2);
const second = await createFundedCampaign(adv, "Phase6 Opted Out Campaign");
check("second campaign funded", second.funded);
worker = await runEmailWorker();
check("an opted-out notification is marked skipped, not sent", psql(`select email_status || ':' || email_error from notifications n join auth.users u on u.id = n.recipient_id where u.email = '${adv.email}' and n.type = 'campaign_published' and n.data->>'campaign_id' = '${second.campaignId}'`) === "skipped:opted_out");
mails = (await mailpitMessages(adv.email)).filter((m) => m.Subject === "Campaign funded and published");
check("no email was sent for the opted-out category", mails.length === 1, mails.length);
r = await adv.get("/notifications");
check("the in-app notification still appears", (r.text.match(/Campaign funded and published/g) ?? []).length >= 2);

// ── Media kits ──
const kitCreator = await newUser("kit6", "influencer", "Kit Creator");
const pdfForm = (bytes, name, type = "application/pdf") => { const f = new FormData(); f.append("mediaKit", new File([bytes], name, { type })); return f; };
r = await kitCreator.action("/settings/creator", "uploadMediaKit", [{ status: "idle" }, pdfForm("<html>not a pdf</html>", "fake.pdf")]);
check("a file that is not really a PDF is rejected", r.text.includes("Media kit must be a PDF file"), r.text.slice(0, 200));
r = await kitCreator.action("/settings/creator", "uploadMediaKit", [{ status: "idle" }, pdfForm(new Uint8Array(4 * 1024 * 1024 + 10).fill(37), "big.pdf")]);
check("a PDF over 4 MB is rejected", r.text.includes("4 MB or smaller"), r.text.slice(0, 200));
const PDF_BYTES = "%PDF-1.4\n1 0 obj <<>> endobj\ntrailer <<>>\n%%EOF\n";
r = await kitCreator.action("/settings/creator", "uploadMediaKit", [{ status: "idle" }, pdfForm(PDF_BYTES, "My Media Kit.pdf")]);
check("a valid PDF is uploaded", r.text.includes("Media kit uploaded"), r.text.slice(0, 200));
r = await kitCreator.get("/settings/creator");
check("the creator sees their media kit", r.text.includes("My Media Kit.pdf"));
r = await kitCreator.action("/settings/creator", "uploadMediaKit", [{ status: "idle" }, pdfForm(PDF_BYTES, "Updated Kit.pdf")]);
check("uploading again replaces the media kit", r.text.includes("Media kit uploaded"));
check("the replaced file is deleted from storage (one file per creator)", psql(`select count(*) from storage.objects o join auth.users u on o.name like u.id::text || '/%' where o.bucket_id = 'media-kits' and u.email = '${kitCreator.email}'`) === "1");

const kitAdv = await newUser("kitadv6", "advertiser", "Kit Advertiser");
const kitCampaign = await createFundedCampaign(kitAdv, "Phase6 Media Kit Campaign");
r = await kitCreator.action("/settings/social", "connectSocialAccount", [{ status: "idle" }, form({ platform: "instagram", handle: `kit_${Date.now()}`, followerCount: "5000" })]);
r = await kitCreator.action(`/discover/${kitCampaign.campaignId}`, "applyToCampaign", [{ status: "idle" }, form({ campaignId: kitCampaign.campaignId, pitch: "" })]);
check("the creator applied to the campaign", r.text.includes('"status":"success"') || r.redirect !== null, r.text.slice(0, 200));
r = await kitAdv.get(`/campaigns/${kitCampaign.campaignId}/applicants`);
const kitLink = (r.text.match(/href="([^"]*\/storage\/v1\/object\/sign\/media-kits\/[^"]+)"/) ?? [])[1]?.replace(/&amp;/g, "&");
check("the advertiser sees a media kit link on the applicant", Boolean(kitLink) && r.text.includes("Media kit (PDF)"));
const download = kitLink ? await fetch(kitLink) : null;
check("the signed link downloads the PDF", download?.status === 200 && (await download.text()).startsWith("%PDF-"), download?.status);

const otherAdv = await newUser("kitother6", "advertiser", "Other Advertiser");
const sbOther = createClient(SUPABASE_URL, PUBLISHABLE_KEY, { auth: { persistSession: false } });
await sbOther.auth.signInWithPassword({ email: otherAdv.email, password: PASSWORD });
const { data: otherRows } = await sbOther.from("creator_media_kits").select("path");
check("an unrelated advertiser cannot see any media kit record", (otherRows ?? []).length === 0, JSON.stringify(otherRows));
const kitPath = psql(`select path from creator_media_kits k join auth.users u on u.id = k.user_id where u.email = '${kitCreator.email}'`);
const { error: signError } = await sbOther.storage.from("media-kits").createSignedUrl(kitPath, 60);
check("an unrelated advertiser cannot create a link to the file", Boolean(signError));

r = await kitCreator.action("/settings/creator", "removeMediaKit", [{ status: "idle" }, new FormData()]);
check("the creator can remove the media kit", r.text.includes("Media kit removed"), r.text.slice(0, 200));
check("removing deletes the record and the file", psql(`select count(*) from creator_media_kits k join auth.users u on u.id = k.user_id where u.email = '${kitCreator.email}'`) === "0"
  && psql(`select count(*) from storage.objects where bucket_id = 'media-kits' and name = '${kitPath}'`) === "0");

// ── Account & security ──
const acct = await newUser("acct6", "influencer", "Account Owner");
r = await acct.get("/settings/account");
check("account page shows the signed-in email", r.status === 200 && r.text.includes(acct.email));
r = await acct.action("/settings/account", "changePassword", [{ status: "idle" }, form({ currentPassword: "wrong-password-1", password: "new-horse-battery-9", confirmPassword: "new-horse-battery-9" })]);
check("a wrong current password is refused", r.text.includes("Your current password is incorrect"), r.text.slice(0, 200));
r = await acct.action("/settings/account", "changePassword", [{ status: "idle" }, form({ currentPassword: PASSWORD, password: "new-horse-battery-9", confirmPassword: "new-horse-battery-9" })]);
check("the password is changed with the current password", r.text.includes("Password changed"), r.text.slice(0, 200));
r = await acct.get("/settings/account");
check("the browser session stays signed in after the change", r.status === 200 && r.text.includes(acct.email), `${r.status} ${r.location}`);
const signer = createClient(SUPABASE_URL, PUBLISHABLE_KEY, { auth: { persistSession: false } });
check("the old password no longer works", Boolean((await signer.auth.signInWithPassword({ email: acct.email, password: PASSWORD })).error));
check("the new password works", !(await signer.auth.signInWithPassword({ email: acct.email, password: "new-horse-battery-9" })).error);
await new Promise((res) => setTimeout(res, 1500));
check("a 'password changed' security email is sent", (await mailpitMessages(acct.email)).some((m) => m.Subject === "Your InfluencEarn password was changed"));

const newEmail = `e2e-acct6-new-${Date.now()}@test.local`;
r = await acct.action("/settings/account", "changeEmail", [{ status: "idle" }, form({ email: acct.email })]);
check("changing to the same email is refused", r.text.includes("already your email address"));
r = await acct.action("/settings/account", "changeEmail", [{ status: "idle" }, form({ email: newEmail })]);
check("an email change is started", r.text.includes("Check both inboxes"), r.text.slice(0, 200));
r = await acct.get("/settings/account");
check("the pending address is shown until confirmed", r.text.includes("Waiting for confirmation of") && r.text.includes(newEmail));
const changeLink = async (to) => {
  for (let i = 0; i < 40; i++) {
    const m = (await mailpitMessages(to)).find((x) => x.Subject === "Confirm your new InfluencEarn email address");
    if (m) return ((await mailpitMessage(m.ID)).HTML.match(/href="([^"]*auth\/confirm[^"]*)"/) ?? [])[1]?.replace(/&amp;/g, "&");
    await new Promise((res) => setTimeout(res, 500));
  }
  return undefined;
};
const [oldLink, newLink] = [await changeLink(acct.email), await changeLink(newEmail)];
check("confirmation links go to both the current and the new address", Boolean(oldLink && newLink));
for (const link of [oldLink, newLink].filter(Boolean)) { const u = new URL(link); await acct.get(u.pathname + u.search); }
check("after both confirmations the account uses the new email", psql(`select count(*) from auth.users where email = '${newEmail}'`) === "1");
check("the new email signs in", !(await signer.auth.signInWithPassword({ email: newEmail, password: "new-horse-battery-9" })).error);

// ── Admin pages ──
const admin = await newUser("admin6", "advertiser", "Ops Admin");
psql(`insert into user_roles (user_id, role) select id, 'admin' from auth.users where email = '${admin.email}'`);
for (const [path, text] of [
  ["/admin/users", "Every account on the platform"],
  ["/admin/campaigns", "Phase6 Email Campaign"],
  ["/admin/reviews", "Task reviews"],
  ["/admin/transactions", "Campaign funding"],
  ["/admin/settings", "Campaign funding"],
]) {
  r = await admin.get(path);
  check(`admin can open ${path}`, r.status === 200 && r.text.includes(text), r.status);
}
r = await admin.get(`/admin/users?q=${encodeURIComponent(adv.email)}`);
check("admin user search finds a user by email", r.text.includes(adv.email) && !r.text.includes(kitCreator.email));
r = await admin.get("/admin/settings");
check(`system status reports funding as ${MODE === "prod" ? "unavailable" : "development mock"}`, r.text.includes(MODE === "prod" ? "Unavailable" : "Development mock"));
r = await adv.get("/admin/users");
check("non-admins get a 404 for admin pages", isNotFound(r), r.status);

// ── Suspension ──
const victim = await newUser("victim6", "advertiser", "Suspended Advertiser");
const victimCampaign = await createFundedCampaign(victim, "Phase6 Suspended Owner Campaign");
const victimId = psql(`select id from auth.users where email = '${victim.email}'`);
const adminId = psql(`select id from auth.users where email = '${admin.email}'`);
const sbVictim = createClient(SUPABASE_URL, PUBLISHABLE_KEY, { auth: { persistSession: false } });
await sbVictim.auth.signInWithPassword({ email: victim.email, password: PASSWORD });
const walletBefore = psql(`select coalesce(sum(balance_cents), 0) from wallet_account_balances b join wallet_accounts a on a.id = b.account_id where a.owner_id = '${victimId}'`);

r = await admin.get(`/admin/users/${victimId}`);
check("user detail shows the email and the suspend form", r.text.includes(victim.email) && r.text.includes("Suspend account"));
r = await admin.action(`/admin/users/${victimId}`, "suspendUser", [{ status: "idle" }, form({ userId: victimId, reason: "" })]);
check("suspending without a reason is refused", r.text.includes("at least 5 characters"), r.text.slice(0, 200));
r = await admin.action(`/admin/users/${adminId}`, "suspendUser", [{ status: "idle" }, form({ userId: adminId, reason: "Testing self suspension" })]);
check("an admin cannot suspend themselves", r.text.includes("can't suspend your own account"), r.text.slice(0, 200));
r = await victim.action(`/admin/users/${adminId}`, "suspendUser", [{ status: "idle" }, form({ userId: adminId, reason: "Not an admin trying" })]);
check("a non-admin cannot call the suspend action", r.text.includes("Only an active admin"), r.text.slice(0, 200));
r = await admin.action(`/admin/users/${victimId}`, "suspendUser", [{ status: "idle" }, form({ userId: victimId, reason: "Fake proof links on several campaigns" })]);
check("an admin suspends the user with a reason", r.text.includes("Account suspended"), r.text.slice(0, 200));

r = await victim.get("/dashboard");
check("the suspended user's open session is sent to sign-out", r.status === 307 && r.location?.includes("/auth/suspended") || r.text.includes("/auth/suspended"), `${r.status} ${r.location}`);
r = await victim.get("/auth/suspended");
check("sign-out explains the suspension", r.location?.includes("/login?error=account_suspended"), `${r.status} ${r.location}`);
r = await victim.get("/login?error=account_suspended");
check("the login page shows the suspension notice", r.text.includes("This account has been suspended"));
r = await victim.get("/dashboard");
check("after sign-out the dashboard requires login", r.status === 307 && r.location?.startsWith("/login"), `${r.status} ${r.location}`);
r = await new Session().action("/login", "signIn", [{ status: "idle" }, form({ email: victim.email, password: PASSWORD })]);
check("signing in again is refused with a suspension message", r.text.includes("This account has been suspended"), r.text.slice(0, 200));
let api = await sbVictim.from("campaigns").select("id");
check("a still-valid access token is rejected by the API", api.error?.message === "account_suspended", JSON.stringify(api.error ?? api.data));
api = await sbVictim.rpc("record_test_deposit", { p_amount_cents: 100, p_currency: "USD", p_provider_reference: "mock_susp", p_status: "succeeded", p_idempotency_key: "susp-key-0001" });
check("a suspended user cannot call database functions", api.error?.message === "account_suspended", JSON.stringify(api.error));
api = await sbVictim.storage.from("media-kits").upload(`${victimId}/x.pdf`, new Blob(["%PDF-1.4"], { type: "application/pdf" }));
check("a suspended user cannot upload files", Boolean(api.error));

check("the user's campaign is left as it was", psql(`select status from campaigns where id = '${victimCampaign.campaignId}'`) === "applications_open");
check("the user's wallet balance is unchanged", psql(`select coalesce(sum(balance_cents), 0) from wallet_account_balances b join wallet_accounts a on a.id = b.account_id where a.owner_id = '${victimId}'`) === walletBefore);
r = await admin.get("/admin/users?filter=suspended");
check("the user is listed under Suspended", r.text.includes(victim.email));
r = await admin.get("/admin/activity");
check("the activity log shows the suspension and reason", r.text.includes("Suspended account") && r.text.includes("Fake proof links on several campaigns"));
worker = await runEmailWorker();
check("the account notice is emailed even though the account is suspended", (await mailpitMessages(victim.email)).some((m) => m.Subject === "Your InfluencEarn account has been suspended"));

r = await admin.action(`/admin/users/${victimId}`, "unsuspendUser", [{ status: "idle" }, form({ userId: victimId, reason: "Appeal accepted" })]);
check("an admin reinstates the user", r.text.includes("Account reinstated"), r.text.slice(0, 200));
const again = new Session();
r = await again.action("/login", "signIn", [{ status: "idle" }, form({ email: victim.email, password: PASSWORD })]);
r = await again.get("/dashboard");
check("the reinstated user can sign in and use the app", r.status === 200, `${r.status} ${r.location}`);
r = await admin.get(`/admin/users/${victimId}`);
check("suspension history shows who reinstated and why", r.text.includes("Reinstated") && r.text.includes("Appeal accepted"));

finish();
