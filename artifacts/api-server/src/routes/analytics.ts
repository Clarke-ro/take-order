import { Router, type IRouter, type RequestHandler, type Response } from "express";
import { and, desc, eq } from "drizzle-orm";
import {
  expensesTable,
  ordersTable,
  productsTable,
  sellerSettingsTable,
  reportFavoritesTable,
} from "@workspace/db/schema";
import type { db } from "@workspace/db";
import { GetDashboardSummaryResponse, getReportConfig, canAccessReport } from "@workspace/api-zod";
import {
  calculateDashboardSummary,
  type DashboardRange,
} from "../lib/dashboard-analytics";
import {
  computeFairComparisonRange,
  computePeriodComparison,
  generateReportDetailData,
  getLocalDateString,
} from "../lib/report-analytics.js";
import { resolveSellerEntitlement } from "../lib/entitlements.js";
import { isReusableCatalogProduct } from "./products";

function sellerId(res: Response): string {
  const user = (res.locals.ownerUserId as string) || (res.locals.userId as string) || res.locals.auth?.userId;
  if (!user) throw new Error("Missing seller identity");
  return user;
}

export function createAnalyticsRouter(database: typeof db, requireSellerAuth: RequestHandler): IRouter {
  const router: IRouter = Router();

  router.get("/dashboard/summary", requireSellerAuth, async (req, res): Promise<void> => {
    const parseDateQuery = (value: unknown): string | undefined => {
      if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
      const parsed = new Date(`${value}T00:00:00.000Z`);
      return Number.isNaN(parsed.getTime()) ? undefined : value;
    };
    const rawFrom = req.query.from;
    const rawTo = req.query.to;
    const from = parseDateQuery(rawFrom);
    const to = parseDateQuery(rawTo);
    if ((rawFrom !== undefined && from === undefined) || (rawTo !== undefined && to === undefined)) {
      res.status(400).json({ message: "Dashboard dates must use YYYY-MM-DD." });
      return;
    }
    const currentOwnerUserId = sellerId(res);
    const [orders, expenses, products, sellerSettingsRows] = await Promise.all([
      database.select().from(ordersTable)
        .where(eq(ordersTable.ownerUserId, currentOwnerUserId))
        .orderBy(desc(ordersTable.createdAt)),
      database.select().from(expensesTable)
        .where(eq(expensesTable.ownerUserId, currentOwnerUserId))
        .orderBy(desc(expensesTable.expenseDate), desc(expensesTable.id)),
      database.select().from(productsTable)
        .where(eq(productsTable.ownerUserId, currentOwnerUserId))
        .orderBy(productsTable.id),
      database.select().from(sellerSettingsTable)
        .where(eq(sellerSettingsTable.ownerUserId, currentOwnerUserId))
        .limit(1),
    ]);
    const sellerSettings = sellerSettingsRows[0]?.settings as Record<string, unknown> | undefined;
    const timezone = typeof sellerSettings?.timezone === "string" ? sellerSettings.timezone : "Africa/Accra";
    const range: DashboardRange | undefined = from || to ? { from, to } : undefined;
    const summary = calculateDashboardSummary(products, orders, expenses, new Date(), range, timezone);
    res.json(GetDashboardSummaryResponse.parse(summary));
  });

  router.get("/dashboard/export", requireSellerAuth, async (req, res): Promise<void> => {
    const ownerUserId = sellerId(res);
    const entitlement = await resolveSellerEntitlement(database, ownerUserId);
    if (!entitlement.capabilities.canExportAnalytics) {
      res.status(403).json({
        error: "Analytics export requires Pro",
        code: "PRO_FEATURE_REQUIRED",
        tier: entitlement.tier,
        message: "Upgrade to Pro to export your sales and analytics data.",
      });
      return;
    }
    const parseDateQuery = (value: unknown): string | undefined => {
      if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
      const parsed = new Date(`${value}T00:00:00.000Z`);
      return Number.isNaN(parsed.getTime()) ? undefined : value;
    };
    const from = parseDateQuery(req.query.from);
    const to = parseDateQuery(req.query.to);
    const range: DashboardRange | undefined = from || to ? { from, to } : undefined;

    const [orders, expenses, products, sellerSettingsRows] = await Promise.all([
      database.select().from(ordersTable)
        .where(eq(ordersTable.ownerUserId, ownerUserId))
        .orderBy(desc(ordersTable.createdAt)),
      database.select().from(expensesTable)
        .where(eq(expensesTable.ownerUserId, ownerUserId))
        .orderBy(desc(expensesTable.expenseDate), desc(expensesTable.id)),
      database.select().from(productsTable)
        .where(eq(productsTable.ownerUserId, ownerUserId))
        .orderBy(productsTable.id),
      database.select().from(sellerSettingsTable)
        .where(eq(sellerSettingsTable.ownerUserId, ownerUserId))
        .limit(1),
    ]);
    const sellerSettings = sellerSettingsRows[0]?.settings as Record<string, unknown> | undefined;
    const timezone = typeof sellerSettings?.timezone === "string" ? sellerSettings.timezone : "Africa/Accra";
    const summary = calculateDashboardSummary(products, orders, expenses, new Date(), range, timezone);

    const sanitizeCell = (val: unknown): string => {
      if (val == null) return '""';
      let str = String(val).trim();
      if (/^[=+\-@]/.test(str)) {
        str = `'${str}`;
      }
      return `"${str.replace(/"/g, '""')}"`;
    };

    // Columns: Date, Orders, Order value, Revenue collected, Outstanding, Product costs, Operating expenses, Net profit
    const headers = [
      "Date",
      "Orders",
      "Order value",
      "Revenue collected",
      "Outstanding",
      "Product costs",
      "Operating expenses",
      "Net profit",
    ];

    const rows = summary.dailyPerformance.map((d) => [
      sanitizeCell(d.date),
      sanitizeCell(d.orders),
      sanitizeCell(d.revenue.toFixed(2)), // Day revenue
      sanitizeCell(d.revenue.toFixed(2)),
      sanitizeCell("0.00"),
      sanitizeCell(d.productCosts.toFixed(2)),
      sanitizeCell(d.operatingExpenses.toFixed(2)),
      sanitizeCell(d.profit.toFixed(2)),
    ]);

    // Append summary totals row
    rows.push([
      sanitizeCell("TOTAL"),
      sanitizeCell(summary.orders),
      sanitizeCell((summary.orderValue ?? summary.revenue).toFixed(2)),
      sanitizeCell(summary.revenue.toFixed(2)),
      sanitizeCell(summary.outstanding.toFixed(2)),
      sanitizeCell(summary.productCosts.toFixed(2)),
      sanitizeCell(summary.operatingExpenses.toFixed(2)),
      sanitizeCell(summary.profit.toFixed(2)),
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="take-order-analytics.csv"');
    res.send(csvContent);
  });

  router.get("/reports/summary", requireSellerAuth, async (_req, res): Promise<void> => {
    const ownerUserId = sellerId(res);
    const entitlement = await resolveSellerEntitlement(database, ownerUserId);
    if (!entitlement.capabilities.canAccessReports) {
      res.status(403).json({
        error: "Reports require Pro",
        code: "PRO_FEATURE_REQUIRED",
        tier: entitlement.tier,
        message: "Business reports and profitability analytics require Pro or Pro+.",
      });
      return;
    }
    const [products, orders, operatingExpenseRows] = await Promise.all([
      database.select().from(productsTable).where(eq(productsTable.ownerUserId, ownerUserId)),
      database.select().from(ordersTable).where(eq(ordersTable.ownerUserId, ownerUserId)),
      database.select().from(expensesTable).where(eq(expensesTable.ownerUserId, ownerUserId)),
    ]);
    res.json(
      GetDashboardSummaryResponse.parse(
        calculateDashboardSummary(products.filter(isReusableCatalogProduct), orders, operatingExpenseRows, new Date()),
      ),
    );
  });

  // ── Favorites Endpoints ──
  router.get("/analytics/favorites", requireSellerAuth, async (_req, res): Promise<void> => {
    const currentOwnerUserId = sellerId(res);
    const rows = await database
      .select({ reportSlug: reportFavoritesTable.reportSlug })
      .from(reportFavoritesTable)
      .where(eq(reportFavoritesTable.ownerUserId, currentOwnerUserId));
    res.json({ favorites: rows.map((r) => r.reportSlug) });
  });

  router.post("/analytics/favorites/:slug/toggle", requireSellerAuth, async (req, res): Promise<void> => {
    const currentOwnerUserId = sellerId(res);
    const slug = Array.isArray(req.params.slug) ? req.params.slug[0] : String(req.params.slug);
    const existing = await database
      .select()
      .from(reportFavoritesTable)
      .where(
        and(
          eq(reportFavoritesTable.ownerUserId, currentOwnerUserId),
          eq(reportFavoritesTable.reportSlug, slug)
        )
      )
      .limit(1);

    let favorited = false;
    if (existing.length > 0) {
      await database
        .delete(reportFavoritesTable)
        .where(
          and(
            eq(reportFavoritesTable.ownerUserId, currentOwnerUserId),
            eq(reportFavoritesTable.reportSlug, slug)
          )
        );
      favorited = false;
    } else {
      await database.insert(reportFavoritesTable).values({
        ownerUserId: currentOwnerUserId,
        reportSlug: slug,
      });
      favorited = true;
    }

    const allRows = await database
      .select({ reportSlug: reportFavoritesTable.reportSlug })
      .from(reportFavoritesTable)
      .where(eq(reportFavoritesTable.ownerUserId, currentOwnerUserId));

    res.json({ favorited, favorites: allRows.map((r) => r.reportSlug) });
  });

  // ── Period Comparison Analytics ──
  router.get("/analytics/comparison", requireSellerAuth, async (req, res): Promise<void> => {
    const parseDateQuery = (value: unknown): string | undefined => {
      if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
      const parsed = new Date(`${value}T00:00:00.000Z`);
      return Number.isNaN(parsed.getTime()) ? undefined : value;
    };

    const from = parseDateQuery(req.query.from);
    const to = parseDateQuery(req.query.to);
    let compareFrom = parseDateQuery(req.query.compareFrom);
    let compareTo = parseDateQuery(req.query.compareTo);

    const currentOwnerUserId = sellerId(res);
    const [orders, expenses, products, sellerSettingsRows] = await Promise.all([
      database.select().from(ordersTable).where(eq(ordersTable.ownerUserId, currentOwnerUserId)),
      database.select().from(expensesTable).where(eq(expensesTable.ownerUserId, currentOwnerUserId)),
      database.select().from(productsTable).where(eq(productsTable.ownerUserId, currentOwnerUserId)),
      database.select().from(sellerSettingsTable).where(eq(sellerSettingsTable.ownerUserId, currentOwnerUserId)).limit(1),
    ]);

    const sellerSettings = sellerSettingsRows[0]?.settings as Record<string, unknown> | undefined;
    const timezone = typeof sellerSettings?.timezone === "string" ? sellerSettings.timezone : "Africa/Accra";

    const todayStr = getLocalDateString(new Date(), timezone);
    const effectiveTo = to || todayStr;
    const [y, m] = effectiveTo.split("-").map(Number);
    const effectiveFrom = from || `${y}-${String(m).padStart(2, "0")}-01`;

    let isFairMtd = false;
    if (!compareFrom || !compareTo) {
      const computed = computeFairComparisonRange(effectiveFrom, effectiveTo, "previous_period", new Date(), timezone);
      compareFrom = computed.compareFrom;
      compareTo = computed.compareTo;
      isFairMtd = computed.isFairMtd;
    }

    const comparisonResult = computePeriodComparison(
      products,
      orders,
      expenses,
      effectiveFrom,
      effectiveTo,
      compareFrom,
      compareTo,
      new Date(),
      timezone,
      isFairMtd
    );

    res.json(comparisonResult);
  });

  // ── Report Insight Detail ──
  router.get("/analytics/reports/:slug", requireSellerAuth, async (req, res): Promise<void> => {
    const slug = Array.isArray(req.params.slug) ? req.params.slug[0] : String(req.params.slug);
    const config = getReportConfig(slug);
    if (!config) {
      res.status(404).json({ error: "Report not found", message: `Unknown report slug: ${slug}` });
      return;
    }

    const currentOwnerUserId = sellerId(res);
    const entitlement = await resolveSellerEntitlement(database, currentOwnerUserId);

    // Plan Gating Check (Server Enforced)
    if (!canAccessReport(entitlement.tier, slug)) {
      // Locked: Return blurred preview shell with Upgrade prompt, NEVER sending real business data
      res.status(403).json({
        error: "Report locked",
        code: "PRO_FEATURE_REQUIRED",
        locked: true,
        planRequired: config.minPlan,
        report: config,
        message: `${config.title} is an advanced report available on Pro and Pro+ plans.`,
        preview: {
          kpis: [
            { id: "kpi_1", label: "Metric Overview", value: "—", description: "Pro analytics metric", delta: 12.5, isNew: false, format: "currency" },
            { id: "kpi_2", label: "Volume Index", value: "—", description: "Pro volume analysis", delta: 8.0, isNew: false, format: "integer" },
          ],
          summaryBullets: [
            "Unlock granular breakdown and historical comparisons.",
            "Gain deeper insight into your customer retention and unit economics.",
          ],
        },
      });
      return;
    }

    const parseDateQuery = (value: unknown): string | undefined => {
      if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
      const parsed = new Date(`${value}T00:00:00.000Z`);
      return Number.isNaN(parsed.getTime()) ? undefined : value;
    };

    const from = parseDateQuery(req.query.from);
    const to = parseDateQuery(req.query.to);
    let compareFrom = parseDateQuery(req.query.compareFrom);
    let compareTo = parseDateQuery(req.query.compareTo);

    const [orders, expenses, products, sellerSettingsRows] = await Promise.all([
      database.select().from(ordersTable).where(eq(ordersTable.ownerUserId, currentOwnerUserId)),
      database.select().from(expensesTable).where(eq(expensesTable.ownerUserId, currentOwnerUserId)),
      database.select().from(productsTable).where(eq(productsTable.ownerUserId, currentOwnerUserId)),
      database.select().from(sellerSettingsTable).where(eq(sellerSettingsTable.ownerUserId, currentOwnerUserId)).limit(1),
    ]);

    const sellerSettings = sellerSettingsRows[0]?.settings as Record<string, unknown> | undefined;
    const timezone = typeof sellerSettings?.timezone === "string" ? sellerSettings.timezone : "Africa/Accra";
    const currency = typeof sellerSettings?.currency === "string" ? sellerSettings.currency : "GH₵";

    const todayStr = getLocalDateString(new Date(), timezone);
    const effectiveTo = to || todayStr;
    const [y, m] = effectiveTo.split("-").map(Number);
    const effectiveFrom = from || `${y}-${String(m).padStart(2, "0")}-01`;

    let isFairMtd = false;
    if (!compareFrom || !compareTo) {
      const computed = computeFairComparisonRange(effectiveFrom, effectiveTo, "previous_period", new Date(), timezone);
      compareFrom = computed.compareFrom;
      compareTo = computed.compareTo;
      isFairMtd = computed.isFairMtd;
    }

    const filters = {
      channel: typeof req.query.channel === "string" ? req.query.channel : undefined,
      category: typeof req.query.category === "string" ? req.query.category : undefined,
      paymentMode: typeof req.query.paymentMode === "string" ? req.query.paymentMode : undefined,
      fulfillment: typeof req.query.fulfillment === "string" ? req.query.fulfillment : undefined,
    };

    const reportData = generateReportDetailData({
      slug,
      products,
      orders,
      expenses,
      from: effectiveFrom,
      to: effectiveTo,
      compareFrom,
      compareTo,
      isFairMtd,
      filters,
      timezone,
      currency,
    });

    res.json(reportData);
  });

  // ── Report CSV Export with Formula Injection Defense ──
  router.get("/analytics/reports/:slug/export", requireSellerAuth, async (req, res): Promise<void> => {
    const slug = Array.isArray(req.params.slug) ? req.params.slug[0] : String(req.params.slug);
    const config = getReportConfig(slug);
    if (!config) {
      res.status(404).json({ error: "Report not found" });
      return;
    }

    const ownerUserId = sellerId(res);
    const entitlement = await resolveSellerEntitlement(database, ownerUserId);
    if (!canAccessReport(entitlement.tier, slug) || !entitlement.capabilities.canExportAnalytics) {
      res.status(403).json({
        error: "Export requires Pro",
        code: "PRO_FEATURE_REQUIRED",
        tier: entitlement.tier,
        message: "Upgrade to Pro to export verified report CSVs.",
      });
      return;
    }

    const parseDateQuery = (value: unknown): string | undefined => {
      if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
      const parsed = new Date(`${value}T00:00:00.000Z`);
      return Number.isNaN(parsed.getTime()) ? undefined : value;
    };
    const from = parseDateQuery(req.query.from);
    const to = parseDateQuery(req.query.to);

    const [orders, expenses, products, sellerSettingsRows] = await Promise.all([
      database.select().from(ordersTable).where(eq(ordersTable.ownerUserId, ownerUserId)),
      database.select().from(expensesTable).where(eq(expensesTable.ownerUserId, ownerUserId)),
      database.select().from(productsTable).where(eq(productsTable.ownerUserId, ownerUserId)),
      database.select().from(sellerSettingsTable).where(eq(sellerSettingsTable.ownerUserId, ownerUserId)).limit(1),
    ]);
    const sellerSettings = sellerSettingsRows[0]?.settings as Record<string, unknown> | undefined;
    const timezone = typeof sellerSettings?.timezone === "string" ? sellerSettings.timezone : "Africa/Accra";
    const currency = typeof sellerSettings?.currency === "string" ? sellerSettings.currency : "GH₵";

    const todayStr = getLocalDateString(new Date(), timezone);
    const effectiveTo = to || todayStr;
    const [y, m] = effectiveTo.split("-").map(Number);
    const effectiveFrom = from || `${y}-${String(m).padStart(2, "0")}-01`;

    const reportData = generateReportDetailData({
      slug,
      products,
      orders,
      expenses,
      from: effectiveFrom,
      to: effectiveTo,
      compareFrom: effectiveFrom,
      compareTo: effectiveTo,
      isFairMtd: false,
      timezone,
      currency,
    });

    const sanitizeCell = (val: unknown): string => {
      if (val == null) return '""';
      let str = String(val).trim();
      if (/^[=+\-@]/.test(str)) {
        str = `'${str}`;
      }
      return `"${str.replace(/"/g, '""')}"`;
    };

    const headers = reportData.dataTable?.headers || ["Date", "Orders", "Revenue"];
    const rows = reportData.dataTable?.rows || reportData.timeSeries?.map((t) => [t.date, t.orders || 0, t.current]) || [];

    const csvContent =
      "\uFEFF" +
      [
        headers.map(sanitizeCell).join(","),
        ...rows.map((r) => r.map(sanitizeCell).join(",")),
      ].join("\r\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="take-order-${slug}.csv"`);
    res.send(csvContent);
  });

  return router;
}
