import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import {
  expensesTable,
  ordersTable,
  productsTable,
} from "@workspace/db/schema";
import type { db } from "@workspace/db";
import { GetDashboardSummaryResponse } from "@workspace/api-zod";
import { createApp } from "../app.js";

type Seed = {
  products: Array<typeof productsTable.$inferSelect>;
  orders: Array<typeof ordersTable.$inferSelect>;
  expenses: Array<typeof expensesTable.$inferSelect>;
};

function createSeededDatabase(seed: Seed): typeof db {
  return {
    select() {
      return {
        from(table: unknown) {
          if (table === productsTable) return Promise.resolve(seed.products);
          if (table === ordersTable) return Promise.resolve(seed.orders);
          if (table === expensesTable) return Promise.resolve(seed.expenses);
          throw new Error("Unexpected table requested by dashboard route");
        },
      };
    },
  } as unknown as typeof db;
}

async function requestSummary(seed: Seed): Promise<{
  status: number;
  body: unknown;
}> {
  const server = createServer(createApp(createSeededDatabase(seed)));
  await new Promise<void>((resolve) => server.listen(0, resolve));

  try {
    const address = server.address();
    assert(address && typeof address !== "string");
    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/dashboard/summary`,
    );
    return {
      status: response.status,
      body: await response.json(),
    };
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

const emptySeed: Seed = {
  products: [],
  orders: [],
  expenses: [],
};

test("GET /dashboard/summary returns a schema-valid empty response", async () => {
  const response = await requestSummary(emptySeed);

  assert.equal(response.status, 200);
  const summary = GetDashboardSummaryResponse.parse(response.body);
  assert.equal(summary.revenue, 0);
  assert.equal(summary.orders, 0);
  assert.equal(summary.bestSeller, "No sales yet");
  assert.deepEqual(summary.channelPerformance, []);
  assert.deepEqual(summary.productPerformance, []);
  assert.equal(summary.dailyPerformance.length, 7);
});

test("GET /dashboard/summary adapts seeded database records into the response contract", async () => {
  const response = await requestSummary({
    products: [
      {
        id: 1,
        name: "Linen set",
        category: "Apparel",
        price: "100.00",
        cost: "20.00",
        stock: 2,
        variants: ["S", "M"],
        accent: "#0F6E6B",
      },
    ],
    orders: [
      {
        id: 1,
        token: "seeded-order",
        productId: 1,
        productName: "Linen set",
        customerName: "Ama",
        customerPhone: null,
        channel: "whatsapp",
        amount: "100.00",
        productCost: "20.00",
        depositAmount: null,
        paymentMode: "full",
        status: "paid",
        fulfillment: "pending",
        createdAt: new Date(),
        linkOpens: 4,
        referenceImage: null,
        buyerDetails: null,
      },
    ],
    expenses: [
      {
        id: 1,
        title: "Delivery",
        category: "Delivery",
        amount: "15.00",
        expenseDate: new Date().toISOString().slice(0, 10),
        note: null,
        createdAt: new Date(),
      },
    ],
  });

  assert.equal(response.status, 200);
  const summary = GetDashboardSummaryResponse.parse(response.body);
  assert.equal(summary.revenue, 100);
  assert.equal(summary.productCosts, 20);
  assert.equal(summary.operatingExpenses, 15);
  assert.equal(summary.expenses, 35);
  assert.equal(summary.profit, 65);
  assert.equal(summary.cashBalance, 65);
  assert.equal(summary.orders, 1);
  assert.equal(summary.bestSeller, "Linen set");
  assert.deepEqual(summary.productPerformance, [
    {
      name: "Linen set",
      category: "Apparel",
      revenue: 100,
      orders: 1,
      stock: 2,
      margin: 80,
      costTracked: true,
    },
  ]);
});