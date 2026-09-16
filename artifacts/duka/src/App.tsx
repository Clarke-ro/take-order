import React, { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Link, Route, Switch, useLocation, useParams, Router as WouterRouter } from 'wouter';
import {
  AlertTriangle, ArrowDown, ArrowDownRight, ArrowLeft, ArrowRight, ArrowUp, ArrowUpRight, BarChart3, Boxes, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Clock3,
  CheckCircle2, CircleDollarSign, Clipboard, Copy, ExternalLink, Eye, LayoutDashboard, Link2, Loader2, Menu, MoreHorizontal,
  Package, PackageSearch, Pencil, Plus, Receipt, RefreshCw, Search, Settings2, ShoppingBag, SlidersHorizontal, Sparkles,
  Trash2, TrendingUp, Truck, Users, WalletCards, X
} from 'lucide-react';
import { SiFacebook, SiInstagram, SiSnapchat, SiTiktok, SiWhatsapp, SiX } from 'react-icons/si';
import {
  CartesianGrid, Cell, Legend as RechartsLegend, Line, LineChart, Pie, PieChart, ResponsiveContainer,
  Tooltip as RechartsTooltip, XAxis, YAxis
} from 'recharts';
import {
  getGetPublicOrderQueryKey, getListOrdersQueryKey,
  getListProductsQueryKey, getGetDashboardSummaryQueryKey, getListExpensesQueryKey,
  useCreateExpense, useCreateOrder, useCreateProduct, useDeleteExpense, useDeleteProduct,
  useGetDashboardSummary, useGetPublicOrder, useHealthCheck, useListOrders, useListProducts,
  useListExpenses, useSubmitPublicOrder, useUpdateExpense, useUpdateOrder, useUpdateProduct
} from '@workspace/api-client-react';
import type { Expense, ExpenseInput, ExpenseUpdate, Order, OrderInput, Product, ProductInput, PublicOrderInput } from '@workspace/api-client-react';
import NotFound from '@/pages/not-found';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AnalyticsStateMarker, getAnalyticsViewState } from '@/lib/analytics-state';
import {
  clearPreferences,
  connectPreferenceAriaLabel,
  connectPreferenceLabel,
  onboardingChannels,
  orderChannels,
  subscribeToPreferenceChanges,
  togglePreference,
} from '@/lib/channel-preferences';

const queryClient = new QueryClient();

export const CHANNEL_CONVERSION_REFRESH_INTERVAL_MS = 5_000;
const money = (value: number | null | undefined) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value || 0);
const moneyExact = (value: number | null | undefined) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value || 0);
const number = (value: number | null | undefined) => new Intl.NumberFormat('en-US').format(value || 0);
const dateShort = (value: string) => {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
};
type DashboardPeriod = 'day' | 'week' | 'month' | 'year' | 'custom';
type DashboardDateRange = { from: string; to: string };

export type DashboardPeriodPreference = {
  period: DashboardPeriod;
  customFrom: string;
  customTo: string;
};
const dashboardPeriodOptions: Array<{ value: Exclude<DashboardPeriod, 'custom'>; label: string }> = [
  { value: 'day', label: 'Today' },
  { value: 'week', label: 'Last 7 days' },
  { value: 'month', label: 'Last 30 days' },
  { value: 'year', label: 'Last 365 days' },
];
const inputDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const shiftInputDate = (value: string, days: number) => {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + days);
  return inputDate(date);
};
const dashboardPeriodRange = (period: DashboardPeriod, customFrom: string, customTo: string): DashboardDateRange | undefined => {
  const today = inputDate(new Date());
  if (period === 'custom') return customFrom && customTo && customFrom <= customTo ? { from: customFrom, to: customTo } : undefined;
  const days = period === 'day' ? 1 : period === 'week' ? 7 : period === 'month' ? 30 : 365;
  return { from: shiftInputDate(today, -(days - 1)), to: today };
};
const dashboardPeriodLabel = (period: DashboardPeriod, customFrom: string, customTo: string) => {
  if (period === 'custom') return customFrom && customTo ? `${dateShort(customFrom)} – ${dateShort(customTo)}` : 'Choose dates';
  return dashboardPeriodOptions.find((option) => option.value === period)?.label ?? 'Last 7 days';
};
const calendarMonthLabel = (value: string) => new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(new Date(`${value}-01T12:00:00`));
const shiftCalendarMonth = (value: string, months: number) => {
  const date = new Date(`${value}-01T12:00:00`);
  date.setMonth(date.getMonth() + months);
  return inputDate(date).slice(0, 7);
};
const channelName = (value: string) => value.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const initials = (name: string) => name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
const productImageFor = (name: string) => {
  const value = name.toLowerCase();
  const kind = value.includes('shoe') || value.includes('sneaker') ? 'shoe' : value.includes('bag') || value.includes('handbag') ? 'bag' : value.includes('soap') ? 'soap' : value.includes('dress') || value.includes('jacket') || value.includes('shirt') ? 'wear' : 'object';
  const palettes = [
    ['#dce7ed', '#6b8294', '#f5f7f4'],
    ['#eee1d4', '#a15f4e', '#fff8ef'],
    ['#e2e6da', '#667254', '#f8f8f1'],
    ['#e6def0', '#78658f', '#fbf8ff'],
  ];
  const [background, foreground, highlight] = palettes[[...name].reduce((sum, char) => sum + char.charCodeAt(0), 0) % palettes.length]!;
  const shape = kind === 'shoe'
    ? `<path d="M171 180c18 3 44 8 64 24 17 13 41 18 65 22 19 3 29 14 26 27-3 13-18 21-40 21H142c-25 0-39-12-36-27 3-14 18-21 38-28 17-6 21-24 27-39Z" fill="${foreground}"/><path d="M123 247h192c-5 18-21 27-47 27H143c-20 0-31-9-20-27Z" fill="${highlight}" opacity=".85"/>`
    : kind === 'bag'
      ? `<path d="M134 132h132l14 145H120l14-145Z" fill="${foreground}"/><path d="M170 138c0-37 60-37 60 0" fill="none" stroke="${highlight}" stroke-width="12" stroke-linecap="round"/><path d="M151 167h98" stroke="${highlight}" stroke-width="7" opacity=".8"/>`
      : kind === 'soap'
        ? `<rect x="133" y="121" width="134" height="151" rx="28" fill="${foreground}"/><path d="M154 154c35-21 72 15 91-15" fill="none" stroke="${highlight}" stroke-width="13" stroke-linecap="round"/><circle cx="188" cy="220" r="16" fill="${highlight}" opacity=".8"/>`
        : kind === 'wear'
          ? `<path d="m151 126 44-24h34l44 24 31 45-35 24-18-26v97H155v-97l-18 26-35-24 49-45Z" fill="${foreground}"/><path d="M195 103c0 24 34 24 34 0" fill="none" stroke="${highlight}" stroke-width="9" stroke-linecap="round"/>`
          : `<path d="M116 226c13-67 54-103 109-103s96 36 109 103c5 26-12 47-39 47H155c-27 0-44-21-39-47Z" fill="${foreground}"/><circle cx="225" cy="175" r="31" fill="${highlight}" opacity=".8"/><path d="M144 246h162" stroke="${highlight}" stroke-width="10" stroke-linecap="round"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 450 360"><defs><linearGradient id="wash" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${background}"/><stop offset="1" stop-color="${highlight}"/></linearGradient></defs><rect width="450" height="360" fill="url(#wash)"/><circle cx="54" cy="48" r="72" fill="${highlight}" opacity=".45"/><circle cx="405" cy="312" r="94" fill="${foreground}" opacity=".08"/>${shape}<path d="M64 309h322" stroke="${foreground}" stroke-width="2" opacity=".16"/></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

function cn(...classes: Array<string | false | undefined>) { return classes.filter(Boolean).join(' '); }

type DashboardCustomRangePickerProps = {
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  onClose: () => void;
  onApply: () => void;
  canApply: boolean;
};

export function DashboardCustomRangePicker({ from, to, onFromChange, onToChange, onClose, onApply, canApply }: DashboardCustomRangePickerProps) {
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

  return <div className="dashboard-custom-range">
    <div className="dashboard-custom-range-fields">
      <label>
        From
        <span className="dashboard-date-input">
          <CalendarDays size={14} aria-hidden="true" />
          <input type="date" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} data-testid="input-dashboard-period-from" aria-label="Start date" />
        </span>
      </label>
      <label>
        To
        <span className="dashboard-date-input">
          <CalendarDays size={14} aria-hidden="true" />
          <input type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} data-testid="input-dashboard-period-to" aria-label="End date" />
        </span>
      </label>
    </div>
    <div className="dashboard-calendar" aria-label="Choose date range" role="group" data-testid="dashboard-period-calendar">
      <div className="dashboard-calendar-header">
        <button type="button" className="dashboard-calendar-nav" onClick={() => setMonthCursor(shiftCalendarMonth(monthCursor, -1))} aria-label="Previous month"><ChevronLeft size={15} /></button>
        <strong aria-live="polite">{calendarMonthLabel(monthCursor)}</strong>
        <button type="button" className="dashboard-calendar-nav" onClick={() => setMonthCursor(shiftCalendarMonth(monthCursor, 1))} aria-label="Next month"><ChevronRight size={15} /></button>
      </div>
      <div className="dashboard-calendar-weekdays" aria-hidden="true">{['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}</div>
      <div className="dashboard-calendar-grid">
        {calendarDays.map((day) => {
          const isCurrentMonth = day.slice(0, 7) === monthCursor;
          const isStart = day === rangeStart;
          const isEnd = day === rangeEnd;
          const isInRange = rangeStart && rangeEnd && day >= rangeStart && day <= rangeEnd;
          return <button
            type="button"
            key={day}
            className={cn('dashboard-calendar-day', !isCurrentMonth && 'is-outside', isInRange && 'is-in-range', isStart && 'is-range-start', isEnd && 'is-range-end')}
            onClick={() => selectDay(day)}
            aria-label={dateShort(day)}
            aria-pressed={isStart || isEnd}
          >
            <span>{Number(day.slice(-2))}</span>
          </button>;
        })}
      </div>
    </div>
    <div className="dashboard-custom-range-actions">
      <button type="button" className="dashboard-period-close" onClick={onClose} data-testid="button-dashboard-period-close">Close</button>
      <button type="button" className="dashboard-period-apply" onClick={onApply} disabled={!canApply} data-testid="button-dashboard-period-apply">Apply range</button>
    </div>
  </div>;
}

const brandAssets = {
  icon: '/branding/takeorder-icon.png',
  inverted: '/branding/mono-inverted.png',
  app: '/branding/mono-app.png',
  wordmark: '/branding/takeorder-wordmark.png',
} as const;

function BrandMark({ variant = 'app', className = '' }: { variant?: keyof typeof brandAssets; className?: string }) {
  return <img src={brandAssets[variant]} alt="" aria-hidden="true" className={cn('object-contain', className)} />;
}

function BrandWordmark({ inverted = false, className = '' }: { inverted?: boolean; className?: string }) {
  return <img src={brandAssets.wordmark} alt="Take Order" className={cn('object-contain', inverted && 'brightness-0 invert', className)} />;
}

function BrandLockup({ inverted = false, className = '' }: { inverted?: boolean; className?: string }) {
  return <div className={cn('flex items-center', className)} aria-label="Take Order"><BrandWordmark inverted={inverted} className="h-8 w-auto max-w-[132px]" /></div>;
}

function PoweredByTakeOrder({ className = '' }: { className?: string }) {
  return <div className={cn('flex items-center justify-center gap-2 text-[10px] text-[hsl(var(--muted-foreground))]', className)}><span>Powered by</span><BrandWordmark className="h-4 w-auto opacity-70" /></div>;
}

type MarkKey = 'whatsapp' | 'instagram' | 'tiktok' | 'snapchat' | 'facebook_ads' | 'paystack' | 'mobile_money' | 'x' | 'in_person' | 'other';
const markCatalog = {
  whatsapp: { label: 'WhatsApp', Icon: SiWhatsapp, color: '#25D366', kind: 'brand' },
  instagram: { label: 'Instagram', Icon: SiInstagram, color: '#E4405F', kind: 'brand' },
  tiktok: { label: 'TikTok', Icon: SiTiktok, color: '#111111', kind: 'brand' },
  snapchat: { label: 'Snapchat', Icon: SiSnapchat, color: '#FFFC00', kind: 'brand' },
  facebook_ads: { label: 'Facebook Ads', Icon: SiFacebook, color: '#1877F2', kind: 'brand' },
  paystack: { label: 'Paystack', Icon: WalletCards, color: '#00C3F7', kind: 'provider' },
  mobile_money: { label: 'Mobile Money', Icon: WalletCards, color: '#111111', kind: 'category' },
  x: { label: 'X', Icon: SiX, color: '#111111', kind: 'brand' },
  in_person: { label: 'In person', Icon: ShoppingBag, color: '#111111', kind: 'category' },
  other: { label: 'Other', Icon: MoreHorizontal, color: '#111111', kind: 'category' },
} as const;

const markKeyFor = (value: string): MarkKey => {
  const key = value.toLowerCase().replace(/[\s-]+/g, '_') as MarkKey;
  return key in markCatalog ? key : 'other';
};

function ChannelMark({ value, size = 17, className = '', colorful = true }: { value: string; size?: number; className?: string; colorful?: boolean }) {
  const mark = markCatalog[markKeyFor(value)];
  const Icon = mark.Icon;
  const color = colorful && (mark.kind === 'brand' || mark.kind === 'provider') ? mark.color : undefined;
  return <Icon size={size} aria-hidden="true" className={className} style={color ? { color } : undefined} />;
}

export function SocialChannelStack({ channels }: { channels: readonly string[] }) {
  const activeChannels = channels.filter((channel) => markCatalog[markKeyFor(channel)].kind === 'brand').slice(0, 4);
  if (!activeChannels.length) return null;
  const labels = activeChannels.map((channel) => markCatalog[markKeyFor(channel)].label).join(', ');
  return <div className="metric-channel-stack" data-testid="metric-channel-stack" role="img" aria-label={`Active social channels: ${labels}`} title={labels}>
    {activeChannels.map((channel, index) => <span key={channel} className="metric-channel-stack-mark" style={{ zIndex: activeChannels.length - index }}><ChannelMark value={channel} size={15} /></span>)}
  </div>;
}

function ChannelLabel({ value, className = '' }: { value: string; className?: string }) {
  const mark = markCatalog[markKeyFor(value)];
  return <span className={className}>{mark.label}</span>;
}

function ChannelInline({ value }: { value: string }) {
  return <span className="inline-flex items-center gap-1.5"><ChannelMark value={value} size={14} /><ChannelLabel value={value} /></span>;
}

export function ChannelPicker({ value, onChange, testId }: { value: OrderInput['channel']; onChange: (value: OrderInput['channel']) => void; testId: string }) {
  return <div data-testid={testId} className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Conversation channel">
    {orderChannels.map((channel) => {
      const selected = value === channel.value;
      return <button key={channel.value} type="button" role="radio" aria-label={channel.label} aria-checked={selected} data-testid={`${testId}-${channel.value}`} onClick={() => onChange(channel.value)} className={cn('flex items-center gap-2 rounded-[10px] border px-3 py-2.5 text-left text-xs font-semibold transition-colors', selected ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:bg-[hsl(var(--muted))]')}>
         <ChannelMark value={channel.value} size={15} colorful={!selected} className={selected ? 'text-[hsl(var(--primary-foreground))]' : 'text-[hsl(var(--foreground))]'} />
        <span>{channel.label}</span>
      </button>;
    })}
  </div>;
}

export function OnboardingChannelPicker({
  selectedChannels,
  onToggle,
}: {
  selectedChannels: readonly string[];
  onToggle: (channel: string) => void;
}) {
  return <div data-testid="onboarding-channels" className="grid grid-cols-2 gap-2" role="group" aria-label="Sales channels">
    {onboardingChannels.map((channel) => {
      const selected = selectedChannels.includes(channel);
      return <label key={channel} className={cn('flex cursor-pointer items-center gap-3 rounded-[12px] border p-3 text-xs font-semibold transition-colors', selected ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]')}>
        <input type="checkbox" data-testid={`input-onboarding-channel-${channel.toLowerCase().replaceAll(' ', '-')}`} aria-label={channel} checked={selected} onChange={() => onToggle(channel)} className="sr-only" />
        <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px]', selected ? 'border-[hsl(var(--sidebar-primary))] bg-[hsl(var(--sidebar-primary))] text-[hsl(var(--primary-foreground))]' : 'border-[hsl(var(--border))]')} aria-hidden="true">{selected ? <Check size={12} /> : <ChannelMark value={channel} size={13} />}</span>
        <span>{channel}</span>
      </label>;
    })}
  </div>;
}

type SellerProfile = { sellerName: string; businessName: string; description: string; channels: string[] };
const ONBOARDING_KEY = 'duka-onboarding-profile';
const ONBOARDING_STEP_KEY = 'duka-onboarding-step';
const ONBOARDING_DONE_KEY = 'duka-onboarding-complete';
export const CONNECTED_TOOLS_KEY = 'duka-connected-tools';

export const DASHBOARD_PERIOD_KEY = 'duka-dashboard-period';
export const CONNECTED_TOOL_NAMES = [
  'WhatsApp',
  'Instagram',
  'TikTok',
  'Facebook Ads',
  'Snapchat',
  'Paystack',
  'Mobile Money',
  'X',
] as const;
type PreferenceStorage = Pick<Storage, 'getItem' | 'setItem'>;
const getPreferenceStorage = (): Storage | null => {
  try { return window.localStorage; } catch { return null; }
};

const dashboardPeriods = new Set<DashboardPeriod>(['day', 'week', 'month', 'year', 'custom']);
const normalizeConnectedTools = (tools: readonly string[]) =>
  [...new Set(tools.filter((tool) => connectedToolNames.has(tool)))];
export const readConnectedTools = (storage: PreferenceStorage | null = getPreferenceStorage()): string[] => {
  if (!storage) return [];
  try {
    const value = storage.getItem(CONNECTED_TOOLS_KEY);
    const parsed: unknown = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) && parsed.every((item): item is string => typeof item === 'string')
      ? normalizeConnectedTools(parsed)
      : [];
  } catch { return []; }
};
export const writeConnectedTools = (tools: readonly string[], storage: PreferenceStorage | null = getPreferenceStorage()) => {
  if (!storage) return;
  try { storage.setItem(CONNECTED_TOOLS_KEY, JSON.stringify(normalizeConnectedTools(tools))); } catch { /* Storage can be unavailable in privacy-restricted browsers. */ }
};
export const clearConnectedTools = (storage: Pick<Storage, 'removeItem'> | null = getPreferenceStorage()) => {
  if (!storage) return;
  try { storage.removeItem(CONNECTED_TOOLS_KEY); } catch { /* Storage can be unavailable in privacy-restricted browsers. */ }
};
const readSellerProfile = (): SellerProfile | null => {
  try {
    const value = window.localStorage.getItem(ONBOARDING_KEY);
    return value ? JSON.parse(value) as SellerProfile : null;
  } catch { return null; }
};
const writeSellerProfile = (profile: SellerProfile) => {
  try { window.localStorage.setItem(ONBOARDING_KEY, JSON.stringify(profile)); } catch { /* Storage can be unavailable in privacy-restricted browsers. */ }
};
const readOnboardingStep = (): number => {
  try {
    const value = window.localStorage.getItem(ONBOARDING_STEP_KEY);
    const step = Number(value);
    return Number.isInteger(step) && step >= 0 && step <= 3 ? step : 0;
  } catch { return 0; }
};
const writeOnboardingStep = (step: number) => {
  try { window.localStorage.setItem(ONBOARDING_STEP_KEY, String(step)); } catch { /* Storage can be unavailable in privacy-restricted browsers. */ }
};
const finishOnboarding = () => window.localStorage.setItem(ONBOARDING_DONE_KEY, 'true');

export function Sidebar() {
  const [location] = useLocation();
  const seller = readSellerProfile();
  const links = [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/catalog', label: 'Catalog', icon: Boxes },
    { href: '/orders', label: 'Orders', icon: ShoppingBag },
    { href: '/reports', label: 'Reports', icon: BarChart3 },
    { href: '/clients', label: 'Clients', icon: Users },
    { href: '/expenses', label: 'Expenses', icon: Receipt },
    { href: '/take-order', label: 'Take an order', icon: Link2 },
  ];
  return <aside className="desktop-sidebar fixed inset-y-0 left-0 z-30 flex w-[246px] flex-col bg-[hsl(var(--sidebar))] text-[hsl(var(--sidebar-foreground))]">
    <div className="px-7 py-7">
      <BrandLockup className="gap-3" />
      <div className="mt-2 pl-12 font-mono-ui text-[9px] uppercase tracking-[.18em] text-white/45">seller workspace</div>
    </div>
    <div className="mx-5 mb-5 h-px bg-white/10" />
    <div className="px-4 text-[10px] font-semibold uppercase tracking-[.16em] text-white/35">Workspace</div>
    <nav aria-label="Seller workspace navigation" className="sidebar-scroll mt-3 flex-1 overflow-y-auto px-3">
      {links.map(({ href, label, icon: Icon }) => <Link key={href} href={href} data-testid={`link-${label.toLowerCase().replaceAll(' ', '-')}`} className={cn('group mb-1 flex items-center gap-3 rounded-[12px] px-4 py-3 text-[13px] font-medium transition-colors', location === href ? 'bg-[hsl(var(--sidebar-accent))] text-white' : 'text-white/58 hover:bg-white/5 hover:text-white')}>
        <Icon aria-hidden="true" size={17} strokeWidth={location === href ? 2.3 : 1.8} /><span>{label}</span>{label === 'Orders' && <span className="ml-auto rounded-full bg-[hsl(var(--sidebar-primary))] px-1.5 py-0.5 font-mono-ui text-[9px] text-[hsl(var(--sidebar-primary-foreground))]">12</span>}
      </Link>)}
      <div className="my-5 h-px bg-white/10" />
      <div className="px-1 text-[10px] font-semibold uppercase tracking-[.16em] text-white/35">Settings</div>
      <Link href="/connect" data-testid="link-connect" className={cn('mt-3 flex items-center gap-3 rounded-[12px] px-4 py-3 text-[13px] font-medium transition-colors', location === '/connect' ? 'bg-[hsl(var(--sidebar-accent))] text-white' : 'text-white/58 hover:bg-white/5 hover:text-white')}><Settings2 aria-hidden="true" size={17} /><span>Connect tools</span><span className="ml-auto h-2 w-2 rounded-full bg-[hsl(var(--accent))]" /></Link>
    </nav>
    <div className="m-4 rounded-[15px] border border-white/10 bg-white/[.045] p-4">
      <div className="flex items-center gap-2 text-[11px] font-semibold text-white/75"><span className="h-2 w-2 rounded-full bg-[hsl(var(--accent))]" /> All systems ready</div>
      <p className="mt-2 text-[11px] leading-relaxed text-white/40">Your links are live and ready to share.</p>
    </div>
      <div className="flex items-center gap-3 border-t border-white/10 px-6 py-5"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-[hsl(var(--chart-3))] text-[11px] font-bold text-white">{initials(seller?.sellerName || 'Amina Mensah')}</div><div className="min-w-0"><div className="truncate text-[12px] font-semibold">{seller?.sellerName || 'Amina Mensah'}</div><div className="truncate text-[10px] text-white/40">{seller?.businessName || 'The Sunday Edit'}</div></div><MoreHorizontal aria-hidden="true" className="ml-auto text-white/35" size={16} /></div>
  </aside>;
}

export function MobileMenuButton({ open, onClick }: { open: boolean; onClick: () => void }) {
  return <button type="button" aria-label={open ? 'Close navigation menu' : 'Open navigation menu'} aria-expanded={open} data-testid="button-mobile-menu" onClick={onClick} className="rounded-lg p-2 hover:bg-black/5">{open ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}</button>;
}

function MobileTopbar() {
  const [open, setOpen] = useState(false);
  const nav = [{ href: '/', label: 'Dashboard' }, { href: '/catalog', label: 'Catalog' }, { href: '/orders', label: 'Orders' }, { href: '/reports', label: 'Reports' }, { href: '/clients', label: 'Clients' }, { href: '/expenses', label: 'Expenses' }, { href: '/take-order', label: 'Take an order' }, { href: '/connect', label: 'Connect tools' }];
  return <div className="mobile-topbar sticky top-0 z-40 items-center justify-between border-b border-[hsl(var(--border))] bg-[hsl(var(--background))]/95 px-5 py-4 backdrop-blur-md"><Link href="/" aria-label="Take Order dashboard"><BrandLockup className="gap-2" /></Link><MobileMenuButton open={open} onClick={() => setOpen(!open)} />{open && <div className="absolute left-0 right-0 top-full border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3">{nav.map((item) => <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-3 text-sm hover:bg-[hsl(var(--muted))]">{item.label}</Link>)}</div>}</div>;
}

function Shell({ children }: { children: ReactNode }) {
  return <div className="duka-shell grain"><Sidebar /><MobileTopbar /><main className="page-content min-h-[100dvh] px-5 py-7 md:ml-[246px] md:px-10 md:py-9 lg:px-14">{children}</main></div>;
}

function PageHeading({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="page-heading mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div>{eyebrow && <div className="font-mono-ui text-[10px] font-bold uppercase tracking-[.18em] text-[hsl(var(--muted-foreground))]">{eyebrow}</div>}<h1 className={cn('font-display text-[clamp(30px,4vw,48px)] font-bold leading-[.98] tracking-[-.055em] text-[hsl(var(--foreground))]', eyebrow && 'mt-2')}>{title}</h1>{description && <p className="mt-3 max-w-[540px] text-base leading-7 text-[hsl(var(--muted-foreground))]">{description}</p>}</div>{action}</div>;
}

function Button({ children, variant = 'primary', className, ...props }: { children: ReactNode; variant?: 'primary' | 'soft' | 'outline' | 'danger' | 'ghost'; className?: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} className={cn('inline-flex items-center justify-center gap-2 rounded-[10px] px-3.5 py-2 text-[11px] font-semibold tracking-[-.01em] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--ring))] disabled:cursor-not-allowed disabled:opacity-50', variant === 'primary' && 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--primary))]', variant === 'soft' && 'bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))] hover:bg-[hsl(var(--muted))]', variant === 'outline' && 'border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--foreground))] hover:border-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]', variant === 'danger' && 'border border-[hsl(var(--foreground))] bg-[hsl(var(--card))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]', variant === 'ghost' && 'border border-transparent bg-transparent text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]', className)} {...props}>{children}</button>;
}

export function CatalogActions({
  productId,
  productName,
  onEdit,
  onDelete,
  deleteDisabled = false,
}: {
  productId?: number;
  productName: string;
  onEdit: () => void;
  onDelete: () => void;
  deleteDisabled?: boolean;
}) {
  return <div className="catalog-actions">
    <button type="button" onClick={onEdit} aria-label={`Edit ${productName}`} data-testid={`button-edit-product-${productId ?? productName}`} className="catalog-icon-button"><Pencil aria-hidden="true" size={15} /></button>
    <button type="button" onClick={onDelete} disabled={deleteDisabled} aria-label={`Delete ${productName}`} data-testid={`button-delete-product-${productId ?? productName}`} className="catalog-icon-button is-danger"><Trash2 aria-hidden="true" size={15} /></button>
  </div>;
}

export function ExpenseActions({
  expenseId,
  expenseTitle,
  onEdit,
  onDelete,
  deleteDisabled = false,
}: {
  expenseId?: number;
  expenseTitle: string;
  onEdit: () => void;
  onDelete: () => void;
  deleteDisabled?: boolean;
}) {
  return <div className="flex gap-1">
    <button type="button" onClick={onEdit} aria-label={`Edit ${expenseTitle}`} data-testid={`button-edit-expense-${expenseId ?? expenseTitle}`} className="rounded-lg p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]"><Pencil aria-hidden="true" size={15} /></button>
    <button type="button" onClick={onDelete} disabled={deleteDisabled} aria-label={`Delete ${expenseTitle}`} data-testid={`button-delete-expense-${expenseId ?? expenseTitle}`} className="rounded-lg p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--destructive))]/10 hover:text-[hsl(var(--destructive))]"><Trash2 aria-hidden="true" size={15} /></button>
  </div>;
}

function Card({ children, className = '', ...props }: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>) { return <div {...props} className={cn('app-card', className)}>{children}</div>; }
function Skeleton({ className = '' }: { className?: string }) { return <div className={cn('animate-pulse rounded-lg bg-[hsl(var(--muted))]', className)} />; }
function EmptyState({ icon: Icon, title, description, action }: { icon: typeof Package; title: string; description?: string; action?: ReactNode }) { return <div className="app-card flex flex-col items-center justify-center px-6 py-16 text-center"><div className="mb-4 flex h-12 w-12 items-center justify-center rounded-[14px] bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"><Icon size={22} /></div><h3 className="font-display text-lg font-bold">{title}</h3>{description && <p className="mt-2 max-w-[340px] text-sm leading-6 text-[hsl(var(--muted-foreground))]">{description}</p>}{action && <div className="mt-5">{action}</div>}</div>; }
function ErrorState({ retry }: { retry: () => void }) { return <div className="rounded-[16px] border border-[hsl(var(--destructive))]/20 bg-[hsl(var(--destructive))]/5 p-8 text-center"><p className="font-semibold">Something could not load.</p><p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">Give it another try or check your connection.</p><Button className="mt-5" variant="outline" onClick={retry}><RefreshCw size={15} />Try again</Button></div>; }
function StatusPill({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'gold' | 'mint' | 'rose' | 'blue' | 'reserved' }) {
  const paid = tone === 'mint';
  const deposit = tone === 'gold';
  const reserved = tone === 'reserved';
  const shipped = tone === 'blue';
  return <span data-tone={tone} className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold capitalize', paid && 'border border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]', deposit && 'border-2 border-[hsl(var(--foreground))] bg-[hsl(var(--card))] text-[hsl(var(--foreground))]', reserved && 'border border-dashed border-[hsl(var(--foreground))] bg-[hsl(var(--muted))] text-[hsl(var(--foreground))]', shipped && 'border border-dotted border-[hsl(var(--foreground))] bg-[hsl(var(--card))] text-[hsl(var(--foreground))]', !paid && !deposit && !reserved && !shipped && 'border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--muted-foreground))]')}>{paid && <Check size={11} strokeWidth={3} aria-hidden="true" />}{deposit && <CircleDollarSign size={11} strokeWidth={2.5} aria-hidden="true" />}{reserved && <Clock3 size={11} strokeWidth={2.5} aria-hidden="true" />}{shipped && <ArrowUpRight size={11} strokeWidth={2.5} aria-hidden="true" />}{children}</span>;
}

const paymentTone = (status: Order['status']): 'neutral' | 'gold' | 'mint' | 'reserved' =>
  status === 'paid' ? 'mint' : status === 'deposit_paid' ? 'gold' : status === 'reserved' ? 'reserved' : 'neutral';
const paymentLabel = (order: Order) => order.status === 'deposit_paid' ? 'Deposit paid' : order.status === 'paid' ? 'Paid in full' : 'Awaiting payment';
type MetricTrend = { direction: 'up' | 'down'; percentage: number };
type MetricIndicator = { direction: 'up' | 'down' | 'neutral'; percentage: number };
type DashboardStatCard = {
  label: string;
  value: ReactNode;
  valueAccessory?: ReactNode;
  trend?: MetricTrend;
  indicator?: MetricIndicator;
  note: ReactNode;
};
function MetricCard({ label, value, valueAccessory, note, period, trend, indicator, loading = false, dataTestId, className = '', style }: { label: string; value: ReactNode; valueAccessory?: ReactNode; note?: ReactNode; period?: string; trend?: MetricTrend; indicator?: MetricIndicator; loading?: boolean; dataTestId?: string; className?: string; style?: React.CSSProperties }) {
  const isUp = trend?.direction === 'up';
  const indicatorDirection = trend?.direction ?? indicator?.direction;
  const indicatorTone = indicatorDirection === 'up' ? 'metric-trend-up' : indicatorDirection === 'down' ? 'metric-trend-down' : 'metric-trend-neutral';
  const indicatorLabel = trend ? `${isUp ? '+' : '−'}${trend.percentage}%` : `${indicator?.percentage.toFixed(1)}%`;
  const indicatorAriaLabel = trend ? `${isUp ? 'Up' : 'Down'} ${trend.percentage}%` : `${indicator?.percentage.toFixed(1)}%`;
  const IndicatorIcon = indicatorDirection === 'up' ? ArrowUp : indicatorDirection === 'down' ? ArrowDown : null;
  return <Card className={cn('p-5', className)} style={style} data-testid={dataTestId}>
    <div className="flex items-start justify-between gap-3">
      <div className={cn('metric-card-heading', period && 'has-period')}>
        <div className={period ? 'metric-card-title' : 'text-[10px] font-normal uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]'}>{label}</div>
        {period && <span className="metric-card-period">{period}</span>}
      </div>
      {loading ? <Skeleton className="h-5 w-12 rounded-full" /> : (trend || indicator) && <span className={cn('metric-trend-badge', indicatorTone)} aria-label={indicatorAriaLabel}>
        {IndicatorIcon && <IndicatorIcon size={11} strokeWidth={2.5} aria-hidden="true" />}
        <span>{indicatorLabel}</span>
      </span>}
    </div>
    <div className="metric-value-row mt-3 font-display text-3xl font-bold tracking-[-.06em] metric-value">
      {loading ? <Skeleton className="h-9 w-24" /> : <>{valueAccessory}<span className="metric-value-content">{value}</span></>}
    </div>
    {note && (loading ? <Skeleton className="mt-3 h-3 w-40" /> : <div className="mt-2 text-xs font-normal leading-5 text-[hsl(var(--muted-foreground))]">{note}</div>)}
  </Card>;
}
function InsightCard({ icon: Icon, title, description, className = '', dataTestId }: { icon: typeof CircleDollarSign; title: string; description?: string; className?: string; dataTestId?: string }) {
  return <Card className={cn('flex items-center gap-4 p-5', className)} data-testid={dataTestId}><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[hsl(var(--accent))]/25 text-[hsl(var(--accent-foreground))]"><Icon size={18} /></div><div><div className="text-sm font-bold">{title}</div>{description && <p className="mt-1 text-xs leading-5 text-[hsl(var(--muted-foreground))]">{description}</p>}</div></Card>;
}

export function Onboarding() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(() => readOnboardingStep());
  const [profile, setProfile] = useState<SellerProfile>(() => readSellerProfile() || { sellerName: '', businessName: '', description: '', channels: [] });
  useEffect(() => {
    writeSellerProfile(profile);
  }, [profile]);
  useEffect(() => {
    writeOnboardingStep(step);
  }, [step]);
  const update = (key: keyof SellerProfile, value: string) => {
    const next = { ...profile, [key]: value };
    setProfile(next);
    writeSellerProfile(next);
  };
  const toggleChannel = (channel: string) => {
    const next = { ...profile, channels: togglePreference(profile.channels, channel) };
    setProfile(next);
    writeSellerProfile(next);
  };
  const changeStep = (nextStep: number) => {
    writeOnboardingStep(nextStep);
    setStep(nextStep);
  };
  const skip = () => { finishOnboarding(); setLocation('/'); };
  const next = () => {
    if (step === 0 && profile.description.trim()) changeStep(1);
    else if (step === 1 && profile.sellerName.trim() && profile.businessName.trim()) changeStep(2);
    else if (step === 2) { finishOnboarding(); changeStep(3); }
  };
  const canContinue = step === 0 ? Boolean(profile.description.trim()) : step === 1 ? Boolean(profile.sellerName.trim() && profile.businessName.trim()) : true;
  const continuationGuidance = step === 0 && !canContinue
    ? 'Add what you sell and where buyers find you before continuing.'
    : step === 1 && !canContinue
      ? 'Add your name and business or shop name before continuing.'
      : null;
  return <div className="onboarding-shell min-h-[100dvh] px-5 py-5 sm:px-8 sm:py-8">
    <header className="mx-auto flex max-w-[980px] items-center justify-between">
      <Link href="/" data-testid="link-onboarding-logo" aria-label="Take Order overview"><BrandLockup className="gap-2" /></Link>
      {step < 3 && <button onClick={skip} data-testid="button-skip-onboarding" className="soft-focus rounded-full px-3 py-2 text-xs font-semibold text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--card))] hover:text-[hsl(var(--foreground))]">Skip setup</button>}
    </header>
    <main className="onboarding-grid mx-auto mt-10 grid max-w-[980px] gap-8 rounded-[26px] border border-[hsl(var(--border))] bg-[hsl(var(--card))]/75 p-5 backdrop-blur-sm sm:mt-14 sm:p-10 lg:grid-cols-[.86fr_1.14fr] lg:p-14">
      <div className="flex flex-col justify-between">
        <div><div className="font-mono-ui text-[10px] font-bold uppercase tracking-[.18em] text-[hsl(var(--muted-foreground))]">A small start</div><h1 className="mt-4 max-w-[390px] font-display text-[clamp(38px,6vw,67px)] font-bold leading-[.92] tracking-[-.07em]">{step === 3 ? 'Your shop has a home.' : 'Let’s make the busy bits lighter.'}</h1><p className="mt-5 max-w-[380px] text-sm leading-6 text-[hsl(var(--muted-foreground))]">{step === 3 ? 'Your workspace is ready. Start with one product, then add the tools that help you understand where sales come from.' : 'Tell Take Order a little about how you sell. We’ll turn it into a short setup, not another admin project.'}</p></div>
        <div className="mt-10 hidden rounded-[16px] border border-[hsl(var(--border))] bg-[hsl(var(--background))]/70 p-4 lg:block"><div className="flex items-center gap-2 text-xs font-semibold"><span className="h-2 w-2 rounded-full bg-[hsl(var(--accent))]" />Private by default</div><p className="mt-2 text-[11px] leading-5 text-[hsl(var(--muted-foreground))]">Take Order never reads personal chats. You decide what becomes an order.</p></div>
      </div>
      <div className="rounded-[20px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 sm:p-7">
        {step < 3 && <div className="mb-8 flex items-center gap-2" aria-label="Setup progress">{[0, 1, 2].map((item) => <span key={item} className={cn('h-1.5 flex-1 rounded-full', item <= step ? 'bg-[hsl(var(--primary))]' : 'bg-[hsl(var(--muted))]')} />)}</div>}
        {step === 0 && <div className="page-in"><div className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">First, in your own words</div><h2 className="mt-3 font-display text-2xl font-bold tracking-[-.04em]">What do you sell, and where do buyers find you?</h2><p className="mt-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">Write it like you would tell a friend. We’ll use this to shape your checklist.</p><textarea autoFocus data-testid="input-onboarding-description" value={profile.description} onChange={(event) => update('description', event.target.value)} placeholder="I sell handmade jewellery, mostly through Instagram and WhatsApp." rows={6} className="field-input mt-6 resize-none leading-6" /><div className="mt-3 flex items-start gap-2 text-[11px] leading-5 text-[hsl(var(--muted-foreground))]"><CheckCircle2 size={14} className="mt-0.5 shrink-0 text-[hsl(var(--accent-foreground))]" />No account connections are needed for setup.</div></div>}
        {step === 1 && <div className="page-in"><div className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">Make it yours</div><h2 className="mt-3 font-display text-2xl font-bold tracking-[-.04em]">What should we call your workspace?</h2><p className="mt-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">This stays on this device for now and helps Take Order speak like it belongs to you.</p><div className="mt-7 space-y-5"><div><label className="field-label" htmlFor="onboarding-seller-name">Your name</label><input autoFocus id="onboarding-seller-name" data-testid="input-onboarding-seller-name" value={profile.sellerName} onChange={(event) => update('sellerName', event.target.value)} placeholder="e.g. Amina Mensah" className="field-input" /></div><div><label className="field-label" htmlFor="onboarding-business-name">Business or shop name</label><input id="onboarding-business-name" data-testid="input-onboarding-business-name" value={profile.businessName} onChange={(event) => update('businessName', event.target.value)} placeholder="e.g. The Sunday Edit" className="field-input" /></div></div></div>}
        {step === 2 && <div className="page-in"><div className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">One useful detail</div><h2 className="mt-3 font-display text-2xl font-bold tracking-[-.04em]">Where do you usually sell?</h2><p className="mt-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">Pick any that fit. These are just workspace preferences; Take Order does not connect or read them.</p><div className="mt-7"><OnboardingChannelPicker selectedChannels={profile.channels} onToggle={toggleChannel} /></div></div>}
        {step === 3 && <div className="page-in"><div className="flex h-12 w-12 items-center justify-center rounded-[15px] bg-[hsl(var(--accent))] text-white"><Check size={23} /></div><div className="mt-7 font-mono-ui text-[10px] uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">Setup complete</div><h2 className="mt-3 font-display text-3xl font-bold tracking-[-.05em]">A good first week starts with one item.</h2><p className="mt-3 text-sm leading-6 text-[hsl(var(--muted-foreground))]">Your preferences are saved locally. Choose the next useful step and Take Order will keep the rest tidy.</p><div className="mt-7 space-y-2"><Link href="/catalog" data-testid="link-onboarding-add-item" className="flex items-center gap-3 rounded-[13px] border border-[hsl(var(--border))] p-4 transition-colors hover:bg-[hsl(var(--muted))]"><span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[hsl(42_81%_67%/.3)] font-mono-ui text-xs font-bold">01</span><span className="flex-1"><span className="block text-sm font-bold">Add your first catalog item</span><span className="mt-1 block text-xs text-[hsl(var(--muted-foreground))]">Name, price, cost, and stock — that’s the foundation.</span></span><ArrowRight size={16} /></Link><Link href="/connect" data-testid="link-onboarding-connect-tools" className="flex items-center gap-3 rounded-[13px] border border-[hsl(var(--border))] p-4 transition-colors hover:bg-[hsl(var(--muted))]"><span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[hsl(157_42%_45%/.16)] font-mono-ui text-xs font-bold">02</span><span className="flex-1"><span className="block text-sm font-bold">Review optional tools</span><span className="mt-1 block text-xs text-[hsl(var(--muted-foreground))]">Save the channels and payment tools you use.</span></span><ArrowRight size={16} /></Link></div><Button onClick={() => setLocation('/')} className="mt-7 w-full" data-testid="button-open-workspace">Open my workspace <ArrowRight size={15} /></Button></div>}
        {step < 3 && <div className="mt-8 border-t border-[hsl(var(--border))] pt-5">
          {continuationGuidance && <p id="onboarding-continue-guidance" role="status" aria-live="polite" aria-atomic="true" className="mb-4 text-xs leading-5 text-[hsl(var(--muted-foreground))]">{continuationGuidance}</p>}
          <div className="flex items-center justify-between">
            <button onClick={() => step === 0 ? skip() : changeStep(step - 1)} data-testid="button-onboarding-back" className="soft-focus inline-flex items-center gap-2 rounded-[10px] px-2 py-2 text-xs font-semibold text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]">{step === 0 ? 'Not now' : <><ArrowLeft size={14} />Back</>}</button>
            <Button onClick={next} disabled={!canContinue} aria-describedby={continuationGuidance ? 'onboarding-continue-guidance' : undefined} data-testid="button-onboarding-continue">{step === 2 ? 'Finish setup' : 'Continue'}<ArrowRight size={15} /></Button>
          </div>
        </div>}
      </div>
    </main>
  </div>;
}

function HomeRoute() {
  const [, setLocation] = useLocation();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (window.localStorage.getItem(ONBOARDING_DONE_KEY) !== 'true') setLocation('/onboarding');
    else setReady(true);
  }, [setLocation]);
  if (!ready) return <div className="onboarding-shell flex min-h-[100dvh] items-center justify-center p-6"><div className="w-full max-w-[320px]"><Skeleton className="mx-auto h-10 w-10 rounded-[14px]" /><Skeleton className="mx-auto mt-6 h-8 w-48" /><Skeleton className="mx-auto mt-3 h-3 w-60" /></div></div>;
  return <Overview />;
}

export function Overview() {
  const today = inputDate(new Date());
  const [savedDashboardPeriod] = useState<DashboardPeriodPreference | null>(() => readDashboardPeriodPreference());
  const [period, setPeriod] = useState<DashboardPeriod>(() => savedDashboardPeriod?.period ?? 'week');
  const [draftPeriod, setDraftPeriod] = useState<DashboardPeriod>(() => savedDashboardPeriod?.period ?? 'week');
  const [periodMenuOpen, setPeriodMenuOpen] = useState(false);
  const periodMenuRef = useRef<HTMLDivElement>(null);
  const periodTriggerRef = useRef<HTMLButtonElement>(null);
  const periodMenuWasOpen = useRef(false);
  const [connectedTools, setConnectedTools] = useState<string[]>(readConnectedTools);
  useEffect(() => {
    const storage = getPreferenceStorage();
    if (!storage) return;
    setConnectedTools(readConnectedTools(storage));
    return subscribeToPreferenceChanges(CONNECTED_TOOLS_KEY, (event) => {
      if (event.storageArea && event.storageArea !== storage) return;
      setConnectedTools(readConnectedTools(storage));
    });
  }, []);
  useEffect(() => {
    const storage = getPreferenceStorage();
    if (!storage) return;
    return subscribeToPreferenceChanges(DASHBOARD_PERIOD_KEY, (event) => {
      if (event.storageArea && event.storageArea !== storage) return;
      const nextPreference = readDashboardPeriodPreference(storage);
      if (!nextPreference) return;
      setPeriod(nextPreference.period);
      if (nextPreference.period === 'custom') {
        setAppliedCustomRange({
          from: nextPreference.customFrom,
          to: nextPreference.customTo,
        });
      }
    });
  }, []);
  const initialCustomRange = useMemo(() => ({ from: shiftInputDate(today, -29), to: today }), [today]);
  const restoredCustomRange = savedDashboardPeriod?.period === 'custom'
    ? { from: savedDashboardPeriod.customFrom, to: savedDashboardPeriod.customTo }
    : initialCustomRange;
  const [appliedCustomRange, setAppliedCustomRange] = useState<DashboardDateRange>(() => restoredCustomRange);
  const [draftCustomRange, setDraftCustomRange] = useState<DashboardDateRange>(() => restoredCustomRange);
  const periodRange = useMemo(() => dashboardPeriodRange(period, appliedCustomRange.from, appliedCustomRange.to), [period, appliedCustomRange]);
  const draftPeriodRange = useMemo(() => dashboardPeriodRange(draftPeriod, draftCustomRange.from, draftCustomRange.to), [draftPeriod, draftCustomRange]);
  const periodLabel = dashboardPeriodLabel(period, appliedCustomRange.from, appliedCustomRange.to);
  const summaryQuery = useGetDashboardSummary(periodRange, { query: { queryKey: getGetDashboardSummaryQueryKey(periodRange ?? undefined), placeholderData: (previousData) => previousData } });
  const summaryRefreshing = summaryQuery.isFetching && !summaryQuery.isLoading && Boolean(summaryQuery.data);
  const productsQuery = useListProducts();
  const ordersQuery = useListOrders();
  const summary = summaryQuery.data;
  const channels = summary?.channelPerformance ?? [];
  const daily = summary?.dailyPerformance ?? [];
  const productPerformance = summary?.productPerformance ?? [];
  const products = productsQuery.data ?? [];
  const orders = ordersQuery.data ?? [];
  const periodOrders = useMemo(() => periodRange ? orders.filter((order) => {
    const date = new Date(order.createdAt).toISOString().slice(0, 10);
    return date >= periodRange.from && date <= periodRange.to;
  }) : orders, [orders, periodRange]);
  const lowStock = products.filter((product) => product.stock <= 3);
  const missingCosts = products.filter((product) => product.cost == null);
  const totalOpens = channels.reduce((sum, channel) => sum + channel.opens, 0);
  const activeChannels = channels.filter((channel) => channel.opens > 0).length;
  const namedClients = new Set(periodOrders.map((order) => order.customerName?.trim()).filter(Boolean)).size;
  const waitingPayments = periodOrders.filter((order) => order.status === 'reserved' || order.status === 'deposit_paid').length;
  const shippedOrders = periodOrders.filter((order) => order.fulfillment === 'shipped' || order.fulfillment === 'delivered').length;
  const paidConversion = periodOrders.length ? Math.round(((summary?.orders ?? 0) / periodOrders.length) * 100) : 0;
  const firstDay = daily[0]?.label;
  const lastDay = daily[daily.length - 1]?.label;
  const dateContext = firstDay && lastDay ? `${firstDay} – ${lastDay}` : 'Your latest reporting window';
  const recentDaily = daily.slice(Math.ceil(daily.length / 2));
  const earlierDaily = daily.slice(0, Math.ceil(daily.length / 2));
  const movement = (key: 'orders' | 'revenue'): MetricTrend => {
    const recent = recentDaily.reduce((sum, day) => sum + day[key], 0);
    const earlier = earlierDaily.reduce((sum, day) => sum + day[key], 0);
    const percentage = earlier > 0 ? Math.round(((recent - earlier) / earlier) * 100) : recent > 0 ? 100 : 0;
    return { direction: percentage >= 0 && recent > 0 ? 'up' : 'down', percentage: Math.abs(percentage) };
  };
  const salesTrend = movement('orders');
  const revenueTrend = movement('revenue');
  const engagementValue = (value: number | null | undefined) => value == null ? '—' : number(value);
  const primaryStatCards: DashboardStatCard[] = [
    { label: 'Sales', value: ordersQuery.isLoading ? '—' : periodOrders.length, trend: salesTrend, note: `${paidConversion}% paid conversion · ${waitingPayments} waiting payments` },
      { label: 'Revenue', value: money(summary?.revenue), trend: revenueTrend, note: `Total profit made: ${money(summary?.profit)}` },
      { label: 'Views', value: ordersQuery.isLoading ? '—' : namedClients, valueAccessory: <SocialChannelStack channels={connectedTools} />, note: 'Total views received' },
    { label: 'Active users', value: totalOpens, note: 'People viewing your links' },
  ];
  const secondaryStatCards: DashboardStatCard[] = [
    { label: 'Outstanding balances', value: money(summary?.outstanding), note: `${waitingPayments} waiting payments` },
    { label: 'Orders', value: summary?.orders ?? 0, trend: movement('orders'), note: `${shippedOrders} shipped` },
    { label: 'Shares', value: engagementValue(summary?.shares), valueAccessory: <SocialChannelStack channels={connectedTools} />, note: summary?.shares == null ? 'No recorded share activity for this period' : 'Recorded shares in this period' },
    { label: 'Likes', value: engagementValue(summary?.likes), valueAccessory: <SocialChannelStack channels={connectedTools} />, note: summary?.likes == null ? 'No recorded like activity for this period' : 'Recorded likes in this period' },
  ];
  const analyticsState = getAnalyticsViewState({
    isLoading: summaryQuery.isLoading && !summaryQuery.data,
    isError: summaryQuery.isError && !summaryQuery.data,
    summary,
  });
  const closePeriodMenu = () => {
    setDraftPeriod(period);
    setDraftCustomRange(appliedCustomRange);
    setPeriodMenuOpen(false);
  };
  const chooseCustomPeriod = () => {
    setDraftPeriod('custom');
    if (period !== 'custom') setDraftCustomRange(initialCustomRange);
  };
  const applyCustomPeriod = () => {
    if (!draftPeriodRange) return;
    setAppliedCustomRange(draftPeriodRange);
    setPeriod('custom');
    setDraftPeriod('custom');
    setPeriodMenuOpen(false);
  };
  useEffect(() => {
    writeDashboardPeriodPreference({
      period,
      customFrom: appliedCustomRange.from,
      customTo: appliedCustomRange.to,
    });
  }, [period, appliedCustomRange]);
  useEffect(() => {
    if (periodMenuOpen) {
      periodMenuWasOpen.current = true;
      return;
    }
    if (periodMenuWasOpen.current) {
      periodMenuWasOpen.current = false;
      periodTriggerRef.current?.focus();
    }
  }, [periodMenuOpen]);
  useEffect(() => {
    if (!periodMenuOpen) return;
    const dismissOnOutsidePointer = (event: PointerEvent) => {
      if (periodMenuRef.current && !periodMenuRef.current.contains(event.target as Node)) closePeriodMenu();
    };
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closePeriodMenu();
      }
    };
    document.addEventListener('pointerdown', dismissOnOutsidePointer);
    document.addEventListener('keydown', dismissOnEscape);
    return () => {
      document.removeEventListener('pointerdown', dismissOnOutsidePointer);
      document.removeEventListener('keydown', dismissOnEscape);
    };
  }, [periodMenuOpen, period, appliedCustomRange]);
  return <Shell><div data-testid="dashboard-analytics" data-analytics-state={analyticsState}><AnalyticsStateMarker state={analyticsState} /><PageHeading title="Dashboard" action={<div className="flex flex-wrap items-center gap-2"><div className="relative" ref={periodMenuRef}><button ref={periodTriggerRef} type="button" className="period-chip" aria-label="Reporting period" aria-expanded={periodMenuOpen} onClick={() => { setDraftPeriod(period); setDraftCustomRange(appliedCustomRange); setPeriodMenuOpen((open) => !open); }} data-testid="button-dashboard-period"><span className="h-2 w-2 rounded-full bg-[hsl(var(--accent-foreground))]" />{periodLabel}<ChevronDown size={14} className={cn('transition-transform', periodMenuOpen && 'rotate-180')} /></button>{periodMenuOpen && <div className={cn('dashboard-period-menu', draftPeriod === 'custom' && 'is-custom')} role="dialog" aria-label="Choose reporting period">{draftPeriod !== 'custom' && <div className="dashboard-period-options">{dashboardPeriodOptions.map((option) => <button type="button" key={option.value} className={cn('dashboard-period-option', draftPeriod === option.value && 'is-active')} onClick={() => { setPeriod(option.value); setDraftPeriod(option.value); setPeriodMenuOpen(false); }} aria-pressed={draftPeriod === option.value}>{option.label}</button>)}<button type="button" className="dashboard-period-option" onClick={chooseCustomPeriod} aria-pressed={false} data-testid="button-dashboard-period-custom">Custom range</button></div>}{draftPeriod === 'custom' && <DashboardCustomRangePicker from={draftCustomRange.from} to={draftCustomRange.to} onFromChange={(from) => setDraftCustomRange((current) => ({ ...current, from }))} onToChange={(to) => setDraftCustomRange((current) => ({ ...current, to }))} onClose={closePeriodMenu} onApply={applyCustomPeriod} canApply={Boolean(draftPeriodRange)} />}</div>}</div><Link href="/take-order" data-testid="link-take-order-hero"><Button><Plus size={16} />Take an order</Button></Link></div>} />
    {summaryQuery.isLoading && !summaryQuery.data ? <OverviewSkeleton /> : summaryQuery.isError && !summaryQuery.data ? <ErrorState retry={() => summaryQuery.refetch()} /> : <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
         {primaryStatCards.map((stat, index) => <MetricCard key={`${stat.label}-${index}`} className="rise-in" style={{ animationDelay: `${index * 55}ms` }} dataTestId={`card-kpi-${stat.label.toLowerCase().replaceAll(' ', '-')}`} label={stat.label} value={stat.value} valueAccessory={stat.valueAccessory} trend={stat.trend} indicator={stat.indicator} note={stat.note} period={periodLabel} loading={summaryRefreshing} />)}
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
         {secondaryStatCards.map((stat, index) => <MetricCard key={`${stat.label}-${index}`} className="overview-secondary-card rise-in" style={{ animationDelay: `${(index + 4) * 55}ms` }} dataTestId={`card-kpi-secondary-${stat.label.toLowerCase().replaceAll(' ', '-')}`} label={stat.label} value={stat.value} valueAccessory={stat.valueAccessory} trend={stat.trend} indicator={stat.indicator} note={stat.note} period={periodLabel} loading={summaryRefreshing} />)}
      </div>
         <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(300px,.8fr)]">
          <Card className="p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="font-mono-ui text-[10px] uppercase tracking-[.15em] text-[hsl(var(--muted-foreground))]">Cash flow</div><h2 className="mt-2 font-display text-xl font-bold tracking-[-.035em]">Revenue, costs, and net profit</h2><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Product costs and operating expenses stay separate</p></div><div className="rounded-[10px] border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 font-mono-ui text-[10px] text-[hsl(var(--muted-foreground))]">{periodLabel}</div></div><div className="mt-6 h-[280px]" data-testid="chart-cash-flow" aria-busy={summaryRefreshing}>{summaryRefreshing ? <div className="flex h-full flex-col justify-center gap-4"><Skeleton className="h-3 w-28" /><Skeleton className="h-48 w-full" /></div> : daily.length ? <ResponsiveContainer width="100%" height="100%" debounce={0}><LineChart data={daily} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}><CartesianGrid strokeDasharray="3 4" stroke="hsl(220 16% 86% / .7)" vertical={false} /><XAxis dataKey="label" tick={{ fontSize: 12, fill: '#68717d' }} stroke="#aeb5bd" tickLine={false} axisLine={false} /><YAxis tick={{ fontSize: 12, fill: '#68717d' }} stroke="#aeb5bd" tickLine={false} axisLine={false} tickFormatter={(value) => money(value)} width={58} /><RechartsTooltip content={<AnalyticsTooltip />} cursor={{ stroke: '#9ca6b2', strokeDasharray: '3 3' }} isAnimationActive={false} /><RechartsLegend wrapperStyle={{ fontSize: '12px', paddingTop: '12px' }} /><Line type="monotone" dataKey="revenue" name="Revenue" stroke="#c9943d" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} isAnimationActive={false} /><Line type="monotone" dataKey="productCosts" name="Product costs" stroke="#b66b77" strokeWidth={2} dot={false} activeDot={{ r: 5 }} isAnimationActive={false} /><Line type="monotone" dataKey="operatingExpenses" name="Operating expenses" stroke="#7b83b7" strokeWidth={2} dot={false} activeDot={{ r: 5 }} isAnimationActive={false} /><Line type="monotone" dataKey="expenses" name="Combined expenses" stroke="#c47763" strokeWidth={2} dot={false} activeDot={{ r: 5 }} isAnimationActive={false} /><Line type="monotone" dataKey="profit" name="Net profit" stroke="#438879" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} isAnimationActive={false} /></LineChart></ResponsiveContainer> : <ChartEmpty message="Cash-flow data will appear after your first activity." />}</div></Card>
         <AlertsRail outstanding={summary?.outstanding ?? 0} lowStock={lowStock} missingCosts={missingCosts} productLoading={productsQuery.isLoading} productCount={products.length} orderCount={periodOrders.length} loading={summaryRefreshing} />
      </div>
      <div className="mt-8 grid gap-5 xl:gap-12 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,.85fr)]">
         <ProductPerformance products={productPerformance} loading={summaryRefreshing} />
         <ChannelPerformance channels={channels} loading={summaryRefreshing} />
      </div>
      <RecentTransactions />
    </>}</div></Shell>;
}

function OverviewSkeleton() {
  return <div className="space-y-5" aria-label="Loading overview"><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[1, 2, 3, 4].map((i) => <Card key={i} className="h-[145px] p-5"><Skeleton className="h-3 w-20" /><Skeleton className="mt-6 h-8 w-32" /><Skeleton className="mt-3 h-3 w-36" /></Card>)}</div><div className="grid gap-5 xl:grid-cols-[1.7fr_.8fr]"><Card className="h-[370px] p-6"><Skeleton className="h-4 w-36" /><Skeleton className="mt-3 h-3 w-52" /><Skeleton className="mt-8 h-[260px] w-full" /></Card><Card className="h-[370px] p-6"><Skeleton className="h-4 w-28" /><Skeleton className="mt-6 h-16 w-full" /><Skeleton className="mt-3 h-16 w-full" /><Skeleton className="mt-3 h-16 w-full" /></Card></div></div>;
}

function Reports() {
  const summaryQuery = useGetDashboardSummary();
  const summary = summaryQuery.data;
  const productPerformance = summary?.productPerformance ?? [];
  const categoryData = useMemo(() => {
    const grouped = productPerformance.reduce<Record<string, number>>((result, item) => {
      const category = item.category?.trim() || 'Uncategorised';
      result[category] = (result[category] ?? 0) + (item.revenue || 0);
      return result;
    }, {});
    return Object.entries(grouped)
      .map(([name, value]) => ({ name, value }))
      .sort((left, right) => right.value - left.value);
  }, [productPerformance]);
  const totalCategoryRevenue = categoryData.reduce((total, item) => total + item.value, 0);
  const rankedProducts = useMemo(() => [...productPerformance].sort((left, right) => right.revenue - left.revenue), [productPerformance]);
  const palette = ['#c9943d', '#438879', '#b66b77', '#6c82b4', '#d99566', '#7f8f68'];

  return <Shell>
    <PageHeading
      title="Reports"
      action={<div className="reports-period-note" data-testid="text-reports-period"><span className="h-2 w-2 rounded-full bg-[hsl(var(--accent-foreground))]" />Current snapshot</div>}
    />
    {summaryQuery.isLoading ? <ReportsSkeleton /> : summaryQuery.isError ? <ErrorState retry={() => summaryQuery.refetch()} /> : <div className="space-y-5">
      <section className="reports-metric-grid" aria-label="Profitability summary">
         <MetricCard className="rise-in" dataTestId="card-report-tracked-profit" label="Reported profit" value={<span data-testid="text-report-profit">{money(summary?.profit)}</span>} indicator={{ direction: (summary?.profit ?? 0) >= 0 ? 'up' : 'down', percentage: summary?.revenue ? Math.abs((summary.profit / summary.revenue) * 100) : 0 }} note={summary?.legacyOrders ? `${summary.legacyOrders} legacy ${summary.legacyOrders === 1 ? 'sale uses' : 'sales use'} estimated costs.` : 'Revenue less recorded product and operating costs.'} />
         <MetricCard className="rise-in" style={{ animationDelay: '55ms' }} dataTestId="card-report-cash-balance" label="Cash balance" value={<span data-testid="text-report-cash-balance">{money(summary?.cashBalance)}</span>} indicator={{ direction: (summary?.cashBalance ?? 0) >= 0 ? 'up' : 'down', percentage: summary?.revenue ? Math.abs(((summary.cashBalance ?? 0) / summary.revenue) * 100) : 0 }} note="Available after recorded payments and expenses." />
        <MetricCard className="rise-in" style={{ animationDelay: '110ms' }} dataTestId="card-report-context" label="Snapshot context" value={money(summary?.revenue)} note={`${summary?.orders ?? 0} recorded orders${summary?.bestSeller ? ` · ${summary.bestSeller} leads` : ''}`} />
      </section>

      <section className="grid gap-5 xl:gap-12 xl:grid-cols-[minmax(0,.88fr)_minmax(0,1.12fr)]">
        <Card className="overflow-hidden" data-testid="card-report-category-breakdown">
           <div className="reports-panel-heading"><div><div className="font-mono-ui text-[10px] uppercase tracking-[.15em] text-[hsl(var(--muted-foreground))]">Where revenue sits</div><h2 className="mt-2 font-display text-xl font-bold tracking-[-.035em]">Category breakdown</h2></div><BarChart3 size={18} className="text-[hsl(var(--muted-foreground))]" /></div>
          <div className="reports-donut-area">
            {categoryData.length && totalCategoryRevenue > 0 ? <ResponsiveContainer width="100%" height="100%"><PieChart>
              <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="47%" innerRadius="54%" outerRadius="73%" paddingAngle={2} stroke="hsl(var(--card))" strokeWidth={3} isAnimationActive={false}>
                {categoryData.map((item, index) => <Cell key={item.name} fill={palette[index % palette.length]} />)}
              </Pie>
              <RechartsTooltip formatter={(value: number) => moneyExact(value)} contentStyle={{ borderRadius: 10, border: '1px solid hsl(42 20% 86%)', background: 'hsl(48 40% 99%)', fontSize: 12 }} itemStyle={{ color: 'hsl(224 27% 17%)' }} isAnimationActive={false} />
              <RechartsLegend verticalAlign="bottom" height={30} iconType="circle" wrapperStyle={{ fontSize: 11, color: '#68717d' }} />
            </PieChart></ResponsiveContainer> : <ChartEmpty message="Category revenue will appear after your first recorded sale." />}
          </div>
           <div className="border-t border-[hsl(var(--border))] px-5 py-4 text-[11px] leading-5 text-[hsl(var(--muted-foreground))] sm:px-6"><strong className="text-[hsl(var(--foreground))]">{categoryData.length ? `${categoryData.length} ${categoryData.length === 1 ? 'category' : 'categories'}` : 'No categories yet'}</strong></div>
       </Card>
        <Card className="overflow-hidden" data-testid="card-report-selling-items">
          <div className="reports-panel-heading"><div><div className="font-mono-ui text-[10px] uppercase tracking-[.15em] text-[hsl(var(--muted-foreground))]">Product performance</div><h2 className="mt-2 font-display text-xl font-bold tracking-[-.035em]">Top-selling items</h2><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Ranked by recorded revenue, not quantity sold</p></div><Package size={18} className="text-[hsl(var(--muted-foreground))]" /></div>
          {rankedProducts.length ? <div className="reports-table-wrap"><table className="reports-table"><thead><tr><th>Item</th><th>Category</th><th className="text-right">Orders</th><th className="text-right">Revenue</th><th>Margin / cost</th><th className="text-right">Stock</th><th>Detail</th></tr></thead><tbody>{rankedProducts.map((item, index) => {
            const share = totalCategoryRevenue ? (item.revenue / totalCategoryRevenue) * 100 : 0;
             return <tr key={`${item.name}-${index}`} data-testid={`row-report-item-${index}`}><td><div className="font-semibold">{item.name}</div></td><td><span className="reports-category-tag">{item.category || 'Uncategorised'}</span></td><td className="data-value text-right text-xs">{item.orders}</td><td className="data-value text-right text-xs font-bold">{money(item.revenue)}</td><td>{item.marginStatus === 'tracked' ? <span className="reports-cost-status reports-cost-tracked">{item.margin.toFixed(1)}% margin</span> : item.marginStatus === 'estimated' ? <span className="reports-cost-status reports-cost-missing" title={`${item.legacyOrders} legacy ${item.legacyOrders === 1 ? 'sale' : 'sales'} included`}>{item.margin.toFixed(1)}% estimated</span> : <span className="reports-cost-status reports-cost-missing">Cost not tracked</span>}</td><td className="data-value text-right text-xs">{item.stock}</td><td className="text-[11px] text-[hsl(var(--muted-foreground))]">{item.legacyOrders ? `${item.legacyOrders} legacy ${item.legacyOrders === 1 ? 'sale' : 'sales'} · ${share ? `${share.toFixed(1)}% of revenue` : 'no revenue share'}` : share ? `${share.toFixed(1)}% of recorded revenue` : 'No revenue recorded'}</td></tr>;
          })}</tbody></table></div> : <div className="p-6"><EmptyState icon={PackageSearch} title="No selling pattern yet" description="Once product performance is recorded, your highest-revenue items will appear here." /></div>}
        </Card>
      </section>
       <div className="flex items-start gap-3 rounded-[12px] border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/55 px-4 py-3 text-[11px] leading-5 text-[hsl(var(--muted-foreground))]" data-testid="text-report-data-note"><CircleDollarSign size={15} className="mt-0.5 shrink-0 text-[hsl(var(--accent-foreground))]" /><span><strong className="text-[hsl(var(--foreground))]">A note on this report:</strong> Take Order currently records orders, revenue, stock, and optional product costs. {summary?.legacyOrders ? `${summary.legacyOrders} legacy ${summary.legacyOrders === 1 ? 'sale has' : 'sales have'} no captured sale-time cost, so affected margins and product costs are estimates based on today’s catalog.` : 'All paid sales have captured sale-time costs.'} It does not store item quantity or historical comparison data, so this page intentionally uses “orders” and “detail” rather than invented sales trends.</span></div>
    </div>}
  </Shell>;
}

function ReportsSkeleton() {
  return <div className="space-y-5" aria-label="Loading reports"><div className="reports-metric-grid"><Card className="h-[220px] p-6"><Skeleton className="h-3 w-24" /><Skeleton className="mt-7 h-12 w-40" /><Skeleton className="mt-6 h-3 w-56" /></Card><Card className="h-[220px] p-6"><Skeleton className="h-3 w-24" /><Skeleton className="mt-7 h-12 w-40" /><Skeleton className="mt-6 h-3 w-56" /></Card><Card className="h-[220px] p-6"><Skeleton className="h-3 w-28" /><Skeleton className="mt-7 h-8 w-full" /><Skeleton className="mt-5 h-3 w-40" /></Card></div><div className="grid gap-5 xl:grid-cols-[.88fr_1.12fr]"><Card className="h-[465px] p-6"><Skeleton className="h-4 w-36" /><Skeleton className="mt-3 h-3 w-52" /><Skeleton className="mx-auto mt-10 h-56 w-56 rounded-full" /></Card><Card className="h-[465px] p-6"><Skeleton className="h-4 w-44" /><Skeleton className="mt-3 h-3 w-64" /><Skeleton className="mt-9 h-10 w-full" /><Skeleton className="mt-4 h-14 w-full" /><Skeleton className="mt-3 h-14 w-full" /><Skeleton className="mt-3 h-14 w-full" /></Card></div></div>;
}

function AnalyticsTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name?: string; value?: number; color?: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return <div className="chart-tooltip"><div className="mb-2 font-semibold">{label}</div>{payload.map((entry) => <div key={entry.name} className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} /><span className="text-[hsl(var(--muted-foreground))]">{entry.name}</span><strong className="ml-auto pl-5">{money(entry.value)}</strong></div>)}</div>;
}

function ChartEmpty({ message }: { message: string }) {
  return <div className="flex h-full items-center justify-center rounded-[12px] border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--background))] px-6 text-center text-sm text-[hsl(var(--muted-foreground))]">{message}</div>;
}

function DashboardRowsSkeleton({ count = 3 }: { count?: number }) {
  return <div className="space-y-3" aria-label="Loading card content">{Array.from({ length: count }, (_, index) => <div key={index} className="flex items-center gap-3"><Skeleton className="h-8 w-8 rounded-[10px]" /><Skeleton className="h-3 flex-1" /><Skeleton className="h-3 w-16" /></div>)}</div>;
}

function AlertsRail({ outstanding, lowStock, missingCosts, productLoading, productCount, orderCount, loading = false }: { outstanding: number; lowStock: Product[]; missingCosts: Product[]; productLoading: boolean; productCount: number; orderCount: number; loading?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    if (!expanded) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setExpanded(false);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [expanded]);
  const alerts = [
    { id: 'rose', icon: Receipt, tone: 'rose', title: outstanding > 0 ? `${money(outstanding)} outstanding` : 'No outstanding deposits', detail: outstanding > 0 ? 'Follow up on deposits before they go cold.' : 'Your deposits are all accounted for.', href: '/orders', action: outstanding > 0 ? 'Review orders' : 'Open orders' },
    { id: 'gold', icon: PackageSearch, tone: 'gold', title: productLoading ? 'Checking stock levels' : `${lowStock.length} low-stock ${lowStock.length === 1 ? 'item' : 'items'}`, detail: lowStock.length ? lowStock.slice(0, 2).map((item) => item.name).join(' · ') : 'Nothing needs a restock right now.', href: '/catalog', action: 'Review catalog' },
    { id: 'blue', icon: CircleDollarSign, tone: 'blue', title: productLoading ? 'Checking cost prices' : `${missingCosts.length} missing cost ${missingCosts.length === 1 ? 'price' : 'prices'}`, detail: missingCosts.length ? 'Add costs to keep margin reporting honest.' : 'All catalog costs are tracked.', href: '/catalog', action: 'Add costs' },
  ];
  const additionalAlerts = [
    { id: 'share', icon: Link2, tone: 'mint', title: orderCount ? 'Share your order link' : 'Share your first order link', detail: orderCount ? 'Keep your link visible wherever buyers find you.' : 'Send it to buyers to start collecting orders.', href: '/take-order', action: 'Open order link' },
    { id: 'catalog', icon: Package, tone: 'gold', title: productCount ? 'Review your catalog' : 'Add your first product', detail: productCount ? 'Keep product details, prices, and stock ready for buyers.' : 'Add an item so you can start building order links.', href: '/catalog', action: productCount ? 'Open catalog' : 'Add product' },
    { id: 'reports', icon: BarChart3, tone: 'blue', title: 'Review performance', detail: 'See what is selling and where buyers are coming from.', href: '/reports', action: 'Open reports' },
    { id: 'connect', icon: Settings2, tone: 'gold', title: 'Tune your tools', detail: 'Update the channels and payment tools you use.', href: '/connect', action: 'Review tools' },
  ];
  const visibleAlerts = expanded ? [...alerts, ...additionalAlerts] : alerts;
  return <>{expanded && <button type="button" className="alerts-backdrop" aria-label="Close action center" onClick={() => setExpanded(false)} />}<Card className={cn('alerts-rail-card overflow-hidden', expanded && 'is-expanded')}><div className="border-b border-[hsl(var(--border))] px-5 py-5 sm:px-6"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><AlertTriangle size={16} className="text-[hsl(var(--chart-3))]" /><div className="font-mono-ui text-[10px] uppercase tracking-[.15em] text-[hsl(var(--muted-foreground))]">Seller updates</div></div><button type="button" className="alerts-expand-button" aria-expanded={expanded} aria-controls="dashboard-action-list" onClick={() => setExpanded((value) => !value)} data-testid="button-toggle-dashboard-actions">{expanded ? 'Close' : 'Show all'}{expanded ? <X size={14} /> : <ChevronDown size={14} />}</button></div><h2 className="mt-2 font-display text-xl font-bold tracking-[-.035em]">Action center</h2></div><div id="dashboard-action-list" className={cn('alerts-list divide-y divide-[hsl(var(--border))]', expanded && 'is-expanded')}>{loading ? <div className="space-y-5 p-5 sm:p-6"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div> : visibleAlerts.map((alert) => <Link href={alert.href} key={alert.id} className="alert-row group flex gap-3 px-5 py-4 sm:px-6" data-testid={`link-alert-${alert.id}`}><div className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px]', alert.tone === 'rose' && 'bg-[hsl(345_39%_58%/.14)] text-[hsl(345_39%_40%)]', alert.tone === 'gold' && 'bg-[hsl(42_81%_67%/.25)] text-[hsl(31_64%_34%)]', alert.tone === 'blue' && 'bg-[hsl(220_45%_47%/.13)] text-[hsl(220_45%_37%)]', alert.tone === 'mint' && 'bg-[hsl(157_42%_45%/.14)] text-[hsl(165_34%_28%)]')}><alert.icon size={15} /></div><div className="min-w-0 flex-1"><div className="text-sm font-semibold">{alert.title}</div><p className="mt-1 text-xs leading-5 text-[hsl(var(--muted-foreground))]">{alert.detail}</p><div className="mt-2 text-[10px] font-bold text-[hsl(var(--primary))] group-hover:underline">{alert.action}<ArrowUpRight size={12} className="ml-1 inline" /></div></div></Link>)}</div></Card></>;
}

function ProductPerformance({ products, loading = false }: { products: Array<{ name: string; category: string; revenue: number; orders: number; stock: number; margin: number; costTracked: boolean; marginStatus: 'tracked' | 'estimated' | 'unavailable'; snapshotOrders: number; legacyOrders: number }>; loading?: boolean }) {
  const ranked = [...products].sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  return <section className="overview-stat-section overview-product-card" aria-labelledby="product-performance-title">
    <div className="overview-card-title">
      <div className="font-display text-lg font-bold tracking-[-.03em]" id="product-performance-title">Best-selling items</div>
      <div className="font-mono-ui text-[11px] uppercase tracking-[.13em] text-[hsl(var(--muted-foreground))]">Product performance</div>
    </div>
    {loading ? <div className="mt-5"><DashboardRowsSkeleton /></div> : ranked.length ? <div className="overview-card-table" role="table" aria-label="Best-selling items">
      <div className="overview-card-table-head" role="row"><span role="columnheader">Item</span><span role="columnheader">Orders</span><span className="text-right" role="columnheader">Revenue</span></div>
      {ranked.map((product, index) => <div key={product.name} className="overview-card-table-row product-performance-row" data-testid={`row-product-performance-${index}`} role="row">
        <span className="min-w-0 truncate font-semibold" role="cell">{product.name}</span>
         <span className="overview-product-orders data-value text-xs" role="cell"><span>{number(product.orders)}</span><span className={cn('overview-product-signal', product.orders > 0 ? 'overview-product-signal-up' : 'overview-product-signal-down')} aria-label={product.orders > 0 ? 'Sales activity up' : 'No sales activity'} title={product.orders > 0 ? 'Sales activity up' : 'No sales activity'}>{product.orders > 0 ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}</span></span>
         <span className="data-value text-right text-xs font-bold" role="cell">{money(product.revenue)}</span>
      </div>)}
    </div> : <div className="mt-5"><ChartEmpty message="Product performance will appear after your first sale." /></div>}
  </section>;
}

type ChannelPerformanceRow = { channel: string; revenue: number; orders: number; paidOrders: number; opens: number; conversionRate: number };

export function getChannelConversionView(channels: ChannelPerformanceRow[], selectedChannel = 'all') {
  const rankedChannels = [...channels].sort((left, right) => right.opens - left.opens);
  const visibleChannels = selectedChannel === 'all'
    ? rankedChannels
    : rankedChannels.filter((channel) => channel.channel === selectedChannel);
  const totalViews = visibleChannels.reduce((sum, channel) => sum + channel.opens, 0);
  const totalSales = visibleChannels.reduce((sum, channel) => sum + channel.paidOrders, 0);
  const totalRevenue = visibleChannels.reduce((sum, channel) => sum + channel.revenue, 0);
  return {
    rankedChannels,
    visibleChannels,
    totalViews,
    totalSales,
    totalRevenue,
    totalConversion: totalViews ? (totalSales / totalViews) * 100 : 0,
  };
}

function ChannelPerformance({ channels, loading = false }: { channels: ChannelPerformanceRow[]; loading?: boolean }) {
  return <section className="overview-stat-section overview-channel-card channel-conversion-card" aria-labelledby="channel-performance-title">
    <div className="channel-conversion-toolbar">
      <span className="font-mono-ui text-[10px] uppercase tracking-[.15em] text-[hsl(var(--muted-foreground))]">Channel insight</span>
      <Link href="/reports/channel-conversion" className="channel-conversion-details-link soft-focus" data-testid="link-channel-conversion-details">View details <ArrowUpRight size={15} aria-hidden="true" /></Link>
    </div>
    <div className="channel-conversion-title">
      <div>
        <h2 id="channel-performance-title">Channel conversion</h2>
        <p>Views turned into paid sales</p>
      </div>
      <span className="font-mono-ui">BY CHANNEL</span>
    </div>
    {loading ? <div className="space-y-4 p-5"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div> : channels.length ? <div className="channel-conversion-list">
      {channels.slice(0, 4).map((channel) => <article key={channel.channel} className="channel-conversion-row" data-testid={`row-channel-${channel.channel}`} aria-label={`${channelName(channel.channel)}: ${number(channel.opens)} views, ${number(channel.paidOrders)} sales, ${channel.conversionRate.toFixed(1)}% conversion`}>
        <div className="channel-conversion-row-top">
          <div className="channel-conversion-identity">
            <span className="channel-conversion-mark"><ChannelMark value={channel.channel} size={18} /></span>
            <ChannelLabel value={channel.channel} className="channel-conversion-name" />
          </div>
           <div className="channel-conversion-stat"><span>Views</span><strong className="data-value">{number(channel.opens)}</strong></div>
           <div className="channel-conversion-stat"><span>Sales</span><strong className="data-value">{number(channel.paidOrders)}</strong></div>
           <div className="channel-conversion-stat"><span>Revenue</span><strong className="data-value">{money(channel.revenue)}</strong></div>
          <div className="channel-conversion-rate">
            <span>Conversion</span>
             <strong className="data-value">{channel.conversionRate.toFixed(1)}%</strong>
          </div>
        </div>
      </article>)}
    </div> : <div className="channel-conversion-empty"><ChartEmpty message="Channel conversion will appear after you share a link." /></div>}
  </section>;
}

export function ChannelConversionInsight() {
  const summaryQuery = useGetDashboardSummary(undefined, {
    query: {
      queryKey: getGetDashboardSummaryQueryKey(),
      refetchInterval: CHANNEL_CONVERSION_REFRESH_INTERVAL_MS,
      refetchIntervalInBackground: true,
      refetchOnMount: 'always',
      refetchOnReconnect: true,
      refetchOnWindowFocus: true,
    },
  });
  const channels = summaryQuery.data?.channelPerformance ?? [];
  const [selectedChannel, setSelectedChannel] = useState('all');
  const { rankedChannels, visibleChannels, totalViews, totalSales, totalRevenue, totalConversion } = getChannelConversionView(channels, selectedChannel);
  const selectedChannelLabel = selectedChannel === 'all' ? 'all channels' : channelName(selectedChannel);

  return <Shell>
    <PageHeading title="Channel conversion" action={<Link href="/"><Button variant="outline"><ArrowLeft size={15} />Back to dashboard</Button></Link>} />
    {summaryQuery.isLoading ? <div className="space-y-5" aria-label="Loading channel conversion"><div className="reports-metric-grid">{[1, 2, 3, 4].map((item) => <Card key={item} className="h-[132px] p-5"><Skeleton className="h-3 w-24" /><Skeleton className="mt-6 h-8 w-28" /><Skeleton className="mt-3 h-3 w-36" /></Card>)}</div><Card className="space-y-4 p-6"><Skeleton className="h-5 w-44" /><Skeleton className="h-14 w-full" /><Skeleton className="h-14 w-full" /><Skeleton className="h-14 w-full" /></Card></div> : summaryQuery.isError ? <ErrorState retry={() => summaryQuery.refetch()} /> : <div className="channel-insight-page space-y-5">
      <section className="reports-metric-grid" aria-label="Channel conversion summary">
        <MetricCard dataTestId="card-channel-insight-views" label="Total views" value={number(totalViews)} note="Recorded link views" />
        <MetricCard dataTestId="card-channel-insight-sales" label="Paid sales" value={number(totalSales)} indicator={{ direction: totalSales > 0 ? 'up' : 'down', percentage: totalViews ? (totalSales / totalViews) * 100 : 0 }} note="Completed sales from channels" />
        <MetricCard dataTestId="card-channel-insight-revenue" label="Revenue" value={money(totalRevenue)} note="Recorded channel revenue" />
        <MetricCard dataTestId="card-channel-insight-conversion" label="Overall conversion" value={`${totalConversion.toFixed(1)}%`} indicator={{ direction: totalConversion > 0 ? 'up' : 'down', percentage: totalConversion }} note="Paid sales divided by views" />
      </section>
      <Card className="channel-insight-card" data-testid="card-channel-conversion-detail">
        <div className="channel-insight-heading">
          <div><div className="font-mono-ui text-[10px] uppercase tracking-[.15em] text-[hsl(var(--muted-foreground))]">Channel breakdown</div><h2 className="mt-2 font-display text-xl font-bold tracking-[-.035em]">Where views become sales</h2><p>Compare attention, paid sales, and revenue for {selectedChannelLabel}.</p></div>
          <div className="channel-insight-heading-tools">
            <div className="channel-insight-filter">
              <label htmlFor="channel-conversion-filter">Focus channel</label>
              <select id="channel-conversion-filter" data-testid="select-channel-conversion" value={selectedChannel} onChange={(event) => setSelectedChannel(event.target.value)} className="field-input">
                <option value="all">All channels</option>
                {rankedChannels.map((channel) => <option key={channel.channel} value={channel.channel}>{channelName(channel.channel)}</option>)}
              </select>
            </div>
            <BarChart3 size={20} className="channel-insight-heading-icon text-[hsl(var(--muted-foreground))]" aria-hidden="true" />
          </div>
        </div>
        {visibleChannels.length ? <div className="channel-insight-list">
          <div className="channel-insight-list-head" aria-hidden="true"><span>Channel</span><span>Views</span><span>Sales</span><span>Revenue</span><span>Conversion</span></div>
          {visibleChannels.map((channel) => <article key={channel.channel} className="channel-insight-row" data-testid={`row-channel-insight-${channel.channel}`} aria-label={`${channelName(channel.channel)}: ${number(channel.opens)} views, ${number(channel.paidOrders)} sales, ${money(channel.revenue)}, ${channel.conversionRate.toFixed(1)}% conversion`}>
            <div className="channel-insight-identity"><span className="channel-conversion-mark"><ChannelMark value={channel.channel} size={19} /></span><ChannelLabel value={channel.channel} className="channel-conversion-name" /></div>
             <strong className="channel-insight-number data-value" data-label="Views">{number(channel.opens)}</strong>
             <strong className="channel-insight-number data-value" data-label="Sales">{number(channel.paidOrders)}</strong>
             <strong className="channel-insight-number data-value" data-label="Revenue">{money(channel.revenue)}</strong>
             <div className="channel-insight-conversion"><strong className="data-value" data-label="Conversion">{channel.conversionRate.toFixed(1)}%</strong><span className="channel-insight-progress"><span style={{ width: `${Math.min(100, Math.max(0, channel.conversionRate))}%` }} /></span></div>
          </article>)}
        </div> : <div className="p-6"><EmptyState icon={BarChart3} title="No channel activity yet" description="Share a buyer link to start building channel conversion insight." /></div>}
      </Card>
      <div className="flex items-start gap-3 rounded-[12px] border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/55 px-4 py-3 text-[11px] leading-5 text-[hsl(var(--muted-foreground))]"><CircleDollarSign size={15} className="mt-0.5 shrink-0 text-[hsl(var(--accent-foreground))]" aria-hidden="true" /><span><strong className="text-[hsl(var(--foreground))]">How to read this:</strong> Conversion is paid sales divided by recorded views. Channels are ranked by views so you can see where attention is concentrated before comparing sales and revenue.</span></div>
    </div>}
  </Shell>;
}

function RecentTransactions() {
  const query = useListOrders();
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const allOrders = query.data ?? [];
  const orders = useMemo(() => allOrders.filter((order) => {
    const matchesFilter = filter === 'all' || (filter === 'paid' ? order.status === 'paid' : order.status !== 'paid');
    return matchesFilter && `${order.customerName} ${order.productName} ${order.channel}`.toLowerCase().includes(search.trim().toLowerCase());
  }).slice(0, 6), [allOrders, filter, search]);
  const filterOptions = [{ value: 'all', label: 'All' }, { value: 'paid', label: 'Paid' }, { value: 'open', label: 'Open' }];
  return <Card className="list-card mt-5 overflow-hidden">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[hsl(var(--border))] px-5 py-5 sm:px-6"><div><div className="font-mono-ui text-[10px] uppercase tracking-[.15em] text-[hsl(var(--muted-foreground))]">Latest activity</div><h2 className="mt-2 font-display text-xl font-bold tracking-[-.035em]">Recent transactions</h2></div><Link href="/orders" data-testid="link-see-all-orders"><Button variant="ghost">See all <ArrowUpRight size={15} /></Button></Link></div>
    <div className="list-toolbar"><div className="list-filter-tabs" role="group" aria-label="Recent transaction filters">{filterOptions.map((option) => <button type="button" key={option.value} onClick={() => setFilter(option.value)} aria-pressed={filter === option.value} className={cn('list-filter-tab', filter === option.value && 'is-active')}>{option.label}</button>)}</div><div className="list-search-shell"><Search className="pointer-events-none absolute left-2.5 top-2.5 text-[hsl(var(--muted-foreground))]" size={14} /><input aria-label="Search recent transactions" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search" className="list-search-input" /></div></div>
     {query.isLoading ? <div className="space-y-4 p-6"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div> : query.isError ? <div className="p-6"><ErrorState retry={() => query.refetch()} /></div> : orders.length ? <div className="overflow-x-auto"><table className="list-table w-full min-w-[780px] text-left"><thead><tr><th className="px-5 py-3 sm:px-6">Order ID</th><th className="px-4 py-3">Buyer / item</th><th className="px-4 py-3 text-center">Traffic</th><th className="px-4 py-3">Placed</th><th className="px-4 py-3">Order value</th><th className="px-5 py-3 sm:px-6">Payment</th></tr></thead><tbody>{orders.map((order) => <tr key={order.id} className="transaction-row" data-testid={`row-transaction-${order.id}`}><td className="px-5 py-4 sm:px-6" data-testid={`text-transaction-order-id-${order.id}`}><span className="orders-order-id">#{String(order.id).padStart(7, '0')}</span></td><td className="px-4 py-4"><div className="flex items-center gap-3"><div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[hsl(var(--muted))] font-mono-ui text-[10px] font-bold">{initials(order.customerName || order.productName)}</div><div><div className="text-sm font-semibold">{order.customerName || 'Buyer pending'}</div><div className="mt-0.5 text-[11px] text-[hsl(var(--muted-foreground))]">{order.productName}</div></div></div></td><td className="px-4 py-4"><div className="orders-traffic-cell"><span className="orders-traffic-icon" data-testid={`text-transaction-traffic-${order.id}`} title={channelName(order.channel)} aria-label={`Traffic source: ${channelName(order.channel)}`}><ChannelMark value={order.channel} size={17} /></span></div></td><td className="px-4 py-4 text-sm text-[hsl(var(--muted-foreground))]">{dateShort(order.createdAt)}</td><td className="data-value px-4 py-4 text-xs">{moneyExact(order.amount)}</td><td className="px-5 py-4 sm:px-6"><StatusPill tone={paymentTone(order.status)}>{paymentLabel(order)}</StatusPill></td></tr>)}</tbody></table></div> : <div className="p-8"><EmptyState icon={ShoppingBag} title="No transactions match" description="Try another filter or search." action={<Link href="/take-order"><Button><Plus size={15} />Create a link</Button></Link>} /></div>}
  </Card>;
}

function OrderRow({ order, compact = false }: { order: Order; compact?: boolean }) {
  return <div className={cn('flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between', compact && 'py-3.5')} data-testid={`row-order-${order.id}`}><div className="flex items-center gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-[hsl(var(--muted))] font-mono-ui text-[10px] font-bold">{initials(order.customerName || order.productName)}</div><div><div className="text-sm font-semibold">{order.customerName || 'Buyer pending'}</div><div className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">{order.productName} · <ChannelInline value={order.channel} /></div></div></div><div className="flex items-center gap-4 pl-12 sm:pl-0"><div className="text-right"><div className="font-mono-ui text-xs font-bold">{moneyExact(order.amount)}</div><div className="mt-1 text-[10px] text-[hsl(var(--muted-foreground))]">{dateShort(order.createdAt)}</div></div><StatusPill tone={paymentTone(order.status)}>{order.status.replace('_', ' ')}</StatusPill></div></div>;
}

type ProductFormState = { name: string; category: string; price: string; cost: string; stock: string; variants: string; accent: string };
const blankProduct: ProductFormState = { name: '', category: 'Apparel', price: '', cost: '', stock: '0', variants: '', accent: '#E6B85C' };
const accentOptions = [
  { value: '#E6B85C', label: 'gold' },
  { value: '#8BBDA9', label: 'green' },
  { value: '#D79AA9', label: 'rose' },
  { value: '#96A8CE', label: 'blue' },
  { value: '#D99566', label: 'orange' },
] as const;

export function ProductModal({ product, onClose }: { product?: Product; onClose: () => void }) {
  const queryClient = useQueryClient();
  const create = useCreateProduct(); const update = useUpdateProduct();
  const [form, setForm] = useState<ProductFormState>(product ? { name: product.name, category: product.category, price: String(product.price), cost: product.cost == null ? '' : String(product.cost), stock: String(product.stock), variants: product.variants.join(', '), accent: product.accent } : blankProduct);
  const pending = create.isPending || update.isPending;
  const change = (key: keyof ProductFormState, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const save = (event: React.FormEvent) => { event.preventDefault(); const data: ProductInput = { name: form.name.trim(), category: form.category, price: Number(form.price), cost: form.cost === '' ? null : Number(form.cost), stock: Number(form.stock), variants: form.variants.split(',').map((item) => item.trim()).filter(Boolean), accent: form.accent }; if (!data.name || Number.isNaN(data.price)) return; const onSuccess = () => { queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() }); onClose(); }; product ? update.mutate({ id: product.id, data }, { onSuccess }) : create.mutate({ data }, { onSuccess }); };
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-[hsl(220_30%_17%/.45)] p-0 backdrop-blur-sm sm:items-center sm:p-5"><div className="max-h-[92dvh] w-full max-w-[560px] overflow-y-auto rounded-t-[20px] border border-[hsl(var(--card-border))] bg-[hsl(var(--card))] p-6 sm:rounded-[20px] sm:p-8"><div className="flex items-start justify-between"><div><div className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">{product ? 'Edit item' : 'New item'}</div><h2 className="mt-2 font-display text-2xl font-bold tracking-[-.04em]">{product ? 'Update your item.' : 'Add to your catalog.'}</h2></div><button type="button" onClick={onClose} aria-label="Close item editor" data-testid="button-close-product-modal" className="rounded-lg p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]"><X aria-hidden="true" size={18} /></button></div><form onSubmit={save} className="mt-7 space-y-5"><div><label className="field-label">Item name</label><input data-testid="input-product-name" autoFocus required value={form.name} onChange={(e) => change('name', e.target.value)} placeholder="e.g. Linen wrap top" className="field-input" /></div><div className="grid gap-5 sm:grid-cols-2"><div><label className="field-label">Category</label><select data-testid="select-product-category" value={form.category} onChange={(e) => change('category', e.target.value)} className="field-input"><option>Apparel</option><option>Accessories</option><option>Home</option><option>Beauty</option><option>Food & drink</option><option>Other</option></select></div><div><label className="field-label">Stock on hand</label><input data-testid="input-product-stock" type="number" min="0" required value={form.stock} onChange={(e) => change('stock', e.target.value)} className="field-input" /></div></div><div className="grid gap-5 sm:grid-cols-2"><div><label className="field-label">Selling price</label><div className="relative"><span className="absolute left-3 top-2.5 text-sm text-[hsl(var(--muted-foreground))]">$</span><input data-testid="input-product-price" type="number" min="0" step=".01" required value={form.price} onChange={(e) => change('price', e.target.value)} className="field-input pl-7" /></div></div><div><label className="field-label">Cost <span className="font-normal text-[hsl(var(--muted-foreground))]">(optional)</span></label><div className="relative"><span className="absolute left-3 top-2.5 text-sm text-[hsl(var(--muted-foreground))]">$</span><input data-testid="input-product-cost" type="number" min="0" step=".01" value={form.cost} onChange={(e) => change('cost', e.target.value)} placeholder="Not tracked" className="field-input pl-7" /></div></div></div><div><label className="field-label">Variants <span className="font-normal text-[hsl(var(--muted-foreground))]">(comma separated)</span></label><input data-testid="input-product-variants" value={form.variants} onChange={(e) => change('variants', e.target.value)} placeholder="Small, Medium, Large" className="field-input" /></div><div><label className="field-label">Accent color</label><div className="flex gap-2">{accentOptions.map(({ value, label }) => <button type="button" key={value} onClick={() => change('accent', value)} aria-label={`Use ${label} accent color`} aria-pressed={form.accent === value} data-testid={`button-accent-${value.slice(1)}`} className={cn('h-8 w-8 rounded-full border-2 transition-transform', form.accent === value ? 'scale-110 border-[hsl(var(--foreground))]' : 'border-transparent')} style={{ backgroundColor: value }} />)}</div></div><div className="flex justify-end gap-3 border-t border-[hsl(var(--border))] pt-5"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" disabled={pending}>{pending && <Loader2 size={15} className="animate-spin" />}{product ? 'Save changes' : 'Add item'}</Button></div></form></div></div>;
}

type ExpenseFormState = { title: string; category: ExpenseInput['category']; amount: string; date: string; note: string };
const expenseCategories: Array<{ value: ExpenseInput['category']; label: string }> = [
  { value: 'rent', label: 'Rent' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'advertising', label: 'Advertising' },
  { value: 'supplies', label: 'Supplies' },
  { value: 'fees', label: 'Fees' },
  { value: 'other', label: 'Other' },
];
const todayForInput = () => new Date().toISOString().slice(0, 10);
const blankExpense: ExpenseFormState = { title: '', category: 'other', amount: '', date: todayForInput(), note: '' };
const expenseCategoryLabel = (value: Expense['category']) => expenseCategories.find((item) => item.value === value)?.label ?? 'Other';

export function ExpenseModal({ expense, onClose }: { expense?: Expense; onClose: () => void }) {
  const queryClient = useQueryClient();
  const create = useCreateExpense();
  const update = useUpdateExpense();
  const [form, setForm] = useState<ExpenseFormState>(expense
    ? { title: expense.title, category: expense.category, amount: String(expense.amount), date: expense.date.slice(0, 10), note: expense.note ?? '' }
    : blankExpense);
  const [error, setError] = useState('');
  const pending = create.isPending || update.isPending;
  const change = (key: keyof ExpenseFormState, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const save = (event: React.FormEvent) => {
    event.preventDefault();
    const amount = Number(form.amount);
    if (!form.title.trim() || !form.date || !Number.isFinite(amount) || amount < 0) {
      setError('Add a title, date, and a valid non-negative amount.');
      return;
    }
    const note = form.note.trim();
    const data: ExpenseInput = { title: form.title.trim(), category: form.category, amount, date: form.date, ...(note ? { note } : {}) };
    const onSuccess = () => {
      queryClient.invalidateQueries({ queryKey: getListExpensesQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
      onClose();
    };
    if (expense) update.mutate({ id: expense.id, data: { ...data, note: note || null } as ExpenseUpdate }, { onSuccess });
    else create.mutate({ data }, { onSuccess });
  };
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-[hsl(220_30%_17%/.45)] p-0 backdrop-blur-sm sm:items-center sm:p-5">
    <div className="max-h-[92dvh] w-full max-w-[560px] overflow-y-auto rounded-t-[20px] border border-[hsl(var(--card-border))] bg-[hsl(var(--card))] p-6 sm:rounded-[20px] sm:p-8">
      <div className="flex items-start justify-between"><div><div className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">{expense ? 'Edit expense' : 'New expense'}</div><h2 className="mt-2 font-display text-2xl font-bold tracking-[-.04em]">{expense ? 'Keep the record accurate.' : 'Record a shop expense.'}</h2><p className="mt-2 text-xs leading-5 text-[hsl(var(--muted-foreground))]">Operating expenses stay separate from product costs in your dashboard.</p></div><button type="button" onClick={onClose} aria-label="Close expense editor" data-testid="button-close-expense-modal" className="rounded-lg p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]"><X aria-hidden="true" size={18} /></button></div>
      <form onSubmit={save} className="mt-7 space-y-5">
        <div><label className="field-label" htmlFor="expense-title">What was it for?</label><input id="expense-title" data-testid="input-expense-title" autoFocus required value={form.title} onChange={(event) => change('title', event.target.value)} placeholder="e.g. Monthly studio rent" className="field-input" /></div>
        <div className="grid gap-5 sm:grid-cols-2"><div><label className="field-label" htmlFor="expense-category">Category</label><select id="expense-category" data-testid="select-expense-category" value={form.category} onChange={(event) => change('category', event.target.value)} className="field-input">{expenseCategories.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div><div><label className="field-label" htmlFor="expense-amount">Amount</label><div className="relative"><span className="absolute left-3 top-2.5 text-sm text-[hsl(var(--muted-foreground))]">$</span><input id="expense-amount" data-testid="input-expense-amount" required type="number" min="0" step=".01" value={form.amount} onChange={(event) => change('amount', event.target.value)} placeholder="0.00" className="field-input pl-7" /></div></div></div>
        <div><label className="field-label" htmlFor="expense-date">Date paid</label><input id="expense-date" data-testid="input-expense-date" required type="date" value={form.date} onChange={(event) => change('date', event.target.value)} className="field-input" /></div>
        <div><label className="field-label" htmlFor="expense-note">Note <span className="font-normal text-[hsl(var(--muted-foreground))]">(optional)</span></label><textarea id="expense-note" data-testid="input-expense-note" rows={3} value={form.note} onChange={(event) => change('note', event.target.value)} placeholder="Add context for your future self" className="field-input resize-none leading-5" /></div>
        {(error || create.isError || update.isError) && <div className="rounded-[10px] border border-[hsl(var(--destructive))]/20 bg-[hsl(var(--destructive))]/5 px-3 py-2 text-xs text-[hsl(var(--destructive))]" data-testid="status-expense-form-error">{error || 'This expense could not be saved. Try again.'}</div>}
        <div className="flex justify-end gap-3 border-t border-[hsl(var(--border))] pt-5"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" disabled={pending} data-testid="button-save-expense">{pending && <Loader2 size={15} className="animate-spin" />}{expense ? 'Save changes' : 'Save expense'}</Button></div>
      </form>
    </div>
  </div>;
}

function Expenses() {
  const query = useListExpenses();
  const deleteExpense = useDeleteExpense();
  const queryClient = useQueryClient();
  const [modal, setModal] = useState<'new' | Expense | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const expenses = useMemo(() => (query.data ?? []).filter((expense) => {
    const matchesCategory = categoryFilter === 'all' || expense.category === categoryFilter;
    return matchesCategory && `${expense.title} ${expense.note ?? ''} ${expense.category}`.toLowerCase().includes(search.trim().toLowerCase());
  }), [query.data, search, categoryFilter]);
  const total = (query.data ?? []).reduce((sum, expense) => sum + expense.amount, 0);
  const visibleTotal = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const remove = (expense: Expense) => {
    if (window.confirm(`Delete ${expense.title}?`)) {
      deleteExpense.mutate({ id: expense.id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListExpensesQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        },
      });
    }
  };
  return <Shell><PageHeading title="Expenses" action={<Button onClick={() => setModal('new')} data-testid="button-new-expense"><Plus size={16} />Add expense</Button>} />
    <div className="expenses-summary mb-5 grid gap-4 md:grid-cols-3"><MetricCard dataTestId="card-expenses-total" label="All operating expenses" value={moneyExact(total)} note={`${query.data?.length ?? 0} recorded expenses`} /><MetricCard dataTestId="card-expenses-visible" label="Showing now" value={moneyExact(visibleTotal)} indicator={total ? { direction: expenses.length > 0 ? 'up' : 'down', percentage: (visibleTotal / total) * 100 } : undefined} note={`${expenses.length} matching entries`} /><InsightCard dataTestId="card-expenses-profit-note" icon={CircleDollarSign} title="A clearer profit view" description="Operating expenses flow into combined expenses, not gross margin." /></div>
    <Card className="overflow-hidden"><div className="flex flex-col gap-3 border-b border-[hsl(var(--border))] p-5 sm:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-2.5 text-[hsl(var(--muted-foreground))]" size={16} /><input data-testid="input-search-expenses" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search expenses" className="field-input pl-9" /></div><select data-testid="select-filter-expenses" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="field-input sm:max-w-[220px]"><option value="all">All categories</option>{expenseCategories.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
      {query.isLoading ? <div className="space-y-4 p-6"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div> : query.isError ? <div className="p-6"><ErrorState retry={() => query.refetch()} /></div> : expenses.length ? <div className="divide-y divide-[hsl(var(--border))]">{expenses.map((expense) => <div key={expense.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6" data-testid={`row-expense-${expense.id}`}><div className="min-w-0"><div className="flex items-center gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"><Receipt size={16} /></div><div className="min-w-0"><div className="truncate text-sm font-semibold">{expense.title}</div><div className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">{expenseCategoryLabel(expense.category)} · {dateShort(expense.date)}{expense.note ? ` · ${expense.note}` : ''}</div></div></div></div><div className="flex items-center justify-between gap-4 sm:justify-end"><div className="font-mono-ui text-sm font-bold">{moneyExact(expense.amount)}</div><ExpenseActions expenseId={expense.id} expenseTitle={expense.title} onEdit={() => setModal(expense)} onDelete={() => remove(expense)} deleteDisabled={deleteExpense.isPending} /></div></div>)}</div> : <div className="p-6"><EmptyState icon={Receipt} title={search || categoryFilter !== 'all' ? 'No matching expenses' : 'No operating expenses yet'} description={search || categoryFilter !== 'all' ? 'Try another search or category.' : 'Record rent, delivery, supplies, and other costs that keep your shop moving.'} action={<Button onClick={() => setModal('new')}><Plus size={15} />Add your first expense</Button>} /></div>}
    </Card>
    {modal && <ExpenseModal expense={modal === 'new' ? undefined : modal} onClose={() => setModal(null)} />}
  </Shell>;
}

function Catalog() {
  const query = useListProducts(); const deleteProduct = useDeleteProduct(); const queryClient = useQueryClient();
  const [modal, setModal] = useState<'new' | Product | null>(null); const [search, setSearch] = useState('');
  const products = useMemo(() => (query.data ?? []).filter((product) => `${product.name} ${product.category}`.toLowerCase().includes(search.toLowerCase())), [query.data, search]);
  const remove = (product: Product) => { if (window.confirm(`Delete ${product.name} from your catalog?`)) deleteProduct.mutate({ id: product.id }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() }) }); };
  const inventoryValue = (query.data ?? []).reduce((sum, product) => sum + (product.price * product.stock), 0);
  const lowStock = (query.data ?? []).filter((product) => product.stock < 5).length;
  const categories = new Set((query.data ?? []).map((product) => product.category)).size;
  return <Shell>
     <PageHeading title="Catalog" action={<Button onClick={() => setModal('new')} data-testid="button-new-product"><Plus size={16} />Add item</Button>} />
    <section className="catalog-summary" aria-label="Catalog summary">
       <MetricCard className="rise-in" dataTestId="card-catalog-inventory-value" label="Inventory value" value={money(inventoryValue)} note={`${query.data?.length ?? 0} catalog items priced`} />
        <MetricCard className="rise-in" style={{ animationDelay: '55ms' }} dataTestId="card-catalog-items" label="Items" value={query.data?.length ?? 0} note={`${categories} ${categories === 1 ? 'category' : 'categories'} in the catalog`} />
       <MetricCard className="rise-in" style={{ animationDelay: '110ms' }} dataTestId="card-catalog-low-stock" label="Low stock" value={<span className={cn(lowStock > 0 && 'text-[hsl(var(--destructive))]')}>{lowStock}</span>} indicator={(query.data?.length ?? 0) > 0 ? { direction: lowStock > 0 ? 'down' : 'up', percentage: (lowStock / query.data!.length) * 100 } : undefined} note={lowStock ? `${lowStock} ${lowStock === 1 ? 'item needs' : 'items need'} a restock` : 'All levels look good'} />
       <MetricCard className="rise-in" style={{ animationDelay: '165ms' }} dataTestId="card-catalog-categories" label="Categories" value={categories} note={`${query.data?.length ?? 0} items grouped for buyers`} />
    </section>
    <Card className="catalog-workspace list-card mt-5 overflow-hidden">
      <div className="catalog-toolbar">
         <div><h2 className="font-display text-xl font-bold tracking-[-.04em]">Everything you sell</h2></div>
        <div className="catalog-toolbar-tools">
          <div className="relative min-w-0 flex-1 sm:max-w-[300px]"><Search className="pointer-events-none absolute left-3 top-2.5 text-[hsl(var(--muted-foreground))]" size={16} /><input data-testid="input-search-products" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or category" className="field-input pl-9" /></div>
          <span className="catalog-result-count"><strong>{products.length}</strong> {products.length === 1 ? 'item' : 'items'}</span>
        </div>
      </div>
      {query.isLoading ? <div className="catalog-loading">{[1, 2, 3].map((i) => <div key={i} className="catalog-loading-row"><Skeleton className="h-11 w-11 rounded-[13px]" /><div className="flex-1"><Skeleton className="h-4 w-40" /><Skeleton className="mt-2 h-3 w-24" /></div><Skeleton className="h-8 w-20" /></div>)}</div> : query.isError ? <div className="p-6"><ErrorState retry={() => query.refetch()} /></div> : products.length ? <div className="catalog-list" role="list">
        <div className="catalog-list-head" aria-hidden="true"><span>Product</span><span>Variants</span><span>Price</span><span>Stock</span><span /></div>
        {products.map((product, index) => <div key={product.id} className="catalog-product-row rise-in" style={{ animationDelay: `${index * 50}ms` }} data-testid={`card-product-${product.id}`} role="listitem">
           <div className="catalog-product-main"><div className="catalog-product-mark" style={{ backgroundColor: `${product.accent}42` }}>{initials(product.name)}</div><div className="min-w-0"><h3 className="truncate font-display text-base font-bold tracking-[-.025em]">{product.name}</h3><div className="mt-1 flex items-center gap-2 text-[11px] text-[hsl(var(--muted-foreground))]"><span className="catalog-category">{product.category}</span>{product.cost != null && <span>· {money(product.price - product.cost)} margin</span>}</div></div></div>
          <div className="catalog-variants">{product.variants.length ? product.variants.join(' · ') : 'One size'}</div>
          <div className="catalog-number"><span className="catalog-mobile-label">Price</span><strong className="font-mono-ui">{moneyExact(product.price)}</strong></div>
          <div className="catalog-stock"><span className="catalog-mobile-label">Stock</span><strong className={cn('font-mono-ui', product.stock < 5 && 'is-alert')}>{product.stock}</strong><span className={cn('catalog-stock-status', product.stock < 5 ? 'is-alert' : 'is-good')}>{product.stock < 5 ? 'Running low' : 'In stock'}</span></div>
           <CatalogActions productId={product.id} productName={product.name} onEdit={() => setModal(product)} onDelete={() => remove(product)} deleteDisabled={deleteProduct.isPending} />
        </div>)}
      </div> : <div className="p-6"><EmptyState icon={Package} title={search ? 'No matching items' : 'Your catalog is waiting'} description={search ? 'Try a different name or category.' : 'Add your first item to start sending buyers a link.'} action={!search && <Button onClick={() => setModal('new')}><Plus size={15} />Add your first item</Button>} /></div>}
    </Card>
    {modal && <ProductModal product={modal === 'new' ? undefined : modal} onClose={() => setModal(null)} />}
  </Shell>;
}

function LegacyOrders() {
  const query = useListOrders(); const update = useUpdateOrder(); const [filter, setFilter] = useState('all'); const [search, setSearch] = useState(''); const queryClient = useQueryClient();
  const orders = useMemo(() => (query.data ?? []).filter((order) => (filter === 'all' || order.status === filter || order.fulfillment === filter) && `${order.customerName} ${order.productName} ${order.token}`.toLowerCase().includes(search.toLowerCase())), [query.data, filter, search]);
  const updateOrder = (order: Order, data: { status?: 'reserved' | 'deposit_paid' | 'paid'; fulfillment?: 'pending' | 'shipped' | 'delivered' }) => update.mutate({ id: order.id, data }, { onSuccess: () => { void queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() }); invalidateDashboardSummary(queryClient); } });
  const copyLink = async (token: string) => { await navigator.clipboard?.writeText(`${window.location.origin}/o/${token}`); };
  return <Shell><PageHeading title="Orders" action={<Link href="/take-order"><Button><Plus size={16} />Take an order</Button></Link>} /><div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div className="relative max-w-[360px] flex-1"><Search className="absolute left-3 top-2.5 text-[hsl(var(--muted-foreground))]" size={16} /><input data-testid="input-search-orders" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search orders" className="field-input pl-9" /></div><div className="flex flex-wrap gap-2">{['all', 'reserved', 'deposit_paid', 'paid', 'shipped'].map((value) => <button key={value} onClick={() => setFilter(value)} aria-pressed={filter === value} data-testid={`button-filter-${value}`} className={cn('soft-focus rounded-full px-3 py-2 text-[10px] font-bold capitalize transition-colors', filter === value ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] ring-2 ring-[hsl(var(--primary))] ring-offset-2 ring-offset-[hsl(var(--background))]' : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]')}>{value.replace('_', ' ')}</button>)}</div></div>{query.isLoading ? <Card className="space-y-5 p-6"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></Card> : query.isError ? <ErrorState retry={() => query.refetch()} /> : orders.length ? <Card className="overflow-hidden"><div className="hidden grid-cols-[1.45fr_.85fr_.7fr_.7fr_auto] gap-4 border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))]/50 px-6 py-3 text-[10px] font-bold uppercase tracking-[.13em] text-[hsl(var(--muted-foreground))] md:grid"><span>Buyer</span><span>Payment</span><span>Fulfillment</span><span>Placed</span><span /></div>{orders.map((order) => <div key={order.id} className="grid gap-3 border-b border-[hsl(var(--border))] px-5 py-4 last:border-0 md:grid-cols-[1.45fr_.85fr_.7fr_.7fr_auto] md:items-center md:gap-4 md:px-6" data-testid={`row-orders-order-${order.id}`}><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[hsl(var(--muted))] font-mono-ui text-[10px] font-bold">{initials(order.customerName || order.productName)}</div><div><div className="text-sm font-semibold">{order.customerName || 'Buyer pending'}</div><div className="mt-0.5 text-[11px] text-[hsl(var(--muted-foreground))]">{order.productName} · {channelName(order.channel)}</div></div></div><div className="flex items-center justify-between md:block"><span className="text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))] md:hidden">Payment</span><button data-testid={`button-payment-${order.id}`} onClick={() => updateOrder(order, { status: order.status === 'reserved' ? 'deposit_paid' : order.status === 'deposit_paid' ? 'paid' : 'reserved' })}><StatusPill tone={paymentTone(order.status)}>{order.status.replace('_', ' ')}</StatusPill></button></div><div className="flex items-center justify-between md:block"><span className="text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))] md:hidden">Delivery</span><button data-testid={`button-fulfillment-${order.id}`} onClick={() => updateOrder(order, { fulfillment: order.fulfillment === 'pending' ? 'shipped' : order.fulfillment === 'shipped' ? 'delivered' : 'pending' })}><StatusPill tone={fulfillmentTone(order.fulfillment)}>{order.fulfillment}</StatusPill></button></div><div className="hidden font-mono-ui text-[10px] text-[hsl(var(--muted-foreground))] md:block">{dateShort(order.createdAt)}<div className="mt-1 text-[12px] font-bold text-[hsl(var(--foreground))]">{moneyExact(order.amount)}</div></div><div className="flex justify-end gap-1"><button type="button" onClick={() => copyLink(order.token)} aria-label="Copy buyer link" data-testid={`button-copy-link-${order.id}`} className="rounded-lg p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]" title="Copy buyer link"><Copy aria-hidden="true" size={15} /></button><Link href={`/o/${order.token}`} data-testid={`link-open-order-${order.id}`} aria-label="Open buyer preview" className="rounded-lg p-2 text-[11px] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]"><ExternalLink aria-hidden="true" size={15} /></Link></div></div>)}</Card> : <EmptyState icon={ShoppingBag} title={search || filter !== 'all' ? 'No orders match' : 'Your order list is quiet'} description={search || filter !== 'all' ? 'Try another filter or search.' : 'When buyers use your links, their orders will show up here.'} />}</Shell>;
}

function Orders() {
  const [location] = useLocation();
  const query = useListOrders();
  const update = useUpdateOrder();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState(() => new URLSearchParams(window.location.search).get('customer') ?? '');
  useEffect(() => {
    setSearch(new URLSearchParams(window.location.search).get('customer') ?? '');
  }, [location]);
  const allOrders = query.data ?? [];
  const orders = useMemo(() => allOrders.filter((order) => {
    const matchesFilter = filter === 'all' || order.status === filter || order.fulfillment === filter;
    const haystack = `${order.customerName} ${order.productName} ${order.token} ${order.customerPhone ?? ''}`.toLowerCase();
    return matchesFilter && haystack.includes(search.trim().toLowerCase());
  }), [allOrders, filter, search]);
  const collectedFor = (order: Order) => order.status === 'paid' ? order.amount : order.status === 'deposit_paid' ? (order.depositAmount ?? 0) : 0;
  const metrics = useMemo(() => {
    const orderValue = allOrders.reduce((sum, order) => sum + order.amount, 0);
    const collected = allOrders.reduce((sum, order) => sum + collectedFor(order), 0);
    const paidOrders = allOrders.filter((order) => order.status === 'paid').length;
    return { orderValue, collected, outstanding: Math.max(0, orderValue - collected), paidOrders, collectionRate: orderValue ? (collected / orderValue) * 100 : 0, average: allOrders.length ? orderValue / allOrders.length : 0 };
  }, [allOrders]);
  const channelMix = useMemo(() => {
    const counts = allOrders.reduce<Record<string, number>>((result, order) => {
      result[order.channel] = (result[order.channel] ?? 0) + 1;
      return result;
    }, {});
    return Object.entries(counts).sort(([, left], [, right]) => right - left);
  }, [allOrders]);
  const maxChannelOrders = Math.max(1, ...channelMix.map(([, count]) => count));
  const updateOrder = (order: Order, data: { status?: 'reserved' | 'deposit_paid' | 'paid'; fulfillment?: 'pending' | 'shipped' | 'delivered' }) => {
    update.mutate({ id: order.id, data }, { onSuccess: () => { void queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() }); invalidateDashboardSummary(queryClient); } });
  };
  const filterOptions = [
    { value: 'all', label: 'All orders' },
    { value: 'reserved', label: 'Reserved' },
    { value: 'deposit_paid', label: 'Deposit paid' },
    { value: 'paid', label: 'Paid' },
    { value: 'pending', label: 'To ship' },
    { value: 'shipped', label: 'Shipped' },
    { value: 'delivered', label: 'Delivered' },
  ];
  const fulfillmentLabel = (value: Order['fulfillment']) => value === 'pending' ? 'To ship' : value;
  const pendingFulfillment = allOrders.filter((order) => order.fulfillment === 'pending').length;

  return <Shell>
    <PageHeading title="Orders" action={<Link href="/take-order" data-testid="link-take-order-orders"><Button><Plus size={16} />Take an order</Button></Link>} />
    <section className="orders-snapshot" aria-label="Order performance summary">
       <MetricCard className="rise-in" dataTestId="card-orders-live-value" label="Live order value" value={<span data-testid="text-live-order-value">{money(metrics.orderValue)}</span>} indicator={metrics.orderValue ? { direction: metrics.outstanding > 0 ? 'down' : 'up', percentage: (metrics.collected / metrics.orderValue) * 100 } : undefined} note={`${money(metrics.collected)} collected · ${money(metrics.outstanding)} outstanding`} />
       <MetricCard className="rise-in" style={{ animationDelay: '55ms' }} dataTestId="card-orders-total" label="Total orders" value={<span data-testid="text-total-orders">{allOrders.length}</span>} indicator={allOrders.length ? { direction: metrics.paidOrders > 0 ? 'up' : 'down', percentage: (metrics.paidOrders / allOrders.length) * 100 } : undefined} note={`${metrics.paidOrders} paid in full`} />
       <MetricCard className="rise-in" style={{ animationDelay: '110ms' }} dataTestId="card-orders-average" label="Average order value" value={<span data-testid="text-average-order-value">{money(metrics.average)}</span>} note="Based on live order value" />
       <MetricCard className="rise-in" style={{ animationDelay: '165ms' }} dataTestId="card-orders-collection-rate" label="Collection rate" value={<span data-testid="text-collection-rate">{metrics.collectionRate.toFixed(1)}%</span>} indicator={metrics.orderValue ? { direction: metrics.collectionRate >= 70 ? 'up' : 'down', percentage: metrics.collectionRate } : undefined} note="Paid amount against order value" />
    </section>
    <section className="mt-5 grid gap-5 xl:gap-12 xl:grid-cols-[minmax(0,1.55fr)_minmax(280px,.75fr)]">
      <Card className="overflow-hidden">
        <div className="orders-panel-heading"><div><div className="font-mono-ui text-[10px] uppercase tracking-[.15em] text-[hsl(var(--muted-foreground))]">Revenue sources</div><h2 className="mt-2 font-display text-xl font-bold tracking-[-.04em]">Where orders start</h2><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Share of {allOrders.length} live {allOrders.length === 1 ? 'order' : 'orders'}, by channel.</p></div><div className="orders-channel-total"><span>{channelMix.length}</span><small>channels</small></div></div>
         {query.isLoading ? <div className="space-y-4 p-6"><Skeleton className="h-7 w-full" /><Skeleton className="h-7 w-4/5" /><Skeleton className="h-7 w-3/5" /></div> : channelMix.length ? <div className="space-y-4 px-5 pb-6 sm:px-6">{channelMix.slice(0, 5).map(([channel, count]) => <div key={channel} data-testid={`row-channel-mix-${channel}`}><div className="flex items-center justify-between gap-3 text-xs"><span className="font-semibold">{channelName(channel)}</span><span className="font-mono-ui text-[10px] text-[hsl(var(--muted-foreground))]">{count} {count === 1 ? 'order' : 'orders'}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-[hsl(var(--muted))]"><div className="h-full rounded-full bg-[#268BFF] transition-[width] duration-500" style={{ width: `${(count / maxChannelOrders) * 100}%` }} /></div></div>)}</div> : <div className="p-6"><ChartEmpty message="Channel mix will appear when buyers use a link." /></div>}
      </Card>
      <Card className="orders-signal-card p-5 sm:p-6"><div className="flex items-center gap-2"><Sparkles size={16} className="text-[hsl(var(--chart-1))]" /><div className="font-mono-ui text-[10px] uppercase tracking-[.15em] text-[hsl(var(--muted-foreground))]">Next useful move</div></div><h2 className="mt-3 font-display text-xl font-bold tracking-[-.04em]">{metrics.outstanding > 0 ? 'Follow up on collection.' : pendingFulfillment ? 'Move a delivery forward.' : 'Your desk is caught up.'}</h2><p className="mt-2 text-xs leading-5 text-[hsl(var(--muted-foreground))]">{metrics.outstanding > 0 ? `${money(metrics.outstanding)} is still outstanding across ${allOrders.filter((order) => order.status !== 'paid').length} orders.` : pendingFulfillment ? `${pendingFulfillment} ${pendingFulfillment === 1 ? 'order is' : 'orders are'} ready for a fulfillment update.` : 'Payment and fulfillment have no pending handoffs.'}</p><div className="orders-signal-rule" /><div className="flex items-center justify-between text-[11px]"><span className="text-[hsl(var(--muted-foreground))]">Orders to ship</span><strong data-testid="text-orders-to-ship">{pendingFulfillment}</strong></div><div className="mt-3 flex items-center justify-between text-[11px]"><span className="text-[hsl(var(--muted-foreground))]">Delivered</span><strong data-testid="text-orders-delivered">{allOrders.filter((order) => order.fulfillment === 'delivered').length}</strong></div></Card>
    </section>
    <section className="mt-5">
      <Card className="overflow-hidden">
        <h2 className="orders-list-heading">Orders</h2>
        <div className="orders-controls"><div className="orders-filter-scroll" role="group" aria-label="Order filters">{filterOptions.map((option) => <button type="button" key={option.value} onClick={() => setFilter(option.value)} aria-pressed={filter === option.value} data-testid={`button-filter-${option.value}`} className={cn('orders-filter-button', filter === option.value && 'is-active')}>{option.label}</button>)}</div><div className="list-search-shell"><Search className="pointer-events-none absolute left-2.5 top-2.5 text-[hsl(var(--muted-foreground))]" size={14} /><input aria-label="Search orders" data-testid="input-search-orders" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search orders" className="list-search-input" /></div></div>
        {query.isLoading ? <div className="space-y-4 p-5 sm:p-6" aria-label="Loading orders"><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></div> : query.isError ? <div className="p-5 sm:p-6"><ErrorState retry={() => query.refetch()} /></div> : orders.length ? <div className="orders-table-wrap"><div className="orders-table-head"><span>Order ID</span><span>Buyer / item</span><span>Traffic</span><span>Order value</span><span>Placed</span><span>Payment</span><span>Fulfillment</span></div>{orders.map((order) => <div key={order.id} className="orders-table-row" data-testid={`row-orders-order-${order.id}`}><div className="orders-order-id-cell"><span className="orders-mobile-label">Order ID</span><span className="orders-order-id">#{String(order.id).padStart(7, '0')}</span></div><div className="orders-buyer-cell"><div className="orders-avatar">{initials(order.customerName || order.productName)}</div><div className="min-w-0"><div className="truncate text-sm font-semibold">{order.customerName || 'Buyer pending'}</div><div className="mt-1 truncate text-[11px] text-[hsl(var(--muted-foreground))]">{order.productName}</div></div></div><div className="orders-traffic-cell"><span className="orders-mobile-label">Traffic</span><span className="orders-traffic-icon" data-testid={`text-order-traffic-${order.id}`} title={channelName(order.channel)} aria-label={`Traffic source: ${channelName(order.channel)}`}><ChannelMark value={order.channel} size={17} /></span></div><div className="orders-value-cell"><span className="orders-mobile-label">Order value</span><div className="font-mono-ui text-xs font-bold">{moneyExact(order.amount)}</div><div className="mt-1 text-[10px] text-[hsl(var(--muted-foreground))]">{moneyExact(collectedFor(order))} collected</div></div><div className="orders-date-cell"><span className="orders-mobile-label">Placed</span><span className="font-mono-ui text-[10px] text-[hsl(var(--muted-foreground))]">{dateShort(order.createdAt)}</span></div><div className="orders-cell-labeled"><span className="orders-mobile-label">Payment</span><button type="button" disabled={update.isPending} aria-label={`Advance payment status for ${order.customerName || order.productName}`} title="Advance payment status" data-testid={`button-payment-${order.id}`} onClick={() => { const status: 'reserved' | 'deposit_paid' | 'paid' = order.status === 'reserved' ? 'deposit_paid' : order.status === 'deposit_paid' ? 'paid' : 'reserved'; updateOrder(order, { status }); }}><StatusPill tone={order.status === 'paid' ? 'mint' : order.status === 'deposit_paid' ? 'gold' : 'neutral'}>{paymentLabel(order)}</StatusPill></button></div><div className="orders-cell-labeled"><span className="orders-mobile-label">Fulfillment</span><button type="button" disabled={update.isPending} aria-label={`Advance fulfillment status for ${order.customerName || order.productName}`} title="Advance fulfillment status" data-testid={`button-fulfillment-${order.id}`} onClick={() => { const fulfillment: 'pending' | 'shipped' | 'delivered' = order.fulfillment === 'pending' ? 'shipped' : order.fulfillment === 'shipped' ? 'delivered' : 'pending'; updateOrder(order, { fulfillment }); }}><StatusPill tone={order.fulfillment === 'delivered' ? 'mint' : order.fulfillment === 'shipped' ? 'blue' : 'neutral'}>{fulfillmentLabel(order.fulfillment)}</StatusPill></button></div></div>)}</div> : <div className="p-5 sm:p-6"><EmptyState icon={ShoppingBag} title={search || filter !== 'all' ? 'No orders match' : 'Your order list is quiet'} description={search || filter !== 'all' ? 'Try another filter or search.' : 'When buyers use your links, their orders will show up here.'} action={!search && filter === 'all' ? <Link href="/take-order" data-testid="link-create-first-order"><Button><Plus size={15} />Create a link</Button></Link> : undefined} /></div>}
      </Card>
    </section>
    {orders.some((order) => order.items.length > 1) && <Card className="mt-5 overflow-hidden" data-testid="card-order-item-breakdown"><div className="orders-panel-heading"><div><div className="font-mono-ui text-[10px] uppercase tracking-[.15em] text-[hsl(var(--muted-foreground))]">Line-item view</div><h2 className="mt-2 font-display text-xl font-bold tracking-[-.04em]">What each order contains</h2><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Review every agreed item and price before handing the order off.</p></div><Package size={18} className="text-[hsl(var(--muted-foreground))]" /></div><div className="divide-y divide-[hsl(var(--border))]">{orders.filter((order) => order.items.length > 1).map((order) => <div key={order.id} className="px-5 py-5 sm:px-6" data-testid={`row-order-item-breakdown-${order.id}`}><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="text-sm font-semibold">{order.customerName || 'Buyer pending'}</div><div className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">{order.items.length} items · {channelName(order.channel)} · {dateShort(order.createdAt)}</div></div><div className="text-right"><div className="font-mono-ui text-xs font-bold">{moneyExact(order.amount)}</div><div className="mt-1 text-[10px] text-[hsl(var(--muted-foreground))]">Combined total</div></div></div><div className="mt-4 grid gap-2 sm:grid-cols-2">{order.items.map((item, index) => <div key={`${order.id}-${item.productId}-${index}`} className="flex items-center justify-between gap-3 rounded-[10px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2.5"><span className="min-w-0 truncate text-xs font-semibold">{item.productName}</span><span className="shrink-0 font-mono-ui text-xs">{moneyExact(item.amount)}</span></div>)}</div></div>)}</div></Card>}
   </Shell>;
}

type ClientSummary = {
  key: string;
  displayName: string;
  phone: string;
  orders: Order[];
  orderCount: number;
  collected: number;
  outstanding: number;
  latestPurchase: string;
  latestChannel: string;
};

function Clients() {
  const query = useListOrders();
  const [search, setSearch] = useState('');
  const clients = useMemo<ClientSummary[]>(() => {
    const grouped = new Map<string, ClientSummary>();
    (query.data ?? []).forEach((order) => {
      const phone = order.customerPhone?.trim() ?? '';
      const name = order.customerName?.trim() ?? '';
      const identity = phone || name;
      const key = identity ? `${phone ? 'phone' : 'name'}:${identity.toLowerCase()}` : `pending:${order.id}`;
      const collected = order.status === 'paid' ? order.amount : order.status === 'deposit_paid' ? (order.depositAmount ?? 0) : 0;
      const existing = grouped.get(key);
      if (existing) {
        existing.orders.push(order);
        existing.orderCount += 1;
        existing.collected += collected;
        existing.outstanding += Math.max(0, order.amount - collected);
        if (new Date(order.createdAt).getTime() > new Date(existing.latestPurchase).getTime()) {
          existing.latestPurchase = order.createdAt;
          existing.latestChannel = order.channel;
          if (name) existing.displayName = name;
        }
        if (!existing.phone && phone) existing.phone = phone;
      } else {
        grouped.set(key, {
          key,
          displayName: name || 'Buyer pending',
          phone,
          orders: [order],
          orderCount: 1,
          collected,
          outstanding: Math.max(0, order.amount - collected),
          latestPurchase: order.createdAt,
          latestChannel: order.channel,
        });
      }
    });
    return [...grouped.values()].sort((left, right) => {
      const latestDifference = new Date(right.latestPurchase).getTime() - new Date(left.latestPurchase).getTime();
      return latestDifference || right.collected - left.collected;
    });
  }, [query.data]);
  const filteredClients = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return clients;
    return clients.filter((client) => `${client.displayName} ${client.phone}`.toLowerCase().includes(term));
  }, [clients, search]);
  const totalCollected = clients.reduce((sum, client) => sum + client.collected, 0);
  const repeatClients = clients.filter((client) => client.orderCount > 1).length;

  return <Shell>
    <PageHeading
      title="Clients"
    />
    {query.isLoading ? <ClientsSkeleton /> : query.isError ? <ErrorState retry={() => query.refetch()} /> : !clients.length ? <EmptyState icon={Users} title="Your client list starts with an order" description="When a buyer shares their details, Take Order will keep their purchase history together here." action={<Link href="/take-order" data-testid="link-clients-empty-order"><Button><Plus size={15} />Take an order</Button></Link>} /> : <>
      <section className="clients-overview" aria-label="Client summary">
        <MetricCard className="rise-in" dataTestId="card-clients-return-visits" label="Return visits" value={<span data-testid="text-client-count">{clients.length}</span>} indicator={clients.length ? { direction: repeatClients > 0 ? 'up' : 'down', percentage: (repeatClients / clients.length) * 100 } : undefined} note={repeatClients ? `${repeatClients} ${repeatClients === 1 ? 'client has' : 'clients have'} ordered more than once.` : 'Every new buyer begins a relationship here.'} />
        <MetricCard className="rise-in" style={{ animationDelay: '55ms' }} dataTestId="card-clients-known" label="Known clients" value={<span data-testid="text-total-clients">{clients.length}</span>} note={`${money(totalCollected)} collected across ${clients.reduce((sum, client) => sum + client.orderCount, 0)} orders`} />
         <MetricCard className="rise-in" style={{ animationDelay: '110ms' }} dataTestId="card-clients-average" label="Average collected" value={<span data-testid="text-average-client-spend">{money(clients.length ? totalCollected / clients.length : 0)}</span>} note="Collected value per known client" />
      </section>
      <section className="mt-5">
        <Card className="overflow-hidden">
          <div className="clients-workspace-heading">
            <div><div className="font-mono-ui text-[10px] uppercase tracking-[.15em] text-[hsl(var(--muted-foreground))]">Clients / repeat buyers</div><h2 className="mt-2 font-display text-xl font-bold tracking-[-.04em]">People worth remembering</h2><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Sorted by the latest purchase. Select a client to see their orders.</p></div>
            <div className="clients-result-count" data-testid="text-clients-result-count"><strong>{filteredClients.length}</strong> of {clients.length}</div>
          </div>
           <div className="clients-controls"><div className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-3 top-2.5 text-[hsl(var(--muted-foreground))]" size={16} /><input aria-label="Search clients" data-testid="input-search-clients" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by client name or phone" className="field-input pl-9" /></div></div>
          {filteredClients.length ? <div className="clients-table-wrap"><div className="clients-table-head"><span>Client</span><span>Total orders</span><span>Collected</span><span>Last purchase</span><span>Latest detail</span><span className="sr-only">Details</span></div>{filteredClients.map((client) => <div className="clients-table-row" key={client.key} data-testid={`row-client-${client.key.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`}><div className="clients-buyer-cell"><div className="clients-avatar">{initials(client.displayName)}</div><div className="min-w-0"><div className="truncate text-sm font-semibold" data-testid={`text-client-name-${client.key}`}>{client.displayName}</div><div className="mt-1 truncate text-[11px] text-[hsl(var(--muted-foreground))]">{client.phone || (client.orders[0]?.productName ? `Buyer details pending · ${client.orders[0].productName}` : 'Buyer details pending')}</div></div></div><div className="clients-cell-labeled"><span className="clients-mobile-label">Total orders</span><span className="font-mono-ui text-xs font-bold">{client.orderCount}</span></div><div className="clients-cell-labeled"><span className="clients-mobile-label">Collected</span><div><div className="font-mono-ui text-xs font-bold">{moneyExact(client.collected)}</div><div className="mt-1 text-[10px] text-[hsl(var(--muted-foreground))]">{client.outstanding ? `${moneyExact(client.outstanding)} outstanding` : 'Up to date'}</div></div></div><div className="clients-cell-labeled"><span className="clients-mobile-label">Last purchase</span><span className="font-mono-ui text-[10px] text-[hsl(var(--muted-foreground))]">{dateShort(client.latestPurchase)}</span></div><div className="clients-cell-labeled"><span className="clients-mobile-label">Latest detail</span><span className="text-right text-xs text-[hsl(var(--muted-foreground))]">{client.outstanding ? `${moneyExact(client.outstanding)} outstanding` : channelName(client.latestChannel)}</span></div><div className="clients-actions"><Link href={`/orders?customer=${encodeURIComponent(client.displayName)}`} data-testid={`link-view-client-${client.key}`} className="clients-view-link">View <ArrowRight size={13} /></Link></div></div>)}</div> : <div className="p-5 sm:p-6"><EmptyState icon={Search} title="No clients match" description="Try a different name or phone number." /></div>}
        </Card>
      </section>
    </>}
  </Shell>;
}

function ClientsSkeleton() {
  return <div className="space-y-5" aria-label="Loading clients"><div className="clients-overview"><Card className="h-[190px] p-5"><Skeleton className="h-3 w-24" /><Skeleton className="mt-6 h-10 w-28" /><Skeleton className="mt-3 h-3 w-48" /></Card><Card className="h-[190px] p-5"><Skeleton className="h-9 w-9 rounded-[11px]" /><Skeleton className="mt-6 h-8 w-20" /><Skeleton className="mt-3 h-3 w-32" /></Card><Card className="h-[190px] p-5"><Skeleton className="h-9 w-9 rounded-[11px]" /><Skeleton className="mt-6 h-8 w-24" /><Skeleton className="mt-3 h-3 w-36" /></Card></div><Card className="h-[360px] p-5"><Skeleton className="h-5 w-48" /><Skeleton className="mt-3 h-3 w-72" /><Skeleton className="mt-8 h-11 w-full" /><Skeleton className="mt-4 h-14 w-full" /><Skeleton className="mt-3 h-14 w-full" /><Skeleton className="mt-3 h-14 w-full" /></Card></div>;
}

type TakeOrderPath = 'catalog' | 'custom';
type TakeOrderStep = 1 | 2 | 3;

function TakeOrder() {
  const productsQuery = useListProducts();
  const createOrder = useCreateOrder();
  const createProduct = useCreateProduct();
  const [, setLocation] = useLocation();
  const seller = readSellerProfile();
  const [path, setPath] = useState<TakeOrderPath>('catalog');
  const [step, setStep] = useState<TakeOrderStep>(1);
  const [copied, setCopied] = useState(false);
  const [created, setCreated] = useState<Order | null>(null);
  const [form, setForm] = useState({
    productId: '',
    customName: '',
    amount: '',
    paymentMode: 'full' as 'full' | 'deposit' | 'reserve',
    depositAmount: '',
    channel: 'whatsapp' as OrderInput['channel'],
  });
  const product = (productsQuery.data ?? []).find((item) => item.id === Number(form.productId));
  const previewName = path === 'custom' ? form.customName : product?.name;
  const accent = product?.accent || '#2F5BFF';
  const busy = createOrder.isPending || createProduct.isPending;
  const change = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const chooseProduct = (value: string) => {
    const found = (productsQuery.data ?? []).find((item) => item.id === Number(value));
    setForm((current) => ({ ...current, productId: value, amount: found ? String(found.price) : current.amount }));
  };
  const validStep = step === 1
    ? (path === 'catalog' ? Boolean(form.productId) : Boolean(form.customName.trim()))
    : Boolean(form.amount) && Number(form.amount) >= 0 && (form.paymentMode !== 'deposit' || (Boolean(form.depositAmount) && Number(form.depositAmount) <= Number(form.amount)));
  const createLink = (productId: number) => {
    const data: OrderInput = {
      productId,
      amount: Number(form.amount),
      paymentMode: form.paymentMode,
      depositAmount: form.paymentMode === 'deposit' ? Number(form.depositAmount) : null,
      channel: form.channel,
    };
    createOrder.mutate({ data }, { onSuccess: (order) => setCreated(order) });
  };
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!validStep) return;
    if (step < 3) {
      setStep((current) => (current + 1) as TakeOrderStep);
      return;
    }
    if (path === 'custom') {
      const data: ProductInput = {
        name: form.customName.trim(),
        category: 'Custom order',
        price: Number(form.amount),
        cost: null,
        stock: 0,
        variants: [],
        accent: '#2F5BFF',
      };
      createProduct.mutate({ data }, {
        onSuccess: (newProduct) => {
          queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
          createLink(newProduct.id);
        },
      });
    } else if (product) {
      createLink(product.id);
    }
  };
  const link = created ? `${window.location.origin}/o/${created.token}` : '';
  const copy = async () => {
    await navigator.clipboard?.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  const reset = () => {
    setCreated(null);
    setStep(1);
    setPath('catalog');
    setForm({ productId: '', customName: '', amount: '', paymentMode: 'full', depositAmount: '', channel: 'whatsapp' });
  };

  if (created) {
    return <Shell><div className="mx-auto max-w-[620px] page-in">
      <div className="mb-8 flex h-16 w-16 items-center justify-center rounded-[20px] bg-[hsl(var(--accent))] text-white"><Check size={30} /></div>
      <div className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">Link is ready</div>
      <h1 className="mt-2 font-display text-[clamp(34px,5vw,56px)] font-bold leading-none tracking-[-.06em]">Send it their way.</h1>
      <p className="mt-4 max-w-[480px] leading-6 text-[hsl(var(--muted-foreground))]">Your {created.productName} link is live. Share it in the same place you started the conversation.</p>
      <Card className="mt-8 p-5"><div className="text-[10px] font-bold uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">Buyer link</div><div className="mt-3 flex items-center gap-3 rounded-[10px] bg-[hsl(var(--muted))] p-3"><Link2 size={16} className="shrink-0 text-[hsl(var(--muted-foreground))]" /><span className="min-w-0 flex-1 truncate font-mono-ui text-xs">{link}</span><Button onClick={copy} variant="soft" data-testid="button-copy-created-link">{copied ? <Check size={15} /> : <Copy size={15} />}{copied ? 'Copied' : 'Copy'}</Button></div></Card>
      <div className="mt-6 flex flex-wrap gap-3"><Link href={`/o/${created.token}`} data-testid="link-preview-created-order"><Button variant="outline"><ExternalLink size={15} />Preview buyer page</Button></Link><Button onClick={reset} variant="ghost">Create another</Button></div>
    </div></Shell>;
  }

  return <Shell><PageHeading title="Take an order" />
    <div className="mb-6 flex items-center gap-2 overflow-x-auto pb-1">
      {(['Item', 'Payment', 'Preview'] as const).map((label, index) => { const number = index + 1; return <button key={label} type="button" onClick={() => number < step && setStep(number as TakeOrderStep)} className={cn('flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-xs font-bold', step === number ? 'bg-[hsl(var(--primary))] text-white' : step > number ? 'bg-[hsl(var(--accent))]/15 text-[hsl(var(--accent-foreground))]' : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]')}><span className="font-mono-ui text-[10px]">{number}</span>{label}</button>; })}
    </div>
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <Card className="p-6 sm:p-8"><form onSubmit={submit} className="space-y-6">
        {step === 1 && <div className="page-in space-y-6">
          <div><div className="field-label">What are they buying?</div><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Use an existing catalog item or create the lightweight item you already agreed in chat.</p></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={() => setPath('catalog')} className={cn('rounded-[14px] border p-4 text-left', path === 'catalog' ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/[.06]' : 'border-[hsl(var(--border))]')}><Boxes size={18} className="text-[hsl(var(--primary))]" /><div className="mt-3 text-sm font-bold">Catalog item</div><div className="mt-1 text-[11px] leading-5 text-[hsl(var(--muted-foreground))]">Pick something already in your catalog.</div></button>
            <button type="button" onClick={() => setPath('custom')} className={cn('rounded-[14px] border p-4 text-left', path === 'custom' ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/[.06]' : 'border-[hsl(var(--border))]')}><Sparkles size={18} className="text-[hsl(var(--primary))]" /><div className="mt-3 text-sm font-bold">New item from chat</div><div className="mt-1 text-[11px] leading-5 text-[hsl(var(--muted-foreground))]">Create just the name and price now.</div></button>
          </div>
          {path === 'catalog' ? <div>{productsQuery.isLoading ? <Skeleton className="h-11 w-full" /> : <select data-testid="select-order-product" required value={form.productId} onChange={(event) => chooseProduct(event.target.value)} className="field-input"><option value="">Choose from catalog</option>{(productsQuery.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.name} · {moneyExact(item.price)}</option>)}</select>}{productsQuery.data?.length === 0 && <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">No catalog items yet. Choose “New item from chat” to create one as you make the link.</p>}</div> : <div><label className="field-label" htmlFor="custom-order-name">Item name</label><input id="custom-order-name" data-testid="input-custom-order-name" required value={form.customName} onChange={(event) => change('customName', event.target.value)} placeholder="e.g. Hand-painted denim jacket" className="field-input" /><p className="mt-2 text-[11px] text-[hsl(var(--muted-foreground))]">This creates a simple “Custom order” catalog entry so the transaction can be tracked.</p></div>}
        </div>}
        {step === 2 && <div className="page-in space-y-6">
          <div><div className="field-label">Set the agreed terms</div><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">These terms are already negotiated. The buyer will see them before they pay or reserve.</p></div>
          <div className="grid gap-5 sm:grid-cols-2"><div><label className="field-label" htmlFor="order-amount">Agreed price</label><div className="relative"><span className="absolute left-3 top-2.5 text-sm text-[hsl(var(--muted-foreground))]">$</span><input id="order-amount" data-testid="input-order-amount" required type="number" min="0" step=".01" value={form.amount} onChange={(event) => change('amount', event.target.value)} className="field-input pl-7" /></div></div><div><label className="field-label">Conversation started on</label><ChannelPicker value={form.channel} onChange={(value) => change('channel', value)} testId="select-order-channel" /></div></div>
          <div><div className="field-label">How should they pay?</div><div className="grid gap-2 sm:grid-cols-3">{[['full', 'Pay in full', 'Collect everything now'], ['deposit', 'Pay a deposit', 'Secure the order'], ['reserve', 'Reserve it', 'Confirm details first']].map(([value, title, note]) => <button type="button" key={value} onClick={() => change('paymentMode', value)} data-testid={`button-payment-mode-${value}`} className={cn('rounded-[12px] border p-3 text-left transition-colors', form.paymentMode === value ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]')}><div className="text-xs font-bold">{title}</div><div className={cn('mt-1 text-[10px]', form.paymentMode === value ? 'text-white' : 'text-[hsl(var(--muted-foreground))]')}>{note}</div></button>)}</div></div>
          {form.paymentMode === 'deposit' && <div className="page-in"><label className="field-label" htmlFor="order-deposit">Deposit amount</label><div className="relative max-w-[240px]"><span className="absolute left-3 top-2.5 text-sm text-[hsl(var(--muted-foreground))]">$</span><input id="order-deposit" data-testid="input-order-deposit" required type="number" min="0" step=".01" value={form.depositAmount} onChange={(event) => change('depositAmount', event.target.value)} className="field-input pl-7" /></div></div>}
        </div>}
        {step === 3 && <div className="page-in space-y-5"><div><div className="field-label">Review the buyer page</div><p className="mt-1 text-xs leading-5 text-[hsl(var(--muted-foreground))]">The buyer will see the item, agreed amount, seller name, contact fields, image upload, and payment choice.</p></div><div className="rounded-[14px] bg-[hsl(var(--muted))] p-4 text-sm"><div className="flex items-center justify-between"><span className="text-[hsl(var(--muted-foreground))]">Item</span><strong>{previewName || '—'}</strong></div><div className="mt-3 flex items-center justify-between"><span className="text-[hsl(var(--muted-foreground))]">Amount</span><strong>{form.amount ? moneyExact(Number(form.amount)) : '—'}</strong></div><div className="mt-3 flex items-center justify-between"><span className="text-[hsl(var(--muted-foreground))]">Payment</span><strong className="capitalize">{form.paymentMode === 'deposit' ? `Deposit · ${moneyExact(Number(form.depositAmount))}` : form.paymentMode}</strong></div></div></div>}
        <div className="flex justify-between border-t border-[hsl(var(--border))] pt-6">{step > 1 ? <Button type="button" variant="ghost" disabled={busy} onClick={() => setStep((current) => (current - 1) as TakeOrderStep)}><ArrowLeft size={15} />Back</Button> : <span aria-hidden="true" />}<Button type="submit" disabled={!validStep || busy || (path === 'catalog' && productsQuery.isLoading)} data-testid="button-create-order-link">{busy && <Loader2 className="animate-spin" size={15} />}{step < 3 ? 'Continue' : 'Create buyer link'} {step < 3 ? <ArrowRight size={15} /> : <ArrowUpRight size={15} />}</Button></div>
      </form></Card>
      <Card className="h-fit overflow-hidden"><div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-6 py-4"><div className="font-mono-ui text-[10px] uppercase tracking-[.15em] text-[hsl(var(--muted-foreground))]">Buyer page preview</div><Eye size={17} className="text-[hsl(var(--muted-foreground))]" /></div><div className="max-h-[760px] overflow-hidden bg-[hsl(var(--background))] px-6 py-8"><BuyerOrderSurface businessName={seller?.businessName || 'The Sunday Edit'} description={seller?.description} productName={previewName || 'Your item'} amount={form.amount ? Number(form.amount) : 0} paymentMode={form.paymentMode} depositAmount={form.depositAmount ? Number(form.depositAmount) : null} variants={product?.variants ?? []}><div className="space-y-5"><div><label className="field-label">Your name</label><input disabled placeholder="Full name" className="field-input" /></div><div><label className="field-label">Phone number</label><input disabled placeholder="Best number to reach you" className="field-input" /></div>{product?.variants?.length ? <div><label className="field-label">Available variants</label><div className="flex flex-wrap gap-2">{product.variants.map((variant) => <span key={variant} className="rounded-full border border-[hsl(var(--border))] px-3 py-1.5 text-xs">{variant}</span>)}</div></div> : null}<div><label className="field-label">Details for the seller <span className="font-normal text-[hsl(var(--muted-foreground))]">(optional)</span></label><textarea disabled placeholder="Size, color, delivery note, or anything already agreed..." rows={3} className="field-input resize-none" /></div><div><label className="field-label">Reference image <span className="font-normal text-[hsl(var(--muted-foreground))]">(optional)</span></label><div className="flex items-center gap-3 rounded-[10px] border border-dashed border-[hsl(var(--border))] p-3 text-xs text-[hsl(var(--muted-foreground))]"><Clipboard size={15} />Attach an image</div></div>{form.paymentMode !== 'reserve' && <div className="grid grid-cols-2 gap-2"><div className="rounded-[10px] border border-[hsl(var(--primary))] bg-[hsl(var(--primary))] p-3 text-left text-xs font-bold text-white">{form.paymentMode === 'deposit' ? `Pay deposit · ${form.depositAmount ? moneyExact(Number(form.depositAmount)) : '—'}` : `Pay ${form.amount ? moneyExact(Number(form.amount)) : '—'}`}</div><div className="rounded-[10px] border border-[hsl(var(--border))] p-3 text-left text-xs font-bold">Reserve for later</div></div>}<button type="button" disabled className="flex w-full items-center justify-center gap-2 rounded-[10px] bg-[hsl(var(--primary))] py-3.5 text-sm font-bold text-white opacity-70">{form.paymentMode === 'reserve' ? 'Reserve this item' : 'Continue to mock payment'} <ArrowUpRight size={15} /></button></div></BuyerOrderSurface></div></Card>
    </div>
  </Shell>;
}

type DraftOrderItem = {
  key: number;
  source: 'catalog' | 'custom';
  productId?: number;
  name: string;
  amount: number;
  variants: string[];
  accent: string;
};

const takeOrderStepMeta: Array<{ step: TakeOrderStep; label: string; detail: string }> = [
  { step: 1, label: 'Items', detail: 'Build the basket' },
  { step: 2, label: 'Checkout', detail: 'Confirm items and payment' },
  { step: 3, label: 'Review', detail: 'Check before sharing' },
];

function TakeOrderStepRail({ step, onStepChange }: { step: TakeOrderStep; onStepChange: (step: TakeOrderStep) => void }) {
  return <nav className="take-order-step-rail" aria-label="Order link setup">
    {takeOrderStepMeta.map((item, index) => {
      const complete = step > item.step;
      const current = step === item.step;
      return <React.Fragment key={item.step}>
        <button
          type="button"
          className={cn('take-order-step', current && 'is-current', complete && 'is-complete')}
          onClick={() => complete && onStepChange(item.step)}
          disabled={!complete && !current}
          aria-current={current ? 'step' : undefined}
          aria-label={`${item.label}: ${item.detail}${complete ? ', edit' : current ? ', current step' : ', locked'}`}
        >
          <span className="take-order-step-number">{complete ? <Check size={13} /> : item.step}</span>
          <span className="min-w-0 text-left">
            <span className="take-order-step-label">{item.label}</span>
            <span className="take-order-step-detail">{item.detail}</span>
          </span>
        </button>
        {index < takeOrderStepMeta.length - 1 && <span className={cn('take-order-step-line', step > item.step && 'is-complete')} aria-hidden="true" />}
      </React.Fragment>;
    })}
  </nav>;
}

function TakeOrderSection({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children: ReactNode }) {
  return <section className="take-order-section">
    <div className="take-order-section-heading">
      <div className="take-order-section-eyebrow">{eyebrow}</div>
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
    {children}
  </section>;
}

type TakeOrderItemSource = 'catalog' | 'custom';

function TakeOrderChoiceCards({ selected, onSelect }: { selected: TakeOrderItemSource | null; onSelect: (source: TakeOrderItemSource) => void }) {
  return <div className="take-order-choice-grid" aria-label="Choose how to add an item">
    <button type="button" className={cn('take-order-choice-card', selected === 'catalog' && 'is-active')} onClick={() => onSelect('catalog')}>
      <span className="take-order-choice-mark"><Boxes size={17} /></span>
      <span className="take-order-choice-copy"><strong>From catalog</strong><small>Use a saved product and price.</small></span>
      <ChevronRight size={16} aria-hidden="true" />
    </button>
    <button type="button" className={cn('take-order-choice-card', selected === 'custom' && 'is-active')} onClick={() => onSelect('custom')}>
      <span className="take-order-choice-mark is-custom"><Sparkles size={17} /></span>
      <span className="take-order-choice-copy"><strong>Not from catalog</strong><small>Add a one-off item from your conversation.</small></span>
      <ChevronRight size={16} aria-hidden="true" />
    </button>
  </div>;
}

function TakeOrderFeedback({ message }: { message: string | null }) {
  if (!message) return null;
  return <div className="take-order-feedback" role="alert"><AlertTriangle size={16} aria-hidden="true" /><span>{message}</span></div>;
}

function TakeOrderCheckoutCard({ items, total, feedback, onRemove, onOneOff, buttonTestId, disabled = false, className, showActions = true, showPayableTotal = false }: { items: DraftOrderItem[]; total: number; feedback?: string | null; onRemove: (key: number) => void; onOneOff: () => void; buttonTestId: string; disabled?: boolean; className?: string; showActions?: boolean; showPayableTotal?: boolean }) {
  return <div className={cn('take-order-catalog-selection', className)}>
    <div className="take-order-section-eyebrow">Client checkout</div>
    <div className="take-order-catalog-selection-heading"><h2>{items.length ? `${items.length} items selected` : 'No items selected'}</h2>{items.length > 0 && <strong>{moneyExact(total)}</strong>}</div>
    <div className="take-order-catalog-selection-list">
      {items.length ? items.map((item) => <div key={item.key} className="take-order-catalog-selection-row"><div className="take-order-item-mark" style={{ color: item.accent }}><Package size={15} /></div><span>{item.name}</span><b>{moneyExact(item.amount)}</b><button type="button" aria-label={`Remove ${item.name}`} onClick={() => onRemove(item.key)}><X size={14} /></button></div>) : <div className="take-order-catalog-selection-empty">Your selected products will appear here.</div>}
    </div>
    {showPayableTotal && <div className="take-order-checkout-payable"><span>Total payable amount</span><strong>{moneyExact(total)}</strong></div>}
    {feedback && <TakeOrderFeedback message={feedback} />}
    {showActions && <><Button type="submit" className="take-order-catalog-continue" disabled={disabled || !items.length || items.some((item) => item.amount <= 0)} data-testid={buttonTestId}>Continue <ArrowRight size={15} /></Button><button type="button" className="take-order-catalog-custom-link" onClick={onOneOff}>Add a one-off item instead</button></>}
  </div>;
}

function MultiItemTakeOrderModern() {
  const productsQuery = useListProducts();
  const createOrder = useCreateOrder();
  const createProduct = useCreateProduct();
  const seller = readSellerProfile();
  const [step, setStep] = useState<TakeOrderStep>(1);
  const [items, setItems] = useState<DraftOrderItem[]>([]);
  const [nextKey, setNextKey] = useState(1);
  const [itemSource, setItemSource] = useState<TakeOrderItemSource | null>(null);
  const [customDraft, setCustomDraft] = useState({ name: '', amount: '' });
  const [paymentMode, setPaymentMode] = useState<'full' | 'deposit' | 'reserve'>('full');
  const [depositAmount, setDepositAmount] = useState('');
  const [channel, setChannel] = useState<OrderInput['channel']>('whatsapp');
  const [created, setCreated] = useState<Order | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const total = items.reduce((sum, item) => sum + item.amount, 0);
  const choiceOnly = step === 1 && itemSource === null && items.length === 0;
  const catalogStage = step === 1 && itemSource === 'catalog';
  const previewItems: BuyerOrderItem[] = items.length
    ? items.map((item) => ({ productId: item.productId ?? item.key, productName: item.name, amount: item.amount, variants: item.variants }))
    : [{ productId: 0, productName: 'Your item', amount: 0, variants: [] }];
  const busy = createOrder.isPending || createProduct.isPending;
  const deposit = Number(depositAmount);
  const validDeposit = paymentMode !== 'deposit' || (Number.isFinite(deposit) && deposit > 0 && deposit <= total);
  const canContinue = step === 1
    ? items.length > 0 && items.every((item) => item.amount > 0)
    : total > 0 && validDeposit;

  const getErrorMessage = (error: unknown, fallback: string) => error instanceof Error && error.message ? error.message : fallback;
  const toggleCatalogProduct = (product: Product) => {
    setItems((current) => {
      const existing = current.some((item) => item.productId === product.id);
      if (existing) return current.filter((item) => item.productId !== product.id);
      return [...current, { key: nextKey, source: 'catalog', productId: product.id, name: product.name, amount: product.price, variants: product.variants, accent: product.accent }];
    });
    setNextKey((current) => current + 1);
    setFeedback(null);
  };
  const addCustomItem = () => {
    const amount = Number(customDraft.amount);
    if (!customDraft.name.trim() || !Number.isFinite(amount) || amount <= 0) {
      setFeedback('Add a name and a price greater than $0.00 before adding this item.');
      return;
    }
    setItems((current) => [...current, { key: nextKey, source: 'custom', name: customDraft.name.trim(), amount, variants: [], accent: '#2F5BFF' }]);
    setNextKey((current) => current + 1);
    setCustomDraft({ name: '', amount: '' });
    setFeedback(null);
  };
  const catalogItems = productsQuery.isLoading
    ? <div className="take-order-catalog-grid" aria-label="Loading catalog items">{[1, 2, 3, 4].map((item) => <div key={item} className="take-order-catalog-skeleton" />)}</div>
    : productsQuery.isError
      ? <div className="take-order-inline-error" role="alert">Catalog unavailable. <button type="button" onClick={() => productsQuery.refetch()}>Try again</button></div>
      : productsQuery.data?.length
        ? <div className="take-order-catalog-grid" aria-label="Catalog items">{productsQuery.data.map((product) => <button type="button" key={product.id} className={cn('take-order-catalog-item', items.some((item) => item.productId === product.id) && 'is-selected')} onClick={() => toggleCatalogProduct(product)} aria-label={`${items.some((item) => item.productId === product.id) ? 'Remove' : 'Add'} ${product.name} ${items.some((item) => item.productId === product.id) ? 'from' : 'to'} order`} aria-pressed={items.some((item) => item.productId === product.id)}>
          <span className="take-order-catalog-toggle" aria-hidden="true">{items.some((item) => item.productId === product.id) ? <Check size={13} strokeWidth={3} /> : <Plus size={13} />}</span>
          <img src={productImageFor(product.name)} alt="" className="take-order-catalog-image" />
          <span className="take-order-catalog-copy"><strong>{product.name}</strong><small>{product.variants.length ? `${product.variants.length} variant${product.variants.length === 1 ? '' : 's'}` : product.category || 'Catalog item'}</small><b>{moneyExact(product.price)}</b></span>
        </button>)}</div>
        : <p className="take-order-help">No products yet. Add a product in Catalog or use a one-off item instead.</p>;
  const updateAmount = (key: number, value: string) => {
    const amount = Number(value);
    setItems((current) => current.map((item) => item.key === key ? { ...item, amount: Number.isFinite(amount) && amount >= 0 ? amount : 0 } : item));
    setFeedback(null);
  };
  const createLink = (productIds: number[]) => {
    const data: OrderInput = {
      items: items.map((item, index) => ({ productId: productIds[index]!, amount: item.amount })),
      paymentMode,
      depositAmount: paymentMode === 'deposit' ? deposit : null,
      channel,
    };
    createOrder.mutate({ data }, {
      onSuccess: (order) => { setFeedback(null); setCreated(order); },
      onError: (error) => setFeedback(getErrorMessage(error, 'The buyer link could not be created. Check your connection and try again.')),
    });
  };
  const resolveItems = (index: number, productIds: number[] = []) => {
    const item = items[index];
    if (!item) {
      createLink(productIds);
      return;
    }
    if (item.productId) {
      resolveItems(index + 1, [...productIds, item.productId]);
      return;
    }
    const data: ProductInput = { name: item.name, category: 'Custom order', price: item.amount, cost: null, stock: 0, variants: [], accent: item.accent };
    createProduct.mutate({ data }, {
      onSuccess: (product) => {
        queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
        resolveItems(index + 1, [...productIds, product.id]);
      },
      onError: (error) => setFeedback(getErrorMessage(error, `Could not save “${item.name}”. Try again.`)),
    });
  };
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setFeedback(null);
    if (step === 1 && !canContinue) {
      setFeedback(items.length ? 'Every item needs a price greater than $0.00.' : 'Add at least one item to continue.');
      return;
    }
    if (step === 2 && !validDeposit) {
      setFeedback('The deposit must be greater than $0.00 and no more than the order total.');
      return;
    }
    if (step < 3) {
      setStep((current) => (current + 1) as TakeOrderStep);
      return;
    }
    resolveItems(0);
  };
  const link = created ? `${window.location.origin}/o/${created.token}` : '';
  const copy = async () => {
    setCopyError(false);
    try {
      if (!navigator.clipboard) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopyError(true);
    }
  };
  const reset = () => {
    setCreated(null);
    setCopied(false);
    setCopyError(false);
    setFeedback(null);
    setStep(1);
    setItems([]);
    setNextKey(1);
     setItemSource(null);
    setCustomDraft({ name: '', amount: '' });
    setPaymentMode('full');
    setDepositAmount('');
    setChannel('whatsapp');
  };

  if (created) {
    return <Shell><div className="take-order-success page-in">
      <div className="take-order-success-mark"><Check size={28} /></div>
      <div className="take-order-kicker">Link is ready</div>
      <h1>Send it their way.</h1>
      <p>Your buyer page is live with {items.length} item{items.length === 1 ? '' : 's'} and a combined total of <strong>{moneyExact(total)}</strong>.</p>
      <Card className="take-order-link-card">
        <div className="take-order-section-eyebrow">Buyer link</div>
        <div className="take-order-link-row"><Link2 size={16} aria-hidden="true" /><span>{link}</span><Button onClick={copy} variant="soft" data-testid="button-copy-created-link">{copied ? <Check size={15} /> : <Copy size={15} />}{copied ? 'Copied' : 'Copy link'}</Button></div>
        {copyError && <p className="take-order-copy-error" role="status">Copying is unavailable here. Select and copy the link manually.</p>}
      </Card>
      <div className="take-order-success-actions"><Link href={`/o/${created.token}`} data-testid="link-preview-created-order"><Button variant="outline"><ExternalLink size={15} />Preview buyer page</Button></Link><Button onClick={reset} variant="ghost">Create another</Button></div>
    </div></Shell>;
  }

  return <Shell>
    <div className="take-order-page">
      <div className="take-order-heading">
        <div>
          <div className="take-order-kicker">A buyer link in a minute</div>
          <h1>Take an order.</h1>
          <p>Turn the agreement you already made into a clear checkout link. No payment connection or chat access needed.</p>
        </div>
        <div className="take-order-trust"><CheckCircle2 size={15} />Private by default</div>
      </div>
      <TakeOrderStepRail step={step} onStepChange={setStep} />
      <div className="take-order-layout">
         <Card className={cn('take-order-builder-card', catalogStage && 'take-order-catalog-stage-card', choiceOnly && 'take-order-choice-stage-card')}>
          <form onSubmit={submit}>
               {choiceOnly && <TakeOrderSection eyebrow="Step 01 · Add items" title="What are you adding to this checkout?" description="Start with a saved product from your catalog or add something unique to this order.">
                 <TakeOrderChoiceCards selected={itemSource} onSelect={(source) => { setItemSource(source); setFeedback(null); }} />
               </TakeOrderSection>}
              {step === 1 && catalogStage && <div className="take-order-catalog-stage">
               <div className="take-order-catalog-browser">
                 <div className="take-order-section-eyebrow">Catalog</div>
                 <h2>Select products for this checkout.</h2>
                 <p>Choose one or more products for the same client. Select a tile again to remove it.</p>
                 {catalogItems}
               </div>
               <TakeOrderCheckoutCard items={items} total={total} feedback={feedback} onRemove={(key) => setItems((current) => current.filter((candidate) => candidate.key !== key))} onOneOff={() => { setItemSource('custom'); setFeedback(null); }} buttonTestId="button-continue-catalog" disabled={busy || productsQuery.isLoading} />
              </div>}
              {step === 1 && itemSource === 'custom' && <TakeOrderSection eyebrow="Step 01 · One-off item" title="Add something outside the catalog." description="Create a quick item for this client's checkout.">
               <div className="take-order-choice-form">
                <div className="take-order-custom-control"><input data-testid="input-custom-order-name" value={customDraft.name} onChange={(event) => setCustomDraft((current) => ({ ...current, name: event.target.value }))} placeholder="What are they buying?" className="field-input" /><div className="relative"><span className="take-order-currency">$</span><input data-testid="input-custom-order-price" type="number" min="0.01" step=".01" value={customDraft.amount} onChange={(event) => setCustomDraft((current) => ({ ...current, amount: event.target.value }))} placeholder="Price" className="field-input pl-7" /></div><Button type="button" variant="outline" disabled={!customDraft.name.trim() || !customDraft.amount} onClick={addCustomItem}><Plus size={15} />Add item</Button></div>
               </div>
              <div className="take-order-items-heading"><div><div className="take-order-section-eyebrow">This order</div><h3>{items.length ? `${items.length} item${items.length === 1 ? '' : 's'} added` : 'Nothing added yet'}</h3></div>{items.length > 0 && <span className="take-order-total-chip">{moneyExact(total)}</span>}</div>
              <div className="take-order-item-list">
                 {items.length ? items.map((item, index) => <div key={item.key} className="take-order-item-row">
                  <div className="take-order-item-number">{String(index + 1).padStart(2, '0')}</div>
                  <div className="take-order-item-mark" style={{ color: item.accent }}><Package size={17} /></div>
                  <div className="take-order-item-copy"><strong>{item.name}</strong><span>{item.source === 'custom' ? 'Quick item' : item.variants.length ? `${item.variants.length} variant${item.variants.length === 1 ? '' : 's'} · Catalog` : 'Catalog item'}</span></div>
                  <div className="take-order-item-price"><span className="take-order-currency">$</span><input aria-label={`Price for ${item.name}`} type="number" min="0" step=".01" value={item.amount} onChange={(event) => updateAmount(item.key, event.target.value)} className="field-input" /></div>
                  <button type="button" aria-label={`Remove ${item.name}`} onClick={() => setItems((current) => current.filter((candidate) => candidate.key !== item.key))} className="take-order-remove"><Trash2 size={15} /></button>
                 </div>) : <div className="take-order-empty-items"><PackageSearch size={22} /><strong>Your order starts here</strong><span>Choose how you want to add the first item.</span></div>}
              </div>
             </TakeOrderSection>}
             {step === 2 && <TakeOrderSection eyebrow="Step 02 · Confirm checkout" title="Review the client's checkout." description="Confirm the selected items, then choose how the buyer should complete the payment.">
               <TakeOrderCheckoutCard items={items} total={total} feedback={feedback} onRemove={(key) => { setItems((current) => current.filter((candidate) => candidate.key !== key)); setFeedback(null); }} onOneOff={() => { setItemSource('custom'); setStep(1); setFeedback(null); }} buttonTestId="button-payment-checkout" disabled={busy} showActions={false} showPayableTotal className="take-order-payment-checkout-card" />
               <div className="take-order-payment-config-card">
                 <div className="take-order-payment-config-heading"><div className="take-order-section-eyebrow">Payment configuration</div><h3>Set the checkout terms.</h3><p>Choose how the buyer should complete this order and where the conversation started.</p></div>
                 <div className="take-order-field-group"><div className="field-label">How should they pay?</div><div className="take-order-payment-options">{[['full', 'Pay in full', 'Collect the full total now'], ['deposit', 'Pay a deposit', 'Secure the order with part-payment'], ['reserve', 'Reserve it', 'Confirm the details first']].map(([value, title, note]) => <button type="button" key={value} onClick={() => { setPaymentMode(value as 'full' | 'deposit' | 'reserve'); setFeedback(null); }} data-testid={`button-payment-mode-${value}`} className={cn('take-order-payment-option', paymentMode === value && 'is-selected')}><span className="take-order-radio">{paymentMode === value && <span />}</span><span><strong>{title}</strong><small>{note}</small></span></button>)}</div></div>
                 {paymentMode === 'deposit' && <div className="take-order-deposit-field"><label className="field-label" htmlFor="input-order-deposit">Deposit amount <span>of {moneyExact(total)}</span></label><div className="relative max-w-[260px]"><span className="take-order-currency">$</span><input id="input-order-deposit" data-testid="input-order-deposit" required type="number" min="0.01" max={total} step=".01" value={depositAmount} onChange={(event) => { setDepositAmount(event.target.value); setFeedback(null); }} className={cn('field-input pl-7', depositAmount && !validDeposit && 'is-invalid')} placeholder="0.00" /></div>{depositAmount && !validDeposit && <p className="take-order-field-error">Use an amount between $0.01 and {moneyExact(total)}.</p>}</div>}
                 <div className="take-order-field-group"><div className="field-label">Conversation started on</div><ChannelPicker value={channel} onChange={setChannel} testId="select-order-channel" /></div>
               </div>
            </TakeOrderSection>}
             {step === 3 && <TakeOrderSection eyebrow="Step 03 · Review" title="Review your client checkout." description="Check the selected items and details before creating the buyer link.">
               <TakeOrderCheckoutCard items={items} total={total} onRemove={(key) => setItems((current) => current.filter((candidate) => candidate.key !== key))} onOneOff={() => { setItemSource('custom'); setStep(1); setFeedback(null); }} buttonTestId="button-review-checkout" disabled={busy} />
              <div className="take-order-review-list">{items.map((item, index) => <div className="take-order-review-row" key={item.key}><span>{String(index + 1).padStart(2, '0')}</span><strong>{item.name}</strong><b>{moneyExact(item.amount)}</b></div>)}</div>
              <div className="take-order-review-total"><span>Total to buyer</span><strong>{moneyExact(total)}</strong></div>
              <div className="take-order-review-details"><div><span>Payment</span><strong>{paymentMode === 'deposit' ? `Deposit · ${moneyExact(deposit)}` : paymentMode === 'full' ? 'Pay in full' : 'Reserve for later'}</strong></div><div><span>Conversation</span><strong><ChannelInline value={channel} /></strong></div></div>
              <div className="take-order-review-note"><CheckCircle2 size={17} /><div><strong>Buyer details stay with the order.</strong><span>They can add their name, phone number, notes, and an optional reference image on the next page.</span></div></div>
            </TakeOrderSection>}
              {!catalogStage && !choiceOnly && <><TakeOrderFeedback message={feedback} /><div className="take-order-form-footer">{step > 1 ? <Button type="button" variant="ghost" disabled={busy} onClick={() => setStep((current) => (current - 1) as TakeOrderStep)}><ArrowLeft size={15} />Back</Button> : <span className="take-order-footer-hint"><ShieldIcon /> No account connection needed</span>}<Button type="submit" disabled={!canContinue || busy || (step === 1 && productsQuery.isLoading)} data-testid="button-create-order-link">{busy && <Loader2 className="animate-spin" size={15} />}{step === 2 ? 'Confirm checkout' : step < 3 ? 'Continue' : 'Create buyer link'} {step < 3 ? <ArrowRight size={15} /> : <ArrowUpRight size={15} />}</Button></div></>}
          </form>
        </Card>
        <aside className="take-order-preview-column">
          <div className="take-order-preview-heading"><div><div className="take-order-section-eyebrow">Live preview</div><h2>What your buyer sees</h2></div><Eye size={17} aria-hidden="true" /></div>
          <div className="take-order-preview-frame"><BuyerOrderSurface businessName={seller?.businessName || 'The Sunday Edit'} description={seller?.description} items={previewItems} paymentMode={paymentMode} depositAmount={paymentMode === 'deposit' ? deposit : null}>{(activeItem) => <div className="space-y-5"><div><label className="field-label">Your name</label><input disabled placeholder="Full name" className="field-input" /></div><div><label className="field-label">Phone number</label><input disabled placeholder="Best number to reach you" className="field-input" /></div>{activeItem.variants.length > 0 && <div><label className="field-label">Available variants</label><div className="flex flex-wrap gap-2">{activeItem.variants.map((variant) => <span key={variant} className="rounded-full border border-[hsl(var(--border))] px-3 py-1.5 text-xs">{variant}</span>)}</div></div>}<div><label className="field-label">Details for the seller <span className="font-normal text-[hsl(var(--muted-foreground))]">(optional)</span></label><textarea disabled placeholder="Size, color, delivery note, or anything already agreed..." rows={3} className="field-input resize-none" /></div><div><label className="field-label">Reference image <span className="font-normal text-[hsl(var(--muted-foreground))]">(optional)</span></label><div className="flex items-center gap-3 rounded-[10px] border border-dashed border-[hsl(var(--border))] p-3 text-xs text-[hsl(var(--muted-foreground))]"><Clipboard size={15} />Attach an image</div></div>{paymentMode !== 'reserve' && <div className="grid grid-cols-2 gap-2"><div className="rounded-[10px] border border-[hsl(var(--primary))] bg-[hsl(var(--primary))] p-3 text-left text-xs font-bold text-white">{paymentMode === 'deposit' ? `Pay deposit · ${depositAmount ? moneyExact(deposit) : '—'}` : `Pay ${moneyExact(total)}`}</div><div className="rounded-[10px] border border-[hsl(var(--border))] p-3 text-left text-xs font-bold">Reserve for later</div></div>}<button type="button" disabled className="flex w-full items-center justify-center gap-2 rounded-[10px] bg-[hsl(var(--primary))] py-3.5 text-sm font-bold text-white opacity-70">{paymentMode === 'reserve' ? 'Reserve these items' : 'Continue to mock payment'} <ArrowUpRight size={15} /></button></div>}</BuyerOrderSurface></div>
          <div className="take-order-preview-note"><Eye size={15} /><span>Preview updates as you build. The buyer link will open the full page.</span></div>
        </aside>
      </div>
    </div>
  </Shell>;
}

function MultiItemTakeOrder() {
  const productsQuery = useListProducts();
  const createOrder = useCreateOrder();
  const createProduct = useCreateProduct();
  const seller = readSellerProfile();
  const [step, setStep] = useState<TakeOrderStep>(1);
  const [items, setItems] = useState<DraftOrderItem[]>([]);
  const [nextKey, setNextKey] = useState(1);
  const [catalogChoice, setCatalogChoice] = useState('');
  const [customDraft, setCustomDraft] = useState({ name: '', amount: '' });
  const [paymentMode, setPaymentMode] = useState<'full' | 'deposit' | 'reserve'>('full');
  const [depositAmount, setDepositAmount] = useState('');
  const [channel, setChannel] = useState<OrderInput['channel']>('whatsapp');
  const [created, setCreated] = useState<Order | null>(null);
  const [copied, setCopied] = useState(false);
  const total = items.reduce((sum, item) => sum + item.amount, 0);
  const previewItems: BuyerOrderItem[] = items.length
    ? items.map((item) => ({ productId: item.productId ?? item.key, productName: item.name, amount: item.amount, variants: item.variants }))
    : [{ productId: 0, productName: 'Your item', amount: 0, variants: [] }];
  const busy = createOrder.isPending || createProduct.isPending;
  const canContinue = step === 1
    ? items.length > 0
    : total > 0 && (paymentMode !== 'deposit' || (Boolean(depositAmount) && Number(depositAmount) <= total));

  const addCatalogItem = () => {
    const product = (productsQuery.data ?? []).find((item) => item.id === Number(catalogChoice));
    if (!product) return;
    setItems((current) => [...current, { key: nextKey, source: 'catalog', productId: product.id, name: product.name, amount: product.price, variants: product.variants, accent: product.accent }]);
    setNextKey((current) => current + 1);
    setCatalogChoice('');
  };
  const addCustomItem = () => {
    const amount = Number(customDraft.amount);
    if (!customDraft.name.trim() || !Number.isFinite(amount) || amount < 0) return;
    setItems((current) => [...current, { key: nextKey, source: 'custom', name: customDraft.name.trim(), amount, variants: [], accent: '#2F5BFF' }]);
    setNextKey((current) => current + 1);
    setCustomDraft({ name: '', amount: '' });
  };
  const updateAmount = (key: number, value: string) => {
    const amount = Number(value);
    setItems((current) => current.map((item) => item.key === key ? { ...item, amount: Number.isFinite(amount) && amount >= 0 ? amount : 0 } : item));
  };
  const createLink = (productIds: number[]) => {
    const data: OrderInput = {
      items: items.map((item, index) => ({ productId: productIds[index]!, amount: item.amount })),
      paymentMode,
      depositAmount: paymentMode === 'deposit' ? Number(depositAmount) : null,
      channel,
    };
    createOrder.mutate({ data }, { onSuccess: (order) => setCreated(order) });
  };
  const resolveItems = (index: number, productIds: number[] = []) => {
    const item = items[index];
    if (!item) {
      createLink(productIds);
      return;
    }
    if (item.productId) {
      resolveItems(index + 1, [...productIds, item.productId]);
      return;
    }
    const data: ProductInput = { name: item.name, category: 'Custom order', price: item.amount, cost: null, stock: 0, variants: [], accent: item.accent };
    createProduct.mutate({ data }, {
      onSuccess: (product) => {
        queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
        resolveItems(index + 1, [...productIds, product.id]);
      },
    });
  };
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canContinue) return;
    if (step < 3) {
      setStep((current) => (current + 1) as TakeOrderStep);
      return;
    }
    resolveItems(0);
  };
  const link = created ? `${window.location.origin}/o/${created.token}` : '';
  const copy = async () => {
    await navigator.clipboard?.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  const reset = () => {
    setCreated(null);
    setStep(1);
    setItems([]);
    setPaymentMode('full');
    setDepositAmount('');
    setChannel('whatsapp');
  };

  if (created) {
    return <Shell><div className="mx-auto max-w-[620px] page-in"><div className="mb-8 flex h-16 w-16 items-center justify-center rounded-[20px] bg-[hsl(var(--accent))] text-white"><Check size={30} /></div><div className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">Link is ready</div><h1 className="mt-2 font-display text-[clamp(34px,5vw,56px)] font-bold leading-none tracking-[-.06em]">Send it their way.</h1><p className="mt-4 max-w-[480px] leading-6 text-[hsl(var(--muted-foreground))]">Your {created.productName} link is live with {items.length} item{items.length === 1 ? '' : 's'} and a combined total of {moneyExact(total)}.</p><Card className="mt-8 p-5"><div className="text-[10px] font-bold uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">Buyer link</div><div className="mt-3 flex items-center gap-3 rounded-[10px] bg-[hsl(var(--muted))] p-3"><Link2 size={16} className="shrink-0 text-[hsl(var(--muted-foreground))]" /><span className="min-w-0 flex-1 truncate font-mono-ui text-xs">{link}</span><Button onClick={copy} variant="soft" data-testid="button-copy-created-link">{copied ? <Check size={15} /> : <Copy size={15} />}{copied ? 'Copied' : 'Copy'}</Button></div></Card><div className="mt-6 flex flex-wrap gap-3"><Link href={`/o/${created.token}`} data-testid="link-preview-created-order"><Button variant="outline"><ExternalLink size={15} />Preview buyer page</Button></Link><Button onClick={reset} variant="ghost">Create another</Button></div></div></Shell>;
  }

  return <Shell><PageHeading title="Take an order" /><div className="mb-6 flex items-center gap-2 overflow-x-auto pb-1">{(['Items', 'Payment', 'Preview'] as const).map((label, index) => { const number = index + 1; return <button key={label} type="button" onClick={() => number < step && setStep(number as TakeOrderStep)} className={cn('flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-xs font-bold', step === number ? 'bg-[hsl(var(--primary))] text-white' : step > number ? 'bg-[hsl(var(--accent))]/15 text-[hsl(var(--accent-foreground))]' : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]')}><span className="font-mono-ui text-[10px]">{number}</span>{label}</button>; })}</div><div className="grid gap-6 lg:grid-cols-[1fr_360px]"><Card className="p-6 sm:p-8"><form onSubmit={submit} className="space-y-6">
    {step === 1 && <div className="page-in space-y-6"><div><div className="field-label">Items in this order</div><p className="mt-1 text-xs leading-5 text-[hsl(var(--muted-foreground))]">Add as many catalog or already-negotiated custom items as the buyer needs. Each item keeps its own price.</p></div><div className="grid gap-3 rounded-[14px] border border-[hsl(var(--border))] p-4 sm:grid-cols-[1fr_auto]"><div><label className="field-label">Add from catalog</label><select data-testid="select-order-product" value={catalogChoice} onChange={(event) => setCatalogChoice(event.target.value)} className="field-input"><option value="">Choose an item</option>{(productsQuery.data ?? []).map((product) => <option key={product.id} value={product.id}>{product.name} · {moneyExact(product.price)}</option>)}</select></div><Button type="button" variant="outline" disabled={!catalogChoice} onClick={addCatalogItem}><Plus size={15} />Add item</Button></div><div className="grid gap-3 rounded-[14px] border border-dashed border-[hsl(var(--border))] p-4 sm:grid-cols-[1fr_150px_auto]"><div><label className="field-label">New item from chat</label><input data-testid="input-custom-order-name" value={customDraft.name} onChange={(event) => setCustomDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Item name" className="field-input" /></div><div><label className="field-label">Price</label><div className="relative"><span className="absolute left-3 top-2.5 text-sm text-[hsl(var(--muted-foreground))]">$</span><input data-testid="input-custom-order-price" type="number" min="0" step=".01" value={customDraft.amount} onChange={(event) => setCustomDraft((current) => ({ ...current, amount: event.target.value }))} placeholder="0.00" className="field-input pl-7" /></div></div><Button type="button" variant="outline" disabled={!customDraft.name.trim() || !customDraft.amount} onClick={addCustomItem}><Plus size={15} />Add custom</Button></div><div className="space-y-2">{items.length ? items.map((item, index) => <div key={item.key} className="flex items-center gap-3 rounded-[12px] bg-[hsl(var(--muted))] p-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-white" style={{ color: item.accent }}><Package size={17} /></div><div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{index + 1}. {item.name}</div><div className="mt-1 text-[10px] uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">{item.source === 'custom' ? 'Custom item' : 'Catalog item'}</div></div><div className="relative w-28"><span className="absolute left-2.5 top-2.5 text-xs text-[hsl(var(--muted-foreground))]">$</span><input aria-label={`Price for ${item.name}`} type="number" min="0" step=".01" value={item.amount} onChange={(event) => updateAmount(item.key, event.target.value)} className="field-input pl-6 text-right text-xs" /></div><button type="button" aria-label={`Remove ${item.name}`} onClick={() => setItems((current) => current.filter((candidate) => candidate.key !== item.key))} className="rounded-full p-2 text-[hsl(var(--muted-foreground))] hover:bg-white hover:text-[hsl(var(--destructive))]"><Trash2 size={15} /></button></div>) : <div className="rounded-[12px] border border-dashed border-[hsl(var(--border))] p-5 text-center text-xs text-[hsl(var(--muted-foreground))]">Add at least one item to build this link.</div>}</div>{items.length > 0 && <div className="flex items-center justify-between border-t border-[hsl(var(--border))] pt-4 text-sm"><span className="text-[hsl(var(--muted-foreground))]">Combined total</span><strong className="font-mono-ui">{moneyExact(total)}</strong></div>}</div>}
    {step === 2 && <div className="page-in space-y-6"><div><div className="field-label">Set the checkout terms</div><p className="mt-1 text-xs leading-5 text-[hsl(var(--muted-foreground))]">The buyer will see every item price and pay or reserve the combined total.</p></div><div><div className="field-label">How should they pay?</div><div className="grid gap-2 sm:grid-cols-3">{[['full', 'Pay in full', 'Collect everything now'], ['deposit', 'Pay a deposit', 'Secure the order'], ['reserve', 'Reserve it', 'Confirm details first']].map(([value, title, note]) => <button type="button" key={value} onClick={() => setPaymentMode(value as 'full' | 'deposit' | 'reserve')} data-testid={`button-payment-mode-${value}`} className={cn('rounded-[12px] border p-3 text-left transition-colors', paymentMode === value ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]')}><div className="text-xs font-bold">{title}</div><div className={cn('mt-1 text-[10px]', paymentMode === value ? 'text-white' : 'text-[hsl(var(--muted-foreground))]')}>{note}</div></button>)}</div></div>{paymentMode === 'deposit' && <div><label className="field-label">Deposit amount against {moneyExact(total)}</label><div className="relative max-w-[240px]"><span className="absolute left-3 top-2.5 text-sm text-[hsl(var(--muted-foreground))]">$</span><input data-testid="input-order-deposit" required type="number" min="0" max={total} step=".01" value={depositAmount} onChange={(event) => setDepositAmount(event.target.value)} className="field-input pl-7" /></div></div>}<div><label className="field-label">Conversation started on</label><ChannelPicker value={channel} onChange={setChannel} testId="select-order-channel" /></div></div>}
    {step === 3 && <div className="page-in space-y-5"><div><div className="field-label">Review the buyer page</div><p className="mt-1 text-xs leading-5 text-[hsl(var(--muted-foreground))]">Swipe through the item cards to confirm the buyer sees every agreed item and the combined checkout total.</p></div><div className="rounded-[14px] bg-[hsl(var(--muted))] p-4 text-sm"><div className="flex items-center justify-between"><span className="text-[hsl(var(--muted-foreground))]">Items</span><strong>{items.length}</strong></div><div className="mt-3 flex items-center justify-between"><span className="text-[hsl(var(--muted-foreground))]">Combined total</span><strong>{moneyExact(total)}</strong></div></div></div>}
    <div className="flex justify-between border-t border-[hsl(var(--border))] pt-6">{step > 1 ? <Button type="button" variant="ghost" disabled={busy} onClick={() => setStep((current) => (current - 1) as TakeOrderStep)}><ArrowLeft size={15} />Back</Button> : <span aria-hidden="true" />}<Button type="submit" disabled={!canContinue || busy || (step === 1 && productsQuery.isLoading)} data-testid="button-create-order-link">{busy && <Loader2 className="animate-spin" size={15} />}{step < 3 ? 'Continue' : 'Create buyer link'} {step < 3 ? <ArrowRight size={15} /> : <ArrowUpRight size={15} />}</Button></div></form></Card><Card className="h-fit overflow-hidden"><div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-6 py-4"><div className="font-mono-ui text-[10px] uppercase tracking-[.15em] text-[hsl(var(--muted-foreground))]">Buyer page preview</div><Eye size={17} className="text-[hsl(var(--muted-foreground))]" /></div><div className="max-h-[760px] overflow-hidden bg-[hsl(var(--background))] px-6 py-8"><BuyerOrderSurface businessName={seller?.businessName || 'The Sunday Edit'} description={seller?.description} items={previewItems} paymentMode={paymentMode} depositAmount={paymentMode === 'deposit' ? Number(depositAmount) : null}>{(activeItem) => <div className="space-y-5"><div><label className="field-label">Your name</label><input disabled placeholder="Full name" className="field-input" /></div><div><label className="field-label">Phone number</label><input disabled placeholder="Best number to reach you" className="field-input" /></div>{activeItem.variants.length > 0 && <div><label className="field-label">Available variants</label><div className="flex flex-wrap gap-2">{activeItem.variants.map((variant) => <span key={variant} className="rounded-full border border-[hsl(var(--border))] px-3 py-1.5 text-xs">{variant}</span>)}</div></div>}<div><label className="field-label">Details for the seller <span className="font-normal text-[hsl(var(--muted-foreground))]">(optional)</span></label><textarea disabled placeholder="Size, color, delivery note, or anything already agreed..." rows={3} className="field-input resize-none" /></div><div><label className="field-label">Reference image <span className="font-normal text-[hsl(var(--muted-foreground))]">(optional)</span></label><div className="flex items-center gap-3 rounded-[10px] border border-dashed border-[hsl(var(--border))] p-3 text-xs text-[hsl(var(--muted-foreground))]"><Clipboard size={15} />Attach an image</div></div>{paymentMode !== 'reserve' && <div className="grid grid-cols-2 gap-2"><div className="rounded-[10px] border border-[hsl(var(--primary))] bg-[hsl(var(--primary))] p-3 text-left text-xs font-bold text-white">{paymentMode === 'deposit' ? `Pay deposit · ${depositAmount ? moneyExact(Number(depositAmount)) : '—'}` : `Pay ${moneyExact(total)}`}</div><div className="rounded-[10px] border border-[hsl(var(--border))] p-3 text-left text-xs font-bold">Reserve for later</div></div>}<button type="button" disabled className="flex w-full items-center justify-center gap-2 rounded-[10px] bg-[hsl(var(--primary))] py-3.5 text-sm font-bold text-white opacity-70">{paymentMode === 'reserve' ? 'Reserve these items' : 'Continue to mock payment'} <ArrowUpRight size={15} /></button></div>}</BuyerOrderSurface></div></Card></div></Shell>;
}

type BuyerOrderSurfaceProps = {
  businessName: string;
  description?: string;
  productName?: string;
  amount?: number;
  paymentMode: 'full' | 'deposit' | 'reserve';
  depositAmount: number | null | undefined;
  variants?: string[];
  items?: BuyerOrderItem[];
  children: ReactNode | ((item: BuyerOrderItem) => ReactNode);
};

type BuyerOrderItem = {
  productId: number;
  productName: string;
  amount: number;
  variants: string[];
  imageUrl?: string;
};

export function BuyerOrderSurface({ businessName, description, productName, amount, paymentMode, depositAmount, variants = [], items, children }: BuyerOrderSurfaceProps) {
  const displayItems = items?.length ? items : [{ productId: 0, productName: productName || 'Your item', amount: amount || 0, variants }];
  const [activeIndex, setActiveIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const activeItem = displayItems[Math.min(activeIndex, displayItems.length - 1)]!;
  const total = displayItems.reduce((sum, item) => sum + item.amount, 0);
  useEffect(() => setActiveIndex(0), [displayItems.length]);
  const move = (direction: -1 | 1) => setActiveIndex((current) => (current + direction + displayItems.length) % displayItems.length);
  const handleTouchEnd = (event: React.TouchEvent) => {
    const start = touchStartX.current;
    touchStartX.current = null;
    if (start == null || displayItems.length < 2) return;
    const delta = event.changedTouches[0]!.clientX - start;
    if (Math.abs(delta) > 36) move(delta < 0 ? 1 : -1);
  };
  return <>
    <div className="flex justify-center">
      <BrandLockup className="gap-2" />
    </div>
    <div className="mx-auto mt-7 flex max-w-[300px] items-center justify-center gap-3 rounded-[14px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--primary))] text-[10px] font-bold text-white">{initials(businessName)}</div>
      <div className="min-w-0 text-left">
        <div className="font-mono-ui text-[9px] uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">Seller brand</div>
        <div className="truncate text-sm font-bold">{businessName}</div>
      </div>
    </div>
      <div className="mt-10 text-center" onTouchStart={(event) => { touchStartX.current = event.touches[0]?.clientX ?? null; }} onTouchEnd={handleTouchEnd}>
      <div className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">Your order</div>
      <div className="mt-5 flex items-center justify-center gap-2">
        <button type="button" aria-label="Previous item" onClick={() => move(-1)} disabled={displayItems.length < 2} className="rounded-full p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] disabled:invisible"><ArrowLeft size={16} /></button>
        <div className="min-w-0 flex-1">
          <div className="relative aspect-[4/3] overflow-hidden rounded-[18px] border border-[hsl(var(--border))] bg-[hsl(var(--muted))]">
            <img src={activeItem.imageUrl || productImageFor(activeItem.productName)} alt={`${activeItem.productName} product preview`} className="h-full w-full object-cover" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/15 to-transparent" />
          </div>
        </div>
        <button type="button" aria-label="Next item" onClick={() => move(1)} disabled={displayItems.length < 2} className="rounded-full p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] disabled:invisible"><ArrowRight size={16} /></button>
      </div>
      {displayItems.length > 1 && <div className="mt-3 flex items-center justify-center gap-2"><span className="text-[10px] text-[hsl(var(--muted-foreground))]">Swipe to browse</span><span className="flex gap-1">{displayItems.map((item, index) => <span key={`${item.productId}-${index}`} className={cn('h-1.5 w-1.5 rounded-full', index === activeIndex ? 'bg-[hsl(var(--primary))]' : 'bg-[hsl(var(--border))')} />)}</span></div>}
      <div className="mt-5">
        <h1 className="font-display text-2xl font-bold leading-tight tracking-[-.04em]">{activeItem.productName}</h1>
        <div className="mt-2 font-mono-ui text-xl">{moneyExact(activeItem.amount)}</div>
      </div>
      {description && <p className="mx-auto mt-3 max-w-[360px] text-xs leading-5 text-[hsl(var(--muted-foreground))]">{description}</p>}
    </div>
    <Card className="mt-9 p-6 sm:p-8">
      <div className="mb-6 flex items-center justify-between border-b border-[hsl(var(--border))] pb-5">
        <div><h2 id="buyer-order-form-heading" className="font-mono-ui text-[10px] uppercase tracking-[.16em]">Complete your order</h2><p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">{paymentMode === 'reserve' ? 'Reserve these items and we’ll confirm the details.' : paymentMode === 'deposit' ? `A ${moneyExact(depositAmount)} deposit secures the order.` : 'Pay in full to confirm your order.'}</p></div>
        <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-[hsl(var(--accent))]/35"><Package size={18} /></div>
      </div>
      <div className="mb-5 flex items-center justify-between rounded-[10px] bg-[hsl(var(--muted))] px-3 py-2.5 text-xs"><span className="text-[hsl(var(--muted-foreground))]">{displayItems.length === 1 ? 'Order total' : `${displayItems.length} items`}</span><strong className="font-mono-ui">{moneyExact(total)}</strong></div>
      {typeof children === 'function' ? children(activeItem) : children}
    </Card>
    <PoweredByTakeOrder className="mt-6" />
  </>;
}

type BuyerOrderFormValues = {
  name: string;
  phone: string;
  details: string;
  image: string;
  imagePreview: string;
  action: 'pay' | 'reserve';
};
function PublicOrderPage() {
  const { token = '' } = useParams<{ token: string }>();
  const query = useGetPublicOrder(token, { query: { enabled: Boolean(token), queryKey: getGetPublicOrderQueryKey(token) } });
  const submit = useSubmitPublicOrder();
  const queryClient = useQueryClient();
  const seller = readSellerProfile();
  const businessName = seller?.businessName || 'The Sunday Edit';
  const [submitted, setSubmitted] = useState(false);
  const [showMockPayment, setShowMockPayment] = useState(false);
  const [mockPayment, setMockPayment] = useState({ cardNumber: '', expiry: '', cvc: '' });
  const [form, setForm] = useState({ name: '', phone: '', details: '', image: '', imagePreview: '', action: 'pay' as 'pay' | 'reserve' });
  const order = query.data;
  useEffect(() => {
    if (order) invalidateDashboardSummary(queryClient);
  }, [order, queryClient]);
  const change = (key: string, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    if (key === 'action' && value === 'reserve') setShowMockPayment(false);
  };
  const submitForm = (event: React.FormEvent) => {
    event.preventDefault();
    if (order?.paymentMode !== 'reserve' && form.action === 'pay' && !showMockPayment) {
      setShowMockPayment(true);
      return;
    }
    const data: PublicOrderInput = { customerName: form.name, customerPhone: form.phone, buyerDetails: form.details || undefined, referenceImage: form.image || undefined, paymentAction: order?.paymentMode === 'reserve' ? 'reserve' : form.action };
    submit.mutate({ token, data }, { onSuccess: () => { invalidateDashboardSummary(queryClient); setSubmitted(true); } });
  };
  if (query.isLoading) return <div className="min-h-[100dvh] bg-[hsl(var(--background))] p-6"><div className="mx-auto max-w-[480px]"><BrandLockup className="mx-auto mt-14 justify-center" /><Skeleton className="mx-auto mt-8 h-8 w-52" /><Skeleton className="mt-4 h-4 w-full" /><Skeleton className="mt-10 h-64 w-full" /></div></div>;
  if (query.isError || !order) return <div className="flex min-h-[100dvh] items-center justify-center p-6"><div className="text-center"><BrandLockup className="justify-center" /><div className="mt-10 font-display text-2xl font-bold">This link is no longer available.</div><p className="mt-3 text-sm text-[hsl(var(--muted-foreground))]">Ask the seller for a fresh order link.</p></div></div>;
  if (submitted) return <div className="flex min-h-[100dvh] items-center justify-center bg-[hsl(var(--background))] p-6"><div className="w-full max-w-[480px] text-center page-in"><BrandLockup className="justify-center" /><div className="mx-auto mt-10 flex h-16 w-16 items-center justify-center rounded-[20px] bg-[hsl(var(--accent))] text-white"><Check size={30} /></div><h1 className="mt-7 font-display text-4xl font-bold tracking-[-.05em]">You’re all set.</h1><p className="mx-auto mt-4 max-w-[350px] text-sm leading-6 text-[hsl(var(--muted-foreground))]">{form.action === 'pay' && order.paymentMode !== 'reserve' ? 'Your mock payment and order details were sent to the seller. No real payment was processed.' : 'Your details have been sent to the seller. They’ll be in touch with the next step.'}</p><div className="mt-8 font-mono-ui text-[10px] uppercase tracking-[.15em] text-[hsl(var(--muted-foreground))]">Order reference · {token.slice(0, 8)}</div></div></div>;
  return <div className="min-h-[100dvh] bg-[hsl(var(--background))] px-5 py-8 sm:py-14"><div className="mx-auto max-w-[480px]"><BuyerOrderSurface businessName={businessName} description={seller?.description} productName={order.productName} amount={order.amount} paymentMode={order.paymentMode} depositAmount={order.depositAmount} variants={order.variants} items={order.items}><BuyerOrderForm paymentMode={order.paymentMode} amount={order.amount} depositAmount={order.depositAmount} variants={order.variants} form={form} mockPayment={mockPayment} showMockPayment={showMockPayment} submitPending={submit.isPending} onSubmit={submitForm} onChange={(key, value) => change(key, value)} onMockPaymentChange={(key, value) => setMockPayment((current) => ({ ...current, [key]: value }))} onReferenceImageChange={(event) => { const file = event.target.files?.[0]; if (!file) return; setForm((current) => ({ ...current, image: file.name, imagePreview: URL.createObjectURL(file) })); }} onPaymentAction={(action) => { change('action', action); setShowMockPayment(false); }} /></BuyerOrderSurface><div className="mt-6 text-center font-mono-ui text-[9px] uppercase tracking-[.15em] text-[hsl(var(--muted-foreground))]">Powered by Take Order · made for small businesses</div></div></div>;
}

export function Connect() {
  const health = useHealthCheck();
  const tools: Array<{ name: string; detail: string; markKey: MarkKey; group: string }> = [
    { name: 'WhatsApp', detail: 'Share buyer links in a chat', markKey: 'whatsapp', group: 'Social' },
    { name: 'Instagram', detail: 'Keep sales from DMs easy to trace', markKey: 'instagram', group: 'Social' },
    { name: 'TikTok', detail: 'Tag short-form sales as they happen', markKey: 'tiktok', group: 'Social' },
    { name: 'Facebook Ads', detail: 'Add campaign context to your numbers', markKey: 'facebook_ads', group: 'Social' },
    { name: 'Snapchat', detail: 'Keep your manual channel notes close', markKey: 'snapchat', group: 'Social' },
    { name: 'Paystack', detail: 'Save the payment tool you use', markKey: 'paystack', group: 'Payments' },
    { name: 'Mobile Money', detail: 'Remember your preferred payout rail', markKey: 'mobile_money', group: 'Payments' },
    { name: 'X', detail: 'Keep sales from X in your view', markKey: 'x', group: 'Social' },
  ];
  const [connected, setConnected] = useState<string[]>(readConnectedTools);
  useEffect(() => {
    const storage = getPreferenceStorage();
    if (!storage) return;

    return subscribeToPreferenceChanges(CONNECTED_TOOLS_KEY, (event) => {
      if (event.storageArea && event.storageArea !== storage) return;
      setConnected(readConnectedTools(storage));
    });
  }, []);
  const toggle = (name: string) => setConnected((current) => {
    const next = togglePreference(current, name);
    writeConnectedTools(next);
    return next;
  });
  const clearAll = () => {
    clearConnectedTools();
    setConnected(clearPreferences());
  };
   return <Shell><div className="mx-auto max-w-[1060px]"><div className="mx-auto max-w-[640px] text-center"><div className="font-mono-ui text-[10px] font-bold uppercase tracking-[.18em] text-[hsl(var(--muted-foreground))]">Optional setup</div><h1 className="mt-3 font-display text-[clamp(36px,5vw,58px)] font-bold leading-[.95] tracking-[-.065em]">Let’s get your tools in one view.</h1><p className="mx-auto mt-4 max-w-[560px] text-sm leading-6 text-[hsl(var(--muted-foreground))]">Choose the places you already sell or get paid. This saves a local preference for now — it does not authorize an integration.</p><div className="mt-4 inline-flex items-center gap-2 rounded-full border border-[hsl(var(--accent))]/35 bg-[hsl(var(--accent))]/10 px-3 py-2 text-[11px] font-semibold text-[hsl(var(--accent-foreground))]"><ShieldIcon />Take Order never reads personal chats.</div></div><div className="mt-10 flex flex-col gap-3 border-b border-[hsl(var(--border))] pb-3 sm:flex-row sm:items-center sm:justify-between"><div className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">Your channels and tools</div><div className="flex flex-wrap items-center gap-3"><span className="flex items-center gap-1.5 text-[10px] font-semibold text-[hsl(var(--muted-foreground))]"><span className={cn('h-2 w-2 rounded-full', health.isError ? 'bg-[hsl(var(--destructive))]' : 'bg-[hsl(var(--accent))]')} />{health.isError ? 'Workspace check unavailable' : 'Workspace ready'}</span><Button type="button" variant="outline" onClick={clearAll} disabled={!connected.length} data-testid="button-clear-connected-tools">Clear all saved choices</Button></div></div><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{tools.map((tool) => { const isConnected = connected.includes(tool.name); const mark = markCatalog[tool.markKey]; return <button key={tool.name} onClick={() => toggle(tool.name)} aria-pressed={isConnected} aria-label={connectPreferenceAriaLabel(tool.name, isConnected)} data-testid={`button-connect-${tool.name.toLowerCase().replaceAll(' ', '-')}`} className={cn('tool-tile soft-focus group rounded-[17px] border p-4 text-left', isConnected ? 'border-[hsl(var(--accent))]/55 bg-[hsl(var(--accent))]/10' : 'border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:border-[hsl(var(--muted-foreground))]/45')}><div className="flex items-start justify-between"><div className="tool-mark flex h-11 w-11 items-center justify-center rounded-[13px] bg-[hsl(var(--muted))]" style={{ color: mark.color }}><ChannelMark value={tool.markKey} size={22} /></div><span className={cn('rounded-full px-2 py-1 text-[9px] font-bold', isConnected ? 'bg-[hsl(var(--accent))]/20 text-[hsl(var(--accent-foreground))]' : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]')}>{connectPreferenceLabel(isConnected)}</span></div><div className="mt-5 flex items-end justify-between gap-2"><div><div className="text-sm font-bold">{tool.name}</div><div className="mt-1 text-[11px] leading-4 text-[hsl(var(--muted-foreground))]">{tool.detail}</div></div><span className="font-mono-ui text-[9px] uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">{tool.group}</span></div></button>; })}</div><div className="mt-8 grid gap-4 lg:grid-cols-[1.15fr_.85fr]"><Card className="flex gap-4 p-5"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"><Link2 size={17} /></div><div><h2 className="text-sm font-bold">A connection is never required to sell.</h2><p className="mt-2 text-xs leading-5 text-[hsl(var(--muted-foreground))]">Create buyer links, collect details, and track inventory without connecting a social or payment account. These tiles are simply your setup checklist until real integrations are attached.</p></div></Card><Card className="p-5"><div className="flex items-center gap-2 text-xs font-bold"><Check size={15} className="text-[hsl(var(--accent-foreground))]" />{connected.length ? `${connected.length} tool preference${connected.length === 1 ? '' : 's'} saved` : 'No tool preferences yet'}</div><p className="mt-2 text-[11px] leading-5 text-[hsl(var(--muted-foreground))]">You can change these choices any time. They stay on this device.</p></Card></div></div></Shell>;
}
function ShieldIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3 5 6v5c0 4.5 3 8.2 7 10 4-1.8 7-5.5 7-10V6l-7-3Z" /><path d="m9 12 2 2 4-4" /></svg>; }

function Router() { const [location] = useLocation(); return <ErrorBoundary resetKey={location}><Switch><Route path="/onboarding" component={Onboarding} /><Route path="/" component={HomeRoute} /><Route path="/catalog" component={Catalog} /><Route path="/orders" component={Orders} /><Route path="/reports/channel-conversion" component={ChannelConversionInsight} /><Route path="/reports" component={Reports} /><Route path="/clients" component={Clients} /><Route path="/expenses" component={Expenses} /><Route path="/take-order" component={MultiItemTakeOrderModern} /><Route path="/connect" component={Connect} /><Route path="/o/:token" component={PublicOrderPage} /><Route component={NotFound} /></Switch></ErrorBoundary>; }
function App() { return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>; }
export default App;

const fulfillmentTone = (fulfillment: Order['fulfillment']): 'neutral' | 'mint' | 'blue' =>
  fulfillment === 'delivered' ? 'mint' : fulfillment === 'shipped' ? 'blue' : 'neutral';

type MockPaymentValues = {
  cardNumber: string;
  expiry: string;
  cvc: string;
};

export function BuyerOrderForm({
  paymentMode,
  amount,
  depositAmount,
  variants = [],
  form,
  mockPayment,
  showMockPayment,
  submitPending,
  onSubmit,
  onChange,
  onMockPaymentChange,
  onReferenceImageChange,
  onPaymentAction,
}: {
  paymentMode: 'full' | 'deposit' | 'reserve';
  amount: number;
  depositAmount: number | null | undefined;
  variants?: string[];
  form: BuyerOrderFormValues;
  mockPayment: MockPaymentValues;
  showMockPayment: boolean;
  submitPending: boolean;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onChange: (key: 'name' | 'phone' | 'details', value: string) => void;
  onMockPaymentChange: (key: keyof MockPaymentValues, value: string) => void;
  onReferenceImageChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onPaymentAction: (action: 'pay' | 'reserve') => void;
}) {
  return <form onSubmit={onSubmit} aria-labelledby="buyer-order-form-heading" aria-busy={submitPending} className="space-y-5">
    <div><label htmlFor="buyer-name" className="field-label">Your name</label><input id="buyer-name" data-testid="input-buyer-name" required minLength={1} value={form.name} onChange={(event) => onChange('name', event.target.value)} placeholder="Full name" className="field-input" /></div>
    <div><label htmlFor="buyer-phone" className="field-label">Phone number</label><input id="buyer-phone" data-testid="input-buyer-phone" required minLength={5} value={form.phone} onChange={(event) => onChange('phone', event.target.value)} placeholder="Best number to reach you" className="field-input" /></div>
    {variants.length > 0 && <div><span className="field-label">Available variants</span><div className="flex flex-wrap gap-2" aria-label="Available variants">{variants.map((variant) => <span key={variant} className="rounded-full border border-[hsl(var(--border))] px-3 py-1.5 text-xs">{variant}</span>)}</div></div>}
    <div><label htmlFor="buyer-details" className="field-label">Details for the seller <span className="font-normal text-[hsl(var(--muted-foreground))]">(optional)</span></label><textarea id="buyer-details" data-testid="input-buyer-details" value={form.details} onChange={(event) => onChange('details', event.target.value)} placeholder="Size, color, delivery note, or anything already agreed..." rows={3} className="field-input resize-none" /></div>
    <div><span className="field-label">Reference image <span className="font-normal text-[hsl(var(--muted-foreground))]">(optional)</span></span><label htmlFor="buyer-reference-image" className="flex cursor-pointer items-center gap-3 rounded-[10px] border border-dashed border-[hsl(var(--border))] p-3 text-xs text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]"><Clipboard aria-hidden="true" size={15} />{form.image ? form.image : 'Attach an image'}</label><input id="buyer-reference-image" data-testid="input-buyer-reference-image" aria-label="Reference image" type="file" accept="image/*" className="hidden" onChange={onReferenceImageChange} />{form.imagePreview && <img src={form.imagePreview} alt="Selected reference" className="mt-3 h-28 w-full rounded-[10px] object-cover" />}</div>
    {showMockPayment && <div className="rounded-[13px] border border-[hsl(var(--accent))]/55 bg-[hsl(var(--accent))]/10 p-4 page-in" aria-labelledby="mock-payment-heading"><div className="flex items-center justify-between gap-3"><h3 id="mock-payment-heading" className="flex items-center gap-2 text-sm font-bold"><WalletCards aria-hidden="true" size={16} />Mock payment checkout</h3><StatusPill tone="gold">Demo</StatusPill></div><p className="mt-2 text-[11px] leading-5 text-[hsl(var(--muted-foreground))]">No real charge will be made. Use any test details to continue.</p><div className="mt-4 space-y-3"><div><label htmlFor="mock-card-number" className="field-label">Card number</label><input id="mock-card-number" data-testid="input-mock-card-number" required inputMode="numeric" value={mockPayment.cardNumber} onChange={(event) => onMockPaymentChange('cardNumber', event.target.value)} placeholder="4242 4242 4242 4242" className="field-input" /></div><div className="grid grid-cols-2 gap-3"><div><label htmlFor="mock-expiry" className="field-label">Expiry</label><input id="mock-expiry" data-testid="input-mock-expiry" required value={mockPayment.expiry} onChange={(event) => onMockPaymentChange('expiry', event.target.value)} placeholder="12/30" className="field-input" /></div><div><label htmlFor="mock-cvc" className="field-label">CVC</label><input id="mock-cvc" data-testid="input-mock-cvc" required inputMode="numeric" value={mockPayment.cvc} onChange={(event) => onMockPaymentChange('cvc', event.target.value)} placeholder="123" className="field-input" /></div></div></div></div>}
    {paymentMode !== 'reserve' && <fieldset className="grid grid-cols-2 gap-2" aria-label="Payment options"><legend className="sr-only">Payment options</legend><button type="button" role="radio" aria-checked={form.action === 'pay'} onClick={() => onPaymentAction('pay')} data-testid="button-buyer-pay" className={cn('rounded-[10px] border p-3 text-left text-xs font-bold', form.action === 'pay' ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-white' : 'border-[hsl(var(--border))]')}>{paymentMode === 'deposit' ? `Pay deposit · ${moneyExact(depositAmount)}` : `Pay ${moneyExact(amount)}`}</button><button type="button" role="radio" aria-checked={form.action === 'reserve'} onClick={() => onPaymentAction('reserve')} data-testid="button-buyer-reserve" className={cn('rounded-[10px] border p-3 text-left text-xs font-bold', form.action === 'reserve' ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-white' : 'border-[hsl(var(--border))]')}>Reserve for later</button></fieldset>}
    <Button type="submit" disabled={submitPending} className="w-full py-3.5" data-testid="button-submit-public-order">{submitPending && <Loader2 aria-hidden="true" size={15} className="animate-spin" />}{paymentMode === 'reserve' || form.action === 'reserve' ? 'Reserve these items' : showMockPayment ? 'Complete mock payment' : 'Continue to mock payment'} <ArrowUpRight aria-hidden="true" size={15} /></Button>
  </form>;
}

const connectedToolNames = new Set<string>(CONNECTED_TOOL_NAMES);

const isValidDashboardPeriodPreference = (value: DashboardPeriodPreference): boolean =>
  dashboardPeriods.has(value.period)
  && typeof value.customFrom === 'string'
  && typeof value.customTo === 'string'
  && (value.period !== 'custom'
    || (isValidDashboardDate(value.customFrom) && isValidDashboardDate(value.customTo) && value.customFrom <= value.customTo));

export const writeDashboardPeriodPreference = (
  preference: DashboardPeriodPreference,
  storage: PreferenceStorage | null = getPreferenceStorage(),
) => {
  if (!storage || !isValidDashboardPeriodPreference(preference)) return;
  try {
    storage.setItem(DASHBOARD_PERIOD_KEY, JSON.stringify(preference));
  } catch { /* Storage can be unavailable in privacy-restricted browsers. */ }
};

const isValidDashboardDate = (value: unknown): value is string => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00`);
  return !Number.isNaN(date.getTime()) && inputDate(date) === value;
};

export const readDashboardPeriodPreference = (
  storage: PreferenceStorage | null = getPreferenceStorage(),
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

const invalidateDashboardSummary = (client: QueryClient) => {
  void client.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
};

