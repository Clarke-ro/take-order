import assert from 'node:assert/strict';
import test from 'node:test';
import { currencyForCode, currencyForLocation, storeCurrencyOptions } from './currency';

test('uses the locale region before the browser timezone', () => {
  const currency = currencyForLocation({ language: 'en-GH', timeZone: 'Africa/Sao_Tome' });

  assert.equal(currency.currency, 'GHS');
  assert.equal(currency.locale, 'en-GH');
  assert.ok(currency.symbol.length > 0);
});

test('uses the browser timezone when the locale has no region', () => {
  assert.equal(currencyForLocation({ language: 'en', timeZone: 'Africa/Sao_Tome' }).currency, 'STN');
});

test('falls back to a locale region when the timezone is unavailable', () => {
  assert.equal(currencyForLocation({ language: 'en-GB' }).currency, 'GBP');
  assert.equal(currencyForLocation({ language: 'en-GH' }).currency, 'GHS');
});

test('uses GHS as the safe fallback for unknown locations', () => {
  assert.equal(currencyForLocation({ language: 'xx', timeZone: 'Unknown/Place' }).currency, 'GHS');
});

test('resolves an explicit store currency independently of browser location', () => {
  assert.equal(currencyForCode('NGN').currency, 'NGN');
  assert.equal(currencyForCode('ngn').locale, 'en-NG');
  assert.equal(currencyForCode('not-a-currency').currency, 'GHS');
  assert.ok(storeCurrencyOptions.some((option) => option.currency === 'GHS'));
});