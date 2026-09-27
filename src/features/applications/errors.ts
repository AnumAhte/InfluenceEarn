import { parseIssueStrings, type EligibilityIssue } from "@/domain/creators/eligibility";

export type ApplicationFailure =
  | { code: "not_eligible"; issues: EligibilityIssue[]; message: string }
  | {
      code:
        | "already_applied"
        | "own_campaign"
        | "applications_closed"
        | "campaign_not_found"
        | "application_not_found"
        | "selection_full"
        | "selection_closed"
        | "invalid_transition"
        | "unknown";
      message: string;
    };

/** Maps errors raised by apply_to_campaign / decide_application to user copy. */
export function describeApplicationError(error: { message?: string; details?: string | null; code?: string }): ApplicationFailure {
  const message = error.message ?? "";
  if (message.startsWith("not_eligible")) {
    let issues: EligibilityIssue[] = [];
    try {
      const parsed: unknown = error.details ? JSON.parse(error.details) : [];
      if (Array.isArray(parsed)) {
        issues = parseIssueStrings(
          parsed.map((item: { code?: string; platform?: string | null }) => (item.platform ? `${item.code}:${item.platform}` : String(item.code))),
        );
      }
    } catch {
      // keep empty
    }
    return { code: "not_eligible", issues, message: "You don't meet this campaign's requirements yet." };
  }
  if (message.startsWith("already_applied")) return { code: "already_applied", message: "You've already applied to this campaign." };
  if (message.startsWith("own_campaign")) return { code: "own_campaign", message: "You can't apply to your own campaign." };
  if (message.startsWith("applications_closed")) return { code: "applications_closed", message: "Applications for this campaign are closed." };
  if (message.startsWith("campaign_not_found")) return { code: "campaign_not_found", message: "This campaign is no longer open." };
  if (message.startsWith("application_not_found")) return { code: "application_not_found", message: "Application not found." };
  if (message.startsWith("selection_full")) {
    return { code: "selection_full", message: "You've already selected every creator this campaign needs." };
  }
  if (message.startsWith("selection_closed")) {
    return { code: "selection_closed", message: "Selection isn't open for this campaign anymore." };
  }
  if (message.startsWith("invalid_application_transition") || message.startsWith("invalid_action")) {
    return { code: "invalid_transition", message: "That change isn't possible for this application." };
  }
  return { code: "unknown", message: "Something went wrong. Please try again." };
}
