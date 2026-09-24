import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

type MetricTone = "default" | "attention" | "dark";

const toneClasses: Record<MetricTone, { card: string; label: string; value: string; hint: string }> = {
  default: {
    card: "border border-line bg-surface shadow-xs",
    label: "text-ink-secondary",
    value: "text-ink",
    hint: "text-ink-muted",
  },
  attention: {
    card: "border-[1.5px] border-warning bg-surface shadow-[0_8px_24px_-16px_rgba(217,119,6,0.4)]",
    label: "font-semibold text-warning-fg",
    value: "text-ink",
    hint: "font-medium text-warning-fg",
  },
  dark: {
    card: "bg-night",
    label: "text-ink-disabled",
    value: "text-white",
    hint: "text-ink-subtle",
  },
};

/** Summary number tile. Only render with real, computed values. */
export function MetricCard({
  label,
  value,
  hint,
  tone = "default",
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: MetricTone;
  className?: string;
}) {
  const classes = toneClasses[tone];
  return (
    <div className={cn("flex flex-col gap-2 rounded-card p-5", classes.card, className)}>
      <span className={cn("text-[12.5px] font-medium", classes.label)}>{label}</span>
      <span
        className={cn(
          "tabular text-[30px] leading-none font-bold tracking-[-0.03em]",
          classes.value,
        )}
      >
        {value}
      </span>
      {hint ? <span className={cn("text-xs", classes.hint)}>{hint}</span> : null}
    </div>
  );
}
