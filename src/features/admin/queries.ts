import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import { escapeLikePattern } from "@/features/campaigns/list-params";

/**
 * Admin-only reads. RLS (admin read policies) and the admin_* functions enforce access in the
 * database; pages also call requireAdmin() first.
 */
export const ADMIN_PAGE_SIZE = 25;

export const USER_FILTERS = ["all", "advertisers", "influencers", "admins", "suspended"] as const;
export type UserFilter = (typeof USER_FILTERS)[number];
export const isUserFilter = (v: unknown): v is UserFilter => typeof v === "string" && (USER_FILTERS as readonly string[]).includes(v);

export function parsePage(value: unknown) {
  return Math.max(1, Math.min(10_000, Number.parseInt(typeof value === "string" ? value : "1", 10) || 1));
}

export function parseSearch(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 100) : "";
}

export async function listUsers(filter: UserFilter, search: string, page: number) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_users", {
    p_search: search || undefined,
    p_filter: filter,
    p_limit: ADMIN_PAGE_SIZE,
    p_offset: (page - 1) * ADMIN_PAGE_SIZE,
  });
  if (error) throw new Error("Users could not be loaded.", { cause: error });
  return { rows: data ?? [], total: Number(data?.[0]?.total_count ?? 0) };
}

export async function getUserDetail(userId: string) {
  const supabase = await createClient();
  const [profile, email, roles, suspensions, campaigns, applications, assignments] = await Promise.all([
    supabase.from("profiles").select("id, full_name, phone, city, active_workspace, created_at").eq("id", userId).maybeSingle(),
    supabase.rpc("admin_get_user_email", { p_user_id: userId }),
    supabase.from("user_roles").select("role").eq("user_id", userId),
    supabase
      .from("user_suspensions")
      .select("id, reason, suspended_at, lifted_at, lift_reason, suspender:profiles!user_suspensions_suspended_by_fkey(full_name), lifter:profiles!user_suspensions_lifted_by_fkey(full_name)")
      .eq("user_id", userId)
      .order("suspended_at", { ascending: false }),
    supabase.from("campaigns").select("id", { count: "exact", head: true }).eq("owner_id", userId),
    supabase.from("campaign_applications").select("id", { count: "exact", head: true }).eq("creator_id", userId),
    supabase.from("campaign_assignments").select("status").eq("creator_id", userId),
  ]);
  if (profile.error) throw new Error("User could not be loaded.", { cause: profile.error });
  if (!profile.data) return null;

  const assignmentCounts: Record<string, number> = {};
  for (const a of assignments.data ?? []) assignmentCounts[a.status] = (assignmentCounts[a.status] ?? 0) + 1;

  return {
    profile: profile.data,
    email: email.data ?? null,
    isAdmin: (roles.data ?? []).some((r) => r.role === "admin"),
    suspensions: suspensions.data ?? [],
    activeSuspension: (suspensions.data ?? []).find((s) => s.lifted_at === null) ?? null,
    campaignsCount: campaigns.count ?? 0,
    applicationsCount: applications.count ?? 0,
    assignmentCounts,
  };
}

type CampaignStatus = Database["public"]["Enums"]["campaign_status"];

export async function listAllCampaigns(statuses: readonly CampaignStatus[] | null, search: string, page: number) {
  const supabase = await createClient();
  let query = supabase
    .from("campaigns")
    .select("id, title, status, creators_required, payment_per_creator_cents, application_deadline, created_at, owner:profiles!campaigns_owner_id_fkey(id, full_name)", { count: "exact" });
  if (statuses) query = query.in("status", statuses);
  if (search) query = query.ilike("title", `%${escapeLikePattern(search)}%`);
  const offset = (page - 1) * ADMIN_PAGE_SIZE;
  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + ADMIN_PAGE_SIZE - 1);
  if (error) throw new Error("Campaigns could not be loaded.", { cause: error });
  return { rows: data ?? [], total: count ?? 0 };
}

type AssignmentStatus = Database["public"]["Enums"]["assignment_status"];

export async function listAssignments(statuses: readonly AssignmentStatus[], page: number) {
  const supabase = await createClient();
  const offset = (page - 1) * ADMIN_PAGE_SIZE;
  const { data, count, error } = await supabase
    .from("campaign_assignments")
    .select(
      "id, status, reward_cents, attempt_count, max_attempts, submitted_at, decided_at, due_at, campaign:campaigns!campaign_assignments_campaign_id_fkey(id, title, owner:profiles!campaigns_owner_id_fkey(full_name)), creator:profiles!campaign_assignments_creator_id_fkey(id, full_name)",
      { count: "exact" },
    )
    .in("status", statuses)
    .order("submitted_at", { ascending: false, nullsFirst: false })
    .order("id", { ascending: false })
    .range(offset, offset + ADMIN_PAGE_SIZE - 1);
  if (error) throw new Error("Task reviews could not be loaded.", { cause: error });
  return { rows: data ?? [], total: count ?? 0 };
}

type LedgerKind = Database["public"]["Enums"]["ledger_transaction_kind"];

export async function listLedgerTransactions(kind: LedgerKind | null, page: number) {
  const supabase = await createClient();
  let query = supabase
    .from("ledger_transactions")
    .select("id, kind, description, is_test, created_at, campaign_id, initiator:profiles!ledger_transactions_initiated_by_fkey(id, full_name), entries:wallet_ledger_entries(amount_cents)", { count: "exact" });
  if (kind) query = query.eq("kind", kind);
  const offset = (page - 1) * ADMIN_PAGE_SIZE;
  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + ADMIN_PAGE_SIZE - 1);
  if (error) throw new Error("Transactions could not be loaded.", { cause: error });
  // A balanced journal's size is the sum of its positive legs.
  return {
    rows: (data ?? []).map((row) => ({
      ...row,
      amountCents: row.entries.reduce((sum, e) => sum + (e.amount_cents > 0 ? e.amount_cents : 0), 0),
    })),
    total: count ?? 0,
  };
}
