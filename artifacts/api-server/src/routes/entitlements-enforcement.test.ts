import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import {
  ordersTable,
  orderItemsTable,
  productsTable,
  sellerSettingsTable,
  expensesTable,
} from "@workspace/db/schema";
import type { db } from "@workspace/db";
import { createApp } from "../app.js";
import { setCachedRevenueCatSubscriber, invalidateRevenueCatCache } from "../lib/entitlements.js";

function createMockDatabase(options: {
  products: any[];
  orders: any[];
  orderItems: any[];
  sellerSettings?: any;
}): typeof db {
  const { products, orders, orderItems, sellerSettings } = options;

  function makeQuery<T>(data: T) {
    const p = Promise.resolve(data);
    return Object.assign(p, {
      orderBy: () => p,
    });
  }

  return {
    select(fields?: any) {
      return {
        from(table: unknown) {
          return {
            where(predicate: any) {
              if (table === productsTable) {
                return makeQuery(products);
              }
              if (table === ordersTable) {
                return makeQuery(orders);
              }
              if (table === orderItemsTable) {
                return makeQuery(orderItems);
              }
              if (table === sellerSettingsTable) {
                return makeQuery(sellerSettings ? [{ settings: sellerSettings }] : []);
              }
              if (table === expensesTable) {
                return makeQuery([]);
              }
              return makeQuery([]);
            },
          };
        },
      };
    },
    insert(table: unknown) {
      return {
        values(data: any) {
          return {
            returning() {
              if (table === productsTable) {
                const inserted = { id: 999, ...data };
                products.push(inserted);
                return Promise.resolve([inserted]);
              }
              if (table === ordersTable) {
                const inserted = { id: 888, ...data, createdAt: new Date() };
                orders.push(inserted);
                return Promise.resolve([inserted]);
              }
              if (table === orderItemsTable) {
                return Promise.resolve([{ id: 777, ...data }]);
              }
              return Promise.resolve([{ id: 1, ...data }]);
            },
            onConflictDoUpdate() {
              return {
                returning: () => Promise.resolve([{ id: 1, settings: data.settings }]),
              };
            },
          };
        },
      };
    },
    update(table: unknown) {
      return {
        set(values: any) {
          return {
            where() {
              if (table === ordersTable && orders.length > 0) {
                const target = orders[0];
                const updated = {
                  ...target,
                  ...values,
                  createdAt: target.createdAt instanceof Date ? target.createdAt : new Date(),
                  updatedAt: new Date(),
                };
                Object.assign(target, updated);
                return {
                  returning: () => Promise.resolve([updated]),
                };
              }
              return {
                returning: () => Promise.resolve([{ id: 1, ...values, createdAt: new Date() }]),
              };
            },
          };
        },
      };
    },
    delete(table: unknown) {
      return {
        where() {
          return {
            returning: () => Promise.resolve([{ id: 1 }]),
          };
        },
      };
    },
    transaction(callback: (tx: any) => Promise<any>) {
      return callback(this);
    },
  } as unknown as typeof db;
}

async function startTestServer(mockDb: typeof db) {
  const authMiddleware = (_req: any, res: any, next: any) => {
    res.locals.userId = "seller_test_user";
    next();
  };
  const app = createApp(mockDb, { authMiddleware });
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  return {
    baseUrl: `http://localhost:${port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

test("server-side enforcement: allows unlimited catalog product creation on Free plan", async () => {
  // Free seller with expired trial (started 30 days ago) and 10 existing products
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const existingProducts = Array.from({ length: 10 }, (_, i) => ({
    id: i + 1,
    ownerUserId: "seller_test_user",
    name: `Product ${i + 1}`,
    category: "Apparel",
    price: "50.00",
    stock: 5,
  }));

  const mockDb = createMockDatabase({
    products: existingProducts,
    orders: [],
    orderItems: [],
    sellerSettings: { trialStartedAt: thirtyDaysAgo },
  });

  const { baseUrl, close } = await startTestServer(mockDb);

  try {
    // Attempt to create 11th catalog product on Free plan -> Allowed (no catalog limit)
    const res = await fetch(`${baseUrl}/api/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Eleventh Product",
        category: "Apparel",
        price: 99.0,
        stock: 10,
      }),
    });

    assert.equal(res.status, 201);
    const body = (await res.json()) as any;
    assert.equal(body.name, "Eleventh Product");
    assert.equal(existingProducts.length, 11);
  } finally {
    await close();
  }
});

test("server-side enforcement: allows catalog creation beyond 10 products for Pro trial sellers", async () => {
  // Pro Trial seller (trial started 2 days ago, 5 days remaining) with 10 existing products
  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
  const existingProducts = Array.from({ length: 10 }, (_, i) => ({
    id: i + 1,
    ownerUserId: "seller_test_user",
    name: `Product ${i + 1}`,
    category: "Apparel",
    price: "50.00",
    stock: 5,
  }));

  const mockDb = createMockDatabase({
    products: existingProducts,
    orders: [],
    orderItems: [],
    sellerSettings: { trialStartedAt: twoDaysAgo },
  });

  const { baseUrl, close } = await startTestServer(mockDb);

  try {
    const res = await fetch(`${baseUrl}/api/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Eleventh Product Under Trial",
        category: "Apparel",
        price: 99.0,
        stock: 10,
      }),
    });

    assert.equal(res.status, 201);
    const body = (await res.json()) as any;
    assert.equal(body.name, "Eleventh Product Under Trial");
    assert.equal(existingProducts.length, 11);
  } finally {
    await close();
  }
});

test("server-side enforcement: blocks 51st active link on Free plan with 403", async () => {
  // Free seller (expired trial) with 50 active orders
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const baseProduct = {
    id: 1,
    ownerUserId: "seller_test_user",
    name: "Standard Bag",
    category: "Accessories",
    price: "30.00",
    stock: 100,
  };
  const existingOrders = Array.from({ length: 50 }, (_, i) => ({
    id: i + 1,
    ownerUserId: "seller_test_user",
    token: `tok_link_${i + 1}`,
    productId: 1,
    productName: "Standard Bag",
    status: "reserved",
    amount: "30.00",
  }));

  const mockDb = createMockDatabase({
    products: [baseProduct],
    orders: existingOrders,
    orderItems: [],
    sellerSettings: { trialStartedAt: thirtyDaysAgo },
  });

  const { baseUrl, close } = await startTestServer(mockDb);

  try {
    // Attempt to create 51st link
    const res = await fetch(`${baseUrl}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: 1,
        channel: "whatsapp",
        paymentMode: "full",
        amount: 30.0,
      }),
    });

    assert.equal(res.status, 403);
    const body = (await res.json()) as any;
    assert.equal(body.code, "LINK_LIMIT_REACHED");
    assert.equal(body.limit, 50);
    assert.equal(body.current, 50);
    assert.ok(body.message.includes("50 active Take Order link limit"));

    // Existing orders remain preserved
    assert.equal(existingOrders.length, 50);
  } finally {
    await close();
  }
});

test("server-side enforcement: analytics export endpoint enforces Pro access", async () => {
  // Free seller
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const mockDbFree = createMockDatabase({
    products: [],
    orders: [{ id: 1, ownerUserId: "seller_test_user", token: "t1", amount: "50.00" }],
    orderItems: [],
    sellerSettings: { trialStartedAt: thirtyDaysAgo },
  });

  const { baseUrl: freeUrl, close: closeFree } = await startTestServer(mockDbFree);

  try {
    const res = await fetch(`${freeUrl}/api/dashboard/export`);
    assert.equal(res.status, 403);
    const body = (await res.json()) as any;
    assert.equal(body.code, "PRO_FEATURE_REQUIRED");
  } finally {
    await closeFree();
  }

  // Trial / Pro seller
  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
  const mockDbTrial = createMockDatabase({
    products: [],
    orders: [
      {
        id: 1,
        ownerUserId: "seller_test_user",
        token: "tok_pro123",
        productName: "Silk Scarf",
        customerName: "Abena",
        customerPhone: "0240001111",
        channel: "instagram",
        status: "paid",
        fulfillment: "delivered",
        amount: "120.00",
        createdAt: new Date(),
      },
    ],
    orderItems: [],
    sellerSettings: { trialStartedAt: twoDaysAgo },
  });

  const { baseUrl: trialUrl, close: closeTrial } = await startTestServer(mockDbTrial);

  try {
    const res = await fetch(`${trialUrl}/api/dashboard/export`);
    assert.equal(res.status, 200);
    assert.ok(res.headers.get("content-type")?.includes("text/csv"));
    const csv = await res.text();
    assert.ok(csv.includes("Order ID,Order Token,Product,Buyer"));
    assert.ok(csv.includes("tok_pro123"));
    assert.ok(csv.includes("Silk Scarf"));
  } finally {
    await closeTrial();
  }
});

test("server-side enforcement: reports endpoint /api/reports/summary requires Pro or Trial", async () => {
  // Free seller
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const mockDbFree = createMockDatabase({
    products: [{ id: 1, name: "Item", category: "General", price: "20.00", stock: 5 }],
    orders: [{ id: 1, ownerUserId: "seller_test_user", token: "t1", amount: "50.00", status: "paid", createdAt: new Date() }],
    orderItems: [],
    sellerSettings: { trialStartedAt: thirtyDaysAgo },
  });

  const { baseUrl: freeUrl, close: closeFree } = await startTestServer(mockDbFree);

  try {
    const res = await fetch(`${freeUrl}/api/reports/summary`);
    assert.equal(res.status, 403);
    const body = (await res.json()) as any;
    assert.equal(body.code, "PRO_FEATURE_REQUIRED");
    assert.ok(body.message.includes("reports"));
  } finally {
    await closeFree();
  }

  // Trial seller
  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
  const mockDbTrial = createMockDatabase({
    products: [{ id: 1, name: "Item", category: "General", price: "20.00", stock: 5 }],
    orders: [{ id: 1, ownerUserId: "seller_test_user", token: "t1", productId: 1, productName: "Item", channel: "whatsapp", linkOpens: 0, amount: "50.00", status: "paid", createdAt: new Date() }],
    orderItems: [],
    sellerSettings: { trialStartedAt: twoDaysAgo },
  });

  const { baseUrl: trialUrl, close: closeTrial } = await startTestServer(mockDbTrial);

  try {
    const res = await fetch(`${trialUrl}/api/reports/summary`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as any;
    assert.equal(typeof body.revenue, "number");
  } finally {
    await closeTrial();
  }
});

test("downgrade safety: existing public buyer links work completely unrestricted even for downgraded sellers", async () => {
  // Seller downgraded to Free who has 40 products and 80 orders
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const targetOrder = {
    id: 42,
    ownerUserId: "seller_test_user",
    token: "tok_historical_buyer_link",
    productId: 15,
    productName: "Preserved Product",
    amount: "75.00",
    deliveryFee: "10.00",
    channel: "whatsapp",
    paymentMode: "full",
    status: "reserved",
    fulfillment: "pending",
    linkOpens: 0,
    shares: 0,
    likes: 0,
    engagementSource: null,
    createdAt: new Date(),
  };

  const mockDb = createMockDatabase({
    products: [{ id: 15, name: "Preserved Product", category: "Apparel", price: "75.00", stock: 10 }],
    orders: [targetOrder],
    orderItems: [{ orderId: 42, productId: 15, productName: "Preserved Product", amount: "75.00", quantity: 1 }],
    sellerSettings: { trialStartedAt: thirtyDaysAgo, businessName: "The Sunday Edit" },
  });

  const { baseUrl, close } = await startTestServer(mockDb);

  try {
    // 1. WhatsApp crawler requests public preview -> HTTP 200 with OG tags
    const crawlerRes = await fetch(`${baseUrl}/o/tok_historical_buyer_link`, {
      headers: { "User-Agent": "WhatsApp/2.21.12.21 i" },
    });
    assert.equal(crawlerRes.status, 200);
    const html = await crawlerRes.text();
    assert.ok(html.includes("Preserved Product"));

    // 2. Buyer submits checkout on this existing link -> HTTP 200 success!
    const checkoutRes = await fetch(`${baseUrl}/api/public/orders/tok_historical_buyer_link`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerName: "Kofi Buyer",
        customerPhone: "0245556677",
        deliveryMethod: "pickup",
        paymentAction: "pay",
      }),
    });
    assert.equal(checkoutRes.status, 200);
    const orderData = (await checkoutRes.json()) as any;
    assert.equal(orderData.customerName, "Kofi Buyer");
  } finally {
    await close();
  }
});

test("boundary test: Free tier allows 50th link and rejects 51st link with 403 LINK_LIMIT_REACHED", async () => {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  invalidateRevenueCatCache("seller_test_user");

  // Seller currently has 49 active links
  const existingOrders = Array.from({ length: 49 }, (_, i) => ({
    id: i + 1,
    ownerUserId: "seller_test_user",
    token: `tok_link_${i + 1}`,
    productId: 1,
    productName: "T-Shirt",
    status: "reserved",
    amount: "25.00",
  }));

  const mockDb = createMockDatabase({
    products: [{ id: 1, name: "T-Shirt", category: "Apparel", price: "25.00", stock: 100 }],
    orders: existingOrders,
    orderItems: [],
    sellerSettings: { trialStartedAt: thirtyDaysAgo },
  });

  const { baseUrl, close } = await startTestServer(mockDb);

  try {
    // 1. Link #50 succeeds
    const res50 = await fetch(`${baseUrl}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: 1,
        channel: "whatsapp",
        paymentMode: "full",
        amount: 25.0,
      }),
    });
    assert.equal(res50.status, 201);
    assert.equal(existingOrders.length, 50);

    // 2. Link #51 is rejected
    const res51 = await fetch(`${baseUrl}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: 1,
        channel: "whatsapp",
        paymentMode: "full",
        amount: 25.0,
      }),
    });
    assert.equal(res51.status, 403);
    const body51 = (await res51.json()) as any;
    assert.equal(body51.code, "LINK_LIMIT_REACHED");
    assert.equal(body51.limit, 50);
    assert.equal(existingOrders.length, 50); // Did not increment
  } finally {
    await close();
  }
});

test("boundary test: Pro tier allows 500th link and rejects 501st link with 403 LINK_LIMIT_REACHED", async () => {
  setCachedRevenueCatSubscriber("seller_test_user", "pro", "take_order_app_pro");

  // Pro seller with 499 active orders
  const existingOrders = Array.from({ length: 499 }, (_, i) => ({
    id: i + 1,
    ownerUserId: "seller_test_user",
    token: `tok_pro_link_${i + 1}`,
    productId: 1,
    productName: "Kente Dress",
    status: "reserved",
    amount: "150.00",
  }));

  const mockDb = createMockDatabase({
    products: [{ id: 1, name: "Kente Dress", category: "Apparel", price: "150.00", stock: 1000 }],
    orders: existingOrders,
    orderItems: [],
  });

  const { baseUrl, close } = await startTestServer(mockDb);

  try {
    // 1. Link #500 succeeds
    const res500 = await fetch(`${baseUrl}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: 1,
        channel: "instagram",
        paymentMode: "full",
        amount: 150.0,
      }),
    });
    assert.equal(res500.status, 201);
    assert.equal(existingOrders.length, 500);

    // 2. Link #501 is rejected
    const res501 = await fetch(`${baseUrl}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: 1,
        channel: "instagram",
        paymentMode: "full",
        amount: 150.0,
      }),
    });
    assert.equal(res501.status, 403);
    const body501 = (await res501.json()) as any;
    assert.equal(body501.code, "LINK_LIMIT_REACHED");
    assert.equal(body501.limit, 500);
    assert.ok(body501.message.includes("Upgrade to Pro+ to remove the active-link limit"));
    assert.equal(existingOrders.length, 500);
  } finally {
    invalidateRevenueCatCache("seller_test_user");
    await close();
  }
});

test("boundary test: Pro+ tier has unlimited links and continues creating links beyond 500", async () => {
  setCachedRevenueCatSubscriber("seller_test_user", "pro_plus", "take_order_app_pro_plus");

  // Pro+ seller already at 500 active orders
  const existingOrders = Array.from({ length: 500 }, (_, i) => ({
    id: i + 1,
    ownerUserId: "seller_test_user",
    token: `tok_proplus_${i + 1}`,
    productId: 1,
    productName: "Gold Stole",
    status: "reserved",
    amount: "200.00",
  }));

  const mockDb = createMockDatabase({
    products: [{ id: 1, name: "Gold Stole", category: "Apparel", price: "200.00", stock: 2000 }],
    orders: existingOrders,
    orderItems: [],
  });

  const { baseUrl, close } = await startTestServer(mockDb);

  try {
    // Link #501 succeeds on Pro+!
    const res501 = await fetch(`${baseUrl}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: 1,
        channel: "tiktok",
        paymentMode: "full",
        amount: 200.0,
      }),
    });
    assert.equal(res501.status, 201);
    assert.equal(existingOrders.length, 501);

    // Link #502 succeeds on Pro+!
    const res502 = await fetch(`${baseUrl}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: 1,
        channel: "tiktok",
        paymentMode: "full",
        amount: 200.0,
      }),
    });
    assert.equal(res502.status, 201);
    assert.equal(existingOrders.length, 502);
  } finally {
    invalidateRevenueCatCache("seller_test_user");
    await close();
  }
});
