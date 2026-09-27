import { Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { CreatorCampaignCard } from "@/features/discover/components/creator-campaign-card";
import { DiscoverToolbar } from "@/features/discover/components/discover-toolbar";
import { DISCOVER_PAGE_SIZE, discoverHref, parseDiscoverParams } from "@/features/discover/list-params";
import { discoverCampaigns } from "@/features/discover/queries";
import { PageHeader } from "@/features/shell/components/page-header";

export const metadata: Metadata = { title: "Find campaigns" };

export default async function DiscoverPage({ searchParams }: PageProps<"/discover">) {
  const params = parseDiscoverParams(await searchParams);
  const { rows, total } = await discoverCampaigns(params);
  const filtered = Boolean(params.q || params.platform || params.category || params.eligible);

  return (
    <div className="mx-auto flex max-w-[1240px] flex-col gap-6">
      <PageHeader
        title="Find campaigns"
        description="Funded campaigns open for applications. Requirements are shown upfront."
        actions={
          <Button asChild variant="secondary">
            <Link href="/settings/social">Social accounts</Link>
          </Button>
        }
      />
      <DiscoverToolbar resultLine={`${total.toLocaleString("en-US")} ${total === 1 ? "campaign" : "campaigns"}`} />

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={Search}
            title={filtered ? "No campaigns match these filters" : "No campaigns are open right now"}
            description={
              filtered
                ? "Try a different platform or category, or clear the filters to see everything open right now."
                : "New campaigns appear here as soon as advertisers fund them. Check back soon."
            }
            action={
              filtered ? (
                <Button asChild variant="secondary">
                  <Link href="/discover">Clear filters</Link>
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <>
          <ul className="grid gap-4 sm:gap-5 lg:grid-cols-2">
            {rows.map((row) => (
              <CreatorCampaignCard key={row.id} row={row} />
            ))}
          </ul>
          <Card className="overflow-hidden">
            <Pagination
              label="Campaigns"
              page={params.page}
              pageSize={DISCOVER_PAGE_SIZE}
              total={total}
              hrefFor={(page) => discoverHref({ ...params, page })}
            />
          </Card>
        </>
      )}
    </div>
  );
}
