"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { creatorProfileSchema } from "@/domain/creators/schemas";
import { firstFieldErrors, formString, type ActionState } from "@/lib/forms/action-state";
import { createClient } from "@/lib/supabase/server";

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
