"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import type { ActionState } from "@/lib/forms/action-state";
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

const checkbox = z.preprocess((v) => v === "on", z.boolean());

/** Saves the signed-in user's email opt-outs. In-app notifications are unaffected. */
export async function saveEmailPreferences(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z
    .object({ applications: checkbox, work: checkbox, payments: checkbox })
    .parse({ applications: formData.get("applications"), work: formData.get("work"), payments: formData.get("payments") });

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) redirect("/login");

  const { error } = await supabase.from("notification_preferences").upsert({
    user_id: userId,
    email_applications: parsed.applications,
    email_work: parsed.work,
    email_payments: parsed.payments,
    updated_at: new Date().toISOString(),
  });
  if (error) return { status: "error", message: "Your preferences could not be saved. Please try again." };

  revalidatePath("/settings/notifications");
  return { status: "success", message: "Email preferences saved." };
}
