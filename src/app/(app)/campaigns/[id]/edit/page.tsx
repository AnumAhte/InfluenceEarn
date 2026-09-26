import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { isEditable } from "@/domain/campaigns/state-machine";
import { requireOnboardedAccount } from "@/features/account/queries";
import { CampaignWizard } from "@/features/campaigns/components/wizard/campaign-wizard";
import { getMyCampaign, toDraftInput } from "@/features/campaigns/queries";

export const metadata: Metadata = { title: "Edit campaign" };

export default async function EditCampaignPage({ params }: PageProps<"/campaigns/[id]/edit">) {
  const { id } = await params;
  const { userId } = await requireOnboardedAccount();
  const campaign = await getMyCampaign(userId, id);
  if (!campaign) notFound();
  // Funded campaigns are locked (also enforced by RLS and a database trigger).
  if (!isEditable(campaign.status)) redirect(`/campaigns/${id}`);

  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="mx-auto flex max-w-[1240px] flex-col gap-4">
      <nav aria-label="Breadcrumb" className="text-[13px] text-ink-muted">
        <Link href="/campaigns" className="hover:text-ink">Campaigns</Link>
        <span aria-hidden> / </span>
        <Link href={`/campaigns/${id}`} className="hover:text-ink">{campaign.title}</Link>
        <span aria-hidden> / </span>
        <span aria-current="page">Edit</span>
      </nav>
      <CampaignWizard initialValues={toDraftInput(campaign)} campaignId={campaign.id} today={today} />
    </div>
  );
}
