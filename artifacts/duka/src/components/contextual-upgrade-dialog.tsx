import React from 'react';
import { Crown, Sparkles, CheckCircle2 } from 'lucide-react';
import { Link } from 'wouter';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  FREE_ACTIVE_LINK_LIMIT,
  PRO_ACTIVE_LINK_LIMIT,
  type PlanTier,
} from '@/lib/entitlements';

export type UpgradeReason = 'link_limit' | 'analytics_export' | 'channel_insights';

interface ContextualUpgradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reason: UpgradeReason;
  tier?: PlanTier;
}

export function ContextualUpgradeDialog({
  open,
  onOpenChange,
  reason,
  tier = 'free',
}: ContextualUpgradeDialogProps) {
  // Pro+ users have unlimited links and full capabilities; do not show upgrade prompts
  if (tier === 'pro_plus') {
    return null;
  }

  const isProSeller = tier === 'pro';

  let title = '';
  let description = '';
  let preservationNote = '';
  let benefits: string[] = [];
  let actionLabel = '';
  let targetHref = '/subscribe';
  let badgeLabel = 'Pro Feature';

  if (reason === 'link_limit') {
    if (isProSeller) {
      badgeLabel = 'Pro+ Feature';
      title = `Active link limit reached (${PRO_ACTIVE_LINK_LIMIT} links)`;
      description = `You have reached your ${PRO_ACTIVE_LINK_LIMIT} active Take Order link limit on the Pro plan.`;
      preservationNote = 'Existing buyer links continue working seamlessly — buyers can still view products and checkout.';
      benefits = [
        'Unlimited active Take Order links (no numerical ceiling)',
        'Executive business intelligence and cohort analysis',
        'Direct order and revenue CSV exports',
        'Continuous business growth without link caps',
      ];
      actionLabel = 'Upgrade to Pro+ for Unlimited Links';
      targetHref = '/account/billing';
    } else {
      badgeLabel = 'Pro Feature';
      title = `Active link limit reached (${FREE_ACTIVE_LINK_LIMIT} links)`;
      description = `You have reached your ${FREE_ACTIVE_LINK_LIMIT} active Take Order link limit on the Free plan.`;
      preservationNote = 'Existing buyer links continue working seamlessly — buyers can still view products and checkout.';
      benefits = [
        `Up to ${PRO_ACTIVE_LINK_LIMIT} active Take Order links`,
        'Detailed channel conversion insights & business reports',
        'Direct order and revenue CSV export',
        'Priority merchant support',
      ];
      actionLabel = `Upgrade to Pro for ${PRO_ACTIVE_LINK_LIMIT} Links`;
      targetHref = '/subscribe';
    }
  } else if (reason === 'analytics_export') {
    title = 'Export Sales & Metrics to CSV';
    description = 'Downloading full order histories, customer ledgers, and cash flow reports in CSV format is a Pro feature.';
    preservationNote = 'You can still view standard on-screen sales and summaries on the Free plan.';
    benefits = [
      'Instant CSV download of all order records',
      'Channel conversion breakdowns by platform',
      `Up to ${PRO_ACTIVE_LINK_LIMIT} Take Order links`,
    ];
    actionLabel = 'Upgrade to Pro for Data Exports';
    targetHref = '/subscribe';
  } else {
    title = 'Advanced Channel Conversion Insights';
    description = 'Unlock multi-channel conversion tracking, cohort analytics, and executive cash-flow breakdowns.';
    preservationNote = 'Standard channel tags and order summaries remain accessible on the Free plan.';
    benefits = [
      'Comprehensive conversion analytics per channel',
      'Periodic comparison toggles (week-over-week)',
      'Complete order CSV exports',
    ];
    actionLabel = 'Upgrade to Pro for Channel Insights';
    targetHref = '/subscribe';
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl">
        <DialogHeader className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Crown size={20} strokeWidth={2.5} />
            </span>
            <span className="rounded-full bg-amber-100 dark:bg-amber-950/60 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
              {badgeLabel}
            </span>
          </div>
          <DialogTitle className="text-lg font-bold text-slate-900 dark:text-slate-100">
            {title}
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-600 dark:text-slate-400">
            {description}
          </DialogDescription>
        </DialogHeader>

        {/* Data preservation guarantee box */}
        <div className="my-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-emerald-800 dark:text-emerald-300 flex items-start gap-2">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
          <span>{preservationNote}</span>
        </div>

        {/* Benefits list */}
        <div className="space-y-2 py-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {isProSeller ? 'Included with Take Order Pro+:' : 'Included with Take Order Pro:'}
          </div>
          <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
            {benefits.map((benefit, i) => (
              <li key={i} className="flex items-center gap-2">
                <Sparkles size={13} className="text-amber-500 shrink-0" />
                <span>{benefit}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-4 flex flex-col sm:flex-row items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto text-xs"
          >
            {isProSeller ? 'Stay on Pro' : 'Stay on Free'}
          </Button>
          <Link href={targetHref} onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
            <Button
              size="sm"
              className="w-full sm:w-auto bg-gradient-to-r from-amber-500 to-amber-600 text-white font-semibold text-xs shadow-sm hover:brightness-105"
            >
              <Crown size={14} className="mr-1.5" />
              {actionLabel}
            </Button>
          </Link>
        </div>

        <div className="text-center text-[10.5px] text-slate-400 pt-1">
          7-day free trial on all plans. Review our{' '}
          <Link href="/terms" onClick={() => onOpenChange(false)} className="underline hover:text-slate-600">Terms</Link> and{' '}
          <Link href="/refund-policy" onClick={() => onOpenChange(false)} className="underline hover:text-slate-600">Refund Policy</Link>.
        </div>
      </DialogContent>
    </Dialog>
  );
}
