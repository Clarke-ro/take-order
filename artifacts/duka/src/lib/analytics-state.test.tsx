import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  AnalyticsStateMarker,
  getAnalyticsViewState,
} from "./analytics-state";
import {
  CONNECTED_TOOL_NAMES,
  CONNECTED_TOOLS_KEY,
  DASHBOARD_PERIOD_KEY,
  CatalogActions,
  ChannelPicker,
  DashboardCustomRangePicker,
  ExpenseActions,
  MobileMenuButton,
  OnboardingChannelPicker,
  SocialChannelStack,
  getChannelConversionView,
  readConnectedTools,
  readDashboardPeriodPreference,
  writeConnectedTools,
  writeDashboardPeriodPreference,
  clearConnectedTools,
} from "../App";
import {
  connectPreferenceAriaLabel,
  connectPreferenceLabel,
  onboardingChannels,
  orderChannels,
  togglePreference,
} from "./channel-preferences";

const emptySummary = {
  orders: 0,
  channelPerformance: [],
  productPerformance: [],
} as never;

const populatedSummary = {
  orders: 3,
  channelPerformance: [],
  productPerformance: [],
} as never;

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
    has: (key: string) => values.has(key),
    value: (key: string) => values.get(key),
  };
}

test("renders analytics state markers for loading, empty, and populated states", () => {
  const cases = [
    { state: "loading", input: { isLoading: true, isError: false, summary: undefined } },
    { state: "empty", input: { isLoading: false, isError: false, summary: emptySummary } },
    { state: "populated", input: { isLoading: false, isError: false, summary: populatedSummary } },
  ] as const;

  for (const { state, input } of cases) {
    assert.equal(getAnalyticsViewState(input), state);
    const markup = renderToStaticMarkup(createElement(AnalyticsStateMarker, { state }));
    assert.match(markup, new RegExp(`data-testid="dashboard-analytics-${state}"`));
    assert.match(markup, new RegExp(`data-analytics-state="${state}"`));
  }

  assert.equal(
    getAnalyticsViewState({ isLoading: false, isError: true, summary: populatedSummary }),
    "error",
  );
});

test("aggregates channel conversion data and keeps channel filtering scoped", () => {
  const channels = [
    { channel: "instagram", revenue: 12300, orders: 164, paidOrders: 164, opens: 8240, conversionRate: 2 },
    { channel: "whatsapp", revenue: 6120, orders: 82, paidOrders: 82, opens: 4240, conversionRate: 1.9 },
  ];

  const all = getChannelConversionView(channels);
  assert.deepEqual(all.visibleChannels.map((channel) => channel.channel), ["instagram", "whatsapp"]);
  assert.equal(all.totalViews, 12480);
  assert.equal(all.totalSales, 246);
  assert.equal(all.totalRevenue, 18420);
  assert.equal(all.totalConversion, (246 / 12480) * 100);

  const whatsapp = getChannelConversionView(channels, "whatsapp");
  assert.deepEqual(whatsapp.visibleChannels.map((channel) => channel.channel), ["whatsapp"]);
  assert.equal(whatsapp.totalViews, 4240);
  assert.equal(whatsapp.totalSales, 82);
  assert.equal(whatsapp.totalRevenue, 6120);
});

test("keeps supported order and onboarding channel values stable", () => {
  assert.deepEqual(orderChannels.map((channel) => channel.value), [
    "whatsapp",
    "instagram",
    "tiktok",
    "snapchat",
    "in_person",
  ]);
  assert.ok(onboardingChannels.length >= 5);

  let selected: string[] = [];
  for (const channel of orderChannels.map((item) => item.value)) {
    selected = togglePreference(selected, channel);
    assert.ok(selected.includes(channel));
    selected = togglePreference(selected, channel);
    assert.ok(!selected.includes(channel));
  }
});

test("renders channel pickers with synchronized selected state", () => {
  const selectedValue = orderChannels[2]!.value;
  const markup = renderToStaticMarkup(createElement(ChannelPicker, {
    value: selectedValue,
    onChange: () => undefined,
    testId: "order-channel",
  }));

  for (const channel of orderChannels) {
    assert.match(
      markup,
      new RegExp(`aria-label="${channel.label}" aria-checked="${channel.value === selectedValue}"`),
    );
    assert.match(markup, new RegExp(`data-testid="order-channel-${channel.value}"`));
  }
});

test("renders social channel marks accessibly without exceeding four", () => {
  const markup = renderToStaticMarkup(createElement(SocialChannelStack, {
    channels: ["WhatsApp", "Instagram", "TikTok", "Snapchat", "Facebook Ads"],
  }));
  assert.match(markup, /role="img"/);
  assert.match(markup, /Active social channels: WhatsApp, Instagram, TikTok, Snapchat/);
  assert.equal((markup.match(/metric-channel-stack-mark/g) ?? []).length, 4);
});

test("keeps mobile navigation and action controls named", () => {
  const closed = renderToStaticMarkup(createElement(MobileMenuButton, {
    open: false,
    onClick: () => undefined,
  }));
  const open = renderToStaticMarkup(createElement(MobileMenuButton, {
    open: true,
    onClick: () => undefined,
  }));
  assert.match(closed, /aria-label="Open navigation menu"/);
  assert.match(closed, /aria-expanded="false"/);
  assert.match(open, /aria-label="Close navigation menu"/);
  assert.match(open, /aria-expanded="true"/);

  const catalog = renderToStaticMarkup(createElement(CatalogActions, {
    productId: 12,
    productName: "Linen shirt",
    onEdit: () => undefined,
    onDelete: () => undefined,
  }));
  assert.match(catalog, /aria-label="Edit Linen shirt"/);
  assert.match(catalog, /aria-label="Delete Linen shirt"/);

  const expense = renderToStaticMarkup(createElement(ExpenseActions, {
    expenseId: 8,
    expenseTitle: "Studio rent",
    onEdit: () => undefined,
    onDelete: () => undefined,
  }));
  assert.match(expense, /aria-label="Edit Studio rent"/);
  assert.match(expense, /aria-label="Delete Studio rent"/);
});

test("onboarding channel tiles expose checkbox state", () => {
  const markup = renderToStaticMarkup(createElement(OnboardingChannelPicker, {
    selectedChannels: [onboardingChannels[0]!],
    onToggle: () => undefined,
  }));
  assert.match(markup, /data-testid="onboarding-channels"/);
  assert.match(markup, new RegExp(`aria-label="${onboardingChannels[0]}"`));
});

test("persists and clears connected tool preferences without leaking unknown tools", () => {
  const storage = memoryStorage({
    [CONNECTED_TOOLS_KEY]: JSON.stringify(["WhatsApp", "Legacy Messenger", "WhatsApp"]),
  });
  assert.deepEqual(readConnectedTools(storage), ["WhatsApp"]);

  writeConnectedTools(["WhatsApp", "Paystack", "Removed Tool"], storage);
  assert.equal(storage.value(CONNECTED_TOOLS_KEY), JSON.stringify(["WhatsApp", "Paystack"]));
  assert.deepEqual(readConnectedTools(storage), ["WhatsApp", "Paystack"]);
  assert.equal(connectPreferenceLabel(true), "Saved preference");
  assert.equal(connectPreferenceLabel(false), "Not saved");
  assert.match(connectPreferenceAriaLabel("Paystack", true), /saved preference/i);
  assert.doesNotMatch(connectPreferenceAriaLabel("Paystack", true), /authoriz|integrat/i);

  clearConnectedTools(storage);
  assert.equal(storage.has(CONNECTED_TOOLS_KEY), false);
  assert.deepEqual(readConnectedTools(storage), []);
  assert.deepEqual(CONNECTED_TOOL_NAMES.slice(0, 2), ["WhatsApp", "Instagram"]);
});

test("accepts only valid dashboard period preferences", () => {
  const storage = memoryStorage();
  writeDashboardPeriodPreference({
    period: "custom",
    customFrom: "2026-09-01",
    customTo: "2026-09-15",
  }, storage);
  assert.deepEqual(readDashboardPeriodPreference(storage), {
    period: "custom",
    customFrom: "2026-09-01",
    customTo: "2026-09-15",
  });

  for (const invalid of [
    "{not valid json",
    JSON.stringify({ period: "custom", customFrom: "2026-09-01" }),
    JSON.stringify({ period: "custom", customFrom: "2026-09-15", customTo: "2026-09-01" }),
    JSON.stringify({ period: "quarter", customFrom: "2026-09-01", customTo: "2026-09-15" }),
  ]) {
    storage.setItem(DASHBOARD_PERIOD_KEY, invalid);
    assert.equal(readDashboardPeriodPreference(storage), null);
  }
});

test("renders a usable custom dashboard range picker", () => {
  const markup = renderToStaticMarkup(createElement(DashboardCustomRangePicker, {
    from: "2026-09-01",
    to: "2026-09-15",
    onFromChange: () => undefined,
    onToChange: () => undefined,
    onClose: () => undefined,
    onApply: () => undefined,
    canApply: true,
  }));
  assert.match(markup, /aria-label="Choose date range"/);
  assert.match(markup, /aria-label="Previous month"/);
  assert.match(markup, /data-testid="button-dashboard-period-close"/);
  assert.match(markup, /data-testid="button-dashboard-period-apply"/);
});