import { createInsertSchema } from "drizzle-zod";
import { index, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const reportFavoritesTable = pgTable(
  "report_favorites",
  {
    id: serial("id").primaryKey(),
    ownerUserId: text("owner_user_id").notNull(),
    reportSlug: text("report_slug").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("report_favorites_owner_user_id_idx").on(table.ownerUserId),
    uniqueIndex("report_favorites_owner_slug_idx").on(table.ownerUserId, table.reportSlug),
  ],
);

export const insertReportFavoriteSchema = createInsertSchema(reportFavoritesTable).omit({ id: true, createdAt: true });
export type InsertReportFavorite = z.infer<typeof insertReportFavoriteSchema>;
export type ReportFavorite = typeof reportFavoritesTable.$inferSelect;
