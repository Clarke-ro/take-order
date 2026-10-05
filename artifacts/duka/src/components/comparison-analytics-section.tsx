import React from "react";
import { Link } from "wouter";
import {
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Sparkles,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import { cn } from "@/lib/utils";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { money } from "@/lib/formatters";

export interface PeriodComparisonData {
  currentRange: { from: string; to: string; label: string };
  previousRange: { from: string; to: string; label: string; isFairMtd: boolean };
  hasEnoughData: boolean;
  metrics: Array<{
    id: string;
    label: string;
    current: number;
    previous: number;
    changePercent: number | null;
    isNew: boolean;
    lowerIsBetter?: boolean;
    format: "currency" | "integer" | "percent";
  }>;
  weeklyComparison: Array<{
    weekLabel: string;
    currentRevenue: number;
    previousRevenue: number;
    currentOrders: number;
    previousOrders: number;
  }>;
  whatsWorking: {
    topChannel?: { name: string; revenue: number; changePercent: number | null; summary: string };
    topProduct?: { name: string; revenue: number; changePercent: number | null; summary: string };
    bestWeekday?: { day: string; orders: number; revenue: number; summary: string };
  };
  needsAttention: {
    decliningChannel?: { name: string; changePercent: number; link: string; summary: string };
    decliningProduct?: { name: string; changePercent: number; link: string; summary: string };
    lowStockBestSellers: Array<{ id: number; name: string; stock: number; link: string }>;
    overdueOrders: Array<{ id: number; customerName: string; balanceDue: number; daysAgo: number; link: string }>;
  };
  gainers: Array<{ name: string; type: "channel" | "product"; changePercent: number | null; current: number }>;
  decliners: Array<{ name: string; type: "channel" | "product"; changePercent: number; current: number }>;
  insights: string[];
}

export interface ComparisonAnalyticsSectionProps {
  data: PeriodComparisonData;
  isLoading?: boolean;
}

export function ComparisonAnalyticsSection({
  data,
  isLoading = false,
}: ComparisonAnalyticsSectionProps) {
  // Format table metric values
  const formatVal = (val: number, format: "currency" | "integer" | "percent") => {
    if (format === "currency") return money(val);
    if (format === "percent") return `${val}%`;
    return val.toLocaleString();
  };

  const columns: DataTableColumn<PeriodComparisonData["metrics"][number]>[] = [
    {
      id: "label",
      header: "Metric",
      cell: (row) => <span className="font-medium text-[hsl(var(--foreground))]">{row.label}</span>,
    },
    {
      id: "current",
      header: "Current period",
      align: "right",
      cell: (row) => (
        <span className="font-semibold text-[hsl(var(--foreground))]">
          {formatVal(row.current, row.format)}
        </span>
      ),
    },
    {
      id: "previous",
      header: "Previous period",
      align: "right",
      cell: (row) => (
        <span className="text-[hsl(var(--muted-foreground))]">
          {formatVal(row.previous, row.format)}
        </span>
      ),
    },
    {
      id: "change",
      header: "Change",
      align: "right",
      cell: (row) => {
        if (row.isNew) {
          return (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
              No previous data
            </span>
          );
        }

        const pct = row.changePercent;
        if (pct === null || pct === undefined || pct === 0) {
          return (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
              0.0%
            </span>
          );
        }

        const isPositive = pct > 0;
        // Invert color meaning for metrics where lower is better (expenses, outstanding)
        const isGood = row.lowerIsBetter ? !isPositive : isPositive;

        return (
          <span
            className={cn(
              "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold",
              isGood
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
            )}
          >
            {isPositive ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            <span>
              {isPositive ? "+" : ""}
              {pct}%
            </span>
          </span>
        );
      },
    },
  ];

  return (
    <section aria-label="Comparison Analytics" className="space-y-6 pt-2">
      {/* ── Section Title & Alignment Banner ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-[hsl(var(--card-border))] pt-6">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-[hsl(var(--foreground))] tracking-tight">
              Period comparison
            </h2>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200">
              <Sparkles size={11} />
              <span>What is working</span>
            </span>
          </div>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
            Comparing <strong className="text-[hsl(var(--foreground))] font-medium">{data.currentRange.from} to {data.currentRange.to}</strong> against{" "}
            <strong className="text-[hsl(var(--foreground))] font-medium">{data.previousRange.from} to {data.previousRange.to}</strong>
            {data.previousRange.isFairMtd && " (Month-to-date fair day alignment)"}.
          </p>
        </div>
      </div>

      {/* ── Comparison Table (DataTable) ── */}
      <div className="rounded-[12px] border border-[hsl(var(--card-border))] bg-white dark:bg-neutral-900 p-6 shadow-2xs">
        <h3 className="text-[15px] font-semibold text-[hsl(var(--foreground))] mb-4">
          Financial & Operational Comparison
        </h3>
        <DataTable
          columns={columns}
          data={data.metrics}
          keyExtractor={(item) => item.id}
          isLoading={isLoading}
          minTableWidth="600px"
        />
      </div>

      {/* ── Grouped Bar Chart of Weekly Comparison ── */}
      <div className="rounded-[12px] border border-[hsl(var(--card-border))] bg-white dark:bg-neutral-900 p-6 shadow-2xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-[15px] font-semibold text-[hsl(var(--foreground))]">Revenue Trajectory by Week</h3>
            <p className="text-[11px] text-[hsl(var(--muted-foreground))]">Current period vs comparison window</p>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data.weeklyComparison} margin={{ top: 10, right: 10, left: -15, bottom: 0 }} maxBarSize={28}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(200,200,200,0.2)" />
            <XAxis dataKey="weekLabel" stroke="#a1a1aa" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis stroke="#a1a1aa" fontSize={11} tickLine={false} axisLine={false} />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                return (
                  <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-3 shadow-xl text-xs text-white">
                    <div className="font-semibold text-neutral-300 mb-1">{label}</div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-white">Current Period:</span>
                      <span className="font-bold">{money(payload[0]?.value as number)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4 mt-1">
                      <span className="text-neutral-400">Previous Period:</span>
                      <span className="font-bold">{money(payload[1]?.value as number)}</span>
                    </div>
                  </div>
                );
              }}
            />
            <Legend verticalAlign="top" align="right" iconSize={8} wrapperStyle={{ fontSize: 11, paddingBottom: 8 }} />
            <Bar dataKey="currentRevenue" name="Current Period" fill="#111111" radius={[3, 3, 0, 0]} />
            <Bar dataKey="previousRevenue" name="Previous Period" fill="#D4D4D8" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── What's Working & Needs Attention (2-Column Grid) ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* What's working mini cards */}
        <div className="rounded-[12px] border border-[hsl(var(--card-border))] bg-white dark:bg-neutral-900 p-6 flex flex-col justify-between shadow-2xs">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 size={16} className="text-emerald-600" />
            <h3 className="text-[15px] font-semibold text-[hsl(var(--foreground))]">What is working</h3>
          </div>

          <div className="space-y-3">
            {data.whatsWorking.topChannel ? (
              <div className="p-3.5 rounded-xl border border-[hsl(var(--border))] bg-neutral-50/50 dark:bg-neutral-800/30 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[hsl(var(--muted-foreground))]">Top Sales Channel</span>
                  <strong className="text-[hsl(var(--foreground))] font-semibold">{data.whatsWorking.topChannel.name}</strong>
                </div>
                <div className="mt-1 flex items-center justify-between text-[11px] text-[hsl(var(--muted-foreground))]">
                  <span>{money(data.whatsWorking.topChannel.revenue)} collected</span>
                  <span className="font-medium text-emerald-600">{data.whatsWorking.topChannel.summary}</span>
                </div>
              </div>
            ) : null}

            {data.whatsWorking.topProduct ? (
              <div className="p-3.5 rounded-xl border border-[hsl(var(--border))] bg-neutral-50/50 dark:bg-neutral-800/30 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[hsl(var(--muted-foreground))]">Top Selling Product</span>
                  <strong className="text-[hsl(var(--foreground))] font-semibold">{data.whatsWorking.topProduct.name}</strong>
                </div>
                <div className="mt-1 flex items-center justify-between text-[11px] text-[hsl(var(--muted-foreground))]">
                  <span>{money(data.whatsWorking.topProduct.revenue)} revenue</span>
                  <span className="font-medium text-emerald-600">{data.whatsWorking.topProduct.summary}</span>
                </div>
              </div>
            ) : null}

            {data.whatsWorking.bestWeekday ? (
              <div className="p-3.5 rounded-xl border border-[hsl(var(--border))] bg-neutral-50/50 dark:bg-neutral-800/30 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[hsl(var(--muted-foreground))]">Peak Converting Day</span>
                  <strong className="text-[hsl(var(--foreground))] font-semibold">{data.whatsWorking.bestWeekday.day}</strong>
                </div>
                <p className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">
                  {data.whatsWorking.bestWeekday.summary} ({money(data.whatsWorking.bestWeekday.revenue)})
                </p>
              </div>
            ) : null}
          </div>
        </div>

        {/* Needs attention actionable cards */}
        <div className="rounded-[12px] border border-[hsl(var(--card-border))] bg-white dark:bg-neutral-900 p-6 flex flex-col justify-between shadow-2xs">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={16} className="text-amber-600" />
            <h3 className="text-[15px] font-semibold text-[hsl(var(--foreground))]">Needs attention</h3>
          </div>

          <div className="space-y-3">
            {data.needsAttention.decliningChannel ? (
              <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 text-xs flex items-center justify-between">
                <div>
                  <strong className="font-semibold text-amber-900 dark:text-amber-200">
                    Channel: {data.needsAttention.decliningChannel.name}
                  </strong>
                  <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5">
                    {data.needsAttention.decliningChannel.summary}
                  </p>
                </div>
                <Link
                  href={data.needsAttention.decliningChannel.link}
                  className="inline-flex items-center gap-1 font-semibold text-amber-900 dark:text-amber-200 underline text-xs shrink-0"
                >
                  <span>Review</span>
                  <ArrowUpRight size={11} />
                </Link>
              </div>
            ) : null}

            {data.needsAttention.lowStockBestSellers.length > 0 ? (
              <div className="p-3.5 rounded-xl border border-rose-200 bg-rose-50/50 dark:bg-rose-950/20 text-xs space-y-1">
                <strong className="font-semibold text-rose-900 dark:text-rose-200">
                  Best sellers running low on stock:
                </strong>
                <div className="flex flex-wrap gap-2 pt-1">
                  {data.needsAttention.lowStockBestSellers.map((item) => (
                    <Link
                      key={item.id}
                      href={item.link}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white dark:bg-neutral-900 text-rose-800 dark:text-rose-300 font-medium text-[11px] border border-rose-200"
                    >
                      <span>{item.name} ({item.stock} left)</span>
                      <ArrowUpRight size={10} />
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}

            {data.needsAttention.overdueOrders.length > 0 ? (
              <div className="p-3.5 rounded-xl border border-neutral-200 bg-neutral-50 dark:bg-neutral-800/40 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <strong className="font-semibold text-[hsl(var(--foreground))]">
                    Overdue unpaid orders ({data.needsAttention.overdueOrders.length}):
                  </strong>
                  <Link href="/orders" className="text-[11px] font-semibold underline text-neutral-800 dark:text-neutral-200">
                    All orders
                  </Link>
                </div>
                <div className="space-y-1 pt-1">
                  {data.needsAttention.overdueOrders.slice(0, 2).map((o) => (
                    <div key={o.id} className="flex items-center justify-between text-[11px]">
                      <span className="text-[hsl(var(--muted-foreground))]">{o.customerName} · {o.daysAgo}d ago</span>
                      <span className="font-semibold text-rose-600">{money(o.balanceDue)} due</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {!data.needsAttention.decliningChannel &&
              data.needsAttention.lowStockBestSellers.length === 0 &&
              data.needsAttention.overdueOrders.length === 0 && (
                <div className="p-6 text-center text-xs text-[hsl(var(--muted-foreground))]">
                  Everything looks healthy. No overdue balances or stock bottlenecks.
                </div>
              )}
          </div>
        </div>
      </div>

      {/* ── Gainers & Decliners Lists ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-[12px] border border-[hsl(var(--card-border))] bg-white dark:bg-neutral-900 p-6 shadow-2xs">
          <h3 className="text-[15px] font-semibold text-[hsl(var(--foreground))] mb-3">Gainers</h3>
          {data.gainers.length === 0 ? (
            <p className="text-xs text-[hsl(var(--muted-foreground))] py-4 text-center">No gaining channels or products.</p>
          ) : (
            <div className="space-y-2">
              {data.gainers.map((item) => (
                <div key={item.name} className="flex items-center justify-between p-2 rounded-lg bg-[hsl(var(--muted))]/40 text-xs">
                  <div>
                    <span className="font-medium text-[hsl(var(--foreground))]">{item.name}</span>
                    <span className="text-[11px] text-[hsl(var(--muted-foreground))] ml-2 uppercase">({item.type})</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold">{money(item.current)}</span>
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700">
                      {item.changePercent !== null ? `+${item.changePercent}%` : "New"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-[12px] border border-[hsl(var(--card-border))] bg-white dark:bg-neutral-900 p-6 shadow-2xs">
          <h3 className="text-[15px] font-semibold text-[hsl(var(--foreground))] mb-3">Decliners</h3>
          {data.decliners.length === 0 ? (
            <p className="text-xs text-[hsl(var(--muted-foreground))] py-4 text-center">No declining channels or products.</p>
          ) : (
            <div className="space-y-2">
              {data.decliners.map((item) => (
                <div key={item.name} className="flex items-center justify-between p-2 rounded-lg bg-[hsl(var(--muted))]/40 text-xs">
                  <div>
                    <span className="font-medium text-[hsl(var(--foreground))]">{item.name}</span>
                    <span className="text-[11px] text-[hsl(var(--muted-foreground))] ml-2 uppercase">({item.type})</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold">{money(item.current)}</span>
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-700">
                      {item.changePercent}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Deterministic Insight Template Bullets ── */}
      <div className="rounded-[12px] border border-[hsl(var(--card-border))] bg-white dark:bg-neutral-900 p-6 shadow-2xs">
        <div className="flex items-center gap-2 mb-3">
          <HelpCircle size={15} className="text-neutral-500" />
          <h3 className="text-[15px] font-semibold text-[hsl(var(--foreground))]">Performance Summary & Observations</h3>
        </div>
        <ul className="space-y-2 text-xs text-[hsl(var(--foreground))]">
          {data.insights.map((ins, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-neutral-900 dark:bg-white mt-1.5 shrink-0" />
              <span>{ins}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
