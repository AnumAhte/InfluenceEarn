import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

type CalloutTone = "info" | "neutral" | "success" | "warning" | "danger";

const toneClasses: Record<CalloutTone, { box: string; dot: string }> = {
  info: { box: "bg-surface-muted text-ink-secondary", dot: "bg-primary" },
  neutral: { box: "bg-surface-muted text-ink-secondary", dot: "bg-ink-muted" },
  success: { box: "border border-success-bg bg-success-bg/60 text-success-fg", dot: "bg-success" },
  warning: { box: "border border-warning-bg bg-warning-bg/60 text-warning-fg", dot: "bg-warning" },
  danger: { box: "border border-danger-border bg-danger-bg text-danger-fg", dot: "bg-danger" },
};

/**
 * The small "dot + note" message used throughout the designs.
 * Danger callouts are announced to assistive technology.
 */
export function Callout({
  tone = "info",
  children,
  className,
}: {
  tone?: CalloutTone;
  children: ReactNode;
  className?: string;
}) {
  const classes = toneClasses[tone];
  return (
    <div
      role={tone === "danger" ? "alert" : undefined}
      className={cn(
        "flex items-start gap-2.5 rounded-control px-3.5 py-3 text-[13px] leading-[1.55]",
        classes.box,
        className,
      )}
    >
      <span aria-hidden className={cn("mt-[7px] size-1.5 flex-none rounded-full", classes.dot)} />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
