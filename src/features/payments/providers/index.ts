import "server-only";

import { MockWalletFundingProvider } from "./mock-wallet-funding-provider";
import { ProviderNotConfiguredError, type WalletFundingProvider } from "./types";

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

export type { WalletFundingProvider } from "./types";
