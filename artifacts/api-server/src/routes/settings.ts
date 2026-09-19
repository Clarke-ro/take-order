import { eq } from "drizzle-orm";
import { Router, type IRouter, type RequestHandler } from "express";
import { sellerSettingsTable } from "@workspace/db/schema";
import {
  GetSellerSettingsResponse,
  UpdateSellerSettingsBody,
  UpdateSellerSettingsResponse,
} from "@workspace/api-zod";
import type { db } from "@workspace/db";

export const defaultSellerSettings = {
  sellerName: "",
  businessName: "",
  description: "",
  logoDataUrl: null,
  channels: [] as string[],
  currency: "GHS" as const,
  paymentMode: "reserve" as const,
  checkoutAskForDetails: true,
  checkoutAllowReferenceImages: true,
  deliveryDefault: "both" as const,
  deliveryFee: 0,
  customDomain: "",
  seoTitle: "",
  seoDescription: "",
  trackingId: "",
  organizationName: "",
  organizationEmail: "",
  organizationPhone: "",
  organizationCountry: "gh",
  organizationAddress: "",
  orderUpdates: true,
  stockAlerts: true,
  compactTables: false,
  connectedTools: [] as string[],
};

export async function readSellerSettings(database: typeof db, ownerUserId: string) {
  const [record] = await database
    .select()
    .from(sellerSettingsTable)
    .where(eq(sellerSettingsTable.ownerUserId, ownerUserId));
  return GetSellerSettingsResponse.parse({ ...defaultSellerSettings, ...(record?.settings ?? {}) });
}

export function createSettingsRouter(database: typeof db, requireSellerAuth: RequestHandler): IRouter {
  const router: IRouter = Router();
  const sellerId = (res: { locals: Record<string, unknown> }): string => {
    const value = res.locals.userId;
    if (typeof value !== "string") throw new Error("Authenticated seller identity is missing");
    return value;
  };

  router.get("/settings", requireSellerAuth, async (_req, res): Promise<void> => {
    res.json(GetSellerSettingsResponse.parse(await readSellerSettings(database, sellerId(res))));
  });

  router.put("/settings", requireSellerAuth, async (req, res): Promise<void> => {
    const parsed = UpdateSellerSettingsBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const ownerUserId = sellerId(res);
    const values = { ownerUserId, settings: parsed.data };
    const [record] = await database
      .insert(sellerSettingsTable)
      .values(values)
      .onConflictDoUpdate({
        target: sellerSettingsTable.ownerUserId,
        set: { settings: parsed.data },
      })
      .returning();
    res.json(UpdateSellerSettingsResponse.parse({ ...defaultSellerSettings, ...(record.settings ?? {}) }));
  });

  return router;
}