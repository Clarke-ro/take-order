import React from 'react';
import { Info } from 'lucide-react';

export interface StatCardProps {
  label: string;
  value: string | number;
  suffix?: string;       // muted text beside value, e.g. "0% of orders"
  description?: string;  // shown on the info icon tooltip
  onClick?: () => void;
  className?: string;
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
  onClick,
  className = '',
}: StatCardProps) {
  return (
    <div
      onClick={onClick}
      className={[
        'saas-stat-card flex flex-col justify-between rounded-[12px] border border-[hsl(var(--card-border))] bg-[hsl(var(--card))] p-6 min-h-[110px]',
        onClick ? 'cursor-pointer hover:border-[hsl(var(--primary))]/40 hover:shadow-sm transition-all' : '',
        className,
      ].filter(Boolean).join(' ')}
    >
      {/* Label + info icon */}
      <div className="flex items-center gap-1.5">
        <span className="text-[13.5px] font-medium text-[hsl(var(--muted-foreground))] leading-none select-none">
          {label}
        </span>
        <Info
          size={13}
          className="text-[hsl(var(--muted-foreground))]/50 shrink-0"
          title={description || label}
          aria-label={description || label}
        />
      </div>

      {/* Big value + optional muted suffix */}
      <div className="mt-3 flex items-baseline gap-2 flex-wrap">
        <span className="text-[36px] leading-none font-semibold tracking-tight text-[hsl(var(--foreground))]">
          {value}
        </span>
        {suffix && (
          <span className="text-[13px] font-normal text-[hsl(var(--muted-foreground))] leading-none">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

/* Keep icon exports for legacy compat — they render nothing */
export function DashboardCartIcon({ className = '' }: { className?: string }) { return null; }
export function DashboardTagIcon({ className = '' }: { className?: string }) { return null; }
export function DashboardBoxIcon({ className = '' }: { className?: string }) { return null; }
export function DashboardClockIcon({ className = '' }: { className?: string }) { return null; }
