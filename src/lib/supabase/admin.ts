import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getPublicEnv } from "@/lib/env";
import type { Database } from "./database.types";

/**
 * Service-role client. Bypasses RLS, so it is used only by trusted server-side jobs that call
 * functions granted to `service_role` (e.g. the notification email worker) — never with user input
 * deciding what to read or write. Returns null when the secret key isn't configured.
 */
export function createServiceClient() {
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!secretKey) return null;
  return createClient<Database>(getPublicEnv().supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
