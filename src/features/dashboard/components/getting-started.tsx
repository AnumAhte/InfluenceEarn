import { Check } from "lucide-react";
import Link from "next/link";

import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils/cn";

export type ChecklistStep = {
  title: string;
  description: string;
  done: boolean;
  /** Link to act on the step; omitted when the feature is not available yet. */
  action?: { href: string; label: string };
  comingSoon?: boolean;
};

export function GettingStarted({ steps }: { steps: ChecklistStep[] }) {
  const completed = steps.filter((step) => step.done).length;
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-1">
          <CardTitle>Getting started</CardTitle>
          <p className="text-[13px] text-ink-muted">
            {completed} of {steps.length} done
          </p>
        </div>
      </CardHeader>
      <ol>
        {steps.map((step) => (
          <li
            key={step.title}
            className="flex flex-col gap-3 border-b border-line-soft px-5 py-4 last:border-b-0 sm:flex-row sm:items-center sm:gap-4 sm:px-6"
          >
            <span
              className={cn(
                "flex size-7 flex-none items-center justify-center rounded-full border-[1.5px]",
                step.done ? "border-success bg-success text-white" : "border-line bg-surface",
              )}
            >
              {step.done ? <Check aria-hidden className="size-3.5" strokeWidth={3} /> : null}
              <span className="sr-only">{step.done ? "Done:" : "To do:"}</span>
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-sm font-semibold">{step.title}</span>
              <span className="text-[13px] leading-normal text-ink-secondary">{step.description}</span>
            </span>
            {step.comingSoon ? (
              <StatusBadge tone="neutral">Coming soon</StatusBadge>
            ) : step.action && !step.done ? (
              <Link
                href={step.action.href}
                className="text-[13.5px] font-[550] text-primary-strong hover:text-primary-hover"
              >
                {step.action.label}
              </Link>
            ) : null}
          </li>
        ))}
      </ol>
    </Card>
  );
}
