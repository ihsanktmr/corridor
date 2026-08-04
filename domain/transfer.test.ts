import assert from 'node:assert/strict';
import { test, describe } from 'node:test';

import { format, parseAmount } from './money.ts';
import { buildQuote, formatCountdown, quoteStatus, totalFees, type Quote } from './quote.ts';
import { rateFromDecimal } from './rate.ts';
import {
  foldTransfer,
  shortHash,
  type Hex,
  type LoggedEvent,
  type StepId,
  type TransferEvent,
} from './transfer.ts';

const NOW = new Date('2026-08-03T14:22:00.000Z');
const TX: Hex = '0x8f2ae41d9c7b3f6a2e5d8c1b4a7f0e3d6c9b2a5f8e1d4c7b0a3f6e9d2c5bc19e';

const QUOTE: Quote = buildQuote({
  corridor: 'USD:TRY',
  send: parseAmount('USD', '500.00'),
  rail: 'ach',
  rate: rateFromDecimal('USD', 'TRY', '52.84', NOW.toISOString()),
  now: NOW,
  id: 'q_demo',
  sign: () => 'sig_stub',
});

const SEED = {
  id: 't_demo',
  corridor: 'USD:TRY' as const,
  quote: QUOTE,
  recipientId: 'r_elif',
};

let seq = 0;
function ev(e: TransferEvent, at = '2026-08-05T09:38:00.000Z'): LoggedEvent {
  seq += 1;
  return { ...e, seq, at, idem: `t_demo:${seq}` } as LoggedEvent;
}

function reset(): void {
  seq = 0;
}

const step = (t: ReturnType<typeof foldTransfer>, id: StepId) =>
  t.steps.find((s) => s.id === id);

describe('quote — the locked demo numbers', () => {
  test('fees are the three named rails and total $3.75', () => {
    assert.deepEqual(
      QUOTE.fees.map((f) => format(f.amount)),
      ['$1.25', '$0.01', '$2.49'],
    );
    assert.equal(format(totalFees(QUOTE.fees)), '$3.75');
  });

  test('send, receive and total charged match the locked data', () => {
    assert.equal(format(QUOTE.send), '$500.00');
    assert.equal(format(QUOTE.receive), '₺26,420.00');
    assert.equal(format(QUOTE.totalCharged), '$503.75');
  });

  test('expiry is 15 minutes out and counts down in the open', () => {
    assert.equal(quoteStatus(QUOTE, NOW), 'live');
    assert.equal(quoteStatus(QUOTE, new Date(NOW.getTime() + 14.5 * 60_000)), 'expiring');
    assert.equal(quoteStatus(QUOTE, new Date(NOW.getTime() + 16 * 60_000)), 'expired');
  });

  test('countdown formats as mm:ss', () => {
    assert.equal(formatCountdown(14 * 60_000 + 52_000), '14:52');
    assert.equal(formatCountdown(47_000), '00:47');
    assert.equal(formatCountdown(-1), '00:00');
  });
});

describe('foldTransfer — happy path', () => {
  test('walks all five rails to delivered', () => {
    reset();
    const t = foldTransfer(SEED, [
      ev({ t: 'quote_accepted', quoteId: 'q_demo' }),
      ev({ t: 'onramp_initiated', ref: 'br_1', rail: 'ach' }),
      ev({ t: 'onramp_settled', amount: parseAmount('USD', '500.00') }),
      ev({ t: 'minted', amount: parseAmount('USDC', '500.00') }),
      ev({ t: 'chain_submitted', txHash: TX }),
      ev({ t: 'chain_confirmed', txHash: TX, confirmations: 12 }),
      ev({ t: 'payout_submitted', ref: 'tr_1' }),
      ev({ t: 'payout_delivered' }),
    ]);

    assert.equal(t.state, 'delivered');
    assert.equal(t.txHash, TX);
    assert.equal(t.confirmations, 12);
    assert.ok(t.steps.every((s) => s.status === 'done'));
  });

  test('funded_held is a real state, not a pass-through', () => {
    reset();
    const t = foldTransfer(SEED, [
      ev({ t: 'quote_accepted', quoteId: 'q_demo' }),
      ev({ t: 'onramp_initiated', ref: 'br_1', rail: 'ach' }),
      ev({ t: 'onramp_settled', amount: parseAmount('USD', '500.00') }),
    ]);
    // The ACH hold: USD has settled, nothing has been sent onward yet.
    assert.equal(t.state, 'funded_held');
    assert.equal(step(t, 'onramp')?.status, 'done');
    assert.equal(step(t, 'chain')?.status, 'wait');
  });
});

describe('foldTransfer — ordering guarantees', () => {
  test('an out-of-order delivery is corrected by seq, not trusted', () => {
    reset();
    const events = [
      ev({ t: 'quote_accepted', quoteId: 'q_demo' }),
      ev({ t: 'onramp_initiated', ref: 'br_1', rail: 'ach' }),
      ev({ t: 'onramp_settled', amount: parseAmount('USD', '500.00') }),
      ev({ t: 'minted', amount: parseAmount('USDC', '500.00') }),
      ev({ t: 'chain_submitted', txHash: TX }),
      ev({ t: 'chain_confirmed', txHash: TX, confirmations: 12 }),
      ev({ t: 'payout_submitted', ref: 'tr_1' }),
      ev({ t: 'payout_delivered' }),
    ];

    const shuffled = [events[4], events[7], events[0], events[2], events[5], events[1], events[6], events[3]] as LoggedEvent[];
    const inOrder = foldTransfer(SEED, events);
    const outOfOrder = foldTransfer(SEED, shuffled);

    assert.equal(outOfOrder.state, inOrder.state);
    assert.deepEqual(outOfOrder.steps, inOrder.steps);
  });

  test('a redelivered webhook is a no-op', () => {
    reset();
    const events = [
      ev({ t: 'quote_accepted', quoteId: 'q_demo' }),
      ev({ t: 'onramp_initiated', ref: 'br_1', rail: 'ach' }),
      ev({ t: 'onramp_settled', amount: parseAmount('USD', '500.00') }),
    ];
    const once = foldTransfer(SEED, events);
    const twice = foldTransfer(SEED, [...events, ...events, events[1] as LoggedEvent]);

    assert.equal(twice.state, once.state);
    assert.equal(twice.events.length, once.events.length);
  });

  test('a late webhook never walks a completed step backwards', () => {
    reset();
    const confirmed = ev({ t: 'chain_confirmed', txHash: TX, confirmations: 12 });
    // Arrives after, but describes an earlier moment.
    const lateSubmitted = ev({ t: 'chain_submitted', txHash: TX });

    const t = foldTransfer(SEED, [
      ev({ t: 'quote_accepted', quoteId: 'q_demo' }),
      confirmed,
      lateSubmitted,
    ]);

    // The chain step stays done. A user watching it un-complete would be right
    // to stop trusting the screen.
    assert.equal(step(t, 'chain')?.status, 'done');
  });
});

describe('foldTransfer — failure paths', () => {
  test('payout returned, then refunded, keeps the timeline intact', () => {
    reset();
    const t = foldTransfer(SEED, [
      ev({ t: 'quote_accepted', quoteId: 'q_demo' }),
      ev({ t: 'onramp_initiated', ref: 'br_1', rail: 'ach' }),
      ev({ t: 'onramp_settled', amount: parseAmount('USD', '500.00') }),
      ev({ t: 'minted', amount: parseAmount('USDC', '500.00') }),
      ev({ t: 'chain_submitted', txHash: TX }),
      ev({ t: 'chain_confirmed', txHash: TX, confirmations: 12 }),
      ev({ t: 'payout_submitted', ref: 'tr_1' }),
      ev({ t: 'payout_returned', reason: 'name_mismatch' }),
      ev({ t: 'refunded', amount: parseAmount('USDC', '500.00') }),
    ]);

    assert.equal(t.state, 'refunded');
    assert.equal(t.payoutReturn, 'name_mismatch');
    assert.equal(format(t.refunded!), '500.000000 USDC');
    // Screen 11c keeps the completed legs visible so the return reads as a
    // round trip rather than a hole.
    assert.equal(step(t, 'onramp')?.status, 'done');
    assert.equal(step(t, 'chain')?.status, 'done');
    assert.equal(step(t, 'payout')?.status, 'failed');
  });

  test('an ACH return before value leaves is a clean refund', () => {
    reset();
    const t = foldTransfer(SEED, [
      ev({ t: 'quote_accepted', quoteId: 'q_demo' }),
      ev({ t: 'onramp_initiated', ref: 'br_1', rail: 'ach' }),
      ev({ t: 'onramp_returned', code: 'R01' }),
    ]);
    assert.equal(t.state, 'refunded');
    assert.equal(t.achReturn, 'R01');
  });

  test('an R10 arriving after payout is a clawback, not a refund', () => {
    reset();
    const t = foldTransfer(SEED, [
      ev({ t: 'quote_accepted', quoteId: 'q_demo' }),
      ev({ t: 'onramp_initiated', ref: 'br_1', rail: 'ach' }),
      ev({ t: 'onramp_settled', amount: parseAmount('USD', '500.00') }),
      ev({ t: 'minted', amount: parseAmount('USDC', '500.00') }),
      ev({ t: 'chain_confirmed', txHash: TX, confirmations: 12 }),
      ev({ t: 'payout_submitted', ref: 'tr_1' }),
      ev({ t: 'payout_delivered' }),
      // Up to 60 days later. The lira is gone; this is a balance-sheet event.
      ev({ t: 'onramp_returned', code: 'R10' }, '2026-09-28T11:00:00.000Z'),
    ]);

    assert.equal(t.state, 'clawback');
    assert.equal(t.achReturn, 'R10');
  });
});

describe('display helpers', () => {
  test('shortens a hash to the phase 2 chip format', () => {
    assert.equal(shortHash(TX), '0x8f2a···c19e');
  });
});
