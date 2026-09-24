import { randomUUID } from "node:crypto";

import { Receipt } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { cents, formatMoney } from "@/domain/money";
import { requireOnboardedAccount } from "@/features/account/queries";
import { CampaignStatusBadge, formatDate } from "@/features/campaigns/components/campaign-bits";
import { getWalletFundingProvider } from "@/features/payments/providers";
import { PageHeader } from "@/features/shell/components/page-header";
import { AddTestFundsForm } from "@/features/wallet/components/add-test-funds-form";
import { StatementTable } from "@/features/wallet/components/statement-table";
import { WalletSummary } from "@/features/wallet/components/wallet-summary";
import {
  areTestFundsEnabled,
  getMyWalletBalance,
  listMyCampaignFunding,
  listMyStatement,
  WALLET_PAGE_SIZE,
  type StatementFilter,
} from "@/features/wallet/queries";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = { title: "Wallet" };

const FILTERS: { id: StatementFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "deposits", label: "Funds added" },
  { id: "campaign_funding", label: "Campaign funding" },
];

function hrefFor(filter: StatementFilter, page: number) {
  const search = new URLSearchParams();
  if (filter !== "all") search.set("filter", filter);
  if (page > 1) search.set("page", String(page));
  const query = search.toString();
  return query ? `/wallet?${query}` : "/wallet";
}

export default async function WalletPage({ searchParams }: PageProps<"/wallet">) {
  const { userId } = await requireOnboardedAccount();
  const query = await searchParams;
  const filter = FILTERS.find((f) => f.id === query.filter)?.id ?? "all";
  const page = Math.max(1, Math.min(10_000, Number.parseInt(typeof query.page === "string" ? query.page : "1", 10) || 1));

  const [{ availableCents }, statement, fundings, testFundsEnabled] = await Promise.all([
    getMyWalletBalance(userId),
    listMyStatement(userId, filter, page),
    listMyCampaignFunding(userId),
    areTestFundsEnabled(),
  ]);
  const canAddTestFunds = Boolean(getWalletFundingProvider()?.isTestMode && testFundsEnabled);

  return (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-6">
      <PageHeader title="Wallet" description="Your balance, campaign funding and transaction history. All amounts are in USD." />

      <div className="grid items-start gap-6 lg:grid-cols-[1.3fr_1fr]">
        <WalletSummary availableCents={availableCents} testMode={canAddTestFunds} />
        {canAddTestFunds ? (
          <AddTestFundsForm idempotencyKey={randomUUID()} />
        ) : (
          <Card className="flex flex-col gap-2 p-5">
            <h2 className="text-[15px] font-[650]">Add funds</h2>
            <p className="text-[13.5px] leading-relaxed text-ink-secondary">
              Adding funds isn&apos;t available yet. It will be enabled once a payment provider is connected.
            </p>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-1">
            <CardTitle>Campaign funding activity</CardTitle>
            <span className="text-[13px] text-ink-muted">Campaigns you funded from this wallet</span>
          </div>
        </CardHeader>
        {fundings.length === 0 ? (
          <p className="px-5 py-6 text-sm text-ink-muted sm:px-6">No campaigns funded yet.</p>
        ) : (
          <ul className="divide-y divide-line-soft">
            {fundings.map((funding) => (
              <li key={funding.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 sm:px-6">
                <div className="flex min-w-0 flex-col gap-0.5">
                  {funding.campaign ? (
                    <Link href={`/campaigns/${funding.campaign.id}`} className="font-[550] hover:text-primary-hover">
                      {funding.campaign.title}
                    </Link>
                  ) : null}
                  <span className="tabular text-xs text-ink-muted">
                    {formatMoney(cents(funding.creator_budget_cents))} creator budget + {formatMoney(cents(funding.platform_fee_cents))} fee ·{" "}
                    {formatDate(funding.created_at)}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {funding.campaign ? <CampaignStatusBadge status={funding.campaign.status} /> : null}
                  <span className="tabular font-semibold">−{formatMoney(cents(funding.total_cents))}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Transaction history</CardTitle>
          <nav aria-label="Transaction type" className="flex gap-1 rounded-full bg-surface-muted p-1">
            {FILTERS.map((f) => (
              <Link
                key={f.id}
                href={hrefFor(f.id, 1)}
                aria-current={filter === f.id ? "page" : undefined}
                className={cn(
                  "rounded-full px-3 py-1.5 text-[13px] font-[550] whitespace-nowrap",
                  filter === f.id ? "bg-night text-white" : "text-ink-secondary hover:text-ink",
                )}
              >
                {f.label}
              </Link>
            ))}
          </nav>
        </CardHeader>
        {statement.rows.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="Nothing here yet"
            description={
              filter === "all"
                ? "Transactions appear here as funds are added and campaigns are funded."
                : "No transactions of this type yet."
            }
          />
        ) : (
          <StatementTable rows={statement.rows} />
        )}
        <Pagination label="Transactions" page={page} pageSize={WALLET_PAGE_SIZE} total={statement.total} hrefFor={(p) => hrefFor(filter, p)} />
      </Card>
    </div>
  );
}
