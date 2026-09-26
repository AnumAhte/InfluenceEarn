"use client";

import { useFormContext, useWatch } from "react-hook-form";

import { Callout } from "@/components/ui/callout";
import { Input } from "@/components/ui/input";
import { paymentCents, type CampaignDraftInput } from "@/domain/campaigns/schemas";

import { CostBreakdown } from "../campaign-bits";
import { FieldError, WizardSection } from "./fields";

type Errors = Record<string, string | undefined>;

export function StepBudget({ errors }: { errors: Errors }) {
  const { register, control } = useFormContext<CampaignDraftInput>();
  const [paymentPerCreator, creatorsRequired, tasks] = useWatch({ control, name: ["paymentPerCreator", "creatorsRequired", "tasks"] });
  const deliverables = (tasks ?? []).reduce((sum, task) => sum + (Number(task.quantity) || 0), 0);

  return (
    <WizardSection title="Budget & funding" description="The campaign publishes once the total is debited from your wallet.">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-[7px]">
          <label htmlFor="paymentPerCreator" className="text-[13px] font-semibold">Payment per creator (USD)</label>
          <div className="relative">
            <span aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-muted">$</span>
            <Input
              id="paymentPerCreator"
              inputMode="decimal"
              autoComplete="off"
              placeholder="10.00"
              className="tabular pl-7"
              {...register("paymentPerCreator")}
              aria-invalid={errors.paymentPerCreator ? true : undefined}
              aria-describedby="paymentPerCreator-hint"
            />
          </div>
          <p id="paymentPerCreator-hint" className="text-[12.5px] text-ink-muted">
            Paid for completing all {deliverables} {deliverables === 1 ? "deliverable" : "deliverables"}.
          </p>
          <FieldError message={errors.paymentPerCreator} />
        </div>
        <div className="flex flex-col gap-[7px]">
          <label htmlFor="creatorsRequired" className="text-[13px] font-semibold">Creators needed</label>
          <Input
            id="creatorsRequired"
            type="number"
            inputMode="numeric"
            min={1}
            max={10000}
            className="tabular"
            {...register("creatorsRequired", { setValueAs: (v: string) => (v === "" ? null : Math.trunc(Number(v))) })}
            aria-invalid={errors.creatorsRequired ? true : undefined}
            aria-describedby="creatorsRequired-hint"
          />
          <p id="creatorsRequired-hint" className="text-[12.5px] text-ink-muted">You select them by hand from the applicants.</p>
          <FieldError message={errors.creatorsRequired} />
        </div>
      </div>

      <CostBreakdown
        paymentPerCreatorCents={paymentCents({ paymentPerCreator: paymentPerCreator ?? "" })}
        creatorsRequired={typeof creatorsRequired === "number" && Number.isFinite(creatorsRequired) ? creatorsRequired : null}
      />

      <div className="flex flex-col gap-[9px]">
        <span className="text-[13px] font-semibold">Funding source</span>
        <div className="flex flex-col gap-1 rounded-[14px] border border-primary bg-primary-100 px-4 py-3.5">
          <span className="text-sm font-semibold text-primary-hover">Wallet balance</span>
          <span className="text-[12.5px] text-ink-secondary">You&apos;ll see your available balance on the next screen.</span>
        </div>
      </div>

      <Callout tone="warning">
        Continuing saves the campaign with the status <strong className="font-semibold">Funding required</strong>. It stays
        private until the wallet debit succeeds — nothing is shown to creators before then.
      </Callout>
    </WizardSection>
  );
}
