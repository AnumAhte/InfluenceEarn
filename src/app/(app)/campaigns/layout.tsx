import { Megaphone } from "lucide-react";

import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SubmitButton } from "@/components/ui/submit-button";
import { switchWorkspace } from "@/features/account/actions";
import { requireOnboardedAccount } from "@/features/account/queries";

/** Campaign management lives in the Advertiser workspace. */
export default async function CampaignsLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireOnboardedAccount();

  if (profile.active_workspace !== "advertiser") {
    return (
      <Card className="mx-auto max-w-[640px]">
        <EmptyState
          icon={Megaphone}
          title="Campaigns are managed as an Advertiser"
          description="You're in the Influencer workspace. Switch to Advertiser to create and manage your campaigns — same account, same login."
          action={
            <form action={switchWorkspace}>
              <input type="hidden" name="workspace" value="advertiser" />
              <input type="hidden" name="returnTo" value="/campaigns" />
              <SubmitButton pendingLabel="Switching…">Switch to Advertiser</SubmitButton>
            </form>
          }
        />
      </Card>
    );
  }

  return children;
}
