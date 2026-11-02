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

export const MEDIA_KIT_URL_TTL_SECONDS = 600;

export type MediaKit = { fileName: string; sizeBytes: number; uploadedAt: string; url: string | null };

export async function getMyMediaKit(userId: string): Promise<MediaKit | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("creator_media_kits").select("path, file_name, size_bytes, uploaded_at").eq("user_id", userId).maybeSingle();
  if (!data) return null;
  const { data: signed } = await supabase.storage.from("media-kits").createSignedUrl(data.path, MEDIA_KIT_URL_TTL_SECONDS);
  return { fileName: data.file_name, sizeBytes: data.size_bytes, uploadedAt: data.uploaded_at, url: signed?.signedUrl ?? null };
}

/**
 * Signed media kit links for creators the signed-in user may see (RLS: themselves, admins, and
 * advertisers the creator applied to). Creators without a kit are absent from the map.
 */
export async function getMediaKitLinks(creatorIds: string[]): Promise<Map<string, string>> {
  const links = new Map<string, string>();
  if (creatorIds.length === 0) return links;
  const supabase = await createClient();
  const { data } = await supabase.from("creator_media_kits").select("user_id, path").in("user_id", [...new Set(creatorIds)]);
  if (!data?.length) return links;
  const { data: signed } = await supabase.storage.from("media-kits").createSignedUrls(data.map((k) => k.path), MEDIA_KIT_URL_TTL_SECONDS);
  for (const kit of data) {
    const url = signed?.find((s) => s.path === kit.path)?.signedUrl;
    if (url) links.set(kit.user_id, url);
  }
  return links;
}
