import { describe, expect, it } from "vitest";

import { availableActions, nextApplicationStatus } from "../applications/state-machine";
import { issueFix, issueMessage, parseIssueStrings, primaryIssue, toIssues } from "./eligibility";
import { creatorProfileSchema, latestAllowedBirthDate, socialAccountSchema } from "./schemas";
import { displayHandle, formatFollowers, normalizeHandle, profileUrl } from "./social";

describe("social handles", () => {
  it("accepts handles with or without @", () => {
    expect(normalizeHandle("instagram", "@creator.one")).toBe("creator.one");
    expect(normalizeHandle("tiktok", "creator_1")).toBe("creator_1");
  });

  it("extracts handles from links on the platform's own domain only", () => {
    expect(normalizeHandle("instagram", "https://www.instagram.com/creator.one/")).toBe("creator.one");
    expect(normalizeHandle("tiktok", "tiktok.com/@creator_1")).toBe("creator_1");
    expect(normalizeHandle("youtube", "https://youtube.com/@my-channel")).toBe("my-channel");
    expect(normalizeHandle("instagram", "https://evil.example/creator.one")).toBeNull();
    expect(normalizeHandle("instagram", "https://instagram.com.evil.example/creator")).toBeNull();
  });

  it("rejects invalid characters and lengths", () => {
    expect(normalizeHandle("instagram", "has space")).toBeNull();
    expect(normalizeHandle("instagram", "x".repeat(31))).toBeNull();
    expect(normalizeHandle("facebook", "abc")).toBeNull();
    expect(normalizeHandle("instagram", "<script>")).toBeNull();
  });

  it("builds canonical profile URLs (mirrors the SQL function)", () => {
    expect(profileUrl("instagram", "creator.one")).toBe("https://www.instagram.com/creator.one/");
    expect(profileUrl("tiktok", "creator_1")).toBe("https://www.tiktok.com/@creator_1");
    expect(profileUrl("facebook", "brand.page")).toBe("https://www.facebook.com/brand.page");
    expect(profileUrl("youtube", "my-channel")).toBe("https://www.youtube.com/@my-channel");
    expect(displayHandle("instagram", "x")).toBe("@x");
  });

  it("formats follower counts compactly", () => {
    expect(formatFollowers(12_500)).toBe("12.5K");
    expect(formatFollowers(null)).toBe("Not provided");
  });
});

describe("social account schema", () => {
  it("normalises handle and parses follower counts without floats", () => {
    expect(socialAccountSchema.parse({ platform: "instagram", handle: "@Creator.One", followerCount: "12,500" })).toEqual({
      platform: "instagram",
      handle: "Creator.One",
      followerCount: 12500,
    });
  });

  it("rejects bad handles, negative and fractional follower counts", () => {
    expect(socialAccountSchema.safeParse({ platform: "instagram", handle: "bad handle", followerCount: "10" }).success).toBe(false);
    expect(socialAccountSchema.safeParse({ platform: "instagram", handle: "ok", followerCount: "-10" }).success).toBe(false);
    expect(socialAccountSchema.safeParse({ platform: "instagram", handle: "ok", followerCount: "10.5" }).success).toBe(false);
    expect(socialAccountSchema.safeParse({ platform: "instagram", handle: "ok", followerCount: "" }).success).toBe(false);
  });
});

describe("creator profile schema", () => {
  const schema = creatorProfileSchema("2026-09-26");

  it("enforces a minimum age of 13", () => {
    expect(latestAllowedBirthDate("2026-09-26")).toBe("2013-09-26");
    expect(schema.safeParse({ countryCode: "GB", dateOfBirth: "2013-09-26", gender: null, categories: [] }).success).toBe(true);
    expect(schema.safeParse({ countryCode: "GB", dateOfBirth: "2013-09-27", gender: null, categories: [] }).success).toBe(false);
  });

  it("keeps every field optional and validates codes", () => {
    expect(schema.safeParse({ countryCode: null, dateOfBirth: null, gender: null, categories: [] }).success).toBe(true);
    expect(schema.safeParse({ countryCode: "ZZ", dateOfBirth: null, gender: null, categories: [] }).success).toBe(false);
    expect(schema.safeParse({ countryCode: null, dateOfBirth: null, gender: "other", categories: [] }).success).toBe(false);
  });
});

describe("eligibility issues (display only; the database decides)", () => {
  it("parses discovery strings and RPC rows, dropping unknown codes", () => {
    expect(parseIssueStrings(["missing_platform:instagram", "gender_mismatch", "made_up"])).toEqual([
      { code: "missing_platform", platform: "instagram" },
      { code: "gender_mismatch", platform: null },
    ]);
    expect(toIssues([{ code: "followers_below_minimum", platform: "tiktok" }])).toEqual([
      { code: "followers_below_minimum", platform: "tiktok" },
    ]);
  });

  it("uses the design's wording for the platform gate", () => {
    expect(issueMessage({ code: "missing_platform", platform: "instagram" })).toBe("Instagram account required");
    expect(issueMessage({ code: "followers_below_minimum", platform: "tiktok" }, 10_000)).toBe(
      "TikTok needs at least 10,000 followers",
    );
  });

  it("offers the right fix", () => {
    expect(issueFix({ code: "missing_platform", platform: "instagram" })).toEqual({ kind: "connect_platform", platform: "instagram" });
    expect(issueFix({ code: "age_not_set", platform: null })).toEqual({ kind: "creator_details" });
    expect(issueFix({ code: "age_out_of_range", platform: null })).toEqual({ kind: "none" });
  });

  it("puts the platform gate first", () => {
    expect(primaryIssue([{ code: "gender_mismatch", platform: null }, { code: "missing_platform", platform: "youtube" }])).toEqual({
      code: "missing_platform",
      platform: "youtube",
    });
    expect(primaryIssue([])).toBeNull();
  });
});

describe("application state machine", () => {
  it("follows pending → shortlist → select, or reject", () => {
    expect(nextApplicationStatus("pending", "shortlist")).toBe("shortlisted");
    expect(nextApplicationStatus("shortlisted", "select")).toBe("selected");
    expect(nextApplicationStatus("pending", "reject")).toBe("rejected");
    expect(nextApplicationStatus("rejected", "reconsider")).toBe("pending");
  });

  it("makes selection final and blocks invalid moves", () => {
    expect(availableActions("selected")).toEqual([]);
    expect(nextApplicationStatus("selected", "reject")).toBeNull();
    expect(nextApplicationStatus("pending", "unshortlist")).toBeNull();
    expect(nextApplicationStatus("rejected", "select")).toBeNull();
  });
});
