import type { SocialPlatform } from "@/domain/campaigns/catalog";

import { OAuthNotAvailableError, type SocialAccountProvider } from "./types";

/**
 * Manual linking: the creator enters their handle and follower count. The result is
 * stored as `connection_method = 'manual'`, `verification_status = 'unverified'`, and
 * advertisers review the live profile themselves.
 */
class ManualSocialAccountProvider implements SocialAccountProvider {
  readonly method = "manual" as const;
  readonly supportsOAuth = false;

  constructor(readonly platform: SocialPlatform) {}

  getAuthorizationUrl(): string {
    throw new OAuthNotAvailableError(this.platform);
  }
}

/** Returns the provider for a platform. Every platform is manual until OAuth is approved. */
export function getSocialAccountProvider(platform: SocialPlatform): SocialAccountProvider {
  return new ManualSocialAccountProvider(platform);
}

export type { SocialAccountProvider } from "./types";
