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
  const { userId } = useAppAuth();
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
      const result = await purchaseProPackage(activePackage, effectiveUserId);
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
          <h1 className="text-4xl font-extrabold tracking-tight text-foreground">Upgrade TakeOrder</h1>
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
            className="grid grid-cols-1 md:grid-cols-2 gap-5"
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
              className="relative text-left rounded-2xl flex flex-col gap-6 transition-all duration-200 focus:outline-none group overflow-hidden"
              style={{
                background: '#fff',
                padding: '28px',
                boxShadow: selectedTier === 'pro'
                  ? '0 0 0 2px hsl(222 47% 11%), 0 8px 24px rgba(0,0,0,0.1)'
                  : '0 1px 4px rgba(0,0,0,0.08), 0 4px 16px rgba(0,0,0,0.04)',
                transform: selectedTier === 'pro' ? 'translateY(-2px)' : 'translateY(0)',
              }}
            >
              {/* Selection dot */}
              <span
                className="absolute top-5 right-5 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-200"
                style={{
                  borderColor: selectedTier === 'pro' ? 'hsl(222 47% 11%)' : '#d1d5db',
                  background: selectedTier === 'pro' ? 'hsl(222 47% 11%)' : 'transparent',
                }}
              >
                {selectedTier === 'pro' && <Check size={11} className="text-white stroke-[3]" />}
              </span>

              {activeTier === 'pro' && (
                <span className="absolute top-5 left-5 text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                  Current
                </span>
              )}

              {/* Header */}
              <div className="space-y-3 pt-1">
                <div>
                  <h2 className="text-2xl font-extrabold tracking-tight text-foreground">Pro</h2>
                  <p className="text-sm text-muted-foreground mt-1">For solo sellers &amp; small shops</p>
                </div>
                <div>
                  <span className="text-4xl font-extrabold tracking-tight text-foreground">{proPrice}</span>
                  {billingPeriod === 'annual' && (
                    <p className="text-sm text-muted-foreground mt-1">{proEquiv}/mo billed annually</p>
                  )}
                </div>
              </div>

              <div style={{ borderTop: '1px solid #f0ede8' }} />

              {/* Features */}
              <div className="flex-1 flex flex-col gap-3.5">
                {PRO_FEATURES.map((f) => (
                  <div key={f} className="flex items-center gap-3">
                    <span
                      className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center transition-colors duration-200"
                      style={{
                        background: selectedTier === 'pro' ? 'hsl(222 47% 11%)' : '#f0ede8',
                      }}
                    >
                      <Check
                        size={11}
                        className="stroke-[3]"
                        style={{ color: selectedTier === 'pro' ? '#fff' : '#9ca3af' }}
                      />
                    </span>
                    <span className="text-sm font-medium text-foreground">{f}</span>
                  </div>
                ))}
              </div>

              {/* Bottom pill */}
              <div
                className="py-3 rounded-xl text-sm font-bold text-center transition-all duration-200"
                style={{
                  background: selectedTier === 'pro' ? 'hsl(222 47% 11%)' : '#f0ede8',
                  color: selectedTier === 'pro' ? '#fff' : '#6b7280',
                }}
              >
                {selectedTier === 'pro' ? '✓ Selected' : 'Select Pro'}
              </div>
            </button>

            {/* ── Pro+ Card ── */}
            <button
              type="button"
              onClick={() => setSelectedTier('pro_plus')}
              className="relative text-left rounded-2xl flex flex-col gap-6 transition-all duration-200 focus:outline-none group overflow-hidden"
              style={{
                background: '#fff',
                padding: '28px',
                boxShadow: selectedTier === 'pro_plus'
                  ? '0 0 0 2px hsl(222 47% 11%), 0 8px 24px rgba(0,0,0,0.1)'
                  : '0 1px 4px rgba(0,0,0,0.08), 0 4px 16px rgba(0,0,0,0.04)',
                transform: selectedTier === 'pro_plus' ? 'translateY(-2px)' : 'translateY(0)',
              }}
            >
              {/* Most Popular badge — centred top */}
              <span
                className="absolute -top-px left-0 right-0 h-1 rounded-t-2xl"
                style={{ background: 'hsl(222 47% 11%)' }}
              />
              <span
                className="absolute top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-extrabold uppercase tracking-widest px-3 py-0.5 rounded-full text-white"
                style={{ background: 'hsl(222 47% 11%)' }}
              >
                Most Popular
              </span>

              {/* Selection dot */}
              <span
                className="absolute top-5 right-5 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-200"
                style={{
                  borderColor: selectedTier === 'pro_plus' ? 'hsl(222 47% 11%)' : '#d1d5db',
                  background: selectedTier === 'pro_plus' ? 'hsl(222 47% 11%)' : 'transparent',
                }}
              >
                {selectedTier === 'pro_plus' && <Check size={11} className="text-white stroke-[3]" />}
              </span>

              {activeTier === 'pro_plus' && (
                <span className="absolute top-5 left-5 text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                  Current
                </span>
              )}

              <div className="space-y-3 pt-5">
                <div>
                  <h2 className="text-2xl font-extrabold tracking-tight text-foreground">Pro+</h2>
                  <p className="text-sm text-muted-foreground mt-1">For growing teams &amp; businesses</p>
                </div>
                <div>
                  <span className="text-4xl font-extrabold tracking-tight text-foreground">{proPlusPrice}</span>
                  {billingPeriod === 'annual' && (
                    <p className="text-sm text-muted-foreground mt-1">{proPlusEquiv}/mo billed annually</p>
                  )}
                </div>
              </div>

              <div style={{ borderTop: '1px solid #f0ede8' }} />

              <div className="flex-1 flex flex-col gap-3.5">
                {PRO_PLUS_FEATURES.map((f) => (
                  <div key={f} className="flex items-center gap-3">
                    <span
                      className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center transition-colors duration-200"
                      style={{
                        background: selectedTier === 'pro_plus' ? 'hsl(222 47% 11%)' : '#f0ede8',
                      }}
                    >
                      <Check
                        size={11}
                        className="stroke-[3]"
                        style={{ color: selectedTier === 'pro_plus' ? '#fff' : '#9ca3af' }}
                      />
                    </span>
                    <span className="text-sm font-medium text-foreground">{f}</span>
                  </div>
                ))}
              </div>

              <div
                className="py-3 rounded-xl text-sm font-bold text-center transition-all duration-200"
                style={{
                  background: selectedTier === 'pro_plus' ? 'hsl(222 47% 11%)' : '#f0ede8',
                  color: selectedTier === 'pro_plus' ? '#fff' : '#6b7280',
                }}
              >
                {selectedTier === 'pro_plus' ? '✓ Selected' : 'Select Pro+'}
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
