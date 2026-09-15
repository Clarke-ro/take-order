import assert from "node:assert/strict";
import test from "node:test";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";
import {
  AnalyticsStateMarker,
  getAnalyticsViewState,
} from "./analytics-state";
import {
  CONNECTED_TOOLS_KEY,
  readConnectedTools,
  writeConnectedTools,
} from "../App";
import {
  connectPreferenceAriaLabel,
  connectPreferenceLabel,
  onboardingChannels,
  orderChannels,
  togglePreference,
} from "./channel-preferences";
import { ChannelPicker, MobileMenuButton, Onboarding, OnboardingChannelPicker } from "../App";
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
  await type(get<HTMLTextAreaElement>("input-onboarding-description"), "Handmade jewellery");
  assert.equal((await tab()).getAttribute("data-testid"), "button-onboarding-back");
  assert.equal((await tab()).getAttribute("data-testid"), "button-onboarding-continue");
  await activate(dom.window.document.activeElement as HTMLElement, "Enter");

  assert.equal(dom.window.document.activeElement?.getAttribute("data-testid"), "input-onboarding-seller-name");
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
