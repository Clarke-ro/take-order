import assert from "node:assert/strict";
import { basename, join } from "node:path";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import {
  click,
  connectCdp,
  evaluate,
  fill,
  freePort,
  waitFor,
  waitForPage,
  waitForUrl,
  stopProcess,
  type CdpClient,
} from "./channel-conversion.browser.test";

const chromeBinary = process.env.CHROME_PATH
  || (existsSync("C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe") ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" : null)
  || (existsSync("C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe") ? "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe" : null)
  || (existsSync("/repl/tools/bin/chromium") ? "/repl/tools/bin/chromium" : "google-chrome");

async function main() {
  const artifactDir = basename(process.cwd()) === "duka"
    ? process.cwd()
    : join(process.cwd(), "artifacts", "duka");
  const vitePort = await freePort();
  const debugPort = await freePort();
  const profileDir = await mkdtemp(join(tmpdir(), "duka-catalog-editor-"));

  const vite = spawn(process.execPath, [join(artifactDir, "node_modules", "vite", "bin", "vite.js"), "--host", "127.0.0.1"], {
    cwd: artifactDir,
    env: { ...process.env, NODE_ENV: "test", PORT: String(vitePort), BASE_PATH: "/", VITE_CLERK_PUBLISHABLE_KEY: "" },
    stdio: "ignore",
  });

  const chromium = spawn(chromeBinary!, [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${profileDir}`,
    "about:blank",
  ], { stdio: "ignore" });

  let page: CdpClient | undefined;

  try {
    await waitForUrl(`http://127.0.0.1:${vitePort}/`);
    page = await connectCdp(await waitForPage(debugPort));
    await page.command("Page.enable");
    await page.command("Runtime.enable");

    const stubSource = `
      localStorage.setItem("duka-test-auth", "true");
      window.__DUKA_TEST_AUTH__ = true;
      localStorage.setItem("duka-onboarding-complete", "true");
      localStorage.setItem("duka-onboarding-profile", JSON.stringify({
        sellerName: "Test Seller",
        businessName: "Test Duka Store",
        description: "",
        channels: ["Instagram"]
      }));

      const nativeFetch = window.fetch.bind(window);
      window.fetch = async (input, init) => {
        const urlStr = typeof input === "string" ? input : input.url;
        const requestUrl = new URL(urlStr, window.location.href);

        if (requestUrl.pathname === "/api/products") {
          return new Response(JSON.stringify([
            { id: 1, name: "Silk Scarf", category: "Accessories", price: 50, cost: 20, stock: 10, imageUrl: null }
          ]), {
            status: 200,
            headers: { "Content-Type": "application/json" }
          });
        }

        if (requestUrl.pathname.startsWith("/api/")) {
          return new Response(JSON.stringify([]), {
            status: 200,
            headers: { "Content-Type": "application/json" }
          });
        }

        return nativeFetch(input, init);
      };
    `;

    await page.command("Page.addScriptToEvaluateOnNewDocument", { source: stubSource });
    await page.command("Page.navigate", { url: `http://127.0.0.1:${vitePort}/catalog/new` });

    console.log("1. Waiting for Add Item page to load...");
    await waitFor(page, `Boolean(document.querySelector('[data-testid="select-product-category"]'))`, 15000);

    // 1. Verify category trigger starts without default 'Apparel' auto-fill
    console.log("2. Checking category field default state...");
    const categoryText = await evaluate<string>(page, `document.querySelector('[data-testid="select-product-category"]')?.textContent || ""`);
    console.log("Initial category text:", categoryText.trim());
    assert.ok(categoryText.includes("Select a category"), `Category must default to empty/placeholder, got: ${categoryText}`);

    // 2. Open Category dropdown card
    console.log("3. Opening category dropdown card...");
    await click(page, '[data-testid="select-product-category"]');
    await waitFor(page, `Boolean(document.querySelector('[data-testid="card-category-dropdown"]'))`, 5000);

    // 3. Add a new custom category using the + inline creator
    console.log("4. Adding custom category 'Artisanal Crafts' via inline + creator...");
    await click(page, '[data-testid="button-add-category"]');
    await waitFor(page, `Boolean(document.querySelector('[data-testid="input-new-category-name"]'))`, 3000);

    await fill(page, '[data-testid="input-new-category-name"]', "Artisanal Crafts");
    await click(page, '[data-testid="button-save-new-category"]');
    await delay(300);

    const updatedCategoryText = await evaluate<string>(page, `document.querySelector('[data-testid="select-product-category"]')?.textContent || ""`);
    console.log("Updated category button text:", updatedCategoryText.trim());
    assert.ok(updatedCategoryText.includes("Artisanal Crafts"), `New custom category must be selected, got: ${updatedCategoryText}`);

    // 4. Financials section: strictly 2 prices, NO compare-at price input
    console.log("5. Verifying Financials section strictly contains two prices...");
    const priceFieldsCheck = await evaluate<{ hasSelling: boolean; hasCost: boolean; hasCompare: boolean }>(page, `(() => {
      const sellingPrice = document.querySelector('[data-testid="input-product-price"]');
      const costPrice = document.querySelector('[data-testid="input-product-cost"]');
      const comparePrice = document.querySelector('[data-testid="input-product-compare-at"]') ||
                           document.querySelector('input[placeholder*="compare" i]') ||
                           document.querySelector('input[name*="compare" i]');
      return {
        hasSelling: Boolean(sellingPrice),
        hasCost: Boolean(costPrice),
        hasCompare: Boolean(comparePrice),
      };
    })()`);
    assert.ok(priceFieldsCheck.hasSelling, "Selling price input must exist");
    assert.ok(priceFieldsCheck.hasCost, "Cost price input must exist");
    assert.strictEqual(priceFieldsCheck.hasCompare, false, "Compare-at price must NOT be present in financial section");

    // 5. Test real-time profit & margin overview
    console.log("6. Testing real-time gross profit and margin calculation...");
    await fill(page, '[data-testid="input-product-price"]', "200");
    await fill(page, '[data-testid="input-product-cost"]', "50");
    await delay(300);

    const profitCheck = await evaluate<{ hasProfitOverview: boolean; hasMarginText: boolean }>(page, `(() => {
      const overview = document.body.textContent || "";
      return {
        hasMarginText: overview.includes("75.0% profit margin"),
        hasProfitOverview: overview.includes("Profit & Margin Overview"),
      };
    })()`);
    assert.ok(profitCheck.hasProfitOverview, "Profit & Margin Overview card must be displayed");
    assert.ok(profitCheck.hasMarginText, "Profit margin percentage (75.0%) must be accurately displayed");

    // 6. Verify Description section has NO "(shown on buyer checkout)" text
    console.log("7. Verifying Description section label...");
    const descriptionLabelCheck = await evaluate<{ hasShownInline: boolean }>(page, `(() => {
      const descLabel = document.querySelector('label[for="product-description-reference"]');
      const labelText = descLabel?.textContent || "";
      return {
        hasShownInline: labelText.toLowerCase().includes("shown on buyer checkout"),
      };
    })()`);
    assert.strictEqual(descriptionLabelCheck.hasShownInline, false, "Inline 'shown on buyer checkout' must be completely removed");

    // 7. Verify Stock controls: Stepper buttons, Quick chips, SKU generation
    console.log("8. Testing Stock controls and SKU auto-generation...");
    const initialStock = await evaluate<string>(page, `document.querySelector('[data-testid="input-product-stock"]')?.value || ""`);
    assert.strictEqual(initialStock, "0", "Initial stock should be 0");

    // Click quick chip +10
    await click(page, '[data-testid="button-stock-add-10"]');
    await delay(200);

    const stockAfter10 = await evaluate<{ val: string; status: string }>(page, `(() => {
      const input = document.querySelector('[data-testid="input-product-stock"]');
      const statusPill = document.querySelector('[data-testid="pill-stock-status"]')?.textContent || "";
      return { val: input?.value || "", status: statusPill };
    })()`);
    assert.strictEqual(stockAfter10.val, "10", "Stock should update to 10 after +10 chip");
    assert.ok(stockAfter10.status.includes("In stock"), "Status should be In stock");

    // Click '-' decrement stepper
    await click(page, '[data-testid="button-stock-decrement"]');
    await delay(200);
    const stockAfterMinus = await evaluate<string>(page, `document.querySelector('[data-testid="input-product-stock"]')?.value || ""`);
    assert.strictEqual(stockAfterMinus, "9", "Stock should decrement to 9");

    // Click 'Set 0'
    await click(page, '[data-testid="button-stock-set-0"]');
    await delay(200);
    const stockAfterZero = await evaluate<{ val: string; status: string }>(page, `(() => {
      const input = document.querySelector('[data-testid="input-product-stock"]');
      const statusPill = document.querySelector('[data-testid="pill-stock-status"]')?.textContent || "";
      return { val: input?.value || "", status: statusPill };
    })()`);
    assert.strictEqual(stockAfterZero.val, "0", "Stock should be 0");
    assert.ok(stockAfterZero.status.includes("Out of stock"), "Status should be Out of stock");

    // Test Generate SKU button
    console.log("9. Testing Auto-generate SKU button...");
    await click(page, '[data-testid="button-generate-sku"]');
    await delay(200);
    const generatedSku = await evaluate<string>(page, `document.querySelector('[data-testid="input-product-sku"]')?.value || ""`);
    console.log("Generated SKU:", generatedSku);
    assert.ok(generatedSku && generatedSku.length >= 4, "Auto-generated SKU should populate SKU input");

    console.log("ALL CATALOG ADD ITEM PAGE BROWSER TESTS PASSED SUCCESSFULLY!");
  } finally {
    if (page) page.close();
    await stopProcess(chromium);
    await stopProcess(vite);
    await rm(profileDir, { recursive: true, force: true }).catch(() => {});
  }
}

main().catch((error) => {
  console.error("Test failed:", error);
  process.exit(1);
});
