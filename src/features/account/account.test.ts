import { describe, expect, it } from "vitest";

import { firstNameOf, initialsFor, nextOnboardingPath } from "./onboarding";
import { profileSchema, validateAvatarFile, workspaceSchema } from "./schemas";
import { isWorkspace } from "./workspace";

describe("workspace", () => {
  it("accepts only advertiser and influencer", () => {
    expect(workspaceSchema.safeParse("advertiser").success).toBe(true);
    expect(workspaceSchema.safeParse("influencer").success).toBe(true);
    // Admin is a platform role, never a switchable workspace.
    expect(workspaceSchema.safeParse("admin").success).toBe(false);
    expect(isWorkspace("admin")).toBe(false);
  });
});

describe("nextOnboardingPath", () => {
  const now = "2026-09-24T10:00:00Z";
  it("walks role → profile → done", () => {
    expect(nextOnboardingPath({ workspace_chosen_at: null, onboarding_completed_at: null })).toBe("/onboarding/role");
    expect(nextOnboardingPath({ workspace_chosen_at: now, onboarding_completed_at: null })).toBe("/onboarding/profile");
    expect(nextOnboardingPath({ workspace_chosen_at: now, onboarding_completed_at: now })).toBeNull();
  });
});

describe("profileSchema", () => {
  it("turns empty optional fields into null", () => {
    expect(profileSchema.parse({ fullName: "Ana Rivera", phone: "", city: "  ", bio: "" })).toEqual({
      fullName: "Ana Rivera",
      phone: null,
      city: null,
      bio: null,
    });
  });

  it("validates phone numbers and bio length", () => {
    expect(profileSchema.safeParse({ fullName: "Ana", phone: "+1 (555) 010-0000", city: "", bio: "" }).success).toBe(true);
    expect(profileSchema.safeParse({ fullName: "Ana", phone: "call me", city: "", bio: "" }).success).toBe(false);
    expect(profileSchema.safeParse({ fullName: "Ana", phone: "", city: "", bio: "x".repeat(161) }).success).toBe(false);
  });
});

describe("validateAvatarFile", () => {
  it("accepts JPG/PNG up to 2 MB", () => {
    expect(validateAvatarFile({ size: 1024, type: "image/png" })).toEqual({ ok: true, extension: "png" });
    expect(validateAvatarFile({ size: 2 * 1024 * 1024, type: "image/jpeg" })).toEqual({ ok: true, extension: "jpg" });
  });

  it("rejects other types, empty and oversized files", () => {
    expect(validateAvatarFile({ size: 1024, type: "image/gif" }).ok).toBe(false);
    expect(validateAvatarFile({ size: 1024, type: "image/svg+xml" }).ok).toBe(false);
    expect(validateAvatarFile({ size: 0, type: "image/png" }).ok).toBe(false);
    expect(validateAvatarFile({ size: 2 * 1024 * 1024 + 1, type: "image/png" }).ok).toBe(false);
  });
});

describe("name helpers", () => {
  it("derives initials and first names", () => {
    expect(initialsFor("Ayesha Khan")).toBe("AK");
    expect(initialsFor("  madonna ")).toBe("M");
    expect(initialsFor("", "?")).toBe("?");
    expect(firstNameOf("Ana Rivera")).toBe("Ana");
  });
});
