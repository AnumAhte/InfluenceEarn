"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";

import { reviewSubmission, type ReviewState } from "../actions";

const IDLE: ReviewState = { status: "idle" };

/** Approve, or reject with a reason (optionally letting the creator resubmit). */
export function ReviewPanel({
  submissionId,
  campaignId,
  creatorName,
  canAllowResubmission,
}: {
  submissionId: string;
  campaignId: string;
  creatorName: string;
  canAllowResubmission: boolean;
}) {
  const [state, action] = useActionState(reviewSubmission, IDLE);
  const [rejecting, setRejecting] = useState(false);

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="submissionId" value={submissionId} />
      <input type="hidden" name="campaignId" value={campaignId} />

      {rejecting ? (
        <div className="flex flex-col gap-2.5 rounded-control border border-danger-border bg-danger-bg/40 p-3.5">
          <label htmlFor={`reason-${submissionId}`} className="text-[13px] font-semibold">
            What needs to change?
          </label>
          <Textarea id={`reason-${submissionId}`} name="reason" rows={2} maxLength={1000} required minLength={3} placeholder="e.g. Please tag the brand account in the caption." />
          {canAllowResubmission ? (
            <label className="flex items-center gap-2 text-[13px]">
              <input type="checkbox" name="allowResubmission" defaultChecked className="size-4 accent-[#0C7D8C]" />
              Let {creatorName} fix it and resubmit
            </label>
          ) : (
            <p className="text-xs text-ink-muted">No resubmission is possible (deadline passed or no attempts left), so this rejection is final.</p>
          )}
          <div className="flex flex-wrap gap-2">
            <SubmitButton name="decision" value="rejected" variant="danger" size="sm" pendingLabel="Rejecting…">
              Confirm rejection
            </SubmitButton>
            <Button type="button" variant="ghost" size="sm" onClick={() => setRejecting(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <SubmitButton name="decision" value="approved" size="sm" pendingLabel="Approving…" aria-label={`Approve completion by ${creatorName}`}>
            Approve completion
          </SubmitButton>
          <Button type="button" variant="secondary" size="sm" onClick={() => setRejecting(true)} className="text-danger-fg hover:bg-danger-bg">
            Reject
          </Button>
        </div>
      )}
      {state.status === "error" ? <p role="alert" className="text-xs font-[550] text-danger-fg">{state.message}</p> : null}
      <p className="text-xs text-ink-muted">Open every link and check the work before deciding. Approving tells the agency to release this creator&apos;s payment.</p>
    </form>
  );
}
