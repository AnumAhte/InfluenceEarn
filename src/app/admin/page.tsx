import { HandCoins } from "lucide-react";

import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireAdmin } from "@/features/account/queries";
import { PageHeader } from "@/features/shell/components/page-header";

export default async function AdminDashboardPage() {
  // Layouts and pages render in parallel, so the page re-checks authorization itself.
  await requireAdmin();

  return (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-7">
      <PageHeader
        title="Agency admin"
        description="Review advertiser-approved work and release influencer payouts."
      />
      <Card>
        <CardHeader>
          <CardTitle>Payout queue</CardTitle>
        </CardHeader>
        <EmptyState
          icon={HandCoins}
          title="Nothing ready for payout"
          description="Tasks appear here after an advertiser approves the completed work. Payout release will be enabled once a payment provider is connected."
        />
      </Card>
    </div>
  );
}
