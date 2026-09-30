import { createHash } from "node:crypto";

import { assertSupportedCurrency } from "@/domain/money";

import { MockProviderInProductionError, type PayoutProvider, type PayoutRequest, type PayoutResult, type ProviderPaymentStatus } from "./types";

/**
 * DEVELOPMENT / TEST ONLY. Simulates paying a creator so the payout workflow can be
 * exercised locally. It never contacts a payment service and never moves money.
 *
 * Deterministic behaviour:
 *   - the provider reference is derived from the idempotency key, so a retried
 *     request for the same attempt returns the same reference;
 *   - amounts whose cents part is 13 (e.g. $40.13) fail, to exercise retries.
 *
 * Refuses to construct or execute when NODE_ENV is "production". The database also
 * refuses to record mock payouts unless test mode is enabled.
 */
export class MockPayoutProvider implements PayoutProvider {
  readonly id = "mock";
  readonly isTestMode = true;

  constructor(private readonly nodeEnv: string | undefined = process.env.NODE_ENV) {
    MockPayoutProvider.assertAllowed(nodeEnv);
  }

  static assertAllowed(nodeEnv: string | undefined) {
    if (nodeEnv === "production") throw new MockProviderInProductionError();
  }

  async createPayout(request: PayoutRequest): Promise<PayoutResult> {
    MockPayoutProvider.assertAllowed(this.nodeEnv);
    assertSupportedCurrency(request.currency);
    if (!Number.isSafeInteger(request.amountCents) || request.amountCents <= 0) {
      throw new RangeError("Payout amount must be a positive number of cents");
    }
    if (request.idempotencyKey.length < 8) throw new RangeError("Idempotency key is too short");

    const digest = createHash("sha256").update(request.idempotencyKey).digest("hex").slice(0, 24);
    const failed = request.amountCents % 100 === 13;
    return {
      providerReference: `mock_po_${digest}`,
      status: failed ? "failed" : "succeeded",
      failureReason: failed ? "Declined by the mock provider (amounts ending in .13 always fail)." : undefined,
    };
  }

  async getPayoutStatus(): Promise<ProviderPaymentStatus> {
    MockPayoutProvider.assertAllowed(this.nodeEnv);
    // The mock settles synchronously; there is never an in-flight payout to poll.
    return "succeeded";
  }
}
