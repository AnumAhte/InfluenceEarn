import { PLATFORM_META, SOCIAL_PLATFORMS, type SocialPlatform } from "../campaigns/catalog";

/**
 * Eligibility is decided in Postgres (`_campaign_eligibility_issues`), which both
 * enforces it on apply and reports it for display. This module only turns the
 * reported issue codes into copy and actions for the UI.
 */
export const ELIGIBILITY_CODES = [
  "missing_platform",
  "followers_below_minimum",
  "gender_not_set",
  "gender_mismatch",
  "age_not_set",
  "age_out_of_range",
  "category_not_set",
  "category_mismatch",
  "location_not_set",
  "location_mismatch",
] as const;

export type EligibilityCode = (typeof ELIGIBILITY_CODES)[number];

export type EligibilityIssue = { code: EligibilityCode; platform: SocialPlatform | null };

export type IssueFix =
  | { kind: "connect_platform"; platform: SocialPlatform }
  | { kind: "update_platform"; platform: SocialPlatform }
  | { kind: "creator_details" }
  | { kind: "none" };

function isCode(value: string): value is EligibilityCode {
  return (ELIGIBILITY_CODES as readonly string[]).includes(value);
}

function isPlatform(value: string | null | undefined): value is SocialPlatform {
  return typeof value === "string" && (SOCIAL_PLATFORMS as readonly string[]).includes(value);
}

/** Parses "missing_platform:instagram" style strings (from discovery). Unknown codes are dropped. */
export function parseIssueStrings(values: readonly string[] | null | undefined): EligibilityIssue[] {
  const issues: EligibilityIssue[] = [];
  for (const value of values ?? []) {
    const [code, platform] = value.split(":");
    if (code && isCode(code)) issues.push({ code, platform: isPlatform(platform) ? platform : null });
  }
  return issues;
}

/** Normalises rows returned by `my_campaign_eligibility`. */
export function toIssues(rows: readonly { code: string; platform: string | null }[] | null | undefined): EligibilityIssue[] {
  return parseIssueStrings((rows ?? []).map((row) => (row.platform ? `${row.code}:${row.platform}` : row.code)));
}

export function issueMessage(issue: EligibilityIssue, minFollowers?: number | null): string {
  const platform = issue.platform ? PLATFORM_META[issue.platform].label : "";
  switch (issue.code) {
    case "missing_platform":
      return `${platform} account required`;
    case "followers_below_minimum":
      return minFollowers
        ? `${platform} needs at least ${minFollowers.toLocaleString("en-US")} followers`
        : `${platform} follower count is below the minimum`;
    case "gender_not_set":
      return "Add your gender in creator details";
    case "gender_mismatch":
      return "This campaign is for a different gender";
    case "age_not_set":
      return "Add your date of birth in creator details";
    case "age_out_of_range":
      return "Outside the campaign's age range";
    case "category_not_set":
      return "Add your creator categories";
    case "category_mismatch":
      return "Your categories don't match this campaign";
    case "location_not_set":
      return "Add your country in creator details";
    case "location_mismatch":
      return "This campaign is for creators in another location";
  }
}

/** What the creator can do about an issue, if anything. */
export function issueFix(issue: EligibilityIssue): IssueFix {
  switch (issue.code) {
    case "missing_platform":
      return issue.platform ? { kind: "connect_platform", platform: issue.platform } : { kind: "none" };
    case "followers_below_minimum":
      return issue.platform ? { kind: "update_platform", platform: issue.platform } : { kind: "none" };
    case "gender_not_set":
    case "age_not_set":
    case "category_not_set":
    case "location_not_set":
      return { kind: "creator_details" };
    default:
      return { kind: "none" };
  }
}

/** The headline shown on a campaign card: the platform gate first, as in the design. */
export function primaryIssue(issues: readonly EligibilityIssue[]): EligibilityIssue | null {
  return issues.find((i) => i.code === "missing_platform") ?? issues[0] ?? null;
}
