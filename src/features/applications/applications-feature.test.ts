import { describe, expect, it } from "vitest";

import { discoverHref, parseDiscoverParams } from "@/features/discover/list-params";

import { describeApplicationError } from "./errors";
import { applicantsHref, parseApplicantParams } from "./queries";

describe("describeApplicationError", () => {
  it("returns the eligibility issues reported by the database", () => {
    const failure = describeApplicationError({
      message: "not_eligible",
      details: '[{"code":"missing_platform","platform":"instagram"},{"code":"age_not_set","platform":null}]',
    });
    expect(failure).toEqual({
      code: "not_eligible",
      message: "You don't meet this campaign's requirements yet.",
      issues: [
        { code: "missing_platform", platform: "instagram" },
        { code: "age_not_set", platform: null },
      ],
    });
  });

  it("maps application and selection errors", () => {
    expect(describeApplicationError({ message: "already_applied" }).code).toBe("already_applied");
    expect(describeApplicationError({ message: "own_campaign" }).code).toBe("own_campaign");
    expect(describeApplicationError({ message: "selection_full" }).code).toBe("selection_full");
    expect(describeApplicationError({ message: "invalid_application_transition: selected -> rejected" }).code).toBe("invalid_transition");
    expect(describeApplicationError({ message: "some internal error" })).toEqual({ code: "unknown", message: "Something went wrong. Please try again." });
  });
});

describe("list params", () => {
  it("parses applicant filters and falls back safely", () => {
    expect(parseApplicantParams({ status: "shortlisted", q: " ana ", platform: "tiktok", minFollowers: "10000", sort: "followers", page: "2" })).toEqual({
      status: "shortlisted",
      q: "ana",
      platform: "tiktok",
      minFollowers: 10000,
      sort: "followers",
      page: 2,
    });
    expect(parseApplicantParams({ status: "hired", minFollowers: "-5", sort: "random", page: "x" })).toMatchObject({
      status: undefined,
      minFollowers: undefined,
      sort: "newest",
      page: 1,
    });
    expect(applicantsHref("c1", { status: "selected", page: 1 })).toBe("/campaigns/c1/applicants?status=selected");
  });

  it("parses discovery filters", () => {
    expect(parseDiscoverParams({ sort: "ending_soon", eligible: "1", category: "food" })).toMatchObject({
      sort: "ending_soon",
      eligible: "1",
      category: "food",
      page: 1,
    });
    expect(parseDiscoverParams({ sort: "cheapest", eligible: "yes" })).toMatchObject({ sort: "newest", eligible: undefined });
    expect(discoverHref({ eligible: "1", sort: "newest", page: 1 })).toBe("/discover?eligible=1");
  });
});
