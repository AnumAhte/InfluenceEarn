import { ExternalLink, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Callout } from "@/components/ui/callout";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { StatusBadge } from "@/components/ui/status-badge";
import { SubmitButton } from "@/components/ui/submit-button";
import { APPLICATION_STATUSES } from "@/domain/applications/state-machine";
import { categoryLabel, GENDER_LABELS, PLATFORM_META } from "@/domain/campaigns/catalog";
import { displayHandle, formatFollowers } from "@/domain/creators/social";
import { countryName } from "@/domain/geo/countries";
import { requireOnboardedAccount } from "@/features/account/queries";
import { closeApplications } from "@/features/applications/actions";
import { ApplicantsToolbar } from "@/features/applications/components/applicants-toolbar";
import { DecisionButtons } from "@/features/applications/components/decision-buttons";
import {
  APPLICANTS_PAGE_SIZE,
  applicantsHref,
  getApplicationCounts,
  listApplicants,
  parseApplicantParams,
  type ApplicantRow,
} from "@/features/applications/queries";
import { APPLICATION_STATUS_META } from "@/features/applications/status";
import { CampaignStatusBadge, formatDate, PlatformTile } from "@/features/campaigns/components/campaign-bits";
import { getMyCampaign } from "@/features/campaigns/queries";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = { title: "Applicants" };

export default async function ApplicantsPage({ params, searchParams }: PageProps<"/campaigns/[id]/applicants">) {
  const { id } = await params;
  const filters = parseApplicantParams(await searchParams);
  const { userId } = await requireOnboardedAccount();
  const campaign = await getMyCampaign(userId, id);
  if (!campaign) notFound();

  const [{ rows, total }, counts] = await Promise.all([listApplicants(id, filters), getApplicationCounts(id)]);
  const selectionOpen = campaign.status === "applications_open" || campaign.status === "selection_in_progress";
  const needed = campaign.creators_required ?? 0;
  const capacityReached = counts.selected >= needed;
  const platforms = campaign.platforms.map((p) => p.platform);

  return (
    <div className="mx-auto flex max-w-[1240px] flex-col gap-6">
      <nav aria-label="Breadcrumb" className="text-[13px] text-ink-muted">
        <Link href="/campaigns" className="hover:text-ink">Campaigns</Link>
        <span aria-hidden> / </span>
        <Link href={`/campaigns/${id}`} className="hover:text-ink">{campaign.title}</Link>
        <span aria-hidden> / </span>
        <span aria-current="page">Applicants</span>
      </nav>

      <header className="flex flex-wrap items-end justify-between gap-5">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-[-0.03em] sm:text-[28px]">Applicants</h1>
          <p className="flex flex-wrap items-center gap-2 text-[15px] text-ink-secondary">
            You review and select every creator yourself. <CampaignStatusBadge status={campaign.status} />
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <p className="tabular rounded-control bg-surface px-3.5 py-2 text-sm font-semibold shadow-xs ring-1 ring-line">
            Selected {counts.selected} of {needed}
          </p>
          {campaign.status === "applications_open" ? (
            <form action={closeApplications}>
              <input type="hidden" name="campaignId" value={id} />
              <input type="hidden" name="returnTo" value={`/campaigns/${id}/applicants`} />
              <SubmitButton variant="secondary" pendingLabel="Closing…">Close applications</SubmitButton>
            </form>
          ) : null}
        </div>
      </header>

      {!selectionOpen ? <Callout tone="neutral">Selection is closed for this campaign.</Callout> : null}
      {selectionOpen && capacityReached ? (
        <Callout tone="success">You&apos;ve selected every creator this campaign needs.</Callout>
      ) : null}

      <nav aria-label="Application status" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex min-w-max gap-1.5 border-b border-line pb-0.5">
          {[undefined, ...APPLICATION_STATUSES].map((s) => {
            const active = filters.status === s;
            return (
              <li key={s ?? "all"}>
                <Link
                  href={applicantsHref(id, { ...filters, status: s, page: 1 })}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "-mb-[3px] flex items-center gap-[7px] border-b-2 px-3 py-2.5 text-[13.5px]",
                    active ? "border-primary font-[650] text-ink" : "border-transparent font-[550] text-ink-muted hover:text-ink",
                  )}
                >
                  {s ? APPLICATION_STATUS_META[s].label : "All"}
                  <span className="tabular rounded-full bg-surface-muted px-[7px] py-0.5 text-[11.5px] font-semibold">{counts[s ?? "all"]}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <ApplicantsToolbar platforms={platforms} resultLine={`${total.toLocaleString("en-US")} ${total === 1 ? "applicant" : "applicants"}`} />

      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState
            icon={Users}
            title={counts.all === 0 ? "No applications yet." : "No applicants match these filters."}
            description={
              counts.all === 0
                ? "Influencers who meet your requirements appear here as they apply."
                : "Try a different status, search or follower filter."
            }
          />
        ) : (
          <ul className="divide-y divide-line-soft">
            {rows.map((row) => (
              <ApplicantItem
                key={row.id}
                row={row}
                campaignId={id}
                selectionOpen={selectionOpen}
                capacityReached={capacityReached}
              />
            ))}
          </ul>
        )}
        <Pagination
          label="Applicants"
          page={filters.page}
          pageSize={APPLICANTS_PAGE_SIZE}
          total={total}
          hrefFor={(page) => applicantsHref(id, { ...filters, page })}
        />
      </Card>

      <p className="px-1 text-[12.5px] leading-relaxed text-ink-muted">
        Follower counts come from the influencer&apos;s linked social account details and are self-reported. Open the linked
        account to check the numbers before you select.
      </p>
    </div>
  );
}

function ApplicantItem({
  row,
  campaignId,
  selectionOpen,
  capacityReached,
}: {
  row: ApplicantRow;
  campaignId: string;
  selectionOpen: boolean;
  capacityReached: boolean;
}) {
  const meta = APPLICATION_STATUS_META[row.status];
  const facts = [
    row.creator_city,
    row.creator_country_code ? countryName(row.creator_country_code) : null,
    row.creator_age ? `${row.creator_age} yrs` : null,
    row.creator_gender ? GENDER_LABELS[row.creator_gender] : null,
  ].filter(Boolean);

  return (
    <li className="flex flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-start">
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold tracking-[-0.01em]">{row.creator_name}</span>
          <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
          <span className="text-xs text-ink-muted">Applied {formatDate(row.created_at)}</span>
        </div>
        {facts.length ? <p className="text-[13px] text-ink-secondary">{facts.join(" · ")}</p> : null}
        <ul className="flex flex-wrap gap-2">
          {row.accounts.map((account) => (
            <li key={account.platform}>
              <a
                href={account.profile_url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="flex items-center gap-2 rounded-control border border-line px-2.5 py-1.5 text-[13px] hover:bg-canvas"
              >
                <PlatformTile platform={account.platform} />
                <span className="font-[550]">{displayHandle(account.platform, account.handle)}</span>
                <span className="tabular text-ink-muted">{formatFollowers(account.follower_count)}</span>
                <ExternalLink aria-hidden className="size-3 text-ink-muted" />
                <span className="sr-only">(opens {PLATFORM_META[account.platform].label})</span>
              </a>
            </li>
          ))}
        </ul>
        {row.creator_categories.length ? (
          <p className="text-xs text-ink-muted">{row.creator_categories.map((c) => categoryLabel(c)).join(", ")}</p>
        ) : null}
        {row.pitch ? <p className="max-w-[640px] rounded-control bg-canvas px-3.5 py-2.5 text-[13.5px] leading-relaxed text-ink-secondary">“{row.pitch}”</p> : null}
      </div>
      <DecisionButtons
        applicationId={row.id}
        campaignId={campaignId}
        status={row.status}
        applicantName={row.creator_name}
        selectionOpen={selectionOpen}
        capacityReached={capacityReached}
      />
    </li>
  );
}
