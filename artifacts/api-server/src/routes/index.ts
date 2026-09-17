import { Router, type IRouter } from "express";
import type { db } from "@workspace/db";
import healthRouter from "./health";
import { createTakeOrderRouter } from "./take-order";

export function createRouter(database: typeof db): IRouter {
  const router: IRouter = Router();

  router.use(healthRouter);
  router.use(createTakeOrderRouter(database));

  return router;
}
