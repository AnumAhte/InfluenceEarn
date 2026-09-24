import { z } from "zod";

import { cents, parseDollarsToCents, type Cents } from "../money";
import { COUNTRY_CODES } from "../geo/countries";
import {
  CAMPAIGN_TYPES,
  CATEGORY_SLUGS,
  CREATOR_GENDERS,
  isTaskAllowedOnPlatform,
  SOCIAL_PLATFORMS,
  TASK_TYPES,
} from "./catalog";

export const MIN_PAYMENT_PER_CREATOR_CENTS = 100; // $1
export const MAX_PAYMENT_PER_CREATOR_CENTS = 100_000_000; // $1,000,000
export const MAX_CREATORS = 10_000;
export const MIN_DESCRIPTION_LENGTH = 40;

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const optionalText = (max: number) => z.string().trim().max(max, { error: `Keep this under ${max} characters` });

const hashtag = z
  .string()
  .trim()
  .transform((value) => value.replace(/^#/, ""))
  .pipe(z.string().regex(/^[\p{L}\p{N}_]{1,50}$/u, { error: "Hashtags can use letters, numbers and _ only" }))
  .transform((value) => `#${value}`);

const mention = z
  .string()
  .trim()
  .transform((value) => value.replace(/^@/, ""))
  .pipe(z.string().regex(/^[A-Za-z0-9._]{1,50}$/, { error: "Handles can use letters, numbers, . and _ only" }))
  .transform((value) => `@${value}`);

const httpsUrl = z
  .string()
  .trim()
  .max(2048)
  .refine((value) => value === "" || /^https:\/\/[^\s]+\.[^\s]+/i.test(value), {
    error: "Use a full https:// link",
  });

export const taskInputSchema = z
  .object({
    platform: z.enum(SOCIAL_PLATFORMS),
    taskType: z.enum(TASK_TYPES),
    quantity: z.number().int().min(1, { error: "At least 1" }).max(20, { error: "At most 20" }),
    customDescription: z.string().trim().max(500).optional(),
  })
  .superRefine((task, ctx) => {
    if (!isTaskAllowedOnPlatform(task.taskType, task.platform)) {
      ctx.addIssue({ code: "custom", path: ["taskType"], message: "This task isn't available on that platform" });
    }
    if (task.taskType === "custom" && (task.customDescription ?? "").length < 3) {
      ctx.addIssue({ code: "custom", path: ["customDescription"], message: "Describe the custom task" });
    }
  });

export const locationInputSchema = z.object({
  countryCode: z.enum(COUNTRY_CODES, { error: "Choose a country" }),
  region: optionalText(100).optional(),
  city: optionalText(100).optional(),
});

/** Everything the wizard edits. Draft-level validation: shapes only, title required. */
export const campaignDraftSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(3, { error: "Enter a campaign name — creators see this first" })
      .max(120, { error: "Keep the name under 120 characters" }),
    description: optionalText(5000),
    categorySlug: z.enum(CATEGORY_SLUGS).nullable(),
    campaignType: z.enum(CAMPAIGN_TYPES).nullable(),
    eligibility: z.object({
      minFollowers: z.number().int().min(0).max(1_000_000_000).nullable(),
      genders: z.array(z.enum(CREATOR_GENDERS)).max(3),
      ageMin: z.number().int().min(13, { error: "Minimum age is 13" }).max(100).nullable(),
      ageMax: z.number().int().min(13).max(100, { error: "Maximum age is 100" }).nullable(),
      creatorCategories: z.array(z.enum(CATEGORY_SLUGS)).max(CATEGORY_SLUGS.length),
      locations: z.array(locationInputSchema).max(20, { error: "Up to 20 locations" }),
    }),
    platforms: z.array(z.enum(SOCIAL_PLATFORMS)).max(SOCIAL_PLATFORMS.length),
    tasks: z.array(taskInputSchema).max(50),
    instructions: optionalText(5000),
    captionInstructions: optionalText(2000),
    hashtags: z.array(hashtag).max(30),
    mentions: z.array(mention).max(30),
    referenceUrl: httpsUrl,
    applicationDeadline: z.string().regex(DATE_ONLY).nullable(),
    taskDeadline: z.string().regex(DATE_ONLY).nullable(),
    /** Dollar amount as typed; converted to cents with string arithmetic. */
    paymentPerCreator: z.string().trim().max(20),
    creatorsRequired: z.number().int().nullable(),
  })
  .superRefine((draft, ctx) => {
    const { ageMin, ageMax } = draft.eligibility;
    if (ageMin !== null && ageMax !== null && ageMin > ageMax) {
      ctx.addIssue({ code: "custom", path: ["eligibility", "ageMax"], message: "Maximum age must be at least the minimum" });
    }
    for (const [index, task] of draft.tasks.entries()) {
      if (!draft.platforms.includes(task.platform)) {
        ctx.addIssue({ code: "custom", path: ["tasks", index, "platform"], message: "Select this platform first" });
      }
    }
    if (draft.applicationDeadline && draft.taskDeadline && draft.taskDeadline <= draft.applicationDeadline) {
      ctx.addIssue({
        code: "custom",
        path: ["taskDeadline"],
        message: "The task deadline has to fall after applications close",
      });
    }
    if (draft.paymentPerCreator !== "") {
      const amount = parseDollarsToCents(draft.paymentPerCreator);
      if (amount === null) {
        ctx.addIssue({ code: "custom", path: ["paymentPerCreator"], message: "Enter an amount like 10 or 10.50" });
      } else if (amount < MIN_PAYMENT_PER_CREATOR_CENTS || amount > MAX_PAYMENT_PER_CREATOR_CENTS) {
        ctx.addIssue({ code: "custom", path: ["paymentPerCreator"], message: "Payment per creator must be between $1 and $1,000,000" });
      }
    }
    if (draft.creatorsRequired !== null && (draft.creatorsRequired < 1 || draft.creatorsRequired > MAX_CREATORS)) {
      ctx.addIssue({ code: "custom", path: ["creatorsRequired"], message: `Between 1 and ${MAX_CREATORS.toLocaleString("en-US")} creators` });
    }
  });

export type CampaignDraftInput = z.input<typeof campaignDraftSchema>;
export type CampaignDraft = z.output<typeof campaignDraftSchema>;

export const WIZARD_STEPS = [
  { id: 1, label: "Campaign details", description: "Name the campaign, describe it, and set who can apply." },
  { id: 2, label: "Platforms & tasks", description: "Pick the platforms and spell out every deliverable." },
  { id: 3, label: "Instructions & dates", description: "Tell creators what to do, and by when." },
  { id: 4, label: "Budget & funding", description: "Set the payment per creator and fund to publish." },
] as const;
export type WizardStep = (typeof WIZARD_STEPS)[number]["id"];

export type StepIssue = { path: string; message: string };

/**
 * Completeness rules per step (beyond draft shape validation). Used to gate "Continue"
 * in the wizard and, for all steps, before a campaign may move to funding.
 */
export function stepIssues(step: WizardStep, draft: CampaignDraft, today: string): StepIssue[] {
  const issues: StepIssue[] = [];
  if (step === 1) {
    if (draft.description.length < MIN_DESCRIPTION_LENGTH) {
      issues.push({ path: "description", message: `Add a description of at least ${MIN_DESCRIPTION_LENGTH} characters` });
    }
    if (!draft.categorySlug) issues.push({ path: "categorySlug", message: "Pick one category" });
    if (!draft.campaignType) issues.push({ path: "campaignType", message: "Choose a campaign type" });
  }
  if (step === 2) {
    if (draft.platforms.length === 0) issues.push({ path: "platforms", message: "Select at least one platform" });
    if (draft.tasks.length === 0) issues.push({ path: "tasks", message: "Add at least one task" });
  }
  if (step === 3) {
    if (!draft.applicationDeadline) {
      issues.push({ path: "applicationDeadline", message: "Set when applications close" });
    } else if (draft.applicationDeadline <= today) {
      issues.push({ path: "applicationDeadline", message: "Applications must close after today" });
    }
    if (!draft.taskDeadline) issues.push({ path: "taskDeadline", message: "Set the task deadline" });
  }
  if (step === 4) {
    if (draft.paymentPerCreator === "") issues.push({ path: "paymentPerCreator", message: "Enter the payment per creator" });
    if (draft.creatorsRequired === null) issues.push({ path: "creatorsRequired", message: "Enter how many creators you need" });
  }
  return issues;
}

export function fundingReadinessIssues(draft: CampaignDraft, today: string): StepIssue[] {
  return WIZARD_STEPS.flatMap((step) => stepIssues(step.id, draft, today));
}

/** End of the chosen day in UTC — deadlines are stored as timestamps. */
export function dateToDeadline(date: string | null): string | null {
  return date ? `${date}T23:59:59Z` : null;
}

export function deadlineToDate(timestamp: string | null): string | null {
  return timestamp ? timestamp.slice(0, 10) : null;
}

export function paymentCents(draft: Pick<CampaignDraft, "paymentPerCreator">): Cents | null {
  return draft.paymentPerCreator === "" ? null : parseDollarsToCents(draft.paymentPerCreator);
}

/** Row/argument shape for `public.save_campaign_draft`. */
export function toSaveDraftArgs(draft: CampaignDraft) {
  const amount = paymentCents(draft);
  const { eligibility } = draft;
  const hasRequirements =
    eligibility.minFollowers !== null ||
    eligibility.genders.length > 0 ||
    eligibility.ageMin !== null ||
    eligibility.ageMax !== null;

  return {
    campaign: {
      title: draft.title,
      description: draft.description || null,
      category_slug: draft.categorySlug,
      campaign_type: draft.campaignType,
      instructions: draft.instructions || null,
      caption_instructions: draft.captionInstructions || null,
      hashtags: draft.hashtags,
      mentions: draft.mentions,
      reference_url: draft.referenceUrl || null,
      application_deadline: dateToDeadline(draft.applicationDeadline),
      task_deadline: dateToDeadline(draft.taskDeadline),
      payment_per_creator_cents: amount === null ? null : cents(amount),
      creators_required: draft.creatorsRequired,
    },
    platforms: [...new Set(draft.platforms)],
    tasks: draft.tasks.map((task) => ({
      platform: task.platform,
      task_type: task.taskType,
      quantity: task.quantity,
      custom_description: task.taskType === "custom" ? (task.customDescription ?? null) : null,
    })),
    requirements: hasRequirements
      ? {
          min_followers: eligibility.minFollowers,
          genders: [...new Set(eligibility.genders)],
          age_min: eligibility.ageMin,
          age_max: eligibility.ageMax,
        }
      : null,
    categories: [...new Set(eligibility.creatorCategories)],
    locations: eligibility.locations.map((location) => ({
      country_code: location.countryCode,
      region: location.region || null,
      city: location.city || null,
    })),
  };
}

export function emptyDraft(): CampaignDraftInput {
  return {
    title: "",
    description: "",
    categorySlug: null,
    campaignType: null,
    eligibility: { minFollowers: null, genders: [], ageMin: null, ageMax: null, creatorCategories: [], locations: [] },
    platforms: [],
    tasks: [],
    instructions: "",
    captionInstructions: "",
    hashtags: [],
    mentions: [],
    referenceUrl: "",
    applicationDeadline: null,
    taskDeadline: null,
    paymentPerCreator: "",
    creatorsRequired: null,
  };
}
