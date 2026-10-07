import { Router, type IRouter, type RequestHandler, type Response } from "express";
import { and, eq } from "drizzle-orm";
import { ordersTable, productsTable, sellerCardSeenTable } from "@workspace/db/schema";
import type { db } from "@workspace/db";
import { calculateAttentionSummary, type AttentionCardKey } from "../lib/attention";

function sellerId(res: Response): string {
  const user = (res.locals.ownerUserId as string) || (res.locals.userId as string) || res.locals.auth?.userId;
  if (!user) throw new Error("Missing seller identity");
  return user;
}

function normalizeCardKey(raw: string | undefined): AttentionCardKey | null {
  if (!raw) return null;
  const key = raw.toLowerCase().trim();
  if (key === "orders_to_ship" || key === "to_ship" || key === "pending") return "orders_to_ship";
  if (key === "low_stock" || key === "low-stock") return "low_stock";
  if (key === "unpaid_orders" || key === "unpaid" || key === "open") return "unpaid_orders";
  if (key === "missing_costs" || key === "missing-costs") return "missing_costs";
  if (key === "orders") return "orders";
  if (key === "recent_transactions" || key === "recent-transactions" || key === "transactions") return "recent_transactions";
  return null;
}

export function createAttentionRouter(database: typeof db, requireSellerAuth: RequestHandler): IRouter {
  const router: IRouter = Router();

  // GET /api/attention: Single source of truth for dashboard cards and sidebar badge
  router.get("/attention", requireSellerAuth, async (_req, res): Promise<void> => {
    try {
      const ownerUserId = sellerId(res);

      const [orders, products, seenRows] = await Promise.all([
        database
          .select({
            id: ordersTable.id,
            fulfillment: ordersTable.fulfillment,
            status: ordersTable.status,
            amount: ordersTable.amount,
            createdAt: ordersTable.createdAt,
            readAt: ordersTable.readAt,
          })
          .from(ordersTable)
          .where(eq(ordersTable.ownerUserId, ownerUserId)),
        database
          .select({
            id: productsTable.id,
            stock: productsTable.stock,
            cost: productsTable.cost,
          })
          .from(productsTable)
          .where(eq(productsTable.ownerUserId, ownerUserId)),
        database
          .select()
          .from(sellerCardSeenTable)
          .where(eq(sellerCardSeenTable.ownerUserId, ownerUserId)),
      ]);

      const seenMap: Record<string, Date> = {};
      for (const row of seenRows) {
        seenMap[row.cardKey] = row.seenAt;
      }

      const summary = calculateAttentionSummary(orders, products, seenMap, new Date());
      res.json(summary);
    } catch (error) {
      res.status(500).json({ error: "Failed to compute attention summary" });
    }
  });

  // POST /api/attention/seen: Idempotent mark category / card as seen
  router.post("/attention/seen", requireSellerAuth, async (req, res): Promise<void> => {
    try {
      const ownerUserId = sellerId(res);
      const rawKey = req.body?.cardKey || req.body?.category || req.body?.card;
      const canonicalKey = normalizeCardKey(rawKey);

      if (!canonicalKey) {
        res.status(400).json({
          error: "Invalid cardKey",
          validKeys: ["orders_to_ship", "low_stock", "unpaid_orders", "missing_costs", "orders"],
        });
        return;
      }

      const now = new Date();
      // If marking 'orders' or 'orders_to_ship', update both so sidebar badge and card stay in sync
      const keysToUpdate: AttentionCardKey[] =
        canonicalKey === "orders" || canonicalKey === "orders_to_ship"
          ? ["orders", "orders_to_ship"]
          : [canonicalKey];

      await Promise.all(
        keysToUpdate.map((k) =>
          database
            .insert(sellerCardSeenTable)
            .values({
              ownerUserId,
              cardKey: k,
              seenAt: now,
            })
            .onConflictDoUpdate({
              target: [sellerCardSeenTable.ownerUserId, sellerCardSeenTable.cardKey],
              set: { seenAt: now },
            }),
        ),
      );

      res.json({
        success: true,
        cardKey: canonicalKey,
        markedKeys: keysToUpdate,
        seenAt: now.toISOString(),
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to mark card as seen" });
    }
  });

  // POST /api/attention/read-order: Idempotent mark an order as read
  router.post("/attention/read-order", requireSellerAuth, async (req, res): Promise<void> => {
    try {
      const ownerUserId = sellerId(res);
      const orderId = Number(req.body?.orderId || req.body?.id);
      if (!Number.isInteger(orderId) || orderId <= 0) {
        res.status(400).json({ error: "Invalid orderId" });
        return;
      }
      const now = new Date();
      await database
        .update(ordersTable)
        .set({ readAt: now })
        .where(
          and(
            eq(ordersTable.id, orderId),
            eq(ordersTable.ownerUserId, ownerUserId),
          ),
        );
      res.json({ success: true, orderId, readAt: now.toISOString() });
    } catch (error) {
      res.status(500).json({ error: "Failed to mark order as read" });
    }
  });

  return router;
}
