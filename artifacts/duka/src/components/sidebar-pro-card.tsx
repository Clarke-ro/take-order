import React from 'react';
import { Link } from 'wouter';
import { Zap, Crown, ArrowRight } from 'lucide-react';
import { useSubscription, type NormalizedSubscription } from '@/lib/subscription';

export interface SidebarProCardProps {
  subscription?: NormalizedSubscription;
  collapsed?: boolean;
}

export function SidebarProCard({
  subscription: propSubscription,
  collapsed = false,
}: SidebarProCardProps) {
  const hookSubscription = useSubscription();
  const sub = propSubscription || hookSubscription;

  // Hidden for Pro+ users
  if (sub.isProPlus) {
    return null;
  }

  // Hidden for active paid Pro users (never claim a trial or prompt to upgrade to Pro)
  if (sub.isPro && !sub.isTrial) {
    return null;
  }

  if (collapsed) {
    return (
      <div className="px-2 pb-2">
        <Link
          href={sub.isTrial ? '/account/billing' : '/subscribe'}
          title={sub.isTrial ? 'Manage billing' : 'Upgrade to Pro'}
          className="flex h-9 w-9 mx-auto items-center justify-center rounded-[8px] bg-neutral-100 text-neutral-800 hover:bg-neutral-200 transition-colors cursor-pointer dark:bg-neutral-800 dark:text-neutral-200"
        >
          {sub.isTrial ? (
            <Crown size={16} className="text-amber-500 fill-amber-500" />
          ) : (
            <Zap size={16} className="fill-neutral-900 text-neutral-900 dark:fill-white dark:text-white" />
          )}
        </Link>
      </div>
    );
  }

  // In trial state: show countdown
  if (sub.isTrial || sub.status === 'in_trial') {
    const days = sub.trialDaysRemaining;
    return (
      <div className="px-3 pb-2">
        <Link
          href="/account/billing"
          className="w-full block rounded-[12px] border border-[hsl(var(--card-border))] bg-white p-3 text-left shadow-2xs hover:border-neutral-400 transition-all group cursor-pointer dark:bg-neutral-900"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded">
              {days} {days === 1 ? 'day' : 'days'} left in trial
            </span>
            <Crown size={14} className="text-amber-500 fill-amber-400 shrink-0" />
          </div>
          <div className="text-[13px] font-bold text-neutral-900 dark:text-white mt-1 leading-tight">
            Take Order Pro
          </div>
          <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5 flex items-center gap-1">
            <span>Choose a plan</span>
            <ArrowRight size={10} className="group-hover:translate-x-0.5 transition-transform" />
          </div>
        </Link>
      </div>
    );
  }

  // Never started trial and eligible: "Start 7-day free trial"
  if (sub.trialEligible || sub.status === 'trial_eligible') {
    return (
      <div className="px-3 pb-2">
        <Link
          href="/subscribe"
          data-testid="sidebar-upgrade-to-pro"
          className="w-full block rounded-[12px] border border-[hsl(var(--card-border))] bg-white p-3.5 text-left shadow-2xs hover:border-neutral-400 transition-all group cursor-pointer dark:bg-neutral-900"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-[13px] font-bold text-neutral-900 dark:text-white leading-tight">
                Start 7-day free trial
              </div>
              <div className="text-[11.5px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                Unlock Pro reports & 500 links
              </div>
            </div>
            <div className="h-7 w-7 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-900 dark:text-white shrink-0 group-hover:scale-105 transition-transform">
              <Zap size={14} className="fill-current text-current" />
            </div>
          </div>
        </Link>
      </div>
    );
  }

  // Expired trial / Free after trial: "Upgrade to Pro"
  return (
    <div className="px-3 pb-2">
      <Link
        href="/subscribe"
        data-testid="sidebar-upgrade-to-pro"
        className="w-full block rounded-[12px] border border-[hsl(var(--card-border))] bg-white p-3.5 text-left shadow-2xs hover:border-neutral-400 transition-all group cursor-pointer dark:bg-neutral-900"
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-[13px] font-bold text-neutral-900 dark:text-white leading-tight">
              Upgrade to Pro
            </div>
            <div className="text-[11.5px] text-neutral-500 dark:text-neutral-400 mt-0.5">
              Unlock unlimited features
            </div>
          </div>
          <div className="h-7 w-7 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-900 dark:text-white shrink-0 group-hover:scale-105 transition-transform">
            <Zap size={14} className="fill-current text-current" />
          </div>
        </div>
      </Link>
    </div>
  );
}
