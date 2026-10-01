import React, { useMemo } from 'react';
import { Link, useParams, useLocation } from 'wouter';
import {
  ArrowLeft,
  User,
  Phone,
  MessageSquare,
  Sparkles,
  ChevronRight,
  CheckCircle2,
} from 'lucide-react';
import { SiWhatsapp } from 'react-icons/si';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusPill } from '@/components/status-pill';
import { ChannelMark } from '@/components/channel-mark';
import { useListOrders } from '@/lib/api-hooks';
import { moneyExact, dateShort, initials, channelName, paymentTone, paymentLabel, openWhatsApp } from '@/lib/formatters';
import { cn } from '@/lib/utils';

export function ClientDetailPage() {
  const routeParams = useParams<{ key?: string }>();
  const rawKey = routeParams?.key ?? '';
  let decodedKey = rawKey;
  try {
    decodedKey = decodeURIComponent(rawKey);
  } catch {
    decodedKey = rawKey;
  }

  const [, setLocation] = useLocation();
  const query = useListOrders();
  const allOrders = query.data ?? [];

  const clientData = useMemo(() => {
    if (!decodedKey && !rawKey) return null;
    if (!allOrders.length) return null;

    const cleanKey = decodedKey.trim().toLowerCase();
    const cleanRaw = rawKey.trim().toLowerCase();
    // stripped = remove "phone:" or "name:" prefix for flexible matching
    const stripped = cleanKey.replace(/^(phone|name):/, '').trim();
    const strippedRaw = cleanRaw.replace(/^(phone|name):/, '').trim();

    const clientOrders = allOrders.filter((order) => {
      const phone = (order.customerPhone ?? '').trim().toLowerCase();
      const name = (order.customerName ?? '').trim().toLowerCase();
      const identity = phone || name;
      if (!identity) return false;
      const orderKey = `${phone ? 'phone' : 'name'}:${identity}`;

      // exact key match
      if (orderKey === cleanKey || orderKey === cleanRaw) return true;

      // phone match (flexible, including digit-only comparison)
      if (phone) {
        if (phone === cleanKey || phone === cleanRaw || phone === stripped || phone === strippedRaw) return true;
        const targetDigits = stripped.replace(/\D/g, '');
        const phoneDigits = phone.replace(/\D/g, '');
        if (targetDigits.length >= 7 && phoneDigits.length >= 7) {
          if (targetDigits === phoneDigits || phoneDigits.endsWith(targetDigits) || targetDigits.endsWith(phoneDigits)) return true;
        }
      }

      // name match
      if (name && (name === cleanKey || name === cleanRaw || name === stripped || name === strippedRaw)) return true;

      return false;
    });

    if (!clientOrders.length) return null;

    clientOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const latest = clientOrders[0];
    const first = clientOrders[clientOrders.length - 1];
    const displayName =
      clientOrders.find((o) => o.customerName && !['waiting for buyer', 'buyer pending', 'awaiting buyer'].includes((o.customerName ?? '').toLowerCase()))?.customerName ||
      latest.customerName ||
      'Buyer';
    const phone = clientOrders.find((o) => o.customerPhone)?.customerPhone || '';

    const totalSpent = clientOrders.reduce((sum, o) => {
      const col = o.status === 'paid' ? o.amount : o.status === 'deposit_paid' ? (o.depositAmount ?? 0) : 0;
      return sum + col;
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
  }, [allOrders, decodedKey, rawKey]);

  if (query.isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-5 w-28" />
        <Card className="p-8">
          <div className="flex items-center gap-4">
            <Skeleton className="h-16 w-16 rounded-2xl" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
        </Card>
        <Card className="h-48 p-6"><Skeleton className="h-full w-full rounded-xl" /></Card>
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
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-4">
            <User size={24} />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Client not found</h2>
          <p className="mt-1 text-sm text-slate-500">This client profile could not be located. They may not have any recorded orders.</p>
          <div className="mt-6">
            <Link href="/clients" className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-700 transition">
              Return to Clients
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Back nav + WhatsApp CTA */}
      <div className="flex items-center justify-between">
        <Link
          href="/clients"
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white transition"
        >
          <ArrowLeft size={16} />
          <span>Back to all clients</span>
        </Link>

        {clientData.phone && (
          <button
            type="button"
            onClick={() => openWhatsApp(clientData.phone, `Hi ${clientData.displayName}!`)}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 text-[#25D366] border border-emerald-200 text-xs font-semibold hover:bg-emerald-100 transition"
          >
            <SiWhatsapp size={14} />
            <span>Chat on WhatsApp</span>
          </button>
        )}
      </div>

      {/* Client overview card */}
      <Card className="rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-slate-900 font-mono text-xl font-bold text-white dark:bg-white dark:text-slate-950">
              {initials(clientData.displayName)}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-950 dark:text-white">
                  {clientData.displayName}
                </h1>
                {clientData.isReturning ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-200/80">
                    <Sparkles size={11} /> Returning client
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-700 border border-blue-200/80">
                    <CheckCircle2 size={11} /> First-time buyer
                  </span>
                )}
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                {clientData.phone ? (
                  <span className="flex items-center gap-1 font-mono font-medium">
                    <Phone size={12} className="text-slate-400" />
                    {clientData.phone}
                  </span>
                ) : (
                  <span>No phone recorded</span>
                )}
                <span>·</span>
                <span>Since {dateShort(clientData.firstOrderDate)}</span>
                <span>·</span>
                <span>Last order {dateShort(clientData.latestOrderDate)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 4 KPI stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 pt-6">
          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/40">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Collected</span>
            <div className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              {moneyExact(clientData.totalSpent)}
            </div>
            <p className="mt-1 text-xs text-slate-500">Total amount settled</p>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/40">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Orders</span>
            <div className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              {clientData.orderCount}
            </div>
            <p className="mt-1 text-xs text-slate-500">Lifetime orders placed</p>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/40">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Avg. order</span>
            <div className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              {moneyExact(clientData.avgOrderValue)}
            </div>
            <p className="mt-1 text-xs text-slate-500">Spend per transaction</p>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/40">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Outstanding</span>
            <div className={cn('mt-2 text-2xl font-extrabold tracking-tight', clientData.totalOutstanding > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-slate-900 dark:text-white')}>
              {moneyExact(clientData.totalOutstanding)}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {clientData.totalOutstanding > 0 ? 'Balance due' : 'Fully settled'}
            </p>
          </div>
        </div>
      </Card>

      {/* Order history */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-950 dark:text-white">Order history</h3>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {clientData.orders.length} {clientData.orders.length === 1 ? 'order' : 'orders'}
          </span>
        </div>

        <Card className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-[11px] font-semibold uppercase tracking-wider text-slate-400 bg-slate-50/80 dark:bg-slate-950">
                  <th className="px-5 py-3">#</th>
                  <th className="px-4 py-3">Order ID</th>
                  <th className="px-4 py-3">Item</th>
                  <th className="px-4 py-3">Channel</th>
                  <th className="px-4 py-3">Value</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Payment</th>
                  <th className="px-4 py-3 text-right">Details</th>
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
                      {idx + 1}
                    </td>
                    <td className="px-4 py-4 font-mono text-xs font-bold text-slate-900 dark:text-white">
                      #{String(order.id).padStart(6, '0')}
                    </td>
                    <td className="px-4 py-4 text-sm font-medium text-slate-800 dark:text-slate-200">
                      <div className="truncate max-w-[180px]">{order.productName}</div>
                      {order.deliveryMethod && (
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {order.deliveryMethod === 'delivery' ? 'Delivery' : 'Pickup'}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <span className="inline-flex items-center gap-1.5" title={channelName(order.channel)}>
                        <ChannelMark value={order.channel} size={14} />
                        <span className="text-xs text-slate-500 hidden sm:inline">{channelName(order.channel)}</span>
                      </span>
                    </td>
                    <td className="px-4 py-4 font-mono text-sm font-bold text-slate-900 dark:text-white whitespace-nowrap">
                      {moneyExact(order.amount)}
                    </td>
                    <td className="px-4 py-4 text-xs text-slate-500 whitespace-nowrap">
                      {dateShort(order.createdAt)}
                    </td>
                    <td className="px-4 py-4">
                      <StatusPill tone={paymentTone(order.status)}>{paymentLabel(order)}</StatusPill>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <Link
                        href={`/orders/${order.id}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span>Open</span>
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
