import { requireOnboardedAccount } from "@/features/account/queries";
import { AppShell } from "@/features/shell/components/app-shell";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const account = await requireOnboardedAccount();
  return (
    <AppShell account={account} area={account.profile.active_workspace}>
      {children}
    </AppShell>
  );
}
