import assert from 'node:assert/strict';
import { test, describe, after } from 'node:test';

import { format } from '../domain/money.ts';
import { formatRate } from '../domain/rate.ts';
import { LOCAL_WEBHOOK_SECRET, setKycOutcome, setPayoutOutcome } from '../providers/simulated.ts';
import {
  addRecipient,
  createQuote,
  currentRate,
  getState,
  ingest,
  login,
  requote,
  reset,
  seedDemo,
  startKyc,
  submitKycDocuments,
  submitTransfer,
  subscribe,
  transferById,
} from './corridor.ts';

/**
 * The whole path, end to end.
 *
 * Every screen transition in this app is gated on a state change from the service
 * layer, so a break anywhere in the chain strands the user on a screen with no way
 * forward, and the UI gives no hint which link failed.
 *
 * This exists because exactly that happened: the KYC fixture emitted `'approve'`
 * while its own `parseWebhook` matched `'approved'`, so the verdict parsed to null,
 * nothing was emitted, and the flow hung on "Checking your documents" forever.
 * Typecheck and every unit test passed. Only walking the path catches it.
 */

function waitFor(predicate: () => boolean, label: string, timeoutMs = 30_000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (predicate()) return resolve();
    const timer = setTimeout(() => {
      unsubscribe();
      reject(new Error(`timed out waiting for: ${label}`));
    }, timeoutMs);
    const unsubscribe = subscribe(() => {
      if (!predicate()) return;
      clearTimeout(timer);
      unsubscribe();
      resolve();
    });
  });
}

after(() => {
  reset();
});

describe('the full path: welcome to receipt', () => {
  test('completes every leg without stranding the user', async () => {
    reset();
    setKycOutcome('approved');
    setPayoutOutcome('deliver');

    // 01 → 02
    await login('demo@corridor.dev');
    assert.ok(getState().session, 'login must produce a session');
    const opening = getState().balance;

    // 03: the quote
    const quoted = createQuote('500.00');
    assert.ok(quoted.ok, 'quote must be issued');
    assert.equal(format(getState().quote!.totalCharged), '$503.75');

    // 05 → 06: verification must actually resolve, not sit on "reviewing"
    await startKyc();
    assert.equal(getState().kyc, 'pending');
    await submitKycDocuments();
    await waitFor(() => getState().kyc === 'approved', 'kyc approved');

    // 07: recipient
    const recipient = addRecipient('Elif Yıldız', 'TR200062000123456789012345');
    assert.ok(recipient, 'a checksum-valid IBAN must be accepted');

    // 08: submit
    const submitted = submitTransfer(recipient.id);
    assert.ok(submitted.ok, 'a signed, unexpired quote must be accepted');

    // 09 → 10: the settlement timeline must reach a terminal state on its own
    await waitFor(
      () => transferById(submitted.transferId)?.state === 'delivered',
      'transfer delivered',
    );

    const done = transferById(submitted.transferId)!;
    assert.equal(done.state, 'delivered');
    assert.ok(done.txHash, 'receipt needs a hash to link out to');
    assert.ok(
      done.steps.every((s) => s.status === 'done'),
      'every rail must complete',
    );

    // A delivered payout marks the recipient verified for next time.
    assert.equal(getState().recipients.find((r) => r.id === recipient.id)?.verified, true);

    // Funded by ACH, so the wallet only carried the USDC through: minted in, sent out.
    assert.equal(getState().balance.minor, opening.minor, 'an ACH-funded send nets to zero');

    // Both vendors retry their webhooks. Ingress acknowledges them, the log is
    // unchanged, and a second settlement does not trigger a second chain send.
    assert.ok(
      ingest(submitted.transferId, 'turkiye.try.bank', { event: 'payout.delivered' }, LOCAL_WEBHOOK_SECRET),
    );
    assert.ok(
      ingest(submitted.transferId, 'bridge.usd.ach', { event: 'deposit.settled', amount: '503.75' }, LOCAL_WEBHOOK_SECRET),
    );
    await new Promise((r) => setTimeout(r, 50));
    assert.equal(transferById(submitted.transferId)!.events.length, done.events.length);
    assert.equal(getState().balance.minor, opening.minor);
    assert.match(done.reference, /^CRD-[0-9A-F]{4}-[0-9A-F]{4}$/);
  });
});

describe('the failure path stays walkable', () => {
  test('a returned payout lands on a refund, not a dead end', async () => {
    reset();
    setKycOutcome('approved');
    setPayoutOutcome('return');

    await login('demo@corridor.dev');
    const before = getState().balance;
    // Deliberately not the demo amount: every leg has to carry the quote's figure.
    createQuote('200.00');
    await startKyc();
    await submitKycDocuments();
    await waitFor(() => getState().kyc === 'approved', 'kyc approved');

    const recipient = addRecipient('Wrong Name', 'TR200062000123456789012345')!;
    const submitted = submitTransfer(recipient.id);
    assert.ok(submitted.ok);

    await waitFor(() => transferById(submitted.transferId)?.state === 'refunded', 'refunded');

    const t = transferById(submitted.transferId)!;
    assert.equal(t.payoutReturn, 'name_mismatch');
    assert.ok(t.refunded, 'the user must be told where the money went');

    const settled = t.events.find((e) => e.t === 'onramp_settled');
    assert.equal(settled?.t === 'onramp_settled' && format(settled.amount), '$203.75');
    assert.equal(format(t.minted!), '200.000000 USDC');
    assert.equal(format(t.refunded), '200.000000 USDC');
    // The ACH-funded USDC came back to the wallet rather than to the bank, so the
    // balance is up by exactly the send amount.
    // Read back from the wallet just after the event lands, as the UI sees it.
    const refundedBalance = before.minor + t.minted!.minor;
    await waitFor(() => getState().balance.minor === refundedBalance, 'refund back in the wallet');

    setPayoutOutcome('deliver');
  });
});

describe('a rejected verdict does not strand the user', () => {
  test('resubmit is reachable and terminal-safe', async () => {
    reset();
    setKycOutcome('resubmit');

    await login('demo@corridor.dev');
    await startKyc();
    await submitKycDocuments();
    await waitFor(() => getState().kyc === 'resubmit', 'kyc resubmit');

    assert.equal(getState().kyc, 'resubmit');
    setKycOutcome('approved');
  });
});

describe('an expired quote re-quotes at the rate the screen shows', () => {
  test('11a never offers a rate the server would not issue', () => {
    reset();
    seedDemo('expired');
    const expired = getState().quote!;
    const shown = formatRate(currentRate());
    assert.notEqual(shown, formatRate(expired.rate), 'the demo market has moved');

    const result = requote();
    assert.ok(result && result.ok);
    assert.equal(formatRate(result.quote.rate), shown);
    assert.equal(format(result.quote.send), format(expired.send));
  });
});
