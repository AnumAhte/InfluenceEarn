/**
 * Maps errors raised by the campaign/wallet SQL functions to user-facing copy.
 * The database raises stable machine codes in the message (e.g. `insufficient_funds`).
 */
export type DbErrorLike = { message?: string; details?: string | null; code?: string };

export type FundingFailure =
  | { code: "insufficient_funds"; requiredCents: number | null; availableCents: number | null; message: string }
  | { code: "campaign_incomplete"; field: string; message: string }
  | { code: "invalid_campaign_state" | "campaign_not_found" | "cancel_requires_refund_flow" | "campaign_locked" | "test_funds_disabled" | "unknown"; message: string };

const INCOMPLETE_COPY: Record<string, string> = {
  description: "Add a description of at least 40 characters.",
  category_or_type: "Choose a category and campaign type.",
  platforms: "Select at least one platform.",
  tasks: "Add at least one task.",
  dates: "Set both the application and task deadlines.",
  application_deadline_passed: "The application deadline has passed. Choose a later date.",
  budget: "Set the payment per creator and the number of creators.",
};

function parseAmounts(details: string | null | undefined) {
  try {
    const parsed: unknown = details ? JSON.parse(details) : null;
    if (parsed && typeof parsed === "object") {
      const record = parsed as Record<string, unknown>;
      const required = typeof record.required_cents === "number" ? record.required_cents : null;
      const available = typeof record.available_cents === "number" ? record.available_cents : null;
      return { required, available };
    }
  } catch {
    // fall through
  }
  return { required: null, available: null };
}

export function describeDbError(error: DbErrorLike): FundingFailure {
  const message = error.message ?? "";

  if (message.startsWith("insufficient_funds")) {
    const { required, available } = parseAmounts(error.details);
    return {
      code: "insufficient_funds",
      requiredCents: required,
      availableCents: available,
      message: "Your wallet balance is too low to fund this campaign.",
    };
  }
  if (message.startsWith("campaign_incomplete")) {
    const field = message.split(":")[1]?.trim() ?? "";
    return { code: "campaign_incomplete", field, message: INCOMPLETE_COPY[field] ?? "Complete every step before funding." };
  }
  if (message.startsWith("invalid_campaign_state") || message.startsWith("invalid_campaign_transition")) {
    return { code: "invalid_campaign_state", message: "This campaign can't do that in its current state. Refresh and try again." };
  }
  if (message.startsWith("campaign_not_found") || error.code === "P0002") {
    return { code: "campaign_not_found", message: "Campaign not found." };
  }
  if (message.startsWith("cancel_requires_refund_flow")) {
    return {
      code: "cancel_requires_refund_flow",
      message: "Funded campaigns can't be cancelled yet — refunds aren't available in this version.",
    };
  }
  if (message.startsWith("campaign_locked") || message.startsWith("campaign_not_editable")) {
    return { code: "campaign_locked", message: "This campaign is funded, so its details and budget are locked." };
  }
  if (message.startsWith("test_funds_disabled")) {
    return { code: "test_funds_disabled", message: "Test funds are disabled in this environment." };
  }
  return { code: "unknown", message: "Something went wrong. Please try again." };
}
