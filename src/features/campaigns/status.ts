import type { StatusTone } from "@/components/ui/status-badge";
import type { CampaignStatus } from "@/domain/campaigns/state-machine";

export const CAMPAIGN_STATUS_META: Record<CampaignStatus, { label: string; tone: StatusTone }> = {
  draft: { label: "Draft", tone: "neutral" },
  funding_required: { label: "Funding required", tone: "warning" },
  published: { label: "Published", tone: "info" },
  applications_open: { label: "Applications open", tone: "success" },
  selection_in_progress: { label: "Selecting creators", tone: "info" },
  in_progress: { label: "In progress", tone: "dark" },
  review_pending: { label: "Review pending", tone: "warning" },
  completed: { label: "Completed", tone: "outline" },
  cancelled: { label: "Cancelled", tone: "danger" },
};

/** List tabs → statuses they include. */
export const CAMPAIGN_TABS = [
  { id: "all", label: "All", statuses: null },
  { id: "draft", label: "Draft", statuses: ["draft"] },
  { id: "funding_required", label: "Funding required", statuses: ["funding_required"] },
  { id: "published", label: "Published", statuses: ["published"] },
  { id: "applications_open", label: "Applications open", statuses: ["applications_open"] },
  { id: "in_progress", label: "In progress", statuses: ["selection_in_progress", "in_progress", "review_pending"] },
  { id: "completed", label: "Completed", statuses: ["completed"] },
  { id: "cancelled", label: "Cancelled", statuses: ["cancelled"] },
] as const satisfies readonly { id: string; label: string; statuses: readonly CampaignStatus[] | null }[];

export type CampaignTabId = (typeof CAMPAIGN_TABS)[number]["id"];
