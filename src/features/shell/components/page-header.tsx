import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 sm:gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-[-0.03em] sm:text-[28px]">{title}</h1>
        {description ? (
          <p className="text-[15px] leading-relaxed text-ink-secondary sm:text-[15.5px]">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-none gap-2.5">{actions}</div> : null}
    </div>
  );
}
