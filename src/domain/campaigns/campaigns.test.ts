import { describe, expect, it } from "vitest";

import { cents, dollars } from "../money";
import { calculateCampaignFunding } from "../pricing";
import { isTaskAllowedOnPlatform, taskLabel, TASK_RULES, taskTypesForPlatform } from "./catalog";
import {
  campaignDraftSchema,
  emptyDraft,
  fundingReadinessIssues,
  stepIssues,
  toSaveDraftArgs,
  type CampaignDraftInput,
} from "./schemas";
import {
  assertTransition,
  CAMPAIGN_STATUSES,
  canCancel,
  canTransition,
  InvalidCampaignTransitionError,
  isEditable,
  isLive,
} from "./state-machine";

const TODAY = "2026-09-25";

function completeDraft(overrides: Partial<CampaignDraftInput> = {}): CampaignDraftInput {
  return {
    ...emptyDraft(),
    title: "Summer Collection Promotion",
    description: "Promote our summer drop with one Instagram Reel showing two outfits.",
    categorySlug: "fashion",
    campaignType: "product_launch",
    platforms: ["instagram"],
    tasks: [{ platform: "instagram", taskType: "instagram_reel", quantity: 1 }],
    applicationDeadline: "2026-10-05",
    taskDeadline: "2026-10-15",
    paymentPerCreator: "10",
    creatorsRequired: 100,
    ...overrides,
  };
}

describe("campaign state machine", () => {
  it("follows draft → funding_required → published → applications_open", () => {
    expect(canTransition("draft", "funding_required")).toBe(true);
    expect(canTransition("funding_required", "published")).toBe(true);
    expect(canTransition("published", "applications_open")).toBe(true);
  });

  it("rejects skipping funding or reviving finished campaigns", () => {
    expect(canTransition("draft", "published")).toBe(false);
    expect(canTransition("draft", "applications_open")).toBe(false);
    expect(canTransition("completed", "in_progress")).toBe(false);
    expect(canTransition("cancelled", "draft")).toBe(false);
    expect(() => assertTransition("draft", "published")).toThrow(InvalidCampaignTransitionError);
  });

  it("has no transitions out of terminal states", () => {
    for (const to of CAMPAIGN_STATUSES) {
      expect(canTransition("completed", to)).toBe(false);
      expect(canTransition("cancelled", to)).toBe(false);
    }
  });

  it("only allows editing and cancelling before funding", () => {
    expect(isEditable("draft")).toBe(true);
    expect(isEditable("funding_required")).toBe(true);
    expect(isEditable("applications_open")).toBe(false);
    expect(canCancel("funding_required")).toBe(true);
    expect(canCancel("applications_open")).toBe(false);
  });

  it("treats only published / applications_open as live", () => {
    expect(isLive("draft")).toBe(false);
    expect(isLive("funding_required")).toBe(false);
    expect(isLive("applications_open")).toBe(true);
  });
});

describe("task catalog", () => {
  it("limits platform-specific tasks to their platform", () => {
    expect(isTaskAllowedOnPlatform("instagram_reel", "instagram")).toBe(true);
    expect(isTaskAllowedOnPlatform("instagram_reel", "tiktok")).toBe(false);
    expect(taskTypesForPlatform("tiktok")).toContain("tiktok_video");
    expect(taskTypesForPlatform("tiktok")).not.toContain("youtube_short");
    expect(taskTypesForPlatform("youtube")).toEqual(expect.arrayContaining(["youtube_video", "youtube_short", "comment"]));
  });

  it("never requires screenshots and encodes the proof rules", () => {
    expect(TASK_RULES.instagram_reel.proofUrl).toBe("required");
    expect(TASK_RULES.comment).toMatchObject({ proofUrl: "required", requiresCommentText: true });
    expect(TASK_RULES.share_post.proofUrl).toBe("optional");
    expect(TASK_RULES.follow.proofUrl).toBe("none");
  });

  it("builds readable labels", () => {
    expect(taskLabel("instagram_reel", "instagram")).toBe("Instagram Reel");
    expect(taskLabel("comment", "tiktok")).toBe("TikTok comment");
    expect(taskLabel("ugc", "youtube")).toBe("YouTube UGC");
  });
});

describe("campaign draft schema", () => {
  it("accepts a minimal draft with only a title", () => {
    const result = campaignDraftSchema.safeParse({ ...emptyDraft(), title: "Winter launch" });
    expect(result.success).toBe(true);
  });

  it("requires a title of at least 3 characters", () => {
    expect(campaignDraftSchema.safeParse({ ...emptyDraft(), title: "ab" }).success).toBe(false);
  });

  it("rejects tasks on platforms that were not selected, or not supported by the task", () => {
    const unselected = campaignDraftSchema.safeParse(
      completeDraft({ platforms: ["tiktok"], tasks: [{ platform: "instagram", taskType: "comment", quantity: 1 }] }),
    );
    const wrongPlatform = campaignDraftSchema.safeParse(
      completeDraft({ platforms: ["tiktok"], tasks: [{ platform: "tiktok", taskType: "instagram_reel", quantity: 1 }] }),
    );
    expect(unselected.success).toBe(false);
    expect(wrongPlatform.success).toBe(false);
  });

  it("requires a description for custom tasks", () => {
    const result = campaignDraftSchema.safeParse(
      completeDraft({ tasks: [{ platform: "instagram", taskType: "custom", quantity: 1 }] }),
    );
    expect(result.success).toBe(false);
  });

  it("orders deadlines", () => {
    const result = campaignDraftSchema.safeParse(completeDraft({ applicationDeadline: "2026-10-15", taskDeadline: "2026-10-15" }));
    expect(result.success).toBe(false);
  });

  it("validates budget amounts without floating point", () => {
    expect(campaignDraftSchema.safeParse(completeDraft({ paymentPerCreator: "0" })).success).toBe(false);
    expect(campaignDraftSchema.safeParse(completeDraft({ paymentPerCreator: "-5" })).success).toBe(false);
    expect(campaignDraftSchema.safeParse(completeDraft({ paymentPerCreator: "10.555" })).success).toBe(false);
    expect(campaignDraftSchema.safeParse(completeDraft({ creatorsRequired: 0 })).success).toBe(false);
    expect(campaignDraftSchema.safeParse(completeDraft({ paymentPerCreator: "0.10" })).success).toBe(false);
  });

  it("normalises hashtags and mentions", () => {
    const result = campaignDraftSchema.parse(completeDraft({ hashtags: ["SummerDrop", "#Brand_2026"], mentions: ["brandhouse", "@brand.house"] }));
    expect(result.hashtags).toEqual(["#SummerDrop", "#Brand_2026"]);
    expect(result.mentions).toEqual(["@brandhouse", "@brand.house"]);
    expect(campaignDraftSchema.safeParse(completeDraft({ hashtags: ["bad tag"] })).success).toBe(false);
  });

  it("requires https reference links", () => {
    expect(campaignDraftSchema.safeParse(completeDraft({ referenceUrl: "http://example.com" })).success).toBe(false);
    expect(campaignDraftSchema.safeParse(completeDraft({ referenceUrl: "https://example.com/brief" })).success).toBe(true);
  });
});

describe("eligibility validation", () => {
  const withEligibility = (eligibility: Partial<CampaignDraftInput["eligibility"]>) =>
    completeDraft({ eligibility: { ...emptyDraft().eligibility, ...eligibility } });

  it("keeps every eligibility field optional", () => {
    const parsed = campaignDraftSchema.parse(completeDraft());
    expect(toSaveDraftArgs(parsed).requirements).toBeNull();
    expect(toSaveDraftArgs(parsed).locations).toEqual([]);
  });

  it("validates age range and bounds", () => {
    expect(campaignDraftSchema.safeParse(withEligibility({ ageMin: 30, ageMax: 18 })).success).toBe(false);
    expect(campaignDraftSchema.safeParse(withEligibility({ ageMin: 12 })).success).toBe(false);
    expect(campaignDraftSchema.safeParse(withEligibility({ ageMin: 18, ageMax: 30 })).success).toBe(true);
  });

  it("accepts ISO country codes with optional region and city", () => {
    const ok = withEligibility({ locations: [{ countryCode: "PK", city: "Lahore" }, { countryCode: "GB" }] });
    expect(campaignDraftSchema.safeParse(ok).success).toBe(true);
    const bad = withEligibility({ locations: [{ countryCode: "XX" as "GB" }] });
    expect(campaignDraftSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects negative follower minimums and unknown genders", () => {
    expect(campaignDraftSchema.safeParse(withEligibility({ minFollowers: -1 })).success).toBe(false);
    expect(campaignDraftSchema.safeParse(withEligibility({ genders: ["other" as "female"] })).success).toBe(false);
  });
});

describe("step completeness", () => {
  it("reports what each step still needs", () => {
    const draft = campaignDraftSchema.parse({ ...emptyDraft(), title: "Winter launch" });
    expect(stepIssues(1, draft, TODAY).map((i) => i.path)).toEqual(["description", "categorySlug", "campaignType"]);
    expect(stepIssues(2, draft, TODAY).map((i) => i.path)).toEqual(["platforms", "tasks"]);
    expect(stepIssues(4, draft, TODAY).map((i) => i.path)).toEqual(["paymentPerCreator", "creatorsRequired"]);
  });

  it("requires the application deadline to be in the future", () => {
    const draft = campaignDraftSchema.parse(completeDraft({ applicationDeadline: TODAY, taskDeadline: "2026-10-01" }));
    expect(stepIssues(3, draft, TODAY).map((i) => i.path)).toEqual(["applicationDeadline"]);
  });

  it("passes a complete campaign", () => {
    expect(fundingReadinessIssues(campaignDraftSchema.parse(completeDraft()), TODAY)).toEqual([]);
  });

  it("converts the budget to integer cents for storage", () => {
    const args = toSaveDraftArgs(campaignDraftSchema.parse(completeDraft({ paymentPerCreator: "12.50" })));
    expect(args.campaign.payment_per_creator_cents).toBe(1250);
    expect(args.campaign.application_deadline).toBe("2026-10-05T23:59:59Z");
  });
});

describe("campaign fee calculation", () => {
  it("computes 20% on the creator budget", () => {
    expect(calculateCampaignFunding(dollars(10), 100)).toEqual({ creatorBudget: 100_000, platformFee: 20_000, totalFunding: 120_000 });
    expect(calculateCampaignFunding(cents(1250), 3)).toEqual({ creatorBudget: 3_750, platformFee: 750, totalFunding: 4_500 });
  });
});
