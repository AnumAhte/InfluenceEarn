import { ListChecks } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { StatusBadge } from "@/components/ui/status-badge";
import { cents, formatMoney } from "@/domain/money";
import { isPastDue } from "@/domain/tasks/assignment";
import { requireOnboardedAccount } from "@/features/account/queries";
import { formatDate, PlatformList } from "@/features/campaigns/components/campaign-bits";
import { PageHeader } from "@/features/shell/components/page-header";
import { listMyAssignments, TASKS_PAGE_SIZE } from "@/features/tasks/queries";
import { ASSIGNMENT_STATUS_META } from "@/features/tasks/status";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = { title: "Tasks" };

function href(view: "active" | "completed", page = 1) {
  const search = new URLSearchParams();
  if (view === "completed") search.set("view", "completed");
  if (page > 1) search.set("page", String(page));
  const q = search.toString();
  return q ? `/tasks?${q}` : "/tasks";
}

export default async function TasksPage({ searchParams }: PageProps<"/tasks">) {
  const { userId } = await requireOnboardedAccount();
  const query = await searchParams;
  const view = query.view === "completed" ? "completed" : "active";
  const page = Math.max(1, Number.parseInt(typeof query.page === "string" ? query.page : "1", 10) || 1);
  const { rows, total } = await listMyAssignments(userId, view, page);

  return (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-6">
      <PageHeader
        title={view === "active" ? "Active tasks" : "Completed tasks"}
        description={
          view === "active"
            ? "Campaigns you were selected for. Complete the task, then submit your proof."
            : "Reviewed work, with the outcome for each campaign."
        }
      />

      <nav aria-label="Task view" className="flex w-fit gap-1 rounded-full bg-surface-muted p-1">
        {(["active", "completed"] as const).map((v) => (
          <Link
            key={v}
            href={href(v)}
            aria-current={view === v ? "page" : undefined}
            className={cn("rounded-full px-3.5 py-1.5 text-[13px] font-[550]", view === v ? "bg-night text-white" : "text-ink-secondary hover:text-ink")}
          >
            {v === "active" ? "Active" : "Completed"}
          </Link>
        ))}
      </nav>

      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState
            icon={ListChecks}
            title={view === "active" ? "No active tasks" : "No completed tasks"}
            description={
              view === "active"
                ? "When an advertiser selects you, the task and its deadline land here."
                : "Reviewed submissions collect here. Finish an active task to see your first one."
            }
            action={
              <Button asChild variant="secondary">
                <Link href={view === "active" ? "/applications" : "/tasks"}>{view === "active" ? "View my applications" : "Go to active tasks"}</Link>
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-line-soft">
            {rows.map((row) => {
              const meta = ASSIGNMENT_STATUS_META[row.status];
              const overdue = view === "active" && row.status !== "submitted" && isPastDue(row.due_at);
              return (
                <li key={row.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:px-6">
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <Link href={`/tasks/${row.id}`} className="font-semibold tracking-[-0.01em] hover:text-primary-hover">
                      {row.campaign?.title ?? "Campaign"}
                    </Link>
                    <span className={cn("text-xs", overdue ? "font-[550] text-danger-fg" : "text-ink-muted")}>
                      {overdue ? "Deadline passed · " : "Due "}
                      {formatDate(row.due_at)}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-sm">
                    {row.campaign ? <PlatformList platforms={row.campaign.platforms.map((p) => p.platform)} /> : null}
                    <span className="tabular font-semibold">{formatMoney(cents(row.reward_cents))}</span>
                    <StatusBadge tone={meta.tone}>{meta.creatorLabel}</StatusBadge>
                    <Link href={`/tasks/${row.id}`} className="text-[13px] font-[550] text-primary-strong hover:text-primary-hover">
                      {row.status === "in_progress" || row.status === "revision_requested" ? "Open task" : "View"}
                      <span className="sr-only">: {row.campaign?.title}</span>
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <Pagination label="Tasks" page={page} pageSize={TASKS_PAGE_SIZE} total={total} hrefFor={(p) => href(view, p)} />
      </Card>
    </div>
  );
}
