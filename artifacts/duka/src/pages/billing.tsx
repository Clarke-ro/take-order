import React, { useState } from 'react';
import { Link, Redirect } from 'wouter';
import { cn } from '@/lib/utils';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  CreditCard,
  ExternalLink,
  Loader2,
  RefreshCw,
  ShieldCheck,
  AlertCircle,
  Sparkles,
  Calendar,
  ChevronRight,
  Crown,
  Boxes,
  Link2,
} from 'lucide-react';
import { useAppAuth } from '@/lib/auth-context';
import {
  useEntitlement,
  restorePurchases,
  PACKAGE_ID_PRO_MONTHLY,
  PACKAGE_ID_PRO_ANNUAL,
  PACKAGE_ID_PRO_PLUS_MONTHLY,
  PACKAGE_ID_PRO_PLUS_ANNUAL,
} from '@/lib/revenuecat';
import { useSubscription } from '@/lib/subscription';
import { FREE_ACTIVE_LINK_LIMIT, PRO_ACTIVE_LINK_LIMIT } from '@workspace/api-zod';

export function BillingPage() {
  const { userId, isSignedIn, isLoaded } = useAppAuth();
  const isTestAuth =
    typeof window !== 'undefined' &&
    (Boolean((window as any).__DUKA_TEST_AUTH__) ||
      localStorage.getItem('duka-test-auth') === 'true');
  const effectiveUserId =
    userId ||
    (typeof window !== 'undefined' ? localStorage.getItem('duka-test-user-id') : null) ||
    (isTestAuth ? 'test-seller-id' : 'seller_default');

  const { tier, details, customerInfo, isLoading: rcLoading, refresh: rcRefresh } =
    useEntitlement(effectiveUserId);
  const sub = useSubscription(effectiveUserId);

  if (isLoaded && !isSignedIn && !isTestAuth && !localStorage.getItem('duka-test-user-id') && !userId) {
    return <Redirect to="/sign-in?redirect=%2Faccount%2Fbilling" replace />;
  }

  if (!isTestAuth && !isLoaded) {
    return (
      <div data-route="loading-skeleton" className="min-h-screen bg-[hsl(var(--background))] p-8">
        <div className="max-w-3xl mx-auto space-y-6 animate-pulse">
          <div className="h-8 w-48 bg-neutral-200 dark:bg-neutral-800 rounded-lg" />
          <div className="h-40 w-full bg-neutral-200 dark:bg-neutral-800 rounded-xl" />
        </div>
      </div>
    );
  }

  const [restoring, setRestoring] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleRestore = async () => {
    setRestoring(true);
    setFeedback(null);
    try {
      const updated = await restorePurchases();
      await rcRefresh();
      await sub.refresh();
      setFeedback(
        updated &&
          (updated.entitlements.active['take_order_app_pro_plus'] ||
            updated.entitlements.active['take_order_app_pro'])
          ? 'Purchases restored successfully!'
          : 'No active subscription found.'
      );
    } catch (e: unknown) {
      setFeedback(e instanceof Error ? e.message : 'Restore failed');
    } finally {
      setRestoring(false);
    }
  };

  const fmt = (date: Date | string | null | undefined): string => {
    if (!date) return 'N/A';
    try {
      const d = typeof date === 'string' ? new Date(date) : date;
      return isNaN(d.getTime())
        ? 'N/A'
        : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return 'N/A';
    }
  };

  const managementUrl = details.managementURL || customerInfo?.managementURL || null;

  const priceLabel = (() => {
    const p = details.productIdentifier;
    if (p === PACKAGE_ID_PRO_MONTHLY) return '$9.99 / month';
    if (p === PACKAGE_ID_PRO_ANNUAL) return '$89.91 / year';
    if (p === PACKAGE_ID_PRO_PLUS_MONTHLY) return '$20.00 / month';
    if (p === PACKAGE_ID_PRO_PLUS_ANNUAL) return '$180.00 / year';
    return details.cadence === 'annual' ? 'Annual plan' : 'Monthly plan';
  })();

  const isLoading = sub.isLoading || rcLoading;

  return (
    <div data-route="/account/billing" className="min-h-screen bg-[hsl(var(--background))] text-[hsl(var(--foreground))] font-sans antialiased">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-sm border-b border-[hsl(var(--border))]">
        <div className="w-full max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="flex items-center gap-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"
            >
              <ArrowLeft size={15} />
              <span>Dashboard</span>
            </Link>
            <span className="text-neutral-300 dark:text-neutral-700">/</span>
            <span className="font-semibold text-xs text-neutral-900 dark:text-white">Billing & Subscription</span>
          </div>

          <button
            type="button"
            disabled={restoring || isLoading}
            onClick={handleRestore}
            className="inline-flex items-center gap-1 text-xs font-semibold text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white border border-[hsl(var(--border))] rounded-[8px] px-3 py-1.5 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw size={12} className={restoring ? 'animate-spin' : ''} />
            <span>{restoring ? 'Restoring…' : 'Restore'}</span>
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {/* Title row */}
        <div className="flex items-center justify-between pb-4 border-b border-[hsl(var(--border))]">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
              Subscription & Plan
            </h1>
            <p className="text-xs text-neutral-500 mt-0.5">Manage your workspace tier, quotas, and invoices.</p>
          </div>

          {/* Action button depending on state */}
          {!sub.isProPlus && (
            <Link
              to="/subscribe"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[8px] bg-neutral-900 text-white text-xs font-semibold hover:bg-neutral-800 transition dark:bg-white dark:text-neutral-900 cursor-pointer"
            >
              <Sparkles size={13} />
              <span>
                {sub.isTrial
                  ? 'Choose a Plan'
                  : sub.isPro
                    ? 'Upgrade to Pro+'
                    : sub.trialEligible
                      ? 'Start 7-Day Free Trial'
                      : 'Upgrade to Pro'}
              </span>
            </Link>
          )}
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div className="flex items-center justify-between rounded-[8px] border border-[hsl(var(--border))] bg-white dark:bg-neutral-900 px-4 py-3 text-xs">
            <span className="text-neutral-800 dark:text-neutral-200">{feedback}</span>
            <button
              onClick={() => setFeedback(null)}
              className="text-neutral-500 hover:text-neutral-900 dark:hover:text-white text-xs font-medium cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Loading Skeleton */}
        {isLoading && (
          <div className="rounded-[12px] border border-[hsl(var(--card-border))] bg-white dark:bg-neutral-900 p-8 flex flex-col items-center gap-2">
            <Loader2 size={20} className="animate-spin text-neutral-500" />
            <p className="text-xs text-neutral-500">Checking subscription status…</p>
          </div>
        )}

        {/* Plan Cards */}
        {!isLoading && (
          <div className="space-y-6">
            {/* 1. In Trial State */}
            {sub.isTrial && (
              <div
                className="rounded-[12px] border-2 border-neutral-900 dark:border-white bg-white dark:bg-neutral-900 p-6 shadow-xs space-y-4"
                data-testid="card-billing-trial"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-[10px] bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center shrink-0">
                      <Crown size={20} className="fill-amber-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-base font-bold text-neutral-900 dark:text-white">Take Order Pro</h2>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200">
                          {sub.trialDaysRemaining} DAYS LEFT
                        </span>
                      </div>
                      <p className="text-xs text-neutral-500 mt-0.5">
                        Free trial active with 500 links, full reports, and CSV export.
                      </p>
                    </div>
                  </div>

                  <Link
                    to="/subscribe"
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-[8px] bg-neutral-900 text-white text-xs font-semibold hover:bg-neutral-800 transition dark:bg-white dark:text-neutral-900 cursor-pointer self-start sm:self-auto"
                  >
                    Choose a plan →
                  </Link>
                </div>

                <div className="pt-3 border-t border-[hsl(var(--border))] flex items-center justify-between text-xs text-neutral-500">
                  <span>When your trial ends, your account transitions to Free. No automatic charges occur.</span>
                </div>
              </div>
            )}

            {/* 2. Active Paid Pro or Pro+ */}
            {sub.isPro && !sub.isTrial && (
              <div className="rounded-[12px] border border-[hsl(var(--card-border))] bg-white dark:bg-neutral-900 p-6 shadow-xs space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="h-10 w-10 rounded-[10px] bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 flex items-center justify-center text-xs font-bold shrink-0">
                      {sub.isProPlus ? 'PRO+' : 'PRO'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-base font-bold text-neutral-900 dark:text-white">
                          {sub.isProPlus ? 'Take Order Pro+' : 'Take Order Pro'}
                        </h2>
                        {sub.status === 'cancelled' ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200">
                            Cancelling
                          </span>
                        ) : sub.status === 'billing_issue' ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-200">
                            Payment Issue
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-neutral-500 mt-0.5">{priceLabel}</p>
                    </div>
                  </div>

                  <div className="text-left sm:text-right">
                    <span className="text-[11px] text-neutral-500 block">
                      {sub.status === 'cancelled' ? 'Access ends' : 'Next renewal'}
                    </span>
                    <span className="text-xs font-semibold text-neutral-900 dark:text-white flex items-center gap-1 sm:justify-end mt-0.5">
                      <Calendar size={12} className="text-neutral-500" />
                      {fmt(details.expirationDate || sub.currentPeriodEnd)}
                    </span>
                  </div>
                </div>

                {/* Quotas & Capacity */}
                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-[hsl(var(--border))] text-xs">
                  <div className="p-3 rounded-[8px] bg-neutral-50 dark:bg-neutral-800/50 border border-[hsl(var(--border))]">
                    <span className="text-neutral-500 block text-[11px]">Active Links</span>
                    <strong className="text-neutral-900 dark:text-white text-sm mt-0.5 block">
                      {sub.isProPlus ? 'Unlimited' : `${sub.usage.activeLinkCount} / ${PRO_ACTIVE_LINK_LIMIT}`}
                    </strong>
                  </div>
                  <div className="p-3 rounded-[8px] bg-neutral-50 dark:bg-neutral-800/50 border border-[hsl(var(--border))]">
                    <span className="text-neutral-500 block text-[11px]">Reports Access</span>
                    <strong className="text-emerald-600 text-sm mt-0.5 block">Full Access</strong>
                  </div>
                </div>

                {/* Manage or Upgrade Actions */}
                <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
                  {managementUrl && (
                    <a
                      href={managementUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-800 dark:text-neutral-200 hover:underline"
                    >
                      <ExternalLink size={13} />
                      <span>Manage billing on RevenueCat</span>
                    </a>
                  )}

                  {!sub.isProPlus && (
                    <Link
                      to="/subscribe"
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-[8px] bg-neutral-900 text-white text-xs font-medium hover:bg-neutral-800 transition dark:bg-white dark:text-neutral-900"
                    >
                      <span>Upgrade to Pro+</span>
                      <ChevronRight size={13} />
                    </Link>
                  )}
                </div>
              </div>
            )}

            {/* 3. Free Plan (Never Started Trial or Expired) */}
            {!sub.isPro && !sub.isTrial && (
              <div
                className="rounded-[12px] border border-[hsl(var(--card-border))] bg-white dark:bg-neutral-900 p-6 shadow-xs space-y-5"
                data-testid="card-billing-free"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="h-10 w-10 rounded-[10px] bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 flex items-center justify-center text-xs font-bold shrink-0">
                      FREE
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-base font-bold text-neutral-900 dark:text-white">Take Order Free</h2>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                          Current Tier
                        </span>
                      </div>
                      <p className="text-xs text-neutral-500 mt-0.5">
                        Core commerce: catalog products, buyer checkout, and order receipts.
                      </p>
                    </div>
                  </div>

                  <Link
                    to="/subscribe"
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-[8px] bg-neutral-900 text-white text-xs font-semibold hover:bg-neutral-800 transition dark:bg-white dark:text-neutral-900 cursor-pointer self-start sm:self-auto"
                    data-testid="button-billing-upgrade-pro"
                  >
                    <Sparkles size={13} />
                    <span>{sub.trialEligible ? 'Start 7-Day Free Trial' : 'Upgrade to Pro'}</span>
                  </Link>
                </div>

                {/* Quotas */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-[hsl(var(--border))]">
                  <div className="p-3.5 rounded-[8px] bg-neutral-50 dark:bg-neutral-800/40 border border-[hsl(var(--border))]">
                    <div className="flex items-center justify-between text-xs text-neutral-500 mb-1">
                      <span className="flex items-center gap-1.5 font-medium">
                        <Boxes size={13} />
                        <span>Catalog Items</span>
                      </span>
                      <strong className="text-emerald-600 font-semibold">Unlimited</strong>
                    </div>
                    <p className="text-[11px] text-neutral-500">
                      {sub.usage.catalogProductCount} items created · No limit
                    </p>
                  </div>

                  <div className="p-3.5 rounded-[8px] bg-neutral-50 dark:bg-neutral-800/40 border border-[hsl(var(--border))]">
                    <div className="flex items-center justify-between text-xs text-neutral-500 mb-1">
                      <span className="flex items-center gap-1.5 font-medium">
                        <Link2 size={13} />
                        <span>Active Links Allowance</span>
                      </span>
                      <strong
                        className={cn(
                          sub.limits.activeLinkLimitReached ? 'text-rose-600' : 'text-neutral-900 dark:text-white'
                        )}
                      >
                        {sub.usage.activeLinkCount} / {FREE_ACTIVE_LINK_LIMIT}
                      </strong>
                    </div>
                    <div className="h-1.5 w-full bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all',
                          sub.limits.activeLinkLimitReached ? 'bg-rose-500' : 'bg-neutral-900 dark:bg-white'
                        )}
                        style={{
                          width: `${Math.min(100, (sub.usage.activeLinkCount / FREE_ACTIVE_LINK_LIMIT) * 100)}%`,
                        }}
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-neutral-500">
                      {Math.max(0, FREE_ACTIVE_LINK_LIMIT - sub.usage.activeLinkCount)} links remaining on Free
                    </p>
                  </div>
                </div>

                <div className="text-[11px] text-neutral-500 flex items-center gap-1.5 pt-1">
                  <ShieldCheck size={13} className="text-emerald-500 shrink-0" />
                  <span>Your products, buyer links, and customer records are never deleted on downgrade.</span>
                </div>
              </div>
            )}

            {/* Quick Actions List */}
            <div className="rounded-[12px] border border-[hsl(var(--card-border))] bg-white dark:bg-neutral-900 divide-y divide-[hsl(var(--border))] overflow-hidden">
              <div className="flex items-center justify-between p-4">
                <div>
                  <span className="text-xs font-semibold text-neutral-900 dark:text-white">Change Plan</span>
                  <p className="text-[11.5px] text-neutral-500 mt-0.5">Switch between Pro, Pro+, or annual billing.</p>
                </div>
                <Link
                  to="/subscribe"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-neutral-800 dark:text-neutral-200 border border-[hsl(var(--border))] rounded-[8px] px-3 py-1.5 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition"
                >
                  <span>Select</span>
                  <ChevronRight size={12} />
                </Link>
              </div>

              <div className="flex items-center justify-between p-4">
                <div>
                  <span className="text-xs font-semibold text-neutral-900 dark:text-white">Restore Purchases</span>
                  <p className="text-[11.5px] text-neutral-500 mt-0.5">
                    Sync purchases if you upgraded on another device.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={restoring}
                  onClick={handleRestore}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-neutral-800 dark:text-neutral-200 border border-[hsl(var(--border))] rounded-[8px] px-3 py-1.5 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw size={12} className={restoring ? 'animate-spin' : ''} />
                  <span>Restore</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default BillingPage;
