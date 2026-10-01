import React, { useMemo } from 'react';
import { Link, useParams, useLocation } from 'wouter';
import {
  ArrowLeft,
  User,
  ShoppingBag,
  DollarSign,
  Clock,
  Phone,
  MessageSquare,
  Sparkles,
  Package,
  Calendar,
  ChevronRight,
  ExternalLink,
  CheckCircle2,
} from 'lucide-react';
import { SiWhatsapp } from 'react-icons/si';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusPill } from '@/components/status-pill';
import { ChannelMark } from '@/components/channel-mark';
import { useListOrders } from '@/lib/api-hooks';
import { moneyExact, dateShort, initials, channelName, paymentTone, paymentLabel, openWhatsApp } from '@/lib/formatters';
import type { Order } from '@/lib/types';

export function ClientDetailPage() {
  const { key = '' } = useParams<{ key: string }>();
  const decodedKey = decodeURIComponent(key);
  const [, setLocation] = useLocation();
  const query = useListOrders();

  const allOrders = query.data ?? [];

  const clientData = useMemo(() => {
    if (!allOrders.length || !decodedKey) return null;

    // Filter orders matching this client key
    const clientOrders = allOrders.filter((order) => {
      const phone = order.customerPhone?.trim() ?? '';
      const name = order.customerName?.trim() ?? '';
      const identity = phone || name;
      const orderKey = `${phone ? 'phone' : 'name'}:${identity.toLowerCase()}`;
      return orderKey === decodedKey || name.toLowerCase() === decodedKey.toLowerCase() || phone === decodedKey;
    });

    if (!clientOrders.length) return null;

    // Sort orders from newest to oldest
    clientOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const latest = clientOrders[0];
    const first = clientOrders[clientOrders.length - 1];
    const displayName = clientOrders.find((o) => o.customerName && o.customerName.toLowerCase() !== 'waiting for buyer')?.customerName || latest.customerName || 'Buyer';
    const phone = clientOrders.find((o) => o.customerPhone)?.customerPhone || '';

    const totalSpent = clientOrders.reduce((sum, o) => {
      const collected = o.status === 'paid' ? o.amount : o.status === 'deposit_paid' ? (o.depositAmount ?? 0) : 0;
      return sum + collected;
    }, 0);

    const totalOrderValue = clientOrders.reduce((sum, o) => sum + o.amount, 0);
    const totalOutstanding = Math.max(0, totalOrderValue - totalSpent);
    const orderCount = clientOrders.length;
    const avgOrderValue = orderCount > 0 ? totalOrderValue / orderCount : 0;
    const isReturning = orderCount > 1;

    return {
      displayName,
      phone,
      orderCount,
      totalSpent,
      totalOrderValue,
      totalOutstanding,
      avgOrderValue,
      isReturning,
      firstOrderDate: first.createdAt,
      latestOrderDate: latest.createdAt,
      orders: clientOrders,
    };
  }, [allOrders, decodedKey]);

  if (query.isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-5 w-28" />
        </div>
        <Card className="p-8">
          <div className="flex items-center gap-4">
            <Skeleton className="h-16 w-16 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (!clientData) {
    return (
      <div className="space-y-6">
        <Link href="/clients" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition">
          <ArrowLeft size={16} />
          Back to clients
        </Link>
        <Card className="p-12 text-center rounded-2xl">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500 mb-3">
            <User size={24} />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Client profile not found</h2>
          <p className="mt-1 text-sm text-slate-500">The requested client could not be located in your customer directory.</p>
          <div className="mt-6">
            <Link href="/clients">
              <Button>Return to Client List</Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Top back navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/clients"
          className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white transition"
        >
          <ArrowLeft size={16} />
          <span>Back to all clients</span>
        </Link>

        {clientData.phone && (
          <button
            type="button"
            onClick={() => openWhatsApp(clientData.phone, `Hi ${clientData.displayName}!`)}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 text-[#25D366] border border-emerald-200 text-xs font-semibold hover:bg-emerald-100 transition cursor-pointer"
          >
            <SiWhatsapp size={14} />
            <span>Chat on WhatsApp</span>
          </button>
        )}
      </div>

      {/* Client Overview Card */}
      <Card className="rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-slate-900 font-mono text-xl font-bold text-white shadow-sm dark:bg-white dark:text-slate-950">
              {initials(clientData.displayName)}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-950 dark:text-white">
                  {clientData.displayName}
                </h1>
                {clientData.isReturning ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950 dark:text-emerald-300">
                    <Sparkles size={11} /> Returning Client ({clientData.orderCount} orders)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-700 border border-blue-200/80 dark:bg-blue-950 dark:text-blue-300">
                    <CheckCircle2 size={11} /> First-time Buyer
                  </span>
                )}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                {clientData.phone ? (
                  <span className="flex items-center gap-1 font-mono font-medium">
                    <Phone size={12} className="text-slate-400" />
                    {clientData.phone}
                  </span>
                ) : (
                  <span>No phone recorded</span>
                )}
                <span>·</span>
                <span>Client since {dateShort(clientData.firstOrderDate)}</span>
                <span>·</span>
                <span>Latest purchase {dateShort(clientData.latestOrderDate)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 4 Client KPI Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 pt-6">
          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/40">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Spend Collected</span>
            <div className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              {moneyExact(clientData.totalSpent)}
            </div>
            <p className="mt-1 text-xs text-slate-500">Gross funds settled</p>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/40">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Orders Made</span>
            <div className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              {clientData.orderCount}
            </div>
            <p className="mt-1 text-xs text-slate-500">Lifetime order frequency</p>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/40">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Average Order Value</span>
            <div className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              {moneyExact(clientData.avgOrderValue)}
            </div>
            <p className="mt-1 text-xs text-slate-500">Spend per transaction</p>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/40">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Outstanding Balance</span>
            <div className={cn('mt-2 text-2xl font-extrabold tracking-tight', clientData.totalOutstanding > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-slate-900 dark:text-white')}>
              {moneyExact(clientData.totalOutstanding)}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {clientData.totalOutstanding > 0 ? 'Awaiting settlement' : 'Fully settled'}
            </p>
          </div>
        </div>
      </Card>

      {/* Customer Orders Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-950 dark:text-white">Order History</h3>
            <p className="text-xs text-slate-500">Complete purchase log for {clientData.displayName}</p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {clientData.orders.length} {clientData.orders.length === 1 ? 'order' : 'orders'}
          </span>
        </div>

        <Card className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-slate-200/90 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-950">
                  <th className="px-5 py-3">#</th>
                  <th className="px-4 py-3">Order ID</th>
                  <th className="px-4 py-3">Product / Items</th>
                  <th className="px-4 py-3">Traffic</th>
                  <th className="px-4 py-3">Order Value</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Payment</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {clientData.orders.map((order, idx) => (
                  <tr
                    key={order.id}
                    onClick={() => setLocation(`/orders/${order.id}`)}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-900/60 transition cursor-pointer"
                  >
                    <td className="px-5 py-4 font-mono text-xs font-semibold text-slate-400">
                      #{idx + 1}
                    </td>
                    <td className="px-4 py-4 font-mono font-bold text-slate-900 dark:text-white">
                      #{String(order.id).padStart(6, '0')}
                    </td>
                    <td className="px-4 py-4 font-medium text-slate-800 dark:text-slate-200">
                      <div>{order.productName}</div>
                      {order.deliveryMethod && (
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {order.deliveryMethod === 'delivery' ? 'Courier Delivery' : 'Pickup'}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <span className="inline-flex items-center gap-1.5" title={channelName(order.channel)}>
                        <ChannelMark value={order.channel} size={15} />
                        <span className="text-xs text-slate-500">{channelName(order.channel)}</span>
                      </span>
                    </td>
                    <td className="px-4 py-4 font-mono font-bold text-slate-900 dark:text-white">
                      {moneyExact(order.amount)}
                    </td>
                    <td className="px-4 py-4 text-xs text-slate-500">
                      {dateShort(order.createdAt)}
                    </td>
                    <td className="px-4 py-4">
                      <StatusPill tone={paymentTone(order.status)}>{paymentLabel(order)}</StatusPill>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link
                        href={`/orders/${order.id}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span>Details</span>
                        <ChevronRight size={13} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
