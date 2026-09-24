import { z } from "zod";

import { WORKSPACES } from "./workspace";

export const workspaceSchema = z.enum(WORKSPACES);

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, { error: `${label} must be ${max} characters or fewer` })
    .transform((value) => (value === "" ? null : value));

export const PHONE_PATTERN = /^\+?[0-9][0-9 ()-]{5,23}$/;

export const profileSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, { error: "Enter your full name" })
    .max(120, { error: "Name must be 120 characters or fewer" }),
  phone: z
    .string()
    .trim()
    .refine((value) => value === "" || PHONE_PATTERN.test(value), {
      error: "Enter a valid phone number, e.g. +1 555 010 0000",
    })
    .transform((value) => (value === "" ? null : value)),
  city: optionalText(80, "City"),
  bio: optionalText(160, "Bio"),
});

export type ProfileFormInput = z.input<typeof profileSchema>;
export type ProfileValues = z.output<typeof profileSchema>;

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_MIME_TYPES = ["image/jpeg", "image/png"] as const;

export type AvatarCheck = { ok: true; extension: "jpg" | "png" } | { ok: false; error: string };

export function validateAvatarFile(file: { size: number; type: string }): AvatarCheck {
  if (file.size === 0) return { ok: false, error: "The selected file is empty" };
  if (file.size > AVATAR_MAX_BYTES) return { ok: false, error: "Photo must be 2 MB or smaller" };
  if (file.type === "image/jpeg") return { ok: true, extension: "jpg" };
  if (file.type === "image/png") return { ok: true, extension: "png" };
  return { ok: false, error: "Photo must be a JPG or PNG image" };
}
