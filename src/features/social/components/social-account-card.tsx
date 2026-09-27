import { ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { SubmitButton } from "@/components/ui/submit-button";
import { PLATFORM_META, type SocialPlatform } from "@/domain/campaigns/catalog";
import { displayHandle, formatFollowers, profileUrl } from "@/domain/creators/social";
import { PlatformTile } from "@/features/campaigns/components/campaign-bits";

import { disconnectSocialAccount } from "../actions";
import type { SocialAccountRow } from "../queries";
import { SocialAccountDialog } from "./social-account-dialog";

/** One platform row on the Social accounts screen (design: Auth 08 / Influencer social). */
export function SocialAccountCard({ platform, account }: { platform: SocialPlatform; account: SocialAccountRow | undefined }) {
  const label = PLATFORM_META[platform].label;

  return (
    <li className="flex flex-col gap-4 rounded-card border border-line bg-surface p-4 sm:flex-row sm:items-center sm:p-5">
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <PlatformTile platform={platform} active={Boolean(account)} size="md" />
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[15px] font-semibold tracking-[-0.01em]">{label}</span>
          {account ? (
            <a
              href={profileUrl(platform, account.handle)}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="flex items-center gap-1 truncate text-[13px] text-primary-strong hover:text-primary-hover"
            >
              {displayHandle(platform, account.handle)}
              <ExternalLink aria-hidden className="size-3" />
              <span className="sr-only">(opens {label})</span>
            </a>
          ) : (
            <span className="text-[13px] text-ink-muted">Not connected</span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {account ? (
          <>
            <span className="tabular text-[13px] text-ink-secondary">
              {formatFollowers(account.follower_count)} followers <span className="text-ink-muted">· self-reported</span>
            </span>
            <StatusBadge tone="success">Connected</StatusBadge>
            <SocialAccountDialog
              platform={platform}
              existing={{ id: account.id, handle: account.handle, followerCount: account.follower_count }}
              trigger={<Button variant="secondary" size="sm">Update</Button>}
            />
            <form action={disconnectSocialAccount}>
              <input type="hidden" name="accountId" value={account.id} />
              <SubmitButton variant="ghost" size="sm" pendingLabel="Disconnecting…">
                Disconnect
              </SubmitButton>
            </form>
          </>
        ) : (
          <>
            <StatusBadge tone="neutral">Optional</StatusBadge>
            <SocialAccountDialog platform={platform} trigger={<Button size="sm">Connect</Button>} />
          </>
        )}
      </div>
    </li>
  );
}
