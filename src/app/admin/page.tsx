import { ExternalLink, HandCoins } from "lucide-react";

import { Callout } from "@/components/ui/callout";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { StatusBadge } from "@/components/ui/status-badge";
import { cents, formatMoney } from "@/domain/money";
import { requireAdmin } from "@/features/account/queries";
import { formatDate } from "@/features/campaigns/components/campaign-bits";
import { PageHeader } from "@/features/shell/components/page-header";
import { listReadyForPayout, TASKS_PAGE_SIZE } from "@/features/tasks/queries";

export default async function AdminDashboardPage({ searchParams }: PageProps<"/admin">) {
  // Layouts and pages render in parallel, so the page re-checks authorization itself.
  await requireAdmin();
  const query = await searchParams;
  const page = Math.max(1, Number.parseInt(typeof query.page === "string" ? query.page : "1", 10) || 1);
  const { rows, total } = await listReadyForPayout(page);

  return (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-7">
      <PageHeader title="Agency admin" description="Review advertiser-approved work and release influencer payouts." />
      <Callout tone="warning">
        Payout release isn&apos;t available yet: no payment provider is connected. This queue is read-only until then.
      </Callout>
      <Card className="overflow-hidden">
        <CardHeader>
          <div className="flex flex-col gap-1">
            <CardTitle>Ready for payout</CardTitle>
            <span className="text-[13px] text-ink-muted">Work the advertiser approved, oldest first.</span>
          </div>
        </CardHeader>
        {rows.length === 0 ? (
          <EmptyState
            icon={HandCoins}
            title="Nothing ready for payout"
            description="Tasks appear here after an advertiser approves the completed work."
          />
        ) : (
          <ul className="divide-y divide-line-soft">
            {rows.map((row) => {
              const latest = [...row.submissions].sort((a, b) => b.attempt - a.attempt)[0];
              const firstLink = latest?.items.find((i) => i.proof_url)?.proof_url;
              return (
                <li key={row.id} className="flex flex-col gap-2 px-4 py-4 sm:flex-row sm:items-center sm:px-6">
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="font-semibold">{row.application?.creator_name ?? "Creator"}</span>
                    <span className="text-xs text-ink-muted">
                      {row.campaign?.title} · approved by the advertiser {formatDate(row.decided_at)}
                    </span>
                    {firstLink ? (
                      <a href={firstLink} target="_blank" rel="noopener noreferrer nofollow" className="flex items-center gap-1 text-xs break-all text-primary-strong hover:text-primary-hover">
                        {firstLink}
                        <ExternalLink aria-hidden className="size-3 flex-none" />
                        <span className="sr-only">(opens in a new tab)</span>
                      </a>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="tabular font-semibold">{formatMoney(cents(row.reward_cents))}</span>
                    <StatusBadge tone="success">Ready for payout</StatusBadge>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <Pagination label="Payout queue" page={page} pageSize={TASKS_PAGE_SIZE} total={total} hrefFor={(p) => (p > 1 ? `/admin?page=${p}` : "/admin")} />
      </Card>
    </div>
  );
}
