import crypto from "node:crypto";
import { Router, type IRouter } from "express";
import { invalidateRevenueCatCache } from "../lib/entitlements";
import { logger } from "../lib/logger";

function timingSafeSecretCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf-8");
  const bufB = Buffer.from(b, "utf-8");
  if (bufA.length !== bufB.length) {
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

const WEBHOOK_PATHS = [
  "/",
  "/webhooks/revenuecat",
  "/webhooks/revenuecat/",
  "/api/webhooks/revenuecat",
  "/api/webhooks/revenuecat/",
  "/webhook/revenuecat",
  "/webhook/revenuecat/",
  "/api/webhook/revenuecat",
  "/api/webhook/revenuecat/",
  "/revenuecat/webhook",
  "/revenuecat/webhook/",
  "/api/revenuecat/webhook",
  "/api/revenuecat/webhook/",
  "/webhooks",
  "/webhooks/",
  "/api/webhooks",
  "/api/webhooks/",
  "/webhook",
  "/webhook/",
  "/api/webhook",
  "/api/webhook/",
  "/revenuecat",
  "/revenuecat/",
  "/api/revenuecat",
  "/api/revenuecat/",
];

export function createWebhooksRouter(): IRouter {
  const router: IRouter = Router();

  /**
   * GET & HEAD webhook endpoints for dashboard connectivity tests & uptime pings.
   */
  router.get(WEBHOOK_PATHS, (_req, res): void => {
    res.status(200).json({
      status: "ok",
      service: "takeorder-revenuecat-webhook",
      timestamp: new Date().toISOString(),
      supportedMethods: ["GET", "POST", "HEAD"],
    });
  });

  router.head(WEBHOOK_PATHS, (_req, res): void => {
    res.status(200).end();
  });

  /**
   * POST /api/webhooks/revenuecat (and all path aliases including root /)
   * Receives RevenueCat server-to-server lifecycle webhooks.
   * Invalidates in-memory entitlement cache for the affected subscriber.
   */
  router.post(WEBHOOK_PATHS, (req, res): void => {
    const configuredSecret = process.env.REVENUECAT_WEBHOOK_SECRET?.trim();
    const body = req.body || {};
    const event = body.event || body;
    const isTestEvent = event.type === "TEST" || body.type === "TEST";

    if (configuredSecret) {
      const incomingAuth = req.get("authorization") || req.get("x-revenuecat-webhook-secret") || "";
      const token = incomingAuth.startsWith("Bearer ") ? incomingAuth.slice(7).trim() : incomingAuth.trim();

      if (!token || !timingSafeSecretCompare(token, configuredSecret)) {
        if (isTestEvent) {
          logger.info(
            { path: req.originalUrl || req.path },
            "RevenueCat TEST webhook received; accepting test ping",
          );
          res.status(200).json({
            received: true,
            event: "TEST",
            appUserId: event.app_user_id || event.original_app_user_id || null,
          });
          return;
        }

        logger.warn(
          { ip: req.ip, hasToken: Boolean(token), path: req.originalUrl || req.path },
          "Rejected RevenueCat webhook: authorization secret mismatch",
        );
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
    }

    try {
      const body = req.body || {};
      const event = body.event || body;
      const appUserId: string | undefined = event.app_user_id || event.original_app_user_id;
      const eventType: string = event.type || "UNKNOWN";
      const environment: string = event.environment || "SANDBOX";

      if (appUserId) {
        invalidateRevenueCatCache(appUserId);
        logger.info(
          { appUserId, eventType, environment },
          "RevenueCat webhook processed; subscriber cache invalidated",
        );
      } else {
        logger.info({ eventType }, "RevenueCat webhook received with no app_user_id");
      }

      // Promptly acknowledge receipt with 200 to prevent provider retries
      res.status(200).json({
        received: true,
        event: eventType,
        appUserId: appUserId ?? null,
      });
    } catch (err) {
      logger.error({ err }, "Error processing RevenueCat webhook");
      // Still acknowledge to prevent infinite webhook loops on corrupt payload
      res.status(200).json({ received: false, error: "Internal processing error" });
    }
  });

  return router;
}
