import "server-only";

import { parseIssueStrings, toIssues } from "@/domain/creators/eligibility";
import { createClient } from "@/lib/supabase/server";

import { DISCOVER_PAGE_SIZE, type DiscoverParams } from "./list-params";

/** One page of live campaigns with the viewer's eligibility, computed in the database. */
export async function discoverCampaigns(params: DiscoverParams) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("discover_campaigns", {
    p_search: params.q || undefined,
    p_platform: params.platform,
    p_category: params.category,
    p_sort: params.sort,
    p_eligible_only: params.eligible === "1",
    p_limit: DISCOVER_PAGE_SIZE,
    p_offset: (params.page - 1) * DISCOVER_PAGE_SIZE,
  });
  if (error) throw new Error("Campaigns could not be loaded.", { cause: error });
  const rows = (data ?? []).map((row) => ({ ...row, issues: parseIssueStrings(row.issues) }));
  return { rows, total: data?.[0]?.total_count ?? 0 };
}

export type DiscoverRow = Awaited<ReturnType<typeof discoverCampaigns>>["rows"][number];

const CAMPAIGN_COLUMNS = `
  id, title, description, status, category_slug, campaign_type, instructions, caption_instructions, hashtags, mentions,
  reference_url, application_deadline, task_deadline, payment_per_creator_cents, creators_required, owner_id,
  platforms:campaign_platforms(platform),
  tasks:campaign_tasks(id, platform, task_type, quantity, custom_description, position),
  requirements:campaign_requirements(min_followers, genders, age_min, age_max),
  categories:campaign_creator_categories(category_slug),
  locations:campaign_locations(country_code, region, city)
`;

/**
 * A campaign as a creator sees it: only if it is live or they applied to it (RLS).
 * Includes the advertiser's display name, the viewer's eligibility and application.
 */
export async function getCampaignForCreator(userId: string, campaignId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(campaignId)) return null;
  const supabase = await createClient();
  const { data: campaign, error } = await supabase.from("campaigns").select(CAMPAIGN_COLUMNS).eq("id", campaignId).maybeSingle();
  if (error) throw new Error("Campaign could not be loaded.", { cause: error });
  if (!campaign) return null;

  const [advertiser, eligibility, application] = await Promise.all([
    supabase.rpc("campaign_advertiser_name", { p_campaign_id: campaignId }),
    supabase.rpc("my_campaign_eligibility", { p_campaign_id: campaignId }),
    supabase
      .from("campaign_applications")
      .select("id, status, created_at, pitch")
      .eq("campaign_id", campaignId)
      .eq("creator_id", userId)
      .maybeSingle(),
  ]);

  return {
    campaign: { ...campaign, tasks: [...campaign.tasks].sort((a, b) => a.position - b.position) },
    advertiserName: advertiser.data ?? "Advertiser",
    issues: toIssues(eligibility.data),
    application: application.data,
    isOwner: campaign.owner_id === userId,
  };
}

export type CreatorCampaignView = NonNullable<Awaited<ReturnType<typeof getCampaignForCreator>>>;
