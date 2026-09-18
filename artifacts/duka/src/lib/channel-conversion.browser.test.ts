import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

type CdpMessage = {
  id: number;
  result?: Record<string, any>;
  error?: { message: string };
};

type CdpClient = {
  command: (method: string, params?: Record<string, unknown>) => Promise<CdpMessage>;
  close: () => void;
};

const publicOrder = (status: "reserved" | "paid") => ({
  token: "channel-test-order",
  productName: "Linen set",
  amount: 100,
  subtotal: 100,
  deliveryFee: 0,
  deliveryMethod: null,
  depositAmount: null,
  paymentMode: "full",
  status,
  variants: [],
  items: [{
    productId: 1,
    productName: "Linen set",
    amount: 100,
    variants: [],
    preferences: [],
    source: "catalog",
  }],
});

const submittedOrder = {
  id: 1,
  token: "channel-test-order",
  productId: 1,
  productName: "Linen set",
  customerName: "Browser Buyer",
  customerPhone: "0241234567",
  channel: "whatsapp",
  amount: 100,
  deliveryFee: 0,
  deliveryMethod: "pickup",
  deliveryAddress: null,
  productCost: 20,
  depositAmount: null,
  paymentMode: "full",
  status: "paid",
  fulfillment: "pending",
  createdAt: "2026-09-18T12:00:00.000Z",
  linkOpens: 1,
  shares: null,
  likes: null,
  engagementSource: null,
  items: [{
    productId: 1,
    productName: "Linen set",
    amount: 100,
  }],
};

async function freePort() {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as { port: number }).port;
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function waitForUrl(url: string, timeoutMs = 20_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // The process is still starting.
    }
    await delay(100);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function connectCdp(webSocketUrl: string): Promise<CdpClient> {
  const socket = new WebSocket(webSocketUrl);
  await new Promise<void>((resolve, reject) => {
    socket.addEventListener("open", () => resolve());
    socket.addEventListener("error", () => reject(new Error("Could not connect to Chromium CDP")));
  });
  let nextId = 0;
  const pending = new Map<number, { resolve: (message: CdpMessage) => void; reject: (error: Error) => void }>();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data)) as CdpMessage;
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    if (message.error) request.reject(new Error(message.error.message));
    else request.resolve(message);
  });
  return {
    command: (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++nextId;
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params }));
    }),
    close: () => socket.close(),
  };
}

async function waitForPage(debugPort: number, targetId?: string, timeoutMs = 20_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const pages = await (await fetch(`http://127.0.0.1:${debugPort}/json`)).json() as Array<{
        id: string;
        type: string;
        webSocketDebuggerUrl?: string;
      }>;
      const page = pages.find((candidate) =>
        candidate.type === "page"
        && candidate.webSocketDebuggerUrl
        && (!targetId || candidate.id === targetId));
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {
      // Chromium is still starting or creating the target.
    }
    await delay(100);
  }
  throw new Error(`Timed out waiting for Chromium page${targetId ? ` ${targetId}` : ""}`);
}

async function stopProcess(processHandle: ChildProcess) {
  if (processHandle.exitCode !== null) return;
  processHandle.kill("SIGTERM");
  await Promise.race([
    new Promise<void>((resolve) => processHandle.once("exit", () => resolve())),
    delay(2_000).then(() => {
      if (processHandle.exitCode === null) processHandle.kill("SIGKILL");
    }),
  ]);
}

async function evaluate<T>(cdp: CdpClient, expression: string): Promise<T> {
  const response = await cdp.command("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  const exception = response.result?.exceptionDetails;
  if (exception) throw new Error(JSON.stringify(exception));
  return response.result?.result?.value as T;
}

async function waitFor(cdp: CdpClient, expression: string, timeoutMs = 15_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await evaluate<boolean>(cdp, expression)) return;
    await delay(50);
  }
  throw new Error(`Timed out waiting for browser condition: ${expression}`);
}

async function click(cdp: CdpClient, selector: string) {
  await evaluate(cdp, `(() => {
    const element = document.querySelector(${JSON.stringify(selector)});
    if (!element) throw new Error(${JSON.stringify(`Missing ${selector}`)});
    element.click();
    return true;
  })()`);
}

async function fill(cdp: CdpClient, selector: string, value: string) {
  await evaluate(cdp, `(() => {
    const element = document.querySelector(${JSON.stringify(selector)});
    if (!element) throw new Error(${JSON.stringify(`Missing ${selector}`)});
    const prototype = Object.getPrototypeOf(element);
    const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
    descriptor?.set?.call(element, ${JSON.stringify(value)});
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  })()`);
}

async function metricValue(cdp: CdpClient, testId: string) {
  return evaluate<string | null>(cdp, `document.querySelector(${JSON.stringify(`[data-testid="${testId}"] .metric-value-content`)})?.textContent?.trim() ?? null`);
}

async function main() {
  const artifactDir = basename(process.cwd()) === "duka"
    ? process.cwd()
    : join(process.cwd(), "artifacts", "duka");
  const vitePort = await freePort();
  const debugPort = await freePort();
  const profileDir = await mkdtemp(join(tmpdir(), "duka-channel-conversion-"));
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

  let seller: CdpClient | undefined;
  let buyer: CdpClient | undefined;
  let browser: CdpClient | undefined;
  let buyerTargetId: string | undefined;
  try {
    await waitForUrl(`http://127.0.0.1:${vitePort}/`);
    seller = await connectCdp(await waitForPage(debugPort));
    browser = await connectCdp((await (await fetch(`http://127.0.0.1:${debugPort}/json/version`)).json() as { webSocketDebuggerUrl: string }).webSocketDebuggerUrl);
    await seller.command("Page.enable");
    await seller.command("Runtime.enable");
    const stubSource = `
      localStorage.setItem("duka-onboarding-complete", "true");
      localStorage.setItem("duka-onboarding-profile", JSON.stringify({
        sellerName: "Browser Test Seller",
        businessName: "Dashboard Test Shop",
        description: "",
        channels: ["WhatsApp"]
      }));
      const channelSummary = () => {
        const paid = localStorage.getItem("duka-channel-test-state") === "paid";
        const opened = paid || localStorage.getItem("duka-channel-test-state") === "opened";
        return {
          revenue: paid ? 100 : 0,
          productCosts: paid ? 20 : 0,
          estimatedProductCosts: 0,
          operatingExpenses: 0,
          expenses: paid ? 20 : 0,
          profit: paid ? 80 : 0,
          cashBalance: paid ? 80 : 0,
          orders: paid ? 1 : 0,
          snapshotOrders: paid ? 1 : 0,
          legacyOrders: 0,
          legacyRevenue: 0,
          outstanding: 0,
          bestSeller: paid ? "Linen set" : "No sales yet",
          shares: null,
          likes: null,
          channelPerformance: [{
            channel: "WhatsApp",
            revenue: paid ? 100 : 0,
            orders: paid ? 1 : 0,
            paidOrders: paid ? 1 : 0,
            opens: opened ? 1 : 0,
            conversionRate: paid ? 100 : 0
          }],
          insights: [],
          dailyPerformance: [],
          productPerformance: []
        };
      };
      const nativeFetch = window.fetch.bind(window);
      window.fetch = async (input, init) => {
        const requestUrl = new URL(typeof input === "string" ? input : input.url, window.location.href);
        if (requestUrl.pathname === "/api/dashboard/summary") {
          return new Response(JSON.stringify(channelSummary()), {
            status: 200,
            headers: { "Content-Type": "application/json" }
          });
        }
        if (requestUrl.pathname === "/api/public/orders/channel-test-order") {
          if ((init?.method ?? "GET").toUpperCase() === "GET") {
            localStorage.setItem("duka-channel-test-state", "opened");
            return new Response(${JSON.stringify(JSON.stringify(publicOrder("reserved")))}, {
              status: 200,
              headers: { "Content-Type": "application/json" }
            });
          }
          localStorage.setItem("duka-channel-test-state", "paid");
          return new Response(${JSON.stringify(JSON.stringify(submittedOrder))}, {
            status: 200,
            headers: { "Content-Type": "application/json" }
          });
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
    await seller.command("Page.addScriptToEvaluateOnNewDocument", { source: stubSource });
    await seller.command("Page.navigate", { url: `http://127.0.0.1:${vitePort}/reports/channel-conversion` });
    await waitFor(seller, `document.querySelector('[data-testid="card-channel-insight-views"]') !== null`);
    await waitFor(seller, `document.querySelector('[data-testid="card-channel-insight-sales"]') !== null`);
    assert.equal(await metricValue(seller, "card-channel-insight-views"), "0");
    assert.equal(await metricValue(seller, "card-channel-insight-sales"), "0");
    assert.equal(await metricValue(seller, "card-channel-insight-revenue"), "$0");
    assert.equal(await metricValue(seller, "card-channel-insight-conversion"), "0.0%");

    const created = await browser.command("Target.createTarget", { url: "about:blank" });
    buyerTargetId = created.result?.targetId as string;
    buyer = await connectCdp(await waitForPage(debugPort, buyerTargetId));
    await buyer.command("Page.enable");
    await buyer.command("Runtime.enable");
    await buyer.command("Page.addScriptToEvaluateOnNewDocument", { source: stubSource });
    await buyer.command("Page.navigate", { url: `http://127.0.0.1:${vitePort}/o/channel-test-order` });
    await waitFor(buyer, `document.querySelector('[data-testid="input-buyer-item-details"]') !== null`);
    await waitFor(seller, `document.querySelector('[data-testid="card-channel-insight-views"] .metric-value-content')?.textContent?.trim() === "1"`);
    assert.equal(await metricValue(seller, "card-channel-insight-sales"), "0");

    await click(buyer, '[data-testid="button-submit-public-order"]');
    await waitFor(buyer, `document.querySelector('[data-testid="input-buyer-name"]') !== null`);
    await fill(buyer, '[data-testid="input-buyer-name"]', "Browser Buyer");
    await fill(buyer, '[data-testid="input-buyer-phone"]', "0241234567");
    await click(buyer, 'input[name="buyer-delivery-method"][value="pickup"]');
    await click(buyer, '[data-testid="button-submit-public-order"]');
    await waitFor(buyer, `document.querySelector('[data-testid="button-confirm-buyer-review"]') !== null`);
    await click(buyer, '[data-testid="button-confirm-buyer-review"]');
    await click(buyer, '[data-testid="button-buyer-pay"]');
    await click(buyer, '[data-testid="button-continue-payment-method"]');
    await fill(buyer, '[data-testid="input-mock-card-number"]', "4242 4242 4242 4242");
    await fill(buyer, '[data-testid="input-mock-expiry"]', "12/30");
    await fill(buyer, '[data-testid="input-mock-cvc"]', "123");
    await click(buyer, '[data-testid="button-submit-public-order"]');
    await waitFor(buyer, `document.body.textContent?.includes("You’re all set.")`);

    await waitFor(seller, `document.querySelector('[data-testid="card-channel-insight-sales"] .metric-value-content')?.textContent?.trim() === "1"`);
    assert.equal(await metricValue(seller, "card-channel-insight-views"), "1");
    assert.equal(await metricValue(seller, "card-channel-insight-sales"), "1");
    assert.equal(await metricValue(seller, "card-channel-insight-revenue"), "$100");
    assert.equal(await metricValue(seller, "card-channel-insight-conversion"), "100.0%");
  } finally {
    if (browser && buyerTargetId) await browser.command("Target.closeTarget", { targetId: buyerTargetId }).catch(() => undefined);
    buyer?.close();
    seller?.close();
    browser?.close();
    await stopProcess(chromium);
    await stopProcess(vite);
    await rm(profileDir, { recursive: true, force: true });
  }
}

main().then(
  () => console.log("Channel conversion browser check passed"),
  (error) => {
    console.error(error);
    process.exitCode = 1;
  },
);