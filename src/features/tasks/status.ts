import type { StatusTone } from "@/components/ui/status-badge";
import type { AssignmentStatus } from "@/domain/tasks/assignment";

export const ASSIGNMENT_STATUS_META: Record<AssignmentStatus, { label: string; creatorLabel: string; tone: StatusTone }> = {
  in_progress: { label: "In progress", creatorLabel: "To do", tone: "info" },
  submitted: { label: "Awaiting review", creatorLabel: "Waiting for review", tone: "warning" },
  revision_requested: { label: "Changes requested", creatorLabel: "Changes requested", tone: "danger" },
  approved: { label: "Approved · ready for payout", creatorLabel: "Approved", tone: "success" },
  rejected: { label: "Rejected", creatorLabel: "Rejected", tone: "danger" },
  expired: { label: "Expired", creatorLabel: "Deadline missed", tone: "neutral" },
  payout_pending: { label: "Payout processing", creatorLabel: "Payment processing", tone: "info" },
  paid: { label: "Paid", creatorLabel: "Paid", tone: "success" },
};
