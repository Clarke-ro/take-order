import test from 'node:test';
import assert from 'node:assert/strict';
import { generateOrdersCsv, sanitizeCsvCell } from './order-export';
import type { Order } from '@workspace/api-client-react';

test('sanitizeCsvCell escapes quotes and commas', () => {
  assert.equal(sanitizeCsvCell('Hello, World'), '"Hello, World"');
  assert.equal(sanitizeCsvCell('Hello "World"'), '"Hello ""World"""');
  assert.equal(sanitizeCsvCell('Simple'), 'Simple');
});

test('sanitizeCsvCell guards against formula injection with single quote prefix', () => {
  assert.equal(sanitizeCsvCell('=SUM(1+1)'), "'=SUM(1+1)");
  assert.equal(sanitizeCsvCell('+123456'), "'+123456");
  assert.equal(sanitizeCsvCell('-50'), "'-50");
  assert.equal(sanitizeCsvCell('@attacker'), "'@attacker");
});

test('generateOrdersCsv formats orders with UTF-8 BOM, exact headers and 2 decimal money', () => {
  const mockOrders: Order[] = [
    {
      id: 101,
      token: 'ord_tok1',
      sellerId: 'seller_1',
      channel: 'whatsapp',
      productName: 'Jordan 4 Sneaker',
      amount: 450,
      currency: 'GHS',
      status: 'paid',
      fulfillment: 'delivered',
      deliveryMethod: 'pickup',
      customerName: 'Kofi Mensah',
      customerPhone: '+233201234567',
      depositAmount: 450,
      createdAt: '2026-10-01T12:00:00Z',
      updatedAt: '2026-10-01T14:00:00Z',
    },
    {
      id: 102,
      token: 'ord_tok2',
      sellerId: 'seller_1',
      channel: 'instagram',
      productName: 'Canvas Tote',
      amount: 120,
      currency: 'GHS',
      status: 'deposit_paid',
      fulfillment: 'pending',
      deliveryMethod: 'delivery',
      customerName: '=FormulaUser',
      customerPhone: '+233249876543',
      depositAmount: 50,
      createdAt: '2026-10-02T09:30:00Z',
      updatedAt: '2026-10-02T09:30:00Z',
    },
  ];

  const csv = generateOrdersCsv(mockOrders, 'GH₵');
  
  // Verify UTF-8 BOM
  assert.ok(csv.startsWith('\uFEFF'), 'CSV must start with UTF-8 BOM');

  // Verify headers
  const lines = csv.replace('\uFEFF', '').trim().split('\r\n');
  assert.equal(lines[0], 'Order ID,Customer,Item,Delivery method,Traffic channel,Order value (GH₵),Collected (GH₵),Outstanding (GH₵),Payment status,Fulfillment status,Date placed');

  // Verify line 1
  assert.equal(lines[1], '#0000101,Kofi Mensah,Jordan 4 Sneaker,Pickup,WhatsApp,450.00,450.00,0.00,Paid in full,Delivered,2026-10-01');

  // Verify line 2 formula protection and outstanding calculation
  assert.equal(lines[2], "#0000102,'=FormulaUser,Canvas Tote,Delivery,Instagram,120.00,50.00,70.00,Deposit paid,To ship,2026-10-02");
});
