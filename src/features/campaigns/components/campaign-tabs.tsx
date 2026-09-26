import Link from "next/link";

import { cn } from "@/lib/utils/cn";

import { campaignListHref, type CampaignListParams } from "../list-params";
import { CAMPAIGN_TABS, type CampaignTabId } from "../status";

/** Status tabs. Scroll horizontally on small screens instead of wrapping. */
export function CampaignTabs({ params, counts }: { params: CampaignListParams; counts: Record<CampaignTabId, number> }) {
  return (
    <nav aria-label="Campaign status" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max items-center gap-1.5 border-b border-line pb-0.5">
        {CAMPAIGN_TABS.map((tab) => {
          const active = params.tab === tab.id;
          return (
            <li key={tab.id}>
              <Link
                href={campaignListHref({ ...params, tab: tab.id, page: 1 })}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "-mb-[3px] flex items-center gap-[7px] border-b-2 px-3 py-2.5 text-[13.5px] whitespace-nowrap",
                  active ? "border-primary font-[650] text-ink" : "border-transparent font-[550] text-ink-muted hover:text-ink",
                )}
              >
                {tab.label}
                <span
                  className={cn(
                    "tabular rounded-full px-[7px] py-0.5 text-[11.5px] font-semibold",
                    active ? "bg-primary-100 text-primary-hover" : "bg-surface-muted text-ink-muted",
                  )}
                >
                  {counts[tab.id]}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
