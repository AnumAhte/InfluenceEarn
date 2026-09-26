/**
 * Money is always represented as an integer number of minor units (cents).
 * Never do arithmetic on floating-point dollar amounts.
 */
export type Cents = number & { readonly __brand: "Cents" };

export const BASE_CURRENCY = "USD" as const;
export type Currency = typeof BASE_CURRENCY;

export class UnsupportedCurrencyError extends Error {
  constructor(readonly currency: string) {
    super(`Unsupported currency: ${currency}. Only ${BASE_CURRENCY} is supported in V1.`);
    this.name = "UnsupportedCurrencyError";
  }
}

export function assertSupportedCurrency(currency: string): asserts currency is Currency {
  if (currency !== BASE_CURRENCY) throw new UnsupportedCurrencyError(currency);
}

export function cents(value: number): Cents {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`Money must be a safe integer number of cents, got ${value}`);
  }
  return value as Cents;
}

/** Converts whole dollars to cents, e.g. for static marketing examples. */
export function dollars(value: number): Cents {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`dollars() accepts whole dollars only, got ${value}`);
  }
  return cents(value * 100);
}

export function addCents(...values: Cents[]): Cents {
  return cents(values.reduce<number>((sum, value) => sum + value, 0));
}

export function multiplyCents(amount: Cents, quantity: number): Cents {
  if (!Number.isSafeInteger(quantity) || quantity < 0) {
    throw new RangeError(`Quantity must be a non-negative integer, got ${quantity}`);
  }
  return cents(amount * quantity);
}

/**
 * Applies a rate expressed in basis points (1 bp = 0.01%) using integer maths,
 * rounding half away from zero to the nearest cent.
 */
export function applyBasisPoints(amount: Cents, basisPoints: number): Cents {
  if (!Number.isSafeInteger(basisPoints) || basisPoints < 0) {
    throw new RangeError(`Basis points must be a non-negative integer, got ${basisPoints}`);
  }
  const numerator = BigInt(amount) * BigInt(basisPoints);
  const denominator = BigInt(10_000);
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  const absRemainder = remainder < BigInt(0) ? -remainder : remainder;
  const roundAway = absRemainder * BigInt(2) >= denominator;
  const direction = numerator < BigInt(0) ? BigInt(-1) : BigInt(1);
  return cents(Number(roundAway ? quotient + direction : quotient));
}

type FormatOptions = { showCents?: boolean };

export function formatMoney(amount: Cents, { showCents = true }: FormatOptions = {}): string {
  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: BASE_CURRENCY,
    minimumFractionDigits: showCents ? 2 : 0,
    maximumFractionDigits: showCents ? 2 : 0,
  });
  return formatter.format(amount / 100);
}

const DOLLAR_INPUT = /^(\d{1,9})(?:\.(\d{1,2}))?$/;

/**
 * Parses a user-entered dollar amount ("10", "10.5", "1,250.75") into cents using
 * string arithmetic only. Returns null for anything that is not a plain amount.
 */
export function parseDollarsToCents(input: string): Cents | null {
  const normalised = input.trim().replace(/^\$/, "").replace(/,/g, "");
  const match = DOLLAR_INPUT.exec(normalised);
  if (!match) return null;
  const whole = Number(match[1]);
  const fraction = Number((match[2] ?? "").padEnd(2, "0"));
  return cents(whole * 100 + fraction);
}

/** Formats cents for an editable input, e.g. 1050 → "10.50", 1000 → "10". */
export function centsToDollarInput(amount: Cents): string {
  const whole = Math.trunc(amount / 100);
  const fraction = Math.abs(amount % 100);
  return fraction === 0 ? String(whole) : `${whole}.${String(fraction).padStart(2, "0")}`;
}
