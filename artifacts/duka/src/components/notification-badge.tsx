import React from 'react';
import { cn } from '@/lib/utils';

export interface NotificationBadgeProps {
  count?: number | string | null;
  className?: string;
  max?: number;
  ariaLabel?: string;
}

/**
 * Standard notification badge:
 * - Pinterest red: hsl(var(--notification)) (#E60023) with white text
 * - >= 18px tall
 * - 12px font size, font-weight 600
 * - 99+ cap
 * - Hidden when count is 0 or invalid
 */
export function NotificationBadge({
  count,
  className = '',
  max = 99,
  ariaLabel,
}: NotificationBadgeProps) {
  if (count == null) return null;
  const num = typeof count === 'string' ? parseInt(count, 10) : count;
  if (isNaN(num) || num <= 0) return null;
  const display = num > max ? `${max}+` : String(num);
  return (
    <span
      className={cn(
        'notification-badge inline-flex items-center justify-center min-h-[18px] h-[18px] min-w-[18px] px-1.5 rounded-full bg-[hsl(var(--notification))] text-[hsl(var(--notification-foreground))] text-[12px] font-semibold leading-none shrink-0 select-none',
        className
      )}
      aria-label={ariaLabel || `${num} notifications`}
    >
      {display}
    </span>
  );
}

export interface NotificationDotProps {
  className?: string;
  ariaLabel?: string;
}

/**
 * Standard notification dot:
 * - Pinterest red: hsl(var(--notification)) (#E60023)
 * - 8px diameter
 * - 2px white ring
 */
export function NotificationDot({
  className = '',
  ariaLabel = 'New indicator',
}: NotificationDotProps) {
  return (
    <span
      className={cn(
        'notification-dot h-2 w-2 rounded-full bg-[hsl(var(--notification))] ring-2 ring-white dark:ring-[hsl(var(--sidebar))] shrink-0 inline-block',
        className
      )}
      aria-label={ariaLabel}
    />
  );
}
