"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { ConfirmationDialog, ConfirmationDialogFooter } from "@/components/ui/confirmation-dialog";
import { Textarea } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";

import { cancelCampaign, type CampaignActionState } from "../actions";

const IDLE: CampaignActionState = { status: "idle" };

export function CancelCampaignButton({ campaignId, title }: { campaignId: string; title: string }) {
  const [state, action] = useActionState(cancelCampaign, IDLE);
  const formId = `cancel-${campaignId}`;

  return (
    <ConfirmationDialog
      trigger={
        <Button variant="secondary" className="text-danger-fg hover:bg-danger-bg">
          Cancel campaign
        </Button>
      }
      title="Cancel this campaign?"
      description={
        <>
          “{title}” hasn&apos;t been funded, so nothing is charged. A cancelled campaign can&apos;t be reopened.
        </>
      }
    >
      <form action={action} className="flex flex-col gap-2">
        <input type="hidden" name="campaignId" value={campaignId} />
        <label htmlFor={`${formId}-reason`} className="text-[13px] font-semibold">
          Reason <span className="font-normal text-ink-muted">(optional)</span>
        </label>
        <Textarea id={`${formId}-reason`} name="reason" rows={2} maxLength={500} />
        {state.status === "error" ? <Callout tone="danger">{state.failure.message}</Callout> : null}
        <div className="mt-3">
          <ConfirmationDialogFooter>
            <SubmitButton variant="danger" pendingLabel="Cancelling…">
              Cancel campaign
            </SubmitButton>
          </ConfirmationDialogFooter>
        </div>
      </form>
    </ConfirmationDialog>
  );
}
