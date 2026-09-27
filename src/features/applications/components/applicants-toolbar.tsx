"use client";

import { Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { Spinner } from "@/components/ui/spinner";
import { PLATFORM_META, type SocialPlatform } from "@/domain/campaigns/catalog";

const FOLLOWER_FILTERS = [1_000, 5_000, 10_000, 25_000, 50_000, 100_000];

/** Search + filters for a campaign's applicants; the database filters and paginates. */
export function ApplicantsToolbar({ platforms, resultLine }: { platforms: SocialPlatform[]; resultLine: string }) {
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

  const selectClass = "cursor-pointer bg-transparent py-1 outline-none";
  const wrapClass =
    "flex items-center gap-2 rounded-[11px] border border-line bg-surface px-3 py-1.5 text-[13px] font-[550] focus-within:border-primary";

  return (
    <div className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4 shadow-xs sm:px-[18px]">
      <label className="flex h-11 items-center gap-2.5 rounded-control border border-line bg-canvas px-3.5 focus-within:border-primary focus-within:shadow-[0_0_0_3px_rgba(10,95,107,0.18)]">
        {pending ? <Spinner className="size-4 text-ink-muted" /> : <Search aria-hidden className="size-4 text-ink-muted" />}
        <span className="sr-only">Search applicants by name or handle</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by name or handle..."
          className="h-full flex-1 bg-transparent text-[14.5px] outline-none"
        />
        {query ? (
          <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="cursor-pointer rounded-md p-1 text-ink-muted hover:text-ink">
            <X aria-hidden className="size-3.5" />
          </button>
        ) : null}
      </label>
      <div className="flex flex-wrap items-center gap-2.5">
        {platforms.length > 1 ? (
          <label className={wrapClass}>
            <span className="text-[11.5px] font-semibold tracking-[0.03em] text-ink-muted uppercase">Platform</span>
            <select value={searchParams.get("platform") ?? ""} onChange={(e) => update({ platform: e.target.value || null })} className={selectClass}>
              <option value="">Any</option>
              {platforms.map((p) => <option key={p} value={p}>{PLATFORM_META[p].label}</option>)}
            </select>
          </label>
        ) : null}
        <label className={wrapClass}>
          <span className="text-[11.5px] font-semibold tracking-[0.03em] text-ink-muted uppercase">Followers</span>
          <select value={searchParams.get("minFollowers") ?? ""} onChange={(e) => update({ minFollowers: e.target.value || null })} className={selectClass}>
            <option value="">Any</option>
            {FOLLOWER_FILTERS.map((n) => <option key={n} value={n}>{n.toLocaleString("en-US")}+</option>)}
          </select>
        </label>
        <label className={wrapClass}>
          <span className="text-[11.5px] font-semibold tracking-[0.03em] text-ink-muted uppercase">Sort</span>
          <select value={searchParams.get("sort") ?? "newest"} onChange={(e) => update({ sort: e.target.value === "newest" ? null : e.target.value })} className={selectClass}>
            <option value="newest">Newest</option>
            <option value="followers">Most followers</option>
          </select>
        </label>
        <span className="text-[13px] text-ink-muted sm:ml-auto" aria-live="polite">{resultLine}</span>
      </div>
    </div>
  );
}
