import { Megaphone } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { StatusBadge } from "@/components/ui/status-badge";
import { cents, formatMoney } from "@/domain/money";
import { requireAdmin } from "@/features/account/queries";
import { TabNav } from "@/features/admin/components/tab-nav";
import { ADMIN_PAGE_SIZE, listAllCampaigns, parsePage, parseSearch } from "@/features/admin/queries";
import { formatDate } from "@/features/campaigns/components/campaign-bits";
import { CAMPAIGN_STATUS_META, CAMPAIGN_TABS, type CampaignTabId } from "@/features/campaigns/status";
import { PageHeader } from "@/features/shell/components/page-header";

export const metadata: Metadata = { title: "All campaigns" };

function href(tab: CampaignTabId, q: string, page = 1) {
  const search = new URLSearchParams();
  if (tab !== "all") search.set("tab", tab);
  if (q) search.set("q", q);
  if (page > 1) search.set("page", String(page));
  const s = search.toString();
  return s ? `/admin/campaigns?${s}` : "/admin/campaigns";
}

/** Read-only overview of every campaign on the platform. */
export default async function AdminCampaignsPage({ searchParams }: PageProps<"/admin/campaigns">) {
  await requireAdmin();
  const query = await searchParams;
  const tab = CAMPAIGN_TABS.find((t) => t.id === query.tab) ?? CAMPAIGN_TABS[0];
  const q = parseSearch(query.q);
  const page = parsePage(query.page);
  const { rows, total } = await listAllCampaigns(tab.statuses, q, page);

  return (
    <div className="mx-auto flex max-w-[1240px] flex-col gap-6">
      <PageHeader title="Campaigns" description="Every campaign across all advertisers. Read-only." />
      <TabNav label="Campaign status" current={tab.id} tabs={CAMPAIGN_TABS.map((t) => ({ id: t.id, label: t.label, href: href(t.id, q) }))} />
      <form role="search" action="/admin/campaigns" className="flex gap-2">
        {tab.id !== "all" ? <input type="hidden" name="tab" value={tab.id} /> : null}
        <label htmlFor="q" className="sr-only">Search by title</label>
        <Input id="q" name="q" defaultValue={q} placeholder="Search by title" className="max-w-[360px]" />
        <button type="submit" className="rounded-control border border-line bg-surface px-4 text-sm font-[550] hover:bg-canvas">Search</button>
      </form>
      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState icon={Megaphone} title="No campaigns found" description="Campaigns appear here as advertisers create them." />
        ) : (
          <ul className="divide-y divide-line-soft">
            {rows.map((c) => {
              const meta = CAMPAIGN_STATUS_META[c.status];
              return (
                <li key={c.id} className="flex flex-col gap-1.5 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="flex flex-wrap items-center gap-2 text-sm font-[550]">
                      {c.title}
                      <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
                    </span>
                    <span className="text-[13px] text-ink-muted">
                      by{" "}
                      {c.owner ? (
                        <Link href={`/admin/users/${c.owner.id}`} className="font-[550] text-primary-strong hover:text-primary-hover">
                          {c.owner.full_name || "Unnamed"}
                        </Link>
                      ) : (
                        "Unknown"
                      )}
                    </span>
                  </span>
                  <span className="flex flex-wrap gap-x-4 text-xs text-ink-muted">
                    <span className="tabular">
                      {c.creators_required ?? "?"} creators × {c.payment_per_creator_cents !== null ? formatMoney(cents(c.payment_per_creator_cents)) : "not set"}
                    </span>
                    <span>Applications close {formatDate(c.application_deadline)}</span>
                    <span>Created {formatDate(c.created_at)}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        {total > ADMIN_PAGE_SIZE ? <Pagination page={page} pageSize={ADMIN_PAGE_SIZE} total={total} hrefFor={(p) => href(tab.id, q, p)} label="Campaigns" /> : null}
      </Card>
    </div>
  );
}
