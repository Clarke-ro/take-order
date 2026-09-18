import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

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

async function launchViteAndChromium() {
  const artifactDir = basename(process.cwd()) === "duka"
    ? process.cwd()
    : join(process.cwd(), "artifacts", "duka");
  const vitePort = await freePort();
  const debugPort = await freePort();
  const profileDir = await mkdtemp(join(tmpdir(), "duka-dashboard-picker-"));
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
        await rm(profileDir, { recursive: true, force: true });
      },
    };
  } catch (error) {
    await stopProcess(chromium);
    await stopProcess(vite);
    await rm(profileDir, { recursive: true, force: true });
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

main().then(
  () => console.log("Dashboard calendar browser check passed"),
  (error) => {
    console.error(error);
    process.exitCode = 1;
  },
);