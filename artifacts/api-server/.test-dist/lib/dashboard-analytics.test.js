// src/lib/dashboard-analytics.test.ts
import assert from "node:assert/strict";
import test from "node:test";

// src/lib/dashboard-analytics.ts
function stockDeltaForOrderStatusChange(previousStatus, nextStatus) {
  if (nextStatus === "paid" && previousStatus !== "paid") return -1;
  if (nextStatus !== "paid" && previousStatus === "paid") return 1;
  return 0;
}
var channelLabels = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  tiktok: "TikTok",
  snapchat: "Snapchat",
  in_person: "In person"
};
var isPaidOrder = (order2) => order2.status === "paid" || order2.status === "deposit_paid";
var orderRevenue = (order2) => order2.status === "deposit_paid" ? Number(order2.depositAmount ?? 0) : Number(order2.amount);
var productCost = (product) => product?.cost == null ? 0 : Number(product.cost);
var orderProductCost = (order2, product) => order2.productCost == null ? productCost(product) : Number(order2.productCost);
var orderHasLegacyCost = (order2) => order2.productCost == null;
var orderHasTrackedCost = (order2) => order2.productCost != null;
function calculateDashboardSummary(products2, orders, operatingExpenseRows, now2 = /* @__PURE__ */ new Date()) {
  const productMap = new Map(products2.map((product) => [product.id, product]));
  const paidOrders = orders.filter(isPaidOrder);
  const revenue = paidOrders.reduce((sum, order2) => sum + orderRevenue(order2), 0);
  const legacyOrders = paidOrders.filter(orderHasLegacyCost);
  const snapshotOrders = paidOrders.length - legacyOrders.length;
  const legacyRevenue = legacyOrders.reduce(
    (sum, order2) => sum + orderRevenue(order2),
    0
  );
  const estimatedProductCosts = legacyOrders.reduce(
    (sum, order2) => sum + productCost(productMap.get(order2.productId)),
    0
  );
  const productCosts = paidOrders.reduce(
    (sum, order2) => sum + orderProductCost(order2, productMap.get(order2.productId)),
    0
  );
  const operatingExpenses = operatingExpenseRows.reduce(
    (sum, expense) => sum + Number(expense.amount),
    0
  );
  const expenses2 = productCosts + operatingExpenses;
  const profit = revenue - expenses2;
  const outstanding = orders.filter((order2) => order2.status === "deposit_paid").reduce(
    (sum, order2) => sum + Math.max(0, Number(order2.amount) - Number(order2.depositAmount ?? 0)),
    0
  );
  const bestSeller = paidOrders.reduce(
    (best, order2) => {
      const count = paidOrders.filter(
        (item) => item.productId === order2.productId
      ).length;
      return count > best.count ? { name: order2.productName, count } : best;
    },
    { name: "No sales yet", count: 0 }
  ).name;
  const channelPerformance = Object.entries(channelLabels).map(([channel, label]) => {
    const matching = orders.filter((order2) => order2.channel === channel);
    const paidMatching = matching.filter(isPaidOrder);
    const opens = matching.reduce((sum, order2) => sum + order2.linkOpens, 0);
    return {
      channel: label,
      revenue: matching.filter((order2) => order2.status !== "reserved").reduce((sum, order2) => sum + orderRevenue(order2), 0),
      orders: matching.filter((order2) => order2.status !== "reserved").length,
      paidOrders: paidMatching.length,
      opens,
      conversionRate: opens ? paidMatching.length / opens * 100 : 0
    };
  }).filter((item) => item.orders > 0 || item.opens > 0);
  const today = new Date(now2);
  const dailyPerformance = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(today);
    day.setHours(0, 0, 0, 0);
    day.setDate(today.getDate() - (6 - index));
    const date = day.toISOString().slice(0, 10);
    const dayOrders = paidOrders.filter(
      (order2) => order2.createdAt.toISOString().slice(0, 10) === date
    );
    const dayRevenue = dayOrders.reduce(
      (sum, order2) => sum + orderRevenue(order2),
      0
    );
    const dayProductCosts = dayOrders.reduce(
      (sum, order2) => sum + orderProductCost(order2, productMap.get(order2.productId)),
      0
    );
    const dayOperatingExpenses = operatingExpenseRows.filter((expense) => expense.expenseDate === date).reduce((sum, expense) => sum + Number(expense.amount), 0);
    const dayExpenses = dayProductCosts + dayOperatingExpenses;
    return {
      date,
      label: day.toLocaleDateString("en-US", { weekday: "short" }),
      revenue: dayRevenue,
      productCosts: dayProductCosts,
      operatingExpenses: dayOperatingExpenses,
      expenses: dayExpenses,
      profit: dayRevenue - dayExpenses,
      orders: dayOrders.length
    };
  });
  const productPerformance = products2.map((product) => {
    const productOrders = paidOrders.filter(
      (order2) => order2.productId === product.id
    );
    const productRevenue = productOrders.reduce(
      (sum, order2) => sum + orderRevenue(order2),
      0
    );
    const productExpenses = productOrders.reduce(
      (sum, order2) => sum + orderProductCost(order2, product),
      0
    );
    const productLegacyOrders = productOrders.filter(orderHasLegacyCost);
    const productSnapshotOrders = productOrders.length - productLegacyOrders.length;
    const costTracked = product.cost != null || productOrders.some(orderHasTrackedCost);
    const marginStatus = !costTracked ? "unavailable" : productLegacyOrders.length ? "estimated" : "tracked";
    return {
      name: product.name,
      category: product.category,
      revenue: productRevenue,
      orders: productOrders.length,
      stock: product.stock,
      margin: costTracked && productRevenue ? (productRevenue - productExpenses) / productRevenue * 100 : 0,
      costTracked,
      marginStatus,
      snapshotOrders: productSnapshotOrders,
      legacyOrders: productLegacyOrders.length
    };
  }).sort((a, b) => b.revenue - a.revenue);
  const lowStock = products2.find((product) => product.stock <= 3);
  const insights = [
    bestSeller !== "No sales yet" ? `${bestSeller} is your best performer this week.` : "Create a Take Order link to start collecting your first sale.",
    lowStock ? `${lowStock.name} is down to ${lowStock.stock} left \u2014 consider restocking.` : "Your stock levels are healthy across the catalog.",
    outstanding > 0 ? `You have GH\u20B5${outstanding.toFixed(0)} in outstanding balances to follow up.` : "No outstanding balances right now.",
    productCosts > 0 ? `Product costs are GH\u20B5${productCosts.toFixed(0)}. Add operating expenses to see your true net profit.` : "Add cost prices to your catalog to unlock gross margin tracking.",
    operatingExpenses > 0 ? `Operating expenses are GH\u20B5${operatingExpenses.toFixed(0)}, included in your cash balance and net profit.` : "Record rent, delivery, ads, or other operating expenses to keep cash flow complete."
  ];
  return {
    revenue,
    productCosts,
    estimatedProductCosts,
    operatingExpenses,
    expenses: expenses2,
    profit,
    cashBalance: revenue - expenses2,
    orders: paidOrders.length,
    snapshotOrders,
    legacyOrders: legacyOrders.length,
    legacyRevenue,
    outstanding,
    bestSeller,
    channelPerformance,
    dailyPerformance,
    productPerformance,
    insights
  };
}

// src/lib/dashboard-analytics.test.ts
var now = /* @__PURE__ */ new Date("2026-09-13T12:00:00.000Z");
var products = [
  { id: 1, name: "Linen set", category: "Apparel", cost: "20.00", stock: 2 },
  { id: 2, name: "Canvas tote", category: "Accessories", cost: null, stock: 10 }
];
var order = (overrides) => ({
  productName: overrides.productId === 1 ? "Linen set" : "Canvas tote",
  channel: "whatsapp",
  amount: 0,
  depositAmount: null,
  createdAt: now,
  linkOpens: 0,
  ...overrides
});
var expenses = [
  { amount: "10.00", expenseDate: "2026-09-13" },
  { amount: "5.00", expenseDate: "2026-09-12" }
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
        linkOpens: 4
      }),
      order({
        productId: 1,
        status: "deposit_paid",
        amount: "80.00",
        depositAmount: "30.00",
        channel: "instagram",
        createdAt: /* @__PURE__ */ new Date("2026-09-12T12:00:00.000Z"),
        linkOpens: 3
      }),
      order({
        productId: 2,
        status: "reserved",
        amount: "50.00",
        channel: "whatsapp",
        linkOpens: 2
      }),
      order({
        productId: 2,
        status: "paid",
        amount: "50.00",
        channel: "snapchat"
      })
    ],
    expenses,
    now
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
      margin: 90 / 130 * 100,
      costTracked: true,
      marginStatus: "estimated",
      snapshotOrders: 0,
      legacyOrders: 2
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
      legacyOrders: 1
    }
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
        linkOpens: 4
      }),
      order({
        productId: 1,
        status: "deposit_paid",
        amount: 80,
        depositAmount: 30,
        channel: "whatsapp",
        linkOpens: 2
      }),
      order({
        productId: 2,
        status: "reserved",
        amount: 50,
        channel: "instagram",
        linkOpens: 5
      })
    ],
    [],
    now
  );
  assert.deepEqual(summary.channelPerformance, [
    {
      channel: "WhatsApp",
      revenue: 130,
      orders: 2,
      paidOrders: 2,
      opens: 6,
      conversionRate: 2 / 6 * 100
    },
    {
      channel: "Instagram",
      revenue: 0,
      orders: 0,
      paidOrders: 0,
      opens: 5,
      conversionRate: 0
    }
  ]);
});
test("keeps a seven-day trend aligned with revenue, costs, and expenses by date", () => {
  const summary = calculateDashboardSummary(
    products,
    [
      order({
        productId: 1,
        status: "paid",
        amount: 100,
        createdAt: now
      }),
      order({
        productId: 1,
        status: "deposit_paid",
        amount: 80,
        depositAmount: 30,
        createdAt: /* @__PURE__ */ new Date("2026-09-12T12:00:00.000Z")
      }),
      order({
        productId: 2,
        status: "reserved",
        amount: 50,
        createdAt: now
      })
    ],
    expenses,
    now
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
    orders: 1
  });
  assert.deepEqual(summary.dailyPerformance.at(-1), {
    date: "2026-09-13",
    label: "Sun",
    revenue: 100,
    productCosts: 20,
    operatingExpenses: 10,
    expenses: 30,
    profit: 70,
    orders: 1
  });
});
test("keeps paid and deposit margins on their sale-time cost after catalog edits", () => {
  const saleOrders = [
    order({
      productId: 1,
      status: "paid",
      amount: "100.00",
      productCost: "20.00",
      createdAt: now
    }),
    order({
      productId: 1,
      status: "deposit_paid",
      amount: "80.00",
      depositAmount: "30.00",
      productCost: "20.00",
      createdAt: /* @__PURE__ */ new Date("2026-09-12T12:00:00.000Z")
    })
  ];
  const originalSummary = calculateDashboardSummary(
    [{ ...products[0], cost: "20.00" }],
    saleOrders,
    [],
    now
  );
  const editedSummary = calculateDashboardSummary(
    [{ ...products[0], cost: "80.00" }],
    saleOrders,
    [],
    now
  );
  assert.equal(originalSummary.productCosts, 40);
  assert.equal(editedSummary.productCosts, 40);
  assert.equal(editedSummary.dailyPerformance.at(-2)?.productCosts, 20);
  assert.equal(editedSummary.dailyPerformance.at(-1)?.productCosts, 20);
  assert.equal(editedSummary.productPerformance[0]?.margin, 90 / 130 * 100);
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
        productCost: "20.00"
      }),
      order({
        productId: 1,
        status: "paid",
        amount: 50
      })
    ],
    [],
    now
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
    margin: 50 / 150 * 100,
    costTracked: true,
    marginStatus: "estimated",
    snapshotOrders: 1,
    legacyOrders: 1
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
