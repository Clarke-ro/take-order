import React from 'react';
import { Link } from 'wouter';
import { ChevronRight, ArrowRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { moneyExact, initials } from '@/lib/formatters';
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
  const unpaidOrders = orders.filter((o) => o.status === 'reserved' || o.status === 'deposit_paid' || (o.status !== 'paid' && o.amount > 0));
  const missingCostProducts = products.filter((p) => p.cost == null || p.cost <= 0);

  const getTargetRouteForTab = (tab: string) => {
    switch (tab) {
      case 'new_orders':
        return '/orders?fulfillment=pending';
      case 'low_stock':
        return '/catalog?filter=low-stock';
      case 'unpaid':
        return '/orders?payment=open';
      case 'missing_costs':
        return '/catalog?filter=missing-costs';
      default:
        return '/orders';
    }
  };

  return (
    <Card className="mt-8 rounded-2xl border border-neutral-200/90 bg-white p-5 sm:p-6 shadow-xs dark:border-neutral-800 dark:bg-neutral-950">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-4 mb-4">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-neutral-900 dark:bg-neutral-100" />
          <h3 className="text-base font-bold tracking-tight text-neutral-900 dark:text-white">Recent Updates</h3>
        </div>
        <Link href={getTargetRouteForTab('all')} className="inline-flex items-center gap-1 text-xs font-semibold text-neutral-700 hover:text-neutral-950 dark:text-neutral-300 dark:hover:text-white transition">
          <span>View all</span>
          <ArrowRight size={13} className="transition-transform" />
        </Link>
      </div>

      {/* 2×2 grid of large cards */}
      <div className="grid gap-5 sm:grid-cols-2">
        {/* Orders to Ship */}
        <Card className="flex flex-col justify-between rounded-[12px] border border-neutral-200/80 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Orders to Ship</span>
            <Link href={getTargetRouteForTab('new_orders')} className="inline-flex items-center gap-1 text-xs font-medium text-neutral-700 hover:underline">
              View pending <ChevronRight size={13} />
            </Link>
          </div>
          <div className="mt-2 text-2xl font-bold text-neutral-900 dark:text-white">{pendingOrders.length}</div>
          {pendingOrders.length === 0 ? (
            <div className="mt-4 text-center text-sm text-neutral-500">All caught up</div>
          ) : (
            <div className="mt-4 space-y-2">
              {pendingOrders.slice(0, 3).map((order) => (
                <Link key={order.id} href={`/orders/${order.id}`} className="flex items-center justify-between py-2 border-b border-neutral-200/70 last:border-b-0">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-100 dark:bg-neutral-800 font-bold text-xs text-neutral-800 dark:text-neutral-200">
                      {initials(order.customerName || order.productName)}
                    </div>
                    <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                      {order.customerName || 'Customer'}
                    </div>
                  </div>
                  <div className="text-sm font-medium text-neutral-900 dark:text-white">
                    {moneyExact(order.amount)}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>

        {/* Low Stock */}
        <Card className="flex flex-col justify-between rounded-[12px] border border-neutral-200/80 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Low Stock</span>
            <Link href={getTargetRouteForTab('low_stock')} className="inline-flex items-center gap-1 text-xs font-medium text-neutral-700 hover:underline">
              View low stock <ChevronRight size={13} />
            </Link>
          </div>
          <div className="mt-2 text-2xl font-bold text-neutral-900 dark:text-white">{lowStockProducts.length}</div>
          {lowStockProducts.length === 0 ? (
            <div className="mt-4 text-center text-sm text-neutral-500">All stocked</div>
          ) : (
            <div className="mt-4 space-y-2">
              {lowStockProducts.slice(0, 3).map((product) => (
                <Link key={product.id} href={`/catalog/edit/${product.id}`} className="flex items-center justify-between py-2 border-b border-neutral-200/70 last:border-b-0">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-100 dark:bg-neutral-800 font-bold text-xs text-neutral-800 dark:text-neutral-200">
                      {product.stock}
                    </div>
                    <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                      {product.name}
                    </div>
                  </div>
                  <div className="text-sm font-medium text-neutral-900 dark:text-white">
                    {product.stock} left
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>

        {/* Unpaid Orders */}
        <Card className="flex flex-col justify-between rounded-[12px] border border-neutral-200/80 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Unpaid Orders</span>
            <Link href={getTargetRouteForTab('unpaid')} className="inline-flex items-center gap-1 text-xs font-medium text-neutral-700 hover:underline">
              View unpaid <ChevronRight size={13} />
            </Link>
          </div>
          <div className="mt-2 text-2xl font-bold text-neutral-900 dark:text-white">{unpaidOrders.length}</div>
          {unpaidOrders.length === 0 ? (
            <div className="mt-4 text-center text-sm text-neutral-500">All paid</div>
          ) : (
            <div className="mt-4 space-y-2">
              {unpaidOrders.slice(0, 3).map((order) => (
                <Link key={order.id} href={`/orders/${order.id}`} className="flex items-center justify-between py-2 border-b border-neutral-200/70 last:border-b-0">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-100 dark:bg-neutral-800 font-bold text-xs text-neutral-800 dark:text-neutral-200">
                      {initials(order.customerName || order.productName)}
                    </div>
                    <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                      {order.customerName || 'Customer'}
                    </div>
                  </div>
                  <div className="text-sm font-medium text-neutral-900 dark:text-white">
                    {moneyExact(order.amount)}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>

        {/* Missing Costs */}
        <Card className="flex flex-col justify-between rounded-[12px] border border-neutral-200/80 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Missing Costs</span>
            <Link href={getTargetRouteForTab('missing_costs')} className="inline-flex items-center gap-1 text-xs font-medium text-neutral-700 hover:underline">
              Add costs <ChevronRight size={13} />
            </Link>
          </div>
          <div className="mt-2 text-2xl font-bold text-neutral-900 dark:text-white">{missingCostProducts.length}</div>
          {missingCostProducts.length === 0 ? (
            <div className="mt-4 text-center text-sm text-neutral-500">All costs set</div>
          ) : (
            <div className="mt-4 space-y-2">
              {missingCostProducts.slice(0, 3).map((product) => (
                <Link key={product.id} href={`/catalog/edit/${product.id}`} className="flex items-center justify-between py-2 border-b border-neutral-200/70 last:border-b-0">
                  <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                    {product.name}
                  </div>
                  <div className="text-sm font-medium text-indigo-600 hover:underline">
                    Add cost →
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>
    </Card>
  );
}
