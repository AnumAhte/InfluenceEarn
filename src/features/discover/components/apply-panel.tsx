"use client";

import { CheckCircle2, CircleAlert, Link2 } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Textarea } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { PLATFORM_META } from "@/domain/campaigns/catalog";
import { issueFix, issueMessage, type EligibilityIssue } from "@/domain/creators/eligibility";
import { applyToCampaign, type ApplyState } from "@/features/applications/actions";
import { SocialAccountDialog } from "@/features/social/components/social-account-dialog";

const IDLE: ApplyState = { status: "idle" };

/**
 * Eligibility checklist + the social-account gate + the application form.
 * The apply action re-checks everything in the database.
 */
export function ApplyPanel({
  campaignId,
  issues,
  minFollowers,
  acceptingApplications,
}: {
  campaignId: string;
  issues: EligibilityIssue[];
  minFollowers: number | null;
  acceptingApplications: boolean;
}) {
  const [state, action] = useActionState(applyToCampaign, IDLE);
  const [pitch, setPitch] = useState("");
  const failureIssues = state.status === "error" && state.failure.code === "not_eligible" ? state.failure.issues : [];
  const shown = failureIssues.length > 0 ? failureIssues : issues;

  if (!acceptingApplications) {
    return <Callout tone="neutral">Applications for this campaign are closed.</Callout>;
  }

  if (shown.length > 0) {
    const gate = shown.find((issue) => issue.code === "missing_platform");
    return (
      <div className="flex flex-col gap-4">
        {gate?.platform ? (
          <div className="flex flex-col gap-3 rounded-[14px] border border-warning-bg bg-warning-bg/50 p-4">
            <span className="flex size-10 items-center justify-center rounded-control bg-warning-bg text-warning-fg">
              <Link2 aria-hidden className="size-5" />
            </span>
            <div className="flex flex-col gap-1">
              <p className="text-[15px] font-[650]">{PLATFORM_META[gate.platform].label} account required</p>
              <p className="text-[13.5px] leading-relaxed text-ink-secondary">
                Connect your {PLATFORM_META[gate.platform].label} account to apply to this campaign.
              </p>
            </div>
            <SocialAccountDialog
              platform={gate.platform}
              trigger={<Button className="w-full">Connect {PLATFORM_META[gate.platform].label}</Button>}
            />
          </div>
        ) : null}

        <ul className="flex flex-col gap-2" aria-label="Requirements you don't meet yet">
          {shown.map((issue) => {
            const fix = issueFix(issue);
            return (
              <li key={`${issue.code}-${issue.platform ?? ""}`} className="flex items-start gap-2.5 text-[13.5px]">
                <CircleAlert aria-hidden className="mt-0.5 size-4 flex-none text-warning-fg" />
                <span className="flex flex-col gap-0.5">
                  <span>{issueMessage(issue, minFollowers)}</span>
                  {fix.kind === "creator_details" ? (
                    <Link href="/settings/creator" className="text-[13px] font-[550] text-primary-strong hover:text-primary-hover">
                      Update creator details
                    </Link>
                  ) : fix.kind === "update_platform" ? (
                    <Link href="/settings/social" className="text-[13px] font-[550] text-primary-strong hover:text-primary-hover">
                      Update {PLATFORM_META[fix.platform].label} followers
                    </Link>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="text-xs text-ink-muted">
          Requirements are set by the advertiser. Connecting an account is only needed for campaigns that require that platform.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="campaignId" value={campaignId} />
      <p className="flex items-center gap-2 text-[13.5px] font-[550] text-success-fg">
        <CheckCircle2 aria-hidden className="size-4" />
        You meet this campaign&apos;s requirements
      </p>
      <label htmlFor="pitch" className="text-[13px] font-semibold">
        Message to the advertiser <span className="font-normal text-ink-muted">(optional)</span>
      </label>
      <Textarea id="pitch" name="pitch" rows={3} maxLength={1000} value={pitch} onChange={(e) => setPitch(e.target.value)} placeholder="Why you're a good fit." />
      {state.status === "error" ? <Callout tone="danger">{state.failure.message}</Callout> : null}
      <SubmitButton size="lg" pendingLabel="Submitting…" className="w-full shadow-primary">
        Submit application
      </SubmitButton>
      <p className="text-xs leading-normal text-ink-muted">
        The advertiser reviews applicants by hand. If they select you, you&apos;ll be notified.
      </p>
    </form>
  );
}
