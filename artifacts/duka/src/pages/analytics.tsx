import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Link } from 'wouter';
import {
  Calendar,
  ChevronDown,
  Download,
  Check,
  ArrowUpRight,
  Info,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/page-header';
import {
  useGetDashboardSummary,
  getGetDashboardSummaryQueryKey,
  useListProducts,
  useListOrders,
  useListExpenses,
} from '@/lib/api-hooks';
import { money, moneyExact, channelName, currencySymbol } from '@/lib/formatters';
import {
  DashboardCustomRangePicker,
  dashboardPeriodLabel,
  dashboardPeriodOptions,
  dashboardPeriodRange,
  inputDate,
  readDashboardPeriodPreference,
  shiftInputDate,
  writeDashboardPeriodPreference,
  type DashboardDateRange,
  type DashboardPeriod,
} from '@/lib/date-filters';
import { Skeleton } from '@/components/ui/skeleton';

/* ── Donut Chart ─────────────────────────────────────────────────────────── */
function DonutLabel({ cx, cy, label, value }: { cx: number; cy: number; label: string; value: string }) {
  return (
    <g>
      <text x={cx} y={cy - 10} textAnchor="middle" className="fill-neutral-400 text-[10px]" fontSize={11}>
        {label}
      </text>
      <text x={cx} y={cy + 12} textAnchor="middle" className="fill-neutral-900 font-bold" fontSize={14} fontWeight={700}>
        {value}
      </text>
    </g>
  );
}

/* ── Main Page ────────────────────────────────────────────────────────────── */
export function AnalyticsPage() {
  const today = inputDate(new Date());
  const [savedPreference] = useState(() => readDashboardPeriodPreference());
  const [period, setPeriod] = useState<DashboardPeriod>(() => savedPreference?.period ?? 'month');
  const [draftPeriod, setDraftPeriod] = useState<DashboardPeriod>(() => savedPreference?.period ?? 'month');
  const [periodMenuOpen, setPeriodMenuOpen] = useState(false);
  const periodMenuRef = useRef<HTMLDivElement>(null);
  const periodTriggerRef = useRef<HTMLButtonElement>(null);
  const [exported, setExported] = useState(false);
  const [activeDonut, setActiveDonut] = useState<'channel' | 'expenses'>('channel');

  const initialCustomRange = useMemo(() => ({ from: shiftInputDate(today, -29), to: today }), [today]);
  const restoredCustomRange =
    savedPreference?.period === 'custom'
      ? { from: savedPreference.customFrom, to: savedPreference.customTo }
      : initialCustomRange;
  const [appliedCustomRange, setAppliedCustomRange] = useState<DashboardDateRange>(() => restoredCustomRange);
  const [draftCustomRange, setDraftCustomRange] = useState<DashboardDateRange>(() => restoredCustomRange);

  const periodRange = useMemo(
    () => dashboardPeriodRange(period, appliedCustomRange.from, appliedCustomRange.to),
    [period, appliedCustomRange],
  );
  const draftPeriodRange = useMemo(
    () => dashboardPeriodRange(draftPeriod, draftCustomRange.from, draftCustomRange.to),
    [draftPeriod, draftCustomRange],
  );
  const periodLabel = dashboardPeriodLabel(period, appliedCustomRange.from, appliedCustomRange.to);

  const summaryQuery = useGetDashboardSummary(periodRange, {
    query: { queryKey: getGetDashboardSummaryQueryKey(periodRange ?? undefined), placeholderData: (prev) => prev },
  });
  const productsQuery = useListProducts();
  const ordersQuery = useListOrders();
  const expensesQuery = useListExpenses();

  const summary = summaryQuery.data;
  const products = productsQuery.data ?? [];
  const allOrders = ordersQuery.data ?? [];
  const expenses = expensesQuery.data ?? [];

  const periodOrders = useMemo(() => {
    if (!periodRange) return allOrders;
    return allOrders.filter((o) => {
      const d = new Date(o.createdAt).toISOString().slice(0, 10);
      return d >= periodRange.from && d <= periodRange.to;
    });
  }, [allOrders, periodRange]);

  // ── Core Metrics ──────────────────────────────────────────────────────────
  const totalRevenue = summary?.revenue ?? periodOrders.reduce((sum, o) => sum + (o.status === 'paid' ? o.amount : o.status === 'deposit_paid' ? (o.depositAmount ?? 0) : 0), 0);
  const totalOrdersCount = periodOrders.length;
  const avgOrderValue = totalOrdersCount > 0 ? totalRevenue / totalOrdersCount : 0;
  const totalProductCosts = summary?.productCosts ?? 0;
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const netProfit = summary?.profit ?? totalRevenue - totalProductCosts - totalExpenses;
  const profitMargin = totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 100) : 0;
  const outstanding = summary?.outstanding ?? 0;
  const inventoryValue = products.reduce((sum, p) => sum + (p.stock || 0) * (p.cost ?? p.price ?? 0), 0);
  const totalStockUnits = products.reduce((sum, p) => sum + (p.stock || 0), 0);
  const lowStockCount = products.filter((p) => p.stock <= 3).length;

  // ── Returning clients ──────────────────────────────────────────────────────
  const clientCounts = useMemo(() => {
    const map = new Map<string, number>();
    allOrders.forEach((o) => {
      const id = o.customerPhone?.trim() || o.customerName?.trim();
      if (id && id.toLowerCase() !== 'waiting for buyer') map.set(id, (map.get(id) ?? 0) + 1);
    });
    const totalClients = map.size;
    const repeatClients = Array.from(map.values()).filter((c) => c > 1).length;
    return { totalClients, repeatClients, rate: totalClients > 0 ? Math.round((repeatClients / totalClients) * 100) : 0 };
  }, [allOrders]);

  // ── Bar chart — monthly revenue ────────────────────────────────────────────
  const barData = useMemo(() => {
    const daily = summary?.dailyPerformance ?? [];
    if (daily.length > 0)
      return daily.map((d) => ({ label: d.label, revenue: d.revenue, orders: d.orders }));
    const days: Record<string, { revenue: number; orders: number }> = {};
    periodOrders.forEach((o) => {
      const d = new Date(o.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (!days[d]) days[d] = { revenue: 0, orders: 0 };
      days[d].revenue += o.amount;
      days[d].orders += 1;
    });
    return Object.entries(days).map(([label, v]) => ({ label, revenue: v.revenue, orders: v.orders }));
  }, [summary?.dailyPerformance, periodOrders]);

  // ── Donut: channel breakdown ───────────────────────────────────────────────
  const DONUT_PALETTE = ['#0f172a', '#334155', '#64748b', '#94a3b8', '#cbd5e1', '#e2e8f0'];
  const channelDonut = useMemo(() => {
    const map = new Map<string, number>();
    periodOrders.forEach((o) => {
      const ch = o.channel ?? 'other';
      map.set(ch, (map.get(ch) ?? 0) + o.amount);
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name: channelName(name), value: Math.round(value) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [periodOrders]);

  const expensesDonut = useMemo(() => {
    const map = new Map<string, number>();
    expenses.forEach((e) => {
      const cat = (e as any).category ?? 'Other';
      map.set(cat, (map.get(cat) ?? 0) + e.amount);
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [expenses]);

  const donutData = activeDonut === 'channel' ? channelDonut : expensesDonut;
  const donutTotal = donutData.reduce((s, d) => s + d.value, 0);

  // ── Export ─────────────────────────────────────────────────────────────────

  const handleExport = () => {
    const headers = ['Period', 'Revenue', 'Orders', 'AOV', 'COGS', 'Expenses', 'Net Profit', 'Margin%', 'Inventory', 'Stock Units', 'Repeat Rate%'];
    const row = [`"${periodLabel}"`, totalRevenue.toFixed(2), totalOrdersCount, avgOrderValue.toFixed(2), totalProductCosts.toFixed(2), totalExpenses.toFixed(2), netProfit.toFixed(2), `${profitMargin}%`, inventoryValue.toFixed(2), totalStockUnits, `${clientCounts.rate}%`];
    const blob = new Blob([[headers, row].map((r) => r.join(',')).join('\n')], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `takeorder-report-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setExported(true);
    setTimeout(() => setExported(false), 3000);
  };

  // close period dropdown on outside click
  useEffect(() => {
    if (!periodMenuOpen) return;
    const handler = (e: PointerEvent) => {
      if (periodMenuRef.current && !periodMenuRef.current.contains(e.target as Node)) setPeriodMenuOpen(false);
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [periodMenuOpen]);

  const isLoading = summaryQuery.isLoading || ordersQuery.isLoading || productsQuery.isLoading;

  return (
    <div className="space-y-8">
      {/* ── Page Header ──────────────────────────────────────────────────────── */}
      <PageHeader
        title="Analytics"
        filters={
          <div className="flex flex-wrap items-center gap-2">
            {/* Period selector */}
            <div className="relative" ref={periodMenuRef}>
              <button
                ref={periodTriggerRef}
                type="button"
                onClick={() => { setDraftPeriod(period); setDraftCustomRange(appliedCustomRange); setPeriodMenuOpen((o) => !o); }}
                className="inline-flex items-center gap-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-1.5 text-xs font-semibold text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition cursor-pointer"
              >
                <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                <Calendar size={13} className="text-[hsl(var(--muted-foreground))]" />
                <span>{periodLabel}</span>
                <ChevronDown size={12} className={cn('transition-transform text-[hsl(var(--muted-foreground))]', periodMenuOpen && 'rotate-180')} />
              </button>

              {periodMenuOpen && (
                <div className="absolute right-0 top-full mt-2 z-50 min-w-[200px] rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-2 shadow-xl" role="dialog">
                  {draftPeriod !== 'custom' ? (
                    <div className="space-y-1">
                      {dashboardPeriodOptions.map((opt) => (
                        <button key={opt.value} type="button"
                          className={cn('w-full flex items-center justify-between rounded-xl px-3 py-2 text-xs font-medium text-left transition cursor-pointer', period === opt.value ? 'bg-neutral-900 text-white font-semibold dark:bg-white dark:text-neutral-900' : 'text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-900')}
                          onClick={() => { setPeriod(opt.value); setDraftPeriod(opt.value); setPeriodMenuOpen(false); writeDashboardPeriodPreference({ period: opt.value, customFrom: appliedCustomRange.from, customTo: appliedCustomRange.to }); }}
                        >
                          <span>{opt.label}</span>
                          {period === opt.value && <Check size={12} />}
                        </button>
                      ))}
                      <button type="button" className="w-full flex items-center justify-between rounded-xl px-3 py-2 text-xs font-medium text-left text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-900 transition cursor-pointer" onClick={() => setDraftPeriod('custom')}>
                        <span>Custom date range…</span>
                      </button>
                    </div>
                  ) : (
                    <DashboardCustomRangePicker
                      from={draftCustomRange.from}
                      to={draftCustomRange.to}
                      onFromChange={(from) => setDraftCustomRange((c) => ({ ...c, from }))}
                      onToChange={(to) => setDraftCustomRange((c) => ({ ...c, to }))}
                      onClose={() => { setDraftPeriod(period); setPeriodMenuOpen(false); }}
                      onApply={() => { if (draftPeriodRange) { setPeriod('custom'); setAppliedCustomRange(draftCustomRange); setPeriodMenuOpen(false); writeDashboardPeriodPreference({ period: 'custom', customFrom: draftCustomRange.from, customTo: draftCustomRange.to }); } }}
                      canApply={Boolean(draftPeriodRange)}
                    />
                  )}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleExport}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-1.5 text-xs font-semibold text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition cursor-pointer"
            >
              {exported ? <Check size={12} className="text-emerald-600" /> : <Download size={12} />}
              <span>{exported ? 'Downloaded' : 'Export CSV'}</span>
            </button>
          </div>
        }
      />

      {/* ── Row 1: 2 Big Stat Cards + Revenue highlight + Profit highlight ─── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Revenue */}
        <div className="rounded-2xl border border-neutral-200/80 bg-white p-5 shadow-2xs dark:border-neutral-800 dark:bg-neutral-900">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Total Revenue</p>
          {isLoading ? (
            <Skeleton className="mt-3 h-9 w-36" />
          ) : (
            <div className="mt-2 text-3xl font-extrabold tracking-tight text-neutral-950 dark:text-white">
              {money(totalRevenue)}
            </div>
          )}
          <p className="mt-1 text-[11px] text-neutral-400">{periodLabel}</p>
        </div>

        {/* Total Orders */}
        <div className="rounded-2xl border border-neutral-200/80 bg-white p-5 shadow-2xs dark:border-neutral-800 dark:bg-neutral-900">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Total Orders</p>
          {isLoading ? (
            <Skeleton className="mt-3 h-9 w-24" />
          ) : (
            <div className="mt-2 text-3xl font-extrabold tracking-tight text-neutral-950 dark:text-white">
              {totalOrdersCount}
            </div>
          )}
          <p className="mt-1 text-[11px] text-neutral-400">{periodLabel}</p>
        </div>

        {/* Average Order Value */}
        <div className="rounded-2xl border border-neutral-200/80 bg-white p-5 shadow-2xs dark:border-neutral-800 dark:bg-neutral-900">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Avg. Order Value</p>
          {isLoading ? (
            <Skeleton className="mt-3 h-9 w-32" />
          ) : (
            <div className="mt-2 text-3xl font-extrabold tracking-tight text-neutral-950 dark:text-white">
              {money(avgOrderValue)}
            </div>
          )}
          <p className="mt-1 text-[11px] text-neutral-400">Per transaction</p>
        </div>

        {/* Net Profit — dark accent card */}
        <div className="rounded-2xl bg-neutral-900 p-5 shadow-2xs dark:bg-white">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Net Profit</p>
          {isLoading ? (
            <Skeleton className="mt-3 h-9 w-32 bg-neutral-700 dark:bg-neutral-200" />
          ) : (
            <div className="mt-2 text-3xl font-extrabold tracking-tight text-white dark:text-neutral-900">
              {money(netProfit)}
            </div>
          )}
          <p className="mt-1 text-[11px] text-neutral-500 dark:text-neutral-400">
            {profitMargin >= 0 ? `${profitMargin}% margin` : 'Net loss this period'}
          </p>
        </div>
      </div>

      {/* ── Row 2: Donut + Bar Chart ──────────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        {/* Donut Card */}
        <div className="rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-2xs dark:border-neutral-800 dark:bg-neutral-900">
          {/* Toggle */}
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-bold text-neutral-900 dark:text-white">Breakdown</h3>
            <div className="inline-flex rounded-xl bg-neutral-100 p-1 text-xs dark:bg-neutral-800">
              <button
                type="button"
                onClick={() => setActiveDonut('channel')}
                className={cn('rounded-lg px-2.5 py-1 font-medium transition cursor-pointer', activeDonut === 'channel' ? 'bg-white text-neutral-950 font-semibold shadow-2xs dark:bg-neutral-900 dark:text-white' : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400')}
              >
                Channel
              </button>
              <button
                type="button"
                onClick={() => setActiveDonut('expenses')}
                className={cn('rounded-lg px-2.5 py-1 font-medium transition cursor-pointer', activeDonut === 'expenses' ? 'bg-white text-neutral-950 font-semibold shadow-2xs dark:bg-neutral-900 dark:text-white' : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400')}
              >
                Expenses
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center h-48">
              <Skeleton className="h-40 w-40 rounded-full" />
            </div>
          ) : donutData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-neutral-400 text-center gap-2">
              <Info size={24} />
              <p className="text-xs">{activeDonut === 'channel' ? 'No orders in this period' : 'No expenses recorded'}</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-center">
                <PieChart width={200} height={200}>
                  <Pie
                    data={donutData}
                    cx={100}
                    cy={100}
                    innerRadius={58}
                    outerRadius={88}
                    paddingAngle={3}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {donutData.map((_, i) => (
                      <Cell key={i} fill={DONUT_PALETTE[i % DONUT_PALETTE.length]} />
                    ))}
                  </Pie>
                  <text x={100} y={95} textAnchor="middle" fill="#94a3b8" fontSize={10}>
                    {activeDonut === 'channel' ? 'Revenue' : 'Spent'}
                  </text>
                  <text x={100} y={113} textAnchor="middle" fill="#0f172a" fontSize={13} fontWeight={700}>
                    {moneyExact(donutTotal)}
                  </text>
                </PieChart>
              </div>

              {/* Legend */}
              <div className="mt-4 space-y-2.5">
                {donutData.map((item, i) => {
                  const pct = donutTotal > 0 ? Math.round((item.value / donutTotal) * 100) : 0;
                  return (
                    <div key={item.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: DONUT_PALETTE[i % DONUT_PALETTE.length] }} />
                        <span className="text-xs text-neutral-700 dark:text-neutral-300 truncate max-w-[130px]">{item.name}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-right">
                        <span className="font-bold text-neutral-900 dark:text-white">{moneyExact(item.value)}</span>
                        <span className="w-8 text-neutral-400">{pct}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Bar Chart Card */}
        <div className="rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-2xs dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-bold text-neutral-900 dark:text-white">Revenue Over Time</h3>
            <span className="text-[11px] font-semibold text-neutral-400">{periodLabel}</span>
          </div>

          {isLoading ? (
            <Skeleton className="h-64 w-full rounded-xl" />
          ) : barData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-neutral-400 text-center gap-2">
              <Info size={24} />
              <p className="text-xs">No transaction data in this period</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={264}>
              <BarChart data={barData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barSize={barData.length > 20 ? 8 : barData.length > 10 ? 14 : 22}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(200,200,200,0.18)" />
                <XAxis dataKey="label" stroke="#a1a1aa" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#a1a1aa" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}`} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="rounded-xl border border-neutral-200 bg-white p-3 shadow-lg dark:border-neutral-800 dark:bg-neutral-950 text-xs">
                        <div className="font-semibold text-neutral-500 mb-1">{label}</div>
                        <div className="font-bold text-neutral-900 dark:text-white">{money(payload[0].value as number)}</div>
                        {payload[1] && <div className="text-neutral-500 mt-0.5">{payload[1].value} orders</div>}
                      </div>
                    );
                  }}
                />
                <Bar dataKey="revenue" fill="#0f172a" radius={[5, 5, 0, 0]} name="Revenue" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Row 3: 5 Metric Detail Cards ─────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {/* Outstanding Balances */}
        <div className="rounded-2xl border border-neutral-200/80 bg-white p-5 shadow-2xs dark:border-neutral-800 dark:bg-neutral-900">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Outstanding</p>
          {isLoading ? <Skeleton className="mt-3 h-7 w-24" /> : (
            <div className={cn('mt-2 text-xl font-extrabold tracking-tight', outstanding > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-neutral-950 dark:text-white')}>
              {money(outstanding)}
            </div>
          )}
          <p className="mt-1 text-[11px] text-neutral-400">Uncollected balances</p>
        </div>

        {/* Operating Expenses */}
        <div className="rounded-2xl border border-neutral-200/80 bg-white p-5 shadow-2xs dark:border-neutral-800 dark:bg-neutral-900">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Operating Expenses</p>
          {isLoading ? <Skeleton className="mt-3 h-7 w-24" /> : (
            <div className="mt-2 text-xl font-extrabold tracking-tight text-neutral-950 dark:text-white">
              {money(totalExpenses)}
            </div>
          )}
          <p className="mt-1 text-[11px] text-neutral-400">{expenses.length} expense{expenses.length !== 1 ? 's' : ''} logged</p>
        </div>

        {/* Inventory Value */}
        <div className="rounded-2xl border border-neutral-200/80 bg-white p-5 shadow-2xs dark:border-neutral-800 dark:bg-neutral-900">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Inventory Value</p>
          {isLoading ? <Skeleton className="mt-3 h-7 w-24" /> : (
            <div className="mt-2 text-xl font-extrabold tracking-tight text-neutral-950 dark:text-white">
              {money(inventoryValue)}
            </div>
          )}
          <p className="mt-1 text-[11px] text-neutral-400">{totalStockUnits} units · {lowStockCount} low stock</p>
        </div>

        {/* Returning Clients */}
        <div className="rounded-2xl border border-neutral-200/80 bg-white p-5 shadow-2xs dark:border-neutral-800 dark:bg-neutral-900">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Repeat Clients</p>
          {isLoading ? <Skeleton className="mt-3 h-7 w-16" /> : (
            <div className="mt-2 text-xl font-extrabold tracking-tight text-neutral-950 dark:text-white">
              {clientCounts.rate}%
            </div>
          )}
          <p className="mt-1 text-[11px] text-neutral-400">{clientCounts.repeatClients} of {clientCounts.totalClients} buyers</p>
        </div>

        {/* Net Profit Margin */}
        <div className="rounded-2xl border border-neutral-200/80 bg-white p-5 shadow-2xs dark:border-neutral-800 dark:bg-neutral-900">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Net Margin</p>
          {isLoading ? <Skeleton className="mt-3 h-7 w-16" /> : (
            <div className={cn('mt-2 text-xl font-extrabold tracking-tight', profitMargin >= 20 ? 'text-emerald-700 dark:text-emerald-400' : profitMargin >= 0 ? 'text-neutral-950 dark:text-white' : 'text-rose-600 dark:text-rose-400')}>
              {profitMargin}%
            </div>
          )}
          <p className="mt-1 text-[11px] text-neutral-400">After COGS + expenses</p>
        </div>
      </div>

      {/* ── Row 4: Channel Performance Table (if data exists) ─────────────────── */}
      {(summary?.channelPerformance?.length ?? 0) > 0 && (
        <div className="rounded-2xl border border-neutral-200/80 bg-white shadow-2xs dark:border-neutral-800 dark:bg-neutral-900 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 dark:border-neutral-800">
            <h3 className="text-sm font-bold text-neutral-900 dark:text-white">Channel Performance</h3>
            <Link href="/reports/channel-conversion" className="text-xs font-semibold text-neutral-600 hover:text-neutral-950 dark:text-neutral-400 dark:hover:text-white flex items-center gap-1 transition">
              <span>Details</span>
              <ArrowUpRight size={13} />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px] text-sm">
              <thead>
                <tr className="bg-neutral-50/80 dark:bg-neutral-950 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                  <th className="px-6 py-3 text-left">Channel</th>
                  <th className="px-4 py-3 text-right">Orders</th>
                  <th className="px-4 py-3 text-right">Revenue</th>
                  <th className="px-4 py-3 text-right">Conversion</th>
                  <th className="px-6 py-3 text-right">Share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {summary!.channelPerformance!.map((ch, i) => (
                  <tr key={ch.channel} className="hover:bg-neutral-50/80 dark:hover:bg-neutral-900/60 transition">
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full shrink-0" style={{ background: DONUT_PALETTE[i % DONUT_PALETTE.length] }} />
                        <span className="font-semibold text-neutral-900 dark:text-white">{channelName(ch.channel)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-neutral-900 dark:text-white">{ch.orders}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-neutral-900 dark:text-white">{money(ch.revenue)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={cn('text-xs font-bold', ch.conversionRate >= 50 ? 'text-emerald-700 dark:text-emerald-400' : 'text-neutral-700 dark:text-neutral-300')}>
                        {ch.conversionRate}%
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-20 h-1.5 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                          <div className="h-full rounded-full bg-neutral-900 dark:bg-white" style={{ width: `${Math.min(100, ch.conversionRate)}%` }} />
                        </div>
                        <span className="text-[11px] text-neutral-500 w-8 text-right">{ch.conversionRate}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
