import { Router, type IRouter } from "express";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import {
  expensesTable,
  orderItemsTable,
  ordersTable,
  productsTable,
} from "@workspace/db/schema";
import type { db } from "@workspace/db";
import {
  CreateProductBody,
  CreateProductResponse,
  CreateOrderBody,
  CreateOrderResponse,
  CreateExpenseBody,
  CreateExpenseResponse,
  DeleteExpenseParams,
  DeleteProductParams,
  GetDashboardSummaryResponse,
  GetOrderParams,
  GetOrderResponse,
  GetPublicOrderParams,
  GetPublicOrderResponse,
  ListOrdersResponse,
  ListProductsResponse,
  ListExpensesResponse,
  SubmitPublicOrderBody,
  SubmitPublicOrderParams,
  SubmitPublicOrderResponse,
  UpdateOrderEngagementBody,
  UpdateOrderEngagementResponse,
  UpdateOrderEngagementParams,
  UpdateOrderBody,
  UpdateOrderParams,
  UpdateOrderResponse,
  UpdateExpenseBody,
  UpdateExpenseParams,
  UpdateExpenseResponse,
  UpdateProductBody,
  UpdateProductParams,
  UpdateProductResponse,
} from "@workspace/api-zod";
import {
  calculateDashboardSummary,
  stockDeltaForOrderStatusChange,
  type DashboardRange,
} from "../lib/dashboard-analytics";

export function createDukaRouter(database: typeof db): IRouter {
  const router: IRouter = Router();

const toNumber = (value: string | number | null): number | null =>
  value == null ? null : Number(value);

type SellerOrderItem = {
  productId: number;
  productName: string;
  amount: number;
};

function productResponse(product: typeof productsTable.$inferSelect) {
  return {
    ...product,
    price: Number(product.price),
    cost: toNumber(product.cost),
    variants: product.variants ?? [],
  };
}

function orderResponse(order: typeof ordersTable.$inferSelect, items: SellerOrderItem[] = []) {
  return {
    ...order,
    amount: Number(order.amount),
    productCost: toNumber(order.productCost),
    depositAmount: toNumber(order.depositAmount),
    createdAt: order.createdAt.toISOString(),
    items: items.length > 0 ? items : [{
      productId: order.productId,
      productName: order.productName,
      amount: Number(order.amount),
    }],
  };
}

function expenseResponse(expense: typeof expensesTable.$inferSelect) {
  return {
    ...expense,
    amount: Number(expense.amount),
    date: expense.expenseDate,
    createdAt: expense.createdAt.toISOString(),
  };
}

async function sellerItemsForOrder(order: typeof ordersTable.$inferSelect): Promise<SellerOrderItem[]> {
  const storedItems = await database
    .select()
    .from(orderItemsTable)
    .where(eq(orderItemsTable.orderId, order.id))
    .orderBy(asc(orderItemsTable.position), asc(orderItemsTable.id));

  return storedItems.map((item) => ({
    productId: item.productId,
    productName: item.productName,
    amount: Number(item.amount),
  }));
}

async function sellerItemsForOrders(orders: Array<typeof ordersTable.$inferSelect>) {
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
    });
    byOrder.set(item.orderId, current);
  }
  return byOrder;
}

function publicOrderResponse(
  order: typeof ordersTable.$inferSelect,
  items: Array<{
    productId: number;
    productName: string;
    amount: number;
    variants: string[];
  }>,
) {
  return {
    token: order.token,
    productName: order.productName,
    amount: Number(order.amount),
    depositAmount: toNumber(order.depositAmount),
    paymentMode: order.paymentMode,
    status: order.status,
    variants: items[0]?.variants ?? [],
    items,
  };
}

async function publicItemsForOrder(order: typeof ordersTable.$inferSelect) {
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
      variants: product?.variants ?? [],
    }];
  }

  const productIds = [...new Set(storedItems.map((item) => item.productId))];
  const products = await database
    .select()
    .from(productsTable)
    .where(inArray(productsTable.id, productIds));
  const productsById = new Map(products.map((product) => [product.id, product]));

  return storedItems.map((item) => ({
    productId: item.productId,
    productName: item.productName,
    amount: Number(item.amount),
    variants: productsById.get(item.productId)?.variants ?? [],
  }));
}

async function adjustStock(productId: number, direction: number) {
  const [product] = await database
    .select()
    .from(productsTable)
    .where(eq(productsTable.id, productId));
  if (!product) return;
  await database
    .update(productsTable)
    .set({ stock: Math.max(0, product.stock + direction) })
    .where(eq(productsTable.id, productId));
}

async function adjustOrderStock(order: typeof ordersTable.$inferSelect, direction: number) {
  const items = await database
    .select({ productId: orderItemsTable.productId })
    .from(orderItemsTable)
    .where(eq(orderItemsTable.orderId, order.id))
    .orderBy(asc(orderItemsTable.position), asc(orderItemsTable.id));

  if (items.length === 0) {
    await adjustStock(order.productId, direction);
    return;
  }

  for (const item of items) {
    await adjustStock(item.productId, direction);
  }
}

const isSaleStatus = (status: string) =>
  status === "paid" || status === "deposit_paid";

async function productCostForSale(
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
  const items = await database
    .select({ productId: orderItemsTable.productId })
    .from(orderItemsTable)
    .where(eq(orderItemsTable.orderId, existing.id))
    .orderBy(asc(orderItemsTable.position), asc(orderItemsTable.id));
  const productIds = items.length > 0 ? items.map((item) => item.productId) : [existing.productId];
  const products = await database
    .select({ id: productsTable.id, cost: productsTable.cost })
    .from(productsTable)
    .where(inArray(productsTable.id, [...new Set(productIds)]));
  const costs = productIds.map((productId) => products.find((product) => product.id === productId)?.cost ?? null);
  if (costs.some((cost) => cost === null)) return null;
  return costs.reduce((total, cost) => total + Number(cost), 0).toFixed(2);
}

router.get("/products", async (_req, res): Promise<void> => {
  const products = await database.select().from(productsTable).orderBy(productsTable.id);
  res.json(ListProductsResponse.parse(products.map(productResponse)));
});

router.post("/products", async (req, res): Promise<void> => {
  const parsed = CreateProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [product] = await database
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
  const [product] = await database
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
  const [product] = await database
    .delete(productsTable)
    .where(eq(productsTable.id, params.data.id))
    .returning();
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  res.sendStatus(204);
});

router.get("/expenses", async (_req, res): Promise<void> => {
  const expenses = await database.select().from(expensesTable).orderBy(desc(expensesTable.expenseDate), desc(expensesTable.id));
  res.json(ListExpensesResponse.parse(expenses.map(expenseResponse)));
});

router.post("/expenses", async (req, res): Promise<void> => {
  const parsed = CreateExpenseBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [expense] = await database
    .insert(expensesTable)
    .values({
      title: parsed.data.title.trim(),
      category: parsed.data.category,
      amount: parsed.data.amount.toFixed(2),
      expenseDate: parsed.data.date,
      note: parsed.data.note?.trim() || null,
    })
    .returning();
  res.status(201).json(CreateExpenseResponse.parse(expenseResponse(expense)));
});

router.patch("/expenses/:id", async (req, res): Promise<void> => {
  const params = UpdateExpenseParams.safeParse(req.params);
  const parsed = UpdateExpenseBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const update: {
    title?: string;
    category?: string;
    amount?: string;
    expenseDate?: string;
    note?: string | null;
  } = {};
  if (parsed.data.title !== undefined) update.title = parsed.data.title.trim();
  if (parsed.data.category !== undefined) update.category = parsed.data.category;
  if (parsed.data.amount !== undefined) update.amount = parsed.data.amount.toFixed(2);
  if (parsed.data.date !== undefined) update.expenseDate = parsed.data.date;
  if (parsed.data.note !== undefined) update.note = parsed.data.note?.trim() || null;
  const [expense] = await database
    .update(expensesTable)
    .set(update)
    .where(eq(expensesTable.id, params.data.id))
    .returning();
  if (!expense) {
    res.status(404).json({ error: "Expense not found" });
    return;
  }
  res.json(UpdateExpenseResponse.parse(expenseResponse(expense)));
});

router.delete("/expenses/:id", async (req, res): Promise<void> => {
  const params = DeleteExpenseParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [expense] = await database
    .delete(expensesTable)
    .where(eq(expensesTable.id, params.data.id))
    .returning();
  if (!expense) {
    res.status(404).json({ error: "Expense not found" });
    return;
  }
  res.sendStatus(204);
});

router.get("/orders", async (_req, res): Promise<void> => {
  const orders = await database.select().from(ordersTable).orderBy(desc(ordersTable.createdAt));
  const itemsByOrder = await sellerItemsForOrders(orders);
  res.json(ListOrdersResponse.parse(orders.map((order) => orderResponse(order, itemsByOrder.get(order.id)))));
});

router.post("/orders", async (req, res): Promise<void> => {
  const parsed = CreateOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const requestedItems = parsed.data.items?.length
    ? parsed.data.items
    : parsed.data.productId != null && parsed.data.amount != null
      ? [{ productId: parsed.data.productId, amount: parsed.data.amount }]
      : null;
  if (!requestedItems?.length) {
    res.status(400).json({ error: "At least one order item is required" });
    return;
  }
  const productIds = [...new Set(requestedItems.map((item) => item.productId))];
  const products = await database
    .select()
    .from(productsTable)
    .where(inArray(productsTable.id, productIds));
  const productsById = new Map(products.map((product) => [product.id, product]));
  const missingProduct = requestedItems.find((item) => !productsById.has(item.productId));
  if (missingProduct) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  const totalAmount = requestedItems.reduce((total, item) => total + item.amount, 0);
  if (parsed.data.depositAmount != null && parsed.data.depositAmount > totalAmount) {
    res.status(400).json({ error: "Deposit cannot exceed the order total" });
    return;
  }
  const firstProduct = productsById.get(requestedItems[0].productId)!;
  const [order] = await database
    .insert(ordersTable)
    .values({
      token: randomBytes(4).toString("hex"),
      productId: firstProduct.id,
      productName: requestedItems.length === 1
        ? firstProduct.name
        : `${firstProduct.name} + ${requestedItems.length - 1} more`,
      channel: parsed.data.channel,
      amount: totalAmount.toFixed(2),
      depositAmount: parsed.data.depositAmount == null ? null : parsed.data.depositAmount.toFixed(2),
      paymentMode: parsed.data.paymentMode,
      status: "reserved",
      fulfillment: "pending",
      customerName: "Waiting for buyer",
    })
    .returning();
  await database.insert(orderItemsTable).values(
    requestedItems.map((item, position) => ({
      orderId: order.id,
      productId: item.productId,
      productName: productsById.get(item.productId)!.name,
      amount: item.amount.toFixed(2),
      position,
    })),
  );
  const items = await sellerItemsForOrder(order);
  res.status(201).json(CreateOrderResponse.parse(orderResponse(order, items)));
});

router.get("/orders/:id", async (req, res): Promise<void> => {
  const params = GetOrderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [order] = await database.select().from(ordersTable).where(eq(ordersTable.id, params.data.id));
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  const items = await sellerItemsForOrder(order);
  res.json(GetOrderResponse.parse(orderResponse(order, items)));
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
  const [existing] = await database.select().from(ordersTable).where(eq(ordersTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  const nextStatus = parsed.data.status ?? existing.status;
  const saleProductCost = await productCostForSale(existing, nextStatus);
  const [order] = await database
    .update(ordersTable)
    .set(
      saleProductCost === undefined
        ? parsed.data
        : { ...parsed.data, productCost: saleProductCost },
    )
    .where(eq(ordersTable.id, params.data.id))
    .returning();
  const stockDelta = stockDeltaForOrderStatusChange(existing.status, parsed.data.status ?? existing.status);
  if (stockDelta) await adjustOrderStock(existing, stockDelta);
  const items = await sellerItemsForOrder(order);
  res.json(UpdateOrderResponse.parse(orderResponse(order, items)));
});

router.patch("/orders/:id/engagement", async (req, res): Promise<void> => {
  const params = UpdateOrderEngagementParams.safeParse(req.params);
  const parsed = UpdateOrderEngagementBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [order] = await database
    .update(ordersTable)
    .set({
      shares: parsed.data.shares,
      likes: parsed.data.likes,
      engagementSource: parsed.data.shares == null && parsed.data.likes == null
        ? null
        : "manual_import",
    })
    .where(eq(ordersTable.id, params.data.id))
    .returning();
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  const items = await sellerItemsForOrder(order);
  res.json(UpdateOrderEngagementResponse.parse(orderResponse(order, items)));
});

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
  const [updated] = await database
    .update(ordersTable)
    .set({ linkOpens: order.linkOpens + 1 })
    .where(eq(ordersTable.id, order.id))
    .returning();
  const items = await publicItemsForOrder(updated);
  res.json(GetPublicOrderResponse.parse(publicOrderResponse(updated, items)));
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
  const nextStatus = shouldReserve
    ? "reserved"
    : existing.paymentMode === "deposit"
      ? "deposit_paid"
      : "paid";
  const saleProductCost = await productCostForSale(existing, nextStatus);
  const [order] = await database
    .update(ordersTable)
    .set({
      customerName: parsed.data.customerName,
      customerPhone: parsed.data.customerPhone,
      buyerDetails: parsed.data.buyerDetails ?? null,
      referenceImage: parsed.data.referenceImage ?? null,
      status: nextStatus,
      ...(saleProductCost === undefined ? {} : { productCost: saleProductCost }),
    })
    .where(eq(ordersTable.id, existing.id))
    .returning();
  if (nextStatus === "paid" && existing.status !== "paid") await adjustOrderStock(existing, -1);
  res.json(SubmitPublicOrderResponse.parse(orderResponse(order)));
});

  router.get("/dashboard/summary", async (req, res): Promise<void> => {
   const parseDateQuery = (value: unknown): string | undefined => {
     if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
     const parsed = new Date(`${value}T00:00:00.000Z`);
     return Number.isNaN(parsed.getTime()) ? undefined : value;
   };
   const rawFrom = req.query.from;
   const rawTo = req.query.to;
   const from = parseDateQuery(rawFrom);
   const to = parseDateQuery(rawTo);
   if ((rawFrom !== undefined && from === undefined) || (rawTo !== undefined && to === undefined)) {
     res.status(400).json({ message: "Dashboard dates must use YYYY-MM-DD." });
     return;
   }
   if (from && to && from > to) {
     res.status(400).json({ message: "Dashboard start date must be before its end date." });
     return;
   }
   const range: DashboardRange | undefined = from || to ? { from, to } : undefined;
  const [products, orders, operatingExpenseRows] = await Promise.all([
    database.select().from(productsTable),
    database.select().from(ordersTable),
    database.select().from(expensesTable),
  ]);
  res.json(GetDashboardSummaryResponse.parse(
    calculateDashboardSummary(products, orders, operatingExpenseRows, new Date(), range),
  ));
});

  return router;
}
