import { createInsertSchema } from "drizzle-zod";
import { jsonb, pgTable, serial, text } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const sellerSettingsTable = pgTable("seller_settings", {
  id: serial("id").primaryKey(),
  ownerUserId: text("owner_user_id").notNull().unique(),
  settings: jsonb("settings").$type<Record<string, unknown>>().notNull().default({}),
});

export const insertSellerSettingsSchema = createInsertSchema(sellerSettingsTable).omit({ id: true });
export type InsertSellerSettings = z.infer<typeof insertSellerSettingsSchema>;
export type SellerSettingsRecord = typeof sellerSettingsTable.$inferSelect;