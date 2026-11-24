import { ClipboardCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { StatusBadge } from "@/components/ui/status-badge";
import { cents, formatMoney } from "@/domain/money";
import { requireAdmin } from "@/features/account/queries";
import { formatDateTime, TabNav } from "@/features/admin/components/tab-nav";
import { ADMIN_PAGE_SIZE, listAssignments, parsePage } from "@/features/admin/queries";
import { formatDate } from "@/features/campaigns/components/campaign-bits";
import { PageHeader } from "@/features/shell/components/page-header";
import { ASSIGNMENT_STATUS_META } from "@/features/tasks/status";

export const metadata: Metadata = { title: "Task reviews" };

const TABS = [
  { id: "awaiting", label: "Awaiting advertiser review", statuses: ["submitted"] },
  { id: "changes", label: "Changes requested", statuses: ["revision_requested"] },
  { id: "in_progress", label: "Not submitted yet", statuses: ["in_progress"] },
  { id: "decided", label: "Approved and paid", statuses: ["approved", "payout_pending", "paid"] },
  { id: "closed", label: "Rejected and expired", statuses: ["rejected", "expired"] },
] as const;

function href(tab: string, page = 1) {
  const search = new URLSearchParams();
  if (tab !== "awaiting") search.set("tab", tab);
  if (page > 1) search.set("page", String(page));
  const s = search.toString();
  return s ? `/admin/reviews?${s}` : "/admin/reviews";
}

/** Read-only view of creator work and advertiser decisions. Approved work is released in Payouts. */
export default async function AdminReviewsPage({ searchParams }: PageProps<"/admin/reviews">) {
  await requireAdmin();
  const query = await searchParams;
  const tab = TABS.find((t) => t.id === query.tab) ?? TABS[0];
  const page = parsePage(query.page);
  const { rows, total } = await listAssignments(tab.statuses, page);

  return (
    <div className="mx-auto flex max-w-[1240px] flex-col gap-6">
      <PageHeader
        title="Task reviews"
        description="Creator work and advertiser decisions across all campaigns. Advertisers review their own campaigns; approved work is released in Payouts."
      />
      <TabNav label="Review status" current={tab.id} tabs={TABS.map((t) => ({ id: t.id, label: t.label, href: href(t.id) }))} />
      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState icon={ClipboardCheck} title={`Nothing here: ${tab.label.toLowerCase()}`} description="Work moves between these tabs as creators submit and advertisers decide." />
        ) : (
          <ul className="divide-y divide-line-soft">
            {rows.map((a) => {
              const meta = ASSIGNMENT_STATUS_META[a.status];
              return (
                <li key={a.id} className="flex flex-col gap-1.5 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="flex flex-wrap items-center gap-2 text-sm font-[550]">
                      {a.campaign?.title ?? "Campaign"}
                      <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
                    </span>
                    <span className="text-[13px] text-ink-muted">
                      Creator{" "}
                      {a.creator ? (
                        <Link href={`/admin/users/${a.creator.id}`} className="font-[550] text-primary-strong hover:text-primary-hover">
                          {a.creator.full_name || "Unnamed"}
                        </Link>
                      ) : (
                        "Unknown"
                      )}
                      {" · "}Advertiser {a.campaign?.owner?.full_name || "Unknown"}
                    </span>
                  </span>
                  <span className="flex flex-wrap gap-x-4 text-xs text-ink-muted">
                    <span className="tabular">{formatMoney(cents(a.reward_cents))}</span>
                    <span className="tabular">Attempt {a.attempt_count}/{a.max_attempts}</span>
                    <span>{a.submitted_at ? `Submitted ${formatDateTime(a.submitted_at)}` : `Due ${formatDate(a.due_at)}`}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        {total > ADMIN_PAGE_SIZE ? <Pagination page={page} pageSize={ADMIN_PAGE_SIZE} total={total} hrefFor={(p) => href(tab.id, p)} label="Task reviews" /> : null}
      </Card>
    </div>
  );
}
