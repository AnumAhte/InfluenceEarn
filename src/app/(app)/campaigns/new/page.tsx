import type { Metadata } from "next";
import Link from "next/link";

import { emptyDraft } from "@/domain/campaigns/schemas";
import { CampaignWizard } from "@/features/campaigns/components/wizard/campaign-wizard";

export const metadata: Metadata = { title: "New campaign" };

export default function NewCampaignPage() {
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="mx-auto flex max-w-[1240px] flex-col gap-4">
      <nav aria-label="Breadcrumb" className="text-[13px] text-ink-muted">
        <Link href="/campaigns" className="hover:text-ink">Campaigns</Link>
        <span aria-hidden> / </span>
        <span aria-current="page">New campaign</span>
      </nav>
      <CampaignWizard initialValues={emptyDraft()} campaignId={null} today={today} />
    </div>
  );
}
