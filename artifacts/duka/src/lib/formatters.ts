import { formatCompactMoney, formatMoney, currencyForCode, currentCurrency } from './currency';
import type { Order } from '@workspace/api-client-react';

export const money = (value: number | null | undefined) => formatCompactMoney(value);
export const moneyExact = (value: number | null | undefined) => formatMoney(value);

export const currencySymbol = (code?: string | null) => {
  if (code) {
    return currencyForCode(code).symbol;
  }
  return currentCurrency().symbol;
};

export const number = (value: number | null | undefined) =>
  new Intl.NumberFormat('en-US').format(value || 0);

export const dateShort = (value: string | null | undefined) => {
  if (!value) return '—';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
};

export const channelName = (value?: string | null) =>
  value ? String(value).replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : 'Direct';

export const initials = (name?: string | null) => {
  if (!name || typeof name !== 'string') return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return parts
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
};

export const paymentTone = (status: Order['status']): 'neutral' | 'gold' | 'mint' | 'reserved' =>
  status === 'paid' ? 'mint' : status === 'deposit_paid' ? 'gold' : status === 'reserved' ? 'reserved' : 'neutral';

export const paymentLabel = (order: Order) =>
  order.status === 'deposit_paid'
    ? 'Deposit paid'
    : order.status === 'paid'
      ? 'Paid in full'
      : order.status === 'reserved'
        ? 'Reserved'
        : 'Awaiting payment';

export const AWAITING_LABEL = 'Awaiting';

export const formatCustomerName = (name?: string | null): string => {
  if (!name || typeof name !== 'string') return AWAITING_LABEL;
  const trimmed = name.trim();
  const lower = trimmed.toLowerCase();
  if (
    !trimmed ||
    lower === 'waiting for buyer' ||
    lower === 'buyer pending' ||
    lower === 'awaiting buyer' ||
    lower === 'customer'
  ) {
    return AWAITING_LABEL;
  }
  return trimmed;
};

export { openWhatsApp } from './social-messaging';
