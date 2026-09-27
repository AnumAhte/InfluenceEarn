"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { PLATFORM_META } from "@/domain/campaigns/catalog";
import { socialAccountSchema } from "@/domain/creators/schemas";
import { firstFieldErrors, formString, type ActionState } from "@/lib/forms/action-state";
import { createClient } from "@/lib/supabase/server";

import { getSocialAccountProvider } from "./providers";

export type SocialField = "platform" | "handle" | "followerCount";

async function requireUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/login");
  return { supabase, userId };
}

function readForm(formData: FormData) {
  return {
    platform: formString(formData, "platform"),
    handle: formString(formData, "handle"),
    followerCount: formString(formData, "followerCount"),
  };
}

/**
 * Links a social account MANUALLY: handle + self-reported follower count.
 * Stored unverified; nothing here claims the platform confirmed anything.
 */
export async function connectSocialAccount(
  _previous: ActionState<SocialField>,
  formData: FormData,
): Promise<ActionState<SocialField>> {
  const values = readForm(formData);
  const parsed = socialAccountSchema.safeParse(values);
  if (!parsed.success) {
    return { status: "error", message: "Check the highlighted fields.", fieldErrors: firstFieldErrors<SocialField>(parsed.error), values };
  }

  const provider = getSocialAccountProvider(parsed.data.platform);
  if (provider.method !== "manual") {
    return { status: "error", message: "This platform can only be connected through its own sign-in.", values };
  }

  const { supabase } = await requireUser();
  const { error } = await supabase.from("social_accounts").insert({
    platform: parsed.data.platform,
    handle: parsed.data.handle,
    follower_count: parsed.data.followerCount,
  });

  if (error) {
    const message =
      error.code === "23505"
        ? `You already have a ${PLATFORM_META[parsed.data.platform].label} account connected. Update or disconnect it first.`
        : "The account could not be connected. Please try again.";
    return { status: "error", message, values };
  }

  revalidatePath("/", "layout");
  return { status: "success", message: `${PLATFORM_META[parsed.data.platform].label} connected.` };
}

const updateSchema = z.object({ accountId: z.uuid() });

/** Updates handle / follower count of a connected account (still self-reported). */
export async function updateSocialAccount(
  _previous: ActionState<SocialField>,
  formData: FormData,
): Promise<ActionState<SocialField>> {
  const values = readForm(formData);
  const id = updateSchema.safeParse({ accountId: formData.get("accountId") });
  const parsed = socialAccountSchema.safeParse(values);
  if (!id.success) return { status: "error", message: "Invalid request.", values };
  if (!parsed.success) {
    return { status: "error", message: "Check the highlighted fields.", fieldErrors: firstFieldErrors<SocialField>(parsed.error), values };
  }

  const { supabase, userId } = await requireUser();
  const { data, error } = await supabase
    .from("social_accounts")
    .update({ handle: parsed.data.handle, follower_count: parsed.data.followerCount })
    .eq("id", id.data.accountId)
    .eq("user_id", userId)
    .eq("status", "connected")
    .select("id");

  if (error || !data?.length) return { status: "error", message: "The account could not be updated.", values };

  revalidatePath("/", "layout");
  return { status: "success", message: "Account updated." };
}

/** Disconnects (keeps history). Existing applications keep their snapshot. */
export async function disconnectSocialAccount(formData: FormData) {
  const id = updateSchema.safeParse({ accountId: formData.get("accountId") });
  if (!id.success) return;
  const { supabase, userId } = await requireUser();
  const { error } = await supabase
    .from("social_accounts")
    .update({ status: "disconnected" })
    .eq("id", id.data.accountId)
    .eq("user_id", userId);
  if (error) throw new Error("The account could not be disconnected.", { cause: error });
  revalidatePath("/", "layout");
}
