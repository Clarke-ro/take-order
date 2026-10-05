import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateAttentionSummary,
  TWENTY_FOUR_HOURS_MS,
  type AttentionOrderInput,
  type AttentionProductInput,
} from "./attention";

test("calculateAttentionSummary: basic counts for all four cards", () => {
  const orders: AttentionOrderInput[] = [
    { id: 1, fulfillment: "pending", status: "paid", amount: 100, createdAt: new Date() },
    { id: 2, fulfillment: "shipped", status: "paid", amount: 50, createdAt: new Date() },
    { id: 3, fulfillment: "pending", status: "reserved", amount: 200, createdAt: new Date() },
    { id: 4, fulfillment: "delivered", status: "deposit_paid", amount: 300, createdAt: new Date() },
  ];

  const products: AttentionProductInput[] = [
    { id: 1, stock: 2, cost: 20 },      // Low stock (<= 3)
    { id: 2, stock: 0, cost: null },    // Low stock AND Missing cost
    { id: 3, stock: 10, cost: 0 },      // Missing cost (cost <= 0)
    { id: 4, stock: 5, cost: 15 },      // Normal stock & tracked cost
  ];

  const summary = calculateAttentionSummary(orders, products, {});

  // Orders to ship: orders with fulfillment === 'pending' (id 1, 3) -> count = 2
  assert.equal(summary.cards.orders_to_ship.count, 2);

  // Low stock: products with stock <= 3 (id 1, 2) -> count = 2
  assert.equal(summary.cards.low_stock.count, 2);

  // Unpaid orders: status === 'reserved' or 'deposit_paid' (id 3, 4) -> count = 2
  assert.equal(summary.cards.unpaid_orders.count, 2);

  // Missing costs: cost == null or <= 0 (id 2, 3) -> count = 2
  assert.equal(summary.cards.missing_costs.count, 2);
});

test("calculateAttentionSummary: newCount detects items created after last seen and within 24h", () => {
  const now = new Date("2026-10-05T12:00:00Z");
  const twoHoursAgo = new Date("2026-10-05T10:00:00Z");
  const threeHoursAgo = new Date("2026-10-05T09:00:00Z");

  const orders: AttentionOrderInput[] = [
    // Created 2 hours ago (new relative to last seen at 3 hours ago)
    { id: 1, fulfillment: "pending", status: "reserved", amount: 100, createdAt: twoHoursAgo },
  ];

  const products: AttentionProductInput[] = [];

  // Seller last saw the card 3 hours ago
  const seenMap = {
    orders_to_ship: threeHoursAgo,
    unpaid_orders: threeHoursAgo,
  };

  const summary = calculateAttentionSummary(orders, products, seenMap, now);

  assert.equal(summary.cards.orders_to_ship.count, 1);
  assert.equal(summary.cards.orders_to_ship.newCount, 1);
  assert.deepEqual(summary.cards.orders_to_ship.newItemIds, [1]);

  assert.equal(summary.cards.unpaid_orders.count, 1);
  assert.equal(summary.cards.unpaid_orders.newCount, 1);
  assert.deepEqual(summary.cards.unpaid_orders.newItemIds, [1]);

  // Sidebar badge equals the card's newCount
  assert.equal(summary.sidebarOrders.newCount, summary.cards.orders_to_ship.newCount);
});

test("calculateAttentionSummary: 24h expiry prevents stale items from being marked as new", () => {
  const now = new Date("2026-10-05T12:00:00Z");
  const twentyFiveHoursAgo = new Date("2026-10-04T11:00:00Z");

  const orders: AttentionOrderInput[] = [
    // Created 25 hours ago
    { id: 1, fulfillment: "pending", status: "paid", amount: 100, createdAt: twentyFiveHoursAgo },
  ];

  // Seller has NEVER seen the card (seenMap empty)
  const summary = calculateAttentionSummary(orders, [], {}, now);

  // Still counted in pending orders
  assert.equal(summary.cards.orders_to_ship.count, 1);
  // But newCount MUST be 0 because it's older than 24 hours!
  assert.equal(summary.cards.orders_to_ship.newCount, 0);
  assert.deepEqual(summary.cards.orders_to_ship.newItemIds, []);
  assert.equal(summary.sidebarOrders.newCount, 0);
});

test("calculateAttentionSummary: marking seen clears newCount to zero", () => {
  const now = new Date("2026-10-05T12:00:00Z");
  const oneHourAgo = new Date("2026-10-05T11:00:00Z");

  const orders: AttentionOrderInput[] = [
    { id: 1, fulfillment: "pending", status: "reserved", amount: 150, createdAt: oneHourAgo },
  ];

  // Seller opens destination now (seenAt = now)
  const seenMap = {
    orders_to_ship: now,
    orders: now,
    unpaid_orders: now,
  };

  const summary = calculateAttentionSummary(orders, [], seenMap, now);

  assert.equal(summary.cards.orders_to_ship.count, 1);
  assert.equal(summary.cards.orders_to_ship.newCount, 0);
  assert.deepEqual(summary.cards.orders_to_ship.newItemIds, []);
  assert.equal(summary.cards.unpaid_orders.count, 1);
  assert.equal(summary.cards.unpaid_orders.newCount, 0);
  assert.equal(summary.sidebarOrders.newCount, 0);
});

test("calculateAttentionSummary: low stock and missing costs always skip newCount (0) and row dots", () => {
  const products: AttentionProductInput[] = [
    { id: 1, stock: 1, cost: null },
    { id: 2, stock: 2, cost: 0 },
  ];

  const summary = calculateAttentionSummary([], products, {});

  assert.equal(summary.cards.low_stock.count, 2);
  assert.equal(summary.cards.low_stock.newCount, 0);
  assert.deepEqual(summary.cards.low_stock.newItemIds, []);

  assert.equal(summary.cards.missing_costs.count, 2);
  assert.equal(summary.cards.missing_costs.newCount, 0);
  assert.deepEqual(summary.cards.missing_costs.newItemIds, []);
});

test("calculateAttentionSummary: sidebar badge strictly agrees with cards.orders_to_ship.newCount", () => {
  const now = new Date("2026-10-05T12:00:00Z");
  const thirtyMinsAgo = new Date("2026-10-05T11:30:00Z");
  const twoHoursAgo = new Date("2026-10-05T10:00:00Z");

  const orders: AttentionOrderInput[] = [
    { id: 10, fulfillment: "pending", status: "paid", amount: 80, createdAt: thirtyMinsAgo },
    { id: 11, fulfillment: "pending", status: "paid", amount: 90, createdAt: thirtyMinsAgo },
    { id: 12, fulfillment: "shipped", status: "paid", amount: 100, createdAt: thirtyMinsAgo },
  ];

  const seenMap = { orders_to_ship: twoHoursAgo };
  const summary = calculateAttentionSummary(orders, [], seenMap, now);

  assert.equal(summary.cards.orders_to_ship.newCount, 2);
  assert.equal(summary.sidebarOrders.newCount, 2);
  assert.equal(summary.sidebarOrders.newCount, summary.cards.orders_to_ship.newCount);
});
