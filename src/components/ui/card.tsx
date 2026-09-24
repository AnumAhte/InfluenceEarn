import type { ComponentProps } from "react";

import { cn } from "@/lib/utils/cn";

export function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("rounded-card border border-line bg-surface shadow-xs", className)}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-4 border-b border-line px-5 py-5 sm:px-6",
        className,
      )}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: ComponentProps<"h2">) {
  return (
    <h2 className={cn("text-[16.5px] font-[650] tracking-[-0.02em]", className)} {...props} />
  );
}
