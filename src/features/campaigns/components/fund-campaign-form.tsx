"use client";

import { useActionState } from "react";

import { Callout } from "@/components/ui/callout";
import { SubmitButton } from "@/components/ui/submit-button";
import { cents, formatMoney } from "@/domain/money";

import { fundCampaign, type CampaignActionState } from "../actions";

const IDLE: CampaignActionState = { status: "idle" };

/**
 * Fund & Publish. Sends only the campaign id and an idempotency key generated when
 * the page rendered, so a double click or retry re-uses the same key.
 */
export function FundCampaignForm({ campaignId, idempotencyKey, totalCents }: { campaignId: string; idempotencyKey: string; totalCents: number }) {
  const [state, action] = useActionState(fundCampaign, IDLE);

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="campaignId" value={campaignId} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      {state.status === "error" ? (
        <Callout tone="danger">
          {state.failure.message}
          {state.failure.code === "insufficient_funds" && state.failure.requiredCents !== null && state.failure.availableCents !== null
            ? ` Required ${formatMoney(cents(state.failure.requiredCents))}, available ${formatMoney(cents(state.failure.availableCents))}.`
            : null}
        </Callout>
      ) : null}
      <SubmitButton size="lg" pendingLabel="Funding…" className="w-full shadow-primary">
        Fund {formatMoney(cents(totalCents))} &amp; publish
      </SubmitButton>
      <p className="text-center text-[12.5px] text-ink-muted">
        The total is recalculated and debited from your wallet in one step. You won&apos;t be charged twice.
      </p>
    </form>
  );
}
