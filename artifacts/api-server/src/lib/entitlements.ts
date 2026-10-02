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

export type NormalizedSubscriptionStatus =
  | 'active'
  | 'in_trial'
  | 'trial_eligible'
  | 'cancelled'
  | 'billing_issue'
  | 'expired';

export type SellerEntitlementState = {
  tier: PlanTier;
  plan: PlanTier;
  status: NormalizedSubscriptionStatus;
  trialEligible: boolean;
  trialEndsAt: string | null;
  trialDaysRemaining: number;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  billingIssue: boolean;
  isPro: boolean;
  isProPlus: boolean;
  isTrial: boolean;
  canAccessReports: boolean;
  canExportAnalytics: boolean;
  capabilities: PlanCapabilities;
  trial: {
    isTrial: boolean;
    active: boolean;
    daysRemaining: number;
    startedAt: string | null;
    expiresAt: string | null;
  };
  revenueCat: {
    active: boolean;
    tier: "none" | "pro" | "pro_plus";
    entitlementId: string | null;
    expiresDate?: string | null;
    cancelAtPeriodEnd?: boolean;
    billingIssue?: boolean;
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
  expiresDate: string | null;
  cancelAtPeriodEnd: boolean;
  billingIssue: boolean;
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
  expiresDate: string | null = null,
  cancelAtPeriodEnd: boolean = false,
  billingIssue: boolean = false
): void {
  revenueCatCache.set(appUserId, {
    tier,
    entitlementId,
    expiresDate,
    cancelAtPeriodEnd,
    billingIssue,
    timestamp: Date.now(),
  });
}

export async function checkRevenueCatSubscription(
  appUserId: string,
  timeoutMs: number = 2500
): Promise<{
  tier: "none" | "pro" | "pro_plus";
  entitlementId: string | null;
  expiresDate: string | null;
  cancelAtPeriodEnd: boolean;
  billingIssue: boolean;
}> {
  if (!appUserId || appUserId === "guest_seller" || appUserId === "test-user") {
    return { tier: "none", entitlementId: null, expiresDate: null, cancelAtPeriodEnd: false, billingIssue: false };
  }

  const cached = revenueCatCache.get(appUserId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return {
      tier: cached.tier,
      entitlementId: cached.entitlementId,
      expiresDate: cached.expiresDate,
      cancelAtPeriodEnd: cached.cancelAtPeriodEnd,
      billingIssue: cached.billingIssue,
    };
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
      return { tier: "none", entitlementId: null, expiresDate: null, cancelAtPeriodEnd: false, billingIssue: false };
    }

    const data: any = await res.json();
    const activeEntitlements = data?.subscriber?.entitlements ?? {};

    let tier: "none" | "pro" | "pro_plus" = "none";
    let entitlementId: string | null = null;
    let expiresDate: string | null = null;
    let cancelAtPeriodEnd = false;
    let billingIssue = false;

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
      expiresDate = proPlus?.expires_date || null;
      cancelAtPeriodEnd = Boolean(proPlus?.unsubscribe_detected_at);
      billingIssue = Boolean(proPlus?.billing_issues_detected_at);
    } else if (isEntitlementActive(pro)) {
      tier = "pro";
      entitlementId = PRO_ENTITLEMENT_ID;
      expiresDate = pro?.expires_date || null;
      cancelAtPeriodEnd = Boolean(pro?.unsubscribe_detected_at);
      billingIssue = Boolean(pro?.billing_issues_detected_at);
    }

    revenueCatCache.set(appUserId, {
      tier,
      entitlementId,
      expiresDate,
      cancelAtPeriodEnd,
      billingIssue,
      timestamp: Date.now(),
    });

    return { tier, entitlementId, expiresDate, cancelAtPeriodEnd, billingIssue };
  } catch (err) {
    logger.warn({ err, appUserId }, "Failed to fetch subscriber status from RevenueCat");
    return { tier: "none", entitlementId: null, expiresDate: null, cancelAtPeriodEnd: false, billingIssue: false };
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

  // 1. Fetch seller settings to check trial status
  const [record] = await database
    .select()
    .from(sellerSettingsTable)
    .where(eq(sellerSettingsTable.ownerUserId, ownerUserId));

  const settings = (record?.settings ?? {}) as Record<string, any>;
  const trialStartedAtStr: string | undefined = settings.trialStartedAt;

  let trialActive = false;
  let trialDaysRemaining = 0;
  let trialStartedAt: Date | null = null;
  let trialExpiresAt: Date | null = null;

  if (trialStartedAtStr) {
    trialStartedAt = new Date(trialStartedAtStr);
    trialExpiresAt = new Date(trialStartedAt.getTime() + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000);
    trialActive = now.getTime() < trialExpiresAt.getTime();
    trialDaysRemaining = getTrialDaysRemaining(trialStartedAt, now);
  }

  // 2. Check RevenueCat active subscriptions
  let rcTier: "none" | "pro" | "pro_plus" = "none";
  let rcEntitlementId: string | null = null;
  let rcExpiresDate: string | null = null;
  let rcCancelAtPeriodEnd = false;
  let rcBillingIssue = false;

  if (!options.skipRevenueCat && !options.mockTier) {
    const rcResult = await checkRevenueCatSubscription(ownerUserId);
    rcTier = rcResult.tier;
    rcEntitlementId = rcResult.entitlementId;
    rcExpiresDate = rcResult.expiresDate;
    rcCancelAtPeriodEnd = rcResult.cancelAtPeriodEnd;
    rcBillingIssue = rcResult.billingIssue;
  }

  // 3. Determine authoritative tier & lifecycle status
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

  const trialEligible = !trialStartedAtStr && rcTier === "none";

  let status: NormalizedSubscriptionStatus;
  if (rcTier !== "none") {
    if (rcBillingIssue) {
      status = "billing_issue";
    } else if (rcCancelAtPeriodEnd) {
      status = "cancelled";
    } else {
      status = "active";
    }
  } else if (trialActive) {
    status = "in_trial";
  } else if (trialEligible) {
    status = "trial_eligible";
  } else {
    status = "expired";
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
    plan: resolvedTier,
    status,
    trialEligible,
    trialEndsAt: trialExpiresAt ? trialExpiresAt.toISOString() : null,
    trialDaysRemaining,
    currentPeriodEnd: rcExpiresDate || (trialExpiresAt ? trialExpiresAt.toISOString() : null),
    cancelAtPeriodEnd: rcCancelAtPeriodEnd,
    billingIssue: rcBillingIssue,
    isPro: resolvedTier === "pro" || resolvedTier === "pro_plus",
    isProPlus: resolvedTier === "pro_plus",
    isTrial: resolvedTier === "trial",
    canAccessReports: Boolean(capabilities.canAccessReports),
    canExportAnalytics: Boolean(resolvedTier === "pro" || resolvedTier === "pro_plus" || trialActive),
    capabilities,
    trial: {
      isTrial: resolvedTier === "trial",
      active: trialActive,
      daysRemaining: trialDaysRemaining,
      startedAt: trialStartedAt ? trialStartedAt.toISOString() : null,
      expiresAt: trialExpiresAt ? trialExpiresAt.toISOString() : null,
    },
    revenueCat: {
      active: rcTier !== "none",
      tier: rcTier,
      entitlementId: rcEntitlementId,
      expiresDate: rcExpiresDate,
      cancelAtPeriodEnd: rcCancelAtPeriodEnd,
      billingIssue: rcBillingIssue,
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

/**
 * Idempotently starts a 7-day free trial for a seller.
 * If trial has already been started previously, returns existing trial without resetting or extending.
 */
export async function startSellerTrial(
  database: typeof db,
  ownerUserId: string
): Promise<SellerEntitlementState> {
  const [record] = await database
    .select()
    .from(sellerSettingsTable)
    .where(eq(sellerSettingsTable.ownerUserId, ownerUserId));

  const settings = (record?.settings ?? {}) as Record<string, any>;
  if (!settings.trialStartedAt) {
    const updatedSettings = { ...settings, trialStartedAt: new Date().toISOString() };
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
  }

  return resolveSellerEntitlement(database, ownerUserId);
}
