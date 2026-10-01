import React, { useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { dateShort } from '@/lib/formatters';

export type DashboardPeriod = 'day' | 'week' | 'month' | 'year' | 'custom';
export type DashboardDateRange = { from: string; to: string };

export type DashboardPeriodPreference = {
  period: DashboardPeriod;
  customFrom: string;
  customTo: string;
};

export const dashboardPeriods = new Set<DashboardPeriod>(['day', 'week', 'month', 'year', 'custom']);
export const DASHBOARD_PERIOD_KEY = 'duka-dashboard-period-preference';

export const dashboardPeriodOptions: Array<{ value: Exclude<DashboardPeriod, 'custom'>; label: string }> = [
  { value: 'day', label: 'Today' },
  { value: 'week', label: 'Last 7 days' },
  { value: 'month', label: 'Last 30 days' },
  { value: 'year', label: 'Last 365 days' },
];

export const inputDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const shiftInputDate = (value: string, days: number) => {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + days);
  return inputDate(date);
};

export const dashboardPeriodRange = (period: DashboardPeriod, customFrom: string, customTo: string): DashboardDateRange | undefined => {
  const today = inputDate(new Date());
  if (period === 'custom') return customFrom && customTo && customFrom <= customTo ? { from: customFrom, to: customTo } : undefined;
  const days = period === 'day' ? 1 : period === 'week' ? 7 : period === 'month' ? 30 : 365;
  return { from: shiftInputDate(today, -(days - 1)), to: today };
};

export const dashboardPeriodLabel = (period: DashboardPeriod, customFrom: string, customTo: string) => {
  if (period === 'custom') return customFrom && customTo ? `${dateShort(customFrom)} – ${dateShort(customTo)}` : 'Choose dates';
  return dashboardPeriodOptions.find((option) => option.value === period)?.label ?? 'Last 7 days';
};

export const calendarMonthLabel = (value: string) =>
  new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(new Date(`${value}-01T12:00:00`));

export const shiftCalendarMonth = (value: string, months: number) => {
  const date = new Date(`${value}-01T12:00:00`);
  date.setMonth(date.getMonth() + months);
  return inputDate(date).slice(0, 7);
};

export type PreferenceStorage = Pick<Storage, 'getItem' | 'setItem'>;

export const getPreferenceStorage = (): PreferenceStorage | null => {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

const isValidDashboardDate = (value: unknown): value is string => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00`);
  return !Number.isNaN(date.getTime()) && inputDate(date) === value;
};

const isValidDashboardPeriodPreference = (value: DashboardPeriodPreference): boolean =>
  dashboardPeriods.has(value.period) &&
  typeof value.customFrom === 'string' &&
  typeof value.customTo === 'string' &&
  (value.period !== 'custom' ||
    (isValidDashboardDate(value.customFrom) && isValidDashboardDate(value.customTo) && value.customFrom <= value.customTo));

export const writeDashboardPeriodPreference = (
  preference: DashboardPeriodPreference,
  storage: PreferenceStorage | null = getPreferenceStorage()
) => {
  if (!storage || !isValidDashboardPeriodPreference(preference)) return;
  try {
    storage.setItem(DASHBOARD_PERIOD_KEY, JSON.stringify(preference));
  } catch {}
};

export const readDashboardPeriodPreference = (
  storage: PreferenceStorage | null = getPreferenceStorage()
): DashboardPeriodPreference | null => {
  if (!storage) return null;
  try {
    const value = storage.getItem(DASHBOARD_PERIOD_KEY);
    if (!value) return null;
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object') return null;
    const candidate = parsed as Partial<DashboardPeriodPreference>;
    if (typeof candidate.period !== 'string' || !dashboardPeriods.has(candidate.period as DashboardPeriod)) return null;
    const preference: DashboardPeriodPreference = {
      period: candidate.period as DashboardPeriod,
      customFrom: typeof candidate.customFrom === 'string' ? candidate.customFrom : '',
      customTo: typeof candidate.customTo === 'string' ? candidate.customTo : '',
    };
    return isValidDashboardPeriodPreference(preference) ? preference : null;
  } catch {
    return null;
  }
};

export type DashboardCustomRangePickerProps = {
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  onClose: () => void;
  onApply: () => void;
  canApply: boolean;
};

export function DashboardCustomRangePicker({
  from,
  to,
  onFromChange,
  onToChange,
  onClose,
  onApply,
  canApply,
}: DashboardCustomRangePickerProps) {
  const [monthCursor, setMonthCursor] = useState(() => (from ? from.slice(0, 7) : inputDate(new Date()).slice(0, 7)));
  const monthStart = new Date(`${monthCursor}-01T12:00:00`);
  const firstVisibleDate = new Date(monthStart);
  firstVisibleDate.setDate(1 - monthStart.getDay());
  const calendarDays = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(firstVisibleDate);
    date.setDate(firstVisibleDate.getDate() + index);
    return inputDate(date);
  });
  const setFrom = (value: string) => {
    onFromChange(value);
    if (value) setMonthCursor(value.slice(0, 7));
  };
  const setTo = (value: string) => {
    onToChange(value);
    if (value) setMonthCursor(value.slice(0, 7));
  };
  const selectDay = (value: string) => {
    setMonthCursor(value.slice(0, 7));
    if (!from || (from && to)) {
      onFromChange(value);
      onToChange('');
    } else if (value < from) {
      onFromChange(value);
      onToChange(from);
    } else {
      onToChange(value);
    }
  };
  const rangeStart = from && to && from <= to ? from : '';
  const rangeEnd = from && to && from <= to ? to : '';

  return (
    <div className="dashboard-custom-range">
      <div className="dashboard-custom-range-fields">
        <label>
          From
          <span className="dashboard-date-input">
            <CalendarDays size={14} aria-hidden="true" />
            <input
              type="date"
              value={from}
              max={to || undefined}
              onChange={(event) => setFrom(event.target.value)}
              data-testid="input-dashboard-period-from"
              aria-label="Start date"
            />
          </span>
        </label>
        <label>
          To
          <span className="dashboard-date-input">
            <CalendarDays size={14} aria-hidden="true" />
            <input
              type="date"
              value={to}
              min={from || undefined}
              onChange={(event) => setTo(event.target.value)}
              data-testid="input-dashboard-period-to"
              aria-label="End date"
            />
          </span>
        </label>
      </div>
      <div className="dashboard-calendar" aria-label="Choose date range" role="group" data-testid="dashboard-period-calendar">
        <div className="dashboard-calendar-header">
          <button
            type="button"
            className="dashboard-calendar-nav"
            onClick={() => setMonthCursor(shiftCalendarMonth(monthCursor, -1))}
            aria-label="Previous month"
          >
            <ChevronLeft size={15} />
          </button>
          <strong aria-live="polite">{calendarMonthLabel(monthCursor)}</strong>
          <button
            type="button"
            className="dashboard-calendar-nav"
            onClick={() => setMonthCursor(shiftCalendarMonth(monthCursor, 1))}
            aria-label="Next month"
          >
            <ChevronRight size={15} />
          </button>
        </div>
        <div className="dashboard-calendar-weekdays" aria-hidden="true">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
            <span key={`${day}-${index}`}>{day}</span>
          ))}
        </div>
        <div className="dashboard-calendar-grid">
          {calendarDays.map((day) => {
            const isCurrentMonth = day.slice(0, 7) === monthCursor;
            const isStart = day === rangeStart;
            const isEnd = day === rangeEnd;
            const isInRange = rangeStart && rangeEnd && day >= rangeStart && day <= rangeEnd;
            return (
              <button
                type="button"
                key={day}
                className={cn(
                  'dashboard-calendar-day',
                  !isCurrentMonth && 'is-outside',
                  isInRange && 'is-in-range',
                  isStart && 'is-range-start',
                  isEnd && 'is-range-end'
                )}
                onClick={() => selectDay(day)}
                aria-label={dateShort(day)}
                aria-pressed={isStart || isEnd}
              >
                <span>{Number(day.slice(-2))}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="dashboard-custom-range-actions">
        <button
          type="button"
          className="dashboard-period-action secondary"
          onClick={onClose}
          data-testid="button-dashboard-period-cancel"
        >
          Cancel
        </button>
        <button
          type="button"
          className="dashboard-period-action primary"
          onClick={onApply}
          disabled={!canApply}
          data-testid="button-dashboard-period-apply"
        >
          Apply
        </button>
      </div>
    </div>
  );
}
