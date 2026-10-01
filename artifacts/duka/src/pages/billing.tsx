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
  ArrowUpRight,
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
import {
  useEntitlements,
  FREE_CATALOG_LIMIT,
  FREE_ACTIVE_LINK_LIMIT,
} from '@/lib/entitlements';

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

  const { tier, details, customerInfo, isLoading, error, refresh } =
    useEntitlement(effectiveUserId);
  const entitlements = useEntitlements(effectiveUserId);

  if (isLoaded && !isSignedIn && !isTestAuth && !localStorage.getItem('duka-test-user-id') && !userId) {
    return <Redirect to="/sign-in" />;
  }

  const [restoring, setRestoring] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleRestore = async () => {
    setRestoring(true);
    setFeedback(null);
    try {
      const updated = await restorePurchases();
      await refresh();
      setFeedback(
        updated && (updated.entitlements.active['take_order_app_pro_plus'] || updated.entitlements.active['take_order_app_pro'])
          ? 'Purchases restored!'
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
      return isNaN(d.getTime()) ? 'N/A' : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    } catch { return 'N/A'; }
  };

  const hasSubscription = tier !== 'none' && details.hasActivePlan;
  const managementUrl = details.managementURL || customerInfo?.managementURL || null;

  const priceLabel = (() => {
    const p = details.productIdentifier;
    if (p === PACKAGE_ID_PRO_MONTHLY) return '$9.99 / month';
    if (p === PACKAGE_ID_PRO_ANNUAL) return '$89.91 / year';
    if (p === PACKAGE_ID_PRO_PLUS_MONTHLY) return '$20.00 / month';
    if (p === PACKAGE_ID_PRO_PLUS_ANNUAL) return '$180.00 / year';
    return details.cadence === 'annual' ? 'Annual plan' : 'Monthly plan';
  })();

  return (
    <div className="min-h-screen bg-background text-foreground font-sans antialiased">

      {/* ── Header ── */}
      <header className="sticky top-0 z-30 bg-card/95 backdrop-blur-sm border-b border-border">
        <div className="w-full max-w-3xl mx-auto px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors duration-150">
              <ArrowLeft size={16} />
              Dashboard
            </Link>
            <span className="text-border">/</span>
            <div className="flex items-center gap-2">
              <img src="/branding/takeorder-icon.png" alt="Take Order" className="h-6 w-6 rounded-md object-contain shadow-2xs" />
              <span className="text-foreground font-semibold text-sm">Billing</span>
            </div>
          </div>
          <button
            type="button"
            disabled={restoring || isLoading}
            onClick={handleRestore}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground border border-border rounded-lg px-3.5 py-2 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={13} className={restoring ? 'animate-spin' : ''} />
            {restoring ? 'Restoring…' : 'Restore'}
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10 space-y-8">

        {/* Page title */}
        <div className="flex items-start justify-between gap-4 pb-6 border-b border-border">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Subscription & Billing</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage your plan, invoices and payment method.</p>
          </div>
          <Link
            to="/subscribe"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-foreground text-background text-xs font-bold hover:opacity-90 transition-opacity shrink-0"
          >
            <Sparkles size={13} />
            {hasSubscription ? 'Change Plan' : 'View Plans'}
          </Link>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="rounded-xl border border-border p-10 flex flex-col items-center gap-3">
            <Loader2 size={22} className="animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading subscription…</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            <div className="flex items-center gap-2"><AlertCircle size={14} className="shrink-0" />{error}</div>
            <button onClick={() => refresh()} className="text-xs font-bold underline">Retry</button>
          </div>
        )}

        {/* Feedback */}
        {feedback && (
          <div className="flex items-center justify-between rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm">
            <span className="text-muted-foreground">{feedback}</span>
            <button onClick={() => setFeedback(null)} className="text-xs text-muted-foreground hover:text-foreground">Dismiss</button>
          </div>
        )}

        {/* ── Business Profile Card ── */}
        <section className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-xs flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="h-12 w-12 rounded-xl bg-slate-900 text-amber-400 font-black text-base flex items-center justify-center shrink-0 shadow-xs">
              TO
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-base sm:text-lg truncate text-foreground">
                  {effectiveUserId ? 'Seller Workspace' : 'Take Order Shop'}
                </h2>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  <CheckCircle2 size={11} />Verified
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {hasSubscription ? details.planName : 'Free tier seller'} · Ready for orders
              </p>
            </div>
          </div>
          <Link
            to="/settings"
            className="text-xs font-semibold text-muted-foreground hover:text-foreground border border-border rounded-xl px-3.5 py-2 transition-colors shrink-0"
          >
            Settings
          </Link>
        </section>

        {/* ── Current Plan ── */}
        <section className="space-y-3">
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Current Plan</h2>

          {!isLoading && hasSubscription ? (
            <div className="rounded-2xl border border-border bg-card p-6 space-y-5 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-foreground text-background flex items-center justify-center text-xs font-black shrink-0 shadow-xs">
                    {details.tier === 'pro_plus' ? 'PRO+' : 'PRO'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-lg leading-none">{details.planName}</h3>
                      {details.willRenew ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 size={11} className="stroke-[2.5]" />Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                          <Clock size={11} />Cancelling
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 capitalize">{details.cadence} · {priceLabel}</p>
                  </div>
                </div>
                <div className="sm:text-right text-sm">
                  <div className="text-xs text-muted-foreground">{details.willRenew ? 'Renews' : 'Access until'}</div>
                  <div className="font-semibold flex items-center gap-1 sm:justify-end mt-0.5">
                    <Calendar size={13} className="text-muted-foreground" />
                    {fmt(details.expirationDate)}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border text-xs">
                <div>
                  <div className="text-muted-foreground mb-0.5">Edition</div>
                  <div className="font-semibold text-foreground truncate">
                    {details.tier === 'pro_plus' ? 'Take Order Pro+' : 'Take Order Pro'}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground mb-0.5">Billing cycle</div>
                  <div className="font-medium capitalize">{details.cadence}</div>
                </div>
                <div>
                  <div className="text-muted-foreground mb-0.5">Auto-renewal</div>
                  <div className={`font-semibold ${details.willRenew ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {details.willRenew ? 'On' : 'Off'}
                  </div>
                </div>
              </div>
            </div>
          ) : !isLoading && entitlements.isTrial ? (
            <div className="rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-gradient-to-br from-amber-50/60 to-orange-50/30 dark:from-amber-950/20 dark:to-orange-950/10 p-6 space-y-5 shadow-xs" data-testid="card-billing-trial">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-amber-500 text-white flex items-center justify-center text-xs font-black shrink-0 shadow-xs">
                    <Crown size={22} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-lg leading-none">Take Order Pro</h3>
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700">
                        7-DAY FREE TRIAL
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Full Pro access: unlimited catalog, 500 links, full business reports, and CSV export. No credit card required.
                    </p>
                  </div>
                </div>
                <div className="sm:text-right text-sm">
                  <div className="text-xs text-muted-foreground">Trial status</div>
                  <div className="font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1 sm:justify-end mt-0.5">
                    <Clock size={13} />
                    {entitlements.trial.daysRemaining} {entitlements.trial.daysRemaining === 1 ? 'day' : 'days'} remaining
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-amber-200/60 dark:border-amber-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <span className="text-muted-foreground">
                  When your 7-day trial finishes, your account moves to Free. No automatic charges occur.
                </span>
                <Link
                  to="/subscribe"
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-foreground text-background font-bold hover:opacity-90 transition-opacity shrink-0"
                  data-testid="button-billing-lock-pro"
                >
                  <Sparkles size={13} />
                  Lock in Pro plan
                </Link>
              </div>
            </div>
          ) : !isLoading ? (
            <div className="rounded-2xl border border-border bg-card p-6 space-y-5 shadow-xs" data-testid="card-billing-free">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center text-xs font-black shrink-0 shadow-xs">
                    FREE
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-lg leading-none">Take Order Free Plan</h3>
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        Active Free Tier
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Full core commerce workflow: unlimited catalog, order links, customer management, inventory, and buyer checkout.
                    </p>
                  </div>
                </div>
                <Link
                  to="/subscribe"
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-foreground text-background font-bold text-xs hover:opacity-90 transition-opacity shrink-0"
                  data-testid="button-billing-upgrade-pro"
                >
                  <Sparkles size={13} />
                  Upgrade to Pro
                </Link>
              </div>

              {/* Free Plan Quotas & Usage Remaining */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-border">
                <div className="p-3.5 rounded-xl bg-muted/40 border border-border/60">
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Boxes size={13} className="text-slate-500" />
                      Catalog Capacity
                    </span>
                    <strong className="text-emerald-600 font-semibold">
                      Unlimited
                    </strong>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {entitlements.usage.catalogProductCount} items created · No limit on catalog size
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-muted/40 border border-border/60">
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Link2 size={13} className="text-slate-500" />
                      Active Links Capacity
                    </span>
                    <strong className={cn(entitlements.usage.activeLinkCount >= FREE_ACTIVE_LINK_LIMIT ? 'text-amber-600' : 'text-foreground')}>
                      {entitlements.usage.activeLinkCount} / {FREE_ACTIVE_LINK_LIMIT}
                    </strong>
                  </div>
                  <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all', entitlements.usage.activeLinkCount >= FREE_ACTIVE_LINK_LIMIT ? 'bg-amber-500' : 'bg-foreground')}
                      style={{ width: `${Math.min(100, (entitlements.usage.activeLinkCount / FREE_ACTIVE_LINK_LIMIT) * 100)}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    {Math.max(0, FREE_ACTIVE_LINK_LIMIT - entitlements.usage.activeLinkCount)} active links remaining
                  </p>
                </div>
              </div>

              <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 pt-1">
                <ShieldCheck size={13} className="text-emerald-500 shrink-0" />
                <span>Your products, links, and customer data are permanently retained and will never be deleted or blocked.</span>
              </div>
            </div>
          ) : null}
        </section>

        {/* ── Manage ── */}
        <section className="space-y-3">
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Manage</h2>
          <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">

            {/* Change plan */}
            <div className="flex items-center justify-between gap-4 px-5 py-4">
              <div>
                <div className="text-sm font-semibold">Change Plan</div>
                <div className="text-xs text-muted-foreground mt-0.5">Switch between Pro and Pro+, or change billing cycle.</div>
              </div>
              <Link to="/subscribe" className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-1.5 transition-colors shrink-0">
                Change <ChevronRight size={13} />
              </Link>
            </div>

            {/* Billing portal */}
            <div className="flex items-center justify-between gap-4 px-5 py-4">
              <div>
                <div className="text-sm font-semibold">Billing Portal</div>
                <div className="text-xs text-muted-foreground mt-0.5">Update payment method, download invoices.</div>
              </div>
              {managementUrl ? (
                <a href={managementUrl} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-semibold border border-border rounded-lg px-3 py-1.5 hover:bg-muted transition-colors shrink-0">
                  Open <ExternalLink size={12} />
                </a>
              ) : (
                <button
                  type="button"
                  onClick={() => alert('Portal link will be available after your first billing cycle.')}
                  className="inline-flex items-center gap-1 text-xs font-semibold border border-border rounded-lg px-3 py-1.5 text-muted-foreground hover:text-foreground transition-colors shrink-0"
                >
                  Portal <ExternalLink size={12} />
                </button>
              )}
            </div>

            {/* Cancel */}
            {hasSubscription && (
              <div className="flex items-center justify-between gap-4 px-5 py-4">
                <div>
                  <div className="text-sm font-semibold text-destructive">Cancel Subscription</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Access continues through your current period end.</div>
                </div>
                {managementUrl ? (
                  <a href={managementUrl} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold border border-destructive/30 text-destructive rounded-lg px-3 py-1.5 hover:bg-destructive/5 transition-colors shrink-0">
                    Cancel <ExternalLink size={12} />
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={() => alert('To cancel, use the management link from your RevenueCat receipt email.')}
                    className="inline-flex items-center gap-1 text-xs font-semibold border border-destructive/30 text-destructive rounded-lg px-3 py-1.5 hover:bg-destructive/5 transition-colors shrink-0"
                  >
                    Cancel
                  </button>
                )}
              </div>
            )}
          </div>
        </section>

        {/* ── Billing History ── */}
        <section className="space-y-3">
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Billing History</h2>
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            {hasSubscription ? (
              <div className="p-5 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <div>
                    <div className="font-semibold">{details.planName}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Started {fmt(details.latestPurchaseDate || customerInfo?.requestDate)}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{priceLabel}</div>
                    <div className="text-xs text-emerald-600 font-medium">Active</div>
                  </div>
                </div>
                {managementUrl && (
                  <a href={managementUrl} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-foreground/60 hover:text-foreground transition-colors">
                    Download invoices <ArrowUpRight size={12} />
                  </a>
                )}
              </div>
            ) : (
              <div className="p-8 text-center text-sm text-muted-foreground">No invoices found.</div>
            )}
          </div>
        </section>

        {/* Footer */}
        <div className="pb-6 flex flex-col items-center justify-center gap-2 text-xs text-muted-foreground/60">
          <div className="flex items-center gap-3">
            <Link to="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link>
            <span>·</span>
            <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
            <span>·</span>
            <Link to="/refund-policy" className="hover:text-foreground transition-colors">Refund Policy</Link>
          </div>
          <div className="flex items-center justify-center gap-1.5">
            <ShieldCheck size={12} className="text-emerald-500" />
            <span>Secured by RevenueCat</span>
          </div>
        </div>
      </main>
    </div>
  );
}

export default BillingPage;
