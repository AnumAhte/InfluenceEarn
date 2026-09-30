import "server-only";

import { createClient } from "@/lib/supabase/server";

export const PAYOUT_TABS = ["ready", "on_hold", "processing", "failed", "paid"] as const;
export type PayoutTab = (typeof PAYOUT_TABS)[number];
export const PAYOUTS_PAGE_SIZE = 20;

export function isPayoutTab(value: unknown): value is PayoutTab {
  return typeof value === "string" && (PAYOUT_TABS as readonly string[]).includes(value);
}

export type PayoutQueueRow = {
  assignmentId: string;
  payoutId: string | null;
  creatorName: string;
  campaignId: string | null;
  campaignTitle: string;
  amountCents: number;
  approvedAt: string | null;
  proofLinks: string[];
  status: PayoutTab;
  attemptCount: number;
  failureReason: string | null;
  holdReason: string | null;
  providerReference: string | null;
  paidAt: string | null;
  updatedAt: string | null;
};

const ASSIGNMENT_EMBED =
  "id, reward_cents, decided_at, application:campaign_applications(creator_name), campaign:campaigns(id, title), submissions:task_submissions(attempt, items:task_submission_items(proof_url))";

type AssignmentEmbed = {
  id: string;
  reward_cents: number;
  decided_at: string | null;
  application: { creator_name: string } | null;
  campaign: { id: string; title: string } | null;
  submissions: { attempt: number; items: { proof_url: string | null }[] }[];
};

function latestLinks(assignment: AssignmentEmbed | null): string[] {
  const latest = [...(assignment?.submissions ?? [])].sort((a, b) => b.attempt - a.attempt)[0];
  return (latest?.items ?? []).map((i) => i.proof_url).filter((u): u is string => Boolean(u));
}

/** One page of the admin payout queue (RLS: admins only). */
export async function listPayoutQueue(tab: PayoutTab, page: number) {
  const supabase = await createClient();
  const offset = (page - 1) * PAYOUTS_PAGE_SIZE;

  if (tab === "ready") {
    const { data, count, error } = await supabase
      .from("campaign_assignments")
      .select(ASSIGNMENT_EMBED, { count: "exact" })
      .eq("status", "approved")
      .order("decided_at", { ascending: true })
      .range(offset, offset + PAYOUTS_PAGE_SIZE - 1)
      .overrideTypes<AssignmentEmbed[], { merge: false }>();
    if (error) throw new Error("Payout queue could not be loaded.", { cause: error });
    const rows: PayoutQueueRow[] = (data ?? []).map((a) => ({
      assignmentId: a.id,
      payoutId: null,
      creatorName: a.application?.creator_name ?? "Creator",
      campaignId: a.campaign?.id ?? null,
      campaignTitle: a.campaign?.title ?? "Campaign",
      amountCents: a.reward_cents,
      approvedAt: a.decided_at,
      proofLinks: latestLinks(a),
      status: "ready",
      attemptCount: 0,
      failureReason: null,
      holdReason: null,
      providerReference: null,
      paidAt: null,
      updatedAt: null,
    }));
    return { rows, total: count ?? 0 };
  }

  const { data, count, error } = await supabase
    .from("payouts")
    .select(`id, status, amount_cents, attempt_count, failure_reason, hold_reason, provider_reference, paid_at, updated_at, assignment:campaign_assignments(${ASSIGNMENT_EMBED})`, {
      count: "exact",
    })
    .eq("status", tab)
    .order("updated_at", { ascending: tab !== "paid" })
    .range(offset, offset + PAYOUTS_PAGE_SIZE - 1)
    .overrideTypes<
      {
        id: string;
        status: Exclude<PayoutTab, "ready">;
        amount_cents: number;
        attempt_count: number;
        failure_reason: string | null;
        hold_reason: string | null;
        provider_reference: string | null;
        paid_at: string | null;
        updated_at: string;
        assignment: AssignmentEmbed | null;
      }[],
      { merge: false }
    >();
  if (error) throw new Error("Payout queue could not be loaded.", { cause: error });
  const rows: PayoutQueueRow[] = (data ?? []).map((p) => ({
    assignmentId: p.assignment?.id ?? "",
    payoutId: p.id,
    creatorName: p.assignment?.application?.creator_name ?? "Creator",
    campaignId: p.assignment?.campaign?.id ?? null,
    campaignTitle: p.assignment?.campaign?.title ?? "Campaign",
    amountCents: p.amount_cents,
    approvedAt: p.assignment?.decided_at ?? null,
    proofLinks: latestLinks(p.assignment),
    status: p.status,
    attemptCount: p.attempt_count,
    failureReason: p.failure_reason,
    holdReason: p.hold_reason,
    providerReference: p.provider_reference,
    paidAt: p.paid_at,
    updatedAt: p.updated_at,
  }));
  return { rows, total: count ?? 0 };
}

export async function getPayoutCounts(): Promise<Record<PayoutTab, number>> {
  const supabase = await createClient();
  const ready = supabase.from("campaign_assignments").select("id", { count: "exact", head: true }).eq("status", "approved");
  const byStatus = (status: Exclude<PayoutTab, "ready">) =>
    supabase.from("payouts").select("id", { count: "exact", head: true }).eq("status", status);
  const [r, h, p, f, d] = await Promise.all([ready, byStatus("on_hold"), byStatus("processing"), byStatus("failed"), byStatus("paid")]);
  return { ready: r.count ?? 0, on_hold: h.count ?? 0, processing: p.count ?? 0, failed: f.count ?? 0, paid: d.count ?? 0 };
}

export const ACTIVITY_PAGE_SIZE = 30;

export async function listAdminActivity(page: number) {
  const supabase = await createClient();
  const offset = (page - 1) * ACTIVITY_PAGE_SIZE;
  const { data, count, error } = await supabase
    .from("admin_activity_logs")
    .select("id, action, target_type, target_id, details, created_at, actor:profiles(full_name)", { count: "exact" })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + ACTIVITY_PAGE_SIZE - 1);
  if (error) throw new Error("Activity log could not be loaded.", { cause: error });
  return { rows: data ?? [], total: count ?? 0 };
}
