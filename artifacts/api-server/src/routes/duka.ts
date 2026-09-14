import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { db, expensesTable, ordersTable, productsTable } from "@workspace/db";
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
} from "../lib/dashboard-analytics";

const router: IRouter = Router();

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
    productCost: toNumber(order.productCost),
    depositAmount: toNumber(order.depositAmount),
    createdAt: order.createdAt.toISOString(),
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

const isSaleStatus = (status: string) =>
  status === "paid" || status === "deposit_paid";

async function productCostForSale(
  existing: typeof ordersTable.$inferSelect,
  nextStatus: string,
): Promise<string | null | undefined> {
  if (isSaleStatus(existing.status) || !isSaleStatus(nextStatus)) {
    return undefined;
  }
  const [product] = await db
    .select({ cost: productsTable.cost })
    .from(productsTable)
    .where(eq(productsTable.id, existing.productId));
  return product?.cost ?? null;
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

router.get("/expenses", async (_req, res): Promise<void> => {
  const expenses = await db.select().from(expensesTable).orderBy(desc(expensesTable.expenseDate), desc(expensesTable.id));
  res.json(ListExpensesResponse.parse(expenses.map(expenseResponse)));
});

router.post("/expenses", async (req, res): Promise<void> => {
  const parsed = CreateExpenseBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [expense] = await db
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
  const [expense] = await db
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
  const [expense] = await db
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
  const nextStatus = parsed.data.status ?? existing.status;
  const saleProductCost = await productCostForSale(existing, nextStatus);
  const [order] = await db
    .update(ordersTable)
    .set(
      saleProductCost === undefined
        ? parsed.data
        : { ...parsed.data, productCost: saleProductCost },
    )
    .where(eq(ordersTable.id, params.data.id))
    .returning();
  const stockDelta = stockDeltaForOrderStatusChange(existing.status, parsed.data.status ?? existing.status);
  if (stockDelta) await adjustStock(existing.productId, stockDelta);
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
  const saleProductCost = await productCostForSale(existing, nextStatus);
  const [order] = await db
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
  if (nextStatus === "paid" && existing.status !== "paid") await adjustStock(existing.productId, -1);
  res.json(SubmitPublicOrderResponse.parse(orderResponse(order)));
});

router.get("/dashboard/summary", async (_req, res): Promise<void> => {
  const [products, orders, operatingExpenseRows] = await Promise.all([
    db.select().from(productsTable),
    db.select().from(ordersTable),
    db.select().from(expensesTable),
  ]);
  res.json(GetDashboardSummaryResponse.parse(
    calculateDashboardSummary(products, orders, operatingExpenseRows),
  ));
});

export default router;