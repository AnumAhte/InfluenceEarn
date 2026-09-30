import Link from "next/link";

import { Callout } from "@/components/ui/callout";
import { MetricCard } from "@/components/ui/metric-card";
import { requireAdmin } from "@/features/account/queries";
import { getPayoutProvider } from "@/features/payments/providers";
import { getPayoutCounts } from "@/features/payouts/queries";
import { PageHeader } from "@/features/shell/components/page-header";

export default async function AdminDashboardPage() {
  // Layouts and pages render in parallel, so the page re-checks authorization itself.
  await requireAdmin();
  const counts = await getPayoutCounts();
  const provider = getPayoutProvider();
  const cards = [
    { label: "Ready for payout", value: counts.ready, tab: "", attention: counts.ready > 0 },
    { label: "Failed", value: counts.failed, tab: "?tab=failed", attention: counts.failed > 0 },
    { label: "On hold", value: counts.on_hold, tab: "?tab=on_hold", attention: false },
    { label: "Paid", value: counts.paid, tab: "?tab=paid", attention: false },
  ];

  return (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-7">
      <PageHeader title="Agency admin" description="Review advertiser-approved work and release influencer payouts." />
      {!provider ? (
        <Callout tone="warning">No payout provider is connected, so payments can&apos;t be released yet.</Callout>
      ) : null}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((card) => (
          <Link key={card.label} href={`/admin/payouts${card.tab}`} className="rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
            <MetricCard label={card.label} value={<span className="tabular">{card.value}</span>} tone={card.attention ? "attention" : "default"} hint="View in payouts" />
          </Link>
        ))}
      </div>
      <p className="text-sm text-ink-muted">
        Every hold, release and payout result is recorded in the{" "}
        <Link href="/admin/activity" className="font-[550] text-primary-strong hover:text-primary-hover">activity log</Link>.
      </p>
    </div>
  );
}
