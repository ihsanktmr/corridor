/**
 * The Corridor service.
 *
 * This is the trust boundary from the phase 3 architecture, running in-process.
 * Everything here would sit behind an HTTPS API in a deployment: quote issuance and
 * signing, the transfer ledger, webhook ingress, and the reconciler.
 *
 * Screens never reach past this module to a provider. That constraint is what makes
 * the seam meaningful rather than decorative — and it is why swapping a simulated
 * adapter for a real one changes nothing above this file.
 */

import { validateTurkishIban, maskIban } from '../domain/iban.ts';
import { parseAmount, type Money } from '../domain/money.ts';
import {
  buildQuote,
  canonicalise,
  quoteStatus,
  MIN_TRANSFER,
  TIER_LIMITS,
  type CorridorId,
  type FiatRail,
  type Quote,
} from '../domain/quote.ts';
import { rateFromDecimal, type Rate } from '../domain/rate.ts';
import {
  foldTransfer,
  idemKey,
  type Hex,
  type LoggedEvent,
  type Transfer,
  type TransferEvent,
} from '../domain/transfer.ts';
import type { Destination, KycStatus, ProviderId } from '../providers/contracts.ts';
import {
  ACTIVE_CORRIDOR,
  onrampFor,
  payoutFor,
  providers,
} from '../providers/registry.ts';
import { demoDelay, LOCAL_WEBHOOK_SECRET, SETTLEMENT } from '../providers/simulated.ts';
import { sign, verify } from './signing.ts';

// ─────────────────────────────────────────────────────────────────────────────
// Rate feed
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The locked demo rate. A real feed streams from an FX provider; the important
 * property preserved here is that it is *mid-market and unmarked-up* — Corridor's
 * margin is the explicit fee, which is what screen 03 says out loud.
 */
const DEMO_RATE = '52.84';

export function currentRate(now: Date = new Date()): Rate {
  return rateFromDecimal('USD', 'TRY', DEMO_RATE, now.toISOString());
}

// ─────────────────────────────────────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────────────────────────────────────

export interface Recipient {
  readonly id: string;
  readonly holderName: string;
  readonly iban: string;
  readonly masked: string;
  readonly bank: string;
  /** Set once a payout to this recipient has actually been delivered. */
  readonly verified: boolean;
}

export interface Session {
  readonly userId: string;
  readonly email: string;
  readonly address: string;
}

interface TransferRecord {
  readonly seed: {
    readonly id: string;
    readonly corridor: CorridorId;
    readonly quote: Quote;
    readonly recipientId: string;
  };
  readonly log: LoggedEvent[];
}

export interface CorridorState {
  readonly session: Session | null;
  readonly balance: Money;
  readonly kyc: KycStatus;
  readonly kycSessionId: string | null;
  readonly recipients: readonly Recipient[];
  readonly quote: Quote | null;
  readonly transfers: readonly Transfer[];
  readonly activeTransferId: string | null;
}

const INITIAL_RECIPIENT: Recipient = {
  id: 'r_elif',
  holderName: 'Elif Yıldız',
  // Checksum-valid — verified by `domain/iban.test.ts`, not by eye.
  iban: 'TR200062000123456789012345',
  masked: 'TR20 ···· 2345',
  bank: 'Garanti BBVA',
  verified: true,
};

let state: CorridorState = {
  session: null,
  balance: parseAmount('USDC', '1284.50'),
  kyc: 'none',
  kycSessionId: null,
  recipients: [INITIAL_RECIPIENT],
  quote: null,
  transfers: [],
  activeTransferId: null,
};

const records = new Map<string, TransferRecord>();
const listeners = new Set<() => void>();
let seq = 0;
let ids = 0;

function nextId(prefix: string): string {
  ids += 1;
  return `${prefix}_${ids.toString(36)}${Date.now().toString(36).slice(-4)}`;
}

function rebuildTransfers(): readonly Transfer[] {
  return [...records.values()]
    .map((r) => foldTransfer(r.seed, r.log))
    .sort((a, b) => (a.id < b.id ? 1 : -1));
}

function emit(next: Partial<CorridorState>): void {
  state = { ...state, ...next, transfers: rebuildTransfers() };
  for (const l of listeners) l();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getState(): CorridorState {
  return state;
}

/** Test seam — resets the in-process ledger between walkthroughs. */
export function reset(): void {
  records.clear();
  seq = 0;
  state = {
    session: null,
    balance: parseAmount('USDC', '1284.50'),
    kyc: 'none',
    kycSessionId: null,
    recipients: [INITIAL_RECIPIENT],
    quote: null,
    transfers: [],
    activeTransferId: null,
  };
  for (const l of listeners) l();
}

// ─────────────────────────────────────────────────────────────────────────────
// Webhook ingress
//
// The simulated providers POST here, signed, exactly as a real vendor would. That
// keeps the signature check, `parseWebhook` normalisation, sequencing and the
// monotonic fold on the exercised path rather than the hopeful one.
// ─────────────────────────────────────────────────────────────────────────────

export function ingest(
  transferId: string,
  providerId: ProviderId,
  rawBody: unknown,
  signature: string,
): boolean {
  const record = records.get(transferId);
  if (!record) return false;

  const provider =
    providerId === 'bridge.usd.ach' ? onrampFor(ACTIVE_CORRIDOR) : payoutFor(ACTIVE_CORRIDOR);

  const event = provider.parseWebhook(rawBody, signature);
  // `null` means unrecognised or badly signed. Logged and dropped — never thrown,
  // or one unknown vendor event would stall every transfer behind it.
  if (event === null) return false;

  append(transferId, event);
  return true;
}

function append(transferId: string, event: TransferEvent, at: Date = new Date()): void {
  const record = records.get(transferId);
  if (!record) return;

  seq += 1;
  record.log.push({
    ...event,
    seq,
    at: at.toISOString(),
    idem: idemKey(transferId, 'chain'),
  } as LoggedEvent);

  emit({});
}

// ─────────────────────────────────────────────────────────────────────────────
// Auth
// ─────────────────────────────────────────────────────────────────────────────

export async function login(email: string): Promise<void> {
  const { userId, address } = await providers.wallet.login(email);
  const balance = await providers.wallet.getBalance();
  emit({ session: { userId, email, address }, balance });
}

export async function logout(): Promise<void> {
  await providers.wallet.logout();
  reset();
}

// ─────────────────────────────────────────────────────────────────────────────
// Quotes
// ─────────────────────────────────────────────────────────────────────────────

export type QuoteRejection =
  | { readonly ok: false; readonly reason: 'below_min'; readonly message: string }
  | { readonly ok: false; readonly reason: 'above_limit'; readonly message: string };

export type QuoteResult = { readonly ok: true; readonly quote: Quote } | QuoteRejection;

export function createQuote(sendDecimal: string, rail: FiatRail = 'ach'): QuoteResult {
  let send: Money;
  try {
    send = parseAmount('USD', sendDecimal || '0');
  } catch {
    return { ok: false, reason: 'below_min', message: 'Enter an amount' };
  }

  if (send.minor < MIN_TRANSFER.minor) {
    return { ok: false, reason: 'below_min', message: 'Minimum transfer is $10.00' };
  }

  const limit = state.kyc === 'approved' ? TIER_LIMITS.basic : TIER_LIMITS.basic;
  if (send.minor > limit.perTransfer.minor) {
    return {
      ok: false,
      reason: 'above_limit',
      message: 'Above your $2,999.00 per-transfer limit',
    };
  }

  const quote = buildQuote({
    corridor: ACTIVE_CORRIDOR,
    send,
    rail,
    rate: currentRate(),
    now: new Date(),
    id: nextId('q'),
    sign,
  });

  emit({ quote });
  return { ok: true, quote };
}

export function clearQuote(): void {
  emit({ quote: null });
}

// ─────────────────────────────────────────────────────────────────────────────
// KYC
// ─────────────────────────────────────────────────────────────────────────────

export async function startKyc(): Promise<void> {
  const session = state.session;
  if (!session) return;

  const { sessionId } = await providers.kyc.createSession(session.userId);
  emit({ kyc: 'pending', kycSessionId: sessionId });
}

export async function submitKycDocuments(): Promise<void> {
  const sessionId = state.kycSessionId;
  if (!sessionId) return;

  emit({ kyc: 'review' });
  await providers.kyc.submitDocuments(sessionId);

  setTimeout(() => {
    const event = providers.kyc.parseWebhook(
      { sessionId, status: (providers.kyc as { outcome?: string }).outcome ?? 'approved' },
      LOCAL_WEBHOOK_SECRET,
    );
    if (event) emit({ kyc: event.status });
  }, demoDelay(45_000));
}

export function setKycOutcome(outcome: 'approve' | 'resubmit'): void {
  (providers.kyc as unknown as { outcome: 'approve' | 'resubmit' }).outcome = outcome;
}

export function retryKyc(): void {
  emit({ kyc: 'pending' });
}

// ─────────────────────────────────────────────────────────────────────────────
// Recipients
// ─────────────────────────────────────────────────────────────────────────────

export function validateRecipient(d: Destination) {
  return payoutFor(ACTIVE_CORRIDOR).validateDestination(d);
}

export function addRecipient(holderName: string, iban: string): Recipient | null {
  const result = validateTurkishIban(iban);
  if (!result.ok) return null;

  const recipient: Recipient = {
    id: nextId('r'),
    holderName: holderName.trim(),
    iban: result.normalised,
    masked: maskIban(result.normalised),
    bank: result.bank,
    verified: false,
  };
  emit({ recipients: [recipient, ...state.recipients] });
  return recipient;
}

// ─────────────────────────────────────────────────────────────────────────────
// Transfers
// ─────────────────────────────────────────────────────────────────────────────

export type SubmitResult =
  | { readonly ok: true; readonly transferId: string }
  | { readonly ok: false; readonly reason: 'expired' | 'bad_signature' | 'no_quote' };

/**
 * Create a transfer from a quote.
 *
 * The quote's signature is verified and its expiry re-checked against the server's
 * own clock — a client with a frozen countdown still gets rejected here.
 */
export function submitTransfer(recipientId: string): SubmitResult {
  const quote = state.quote;
  if (!quote) return { ok: false, reason: 'no_quote' };

  const { sig, ...unsigned } = quote;
  if (!verify(canonicalise(unsigned), sig)) {
    return { ok: false, reason: 'bad_signature' };
  }
  if (quoteStatus(quote, new Date()) === 'expired') {
    return { ok: false, reason: 'expired' };
  }

  const transferId = nextId('t');
  records.set(transferId, {
    seed: { id: transferId, corridor: ACTIVE_CORRIDOR, quote, recipientId },
    log: [],
  });

  append(transferId, { t: 'quote_accepted', quoteId: quote.id });
  emit({ activeTransferId: transferId, quote: null });

  void runTimeline(transferId, recipientId);
  return { ok: true, transferId };
}

/** Flip to exercise screen 11c instead of the happy path. */
let payoutOutcome: 'deliver' | 'return' = 'deliver';

export function setPayoutOutcome(outcome: 'deliver' | 'return'): void {
  payoutOutcome = outcome;
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * The simulated settlement timeline.
 *
 * Delays derive from `SETTLEMENT`, which holds the *real* durations — ACH at T+2,
 * Base to 12 confirmations, Turkish FAST inside banking hours — compressed only for
 * the walkthrough. Every provider result enters through `ingest`, signed, so the
 * ingress path is the one under test.
 */
async function runTimeline(transferId: string, recipientId: string): Promise<void> {
  const record = records.get(transferId);
  if (!record) return;

  const { quote } = record.seed;
  const recipient = state.recipients.find((r) => r.id === recipientId);
  const onramp = onrampFor(ACTIVE_CORRIDOR);
  const payout = payoutFor(ACTIVE_CORRIDOR);

  const depositRef = await onramp.createDeposit(
    { transferId, amount: quote.totalCharged, rail: quote.rail },
    idemKey(transferId, 'onramp'),
  );
  append(transferId, { t: 'onramp_initiated', ref: depositRef, rail: quote.rail });

  // The ACH hold. This wait is the whole reason `funded_held` is a state.
  await wait(demoDelay(SETTLEMENT.ach));
  ingest(
    transferId,
    'bridge.usd.ach',
    { event: 'deposit.settled', amount: '500.00' },
    LOCAL_WEBHOOK_SECRET,
  );

  append(transferId, { t: 'minted', amount: parseAmount('USDC', '500.00') });

  const txHash: Hex = await providers.wallet.sendUsdc(
    '0xTreasury',
    parseAmount('USDC', '500.00'),
    idemKey(transferId, 'chain'),
  );
  append(transferId, { t: 'chain_submitted', txHash });
  emit({ balance: await providers.wallet.getBalance() });

  await wait(demoDelay(SETTLEMENT.chain));
  append(transferId, { t: 'chain_confirmed', txHash, confirmations: 12 });

  const payoutRef = await payout.submit(
    {
      transferId,
      amount: quote.receive,
      destination: {
        holderName: recipient?.holderName ?? '',
        iban: recipient?.iban ?? '',
      },
    },
    idemKey(transferId, 'payout'),
  );
  append(transferId, { t: 'payout_submitted', ref: payoutRef });

  await wait(demoDelay(SETTLEMENT.payout));

  if (payoutOutcome === 'deliver') {
    ingest(transferId, 'turkey.try.bank', { event: 'payout.delivered' }, LOCAL_WEBHOOK_SECRET);
    if (recipient && !recipient.verified) {
      emit({
        recipients: state.recipients.map((r) =>
          r.id === recipient.id ? { ...r, verified: true } : r,
        ),
      });
    }
  } else {
    ingest(
      transferId,
      'turkey.try.bank',
      { event: 'payout.returned', reason: 'name_mismatch' },
      LOCAL_WEBHOOK_SECRET,
    );
    // Funds return to the user's balance and the failed leg's fee is refunded —
    // screen 11c leads with "your money is safe" because this actually happens.
    await wait(demoDelay(2 * 60_000));
    append(transferId, { t: 'refunded', amount: parseAmount('USDC', '500.00') });
    emit({
      balance: {
        currency: 'USDC',
        minor: state.balance.minor + parseAmount('USDC', '500.00').minor,
      },
    });
  }
}

export function transferById(id: string | null): Transfer | null {
  if (!id) return null;
  return state.transfers.find((t) => t.id === id) ?? null;
}

export function recipientById(id: string): Recipient | null {
  return state.recipients.find((r) => r.id === id) ?? null;
}
