import type { StatusTone } from "@/components/ui/status-badge";
import type { ApplicationStatus } from "@/domain/applications/state-machine";

export const APPLICATION_STATUS_META: Record<ApplicationStatus, { label: string; creatorLabel: string; tone: StatusTone }> = {
  pending: { label: "Pending", creatorLabel: "Pending review", tone: "neutral" },
  shortlisted: { label: "Shortlisted", creatorLabel: "In review", tone: "info" },
  selected: { label: "Selected", creatorLabel: "Selected", tone: "success" },
  rejected: { label: "Rejected", creatorLabel: "Not selected", tone: "danger" },
};
