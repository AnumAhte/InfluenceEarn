import { StatusBadge } from "@/components/ui/status-badge";
import { PLATFORM_META, type SocialPlatform } from "@/domain/campaigns/catalog";
import type { CampaignStatus } from "@/domain/campaigns/state-machine";
import { cents, formatMoney } from "@/domain/money";
import { calculateCampaignFunding } from "@/domain/pricing";
import { cn } from "@/lib/utils/cn";

import { CAMPAIGN_STATUS_META } from "../status";

export function CampaignStatusBadge({ status }: { status: CampaignStatus }) {
  const meta = CAMPAIGN_STATUS_META[status];
  return <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>;
}

export function PlatformTile({ platform, active = true, size = "sm" }: { platform: SocialPlatform; active?: boolean; size?: "sm" | "md" }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex flex-none items-center justify-center font-bold",
        size === "sm" ? "size-[22px] rounded-md text-[9.5px]" : "size-8 rounded-[10px] text-xs",
        active ? "bg-primary-strong text-white" : "bg-surface-muted text-ink-secondary",
      )}
    >
      {PLATFORM_META[platform].code}
    </span>
  );
}

export function PlatformList({ platforms }: { platforms: SocialPlatform[] }) {
  if (platforms.length === 0) return <span className="text-ink-muted">Not set</span>;
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {platforms.map((platform) => (
        <span key={platform} className="flex items-center gap-1.5 text-ink-secondary">
          <PlatformTile platform={platform} />
          <span className="sr-only sm:not-sr-only">{PLATFORM_META[platform].label}</span>
        </span>
      ))}
    </span>
  );
}

/**
 * Creator budget, 20% fee and total — always computed by the domain pricing code
 * (the database recomputes the same numbers when funding).
 */
export function CostBreakdown({
  paymentPerCreatorCents,
  creatorsRequired,
  totalLabel = "Debited from wallet",
  className,
}: {
  paymentPerCreatorCents: number | null;
  creatorsRequired: number | null;
  totalLabel?: string;
  className?: string;
}) {
  const ready = paymentPerCreatorCents !== null && paymentPerCreatorCents > 0 && creatorsRequired !== null && creatorsRequired > 0;
  const funding = ready ? calculateCampaignFunding(cents(paymentPerCreatorCents), creatorsRequired) : null;
  const money = (value: number) => formatMoney(cents(value));

  return (
    <div className={cn("overflow-hidden rounded-[14px] border border-line", className)}>
      <div className="border-b border-line bg-canvas px-4 py-[11px]">
        <span className="text-[11.5px] font-semibold tracking-[0.05em] text-ink-muted uppercase">Cost breakdown</span>
      </div>
      <dl className="flex flex-col gap-3 p-4">
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-sm text-ink-secondary">
            {ready ? `${creatorsRequired.toLocaleString("en-US")} ${creatorsRequired === 1 ? "creator" : "creators"} × ${money(paymentPerCreatorCents)}` : "Creator budget"}
          </dt>
          <dd className="tabular text-[14.5px] font-semibold">{funding ? money(funding.creatorBudget) : "—"}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-sm text-ink-secondary">Platform fee (20%)</dt>
          <dd className="tabular text-[14.5px] font-semibold">{funding ? money(funding.platformFee) : "—"}</dd>
        </div>
        <div aria-hidden className="h-px bg-line" />
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-[15px] font-[650]">{totalLabel}</dt>
          <dd className="tabular text-[22px] font-bold tracking-[-0.02em]">{funding ? money(funding.totalFunding) : "—"}</dd>
        </div>
      </dl>
    </div>
  );
}

export function formatDate(value: string | null | undefined, fallback = "Not set") {
  if (!value) return fallback;
  return new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(value),
  );
}
