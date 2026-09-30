import { db } from "@workspace/db";
import {
  sellerSettingsTable,
  productsTable,
  ordersTable,
  orderItemsTable,
  expensesTable,
} from "@workspace/db/schema";
import { inArray, or, like } from "drizzle-orm";
import { assertStagingEnvironment } from "./staging-guard.js";

async function main() {
  assertStagingEnvironment("staging-reset");

  const wipeAll = process.argv.includes("--all");
  console.log(`🧹 Starting staging database reset (wipeAll=${wipeAll})...`);

  const STAGING_SELLER_IDS = ["staging_seller_ama", "staging_seller_kwame"];

  if (wipeAll) {
    console.log("⚠️  Wiping all rows in staging database...");
    await db.delete(orderItemsTable);
    await db.delete(ordersTable);
    await db.delete(productsTable);
    await db.delete(expensesTable);
    await db.delete(sellerSettingsTable);
  } else {
    console.log(`Cleaning test records for staging sellers: ${STAGING_SELLER_IDS.join(", ")}...`);

    // Clean order items connected to staging orders
    const stagingOrders = (await db
      .select({ id: ordersTable.id })
      .from(ordersTable)
      .where(inArray(ordersTable.ownerUserId, STAGING_SELLER_IDS))) as Array<{ id: number }>;

    const orderIds = stagingOrders.map((o: { id: number }) => o.id);
    if (orderIds.length > 0) {
      await db.delete(orderItemsTable).where(inArray(orderItemsTable.orderId, orderIds));
    }

    await db.delete(ordersTable).where(inArray(ordersTable.ownerUserId, STAGING_SELLER_IDS));
    await db.delete(productsTable).where(inArray(productsTable.ownerUserId, STAGING_SELLER_IDS));
    await db.delete(expensesTable).where(inArray(expensesTable.ownerUserId, STAGING_SELLER_IDS));
    await db
      .delete(sellerSettingsTable)
      .where(inArray(sellerSettingsTable.ownerUserId, STAGING_SELLER_IDS));
  }

  console.log("✅ Staging reset completed successfully!");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Staging reset failed:", err);
  process.exit(1);
});
