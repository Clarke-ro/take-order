import { createInsertSchema } from "drizzle-zod";
import { integer, jsonb, numeric, pgTable, serial, text } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export type ProductPreferenceGroup = {
  label: string;
  options: string[];
};

export type ProductCustomField = {
  label: string;
  value: string;
};

export const productsTable = pgTable("products", {
  id: serial("id").primaryKey(),
  ownerUserId: text("owner_user_id"),
  name: text("name").notNull(),
  category: text("category").notNull(),
  sku: text("sku"),
  description: text("description"),
  price: numeric("price", { precision: 12, scale: 2 }).notNull(),
  compareAtPrice: numeric("compare_at_price", { precision: 12, scale: 2 }),
  cost: numeric("cost", { precision: 12, scale: 2 }),
  stock: integer("stock").notNull().default(0),
  variants: text("variants").array().notNull().default([]),
  preferences: jsonb("preferences").$type<ProductPreferenceGroup[]>().notNull().default([]),
  customFields: jsonb("custom_fields").$type<ProductCustomField[]>().notNull().default([]),
  imageUrl: text("image_url"),
  imageUrls: text("image_urls").array().notNull().default([]),
  accent: text("accent").notNull().default("#0F6E6B"),
});

export const insertProductSchema = createInsertSchema(productsTable).omit({ id: true });
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof productsTable.$inferSelect;