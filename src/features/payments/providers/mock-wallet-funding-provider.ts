import { createHash } from "node:crypto";

import { assertSupportedCurrency } from "@/domain/money";

import {
  MockProviderInProductionError,
  type DepositRequest,
  type DepositResult,
  type WalletFundingProvider,
} from "./types";

/**
 * DEVELOPMENT / TEST ONLY. Simulates a deposit provider so the funding workflow can
 * be exercised locally. It never contacts a payment service and never moves money.
 *
 * Deterministic behaviour:
 *   - the provider reference is derived from (userId, idempotencyKey), so retries
 *     return the same reference;
 *   - amounts whose cents part is 13 (e.g. $50.13) are declined, to exercise the
 *     failure path; everything else succeeds.
 *
 * Refuses to construct or execute when NODE_ENV is "production".
 */
export class MockWalletFundingProvider implements WalletFundingProvider {
  readonly id = "mock";
  readonly isTestMode = true;

  constructor(private readonly nodeEnv: string | undefined = process.env.NODE_ENV) {
    MockWalletFundingProvider.assertAllowed(nodeEnv);
  }

  static assertAllowed(nodeEnv: string | undefined) {
    if (nodeEnv === "production") throw new MockProviderInProductionError();
  }

  async createDeposit(request: DepositRequest): Promise<DepositResult> {
    // Re-check at execution time in case an instance leaked across environments.
    MockWalletFundingProvider.assertAllowed(this.nodeEnv);
    assertSupportedCurrency(request.currency);
    if (!Number.isSafeInteger(request.amountCents) || request.amountCents <= 0) {
      throw new RangeError("Deposit amount must be a positive number of cents");
    }
    if (request.idempotencyKey.length < 8) throw new RangeError("Idempotency key is too short");

    const digest = createHash("sha256")
      .update(`${request.userId}:${request.idempotencyKey}`)
      .digest("hex")
      .slice(0, 24);
    const providerReference = `mock_dep_${digest}`;
    const declined = request.amountCents % 100 === 13;
    const at = new Date().toISOString();

    return {
      providerReference,
      status: declined ? "failed" : "succeeded",
      failureReason: declined ? "Declined by the mock provider (amounts ending in .13 are always declined)." : undefined,
      history: [
        { status: "pending", at },
        { status: "processing", at },
        { status: declined ? "failed" : "succeeded", at },
      ],
    };
  }
}
