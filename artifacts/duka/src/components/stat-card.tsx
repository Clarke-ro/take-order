import React, { type ReactNode } from 'react';
import { TrendingUp, TrendingDown, MoreHorizontal } from 'lucide-react';

export interface StatCardProps {
  label: string;
  value: string | number;
  icon: ReactNode;
  iconBg?: string;
  iconColor?: string;
  trend?: {
    percentage: number | null;
    direction: 'up' | 'down';
    periodLabel?: string;
  };
  sparklineColor?: string;
  sparklineTone?: 'emerald' | 'blue' | 'purple' | 'amber';
  onMenuClick?: () => void;
  className?: string;
}

export function StatCard({
  label,
  value,
  icon,
  iconBg = 'bg-emerald-100 text-emerald-700',
  trend,
  sparklineTone = 'emerald',
  onMenuClick,
  className = '',
}: StatCardProps) {
  // Sparkline color schemes
  const toneMap = {
    emerald: { stroke: '#10b981', gradientId: 'grad-emerald', fill: '#10b981' },
    blue: { stroke: '#3b82f6', gradientId: 'grad-blue', fill: '#3b82f6' },
    purple: { stroke: '#8b5cf6', gradientId: 'grad-purple', fill: '#8b5cf6' },
    amber: { stroke: '#f59e0b', gradientId: 'grad-amber', fill: '#f59e0b' },
  };

  const toneConfig = toneMap[sparklineTone] || toneMap.emerald;

  // Wave path matching the reference curve
  const pathD = trend?.direction === 'down'
    ? 'M 0,10 C 20,12 35,22 55,20 C 75,18 85,32 100,34'
    : 'M 0,32 C 20,30 35,18 55,20 C 75,22 85,8 100,6';

  const fillD = `${pathD} L 100,40 L 0,40 Z`;

  return (
    <div
      className={`rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs hover:shadow-sm transition-all flex flex-col justify-between ${className}`}
    >
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 shadow-2xs ${iconBg}`}>
            {icon}
          </div>
          <span className="text-sm font-semibold text-slate-600 tracking-tight">{label}</span>
        </div>
        <button
          type="button"
          onClick={onMenuClick}
          aria-label={`Options for ${label}`}
          className="text-slate-400 hover:text-slate-600 transition-colors p-1 -mr-1 rounded-md"
        >
          <MoreHorizontal size={16} />
        </button>
      </div>

      {/* Main Metric Value */}
      <div className="my-3 text-2xl sm:text-3xl font-extrabold text-slate-950 tracking-tight truncate">
        {value}
      </div>

      {/* Bottom Row: Trend + Sparkline */}
      <div className="flex items-end justify-between gap-2 pt-1">
        <div>
          {trend ? (
            <div className="flex items-center gap-1 text-xs font-bold text-emerald-600">
              {trend.direction === 'up' ? (
                <TrendingUp size={13} className="text-emerald-600 stroke-[2.5]" />
              ) : (
                <TrendingDown size={13} className="text-rose-600 stroke-[2.5]" />
              )}
              <span className={trend.direction === 'up' ? 'text-emerald-600' : 'text-rose-600'}>
                {trend.direction === 'up' ? '↑' : '↓'} {trend.percentage != null ? `${trend.percentage}%` : 'Steady'}
              </span>
            </div>
          ) : (
            <div className="text-xs font-semibold text-slate-400">Live active data</div>
          )}
          <p className="text-[11px] text-slate-400 font-medium mt-0.5">
            {trend?.periodLabel || 'vs. previous 7 days'}
          </p>
        </div>

        {/* Mini Wave Sparkline */}
        <div className="w-24 h-9 shrink-0 overflow-hidden">
          <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="w-full h-full overflow-visible">
            <defs>
              <linearGradient id={toneConfig.gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={toneConfig.fill} stopOpacity="0.25" />
                <stop offset="100%" stopColor={toneConfig.fill} stopOpacity="0.0" />
              </linearGradient>
            </defs>
            <path d={fillD} fill={`url(#${toneConfig.gradientId})`} />
            <path
              d={pathD}
              fill="none"
              stroke={toneConfig.stroke}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}
