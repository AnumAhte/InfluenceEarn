import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Callout } from "@/components/ui/callout";
import { AuthCard } from "@/features/auth/components/auth-card";
import { RoleSetupCards } from "@/features/account/components/role-setup-cards";
import { requireAccount } from "@/features/account/queries";

export const metadata: Metadata = { title: "Choose how to start" };

const ERRORS: Record<string, string> = {
  invalid_role: "Choose Advertiser or Influencer to continue.",
  save_failed: "We couldn't save your choice. Please try again.",
};

export default async function RoleSetupPage({ searchParams }: PageProps<"/onboarding/role">) {
  const account = await requireAccount();
  if (account.profile.onboarding_completed_at) redirect("/dashboard");

  const { error } = await searchParams;
  const errorMessage = typeof error === "string" ? ERRORS[error] : undefined;

  return (
    <AuthCard className="flex max-w-[1120px] flex-col items-center gap-8 px-5 py-8 sm:gap-10 sm:px-14 sm:py-14">
      <div className="flex max-w-[560px] flex-col gap-2.5 sm:items-center sm:text-center">
        <span className="text-xs font-semibold tracking-[0.08em] text-primary-strong uppercase">
          Step 1 of 2
        </span>
        <h1 className="text-[23px] leading-tight font-bold tracking-[-0.03em] sm:text-[32px]">
          How will you use InfluencEarn?
        </h1>
        <p className="text-[15.5px] leading-relaxed text-ink-secondary">
          Pick the role you want to start in. Nothing is locked in.
        </p>
      </div>

      {errorMessage ? <Callout tone="danger" className="w-full max-w-[840px]">{errorMessage}</Callout> : null}

      <RoleSetupCards current={account.profile.active_workspace} />

      <Callout className="text-[13.5px]">You can switch between Advertiser and Influencer anytime.</Callout>
    </AuthCard>
  );
}
