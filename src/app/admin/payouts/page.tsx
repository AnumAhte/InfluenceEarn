import { ExternalLink, HandCoins } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Callout } from "@/components/ui/callout";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import { cents, formatMoney } from "@/domain/money";
import { requireAdmin } from "@/features/account/queries";
import { formatDate } from "@/features/campaigns/components/campaign-bits";
import { getPayoutProvider } from "@/features/payments/providers";
import { PayoutActions } from "@/features/payouts/components/payout-actions";
import { getPayoutCounts, isPayoutTab, listPayoutQueue, PAYOUT_TABS, PAYOUTS_PAGE_SIZE, type PayoutTab } from "@/features/payouts/queries";
import { PageHeader } from "@/features/shell/components/page-header";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = { title: "Payouts" };

const TAB_META: Record<PayoutTab, { label: string; tone: StatusTone }> = {
  ready: { label: "Ready for payout", tone: "success" },
  on_hold: { label: "On hold", tone: "warning" },
  processing: { label: "Processing", tone: "info" },
  failed: { label: "Failed", tone: "danger" },
  paid: { label: "Paid", tone: "neutral" },
};

function href(tab: PayoutTab, page = 1) {
  const search = new URLSearchParams();
  if (tab !== "ready") search.set("tab", tab);
  if (page > 1) search.set("page", String(page));
  const q = search.toString();
  return q ? `/admin/payouts?${q}` : "/admin/payouts";
}

export default async function PayoutsPage({ searchParams }: PageProps<"/admin/payouts">) {
  await requireAdmin();
  const query = await searchParams;
  const tab = isPayoutTab(query.tab) ? query.tab : "ready";
  const page = Math.max(1, Number.parseInt(typeof query.page === "string" ? query.page : "1", 10) || 1);
  const [{ rows, total }, counts] = await Promise.all([listPayoutQueue(tab, page), getPayoutCounts()]);
  const provider = getPayoutProvider();

  return (
    <div className="mx-auto flex max-w-[1240px] flex-col gap-6">
      <PageHeader title="Payouts" description="Advertiser-approved work. Check each item, then release the payment or put it on hold." />

      {!provider ? (
        <Callout tone="warning">No payout provider is connected, so payments can&apos;t be released yet. The queue is read-only.</Callout>
      ) : provider.isTestMode ? (
        <Callout tone="warning">
          <strong className="font-semibold">Development mode:</strong> payouts go through the mock provider. No real money moves.
          Amounts ending in .13 fail, to test retries.
        </Callout>
      ) : null}

      <nav aria-label="Payout status" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex min-w-max gap-1.5 border-b border-line pb-0.5">
          {PAYOUT_TABS.map((t) => (
            <li key={t}>
              <Link
                href={href(t)}
                aria-current={tab === t ? "page" : undefined}
                className={cn(
                  "-mb-[3px] flex items-center gap-[7px] border-b-2 px-3 py-2.5 text-[13.5px]",
                  tab === t ? "border-primary font-[650] text-ink" : "border-transparent font-[550] text-ink-muted hover:text-ink",
                )}
              >
                {TAB_META[t].label}
                <span className="tabular rounded-full bg-surface-muted px-[7px] py-0.5 text-[11.5px] font-semibold">{counts[t]}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState icon={HandCoins} title={`Nothing ${TAB_META[tab].label.toLowerCase()}`} description="Items move between these tabs as payouts are released, held or retried." />
        ) : (
          <ul className="divide-y divide-line-soft">
            {rows.map((row) => {
              const amountLabel = formatMoney(cents(row.amountCents));
              return (
                <li key={row.payoutId ?? row.assignmentId} className="flex flex-col gap-3 px-4 py-4 sm:px-6 lg:flex-row lg:items-start">
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{row.creatorName}</span>
                      <StatusBadge tone={TAB_META[row.status].tone}>{TAB_META[row.status].label}</StatusBadge>
                      <span className="tabular font-semibold">{amountLabel}</span>
                    </div>
                    <span className="text-xs text-ink-muted">
                      {row.campaignTitle} · advertiser approved {formatDate(row.approvedAt)}
                      {row.attemptCount ? ` · attempt ${row.attemptCount}` : ""}
                      {row.paidAt ? ` · paid ${formatDate(row.paidAt)}` : ""}
                    </span>
                    {row.proofLinks.map((link) => (
                      <a key={link} href={link} target="_blank" rel="noopener noreferrer nofollow" className="flex items-center gap-1 text-xs break-all text-primary-strong hover:text-primary-hover">
                        {link}
                        <ExternalLink aria-hidden className="size-3 flex-none" />
                        <span className="sr-only">(opens in a new tab)</span>
                      </a>
                    ))}
                    {row.holdReason ? <p className="text-[13px] text-warning-fg">On hold: {row.holdReason}</p> : null}
                    {row.failureReason ? <p className="text-[13px] text-danger-fg">Failed: {row.failureReason}</p> : null}
                    {row.providerReference && row.status === "paid" ? (
                      <p className="text-xs text-ink-muted">Provider reference: {row.providerReference}</p>
                    ) : null}
                  </div>
                  <PayoutActions
                    assignmentId={row.assignmentId}
                    creatorName={row.creatorName}
                    amountLabel={amountLabel}
                    canRelease={row.status === "ready" || row.status === "on_hold" || row.status === "failed"}
                    canHold={row.status === "ready" || row.status === "failed"}
                    releaseLabel={row.status === "failed" ? "Retry payment" : "Release payment"}
                    providerAvailable={Boolean(provider)}
                  />
                </li>
              );
            })}
          </ul>
        )}
        <Pagination label="Payouts" page={page} pageSize={PAYOUTS_PAGE_SIZE} total={total} hrefFor={(p) => href(tab, p)} />
      </Card>
    </div>
  );
}
