import { History } from "lucide-react";
import type { Metadata } from "next";

import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { cents, formatMoney } from "@/domain/money";
import { requireAdmin } from "@/features/account/queries";
import { ACTIVITY_PAGE_SIZE, listAdminActivity } from "@/features/payouts/queries";
import { PageHeader } from "@/features/shell/components/page-header";

export const metadata: Metadata = { title: "Activity log" };

const ACTION_LABEL: Record<string, string> = {
  "payout.release": "Released payout",
  "payout.paid": "Payout paid",
  "payout.failed": "Payout failed",
  "payout.hold": "Put payout on hold",
};

function describe(details: unknown): string {
  if (!details || typeof details !== "object") return "";
  const d = details as Record<string, unknown>;
  const parts: string[] = [];
  if (typeof d.amount_cents === "number") parts.push(formatMoney(cents(d.amount_cents)));
  if (typeof d.attempt === "number") parts.push(`attempt ${d.attempt}`);
  if (typeof d.reason === "string" && d.reason) parts.push(`“${d.reason}”`);
  if (typeof d.provider_reference === "string" && d.provider_reference) parts.push(`ref ${d.provider_reference}`);
  return parts.join(" · ");
}

/** Append-only record of admin actions (read-only; nobody can edit or delete entries). */
export default async function ActivityPage({ searchParams }: PageProps<"/admin/activity">) {
  await requireAdmin();
  const query = await searchParams;
  const page = Math.max(1, Number.parseInt(typeof query.page === "string" ? query.page : "1", 10) || 1);
  const { rows, total } = await listAdminActivity(page);

  return (
    <div className="mx-auto flex max-w-[1080px] flex-col gap-6">
      <PageHeader title="Activity log" description="Every payout action taken by an agency admin. Entries can't be edited or deleted." />
      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState icon={History} title="No admin activity yet" description="Holds, releases and payout results are recorded here." />
        ) : (
          <ul className="divide-y divide-line-soft">
            {rows.map((row) => (
              <li key={row.id} className="flex flex-col gap-0.5 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-[550]">
                    {ACTION_LABEL[row.action] ?? row.action}
                    <span className="font-normal text-ink-muted"> · {row.actor?.full_name || "Admin"}</span>
                  </span>
                  <span className="text-xs text-ink-muted">{describe(row.details)}</span>
                </div>
                <span className="text-xs whitespace-nowrap text-ink-muted">
                  {new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(row.created_at))} UTC
                </span>
              </li>
            ))}
          </ul>
        )}
        <Pagination label="Activity" page={page} pageSize={ACTIVITY_PAGE_SIZE} total={total} hrefFor={(p) => (p > 1 ? `/admin/activity?page=${p}` : "/admin/activity")} />
      </Card>
    </div>
  );
}
