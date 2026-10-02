import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Check, Loader2, ArrowLeft, ShieldCheck, AlertCircle, Sparkles, Crown } from 'lucide-react';
import {
  getCurrentOfferingTierPackages,
  purchaseProPackage,
  restorePurchases,
  formatPackagePrice,
  formatPackageMonthlyEquivalent,
  type OfferingTierPackages,
  type PlanTier,
} from '@/lib/revenuecat';
import { useAppAuth } from '@/lib/auth-context';
import { useSubscription } from '@/lib/subscription';

type BillingPeriod = 'annual' | 'monthly';

const PRO_FEATURES = [
  'Unlimited catalog products',
  '500 active Take Order links allowance',
  'Complete financial & sales reports',
  'CSV sales & orders data export',
  'WhatsApp & SMS dispatch slips',
  'Priority order operations & preview caching',
];

const PRO_PLUS_FEATURES = [
  'Everything in Pro',
  'Unlimited active Take Order links (no ceiling)',
  'Executive business intelligence (AOV, margins, customer LTV)',
  'Multi-channel conversion optimization insights',
  'Gold merchant verification badge',
  'Dedicated priority support',
];

export function SubscribePage() {
  const [, setLocation] = useLocation();
  const { userId, email } = useAppAuth();
  const effectiveUserId =
    userId ||
    (typeof window !== 'undefined' ? localStorage.getItem('duka-test-user-id') : null);

  const sub = useSubscription(effectiveUserId);

  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('annual');
  const [selectedTier, setSelectedTier] = useState<PlanTier>('pro_plus');
  const [packages, setPackages] = useState<OfferingTierPackages | null>(null);
  const [loadingPackages, setLoadingPackages] = useState(true);
  const [packageError, setPackageError] = useState<string | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null);
  const [cardsReady, setCardsReady] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const pkgs = await getCurrentOfferingTierPackages(effectiveUserId);
        if (alive) {
          setPackages(pkgs);
          const hasAny = Boolean(
            pkgs.proMonthly || pkgs.proAnnual || pkgs.proPlusMonthly || pkgs.proPlusAnnual
          );
          if (!hasAny) {
            setPackageError(
              'No active Web Billing packages are attached to the current offering in RevenueCat. In your RevenueCat dashboard, please attach your Web Billing products to the packages in your active offering ("boss plans").'
            );
          } else {
            if (!pkgs.proPlusAnnual && !pkgs.proPlusMonthly && (pkgs.proAnnual || pkgs.proMonthly)) {
              setSelectedTier('pro');
            }
            if (!pkgs.proPlusAnnual && !pkgs.proAnnual && (pkgs.proPlusMonthly || pkgs.proMonthly)) {
              setBillingPeriod('monthly');
            }
          }
          setTimeout(() => setCardsReady(true), 80);
        }
      } catch (e: unknown) {
        if (alive) setPackageError(e instanceof Error ? e.message : 'Failed to load plans');
      } finally {
        if (alive) setLoadingPackages(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [effectiveUserId]);

  const toggleBilling = (p: BillingPeriod) => {
    setCardsReady(false);
    setTimeout(() => {
      setBillingPeriod(p);
      setCardsReady(true);
    }, 130);
  };

  const activePackage = React.useMemo(() => {
    if (!packages) return null;
    return selectedTier === 'pro'
      ? billingPeriod === 'annual'
        ? packages.proAnnual
        : packages.proMonthly
      : billingPeriod === 'annual'
        ? packages.proPlusAnnual
        : packages.proPlusMonthly;
  }, [packages, selectedTier, billingPeriod]);

  const proPrice =
    billingPeriod === 'annual'
      ? formatPackagePrice(packages?.proAnnual, '$89.91/yr')
      : formatPackagePrice(packages?.proMonthly, '$9.99/mo');
  const proEquiv = formatPackageMonthlyEquivalent(packages?.proAnnual, '$7.49');

  const proPlusPrice =
    billingPeriod === 'annual'
      ? formatPackagePrice(packages?.proPlusAnnual, '$180/yr')
      : formatPackagePrice(packages?.proPlusMonthly, '$20/mo');
  const proPlusEquiv = formatPackageMonthlyEquivalent(packages?.proPlusAnnual, '$15.00');

  const selectedPrice = selectedTier === 'pro' ? proPrice : proPlusPrice;

  const handlePurchase = async () => {
    setPurchasing(true);
    setPurchaseError(null);
    try {
      // If eligible for trial, start trial first
      if (sub.trialEligible) {
        const ok = await sub.startTrial();
        if (ok) {
          setLocation('/account/billing');
          return;
        }
      }

      if (activePackage) {
        const result = await purchaseProPackage(activePackage, effectiveUserId, email);
        if (result.cancelled) return;
        if (result.success) {
          await sub.refresh();
          setLocation('/account/billing');
          return;
        } else if (result.error) {
          setPurchaseError(result.error);
          return;
        }
      }

      // Fallback trial activation
      if (effectiveUserId && sub.trialEligible) {
        await sub.startTrial();
        setLocation('/account/billing');
      }
    } catch (e: unknown) {
      setPurchaseError(e instanceof Error ? e.message : 'Subscription checkout failed');
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    setRestoreMessage(null);
    try {
      const customerInfo = await restorePurchases();
      await sub.refresh();
      const hasRestored = Boolean(
        customerInfo?.entitlements.active['take_order_app_pro_plus'] ||
          customerInfo?.entitlements.active['take_order_app_pro']
      );
      setRestoreMessage(
        hasRestored ? 'Subscription restored successfully!' : 'No previous active subscription found.'
      );
    } catch (e: unknown) {
      setRestoreMessage(e instanceof Error ? e.message : 'Restore failed');
    } finally {
      setRestoring(false);
    }
  };

  const ctaLabel = (() => {
    if (sub.isProPlus) return 'Manage Subscription';
    if (sub.isPro && selectedTier === 'pro') return 'Current Plan';
    if (sub.isPro && selectedTier === 'pro_plus') return `Upgrade to Pro+ (${proPlusPrice})`;
    if (sub.status === 'in_trial') return `Choose ${selectedTier === 'pro_plus' ? 'Pro+' : 'Pro'} (${selectedPrice})`;
    if (sub.status === 'cancelled') return `Resubscribe to ${selectedTier === 'pro_plus' ? 'Pro+' : 'Pro'}`;
    if (sub.status === 'billing_issue') return 'Fix Payment Method';
    if (sub.trialEligible) return 'Start 7-Day Free Trial →';
    return `Subscribe to ${selectedTier === 'pro_plus' ? 'Pro+' : 'Pro'} (${selectedPrice})`;
  })();

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] text-[hsl(var(--foreground))] font-sans antialiased">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-sm border-b border-[hsl(var(--border))]">
        <div className="w-full max-w-4xl mx-auto px-6 sm:px-8 h-16 flex items-center justify-between">
          <Link
            to="/"
            className="flex items-center gap-2 text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft size={16} />
            <span>Dashboard</span>
          </Link>

          <button
            type="button"
            disabled={restoring}
            onClick={handleRestore}
            className="text-xs font-semibold text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white border border-[hsl(var(--border))] rounded-[8px] px-3 py-1.5 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {restoring ? 'Restoring…' : 'Restore Purchases'}
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 sm:px-8 py-10 space-y-8">
        {/* Title */}
        <div className="text-center max-w-xl mx-auto space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 text-xs font-bold uppercase tracking-wider">
            <Sparkles size={12} className="text-amber-500" />
            <span>Take Order Plans</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-neutral-900 dark:text-white">
            Simple, Transparent Pricing
          </h1>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Automate buyer checkout, access financial analytics, and manage unlimited orders.
          </p>
        </div>

        {/* State Banners */}
        {sub.isProPlus && (
          <div className="rounded-[12px] border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900 flex items-center justify-between dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-200">
            <div className="flex items-center gap-2">
              <Crown size={16} className="text-amber-600 fill-amber-500" />
              <span>You are on <strong>Take Order Pro+</strong> with unlimited active links and executive analytics.</span>
            </div>
            <Link to="/account/billing" className="font-semibold underline ml-2">
              Manage →
            </Link>
          </div>
        )}

        {sub.isTrial && (
          <div className="rounded-[12px] border border-blue-200 bg-blue-50 p-4 text-xs text-blue-900 flex items-center justify-between dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-200">
            <span>
              You have <strong>{sub.trialDaysRemaining} {sub.trialDaysRemaining === 1 ? 'day' : 'days'} left</strong> in your free trial. Choose a plan to continue without interruption.
            </span>
            <Link to="/account/billing" className="font-semibold underline ml-2">
              View trial →
            </Link>
          </div>
        )}

        {sub.status === 'cancelled' && (
          <div className="rounded-[12px] border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900 flex items-center justify-between dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-200">
            <span>
              Your subscription was cancelled and remains active until{' '}
              <strong>{sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toLocaleDateString() : 'period end'}</strong>.
            </span>
          </div>
        )}

        {sub.status === 'billing_issue' && (
          <div className="rounded-[12px] border border-rose-300 bg-rose-50 p-4 text-xs text-rose-900 flex items-center justify-between dark:bg-rose-950/30 dark:border-rose-800 dark:text-rose-200">
            <span>
              Billing Issue: Please update your payment method to keep your Pro features active.
            </span>
            <Link to="/account/billing" className="font-semibold underline ml-2">
              Fix payment →
            </Link>
          </div>
        )}

        {/* Monthly / Annual Toggle */}
        <div className="flex justify-center">
          <div
            className="inline-flex rounded-[12px] p-1 gap-1 bg-neutral-100 dark:bg-neutral-800 border border-[hsl(var(--border))]"
            role="radiogroup"
            aria-label="Billing period"
          >
            {(['annual', 'monthly'] as BillingPeriod[]).map((p) => (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={billingPeriod === p}
                onClick={() => toggleBilling(p)}
                className={`flex items-center gap-2 px-4 py-2 rounded-[8px] text-xs font-semibold transition-all cursor-pointer ${
                  billingPeriod === p
                    ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-xs'
                    : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                <span className="capitalize">{p}</span>
                {p === 'annual' && (
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
                    Save 25%
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Plan Cards Grid: Strictly White Cards */}
        {loadingPackages ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 size={24} className="animate-spin text-neutral-500" />
            <p className="text-xs text-neutral-500">Loading plan options…</p>
          </div>
        ) : packageError ? (
          <div className="rounded-[12px] bg-white dark:bg-neutral-900 border border-amber-200 p-6 text-center space-y-3">
            <AlertCircle size={20} className="mx-auto text-amber-600" />
            <div className="text-sm font-bold text-neutral-900 dark:text-white">Web Billing Setup Required</div>
            <p className="text-xs text-neutral-500 max-w-md mx-auto">{packageError}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[8px] bg-neutral-900 text-white text-xs font-medium hover:bg-neutral-800 transition"
            >
              Retry
            </button>
          </div>
        ) : (
          <div
            className="grid grid-cols-1 md:grid-cols-2 gap-6"
            style={{
              opacity: cardsReady ? 1 : 0,
              transform: cardsReady ? 'translateY(0)' : 'translateY(8px)',
              transition: 'opacity 0.2s ease, transform 0.2s ease',
            }}
          >
            {/* Pro Card (White Card) */}
            <div
              onClick={() => setSelectedTier('pro')}
              className={`rounded-[12px] p-6 sm:p-8 flex flex-col justify-between transition-all cursor-pointer bg-white dark:bg-neutral-900 ${
                selectedTier === 'pro'
                  ? 'border-2 border-neutral-900 dark:border-white shadow-md'
                  : 'border border-[hsl(var(--card-border))] hover:border-neutral-400'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="px-2.5 py-1 rounded-[6px] bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs font-bold uppercase tracking-wider">
                    Take Order Pro
                  </span>
                  <span className="text-xs text-neutral-500">
                    {billingPeriod === 'annual' ? 'Billed annually' : 'Billed monthly'}
                  </span>
                </div>

                <div className="text-3xl sm:text-4xl font-extrabold text-neutral-900 dark:text-white tracking-tight">
                  {proPrice}
                </div>
                {billingPeriod === 'annual' && (
                  <p className="text-xs text-neutral-500 mt-1 font-medium">{proEquiv}/mo equivalent</p>
                )}

                <p className="mt-3 text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                  For growing social commerce sellers scaling order collection and financial tracking.
                </p>

                <div className="mt-6 pt-5 border-t border-[hsl(var(--border))] space-y-2.5 text-xs text-neutral-700 dark:text-neutral-300">
                  {PRO_FEATURES.map((f) => (
                    <div key={f} className="flex items-center gap-2.5">
                      <div className="h-4 w-4 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center shrink-0">
                        <Check size={10} className="text-neutral-900 dark:text-white stroke-[3]" />
                      </div>
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-8">
                <div
                  className={`w-full py-2.5 rounded-[8px] text-xs font-bold text-center transition-all ${
                    sub.isPro && !sub.isProPlus
                      ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600'
                      : selectedTier === 'pro'
                        ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                        : 'border border-[hsl(var(--border))] text-neutral-800 dark:text-neutral-200 hover:bg-neutral-50'
                  }`}
                >
                  {sub.isPro && !sub.isProPlus ? 'Current Plan' : selectedTier === 'pro' ? '✓ Selected' : 'Select Pro'}
                </div>
              </div>
            </div>

            {/* Pro+ Card (White Card with Highlight Border & Badge - NO dark fill) */}
            <div
              onClick={() => setSelectedTier('pro_plus')}
              className={`rounded-[12px] p-6 sm:p-8 flex flex-col justify-between transition-all cursor-pointer relative overflow-hidden bg-white dark:bg-neutral-900 ${
                selectedTier === 'pro_plus'
                  ? 'border-2 border-neutral-900 dark:border-white shadow-md'
                  : 'border-2 border-neutral-300 dark:border-neutral-700 hover:border-neutral-500'
              }`}
            >
              {/* Highlight Badge */}
              <div className="absolute top-0 right-0 bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-bl-[10px]">
                Unlimited Links
              </div>

              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-1.5">
                    <span className="px-2.5 py-1 rounded-[6px] bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs font-bold uppercase tracking-wider">
                      Take Order Pro+
                    </span>
                    <Crown size={14} className="text-amber-500 fill-amber-400" />
                  </div>
                  <span className="text-xs text-neutral-500">
                    {billingPeriod === 'annual' ? 'Billed annually' : 'Billed monthly'}
                  </span>
                </div>

                <div className="text-3xl sm:text-4xl font-extrabold text-neutral-900 dark:text-white tracking-tight">
                  {proPlusPrice}
                </div>
                {billingPeriod === 'annual' && (
                  <p className="text-xs text-neutral-500 mt-1 font-medium">{proPlusEquiv}/mo equivalent</p>
                )}

                <p className="mt-3 text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                  For high-volume merchants needing unlimited order link capacity and executive analytics.
                </p>

                <div className="mt-6 pt-5 border-t border-[hsl(var(--border))] space-y-2.5 text-xs text-neutral-700 dark:text-neutral-300">
                  {PRO_PLUS_FEATURES.map((f) => (
                    <div key={f} className="flex items-center gap-2.5">
                      <div className="h-4 w-4 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center shrink-0">
                        <Check size={10} className="text-neutral-900 dark:text-white stroke-[3]" />
                      </div>
                      <span className="font-medium">{f}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-8">
                <div
                  className={`w-full py-2.5 rounded-[8px] text-xs font-bold text-center transition-all ${
                    sub.isProPlus
                      ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600'
                      : selectedTier === 'pro_plus'
                        ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                        : 'border border-[hsl(var(--border))] text-neutral-800 dark:text-neutral-200 hover:bg-neutral-50'
                  }`}
                >
                  {sub.isProPlus ? 'Current Plan' : selectedTier === 'pro_plus' ? '✓ Selected' : 'Select Pro+'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error / Feedback Messages */}
        {purchaseError && (
          <div className="flex items-center gap-2.5 rounded-[8px] bg-rose-50 border border-rose-200 px-4 py-3 text-xs text-rose-700 dark:bg-rose-950/30 dark:border-rose-900 dark:text-rose-300">
            <AlertCircle size={14} className="shrink-0" />
            <span>{purchaseError}</span>
          </div>
        )}

        {restoreMessage && (
          <p className="text-center text-xs text-neutral-600 dark:text-neutral-400 font-medium">
            {restoreMessage}
          </p>
        )}

        {/* Bottom CTA Button */}
        <div className="max-w-md mx-auto space-y-3 pt-2">
          {sub.isProPlus ? (
            <Link
              to="/account/billing"
              className="w-full flex items-center justify-center h-11 rounded-[8px] bg-neutral-900 text-white text-xs font-semibold hover:bg-neutral-800 transition cursor-pointer dark:bg-white dark:text-neutral-900"
            >
              Manage Subscription in Billing
            </Link>
          ) : (
            <button
              type="button"
              disabled={purchasing || (sub.isPro && selectedTier === 'pro')}
              onClick={handlePurchase}
              className="w-full flex items-center justify-center gap-2 h-11 rounded-[8px] bg-neutral-900 text-white text-xs font-semibold hover:bg-neutral-800 disabled:opacity-50 transition cursor-pointer dark:bg-white dark:text-neutral-900"
            >
              {purchasing && <Loader2 size={14} className="animate-spin" />}
              <span>{ctaLabel}</span>
            </button>
          )}

          <p className="text-center text-[11px] text-neutral-500">
            {sub.trialEligible
              ? '7-day trial, then auto-renews at ' + selectedPrice + '. Cancel anytime.'
              : selectedPrice + ', auto-renewing. Cancel anytime.'}
          </p>
        </div>

        {/* Footer Links */}
        <div className="pt-6 border-t border-[hsl(var(--border))] flex flex-wrap items-center justify-center gap-4 text-xs text-neutral-500">
          <button
            type="button"
            disabled={restoring}
            onClick={handleRestore}
            className="hover:text-neutral-900 dark:hover:text-white transition cursor-pointer disabled:opacity-50"
          >
            Restore Purchases
          </button>
          <span>·</span>
          <Link to="/terms" className="hover:text-neutral-900 dark:hover:text-white transition">
            Terms of Service
          </Link>
          <span>·</span>
          <Link to="/privacy" className="hover:text-neutral-900 dark:hover:text-white transition">
            Privacy Policy
          </Link>
          <span>·</span>
          <Link to="/refund-policy" className="hover:text-neutral-900 dark:hover:text-white transition">
            Refund Policy
          </Link>
        </div>

        <div className="flex items-center justify-center gap-1.5 text-xs text-neutral-400">
          <ShieldCheck size={13} className="text-emerald-500" />
          <span>Secured by RevenueCat</span>
        </div>
      </main>
    </div>
  );
}

export default SubscribePage;
