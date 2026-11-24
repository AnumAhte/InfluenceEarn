import { timingSafeEqual } from "node:crypto";

import type { NextRequest } from "next/server";

import { deliverQueuedNotificationEmails } from "@/features/notifications/email/delivery";

/**
 * Email worker trigger, called by a scheduler (cron) with `Authorization: Bearer $EMAIL_WORKER_SECRET`.
 * It only processes notification rows already queued by the database; the request carries no
 * recipient or content. Without the secret configured, the endpoint does not exist (404).
 */
export const dynamic = "force-dynamic";

function authorized(request: NextRequest, secret: string) {
  const header = request.headers.get("authorization") ?? "";
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(header);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function POST(request: NextRequest) {
  const secret = process.env.EMAIL_WORKER_SECRET;
  if (!secret || secret.length < 32) return new Response(null, { status: 404 });
  if (!authorized(request, secret)) return Response.json({ error: "unauthorized" }, { status: 401 });

  const result = await deliverQueuedNotificationEmails();
  if (result.status === "not_configured") {
    // Notifications stay queued (pending); nothing is marked sent or skipped.
    return Response.json({ error: "email_not_configured", missing: result.missing }, { status: 503 });
  }
  return Response.json(result.summary);
}
