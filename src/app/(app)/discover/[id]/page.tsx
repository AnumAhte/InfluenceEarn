import { ArrowLeft, Check } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Callout } from "@/components/ui/callout";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Chip, StatusBadge } from "@/components/ui/status-badge";
import { CAMPAIGN_TYPE_META, categoryLabel, GENDER_LABELS, PLATFORM_META, TASK_RULES, taskLabel } from "@/domain/campaigns/catalog";
import { countryName } from "@/domain/geo/countries";
import { cents, formatMoney } from "@/domain/money";
import { requireOnboardedAccount } from "@/features/account/queries";
import { APPLICATION_STATUS_META } from "@/features/applications/status";
import { formatDate, PlatformTile } from "@/features/campaigns/components/campaign-bits";
import { ApplyPanel } from "@/features/discover/components/apply-panel";
import { getCampaignForCreator } from "@/features/discover/queries";

export const metadata: Metadata = { title: "Campaign" };

export default async function CreatorCampaignPage({ params, searchParams }: PageProps<"/discover/[id]">) {
  const { id } = await params;
  const query = await searchParams;
  const { userId } = await requireOnboardedAccount();
  const view = await getCampaignForCreator(userId, id);
  if (!view) notFound();
  if (view.isOwner) redirect(`/campaigns/${id}`);

  const { campaign, advertiserName, issues, application } = view;
  const requirements = campaign.requirements;
  const accepting = campaign.status === "applications_open" && campaign.application_deadline !== null && new Date(campaign.application_deadline) > new Date();

  return (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-6">
      <Link href="/discover" className="flex w-fit items-center gap-1.5 text-[13.5px] font-[550] text-ink-secondary hover:text-ink">
        <ArrowLeft aria-hidden className="size-4" />
        Back to campaigns
      </Link>

      {query.applied === "1" && application ? (
        <Callout tone="success">
          <span role="status">
            Application submitted. It&apos;s now <strong className="font-semibold">Pending</strong> — {advertiserName} reviews applicants by hand.{" "}
            <Link href="/applications" className="font-[550] underline">View my applications</Link>
          </span>
        </Callout>
      ) : null}

      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {campaign.platforms.map(({ platform }) => (
            <span key={platform} className="flex items-center gap-1.5 rounded-full border border-line bg-surface py-1 pr-2.5 pl-1 text-[12.5px] font-[550]">
              <PlatformTile platform={platform} />
              {PLATFORM_META[platform].label}
            </span>
          ))}
          <Chip>{categoryLabel(campaign.category_slug)}</Chip>
          {campaign.campaign_type ? <Chip>{CAMPAIGN_TYPE_META[campaign.campaign_type].label}</Chip> : null}
        </div>
        <h1 className="text-2xl font-bold tracking-[-0.03em] break-words sm:text-[30px]">{campaign.title}</h1>
        <p className="text-sm text-ink-muted">
          {advertiserName} · applications close {formatDate(campaign.application_deadline)} · tasks due {formatDate(campaign.task_deadline)}
        </p>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_380px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader><CardTitle>Campaign overview</CardTitle></CardHeader>
            <div className="flex flex-col gap-4 px-5 py-5 sm:px-6">
              <p className="text-[14.5px] leading-relaxed whitespace-pre-line text-ink-secondary">{campaign.description}</p>
              <p className="text-[13px] text-ink-muted">The advertiser selects creators by hand after reviewing applications.</p>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex flex-col gap-1">
                <CardTitle>Task instructions</CardTitle>
                <span className="text-[13px] text-ink-muted">What you deliver if you are selected.</span>
              </div>
            </CardHeader>
            <div className="flex flex-col gap-5 px-5 py-5 sm:px-6">
              <ul className="flex flex-col gap-2">
                {campaign.tasks.map((task) => (
                  <li key={task.id} className="flex flex-wrap items-center gap-3 rounded-control border border-line px-3.5 py-3 text-sm">
                    <Check aria-hidden className="size-4 text-success" strokeWidth={3} />
                    <span className="font-[550]">
                      {task.quantity} × {task.task_type === "custom" && task.custom_description ? task.custom_description : taskLabel(task.task_type, task.platform)}
                    </span>
                    <span className="ml-auto text-xs text-ink-muted">Proof: {TASK_RULES[task.task_type].proofLabel}</span>
                  </li>
                ))}
              </ul>
              {campaign.instructions ? (
                <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-ink-secondary">
                  {campaign.instructions.split("\n").filter((line) => line.trim()).map((line, index) => <li key={index}>{line}</li>)}
                </ul>
              ) : null}
              {campaign.caption_instructions ? (
                <p className="text-sm text-ink-secondary"><span className="font-[550] text-ink">Caption: </span>{campaign.caption_instructions}</p>
              ) : null}
              {campaign.hashtags.length || campaign.mentions.length ? (
                <div className="flex flex-wrap gap-1.5">{[...campaign.hashtags, ...campaign.mentions].map((tag) => <Chip key={tag}>{tag}</Chip>)}</div>
              ) : null}
              {campaign.reference_url ? (
                <a href={campaign.reference_url} target="_blank" rel="noopener noreferrer nofollow" className="text-sm font-[550] break-all text-primary-strong hover:text-primary-hover">
                  Reference: {campaign.reference_url}
                </a>
              ) : null}
              <p className="text-xs text-ink-muted">Screenshots are never required.</p>
            </div>
          </Card>

          <Card>
            <CardHeader><CardTitle>Requirements</CardTitle></CardHeader>
            <dl className="grid gap-x-6 gap-y-4 px-5 py-5 text-sm sm:grid-cols-2 sm:px-6">
              <Req label="Platforms">{campaign.platforms.map((p) => PLATFORM_META[p.platform].label).join(", ")}</Req>
              <Req label="Minimum followers">{requirements?.min_followers ? requirements.min_followers.toLocaleString("en-US") : "None"}</Req>
              <Req label="Gender">{requirements?.genders.length ? requirements.genders.map((g) => GENDER_LABELS[g]).join(", ") : "Any"}</Req>
              <Req label="Age">
                {requirements?.age_min || requirements?.age_max ? `${requirements.age_min ?? 13}–${requirements.age_max ?? "any"}` : "Any"}
              </Req>
              <Req label="Creator category">{campaign.categories.length ? campaign.categories.map((c) => categoryLabel(c.category_slug)).join(", ") : "Any"}</Req>
              <Req label="Location">
                {campaign.locations.length
                  ? campaign.locations.map((l) => [l.city, countryName(l.country_code)].filter(Boolean).join(", ")).join(" · ")
                  : "Anywhere"}
              </Req>
            </dl>
          </Card>
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-[92px]" aria-label="Apply">
          <Card className="flex flex-col gap-4 p-5 sm:p-6">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-ink-muted">Reward per creator</span>
              <span className="tabular text-[28px] font-bold tracking-[-0.03em]">
                {campaign.payment_per_creator_cents ? formatMoney(cents(campaign.payment_per_creator_cents)) : "—"}
              </span>
              <span className="text-xs text-ink-muted">Released by the agency after the advertiser approves your work.</span>
            </div>
            {application ? (
              <div className="flex flex-col gap-2 rounded-control bg-canvas p-4">
                <span className="text-[13px] text-ink-muted">Your application</span>
                <StatusBadge tone={APPLICATION_STATUS_META[application.status].tone} className="w-fit">
                  {APPLICATION_STATUS_META[application.status].creatorLabel}
                </StatusBadge>
                <span className="text-xs text-ink-muted">Applied {formatDate(application.created_at)}</span>
              </div>
            ) : (
              <ApplyPanel
                campaignId={campaign.id}
                issues={issues}
                minFollowers={requirements?.min_followers ?? null}
                acceptingApplications={accepting}
              />
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}

function Req({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="font-[550]">{children}</dd>
    </div>
  );
}
