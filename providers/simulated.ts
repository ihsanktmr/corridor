/**
 * Simulated providers.
 *
 * These implement the same interfaces as the real adapters and emit the same event
 * vocabulary. Nothing above the registry knows they exist; there is no `isMock`
 * branch in the orchestrator, the services, or any screen.
 *
 * They also behave like vendors in time: a call returns a reference, and the result
 * arrives later as a signed webhook to Corridor's ingress. Value moves on a shared
 * simulated USDC ledger, so the wallet balance the app reads is the one the on-ramp
 * minted into and a returned payout paid back to.
 *
 * Fixtures encode *timing*, not just payloads. The ACH leg settles at T+2 in
 * wall-clock terms, compressed by `DEMO_SPEED` for a walkthrough. A mock that
 * returned instantly would have hidden the entire `funded_held` design.
 */

import { formatBare, parseAmount, type Money } from '../domain/money.ts';
import type { CorridorId, FiatRail } from '../domain/quote.ts';
import { validateTurkishIban, maskIban, IBAN_MESSAGES } from '../domain/iban.ts';
import type { TransferEvent } from '../domain/transfer.ts';
import type {
  DepositRequest,
  Destination,
  Ingress,
  KycEvent,
  KycProvider,
  OnrampProvider,
  PayoutProvider,
  PayoutRequest,
  ProviderMeta,
  ValidationResult,
  WalletProvider,
} from './contracts.ts';

/**
 * Wall-clock compression for the demo.
 *
 * Real timings live in `SETTLEMENT`; this only scales how long the walkthrough
 * takes. The distinction matters: a reviewer should be able to read the true
 * durations off the code even while watching them play out in seconds.
 */
export const DEMO_SPEED = 20_000;

/** True settlement timings, before compression. */
export const SETTLEMENT = {
  /** ACH T+2 banking days. The slow leg, and the reason `funded_held` exists. */
  ach: 2 * 24 * 60 * 60 * 1000,
  wire: 6 * 60 * 60 * 1000,
  card: 0,
  /** Base block time to 12 confirmations. */
  chain: 24 * 1000,
  /** Turkish FAST payout, inside banking hours. */
  payout: 30 * 60 * 1000,
} as const;

/**
 * The floor matters as much as the divisor: a step that resolves in 40ms is a step
 * nobody saw. 1.5s is long enough to read the label and watch the node fill.
 */
export function demoDelay(realMs: number): number {
  return Math.max(1500, Math.round(realMs / DEMO_SPEED));
}

const BUSINESS_DAY_MS = 24 * 60 * 60 * 1000;

/** Skips weekends: an ACH estimate that lands on a Sunday is a wrong estimate. */
function addBankingDays(from: Date, days: number): Date {
  const d = new Date(from.getTime());
  let remaining = days;
  while (remaining > 0) {
    d.setTime(d.getTime() + BUSINESS_DAY_MS);
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) remaining -= 1;
  }
  return d;
}

// ─────────────────────────────────────────────────────────────────────────────
// The simulated world: a USDC ledger, ingress, and fixture outcomes
// ─────────────────────────────────────────────────────────────────────────────

/** The locked demo address and hash. See the tracker's demo-data block. */
const DEMO_ADDRESS = '0x477Fb9fA92b264Fe8f636bA6EA5415dd21a392a3';
const DEMO_TX = '0x551c67045ddfe8e8fb94fdad1ca0b5ffd078d3ca50f167531f0680722a55ba10';
const OPENING_BALANCE = parseAmount('USDC', '1284.50');

/** USDC by address, in minor units. Stands in for the chain the wallet reads. */
const ledger = new Map<string, bigint>();

function credit(address: string, amount: Money): void {
  ledger.set(address, (ledger.get(address) ?? 0n) + amount.minor);
}

let ingress: Ingress | null = null;

/** Where the simulated vendors deliver their webhooks. Called once by the registry. */
export function connectSimulatedIngress(target: Ingress): void {
  ingress = target;
}

let kycOutcome: 'approved' | 'resubmit' = 'approved';
let payoutOutcome: 'deliver' | 'return' = 'deliver';

/** Test seam: the next KYC verdict. `resubmit` drives screen 11b. */
export function setKycOutcome(outcome: 'approved' | 'resubmit'): void {
  kycOutcome = outcome;
}

/** Test seam: what the payout partner does next. `return` drives screen 11c. */
export function setPayoutOutcome(outcome: 'deliver' | 'return'): void {
  payoutOutcome = outcome;
}

/**
 * Test seam: a fresh simulated world. Webhooks already scheduled still fire, but
 * against transfers ingress no longer knows, so they are dropped.
 */
export function resetSimulation(): void {
  ledger.clear();
  credit(DEMO_ADDRESS, OPENING_BALANCE);
  kycOutcome = 'approved';
  payoutOutcome = 'deliver';
}

resetSimulation();

/** Runs `fn` after a real-world duration, compressed for the demo. */
function later(realMs: number, fn: () => void): void {
  setTimeout(fn, demoDelay(realMs));
}

// ─────────────────────────────────────────────────────────────────────────────
// On-ramp: Bridge USD/ACH
// ─────────────────────────────────────────────────────────────────────────────

const ONRAMP_META: ProviderMeta = {
  id: 'bridge.usd.ach',
  label: 'Bridge · USD',
  fidelity: 'simulated',
  disclosure:
    'Simulated leg. Bridge’s on-ramp is a real product, but sandbox keys are not ' +
    'self-serve, so timing and fees here are modelled on Bridge’s live behaviour.',
};

export class SimulatedOnramp implements OnrampProvider {
  readonly meta = ONRAMP_META;

  supports(rail: FiatRail): boolean {
    return rail === 'ach' || rail === 'wire' || rail === 'card';
  }

  estimateSettlement(rail: FiatRail, from: Date): Date {
    if (rail === 'card') return from;
    if (rail === 'wire') return new Date(from.getTime() + SETTLEMENT.wire);
    return addBankingDays(from, 2);
  }

  private readonly deposits = new Set<string>();

  async createDeposit(req: DepositRequest, idem: string): Promise<string> {
    const ref = `br_${idem.replace(/[^a-z0-9]/gi, '').slice(0, 12)}`;
    // Idempotent on the key, as Bridge is: a retried call returns the first deposit.
    if (this.deposits.has(idem)) return ref;
    this.deposits.add(idem);

    const settles = req.rail === 'ach' ? SETTLEMENT.ach : req.rail === 'wire' ? SETTLEMENT.wire : SETTLEMENT.card;
    later(settles, () => {
      credit(req.destination, req.deliver);
      ingress?.transfer(
        req.transferId,
        this.meta.id,
        { event: 'deposit.settled', amount: formatBare(req.amount) },
        LOCAL_WEBHOOK_SECRET,
      );
    });
    return ref;
  }

  parseWebhook(raw: unknown, sig: string): TransferEvent | null {
    if (sig !== LOCAL_WEBHOOK_SECRET) return null;
    if (typeof raw !== 'object' || raw === null) return null;
    const body = raw as Record<string, unknown>;

    switch (body.event) {
      case 'deposit.settled':
        return { t: 'onramp_settled', amount: parseAmount('USD', String(body.amount ?? '0')) };
      case 'deposit.returned':
        return { t: 'onramp_returned', code: (body.code as 'R01') ?? 'R01' };
      default:
        // Unknown event type from a vendor release we have not seen. Dropped, not thrown.
        return null;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Payout: Turkish bank, TRY over FAST/EFT
//
// Bridge has no TRY route in either direction, so this leg is a corridor-specific
// partner rather than the same vendor as the on-ramp. That gap is the reason this
// interface exists.
// ─────────────────────────────────────────────────────────────────────────────

const PAYOUT_META: ProviderMeta = {
  id: 'turkiye.try.bank',
  label: 'TRY payout partner',
  fidelity: 'simulated',
  disclosure:
    'Simulated leg. Bridge does not support TRY in either direction, and no ' +
    'USDC→TRY bank payout is available self-serve; this adapter is written ' +
    'against a documented partner’s API shape.',
};

export class SimulatedTurkiyePayout implements PayoutProvider {
  readonly meta = PAYOUT_META;

  supports(corridor: CorridorId): boolean {
    return corridor === 'USD:TRY';
  }

  validateDestination(d: Destination): ValidationResult {
    const result = validateTurkishIban(d.iban);
    if (!result.ok) return { ok: false, message: IBAN_MESSAGES[result.problem] };
    if (d.holderName.trim().length < 3) {
      return { ok: false, message: 'Enter the account holder’s full name' };
    }
    return { ok: true, bank: result.bank, masked: maskIban(result.normalised) };
  }

  private readonly payouts = new Set<string>();

  async submit(req: PayoutRequest, idem: string): Promise<string> {
    const ref = `tr_${idem.replace(/[^a-z0-9]/gi, '').slice(0, 12)}`;
    if (this.payouts.has(idem)) return ref;
    this.payouts.add(idem);

    const send = (body: Record<string, unknown>) =>
      ingress?.transfer(req.transferId, this.meta.id, body, LOCAL_WEBHOOK_SECRET);

    later(SETTLEMENT.payout, () => {
      if (payoutOutcome === 'deliver') {
        send({ event: 'payout.delivered' });
        return;
      }
      send({ event: 'payout.returned', reason: 'name_mismatch' });
      // The bank bounced the lira; the partner sends the USDC back to the address
      // that funded it. That is what lets screen 11c lead with "your money is safe".
      later(2 * 60_000, () => {
        credit(req.funding.from, req.funding.amount);
        send({ event: 'payout.refunded', amount: formatBare(req.funding.amount) });
      });
    });
    return ref;
  }

  parseWebhook(raw: unknown, sig: string): TransferEvent | null {
    if (sig !== LOCAL_WEBHOOK_SECRET) return null;
    if (typeof raw !== 'object' || raw === null) return null;
    const body = raw as Record<string, unknown>;

    switch (body.event) {
      case 'payout.delivered':
        return { t: 'payout_delivered' };
      case 'payout.returned':
        return { t: 'payout_returned', reason: (body.reason as 'name_mismatch') ?? 'bank_rejected' };
      case 'payout.refunded':
        return { t: 'refunded', amount: parseAmount('USDC', String(body.amount ?? '0')) };
      default:
        return null;
    }
  }
}

/**
 * Bridge's MXN/SPEI payout: implemented, registered, never called.
 *
 * It exists so the seam can be seen to be real rather than retrofitted: `USD:TRY`
 * and `USD:MXN` differ by one binding in `ROUTES`, and this is the other side of
 * that binding.
 */
export class SimulatedBridgePayout implements PayoutProvider {
  readonly meta: ProviderMeta = {
    id: 'bridge.mxn.spei',
    label: 'Bridge · MXN SPEI',
    fidelity: 'simulated',
    disclosure: 'Unused in this build. Present to demonstrate the payout seam.',
  };

  supports(corridor: CorridorId): boolean {
    return corridor === 'USD:MXN';
  }

  validateDestination(d: Destination): ValidationResult {
    // CLABE is 18 digits. Destination correctness is a property of the rail.
    const clabe = d.iban.replace(/\s/g, '');
    if (!/^\d{18}$/.test(clabe)) return { ok: false, message: 'A CLABE is 18 digits' };
    return { ok: true, bank: 'Mexican bank', masked: `···· ${clabe.slice(-4)}` };
  }

  async submit(): Promise<string> {
    throw new Error('bridge.mxn.spei is not wired in this build');
  }

  parseWebhook(): TransferEvent | null {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// KYC: real flow and state machine, fixture verdicts
// ─────────────────────────────────────────────────────────────────────────────

const KYC_META: ProviderMeta = {
  id: 'kyc.vendor',
  label: 'Identity verification',
  fidelity: 'hybrid',
  disclosure:
    'Real flow, mocked provider. Sequencing, retry and reason-code handling are ' +
    'production-shaped; the vendor verdict is a fixture.',
};

export class SimulatedKyc implements KycProvider {
  readonly meta = KYC_META;
  async createSession(userId: string): Promise<{ sessionId: string; uploadUrl: string }> {
    const sessionId = `kyc_${userId}_${Date.now().toString(36)}`;
    // A real vendor returns a short-lived signed URL; documents go client → vendor
    // directly, so Corridor never holds an image. That is the technical fact behind
    // the promise made on screen 05.
    return { sessionId, uploadUrl: `https://vendor.example/upload/${sessionId}` };
  }

  /**
   * The verdict arrives as a webhook, after a reviewer-shaped delay.
   *
   * The status strings are the vendor's own, deliberately; the adapter's job is to
   * translate them. An earlier version sent 'approve' while `parseWebhook` matched
   * 'approved', so the verdict silently parsed to null and the flow hung on
   * "Checking your documents" forever. Exactly the drop the architecture warns
   * about, landing on the happy path instead of an edge case.
   */
  async submitDocuments(sessionId: string): Promise<void> {
    const status = kycOutcome;
    later(45_000, () => ingress?.kyc({ sessionId, status }, LOCAL_WEBHOOK_SECRET));
  }

  parseWebhook(raw: unknown, sig: string): KycEvent | null {
    if (sig !== LOCAL_WEBHOOK_SECRET) return null;
    if (typeof raw !== 'object' || raw === null) return null;
    const body = raw as Record<string, unknown>;
    if (typeof body.sessionId !== 'string') return null;

    if (body.status === 'approved') return { sessionId: body.sessionId, status: 'approved' };
    if (body.status === 'resubmit') {
      return { sessionId: body.sessionId, status: 'resubmit', reasonCode: 'document_dark' };
    }
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Wallet: stands in for Privy's embedded wallet
// ─────────────────────────────────────────────────────────────────────────────

const WALLET_META: ProviderMeta = {
  id: 'privy.wallet',
  label: 'Embedded wallet',
  fidelity: 'simulated',
  disclosure:
    'Simulated wallet. `@privy-io/expo` needs native modules and a development ' +
    'build; this adapter keeps the repo runnable with `npx expo start`. The real ' +
    'Privy adapter binds in the same slot.',
};

export class SimulatedWallet implements WalletProvider {
  readonly meta = WALLET_META;
  private address: string | null = null;
  private readonly sent = new Map<string, `0x${string}`>();

  async login(email: string): Promise<{ userId: string; address: string }> {
    this.address = DEMO_ADDRESS;
    return { userId: `u_${email.split('@')[0] ?? 'demo'}`, address: DEMO_ADDRESS };
  }

  getAddress(): string | null {
    return this.address;
  }

  async getBalance(): Promise<Money> {
    return { currency: 'USDC', minor: ledger.get(this.address ?? DEMO_ADDRESS) ?? 0n };
  }

  async sendUsdc(to: string, amount: Money, idem: string): Promise<`0x${string}`> {
    // A resubmit under the same key is the same transaction, never a second one.
    const prior = this.sent.get(idem);
    if (prior) return prior;

    const from = this.address ?? DEMO_ADDRESS;
    const balance = ledger.get(from) ?? 0n;
    if (balance < amount.minor) throw new RangeError('insufficient USDC for the chain leg');
    ledger.set(from, balance - amount.minor);
    credit(to, amount);

    const hash = DEMO_TX as `0x${string}`;
    this.sent.set(idem, hash);
    return hash;
  }

  async waitForConfirmations(): Promise<void> {
    await new Promise<void>((resolve) => later(SETTLEMENT.chain, resolve));
  }

  async logout(): Promise<void> {
    this.address = null;
  }
}

/**
 * Signature used by the simulated providers when they POST to the real webhook
 * ingress. The ingress path, signature check, normalisation and ordering logic are
 * therefore exercised on every run; when a real key arrives, the untested surface
 * is one adapter, not the whole pipeline.
 */
export const LOCAL_WEBHOOK_SECRET = 'sim_local_secret';
