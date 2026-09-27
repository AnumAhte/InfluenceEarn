import "server-only";

import type { SocialPlatform } from "@/domain/campaigns/catalog";
import { createClient } from "@/lib/supabase/server";

export type SocialAccountRow = {
  id: string;
  platform: SocialPlatform;
  handle: string;
  follower_count: number | null;
  connection_method: "manual" | "oauth";
  verification_status: "unverified" | "verified";
  created_at: string;
};

/** The user's currently connected accounts, one per platform at most. */
export async function listMySocialAccounts(userId: string): Promise<SocialAccountRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("social_accounts")
    .select("id, platform, handle, follower_count, connection_method, verification_status, created_at")
    .eq("user_id", userId)
    .eq("status", "connected")
    .order("platform");

  if (error) throw new Error("Social accounts could not be loaded.", { cause: error });
  return data ?? [];
}
