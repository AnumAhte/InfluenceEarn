import { renderNotificationEmail, type RenderedEmail } from "./template";

/** A queued notification claimed by `claim_notification_emails`. */
export type ClaimedEmail = {
  notification_id: string;
  attempt: number;
  recipient_email: string;
  recipient_name: string | null;
  title: string;
  body: string;
  link_path: string | null;
};

/** Result of handing one message to the SMTP server. */
export type SendOutcome = { accepted: boolean; messageId: string | null; error: string | null };

export type EmailQueue = {
  claim(limit: number): Promise<ClaimedEmail[]>;
  record(id: string, attempt: number, outcome: SendOutcome): Promise<string>;
};

export type SendEmail = (to: string, email: RenderedEmail) => Promise<SendOutcome>;

export type WorkerSummary = { claimed: number; sent: number; retrying: number; failed: number; errors: number };

/**
 * Sends one batch. A message counts as "sent" only when the SMTP server accepted it for the
 * recipient; everything else is recorded as a failed attempt (retried with backoff by the database).
 */
export async function processEmailBatch(queue: EmailQueue, send: SendEmail, siteUrl: string, limit = 20): Promise<WorkerSummary> {
  const summary: WorkerSummary = { claimed: 0, sent: 0, retrying: 0, failed: 0, errors: 0 };
  const batch = await queue.claim(limit);
  summary.claimed = batch.length;

  for (const item of batch) {
    const email = renderNotificationEmail({
      recipientName: item.recipient_name,
      title: item.title,
      body: item.body,
      linkPath: item.link_path,
      siteUrl,
    });
    let outcome: SendOutcome;
    try {
      outcome = await send(item.recipient_email, email);
    } catch (error) {
      outcome = { accepted: false, messageId: null, error: describeSendError(error) };
    }
    try {
      const status = await queue.record(item.notification_id, item.attempt, outcome);
      if (status === "sent") summary.sent++;
      else if (status === "failed") summary.failed++;
      else summary.retrying++;
    } catch {
      // Could not record (e.g. stale attempt). The lease expires and the row is retried.
      summary.errors++;
    }
  }
  return summary;
}

/** Short, non-sensitive error code for storage (no SMTP transcript, no credentials). */
export function describeSendError(error: unknown): string {
  if (error && typeof error === "object") {
    const e = error as { code?: unknown; responseCode?: unknown };
    const code = typeof e.code === "string" ? e.code : "send_failed";
    return typeof e.responseCode === "number" ? `${code}:${e.responseCode}` : code;
  }
  return "send_failed";
}
