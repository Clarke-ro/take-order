import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createApp } from "../app.js";
import { sellerSettingsTable, productsTable, ordersTable, expensesTable } from "@workspace/db/schema";
import type { db } from "@workspace/db";

function createInMemoryDatabase() {
  const settingsStore = new Map<string, any>();
  const productsStore: any[] = [];
  const ordersStore: any[] = [];
  const expensesStore: any[] = [];

  const mockDb = {
    select: () => ({
      from: (table: any) => {
        if (table === sellerSettingsTable) {
          return {
            where: (condition: any) => {
              const param = condition?.queryChunks?.find((chunk: any) => chunk && typeof chunk.value === "string");
              const ownerUserId = param?.value;
              const record = ownerUserId ? settingsStore.get(ownerUserId) : null;
              return Promise.resolve(record ? [record] : []);
            },
          };
        }
        const getOwnerId = (condition: any) => {
          const param = condition?.queryChunks?.find((chunk: any) => chunk && typeof chunk.value === "string");
          return param?.value ?? condition?.right?.value ?? condition?.value;
        };

        if (table === productsTable) {
          return {
            where: (condition: any) => {
              const ownerUserId = getOwnerId(condition);
              const rows = productsStore.filter((p) => p.ownerUserId === ownerUserId);
              return {
                orderBy: () => Promise.resolve(rows),
                then: (resolve: any) => Promise.resolve(rows).then(resolve),
              };
            },
          };
        }
        if (table === ordersTable) {
          return {
            where: (condition: any) => {
              const ownerUserId = getOwnerId(condition);
              const rows = ordersStore.filter((o) => o.ownerUserId === ownerUserId);
              return {
                orderBy: () => Promise.resolve(rows),
                then: (resolve: any) => Promise.resolve(rows).then(resolve),
              };
            },
          };
        }
        if (table === expensesTable) {
          return {
            where: (condition: any) => {
              const ownerUserId = getOwnerId(condition);
              const rows = expensesStore.filter((e) => e.ownerUserId === ownerUserId);
              return {
                orderBy: () => Promise.resolve(rows),
                then: (resolve: any) => Promise.resolve(rows).then(resolve),
              };
            },
          };
        }
        return { where: () => Promise.resolve([]) };
      },
    }),
    update: (table: any) => ({
      set: (values: any) => ({
        where: (condition: any) => ({
          returning: () => {
            if (table === productsTable) {
              // Extract id and ownerUserId
              const getParam = (c: any) => c?.value ?? c?.queryChunks?.find((chunk: any) => chunk && typeof chunk.value !== "undefined")?.value;
              let targetId: any = null;
              let targetOwner: any = null;
              if (condition?.queryChunks) {
                const params = condition.queryChunks.filter((chunk: any) => chunk && typeof chunk.value !== "undefined");
                targetId = params[0]?.value;
                targetOwner = params[1]?.value;
              }
              const index = productsStore.findIndex((p) => p.id === targetId && p.ownerUserId === targetOwner);
              if (index === -1) return Promise.resolve([]);
              productsStore[index] = { ...productsStore[index], ...values };
              return Promise.resolve([productsStore[index]]);
            }
            return Promise.resolve([]);
          },
        }),
      }),
    }),
    insert: (table: any) => ({
      values: (values: any) => ({
        onConflictDoUpdate: (_config: any) => ({
          returning: () => {
            if (table === sellerSettingsTable) {
              const record = { id: 1, ownerUserId: values.ownerUserId, settings: values.settings };
              settingsStore.set(values.ownerUserId, record);
              return Promise.resolve([record]);
            }
            return Promise.resolve([values]);
          },
        }),
        returning: () => {
          if (table === productsTable) {
            const row = { id: productsStore.length + 1, ...values };
            productsStore.push(row);
            return Promise.resolve([row]);
          }
          if (table === ordersTable) {
            const row = { id: ordersStore.length + 1, ...values };
            ordersStore.push(row);
            return Promise.resolve([row]);
          }
          return Promise.resolve([values]);
        },
      }),
    }),
  } as unknown as typeof db;

  return mockDb;
}

test("multi-tenancy isolation: seller B cannot see or inherit seller A's onboarding or business details", async () => {
  const database = createInMemoryDatabase();
  const app = createApp(database);
  const server = createServer(app);

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 5000;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const sellerA = "user_seller_alpha_123";
    const sellerB = "user_seller_beta_456";

    // Step 1: Seller A signs up and submits onboarding settings
    const sellerASettings = {
      sellerName: "Alice Smith",
      businessName: "Alice's Boutique",
      description: "Handcrafted dresses and jewelry",
      logoDataUrl: null,
      channels: ["whatsapp", "instagram"],
      currency: "GHS" as const,
      paymentMode: "full" as const,
      checkoutAskForDetails: true,
      checkoutAllowReferenceImages: true,
      deliveryDefault: "both" as const,
      deliveryFee: 15,
      customDomain: "",
      seoTitle: "",
      seoDescription: "",
      trackingId: "",
      organizationName: "Alice Corp",
      organizationEmail: "alice@boutique.com",
      organizationPhone: "+233201111111",
      organizationCountry: "gh",
      organizationAddress: "123 Accra St",
      orderUpdates: true,
      stockAlerts: true,
      compactTables: false,
      connectedTools: ["WhatsApp", "Instagram"],
    };

    const putResA = await fetch(`${baseUrl}/api/settings`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "x-test-user-id": sellerA,
      },
      body: JSON.stringify(sellerASettings),
    });

    assert.equal(putResA.status, 200);
    const savedA = (await putResA.json()) as any;
    assert.equal(savedA.businessName, "Alice's Boutique");

    // Step 2: Seller B signs up and fetches settings fresh
    const getResB = await fetch(`${baseUrl}/api/settings`, {
      headers: {
        "x-test-user-id": sellerB,
      },
    });

    assert.equal(getResB.status, 200);
    const bodyB = (await getResB.json()) as any;

    // Seller B must NOT see any of Seller A's data!
    assert.equal(bodyB.businessName, "", "Seller B businessName must be empty");
    assert.equal(bodyB.sellerName, "", "Seller B sellerName must be empty");
    assert.equal(bodyB.organizationPhone, "", "Seller B phone must be empty");
    assert.notEqual(bodyB.businessName, "Alice's Boutique");
    assert.notEqual(bodyB.sellerName, "Alice Smith");

    // Step 3: Seller B enters their own onboarding details
    const sellerBSettings = {
      sellerName: "Bob Jones",
      businessName: "Bob's Kicks",
      description: "Premium sneakers and shoes",
      logoDataUrl: null,
      channels: ["whatsapp", "tiktok"],
      currency: "USD" as const,
      paymentMode: "reserve" as const,
      checkoutAskForDetails: true,
      checkoutAllowReferenceImages: false,
      deliveryDefault: "delivery" as const,
      deliveryFee: 20,
      customDomain: "",
      seoTitle: "",
      seoDescription: "",
      trackingId: "",
      organizationName: "Bob Ltd",
      organizationEmail: "bob@kicks.com",
      organizationPhone: "+1234567890",
      organizationCountry: "us",
      organizationAddress: "456 Market St",
      orderUpdates: false,
      stockAlerts: false,
      compactTables: true,
      connectedTools: ["TikTok"],
    };

    const putResB = await fetch(`${baseUrl}/api/settings`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "x-test-user-id": sellerB,
      },
      body: JSON.stringify(sellerBSettings),
    });

    assert.equal(putResB.status, 200);
    const savedB = (await putResB.json()) as any;
    assert.equal(savedB.businessName, "Bob's Kicks");

    // Step 4: Verify Seller A's settings remain completely isolated and intact
    const getResA2 = await fetch(`${baseUrl}/api/settings`, {
      headers: {
        "x-test-user-id": sellerA,
      },
    });

    assert.equal(getResA2.status, 200);
    const bodyA2 = (await getResA2.json()) as any;
    assert.equal(bodyA2.businessName, "Alice's Boutique");
    assert.equal(bodyA2.sellerName, "Alice Smith");
    assert.notEqual(bodyA2.businessName, "Bob's Kicks");

    // Step 5: Verify products and orders are strictly isolated between seller A and seller B
    const createProdResA = await fetch(`${baseUrl}/api/products`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-test-user-id": sellerA,
      },
      body: JSON.stringify({
        name: "Silk Summer Dress",
        price: 120,
        stock: 10,
        category: "Dresses",
        variants: ["Small", "Medium"],
        preferences: [],
      }),
    });
    assert.equal(createProdResA.status, 201);
    const prodA = (await createProdResA.json()) as any;

    // Seller B lists products -> must receive 0 products!
    const getProdResB = await fetch(`${baseUrl}/api/products`, {
      headers: { "x-test-user-id": sellerB },
    });
    assert.equal(getProdResB.status, 200);
    const prodsB = (await getProdResB.json()) as any;
    assert.equal(prodsB.length, 0, "Seller B must see 0 products from Seller A");

    // Seller B attempts to patch Seller A's product -> 404
    const patchProdResB = await fetch(`${baseUrl}/api/products/${prodA.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-test-user-id": sellerB,
      },
      body: JSON.stringify({ name: "Hacked name" }),
    });
    assert.equal(patchProdResB.status, 404, "Seller B cannot modify Seller A's product");
  } finally {
    server.close();
  }
});
