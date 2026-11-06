"use client";

import { useActionState } from "react";

import { Callout } from "@/components/ui/callout";
import { SubmitButton } from "@/components/ui/submit-button";
import { IDLE, type ActionState } from "@/lib/forms/action-state";

import { suspendUser, unsuspendUser } from "../actions";

const TEXTAREA =
  "min-h-[88px] w-full rounded-control border border-line bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-subtle focus-visible:border-primary focus-visible:outline-none";

function Notice({ state }: { state: ActionState }) {
  if (state.status === "success") return <Callout tone="success"><span role="status">{state.message}</span></Callout>;
  if (state.status === "error") return <Callout tone="danger">{state.message}</Callout>;
  return null;
}

export function SuspendUserForm({ userId, userName }: { userId: string; userName: string }) {
  const [state, action] = useActionState<ActionState, FormData>(suspendUser, IDLE);
  return (
    <form action={action} className="flex flex-col gap-3">
      <Notice state={state} />
      <input type="hidden" name="userId" value={userId} />
      <label htmlFor="reason" className="text-[13px] font-[550] text-ink">Reason (required, kept in the activity log)</label>
      <textarea id="reason" name="reason" required minLength={5} maxLength={500} className={TEXTAREA} placeholder="What happened and why the account is being suspended" />
      <p className="text-[12.5px] leading-normal text-ink-muted">
        {userName} will be signed out everywhere and blocked from signing in and from every action. Their campaigns, work,
        wallet and payouts are left unchanged for review.
      </p>
      <div>
        <SubmitButton variant="danger" pendingLabel="Suspending…">Suspend account</SubmitButton>
      </div>
    </form>
  );
}

export function UnsuspendUserForm({ userId }: { userId: string }) {
  const [state, action] = useActionState<ActionState, FormData>(unsuspendUser, IDLE);
  return (
    <form action={action} className="flex flex-col gap-3">
      <Notice state={state} />
      <input type="hidden" name="userId" value={userId} />
      <label htmlFor="unsuspend-reason" className="text-[13px] font-[550] text-ink">Note (optional)</label>
      <textarea id="unsuspend-reason" name="reason" maxLength={500} className={TEXTAREA} placeholder="Why the account is being reinstated" />
      <div>
        <SubmitButton pendingLabel="Reinstating…">Reinstate account</SubmitButton>
      </div>
    </form>
  );
}
