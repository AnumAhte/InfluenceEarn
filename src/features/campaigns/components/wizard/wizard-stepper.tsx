"use client";

import { Check } from "lucide-react";

import { WIZARD_STEPS, type WizardStep } from "@/domain/campaigns/schemas";
import { cn } from "@/lib/utils/cn";

/** Desktop: 4 connected steps. Mobile: "Step n of 4" with a progress bar. */
export function WizardStepper({
  step,
  onSelect,
  stepsWithErrors,
}: {
  step: WizardStep;
  onSelect: (step: WizardStep) => void;
  stepsWithErrors: ReadonlySet<WizardStep>;
}) {
  const current = WIZARD_STEPS[step - 1];
  return (
    <>
      <div className="flex flex-col gap-2 rounded-card border border-line bg-surface px-4 py-3.5 shadow-xs md:hidden">
        <p className="flex items-center justify-between text-[13px] font-[550]">
          <span>
            Step {step} of 4 · {current.label}
          </span>
          <span className="tabular text-ink-muted">{step * 25}%</span>
        </p>
        <div
          role="progressbar"
          aria-label="Wizard progress"
          aria-valuemin={1}
          aria-valuemax={4}
          aria-valuenow={step}
          className="h-1 overflow-hidden rounded-full bg-line"
        >
          <div className="h-full bg-primary transition-[width]" style={{ width: `${step * 25}%` }} />
        </div>
      </div>

      <nav aria-label="Campaign steps" className="hidden rounded-card border border-line bg-surface px-[22px] py-[18px] shadow-xs md:block">
        <ol className="flex items-center">
          {WIZARD_STEPS.map((item, index) => {
            const active = item.id === step;
            const done = item.id < step;
            const hasError = stepsWithErrors.has(item.id);
            return (
              <li key={item.id} className="flex min-w-0 flex-1 items-center">
                <button
                  type="button"
                  onClick={() => onSelect(item.id)}
                  aria-current={active ? "step" : undefined}
                  className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-control text-left"
                >
                  <span
                    className={cn(
                      "flex size-[34px] flex-none items-center justify-center rounded-[11px] border text-[13.5px] font-[650]",
                      hasError
                        ? "border-danger-border bg-danger-bg text-danger-fg"
                        : active
                          ? "border-primary-strong bg-primary-strong text-white"
                          : done
                            ? "border-primary-200 bg-primary-100 text-primary-hover"
                            : "border-line bg-surface text-ink-muted",
                    )}
                  >
                    {done && !hasError ? <Check aria-hidden className="size-4" strokeWidth={3} /> : item.id}
                  </span>
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-[11px] font-semibold tracking-[0.06em] text-ink-muted uppercase">Step {item.id}</span>
                    <span className={cn("truncate text-sm", active ? "font-[650] text-ink" : done ? "font-[550] text-ink" : "font-[550] text-ink-muted")}>
                      {item.label}
                    </span>
                    {hasError ? <span className="sr-only">(needs attention)</span> : null}
                  </span>
                </button>
                {index < WIZARD_STEPS.length - 1 ? (
                  <span aria-hidden className={cn("mx-2 h-0.5 w-10 flex-none rounded-sm lg:w-14", done ? "bg-primary" : "bg-line")} />
                ) : null}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}
