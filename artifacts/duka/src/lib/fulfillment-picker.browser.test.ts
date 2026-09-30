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

const initialOrder = {
  id: 999,
  token: "tok-test-999",
  productId: 1,
  productName: "Kente Silk Robe",
  customerName: "Kofi Boateng",
  customerPhone: "0240001122",
  channel: "instagram",
  amount: 350,
  deliveryFee: 30,
  deliveryMethod: "delivery",
  deliveryAddress: "East Legon, Accra",
  productCost: 150,
  depositAmount: 100,
  paymentMode: "deposit",
  status: "deposit_paid",
  fulfillment: "pending",
  createdAt: "2026-09-27T10:00:00.000Z",
  linkOpens: 1,
  shares: 0,
  likes: 0,
  engagementSource: null,
  referenceImage: null,
  buyerDetails: null,
  items: [],
};

async function main() {
  const artifactDir = basename(process.cwd()) === "duka"
    ? process.cwd()
    : join(process.cwd(), "artifacts", "duka");
  const vitePort = await freePort();
  const debugPort = await freePort();
  const profileDir = await mkdtemp(join(tmpdir(), "duka-fulfillment-picker-"));

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

      let currentOrderState = ${JSON.stringify(initialOrder)};

      const nativeFetch = window.fetch.bind(window);
      window.fetch = async (input, init) => {
        const urlStr = typeof input === "string" ? input : input.url;
        const requestUrl = new URL(urlStr, window.location.href);

        if (requestUrl.pathname === "/api/orders") {
          return new Response(JSON.stringify([currentOrderState]), {
            status: 200,
            headers: { "Content-Type": "application/json" }
          });
        }

        if (requestUrl.pathname === "/api/orders/999") {
          if (init?.method === "PATCH" || init?.method === "PUT") {
            const body = JSON.parse(init.body || "{}");
            currentOrderState = { ...currentOrderState, ...body };
            return new Response(JSON.stringify(currentOrderState), {
              status: 200,
              headers: { "Content-Type": "application/json" }
            });
          }
          return new Response(JSON.stringify(currentOrderState), {
            status: 200,
            headers: { "Content-Type": "application/json" }
          });
        }

        if (requestUrl.pathname === "/api/products") {
          return new Response(JSON.stringify([]), {
            status: 200,
            headers: { "Content-Type": "application/json" }
          });
        }

        if (requestUrl.pathname === "/api/dashboard/summary") {
          return new Response(JSON.stringify({
            revenue: 350,
            productCosts: 150,
            estimatedProductCosts: 0,
            operatingExpenses: 0,
            expenses: 150,
            profit: 200,
            cashBalance: 100,
            orders: 1,
            snapshotOrders: 1,
            legacyOrders: 0,
            legacyRevenue: 0,
            outstanding: 250,
            bestSeller: "Kente Silk Robe",
            shares: null,
            likes: null,
            channelPerformance: [],
            insights: [],
            dailyPerformance: [],
            productPerformance: []
          }), {
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
    await page.command("Page.navigate", { url: `http://127.0.0.1:${vitePort}/orders` });

    console.log("1. Waiting for orders table and fulfillment button...");
    await waitFor(page, `Boolean(document.querySelector('[data-testid="button-fulfillment-999"]'))`);

    const initialText = await evaluate<string>(page, `document.querySelector('[data-testid="button-fulfillment-999"]').textContent || ""`);
    console.log("2. Initial button text:", initialText.trim());
    assert.ok(initialText.includes("To ship"), `Expected "To ship" in initial button text, got: ${initialText}`);

    // Verify popover card is NOT open initially
    const initiallyOpen = await evaluate<boolean>(page, `Boolean(document.querySelector('[data-testid="card-fulfillment-picker-999"]'))`);
    assert.equal(initiallyOpen, false, "Popover card should not be open initially");

    console.log("3. Hovering mouse on fulfillment button...");
    const hoverDiagnostics = await evaluate<string>(page, `(() => {
      const btn = document.querySelector('[data-testid="button-fulfillment-999"]');
      if (!btn) return "Button not found";
      btn.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, cancelable: true }));
      btn.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, cancelable: true }));
      btn.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true, cancelable: true }));
      return "Events dispatched to button";
    })()`);
    console.log("Hover diagnostics:", hoverDiagnostics);

    await delay(300);

    const popoverCheck = await evaluate<any>(page, `(() => {
      const portalElements = Array.from(document.querySelectorAll('[data-radix-popper-content-wrapper], [role="dialog"], [data-testid^="card-fulfillment"]')).map(el => ({
        tag: el.tagName,
        testId: el.getAttribute('data-testid'),
        html: el.outerHTML.slice(0, 200)
      }));
      return {
        portalCount: portalElements.length,
        elements: portalElements,
        bodyHasCard: Boolean(document.querySelector('[data-testid="card-fulfillment-picker-999"]'))
      };
    })()`);
    console.log("Popover check after hover:", JSON.stringify(popoverCheck, null, 2));

    console.log("4. Waiting for fulfillment options card to pop up...");
    await waitFor(page, `Boolean(document.querySelector('[data-testid="card-fulfillment-picker-999"]'))`);

    // Verify all 3 options exist inside the popover card
    const hasPendingOption = await evaluate<boolean>(page, `Boolean(document.querySelector('[data-testid="option-fulfillment-999-pending"]'))`);
    const hasShippedOption = await evaluate<boolean>(page, `Boolean(document.querySelector('[data-testid="option-fulfillment-999-shipped"]'))`);
    const hasDeliveredOption = await evaluate<boolean>(page, `Boolean(document.querySelector('[data-testid="option-fulfillment-999-delivered"]'))`);

    assert.ok(hasPendingOption, "Expected 'pending' option in card");
    assert.ok(hasShippedOption, "Expected 'shipped' option in card");
    assert.ok(hasDeliveredOption, "Expected 'delivered' option in card");

    const shippedOptionText = await evaluate<string>(page, `document.querySelector('[data-testid="option-fulfillment-999-shipped"]').textContent || ""`);
    const shippedOptionTitle = await evaluate<string>(page, `document.querySelector('[data-testid="option-fulfillment-999-shipped"]').getAttribute("title") || ""`);
    console.log("5. Shipped option text:", shippedOptionText.trim(), "| title:", shippedOptionTitle);
    assert.ok(shippedOptionText.includes("Shipped"), "Option text should contain 'Shipped'");
    assert.ok(shippedOptionTitle.includes("transit") || shippedOptionTitle.includes("rider"), "Option title should contain courier hint");

    console.log("6. Clicking 'Shipped' option...");
    await click(page, '[data-testid="option-fulfillment-999-shipped"]');

    // Wait a brief moment for update
    await delay(300);

    // Verify URL did not navigate to /orders/999 (row click was prevented)
    const currentUrl = await evaluate<string>(page, `window.location.pathname`);
    console.log("7. Current pathname after click:", currentUrl);
    assert.equal(currentUrl, "/orders", "Fulfillment click must not trigger row navigation to /orders/:id");

    // Verify button text updated to Shipped
    await waitFor(page, `(() => {
      const btn = document.querySelector('[data-testid="button-fulfillment-999"]');
      return btn && btn.textContent && btn.textContent.includes("Shipped");
    })()`);

    const updatedText = await evaluate<string>(page, `document.querySelector('[data-testid="button-fulfillment-999"]').textContent || ""`);
    console.log("8. Updated button text:", updatedText.trim());
    assert.ok(updatedText.includes("Shipped"), `Expected "Shipped" in updated button text, got: ${updatedText}`);

    // Verify popover card is closed
    const cardClosed = await evaluate<boolean>(page, `!document.querySelector('[data-testid="card-fulfillment-picker-999"]')`);
    console.log("9. Popover card closed:", cardClosed);
    assert.ok(cardClosed, "Popover card should close after selecting an option");

    console.log("10. Testing click toggle interaction as touch fallback...");
    await click(page, '[data-testid="button-fulfillment-999"]');
    await waitFor(page, `Boolean(document.querySelector('[data-testid="card-fulfillment-picker-999"]'))`);
    console.log("11. Click toggled popover successfully open!");

    // Click 'Delivered' option
    await click(page, '[data-testid="option-fulfillment-999-delivered"]');
    await waitFor(page, `(() => {
      const btn = document.querySelector('[data-testid="button-fulfillment-999"]');
      return btn && btn.textContent && btn.textContent.includes("Delivered");
    })()`);

    const finalUrl = await evaluate<string>(page, `window.location.pathname`);
    assert.equal(finalUrl, "/orders", "Final pathname must remain /orders");
    console.log("12. Successfully verified delivered state and zero row navigation!");

    console.log("ALL FULFILLMENT PICKER BROWSER TESTS PASSED!");
  } finally {
    if (page) page.close();
    await stopProcess(chromium);
    await stopProcess(vite);
    await rm(profileDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error("Fulfillment picker browser test failed:", err);
  process.exit(1);
});
