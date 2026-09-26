import { describe, expect, it } from "vitest";

import { visiblePages } from "@/components/ui/pagination";

import { describeDbError } from "./errors";
import { campaignListHref, escapeLikePattern, parseCampaignListParams } from "./list-params";

describe("campaign list params", () => {
  it("parses valid filters", () => {
    expect(parseCampaignListParams({ tab: "draft", q: " summer ", platform: "tiktok", category: "food", page: "3" })).toEqual({
      tab: "draft",
      q: "summer",
      platform: "tiktok",
      category: "food",
      from: undefined,
      to: undefined,
      page: 3,
    });
  });

  it("falls back to safe defaults for junk input", () => {
    expect(parseCampaignListParams({ tab: "hacked", platform: "myspace", category: "x", page: "-4", from: "yesterday" })).toMatchObject({
      tab: "all",
      platform: undefined,
      category: undefined,
      page: 1,
      from: undefined,
    });
  });

  it("builds canonical hrefs", () => {
    expect(campaignListHref({ tab: "all", page: 1 })).toBe("/campaigns");
    expect(campaignListHref({ tab: "draft", q: "a b", page: 2 })).toBe("/campaigns?tab=draft&q=a+b&page=2");
  });

  it("escapes LIKE wildcards in searches", () => {
    expect(escapeLikePattern("50%_off\\")).toBe("50\\%\\_off\\\\");
  });
});

describe("describeDbError", () => {
  it("maps insufficient funds with amounts", () => {
    expect(
      describeDbError({ message: "insufficient_funds", details: '{"required_cents": 120000, "available_cents": 50000}' }),
    ).toMatchObject({ code: "insufficient_funds", requiredCents: 120000, availableCents: 50000 });
  });

  it("maps incomplete campaigns to field copy", () => {
    expect(describeDbError({ message: "campaign_incomplete: tasks" })).toMatchObject({ code: "campaign_incomplete", field: "tasks" });
  });

  it("maps state, lock and permission errors, and hides unknown errors", () => {
    expect(describeDbError({ message: "invalid_campaign_state: draft" }).code).toBe("invalid_campaign_state");
    expect(describeDbError({ message: "campaign_locked" }).code).toBe("campaign_locked");
    expect(describeDbError({ message: "cancel_requires_refund_flow" }).code).toBe("cancel_requires_refund_flow");
    expect(describeDbError({ message: "test_funds_disabled" }).code).toBe("test_funds_disabled");
    expect(describeDbError({ message: 'relation "x" does not exist' })).toEqual({
      code: "unknown",
      message: "Something went wrong. Please try again.",
    });
  });
});

describe("visiblePages", () => {
  it("shows every page when there are few", () => {
    expect(visiblePages(1, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it("collapses long ranges around the current page", () => {
    expect(visiblePages(50, 100)).toEqual([1, "gap", 49, 50, 51, "gap", 100]);
    expect(visiblePages(1, 100)).toEqual([1, 2, "gap", 100]);
  });
});
