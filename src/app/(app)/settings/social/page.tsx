import type { Metadata } from "next";

import { Callout } from "@/components/ui/callout";
import { SOCIAL_PLATFORMS } from "@/domain/campaigns/catalog";
import { requireOnboardedAccount } from "@/features/account/queries";
import { PageHeader } from "@/features/shell/components/page-header";
import { SocialAccountCard } from "@/features/social/components/social-account-card";
import { listMySocialAccounts } from "@/features/social/queries";

export const metadata: Metadata = { title: "Social accounts" };

export default async function SocialAccountsPage() {
  const { userId } = await requireOnboardedAccount();
  const accounts = await listMySocialAccounts(userId);

  return (
    <div className="mx-auto flex max-w-[860px] flex-col gap-6">
      <PageHeader
        title="Social accounts"
        description="Optional for your account. Required only for campaigns that ask for a specific platform."
      />
      <ul className="flex flex-col gap-3">
        {SOCIAL_PLATFORMS.map((platform) => (
          <SocialAccountCard key={platform} platform={platform} account={accounts.find((a) => a.platform === platform)} />
        ))}
      </ul>
      <Callout>
        Follower numbers are the ones you enter. InfluencEarn does not verify them automatically — the advertiser reviews
        your profile and content before selecting you. Disconnecting a platform doesn&apos;t affect campaigns you already
        applied to, but you won&apos;t be able to apply to new campaigns that require it.
      </Callout>
    </div>
  );
}
