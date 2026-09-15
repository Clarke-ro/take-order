import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import test from "node:test";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getGetDashboardSummaryQueryKey } from "@workspace/api-client-react";
import {
  AnalyticsStateMarker,
  getAnalyticsViewState,
} from "./analytics-state";
import {
  CONNECTED_TOOL_NAMES,
  CONNECTED_TOOLS_KEY,
  CHANNEL_CONVERSION_REFRESH_INTERVAL_MS,
  DASHBOARD_PERIOD_KEY,
  clearConnectedTools,
  readDashboardPeriodPreference,
  readConnectedTools,
  writeDashboardPeriodPreference,
  writeConnectedTools,
} from "../App";
import {
  clearPreferences,
  connectPreferenceAriaLabel,
  connectPreferenceLabel,
  onboardingChannels,
  orderChannels,
  subscribeToPreferenceChanges,
  togglePreference,
} from "./channel-preferences";
import {
  CatalogActions,
  ChannelConversionInsight,
  getChannelConversionView,
  ChannelPicker,
  BuyerOrderForm,
  Connect,
  DashboardCustomRangePicker,
  ExpenseActions,
  ExpenseModal,
  MobileMenuButton,
  Onboarding,
  OnboardingChannelPicker,
  Overview,
  ProductModal,
  SocialChannelStack,
  Sidebar,
} from "../App";
import { Router } from "wouter";

const emptySummary = {
  orders: 0,
  channelPerformance: [],
  productPerformance: [],
} as never;

const populatedSummary = {
  orders: 1,
  channelPerformance: [],
  productPerformance: [],
} as never;

type AccessibilityNode = {
  role?: { value?: string };
  name?: { value?: string };
  properties?: Array<{ name?: string; value?: { value?: unknown } }>;
};

async function waitFor<T>(read: () => T | undefined | Promise<T | undefined>, timeoutMs = 8_000): Promise<T> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const value = await read();
    if (value !== undefined) return value;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error("Timed out waiting for Chromium");
}

async function readAccessibilityTree(markup: string): Promise<AccessibilityNode[]> {
  const profileDirectory = await mkdtemp(`${tmpdir()}/duka-a11y-`);
  const browser = spawn("chromium", [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--remote-allow-origins=*",
    "--remote-debugging-port=0",
    `--user-data-dir=${profileDirectory}`,
    "about:blank",
  ], { stdio: ["ignore", "ignore", "pipe"] });
  const browserExit = new Promise<void>((resolve) => browser.once("exit", () => resolve()));

  try {
    let debuggingUrl = "";
    browser.stderr.on("data", (chunk: Buffer) => {
      const match = chunk.toString().match(/DevTools listening on (ws:\/\/127\.0\.0\.1:\d+)/);
      if (match) debuggingUrl = match[1]!;
    });
    const endpoint = await waitFor(() => debuggingUrl || undefined);
    const port = new URL(endpoint).port;
    const page = await waitFor(async () => {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      if (!response.ok) return undefined;
      const pages = await response.json() as Array<{ type: string; webSocketDebuggerUrl?: string }>;
      return pages.find((item) => item.type === "page" && item.webSocketDebuggerUrl);
    });
    const socket = new WebSocket(page.webSocketDebuggerUrl!);
    let nextMessageId = 0;
    const pending = new Map<number, { resolve: (value: any) => void; reject: (error: Error) => void }>();
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data)) as { id?: number; result?: any; error?: { message?: string } };
      if (message.id === undefined) return;
      const request = pending.get(message.id);
      if (!request) return;
      pending.delete(message.id);
      if (message.error) request.reject(new Error(message.error.message ?? "Chromium request failed"));
      else request.resolve(message.result);
    });
    await waitFor(() => socket.readyState === WebSocket.OPEN ? true : undefined);
    const send = (method: string, params: Record<string, unknown> = {}) => new Promise<any>((resolve, reject) => {
      const id = ++nextMessageId;
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params }));
    });

    await send("Page.enable");
    await send("Accessibility.enable");
    await send("Page.navigate", {
      url: `data:text/html;charset=utf-8,${encodeURIComponent(`<!doctype html><html><body>${markup}</body></html>`)}`,
    });
    await waitFor(async () => {
      const result = await send("Runtime.evaluate", { expression: "document.readyState" });
      return result?.result?.value === "complete" ? true : undefined;
    });
    const tree = await send("Accessibility.getFullAXTree");
    socket.close();
    return tree.nodes as AccessibilityNode[];
  } finally {
    if (!browser.killed) browser.kill();
    await Promise.race([
      browserExit,
      new Promise((resolve) => setTimeout(resolve, 2_000)),
    ]);
    await rm(profileDirectory, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
}

async function inspectDashboardPicker(markup: string, viewport: { width: number; height: number }, options: { enlargedText?: boolean } = {}) {
  const profileDirectory = await mkdtemp(`${tmpdir()}/duka-picker-`);
  const browser = spawn("chromium", [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--remote-allow-origins=*",
    "--remote-debugging-port=0",
    `--user-data-dir=${profileDirectory}`,
    "about:blank",
  ], { stdio: ["ignore", "ignore", "pipe"] });
  const browserExit = new Promise<void>((resolve) => browser.once("exit", () => resolve()));

  try {
    let debuggingUrl = "";
    browser.stderr.on("data", (chunk: Buffer) => {
      const match = chunk.toString().match(/DevTools listening on (ws:\/\/127\.0\.0\.1:\d+)/);
      if (match) debuggingUrl = match[1]!;
    });
    const endpoint = await waitFor(() => debuggingUrl || undefined);
    const port = new URL(endpoint).port;
    const page = await waitFor(async () => {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      if (!response.ok) return undefined;
      const pages = await response.json() as Array<{ type: string; webSocketDebuggerUrl?: string }>;
      return pages.find((item) => item.type === "page" && item.webSocketDebuggerUrl);
    });
    const socket = new WebSocket(page.webSocketDebuggerUrl!);
    let nextMessageId = 0;
    const pending = new Map<number, { resolve: (value: any) => void; reject: (error: Error) => void }>();
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data)) as { id?: number; result?: any; error?: { message?: string } };
      if (message.id === undefined) return;
      const request = pending.get(message.id);
      if (!request) return;
      pending.delete(message.id);
      if (message.error) request.reject(new Error(message.error.message ?? "Chromium request failed"));
      else request.resolve(message.result);
    });
    await waitFor(() => socket.readyState === WebSocket.OPEN ? true : undefined);
    const send = (method: string, params: Record<string, unknown> = {}) => new Promise<any>((resolve, reject) => {
      const id = ++nextMessageId;
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params }));
    });

    await send("Page.enable");
    await send("Emulation.setDeviceMetricsOverride", {
      width: viewport.width,
      height: viewport.height,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await send("Page.navigate", {
      url: `data:text/html;charset=utf-8,${encodeURIComponent(markup)}`,
    });
    await waitFor(async () => {
      const result = await send("Runtime.evaluate", { expression: "document.readyState" });
      return result?.result?.value === "complete" ? true : undefined;
    });
    if (options.enlargedText) {
      await send("Runtime.evaluate", { expression: "document.documentElement.classList.add('enlarged-text')" });
    }
    await send("Runtime.evaluate", { expression: "document.querySelector('[aria-label=\"Start date\"]')?.focus()" });
    const tabStops: string[] = [];
    for (let index = 0; index < 64; index += 1) {
      const result = await send("Runtime.evaluate", {
        expression: `(() => { const active = document.activeElement; return active?.getAttribute('aria-label') || active?.textContent?.trim() || active?.tagName || ''; })()`,
        returnByValue: true,
      });
      tabStops.push(result?.result?.value ?? "");
      await send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9 });
      await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9 });
    }
    const inspection = await send("Runtime.evaluate", {
      expression: `(() => {
        const rect = (selector) => {
          const element = document.querySelector(selector);
          const box = element?.getBoundingClientRect();
          return box ? { left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: box.width, height: box.height } : null;
        };
        return {
          menu: rect('[data-testid="dashboard-period-menu"]'),
          calendar: rect('[data-testid="dashboard-period-calendar"]'),
          controls: [...document.querySelectorAll('[data-testid="dashboard-period-menu"] input, [data-testid="dashboard-period-menu"] button')].map((element) => element.getAttribute('aria-label') || element.textContent?.trim() || ''),
          controlRects: [...document.querySelectorAll('[data-testid="dashboard-period-menu"] input, [data-testid="dashboard-period-menu"] button')].map((element) => {
            const box = element.getBoundingClientRect();
            return { name: element.getAttribute('aria-label') || element.textContent?.trim() || '', left: box.left, right: box.right, top: box.top, bottom: box.bottom };
          }),
          viewport: { width: window.innerWidth, height: window.innerHeight },
        };
      })()`,
      returnByValue: true,
    });
    const tree = await send("Accessibility.getFullAXTree");
    socket.close();
    return { inspection: inspection?.result?.value, tabStops, tree: tree.nodes as AccessibilityNode[] };
  } finally {
    if (!browser.killed) browser.kill();
    await Promise.race([
      browserExit,
      new Promise((resolve) => setTimeout(resolve, 2_000)),
    ]);
    await rm(profileDirectory, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
}

async function inspectResponsiveMarkup(markup: string, viewport: { width: number; height: number }) {
  const profileDirectory = await mkdtemp(`${tmpdir()}/duka-metric-`);
  const browser = spawn("chromium", [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--remote-allow-origins=*",
    "--remote-debugging-port=0",
    `--user-data-dir=${profileDirectory}`,
    "about:blank",
  ], { stdio: ["ignore", "ignore", "pipe"] });
  const browserExit = new Promise<void>((resolve) => browser.once("exit", () => resolve()));

  try {
    let debuggingUrl = "";
    browser.stderr.on("data", (chunk: Buffer) => {
      const match = chunk.toString().match(/DevTools listening on (ws:\/\/127\.0\.0\.1:\d+)/);
      if (match) debuggingUrl = match[1]!;
    });
    const endpoint = await waitFor(() => debuggingUrl || undefined);
    const port = new URL(endpoint).port;
    const page = await waitFor(async () => {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      if (!response.ok) return undefined;
      const pages = await response.json() as Array<{ type: string; webSocketDebuggerUrl?: string }>;
      return pages.find((item) => item.type === "page" && item.webSocketDebuggerUrl);
    });
    const socket = new WebSocket(page.webSocketDebuggerUrl!);
    let nextMessageId = 0;
    const pending = new Map<number, { resolve: (value: any) => void; reject: (error: Error) => void }>();
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data)) as { id?: number; result?: any; error?: { message?: string } };
      if (message.id === undefined) return;
      const request = pending.get(message.id);
      if (!request) return;
      pending.delete(message.id);
      if (message.error) request.reject(new Error(message.error.message ?? "Chromium request failed"));
      else request.resolve(message.result);
    });
    await waitFor(() => socket.readyState === WebSocket.OPEN ? true : undefined);
    const send = (method: string, params: Record<string, unknown> = {}) => new Promise<any>((resolve, reject) => {
      const id = ++nextMessageId;
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params }));
    });

    await send("Page.enable");
    await send("Accessibility.enable");
    await send("Emulation.setDeviceMetricsOverride", {
      width: viewport.width,
      height: viewport.height,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await send("Page.navigate", {
      url: `data:text/html;charset=utf-8,${encodeURIComponent(markup)}`,
    });
    await waitFor(async () => {
      const result = await send("Runtime.evaluate", { expression: "document.readyState" });
      return result?.result?.value === "complete" ? true : undefined;
    });
    const inspection = await send("Runtime.evaluate", {
      expression: `(() => {
        const rect = (selector) => {
          const element = document.querySelector(selector);
          const box = element?.getBoundingClientRect();
          return box ? { left: box.left, right: box.right, width: box.width, top: box.top, bottom: box.bottom } : null;
        };
        return {
          card: rect('[data-testid="metric-card"]'),
          stack: rect('[data-testid="metric-channel-stack"]'),
          value: rect('[data-testid="metric-value"]'),
          marks: [...document.querySelectorAll('[data-testid="metric-channel-stack"] .metric-channel-stack-mark')].map((element) => {
            const box = element.getBoundingClientRect();
            return { left: box.left, right: box.right, width: box.width };
          }),
          detailCard: rect('[data-testid="card-channel-conversion-detail"]'),
          summaryCards: [...document.querySelectorAll('[data-testid^="card-channel-insight-"]')].map((element) => {
            const box = element.getBoundingClientRect();
            return { left: box.left, right: box.right, width: box.width };
          }),
          rows: [...document.querySelectorAll('[data-testid^="row-channel-insight-"]')].map((element) => {
            const box = element.getBoundingClientRect();
            const conversion = element.querySelector('.channel-insight-conversion')?.getBoundingClientRect();
            return {
              left: box.left,
              right: box.right,
              width: box.width,
              conversion: conversion ? { left: conversion.left, right: conversion.right, width: conversion.width } : null,
            };
          }),
          backLink: rect('[data-testid="channel-back-link"]'),
          viewport: { width: window.innerWidth, height: window.innerHeight, scrollWidth: document.documentElement.scrollWidth },
        };
      })()`,
      returnByValue: true,
    });
    const tree = await send("Accessibility.getFullAXTree");
    socket.close();
    return { inspection: inspection?.result?.value, tree: tree.nodes as AccessibilityNode[] };
  } finally {
    if (!browser.killed) browser.kill();
    await Promise.race([
      browserExit,
      new Promise((resolve) => setTimeout(resolve, 2_000)),
    ]);
    await rm(profileDirectory, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
}

function propertyValue(node: AccessibilityNode, propertyName: string): unknown {
  const value = node.properties?.find((property) => property.name === propertyName)?.value?.value;
  return value === "true" ? true : value === "false" ? false : value;
}

function controlsByRole(tree: AccessibilityNode[], role: string) {
  return tree
    .filter((node) => node.role?.value === role)
    .map((node) => node.name?.value ?? "");
}

test("renders loading, empty, and populated analytics states without errors", () => {
  const cases = [
    {
      state: "loading",
      input: { isLoading: true, isError: false, summary: undefined },
    },
    {
      state: "empty",
      input: { isLoading: false, isError: false, summary: emptySummary },
    },
    {
      state: "populated",
      input: { isLoading: false, isError: false, summary: populatedSummary },
    },
  ] as const;

  for (const { state, input } of cases) {
    assert.equal(getAnalyticsViewState(input), state);
    const markup = renderToStaticMarkup(createElement(AnalyticsStateMarker, { state }));
    assert.match(markup, new RegExp(`data-testid="dashboard-analytics-${state}"`));
    assert.match(markup, new RegExp(`data-analytics-state="${state}"`));
  }
});

test("keeps channel conversion summaries fresh while the page remains open", () => {
  const client = new QueryClient();
  renderToStaticMarkup(createElement(
    QueryClientProvider,
    {
      client,
      children: createElement(
        Router,
        {
          hook: () => ["/reports/channel-conversion", () => undefined] as [string, (path: string) => void],
          children: createElement(ChannelConversionInsight),
        },
      ),
    },
  ));

  const summaryQuery = client.getQueryCache().find({
    queryKey: getGetDashboardSummaryQueryKey(),
  });
  const refreshOptions = summaryQuery?.options as unknown as {
    refetchInterval?: number;
    refetchIntervalInBackground?: boolean;
    refetchOnWindowFocus?: boolean;
  };
  assert.equal(refreshOptions.refetchInterval, CHANNEL_CONVERSION_REFRESH_INTERVAL_MS);
  assert.equal(refreshOptions.refetchIntervalInBackground, true);
  assert.equal(refreshOptions.refetchOnWindowFocus, true);
});

test("keeps channel conversion totals and rows scoped to the selected channel", () => {
  const channels = [
    { channel: "instagram", revenue: 12300, orders: 164, paidOrders: 164, opens: 8240, conversionRate: 2 },
    { channel: "whatsapp", revenue: 6120, orders: 82, paidOrders: 82, opens: 4240, conversionRate: 1.9 },
  ];

  const allChannels = getChannelConversionView(channels);
  assert.deepEqual(allChannels.visibleChannels.map((channel) => channel.channel), ["instagram", "whatsapp"]);
  assert.equal(allChannels.totalViews, 12480);
  assert.equal(allChannels.totalSales, 246);
  assert.equal(allChannels.totalRevenue, 18420);
  assert.equal(allChannels.totalConversion, 246 / 12480 * 100);

  const selectedChannel = getChannelConversionView(channels, "whatsapp");
  assert.deepEqual(selectedChannel.visibleChannels.map((channel) => channel.channel), ["whatsapp"]);
  assert.equal(selectedChannel.totalViews, 4240);
  assert.equal(selectedChannel.totalSales, 82);
  assert.equal(selectedChannel.totalRevenue, 6120);
  assert.equal(selectedChannel.totalConversion, 82 / 4240 * 100);

  const client = new QueryClient();
  client.setQueryData(getGetDashboardSummaryQueryKey(), {
    orders: 246,
    channelPerformance: channels,
    productPerformance: [],
    dailyPerformance: [],
  });
  const markup = renderToStaticMarkup(createElement(
    QueryClientProvider,
    {
      client,
      children: createElement(
        Router,
        {
          hook: () => ["/reports/channel-conversion", () => undefined] as [string, (path: string) => void],
          children: createElement(ChannelConversionInsight),
        },
      ),
    },
  ));
  assert.match(markup, /<label[^>]*for="channel-conversion-filter">Focus channel<\/label>/);
  assert.match(markup, /data-testid="select-channel-conversion"/);
  assert.match(markup, /<option value="all"[^>]*>All channels<\/option>/);
  assert.match(markup, /<option value="instagram">Instagram<\/option>/);
  assert.match(markup, /data-testid="row-channel-insight-instagram"/);
  assert.match(markup, /data-testid="row-channel-insight-whatsapp"/);
});

test("keeps four social channel marks beside the metric value on narrow cards", async () => {
  const styles = await readFile(new URL("../index.css", import.meta.url), "utf8");
  const stackMarkup = renderToStaticMarkup(createElement(SocialChannelStack, {
    channels: ["WhatsApp", "Instagram", "TikTok", "Snapchat"],
  }));
  const createFixture = (rootClass = "") => `<!doctype html>
    <html class="${rootClass}"><head><style>${styles}
      *, *::before, *::after { box-sizing: border-box; }
      html, body { margin: 0; min-width: 0; }
      html.enlarged-text { font-size: 200%; }
      body { padding: .5rem; }
      .metric-fixture { width: 164px; }
      .metric-fixture .app-card { padding: .8rem 1rem; }
    </style></head><body>
      <div class="metric-fixture">
        <div class="app-card overview-secondary-card" data-testid="metric-card">
          <div class="metric-value-row metric-value">
            ${stackMarkup}
            <span class="metric-value-content" data-testid="metric-value">12</span>
          </div>
        </div>
      </div>
    </body></html>`;

  const results = [
    ["default text", await inspectResponsiveMarkup(createFixture(), { width: 320, height: 240 })],
    ["enlarged text", await inspectResponsiveMarkup(createFixture("enlarged-text"), { width: 320, height: 240 })],
  ] as const;

  for (const [textSize, result] of results) {
    const geometry = result.inspection as {
      card: { left: number; right: number; width: number };
      stack: { left: number; right: number; width: number };
      value: { left: number; right: number; width: number };
      marks: Array<{ left: number; right: number; width: number }>;
    };
    assert.ok(geometry.card && geometry.stack && geometry.value);
    assert.equal(geometry.marks.length, 4);
    assert.ok(geometry.marks[1]!.left < geometry.marks[0]!.right, `${textSize}: channel marks should overlap horizontally`);
    assert.ok(geometry.stack.right <= geometry.value.left, `${textSize}: icon stack should not cover the metric value: ${JSON.stringify(geometry)}`);
    assert.ok(geometry.value.right <= geometry.card.right, `${textSize}: metric value should remain inside the card: ${JSON.stringify(geometry)}`);
    assert.ok(geometry.value.width > 0, `${textSize}: metric value should retain visible width`);

    const stack = result.tree.find((node) => node.name?.value === "Active social channels: WhatsApp, Instagram, TikTok, Snapchat");
    assert.equal(stack?.name?.value, "Active social channels: WhatsApp, Instagram, TikTok, Snapchat", `${textSize}: social channel stack should remain accessible`);
  }
});

test("keeps channel conversion details readable and keyboard reachable on narrow screens", async () => {
  const styles = await readFile(new URL("../index.css", import.meta.url), "utf8");
  const fixture = `<!doctype html>
    <html><head><style>${styles}
      *, *::before, *::after { box-sizing: border-box; }
      html, body { margin: 0; min-width: 0; }
      body { padding: .75rem; }
      .channel-fixture { width: 100%; max-width: 620px; margin: 0 auto; }
      .channel-fixture .app-card { border: 1px solid #ddd; padding: 1rem; }
      .channel-fixture .channel-insight-row { border-top: 1px solid #ddd; }
    </style></head><body>
      <main class="channel-fixture channel-insight-page">
        <a href="/" data-testid="channel-back-link">Back to dashboard</a>
        <section class="reports-metric-grid" aria-label="Channel conversion summary">
          <div class="app-card" data-testid="card-channel-insight-views">Total views <strong>12,480</strong></div>
          <div class="app-card" data-testid="card-channel-insight-sales">Paid sales <strong>246</strong></div>
          <div class="app-card" data-testid="card-channel-insight-revenue">Revenue <strong>$18,420</strong></div>
          <div class="app-card" data-testid="card-channel-insight-conversion">Overall conversion <strong>2.0%</strong></div>
        </section>
        <section class="channel-insight-card" data-testid="card-channel-conversion-detail">
          <div class="channel-insight-list">
            <div class="channel-insight-list-head"><span>Channel</span><span>Views</span><span>Sales</span><span>Revenue</span><span>Conversion</span></div>
            <article class="channel-insight-row" data-testid="row-channel-insight-instagram">
              <div class="channel-insight-identity"><span class="channel-conversion-mark">IG</span><span class="channel-conversion-name">Instagram</span></div>
              <strong class="channel-insight-number" data-label="Views">8,240</strong>
              <strong class="channel-insight-number" data-label="Sales">164</strong>
              <strong class="channel-insight-number" data-label="Revenue">$12,300</strong>
              <div class="channel-insight-conversion"><strong data-label="Conversion">2.0%</strong><span class="channel-insight-progress"><span style="width: 2%"></span></span></div>
            </article>
          </div>
        </section>
      </main>
    </body></html>`;

  const result = await inspectResponsiveMarkup(fixture, { width: 360, height: 800 });
  const geometry = result.inspection as {
    detailCard: { left: number; right: number; width: number };
    summaryCards: Array<{ left: number; right: number; width: number }>;
    rows: Array<{ left: number; right: number; width: number; conversion: { left: number; right: number; width: number } | null }>;
    backLink: { left: number; right: number; width: number };
    viewport: { width: number; scrollWidth: number };
  };
  assert.equal(geometry.summaryCards.length, 4);
  assert.ok(geometry.detailCard);
  assert.ok(geometry.backLink);
  assert.ok(geometry.backLink.width > 0, "Back to dashboard should remain a visible keyboard target");
  assert.equal(geometry.rows.length, 1);
  assert.ok(geometry.detailCard.right <= geometry.viewport.width, `Detail card should not clip horizontally: ${JSON.stringify(geometry)}`);
  assert.ok(geometry.viewport.scrollWidth <= geometry.viewport.width, `Channel insight page should not overflow horizontally: ${JSON.stringify(geometry)}`);
  for (const card of geometry.summaryCards) {
    assert.ok(card.left >= 0 && card.right <= geometry.viewport.width, `Summary card should fit inside the viewport: ${JSON.stringify({ geometry, card })}`);
    assert.ok(card.width > 0, "Summary card should retain visible width");
  }
  const [row] = geometry.rows;
  assert.ok(row && row.left >= 0 && row.right <= geometry.viewport.width, `Channel row should fit inside the viewport: ${JSON.stringify(geometry)}`);
  assert.ok(row?.conversion && row.conversion.width > 0, "Conversion indicator should retain visible width");
  assert.deepEqual(result.tree.filter((node) => node.role?.value === "link").map((node) => node.name?.value), ["Back to dashboard"]);
});

test("keeps the custom dashboard picker usable with enlarged text", async () => {
  const styles = await readFile(new URL("../index.css", import.meta.url), "utf8");
  const pickerMarkup = renderToStaticMarkup(createElement(DashboardCustomRangePicker, {
    from: "2026-09-01",
    to: "2026-09-15",
    onFromChange: () => undefined,
    onToChange: () => undefined,
    onClose: () => undefined,
    onApply: () => undefined,
    canApply: true,
  }));
  const fixture = `<!doctype html>
    <html><head><style>${styles}
      *, *::before, *::after { box-sizing: border-box; }
      html, body { margin: 0; min-width: 0; }
      html.enlarged-text { font-size: 200%; }
      body { min-height: 100vh; }
      .picker-fixture { box-sizing: border-box; width: 100vw; min-height: 100vh; padding: 1rem 1.25rem; }
      .picker-heading { display: flex; align-items: flex-start; justify-content: space-between; }
      .picker-action { display: flex; align-items: center; gap: .5rem; }
      .picker-card { position: relative; z-index: 1; height: 180px; margin-top: -1rem; border: 1px solid #ddd; background: white; }
      .relative { position: relative; }
      @media (max-width: 639px) {
        .picker-heading { flex-direction: column; gap: 1rem; }
      }
    </style></head><body>
      <main class="picker-fixture">
        <div class="picker-heading">
          <h1>Dashboard</h1>
          <div class="picker-action">
            <div class="relative">
              <button type="button" class="period-chip" aria-label="Reporting period" aria-expanded="true">Sep 1 – Sep 15</button>
              <div class="dashboard-period-menu is-custom" role="dialog" aria-label="Choose reporting period" data-testid="dashboard-period-menu">${pickerMarkup}</div>
            </div>
          </div>
        </div>
        <div class="picker-card" data-testid="dashboard-card">Dashboard cards</div>
      </main>
    </body></html>`;

  for (const viewport of [{ width: 1280, height: 1000 }, { width: 390, height: 1000 }]) {
    const result = await inspectDashboardPicker(fixture, viewport, { enlargedText: true });
    const geometry = result.inspection as {
      menu: { left: number; right: number; top: number; bottom: number; width: number; height: number };
      calendar: { left: number; right: number; top: number; bottom: number; width: number; height: number };
      controls: string[];
      controlRects: Array<{ name: string; left: number; right: number; top: number; bottom: number }>;
      viewport: { width: number; height: number };
    };
    assert.ok(geometry.menu, `Picker menu should render with enlarged text at ${viewport.width}px`);
    assert.ok(geometry.calendar, `Picker calendar should render with enlarged text at ${viewport.width}px`);
    assert.ok(geometry.menu.left >= 0, `Picker left edge should stay in the viewport with enlarged text at ${viewport.width}px`);
    assert.ok(geometry.menu.right <= geometry.viewport.width, `Picker right edge should stay in the viewport with enlarged text at ${viewport.width}px`);
    assert.ok(geometry.menu.top >= 0, `Picker top edge should stay in the viewport with enlarged text at ${viewport.width}px`);
    assert.ok(geometry.menu.bottom <= geometry.viewport.height, `Picker should not exceed the viewport height with enlarged text at ${viewport.width}px`);
    assert.ok(
      geometry.calendar.left >= geometry.menu.left && geometry.calendar.right <= geometry.menu.right,
      `Calendar should fit inside picker with enlarged text: ${JSON.stringify({ viewport, menu: geometry.menu, calendar: geometry.calendar })}`,
    );
    assert.deepEqual(geometry.controls.filter((name) => name === "Close"), ["Close"]);
    assert.deepEqual(geometry.controls.filter((name) => name === "Apply range"), ["Apply range"]);
    for (const control of geometry.controlRects) {
      assert.ok(control.left >= 0 && control.right <= geometry.viewport.width, `${control.name} should fit horizontally with enlarged text: ${JSON.stringify({ viewport, control })}`);
      assert.ok(control.top >= 0 && control.bottom <= geometry.viewport.height, `${control.name} should fit vertically with enlarged text: ${JSON.stringify({ viewport, control })}`);
    }
    assert.equal(result.tabStops[0], "Start date");
    assert.ok(result.tabStops.includes("End date"), `Tab sequence did not reach End date with enlarged text: ${JSON.stringify(result.tabStops)}`);
    assert.ok(result.tabStops.includes("Previous month"), `Tab sequence did not reach Previous month with enlarged text: ${JSON.stringify(result.tabStops)}`);
    assert.ok(result.tabStops.includes("Next month"), `Tab sequence did not reach Next month with enlarged text: ${JSON.stringify(result.tabStops)}`);
    assert.ok(result.tabStops.includes("Close"), `Tab sequence did not reach Close with enlarged text: ${JSON.stringify(result.tabStops)}`);
    assert.ok(result.tabStops.includes("Apply range"), `Tab sequence did not reach Apply range with enlarged text: ${JSON.stringify(result.tabStops)}`);
    assert.ok(
      result.tabStops.indexOf("Apply range") > result.tabStops.indexOf("Close"),
      `Apply range should follow Close with enlarged text: ${JSON.stringify(result.tabStops)}`,
    );
  }
});

test("prioritizes loading and error states over stale analytics data", () => {
  assert.equal(
    getAnalyticsViewState({
      isLoading: true,
      isError: false,
      summary: populatedSummary,
    }),
    "loading",
  );
  assert.equal(
    getAnalyticsViewState({
      isLoading: false,
      isError: true,
      summary: populatedSummary,
    }),
    "error",
  );
});

test("keeps every supported channel value stable while selecting and toggling", () => {
  const orderValues = orderChannels.map((channel) => channel.value);
  assert.deepEqual(orderValues, [
    "whatsapp",
    "instagram",
    "tiktok",
    "snapchat",
    "in_person",
  ]);

  let selected: string[] = [];
  for (const value of orderValues) {
    const previous = [...selected];
    selected = togglePreference(selected, value);
    assert.deepEqual(selected, [...previous, value]);
    selected = togglePreference(selected, value);
    assert.deepEqual(selected, previous);
  }

  for (const label of onboardingChannels.slice(0, 5)) {
    const toggledOn = togglePreference([], label);
    assert.deepEqual(toggledOn, [label]);
    assert.deepEqual(togglePreference(toggledOn, label), []);
  }
});

test("renders order-channel controls with one selected value at a time", () => {
  for (const selectedValue of orderChannels.map((channel) => channel.value)) {
    const markup = renderToStaticMarkup(
      createElement(ChannelPicker, {
        value: selectedValue,
        onChange: () => undefined,
        testId: "order-channel",
      }),
    );

    for (const channel of orderChannels) {
      assert.match(
        markup,
        new RegExp(
          `aria-checked="${channel.value === selectedValue}"[^>]*data-testid="order-channel-${channel.value}"`,
        ),
      );
      assert.match(markup, new RegExp(`>${channel.label}</span>`));
    }
  }
});

test("keeps onboarding and order channels keyboard-reachable with synchronized names and state", () => {
  const selectedOrderChannel = orderChannels[2]!.value;
  const orderMarkup = renderToStaticMarkup(
    createElement(ChannelPicker, {
      value: selectedOrderChannel,
      onChange: () => undefined,
      testId: "order-channel",
    }),
  );

  for (const channel of orderChannels) {
    assert.match(
      orderMarkup,
      new RegExp(
        `type="button"[^>]*role="radio"[^>]*aria-label="${channel.label}"[^>]*aria-checked="${channel.value === selectedOrderChannel}"[^>]*data-testid="order-channel-${channel.value}"`,
      ),
    );
  }

  const selectedOnboardingChannels = ["WhatsApp", "Snapchat"];
  const onboardingMarkup = renderToStaticMarkup(
    createElement(OnboardingChannelPicker, {
      selectedChannels: selectedOnboardingChannels,
      onToggle: () => undefined,
    }),
  );

  for (const channel of onboardingChannels) {
    const inputTestId = `input-onboarding-channel-${channel.toLowerCase().replaceAll(" ", "-")}`;
    assert.match(
      onboardingMarkup,
      new RegExp(
        `type="checkbox"[^>]*data-testid="${inputTestId}"[^>]*aria-label="${channel}"[^>]*${selectedOnboardingChannels.includes(channel) ? 'checked=""' : ""}`,
      ),
    );
  }
});

test("exposes channel groups, names, roles, and state in the live accessibility tree", async () => {
  const selectedOrderChannel = orderChannels[2]!.value;
  const orderMarkup = renderToStaticMarkup(
    createElement(ChannelPicker, {
      value: selectedOrderChannel,
      onChange: () => undefined,
      testId: "order-channel",
    }),
  );
  const orderTree = await readAccessibilityTree(orderMarkup);
  const orderGroup = orderTree.find((node) => node.role?.value === "radiogroup");
  assert.equal(orderGroup?.name?.value, "Conversation channel");
  const orderRadios = orderTree.filter((node) => node.role?.value === "radio");
  assert.deepEqual(
    orderRadios.map((node) => ({ name: node.name?.value, checked: propertyValue(node, "checked") })),
    orderChannels.map((channel) => ({ name: channel.label, checked: channel.value === selectedOrderChannel })),
  );

  const selectedOnboardingChannels = ["WhatsApp", "Snapchat"];
  const onboardingMarkup = renderToStaticMarkup(
    createElement(OnboardingChannelPicker, {
      selectedChannels: selectedOnboardingChannels,
      onToggle: () => undefined,
    }),
  );
  const onboardingTree = await readAccessibilityTree(onboardingMarkup);
  const onboardingGroup = onboardingTree.find((node) => node.role?.value === "group");
  assert.equal(onboardingGroup?.name?.value, "Sales channels");
  const onboardingCheckboxes = onboardingTree.filter((node) => node.role?.value === "checkbox");
  assert.deepEqual(
    onboardingCheckboxes.map((node) => ({ name: node.name?.value, checked: propertyValue(node, "checked") })),
    onboardingChannels.map((channel) => ({ name: channel, checked: selectedOnboardingChannels.includes(channel) })),
  );
});

test("keeps the custom dashboard picker inside desktop and narrow viewports", async () => {
  const styles = await readFile(new URL("../index.css", import.meta.url), "utf8");
  const pickerMarkup = renderToStaticMarkup(createElement(DashboardCustomRangePicker, {
    from: "2026-09-01",
    to: "2026-09-15",
    onFromChange: () => undefined,
    onToChange: () => undefined,
    onClose: () => undefined,
    onApply: () => undefined,
    canApply: true,
  }));
  const fixture = `<!doctype html>
    <html><head><style>${styles}
      *, *::before, *::after { box-sizing: border-box; }
      html, body { margin: 0; min-width: 0; }
      body { min-height: 100vh; }
      .picker-fixture { box-sizing: border-box; width: 100vw; min-height: 100vh; padding: 1rem 1.25rem; }
      .picker-heading { display: flex; align-items: flex-start; justify-content: space-between; }
      .picker-action { display: flex; align-items: center; gap: .5rem; }
      .picker-card { position: relative; z-index: 1; height: 180px; margin-top: -1rem; border: 1px solid #ddd; background: white; }
      .relative { position: relative; }
      @media (max-width: 639px) {
        .picker-heading { flex-direction: column; gap: 1rem; }
      }
    </style></head><body>
      <main class="picker-fixture">
        <div class="picker-heading">
          <h1>Dashboard</h1>
          <div class="picker-action">
            <div class="relative">
              <button type="button" class="period-chip" aria-label="Reporting period" aria-expanded="true">Sep 1 – Sep 15</button>
              <div class="dashboard-period-menu is-custom" role="dialog" aria-label="Choose reporting period" data-testid="dashboard-period-menu">${pickerMarkup}</div>
            </div>
          </div>
        </div>
        <div class="picker-card" data-testid="dashboard-card">Dashboard cards</div>
      </main>
    </body></html>`;

  for (const viewport of [{ width: 1280, height: 720 }, { width: 390, height: 480 }]) {
    const result = await inspectDashboardPicker(fixture, viewport);
    const geometry = result.inspection as {
      menu: { left: number; right: number; top: number; bottom: number; width: number; height: number };
      calendar: { left: number; right: number; top: number; bottom: number; width: number; height: number };
      controls: string[];
      viewport: { width: number; height: number };
    };
    assert.ok(geometry.menu, `Picker menu should render at ${viewport.width}px`);
    assert.ok(geometry.calendar, `Picker calendar should render at ${viewport.width}px`);
    assert.ok(geometry.menu.left >= 0, `Picker left edge should stay in the viewport at ${viewport.width}px`);
    assert.ok(geometry.menu.right <= geometry.viewport.width, `Picker right edge should stay in the viewport at ${viewport.width}px`);
    assert.ok(geometry.menu.top >= 0, `Picker top edge should stay in the viewport at ${viewport.width}px`);
    assert.ok(geometry.menu.bottom <= geometry.viewport.height, `Picker should not exceed the viewport height at ${viewport.width}px`);
    assert.ok(
      geometry.calendar.left >= geometry.menu.left && geometry.calendar.right <= geometry.menu.right,
      `Calendar should fit inside picker: ${JSON.stringify({ viewport, menu: geometry.menu, calendar: geometry.calendar })}`,
    );
    assert.equal(geometry.controls.filter((name) => name === "Close").length, 1);
    assert.equal(geometry.controls.filter((name) => name === "Apply range").length, 1);
    assert.equal(result.tabStops[0], "Start date");
    assert.ok(result.tabStops.includes("End date"));
    assert.ok(result.tabStops.includes("Previous month"));
    assert.ok(result.tabStops.includes("Next month"));
    assert.ok(result.tabStops.includes("Close"), `Tab sequence did not reach Close: ${JSON.stringify(result.tabStops)}`);
    assert.ok(result.tabStops.includes("Apply range"), `Tab sequence did not reach Apply range: ${JSON.stringify(result.tabStops)}`);
    assert.ok(
      result.tabStops.indexOf("Apply range") > result.tabStops.indexOf("Close"),
      `Apply range should follow Close in the tab sequence: ${JSON.stringify(result.tabStops)}`,
    );

    const dialog = result.tree.find((node) => node.role?.value === "dialog");
    assert.equal(dialog?.name?.value, "Choose reporting period");
    const calendar = result.tree.find((node) => node.role?.value === "group");
    assert.equal(calendar?.name?.value, "Choose date range");
  }
});

test("rejects reversed dashboard ranges before applying and returns focus without leaking draft dates", async () => {
  const dom = new JSDOM("<!doctype html><html><body><div id=\"root\"></div></body></html>", {
    url: "http://localhost/",
  });
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    HTMLElement: dom.window.HTMLElement,
    HTMLInputElement: dom.window.HTMLInputElement,
    addEventListener: dom.window.addEventListener.bind(dom.window),
    removeEventListener: dom.window.removeEventListener.bind(dom.window),
  });
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: dom.window.navigator,
  });
  Object.defineProperty(globalThis, "location", {
    configurable: true,
    value: dom.window.location,
  });
  Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
    configurable: true,
    value: true,
  });

  const originalFetch = globalThis.fetch;
  const summaryRequests: URL[] = [];
  globalThis.fetch = async (input) => {
    const url = String(input);
    const requestUrl = new URL(url, "http://localhost");
    if (url.includes("/api/dashboard/summary")) summaryRequests.push(requestUrl);
    const isAppliedCustomRange = requestUrl.searchParams.get("from") === "2020-01-10"
      && requestUrl.searchParams.get("to") === "2020-01-20";
    const body = url.includes("/api/dashboard/summary")
      ? {
        orders: isAppliedCustomRange ? 1 : 0,
        shares: isAppliedCustomRange ? 3 : 12,
        likes: isAppliedCustomRange ? 5 : 8,
        channelPerformance: [],
        productPerformance: [],
        dailyPerformance: [],
      }
      : [];
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  const { act } = await import("react");
  const { createRoot } = await import("react-dom/client");
  const container = dom.window.document.getElementById("root")!;
  let root = createRoot(container);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const renderOverview = () => createElement(
    QueryClientProvider,
    {
      client: queryClient,
      children: createElement(
        Router,
        {
          hook: () => ["/", (_path: string, ..._args: any[]) => undefined] as [string, (path: string, ...args: any[]) => any],
          children: createElement(Overview),
        },
      ),
    },
  );
  const get = <T extends HTMLElement>(testId: string) => {
    const element = container.querySelector<T>(`[data-testid="${testId}"]`);
    assert.ok(element, `Expected ${testId} to be present`);
    return element;
  };
  const click = async (testId: string) => {
    await act(async () => {
      get<HTMLButtonElement>(testId).click();
    });
  };
  const setDate = async (testId: string, value: string) => {
    await act(async () => {
      const input = get<HTMLInputElement>(testId);
      const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value")?.set;
      setter?.call(input, value);
      input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
      input.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    });
  };

  try {
    await act(async () => {
      root.render(renderOverview());
    });

    let sharesText: string | undefined;
    let likesText: string | undefined;
    await act(async () => {
      sharesText = await waitFor(() => {
        const text = container.querySelector<HTMLElement>('[data-testid="card-kpi-secondary-shares"]')?.textContent;
        return text?.includes("12") ? text : undefined;
      });
      likesText = await waitFor(() => {
        const text = container.querySelector<HTMLElement>('[data-testid="card-kpi-secondary-likes"]')?.textContent;
        return text?.includes("8") ? text : undefined;
      });
    });
    assert.match(sharesText ?? "", /12/);
    assert.match(likesText ?? "", /8/);

    const trigger = get<HTMLButtonElement>("button-dashboard-period");
    await click("button-dashboard-period");
    await click("button-dashboard-period-custom");
    const initialFrom = get<HTMLInputElement>("input-dashboard-period-from").value;
    await setDate("input-dashboard-period-from", "2020-01-01");
    assert.equal(get<HTMLInputElement>("input-dashboard-period-from").value, "2020-01-01");

    await click("button-dashboard-period-close");
    assert.equal(dom.window.document.activeElement, trigger);
    assert.equal(container.querySelector('[data-testid="dashboard-period-menu"]'), null);
    assert.match(trigger.textContent ?? "", /Last 7 days/);

    await click("button-dashboard-period");
    await click("button-dashboard-period-custom");
    assert.equal(get<HTMLInputElement>("input-dashboard-period-from").value, initialFrom);
    await setDate("input-dashboard-period-from", "2020-01-10");
    await setDate("input-dashboard-period-to", "2020-01-01");
    const summaryRequestCountBeforeInvalidRange = summaryRequests.length;
    const invalidApply = get<HTMLButtonElement>("button-dashboard-period-apply");
    assert.equal(invalidApply.disabled, true);
    await click("button-dashboard-period-apply");
    assert.equal(summaryRequests.length, summaryRequestCountBeforeInvalidRange);
    assert.equal(
      summaryRequests.some((request) => (
        request.searchParams.get("from") === "2020-01-10"
        && request.searchParams.get("to") === "2020-01-01"
      )),
      false,
      "The dashboard should not query an invalid reversed range",
    );
    assert.ok(container.querySelector('[role="dialog"][aria-label="Choose reporting period"]'));

    await setDate("input-dashboard-period-to", "2020-01-20");
    assert.equal(get<HTMLButtonElement>("button-dashboard-period-apply").disabled, false);
    await click("button-dashboard-period-apply");
    assert.equal(dom.window.document.activeElement, trigger);
    assert.equal(container.querySelector('[data-testid="dashboard-period-menu"]'), null);
    assert.match(trigger.textContent ?? "", /Jan 10/);
    assert.match(trigger.textContent ?? "", /Jan 20/);

    const appliedSummaryRequest = await waitFor(() => summaryRequests.find((request) => (
      request.searchParams.get("from") === "2020-01-10"
      && request.searchParams.get("to") === "2020-01-20"
    )));
    assert.ok(appliedSummaryRequest, "Expected the dashboard query to use the applied custom range");
    await act(async () => {
      await waitFor(() => {
        const text = container.querySelector<HTMLElement>('[data-testid="card-kpi-secondary-shares"]')?.textContent;
        return text?.includes("3") ? text : undefined;
      });
      await waitFor(() => {
        const text = container.querySelector<HTMLElement>('[data-testid="card-kpi-secondary-likes"]')?.textContent;
        return text?.includes("5") ? text : undefined;
      });
    });
    assert.match(
      get<HTMLElement>("card-kpi-secondary-shares").textContent ?? "",
      /3/,
      "The shares card should use the selected custom range",
    );
    assert.match(
      get<HTMLElement>("card-kpi-secondary-likes").textContent ?? "",
      /5/,
      "The likes card should use the selected custom range",
    );

    await click("button-dashboard-period");
    assert.equal(get<HTMLInputElement>("input-dashboard-period-from").value, "2020-01-10");
    assert.equal(get<HTMLInputElement>("input-dashboard-period-to").value, "2020-01-20");
    assert.match(trigger.textContent ?? "", /^Jan 10 – Jan 20$/);
    assert.equal(appliedSummaryRequest.searchParams.get("from"), "2020-01-10");
    assert.equal(appliedSummaryRequest.searchParams.get("to"), "2020-01-20");
    await act(async () => {
      dom.window.document.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    assert.equal(dom.window.document.activeElement, trigger);
    assert.equal(container.querySelector('[data-testid="dashboard-period-menu"]'), null);
    await act(async () => {
      root.unmount();
      root = createRoot(container);
      root.render(renderOverview());
    });
    const reloadedTrigger = get<HTMLButtonElement>("button-dashboard-period");
    await click("button-dashboard-period");
    assert.equal(get<HTMLInputElement>("input-dashboard-period-from").value, "2020-01-10");
    assert.equal(get<HTMLInputElement>("input-dashboard-period-to").value, "2020-01-20");
    await click("button-dashboard-period-close");
    assert.equal(dom.window.document.activeElement, reloadedTrigger);
    assert.equal(container.querySelector('[data-testid="dashboard-period-menu"]'), null);
  } finally {
    await act(async () => {
      root.unmount();
    });
    globalThis.fetch = originalFetch;
    dom.window.close();
  }
});

test("exposes buyer order fields, payment choices, and submit state in the live accessibility tree", async () => {
  const baseProps = {
    paymentMode: "full" as const,
    amount: 120,
    depositAmount: null,
    form: {
      name: "",
      phone: "",
      details: "",
      image: "",
      imagePreview: "",
      action: "pay" as const,
    },
    mockPayment: { cardNumber: "", expiry: "", cvc: "" },
    submitPending: false,
    onSubmit: () => undefined,
    onChange: () => undefined,
    onMockPaymentChange: () => undefined,
    onReferenceImageChange: () => undefined,
    onPaymentAction: () => undefined,
  };

  const initialTree = await readAccessibilityTree(
    renderToStaticMarkup(createElement(BuyerOrderForm, {
      ...baseProps,
      showMockPayment: false,
    })),
  );
  const initialTextFields = initialTree
    .filter((node) => node.role?.value === "textbox")
    .map((node) => node.name?.value ?? "");
  assert.deepEqual(initialTextFields, ["Your name", "Phone number", "Details for the seller (optional)"]);
  assert.deepEqual(
    initialTree
      .filter((node) => node.role?.value === "radio")
      .map((node) => ({ name: node.name?.value, checked: propertyValue(node, "checked") })),
    [
      { name: "Pay $120.00", checked: true },
      { name: "Reserve for later", checked: false },
    ],
  );
  assert.ok(
    controlsByRole(initialTree, "button").some((name) => name.trim() === "Continue to mock payment"),
    "The initial buyer action needs a clear accessible name",
  );
  assert.ok(
    controlsByRole(initialTree, "button").includes("Reference image"),
    "The optional reference upload needs a clear accessible name",
  );

  const paymentTree = await readAccessibilityTree(
    renderToStaticMarkup(createElement(BuyerOrderForm, {
      ...baseProps,
      showMockPayment: true,
      form: { ...baseProps.form, action: "reserve" as const },
    })),
  );
  assert.deepEqual(
    paymentTree
      .filter((node) => node.role?.value === "textbox")
      .map((node) => node.name?.value ?? ""),
    ["Your name", "Phone number", "Details for the seller (optional)", "Card number", "Expiry", "CVC"],
  );
  assert.deepEqual(
    paymentTree
      .filter((node) => node.role?.value === "radio")
      .map((node) => ({ name: node.name?.value, checked: propertyValue(node, "checked") })),
    [
      { name: "Pay $120.00", checked: false },
      { name: "Reserve for later", checked: true },
    ],
  );
  assert.ok(
    controlsByRole(paymentTree, "button").some((name) => name.trim() === "Reserve these items"),
    "The selected reserve state needs a clear accessible primary action",
  );
});

test("names seller navigation and icon-only actions in the live accessibility tree", async () => {
  const navigationTree = await readAccessibilityTree(
    renderToStaticMarkup(createElement(
      Router,
      {
        hook: () => ["/", (_path: string, ..._args: any[]) => undefined] as [string, (path: string, ...args: any[]) => any],
        children: createElement(Sidebar),
      },
    )),
  );
  assert.equal(
    navigationTree.find((node) => node.role?.value === "navigation")?.name?.value,
    "Seller workspace navigation",
  );
  assert.deepEqual(controlsByRole(navigationTree, "link"), [
    "Dashboard",
    "Catalog",
    "Orders12",
    "Reports",
    "Clients",
    "Expenses",
    "Take an order",
    "Connect tools",
  ]);

  const queryClient = new QueryClient();
  const actionMarkup = [
    renderToStaticMarkup(createElement(CatalogActions, {
      productName: "Linen wrap top",
      onEdit: () => undefined,
      onDelete: () => undefined,
    })),
    renderToStaticMarkup(createElement(ExpenseActions, {
      expenseTitle: "Studio rent",
      onEdit: () => undefined,
      onDelete: () => undefined,
    })),
    renderToStaticMarkup(createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(ProductModal, { onClose: () => undefined }),
    )),
    renderToStaticMarkup(createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(ExpenseModal, { onClose: () => undefined }),
    )),
  ].join("");
  const actionTree = await readAccessibilityTree(actionMarkup);
  const buttonNames = controlsByRole(actionTree, "button");
  assert.ok(buttonNames.every((name) => name.length > 0), "Every seller button needs an accessible name");
  for (const expectedName of [
    "Edit Linen wrap top",
    "Delete Linen wrap top",
    "Edit Studio rent",
    "Delete Studio rent",
    "Close item editor",
    "Use gold accent color",
    "Use green accent color",
    "Use rose accent color",
    "Use blue accent color",
    "Use orange accent color",
    "Close expense editor",
  ]) {
    assert.ok(buttonNames.includes(expectedName), `Expected live seller action named "${expectedName}"`);
  }
});

test("activating a channel control calls back with only its channel", () => {
  const selectedOrderChannels: string[] = [];
  const orderPicker = ChannelPicker({
    value: "whatsapp",
    onChange: (value) => selectedOrderChannels.push(value),
    testId: "order-channel",
  });
  const orderControls = orderPicker.props.children as ReactElement<{ onClick?: () => void }>[];

  for (const [index, channel] of orderChannels.entries()) {
    orderControls[index]!.props.onClick?.();
    assert.deepEqual(selectedOrderChannels, [channel.value]);
    selectedOrderChannels.length = 0;
  }

  const selectedOnboardingChannels: string[] = [];
  const onboardingPicker = OnboardingChannelPicker({
    selectedChannels: [],
    onToggle: (channel) => selectedOnboardingChannels.push(channel),
  });
  const onboardingLabels = onboardingPicker.props.children as ReactElement<{ children?: ReactElement[] }>[];

  for (const [index, channel] of onboardingChannels.entries()) {
    const labelChildren = onboardingLabels[index]!.props.children as ReactElement[];
    (labelChildren[0] as ReactElement<{ onChange?: () => void }>).props.onChange?.();
    assert.deepEqual(selectedOnboardingChannels, [channel]);
    selectedOnboardingChannels.length = 0;
  }
});

test("Connect preference labels describe saved preferences, not authorization", () => {
  assert.equal(connectPreferenceLabel(false), "Not saved");
  assert.equal(connectPreferenceLabel(true), "Saved preference");
  assert.equal(
    connectPreferenceAriaLabel("WhatsApp", false),
    "WhatsApp, not saved. Select to save this preference.",
  );
  assert.equal(
    connectPreferenceAriaLabel("WhatsApp", true),
    "WhatsApp, saved preference. Select to remove this preference.",
  );
  assert.doesNotMatch(connectPreferenceAriaLabel("WhatsApp", true), /authoriz|connect/i);
});

test("Dashboard reporting period preferences survive a remount and reject incomplete ranges", () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };

  writeDashboardPeriodPreference({
    period: "custom",
    customFrom: "2020-01-01",
    customTo: "2020-01-10",
  }, storage);
  assert.equal(
    values.get(DASHBOARD_PERIOD_KEY),
    '{"period":"custom","customFrom":"2020-01-01","customTo":"2020-01-10"}',
  );
  assert.deepEqual(readDashboardPeriodPreference(storage), {
    period: "custom",
    customFrom: "2020-01-01",
    customTo: "2020-01-10",
  });

  for (const saved of [
    "{not valid json",
    '{"period":"custom","customFrom":"2020-01-01"}',
    '{"period":"custom","customFrom":"2020-01-10","customTo":"2020-01-01"}',
    '{"period":"custom","customFrom":"2020-02-30","customTo":"2020-03-01"}',
    '{"period":"quarter","customFrom":"2020-01-01","customTo":"2020-01-10"}',
  ]) {
    values.set(DASHBOARD_PERIOD_KEY, saved);
    assert.equal(readDashboardPeriodPreference(storage), null);
  }
});

test("Connect choices persist exact local preferences across a remount", () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };

  let selected = readConnectedTools(storage);
  selected = togglePreference(selected, "WhatsApp");
  writeConnectedTools(selected, storage);
  assert.equal(values.get(CONNECTED_TOOLS_KEY), '["WhatsApp"]');

  selected = togglePreference(selected, "Paystack");
  writeConnectedTools(selected, storage);
  assert.equal(values.get(CONNECTED_TOOLS_KEY), '["WhatsApp","Paystack"]');

  selected = togglePreference(selected, "WhatsApp");
  writeConnectedTools(selected, storage);
  assert.equal(values.get(CONNECTED_TOOLS_KEY), '["Paystack"]');

  const reopened = readConnectedTools(storage);
  assert.deepEqual(reopened, ["Paystack"]);
  assert.equal(connectPreferenceLabel(reopened.includes("WhatsApp")), "Not saved");
  assert.equal(connectPreferenceLabel(reopened.includes("Paystack")), "Saved preference");
  assert.equal(
    connectPreferenceAriaLabel("Paystack", reopened.includes("Paystack")),
    "Paystack, saved preference. Select to remove this preference.",
  );
  assert.doesNotMatch(values.get(CONNECTED_TOOLS_KEY) ?? "", /authoriz|integrat/i);
});

test("Connect excludes stale tool names from saved preferences and tile state", () => {
  const values = new Map<string, string>([
    [CONNECTED_TOOLS_KEY, '["Legacy Messenger","WhatsApp","Removed Payment Tool","WhatsApp"]'],
  ]);
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };

  const connected = readConnectedTools(storage);

  assert.deepEqual(connected, ["WhatsApp"]);
  assert.equal(connected.length, 1);
  assert.equal(connected.includes("Legacy Messenger"), false);
  assert.equal(connected.includes("Instagram"), false);
  assert.equal(CONNECTED_TOOL_NAMES.includes(connected[0] as (typeof CONNECTED_TOOL_NAMES)[number]), true);

  writeConnectedTools(["WhatsApp", "Legacy Messenger", "Removed Payment Tool"], storage);
  assert.equal(values.get(CONNECTED_TOOLS_KEY), '["WhatsApp"]');
});

test("Connect clear-all removes saved preferences without touching other local storage", () => {
  const values = new Map<string, string>([
    [CONNECTED_TOOLS_KEY, '["WhatsApp","Paystack"]'],
    ["duka-onboarding-profile", '{"businessName":"The Sunday Edit"}'],
  ]);
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };

  assert.deepEqual(clearPreferences(), []);
  clearConnectedTools(storage);

  assert.equal(values.has(CONNECTED_TOOLS_KEY), false);
  assert.deepEqual(readConnectedTools(storage), []);
  assert.equal(values.get("duka-onboarding-profile"), '{"businessName":"The Sunday Edit"}');
});

test("Connect preference changes can be observed from another tab", () => {
  const events: StorageEvent[] = [];
  const listeners = new Set<(event: StorageEvent) => void>();
  const target = {
    addEventListener: (_type: "storage", listener: (event: StorageEvent) => void) => listeners.add(listener),
    removeEventListener: (_type: "storage", listener: (event: StorageEvent) => void) => listeners.delete(listener),
  };
  const unsubscribe = subscribeToPreferenceChanges(CONNECTED_TOOLS_KEY, (event) => events.push(event), target);
  const matchingEvent = { key: CONNECTED_TOOLS_KEY } as StorageEvent;
  const unrelatedEvent = { key: "duka-onboarding-profile" } as StorageEvent;

  listeners.forEach((listener) => listener(unrelatedEvent));
  assert.deepEqual(events, []);
  listeners.forEach((listener) => listener(matchingEvent));
  assert.deepEqual(events, [matchingEvent]);

  unsubscribe();
  listeners.forEach((listener) => listener(matchingEvent));
  assert.deepEqual(events, [matchingEvent]);
});

test("Connect updates tiles and saved summary when another tab changes preferences", async () => {
  const dom = new JSDOM("<!doctype html><html><body><div id=\"root\"></div></body></html>", {
    url: "http://localhost/connect",
  });
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    HTMLElement: dom.window.HTMLElement,
    addEventListener: dom.window.addEventListener.bind(dom.window),
    removeEventListener: dom.window.removeEventListener.bind(dom.window),
  });
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: dom.window.navigator,
  });
  Object.defineProperty(globalThis, "location", {
    configurable: true,
    value: dom.window.location,
  });
  Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
    configurable: true,
    value: true,
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ status: "ok" }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

  const { act } = await import("react");
  const { createRoot } = await import("react-dom/client");
  const container = dom.window.document.getElementById("root")!;
  const root = createRoot(container);
  await act(async () => {
    root.render(createElement(
      QueryClientProvider,
      {
        client: new QueryClient(),
        children: createElement(
          Router,
          {
            hook: () => ["/connect", (_path: string, ..._args: any[]) => undefined] as [string, (path: string, ...args: any[]) => any],
            children: createElement(Connect),
          },
        ),
      },
    ));
  });

  const tool = container.querySelector<HTMLButtonElement>('[data-testid="button-connect-whatsapp"]');
  assert.ok(tool, "Expected the WhatsApp preference control to be present");
  assert.equal(tool.getAttribute("aria-pressed"), "false");
  assert.match(container.textContent ?? "", /No tool preferences yet/);

  await act(async () => {
    dom.window.localStorage.setItem(CONNECTED_TOOLS_KEY, JSON.stringify(["WhatsApp"]));
    dom.window.dispatchEvent(new dom.window.StorageEvent("storage", {
      key: CONNECTED_TOOLS_KEY,
      newValue: JSON.stringify(["WhatsApp"]),
      storageArea: dom.window.localStorage,
    }));
  });
  assert.equal(tool.getAttribute("aria-pressed"), "true");
  assert.match(tool.textContent ?? "", /Saved preference/);
  assert.match(container.textContent ?? "", /1 tool preference saved/);

  await act(async () => {
    dom.window.localStorage.removeItem(CONNECTED_TOOLS_KEY);
    dom.window.dispatchEvent(new dom.window.StorageEvent("storage", {
      key: CONNECTED_TOOLS_KEY,
      oldValue: JSON.stringify(["WhatsApp"]),
      storageArea: dom.window.localStorage,
    }));
  });
  assert.equal(tool.getAttribute("aria-pressed"), "false");
  assert.match(tool.textContent ?? "", /Not saved/);
  assert.match(container.textContent ?? "", /No tool preferences yet/);

  await act(async () => {
    root.unmount();
  });
  globalThis.fetch = originalFetch;
  dom.window.close();
});

test("Connect clear-all keeps every tile and summary empty after a remount", async () => {
  const dom = new JSDOM("<!doctype html><html><body><div id=\"root\"></div></body></html>", {
    url: "http://localhost/connect",
  });
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    HTMLElement: dom.window.HTMLElement,
    addEventListener: dom.window.addEventListener.bind(dom.window),
    removeEventListener: dom.window.removeEventListener.bind(dom.window),
  });
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: dom.window.navigator,
  });
  Object.defineProperty(globalThis, "location", {
    configurable: true,
    value: dom.window.location,
  });
  Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
    configurable: true,
    value: true,
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ status: "ok" }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

  const { act } = await import("react");
  const { createRoot } = await import("react-dom/client");
  const container = dom.window.document.getElementById("root")!;
  const root = createRoot(container);
  const renderConnect = () => createElement(
    QueryClientProvider,
    {
      client: new QueryClient(),
      children: createElement(
        Router,
        {
          hook: () => ["/connect", (_path: string, ..._args: any[]) => undefined] as [string, (path: string, ...args: any[]) => any],
          children: createElement(Connect),
        },
      ),
    },
  );
  const assertEmptyConnect = () => {
    for (const name of CONNECTED_TOOL_NAMES) {
      const testId = `button-connect-${name.toLowerCase().replaceAll(" ", "-")}`;
      const tile = container.querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`);
      assert.ok(tile, `Expected the ${name} preference control to be present`);
      assert.equal(tile.getAttribute("aria-pressed"), "false", `${name} should not be saved`);
      assert.match(tile.textContent ?? "", /Not saved/);
      assert.match(tile.getAttribute("aria-label") ?? "", /not saved/i);
    }
    assert.match(container.textContent ?? "", /No tool preferences yet/);
    assert.equal(
      container.querySelector<HTMLButtonElement>('[data-testid="button-clear-connected-tools"]')?.disabled,
      true,
    );
  };

  try {
    await act(async () => {
      root.render(renderConnect());
    });

    for (const name of CONNECTED_TOOL_NAMES.slice(0, 3)) {
      const testId = `button-connect-${name.toLowerCase().replaceAll(" ", "-")}`;
      const tile = container.querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`);
      assert.ok(tile, `Expected the ${name} preference control to be present`);
      await act(async () => {
        tile.click();
      });
    }

    assert.deepEqual(
      readConnectedTools(dom.window.localStorage),
      CONNECTED_TOOL_NAMES.slice(0, 3),
    );
    assert.match(container.textContent ?? "", /3 tool preferences saved/);

    const clearButton = container.querySelector<HTMLButtonElement>('[data-testid="button-clear-connected-tools"]');
    assert.ok(clearButton, "Expected the clear-all control to be present");
    await act(async () => {
      clearButton.click();
    });

    assert.equal(dom.window.localStorage.getItem(CONNECTED_TOOLS_KEY), null);
    assertEmptyConnect();

    await act(async () => {
      root.unmount();
    });
    const remountedRoot = createRoot(container);
    await act(async () => {
      remountedRoot.render(renderConnect());
    });

    assertEmptyConnect();
    await act(async () => {
      remountedRoot.unmount();
    });
  } finally {
    globalThis.fetch = originalFetch;
    dom.window.close();
  }
});

test("Connect ignores malformed saved preferences and returns to the non-saved state", () => {
  const storages: Array<{
    getItem: (key: string) => string | null;
    setItem: (key: string, value: string) => void;
  }> = [
    {
      getItem: () => "{not valid json",
      setItem: () => undefined,
    },
    {
      getItem: () => '["WhatsApp", 42]',
      setItem: () => undefined,
    },
  ];

  for (const storage of storages) {
    const connected: string[] = readConnectedTools(storage);
    const hasWhatsApp = connected.includes("WhatsApp");
    assert.deepEqual(connected, []);
    assert.equal(connectPreferenceLabel(hasWhatsApp), "Not saved");
    assert.equal(
      connectPreferenceAriaLabel("WhatsApp", hasWhatsApp),
      "WhatsApp, not saved. Select to save this preference.",
    );
    assert.doesNotMatch(
      connectPreferenceAriaLabel("WhatsApp", hasWhatsApp),
      /authoriz|connect/i,
    );
  }
});

test("Connect stays available when saved preference storage cannot be read", () => {
  const unavailableStorage = {
    getItem: () => {
      throw new Error("Storage access is unavailable");
    },
    setItem: () => undefined,
  };

  assert.doesNotThrow(() => readConnectedTools(unavailableStorage));
  assert.deepEqual(readConnectedTools(unavailableStorage), []);
  assert.deepEqual(readConnectedTools(null), []);
  assert.equal(connectPreferenceLabel(false), "Not saved");
  assert.doesNotMatch(connectPreferenceAriaLabel("WhatsApp", false), /authoriz|connect/i);
});

test("Connect keeps temporary choices visible when preference storage cannot save", async () => {
  const dom = new JSDOM("<!doctype html><html><body><div id=\"root\"></div></body></html>", {
    url: "http://localhost/connect",
  });
  let writeAttempts = 0;
  const storage = {
    getItem: () => null,
    setItem: () => {
      writeAttempts += 1;
      throw new Error("Storage writes are blocked");
    },
  };
  Object.defineProperty(dom.window, "localStorage", {
    configurable: true,
    value: storage,
  });
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    HTMLElement: dom.window.HTMLElement,
    addEventListener: dom.window.addEventListener.bind(dom.window),
    removeEventListener: dom.window.removeEventListener.bind(dom.window),
  });
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: dom.window.navigator,
  });
  Object.defineProperty(globalThis, "location", {
    configurable: true,
    value: dom.window.location,
  });
  Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
    configurable: true,
    value: true,
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ status: "ok" }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

  const { act } = await import("react");
  const { createRoot } = await import("react-dom/client");
  const container = dom.window.document.getElementById("root")!;
  const root = createRoot(container);
  await act(async () => {
    root.render(createElement(
      QueryClientProvider,
      {
        client: new QueryClient(),
        children: createElement(
          Router,
          {
            hook: () => ["/connect", (_path: string, ..._args: any[]) => undefined] as [string, (path: string, ...args: any[]) => any],
            children: createElement(Connect),
          },
        ),
      },
    ));
  });

  const tool = container.querySelector<HTMLButtonElement>('[data-testid="button-connect-whatsapp"]');
  assert.ok(tool, "Expected the WhatsApp preference control to be present");
  assert.equal(tool.getAttribute("aria-pressed"), "false");
  assert.match(tool.getAttribute("aria-label") ?? "", /not saved/i);
  assert.doesNotMatch(tool.getAttribute("aria-label") ?? "", /authoriz|connect/i);

  await act(async () => {
    tool.click();
  });
  assert.equal(writeAttempts, 1);
  assert.equal(tool.getAttribute("aria-pressed"), "true");
  assert.match(tool.textContent ?? "", /Saved preference/);
  assert.match(tool.getAttribute("aria-label") ?? "", /saved preference/i);
  assert.doesNotMatch(tool.getAttribute("aria-label") ?? "", /authoriz|connect/i);

  await act(async () => {
    tool.click();
  });
  assert.equal(writeAttempts, 2);
  assert.equal(tool.getAttribute("aria-pressed"), "false");
  assert.match(tool.textContent ?? "", /Not saved/);
  assert.match(tool.getAttribute("aria-label") ?? "", /not saved/i);
  assert.doesNotMatch(tool.getAttribute("aria-label") ?? "", /authoriz|connect/i);

  await act(async () => {
    root.unmount();
  });
  globalThis.fetch = originalFetch;
  dom.window.close();
});

test("names the mobile menu in both closed and open states", () => {
  const closedMarkup = renderToStaticMarkup(
    createElement(MobileMenuButton, { open: false, onClick: () => undefined }),
  );
  assert.match(closedMarkup, /aria-label="Open navigation menu"/);
  assert.match(closedMarkup, /aria-expanded="false"/);
  assert.match(closedMarkup, /aria-hidden="true"/);

  const openMarkup = renderToStaticMarkup(
    createElement(MobileMenuButton, { open: true, onClick: () => undefined }),
  );
  assert.match(openMarkup, /aria-label="Close navigation menu"/);
  assert.match(openMarkup, /aria-expanded="true"/);
  assert.match(openMarkup, /aria-hidden="true"/);
});

test("completes onboarding with keyboard-only focus, activation, and saved channels", async () => {
  const dom = new JSDOM("<!doctype html><html><body><div id=\"root\"></div></body></html>", {
    url: "http://localhost/onboarding",
  });
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    HTMLElement: dom.window.HTMLElement,
    HTMLInputElement: dom.window.HTMLInputElement,
    HTMLTextAreaElement: dom.window.HTMLTextAreaElement,
    KeyboardEvent: dom.window.KeyboardEvent,
    Event: dom.window.Event,
    addEventListener: dom.window.addEventListener.bind(dom.window),
    removeEventListener: dom.window.removeEventListener.bind(dom.window),
  });
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: dom.window.navigator,
  });
  Object.defineProperty(globalThis, "location", {
    configurable: true,
    value: dom.window.location,
  });
  Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
    configurable: true,
    value: true,
  });

  const { act } = await import("react");
  const { createRoot } = await import("react-dom/client");
  const container = dom.window.document.getElementById("root")!;
  const root = createRoot(container);
  await act(async () => {
    root.render(createElement(Router, null, createElement(Onboarding)));
  });

  const get = <T extends HTMLElement>(testId: string) => {
    const element = container.querySelector<T>(`[data-testid="${testId}"]`);
    assert.ok(element, `Expected ${testId} to be present`);
    return element;
  };
  const focusable = () =>
    [...container.querySelectorAll<HTMLElement>(
      "a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])",
    )];
  const tab = async () => {
    const controls = focusable();
    const current = dom.window.document.activeElement;
    const nextIndex = controls.indexOf(current as HTMLElement) + 1;
    const next = controls[nextIndex] ?? controls[0];
    await act(async () => {
      next?.focus();
      next?.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
      next?.dispatchEvent(new dom.window.KeyboardEvent("keyup", { key: "Tab", bubbles: true }));
    });
    assert.equal(dom.window.document.activeElement, next);
    return next;
  };
  const activate = async (element: HTMLElement, key: "Enter" | " ") => {
    await act(async () => {
      element.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key, bubbles: true }));
      element.dispatchEvent(new dom.window.KeyboardEvent("keyup", { key, bubbles: true }));
      // JSDOM does not perform the browser's default keyboard activation.
      element.click();
    });
  };
  const type = async (element: HTMLInputElement | HTMLTextAreaElement, value: string) => {
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(element.constructor.prototype, "value")?.set;
      setter?.call(element, value);
      element.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
      element.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    });
  };

  dom.window.document.body.tabIndex = -1;
  dom.window.document.body.focus();
  assert.equal((await tab()).getAttribute("data-testid"), "link-onboarding-logo");
  assert.equal((await tab()).getAttribute("data-testid"), "button-skip-onboarding");
  assert.equal((await tab()).getAttribute("data-testid"), "input-onboarding-description");
  const initialContinue = get<HTMLButtonElement>("button-onboarding-continue");
  assert.equal(initialContinue.disabled, true);
  assert.equal(initialContinue.getAttribute("aria-describedby"), "onboarding-continue-guidance");
  assert.equal(container.querySelector('[role="status"]')?.textContent, "Add what you sell and where buyers find you before continuing.");
  assert.equal(container.querySelector('[role="status"]')?.getAttribute("aria-live"), "polite");
  await type(get<HTMLTextAreaElement>("input-onboarding-description"), "Handmade jewellery");
  assert.equal((await tab()).getAttribute("data-testid"), "button-onboarding-back");
  assert.equal((await tab()).getAttribute("data-testid"), "button-onboarding-continue");
  await activate(dom.window.document.activeElement as HTMLElement, "Enter");

  assert.equal(dom.window.document.activeElement?.getAttribute("data-testid"), "input-onboarding-seller-name");
  const nameStepContinue = get<HTMLButtonElement>("button-onboarding-continue");
  assert.equal(nameStepContinue.disabled, true);
  assert.equal(nameStepContinue.getAttribute("aria-describedby"), "onboarding-continue-guidance");
  assert.equal(container.querySelector('[role="status"]')?.textContent, "Add your name and business or shop name before continuing.");
  await type(get<HTMLInputElement>("input-onboarding-seller-name"), "Amina Mensah");
  assert.equal((await tab()).getAttribute("id"), "onboarding-business-name");
  const businessName = container.querySelector<HTMLInputElement>("#onboarding-business-name");
  assert.ok(businessName, "Expected onboarding-business-name to be present");
  await type(businessName, "The Sunday Edit");
  assert.equal((await tab()).getAttribute("data-testid"), "button-onboarding-back");
  assert.equal((await tab()).getAttribute("data-testid"), "button-onboarding-continue");
  await activate(dom.window.document.activeElement as HTMLElement, "Enter");

  dom.window.document.body.focus();
  assert.equal((await tab()).getAttribute("data-testid"), "link-onboarding-logo");
  assert.equal((await tab()).getAttribute("data-testid"), "button-skip-onboarding");
  const selectedChannels = ["WhatsApp", "Instagram"];
  for (const channel of onboardingChannels) {
    const inputTestId = `input-onboarding-channel-${channel.toLowerCase().replaceAll(" ", "-")}`;
    const channelInput = await tab();
    assert.equal(channelInput.getAttribute("data-testid"), inputTestId);
    if (selectedChannels.includes(channel)) await activate(channelInput, " ");
  }
  assert.equal((await tab()).getAttribute("data-testid"), "button-onboarding-back");
  assert.equal((await tab()).getAttribute("data-testid"), "button-onboarding-continue");
  await activate(dom.window.document.activeElement as HTMLElement, "Enter");
  await act(async () => {});

  assert.match(container.textContent ?? "", /Setup complete/);
  assert.equal(dom.window.localStorage.getItem("duka-onboarding-complete"), "true");
  assert.deepEqual(
    JSON.parse(dom.window.localStorage.getItem("duka-onboarding-profile") ?? "{}").channels,
    selectedChannels,
  );
  await act(async () => {
    root.unmount();
  });
  dom.window.close();
});

test("resumes incomplete onboarding at the saved step with editable profile data", async () => {
  const dom = new JSDOM("<!doctype html><html><body><div id=\"root\"></div></body></html>", {
    url: "http://localhost/onboarding",
  });
  dom.window.localStorage.setItem("duka-onboarding-step", "2");
  dom.window.localStorage.setItem("duka-onboarding-profile", JSON.stringify({
    sellerName: "Amina Mensah",
    businessName: "The Sunday Edit",
    description: "Handmade jewellery",
    channels: ["WhatsApp", "Instagram"],
  }));
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    HTMLElement: dom.window.HTMLElement,
    HTMLInputElement: dom.window.HTMLInputElement,
    HTMLTextAreaElement: dom.window.HTMLTextAreaElement,
    addEventListener: dom.window.addEventListener.bind(dom.window),
    removeEventListener: dom.window.removeEventListener.bind(dom.window),
  });
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: dom.window.navigator,
  });
  Object.defineProperty(globalThis, "location", {
    configurable: true,
    value: dom.window.location,
  });
  Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
    configurable: true,
    value: true,
  });

  const { act } = await import("react");
  const { createRoot } = await import("react-dom/client");
  const container = dom.window.document.getElementById("root")!;
  const root = createRoot(container);
  await act(async () => {
    root.render(createElement(Router, null, createElement(Onboarding)));
  });

  assert.match(container.textContent ?? "", /Where do you usually sell\?/);
  assert.equal(
    (container.querySelector('[data-testid="input-onboarding-channel-whatsapp"]') as HTMLInputElement).checked,
    true,
  );
  assert.equal(
    (container.querySelector('[data-testid="input-onboarding-channel-instagram"]') as HTMLInputElement).checked,
    true,
  );
  const otherInput = container.querySelector<HTMLInputElement>('[data-testid="input-onboarding-channel-other"]');
  assert.ok(otherInput, "Expected Other channel input to be present");
  await act(async () => {
    otherInput.click();
  });
  assert.equal(otherInput.checked, true);
  assert.deepEqual(
    JSON.parse(dom.window.localStorage.getItem("duka-onboarding-profile") ?? "{}").channels,
    ["WhatsApp", "Instagram", "Other"],
  );

  await act(async () => {
    root.unmount();
  });
  dom.window.close();
});

test("persists onboarding fields and step changes across forward and backward reloads", async () => {
  const dom = new JSDOM("<!doctype html><html><body><div id=\"root\"></div></body></html>", {
    url: "http://localhost/onboarding",
  });
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    HTMLElement: dom.window.HTMLElement,
    HTMLInputElement: dom.window.HTMLInputElement,
    HTMLTextAreaElement: dom.window.HTMLTextAreaElement,
    addEventListener: dom.window.addEventListener.bind(dom.window),
    removeEventListener: dom.window.removeEventListener.bind(dom.window),
  });
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: dom.window.navigator,
  });
  Object.defineProperty(globalThis, "location", {
    configurable: true,
    value: dom.window.location,
  });
  Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
    configurable: true,
    value: true,
  });

  const { act } = await import("react");
  const { createRoot } = await import("react-dom/client");
  const container = dom.window.document.getElementById("root")!;
  let root = createRoot(container);
  const render = async () => {
    await act(async () => {
      root.render(createElement(Router, null, createElement(Onboarding)));
    });
  };
  const reload = async () => {
    await act(async () => {
      root.unmount();
    });
    root = createRoot(container);
    await render();
  };
  const get = <T extends HTMLElement>(testId: string) => {
    const element = container.querySelector<T>(`[data-testid="${testId}"]`);
    assert.ok(element, `Expected ${testId} to be present`);
    return element;
  };
  const setValue = async (element: HTMLInputElement | HTMLTextAreaElement, value: string) => {
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(element.constructor.prototype, "value")?.set;
      setter?.call(element, value);
      element.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
      element.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    });
  };
  const click = async (testId: string) => {
    await act(async () => {
      get<HTMLButtonElement>(testId).click();
    });
  };
  const savedProfile = () => JSON.parse(dom.window.localStorage.getItem("duka-onboarding-profile") ?? "{}") as {
    sellerName?: string;
    businessName?: string;
    description?: string;
    channels?: string[];
  };

  try {
    await render();
    await setValue(get<HTMLTextAreaElement>("input-onboarding-description"), "Handmade jewellery");
    await click("button-onboarding-continue");
    assert.equal(dom.window.localStorage.getItem("duka-onboarding-step"), "1");
    assert.equal(savedProfile().description, "Handmade jewellery");

    await reload();
    assert.ok(get<HTMLInputElement>("input-onboarding-seller-name"));
    await setValue(get<HTMLInputElement>("input-onboarding-seller-name"), "Amina Mensah");
    await setValue(get<HTMLInputElement>("input-onboarding-business-name"), "The Sunday Edit");
    await click("button-onboarding-continue");
    assert.equal(dom.window.localStorage.getItem("duka-onboarding-step"), "2");
    assert.deepEqual(savedProfile(), {
      sellerName: "Amina Mensah",
      businessName: "The Sunday Edit",
      description: "Handmade jewellery",
      channels: [],
    });

    await reload();
    const whatsapp = get<HTMLInputElement>("input-onboarding-channel-whatsapp");
    const instagram = get<HTMLInputElement>("input-onboarding-channel-instagram");
    await act(async () => {
      whatsapp.click();
      instagram.click();
    });
    assert.deepEqual(savedProfile().channels, ["WhatsApp", "Instagram"]);

    await click("button-onboarding-back");
    assert.equal(dom.window.localStorage.getItem("duka-onboarding-step"), "1");
    await reload();
    assert.equal(get<HTMLInputElement>("input-onboarding-seller-name").value, "Amina Mensah");
    assert.equal(get<HTMLInputElement>("input-onboarding-business-name").value, "The Sunday Edit");
    await setValue(get<HTMLInputElement>("input-onboarding-seller-name"), "Amina Mensah-Kane");
    await setValue(get<HTMLInputElement>("input-onboarding-business-name"), "Sunday Edit Studio");
    assert.equal(savedProfile().sellerName, "Amina Mensah-Kane");
    assert.equal(savedProfile().businessName, "Sunday Edit Studio");

    await click("button-onboarding-back");
    assert.equal(dom.window.localStorage.getItem("duka-onboarding-step"), "0");
    await reload();
    const description = get<HTMLTextAreaElement>("input-onboarding-description");
    assert.equal(description.value, "Handmade jewellery");
    await setValue(description, "Handmade jewellery through Instagram");
    assert.equal(savedProfile().description, "Handmade jewellery through Instagram");

    await click("button-onboarding-continue");
    await click("button-onboarding-continue");
    await reload();
    assert.equal(dom.window.localStorage.getItem("duka-onboarding-step"), "2");
    const reloadedWhatsapp = get<HTMLInputElement>("input-onboarding-channel-whatsapp");
    assert.equal(reloadedWhatsapp.checked, true);
    assert.equal(get<HTMLInputElement>("input-onboarding-channel-instagram").checked, true);
    assert.equal(savedProfile().description, "Handmade jewellery through Instagram");
    await act(async () => {
      reloadedWhatsapp.click();
    });
    assert.equal(reloadedWhatsapp.checked, false);
    assert.deepEqual(savedProfile().channels, ["Instagram"]);
    await act(async () => {
      reloadedWhatsapp.click();
    });
    assert.deepEqual(savedProfile().channels, ["Instagram", "WhatsApp"]);
  } finally {
    await act(async () => {
      root.unmount();
    });
    dom.window.close();
  }
});
