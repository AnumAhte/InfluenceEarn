import { z } from "zod";

import { CATEGORY_SLUGS, CREATOR_GENDERS, SOCIAL_PLATFORMS } from "../campaigns/catalog";
import { COUNTRY_CODES } from "../geo/countries";
import { normalizeHandle } from "./social";

export const MIN_CREATOR_AGE = 13;

/** Latest date of birth allowed on `today` (YYYY-MM-DD). */
export function latestAllowedBirthDate(today: string): string {
  const [year, month, day] = today.split("-").map(Number) as [number, number, number];
  return `${String(year - MIN_CREATOR_AGE).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function creatorProfileSchema(today: string) {
  return z.object({
    countryCode: z.enum(COUNTRY_CODES, { error: "Choose your country" }).nullable(),
    dateOfBirth: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Enter a valid date" })
      .refine((value) => value >= "1900-01-01", { error: "Enter a valid date" })
      .refine((value) => value <= latestAllowedBirthDate(today), { error: `You must be at least ${MIN_CREATOR_AGE}` })
      .nullable(),
    gender: z.enum(CREATOR_GENDERS).nullable(),
    categories: z.array(z.enum(CATEGORY_SLUGS)).max(CATEGORY_SLUGS.length),
  });
}

export type CreatorProfileValues = z.output<ReturnType<typeof creatorProfileSchema>>;

export const MAX_FOLLOWERS = 2_000_000_000;

export const socialAccountSchema = z
  .object({
    platform: z.enum(SOCIAL_PLATFORMS),
    handle: z.string().trim().min(1, { error: "Enter your handle" }).max(200),
    followerCount: z
      .string()
      .trim()
      .transform((value) => value.replace(/[,\s]/g, ""))
      .pipe(
        z
          .string()
          .regex(/^\d{1,10}$/, { error: "Enter your follower count as a whole number" })
          .transform(Number)
          .refine((n) => n <= MAX_FOLLOWERS, { error: "That number is too large" }),
      ),
  })
  .transform((value, ctx) => {
    const handle = normalizeHandle(value.platform, value.handle);
    if (!handle) {
      ctx.addIssue({ code: "custom", path: ["handle"], message: "That doesn't look like a valid handle for this platform" });
      return z.NEVER;
    }
    return { ...value, handle };
  });

export type SocialAccountValues = z.output<typeof socialAccountSchema>;
