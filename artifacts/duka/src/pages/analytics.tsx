import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Link } from 'wouter';
import {
  TrendingUp,
  ShoppingBag,
  Percent,
  Clock3,
  DollarSign,
  Package,
  Receipt,
  Users,
  Calendar,
  ChevronDown,
  Download,
  Check,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Info,
  Filter,
  BarChart3,
  ShieldCheck,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  BarChart,
  Bar,
} from 'recharts';
import { cn } from '@/lib/utils';
import {
  useGetDashboardSummary,
  getGetDashboardSummaryQueryKey,
  useListProducts,
  useListOrders,
  useListExpenses,
} from '@/lib/api-hooks';
import {
  money,
  moneyExact,
  dateShort,
  channelName,
  currencySymbol,
} from '@/lib/formatters';
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

type MetricKey = 'revenue' | 'orders' | 'aov' | 'profit' | 'inventory' | 'expenses' | 'clients';

export function AnalyticsPage() {
  const [activeMetric, setActiveMetric] = useState<MetricKey>('revenue');
  const [chartViewType, setChartViewType] = useState<'line' | 'bar'>('line');
  const [granularity, setGranularity] = useState<'daily' | 'weekly'>('daily');
  const [exported, setExported] = useState(false);

  // Timeframe state
  const today = inputDate(new Date());
  const [savedPreference] = useState(() => readDashboardPeriodPreference());
  const [period, setPeriod] = useState<DashboardPeriod>(() => savedPreference?.period ?? 'month');
  const [draftPeriod, setDraftPeriod] = useState<DashboardPeriod>(() => savedPreference?.period ?? 'month');
  const [periodMenuOpen, setPeriodMenuOpen] = useState(false);
  const periodMenuRef = useRef<HTMLDivElement>(null);
  const periodTriggerRef = useRef<HTMLButtonElement>(null);

  const initialCustomRange = useMemo(() => ({ from: shiftInputDate(today, -29), to: today }), [today]);
  const restoredCustomRange = savedPreference?.period === 'custom'
    ? { from: savedPreference.customFrom, to: savedPreference.customTo }
    : initialCustomRange;
  const [appliedCustomRange, setAppliedCustomRange] = useState<DashboardDateRange>(() => restoredCustomRange);
  const [draftCustomRange, setDraftCustomRange] = useState<DashboardDateRange>(() => restoredCustomRange);

  const periodRange = useMemo(() => dashboardPeriodRange(period, appliedCustomRange.from, appliedCustomRange.to), [period, appliedCustomRange]);
  const draftPeriodRange = useMemo(() => dashboardPeriodRange(draftPeriod, draftCustomRange.from, draftCustomRange.to), [draftPeriod, draftCustomRange]);
  const periodLabel = dashboardPeriodLabel(period, appliedCustomRange.from, appliedCustomRange.to);

  const summaryQuery = useGetDashboardSummary(periodRange, {
    query: {
      queryKey: getGetDashboardSummaryQueryKey(periodRange ?? undefined),
      placeholderData: (prev) => prev,
    },
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
    return allOrders.filter((order) => {
      const date = new Date(order.createdAt).toISOString().slice(0, 10);
      return date >= periodRange.from && date <= periodRange.to;
    });
  }, [allOrders, periodRange]);

  // Aggregate metrics
  const totalRevenue = summary?.revenue ?? periodOrders.reduce((sum, o) => sum + (o.status === 'paid' ? o.amount : o.status === 'deposit_paid' ? (o.depositAmount ?? 0) : 0), 0);
  const totalOrdersCount = periodOrders.length;
  const avgOrderValue = totalOrdersCount > 0 ? (totalRevenue / totalOrdersCount) : 0;
  const totalProductCosts = summary?.productCosts ?? 0;
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const netProfit = summary?.profit ?? (totalRevenue - totalProductCosts - totalExpenses);
  const profitMargin = totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 100) : 0;
  const inventoryValue = products.reduce((sum, p) => sum + (p.stock || 0) * (p.cost ?? p.price ?? 0), 0);
  const totalStockUnits = products.reduce((sum, p) => sum + (p.stock || 0), 0);
  const lowStockCount = products.filter((p) => p.stock <= 3).length;

  // Clients retention
  const clientCounts = useMemo(() => {
    const map = new Map<string, number>();
    allOrders.forEach((o) => {
      const id = o.customerPhone?.trim() || o.customerName?.trim();
      if (id && id.toLowerCase() !== 'waiting for buyer') {
        map.set(id, (map.get(id) ?? 0) + 1);
      }
    });
    const totalClients = map.size;
    const repeatClients = Array.from(map.values()).filter((c) => c > 1).length;
    const rate = totalClients > 0 ? Math.round((repeatClients / totalClients) * 100) : 0;
    return { totalClients, repeatClients, rate };
  }, [allOrders]);

  // Chart data from daily performance or orders
  const chartData = useMemo(() => {
    const daily = summary?.dailyPerformance ?? [];
    if (daily.length > 0) {
      return daily.map((d) => ({
        label: d.label,
        revenue: d.revenue,
        orders: d.orders,
        profit: Math.round(d.revenue * 0.65), // approximate if daily breakdown not itemized
        aov: d.orders > 0 ? Math.round(d.revenue / d.orders) : 0,
      }));
    }
    // Fallback: build from periodOrders
    const days: Record<string, { revenue: number; orders: number }> = {};
    periodOrders.forEach((o) => {
      const d = new Date(o.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (!days[d]) days[d] = { revenue: 0, orders: 0 };
      days[d].revenue += o.amount;
      days[d].orders += 1;
    });
    return Object.entries(days).map(([label, val]) => ({
      label,
      revenue: val.revenue,
      orders: val.orders,
      profit: Math.round(val.revenue * 0.7),
      aov: val.orders > 0 ? Math.round(val.revenue / val.orders) : 0,
    }));
  }, [summary?.dailyPerformance, periodOrders]);

  const metricsConfig: Record<MetricKey, {
    label: string;
    category: string;
    value: string;
    icon: any;
    color: string;
    chartColor: string;
    unit: string;
    description: string;
  }> = {
    revenue: {
      label: 'Gross Revenue',
      category: 'Financials',
      value: money(totalRevenue),
      icon: DollarSign,
      color: 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40',
      chartColor: '#10b981',
      unit: currencySymbol(),
      description: 'Total settled buyer orders across all channels',
    },
    orders: {
      label: 'Total Orders',
      category: 'Volume',
      value: String(totalOrdersCount),
      icon: ShoppingBag,
      color: 'text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40',
      chartColor: '#3b82f6',
      unit: 'orders',
      description: 'Completed customer checkout links within this period',
    },
    aov: {
      label: 'Average Order Value',
      category: 'Efficiency',
      value: money(avgOrderValue),
      icon: Percent,
      color: 'text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40',
      chartColor: '#8b5cf6',
      unit: currencySymbol(),
      description: 'Average spending power per buyer transaction',
    },
    profit: {
      label: 'Net Profit & Margins',
      category: 'Financials',
      value: `${money(netProfit)} (${profitMargin}%)`,
      icon: TrendingUp,
      color: 'text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/40',
      chartColor: '#14b8a6',
      unit: currencySymbol(),
      description: 'Gross revenue minus product cost of goods and logged expenses',
    },
    inventory: {
      label: 'Catalog Inventory Value',
      category: 'Stock Operations',
      value: money(inventoryValue),
      icon: Package,
      color: 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40',
      chartColor: '#f59e0b',
      unit: currencySymbol(),
      description: `${totalStockUnits} total stock units across ${products.length} catalog items`,
    },
    expenses: {
      label: 'Operating Expenses',
      category: 'Costs',
      value: money(totalExpenses),
      icon: Receipt,
      color: 'text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40',
      chartColor: '#f43f5e',
      unit: currencySymbol(),
      description: `${expenses.length} operating and shipping courier costs recorded`,
    },
    clients: {
      label: 'Returning Client Rate',
      category: 'Retention',
      value: `${clientCounts.rate}%`,
      icon: Users,
      color: 'text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40',
      chartColor: '#6366f1',
      unit: '%',
      description: `${clientCounts.repeatClients} of ${clientCounts.totalClients} buyers have made repeat orders`,
    },
  };

  const currentConfig = metricsConfig[activeMetric];

  // Full Annual / Custom Business Report Export
  const handleExportFullReport = () => {
    const headers = [
      'Report Period',
      'Total Revenue',
      'Total Orders',
      'Average Order Value',
      'COGS',
      'Operating Expenses',
      'Net Profit',
      'Net Margin %',
      'Catalog Inventory Value',
      'Total Stock Units',
      'Repeat Client Rate %',
    ];
    const row = [
      `"${periodLabel}"`,
      totalRevenue.toFixed(2),
      totalOrdersCount,
      avgOrderValue.toFixed(2),
      totalProductCosts.toFixed(2),
      totalExpenses.toFixed(2),
      netProfit.toFixed(2),
      `${profitMargin}%`,
      inventoryValue.toFixed(2),
      totalStockUnits,
      `${clientCounts.rate}%`,
    ];
    const csvContent = [headers.join(','), row.join(',')].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `takeorder-business-report-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setExported(true);
    setTimeout(() => setExported(false), 3000);
  };

  const applyCustomPeriod = () => {
    if (!draftPeriodRange) return;
    setPeriod('custom');
    setAppliedCustomRange(draftCustomRange);
    setPeriodMenuOpen(false);
    writeDashboardPeriodPreference({ period: 'custom', customFrom: draftCustomRange.from, customTo: draftCustomRange.to });
  };

  const closePeriodMenu = () => {
    setDraftPeriod(period);
    setDraftCustomRange(appliedCustomRange);
    setPeriodMenuOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Breadcrumb matching media_1790870483993.png */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/70 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <Link href="/dashboard" className="hover:underline">Take Order</Link>
            <span>/</span>
            <span className="font-semibold text-slate-700 dark:text-slate-300">Analytics</span>
            <span>/</span>
            <span className="text-slate-900 dark:text-white font-bold">{currentConfig.label}</span>
          </div>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-950 dark:text-white">
            {currentConfig.label}
          </h1>
        </div>

        {/* Global Timeframe Card & Report CTA */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Timeframe Dropdown (Same as Dashboard) */}
          <div className="relative" ref={periodMenuRef}>
            <button
              ref={periodTriggerRef}
              type="button"
              className="inline-flex items-center gap-2 rounded-full border border-slate-200/90 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-800 shadow-2xs hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 transition cursor-pointer"
              aria-label="Reporting period"
              aria-expanded={periodMenuOpen}
              onClick={() => {
                setDraftPeriod(period);
                setDraftCustomRange(appliedCustomRange);
                setPeriodMenuOpen((open) => !open);
              }}
            >
              <Calendar size={13} className="text-emerald-500" />
              <span>{periodLabel}</span>
              <ChevronDown size={13} className={cn('transition-transform text-slate-400', periodMenuOpen && 'rotate-180')} />
            </button>

            {periodMenuOpen && (
              <div
                className="absolute right-0 top-full mt-2 z-50 min-w-[200px] rounded-2xl border border-slate-200/90 bg-white p-2 shadow-xl dark:border-slate-800 dark:bg-slate-950"
                role="dialog"
              >
                {draftPeriod !== 'custom' ? (
                  <div className="space-y-1">
                    {dashboardPeriodOptions.map((opt) => (
                      <button
                        type="button"
                        key={opt.value}
                        className={cn(
                          'w-full flex items-center justify-between rounded-xl px-3 py-2 text-xs font-medium text-left transition',
                          period === opt.value
                            ? 'bg-slate-900 text-white font-semibold dark:bg-white dark:text-slate-900'
                            : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900'
                        )}
                        onClick={() => {
                          setPeriod(opt.value);
                          setDraftPeriod(opt.value);
                          setPeriodMenuOpen(false);
                          writeDashboardPeriodPreference({ period: opt.value });
                        }}
                      >
                        <span>{opt.label}</span>
                        {period === opt.value && <Check size={13} />}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="w-full flex items-center justify-between rounded-xl px-3 py-2 text-xs font-medium text-left text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900 transition"
                      onClick={() => setDraftPeriod('custom')}
                    >
                      <span>Custom date range…</span>
                    </button>
                  </div>
                ) : (
                  <DashboardCustomRangePicker
                    from={draftCustomRange.from}
                    to={draftCustomRange.to}
                    onFromChange={(from) => setDraftCustomRange((curr) => ({ ...curr, from }))}
                    onToChange={(to) => setDraftCustomRange((curr) => ({ ...curr, to }))}
                    onClose={closePeriodMenu}
                    onApply={applyCustomPeriod}
                    canApply={Boolean(draftPeriodRange)}
                  />
                )}
              </div>
            )}
          </div>

          {/* Export Business Report */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportFullReport}
            className="rounded-full text-xs font-semibold gap-1.5 shadow-2xs"
          >
            {exported ? <Check size={13} className="text-emerald-500" /> : <Download size={13} />}
            <span>{exported ? 'Downloaded' : 'Export Full Report (CSV)'}</span>
          </Button>
        </div>
      </div>

      {/* Main Split Layout: Left Rail (Condensed Metrics) + Right Canvas (Interactive Chart & Breakdown) */}
      <div className="grid gap-6 lg:grid-cols-12 items-start">
        {/* Left Condensed Metric Rail */}
        <div className="lg:col-span-4 space-y-2.5">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-1 mb-1">
            Performance Metrics
          </div>

          {(Object.keys(metricsConfig) as MetricKey[]).map((key) => {
            const config = metricsConfig[key];
            const Icon = config.icon;
            const isSelected = activeMetric === key;

            return (
              <button
                key={key}
                type="button"
                onClick={() => setActiveMetric(key)}
                className={cn(
                  'w-full flex items-center justify-between p-3.5 rounded-2xl border text-left transition-all cursor-pointer shadow-2xs',
                  isSelected
                    ? 'border-slate-900 bg-white ring-2 ring-slate-900/10 dark:border-white dark:bg-slate-900 dark:ring-white/10'
                    : 'border-slate-200/80 bg-white/70 hover:bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900/60 dark:hover:bg-slate-900'
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', config.color)}>
                    <Icon size={17} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {config.label}
                    </div>
                    <div className="text-sm sm:text-base font-bold text-slate-950 dark:text-white truncate">
                      {config.value}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 pl-2">
                  {isSelected && (
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Right Canvas: Chart + Insights Breakdown */}
        <div className="lg:col-span-8 space-y-6">
          <Card className="rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            {/* Chart Toolbar Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  {currentConfig.category}
                </span>
                <span className="text-slate-300">·</span>
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  {currentConfig.description}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div className="inline-flex rounded-xl bg-slate-100 p-1 text-xs dark:bg-slate-800">
                  <button
                    type="button"
                    onClick={() => setChartViewType('line')}
                    className={cn(
                      'rounded-lg px-2.5 py-1 font-medium transition cursor-pointer',
                      chartViewType === 'line'
                        ? 'bg-white text-slate-950 font-semibold shadow-2xs dark:bg-slate-900 dark:text-white'
                        : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                    )}
                  >
                    Line
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartViewType('bar')}
                    className={cn(
                      'rounded-lg px-2.5 py-1 font-medium transition cursor-pointer',
                      chartViewType === 'bar'
                        ? 'bg-white text-slate-950 font-semibold shadow-2xs dark:bg-slate-900 dark:text-white'
                        : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                    )}
                  >
                    Bar
                  </button>
                </div>
              </div>
            </div>

            {/* Interactive Chart Canvas */}
            <div className="h-72 w-full pt-6">
              {summaryQuery.isLoading ? (
                <div className="flex h-full w-full items-center justify-center">
                  <Skeleton className="h-60 w-full rounded-2xl" />
                </div>
              ) : chartData.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center text-slate-400">
                  <Info size={28} className="mb-2 text-slate-300" />
                  <p className="text-sm font-semibold">No transactions recorded in this timeframe</p>
                  <p className="text-xs text-slate-400 mt-1">Select a wider period or take an order to see trending data.</p>
                </div>
              ) : chartViewType === 'line' ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id={`gradient-${activeMetric}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={currentConfig.chartColor} stopOpacity={0.25} />
                        <stop offset="95%" stopColor={currentConfig.chartColor} stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(200,200,200,0.2)" />
                    <XAxis dataKey="label" stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="#888888" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val) => activeMetric === 'orders' ? String(val) : `${val}`} />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        const item = payload[0];
                        return (
                          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-lg dark:border-slate-800 dark:bg-slate-950 text-xs">
                            <div className="font-semibold text-slate-500 mb-1">{label}</div>
                            <div className="font-bold text-slate-900 dark:text-white">
                              {activeMetric === 'orders' ? `${item.value} orders` : `${currencySymbol()} ${item.value?.toLocaleString()}`}
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey={activeMetric === 'orders' ? 'orders' : activeMetric === 'profit' ? 'profit' : activeMetric === 'aov' ? 'aov' : 'revenue'}
                      stroke={currentConfig.chartColor}
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill={`url(#gradient-${activeMetric})`}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(200,200,200,0.2)" />
                    <XAxis dataKey="label" stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip />
                    <Bar
                      dataKey={activeMetric === 'orders' ? 'orders' : activeMetric === 'profit' ? 'profit' : activeMetric === 'aov' ? 'aov' : 'revenue'}
                      fill={currentConfig.chartColor}
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>

          {/* Breakdown KPI Cards below the Chart */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Orders</span>
              <div className="mt-2 text-xl font-extrabold text-slate-900 dark:text-white">
                {totalOrdersCount}
              </div>
              <p className="mt-1 text-xs text-slate-500">Across {periodLabel}</p>
            </Card>

            <Card className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Net Profit Margin</span>
              <div className="mt-2 text-xl font-extrabold text-teal-700 dark:text-teal-400">
                {profitMargin}%
              </div>
              <p className="mt-1 text-xs text-slate-500">Estimated profitability</p>
            </Card>

            <Card className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Active Inventory</span>
              <div className="mt-2 text-xl font-extrabold text-slate-900 dark:text-white">
                {totalStockUnits} units
              </div>
              <p className="mt-1 text-xs text-slate-500">{lowStockCount} items running low</p>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
