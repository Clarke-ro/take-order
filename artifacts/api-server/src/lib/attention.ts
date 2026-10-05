export type AttentionCardKey =
  | 'orders_to_ship'
  | 'low_stock'
  | 'unpaid_orders'
  | 'missing_costs'
  | 'orders';

export interface AttentionOrderInput {
  id: number;
  fulfillment: string;
  status: string;
  amount: number | string;
  createdAt: Date | string;
  updatedAt?: Date | string | null;
}

export interface AttentionProductInput {
  id: number;
  stock: number;
  cost?: number | string | null;
}

export interface CardAttention {
  count: number;
  newCount: number;
  newItemIds: number[];
}

export interface AttentionSummary {
  cards: {
    orders_to_ship: CardAttention;
    low_stock: CardAttention;
    unpaid_orders: CardAttention;
    missing_costs: CardAttention;
  };
  sidebarOrders: {
    count: number;
    newCount: number;
  };
}

export const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

/**
 * Calculates live attention state for Dashboard Recent Updates cards and sidebar badge.
 * One source of truth for both cards and sidebar.
 */
export function calculateAttentionSummary(
  orders: AttentionOrderInput[],
  products: AttentionProductInput[],
  seenMap: Record<string, Date | string | null | undefined>,
  now: Date = new Date(),
): AttentionSummary {
  const nowMs = now.getTime();
  const cutoffMs = nowMs - TWENTY_FOUR_HOURS_MS;

  const getEffectiveTime = (order: AttentionOrderInput): number => {
    const raw = order.updatedAt ?? order.createdAt;
    const date = typeof raw === 'string' ? new Date(raw) : raw;
    return date ? date.getTime() : 0;
  };

  const getSeenMs = (cardKey: string): number => {
    const val = seenMap[cardKey];
    if (!val) return 0;
    const date = typeof val === 'string' ? new Date(val) : val;
    return date ? date.getTime() : 0;
  };

  // 1. Orders to ship: fulfillment === 'pending'
  // Both 'orders_to_ship' and general 'orders' destinations clear new orders
  const ordersToShipSeenMs = Math.max(getSeenMs('orders_to_ship'), getSeenMs('orders'));
  const pendingOrders = orders.filter((o) => o.fulfillment === 'pending');
  const newPendingOrders = pendingOrders.filter((o) => {
    const time = getEffectiveTime(o);
    return time > ordersToShipSeenMs && time >= cutoffMs;
  });

  // 2. Unpaid orders: reserved, deposit_paid, or status !== 'paid' with amount > 0
  const unpaidSeenMs = getSeenMs('unpaid_orders');
  const unpaidOrders = orders.filter(
    (o) => o.status === 'reserved' || o.status === 'deposit_paid' || (o.status !== 'paid' && Number(o.amount || 0) > 0)
  );
  const newUnpaidOrders = unpaidOrders.filter((o) => {
    const time = getEffectiveTime(o);
    return time > unpaidSeenMs && time >= cutoffMs;
  });

  // 3. Low stock: stock <= 3 (no reliable transition timestamp; newCount skipped)
  const lowStockProducts = products.filter((p) => p.stock <= 3);

  // 4. Missing costs: cost == null || <= 0 (no reliable transition timestamp; newCount skipped)
  const missingCostProducts = products.filter((p) => p.cost == null || Number(p.cost || 0) <= 0);

  const cards = {
    orders_to_ship: {
      count: pendingOrders.length,
      newCount: newPendingOrders.length,
      newItemIds: newPendingOrders.map((o) => o.id),
    },
    low_stock: {
      count: lowStockProducts.length,
      newCount: 0,
      newItemIds: [],
    },
    unpaid_orders: {
      count: unpaidOrders.length,
      newCount: newUnpaidOrders.length,
      newItemIds: newUnpaidOrders.map((o) => o.id),
    },
    missing_costs: {
      count: missingCostProducts.length,
      newCount: 0,
      newItemIds: [],
    },
  };

  return {
    cards,
    sidebarOrders: {
      count: cards.orders_to_ship.count,
      newCount: cards.orders_to_ship.newCount,
    },
  };
}
