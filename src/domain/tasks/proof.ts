import { TASK_RULES, type SocialPlatform, type TaskType } from "../campaigns/catalog";

/**
 * Proof rules for task submissions. The database (`submit_task_completion` +
 * `proof_url_matches_platform`) is authoritative; this mirror gives creators
 * instant feedback in the form.
 */
const PLATFORM_URL: Record<SocialPlatform, RegExp> = {
  instagram: /^https:\/\/([a-z0-9-]+\.)*instagram\.com\/\S+$/i,
  tiktok: /^https:\/\/([a-z0-9-]+\.)*tiktok\.com\/\S+$/i,
  facebook: /^https:\/\/([a-z0-9-]+\.)*(facebook\.com|fb\.watch)\/\S+$/i,
  youtube: /^https:\/\/(([a-z0-9-]+\.)*youtube\.com|youtu\.be)\/\S+$/i,
};

export const MAX_COMMENT_LENGTH = 2200;
export const MAX_NOTE_LENGTH = 1000;

export function proofUrlMatchesPlatform(platform: SocialPlatform, url: string): boolean {
  return PLATFORM_URL[platform].test(url.trim());
}

export type ProofTask = { id: string; platform: SocialPlatform; taskType: TaskType };
export type ProofInput = { taskId: string; url: string; commentText: string };
export type ProofIssue = { taskId: string; field: "url" | "commentText"; message: string };

const PLATFORM_HOST: Record<SocialPlatform, string> = {
  instagram: "instagram.com",
  tiktok: "tiktok.com",
  facebook: "facebook.com",
  youtube: "youtube.com",
};

/** Checks one submission against every task's proof rule. Empty result = valid. */
export function proofIssues(tasks: readonly ProofTask[], inputs: readonly ProofInput[]): ProofIssue[] {
  const issues: ProofIssue[] = [];
  for (const task of tasks) {
    const rule = TASK_RULES[task.taskType];
    const input = inputs.find((i) => i.taskId === task.id);
    const url = input?.url.trim() ?? "";
    const comment = input?.commentText.trim() ?? "";

    if (rule.proofUrl === "required" && !url) {
      issues.push({ taskId: task.id, field: "url", message: `Paste the ${rule.proofLabel.replace(/, if available$/, "")}` });
    } else if (url && rule.proofUrl !== "none" && !proofUrlMatchesPlatform(task.platform, url)) {
      issues.push({ taskId: task.id, field: "url", message: `Use a full https:// link on ${PLATFORM_HOST[task.platform]}` });
    }
    if (rule.requiresCommentText) {
      if (!comment) issues.push({ taskId: task.id, field: "commentText", message: "Paste the comment you posted" });
      else if (comment.length > MAX_COMMENT_LENGTH) {
        issues.push({ taskId: task.id, field: "commentText", message: `Keep the comment under ${MAX_COMMENT_LENGTH} characters` });
      }
    }
  }
  return issues;
}

/** Payload for `submit_task_completion`: one entry per task, irrelevant fields dropped. */
export function toSubmissionItems(tasks: readonly ProofTask[], inputs: readonly ProofInput[]) {
  return tasks.map((task) => {
    const rule = TASK_RULES[task.taskType];
    const input = inputs.find((i) => i.taskId === task.id);
    return {
      task_id: task.id,
      url: rule.proofUrl === "none" ? null : input?.url.trim() || null,
      comment_text: rule.requiresCommentText ? input?.commentText.trim() || null : null,
    };
  });
}
