import "server-only";

import { createClient } from "@/lib/supabase/server";

export const NOTIFICATIONS_PAGE_SIZE = 20;

export async function getUnreadNotificationCount(userId: string): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient_id", userId)
    .is("read_at", null);
  if (error) return 0; // The badge must never break the page.
  return count ?? 0;
}

export async function listMyNotifications(userId: string, page: number, unreadOnly: boolean) {
  const supabase = await createClient();
  let query = supabase
    .from("notifications")
    .select("id, type, title, body, link_path, read_at, created_at", { count: "exact" })
    .eq("recipient_id", userId);
  if (unreadOnly) query = query.is("read_at", null);

  const offset = (page - 1) * NOTIFICATIONS_PAGE_SIZE;
  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + NOTIFICATIONS_PAGE_SIZE - 1);
  if (error) throw new Error("Notifications could not be loaded.", { cause: error });
  return { rows: data ?? [], total: count ?? 0 };
}
