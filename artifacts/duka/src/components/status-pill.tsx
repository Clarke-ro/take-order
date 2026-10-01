import React, { type ReactNode } from 'react';
import { ArrowUpRight, Check, CircleDollarSign, Clock3 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function StatusPill({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'gold' | 'mint' | 'rose' | 'blue' | 'reserved';
}) {
  const paid = tone === 'mint';
  const deposit = tone === 'gold';
  const reserved = tone === 'reserved';
  const shipped = tone === 'blue';
  const rose = tone === 'rose';

  return (
    <span
      data-tone={tone}
      className={cn(
        'inline-flex items-center gap-1 rounded-[6px] px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.06em] border transition-colors',
        paid &&
          'border-emerald-200/50 bg-[#eaf8ee] text-[#15803d] dark:border-emerald-800/40 dark:bg-emerald-950/40 dark:text-emerald-300',
        deposit &&
          'border-amber-200/60 bg-amber-50 text-amber-700 dark:border-amber-800/40 dark:bg-amber-950/40 dark:text-amber-300',
        reserved &&
          'border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
        shipped &&
          'border-sky-200/60 bg-sky-50 text-sky-700 dark:border-sky-800/40 dark:bg-sky-950/40 dark:text-sky-300',
        rose &&
          'border-rose-200/60 bg-rose-50 text-rose-700 dark:border-rose-800/40 dark:bg-rose-950/40 dark:text-rose-300',
        !paid &&
          !deposit &&
          !reserved &&
          !shipped &&
          !rose &&
          'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400'
      )}
    >
      {paid && <Check size={11} strokeWidth={3} aria-hidden="true" />}
      {deposit && <CircleDollarSign size={11} strokeWidth={2.5} aria-hidden="true" />}
      {reserved && <Clock3 size={11} strokeWidth={2.5} aria-hidden="true" />}
      {shipped && <ArrowUpRight size={11} strokeWidth={2.5} aria-hidden="true" />}
      {children}
    </span>
  );
}
