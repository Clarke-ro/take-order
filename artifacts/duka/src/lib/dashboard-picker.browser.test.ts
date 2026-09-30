import assert from "node:assert/strict";
import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const chromeBinary = process.env.CHROME_PATH
  || (existsSync("/repl/tools/bin/chromium") ? "/repl/tools/bin/chromium" : null)
  || (existsSync("C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe") ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" : null)
  || (existsSync("C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe") ? "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe" : "/repl/tools/bin/chromium");

type CdpResponse = {
  id: number;
  result?: {
    result?: {
      value?: unknown;
    };
    exceptionDetails?: { text?: string };
  };
  error?: { message: string };
};

type CdpClient = {
  command: (method: string, params?: Record<string, unknown>) => Promise<CdpResponse>;
  close: () => void;
};

const dashboardSummary = {
  revenue: 420,
  productCosts: 120,
  estimatedProductCosts: 0,
  operatingExpenses: 30,
  expenses: 150,
  profit: 270,
  cashBalance: 420,
  orders: 3,
  snapshotOrders: 3,
  legacyOrders: 0,
  legacyRevenue: 0,
  outstanding: 0,
  bestSeller: "Linen shirt",
  shares: 2,
  likes: 4,
  channelPerformance: [],
  insights: [],
  dailyPerformance: [],
  productPerformance: [],
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
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // The dev server is still starting.
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
  const pending = new Map<number, { resolve: (response: CdpResponse) => void; reject: (error: Error) => void }>();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data)) as CdpResponse;
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

async function waitForCdpPage(debugPort: number, timeoutMs = 20_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(`http://127.0.0.1:${debugPort}/json`);
      const pages = await response.json() as Array<{ type: string; webSocketDebuggerUrl?: string }>;
      const page = pages.find((candidate) => candidate.type === "page" && candidate.webSocketDebuggerUrl);
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {
      // Chromium is still starting.
    }
    await delay(100);
  }
  throw new Error("Timed out waiting for Chromium CDP");
}

async function launchViteAndChromium({ production = false } = {}) {
  const artifactDir = basename(process.cwd()) === "duka"
    ? process.cwd()
    : join(process.cwd(), "artifacts", "duka");
  const vitePort = await freePort();
  const debugPort = await freePort();
  const profileDir = await mkdtemp(join(tmpdir(), `duka-dashboard-picker-${production ? "production" : "dev"}-`));
  const viteArgs = production
    ? [join(artifactDir, "node_modules", "vite", "bin", "vite.js"), "preview", "--host", "127.0.0.1"]
    : [join(artifactDir, "node_modules", "vite", "bin", "vite.js"), "--host", "127.0.0.1"];
  const vite = spawn(process.execPath, viteArgs, {
    cwd: artifactDir,
    env: { ...process.env, NODE_ENV: production ? "production" : "test", PORT: String(vitePort), BASE_PATH: "/", VITE_CLERK_PUBLISHABLE_KEY: "" },
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
  try {
    await waitForUrl(`http://127.0.0.1:${vitePort}/`);
    const webSocketUrl = await waitForCdpPage(debugPort);
    const cdp = await connectCdp(webSocketUrl);
    return {
      cdp,
      url: `http://127.0.0.1:${vitePort}/`,
      cleanup: async () => {
        cdp.close();
        await stopProcess(chromium);
        await stopProcess(vite);
        try {
          await delay(500);
          await rm(profileDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
        } catch {}
      },
    };
  } catch (error) {
    await stopProcess(chromium);
    await stopProcess(vite);
    try {
      await delay(500);
      await rm(profileDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    } catch {}
    throw error;
  }
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

async function text(cdp: CdpClient, selector: string) {
  return evaluate<string | null>(cdp, `document.querySelector(${JSON.stringify(selector)})?.textContent ?? null`);
}

async function main() {
  const app = await launchViteAndChromium();
  try {
    await app.cdp.command("Page.enable");
    await app.cdp.command("Runtime.enable");
    await app.cdp.command("Page.addScriptToEvaluateOnNewDocument", {
      source: `
        localStorage.setItem("duka-test-auth", "true");
        window.__DUKA_TEST_AUTH__ = true;
        localStorage.setItem("duka-mock-authenticated", "true");
        localStorage.setItem("duka-onboarding-complete", "true");
        localStorage.setItem("duka-onboarding-profile", JSON.stringify({
          sellerName: "Browser Test Seller",
          businessName: "Dashboard Test Shop",
          description: "",
          channels: ["WhatsApp"]
        }));
        localStorage.setItem("duka-dashboard-period", JSON.stringify({
          period: "custom",
          customFrom: "2026-09-01",
          customTo: "2026-09-05"
        }));
        window.__dashboardRequests = [];
        const nativeFetch = window.fetch.bind(window);
        window.fetch = async (input, init) => {
          const requestUrl = new URL(typeof input === "string" ? input : input.url, window.location.href);
          if (requestUrl.pathname === "/api/dashboard/summary") {
            window.__dashboardRequests.push(requestUrl.href);
            return new Response(${JSON.stringify(JSON.stringify(dashboardSummary))}, {
              status: 200,
              headers: { "Content-Type": "application/json" }
            });
          }
          if (requestUrl.pathname === "/api/products" || requestUrl.pathname === "/api/orders") {
            return new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } });
          }
          return nativeFetch(input, init);
        };
      `,
    });
    await app.cdp.command("Page.navigate", { url: app.url });
    await waitFor(app.cdp, `document.querySelector('[data-testid="button-dashboard-period"]') !== null`);
    assert.equal(await text(app.cdp, '[data-testid="button-dashboard-period"]'), "Sep 1 – Sep 5");
    await waitFor(app.cdp, `window.__dashboardRequests.some((url) => url.includes("from=2026-09-01") && url.includes("to=2026-09-05"))`);

    await click(app.cdp, '[data-testid="button-dashboard-period"]');
    await waitFor(app.cdp, `document.querySelector('[data-testid="dashboard-period-calendar"]') !== null`);
    await click(app.cdp, '[aria-label="Sep 10"]');
    await click(app.cdp, '[aria-label="Sep 15"]');
    assert.equal(await evaluate<string>(app.cdp, `document.querySelector('[data-testid="input-dashboard-period-from"]').value`), "2026-09-10");
    assert.equal(await evaluate<string>(app.cdp, `document.querySelector('[data-testid="input-dashboard-period-to"]').value`), "2026-09-15");
    assert.equal(await evaluate<boolean>(app.cdp, `document.querySelector('[data-testid="button-dashboard-period-apply"]').disabled`), false);

    await click(app.cdp, '[data-testid="button-dashboard-period-apply"]');
    await waitFor(app.cdp, `document.querySelector('[data-testid="dashboard-period-calendar"]') === null`);
    assert.equal(await text(app.cdp, '[data-testid="button-dashboard-period"]'), "Sep 10 – Sep 15");
    await waitFor(app.cdp, `window.__dashboardRequests.some((url) => url.includes("from=2026-09-10") && url.includes("to=2026-09-15"))`);

    const requestCount = await evaluate<number>(app.cdp, "window.__dashboardRequests.length");
    await click(app.cdp, '[data-testid="button-dashboard-period"]');
    await click(app.cdp, '[aria-label="Sep 20"]');
    await click(app.cdp, '[data-testid="button-dashboard-period-close"]');
    assert.equal(await text(app.cdp, '[data-testid="button-dashboard-period"]'), "Sep 10 – Sep 15");
    assert.equal(await evaluate<number>(app.cdp, "window.__dashboardRequests.length"), requestCount);
  } finally {
    await app.cleanup();
  }
}

async function blockedStorageMain() {
  const app = await launchViteAndChromium();
  try {
    await app.cdp.command("Page.enable");
    await app.cdp.command("Runtime.enable");
    await app.cdp.command("Page.addScriptToEvaluateOnNewDocument", {
      source: `
        localStorage.setItem("duka-test-auth", "true");
        window.__DUKA_TEST_AUTH__ = true;
        localStorage.setItem("duka-mock-authenticated", "true");
        localStorage.setItem("duka-onboarding-complete", "true");
        localStorage.setItem("duka-onboarding-profile", JSON.stringify({
          sellerName: "Privacy Test Seller",
          businessName: "Privacy Test Shop",
          description: "",
          channels: ["WhatsApp"]
        }));
        localStorage.setItem("duka-dashboard-period", JSON.stringify({
          period: "custom",
          customFrom: "2026-09-01",
          customTo: "2026-09-05"
        }));
        const nativeGetItem = Storage.prototype.getItem;
        const nativeSetItem = Storage.prototype.setItem;
        Storage.prototype.getItem = function(key) {
          if (key === "duka-dashboard-period") throw new DOMException("Storage access blocked", "SecurityError");
          return nativeGetItem.call(this, key);
        };
        Storage.prototype.setItem = function(key, value) {
          if (key === "duka-dashboard-period") throw new DOMException("Storage access blocked", "SecurityError");
          return nativeSetItem.call(this, key, value);
        };
        window.__dashboardRequests = [];
        const nativeFetch = window.fetch.bind(window);
        window.fetch = async (input, init) => {
          const requestUrl = new URL(typeof input === "string" ? input : input.url, window.location.href);
          if (requestUrl.pathname === "/api/dashboard/summary") {
            window.__dashboardRequests.push(requestUrl.href);
            return new Response(${JSON.stringify(JSON.stringify(dashboardSummary))}, {
              status: 200,
              headers: { "Content-Type": "application/json" }
            });
          }
          if (requestUrl.pathname === "/api/products" || requestUrl.pathname === "/api/orders") {
            return new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } });
          }
          return nativeFetch(input, init);
        };
      `,
    });
    await app.cdp.command("Page.navigate", { url: app.url });
    await waitFor(app.cdp, `document.querySelector('[data-testid="button-dashboard-period"]') !== null`);
    assert.equal(await text(app.cdp, '[data-testid="button-dashboard-period"]'), "Last 7 days");
    await waitFor(app.cdp, `window.__dashboardRequests.some((url) => url.includes("from=") && url.includes("to="))`);

    await click(app.cdp, '[data-testid="button-dashboard-period"]');
    await click(app.cdp, '[data-testid="button-dashboard-period-custom"]');
    await waitFor(app.cdp, `document.querySelector('[data-testid="dashboard-period-calendar"]') !== null`);
    await click(app.cdp, '[aria-label="Next month"]');
    await click(app.cdp, '[aria-label="Sep 10"]');
    await click(app.cdp, '[aria-label="Sep 15"]');
    await click(app.cdp, '[data-testid="button-dashboard-period-apply"]');
    await waitFor(app.cdp, `document.querySelector('[data-testid="dashboard-period-calendar"]') === null`);
    assert.equal(await text(app.cdp, '[data-testid="button-dashboard-period"]'), "Sep 10 – Sep 15");
    await waitFor(app.cdp, `window.__dashboardRequests.some((url) => url.includes("from=2026-09-10") && url.includes("to=2026-09-15"))`);
    assert.equal(await evaluate<boolean>(app.cdp, `document.querySelector('[data-testid="dashboard-analytics"]') !== null`), true);
  } finally {
    await app.cleanup();
  }
}

async function productionMain() {
  const app = await launchViteAndChromium({ production: true });
  try {
    await app.cdp.command("Page.enable");
    await app.cdp.command("Runtime.enable");
    await app.cdp.command("Page.addScriptToEvaluateOnNewDocument", {
      source: `
        localStorage.setItem("duka-test-auth", "true");
        window.__DUKA_TEST_AUTH__ = true;
        localStorage.setItem("duka-mock-authenticated", "true");
        localStorage.setItem("duka-onboarding-complete", "true");
        localStorage.setItem("duka-onboarding-profile", JSON.stringify({
          sellerName: "Production Test Seller",
          businessName: "Production Test Shop",
          description: "",
          channels: ["WhatsApp"]
        }));
        window.__dashboardRequests = [];
        const nativeFetch = window.fetch.bind(window);
        window.fetch = async (input, init) => {
          const requestUrl = new URL(typeof input === "string" ? input : input.url, window.location.href);
          if (requestUrl.pathname === "/api/dashboard/summary") {
            window.__dashboardRequests.push(requestUrl.href);
            return new Response(${JSON.stringify(JSON.stringify(dashboardSummary))}, {
              status: 200,
              headers: { "Content-Type": "application/json" }
            });
          }
          if (requestUrl.pathname === "/api/products" || requestUrl.pathname === "/api/orders") {
            return new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } });
          }
          return nativeFetch(input, init);
        };
      `,
    });

    await app.cdp.command("Page.navigate", { url: app.url });
    await waitFor(app.cdp, `document.querySelector('[data-testid="button-dashboard-period"]') !== null`);
    assert.equal(await evaluate<boolean>(app.cdp, `Boolean(document.querySelector('script[src*="/assets/"]'))`), true);

    await click(app.cdp, '[data-testid="button-dashboard-period"]');
    await evaluate(app.cdp, `(() => {
      const option = [...document.querySelectorAll("button.dashboard-period-option")].find((element) => element.textContent?.includes("Last 30 days"));
      if (!option) throw new Error("Missing Last 30 days reporting preset");
      option.click();
    })()`);
    await waitFor(app.cdp, `document.querySelector('[data-testid="button-dashboard-period"]')?.textContent?.includes("Last 30 days") === true`);
    await app.cdp.command("Page.reload", { ignoreCache: true });
    await waitFor(app.cdp, `document.querySelector('[data-testid="button-dashboard-period"]') !== null`);
    assert.equal(await text(app.cdp, '[data-testid="button-dashboard-period"]'), "Last 30 days");

    await click(app.cdp, '[data-testid="button-dashboard-period"]');
    await click(app.cdp, '[data-testid="button-dashboard-period-custom"]');
    await waitFor(app.cdp, `document.querySelector('[data-testid="dashboard-period-calendar"]') !== null`);
    await click(app.cdp, '[aria-label="Next month"]');
    await click(app.cdp, '[aria-label="Sep 10"]');
    await click(app.cdp, '[aria-label="Sep 15"]');
    await click(app.cdp, '[data-testid="button-dashboard-period-apply"]');
    await waitFor(app.cdp, `document.querySelector('[data-testid="dashboard-period-calendar"]') === null`);
    assert.equal(await text(app.cdp, '[data-testid="button-dashboard-period"]'), "Sep 10 – Sep 15");

    await app.cdp.command("Page.reload", { ignoreCache: true });
    await waitFor(app.cdp, `document.querySelector('[data-testid="button-dashboard-period"]') !== null`);
    assert.equal(await text(app.cdp, '[data-testid="button-dashboard-period"]'), "Sep 10 – Sep 15");

    await evaluate(app.cdp, `localStorage.setItem("duka-dashboard-period", JSON.stringify({
      period: "custom",
      customFrom: "2026-09-20",
      customTo: "2026-09-01"
    }))`);
    await app.cdp.command("Page.reload", { ignoreCache: true });
    await waitFor(app.cdp, `document.querySelector('[data-testid="button-dashboard-period"]') !== null`);
    assert.equal(await text(app.cdp, '[data-testid="button-dashboard-period"]'), "Last 7 days");
    await waitFor(app.cdp, `window.__dashboardRequests.length > 0`);
  } finally {
    await app.cleanup();
  }
}

const run = process.env.DASHBOARD_PRODUCTION_TEST === "1"
  ? productionMain
  : async () => {
    await main();
    await blockedStorageMain();
  };

run().then(
  async () => {
    console.log(process.env.DASHBOARD_PRODUCTION_TEST === "1"
      ? "Dashboard production bundle browser check passed"
      : "Dashboard calendar browser checks passed");
  },
  (error) => {
    console.error(error);
    process.exitCode = 1;
  },
);