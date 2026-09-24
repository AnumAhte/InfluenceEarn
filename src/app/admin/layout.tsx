import type { Metadata } from "next";

import { requireAdmin } from "@/features/account/queries";
import { AppShell } from "@/features/shell/components/app-shell";

export const metadata: Metadata = {
  title: { default: "Agency admin", template: "%s · Agency admin · InfluencEarn" },
  robots: { index: false, follow: false },
};

// Authorization is decided on the server from `user_roles` (via is_admin()),
// never from anything the client sends. Non-admins get a 404.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const account = await requireAdmin();
  return (
    <AppShell account={account} area="admin">
      {children}
    </AppShell>
  );
}
