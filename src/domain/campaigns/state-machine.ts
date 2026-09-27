/**
 * Campaign lifecycle. Mirrors `public.campaign_transition_allowed()` in
 * supabase/migrations/20260925090000_campaigns.sql — the database is authoritative
 * and rejects anything not listed here; this copy drives UI affordances and tests.
 */
export const CAMPAIGN_STATUSES = [
  "draft",
  "funding_required",
  "published",
  "applications_open",
  "selection_in_progress",
  "in_progress",
  "review_pending",
  "completed",
  "cancelled",
] as const;

export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

const TRANSITIONS: Readonly<Record<CampaignStatus, readonly CampaignStatus[]>> = {
  draft: ["funding_required", "cancelled"],
  funding_required: ["draft", "published", "cancelled"],
  published: ["applications_open"],
  applications_open: ["selection_in_progress"],
  selection_in_progress: ["in_progress"],
  in_progress: ["review_pending", "completed"],
  review_pending: ["in_progress", "completed"],
  completed: [],
  cancelled: [],
};

export class InvalidCampaignTransitionError extends Error {
  constructor(
    readonly from: CampaignStatus,
    readonly to: CampaignStatus,
  ) {
    super(`Invalid campaign transition: ${from} → ${to}`);
    this.name = "InvalidCampaignTransitionError";
  }
}

export function canTransition(from: CampaignStatus, to: CampaignStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertTransition(from: CampaignStatus, to: CampaignStatus): void {
  if (!canTransition(from, to)) throw new InvalidCampaignTransitionError(from, to);
}

/** Campaign content and budget may change only before funding. */
export function isEditable(status: CampaignStatus): boolean {
  return status === "draft" || status === "funding_required";
}

/** Visible to signed-in creators (discovery arrives in phase 3). */
export function isLive(status: CampaignStatus): boolean {
  return status === "published" || status === "applications_open";
}

export function isFunded(status: CampaignStatus): boolean {
  return !isEditable(status) && status !== "cancelled";
}

/**
 * Cancelling is only supported before funding in this phase; cancelling a funded
 * campaign needs a refund flow, which does not exist yet.
 */
export function canCancel(status: CampaignStatus): boolean {
  return status === "draft" || status === "funding_required";
}

export function isCampaignStatus(value: unknown): value is CampaignStatus {
  return typeof value === "string" && (CAMPAIGN_STATUSES as readonly string[]).includes(value);
}
