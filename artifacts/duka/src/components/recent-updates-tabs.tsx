import React from 'react';
import { Link } from 'wouter';
import { ChevronRight, ArrowRight } from 'lucide-react';
import { moneyExact } from '@/lib/formatters';
import type { Order, Product } from '@/lib/types';

export type RecentUpdatesTabsProps = {
  orders: Order[];
  products: Product[];
  outstanding: number;
  loading?: boolean;
};

export function RecentUpdatesTabs({ orders, products, outstanding }: RecentUpdatesTabsProps) {
  const pendingOrders = orders.filter((o) => o.fulfillment === 'pending');
  const lowStockProducts = products.filter((p) => p.stock <= 3);
  const unpaidOrders = orders.filter(
    (o) => o.status === 'reserved' || o.status === 'deposit_paid' || (o.status !== 'paid' && o.amount > 0)
  );
  const missingCostProducts = products.filter((p) => p.cost == null || p.cost <= 0);

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
          className="inline-flex items-center gap-1 text-[12.5px] font-medium text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition group"
        >
          <span>View all</span>
          <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>

      {/* 2x2 Grid of Large Standalone Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
        {/* Card 1: Orders to Ship */}
        <div className="flex flex-col justify-between rounded-[12px] border border-[hsl(var(--card-border))] bg-[hsl(var(--card))] p-6 min-h-[260px] shadow-xs">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                ORDERS TO SHIP
              </span>
              <Link
                href="/orders?fulfillment=pending"
                className="inline-flex items-center gap-1 text-[12.5px] font-medium text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition"
              >
                <span>View pending</span>
                <ChevronRight size={13} />
              </Link>
            </div>
            <div className="mt-2 text-[36px] font-semibold tracking-tight text-[hsl(var(--foreground))] leading-none">
              {pendingOrders.length}
            </div>
          </div>

          {pendingOrders.length === 0 ? (
            <div className="my-auto py-8 text-center text-[13px] text-[hsl(var(--muted-foreground))]">
              All caught up
            </div>
          ) : (
            <div className="mt-5 flex-1 flex flex-col justify-end divide-y divide-[hsl(var(--border))]">
              {pendingOrders.slice(0, 3).map((order) => (
                <Link
                  key={order.id}
                  href={`/orders/${order.id}`}
                  className="flex h-[44px] items-center justify-between text-[13px] text-[hsl(var(--foreground))] hover:text-[hsl(var(--primary))] transition"
                >
                  <span className="truncate pr-3 font-medium">
                    {order.customerName || 'Customer'}
                    {order.productName ? ` · ${order.productName}` : ` · #${order.id.slice(-4)}`}
                  </span>
                  <span className="shrink-0 text-[12.5px] font-medium text-[hsl(var(--muted-foreground))]">
                    {moneyExact(order.amount)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Card 2: Low Stock */}
        <div className="flex flex-col justify-between rounded-[12px] border border-[hsl(var(--card-border))] bg-[hsl(var(--card))] p-6 min-h-[260px] shadow-xs">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                LOW STOCK
              </span>
              <Link
                href="/catalog?filter=low-stock"
                className="inline-flex items-center gap-1 text-[12.5px] font-medium text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition"
              >
                <span>View low stock</span>
                <ChevronRight size={13} />
              </Link>
            </div>
            <div className="mt-2 text-[36px] font-semibold tracking-tight text-[hsl(var(--foreground))] leading-none">
              {lowStockProducts.length}
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
                  className="flex h-[44px] items-center justify-between text-[13px] text-[hsl(var(--foreground))] hover:text-[hsl(var(--primary))] transition"
                >
                  <span className="truncate pr-3 font-medium">{product.name}</span>
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
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                UNPAID ORDERS
              </span>
              <Link
                href="/orders?payment=open"
                className="inline-flex items-center gap-1 text-[12.5px] font-medium text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition"
              >
                <span>View unpaid</span>
                <ChevronRight size={13} />
              </Link>
            </div>
            <div className="mt-2 text-[36px] font-semibold tracking-tight text-[hsl(var(--foreground))] leading-none">
              {unpaidOrders.length}
            </div>
          </div>

          {unpaidOrders.length === 0 ? (
            <div className="my-auto py-8 text-center text-[13px] text-[hsl(var(--muted-foreground))]">
              All caught up
            </div>
          ) : (
            <div className="mt-5 flex-1 flex flex-col justify-end divide-y divide-[hsl(var(--border))]">
              {unpaidOrders.slice(0, 3).map((order) => (
                <Link
                  key={order.id}
                  href={`/orders/${order.id}`}
                  className="flex h-[44px] items-center justify-between text-[13px] text-[hsl(var(--foreground))] hover:text-[hsl(var(--primary))] transition"
                >
                  <span className="truncate pr-3 font-medium">
                    {order.customerName || 'Customer'}
                    {order.productName ? ` · ${order.productName}` : ` · #${order.id.slice(-4)}`}
                  </span>
                  <span className="shrink-0 text-[12.5px] font-medium text-rose-600 dark:text-rose-400">
                    {moneyExact(order.amount)} owed
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Card 4: Missing Costs */}
        <div className="flex flex-col justify-between rounded-[12px] border border-[hsl(var(--card-border))] bg-[hsl(var(--card))] p-6 min-h-[260px] shadow-xs">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                MISSING COSTS
              </span>
              <Link
                href="/catalog?filter=missing-costs"
                className="inline-flex items-center gap-1 text-[12.5px] font-medium text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition"
              >
                <span>Add costs</span>
                <ChevronRight size={13} />
              </Link>
            </div>
            <div className="mt-2 text-[36px] font-semibold tracking-tight text-[hsl(var(--foreground))] leading-none">
              {missingCostProducts.length}
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
                  className="flex h-[44px] items-center justify-between text-[13px] text-[hsl(var(--foreground))] hover:text-[hsl(var(--primary))] transition"
                >
                  <span className="truncate pr-3 font-medium">{product.name}</span>
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
