import React, { useMemo, useState } from "react";
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
  Line,
  ComposedChart,
  Legend,
} from "recharts";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { SegmentedControl } from "@/components/segmented-control";
import { Skeleton } from "@/components/ui/skeleton";
import { money, moneyExact } from "@/lib/formatters";
import { CHANNEL_COLORS, type MetricOrder, type MetricProduct, type MetricExpense } from "@/lib/metrics";

export interface GeneralPerformanceChartsProps {
  orders: MetricOrder[];
  products: MetricProduct[];
  expenses: MetricExpense[];
  timeChartData: Array<{
    date: string;
    label: string;
    revenue: number;
    orders: number;
    productCosts?: number;
    operatingExpenses?: number;
  }>;
  sellerTimezone: string;
  donutData: Array<{
    name: string;
    value: number;
    orders: number;
    color: string;
  }>;
  donutTotal: number;
  channelExpenseView: "channel" | "expenses";
  onChannelExpenseViewChange: (view: "channel" | "expenses") => void;
  isLoading?: boolean;
}

export function GeneralPerformanceCharts({
  orders,
  products,
  expenses,
  timeChartData,
  sellerTimezone,
  donutData,
  donutTotal,
  channelExpenseView,
  onChannelExpenseViewChange,
  isLoading = false,
}: GeneralPerformanceChartsProps) {
  const [timeChartView, setTimeChartView] = useState<"revenue" | "orders">("revenue");

  // Product map for COGS
  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  // Combined Revenue vs Expenses chart data
  const revVsExpData = useMemo(() => {
    return timeChartData.map((d) => {
      const dayExpenses = expenses
        .filter((e) => (e.expenseDate || e.date) === d.date)
        .reduce((sum, e) => sum + Number(e.amount || 0), 0);

      const dayPaidOrders = orders.filter((o) => {
        const oDate = typeof o.createdAt === "string" ? o.createdAt.slice(0, 10) : new Date(o.createdAt).toISOString().slice(0, 10);
        return oDate === d.date && (o.status === "paid" || o.status === "deposit_paid");
      });

      const dayCogs = dayPaidOrders.reduce((sum, o) => {
        const prod = productMap.get(o.productId);
        const cost = o.productCost != null ? Number(o.productCost) : prod?.cost != null ? Number(prod.cost) : 0;
        return sum + cost;
      }, 0);

      const totalCost = dayCogs + dayExpenses;

      return {
        date: d.date,
        label: d.label,
        revenue: d.revenue,
        expenses: totalCost,
        profit: d.revenue - totalCost,
      };
    });
  }, [timeChartData, expenses, orders, productMap]);

  // Orders by Fulfillment Status (Horizontal Bars)
  const fulfillmentData = useMemo(() => {
    const validOrders = orders.filter((o) => o.status !== "reserved" && o.status !== "cancelled");
    const counts: Record<string, number> = {
      delivered: 0,
      shipped: 0,
      processing: 0,
      pending: 0,
      cancelled: 0,
    };

    orders.forEach((o) => {
      const f = (o.fulfillment || (o.status === "cancelled" ? "cancelled" : "pending")).toLowerCase();
      if (f in counts) counts[f]++;
      else counts.pending++;
    });

    const total = validOrders.length || 1;
    const items = [
      { status: "Delivered", count: counts.delivered, color: "#10B981" },
      { status: "Shipped", count: counts.shipped, color: "#6366F1" },
      { status: "Processing", count: counts.processing, color: "#F59E0B" },
      { status: "Pending", count: counts.pending, color: "#94A3B8" },
      { status: "Cancelled", count: counts.cancelled, color: "#EF4444" },
    ];

    return items.map((it) => ({
      ...it,
      percentage: Math.round((it.count / total) * 100),
    }));
  }, [orders]);

  // Sales by Weekday (Mon - Sun)
  const weekdayData = useMemo(() => {
    const days = [
      { key: "Mon", label: "Mon", revenue: 0, orders: 0 },
      { key: "Tue", label: "Tue", revenue: 0, orders: 0 },
      { key: "Wed", label: "Wed", revenue: 0, orders: 0 },
      { key: "Thu", label: "Thu", revenue: 0, orders: 0 },
      { key: "Fri", label: "Fri", revenue: 0, orders: 0 },
      { key: "Sat", label: "Sat", revenue: 0, orders: 0 },
      { key: "Sun", label: "Sun", revenue: 0, orders: 0 },
    ];

    const dayIndexMap: Record<number, number> = {
      1: 0, // Mon
      2: 1, // Tue
      3: 2, // Wed
      4: 3, // Thu
      5: 4, // Fri
      6: 5, // Sat
      0: 6, // Sun
    };

    orders.forEach((o) => {
      if (o.status !== "paid" && o.status !== "deposit_paid") return;
      const d = new Date(o.createdAt);
      const dayIdx = dayIndexMap[d.getUTCDay()];
      if (dayIdx !== undefined) {
        const rev = o.status === "deposit_paid" ? Number(o.depositAmount || 0) : Number(o.amount || 0);
        days[dayIdx].revenue += rev;
        days[dayIdx].orders += 1;
      }
    });

    return days;
  }, [orders]);

  // Top Products (Ranked horizontal list / bars)
  const topProductsData = useMemo(() => {
    const map = new Map<string, { id: number; name: string; revenue: number; orders: number }>();
    orders.forEach((o) => {
      if (o.status !== "paid" && o.status !== "deposit_paid") return;
      const name = o.productName || `Product #${o.productId}`;
      const ex = map.get(name) || { id: o.productId, name, revenue: 0, orders: 0 };
      const rev = o.status === "deposit_paid" ? Number(o.depositAmount || 0) : Number(o.amount || 0);
      ex.revenue += rev;
      ex.orders += 1;
      map.set(name, ex);
    });

    const list = Array.from(map.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
    const maxRev = list[0]?.revenue || 1;
    return list.map((p) => ({
      ...p,
      relativeWidth: Math.max(8, Math.round((p.revenue / maxRev) * 100)),
    }));
  }, [orders]);

  return (
    <section aria-label="General Performance Insights" className="space-y-6">
      <div className="pt-2">
        <h2 className="text-lg font-bold text-[hsl(var(--foreground))] tracking-tight">
          Performance overview
        </h2>
        <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
          Core distribution charts, fulfillment pipeline status, and weekly selling patterns.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* ── Card 1: Breakdown Donut (Fixed fitting labels & tokens) ── */}
        <div className="rounded-[12px] border border-[hsl(var(--card-border))] bg-white dark:bg-neutral-900 p-6 flex flex-col justify-between shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[15px] font-semibold text-[hsl(var(--foreground))]">Breakdown</h3>
            <SegmentedControl<"channel" | "expenses">
              size="sm"
              value={channelExpenseView}
              onChange={onChannelExpenseViewChange}
              options={[
                { value: "channel", label: "Channel" },
                { value: "expenses", label: "Expenses" },
              ]}
            />
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center h-52">
              <Skeleton className="h-44 w-44 rounded-full" />
            </div>
          ) : donutData.length === 0 || donutTotal === 0 ? (
            <div className="flex flex-col items-center justify-center h-52 text-[hsl(var(--muted-foreground))] text-center gap-2">
              <Info size={24} />
              <p className="text-xs">
                {channelExpenseView === "channel" ? "No sales in this period" : "No expenses logged"}
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-center">
                <PieChart width={200} height={180}>
                  <Pie
                    data={donutData}
                    cx={100}
                    cy={90}
                    innerRadius={54}
                    outerRadius={82}
                    paddingAngle={3}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {donutData.map((entry, idx) => (
                      <Cell key={`cell-${idx}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <text x={100} y={84} textAnchor="middle" fill="#6B7280" fontSize={11}>
                    {channelExpenseView === "channel" ? "Revenue" : "Expenses"}
                  </text>
                  <text x={100} y={105} textAnchor="middle" fill="#111111" fontSize={13} fontWeight={700}>
                    {moneyExact(donutTotal)}
                  </text>
                </PieChart>
              </div>

              <div className="mt-4 space-y-2 max-h-44 overflow-y-auto scrollbar-thin">
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
                          <span className="text-[hsl(var(--muted-foreground))]">
                            {item.orders} order{item.orders === 1 ? "" : "s"}
                          </span>
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

        {/* ── Card 2: Performance Over Time (Fixed maxBarSize & zero-filled days) ── */}
        <div className="rounded-[12px] border border-[hsl(var(--card-border))] bg-white dark:bg-neutral-900 p-6 flex flex-col justify-between shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 min-w-0">
              <h3 className="text-[15px] font-semibold text-[hsl(var(--foreground))] truncate">Performance Over Time</h3>
              <span className="text-[11px] text-[hsl(var(--muted-foreground))] hidden sm:inline">({sellerTimezone})</span>
            </div>
            <SegmentedControl<"revenue" | "orders">
              size="sm"
              value={timeChartView}
              onChange={setTimeChartView}
              options={[
                { value: "revenue", label: "Revenue" },
                { value: "orders", label: "Orders" },
              ]}
            />
          </div>

          {isLoading ? (
            <Skeleton className="h-56 w-full rounded-xl" />
          ) : timeChartData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-56 text-[hsl(var(--muted-foreground))] text-center gap-2">
              <Info size={24} />
              <p className="text-xs">No activity in this period</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={230}>
              <BarChart
                data={timeChartData}
                margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
                maxBarSize={28}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(200,200,200,0.2)" />
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
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-3 shadow-xl text-xs text-white">
                        <div className="font-semibold text-neutral-300 mb-1">{label}</div>
                        <div className="font-bold text-white">
                          Revenue: {money(payload[0]?.payload?.revenue || 0)}
                        </div>
                        <div className="text-neutral-400 mt-0.5">
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
                  name={timeChartView === "revenue" ? "Revenue" : "Orders"}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* ── Card 3: Revenue vs Expenses (Combined Line/Bar Chart) ── */}
        <div className="rounded-[12px] border border-[hsl(var(--card-border))] bg-white dark:bg-neutral-900 p-6 flex flex-col justify-between shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-[15px] font-semibold text-[hsl(var(--foreground))]">Revenue vs Expenses</h3>
              <p className="text-[11px] text-[hsl(var(--muted-foreground))]">Realized cash vs COGS and OpEx</p>
            </div>
          </div>

          {isLoading ? (
            <Skeleton className="h-56 w-full rounded-xl" />
          ) : revVsExpData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-56 text-[hsl(var(--muted-foreground))] text-center gap-2">
              <Info size={24} />
              <p className="text-xs">No financial records in this period</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={230}>
              <ComposedChart
                data={revVsExpData}
                margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
                maxBarSize={24}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(200,200,200,0.2)" />
                <XAxis
                  dataKey="label"
                  stroke="#a1a1aa"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  interval={revVsExpData.length > 14 ? Math.floor(revVsExpData.length / 7) : 0}
                />
                <YAxis
                  stroke="#a1a1aa"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-3 shadow-xl text-xs text-white">
                        <div className="font-semibold text-neutral-300 mb-1">{label}</div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-emerald-400">Revenue:</span>
                          <span className="font-bold">{money(payload[0]?.payload?.revenue || 0)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4 mt-1">
                          <span className="text-rose-400">Expenses:</span>
                          <span className="font-bold">{money(payload[0]?.payload?.expenses || 0)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4 mt-1 pt-1 border-t border-neutral-800">
                          <span className="text-neutral-300">Net Profit:</span>
                          <span className="font-bold text-white">{money(payload[0]?.payload?.profit || 0)}</span>
                        </div>
                      </div>
                    );
                  }}
                />
                <Legend
                  verticalAlign="top"
                  align="right"
                  iconSize={8}
                  wrapperStyle={{ fontSize: 11, paddingBottom: 8 }}
                />
                <Bar dataKey="revenue" name="Revenue" fill="#10B981" radius={[3, 3, 0, 0]} />
                <Bar dataKey="expenses" name="Expenses" fill="#F43F5E" radius={[3, 3, 0, 0]} />
                <Line type="monotone" dataKey="profit" name="Net Profit" stroke="#111111" strokeWidth={2} dot={{ r: 2 }} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* ── Card 4: Orders by Fulfillment Status (Horizontal Bars) ── */}
        <div className="rounded-[12px] border border-[hsl(var(--card-border))] bg-white dark:bg-neutral-900 p-6 flex flex-col justify-between shadow-2xs">
          <div className="mb-4">
            <h3 className="text-[15px] font-semibold text-[hsl(var(--foreground))]">Fulfillment Status</h3>
            <p className="text-[11px] text-[hsl(var(--muted-foreground))]">Order processing pipeline distribution</p>
          </div>

          {isLoading ? (
            <Skeleton className="h-56 w-full rounded-xl" />
          ) : (
            <div className="space-y-3.5 my-auto">
              {fulfillmentData.map((item) => (
                <div key={item.status} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-[hsl(var(--foreground))]">{item.status}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[hsl(var(--foreground))]">{item.count}</span>
                      <span className="text-[hsl(var(--muted-foreground))] w-8 text-right">{item.percentage}%</span>
                    </div>
                  </div>
                  <div className="h-2 w-full rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.max(item.count > 0 ? 5 : 0, item.percentage)}%`,
                        backgroundColor: item.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Card 5: Sales by Weekday (Mon–Sun) ── */}
        <div className="rounded-[12px] border border-[hsl(var(--card-border))] bg-white dark:bg-neutral-900 p-6 flex flex-col justify-between shadow-2xs">
          <div className="mb-4">
            <h3 className="text-[15px] font-semibold text-[hsl(var(--foreground))]">Sales by Weekday</h3>
            <p className="text-[11px] text-[hsl(var(--muted-foreground))]">Order concentration across days of week</p>
          </div>

          {isLoading ? (
            <Skeleton className="h-56 w-full rounded-xl" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={weekdayData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }} maxBarSize={24}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(200,200,200,0.2)" />
                <XAxis dataKey="label" stroke="#a1a1aa" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#a1a1aa" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-3 shadow-xl text-xs text-white">
                        <div className="font-semibold text-neutral-300 mb-1">{label}</div>
                        <div className="font-bold">Revenue: {money(payload[0]?.payload?.revenue || 0)}</div>
                        <div className="text-neutral-400 mt-0.5">Orders: {payload[0]?.payload?.orders || 0}</div>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="revenue" name="Revenue" fill="#6366F1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* ── Card 6: Top Products (Ranked horizontal bars) ── */}
        <div className="rounded-[12px] border border-[hsl(var(--card-border))] bg-white dark:bg-neutral-900 p-6 flex flex-col justify-between shadow-2xs">
          <div className="mb-4">
            <h3 className="text-[15px] font-semibold text-[hsl(var(--foreground))]">Top Selling Products</h3>
            <p className="text-[11px] text-[hsl(var(--muted-foreground))]">Ranked merchandise performance by collected revenue</p>
          </div>

          {isLoading ? (
            <Skeleton className="h-56 w-full rounded-xl" />
          ) : topProductsData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-52 text-[hsl(var(--muted-foreground))] text-center gap-2">
              <Info size={24} />
              <p className="text-xs">No sales recorded yet</p>
            </div>
          ) : (
            <div className="space-y-3.5 my-auto">
              {topProductsData.map((item, idx) => (
                <div key={item.name} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-bold text-[11px] text-neutral-400 w-4">#{idx + 1}</span>
                      <span className="text-[hsl(var(--foreground))] font-medium truncate max-w-[160px] sm:max-w-[200px]">
                        {item.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[hsl(var(--muted-foreground))]">{item.orders} sold</span>
                      <span className="font-semibold text-[hsl(var(--foreground))]">{money(item.revenue)}</span>
                    </div>
                  </div>
                  <div className="h-2 w-full rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-neutral-900 dark:bg-white transition-all duration-300"
                      style={{ width: `${item.relativeWidth}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
