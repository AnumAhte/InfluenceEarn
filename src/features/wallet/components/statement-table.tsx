import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import Link from "next/link";

import { StatusBadge } from "@/components/ui/status-badge";
import { cents, formatMoney } from "@/domain/money";
import { cn } from "@/lib/utils/cn";

type StatementRow = {
  id: number | null;
  entry_type: string | null;
  amount_cents: number | null;
  balance_after_cents: number | null;
  created_at: string | null;
  description: string | null;
  campaign_id: string | null;
  is_test: boolean | null;
};

const ENTRY_LABEL: Record<string, string> = {
  mock_deposit: "Test funds added",
  campaign_funding_debit: "Campaign funded",
  creator_earning: "Campaign earning",
  payout_debit: "Paid out",
  campaign_refund: "Unused budget refunded",
};

function when(value: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(value));
}

/** Ledger-backed transaction history: table on desktop, list on mobile. */
export function StatementTable({ rows }: { rows: StatementRow[] }) {
  return (
    <>
      <div className="hidden md:block">
        <table className="w-full border-collapse text-left text-[13.5px]">
          <caption className="sr-only">Wallet transactions</caption>
          <thead>
            <tr className="border-b border-line bg-canvas text-[11.5px] font-semibold tracking-[0.05em] text-ink-muted uppercase">
              <th scope="col" className="px-[22px] py-3 font-semibold">Date (UTC)</th>
              <th scope="col" className="px-3 py-3 font-semibold">Description</th>
              <th scope="col" className="px-3 py-3 text-right font-semibold">Amount</th>
              <th scope="col" className="px-[22px] py-3 text-right font-semibold">Balance</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-line-soft last:border-b-0">
                <td className="px-[22px] py-3.5 whitespace-nowrap text-ink-muted">{when(row.created_at)}</td>
                <td className="px-3 py-3.5"><Description row={row} /></td>
                <td className="px-3 py-3.5 text-right"><Amount value={row.amount_cents} /></td>
                <td className="tabular px-[22px] py-3.5 text-right text-ink-secondary">{formatMoney(cents(row.balance_after_cents ?? 0))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="divide-y divide-line-soft md:hidden">
        {rows.map((row) => (
          <li key={row.id} className="flex items-start justify-between gap-3 px-4 py-3.5">
            <div className="flex min-w-0 flex-col gap-1">
              <Description row={row} />
              <span className="text-xs text-ink-muted">{when(row.created_at)} UTC</span>
            </div>
            <div className="flex flex-col items-end gap-1">
              <Amount value={row.amount_cents} />
              <span className="tabular text-xs text-ink-muted">Bal. {formatMoney(cents(row.balance_after_cents ?? 0))}</span>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

function Description({ row }: { row: StatementRow }) {
  const credit = (row.amount_cents ?? 0) > 0;
  const Icon = credit ? ArrowDownLeft : ArrowUpRight;
  return (
    <span className="flex items-center gap-3">
      <span
        aria-hidden
        className={cn(
          "flex size-8 flex-none items-center justify-center rounded-[9px]",
          credit ? "bg-success-bg text-success-fg" : "bg-surface-muted text-ink-secondary",
        )}
      >
        <Icon className="size-4" />
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-2 font-[550]">
          {ENTRY_LABEL[row.entry_type ?? ""] ?? row.description}
          {row.is_test ? <StatusBadge tone="warning" className="px-2 py-0.5 text-[10.5px]">Test</StatusBadge> : null}
        </span>
        {row.campaign_id ? (
          <Link href={`/campaigns/${row.campaign_id}`} className="truncate text-xs text-primary-strong hover:text-primary-hover">
            {row.description?.replace(/^(Campaign funding|Payout|Unused budget refund) · /, "") ?? "View campaign"}
          </Link>
        ) : null}
      </span>
    </span>
  );
}

function Amount({ value }: { value: number | null }) {
  const amount = value ?? 0;
  return (
    <span className={cn("tabular font-semibold", amount > 0 ? "text-success-fg" : "text-ink")}>
      {amount > 0 ? "+" : "−"}
      {formatMoney(cents(Math.abs(amount)))}
    </span>
  );
}
