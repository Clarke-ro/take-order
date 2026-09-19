import { createInsertSchema } from "drizzle-zod";
import { date, numeric, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const expensesTable = pgTable("expenses", {
  id: serial("id").primaryKey(),
  ownerUserId: text("owner_user_id"),
  title: text("title").notNull(),
  category: text("category").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  expenseDate: date("expense_date", { mode: "string" }).notNull(),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertExpenseSchema = createInsertSchema(expensesTable).omit({ id: true, createdAt: true });
export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type Expense = typeof expensesTable.$inferSelect;