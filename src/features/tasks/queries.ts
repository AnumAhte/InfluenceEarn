import "server-only";

import { ACTIVE_ASSIGNMENT_STATUSES, type AssignmentStatus } from "@/domain/tasks/assignment";
import { createClient } from "@/lib/supabase/server";

export const TASKS_PAGE_SIZE = 15;
export const SUBMISSIONS_PAGE_SIZE = 10;

const DONE_STATUSES: AssignmentStatus[] = ["approved", "rejected", "expired", "payout_pending", "paid"];

// ----------------------------------------------------------------------------
// Creator
// ----------------------------------------------------------------------------
export async function listMyAssignments(userId: string, view: "active" | "completed", page: number) {
  const supabase = await createClient();
  const offset = (page - 1) * TASKS_PAGE_SIZE;
  const { data, count, error } = await supabase
    .from("campaign_assignments")
    .select("id, status, reward_cents, due_at, attempt_count, max_attempts, decided_at, campaign:campaigns(id, title, platforms:campaign_platforms(platform))", {
      count: "exact",
    })
    .eq("creator_id", userId)
    .in("status", view === "active" ? [...ACTIVE_ASSIGNMENT_STATUSES] : DONE_STATUSES)
    .order(view === "active" ? "due_at" : "decided_at", { ascending: view === "active", nullsFirst: false })
    .order("id", { ascending: false })
    .range(offset, offset + TASKS_PAGE_SIZE - 1);
  if (error) throw new Error("Tasks could not be loaded.", { cause: error });
  return { rows: data ?? [], total: count ?? 0 };
}

const SUBMISSION_COLUMNS =
  "id, attempt, note, submitted_at, items:task_submission_items(campaign_task_id, proof_url, comment_text), review:task_reviews(decision, reason, allow_resubmission, created_at)";

/** One assignment for its creator, with the campaign brief and every submission. */
export async function getMyAssignment(userId: string, assignmentId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(assignmentId)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("campaign_assignments")
    .select(
      `id, status, reward_cents, due_at, attempt_count, max_attempts, submitted_at, decided_at, created_at,
       campaign:campaigns(id, title, instructions, caption_instructions, hashtags, mentions, reference_url,
         tasks:campaign_tasks(id, platform, task_type, quantity, custom_description, position)),
       submissions:task_submissions(${SUBMISSION_COLUMNS})`,
    )
    .eq("id", assignmentId)
    .eq("creator_id", userId)
    .maybeSingle();
  if (error) throw new Error("Task could not be loaded.", { cause: error });
  if (!data || !data.campaign) return null;
  return {
    ...data,
    campaign: { ...data.campaign, tasks: [...data.campaign.tasks].sort((a, b) => a.position - b.position) },
    submissions: [...data.submissions].sort((a, b) => b.attempt - a.attempt),
  };
}

export type MyAssignment = NonNullable<Awaited<ReturnType<typeof getMyAssignment>>>;

// ----------------------------------------------------------------------------
// Advertiser
// ----------------------------------------------------------------------------
export async function getAssignmentCounts(campaignId: string): Promise<Record<AssignmentStatus | "all", number>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("campaign_assignment_counts", { p_campaign_id: campaignId });
  if (error) throw new Error("Work counts could not be loaded.", { cause: error });
  const counts = {
    all: 0, in_progress: 0, submitted: 0, revision_requested: 0, approved: 0, rejected: 0, expired: 0, payout_pending: 0, paid: 0,
  } satisfies Record<AssignmentStatus | "all", number>;
  for (const row of data ?? []) {
    counts[row.status] = row.total;
    counts.all += row.total;
  }
  return counts;
}

/** Assignments of one campaign with their submissions (RLS: owner/admin only). */
export async function listCampaignWork(campaignId: string, status: AssignmentStatus | undefined, page: number) {
  const supabase = await createClient();
  let query = supabase
    .from("campaign_assignments")
    .select(
      `id, status, reward_cents, due_at, attempt_count, max_attempts, submitted_at, decided_at,
       application:campaign_applications(creator_name, accounts:application_social_accounts(platform, handle, profile_url)),
       submissions:task_submissions(${SUBMISSION_COLUMNS})`,
      { count: "exact" },
    )
    .eq("campaign_id", campaignId);
  if (status) query = query.eq("status", status);
  const offset = (page - 1) * SUBMISSIONS_PAGE_SIZE;
  const { data, count, error } = await query
    // Work waiting for review first, oldest submission first.
    .order("submitted_at", { ascending: true, nullsFirst: false })
    .order("id", { ascending: true })
    .range(offset, offset + SUBMISSIONS_PAGE_SIZE - 1);
  if (error) throw new Error("Submissions could not be loaded.", { cause: error });
  return {
    rows: (data ?? []).map((row) => ({ ...row, submissions: [...row.submissions].sort((a, b) => b.attempt - a.attempt) })),
    total: count ?? 0,
  };
}

export type CampaignWorkRow = Awaited<ReturnType<typeof listCampaignWork>>["rows"][number];

/** Work awaiting the advertiser's review across all their campaigns. */
export async function listMyPendingReviews(userId: string, page: number) {
  const supabase = await createClient();
  const offset = (page - 1) * TASKS_PAGE_SIZE;
  const { data, count, error } = await supabase
    .from("campaign_assignments")
    .select("id, submitted_at, attempt_count, application:campaign_applications(creator_name), campaign:campaigns!inner(id, title, owner_id)", {
      count: "exact",
    })
    .eq("status", "submitted")
    .eq("campaign.owner_id", userId)
    .order("submitted_at", { ascending: true })
    .range(offset, offset + TASKS_PAGE_SIZE - 1);
  if (error) throw new Error("Reviews could not be loaded.", { cause: error });
  return { rows: data ?? [], total: count ?? 0 };
}
