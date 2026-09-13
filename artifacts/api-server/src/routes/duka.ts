import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { db, ordersTable, productsTable } from "@workspace/db";
import {
  CreateProductBody,
  CreateProductResponse,
  CreateOrderBody,
  CreateOrderResponse,
  DeleteProductParams,
  GetDashboardSummaryResponse,
  GetOrderParams,
  GetOrderResponse,
  GetPublicOrderParams,
  GetPublicOrderResponse,
  ListOrdersResponse,
  ListProductsResponse,
  SubmitPublicOrderBody,
  SubmitPublicOrderParams,
  SubmitPublicOrderResponse,
  UpdateOrderBody,
  UpdateOrderParams,
  UpdateOrderResponse,
  UpdateProductBody,
  UpdateProductParams,
  UpdateProductResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

const channelLabels: Record<string, string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  tiktok: "TikTok",
  snapchat: "Snapchat",
  in_person: "In person",
};

const toNumber = (value: string | number | null): number | null =>
  value == null ? null : Number(value);

function productResponse(product: typeof productsTable.$inferSelect) {
  return {
    ...product,
    price: Number(product.price),
    cost: toNumber(product.cost),
    variants: product.variants ?? [],
  };
}

function orderResponse(order: typeof ordersTable.$inferSelect) {
  return {
    ...order,
    amount: Number(order.amount),
    depositAmount: toNumber(order.depositAmount),
    createdAt: order.createdAt.toISOString(),
  };
}

function publicOrderResponse(
  order: typeof ordersTable.$inferSelect,
  product: typeof productsTable.$inferSelect | undefined,
) {
  return {
    token: order.token,
    productName: order.productName,
    amount: Number(order.amount),
    depositAmount: toNumber(order.depositAmount),
    paymentMode: order.paymentMode,
    status: order.status,
    variants: product?.variants ?? [],
  };
}

async function adjustStock(productId: number, direction: number) {
  const [product] = await db
    .select()
    .from(productsTable)
    .where(eq(productsTable.id, productId));
  if (!product) return;
  await db
    .update(productsTable)
    .set({ stock: Math.max(0, product.stock + direction) })
    .where(eq(productsTable.id, productId));
}

router.get("/products", async (_req, res): Promise<void> => {
  const products = await db.select().from(productsTable).orderBy(productsTable.id);
  res.json(ListProductsResponse.parse(products.map(productResponse)));
});

router.post("/products", async (req, res): Promise<void> => {
  const parsed = CreateProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [product] = await db
    .insert(productsTable)
    .values({
      ...parsed.data,
      price: parsed.data.price.toFixed(2),
      cost: parsed.data.cost == null ? null : parsed.data.cost.toFixed(2),
      variants: parsed.data.variants ?? [],
      accent: parsed.data.accent ?? "#0F6E6B",
    })
    .returning();
  res.status(201).json(CreateProductResponse.parse(productResponse(product)));
});

router.patch("/products/:id", async (req, res): Promise<void> => {
  const params = UpdateProductParams.safeParse(req.params);
  const parsed = UpdateProductBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const update: {
    name?: string;
    category?: string;
    price?: string;
    cost?: string | null;
    stock?: number;
    variants?: string[];
    accent?: string;
  } = {};
  if (parsed.data.name !== undefined) update.name = parsed.data.name;
  if (parsed.data.category !== undefined) update.category = parsed.data.category;
  if (parsed.data.price !== undefined) update.price = parsed.data.price.toFixed(2);
  if (parsed.data.cost !== undefined) update.cost = parsed.data.cost == null ? null : parsed.data.cost.toFixed(2);
  if (parsed.data.stock !== undefined) update.stock = parsed.data.stock;
  if (parsed.data.variants !== undefined) update.variants = parsed.data.variants;
  if (parsed.data.accent !== undefined) update.accent = parsed.data.accent;
  const [product] = await db
    .update(productsTable)
    .set(update)
    .where(eq(productsTable.id, params.data.id))
    .returning();
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  res.json(UpdateProductResponse.parse(productResponse(product)));
});

router.delete("/products/:id", async (req, res): Promise<void> => {
  const params = DeleteProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [product] = await db
    .delete(productsTable)
    .where(eq(productsTable.id, params.data.id))
    .returning();
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  res.sendStatus(204);
});

router.get("/orders", async (_req, res): Promise<void> => {
  const orders = await db.select().from(ordersTable).orderBy(desc(ordersTable.createdAt));
  res.json(ListOrdersResponse.parse(orders.map(orderResponse)));
});

router.post("/orders", async (req, res): Promise<void> => {
  const parsed = CreateOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [product] = await db
    .select()
    .from(productsTable)
    .where(eq(productsTable.id, parsed.data.productId));
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  const [order] = await db
    .insert(ordersTable)
    .values({
      token: randomBytes(4).toString("hex"),
      productId: product.id,
      productName: product.name,
      channel: parsed.data.channel,
      amount: parsed.data.amount.toFixed(2),
      depositAmount: parsed.data.depositAmount == null ? null : parsed.data.depositAmount.toFixed(2),
      paymentMode: parsed.data.paymentMode,
      status: "reserved",
      fulfillment: "pending",
      customerName: "Waiting for buyer",
    })
    .returning();
  res.status(201).json(CreateOrderResponse.parse(orderResponse(order)));
});

router.get("/orders/:id", async (req, res): Promise<void> => {
  const params = GetOrderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, params.data.id));
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  res.json(GetOrderResponse.parse(orderResponse(order)));
});

router.patch("/orders/:id", async (req, res): Promise<void> => {
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
  const [existing] = await db.select().from(ordersTable).where(eq(ordersTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  const [order] = await db
    .update(ordersTable)
    .set(parsed.data)
    .where(eq(ordersTable.id, params.data.id))
    .returning();
  if (parsed.data.status === "paid" && existing.status !== "paid") await adjustStock(existing.productId, -1);
  if (parsed.data.status !== "paid" && existing.status === "paid") await adjustStock(existing.productId, 1);
  res.json(UpdateOrderResponse.parse(orderResponse(order)));
});

router.get("/public/orders/:token", async (req, res): Promise<void> => {
  const params = GetPublicOrderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.token, params.data.token));
  if (!order) {
    res.status(404).json({ error: "Order link not found" });
    return;
  }
  const [updated] = await db
    .update(ordersTable)
    .set({ linkOpens: order.linkOpens + 1 })
    .where(eq(ordersTable.id, order.id))
    .returning();
  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, order.productId));
  res.json(GetPublicOrderResponse.parse(publicOrderResponse(updated, product)));
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
  const [existing] = await db.select().from(ordersTable).where(eq(ordersTable.token, params.data.token));
  if (!existing) {
    res.status(404).json({ error: "Order link not found" });
    return;
  }
  const shouldReserve = parsed.data.paymentAction === "reserve" || existing.paymentMode === "reserve";
  const nextStatus = shouldReserve
    ? "reserved"
    : existing.paymentMode === "deposit"
      ? "deposit_paid"
      : "paid";
  const [order] = await db
    .update(ordersTable)
    .set({
      customerName: parsed.data.customerName,
      customerPhone: parsed.data.customerPhone,
      buyerDetails: parsed.data.buyerDetails ?? null,
      referenceImage: parsed.data.referenceImage ?? null,
      status: nextStatus,
    })
    .where(eq(ordersTable.id, existing.id))
    .returning();
  if (nextStatus === "paid" && existing.status !== "paid") await adjustStock(existing.productId, -1);
  res.json(SubmitPublicOrderResponse.parse(orderResponse(order)));
});

router.get("/dashboard/summary", async (_req, res): Promise<void> => {
  const [products, orders] = await Promise.all([
    db.select().from(productsTable),
    db.select().from(ordersTable),
  ]);
  const paidOrders = orders.filter((order) => order.status === "paid" || order.status === "deposit_paid");
  const revenue = paidOrders.reduce(
    (sum, order) => sum + (order.status === "deposit_paid" ? Number(order.depositAmount ?? 0) : Number(order.amount)),
    0,
  );
  const outstanding = orders
    .filter((order) => order.status === "deposit_paid")
    .reduce((sum, order) => sum + Math.max(0, Number(order.amount) - Number(order.depositAmount ?? 0)), 0);
  const bestSeller = paidOrders.reduce<{ name: string; count: number }>(
    (best, order) => {
      const count = paidOrders.filter((item) => item.productId === order.productId).length;
      return count > best.count ? { name: order.productName, count } : best;
    },
    { name: "No sales yet", count: 0 },
  ).name;
  const channelPerformance = Object.entries(channelLabels).map(([channel, label]) => {
    const matching = orders.filter((order) => order.channel === channel);
    return {
      channel: label,
      revenue: matching
        .filter((order) => order.status !== "reserved")
        .reduce(
          (sum, order) => sum + (order.status === "deposit_paid" ? Number(order.depositAmount ?? 0) : Number(order.amount)),
          0,
        ),
      orders: matching.filter((order) => order.status !== "reserved").length,
      opens: matching.reduce((sum, order) => sum + order.linkOpens, 0),
    };
  }).filter((item) => item.orders > 0 || item.opens > 0);
  const lowStock = products.find((product) => product.stock <= 3);
  const insights = [
    bestSeller !== "No sales yet" ? `${bestSeller} is your best performer this week.` : "Create a Take Order link to start collecting your first sale.",
    lowStock ? `${lowStock.name} is down to ${lowStock.stock} left — consider restocking.` : "Your stock levels are healthy across the catalog.",
    outstanding > 0 ? `You have GH₵${outstanding.toFixed(0)} in outstanding balances to follow up.` : "No outstanding balances right now.",
  ];
  res.json(GetDashboardSummaryResponse.parse({
    revenue,
    orders: paidOrders.length,
    outstanding,
    bestSeller,
    channelPerformance,
    insights,
  }));
});

export default router;