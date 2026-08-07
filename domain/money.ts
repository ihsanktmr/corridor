/**
 * Money.
 *
 * Minor units as `bigint`, currency-tagged. There is no `number` representation of
 * an amount anywhere in this codebase, and no arithmetic operator is applied to a
 * raw amount outside this file.
 *
 * The dangerous boundary is USD → USDC: USD carries 2 decimals, USDC carries 6, so
 * every conversion crosses a factor of 10^4. A float would round that silently.
 */

export type Currency = 'USD' | 'TRY' | 'USDC';

/** Decimal places per currency. USDC's 6 is fixed by the ERC-20 contract. */
export const SCALE: Record<Currency, number> = { USD: 2, TRY: 2, USDC: 6 };

const SYMBOL: Record<Currency, string> = { USD: '$', TRY: '₺', USDC: '' };

export interface Money {
  readonly currency: Currency;
  readonly minor: bigint;
}

export function money(currency: Currency, minor: bigint): Money {
  return { currency, minor };
}

/** `usd('500.00')` → 50_000n. Parses from a decimal string, never a float. */
export function parseAmount(currency: Currency, decimal: string): Money {
  const trimmed = decimal.trim().replace(/[,_\s]/g, '');
  if (!/^-?\d*(\.\d*)?$/.test(trimmed) || trimmed === '' || trimmed === '.') {
    throw new RangeError(`not a decimal amount: ${JSON.stringify(decimal)}`);
  }

  const negative = trimmed.startsWith('-');
  const [whole = '0', fraction = ''] = trimmed.replace('-', '').split('.');
  const scale = SCALE[currency];

  if (fraction.length > scale) {
    throw new RangeError(`${currency} carries ${scale} decimals, got ${fraction.length}`);
  }

  const padded = fraction.padEnd(scale, '0');
  const minor = BigInt(whole + padded);
  return { currency, minor: negative ? -minor : minor };
}

function assertSame(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new TypeError(`cannot combine ${a.currency} with ${b.currency}`);
  }
}

export function add(a: Money, b: Money): Money {
  assertSame(a, b);
  return { currency: a.currency, minor: a.minor + b.minor };
}

export function subtract(a: Money, b: Money): Money {
  assertSame(a, b);
  return { currency: a.currency, minor: a.minor - b.minor };
}

export function sum(currency: Currency, amounts: readonly Money[]): Money {
  return amounts.reduce<Money>((acc, m) => add(acc, m), { currency, minor: 0n });
}

export function isZero(m: Money): boolean {
  return m.minor === 0n;
}

export function compare(a: Money, b: Money): -1 | 0 | 1 {
  assertSame(a, b);
  return a.minor < b.minor ? -1 : a.minor > b.minor ? 1 : 0;
}

/**
 * Rescale between currencies of differing precision.
 *
 * Scaling *up* (USD → USDC) is exact. Scaling *down* (USDC → USD) can lose value,
 * so it refuses rather than truncating: silently dropping sub-cent remainders is
 * how ledgers stop balancing.
 */
export function rescale(m: Money, to: Currency): Money {
  const delta = SCALE[to] - SCALE[m.currency];
  if (delta === 0) return { currency: to, minor: m.minor };

  if (delta > 0) {
    return { currency: to, minor: m.minor * 10n ** BigInt(delta) };
  }

  const divisor = 10n ** BigInt(-delta);
  if (m.minor % divisor !== 0n) {
    throw new RangeError(
      `${format(m)} cannot be represented in ${to} without loss; ` +
        `caller must decide where the remainder goes`,
    );
  }
  return { currency: to, minor: m.minor / divisor };
}

/**
 * `$500.00` · `₺26,420.00` · `500.000000 USDC`
 *
 * Exact by default: the string round-trips through `parseAmount`. Pass `decimals`
 * to shorten for display: USDC carries six places, and rendering a balance as
 * "1,284.500000" is precision the user did not ask for and cannot use. Display
 * rounds half-up; it is never fed back into arithmetic.
 */
export function format(
  m: Money,
  opts: { grouping?: boolean; decimals?: number } = {},
): string {
  const grouping = opts.grouping ?? true;
  const scale = SCALE[m.currency];
  const negative = m.minor < 0n;
  let abs = negative ? -m.minor : m.minor;

  if (opts.decimals !== undefined && opts.decimals < scale) {
    const drop = 10n ** BigInt(scale - opts.decimals);
    abs = ((abs * 2n + drop) / (drop * 2n)) * drop;
  }

  const digits = abs.toString().padStart(scale + 1, '0');
  const whole = digits.slice(0, digits.length - scale);
  let fraction = digits.slice(digits.length - scale);
  if (opts.decimals !== undefined && opts.decimals < scale) {
    fraction = fraction.slice(0, opts.decimals);
  }

  const grouped = grouping ? whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : whole;
  const body = fraction.length > 0 ? `${grouped}.${fraction}` : grouped;

  const symbol = SYMBOL[m.currency];
  const sign = negative ? '-' : '';
  return symbol ? `${sign}${symbol}${body}` : `${sign}${body} ${m.currency}`;
}

/** Bare digits, for pairing with a separate currency label in the UI. */
export function formatBare(m: Money, opts: { decimals?: number } = {}): string {
  return format(m, opts).replace(/^(-?)[$₺]/, '$1').replace(/ (USD|TRY|USDC)$/, '');
}
