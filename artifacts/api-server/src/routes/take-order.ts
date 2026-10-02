import { Router, type IRouter, type RequestHandler } from "express";
import type { db } from "@workspace/db";
import { createProductsRouter, isReusableCatalogProduct, preferencesForProduct, productResponse } from "./products";
import { createExpensesRouter, expenseResponse } from "./expenses";
import { createOrdersRouter, orderResponse } from "./orders";
import { createCheckoutRouter, publicOrderResponse, publicItemsForOrder } from "./checkout";
import { createAnalyticsRouter } from "./analytics";
import { createEntitlementsRouter } from "./entitlements";

export {
  isReusableCatalogProduct,
  preferencesForProduct,
  productResponse,
  orderResponse,
  expenseResponse,
  publicOrderResponse,
  publicItemsForOrder,
};

/**
 * Composite Take Order router combining modular domain sub-routers:
 * - Products: catalog management, preferences, variants
 * - Expenses: operating expenses tracking
 * - Orders: seller orders management and stock adjustments
 * - Checkout: public buyer order links and checkout submission
 * - Analytics: dashboard summaries and CSV export
 * - Entitlements: seller quotas and plan limits
 */
export function createTakeOrderRouter(database: typeof db, requireSellerAuth: RequestHandler): IRouter {
  const router: IRouter = Router();

  router.use(createProductsRouter(database, requireSellerAuth));
  router.use(createExpensesRouter(database, requireSellerAuth));
  router.use(createOrdersRouter(database, requireSellerAuth));
  router.use(createCheckoutRouter(database));
  router.use(createAnalyticsRouter(database, requireSellerAuth));
  router.use(createEntitlementsRouter(database, requireSellerAuth));

  return router;
}
