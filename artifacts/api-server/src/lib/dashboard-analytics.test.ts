import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateDashboardSummary,
  stockDeltaForOrderStatusChange,
  type AnalyticsExpense,
  type AnalyticsOrder,
  type AnalyticsProduct,
} from "./dashboard-analytics.js";

const now = new Date("2026-09-13T12:00:00.000Z");
const products: AnalyticsProduct[] = [
  { id: 1, name: "Linen set", category: "Apparel", cost: "20.00", stock: 2 },
  { id: 2, name: "Canvas tote", category: "Accessories", cost: null, stock: 10 },
];

const order = (
  overrides: Partial<AnalyticsOrder> & Pick<AnalyticsOrder, "status" | "productId">,
): AnalyticsOrder => ({
  productName: overrides.productId === 1 ? "Linen set" : "Canvas tote",
  channel: "whatsapp",
  amount: 0,
  depositAmount: null,
  createdAt: now,
  linkOpens: 0,
  ...overrides,
});

const expenses: AnalyticsExpense[] = [
  { amount: "10.00", expenseDate: "2026-09-13" },
  { amount: "5.00", expenseDate: "2026-09-12" },
];

test("includes full, deposit, and excludes reserved orders from paid analytics", () => {
  const summary = calculateDashboardSummary(
    products,
    [
      order({
        productId: 1,
        status: "paid",
        amount: "100.00",
        channel: "whatsapp",
        linkOpens: 4,
      }),
      order({
        productId: 1,
        status: "deposit_paid",
        amount: "80.00",
        depositAmount: "30.00",
        channel: "instagram",
        createdAt: new Date("2026-09-12T12:00:00.000Z"),
        linkOpens: 3,
      }),
      order({
        productId: 2,
        status: "reserved",
        amount: "50.00",
        channel: "whatsapp",
        linkOpens: 2,
      }),
      order({
        productId: 2,
        status: "paid",
        amount: "50.00",
        channel: "snapchat",
      }),
    ],
    expenses,
    now,
  );

  assert.equal(summary.revenue, 180);
  assert.equal(summary.orders, 3);
  assert.equal(summary.snapshotOrders, 0);
  assert.equal(summary.legacyOrders, 3);
  assert.equal(summary.legacyRevenue, 180);
  assert.equal(summary.productCosts, 40);
  assert.equal(summary.estimatedProductCosts, 40);
  assert.equal(summary.operatingExpenses, 15);
  assert.equal(summary.expenses, 55);
  assert.equal(summary.profit, 125);
  assert.equal(summary.cashBalance, 125);
  assert.equal(summary.outstanding, 50);
  assert.equal(summary.bestSeller, "Linen set");
  assert.deepEqual(summary.productPerformance, [
    {
      name: "Linen set",
      category: "Apparel",
      revenue: 130,
      orders: 2,
      stock: 2,
      margin: (90 / 130) * 100,
      costTracked: true,
      marginStatus: "estimated",
      snapshotOrders: 0,
      legacyOrders: 2,
    },
    {
      name: "Canvas tote",
      category: "Accessories",
      revenue: 50,
      orders: 1,
      stock: 10,
      margin: 0,
      costTracked: false,
      marginStatus: "unavailable",
      snapshotOrders: 0,
      legacyOrders: 1,
    },
  ]);
});

test("calculates channel conversion from paid orders over link opens", () => {
  const summary = calculateDashboardSummary(
    products,
    [
      order({
        productId: 1,
        status: "paid",
        amount: 100,
        channel: "whatsapp",
        linkOpens: 4,
      }),
      order({
        productId: 1,
        status: "deposit_paid",
        amount: 80,
        depositAmount: 30,
        channel: "whatsapp",
        linkOpens: 2,
      }),
      order({
        productId: 2,
        status: "reserved",
        amount: 50,
        channel: "instagram",
        linkOpens: 5,
      }),
    ],
    [],
    now,
  );

  assert.deepEqual(summary.channelPerformance, [
    {
      channel: "WhatsApp",
      revenue: 130,
      orders: 2,
      paidOrders: 2,
      opens: 6,
      conversionRate: (2 / 6) * 100,
    },
    {
      channel: "Instagram",
      revenue: 0,
      orders: 0,
      paidOrders: 0,
      opens: 5,
      conversionRate: 0,
    },
  ]);
});

test("scopes recorded engagement to custom ranges and preserves unavailable totals", () => {
  const summary = calculateDashboardSummary(
    products,
    [
      order({
        productId: 1,
        status: "paid",
        amount: 100,
        shares: 7,
        likes: null,
        createdAt: new Date("2026-09-13T12:00:00.000Z"),
      }),
      order({
        productId: 2,
        status: "reserved",
        amount: 50,
        shares: null,
        likes: 0,
        createdAt: new Date("2026-09-12T12:00:00.000Z"),
      }),
      order({
        productId: 1,
        status: "paid",
        amount: 100,
        shares: 100,
        likes: 200,
        createdAt: new Date("2026-08-31T12:00:00.000Z"),
      }),
    ],
    [],
    now,
    { from: "2026-09-12", to: "2026-09-13" },
  );

  assert.equal(summary.shares, 7);
  assert.equal(summary.likes, 0);

  const unavailable = calculateDashboardSummary(
    products,
    [order({ productId: 1, status: "paid", amount: 100 })],
    [],
    now,
  );
  assert.equal(unavailable.shares, null);
  assert.equal(unavailable.likes, null);
});

test("keeps a seven-day trend aligned with revenue, costs, and expenses by date", () => {
  const summary = calculateDashboardSummary(
    products,
    [
      order({
        productId: 1,
        status: "paid",
        amount: 100,
        createdAt: now,
      }),
      order({
        productId: 1,
        status: "deposit_paid",
        amount: 80,
        depositAmount: 30,
        createdAt: new Date("2026-09-12T12:00:00.000Z"),
      }),
      order({
        productId: 2,
        status: "reserved",
        amount: 50,
        createdAt: now,
      }),
    ],
    expenses,
    now,
  );

  assert.equal(summary.dailyPerformance.length, 7);
  assert.deepEqual(summary.dailyPerformance.at(-2), {
    date: "2026-09-12",
    label: "Sat",
    revenue: 30,
    productCosts: 20,
    operatingExpenses: 5,
    expenses: 25,
    profit: 5,
    orders: 1,
  });
  assert.deepEqual(summary.dailyPerformance.at(-1), {
    date: "2026-09-13",
    label: "Sun",
    revenue: 100,
    productCosts: 20,
    operatingExpenses: 10,
    expenses: 30,
    profit: 70,
    orders: 1,
  });
});

test("keeps paid and deposit margins on their sale-time cost after catalog edits", () => {
  const saleOrders = [
    order({
      productId: 1,
      status: "paid",
      amount: "100.00",
      productCost: "20.00",
      createdAt: now,
    }),
    order({
      productId: 1,
      status: "deposit_paid",
      amount: "80.00",
      depositAmount: "30.00",
      productCost: "20.00",
      createdAt: new Date("2026-09-12T12:00:00.000Z"),
    }),
  ];
  const originalSummary = calculateDashboardSummary(
    [{ ...products[0], cost: "20.00" }],
    saleOrders,
    [],
    now,
  );
  const editedSummary = calculateDashboardSummary(
    [{ ...products[0], cost: "80.00" }],
    saleOrders,
    [],
    now,
  );

  assert.equal(originalSummary.productCosts, 40);
  assert.equal(editedSummary.productCosts, 40);
  assert.equal(editedSummary.dailyPerformance.at(-2)?.productCosts, 20);
  assert.equal(editedSummary.dailyPerformance.at(-1)?.productCosts, 20);
  assert.equal(editedSummary.productPerformance[0]?.margin, (90 / 130) * 100);
  assert.equal(editedSummary.productPerformance[0]?.costTracked, true);
  assert.equal(editedSummary.productPerformance[0]?.marginStatus, "tracked");
  assert.equal(editedSummary.snapshotOrders, 2);
  assert.equal(editedSummary.legacyOrders, 0);
  assert.equal(editedSummary.legacyRevenue, 0);
  assert.equal(editedSummary.estimatedProductCosts, 0);
});

test("labels mixed snapshot and legacy sales as estimated and exposes the affected totals", () => {
  const summary = calculateDashboardSummary(
    [{ ...products[0], cost: "80.00" }],
    [
      order({
        productId: 1,
        status: "paid",
        amount: 100,
        productCost: "20.00",
      }),
      order({
        productId: 1,
        status: "paid",
        amount: 50,
      }),
    ],
    [],
    now,
  );

  assert.equal(summary.productCosts, 100);
  assert.equal(summary.estimatedProductCosts, 80);
  assert.equal(summary.snapshotOrders, 1);
  assert.equal(summary.legacyOrders, 1);
  assert.equal(summary.legacyRevenue, 50);
  assert.deepEqual(summary.productPerformance[0], {
    name: "Linen set",
    category: "Apparel",
    revenue: 150,
    orders: 2,
    stock: 2,
    margin: (50 / 150) * 100,
    costTracked: true,
    marginStatus: "estimated",
    snapshotOrders: 1,
    legacyOrders: 1,
  });
});

test("returns safe empty analytics when there is no activity", () => {
  const summary = calculateDashboardSummary([], [], [], now);

  assert.equal(summary.revenue, 0);
  assert.equal(summary.orders, 0);
  assert.equal(summary.bestSeller, "No sales yet");
  assert.equal(summary.outstanding, 0);
  assert.equal(summary.snapshotOrders, 0);
  assert.equal(summary.legacyOrders, 0);
  assert.equal(summary.legacyRevenue, 0);
  assert.equal(summary.estimatedProductCosts, 0);
  assert.deepEqual(summary.channelPerformance, []);
  assert.deepEqual(summary.productPerformance, []);
  assert.equal(summary.dailyPerformance.length, 7);
});

test("adjusts stock only when an order enters or leaves the paid state", () => {
  assert.equal(stockDeltaForOrderStatusChange("reserved", "paid"), -1);
  assert.equal(stockDeltaForOrderStatusChange("deposit_paid", "paid"), -1);
  assert.equal(stockDeltaForOrderStatusChange("paid", "deposit_paid"), 1);
  assert.equal(stockDeltaForOrderStatusChange("paid", "reserved"), 1);
  assert.equal(stockDeltaForOrderStatusChange("reserved", "deposit_paid"), 0);
  assert.equal(stockDeltaForOrderStatusChange("paid", "paid"), 0);
});