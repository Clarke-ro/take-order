import type { DashboardSummary } from "@workspace/api-client-react";
import { createElement } from "react";

export type AnalyticsViewState = "loading" | "error" | "empty" | "populated";

export function getAnalyticsViewState({
  isLoading,
  isError,
  summary,
}: {
  isLoading: boolean;
  isError: boolean;
  summary: DashboardSummary | undefined;
}): AnalyticsViewState {
  if (isLoading) return "loading";
  if (isError) return "error";
  if (
    summary?.orders ||
    summary?.channelPerformance.length ||
    summary?.productPerformance.some((product) => product.orders > 0)
  ) {
    return "populated";
  }
  return "empty";
}

export function AnalyticsStateMarker({
  state,
}: {
  state: AnalyticsViewState;
}) {
  return createElement("span", {
    "data-testid": `dashboard-analytics-${state}`,
    "data-analytics-state": state,
    "aria-hidden": true,
    className: "sr-only",
  });
}