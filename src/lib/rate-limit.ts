import "server-only";

import { createHash } from "node:crypto";

import { headers } from "next/headers";

import { createServiceClient } from "@/lib/supabase/admin";

/**
 * Server-side rate limits for flows that reach Supabase from this server (where Supabase only sees
 * the server's IP): sign-in, sign-up, password reset, uploads. Counters live in Postgres
 * (check_rate_limit, service_role only). Data API writes are limited separately in the database.
 */
export const RATE_LIMITS = {
  signInPerIp: { max: 30, windowSeconds: 600 },
  signInPerEmail: { max: 10, windowSeconds: 600 },
  signUpPerIp: { max: 20, windowSeconds: 3600 },
  passwordResetPerIp: { max: 10, windowSeconds: 3600 },
  passwordResetPerEmail: { max: 5, windowSeconds: 3600 },
  changePasswordPerUser: { max: 5, windowSeconds: 900 },
  changeEmailPerUser: { max: 5, windowSeconds: 3600 },
  uploadPerUser: { max: 20, windowSeconds: 3600 },
} as const;

export type RateLimitName = keyof typeof RATE_LIMITS;

let warnedUnconfigured = false;

/**
 * Client IP from the proxy header named by TRUSTED_IP_HEADER (default x-forwarded-for, first entry).
 * Only trust it behind a proxy that sets it (e.g. Vercel); otherwise clients can spoof it, which
 * weakens per-IP limits (per-email and per-user limits still apply).
 */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const name = (process.env.TRUSTED_IP_HEADER || "x-forwarded-for").toLowerCase();
  const value = h.get(name)?.split(",")[0]?.trim();
  return value || "unknown";
}

/** Subjects are hashed so emails and IPs aren't stored in clear text. */
const subjectKey = (value: string) => createHash("sha256").update(value.toLowerCase()).digest("hex").slice(0, 40);

/**
 * Counts one attempt; false when over the limit. Fails open (allows) only when the service key is
 * not configured — a launch requirement listed in the README.
 */
export async function hitRateLimit(name: RateLimitName, subject: string): Promise<boolean> {
  const supabase = createServiceClient();
  if (!supabase) {
    if (!warnedUnconfigured) {
      console.warn("Rate limiting is disabled: SUPABASE_SECRET_KEY is not configured.");
      warnedUnconfigured = true;
    }
    return true;
  }
  const { max, windowSeconds } = RATE_LIMITS[name];
  const { data, error } = await supabase.rpc("check_rate_limit", {
    p_subject: subjectKey(subject),
    p_action: name,
    p_max: max,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.error("Rate limit check failed", error.message);
    return true;
  }
  return data === true;
}

export const RATE_LIMITED_MESSAGE = "Too many attempts. Please wait a few minutes and try again.";
