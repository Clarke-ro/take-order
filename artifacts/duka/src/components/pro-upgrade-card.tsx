import React from 'react';
import { Link, useLocation } from 'wouter';
import { Crown, BarChart3, TrendingUp, Sparkles, Plus, Link2, ArrowUpRight } from 'lucide-react';

export function ProUpgradeFeatureCard({
  pageTitle = 'Daily closing',
  title = 'Track your store growth',
  description = 'See best-selling items with real data. Make smarter decisions and maximize profits.',
  learnMoreHref = '/account/billing',
  previewLabel = 'Total views',
  previewValue = '130',
  previewSubtext,
  onUpgrade,
}: {
  pageTitle?: string;
  title?: string;
  description?: string;
  learnMoreHref?: string;
  previewLabel?: string;
  previewValue?: string;
  previewSubtext?: string;
  onUpgrade?: () => void;
}) {
  const [, setLocation] = useLocation();

  const handleUpgrade = () => {
    if (onUpgrade) {
      onUpgrade();
    } else {
      setLocation('/subscribe');
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto py-4" data-testid="pro-upgrade-feature-card">
      {pageTitle && (
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
              {pageTitle}
            </h2>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <Crown size={11} className="text-amber-500" />
              <span>PRO</span>
            </span>
          </div>
        </div>
      )}

      <div className="rounded-2xl sm:rounded-3xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm overflow-hidden grid grid-cols-1 md:grid-cols-[1.3fr_1fr] transition-all">
        {/* Left Side */}
        <div className="p-7 sm:p-10 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
              <Crown size={14} className="text-amber-500" />
              <span>Pro Analytics</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
              {title}
            </h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed max-w-md">
              {description}
            </p>
            <div className="pt-1">
              <Link
                href={learnMoreHref}
                className="text-xs font-semibold text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100 underline underline-offset-4 cursor-pointer"
              >
                Learn more about Pro plans
              </Link>
            </div>
          </div>

          <div className="pt-8">
            <button
              type="button"
              onClick={handleUpgrade}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 font-semibold text-sm transition-all shadow-sm active:scale-[0.98] cursor-pointer"
              data-testid="button-pro-card-upgrade"
            >
              <Crown size={15} className="text-amber-400 dark:text-amber-500" />
              <span>Upgrade to Pro</span>
            </button>
          </div>
        </div>

        {/* Right Side */}
        <div className="bg-neutral-100/70 dark:bg-neutral-800/40 p-6 sm:p-10 flex items-center justify-center border-t md:border-t-0 md:border-l border-neutral-200/80 dark:border-neutral-800">
          <div className="w-full max-w-[260px] rounded-2xl bg-white dark:bg-neutral-900 p-6 shadow-xs border border-neutral-200/70 dark:border-neutral-800/80 space-y-3">
            <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
              <span className="font-medium">{previewLabel}</span>
              <BarChart3 size={14} className="text-slate-400 dark:text-slate-500" />
            </div>
            <div className="text-3xl sm:text-4xl font-extrabold tracking-tight text-neutral-900 dark:text-neutral-100">
              {previewValue}
            </div>
            {previewSubtext && (
              <p className="text-[11px] text-neutral-400">
                {previewSubtext}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function EmptyStateOnboardingCard({
  businessName,
  productCount,
  orderCount,
  onDismiss,
}: {
  businessName?: string;
  productCount: number;
  orderCount: number;
  onDismiss?: () => void;
}) {
  return (
    <div className="w-full max-w-4xl mx-auto py-2 mb-8" data-testid="empty-state-onboarding-card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
            Welcome to Take Order
          </h2>
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="text-xs text-neutral-400 hover:text-neutral-700 underline cursor-pointer"
          >
            Dismiss
          </button>
        )}
      </div>

      <div className="rounded-2xl sm:rounded-3xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm overflow-hidden grid grid-cols-1 md:grid-cols-[1.3fr_1fr] transition-all">
        {/* Left Side */}
        <div className="p-7 sm:p-10 flex flex-col justify-between">
          <div className="space-y-3">
            <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
              Set up your shop{businessName ? `, ${businessName}` : ''}
            </h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed max-w-md">
              Create your catalog products and generate your first Take Order checkout link to share with buyers on WhatsApp or social media.
            </p>
            <div className="pt-1">
              <Link
                href="/take-order"
                className="text-xs font-semibold text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100 underline underline-offset-4 cursor-pointer"
              >
                Learn how Take Order links work
              </Link>
            </div>
          </div>

          <div className="pt-8 flex flex-wrap items-center gap-3">
            <Link href="/catalog/new">
              <button
                type="button"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100 text-white font-semibold text-sm transition-all shadow-xs cursor-pointer"
                data-testid="button-empty-add-product"
              >
                <Plus size={15} />
                <span>Add first product</span>
              </button>
            </Link>
            <Link href="/take-order">
              <button
                type="button"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-neutral-200 hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200 font-semibold text-sm transition-all shadow-xs cursor-pointer"
                data-testid="button-empty-take-order"
              >
                <Link2 size={15} />
                <span>Take an order</span>
              </button>
            </Link>
          </div>
        </div>

        {/* Right Side */}
        <div className="bg-neutral-100/70 dark:bg-neutral-800/40 p-6 sm:p-10 flex items-center justify-center border-t md:border-t-0 md:border-l border-neutral-200/80 dark:border-neutral-800">
          <div className="w-full max-w-[260px] rounded-2xl bg-white dark:bg-neutral-900 p-6 shadow-xs border border-neutral-200/70 dark:border-neutral-800/80 space-y-4">
            <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
              <span className="font-medium">Store status</span>
              <Sparkles size={14} className="text-amber-500" />
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-neutral-900 dark:text-neutral-100">
                {productCount > 0 ? (orderCount > 0 ? 'Ready' : '1 of 2 done') : '0 of 2 done'}
              </div>
              <p className="text-xs text-neutral-500 mt-1">
                {productCount === 0 ? 'Add catalog item to begin' : 'Create your first checkout link'}
              </p>
            </div>
            <div className="space-y-1.5 pt-2 border-t border-neutral-100 dark:border-neutral-800 text-xs">
              <div className="flex items-center justify-between text-neutral-600 dark:text-neutral-300">
                <span>Products:</span>
                <span className="font-bold">{productCount}</span>
              </div>
              <div className="flex items-center justify-between text-neutral-600 dark:text-neutral-300">
                <span>Active links:</span>
                <span className="font-bold">{orderCount}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
