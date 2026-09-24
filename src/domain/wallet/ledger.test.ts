import { describe, expect, it } from "vitest";

import { cents, dollars, UnsupportedCurrencyError } from "../money";
import { assessFunding, balanceOf, isBalanced, LedgerError, LedgerModel } from "./ledger";

const ADVERTISER = "user-a";
const OTHER = "user-b";

function setup(balanceDollars = 0) {
  const ledger = new LedgerModel();
  ledger.addCampaign({
    id: "cmp-1",
    ownerId: ADVERTISER,
    status: "funding_required",
    paymentPerCreatorCents: dollars(10),
    creatorsRequired: 100,
  });
  if (balanceDollars > 0) ledger.recordTestDeposit(ADVERTISER, dollars(balanceDollars), "USD", "seed-deposit-1");
  return ledger;
}

describe("wallet balance", () => {
  it("is derived from ledger entries", () => {
    const entries = [
      { accountId: "w", entryType: "mock_deposit" as const, amountCents: cents(50_000) },
      { accountId: "w", entryType: "campaign_funding_debit" as const, amountCents: cents(-12_000) },
      { accountId: "x", entryType: "mock_deposit" as const, amountCents: cents(999) },
    ];
    expect(balanceOf(entries, "w")).toBe(38_000);
    expect(balanceOf([], "w")).toBe(0);
  });

  it("assesses shortfall against the required total", () => {
    expect(assessFunding(cents(120_000), cents(50_000))).toEqual({
      sufficient: false,
      requiredCents: 120_000,
      availableCents: 50_000,
      shortfallCents: 70_000,
    });
    expect(assessFunding(cents(120_000), cents(120_000)).sufficient).toBe(true);
  });
});

describe("test deposits (reference model)", () => {
  it("credits the wallet once per idempotency key", () => {
    const ledger = setup();
    expect(ledger.recordTestDeposit(ADVERTISER, 50_000, "USD", "dep-key-001").replayed).toBe(false);
    expect(ledger.recordTestDeposit(ADVERTISER, 50_000, "USD", "dep-key-001").replayed).toBe(true);
    expect(ledger.balance(ADVERTISER)).toBe(50_000);
  });

  it("rejects reusing a key for a different amount", () => {
    const ledger = setup();
    ledger.recordTestDeposit(ADVERTISER, 50_000, "USD", "dep-key-001");
    expect(() => ledger.recordTestDeposit(ADVERTISER, 60_000, "USD", "dep-key-001")).toThrow(LedgerError);
  });

  it("rejects invalid currency and zero/negative amounts", () => {
    const ledger = setup();
    expect(() => ledger.recordTestDeposit(ADVERTISER, 1_000, "EUR", "dep-key-eur")).toThrow(UnsupportedCurrencyError);
    expect(() => ledger.recordTestDeposit(ADVERTISER, 0, "USD", "dep-key-zero")).toThrow(LedgerError);
    expect(() => ledger.recordTestDeposit(ADVERTISER, -100, "USD", "dep-key-neg")).toThrow(LedgerError);
    expect(() => ledger.recordTestDeposit(ADVERTISER, 10.5, "USD", "dep-key-frac")).toThrow(LedgerError);
    expect(ledger.transactionCount()).toBe(0);
  });
});

describe("campaign funding (reference model)", () => {
  it("fails with insufficient balance and changes nothing", () => {
    const ledger = setup(500);
    expect(() => ledger.fundAndPublish(ADVERTISER, "cmp-1")).toThrow(expect.objectContaining({ code: "insufficient_funds" }));
    expect(ledger.balance(ADVERTISER)).toBe(50_000);
    expect(ledger.campaignStatus("cmp-1")).toBe("funding_required");
  });

  it("funds successfully: debits total, reserves budget, books the fee, publishes", () => {
    const ledger = setup(1_500);
    const result = ledger.fundAndPublish(ADVERTISER, "cmp-1");
    expect(result).toMatchObject({ totalCents: 120_000, alreadyFunded: false });
    expect(ledger.balance(ADVERTISER)).toBe(30_000);
    expect(balanceOf(ledger.allEntries(), "reserve:cmp-1")).toBe(100_000);
    expect(balanceOf(ledger.allEntries(), "platform:revenue")).toBe(20_000);
    expect(ledger.campaignStatus("cmp-1")).toBe("applications_open");
    expect(isBalanced(ledger.allEntries())).toBe(true);
  });

  it("is idempotent: a duplicate funding attempt never charges twice", () => {
    const ledger = setup(5_000);
    const first = ledger.fundAndPublish(ADVERTISER, "cmp-1");
    const second = ledger.fundAndPublish(ADVERTISER, "cmp-1");
    expect(second).toMatchObject({ alreadyFunded: true, transactionId: first.transactionId });
    expect(ledger.balance(ADVERTISER)).toBe(500_000 - 120_000);
    expect(ledger.transactionCount()).toBe(2); // seed deposit + one funding
  });

  it("cannot be triggered by another user", () => {
    const ledger = setup(5_000);
    ledger.recordTestDeposit(OTHER, dollars(5_000), "USD", "other-deposit");
    expect(() => ledger.fundAndPublish(OTHER, "cmp-1")).toThrow(expect.objectContaining({ code: "campaign_not_found" }));
    expect(ledger.balance(OTHER)).toBe(500_000);
  });

  it("refuses campaigns that are not awaiting funding", () => {
    const ledger = setup(5_000);
    ledger.addCampaign({ id: "cmp-draft", ownerId: ADVERTISER, status: "draft", paymentPerCreatorCents: dollars(1), creatorsRequired: 1 });
    expect(() => ledger.fundAndPublish(ADVERTISER, "cmp-draft")).toThrow(expect.objectContaining({ code: "invalid_campaign_state" }));
  });
});
