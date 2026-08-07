import assert from 'node:assert/strict';
import { test, describe, after } from 'node:test';

import { format } from '../domain/money.ts';
import {
  addRecipient,
  createQuote,
  getState,
  login,
  reset,
  setKycOutcome,
  setPayoutOutcome,
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
  });
});

describe('the failure path stays walkable', () => {
  test('a returned payout lands on a refund, not a dead end', async () => {
    reset();
    setKycOutcome('approved');
    setPayoutOutcome('return');

    await login('demo@corridor.dev');
    createQuote('500.00');
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
