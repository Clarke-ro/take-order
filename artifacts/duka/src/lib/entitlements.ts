import { useState, useEffect, useCallback, useTransition } from 'react';
import {
  FREE_CATALOG_LIMIT,
  FREE_ACTIVE_LINK_LIMIT,
  PRO_ACTIVE_LINK_LIMIT,
  TRIAL_DURATION_DAYS,
  PLAN_DEFINITIONS,
  type PlanTier,
  type PlanDefinition,
} from '@workspace/api-zod';
import {
  useEntitlement as useRevenueCatEntitlement,
  subscribeToEntitlementChanges,
  isProActive,
  isProPlusActive,
  getActivePlanTier,
  type CustomerInfo,
} from './revenuecat';
import { customFetch } from '@workspace/api-client-react';

export {
  FREE_CATALOG_LIMIT,
  FREE_ACTIVE_LINK_LIMIT,
  PRO_ACTIVE_LINK_LIMIT,
  TRIAL_DURATION_DAYS,
  PLAN_DEFINITIONS,
  type PlanTier,
  type PlanDefinition,
};

export type EntitlementsState = {
  tier: PlanTier;
  isPro: boolean;
  isProPlus: boolean;
  isTrial: boolean;
  trial: {
    active: boolean;
    startedAt: string | null;
    daysRemaining: number;
  };
  limits: {
    catalogLimit: { limit: number | null; unlimited: boolean };
    activeLinkLimit: { limit: number | null; unlimited: boolean };
    catalogLimitReached: boolean;
    activeLinkLimitReached: boolean;
  };
  usage: {
    catalogProductCount: number;
    activeLinkCount: number;
  };
  canAccessReports: boolean;
  canExportAnalytics: boolean;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const defaultEntitlements: EntitlementsState = {
  tier: 'free',
  isPro: false,
  isProPlus: false,
  isTrial: false,
  trial: {
    active: false,
    startedAt: null,
    daysRemaining: 0,
  },
  limits: {
    catalogLimit: { limit: null, unlimited: true },
    activeLinkLimit: { limit: FREE_ACTIVE_LINK_LIMIT, unlimited: false },
    catalogLimitReached: false,
    activeLinkLimitReached: false,
  },
  usage: {
    catalogProductCount: 0,
    activeLinkCount: 0,
  },
  canAccessReports: false,
  canExportAnalytics: false,
  isLoading: true,
  error: null,
  refresh: async () => {},
};

function getCachedEntitlements(userId?: string | null): Omit<EntitlementsState, 'isLoading' | 'error' | 'refresh'> {
  if (!userId || typeof window === 'undefined') return defaultEntitlements;
  try {
    const raw = sessionStorage.getItem(`duka_entitlements_${userId}`) || localStorage.getItem(`duka_entitlements_${userId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.tier === 'string') {
        return {
          ...defaultEntitlements,
          ...parsed,
        };
      }
    }
  } catch {}
  return defaultEntitlements;
}

function persistCachedEntitlements(userId: string | null | undefined, state: Omit<EntitlementsState, 'isLoading' | 'error' | 'refresh'>): void {
  if (!userId || typeof window === 'undefined') return;
  try {
    const serialized = JSON.stringify(state);
    sessionStorage.setItem(`duka_entitlements_${userId}`, serialized);
    localStorage.setItem(`duka_entitlements_${userId}`, serialized);
  } catch {}
}

export function useEntitlements(userId?: string | null): EntitlementsState {
  const [serverState, setServerState] = useState<Omit<EntitlementsState, 'isLoading' | 'error' | 'refresh'>>(() => getCachedEntitlements(userId));
  const hasCached = typeof window !== 'undefined' && Boolean(userId && (sessionStorage.getItem(`duka_entitlements_${userId}`) || localStorage.getItem(`duka_entitlements_${userId}`)));
  const [isLoading, setIsLoading] = useState<boolean>(!hasCached);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (userId) {
      const cached = getCachedEntitlements(userId);
      setServerState(cached);
    }
  }, [userId]);

  const fetchEntitlements = useCallback(async () => {
    try {
      const data = await customFetch<any>('/api/subscription/entitlements');
      const nextState: Omit<EntitlementsState, 'isLoading' | 'error' | 'refresh'> = {
        tier: data.tier,
        isPro: Boolean(data.isPro),
        isProPlus: Boolean(data.isProPlus),
        isTrial: Boolean(data.trial?.active),
        trial: {
          active: Boolean(data.trial?.active),
          startedAt: data.trial?.startedAt ?? null,
          daysRemaining: Number(data.trial?.daysRemaining ?? 0),
        },
        limits: {
          catalogLimit: data.limits?.catalogLimit ?? { limit: null, unlimited: true },
          activeLinkLimit: data.limits?.activeLinkLimit ?? { limit: FREE_ACTIVE_LINK_LIMIT, unlimited: false },
          catalogLimitReached: Boolean(data.limits?.catalogLimitReached),
          activeLinkLimitReached: Boolean(data.limits?.activeLinkLimitReached),
        },
        usage: {
          catalogProductCount: Number(data.usage?.catalogProductCount ?? 0),
          activeLinkCount: Number(data.usage?.activeLinkCount ?? 0),
        },
        canAccessReports: Boolean(data.capabilities?.canAccessReports ?? (data.tier !== 'free')),
        canExportAnalytics: Boolean(data.isPro || data.trial?.active),
      };
      persistCachedEntitlements(userId, nextState);
      startTransition(() => {
        setServerState(nextState);
        setError(null);
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error fetching subscription entitlements');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void fetchEntitlements();

    // Listen for client RevenueCat purchases to update state immediately
    const unsubscribe = subscribeToEntitlementChanges((customerInfo: CustomerInfo | null) => {
      if (!customerInfo) return;
      const proPlus = isProPlusActive(customerInfo);
      const pro = isProActive(customerInfo) || proPlus;
      if (proPlus) {
        setServerState((prev) => {
          const next = {
            ...prev,
            tier: 'pro_plus' as const,
            isPro: true,
            isProPlus: true,
            canAccessReports: true,
            canExportAnalytics: true,
            limits: {
              ...prev.limits,
              catalogLimit: { limit: null, unlimited: true },
              activeLinkLimit: { limit: null, unlimited: true },
              catalogLimitReached: false,
              activeLinkLimitReached: false,
            },
          };
          persistCachedEntitlements(userId, next);
          return next;
        });
      } else if (pro) {
        setServerState((prev) => {
          const next = {
            ...prev,
            tier: 'pro' as const,
            isPro: true,
            isProPlus: false,
            canAccessReports: true,
            canExportAnalytics: true,
            limits: {
              ...prev.limits,
              catalogLimit: { limit: null, unlimited: true },
              activeLinkLimit: { limit: PRO_ACTIVE_LINK_LIMIT, unlimited: false },
              catalogLimitReached: false,
              activeLinkLimitReached: prev.usage.activeLinkCount >= PRO_ACTIVE_LINK_LIMIT,
            },
          };
          persistCachedEntitlements(userId, next);
          return next;
        });
      }
      // Re-fetch authoritative status from server
      void fetchEntitlements();
    });

    return () => {
      unsubscribe();
    };
  }, [userId, fetchEntitlements]);

  return {
    ...serverState,
    isLoading,
    error,
    refresh: fetchEntitlements,
  };
}
