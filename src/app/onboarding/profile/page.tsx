import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SubmitButton } from "@/components/ui/submit-button";
import { skipProfileSetup } from "@/features/account/actions";
import { ProfileForm } from "@/features/account/components/profile-form";
import { initialsFor } from "@/features/account/onboarding";
import { requireAccount } from "@/features/account/queries";
import { AuthCard } from "@/features/auth/components/auth-card";

export const metadata: Metadata = { title: "Complete your profile" };

export default async function ProfileSetupPage() {
  const { profile, avatarUrl } = await requireAccount();
  if (!profile.workspace_chosen_at) redirect("/onboarding/role");
  if (profile.onboarding_completed_at) redirect("/dashboard");

  return (
    <AuthCard className="max-w-[760px] overflow-hidden">
      <div className="flex flex-col gap-5 px-5 pt-6 sm:px-10 sm:pt-8">
        <div className="flex items-center justify-between gap-6">
          <span className="text-xs font-semibold tracking-[0.08em] text-primary-strong uppercase">
            Step 2 of 2
          </span>
          <form action={skipProfileSetup}>
            <SubmitButton variant="ghost" size="sm" className="text-ink-muted" pendingLabel="Skipping…">
              Skip for now
            </SubmitButton>
          </form>
        </div>
        <div
          role="progressbar"
          aria-label="Setup progress"
          aria-valuemin={0}
          aria-valuemax={2}
          aria-valuenow={2}
          className="h-1 overflow-hidden rounded-full bg-line"
        >
          <div className="h-full w-full bg-primary" />
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="text-[23px] font-bold tracking-[-0.025em] sm:text-[26px]">Complete your profile</h1>
          <p className="text-[15px] leading-relaxed text-ink-secondary">
            A few quick details so the people you work with know who you are.
          </p>
        </div>
      </div>
      <div className="px-5 pt-7 pb-8 sm:px-10 sm:pb-9">
        <ProfileForm
          intent="onboarding"
          initials={initialsFor(profile.full_name)}
          avatarUrl={avatarUrl}
          defaults={{
            fullName: profile.full_name,
            phone: profile.phone ?? "",
            city: profile.city ?? "",
            bio: profile.bio ?? "",
          }}
        />
      </div>
    </AuthCard>
  );
}
