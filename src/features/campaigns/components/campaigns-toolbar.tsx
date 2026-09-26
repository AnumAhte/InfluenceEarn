"use client";

import { Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { Spinner } from "@/components/ui/spinner";
import { CATEGORIES, PLATFORM_META, SOCIAL_PLATFORMS } from "@/domain/campaigns/catalog";
import { cn } from "@/lib/utils/cn";

import { PlatformTile } from "./campaign-bits";

const FILTER_KEYS = ["q", "platform", "category", "from", "to"] as const;

/**
 * Search + filters. State lives in the URL; the server does the filtering and
 * pagination. Any change resets to page 1.
 */
export function CampaignsToolbar({ resultLine }: { resultLine: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const urlQuery = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(urlQuery);
  const [previousUrlQuery, setPreviousUrlQuery] = useState(urlQuery);

  // The search was cleared elsewhere (e.g. "Clear filters" link): reset the input.
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

  // Debounced search.
  useEffect(() => {
    if (query.trim() === urlQuery) return;
    const timer = setTimeout(() => update({ q: query.trim() || null }), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `update` reads the latest params on each run
  }, [query]);

  const platform = searchParams.get("platform");
  const hasFilters = FILTER_KEYS.some((key) => searchParams.get(key));

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
            className="h-full flex-1 bg-transparent text-[14.5px] text-ink outline-none"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="cursor-pointer rounded-md p-1 text-ink-muted hover:text-ink"
            >
              <X aria-hidden className="size-3.5" />
            </button>
          ) : null}
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <FilterSelect
          label="Category"
          value={searchParams.get("category") ?? ""}
          onChange={(value) => update({ category: value || null })}
          options={CATEGORIES.map((c) => ({ value: c.slug, label: c.label }))}
          allLabel="All categories"
        />
        <DateFilter label="Created from" value={searchParams.get("from") ?? ""} onChange={(value) => update({ from: value || null })} />
        <DateFilter label="to" value={searchParams.get("to") ?? ""} onChange={(value) => update({ to: value || null })} />
        {hasFilters ? (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              update({ q: null, platform: null, category: null, from: null, to: null });
            }}
            className="cursor-pointer px-1.5 py-2 text-[13px] font-[550] text-primary-strong hover:text-primary-hover"
          >
            Clear filters
          </button>
        ) : null}
        <span className="text-[13px] text-ink-muted sm:ml-auto" aria-live="polite">
          {resultLine}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-line-soft pt-3" role="group" aria-label="Platform">
        <span className="mr-0.5 text-[11.5px] font-semibold tracking-[0.05em] text-ink-muted uppercase">Platform</span>
        <PlatformButton active={!platform} onClick={() => update({ platform: null })}>
          All platforms
        </PlatformButton>
        {SOCIAL_PLATFORMS.map((p) => (
          <PlatformButton key={p} active={platform === p} onClick={() => update({ platform: platform === p ? null : p })}>
            <PlatformTile platform={p} active={platform === p} />
            {PLATFORM_META[p].label}
          </PlatformButton>
        ))}
      </div>
    </div>
  );
}

function PlatformButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex cursor-pointer items-center gap-[7px] rounded-full border px-[13px] py-[7px] text-[13px] font-[550]",
        active ? "border-primary bg-primary-100 text-primary-hover" : "border-line bg-surface text-ink hover:bg-surface-muted",
      )}
    >
      {children}
    </button>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  allLabel,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  allLabel: string;
}) {
  return (
    <label className="flex items-center gap-2 rounded-[11px] border border-line bg-surface px-3 py-1.5 text-[13px] font-[550] focus-within:border-primary">
      <span className="text-[11.5px] font-semibold tracking-[0.03em] text-ink-muted uppercase">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="cursor-pointer bg-transparent py-1 text-ink outline-none"
      >
        <option value="">{allLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function DateFilter({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="flex items-center gap-2 rounded-[11px] border border-line bg-surface px-3 py-1.5 text-[13px] font-[550] focus-within:border-primary">
      <span className="text-[11.5px] font-semibold tracking-[0.03em] text-ink-muted uppercase">{label}</span>
      <input type="date" value={value} onChange={(event) => onChange(event.target.value)} className="bg-transparent py-1 text-ink outline-none" />
    </label>
  );
}
