import { describe, expect, it } from "vitest";

import { cents } from "@/domain/money";

import { getPayoutProvider, getWalletFundingProvider, requirePayoutProvider, requireWalletFundingProvider } from "./index";
import { MockPayoutProvider } from "./mock-payout-provider";
import { MockWalletFundingProvider } from "./mock-wallet-funding-provider";
import { MockProviderInProductionError, ProviderNotConfiguredError } from "./types";

const request = { userId: "user-a", amountCents: cents(50_000), currency: "USD" as const, idempotencyKey: "key-12345678" };

describe("MockWalletFundingProvider", () => {
  it("refuses to initialise in production", () => {
    expect(() => new MockWalletFundingProvider("production")).toThrow(MockProviderInProductionError);
  });

  it("works in development and test", async () => {
    const provider = new MockWalletFundingProvider("development");
    const result = await provider.createDeposit(request);
    expect(provider.isTestMode).toBe(true);
    expect(result.status).toBe("succeeded");
    expect(result.history.map((h) => h.status)).toEqual(["pending", "processing", "succeeded"]);
    expect(new MockWalletFundingProvider("test").id).toBe("mock");
  });

  it("is deterministic per user + idempotency key", async () => {
    const provider = new MockWalletFundingProvider("test");
    const a = await provider.createDeposit(request);
    const b = await provider.createDeposit(request);
    const other = await provider.createDeposit({ ...request, userId: "user-b" });
    expect(a.providerReference).toBe(b.providerReference);
    expect(other.providerReference).not.toBe(a.providerReference);
  });

  it("declines amounts ending in .13 to exercise failures", async () => {
    const result = await new MockWalletFundingProvider("test").createDeposit({ ...request, amountCents: cents(5_013) });
    expect(result.status).toBe("failed");
    expect(result.failureReason).toBeTruthy();
  });

  it("rejects invalid currency and non-positive amounts", async () => {
    const provider = new MockWalletFundingProvider("test");
    await expect(provider.createDeposit({ ...request, currency: "EUR" as "USD" })).rejects.toThrow(/Unsupported currency/);
    await expect(provider.createDeposit({ ...request, amountCents: cents(0) })).rejects.toThrow(RangeError);
    await expect(provider.createDeposit({ ...request, amountCents: cents(-100) })).rejects.toThrow(RangeError);
  });
});

describe("provider registry", () => {
  it("never hands out the mock in production and fails safely", () => {
    expect(getWalletFundingProvider("production")).toBeNull();
    expect(() => requireWalletFundingProvider("production")).toThrow(ProviderNotConfiguredError);
  });

  it("uses the mock outside production", () => {
    expect(getWalletFundingProvider("development")?.isTestMode).toBe(true);
  });
});

describe("MockPayoutProvider", () => {
  const payout = { payoutId: "p1", recipientUserId: "user-a", amountCents: cents(4_000), currency: "USD" as const, idempotencyKey: "payout:p1:1" };

  it("refuses to initialise in production", () => {
    expect(() => new MockPayoutProvider("production")).toThrow(MockProviderInProductionError);
  });

  it("is deterministic per idempotency key and fails amounts ending in .13", async () => {
    const provider = new MockPayoutProvider("test");
    const a = await provider.createPayout(payout);
    const b = await provider.createPayout(payout);
    const retry = await provider.createPayout({ ...payout, idempotencyKey: "payout:p1:2" });
    expect(a).toEqual(b);
    expect(a.status).toBe("succeeded");
    expect(retry.providerReference).not.toBe(a.providerReference);
    expect((await provider.createPayout({ ...payout, amountCents: cents(4_013) })).status).toBe("failed");
  });

  it("rejects invalid amounts and currency", async () => {
    const provider = new MockPayoutProvider("test");
    await expect(provider.createPayout({ ...payout, amountCents: cents(0) })).rejects.toThrow(RangeError);
    await expect(provider.createPayout({ ...payout, currency: "EUR" as "USD" })).rejects.toThrow(/Unsupported currency/);
  });

  it("is never handed out in production", () => {
    expect(getPayoutProvider("production")).toBeNull();
    expect(() => requirePayoutProvider("production")).toThrow(ProviderNotConfiguredError);
    expect(getPayoutProvider("development")?.isTestMode).toBe(true);
  });
});
