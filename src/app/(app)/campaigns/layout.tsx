import { WorkspaceGate } from "@/features/shell/components/workspace-gate";

/** Campaign management lives in the Advertiser workspace. */
export default function CampaignsLayout({ children }: { children: React.ReactNode }) {
  return (
    <WorkspaceGate workspace="advertiser" returnTo="/campaigns">
      {children}
    </WorkspaceGate>
  );
}
