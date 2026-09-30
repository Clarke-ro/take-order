import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { assertStagingEnvironment } from "./staging-guard";

function loadStagingEnv() {
  const envPath = path.resolve(process.cwd(), ".env.staging.local");
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
      const idx = trimmed.indexOf("=");
      const k = trimmed.substring(0, idx).trim();
      const v = trimmed.substring(idx + 1).trim();
      if (k && !process.env[k]) {
        process.env[k] = v;
      }
    }
  }
}

async function runVerification() {
  loadStagingEnv();
  assertStagingEnvironment("verify-staging-runtime");

  const baseUrl = "http://localhost:5000";

  console.log("=== RUNNING STAGING RUNTIME VERIFICATIONS ===");
  console.log("Target Database Ref: kazlvtfohdrmtjvvftoc\n");
  console.log("Setting up fresh staging test records...");
  execSync("pnpm run db:reset:staging && pnpm run db:seed:staging", {
    env: { ...process.env, APP_ENV: "staging", CONFIRM_STAGING: "1" },
    stdio: "inherit",
  });
  console.log("Fresh seed ready.\n");

  // ---------------------------------------------------------------------------
  // 1. Unauthenticated Checks
  // ---------------------------------------------------------------------------
  console.log("--- 1. Testing Unauthenticated Access ---");
  const unauthOrdersRes = await fetch(`${baseUrl}/api/orders`);
  assert.equal(unauthOrdersRes.status, 401, "GET /api/orders without auth must return 401");
  console.log("PASS: GET /api/orders without auth returned 401 Unauthorized");

  const unauthProductsRes = await fetch(`${baseUrl}/api/products`);
  assert.equal(unauthProductsRes.status, 401, "GET /api/products without auth must return 401");
  console.log("PASS: GET /api/products without auth returned 401 Unauthorized");

  const unauthSummaryRes = await fetch(`${baseUrl}/api/dashboard/summary`);
  assert.equal(unauthSummaryRes.status, 401, "GET /api/dashboard/summary without auth must return 401");
  console.log("PASS: GET /api/dashboard/summary without auth returned 401 Unauthorized\n");

  // ---------------------------------------------------------------------------
  // 2. Cross-Seller Isolation Checks
  // ---------------------------------------------------------------------------
  console.log("--- 2. Testing Cross-Seller Data Isolation ---");
  const amaHeaders = { Authorization: "Bearer test-staging_seller_ama" };
  const kwameHeaders = { Authorization: "Bearer test-staging_seller_kwame" };

  const amaProductsRes = await fetch(`${baseUrl}/api/products`, { headers: amaHeaders });
  const amaProducts = (await amaProductsRes.json()) as any;

  const kwameProductsRes = await fetch(`${baseUrl}/api/products`, { headers: kwameHeaders });
  assert.equal(kwameProductsRes.status, 200);
  const kwameProducts = (await kwameProductsRes.json()) as any;

  console.log(`Ama products count: ${amaProducts.length}`);
  console.log(`Kwame products count: ${kwameProducts.length}`);

  assert(amaProducts.length > 0, "Ama should have seeded products");
  assert(kwameProducts.length > 0, "Kwame should have seeded products");

  // Verify Ama's products do not overlap with Kwame's
  const amaProductIds = new Set(amaProducts.map((p: any) => p.id));
  const kwameProductIds = new Set(kwameProducts.map((p: any) => p.id));
  for (const id of amaProductIds) {
    assert(!kwameProductIds.has(id), `Product ${id} should not belong to Kwame`);
  }
  console.log("PASS: Products are strictly isolated between Ama and Kwame");

  // Verify Orders isolation
  const amaOrdersRes = await fetch(`${baseUrl}/api/orders`, { headers: amaHeaders });
  assert.equal(amaOrdersRes.status, 200);
  const amaOrders = (await amaOrdersRes.json()) as any;

  const kwameOrdersRes = await fetch(`${baseUrl}/api/orders`, { headers: kwameHeaders });
  assert.equal(kwameOrdersRes.status, 200);
  const kwameOrders = (await kwameOrdersRes.json()) as any;

  console.log(`Ama orders count: ${amaOrders.length}`);
  console.log(`Kwame orders count: ${kwameOrders.length}`);

  const amaOrderIds = new Set(amaOrders.map((o: any) => o.id));
  for (const o of kwameOrders) {
    assert(!amaOrderIds.has(o.id), `Order ${o.id} should not appear in Kwame's orders`);
  }
  console.log("PASS: Orders are strictly isolated between Ama and Kwame");

  // Test cross-seller mutation denial: Kwame cannot PATCH Ama's order
  if (amaOrders.length > 0) {
    const targetOrderId = amaOrders[0].id;
    const hackAttempt = await fetch(`${baseUrl}/api/orders/${targetOrderId}`, {
      method: "PATCH",
      headers: { ...kwameHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ fulfillment: "delivered" }),
    });
    assert.equal(hackAttempt.status, 404, "Kwame patching Ama order should return 404 Not Found");
    console.log(`PASS: Cross-seller order mutation rejected (HTTP 404) for order ${targetOrderId}\n`);
  }

  // ---------------------------------------------------------------------------
  // 3. Entitlements & Commercial Limits Checks (Trial Account)
  // ---------------------------------------------------------------------------
  console.log("--- 3. Testing Entitlements & Commercial Limits (Trial) ---");
  const amaEntitlementRes = await fetch(`${baseUrl}/api/subscription/entitlements`, { headers: amaHeaders });
  assert.equal(amaEntitlementRes.status, 200);
  const amaEntitlement = (await amaEntitlementRes.json()) as any;

  console.log(`Ama initial tier: ${amaEntitlement.tier}`);
  console.log(`Ama active links: ${amaEntitlement.usage.activeLinkCount}`);
  console.log(`Ama active link limit: ${amaEntitlement.limits.activeLinkLimit.limit}`);
  console.log(`Ama link limit reached: ${amaEntitlement.limits.activeLinkLimitReached}`);

  assert.equal(amaEntitlement.tier, "trial", "Newly seeded account should be in trial");
  assert.equal(amaEntitlement.limits.activeLinkLimit.limit, 500, "Trial tier has Pro limit (500 links)");
  assert.equal(amaEntitlement.limits.catalogLimit.limit, null, "Catalog products limit must be null (unlimited over JSON)");
  assert.equal(amaEntitlement.limits.activeLinkLimitReached, false, "Ama should not have reached limit");
  console.log("PASS: Entitlement limits and tier capabilities verified for trial\n");

  // ---------------------------------------------------------------------------
  // 4. Analytics Capability & Export (Trial Account)
  // ---------------------------------------------------------------------------
  console.log("--- 4. Testing Analytics Capabilities (Trial) ---");
  console.log(`Trial tier canExportAnalytics: ${amaEntitlement.capabilities.canExportAnalytics}`);
  assert.equal(amaEntitlement.capabilities.canExportAnalytics, true, "Trial users can export analytics");

  const exportTrialRes = await fetch(`${baseUrl}/api/dashboard/export`, { headers: amaHeaders });
  assert.equal(exportTrialRes.status, 200, "Trial account export must return 200 OK");
  const csvData = await exportTrialRes.text();
  assert(csvData.includes("Order ID"), "Export must return CSV content");
  console.log("PASS: Analytics export succeeds for trial tier (HTTP 200)\n");

  // ---------------------------------------------------------------------------
  // 5. Trial Expiration Simulation & Free Downgrade (Analytics-Denial & Link Survival)
  // ---------------------------------------------------------------------------
  console.log("--- 5. Simulating Trial Expiry & Testing Analytics Denial ---");
  execSync("pnpm run db:simulate-expiry -- --sellerId=staging_seller_ama --daysAgo=30", {
    env: { ...process.env, APP_ENV: "staging", CONFIRM_STAGING: "1" },
    stdio: "inherit",
  });

  // Small delay to let the event loop refresh sockets after synchronous execSync
  await new Promise((r) => setTimeout(r, 200));

  const postExpiryEntitlementRes = await fetch(`${baseUrl}/api/subscription/entitlements`, {
    headers: { ...amaHeaders, Connection: "close" },
  });
  assert.equal(postExpiryEntitlementRes.status, 200);
  const postExpiryEntitlement = (await postExpiryEntitlementRes.json()) as any;

  console.log(`Ama post-expiry tier: ${postExpiryEntitlement.tier}`);
  console.log(`Ama post-expiry link limit: ${postExpiryEntitlement.limits.activeLinkLimit.limit}`);
  console.log(`Ama post-expiry canExportAnalytics: ${postExpiryEntitlement.capabilities.canExportAnalytics}`);

  assert.equal(postExpiryEntitlement.tier, "free", "Expired trial should downgrade to free");
  assert.equal(postExpiryEntitlement.limits.activeLinkLimit.limit, 50, "Free tier must have 50 active links limit");
  assert.equal(postExpiryEntitlement.capabilities.dashboardExperience, "standard", "Free tier has standard dashboard experience");
  assert.equal(postExpiryEntitlement.capabilities.canAccessReports, false, "Free tier cannot access reports");
  console.log("PASS: Post-expiry account successfully transitioned to Free tier");

  // Verify Analytics Export is DENIED for Free tier (Analytics-denial check)
  const exportFreeRes = await fetch(`${baseUrl}/api/dashboard/export`, { headers: amaHeaders });
  assert.equal(exportFreeRes.status, 403, "Free account export must return 403 Forbidden");
  const denialBody = (await exportFreeRes.json()) as any;
  assert.equal(denialBody.code, "PRO_FEATURE_REQUIRED");
  console.log("PASS: Analytics export is strictly denied for Free tier (HTTP 403 PRO_FEATURE_REQUIRED)");

  // Verify Link & Data Survival after downgrade
  const postExpiryOrdersRes = await fetch(`${baseUrl}/api/orders`, { headers: amaHeaders });
  assert.equal(postExpiryOrdersRes.status, 200);
  const postExpiryOrders = (await postExpiryOrdersRes.json()) as any;
  assert.equal(postExpiryOrders.length, 2, "Existing orders must survive downgrade intact");

  const postExpiryProductsRes = await fetch(`${baseUrl}/api/products`, { headers: amaHeaders });
  assert.equal(postExpiryProductsRes.status, 200);
  const postExpiryProducts = (await postExpiryProductsRes.json()) as any;
  assert.equal(postExpiryProducts.length, 2, "Existing products must survive downgrade intact");
  console.log("PASS: Existing orders and products survived downgrade intact without data loss\n");

  console.log("==================================================================");
  console.log("ALL STAGING RUNTIME VERIFICATIONS COMPLETED SUCCESSFULLY (PASS)!");
  console.log("Verified against staging database ref: kazlvtfohdrmtjvvftoc");
  console.log("==================================================================");
}

runVerification().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
