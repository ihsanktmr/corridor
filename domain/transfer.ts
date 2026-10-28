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
  /** The vendor's clock, retained for forensics, never used for ordering. */
  readonly providerAt?: string;
  /** The event's identity, from `eventKey`. A redelivery carries the same one. */
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

/**
 * Forward progress. A transfer only ever moves to a higher rank, so a late event
 * describing an earlier moment is kept in the log but cannot walk the state back:
 * a `chain_confirmed` arriving after `payout_delivered` leaves it delivered.
 *
 * The failure states outrank the happy path they interrupt. `clawback` outranks
 * everything because an R10 can land on a transfer that already finished.
 */
const RANK: Record<TransferState, number> = {
  draft: 0,
  quoted: 1,
  funding: 2,
  funded_held: 3,
  chain_pending: 4,
  chain_confirmed: 5,
  payout_pending: 6,
  payout_returned: 7,
  delivered: 8,
  refunded: 9,
  clawback: 10,
};

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
  /** `CRD-8F2A-4417`, what the sender quotes to support. */
  readonly reference: string;
  readonly state: TransferState;
  readonly steps: readonly Step[];
  readonly txHash?: Hex;
  readonly confirmations: number;
  /** The USDC that went on chain, which is also what a refund returns. */
  readonly minted?: Money;
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
  readonly reference: string;
}

/**
 * An event's identity: each event type happens at most once per transfer.
 *
 * Deduplication keys on this, not on `seq`. `seq` is assigned on ingress, so a
 * provider retrying a webhook gets a fresh one; keying on it would let every
 * redelivery through. A reorg resubmit is not a second `chain_submitted` either:
 * it reuses the `{transferId}:chain` key, so the provider returns the first hash.
 */
export function eventKey(transferId: string, e: TransferEvent): string {
  return `${transferId}:${e.t}`;
}

/**
 * Fold the log into current state.
 *
 * `seq` is arrival order, so sorting by it gives a stable replay, not a
 * correction: a provider that delivers out of order still arrives out of order.
 * What makes that harmless is that neither the state nor a completed step can move
 * backwards (see `RANK` and `setStep`). Duplicates are dropped by `idem`.
 */
export function foldTransfer(seed: Seed, log: readonly LoggedEvent[]): Transfer {
  const seen = new Set<string>();
  const ordered = [...log]
    .sort((a, b) => a.seq - b.seq)
    .filter((e) => (seen.has(e.idem) ? false : (seen.add(e.idem), true)));

  let state: TransferState = 'draft';
  let minted: Money | undefined;
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

  const advance = (next: TransferState): void => {
    if (RANK[next] > RANK[state]) state = next;
  };

  for (const e of ordered) {
    switch (e.t) {
      case 'quote_accepted':
        advance('quoted');
        break;

      case 'onramp_initiated':
        advance('funding');
        setStep('onramp', { id: 'onramp', status: 'live', at: e.at, detail: e.rail.toUpperCase() });
        break;

      case 'onramp_settled':
        // Deliberately not straight to chain: `funded_held` is the ACH hold.
        advance('funded_held');
        setStep('onramp', { id: 'onramp', status: 'done', at: e.at, detail: 'ACH cleared' });
        break;

      case 'onramp_returned':
        achReturn = e.code;
        // Before value leaves, a return is a clean refund. That includes
        // `funded_held`: holding until ACH clears exists so an R01 or R08 lands
        // here. Once USDC is on chain, the same return is a clawback.
        advance(RANK[state] < RANK.chain_pending ? 'refunded' : 'clawback');
        setStep('onramp', { id: 'onramp', status: 'failed', at: e.at, detail: e.code });
        break;

      case 'minted':
        minted = e.amount;
        setStep('mint', { id: 'mint', status: 'done', at: e.at });
        break;

      case 'chain_submitted':
        advance('chain_pending');
        txHash = e.txHash;
        setStep('chain', { id: 'chain', status: 'live', at: e.at });
        break;

      case 'chain_confirmed':
        advance('chain_confirmed');
        txHash = e.txHash;
        confirmations = Math.max(confirmations, e.confirmations);
        setStep('chain', { id: 'chain', status: 'done', at: e.at });
        break;

      case 'payout_submitted':
        advance('payout_pending');
        setStep('payout', { id: 'payout', status: 'live', at: e.at });
        break;

      case 'payout_delivered':
        advance('delivered');
        setStep('payout', { id: 'payout', status: 'done', at: e.at });
        setStep('delivered', { id: 'delivered', status: 'done', at: e.at });
        break;

      case 'payout_returned':
        advance('payout_returned');
        payoutReturn = e.reason;
        setStep('payout', { id: 'payout', status: 'failed', at: e.at, detail: e.reason });
        break;

      case 'refunded':
        advance('refunded');
        refunded = e.amount;
        break;
    }
  }

  return {
    id: seed.id,
    corridor: seed.corridor,
    quote: seed.quote,
    recipientId: seed.recipientId,
    reference: seed.reference,
    state,
    steps: STEP_ORDER.map((id) => steps.get(id) ?? { id, status: 'wait' }),
    ...(txHash !== undefined ? { txHash } : {}),
    confirmations,
    ...(minted !== undefined ? { minted } : {}),
    ...(achReturn !== undefined ? { achReturn } : {}),
    ...(payoutReturn !== undefined ? { payoutReturn } : {}),
    ...(refunded !== undefined ? { refunded } : {}),
    events: ordered,
  };
}

/** `0x551c···ba10`, the hash chip on screens 09 and 10. */
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
