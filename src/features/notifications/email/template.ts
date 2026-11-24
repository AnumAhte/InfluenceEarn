/**
 * Renders a notification email. Content comes only from the notification row the database created
 * (title, body, link); the link is always on our own site.
 */
export type NotificationEmailInput = {
  recipientName: string | null;
  title: string;
  body: string;
  linkPath: string | null;
  siteUrl: string;
};

export type RenderedEmail = { subject: string; text: string; html: string };

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (c) => ESCAPES[c]);

/** Only same-site relative paths (as enforced by the notifications table) become links. */
export function notificationUrl(siteUrl: string, linkPath: string | null) {
  if (!linkPath || !/^\/[^/\\]/.test(linkPath)) return `${siteUrl}/notifications`;
  return `${siteUrl}${linkPath}`;
}

export function renderNotificationEmail(input: NotificationEmailInput): RenderedEmail {
  const url = notificationUrl(input.siteUrl, input.linkPath);
  const preferencesUrl = `${input.siteUrl}/settings/notifications`;
  // Header-safe subject: no line breaks.
  const subject = input.title.replace(/[\r\n]+/g, " ").trim().slice(0, 140);
  const greeting = input.recipientName ? `Hi ${input.recipientName.split(/\s+/)[0]},` : "Hi,";

  const text = [
    greeting,
    "",
    input.body,
    "",
    `Open in InfluencEarn: ${url}`,
    "",
    "—",
    `You receive this email because of activity on your InfluencEarn account. Manage email preferences: ${preferencesUrl}`,
  ].join("\n");

  const html = `<!doctype html>
<html><body style="margin:0;background:#F6F9F8;font-family:Arial,Helvetica,sans-serif;color:#08201F">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border:1px solid #E0E8E7;border-radius:16px">
<tr><td style="padding:28px 28px 8px;font-size:15px;font-weight:bold;color:#0C7D8C">InfluencEarn</td></tr>
<tr><td style="padding:8px 28px 0;font-size:20px;font-weight:bold">${escapeHtml(subject)}</td></tr>
<tr><td style="padding:12px 28px 0;font-size:15px;line-height:1.55;color:#2E4644">${escapeHtml(greeting)}<br><br>${escapeHtml(input.body)}</td></tr>
<tr><td style="padding:22px 28px 28px"><a href="${escapeHtml(url)}" style="display:inline-block;background:#0C7D8C;color:#FFFFFF;text-decoration:none;font-weight:bold;font-size:14px;padding:12px 20px;border-radius:12px">Open in InfluencEarn</a></td></tr>
</table>
<p style="max-width:560px;font-size:12px;line-height:1.5;color:#5E7573;padding:16px 12px 0;margin:0">You receive this email because of activity on your InfluencEarn account.
<a href="${escapeHtml(preferencesUrl)}" style="color:#0C7D8C">Manage email preferences</a>.</p>
</td></tr></table>
</body></html>`;

  return { subject, text, html };
}
