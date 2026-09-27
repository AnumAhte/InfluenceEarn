/**
 * Work assignment lifecycle (one per selected creator). Mirrors the database:
 * in_progress → submitted → approved | revision_requested → submitted … | rejected;
 * unfinished past-deadline work becomes expired when the campaign completes.
 * payout_pending / paid are reserved for the payout phase.
 */
export const ASSIGNMENT_STATUSES = [
  "in_progress",
  "submitted",
  "revision_requested",
  "approved",
  "rejected",
  "expired",
  "payout_pending",
  "paid",
] as const;

export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];

/** Statuses where the creator still has something to do or is waiting. */
export const ACTIVE_ASSIGNMENT_STATUSES = ["in_progress", "submitted", "revision_requested"] as const satisfies readonly AssignmentStatus[];

export function isActiveAssignment(status: AssignmentStatus): boolean {
  return (ACTIVE_ASSIGNMENT_STATUSES as readonly string[]).includes(status);
}

export type SubmissionGate =
  | { canSubmit: true }
  | { canSubmit: false; reason: "waiting_for_review" | "finished" | "deadline_passed" | "attempts_exhausted" };

/** Whether the creator may submit now (the database re-checks all of this). */
export function submissionGate(
  assignment: { status: AssignmentStatus; dueAt: string; attemptCount: number; maxAttempts: number },
  now: Date,
): SubmissionGate {
  if (assignment.status === "submitted") return { canSubmit: false, reason: "waiting_for_review" };
  if (assignment.status !== "in_progress" && assignment.status !== "revision_requested") {
    return { canSubmit: false, reason: "finished" };
  }
  if (now > new Date(assignment.dueAt)) return { canSubmit: false, reason: "deadline_passed" };
  if (assignment.attemptCount >= assignment.maxAttempts) return { canSubmit: false, reason: "attempts_exhausted" };
  return { canSubmit: true };
}

export function isAssignmentStatus(value: unknown): value is AssignmentStatus {
  return typeof value === "string" && (ASSIGNMENT_STATUSES as readonly string[]).includes(value);
}

/** True once the deadline instant has passed. */
export function isPastDue(dueAt: string, now: Date = new Date()): boolean {
  return now.getTime() > new Date(dueAt).getTime();
}
