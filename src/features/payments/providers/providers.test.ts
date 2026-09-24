import { describe, expect, it } from "vitest";

import { cents } from "@/domain/money";

import { getWalletFundingProvider, requireWalletFundingProvider } from "./index";
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
