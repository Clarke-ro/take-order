import {
  Purchases,
  PurchasesError,
  ErrorCode,
  PackageType,
  type CustomerInfo,
  type Package,
} from '@revenuecat/purchases-js';
import { useCallback, useEffect, useState } from 'react';

export type { CustomerInfo };

const runtimeEnv = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env ?? {};
export const REVENUECAT_API_KEY =
  runtimeEnv.VITE_RC_API_KEY ||
  runtimeEnv.RC_API_KEY ||
  'rcb_sb_HXGmjiScvdUHSTWLYKCOQgWBl';

export const PRO_ENTITLEMENT_ID =
  runtimeEnv.VITE_RC_ENTITLEMENT_PRO || 'take_order_app_pro';
export const PRO_PLUS_ENTITLEMENT_ID =
  runtimeEnv.VITE_RC_ENTITLEMENT_PRO_PLUS || 'take_order_app_pro_plus';

export const PACKAGE_ID_PRO_MONTHLY = '$rc_monthly';
export const PACKAGE_ID_PRO_ANNUAL = '$rc_annual';
export const PACKAGE_ID_PRO_PLUS_MONTHLY = '$rc_custom_proplus_monthly';
export const PACKAGE_ID_PRO_PLUS_ANNUAL = '$rc_custom_proplus_annual';

export type PlanTier = 'pro' | 'pro_plus' | 'none';

// Singleton configuration state guards
let isConfiguring = false;
let configuredUserId: string | null = null;
let initPromise: Promise<Purchases | null> | null = null;

// Subscribers for real-time entitlement updates across the UI
const entitlementListeners = new Set<(info: CustomerInfo | null, isPro: boolean) => void>();

export function subscribeToEntitlementChanges(
  listener: (info: CustomerInfo | null, isPro: boolean) => void
): () => void {
  entitlementListeners.add(listener);
  return () => {
    entitlementListeners.delete(listener);
  };
}

export function notifyEntitlementUpdated(info: CustomerInfo | null) {
  const pro = isProActive(info) || isProPlusActive(info);
  for (const listener of entitlementListeners) {
    try {
      listener(info, pro);
    } catch (err) {
      console.error('[RevenueCat] Error in entitlement listener:', err);
    }
  }
}

/**
 * Checks whether Purchases has been configured already.
 */
export function isRevenueCatConfigured(): boolean {
  try {
    return Purchases.isConfigured();
  } catch {
    return false;
  }
}

/**
 * Returns the active Purchases instance if configured, otherwise null.
 */
export function getPurchasesInstance(): Purchases | null {
  try {
    if (Purchases.isConfigured()) {
      return Purchases.getSharedInstance();
    }
  } catch {
    // Instance not yet available
  }
  return null;
}

/**
 * Initializes Purchases exactly once per user session.
 * Guards against double-configuration and handles user switches.
 */
export async function configureRevenueCat(appUserId: string): Promise<Purchases | null> {
  if (!appUserId || typeof window === 'undefined') {
    return null;
  }

  // If already configured with the current user ID, return instance
  if (isRevenueCatConfigured() && configuredUserId === appUserId) {
    return Purchases.getSharedInstance();
  }

  // Prevent concurrent duplicate configuration calls for the same user
  if (isConfiguring && initPromise && configuredUserId === appUserId) {
    return initPromise;
  }

  isConfiguring = true;
  configuredUserId = appUserId;

  initPromise = (async () => {
    try {
      if (Purchases.isConfigured()) {
        const instance = Purchases.getSharedInstance();
        if (instance.getAppUserId() !== appUserId) {
          await instance.changeUser(appUserId);
        }
        return instance;
      }

      const instance = Purchases.configure({
        apiKey: REVENUECAT_API_KEY,
        appUserId,
      });
      return instance;
    } catch (err) {
      console.error('[RevenueCat] Initialization failed:', err);
      configuredUserId = null;
      throw err;
    } finally {
      isConfiguring = false;
    }
  })();

  return initPromise;
}

/**
 * Check if the "take_order_app_pro" entitlement is active in customerInfo.
 */
export function isProActive(customerInfo: CustomerInfo | null | undefined): boolean {
  if (!customerInfo?.entitlements?.active) {
    return false;
  }
  return PRO_ENTITLEMENT_ID in customerInfo.entitlements.active;
}

/**
 * Check if the "take_order_app_pro_plus" entitlement is active in customerInfo.
 */
export function isProPlusActive(customerInfo: CustomerInfo | null | undefined): boolean {
  if (!customerInfo?.entitlements?.active) {
    return false;
  }
  return PRO_PLUS_ENTITLEMENT_ID in customerInfo.entitlements.active;
}

/**
 * Check if user has either Pro or Pro+ active.
 */
export function isAnyProActive(customerInfo: CustomerInfo | null | undefined): boolean {
  return isProPlusActive(customerInfo) || isProActive(customerInfo);
}

/**
 * Categorize current user plan tier from customerInfo.
 */
export function getActivePlanTier(customerInfo: CustomerInfo | null | undefined): PlanTier {
  if (isProPlusActive(customerInfo)) return 'pro_plus';
  if (isProActive(customerInfo)) return 'pro';
  return 'none';
}

export type ActiveEntitlementDetails = {
  hasActivePlan: boolean;
  tier: PlanTier;
  planName: string;
  entitlementId: string | null;
  productIdentifier: string | null;
  cadence: 'monthly' | 'annual' | 'unknown';
  willRenew: boolean;
  expirationDate: Date | null;
  managementURL: string | null;
  latestPurchaseDate: Date | null;
};

/**
 * Extract structured details from active entitlement for billing screens.
 */
export function getActiveEntitlementDetails(
  customerInfo: CustomerInfo | null | undefined
): ActiveEntitlementDetails {
  if (!customerInfo?.entitlements?.active) {
    return {
      hasActivePlan: false,
      tier: 'none',
      planName: 'None',
      entitlementId: null,
      productIdentifier: null,
      cadence: 'unknown',
      willRenew: false,
      expirationDate: null,
      managementURL: customerInfo?.managementURL ?? null,
      latestPurchaseDate: null,
    };
  }

  const active = customerInfo.entitlements.active;
  const proPlusEntitlement = active[PRO_PLUS_ENTITLEMENT_ID];
  const proEntitlement = active[PRO_ENTITLEMENT_ID];
  const selected = proPlusEntitlement || proEntitlement || null;

  if (!selected) {
    return {
      hasActivePlan: false,
      tier: 'none',
      planName: 'None',
      entitlementId: null,
      productIdentifier: null,
      cadence: 'unknown',
      willRenew: false,
      expirationDate: null,
      managementURL: customerInfo.managementURL ?? null,
      latestPurchaseDate: null,
    };
  }

  const tier: PlanTier = proPlusEntitlement ? 'pro_plus' : 'pro';
  const planName = proPlusEntitlement ? 'Pro+' : 'Pro';
  const prodId = selected.productIdentifier || '';
  const isAnnual =
    prodId === PACKAGE_ID_PRO_ANNUAL ||
    prodId === PACKAGE_ID_PRO_PLUS_ANNUAL ||
    prodId.toLowerCase().includes('annual') ||
    prodId.toLowerCase().includes('year');
  const cadence = isAnnual ? 'annual' : 'monthly';

  return {
    hasActivePlan: true,
    tier,
    planName,
    entitlementId: selected.identifier,
    productIdentifier: prodId,
    cadence,
    willRenew: selected.willRenew,
    expirationDate: selected.expirationDate,
    managementURL: customerInfo.managementURL ?? null,
    latestPurchaseDate: selected.latestPurchaseDate,
  };
}

export type OfferingTierPackages = {
  proMonthly: Package | null;
  proAnnual: Package | null;
  proPlusMonthly: Package | null;
  proPlusAnnual: Package | null;
};

/**
 * Get all 4 packages from the current offering (Pro & Pro+, Monthly & Annual).
 */
export async function getCurrentOfferingTierPackages(appUserId?: string | null): Promise<OfferingTierPackages> {
  let instance = getPurchasesInstance();
  if (!instance) {
    const fallbackId =
      appUserId ||
      (typeof window !== 'undefined' ? localStorage.getItem('duka-test-user-id') : null) ||
      'guest_seller';
    try {
      instance = await configureRevenueCat(fallbackId);
    } catch {
      // ignore
    }
  }

  if (!instance) {
    return {
      proMonthly: null,
      proAnnual: null,
      proPlusMonthly: null,
      proPlusAnnual: null,
    };
  }

  const offerings = await instance.getOfferings();
  const current = offerings.current;

  if (!current) {
    return {
      proMonthly: null,
      proAnnual: null,
      proPlusMonthly: null,
      proPlusAnnual: null,
    };
  }

  const packages = current.availablePackages;

  // Pro Monthly ($rc_monthly)
  const proMonthly =
    current.monthly ??
    current.packagesById[PACKAGE_ID_PRO_MONTHLY] ??
    packages.find((p) => p.identifier === PACKAGE_ID_PRO_MONTHLY || p.packageType === PackageType.Monthly || (p.packageType as string) === 'monthly') ??
    null;

  // Pro Annual ($rc_annual)
  const proAnnual =
    current.annual ??
    current.packagesById[PACKAGE_ID_PRO_ANNUAL] ??
    packages.find((p) => p.identifier === PACKAGE_ID_PRO_ANNUAL || p.packageType === PackageType.Annual || (p.packageType as string) === 'annual') ??
    null;

  // Pro+ Monthly ($rc_custom_proplus_monthly)
  const proPlusMonthly =
    current.packagesById[PACKAGE_ID_PRO_PLUS_MONTHLY] ??
    packages.find(
      (p) =>
        p.identifier === PACKAGE_ID_PRO_PLUS_MONTHLY ||
        p.identifier.toLowerCase().includes('proplus_monthly') ||
        p.identifier.toLowerCase().includes('pro_plus_monthly')
    ) ??
    null;

  // Pro+ Annual ($rc_custom_proplus_annual)
  const proPlusAnnual =
    current.packagesById[PACKAGE_ID_PRO_PLUS_ANNUAL] ??
    packages.find(
      (p) =>
        p.identifier === PACKAGE_ID_PRO_PLUS_ANNUAL ||
        p.identifier.toLowerCase().includes('proplus_annual') ||
        p.identifier.toLowerCase().includes('pro_plus_annual')
    ) ??
    null;

  return {
    proMonthly,
    proAnnual,
    proPlusMonthly,
    proPlusAnnual,
  };
}

/**
 * Restore purchases by refreshing CustomerInfo directly from RevenueCat.
 */
export async function restorePurchases(): Promise<CustomerInfo | null> {
  const instance = getPurchasesInstance();
  if (!instance) return null;
  const customerInfo = await instance.getCustomerInfo();
  notifyEntitlementUpdated(customerInfo);
  return customerInfo;
}

/**
 * Fetch latest customer info from RevenueCat.
 */
export async function fetchCustomerInfo(): Promise<CustomerInfo | null> {
  try {
    const instance = getPurchasesInstance();
    if (!instance) return null;
    const info = await instance.getCustomerInfo();
    return info;
  } catch (err) {
    console.warn('[RevenueCat] Failed to fetch customer info:', err);
    return null;
  }
}

/**
 * Get current monthly package from the current offering.
 */
export async function getProMonthlyPackage(): Promise<Package | null> {
  const tiers = await getCurrentOfferingTierPackages();
  return tiers.proMonthly;
}

export type PurchaseResultState = {
  success: boolean;
  isPro: boolean;
  isProPlus?: boolean;
  tier?: PlanTier;
  cancelled?: boolean;
  customerInfo?: CustomerInfo | null;
  error?: string | null;
};

/**
 * Checks whether an error is a UserCancelledError from RevenueCat.
 */
export function isUserCancelledError(error: unknown): boolean {
  if (!error) return false;
  if (error instanceof PurchasesError && error.errorCode === ErrorCode.UserCancelledError) {
    return true;
  }
  const err = error as { errorCode?: number; name?: string; message?: string };
  return (
    err.errorCode === ErrorCode.UserCancelledError ||
    err.errorCode === 1 ||
    err.name === 'UserCancelledError' ||
    (typeof err.message === 'string' && err.message.toLowerCase().includes('cancelled'))
  );
}

/**
 * Executes purchase for any package and checks for active entitlements.
 * Handles UserCancelledError gracefully.
 */
export async function purchaseProPackage(
  pkg: Package,
  appUserId?: string | null,
  customerEmail?: string | null
): Promise<PurchaseResultState> {
  try {
    let instance = getPurchasesInstance();
    if (!instance) {
      const fallbackId =
        appUserId ||
        (typeof window !== 'undefined' ? localStorage.getItem('duka-test-user-id') : null) ||
        'guest_seller';
      instance = await configureRevenueCat(fallbackId);
    }
    if (!instance) {
      throw new Error('RevenueCat is not configured. Please sign in first.');
    }

    const purchaseResult = await instance.purchase({
      rcPackage: pkg,
      ...(customerEmail ? { customerEmail } : {}),
    });
    const { customerInfo } = purchaseResult;
    const pro = isProActive(customerInfo);
    const proPlus = isProPlusActive(customerInfo);
    const tier = getActivePlanTier(customerInfo);

    notifyEntitlementUpdated(customerInfo);

    return {
      success: pro || proPlus,
      isPro: pro || proPlus,
      isProPlus: proPlus,
      tier,
      customerInfo,
    };
  } catch (err) {
    if (isUserCancelledError(err)) {
      return {
        success: false,
        isPro: false,
        cancelled: true,
      };
    }

    console.error('[RevenueCat] Purchase failed:', err);
    let errorMessage = err instanceof Error ? err.message : 'Purchase could not be completed. Please try again.';
    const anyErr = err as any;
    if (
      anyErr?.extra?.backendErrorCode === 8101 ||
      anyErr?.errorCode === 8101 ||
      errorMessage.includes('8101')
    ) {
      errorMessage =
        'Purchase could not be started (error code 8101). Please try again or check your RevenueCat web billing configuration.';
    }

    return {
      success: false,
      isPro: false,
      error: errorMessage,
    };
  }
}

export function formatPackagePrice(pkg: Package | null | undefined, fallback: string = ''): string {
  if (!pkg?.webBillingProduct) return fallback;
  const product = pkg.webBillingProduct;
  return (
    product.currentPrice?.formattedPrice ||
    (product.defaultPurchaseOption as any)?.base?.price?.formattedPrice ||
    fallback
  );
}

export function formatPackageMonthlyEquivalent(pkg: Package | null | undefined, fallback: string = ''): string {
  if (!pkg?.webBillingProduct) return fallback;
  const product = pkg.webBillingProduct;
  const price = product.currentPrice || (product.defaultPurchaseOption as any)?.base?.price;
  if (!price) return fallback;
  if (price.amountMicros) {
    const monthlyMicros = price.amountMicros / 12;
    const dollars = (monthlyMicros / 1000000).toFixed(2);
    const formatted = price.formattedPrice || '';
    const match = formatted.match(/^[^\d\s]+/);
    const symbol = match ? match[0] : '$';
    return `${symbol}${dollars}/mo equiv.`;
  }
  return fallback;
}

/**
 * Reusable entitlement hook that:
 * 1. Configures RevenueCat with the given appUserId (if provided)
 * 2. Fetches customer info on mount
 * 3. Returns gating flags, tier, details, and live subscription status
 * 4. Subscribes to real-time purchase updates across components
 */
export function useEntitlement(appUserId?: string | null) {
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [isPro, setIsPro] = useState<boolean>(false);
  const [isProPlus, setIsProPlus] = useState<boolean>(false);
  const [tier, setTier] = useState<PlanTier>('none');
  const [details, setDetails] = useState<ActiveEntitlementDetails>(() => getActiveEntitlementDetails(null));
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(appUserId));
  const [error, setError] = useState<string | null>(null);

  const applyCustomerInfo = useCallback((info: CustomerInfo | null) => {
    setCustomerInfo(info);
    const pro = isProActive(info);
    const proPlus = isProPlusActive(info);
    setIsPro(pro || proPlus);
    setIsProPlus(proPlus);
    setTier(getActivePlanTier(info));
    setDetails(getActiveEntitlementDetails(info));
  }, []);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const info = await fetchCustomerInfo();
      applyCustomerInfo(info);
      return info;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to refresh subscription status';
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [applyCustomerInfo]);

  useEffect(() => {
    let isMounted = true;

    async function initializeAndFetch() {
      if (!appUserId) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        await configureRevenueCat(appUserId);
        const info = await fetchCustomerInfo();
        if (isMounted) {
          applyCustomerInfo(info);
        }
      } catch (err: unknown) {
        if (isMounted) {
          const message = err instanceof Error ? err.message : 'Failed to load subscription status';
          setError(message);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    initializeAndFetch();

    // Listen for purchases made anywhere in the application
    const unsubscribe = subscribeToEntitlementChanges((info) => {
      if (isMounted) {
        applyCustomerInfo(info);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [appUserId, applyCustomerInfo]);

  return {
    isPro,
    isProPlus,
    tier,
    details,
    customerInfo,
    isLoading,
    error,
    refresh,
  };
}
