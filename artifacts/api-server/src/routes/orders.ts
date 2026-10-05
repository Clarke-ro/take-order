import { Router, type IRouter, type RequestHandler, type Response } from "express";
import { and, asc, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import {
  orderItemsTable,
  ordersTable,
  productsTable,
} from "@workspace/db/schema";
import type { db } from "@workspace/db";
import {
  CreateOrderBody,
  CreateOrderResponse,
  GetOrderParams,
  GetOrderResponse,
  ListOrdersResponse,
  UpdateOrderBody,
  UpdateOrderParams,
  UpdateOrderResponse,
  WAITING_FOR_BUYER,
} from "@workspace/api-zod";
import { stockDeltaForOrderStatusChange } from "../lib/dashboard-analytics";
import { resolveSellerEntitlement } from "../lib/entitlements.js";

function sellerId(res: Response): string {
  const user = (res.locals.ownerUserId as string) || (res.locals.userId as string) || res.locals.auth?.userId;
  if (!user) throw new Error("Missing seller identity");
  return user;
}

const toNumber = (val: string | number | null | undefined): number | null => {
  if (val == null) return null;
  const num = Number(val);
  return Number.isNaN(num) ? null : num;
};

export type SellerOrderItem = {
  productId: number;
  productName: string;
  amount: number;
  quantity: number;
  buyerVariant?: string | null;
  source?: "catalog" | "custom";
  sku?: string | null;
  buyerDetails?: string | null;
  imageUrls?: string[];
};

export function orderResponse(order: typeof ordersTable.$inferSelect, items: SellerOrderItem[] = []) {
  return {
    ...order,
    amount: Number(order.amount),
    deliveryFee: toNumber(order.deliveryFee) ?? 0,
    deliveryMethod: order.deliveryMethod ?? null,
    deliveryAddress: order.deliveryAddress ?? null,
    productCost: toNumber(order.productCost),
    depositAmount: toNumber(order.depositAmount),
    amountDueNow: toNumber(order.amountDueNow),
    allowReservation: order.allowReservation ?? null,
    allowHalfPayment: order.allowHalfPayment ?? null,
    halfPaymentPercent: order.halfPaymentPercent ?? null,
    chosenMode: (order.chosenMode as any) ?? null,
    percentUsed: order.percentUsed ?? null,
    createdAt: order.createdAt.toISOString(),
    linkOpens: order.linkOpens ?? 0,
    shares: order.shares ?? 0,
    likes: order.likes ?? 0,
    engagementSource: order.engagementSource ?? null,
    items: items.length > 0 ? items : [{
      productId: order.productId,
      productName: order.productName,
      amount: Number(order.amount),
      quantity: 1,
    }],
  };
}

export async function sellerItemsForOrder(
  order: typeof ordersTable.$inferSelect,
  dbInstance: any,
): Promise<SellerOrderItem[]> {
  const storedItems = await dbInstance
    .select()
    .from(orderItemsTable)
    .where(eq(orderItemsTable.orderId, order.id))
    .orderBy(asc(orderItemsTable.position), asc(orderItemsTable.id));

  return (storedItems as Array<typeof orderItemsTable.$inferSelect>).map((item) => ({
    productId: item.productId,
    productName: item.productName,
    amount: Number(item.amount),
    quantity: item.quantity,
    buyerVariant: item.buyerVariant ?? null,
    source: (item.source === "custom" ? "custom" : "catalog") as "custom" | "catalog",
    sku: item.sku ?? null,
    buyerDetails: item.buyerDetails ?? null,
    imageUrls: item.imageUrls ?? [],
  }));
}

export async function sellerItemsForOrders(
  database: typeof db,
  orders: Array<typeof ordersTable.$inferSelect>,
): Promise<Map<number, SellerOrderItem[]>> {
  if (orders.length === 0) return new Map<number, SellerOrderItem[]>();
  const rows = await database
    .select()
    .from(orderItemsTable)
    .where(inArray(orderItemsTable.orderId, orders.map((order) => order.id)))
    .orderBy(asc(orderItemsTable.orderId), asc(orderItemsTable.position), asc(orderItemsTable.id));
  const byOrder = new Map<number, SellerOrderItem[]>();
  for (const item of rows) {
    const current = byOrder.get(item.orderId) ?? [];
    current.push({
      productId: item.productId,
      productName: item.productName,
      amount: Number(item.amount),
      quantity: item.quantity ?? 1,
      buyerVariant: item.buyerVariant ?? null,
      source: (item.source === "custom" ? "custom" : "catalog") as "custom" | "catalog",
      sku: item.sku ?? null,
      buyerDetails: item.buyerDetails ?? null,
      imageUrls: item.imageUrls ?? [],
    });
    byOrder.set(item.orderId, current);
  }
  return byOrder;
}

export async function adjustStock(productId: number, direction: number, dbInstance: any): Promise<boolean> {
  if (direction < 0) {
    const deductQty = Math.abs(direction);
    const updated = await dbInstance
      .update(productsTable)
      .set({ stock: sql`GREATEST(0, ${productsTable.stock} - ${deductQty})` })
      .where(and(eq(productsTable.id, productId), gte(productsTable.stock, deductQty)))
      .returning({ id: productsTable.id });
    return updated.length > 0;
  } else if (direction > 0) {
    await dbInstance
      .update(productsTable)
      .set({ stock: sql`${productsTable.stock} + ${direction}` })
      .where(eq(productsTable.id, productId));
    return true;
  }
  return true;
}

export async function adjustOrderStock(
  order: typeof ordersTable.$inferSelect,
  direction: number,
  dbInstance: any,
): Promise<boolean> {
  const items = await dbInstance
    .select({ productId: orderItemsTable.productId, quantity: orderItemsTable.quantity })
    .from(orderItemsTable)
    .where(eq(orderItemsTable.orderId, order.id))
    .orderBy(asc(orderItemsTable.position), asc(orderItemsTable.id));

  if (items.length === 0) {
    return await adjustStock(order.productId, direction, dbInstance);
  }

  let allSuccess = true;
  for (const item of items) {
    const ok = await adjustStock(item.productId, direction * item.quantity, dbInstance);
    if (!ok) allSuccess = false;
  }
  return allSuccess;
}

export const isSaleStatus = (status: string) =>
  status === "paid" || status === "deposit_paid";

export async function productCostForSale(
  database: typeof db,
  existing: typeof ordersTable.$inferSelect,
  nextStatus: string,
): Promise<string | null | undefined> {
  if (
    existing.productCost !== null ||
    isSaleStatus(existing.status) ||
    !isSaleStatus(nextStatus)
  ) {
    return undefined;
  }
  const itemRows = await database
    .select({ productId: orderItemsTable.productId, quantity: orderItemsTable.quantity })
    .from(orderItemsTable)
    .where(eq(orderItemsTable.orderId, existing.id))
    .orderBy(asc(orderItemsTable.position), asc(orderItemsTable.id));
  const productIds = itemRows.length > 0 ? itemRows.map((item) => item.productId) : [existing.productId];
  const products = await database
    .select({ id: productsTable.id, cost: productsTable.cost })
    .from(productsTable)
    .where(inArray(productsTable.id, [...new Set(productIds)]));
  const costs = itemRows.length > 0
    ? itemRows.map((item) => {
      const cost = products.find((product) => product.id === item.productId)?.cost;
      return cost == null ? null : Number(cost) * (item.quantity ?? 1);
    })
    : [products.find((product) => product.id === existing.productId)?.cost == null
      ? null
      : Number(products.find((product) => product.id === existing.productId)!.cost)];
  if (costs.some((cost) => cost === null)) return null;
  return costs.reduce<number>((total, cost) => total + (cost == null ? 0 : Number(cost)), 0).toFixed(2);
}

export function createOrdersRouter(database: typeof db, requireSellerAuth: RequestHandler): IRouter {
  const router: IRouter = Router();

  router.get("/orders", requireSellerAuth, async (_req, res): Promise<void> => {
    const orders = await database.select().from(ordersTable)
      .where(eq(ordersTable.ownerUserId, sellerId(res)))
      .orderBy(desc(ordersTable.createdAt));
    const itemsByOrder = await sellerItemsForOrders(database, orders);
    res.json(ListOrdersResponse.parse(orders.map((order) => orderResponse(order, itemsByOrder.get(order.id)))));
  });

  router.post("/orders", requireSellerAuth, async (req, res): Promise<void> => {
    const parsed = CreateOrderBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const ownerUserId = sellerId(res);
    const entitlement = await resolveSellerEntitlement(database, ownerUserId);
    if (entitlement.limits.activeLinkLimitReached) {
      res.status(403).json({
        error: "Active Take Order link limit reached",
        code: "LINK_LIMIT_REACHED",
        limit: entitlement.limits.activeLinkLimit.limit,
        current: entitlement.usage.activeLinkCount,
        tier: entitlement.tier,
        message: `You have reached your ${entitlement.limits.activeLinkLimit.limit} active Take Order link limit. Existing links continue working. ${
          entitlement.tier === "pro"
            ? "Upgrade to Pro+ to remove the active-link limit."
            : "Upgrade to Pro to create up to 500 active links."
        }`,
      });
      return;
    }
    const requestedItems = (parsed.data.items?.length
      ? parsed.data.items
      : parsed.data.productId != null && parsed.data.amount != null
        ? [{ productId: parsed.data.productId, amount: parsed.data.amount, quantity: 1 }]
        : null)?.map((item) => ({ ...item, quantity: item.quantity ?? 1 }));
    if (!requestedItems?.length) {
      res.status(400).json({ error: "At least one order item is required" });
      return;
    }
    const productIds = [...new Set(requestedItems.map((item) => item.productId))];
    const products = await database
      .select()
      .from(productsTable)
      .where(and(inArray(productsTable.id, productIds), eq(productsTable.ownerUserId, ownerUserId)));
    const productsById = new Map(products.map((product) => [product.id, product]));
    const missingProduct = requestedItems.find((item) => !productsById.has(item.productId));
    if (missingProduct) {
      res.status(404).json({ error: "Product not found" });
      return;
    }
    const invalidQuantity = requestedItems.find((item) => !Number.isInteger(item.quantity) || item.quantity < 1);
    if (invalidQuantity) {
      res.status(400).json({ error: "Each order item quantity must be a whole number greater than zero" });
      return;
    }
    const totalAmount = requestedItems.reduce((total, item) => total + item.amount * item.quantity, 0);
    if (parsed.data.depositAmount != null && parsed.data.depositAmount > totalAmount) {
      res.status(400).json({ error: "Deposit cannot exceed the order total" });
      return;
    }
    const allowHalfPayment = parsed.data.allowHalfPayment ?? null;
    const allowReservation = parsed.data.allowReservation ?? null;
    let halfPaymentPercent = parsed.data.halfPaymentPercent ?? null;
    if (allowHalfPayment) {
      const pct = halfPaymentPercent != null ? halfPaymentPercent : 50;
      if (!Number.isInteger(pct) || pct < 1 || pct > 99) {
        res.status(400).json({ error: "Half payment percent must be a whole number between 1 and 99" });
        return;
      }
      halfPaymentPercent = pct;
    } else if (allowHalfPayment === false) {
      halfPaymentPercent = null;
    }
    const firstProduct = productsById.get(requestedItems[0].productId)!;
    const [order] = await database
      .insert(ordersTable)
      .values({
        ownerUserId: sellerId(res),
        token: randomBytes(16).toString("hex"),
        productId: firstProduct.id,
        productName: requestedItems.length === 1
          ? firstProduct.name
          : `${firstProduct.name} + ${requestedItems.length - 1} more`,
        channel: parsed.data.channel,
        amount: totalAmount.toFixed(2),
        deliveryFee: (parsed.data.deliveryFee ?? 0).toFixed(2),
        depositAmount: parsed.data.depositAmount == null ? null : parsed.data.depositAmount.toFixed(2),
        paymentMode: parsed.data.paymentMode,
        allowReservation,
        allowHalfPayment,
        halfPaymentPercent,
        chosenMode: null,
        percentUsed: null,
        amountDueNow: null,
        status: "reserved",
        fulfillment: "pending",
        customerName: parsed.data.customerName?.trim() || WAITING_FOR_BUYER,
        customerPhone: parsed.data.customerPhone?.trim() || null,
        deliveryAddress: parsed.data.deliveryAddress?.trim() || null,
        buyerDetails: parsed.data.buyerDetails?.trim() || null,
      })
      .returning();
    await database.insert(orderItemsTable).values(
      requestedItems.map((item, position) => ({
        orderId: order.id,
        productId: item.productId,
        productName: productsById.get(item.productId)!.name,
        source: productsById.get(item.productId)!.category.trim().toLowerCase() === "custom order" ? "custom" : "catalog",
        sku: productsById.get(item.productId)!.sku ?? null,
        description: productsById.get(item.productId)!.description ?? null,
        compareAtPrice: productsById.get(item.productId)!.compareAtPrice,
        imageUrls: productsById.get(item.productId)!.imageUrls?.length
          ? productsById.get(item.productId)!.imageUrls
          : productsById.get(item.productId)!.imageUrl
            ? [productsById.get(item.productId)!.imageUrl!]
            : [],
        amount: item.amount.toFixed(2),
        quantity: item.quantity,
        position,
      })),
    );
    const items = await sellerItemsForOrder(order, database);
    res.status(201).json(CreateOrderResponse.parse(orderResponse(order, items)));
  });

  router.get("/orders/:id", requireSellerAuth, async (req, res): Promise<void> => {
    const params = GetOrderParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const [order] = await database.select().from(ordersTable)
      .where(and(eq(ordersTable.id, params.data.id), eq(ordersTable.ownerUserId, sellerId(res))));
    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }
    const items = await sellerItemsForOrder(order, database);
    res.json(GetOrderResponse.parse(orderResponse(order, items)));
  });

  router.patch("/orders/:id", requireSellerAuth, async (req, res): Promise<void> => {
    const params = UpdateOrderParams.safeParse(req.params);
    const parsed = UpdateOrderBody.safeParse(req.body);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [existing] = await database.select().from(ordersTable)
      .where(and(eq(ordersTable.id, params.data.id), eq(ordersTable.ownerUserId, sellerId(res))));
    if (!existing) {
      res.status(404).json({ error: "Order not found" });
      return;
    }
    const nextStatus = parsed.data.status ?? existing.status;
    const saleProductCost = await productCostForSale(database, existing, nextStatus);
    const [order] = await database
      .update(ordersTable)
      .set(
        saleProductCost === undefined
          ? parsed.data
          : { ...parsed.data, productCost: saleProductCost },
      )
      .where(and(eq(ordersTable.id, params.data.id), eq(ordersTable.ownerUserId, sellerId(res))))
      .returning();
    const stockDelta = stockDeltaForOrderStatusChange(existing.status, parsed.data.status ?? existing.status);
    if (stockDelta) await adjustOrderStock(existing, stockDelta, database);
    const items = await sellerItemsForOrder(order, database);
    res.json(UpdateOrderResponse.parse(orderResponse(order, items)));
  });

  return router;
}
