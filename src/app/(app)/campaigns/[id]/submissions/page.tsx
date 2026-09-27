import { ClipboardCheck, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { StatusBadge } from "@/components/ui/status-badge";
import { taskLabel, type SocialPlatform, type TaskType } from "@/domain/campaigns/catalog";
import { displayHandle } from "@/domain/creators/social";
import { cents, formatMoney } from "@/domain/money";
import { isAssignmentStatus, isPastDue, type AssignmentStatus } from "@/domain/tasks/assignment";
import { requireOnboardedAccount } from "@/features/account/queries";
import { formatDate, PlatformTile } from "@/features/campaigns/components/campaign-bits";
import { getMyCampaign } from "@/features/campaigns/queries";
import { ReviewPanel } from "@/features/tasks/components/review-panel";
import { getAssignmentCounts, listCampaignWork, SUBMISSIONS_PAGE_SIZE, type CampaignWorkRow } from "@/features/tasks/queries";
import { ASSIGNMENT_STATUS_META } from "@/features/tasks/status";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = { title: "Submissions" };

const TABS: (AssignmentStatus | undefined)[] = [undefined, "submitted", "in_progress", "revision_requested", "approved", "rejected", "expired"];

export default async function SubmissionsPage({ params, searchParams }: PageProps<"/campaigns/[id]/submissions">) {
  const { id } = await params;
  const query = await searchParams;
  const { userId } = await requireOnboardedAccount();
  const campaign = await getMyCampaign(userId, id);
  if (!campaign) notFound();

  const status = isAssignmentStatus(query.status) ? query.status : undefined;
  const page = Math.max(1, Number.parseInt(typeof query.page === "string" ? query.page : "1", 10) || 1);
  const [{ rows, total }, counts] = await Promise.all([listCampaignWork(id, status, page), getAssignmentCounts(id)]);
  const tasks = new Map(campaign.tasks.map((t) => [t.id, t]));
  const href = (s: AssignmentStatus | undefined, p = 1) => {
    const search = new URLSearchParams();
    if (s) search.set("status", s);
    if (p > 1) search.set("page", String(p));
    const q = search.toString();
    return `/campaigns/${id}/submissions${q ? `?${q}` : ""}`;
  };

  return (
    <div className="mx-auto flex max-w-[1240px] flex-col gap-6">
      <nav aria-label="Breadcrumb" className="text-[13px] text-ink-muted">
        <Link href="/campaigns" className="hover:text-ink">Campaigns</Link>
        <span aria-hidden> / </span>
        <Link href={`/campaigns/${id}`} className="hover:text-ink">{campaign.title}</Link>
        <span aria-hidden> / </span>
        <span aria-current="page">Submissions</span>
      </nav>
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-[-0.03em] sm:text-[28px]">Tasks &amp; review</h1>
        <p className="text-[15px] text-ink-secondary">Open each link, check the work against the deliverables, then decide.</p>
      </div>

      <nav aria-label="Work status" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex min-w-max gap-1.5 border-b border-line pb-0.5">
          {TABS.map((s) => (
            <li key={s ?? "all"}>
              <Link
                href={href(s)}
                aria-current={status === s ? "page" : undefined}
                className={cn(
                  "-mb-[3px] flex items-center gap-[7px] border-b-2 px-3 py-2.5 text-[13.5px]",
                  status === s ? "border-primary font-[650] text-ink" : "border-transparent font-[550] text-ink-muted hover:text-ink",
                )}
              >
                {s ? ASSIGNMENT_STATUS_META[s].label.replace(" · ready for payout", "") : "All"}
                <span className="tabular rounded-full bg-surface-muted px-[7px] py-0.5 text-[11.5px] font-semibold">{counts[s ?? "all"]}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState
            icon={ClipboardCheck}
            title={status === "submitted" ? "Nothing waiting for review." : "No work here yet."}
            description="Selected creators' submissions land here with their links. Nothing is approved for you."
          />
        ) : (
          <ul className="divide-y divide-line-soft">
            {rows.map((row) => <WorkItem key={row.id} row={row} campaignId={id} tasks={tasks} />)}
          </ul>
        )}
        <Pagination label="Submissions" page={page} pageSize={SUBMISSIONS_PAGE_SIZE} total={total} hrefFor={(p) => href(status, p)} />
      </Card>
    </div>
  );
}

function WorkItem({
  row,
  campaignId,
  tasks,
}: {
  row: CampaignWorkRow;
  campaignId: string;
  tasks: Map<string, { id: string; platform: SocialPlatform; task_type: TaskType }>;
}) {
  const meta = ASSIGNMENT_STATUS_META[row.status];
  const latest = row.submissions[0];
  const name = row.application?.creator_name ?? "Creator";
  const canAllowResubmission = row.attempt_count < row.max_attempts && !isPastDue(row.due_at);

  return (
    <li className="flex flex-col gap-4 px-4 py-5 sm:px-6 lg:flex-row lg:items-start">
      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{name}</span>
          <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
          <span className="tabular text-xs text-ink-muted">
            {formatMoney(cents(row.reward_cents))} · due {formatDate(row.due_at)} · attempt {row.attempt_count}/{row.max_attempts}
          </span>
        </div>
        {row.application?.accounts.length ? (
          <p className="flex flex-wrap gap-3 text-[13px]">
            {row.application.accounts.map((a) => (
              <a key={a.platform} href={a.profile_url} target="_blank" rel="noopener noreferrer nofollow" className="flex items-center gap-1.5 text-primary-strong hover:text-primary-hover">
                <PlatformTile platform={a.platform} />
                {displayHandle(a.platform, a.handle)}
              </a>
            ))}
          </p>
        ) : null}
        {latest ? (
          <div className="flex flex-col gap-2 rounded-control bg-canvas p-3.5">
            <span className="text-xs text-ink-muted">Submitted {formatDate(latest.submitted_at)} · attempt {latest.attempt}</span>
            <ul className="flex flex-col gap-1.5 text-[13.5px]">
              {latest.items.map((item) => {
                const task = tasks.get(item.campaign_task_id);
                return (
                  <li key={item.campaign_task_id} className="flex flex-col gap-0.5">
                    <span className="font-[550]">{task ? taskLabel(task.task_type, task.platform) : "Task"}</span>
                    {item.proof_url ? (
                      <a href={item.proof_url} target="_blank" rel="noopener noreferrer nofollow" className="flex items-center gap-1 break-all text-primary-strong hover:text-primary-hover">
                        {item.proof_url}
                        <ExternalLink aria-hidden className="size-3 flex-none" />
                        <span className="sr-only">(opens in a new tab)</span>
                      </a>
                    ) : (
                      <span className="text-ink-muted">No link (check on the platform)</span>
                    )}
                    {item.comment_text ? <span className="text-ink-secondary">“{item.comment_text}”</span> : null}
                  </li>
                );
              })}
            </ul>
            {latest.note ? <p className="text-[13px] text-ink-secondary">Note: {latest.note}</p> : null}
            {latest.review?.reason ? <p className="text-[13px] text-ink-secondary">Your feedback: {latest.review.reason}</p> : null}
          </div>
        ) : (
          <p className="text-[13px] text-ink-muted">Nothing submitted yet.</p>
        )}
      </div>
      {row.status === "submitted" && latest && !latest.review ? (
        <div className="w-full lg:w-[340px] lg:flex-none">
          <ReviewPanel submissionId={latest.id} campaignId={campaignId} creatorName={name} canAllowResubmission={canAllowResubmission} />
        </div>
      ) : null}
    </li>
  );
}
