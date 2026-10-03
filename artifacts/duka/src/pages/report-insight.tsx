import React, { useState, useMemo, useEffect, useRef } from "react";
import { useRoute, useLocation, Link } from "wouter";
import {
  ArrowLeft,
  Calendar,
  ChevronDown,
  Download,
  Info,
  Lock,
  RotateCw,
  SlidersHorizontal,
  Star,
  TrendingDown,
  TrendingUp,
  X,
  Sparkles,
  ArrowUpRight,
  Check,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import { money, moneyExact } from "@/lib/formatters";
import { Skeleton } from "@/components/ui/skeleton";
import {
  REPORT_CATALOG,
  getReportConfig,
  type ReportConfig,
} from "@/lib/report-catalog";
import { readHubState } from "@/components/explore-reports-section";
import { CHANNEL_COLORS } from "@/lib/metrics";

export interface ReportDetailData {
  report: ReportConfig;
  period: {
    from: string;
    to: string;
    compareFrom: string;
    compareTo: string;
    isFairMtd: boolean;
  };
  kpis: Array<{
    id: string;
    label: string;
    value: string | number;
    description: string;
    delta?: number | null;
    isNew?: boolean;
    lowerIsBetter?: boolean;
    format: "currency" | "integer" | "percent";
  }>;
  timeSeries?: Array<{
    date: string;
    label: string;
    current: number;
    comparison: number;
    [key: string]: any;
  }>;
  breakdownList?: Array<{
    id?: string | number;
    name: string;
    value: number;
    count?: number;
    color?: string;
    share: number;
    link?: string;
  }>;
  summaryBullets: string[];
  dataTable?: {
    title?: string;
    headers: string[];
    rows: Array<Array<string | number>>;
  };
  heatmap?: Array<{
    weekday: string;
    hour: number;
    count: number;
    revenue: number;
  }>;
  waterfall?: Array<{
    item: string;
    amount: number;
    type: "positive" | "negative" | "total";
    percentageOfRevenue: number;
  }>;
  calculationNote: string;
  lastUpdated: string;
  // Locked payload fields
  locked?: boolean;
  planRequired?: string;
  message?: string;
  preview?: {
    kpis: Array<{
      id: string;
      label: string;
      value: string | number;
      description: string;
      delta?: number;
      isNew?: boolean;
      format: "currency" | "integer" | "percent";
    }>;
    summaryBullets: string[];
  };
}

export function ReportInsightSkeleton() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-20 rounded-full" />
        <Skeleton className="h-4 w-36" />
      </div>
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Skeleton className="h-9 w-28 rounded-lg" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Skeleton className="h-28 rounded-[12px]" />
        <Skeleton className="h-28 rounded-[12px]" />
        <Skeleton className="h-28 rounded-[12px]" />
        <Skeleton className="h-28 rounded-[12px]" />
      </div>
      <Skeleton className="h-80 rounded-[12px]" />
    </div>
  );
}

export default function ReportInsightPage() {
  const [, params] = useRoute("/analytics/reports/:slug");
  const [, reportsParams] = useRoute("/reports/:slug");
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const slug = params?.slug || reportsParams?.slug || "";
  const reportConfig = useMemo(() => getReportConfig(slug), [slug]);

  // URL query params synchronization
  const searchParams = useMemo(() => {
    if (typeof window === "undefined") return new URLSearchParams();
    return new URLSearchParams(window.location.search);
  }, []);

  const [dateRangeKey, setDateRangeKey] = useState<string>(
    searchParams.get("range") || "30d"
  );
  const [customFrom, setCustomFrom] = useState<string>(
    searchParams.get("from") || ""
  );
  const [customTo, setCustomTo] = useState<string>(
    searchParams.get("to") || ""
  );
  const [compareMode, setCompareMode] = useState<string>(
    searchParams.get("compare") || "previous"
  );
  const [channelFilter, setChannelFilter] = useState<string>(
    searchParams.get("channel") || "all"
  );
  const [paymentFilter, setPaymentFilter] = useState<string>(
    searchParams.get("payment") || "all"
  );
  const [fulfillmentFilter, setFulfillmentFilter] = useState<string>(
    searchParams.get("fulfillment") || "all"
  );

  const [dateMenuOpen, setDateMenuOpen] = useState(false);
  const [compareMenuOpen, setCompareMenuOpen] = useState(false);
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);

  // Sync state back to URL query params
  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams();
    if (dateRangeKey !== "30d") p.set("range", dateRangeKey);
    if (dateRangeKey === "custom" && customFrom) p.set("from", customFrom);
    if (dateRangeKey === "custom" && customTo) p.set("to", customTo);
    if (compareMode !== "previous") p.set("compare", compareMode);
    if (channelFilter !== "all") p.set("channel", channelFilter);
    if (paymentFilter !== "all") p.set("payment", paymentFilter);
    if (fulfillmentFilter !== "all") p.set("fulfillment", fulfillmentFilter);

    const queryStr = p.toString();
    const newUrl = queryStr ? `?${queryStr}` : window.location.pathname;
    window.history.replaceState(null, "", newUrl);
  }, [
    dateRangeKey,
    customFrom,
    customTo,
    compareMode,
    channelFilter,
    paymentFilter,
    fulfillmentFilter,
  ]);

  // Compute date boundaries
  const { from, to } = useMemo(() => {
    const today = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    if (dateRangeKey === "custom" && customFrom && customTo) {
      return { from: customFrom, to: customTo };
    }
    if (dateRangeKey === "7d") {
      const start = new Date(today.getTime() - 6 * 86400000);
      return { from: fmt(start), to: fmt(today) };
    }
    if (dateRangeKey === "90d") {
      const start = new Date(today.getTime() - 89 * 86400000);
      return { from: fmt(start), to: fmt(today) };
    }
    if (dateRangeKey === "this_month") {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      return { from: fmt(start), to: fmt(today) };
    }
    if (dateRangeKey === "last_month") {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const end = new Date(today.getFullYear(), today.getMonth(), 0);
      return { from: fmt(start), to: fmt(end) };
    }
    // Default 30d
    const start = new Date(today.getTime() - 29 * 86400000);
    return { from: fmt(start), to: fmt(today) };
  }, [dateRangeKey, customFrom, customTo]);

  // Query Favorites
  const favoritesQuery = useQuery({
    queryKey: ["analytics-favorites"],
    queryFn: async () => {
      const res = await customFetch<{ favorites: string[] }>(
        "/api/analytics/favorites"
      );
      return res.favorites;
    },
  });

  const isFavorited = (favoritesQuery.data || []).includes(slug);

  const toggleFavoriteMutation = useMutation({
    mutationFn: async () => {
      const res = await customFetch<{ favorited: boolean; favorites: string[] }>(
        `/api/analytics/favorites/${slug}/toggle`,
        { method: "POST" }
      );
      return res;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["analytics-favorites"], data.favorites);
    },
  });

  // Query Report Detail Data
  const reportQuery = useQuery({
    queryKey: [
      "report-detail",
      slug,
      from,
      to,
      compareMode,
      channelFilter,
      paymentFilter,
      fulfillmentFilter,
    ],
    queryFn: async () => {
      const p = new URLSearchParams();
      if (from) p.set("from", from);
      if (to) p.set("to", to);
      if (channelFilter !== "all") p.set("channel", channelFilter);
      if (paymentFilter !== "all") p.set("paymentMode", paymentFilter);
      if (fulfillmentFilter !== "all") p.set("fulfillment", fulfillmentFilter);

      try {
        return await customFetch<ReportDetailData>(
          `/api/analytics/reports/${slug}?${p.toString()}`
        );
      } catch (err: any) {
        if (err.status === 403 && err.data?.locked) {
          return err.data as ReportDetailData;
        }
        throw err;
      }
    },
    enabled: Boolean(slug && reportConfig),
  });

  // Freshness calculation
  const [nowTimestamp, setNowTimestamp] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNowTimestamp(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);

  const freshnessLabel = useMemo(() => {
    if (!reportQuery.dataUpdatedAt) return "Updated just now";
    const diffSec = Math.floor((nowTimestamp - reportQuery.dataUpdatedAt) / 1000);
    if (diffSec < 45) return "Updated just now";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin === 1) return "Updated 1 min ago";
    if (diffMin < 60) return `Updated ${diffMin} min ago`;
    const diffHours = Math.floor(diffMin / 60);
    return `Updated ${diffHours}h ago`;
  }, [reportQuery.dataUpdatedAt, nowTimestamp]);

  // Back Button Navigation
  const handleBack = () => {
    readHubState();
    setLocation("/analytics");
  };

  // CSV Export
  const handleExport = () => {
    if (reportQuery.data?.locked) return;
    const p = new URLSearchParams();
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    if (channelFilter !== "all") p.set("channel", channelFilter);
    window.location.href = `/api/analytics/reports/${slug}/export?${p.toString()}`;
  };

  if (!reportConfig) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-4">
        <h2 className="text-xl font-bold text-[hsl(var(--foreground))]">
          Report Not Found
        </h2>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          The requested report "{slug}" does not exist in the Take Order catalog.
        </p>
        <button
          type="button"
          onClick={() => setLocation("/analytics")}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-neutral-900 text-white text-xs font-semibold hover:bg-neutral-800 transition"
        >
          <ArrowLeft size={14} />
          <span>Back to Analytics Hub</span>
        </button>
      </div>
    );
  }

  const isLocked = reportQuery.data?.locked === true;
  const data = reportQuery.data;

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-20">
      {/* ── Top Navigation Row: Back Button + Breadcrumbs ── */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-[hsl(var(--border))] bg-white text-xs font-semibold text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition cursor-pointer shadow-2xs dark:bg-neutral-900"
        >
          <ArrowLeft size={13} />
          <span>Back</span>
        </button>
        <div className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
          <Link
            href="/analytics"
            className="hover:text-[hsl(var(--foreground))] transition"
          >
            All reports
          </Link>
          <span>·</span>
          <span className="font-semibold text-[hsl(var(--foreground))] truncate max-w-[200px] sm:max-w-none">
            {reportConfig.title}
          </span>
        </div>
      </div>

      {/* ── Title Row: Title + Star + Subtitle + Freshness ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[hsl(var(--foreground))]">
              {reportConfig.title}
            </h1>
            <button
              type="button"
              onClick={() => toggleFavoriteMutation.mutate()}
              disabled={toggleFavoriteMutation.isPending}
              aria-label={isFavorited ? "Remove from favorites" : "Add to favorites"}
              className="p-1.5 rounded-full hover:bg-[hsl(var(--muted))] transition cursor-pointer text-neutral-400 hover:text-amber-500"
            >
              <Star
                size={20}
                className={cn(
                  "transition-colors",
                  isFavorited
                    ? "fill-amber-400 text-amber-500"
                    : "text-neutral-400"
                )}
              />
            </button>
            {reportConfig.minPlan === "pro" && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                Pro
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-[hsl(var(--muted-foreground))] mt-1 max-w-2xl">
            {reportConfig.description}
          </p>
          <div className="flex items-center gap-2 mt-2 text-[11px] text-[hsl(var(--muted-foreground))]">
            <span>{freshnessLabel}</span>
            <button
              type="button"
              onClick={() => reportQuery.refetch()}
              disabled={reportQuery.isFetching}
              title="Refresh report data"
              className="p-1 rounded hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition cursor-pointer"
            >
              <RotateCw
                size={11}
                className={cn(reportQuery.isFetching && "animate-spin")}
              />
            </button>
          </div>
        </div>

        {/* Export CSV Button */}
        <div className="shrink-0">
          <button
            type="button"
            onClick={handleExport}
            disabled={isLocked || reportQuery.isLoading}
            className={cn(
              "inline-flex items-center gap-2 h-9 px-3.5 rounded-lg border border-[hsl(var(--border))] text-xs font-semibold transition cursor-pointer shadow-2xs",
              isLocked
                ? "opacity-50 cursor-not-allowed bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"
                : "bg-white text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] dark:bg-neutral-900"
            )}
          >
            <Download size={13} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* ── Filter Row: Pill Controls + Popover ── */}
      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[hsl(var(--border))]">
        {/* Date Range Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setDateMenuOpen((o) => !o);
              setCompareMenuOpen(false);
              setFilterMenuOpen(false);
            }}
            className="inline-flex items-center gap-2 h-8 px-3 rounded-full border border-[hsl(var(--border))] bg-white text-xs font-medium text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition cursor-pointer dark:bg-neutral-900"
          >
            <Calendar size={12} className="text-[hsl(var(--muted-foreground))]" />
            <span>
              {dateRangeKey === "7d"
                ? "Last 7 days"
                : dateRangeKey === "30d"
                ? "Last 30 days"
                : dateRangeKey === "90d"
                ? "Last 90 days"
                : dateRangeKey === "this_month"
                ? "This month"
                : dateRangeKey === "last_month"
                ? "Last month"
                : `${from} to ${to}`}
            </span>
            <ChevronDown size={11} className="text-[hsl(var(--muted-foreground))]" />
          </button>

          {dateMenuOpen && (
            <div className="absolute left-0 top-full mt-2 z-50 min-w-[200px] rounded-xl border border-[hsl(var(--border))] bg-white p-2 shadow-xl dark:bg-neutral-950">
              {[
                { key: "7d", label: "Last 7 days" },
                { key: "30d", label: "Last 30 days" },
                { key: "90d", label: "Last 90 days" },
                { key: "this_month", label: "This month" },
                { key: "last_month", label: "Last month" },
              ].map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => {
                    setDateRangeKey(opt.key);
                    setDateMenuOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2 text-xs rounded-lg text-left transition cursor-pointer",
                    dateRangeKey === opt.key
                      ? "bg-neutral-900 text-white font-semibold dark:bg-white dark:text-neutral-900"
                      : "text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-900"
                  )}
                >
                  <span>{opt.label}</span>
                  {dateRangeKey === opt.key && <Check size={12} />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Compare To Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setCompareMenuOpen((o) => !o);
              setDateMenuOpen(false);
              setFilterMenuOpen(false);
            }}
            className="inline-flex items-center gap-2 h-8 px-3 rounded-full border border-[hsl(var(--border))] bg-white text-xs font-medium text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition cursor-pointer dark:bg-neutral-900"
          >
            <span className="text-[hsl(var(--muted-foreground))]">Compare to:</span>
            <span className="font-semibold">
              {compareMode === "previous"
                ? "Previous period"
                : compareMode === "same_month"
                ? "Same period last month"
                : "Off"}
            </span>
            <ChevronDown size={11} className="text-[hsl(var(--muted-foreground))]" />
          </button>

          {compareMenuOpen && (
            <div className="absolute left-0 top-full mt-2 z-50 min-w-[210px] rounded-xl border border-[hsl(var(--border))] bg-white p-2 shadow-xl dark:bg-neutral-950">
              {[
                { key: "previous", label: "Previous period" },
                { key: "same_month", label: "Same period last month" },
                { key: "off", label: "Off" },
              ].map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => {
                    setCompareMode(opt.key);
                    setCompareMenuOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2 text-xs rounded-lg text-left transition cursor-pointer",
                    compareMode === opt.key
                      ? "bg-neutral-900 text-white font-semibold dark:bg-white dark:text-neutral-900"
                      : "text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-900"
                  )}
                >
                  <span>{opt.label}</span>
                  {compareMode === opt.key && <Check size={12} />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Filters Popover */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setFilterMenuOpen((o) => !o);
              setDateMenuOpen(false);
              setCompareMenuOpen(false);
            }}
            className={cn(
              "inline-flex items-center gap-1.5 h-8 px-3 rounded-full border text-xs font-medium transition cursor-pointer",
              channelFilter !== "all" ||
                paymentFilter !== "all" ||
                fulfillmentFilter !== "all"
                ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900"
                : "border-[hsl(var(--border))] bg-white text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] dark:bg-neutral-900"
            )}
          >
            <SlidersHorizontal size={12} />
            <span>Filters</span>
          </button>

          {filterMenuOpen && (
            <div className="absolute left-0 top-full mt-2 z-50 w-72 rounded-xl border border-[hsl(var(--border))] bg-white p-4 shadow-xl space-y-3 dark:bg-neutral-950">
              <div className="flex items-center justify-between pb-2 border-b border-[hsl(var(--border))]">
                <span className="text-xs font-bold text-[hsl(var(--foreground))]">
                  Filter Dimensions
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setChannelFilter("all");
                    setPaymentFilter("all");
                    setFulfillmentFilter("all");
                  }}
                  className="text-[11px] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                >
                  Reset
                </button>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[hsl(var(--muted-foreground))] mb-1">
                  Sales Channel
                </label>
                <select
                  value={channelFilter}
                  onChange={(e) => setChannelFilter(e.target.value)}
                  className="w-full h-8 px-2 rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--card))] text-xs"
                >
                  <option value="all">All Channels</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="instagram">Instagram</option>
                  <option value="tiktok">TikTok</option>
                  <option value="facebook">Facebook</option>
                  <option value="manual">Manual</option>
                  <option value="web">Web Store</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[hsl(var(--muted-foreground))] mb-1">
                  Payment Status
                </label>
                <select
                  value={paymentFilter}
                  onChange={(e) => setPaymentFilter(e.target.value)}
                  className="w-full h-8 px-2 rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--card))] text-xs"
                >
                  <option value="all">All Payment Statuses</option>
                  <option value="paid">Paid</option>
                  <option value="pending">Pending</option>
                  <option value="partial">Deposit / Partial</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[hsl(var(--muted-foreground))] mb-1">
                  Fulfillment Status
                </label>
                <select
                  value={fulfillmentFilter}
                  onChange={(e) => setFulfillmentFilter(e.target.value)}
                  className="w-full h-8 px-2 rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--card))] text-xs"
                >
                  <option value="all">All Fulfillments</option>
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="delivered">Delivered</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setFilterMenuOpen(false)}
                  className="w-full py-1.5 rounded-lg bg-neutral-900 text-white text-xs font-semibold hover:bg-neutral-800 transition dark:bg-white dark:text-neutral-900"
                >
                  Apply Filters
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Removable Active Filter Chips */}
        {channelFilter !== "all" && (
          <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-neutral-100 text-[11px] font-medium text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200">
            Channel: {channelFilter}
            <button
              type="button"
              onClick={() => setChannelFilter("all")}
              className="hover:text-black dark:hover:text-white"
            >
              <X size={11} />
            </button>
          </span>
        )}
        {paymentFilter !== "all" && (
          <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-neutral-100 text-[11px] font-medium text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200">
            Payment: {paymentFilter}
            <button
              type="button"
              onClick={() => setPaymentFilter("all")}
              className="hover:text-black dark:hover:text-white"
            >
              <X size={11} />
            </button>
          </span>
        )}
        {fulfillmentFilter !== "all" && (
          <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-neutral-100 text-[11px] font-medium text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200">
            Fulfillment: {fulfillmentFilter}
            <button
              type="button"
              onClick={() => setFulfillmentFilter("all")}
              className="hover:text-black dark:hover:text-white"
            >
              <X size={11} />
            </button>
          </span>
        )}
      </div>

      {/* ── Main Report Content or Locked View ── */}
      {reportQuery.isLoading ? (
        <ReportInsightSkeleton />
      ) : isLocked ? (
        <div className="relative min-h-[550px]">
          {/* Blurred Background Preview (No Real Numbers Leaked) */}
          <div className="filter blur-[6px] opacity-40 select-none pointer-events-none space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="rounded-[12px] border border-[hsl(var(--card-border))] bg-white p-5 shadow-2xs dark:bg-neutral-900"
                >
                  <div className="h-3 w-20 bg-neutral-200 rounded mb-3" />
                  <div className="h-7 w-28 bg-neutral-300 rounded mb-2" />
                  <div className="h-4 w-16 bg-neutral-200 rounded-full" />
                </div>
              ))}
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="h-64 rounded-[12px] border border-[hsl(var(--card-border))] bg-white p-6 dark:bg-neutral-900" />
              <div className="h-64 rounded-[12px] border border-[hsl(var(--card-border))] bg-white p-6 dark:bg-neutral-900" />
            </div>
          </div>

          {/* Centered Upgrade Overlay Card */}
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-[16px] border border-[hsl(var(--card-border))] bg-white p-7 shadow-2xl text-center space-y-4 dark:bg-neutral-900">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400">
                <Lock size={22} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[hsl(var(--foreground))]">
                  Upgrade to Pro to unlock {reportConfig.title}
                </h3>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1.5 leading-relaxed">
                  {reportQuery.data?.message ||
                    `${reportConfig.title} gives you advanced breakdown and comparative insights to grow your business.`}
                </p>
              </div>

              <div className="rounded-xl bg-neutral-50 p-3.5 text-left text-xs space-y-2 dark:bg-neutral-800/60">
                <div className="flex items-start gap-2">
                  <Check size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                  <span className="text-[hsl(var(--foreground))]">
                    Detailed performance analytics & period comparisons
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <Check size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                  <span className="text-[hsl(var(--foreground))]">
                    Actionable customer retention & margin intelligence
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <Check size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                  <span className="text-[hsl(var(--foreground))]">
                    Export verified reports as raw CSV data anytime
                  </span>
                </div>
              </div>

              <Link
                href="/account/billing"
                className="w-full inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl bg-neutral-900 text-white text-xs font-semibold hover:bg-neutral-800 transition cursor-pointer dark:bg-white dark:text-neutral-900"
              >
                <span>Upgrade to Pro</span>
                <ArrowUpRight size={14} />
              </Link>
            </div>
          </div>
        </div>
      ) : data ? (
        <div className="space-y-6">
          {/* ── Block 1: KPI Cards Grid ── */}
          {data.kpis && data.kpis.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {data.kpis.map((kpi) => {
                const isPositive = (kpi.delta ?? 0) > 0;
                const isZero = kpi.delta === 0 || kpi.delta == null;
                const effectivePositive = kpi.lowerIsBetter ? !isPositive : isPositive;

                return (
                  <div
                    key={kpi.id}
                    className="rounded-[12px] border border-[hsl(var(--card-border))] bg-white p-5 shadow-2xs dark:bg-neutral-900 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
                          {kpi.label}
                        </span>
                        <div
                          className="text-[hsl(var(--muted-foreground))] cursor-help hover:text-[hsl(var(--foreground))]"
                          title={kpi.description}
                        >
                          <Info size={13} />
                        </div>
                      </div>
                      <div className="mt-2 text-2xl sm:text-[28px] font-semibold tracking-tight text-neutral-800 dark:text-neutral-100">
                        {kpi.format === "currency"
                          ? money(Number(kpi.value))
                          : kpi.format === "percent"
                          ? `${kpi.value}%`
                          : typeof kpi.value === "number"
                          ? kpi.value.toLocaleString()
                          : kpi.value}
                      </div>
                    </div>

                    <div className="mt-3 flex items-center gap-1.5 text-xs">
                      {kpi.isNew ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                          New
                        </span>
                      ) : kpi.delta !== undefined && kpi.delta !== null ? (
                        <span
                          className={cn(
                            "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold",
                            isZero
                              ? "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400"
                              : effectivePositive
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                              : "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                          )}
                        >
                          {isZero ? null : effectivePositive ? (
                            <TrendingUp size={10} />
                          ) : (
                            <TrendingDown size={10} />
                          )}
                          <span>
                            {kpi.delta > 0 ? `+${kpi.delta}%` : `${kpi.delta}%`}
                          </span>
                        </span>
                      ) : null}
                      <span className="text-[11px] text-[hsl(var(--muted-foreground))]">
                        vs previous
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Block 2: Time Series Chart / Split Card ── */}
          {data.timeSeries && data.timeSeries.length > 0 && (
            <div className="rounded-[12px] border border-[hsl(var(--card-border))] bg-white p-6 shadow-2xs dark:bg-neutral-900">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
                <div>
                  <h3 className="text-base font-semibold text-[hsl(var(--foreground))]">
                    Performance Trend
                  </h3>
                  <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                    {data.period.isFairMtd
                      ? "Current period vs same days last month (fair MTD)"
                      : "Current period vs previous comparison period"}
                  </p>
                </div>
              </div>

              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={data.timeSeries}
                    margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="rgba(200,200,200,0.18)"
                    />
                    <XAxis
                      dataKey="label"
                      stroke="#a1a1aa"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="#a1a1aa"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : `${v}`)}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        const cur = payload.find((p) => p.dataKey === "current")?.value;
                        const comp = payload.find((p) => p.dataKey === "comparison")?.value;
                        return (
                          <div className="rounded-xl border border-[hsl(var(--border))] bg-neutral-900 p-3 shadow-xl text-white text-xs space-y-1">
                            <div className="font-semibold text-neutral-400">{label}</div>
                            <div className="flex items-center justify-between gap-4">
                              <span className="flex items-center gap-1.5">
                                <span className="h-2 w-2 rounded-full bg-white" />
                                <span>Current:</span>
                              </span>
                              <span className="font-bold">{money(Number(cur || 0))}</span>
                            </div>
                            {comp !== undefined && (
                              <div className="flex items-center justify-between gap-4 text-neutral-300">
                                <span className="flex items-center gap-1.5">
                                  <span className="h-2 w-2 rounded-full bg-neutral-500" />
                                  <span>Comparison:</span>
                                </span>
                                <span>{money(Number(comp || 0))}</span>
                              </div>
                            )}
                          </div>
                        );
                      }}
                    />
                    <Legend
                      wrapperStyle={{ paddingTop: 16, fontSize: 12 }}
                      formatter={(val) => (
                        <span className="text-[hsl(var(--muted-foreground))]">
                          {val === "current" ? "Current Period" : "Comparison Period"}
                        </span>
                      )}
                    />
                    <Line
                      type="monotone"
                      dataKey="current"
                      stroke="#111111"
                      strokeWidth={2}
                      dot={{ r: 3, fill: "#111111" }}
                      activeDot={{ r: 5 }}
                      name="current"
                    />
                    {compareMode !== "off" && (
                      <Line
                        type="monotone"
                        dataKey="comparison"
                        stroke="#a1a1aa"
                        strokeWidth={1.5}
                        strokeDasharray="4 4"
                        dot={{ r: 2.5, fill: "#a1a1aa" }}
                        name="comparison"
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* ── Block 3: Split Breakdown or List + Summary ── */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Breakdown List */}
            {data.breakdownList && data.breakdownList.length > 0 && (
              <div className="rounded-[12px] border border-[hsl(var(--card-border))] bg-white p-6 shadow-2xs dark:bg-neutral-900 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base font-semibold text-[hsl(var(--foreground))]">
                      Breakdown Analysis
                    </h3>
                  </div>

                  <div className="space-y-3 max-h-64 overflow-y-auto scrollbar-thin">
                    {data.breakdownList.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-xs py-1 border-b border-[hsl(var(--border))] last:border-0"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="h-2.5 w-2.5 rounded-full shrink-0"
                            style={{
                              background: item.color || "#111111",
                            }}
                          />
                          <span className="font-medium text-[hsl(var(--foreground))] truncate max-w-[150px]">
                            {item.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-right">
                          {item.count !== undefined && item.count > 0 && (
                            <span className="text-[hsl(var(--muted-foreground))]">
                              {item.count} order{item.count === 1 ? "" : "s"}
                            </span>
                          )}
                          <span className="font-semibold text-[hsl(var(--foreground))]">
                            {moneyExact(item.value)}
                          </span>
                          <span className="w-10 text-[hsl(var(--muted-foreground))] font-medium">
                            {item.share}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Deterministic Summary Card */}
            {data.summaryBullets && data.summaryBullets.length > 0 && (
              <div className="rounded-[12px] border border-[hsl(var(--card-border))] bg-white p-6 shadow-2xs dark:bg-neutral-900">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400">
                    <Sparkles size={16} />
                  </div>
                  <h3 className="text-base font-semibold text-[hsl(var(--foreground))]">
                    Key Observations
                  </h3>
                </div>

                <div className="space-y-3 text-xs leading-relaxed">
                  {data.summaryBullets.map((bullet, idx) => (
                    <div key={idx} className="flex items-start gap-2.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-neutral-900 mt-1.5 shrink-0 dark:bg-white" />
                      <span className="text-[hsl(var(--foreground))]">{bullet}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Block 4: Best Times to Sell Heatmap / Grouped Bars ── */}
          {data.heatmap && data.heatmap.length > 0 && (
            <div className="rounded-[12px] border border-[hsl(var(--card-border))] bg-white p-6 shadow-2xs dark:bg-neutral-900">
              <h3 className="text-base font-semibold text-[hsl(var(--foreground))] mb-1">
                Sales Velocity by Hour of Day
              </h3>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mb-4">
                Identifies peak ordering windows throughout the day to schedule promotions and rider dispatches.
              </p>
              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data.heatmap}
                    margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(200,200,200,0.18)" />
                    <XAxis
                      dataKey="hour"
                      stroke="#a1a1aa"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(h) => `${h}:00`}
                    />
                    <YAxis stroke="#a1a1aa" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const row = payload[0].payload;
                        return (
                          <div className="rounded-xl border border-[hsl(var(--border))] bg-neutral-900 p-2.5 text-white text-xs">
                            <div className="font-semibold">{row.hour}:00 - {row.hour + 1}:00</div>
                            <div className="mt-1">Orders: {row.count}</div>
                            <div>Revenue: {money(row.revenue)}</div>
                          </div>
                        );
                      }}
                    />
                    <Bar dataKey="count" fill="#111111" radius={[4, 4, 0, 0]} maxBarSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* ── Block 5: Profit & Margin Waterfall ── */}
          {data.waterfall && data.waterfall.length > 0 && (
            <div className="rounded-[12px] border border-[hsl(var(--card-border))] bg-white p-6 shadow-2xs dark:bg-neutral-900">
              <h3 className="text-base font-semibold text-[hsl(var(--foreground))] mb-1">
                Margin Waterfall (Revenue to Net Profit)
              </h3>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mb-4">
                Shows exact deductions from Gross Revenue through COGS and Operating Expenses to final Net Profit.
              </p>
              <div className="grid gap-3 sm:grid-cols-4">
                {data.waterfall.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]"
                  >
                    <div className="text-xs text-[hsl(var(--muted-foreground))]">
                      {item.item}
                    </div>
                    <div
                      className={cn(
                        "mt-1.5 text-lg font-bold",
                        item.type === "positive"
                          ? "text-neutral-900 dark:text-neutral-100"
                          : item.type === "negative"
                          ? "text-rose-600 dark:text-rose-400"
                          : "text-emerald-600 dark:text-emerald-400"
                      )}
                    >
                      {item.type === "negative" ? "−" : ""}
                      {moneyExact(item.amount)}
                    </div>
                    <div className="text-[11px] text-[hsl(var(--muted-foreground))] mt-1">
                      {item.percentageOfRevenue}% of revenue
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Block 6: Data Table (Ranked Items / Customers / Aging) ── */}
          {data.dataTable && data.dataTable.rows && data.dataTable.rows.length > 0 && (
            <div className="rounded-[12px] border border-[hsl(var(--card-border))] bg-white p-6 shadow-2xs dark:bg-neutral-900 overflow-hidden">
              <h3 className="text-base font-semibold text-[hsl(var(--foreground))] mb-4">
                {data.dataTable.title || "Detailed Breakdown"}
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] font-semibold">
                      {data.dataTable.headers.map((h, i) => (
                        <th
                          key={i}
                          className={cn(
                            "py-2.5 px-3",
                            i > 0 && "text-right"
                          )}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[hsl(var(--border))]">
                    {data.dataTable.rows.map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-[hsl(var(--muted))]/50 transition">
                        {row.map((cell, cIdx) => (
                          <td
                            key={cIdx}
                            className={cn(
                              "py-2.5 px-3 text-[hsl(var(--foreground))]",
                              cIdx === 0 ? "font-medium" : "text-right"
                            )}
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Block 7: Footer Note (How this is calculated) ── */}
          <div className="rounded-[12px] border border-[hsl(var(--card-border))] bg-neutral-50/70 p-5 dark:bg-neutral-900/60 text-xs">
            <div className="flex items-start gap-2.5">
              <Info size={16} className="text-[hsl(var(--muted-foreground))] shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="font-semibold text-[hsl(var(--foreground))]">
                  How this is calculated
                </h4>
                <p className="text-[hsl(var(--muted-foreground))] leading-relaxed">
                  {data.calculationNote} All metrics are computed server-side in your store's configured timezone and currency. See{" "}
                  <a
                    href="https://github.com/Clarke-ro/take-order/blob/main/docs/METRICS.md"
                    target="_blank"
                    rel="noreferrer"
                    className="underline text-neutral-800 dark:text-neutral-200"
                  >
                    docs/METRICS.md
                  </a>{" "}
                  for the canonical mathematical definitions.
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
