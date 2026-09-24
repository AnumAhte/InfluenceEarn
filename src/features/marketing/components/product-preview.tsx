import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";

import { ExampleTag } from "./section";

// Illustrative content only — clearly tagged as an example in the UI.
const EXAMPLE_TILES = [
  { label: "Campaign funds", value: "$1,200", hint: "1 campaign live", hintClass: "text-success-fg" },
  { label: "Applicants", value: "48", hint: "12 shortlisted", hintClass: "text-ink-secondary" },
  { label: "Awaiting review", value: "3", hint: "Awaiting your approval", hintClass: "text-warning-fg" },
  { label: "Selected", value: "10", hint: "Chosen by you", hintClass: "text-ink-secondary" },
] as const;

const EXAMPLE_WORK: { creator: string; task: string; status: string; tone: StatusTone }[] = [
  { creator: "Creator A", task: "Instagram Reel · link submitted", status: "Awaiting review", tone: "warning" },
  { creator: "Creator B", task: "Instagram Story · link submitted", status: "Approved", tone: "success" },
  { creator: "Creator C", task: "Instagram Reel · in progress", status: "In progress", tone: "info" },
];

const SIDEBAR_ITEMS = ["Overview", "Campaigns", "Applicants", "Payments"] as const;

export function ProductPreview() {
  return (
    <figure className="mt-10 w-full overflow-hidden rounded-card border border-line bg-surface text-left shadow-hero sm:mt-14">
      <div className="flex h-10 items-center gap-2 border-b border-line-soft bg-canvas px-4">
        <span aria-hidden className="size-2.5 rounded-full bg-line" />
        <span aria-hidden className="size-2.5 rounded-full bg-line" />
        <span aria-hidden className="size-2.5 rounded-full bg-line" />
        <span className="ml-3 hidden text-xs text-ink-muted sm:inline">app.influencearn.com / dashboard</span>
        <ExampleTag className="ml-auto" />
      </div>

      <div className="grid md:grid-cols-[200px_1fr]">
        <div
          aria-hidden
          className="hidden flex-col gap-1.5 border-r border-line-soft bg-canvas px-4 py-5 md:flex"
        >
          <span className="px-2 pb-1.5 text-[11px] font-semibold tracking-[0.06em] text-ink-muted uppercase">
            Advertiser
          </span>
          {SIDEBAR_ITEMS.map((item, index) => (
            <span
              key={item}
              className={
                index === 0
                  ? "rounded-[9px] bg-primary-100 px-2.5 py-2 text-[13px] font-[550] text-primary-hover"
                  : "rounded-[9px] px-2.5 py-2 text-[13px] text-ink-secondary"
              }
            >
              {item}
            </span>
          ))}
          <span className="mt-auto border-t border-line-soft px-2.5 py-2 text-xs text-ink-muted">
            Switch to Influencer
          </span>
        </div>

        <div className="flex flex-col gap-5 bg-canvas p-4 sm:p-6">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {EXAMPLE_TILES.map((tile) => (
              <div
                key={tile.label}
                className="flex flex-col gap-1.5 rounded-[14px] border border-line bg-surface p-4"
              >
                <span className="text-[11.5px] text-ink-secondary">{tile.label}</span>
                <span className="tabular text-[22px] font-bold tracking-[-0.02em]">{tile.value}</span>
                <span className={`text-[11.5px] ${tile.hintClass}`}>{tile.hint}</span>
              </div>
            ))}
          </div>

          <div className="rounded-[14px] border border-line bg-surface">
            <div className="flex items-baseline justify-between gap-3 border-b border-line-soft px-5 py-4">
              <span className="text-[13.5px] font-semibold">Submitted work</span>
              <span className="text-xs text-ink-muted">Summer collection</span>
            </div>
            <ul>
              {EXAMPLE_WORK.map((row) => (
                <li
                  key={row.creator}
                  className="flex items-center justify-between gap-4 border-b border-line-soft px-5 py-3 last:border-b-0"
                >
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-[13.5px] font-[550]">{row.creator}</span>
                    <span className="truncate text-xs text-ink-muted">{row.task}</span>
                  </span>
                  <StatusBadge tone={row.tone}>{row.status}</StatusBadge>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      <figcaption className="sr-only">
        Example of the advertiser dashboard with illustrative figures.
      </figcaption>
    </figure>
  );
}
