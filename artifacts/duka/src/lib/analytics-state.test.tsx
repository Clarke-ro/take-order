import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  AnalyticsStateMarker,
  getAnalyticsViewState,
} from "./analytics-state";

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