import React, { type ReactNode } from 'react';
import { TrendingUp, TrendingDown, MoreHorizontal } from 'lucide-react';

export interface StatCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  iconType?: 'cart' | 'tag' | 'box' | 'clock';
  iconBg?: string;
  trend?: {
    percentage: number | null;
    direction: 'up' | 'down';
    periodLabel?: string;
  };
  subtitle?: string;
  onMenuClick?: () => void;
  onClick?: () => void;
  active?: boolean;
  className?: string;
}

/* Vector silhouettes matching the user-attached icon designs */
export function DashboardCartIcon({ className = 'h-8 w-8 text-slate-900' }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 18 C12 15 15 15 18 15 L26 15 C30 15 32 17 33 21 L36 32 L88 32 C93 32 96 36 94 41 L84 68 C82 72 78 75 73 75 L42 75 L45 81 L82 81 C84 81 86 83 86 85 C86 87 84 89 82 89 L42 89 C38 89 35 86 34 82 L21 23 L18 23 C15 23 12 21 12 18 Z" />
      <circle cx="43" cy="91" r="7" />
      <circle cx="75" cy="91" r="7" />
    </svg>
  );
}

export function DashboardTagIcon({ className = 'h-8 w-8 text-slate-900' }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" fill="currentColor" className={className} aria-hidden="true">
      {/* Black price tag with angled hole and % cut-out */}
      <path fillRule="evenodd" d="M52 14 L30 36 C28 38 27 41 27 44 L27 82 C27 86 30 90 35 90 L73 90 C77 90 81 86 81 82 L81 44 C81 41 80 38 78 36 L56 14 C55 13 53 13 52 14 Z M54 28 C56.2 28 58 29.8 58 32 C58 34.2 56.2 36 54 36 C51.8 36 50 34.2 50 32 C50 29.8 51.8 28 54 28 Z M45 48 C47.2 48 49 49.8 49 52 C49 54.2 47.2 56 45 56 C42.8 56 41 54.2 41 52 C41 49.8 42.8 48 45 48 Z M63 70 C65.2 70 67 71.8 67 74 C67 76.2 65.2 78 63 78 C60.8 78 59 76.2 59 74 C59 71.8 60.8 70 63 70 Z M64.5 49 L43.5 77 L40 74.5 L61 46.5 Z" clipRule="evenodd" />
    </svg>
  );
}

export function DashboardBoxIcon({ className = 'h-8 w-8 text-slate-900' }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" fill="currentColor" className={className} aria-hidden="true">
      {/* 3D Package Isometric box with center tape strip */}
      <path d="M50 12 L86 28 L50 45 L14 28 Z" fill="#1e293b" />
      <path d="M14 31 L48 48 L48 88 L14 71 Z" fill="#0f172a" />
      <path d="M52 48 L86 31 L86 71 L52 88 Z" fill="#334155" />
      <path d="M44 15 L56 20 L56 45 L44 39 Z" fill="#f8fafc" opacity="0.9" />
    </svg>
  );
}

export function DashboardClockIcon({ className = 'h-8 w-8 text-slate-900' }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" fill="currentColor" className={className} aria-hidden="true">
      <circle cx="50" cy="50" r="44" fill="#0f172a" />
      <path d="M50 24 L50 52 L68 52" stroke="#ffffff" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

export function StatCard({
  label,
  value,
  icon,
  iconType,
  iconBg = 'bg-slate-100 text-slate-900',
  trend,
  subtitle,
  onMenuClick,
  onClick,
  active = false,
  className = '',
}: StatCardProps) {
  const renderIcon = () => {
    if (icon) return icon;
    switch (iconType) {
      case 'cart':
        return <DashboardCartIcon className="h-7 w-7 text-slate-900" />;
      case 'tag':
        return <DashboardTagIcon className="h-7 w-7 text-slate-900" />;
      case 'box':
        return <DashboardBoxIcon className="h-7 w-7 text-slate-900" />;
      case 'clock':
        return <DashboardClockIcon className="h-7 w-7 text-slate-900" />;
      default:
        return null;
    }
  };

  return (
    <div
      onClick={onClick}
      className={`rounded-2xl border transition-all flex flex-col justify-between p-5 sm:p-6 bg-white shadow-xs ${
        active
          ? 'border-slate-900 ring-2 ring-slate-900/10 shadow-sm'
          : 'border-slate-200/80 hover:border-slate-300 hover:shadow-sm'
      } ${onClick ? 'cursor-pointer' : ''} ${className}`}
    >
      {/* Top Header Row: Label & Options Menu */}
      <div className="flex items-center justify-between">
        <span className="text-xs sm:text-sm font-semibold tracking-tight text-slate-500">
          {label}
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onMenuClick?.();
          }}
          aria-label={`Options for ${label}`}
          className="text-slate-400 hover:text-slate-600 transition-colors p-1 -mr-1.5 -mt-1 rounded-lg hover:bg-slate-100 cursor-pointer"
        >
          <MoreHorizontal size={16} />
        </button>
      </div>

      {/* Middle Row: Value WITH Icon right beside it */}
      <div className="my-3.5 flex items-center justify-between gap-3">
        <div className="text-2xl sm:text-[28px] font-extrabold text-slate-950 tracking-tight truncate">
          {value}
        </div>
        <div className={`h-11 w-11 rounded-2xl flex items-center justify-center shrink-0 p-1.5 shadow-2xs ${iconBg}`}>
          {renderIcon()}
        </div>
      </div>

      {/* Bottom Row: Trend badge & Period indicator (No graph) */}
      <div className="flex items-center justify-between pt-1 border-t border-slate-100/80 text-xs">
        {trend ? (
          <div className="flex items-center gap-1.5 font-bold">
            <span
              className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] ${
                trend.direction === 'up'
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-rose-50 text-rose-700'
              }`}
            >
              {trend.direction === 'up' ? (
                <TrendingUp size={12} strokeWidth={2.5} />
              ) : (
                <TrendingDown size={12} strokeWidth={2.5} />
              )}
              {trend.direction === 'up' ? '↑' : '↓'} {trend.percentage != null ? `${trend.percentage}%` : 'Steady'}
            </span>
            <span className="text-[11px] text-slate-400 font-medium">
              {trend.periodLabel || 'vs. previous 7 days'}
            </span>
          </div>
        ) : (
          <span className="text-[11px] text-slate-400 font-medium">
            {subtitle || 'Live store data'}
          </span>
        )}
      </div>
    </div>
  );
}
