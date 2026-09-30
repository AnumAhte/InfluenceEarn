import type { Cents, Currency } from "@/domain/money";

/**
 * Payment provider contracts. The real provider has NOT been selected; only a
 * development mock implements WalletFundingProvider. Campaign and ledger logic
 * depend on these interfaces, never on a concrete provider.
 */

export type ProviderPaymentStatus = "pending" | "processing" | "succeeded" | "failed" | "cancelled";

export type ProviderStatusChange = { status: ProviderPaymentStatus; at: string };

export type DepositRequest = {
  userId: string;
  amountCents: Cents;
  currency: Currency;
  /** Stable per user intent; retries must reuse it. */
  idempotencyKey: string;
};

export type DepositResult = {
  providerReference: string;
  status: Extract<ProviderPaymentStatus, "succeeded" | "failed">;
  failureReason?: string;
  /** Status progression reported by the provider, oldest first. */
  history: ProviderStatusChange[];
};

/** Brings money into a user's wallet (top-ups). */
export interface WalletFundingProvider {
  readonly id: string;
  /** True for providers that never move real money. */
  readonly isTestMode: boolean;
  createDeposit(request: DepositRequest): Promise<DepositResult>;
}

/** Generic charge/refund primitives, if the chosen provider needs them. Not implemented yet. */
export interface PaymentProvider {
  readonly id: string;
  getPaymentStatus(providerReference: string): Promise<ProviderPaymentStatus>;
}

export type PayoutRequest = {
  payoutId: string;
  recipientUserId: string;
  amountCents: Cents;
  currency: Currency;
  idempotencyKey: string;
};

export type PayoutResult = {
  providerReference: string;
  /** Final outcome, or "processing" when the provider settles asynchronously (webhook later). */
  status: Extract<ProviderPaymentStatus, "succeeded" | "failed" | "processing">;
  failureReason?: string;
};

/**
 * Sends a creator payout. Only a development mock exists until a real provider is
 * selected; production has no PayoutProvider and payouts cannot be released.
 */
export interface PayoutProvider {
  readonly id: string;
  /** True for providers that never move real money. */
  readonly isTestMode: boolean;
  createPayout(request: PayoutRequest): Promise<PayoutResult>;
  getPayoutStatus(providerReference: string): Promise<ProviderPaymentStatus>;
}

export class ProviderNotConfiguredError extends Error {
  constructor(kind: "wallet_funding" | "payment" | "payout") {
    super(`No ${kind.replace("_", " ")} provider is configured for this environment.`);
    this.name = "ProviderNotConfiguredError";
  }
}

export class MockProviderInProductionError extends Error {
  constructor() {
    super("The mock payment provider cannot run in production.");
    this.name = "MockProviderInProductionError";
  }
}
