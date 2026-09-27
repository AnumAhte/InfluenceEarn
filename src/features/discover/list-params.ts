import { z } from "zod";

import { CATEGORY_SLUGS, SOCIAL_PLATFORMS } from "@/domain/campaigns/catalog";

export const DISCOVER_PAGE_SIZE = 12;
export const DISCOVER_SORTS = ["newest", "highest_reward", "ending_soon"] as const;

export const discoverParamsSchema = z.object({
  q: z.string().trim().max(100).catch(""),
  platform: z.enum(SOCIAL_PLATFORMS).optional().catch(undefined),
  category: z.enum(CATEGORY_SLUGS).optional().catch(undefined),
  sort: z.enum(DISCOVER_SORTS).catch("newest"),
  eligible: z.enum(["1"]).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(1000).catch(1),
});

export type DiscoverParams = z.output<typeof discoverParamsSchema>;

export function parseDiscoverParams(raw: Record<string, string | string[] | undefined>): DiscoverParams {
  const single = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  return discoverParamsSchema.parse({
    q: single(raw.q) ?? "",
    platform: single(raw.platform),
    category: single(raw.category),
    sort: single(raw.sort),
    eligible: single(raw.eligible),
    page: single(raw.page),
  });
}

export function discoverHref(params: Partial<DiscoverParams>): string {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.platform) search.set("platform", params.platform);
  if (params.category) search.set("category", params.category);
  if (params.sort && params.sort !== "newest") search.set("sort", params.sort);
  if (params.eligible) search.set("eligible", "1");
  if (params.page && params.page > 1) search.set("page", String(params.page));
  const query = search.toString();
  return query ? `/discover?${query}` : "/discover";
}
