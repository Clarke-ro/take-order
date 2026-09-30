import { db } from "@workspace/db";
import { sellerSettingsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { assertStagingEnvironment } from "./staging-guard";

export async function simulateTrialExpiry(options: { sellerId?: string; daysAgo?: number } = {}) {
  assertStagingEnvironment("simulate-trial-expiry");

  const targetSellerId = options.sellerId || "staging_seller_ama";
  const daysAgo = options.daysAgo ?? 30;

  console.log(`⏱️  Simulating trial expiration for seller: '${targetSellerId}' (${daysAgo} days ago)...`);

  const [existing] = await db
    .select()
    .from(sellerSettingsTable)
    .where(eq(sellerSettingsTable.ownerUserId, targetSellerId));

  if (!existing) {
    throw new Error(`Seller '${targetSellerId}' not found in seller_settings table.`);
  }

  const expiredDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
  const currentSettings = (existing.settings ?? {}) as Record<string, unknown>;
  const updatedSettings = {
    ...currentSettings,
    trialStartedAt: expiredDate,
  };

  await db
    .update(sellerSettingsTable)
    .set({ settings: updatedSettings })
    .where(eq(sellerSettingsTable.ownerUserId, targetSellerId));

  console.log("✅ Trial timestamp successfully expired!");
  console.log(`   • Seller ID: ${targetSellerId}`);
  console.log(`   • Previous trialStartedAt: ${currentSettings.trialStartedAt || "unset"}`);
  console.log(`   • New trialStartedAt: ${expiredDate}`);
  console.log(`   • Days ago: ${daysAgo}`);
  console.log(`   • Result: Next API request for this seller will authoritatively resolve tier='free'.`);
}

async function main() {
  const sellerIdArg = process.argv.find((a) => a.startsWith("--sellerId="))?.split("=")[1];
  const daysAgoArg = parseInt(
    process.argv.find((a) => a.startsWith("--daysAgo="))?.split("=")[1] || "30",
    10,
  );
  await simulateTrialExpiry({
    sellerId: sellerIdArg,
    daysAgo: isNaN(daysAgoArg) ? 30 : daysAgoArg,
  });
  process.exit(0);
}

if (process.argv[1] && process.argv[1].includes("simulate-trial-expiry")) {
  main().catch((err) => {
    console.error("❌ Failed to simulate trial expiry:", err);
    process.exit(1);
  });
}
