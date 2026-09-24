import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 px-6 py-12 text-center sm:py-14",
        className,
      )}
    >
      <span className="mb-1 flex size-12 items-center justify-center rounded-[14px] bg-primary-100 text-primary">
        <Icon aria-hidden className="size-5" strokeWidth={2.25} />
      </span>
      <h3 className="text-[17px] font-[650] tracking-[-0.015em]">{title}</h3>
      <p className="max-w-[420px] text-sm leading-relaxed text-ink-secondary">{description}</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
