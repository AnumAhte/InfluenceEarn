import type { ComponentProps } from "react";

import { cn } from "@/lib/utils/cn";

export const controlClasses =
  "w-full rounded-control border border-line bg-surface px-3.5 text-[15px] text-ink transition-[border-color,box-shadow] outline-none sm:text-[14.5px] focus-visible:border-primary focus-visible:shadow-[0_0_0_3px_rgba(10,95,107,0.18)] focus-visible:outline-none aria-invalid:border-danger aria-invalid:shadow-[0_0_0_3px_rgba(220,38,38,0.16)] disabled:cursor-not-allowed disabled:bg-canvas disabled:text-ink-muted";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(controlClasses, "h-12 sm:h-11", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea className={cn(controlClasses, "min-h-[88px] resize-y py-3", className)} {...props} />
  );
}
