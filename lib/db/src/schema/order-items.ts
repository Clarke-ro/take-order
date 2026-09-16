import { createInsertSchema } from "drizzle-zod";
import { integer, numeric, pgTable, serial, text } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const orderItemsTable = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull(),
  productId: integer("product_id").notNull(),
  productName: text("product_name").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  position: integer("position").notNull().default(0),
  buyerVariant: text("buyer_variant"),
  buyerDetails: text("buyer_details"),
  referenceImage: text("reference_image"),
});

export const insertOrderItemSchema = createInsertSchema(orderItemsTable).omit({ id: true });
export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;
export type OrderItem = typeof orderItemsTable.$inferSelect;