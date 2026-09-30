import assert from 'node:assert/strict';
import test from 'node:test';
import { catalogValue } from './catalog-metrics';

test('calculates catalog value including stock count', () => {
  assert.equal(catalogValue([{ price: 250, stock: 4 }]), 1000);
  assert.equal(catalogValue([{ price: 250, stock: 2 }, { price: 125, stock: 3 }]), 875);
});

test('handles out of stock items and fallback stock count', () => {
  assert.equal(catalogValue([{ price: 250, stock: 0 }]), 0);
  assert.equal(catalogValue([{ price: 250 }]), 250);
});