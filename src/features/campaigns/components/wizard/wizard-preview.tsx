"use client";

import { useWatch, type Control } from "react-hook-form";

import { CAMPAIGN_TYPE_META, categoryLabel, PLATFORM_META, taskLabel } from "@/domain/campaigns/catalog";
import { paymentCents, type CampaignDraftInput } from "@/domain/campaigns/schemas";
import { cents, formatMoney } from "@/domain/money";

import { CostBreakdown, formatDate } from "../campaign-bits";

/** "Creator's view" preview and running total, as in the approved wizard design. */
export function WizardPreview({ control }: { control: Control<CampaignDraftInput> }) {
  const values = useWatch({ control });
  const amount = paymentCents({ paymentPerCreator: values.paymentPerCreator ?? "" });
  const creators = typeof values.creatorsRequired === "number" && Number.isFinite(values.creatorsRequired) ? values.creatorsRequired : null;
  const minFollowers = values.eligibility?.minFollowers;

  return (
    <aside aria-label="Creator's view preview" className="flex flex-col gap-4 lg:sticky lg:top-[92px]">
      <div className="overflow-hidden rounded-card border border-line bg-surface shadow-xs">
        <div className="flex items-center justify-between gap-3 border-b border-line px-[18px] py-3.5">
          <span className="text-[11.5px] font-semibold tracking-[0.06em] text-ink-muted uppercase">Creator&apos;s view</span>
          <span className="rounded-full bg-primary-100 px-[9px] py-[3px] text-[11.5px] font-semibold text-primary-hover">Live preview</span>
        </div>
        <div className="flex flex-col gap-3.5 p-[18px]">
          <div className="flex flex-col gap-2">
            <span className="flex flex-wrap gap-1.5">
              <span className="rounded-full bg-primary-100 px-[9px] py-[3px] text-[11.5px] font-semibold text-primary-hover">{categoryLabel(values.categorySlug)}</span>
              <span className="rounded-full bg-surface-muted px-[9px] py-[3px] text-[11.5px] font-semibold text-ink-secondary">
                {values.campaignType ? CAMPAIGN_TYPE_META[values.campaignType].label : "No type"}
              </span>
            </span>
            <span className="text-[17px] leading-[1.3] font-[650] tracking-[-0.02em] break-words">{values.title || "Untitled campaign"}</span>
          </div>
          <p className="line-clamp-4 text-[13.5px] leading-relaxed text-ink-secondary">{values.description || "No description yet."}</p>
          <dl className="grid grid-cols-2 gap-2.5">
            <PreviewStat label="Payment" value={amount !== null ? formatMoney(cents(amount)) : "—"} />
            <PreviewStat label="Creators" value={creators !== null ? creators.toLocaleString("en-US") : "—"} />
            <PreviewStat label="Min followers" value={minFollowers ? minFollowers.toLocaleString("en-US") : "None"} />
            <PreviewStat label="Apply by" value={formatDate(values.applicationDeadline ? `${values.applicationDeadline}T00:00:00Z` : null)} />
          </dl>
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold tracking-[0.05em] text-ink-muted uppercase">Platforms</span>
            <span className="text-[13.5px]">
              {values.platforms?.length ? values.platforms.map((p) => (p ? PLATFORM_META[p].label : "")).join(" · ") : "None selected"}
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold tracking-[0.05em] text-ink-muted uppercase">Deliverables</span>
            {values.tasks?.length ? (
              <ul className="flex flex-col gap-1.5">
                {values.tasks.map((task, index) =>
                  task?.platform && task.taskType ? (
                    <li key={index} className="flex gap-[9px] text-[13.5px] leading-normal">
                      <span aria-hidden className="mt-[7px] size-[5px] flex-none rounded-full bg-primary" />
                      {task.quantity || 1} × {task.taskType === "custom" && task.customDescription ? task.customDescription : taskLabel(task.taskType, task.platform)}
                    </li>
                  ) : null,
                )}
              </ul>
            ) : (
              <span className="text-[13.5px] text-ink-muted">No tasks yet</span>
            )}
          </div>
          <span aria-hidden className="flex h-11 items-center justify-center rounded-control border border-line bg-canvas text-sm font-[550] text-ink-subtle">
            Apply to campaign
          </span>
        </div>
      </div>

      <CostBreakdown paymentPerCreatorCents={amount} creatorsRequired={creators} totalLabel="Total" className="bg-surface shadow-xs" />
      <p className="px-1 text-[12.5px] leading-normal text-ink-muted">
        Debited from your wallet once, when you publish. Creator payments are released per approved submission.
      </p>
    </aside>
  );
}

function PreviewStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-[3px] rounded-control bg-canvas px-[13px] py-[11px]">
      <dt className="text-[11px] font-semibold tracking-[0.05em] text-ink-muted uppercase">{label}</dt>
      <dd className="tabular text-[15px] font-[650]">{value}</dd>
    </div>
  );
}
