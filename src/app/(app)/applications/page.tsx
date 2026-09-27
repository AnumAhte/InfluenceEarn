import { FileText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { StatusBadge } from "@/components/ui/status-badge";
import { APPLICATION_STATUSES, isApplicationStatus } from "@/domain/applications/state-machine";
import { cents, formatMoney } from "@/domain/money";
import { requireOnboardedAccount } from "@/features/account/queries";
import { listMyApplications, MY_APPLICATIONS_PAGE_SIZE } from "@/features/applications/queries";
import { APPLICATION_STATUS_META } from "@/features/applications/status";
import { formatDate, PlatformList } from "@/features/campaigns/components/campaign-bits";
import { PageHeader } from "@/features/shell/components/page-header";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = { title: "My applications" };

function href(status: string | undefined, page = 1) {
  const search = new URLSearchParams();
  if (status) search.set("status", status);
  if (page > 1) search.set("page", String(page));
  const q = search.toString();
  return q ? `/applications?${q}` : "/applications";
}

export default async function MyApplicationsPage({ searchParams }: PageProps<"/applications">) {
  const { userId } = await requireOnboardedAccount();
  const query = await searchParams;
  const status = isApplicationStatus(query.status) ? query.status : undefined;
  const page = Math.max(1, Number.parseInt(typeof query.page === "string" ? query.page : "1", 10) || 1);
  const { rows, total } = await listMyApplications(userId, status, page);

  return (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-6">
      <PageHeader title="My applications" description="Every campaign you applied to, and where each one stands." />

      <nav aria-label="Application status" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex min-w-max gap-1.5 border-b border-line pb-0.5">
          {[undefined, ...APPLICATION_STATUSES].map((s) => (
            <li key={s ?? "all"}>
              <Link
                href={href(s)}
                aria-current={status === s ? "page" : undefined}
                className={cn(
                  "-mb-[3px] block border-b-2 px-3 py-2.5 text-[13.5px]",
                  status === s ? "border-primary font-[650] text-ink" : "border-transparent font-[550] text-ink-muted hover:text-ink",
                )}
              >
                {s ? APPLICATION_STATUS_META[s].creatorLabel : "All"}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={status ? "Nothing here" : "No applications yet"}
            description="Applications you send show up here with their status. Start with a campaign that matches a connected account."
            action={
              <Button asChild>
                <Link href="/discover">Find campaigns</Link>
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-line-soft">
            {rows.map((row) => {
              const meta = APPLICATION_STATUS_META[row.status];
              return (
                <li key={row.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:px-6">
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    {row.campaign ? (
                      <Link href={`/discover/${row.campaign.id}`} className="font-semibold tracking-[-0.01em] hover:text-primary-hover">
                        {row.campaign.title}
                      </Link>
                    ) : (
                      <span className="font-semibold text-ink-muted">Campaign unavailable</span>
                    )}
                    <span className="text-xs text-ink-muted">
                      Applied {formatDate(row.created_at)}
                      {row.campaign?.task_deadline ? ` · tasks due ${formatDate(row.campaign.task_deadline)}` : ""}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-sm">
                    {row.campaign ? <PlatformList platforms={row.campaign.platforms.map((p) => p.platform)} /> : null}
                    <span className="tabular font-semibold">
                      {row.campaign?.payment_per_creator_cents ? formatMoney(cents(row.campaign.payment_per_creator_cents)) : "—"}
                    </span>
                    <StatusBadge tone={meta.tone}>{meta.creatorLabel}</StatusBadge>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <Pagination label="Applications" page={page} pageSize={MY_APPLICATIONS_PAGE_SIZE} total={total} hrefFor={(p) => href(status, p)} />
      </Card>
    </div>
  );
}
