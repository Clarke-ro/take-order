import assert from "node:assert/strict";
import { join, basename } from "node:path";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { spawn, type ChildProcess } from "node:child_process";
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

const products = [
  {
    id: 11,
    name: "Linen shirt",
    category: "Shirts",
    price: 25,
    cost: 10,
    stock: 8,
    variants: [],
    preferences: [],
    customFields: [],
    imageUrl: null,
    accent: "#2F5BFF",
  },
  {
    id: 12,
    name: "Canvas tote",
    category: "Bags",
    price: 45,
    cost: 18,
    stock: 6,
    variants: [],
    preferences: [],
    customFields: [],
    imageUrl: null,
    accent: "#C9943D",
  },
];

const fallbackCustomProduct = {
  id: 91,
  name: "Custom jacket",
  category: "Custom order",
  price: 125,
  cost: null,
  stock: 0,
  variants: ["Small", "Medium", "Large", "Navy", "Cream", "Cotton", "Linen"],
  preferences: [
    { label: "Size", options: ["Small", "Medium", "Large"] },
    { label: "Color", options: ["Navy", "Cream"] },
    { label: "Material", options: ["Cotton", "Linen"] },
  ],
  customFields: [],
  imageUrl: null,
  imageUrls: [],
  accent: "#2F5BFF",
};

const chromeBinary = process.env.CHROME_PATH
  || (existsSync("/repl/tools/bin/chromium") ? "/repl/tools/bin/chromium" : null)
  || (existsSync("C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe") ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" : null)
  || (existsSync("C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe") ? "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe" : "/repl/tools/bin/chromium");

async function main() {
  const artifactDir = basename(process.cwd()) === "duka"
    ? process.cwd()
    : join(process.cwd(), "artifacts", "duka");
  const vitePort = await freePort();
  const debugPort = await freePort();
  const profileDir = await mkdtemp(join(tmpdir(), "duka-multi-product-"));
  const vite = spawn(process.execPath, [join(artifactDir, "node_modules", "vite", "bin", "vite.js"), "--host", "127.0.0.1"], {
    cwd: artifactDir,
    env: { ...process.env, NODE_ENV: "test", PORT: String(vitePort), BASE_PATH: "/", VITE_CLERK_PUBLISHABLE_KEY: "" },
    stdio: "ignore",
  });
  const chromium = spawn(chromeBinary, [
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
        sellerName: "Browser Test Seller",
        businessName: "Multi Product Test Shop",
        description: "",
        channels: ["WhatsApp"]
      }));
      const nativeFetch = window.fetch.bind(window);
      window.fetch = async (input, init) => {
        const requestUrl = new URL(typeof input === "string" ? input : input.url, window.location.href);
        if (requestUrl.pathname === "/api/products") {
          return new Response(${JSON.stringify(JSON.stringify(products))}, {
            status: 200,
            headers: { "Content-Type": "application/json" }
          });
        }
        return nativeFetch(input, init);
      };
    `;
    await page.command("Page.addScriptToEvaluateOnNewDocument", { source: stubSource });
    await page.command("Page.navigate", { url: `http://127.0.0.1:${vitePort}/take-order` });
    await waitFor(page, `document.querySelector('.take-order-choice-grid') !== null`);
    await click(page, ".take-order-choice-card");
    await waitFor(page, `document.querySelector('[aria-label="Add Linen shirt to order"]') !== null`);

    await click(page, '[aria-label="Add Linen shirt to order"]');
    await click(page, '[aria-label="Add Canvas tote to order"]');
    const selectedBoth = await evaluate<{ heading: string; total: string; rows: string[] }>(page, `(() => {
      const panel = document.querySelector('.take-order-catalog-selection');
      return {
        heading: panel?.querySelector('h2')?.textContent?.trim() ?? '',
        total: panel?.querySelector('.take-order-catalog-selection-heading strong')?.textContent?.trim() ?? '',
        rows: Array.from(panel?.querySelectorAll('.take-order-catalog-selection-row span') ?? []).map((row) => row.textContent?.trim() ?? ''),
      };
    })()`);
    assert.equal(selectedBoth.heading, "2 items selected");
    assert.match(selectedBoth.total, /(?:\$|GH₵)70\.00/);
    assert.deepEqual(selectedBoth.rows, ["Linen shirt", "Canvas tote"]);

    await click(page, '[aria-label="Remove Canvas tote from order"]');
    const selectedOne = await evaluate<{ heading: string; total: string; panelText: string }>(page, `(() => {
      const panel = document.querySelector('.take-order-catalog-selection');
      return {
        heading: panel?.querySelector('h2')?.textContent?.trim() ?? '',
        total: panel?.querySelector('.take-order-catalog-selection-heading strong')?.textContent?.trim() ?? '',
        panelText: panel?.textContent ?? '',
      };
    })()`);
    assert.equal(selectedOne.heading, "1 items selected");
    assert.match(selectedOne.total, /(?:\$|GH₵)25\.00/);
    assert.match(selectedOne.panelText, /Linen shirt/);
    assert.doesNotMatch(selectedOne.panelText, /Canvas tote/);

    await click(page, '[aria-label="Add Canvas tote to order"]');
    await waitFor(page, `document.querySelector('.take-order-catalog-selection h2')?.textContent?.trim() === "2 items selected"`);
    await click(page, '[data-testid="button-continue-catalog"]');
    await waitFor(page, `document.querySelector('[data-testid="button-payment-mode-full"]') !== null`);
    await click(page, '[data-testid="button-payment-mode-full"]');
    await click(page, '[data-testid="select-order-channel-whatsapp"]');
    const confirmation = await evaluate<{ title: string; panelText: string; button: string }>(page, `(() => ({
      title: document.querySelector('.take-order-section h2')?.textContent?.trim() ?? '',
      panelText: document.querySelector('.take-order-payment-checkout-card')?.textContent ?? '',
      button: document.querySelector('[data-testid="button-create-order-link"]')?.textContent?.trim() ?? '',
    }))()`);
    assert.equal(confirmation.title, "Review the client's checkout.");
    assert.match(confirmation.panelText, /Linen shirt/);
    assert.match(confirmation.panelText, /Canvas tote/);
    assert.match(confirmation.panelText, /(?:\$|GH₵)70\.00/);
    assert.match(confirmation.button, /Confirm checkout/);

    await click(page, '[data-testid="button-create-order-link"]');
    await waitFor(page, `document.querySelector('.take-order-section h2')?.textContent?.trim() === "Review checkout."`);
    const review = await evaluate<{ bodyText: string; choiceCards: number; createButton: string }>(page, `({
      bodyText: document.querySelector('.take-order-builder-card')?.textContent ?? '',
      choiceCards: document.querySelectorAll('.take-order-choice-card').length,
      createButton: document.querySelector('[data-testid="button-create-order-link"]')?.textContent?.trim() ?? '',
    })`);
    assert.match(review.bodyText, /Linen shirt/);
    assert.match(review.bodyText, /Canvas tote/);
    assert.match(review.bodyText, /(?:\$|GH₵)70\.00/);
    assert.equal(review.choiceCards, 0);
    assert.match(review.createButton, /Create buyer link/);
  } finally {
    page?.close();
    await stopProcess(chromium);
    await stopProcess(vite);
    try {
      await delay(500);
      await rm(profileDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    } catch {
      // Chrome process cleanup on Windows
    }
  }
}

async function noCatalogMain() {
  const artifactDir = basename(process.cwd()) === "duka"
    ? process.cwd()
    : join(process.cwd(), "artifacts", "duka");
  const vitePort = await freePort();
  const debugPort = await freePort();
  const profileDir = await mkdtemp(join(tmpdir(), "duka-no-catalog-"));
  const vite = spawn(process.execPath, [join(artifactDir, "node_modules", "vite", "bin", "vite.js"), "--host", "127.0.0.1"], {
    cwd: artifactDir,
    env: { ...process.env, NODE_ENV: "test", PORT: String(vitePort), BASE_PATH: "/", VITE_CLERK_PUBLISHABLE_KEY: "" },
    stdio: "ignore",
  });
  const chromium = spawn(chromeBinary, [
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
        sellerName: "Browser Test Seller",
        businessName: "No Catalog Test Shop",
        description: "",
        channels: ["WhatsApp"]
      }));
      window.__createdProductPayload = null;
      window.__createdOrderPayload = null;
      window.__submittedPublicOrder = null;
      const nativeFetch = window.fetch.bind(window);
      window.fetch = async (input, init) => {
        const requestUrl = new URL(typeof input === "string" ? input : input.url, window.location.href);
        const method = (init?.method ?? "GET").toUpperCase();
        const body = init?.body ? JSON.parse(String(init.body)) : null;
        if (requestUrl.pathname === "/api/products" && method === "POST") {
          window.__createdProductPayload = body;
          return new Response(${JSON.stringify(JSON.stringify(fallbackCustomProduct))}, {
            status: 201,
            headers: { "Content-Type": "application/json" }
          });
        }
        if (requestUrl.pathname === "/api/orders" && method === "POST") {
          window.__createdOrderPayload = body;
          return new Response(${JSON.stringify(JSON.stringify({
            id: 91,
            token: "no-catalog-test-order",
            productId: 91,
            productName: fallbackCustomProduct.name,
            amount: fallbackCustomProduct.price,
            deliveryFee: 0,
            deliveryMethod: null,
            depositAmount: null,
            paymentMode: "full",
            status: "reserved",
            fulfillment: "pending",
            createdAt: "2026-09-18T12:00:00.000Z",
            items: [{ productId: 91, productName: fallbackCustomProduct.name, amount: fallbackCustomProduct.price, quantity: 1 }]
          }))}, {
            status: 201,
            headers: { "Content-Type": "application/json" }
          });
        }
        if (requestUrl.pathname === "/api/public/orders/no-catalog-test-order") {
          if (method === "GET") {
            const product = window.__createdProductPayload ?? ${JSON.stringify(fallbackCustomProduct)};
            return new Response(JSON.stringify({
              token: "no-catalog-test-order",
              productName: product.name,
              amount: product.price,
              subtotal: product.price,
              deliveryFee: 0,
              deliveryMethod: null,
              depositAmount: null,
              paymentMode: "full",
              status: "reserved",
              variants: product.variants,
              items: [{
                productId: 91,
                productName: product.name,
                amount: product.price,
                quantity: 1,
                variants: product.variants,
                preferences: product.preferences,
                source: "custom",
                imageUrl: null,
                imageUrls: [],
                sku: null,
                description: null,
                stock: 0,
                available: true
              }]
            }), { status: 200, headers: { "Content-Type": "application/json" } });
          }
          window.__submittedPublicOrder = body;
          return new Response(JSON.stringify({
            id: 91,
            token: "no-catalog-test-order",
            productId: 91,
            productName: "Custom jacket",
            customerName: "Browser Buyer",
            customerPhone: "0241234567",
            channel: "whatsapp",
            amount: 125,
            deliveryFee: 0,
            deliveryMethod: "pickup",
            deliveryAddress: null,
            productCost: null,
            depositAmount: null,
            paymentMode: "full",
            status: "paid",
            fulfillment: "pending",
            createdAt: "2026-09-18T12:00:00.000Z",
            items: [{ productId: 91, productName: "Custom jacket", amount: 125, quantity: 1 }]
          }), { status: 200, headers: { "Content-Type": "application/json" } });
        }
        if (requestUrl.pathname === "/api/products" || requestUrl.pathname === "/api/orders" || requestUrl.pathname === "/api/health") {
          return new Response(requestUrl.pathname === "/api/health" ? JSON.stringify({ status: "ok" }) : "[]", {
            status: 200,
            headers: { "Content-Type": "application/json" }
          });
        }
        return nativeFetch(input, init);
      };
    `;
    await page.command("Page.addScriptToEvaluateOnNewDocument", { source: stubSource });
    await page.command("Page.navigate", { url: `http://127.0.0.1:${vitePort}/take-order` });
    await waitFor(page, `document.querySelector('.take-order-choice-grid') !== null`);
    await click(page, '.take-order-choice-card:nth-child(2)');
    await fill(page, '[data-testid="input-custom-order-name"]', "Custom jacket");
    await fill(page, '[data-testid="input-custom-order-price"]', "125");

    await click(page, '.take-order-custom-preferences button');
    await click(page, '.take-order-custom-preferences button');
    await click(page, '.take-order-custom-preferences button');
    await fill(page, '[aria-label="Custom option group 1 name"]', "Size");
    await fill(page, '[aria-label="Choices for custom option group 1"]', "Small, Medium, Large");
    await fill(page, '[aria-label="Custom option group 2 name"]', "Color");
    await fill(page, '[aria-label="Choices for custom option group 2"]', "Navy, Cream");
    await fill(page, '[aria-label="Custom option group 3 name"]', "Material");
    await fill(page, '[aria-label="Choices for custom option group 3"]', "Cotton, Linen");
    await click(page, '.take-order-custom-builder > button');
    await waitFor(page, `document.querySelector('.take-order-item-copy')?.textContent?.includes("3 buyer options") === true`);
    const sellerPayload = await evaluate<{ name: string; price: number; preferences: Array<{ label: string; options: string[] }> } | null>(page, "window.__createdProductPayload");
    assert.equal(sellerPayload, null);

    await click(page, '[data-testid="button-create-order-link"]');
    await waitFor(page, `document.querySelector('[data-testid="button-payment-mode-full"]') !== null`);
    await click(page, '[data-testid="button-payment-mode-full"]');
    await click(page, '[data-testid="select-order-channel-whatsapp"]');
    await click(page, '[data-testid="button-create-order-link"]');
    await waitFor(page, `document.querySelector('.take-order-section h2')?.textContent?.trim() === "Review checkout."`);
    await click(page, '[data-testid="button-create-order-link"]');
    await waitFor(page, `document.querySelector('[data-testid="link-preview-created-order"]') !== null`);
    const savedSellerProduct = await evaluate<{ name: string; price: number; preferences: Array<{ label: string; options: string[] }> } | null>(page, "window.__createdProductPayload");
    assert.deepEqual(savedSellerProduct?.preferences, fallbackCustomProduct.preferences);
    assert.equal(savedSellerProduct?.name, "Custom jacket");
    assert.equal(savedSellerProduct?.price, 125);

    await click(page, '[data-testid="link-preview-created-order"]');
    await waitFor(page, `document.querySelector('[data-testid="input-buyer-reference-image"]') !== null`);
    const buyerGroups = await evaluate<string[]>(page, `Array.from(document.querySelectorAll('.buyer-preference-legend span')).map((element) => element.textContent?.trim() ?? '')`);
    assert.deepEqual(buyerGroups, ["Size", "Color", "Material"]);
    await click(page, 'label[aria-label="Size: Large"]');
    await click(page, 'label[aria-label="Color: Navy"]');
    await click(page, 'label[aria-label="Material: Cotton"]');
    await evaluate(page, `(() => {
      const input = document.querySelector('[data-testid="input-buyer-reference-image"]');
      if (!(input instanceof HTMLInputElement)) throw new Error("Missing buyer image input");
      const transfer = new DataTransfer();
      transfer.items.add(new File(["buyer reference"], "custom-reference.png", { type: "image/png" }));
      input.files = transfer.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    })()`);
    await waitFor(page, `document.querySelector('img[alt="Selected item reference"]') !== null`);
    const selectedBuyerOptions = await evaluate<{ checkedValues: string[]; image: boolean }>(page, `({
      checkedValues: Array.from(document.querySelectorAll('.buyer-choice-option input, .buyer-size-option input, .buyer-color-option input')).filter((input) => input.checked).map((input) => input.value),
      image: Boolean(document.querySelector('img[alt="Selected item reference"]'))
    })`);
    assert.deepEqual(selectedBuyerOptions.checkedValues, ["Large", "Navy", "Cotton"]);
    assert.equal(selectedBuyerOptions.image, true);

    await fill(page, '[data-testid="input-buyer-name"]', "Browser Buyer");
    await fill(page, '[data-testid="input-buyer-phone"]', "0241234567");
    await click(page, 'input[name="buyer-delivery-method"][value="pickup"]');
    await click(page, '[data-testid="button-continue-payment"]');
    await waitFor(page, 'document.querySelector(\'[data-testid="button-submit-public-order"]\') !== null');
    await click(page, '[data-testid="button-submit-public-order"]');
    await waitFor(page, `document.body.textContent?.includes("You’re all set.")`);
    const submitted = await evaluate<{ itemDetails: Array<{ variant?: string; referenceImage?: string }> } | null>(page, "window.__submittedPublicOrder");
    assert.equal(submitted?.itemDetails[0]?.variant, "Large · Navy · Cotton");
    assert.equal(submitted?.itemDetails[0]?.referenceImage, "custom-reference.png");
  } finally {
    page?.close();
    await stopProcess(chromium);
    await stopProcess(vite);
    try {
      await delay(500);
      await rm(profileDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    } catch {
      // Chrome process cleanup on Windows
    }
  }
}

main().then(
  async () => {
    await noCatalogMain();
    console.log("Multi-product and no-catalog checkout browser checks passed");
  },
  (error) => {
    console.error(error);
    process.exitCode = 1;
  },
);