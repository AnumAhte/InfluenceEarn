import Link from "next/link";

import { categoryLabel } from "@/domain/campaigns/catalog";
import { cents, formatMoney } from "@/domain/money";
import { calculateCampaignFunding } from "@/domain/pricing";

import type { CampaignListRow } from "../queries";
import { CampaignStatusBadge, formatDate, PlatformList } from "./campaign-bits";

function budgetText(row: CampaignListRow) {
  if (!row.payment_per_creator_cents || !row.creators_required) return "—";
  return formatMoney(cents(calculateCampaignFunding(cents(row.payment_per_creator_cents), row.creators_required).creatorBudget), {
    showCents: false,
  });
}

function primaryAction(row: CampaignListRow) {
  if (row.status === "draft") return { label: "Continue", href: `/campaigns/${row.id}/edit` };
  if (row.status === "funding_required") return { label: "Fund", href: `/campaigns/${row.id}/fund` };
  return { label: "View", href: `/campaigns/${row.id}` };
}

function deadlineText(row: CampaignListRow) {
  if (row.status === "draft") return "not published yet";
  if (row.status === "funding_required") return "waiting for funding";
  return row.application_deadline ? `closes ${formatDate(row.application_deadline)}` : "no deadline set";
}

/**
 * Campaign rows: a table from `lg`, stacked cards below. Application counts are not
 * shown because applications don't exist until the next phase.
 */
export function CampaignsTable({ rows }: { rows: CampaignListRow[] }) {
  return (
    <>
      <div className="hidden lg:block">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">Your campaigns</caption>
          <thead>
            <tr className="border-b border-line bg-canvas text-[11.5px] font-semibold tracking-[0.05em] text-ink-muted uppercase">
              <th scope="col" className="px-[22px] py-[13px] font-semibold">Campaign</th>
              <th scope="col" className="px-3 py-[13px] font-semibold">Platform</th>
              <th scope="col" className="px-3 py-[13px] font-semibold">Creators</th>
              <th scope="col" className="px-3 py-[13px] font-semibold">Creator budget</th>
              <th scope="col" className="px-3 py-[13px] font-semibold">Status</th>
              <th scope="col" className="px-3 py-[13px] font-semibold">Created</th>
              <th scope="col" className="px-[22px] py-[13px] text-right font-semibold">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const action = primaryAction(row);
              return (
                <tr key={row.id} className="border-b border-line-soft text-[13.5px] last:border-b-0 hover:bg-[#FBFDFC]">
                  <td className="max-w-[320px] px-[22px] py-[15px]">
                    <Link href={`/campaigns/${row.id}`} className="block font-semibold tracking-[-0.01em] text-ink hover:text-primary-hover">
                      {row.title}
                    </Link>
                    <span className="text-xs text-ink-muted">
                      {categoryLabel(row.category_slug)} · {deadlineText(row)}
                    </span>
                  </td>
                  <td className="px-3 py-[15px]">
                    <PlatformList platforms={row.platforms.map((p) => p.platform)} />
                  </td>
                  <td className="tabular px-3 py-[15px] text-ink-secondary">{row.creators_required ?? "—"}</td>
                  <td className="tabular px-3 py-[15px] font-semibold">{budgetText(row)}</td>
                  <td className="px-3 py-[15px]">
                    <CampaignStatusBadge status={row.status} />
                  </td>
                  <td className="px-3 py-[15px] text-[13px] text-ink-muted">{formatDate(row.created_at)}</td>
                  <td className="px-[22px] py-[15px] text-right">
                    <Link href={action.href} className="text-[13px] font-[550] text-primary-strong hover:text-primary-hover">
                      {action.label}
                      <span className="sr-only"> {row.title}</span>
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ul className="flex flex-col divide-y divide-line-soft lg:hidden">
        {rows.map((row) => {
          const action = primaryAction(row);
          return (
            <li key={row.id} className="flex flex-col gap-3 px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-1">
                  <Link href={`/campaigns/${row.id}`} className="font-semibold tracking-[-0.01em] text-ink">
                    {row.title}
                  </Link>
                  <span className="text-xs text-ink-muted">
                    {categoryLabel(row.category_slug)} · created {formatDate(row.created_at)}
                  </span>
                </div>
                <CampaignStatusBadge status={row.status} />
              </div>
              <dl className="grid grid-cols-3 gap-2 rounded-control bg-canvas p-3 text-xs">
                <div className="flex flex-col gap-1">
                  <dt className="text-ink-muted">Platforms</dt>
                  <dd><PlatformList platforms={row.platforms.map((p) => p.platform)} /></dd>
                </div>
                <div className="flex flex-col gap-1">
                  <dt className="text-ink-muted">Creators</dt>
                  <dd className="tabular font-semibold">{row.creators_required ?? "—"}</dd>
                </div>
                <div className="flex flex-col gap-1">
                  <dt className="text-ink-muted">Budget</dt>
                  <dd className="tabular font-semibold">{budgetText(row)}</dd>
                </div>
              </dl>
              <Link
                href={action.href}
                className="inline-flex h-11 items-center justify-center rounded-control border border-line bg-surface text-sm font-[550] text-ink hover:bg-canvas"
              >
                {action.label === "View" ? "View campaign" : action.label === "Fund" ? "Fund & publish" : "Continue editing"}
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
