import { describe, expect, it } from "vitest";

import { getSmtpConfig } from "./config";
import { notificationUrl, renderNotificationEmail } from "./template";
import { describeSendError, processEmailBatch, type ClaimedEmail, type EmailQueue, type SendOutcome } from "./worker";

const SITE = "https://app.example.com";

describe("renderNotificationEmail", () => {
  it("escapes notification content in the HTML body", () => {
    const email = renderNotificationEmail({ recipientName: "Ana <b>Rivera</b>", title: "New <script>", body: `"Summer" & <img src=x>`, linkPath: "/tasks/1", siteUrl: SITE });
    expect(email.html).not.toContain("<script>");
    expect(email.html).not.toContain("<img src=x>");
    expect(email.html).toContain("&quot;Summer&quot; &amp; &lt;img src=x&gt;");
    expect(email.text).toContain(`"Summer" & <img src=x>`);
  });

  it("keeps the subject on one line", () => {
    expect(renderNotificationEmail({ recipientName: null, title: "Line\r\nBcc: x@y.z", body: "b", linkPath: null, siteUrl: SITE }).subject).toBe("Line Bcc: x@y.z");
  });

  it("links only to same-site paths", () => {
    expect(notificationUrl(SITE, "/campaigns/1")).toBe(`${SITE}/campaigns/1`);
    expect(notificationUrl(SITE, "//evil.example")).toBe(`${SITE}/notifications`);
    expect(notificationUrl(SITE, "/\\evil.example")).toBe(`${SITE}/notifications`);
    expect(notificationUrl(SITE, "https://evil.example")).toBe(`${SITE}/notifications`);
    expect(notificationUrl(SITE, null)).toBe(`${SITE}/notifications`);
  });

  it("includes the preferences link", () => {
    expect(renderNotificationEmail({ recipientName: null, title: "t", body: "b", linkPath: null, siteUrl: SITE }).text).toContain(`${SITE}/settings/notifications`);
  });
});

function fakeQueue(items: ClaimedEmail[], statuses: Record<string, string | Error>) {
  const recorded: { id: string; attempt: number; outcome: SendOutcome }[] = [];
  const queue: EmailQueue = {
    claim: async () => items,
    record: async (id, attempt, outcome) => {
      recorded.push({ id, attempt, outcome });
      const s = statuses[id];
      if (s instanceof Error) throw s;
      return s;
    },
  };
  return { queue, recorded };
}

const item = (id: string): ClaimedEmail => ({ notification_id: id, attempt: 1, recipient_email: `${id}@test.local`, recipient_name: null, title: "t", body: "b", link_path: null });

describe("processEmailBatch", () => {
  it("records sent only when the SMTP server accepted the message", async () => {
    const { queue, recorded } = fakeQueue([item("a"), item("b")], { a: "sent", b: "pending" });
    const summary = await processEmailBatch(queue, async (to) => (to.startsWith("a") ? { accepted: true, messageId: "<m1>", error: null } : { accepted: false, messageId: null, error: "recipient_rejected" }), SITE);
    expect(recorded.map((r) => r.outcome.accepted)).toEqual([true, false]);
    expect(summary).toEqual({ claimed: 2, sent: 1, retrying: 1, failed: 0, errors: 0 });
  });

  it("treats a thrown send as a failed attempt with a short error code", async () => {
    const { queue, recorded } = fakeQueue([item("a")], { a: "failed" });
    const summary = await processEmailBatch(queue, async () => { throw Object.assign(new Error("530 auth required, secret=xyz"), { code: "EAUTH", responseCode: 530 }); }, SITE);
    expect(recorded[0].outcome).toEqual({ accepted: false, messageId: null, error: "EAUTH:530" });
    expect(summary.failed).toBe(1);
  });

  it("counts results it could not record (row retried after the lease expires)", async () => {
    const { queue } = fakeQueue([item("a")], { a: new Error("stale_email_attempt") });
    const summary = await processEmailBatch(queue, async () => ({ accepted: true, messageId: null, error: null }), SITE);
    expect(summary).toMatchObject({ sent: 0, errors: 1 });
  });

  it("describes unknown errors generically", () => {
    expect(describeSendError("boom")).toBe("send_failed");
    expect(describeSendError({ code: "ECONNREFUSED" })).toBe("ECONNREFUSED");
  });
});

describe("getSmtpConfig", () => {
  it("is null until host and sender are set", () => {
    expect(getSmtpConfig({} as NodeJS.ProcessEnv)).toBeNull();
    expect(getSmtpConfig({ SMTP_HOST: "smtp.example.com" } as unknown as NodeJS.ProcessEnv)).toBeNull();
  });

  it("parses a provider configuration", () => {
    expect(getSmtpConfig({ SMTP_HOST: "smtp.resend.com", SMTP_PORT: "465", SMTP_SECURE: "true", SMTP_USER: "resend", SMTP_PASSWORD: "re_x", EMAIL_FROM: "IE <n@x.com>" } as unknown as NodeJS.ProcessEnv))
      .toEqual({ host: "smtp.resend.com", port: 465, secure: true, user: "resend", password: "re_x", from: "IE <n@x.com>" });
  });
});
