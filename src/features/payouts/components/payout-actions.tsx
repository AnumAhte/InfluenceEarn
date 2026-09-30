"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmationDialog, ConfirmationDialogFooter } from "@/components/ui/confirmation-dialog";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";

import { holdPayout, releasePayout, type PayoutActionState } from "../actions";

const IDLE: PayoutActionState = { status: "idle" };

/**
 * Release (or retry) and hold controls for one queue row. Release is disabled when no
 * payout provider is configured for this environment.
 */
export function PayoutActions({
  assignmentId,
  creatorName,
  amountLabel,
  canRelease,
  canHold,
  releaseLabel,
  providerAvailable,
}: {
  assignmentId: string;
  creatorName: string;
  amountLabel: string;
  canRelease: boolean;
  canHold: boolean;
  releaseLabel: string;
  providerAvailable: boolean;
}) {
  const [releaseState, releaseAction] = useActionState(releasePayout, IDLE);
  const [holdState, holdAction] = useActionState(holdPayout, IDLE);
  const [holding, setHolding] = useState(false);
  const state = holdState.status !== "idle" ? holdState : releaseState;

  return (
    <div className="flex flex-col items-start gap-2 lg:items-end">
      <div className="flex flex-wrap gap-2 lg:justify-end">
        {canRelease ? (
          <ConfirmationDialog
            trigger={
              <Button size="sm" disabled={!providerAvailable} title={providerAvailable ? undefined : "No payout provider connected"}>
                {releaseLabel}
              </Button>
            }
            title={`${releaseLabel} to ${creatorName}?`}
            description={`${amountLabel} will be paid through the payout provider. This is recorded in the ledger and the activity log.`}
          >
            <form action={releaseAction}>
              <input type="hidden" name="assignmentId" value={assignmentId} />
              <ConfirmationDialogFooter cancelLabel="Cancel">
                <SubmitButton pendingLabel="Releasing…">Confirm {amountLabel}</SubmitButton>
              </ConfirmationDialogFooter>
            </form>
          </ConfirmationDialog>
        ) : null}
        {canHold && !holding ? (
          <Button size="sm" variant="secondary" onClick={() => setHolding(true)}>
            Put on hold
          </Button>
        ) : null}
      </div>

      {holding ? (
        <form action={holdAction} className="flex w-full max-w-[360px] flex-col gap-2">
          <input type="hidden" name="assignmentId" value={assignmentId} />
          <label htmlFor={`hold-${assignmentId}`} className="text-[13px] font-semibold">Reason for the hold</label>
          <Input id={`hold-${assignmentId}`} name="reason" minLength={3} maxLength={500} required placeholder="e.g. Checking the post is still live" />
          <div className="flex gap-2">
            <SubmitButton size="sm" variant="secondary" pendingLabel="Saving…">Put on hold</SubmitButton>
            <Button type="button" size="sm" variant="ghost" onClick={() => setHolding(false)}>Cancel</Button>
          </div>
        </form>
      ) : null}

      {state.status === "error" ? <p role="alert" className="max-w-[360px] text-xs font-[550] text-danger-fg">{state.message}</p> : null}
      {state.status === "success" ? <p role="status" className="text-xs font-[550] text-success-fg">{state.message}</p> : null}
    </div>
  );
}
