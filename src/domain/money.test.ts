import { describe, expect, it } from "vitest";

import {
  applyBasisPoints,
  assertSupportedCurrency,
  cents,
  centsToDollarInput,
  dollars,
  formatMoney,
  multiplyCents,
  parseDollarsToCents,
  UnsupportedCurrencyError,
} from "./money";
import { calculateCampaignFunding, PLATFORM_FEE_BASIS_POINTS } from "./pricing";

describe("money", () => {
  it("rejects non-integer cent values", () => {
    expect(() => cents(10.5)).toThrow(RangeError);
    expect(() => dollars(1.25)).toThrow(RangeError);
  });

  it("applies basis points with half-up rounding in integer maths", () => {
    expect(applyBasisPoints(cents(100_000), 2_000)).toBe(20_000);
    expect(applyBasisPoints(cents(1), 2_000)).toBe(0); // 0.2 cents → 0
    expect(applyBasisPoints(cents(3), 2_000)).toBe(1); // 0.6 cents → 1
    expect(applyBasisPoints(cents(5), 1_000)).toBe(1); // 0.5 cents → 1 (half away from zero)
    expect(applyBasisPoints(cents(-5), 1_000)).toBe(-1);
  });

  it("multiplies by whole quantities only", () => {
    expect(multiplyCents(cents(1_000), 100)).toBe(100_000);
    expect(() => multiplyCents(cents(1_000), 1.5)).toThrow(RangeError);
    expect(() => multiplyCents(cents(1_000), -1)).toThrow(RangeError);
  });

  it("formats USD", () => {
    expect(formatMoney(cents(120_000))).toBe("$1,200.00");
    expect(formatMoney(cents(120_000), { showCents: false })).toBe("$1,200");
  });
});

describe("calculateCampaignFunding", () => {
  it("matches the worked example: 100 creators × $10 + 20%", () => {
    expect(PLATFORM_FEE_BASIS_POINTS).toBe(2_000);
    expect(calculateCampaignFunding(dollars(10), 100)).toEqual({
      creatorBudget: 100_000,
      platformFee: 20_000,
      totalFunding: 120_000,
    });
  });

  it("keeps cent-level precision", () => {
    // 3 × $3.33 = $9.99 → fee $1.998 → $2.00
    expect(calculateCampaignFunding(cents(333), 3)).toEqual({
      creatorBudget: 999,
      platformFee: 200,
      totalFunding: 1_199,
    });
  });

  it("rejects invalid inputs", () => {
    expect(() => calculateCampaignFunding(cents(0), 10)).toThrow(RangeError);
    expect(() => calculateCampaignFunding(cents(1_000), 0)).toThrow(RangeError);
    expect(() => calculateCampaignFunding(cents(1_000), 2.5)).toThrow(RangeError);
  });
});

describe("dollar input parsing", () => {
  it("parses exact amounts without floating point", () => {
    expect(parseDollarsToCents("10")).toBe(1_000);
    expect(parseDollarsToCents("10.5")).toBe(1_050);
    expect(parseDollarsToCents("$1,250.75")).toBe(125_075);
    expect(parseDollarsToCents("0.29")).toBe(29); // 0.29 * 100 would be 28.999… in floats
    for (const bad of ["", "abc", "-5", "10.555", "1e5", "10."]) expect(parseDollarsToCents(bad)).toBeNull();
    expect(centsToDollarInput(cents(1_050))).toBe("10.50");
    expect(centsToDollarInput(cents(1_000))).toBe("10");
  });

  it("formats money for display", () => {
    expect(formatMoney(cents(0))).toBe("$0.00");
    expect(formatMoney(cents(-12_000))).toBe("-$120.00");
    expect(formatMoney(cents(99))).toBe("$0.99");
  });

  it("only supports USD", () => {
    expect(() => assertSupportedCurrency("USD")).not.toThrow();
    expect(() => assertSupportedCurrency("EUR")).toThrow(UnsupportedCurrencyError);
  });
});
