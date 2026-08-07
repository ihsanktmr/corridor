import assert from 'node:assert/strict';
import { test, describe } from 'node:test';

import {
  formatIban,
  maskIban,
  turkishCheckDigits,
  validateTurkishIban,
} from './iban.ts';

/** The locked demo recipient: Elif Yıldız, Garanti BBVA. */
const LOCKED = 'TR20 0062 0001 2345 6789 0123 45';

describe('validateTurkishIban', () => {
  test('accepts the locked demo IBAN and names the bank', () => {
    const result = validateTurkishIban(LOCKED);
    assert.equal(result.ok, true);
    assert.ok(result.ok);
    assert.equal(result.bank, 'Garanti BBVA');
    assert.equal(result.bankCode, '0062');
    assert.equal(result.normalised, 'TR200062000123456789012345');
  });

  test('accepts the same IBAN however the user pasted it', () => {
    for (const variant of [
      'TR200062000123456789012345',
      'tr20 0062 0001 2345 6789 0123 45',
      'TR20-0062-0001-2345-6789-0123-45',
      '  TR20 00620001234567890123 45  ',
    ]) {
      assert.equal(validateTurkishIban(variant).ok, true, variant);
    }
  });

  test('rejects the check digits that phase 2 originally shipped', () => {
    // TR64 was invented by hand and never checksummed. Caught by this test,
    // which is the reason it exists.
    const result = validateTurkishIban('TR64 0062 0001 2345 6789 0123 45');
    assert.equal(result.ok, false);
    assert.ok(!result.ok);
    assert.equal(result.problem, 'bad_checksum');
  });

  test('catches a single transposed digit', () => {
    const transposed = 'TR20 0062 0001 2345 6789 0123 54';
    assert.equal(validateTurkishIban(transposed).ok, false);
  });

  test('rejects wrong country before length', () => {
    const result = validateTurkishIban('DE89370400440532013000');
    assert.ok(!result.ok);
    assert.equal(result.problem, 'wrong_country');
  });

  test('rejects wrong length', () => {
    const result = validateTurkishIban('TR2000620001234567890123');
    assert.ok(!result.ok);
    assert.equal(result.problem, 'bad_length');
  });

  test('rejects empty and non-alphanumeric input', () => {
    const empty = validateTurkishIban('');
    assert.ok(!empty.ok);
    assert.equal(empty.problem, 'empty');

    const junk = validateTurkishIban('TR20/0062*0001@2345#6789!0123$4');
    assert.ok(!junk.ok);
    assert.equal(junk.problem, 'bad_charset');
  });

  test('rejects a valid IBAN at a bank we do not pay out to', () => {
    // Structurally perfect, unknown bank code.
    const body = '99990001234567890123';
    const check = turkishCheckDigits(`${body}45`);
    const result = validateTurkishIban(`TR${check}${body}45`);
    assert.ok(!result.ok);
    assert.equal(result.problem, 'unsupported_bank');
  });
});

describe('turkishCheckDigits', () => {
  test('computes digits that then validate', () => {
    const body = '00620001234567890123';
    const check = turkishCheckDigits(`${body}45`);
    assert.equal(check, '20');
    assert.equal(validateTurkishIban(`TR${check}${body}45`).ok, true);
  });
});

describe('display helpers', () => {
  test('formats in groups of four', () => {
    assert.equal(formatIban('TR200062000123456789012345'), LOCKED);
  });

  test('masks to first four and last four', () => {
    assert.equal(maskIban(LOCKED), 'TR20 ···· 2345');
  });
});
