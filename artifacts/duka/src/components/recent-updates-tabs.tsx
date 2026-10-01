import React, { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { ArrowRight, ChevronRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { moneyExact, dateShort, initials } from '@/lib/formatters';
import type { Order, Product } from '@/lib/types';

export type RecentUpdatesTabsProps = {
  orders: Order[];
  products: Product[];
  outstanding: number;
  loading?: boolean;
};

type UpdateTabKey = 'all' | 'new_orders' | 'low_stock' | 'unpaid' | 'missing_costs';

export function RecentUpdatesTabs({ orders, products, outstanding }: RecentUpdatesTabsProps) {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<UpdateTabKey>('all');

  const pendingOrders = orders.filter((o) => o.fulfillment === 'pending');
  const lowStockProducts = products.filter((p) => p.stock <= 3);
  const unpaidOrders = orders.filter((o) => o.status === 'reserved' || o.status === 'deposit_paid' || (o.status !== 'paid' && o.amount > 0));
  const missingCostProducts = products.filter((p) => p.cost == null || p.cost <= 0);

  const tabs: Array<{ key: UpdateTabKey; label: string; count: number }> = [
    {
      key: 'all',
      label: 'All Updates',
      count: pendingOrders.length + lowStockProducts.length + unpaidOrders.length + missingCostProducts.length,
    },
    {
      key: 'new_orders',
      label: 'New Orders',
      count: pendingOrders.length,
    },
    {
      key: 'low_stock',
      label: 'Low Stock',
      count: lowStockProducts.length,
    },
    {
      key: 'unpaid',
      label: 'Unpaid',
      count: unpaidOrders.length,
    },
    {
      key: 'missing_costs',
      label: 'Missing Costs',
      count: missingCostProducts.length,
    },
  ];

  const getTargetRouteForTab = (tab: UpdateTabKey) => {
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

  const getActionLabel = (tab: UpdateTabKey) => {
    switch (tab) {
      case 'new_orders':
        return 'View pending';
      case 'low_stock':
        return 'View low stock';
      case 'unpaid':
        return 'View unpaid';
      case 'missing_costs':
        return 'Set costs';
      default:
        return 'View all';
    }
  };

  return (
    <Card className="mt-8 rounded-2xl border border-neutral-200/90 bg-white p-5 sm:p-6 shadow-xs dark:border-neutral-800 dark:bg-neutral-950">
      {/* Top Header Row */}
      <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-4">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-neutral-900 dark:bg-neutral-100" />
          <h3 className="text-base font-bold tracking-tight text-neutral-900 dark:text-white">
            Recent Updates
          </h3>
        </div>

        <Link
          href={getTargetRouteForTab(activeTab)}
          className="inline-flex items-center gap-1 text-xs font-semibold text-neutral-700 hover:text-neutral-950 dark:text-neutral-300 dark:hover:text-white transition group cursor-pointer"
        >
          <span>{getActionLabel(activeTab)}</span>
          <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>

      {/* Tabs List */}
      <div className="mt-4 flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer border',
              activeTab === tab.key
                ? 'border-neutral-900 bg-neutral-900 text-white shadow-2xs dark:border-white dark:bg-white dark:text-neutral-950'
                : 'border-transparent bg-neutral-100 text-neutral-600 hover:bg-neutral-200/70 dark:bg-neutral-800/80 dark:text-neutral-400 dark:hover:bg-neutral-800'
            )}
          >
            <span>{tab.label}</span>
            <span
              className={cn(
                'rounded-full px-1.5 py-0.2 text-[10px] font-bold',
                activeTab === tab.key
                  ? 'bg-white/20 text-white dark:bg-neutral-900/20 dark:text-neutral-900'
                  : 'bg-neutral-200/80 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-300'
              )}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Content for Active Tab */}
      <div className="mt-5">
        {activeTab === 'all' && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {/* New Orders Card */}
            <div
              onClick={() => setLocation('/orders?fulfillment=pending')}
              className="group flex flex-col justify-between rounded-xl border border-neutral-200/80 bg-neutral-50/50 p-4 transition-all hover:border-neutral-900 hover:bg-white dark:border-neutral-800 dark:bg-neutral-900/50 dark:hover:border-neutral-700 cursor-pointer shadow-2xs"
            >
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Orders to Ship</span>
                <div className="mt-1.5 text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
                  {pendingOrders.length}
                </div>
              </div>
              <div className="mt-3 flex items-center gap-1 text-xs font-semibold text-neutral-800 group-hover:underline dark:text-neutral-200">
                <span>View pending</span>
                <ChevronRight size={13} />
              </div>
            </div>

            {/* Low Stock Card */}
            <div
              onClick={() => setLocation('/catalog?filter=low-stock')}
              className="group flex flex-col justify-between rounded-xl border border-neutral-200/80 bg-neutral-50/50 p-4 transition-all hover:border-neutral-900 hover:bg-white dark:border-neutral-800 dark:bg-neutral-900/50 dark:hover:border-neutral-700 cursor-pointer shadow-2xs"
            >
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Low Stock</span>
                <div className="mt-1.5 text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
                  {lowStockProducts.length}
                </div>
              </div>
              <div className="mt-3 flex items-center gap-1 text-xs font-semibold text-neutral-800 group-hover:underline dark:text-neutral-200">
                <span>View low stock</span>
                <ChevronRight size={13} />
              </div>
            </div>

            {/* Unpaid Card */}
            <div
              onClick={() => setLocation('/orders?payment=open')}
              className="group flex flex-col justify-between rounded-xl border border-neutral-200/80 bg-neutral-50/50 p-4 transition-all hover:border-neutral-900 hover:bg-white dark:border-neutral-800 dark:bg-neutral-900/50 dark:hover:border-neutral-700 cursor-pointer shadow-2xs"
            >
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Unpaid Orders</span>
                <div className="mt-1.5 text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
                  {unpaidOrders.length}
                </div>
                {outstanding > 0 && (
                  <div className="text-xs font-medium text-neutral-500 mt-0.5">
                    {moneyExact(outstanding)} due
                  </div>
                )}
              </div>
              <div className="mt-3 flex items-center gap-1 text-xs font-semibold text-neutral-800 group-hover:underline dark:text-neutral-200">
                <span>View unpaid</span>
                <ChevronRight size={13} />
              </div>
            </div>

            {/* Missing Costs Card */}
            <div
              onClick={() => setLocation('/catalog?filter=missing-costs')}
              className="group flex flex-col justify-between rounded-xl border border-neutral-200/80 bg-neutral-50/50 p-4 transition-all hover:border-neutral-900 hover:bg-white dark:border-neutral-800 dark:bg-neutral-900/50 dark:hover:border-neutral-700 cursor-pointer shadow-2xs"
            >
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Missing Costs</span>
                <div className="mt-1.5 text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
                  {missingCostProducts.length}
                </div>
              </div>
              <div className="mt-3 flex items-center gap-1 text-xs font-semibold text-neutral-800 group-hover:underline dark:text-neutral-200">
                <span>Add costs</span>
                <ChevronRight size={13} />
              </div>
            </div>
          </div>
        )}

        {/* Tab: New Orders */}
        {activeTab === 'new_orders' && (
          <div className="space-y-2">
            {pendingOrders.length === 0 ? (
              <div className="flex items-center justify-center p-6 text-center text-xs text-neutral-500 bg-neutral-50 dark:bg-neutral-900/40 rounded-xl border border-neutral-200/60 dark:border-neutral-800">
                No pending fulfillments
              </div>
            ) : (
              pendingOrders.slice(0, 5).map((order) => (
                <div
                  key={order.id}
                  onClick={() => setLocation(`/orders/${order.id}`)}
                  className="flex items-center justify-between p-3 rounded-xl border border-neutral-200/70 bg-white hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:bg-neutral-800/80 transition cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-100 dark:bg-neutral-800 font-bold text-xs text-neutral-800 dark:text-neutral-200">
                      {initials(order.customerName || order.productName)}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                        {order.customerName || 'Customer'}
                      </div>
                      <div className="text-xs text-neutral-500">
                        {order.productName}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-right">
                    <div>
                      <div className="text-sm font-bold text-neutral-900 dark:text-white">
                        {moneyExact(order.amount)}
                      </div>
                      <div className="text-[11px] text-neutral-400">{dateShort(order.createdAt)}</div>
                    </div>
                    <span className="rounded-md border border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 text-[10px] font-semibold text-neutral-700 dark:text-neutral-300">
                      To ship
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab: Low Stock */}
        {activeTab === 'low_stock' && (
          <div className="space-y-2">
            {lowStockProducts.length === 0 ? (
              <div className="flex items-center justify-center p-6 text-center text-xs text-neutral-500 bg-neutral-50 dark:bg-neutral-900/40 rounded-xl border border-neutral-200/60 dark:border-neutral-800">
                All products have sufficient stock
              </div>
            ) : (
              lowStockProducts.slice(0, 5).map((product) => (
                <div
                  key={product.id}
                  onClick={() => setLocation(`/catalog/edit/${product.id}`)}
                  className="flex items-center justify-between p-3 rounded-xl border border-neutral-200/70 bg-white hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:bg-neutral-800/80 transition cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-100 dark:bg-neutral-800 font-bold text-xs text-neutral-800 dark:text-neutral-200">
                      {product.stock}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                        {product.name}
                      </div>
                      <div className="text-xs text-neutral-500">
                        {moneyExact(product.price)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-right">
                    <span className="rounded-md border border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 text-[10px] font-semibold text-neutral-700 dark:text-neutral-300">
                      {product.stock === 0 ? 'Out of stock' : `${product.stock} left`}
                    </span>
                    <ChevronRight size={14} className="text-neutral-400" />
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab: Unpaid Balances */}
        {activeTab === 'unpaid' && (
          <div className="space-y-2">
            {unpaidOrders.length === 0 ? (
              <div className="flex items-center justify-center p-6 text-center text-xs text-neutral-500 bg-neutral-50 dark:bg-neutral-900/40 rounded-xl border border-neutral-200/60 dark:border-neutral-800">
                All orders are paid in full
              </div>
            ) : (
              unpaidOrders.slice(0, 5).map((order) => {
                const collected = order.status === 'paid' ? order.amount : order.status === 'deposit_paid' ? (order.depositAmount ?? 0) : 0;
                const owing = Math.max(0, order.amount - collected);
                return (
                  <div
                    key={order.id}
                    onClick={() => setLocation(`/orders/${order.id}`)}
                    className="flex items-center justify-between p-3 rounded-xl border border-neutral-200/70 bg-white hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:bg-neutral-800/80 transition cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-100 dark:bg-neutral-800 font-bold text-xs text-neutral-800 dark:text-neutral-200">
                        {initials(order.customerName || order.productName)}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                          {order.customerName || 'Customer'}
                        </div>
                        <div className="text-xs text-neutral-500">
                          {order.productName}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-right">
                      <div>
                        <div className="text-sm font-bold text-neutral-900 dark:text-white">
                          {moneyExact(owing)} due
                        </div>
                        <div className="text-[11px] text-neutral-400">
                          {order.status === 'deposit_paid' ? 'Deposit' : 'Reserved'}
                        </div>
                      </div>
                      <ChevronRight size={14} className="text-neutral-400" />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Tab: Missing Costs */}
        {activeTab === 'missing_costs' && (
          <div className="space-y-2">
            {missingCostProducts.length === 0 ? (
              <div className="flex items-center justify-center p-6 text-center text-xs text-neutral-500 bg-neutral-50 dark:bg-neutral-900/40 rounded-xl border border-neutral-200/60 dark:border-neutral-800">
                All catalog items have cost tracked
              </div>
            ) : (
              missingCostProducts.slice(0, 5).map((product) => (
                <div
                  key={product.id}
                  onClick={() => setLocation(`/catalog/edit/${product.id}`)}
                  className="flex items-center justify-between p-3 rounded-xl border border-neutral-200/70 bg-white hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:bg-neutral-800/80 transition cursor-pointer"
                >
                  <div>
                    <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                      {product.name}
                    </div>
                    <div className="text-xs text-neutral-500">
                      Selling price: {moneyExact(product.price)}
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-neutral-900 dark:text-white hover:underline">
                    Add cost →
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
