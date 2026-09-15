import assert from "node:assert/strict";
import test from "node:test";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
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
import { ChannelPicker, MobileMenuButton, OnboardingChannelPicker } from "../App";

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
