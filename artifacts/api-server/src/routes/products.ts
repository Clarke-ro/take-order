import { Router, type IRouter, type RequestHandler, type Response } from "express";
import { and, eq } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { productsTable } from "@workspace/db/schema";
import type { ProductCustomField, ProductPreferenceGroup } from "@workspace/db/schema";
import type { db } from "@workspace/db";
import {
  CreateProductBody,
  CreateProductResponse,
  DeleteProductParams,
  ListProductsResponse,
  UpdateProductBody,
  UpdateProductParams,
  UpdateProductResponse,
} from "@workspace/api-zod";
import { logger } from "../lib/logger";
import { uploadFileToStorage } from "../lib/storage";

function sellerId(res: Response): string {
  const user = res.locals.ownerUserId || res.locals.auth?.userId;
  if (!user) throw new Error("Missing seller identity");
  return user;
}

const toNumber = (val: string | number | null | undefined): number | null => {
  if (val == null) return null;
  const num = Number(val);
  return Number.isNaN(num) ? null : num;
};

export function preferencesForProduct(
  preferences: ProductPreferenceGroup[] | null | undefined,
  variants: string[] = [],
): ProductPreferenceGroup[] {
  const isSizeOption = (value: string) => /^(xxxs?|[smlx]{1,4}|small|medium|large|extra small|extra large|one size)$/i.test(value.trim());
  const colorWords = new Set([
    "aqua", "beige", "black", "blue", "bronze", "brown", "burgundy", "camel",
    "charcoal", "clay", "clear", "cobalt", "coral", "cream", "cyan", "gold",
    "gray", "grey", "green", "ivory", "khaki", "lavender", "lilac", "magenta",
    "maroon", "mint", "navy", "nude", "olive", "orange", "peach", "pink",
    "purple", "red", "rose", "rust", "sage", "salmon", "silver", "tan",
    "teal", "transparent", "turquoise", "violet", "white", "wine", "yellow",
  ]);
  const isColorOption = (value: string) => {
    const normalized = value.trim().toLowerCase();
    if (/^#[0-9a-f]{3,8}$/i.test(normalized)) return true;
    return normalized.split(/[\s/&-]+/).filter(Boolean).every((word) => colorWords.has(word) || word === "light" || word === "dark");
  };
  const isLegacyChoiceGroup = (label: string) => label.trim().toLowerCase() === "choose an option";
  const normalizeGroups = (groups: ProductPreferenceGroup[]): ProductPreferenceGroup[] => {
    const normalized = groups.flatMap((group) => {
      const sizeOptions = group.options.filter(isSizeOption);
      const otherOptions = group.options.filter((option) => !isSizeOption(option));
      if (isLegacyChoiceGroup(group.label) && sizeOptions.length === group.options.length) {
        return [{ ...group, label: "Size" }];
      }
      if (isLegacyChoiceGroup(group.label) && sizeOptions.length > 0 && otherOptions.length > 0 && otherOptions.every(isColorOption)) {
        return [
          { label: "Color", options: otherOptions },
          { label: "Size", options: sizeOptions },
        ];
      }
      return [group];
    });
    return normalized.sort((left, right) => Number(left.label.trim().toLowerCase() === "size") - Number(right.label.trim().toLowerCase() === "size"));
  };
  const validPreferences = Array.isArray(preferences)
    ? normalizeGroups(
      preferences
        .map((group) => ({
          label: typeof group?.label === "string" ? group.label.trim() : "",
          options: Array.isArray(group?.options)
            ? group.options.filter((option): option is string => typeof option === "string").map((option) => option.trim()).filter(Boolean)
            : [],
        }))
        .filter((group) => group.label && group.options.length > 0),
    )
    : [];

  if (validPreferences.length > 0) return validPreferences;

  const validVariants = Array.isArray(variants)
    ? variants.filter((v): v is string => typeof v === "string").map((v) => v.trim()).filter(Boolean)
    : [];
  if (validVariants.length === 0) return [];

  const sizeVariants = validVariants.filter(isSizeOption);
  const otherVariants = validVariants.filter((variant) => !isSizeOption(variant));
  if (sizeVariants.length > 0 && otherVariants.length > 0 && otherVariants.every(isColorOption)) {
    return [
      { label: "Color", options: otherVariants },
      { label: "Size", options: sizeVariants },
    ];
  }
  return [{ label: "Option", options: validVariants }];
}

export function isReusableCatalogProduct(product: { category?: string | null }): boolean {
  return product.category?.trim().toLowerCase() !== "custom order";
}

export function productResponse(product: typeof productsTable.$inferSelect) {
  const imageUrls = Array.isArray(product.imageUrls) && product.imageUrls.length > 0
    ? product.imageUrls
    : product.imageUrl
      ? [product.imageUrl]
      : [];
  return {
    ...product,
    sku: product.sku ?? null,
    description: product.description ?? null,
    price: Number(product.price),
    compareAtPrice: toNumber(product.compareAtPrice),
    cost: toNumber(product.cost),
    variants: product.variants ?? [],
    preferences: preferencesForProduct(product.preferences, product.variants ?? []),
    customFields: product.customFields ?? [],
    imageUrl: product.imageUrl ?? null,
    imageUrls,
  };
}

export async function normalizeProductImageUrl(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  if (!url.startsWith("data:image/")) return url;
  try {
    const match = url.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return url;
    const contentType = match[1].toLowerCase().trim();
    const buffer = Buffer.from(match[2], "base64");
    const result = await uploadFileToStorage({
      buffer,
      filename: `product-${Date.now()}-${randomBytes(4).toString("hex")}.${contentType.split("/")[1] || "png"}`,
      contentType,
    });
    return result.url;
  } catch {
    // If Supabase storage is not configured or upload fails, keep the base64 URL as fallback
    return url;
  }
}

export function createProductsRouter(database: typeof db, requireSellerAuth: RequestHandler): IRouter {
  const router: IRouter = Router();

  router.get("/products", requireSellerAuth, async (_req, res): Promise<void> => {
    const products = await database.select().from(productsTable)
      .where(eq(productsTable.ownerUserId, sellerId(res)))
      .orderBy(productsTable.id);
    res.json(ListProductsResponse.parse(products.filter(isReusableCatalogProduct).map(productResponse)));
  });

  router.post("/products", requireSellerAuth, async (req, res): Promise<void> => {
    const parsed = CreateProductBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    try {
      const ownerUserId = sellerId(res);

      let imageUrl = parsed.data.imageUrl ?? null;
      let imageUrls = parsed.data.imageUrls ?? [];
      if (imageUrl && imageUrl.startsWith("data:image/")) {
        imageUrl = await normalizeProductImageUrl(imageUrl);
      }
      if (imageUrls.length > 0) {
        imageUrls = await Promise.all(
          imageUrls.map((u) => (u && u.startsWith("data:image/") ? normalizeProductImageUrl(u).then((res) => res || u) : Promise.resolve(u)))
        );
      }
      if (!imageUrl && imageUrls.length > 0) {
        imageUrl = imageUrls[0];
      }
      if (imageUrl && imageUrls.length === 0) {
        imageUrls = [imageUrl];
      }

      const [product] = await database
        .insert(productsTable)
        .values({
          ownerUserId,
          ...parsed.data,
          sku: parsed.data.sku?.trim() || null,
          description: parsed.data.description?.trim() || null,
          price: parsed.data.price.toFixed(2),
          compareAtPrice: parsed.data.compareAtPrice == null ? null : parsed.data.compareAtPrice.toFixed(2),
          cost: parsed.data.cost == null ? null : parsed.data.cost.toFixed(2),
          variants: parsed.data.variants ?? [],
          preferences: parsed.data.preferences ?? [],
          customFields: parsed.data.customFields ?? [],
          imageUrl,
          imageUrls,
          accent: parsed.data.accent ?? "#0F6E6B",
        })
        .returning();
      res.status(201).json(CreateProductResponse.parse(productResponse(product)));
    } catch (err: unknown) {
      const rootMessage = (err as any)?.cause?.message || (err instanceof Error ? err.message : "Failed to create product");
      logger.error({ err, rootMessage }, "Error creating product in catalog");
      res.status(500).json({ error: rootMessage });
    }
  });

  router.patch("/products/:id", requireSellerAuth, async (req, res): Promise<void> => {
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
    try {
      const update: {
        name?: string;
        category?: string;
        sku?: string | null;
        description?: string | null;
        price?: string;
        compareAtPrice?: string | null;
        cost?: string | null;
        stock?: number;
        variants?: string[];
        preferences?: ProductPreferenceGroup[];
        customFields?: ProductCustomField[];
        imageUrl?: string | null;
        imageUrls?: string[];
        accent?: string;
      } = {};
      if (parsed.data.name !== undefined) update.name = parsed.data.name;
      if (parsed.data.category !== undefined) update.category = parsed.data.category;
      if (parsed.data.sku !== undefined) update.sku = parsed.data.sku?.trim() || null;
      if (parsed.data.description !== undefined) update.description = parsed.data.description?.trim() || null;
      if (parsed.data.price !== undefined) update.price = parsed.data.price.toFixed(2);
      if (parsed.data.compareAtPrice !== undefined) update.compareAtPrice = parsed.data.compareAtPrice == null ? null : parsed.data.compareAtPrice.toFixed(2);
      if (parsed.data.cost !== undefined) update.cost = parsed.data.cost == null ? null : parsed.data.cost.toFixed(2);
      if (parsed.data.stock !== undefined) update.stock = parsed.data.stock;
      if (parsed.data.variants !== undefined) {
        update.variants = parsed.data.variants;
        if (parsed.data.preferences === undefined) update.preferences = [];
      }
      if (parsed.data.preferences !== undefined) {
        update.preferences = parsed.data.preferences;
        update.variants = parsed.data.preferences.flatMap((group) => group.options);
      }
      if (parsed.data.customFields !== undefined) update.customFields = parsed.data.customFields;
      if (parsed.data.imageUrl !== undefined) {
        update.imageUrl = parsed.data.imageUrl ? await normalizeProductImageUrl(parsed.data.imageUrl) : null;
      }
      if (parsed.data.imageUrls !== undefined) {
        update.imageUrls = await Promise.all(
          parsed.data.imageUrls.map((u) => (u && u.startsWith("data:image/") ? normalizeProductImageUrl(u).then((res) => res || u) : Promise.resolve(u)))
        );
      }
      if (parsed.data.accent !== undefined) update.accent = parsed.data.accent;
      const [product] = await database
        .update(productsTable)
        .set(update)
        .where(and(eq(productsTable.id, params.data.id), eq(productsTable.ownerUserId, sellerId(res))))
        .returning();
      if (!product) {
        res.status(404).json({ error: "Product not found" });
        return;
      }
      res.json(UpdateProductResponse.parse(productResponse(product)));
    } catch (err: unknown) {
      const rootMessage = (err as any)?.cause?.message || (err instanceof Error ? err.message : "Failed to update product");
      logger.error({ err, rootMessage }, "Error updating product in catalog");
      res.status(500).json({ error: rootMessage });
    }
  });

  router.delete("/products/:id", requireSellerAuth, async (req, res): Promise<void> => {
    const params = DeleteProductParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const [product] = await database
      .delete(productsTable)
      .where(and(eq(productsTable.id, params.data.id), eq(productsTable.ownerUserId, sellerId(res))))
      .returning();
    if (!product) {
      res.status(404).json({ error: "Product not found" });
      return;
    }
    res.sendStatus(204);
  });

  return router;
}
