import { CheckCircle2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard } from "@/components/ui/metric-card";
import { Chip } from "@/components/ui/status-badge";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  CAMPAIGN_TYPE_META,
  categoryLabel,
  GENDER_LABELS,
  PLATFORM_META,
  TASK_RULES,
  taskLabel,
} from "@/domain/campaigns/catalog";
import { canCancel, isEditable } from "@/domain/campaigns/state-machine";
import { countryName } from "@/domain/geo/countries";
import { cents, formatMoney } from "@/domain/money";
import { calculateCampaignFunding } from "@/domain/pricing";
import { requireOnboardedAccount } from "@/features/account/queries";
import { closeApplications } from "@/features/applications/actions";
import { getApplicationCounts } from "@/features/applications/queries";
import { requestFunding } from "@/features/campaigns/actions";
import { getCampaignRefund } from "@/features/wallet/queries";
import { CampaignStatusBadge, CostBreakdown, formatDate, PlatformTile } from "@/features/campaigns/components/campaign-bits";
import { CancelCampaignButton } from "@/features/campaigns/components/cancel-campaign-button";
import { describeDbError } from "@/features/campaigns/errors";
import { getMyCampaign } from "@/features/campaigns/queries";
import { completeCampaign, startCampaignWork } from "@/features/tasks/actions";
import { getAssignmentCounts } from "@/features/tasks/queries";
import { CAMPAIGN_STATUS_META } from "@/features/campaigns/status";

export const metadata: Metadata = { title: "Campaign" };

const ERROR_COPY: Record<string, string> = {
  campaign_incomplete: "This draft isn't complete yet. Edit it and fill in every step before funding.",
  invalid_campaign_state: "That action isn't available for this campaign right now.",
  work_outstanding: "Some work is still waiting for review or can still be submitted before the deadline.",
  no_selected_creators: "Select at least one creator before starting the work.",
};

export default async function CampaignDetailPage({ params, searchParams }: PageProps<"/campaigns/[id]">) {
  const { id } = await params;
  const query = await searchParams;
  const { userId } = await requireOnboardedAccount();
  const campaign = await getMyCampaign(userId, id);
  if (!campaign) notFound();

  const editable = isEditable(campaign.status);
  const acceptsApplications = !editable && campaign.status !== "cancelled";
  const [applicationCounts, workCounts] = acceptsApplications
    ? await Promise.all([getApplicationCounts(campaign.id), getAssignmentCounts(campaign.id)])
    : [null, null];
  const workStarted = campaign.status === "in_progress" || campaign.status === "review_pending";
  const funding =
    campaign.payment_per_creator_cents !== null && campaign.creators_required !== null
      ? calculateCampaignFunding(cents(campaign.payment_per_creator_cents), campaign.creators_required)
      : null;
  const funded = campaign.funding;
  const refund = funded && campaign.status === "completed" ? await getCampaignRefund(userId, campaign.id) : null;
  const errorMessage = typeof query.error === "string" ? (ERROR_COPY[query.error] ?? describeDbError({ message: query.error }).message) : null;
  const money = (value: number | null | undefined) => (value === null || value === undefined ? "—" : formatMoney(cents(value)));

  return (
    <div className="mx-auto flex max-w-[1240px] flex-col gap-6">
      <nav aria-label="Breadcrumb" className="text-[13px] text-ink-muted">
        <Link href="/campaigns" className="hover:text-ink">Campaigns</Link>
        <span aria-hidden> / </span>
        <span aria-current="page">{campaign.title}</span>
      </nav>

      {query.funded === "1" && funded ? (
        <Callout tone="success">
          <span role="status">
            Campaign funded — {formatMoney(cents(funded.total_cents))} was debited from your wallet. It is now published and open for applications.
          </span>
        </Callout>
      ) : null}
      {errorMessage ? <Callout tone="danger">{errorMessage}</Callout> : null}

      <header className="flex flex-wrap items-start justify-between gap-5">
        <div className="flex min-w-0 flex-col gap-2.5">
          <h1 className="text-2xl font-bold tracking-[-0.03em] break-words sm:text-[28px]">{campaign.title}</h1>
          <div className="flex flex-wrap items-center gap-2">
            {campaign.platforms.map(({ platform }) => (
              <span key={platform} className="flex items-center gap-1.5 rounded-full border border-line bg-surface py-1 pr-2.5 pl-1 text-[12.5px] font-[550]">
                <PlatformTile platform={platform} />
                {PLATFORM_META[platform].label}
              </span>
            ))}
            <Chip>{categoryLabel(campaign.category_slug)}</Chip>
            <CampaignStatusBadge status={campaign.status} />
          </div>
          <p className="text-[13px] text-ink-muted">
            Created {formatDate(campaign.created_at)} · applications close {formatDate(campaign.application_deadline)} · tasks due{" "}
            {formatDate(campaign.task_deadline)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          {editable ? (
            <Button asChild variant="secondary">
              <Link href={`/campaigns/${campaign.id}/edit`}>Edit</Link>
            </Button>
          ) : null}
          {campaign.status === "draft" ? (
            <form action={requestFunding.bind(null, campaign.id)}>
              <SubmitButton pendingLabel="Checking…" className="shadow-primary">Continue to funding</SubmitButton>
            </form>
          ) : null}
          {campaign.status === "funding_required" ? (
            <Button asChild className="shadow-primary">
              <Link href={`/campaigns/${campaign.id}/fund`}>Fund &amp; publish</Link>
            </Button>
          ) : null}
          {acceptsApplications ? (
            <Button asChild className="shadow-primary">
              <Link href={`/campaigns/${campaign.id}/applicants`}>Review applicants</Link>
            </Button>
          ) : null}
          {workCounts && workCounts.all > 0 ? (
            <Button asChild variant="secondary">
              <Link href={`/campaigns/${campaign.id}/submissions${workCounts.submitted ? "?status=submitted" : ""}`}>
                Review submissions{workCounts.submitted ? ` (${workCounts.submitted})` : ""}
              </Link>
            </Button>
          ) : null}
          {campaign.status === "selection_in_progress" && workCounts && workCounts.all > 0 ? (
            <form action={startCampaignWork}>
              <input type="hidden" name="campaignId" value={campaign.id} />
              <SubmitButton variant="secondary" pendingLabel="Starting…">Start campaign work</SubmitButton>
            </form>
          ) : null}
          {workStarted ? (
            <form action={completeCampaign}>
              <input type="hidden" name="campaignId" value={campaign.id} />
              <SubmitButton variant="secondary" pendingLabel="Completing…">Mark campaign complete</SubmitButton>
            </form>
          ) : null}
          {campaign.status === "applications_open" ? (
            <form action={closeApplications}>
              <input type="hidden" name="campaignId" value={campaign.id} />
              <SubmitButton variant="secondary" pendingLabel="Closing…">Close applications</SubmitButton>
            </form>
          ) : null}
          {canCancel(campaign.status) ? <CancelCampaignButton campaignId={campaign.id} title={campaign.title} /> : null}
        </div>
      </header>

      {workCounts && workCounts.all > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Working on it" value={String(workCounts.in_progress + workCounts.revision_requested)} hint={`${workCounts.revision_requested} with changes requested`} />
          <MetricCard label="Pending reviews" value={String(workCounts.submitted)} hint="Waiting on your approval" tone={workCounts.submitted ? "attention" : "default"} />
          <MetricCard label="Approved" value={String(workCounts.approved + workCounts.payout_pending + workCounts.paid)} hint="Ready for payout by the agency" />
          <MetricCard label="Rejected or expired" value={String(workCounts.rejected + workCounts.expired)} hint="No payment released" />
        </div>
      ) : null}

      {applicationCounts ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Applications" value={applicationCounts.all.toLocaleString("en-US")} hint={`${applicationCounts.pending} waiting for review`} />
          <MetricCard label="Shortlisted" value={applicationCounts.shortlisted.toLocaleString("en-US")} hint="Chosen by you for a closer look" />
          <MetricCard
            label="Selected"
            value={`${applicationCounts.selected} / ${campaign.creators_required ?? 0}`}
            hint="Selected by you manually"
            tone={campaign.creators_required !== null && applicationCounts.selected >= campaign.creators_required ? "default" : "attention"}
          />
          <MetricCard label="Rejected" value={applicationCounts.rejected.toLocaleString("en-US")} hint="Not selected" />
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Creators needed" value={campaign.creators_required?.toLocaleString("en-US") ?? "—"} hint="Selected by you from applicants" />
        <MetricCard label="Payment per creator" value={money(campaign.payment_per_creator_cents)} hint="Released after you approve their work" />
        <MetricCard label="Creator budget" value={money(funding?.creatorBudget)} hint={`+ ${money(funding?.platformFee)} platform fee (20%)`} />
        <MetricCard
          label={funded ? "Total funded" : "Total funding required"}
          value={money(funded?.total_cents ?? funding?.totalFunding)}
          hint={funded ? `Funded ${formatDate(funded.created_at)}` : "Debited from your wallet at publishing"}
          tone="dark"
        />
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_380px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader><CardTitle>Campaign information</CardTitle></CardHeader>
            <div className="flex flex-col gap-5 px-5 py-5 sm:px-6">
              <div className="flex flex-col gap-1.5">
                <h3 className="text-[13px] font-semibold text-ink-muted">Description</h3>
                <p className="text-[14.5px] leading-relaxed whitespace-pre-line text-ink-secondary">{campaign.description || "No description yet."}</p>
              </div>
              <dl className="grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
                <Info label="Campaign type">{campaign.campaign_type ? CAMPAIGN_TYPE_META[campaign.campaign_type].label : "Not set"}</Info>
                <Info label="Category">{categoryLabel(campaign.category_slug)}</Info>
                <Info label="Application deadline">{formatDate(campaign.application_deadline)}</Info>
                <Info label="Task deadline">{formatDate(campaign.task_deadline)}</Info>
              </dl>
            </div>
          </Card>

          <Card>
            <CardHeader><CardTitle>Eligibility</CardTitle></CardHeader>
            <dl className="grid gap-x-6 gap-y-4 px-5 py-5 text-sm sm:grid-cols-2 sm:px-6">
              <Info label="Minimum followers">{campaign.requirements?.min_followers ? campaign.requirements.min_followers.toLocaleString("en-US") : "No minimum"}</Info>
              <Info label="Gender">{campaign.requirements?.genders.length ? campaign.requirements.genders.map((g) => GENDER_LABELS[g]).join(", ") : "Any"}</Info>
              <Info label="Age">{ageText(campaign.requirements?.age_min ?? null, campaign.requirements?.age_max ?? null)}</Info>
              <Info label="Creator categories">{campaign.categories.length ? campaign.categories.map((c) => categoryLabel(c.category_slug)).join(", ") : "Any"}</Info>
              <Info label="Location" wide>
                {campaign.locations.length
                  ? campaign.locations.map((l) => [l.city, l.region, countryName(l.country_code)].filter(Boolean).join(", ")).join(" · ")
                  : "Anywhere"}
              </Info>
            </dl>
            <p className="border-t border-line-soft px-5 py-3 text-[12.5px] text-ink-muted sm:px-6">
              Follower counts aren&apos;t verified automatically. You check each creator&apos;s linked account before selecting them.
            </p>
          </Card>

          <Card>
            <CardHeader><CardTitle>Deliverables &amp; instructions</CardTitle></CardHeader>
            <div className="flex flex-col gap-5 px-5 py-5 sm:px-6">
              {campaign.tasks.length ? (
                <ul className="flex flex-col gap-2">
                  {campaign.tasks.map((task) => (
                    <li key={task.id} className="flex flex-wrap items-center gap-3 rounded-control border border-line px-3.5 py-3 text-sm">
                      <PlatformTile platform={task.platform} />
                      <span className="font-[550]">
                        {task.quantity} × {task.task_type === "custom" && task.custom_description ? task.custom_description : taskLabel(task.task_type, task.platform)}
                      </span>
                      <span className="ml-auto text-xs text-ink-muted">Proof: {TASK_RULES[task.task_type].proofLabel}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-ink-muted">No tasks yet.</p>
              )}
              {campaign.instructions ? (
                <div className="flex flex-col gap-1.5">
                  <h3 className="text-[13px] font-semibold text-ink-muted">Instructions</h3>
                  <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-ink-secondary">
                    {campaign.instructions.split("\n").filter((line) => line.trim()).map((line, index) => (
                      <li key={index}>{line}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {campaign.caption_instructions ? (
                <div className="flex flex-col gap-1.5">
                  <h3 className="text-[13px] font-semibold text-ink-muted">Caption</h3>
                  <p className="text-sm whitespace-pre-line text-ink-secondary">{campaign.caption_instructions}</p>
                </div>
              ) : null}
              {campaign.hashtags.length || campaign.mentions.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {[...campaign.hashtags, ...campaign.mentions].map((tag) => <Chip key={tag}>{tag}</Chip>)}
                </div>
              ) : null}
              {campaign.reference_url ? (
                <a href={campaign.reference_url} target="_blank" rel="noopener noreferrer nofollow" className="text-sm font-[550] break-all text-primary-strong hover:text-primary-hover">
                  Reference: {campaign.reference_url}
                </a>
              ) : null}
            </div>
          </Card>
        </div>

        <div className="flex flex-col gap-6 lg:sticky lg:top-[92px]">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-1">
                <CardTitle>Campaign funding</CardTitle>
                <span className="text-[13px] text-ink-muted">Paid upfront from your wallet before publishing</span>
              </div>
            </CardHeader>
            <div className="flex flex-col gap-4 px-5 py-5 sm:px-6">
              <CostBreakdown
                paymentPerCreatorCents={campaign.payment_per_creator_cents}
                creatorsRequired={campaign.creators_required}
                totalLabel={funded ? "Debited from wallet" : "Total to fund"}
              />
              {funded ? (
                <p className="flex items-center gap-2 text-[13.5px] font-[550] text-success-fg">
                  <CheckCircle2 aria-hidden className="size-4" />
                  Funded {formatDate(funded.created_at)} from your wallet
                </p>
              ) : null}
              {refund ? (
                <p className="text-[13.5px] text-ink-muted">
                  <span className="font-[550] text-ink">{formatMoney(refund.amountCents)}</span> of unused creator budget was returned to
                  your wallet on {formatDate(refund.createdAt)}. The platform fee isn&apos;t refunded.
                </p>
              ) : null}
              {funded ? null : campaign.status === "cancelled" ? (
                <p className="text-[13.5px] text-ink-muted">This campaign was cancelled before funding. Nothing was charged.</p>
              ) : (
                <Callout tone="warning">
                  Not published yet. It goes live for influencers once it is funded. You can keep editing until then.
                </Callout>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader><CardTitle>Timeline</CardTitle></CardHeader>
            <ol className="flex flex-col gap-4 px-5 py-5 sm:px-6">
              {campaign.events.map((event, index) => (
                <li key={index} className="flex gap-3">
                  <span aria-hidden className="mt-1.5 size-2 flex-none rounded-full bg-primary" />
                  <span className="flex flex-col gap-0.5">
                    <span className="text-sm font-[550]">
                      {event.from_status === null ? "Created as draft" : CAMPAIGN_STATUS_META[event.to_status].label}
                    </span>
                    <span className="text-xs text-ink-muted">
                      {new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(event.created_at))} UTC
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Info({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "flex flex-col gap-1 sm:col-span-2" : "flex flex-col gap-1"}>
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="font-[550]">{children}</dd>
    </div>
  );
}

function ageText(min: number | null, max: number | null) {
  if (min === null && max === null) return "Any";
  if (min !== null && max !== null) return `${min}–${max}`;
  return min !== null ? `${min}+` : `Up to ${max}`;
}
