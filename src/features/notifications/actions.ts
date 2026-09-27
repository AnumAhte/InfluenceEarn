"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/utils/safe-redirect";

/** Marks one notification read and follows its link (only same-origin paths). */
export async function openNotification(formData: FormData) {
  const input = z
    .object({ id: z.uuid(), link: z.string().optional() })
    .safeParse({ id: formData.get("id"), link: formData.get("link") ?? undefined });
  if (!input.success) redirect("/notifications");

  const supabase = await createClient();
  await supabase.rpc("mark_notifications_read", { p_ids: [input.data.id] });
  revalidatePath("/", "layout");
  redirect(safeRedirectPath(input.data.link, "/notifications"));
}

export async function markAllNotificationsRead() {
  const supabase = await createClient();
  await supabase.rpc("mark_notifications_read", {});
  revalidatePath("/", "layout");
}
