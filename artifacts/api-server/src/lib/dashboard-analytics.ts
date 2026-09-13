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
  depositAmount: string | number | null;
  status: string;
  createdAt: Date;
  linkOpens: number;
};

export type AnalyticsExpense = {
  amount: string | number;
  expenseDate: string;
};

export type DashboardSummary = {
  revenue: number;
  productCosts: number;
  operatingExpenses: number;
  expenses: number;
  profit: number;
  cashBalance: number;
  orders: number;
  outstanding: number;
  bestSeller: string;
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
  }>;
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

export function calculateDashboardSummary(
  products: AnalyticsProduct[],
  orders: AnalyticsOrder[],
  operatingExpenseRows: AnalyticsExpense[],
  now = new Date(),
): DashboardSummary {
  const productMap = new Map(products.map((product) => [product.id, product]));
  const paidOrders = orders.filter(isPaidOrder);
  const revenue = paidOrders.reduce((sum, order) => sum + orderRevenue(order), 0);
  const productCosts = paidOrders.reduce(
    (sum, order) => sum + productCost(productMap.get(order.productId)),
    0,
  );
  const operatingExpenses = operatingExpenseRows.reduce(
    (sum, expense) => sum + Number(expense.amount),
    0,
  );
  const expenses = productCosts + operatingExpenses;
  const profit = revenue - expenses;
  const outstanding = orders
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
      const matching = orders.filter((order) => order.channel === channel);
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
  const dailyPerformance = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(today);
    day.setHours(0, 0, 0, 0);
    day.setDate(today.getDate() - (6 - index));
    const date = day.toISOString().slice(0, 10);
    const dayOrders = paidOrders.filter(
      (order) => order.createdAt.toISOString().slice(0, 10) === date,
    );
    const dayRevenue = dayOrders.reduce(
      (sum, order) => sum + orderRevenue(order),
      0,
    );
    const dayProductCosts = dayOrders.reduce(
      (sum, order) => sum + productCost(productMap.get(order.productId)),
      0,
    );
    const dayOperatingExpenses = operatingExpenseRows
      .filter((expense) => expense.expenseDate === date)
      .reduce((sum, expense) => sum + Number(expense.amount), 0);
    const dayExpenses = dayProductCosts + dayOperatingExpenses;
    return {
      date,
      label: day.toLocaleDateString("en-US", { weekday: "short" }),
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
        productOrders.length * productCost(product);
      return {
        name: product.name,
        category: product.category,
        revenue: productRevenue,
        orders: productOrders.length,
        stock: product.stock,
        margin: product.cost == null
          ? 0
          : productRevenue
          ? ((productRevenue - productExpenses) / productRevenue) * 100
          : 0,
        costTracked: product.cost != null,
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
    operatingExpenses,
    expenses,
    profit,
    cashBalance: revenue - expenses,
    orders: paidOrders.length,
    outstanding,
    bestSeller,
    channelPerformance,
    dailyPerformance,
    productPerformance,
    insights,
  };
}