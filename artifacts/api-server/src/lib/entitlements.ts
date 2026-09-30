import { and, eq, ne } from "drizzle-orm";
import {
  ordersTable,
  productsTable,
  sellerSettingsTable,
} from "@workspace/db/schema";
import type { db } from "@workspace/db";
import {
  type PlanTier,
  type PlanCapabilities,
  PLAN_DEFINITIONS,
  FREE_CATALOG_LIMIT,
  FREE_ACTIVE_LINK_LIMIT,
  PRO_ACTIVE_LINK_LIMIT,
  TRIAL_DURATION_DAYS,
  hasReachedCatalogLimit,
  hasReachedActiveLinkLimit,
  getTrialDaysRemaining,
  isTrialActive,
} from "@workspace/api-zod";
import { logger } from "./logger";

/**
 * RevenueCat Server API Credential.
 * The REST API endpoint (/v1/subscribers/{app_user_id}) requires a RevenueCat Project Secret API Key
 * (created under Project Settings > API Keys in RevenueCat dashboard with read/write subscriber permissions).
 */
export const REVENUECAT_SECRET_KEY =
  process.env.REVENUECAT_SECRET_KEY ||
  process.env.REVENUECAT_API_KEY ||
  "";

export const REVENUECAT_API_KEY = REVENUECAT_SECRET_KEY;

export const PRO_ENTITLEMENT_ID = "take_order_app_pro";
export const PRO_PLUS_ENTITLEMENT_ID = "take_order_app_pro_plus";

export type SellerEntitlementState = {
  tier: PlanTier;
  capabilities: PlanCapabilities;
  trial: {
    isTrial: boolean;
    daysRemaining: number;
    startedAt: string;
    expiresAt: string;
  };
  revenueCat: {
    active: boolean;
    tier: "none" | "pro" | "pro_plus";
    entitlementId: string | null;
  };
  usage: {
    catalogProductCount: number;
    activeLinkCount: number;
  };
  limits: {
    catalogLimit: PlanCapabilities["catalogLimit"];
    activeLinkLimit: PlanCapabilities["activeLinkLimit"];
    catalogLimitReached: boolean;
    activeLinkLimitReached: boolean;
  };
};

/**
 * In-memory cache for RevenueCat subscriber status (60s TTL).
 * ARCHITECTURE ASSUMPTION: Per-process cache.
 * In a single-dyno staging setup, webhook-driven cache invalidation clears this process.
 * Multiple dynos/processes in production would require a shared cache (e.g. Redis) or
 * cross-process pub/sub invalidation.
 */
type CacheEntry = {
  tier: "none" | "pro" | "pro_plus";
  entitlementId: string | null;
  timestamp: number;
};
const revenueCatCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60 * 1000;

export function invalidateRevenueCatCache(appUserId?: string): void {
  if (appUserId) {
    revenueCatCache.delete(appUserId);
  } else {
    revenueCatCache.clear();
  }
}

export function setCachedRevenueCatSubscriber(
  appUserId: string,
  tier: "none" | "pro" | "pro_plus",
  entitlementId: string | null = null,
): void {
  revenueCatCache.set(appUserId, {
    tier,
    entitlementId,
    timestamp: Date.now(),
  });
}

export async function checkRevenueCatSubscription(
  appUserId: string,
  timeoutMs: number = 2500
): Promise<{ tier: "none" | "pro" | "pro_plus"; entitlementId: string | null }> {
  if (!appUserId || appUserId === "guest_seller" || appUserId === "test-user") {
    return { tier: "none", entitlementId: null };
  }

  const cached = revenueCatCache.get(appUserId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return { tier: cached.tier, entitlementId: cached.entitlementId };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${REVENUECAT_API_KEY}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return { tier: "none", entitlementId: null };
    }

    const data: any = await res.json();
    const activeEntitlements = data?.subscriber?.entitlements ?? {};

    let tier: "none" | "pro" | "pro_plus" = "none";
    let entitlementId: string | null = null;

    const proPlus = activeEntitlements[PRO_PLUS_ENTITLEMENT_ID];
    const pro = activeEntitlements[PRO_ENTITLEMENT_ID];

    const isEntitlementActive = (ent: any): boolean => {
      if (!ent) return false;
      if (ent.expires_date) {
        return new Date(ent.expires_date).getTime() > Date.now();
      }
      return true;
    };

    if (isEntitlementActive(proPlus)) {
      tier = "pro_plus";
      entitlementId = PRO_PLUS_ENTITLEMENT_ID;
    } else if (isEntitlementActive(pro)) {
      tier = "pro";
      entitlementId = PRO_ENTITLEMENT_ID;
    }

    revenueCatCache.set(appUserId, {
      tier,
      entitlementId,
      timestamp: Date.now(),
    });

    return { tier, entitlementId };
  } catch (err) {
    logger.warn({ err, appUserId }, "Failed to fetch subscriber status from RevenueCat");
    return { tier: "none", entitlementId: null };
  }
}

/**
 * Resolves the complete authoritative entitlement and plan status for a seller.
 */
export async function resolveSellerEntitlement(
  database: typeof db,
  ownerUserId: string,
  options: { skipRevenueCat?: boolean; mockTier?: PlanTier } = {}
): Promise<SellerEntitlementState> {
  const now = new Date();

  // 1. Fetch or initialize seller settings to track account / trial creation time
  let [record] = await database
    .select()
    .from(sellerSettingsTable)
    .where(eq(sellerSettingsTable.ownerUserId, ownerUserId));

  let settings = (record?.settings ?? {}) as Record<string, any>;
  let trialStartedAtStr: string = settings.trialStartedAt;

  if (!trialStartedAtStr) {
    trialStartedAtStr = now.toISOString();
    try {
      const updatedSettings = { ...settings, trialStartedAt: trialStartedAtStr };
      await database
        .insert(sellerSettingsTable)
        .values({
          ownerUserId,
          settings: updatedSettings,
        })
        .onConflictDoUpdate({
          target: sellerSettingsTable.ownerUserId,
          set: { settings: updatedSettings },
        });
      settings = updatedSettings;
    } catch {
      // ignore persistence error in readonly/mock mode
    }
  }

  const trialStartedAt = new Date(trialStartedAtStr);
  const trialExpiresAt = new Date(trialStartedAt.getTime() + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000);
  const trialActive = now.getTime() < trialExpiresAt.getTime();
  const trialDaysRemaining = getTrialDaysRemaining(trialStartedAt, now);

  // 2. Check RevenueCat active subscriptions
  let rcTier: "none" | "pro" | "pro_plus" = "none";
  let rcEntitlementId: string | null = null;

  if (!options.skipRevenueCat && !options.mockTier) {
    const rcResult = await checkRevenueCatSubscription(ownerUserId);
    rcTier = rcResult.tier;
    rcEntitlementId = rcResult.entitlementId;
  }

  // 3. Determine authoritative tier
  let resolvedTier: PlanTier;
  if (options.mockTier) {
    resolvedTier = options.mockTier;
  } else if (rcTier === "pro_plus") {
    resolvedTier = "pro_plus";
  } else if (rcTier === "pro") {
    resolvedTier = "pro";
  } else if (trialActive) {
    resolvedTier = "trial";
  } else {
    resolvedTier = "free";
  }

  const capabilities = PLAN_DEFINITIONS[resolvedTier] || PLAN_DEFINITIONS.free;

  // 4. Query current seller usage
  // Catalog products (excluding one-off custom order lines)
  const products = await database
    .select({ id: productsTable.id, category: productsTable.category })
    .from(productsTable)
    .where(and(eq(productsTable.ownerUserId, ownerUserId), ne(productsTable.category, "Custom order")));

  const catalogProductCount = products.length;

  // Active Take Order links (orders where status != 'cancelled')
  const activeOrders = await database
    .select({ id: ordersTable.id, status: ordersTable.status })
    .from(ordersTable)
    .where(and(eq(ordersTable.ownerUserId, ownerUserId), ne(ordersTable.status, "cancelled")));

  const activeLinkCount = activeOrders.length;

  const catalogLimitReached = hasReachedCatalogLimit(catalogProductCount, resolvedTier);
  const activeLinkLimitReached = hasReachedActiveLinkLimit(activeLinkCount, resolvedTier);

  return {
    tier: resolvedTier,
    capabilities,
    trial: {
      isTrial: resolvedTier === "trial",
      daysRemaining: trialDaysRemaining,
      startedAt: trialStartedAt.toISOString(),
      expiresAt: trialExpiresAt.toISOString(),
    },
    revenueCat: {
      active: rcTier !== "none",
      tier: rcTier,
      entitlementId: rcEntitlementId,
    },
    usage: {
      catalogProductCount,
      activeLinkCount,
    },
    limits: {
      catalogLimit: capabilities.catalogLimit,
      activeLinkLimit: capabilities.activeLinkLimit,
      catalogLimitReached,
      activeLinkLimitReached,
    },
  };
}
