import { existsSync, writeFileSync, mkdirSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { createServer } from "node:http";

const chromeBinary = process.env.CHROME_PATH
  || (existsSync("C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe") ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" : null)
  || (existsSync("C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe") ? "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe" : "google-chrome");

type CdpResponse = {
  id: number;
  result?: any;
  error?: { message: string };
};

type CdpClient = {
  command: (method: string, params?: Record<string, unknown>) => Promise<CdpResponse>;
  close: () => void;
};

const mockProducts = [
  {
    id: 1,
    name: "Classic Linen Oversized Shirt With Horn Buttons",
    category: "Shirts",
    sku: "SHIRT-LIN-01",
    price: 180,
    cost: 85,
    stock: 14,
    variants: ["White", "Navy", "Sage"],
    preferences: [],
    customFields: [],
    imageUrl: null,
  },
  {
    id: 2,
    name: "Heavyweight Boxy Cotton Tee",
    category: "Shirts",
    sku: "TEE-BOX-02",
    price: 95,
    cost: 40,
    stock: 3,
    variants: ["Black", "Washed Olive"],
    preferences: [],
    customFields: [],
    imageUrl: null,
  },
  {
    id: 3,
    name: "Pleated Wide-Leg Trousers in Wool Blend",
    category: "Pants",
    sku: "TRSR-WLD-03",
    price: 240,
    cost: 110,
    stock: 0,
    variants: ["Charcoal", "Taupe"],
    preferences: [],
    customFields: [],
    imageUrl: null,
  },
  {
    id: 4,
    name: "Structured Canvas Everyday Tote Bag",
    category: "Accessories",
    sku: "BAG-CAN-04",
    price: 120,
    cost: 45,
    stock: 22,
    variants: ["Natural", "Black"],
    preferences: [],
    customFields: [],
    imageUrl: null,
  },
];

const mockOrders = [
  {
    id: 101,
    token: "ord-101",
    sellerId: "seller_1",
    channel: "whatsapp",
    productName: "Classic Linen Oversized Shirt",
    amount: 360,
    currency: "GHS",
    status: "paid",
    fulfillment: "delivered",
    deliveryMethod: "delivery",
    customerName: "Kofi Mensah",
    customerPhone: "+233241234567",
    depositAmount: 360,
    createdAt: "2026-10-01T10:30:00Z",
    updatedAt: "2026-10-01T12:00:00Z",
  },
  {
    id: 102,
    token: "ord-102",
    sellerId: "seller_1",
    channel: "instagram",
    productName: "Heavyweight Boxy Cotton Tee",
    amount: 190,
    currency: "GHS",
    status: "deposit_paid",
    fulfillment: "pending",
    deliveryMethod: "pickup",
    customerName: "Ama Serwaa",
    customerPhone: "+233209876543",
    depositAmount: 100,
    createdAt: "2026-10-01T14:15:00Z",
    updatedAt: "2026-10-01T14:15:00Z",
  },
  {
    id: 103,
    token: "ord-103",
    sellerId: "seller_1",
    channel: "tiktok",
    productName: "Structured Canvas Everyday Tote Bag",
    amount: 120,
    currency: "GHS",
    status: "reserved",
    fulfillment: "pending",
    deliveryMethod: "delivery",
    customerName: "Waiting for buyer",
    customerPhone: null,
    depositAmount: 0,
    createdAt: "2026-10-02T08:00:00Z",
    updatedAt: "2026-10-02T08:00:00Z",
  },
  {
    id: 104,
    token: "ord-104",
    sellerId: "seller_1",
    channel: "facebook",
    productName: "Pleated Wide-Leg Trousers",
    amount: 480,
    currency: "GHS",
    status: "paid",
    fulfillment: "shipped",
    deliveryMethod: "delivery",
    customerName: "Yaw Boateng",
    customerPhone: "+233541122334",
    depositAmount: 480,
    createdAt: "2026-09-30T16:45:00Z",
    updatedAt: "2026-10-01T09:00:00Z",
  },
];

const mockDashboardSummary = {
  revenue: 1150,
  productCosts: 420,
  estimatedProductCosts: 0,
  operatingExpenses: 90,
  expenses: 510,
  profit: 640,
  cashBalance: 1150,
  orders: 4,
  snapshotOrders: 4,
  legacyOrders: 0,
  legacyRevenue: 0,
  outstanding: 210,
  bestSeller: "Classic Linen Oversized Shirt",
  shares: 12,
  likes: 28,
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
    } catch {}
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
    } catch {}
    await delay(100);
  }
  throw new Error("Timed out waiting for Chromium CDP");
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
  throw new Error(`Timed out waiting for condition: ${expression}`);
}

async function setViewport(cdp: CdpClient, width: number, height: number, mobile = false) {
  await cdp.command("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: mobile ? 2 : 1,
    mobile,
  });
}

async function capture(cdp: CdpClient, filename: string) {
  const res = await cdp.command("Page.captureScreenshot", { format: "png" });
  const buffer = Buffer.from(res.result.data, "base64");
  const outputDir = join(process.cwd(), "screenshots");
  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });
  const fullPath = join(outputDir, filename);
  writeFileSync(fullPath, buffer);
  console.log(`Saved screenshot: ${fullPath}`);
}

async function run() {
  const artifactDir = basename(process.cwd()) === "duka"
    ? process.cwd()
    : join(process.cwd(), "artifacts", "duka");
  const vitePort = await freePort();
  const debugPort = await freePort();
  const profileDir = await mkdtemp(join(tmpdir(), "duka-ss-"));

  const vite = spawn(process.execPath, [join(artifactDir, "node_modules", "vite", "bin", "vite.js"), "preview", "--port", String(vitePort), "--host", "127.0.0.1"], {
    cwd: artifactDir,
    env: { ...process.env, NODE_ENV: "production", PORT: String(vitePort), BASE_PATH: "/", VITE_CLERK_PUBLISHABLE_KEY: "" },
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

  try {
    await waitForUrl(`http://127.0.0.1:${vitePort}/`);
    const wsUrl = await waitForCdpPage(debugPort);
    const cdp = await connectCdp(wsUrl);

    await cdp.command("Page.enable");
    await cdp.command("Runtime.enable");

    await cdp.command("Page.addScriptToEvaluateOnNewDocument", {
      source: `
        window.__MOCK_SUMMARY__ = ${JSON.stringify(mockDashboardSummary)};
        window.__MOCK_PRODUCTS__ = ${JSON.stringify(mockProducts)};
        window.__MOCK_ORDERS__ = ${JSON.stringify(mockOrders)};
        localStorage.setItem("duka-test-auth", "true");
        window.__DUKA_TEST_AUTH__ = true;
        localStorage.setItem("duka-mock-authenticated", "true");
        localStorage.setItem("duka-onboarding-complete", "true");
        localStorage.setItem("duka-seller-test-seller-id-onboarding-complete", "true");
        localStorage.setItem("duka-seller-test-seller-id-profile", JSON.stringify({
          sellerName: "Akosua Mensah",
          businessName: "Loom & Craft",
          description: "Curated Ghanaian artisan apparel and goods",
          channels: ["whatsapp", "instagram"]
        }));
        window.addEventListener("error", (e) => console.error("BROWSER_ERROR:", e.error || e.message));
        window.addEventListener("unhandledrejection", (e) => console.error("BROWSER_REJECTION:", e.reason));
        const nativeFetch = window.fetch.bind(window);
        window.fetch = async (input, init) => {
          const url = new URL(typeof input === "string" ? input : input.url, window.location.href);
          if (url.pathname === "/api/dashboard/summary") {
            return new Response(JSON.stringify(window.__MOCK_SUMMARY__), {
              status: 200,
              headers: { "Content-Type": "application/json" }
            });
          }
          if (url.pathname === "/api/products") {
            return new Response(JSON.stringify(window.__MOCK_PRODUCTS__), {
              status: 200,
              headers: { "Content-Type": "application/json" }
            });
          }
          if (url.pathname === "/api/orders") {
            return new Response(JSON.stringify(window.__MOCK_ORDERS__), {
              status: 200,
              headers: { "Content-Type": "application/json" }
            });
          }
          if (url.pathname === "/api/settings") {
            return new Response(JSON.stringify({ businessName: "Loom & Craft", currency: "GHS" }), {
              status: 200,
              headers: { "Content-Type": "application/json" }
            });
          }
          if (url.pathname.startsWith("/api/subscription") || url.pathname.startsWith("/api/entitlements")) {
            return new Response(JSON.stringify({ isPro: true, tier: "pro", active: true }), {
              status: 200,
              headers: { "Content-Type": "application/json" }
            });
          }
          if (url.pathname.startsWith("/api/")) {
            return new Response(JSON.stringify([]), {
              status: 200,
              headers: { "Content-Type": "application/json" }
            });
          }
          return nativeFetch(input, init);
        };
      `,
    });

    const base = `http://127.0.0.1:${vitePort}`;

    async function navigateClient(path: string) {
      await evaluate(cdp, `(() => {
        window.history.pushState(null, '', '${path}');
        window.dispatchEvent(new Event('pushState'));
        window.dispatchEvent(new PopStateEvent('popstate'));
      })()`);
      await delay(500);
      const current = await evaluate<string>(cdp, `window.location.pathname`);
      console.log(`navigateClient target: ${path}, actual: ${current}`);
    }

    async function closeSheet() {
      await evaluate(cdp, `(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
      })()`);
    }

    // 1. Dashboard Desktop & Mobile
    await setViewport(cdp, 1440, 900, false);
    await cdp.command("Page.navigate", { url: `${base}/` });
    await delay(300);
    await navigateClient("/dashboard");
    await waitFor(cdp, `document.querySelector('[data-testid="dashboard-analytics"]') !== null`);
    await delay(600);
    await capture(cdp, "dashboard-1440.png");

    // Scroll to Recent Transactions on Dashboard
    await evaluate(cdp, `window.scrollTo({ top: 500, behavior: 'instant' })`);
    await delay(300);
    await capture(cdp, "dashboard-recent-1440.png");

    await setViewport(cdp, 390, 844, true);
    await evaluate(cdp, `window.scrollTo({ top: 0, behavior: 'instant' })`);
    await delay(300);
    await capture(cdp, "dashboard-390.png");

    // 2. Orders Page Desktop & Mobile
    await setViewport(cdp, 1440, 900, false);
    await navigateClient("/orders");
    await waitFor(cdp, `document.querySelector('[data-testid="button-orders-export"]') !== null`);
    await delay(600);
    await capture(cdp, "orders-1440.png");

    // Open Summary Drawer on Desktop
    await evaluate(cdp, `document.querySelector('[data-testid="button-orders-summary"]')?.click()`);
    await delay(600);
    await capture(cdp, "orders-summary-drawer-1440.png");

    // Close drawer
    await closeSheet();
    await delay(400);

    // Orders Mobile
    await setViewport(cdp, 390, 844, true);
    await delay(400);
    await capture(cdp, "orders-390.png");

    // Open Summary Sheet on Mobile
    await evaluate(cdp, `document.querySelector('[data-testid="button-orders-summary"]')?.click()`);
    await delay(600);
    await capture(cdp, "orders-summary-sheet-390.png");
    await closeSheet();
    await delay(400);

    // 3. Clients Page Desktop & Mobile
    await setViewport(cdp, 1440, 900, false);
    await navigateClient("/clients");
    await waitFor(cdp, `document.querySelector('.clients-table-card') !== null`);
    await delay(600);
    await capture(cdp, "clients-1440.png");

    await setViewport(cdp, 390, 844, true);
    await delay(300);
    await capture(cdp, "clients-390.png");

    // 4. Catalog Grid & List Desktop & Mobile
    await setViewport(cdp, 1440, 900, false);
    await navigateClient("/catalog");
    await waitFor(cdp, `document.querySelector('.catalog-workspace') !== null`);
    await delay(600);
    await capture(cdp, "catalog-grid-1440.png");

    // Switch to List view
    await evaluate(cdp, `(() => {
      const btns = Array.from(document.querySelectorAll('[aria-label="Catalog view"] button'));
      if (btns[1]) btns[1].click();
    })()`);
    await delay(500);
    await capture(cdp, "catalog-list-1440.png");

    await setViewport(cdp, 390, 844, true);
    await delay(300);
    await capture(cdp, "catalog-list-390.png");

    // Switch back to Grid on mobile
    await evaluate(cdp, `(() => {
      const btns = Array.from(document.querySelectorAll('[aria-label="Catalog view"] button'));
      if (btns[0]) btns[0].click();
    })()`);
    await delay(400);
    await capture(cdp, "catalog-grid-390.png");

    console.log("All screenshots captured successfully!");
    cdp.close();
    process.exit(0);
  } finally {
    try { chromium.kill("SIGTERM"); } catch {}
    try { vite.kill("SIGTERM"); } catch {}
    try {
      await delay(500);
      await rm(profileDir, { recursive: true, force: true });
    } catch {}
  }
}

run().catch((err) => {
  console.error("Screenshot capture error:", err);
  process.exit(1);
});
