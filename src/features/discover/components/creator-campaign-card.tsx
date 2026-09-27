import { CheckCircle2, Lock } from "lucide-react";
import Link from "next/link";

import { StatusBadge } from "@/components/ui/status-badge";
import { CAMPAIGN_TYPE_META, categoryLabel, PLATFORM_META, taskLabel } from "@/domain/campaigns/catalog";
import { issueMessage, primaryIssue } from "@/domain/creators/eligibility";
import { cents, formatMoney } from "@/domain/money";
import { formatDate, PlatformTile } from "@/features/campaigns/components/campaign-bits";

import type { DiscoverRow } from "../queries";

/** Marketplace card (design: Influencer → Find Campaigns). Eligibility comes from the database. */
export function CreatorCampaignCard({ row }: { row: DiscoverRow }) {
  const issue = primaryIssue(row.issues);
  const firstPlatform = row.platforms[0];

  return (
    <li className="flex flex-col gap-4 rounded-card border border-line bg-surface p-5 shadow-xs sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <Link href={`/discover/${row.id}`} className="text-[17px] font-[650] tracking-[-0.015em] break-words text-ink hover:text-primary-hover">
            {row.title}
          </Link>
          <span className="text-[13px] text-ink-muted">{row.advertiser_name}</span>
        </div>
        {row.applied ? (
          <StatusBadge tone="info">Applied</StatusBadge>
        ) : issue ? (
          <StatusBadge tone="warning">Requirements</StatusBadge>
        ) : (
          <StatusBadge tone="success">Eligible</StatusBadge>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {row.platforms.map((p) => (
          <span key={p} className="flex items-center gap-1.5 rounded-chip border border-line bg-canvas py-1 pr-2 pl-1 text-xs font-medium text-ink-secondary">
            <PlatformTile platform={p} />
            {PLATFORM_META[p].label}
          </span>
        ))}
        {firstPlatform && row.task_types[0] ? (
          <span className="rounded-chip border border-line bg-canvas px-[9px] py-[5px] text-xs font-medium text-ink-secondary">
            {taskLabel(row.task_types[0], firstPlatform)}
            {row.task_types.length > 1 ? ` +${row.task_types.length - 1}` : ""}
          </span>
        ) : null}
        <span className="rounded-chip border border-line bg-canvas px-[9px] py-[5px] text-xs font-medium text-ink-secondary">
          {categoryLabel(row.category_slug)}
        </span>
        {row.campaign_type ? (
          <span className="rounded-chip border border-line bg-canvas px-[9px] py-[5px] text-xs font-medium text-ink-secondary">
            {CAMPAIGN_TYPE_META[row.campaign_type].label}
          </span>
        ) : null}
      </div>

      <dl className="grid grid-cols-2 gap-2.5 text-xs sm:grid-cols-4">
        <Stat label="Reward" value={row.payment_per_creator_cents ? formatMoney(cents(row.payment_per_creator_cents)) : "—"} strong />
        <Stat label="Min followers" value={row.min_followers ? row.min_followers.toLocaleString("en-US") : "None"} />
        <Stat label="Creators needed" value={String(row.creators_required ?? "—")} />
        <Stat label="Applications close" value={formatDate(row.application_deadline)} />
      </dl>

      <div className="mt-auto flex flex-col gap-2 border-t border-line-soft pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-1.5 text-[13px]">
          {row.applied ? (
            <span className="text-ink-secondary">You applied to this campaign.</span>
          ) : issue ? (
            <>
              <Lock aria-hidden className="size-3.5 text-warning-fg" />
              <span className="text-warning-fg">{issueMessage(issue, row.min_followers)}</span>
            </>
          ) : (
            <>
              <CheckCircle2 aria-hidden className="size-3.5 text-success" />
              <span className="text-success-fg">You meet the requirements</span>
            </>
          )}
        </p>
        <Link
          href={`/discover/${row.id}`}
          className="inline-flex h-10 items-center justify-center rounded-control border border-line bg-surface px-4 text-sm font-[550] text-ink hover:bg-canvas"
        >
          View campaign
          <span className="sr-only">: {row.title}</span>
        </Link>
      </div>
    </li>
  );
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-control bg-canvas px-3 py-2.5">
      <dt className="text-ink-muted">{label}</dt>
      <dd className={strong ? "tabular text-[15px] font-bold" : "tabular text-[13.5px] font-semibold"}>{value}</dd>
    </div>
  );
}
