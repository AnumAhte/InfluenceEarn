import "server-only";

import type { SocialPlatform } from "@/domain/campaigns/catalog";
import { deadlineToDate, type CampaignDraftInput } from "@/domain/campaigns/schemas";
import type { CampaignStatus } from "@/domain/campaigns/state-machine";
import type { CountryCode } from "@/domain/geo/countries";
import { centsToDollarInput, cents } from "@/domain/money";
import { createClient } from "@/lib/supabase/server";

import { CAMPAIGNS_PAGE_SIZE, escapeLikePattern, type CampaignListParams } from "./list-params";
import { CAMPAIGN_TABS, type CampaignTabId } from "./status";

const LIST_COLUMNS =
  "id, title, status, category_slug, created_at, application_deadline, task_deadline, payment_per_creator_cents, creators_required, platforms:campaign_platforms(platform)";

/** One page of the owner's campaigns, filtered and paginated in the database. */
export async function listMyCampaigns(userId: string, params: CampaignListParams) {
  const supabase = await createClient();
  const columns = params.platform ? `${LIST_COLUMNS}, platform_filter:campaign_platforms!inner(platform)` : LIST_COLUMNS;

  let query = supabase
    .from("campaigns")
    .select(columns, { count: "exact" })
    .eq("owner_id", userId);

  const tab = CAMPAIGN_TABS.find((t) => t.id === params.tab);
  if (tab?.statuses) query = query.in("status", [...tab.statuses]);
  if (params.q) query = query.ilike("title", `%${escapeLikePattern(params.q)}%`);
  if (params.platform) query = query.eq("platform_filter.platform", params.platform);
  if (params.category) query = query.eq("category_slug", params.category);
  if (params.from) query = query.gte("created_at", `${params.from}T00:00:00Z`);
  if (params.to) query = query.lte("created_at", `${params.to}T23:59:59Z`);

  const offset = (params.page - 1) * CAMPAIGNS_PAGE_SIZE;
  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + CAMPAIGNS_PAGE_SIZE - 1)
    .overrideTypes<CampaignListRow[], { merge: false }>();

  if (error) throw new Error("Campaigns could not be loaded.", { cause: error });
  return { rows: data ?? [], total: count ?? 0 };
}

export type CampaignListRow = {
  id: string;
  title: string;
  status: CampaignStatus;
  category_slug: string | null;
  created_at: string;
  application_deadline: string | null;
  task_deadline: string | null;
  payment_per_creator_cents: number | null;
  creators_required: number | null;
  platforms: { platform: SocialPlatform }[];
};

export async function getMyCampaignTabCounts(): Promise<Record<CampaignTabId, number>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_campaign_status_counts");
  if (error) throw new Error("Campaign counts could not be loaded.", { cause: error });

  const byStatus = new Map((data ?? []).map((row) => [row.status, row.total]));
  const counts = {} as Record<CampaignTabId, number>;
  for (const tab of CAMPAIGN_TABS) {
    counts[tab.id] = tab.statuses
      ? tab.statuses.reduce((sum, status) => sum + (byStatus.get(status) ?? 0), 0)
      : [...byStatus.values()].reduce((sum, value) => sum + value, 0);
  }
  return counts;
}

const DETAIL_COLUMNS = `
  *,
  platforms:campaign_platforms(platform),
  tasks:campaign_tasks(id, platform, task_type, quantity, custom_description, position),
  requirements:campaign_requirements(min_followers, genders, age_min, age_max),
  categories:campaign_creator_categories(category_slug),
  locations:campaign_locations(country_code, region, city),
  funding:campaign_funding(id, creator_budget_cents, platform_fee_cents, platform_fee_bps, total_cents, created_at),
  events:campaign_status_events(from_status, to_status, created_at)
`;

/** Full campaign for its owner, or null (not found / not owned). */
export async function getMyCampaign(userId: string, campaignId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(campaignId)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("campaigns")
    .select(DETAIL_COLUMNS)
    .eq("id", campaignId)
    .eq("owner_id", userId)
    .maybeSingle();

  if (error) throw new Error("Campaign could not be loaded.", { cause: error });
  if (!data) return null;

  return {
    ...data,
    tasks: [...data.tasks].sort((a, b) => a.position - b.position),
    events: [...data.events].sort((a, b) => a.created_at.localeCompare(b.created_at)),
  };
}

export type CampaignDetail = NonNullable<Awaited<ReturnType<typeof getMyCampaign>>>;

/** Converts a stored campaign into the wizard's form shape. */
export function toDraftInput(campaign: CampaignDetail): CampaignDraftInput {
  return {
    title: campaign.title,
    description: campaign.description ?? "",
    categorySlug: (campaign.category_slug as CampaignDraftInput["categorySlug"]) ?? null,
    campaignType: campaign.campaign_type,
    eligibility: {
      minFollowers: campaign.requirements?.min_followers ?? null,
      genders: campaign.requirements?.genders ?? [],
      ageMin: campaign.requirements?.age_min ?? null,
      ageMax: campaign.requirements?.age_max ?? null,
      creatorCategories: campaign.categories.map((c) => c.category_slug as CampaignDraftInput["eligibility"]["creatorCategories"][number]),
      locations: campaign.locations.map((l) => ({
        countryCode: l.country_code as CountryCode,
        region: l.region ?? "",
        city: l.city ?? "",
      })),
    },
    platforms: campaign.platforms.map((p) => p.platform),
    tasks: campaign.tasks.map((t) => ({
      platform: t.platform,
      taskType: t.task_type,
      quantity: t.quantity,
      customDescription: t.custom_description ?? undefined,
    })),
    instructions: campaign.instructions ?? "",
    captionInstructions: campaign.caption_instructions ?? "",
    hashtags: campaign.hashtags,
    mentions: campaign.mentions,
    referenceUrl: campaign.reference_url ?? "",
    applicationDeadline: deadlineToDate(campaign.application_deadline),
    taskDeadline: deadlineToDate(campaign.task_deadline),
    paymentPerCreator:
      campaign.payment_per_creator_cents === null ? "" : centsToDollarInput(cents(campaign.payment_per_creator_cents)),
    creatorsRequired: campaign.creators_required,
  };
}
