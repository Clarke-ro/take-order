import { createServer } from "node:http";
import { existsSync, writeFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const chromeBinary = process.env.CHROME_PATH
  || (existsSync("C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe") ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" : null)
  || (existsSync("C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe") ? "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe" : null);

if (!chromeBinary) {
  console.error("No Chromium or Edge binary found!");
  process.exit(1);
}

const targetDir = "C:\\Users\\Clark Adjorlolo\\.gemini\\antigravity\\brain\\ee1b0b6a-eadd-4476-8f98-4f6808eead0a";

async function freePort() {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  return port;
}

async function waitForUrl(url, timeoutMs = 25000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {}
    await delay(150);
  }
  throw new Error(`Timeout waiting for ${url}`);
}

async function connectCdp(webSocketUrl) {
  const socket = new WebSocket(webSocketUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", () => resolve());
    socket.addEventListener("error", (e) => reject(e));
  });
  let nextId = 0;
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const msg = JSON.parse(String(event.data));
    const req = pending.get(msg.id);
    if (!req) return;
    pending.delete(msg.id);
    if (msg.error) req.reject(new Error(msg.error.message));
    else req.resolve(msg);
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

async function waitForCdpPage(debugPort, timeoutMs = 25000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`http://127.0.0.1:${debugPort}/json`);
      const pages = await res.json();
      const p = pages.find((candidate) => candidate.type === "page" && candidate.webSocketDebuggerUrl);
      if (p?.webSocketDebuggerUrl) return p.webSocketDebuggerUrl;
    } catch {}
    await delay(150);
  }
  throw new Error("Timeout waiting for CDP page");
}

async function main() {
  const vitePort = await freePort();
  const debugPort = await freePort();
  const profileDir = await mkdtemp(join(tmpdir(), "takeorder-analytics-shot-"));

  const dukaDir = "c:\\dev\\takeorder\\artifacts\\duka";

  console.log(`Starting Vite preview on port ${vitePort}...`);
  const vite = spawn(process.execPath, [
    join(dukaDir, "node_modules", "vite", "bin", "vite.js"),
    "preview",
    "--host",
    "127.0.0.1",
    "--port",
    String(vitePort),
  ], {
    cwd: dukaDir,
    env: { ...process.env, NODE_ENV: "production" },
    stdio: "inherit",
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
    const cdpUrl = await waitForCdpPage(debugPort);
    const cdp = await connectCdp(cdpUrl);

    await cdp.command("Page.enable");
    await cdp.command("Runtime.enable");

    // Mock auth & API data
    await cdp.command("Page.addScriptToEvaluateOnNewDocument", {
      source: `
        localStorage.setItem("duka-test-auth", "true");
        window.__DUKA_TEST_AUTH__ = true;
        localStorage.setItem("duka-mock-authenticated", "true");
        localStorage.setItem("duka-onboarding-complete", "true");
        localStorage.setItem("duka-onboarding-profile", JSON.stringify({
          sellerName: "Ama Mensah",
          businessName: "AfroChic Boutique",
          currency: "GHS",
          channels: ["WhatsApp", "Instagram"]
        }));

        const nativeFetch = window.fetch.bind(window);
        window.fetch = async (input, init) => {
          const urlStr = typeof input === "string" ? input : input.url;
          const url = new URL(urlStr, window.location.href);

          if (url.pathname === "/api/seller/settings") {
            return new Response(JSON.stringify({
              businessName: "AfroChic Boutique",
              currency: "GHS",
              timezone: "Africa/Accra"
            }), { status: 200, headers: { "Content-Type": "application/json" } });
          }

          if (url.pathname === "/api/analytics/favorites") {
            return new Response(JSON.stringify({
              favorites: ["sales-summary", "sales-by-channel", "profit-and-margin"]
            }), { status: 200, headers: { "Content-Type": "application/json" } });
          }

          if (url.pathname === "/api/dashboard/summary") {
            return new Response(JSON.stringify({
              revenue: 12450,
              productCosts: 4800,
              estimatedProductCosts: 0,
              operatingExpenses: 1120,
              expenses: 1120,
              profit: 6530,
              cashBalance: 12450,
              orders: 48,
              snapshotOrders: 48,
              legacyOrders: 0,
              legacyRevenue: 0,
              outstanding: 850,
              bestSeller: "Linen Co-ord Set",
              shares: 142,
              likes: 310,
              channelPerformance: [
                { channel: "WhatsApp", revenue: 7850, orders: 30, conversionRate: 18.2 },
                { channel: "Instagram", revenue: 4600, orders: 18, conversionRate: 12.5 }
              ],
              insights: ["WhatsApp generated 63% of your revenue this period."],
              dailyPerformance: [
                { date: "2026-09-25", revenue: 1450, orders: 6 },
                { date: "2026-09-26", revenue: 2100, orders: 8 },
                { date: "2026-09-27", revenue: 1800, orders: 7 },
                { date: "2026-09-28", revenue: 2400, orders: 9 },
                { date: "2026-09-29", revenue: 1600, orders: 6 },
                { date: "2026-09-30", revenue: 3100, orders: 12 }
              ],
              productPerformance: [
                { productId: 1, name: "Linen Co-ord Set", quantity: 24, revenue: 6240 },
                { productId: 2, name: "Silk Wrap Dress", quantity: 15, revenue: 4500 },
                { productId: 3, name: "Beaded Clutch Bag", quantity: 9, revenue: 1710 }
              ]
            }), { status: 200, headers: { "Content-Type": "application/json" } });
          }

          if (url.pathname === "/api/products") {
            return new Response(JSON.stringify([
              { id: 1, name: "Linen Co-ord Set", category: "Apparel", price: "260.00", cost: "100.00", stock: 18, archived: false },
              { id: 2, name: "Silk Wrap Dress", category: "Apparel", price: "300.00", cost: "120.00", stock: 8, archived: false },
              { id: 3, name: "Beaded Clutch Bag", category: "Accessories", price: "190.00", cost: "65.00", stock: 2, archived: false },
              { id: 4, name: "Gold Hoop Earrings", category: "Jewelry", price: "120.00", cost: "40.00", stock: 0, archived: false }
            ]), { status: 200, headers: { "Content-Type": "application/json" } });
          }

          if (url.pathname === "/api/orders") {
            return new Response(JSON.stringify([
              { id: 201, customerName: "Kofi Boateng", customerPhone: "+233244112233", amount: 520, status: "paid", fulfillment: "delivered", channel: "whatsapp", createdAt: "2026-09-28T10:00:00Z" },
              { id: 202, customerName: "Esi Darko", customerPhone: "+233201998877", amount: 300, status: "paid", fulfillment: "confirmed", channel: "instagram", createdAt: "2026-09-29T14:30:00Z" },
              { id: 203, customerName: "Ama Serwaa", customerPhone: "+233549887766", amount: 450, status: "deposit_paid", depositAmount: 200, fulfillment: "pending", channel: "whatsapp", createdAt: "2026-09-30T09:15:00Z" }
            ]), { status: 200, headers: { "Content-Type": "application/json" } });
          }

          if (url.pathname === "/api/expenses") {
            return new Response(JSON.stringify([
              { id: 1, title: "Courier Dispatch Batch", amount: "320.00", category: "shipping", expenseDate: "2026-09-28" },
              { id: 2, title: "Packaging Boxes", amount: "450.00", category: "inventory", expenseDate: "2026-09-26" },
              { id: 3, title: "Instagram Ads", amount: "350.00", category: "marketing", expenseDate: "2026-09-25" }
            ]), { status: 200, headers: { "Content-Type": "application/json" } });
          }

          if (url.pathname === "/api/analytics/comparison") {
            return new Response(JSON.stringify({
              currentRange: { from: "2026-09-01", to: "2026-09-30", label: "Sep 1 - Sep 30" },
              previousRange: { from: "2026-08-01", to: "2026-08-30", label: "Aug 1 - Aug 30 (fair MTD)", isFairMtd: true },
              hasEnoughData: true,
              metrics: [
                { id: "revenue", label: "Revenue", current: 12450, previous: 9800, changePercent: 27.0, isNew: false, format: "currency" },
                { id: "orders", label: "Orders", current: 48, previous: 38, changePercent: 26.3, isNew: false, format: "integer" },
                { id: "aov", label: "Average order value", current: 259.4, previous: 257.9, changePercent: 0.6, isNew: false, format: "currency" },
                { id: "profit", label: "Net profit", current: 6530, previous: 4920, changePercent: 32.7, isNew: false, format: "currency" },
                { id: "new_customers", label: "New customers", current: 28, previous: 20, changePercent: 40.0, isNew: false, format: "integer" },
                { id: "repeat_rate", label: "Repeat rate", current: 41.7, previous: 36.8, changePercent: 13.3, isNew: false, format: "percent" },
                { id: "expenses", label: "Expenses", current: 1120, previous: 1300, changePercent: -13.8, isNew: false, lowerIsBetter: true, format: "currency" },
                { id: "outstanding", label: "Outstanding", current: 850, previous: 1100, changePercent: -22.7, isNew: false, lowerIsBetter: true, format: "currency" }
              ],
              weeklyComparison: [
                { weekLabel: "W1", currentRevenue: 2800, previousRevenue: 2200, currentOrders: 11, previousOrders: 9 },
                { weekLabel: "W2", currentRevenue: 3100, previousRevenue: 2400, currentOrders: 12, previousOrders: 9 },
                { weekLabel: "W3", currentRevenue: 3250, previousRevenue: 2550, currentOrders: 13, previousOrders: 10 },
                { weekLabel: "W4", currentRevenue: 3300, previousRevenue: 2650, currentOrders: 12, previousOrders: 10 }
              ],
              whatsWorking: {
                topChannel: { name: "WhatsApp", revenue: 7850, changePercent: 31.2, summary: "+31.2% vs previous period" },
                topProduct: { name: "Linen Co-ord Set", revenue: 6240, changePercent: 45.0, summary: "+45.0% vs previous period" },
                bestWeekday: { day: "Saturday", orders: 18, revenue: 4680, summary: "18 orders placed on Saturdays" }
              },
              needsAttention: {
                decliningChannel: undefined,
                decliningProduct: undefined,
                lowStockBestSellers: [
                  { id: 3, name: "Beaded Clutch Bag", stock: 2, link: "/catalog/edit/3" },
                  { id: 4, name: "Gold Hoop Earrings", stock: 0, link: "/catalog/edit/4" }
                ],
                overdueOrders: [
                  { id: 203, customerName: "Ama Serwaa", balanceDue: 250, daysAgo: 12, link: "/orders/203" }
                ]
              },
              gainers: [
                { name: "Linen Co-ord Set", type: "product", changePercent: 45.0, current: 6240 },
                { name: "WhatsApp", type: "channel", changePercent: 31.2, current: 7850 }
              ],
              decliners: [],
              insights: [
                "Revenue expanded by 27.0% compared to same period last month.",
                "WhatsApp remains your highest velocity channel accounting for 63% of gross volume.",
                "Net profit increased by 32.7% driven by higher repeat buyer retention."
              ]
            }), { status: 200, headers: { "Content-Type": "application/json" } });
          }

          if (url.pathname === "/api/analytics/reports/sales-summary") {
            return new Response(JSON.stringify({
              report: {
                slug: "sales-summary",
                title: "Sales summary",
                description: "Holistic view of gross order value, cash collected, orders, and basket sizes.",
                category: "sales",
                minPlan: "free",
                blocks: ["kpis", "time-series", "breakdown-list", "summary"]
              },
              period: { from: "2026-09-01", to: "2026-09-30", compareFrom: "2026-08-01", compareTo: "2026-08-30", isFairMtd: true },
              kpis: [
                { id: "rev", label: "Gross Revenue", value: 12450, delta: 27.0, description: "Total settled cash revenue in store currency", format: "currency" },
                { id: "val", label: "Total Order Value", value: 13300, delta: 24.5, description: "Gross value of all valid orders placed", format: "currency" },
                { id: "orders", label: "Total Orders", value: 48, delta: 26.3, description: "Total count of orders placed", format: "integer" },
                { id: "aov", label: "Average Order Value", value: 259.4, delta: 0.6, description: "Average order basket value", format: "currency" }
              ],
              timeSeries: [
                { date: "2026-09-01", label: "Sep 1", current: 400, comparison: 300 },
                { date: "2026-09-07", label: "Sep 7", current: 1850, comparison: 1400 },
                { date: "2026-09-14", label: "Sep 14", current: 3100, comparison: 2600 },
                { date: "2026-09-21", label: "Sep 21", current: 3800, comparison: 2900 },
                { date: "2026-09-30", label: "Sep 30", current: 3300, comparison: 2600 }
              ],
              breakdownList: [
                { name: "Full Cash Settlement", value: 10450, count: 40, color: "#10B981", share: 84 },
                { name: "Deposit Collections", value: 2000, count: 8, color: "#3B82F6", share: 16 }
              ],
              summaryBullets: [
                "Gross revenue expanded 27% to GH₵12,450 compared to prior month.",
                "Full cash collection rate reached 84% across all placed orders.",
                "Average basket size held steady at GH₵259.40."
              ],
              calculationNote: "Gross revenue includes all orders settled in full plus collected deposits. Average order value divides placed order value by order count.",
              lastUpdated: new Date().toISOString()
            }), { status: 200, headers: { "Content-Type": "application/json" } });
          }

          if (url.pathname === "/api/analytics/reports/sales-by-channel") {
            return new Response(JSON.stringify({
              report: {
                slug: "sales-by-channel",
                title: "Sales by channel",
                description: "Compare volume, conversion, and average spend across WhatsApp, Instagram, TikTok, and direct store.",
                category: "channels",
                minPlan: "free",
                blocks: ["kpis", "split-chart", "summary", "data-table"]
              },
              period: { from: "2026-09-01", to: "2026-09-30", compareFrom: "2026-08-01", compareTo: "2026-08-30", isFairMtd: true },
              kpis: [
                { id: "top_ch", label: "Leading Channel", value: "WhatsApp", delta: 31.2, description: "Top performing sales channel by revenue", format: "text" },
                { id: "ch_share", label: "Top Channel Share", value: 63, delta: 4.2, description: "Percentage of total store revenue", format: "percent" },
                { id: "ch_orders", label: "Social Orders", value: 48, delta: 26.3, description: "Total orders initiated across social channels", format: "integer" }
              ],
              timeSeries: [
                { date: "2026-09-01", label: "Sep 1", current: 280, comparison: 210 },
                { date: "2026-09-07", label: "Sep 7", current: 1200, comparison: 950 },
                { date: "2026-09-14", label: "Sep 14", current: 1950, comparison: 1600 },
                { date: "2026-09-21", label: "Sep 21", current: 2400, comparison: 1800 },
                { date: "2026-09-30", label: "Sep 30", current: 2020, comparison: 1540 }
              ],
              breakdownList: [
                { name: "WhatsApp", value: 7850, count: 30, color: "#25D366", share: 63 },
                { name: "Instagram", value: 4600, count: 18, color: "#E1306C", share: 37 }
              ],
              summaryBullets: [
                "WhatsApp delivered GH₵7,850 (63% share), growing 31.2% over previous period.",
                "Instagram generated GH₵4,600 across 18 completed orders.",
                "Overall social conversion rate averaged 15.6% across active links."
              ],
              calculationNote: "Channel attribution is tagged at checkout creation time. Share % reflects channel revenue divided by total collected store revenue.",
              lastUpdated: new Date().toISOString()
            }), { status: 200, headers: { "Content-Type": "application/json" } });
          }

          if (url.pathname === "/api/analytics/reports/profit-and-margin") {
            // Free user requesting Pro report -> returns 403 locked preview
            return new Response(JSON.stringify({
              error: "Report locked",
              code: "PRO_FEATURE_REQUIRED",
              locked: true,
              planRequired: "pro",
              report: {
                slug: "profit-and-margin",
                title: "Profit and margin",
                description: "Waterfall analysis of gross sales, product COGS, operating overhead, and net seller margin.",
                category: "finance",
                minPlan: "pro",
                blocks: ["kpis", "waterfall", "summary"]
              },
              message: "Profit and margin is an advanced report available on Pro and Pro+ plans.",
              preview: {
                kpis: [
                  { id: "kpi_1", label: "Net Margin", value: "—", description: "Pro margin benchmark", delta: 12.5, format: "percent" },
                  { id: "kpi_2", label: "Net Profit", value: "—", description: "Pro profit analysis", delta: 8.0, format: "currency" }
                ],
                summaryBullets: [
                  "Unlock granular COGS and OpEx waterfall deductions.",
                  "Track real take-home net profit per unit sold.",
                  "Benchmark margins across your active product catalog."
                ]
              }
            }), { status: 403, headers: { "Content-Type": "application/json" } });
          }

          return nativeFetch(input, init);
        };
      `
    });

    const setViewport = async (width, height, isMobile = false) => {
      await cdp.command("Emulation.setDeviceMetricsOverride", {
        width,
        height,
        deviceScaleFactor: isMobile ? 3 : 2,
        mobile: isMobile,
      });
    };

    const capture = async (filename) => {
      await delay(1200); // Allow charts & transitions to settle
      const res = await cdp.command("Page.captureScreenshot", { format: "png", fromSurface: true });
      const buffer = Buffer.from(res.result.data, "base64");
      const outPath = join(targetDir, filename);
      writeFileSync(outPath, buffer);
      console.log(`Saved screenshot: ${filename} (${buffer.length} bytes)`);
    };

    console.log("Capturing 1: Analytics Hub Desktop 1440px...");
    await setViewport(1440, 900, false);
    await cdp.command("Page.navigate", { url: `http://127.0.0.1:${vitePort}/analytics` });
    await delay(2000);
    await capture("analytics_hub_desktop_1440px.png");

    console.log("Capturing 2: Analytics Hub Mobile 390px...");
    await setViewport(390, 844, true);
    await cdp.command("Page.navigate", { url: `http://127.0.0.1:${vitePort}/analytics` });
    await delay(2000);
    await capture("analytics_hub_mobile_390px.png");

    console.log("Capturing 3: Sales Summary Report Desktop 1440px...");
    await setViewport(1440, 900, false);
    await cdp.command("Page.navigate", { url: `http://127.0.0.1:${vitePort}/analytics/reports/sales-summary` });
    await delay(2000);
    await capture("report_sales_summary_desktop_1440px.png");

    console.log("Capturing 4: Sales Summary Report Mobile 390px...");
    await setViewport(390, 844, true);
    await cdp.command("Page.navigate", { url: `http://127.0.0.1:${vitePort}/analytics/reports/sales-summary` });
    await delay(2000);
    await capture("report_sales_summary_mobile_390px.png");

    console.log("Capturing 5: Sales by Channel Report Desktop 1440px...");
    await setViewport(1440, 900, false);
    await cdp.command("Page.navigate", { url: `http://127.0.0.1:${vitePort}/analytics/reports/sales-by-channel` });
    await delay(2000);
    await capture("report_sales_by_channel_desktop_1440px.png");

    console.log("Capturing 6: Profit & Margin Locked Report Desktop 1440px...");
    await setViewport(1440, 900, false);
    await cdp.command("Page.navigate", { url: `http://127.0.0.1:${vitePort}/analytics/reports/profit-and-margin` });
    await delay(2000);
    await capture("report_profit_and_margin_locked_desktop_1440px.png");

    console.log("All screenshots captured successfully!");

    cdp.close();
  } finally {
    vite.kill();
    chromium.kill();
    try {
      await rm(profileDir, { recursive: true, force: true, maxRetries: 5 });
    } catch {}
  }
}

main().catch((err) => {
  console.error("Error capturing screenshots:", err);
  process.exit(1);
});
