import assert from "node:assert/strict";
import { join, basename } from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { spawn, type ChildProcess } from "node:child_process";
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

async function main() {
  const artifactDir = basename(process.cwd()) === "duka"
    ? process.cwd()
    : join(process.cwd(), "artifacts", "duka");
  const vitePort = await freePort();
  const debugPort = await freePort();
  const profileDir = await mkdtemp(join(tmpdir(), "duka-multi-product-"));
  const vite = spawn(process.execPath, [join(artifactDir, "node_modules", "vite", "bin", "vite.js"), "--host", "127.0.0.1"], {
    cwd: artifactDir,
    env: { ...process.env, NODE_ENV: "test", PORT: String(vitePort), BASE_PATH: "/" },
    stdio: "ignore",
  });
  const chromium = spawn("/repl/tools/bin/chromium", [
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
    assert.equal(selectedBoth.total, "$70.00");
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
    assert.equal(selectedOne.total, "$25.00");
    assert.match(selectedOne.panelText, /Linen shirt/);
    assert.doesNotMatch(selectedOne.panelText, /Canvas tote/);

    await click(page, '[aria-label="Add Canvas tote to order"]');
    await waitFor(page, `document.querySelector('.take-order-catalog-selection h2')?.textContent?.trim() === "2 items selected"`);
    await click(page, '[data-testid="button-continue-catalog"]');
    await waitFor(page, `document.querySelector('[data-testid="button-payment-mode-full"]') !== null`);
    const confirmation = await evaluate<{ title: string; panelText: string; button: string }>(page, `(() => ({
      title: document.querySelector('.take-order-section h2')?.textContent?.trim() ?? '',
      panelText: document.querySelector('.take-order-payment-checkout-card')?.textContent ?? '',
      button: document.querySelector('[data-testid="button-create-order-link"]')?.textContent?.trim() ?? '',
    }))()`);
    assert.equal(confirmation.title, "Review the client's checkout.");
    assert.match(confirmation.panelText, /Linen shirt/);
    assert.match(confirmation.panelText, /Canvas tote/);
    assert.match(confirmation.panelText, /\$70\.00/);
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
    assert.match(review.bodyText, /\$70\.00/);
    assert.equal(review.choiceCards, 0);
    assert.match(review.createButton, /Create buyer link/);
  } finally {
    page?.close();
    await stopProcess(chromium);
    await stopProcess(vite);
    await rm(profileDir, { recursive: true, force: true });
  }
}

main().then(
  () => console.log("Multi-product checkout browser check passed"),
  (error) => {
    console.error(error);
    process.exitCode = 1;
  },
);