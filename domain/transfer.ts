/**
 * Transfer state.
 *
 * State is a fold over an append-only event log, never a mutable column. Three
 * providers with three clocks will deliver events out of order and more than once;
 * a log makes that unremarkable, and it means screen 09 can be rebuilt exactly as
 * the user saw it at any point.
 *
 * `seq` is assigned by Corridor on ingress. A provider's own ordering guarantees
 * are that provider's business, not something to build correctness on.
 */

import type { Money } from './money.ts';
import type { CorridorId, FiatRail, Quote } from './quote.ts';

export type Hex = `0x${string}`;

/** NACHA return codes we distinguish. R10 is the one that cannot be designed away. */
export type AchReturnCode = 'R01' | 'R08' | 'R10';

export type PayoutReturnReason =
  | 'name_mismatch'
  | 'account_closed'
  | 'bank_rejected'
  | 'sanctions_hold';

export type TransferEvent =
  | { readonly t: 'quote_accepted'; readonly quoteId: string }
  | { readonly t: 'onramp_initiated'; readonly ref: string; readonly rail: FiatRail }
  | { readonly t: 'onramp_settled'; readonly amount: Money }
  | { readonly t: 'onramp_returned'; readonly code: AchReturnCode }
  | { readonly t: 'minted'; readonly amount: Money }
  | { readonly t: 'chain_submitted'; readonly txHash: Hex }
  | { readonly t: 'chain_confirmed'; readonly txHash: Hex; readonly confirmations: number }
  | { readonly t: 'payout_submitted'; readonly ref: string }
  | { readonly t: 'payout_delivered' }
  | { readonly t: 'payout_returned'; readonly reason: PayoutReturnReason }
  | { readonly t: 'refunded'; readonly amount: Money };

export interface Envelope {
  readonly seq: number;
  /** Corridor's clock. */
  readonly at: string;
  /** The vendor's clock — retained for forensics, never used for ordering. */
  readonly providerAt?: string;
  readonly idem: string;
}

export type LoggedEvent = TransferEvent & Envelope;

export type TransferState =
  | 'draft'
  | 'quoted'
  | 'funding'
  | 'funded_held'
  | 'chain_pending'
  | 'chain_confirmed'
  | 'payout_pending'
  | 'delivered'
  | 'payout_returned'
  | 'refunded'
  | 'clawback';

export const TERMINAL_STATES: readonly TransferState[] = ['delivered', 'refunded', 'clawback'];

export function isTerminal(s: TransferState): boolean {
  return TERMINAL_STATES.includes(s);
}

/** The five rails screen 09 renders, in order. */
export type StepId = 'onramp' | 'mint' | 'chain' | 'payout' | 'delivered';

export const STEP_ORDER: readonly StepId[] = ['onramp', 'mint', 'chain', 'payout', 'delivered'];

export type StepStatus = 'wait' | 'live' | 'done' | 'failed';

export interface Step {
  readonly id: StepId;
  readonly status: StepStatus;
  readonly at?: string;
  readonly detail?: string;
}

export interface Transfer {
  readonly id: string;
  readonly corridor: CorridorId;
  readonly quote: Quote;
  readonly recipientId: string;
  readonly state: TransferState;
  readonly steps: readonly Step[];
  readonly txHash?: Hex;
  readonly confirmations: number;
  readonly achReturn?: AchReturnCode;
  readonly payoutReturn?: PayoutReturnReason;
  readonly refunded?: Money;
  readonly events: readonly LoggedEvent[];
}

interface Seed {
  readonly id: string;
  readonly corridor: CorridorId;
  readonly quote: Quote;
  readonly recipientId: string;
}

/**
 * Fold the log into current state.
 *
 * Events are sorted by `seq` first, so an out-of-order delivery is corrected here
 * rather than being allowed to corrupt the result. Duplicate `seq` values are
 * dropped — providers retry, and a retried webhook must be a no-op.
 */
export function foldTransfer(seed: Seed, log: readonly LoggedEvent[]): Transfer {
  const seen = new Set<number>();
  const ordered = [...log]
    .sort((a, b) => a.seq - b.seq)
    .filter((e) => (seen.has(e.seq) ? false : (seen.add(e.seq), true)));

  let state: TransferState = 'draft';
  let txHash: Hex | undefined;
  let confirmations = 0;
  let achReturn: AchReturnCode | undefined;
  let payoutReturn: PayoutReturnReason | undefined;
  let refunded: Money | undefined;

  const steps = new Map<StepId, Step>(
    STEP_ORDER.map((id) => [id, { id, status: 'wait' as StepStatus }]),
  );

  /**
   * Steps are monotonic in the UI: once a step is `done` it never regresses, even
   * if a late webhook says otherwise. A user watching a completed step un-complete
   * has just learned not to trust the screen, and they would be right to.
   */
  const setStep = (id: StepId, next: Step): void => {
    const current = steps.get(id);
    if (current?.status === 'done' && next.status !== 'failed') return;
    steps.set(id, next);
  };

  for (const e of ordered) {
    switch (e.t) {
      case 'quote_accepted':
        state = 'quoted';
        break;

      case 'onramp_initiated':
        state = 'funding';
        setStep('onramp', { id: 'onramp', status: 'live', at: e.at, detail: e.rail.toUpperCase() });
        break;

      case 'onramp_settled':
        // Deliberately not straight to chain: `funded_held` is the ACH hold.
        state = 'funded_held';
        setStep('onramp', { id: 'onramp', status: 'done', at: e.at, detail: 'ACH cleared' });
        break;

      case 'onramp_returned':
        achReturn = e.code;
        // A return after value has already left is a clawback, not a clean failure.
        state = state === 'funding' ? 'refunded' : 'clawback';
        setStep('onramp', { id: 'onramp', status: 'failed', at: e.at, detail: e.code });
        break;

      case 'minted':
        setStep('mint', { id: 'mint', status: 'done', at: e.at });
        break;

      case 'chain_submitted':
        state = 'chain_pending';
        txHash = e.txHash;
        setStep('chain', { id: 'chain', status: 'live', at: e.at });
        break;

      case 'chain_confirmed':
        state = 'chain_confirmed';
        txHash = e.txHash;
        confirmations = Math.max(confirmations, e.confirmations);
        setStep('chain', { id: 'chain', status: 'done', at: e.at });
        break;

      case 'payout_submitted':
        state = 'payout_pending';
        setStep('payout', { id: 'payout', status: 'live', at: e.at });
        break;

      case 'payout_delivered':
        state = 'delivered';
        setStep('payout', { id: 'payout', status: 'done', at: e.at });
        setStep('delivered', { id: 'delivered', status: 'done', at: e.at });
        break;

      case 'payout_returned':
        state = 'payout_returned';
        payoutReturn = e.reason;
        setStep('payout', { id: 'payout', status: 'failed', at: e.at, detail: e.reason });
        break;

      case 'refunded':
        state = 'refunded';
        refunded = e.amount;
        break;
    }
  }

  return {
    id: seed.id,
    corridor: seed.corridor,
    quote: seed.quote,
    recipientId: seed.recipientId,
    state,
    steps: STEP_ORDER.map((id) => steps.get(id) ?? { id, status: 'wait' }),
    ...(txHash !== undefined ? { txHash } : {}),
    confirmations,
    ...(achReturn !== undefined ? { achReturn } : {}),
    ...(payoutReturn !== undefined ? { payoutReturn } : {}),
    ...(refunded !== undefined ? { refunded } : {}),
    events: ordered,
  };
}

/** `0x551c···ba10` — the hash chip on screens 09 and 10. */
export function shortHash(hash: string): string {
  return hash.length <= 12 ? hash : `${hash.slice(0, 6)}···${hash.slice(-4)}`;
}

export function shortAddress(address: string): string {
  return address.length <= 12 ? address : `${address.slice(0, 6)}···${address.slice(-4)}`;
}

/** Confirmations treated as final on Base. */
export const CONFIRMATIONS_REQUIRED = 12;

/**
 * Idempotency keys, scoped per leg.
 *
 * A reorg-driven chain resubmit reuses `{transferId}:chain`, so a duplicate
 * submission is impossible even across a process restart.
 */
export function idemKey(transferId: string, leg: 'onramp' | 'chain' | 'payout'): string {
  return `${transferId}:${leg}`;
}
