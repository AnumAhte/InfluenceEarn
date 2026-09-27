import { ArrowLeft, Check, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Callout } from "@/components/ui/callout";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Chip, StatusBadge } from "@/components/ui/status-badge";
import { TASK_RULES, taskLabel } from "@/domain/campaigns/catalog";
import { cents, formatMoney } from "@/domain/money";
import { submissionGate } from "@/domain/tasks/assignment";
import { requireOnboardedAccount } from "@/features/account/queries";
import { formatDate } from "@/features/campaigns/components/campaign-bits";
import { SubmitWorkForm } from "@/features/tasks/components/submit-work-form";
import { getMyAssignment } from "@/features/tasks/queries";
import { ASSIGNMENT_STATUS_META } from "@/features/tasks/status";

export const metadata: Metadata = { title: "Task" };

const GATE_COPY = {
  waiting_for_review: "Your submission is with the advertiser. You'll be notified when they review it.",
  finished: "This task has been reviewed.",
  deadline_passed: "The task deadline has passed, so submissions are closed.",
  attempts_exhausted: "You've used all your submission attempts for this task.",
} as const;

export default async function TaskPage({ params, searchParams }: PageProps<"/tasks/[id]">) {
  const { id } = await params;
  const query = await searchParams;
  const { userId } = await requireOnboardedAccount();
  const assignment = await getMyAssignment(userId, id);
  if (!assignment) notFound();

  const { campaign } = assignment;
  const meta = ASSIGNMENT_STATUS_META[assignment.status];
  const gate = submissionGate(
    { status: assignment.status, dueAt: assignment.due_at, attemptCount: assignment.attempt_count, maxAttempts: assignment.max_attempts },
    new Date(),
  );
  const latest = assignment.submissions[0];
  const latestReview = latest?.review ?? null;
  const taskById = new Map(campaign.tasks.map((t) => [t.id, t]));

  return (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-6">
      <Link href="/tasks" className="flex w-fit items-center gap-1.5 text-[13.5px] font-[550] text-ink-secondary hover:text-ink">
        <ArrowLeft aria-hidden className="size-4" />
        Back to tasks
      </Link>

      {query.submitted === "1" && assignment.status === "submitted" ? (
        <Callout tone="success"><span role="status">Submitted. The advertiser will review your work and you&apos;ll be notified.</span></Callout>
      ) : null}

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <StatusBadge tone={meta.tone} className="w-fit">{meta.creatorLabel}</StatusBadge>
          <h1 className="text-2xl font-bold tracking-[-0.03em] break-words sm:text-[28px]">{campaign.title}</h1>
          <p className="text-sm text-ink-muted">Due {formatDate(assignment.due_at)} (end of day, UTC)</p>
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-xs text-ink-muted">Your reward</span>
          <span className="tabular text-[26px] font-bold tracking-[-0.03em]">{formatMoney(cents(assignment.reward_cents))}</span>
        </div>
      </header>

      {assignment.status === "revision_requested" && latestReview?.reason ? (
        <Callout tone="danger">
          <span className="font-semibold">Changes requested: </span>
          {latestReview.reason}
        </Callout>
      ) : null}
      {assignment.status === "rejected" && latestReview?.reason ? (
        <Callout tone="danger"><span className="font-semibold">Rejected: </span>{latestReview.reason}</Callout>
      ) : null}
      {assignment.status === "approved" ? (
        <Callout tone="success">Approved. The agency releases your payment after its payout review.</Callout>
      ) : null}

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_420px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader><CardTitle>Required deliverables</CardTitle></CardHeader>
            <div className="flex flex-col gap-4 px-5 py-5 sm:px-6">
              <ul className="flex flex-col gap-2">
                {campaign.tasks.map((task) => (
                  <li key={task.id} className="flex flex-wrap items-center gap-3 text-sm">
                    <Check aria-hidden className="size-4 text-success" strokeWidth={3} />
                    <span className="font-[550]">
                      {task.quantity} × {task.task_type === "custom" && task.custom_description ? task.custom_description : taskLabel(task.task_type, task.platform)}
                    </span>
                    <span className="text-xs text-ink-muted">Proof: {TASK_RULES[task.task_type].proofLabel}</span>
                  </li>
                ))}
              </ul>
              {campaign.instructions ? (
                <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-ink-secondary">
                  {campaign.instructions.split("\n").filter((l) => l.trim()).map((line, i) => <li key={i}>{line}</li>)}
                </ul>
              ) : null}
              {campaign.caption_instructions ? (
                <p className="text-sm text-ink-secondary"><span className="font-[550] text-ink">Caption: </span>{campaign.caption_instructions}</p>
              ) : null}
              {campaign.hashtags.length || campaign.mentions.length ? (
                <div className="flex flex-wrap gap-1.5">{[...campaign.hashtags, ...campaign.mentions].map((t) => <Chip key={t}>{t}</Chip>)}</div>
              ) : null}
            </div>
          </Card>

          {assignment.submissions.length ? (
            <Card>
              <CardHeader><CardTitle>Your submissions</CardTitle></CardHeader>
              <ol className="divide-y divide-line-soft">
                {assignment.submissions.map((submission) => (
                  <li key={submission.id} className="flex flex-col gap-2 px-5 py-4 sm:px-6">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                      Attempt {submission.attempt}
                      <span className="text-xs font-normal text-ink-muted">{formatDate(submission.submitted_at)}</span>
                      {submission.review ? (
                        <StatusBadge tone={submission.review.decision === "approved" ? "success" : "danger"}>
                          {submission.review.decision === "approved" ? "Approved" : "Rejected"}
                        </StatusBadge>
                      ) : (
                        <StatusBadge tone="warning">Waiting for review</StatusBadge>
                      )}
                    </p>
                    <ul className="flex flex-col gap-1 text-[13px]">
                      {submission.items.map((item) => {
                        const task = taskById.get(item.campaign_task_id);
                        return (
                          <li key={item.campaign_task_id} className="flex flex-col gap-0.5">
                            <span className="text-ink-muted">{task ? taskLabel(task.task_type, task.platform) : "Task"}</span>
                            {item.proof_url ? (
                              <a href={item.proof_url} target="_blank" rel="noopener noreferrer nofollow" className="flex items-center gap-1 break-all text-primary-strong hover:text-primary-hover">
                                {item.proof_url}
                                <ExternalLink aria-hidden className="size-3 flex-none" />
                              </a>
                            ) : (
                              <span className="text-ink-subtle">No link</span>
                            )}
                            {item.comment_text ? <span className="text-ink-secondary">“{item.comment_text}”</span> : null}
                          </li>
                        );
                      })}
                    </ul>
                    {submission.review?.reason ? <p className="text-[13px] text-ink-secondary">Advertiser: {submission.review.reason}</p> : null}
                  </li>
                ))}
              </ol>
            </Card>
          ) : null}
        </div>

        <aside aria-label="Complete task" className="flex flex-col gap-4 lg:sticky lg:top-[92px]">
          <Card className="flex flex-col gap-4 p-5 sm:p-6">
            <h2 className="text-[16.5px] font-[650] tracking-[-0.02em]">Complete task</h2>
            {gate.canSubmit ? (
              <SubmitWorkForm
                assignmentId={assignment.id}
                tasks={campaign.tasks}
                attemptsLeft={assignment.max_attempts - assignment.attempt_count}
              />
            ) : (
              <p className="text-sm leading-relaxed text-ink-secondary">{GATE_COPY[gate.reason]}</p>
            )}
            <p className="text-xs leading-normal text-ink-muted">
              The advertiser approves the work, then the agency releases your payment.
            </p>
          </Card>
        </aside>
      </div>
    </div>
  );
}
