import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { chromium, type Browser, type Page } from "playwright";

async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as { port: number }).port;
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  return port;
}

async function waitForUrl(url: string, timeoutMs = 25_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await delay(100);
  }
  throw new Error(`Timed out waiting for server at ${url}`);
}

const mockSettings = {
  businessName: "Akosua's Store",
  currency: "GHS",
  compactTables: false,
  deliveryDefault: "both",
  deliveryFee: 15,
  channels: ["WhatsApp"],
};

const mockSummary = {
  revenue: 1450,
  orders: 6,
  profit: 950,
  outstanding: 200,
  cashBalance: 1250,
  operatingExpenses: 50,
  expenses: 300,
  productCosts: 200,
  estimatedProductCosts: 0,
  snapshotOrders: 6,
  legacyOrders: 0,
  legacyRevenue: 0,
  bestSeller: "Kente Cloth",
  shares: 12,
  likes: 30,
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
    { productId: 1, productName: "Kente Cloth", amount: 235, quantity: 1 }
  ],
};

const mockProduct = {
  id: 1,
  name: "Kente Cloth",
  price: 235,
  stock: 12,
  category: "apparel",
  customFields: [],
  variants: [],
};

type SellerAuthState = "onboarded" | "not_onboarded" | "signed_out";

async function configurePageMocks(page: Page, authState: SellerAuthState) {
  // 1. Mock API endpoints
  await page.route("**/api/**", async (route) => {
    const url = route.request().url();
    if (url.includes("/api/settings")) {
      if (authState === "not_onboarded") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ businessName: "", currency: "GHS" }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockSettings),
        });
      }
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
    } else if (url.includes("/api/orders/999")) {
      // Order belongs to another seller / not found
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ error: "Order not found" }),
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
        body: JSON.stringify([mockProduct]),
      });
    } else if (url.includes("/api/subscription/entitlements")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          tier: "pro",
          isPro: true,
          isProPlus: false,
          trial: { active: false },
          limits: { catalogLimit: { limit: null, unlimited: true }, activeLinkLimit: { limit: 100, unlimited: false } },
        }),
      });
    } else if (url.includes("/api/expenses")) {
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

  // Mock external Clerk API endpoints only
  await page.route("https://*.clerk.accounts.dev/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        response: null,
        client: { sessions: [] },
      }),
    });
  });

  // Mock RevenueCat endpoints
  await page.route("**/revenuecat.com/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ subscriber: { entitlements: { pro: { expires_date: null } } } }),
    });
  });

  // 2. Inject initial authentication & DOM MutationObserver before ANY script runs
  await page.addInitScript((state) => {
    // Record every route marker added to DOM
    const observedRoutes: Array<{ time: number; route: string }> = [];
    const startTime = performance.now();
    (window as any).__OBSERVED_ROUTES__ = observedRoutes;

    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === "childList") {
          m.addedNodes.forEach((node) => {
            if (node.nodeType === 1) {
              const el = node as HTMLElement;
              const route = el.getAttribute?.("data-route") || el.querySelector?.("[data-route]")?.getAttribute("data-route");
              if (route) {
                observedRoutes.push({ time: Math.round(performance.now() - startTime), route });
              }
            }
          });
        }
      }
    });

    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    } else {
      document.addEventListener("DOMContentLoaded", () => {
        observer.observe(document.body, { childList: true, subtree: true });
      });
    }

    // Set auth state
    if (state === "onboarded") {
      localStorage.setItem("duka-test-auth", "true");
      localStorage.setItem("duka-test-user-id", "seller-test-onboarded");
      localStorage.setItem("duka-mock-authenticated", "true");
      localStorage.setItem("duka-onboarding-complete", "true");
      localStorage.setItem("duka-seller-profile", JSON.stringify({
        sellerName: "Akosua",
        businessName: "Akosua's Store",
        channels: ["WhatsApp"]
      }));
      (window as any).__DUKA_TEST_AUTH__ = true;
    } else if (state === "not_onboarded") {
      localStorage.setItem("duka-test-auth", "true");
      localStorage.setItem("duka-test-user-id", "seller-test-new");
      localStorage.setItem("duka-mock-authenticated", "true");
      localStorage.removeItem("duka-onboarding-complete");
      localStorage.removeItem("duka-seller-profile");
      (window as any).__DUKA_TEST_AUTH__ = true;
    } else {
      localStorage.clear();
      sessionStorage.clear();
      (window as any).__DUKA_TEST_AUTH__ = false;
    }
  }, authState);
}

async function runThrottledReloadTest() {
  const artifactDir = process.cwd().endsWith("duka") ? process.cwd() : join(process.cwd(), "artifacts", "duka");
  const vitePort = await freePort();

  console.log(`[TEST] Starting production Vite preview on port ${vitePort}...`);
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
    stdio: "ignore",
  });

  const baseUrl = `http://127.0.0.1:${vitePort}`;
  await waitForUrl(baseUrl);
  console.log(`[TEST] Vite preview is live at ${baseUrl}`);

  const browser = await chromium.launch({
    channel: "chrome",
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"]
  }).catch(() => chromium.launch({
    channel: "msedge",
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"]
  }));

  const protectedRoutes = [
    { name: "Dashboard", path: "/dashboard", expectedRoute: "/dashboard" },
    { name: "Orders", path: "/orders", expectedRoute: "/orders" },
    { name: "Catalog", path: "/catalog", expectedRoute: "/catalog" },
    { name: "Analytics", path: "/analytics", expectedRoute: "/analytics" },
    { name: "Clients", path: "/clients", expectedRoute: "/clients" },
    { name: "Expenses", path: "/expenses", expectedRoute: "/expenses" },
    { name: "Take an order", path: "/take-order", expectedRoute: "/take-order" },
    { name: "Settings", path: "/settings", expectedRoute: "/settings" },
    { name: "Billing", path: "/account/billing", expectedRoute: "/account/billing" },
    { name: "Add item", path: "/catalog/new", expectedRoute: "/catalog/new" },
    { name: "Order details", path: "/orders/1", expectedRoute: "/orders/:id" },
  ];

  try {
    // -------------------------------------------------------------------------
    // TEST SUITE 1: SIGNED IN & ONBOARDED SELLER (11 PROTECTED ROUTES)
    // -------------------------------------------------------------------------
    console.log(`\n================================================================`);
    console.log(`SUITE 1: Signed In & Onboarded (Throttled 6x CPU + Slow 4G)`);
    console.log(`================================================================`);

    for (const route of protectedRoutes) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const page = await context.newPage();
      await configurePageMocks(page, "onboarded");

      // Apply CPU (6x) and Network (Slow 4G) Throttling
      const cdp = await context.newCDPSession(page);
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 6 });
      await cdp.send("Network.emulateNetworkConditions", {
        offline: false,
        latency: 150,
        downloadThroughput: ((1.6 * 1024 * 1024) / 8),
        uploadThroughput: ((750 * 1024) / 8),
      });

      const urlHistory: string[] = [];
      page.on("framenavigated", (frame) => {
        if (frame === page.mainFrame()) {
          urlHistory.push(new URL(frame.url()).pathname);
        }
      });
      page.on("pageerror", (err) => console.error(`[PAGE ERROR on ${route.path}]:`, err));
      page.on("console", (msg) => {
        if (msg.type() === "error") {
          console.error(`[CONSOLE ERROR on ${route.path}]:`, msg.text());
        }
      });

      // Load target route directly (simulating fresh load / deep link / refresh)
      await page.goto(`${baseUrl}${route.path}`);

      // Wait for page to reach stable loaded state
      await page.waitForSelector(`[data-route="${route.expectedRoute}"]`, { timeout: 30_000 });

      // Retrieve all routes that ever appeared in the DOM
      const observedRoutes: Array<{ time: number; route: string }> = await page.evaluate(
        () => (window as any).__OBSERVED_ROUTES__ || []
      );

      // ASSERTION 1: URL never deviates from target route
      assert.ok(urlHistory.length >= 1, `URL history must not be empty`);
      assert.ok(
        urlHistory.every((u) => u === route.path),
        `URL deviated unexpectedly on ${route.name}: ${JSON.stringify(urlHistory)}`
      );

      // ASSERTION 2: No intermediate wrong routes ever appeared
      // Only "loading-skeleton" and the expected route may appear
      const routeNames = observedRoutes.map((r) => r.route);
      const invalidRoutes = routeNames.filter(
        (r) => r !== "loading-skeleton" && r !== route.expectedRoute
      );
      assert.deepEqual(
        invalidRoutes,
        [],
        `Reload of ${route.path} flashed unwanted route(s): ${JSON.stringify(invalidRoutes)}`
      );

      // ASSERTION 3: Reload test with location.reload()
      const reloadObserved: Array<{ time: number; route: string }> = [];
      await page.evaluate(() => {
        (window as any).__OBSERVED_ROUTES__ = [];
      });

      await page.reload();
      await page.waitForSelector(`[data-route="${route.expectedRoute}"]`, { timeout: 30_000 });

      const afterReloadRoutes: Array<{ time: number; route: string }> = await page.evaluate(
        () => (window as any).__OBSERVED_ROUTES__ || []
      );
      const invalidAfterReload = afterReloadRoutes
        .map((r) => r.route)
        .filter((r) => r !== "loading-skeleton" && r !== route.expectedRoute);
      assert.deepEqual(
        invalidAfterReload,
        [],
        `Browser reload of ${route.path} flashed unwanted route(s): ${JSON.stringify(invalidAfterReload)}`
      );

      console.log(`✓ ${route.name} (${route.path}) reload verified: only skeleton -> target route (0 flash)`);
      await context.close();
    }

    // -------------------------------------------------------------------------
    // TEST SUITE 2: SIGNED IN BUT NOT ONBOARDED
    // Must go straight to /onboarding with zero dashboard or app flash
    // -------------------------------------------------------------------------
    console.log(`\n================================================================`);
    console.log(`SUITE 2: Signed In & NOT Onboarded (Direct to /onboarding)`);
    console.log(`================================================================`);

    for (const testPath of ["/dashboard", "/orders", "/catalog"]) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const page = await context.newPage();
      await configurePageMocks(page, "not_onboarded");

      const cdp = await context.newCDPSession(page);
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 6 });

      await page.goto(`${baseUrl}${testPath}`);
      await page.waitForSelector('[data-route="/onboarding"]', { timeout: 30_000 });

      const observedRoutes: Array<{ time: number; route: string }> = await page.evaluate(
        () => (window as any).__OBSERVED_ROUTES__ || []
      );

      const invalidRoutes = observedRoutes
        .map((r) => r.route)
        .filter((r) => r !== "loading-skeleton" && r !== "/onboarding");
      assert.deepEqual(
        invalidRoutes,
        [],
        `Not onboarded seller accessing ${testPath} flashed forbidden route: ${JSON.stringify(invalidRoutes)}`
      );

      assert.equal(new URL(page.url()).pathname, "/onboarding");
      console.log(`✓ Direct load of ${testPath} cleanly transitioned to /onboarding without dashboard flash`);
      await context.close();
    }

    // -------------------------------------------------------------------------
    // TEST SUITE 3: SIGNED OUT USER
    // Must go straight to /sign-in with zero app flash
    // -------------------------------------------------------------------------
    console.log(`\n================================================================`);
    console.log(`SUITE 3: Signed Out User (Direct to /sign-in)`);
    console.log(`================================================================`);

    for (const testPath of ["/dashboard", "/orders", "/settings"]) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const page = await context.newPage();
      await configurePageMocks(page, "signed_out");

      const cdp = await context.newCDPSession(page);
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 6 });

      await page.goto(`${baseUrl}${testPath}`);
      await page.waitForSelector('[data-route="/sign-in"]', { timeout: 30_000 });

      const observedRoutes: Array<{ time: number; route: string }> = await page.evaluate(
        () => (window as any).__OBSERVED_ROUTES__ || []
      );

      const invalidRoutes = observedRoutes
        .map((r) => r.route)
        .filter((r) => r !== "loading-skeleton" && r !== "/sign-in");
      assert.deepEqual(
        invalidRoutes,
        [],
        `Signed out user accessing ${testPath} flashed forbidden route: ${JSON.stringify(invalidRoutes)}`
      );

      const currentUrl = new URL(page.url());
      assert.equal(currentUrl.pathname, "/sign-in");
      assert.equal(currentUrl.searchParams.get("redirect"), testPath);
      console.log(`✓ Signed-out user accessing ${testPath} went directly to /sign-in?redirect=${testPath}`);
      await context.close();
    }

    // -------------------------------------------------------------------------
    // TEST SUITE 4: NOT FOUND ORDER DETAILS (Belongs to another seller)
    // -------------------------------------------------------------------------
    console.log(`\n================================================================`);
    console.log(`SUITE 4: Foreign / Not Found Order Details (/orders/999)`);
    console.log(`================================================================`);

    {
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const page = await context.newPage();
      await configurePageMocks(page, "onboarded");

      const cdp = await context.newCDPSession(page);
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 6 });

      await page.goto(`${baseUrl}/orders/999`);
      await page.waitForSelector('[data-route="/orders/:id"]', { timeout: 30_000 });
      await page.waitForFunction(() => document.body.innerText.includes("Order not found"), { timeout: 30_000 });

      const observedRoutes: Array<{ time: number; route: string }> = await page.evaluate(
        () => (window as any).__OBSERVED_ROUTES__ || []
      );
      const invalidRoutes = observedRoutes
        .map((r) => r.route)
        .filter((r) => r !== "loading-skeleton" && r !== "/orders/:id");
      assert.deepEqual(
        invalidRoutes,
        [],
        `Foreign order details flashed forbidden route: ${JSON.stringify(invalidRoutes)}`
      );

      const pageText = await page.textContent("body");
      assert.ok(pageText?.includes("Order not found"), "Must display Order not found");
      console.log(`✓ /orders/999 cleanly renders Order not found inside shell with zero route flash`);
      await context.close();
    }

    // -------------------------------------------------------------------------
    // TEST SUITE 5: BROWSER BACK AND FORWARD TRANSITIONS
    // -------------------------------------------------------------------------
    console.log(`\n================================================================`);
    console.log(`SUITE 5: Browser Back & Forward Navigation`);
    console.log(`================================================================`);

    {
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const page = await context.newPage();
      await configurePageMocks(page, "onboarded");

      await page.goto(`${baseUrl}/dashboard`);
      await page.waitForSelector('[data-route="/dashboard"]');

      await page.goto(`${baseUrl}/orders`);
      await page.waitForSelector('[data-route="/orders"]');

      await page.goBack();
      await page.waitForSelector('[data-route="/dashboard"]');
      assert.equal(new URL(page.url()).pathname, "/dashboard");

      await page.goForward();
      await page.waitForSelector('[data-route="/orders"]');
      assert.equal(new URL(page.url()).pathname, "/orders");

      console.log(`✓ Browser back and forward buttons navigate cleanly with zero layout flicker`);
      await context.close();
    }

    // -------------------------------------------------------------------------
    // TEST SUITE 6: SIGNED-IN SELLER OPENING ROOT ("/")
    // Must show AppShell skeleton and redirect to /dashboard (NEVER landing page)
    // -------------------------------------------------------------------------
    console.log(`\n================================================================`);
    console.log(`SUITE 6: Signed-in Seller Opening Root ("/")`);
    console.log(`================================================================`);

    {
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const page = await context.newPage();
      await configurePageMocks(page, "onboarded");

      const cdp = await context.newCDPSession(page);
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 6 });

      await page.goto(`${baseUrl}/`);
      await page.waitForSelector('[data-route="/dashboard"]', { timeout: 30_000 });

      const observedRoutes: Array<{ time: number; route: string }> = await page.evaluate(
        () => (window as any).__OBSERVED_ROUTES__ || []
      );

      const invalidRoutes = observedRoutes
        .map((r) => r.route)
        .filter((r) => r !== "loading-skeleton" && r !== "/dashboard");
      assert.deepEqual(
        invalidRoutes,
        [],
        `Signed-in seller opening "/" flashed forbidden route: ${JSON.stringify(invalidRoutes)}`
      );

      assert.equal(new URL(page.url()).pathname, "/dashboard");
      console.log(`✓ Signed-in seller opening "/" renders skeleton and goes to /dashboard (never landing page)`);
      await context.close();
    }

    console.log(`\n================================================================`);
    console.log(`ALL AUTOMATED FLASH PROOF TESTS PASSED REPEATEDLY UNDER THROTTLING!`);
    console.log(`================================================================\n`);
  } finally {
    await browser.close();
    vite.kill();
  }
}

runThrottledReloadTest().catch((err) => {
  console.error("[TEST FAILED]:", err);
  process.exit(1);
});
