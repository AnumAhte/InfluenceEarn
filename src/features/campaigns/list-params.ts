import { z } from "zod";

import { CATEGORY_SLUGS, SOCIAL_PLATFORMS } from "@/domain/campaigns/catalog";

import { CAMPAIGN_TABS } from "./status";

export const CAMPAIGNS_PAGE_SIZE = 10;

const TAB_IDS = CAMPAIGN_TABS.map((tab) => tab.id) as [(typeof CAMPAIGN_TABS)[number]["id"], ...(typeof CAMPAIGN_TABS)[number]["id"][]];
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** Search params for /campaigns. Invalid values fall back to defaults instead of erroring. */
export const campaignListParamsSchema = z.object({
  tab: z.enum(TAB_IDS).catch("all"),
  q: z.string().trim().max(100).catch(""),
  platform: z.enum(SOCIAL_PLATFORMS).optional().catch(undefined),
  category: z.enum(CATEGORY_SLUGS).optional().catch(undefined),
  from: dateOnly.optional().catch(undefined),
  to: dateOnly.optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});

export type CampaignListParams = z.output<typeof campaignListParamsSchema>;

export function parseCampaignListParams(raw: Record<string, string | string[] | undefined>): CampaignListParams {
  const single = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  return campaignListParamsSchema.parse({
    tab: single(raw.tab),
    q: single(raw.q) ?? "",
    platform: single(raw.platform),
    category: single(raw.category),
    from: single(raw.from),
    to: single(raw.to),
    page: single(raw.page),
  });
}

/** Escapes LIKE wildcards so a search for "50%" matches literally. */
export function escapeLikePattern(input: string): string {
  return input.replace(/[\\%_]/g, (char) => `\\${char}`);
}

export function campaignListHref(params: Partial<CampaignListParams>): string {
  const search = new URLSearchParams();
  if (params.tab && params.tab !== "all") search.set("tab", params.tab);
  if (params.q) search.set("q", params.q);
  if (params.platform) search.set("platform", params.platform);
  if (params.category) search.set("category", params.category);
  if (params.from) search.set("from", params.from);
  if (params.to) search.set("to", params.to);
  if (params.page && params.page > 1) search.set("page", String(params.page));
  const query = search.toString();
  return query ? `/campaigns?${query}` : "/campaigns";
}
