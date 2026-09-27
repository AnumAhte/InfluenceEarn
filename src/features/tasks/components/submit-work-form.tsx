"use client";

import { useActionState } from "react";

import { Callout } from "@/components/ui/callout";
import { Input, Textarea } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { PLATFORM_META, TASK_RULES, taskLabel, type SocialPlatform, type TaskType } from "@/domain/campaigns/catalog";
import { MAX_COMMENT_LENGTH, MAX_NOTE_LENGTH } from "@/domain/tasks/proof";
import { PlatformTile } from "@/features/campaigns/components/campaign-bits";

import { submitWork, type SubmitWorkState } from "../actions";

type Task = { id: string; platform: SocialPlatform; task_type: TaskType; quantity: number; custom_description: string | null };

const IDLE: SubmitWorkState = { status: "idle" };

/**
 * "Complete task" form. One block per campaign task, asking only for the proof that
 * task type needs. Screenshots are never requested.
 */
export function SubmitWorkForm({ assignmentId, tasks, attemptsLeft }: { assignmentId: string; tasks: Task[]; attemptsLeft: number }) {
  const [state, action] = useActionState(submitWork, IDLE);
  const errors = state.status === "error" ? (state.fieldErrors ?? {}) : {};

  return (
    <form action={action} noValidate className="flex flex-col gap-5">
      <input type="hidden" name="assignmentId" value={assignmentId} />
      {state.status === "error" && !state.fieldErrors ? <Callout tone="danger">{state.message}</Callout> : null}

      <ol className="flex flex-col gap-4">
        {tasks.map((task, index) => {
          const rule = TASK_RULES[task.task_type];
          const urlKey = `url:${task.id}`;
          const commentKey = `comment:${task.id}`;
          const label = task.task_type === "custom" && task.custom_description ? task.custom_description : taskLabel(task.task_type, task.platform);
          return (
            <li key={task.id} className="flex flex-col gap-3 rounded-[14px] border border-line p-4">
              <p className="flex items-center gap-2.5 text-sm font-semibold">
                <span className="tabular text-ink-muted">{index + 1}.</span>
                <PlatformTile platform={task.platform} />
                {task.quantity} × {label}
              </p>
              {rule.proofUrl === "none" ? (
                <p className="text-[13px] text-ink-muted">No link needed — the advertiser checks this on their side.</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <label htmlFor={urlKey} className="text-[13px] font-[550]">
                    {rule.proofLabel.replace(/, if available$/, "")}
                    {rule.proofUrl === "optional" ? <span className="font-normal text-ink-muted"> (optional)</span> : null}
                  </label>
                  <Input
                    id={urlKey}
                    name={urlKey}
                    type="url"
                    inputMode="url"
                    placeholder={`https://www.${PLATFORM_META[task.platform].label.toLowerCase()}.com/…`}
                    aria-invalid={errors[urlKey] ? true : undefined}
                    aria-describedby={errors[urlKey] ? `${urlKey}-error` : undefined}
                  />
                  {errors[urlKey] ? (
                    <p id={`${urlKey}-error`} className="text-[12.5px] font-[550] text-danger-fg">{errors[urlKey]}</p>
                  ) : null}
                </div>
              )}
              {rule.requiresCommentText ? (
                <div className="flex flex-col gap-1.5">
                  <label htmlFor={commentKey} className="text-[13px] font-[550]">Comment text</label>
                  <Textarea
                    id={commentKey}
                    name={commentKey}
                    rows={2}
                    maxLength={MAX_COMMENT_LENGTH}
                    placeholder="Paste the comment exactly as posted"
                    aria-invalid={errors[commentKey] ? true : undefined}
                    aria-describedby={errors[commentKey] ? `${commentKey}-error` : undefined}
                  />
                  {errors[commentKey] ? (
                    <p id={`${commentKey}-error`} className="text-[12.5px] font-[550] text-danger-fg">{errors[commentKey]}</p>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="note" className="text-[13px] font-[550]">
          Note for the advertiser <span className="font-normal text-ink-muted">(optional)</span>
        </label>
        <Textarea id="note" name="note" rows={2} maxLength={MAX_NOTE_LENGTH} />
      </div>

      <SubmitButton size="lg" pendingLabel="Submitting…" className="w-full shadow-primary">
        Submit completion
      </SubmitButton>
      <p className="text-center text-xs text-ink-muted">
        {attemptsLeft === 1 ? "This is your last submission attempt." : `${attemptsLeft} submission attempts left.`} Screenshots are never required.
      </p>
    </form>
  );
}
