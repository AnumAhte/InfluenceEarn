// Phase 6 end-to-end: legal pages, account suspension, notification emails, media kits,
// account settings and rate limits, through the real app.
//
// Runs in both modes. Run from the repo root: MODE=prod node scripts/e2e/marketplace-phase6.mjs
import { APP, Session, check, createFundedCampaign, envLocal, finish, form, mailpitMessage, mailpitMessages, newUser, psql, runEmailWorker } from "./harness.mjs";

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

finish();
