import { Megaphone, Sparkles } from "lucide-react";
import type { ReactNode } from "react";

import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SubmitButton } from "@/components/ui/submit-button";
import { switchWorkspace } from "@/features/account/actions";
import { requireOnboardedAccount } from "@/features/account/queries";
import { WORKSPACE_COPY, type Workspace } from "@/features/account/workspace";

const COPY: Record<Workspace, { title: string; description: string }> = {
  advertiser: {
    title: "Campaigns are managed as an Advertiser",
    description: "You're in the Influencer workspace. Switch to Advertiser to create and manage your campaigns — same account, same login.",
  },
  influencer: {
    title: "Campaign discovery is in the Influencer workspace",
    description: "You're in the Advertiser workspace. Switch to Influencer to find campaigns and track your applications — same account, same login.",
  },
};

/** Renders children only in the required workspace; otherwise offers a one-click switch back here. */
export async function WorkspaceGate({ workspace, returnTo, children }: { workspace: Workspace; returnTo: string; children: ReactNode }) {
  const { profile } = await requireOnboardedAccount();
  if (profile.active_workspace === workspace) return children;

  return (
    <Card className="mx-auto max-w-[640px]">
      <EmptyState
        icon={workspace === "advertiser" ? Megaphone : Sparkles}
        title={COPY[workspace].title}
        description={COPY[workspace].description}
        action={
          <form action={switchWorkspace}>
            <input type="hidden" name="workspace" value={workspace} />
            <input type="hidden" name="returnTo" value={returnTo} />
            <SubmitButton pendingLabel="Switching…">{WORKSPACE_COPY[workspace].switchLabel}</SubmitButton>
          </form>
        }
      />
    </Card>
  );
}
