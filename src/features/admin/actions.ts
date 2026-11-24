"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import type { ActionState } from "@/lib/forms/action-state";
import { createClient } from "@/lib/supabase/server";

const SUSPENSION_ERRORS: Record<string, string> = {
  admin_required: "Only an active admin can do this.",
  suspension_reason_required: "Give a reason of at least 5 characters.",
  cannot_suspend_self: "You can't suspend your own account.",
  cannot_suspend_last_admin: "You can't suspend the last active admin.",
  already_suspended: "This account is already suspended.",
  not_suspended: "This account isn't suspended.",
  user_not_found: "User not found.",
};

function describe(message: string | undefined) {
  const code = (message ?? "").split(/[:\s]/)[0];
  return SUSPENSION_ERRORS[code] ?? "Something went wrong. Please try again.";
}

const suspendSchema = z.object({
  userId: z.uuid(),
  reason: z.string().trim().min(5, { error: "Give a reason of at least 5 characters." }).max(500, { error: "Keep the reason under 500 characters." }),
});

/** Suspends an account. The database re-checks the admin role, self-suspension and the last-admin rule. */
export async function suspendUser(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = suspendSchema.safeParse({ userId: formData.get("userId"), reason: formData.get("reason") });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Check the form." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("suspend_user", { p_user_id: parsed.data.userId, p_reason: parsed.data.reason });
  if (error) return { status: "error", message: describe(error.message) };

  revalidatePath("/admin/users", "layout");
  // The page switches to the reinstate form, so the confirmation travels in the URL.
  redirect(`/admin/users/${parsed.data.userId}?notice=suspended`);
}

const unsuspendSchema = z.object({ userId: z.uuid(), reason: z.string().trim().max(500).optional() });

export async function unsuspendUser(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = unsuspendSchema.safeParse({ userId: formData.get("userId"), reason: formData.get("reason") ?? undefined });
  if (!parsed.success) return { status: "error", message: "Keep the note under 500 characters." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("unsuspend_user", { p_user_id: parsed.data.userId, p_reason: parsed.data.reason || undefined });
  if (error) return { status: "error", message: describe(error.message) };

  revalidatePath("/admin/users", "layout");
  redirect(`/admin/users/${parsed.data.userId}?notice=reinstated`);
}
