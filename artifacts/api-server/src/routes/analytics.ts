import { Router, type IRouter, type RequestHandler, type Response } from "express";
import { desc, eq } from "drizzle-orm";
import {
  expensesTable,
  ordersTable,
  productsTable,
  sellerSettingsTable,
} from "@workspace/db/schema";
import type { db } from "@workspace/db";
import { GetDashboardSummaryResponse } from "@workspace/api-zod";
import {
  calculateDashboardSummary,
  type DashboardRange,
} from "../lib/dashboard-analytics";
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

  return router;
}
