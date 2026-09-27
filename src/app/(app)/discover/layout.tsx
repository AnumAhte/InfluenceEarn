import { WorkspaceGate } from "@/features/shell/components/workspace-gate";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <WorkspaceGate workspace="influencer" returnTo="/discover">
      {children}
    </WorkspaceGate>
  );
}
