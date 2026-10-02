import { Router, type IRouter, type RequestHandler, type Response } from "express";
import type { db } from "@workspace/db";
import { resolveSellerEntitlement, startSellerTrial } from "../lib/entitlements.js";

function sellerId(res: Response): string {
  const user = (res.locals.ownerUserId as string) || (res.locals.userId as string) || res.locals.auth?.userId;
  if (!user) throw new Error("Missing seller identity");
  return user;
}

export function createEntitlementsRouter(database: typeof db, requireSellerAuth: RequestHandler): IRouter {
  const router: IRouter = Router();

  const handleGetEntitlements = async (_req: any, res: Response): Promise<void> => {
    const ownerUserId = sellerId(res);
    const entitlement = await resolveSellerEntitlement(database, ownerUserId);
    res.json(entitlement);
  };

  const handleStartTrial = async (_req: any, res: Response): Promise<void> => {
    const ownerUserId = sellerId(res);
    const entitlement = await startSellerTrial(database, ownerUserId);
    res.json(entitlement);
  };

  router.get("/entitlements", requireSellerAuth, handleGetEntitlements);
  router.get("/subscription/entitlements", requireSellerAuth, handleGetEntitlements);

  router.post("/entitlements/start-trial", requireSellerAuth, handleStartTrial);
  router.post("/subscription/start-trial", requireSellerAuth, handleStartTrial);

  return router;
}
