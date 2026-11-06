import Link from "next/link";

import { cn } from "@/lib/utils/cn";

/** Underlined tab links (same style as the payouts queue). */
export function TabNav({ label, tabs, current }: { label: string; tabs: { id: string; label: string; href: string }[]; current: string }) {
  return (
    <nav aria-label={label} className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-1.5 border-b border-line pb-0.5">
        {tabs.map((t) => (
          <li key={t.id}>
            <Link
              href={t.href}
              aria-current={current === t.id ? "page" : undefined}
              className={cn(
                "-mb-[3px] flex items-center border-b-2 px-3 py-2.5 text-[13.5px]",
                current === t.id ? "border-primary font-[650] text-ink" : "border-transparent font-[550] text-ink-muted hover:text-ink",
              )}
            >
              {t.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export const formatDateTime = (value: string) =>
  `${new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(value))} UTC`;
