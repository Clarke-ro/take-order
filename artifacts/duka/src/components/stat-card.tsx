import React from 'react';
import { Info, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface StatCardProps {
  label: string;
  value: string | number;
  suffix?: string;       // muted text beside value, e.g. "0% of orders"
  description?: string;  // shown on the info icon tooltip
  caption?: string;      // short caption below value
  onClick?: () => void;
  className?: string;
  expanded?: boolean;
  ariaControls?: string;
  badge?: React.ReactNode;
  sparkline?: React.ReactNode;
  // Legacy compat props — kept so existing callers don't break at compile time
  trend?: any;
  subtitle?: string;
  icon?: any;
  iconType?: string;
  iconBg?: string;
  onMenuClick?: () => void;
  active?: boolean;
  sparklineTone?: string;
}

export function StatCard({
  label,
  value,
  suffix,
  description,
  caption,
  onClick,
  className = '',
  expanded = false,
  ariaControls,
  badge,
  sparkline,
  active = false,
  subtitle,
}: StatCardProps) {
  const isInteractive = Boolean(onClick);
  const isSelected = active || expanded;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isInteractive && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onClick?.();
    }
  };

  return (
    <div
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      aria-expanded={isInteractive ? expanded : undefined}
      aria-controls={ariaControls}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      className={cn(
        'saas-stat-card flex flex-col justify-between rounded-[12px] border bg-[hsl(var(--card))] p-5 transition-all outline-none',
        isSelected
          ? 'border-neutral-900 ring-1 ring-neutral-900 shadow-sm dark:border-white dark:ring-white'
          : 'border-[hsl(var(--card-border))] hover:border-neutral-400 dark:hover:border-neutral-700',
        isInteractive && 'cursor-pointer select-none',
        className
      )}
    >
      {/* Label row + info icon + optional expand chevron */}
      <div className="flex items-center justify-between gap-1.5 min-h-[20px]">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <span
            title={label}
            className="text-[13px] font-medium text-[hsl(var(--muted-foreground))] leading-snug whitespace-normal break-words"
          >
            {label}
          </span>
          {description && (
            <span title={description} className="inline-flex shrink-0">
              <Info
                size={13}
                className="text-[hsl(var(--muted-foreground))]/60 hover:text-[hsl(var(--foreground))] transition-colors"
                aria-label={description}
              />
            </span>
          )}
        </div>
        {isInteractive && (
          <ChevronDown
            size={14}
            className={cn(
              'text-[hsl(var(--muted-foreground))]/70 transition-transform duration-200 shrink-0 ml-1',
              expanded && 'rotate-180 text-neutral-800 dark:text-neutral-200'
            )}
          />
        )}
      </div>

      {/* Big value row + sparkline */}
      <div className="mt-3 flex items-end justify-between gap-2">
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span className="text-[28px] leading-tight font-semibold tracking-tight text-neutral-800 dark:text-neutral-200">
            {value}
          </span>
          {suffix && (
            <span className="text-[12px] font-normal text-[hsl(var(--muted-foreground))] leading-none">
              {suffix}
            </span>
          )}
        </div>
        {sparkline && <div className="shrink-0">{sparkline}</div>}
      </div>

      {/* Caption & optional badge */}
      {(caption || subtitle || badge) && (
        <div className="mt-2.5 flex items-center justify-between gap-2 pt-1 border-t border-[hsl(var(--border))]/40 text-[12px] sm:text-[13px] text-[hsl(var(--muted-foreground))]">
          <span className="truncate">{caption || subtitle}</span>
          {badge && <span className="shrink-0">{badge}</span>}
        </div>
      )}
    </div>
  );
}

/* Keep icon exports for legacy compat — they render nothing */
export function DashboardCartIcon({ className = '' }: { className?: string }) { return null; }
export function DashboardTagIcon({ className = '' }: { className?: string }) { return null; }
export function DashboardBoxIcon({ className = '' }: { className?: string }) { return null; }
export function DashboardClockIcon({ className = '' }: { className?: string }) { return null; }
