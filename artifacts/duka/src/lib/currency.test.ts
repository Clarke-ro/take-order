import assert from 'node:assert/strict';
import test from 'node:test';
import { currencyForLocation } from './currency';

test('uses the browser timezone when it identifies a supported location', () => {
  const currency = currencyForLocation({ language: 'en-US', timeZone: 'Africa/Sao_Tome' });

  assert.equal(currency.currency, 'STN');
  assert.equal(currency.locale, 'pt-ST');
  assert.ok(currency.symbol.length > 0);
});

test('falls back to a locale region when the timezone is unavailable', () => {
  assert.equal(currencyForLocation({ language: 'en-GB' }).currency, 'GBP');
  assert.equal(currencyForLocation({ language: 'en-GH' }).currency, 'GHS');
});

test('uses GHS as the safe fallback for unknown locations', () => {
  assert.equal(currencyForLocation({ language: 'xx', timeZone: 'Unknown/Place' }).currency, 'GHS');
});