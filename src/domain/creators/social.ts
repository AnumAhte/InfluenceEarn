import { PLATFORM_META, type SocialPlatform } from "../campaigns/catalog";

/**
 * Handle rules per platform. Creators type a handle; the profile URL is always
 * derived from it (mirrors `public.social_profile_url`), so links shown to
 * advertisers only ever point at the platform's own domain.
 */
const HANDLE_RULES: Record<SocialPlatform, { pattern: RegExp; hint: string }> = {
  instagram: { pattern: /^[A-Za-z0-9._]{1,30}$/, hint: "Letters, numbers, . and _ (up to 30)" },
  tiktok: { pattern: /^[A-Za-z0-9._]{2,24}$/, hint: "Letters, numbers, . and _ (2–24)" },
  facebook: { pattern: /^[A-Za-z0-9.]{5,50}$/, hint: "Your page or profile username (5–50)" },
  youtube: { pattern: /^[A-Za-z0-9._-]{3,30}$/, hint: "Your @handle (3–30)" },
};

const HOSTS: Record<SocialPlatform, string[]> = {
  instagram: ["instagram.com"],
  tiktok: ["tiktok.com"],
  facebook: ["facebook.com", "fb.com"],
  youtube: ["youtube.com"],
};

export function handleHint(platform: SocialPlatform) {
  return HANDLE_RULES[platform].hint;
}

/**
 * Accepts "@name", "name" or a profile link on the platform's own domain and
 * returns the bare handle, or null if it isn't valid for that platform.
 */
export function normalizeHandle(platform: SocialPlatform, input: string): string | null {
  let value = input.trim();
  if (/^https?:\/\//i.test(value) || /^(www\.|m\.)?[a-z]+\.com\//i.test(value)) {
    try {
      const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
      const host = url.hostname.replace(/^(www|m)\./, "").toLowerCase();
      if (!HOSTS[platform].includes(host)) return null;
      value = url.pathname.split("/").filter(Boolean)[0] ?? "";
    } catch {
      return null;
    }
  }
  value = value.replace(/^@/, "");
  return HANDLE_RULES[platform].pattern.test(value) ? value : null;
}

export function profileUrl(platform: SocialPlatform, handle: string): string {
  switch (platform) {
    case "instagram":
      return `https://www.instagram.com/${handle}/`;
    case "tiktok":
      return `https://www.tiktok.com/@${handle}`;
    case "facebook":
      return `https://www.facebook.com/${handle}`;
    case "youtube":
      return `https://www.youtube.com/@${handle}`;
  }
}

export function displayHandle(platform: SocialPlatform, handle: string): string {
  return platform === "facebook" ? handle : `@${handle}`;
}

/** Compact follower count, e.g. 12500 → "12.5K". */
export function formatFollowers(count: number | null | undefined): string {
  if (count === null || count === undefined) return "Not provided";
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(count);
}

export function platformLabel(platform: SocialPlatform) {
  return PLATFORM_META[platform].label;
}
