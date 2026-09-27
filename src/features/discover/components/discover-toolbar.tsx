"use client";

import { Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { Spinner } from "@/components/ui/spinner";
import { CATEGORIES, PLATFORM_META, SOCIAL_PLATFORMS } from "@/domain/campaigns/catalog";
import { cn } from "@/lib/utils/cn";

const SORT_LABELS = { newest: "Newest", highest_reward: "Highest reward", ending_soon: "Ending soon" } as const;

/** Marketplace filters. State lives in the URL; the database filters and paginates. */
export function DiscoverToolbar({ resultLine }: { resultLine: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const urlQuery = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(urlQuery);
  const [previousUrlQuery, setPreviousUrlQuery] = useState(urlQuery);

  if (urlQuery !== previousUrlQuery) {
    setPreviousUrlQuery(urlQuery);
    if (urlQuery === "") setQuery("");
  }

  function update(changes: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    next.delete("page");
    const search = next.toString();
    startTransition(() => router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false }));
  }

  useEffect(() => {
    if (query.trim() === urlQuery) return;
    const timer = setTimeout(() => update({ q: query.trim() || null }), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `update` reads the latest params on each run
  }, [query]);

  const eligibleOnly = searchParams.get("eligible") === "1";
  const hasFilters = ["q", "platform", "category", "eligible"].some((key) => searchParams.get(key));

  return (
    <div className="flex flex-col gap-3.5 rounded-card border border-line bg-surface p-4 shadow-xs sm:px-[18px]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="flex h-11 flex-1 items-center gap-2.5 rounded-control border border-line bg-canvas px-3.5 focus-within:border-primary focus-within:shadow-[0_0_0_3px_rgba(10,95,107,0.18)]">
          {pending ? <Spinner className="size-4 text-ink-muted" /> : <Search aria-hidden className="size-4 text-ink-muted" />}
          <span className="sr-only">Search campaigns</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search campaigns..."
            className="h-full flex-1 bg-transparent text-[14.5px] outline-none"
          />
          {query ? (
            <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="cursor-pointer rounded-md p-1 text-ink-muted hover:text-ink">
              <X aria-hidden className="size-3.5" />
            </button>
          ) : null}
        </label>
        <label className="flex h-11 items-center gap-2 rounded-control border border-line bg-surface px-3 text-[13.5px] font-[550] focus-within:border-primary">
          <span className="sr-only">Sort</span>
          <select
            value={searchParams.get("sort") ?? "newest"}
            onChange={(event) => update({ sort: event.target.value === "newest" ? null : event.target.value })}
            className="cursor-pointer bg-transparent outline-none"
          >
            {Object.entries(SORT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>Sort: {label}</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          aria-pressed={eligibleOnly}
          onClick={() => update({ eligible: eligibleOnly ? null : "1" })}
          className={cn(
            "h-11 cursor-pointer rounded-control border px-4 text-[13.5px] font-[550] whitespace-nowrap",
            eligibleOnly ? "border-primary-strong bg-primary-strong text-white" : "border-line bg-surface hover:bg-surface-muted",
          )}
        >
          Eligible only
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <label className="flex items-center gap-2 rounded-[11px] border border-line bg-surface px-3 py-1.5 text-[13px] font-[550] focus-within:border-primary">
          <span className="text-[11.5px] font-semibold tracking-[0.03em] text-ink-muted uppercase">Platform</span>
          <select
            value={searchParams.get("platform") ?? ""}
            onChange={(event) => update({ platform: event.target.value || null })}
            className="cursor-pointer bg-transparent py-1 outline-none"
          >
            <option value="">All platforms</option>
            {SOCIAL_PLATFORMS.map((p) => (
              <option key={p} value={p}>{PLATFORM_META[p].label}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 rounded-[11px] border border-line bg-surface px-3 py-1.5 text-[13px] font-[550] focus-within:border-primary">
          <span className="text-[11.5px] font-semibold tracking-[0.03em] text-ink-muted uppercase">Category</span>
          <select
            value={searchParams.get("category") ?? ""}
            onChange={(event) => update({ category: event.target.value || null })}
            className="cursor-pointer bg-transparent py-1 outline-none"
          >
            <option value="">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c.slug} value={c.slug}>{c.label}</option>
            ))}
          </select>
        </label>
        {hasFilters ? (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              update({ q: null, platform: null, category: null, eligible: null });
            }}
            className="cursor-pointer px-1.5 py-2 text-[13px] font-[550] text-primary-strong hover:text-primary-hover"
          >
            Reset
          </button>
        ) : null}
        <span className="text-[13px] text-ink-muted sm:ml-auto" aria-live="polite">{resultLine}</span>
      </div>
    </div>
  );
}
