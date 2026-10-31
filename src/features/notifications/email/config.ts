import "server-only";

import { z } from "zod";

/**
 * SMTP settings (server-only; never NEXT_PUBLIC_). Provider-agnostic: Mailpit locally
 * (127.0.0.1:54325, no auth), any SMTP provider in production (e.g. Resend: smtp.resend.com:465,
 * user "resend", password = API key) once the sender domain is verified.
 */
const smtpSchema = z.object({
  host: z.string().min(1),
  port: z.coerce.number().int().min(1).max(65535),
  secure: z.enum(["true", "false"]).transform((v) => v === "true"),
  user: z.string().optional(),
  password: z.string().optional(),
  from: z.string().min(3),
});

export type SmtpConfig = z.infer<typeof smtpSchema>;

/** Null when email isn't configured; the worker then leaves notifications queued. */
export function getSmtpConfig(env: NodeJS.ProcessEnv = process.env): SmtpConfig | null {
  if (!env.SMTP_HOST || !env.EMAIL_FROM) return null;
  const parsed = smtpSchema.safeParse({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT ?? "587",
    secure: env.SMTP_SECURE ?? "false",
    user: env.SMTP_USER || undefined,
    password: env.SMTP_PASSWORD || undefined,
    from: env.EMAIL_FROM,
  });
  return parsed.success ? parsed.data : null;
}
