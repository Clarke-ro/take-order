import React, { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface SegmentedControlOption<T extends string = string> {
  value: T;
  label: ReactNode;
  count?: number | string;
  icon?: ReactNode;
  testId?: string;
}

export interface SegmentedControlProps<T extends string = string> {
  options: SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel?: string;
  className?: string;
  size?: 'default' | 'sm';
}

export function SegmentedControl<T extends string = string>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
  size = 'default',
}: SegmentedControlProps<T>) {
  const isSm = size === 'sm';

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex items-center rounded-[10px] sm:rounded-[12px] border border-[#E3E3EC] bg-white p-1 dark:border-neutral-800 dark:bg-neutral-900 overflow-x-auto scrollbar-none gap-1 max-w-full',
        isSm ? 'h-[36px] min-h-[36px]' : 'h-[40px] min-h-[40px]',
        className
      )}
    >
      {options.map((opt) => {
        const isActive = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            data-testid={opt.testId}
            onClick={() => onChange(opt.value)}
            className={cn(
              'inline-flex items-center justify-center gap-1.5 rounded-[8px] font-medium transition-all select-none whitespace-nowrap cursor-pointer',
              isSm
                ? (opt.label ? 'h-[28px] px-2.5 text-[12.5px]' : 'h-[28px] w-[28px] px-0')
                : (opt.label ? 'h-[32px] px-3 py-1.5 text-[13.5px] sm:text-[14px]' : 'h-[32px] w-[32px] px-0'),
              isActive
                ? 'bg-[#111111] text-white shadow-xs font-medium dark:bg-white dark:text-[#111111]'
                : 'text-[#6B7280] hover:text-[#111827] dark:text-neutral-400 dark:hover:text-neutral-100 hover:bg-black/[0.03] dark:hover:bg-white/[0.05]'
            )}
          >
            {opt.icon && <span className="shrink-0">{opt.icon}</span>}
            {opt.label ? <span>{opt.label}</span> : null}
            {opt.count !== undefined && (
              <span
                className={cn(
                  'inline-flex items-center justify-center px-1.5 py-0.5 text-[11px] font-medium rounded-full min-w-[18px]',
                  isActive
                    ? 'bg-white/20 text-white dark:bg-black/20 dark:text-[#111111]'
                    : 'bg-black/5 text-[#6B7280] dark:bg-white/10 dark:text-neutral-400'
                )}
              >
                {opt.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
