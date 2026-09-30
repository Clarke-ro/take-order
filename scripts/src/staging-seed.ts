import { db } from "@workspace/db";
import {
  sellerSettingsTable,
  productsTable,
  ordersTable,
  orderItemsTable,
  expensesTable,
} from "@workspace/db/schema";
import { assertStagingEnvironment } from "./staging-guard.js";

async function main() {
  assertStagingEnvironment("staging-seed");

  console.log("🌱 Starting staging database seeding...");

  const SELLER_1_ID = "staging_seller_ama";
  const SELLER_2_ID = "staging_seller_kwame";

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  // 1. Seed Seller 1 Settings (Accra Artisan Bakery)
  await db
    .insert(sellerSettingsTable)
    .values({
      ownerUserId: SELLER_1_ID,
      settings: {
        sellerName: "Ama Kofi",
        businessName: "Accra Artisan Bakery",
        description: "Handcrafted artisan sourdough and French pastries baked fresh daily in Osu, Accra.",
        currency: "GHS",
        paymentMode: "full",
        checkoutAskForDetails: true,
        checkoutAllowReferenceImages: true,
        deliveryDefault: "both",
        deliveryFee: 25,
        trialStartedAt: now.toISOString(),
      },
    })
    .onConflictDoUpdate({
      target: sellerSettingsTable.ownerUserId,
      set: {
        settings: {
          sellerName: "Ama Kofi",
          businessName: "Accra Artisan Bakery",
          description: "Handcrafted artisan sourdough and French pastries baked fresh daily in Osu, Accra.",
          currency: "GHS",
          paymentMode: "full",
          checkoutAskForDetails: true,
          checkoutAllowReferenceImages: true,
          deliveryDefault: "both",
          deliveryFee: 25,
          trialStartedAt: now.toISOString(),
        },
      },
    });

  // 2. Seed Seller 2 Settings (Kente Luxe Boutique)
  await db
    .insert(sellerSettingsTable)
    .values({
      ownerUserId: SELLER_2_ID,
      settings: {
        sellerName: "Kwame Mensah",
        businessName: "Kente Luxe Boutique",
        description: "Authentic Ghanaian handwoven Kente textiles and tailored apparel.",
        currency: "USD",
        paymentMode: "deposit",
        checkoutAskForDetails: true,
        checkoutAllowReferenceImages: true,
        deliveryDefault: "shipping",
        deliveryFee: 15,
        trialStartedAt: now.toISOString(),
      },
    })
    .onConflictDoUpdate({
      target: sellerSettingsTable.ownerUserId,
      set: {
        settings: {
          sellerName: "Kwame Mensah",
          businessName: "Kente Luxe Boutique",
          description: "Authentic Ghanaian handwoven Kente textiles and tailored apparel.",
          currency: "USD",
          paymentMode: "deposit",
          checkoutAskForDetails: true,
          checkoutAllowReferenceImages: true,
          deliveryDefault: "shipping",
          deliveryFee: 15,
          trialStartedAt: now.toISOString(),
        },
      },
    });

  // 3. Seed Products for Seller 1
  const [product1] = await db
    .insert(productsTable)
    .values({
      ownerUserId: SELLER_1_ID,
      name: "Artisan Sourdough Boule",
      category: "Breads",
      sku: "AAB-BOULE-01",
      description: "Naturally fermented 36-hour sourdough boule with a crisp, blistered crust.",
      price: "85.00",
      cost: "35.00",
      stock: 30,
      variants: ["Classic", "Seeded Sesame", "Rosemary Garlic"],
      accent: "#0F6E6B",
    })
    .returning();

  const [product2] = await db
    .insert(productsTable)
    .values({
      ownerUserId: SELLER_1_ID,
      name: "Butter Croissant Box (6-Pack)",
      category: "Pastries",
      sku: "AAB-CROIS-06",
      description: "Flaky golden croissants laminated with Normandy butter.",
      price: "120.00",
      cost: "48.00",
      stock: 20,
      variants: ["Standard"],
      accent: "#D97706",
    })
    .returning();

  // 4. Seed Product for Seller 2
  const [product3] = await db
    .insert(productsTable)
    .values({
      ownerUserId: SELLER_2_ID,
      name: "Bonwire Royal Kente Stole",
      category: "Apparel",
      sku: "KLB-STOLE-01",
      description: "Authentic master-weaver silk Kente stole with ceremonial gold and green motifs.",
      price: "180.00",
      cost: "75.00",
      stock: 12,
      variants: ["Adwinasa Pattern", "Oyokoman Pattern"],
      accent: "#4F46E5",
    })
    .returning();

  // 5. Seed Order Links & Items
  if (product1) {
    const [order1] = await db
      .insert(ordersTable)
      .values({
        ownerUserId: SELLER_1_ID,
        token: `stg-sourdough-${Date.now().toString(36)}`,
        productId: product1.id,
        productName: product1.name,
        customerName: "Kweku Boateng",
        customerPhone: "+233244123456",
        channel: "Instagram DM",
        amount: "85.00",
        deliveryFee: "15.00",
        deliveryMethod: "delivery",
        deliveryAddress: "Cantonments, Accra",
        productCost: product1.cost,
        paymentMode: "full",
        status: "reserved",
        fulfillment: "pending",
        linkOpens: 3,
      })
      .returning();

    if (order1) {
      await db.insert(orderItemsTable).values({
        orderId: order1.id,
        productId: product1.id,
        productName: product1.name,
        amount: "85.00",
        quantity: 1,
        position: 0,
        buyerVariant: "Classic",
      });
    }
  }

  if (product2) {
    const [order2] = await db
      .insert(ordersTable)
      .values({
        ownerUserId: SELLER_1_ID,
        token: `stg-croissant-${Date.now().toString(36)}`,
        productId: product2.id,
        productName: product2.name,
        customerName: "Abena Mansa",
        customerPhone: "+233208987654",
        channel: "WhatsApp",
        amount: "120.00",
        deliveryFee: "0.00",
        deliveryMethod: "pickup",
        productCost: product2.cost,
        paymentMode: "full",
        status: "paid",
        fulfillment: "delivered",
        linkOpens: 8,
      })
      .returning();

    if (order2) {
      await db.insert(orderItemsTable).values({
        orderId: order2.id,
        productId: product2.id,
        productName: product2.name,
        amount: "120.00",
        quantity: 1,
        position: 0,
      });
    }
  }

  // 6. Seed Expenses
  await db.insert(expensesTable).values([
    {
      ownerUserId: SELLER_1_ID,
      title: "50kg Organic Baking Flour",
      category: "Inventory",
      amount: "450.00",
      expenseDate: todayStr,
      note: "Batch purchase from Tema flour mills",
    },
    {
      ownerUserId: SELLER_1_ID,
      title: "Bakery Electricity & Gas Refill",
      category: "Utilities",
      amount: "280.00",
      expenseDate: todayStr,
      note: "Commercial oven gas cylinder",
    },
  ]);

  console.log("✅ Staging seed completed successfully!");
  console.log("   • Seeded 2 Sellers (Ama Kofi & Kwame Mensah)");
  console.log("   • Seeded 3 Products");
  console.log("   • Seeded 2 Active Orders & Items");
  console.log("   • Seeded 2 Expenses");

  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Staging seed failed:", err);
  process.exit(1);
});
