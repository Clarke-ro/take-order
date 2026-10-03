import assert from "node:assert/strict";
import test from "node:test";
import {
  computeFairComparisonRange,
  computePeriodComparison,
  generateReportDetailData,
  type ReportAnalyticsOrder,
} from "./report-analytics.js";
import {
  canAccessReport,
  REPORT_CATALOG,
  getReportConfig,
} from "@workspace/api-zod";
import type { AnalyticsProduct, AnalyticsExpense } from "./dashboard-analytics.js";

const fixedNow = new Date("2026-10-03T12:00:00.000Z");
const tz = "Africa/Accra";

const mockProducts: AnalyticsProduct[] = [
  { id: 1, name: "Silk Shirt", category: "Apparel", cost: "50.00", stock: 12 },
  { id: 2, name: "Gold Bracelet", category: "Jewelry", cost: "120.00", stock: 2 },
  { id: 3, name: "Lip Gloss", category: "Cosmetics", cost: "10.00", stock: 0 },
];

const mockOrders: ReportAnalyticsOrder[] = [
  // Current Period Orders (Oct 1 - Oct 3, 2026)
  {
    id: 101,
    productId: 1,
    productName: "Silk Shirt",
    channel: "whatsapp",
    amount: 150,
    depositAmount: null,
    createdAt: new Date("2026-10-01T10:00:00.000Z"),
    linkOpens: 5,
    status: "paid",
    itemCount: 1,
    customerName: "Ama Mensah",
    customerPhone: "+233241112233",
    fulfillment: "delivered",
  },
  {
    id: 102,
    productId: 1,
    productName: "Silk Shirt",
    channel: "whatsapp",
    amount: 300,
    depositAmount: null,
    createdAt: new Date("2026-10-02T11:00:00.000Z"),
    linkOpens: 3,
    status: "paid",
    itemCount: 2,
    customerName: "Kofi Boateng",
    customerPhone: "+233244445566",
    fulfillment: "confirmed",
  },
  {
    id: 103,
    productId: 2,
    productName: "Gold Bracelet",
    channel: "instagram",
    amount: 400,
    depositAmount: 150,
    createdAt: new Date("2026-10-02T15:30:00.000Z"),
    linkOpens: 10,
    status: "deposit_paid",
    itemCount: 1,
    customerName: "Ama Mensah",
    customerPhone: "+233241112233",
    fulfillment: "pending",
  },
  {
    id: 104,
    productId: 2,
    productName: "Gold Bracelet",
    channel: "instagram",
    amount: 400,
    depositAmount: null,
    createdAt: new Date("2026-10-03T09:00:00.000Z"),
    linkOpens: 2,
    status: "paid",
    itemCount: 1,
    customerName: "Esi Badu",
    customerPhone: "+233209998877",
    fulfillment: "delivered",
  },
  {
    id: 105,
    productId: 1,
    productName: "Silk Shirt",
    channel: "web",
    amount: 150,
    depositAmount: null,
    createdAt: new Date("2026-10-03T16:00:00.000Z"),
    linkOpens: 4,
    status: "paid",
    itemCount: 1,
    customerName: "Yaw Darko",
    customerPhone: "+233271234567",
    fulfillment: "delivered",
  },

  // Previous Period Orders (Sep 1 - Sep 3, 2026)
  {
    id: 91,
    productId: 1,
    productName: "Silk Shirt",
    channel: "whatsapp",
    amount: 150,
    depositAmount: null,
    createdAt: new Date("2026-09-01T10:00:00.000Z"),
    linkOpens: 2,
    status: "paid",
    itemCount: 1,
    customerName: "Ama Mensah",
    customerPhone: "+233241112233",
    fulfillment: "delivered",
  },
  {
    id: 92,
    productId: 1,
    productName: "Silk Shirt",
    channel: "whatsapp",
    amount: 150,
    depositAmount: null,
    createdAt: new Date("2026-09-02T14:00:00.000Z"),
    linkOpens: 1,
    status: "paid",
    itemCount: 1,
    customerName: "Kwame Osei",
    customerPhone: "+233248889900",
    fulfillment: "delivered",
  },
  {
    id: 93,
    productId: 2,
    productName: "Gold Bracelet",
    channel: "whatsapp",
    amount: 400,
    depositAmount: null,
    createdAt: new Date("2026-09-02T16:00:00.000Z"),
    linkOpens: 6,
    status: "paid",
    itemCount: 1,
    customerName: "Kojo Appiah",
    customerPhone: "+233501234123",
    fulfillment: "delivered",
  },
  {
    id: 94,
    productId: 2,
    productName: "Gold Bracelet",
    channel: "whatsapp",
    amount: 400,
    depositAmount: null,
    createdAt: new Date("2026-09-03T11:00:00.000Z"),
    linkOpens: 3,
    status: "paid",
    itemCount: 1,
    customerName: "Akua Konadu",
    customerPhone: "+233549876543",
    fulfillment: "delivered",
  },
  {
    id: 95,
    productId: 1,
    productName: "Silk Shirt",
    channel: "whatsapp",
    amount: 150,
    depositAmount: null,
    createdAt: new Date("2026-09-03T13:00:00.000Z"),
    linkOpens: 2,
    status: "paid",
    itemCount: 1,
    customerName: "Kwame Osei",
    customerPhone: "+233248889900",
    fulfillment: "delivered",
  },
];

const mockExpenses: AnalyticsExpense[] = [
  { id: 1, amount: "50.00", expenseDate: "2026-10-02", category: "shipping", title: "Rider dispatch" },
  { id: 2, amount: "30.00", expenseDate: "2026-09-02", category: "shipping", title: "Rider dispatch" },
];

test("computeFairComparisonRange clamps ongoing month to same days in prior month", () => {
  const result = computeFairComparisonRange("2026-10-01", "2026-10-03", "previous_period", fixedNow, tz);
  assert.equal(result.isFairMtd, true);
  assert.equal(result.compareFrom, "2026-09-01");
  assert.equal(result.compareTo, "2026-09-03");
});

test("computeFairComparisonRange uses full previous month for concluded historical month", () => {
  const result = computeFairComparisonRange("2026-08-01", "2026-08-31", "previous_period", fixedNow, tz);
  assert.equal(result.isFairMtd, false);
  assert.equal(result.compareFrom, "2026-07-01");
  assert.equal(result.compareTo, "2026-07-31");
});

test("computePeriodComparison accurately calculates deltas and fair MTD comparison", () => {
  const comparison = computePeriodComparison(
    mockProducts,
    mockOrders,
    mockExpenses,
    "2026-10-01",
    "2026-10-03",
    "2026-09-01",
    "2026-09-03",
    fixedNow,
    tz,
    true
  );

  assert.equal(comparison.hasEnoughData, true);
  assert.equal(comparison.previousRange.isFairMtd, true);
  assert.ok(comparison.metrics.length >= 8);

  // Revenue metric: Current = 150 + 300 + 150(deposit) + 400 + 150 = 1150
  // Previous = 150 + 150 + 400 + 400 + 150 = 1250
  const revMetric = comparison.metrics.find((m) => m.id === "revenue");
  assert.ok(revMetric);
  assert.equal(revMetric.current, 1150);
  assert.equal(revMetric.previous, 1250);
  assert.equal(revMetric.changePercent, -8); // -8.0%

  // Expenses lower is better flag
  const expMetric = comparison.metrics.find((m) => m.id === "expenses");
  assert.ok(expMetric);
  assert.equal(expMetric.lowerIsBetter, true);

  // Check what's working mini cards
  assert.ok(comparison.whatsWorking.topChannel);
  assert.ok(comparison.whatsWorking.topProduct);
  assert.ok(comparison.whatsWorking.bestWeekday);

  // Check deterministic insights exist
  assert.ok(comparison.insights.length > 0);
});

test("computePeriodComparison returns 'New' when previous value is 0 and current > 0", () => {
  // Scenario: channel has 0 in previous period, some in current period
  const comparison = computePeriodComparison(
    mockProducts,
    mockOrders,
    mockExpenses,
    "2026-10-01",
    "2026-10-03",
    "2026-09-01",
    "2026-09-03",
    fixedNow,
    tz,
    true
  );

  // Instagram had 0 in Sep 1-3, but 550 in Oct 1-3
  const instagramGainer = comparison.gainers.find((g) => g.name.toLowerCase() === "instagram");
  if (instagramGainer) {
    assert.equal(instagramGainer.changePercent, null); // Marked as New (null percent)
  }
});

test("computePeriodComparison displays neutral guard when sample is under 5 orders", () => {
  const tinyOrders = mockOrders.slice(0, 2); // only 2 orders
  const comparison = computePeriodComparison(
    mockProducts,
    tinyOrders,
    mockExpenses,
    "2026-10-01",
    "2026-10-03",
    "2026-09-01",
    "2026-09-03",
    fixedNow,
    tz,
    false
  );

  assert.equal(comparison.hasEnoughData, false);
  assert.ok(
    comparison.insights.some((i) => i.includes("Not enough data yet") || i.includes("at least 5 orders"))
  );
});

test("generateReportDetailData generates valid response for all 11 catalog reports", () => {
  for (const item of REPORT_CATALOG) {
    const reportData = generateReportDetailData({
      slug: item.slug,
      products: mockProducts,
      orders: mockOrders,
      expenses: mockExpenses,
      from: "2026-10-01",
      to: "2026-10-03",
      compareFrom: "2026-09-01",
      compareTo: "2026-09-03",
      isFairMtd: true,
      timezone: tz,
      currency: "GH₵",
    });

    assert.equal(reportData.report.slug, item.slug);
    assert.ok(reportData.kpis.length > 0, `Report ${item.slug} must have at least 1 KPI`);
    assert.ok(reportData.calculationNote.length > 0, `Report ${item.slug} must have a calculation note`);
    assert.ok(Array.isArray(reportData.summaryBullets), `Report ${item.slug} must have summary bullets array`);
  }
});

test("Plan Gating verifies tier access correctly", () => {
  // Free reports
  assert.equal(canAccessReport("free", "sales-summary"), true);
  assert.equal(canAccessReport("free", "sales-over-time"), true);
  assert.equal(canAccessReport("free", "sales-by-channel"), true);
  assert.equal(canAccessReport("free", "orders-overview"), true);
  assert.equal(canAccessReport("free", "expenses"), true);
  assert.equal(canAccessReport("free", "inventory-health"), true);

  // Pro reports locked for free
  assert.equal(canAccessReport("free", "product-performance"), false);
  assert.equal(canAccessReport("free", "best-times-to-sell"), false);
  assert.equal(canAccessReport("free", "payments-and-outstanding"), false);
  assert.equal(canAccessReport("free", "profit-and-margin"), false);
  assert.equal(canAccessReport("free", "customer-insights"), false);

  // Pro reports unlocked for pro and pro_plus
  assert.equal(canAccessReport("pro", "product-performance"), true);
  assert.equal(canAccessReport("pro", "profit-and-margin"), true);
  assert.equal(canAccessReport("pro_plus", "customer-insights"), true);
});
