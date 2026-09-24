import { Plus, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { requireOnboardedAccount } from "@/features/account/queries";
import { CampaignTabs } from "@/features/campaigns/components/campaign-tabs";
import { CampaignsTable } from "@/features/campaigns/components/campaigns-table";
import { CampaignsToolbar } from "@/features/campaigns/components/campaigns-toolbar";
import { campaignListHref, CAMPAIGNS_PAGE_SIZE, parseCampaignListParams } from "@/features/campaigns/list-params";
import { getMyCampaignTabCounts, listMyCampaigns } from "@/features/campaigns/queries";
import { PageHeader } from "@/features/shell/components/page-header";

export const metadata: Metadata = { title: "Campaigns" };

export default async function CampaignsPage({ searchParams }: PageProps<"/campaigns">) {
  const { userId } = await requireOnboardedAccount();
  const params = parseCampaignListParams(await searchParams);
  const [{ rows, total }, counts] = await Promise.all([listMyCampaigns(userId, params), getMyCampaignTabCounts()]);

  const hasFilters = Boolean(params.q || params.platform || params.category || params.from || params.to);
  const noCampaignsAtAll = counts.all === 0;
  const resultLine = `${total.toLocaleString("en-US")} ${total === 1 ? "campaign" : "campaigns"}`;

  return (
    <div className="mx-auto flex max-w-[1240px] flex-col gap-6">
      <PageHeader
        title="Campaigns"
        description="Create, manage, and track all your influencer campaigns."
        actions={
          <Button asChild className="shadow-primary">
            <Link href="/campaigns/new">
              <Plus aria-hidden className="size-4" />
              Create campaign
            </Link>
          </Button>
        }
      />

      {noCampaignsAtAll ? (
        <Card>
          <EmptyState
            icon={Plus}
            title="No campaigns yet."
            description="Create your first campaign to start finding creators. It stays private as a draft until you fund it."
            action={
              <Button asChild>
                <Link href="/campaigns/new">Create campaign</Link>
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          <CampaignTabs params={params} counts={counts} />
          <CampaignsToolbar resultLine={resultLine} />
          <Card className="overflow-hidden">
            {rows.length > 0 ? (
              <CampaignsTable rows={rows} />
            ) : (
              <EmptyState
                icon={Search}
                title={hasFilters ? "No campaigns match your search." : "No campaigns in this status."}
                description={
                  hasFilters
                    ? "Try another name, or clear the filters to see every campaign again."
                    : "Campaigns appear here as they move through this stage."
                }
                action={
                  hasFilters ? (
                    <Button asChild variant="secondary">
                      <Link href={campaignListHref({ tab: params.tab })}>Clear filters</Link>
                    </Button>
                  ) : undefined
                }
              />
            )}
            <Pagination
              label="Campaigns"
              page={params.page}
              pageSize={CAMPAIGNS_PAGE_SIZE}
              total={total}
              hrefFor={(page) => campaignListHref({ ...params, page })}
            />
          </Card>
        </>
      )}
    </div>
  );
}
