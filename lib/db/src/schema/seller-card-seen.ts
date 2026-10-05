import { index, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const sellerCardSeenTable = pgTable(
  "seller_card_seen",
  {
    id: serial("id").primaryKey(),
    ownerUserId: text("owner_user_id").notNull(),
    cardKey: text("card_key").notNull(),
    seenAt: timestamp("seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("seller_card_seen_owner_user_id_idx").on(table.ownerUserId),
    uniqueIndex("seller_card_seen_owner_card_idx").on(table.ownerUserId, table.cardKey),
  ],
);

export const insertSellerCardSeenSchema = createInsertSchema(sellerCardSeenTable).omit({ id: true });
export type InsertSellerCardSeen = z.infer<typeof insertSellerCardSeenSchema>;
export type SellerCardSeen = typeof sellerCardSeenTable.$inferSelect;
