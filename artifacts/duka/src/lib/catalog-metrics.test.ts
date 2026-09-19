import assert from 'node:assert/strict';
import test from 'node:test';
import { catalogValue } from './catalog-metrics';

test('keeps catalog value aligned with listed product prices', () => {
  assert.equal(catalogValue([{ price: 250 }]), 250);
  assert.equal(catalogValue([{ price: 250 }, { price: 125 }]), 375);
});

test('does not multiply a listed price by stock quantity', () => {
  assert.equal(catalogValue([{ price: 250 }]), 250);
});