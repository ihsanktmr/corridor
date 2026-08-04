/**
 * Rates.
 *
 * A rate is a rational, never a float. `52.84` as an IEEE double is not 52.84, and
 * a rate that cannot round-trip is a rate that cannot be reconciled against a
 * provider's own arithmetic three days later.
 */

import { SCALE, type Currency, type Money } from './money.ts';

export interface Rate {
  readonly from: Currency;
  readonly to: Currency;
  /** 5284n / 100n → 52.84 */
  readonly num: bigint;
  readonly den: bigint;
  /** Mid-market, unmarked-up. Corridor's margin is the explicit fee, not the spread. */
  readonly source: 'mid_market';
  readonly observedAt: string;
}

export function rate(
  from: Currency,
  to: Currency,
  num: bigint,
  den: bigint,
  observedAt: string,
): Rate {
  if (den <= 0n) throw new RangeError('rate denominator must be positive');
  return { from, to, num, den, source: 'mid_market', observedAt };
}

/** `rateFromDecimal('USD','TRY','52.84')` → 5284n / 100n */
export function rateFromDecimal(
  from: Currency,
  to: Currency,
  decimal: string,
  observedAt: string,
): Rate {
  if (!/^\d+(\.\d+)?$/.test(decimal.trim())) {
    throw new RangeError(`not a rate: ${JSON.stringify(decimal)}`);
  }
  const [whole = '0', fraction = ''] = decimal.trim().split('.');
  return rate(from, to, BigInt(whole + fraction), 10n ** BigInt(fraction.length), observedAt);
}

/**
 * Apply a rate, crossing any precision difference between the two currencies.
 *
 * Rounds half-up on the final minor unit. The rounding direction is fixed and
 * documented because it is a commercial decision, not an implementation detail —
 * whoever eats the half-unit needs to be the same party every time.
 */
export function convert(amount: Money, r: Rate): Money {
  if (amount.currency !== r.from) {
    throw new TypeError(`rate is ${r.from}/${r.to}, cannot apply to ${amount.currency}`);
  }

  const scaleDelta = SCALE[r.to] - SCALE[r.from];
  const scaled =
    scaleDelta >= 0
      ? amount.minor * r.num * 10n ** BigInt(scaleDelta)
      : amount.minor * r.num;
  const divisor = scaleDelta >= 0 ? r.den : r.den * 10n ** BigInt(-scaleDelta);

  // Half-up, sign-aware.
  const negative = scaled < 0n;
  const abs = negative ? -scaled : scaled;
  const quotient = (abs * 2n + divisor) / (divisor * 2n);

  return { currency: r.to, minor: negative ? -quotient : quotient };
}

/** `52.84` — for display next to the amount on screens 03 and 08. */
export function formatRate(r: Rate, decimals = 2): string {
  const scaled = (r.num * 10n ** BigInt(decimals) * 2n + r.den) / (r.den * 2n);
  const digits = scaled.toString().padStart(decimals + 1, '0');
  const whole = digits.slice(0, digits.length - decimals);
  const fraction = digits.slice(digits.length - decimals);
  return decimals > 0 ? `${whole}.${fraction}` : whole;
}
