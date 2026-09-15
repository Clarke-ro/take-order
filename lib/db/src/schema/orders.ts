import { createInsertSchema } from "drizzle-zod";
import { integer, numeric, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const ordersTable = pgTable("orders", {
  id: serial("id").primaryKey(),
  token: text("token").notNull().unique(),
  productId: integer("product_id").notNull(),
  productName: text("product_name").notNull(),
  customerName: text("customer_name").notNull().default("Waiting for buyer"),
  customerPhone: text("customer_phone"),
  channel: text("channel").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  productCost: numeric("product_cost", { precision: 12, scale: 2 }),
  depositAmount: numeric("deposit_amount", { precision: 12, scale: 2 }),
  paymentMode: text("payment_mode").notNull(),
  status: text("status").notNull().default("reserved"),
  fulfillment: text("fulfillment").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  linkOpens: integer("link_opens").notNull().default(0),
  shares: integer("shares"),
  likes: integer("likes"),
  referenceImage: text("reference_image"),
  buyerDetails: text("buyer_details"),
});

export const insertOrderSchema = createInsertSchema(ordersTable).omit({ id: true, createdAt: true });
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof ordersTable.$inferSelect;