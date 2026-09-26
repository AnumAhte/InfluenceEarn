/**
 * Campaign reference data. Enum values mirror the Postgres enums; proof rules mirror
 * `public.campaign_task_type_rules`. Keep both in sync when adding values.
 */
export const SOCIAL_PLATFORMS = ["instagram", "tiktok", "facebook", "youtube"] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

export const PLATFORM_META: Record<SocialPlatform, { label: string; code: string; reach: string }> = {
  instagram: { label: "Instagram", code: "IG", reach: "Posts, reels, stories" },
  tiktok: { label: "TikTok", code: "TT", reach: "Short video" },
  facebook: { label: "Facebook", code: "FB", reach: "Posts, shares" },
  youtube: { label: "YouTube", code: "YT", reach: "Videos & Shorts" },
};

export const CAMPAIGN_TYPES = ["product_launch", "product_review", "brand_awareness", "event_promotion"] as const;
export type CampaignType = (typeof CAMPAIGN_TYPES)[number];

export const CAMPAIGN_TYPE_META: Record<CampaignType, { label: string; hint: string }> = {
  product_launch: { label: "Product launch", hint: "Announce something new to a wide audience." },
  product_review: { label: "Product review", hint: "Creators try the product and give a verdict." },
  brand_awareness: { label: "Brand awareness", hint: "Keep the brand visible with regular content." },
  event_promotion: { label: "Event promotion", hint: "Drive attendance to a date and place." },
};

/** Seeded in `public.creator_categories`. */
export const CATEGORIES = [
  { slug: "fashion", label: "Fashion" },
  { slug: "beauty", label: "Beauty" },
  { slug: "food", label: "Food" },
  { slug: "tech", label: "Tech" },
  { slug: "fitness", label: "Fitness" },
  { slug: "travel", label: "Travel" },
  { slug: "lifestyle", label: "Lifestyle" },
  { slug: "gaming", label: "Gaming" },
  { slug: "other", label: "Other" },
] as const;
export type CategorySlug = (typeof CATEGORIES)[number]["slug"];
export const CATEGORY_SLUGS = CATEGORIES.map((c) => c.slug) as [CategorySlug, ...CategorySlug[]];

export function categoryLabel(slug: string | null | undefined): string {
  return CATEGORIES.find((c) => c.slug === slug)?.label ?? "No category";
}

export const CREATOR_GENDERS = ["female", "male", "non_binary"] as const;
export type CreatorGender = (typeof CREATOR_GENDERS)[number];
export const GENDER_LABELS: Record<CreatorGender, string> = {
  female: "Female",
  male: "Male",
  non_binary: "Non-binary",
};

export const TASK_TYPES = [
  "instagram_feed_post",
  "instagram_reel",
  "instagram_story",
  "tiktok_video",
  "youtube_video",
  "youtube_short",
  "facebook_post",
  "facebook_share",
  "comment",
  "like",
  "share_post",
  "follow",
  "product_review",
  "ugc",
  "custom",
] as const;
export type TaskType = (typeof TASK_TYPES)[number];

export type ProofUrlRequirement = "required" | "optional" | "none";

type TaskRule = {
  label: string;
  /** Null: usable on any selected platform. */
  platform: SocialPlatform | null;
  proofUrl: ProofUrlRequirement;
  requiresCommentText: boolean;
  /** What the creator will be asked to paste. */
  proofLabel: string;
};

export const TASK_RULES: Record<TaskType, TaskRule> = {
  instagram_feed_post: { label: "Instagram feed post", platform: "instagram", proofUrl: "required", requiresCommentText: false, proofLabel: "Post URL" },
  instagram_reel: { label: "Instagram Reel", platform: "instagram", proofUrl: "required", requiresCommentText: false, proofLabel: "Reel URL" },
  instagram_story: { label: "Instagram Story", platform: "instagram", proofUrl: "optional", requiresCommentText: false, proofLabel: "Story link, if available" },
  tiktok_video: { label: "TikTok video", platform: "tiktok", proofUrl: "required", requiresCommentText: false, proofLabel: "Video URL" },
  youtube_video: { label: "YouTube video", platform: "youtube", proofUrl: "required", requiresCommentText: false, proofLabel: "Video URL" },
  youtube_short: { label: "YouTube Short", platform: "youtube", proofUrl: "required", requiresCommentText: false, proofLabel: "Short URL" },
  facebook_post: { label: "Facebook post", platform: "facebook", proofUrl: "required", requiresCommentText: false, proofLabel: "Post URL" },
  facebook_share: { label: "Facebook share", platform: "facebook", proofUrl: "optional", requiresCommentText: false, proofLabel: "Shared post URL, if available" },
  comment: { label: "Comment", platform: null, proofUrl: "required", requiresCommentText: true, proofLabel: "Post URL + comment text" },
  like: { label: "Like", platform: null, proofUrl: "optional", requiresCommentText: false, proofLabel: "Post URL, if available" },
  share_post: { label: "Share post", platform: null, proofUrl: "optional", requiresCommentText: false, proofLabel: "Shared URL, if available" },
  follow: { label: "Follow", platform: null, proofUrl: "none", requiresCommentText: false, proofLabel: "No link needed" },
  product_review: { label: "Product review", platform: null, proofUrl: "required", requiresCommentText: false, proofLabel: "Review URL" },
  ugc: { label: "UGC", platform: null, proofUrl: "required", requiresCommentText: false, proofLabel: "Content URL" },
  custom: { label: "Custom task", platform: null, proofUrl: "optional", requiresCommentText: false, proofLabel: "Link, if applicable" },
};

export function taskTypesForPlatform(platform: SocialPlatform): TaskType[] {
  return TASK_TYPES.filter((type) => {
    const rulePlatform = TASK_RULES[type].platform;
    return rulePlatform === null || rulePlatform === platform;
  });
}

export function isTaskAllowedOnPlatform(type: TaskType, platform: SocialPlatform): boolean {
  const rulePlatform = TASK_RULES[type].platform;
  return rulePlatform === null || rulePlatform === platform;
}

export function taskLabel(type: TaskType, platform: SocialPlatform): string {
  const rule = TASK_RULES[type];
  // Platform-specific labels already carry the platform name where needed.
  if (rule.platform) return rule.label;
  const suffix = rule.label === rule.label.toUpperCase() ? rule.label : rule.label.toLowerCase();
  return `${PLATFORM_META[platform].label} ${suffix}`;
}
