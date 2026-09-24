import { createBrowserClient } from "@supabase/ssr";

import { getPublicEnv } from "@/lib/env";
import type { Database } from "./database.types";

/** Supabase client for Client Components. Uses only the publishable key. */
export function createClient() {
  const { supabaseUrl, supabasePublishableKey } = getPublicEnv();
  return createBrowserClient<Database>(supabaseUrl, supabasePublishableKey);
}
