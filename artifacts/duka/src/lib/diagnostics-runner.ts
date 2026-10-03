import { chromium } from "playwright";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

async function freePort(): Promise<number> {
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

const mockSettings = {
  businessName: "Akosua's Shop",
  currency: "GHS",
  compactTables: false,
  deliveryDefault: "both",
  deliveryFee: 15,
};

const mockSummary = {
  revenue: 1200,
  orders: 5,
  profit: 800,
  outstanding: 150,
  cashBalance: 1050,
  operatingExpenses: 50,
  expenses: 250,
  productCosts: 200,
  estimatedProductCosts: 0,
  snapshotOrders: 5,
  legacyOrders: 0,
  legacyRevenue: 0,
  bestSeller: "Linen dress",
  shares: 10,
  likes: 25,
  channelPerformance: [],
  insights: [],
  dailyPerformance: [],
  productPerformance: [],
};

const mockOrder = {
  id: 1,
  token: "order-token-1",
  customerName: "Kofi Mensah",
  customerPhone: "+233241234567",
  deliveryMethod: "delivery",
  deliveryAddress: "Accra Central",
  amount: 250,
  subtotal: 235,
  deliveryFee: 15,
  depositAmount: null,
  paymentMode: "full",
  status: "paid",
  fulfillment: "pending",
  channel: "whatsapp",
  createdAt: "2026-09-20T10:00:00.000Z",
  items: [
    { productId: 1, productName: "Linen dress", amount: 235, quantity: 1 }
  ],
};

async function runDiagnostics() {
  const artifactDir = process.cwd().endsWith("duka") ? process.cwd() : join(process.cwd(), "artifacts", "duka");
  const vitePort = await freePort();

  console.log(`Starting Vite preview on port ${vitePort}...`);
  const vite = spawn(process.execPath, [
    join(artifactDir, "node_modules", "vite", "bin", "vite.js"),
    "preview",
    "--port",
    String(vitePort),
    "--host",
    "127.0.0.1"
  ], {
    cwd: artifactDir,
    env: { ...process.env, NODE_ENV: "production" },
    stdio: "ignore"
  });

  const baseUrl = `http://127.0.0.1:${vitePort}`;
  await waitForUrl(baseUrl);
  console.log(`Vite preview is ready at ${baseUrl}`);

  const browser = await chromium.launch({
    channel: "chrome",
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"]
  }).catch(() => chromium.launch({
    channel: "msedge",
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"]
  }));

  const routesToTest = [
    "/dashboard",
    "/orders",
    "/catalog",
    "/analytics",
    "/settings",
    "/orders/1",
  ];

  const results: Record<string, any> = {};

  try {
    for (const testRoute of routesToTest) {
      console.log(`\n======================================================`);
      console.log(`DIAGNOSING RELOAD FOR: ${testRoute}`);
      console.log(`======================================================`);

      const context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
      });

      const page = await context.newPage();

      // Configure mock API endpoints to avoid unmocked network errors during diagnostic
      await page.route("**/api/**", async (route) => {
        const url = route.request().url();
        if (url.includes("/api/settings")) {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(mockSettings),
          });
        } else if (url.includes("/api/dashboard/summary")) {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(mockSummary),
          });
        } else if (url.includes("/api/orders/1")) {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(mockOrder),
          });
        } else if (url.includes("/api/orders")) {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify([mockOrder]),
          });
        } else if (url.includes("/api/products")) {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify([]),
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({}),
          });
        }
      });

      // Inject authenticated seller session before any scripts run
      await page.addInitScript(() => {
        localStorage.setItem("duka-test-auth", "true");
        localStorage.setItem("duka-test-user-id", "test-seller-diagnostic");
        localStorage.setItem("duka-mock-authenticated", "true");
        localStorage.setItem("duka-onboarding-complete", "true");
        localStorage.setItem("duka-seller-profile", JSON.stringify({
          sellerName: "Akosua",
          businessName: "Akosua's Shop",
          channels: ["WhatsApp"]
        }));
        (window as any).__DUKA_TEST_AUTH__ = true;
      });

      // Enable CDP Session for CPU Throttling (6x) and Network Emulation (Slow 4G)
      const cdp = await context.newCDPSession(page);
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 6 });
      await cdp.send("Network.emulateNetworkConditions", {
        offline: false,
        latency: 150, // 150ms RTT
        downloadThroughput: ((1.6 * 1024 * 1024) / 8), // Slow 4G ~1.6 Mbps
        uploadThroughput: ((750 * 1024) / 8), // ~750 Kbps
      });

      const urlChanges: Array<{ time: number; url: string; trigger: string }> = [];
      const startTime = Date.now();

      page.on("framenavigated", (frame) => {
        if (frame === page.mainFrame()) {
          urlChanges.push({
            time: Date.now() - startTime,
            url: frame.url(),
            trigger: "framenavigated",
          });
        }
      });

      page.on("console", (msg) => {
        const text = msg.text();
        if (text.includes("[INSTRUMENT") || text.includes("error") || text.includes("Error")) {
          console.log(`[BROWSER CONSOLE] ${text}`);
        }
      });
      page.on("pageerror", (err) => console.log(`[BROWSER ERROR]`, err.message));
      page.on("requestfailed", (req) => console.log(`[REQ FAILED] ${req.url()}: ${req.failure()?.errorText}`));

      // Navigate to the target route (simulating direct load / refresh)
      console.log(`[Diagnostic] Navigating to ${baseUrl}${testRoute}...`);
      await page.goto(`${baseUrl}${testRoute}`);

      // Wait for React to mount and resolve startup
      await page.waitForTimeout(5000);

      // Collect instrumented logs
      const reloadEvents = await page.evaluate(() => {
        return (window as any).__RELOAD_EVENTS__ || [];
      });

      // Filter and summarize
      const domRouteMounts = reloadEvents.filter((e: any) => e.type.startsWith("dom.route"));
      const guardDecisions = reloadEvents.filter((e: any) => e.type === "guard_decision");
      const fetches = reloadEvents.filter((e: any) => e.type === "fetch");
      const pushStates = reloadEvents.filter((e: any) => e.type.includes("State"));

      console.log(`\nResults for ${testRoute}:`);
      console.log(`- DOM Routes Mounted sequence:`, domRouteMounts.map((e: any) => `${e.time}ms: ${e.details.route}`));
      console.log(`- Guard Decisions:`, guardDecisions.map((e: any) => `${e.time}ms: ${e.details.guard} (ready=${e.details.ready}, settingsLoading=${e.details.settingsLoading})`));
      console.log(`- History push/replace states:`, pushStates);

      results[testRoute] = {
        domRouteSequence: domRouteMounts,
        guardDecisions,
        fetches,
        pushStates,
      };

      await context.close();
    }
  } finally {
    await browser.close();
    vite.kill();
  }

  console.log("\n=================== DIAGNOSTIC SUMMARY ===================");
  console.log(JSON.stringify(results, null, 2));
}

runDiagnostics().catch((err) => {
  console.error("Diagnostic error:", err);
  process.exit(1);
});
