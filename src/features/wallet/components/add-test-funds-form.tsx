"use client";

import { FlaskConical } from "lucide-react";
import { useActionState, useState } from "react";

import { Callout } from "@/components/ui/callout";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { cn } from "@/lib/utils/cn";

import { addTestFunds, type AddTestFundsState } from "../actions";

const PRESETS = ["100", "250", "500", "1000"] as const;
const IDLE: AddTestFundsState = { status: "idle" };

/**
 * DEVELOPMENT ONLY — never a production payment method. Rendered only when the
 * mock provider is available and the database allows test funds.
 */
export function AddTestFundsForm({ idempotencyKey, suggestedAmount }: { idempotencyKey: string; suggestedAmount?: string }) {
  const [state, action] = useActionState(addTestFunds, IDLE);
  const [amount, setAmount] = useState(suggestedAmount ?? "500");

  return (
    <section
      aria-labelledby="test-funds-title"
      className="flex flex-col gap-4 rounded-card border-2 border-dashed border-warning bg-warning-bg/40 p-5"
    >
      <div className="flex items-start gap-3">
        <span className="flex size-10 flex-none items-center justify-center rounded-control bg-warning-bg text-warning-fg">
          <FlaskConical aria-hidden className="size-5" />
        </span>
        <div className="flex flex-col gap-1">
          <h2 id="test-funds-title" className="flex flex-wrap items-center gap-2 text-[15px] font-[650]">
            Add test funds
            <span className="rounded-full bg-warning px-2 py-0.5 text-[11px] font-bold tracking-[0.04em] text-white uppercase">
              Development only
            </span>
          </h2>
          <p className="text-[13px] leading-normal text-warning-fg">
            Fake balance from the mock provider so the funding flow can be tested. No card is charged and no money moves.
            This option does not exist in production.
          </p>
        </div>
      </div>

      <form action={action} className="flex flex-col gap-3">
        <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
        <div className="flex flex-wrap gap-2" role="group" aria-label="Preset amounts">
          {PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              aria-pressed={amount === preset}
              onClick={() => setAmount(preset)}
              className={cn(
                "tabular h-9 cursor-pointer rounded-full border px-3.5 text-[13px] font-[550]",
                amount === preset ? "border-primary-strong bg-primary-strong text-white" : "border-line bg-surface hover:bg-canvas",
              )}
            >
              ${Number(preset).toLocaleString("en-US")}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <label htmlFor="test-funds-amount" className="sr-only">Amount in USD</label>
          <div className="relative flex-1">
            <span aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-muted">$</span>
            <Input
              id="test-funds-amount"
              name="amount"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="tabular pl-7"
              autoComplete="off"
            />
          </div>
          <SubmitButton variant="secondary" pendingLabel="Adding…" className="border-warning text-warning-fg hover:bg-warning-bg">
            Add test funds
          </SubmitButton>
        </div>
        <p className="text-xs text-ink-muted">Tip: amounts ending in .13 are declined by the mock provider, to test failures.</p>
        {state.status === "succeeded" ? <Callout tone="success"><span role="status">{state.message}</span></Callout> : null}
        {state.status === "failed" || state.status === "error" ? <Callout tone="danger">{state.message}</Callout> : null}
      </form>
    </section>
  );
}
