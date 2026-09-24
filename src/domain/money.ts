/**
 * Money is always represented as an integer number of minor units (cents).
 * Never do arithmetic on floating-point dollar amounts.
 */
export type Cents = number & { readonly __brand: "Cents" };

export const BASE_CURRENCY = "USD" as const;

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
