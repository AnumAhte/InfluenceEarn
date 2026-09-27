import type { SocialPlatform } from "@/domain/campaigns/catalog";

/**
 * How a social account gets linked. V1 only has manual linking (handle +
 * self-reported followers). OAuth providers (Instagram Graph, TikTok, YouTube Data,
 * Facebook) will implement this once approved — they must never be simulated.
 */
export type SocialConnectionMethod = "manual" | "oauth";

export type LinkedAccountDetails = {
  platform: SocialPlatform;
  handle: string;
  /** Null when the platform did not provide one. */
  followerCount: number | null;
  connectionMethod: SocialConnectionMethod;
  /** True only when the platform itself confirmed ownership and figures. */
  verified: boolean;
  providerAccountId: string | null;
};

export interface SocialAccountProvider {
  readonly platform: SocialPlatform;
  readonly method: SocialConnectionMethod;
  /** Whether this provider can start an OAuth redirect. Manual providers cannot. */
  readonly supportsOAuth: boolean;
  /** For OAuth providers: where to send the user. Manual providers throw. */
  getAuthorizationUrl(state: string): string;
}

export class OAuthNotAvailableError extends Error {
  constructor(platform: SocialPlatform) {
    super(`Connecting ${platform} through the platform isn't available yet.`);
    this.name = "OAuthNotAvailableError";
  }
}
