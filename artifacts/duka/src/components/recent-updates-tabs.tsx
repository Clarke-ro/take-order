import React from 'react';
import { Link } from 'wouter';
import { ChevronRight, ArrowRight } from 'lucide-react';
import type { Order, Product } from '@workspace/api-client-react';
import { moneyExact, formatCustomerName } from '@/lib/formatters';
import { useAttentionSummary, useMarkCardSeen, useMarkOrderRead, type AttentionCardKey } from '@/lib/attention-hooks';

export type RecentUpdatesTabsProps = {
  orders: Order[];
  products: Product[];
  outstanding: number;
  loading?: boolean;
};

interface CardHeaderProps {
  cardKey?: string;
  label: string;
  count: number;
  newCount: number;
  viewHref: string;
  viewLabel: string;
  onNavigate?: () => void;
}

function CardHeader({
  cardKey,
  label,
  count,
  newCount,
  viewHref,
  viewLabel,
  onNavigate,
}: CardHeaderProps) {
  const hasNew = newCount > 0;
  const isZero = count === 0;

  // Screen reader accessible announcement: "Orders to ship, 3, 2 new" or "Orders to ship, 0"
  const readableLabel = label.charAt(0).toUpperCase() + label.slice(1).toLowerCase();
  const srText = `${readableLabel}, ${count}${hasNew ? `, ${newCount} new` : ''}`;

  return (
    <div className="flex items-center justify-between" data-testid={cardKey ? `card-header-${cardKey}` : undefined}>
      {/* Screen reader only descriptive text */}
      <span className="sr-only">{srText}</span>

      {/* [status dot] LABEL [pill] */}
      <div className="flex items-center gap-2 min-w-0" aria-hidden="true">
        {/* Status dot (8px, with a 2px ring in the card background color) */}
        <div
          data-testid={cardKey ? `status-dot-${cardKey}` : undefined}
          className="relative flex items-center justify-center shrink-0 w-2 h-2"
        >
          {hasNew ? (
            <>
              {/* Soft pulse ring: 2s loop, low opacity */}
              <span className="absolute inset-0 rounded-full bg-[var(--notification)] indicator-pulse-ring" />
              <span className="relative block h-2 w-2 rounded-full bg-[var(--notification)] ring-2 ring-[hsl(var(--card))]" />
            </>
          ) : isZero ? (
            <span className="block h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-[hsl(var(--card))]" />
          ) : (
            <span className="block h-2 w-2 rounded-full bg-[hsl(var(--muted-foreground))] ring-2 ring-[hsl(var(--card))]" />
          )}
        </div>

        <span className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))] whitespace-nowrap select-none">
          {label}
        </span>

        {/* Small red pill: 18px tall, 12px weight 600, white text, hidden at zero */}
        {hasNew && (
          <span
            data-testid={cardKey ? `header-pill-${cardKey}` : undefined}
            className="h-[18px] px-1.5 rounded-full bg-[var(--notification)] text-white text-[12px] font-semibold leading-none inline-flex items-center justify-center select-none whitespace-nowrap shrink-0 live-indicator-fade"
          >
            {newCount} new
          </span>
        )}
      </div>

      <Link
        href={viewHref}
        onClick={onNavigate}
        data-testid={cardKey ? `view-link-${cardKey}` : undefined}
        className="inline-flex items-center gap-1 text-[12.5px] font-medium text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition shrink-0 ml-2"
      >
        <span>{viewLabel}</span>
        <ChevronRight size={13} />
      </Link>
    </div>
  );
}

export function RecentUpdatesTabs({ orders, products }: RecentUpdatesTabsProps) {
  const { data: attention } = useAttentionSummary();
  const { mutate: markSeen } = useMarkCardSeen();
  const { mutate: markOrderRead } = useMarkOrderRead();

  // Baseline data from props as fallback
  const pendingOrders = orders.filter((o) => o.fulfillment === 'pending');
  const lowStockProducts = products.filter((p) => p.stock <= 3);
  const unpaidOrders = orders.filter(
    (o) => o.status === 'reserved' || o.status === 'deposit_paid' || (o.status !== 'paid' && o.amount > 0)
  );
  const missingCostProducts = products.filter((p) => p.cost == null || p.cost <= 0);

  // Live attention counts from single source of truth
  const ordersToShipCount = attention?.cards?.orders_to_ship?.count ?? pendingOrders.length;
  const ordersToShipNewCount = attention?.cards?.orders_to_ship?.newCount ?? 0;
  const newOrderToShipIds = new Set(attention?.cards?.orders_to_ship?.newItemIds ?? []);

  const lowStockCount = attention?.cards?.low_stock?.count ?? lowStockProducts.length;
  const lowStockNewCount = attention?.cards?.low_stock?.newCount ?? 0;

  const unpaidCount = attention?.cards?.unpaid_orders?.count ?? unpaidOrders.length;
  const unpaidNewCount = attention?.cards?.unpaid_orders?.newCount ?? 0;
  const newUnpaidOrderIds = new Set(attention?.cards?.unpaid_orders?.newItemIds ?? []);

  const missingCostCount = attention?.cards?.missing_costs?.count ?? missingCostProducts.length;
  const missingCostNewCount = attention?.cards?.missing_costs?.newCount ?? 0;

  const handleCardSeen = (key: AttentionCardKey) => {
    markSeen(key);
  };

  return (
    <section className="mt-8" aria-label="Recent Updates">
      {/* Section Header Row */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[hsl(var(--foreground))]" />
          <h2 className="text-[15px] font-semibold text-[hsl(var(--foreground))]">
            Recent Updates
          </h2>
        </div>
        <Link
          href="/orders"
          onClick={() => handleCardSeen('orders')}
          className="inline-flex items-center gap-1 text-[12.5px] font-medium text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition group"
        >
          <span>View all</span>
          <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>

      {/* 2x2 Grid of Large Standalone Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6" data-testid="recent-updates-cards">
        {/* Card 1: Orders to Ship */}
        <div className="flex flex-col justify-between rounded-[12px] border border-[hsl(var(--card-border))] bg-[hsl(var(--card))] p-6 min-h-[260px] shadow-xs">
          <div>
            <CardHeader
              cardKey="orders_to_ship"
              label="ORDERS TO SHIP"
              count={ordersToShipCount}
              newCount={ordersToShipNewCount}
              viewHref="/orders?fulfillment=pending"
              viewLabel="View pending"
              onNavigate={() => handleCardSeen('orders_to_ship')}
            />
            <div className="mt-2 text-[36px] font-semibold tracking-tight text-[hsl(var(--foreground))] leading-none">
              {ordersToShipCount}
            </div>
          </div>

          {pendingOrders.length === 0 ? (
            <div className="my-auto py-8 text-center text-[13px] text-[hsl(var(--muted-foreground))]">
              All caught up
            </div>
          ) : (
            <div className="mt-5 flex-1 flex flex-col justify-end divide-y divide-[hsl(var(--border))]">
              {pendingOrders.slice(0, 3).map((order) => {
                const isNew = newOrderToShipIds.has(order.id);
                return (
                  <Link
                    key={order.id}
                    href={`/orders/${order.id}`}
                    onClick={() => {
                      markOrderRead(order.id);
                      handleCardSeen('orders_to_ship');
                    }}
                    className="flex h-[44px] items-center justify-between text-[13px] text-[hsl(var(--foreground))] hover:text-[hsl(var(--primary))] transition"
                  >
                    <div className="flex items-center min-w-0 pr-3">
                      {/* Fixed 12px gutter reserved on every row so text never shifts */}
                      <span className="w-[12px] shrink-0 flex items-center justify-start" aria-hidden="true">
                        {isNew && (
                          <span className="h-[6px] w-[6px] rounded-full bg-[var(--notification)] live-indicator-fade" />
                        )}
                      </span>
                      <span className="truncate font-medium">
                        {formatCustomerName(order.customerName)}
                        {order.productName ? ` · ${order.productName}` : ` · #${String(order.id).slice(-4)}`}
                      </span>
                    </div>
                    <span className="shrink-0 text-[12.5px] font-medium text-[hsl(var(--muted-foreground))]">
                      {moneyExact(order.amount)}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Card 2: Low Stock */}
        <div className="flex flex-col justify-between rounded-[12px] border border-[hsl(var(--card-border))] bg-[hsl(var(--card))] p-6 min-h-[260px] shadow-xs">
          <div>
            <CardHeader
              cardKey="low_stock"
              label="LOW STOCK"
              count={lowStockCount}
              newCount={lowStockNewCount}
              viewHref="/catalog?filter=low-stock"
              viewLabel="View low stock"
              onNavigate={() => handleCardSeen('low_stock')}
            />
            <div className="mt-2 text-[36px] font-semibold tracking-tight text-[hsl(var(--foreground))] leading-none">
              {lowStockCount}
            </div>
          </div>

          {lowStockProducts.length === 0 ? (
            <div className="my-auto py-8 text-center text-[13px] text-[hsl(var(--muted-foreground))]">
              All caught up
            </div>
          ) : (
            <div className="mt-5 flex-1 flex flex-col justify-end divide-y divide-[hsl(var(--border))]">
              {lowStockProducts.slice(0, 3).map((product) => (
                <Link
                  key={product.id}
                  href={`/catalog/edit/${product.id}`}
                  onClick={() => handleCardSeen('low_stock')}
                  className="flex h-[44px] items-center justify-between text-[13px] text-[hsl(var(--foreground))] hover:text-[hsl(var(--primary))] transition"
                >
                  <div className="flex items-center min-w-0 pr-3">
                    {/* Fixed 12px gutter reserved on every row */}
                    <span className="w-[12px] shrink-0 flex items-center justify-start" aria-hidden="true" />
                    <span className="truncate font-medium">{product.name}</span>
                  </div>
                  <span className="shrink-0 text-[12.5px] font-medium text-amber-600 dark:text-amber-400">
                    {product.stock} {product.stock === 1 ? 'unit' : 'units'} left
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Card 3: Unpaid Orders */}
        <div className="flex flex-col justify-between rounded-[12px] border border-[hsl(var(--card-border))] bg-[hsl(var(--card))] p-6 min-h-[260px] shadow-xs">
          <div>
            <CardHeader
              cardKey="unpaid_orders"
              label="UNPAID ORDERS"
              count={unpaidCount}
              newCount={unpaidNewCount}
              viewHref="/orders?payment=open"
              viewLabel="View unpaid"
              onNavigate={() => handleCardSeen('unpaid_orders')}
            />
            <div className="mt-2 text-[36px] font-semibold tracking-tight text-[hsl(var(--foreground))] leading-none">
              {unpaidCount}
            </div>
          </div>

          {unpaidOrders.length === 0 ? (
            <div className="my-auto py-8 text-center text-[13px] text-[hsl(var(--muted-foreground))]">
              All caught up
            </div>
          ) : (
            <div className="mt-5 flex-1 flex flex-col justify-end divide-y divide-[hsl(var(--border))]">
              {unpaidOrders.slice(0, 3).map((order) => {
                const isNew = newUnpaidOrderIds.has(order.id);
                return (
                  <Link
                    key={order.id}
                    href={`/orders/${order.id}`}
                    onClick={() => {
                      markOrderRead(order.id);
                      handleCardSeen('unpaid_orders');
                    }}
                    className="flex h-[44px] items-center justify-between text-[13px] text-[hsl(var(--foreground))] hover:text-[hsl(var(--primary))] transition"
                  >
                    <div className="flex items-center min-w-0 pr-3">
                      {/* Fixed 12px gutter reserved on every row so text never shifts */}
                      <span className="w-[12px] shrink-0 flex items-center justify-start" aria-hidden="true">
                        {isNew && (
                          <span className="h-[6px] w-[6px] rounded-full bg-[var(--notification)] live-indicator-fade" />
                        )}
                      </span>
                      <span className="truncate font-medium">
                        {formatCustomerName(order.customerName)}
                        {order.productName ? ` · ${order.productName}` : ` · #${String(order.id).slice(-4)}`}
                      </span>
                    </div>
                    <span className="shrink-0 text-[12.5px] font-medium text-rose-600 dark:text-rose-400">
                      {moneyExact(order.amount)} owed
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Card 4: Missing Costs */}
        <div className="flex flex-col justify-between rounded-[12px] border border-[hsl(var(--card-border))] bg-[hsl(var(--card))] p-6 min-h-[260px] shadow-xs">
          <div>
            <CardHeader
              cardKey="missing_costs"
              label="MISSING COSTS"
              count={missingCostCount}
              newCount={missingCostNewCount}
              viewHref="/catalog?filter=missing-costs"
              viewLabel="Add costs"
              onNavigate={() => handleCardSeen('missing_costs')}
            />
            <div className="mt-2 text-[36px] font-semibold tracking-tight text-[hsl(var(--foreground))] leading-none">
              {missingCostCount}
            </div>
          </div>

          {missingCostProducts.length === 0 ? (
            <div className="my-auto py-8 text-center text-[13px] text-[hsl(var(--muted-foreground))]">
              All caught up
            </div>
          ) : (
            <div className="mt-5 flex-1 flex flex-col justify-end divide-y divide-[hsl(var(--border))]">
              {missingCostProducts.slice(0, 3).map((product) => (
                <Link
                  key={product.id}
                  href={`/catalog/edit/${product.id}`}
                  onClick={() => handleCardSeen('missing_costs')}
                  className="flex h-[44px] items-center justify-between text-[13px] text-[hsl(var(--foreground))] hover:text-[hsl(var(--primary))] transition"
                >
                  <div className="flex items-center min-w-0 pr-3">
                    {/* Fixed 12px gutter reserved on every row */}
                    <span className="w-[12px] shrink-0 flex items-center justify-start" aria-hidden="true" />
                    <span className="truncate font-medium">{product.name}</span>
                  </div>
                  <span className="shrink-0 text-[12.5px] font-medium text-[hsl(var(--primary))] hover:underline">
                    Add cost →
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
