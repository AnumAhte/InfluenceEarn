import "server-only";

import nodemailer from "nodemailer";

import { createServiceClient } from "@/lib/supabase/admin";
import { getPublicEnv } from "@/lib/env";

import { getSmtpConfig } from "./config";
import { processEmailBatch, type EmailQueue, type SendEmail, type WorkerSummary } from "./worker";

export type DeliveryResult =
  | { status: "ok"; summary: WorkerSummary }
  | { status: "not_configured"; missing: "smtp" | "service_key" };

/** Claims queued notification emails, sends them over SMTP and records each outcome. */
export async function deliverQueuedNotificationEmails(limit = 20): Promise<DeliveryResult> {
  const smtp = getSmtpConfig();
  if (!smtp) return { status: "not_configured", missing: "smtp" };
  const supabase = createServiceClient();
  if (!supabase) return { status: "not_configured", missing: "service_key" };

  const transport = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: smtp.user ? { user: smtp.user, pass: smtp.password } : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });

  const queue: EmailQueue = {
    async claim(batchSize) {
      const { data, error } = await supabase.rpc("claim_notification_emails", { p_limit: batchSize, p_lease_seconds: 120 });
      if (error) throw new Error(`claim failed: ${error.message}`);
      return data ?? [];
    },
    async record(id, attempt, outcome) {
      const { data, error } = await supabase.rpc("record_notification_email_result", {
        p_notification_id: id,
        p_attempt: attempt,
        p_sent: outcome.accepted,
        p_message_id: outcome.messageId ?? undefined,
        p_error: outcome.error ?? undefined,
      });
      if (error) throw new Error(error.message);
      return data;
    },
  };

  const send: SendEmail = async (to, email) => {
    const info = await transport.sendMail({ from: smtp.from, to, subject: email.subject, text: email.text, html: email.html });
    // Accepted by the SMTP server for this recipient — not proof of inbox delivery.
    const accepted = info.accepted.map(String).includes(to) && info.rejected.length === 0;
    return { accepted, messageId: info.messageId ?? null, error: accepted ? null : "recipient_rejected" };
  };

  try {
    return { status: "ok", summary: await processEmailBatch(queue, send, getPublicEnv().siteUrl, limit) };
  } finally {
    transport.close();
  }
}
