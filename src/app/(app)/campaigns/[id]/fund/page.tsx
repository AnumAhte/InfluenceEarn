import { randomUUID } from "node:crypto";

import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Callout } from "@/components/ui/callout";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { categoryLabel } from "@/domain/campaigns/catalog";
import { centsToDollarInput, cents, formatMoney } from "@/domain/money";
import { calculateCampaignFunding } from "@/domain/pricing";
import { assessFunding } from "@/domain/wallet/ledger";
import { requireOnboardedAccount } from "@/features/account/queries";
import { CostBreakdown, formatDate, PlatformList } from "@/features/campaigns/components/campaign-bits";
import { FundCampaignForm } from "@/features/campaigns/components/fund-campaign-form";
import { getMyCampaign } from "@/features/campaigns/queries";
import { getWalletFundingProvider } from "@/features/payments/providers";
import { AddTestFundsForm } from "@/features/wallet/components/add-test-funds-form";
import { areTestFundsEnabled, getMyWalletBalance } from "@/features/wallet/queries";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = { title: "Fund campaign" };

export default async function FundCampaignPage({ params }: PageProps<"/campaigns/[id]/fund">) {
  const { id } = await params;
  const { userId } = await requireOnboardedAccount();
  const campaign = await getMyCampaign(userId, id);
  if (!campaign) notFound();
  if (campaign.status !== "funding_required") redirect(`/campaigns/${id}`);
  if (campaign.payment_per_creator_cents === null || campaign.creators_required === null) redirect(`/campaigns/${id}/edit`);

  // Display only — the database recomputes the same total when funding.
  const funding = calculateCampaignFunding(cents(campaign.payment_per_creator_cents), campaign.creators_required);
  const [{ availableCents }, testFundsEnabled] = await Promise.all([getMyWalletBalance(userId), areTestFundsEnabled()]);
  const assessment = assessFunding(funding.totalFunding, availableCents);
  const provider = getWalletFundingProvider();
  const canAddTestFunds = Boolean(provider?.isTestMode && testFundsEnabled);

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-6">
      <nav aria-label="Breadcrumb" className="text-[13px] text-ink-muted">
        <Link href="/campaigns" className="hover:text-ink">Campaigns</Link>
        <span aria-hidden> / </span>
        <Link href={`/campaigns/${id}`} className="hover:text-ink">{campaign.title}</Link>
        <span aria-hidden> / </span>
        <span aria-current="page">Fund</span>
      </nav>

      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-[-0.03em] sm:text-[28px]">Fund &amp; publish</h1>
        <p className="text-[15px] leading-relaxed text-ink-secondary">
          The campaign stays private until your wallet is debited. Once funded, it is published and opens for applications.
        </p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_400px]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-1">
                <span className="text-[11.5px] font-semibold tracking-[0.06em] text-ink-muted uppercase">Campaign being funded</span>
                <CardTitle>{campaign.title}</CardTitle>
              </div>
            </CardHeader>
            <dl className="grid gap-4 px-5 py-5 text-sm sm:grid-cols-3 sm:px-6">
              <SummaryItem label="Platforms"><PlatformList platforms={campaign.platforms.map((p) => p.platform)} /></SummaryItem>
              <SummaryItem label="Category">{categoryLabel(campaign.category_slug)}</SummaryItem>
              <SummaryItem label="Applications close">{formatDate(campaign.application_deadline)}</SummaryItem>
            </dl>
            <div className="px-5 pb-5 sm:px-6">
              <CostBreakdown paymentPerCreatorCents={campaign.payment_per_creator_cents} creatorsRequired={campaign.creators_required} />
            </div>
          </Card>

          <Card className="flex flex-col gap-3 px-5 py-5 sm:px-6">
            <h2 className="text-[15px] font-[650]">What happens to the money</h2>
            <ul className="flex list-disc flex-col gap-1.5 pl-5 text-[13.5px] leading-relaxed text-ink-secondary">
              <li>{formatMoney(funding.totalFunding)} is debited from your wallet balance in one step.</li>
              <li>{formatMoney(funding.creatorBudget)} is set aside for creator payments on this campaign.</li>
              <li>{formatMoney(funding.platformFee)} is the 20% platform fee.</li>
              <li>Creators are paid only after you approve their work and the agency releases the payment.</li>
            </ul>
          </Card>
        </div>

        <div className="flex flex-col gap-4 lg:sticky lg:top-[92px]">
          <Card className="flex flex-col gap-4 p-5 sm:p-6">
            <dl className="flex flex-col gap-3">
              <BalanceRow label="Required" value={formatMoney(assessment.requiredCents)} strong />
              <BalanceRow label="Available in wallet" value={formatMoney(assessment.availableCents)} />
              <div aria-hidden className="h-px bg-line" />
              {assessment.sufficient ? (
                <BalanceRow label="Balance after funding" value={formatMoney(cents(assessment.availableCents - assessment.requiredCents))} />
              ) : (
                <BalanceRow label="Shortfall" value={formatMoney(assessment.shortfallCents)} tone="danger" strong />
              )}
            </dl>

            {assessment.sufficient ? (
              <FundCampaignForm campaignId={campaign.id} idempotencyKey={randomUUID()} totalCents={funding.totalFunding} />
            ) : (
              <Callout tone="warning">
                Your wallet needs {formatMoney(assessment.shortfallCents)} more to fund this campaign.
                {canAddTestFunds ? " Add funds below." : " Adding funds isn't available yet — a payment provider has not been connected."}
              </Callout>
            )}
          </Card>

          {!assessment.sufficient && canAddTestFunds ? (
            <AddTestFundsForm idempotencyKey={randomUUID()} suggestedAmount={centsToDollarInput(assessment.shortfallCents)} />
          ) : null}

          <p className={cn("px-1 text-[12.5px] leading-normal text-ink-muted")}>
            Need changes first? <Link href={`/campaigns/${id}/edit`} className="font-[550] text-primary-strong hover:text-primary-hover">Edit the campaign</Link> — it stays editable until it is funded.
          </p>
        </div>
      </div>
    </div>
  );
}

function SummaryItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="font-[550]">{children}</dd>
    </div>
  );
}

function BalanceRow({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: "danger" }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className={cn("text-sm", strong ? "font-[650] text-ink" : "text-ink-secondary", tone === "danger" && "text-danger-fg")}>{label}</dt>
      <dd className={cn("tabular", strong ? "text-xl font-bold tracking-[-0.02em]" : "text-[15px] font-semibold", tone === "danger" && "text-danger-fg")}>
        {value}
      </dd>
    </div>
  );
}
