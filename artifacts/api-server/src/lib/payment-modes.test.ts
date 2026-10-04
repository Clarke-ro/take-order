import assert from "node:assert/strict";
import test from "node:test";
import {
  calculatePaymentAmounts,
  getAllowedModesForLink,
  getOrderCollectedAmount,
  getOrderOutstandingAmount,
} from "@workspace/api-zod";

test("calculatePaymentAmounts: even total pesewas with 50%", () => {
  // Total: 100.00 GHS = 10000 pesewas
  const res = calculatePaymentAmounts(10000, 50);
  assert.equal(res.totalPesewas, 10000);
  assert.equal(res.dueNowPesewas, 5000);
  assert.equal(res.balancePesewas, 5000);
  assert.equal(res.dueNowAmount, 50.00);
  assert.equal(res.balanceAmount, 50.00);
});

test("calculatePaymentAmounts: odd total pesewas with 50% puts remainder on balance", () => {
  // Total: 100.01 GHS = 10001 pesewas
  // 10001 * 0.5 = 5000.5 -> rounded to 5001 or 5000, remainder on balance: total - dueNow
  const res = calculatePaymentAmounts(10001, 50);
  assert.equal(res.totalPesewas, 10001);
  assert.equal(res.dueNowPesewas + res.balancePesewas, 10001);
  assert.equal(res.dueNowPesewas, 5001);
  assert.equal(res.balancePesewas, 5000);
  assert.equal(res.dueNowAmount, 50.01);
  assert.equal(res.balanceAmount, 50.00);
});

test("calculatePaymentAmounts: 25%, 50%, 75% and custom percentage calculations", () => {
  // Total: 33.33 GHS = 3333 pesewas
  // 25% of 3333 = 833.25 -> 833 due now, 2500 balance
  const p25 = calculatePaymentAmounts(3333, 25);
  assert.equal(p25.dueNowPesewas, 833);
  assert.equal(p25.balancePesewas, 2500);
  assert.equal(p25.dueNowPesewas + p25.balancePesewas, 3333);

  // 75% of 3333 = 2499.75 -> 2500 due now, 833 balance
  const p75 = calculatePaymentAmounts(3333, 75);
  assert.equal(p75.dueNowPesewas, 2500);
  assert.equal(p75.balancePesewas, 833);
  assert.equal(p75.dueNowPesewas + p75.balancePesewas, 3333);

  // Custom 33% of 10000 pesewas = 3300 due now, 6700 balance
  const p33 = calculatePaymentAmounts(10000, 33);
  assert.equal(p33.dueNowPesewas, 3300);
  assert.equal(p33.balancePesewas, 6700);

  // Custom 1% of 10000 pesewas = 100 due now, 9900 balance
  const p1 = calculatePaymentAmounts(10000, 1);
  assert.equal(p1.dueNowPesewas, 100);
  assert.equal(p1.balancePesewas, 9900);

  // Custom 99% of 10000 pesewas = 9900 due now, 100 balance
  const p99 = calculatePaymentAmounts(10000, 99);
  assert.equal(p99.dueNowPesewas, 9900);
  assert.equal(p99.balancePesewas, 100);
});

test("getAllowedModesForLink: new link with both switches OFF allows only full payment", () => {
  const modes = getAllowedModesForLink({
    allowReservation: false,
    allowHalfPayment: false,
  });
  assert.deepEqual(Array.from(modes), ["full"]);
});

test("getAllowedModesForLink: new link with reservation ON allows full and reservation", () => {
  const modes = getAllowedModesForLink({
    allowReservation: true,
    allowHalfPayment: false,
  });
  assert.equal(modes.has("full"), true);
  assert.equal(modes.has("reservation"), true);
  assert.equal(modes.has("half"), false);
});

test("getAllowedModesForLink: new link with half payment ON allows full and half", () => {
  const modes = getAllowedModesForLink({
    allowReservation: false,
    allowHalfPayment: true,
  });
  assert.equal(modes.has("full"), true);
  assert.equal(modes.has("reservation"), false);
  assert.equal(modes.has("half"), true);
});

test("getAllowedModesForLink: new link with both ON allows all three modes", () => {
  const modes = getAllowedModesForLink({
    allowReservation: true,
    allowHalfPayment: true,
  });
  assert.equal(modes.has("full"), true);
  assert.equal(modes.has("reservation"), true);
  assert.equal(modes.has("half"), true);
});

test("getAllowedModesForLink: legacy link preservation", () => {
  // Legacy link with paymentMode = 'reserve'
  const legacyReserve = getAllowedModesForLink({
    allowReservation: null,
    allowHalfPayment: null,
    paymentMode: "reserve",
  });
  assert.equal(legacyReserve.has("full"), true);
  assert.equal(legacyReserve.has("reservation"), true);
  assert.equal(legacyReserve.has("half"), false);

  // Legacy link with paymentMode = 'deposit'
  const legacyDeposit = getAllowedModesForLink({
    allowReservation: null,
    allowHalfPayment: null,
    paymentMode: "deposit",
  });
  assert.equal(legacyDeposit.has("full"), true);
  assert.equal(legacyDeposit.has("reservation"), false);
  assert.equal(legacyDeposit.has("half"), true);

  // Legacy link with paymentMode = 'full'
  const legacyFull = getAllowedModesForLink({
    allowReservation: null,
    allowHalfPayment: null,
    paymentMode: "full",
  });
  assert.equal(legacyFull.has("full"), true);
  assert.equal(legacyFull.has("reservation"), false);
  assert.equal(legacyFull.has("half"), false);
});

test("getOrderCollectedAmount and getOrderOutstandingAmount: unified calculation across all order statuses", () => {
  // Paid order
  const paidOrder = { status: "paid", amount: "150.00" };
  assert.equal(getOrderCollectedAmount(paidOrder), 150.00);
  assert.equal(getOrderOutstandingAmount(paidOrder), 0);

  // Deposit paid order using amountDueNow
  const halfOrder1 = { status: "deposit_paid", amount: "200.00", amountDueNow: "100.00" };
  assert.equal(getOrderCollectedAmount(halfOrder1), 100.00);
  assert.equal(getOrderOutstandingAmount(halfOrder1), 100.00);

  // Legacy deposit paid order using depositAmount
  const halfOrder2 = { status: "deposit_paid", amount: "200.00", depositAmount: "50.00" };
  assert.equal(getOrderCollectedAmount(halfOrder2), 50.00);
  assert.equal(getOrderOutstandingAmount(halfOrder2), 150.00);

  // Reserved order
  const reservedOrder = { status: "reserved", amount: "75.00" };
  assert.equal(getOrderCollectedAmount(reservedOrder), 0);
  assert.equal(getOrderOutstandingAmount(reservedOrder), 75.00);

  // Null/undefined order
  assert.equal(getOrderCollectedAmount(null), 0);
  assert.equal(getOrderOutstandingAmount(null), 0);
});
