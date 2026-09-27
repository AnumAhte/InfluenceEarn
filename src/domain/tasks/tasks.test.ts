import { describe, expect, it } from "vitest";

import { canTransition } from "../campaigns/state-machine";
import { submissionGate } from "./assignment";
import { proofIssues, proofUrlMatchesPlatform, toSubmissionItems, type ProofTask } from "./proof";

const TASKS: ProofTask[] = [
  { id: "reel", platform: "instagram", taskType: "instagram_reel" },
  { id: "comment", platform: "instagram", taskType: "comment" },
  { id: "follow", platform: "instagram", taskType: "follow" },
  { id: "story", platform: "instagram", taskType: "instagram_story" },
];

const valid = [
  { taskId: "reel", url: "https://www.instagram.com/reel/abc/", commentText: "" },
  { taskId: "comment", url: "https://instagram.com/p/xyz/", commentText: "Love it" },
  { taskId: "follow", url: "", commentText: "" },
  { taskId: "story", url: "", commentText: "" },
];

describe("proof URLs (mirrors proof_url_matches_platform)", () => {
  it("accepts https links on the platform's own domain", () => {
    expect(proofUrlMatchesPlatform("instagram", "https://www.instagram.com/reel/abc/")).toBe(true);
    expect(proofUrlMatchesPlatform("tiktok", "https://www.tiktok.com/@me/video/123")).toBe(true);
    expect(proofUrlMatchesPlatform("tiktok", "https://vm.tiktok.com/ZMabc/")).toBe(true);
    expect(proofUrlMatchesPlatform("youtube", "https://youtu.be/abc123")).toBe(true);
    expect(proofUrlMatchesPlatform("youtube", "https://www.youtube.com/shorts/abc")).toBe(true);
    expect(proofUrlMatchesPlatform("facebook", "https://fb.watch/abc/")).toBe(true);
  });

  it("rejects other domains, look-alikes and plain http", () => {
    expect(proofUrlMatchesPlatform("instagram", "https://evil.example/reel/abc")).toBe(false);
    expect(proofUrlMatchesPlatform("instagram", "https://instagram.com.evil.example/p/x")).toBe(false);
    expect(proofUrlMatchesPlatform("instagram", "http://www.instagram.com/p/x")).toBe(false);
    expect(proofUrlMatchesPlatform("instagram", "https://www.instagram.com/")).toBe(false);
    expect(proofUrlMatchesPlatform("tiktok", "https://www.instagram.com/p/x")).toBe(false);
  });
});

describe("proof requirements", () => {
  it("accepts a complete submission (story link optional, follow needs none, no screenshots)", () => {
    expect(proofIssues(TASKS, valid)).toEqual([]);
  });

  it("requires the URL for URL tasks and comment text for comments", () => {
    const issues = proofIssues(TASKS, [
      { taskId: "reel", url: "", commentText: "" },
      { taskId: "comment", url: "https://instagram.com/p/xyz/", commentText: " " },
      { taskId: "follow", url: "", commentText: "" },
      { taskId: "story", url: "https://evil.example/s", commentText: "" },
    ]);
    expect(issues.map((i) => `${i.taskId}:${i.field}`)).toEqual(["reel:url", "comment:commentText", "story:url"]);
  });

  it("drops links on no-proof tasks and trims values", () => {
    const items = toSubmissionItems(TASKS, [
      ...valid.slice(0, 2),
      { taskId: "follow", url: "https://www.instagram.com/brand/", commentText: "" },
      { taskId: "story", url: "  ", commentText: "" },
    ]);
    expect(items).toEqual([
      { task_id: "reel", url: "https://www.instagram.com/reel/abc/", comment_text: null },
      { task_id: "comment", url: "https://instagram.com/p/xyz/", comment_text: "Love it" },
      { task_id: "follow", url: null, comment_text: null },
      { task_id: "story", url: null, comment_text: null },
    ]);
  });
});

describe("submission gate", () => {
  const now = new Date("2026-10-01T12:00:00Z");
  const base = { dueAt: "2026-10-05T23:59:59Z", attemptCount: 0, maxAttempts: 3 };

  it("allows work in progress or after changes are requested", () => {
    expect(submissionGate({ ...base, status: "in_progress" }, now)).toEqual({ canSubmit: true });
    expect(submissionGate({ ...base, status: "revision_requested", attemptCount: 1 }, now)).toEqual({ canSubmit: true });
  });

  it("blocks while waiting, after decisions, past the deadline or out of attempts", () => {
    expect(submissionGate({ ...base, status: "submitted" }, now)).toEqual({ canSubmit: false, reason: "waiting_for_review" });
    expect(submissionGate({ ...base, status: "approved" }, now)).toEqual({ canSubmit: false, reason: "finished" });
    expect(submissionGate({ ...base, status: "in_progress", dueAt: "2026-09-30T23:59:59Z" }, now)).toEqual({ canSubmit: false, reason: "deadline_passed" });
    expect(submissionGate({ ...base, status: "revision_requested", attemptCount: 3 }, now)).toEqual({ canSubmit: false, reason: "attempts_exhausted" });
  });
});

describe("campaign lifecycle (phase 4)", () => {
  it("allows completing from in_progress or review_pending only", () => {
    expect(canTransition("in_progress", "completed")).toBe(true);
    expect(canTransition("review_pending", "completed")).toBe(true);
    expect(canTransition("selection_in_progress", "completed")).toBe(false);
  });
});
