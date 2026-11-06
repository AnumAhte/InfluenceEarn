import { Receipt } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { StatusBadge } from "@/components/ui/status-badge";
import { cents, formatMoney } from "@/domain/money";
import { requireAdmin } from "@/features/account/queries";
import { formatDateTime, TabNav } from "@/features/admin/components/tab-nav";
import { ADMIN_PAGE_SIZE, listLedgerTransactions, parsePage } from "@/features/admin/queries";
import { PageHeader } from "@/features/shell/components/page-header";

export const metadata: Metadata = { title: "Transactions" };

const KINDS = [
  { id: "all", label: "All", kind: null },
  { id: "campaign_funding", label: "Campaign funding", kind: "campaign_funding" },
  { id: "creator_payout", label: "Creator payouts", kind: "creator_payout" },
  { id: "campaign_refund", label: "Refunds", kind: "campaign_refund" },
  { id: "test_deposit", label: "Test deposits", kind: "test_deposit" },
] as const;

const KIND_LABEL: Record<string, string> = Object.fromEntries(KINDS.filter((k) => k.kind).map((k) => [k.kind, k.label]));

function href(tab: string, page = 1) {
  const search = new URLSearchParams();
  if (tab !== "all") search.set("kind", tab);
  if (page > 1) search.set("page", String(page));
  const s = search.toString();
  return s ? `/admin/transactions?${s}` : "/admin/transactions";
}

/** Read-only ledger journal. Every row is a balanced, append-only transaction. */
export default async function AdminTransactionsPage({ searchParams }: PageProps<"/admin/transactions">) {
  await requireAdmin();
  const query = await searchParams;
  const tab = KINDS.find((k) => k.id === query.kind) ?? KINDS[0];
  const page = parsePage(query.page);
  const { rows, total } = await listLedgerTransactions(tab.kind, page);

  return (
    <div className="mx-auto flex max-w-[1240px] flex-col gap-6">
      <PageHeader
        title="Transactions"
        description="The internal ledger: every funding, payout and refund as one balanced journal entry. Read-only."
      />
      <TabNav label="Transaction type" current={tab.id} tabs={KINDS.map((k) => ({ id: k.id, label: k.label, href: href(k.id) }))} />
      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState icon={Receipt} title="No transactions" description="Ledger entries appear here as campaigns are funded, paid out and settled." />
        ) : (
          <ul className="divide-y divide-line-soft">
            {rows.map((t) => (
              <li key={t.id} className="flex flex-col gap-1.5 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="flex flex-wrap items-center gap-2 text-sm font-[550]">
                    {KIND_LABEL[t.kind] ?? t.kind}
                    {t.is_test ? <StatusBadge tone="warning">Test</StatusBadge> : null}
                  </span>
                  <span className="text-[13px] text-ink-muted">
                    {t.description}
                    {t.initiator ? (
                      <>
                        {" · "}
                        <Link href={`/admin/users/${t.initiator.id}`} className="font-[550] text-primary-strong hover:text-primary-hover">
                          {t.initiator.full_name || "Unnamed"}
                        </Link>
                      </>
                    ) : null}
                  </span>
                </span>
                <span className="flex flex-wrap items-baseline gap-x-4 text-xs text-ink-muted">
                  <span className="tabular text-sm font-semibold text-ink">{formatMoney(cents(t.amountCents))}</span>
                  <span>{formatDateTime(t.created_at)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
        {total > ADMIN_PAGE_SIZE ? <Pagination page={page} pageSize={ADMIN_PAGE_SIZE} total={total} hrefFor={(p) => href(tab.id, p)} label="Transactions" /> : null}
      </Card>
    </div>
  );
}
