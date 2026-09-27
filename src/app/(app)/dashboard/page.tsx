import { FileText, Megaphone } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { firstNameOf } from "@/features/account/onboarding";
import { requireOnboardedAccount } from "@/features/account/queries";
import { listMyApplications } from "@/features/applications/queries";
import { getMyCampaignTabCounts } from "@/features/campaigns/queries";
import { getMyCreatorDetails } from "@/features/creators/queries";
import { listMySocialAccounts } from "@/features/social/queries";
import { GettingStarted, type ChecklistStep } from "@/features/dashboard/components/getting-started";
import { PageHeader } from "@/features/shell/components/page-header";

export const metadata: Metadata = { title: "Dashboard" };

const NOTICES: Record<string, string> = {
  password_updated: "Your password has been updated.",
};

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const { profile, userId } = await requireOnboardedAccount();
  const { notice } = await searchParams;
  const noticeMessage = typeof notice === "string" ? NOTICES[notice] : undefined;

  const firstName = firstNameOf(profile.full_name);
  const hasProfileDetails = Boolean(profile.city || profile.phone || profile.bio || profile.avatar_path);
  const isAdvertiser = profile.active_workspace === "advertiser";
  const counts = isAdvertiser ? await getMyCampaignTabCounts() : null;
  const hasCampaigns = (counts?.all ?? 0) > 0;
  const hasFundedCampaign = counts ? counts.published + counts.applications_open + counts.in_progress + counts.completed > 0 : false;
  const [socialAccounts, creatorDetails, myApplications] = isAdvertiser
    ? [[], null, null]
    : await Promise.all([listMySocialAccounts(userId), getMyCreatorDetails(userId), listMyApplications(userId, undefined, 1)]);
  const hasCreatorDetails = Boolean(
    creatorDetails && (creatorDetails.countryCode || creatorDetails.dateOfBirth || creatorDetails.categories.length),
  );
  const applicationCount = myApplications?.total ?? 0;

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
        profileStep,
        {
          title: "Add your creator details",
          description: "Country, age, gender and categories — used only to check campaign requirements.",
          done: hasCreatorDetails,
          action: { href: "/settings/creator", label: "Add details" },
        },
        {
          title: "Connect a social account",
          description: "Only needed for campaigns that require that platform. Follower counts are self-reported.",
          done: socialAccounts.length > 0,
          action: { href: "/settings/social", label: "Connect" },
        },
        {
          title: "Apply to a campaign you qualify for",
          description: "Advertisers review every applicant by hand.",
          done: applicationCount > 0,
          action: { href: "/discover", label: "Find campaigns" },
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
              title={applicationCount > 0 ? `${applicationCount} ${applicationCount === 1 ? "application" : "applications"}` : "No applications yet"}
              description={
                applicationCount > 0
                  ? "Track where each application stands. You'll be notified when an advertiser selects you."
                  : "Campaigns you apply to will appear here with their status. Browse the open campaigns to get started."
              }
              action={
                <Button asChild>
                  <Link href={applicationCount > 0 ? "/applications" : "/discover"}>
                    {applicationCount > 0 ? "My applications" : "Find campaigns"}
                  </Link>
                </Button>
              }
            />
          )}
        </Card>
        <GettingStarted steps={steps} />
      </div>
    </div>
  );
}
