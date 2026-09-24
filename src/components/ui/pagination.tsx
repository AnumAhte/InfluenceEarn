import Link from "next/link";

import { cn } from "@/lib/utils/cn";

const ITEM = "inline-flex h-[34px] min-w-[34px] items-center justify-center rounded-[10px] border px-3 text-[13px] font-[550]";

/** Server-rendered pagination. Pages are links, so it works without JavaScript. */
export function Pagination({
  page,
  pageSize,
  total,
  hrefFor,
  label,
}: {
  page: number;
  pageSize: number;
  total: number;
  hrefFor: (page: number) => string;
  label: string;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(total, page * pageSize);
  const pages = visiblePages(page, pageCount);

  return (
    <nav
      aria-label={`${label} pagination`}
      className="flex flex-col items-center justify-between gap-3 border-t border-line bg-canvas px-4 py-3.5 sm:flex-row sm:px-[22px]"
    >
      <p className="tabular text-[13px] text-ink-muted">
        {total === 0 ? "No results" : `Showing ${first}–${last} of ${total.toLocaleString("en-US")}`}
      </p>
      <div className="flex items-center gap-1.5">
        <PageLink href={page > 1 ? hrefFor(page - 1) : null}>Previous</PageLink>
        {pages.map((p, index) =>
          p === "gap" ? (
            <span key={`gap-${index}`} aria-hidden className="px-1 text-ink-muted">
              …
            </span>
          ) : p === page ? (
            <span key={p} aria-current="page" className={cn(ITEM, "tabular border-night bg-night text-white")}>
              {p}
            </span>
          ) : (
            <Link
              key={p}
              href={hrefFor(p)}
              aria-label={`Page ${p}`}
              className={cn(ITEM, "tabular hidden border-line bg-surface text-ink hover:bg-surface-muted sm:inline-flex")}
            >
              {p}
            </Link>
          ),
        )}
        <PageLink href={page < pageCount ? hrefFor(page + 1) : null}>Next</PageLink>
      </div>
    </nav>
  );
}

function PageLink({ href, children }: { href: string | null; children: string }) {
  if (!href) {
    return (
      <span aria-disabled="true" className={cn(ITEM, "border-line bg-surface text-ink-subtle")}>
        {children}
      </span>
    );
  }
  return (
    <Link href={href} className={cn(ITEM, "border-line bg-surface text-ink hover:bg-surface-muted")}>
      {children}
    </Link>
  );
}

export function visiblePages(page: number, pageCount: number): (number | "gap")[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);
  const pages = new Set([1, pageCount, page - 1, page, page + 1].filter((p) => p >= 1 && p <= pageCount));
  const sorted = [...pages].sort((a, b) => a - b);
  const result: (number | "gap")[] = [];
  for (const [index, p] of sorted.entries()) {
    const previous = sorted[index - 1];
    if (previous !== undefined && p - previous > 1) result.push("gap");
    result.push(p);
  }
  return result;
}
