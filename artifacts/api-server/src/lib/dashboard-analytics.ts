export type AnalyticsProduct = {
  id: number;
  name: string;
  category: string;
  cost: string | number | null;
  stock: number;
};

export type AnalyticsOrder = {
  productId: number;
  productName: string;
  channel: string;
  amount: string | number;
  productCost?: string | number | null;
  depositAmount: string | number | null;
  status: string;
  createdAt: Date;
  linkOpens: number;
  shares?: number | null;
  likes?: number | null;
  engagementSource?: string | null;
};

export type AnalyticsExpense = {
  amount: string | number;
  expenseDate: string;
};

export type DashboardSummary = {
  revenue: number;
  productCosts: number;
  estimatedProductCosts: number;
  operatingExpenses: number;
  expenses: number;
  profit: number;
  cashBalance: number;
  orders: number;
  snapshotOrders: number;
  legacyOrders: number;
  legacyRevenue: number;
  outstanding: number;
  bestSeller: string;
  shares: number | null;
  likes: number | null;
  channelPerformance: Array<{
    channel: string;
    revenue: number;
    orders: number;
    paidOrders: number;
    opens: number;
    conversionRate: number;
  }>;
  insights: string[];
  dailyPerformance: Array<{
    date: string;
    label: string;
    revenue: number;
    productCosts: number;
    operatingExpenses: number;
    expenses: number;
    profit: number;
    orders: number;
  }>;
  productPerformance: Array<{
    name: string;
    category: string;
    revenue: number;
    orders: number;
    stock: number;
    margin: number;
    costTracked: boolean;
    marginStatus: "tracked" | "estimated" | "unavailable";
    snapshotOrders: number;
    legacyOrders: number;
  }>;
};

export type DashboardRange = {
  from?: string;
  to?: string;
};

export function stockDeltaForOrderStatusChange(
  previousStatus: string,
  nextStatus: string,
): number {
  if (nextStatus === "paid" && previousStatus !== "paid") return -1;
  if (nextStatus !== "paid" && previousStatus === "paid") return 1;
  return 0;
}

const channelLabels: Record<string, string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  tiktok: "TikTok",
  snapchat: "Snapchat",
  in_person: "In person",
};

const isPaidOrder = (order: AnalyticsOrder) =>
  order.status === "paid" || order.status === "deposit_paid";

const orderRevenue = (order: AnalyticsOrder) =>
  order.status === "deposit_paid"
    ? Number(order.depositAmount ?? 0)
    : Number(order.amount);

const productCost = (product: AnalyticsProduct | undefined) =>
  product?.cost == null ? 0 : Number(product.cost);

const orderProductCost = (
  order: AnalyticsOrder,
  product: AnalyticsProduct | undefined,
) => order.productCost == null
  ? productCost(product)
  : Number(order.productCost);

const orderHasLegacyCost = (order: AnalyticsOrder) => order.productCost == null;

const orderHasTrackedCost = (order: AnalyticsOrder) =>
  order.productCost != null;

function totalRecordedEngagement(
  orders: AnalyticsOrder[],
  key: "shares" | "likes",
): number | null {
  const values = orders
    .filter((order) => order.engagementSource === "connected_account")
    .map((order) => order[key])
    .filter((value): value is number => value != null && Number.isFinite(Number(value)));
  return values.length ? values.reduce((total, value) => total + Number(value), 0) : null;
}

export function calculateDashboardSummary(
  products: AnalyticsProduct[],
  orders: AnalyticsOrder[],
  operatingExpenseRows: AnalyticsExpense[],
  now = new Date(),
  range?: DashboardRange,
): DashboardSummary {
  const productMap = new Map(products.map((product) => [product.id, product]));
  const orderIsInRange = (order: AnalyticsOrder) => {
    const date = order.createdAt.toISOString().slice(0, 10);
    return (!range?.from || date >= range.from) && (!range?.to || date <= range.to);
  };
  const expenseIsInRange = (expense: AnalyticsExpense) =>
    (!range?.from || expense.expenseDate >= range.from) &&
    (!range?.to || expense.expenseDate <= range.to);
  const scopedOrders = orders.filter(orderIsInRange);
  const scopedExpenseRows = operatingExpenseRows.filter(expenseIsInRange);
  const paidOrders = scopedOrders.filter(isPaidOrder);
  const revenue = paidOrders.reduce((sum, order) => sum + orderRevenue(order), 0);
  const legacyOrders = paidOrders.filter(orderHasLegacyCost);
  const snapshotOrders = paidOrders.length - legacyOrders.length;
  const legacyRevenue = legacyOrders.reduce(
    (sum, order) => sum + orderRevenue(order),
    0,
  );
  const estimatedProductCosts = legacyOrders.reduce(
    (sum, order) => sum + productCost(productMap.get(order.productId)),
    0,
  );
  const productCosts = paidOrders.reduce(
    (sum, order) =>
      sum + orderProductCost(order, productMap.get(order.productId)),
    0,
  );
  const operatingExpenses = scopedExpenseRows.reduce(
    (sum, expense) => sum + Number(expense.amount),
    0,
  );
  const expenses = productCosts + operatingExpenses;
  const profit = revenue - expenses;
  const outstanding = scopedOrders
    .filter((order) => order.status === "deposit_paid")
    .reduce(
      (sum, order) =>
        sum + Math.max(0, Number(order.amount) - Number(order.depositAmount ?? 0)),
      0,
    );
  const bestSeller = paidOrders.reduce<{ name: string; count: number }>(
    (best, order) => {
      const count = paidOrders.filter(
        (item) => item.productId === order.productId,
      ).length;
      return count > best.count ? { name: order.productName, count } : best;
    },
    { name: "No sales yet", count: 0 },
  ).name;
  const channelPerformance = Object.entries(channelLabels)
    .map(([channel, label]) => {
      const matching = scopedOrders.filter((order) => order.channel === channel);
      const paidMatching = matching.filter(isPaidOrder);
      const opens = matching.reduce((sum, order) => sum + order.linkOpens, 0);
      return {
        channel: label,
        revenue: matching
          .filter((order) => order.status !== "reserved")
          .reduce((sum, order) => sum + orderRevenue(order), 0),
        orders: matching.filter((order) => order.status !== "reserved").length,
        paidOrders: paidMatching.length,
        opens,
        conversionRate: opens ? (paidMatching.length / opens) * 100 : 0,
      };
    })
    .filter((item) => item.orders > 0 || item.opens > 0);

  const today = new Date(now);
  today.setUTCHours(0, 0, 0, 0);
  const defaultStart = new Date(today);
  defaultStart.setUTCDate(today.getUTCDate() - 6);
  const rangeStart = range?.from ? new Date(`${range.from}T00:00:00.000Z`) : defaultStart;
  const rangeEnd = range?.to ? new Date(`${range.to}T00:00:00.000Z`) : today;
  const totalDays = Math.max(1, Math.floor((rangeEnd.getTime() - rangeStart.getTime()) / 86_400_000) + 1);
  const dayCount = Math.min(totalDays, 366);
  const dailyStart = new Date(rangeEnd);
  dailyStart.setUTCDate(rangeEnd.getUTCDate() - (dayCount - 1));
  const dailyPerformance = Array.from({ length: dayCount }, (_, index) => {
    const day = new Date(dailyStart);
    day.setUTCDate(dailyStart.getUTCDate() + index);
    const date = day.toISOString().slice(0, 10);
    const dayOrders = paidOrders.filter(
      (order) => order.createdAt.toISOString().slice(0, 10) === date,
    );
    const dayRevenue = dayOrders.reduce(
      (sum, order) => sum + orderRevenue(order),
      0,
    );
    const dayProductCosts = dayOrders.reduce(
      (sum, order) =>
        sum + orderProductCost(order, productMap.get(order.productId)),
      0,
    );
    const dayOperatingExpenses = scopedExpenseRows
      .filter((expense) => expense.expenseDate === date)
      .reduce((sum, expense) => sum + Number(expense.amount), 0);
    const dayExpenses = dayProductCosts + dayOperatingExpenses;
    return {
      date,
      label: dayCount <= 14
        ? day.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" })
        : day.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }),
      revenue: dayRevenue,
      productCosts: dayProductCosts,
      operatingExpenses: dayOperatingExpenses,
      expenses: dayExpenses,
      profit: dayRevenue - dayExpenses,
      orders: dayOrders.length,
    };
  });

  const productPerformance = products
    .map((product) => {
      const productOrders = paidOrders.filter(
        (order) => order.productId === product.id,
      );
      const productRevenue = productOrders.reduce(
        (sum, order) => sum + orderRevenue(order),
        0,
      );
      const productExpenses =
        productOrders.reduce(
          (sum, order) => sum + orderProductCost(order, product),
          0,
        );
      const productLegacyOrders = productOrders.filter(orderHasLegacyCost);
      const productSnapshotOrders =
        productOrders.length - productLegacyOrders.length;
      const costTracked =
        product.cost != null ||
        productOrders.some(orderHasTrackedCost);
      const marginStatus: DashboardSummary["productPerformance"][number]["marginStatus"] = !costTracked
        ? "unavailable"
        : productLegacyOrders.length
          ? "estimated"
          : "tracked";
      return {
        name: product.name,
        category: product.category,
        revenue: productRevenue,
        orders: productOrders.length,
        stock: product.stock,
        margin: costTracked && productRevenue
          ? ((productRevenue - productExpenses) / productRevenue) * 100
          : 0,
        costTracked,
        marginStatus,
        snapshotOrders: productSnapshotOrders,
        legacyOrders: productLegacyOrders.length,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);

  const lowStock = products.find((product) => product.stock <= 3);
  const insights = [
    bestSeller !== "No sales yet"
      ? `${bestSeller} is your best performer this week.`
      : "Create a Take Order link to start collecting your first sale.",
    lowStock
      ? `${lowStock.name} is down to ${lowStock.stock} left — consider restocking.`
      : "Your stock levels are healthy across the catalog.",
    outstanding > 0
      ? `You have GH₵${outstanding.toFixed(0)} in outstanding balances to follow up.`
      : "No outstanding balances right now.",
    productCosts > 0
      ? `Product costs are GH₵${productCosts.toFixed(0)}. Add operating expenses to see your true net profit.`
      : "Add cost prices to your catalog to unlock gross margin tracking.",
    operatingExpenses > 0
      ? `Operating expenses are GH₵${operatingExpenses.toFixed(0)}, included in your cash balance and net profit.`
      : "Record rent, delivery, ads, or other operating expenses to keep cash flow complete.",
  ];

  return {
    revenue,
    productCosts,
    estimatedProductCosts,
    operatingExpenses,
    expenses,
    profit,
    cashBalance: revenue - expenses,
    orders: paidOrders.length,
    snapshotOrders,
    legacyOrders: legacyOrders.length,
    legacyRevenue,
    outstanding,
    bestSeller,
    shares: totalRecordedEngagement(scopedOrders, "shares"),
    likes: totalRecordedEngagement(scopedOrders, "likes"),
    channelPerformance,
    dailyPerformance,
    productPerformance,
    insights,
  };
}