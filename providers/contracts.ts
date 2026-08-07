/**
 * Provider contracts.
 *
 * Each interface is implemented once per rail. Every implementation normalises its
 * own vendor payload into Corridor's event vocabulary, so the orchestrator never
 * sees a vendor-shaped object — swapping the Turkish payout partner for another one
 * touches exactly one file.
 *
 * `parseWebhook` returns `null` rather than throwing on an unrecognised or
 * badly-signed payload. That keeps ingress total: a provider shipping an event type
 * we have never heard of gets logged and dropped, instead of crashing the endpoint
 * and stalling every in-flight transfer queued behind it.
 */

import type { Money } from '../domain/money.ts';
import type { CorridorId, FiatRail } from '../domain/quote.ts';
import type { AchReturnCode, PayoutReturnReason, TransferEvent } from '../domain/transfer.ts';

export type ProviderId =
  | 'bridge.usd.ach'
  | 'turkiye.try.bank'
  | 'bridge.mxn.spei'
  | 'kyc.vendor'
  | 'privy.wallet';

/** Whether a given adapter is talking to a real vendor or a fixture. */
export type Fidelity = 'real' | 'simulated' | 'hybrid';

export interface ProviderMeta {
  readonly id: ProviderId;
  readonly label: string;
  readonly fidelity: Fidelity;
  /**
   * Why this leg is simulated, in one sentence, shown verbatim on-screen.
   * Non-null exactly when `fidelity !== 'real'` — the UI reads this rather than
   * carrying its own copy, so a screen cannot claim a leg is real while the
   * registry is running a fixture.
   */
  readonly disclosure: string | null;
}

export interface OnrampProvider {
  readonly meta: ProviderMeta;
  supports(rail: FiatRail): boolean;
  /** Feeds "arrives Wed, Aug 5" on screen 04 — a date, never a vague duration. */
  estimateSettlement(rail: FiatRail, from: Date): Date;
  createDeposit(req: DepositRequest, idem: string): Promise<string>;
  parseWebhook(raw: unknown, sig: string): TransferEvent | null;
}

export interface DepositRequest {
  readonly transferId: string;
  readonly amount: Money;
  readonly rail: FiatRail;
}

export interface Destination {
  readonly holderName: string;
  readonly iban: string;
}

export type ValidationResult =
  | { readonly ok: true; readonly bank: string; readonly masked: string }
  | { readonly ok: false; readonly message: string };

export interface PayoutProvider {
  readonly meta: ProviderMeta;
  supports(corridor: CorridorId): boolean;
  /** Local and synchronous where the rail permits — screen 07 answers as you type. */
  validateDestination(d: Destination): ValidationResult;
  submit(req: PayoutRequest, idem: string): Promise<string>;
  parseWebhook(raw: unknown, sig: string): TransferEvent | null;
}

export interface PayoutRequest {
  readonly transferId: string;
  readonly amount: Money;
  readonly destination: Destination;
}

export type KycStatus =
  | 'none'
  | 'pending'
  | 'review'
  | 'approved'
  | 'resubmit'
  | 'rejected';

export type KycReasonCode = 'document_dark' | 'document_blurred' | 'face_mismatch' | 'expired_id';

export interface KycProvider {
  readonly meta: ProviderMeta;
  createSession(userId: string): Promise<{ sessionId: string; uploadUrl: string }>;
  /** Fixture-driven here; a real vendor pushes this over a webhook. */
  submitDocuments(sessionId: string): Promise<void>;
  parseWebhook(raw: unknown, sig: string): KycEvent | null;
}

export interface KycEvent {
  readonly sessionId: string;
  readonly status: KycStatus;
  readonly reasonCode?: KycReasonCode;
}

/**
 * The wallet is a provider too.
 *
 * `@privy-io/expo` requires native modules and therefore a development build, so a
 * reviewer cannot `npx expo start` a Privy-wired app. Putting the wallet behind the
 * same seam as every other rail means the repo stays openable by anyone, and the
 * real adapter is one binding away.
 */
export interface WalletProvider {
  readonly meta: ProviderMeta;
  login(email: string): Promise<{ userId: string; address: string }>;
  getAddress(): string | null;
  getBalance(): Promise<Money>;
  /** ERC-20 transfer on Base. Returns the hash the moment it exists. */
  sendUsdc(to: string, amount: Money, idem: string): Promise<`0x${string}`>;
  logout(): Promise<void>;
}

export type { AchReturnCode, PayoutReturnReason };
