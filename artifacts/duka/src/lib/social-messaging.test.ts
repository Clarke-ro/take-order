import assert from 'node:assert/strict';
import test from 'node:test';
import {
  cleanPhoneForWhatsApp,
  buildOrderConfirmationMessage,
  buildDeliveryDispatchMessage,
  buildPaymentReminderMessage,
  buildClientBalanceReminderMessage,
  buildRiderDispatchSlip,
  buildTextReceipt,
} from './social-messaging';
import type { Order } from '@workspace/api-client-react';

const mockOrder: Order = {
  id: 104,
  ownerUserId: 'seller-1',
  token: 'tok-104',
  productId: 1,
  productName: 'Silk Wrap Dress',
  customerName: 'Adwoa Mensah',
  customerPhone: '+233 24 999 8888',
  channel: 'instagram',
  amount: 250,
  deliveryFee: 20,
  deliveryMethod: 'delivery',
  deliveryAddress: 'House 14, Cantonments, Accra',
  productCost: 120,
  depositAmount: 100,
  paymentMode: 'deposit',
  status: 'deposit_paid',
  fulfillment: 'pending',
  createdAt: '2026-09-23T10:00:00.000Z',
  linkOpens: 5,
  shares: 2,
  likes: 4,
  engagementSource: null,
  referenceImage: null,
  buyerDetails: null,
  items: [
    {
      productId: 1,
      productName: 'Silk Wrap Dress',
      amount: 230,
      quantity: 1,
      preferences: { Size: 'M', Color: 'Emerald' },
    },
  ],
};

test('cleanPhoneForWhatsApp cleans non-digit characters correctly', () => {
  assert.equal(cleanPhoneForWhatsApp('+233 24 999 8888'), '233249998888');
  assert.equal(cleanPhoneForWhatsApp('055-123-4567'), '0551234567');
});

test('buildOrderConfirmationMessage builds a complete friendly message', () => {
  const msg = buildOrderConfirmationMessage({
    order: mockOrder,
    shopName: 'Aura Boutique',
    buyerLink: 'https://takeorder.app/orders/104',
    currencySymbol: 'GH₵',
  });

  assert.ok(msg.includes('Hi Adwoa Mensah! 🛍️'));
  assert.ok(msg.includes('Aura Boutique'));
  assert.ok(msg.includes('0000104'));
  assert.ok(msg.includes('Silk Wrap Dress'));
  assert.ok(msg.includes('Deposit paid: GH₵100.00'));
  assert.ok(msg.includes('Balance on delivery: GH₵150.00'));
  assert.ok(msg.includes('House 14, Cantonments, Accra'));
  assert.ok(msg.includes('https://takeorder.app/orders/104'));
});

test('buildDeliveryDispatchMessage builds out-for-delivery notice with balance', () => {
  const msg = buildDeliveryDispatchMessage({
    order: mockOrder,
    shopName: 'Aura Boutique',
    currencySymbol: 'GH₵',
    riderName: 'Kwesi',
    riderPhone: '0241112233',
  });

  assert.ok(msg.includes('Hi Adwoa Mensah! 🚚'));
  assert.ok(msg.includes('0000104'));
  assert.ok(msg.includes('Kwesi (0241112233)'));
  assert.ok(msg.includes('GH₵150.00'));
});

test('buildPaymentReminderMessage builds balance reminder', () => {
  const msg = buildPaymentReminderMessage({
    order: mockOrder,
    shopName: 'Aura Boutique',
    currencySymbol: 'GH₵',
  });

  assert.ok(msg.includes('GH₵150.00'));
  assert.ok(msg.includes('Due on delivery'));
});

test('buildClientBalanceReminderMessage generates polite client message', () => {
  const msg = buildClientBalanceReminderMessage({
    clientName: 'Adwoa',
    balanceDue: 150,
    shopName: 'Aura Boutique',
    currencySymbol: 'GH₵',
  });

  assert.ok(msg.includes('Hi Adwoa! 👋'));
  assert.ok(msg.includes('GH₵150.00'));
  assert.ok(msg.includes('Aura Boutique'));
});

test('buildRiderDispatchSlip creates clear courier instructions', () => {
  const slip = buildRiderDispatchSlip({
    order: mockOrder,
    shopName: 'Aura Boutique',
    sellerPhone: '0200001122',
    currencySymbol: 'GH₵',
  });

  assert.ok(slip.includes('DELIVERY DISPATCH SLIP'));
  assert.ok(slip.includes('Adwoa Mensah'));
  assert.ok(slip.includes('+233 24 999 8888'));
  assert.ok(slip.includes('House 14, Cantonments, Accra'));
  assert.ok(slip.includes('COLLECT: GH₵150.00'));
  assert.ok(slip.includes('Deposit was paid online'));
});

test('buildTextReceipt generates receipt summary', () => {
  const receipt = buildTextReceipt({
    order: mockOrder,
    shopName: 'Aura Boutique',
    sellerHandle: '@auraboutique',
    currencySymbol: 'GH₵',
  });

  assert.ok(receipt.includes('OFFICIAL RECEIPT'));
  assert.ok(receipt.includes('Aura Boutique'));
  assert.ok(receipt.includes('@auraboutique'));
  assert.ok(receipt.includes('GH₵250.00'));
  assert.ok(receipt.includes('GH₵100.00'));
  assert.ok(receipt.includes('GH₵150.00'));
});

