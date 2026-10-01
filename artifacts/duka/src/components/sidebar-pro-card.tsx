import React from 'react';
import { Link } from 'wouter';
import { Zap, Crown } from 'lucide-react';

export function SidebarProCard({
  isPro = false,
  isProPlus = false,
  isTrial = false,
  daysRemaining = 7,
  collapsed = false,
}: {
  isPro?: boolean;
  isProPlus?: boolean;
  isTrial?: boolean;
  daysRemaining?: number;
  collapsed?: boolean;
}) {
  if (collapsed) {
    return (
      <div className="px-2 pb-2">
        <Link
          href={isPro ? '/account/billing' : '/subscribe'}
          title={isPro ? 'Manage billing' : 'Upgrade to Pro'}
          className="flex h-10 w-10 mx-auto items-center justify-center rounded-2xl bg-[#ede9fe] text-[#7c3aed] hover:bg-[#ddd6fe] shadow-2xs transition-all cursor-pointer"
        >
          {isPro ? (
            <Crown size={18} className="text-amber-500 fill-amber-500" />
          ) : (
            <Zap size={18} className="fill-[#7c3aed] text-[#7c3aed]" />
          )}
        </Link>
      </div>
    );
  }

  if (isPro) {
    return (
      <div className="px-3 pb-2">
        <Link
          href="/account/billing"
          className="w-full flex items-center justify-between rounded-2xl bg-white border border-slate-200/90 px-3.5 py-3 text-left shadow-xs hover:shadow-sm hover:border-slate-300 transition-all group cursor-pointer"
        >
          <div>
            <div className="text-xs font-bold text-slate-900 leading-tight flex items-center gap-1.5">
              <span>{isProPlus ? 'Take Order Pro+' : 'Take Order Pro'}</span>
              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800">
                {isTrial ? `${daysRemaining}D TRIAL` : 'ACTIVE'}
              </span>
            </div>
            <div className="text-[11px] text-slate-500 font-normal mt-0.5">Manage billing & plan</div>
          </div>
          <div className="h-8 w-8 rounded-full bg-amber-50 border border-amber-200/60 flex items-center justify-center text-amber-500 shrink-0 shadow-2xs">
            <Crown size={15} className="fill-amber-400 text-amber-500" />
          </div>
        </Link>
      </div>
    );
  }

  // Exactly matching media_1790863037734.png
  return (
    <div className="px-3 pb-2">
      <Link
        href="/subscribe"
        data-testid="sidebar-upgrade-to-pro"
        className="w-full flex items-center justify-between rounded-2xl bg-white border border-slate-200/90 px-3.5 py-3 text-left shadow-xs hover:shadow-sm hover:border-slate-300 transition-all group cursor-pointer"
      >
        <div>
          <div className="text-sm font-bold text-slate-900 leading-tight">
            Upgrade to Pro
          </div>
          <div className="text-xs text-slate-500 font-normal mt-0.5">
            Unlock more features
          </div>
        </div>
        <div className="h-9 w-9 rounded-full bg-[#ede9fe] flex items-center justify-center text-[#7c3aed] shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
          <Zap size={17} className="fill-[#7c3aed] text-[#7c3aed]" />
        </div>
      </Link>
    </div>
  );
}
