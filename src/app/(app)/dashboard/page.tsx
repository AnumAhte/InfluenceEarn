import { FileText, Megaphone } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { firstNameOf } from "@/features/account/onboarding";
import { requireOnboardedAccount } from "@/features/account/queries";
import { getMyCampaignTabCounts } from "@/features/campaigns/queries";
import { GettingStarted, type ChecklistStep } from "@/features/dashboard/components/getting-started";
import { PageHeader } from "@/features/shell/components/page-header";

export const metadata: Metadata = { title: "Dashboard" };

const NOTICES: Record<string, string> = {
  password_updated: "Your password has been updated.",
};

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const { profile } = await requireOnboardedAccount();
  const { notice } = await searchParams;
  const noticeMessage = typeof notice === "string" ? NOTICES[notice] : undefined;

  const firstName = firstNameOf(profile.full_name);
  const hasProfileDetails = Boolean(profile.city || profile.phone || profile.bio || profile.avatar_path);
  const isAdvertiser = profile.active_workspace === "advertiser";
  const counts = isAdvertiser ? await getMyCampaignTabCounts() : null;
  const hasCampaigns = (counts?.all ?? 0) > 0;
  const hasFundedCampaign = counts ? counts.published + counts.applications_open + counts.in_progress + counts.completed > 0 : false;

  const profileStep: ChecklistStep = {
    title: "Complete your profile",
    description: "Add your city, phone number, a short bio or a photo.",
    done: hasProfileDetails,
    action: { href: "/settings/profile", label: "Edit profile" },
  };

  const steps: ChecklistStep[] = isAdvertiser
    ? [
        { title: "Create your account", description: "One account for both roles.", done: true },
        profileStep,
        {
          title: "Create and fund your first campaign",
          description: "Set requirements and budget. It goes live once funded from your wallet.",
          done: hasFundedCampaign,
          action: hasCampaigns ? { href: "/campaigns", label: "View campaigns" } : { href: "/campaigns/new", label: "Create campaign" },
        },
      ]
    : [
        { title: "Create your account", description: "No social accounts needed to sign up.", done: true },
        profileStep,
        {
          title: "Apply to a campaign you qualify for",
          description: "Connect a social account only when a campaign requires that platform.",
          done: false,
          comingSoon: true,
        },
      ];

  return (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-7">
      {noticeMessage ? <Callout tone="success">{noticeMessage}</Callout> : null}

      <PageHeader
        title={firstName ? `Welcome back, ${firstName}` : "Welcome back"}
        description={
          isAdvertiser
            ? "Manage your campaigns, review creators, and keep your campaigns moving."
            : "Find campaigns you qualify for, complete tasks and track your payments."
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          {isAdvertiser ? (
            <EmptyState
              icon={Megaphone}
              title={hasCampaigns ? `${counts?.all} ${counts?.all === 1 ? "campaign" : "campaigns"}` : "No campaigns yet"}
              description={
                hasCampaigns
                  ? "Manage drafts, fund campaigns and track their status from the Campaigns page."
                  : "Campaigns you create will appear here with their funding status, applicants and work waiting for your review."
              }
              action={
                <Button asChild>
                  <Link href={hasCampaigns ? "/campaigns" : "/campaigns/new"}>{hasCampaigns ? "Open campaigns" : "Create campaign"}</Link>
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={FileText}
              title="No applications yet"
              description="Campaigns you apply to will appear here with their status, tasks in progress and payments released after approval."
            />
          )}
        </Card>
        <GettingStarted steps={steps} />
      </div>
    </div>
  );
}
