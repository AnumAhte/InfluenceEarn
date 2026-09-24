import type { Metadata } from "next";

import { Card } from "@/components/ui/card";
import { ProfileForm } from "@/features/account/components/profile-form";
import { initialsFor } from "@/features/account/onboarding";
import { requireOnboardedAccount } from "@/features/account/queries";
import { PageHeader } from "@/features/shell/components/page-header";

export const metadata: Metadata = { title: "My profile" };

export default async function ProfileSettingsPage() {
  const { profile, email, avatarUrl } = await requireOnboardedAccount();

  return (
    <div className="mx-auto flex max-w-[760px] flex-col gap-7">
      <PageHeader
        title="My profile"
        description="These details are shared by your Advertiser and Influencer workspaces."
      />

      <Card className="flex flex-col gap-1 px-5 py-4 sm:px-6">
        <span className="text-xs font-semibold tracking-[0.06em] text-ink-muted uppercase">Sign-in email</span>
        <span className="text-[14.5px] font-[550] break-all">{email}</span>
      </Card>

      <Card className="px-5 py-6 sm:px-8 sm:py-8">
        <ProfileForm
          intent="settings"
          initials={initialsFor(profile.full_name)}
          avatarUrl={avatarUrl}
          defaults={{
            fullName: profile.full_name,
            phone: profile.phone ?? "",
            city: profile.city ?? "",
            bio: profile.bio ?? "",
          }}
        />
      </Card>
    </div>
  );
}
