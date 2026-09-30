import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { pinoHttp } from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import type { db } from "@workspace/db";
import { createRouter } from "./routes";
import { logger } from "./lib/logger";
import { CLERK_PROXY_PATH, clerkProxyMiddleware, getClerkProxyHost } from "./middlewares/clerkProxyMiddleware";
import { requireAuth } from "./middlewares/requireAuth";

import path from "node:path";
import fs from "node:fs";
import { eq } from "drizzle-orm";
import { ordersTable, orderItemsTable, productsTable } from "@workspace/db/schema";
import { readSellerSettings } from "./routes/settings";
import {
  isCrawlerRequest,
  renderOrderPreviewHtml,
  renderNotFoundPreviewHtml,
} from "./lib/link-preview";

export function createApp(database: typeof db, options: { authMiddleware?: express.RequestHandler } = {}): Express {
  const app: Express = express();

  // Trust first proxy hop (Heroku reverse proxy routing layer)
  app.set("trust proxy", 1);

  // Root index endpoint
  app.get("/", (_req, res) => {
    res.status(200).json({
      status: "ok",
      service: "Take Order API",
      health: "/health",
      version: "1.0.0",
    });
  });

  // Platform health check (returns 200 without auth, leaking zero secrets or db details)
  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
      contentSecurityPolicy: false,
    }),
  );

  app.use(
    pinoHttp({
      logger,
      serializers: {
        req(req: any) {
          return {
            id: req.id,
            method: req.method,
            url: req.url?.split("?")[0],
          };
        },
        res(res: any) {
          return {
            statusCode: res.statusCode,
          };
        },
      },
    }),
  );
  app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

  const configuredOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",")
        .map((origin) => origin.trim().replace(/\/+$/, ""))
        .filter(Boolean)
    : null;

  const corsOrigin = configuredOrigins
    ? (origin: string | undefined, callback: (err: Error | null, origin?: any) => void) => {
        if (!origin) return callback(null, true);
        const normalized = origin.trim().replace(/\/+$/, "");
        if (
          configuredOrigins.includes(normalized) ||
          configuredOrigins.includes("*") ||
          (configuredOrigins.some((o) => o.includes(".vercel.app")) && normalized.endsWith(".vercel.app"))
        ) {
          return callback(null, true);
        }
        return callback(null, false);
      }
    : true;

  app.use(cors({ credentials: true, origin: corsOrigin }));
  app.use(express.json({ limit: "6mb" }));
  app.use(express.urlencoded({ extended: true }));

  const publicLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests, please try again later." },
  });

  app.use("/api/public", publicLimiter);
  app.use("/api/upload", publicLimiter);

  // Serve public static branding assets for Open Graph images and fallbacks
  const possiblePublicPaths = [
    path.resolve(process.cwd(), "artifacts/api-server/public"),
    path.resolve(process.cwd(), "public"),
    path.resolve(import.meta.dirname, "../public"),
    path.resolve(import.meta.dirname, "public"),
    path.resolve(process.cwd(), "artifacts/duka/public"),
  ];
  const resolvedPublicPath = possiblePublicPaths.find((p) => fs.existsSync(p));
  if (resolvedPublicPath) {
    app.use(express.static(resolvedPublicPath));
  }

  const handleOrderPreview = async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const token = req.params.token;
      if (!token || typeof token !== "string") {
        res.status(400).send("Invalid order token");
        return;
      }

      const [order] = await database
        .select()
        .from(ordersTable)
        .where(eq(ordersTable.token, token));

      const proto = req.get("x-forwarded-proto") || (req.secure ? "https" : "http");
      const host = req.get("x-forwarded-host") || req.get("host") || "localhost:5000";
      const baseUrl = `${proto}://${host}`;

      if (!order) {
        res.status(404).set("Content-Type", "text/html; charset=utf-8").send(renderNotFoundPreviewHtml(baseUrl));
        return;
      }

      const items = await database
        .select()
        .from(orderItemsTable)
        .where(eq(orderItemsTable.orderId, order.id));

      const sellerSettings = await readSellerSettings(database, order.ownerUserId ?? "");

      let productImageUrl: string | null = null;
      if (order.productId) {
        const [product] = await database
          .select()
          .from(productsTable)
          .where(eq(productsTable.id, order.productId));
        productImageUrl = product?.imageUrl || product?.imageUrls?.[0] || null;
      }

      const userAgent = req.get("user-agent") || "";
      const isCrawler = isCrawlerRequest(userAgent);
      const forcePreview = req.query.preview === "1" || req.query.crawler === "1";

      const frontendOrigin =
        process.env.FRONTEND_URL ||
        process.env.WEB_URL ||
        (process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(",")[0].trim() : "") ||
        (process.env.NODE_ENV === "development" ? "http://localhost:5173" : baseUrl);

      const destinationUrl = `${frontendOrigin.replace(/\/$/, "")}/o/${order.token}`;
      const currentUrl = `${baseUrl}/o/${order.token}`;

      // If a real human in a web browser visits this endpoint and not forcing preview,
      // and destinationUrl is distinct from currentUrl, redirect them to the interactive React checkout
      if (!isCrawler && !forcePreview && destinationUrl !== currentUrl) {
        res.redirect(302, destinationUrl);
        return;
      }

      const html = renderOrderPreviewHtml({
        order: {
          token: order.token,
          productName: order.productName,
          amount: order.amount,
        },
        items: items.map((item) => ({
          productName: item.productName,
          amount: item.amount,
          imageUrls: item.imageUrls,
        })),
        sellerBusinessName: sellerSettings.businessName,
        currency: sellerSettings.currency,
        productImageUrl,
        baseUrl,
        destinationUrl,
        isCrawler,
      });

      res.status(200).set("Content-Type", "text/html; charset=utf-8").send(html);
    } catch (error) {
      logger.error({ error }, "Error rendering order link preview");
      res.status(500).send("Error loading order preview");
    }
  };

  // Public Order Link & Preview Routes (mounted before clerkMiddleware)
  app.get("/o/:token", handleOrderPreview);
  app.get("/order/:token", handleOrderPreview);
  app.get("/api/public/order-preview/:token", handleOrderPreview);

  if (!options.authMiddleware && process.env.CLERK_SECRET_KEY) {
    app.use(
      clerkMiddleware((req) => ({
        publishableKey: publishableKeyFromHost(
          getClerkProxyHost(req) ?? "",
          process.env.CLERK_PUBLISHABLE_KEY,
        ),
      })),
    );
  }

  app.use("/api", createRouter(database, options.authMiddleware ?? requireAuth));

  return app;
}
