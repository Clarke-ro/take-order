import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Link } from 'wouter';
import {
  Calendar,
  ChevronDown,
  Download,
  Check,
  ArrowUpRight,
  Info,
  AlertTriangle,
  Send,
  Plus,
  TrendingUp,
  X,
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
import { StatCard } from '@/components/stat-card';
import { SegmentedControl } from '@/components/segmented-control';
import {
  useGetDashboardSummary,
  getGetDashboardSummaryQueryKey,
  useListProducts,
  useListOrders,
  useListExpenses,
  useGetSellerSettings,
  useCreateExpense,
  getListExpensesQueryKey,
} from '@/lib/api-hooks';
import { useQueryClient } from '@tanstack/react-query';
import { money, moneyExact, currencySymbol } from '@/lib/formatters';
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
import {
  calculateUnifiedMetrics,
  sanitizeCsvCell,
  CHANNEL_COLORS,
  CHANNEL_LABELS,
  type MetricOrder,
  type MetricProduct,
  type MetricExpense,
} from '@/lib/metrics';
import { Skeleton } from '@/components/ui/skeleton';

type ExpandableMetricKey =
  | 'revenue'
  | 'orders'
  | 'aov'
  | 'profit'
  | 'outstanding'
  | 'expenses'
  | 'inventory'
  | 'clients'
  | 'margin';

// Mini sparkline SVG generator
function MiniSparkline({
  data,
  color = '#111111',
  width = 54,
  height = 20,
}: {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
}) {
  if (!data || data.length < 2) {
    return <div className="h-5 w-12 rounded-sm bg-neutral-100 dark:bg-neutral-800" />;
  }
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data
    .map((val, idx) => {
      const x = (idx / (data.length - 1)) * (width - 4) + 2;
      const y = height - 2 - ((val - min) / range) * (height - 6);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

export function AnalyticsPage() {
  const queryClient = useQueryClient();
  const today = inputDate(new Date());
  const [savedPreference] = useState(() => readDashboardPeriodPreference());
  const [period, setPeriod] = useState<DashboardPeriod>(() => savedPreference?.period ?? 'month');
  const [draftPeriod, setDraftPeriod] = useState<DashboardPeriod>(() => savedPreference?.period ?? 'month');
  const [periodMenuOpen, setPeriodMenuOpen] = useState(false);
  const periodMenuRef = useRef<HTMLDivElement>(null);
  const periodTriggerRef = useRef<HTMLButtonElement>(null);

  const [comparePrevious, setComparePrevious] = useState(false);
  const [expandedMetric, setExpandedMetric] = useState<ExpandableMetricKey | null>(null);
  const [exported, setExported] = useState(false);
  const [channelExpenseView, setChannelExpenseView] = useState<'channel' | 'expenses'>('channel');
  const [timeChartView, setTimeChartView] = useState<'revenue' | 'orders'>('revenue');
  const [addExpenseModalOpen, setAddExpenseModalOpen] = useState(false);

  // Custom date range state
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

  // Queries
  const summaryQuery = useGetDashboardSummary(periodRange, {
    query: { queryKey: getGetDashboardSummaryQueryKey(periodRange ?? undefined), placeholderData: (prev) => prev },
  });
  const productsQuery = useListProducts();
  const ordersQuery = useListOrders();
  const expensesQuery = useListExpenses();
  const settingsQuery = useGetSellerSettings();

  const summary = summaryQuery.data;
  const products = (productsQuery.data ?? []) as unknown as MetricProduct[];
  const allOrders = (ordersQuery.data ?? []) as unknown as MetricOrder[];
  const expenses = (expensesQuery.data ?? []) as unknown as MetricExpense[];
  const sellerTimezone = (settingsQuery.data as any)?.timezone || (settingsQuery.data as any)?.settings?.timezone || 'Africa/Accra';

  // Core metrics calculated from unified single module
  const metrics = useMemo(() => {
    return calculateUnifiedMetrics({
      orders: allOrders,
      products,
      expenses,
      periodRange,
      serverSummary: summary,
    });
  }, [allOrders, products, expenses, periodRange, summary]);

  // Handle Esc to close expandable panel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && expandedMetric) {
        setExpandedMetric(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [expandedMetric]);

  // Close period dropdown on outside click
  useEffect(() => {
    if (!periodMenuOpen) return;
    const handler = (e: PointerEvent) => {
      if (periodMenuRef.current && !periodMenuRef.current.contains(e.target as Node)) {
        setPeriodMenuOpen(false);
      }
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [periodMenuOpen]);

  // Zero-filled Time series data
  const timeChartData = useMemo(() => {
    if (summary?.dailyPerformance && summary.dailyPerformance.length > 0) {
      return summary.dailyPerformance.map((d) => ({
        date: d.date,
        label: d.label,
        revenue: d.revenue,
        orders: d.orders,
      }));
    }

    // Fallback client zero-fill if summary is pending
    const fromStr = periodRange?.from || shiftInputDate(today, -6);
    const toStr = periodRange?.to || today;
    const fromDate = new Date(`${fromStr}T00:00:00.000Z`);
    const toDate = new Date(`${toStr}T00:00:00.000Z`);
    const days = Math.max(1, Math.min(366, Math.floor((toDate.getTime() - fromDate.getTime()) / 86400000) + 1));

    const result = [];
    for (let i = 0; i < days; i++) {
      const cur = new Date(fromDate);
      cur.setUTCDate(fromDate.getUTCDate() + i);
      const dStr = cur.toISOString().slice(0, 10);
      const dayOrders = allOrders.filter((o) => {
        const orderDate = typeof o.createdAt === 'string' ? o.createdAt.slice(0, 10) : new Date(o.createdAt).toISOString().slice(0, 10);
        return orderDate === dStr && (o.status === 'paid' || o.status === 'deposit_paid');
      });
      const rev = dayOrders.reduce((sum, o) => sum + (o.status === 'deposit_paid' ? Number(o.depositAmount || 0) : Number(o.amount || 0)), 0);
      result.push({
        date: dStr,
        label: days <= 14
          ? cur.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })
          : cur.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }),
        revenue: rev,
        orders: dayOrders.length,
      });
    }
    return result;
  }, [summary?.dailyPerformance, periodRange, today, allOrders]);

  // Donut data for Channel & Expenses
  const donutData = useMemo(() => {
    if (channelExpenseView === 'channel') {
      const channelItems = metrics.channels.map((c) => ({
        name: c.label,
        value: c.revenue,
        orders: c.orders,
        color: c.color,
      }));
      return channelItems;
    } else {
      // Group expenses by category
      const catMap = new Map<string, number>();
      expenses.forEach((e) => {
        const cat = e.category || 'General';
        catMap.set(cat, (catMap.get(cat) || 0) + Number(e.amount || 0));
      });
      const expenseColors = ['#111111', '#6366F1', '#EC4899', '#F59E0B', '#10B981', '#8B5CF6'];
      return Array.from(catMap.entries()).map(([name, value], idx) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        value,
        orders: 0,
        color: expenseColors[idx % expenseColors.length],
      }));
    }
  }, [channelExpenseView, metrics.channels, expenses]);

  const donutTotal = useMemo(() => {
    return donutData.reduce((sum, item) => sum + item.value, 0);
  }, [donutData]);

  // CSV Export with formula injection defense
  const handleExport = () => {
    // Columns: Date, Orders, Order value, Revenue collected, Outstanding, Product costs, Operating expenses, Net profit
    const headers = [
      'Date',
      'Orders',
      'Order value',
      'Revenue collected',
      'Outstanding',
      'Product costs',
      'Operating expenses',
      'Net profit',
    ];

    const rows = timeChartData.map((d) => [
      sanitizeCsvCell(d.date),
      sanitizeCsvCell(d.orders),
      sanitizeCsvCell(d.revenue.toFixed(2)),
      sanitizeCsvCell(d.revenue.toFixed(2)),
      sanitizeCsvCell('0.00'),
      sanitizeCsvCell('0.00'),
      sanitizeCsvCell('0.00'),
      sanitizeCsvCell(d.revenue.toFixed(2)),
    ]);

    // Append summary row
    rows.push([
      sanitizeCsvCell('TOTAL'),
      sanitizeCsvCell(metrics.totalOrdersCount),
      sanitizeCsvCell(metrics.orderValue.toFixed(2)),
      sanitizeCsvCell(metrics.totalRevenue.toFixed(2)),
      sanitizeCsvCell(metrics.outstanding.toFixed(2)),
      sanitizeCsvCell(metrics.totalProductCosts.toFixed(2)),
      sanitizeCsvCell(metrics.totalExpenses.toFixed(2)),
      sanitizeCsvCell(metrics.netProfit.toFixed(2)),
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `take-order-analytics-${period}.csv`;
    a.click();
    setExported(true);
    setTimeout(() => setExported(false), 3000);
  };

  const isLoading = summaryQuery.isLoading || ordersQuery.isLoading || productsQuery.isLoading;

  const toggleExpand = (metricKey: ExpandableMetricKey) => {
    setExpandedMetric((current) => (current === metricKey ? null : metricKey));
  };

  // Quick expense form state
  const createExpenseMutation = useCreateExpense();
  const [expenseTitle, setExpenseTitle] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseCategory, setExpenseCategory] = useState('inventory');
  const [expenseError, setExpenseError] = useState('');

  const handleSaveExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(expenseAmount);
    if (!expenseTitle.trim() || !Number.isFinite(amt) || amt <= 0) {
      setExpenseError('Please enter a valid expense title and positive amount.');
      return;
    }
    setExpenseError('');
    createExpenseMutation.mutate(
      {
        data: {
          title: expenseTitle.trim(),
          amount: amt,
          category: expenseCategory as any,
          date: today,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListExpensesQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
          setAddExpenseModalOpen(false);
          setExpenseTitle('');
          setExpenseAmount('');
        },
        onError: (err: any) => {
          setExpenseError(err?.message || 'Failed to save expense. Please retry.');
        },
      }
    );
  };

  return (
    <div className="space-y-6">
      {/* ── Page Header: Title and Actions on the EXACT SAME line, right-aligned ─── */}
      <PageHeader
        title="Analytics"
        secondaryActions={
          <div className="flex items-center gap-2">
            {/* Compare to previous period toggle */}
            <button
              type="button"
              onClick={() => setComparePrevious((v) => !v)}
              className={cn(
                'hidden sm:inline-flex items-center gap-1.5 h-9 px-3 rounded-[8px] border text-xs font-medium transition cursor-pointer select-none',
                comparePrevious
                  ? 'border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900'
                  : 'border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]'
              )}
              title="Compare metrics against previous period"
            >
              <TrendingUp size={13} />
              <span>Compare</span>
            </button>

            {/* Period selector dropdown */}
            <div className="relative" ref={periodMenuRef}>
              <button
                ref={periodTriggerRef}
                type="button"
                onClick={() => {
                  setDraftPeriod(period);
                  setDraftCustomRange(appliedCustomRange);
                  setPeriodMenuOpen((o) => !o);
                }}
                className="inline-flex items-center gap-2 h-9 rounded-[8px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 text-xs font-semibold text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition cursor-pointer"
              >
                <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                <Calendar size={13} className="text-[hsl(var(--muted-foreground))]" />
                <span className="truncate max-w-[130px] sm:max-w-none">{periodLabel}</span>
                <ChevronDown
                  size={12}
                  className={cn(
                    'transition-transform text-[hsl(var(--muted-foreground))] shrink-0',
                    periodMenuOpen && 'rotate-180'
                  )}
                />
              </button>

              {periodMenuOpen && (
                <div
                  className="absolute right-0 top-full mt-2 z-50 min-w-[220px] rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-2 shadow-xl"
                  role="dialog"
                >
                  {draftPeriod !== 'custom' ? (
                    <div className="space-y-1">
                      {dashboardPeriodOptions.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          className={cn(
                            'w-full flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium text-left transition cursor-pointer',
                            period === opt.value
                              ? 'bg-neutral-900 text-white font-semibold dark:bg-white dark:text-neutral-900'
                              : 'text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-900'
                          )}
                          onClick={() => {
                            setPeriod(opt.value);
                            setDraftPeriod(opt.value);
                            setPeriodMenuOpen(false);
                            writeDashboardPeriodPreference({
                              period: opt.value,
                              customFrom: appliedCustomRange.from,
                              customTo: appliedCustomRange.to,
                            });
                          }}
                        >
                          <span>{opt.label}</span>
                          {period === opt.value && <Check size={12} />}
                        </button>
                      ))}
                      <button
                        type="button"
                        className="w-full flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium text-left text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-900 transition cursor-pointer"
                        onClick={() => setDraftPeriod('custom')}
                      >
                        <span>Custom date range…</span>
                      </button>
                    </div>
                  ) : (
                    <DashboardCustomRangePicker
                      from={draftCustomRange.from}
                      to={draftCustomRange.to}
                      onFromChange={(from) => setDraftCustomRange((c) => ({ ...c, from }))}
                      onToChange={(to) => setDraftCustomRange((c) => ({ ...c, to }))}
                      onClose={() => {
                        setDraftPeriod(period);
                        setPeriodMenuOpen(false);
                      }}
                      onApply={() => {
                        if (draftPeriodRange) {
                          setPeriod('custom');
                          setAppliedCustomRange(draftCustomRange);
                          setPeriodMenuOpen(false);
                          writeDashboardPeriodPreference({
                            period: 'custom',
                            customFrom: draftCustomRange.from,
                            customTo: draftCustomRange.to,
                          });
                        }
                      }}
                      canApply={Boolean(draftPeriodRange)}
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        }
        primaryAction={
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 h-9 rounded-[8px] bg-neutral-900 px-3 text-xs font-medium text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100 transition cursor-pointer shrink-0"
            title="Download verified metrics CSV"
          >
            {exported ? <Check size={13} className="text-emerald-400" /> : <Download size={13} />}
            <span>{exported ? 'Downloaded' : 'Export CSV'}</span>
          </button>
        }
      />

      {/* ── Missing Costs Warning Banner ─── */}
      {metrics.missingCostProducts.length > 0 && (
        <div className="flex items-start justify-between gap-3 p-4 rounded-[12px] border border-amber-200 bg-amber-50 text-amber-900 text-xs">
          <div className="flex items-start gap-2.5">
            <AlertTriangle size={16} className="text-amber-600 mt-0.5 shrink-0" />
            <div>
              <strong className="font-semibold">Missing product costs detected:</strong>{' '}
              <span>
                {metrics.missingCostProducts.length} product(s) sold in this period have no cost set. Net profit requires
                accurate cost of goods.
              </span>
              <div className="mt-1 flex flex-wrap gap-2">
                {metrics.missingCostProducts.slice(0, 3).map((p) => (
                  <Link
                    key={p.id}
                    href={`/catalog/edit/${p.id}`}
                    className="inline-flex items-center gap-1 font-semibold underline hover:text-amber-950"
                  >
                    <span>Edit {p.name}</span>
                    <ArrowUpRight size={11} />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Stat Cards Grid (Sentence-case, Info icons, All White Cards, Expandable) ─── */}
      <section aria-label="Key Performance Indicators">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Card 1: Total Revenue */}
          <StatCard
            label="Total revenue"
            value={isLoading ? '—' : money(metrics.totalRevenue)}
            description="Total cash collected in this period from settled orders and paid deposits."
            caption="Cash collected"
            onClick={() => toggleExpand('revenue')}
            expanded={expandedMetric === 'revenue'}
            ariaControls="analytics-detail-panel"
            sparkline={<MiniSparkline data={timeChartData.map((d) => d.revenue)} />}
          />

          {/* Card 2: Total Orders */}
          <StatCard
            label="Total orders"
            value={isLoading ? '—' : metrics.totalOrdersCount}
            description="Total orders placed in the reporting period (excluding drafts and cancellations)."
            caption={`${metrics.totalOrdersCount} placed orders`}
            onClick={() => toggleExpand('orders')}
            expanded={expandedMetric === 'orders'}
            ariaControls="analytics-detail-panel"
            sparkline={<MiniSparkline data={timeChartData.map((d) => d.orders)} />}
          />

          {/* Card 3: Average Order Value */}
          <StatCard
            label="Average order value"
            value={isLoading ? '—' : money(metrics.avgOrderValue)}
            description="Total order value divided by total placed orders in this period."
            caption={`Order value: ${money(metrics.orderValue)}`}
            onClick={() => toggleExpand('aov')}
            expanded={expandedMetric === 'aov'}
            ariaControls="analytics-detail-panel"
          />

          {/* Card 4: Net Profit (Clean White Card) */}
          <StatCard
            label="Net profit"
            value={isLoading ? '—' : money(metrics.netProfit)}
            description="Collected revenue minus cost of goods sold minus operating expenses."
            caption={metrics.profitMargin >= 0 ? `${metrics.profitMargin}% net margin` : 'Net loss this period'}
            onClick={() => toggleExpand('profit')}
            expanded={expandedMetric === 'profit'}
            ariaControls="analytics-detail-panel"
          />
        </div>

        {/* Second Row of 5 Stat Cards */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 mt-3">
          {/* Card 5: Outstanding Balance */}
          <StatCard
            label="Outstanding"
            value={isLoading ? '—' : money(metrics.outstanding)}
            description="Uncollected balances across all open orders (unpaid and deposit balances)."
            caption="Uncollected balance"
            onClick={() => toggleExpand('outstanding')}
            expanded={expandedMetric === 'outstanding'}
            ariaControls="analytics-detail-panel"
            className={metrics.outstanding > 0 ? 'border-amber-300' : ''}
          />

          {/* Card 6: Operating Expenses */}
          <StatCard
            label="Operating expenses"
            value={isLoading ? '—' : money(metrics.totalExpenses)}
            description="Total non-inventory expenses logged in this period (rent, delivery, marketing)."
            caption={`${expenses.length} expense${expenses.length !== 1 ? 's' : ''} logged`}
            onClick={() => toggleExpand('expenses')}
            expanded={expandedMetric === 'expenses'}
            ariaControls="analytics-detail-panel"
          />

          {/* Card 7: Inventory Value */}
          <StatCard
            label="Inventory value"
            value={isLoading ? '—' : money(metrics.inventory.totalRetailValue)}
            description="Total retail value of current merchandise stock in catalog."
            caption={`${metrics.inventory.totalUnits} units · ${metrics.inventory.lowStockCount} low stock`}
            onClick={() => toggleExpand('inventory')}
            expanded={expandedMetric === 'inventory'}
            ariaControls="analytics-detail-panel"
          />

          {/* Card 8: Repeat Clients */}
          <StatCard
            label="Repeat clients"
            value={isLoading ? '—' : `${metrics.clientCounts.rate}%`}
            description="Share of unique buyers with more than one order in this period."
            caption={`${metrics.clientCounts.repeatClients} of ${metrics.clientCounts.totalClients} buyers`}
            onClick={() => toggleExpand('clients')}
            expanded={expandedMetric === 'clients'}
            ariaControls="analytics-detail-panel"
          />

          {/* Card 9: Net Margin */}
          <StatCard
            label="Net margin"
            value={isLoading ? '—' : `${metrics.profitMargin}%`}
            description="Net profit divided by total collected revenue in this period."
            caption="After COGS & OpEx"
            onClick={() => toggleExpand('margin')}
            expanded={expandedMetric === 'margin'}
            ariaControls="analytics-detail-panel"
          />
        </div>

        {/* ── EXPANDABLE INLINE DETAIL PANEL (Full Width, 200ms Height/Fade Animation) ─── */}
        {expandedMetric && (
          <div
            id="analytics-detail-panel"
            role="region"
            aria-label={`${expandedMetric} details`}
            className="mt-4 rounded-[12px] border border-neutral-900 bg-white p-6 shadow-sm dark:border-white dark:bg-neutral-900 transition-all duration-200 animate-in fade-in slide-in-from-top-2"
          >
            <div className="flex items-center justify-between pb-4 border-b border-[hsl(var(--border))]">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-neutral-900 dark:bg-white" />
                <h3 className="text-sm font-semibold text-[hsl(var(--foreground))] capitalize">
                  {expandedMetric === 'aov'
                    ? 'Average Order Value Breakdown'
                    : `${expandedMetric.replace('_', ' ')} breakdown & details`}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setExpandedMetric(null)}
                className="h-7 w-7 inline-flex items-center justify-center rounded-md text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] transition cursor-pointer"
                title="Close detail panel (Esc)"
              >
                <X size={15} />
              </button>
            </div>

            {/* Panel 1: Revenue Detail */}
            {expandedMetric === 'revenue' && (
              <div className="pt-4 grid gap-6 md:grid-cols-2">
                <div>
                  <h4 className="text-xs font-semibold text-[hsl(var(--muted-foreground))] mb-3 uppercase tracking-wider">
                    Collected Revenue by Channel
                  </h4>
                  <div className="space-y-2">
                    {metrics.channels.map((ch) => (
                      <div key={ch.channel} className="flex items-center justify-between text-xs p-2 rounded-lg bg-[hsl(var(--muted))]/50">
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: ch.color }} />
                          <span className="font-medium text-[hsl(var(--foreground))]">{ch.label}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-[hsl(var(--foreground))]">{money(ch.revenue)}</span>
                          <span className="text-[hsl(var(--muted-foreground))] w-8 text-right">{ch.sharePercentage}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-[hsl(var(--muted-foreground))] mb-3 uppercase tracking-wider">
                    Settlement Status
                  </h4>
                  <div className="space-y-3 p-4 rounded-xl border border-[hsl(var(--border))] text-xs">
                    <div className="flex justify-between">
                      <span className="text-[hsl(var(--muted-foreground))]">Settled in full:</span>
                      <strong className="text-[hsl(var(--foreground))]">
                        {money(allOrders.filter((o) => o.status === 'paid').reduce((s, o) => s + Number(o.amount), 0))}
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[hsl(var(--muted-foreground))]">Deposit payments collected:</span>
                      <strong className="text-[hsl(var(--foreground))]">
                        {money(allOrders.filter((o) => o.status === 'deposit_paid').reduce((s, o) => s + Number(o.depositAmount || 0), 0))}
                      </strong>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-[hsl(var(--border))] font-semibold">
                      <span>Total Realized Revenue:</span>
                      <span className="text-emerald-600">{money(metrics.totalRevenue)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Panel 2: Total Orders Detail */}
            {expandedMetric === 'orders' && (
              <div className="pt-4 grid gap-6 md:grid-cols-2">
                <div>
                  <h4 className="text-xs font-semibold text-[hsl(var(--muted-foreground))] mb-3 uppercase tracking-wider">
                    Orders by Status
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between p-2 rounded-lg bg-[hsl(var(--muted))]/50">
                      <span>Paid in full:</span>
                      <strong>{allOrders.filter((o) => o.status === 'paid').length} orders</strong>
                    </div>
                    <div className="flex justify-between p-2 rounded-lg bg-[hsl(var(--muted))]/50">
                      <span>Deposit paid:</span>
                      <strong>{allOrders.filter((o) => o.status === 'deposit_paid').length} orders</strong>
                    </div>
                    <div className="flex justify-between p-2 rounded-lg bg-[hsl(var(--muted))]/50">
                      <span>Pending / Unpaid:</span>
                      <strong>{allOrders.filter((o) => o.status === 'pending' || o.status === 'unpaid').length} orders</strong>
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-[hsl(var(--muted-foreground))] mb-3 uppercase tracking-wider">
                    Orders by Channel
                  </h4>
                  <div className="space-y-2 text-xs">
                    {metrics.channels.map((ch) => (
                      <div key={ch.channel} className="flex justify-between p-2 rounded-lg bg-[hsl(var(--muted))]/50">
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: ch.color }} />
                          <span>{ch.label}</span>
                        </div>
                        <strong>{ch.orders} orders</strong>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Panel 3: AOV Distribution */}
            {expandedMetric === 'aov' && (
              <div className="pt-4">
                <h4 className="text-xs font-semibold text-[hsl(var(--muted-foreground))] mb-3 uppercase tracking-wider">
                  Order Value Distribution Buckets ({currencySymbol()})
                </h4>
                <div className="grid gap-3 sm:grid-cols-4">
                  {metrics.aovBuckets.map((b) => (
                    <div key={b.range} className="p-4 rounded-xl border border-[hsl(var(--border))] text-center">
                      <span className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">{b.label}</span>
                      <div className="mt-2 text-2xl font-bold text-[hsl(var(--foreground))]">{b.count}</div>
                      <div className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">{b.percentage}% of orders</div>
                      <div className="mt-2 w-full h-1.5 rounded-full bg-[hsl(var(--muted))] overflow-hidden">
                        <div className="h-full bg-neutral-900 dark:bg-white rounded-full" style={{ width: `${b.percentage}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Panel 4: Net Profit Waterfall */}
            {expandedMetric === 'profit' && (
              <div className="pt-4 space-y-4">
                <h4 className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                  Net Profit Waterfall Breakdown
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))]">
                        <th className="py-2">Item</th>
                        <th className="py-2 text-right">Amount</th>
                        <th className="py-2 text-right">% of Revenue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[hsl(var(--border))]">
                      <tr>
                        <td className="py-2.5 font-medium">Collected Revenue</td>
                        <td className="py-2.5 text-right font-semibold text-emerald-600">+{money(metrics.totalRevenue)}</td>
                        <td className="py-2.5 text-right">100%</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 font-medium">Cost of Goods Sold (COGS)</td>
                        <td className="py-2.5 text-right font-semibold text-rose-600">-{money(metrics.totalProductCosts)}</td>
                        <td className="py-2.5 text-right">
                          {metrics.totalRevenue > 0 ? Math.round((metrics.totalProductCosts / metrics.totalRevenue) * 100) : 0}%
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2.5 font-medium">Operating Expenses (OpEx)</td>
                        <td className="py-2.5 text-right font-semibold text-rose-600">-{money(metrics.totalExpenses)}</td>
                        <td className="py-2.5 text-right">
                          {metrics.totalRevenue > 0 ? Math.round((metrics.totalExpenses / metrics.totalRevenue) * 100) : 0}%
                        </td>
                      </tr>
                      <tr className="border-t-2 border-neutral-900 dark:border-white font-bold text-sm">
                        <td className="py-3">Net Profit</td>
                        <td className={cn('py-3 text-right', metrics.netProfit >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600')}>
                          {money(metrics.netProfit)}
                        </td>
                        <td className="py-3 text-right">{metrics.profitMargin}%</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Panel 5: Outstanding Balances */}
            {expandedMetric === 'outstanding' && (
              <div className="pt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                    Uncollected Balances by Aging Window
                  </h4>
                  <span className="text-xs font-semibold text-amber-600">Total Due: {money(metrics.outstandingAging.totalDue)}</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="p-3 rounded-xl border border-[hsl(var(--border))]">
                    <span className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">&lt; 7 Days</span>
                    <div className="mt-1 text-lg font-bold text-[hsl(var(--foreground))]">
                      {money(metrics.outstandingAging.under7Days.reduce((s, o) => s + o.balanceDue, 0))}
                    </div>
                    <span className="text-[11px] text-[hsl(var(--muted-foreground))]">{metrics.outstandingAging.under7Days.length} orders</span>
                  </div>
                  <div className="p-3 rounded-xl border border-[hsl(var(--border))]">
                    <span className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">7 – 14 Days</span>
                    <div className="mt-1 text-lg font-bold text-amber-600">
                      {money(metrics.outstandingAging.between7And14Days.reduce((s, o) => s + o.balanceDue, 0))}
                    </div>
                    <span className="text-[11px] text-[hsl(var(--muted-foreground))]">{metrics.outstandingAging.between7And14Days.length} orders</span>
                  </div>
                  <div className="p-3 rounded-xl border border-[hsl(var(--border))]">
                    <span className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">&gt; 14 Days</span>
                    <div className="mt-1 text-lg font-bold text-rose-600">
                      {money(metrics.outstandingAging.over14Days.reduce((s, o) => s + o.balanceDue, 0))}
                    </div>
                    <span className="text-[11px] text-[hsl(var(--muted-foreground))]">{metrics.outstandingAging.over14Days.length} orders</span>
                  </div>
                </div>

                {/* List of outstanding orders with reminder button */}
                <div className="pt-2">
                  <h5 className="text-xs font-semibold text-[hsl(var(--muted-foreground))] mb-2">Open Orders Needing Follow-up</h5>
                  <div className="max-h-56 overflow-y-auto space-y-1.5 scrollbar-thin">
                    {[
                      ...metrics.outstandingAging.over14Days,
                      ...metrics.outstandingAging.between7And14Days,
                      ...metrics.outstandingAging.under7Days,
                    ].slice(0, 10).map((o) => (
                      <div key={o.id} className="flex items-center justify-between p-2.5 rounded-lg border border-[hsl(var(--border))] text-xs">
                        <div>
                          <strong className="text-[hsl(var(--foreground))]">{o.customerName}</strong>
                          <span className="text-[hsl(var(--muted-foreground))] ml-2">({o.productName}) · {o.daysAgo}d ago</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-rose-600">{money(o.balanceDue)} due</span>
                          {o.customerPhone && (
                            <a
                              href={`https://wa.me/${o.customerPhone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hi ${o.customerName}, gentle reminder regarding your order balance of ${money(o.balanceDue)}.`)}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#25D366] text-white font-medium hover:opacity-90 transition text-[11px]"
                            >
                              <Send size={11} />
                              <span>Remind</span>
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Panel 6: Operating Expenses Detail */}
            {expandedMetric === 'expenses' && (
              <div className="pt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                    Logged Operating Expenses
                  </h4>
                  <button
                    type="button"
                    onClick={() => setAddExpenseModalOpen(true)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-neutral-900 text-white text-xs font-medium hover:bg-neutral-800 transition cursor-pointer"
                  >
                    <Plus size={12} />
                    <span>Add expense</span>
                  </button>
                </div>
                <div className="max-h-56 overflow-y-auto space-y-1.5 scrollbar-thin">
                  {expenses.length === 0 ? (
                    <p className="text-xs text-[hsl(var(--muted-foreground))] py-4 text-center">No expenses logged in this period.</p>
                  ) : (
                    expenses.slice(0, 10).map((e, idx) => (
                      <div key={e.id || idx} className="flex items-center justify-between p-2.5 rounded-lg bg-[hsl(var(--muted))]/50 text-xs">
                        <div>
                          <span className="font-medium text-[hsl(var(--foreground))]">{e.description || e.category || 'Expense'}</span>
                          <span className="text-[hsl(var(--muted-foreground))] ml-2">({e.expenseDate || e.date})</span>
                        </div>
                        <span className="font-semibold text-[hsl(var(--foreground))]">{money(Number(e.amount))}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Panel 7: Inventory Value Detail */}
            {expandedMetric === 'inventory' && (
              <div className="pt-4 space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="p-3 rounded-xl border border-[hsl(var(--border))]">
                    <span className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">Retail Valuation</span>
                    <div className="mt-1 text-lg font-bold text-[hsl(var(--foreground))]">{money(metrics.inventory.totalRetailValue)}</div>
                  </div>
                  <div className="p-3 rounded-xl border border-[hsl(var(--border))]">
                    <span className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">Cost Valuation</span>
                    <div className="mt-1 text-lg font-bold text-[hsl(var(--foreground))]">{money(metrics.inventory.totalCostValue)}</div>
                  </div>
                  <div className="p-3 rounded-xl border border-[hsl(var(--border))]">
                    <span className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">Potential Profit</span>
                    <div className="mt-1 text-lg font-bold text-emerald-600">{money(metrics.inventory.potentialProfit)}</div>
                  </div>
                </div>
                <h5 className="text-xs font-semibold text-[hsl(var(--muted-foreground))] pt-2">Top Valued Inventory Items</h5>
                <div className="space-y-1.5">
                  {metrics.inventory.topValuedItems.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-2.5 rounded-lg bg-[hsl(var(--muted))]/50 text-xs">
                      <div>
                        <span className="font-medium text-[hsl(var(--foreground))]">{item.name}</span>
                        <span className="text-[hsl(var(--muted-foreground))] ml-2">({item.stock} in stock · cost {money(Number(item.cost))})</span>
                      </div>
                      <span className="font-semibold text-[hsl(var(--foreground))]">{money(item.totalValue)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Panel 8: Repeat Clients Detail */}
            {expandedMetric === 'clients' && (
              <div className="pt-4 space-y-4">
                <h4 className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                  Top Repeat Customers
                </h4>
                {metrics.clientCounts.topRepeatClients.length === 0 ? (
                  <p className="text-xs text-[hsl(var(--muted-foreground))] py-4 text-center">No repeat customers recorded yet in this window.</p>
                ) : (
                  <div className="space-y-1.5">
                    {metrics.clientCounts.topRepeatClients.map((client) => (
                      <div key={client.id} className="flex items-center justify-between p-2.5 rounded-lg bg-[hsl(var(--muted))]/50 text-xs">
                        <div>
                          <span className="font-medium text-[hsl(var(--foreground))]">{client.name}</span>
                          {client.phone && <span className="text-[hsl(var(--muted-foreground))] ml-2">({client.phone})</span>}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[hsl(var(--muted-foreground))]">{client.orderCount} orders</span>
                          <span className="font-semibold text-[hsl(var(--foreground))]">{money(client.totalSpent)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Panel 9: Net Margin Detail */}
            {expandedMetric === 'margin' && (
              <div className="pt-4 space-y-4 text-xs">
                <h4 className="font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                  Margin Health & Benchmark
                </h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="p-4 rounded-xl border border-[hsl(var(--border))]">
                    <span className="text-[hsl(var(--muted-foreground))]">Gross Margin (Revenue − COGS):</span>
                    <div className="mt-2 text-xl font-bold text-[hsl(var(--foreground))]">
                      {metrics.totalRevenue > 0
                        ? Math.round(((metrics.totalRevenue - metrics.totalProductCosts) / metrics.totalRevenue) * 100)
                        : 0}%
                    </div>
                  </div>
                  <div className="p-4 rounded-xl border border-[hsl(var(--border))]">
                    <span className="text-[hsl(var(--muted-foreground))]">Net Margin (After COGS & OpEx):</span>
                    <div className="mt-2 text-xl font-bold text-emerald-600">{metrics.profitMargin}%</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── Row 2: Donut Breakdown + Time Chart (Revenue over time) ─── */}
      <section className="grid gap-6 lg:grid-cols-[380px_1fr]">
        {/* Donut Card: SegmentedControl toggle + Accessible Tokens */}
        <div className="rounded-[12px] border border-[hsl(var(--card-border))] bg-white p-6 shadow-2xs dark:bg-neutral-900">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-bold text-[hsl(var(--foreground))]">Breakdown</h3>
            <SegmentedControl<'channel' | 'expenses'>
              size="sm"
              value={channelExpenseView}
              onChange={setChannelExpenseView}
              options={[
                { value: 'channel', label: 'Channel' },
                { value: 'expenses', label: 'Expenses' },
              ]}
            />
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center h-48">
              <Skeleton className="h-40 w-40 rounded-full" />
            </div>
          ) : donutData.length === 0 || donutTotal === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-[hsl(var(--muted-foreground))] text-center gap-2">
              <Info size={24} />
              <p className="text-xs">
                {channelExpenseView === 'channel' ? 'No sales in this period' : 'No expenses logged'}
              </p>
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
                    {donutData.map((entry, idx) => (
                      <Cell key={`cell-${idx}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <text x={100} y={93} textAnchor="middle" fill="#6B7280" fontSize={11}>
                    {channelExpenseView === 'channel' ? 'Revenue' : 'Expenses'}
                  </text>
                  <text x={100} y={115} textAnchor="middle" fill="#111111" fontSize={14} fontWeight={700}>
                    {moneyExact(donutTotal)}
                  </text>
                </PieChart>
              </div>

              {/* Channel / Expense list with revenue, order count, and share % */}
              <div className="mt-5 space-y-2.5 max-h-48 overflow-y-auto scrollbar-thin">
                {donutData.map((item) => {
                  const pct = donutTotal > 0 ? Math.round((item.value / donutTotal) * 100) : 0;
                  return (
                    <div key={item.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: item.color }} />
                        <span className="text-[hsl(var(--foreground))] truncate max-w-[130px] font-medium">{item.name}</span>
                      </div>
                      <div className="flex items-center gap-3 text-right">
                        {item.orders > 0 && (
                          <span className="text-[hsl(var(--muted-foreground))]">{item.orders} order{item.orders === 1 ? '' : 's'}</span>
                        )}
                        <span className="font-semibold text-[hsl(var(--foreground))]">{moneyExact(item.value)}</span>
                        <span className="w-8 text-[hsl(var(--muted-foreground))]">{pct}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Time Chart: Revenue / Orders Toggle + Zero-filled + Timezone Aware */}
        <div className="rounded-[12px] border border-[hsl(var(--card-border))] bg-white p-6 shadow-2xs dark:bg-neutral-900">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-bold text-[hsl(var(--foreground))]">Performance Over Time</h3>
              <span className="text-xs text-[hsl(var(--muted-foreground))] hidden sm:inline">({sellerTimezone})</span>
            </div>
            <SegmentedControl<'revenue' | 'orders'>
              size="sm"
              value={timeChartView}
              onChange={setTimeChartView}
              options={[
                { value: 'revenue', label: 'Revenue' },
                { value: 'orders', label: 'Orders' },
              ]}
            />
          </div>

          {isLoading ? (
            <Skeleton className="h-64 w-full rounded-xl" />
          ) : timeChartData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-[hsl(var(--muted-foreground))] text-center gap-2">
              <Info size={24} />
              <p className="text-xs">No activity in this period</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={timeChartData}
                margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
                barSize={timeChartData.length > 20 ? 8 : timeChartData.length > 10 ? 14 : 22}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(200,200,200,0.18)" />
                <XAxis
                  dataKey="label"
                  stroke="#a1a1aa"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  interval={timeChartData.length > 14 ? Math.floor(timeChartData.length / 7) : 0}
                />
                <YAxis
                  stroke="#a1a1aa"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => (timeChartView === 'revenue' ? `${v}` : `${v}`)}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="rounded-xl border border-[hsl(var(--border))] bg-white p-3 shadow-lg dark:bg-neutral-950 text-xs">
                        <div className="font-semibold text-[hsl(var(--muted-foreground))] mb-1">{label}</div>
                        <div className="font-bold text-[hsl(var(--foreground))]">
                          Revenue: {money(payload[0]?.payload?.revenue || 0)}
                        </div>
                        <div className="text-[hsl(var(--muted-foreground))] mt-0.5">
                          Orders: {payload[0]?.payload?.orders || 0}
                        </div>
                      </div>
                    );
                  }}
                />
                <Bar
                  dataKey={timeChartView}
                  fill="#111111"
                  radius={[4, 4, 0, 0]}
                  name={timeChartView === 'revenue' ? 'Revenue' : 'Orders'}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      {/* ── Quick Expense Modal ─── */}
      {addExpenseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-[12px] border border-[hsl(var(--border))] bg-white p-6 shadow-xl dark:bg-neutral-900">
            <div className="flex items-center justify-between pb-3 border-b border-[hsl(var(--border))]">
              <h4 className="text-sm font-semibold text-[hsl(var(--foreground))]">Record Operating Expense</h4>
              <button
                type="button"
                onClick={() => setAddExpenseModalOpen(false)}
                className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              >
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSaveExpense} className="mt-4 space-y-3 text-xs">
              {expenseError && <p className="text-rose-600">{expenseError}</p>}
              <div>
                <label className="block font-medium text-[hsl(var(--foreground))] mb-1">Expense Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Courier delivery, Packaging bags"
                  value={expenseTitle}
                  onChange={(e) => setExpenseTitle(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--card))]"
                />
              </div>
              <div>
                <label className="block font-medium text-[hsl(var(--foreground))] mb-1">Category</label>
                <select
                  value={expenseCategory}
                  onChange={(e) => setExpenseCategory(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--card))]"
                >
                  <option value="inventory">Inventory & Packaging</option>
                  <option value="shipping">Delivery / Rider Dispatch</option>
                  <option value="marketing">Marketing & Ads</option>
                  <option value="software">Software & Subscriptions</option>
                  <option value="other">Other Business Expense</option>
                </select>
              </div>
              <div>
                <label className="block font-medium text-[hsl(var(--foreground))] mb-1">Amount ({currencySymbol()})</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--card))]"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setAddExpenseModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createExpenseMutation.isPending}
                  className="px-4 py-1.5 rounded-lg bg-neutral-900 text-white font-medium hover:bg-neutral-800 disabled:opacity-50"
                >
                  {createExpenseMutation.isPending ? 'Saving…' : 'Save Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
