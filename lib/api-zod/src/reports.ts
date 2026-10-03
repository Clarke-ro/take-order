import { PlanTier, isProOrHigher } from "./entitlements";

export type ReportCategory =
  | "all"
  | "sales"
  | "channels"
  | "orders"
  | "finance"
  | "customers"
  | "inventory";

export interface ReportConfig {
  slug: string;
  title: string;
  category: "sales" | "channels" | "orders" | "finance" | "customers" | "inventory";
  description: string;
  minPlan: "free" | "pro";
  iconName: string;
  blocks: Array<
    | "kpi-grid"
    | "time-series"
    | "split-card"
    | "breakdown-list"
    | "summary-bullets"
    | "data-table"
    | "heatmap"
    | "waterfall"
  >;
  layoutType: "standard" | "split" | "stacked" | "heatmap";
}

export const REPORT_CATEGORIES = [
  { id: "all", label: "All" },
  { id: "sales", label: "Sales" },
  { id: "channels", label: "Channels" },
  { id: "orders", label: "Orders" },
  { id: "customers", label: "Customers" },
  { id: "inventory", label: "Inventory" },
  { id: "finance", label: "Finance" },
] as const;

export const REPORT_CATALOG: ReportConfig[] = [
  // Sales
  {
    slug: "sales-summary",
    title: "Sales summary",
    category: "sales",
    description: "Revenue, orders, average order value, collected cash, and top selling products.",
    minPlan: "free",
    iconName: "TrendingUp",
    blocks: ["kpi-grid", "time-series", "breakdown-list", "summary-bullets", "data-table"],
    layoutType: "standard",
  },
  {
    slug: "sales-over-time",
    title: "Sales over time",
    category: "sales",
    description: "Time series with daily, weekly and monthly granularity, comparisons, best and worst periods.",
    minPlan: "free",
    iconName: "Calendar",
    blocks: ["kpi-grid", "time-series", "summary-bullets", "data-table"],
    layoutType: "standard",
  },
  {
    slug: "product-performance",
    title: "Product performance",
    category: "sales",
    description: "Top and bottom products by revenue and units, revenue share, and margin per product.",
    minPlan: "pro",
    iconName: "Package",
    blocks: ["kpi-grid", "split-card", "summary-bullets", "data-table"],
    layoutType: "split",
  },
  {
    slug: "best-times-to-sell",
    title: "Best times to sell",
    category: "sales",
    description: "Weekday by hour order heatmap, peak selling days, and highest converting hours.",
    minPlan: "pro",
    iconName: "Clock",
    blocks: ["kpi-grid", "heatmap", "time-series", "summary-bullets"],
    layoutType: "heatmap",
  },

  // Channels
  {
    slug: "sales-by-channel",
    title: "Sales by channel",
    category: "channels",
    description: "Orders, revenue, average order value, conversion, and market share across social channels.",
    minPlan: "free",
    iconName: "Share2",
    blocks: ["split-card", "kpi-grid", "summary-bullets", "data-table"],
    layoutType: "split",
  },

  // Orders
  {
    slug: "orders-overview",
    title: "Orders overview",
    category: "orders",
    description: "Order status distribution, fulfillment pipeline health, and daily order placement velocity.",
    minPlan: "free",
    iconName: "ShoppingBag",
    blocks: ["kpi-grid", "breakdown-list", "time-series", "summary-bullets", "data-table"],
    layoutType: "standard",
  },

  // Finance
  {
    slug: "payments-and-outstanding",
    title: "Payments and outstanding",
    category: "finance",
    description: "Cash collected vs outstanding balances, 0-7, 8-14, 15+ day aging buckets, and unpaid orders.",
    minPlan: "pro",
    iconName: "CreditCard",
    blocks: ["kpi-grid", "breakdown-list", "summary-bullets", "data-table"],
    layoutType: "standard",
  },
  {
    slug: "profit-and-margin",
    title: "Profit and margin",
    category: "finance",
    description: "Revenue, cost of goods, operating expenses, net margin trend, and missing-costs alerts.",
    minPlan: "pro",
    iconName: "DollarSign",
    blocks: ["kpi-grid", "waterfall", "time-series", "summary-bullets", "data-table"],
    layoutType: "standard",
  },
  {
    slug: "expenses",
    title: "Expenses",
    category: "finance",
    description: "Operating expenditures categorized by rent, logistics, ads, with historical trend analysis.",
    minPlan: "free",
    iconName: "Receipt",
    blocks: ["kpi-grid", "split-card", "summary-bullets", "data-table"],
    layoutType: "split",
  },

  // Customers
  {
    slug: "customer-insights",
    title: "Customer insights",
    category: "customers",
    description: "New vs returning customers over time, repeat rate, top buyers, and acquisition channels.",
    minPlan: "pro",
    iconName: "Users",
    blocks: ["kpi-grid", "time-series", "summary-bullets", "data-table"],
    layoutType: "standard",
  },

  // Inventory
  {
    slug: "inventory-health",
    title: "Inventory health",
    category: "inventory",
    description: "Total retail and cost valuation, low stock warnings, out-of-stock items, and slow movers.",
    minPlan: "free",
    iconName: "Boxes",
    blocks: ["kpi-grid", "breakdown-list", "summary-bullets", "data-table"],
    layoutType: "standard",
  },
];

export function getReportConfig(slug: string): ReportConfig | undefined {
  return REPORT_CATALOG.find((r) => r.slug === slug);
}

export function canAccessReport(tier: PlanTier, slug: string): boolean {
  const config = getReportConfig(slug);
  if (!config) return false;
  if (config.minPlan === "free") return true;
  return isProOrHigher(tier);
}
