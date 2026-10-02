import { Router, type IRouter, type RequestHandler, type Response } from "express";
import { and, desc, eq } from "drizzle-orm";
import { expensesTable } from "@workspace/db/schema";
import type { db } from "@workspace/db";
import {
  CreateExpenseBody,
  CreateExpenseResponse,
  DeleteExpenseParams,
  ListExpensesResponse,
  UpdateExpenseBody,
  UpdateExpenseParams,
  UpdateExpenseResponse,
} from "@workspace/api-zod";

function sellerId(res: Response): string {
  const user = (res.locals.ownerUserId as string) || (res.locals.userId as string) || res.locals.auth?.userId;
  if (!user) throw new Error("Missing seller identity");
  return user;
}

export function expenseResponse(expense: typeof expensesTable.$inferSelect) {
  return {
    ...expense,
    amount: Number(expense.amount),
    date: expense.expenseDate,
    createdAt: expense.createdAt.toISOString(),
  };
}

export function createExpensesRouter(database: typeof db, requireSellerAuth: RequestHandler): IRouter {
  const router: IRouter = Router();

  router.get("/expenses", requireSellerAuth, async (_req, res): Promise<void> => {
    const expenses = await database.select().from(expensesTable)
      .where(eq(expensesTable.ownerUserId, sellerId(res)))
      .orderBy(desc(expensesTable.expenseDate), desc(expensesTable.id));
    res.json(ListExpensesResponse.parse(expenses.map(expenseResponse)));
  });

  router.post("/expenses", requireSellerAuth, async (req, res): Promise<void> => {
    const parsed = CreateExpenseBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [expense] = await database
      .insert(expensesTable)
      .values({
        ownerUserId: sellerId(res),
        title: parsed.data.title.trim(),
        category: parsed.data.category,
        amount: parsed.data.amount.toFixed(2),
        expenseDate: parsed.data.date,
        note: parsed.data.note?.trim() || null,
      })
      .returning();
    res.status(201).json(CreateExpenseResponse.parse(expenseResponse(expense)));
  });

  router.patch("/expenses/:id", requireSellerAuth, async (req, res): Promise<void> => {
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
      .where(and(eq(expensesTable.id, params.data.id), eq(expensesTable.ownerUserId, sellerId(res))))
      .returning();
    if (!expense) {
      res.status(404).json({ error: "Expense not found" });
      return;
    }
    res.json(UpdateExpenseResponse.parse(expenseResponse(expense)));
  });

  router.delete("/expenses/:id", requireSellerAuth, async (req, res): Promise<void> => {
    const params = DeleteExpenseParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const [expense] = await database
      .delete(expensesTable)
      .where(and(eq(expensesTable.id, params.data.id), eq(expensesTable.ownerUserId, sellerId(res))))
      .returning();
    if (!expense) {
      res.status(404).json({ error: "Expense not found" });
      return;
    }
    res.sendStatus(204);
  });

  return router;
}
