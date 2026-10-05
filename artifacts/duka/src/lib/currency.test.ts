import assert from 'node:assert/strict';
import test from 'node:test';
import { currencyForCode, currencyForLanguage, formatCompactMoney, formatMoney, storeCurrencyOptions } from './currency';

test('uses the language region without consulting timezone', () => {
  const currency = currencyForLanguage('en-GH');

  assert.equal(currency?.currency, 'GHS');
  assert.equal(currency?.locale, 'en-GH');
  assert.ok(currency?.symbol.length);
});

test('leaves the picker unselected when language has no region', () => {
  assert.equal(currencyForLanguage('en'), null);
});

test('uses a language region when available', () => {
  assert.equal(currencyForLanguage('en-GB')?.currency, 'GBP');
  assert.equal(currencyForLanguage('en-GH')?.currency, 'GHS');
});

test('leaves unknown locations unselected', () => {
  assert.equal(currencyForLanguage('xx'), null);
});

test('resolves an explicit store currency independently of browser location', () => {
  assert.equal(currencyForCode('NGN').currency, 'NGN');
  assert.equal(currencyForCode('ngn').locale, 'en-NG');
  assert.equal(currencyForCode('not-a-currency').currency, 'GHS');
  assert.ok(storeCurrencyOptions.some((option) => option.currency === 'GHS'));
});

test('formatMoney safely formats null, undefined, zero, and NaN without producing NaN', () => {
  for (const input of [null, undefined, 0, NaN, Number.NaN]) {
    const formatted = formatMoney(input as number);
    assert.ok(!formatted.includes('NaN'), `formatMoney(${input}) produced NaN: "${formatted}"`);
    assert.match(formatted, /0/);
  }
});

test('formatCompactMoney safely formats null, undefined, zero, and NaN without producing NaN', () => {
  for (const input of [null, undefined, 0, NaN, Number.NaN]) {
    const formatted = formatCompactMoney(input as number);
    assert.ok(!formatted.includes('NaN'), `formatCompactMoney(${input}) produced NaN: "${formatted}"`);
    assert.match(formatted, /0/);
  }
});