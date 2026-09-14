import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { eq } from "drizzle-orm";
import {
  expensesTable,
  ordersTable,
  productsTable,
} from "@workspace/db/schema";
import { db, pool } from "@workspace/db";
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

const transactionRollback = Symbol("transaction rollback");

async function withDatabaseTransaction(
  run: (database: typeof db, baseUrl: string) => Promise<void>,
): Promise<void> {
  try {
    await db.transaction(async (transaction) => {
      const server = createServer(
        createApp(transaction as unknown as typeof db),
      );
      await new Promise<void>((resolve) => server.listen(0, resolve));

      try {
        const address = server.address();
        assert(address && typeof address !== "string");
        await run(
          transaction as unknown as typeof db,
          `http://127.0.0.1:${address.port}`,
        );
      } finally {
        await new Promise<void>((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve())),
        );
      }

      throw transactionRollback;
    });
  } catch (error) {
    if (error !== transactionRollback) {
      throw error;
    }
  }
}

async function requestJson(
  baseUrl: string,
  path: string,
  init?: RequestInit,
): Promise<{ status: number; body: any }> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init?.headers,
    },
  });
  return { status: response.status, body: await response.json() };
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

test.after(async () => {
  await pool.end();
});

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
  assert.equal(summary.estimatedProductCosts, 0);
  assert.equal(summary.operatingExpenses, 15);
  assert.equal(summary.expenses, 35);
  assert.equal(summary.profit, 65);
  assert.equal(summary.cashBalance, 65);
  assert.equal(summary.orders, 1);
  assert.equal(summary.snapshotOrders, 1);
  assert.equal(summary.legacyOrders, 0);
  assert.equal(summary.legacyRevenue, 0);
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
      marginStatus: "tracked",
      snapshotOrders: 1,
      legacyOrders: 0,
    },
  ]);
});

test("GET /dashboard/summary identifies a legacy sale with no captured cost", async () => {
  const response = await requestSummary({
    products: [
      {
        id: 1,
        name: "Legacy linen set",
        category: "Apparel",
        price: "100.00",
        cost: "20.00",
        stock: 2,
        variants: [],
        accent: "#0F6E6B",
      },
    ],
    orders: [
      {
        id: 1,
        token: "legacy-order",
        productId: 1,
        productName: "Legacy linen set",
        customerName: "Ama",
        customerPhone: null,
        channel: "whatsapp",
        amount: "100.00",
        productCost: null,
        depositAmount: null,
        paymentMode: "full",
        status: "paid",
        fulfillment: "pending",
        createdAt: new Date(),
        linkOpens: 0,
        referenceImage: null,
        buyerDetails: null,
      },
    ],
    expenses: [],
  });

  assert.equal(response.status, 200);
  const summary = GetDashboardSummaryResponse.parse(response.body);
  assert.equal(summary.legacyOrders, 1);
  assert.equal(summary.snapshotOrders, 0);
  assert.equal(summary.legacyRevenue, 100);
  assert.equal(summary.estimatedProductCosts, 20);
  assert.equal(summary.productPerformance[0]?.marginStatus, "estimated");
});

test("buyer deposit checkout and seller payment preserve the original product cost", async () => {
  await withDatabaseTransaction(async (database, baseUrl) => {
    const [product] = await database
      .insert(productsTable)
      .values({
        name: "Historical cost deposit fixture",
        category: "Test",
        price: "100.00",
        cost: "12.50",
        stock: 10,
        variants: [],
        accent: "#0F6E6B",
      })
      .returning();

    const created = await requestJson(baseUrl, "/api/orders", {
      method: "POST",
      body: JSON.stringify({
        productId: product.id,
        amount: 100,
        depositAmount: 40,
        paymentMode: "deposit",
        channel: "whatsapp",
      }),
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.status, "reserved");
    assert.equal(created.body.productCost, null);

    const checkedOut = await requestJson(
      baseUrl,
      `/api/public/orders/${created.body.token}`,
      {
        method: "POST",
        body: JSON.stringify({
          customerName: "Ama",
          customerPhone: "0241234567",
          paymentAction: "pay",
        }),
      },
    );
    assert.equal(checkedOut.status, 200);
    assert.equal(checkedOut.body.status, "deposit_paid");
    assert.equal(checkedOut.body.productCost, 12.5);

    await database
      .update(productsTable)
      .set({ cost: "99.00" })
      .where(eq(productsTable.id, product.id));

    const fullyPaid = await requestJson(
      baseUrl,
      `/api/orders/${created.body.id}`,
      {
        method: "PATCH",
        body: JSON.stringify({ status: "paid" }),
      },
    );
    assert.equal(fullyPaid.status, 200);
    assert.equal(fullyPaid.body.status, "paid");
    assert.equal(fullyPaid.body.productCost, 12.5);

    const [stored] = await database
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.id, created.body.id));
    assert.equal(stored.productCost, "12.50");
  });
});

test("re-opening a paid order cannot replace its historical product cost", async () => {
  await withDatabaseTransaction(async (database, baseUrl) => {
    const [product] = await database
      .insert(productsTable)
      .values({
        name: "Historical cost reopen fixture",
        category: "Test",
        price: "100.00",
        cost: "18.00",
        stock: 10,
        variants: [],
        accent: "#0F6E6B",
      })
      .returning();

    const created = await requestJson(baseUrl, "/api/orders", {
      method: "POST",
      body: JSON.stringify({
        productId: product.id,
        amount: 100,
        paymentMode: "full",
        channel: "instagram",
      }),
    });
    assert.equal(created.status, 201);

    const paid = await requestJson(
      baseUrl,
      `/api/public/orders/${created.body.token}`,
      {
        method: "POST",
        body: JSON.stringify({
          customerName: "Kojo",
          customerPhone: "0247654321",
          paymentAction: "pay",
        }),
      },
    );
    assert.equal(paid.status, 200);
    assert.equal(paid.body.status, "paid");
    assert.equal(paid.body.productCost, 18);

    await database
      .update(productsTable)
      .set({ cost: "76.00" })
      .where(eq(productsTable.id, product.id));

    const reopened = await requestJson(
      baseUrl,
      `/api/orders/${created.body.id}`,
      {
        method: "PATCH",
        body: JSON.stringify({ status: "reserved" }),
      },
    );
    assert.equal(reopened.status, 200);
    assert.equal(reopened.body.productCost, 18);

    const paidAgain = await requestJson(
      baseUrl,
      `/api/orders/${created.body.id}`,
      {
        method: "PATCH",
        body: JSON.stringify({ status: "paid" }),
      },
    );
    assert.equal(paidAgain.status, 200);
    assert.equal(paidAgain.body.status, "paid");
    assert.equal(paidAgain.body.productCost, 18);

    const [stored] = await database
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.id, created.body.id));
    assert.equal(stored.productCost, "18.00");
  });
});

test("multi-item order links preserve item prices and compound the checkout total", async () => {
  await withDatabaseTransaction(async (database, baseUrl) => {
    const [firstProduct] = await database
      .insert(productsTable)
      .values({
        name: "Multi-item first fixture",
        category: "Test",
        price: "35.00",
        cost: "10.00",
        stock: 10,
        variants: ["Small", "Large"],
        accent: "#0F6E6B",
      })
      .returning();
    const [secondProduct] = await database
      .insert(productsTable)
      .values({
        name: "Multi-item second fixture",
        category: "Test",
        price: "65.00",
        cost: "20.00",
        stock: 10,
        variants: [],
        accent: "#2F5BFF",
      })
      .returning();

    const created = await requestJson(baseUrl, "/api/orders", {
      method: "POST",
      body: JSON.stringify({
        items: [
          { productId: firstProduct.id, amount: 40 },
          { productId: secondProduct.id, amount: 70 },
        ],
        paymentMode: "full",
        channel: "whatsapp",
      }),
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.amount, 110);

    const listed = await requestJson(baseUrl, "/api/orders");
    const listedOrder = listed.body.find((order: { id: number }) => order.id === created.body.id);
    assert.deepEqual(
      listedOrder.items.map((item: { productName: string; amount: number }) => ({
        productName: item.productName,
        amount: item.amount,
      })),
      [
        { productName: "Multi-item first fixture", amount: 40 },
        { productName: "Multi-item second fixture", amount: 70 },
      ],
    );

    const publicOrder = await requestJson(
      baseUrl,
      `/api/public/orders/${created.body.token}`,
    );
    assert.equal(publicOrder.status, 200);
    assert.deepEqual(
      publicOrder.body.items.map((item: { productName: string; amount: number }) => ({
        productName: item.productName,
        amount: item.amount,
      })),
      [
        { productName: "Multi-item first fixture", amount: 40 },
        { productName: "Multi-item second fixture", amount: 70 },
      ],
    );
    assert.equal(publicOrder.body.amount, 110);

    const checkedOut = await requestJson(
      baseUrl,
      `/api/public/orders/${created.body.token}`,
      {
        method: "POST",
        body: JSON.stringify({
          customerName: "Ama",
          customerPhone: "0241234567",
          paymentAction: "pay",
        }),
      },
    );
    assert.equal(checkedOut.status, 200);
    assert.equal(checkedOut.body.status, "paid");

    const [firstAfterCheckout] = await database
      .select({ stock: productsTable.stock })
      .from(productsTable)
      .where(eq(productsTable.id, firstProduct.id));
    const [secondAfterCheckout] = await database
      .select({ stock: productsTable.stock })
      .from(productsTable)
      .where(eq(productsTable.id, secondProduct.id));
    assert.equal(firstAfterCheckout.stock, 9);
    assert.equal(secondAfterCheckout.stock, 9);
  });
});