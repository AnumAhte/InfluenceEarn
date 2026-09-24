import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

export function Container({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("mx-auto w-full max-w-page px-5 sm:px-8 lg:px-10", className)} {...props} />;
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "text-xs font-semibold tracking-[0.08em] text-primary-strong uppercase",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  id,
  className,
}: {
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  id?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex max-w-[640px] flex-col gap-3", className)}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2
        id={id}
        className="text-[30px] leading-[1.12] font-bold tracking-[-0.03em] text-balance sm:text-[40px]"
      >
        {title}
      </h2>
      {description ? (
        <p className="text-base leading-relaxed text-pretty text-ink-secondary sm:text-[17px]">
          {description}
        </p>
      ) : null}
    </div>
  );
}

/** Marks illustrative figures so they are never mistaken for platform statistics. */
export function ExampleTag({ className, dark = false }: { className?: string; dark?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-[0.04em] uppercase",
        dark ? "bg-white/10 text-primary-200" : "bg-surface-muted text-ink-muted",
        className,
      )}
    >
      Example
    </span>
  );
}
