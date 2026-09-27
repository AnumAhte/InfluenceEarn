import "server-only";

import type { CategorySlug, CreatorGender } from "@/domain/campaigns/catalog";
import type { CountryCode } from "@/domain/geo/countries";
import { createClient } from "@/lib/supabase/server";

export type CreatorDetails = {
  countryCode: CountryCode | null;
  dateOfBirth: string | null;
  gender: CreatorGender | null;
  categories: CategorySlug[];
};

/** The signed-in creator's private eligibility details (empty if never saved). */
export async function getMyCreatorDetails(userId: string): Promise<CreatorDetails> {
  const supabase = await createClient();
  const [profile, categories] = await Promise.all([
    supabase.from("creator_profiles").select("country_code, date_of_birth, gender").eq("user_id", userId).maybeSingle(),
    supabase.from("creator_profile_categories").select("category_slug").eq("user_id", userId),
  ]);
  if (profile.error || categories.error) {
    throw new Error("Creator details could not be loaded.", { cause: profile.error ?? categories.error });
  }
  return {
    countryCode: (profile.data?.country_code as CountryCode | null | undefined) ?? null,
    dateOfBirth: profile.data?.date_of_birth ?? null,
    gender: profile.data?.gender ?? null,
    categories: (categories.data ?? []).map((row) => row.category_slug as CategorySlug),
  };
}
