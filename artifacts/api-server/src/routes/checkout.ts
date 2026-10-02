import { Router, type IRouter } from "express";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import {
  orderItemsTable,
  ordersTable,
  productsTable,
} from "@workspace/db/schema";
import type { ProductPreferenceGroup } from "@workspace/db/schema";
import type { db } from "@workspace/db";
import {
  GetPublicOrderParams,
  GetPublicOrderResponse,
  SubmitPublicOrderBody,
  SubmitPublicOrderParams,
  SubmitPublicOrderResponse,
} from "@workspace/api-zod";
import { readSellerSettings } from "./settings";
import { preferencesForProduct } from "./products";
import {
  adjustOrderStock,
  adjustStock,
  isSaleStatus,
  orderResponse,
  productCostForSale,
  sellerItemsForOrder,
} from "./orders";
import { logger } from "../lib/logger";

const toNumber = (val: string | number | null | undefined): number | null => {
  if (val == null) return null;
  const num = Number(val);
  return Number.isNaN(num) ? null : num;
};

export function publicOrderResponse(
  order: typeof ordersTable.$inferSelect,
  sellerSettings: Awaited<ReturnType<typeof readSellerSettings>>,
  items: Array<{
    productId: number;
    productName: string;
    amount: number;
    quantity: number;
    source: "catalog" | "custom";
    variants: string[];
    preferences: ProductPreferenceGroup[];
    sku: string | null;
    description: string | null;
    compareAtPrice: number | null;
    imageUrls: string[];
    stock: number;
    available: boolean;
  }>,
) {
  return {
    token: order.token,
    productName: order.productName,
    amount: Number(order.amount),
    subtotal: items.reduce((sum, item) => sum + item.amount * item.quantity, 0),
    deliveryFee: toNumber(order.deliveryFee) ?? 0,
    deliveryMethod: order.deliveryMethod ?? null,
    depositAmount: toNumber(order.depositAmount),
    paymentMode: order.paymentMode,
    status: order.status,
    businessName: sellerSettings.businessName || "The Sunday Edit",
    businessDescription: sellerSettings.description,
    logoDataUrl: sellerSettings.logoDataUrl,
    currency: sellerSettings.currency,
    deliveryDefault: sellerSettings.deliveryDefault,
    checkoutAskForDetails: sellerSettings.checkoutAskForDetails,
    checkoutAllowReferenceImages: sellerSettings.checkoutAllowReferenceImages,
    variants: items[0]?.variants ?? [],
    items,
  };
}

export async function publicItemsForOrder(
  database: typeof db,
  order: typeof ordersTable.$inferSelect,
) {
  const storedItems = await database
    .select()
    .from(orderItemsTable)
    .where(eq(orderItemsTable.orderId, order.id))
    .orderBy(asc(orderItemsTable.position), asc(orderItemsTable.id));

  if (storedItems.length === 0) {
    const [product] = await database
      .select()
      .from(productsTable)
      .where(eq(productsTable.id, order.productId));
    return [{
      productId: order.productId,
      productName: order.productName,
      amount: Number(order.amount),
      quantity: 1,
      source: (product?.category === "Custom order" ? "custom" : "catalog") as "custom" | "catalog",
      variants: product?.variants ?? [],
      preferences: preferencesForProduct(product?.preferences, product?.variants ?? []),
      sku: product?.sku ?? null,
      description: product?.description ?? null,
      compareAtPrice: toNumber(product?.compareAtPrice ?? null),
      imageUrls: product?.imageUrls?.length ? product.imageUrls : product?.imageUrl ? [product.imageUrl] : [],
      stock: product?.stock ?? 0,
      available: product?.category !== "Custom order" && (product?.stock ?? 0) > 0,
    }];
  }

  const productIds = [...new Set(storedItems.map((item) => item.productId))];
  const products = await database
    .select()
    .from(productsTable)
    .where(inArray(productsTable.id, productIds));
  const productsById = new Map(products.map((product) => [product.id, product]));

  return storedItems.map((item) => {
    const product = productsById.get(item.productId);
    const source: "catalog" | "custom" = item.source === "custom" || product?.category === "Custom order" ? "custom" : "catalog";
    const stock = product?.stock ?? 0;
    return {
      productId: item.productId,
      productName: item.productName,
      amount: Number(item.amount),
      quantity: item.quantity ?? 1,
      variants: product?.variants ?? [],
      preferences: preferencesForProduct(product?.preferences, product?.variants ?? []),
      source,
      sku: item.sku ?? product?.sku ?? null,
      description: item.description ?? product?.description ?? null,
      compareAtPrice: toNumber(item.compareAtPrice ?? product?.compareAtPrice ?? null),
      imageUrls: item.imageUrls?.length ? item.imageUrls : product?.imageUrls?.length ? product.imageUrls : product?.imageUrl ? [product.imageUrl] : [],
      stock,
      available: source === "catalog" && stock >= item.quantity,
    };
  });
}

export function createCheckoutRouter(database: typeof db): IRouter {
  const router: IRouter = Router();

  router.get("/public/orders/:token", async (req, res): Promise<void> => {
    const params = GetPublicOrderParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const [order] = await database.select().from(ordersTable).where(eq(ordersTable.token, params.data.token));
    if (!order) {
      res.status(404).json({ error: "Order link not found" });
      return;
    }
    const updatedOpens = (order.linkOpens ?? 0) + 1;
    database
      .update(ordersTable)
      .set({ linkOpens: sql`${ordersTable.linkOpens} + 1` })
      .where(eq(ordersTable.id, order.id))
      .catch((err) => {
        logger.warn({ error: err, orderId: order.id }, "Failed to increment linkOpens");
      });

    const updatedOrder = { ...order, linkOpens: updatedOpens };
    const items = await publicItemsForOrder(database, updatedOrder);
    const sellerSettings = await readSellerSettings(database, updatedOrder.ownerUserId ?? "");
    res.json(GetPublicOrderResponse.parse(publicOrderResponse(updatedOrder, sellerSettings, items)));
  });

  router.post("/public/orders/:token", async (req, res): Promise<void> => {
    const params = SubmitPublicOrderParams.safeParse(req.params);
    const parsed = SubmitPublicOrderBody.safeParse(req.body);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [existing] = await database.select().from(ordersTable).where(eq(ordersTable.token, params.data.token));
    if (!existing) {
      res.status(404).json({ error: "Order link not found" });
      return;
    }
    const shouldReserve = parsed.data.paymentAction === "reserve" || existing.paymentMode === "reserve";
    const deliveryMethod = parsed.data.deliveryMethod ?? "pickup";
    const deliveryAddress = parsed.data.deliveryAddress?.trim() || null;
    if (deliveryMethod === "delivery" && !deliveryAddress) {
      res.status(400).json({ error: "A delivery address is required when delivery is selected" });
      return;
    }
    const nextStatus = shouldReserve
      ? "reserved"
      : existing.paymentMode === "deposit"
        ? "deposit_paid"
        : "paid";
    const saleProductCost = await productCostForSale(database, existing, nextStatus);
    const itemDetails = parsed.data.itemDetails ?? [];
    const itemDetailsByIndex = new Map(itemDetails.map((detail) => [detail.itemIndex, detail]));
    const storedItems = await database
      .select()
      .from(orderItemsTable)
      .where(eq(orderItemsTable.orderId, existing.id))
      .orderBy(asc(orderItemsTable.position), asc(orderItemsTable.id));
    const productIds = [...new Set(storedItems.map((item) => item.productId))];
    const products = productIds.length
      ? await database.select().from(productsTable).where(inArray(productsTable.id, productIds))
      : [];
    const productsById = new Map(products.map((product) => [product.id, product]));
    const requestedQuantities = storedItems.map((item, index) => itemDetailsByIndex.get(index)?.quantity ?? item.quantity ?? 1);
    if (requestedQuantities.some((quantity) => !Number.isInteger(quantity) || quantity < 1)) {
      res.status(400).json({ error: "Each item quantity must be a whole number greater than zero" });
      return;
    }
    for (const [index, item] of storedItems.entries()) {
      const product = productsById.get(item.productId);
      if (!product || product.category.trim().toLowerCase() === "custom order") continue;
      const availableStock = product.stock + (isSaleStatus(existing.status) ? item.quantity : 0);
      if (requestedQuantities[index]! > availableStock) {
        res.status(400).json({ error: `${item.productName} does not have enough stock for that quantity` });
        return;
      }
    }
    const deliveryFee = Number(existing.deliveryFee ?? 0);
    const baseAmount = storedItems.length
      ? storedItems.reduce((total, item, index) => total + Number(item.amount) * requestedQuantities[index]!, 0)
      : Number(existing.amount) - (existing.deliveryMethod === "delivery" ? deliveryFee : 0);
    const finalAmount = baseAmount + (deliveryMethod === "delivery" ? deliveryFee : 0);
    const combinedBuyerDetails = itemDetails
      .filter((detail) => detail.details?.trim() || detail.variant?.trim())
      .map((detail) => {
        const parts = [detail.variant?.trim(), detail.details?.trim()].filter(Boolean);
        return `Item ${detail.itemIndex + 1}: ${parts.join(" · ")}`;
      })
      .join("\n");
    const combinedOrderDetails = [parsed.data.buyerDetails?.trim(), combinedBuyerDetails]
      .filter(Boolean)
      .join("\n");
    const firstReferenceImage = itemDetails.find((detail) => detail.referenceImage?.trim())?.referenceImage?.trim();
    const runTransaction = typeof (database as any).transaction === "function"
      ? (cb: (tx: any) => Promise<any>) => (database as any).transaction(cb)
      : (cb: (tx: any) => Promise<any>) => cb(database);

    try {
      const [order, items] = await runTransaction(async (tx: any) => {
        const [updatedOrder] = await tx
          .update(ordersTable)
          .set({
            customerName: parsed.data.customerName,
            customerPhone: parsed.data.customerPhone,
            amount: finalAmount.toFixed(2),
            deliveryMethod,
            deliveryAddress: deliveryMethod === "delivery" ? deliveryAddress : null,
            buyerDetails: combinedOrderDetails || null,
            referenceImage: parsed.data.referenceImage ?? firstReferenceImage ?? null,
            status: nextStatus,
            ...(saleProductCost === undefined ? {} : { productCost: saleProductCost }),
          })
          .where(eq(ordersTable.id, existing.id))
          .returning();

        for (const [index, item] of storedItems.entries()) {
          const detail = itemDetailsByIndex.get(index);
          if (!detail && requestedQuantities[index] === item.quantity) continue;
          await tx
            .update(orderItemsTable)
            .set({
              quantity: requestedQuantities[index]!,
              ...(detail ? {
                buyerVariant: detail.variant?.trim() || null,
                buyerDetails: detail.details?.trim() || null,
                referenceImage: detail.referenceImage?.trim() || null,
              } : {}),
            })
            .where(eq(orderItemsTable.id, item.id));
        }

        if (nextStatus === "paid" && !isSaleStatus(existing.status)) {
          const ok = await adjustOrderStock(updatedOrder, -1, tx);
          if (!ok) {
            throw new Error("One or more products do not have sufficient stock to complete this purchase");
          }
        } else if (nextStatus === "paid" && isSaleStatus(existing.status)) {
          for (const [index, item] of storedItems.entries()) {
            const delta = item.quantity - requestedQuantities[index]!;
            if (delta) {
              const ok = await adjustStock(item.productId, delta, tx);
              if (!ok && delta < 0) {
                throw new Error(`${item.productName} does not have sufficient stock`);
              }
            }
          }
        }

        const txItems = await sellerItemsForOrder(updatedOrder, tx);
        return [updatedOrder, txItems];
      });

      res.json(SubmitPublicOrderResponse.parse(orderResponse(order, items)));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to submit order";
      res.status(400).json({ error: message });
    }
  });

  return router;
}
