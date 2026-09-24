"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { firstFieldErrors, formString, type ActionState } from "@/lib/forms/action-state";
import { createClient } from "@/lib/supabase/server";

import { profileSchema, validateAvatarFile, workspaceSchema } from "./schemas";

export type ProfileField = "fullName" | "phone" | "city" | "bio" | "avatar";

async function getUserIdOrRedirect() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/login");
  return { supabase, userId };
}

/** Onboarding step 1: pick the workspace to start in. */
export async function chooseInitialWorkspace(formData: FormData) {
  const parsed = workspaceSchema.safeParse(formString(formData, "workspace"));
  if (!parsed.success) redirect("/onboarding/role?error=invalid_role");

  const { supabase, userId } = await getUserIdOrRedirect();
  const { error } = await supabase
    .from("profiles")
    .update({ active_workspace: parsed.data, workspace_chosen_at: new Date().toISOString() })
    .eq("id", userId);

  if (error) redirect("/onboarding/role?error=save_failed");
  redirect("/onboarding/profile");
}

/** Header role switcher. Switching changes only which workspace is shown. */
export async function switchWorkspace(formData: FormData) {
  const parsed = workspaceSchema.safeParse(formString(formData, "workspace"));
  if (!parsed.success) redirect("/dashboard");

  const { supabase, userId } = await getUserIdOrRedirect();
  const { error } = await supabase
    .from("profiles")
    .update({ active_workspace: parsed.data })
    .eq("id", userId);

  if (error) throw new Error("Could not switch role. Please try again.", { cause: error });

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

/** Onboarding step 2 can be skipped; details can be added later in settings. */
export async function skipProfileSetup() {
  const { supabase, userId } = await getUserIdOrRedirect();
  const { error } = await supabase
    .from("profiles")
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq("id", userId);

  if (error) throw new Error("Could not save your progress. Please try again.", { cause: error });
  redirect("/dashboard");
}

/**
 * Saves profile details and an optional new photo.
 * `intent=onboarding` also completes onboarding and continues to the dashboard.
 */
export async function saveProfile(
  _previous: ActionState<ProfileField>,
  formData: FormData,
): Promise<ActionState<ProfileField>> {
  const values = {
    fullName: formString(formData, "fullName"),
    phone: formString(formData, "phone"),
    city: formString(formData, "city"),
    bio: formString(formData, "bio"),
  };
  const parsed = profileSchema.safeParse(values);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Check the highlighted fields.",
      fieldErrors: firstFieldErrors<ProfileField>(parsed.error),
      values,
    };
  }

  const { supabase, userId } = await getUserIdOrRedirect();
  const isOnboarding = formString(formData, "intent") === "onboarding";

  let newAvatarPath: string | undefined;
  const avatar = formData.get("avatar");
  if (avatar instanceof File && avatar.size > 0) {
    const check = validateAvatarFile(avatar);
    if (!check.ok) {
      return { status: "error", message: check.error, fieldErrors: { avatar: check.error }, values };
    }
    newAvatarPath = `${userId}/avatar-${Date.now()}.${check.extension}`;
    const upload = await supabase.storage
      .from("avatars")
      .upload(newAvatarPath, avatar, { contentType: avatar.type, upsert: false });
    if (upload.error) {
      return { status: "error", message: "Your photo could not be uploaded. Please try again.", values };
    }
  }

  const { data: current } = await supabase
    .from("profiles")
    .select("avatar_path")
    .eq("id", userId)
    .single();

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.fullName,
      phone: parsed.data.phone,
      city: parsed.data.city,
      bio: parsed.data.bio,
      ...(newAvatarPath ? { avatar_path: newAvatarPath } : {}),
      ...(isOnboarding ? { onboarding_completed_at: new Date().toISOString() } : {}),
    })
    .eq("id", userId);

  if (error) {
    if (newAvatarPath) await supabase.storage.from("avatars").remove([newAvatarPath]);
    return { status: "error", message: "Your profile could not be saved. Please try again.", values };
  }

  // Replace the previous photo instead of accumulating files.
  if (newAvatarPath && current?.avatar_path && current.avatar_path !== newAvatarPath) {
    await supabase.storage.from("avatars").remove([current.avatar_path]);
  }

  revalidatePath("/", "layout");
  if (isOnboarding) redirect("/dashboard");
  return { status: "success", message: "Profile saved.", values };
}
