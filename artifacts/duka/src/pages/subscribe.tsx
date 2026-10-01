import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Check, Loader2, ArrowLeft, ShieldCheck, AlertCircle } from 'lucide-react';
import {
  getCurrentOfferingTierPackages,
  purchaseProPackage,
  restorePurchases,
  useEntitlement,
  formatPackagePrice,
  formatPackageMonthlyEquivalent,
  type OfferingTierPackages,
  type PlanTier,
} from '@/lib/revenuecat';
import { useAppAuth } from '@/lib/auth-context';

type BillingPeriod = 'annual' | 'monthly';

// Warm cream matching the reference design
const CREAM = '#EDE8DF';
const CREAM_HEADER = 'rgba(237,232,223,0.93)';

const PRO_FEATURES = [
  'Unlimited catalog products (vs. 10 on Free)',
  'High active link capacity (250 active Take Order links)',
  'Complete channel conversion analytics',
  'CSV sales & raw orders data export',
  'Week-over-week period comparisons',
  'Priority order operations & preview caching',
];

const PRO_PLUS_FEATURES = [
  'Everything in Pro',
  'Unlimited active Take Order links (semantic unlimited)',
  'Executive intelligence (AOV, settlement velocity, ROI)',
  'Multi-channel conversion optimization insights',
  'Highest-density operating view',
  'Priority feature access & dedicated support',
];

export function SubscribePage() {
  const [, setLocation] = useLocation();
  const { userId, email } = useAppAuth();
  const effectiveUserId =
    userId ||
    (typeof window !== 'undefined' ? localStorage.getItem('duka-test-user-id') : null);

  const { isPro, isProPlus, tier: activeTier, isLoading: isEntitlementLoading, refresh: refreshEntitlements } =
    useEntitlement(effectiveUserId);

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
        if (alive) { setPackages(pkgs); setTimeout(() => setCardsReady(true), 80); }
      } catch (e: unknown) {
        if (alive) setPackageError(e instanceof Error ? e.message : 'Failed to load plans');
      } finally {
        if (alive) setLoadingPackages(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const toggleBilling = (p: BillingPeriod) => {
    setCardsReady(false);
    setTimeout(() => { setBillingPeriod(p); setCardsReady(true); }, 130);
  };

  const activePackage = React.useMemo(() => {
    if (!packages) return null;
    return selectedTier === 'pro'
      ? (billingPeriod === 'annual' ? packages.proAnnual : packages.proMonthly)
      : (billingPeriod === 'annual' ? packages.proPlusAnnual : packages.proPlusMonthly);
  }, [packages, selectedTier, billingPeriod]);

  const proPrice = billingPeriod === 'annual'
    ? formatPackagePrice(packages?.proAnnual, '$89.91/yr')
    : formatPackagePrice(packages?.proMonthly, '$9.99/mo');
  const proEquiv = formatPackageMonthlyEquivalent(packages?.proAnnual, '$7.49');

  const proPlusPrice = billingPeriod === 'annual'
    ? formatPackagePrice(packages?.proPlusAnnual, '$180/yr')
    : formatPackagePrice(packages?.proPlusMonthly, '$20/mo');
  const proPlusEquiv = formatPackageMonthlyEquivalent(packages?.proPlusAnnual, '$15.00');

  const selectedPrice = selectedTier === 'pro' ? proPrice : proPlusPrice;

  const handlePurchase = async () => {
    if (!activePackage) return;
    setPurchasing(true);
    setPurchaseError(null);
    try {
      const result = await purchaseProPackage(activePackage, effectiveUserId, email);
      if (result.cancelled) return;
      if (result.success) { await refreshEntitlements(); setLocation('/account/billing'); }
      else if (result.error) setPurchaseError(result.error);
    } catch (e: unknown) {
      setPurchaseError(e instanceof Error ? e.message : 'Purchase failed');
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    setRestoreMessage(null);
    try {
      const info = await restorePurchases();
      await refreshEntitlements();
      setRestoreMessage(
        info && (info.entitlements.active['take_order_app_pro_plus'] || info.entitlements.active['take_order_app_pro'])
          ? 'Subscription restored!'
          : 'No active subscription found.'
      );
    } catch (e: unknown) {
      setRestoreMessage(e instanceof Error ? e.message : 'Restore failed');
    } finally {
      setRestoring(false);
    }
  };

  const hasActiveSub = isPro || isProPlus || activeTier !== 'none';

  return (
    <div className="min-h-screen font-sans antialiased flex flex-col" style={{ background: CREAM }}>

      {/* ── Header ── */}
      <header
        className="sticky top-0 z-30 border-b backdrop-blur-sm"
        style={{ background: CREAM_HEADER, borderColor: 'rgba(0,0,0,0.08)' }}
      >
        <div className="w-full max-w-5xl mx-auto px-8 h-16 flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={16} />
            Back
          </Link>
          <div className="flex items-center gap-2.5">
            <img src="/branding/takeorder-icon.png" alt="Take Order" className="h-7 w-7 rounded-lg object-contain shadow-2xs" />
            <span className="font-black tracking-tight text-lg text-neutral-900 leading-none">
              Take<span className="text-[#F5B418]">Order</span>
            </span>
          </div>
          {hasActiveSub ? (
            <Link to="/account/billing" className="text-sm font-semibold hover:underline underline-offset-2 transition-colors">
              Manage billing →
            </Link>
          ) : (
            <div className="w-16" />
          )}
        </div>
      </header>

      {/* ── Main ── */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-8 pt-12 pb-16 flex flex-col gap-10">

        {/* Headline */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-extrabold tracking-tight text-foreground">Upgrade Take Order</h1>
          <p className="text-base text-muted-foreground">All plans include a 7-day free trial. Cancel anytime.</p>
        </div>

        {/* Already subscribed */}
        {hasActiveSub && (
          <div
            className="flex items-center justify-between gap-3 rounded-2xl px-5 py-4 bg-white"
            style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}
          >
            <div className="flex items-center gap-2.5">
              <Check size={16} className="text-emerald-500 shrink-0 stroke-[2.5]" />
              <span className="text-sm font-medium">
                Subscribed to <strong>{activeTier === 'pro_plus' ? 'Pro+' : 'Pro'}</strong>
              </span>
            </div>
            <Link to="/account/billing" className="text-sm font-semibold underline underline-offset-2 shrink-0">
              Manage →
            </Link>
          </div>
        )}

        {/* Billing toggle */}
        <div className="flex justify-center">
          <div
            className="inline-flex rounded-xl p-1.5 gap-1"
            style={{ background: 'rgba(0,0,0,0.07)' }}
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
                className={[
                  'flex items-center gap-2.5 px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-200',
                  billingPeriod === p
                    ? 'bg-white text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                ].join(' ')}
              >
                <span className="capitalize">{p}</span>
                {p === 'annual' && (
                  <span className={[
                    'text-[11px] font-bold px-2 py-0.5 rounded-full transition-all duration-200',
                    billingPeriod === 'annual'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-black/10 text-muted-foreground',
                  ].join(' ')}>
                    Save 25%
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Cards */}
        {loadingPackages ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <Loader2 size={28} className="animate-spin text-muted-foreground" />
            <p className="text-base text-muted-foreground">Loading plans…</p>
          </div>
        ) : packageError ? (
          <div className="flex items-center gap-3 rounded-2xl bg-white px-5 py-4 text-sm text-destructive" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
            <AlertCircle size={16} className="shrink-0" />
            {packageError}
            <button onClick={() => window.location.reload()} className="ml-auto text-sm font-semibold underline">Retry</button>
          </div>
        ) : (
          <div
            className="grid grid-cols-1 md:grid-cols-2 gap-6"
            style={{
              opacity: cardsReady ? 1 : 0,
              transform: cardsReady ? 'translateY(0)' : 'translateY(12px)',
              transition: 'opacity 0.28s ease, transform 0.28s ease',
            }}
          >
            {/* ── Pro Card ── */}
            <button
              type="button"
              onClick={() => setSelectedTier('pro')}
              className={`relative text-left rounded-3xl flex flex-col justify-between p-8 sm:p-10 transition-all duration-200 focus:outline-none cursor-pointer border-2 ${
                selectedTier === 'pro'
                  ? 'border-neutral-900 shadow-md ring-2 ring-neutral-900/10'
                  : 'border-neutral-200 shadow-xs hover:border-neutral-400'
              } bg-white`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="px-3 py-1 rounded-full bg-neutral-100 text-neutral-800 text-xs font-bold uppercase tracking-wider border border-neutral-200">
                    Pro
                  </span>
                  <span className="text-xs text-neutral-500 font-semibold">
                    {billingPeriod === 'annual' ? 'Annual (25% off)' : 'Monthly'}
                  </span>
                </div>

                <div className="mt-6 flex items-baseline gap-1">
                  <span className="text-4xl sm:text-5xl font-bold text-neutral-800 tracking-tight">{proPrice}</span>
                </div>
                {billingPeriod === 'annual' && (
                  <p className="text-xs text-neutral-500 mt-1 font-medium">{proEquiv}/mo billed annually</p>
                )}

                <p className="mt-3 text-sm text-neutral-600 leading-relaxed">
                  For rising sellers ready to eliminate manual chat order negotiations and organize their catalog.
                </p>

                <div className="mt-8 pt-6 border-t border-neutral-100 space-y-3.5 text-sm font-medium text-neutral-700">
                  {PRO_FEATURES.map((f) => (
                    <div key={f} className="flex items-center gap-3">
                      <div className="h-5 w-5 rounded-full bg-neutral-100 flex items-center justify-center shrink-0">
                        <Check size={12} className="text-neutral-900 stroke-[3]" />
                      </div>
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-10">
                <div
                  className={`w-full py-3.5 rounded-full text-sm font-bold text-center transition-all ${
                    selectedTier === 'pro'
                      ? 'bg-neutral-950 text-white shadow-xs'
                      : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                  }`}
                >
                  {selectedTier === 'pro' ? '✓ Selected Plan' : 'Select Pro'}
                </div>
              </div>
            </button>

            {/* ── Pro+ Card (Featured High-Contrast) ── */}
            <button
              type="button"
              onClick={() => setSelectedTier('pro_plus')}
              className={`relative text-left rounded-3xl flex flex-col justify-between p-8 sm:p-10 transition-all duration-200 focus:outline-none cursor-pointer border-2 ${
                selectedTier === 'pro_plus'
                  ? 'border-[#F5B418] shadow-xl ring-2 ring-[#F5B418]/20'
                  : 'border-neutral-800 shadow-lg hover:border-neutral-700'
              } bg-neutral-950 text-white overflow-hidden`}
            >
              {/* Most Popular badge */}
              <div className="absolute top-0 right-0 bg-[#F5B418] text-neutral-950 text-[11px] font-bold uppercase tracking-wider px-4 py-1 rounded-bl-xl shadow-xs">
                Most Popular
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <span className="px-3 py-1 rounded-full bg-neutral-800 text-white text-xs font-bold uppercase tracking-wider border border-neutral-700">
                    Pro+
                  </span>
                  <span className="text-xs text-neutral-400 font-semibold">
                    {billingPeriod === 'annual' ? 'Annual (25% off)' : 'Monthly'}
                  </span>
                </div>

                <div className="mt-6 flex items-baseline gap-1">
                  <span className="text-4xl sm:text-5xl font-bold text-white tracking-tight">{proPlusPrice}</span>
                </div>
                {billingPeriod === 'annual' && (
                  <p className="text-xs text-neutral-400 mt-1 font-medium">{proPlusEquiv}/mo billed annually</p>
                )}

                <p className="mt-3 text-sm text-neutral-300 leading-relaxed">
                  For high-volume merchants needing unlimited capacity, custom branding, and priority support.
                </p>

                <div className="mt-8 pt-6 border-t border-neutral-800 space-y-3.5 text-sm font-medium text-neutral-200">
                  {PRO_PLUS_FEATURES.map((f) => (
                    <div key={f} className="flex items-center gap-3">
                      <div className="h-5 w-5 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center shrink-0">
                        <Check size={12} className="text-[#F5B418] stroke-[3]" />
                      </div>
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-10">
                <div
                  className={`w-full py-3.5 rounded-full text-sm font-bold text-center transition-all ${
                    selectedTier === 'pro_plus'
                      ? 'bg-white text-neutral-950 shadow-xs'
                      : 'bg-neutral-800 text-white hover:bg-neutral-700'
                  }`}
                >
                  {selectedTier === 'pro_plus' ? '✓ Selected Plan' : 'Select Pro+'}
                </div>
              </div>
            </button>
          </div>
        )}

        {/* Error / restore feedback */}
        {purchaseError && (
          <div className="flex items-center gap-3 rounded-2xl bg-white px-5 py-4 text-sm text-destructive" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
            <AlertCircle size={15} className="shrink-0" />
            {purchaseError}
          </div>
        )}
        {restoreMessage && (
          <p className="text-center text-sm text-muted-foreground">{restoreMessage}</p>
        )}

        {/* ── CTA ── */}
        {!loadingPackages && !packageError && (
          <div className="flex flex-col gap-4">
            {hasActiveSub ? (
              <Link
                to="/account/billing"
                className="w-full flex items-center justify-center py-4 rounded-2xl font-bold text-base transition-opacity hover:opacity-90 active:scale-[0.99]"
                style={{ background: 'hsl(222 47% 11%)', color: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
              >
                Manage Subscription
              </Link>
            ) : (
              <button
                type="button"
                disabled={purchasing || loadingPackages || !activePackage}
                onClick={handlePurchase}
                className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-base transition-opacity hover:opacity-90 active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: 'hsl(222 47% 11%)', color: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
              >
                {purchasing && <Loader2 size={16} className="animate-spin" />}
                Start 7-Day Free Trial →
              </button>
            )}
            <p className="text-center text-sm text-muted-foreground">
              Then {selectedPrice}, auto-renewing. Cancel anytime.
            </p>
            <p className="text-center text-xs text-muted-foreground/80 leading-normal">
              By subscribing, you agree to our{' '}
              <Link to="/terms" className="underline hover:text-foreground font-medium">Terms of Service</Link>,{' '}
              <Link to="/privacy" className="underline hover:text-foreground font-medium">Privacy Policy</Link>, and{' '}
              <Link to="/refund-policy" className="underline hover:text-foreground font-medium">Refund Policy</Link>.
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground">
          <button type="button" disabled={restoring} onClick={handleRestore} className="hover:text-foreground transition-colors disabled:opacity-50">
            {restoring ? 'Restoring…' : 'Restore Purchases'}
          </button>
          <span style={{ color: '#d1d5db' }}>·</span>
          <Link to="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link>
          <span style={{ color: '#d1d5db' }}>·</span>
          <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
          <span style={{ color: '#d1d5db' }}>·</span>
          <Link to="/refund-policy" className="hover:text-foreground transition-colors">Refund Policy</Link>
        </div>

        <div className="flex items-center justify-center gap-1.5 text-sm" style={{ color: '#9ca3af' }}>
          <ShieldCheck size={13} className="text-emerald-500" />
          Secured by RevenueCat
        </div>
      </main>
    </div>
  );
}

export default SubscribePage;
