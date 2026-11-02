"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { creatorProfileSchema } from "@/domain/creators/schemas";
import { firstFieldErrors, formString, type ActionState } from "@/lib/forms/action-state";
import { createClient } from "@/lib/supabase/server";

import { cleanFileName, validateMediaKit } from "./media-kit";

export type CreatorField = "countryCode" | "dateOfBirth" | "gender" | "categories";

/** Saves private eligibility details. Advertisers only ever see an application snapshot. */
export async function saveCreatorDetails(
  _previous: ActionState<CreatorField>,
  formData: FormData,
): Promise<ActionState<CreatorField>> {
  const today = new Date().toISOString().slice(0, 10);
  const raw = {
    countryCode: formString(formData, "countryCode") || null,
    dateOfBirth: formString(formData, "dateOfBirth") || null,
    gender: formString(formData, "gender") || null,
    categories: formData.getAll("categories").filter((v): v is string => typeof v === "string"),
  };
  const parsed = creatorProfileSchema(today).safeParse(raw);
  if (!parsed.success) {
    return { status: "error", message: "Check the highlighted fields.", fieldErrors: firstFieldErrors<CreatorField>(parsed.error) };
  }

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) redirect("/login");

  const { error } = await supabase.rpc("save_creator_profile", {
    p_country_code: parsed.data.countryCode ?? undefined,
    p_date_of_birth: parsed.data.dateOfBirth ?? undefined,
    p_gender: parsed.data.gender ?? undefined,
    p_categories: parsed.data.categories,
  });

  if (error) {
    const message = error.message.startsWith("creator_too_young")
      ? "You must be at least 13 to use InfluencEarn as a creator."
      : "Your details could not be saved. Please try again.";
    return { status: "error", message };
  }

  revalidatePath("/", "layout");
  return { status: "success", message: "Creator details saved." };
}

/** Uploads (or replaces) the creator's media kit PDF. */
export async function uploadMediaKit(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const file = formData.get("mediaKit");
  if (!(file instanceof File) || file.size === 0) return { status: "error", message: "Choose a PDF to upload." };
  const head = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  const check = validateMediaKit(file, head);
  if (!check.ok) return { status: "error", message: check.error };

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) redirect("/login");

  const path = `${userId}/media-kit-${Date.now()}.pdf`;
  const upload = await supabase.storage.from("media-kits").upload(path, file, { contentType: "application/pdf", upsert: false });
  if (upload.error) return { status: "error", message: "Your media kit could not be uploaded. Please try again." };

  const { data: current } = await supabase.from("creator_media_kits").select("path").eq("user_id", userId).maybeSingle();
  const { error } = await supabase.from("creator_media_kits").upsert({
    user_id: userId,
    path,
    file_name: cleanFileName(file.name),
    size_bytes: file.size,
    uploaded_at: new Date().toISOString(),
  });
  if (error) {
    await supabase.storage.from("media-kits").remove([path]);
    return { status: "error", message: "Your media kit could not be saved. Please try again." };
  }
  // Replace the previous file instead of accumulating files.
  if (current?.path && current.path !== path) await supabase.storage.from("media-kits").remove([current.path]);

  revalidatePath("/settings/creator");
  return { status: "success", message: "Media kit uploaded." };
}

export async function removeMediaKit(): Promise<ActionState> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) redirect("/login");

  const { data: current } = await supabase.from("creator_media_kits").select("path").eq("user_id", userId).maybeSingle();
  if (!current) return { status: "success", message: "Media kit removed." };
  const { error } = await supabase.from("creator_media_kits").delete().eq("user_id", userId);
  if (error) return { status: "error", message: "Your media kit could not be removed. Please try again." };
  await supabase.storage.from("media-kits").remove([current.path]);

  revalidatePath("/settings/creator");
  return { status: "success", message: "Media kit removed." };
}
