import assert from "node:assert/strict";
import { createServer } from "node:http";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const chromeBinary =
  process.env.CHROME_PATH ||
  (existsSync("C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe")
    ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
    : null) ||
  (existsSync("C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe")
    ? "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
    : null) ||
  (existsSync("/repl/tools/bin/chromium") ? "/repl/tools/bin/chromium" : null);

type CdpResponse = {
  id: number;
  result?: {
    result?: {
      value?: unknown;
    };
    data?: string;
    exceptionDetails?: { text?: string };
  };
  error?: { message: string };
};

type CdpClient = {
  command: (method: string, params?: Record<string, unknown>) => Promise<CdpResponse>;
  close: () => void;
};

const artifactDir = "C:\\Users\\Clark Adjorlolo\\.gemini\\antigravity\\brain\\d7e88bc5-c88e-40a4-83d7-a07693fafe50";

async function freePort() {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as { port: number }).port;
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  return port;
}

async function waitForUrl(url: string, timeoutMs = 20_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Dev server starting
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
    command: (method, params = {}) =>
      new Promise((resolve, reject) => {
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
      const pages = (await response.json()) as Array<{ type: string; webSocketDebuggerUrl?: string }>;
      const page = pages.find((candidate) => candidate.type === "page" && candidate.webSocketDebuggerUrl);
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {
      // Chromium starting
    }
    await delay(100);
  }
  throw new Error("Timed out waiting for Chromium CDP");
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

async function captureScreenshot(cdp: CdpClient, filename: string) {
  const response = await cdp.command("Page.captureScreenshot", { format: "png" });
  if (response.result?.data) {
    const filePath = join(artifactDir, filename);
    writeFileSync(filePath, Buffer.from(response.result.data, "base64"));
    console.log(`Saved screenshot: ${filePath}`);
  }
}

async function setViewport(cdp: CdpClient, width: number, height: number, mobile = false) {
  await cdp.command("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 2,
    mobile,
  });
}

export async function runVerification() {
  if (!chromeBinary) {
    throw new Error("Chromium/Chrome binary not found");
  }

  const dukaDir = join(process.cwd(), "artifacts", "duka");
  const vitePort = await freePort();
  const debugPort = await freePort();
  const profileDir = await mkdtemp(join(tmpdir(), "duka-indicators-test-"));

  const vite = spawn(
    process.execPath,
    [join(dukaDir, "node_modules", "vite", "bin", "vite.js"), "--host", "127.0.0.1"],
    {
      cwd: dukaDir,
      env: {
        ...process.env,
        NODE_ENV: "test",
        PORT: String(vitePort),
        BASE_PATH: "/",
        VITE_CLERK_PUBLISHABLE_KEY: "",
      },
      stdio: "ignore",
    }
  );

  const chromium = spawn(
    chromeBinary,
    [
      "--headless=new",
      "--no-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${profileDir}`,
      "about:blank",
    ],
    { stdio: "ignore" }
  );

  try {
    await waitForUrl(`http://127.0.0.1:${vitePort}/`);
    const webSocketUrl = await waitForCdpPage(debugPort);
    const cdp = await connectCdp(webSocketUrl);

    await cdp.command("Page.enable");
    await cdp.command("Runtime.enable");
    await cdp.command("DOM.enable");
    await cdp.command("CSS.enable");

    // Mock API server responses within browser window
    await cdp.command("Page.addScriptToEvaluateOnNewDocument", {
      source: `
        window.__browserLogs = [];
        window.addEventListener("error", (e) => window.__browserLogs.push("ERROR: " + (e.error?.stack || e.message)));
        window.addEventListener("unhandledrejection", (e) => window.__browserLogs.push("REJECTION: " + (e.reason?.stack || e.reason)));
        localStorage.setItem("duka-test-auth", "true");
        window.__DUKA_TEST_AUTH__ = true;
        localStorage.setItem("duka-test-user-id", "test-user");
        window.__DUKA_TEST_USER_ID__ = "test-user";
        localStorage.setItem("duka-mock-authenticated", "true");
        localStorage.setItem("duka-onboarding-complete", "true");
        localStorage.setItem("duka-checklist-dismissed:test-user", "true");
        localStorage.setItem("duka-checklist-dismissed", "true");
        localStorage.setItem("duka-seller-test-seller-id-onboarding-complete", "true");
        localStorage.setItem("duka-seller-test-user-onboarding-complete", "true");
        localStorage.setItem("duka-seller-test-seller-id-profile", JSON.stringify({
          sellerName: "Ama Mensah",
          businessName: "Kente Elegance",
          description: "Artisanal textiles",
          channels: ["whatsapp", "instagram"]
        }));
        localStorage.setItem("duka-seller-test-user-profile", JSON.stringify({
          sellerName: "Ama Mensah",
          businessName: "Kente Elegance",
          description: "Artisanal textiles",
          channels: ["whatsapp", "instagram"]
        }));
        localStorage.setItem("duka-onboarding-profile", JSON.stringify({
          sellerName: "Ama Mensah",
          businessName: "Kente Elegance",
          description: "Artisanal textiles",
          channels: ["whatsapp", "instagram"]
        }));

        window.__mockOrders = [
          {
            id: 201,
            ownerUserId: "test-user",
            token: "tok-201",
            productId: 1,
            productName: "Kente Stole Emerald",
            customerName: "Kwame Asante",
            customerPhone: "+233240000001",
            channel: "instagram",
            amount: 280,
            deliveryFee: 20,
            deliveryMethod: "delivery",
            deliveryAddress: "Cantonments, Accra",
            status: "reserved",
            fulfillment: "pending",
            createdAt: new Date().toISOString(),
            items: [{ productId: 1, productName: "Kente Stole Emerald", amount: 260, quantity: 1 }]
          },
          {
            id: 202,
            ownerUserId: "test-user",
            token: "tok-202",
            productId: 2,
            productName: "Gold Ashanti Brooch",
            customerName: "Akosua Addo",
            customerPhone: "+233240000002",
            channel: "whatsapp",
            amount: 150,
            deliveryFee: 15,
            deliveryMethod: "delivery",
            deliveryAddress: "Airport Hills, Accra",
            status: "deposit_paid",
            depositAmount: 50,
            fulfillment: "pending",
            createdAt: new Date().toISOString(),
            items: [{ productId: 2, productName: "Gold Ashanti Brooch", amount: 135, quantity: 1 }]
          },
          {
            id: 203,
            ownerUserId: "test-user",
            token: "tok-203",
            productId: 3,
            productName: "Beaded Clutch Bag",
            customerName: "Waiting for buyer",
            customerPhone: "",
            channel: "direct",
            amount: 120,
            deliveryFee: 0,
            deliveryMethod: "pickup",
            status: "reserved",
            fulfillment: "pending",
            createdAt: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
            items: [{ productId: 3, productName: "Beaded Clutch Bag", amount: 120, quantity: 1 }]
          }
        ];

        window.__mockProducts = [
          {
            id: 1,
            name: "Kente Stole Emerald",
            category: "Accessories",
            sku: "KNT-01",
            price: 260,
            cost: 130,
            stock: 2,
            customFields: []
          },
          {
            id: 2,
            name: "Gold Ashanti Brooch",
            category: "Jewelry",
            sku: "BRC-02",
            price: 135,
            cost: 70,
            stock: 3,
            customFields: []
          },
          {
            id: 3,
            name: "Ceramic Bead Necklace",
            category: "Jewelry",
            sku: "NK-03",
            price: 90,
            cost: null,
            stock: 12,
            customFields: []
          }
        ];

        const getSeen = () => {
          try {
            return JSON.parse(sessionStorage.getItem("__mockSeen") || "{}");
          } catch {
            return {};
          }
        };
        const setSeen = (seen) => {
          sessionStorage.setItem("__mockSeen", JSON.stringify(seen));
        };

        window.__attentionSeenCalls = [];
        window.__allFetchUrls = [];

        window.fetch = async (input, init) => {
          const requestUrl = new URL(typeof input === "string" ? input : input.url, window.location.href);
          if (requestUrl.pathname.startsWith("/v1/")) {
            return new Response(JSON.stringify({ ok: true, subscriber: { entitlements: {} } }), {
              status: 200,
              headers: { "Content-Type": "application/json" }
            });
          }
          if (requestUrl.pathname === "/api/subscription/entitlements") {
            return new Response(JSON.stringify({
              tier: "pro_plus",
              status: "active",
              canExportAnalytics: true,
              canAccessAllReports: true,
              maxActiveLinks: 1000,
              maxCatalogProducts: 1000,
              isPro: true,
              isProPlus: true,
              isTrial: false,
              hasGracePeriod: false,
              willRenew: true,
              billingIssue: false
            }), {
              status: 200,
              headers: { "Content-Type": "application/json" }
            });
          }
          window.__allFetchUrls.push(requestUrl.pathname);

          if (requestUrl.pathname === "/api/attention") {
            const isZero = sessionStorage.getItem("__mockAttentionZero") === "true";
            if (isZero) {
              return new Response(JSON.stringify({
                cards: {
                  orders_to_ship: { count: 0, newCount: 0, newItemIds: [] },
                  low_stock: { count: 0, newCount: 0, newItemIds: [] },
                  unpaid_orders: { count: 0, newCount: 0, newItemIds: [] },
                  missing_costs: { count: 0, newCount: 0, newItemIds: [] }
                },
                sidebarOrders: { count: 0, newCount: 0 }
              }), {
                status: 200,
                headers: { "Content-Type": "application/json" }
              });
            }
            const currentSeen = getSeen();
            const ordersToShipNew = currentSeen["orders_to_ship"] ? 0 : 2;
            const unpaidNew = currentSeen["unpaid_orders"] ? 0 : 2;
            return new Response(JSON.stringify({
              cards: {
                orders_to_ship: { count: 3, newCount: ordersToShipNew, newItemIds: ordersToShipNew > 0 ? [201, 202] : [] },
                low_stock: { count: 2, newCount: 0, newItemIds: [] },
                unpaid_orders: { count: 3, newCount: unpaidNew, newItemIds: unpaidNew > 0 ? [201, 202] : [] },
                missing_costs: { count: 1, newCount: 0, newItemIds: [] }
              },
              sidebarOrders: { count: 3, newCount: ordersToShipNew }
            }), {
              status: 200,
              headers: { "Content-Type": "application/json" }
            });
          }

          if (requestUrl.pathname === "/api/attention/seen" && init?.method === "POST") {
            const body = JSON.parse(init.body || "{}");
            const key = body.cardKey || body.category;
            const currentSeen = getSeen();
            currentSeen[key] = new Date().toISOString();
            if (key === "orders" || key === "orders_to_ship") {
              currentSeen["orders"] = currentSeen[key];
              currentSeen["orders_to_ship"] = currentSeen[key];
            }
            setSeen(currentSeen);
            const calls = JSON.parse(sessionStorage.getItem("__attentionSeenCalls") || "[]");
            calls.push(key);
            sessionStorage.setItem("__attentionSeenCalls", JSON.stringify(calls));
            window.__attentionSeenCalls = calls;
            return new Response(JSON.stringify({ success: true, cardKey: key }), {
              status: 200,
              headers: { "Content-Type": "application/json" }
            });
          }

          if (requestUrl.pathname === "/api/dashboard/summary") {
            return new Response(JSON.stringify({
              revenue: 1450,
              productCosts: 520,
              estimatedProductCosts: 0,
              operatingExpenses: 110,
              expenses: 630,
              profit: 820,
              cashBalance: 1450,
              orders: 3,
              snapshotOrders: 3,
              legacyOrders: 0,
              legacyRevenue: 0,
              outstanding: 550,
              bestSeller: "Kente Stole Emerald",
              shares: 12,
              likes: 34,
              channelPerformance: [],
              insights: [],
              dailyPerformance: [],
              productPerformance: []
            }), {
              status: 200,
              headers: { "Content-Type": "application/json" }
            });
          }

          if (requestUrl.pathname === "/api/orders") {
            const isZero = sessionStorage.getItem("__mockOrdersZero") === "true";
            const orders = isZero ? [
              {
                id: 999,
                ownerUserId: "test-user",
                token: "tok-999",
                productId: 1,
                productName: "Kente Stole Emerald",
                customerName: "Ama Mensah",
                customerPhone: "+233240000001",
                channel: "instagram",
                amount: 280,
                deliveryFee: 20,
                deliveryMethod: "delivery",
                deliveryAddress: "Cantonments, Accra",
                status: "paid",
                fulfillment: "shipped",
                createdAt: new Date(Date.now() - 72 * 3600 * 1000).toISOString(),
                items: []
              }
            ] : window.__mockOrders;
            return new Response(JSON.stringify(orders), {
              status: 200,
              headers: { "Content-Type": "application/json" }
            });
          }

          if (requestUrl.pathname === "/api/products") {
            const isZero = sessionStorage.getItem("__mockOrdersZero") === "true";
            const products = isZero ? [
              {
                id: 1,
                name: "Kente Stole Emerald",
                category: "Accessories",
                sku: "KNT-01",
                price: 260,
                cost: 130,
                stock: 25,
                customFields: []
              }
            ] : window.__mockProducts;
            return new Response(JSON.stringify(products), {
              status: 200,
              headers: { "Content-Type": "application/json" }
            });
          }

          if (requestUrl.pathname === "/api/settings" || requestUrl.pathname === "/api/seller/settings") {
            return new Response(JSON.stringify({
              sellerId: "test-user",
              businessName: "Kente Elegance",
              sellerName: "Ama Mensah",
              currency: "GHS",
              timezone: "Africa/Accra"
            }), {
              status: 200,
              headers: { "Content-Type": "application/json" }
            });
          }

          if (requestUrl.pathname === "/api/expenses") {
            return new Response("[]", {
              status: 200,
              headers: { "Content-Type": "application/json" }
            });
          }

          if (requestUrl.pathname === "/api/health") {
            return new Response(JSON.stringify({ status: "ok" }), {
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

          return window.fetchOriginal ? window.fetchOriginal(input, init) : nativeFetch(input, init);
        };
        const nativeFetch = window.fetch.bind(window);
        window.fetchOriginal = nativeFetch;
      `,
    });

    console.log("Navigating to dashboard at 1440px...");
    await setViewport(cdp, 1440, 900);
    await cdp.command("Page.navigate", { url: `http://127.0.0.1:${vitePort}/dashboard` });

    // Wait for Recent Updates cards to render
    try {
      await waitFor(cdp, `document.querySelector('[data-testid="recent-updates-cards"]') !== null`, 8000);
    } catch (e) {
      const url = await evaluate<string>(cdp, `window.location.href`);
      const text = await evaluate<string>(cdp, `document.body.innerText`);
      const html = await evaluate<string>(cdp, `document.getElementById('root')?.innerHTML ?? ""`);
      const fetchUrls = await evaluate<string[]>(cdp, `window.__allFetchUrls ?? []`);
      const browserLogs = await evaluate<string[]>(cdp, `window.__browserLogs ?? []`);
      console.log("FAILED to find recent-updates-cards. Current URL:", url);
      console.log("Fetched URLs:", fetchUrls);
      console.log("Browser errors/rejections:", browserLogs);
      console.log("Root HTML snippet:\n", html.slice(0, 1500));
      throw e;
    }
    await waitFor(cdp, `document.querySelector('[data-testid="header-pill-orders_to_ship"]') !== null`);

    console.log("Verifying State 1: Active with NEW items...");
    // 1. Header has "2 new" pill
    const pillText = await evaluate<string>(
      cdp,
      `document.querySelector('[data-testid="header-pill-orders_to_ship"]')?.textContent?.trim() ?? ""`
    );
    assert.equal(pillText, "2 new", "Expected Orders to ship pill to show '2 new'");

    // 2. Header screen-reader accessible text
    const srText = await evaluate<string>(
      cdp,
      `document.querySelector('[data-testid="card-header-orders_to_ship"] .sr-only')?.textContent?.trim() ?? ""`
    );
    assert.equal(srText, "Orders to ship, 3, 2 new", "Screen reader text should be 'Orders to ship, 3, 2 new'");

    // 3. Status dot has red background and pulse ring
    const hasPulseRing = await evaluate<boolean>(
      cdp,
      `document.querySelector('[data-testid="status-dot-orders_to_ship"] .indicator-pulse-ring') !== null`
    );
    assert.ok(hasPulseRing, "Expected pulse ring on new items status dot");

    // 4. Low stock has static neutral dot (items > 0, nothing new)
    const lowStockDotClass = await evaluate<string>(
      cdp,
      `document.querySelector('[data-testid="status-dot-low_stock"] span')?.className ?? ""`
    );
    assert.ok(lowStockDotClass.includes("bg-[hsl(var(--muted-foreground))]"), "Expected neutral dot for low stock");

    // 5. Sidebar Orders badge agrees with newCount
    const sidebarBadge = await evaluate<string>(
      cdp,
      `document.querySelector('[data-testid="sidebar-badge-orders"]')?.textContent?.trim() ?? ""`
    );
    assert.equal(sidebarBadge, "2", "Sidebar Orders badge should match card newCount (2)");

    // Capture 1440px screenshot for State 1
    await delay(300);
    await captureScreenshot(cdp, "state1_new_items_1440px.png");

    // Capture 390px mobile screenshot for State 1
    console.log("Switching to 390px mobile viewport...");
    await setViewport(cdp, 390, 844, true);
    await evaluate(cdp, `(() => {
      const el = document.querySelector('section[aria-label="Recent Updates"]');
      if (el) {
        const top = el.getBoundingClientRect().top + window.pageYOffset;
        window.scrollTo(0, Math.max(0, top - 20));
      }
    })()`);
    await delay(300);
    await captureScreenshot(cdp, "state1_new_items_390px.png");

    // Test Prefers-Reduced-Motion
    console.log("Verifying prefers-reduced-motion...");
    await cdp.command("Emulation.setEmulatedMedia", {
      media: "screen",
      features: [{ name: "prefers-reduced-motion", value: "reduce" }],
    });
    const pulseAnimation = await evaluate<string>(
      cdp,
      `window.getComputedStyle(document.querySelector('.indicator-pulse-ring')).animation`
    );
    assert.ok(
      pulseAnimation.includes("none") || pulseAnimation === "none 0s ease 0s 1 normal none running",
      `Expected animation: none when prefers-reduced-motion is active, got: ${pulseAnimation}`
    );

    // Reset reduced motion emulation
    await cdp.command("Emulation.setEmulatedMedia", { media: "screen", features: [] });

    // Switch back to 1440px for destination seen test
    await setViewport(cdp, 1440, 900);
    await evaluate(cdp, `window.scrollTo(0, 0)`);

    // Test Navigation to Orders list clears seen indicator
    console.log("Navigating to Orders list to mark seen...");
    await evaluate(cdp, `(() => {
      const link = document.querySelector('[data-testid="view-link-orders_to_ship"]');
      if (link) link.click();
    })()`);

    await waitFor(cdp, `window.location.pathname.startsWith('/orders')`);
    await waitFor(cdp, `window.__attentionSeenCalls.length > 0`);
    console.log("Mark seen called with:", await evaluate<string[]>(cdp, `window.__attentionSeenCalls`));

    // Navigate back to Dashboard to verify State 2: Neutral / seen items
    console.log("Navigating back to Dashboard...");
    await cdp.command("Page.navigate", { url: `http://127.0.0.1:${vitePort}/dashboard` });
    await waitFor(cdp, `document.querySelector('[data-testid="recent-updates-cards"]') !== null`);
    await delay(500);

    // Verify Orders to ship now has static neutral dot, no pill, badge cleared
    const pillAfterSeen = await evaluate<string | null>(
      cdp,
      `document.querySelector('[data-testid="header-pill-orders_to_ship"]') ? "exists" : null`
    );
    assert.equal(pillAfterSeen, null, "Expected 'N new' pill to disappear after viewing list");

    const badgeAfterSeen = await evaluate<string | null>(
      cdp,
      `document.querySelector('[data-testid="sidebar-badge-orders"]') ? "exists" : null`
    );
    assert.equal(badgeAfterSeen, null, "Expected sidebar badge to disappear when newCount is 0");

    // Capture State 2 screenshots
    await captureScreenshot(cdp, "state2_neutral_seen_1440px.png");
    await setViewport(cdp, 390, 844, true);
    await evaluate(cdp, `(() => {
      const el = document.querySelector('section[aria-label="Recent Updates"]');
      if (el) {
        const top = el.getBoundingClientRect().top + window.pageYOffset;
        window.scrollTo(0, Math.max(0, top - 20));
      }
    })()`);
    await delay(300);
    await captureScreenshot(cdp, "state2_neutral_seen_390px.png");

    // Test State 3: Zero count / "All caught up" green dot
    console.log("Configuring State 3: All caught up (0 items)...");
    await evaluate(cdp, `
      sessionStorage.setItem("__mockAttentionZero", "true");
      sessionStorage.setItem("__mockOrdersZero", "true");
    `);

    // Reload page to re-render with zero items
    await setViewport(cdp, 1440, 900);
    await evaluate(cdp, `window.scrollTo(0, 0)`);
    await cdp.command("Page.navigate", { url: `http://127.0.0.1:${vitePort}/dashboard` });
    await waitFor(cdp, `document.querySelector('[data-testid="recent-updates-cards"]') !== null`);
    await delay(500);

    // Verify all caught up and green dots
    const greenDotClass = await evaluate<string>(
      cdp,
      `document.querySelector('[data-testid="status-dot-orders_to_ship"] span')?.className ?? ""`
    );
    assert.ok(greenDotClass.includes("bg-emerald-500"), "Expected green dot for 0 count");

    // Capture State 3 screenshots
    await captureScreenshot(cdp, "state3_all_caught_up_1440px.png");
    await setViewport(cdp, 390, 844, true);
    await evaluate(cdp, `(() => {
      const el = document.querySelector('section[aria-label="Recent Updates"]');
      if (el) {
        const top = el.getBoundingClientRect().top + window.pageYOffset;
        window.scrollTo(0, Math.max(0, top - 20));
      }
    })()`);
    await delay(300);
    await captureScreenshot(cdp, "state3_all_caught_up_390px.png");

    console.log("All E2E verification steps and screenshots completed successfully!");
  } finally {
    await stopProcess(chromium);
    await stopProcess(vite);
    try {
      await rm(profileDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    } catch {}
  }
}

runVerification().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
