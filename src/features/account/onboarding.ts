import type { Tables } from "@/lib/supabase/database.types";

type OnboardingFields = Pick<Tables<"profiles">, "workspace_chosen_at" | "onboarding_completed_at">;

export type OnboardingPath = "/onboarding/role" | "/onboarding/profile";

/** Where an unfinished account must go next, or null once onboarding is done. */
export function nextOnboardingPath(profile: OnboardingFields): OnboardingPath | null {
  if (!profile.workspace_chosen_at) return "/onboarding/role";
  if (!profile.onboarding_completed_at) return "/onboarding/profile";
  return null;
}

export function initialsFor(name: string, fallback = "?"): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fallback;
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}

export function firstNameOf(name: string): string {
  return name.trim().split(/\s+/)[0] ?? "";
}
