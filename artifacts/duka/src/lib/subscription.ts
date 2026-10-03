import { useState, useEffect, useCallback, useTransition } from 'react';
import {
  FREE_CATALOG_LIMIT,
  FREE_ACTIVE_LINK_LIMIT,
  PRO_ACTIVE_LINK_LIMIT,
  TRIAL_DURATION_DAYS,
  PLAN_DEFINITIONS,
  type PlanTier,
} from '@workspace/api-zod';
import {
  useEntitlement as useRevenueCatEntitlement,
  subscribeToEntitlementChanges,
  isProActive,
  isProPlusActive,
  type CustomerInfo,
} from './revenuecat';
import { customFetch } from '@workspace/api-client-react';

export type SubscriptionPlan = 'free' | 'trial' | 'pro' | 'pro_plus';
export type SubscriptionStatus =
  | 'active'
  | 'in_trial'
  | 'trial_eligible'
  | 'cancelled'
  | 'billing_issue'
  | 'expired';

export interface NormalizedSubscription {
  plan: SubscriptionPlan;
  tier: SubscriptionPlan;
  status: SubscriptionStatus;
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
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  startTrial: () => Promise<boolean>;
}

const defaultSubscription: Omit<NormalizedSubscription, 'isLoading' | 'error' | 'refresh' | 'startTrial'> = {
  plan: 'free',
  tier: 'free',
  status: 'trial_eligible',
  trialEligible: true,
  trialEndsAt: null,
  trialDaysRemaining: 0,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  billingIssue: false,
  isPro: false,
  isProPlus: false,
  isTrial: false,
  canAccessReports: false,
  canExportAnalytics: false,
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
};

function getCachedSubscription(userId?: string | null): Omit<NormalizedSubscription, 'isLoading' | 'error' | 'refresh' | 'startTrial'> {
  if (typeof window === 'undefined') return defaultSubscription;
  try {
    let raw: string | null = null;
    if (userId) {
      raw = sessionStorage.getItem(`takeorder_sub_${userId}`) || localStorage.getItem(`takeorder_sub_${userId}`);
    }
    if (!raw) {
      const foundKey = Object.keys(sessionStorage).find(k => k.startsWith('takeorder_sub_')) ||
                       Object.keys(localStorage).find(k => k.startsWith('takeorder_sub_'));
      if (foundKey) {
        raw = sessionStorage.getItem(foundKey) || localStorage.getItem(foundKey);
      }
    }
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.plan === 'string') {
        return {
          ...defaultSubscription,
          ...parsed,
        };
      }
    }
  } catch {}
  return defaultSubscription;
}

function persistCachedSubscription(userId: string | null | undefined, state: Omit<NormalizedSubscription, 'isLoading' | 'error' | 'refresh' | 'startTrial'>): void {
  if (typeof window === 'undefined') return;
  try {
    const serialized = JSON.stringify(state);
    if (userId) {
      sessionStorage.setItem(`takeorder_sub_${userId}`, serialized);
      localStorage.setItem(`takeorder_sub_${userId}`, serialized);
    }
    sessionStorage.setItem('takeorder_sub_latest', serialized);
    localStorage.setItem('takeorder_sub_latest', serialized);
  } catch {}
}

export function useSubscription(userId?: string | null): NormalizedSubscription {
  const [serverState, setServerState] = useState<Omit<NormalizedSubscription, 'isLoading' | 'error' | 'refresh' | 'startTrial'>>(() =>
    getCachedSubscription(userId)
  );
  const hasCached =
    typeof window !== 'undefined' &&
    Boolean(
      (userId && (sessionStorage.getItem(`takeorder_sub_${userId}`) || localStorage.getItem(`takeorder_sub_${userId}`))) ||
      sessionStorage.getItem('takeorder_sub_latest') ||
      localStorage.getItem('takeorder_sub_latest') ||
      Object.keys(sessionStorage).some(k => k.startsWith('takeorder_sub_')) ||
      Object.keys(localStorage).some(k => k.startsWith('takeorder_sub_'))
    );
  const [isLoading, setIsLoading] = useState<boolean>(!hasCached);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (userId) {
      const cached = getCachedSubscription(userId);
      setServerState(cached);
    }
  }, [userId]);

  const fetchSubscription = useCallback(async () => {
    try {
      const data = await customFetch<any>('/api/subscription/entitlements');
      const resolvedPlan = (data.plan || data.tier || 'free') as SubscriptionPlan;
      const resolvedStatus = (data.status || (resolvedPlan === 'trial' ? 'in_trial' : data.trialEligible ? 'trial_eligible' : 'active')) as SubscriptionStatus;

      const nextState: Omit<NormalizedSubscription, 'isLoading' | 'error' | 'refresh' | 'startTrial'> = {
        plan: resolvedPlan,
        tier: resolvedPlan,
        status: resolvedStatus,
        trialEligible: Boolean(data.trialEligible),
        trialEndsAt: data.trialEndsAt ?? data.trial?.expiresAt ?? null,
        trialDaysRemaining: Number(data.trialDaysRemaining ?? data.trial?.daysRemaining ?? 0),
        currentPeriodEnd: data.currentPeriodEnd ?? data.trialEndsAt ?? null,
        cancelAtPeriodEnd: Boolean(data.cancelAtPeriodEnd),
        billingIssue: Boolean(data.billingIssue),
        isPro: Boolean(data.isPro || resolvedPlan === 'pro' || resolvedPlan === 'pro_plus'),
        isProPlus: Boolean(data.isProPlus || resolvedPlan === 'pro_plus'),
        isTrial: Boolean(data.isTrial || resolvedPlan === 'trial'),
        canAccessReports: Boolean(data.canAccessReports ?? resolvedPlan !== 'free'),
        canExportAnalytics: Boolean(data.canExportAnalytics ?? (resolvedPlan === 'pro' || resolvedPlan === 'pro_plus' || resolvedPlan === 'trial')),
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
      };

      persistCachedSubscription(userId, nextState);
      startTransition(() => {
        setServerState(nextState);
        setError(null);
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error fetching subscription');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  const startTrial = useCallback(async (): Promise<boolean> => {
    try {
      setIsLoading(true);
      await customFetch<any>('/api/subscription/start-trial', { method: 'POST' });
      await fetchSubscription();
      return true;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error starting trial');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [fetchSubscription]);

  useEffect(() => {
    void fetchSubscription();

    const unsubscribe = subscribeToEntitlementChanges((customerInfo: CustomerInfo | null) => {
      if (!customerInfo) return;
      const proPlus = isProPlusActive(customerInfo);
      const pro = isProActive(customerInfo) || proPlus;

      setServerState((prev) => {
        const next: Omit<NormalizedSubscription, 'isLoading' | 'error' | 'refresh' | 'startTrial'> = {
          ...prev,
          plan: proPlus ? 'pro_plus' : pro ? 'pro' : prev.plan,
          tier: proPlus ? 'pro_plus' : pro ? 'pro' : prev.tier,
          status: 'active',
          isPro: Boolean(pro),
          isProPlus: Boolean(proPlus),
          canAccessReports: true,
          canExportAnalytics: true,
          limits: {
            catalogLimit: { limit: null, unlimited: true },
            activeLinkLimit: proPlus
              ? { limit: null, unlimited: true }
              : { limit: PRO_ACTIVE_LINK_LIMIT, unlimited: false },
            catalogLimitReached: false,
            activeLinkLimitReached: proPlus ? false : prev.usage.activeLinkCount >= PRO_ACTIVE_LINK_LIMIT,
          },
        };
        persistCachedSubscription(userId, next);
        return next;
      });

      void fetchSubscription();
    });

    return () => {
      unsubscribe();
    };
  }, [userId, fetchSubscription]);

  return {
    ...serverState,
    isLoading,
    error,
    refresh: fetchSubscription,
    startTrial,
  };
}
