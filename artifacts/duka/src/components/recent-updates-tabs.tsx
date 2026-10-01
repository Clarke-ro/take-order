import React, { useState } from 'react';
import { Link, useLocation } from 'wouter';
import {
  Bell,
  Package,
  Clock3,
  DollarSign,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  TrendingDown,
  ShoppingBag,
} from 'lucide-react';
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

export function RecentUpdatesTabs({ orders, products, outstanding, loading }: RecentUpdatesTabsProps) {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<UpdateTabKey>('all');

  const pendingOrders = orders.filter((o) => o.fulfillment === 'pending');
  const lowStockProducts = products.filter((p) => p.stock <= 3);
  const unpaidOrders = orders.filter((o) => o.status === 'reserved' || o.status === 'deposit_paid' || (o.status !== 'paid' && o.amount > 0));
  const missingCostProducts = products.filter((p) => p.cost == null || p.cost <= 0);

  const tabs: Array<{ key: UpdateTabKey; label: string; count: number; badgeTone: string }> = [
    {
      key: 'all',
      label: 'All Updates',
      count: pendingOrders.length + lowStockProducts.length + unpaidOrders.length + missingCostProducts.length,
      badgeTone: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    },
    {
      key: 'new_orders',
      label: 'New Orders',
      count: pendingOrders.length,
      badgeTone: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
    },
    {
      key: 'low_stock',
      label: 'Low Stock',
      count: lowStockProducts.length,
      badgeTone: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
    },
    {
      key: 'unpaid',
      label: 'Unpaid Balances',
      count: unpaidOrders.length,
      badgeTone: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300',
    },
    {
      key: 'missing_costs',
      label: 'Missing Costs',
      count: missingCostProducts.length,
      badgeTone: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
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
        return 'View pending dispatches';
      case 'low_stock':
        return 'Manage catalog inventory';
      case 'unpaid':
        return 'Review unpaid orders';
      case 'missing_costs':
        return 'Set item costs';
      default:
        return 'View all orders';
    }
  };

  return (
    <Card className="mt-8 rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900/90">
      {/* Top Header & Tab Buttons */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <h3 className="text-base sm:text-lg font-bold tracking-tight text-slate-950 dark:text-white">
              Recent Updates & Alerts
            </h3>
          </div>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Realtime status notifications across dispatches, inventory thresholds, and buyer settlements
          </p>
        </div>

        <Link
          href={getTargetRouteForTab(activeTab)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white transition group self-start sm:self-auto cursor-pointer"
        >
          <span>{getActionLabel(activeTab)}</span>
          <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>

      {/* Tabs list */}
      <div className="mt-4 flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer border',
              activeTab === tab.key
                ? 'border-slate-900 bg-slate-900 text-white shadow-2xs dark:border-white dark:bg-white dark:text-slate-950'
                : 'border-transparent bg-slate-100/70 text-slate-600 hover:bg-slate-200/70 dark:bg-slate-800/60 dark:text-slate-400 dark:hover:bg-slate-800'
            )}
          >
            <span>{tab.label}</span>
            <span
              className={cn(
                'rounded-full px-1.5 py-0.2 text-[10px] font-bold',
                activeTab === tab.key
                  ? 'bg-white/20 text-white dark:bg-slate-950/20 dark:text-slate-950'
                  : tab.badgeTone
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
            {/* New Orders summary card */}
            <div
              onClick={() => setLocation('/orders?fulfillment=pending')}
              className="group flex flex-col justify-between rounded-xl border border-slate-200/80 bg-slate-50/70 p-4 transition-all hover:border-blue-400 hover:bg-blue-50/30 dark:border-slate-800 dark:bg-slate-950/50 cursor-pointer shadow-2xs"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Orders to Ship</span>
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                  <Package size={14} />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                  {pendingOrders.length}
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {pendingOrders.length === 0 ? 'All dispatches up to date' : 'Awaiting fulfillment / courier'}
                </p>
              </div>
              <div className="mt-3 flex items-center gap-1 text-[11px] font-semibold text-blue-700 group-hover:underline dark:text-blue-400">
                <span>Filter to pending</span>
                <ChevronRight size={12} />
              </div>
            </div>

            {/* Low stock summary card */}
            <div
              onClick={() => setLocation('/catalog?filter=low-stock')}
              className="group flex flex-col justify-between rounded-xl border border-slate-200/80 bg-slate-50/70 p-4 transition-all hover:border-amber-400 hover:bg-amber-50/30 dark:border-slate-800 dark:bg-slate-950/50 cursor-pointer shadow-2xs"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Low Stock</span>
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                  <AlertTriangle size={14} />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                  {lowStockProducts.length}
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {lowStockProducts.length === 0 ? 'Catalog healthy (>3 units)' : 'Items with ≤ 3 units remaining'}
                </p>
              </div>
              <div className="mt-3 flex items-center gap-1 text-[11px] font-semibold text-amber-800 group-hover:underline dark:text-amber-400">
                <span>Filter low stock items</span>
                <ChevronRight size={12} />
              </div>
            </div>

            {/* Unpaid balances summary card */}
            <div
              onClick={() => setLocation('/orders?payment=open')}
              className="group flex flex-col justify-between rounded-xl border border-slate-200/80 bg-slate-50/70 p-4 transition-all hover:border-purple-400 hover:bg-purple-50/30 dark:border-slate-800 dark:bg-slate-950/50 cursor-pointer shadow-2xs"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Owing Orders</span>
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                  <Clock3 size={14} />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                  {unpaidOrders.length}
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {moneyExact(outstanding)} outstanding balance
                </p>
              </div>
              <div className="mt-3 flex items-center gap-1 text-[11px] font-semibold text-purple-700 group-hover:underline dark:text-purple-400">
                <span>Filter unpaid orders</span>
                <ChevronRight size={12} />
              </div>
            </div>

            {/* Missing costs summary card */}
            <div
              onClick={() => setLocation('/catalog?filter=missing-costs')}
              className="group flex flex-col justify-between rounded-xl border border-slate-200/80 bg-slate-50/70 p-4 transition-all hover:border-rose-400 hover:bg-rose-50/30 dark:border-slate-800 dark:bg-slate-950/50 cursor-pointer shadow-2xs"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Missing Costs</span>
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                  <TrendingDown size={14} />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                  {missingCostProducts.length}
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {missingCostProducts.length === 0 ? 'All product costs tracked' : 'Missing cost per unit for margin'}
                </p>
              </div>
              <div className="mt-3 flex items-center gap-1 text-[11px] font-semibold text-rose-700 group-hover:underline dark:text-rose-400">
                <span>Filter items needing cost</span>
                <ChevronRight size={12} />
              </div>
            </div>
          </div>
        )}

        {/* Tab: New Orders */}
        {activeTab === 'new_orders' && (
          <div className="space-y-2">
            {pendingOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center bg-slate-50 dark:bg-slate-950/50 rounded-xl border border-slate-200/60 dark:border-slate-800">
                <CheckCircle2 size={24} className="text-emerald-500 mb-2" />
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">No pending fulfillments</p>
                <p className="text-xs text-slate-500 mt-0.5">All customer orders have been dispatched or completed.</p>
              </div>
            ) : (
              pendingOrders.slice(0, 5).map((order) => (
                <div
                  key={order.id}
                  onClick={() => setLocation(`/orders/${order.id}`)}
                  className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200/70 bg-slate-50/50 hover:bg-slate-100/70 dark:border-slate-800 dark:bg-slate-950/40 dark:hover:bg-slate-900 transition cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 font-bold text-xs text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                      {initials(order.customerName || order.productName)}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {order.customerName || 'Buyer pending'}
                      </div>
                      <div className="text-xs text-slate-500">
                        {order.productName} · #{String(order.id).padStart(6, '0')}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-right">
                    <div>
                      <div className="text-sm font-bold text-slate-900 dark:text-white">
                        {moneyExact(order.amount)}
                      </div>
                      <div className="text-[11px] text-slate-400">{dateShort(order.createdAt)}</div>
                    </div>
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
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
              <div className="flex flex-col items-center justify-center p-8 text-center bg-slate-50 dark:bg-slate-950/50 rounded-xl border border-slate-200/60 dark:border-slate-800">
                <CheckCircle2 size={24} className="text-emerald-500 mb-2" />
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Catalog inventory healthy</p>
                <p className="text-xs text-slate-500 mt-0.5">All products currently have more than 3 units in stock.</p>
              </div>
            ) : (
              lowStockProducts.slice(0, 5).map((product) => (
                <div
                  key={product.id}
                  onClick={() => setLocation(`/catalog/edit/${product.id}`)}
                  className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200/70 bg-slate-50/50 hover:bg-slate-100/70 dark:border-slate-800 dark:bg-slate-950/40 dark:hover:bg-slate-900 transition cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 font-bold text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                      {product.stock}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {product.name}
                      </div>
                      <div className="text-xs text-slate-500">
                        {product.category || 'General'} · Price: {moneyExact(product.price)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-right">
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                      {product.stock === 0 ? 'Out of stock' : `${product.stock} left`}
                    </span>
                    <ChevronRight size={14} className="text-slate-400" />
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
              <div className="flex flex-col items-center justify-center p-8 text-center bg-slate-50 dark:bg-slate-950/50 rounded-xl border border-slate-200/60 dark:border-slate-800">
                <CheckCircle2 size={24} className="text-emerald-500 mb-2" />
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">No outstanding customer balances</p>
                <p className="text-xs text-slate-500 mt-0.5">All active orders have been paid in full.</p>
              </div>
            ) : (
              unpaidOrders.slice(0, 5).map((order) => {
                const collected = order.status === 'paid' ? order.amount : order.status === 'deposit_paid' ? (order.depositAmount ?? 0) : 0;
                const owing = Math.max(0, order.amount - collected);
                return (
                  <div
                    key={order.id}
                    onClick={() => setLocation(`/orders/${order.id}`)}
                    className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200/70 bg-slate-50/50 hover:bg-slate-100/70 dark:border-slate-800 dark:bg-slate-950/40 dark:hover:bg-slate-900 transition cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-100 font-bold text-xs text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                        {initials(order.customerName || order.productName)}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {order.customerName || 'Buyer pending'}
                        </div>
                        <div className="text-xs text-slate-500">
                          {order.productName} · Total: {moneyExact(order.amount)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-right">
                      <div>
                        <div className="text-sm font-bold text-amber-700 dark:text-amber-400">
                          {moneyExact(owing)} due
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {order.status === 'deposit_paid' ? 'Deposit paid' : 'Reservation'}
                        </div>
                      </div>
                      <ChevronRight size={14} className="text-slate-400" />
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
              <div className="flex flex-col items-center justify-center p-8 text-center bg-slate-50 dark:bg-slate-950/50 rounded-xl border border-slate-200/60 dark:border-slate-800">
                <CheckCircle2 size={24} className="text-emerald-500 mb-2" />
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Complete cost data</p>
                <p className="text-xs text-slate-500 mt-0.5">Every catalog product has an assigned unit cost for profit analytics.</p>
              </div>
            ) : (
              missingCostProducts.slice(0, 5).map((product) => (
                <div
                  key={product.id}
                  onClick={() => setLocation(`/catalog/edit/${product.id}`)}
                  className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200/70 bg-slate-50/50 hover:bg-slate-100/70 dark:border-slate-800 dark:bg-slate-950/40 dark:hover:bg-slate-900 transition cursor-pointer"
                >
                  <div>
                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {product.name}
                    </div>
                    <div className="text-xs text-slate-500">
                      Selling Price: {moneyExact(product.price)} · Cost not set
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-rose-600 hover:underline">
                      Add cost →
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
