import { CheckCircle2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { requireOnboardedAccount } from "@/features/account/queries";
import { formatDate } from "@/features/campaigns/components/campaign-bits";
import { PageHeader } from "@/features/shell/components/page-header";
import { listMyPendingReviews, TASKS_PAGE_SIZE } from "@/features/tasks/queries";

export const metadata: Metadata = { title: "Tasks & reviews" };

/** Advertiser inbox: submitted work waiting for review, oldest first, across all campaigns. */
export default async function ReviewsPage({ searchParams }: PageProps<"/reviews">) {
  const { userId } = await requireOnboardedAccount();
  const query = await searchParams;
  const page = Math.max(1, Number.parseInt(typeof query.page === "string" ? query.page : "1", 10) || 1);
  const { rows, total } = await listMyPendingReviews(userId, page);

  return (
    <div className="mx-auto flex max-w-[1080px] flex-col gap-6">
      <PageHeader title="Tasks & reviews" description="Work submitted by your selected creators, waiting for your review." />
      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title="Nothing waiting for review."
            description="Every submitted task has been reviewed. New submissions land here with their links."
          />
        ) : (
          <ul className="divide-y divide-line-soft">
            {rows.map((row) => (
              <li key={row.id} className="flex flex-col gap-2 px-4 py-4 sm:flex-row sm:items-center sm:px-6">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="font-semibold">{row.application?.creator_name ?? "Creator"}</span>
                  <span className="text-xs text-ink-muted">
                    {row.campaign?.title} · submitted {formatDate(row.submitted_at)} · attempt {row.attempt_count}
                  </span>
                </div>
                <Link
                  href={`/campaigns/${row.campaign?.id}/submissions?status=submitted`}
                  className="inline-flex h-10 items-center justify-center rounded-control border border-line bg-surface px-4 text-sm font-[550] hover:bg-canvas"
                >
                  Review
                  <span className="sr-only"> work by {row.application?.creator_name}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <Pagination
          label="Reviews"
          page={page}
          pageSize={TASKS_PAGE_SIZE}
          total={total}
          hrefFor={(p) => (p > 1 ? `/reviews?page=${p}` : "/reviews")}
        />
      </Card>
    </div>
  );
}
