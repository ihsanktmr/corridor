/**
 * Quotes.
 *
 * A quote is issued and signed by the server. The client renders it and submits its
 * `id`, never the amounts. That is what stops a frozen countdown, a patched binary
 * or a replayed response from reaching settlement with numbers of its own choosing.
 *
 * In this build the "server" runs in-process (see `services/corridor.ts`), but the
 * boundary is the same one a deployed API would enforce, and the signature is real.
 */

import { add, money, parseAmount, sum, type Money } from './money.ts';
import { convert, type Rate } from './rate.ts';

export type CorridorId = 'USD:TRY' | 'USD:MXN';
export type FiatRail = 'ach' | 'wire' | 'card';

export interface FeeLine {
  readonly kind: 'onramp' | 'network' | 'payout';
  /** User-facing, named after the rail that consumes it. See screen 03. */
  readonly label: string;
  readonly amount: Money;
}

export interface Quote {
  readonly id: string;
  readonly corridor: CorridorId;
  /** What the user typed. */
  readonly send: Money;
  /** What the recipient gets. */
  readonly receive: Money;
  /** send + fees: what actually leaves the funding source. */
  readonly totalCharged: Money;
  readonly rate: Rate;
  readonly fees: readonly FeeLine[];
  readonly rail: FiatRail;
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly sig: string;
}

/** How long a quote is honoured. Screen 03 counts this down in the open. */
export const QUOTE_TTL_MS = 15 * 60 * 1000;

/** Warn state on screen 08 flips at this threshold. */
export const QUOTE_WARN_MS = 60 * 1000;

/**
 * Fee schedule.
 *
 * Flat per rail for a single fixed corridor, which is what makes the breakdown on
 * screen 03 legible: three lines, each named after the rail it pays for. A real
 * book would tier these by amount and by user history; the shape here is the
 * schedule, not the pricing strategy.
 */
export const FEE_SCHEDULE = {
  onramp: { ach: '1.25', wire: '15.00', card: '7.56' },
  network: { base: '0.01' },
  payout: { 'USD:TRY': '2.49', 'USD:MXN': '1.80' },
} as const;

export function feesFor(corridor: CorridorId, rail: FiatRail): readonly FeeLine[] {
  return [
    {
      kind: 'onramp',
      label: rail === 'ach' ? 'On-ramp · ACH → USDC' : `On-ramp · ${rail.toUpperCase()} → USDC`,
      amount: parseAmount('USD', FEE_SCHEDULE.onramp[rail]),
    },
    {
      kind: 'network',
      label: 'Network · Base',
      amount: parseAmount('USD', FEE_SCHEDULE.network.base),
    },
    {
      kind: 'payout',
      label: corridor === 'USD:TRY' ? 'Payout · USDC → TRY' : 'Payout · USDC → MXN',
      amount: parseAmount('USD', FEE_SCHEDULE.payout[corridor]),
    },
  ];
}

export function totalFees(fees: readonly FeeLine[]): Money {
  return sum(
    'USD',
    fees.map((f) => f.amount),
  );
}

export interface QuoteRequest {
  readonly corridor: CorridorId;
  readonly send: Money;
  readonly rail: FiatRail;
  readonly rate: Rate;
  readonly now: Date;
  readonly id: string;
  readonly sign: (payload: string) => string;
}

export function buildQuote(req: QuoteRequest): Quote {
  const fees = feesFor(req.corridor, req.rail);
  const totalCharged = add(req.send, totalFees(fees));
  const receive = convert(req.send, req.rate);

  const issuedAt = req.now.toISOString();
  const expiresAt = new Date(req.now.getTime() + QUOTE_TTL_MS).toISOString();

  const unsigned = {
    id: req.id,
    corridor: req.corridor,
    send: req.send,
    receive,
    totalCharged,
    rate: req.rate,
    fees,
    rail: req.rail,
    issuedAt,
    expiresAt,
  };

  return { ...unsigned, sig: req.sign(canonicalise(unsigned)) };
}

/**
 * Deterministic serialisation for signing.
 *
 * `JSON.stringify` on an object with a `bigint` throws, which is a useful accident:
 * it forces every amount through an explicit, lossless string encoding rather than
 * letting one slip through as a `number`.
 */
export function canonicalise(q: Omit<Quote, 'sig'>): string {
  return JSON.stringify({
    id: q.id,
    corridor: q.corridor,
    send: [q.send.currency, q.send.minor.toString()],
    receive: [q.receive.currency, q.receive.minor.toString()],
    totalCharged: [q.totalCharged.currency, q.totalCharged.minor.toString()],
    rate: [q.rate.from, q.rate.to, q.rate.num.toString(), q.rate.den.toString()],
    fees: q.fees.map((f) => [f.kind, f.amount.currency, f.amount.minor.toString()]),
    rail: q.rail,
    issuedAt: q.issuedAt,
    expiresAt: q.expiresAt,
  });
}

export type QuoteStatus = 'live' | 'expiring' | 'expired';

export function quoteStatus(q: Quote, now: Date): QuoteStatus {
  const remaining = Date.parse(q.expiresAt) - now.getTime();
  if (remaining <= 0) return 'expired';
  if (remaining <= QUOTE_WARN_MS) return 'expiring';
  return 'live';
}

export function msRemaining(q: Quote, now: Date): number {
  return Math.max(0, Date.parse(q.expiresAt) - now.getTime());
}

/** `14:52`, the lock countdown, in mono, on screens 03 and 08. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

/** Transfer limits by KYC tier. Screen 03 rejects above these before quoting. */
export const TIER_LIMITS = {
  none: { perTransfer: money('USD', 0n) },
  basic: { perTransfer: parseAmount('USD', '2999.00') },
  enhanced: { perTransfer: parseAmount('USD', '25000.00') },
} as const;

export const MIN_TRANSFER = parseAmount('USD', '10.00');
