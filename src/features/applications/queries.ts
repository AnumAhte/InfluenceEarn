import "server-only";

import { z } from "zod";

import { APPLICATION_STATUSES, type ApplicationStatus } from "@/domain/applications/state-machine";
import { SOCIAL_PLATFORMS } from "@/domain/campaigns/catalog";
import { escapeLikePattern } from "@/features/campaigns/list-params";
import { createClient } from "@/lib/supabase/server";

export const APPLICANTS_PAGE_SIZE = 20;
export const MY_APPLICATIONS_PAGE_SIZE = 15;

// ----------------------------------------------------------------------------
// Advertiser: applicants for one campaign
// ----------------------------------------------------------------------------
export const applicantParamsSchema = z.object({
  status: z.enum(APPLICATION_STATUSES).optional().catch(undefined),
  q: z.string().trim().max(100).catch(""),
  platform: z.enum(SOCIAL_PLATFORMS).optional().catch(undefined),
  minFollowers: z.coerce.number().int().min(0).max(2_000_000_000).optional().catch(undefined),
  sort: z.enum(["newest", "followers"]).catch("newest"),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});

export type ApplicantParams = z.output<typeof applicantParamsSchema>;

export function parseApplicantParams(raw: Record<string, string | string[] | undefined>): ApplicantParams {
  const single = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  return applicantParamsSchema.parse({
    status: single(raw.status),
    q: single(raw.q) ?? "",
    platform: single(raw.platform),
    minFollowers: single(raw.minFollowers) || undefined,
    sort: single(raw.sort),
    page: single(raw.page),
  });
}

export function applicantsHref(campaignId: string, params: Partial<ApplicantParams>): string {
  const search = new URLSearchParams();
  if (params.status) search.set("status", params.status);
  if (params.q) search.set("q", params.q);
  if (params.platform) search.set("platform", params.platform);
  if (params.minFollowers) search.set("minFollowers", String(params.minFollowers));
  if (params.sort && params.sort !== "newest") search.set("sort", params.sort);
  if (params.page && params.page > 1) search.set("page", String(params.page));
  const query = search.toString();
  return `/campaigns/${campaignId}/applicants${query ? `?${query}` : ""}`;
}

const APPLICANT_COLUMNS =
  "id, status, pitch, creator_name, creator_city, creator_country_code, creator_age, creator_gender, creator_categories, max_follower_count, created_at, status_changed_at, accounts:application_social_accounts(platform, handle, profile_url, follower_count)";

/** Paginated, filtered applicants (RLS: only the campaign owner or an admin gets rows). */
export async function listApplicants(campaignId: string, params: ApplicantParams) {
  const supabase = await createClient();
  const filtered = Boolean(params.platform || params.minFollowers);
  const columns = filtered
    ? `${APPLICANT_COLUMNS}, account_filter:application_social_accounts!inner(platform, follower_count)`
    : APPLICANT_COLUMNS;

  let query = supabase.from("campaign_applications").select(columns, { count: "exact" }).eq("campaign_id", campaignId);
  if (params.status) query = query.eq("status", params.status);
  if (params.q) query = query.ilike("search_text", `%${escapeLikePattern(params.q.toLowerCase())}%`);
  if (params.platform) query = query.eq("account_filter.platform", params.platform);
  if (params.minFollowers) query = query.gte("account_filter.follower_count", params.minFollowers);

  query =
    params.sort === "followers"
      ? query.order("max_follower_count", { ascending: false, nullsFirst: false })
      : query.order("created_at", { ascending: false });

  const offset = (params.page - 1) * APPLICANTS_PAGE_SIZE;
  const { data, count, error } = await query
    .order("id", { ascending: false })
    .range(offset, offset + APPLICANTS_PAGE_SIZE - 1)
    .overrideTypes<ApplicantRow[], { merge: false }>();

  if (error) throw new Error("Applicants could not be loaded.", { cause: error });
  return { rows: data ?? [], total: count ?? 0 };
}

export type ApplicantRow = {
  id: string;
  status: ApplicationStatus;
  pitch: string | null;
  creator_name: string;
  creator_city: string | null;
  creator_country_code: string | null;
  creator_age: number | null;
  creator_gender: "female" | "male" | "non_binary" | null;
  creator_categories: string[];
  max_follower_count: number | null;
  created_at: string;
  status_changed_at: string;
  accounts: { platform: (typeof SOCIAL_PLATFORMS)[number]; handle: string; profile_url: string; follower_count: number | null }[];
};

export async function getApplicationCounts(campaignId: string): Promise<Record<ApplicationStatus | "all", number>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("campaign_application_counts", { p_campaign_id: campaignId });
  if (error) throw new Error("Application counts could not be loaded.", { cause: error });
  const counts = { all: 0, pending: 0, shortlisted: 0, selected: 0, rejected: 0 };
  for (const row of data ?? []) {
    counts[row.status] = row.total;
    counts.all += row.total;
  }
  return counts;
}

// ----------------------------------------------------------------------------
// Creator: my applications
// ----------------------------------------------------------------------------
export async function listMyApplications(userId: string, status: ApplicationStatus | undefined, page: number) {
  const supabase = await createClient();
  let query = supabase
    .from("campaign_applications")
    .select(
      "id, status, created_at, status_changed_at, campaign:campaigns(id, title, status, payment_per_creator_cents, application_deadline, task_deadline, platforms:campaign_platforms(platform))",
      { count: "exact" },
    )
    .eq("creator_id", userId);
  if (status) query = query.eq("status", status);

  const offset = (page - 1) * MY_APPLICATIONS_PAGE_SIZE;
  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + MY_APPLICATIONS_PAGE_SIZE - 1);
  if (error) throw new Error("Applications could not be loaded.", { cause: error });
  return { rows: data ?? [], total: count ?? 0 };
}
