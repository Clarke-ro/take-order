export type PlanTier = "free" | "trial" | "pro" | "pro_plus";

export type LimitValue = {
  unlimited: boolean;
  limit: number | null; // null when unlimited is true
};

/**
 * Locked Commercial Limits
 */
export const FREE_CATALOG_LIMIT: number | null = null; // Free now has unlimited catalog items
export const FREE_ACTIVE_LINK_LIMIT = 50; // Free has 50 active Take Order links

/**
 * Configurable Pro Active-Link Limit (Centralized).
 * The exact number is not hardcoded arbitrarily across files.
 * Default is 500 unless overridden via environment variable.
 */
declare const process: { env?: Record<string, string | undefined> } | undefined;

export const PRO_ACTIVE_LINK_LIMIT: number = (() => {
  const envVal =
    typeof process !== "undefined" && process?.env?.PRO_ACTIVE_LINK_LIMIT
      ? Number(process.env.PRO_ACTIVE_LINK_LIMIT)
      : null;
  return envVal && Number.isFinite(envVal) && envVal > 0 ? envVal : 500;
})();

export const TRIAL_DURATION_DAYS = 7;

export type PlanCapabilities = {
  tier: PlanTier;
  label: string;
  catalogLimit: LimitValue;
  activeLinkLimit: LimitValue;
  canAccessReports: boolean;
  canExportAnalytics: boolean;
  canAccessChannelConversion: boolean;
  canAccessAdvancedComparisons: boolean;
  dashboardExperience: "standard" | "advanced" | "premium";
};

export type PlanDefinition = PlanCapabilities;

export const PLAN_DEFINITIONS: Record<PlanTier, PlanCapabilities> = {
  free: {
    tier: "free",
    label: "Free",
    catalogLimit: { unlimited: true, limit: null }, // Unlimited catalog for Free
    activeLinkLimit: { unlimited: false, limit: FREE_ACTIVE_LINK_LIMIT }, // 50 active links
    canAccessReports: false, // Reports not available on Free
    canExportAnalytics: false,
    canAccessChannelConversion: false,
    canAccessAdvancedComparisons: false,
    dashboardExperience: "standard",
  },
  trial: {
    tier: "trial",
    label: "Pro Trial",
    catalogLimit: { unlimited: true, limit: null },
    activeLinkLimit: { unlimited: false, limit: PRO_ACTIVE_LINK_LIMIT }, // 500 active links
    canAccessReports: true,
    canExportAnalytics: true,
    canAccessChannelConversion: true,
    canAccessAdvancedComparisons: true,
    dashboardExperience: "advanced",
  },
  pro: {
    tier: "pro",
    label: "Pro",
    catalogLimit: { unlimited: true, limit: null },
    activeLinkLimit: { unlimited: false, limit: PRO_ACTIVE_LINK_LIMIT }, // 500 active links
    canAccessReports: true,
    canExportAnalytics: true,
    canAccessChannelConversion: true,
    canAccessAdvancedComparisons: true,
    dashboardExperience: "advanced",
  },
  pro_plus: {
    tier: "pro_plus",
    label: "Pro+",
    catalogLimit: { unlimited: true, limit: null },
    activeLinkLimit: { unlimited: true, limit: null }, // Explicit semantic unlimited: NO numerical ceiling
    canAccessReports: true,
    canExportAnalytics: true,
    canAccessChannelConversion: true,
    canAccessAdvancedComparisons: true,
    dashboardExperience: "premium",
  },
};

/**
 * Checks if a plan tier qualifies as Pro-level or higher (Trial, Pro, or Pro+).
 */
export function isProOrHigher(tier: PlanTier): boolean {
  return tier === "trial" || tier === "pro" || tier === "pro_plus";
}

/**
 * Checks if a plan tier qualifies as Pro+ specifically.
 */
export function isProPlus(tier: PlanTier): boolean {
  return tier === "pro_plus";
}

/**
 * Checks if creating a new catalog product is blocked by plan limit.
 * Downgrade rule: Existing products are never deleted or disabled,
 * but new creation beyond capacity is blocked.
 */
export function hasReachedCatalogLimit(currentProductCount: number, tier: PlanTier): boolean {
  const caps = PLAN_DEFINITIONS[tier] || PLAN_DEFINITIONS.free;
  if (caps.catalogLimit.unlimited || caps.catalogLimit.limit === null) {
    return false;
  }
  return currentProductCount >= caps.catalogLimit.limit;
}

/**
 * Checks if creating a new active Take Order link is blocked by plan limit.
 * Downgrade rule: Existing links remain active and fully functioning,
 * but new link creation beyond capacity is blocked.
 */
export function hasReachedActiveLinkLimit(currentActiveLinkCount: number, tier: PlanTier): boolean {
  const caps = PLAN_DEFINITIONS[tier] || PLAN_DEFINITIONS.free;
  if (caps.activeLinkLimit.unlimited || caps.activeLinkLimit.limit === null) {
    return false;
  }
  return currentActiveLinkCount >= caps.activeLinkLimit.limit;
}

/**
 * Computes remaining trial days for an account.
 */
export function getTrialDaysRemaining(
  trialStartedAt: Date | string | number,
  now: Date | string | number = new Date()
): number {
  const start = new Date(trialStartedAt).getTime();
  const current = new Date(now).getTime();
  if (isNaN(start) || isNaN(current)) return 0;
  const trialEnd = start + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000;
  const diff = trialEnd - current;
  if (diff <= 0) return 0;
  return Math.ceil(diff / (24 * 60 * 60 * 1000));
}

/**
 * Evaluates whether the 7-day Pro trial is currently active.
 */
export function isTrialActive(
  trialStartedAt: Date | string | number | null | undefined,
  now: Date | string | number = new Date()
): boolean {
  if (!trialStartedAt) return false;
  const start = new Date(trialStartedAt).getTime();
  const current = new Date(now).getTime();
  if (isNaN(start) || isNaN(current)) return false;
  const trialEnd = start + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000;
  return current < trialEnd;
}
