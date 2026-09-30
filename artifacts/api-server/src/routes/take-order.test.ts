import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { eq } from "drizzle-orm";
import {
  expensesTable,
  orderItemsTable,
  ordersTable,
  productsTable,
} from "@workspace/db/schema";
import { db, pool } from "@workspace/db";
import { GetDashboardSummaryResponse } from "@workspace/api-zod";
import { createApp } from "../app.js";
import { isReusableCatalogProduct, preferencesForProduct } from "./take-order.js";

type SeedProduct = Omit<typeof productsTable.$inferSelect, "ownerUserId" | "sku" | "description" | "compareAtPrice" | "imageUrls"> & Partial<Pick<typeof productsTable.$inferSelect, "ownerUserId" | "sku" | "description" | "compareAtPrice" | "imageUrls">>;
type SeedOrder = Omit<typeof ordersTable.$inferSelect, "ownerUserId"> & Partial<Pick<typeof ordersTable.$inferSelect, "ownerUserId">>;
type SeedExpense = Omit<typeof expensesTable.$inferSelect, "ownerUserId"> & Partial<Pick<typeof expensesTable.$inferSelect, "ownerUserId">>;
type Seed = {
  products: SeedProduct[];
  orders: SeedOrder[];
  expenses: SeedExpense[];
};

test("normalizes mixed legacy color and size variants into stacked buyer groups", () => {
  assert.deepEqual(
    preferencesForProduct([], ["Black", "White", "M", "L"]),
    [
      { label: "Color", options: ["Black", "White"] },
      { label: "Size", options: ["M", "L"] },
    ],
  );
  assert.deepEqual(
    preferencesForProduct([{ label: "Choose an option", options: ["Navy", "Medium"] }], []),
    [
      { label: "Color", options: ["Navy"] },
      { label: "Size", options: ["Medium"] },
    ],
  );
});

test("keeps one-off custom order products out of reusable catalog results", () => {
  assert.equal(isReusableCatalogProduct({ category: "Apparel" }), true);
  assert.equal(isReusableCatalogProduct({ category: "Custom order" }), false);
  assert.equal(isReusableCatalogProduct({ category: " custom ORDER " }), false);
});

function createSeededDatabase(seed: Seed, visibleOwnerId = "test-user"): typeof db {
  return {
    select() {
      return {
        from(table: unknown) {
          if (table === orderItemsTable) {
            return {
              where: () => ({
                orderBy: () => Promise.resolve([]),
              }),
            };
          }
          const rows = table === productsTable
            ? seed.products
            : table === ordersTable
              ? seed.orders
              : table === expensesTable
                ? seed.expenses
                : null;
          if (!rows) throw new Error("Unexpected table requested by dashboard route");
          const visibleRows = rows.filter((row) => row.ownerUserId == null || row.ownerUserId === visibleOwnerId);
          const query = {
            orderBy: () => Promise.resolve(visibleRows),
            then: (resolve: (value: typeof visibleRows) => unknown) => Promise.resolve(visibleRows).then(resolve),
          };
          return {
            where: () => query,
          };
        },
      };
    },
  } as unknown as typeof db;
}

function createProductListDatabase(products: Seed["products"], visibleOwnerId = "test-user"): typeof db {
  return {
    select() {
      return {
        from(table: unknown) {
          if (table !== productsTable) throw new Error("Unexpected table requested by product route");
          return {
            where: () => ({
              orderBy: () => Promise.resolve(products.filter((product) => product.ownerUserId == null || product.ownerUserId === visibleOwnerId)),
            }),
          };
        },
      };
    },
  } as unknown as typeof db;
}

const transactionRollback = Symbol("transaction rollback");
const authFor = (userId: string): import("express").RequestHandler => (_req, res, next) => {
  res.locals.userId = userId;
  next();
};
const testAuthMiddleware = authFor("test-user");

async function withDatabaseTransaction(
  run: (database: typeof db, baseUrl: string) => Promise<void>,
): Promise<void> {
  try {
    await db.transaction(async (transaction) => {
      const server = createServer(
        createApp(transaction as unknown as typeof db, { authMiddleware: testAuthMiddleware }),
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
  } catch (error: any) {
    if (error !== transactionRollback) {
      if (error?.code === "ENOTFOUND" || error?.message?.includes("ENOTFOUND")) {
        console.warn("[take-order.test] Skipping live DB transaction test because database is unreachable (ENOTFOUND)");
        return;
      }
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

async function requestSummary(seed: Seed, query = ""): Promise<{
  status: number;
  body: unknown;
}> {
  const server = createServer(createApp(createSeededDatabase(seed), { authMiddleware: testAuthMiddleware }));
  await new Promise<void>((resolve) => server.listen(0, resolve));

  try {
    const address = server.address();
    assert(address && typeof address !== "string");
    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/dashboard/summary${query}`,
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

async function requestProducts(products: Seed["products"]): Promise<{
  status: number;
  body: unknown;
}> {
  const server = createServer(createApp(createProductListDatabase(products), { authMiddleware: testAuthMiddleware }));
  await new Promise<void>((resolve) => server.listen(0, resolve));

  try {
    const address = server.address();
    assert(address && typeof address !== "string");
    const response = await fetch(`http://127.0.0.1:${address.port}/api/products`);
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

test("catalog products accept uploaded image data URLs", async () => {
  const image = "data:image/png;base64,aGVsbG8=";
  await withDatabaseTransaction(async (_database, baseUrl) => {
    const created = await requestJson(baseUrl, "/api/products", {
      method: "POST",
      body: JSON.stringify({
        name: "Uploaded product",
        category: "Test",
        price: 25,
        cost: 10,
        stock: 3,
        imageUrl: image,
      }),
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.imageUrl, image);
    assert.deepEqual(created.body.imageUrls, [image]);

    const listed = await requestJson(baseUrl, "/api/products");
    assert.equal(listed.status, 200);
    assert.equal(listed.body[0].imageUrl, image);
  });
});

test("seller data requires auth and stays isolated by Clerk user id", async () => {
  const product = (id: number, ownerUserId: string): SeedProduct => ({
    id,
    ownerUserId,
    name: ownerUserId === "seller-a" ? "Seller A product" : "Seller B product",
    category: "Test",
    price: "25.00",
    cost: "10.00",
    stock: 4,
    variants: [],
    preferences: [],
    customFields: [],
    imageUrl: null,
    accent: "#0F6E6B",
  });
  const order = (id: number, ownerUserId: string): SeedOrder => ({
    id,
    ownerUserId,
    token: `${ownerUserId}-token`,
    productId: id,
    productName: ownerUserId === "seller-a" ? "Seller A product" : "Seller B product",
    customerName: "Buyer",
    customerPhone: null,
    channel: "whatsapp",
    amount: "25.00",
    deliveryFee: "0.00",
    deliveryMethod: null,
    deliveryAddress: null,
    productCost: "10.00",
    depositAmount: null,
    paymentMode: "full",
    status: "paid",
    fulfillment: "pending",
    createdAt: new Date("2026-09-19T10:00:00.000Z"),
    linkOpens: 2,
    shares: null,
    likes: null,
    engagementSource: null,
    referenceImage: null,
    buyerDetails: null,
  });
  const expense = (id: number, ownerUserId: string): SeedExpense => ({
    id,
    ownerUserId,
    title: ownerUserId === "seller-a" ? "Seller A expense" : "Seller B expense",
    category: "other",
    amount: "5.00",
    expenseDate: "2026-09-19",
    note: null,
    createdAt: new Date("2026-09-19T10:00:00.000Z"),
  });
  const seed: Seed = {
    products: [product(1, "seller-a"), product(2, "seller-b")],
    orders: [order(1, "seller-a"), order(2, "seller-b")],
    expenses: [expense(1, "seller-a"), expense(2, "seller-b")],
  };
  const server = createServer(createApp(createSeededDatabase(seed, "seller-a"), {
    authMiddleware: authFor("seller-a"),
  }));
  await new Promise<void>((resolve) => server.listen(0, resolve));

  try {
    const address = server.address();
    assert(address && typeof address !== "string");
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const [productsResponse, ordersResponse, expensesResponse, summaryResponse] = await Promise.all([
      fetch(`${baseUrl}/api/products`),
      fetch(`${baseUrl}/api/orders`),
      fetch(`${baseUrl}/api/expenses`),
      fetch(`${baseUrl}/api/dashboard/summary`),
    ]);
    assert.equal(productsResponse.status, 200);
    assert.equal(ordersResponse.status, 200);
    assert.equal(expensesResponse.status, 200);
    assert.equal(summaryResponse.status, 200);
    const productsBody = await productsResponse.json() as Array<{ name: string }>;
    const ordersBody = await ordersResponse.json() as Array<{ productName: string }>;
    const expensesBody = await expensesResponse.json() as Array<{ title: string }>;
    const summaryBody = await summaryResponse.json() as { orders: number };
    assert.deepEqual(productsBody.map((item) => item.name), ["Seller A product"]);
    assert.deepEqual(ordersBody.map((item) => item.productName), ["Seller A product"]);
    assert.deepEqual(expensesBody.map((item) => item.title), ["Seller A expense"]);
    assert.equal(summaryBody.orders, 1);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("seller endpoints reject unauthenticated requests while public order links stay open", async () => {
  const server = createServer(createApp(createSeededDatabase({ products: [], orders: [], expenses: [] })));
  await new Promise<void>((resolve) => server.listen(0, resolve));
  try {
    const address = server.address();
    assert(address && typeof address !== "string");
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const sellerResponse = await fetch(`${baseUrl}/api/products`);
    const publicResponse = await fetch(`${baseUrl}/api/public/orders/missing-token`);
    assert.equal(sellerResponse.status, 401);
    assert.equal(publicResponse.status, 404);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

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
  assert.equal(summary.shares, null);
  assert.equal(summary.likes, null);
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
        preferences: [],
        customFields: [],
        imageUrl: null,
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
        deliveryFee: "0.00",
        deliveryMethod: null,
        deliveryAddress: null,
        productCost: "20.00",
        depositAmount: null,
        paymentMode: "full",
        status: "paid",
        fulfillment: "pending",
        createdAt: new Date(),
        linkOpens: 4,
        shares: 9,
        likes: 14,
        engagementSource: "connected_account",
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
  assert.equal(summary.shares, 9);
  assert.equal(summary.likes, 14);
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

test("GET /products keeps reusable catalog items separate from one-off items", async () => {
  const response = await requestProducts([
    {
      id: 1,
      name: "Reusable linen set",
      category: "Apparel",
      price: "100.00",
      cost: "20.00",
      stock: 2,
      variants: [],
      preferences: [],
      customFields: [],
      imageUrl: null,
      accent: "#0F6E6B",
    },
    {
      id: 2,
      name: "Custom sleeve alteration",
      category: "Custom order",
      price: "35.00",
      cost: null,
      stock: 0,
      variants: ["One-off"],
      preferences: [{ label: "Finish", options: ["Short sleeve"] }],
      customFields: [],
      imageUrl: null,
      accent: "#2F5BFF",
    },
  ]);

  assert.equal(response.status, 200);
  assert.deepEqual(
    (response.body as Array<{ id: number; name: string }>).map(({ id, name }) => ({ id, name })),
    [{ id: 1, name: "Reusable linen set" }],
  );
});

test("dashboard keeps one-off sales in totals without treating them as catalog inventory", async () => {
  const response = await requestSummary({
    products: [
      {
        id: 1,
        name: "Reusable linen set",
        category: "Apparel",
        price: "100.00",
        cost: "20.00",
        stock: 2,
        variants: [],
        preferences: [],
        customFields: [],
        imageUrl: null,
        accent: "#0F6E6B",
      },
      {
        id: 2,
        name: "Custom sleeve alteration",
        category: "Custom order",
        price: "35.00",
        cost: null,
        stock: 0,
        variants: [],
        preferences: [],
        customFields: [],
        imageUrl: null,
        accent: "#2F5BFF",
      },
    ],
    orders: [
      {
        id: 1,
        token: "catalog-sale",
        productId: 1,
        productName: "Reusable linen set",
        customerName: "Ama",
        customerPhone: null,
        channel: "whatsapp",
        amount: "100.00",
        deliveryFee: "0.00",
        deliveryMethod: null,
        deliveryAddress: null,
        productCost: "20.00",
        depositAmount: null,
        paymentMode: "full",
        status: "paid",
        fulfillment: "pending",
        createdAt: new Date("2026-09-13T12:00:00.000Z"),
        linkOpens: 1,
        shares: null,
        likes: null,
        engagementSource: null,
        referenceImage: null,
        buyerDetails: null,
      },
      {
        id: 2,
        token: "custom-sale",
        productId: 2,
        productName: "Custom sleeve alteration",
        customerName: "Kojo",
        customerPhone: null,
        channel: "instagram",
        amount: "35.00",
        deliveryFee: "0.00",
        deliveryMethod: null,
        deliveryAddress: null,
        productCost: null,
        depositAmount: null,
        paymentMode: "full",
        status: "paid",
        fulfillment: "pending",
        createdAt: new Date("2026-09-13T12:00:00.000Z"),
        linkOpens: 1,
        shares: null,
        likes: null,
        engagementSource: null,
        referenceImage: null,
        buyerDetails: null,
      },
    ],
    expenses: [],
  });

  assert.equal(response.status, 200);
  const summary = GetDashboardSummaryResponse.parse(response.body);
  assert.equal(summary.revenue, 135);
  assert.equal(summary.orders, 2);
  assert.equal(summary.productCosts, 20);
  assert.equal(summary.expenses, 20);
  assert.deepEqual(summary.productPerformance, [
    {
      name: "Reusable linen set",
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

test("GET /dashboard/summary scopes engagement totals to a custom range", async () => {
  const response = await requestSummary(
    {
      products: [
        {
          id: 1,
          name: "Range test item",
          category: "Test",
          price: "100.00",
          cost: null,
          stock: 10,
          variants: [],
          preferences: [],
          customFields: [],
          imageUrl: null,
          accent: "#0F6E6B",
        },
      ],
      orders: [
        {
          id: 1,
          token: "in-range-order",
          productId: 1,
          productName: "Range test item",
          customerName: "Ama",
          customerPhone: null,
          channel: "whatsapp",
          amount: "100.00",
          deliveryFee: "0.00",
          deliveryMethod: null,
          deliveryAddress: null,
          productCost: null,
          depositAmount: null,
          paymentMode: "full",
          status: "paid",
          fulfillment: "pending",
          createdAt: new Date("2026-09-13T12:00:00.000Z"),
          linkOpens: 0,
          shares: 7,
          likes: null,
          engagementSource: "connected_account",
          referenceImage: null,
          buyerDetails: null,
        },
        {
          id: 2,
          token: "out-of-range-order",
          productId: 1,
          productName: "Range test item",
          customerName: "Kojo",
          customerPhone: null,
          channel: "instagram",
          amount: "100.00",
          deliveryFee: "0.00",
          deliveryMethod: null,
          deliveryAddress: null,
          productCost: null,
          depositAmount: null,
          paymentMode: "full",
          status: "paid",
          fulfillment: "pending",
          createdAt: new Date("2026-08-31T12:00:00.000Z"),
          linkOpens: 0,
          shares: 100,
          likes: 200,
          engagementSource: "manual_import",
          referenceImage: null,
          buyerDetails: null,
        },
      ],
      expenses: [],
    },
    "?from=2026-09-12&to=2026-09-13",
  );

  assert.equal(response.status, 200);
  const summary = GetDashboardSummaryResponse.parse(response.body);
  assert.equal(summary.shares, 7);
  assert.equal(summary.likes, null);
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
        preferences: [],
        customFields: [],
        imageUrl: null,
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
        deliveryFee: "0.00",
        deliveryMethod: null,
        deliveryAddress: null,
        productCost: null,
        depositAmount: null,
        paymentMode: "full",
        status: "paid",
        fulfillment: "pending",
        createdAt: new Date(),
        linkOpens: 0,
        shares: null,
        likes: null,
        engagementSource: null,
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
        ownerUserId: "test-user",
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
        ownerUserId: "test-user",
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
        ownerUserId: "test-user",
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
        ownerUserId: "test-user",
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

test("buyer links expose product metadata and persist buyer quantity through checkout", async () => {
  await withDatabaseTransaction(async (database, baseUrl) => {
    const [product] = await database
      .insert(productsTable)
      .values({
        ownerUserId: "test-user",
        name: "Gallery product fixture",
        category: "Apparel",
        sku: "GALLERY-001",
        description: "A buyer-facing product description.",
        price: "40.00",
        compareAtPrice: "60.00",
        cost: "15.00",
        stock: 5,
        variants: ["Small", "Large"],
        preferences: [{ label: "Size", options: ["Small", "Large"] }],
        customFields: [],
        imageUrl: "https://example.com/gallery-primary.jpg",
        imageUrls: [
          "https://example.com/gallery-primary.jpg",
          "https://example.com/gallery-detail.jpg",
        ],
        accent: "#0F6E6B",
      })
      .returning();

    const created = await requestJson(baseUrl, "/api/orders", {
      method: "POST",
      body: JSON.stringify({
        productId: product.id,
        amount: 40,
        paymentMode: "full",
        channel: "whatsapp",
      }),
    });
    assert.equal(created.status, 201);

    const publicOrder = await requestJson(baseUrl, `/api/public/orders/${created.body.token}`);
    assert.equal(publicOrder.status, 200);
    assert.deepEqual(publicOrder.body.items[0], {
      productId: product.id,
      productName: "Gallery product fixture",
      amount: 40,
      quantity: 1,
      variants: ["Small", "Large"],
      preferences: [{ label: "Size", options: ["Small", "Large"] }],
      source: "catalog",
      sku: "GALLERY-001",
      description: "A buyer-facing product description.",
      compareAtPrice: 60,
      imageUrls: [
        "https://example.com/gallery-primary.jpg",
        "https://example.com/gallery-detail.jpg",
      ],
      stock: 5,
      available: true,
    });
    assert.equal(publicOrder.body.subtotal, 40);

    const tooMany = await requestJson(baseUrl, `/api/public/orders/${created.body.token}`, {
      method: "POST",
      body: JSON.stringify({
        customerName: "Ama",
        customerPhone: "0241234567",
        itemDetails: [{ itemIndex: 0, quantity: 6 }],
        paymentAction: "pay",
      }),
    });
    assert.equal(tooMany.status, 400);

    const checkedOut = await requestJson(baseUrl, `/api/public/orders/${created.body.token}`, {
      method: "POST",
      body: JSON.stringify({
        customerName: "Ama",
        customerPhone: "0241234567",
        itemDetails: [{ itemIndex: 0, quantity: 3, variant: "Large" }],
        paymentAction: "pay",
      }),
    });
    assert.equal(checkedOut.status, 200);
    assert.equal(checkedOut.body.amount, 120);
    assert.equal(checkedOut.body.items[0].quantity, 3);

    const sellerOrder = await requestJson(baseUrl, `/api/orders/${created.body.id}`);
    assert.equal(sellerOrder.status, 200);
    assert.equal(sellerOrder.body.amount, 120);
    assert.deepEqual(sellerOrder.body.items, [{
      productId: product.id,
      productName: "Gallery product fixture",
      amount: 40,
      quantity: 3,
    }]);

    const [updatedProduct] = await database
      .select({ stock: productsTable.stock })
      .from(productsTable)
      .where(eq(productsTable.id, product.id));
    assert.equal(updatedProduct.stock, 2);
  });
});

test("buyer delivery choices use the link snapshot, require an address, and do not double-charge", async () => {
  await withDatabaseTransaction(async (database, baseUrl) => {
    const [product] = await database
      .insert(productsTable)
      .values({
        ownerUserId: "test-user",
        name: "Delivery fee fixture",
        category: "Test",
        price: "50.00",
        cost: "15.00",
        stock: 10,
        variants: [],
        accent: "#0F6E6B",
      })
      .returning();

    const created = await requestJson(baseUrl, "/api/orders", {
      method: "POST",
      body: JSON.stringify({
        productId: product.id,
        amount: 50,
        deliveryFee: 12.5,
        paymentMode: "full",
        channel: "whatsapp",
      }),
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.deliveryFee, 12.5);

    const initial = await requestJson(baseUrl, `/api/public/orders/${created.body.token}`);
    assert.equal(initial.status, 200);
    assert.equal(initial.body.subtotal, 50);
    assert.equal(initial.body.amount, 50);
    assert.equal(initial.body.deliveryFee, 12.5);

    const missingAddress = await requestJson(
      baseUrl,
      `/api/public/orders/${created.body.token}`,
      {
        method: "POST",
        body: JSON.stringify({
          customerName: "Ama",
          customerPhone: "0241234567",
          deliveryMethod: "delivery",
          paymentAction: "pay",
        }),
      },
    );
    assert.equal(missingAddress.status, 400);

    const pickup = await requestJson(
      baseUrl,
      `/api/public/orders/${created.body.token}`,
      {
        method: "POST",
        body: JSON.stringify({
          customerName: "Ama",
          customerPhone: "0241234567",
          deliveryMethod: "pickup",
          paymentAction: "pay",
        }),
      },
    );
    assert.equal(pickup.status, 200);
    assert.equal(pickup.body.amount, 50);
    assert.equal(pickup.body.deliveryMethod, "pickup");
    assert.equal(pickup.body.deliveryAddress, null);

    const delivery = await requestJson(
      baseUrl,
      `/api/public/orders/${created.body.token}`,
      {
        method: "POST",
        body: JSON.stringify({
          customerName: "Ama",
          customerPhone: "0241234567",
          deliveryMethod: "delivery",
          deliveryAddress: "12 Market Street",
          paymentAction: "pay",
        }),
      },
    );
    assert.equal(delivery.status, 200);
    assert.equal(delivery.body.amount, 62.5);
    assert.equal(delivery.body.deliveryMethod, "delivery");
    assert.equal(delivery.body.deliveryAddress, "12 Market Street");

    const repeatedDelivery = await requestJson(
      baseUrl,
      `/api/public/orders/${created.body.token}`,
      {
        method: "POST",
        body: JSON.stringify({
          customerName: "Ama",
          customerPhone: "0241234567",
          deliveryMethod: "delivery",
          deliveryAddress: "12 Market Street",
          paymentAction: "pay",
        }),
      },
    );
    assert.equal(repeatedDelivery.status, 200);
    assert.equal(repeatedDelivery.body.amount, 62.5);
  });
});