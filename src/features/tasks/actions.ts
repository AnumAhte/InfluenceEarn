"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { MAX_NOTE_LENGTH, proofIssues, toSubmissionItems, type ProofTask } from "@/domain/tasks/proof";
import { createClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/utils/safe-redirect";

import { describeTaskError } from "./errors";


async function requireUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/login");
  return { supabase, userId };
}

export type SubmitWorkState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors?: Record<string, string> };

/**
 * Creator submits proof for every task. Field names: url:<taskId>, comment:<taskId>.
 * Validated here for instant feedback and again, authoritatively, in the database.
 */
export async function submitWork(_previous: SubmitWorkState, formData: FormData): Promise<SubmitWorkState> {
  const input = z
    .object({ assignmentId: z.uuid(), note: z.string().trim().max(MAX_NOTE_LENGTH, { error: "Keep the note under 1,000 characters" }) })
    .safeParse({ assignmentId: formData.get("assignmentId"), note: formData.get("note") ?? "" });
  if (!input.success) return { status: "error", message: input.error.issues[0]?.message ?? "Invalid request." };

  const { supabase, userId } = await requireUser();
  // Load the tasks server-side; never trust the task list from the browser.
  const { data: assignment } = await supabase
    .from("campaign_assignments")
    .select("id, campaign:campaigns(tasks:campaign_tasks(id, platform, task_type))")
    .eq("id", input.data.assignmentId)
    .eq("creator_id", userId)
    .maybeSingle();
  if (!assignment?.campaign) return { status: "error", message: "Task not found." };

  const tasks: ProofTask[] = assignment.campaign.tasks.map((t) => ({ id: t.id, platform: t.platform, taskType: t.task_type }));
  const inputs = tasks.map((t) => ({
    taskId: t.id,
    url: String(formData.get(`url:${t.id}`) ?? ""),
    commentText: String(formData.get(`comment:${t.id}`) ?? ""),
  }));
  const issues = proofIssues(tasks, inputs);
  if (issues.length > 0) {
    return {
      status: "error",
      message: "Check the highlighted fields.",
      fieldErrors: Object.fromEntries(issues.map((i) => [`${i.field === "url" ? "url" : "comment"}:${i.taskId}`, i.message])),
    };
  }

  const { error } = await supabase.rpc("submit_task_completion", {
    p_assignment_id: input.data.assignmentId,
    p_items: toSubmissionItems(tasks, inputs),
    p_note: input.data.note || undefined,
  });
  if (error) return { status: "error", message: describeTaskError(error) };

  revalidatePath("/tasks", "layout");
  redirect(`/tasks/${input.data.assignmentId}?submitted=1`);
}

export type ReviewState = { status: "idle" } | { status: "error"; message: string };

/** Advertiser approves or rejects the latest submission. */
export async function reviewSubmission(_previous: ReviewState, formData: FormData): Promise<ReviewState> {
  const input = z
    .object({
      submissionId: z.uuid(),
      campaignId: z.uuid(),
      decision: z.enum(["approved", "rejected"]),
      reason: z.string().trim().max(1000, { error: "Keep the reason under 1,000 characters" }),
      allowResubmission: z.enum(["on"]).optional(),
    })
    .safeParse({
      submissionId: formData.get("submissionId"),
      campaignId: formData.get("campaignId"),
      decision: formData.get("decision"),
      reason: formData.get("reason") ?? "",
      allowResubmission: formData.get("allowResubmission") ?? undefined,
    });
  if (!input.success) return { status: "error", message: input.error.issues[0]?.message ?? "Invalid request." };
  if (input.data.decision === "rejected" && input.data.reason.length < 3) {
    return { status: "error", message: "Tell the creator what needs to change." };
  }

  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("review_task_submission", {
    p_submission_id: input.data.submissionId,
    p_decision: input.data.decision,
    p_reason: input.data.reason || undefined,
    p_allow_resubmission: input.data.allowResubmission === "on",
  });
  if (error) return { status: "error", message: describeTaskError(error) };

  revalidatePath(`/campaigns/${input.data.campaignId}`, "layout");
  revalidatePath("/reviews");
  return { status: "idle" };
}

const lifecycleSchema = z.object({ campaignId: z.uuid(), returnTo: z.string().optional() });

async function lifecycle(formData: FormData, rpc: "start_campaign_work" | "complete_campaign") {
  const input = lifecycleSchema.safeParse({ campaignId: formData.get("campaignId"), returnTo: formData.get("returnTo") ?? undefined });
  if (!input.success) redirect("/campaigns");
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc(rpc, { p_campaign_id: input.data.campaignId });
  const back = safeRedirectPath(input.data.returnTo, `/campaigns/${input.data.campaignId}`);
  revalidatePath("/campaigns", "layout");
  if (error) {
    // Only a fixed code travels in the URL; the page maps it to known copy.
    const code = /^(work_outstanding|no_selected_creators)/.exec(error.message ?? "")?.[1] ?? "invalid_campaign_state";
    redirect(`${back}${back.includes("?") ? "&" : "?"}error=${code}`);
  }
  redirect(back);
}

export async function startCampaignWork(formData: FormData) {
  await lifecycle(formData, "start_campaign_work");
}

export async function completeCampaign(formData: FormData) {
  await lifecycle(formData, "complete_campaign");
}
