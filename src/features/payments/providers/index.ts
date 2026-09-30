import "server-only";

import { MockPayoutProvider } from "./mock-payout-provider";
import { MockWalletFundingProvider } from "./mock-wallet-funding-provider";
import { ProviderNotConfiguredError, type PayoutProvider, type WalletFundingProvider } from "./types";

/**
 * Resolves the wallet funding provider for this environment.
 *
 * - development / test: the mock provider (test funds only).
 * - production: no provider exists yet, so this returns null and callers must show
 *   that adding funds is unavailable. The mock is never returned in production.
 *
 * When a real provider is chosen, add it here (selected by environment config).
 */
export function getWalletFundingProvider(nodeEnv: string | undefined = process.env.NODE_ENV): WalletFundingProvider | null {
  if (nodeEnv === "production") return null;
  return new MockWalletFundingProvider(nodeEnv);
}

export function requireWalletFundingProvider(nodeEnv?: string): WalletFundingProvider {
  const provider = getWalletFundingProvider(nodeEnv);
  if (!provider) throw new ProviderNotConfiguredError("wallet_funding");
  return provider;
}

/**
 * Resolves the payout provider. Development/test: the mock. Production: none yet, so
 * payouts cannot be released until a real provider is integrated here.
 */
export function getPayoutProvider(nodeEnv: string | undefined = process.env.NODE_ENV): PayoutProvider | null {
  if (nodeEnv === "production") return null;
  return new MockPayoutProvider(nodeEnv);
}

export function requirePayoutProvider(nodeEnv?: string): PayoutProvider {
  const provider = getPayoutProvider(nodeEnv);
  if (!provider) throw new ProviderNotConfiguredError("payout");
  return provider;
}

export type { PayoutProvider, WalletFundingProvider } from "./types";
