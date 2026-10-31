"use client";

import { useActionState } from "react";

import { Callout } from "@/components/ui/callout";
import { SubmitButton } from "@/components/ui/submit-button";
import { IDLE, type ActionState } from "@/lib/forms/action-state";

import { saveEmailPreferences } from "../actions";
import type { EmailPreferences } from "../queries";

const OPTIONS: { name: keyof EmailPreferences; label: string; hint: string }[] = [
  { name: "applications", label: "Applications", hint: "New applications to your campaigns, and when you are selected for one." },
  { name: "work", label: "Submitted work", hint: "Work submitted for review, approvals, rejections and change requests." },
  { name: "payments", label: "Campaigns and payments", hint: "Campaigns published, refunds, and payouts ready or released." },
];

export function EmailPreferencesForm({ preferences }: { preferences: EmailPreferences }) {
  const [state, action] = useActionState<ActionState, FormData>(saveEmailPreferences, IDLE);

  return (
    <form action={action} className="flex flex-col gap-5">
      {state.status === "error" ? <Callout tone="danger">{state.message}</Callout> : null}
      {state.status === "success" ? <Callout tone="success"><span role="status">{state.message}</span></Callout> : null}
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-2 text-sm font-[650] text-ink">Email me about</legend>
        {OPTIONS.map((option) => (
          <label key={option.name} className="flex cursor-pointer items-start gap-3 rounded-control px-1 py-2.5 hover:bg-surface-muted">
            <input
              type="checkbox"
              name={option.name}
              defaultChecked={preferences[option.name]}
              aria-describedby={`${option.name}-hint`}
              className="mt-0.5 size-[18px] shrink-0 accent-primary-strong"
            />
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-[550] text-ink">{option.label}</span>
              <span id={`${option.name}-hint`} className="text-[13px] leading-normal text-ink-muted">{option.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <div>
        <SubmitButton pendingLabel="Saving…">Save preferences</SubmitButton>
      </div>
    </form>
  );
}
