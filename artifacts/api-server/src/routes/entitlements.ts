import { Router, type IRouter, type RequestHandler, type Response } from "express";
import type { db } from "@workspace/db";
import { resolveSellerEntitlement } from "../lib/entitlements.js";

function sellerId(res: Response): string {
  const user = res.locals.ownerUserId || res.locals.auth?.userId;
  if (!user) throw new Error("Missing seller identity");
  return user;
}

export function createEntitlementsRouter(database: typeof db, requireSellerAuth: RequestHandler): IRouter {
  const router: IRouter = Router();

  router.get("/entitlements", requireSellerAuth, async (_req, res): Promise<void> => {
    const ownerUserId = sellerId(res);
    const entitlement = await resolveSellerEntitlement(database, ownerUserId);
    res.json(entitlement);
  });

  return router;
}
