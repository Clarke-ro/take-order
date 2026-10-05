import {
  type AnalyticsProduct,
  type AnalyticsOrder,
  type AnalyticsExpense,
  type DashboardRange,
} from "./dashboard-analytics";
import { type ReportConfig, getReportConfig, getOrderCollectedAmount, getOrderOutstandingAmount } from "@workspace/api-zod";

export type ReportAnalyticsOrder = AnalyticsOrder & {
  id?: number;
  itemCount?: number;
  customerName?: string | null;
  customerPhone?: string | null;
  fulfillment?: string | null;
};

export interface PeriodComparisonResult {
  currentRange: { from: string; to: string; label: string };
  previousRange: { from: string; to: string; label: string; isFairMtd: boolean };
  hasEnoughData: boolean; // sample size guard (both periods >= 5 placed orders)
  metrics: Array<{
    id: string;
    label: string;
    current: number;
    previous: number;
    changePercent: number | null; // null represents "New"
    isNew: boolean;
    lowerIsBetter?: boolean;
    format: "currency" | "integer" | "percent";
  }>;
  weeklyComparison: Array<{
    weekLabel: string;
    currentRevenue: number;
    previousRevenue: number;
    currentOrders: number;
    previousOrders: number;
  }>;
  whatsWorking: {
    topChannel?: { name: string; revenue: number; changePercent: number | null; summary: string };
    topProduct?: { name: string; revenue: number; changePercent: number | null; summary: string };
    bestWeekday?: { day: string; orders: number; revenue: number; summary: string };
  };
  needsAttention: {
    decliningChannel?: { name: string; changePercent: number; link: string; summary: string };
    decliningProduct?: { name: string; changePercent: number; link: string; summary: string };
    lowStockBestSellers: Array<{ id: number; name: string; stock: number; link: string }>;
    overdueOrders: Array<{ id: number; customerName: string; balanceDue: number; daysAgo: number; link: string }>;
  };
  gainers: Array<{ name: string; type: "channel" | "product"; changePercent: number | null; current: number }>;
  decliners: Array<{ name: string; type: "channel" | "product"; changePercent: number; current: number }>;
  insights: string[];
}

export function getLocalDateString(dateInput: Date | string, tz: string = "UTC"): string {
  try {
    const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  } catch {
    const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
    return d.toISOString().slice(0, 10);
  }
}

export function computeFairComparisonRange(
  fromStr: string,
  toStr: string,
  compareMode: "previous_period" | "last_month" = "previous_period",
  now = new Date(),
  timezone: string = "UTC"
): { compareFrom: string; compareTo: string; isFairMtd: boolean; label: string } {
  const fromDate = new Date(`${fromStr}T00:00:00.000Z`);
  const toDate = new Date(`${toStr}T00:00:00.000Z`);
  const durationMs = toDate.getTime() - fromDate.getTime();
  const dayCount = Math.round(durationMs / 86400000) + 1;

  const todayStr = getLocalDateString(now, timezone);
  const isCurrentMonth =
    fromStr.slice(0, 7) === todayStr.slice(0, 7) &&
    fromStr.slice(8, 10) === "01" &&
    toStr <= todayStr;

  if (isCurrentMonth) {
    // Fair MTD alignment: compare day 1 to day N of previous month
    const [curYear, curMonth] = fromStr.split("-").map(Number);
    const prevYear = curMonth === 1 ? curYear - 1 : curYear;
    const prevMonth = curMonth === 1 ? 12 : curMonth - 1;
    const prevMonthPadded = String(prevMonth).padStart(2, "0");
    const dayPadded = toStr.slice(8, 10);

    const compareFrom = `${prevYear}-${prevMonthPadded}-01`;
    const compareTo = `${prevYear}-${prevMonthPadded}-${dayPadded}`;
    return {
      compareFrom,
      compareTo,
      isFairMtd: true,
      label: `Same ${dayCount} days last month (MTD)`,
    };
  }

  // Exact previous window of same duration
  const prevToMs = fromDate.getTime() - 86400000;
  const prevFromMs = prevToMs - (dayCount - 1) * 86400000;
  const prevToDate = new Date(prevToMs);
  const prevFromDate = new Date(prevFromMs);

  return {
    compareFrom: prevFromDate.toISOString().slice(0, 10),
    compareTo: prevToDate.toISOString().slice(0, 10),
    isFairMtd: false,
    label: `Previous ${dayCount} days`,
  };
}

export function calculateDelta(current: number, previous: number): {
  percent: number | null;
  isNew: boolean;
} {
  if (previous === 0) {
    if (current > 0) return { percent: null, isNew: true };
    return { percent: 0, isNew: false };
  }
  const pct = ((current - previous) / previous) * 100;
  return { percent: Math.round(pct * 10) / 10, isNew: false };
}

export function computePeriodComparison(
  products: AnalyticsProduct[],
  orders: ReportAnalyticsOrder[],
  expenses: AnalyticsExpense[],
  fromStr: string,
  toStr: string,
  compareFromStr: string,
  compareToStr: string,
  now: Date | string = new Date(),
  timezone: string = "UTC",
  isFairMtd = false
): PeriodComparisonResult {
  const effectiveNow = now instanceof Date ? now : new Date();
  const effectiveTimezone = typeof now === "string" ? now : timezone;
  const effectiveIsFairMtd = typeof timezone === "boolean" ? timezone : isFairMtd;

  const productMap = new Map(products.map((p) => [p.id, p]));

  const orderDate = (o: AnalyticsOrder) => getLocalDateString(o.createdAt, effectiveTimezone);
  const isOrderPlaced = (o: AnalyticsOrder) => o.status !== "reserved" && o.status !== "cancelled";
  const isOrderPaid = (o: AnalyticsOrder) => o.status === "paid" || o.status === "deposit_paid";
  const getOrderRev = (o: AnalyticsOrder) => getOrderCollectedAmount(o);

  const curOrders = orders.filter((o) => {
    const d = orderDate(o);
    return d >= fromStr && d <= toStr;
  });
  const prevOrders = orders.filter((o) => {
    const d = orderDate(o);
    return d >= compareFromStr && d <= compareToStr;
  });

  const curExpenses = expenses.filter((e) => e.expenseDate >= fromStr && e.expenseDate <= toStr);
  const prevExpenses = expenses.filter((e) => e.expenseDate >= compareFromStr && e.expenseDate <= compareToStr);

  const curPlaced = curOrders.filter(isOrderPlaced);
  const prevPlaced = prevOrders.filter(isOrderPlaced);
  const curPaid = curPlaced.filter(isOrderPaid);
  const prevPaid = prevPlaced.filter(isOrderPaid);

  // Revenue
  const curRevenue = curPaid.reduce((s, o) => s + getOrderRev(o), 0);
  const prevRevenue = prevPaid.reduce((s, o) => s + getOrderRev(o), 0);

  // Orders
  const curOrdersCount = curPlaced.length;
  const prevOrdersCount = prevPlaced.length;

  // AOV
  const curOrderVal = curPlaced.reduce((s, o) => s + Number(o.amount), 0);
  const prevOrderVal = prevPlaced.reduce((s, o) => s + Number(o.amount), 0);
  const curAov = curOrdersCount ? curOrderVal / curOrdersCount : 0;
  const prevAov = prevOrdersCount ? prevOrderVal / prevOrdersCount : 0;

  // COGS & OpEx & Net Profit
  const getCogs = (paid: AnalyticsOrder[]) =>
    paid.reduce((s, o) => {
      const p = productMap.get(o.productId);
      const cost = o.productCost != null ? Number(o.productCost) : p?.cost != null ? Number(p.cost) : 0;
      return s + cost;
    }, 0);

  const curCogs = getCogs(curPaid);
  const prevCogs = getCogs(prevPaid);
  const curOpEx = curExpenses.reduce((s, e) => s + Number(e.amount), 0);
  const prevOpEx = prevExpenses.reduce((s, e) => s + Number(e.amount), 0);
  const curProfit = curRevenue - curCogs - curOpEx;
  const prevProfit = prevRevenue - prevCogs - prevOpEx;

  // Outstanding
  const getOutstanding = (placed: AnalyticsOrder[]) =>
    placed
      .filter((o) => o.status === "deposit_paid" || o.status === "pending" || o.status === "unpaid")
      .reduce((s, o) => s + getOrderOutstandingAmount(o), 0);

  const curOutstanding = getOutstanding(curPlaced);
  const prevOutstanding = getOutstanding(prevPlaced);

  // Customers (identified by phone or buyerDetails name)
  const getBuyerCounts = (allOrderList: AnalyticsOrder[], windowFrom: string, windowTo: string) => {
    const historicalBefore = allOrderList.filter((o) => isOrderPlaced(o) && orderDate(o) < windowFrom);
    const existingBuyerKeys = new Set(
      historicalBefore
        .map((o: any) => o.customerPhone?.trim() || o.customerName?.trim())
        .filter(Boolean)
    );

    const windowOrders = allOrderList.filter((o) => {
      const d = orderDate(o);
      return isOrderPlaced(o) && d >= windowFrom && d <= windowTo;
    });

    const buyerOrdersInWindow = new Map<string, number>();
    let newBuyers = 0;

    windowOrders.forEach((o: any) => {
      const k = o.customerPhone?.trim() || o.customerName?.trim();
      if (!k || k.toLowerCase() === "waiting for buyer") return;
      if (!buyerOrdersInWindow.has(k)) {
        if (!existingBuyerKeys.has(k)) {
          newBuyers++;
        }
        buyerOrdersInWindow.set(k, 1);
      } else {
        buyerOrdersInWindow.set(k, buyerOrdersInWindow.get(k)! + 1);
      }
    });

    const totalBuyers = buyerOrdersInWindow.size;
    const repeatBuyers = Array.from(buyerOrdersInWindow.values()).filter((c) => c > 1).length;
    const repeatRate = totalBuyers ? Math.round((repeatBuyers / totalBuyers) * 100) : 0;
    return { newBuyers, repeatRate };
  };

  const curBuyers = getBuyerCounts(orders, fromStr, toStr);
  const prevBuyers = getBuyerCounts(orders, compareFromStr, compareToStr);

  const deltaRev = calculateDelta(curRevenue, prevRevenue);
  const deltaOrders = calculateDelta(curOrdersCount, prevOrdersCount);
  const deltaAov = calculateDelta(curAov, prevAov);
  const deltaProfit = calculateDelta(curProfit, prevProfit);
  const deltaNewBuyers = calculateDelta(curBuyers.newBuyers, prevBuyers.newBuyers);
  const deltaRepeatRate = calculateDelta(curBuyers.repeatRate, prevBuyers.repeatRate);
  const deltaExpenses = calculateDelta(curOpEx, prevOpEx);
  const deltaOutstanding = calculateDelta(curOutstanding, prevOutstanding);

  const metrics = [
    { id: "revenue", label: "Revenue", current: curRevenue, previous: prevRevenue, changePercent: deltaRev.percent, isNew: deltaRev.isNew, format: "currency" as const },
    { id: "orders", label: "Orders", current: curOrdersCount, previous: prevOrdersCount, changePercent: deltaOrders.percent, isNew: deltaOrders.isNew, format: "integer" as const },
    { id: "aov", label: "Average order value", current: curAov, previous: prevAov, changePercent: deltaAov.percent, isNew: deltaAov.isNew, format: "currency" as const },
    { id: "profit", label: "Net profit", current: curProfit, previous: prevProfit, changePercent: deltaProfit.percent, isNew: deltaProfit.isNew, format: "currency" as const },
    { id: "new_customers", label: "New customers", current: curBuyers.newBuyers, previous: prevBuyers.newBuyers, changePercent: deltaNewBuyers.percent, isNew: deltaNewBuyers.isNew, format: "integer" as const },
    { id: "repeat_rate", label: "Repeat rate", current: curBuyers.repeatRate, previous: prevBuyers.repeatRate, changePercent: deltaRepeatRate.percent, isNew: deltaRepeatRate.isNew, format: "percent" as const },
    { id: "expenses", label: "Expenses", current: curOpEx, previous: prevOpEx, changePercent: deltaExpenses.percent, isNew: deltaExpenses.isNew, lowerIsBetter: true, format: "currency" as const },
    { id: "outstanding", label: "Outstanding", current: curOutstanding, previous: prevOutstanding, changePercent: deltaOutstanding.percent, isNew: deltaOutstanding.isNew, lowerIsBetter: true, format: "currency" as const },
  ];

  const hasEnoughData = curOrdersCount >= 5 && prevOrdersCount >= 5;

  // Grouped bar chart (by 4 standard comparison chunks / weeks)
  const weeklyComparison: PeriodComparisonResult["weeklyComparison"] = [];
  const chunkCount = 4;
  for (let i = 0; i < chunkCount; i++) {
    weeklyComparison.push({
      weekLabel: `W${i + 1}`,
      currentRevenue: Math.round(curRevenue / chunkCount),
      previousRevenue: Math.round(prevRevenue / chunkCount),
      currentOrders: Math.round(curOrdersCount / chunkCount),
      previousOrders: Math.round(prevOrdersCount / chunkCount),
    });
  }

  // Top channels
  const channelTotals = (orderList: AnalyticsOrder[]) => {
    const map = new Map<string, number>();
    orderList.filter(isOrderPaid).forEach((o) => {
      const ch = (o.channel || "direct").toLowerCase();
      map.set(ch, (map.get(ch) || 0) + getOrderRev(o));
    });
    return map;
  };
  const curChTotals = channelTotals(curPlaced);
  const prevChTotals = channelTotals(prevPlaced);

  let topChannelName = "None";
  let topChannelRev = 0;
  for (const [ch, rev] of curChTotals.entries()) {
    if (rev > topChannelRev) {
      topChannelRev = rev;
      topChannelName = ch;
    }
  }
  const topChDelta = calculateDelta(topChannelRev, prevChTotals.get(topChannelName) || 0);

  // Top products
  const productTotals = (orderList: AnalyticsOrder[]) => {
    const map = new Map<string, { id: number; revenue: number; orders: number }>();
    orderList.filter(isOrderPaid).forEach((o) => {
      const name = o.productName || `Item #${o.productId}`;
      const ex = map.get(name) || { id: o.productId, revenue: 0, orders: 0 };
      ex.revenue += getOrderRev(o);
      ex.orders += 1;
      map.set(name, ex);
    });
    return map;
  };
  const curProdTotals = productTotals(curPlaced);
  const prevProdTotals = productTotals(prevPlaced);

  let topProdName = "None";
  let topProdRev = 0;
  for (const [pName, data] of curProdTotals.entries()) {
    if (data.revenue > topProdRev) {
      topProdRev = data.revenue;
      topProdName = pName;
    }
  }
  const topProdDelta = calculateDelta(topProdRev, prevProdTotals.get(topProdName)?.revenue || 0);

  // Best weekday
  const weekdayCounts = [0, 0, 0, 0, 0, 0, 0];
  const weekdayRevs = [0, 0, 0, 0, 0, 0, 0];
  const weekdayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  curPaid.forEach((o) => {
    const d = new Date(o.createdAt);
    const day = d.getUTCDay();
    weekdayCounts[day]++;
    weekdayRevs[day] += getOrderRev(o);
  });
  let bestDayIdx = 0;
  for (let d = 0; d < 7; d++) {
    if (weekdayCounts[d] > weekdayCounts[bestDayIdx]) {
      bestDayIdx = d;
    }
  }

  // Gainers & decliners
  const gainers: PeriodComparisonResult["gainers"] = [];
  const decliners: PeriodComparisonResult["decliners"] = [];

  curChTotals.forEach((rev, ch) => {
    const prevR = prevChTotals.get(ch) || 0;
    const delta = calculateDelta(rev, prevR);
    if (delta.isNew || (delta.percent !== null && delta.percent > 0)) {
      gainers.push({ name: ch, type: "channel", changePercent: delta.percent, current: rev });
    } else if (delta.percent !== null && delta.percent < 0) {
      decliners.push({ name: ch, type: "channel", changePercent: delta.percent, current: rev });
    }
  });

  curProdTotals.forEach((data, pName) => {
    const prevR = prevProdTotals.get(pName)?.revenue || 0;
    const delta = calculateDelta(data.revenue, prevR);
    if (delta.isNew || (delta.percent !== null && delta.percent > 0)) {
      gainers.push({ name: pName, type: "product", changePercent: delta.percent, current: data.revenue });
    } else if (delta.percent !== null && delta.percent < 0) {
      decliners.push({ name: pName, type: "product", changePercent: delta.percent, current: data.revenue });
    }
  });

  gainers.sort((a, b) => (b.changePercent ?? 100) - (a.changePercent ?? 100));
  decliners.sort((a, b) => a.changePercent - b.changePercent);

  // Low stock best sellers
  const lowStockBestSellers = products
    .filter((p) => p.stock <= 3 && curProdTotals.has(p.name))
    .slice(0, 3)
    .map((p) => ({
      id: p.id,
      name: p.name,
      stock: p.stock,
      link: `/catalog/edit/${p.id}`,
    }));

  // Overdue orders
  const overdueOrders = curPlaced
    .filter((o) => o.status === "pending" || o.status === "unpaid" || o.status === "deposit_paid")
    .map((o: any) => {
      const due = getOrderOutstandingAmount(o);
      const d = Math.max(0, Math.floor((effectiveNow.getTime() - new Date(o.createdAt).getTime()) / 86400000));
      return {
        id: o.id || 0,
        customerName: o.customerName || "Customer",
        balanceDue: due,
        daysAgo: d,
        link: `/orders/${o.id}`,
      };
    })
    .filter((o) => o.daysAgo >= 7 && o.balanceDue > 0)
    .slice(0, 3);

  // Deterministic insights
  const insights: string[] = [];
  if (hasEnoughData) {
    if (deltaRev.percent !== null) {
      insights.push(
        deltaRev.percent >= 0
          ? `Revenue expanded by ${deltaRev.percent}% compared to previous period.`
          : `Revenue declined by ${Math.abs(deltaRev.percent)}% compared to previous period.`
      );
    }
    if (topChannelName !== "None") {
      insights.push(
        `${topChannelName.charAt(0).toUpperCase() + topChannelName.slice(1)} remains your top performing sales channel.`
      );
    }
    if (curProfit > prevProfit) {
      insights.push("Net profit increased after deductions for cost of goods and operating expenses.");
    }
  } else {
    insights.push("Not enough data yet. Complete at least 5 orders in both periods to generate comparison trends.");
  }

  return {
    currentRange: { from: fromStr, to: toStr, label: `${fromStr} to ${toStr}` },
    previousRange: {
      from: compareFromStr,
      to: compareToStr,
      label: isFairMtd ? `Same days last month (fair MTD)` : `${compareFromStr} to ${compareToStr}`,
      isFairMtd,
    },
    hasEnoughData,
    metrics,
    weeklyComparison,
    whatsWorking: {
      topChannel: topChannelName !== "None"
        ? {
            name: topChannelName.charAt(0).toUpperCase() + topChannelName.slice(1),
            revenue: topChannelRev,
            changePercent: topChDelta.percent,
            summary: topChDelta.isNew
              ? "New channel revenue this period"
              : `${topChDelta.percent && topChDelta.percent >= 0 ? "+" : ""}${topChDelta.percent ?? 0}% vs previous`,
          }
        : undefined,
      topProduct: topProdName !== "None"
        ? {
            name: topProdName,
            revenue: topProdRev,
            changePercent: topProdDelta.percent,
            summary: topProdDelta.isNew
              ? "New top seller this period"
              : `${topProdDelta.percent && topProdDelta.percent >= 0 ? "+" : ""}${topProdDelta.percent ?? 0}% vs previous`,
          }
        : undefined,
      bestWeekday: {
        day: weekdayNames[bestDayIdx],
        orders: weekdayCounts[bestDayIdx],
        revenue: weekdayRevs[bestDayIdx],
        summary: `${weekdayCounts[bestDayIdx]} orders placed on ${weekdayNames[bestDayIdx]}s`,
      },
    },
    needsAttention: {
      decliningChannel: decliners.find((d) => d.type === "channel")
        ? {
            name: decliners.find((d) => d.type === "channel")!.name,
            changePercent: decliners.find((d) => d.type === "channel")!.changePercent,
            link: "/analytics/reports/sales-by-channel",
            summary: `Sales dropped by ${Math.abs(decliners.find((d) => d.type === "channel")!.changePercent)}%`,
          }
        : undefined,
      decliningProduct: decliners.find((d) => d.type === "product")
        ? {
            name: decliners.find((d) => d.type === "product")!.name,
            changePercent: decliners.find((d) => d.type === "product")!.changePercent,
            link: "/analytics/reports/product-performance",
            summary: `Down ${Math.abs(decliners.find((d) => d.type === "product")!.changePercent)}% this period`,
          }
        : undefined,
      lowStockBestSellers,
      overdueOrders,
    },
    gainers: gainers.slice(0, 5),
    decliners: decliners.slice(0, 5),
    insights,
  };
}

export interface ReportDetailResponse {
  report: ReportConfig;
  period: { from: string; to: string; compareFrom: string; compareTo: string; isFairMtd: boolean };
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
}

export function generateReportDetailData(params: {
  slug: string;
  products: AnalyticsProduct[];
  orders: ReportAnalyticsOrder[];
  expenses: AnalyticsExpense[];
  from: string;
  to: string;
  compareFrom: string;
  compareTo: string;
  isFairMtd: boolean;
  filters?: { channel?: string; category?: string; paymentMode?: string; fulfillment?: string };
  timezone?: string;
  currency?: string;
}): ReportDetailResponse {
  const {
    slug,
    products,
    orders: rawOrders,
    expenses: rawExpenses,
    from,
    to,
    compareFrom,
    compareTo,
    isFairMtd,
    filters,
    timezone = "UTC",
    currency = "GH₵",
  } = params;

  const config = getReportConfig(slug);
  if (!config) {
    throw new Error(`Report not found: ${slug}`);
  }

  // Filter orders by date & dimensions
  const orderDate = (o: AnalyticsOrder) => getLocalDateString(o.createdAt, timezone);
  const filterPass = (o: any) => {
    if (filters?.channel && (o.channel || "").toLowerCase() !== filters.channel.toLowerCase()) return false;
    if (filters?.paymentMode && (o.paymentMode || "").toLowerCase() !== filters.paymentMode.toLowerCase()) return false;
    if (filters?.fulfillment && (o.fulfillment || "").toLowerCase() !== filters.fulfillment.toLowerCase()) return false;
    return true;
  };

  const curOrders = rawOrders.filter((o) => {
    const d = orderDate(o);
    return d >= from && d <= to && filterPass(o);
  });
  const prevOrders = rawOrders.filter((o) => {
    const d = orderDate(o);
    return d >= compareFrom && d <= compareTo && filterPass(o);
  });

  const curExpenses = rawExpenses.filter((e) => e.expenseDate >= from && e.expenseDate <= to);
  const prevExpenses = rawExpenses.filter((e) => e.expenseDate >= compareFrom && e.expenseDate <= compareTo);

  const productMap = new Map(products.map((p) => [p.id, p]));
  const isPaid = (o: AnalyticsOrder) => o.status === "paid" || o.status === "deposit_paid";
  const isPlaced = (o: AnalyticsOrder) => o.status !== "reserved" && o.status !== "cancelled";
  const getRev = (o: AnalyticsOrder) => getOrderCollectedAmount(o);

  const curPlaced = curOrders.filter(isPlaced);
  const prevPlaced = prevOrders.filter(isPlaced);
  const curPaid = curPlaced.filter(isPaid);
  const prevPaid = prevPlaced.filter(isPaid);

  const curRevenue = curPaid.reduce((s, o) => s + getRev(o), 0);
  const prevRevenue = prevPaid.reduce((s, o) => s + getRev(o), 0);
  const curCount = curPlaced.length;
  const prevCount = prevPlaced.length;
  const curOrderVal = curPlaced.reduce((s, o) => s + Number(o.amount), 0);
  const curAov = curCount ? curOrderVal / curCount : 0;
  const prevOrderVal = prevPlaced.reduce((s, o) => s + Number(o.amount), 0);
  const prevAov = prevCount ? prevOrderVal / prevCount : 0;

  const revDelta = calculateDelta(curRevenue, prevRevenue);
  const countDelta = calculateDelta(curCount, prevCount);
  const aovDelta = calculateDelta(curAov, prevAov);

  const nowIso = new Date().toISOString();

  // Basic time series days
  const fromD = new Date(`${from}T00:00:00.000Z`);
  const toD = new Date(`${to}T00:00:00.000Z`);
  const dayCount = Math.max(1, Math.min(366, Math.floor((toD.getTime() - fromD.getTime()) / 86400000) + 1));

  const timeSeries = Array.from({ length: dayCount }, (_, idx) => {
    const curDay = new Date(fromD.getTime() + idx * 86400000);
    const dStr = curDay.toISOString().slice(0, 10);
    const dayCurPaid = curPaid.filter((o) => orderDate(o) === dStr);
    const rev = dayCurPaid.reduce((s, o) => s + getRev(o), 0);
    const ords = dayCurPaid.length;

    // Previous comparison day corresponding in window
    const compDay = new Date(new Date(`${compareFrom}T00:00:00.000Z`).getTime() + idx * 86400000);
    const compDStr = compDay.toISOString().slice(0, 10);
    const compPaid = prevPaid.filter((o) => orderDate(o) === compDStr);
    const compRev = compPaid.reduce((s, o) => s + getRev(o), 0);

    return {
      date: dStr,
      label: dayCount <= 14
        ? curDay.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" })
        : curDay.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }),
      current: rev,
      comparison: compRev,
      orders: ords,
    };
  });

  // Base Calculation Notes
  const calculationNotes: Record<string, string> = {
    "sales-summary": "Order Value = Sum of all valid placed orders. Revenue = Realized collected cash (paid orders + collected deposits). Average Order Value (AOV) = Order Value / Placed Orders.",
    "sales-over-time": "Daily, weekly, and monthly aggregates based on order creation date evaluated in the seller's configured store timezone.",
    "product-performance": "Margin = (Revenue − Cost) / Revenue. Products with missing cost prices in catalog show an alert.",
    "best-times-to-sell": "Orders and collected revenue bucketed by local weekday and hour of the day in the seller's timezone.",
    "sales-by-channel": "Sales channels are attributed by order creation channel (WhatsApp, Instagram, TikTok, Snapchat, In person, or Direct link).",
    "orders-overview": "Fulfillment status is tracked across pending, processing, shipped, and delivered states. Placed orders exclude draft link reservations.",
    "payments-and-outstanding": "Outstanding balance = remaining uncollected amount on placed orders. Aging is computed from order creation date.",
    "profit-and-margin": "Net Profit = Collected Revenue − Cost of Goods Sold (COGS) − Operating Expenses (OpEx). Net Margin = (Net Profit / Revenue) × 100%.",
    "expenses": "Recorded non-inventory operating expenses (rent, marketing, dispatch, utilities).",
    "customer-insights": "Customer identity is resolved by normalized phone number or customer name. Repeat buyers have >1 order.",
    "inventory-health": "Retail Valuation = Units in stock × Retail Price. Cost Valuation = Units in stock × Unit Cost.",
  };

  const defaultNote = calculationNotes[slug] || "Metrics strictly adhere to docs/METRICS.md canonical financial definitions.";

  // Custom assembly per report slug
  switch (slug) {
    case "sales-summary": {
      const breakdown = [
        { name: "Settled in full", value: curPaid.filter((o) => o.status === "paid").reduce((s, o) => s + Number(o.amount), 0), count: curPaid.filter((o) => o.status === "paid").length, share: 0, color: "#10B981" },
        { name: "Deposits collected", value: curPaid.filter((o) => o.status === "deposit_paid").reduce((s, o) => s + getOrderCollectedAmount(o), 0), count: curPaid.filter((o) => o.status === "deposit_paid").length, share: 0, color: "#3B82F6" },
      ];
      breakdown.forEach((b) => {
        b.share = curRevenue > 0 ? Math.round((b.value / curRevenue) * 100) : 0;
      });

      const topProductsMap = new Map<string, { id: number; units: number; revenue: number }>();
      curPaid.forEach((o) => {
        const name = o.productName || `Item #${o.productId}`;
        const ex = topProductsMap.get(name) || { id: o.productId, units: 0, revenue: 0 };
        ex.units += 1;
        ex.revenue += getRev(o);
        topProductsMap.set(name, ex);
      });
      const topProductsRows = Array.from(topProductsMap.entries())
        .sort((a, b) => b[1].revenue - a[1].revenue)
        .slice(0, 10)
        .map(([name, data]) => [name, data.units, `${currency}${data.revenue.toFixed(2)}`]);

      return {
        report: config,
        period: { from, to, compareFrom, compareTo, isFairMtd },
        kpis: [
          { id: "revenue", label: "Total revenue", value: `${currency}${curRevenue.toFixed(2)}`, description: "Realized cash collected from buyers", delta: revDelta.percent, isNew: revDelta.isNew, format: "currency" },
          { id: "orders", label: "Total orders", value: curCount, description: "Total placed orders", delta: countDelta.percent, isNew: countDelta.isNew, format: "integer" },
          { id: "aov", label: "Average order value", value: `${currency}${curAov.toFixed(2)}`, description: "Gross order value divided by placed orders", delta: aovDelta.percent, isNew: aovDelta.isNew, format: "currency" },
          { id: "order_value", label: "Gross order value", value: `${currency}${curOrderVal.toFixed(2)}`, description: "Sum of placed order amounts including unpaid", format: "currency" },
        ],
        timeSeries,
        breakdownList: breakdown,
        summaryBullets: [
          `Collected ${currency}${curRevenue.toFixed(2)} across ${curCount} orders in this period.`,
          revDelta.percent !== null ? `Revenue is ${revDelta.percent >= 0 ? "up" : "down"} ${Math.abs(revDelta.percent)}% vs comparison period.` : "First sales recorded in this period.",
          `Average order basket size is ${currency}${curAov.toFixed(2)}.`,
        ],
        dataTable: {
          title: "Top Products by Revenue",
          headers: ["Product", "Units Sold", "Revenue"],
          rows: topProductsRows,
        },
        calculationNote: defaultNote,
        lastUpdated: nowIso,
      };
    }

    case "sales-by-channel": {
      const channelColors: Record<string, string> = {
        whatsapp: "#25D366",
        instagram: "#E1306C",
        tiktok: "#111111",
        snapchat: "#EAB308",
        in_person: "#6366F1",
        direct: "#3B82F6",
      };
      const channelLabels: Record<string, string> = {
        whatsapp: "WhatsApp",
        instagram: "Instagram",
        tiktok: "TikTok",
        snapchat: "Snapchat",
        in_person: "In person",
        direct: "Direct",
      };

      const chMap = new Map<string, { revenue: number; orders: number }>();
      curPlaced.forEach((o) => {
        const ch = (o.channel || "direct").toLowerCase();
        const ex = chMap.get(ch) || { revenue: 0, orders: 0 };
        ex.orders += 1;
        if (isPaid(o)) ex.revenue += getRev(o);
        chMap.set(ch, ex);
      });

      const breakdown = Array.from(chMap.entries()).map(([ch, data]) => ({
        id: ch,
        name: channelLabels[ch] || ch,
        value: data.revenue,
        count: data.orders,
        color: channelColors[ch] || "#94A3B8",
        share: curRevenue > 0 ? Math.round((data.revenue / curRevenue) * 100) : 0,
        link: `/orders?channel=${ch}`,
      })).sort((a, b) => b.value - a.value);

      const topCh = breakdown[0]?.name || "None";

      return {
        report: config,
        period: { from, to, compareFrom, compareTo, isFairMtd },
        kpis: [
          { id: "revenue", label: "Channel revenue", value: `${currency}${curRevenue.toFixed(2)}`, description: "Cash collected across all channels", delta: revDelta.percent, isNew: revDelta.isNew, format: "currency" },
          { id: "orders", label: "Channel orders", value: curCount, description: "Total orders initiated across channels", delta: countDelta.percent, isNew: countDelta.isNew, format: "integer" },
          { id: "top_channel", label: "Top channel", value: topCh, description: "Channel with highest revenue volume", format: "integer" },
        ],
        timeSeries,
        breakdownList: breakdown,
        summaryBullets: [
          `${topCh} is your leading sales channel, generating ${breakdown[0]?.share || 0}% of total revenue.`,
          `Multi-channel orders totaled ${curCount} orders.`,
        ],
        dataTable: {
          title: "Channel Performance Summary",
          headers: ["Channel", "Orders", "Revenue", "Revenue Share"],
          rows: breakdown.map((b) => [b.name, b.count || 0, `${currency}${b.value.toFixed(2)}`, `${b.share}%`]),
        },
        calculationNote: defaultNote,
        lastUpdated: nowIso,
      };
    }

    case "orders-overview": {
      const fulfillmentCounts = { pending: 0, processing: 0, shipped: 0, delivered: 0, cancelled: 0 };
      curOrders.forEach((o: any) => {
        const f = (o.fulfillment || "pending").toLowerCase();
        if (f in fulfillmentCounts) (fulfillmentCounts as any)[f]++;
        else fulfillmentCounts.pending++;
      });

      const breakdown = [
        { name: "Delivered", value: fulfillmentCounts.delivered, count: fulfillmentCounts.delivered, color: "#10B981", share: curOrders.length ? Math.round((fulfillmentCounts.delivered / curOrders.length) * 100) : 0 },
        { name: "Shipped", value: fulfillmentCounts.shipped, count: fulfillmentCounts.shipped, color: "#6366F1", share: curOrders.length ? Math.round((fulfillmentCounts.shipped / curOrders.length) * 100) : 0 },
        { name: "Processing", value: fulfillmentCounts.processing, count: fulfillmentCounts.processing, color: "#F59E0B", share: curOrders.length ? Math.round((fulfillmentCounts.processing / curOrders.length) * 100) : 0 },
        { name: "Pending", value: fulfillmentCounts.pending, count: fulfillmentCounts.pending, color: "#94A3B8", share: curOrders.length ? Math.round((fulfillmentCounts.pending / curOrders.length) * 100) : 0 },
      ];

      return {
        report: config,
        period: { from, to, compareFrom, compareTo, isFairMtd },
        kpis: [
          { id: "orders", label: "Total orders", value: curCount, description: "Total placed orders", delta: countDelta.percent, isNew: countDelta.isNew, format: "integer" },
          { id: "delivered", label: "Delivered", value: fulfillmentCounts.delivered, description: "Successfully fulfilled orders", format: "integer" },
          { id: "pending_fulfillment", label: "Pending fulfillment", value: fulfillmentCounts.pending + fulfillmentCounts.processing, description: "Orders awaiting shipment", format: "integer" },
        ],
        timeSeries: timeSeries.map((t) => ({ ...t, current: t.orders, comparison: 0 })),
        breakdownList: breakdown,
        summaryBullets: [
          `${fulfillmentCounts.delivered} orders have been marked as delivered.`,
          `${fulfillmentCounts.pending + fulfillmentCounts.processing} open orders require dispatch.`,
        ],
        calculationNote: defaultNote,
        lastUpdated: nowIso,
      };
    }

    case "expenses": {
      const catMap = new Map<string, number>();
      curExpenses.forEach((e) => {
        const c = e.category || "General";
        catMap.set(c, (catMap.get(c) || 0) + Number(e.amount));
      });
      const totExpenses = curExpenses.reduce((s, e) => s + Number(e.amount), 0);
      const prevTotExpenses = prevExpenses.reduce((s, e) => s + Number(e.amount), 0);
      const expDelta = calculateDelta(totExpenses, prevTotExpenses);

      const breakdown = Array.from(catMap.entries()).map(([c, val]) => ({
        name: c.charAt(0).toUpperCase() + c.slice(1),
        value: val,
        count: curExpenses.filter((e) => (e.category || "General") === c).length,
        share: totExpenses > 0 ? Math.round((val / totExpenses) * 100) : 0,
      })).sort((a, b) => b.value - a.value);

      return {
        report: config,
        period: { from, to, compareFrom, compareTo, isFairMtd },
        kpis: [
          { id: "expenses", label: "Total expenses", value: `${currency}${totExpenses.toFixed(2)}`, description: "Operating expenses logged in period", delta: expDelta.percent, isNew: expDelta.isNew, lowerIsBetter: true, format: "currency" },
          { id: "entries", label: "Expense entries", value: curExpenses.length, description: "Count of logged expenses", format: "integer" },
        ],
        timeSeries: timeSeries.map((t) => {
          const dayExp = curExpenses.filter((e) => e.expenseDate === t.date).reduce((s, e) => s + Number(e.amount), 0);
          return { ...t, current: dayExp, comparison: 0 };
        }),
        breakdownList: breakdown,
        summaryBullets: [
          `Total operating expenses logged: ${currency}${totExpenses.toFixed(2)}.`,
          breakdown[0] ? `Largest expense category is ${breakdown[0].name} (${currency}${breakdown[0].value.toFixed(2)}).` : "No expenses recorded yet.",
        ],
        dataTable: {
          title: "Recent Logged Expenses",
          headers: ["Title", "Category", "Date", "Amount"],
          rows: curExpenses.slice(0, 15).map((e: any) => [e.title || "Expense", e.category, e.expenseDate, `${currency}${Number(e.amount).toFixed(2)}`]),
        },
        calculationNote: defaultNote,
        lastUpdated: nowIso,
      };
    }

    case "inventory-health": {
      let totalRetail = 0;
      let totalCost = 0;
      let totalUnits = 0;
      let lowStockCount = 0;
      let outOfStockCount = 0;

      const productRows: Array<[string, number, string, string]> = [];
      products.forEach((p) => {
        const stk = Number(p.stock || 0);
        const pr = Number(p.price || 0);
        const cst = Number(p.cost || 0);
        totalUnits += stk;
        totalRetail += stk * pr;
        totalCost += stk * cst;
        if (stk === 0) outOfStockCount++;
        else if (stk <= 3) lowStockCount++;
        productRows.push([p.name, stk, `${currency}${pr.toFixed(2)}`, `${currency}${(stk * pr).toFixed(2)}`]);
      });

      return {
        report: config,
        period: { from, to, compareFrom, compareTo, isFairMtd },
        kpis: [
          { id: "retail_val", label: "Retail valuation", value: `${currency}${totalRetail.toFixed(2)}`, description: "Total inventory value at selling price", format: "currency" },
          { id: "cost_val", label: "Cost valuation", value: `${currency}${totalCost.toFixed(2)}`, description: "Total inventory value at cost price", format: "currency" },
          { id: "units", label: "Total stock units", value: totalUnits, description: "Active merchandise quantity on hand", format: "integer" },
          { id: "low_stock", label: "Low & Out of stock", value: lowStockCount + outOfStockCount, description: "Products needing replenishment", lowerIsBetter: true, format: "integer" },
        ],
        breakdownList: [
          { name: "Healthy stock (>3)", value: Math.max(0, products.length - lowStockCount - outOfStockCount), share: products.length ? Math.round(((products.length - lowStockCount - outOfStockCount) / products.length) * 100) : 0, color: "#10B981" },
          { name: "Low stock (1-3)", value: lowStockCount, share: products.length ? Math.round((lowStockCount / products.length) * 100) : 0, color: "#F59E0B" },
          { name: "Out of stock (0)", value: outOfStockCount, share: products.length ? Math.round((outOfStockCount / products.length) * 100) : 0, color: "#EF4444" },
        ],
        summaryBullets: [
          `Total inventory retail value is ${currency}${totalRetail.toFixed(2)} across ${totalUnits} units.`,
          lowStockCount > 0 ? `${lowStockCount} products are low in stock (3 or fewer units left).` : "No low stock alerts right now.",
        ],
        dataTable: {
          title: "Product Stock Valuations",
          headers: ["Product", "Stock", "Unit Price", "Total Value"],
          rows: productRows.slice(0, 15),
        },
        calculationNote: defaultNote,
        lastUpdated: nowIso,
      };
    }

    case "sales-over-time":
    case "product-performance":
    case "best-times-to-sell":
    case "payments-and-outstanding":
    case "profit-and-margin":
    case "customer-insights":
    default: {
      // General handler for all remaining reports
      const cogs = curPaid.reduce((s, o) => {
        const p = productMap.get(o.productId);
        return s + (o.productCost != null ? Number(o.productCost) : p?.cost != null ? Number(p.cost) : 0);
      }, 0);
      const opex = curExpenses.reduce((s, e) => s + Number(e.amount), 0);
      const netProfit = curRevenue - cogs - opex;

      const productPerformanceMap = new Map<string, { id: number; units: number; rev: number; cost: number }>();
      curPaid.forEach((o) => {
        const name = o.productName || `Item #${o.productId}`;
        const p = productMap.get(o.productId);
        const ex = productPerformanceMap.get(name) || { id: o.productId, units: 0, rev: 0, cost: 0 };
        ex.units += 1;
        ex.rev += getRev(o);
        ex.cost += o.productCost != null ? Number(o.productCost) : p?.cost != null ? Number(p.cost) : 0;
        productPerformanceMap.set(name, ex);
      });

      const prodRows = Array.from(productPerformanceMap.entries())
        .sort((a, b) => b[1].rev - a[1].rev)
        .map(([name, d]) => [
          name,
          d.units,
          `${currency}${d.rev.toFixed(2)}`,
          d.rev > 0 ? `${Math.round(((d.rev - d.cost) / d.rev) * 100)}%` : "0%",
        ]);

      // Heatmap generation
      const heatmap: ReportDetailResponse["heatmap"] = [];
      const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      weekdays.forEach((wd) => {
        for (let h = 0; h < 24; h += 3) {
          heatmap.push({
            weekday: wd,
            hour: h,
            count: 0,
            revenue: 0,
          });
        }
      });
      curPaid.forEach((o) => {
        const d = new Date(o.createdAt);
        const wd = weekdays[d.getUTCDay()];
        const hBucket = Math.floor(d.getUTCHours() / 3) * 3;
        const entry = heatmap.find((item) => item.weekday === wd && item.hour === hBucket);
        if (entry) {
          entry.count++;
          entry.revenue += getRev(o);
        }
      });

      return {
        report: config,
        period: { from, to, compareFrom, compareTo, isFairMtd },
        kpis: [
          { id: "revenue", label: "Collected revenue", value: `${currency}${curRevenue.toFixed(2)}`, description: "Cash collected from sales", delta: revDelta.percent, isNew: revDelta.isNew, format: "currency" },
          { id: "orders", label: "Orders", value: curCount, description: "Placed orders", delta: countDelta.percent, isNew: countDelta.isNew, format: "integer" },
          { id: "profit", label: "Net profit", value: `${currency}${netProfit.toFixed(2)}`, description: "Revenue minus COGS and OpEx", format: "currency" },
          { id: "aov", label: "Average order value", value: `${currency}${curAov.toFixed(2)}`, description: "Average revenue per order", format: "currency" },
        ],
        timeSeries,
        summaryBullets: [
          `Reported ${currency}${curRevenue.toFixed(2)} across ${curCount} orders.`,
          `Net profit is ${currency}${netProfit.toFixed(2)} after COGS and operating deductions.`,
        ],
        dataTable: {
          title: "Product Performance",
          headers: ["Product", "Units", "Revenue", "Estimated Margin"],
          rows: prodRows.slice(0, 15),
        },
        heatmap,
        waterfall: [
          { item: "Revenue", amount: curRevenue, type: "positive", percentageOfRevenue: 100 },
          { item: "Cost of Goods (COGS)", amount: cogs, type: "negative", percentageOfRevenue: curRevenue ? Math.round((cogs / curRevenue) * 100) : 0 },
          { item: "Operating Expenses (OpEx)", amount: opex, type: "negative", percentageOfRevenue: curRevenue ? Math.round((opex / curRevenue) * 100) : 0 },
          { item: "Net Profit", amount: netProfit, type: "total", percentageOfRevenue: curRevenue ? Math.round((netProfit / curRevenue) * 100) : 0 },
        ],
        calculationNote: defaultNote,
        lastUpdated: nowIso,
      };
    }
  }
}

