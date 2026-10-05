/**
 * Canonical metrics module for Take Order platform.
 * Implements canonical definitions documented in docs/METRICS.md.
 */

import { formatCustomerName } from '@/lib/formatters';

export interface MetricOrder {
  id: number;
  token?: string;
  productId: number;
  productName: string;
  customerName?: string | null;
  customerPhone?: string | null;
  channel: string;
  amount: number | string;
  depositAmount?: number | string | null;
  productCost?: number | string | null;
  paymentMode?: string;
  status: string;
  fulfillment?: string;
  createdAt: string | Date;
}

export interface MetricProduct {
  id: number;
  name: string;
  price: number | string;
  cost?: number | string | null;
  stock?: number;
  category?: string;
}

export interface MetricExpense {
  id?: number;
  amount: number | string;
  category?: string;
  description?: string;
  title?: string;
  date?: string;
  expenseDate?: string;
}

export interface ClientCohort {
  id: string;
  name: string;
  phone: string;
  orderCount: number;
  totalSpent: number;
  lastOrderDate: string;
}

export interface OutstandingOrderSummary {
  id: number;
  token?: string;
  customerName: string;
  customerPhone: string;
  productName: string;
  amount: number;
  collected: number;
  balanceDue: number;
  createdAt: string;
  daysAgo: number;
}

export interface ChannelStat {
  channel: string;
  label: string;
  color: string;
  revenue: number;
  orders: number;
  sharePercentage: number;
}

export interface CalculatedMetrics {
  totalOrdersCount: number;
  orderValue: number;
  totalRevenue: number;
  outstanding: number;
  avgOrderValue: number;
  totalProductCosts: number;
  totalExpenses: number;
  netProfit: number;
  profitMargin: number;
  missingCostProducts: Array<{ id: number; name: string }>;
  clientCounts: {
    totalClients: number;
    repeatClients: number;
    rate: number;
    topRepeatClients: ClientCohort[];
  };
  aovBuckets: Array<{
    range: string;
    label: string;
    count: number;
    percentage: number;
  }>;
  outstandingAging: {
    under7Days: OutstandingOrderSummary[];
    between7And14Days: OutstandingOrderSummary[];
    over14Days: OutstandingOrderSummary[];
    totalDue: number;
  };
  inventory: {
    totalRetailValue: number;
    totalCostValue: number;
    potentialProfit: number;
    totalUnits: number;
    lowStockCount: number;
    topValuedItems: Array<{
      id: number;
      name: string;
      stock: number;
      cost: number;
      price: number;
      totalValue: number;
    }>;
  };
  channels: ChannelStat[];
}

export const CHANNEL_COLORS: Record<string, string> = {
  whatsapp: '#25D366',
  instagram: '#E1306C',
  tiktok: '#111111',
  snapchat: '#EAB308', // accessible amber/yellow
  in_person: '#6366F1',
  direct: '#3B82F6',
};

export const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  snapchat: 'Snapchat',
  in_person: 'In person',
  direct: 'Direct',
};

/**
 * Defends against CSV formula injection by prepending a single quote
 * if cell text begins with =, +, -, or @.
 */
export function sanitizeCsvCell(val: unknown): string {
  if (val == null) return '""';
  let str = String(val).trim();
  if (/^[=+\-@]/.test(str)) {
    str = `'${str}`;
  }
  return `"${str.replace(/"/g, '""')}"`;
}

const toFinite = (val: unknown): number => {
  if (val == null) return 0;
  const num = typeof val === 'number' ? val : Number(val);
  return Number.isFinite(num) ? num : 0;
};

/**
 * Calculates unified financial, operational, and customer metrics.
 */
export function calculateUnifiedMetrics(params: {
  orders: MetricOrder[];
  products: MetricProduct[];
  expenses: MetricExpense[];
  periodRange?: { from: string; to: string } | null;
  serverSummary?: any;
}): CalculatedMetrics {
  const { orders: allOrders, products, expenses, periodRange, serverSummary } = params;

  // Filter orders in active period (by created date in ISO/local)
  const periodOrders = periodRange
    ? allOrders.filter((o) => {
        const d = typeof o.createdAt === 'string' ? o.createdAt.slice(0, 10) : new Date(o.createdAt).toISOString().slice(0, 10);
        return d >= periodRange.from && d <= periodRange.to;
      })
    : allOrders;

  // Placed orders exclude draft link placeholders (status: 'reserved') and cancelled orders
  const placedOrders = periodOrders.filter((o) => o.status !== 'reserved' && o.status !== 'cancelled');
  const paidOrders = placedOrders.filter((o) => o.status === 'paid' || o.status === 'deposit_paid');

  // 1. Order Value & Total Orders
  const orderValue = placedOrders.reduce((sum, o) => sum + toFinite(o.amount), 0);
  const totalOrdersCount = placedOrders.length;
  const avgOrderValue = totalOrdersCount > 0 ? orderValue / totalOrdersCount : 0;

  // 2. Revenue collected
  const totalRevenue = paidOrders.reduce((sum, o) => {
    if (o.status === 'deposit_paid') {
      return sum + toFinite(o.depositAmount);
    }
    return sum + toFinite(o.amount);
  }, 0);

  // 3. Outstanding balance on open orders
  const openOrders = placedOrders.filter((o) => o.status === 'deposit_paid' || o.status === 'pending' || o.status === 'unpaid');
  const outstanding = openOrders.reduce((sum, o) => {
    if (o.status === 'deposit_paid') {
      return sum + Math.max(0, toFinite(o.amount) - toFinite(o.depositAmount));
    }
    return sum + toFinite(o.amount);
  }, 0);

  // 4. Product Costs (COGS) & Missing Costs Detection
  const productMap = new Map<number, MetricProduct>(products.map((p) => [p.id, p]));
  const missingCostProductIds = new Set<number>();

  let totalProductCosts = 0;
  for (const o of paidOrders) {
    if (o.productCost != null && toFinite(o.productCost) > 0) {
      totalProductCosts += toFinite(o.productCost);
    } else {
      const prod = productMap.get(o.productId);
      if (prod?.cost != null && toFinite(prod.cost) > 0) {
        totalProductCosts += toFinite(prod.cost);
      } else if (prod) {
        missingCostProductIds.add(prod.id);
      }
    }
  }

  const missingCostProducts = Array.from(missingCostProductIds).map((id) => ({
    id,
    name: productMap.get(id)?.name || `Item #${id}`,
  }));

  // 5. Operating Expenses & Net Profit
  const totalExpenses = expenses.reduce((sum, e) => sum + toFinite(e.amount), 0);
  const netProfit = totalRevenue - totalProductCosts - totalExpenses;
  const profitMargin = totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 100) : 0;

  // 6. Returning clients & Cohorts
  const clientMap = new Map<string, { name: string; phone: string; count: number; totalSpent: number; lastDate: string }>();
  allOrders.forEach((o) => {
    if (o.status === 'reserved' || o.status === 'cancelled') return;
    const phone = o.customerPhone?.trim() || '';
    const name = o.customerName?.trim() || '';
    const key = phone || name;
    if (!key || key.toLowerCase() === 'waiting for buyer' || key.toLowerCase() === 'awaiting' || key.toLowerCase() === 'buyer pending') return;

    const existing = clientMap.get(key) || { name: name || phone, phone, count: 0, totalSpent: 0, lastDate: '' };
    existing.count += 1;
    existing.totalSpent += toFinite(o.amount);
    const orderDate = typeof o.createdAt === 'string' ? o.createdAt.slice(0, 10) : new Date(o.createdAt).toISOString().slice(0, 10);
    if (!existing.lastDate || orderDate > existing.lastDate) {
      existing.lastDate = orderDate;
    }
    clientMap.set(key, existing);
  });

  const totalClients = clientMap.size;
  const repeatClientsList = Array.from(clientMap.entries())
    .filter(([_, data]) => data.count > 1)
    .map(([id, data]) => ({
      id,
      name: data.name,
      phone: data.phone,
      orderCount: data.count,
      totalSpent: data.totalSpent,
      lastOrderDate: data.lastDate,
    }))
    .sort((a, b) => b.totalSpent - a.totalSpent);

  const repeatCount = repeatClientsList.length;
  const repeatRate = totalClients > 0 ? Math.round((repeatCount / totalClients) * 100) : 0;

  // 7. AOV Distribution Buckets
  const bucketCounts = { under100: 0, b100to300: 0, b300to500: 0, over500: 0 };
  placedOrders.forEach((o) => {
    const val = Number(o.amount || 0);
    if (val < 100) bucketCounts.under100 += 1;
    else if (val <= 300) bucketCounts.b100to300 += 1;
    else if (val <= 500) bucketCounts.b300to500 += 1;
    else bucketCounts.over500 += 1;
  });

  const aovBuckets = [
    { range: '<100', label: '< 100', count: bucketCounts.under100, percentage: totalOrdersCount ? Math.round((bucketCounts.under100 / totalOrdersCount) * 100) : 0 },
    { range: '100-300', label: '100 – 300', count: bucketCounts.b100to300, percentage: totalOrdersCount ? Math.round((bucketCounts.b100to300 / totalOrdersCount) * 100) : 0 },
    { range: '300-500', label: '300 – 500', count: bucketCounts.b300to500, percentage: totalOrdersCount ? Math.round((bucketCounts.b300to500 / totalOrdersCount) * 100) : 0 },
    { range: '500+', label: '500+', count: bucketCounts.over500, percentage: totalOrdersCount ? Math.round((bucketCounts.over500 / totalOrdersCount) * 100) : 0 },
  ];

  // 8. Outstanding Aging Buckets
  const nowMs = Date.now();
  const aging = {
    under7Days: [] as OutstandingOrderSummary[],
    between7And14Days: [] as OutstandingOrderSummary[],
    over14Days: [] as OutstandingOrderSummary[],
    totalDue: 0,
  };

  openOrders.forEach((o) => {
    const totalAmt = Number(o.amount || 0);
    const collected = o.status === 'deposit_paid' ? Number(o.depositAmount || 0) : 0;
    const balanceDue = Math.max(0, totalAmt - collected);
    if (balanceDue <= 0) return;

    aging.totalDue += balanceDue;
    const createdMs = new Date(o.createdAt).getTime();
    const daysAgo = Math.max(0, Math.floor((nowMs - createdMs) / (1000 * 60 * 60 * 24)));
    const dateStr = typeof o.createdAt === 'string' ? o.createdAt.slice(0, 10) : new Date(o.createdAt).toISOString().slice(0, 10);

    const summaryItem: OutstandingOrderSummary = {
      id: o.id,
      token: o.token,
      customerName: formatCustomerName(o.customerName),
      customerPhone: o.customerPhone || '',
      productName: o.productName,
      amount: totalAmt,
      collected,
      balanceDue,
      createdAt: dateStr,
      daysAgo,
    };

    if (daysAgo < 7) {
      aging.under7Days.push(summaryItem);
    } else if (daysAgo <= 14) {
      aging.between7And14Days.push(summaryItem);
    } else {
      aging.over14Days.push(summaryItem);
    }
  });

  // 9. Inventory Valuation
  let totalRetailValue = 0;
  let totalCostValue = 0;
  let totalUnits = 0;
  let lowStockCount = 0;

  const itemValuations = products.map((p) => {
    const stock = Number(p.stock || 0);
    const price = Number(p.price || 0);
    const cost = Number(p.cost || 0);
    const totalValue = stock * price;
    totalRetailValue += totalValue;
    totalCostValue += stock * cost;
    totalUnits += stock;
    if (stock <= 3) lowStockCount += 1;
    return {
      id: p.id,
      name: p.name,
      stock,
      cost,
      price,
      totalValue,
    };
  }).sort((a, b) => b.totalValue - a.totalValue);

  // 10. Channel Breakdown (using Revenue as the primary measure)
  const channelMap = new Map<string, { revenue: number; orders: number }>();
  Object.keys(CHANNEL_LABELS).forEach((c) => channelMap.set(c, { revenue: 0, orders: 0 }));

  placedOrders.forEach((o) => {
    const ch = (o.channel || 'direct').toLowerCase();
    const existing = channelMap.get(ch) || { revenue: 0, orders: 0 };
    existing.orders += 1;
    if (o.status === 'paid') existing.revenue += Number(o.amount || 0);
    else if (o.status === 'deposit_paid') existing.revenue += Number(o.depositAmount || 0);
    channelMap.set(ch, existing);
  });

  const channels: ChannelStat[] = Array.from(channelMap.entries())
    .map(([channel, data]) => ({
      channel,
      label: CHANNEL_LABELS[channel] || channel,
      color: CHANNEL_COLORS[channel] || '#6B7280',
      revenue: data.revenue,
      orders: data.orders,
      sharePercentage: totalRevenue > 0 ? Math.round((data.revenue / totalRevenue) * 100) : 0,
    }))
    .filter((c) => c.orders > 0 || c.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue);

  return {
    totalOrdersCount,
    orderValue,
    totalRevenue,
    outstanding,
    avgOrderValue,
    totalProductCosts,
    totalExpenses,
    netProfit,
    profitMargin,
    missingCostProducts,
    clientCounts: {
      totalClients,
      repeatClients: repeatCount,
      rate: repeatRate,
      topRepeatClients: repeatClientsList.slice(0, 5),
    },
    aovBuckets,
    outstandingAging: aging,
    inventory: {
      totalRetailValue,
      totalCostValue,
      potentialProfit: totalRetailValue - totalCostValue,
      totalUnits,
      lowStockCount,
      topValuedItems: itemValuations.slice(0, 5),
    },
    channels,
  };
}
