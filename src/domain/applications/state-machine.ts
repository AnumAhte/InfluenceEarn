/**
 * Application lifecycle, mirrored from `public.application_transition_allowed`.
 * The database is authoritative; only the campaign owner can act, via
 * `decide_application`. Selection is final in this phase.
 */
export const APPLICATION_STATUSES = ["pending", "shortlisted", "selected", "rejected"] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const APPLICATION_ACTIONS = ["shortlist", "unshortlist", "select", "reject", "reconsider"] as const;
export type ApplicationAction = (typeof APPLICATION_ACTIONS)[number];

const ACTIONS_BY_STATUS: Record<ApplicationStatus, readonly ApplicationAction[]> = {
  pending: ["shortlist", "select", "reject"],
  shortlisted: ["unshortlist", "select", "reject"],
  selected: [],
  rejected: ["reconsider"],
};

const RESULT: Record<ApplicationAction, ApplicationStatus> = {
  shortlist: "shortlisted",
  unshortlist: "pending",
  select: "selected",
  reject: "rejected",
  reconsider: "pending",
};

export function availableActions(status: ApplicationStatus): readonly ApplicationAction[] {
  return ACTIONS_BY_STATUS[status];
}

export function nextApplicationStatus(status: ApplicationStatus, action: ApplicationAction): ApplicationStatus | null {
  return ACTIONS_BY_STATUS[status].includes(action) ? RESULT[action] : null;
}

export const ACTION_LABEL: Record<ApplicationAction, string> = {
  shortlist: "Shortlist",
  unshortlist: "Remove from shortlist",
  select: "Select",
  reject: "Reject",
  reconsider: "Undo rejection",
};

export function isApplicationStatus(value: unknown): value is ApplicationStatus {
  return typeof value === "string" && (APPLICATION_STATUSES as readonly string[]).includes(value);
}
