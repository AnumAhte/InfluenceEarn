import { Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireAdmin } from "@/features/account/queries";
import { TabNav } from "@/features/admin/components/tab-nav";
import { ADMIN_PAGE_SIZE, isUserFilter, listUsers, parsePage, parseSearch, type UserFilter } from "@/features/admin/queries";
import { formatDate } from "@/features/campaigns/components/campaign-bits";
import { PageHeader } from "@/features/shell/components/page-header";

export const metadata: Metadata = { title: "Users" };

const FILTER_LABEL: Record<UserFilter, string> = {
  all: "All",
  advertisers: "Advertisers",
  influencers: "Influencers",
  admins: "Admins",
  suspended: "Suspended",
};

function href(filter: UserFilter, q: string, page = 1) {
  const search = new URLSearchParams();
  if (filter !== "all") search.set("filter", filter);
  if (q) search.set("q", q);
  if (page > 1) search.set("page", String(page));
  const s = search.toString();
  return s ? `/admin/users?${s}` : "/admin/users";
}

export default async function AdminUsersPage({ searchParams }: PageProps<"/admin/users">) {
  await requireAdmin();
  const query = await searchParams;
  const filter = isUserFilter(query.filter) ? query.filter : "all";
  const q = parseSearch(query.q);
  const page = parsePage(query.page);
  const { rows, total } = await listUsers(filter, q, page);

  return (
    <div className="mx-auto flex max-w-[1240px] flex-col gap-6">
      <PageHeader title="Users" description="Every account on the platform. Open a user to review their activity or suspend the account." />
      <TabNav
        label="User filter"
        current={filter}
        tabs={(Object.keys(FILTER_LABEL) as UserFilter[]).map((f) => ({ id: f, label: FILTER_LABEL[f], href: href(f, q) }))}
      />
      <form role="search" action="/admin/users" className="flex gap-2">
        {filter !== "all" ? <input type="hidden" name="filter" value={filter} /> : null}
        <label htmlFor="q" className="sr-only">Search by name or email</label>
        <Input id="q" name="q" defaultValue={q} placeholder="Search by name or email" className="max-w-[360px]" />
        <button type="submit" className="rounded-control border border-line bg-surface px-4 text-sm font-[550] hover:bg-canvas">Search</button>
      </form>
      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState icon={Users} title="No users found" description={q ? "Try a different search." : "Users appear here once they sign up."} />
        ) : (
          <ul className="divide-y divide-line-soft">
            {rows.map((u) => (
              <li key={u.id}>
                <Link href={`/admin/users/${u.id}`} className="flex flex-col gap-1 px-4 py-3.5 hover:bg-canvas sm:flex-row sm:items-center sm:justify-between sm:px-6">
                  <span className="flex min-w-0 flex-col">
                    <span className="flex flex-wrap items-center gap-2 text-sm font-[550]">
                      {u.full_name || "Unnamed user"}
                      {u.is_admin ? <StatusBadge tone="dark">Admin</StatusBadge> : null}
                      {u.suspended_at ? <StatusBadge tone="danger">Suspended</StatusBadge> : null}
                    </span>
                    <span className="truncate text-[13px] text-ink-muted">{u.email}</span>
                  </span>
                  <span className="flex flex-wrap gap-x-4 text-xs text-ink-muted">
                    <span className="tabular">{u.campaigns_count} campaigns</span>
                    <span className="tabular">{u.applications_count} applications</span>
                    <span>Joined {formatDate(u.created_at)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {total > ADMIN_PAGE_SIZE ? <Pagination page={page} pageSize={ADMIN_PAGE_SIZE} total={total} hrefFor={(p) => href(filter, q, p)} label="Users" /> : null}
      </Card>
    </div>
  );
}
