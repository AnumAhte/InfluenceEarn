import "server-only";

import { notFound, redirect } from "next/navigation";
import { cache } from "react";

import type { Tables } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

import { nextOnboardingPath } from "./onboarding";

export type CurrentAccount = {
  userId: string;
  email: string;
  profile: Tables<"profiles">;
  /** Resolved from `user_roles` on the server. Never taken from client input. */
  isAdmin: boolean;
  avatarUrl: string | null;
};

const AVATAR_URL_TTL_SECONDS = 60 * 60;

/** The signed-in user's account, loaded once per request. */
export const getCurrentAccount = cache(async (): Promise<CurrentAccount | null> => {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  if (!claims?.sub) return null;

  const [profileResult, adminResult] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", claims.sub).single(),
    supabase.rpc("is_admin"),
  ]);

  if (profileResult.error || !profileResult.data) {
    throw new Error("Your profile could not be loaded.", { cause: profileResult.error });
  }
  if (adminResult.error) {
    throw new Error("Your permissions could not be loaded.", { cause: adminResult.error });
  }

  const profile = profileResult.data;
  let avatarUrl: string | null = null;
  if (profile.avatar_path) {
    const { data } = await supabase.storage
      .from("avatars")
      .createSignedUrl(profile.avatar_path, AVATAR_URL_TTL_SECONDS);
    avatarUrl = data?.signedUrl ?? null;
  }

  return {
    userId: claims.sub,
    email: typeof claims.email === "string" ? claims.email : "",
    profile,
    isAdmin: adminResult.data === true,
    avatarUrl,
  };
});

export async function requireAccount(): Promise<CurrentAccount> {
  const account = await getCurrentAccount();
  if (!account) redirect("/login");
  return account;
}

/** Signed in and finished onboarding; otherwise redirected to the right step. */
export async function requireOnboardedAccount(): Promise<CurrentAccount> {
  const account = await requireAccount();
  const next = nextOnboardingPath(account.profile);
  if (next) redirect(next);
  return account;
}

/** Admin pages respond 404 to everyone else so the area is not advertised. */
export async function requireAdmin(): Promise<CurrentAccount> {
  const account = await requireAccount();
  if (!account.isAdmin) notFound();
  return account;
}
