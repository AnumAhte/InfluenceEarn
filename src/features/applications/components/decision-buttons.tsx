"use client";

import { useActionState } from "react";

import { SubmitButton } from "@/components/ui/submit-button";
import { ACTION_LABEL, availableActions, type ApplicationAction, type ApplicationStatus } from "@/domain/applications/state-machine";

import { decideApplication, type DecideState } from "../actions";

const IDLE: DecideState = { status: "idle" };

const VARIANT: Record<ApplicationAction, "primary" | "secondary" | "ghost"> = {
  select: "primary",
  shortlist: "secondary",
  unshortlist: "ghost",
  reject: "ghost",
  reconsider: "secondary",
};

/** Manual decision controls for one applicant. The database re-checks ownership and capacity. */
export function DecisionButtons({
  applicationId,
  campaignId,
  status,
  applicantName,
  selectionOpen,
  capacityReached,
}: {
  applicationId: string;
  campaignId: string;
  status: ApplicationStatus;
  applicantName: string;
  selectionOpen: boolean;
  capacityReached: boolean;
}) {
  const [state, action] = useActionState(decideApplication, IDLE);
  const actions = selectionOpen ? availableActions(status) : [];

  if (actions.length === 0) return null;

  return (
    <form action={action} className="flex flex-col items-start gap-1.5 lg:items-end">
      <input type="hidden" name="applicationId" value={applicationId} />
      <input type="hidden" name="campaignId" value={campaignId} />
      <div className="flex flex-wrap gap-1.5 lg:justify-end">
        {actions.map((a) => (
          <SubmitButton
            key={a}
            name="action"
            value={a}
            size="sm"
            variant={VARIANT[a]}
            disabled={a === "select" && capacityReached}
            className={a === "reject" ? "text-danger-fg hover:bg-danger-bg" : undefined}
            aria-label={`${ACTION_LABEL[a]} ${applicantName}`}
          >
            {ACTION_LABEL[a]}
          </SubmitButton>
        ))}
      </div>
      {state.status === "error" ? (
        <p role="alert" className="text-xs font-[550] text-danger-fg">{state.message}</p>
      ) : null}
    </form>
  );
}
