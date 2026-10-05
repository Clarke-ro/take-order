import React from "react";
import {
  TrendingUp,
  Calendar,
  Package,
  Clock,
  Share2,
  ShoppingBag,
  CreditCard,
  DollarSign,
  Receipt,
  Users,
  Boxes,
  LucideIcon,
} from "lucide-react";
import {
  REPORT_CATALOG,
  REPORT_CATEGORIES,
  type ReportConfig,
  type ReportCategory,
  getReportConfig,
  canAccessReport,
} from "@workspace/api-zod";

export { REPORT_CATALOG, REPORT_CATEGORIES, getReportConfig, canAccessReport };
export type { ReportConfig, ReportCategory };

export const REPORT_ICONS: Record<string, { icon: LucideIcon; color: string; bg: string }> = {
  "sales-summary": {
    icon: TrendingUp,
    color: "#10B981", // Emerald
    bg: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400",
  },
  "sales-over-time": {
    icon: Calendar,
    color: "#3B82F6", // Blue
    bg: "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400",
  },
  "product-performance": {
    icon: Package,
    color: "#5B5BF0", // Primary Indigo
    bg: "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400",
  },
  "best-times-to-sell": {
    icon: Clock,
    color: "#F59E0B", // Amber
    bg: "bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400",
  },
  "sales-by-channel": {
    icon: Share2,
    color: "#25D366", // WhatsApp Green / Channel accent
    bg: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400",
  },
  "orders-overview": {
    icon: ShoppingBag,
    color: "#06B6D4", // Cyan
    bg: "bg-cyan-50 text-cyan-600 dark:bg-cyan-950/40 dark:text-cyan-400",
  },
  "payments-and-outstanding": {
    icon: CreditCard,
    color: "#EC4899", // Pink
    bg: "bg-pink-50 text-pink-600 dark:bg-pink-950/40 dark:text-pink-400",
  },
  "profit-and-margin": {
    icon: DollarSign,
    color: "#10B981", // Emerald
    bg: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400",
  },
  "expenses": {
    icon: Receipt,
    color: "#F43F5E", // Rose
    bg: "bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400",
  },
  "customer-insights": {
    icon: Users,
    color: "#6366F1", // Indigo
    bg: "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400",
  },
  "inventory-health": {
    icon: Boxes,
    color: "#F59E0B", // Amber
    bg: "bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400",
  },
};
