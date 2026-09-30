import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { ordersTable, orderItemsTable, productsTable, sellerSettingsTable } from "@workspace/db/schema";
import type { db } from "@workspace/db";
import { createApp } from "../app.js";

function createMockDatabase(options: {
  orders: any[];
  orderItems: any[];
  products: any[];
  sellerSettings?: any;
}): typeof db {
  const { orders, orderItems, products, sellerSettings } = options;

  return {
    select() {
      return {
        from(table: unknown) {
          return {
            where(predicate: any) {
              if (table === ordersTable) {
                // Find order matching token
                return Promise.resolve(orders);
              }
              if (table === orderItemsTable) {
                return Promise.resolve(orderItems);
              }
              if (table === productsTable) {
                return Promise.resolve(products);
              }
              if (table === sellerSettingsTable) {
                return Promise.resolve(sellerSettings ? [{ settings: sellerSettings }] : []);
              }
              return Promise.resolve([]);
            },
          };
        },
      };
    },
  } as unknown as typeof db;
}

test("GET /o/:token serves Open Graph and Twitter card tags to WhatsApp crawler", async () => {
  const mockDb = createMockDatabase({
    orders: [
      {
        id: 1,
        ownerUserId: "seller_1",
        token: "tok_abc123",
        productId: 10,
        productName: "Linen Summer Dress",
        amount: "320.00",
        customerName: "",
        channel: "whatsapp",
        paymentMode: "full",
        status: "reserved",
        fulfillment: "pending",
        linkOpens: 0,
        deliveryFee: "0",
      },
    ],
    orderItems: [
      {
        id: 101,
        orderId: 1,
        productId: 10,
        productName: "Linen Summer Dress",
        amount: "320.00",
        quantity: 1,
        imageUrls: ["https://cdn.example.com/dress.jpg"],
      },
    ],
    products: [
      {
        id: 10,
        name: "Linen Summer Dress",
        price: "320.00",
        imageUrl: "https://cdn.example.com/dress.jpg",
      },
    ],
    sellerSettings: {
      businessName: "The Sunday Edit",
      currency: "GHS",
    },
  });

  const app = createApp(mockDb);
  const server = createServer(app);

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;

  try {
    // 1. Crawler request (WhatsApp)
    const crawlerRes = await fetch(`http://localhost:${port}/o/tok_abc123`, {
      headers: {
        "User-Agent": "WhatsApp/2.21.12.21 i",
      },
      redirect: "manual",
    });

    assert.equal(crawlerRes.status, 200);
    const contentType = crawlerRes.headers.get("content-type") || "";
    assert.ok(contentType.includes("text/html"));

    const html = await crawlerRes.text();
    // Must include og:title with Product name — formatted price · Seller business name
    assert.ok(html.includes('<meta property="og:title" content="Linen Summer Dress — '));
    assert.ok(html.includes("The Sunday Edit"));
    // Must include og:description
    assert.ok(html.includes('<meta property="og:description" content="Complete your order from The Sunday Edit."'));
    // Must include absolute https og:image
    assert.ok(html.includes('<meta property="og:image" content="https://cdn.example.com/dress.jpg"'));
    // Must include canonical og:url
    assert.ok(html.includes('<meta property="og:url" content="http://localhost:'));
    assert.ok(html.includes('/o/tok_abc123"'));
    // Must include twitter card
    assert.ok(html.includes('<meta name="twitter:card" content="summary_large_image"'));
    assert.ok(html.includes('<meta name="twitter:image" content="https://cdn.example.com/dress.jpg"'));

    // Must NOT redirect crawler
    assert.equal(html.includes("window.location.replace"), false);

    // 2. Real browser visitor request (should redirect to SPA checkout)
    const browserRes = await fetch(`http://localhost:${port}/o/tok_abc123`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
      },
      redirect: "manual",
    });

    // In local dev with distinct FRONTEND_URL, browser is redirected with 302
    assert.ok([200, 302].includes(browserRes.status));
    if (browserRes.status === 302) {
      assert.ok(browserRes.headers.get("location")?.includes("/o/tok_abc123"));
    }
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test("GET /o/:token formats multi-item cart orders with item count summary", async () => {
  const mockDb = createMockDatabase({
    orders: [
      {
        id: 2,
        ownerUserId: "seller_2",
        token: "tok_cart_999",
        productId: 20,
        productName: "Cart Order",
        amount: "580.00",
        customerName: "",
        channel: "instagram",
        paymentMode: "full",
        status: "reserved",
        fulfillment: "pending",
        linkOpens: 0,
      },
    ],
    orderItems: [
      {
        id: 201,
        orderId: 2,
        productId: 20,
        productName: "Gold Hoop Earrings",
        amount: "180.00",
        quantity: 1,
        imageUrls: ["https://cdn.example.com/hoops.jpg"],
      },
      {
        id: 202,
        orderId: 2,
        productId: 21,
        productName: "Pearl Necklace",
        amount: "400.00",
        quantity: 1,
        imageUrls: ["https://cdn.example.com/necklace.jpg"],
      },
    ],
    products: [],
    sellerSettings: {
      businessName: "Aurum Jewelry",
      currency: "USD",
    },
  });

  const app = createApp(mockDb);
  const server = createServer(app);

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;

  try {
    const res = await fetch(`http://localhost:${port}/o/tok_cart_999`, {
      headers: {
        "User-Agent": "facebookexternalhit/1.1",
      },
    });

    assert.equal(res.status, 200);
    const html = await res.text();
    // Multi-item title: "2 items from Aurum Jewelry — $580.00"
    assert.ok(html.includes('<meta property="og:title" content="2 items from Aurum Jewelry — $580.00"'));
    // Uses first item's photo
    assert.ok(html.includes('<meta property="og:image" content="https://cdn.example.com/hoops.jpg"'));
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test("GET /o/:token falls back to generic Take Order brand image when no item photo exists", async () => {
  const mockDb = createMockDatabase({
    orders: [
      {
        id: 3,
        ownerUserId: "seller_3",
        token: "tok_no_img",
        productId: 30,
        productName: "Custom Catering Service",
        amount: "1200.00",
        customerName: "",
        channel: "chat",
        paymentMode: "full",
        status: "reserved",
        fulfillment: "pending",
        linkOpens: 0,
      },
    ],
    orderItems: [
      {
        id: 301,
        orderId: 3,
        productId: 30,
        productName: "Custom Catering Service",
        amount: "1200.00",
        quantity: 1,
        imageUrls: [],
      },
    ],
    products: [],
    sellerSettings: {
      businessName: "Bakes & Bowls",
      currency: "GHS",
    },
  });

  const app = createApp(mockDb);
  const server = createServer(app);

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;

  try {
    const res = await fetch(`http://localhost:${port}/o/tok_no_img`, {
      headers: {
        "User-Agent": "TelegramBot (like TwitterBot)",
      },
    });

    assert.equal(res.status, 200);
    const html = await res.text();
    // Fallback image should point to branded takeorder-wave.png
    assert.ok(html.includes('/branding/takeorder-wave.png'));
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test("POST /api/upload/presign rejects missing or unsupported contentType with 400", async () => {
  const mockDb = createMockDatabase({ orders: [], orderItems: [], products: [] });
  const app = createApp(mockDb);
  const server = createServer(app);

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;

  try {
    // Missing contentType
    const res1 = await fetch(`http://localhost:${port}/api/upload/presign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: "test.png" }),
    });
    assert.equal(res1.status, 400);
    const body1 = (await res1.json()) as any;
    assert.ok(body1.error.includes("contentType is required"));

    // Unsupported contentType (e.g. application/pdf)
    const res2 = await fetch(`http://localhost:${port}/api/upload/presign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: "doc.pdf", contentType: "application/pdf" }),
    });
    assert.equal(res2.status, 400);
    const body2 = (await res2.json()) as any;
    assert.ok(body2.error.includes("Unsupported image type"));
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

