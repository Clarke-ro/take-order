import { Router, type IRouter } from "express";
import type { RequestHandler } from "express";
import type { db } from "@workspace/db";
import healthRouter from "./health";
import { createTakeOrderRouter } from "./take-order";
import { createSettingsRouter } from "./settings";
import { createCurrencyHintRouter } from "./currency-hint";

export function createRouter(database: typeof db, requireSellerAuth: RequestHandler): IRouter {
  const router: IRouter = Router();

  router.use(healthRouter);
  router.use(createTakeOrderRouter(database, requireSellerAuth));
  router.use(createSettingsRouter(database, requireSellerAuth));
  router.use(createCurrencyHintRouter(database, requireSellerAuth));

  return router;
}
