import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

export type StatusTone = "success" | "warning" | "danger" | "info" | "neutral";

const toneClasses: Record<StatusTone, string> = {
  success: "bg-success-bg text-success-fg",
  warning: "bg-warning-bg text-warning-fg",
  danger: "bg-danger-bg text-danger-fg",
  info: "bg-primary-100 text-primary-hover",
  neutral: "bg-surface-muted text-ink-secondary",
};

/**
 * Pill used for workflow states. Callers map domain states to a tone + label so the
 * colour never carries meaning on its own.
 */
export function StatusBadge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: StatusTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-[5px] text-xs font-semibold",
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Small bordered chip for requirements such as "Instagram Reel" or "25k+ followers". */
export function Chip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-chip border border-line bg-canvas px-[9px] py-[5px] text-xs font-medium text-ink-secondary",
        className,
      )}
    >
      {children}
    </span>
  );
}
