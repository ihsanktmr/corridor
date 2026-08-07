import assert from 'node:assert/strict';
import { test, describe } from 'node:test';

import { add, format, formatBare, money, parseAmount, rescale, subtract, sum } from './money.ts';
import { convert, formatRate, rateFromDecimal } from './rate.ts';

const NOW = '2026-08-03T14:22:00.000Z';

describe('parseAmount', () => {
  test('parses USD to cents', () => {
    assert.equal(parseAmount('USD', '500.00').minor, 50_000n);
    assert.equal(parseAmount('USD', '503.75').minor, 50_375n);
    assert.equal(parseAmount('USD', '0.01').minor, 1n);
  });

  test('parses USDC to 6 decimals', () => {
    assert.equal(parseAmount('USDC', '500.00').minor, 500_000_000n);
    assert.equal(parseAmount('USDC', '0.000001').minor, 1n);
  });

  test('tolerates grouping separators from pasted input', () => {
    assert.equal(parseAmount('TRY', '26,420.00').minor, 2_642_000n);
  });

  test('refuses more precision than the currency carries', () => {
    assert.throws(() => parseAmount('USD', '1.234'), RangeError);
  });

  test('refuses non-numeric input', () => {
    assert.throws(() => parseAmount('USD', ''), RangeError);
    assert.throws(() => parseAmount('USD', '12.3.4'), RangeError);
    assert.throws(() => parseAmount('USD', 'abc'), RangeError);
  });
});

describe('arithmetic', () => {
  test('refuses to combine different currencies', () => {
    assert.throws(() => add(money('USD', 1n), money('TRY', 1n)), TypeError);
    assert.throws(() => subtract(money('USDC', 1n), money('USD', 1n)), TypeError);
  });

  test('sums fee lines exactly', () => {
    const fees = [
      parseAmount('USD', '1.25'),
      parseAmount('USD', '0.01'),
      parseAmount('USD', '2.49'),
    ];
    assert.equal(format(sum('USD', fees)), '$3.75');
  });
});

describe('rescale: the USD/USDC precision boundary', () => {
  test('scales up exactly across 10^4', () => {
    const usd = parseAmount('USD', '500.00');
    assert.equal(rescale(usd, 'USDC').minor, 500_000_000n);
  });

  test('scales down when exact', () => {
    const usdc = parseAmount('USDC', '500.00');
    assert.equal(rescale(usdc, 'USD').minor, 50_000n);
  });

  test('refuses to scale down lossily rather than truncating', () => {
    // 500.000001 USDC has no USD representation. Silently dropping the remainder
    // is how a ledger stops balancing, so this must throw.
    const dusty = parseAmount('USDC', '500.000001');
    assert.throws(() => rescale(dusty, 'USD'), RangeError);
  });
});

describe('format', () => {
  test('groups thousands and carries the right symbol', () => {
    assert.equal(format(parseAmount('USD', '503.75')), '$503.75');
    assert.equal(format(parseAmount('TRY', '26420.00')), '₺26,420.00');
    assert.equal(format(parseAmount('USDC', '1284.50')), '1,284.500000 USDC');
  });

  test('handles sub-unit and negative amounts', () => {
    assert.equal(format(parseAmount('USD', '0.01')), '$0.01');
    assert.equal(format(parseAmount('USD', '-3.75')), '-$3.75');
  });

  test('formatBare drops the symbol for paired currency labels', () => {
    assert.equal(formatBare(parseAmount('TRY', '26420.00')), '26,420.00');
    assert.equal(formatBare(parseAmount('USDC', '500.00')), '500.000000');
  });
});

describe('rate: rationals, never floats', () => {
  test('parses a decimal rate losslessly', () => {
    const r = rateFromDecimal('USD', 'TRY', '52.84', NOW);
    assert.equal(r.num, 5284n);
    assert.equal(r.den, 100n);
    assert.equal(formatRate(r), '52.84');
  });

  test('the locked demo conversion is exact', () => {
    const r = rateFromDecimal('USD', 'TRY', '52.84', NOW);
    const received = convert(parseAmount('USD', '500.00'), r);
    assert.equal(received.currency, 'TRY');
    assert.equal(received.minor, 2_642_000n);
    assert.equal(format(received), '₺26,420.00');
  });

  test('a float rate would not survive this', () => {
    // 0.1 + 0.2 !== 0.3 in IEEE 754. The rational path has no such failure mode.
    const r = rateFromDecimal('USD', 'TRY', '0.3', NOW);
    const viaRational = convert(parseAmount('USD', '100.00'), r);
    assert.equal(viaRational.minor, 3_000n); // ₺30.00, exactly
  });

  test('rounds half-up on the final minor unit', () => {
    // 1.005 USD at 1.0 → exactly representable; use a rate that forces a half.
    const r = rateFromDecimal('USD', 'TRY', '1.005', NOW);
    // 100 cents * 1005 / 1000 = 100.5 → 101
    assert.equal(convert(money('USD', 100n), r).minor, 101n);
  });

  test('refuses a rate applied to the wrong currency', () => {
    const r = rateFromDecimal('USD', 'TRY', '52.84', NOW);
    assert.throws(() => convert(parseAmount('TRY', '100.00'), r), TypeError);
  });
});
