import React, { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Link, Redirect, Route, Switch, useLocation, useParams, Router as WouterRouter } from 'wouter';
import { ClerkProvider, SignIn, SignUp, useAuth } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import {
  AlertTriangle, ArrowDown, ArrowDownRight, ArrowLeft, ArrowRight, ArrowUp, ArrowUpRight, BarChart3, Boxes, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Clock3,
  CheckCircle2, CircleDollarSign, Clipboard, Copy, CreditCard, ExternalLink, Eye, FileText, Globe2, LayoutDashboard, Link2, Loader2, Menu, MoreHorizontal,
  ImagePlus, MessageSquare, Package, PackageSearch, Pencil, Plus, Receipt, ReceiptText, RefreshCw, Search, SearchCheck, Settings2, ShoppingBag, SlidersHorizontal, Sparkles, Store,
  Trash2, TrendingUp, Truck, UserRound, Users, UsersRound, WalletCards, Workflow, Wrench, X
} from 'lucide-react';
import { SiFacebook, SiInstagram, SiSnapchat, SiTiktok, SiWhatsapp, SiX } from 'react-icons/si';
import {
  CartesianGrid, Cell, Legend as RechartsLegend, Line, LineChart, Pie, PieChart, ResponsiveContainer,
  Tooltip as RechartsTooltip, XAxis, YAxis
} from 'recharts';
import {
  getGetOrderQueryKey, getGetPublicOrderQueryKey, getListOrdersQueryKey,
  getListProductsQueryKey, getGetDashboardSummaryQueryKey, getListExpensesQueryKey,
  getGetSellerSettingsQueryKey, useGetCurrencyHint,
  useCreateExpense, useCreateOrder, useCreateProduct, useDeleteExpense, useDeleteProduct,
  useGetDashboardSummary, useGetOrder, useGetPublicOrder, useHealthCheck, useListOrders, useListProducts,
  useListExpenses, useGetSellerSettings, useSubmitPublicOrder, useUpdateExpense, useUpdateOrder, useUpdateProduct,
  useUpdateSellerSettings
} from '@workspace/api-client-react';
import type { Expense, ExpenseInput, ExpenseUpdate, Order, OrderInput, Product, ProductInput, ProductPreferenceGroup, PublicOrderInput, SellerSettings } from '@workspace/api-client-react';
import NotFound from '@/pages/not-found';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AnalyticsStateMarker, getAnalyticsViewState } from '@/lib/analytics-state';
import { catalogValue } from '@/lib/catalog-metrics';
import { countryNameForCode, currencyForLanguage, currentCurrency, formatCompactMoney, formatMoney, setActiveCurrency, storeCurrencyOptions } from '@/lib/currency';
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
const runtimeEnv = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env ?? {};

export const CHANNEL_CONVERSION_REFRESH_INTERVAL_MS = 5_000;
const money = (value: number | null | undefined) => formatCompactMoney(value);
const moneyExact = (value: number | null | undefined) => formatMoney(value);
const currencySymbol = () => currentCurrency().symbol;
const number = (value: number | null | undefined) => new Intl.NumberFormat('en-US').format(value || 0);
const dateShort = (value: string | null | undefined) => {
  if (!value) return '—';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
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

function SellerLogo({ businessName, logoDataUrl, className = '' }: { businessName: string; logoDataUrl?: string; className?: string }) {
  if (logoDataUrl) return <img src={logoDataUrl} alt={`${businessName} logo`} className={cn('seller-logo-image object-contain', className)} />;
  return <span className={cn('seller-logo-graphic', className)} role="img" aria-label={`${businessName} graphic logo`}><span>{initials(businessName || 'Shop')}</span><i aria-hidden="true" /></span>;
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

type SellerProfile = { sellerName: string; businessName: string; description: string; channels: string[]; logoDataUrl?: string; currency?: SellerSettings['currency'] | null };
type SellerSettingsPreferences = { orderUpdates: boolean; stockAlerts: boolean; compactTables: boolean };
const ONBOARDING_KEY = 'duka-onboarding-profile';
const ONBOARDING_STEP_KEY = 'duka-onboarding-step';
const ONBOARDING_DONE_KEY = 'duka-onboarding-complete';
export const CONNECTED_TOOLS_KEY = 'duka-connected-tools';
const SELLER_SETTINGS_KEY = 'duka-seller-settings';

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
const defaultSellerPreferences: SellerSettingsPreferences = { orderUpdates: true, stockAlerts: true, compactTables: false };
const readSellerSettings = (): SellerSettingsPreferences => {
  try {
    const value = window.localStorage.getItem(SELLER_SETTINGS_KEY);
    const parsed = value ? JSON.parse(value) as Partial<SellerSettingsPreferences> : {};
    return {
      orderUpdates: parsed.orderUpdates !== false,
      stockAlerts: parsed.stockAlerts !== false,
      compactTables: parsed.compactTables === true,
    };
  } catch { return defaultSellerPreferences; }
};
const writeSellerSettings = (settings: SellerSettingsPreferences) => {
  try { window.localStorage.setItem(SELLER_SETTINGS_KEY, JSON.stringify(settings)); } catch { /* Storage can be unavailable in privacy-restricted browsers. */ }
};
const emptySellerSettings: SellerSettings = {
  sellerName: '',
  businessName: '',
  description: '',
  logoDataUrl: null,
  channels: [],
  currency: 'GHS',
  paymentMode: 'reserve',
  checkoutAskForDetails: true,
  checkoutAllowReferenceImages: true,
  deliveryDefault: 'both',
  deliveryFee: 0,
  customDomain: '',
  seoTitle: '',
  seoDescription: '',
  trackingId: '',
  organizationName: '',
  organizationEmail: '',
  organizationPhone: '',
  organizationCountry: 'gh',
  organizationAddress: '',
  orderUpdates: true,
  stockAlerts: true,
  compactTables: false,
  connectedTools: [],
};
const readOnboardingStep = (): number => {
  try {
    const value = window.localStorage.getItem(ONBOARDING_STEP_KEY);
    const step = Number(value);
    return Number.isInteger(step) && step >= 0 && step <= 3 ? step : 0;
  } catch { return 0; }
};
const readOnboardingComplete = (): boolean | null => {
  try {
    return window.localStorage.getItem(ONBOARDING_DONE_KEY) === 'true';
  } catch {
    return null;
  }
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
      <div className="mt-2 pl-12 font-mono-ui text-[9px] uppercase tracking-[.18em] text-[hsl(var(--sidebar-foreground))]/45">seller workspace</div>
    </div>
    <div className="mx-5 mb-5 h-px bg-[hsl(var(--sidebar-border))]" />
    <div className="px-4 text-[10px] font-semibold uppercase tracking-[.16em] text-[hsl(var(--sidebar-foreground))]/45">Workspace</div>
    <nav aria-label="Seller workspace navigation" className="sidebar-scroll mt-3 flex-1 overflow-y-auto px-3">
      {links.map(({ href, label, icon: Icon }) => <Link key={href} href={href} data-testid={`link-${label.toLowerCase().replaceAll(' ', '-')}`} aria-current={location === href ? 'page' : undefined} className={cn('group mb-1 flex items-center gap-3 rounded-[12px] px-4 py-3 text-[13px] font-medium transition-colors', location === href ? 'bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-accent-foreground))]' : 'text-[hsl(var(--sidebar-foreground))]/60 hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-foreground))]')}>
        <Icon aria-hidden="true" size={17} strokeWidth={location === href ? 2.3 : 1.8} /><span>{label}</span>
      </Link>)}
      <div className="my-5 h-px bg-[hsl(var(--sidebar-border))]" />
      <div className="px-1 text-[10px] font-semibold uppercase tracking-[.16em] text-[hsl(var(--sidebar-foreground))]/45">Settings</div>
      <Link href="/settings" data-testid="link-settings" aria-current={location === '/settings' ? 'page' : undefined} className={cn('mt-3 flex items-center gap-3 rounded-[12px] px-4 py-3 text-[13px] font-medium transition-colors', location === '/settings' ? 'bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-accent-foreground))]' : 'text-[hsl(var(--sidebar-foreground))]/60 hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-foreground))]')}><UserRound aria-hidden="true" size={17} /><span>Profile & settings</span></Link>
      <Link href="/connect" data-testid="link-connect" aria-current={location === '/connect' ? 'page' : undefined} className={cn('mt-1 flex items-center gap-3 rounded-[12px] px-4 py-3 text-[13px] font-medium transition-colors', location === '/connect' ? 'bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-accent-foreground))]' : 'text-[hsl(var(--sidebar-foreground))]/60 hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-foreground))]')}><Settings2 aria-hidden="true" size={17} /><span>Connect tools</span></Link>
    </nav>
      <Link href="/settings" aria-label="Open profile and settings" className="flex items-center gap-3 border-t border-[hsl(var(--sidebar-border))] px-6 py-5 transition-colors hover:bg-[hsl(var(--sidebar-accent))]"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-[hsl(var(--chart-3))] text-[11px] font-bold text-white">{initials(seller?.sellerName || 'Amina Mensah')}</div><div className="min-w-0"><div className="truncate text-[12px] font-semibold">{seller?.sellerName || 'Amina Mensah'}</div><div className="truncate text-[10px] text-[hsl(var(--sidebar-foreground))]/55">{seller?.businessName || 'The Sunday Edit'}</div></div><MoreHorizontal aria-hidden="true" className="ml-auto text-[hsl(var(--sidebar-foreground))]/45" size={16} /></Link>
  </aside>;
}

export function MobileMenuButton({ open, onClick }: { open: boolean; onClick: () => void }) {
  return <button type="button" aria-label={open ? 'Close navigation menu' : 'Open navigation menu'} aria-expanded={open} data-testid="button-mobile-menu" onClick={onClick} className="rounded-lg p-2 hover:bg-black/5">{open ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}</button>;
}

function MobileTopbar() {
  const [open, setOpen] = useState(false);
  const nav = [{ href: '/', label: 'Dashboard' }, { href: '/catalog', label: 'Catalog' }, { href: '/orders', label: 'Orders' }, { href: '/reports', label: 'Reports' }, { href: '/clients', label: 'Clients' }, { href: '/expenses', label: 'Expenses' }, { href: '/take-order', label: 'Take an order' }, { href: '/settings', label: 'Profile & settings' }, { href: '/connect', label: 'Connect tools' }];
  const [location] = useLocation();
  return <div className="mobile-topbar sticky top-0 z-40 items-center justify-between border-b border-[hsl(var(--border))] bg-[hsl(var(--background))]/95 px-5 py-4 backdrop-blur-md"><Link href="/" aria-label="Take Order dashboard"><BrandLockup className="gap-2" /></Link><MobileMenuButton open={open} onClick={() => setOpen(!open)} />{open && <div className="mobile-nav-panel absolute left-0 right-0 top-full border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3 shadow-lg">{nav.map((item) => <Link key={item.href} href={item.href} onClick={() => setOpen(false)} aria-current={location === item.href ? 'page' : undefined} className={cn('block rounded-[10px] px-3 py-3 text-sm transition-colors', location === item.href ? 'bg-[hsl(var(--muted))] font-semibold text-[hsl(var(--foreground))]' : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]')}>{item.label}</Link>)}</div>}</div>;
}

function Shell({ children }: { children: ReactNode }) {
  return <div className="take-order-shell grain"><Sidebar /><MobileTopbar /><main className="page-content min-h-[100dvh] px-5 py-7 md:ml-[246px] md:px-10 md:py-9 lg:px-14">{children}</main></div>;
}

function PageHeading({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="page-heading mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div>{eyebrow && <div className="font-mono-ui text-[10px] font-bold uppercase tracking-[.18em] text-[hsl(var(--muted-foreground))]">{eyebrow}</div>}<h1 className={cn('font-display text-[clamp(28px,3vw,40px)] font-bold leading-[.98] tracking-[-.055em] text-[hsl(var(--foreground))]', eyebrow && 'mt-2')}>{title}</h1>{description && <p className="mt-3 max-w-[540px] text-base leading-7 text-[hsl(var(--muted-foreground))]">{description}</p>}</div>{action}</div>;
}

function Button({ children, variant = 'primary', className, ...props }: { children: ReactNode; variant?: 'primary' | 'soft' | 'outline' | 'danger' | 'ghost'; className?: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} className={cn('inline-flex min-h-10 items-center justify-center gap-2 rounded-[11px] px-4 py-2.5 text-xs font-semibold tracking-[-.01em] transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--ring))] disabled:cursor-not-allowed disabled:opacity-50', variant === 'primary' && 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] shadow-sm hover:-translate-y-px hover:shadow-md', variant === 'soft' && 'bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))] hover:bg-[hsl(var(--muted))]', variant === 'outline' && 'border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--foreground))] hover:border-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]', variant === 'danger' && 'border border-[hsl(var(--foreground))] bg-[hsl(var(--card))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]', variant === 'ghost' && 'border border-transparent bg-transparent text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]', className)} {...props}>{children}</button>;
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
    <button type="button" onClick={onEdit} aria-label={`Edit ${expenseTitle}`} data-testid={`button-edit-expense-${expenseId ?? expenseTitle}`} className="rounded-lg p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--ring))]"><Pencil aria-hidden="true" size={15} /></button>
    <button type="button" onClick={onDelete} disabled={deleteDisabled} aria-label={`Delete ${expenseTitle}`} data-testid={`button-delete-expense-${expenseId ?? expenseTitle}`} className="rounded-lg p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--destructive))]/10 hover:text-[hsl(var(--destructive))] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--ring))]"><Trash2 aria-hidden="true" size={15} /></button>
  </div>;
}

function Card({ children, className = '', ...props }: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>) { return <div {...props} className={cn('app-card', className)}>{children}</div>; }
function Skeleton({ className = '' }: { className?: string }) { return <div className={cn('animate-pulse rounded-lg bg-[hsl(var(--muted))]', className)} />; }
function EmptyState({ icon: Icon, title, description, action, card = false }: { icon: typeof Package; title: string; description?: string; action?: ReactNode; card?: boolean }) { return <div className={cn(card && 'app-card', 'flex flex-col items-center justify-center px-6 py-16 text-center')}><div className="mb-4 flex h-12 w-12 items-center justify-center rounded-[14px] bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"><Icon size={22} /></div><h3 className="font-display text-lg font-bold">{title}</h3>{description && <p className="mt-2 max-w-[340px] text-sm leading-6 text-[hsl(var(--muted-foreground))]">{description}</p>}{action && <div className="mt-5">{action}</div>}</div>; }
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
const fulfillmentLabel = (value: Order['fulfillment']) => value === 'pending' ? 'To ship' : value[0].toUpperCase() + value.slice(1);
type MetricTrend = { direction: 'up' | 'down'; percentage: number | null };
type MetricIndicator = { direction: 'up' | 'down' | 'neutral'; percentage: number; tone?: 'positive' | 'negative' | 'neutral' };
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
  const indicatorTone = trend?.percentage === null || indicator?.tone === 'neutral'
    ? 'metric-trend-neutral'
    : indicator?.tone === 'positive'
      ? 'metric-trend-up'
      : indicator?.tone === 'negative'
        ? 'metric-trend-down'
        : indicatorDirection === 'up' ? 'metric-trend-up' : indicatorDirection === 'down' ? 'metric-trend-down' : 'metric-trend-neutral';
  const indicatorLabel = trend ? (trend.percentage === null ? 'New' : `${isUp ? '+' : '−'}${trend.percentage}%`) : `${indicator?.percentage.toFixed(1)}%`;
  const indicatorAriaLabel = trend ? (trend.percentage === null ? 'New activity' : `${isUp ? 'Up' : 'Down'} ${trend.percentage}%`) : `${indicator?.percentage.toFixed(1)}%`;
  const IndicatorIcon = trend?.percentage === null || indicator?.tone === 'neutral' ? null : indicatorDirection === 'up' ? ArrowUp : indicatorDirection === 'down' ? ArrowDown : null;
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
  const [profile, setProfile] = useState<SellerProfile>(() => readSellerProfile() || { sellerName: '', businessName: '', description: '', channels: [], currency: null });
  const [logoError, setLogoError] = useState('');
  const [onboardingSaveError, setOnboardingSaveError] = useState('');
  const currencyHintQuery = useGetCurrencyHint();
  const settingsQuery = useGetSellerSettings();
  const saveOnboardingSettingsMutation = useUpdateSellerSettings();
  useEffect(() => {
    writeSellerProfile(profile);
  }, [profile]);
  useEffect(() => {
    writeOnboardingStep(step);
  }, [step]);
  useEffect(() => {
    if (profile.currency || currencyHintQuery.isLoading) return;
    const suggestedCurrency = currencyHintQuery.data?.currency
      ?? currencyForLanguage(typeof navigator === 'undefined' ? undefined : navigator.language)?.currency;
    if (suggestedCurrency) setProfile((current) => current.currency ? current : { ...current, currency: suggestedCurrency as SellerSettings['currency'] });
  }, [currencyHintQuery.data?.currency, currencyHintQuery.isLoading, profile.currency]);
  const update = (key: keyof SellerProfile, value: string) => {
    const next = { ...profile, [key]: value };
    setProfile(next);
    writeSellerProfile(next);
  };
  const handleLogoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setLogoError('Choose an image file.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setLogoError('Choose an image smaller than 2 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') return;
      setLogoError('');
      update('logoDataUrl', reader.result);
    };
    reader.onerror = () => setLogoError('That image could not be read. Try another file.');
    reader.readAsDataURL(file);
  };
  const removeLogo = () => {
    const next = { ...profile };
    delete next.logoDataUrl;
    setProfile(next);
    writeSellerProfile(next);
    setLogoError('');
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
  const finishSetup = () => {
    if (!profile.currency) return;
    const existing = settingsQuery.data ?? emptySellerSettings;
    saveOnboardingSettingsMutation.mutate({
      data: {
        ...existing,
        sellerName: profile.sellerName,
        businessName: profile.businessName,
        description: profile.description,
        channels: profile.channels,
        logoDataUrl: profile.logoDataUrl ?? existing.logoDataUrl,
        currency: profile.currency,
      },
    }, {
      onSuccess: (data) => {
        queryClient.setQueryData(getGetSellerSettingsQueryKey(), data);
        setOnboardingSaveError('');
        finishOnboarding();
        changeStep(3);
      },
      onError: (error) => setOnboardingSaveError(error instanceof Error ? error.message : 'Your setup could not be saved. Try again.'),
    });
  };
  const skip = () => { finishOnboarding(); setLocation('/'); };
  const next = () => {
    if (step === 0 && profile.description.trim()) changeStep(1);
    else if (step === 1 && profile.sellerName.trim() && profile.businessName.trim()) changeStep(2);
    else if (step === 2) finishSetup();
  };
  const canContinue = step === 0 ? Boolean(profile.description.trim()) : step === 1 ? Boolean(profile.sellerName.trim() && profile.businessName.trim()) : Boolean(profile.currency);
  const continuationGuidance = step === 0 && !canContinue
    ? 'Add what you sell and where buyers find you before continuing.'
    : step === 1 && !canContinue
      ? 'Add your name and business or shop name before continuing.'
        : step === 2 && !canContinue
          ? 'Choose a base currency before finishing setup.'
      : null;
  const panelCopy = [
    { eyebrow: 'A calmer way to sell', title: 'Keep every order moving.', body: 'Take Order gives your buyers one clear place to choose, confirm, and pay.', note: 'Set up once. Share whenever you are ready.' },
    { eyebrow: 'Your workspace', title: 'Make it recognisably yours.', body: 'A familiar name and mark help every buyer link feel like your business.', note: 'Your details stay private on this device.' },
    { eyebrow: 'Ready when buyers are', title: 'Meet them wherever they find you.', body: 'Your links work alongside the channels you already use — without extra connections.', note: 'Choose as many channels as you like.' },
    { eyebrow: 'You are ready', title: 'One less thing to keep in your head.', body: 'Your workspace is saved. Start with a product, then let Take Order keep the details tidy.', note: 'You can change these preferences later.' },
  ][step];
  return <div className="onboarding-shell">
    <div className="onboarding-layout">
      <section className="onboarding-main" aria-label="Take Order setup">
        <header className="onboarding-header">
          <Link href="/" data-testid="link-onboarding-logo" aria-label="Take Order overview"><BrandLockup className="gap-2" /></Link>
          {step < 3 && <button type="button" onClick={skip} data-testid="button-skip-onboarding" className="onboarding-skip">Skip setup</button>}
        </header>
        <div className="onboarding-form-wrap">
          {step < 3 && <div className="onboarding-progress" aria-label="Setup progress">{[0, 1, 2].map((item) => <span key={item} className={cn(item <= step && 'is-complete')} />)}</div>}
          <div className="onboarding-form-panel">
           {step === 0 && <div className="page-in"><div className="onboarding-kicker">Step one of three</div><h1>Tell us what you sell.</h1><p className="onboarding-lede">A few words is enough. This helps us shape your starting point around the way you already work.</p><textarea autoFocus data-testid="input-onboarding-description" value={profile.description} onChange={(event) => update('description', event.target.value)} placeholder="I sell handmade jewellery, mostly through Instagram and WhatsApp." rows={6} className="field-input onboarding-textarea" /><div className="onboarding-helper"><CheckCircle2 size={15} aria-hidden="true" />No account connections are needed for setup.</div></div>}
           {step === 1 && <div className="page-in"><div className="onboarding-kicker">Step two of three</div><h1>Set up your identity.</h1><p className="onboarding-lede">Use the name buyers know you by. You can always refine your workspace later.</p><div className="onboarding-fields"><div><label className="field-label" htmlFor="onboarding-seller-name">Your name</label><input autoFocus id="onboarding-seller-name" data-testid="input-onboarding-seller-name" value={profile.sellerName} onChange={(event) => update('sellerName', event.target.value)} placeholder="e.g. Amina Mensah" className="field-input" /></div><div><label className="field-label" htmlFor="onboarding-business-name">Business or shop name</label><input id="onboarding-business-name" data-testid="input-onboarding-business-name" value={profile.businessName} onChange={(event) => update('businessName', event.target.value)} placeholder="e.g. The Sunday Edit" className="field-input" /></div><div><div className="field-label">Business logo <span className="font-normal text-[hsl(var(--muted-foreground))]">(optional)</span></div><div className="seller-logo-picker"><SellerLogo businessName={profile.businessName || 'Your shop'} logoDataUrl={profile.logoDataUrl} className="seller-logo-picker-mark" /><div className="min-w-0 flex-1"><div className="text-sm font-semibold">{profile.logoDataUrl ? 'Your logo is ready' : 'Use a logo or our generated graphic'}</div><p className="mt-1 text-xs leading-5 text-[hsl(var(--muted-foreground))]">PNG, JPG, WebP, or SVG up to 2 MB.</p><div className="mt-3 flex flex-wrap gap-2"><label className="onboarding-upload"><ImagePlus size={14} />{profile.logoDataUrl ? 'Replace logo' : 'Upload logo'}<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" tabIndex={-1} className="sr-only" onChange={handleLogoChange} data-testid="input-onboarding-logo" /></label>{profile.logoDataUrl && <button type="button" onClick={removeLogo} className="onboarding-remove" data-testid="button-remove-onboarding-logo"><X size={14} />Remove</button>}</div>{logoError && <p role="alert" className="mt-2 text-xs text-[hsl(var(--destructive))]">{logoError}</p>}</div></div></div></div></div>}
            {step === 2 && <div className="page-in"><div className="onboarding-kicker">Step three of three</div><h1>Set your currency and channels.</h1><p className="onboarding-lede">Your currency is used across your workspace and buyer links. You can change the suggestion before finishing, and later from settings.</p><div className="mb-7"><label className="field-label" htmlFor="onboarding-currency">Base currency</label><select id="onboarding-currency" data-testid="select-onboarding-currency" className="field-input" value={profile.currency ?? ''} onChange={(event) => { setOnboardingSaveError(''); setProfile((current) => ({ ...current, currency: event.target.value as SellerSettings['currency'] })); }}><option value="">Choose a currency</option>{storeCurrencyOptions.map((option) => <option key={option.currency} value={option.currency}>{option.label} ({option.currency})</option>)}</select>{currencyHintQuery.data?.currency && <p className="mt-2 text-xs leading-5 text-[hsl(var(--muted-foreground))]">We think you’re in {countryNameForCode(currencyHintQuery.data.country) ?? 'your current location'} — {storeCurrencyOptions.find((option) => option.currency === currencyHintQuery.data?.currency)?.label ?? currencyHintQuery.data.currency} ({currencyHintQuery.data.currency}) is suggested. You can choose another currency above.</p>}{!currencyHintQuery.isLoading && !currencyHintQuery.data?.currency && !profile.currency && <p className="mt-2 text-xs leading-5 text-[hsl(var(--muted-foreground))]">We could not make a reliable location suggestion. Choose any currency from the full list.</p>}</div><div className="onboarding-channel-area"><div className="field-label mb-3">Where do you usually sell?</div><OnboardingChannelPicker selectedChannels={profile.channels} onToggle={toggleChannel} /></div>{onboardingSaveError && <p role="alert" className="mt-5 text-xs text-[hsl(var(--destructive))]">{onboardingSaveError}</p>}</div>}
           {step === 3 && <div className="page-in onboarding-complete"><div className="onboarding-success"><Check size={22} /></div><div className="onboarding-kicker">Setup complete</div><h1>Your shop has a home.</h1><p className="onboarding-lede">Your preferences are saved locally. Choose the next useful step and Take Order will keep the rest tidy.</p><div className="onboarding-next-steps"><Link href="/catalog" data-testid="link-onboarding-add-item"><span className="step-number">01</span><span><strong>Add your first catalog item</strong><small>Name, price, cost, and stock — that’s the foundation.</small></span><ArrowRight size={16} /></Link><Link href="/connect" data-testid="link-onboarding-connect-tools"><span className="step-number">02</span><span><strong>Review optional tools</strong><small>Save the channels and payment tools you use.</small></span><ArrowRight size={16} /></Link></div><Button onClick={() => setLocation('/')} className="onboarding-open-button" data-testid="button-open-workspace">Open my workspace <ArrowRight size={15} /></Button></div>}
           {step < 3 && <div className="onboarding-actions">
             {continuationGuidance && <p id="onboarding-continue-guidance" role="status" aria-live="polite" aria-atomic="true" className="onboarding-guidance">{continuationGuidance}</p>}
              <div className="onboarding-action-row"><button type="button" onClick={() => step === 0 ? skip() : changeStep(step - 1)} data-testid="button-onboarding-back" className="onboarding-back">{step === 0 ? 'Not now' : <><ArrowLeft size={14} />Back</>}</button><Button onClick={next} disabled={!canContinue || settingsQuery.isLoading || saveOnboardingSettingsMutation.isPending} aria-describedby={continuationGuidance ? 'onboarding-continue-guidance' : undefined} data-testid="button-onboarding-continue">{saveOnboardingSettingsMutation.isPending ? 'Saving…' : step === 2 ? 'Finish setup' : 'Continue'}<ArrowRight size={15} /></Button></div>
           </div>}
          </div>
        </div>
      </section>
      <aside className="onboarding-brand-panel">
        <div className="onboarding-brand-top"><BrandLockup className="onboarding-brand-lockup" /><span className="onboarding-panel-tag">Seller workspace</span></div>
        <div className="onboarding-panel-copy"><div className="onboarding-panel-eyebrow">{panelCopy.eyebrow}</div><h2>{panelCopy.title}</h2><p>{panelCopy.body}</p><div className="onboarding-panel-note"><span className="onboarding-note-dot" />{panelCopy.note}</div></div>
        <div className="onboarding-product-scene" aria-hidden="true"><div className="product-orbit product-orbit-one" /><div className="product-orbit product-orbit-two" /><div className="product-device"><div className="product-device-top"><span>take order</span><span className="product-status"><i />live</span></div><div className="product-device-content"><span className="product-device-label">{step === 3 ? 'Order ready' : step === 2 ? 'Share your link' : 'Your shop'}</span><strong>{profile.businessName || 'Take Order'}</strong><div className="product-device-line" /><div className="product-device-row"><span /><span /><span /></div></div><div className="product-device-base" /></div><div className="product-floating-card"><Link2 size={14} /><span>{step === 3 ? 'Ready to share' : 'One simple link'}</span></div></div>
        <div className="onboarding-panel-footer"><span>01</span><div className="onboarding-panel-dashes">{[0, 1, 2].map((item) => <i key={item} className={cn(item <= Math.min(step, 2) && 'is-active')} />)}</div><span>03</span></div>
      </aside>
    </div>
  </div>;
}

function SignInPage() {
  const basePath = (runtimeEnv.BASE_URL ?? '/').replace(/\/$/, '');
  return <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
    <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
  </div>;
}

function SignUpPage() {
  const basePath = (runtimeEnv.BASE_URL ?? '/').replace(/\/$/, '');
  return <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
    <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
  </div>;
}

function LandingPage() {
  return <div className="onboarding-shell auth-shell">
    <div className="onboarding-layout">
      <section className="onboarding-main" aria-label="Take Order overview">
        <header className="onboarding-header auth-header">
          <Link href="/" data-testid="link-auth-logo" aria-label="Take Order home"><BrandLockup className="gap-2" /></Link>
        </header>
        <div className="onboarding-form-wrap auth-form-wrap">
          <div className="onboarding-form-panel auth-form-panel">
            <div className="onboarding-kicker">Seller workspace</div>
            <h1>Keep every order moving.</h1>
            <p className="onboarding-lede">Take Order gives you one clear place to manage products, share buyer links, and keep your shop organised.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/sign-in" className="auth-submit" data-testid="link-auth-sign-in">Sign in <ArrowRight size={15} aria-hidden="true" /></Link>
              <Link href="/sign-up" className="auth-text-link inline-flex items-center rounded-[10px] border border-[hsl(var(--border))] px-4 py-3" data-testid="link-auth-sign-up">Create an account</Link>
            </div>
            <p className="auth-legal mt-6">Your seller data is private to your account. Buyer order links remain shareable without a seller login.</p>
          </div>
        </div>
      </section>
      <aside className="onboarding-brand-panel auth-brand-panel">
        <div className="onboarding-brand-top"><BrandLockup className="onboarding-brand-lockup" /><span className="onboarding-panel-tag">Seller workspace</span></div>
        <div className="onboarding-panel-copy"><div className="onboarding-panel-eyebrow">A calmer way to sell</div><h2>Your shop should grow, not just run you.</h2><p>Set up your workspace, add products, and send buyers one simple link.</p><div className="onboarding-panel-note"><span className="onboarding-note-dot" />Secure sign-in powered by Clerk.</div></div>
        <div className="onboarding-product-scene" aria-hidden="true"><div className="product-orbit product-orbit-one" /><div className="product-orbit product-orbit-two" /><div className="product-device"><div className="product-device-top"><span>take order</span><span className="product-status"><i />live</span></div><div className="product-device-content"><span className="product-device-label">Your workspace</span><strong>Take Order</strong><div className="product-device-line" /><div className="product-device-row"><span /><span /><span /></div></div><div className="product-device-base" /></div><div className="product-floating-card"><Link2 size={14} /><span>One simple link</span></div></div>
        <div className="onboarding-panel-footer auth-panel-footer"><span>PRIVATE</span><div className="onboarding-panel-dashes"><i className="is-active" /></div><span>TAKE ORDER</span></div>
      </aside>
    </div>
  </div>;
}

function SellerRoute({ children }: { children: ReactNode }) {
  const [, setLocation] = useLocation();
  const { isLoaded, isSignedIn } = useAuth();
  const settingsQuery = useGetSellerSettings({ query: { enabled: isLoaded && isSignedIn, queryKey: getGetSellerSettingsQueryKey() } });
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setLocation('/sign-in');
      return;
    }
    const completed = readOnboardingComplete();
    if (completed === false) setLocation('/onboarding');
    else setReady(true);
  }, [isLoaded, isSignedIn, setLocation]);
  setActiveCurrency(settingsQuery.data?.currency ?? 'GHS');
  if (!isLoaded || !isSignedIn || !ready) return <div className="onboarding-shell flex min-h-[100dvh] items-center justify-center p-6"><div className="w-full max-w-[320px]"><Skeleton className="mx-auto h-10 w-10 rounded-[14px]" /><Skeleton className="mx-auto mt-6 h-8 w-48" /><Skeleton className="mx-auto mt-3 h-3 w-60" /></div></div>;
  return <>{children}</>;
}

function ProtectedRoute({ page: Page }: { page: React.ComponentType }) {
  return <SellerRoute><Page /></SellerRoute>;
}

function HomeRoute() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <div className="onboarding-shell min-h-[100dvh]" />;
  return isSignedIn ? <ProtectedRoute page={Overview} /> : <LandingPage />;
}

function OnboardingRoute() {
  const { isLoaded, isSignedIn } = useAuth();
  const [, setLocation] = useLocation();
  useEffect(() => {
    if (isLoaded && !isSignedIn) setLocation('/sign-in');
  }, [isLoaded, isSignedIn, setLocation]);
  if (!isLoaded || !isSignedIn) return <div className="onboarding-shell min-h-[100dvh]" />;
  return <Onboarding />;
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
  const daily = summary?.dailyPerformance ?? [];
  const products = productsQuery.data ?? [];
  const orders = ordersQuery.data ?? [];
  const periodOrders = useMemo(() => periodRange ? orders.filter((order) => {
    const date = new Date(order.createdAt).toISOString().slice(0, 10);
    return date >= periodRange.from && date <= periodRange.to;
  }) : orders, [orders, periodRange]);
  const lowStock = products.filter((product) => product.stock <= 3);
  const missingCosts = products.filter((product) => product.cost == null);
  const namedClients = new Set(periodOrders.map((order) => order.customerName?.trim()).filter(Boolean)).size;
  const waitingPayments = periodOrders.filter((order) => order.status === 'reserved' || order.status === 'deposit_paid').length;
  const shippedOrders = periodOrders.filter((order) => order.fulfillment === 'shipped' || order.fulfillment === 'delivered').length;
  const paidConversion = periodOrders.length ? Math.round(((summary?.orders ?? 0) / periodOrders.length) * 100) : 0;
  const firstDay = daily[0]?.label;
  const lastDay = daily[daily.length - 1]?.label;
  const dateContext = firstDay && lastDay ? `${firstDay} – ${lastDay}` : 'Your latest reporting window';
  const recentDaily = daily.slice(Math.ceil(daily.length / 2));
  const earlierDaily = daily.slice(0, Math.ceil(daily.length / 2));
  const movement = (key: 'orders' | 'revenue'): MetricTrend | undefined => {
    const recent = recentDaily.reduce((sum, day) => sum + day[key], 0);
    const earlier = earlierDaily.reduce((sum, day) => sum + day[key], 0);
    if (earlier === 0) return recent > 0 ? { direction: 'up', percentage: null } : undefined;
    const percentage = Math.round(((recent - earlier) / earlier) * 100);
    return { direction: percentage >= 0 && recent > 0 ? 'up' : 'down', percentage: Math.abs(percentage) };
  };
  const salesTrend = movement('orders');
  const revenueTrend = movement('revenue');
  const primaryStatCards: DashboardStatCard[] = [
    { label: 'Sales', value: ordersQuery.isLoading ? '—' : periodOrders.length, trend: salesTrend, note: `${paidConversion}% paid conversion · ${waitingPayments} waiting payments` },
    { label: 'Revenue', value: money(summary?.revenue), trend: revenueTrend, note: 'Money received from recorded orders' },
    { label: 'Outstanding balances', value: money(summary?.outstanding), note: `${waitingPayments} waiting payments` },
    { label: 'Orders', value: summary?.orders ?? 0, trend: movement('orders'), note: `${shippedOrders} shipped` },
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
     {(productsQuery.isError || ordersQuery.isError) && <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-[hsl(var(--destructive))]/20 bg-[hsl(var(--destructive))]/5 px-4 py-3 text-xs text-[hsl(var(--destructive))]" role="alert" data-testid="status-dashboard-auxiliary-error"><span>Some dashboard lists could not be refreshed, so related counts may be incomplete.</span><div className="flex gap-3">{productsQuery.isError && <button type="button" className="font-bold underline" onClick={() => productsQuery.refetch()}>Retry catalog</button>}{ordersQuery.isError && <button type="button" className="font-bold underline" onClick={() => ordersQuery.refetch()}>Retry orders</button>}</div></div>}
     {summaryQuery.isLoading && !summaryQuery.data ? <OverviewSkeleton /> : summaryQuery.isError && !summaryQuery.data ? <ErrorState retry={() => summaryQuery.refetch()} /> : <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
         {primaryStatCards.map((stat, index) => <MetricCard key={`${stat.label}-${index}`} className="rise-in" style={{ animationDelay: `${index * 55}ms` }} dataTestId={`card-kpi-${stat.label.toLowerCase().replaceAll(' ', '-')}`} label={stat.label} value={stat.value} valueAccessory={stat.valueAccessory} trend={stat.trend} indicator={stat.indicator} note={stat.note} period={periodLabel} loading={summaryRefreshing} />)}
      </div>
         <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(300px,.8fr)]">
          <Card className="p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="font-mono-ui text-[10px] uppercase tracking-[.15em] text-[hsl(var(--muted-foreground))]">Cash flow</div><h2 className="mt-2 font-display text-xl font-bold tracking-[-.035em]">Revenue, costs, and net profit</h2><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Product costs and shop expenses stay separate</p></div><div className="rounded-[10px] border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 font-mono-ui text-[10px] text-[hsl(var(--muted-foreground))]">{periodLabel}</div></div><div className="mt-6 h-[280px]" data-testid="chart-cash-flow" aria-busy={summaryRefreshing}>{summaryRefreshing ? <div className="flex h-full flex-col justify-center gap-4"><Skeleton className="h-3 w-28" /><Skeleton className="h-48 w-full" /></div> : daily.length ? <ResponsiveContainer width="100%" height="100%" debounce={0}><LineChart data={daily} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}><CartesianGrid strokeDasharray="3 4" stroke="hsl(220 16% 86% / .7)" vertical={false} /><XAxis dataKey="label" tick={{ fontSize: 12, fill: '#68717d' }} stroke="#aeb5bd" tickLine={false} axisLine={false} /><YAxis tick={{ fontSize: 12, fill: '#68717d' }} stroke="#aeb5bd" tickLine={false} axisLine={false} tickFormatter={(value) => money(value)} width={58} /><RechartsTooltip content={<AnalyticsTooltip />} cursor={{ stroke: '#9ca6b2', strokeDasharray: '3 3' }} isAnimationActive={false} /><RechartsLegend wrapperStyle={{ fontSize: '12px', paddingTop: '12px' }} /><Line type="monotone" dataKey="revenue" name="Revenue" stroke="#c9943d" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} isAnimationActive={false} /><Line type="monotone" dataKey="productCosts" name="Product costs" stroke="#b66b77" strokeWidth={2} dot={false} activeDot={{ r: 5 }} isAnimationActive={false} /><Line type="monotone" dataKey="operatingExpenses" name="Shop expenses" stroke="#7b83b7" strokeWidth={2} dot={false} activeDot={{ r: 5 }} isAnimationActive={false} /><Line type="monotone" dataKey="expenses" name="Total costs" stroke="#c47763" strokeWidth={2} dot={false} activeDot={{ r: 5 }} isAnimationActive={false} /><Line type="monotone" dataKey="profit" name="Net profit" stroke="#438879" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} isAnimationActive={false} /></LineChart></ResponsiveContainer> : <ChartEmpty message="Cash-flow data will appear after your first activity." />}</div></Card>
         <AlertsRail outstanding={summary?.outstanding ?? 0} lowStock={lowStock} missingCosts={missingCosts} productLoading={productsQuery.isLoading} productCount={products.length} orderCount={periodOrders.length} loading={summaryRefreshing} />
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
         <MetricCard className="rise-in" dataTestId="card-report-tracked-profit" label="Reported profit" value={<span data-testid="text-report-profit">{money(summary?.profit)}</span>} note={summary?.legacyOrders ? `${summary.legacyOrders} older ${summary.legacyOrders === 1 ? 'sale uses' : 'sales use'} an estimated cost instead of the exact cost at the time.` : 'Revenue less product costs and shop expenses.'} />
         <MetricCard className="rise-in" style={{ animationDelay: '55ms' }} dataTestId="card-report-cash-balance" label="Cash balance" value={<span data-testid="text-report-cash-balance">{money(summary?.cashBalance)}</span>} note="Money left after recorded payments and shop expenses." />
        <MetricCard className="rise-in" style={{ animationDelay: '110ms' }} dataTestId="card-report-context" label="Reporting window" value={money(summary?.revenue)} note={`${summary?.orders ?? 0} recorded orders${summary?.bestSeller ? ` · ${summary.bestSeller} leads` : ''}`} />
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

function ChannelConversionStats({ channel }: { channel: ChannelPerformanceRow }) {
  const offline = channel.channel === 'in_person';
  return <>
    <div className="channel-conversion-stat"><span>Orders</span><strong className="data-value">{number(channel.paidOrders)}</strong></div>
    <div className="channel-conversion-stat"><span>Revenue</span><strong className="data-value">{money(channel.revenue)}</strong></div>
    {!offline && <div className="channel-conversion-stat"><span>Views</span><strong className="data-value">{number(channel.opens)}</strong></div>}
    {!offline && <div className="channel-conversion-rate"><span>Conversion</span><strong className="data-value">{channel.conversionRate.toFixed(1)}%</strong></div>}
  </>;
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
        <div className={cn('channel-conversion-row-top', channel.channel === 'in_person' && 'is-offline')}>
          <div className="channel-conversion-identity">
            <span className="channel-conversion-mark"><ChannelMark value={channel.channel} size={18} /></span>
            <ChannelLabel value={channel.channel} className="channel-conversion-name" />
          </div>
          <ChannelConversionStats channel={channel} />
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
  const summaryRefreshing = summaryQuery.isFetching && !summaryQuery.isLoading && Boolean(summaryQuery.data);

  return <Shell>
    <PageHeading title="Channel conversion" action={<Link href="/"><Button variant="outline"><ArrowLeft size={15} />Back to dashboard</Button></Link>} />
    {summaryQuery.isLoading ? <div className="space-y-5" aria-label="Loading channel conversion"><div className="reports-metric-grid">{[1, 2, 3, 4].map((item) => <Card key={item} className="h-[132px] p-5"><Skeleton className="h-3 w-24" /><Skeleton className="mt-6 h-8 w-28" /><Skeleton className="mt-3 h-3 w-36" /></Card>)}</div><Card className="space-y-4 p-6"><Skeleton className="h-5 w-44" /><Skeleton className="h-14 w-full" /><Skeleton className="h-14 w-full" /><Skeleton className="h-14 w-full" /></Card></div> : summaryQuery.isError ? <ErrorState retry={() => summaryQuery.refetch()} /> : <div className="channel-insight-page space-y-5">
       <ChannelConversionRefreshStatus refreshing={summaryRefreshing} />
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
          <div className="channel-insight-list-head" aria-hidden="true"><span>Channel</span><span>Orders</span><span>Revenue</span><span>Views</span><span>Conversion</span></div>
          {visibleChannels.map((channel) => <article key={channel.channel} className="channel-insight-row" data-testid={`row-channel-insight-${channel.channel}`} aria-label={channel.channel === 'in_person' ? `${channelName(channel.channel)}: ${number(channel.paidOrders)} orders, ${money(channel.revenue)}` : `${channelName(channel.channel)}: ${number(channel.opens)} views, ${number(channel.paidOrders)} orders, ${money(channel.revenue)}, ${channel.conversionRate.toFixed(1)}% conversion`}>
            <div className="channel-insight-identity"><span className="channel-conversion-mark"><ChannelMark value={channel.channel} size={19} /></span><ChannelLabel value={channel.channel} className="channel-conversion-name" /></div>
             <strong className="channel-insight-number data-value" data-label="Orders">{number(channel.paidOrders)}</strong>
             <strong className="channel-insight-number data-value" data-label="Revenue">{money(channel.revenue)}</strong>
             {channel.channel === 'in_person' ? <><span aria-hidden="true" /><span aria-hidden="true" /></> : <><strong className="channel-insight-number data-value" data-label="Views">{number(channel.opens)}</strong><div className="channel-insight-conversion"><strong className="data-value" data-label="Conversion">{channel.conversionRate.toFixed(1)}%</strong><span className="channel-insight-progress"><span style={{ width: `${Math.min(100, Math.max(0, channel.conversionRate))}%` }} /></span></div></>}
          </article>)}
        </div> : <div className="p-6"><EmptyState icon={BarChart3} title="No channel activity yet" description="Share a buyer link to start building channel conversion insight." /></div>}
      </Card>
      <div className="flex items-start gap-3 rounded-[12px] border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/55 px-4 py-3 text-[11px] leading-5 text-[hsl(var(--muted-foreground))]"><CircleDollarSign size={15} className="mt-0.5 shrink-0 text-[hsl(var(--accent-foreground))]" aria-hidden="true" /><span><strong className="text-[hsl(var(--foreground))]">How to read this:</strong> Conversion is paid sales divided by recorded views. Channels are ranked by views so you can see where attention is concentrated before comparing sales and revenue.</span></div>
    </div>}
  </Shell>;
}

export function ChannelConversionRefreshStatus({ refreshing }: { refreshing: boolean }) {
  if (!refreshing) return <div className="channel-insight-refresh-row" aria-hidden="true" />;
  return <div className="channel-insight-refresh-row" role="status" aria-live="polite" aria-atomic="true" data-testid="status-channel-conversion-refresh">
    <span className="channel-insight-refresh-status"><Loader2 size={13} aria-hidden="true" className="animate-spin" />Updating channel conversion data</span>
  </div>;
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
  return <Card className="recent-transactions-card list-card mt-5 overflow-hidden">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[hsl(var(--border))] px-5 py-5 sm:px-6"><div><div className="font-mono-ui text-[10px] uppercase tracking-[.15em] text-[hsl(var(--muted-foreground))]">Latest activity</div><h2 className="mt-2 font-display text-xl font-bold tracking-[-.035em]">Recent transactions</h2></div><Link href="/orders" data-testid="link-see-all-orders"><Button variant="ghost">See all <ArrowUpRight size={15} /></Button></Link></div>
     <div className="list-toolbar filter-surface"><div className="list-filter-tabs" role="group" aria-label="Recent transaction filters">{filterOptions.map((option) => <button type="button" key={option.value} onClick={() => setFilter(option.value)} aria-pressed={filter === option.value} className={cn('list-filter-tab', filter === option.value && 'is-active')}>{option.label}</button>)}</div><div className="list-search-shell"><Search className="pointer-events-none absolute left-2.5 top-2.5 text-[hsl(var(--muted-foreground))]" size={14} /><input aria-label="Search recent transactions" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search" className="list-search-input" /></div></div>
     {query.isLoading ? <div className="space-y-4 p-6"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div> : query.isError ? <div className="p-6"><ErrorState retry={() => query.refetch()} /></div> : orders.length ? <div className="overflow-x-auto"><table className="list-table w-full min-w-[780px] text-left"><thead><tr><th className="px-5 py-3 sm:px-6">Order ID</th><th className="px-4 py-3">Buyer / item</th><th className="px-4 py-3 text-center">Traffic</th><th className="px-4 py-3">Placed</th><th className="px-4 py-3">Order value</th><th className="px-5 py-3 sm:px-6">Payment</th></tr></thead><tbody>{orders.map((order) => <tr key={order.id} className="transaction-row" data-testid={`row-transaction-${order.id}`}><td className="px-5 py-4 sm:px-6" data-testid={`text-transaction-order-id-${order.id}`}><Link href={`/orders/${order.id}`} className="orders-order-id orders-order-id-link" data-testid={`link-recent-order-${order.id}`} aria-label={`Open order ${order.id}`}>#{String(order.id).padStart(7, '0')}</Link></td><td className="px-4 py-4"><div className="flex items-center gap-3"><div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[hsl(var(--muted))] font-mono-ui text-[10px] font-bold">{initials(order.customerName || order.productName)}</div><div><div className="text-sm font-semibold">{order.customerName || 'Buyer pending'}</div><div className="mt-0.5 text-[11px] text-[hsl(var(--muted-foreground))]">{order.productName}</div></div></div></td><td className="px-4 py-4"><div className="orders-traffic-cell"><span className="orders-traffic-icon" data-testid={`text-transaction-traffic-${order.id}`} title={channelName(order.channel)} aria-label={`Traffic source: ${channelName(order.channel)}`}><ChannelMark value={order.channel} size={17} /></span></div></td><td className="px-4 py-4 text-sm text-[hsl(var(--muted-foreground))]">{dateShort(order.createdAt)}</td><td className="data-value px-4 py-4 text-xs">{moneyExact(order.amount)}</td><td className="px-5 py-4 sm:px-6"><StatusPill tone={paymentTone(order.status)}>{paymentLabel(order)}</StatusPill></td></tr>)}</tbody></table></div> : <div className="p-8"><EmptyState icon={ShoppingBag} title="No transactions match" description="Try another filter or search." action={<Link href="/take-order"><Button><Plus size={15} />Create a link</Button></Link>} /></div>}
  </Card>;
}

function OrderRow({ order, compact = false }: { order: Order; compact?: boolean }) {
  return <div className={cn('flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between', compact && 'py-3.5')} data-testid={`row-order-${order.id}`}><div className="flex items-center gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-[hsl(var(--muted))] font-mono-ui text-[10px] font-bold">{initials(order.customerName || order.productName)}</div><div><div className="text-sm font-semibold">{order.customerName || 'Buyer pending'}</div><div className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">{order.productName} · <ChannelInline value={order.channel} /></div></div></div><div className="flex items-center gap-4 pl-12 sm:pl-0"><div className="text-right"><div className="font-mono-ui text-xs font-bold">{moneyExact(order.amount)}</div><div className="mt-1 text-[10px] text-[hsl(var(--muted-foreground))]">{dateShort(order.createdAt)}</div></div><StatusPill tone={paymentTone(order.status)}>{order.status.replace('_', ' ')}</StatusPill></div></div>;
}

type ProductPreferenceDraft = { label: string; options: string };
type ProductCustomFieldDraft = { label: string; value: string };
type ProductFormState = { name: string; category: string; sku: string; description: string; price: string; compareAtPrice: string; cost: string; stock: string; preferences: ProductPreferenceDraft[]; customFields: ProductCustomFieldDraft[]; imageUrl: string; imageUrls: string; accent: string };
const blankProduct: ProductFormState = { name: '', category: 'Apparel', sku: '', description: '', price: '', compareAtPrice: '', cost: '', stock: '0', preferences: [], customFields: [], imageUrl: '', imageUrls: '', accent: '#E6B85C' };
const PRODUCT_IMAGE_MAX_BYTES = 2 * 1024 * 1024;
const PRODUCT_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const isProductImageValue = (value: string) => /^https?:\/\//i.test(value) || /^data:image\/(png|jpeg|webp|gif);base64,/i.test(value);
const accentOptions = [
  { value: '#E6B85C', label: 'gold' },
  { value: '#8BBDA9', label: 'green' },
  { value: '#D79AA9', label: 'rose' },
  { value: '#96A8CE', label: 'blue' },
  { value: '#D99566', label: 'orange' },
] as const;

type ReferenceProductEditorProps = {
  product?: Product;
  fullPage: boolean;
  form: ProductFormState;
  pending: boolean;
  error: string;
  hasMutationError: boolean;
  onClose: () => void;
  onSubmit: (event: React.FormEvent) => void;
  change: (key: keyof ProductFormState, value: string) => void;
  setForm: React.Dispatch<React.SetStateAction<ProductFormState>>;
  updatePreference: (index: number, key: keyof ProductPreferenceDraft, value: string) => void;
  imageError: string;
  onImageChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveImage: () => void;
};

function ReferenceProductEditor({
  product,
  fullPage,
  form,
  pending,
  error,
  hasMutationError,
  onClose,
  onSubmit,
  change,
  setForm,
  updatePreference,
  imageError,
  onImageChange,
  onRemoveImage,
}: ReferenceProductEditorProps) {
  const [expandedProduct, setExpandedProduct] = useState(false);
  const addOption = () => setForm((current) => ({
    ...current,
    preferences: [...current.preferences, { label: '', options: '' }],
  }));

  const content = <div className="product-reference-editor">
    <header className="product-reference-header">
      <button type="button" className="product-back-button" onClick={onClose} aria-label="Back to catalog" data-testid="button-back-product">
        <ArrowLeft size={20} aria-hidden="true" />
      </button>
      <h1>{product ? 'Product' : 'Product'}</h1>
    </header>

    <form className="product-reference-layout" onSubmit={onSubmit}>
      <div className="product-reference-main">
        <section className="product-reference-card product-details-card">
          <h2>Product</h2>
          <div className="product-reference-field">
            <label htmlFor="product-name-reference">Name <span aria-hidden="true">*</span></label>
            <input id="product-name-reference" data-testid="input-product-name" autoFocus required value={form.name} onChange={(event) => change('name', event.target.value)} placeholder="Name" />
          </div>
          <div className="product-reference-two-up">
            <div className="product-reference-field">
              <label htmlFor="product-category-reference">Category <span aria-hidden="true">*</span></label>
              <input id="product-category-reference" data-testid="select-product-category" list="product-category-options" value={form.category} onChange={(event) => change('category', event.target.value)} placeholder="Search or create category" required />
              <datalist id="product-category-options">
                <option value="Apparel" />
                <option value="Accessories" />
                <option value="Home" />
                <option value="Beauty" />
                <option value="Food & drink" />
                <option value="Other" />
              </datalist>
            </div>
          </div>
          <div className="product-reference-field product-reference-description">
            <div className="product-reference-label-row">
              <label htmlFor="product-description-reference">Description <span className="product-info-mark" title="Shown to buyers">i</span></label>
              <span className="product-magic-mark" aria-hidden="true"><Sparkles size={13} /></span>
            </div>
             <textarea id="product-description-reference" value={form.description} onChange={(event) => change('description', event.target.value)} placeholder="" rows={5} />
          </div>
          <div className="product-reference-field">
            <div className="product-reference-label-row">
              <label>Images</label>
              <span className="product-magic-mark" aria-hidden="true"><Sparkles size={13} /></span>
            </div>
             <div className="product-image-upload">
               <label htmlFor="product-image-upload" className="product-upload-button"><ImagePlus size={14} />{form.imageUrl ? 'Replace image' : 'Upload image'}</label>
               <input id="product-image-upload" data-testid="input-product-image" type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" onChange={onImageChange} />
               <span className="product-image-upload-note">PNG, JPG, WebP, or GIF up to 2 MB.</span>
             </div>
             {form.imageUrl && <div className="product-image-preview"><img src={form.imageUrl} alt="Product preview" /><span>Image ready</span><button type="button" onClick={onRemoveImage} data-testid="button-remove-product-image">Remove</button></div>}
             {imageError && <p className="product-reference-error" role="alert" data-testid="status-product-image-error">{imageError}</p>}
          </div>
          <button type="button" className="product-more-button" onClick={() => setExpandedProduct(!expandedProduct)} aria-expanded={expandedProduct}>
            <ChevronRight size={15} className={cn(expandedProduct && 'rotate-90')} aria-hidden="true" />More options
          </button>
          {expandedProduct && <div className="product-reference-more-fields">
            <div className="product-reference-field">
              <label>Accent color</label>
              <div className="product-accent-options">{accentOptions.map(({ value, label }) => <button type="button" key={value} onClick={() => change('accent', value)} aria-label={`Use ${label} accent color`} aria-pressed={form.accent === value} className={cn('product-accent-swatch', form.accent === value && 'is-selected')} style={{ backgroundColor: value }} />)}</div>
            </div>
          </div>}
        </section>

        <section className="product-reference-card product-pricing-card">
          <h2>Pricing</h2>
          <div className="product-reference-two-up">
            <div className="product-reference-field">
              <label htmlFor="product-price-reference">Price</label>
              <div className="product-currency-input"><span>{currencySymbol()}</span><input id="product-price-reference" data-testid="input-product-price" type="number" min="0" step=".01" required value={form.price} onChange={(event) => change('price', event.target.value)} placeholder="0" /></div>
            </div>
            <div className="product-reference-field">
              <label htmlFor="product-cost-reference">Cost price <span className="product-info-mark" title="Your buying price, used for profit estimates">i</span></label>
              <div className="product-currency-input"><span>{currencySymbol()}</span><input id="product-cost-reference" data-testid="input-product-cost" type="number" min="0" step=".01" value={form.cost} onChange={(event) => change('cost', event.target.value)} placeholder="Not tracked" /></div>
              <p className="product-reference-help">Your buying price, used for profit estimates.</p>
            </div>
          </div>
          <div className="product-reference-field product-compare-price-field">
            <label htmlFor="product-compare-price-reference">Original price <span className="product-info-mark" title="Optional original price">i</span></label>
            <div className="product-currency-input"><span>{currencySymbol()}</span><input id="product-compare-price-reference" data-testid="input-product-compare-price" type="number" min="0" step=".01" value={form.compareAtPrice} onChange={(event) => change('compareAtPrice', event.target.value)} placeholder="0" /></div>
          </div>
        </section>

        <section className="product-reference-section">
           <div className="product-section-heading"><div><h2>Buyer options</h2><p>Give buyers choices such as Color or Size.</p></div><div className="product-inline-action"><button type="button" onClick={addOption}><Plus size={17} aria-hidden="true" /><strong>Add option</strong></button></div></div>
           {form.preferences.length > 0 ? <div className="product-reference-options-list">{form.preferences.map((preference, index) => <div className="product-reference-option-row" key={`option-${index}`}><input aria-label={`Option ${index + 1} name`} required value={preference.label} onChange={(event) => updatePreference(index, 'label', event.target.value)} placeholder="Option name, e.g. Color" /><input aria-label={`Option ${index + 1} values`} required value={preference.options} onChange={(event) => updatePreference(index, 'options', event.target.value)} placeholder="Values separated by commas" /><button type="button" onClick={() => setForm((current) => ({ ...current, preferences: current.preferences.filter((_, preferenceIndex) => preferenceIndex !== index) }))} aria-label={`Remove option ${index + 1}`}><X size={15} /></button></div>)}</div> : <p className="product-reference-help">No buyer options. The item can be added directly to an order.</p>}
        </section>
        {(error || hasMutationError) && <div className="product-reference-error" role="alert" data-testid="status-product-form-error">{error || 'This item could not be saved. Try again.'}</div>}
        <div className="product-reference-actions">
          <button type="button" className="product-cancel-button" onClick={onClose}>Cancel</button>
          <button type="submit" className="product-save-button" disabled={pending} data-testid="button-save-product">{pending && <Loader2 size={15} className="animate-spin" />}Save</button>
        </div>
      </div>

       <aside className="product-reference-sidebar">
        <section className="product-reference-card product-side-card">
           <div className="product-side-heading"><h2>Inventory</h2></div>
           <div className="product-reference-field product-sku-field"><label htmlFor="product-sku-reference">SKU <span className="product-info-mark" title="Optional internal reference">?</span></label><input id="product-sku-reference" data-testid="input-product-sku" value={form.sku} onChange={(event) => change('sku', event.target.value)} placeholder="Optional SKU" /></div>
           <div className="product-reference-field"><label htmlFor="product-stock-reference">Stock on hand</label><input id="product-stock-reference" data-testid="input-product-stock" type="number" min="0" step="1" required value={form.stock} onChange={(event) => change('stock', event.target.value)} placeholder="0" /></div>
        </section>
      </aside>
    </form>
  </div>;

  return fullPage
    ? <div className="catalog-editor-page">{content}</div>
    : <div className="fixed inset-0 z-50 flex items-end justify-center bg-[hsl(220_30%_17%/.45)] p-0 backdrop-blur-sm sm:items-center sm:p-5"><div className="product-reference-modal">{content}</div></div>;
}

export function ProductModal({ product, onClose, fullPage = false }: { product?: Product; onClose: () => void; fullPage?: boolean }) {
  const queryClient = useQueryClient();
  const create = useCreateProduct(); const update = useUpdateProduct();
  const [error, setError] = useState('');
  const [imageError, setImageError] = useState('');
  const [form, setForm] = useState<ProductFormState>(product ? {
    name: product.name,
    category: product.category,
     sku: product.sku ?? '',
     description: product.description ?? '',
    price: String(product.price),
     compareAtPrice: product.compareAtPrice == null ? '' : String(product.compareAtPrice),
    cost: product.cost == null ? '' : String(product.cost),
    stock: String(product.stock),
    preferences: product.preferences.length
      ? product.preferences.map((group) => ({ label: group.label, options: group.options.join(', ') }))
      : product.variants.length
        ? [{ label: 'Option', options: product.variants.join(', ') }]
        : [],
     customFields: product.customFields.map((field) => ({ label: field.label, value: field.value })),
    imageUrl: product.imageUrl ?? '',
      imageUrls: product.imageUrls?.filter((url) => url !== product.imageUrl).join('\n') || '',
    accent: product.accent,
  } : blankProduct);
  const pending = create.isPending || update.isPending;
  const change = (key: keyof ProductFormState, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const updatePreference = (index: number, key: keyof ProductPreferenceDraft, value: string) => setForm((current) => ({ ...current, preferences: current.preferences.map((preference, preferenceIndex) => preferenceIndex === index ? { ...preference, [key]: value } : preference) }));
  const updateCustomField = (index: number, key: keyof ProductCustomFieldDraft, value: string) => setForm((current) => ({ ...current, customFields: current.customFields.map((field, fieldIndex) => fieldIndex === index ? { ...field, [key]: value } : field) }));
  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!PRODUCT_IMAGE_TYPES.has(file.type)) {
      setImageError('Choose a PNG, JPG, WebP, or GIF image.');
      return;
    }
    if (file.size > PRODUCT_IMAGE_MAX_BYTES) {
      setImageError('Choose an image smaller than 2 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        setImageError('That image could not be read. Try another file.');
        return;
      }
      setImageError('');
      setForm((current) => ({ ...current, imageUrl: reader.result as string, imageUrls: '' }));
    };
    reader.onerror = () => setImageError('That image could not be read. Try another file.');
    reader.readAsDataURL(file);
  };
  const removeImage = () => {
    setForm((current) => ({ ...current, imageUrl: '', imageUrls: '' }));
    setImageError('');
  };
  const save = (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setImageError('');
    const preferences: ProductPreferenceGroup[] = form.preferences
      .map((preference) => ({
        label: preference.label.trim(),
        options: Array.from(new Set(preference.options.split(',').map((option) => option.trim()).filter(Boolean))),
      }))
      .filter((preference) => preference.label && preference.options.length > 0);
    const price = Number(form.price);
    const compareAtPrice = form.compareAtPrice.trim() === '' ? null : Number(form.compareAtPrice);
    const cost = form.cost.trim() === '' ? null : Number(form.cost);
    const stock = Number(form.stock);
    const imageUrls = Array.from(new Set([form.imageUrl.trim(), ...form.imageUrls.split(/[\n,]+/).map((url) => url.trim()).filter(Boolean)].filter(Boolean)));
    const invalidImageUrl = imageUrls.find((url) => !isProductImageValue(url));
    if (!form.name.trim() || !form.category.trim() || !Number.isFinite(price) || price < 0 || (compareAtPrice !== null && (!Number.isFinite(compareAtPrice) || compareAtPrice < 0)) || (cost !== null && (!Number.isFinite(cost) || cost < 0)) || !Number.isInteger(stock) || stock < 0) {
      setError('Add a name, category, valid price, and non-negative whole-number stock.');
      return;
    }
    if (invalidImageUrl) {
      setError('Choose a valid product image.');
      return;
    }
    const data: ProductInput = { name: form.name.trim(), category: form.category.trim(), sku: form.sku.trim() || null, description: form.description.trim() || null, price, compareAtPrice, cost, stock, variants: preferences.flatMap((preference) => preference.options), preferences, customFields: product?.customFields ?? [], imageUrl: imageUrls[0] || null, imageUrls, accent: form.accent };
    const onSuccess = () => {
      void queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
      invalidateDashboardSummary(queryClient);
      onClose();
    };
    const onError = (mutationError: unknown) => setError(mutationError instanceof Error && mutationError.message ? mutationError.message : 'This item could not be saved. Try again.');
    product ? update.mutate({ id: product.id, data }, { onSuccess, onError }) : create.mutate({ data }, { onSuccess, onError });
  };
   return <ReferenceProductEditor product={product} fullPage={fullPage} form={form} pending={pending} error={error} hasMutationError={create.isError || update.isError} onClose={onClose} onSubmit={save} change={change} setForm={setForm} updatePreference={updatePreference} imageError={imageError} onImageChange={handleImageChange} onRemoveImage={removeImage} />;
  return <div className={fullPage ? 'catalog-editor-page' : 'fixed inset-0 z-50 flex items-end justify-center bg-[hsl(220_30%_17%/.45)] p-0 backdrop-blur-sm sm:items-center sm:p-5'}><div className={cn('max-h-[92dvh] w-full max-w-[560px] overflow-y-auto rounded-t-[20px] border border-[hsl(var(--card-border))] bg-[hsl(var(--card))] p-6 sm:rounded-[20px] sm:p-8', fullPage && 'catalog-editor-card')}><div className="flex items-start justify-between"><div><div className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">{product ? 'Edit item' : 'New item'}</div><h2 className="mt-2 font-display text-2xl font-bold tracking-[-.04em]">{product ? 'Update your item.' : 'Add to your catalog.'}</h2><p className="mt-2 max-w-[520px] text-sm leading-6 text-[hsl(var(--muted-foreground))]">Give buyers the details they need and keep your inventory accurate.</p></div>{!fullPage && <button type="button" onClick={onClose} aria-label="Close item editor" data-testid="button-close-product-modal" className="rounded-lg p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]"><X aria-hidden="true" size={18} /></button>}</div><form onSubmit={save} className="mt-7 space-y-5"><div><label className="field-label">Item name</label><input data-testid="input-product-name" autoFocus required value={form.name} onChange={(e) => change('name', e.target.value)} placeholder="e.g. Linen wrap top" className="field-input" /></div><div><label className="field-label">Product image URL <span className="font-normal text-[hsl(var(--muted-foreground))]">(optional)</span></label><input data-testid="input-product-image-url" type="url" value={form.imageUrl} onChange={(e) => change('imageUrl', e.target.value)} placeholder="https://images.example.com/item.jpg" className="field-input" /><p className="mt-1 text-[11px] leading-5 text-[hsl(var(--muted-foreground))]">Use a public image URL so the item looks consistent across catalog and buyer previews.</p>{form.imageUrl && <div className="mt-3 overflow-hidden rounded-[12px] border border-[hsl(var(--border))] bg-[hsl(var(--muted))]"><img src={form.imageUrl} alt="Product preview" className="h-40 w-full object-cover" /></div>}</div><div className="grid gap-5 sm:grid-cols-2"><div><label className="field-label">Category</label><select data-testid="select-product-category" value={form.category} onChange={(e) => change('category', e.target.value)} className="field-input"><option>Apparel</option><option>Accessories</option><option>Home</option><option>Beauty</option><option>Food & drink</option><option>Other</option></select></div><div><label className="field-label">Stock on hand</label><input data-testid="input-product-stock" type="number" min="0" required value={form.stock} onChange={(e) => change('stock', e.target.value)} className="field-input" /></div></div><div className="grid gap-5 sm:grid-cols-2"><div><label className="field-label">Selling price</label><div className="relative"><span className="absolute left-3 top-2.5 text-sm text-[hsl(var(--muted-foreground))]">$</span><input data-testid="input-product-price" type="number" min="0" step=".01" required value={form.price} onChange={(e) => change('price', e.target.value)} className="field-input pl-7" /></div></div><div><label className="field-label">Cost <span className="font-normal text-[hsl(var(--muted-foreground))]">(optional)</span></label><div className="relative"><span className="absolute left-3 top-2.5 text-sm text-[hsl(var(--muted-foreground))]">$</span><input data-testid="input-product-cost" type="number" min="0" step=".01" value={form.cost} onChange={(e) => change('cost', e.target.value)} placeholder="Not tracked" className="field-input pl-7" /></div></div></div><div className="catalog-preferences-editor"><div className="flex items-start justify-between gap-3"><div><label className="field-label">Buyer preferences <span className="font-normal text-[hsl(var(--muted-foreground))]"> (optional)</span></label><p className="mt-1 text-xs leading-5 text-[hsl(var(--muted-foreground))]">Set the groups and choices buyers should see, such as Color or Size.</p></div><button type="button" className="shrink-0 rounded-full border border-[hsl(var(--border))] px-2.5 py-1.5 text-[10px] font-bold" onClick={() => setForm((current) => ({ ...current, preferences: [...current.preferences, { label: '', options: '' }] }))}><Plus size={12} />Add group</button></div>{form.preferences.length > 0 && <div className="mt-3 space-y-2">{form.preferences.map((preference, index) => <div key={index} className="catalog-preference-row"><input aria-label={`Preference group ${index + 1} name`} value={preference.label} onChange={(event) => updatePreference(index, 'label', event.target.value)} placeholder="Group name, e.g. Color" className="field-input" /><input aria-label={`Choices for preference group ${index + 1}`} value={preference.options} onChange={(event) => updatePreference(index, 'options', event.target.value)} placeholder="Choices separated by commas" className="field-input" /><button type="button" aria-label={`Remove preference group ${index + 1}`} className="catalog-preference-remove" onClick={() => setForm((current) => ({ ...current, preferences: current.preferences.filter((_, preferenceIndex) => preferenceIndex !== index) }))}><X size={14} /></button></div>)}</div>}</div><div className="catalog-custom-fields-editor"><div className="flex items-start justify-between gap-3"><div><label className="field-label">Custom fields <span className="font-normal text-[hsl(var(--muted-foreground))]">(optional)</span></label><p className="mt-1 text-xs leading-5 text-[hsl(var(--muted-foreground))]">Add details like material, fit, care, or collection.</p></div><button type="button" className="shrink-0 rounded-full border border-[hsl(var(--border))] px-2.5 py-1.5 text-[10px] font-bold" onClick={() => setForm((current) => ({ ...current, customFields: [...current.customFields, { label: '', value: '' }] }))}><Plus size={12} />Add field</button></div>{form.customFields.length > 0 && <div className="mt-3 space-y-2">{form.customFields.map((field, index) => <div key={index} className="catalog-preference-row"><input aria-label={`Custom field ${index + 1} name`} value={field.label} onChange={(event) => updateCustomField(index, 'label', event.target.value)} placeholder="Field name, e.g. Material" className="field-input" /><input aria-label={`Value for custom field ${index + 1}`} value={field.value} onChange={(event) => updateCustomField(index, 'value', event.target.value)} placeholder="Field value" className="field-input" /><button type="button" aria-label={`Remove custom field ${index + 1}`} className="catalog-preference-remove" onClick={() => setForm((current) => ({ ...current, customFields: current.customFields.filter((_, fieldIndex) => fieldIndex !== index) }))}><X size={14} /></button></div>)}</div>}</div><div><label className="field-label">Accent color</label><div className="flex gap-2">{accentOptions.map(({ value, label }) => <button type="button" key={value} onClick={() => change('accent', value)} aria-label={`Use ${label} accent color`} aria-pressed={form.accent === value} data-testid={`button-accent-${value.slice(1)}`} className={cn('h-8 w-8 rounded-full border-2 transition-transform', form.accent === value ? 'scale-110 border-[hsl(var(--foreground))]' : 'border-transparent')} style={{ backgroundColor: value }} />)}</div></div>{(error || create.isError || update.isError) && <div className="rounded-[10px] border border-[hsl(var(--destructive))]/20 bg-[hsl(var(--destructive))]/5 px-3 py-2 text-xs text-[hsl(var(--destructive))]" role="alert" data-testid="status-product-form-error">{error || 'This item could not be saved. Try again.'}</div>}<div className="flex justify-end gap-3 border-t border-[hsl(var(--border))] pt-5"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" disabled={pending}>{pending && <Loader2 size={15} className="animate-spin" />}{product ? 'Save changes' : 'Add item'}</Button></div></form></div></div>;
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
    setError('');
    const onSuccess = () => {
      queryClient.invalidateQueries({ queryKey: getListExpensesQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
      onClose();
    };
    const onError = (mutationError: unknown) => setError(mutationError instanceof Error && mutationError.message ? mutationError.message : 'This expense could not be saved. Try again.');
    if (expense) update.mutate({ id: expense.id, data: { ...data, note: note || null } as ExpenseUpdate }, { onSuccess, onError });
    else create.mutate({ data }, { onSuccess, onError });
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
  const [actionError, setActionError] = useState('');
  const expenses = useMemo(() => (query.data ?? []).filter((expense) => {
    const matchesCategory = categoryFilter === 'all' || expense.category === categoryFilter;
    return matchesCategory && `${expense.title} ${expense.note ?? ''} ${expense.category}`.toLowerCase().includes(search.trim().toLowerCase());
  }), [query.data, search, categoryFilter]);
  const total = (query.data ?? []).reduce((sum, expense) => sum + expense.amount, 0);
  const visibleTotal = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const remove = (expense: Expense) => {
    if (window.confirm(`Delete ${expense.title}?`)) {
      setActionError('');
      deleteExpense.mutate({ id: expense.id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListExpensesQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        },
        onError: (error) => setActionError(error instanceof Error && error.message ? error.message : 'This expense could not be deleted. Try again.'),
      });
    }
  };
  return <Shell><PageHeading title="Expenses" action={<Button onClick={() => setModal('new')} data-testid="button-new-expense"><Plus size={16} />Add expense</Button>} />
    <div className="expenses-summary mb-5 grid gap-4 md:grid-cols-3"><MetricCard dataTestId="card-expenses-total" label="All operating expenses" value={moneyExact(total)} note={`${query.data?.length ?? 0} recorded expenses`} /><MetricCard dataTestId="card-expenses-visible" label="Showing now" value={moneyExact(visibleTotal)} indicator={total ? { direction: expenses.length > 0 ? 'up' : 'down', percentage: (visibleTotal / total) * 100 } : undefined} note={`${expenses.length} matching entries`} /><InsightCard dataTestId="card-expenses-profit-note" icon={CircleDollarSign} title="A clearer profit view" description="Operating expenses flow into combined expenses, not gross margin." /></div>
      {actionError && <div className="mb-4 rounded-[12px] border border-[hsl(var(--destructive))]/20 bg-[hsl(var(--destructive))]/5 px-4 py-3 text-xs text-[hsl(var(--destructive))]" role="alert" data-testid="status-expense-action-error">{actionError}</div>}<div className="expenses-workspace-controls"><div className="expenses-search"><Search aria-hidden="true" size={16} /><input aria-label="Search expenses" data-testid="input-search-expenses" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search expenses" /></div><select data-testid="select-filter-expenses" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="expenses-category-filter"><option value="all">All categories</option>{expenseCategories.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div><Card className="expenses-table-card overflow-hidden">
       {query.isLoading ? <div className="space-y-4 p-6"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div> : query.isError ? <div className="p-6"><ErrorState retry={() => query.refetch()} /></div> : <div className="expenses-table" role="table"><div className="expenses-table-head" role="row"><span>Expense</span><span>Category</span><span>Date</span><span className="is-numeric">Amount</span><span className="sr-only">Actions</span></div>{expenses.length ? <div className="divide-y divide-[hsl(var(--border))]">{expenses.map((expense) => <div key={expense.id} className="expenses-table-row" data-testid={`row-expense-${expense.id}`} role="row"><div className="min-w-0"><div className="flex items-center gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"><Receipt size={16} /></div><div className="min-w-0"><div className="truncate text-sm font-semibold">{expense.title}</div>{expense.note && <div className="mt-1 truncate text-[11px] text-[hsl(var(--muted-foreground))]">{expense.note}</div>}</div></div></div><div className="expenses-table-cell" data-label="Category">{expenseCategoryLabel(expense.category)}</div><div className="expenses-table-cell" data-label="Date">{dateShort(expense.date)}</div><div className="expenses-table-cell expenses-table-amount" data-label="Amount">{moneyExact(expense.amount)}</div><div className="flex justify-end"><ExpenseActions expenseId={expense.id} expenseTitle={expense.title} onEdit={() => setModal(expense)} onDelete={() => remove(expense)} deleteDisabled={deleteExpense.isPending} /></div></div>)}</div> : <div className="p-6"><EmptyState icon={Receipt} title={search || categoryFilter !== 'all' ? 'No matching expenses' : 'No operating expenses yet'} description={search || categoryFilter !== 'all' ? 'Try another search or category.' : 'Record rent, delivery, supplies, and other costs that keep your shop moving.'} action={<Button onClick={() => setModal('new')}><Plus size={15} />Add your first expense</Button>} /></div>}</div>}
    </Card>
    {modal && <ExpenseModal expense={modal === 'new' ? undefined : modal} onClose={() => setModal(null)} />}
  </Shell>;
}

function CatalogEditorRoute() {
  const params = useParams<{ id?: string }>();
  const query = useListProducts();
  const [, setLocation] = useLocation();
  const product = params.id ? (query.data ?? []).find((item) => item.id === Number(params.id)) : undefined;
  if (params.id && query.isLoading) return <Shell><PageHeading title="Edit item" /><Card className="catalog-editor-card p-8"><Skeleton className="h-10 w-full" /><Skeleton className="mt-4 h-10 w-full" /><Skeleton className="mt-4 h-32 w-full" /></Card></Shell>;
  if (params.id && !product) return <Shell><PageHeading title="Edit item" /><ErrorState retry={() => query.refetch()} /></Shell>;
  return <Shell><ProductModal product={product} fullPage onClose={() => setLocation('/catalog')} /></Shell>;
}

function CatalogGridCard({ product, animationDelay, onEdit, onDelete, deleteDisabled }: {
  product: Product;
  animationDelay: string;
  onEdit: () => void;
  onDelete: () => void;
  deleteDisabled: boolean;
}) {
  return <div className="catalog-grid-card rise-in" style={{ animationDelay }} data-testid={`card-product-${product.id}`} role="listitem">
    <div className="catalog-grid-image">
      <img src={product.imageUrl ?? productImageFor(product.name)} alt={product.name} />
      <div className="catalog-grid-actions"><CatalogActions productId={product.id} productName={product.name} onEdit={onEdit} onDelete={onDelete} deleteDisabled={deleteDisabled} /></div>
    </div>
    <div className="catalog-grid-details">
      <h3 title={product.name}>{product.name}</h3>
      <strong>{moneyExact(product.price)}</strong>
    </div>
  </div>;
}

function Catalog() {
  const query = useListProducts(); const deleteProduct = useDeleteProduct(); const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [stockFilter, setStockFilter] = useState('all');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [actionError, setActionError] = useState('');
  const allProducts = query.data ?? [];
  const products = useMemo(() => allProducts.filter((product) => {
    const textMatches = `${product.name} ${product.category} ${product.customFields.map((field) => `${field.label} ${field.value}`).join(' ')}`.toLowerCase().includes(search.trim().toLowerCase());
    const categoryMatches = categoryFilter === 'all' || product.category === categoryFilter;
    const stockMatches = stockFilter === 'all' || (stockFilter === 'low' ? product.stock > 0 && product.stock < 5 : product.stock === 0);
    return textMatches && categoryMatches && stockMatches;
  }), [allProducts, search, categoryFilter, stockFilter]);
  const remove = (product: Product) => {
    if (window.confirm(`Delete ${product.name} from your catalog?`)) {
      setActionError('');
      deleteProduct.mutate({ id: product.id }, {
        onSuccess: () => {
          void queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
          invalidateDashboardSummary(queryClient);
        },
        onError: (error) => setActionError(error instanceof Error && error.message ? error.message : 'This item could not be deleted. Try again.'),
      });
    }
  };
  const inventoryValue = catalogValue(query.data ?? []);
  const lowStock = (query.data ?? []).filter((product) => product.stock < 5).length;
  const categories = new Set((query.data ?? []).map((product) => product.category)).size;
   return <Shell>
      <PageHeading title="Catalog" description="Keep the products, prices, stock, and buyer choices you reuse most in one place." action={<Button onClick={() => setLocation('/catalog/new')} data-testid="button-new-product"><Plus size={16} />Add item</Button>} />
    <section className="catalog-summary" aria-label="Catalog summary">
       <MetricCard className="rise-in" dataTestId="card-catalog-inventory-value" label="Catalog value" value={money(inventoryValue)} note={`${query.data?.length ?? 0} catalog item prices`} />
        <MetricCard className="rise-in" style={{ animationDelay: '55ms' }} dataTestId="card-catalog-items" label="Items" value={query.data?.length ?? 0} note={`${categories} ${categories === 1 ? 'category' : 'categories'} in the catalog`} />
       <MetricCard className="rise-in" style={{ animationDelay: '110ms' }} dataTestId="card-catalog-low-stock" label="Low stock" value={<span className={cn(lowStock > 0 && 'text-[hsl(var(--destructive))]')}>{lowStock}</span>} indicator={(query.data?.length ?? 0) > 0 ? { direction: lowStock > 0 ? 'down' : 'neutral', percentage: (lowStock / query.data!.length) * 100, tone: lowStock > 0 ? 'negative' : 'positive' } : undefined} note={lowStock ? `${lowStock} ${lowStock === 1 ? 'item needs' : 'items need'} a restock` : 'All levels look good'} />
       <MetricCard className="rise-in" style={{ animationDelay: '165ms' }} dataTestId="card-catalog-categories" label="Categories" value={categories} note={`${query.data?.length ?? 0} items grouped for buyers`} />
    </section>
      {actionError && <div className="mb-4 rounded-[12px] border border-[hsl(var(--destructive))]/20 bg-[hsl(var(--destructive))]/5 px-4 py-3 text-xs text-[hsl(var(--destructive))]" role="alert" data-testid="status-catalog-action-error">{actionError}</div>}<Card className="catalog-workspace list-card mt-5 overflow-hidden">
       <div className="catalog-toolbar filter-surface">
          <div><div className="catalog-toolbar-kicker">Inventory workspace</div><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{products.length} of {allProducts.length} items</p></div>
        <div className="catalog-toolbar-tools">
           <div className="relative min-w-0 flex-1 sm:max-w-[280px]"><Search className="pointer-events-none absolute left-3 top-2.5 text-[hsl(var(--muted-foreground))]" size={16} /><input aria-label="Search catalog" data-testid="input-search-products" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products" className="field-input pl-9" /></div>
           <select aria-label="Filter by category" data-testid="select-filter-products-category" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="field-input catalog-filter-select"><option value="all">All categories</option>{[...new Set(allProducts.map((product) => product.category))].sort().map((category) => <option key={category} value={category}>{category}</option>)}</select>
           <select aria-label="Filter by stock" data-testid="select-filter-products-stock" value={stockFilter} onChange={(e) => setStockFilter(e.target.value)} className="field-input catalog-filter-select"><option value="all">All stock</option><option value="low">Low stock</option><option value="out">Out of stock</option></select>
           <div className="catalog-view-toggle" role="group" aria-label="Catalog view"><button type="button" aria-label="Grid view" aria-pressed={view === 'grid'} onClick={() => setView('grid')} className={cn(view === 'grid' && 'is-active')}><Boxes size={15} /></button><button type="button" aria-label="List view" aria-pressed={view === 'list'} onClick={() => setView('list')} className={cn(view === 'list' && 'is-active')}><Clipboard size={15} /></button></div>
        </div>
      </div>
       {query.isLoading ? <div className="catalog-loading">{[1, 2, 3].map((i) => <div key={i} className="catalog-loading-row"><Skeleton className="h-11 w-11 rounded-[13px]" /><div className="flex-1"><Skeleton className="h-4 w-40" /><Skeleton className="mt-2 h-3 w-24" /></div><Skeleton className="h-8 w-20" /></div>)}</div> : query.isError ? <div className="p-6"><ErrorState retry={() => query.refetch()} /></div> : products.length ? <div className={cn(view === 'grid' ? 'catalog-grid' : 'catalog-list')} role="list">
         {view === 'list' && <div className="catalog-list-head" aria-hidden="true"><span>Product</span><span>Options</span><span>Price / cost</span><span>Stock</span><span /></div>}
          {products.map((product, index) => view === 'grid'
            ? <CatalogGridCard key={product.id} product={product} animationDelay={`${index * 50}ms`} onEdit={() => setLocation(`/catalog/edit/${product.id}`)} onDelete={() => remove(product)} deleteDisabled={deleteProduct.isPending} />
            : <div key={product.id} className="catalog-product-row rise-in" style={{ animationDelay: `${index * 50}ms` }} data-testid={`card-product-${product.id}`} role="listitem">
              <div className="catalog-product-main"><div className="catalog-product-mark" style={{ backgroundColor: `${product.accent}42` }}>{initials(product.name)}</div><div className="min-w-0"><h3 className="truncate font-display text-base font-bold tracking-[-.025em]">{product.name}</h3><div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-[hsl(var(--muted-foreground))]"><span className="catalog-category">{product.category}</span>{product.customFields.slice(0, 2).map((field) => <span key={field.label}>· {field.label}: {field.value}</span>)}</div></div></div>
              <div className="catalog-variants">{product.preferences.length ? product.preferences.map((preference) => `${preference.label}: ${preference.options.join(', ')}`).join(' · ') : product.variants.length ? product.variants.join(' · ') : 'No buyer options'}</div>
              <div className="catalog-number"><span className="catalog-mobile-label">Price</span><strong>{moneyExact(product.price)}</strong><small>{product.cost == null ? 'Cost not tracked' : `Cost ${moneyExact(product.cost)}`}</small></div>
              <div className="catalog-stock"><span className="catalog-mobile-label">Stock</span><strong className={cn(product.stock < 5 && 'is-alert')}>{product.stock}</strong><span className={cn('catalog-stock-status', product.stock < 5 ? 'is-alert' : 'is-good')}>{product.stock === 0 ? 'Out of stock' : product.stock < 5 ? 'Running low' : 'In stock'}</span></div>
              <CatalogActions productId={product.id} productName={product.name} onEdit={() => setLocation(`/catalog/edit/${product.id}`)} onDelete={() => remove(product)} deleteDisabled={deleteProduct.isPending} />
            </div>)}
       </div> : <div className="p-6"><EmptyState icon={Package} title={search || categoryFilter !== 'all' || stockFilter !== 'all' ? 'No matching items' : 'Your catalog is waiting'} description="Try another search or filter, or add your first catalog item." action={<Button onClick={() => setLocation('/catalog/new')}><Plus size={15} />Add item</Button>} /></div>}
    </Card>
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
  const [location, setLocation] = useLocation();
  const query = useListOrders();
  const update = useUpdateOrder();
  const queryClient = useQueryClient();
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [fulfillmentFilter, setFulfillmentFilter] = useState('all');
  const [search, setSearch] = useState(() => new URLSearchParams(window.location.search).get('customer') ?? '');
  const [mutationError, setMutationError] = useState('');
  useEffect(() => {
    setSearch(new URLSearchParams(window.location.search).get('customer') ?? '');
  }, [location]);
  const allOrders = query.data ?? [];
  const orders = useMemo(() => allOrders.filter((order) => {
    const matchesPayment = paymentFilter === 'all' || order.status === paymentFilter;
    const matchesFulfillment = fulfillmentFilter === 'all' || order.fulfillment === fulfillmentFilter;
    const haystack = `${order.customerName} ${order.productName} ${order.token} ${order.customerPhone ?? ''}`.toLowerCase();
    return matchesPayment && matchesFulfillment && haystack.includes(search.trim().toLowerCase());
  }), [allOrders, paymentFilter, fulfillmentFilter, search]);
  const collectedFor = (order: Order) => order.status === 'paid' ? order.amount : order.status === 'deposit_paid' ? (order.depositAmount ?? 0) : 0;
  const metrics = useMemo(() => {
    const orderValue = allOrders.reduce((sum, order) => sum + order.amount, 0);
    const collected = allOrders.reduce((sum, order) => sum + collectedFor(order), 0);
    const paidOrders = allOrders.filter((order) => order.status === 'paid').length;
    return { orderValue, collected, outstanding: Math.max(0, orderValue - collected), paidOrders, collectionRate: orderValue ? (collected / orderValue) * 100 : 0, average: allOrders.length ? orderValue / allOrders.length : 0 };
  }, [allOrders]);
  const updateOrder = (order: Order, data: { status?: 'reserved' | 'deposit_paid' | 'paid'; fulfillment?: 'pending' | 'shipped' | 'delivered' }) => {
    setMutationError('');
    update.mutate({ id: order.id, data }, {
      onSuccess: () => { void queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() }); invalidateDashboardSummary(queryClient); },
      onError: (error) => setMutationError(error instanceof Error && error.message ? error.message : 'That order update could not be saved. Try again.'),
    });
  };
  const orderFilterOptions = [
    { value: 'all', label: 'All' },
    { value: 'reserved', label: 'Reserved' },
    { value: 'deposit_paid', label: 'Deposit paid' },
    { value: 'paid', label: 'Paid' },
    { value: 'pending', label: 'To ship' },
    { value: 'shipped', label: 'Shipped' },
    { value: 'delivered', label: 'Delivered' },
  ];
  const selectOrderFilter = (value: string) => {
    const paymentValue = ['reserved', 'deposit_paid', 'paid'].includes(value) ? value : 'all';
    const fulfillmentValue = ['pending', 'shipped', 'delivered'].includes(value) ? value : 'all';
    setPaymentFilter(paymentValue);
    setFulfillmentFilter(fulfillmentValue);
  };
  const filter = paymentFilter !== 'all' ? paymentFilter : fulfillmentFilter !== 'all' ? fulfillmentFilter : 'all';
  const fulfillmentLabel = (value: Order['fulfillment']) => value === 'pending' ? 'To ship' : value;

  return <Shell>
    <PageHeading title="Orders" action={<Link href="/take-order" data-testid="link-take-order-orders"><Button><Plus size={16} />Take an order</Button></Link>} />
    <section className="orders-snapshot" aria-label="Order performance summary">
       <MetricCard className="rise-in" dataTestId="card-orders-live-value" label="Live order value" value={<span data-testid="text-live-order-value">{money(metrics.orderValue)}</span>} indicator={metrics.orderValue ? { direction: metrics.outstanding > 0 ? 'down' : 'up', percentage: (metrics.collected / metrics.orderValue) * 100 } : undefined} note={`${money(metrics.collected)} collected · ${money(metrics.outstanding)} outstanding`} />
       <MetricCard className="rise-in" style={{ animationDelay: '55ms' }} dataTestId="card-orders-total" label="Total orders" value={<span data-testid="text-total-orders">{allOrders.length}</span>} indicator={allOrders.length ? { direction: metrics.paidOrders > 0 ? 'up' : 'down', percentage: (metrics.paidOrders / allOrders.length) * 100 } : undefined} note={`${metrics.paidOrders} paid in full`} />
       <MetricCard className="rise-in" style={{ animationDelay: '110ms' }} dataTestId="card-orders-average" label="Average order value" value={<span data-testid="text-average-order-value">{money(metrics.average)}</span>} note="Based on live order value" />
       <MetricCard className="rise-in" style={{ animationDelay: '165ms' }} dataTestId="card-orders-collection-rate" label="Collection rate" value={<span data-testid="text-collection-rate">{metrics.collectionRate.toFixed(1)}%</span>} note="Paid amount against order value" />
    </section>
    <section className="mt-5">
       {mutationError && <div className="mb-4 rounded-[12px] border border-[hsl(var(--destructive))]/20 bg-[hsl(var(--destructive))]/5 px-4 py-3 text-xs text-[hsl(var(--destructive))]" role="alert" data-testid="status-order-action-error">{mutationError}</div>}
       <div className="orders-controls orders-page-controls filter-surface">
         <div className="orders-filter-scroll" role="group" aria-label="Order filters">{orderFilterOptions.map((option) => <button type="button" key={option.value} onClick={() => selectOrderFilter(option.value)} aria-pressed={filter === option.value} data-testid={`button-filter-${option.value}`} className={cn('orders-filter-button', filter === option.value && 'is-active')}>{option.label}</button>)}</div>
         <div className="list-search-shell"><Search className="pointer-events-none absolute left-2.5 top-2.5 text-[hsl(var(--muted-foreground))]" size={14} /><input aria-label="Search orders" data-testid="input-search-orders" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search orders" className="list-search-input" /></div>
        </div>
       <Card className="overflow-hidden">
          {query.isLoading ? <div className="space-y-4 p-5 sm:p-6" aria-label="Loading orders"><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></div> : query.isError ? <div className="p-5 sm:p-6"><ErrorState retry={() => query.refetch()} /></div> : orders.length ? <div className="orders-table-wrap" role="table" aria-label="Orders"><div className="orders-table-head" role="row"><span role="columnheader">Order ID</span><span role="columnheader">Buyer / item</span><span role="columnheader">Traffic</span><span role="columnheader">Order value</span><span role="columnheader">Placed</span><span role="columnheader">Payment</span><span role="columnheader">Fulfillment</span></div>{orders.map((order) => <div key={order.id} className="orders-table-row is-clickable" role="row" tabIndex={0} aria-label={`Open order ${order.id} details`} data-testid={`row-orders-order-${order.id}`} onClick={(event) => { if ((event.target as HTMLElement).closest('a,button,input,select,textarea')) return; setLocation(`/orders/${order.id}`); }} onKeyDown={(event) => { if (event.key !== 'Enter' && event.key !== ' ') return; event.preventDefault(); setLocation(`/orders/${order.id}`); }}><div className="orders-order-id-cell"><span className="orders-mobile-label">Order ID</span><Link href={`/orders/${order.id}`} className="orders-order-id orders-order-id-link" data-testid={`link-order-${order.id}`} aria-label={`Open order ${order.id}`}>#{String(order.id).padStart(7, '0')}</Link></div><div className="orders-buyer-cell"><div className="orders-avatar">{initials(order.customerName || order.productName)}</div><div className="min-w-0"><div className="truncate text-sm font-semibold">{order.customerName || 'Buyer pending'}</div><div className="mt-1 truncate text-[11px] text-[hsl(var(--muted-foreground))]">{order.productName}</div>{order.deliveryMethod && <div className="mt-1 truncate text-[10px] text-[hsl(var(--muted-foreground))]" title={order.deliveryAddress ?? undefined}>{order.deliveryMethod === 'delivery' ? `Delivery · ${moneyExact(order.deliveryFee)}` : 'Pickup'}{order.deliveryAddress ? ` · ${order.deliveryAddress}` : ''}</div>}</div></div><div className="orders-traffic-cell"><span className="orders-mobile-label">Traffic</span><span className="orders-traffic-icon" data-testid={`text-order-traffic-${order.id}`} title={channelName(order.channel)} aria-label={`Traffic source: ${channelName(order.channel)}`}><ChannelMark value={order.channel} size={17} /></span></div><div className="orders-value-cell"><span className="orders-mobile-label">Order value</span><div className="font-mono-ui text-xs font-bold">{moneyExact(order.amount)}</div><div className="mt-1 text-[10px] text-[hsl(var(--muted-foreground))]">{moneyExact(collectedFor(order))} collected</div></div><div className="orders-date-cell"><span className="orders-mobile-label">Placed</span><span className="font-mono-ui text-[10px] text-[hsl(var(--muted-foreground))]">{dateShort(order.createdAt)}</span></div><div className="orders-cell-labeled"><span className="orders-mobile-label">Payment</span><button type="button" disabled={update.isPending} aria-label={`Advance payment status for ${order.customerName || order.productName}`} title="Advance payment status" data-testid={`button-payment-${order.id}`} onClick={() => { const status: 'reserved' | 'deposit_paid' | 'paid' = order.status === 'reserved' ? 'deposit_paid' : order.status === 'deposit_paid' ? 'paid' : 'reserved'; updateOrder(order, { status }); }}><StatusPill tone={order.status === 'paid' ? 'mint' : order.status === 'deposit_paid' ? 'gold' : 'neutral'}>{paymentLabel(order)}</StatusPill></button></div><div className="orders-cell-labeled"><span className="orders-mobile-label">Fulfillment</span><button type="button" disabled={update.isPending} aria-label={`Advance fulfillment status for ${order.customerName || order.productName}`} title="Advance fulfillment status" data-testid={`button-fulfillment-${order.id}`} onClick={() => { const fulfillment: 'pending' | 'shipped' | 'delivered' = order.fulfillment === 'pending' ? 'shipped' : order.fulfillment === 'shipped' ? 'delivered' : 'pending'; updateOrder(order, { fulfillment }); }}><StatusPill tone={order.fulfillment === 'delivered' ? 'mint' : order.fulfillment === 'shipped' ? 'blue' : 'neutral'}>{fulfillmentLabel(order.fulfillment)}</StatusPill></button></div></div>)}</div> : <div className="p-5 sm:p-6"><EmptyState icon={ShoppingBag} title={search || filter !== 'all' ? 'No orders match' : 'Your order list is quiet'} description={search || filter !== 'all' ? 'Try another filter or search.' : 'When buyers use your links, their orders will show up here.'} action={!search && filter === 'all' ? <Link href="/take-order" data-testid="link-create-first-order"><Button><Plus size={15} />Create a link</Button></Link> : undefined} /></div>}
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
};
type ClientFilter = 'all' | 'repeat' | 'balance' | 'serve';

function Clients() {
  const query = useListOrders();
  const [search, setSearch] = useState('');
  const [clientFilter, setClientFilter] = useState<ClientFilter>('all');
  const clients = useMemo<ClientSummary[]>(() => {
    const grouped = new Map<string, ClientSummary>();
    (query.data ?? []).forEach((order) => {
      const phone = order.customerPhone?.trim() ?? '';
      const name = order.customerName?.trim() ?? '';
      const identity = phone || name;
      if (!identity) return;
      const key = `${phone ? 'phone' : 'name'}:${identity.toLowerCase()}`;
      const collected = order.status === 'paid' ? order.amount : order.status === 'deposit_paid' ? (order.depositAmount ?? 0) : 0;
      const existing = grouped.get(key);
      if (existing) {
        existing.orders.push(order);
        existing.orderCount += 1;
        existing.collected += collected;
        existing.outstanding += Math.max(0, order.amount - collected);
        if (new Date(order.createdAt).getTime() > new Date(existing.latestPurchase).getTime()) {
          existing.latestPurchase = order.createdAt;
          if (name) existing.displayName = name;
        }
        if (!existing.phone && phone) existing.phone = phone;
      } else {
        grouped.set(key, {
          key,
          displayName: name,
          phone,
          orders: [order],
          orderCount: 1,
          collected,
          outstanding: Math.max(0, order.amount - collected),
          latestPurchase: order.createdAt,
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
    return clients.filter((client) => {
      const matchesFilter = clientFilter === 'all'
        || (clientFilter === 'repeat' && client.orderCount > 1)
        || (clientFilter === 'balance' && client.outstanding > 0)
        || (clientFilter === 'serve' && client.orders.some((order) => order.fulfillment !== 'delivered'));
      const matchesSearch = !term || `${client.displayName} ${client.phone}`.toLowerCase().includes(term);
      return matchesFilter && matchesSearch;
    });
  }, [clients, clientFilter, search]);
  const repeatClients = clients.filter((client) => client.orderCount > 1).length;
  const balanceDueClients = clients.filter((client) => client.outstanding > 0).length;
  const clientsToServe = clients.filter((client) => client.orders.some((order) => order.fulfillment !== 'delivered')).length;
  const totalBalanceDue = clients.reduce((sum, client) => sum + client.outstanding, 0);
  const repeatRate = clients.length ? (repeatClients / clients.length) * 100 : 0;
  const settledRate = clients.length ? ((clients.length - balanceDueClients) / clients.length) * 100 : 0;
  const balanceRate = clients.length ? (balanceDueClients / clients.length) * 100 : 0;
  const serviceRate = clients.length ? (clientsToServe / clients.length) * 100 : 0;
  const clientFilters: Array<{ value: ClientFilter; label: string; count: number }> = [
    { value: 'all', label: 'All clients', count: clients.length },
    { value: 'repeat', label: 'Return visits', count: repeatClients },
    { value: 'balance', label: 'Owing clients', count: balanceDueClients },
    { value: 'serve', label: 'To serve', count: clientsToServe },
  ];

  return <Shell>
    <PageHeading
      title="Clients"
    />
    {query.isLoading ? <ClientsSkeleton /> : query.isError ? <ErrorState retry={() => query.refetch()} /> : !clients.length ? <EmptyState card icon={Users} title="Your client list starts with an order" description="When a buyer shares their details, Take Order will keep their purchase history together here." action={<Link href="/take-order" data-testid="link-clients-empty-order"><Button><Plus size={15} />Take an order</Button></Link>} /> : <>
      <section className="clients-overview" aria-label="Client summary">
        <MetricCard className="rise-in" dataTestId="card-clients-return-visits" label="Return visits" value={<span data-testid="text-client-return-visits">{repeatClients}</span>} indicator={clients.length ? { direction: repeatClients ? 'up' : 'neutral', percentage: repeatRate } : undefined} note={`${repeatClients} ${repeatClients === 1 ? 'client has' : 'clients have'} ordered more than once`} />
        <MetricCard className="rise-in" style={{ animationDelay: '55ms' }} dataTestId="card-clients-total" label="Total clients" value={<span data-testid="text-total-clients">{clients.length}</span>} indicator={clients.length ? { direction: settledRate >= 50 ? 'up' : 'down', percentage: settledRate } : undefined} note={`${clients.length - balanceDueClients} without an outstanding balance`} />
        <MetricCard className="rise-in" style={{ animationDelay: '110ms' }} dataTestId="card-clients-balance-due" label="Owing clients" value={<span data-testid="text-clients-balance-due">{balanceDueClients}</span>} indicator={clients.length ? { direction: balanceDueClients ? 'down' : 'neutral', percentage: balanceRate, tone: balanceDueClients ? 'positive' : 'neutral' } : undefined} note={`${money(totalBalanceDue)} outstanding across ${balanceDueClients} ${balanceDueClients === 1 ? 'client' : 'clients'}`} />
        <MetricCard className="rise-in" style={{ animationDelay: '165ms' }} dataTestId="card-clients-to-serve" label="To serve" value={<span data-testid="text-clients-to-serve">{clientsToServe}</span>} indicator={clients.length ? { direction: clientsToServe ? 'down' : 'neutral', percentage: serviceRate, tone: clientsToServe ? 'positive' : 'neutral' } : undefined} note={`${clientsToServe} ${clientsToServe === 1 ? 'client has' : 'clients have'} orders to fulfil`} />
      </section>
       <section className="clients-list-section mt-5">
         <div className="clients-workspace-heading">
           <h2>Clients</h2>
         </div>
         <div className="clients-workspace-controls">
           <div className="clients-filter-bar" role="group" aria-label="Filter clients">{clientFilters.map((filterOption) => <button key={filterOption.value} type="button" className={cn('clients-filter-tab', clientFilter === filterOption.value && 'is-active')} aria-pressed={clientFilter === filterOption.value} data-testid={`button-client-filter-${filterOption.value}`} onClick={() => setClientFilter(filterOption.value)}><span>{filterOption.label}</span><strong>{filterOption.count}</strong></button>)}</div>
           <div className="clients-search"><Search aria-hidden="true" /><input aria-label="Search clients" data-testid="input-search-clients" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search clients" /></div>
         </div>
         <Card className="overflow-hidden">
           {filteredClients.length ? <div className="clients-table-wrap"><div className="clients-table-head"><span>Client</span><span>Phone</span><span className="is-numeric">Orders</span><span className="is-numeric">Collected</span><span className="is-numeric">Balance due</span><span className="is-numeric">Last purchase</span><span className="sr-only">Details</span></div>{filteredClients.map((client) => <div className="clients-table-row" key={client.key} data-testid={`row-client-${client.key.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`}><div className="clients-buyer-cell"><div className="clients-avatar">{initials(client.displayName)}</div><div className="min-w-0"><div className="truncate text-sm font-semibold" data-testid={`text-client-name-${client.key}`}>{client.displayName}</div></div></div><div className="clients-cell-labeled clients-phone-cell"><span className="clients-mobile-label">Phone</span><span>{client.phone || '—'}</span></div><div className="clients-cell-labeled clients-numeric-cell"><span className="clients-mobile-label">Orders</span><span className="font-mono-ui text-xs font-bold">{client.orderCount}</span></div><div className="clients-cell-labeled clients-numeric-cell"><span className="clients-mobile-label">Collected</span><span className="font-mono-ui text-xs font-bold">{moneyExact(client.collected)}</span></div><div className="clients-cell-labeled clients-numeric-cell"><span className="clients-mobile-label">Balance due</span><span className="font-mono-ui text-xs font-bold">{client.outstanding ? moneyExact(client.outstanding) : '—'}</span></div><div className="clients-cell-labeled clients-numeric-cell"><span className="clients-mobile-label">Last purchase</span><span className="font-mono-ui text-xs">{dateShort(client.latestPurchase)}</span></div><div className="clients-actions"><Link href={`/orders?customer=${encodeURIComponent(client.displayName)}`} data-testid={`link-view-client-${client.key}`} className="clients-view-link">View <ArrowRight size={13} /></Link></div></div>)}</div> : <div className="p-5 sm:p-6"><EmptyState icon={Search} title="No clients match" /></div>}
        </Card>
      </section>
    </>}
  </Shell>;
}

function ClientsSkeleton() {
  return <div className="space-y-5" aria-label="Loading clients"><div className="clients-overview">{Array.from({ length: 4 }, (_, index) => <Card key={index} className="h-[150px] p-5"><Skeleton className="h-3 w-24" /><Skeleton className="mt-7 h-10 w-16" /></Card>)}</div><Card className="h-[360px] p-5"><Skeleton className="h-6 w-24" /><Skeleton className="mt-8 h-11 w-56 ml-auto" /><Skeleton className="mt-4 h-14 w-full" /><Skeleton className="mt-3 h-14 w-full" /><Skeleton className="mt-3 h-14 w-full" /></Card></div>;
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
          void queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
          invalidateDashboardSummary(queryClient);
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
          {path === 'catalog' ? <div>{productsQuery.isLoading ? <Skeleton className="h-11 w-full" /> : <select data-testid="select-order-product" required value={form.productId} onChange={(event) => chooseProduct(event.target.value)} className="field-input"><option value="">Choose from catalog</option>{(productsQuery.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.name} · {moneyExact(item.price)}</option>)}</select>}{productsQuery.data?.length === 0 && <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">No catalog items yet. Choose “New item from chat” to create one as you make the link.</p>}</div> : <div><label className="field-label" htmlFor="custom-order-name">Item name</label><input id="custom-order-name" data-testid="input-custom-order-name" required value={form.customName} onChange={(event) => change('customName', event.target.value)} placeholder="e.g. Hand-painted denim jacket" className="field-input" /><p className="mt-2 text-[11px] text-[hsl(var(--muted-foreground))]">This keeps a temporary item on the buyer link without adding it to your Catalog.</p></div>}
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
      <Card className="h-fit overflow-hidden"><div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-6 py-4"><div className="font-mono-ui text-[10px] uppercase tracking-[.15em] text-[hsl(var(--muted-foreground))]">Buyer page preview</div><Eye size={17} className="text-[hsl(var(--muted-foreground))]" /></div><div className="max-h-[760px] overflow-hidden bg-[hsl(var(--background))] px-6 py-8"><BuyerOrderSurface businessName={seller?.businessName || 'The Sunday Edit'} description={seller?.description} productName={previewName || 'Your item'} amount={form.amount ? Number(form.amount) : 0} paymentMode={form.paymentMode} depositAmount={form.depositAmount ? Number(form.depositAmount) : null} variants={product?.variants ?? []}><div className="space-y-5"><div><label className="field-label">Your name</label><input disabled placeholder="Full name" className="field-input" /></div><div><label className="field-label">Phone number</label><input disabled placeholder="Best number to reach you" className="field-input" /></div>{product?.preferences?.length ? <div><label className="field-label">Buyer preferences</label><div className="space-y-3">{product.preferences.map((preference) => <div key={preference.label}><span className="text-xs font-semibold">{preference.label}</span><div className="mt-2 flex flex-wrap gap-2">{preference.options.map((option) => <span key={option} className="rounded-full border border-[hsl(var(--border))] px-3 py-1.5 text-xs">{option}</span>)}</div></div>)}</div></div> : null}<div><label className="field-label">Details for the seller <span className="font-normal text-[hsl(var(--muted-foreground))]">(optional)</span></label><textarea disabled placeholder="Anything already agreed..." rows={3} className="field-input resize-none" /></div><div><label className="field-label">Reference image <span className="font-normal text-[hsl(var(--muted-foreground))]">(optional)</span></label><div className="flex items-center gap-3 rounded-[10px] border border-dashed border-[hsl(var(--border))] p-3 text-xs text-[hsl(var(--muted-foreground))]"><Clipboard size={15} />Attach an image</div></div>{form.paymentMode !== 'reserve' && <div className="grid grid-cols-2 gap-2"><div className="rounded-[10px] border border-[hsl(var(--primary))] bg-[hsl(var(--primary))] p-3 text-left text-xs font-bold text-white">{form.paymentMode === 'deposit' ? `Pay deposit · ${form.depositAmount ? moneyExact(Number(form.depositAmount)) : '—'}` : `Pay ${form.amount ? moneyExact(Number(form.amount)) : '—'}`}</div><div className="rounded-[10px] border border-[hsl(var(--border))] p-3 text-left text-xs font-bold">Reserve for later</div></div>}<button type="button" disabled className="flex w-full items-center justify-center gap-2 rounded-[10px] bg-[hsl(var(--primary))] py-3.5 text-sm font-bold text-white opacity-70">{form.paymentMode === 'reserve' ? 'Reserve this item' : 'Continue to mock payment'} <ArrowUpRight size={15} /></button></div></BuyerOrderSurface></div></Card>
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
  preferences: ProductPreferenceGroup[];
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

function TakeOrderSection({ eyebrow, title, description, children, className }: { eyebrow: string; title: string; description?: string; children: ReactNode; className?: string }) {
  return <section className={cn('take-order-section', className)}>
    <div className="take-order-section-heading">
      <div className="take-order-section-eyebrow">{eyebrow}</div>
      <h2>{title}</h2>
      {description && <p>{description}</p>}
    </div>
    {children}
  </section>;
}

type TakeOrderItemSource = 'catalog' | 'custom';

function TakeOrderChoiceCards({ selected, onSelect }: { selected: TakeOrderItemSource | null; onSelect: (source: TakeOrderItemSource) => void }) {
  return <div className="take-order-choice-grid" role="group" aria-label="Choose how to add an item">
    <button type="button" aria-pressed={selected === 'catalog'} className={cn('take-order-choice-card', selected === 'catalog' && 'is-active')} onClick={() => onSelect('catalog')}>
      <span className="take-order-choice-mark"><Boxes size={17} /></span>
      <span className="take-order-choice-copy"><strong>From catalog</strong><small>Use a saved product and price.</small></span>
      <ChevronRight size={16} aria-hidden="true" />
    </button>
    <button type="button" aria-pressed={selected === 'custom'} className={cn('take-order-choice-card', selected === 'custom' && 'is-active')} onClick={() => onSelect('custom')}>
      <span className="take-order-choice-mark is-custom"><Plus size={17} /></span>
      <span className="take-order-choice-copy"><strong>Not from catalog</strong><small>Add a one-off item from your conversation.</small></span>
      <ChevronRight size={16} aria-hidden="true" />
    </button>
  </div>;
}

function TakeOrderFeedback({ message }: { message: string | null }) {
  if (!message) return null;
  return <div className="take-order-feedback" role="alert"><AlertTriangle size={16} aria-hidden="true" /><span>{message}</span></div>;
}

function TakeOrderCheckoutCard({ items, total, feedback, onRemove, onOneOff, buttonTestId, disabled = false, className, showActions = true, showContinue = true, showPayableTotal = false }: { items: DraftOrderItem[]; total: number; feedback?: string | null; onRemove: (key: number) => void; onOneOff: () => void; buttonTestId: string; disabled?: boolean; className?: string; showActions?: boolean; showContinue?: boolean; showPayableTotal?: boolean }) {
  return <div className={cn('take-order-catalog-selection', className)}>
    <div className="take-order-section-eyebrow">Client checkout</div>
    <div className="take-order-catalog-selection-heading"><h2>{items.length ? `${items.length} items selected` : 'No items selected'}</h2>{items.length > 0 && <strong>{moneyExact(total)}</strong>}</div>
    <div className="take-order-catalog-selection-list">
      {items.length ? items.map((item) => <div key={item.key} className="take-order-catalog-selection-row"><div className="take-order-item-mark" style={{ color: item.accent }}><Package size={15} /></div><span>{item.name}</span><b>{moneyExact(item.amount)}</b><button type="button" aria-label={`Remove ${item.name}`} onClick={() => onRemove(item.key)}><X size={14} /></button></div>) : <div className="take-order-catalog-selection-empty">Your selected products will appear here.</div>}
    </div>
    {showPayableTotal && <div className="take-order-checkout-payable"><span>Total payable amount</span><strong>{moneyExact(total)}</strong></div>}
    {feedback && <TakeOrderFeedback message={feedback} />}
    {showActions && <>{showContinue && <Button type="submit" className="take-order-catalog-continue" disabled={disabled || !items.length || items.some((item) => item.amount <= 0)} data-testid={buttonTestId}>Continue <ArrowRight size={15} /></Button>}<button type="button" className="take-order-catalog-custom-link" onClick={onOneOff}>Add a one-off item instead</button></>}
  </div>;
}

function TakeOrderCustomOrderPanel({ items, total, canContinue, busy, onRemove, onUpdateAmount }: { items: DraftOrderItem[]; total: number; canContinue: boolean; busy: boolean; onRemove: (key: number) => void; onUpdateAmount: (key: number, value: string) => void }) {
  return <aside className="take-order-custom-order-panel">
    <div className="take-order-custom-order-body">
      <div className="take-order-custom-order-label">This order</div>
      {items.length ? <div className="take-order-custom-order-items">
        {items.map((item) => <div key={item.key} className="take-order-custom-order-row">
          <div className="take-order-custom-order-mark" style={{ color: item.accent }}><Package size={16} /></div>
          <div className="take-order-custom-order-copy"><strong>{item.name}</strong><span>{item.preferences.length ? `${item.preferences.length} option group${item.preferences.length === 1 ? '' : 's'}` : 'Custom item'}</span></div>
          <div className="take-order-custom-order-price"><span>{currencySymbol()}</span><input aria-label={`Price for ${item.name}`} type="number" min="0" step=".01" value={item.amount} onChange={(event) => onUpdateAmount(item.key, event.target.value)} /></div>
          <button type="button" aria-label={`Remove ${item.name}`} onClick={() => onRemove(item.key)}><X size={14} /></button>
        </div>)}
        <div className="take-order-custom-order-total"><span>Total</span><strong>{moneyExact(total)}</strong></div>
      </div> : <div className="take-order-custom-order-empty">
        <Package size={44} strokeWidth={1.35} aria-hidden="true" />
        <strong>Nothing added yet</strong>
        <span>Your order starts here.</span>
      </div>}
    </div>
    <div className="take-order-custom-order-footer">
      <span className="take-order-custom-order-hint"><ShieldIcon /> No account connection needed</span>
      <Button type="submit" className="take-order-custom-continue" disabled={!canContinue || busy} data-testid="button-create-order-link">
        {busy && <Loader2 className="animate-spin" size={15} />}Continue <ArrowRight size={15} />
      </Button>
    </div>
  </aside>;
}

function MultiItemTakeOrderModern() {
  const productsQuery = useListProducts();
  const settingsQuery = useGetSellerSettings();
  const createOrder = useCreateOrder();
  const createProduct = useCreateProduct();
  const seller = readSellerProfile();
  const [step, setStep] = useState<TakeOrderStep>(1);
  const [items, setItems] = useState<DraftOrderItem[]>([]);
  const [nextKey, setNextKey] = useState(1);
  const [itemSource, setItemSource] = useState<TakeOrderItemSource | null>('catalog');
  const [customDraft, setCustomDraft] = useState<{ name: string; amount: string; preferences: ProductPreferenceDraft[] }>({ name: '', amount: '', preferences: [] });
  const [paymentMode, setPaymentMode] = useState<'full' | 'deposit' | 'reserve'>('full');
  const [depositAmount, setDepositAmount] = useState('');
  const [deliveryFee, setDeliveryFee] = useState('0');
  const [channel, setChannel] = useState<OrderInput['channel']>('whatsapp');
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogCategory, setCatalogCategory] = useState('All');
  const [created, setCreated] = useState<Order | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  useEffect(() => {
    if (!settingsQuery.data) return;
    setPaymentMode(settingsQuery.data.paymentMode);
    setDeliveryFee(String(settingsQuery.data.deliveryFee));
  }, [settingsQuery.data]);
  const total = items.reduce((sum, item) => sum + item.amount, 0);
  const catalogProducts = productsQuery.data ?? [];
  const catalogCategories = useMemo(() => ['All', ...Array.from(new Set(catalogProducts.map((product) => product.category).filter(Boolean)))], [catalogProducts]);
  const filteredCatalogProducts = useMemo(() => {
    const search = catalogSearch.trim().toLowerCase();
    return catalogProducts.filter((product) => {
      const matchesCategory = catalogCategory === 'All' || product.category === catalogCategory;
      const matchesSearch = !search || `${product.name} ${product.category} ${product.description ?? ''}`.toLowerCase().includes(search);
      return matchesCategory && matchesSearch;
    });
  }, [catalogCategory, catalogProducts, catalogSearch]);
  const choiceOnly = step === 1 && itemSource === null && items.length === 0;
  const catalogStage = step === 1 && itemSource === 'catalog';
  const previewItems: BuyerOrderItem[] = items.length
    ? items.map((item) => ({ productId: item.productId ?? item.key, productName: item.name, amount: item.amount, variants: item.variants, preferences: item.preferences, source: item.source }))
    : [{ productId: 0, productName: 'Your item', amount: 0, variants: [], preferences: [], source: 'catalog' }];
  const busy = createOrder.isPending || createProduct.isPending;
  const deposit = Number(depositAmount);
  const validDeposit = paymentMode !== 'deposit' || (Number.isFinite(deposit) && deposit > 0 && deposit <= total);
  const deliveryFeeAmount = Number(deliveryFee);
  const validDeliveryFee = Number.isFinite(deliveryFeeAmount) && deliveryFeeAmount >= 0;
  const canContinue = step === 1
    ? items.length > 0 && items.every((item) => item.amount > 0)
    : total > 0 && validDeposit && validDeliveryFee;
  const showPreview = step === 3;

  const getErrorMessage = (error: unknown, fallback: string) => error instanceof Error && error.message ? error.message : fallback;
  const toggleCatalogProduct = (product: Product) => {
    setItems((current) => {
      const existing = current.some((item) => item.productId === product.id);
      if (existing) return current.filter((item) => item.productId !== product.id);
      return [...current, { key: nextKey, source: 'catalog', productId: product.id, name: product.name, amount: product.price, variants: product.variants, preferences: product.preferences, accent: product.accent }];
    });
    setNextKey((current) => current + 1);
    setFeedback(null);
  };
  const addCustomItem = () => {
    const amount = Number(customDraft.amount);
    if (!customDraft.name.trim() || !Number.isFinite(amount) || amount <= 0) {
      setFeedback(`Add a name and a price greater than ${currencySymbol()}0.00 before adding this item.`);
      return;
    }
    const preferences = customDraft.preferences
      .map((preference) => ({
        label: preference.label.trim(),
        options: preference.options.split(',').map((option) => option.trim()).filter(Boolean),
      }))
      .filter((preference) => preference.label && preference.options.length > 0);
    setItems((current) => [...current, { key: nextKey, source: 'custom', name: customDraft.name.trim(), amount, variants: preferences.flatMap((preference) => preference.options), preferences, accent: '#2F5BFF' }]);
    setNextKey((current) => current + 1);
    setCustomDraft({ name: '', amount: '', preferences: [] });
    setFeedback(null);
  };
  const updateCustomPreference = (index: number, key: keyof ProductPreferenceDraft, value: string) => {
    setCustomDraft((current) => ({
      ...current,
      preferences: current.preferences.map((preference, preferenceIndex) => preferenceIndex === index ? { ...preference, [key]: value } : preference),
    }));
  };
  const catalogItems = productsQuery.isLoading
    ? <div className="take-order-catalog-grid" aria-label="Loading catalog items">{[1, 2, 3, 4].map((item) => <div key={item} className="take-order-catalog-skeleton" />)}</div>
    : productsQuery.isError
      ? <div className="take-order-inline-error" role="alert">Catalog unavailable. <button type="button" onClick={() => productsQuery.refetch()}>Try again</button></div>
      : filteredCatalogProducts.length
        ? <div className="take-order-product-grid" aria-label="Catalog products">{filteredCatalogProducts.map((product) => {
          const selected = items.some((item) => item.productId === product.id);
          return <button type="button" key={product.id} className={cn('take-order-product-card', selected && 'is-selected')} onClick={() => toggleCatalogProduct(product)} aria-label={`${selected ? 'Remove' : 'Add'} ${product.name} ${selected ? 'from' : 'to'} order`} aria-pressed={selected}>
            <img src={product.imageUrl ?? productImageFor(product.name)} alt="" className="take-order-product-image" />
            <span className="take-order-product-copy"><strong>{product.name}</strong><small>{product.category || 'Catalog item'}{product.description ? ` · ${product.description}` : ''}</small><b>{moneyExact(product.price)}</b></span>
            <span className="take-order-product-add" aria-hidden="true">{selected ? <Check size={16} strokeWidth={3} /> : <Plus size={18} />}</span>
          </button>;
        })}</div>
        : <p className="take-order-help">{catalogProducts.length ? 'No products match this search.' : 'No saved products yet. Add a one-off item to start this order.'}</p>;
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
      deliveryFee: deliveryFeeAmount,
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
    const data: ProductInput = { name: item.name, category: 'Custom order', price: item.amount, cost: null, stock: 0, variants: item.variants, preferences: item.preferences, accent: item.accent };
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
    if (step === 2 && !validDeliveryFee) {
      setFeedback('The delivery fee must be $0.00 or more.');
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
     setItemSource('catalog');
     setCustomDraft({ name: '', amount: '', preferences: [] });
     setCatalogSearch('');
     setCatalogCategory('All');
    setPaymentMode('full');
    setDepositAmount('');
    setDeliveryFee('0');
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
       <PageHeading
         title="Create an order"
       />
       <TakeOrderStepRail step={step} onStepChange={setStep} />
       <div className={cn('take-order-layout', !showPreview && 'is-builder-only')}>
         <div className={cn('take-order-builder-card take-order-flow-panel', catalogStage && 'take-order-catalog-stage-card', choiceOnly && 'take-order-choice-stage-card')}>
          <form onSubmit={submit}>
                {choiceOnly && <div className="take-order-choice-stage">
                  <TakeOrderChoiceCards selected={itemSource} onSelect={(source) => { setItemSource(source); setFeedback(null); }} />
               </div>}
              {step === 1 && catalogStage && <div className={cn('take-order-catalog-stage', items.length ? 'has-selection' : 'is-empty')}>
               <div className="take-order-catalog-browser">
                  <div className="take-order-catalog-toolbar">
                    <div className="take-order-search">
                      <Search size={18} aria-hidden="true" />
                      <input aria-label="Search catalog" value={catalogSearch} onChange={(event) => setCatalogSearch(event.target.value)} placeholder="Search your catalog or type product name..." />
                    </div>
                    <button type="button" className="take-order-custom-action" onClick={() => { setItemSource('custom'); setFeedback(null); }}><Plus size={18} />Add custom item</button>
                  </div>
                  <section className="take-order-add-products" aria-label="Add products">
                    <div className="take-order-catalog-section-heading"><h2>Add products</h2></div>
                    <TakeOrderChoiceCards selected={itemSource} onSelect={(source) => { setItemSource(source); setFeedback(null); }} />
                  </section>
                  {(catalogProducts.length > 0 || productsQuery.isLoading || productsQuery.isError) && <section className="take-order-recent-products" aria-label="Recent products">
                    <div className="take-order-catalog-section-heading"><h2>{catalogSearch || catalogCategory !== 'All' ? 'Products' : 'Recent products'}</h2><span>{filteredCatalogProducts.length} available</span></div>
                    {catalogItems}
                  </section>}
                  {catalogProducts.length > 0 && <div className="take-order-categories">
                    <div className="take-order-catalog-section-heading"><h2>Categories</h2></div>
                    <div className="take-order-category-list" role="group" aria-label="Product categories">{catalogCategories.map((category) => <button type="button" key={category} className={cn('take-order-category', catalogCategory === category && 'is-active')} onClick={() => setCatalogCategory(category)} aria-pressed={catalogCategory === category}>{category}</button>)}</div>
                  </div>}
               </div>
                {items.length > 0 && <TakeOrderCheckoutCard items={items} total={total} feedback={feedback} onRemove={(key) => setItems((current) => current.filter((candidate) => candidate.key !== key))} onOneOff={() => { setItemSource('custom'); setFeedback(null); }} buttonTestId="button-continue-catalog" disabled={busy || productsQuery.isLoading} />}
              </div>}
               {step === 1 && itemSource === 'custom' && <TakeOrderSection className="take-order-one-off-section" eyebrow="Step 01 · New item" title="Build this item for the buyer." description="Name the item, set the price, and add any choices the buyer should select.">
               <div className="take-order-choice-form">
                 <div className="take-order-custom-builder">
                   <div className="take-order-custom-fields">
                     <div><label className="field-label" htmlFor="input-custom-order-name">What are they buying?</label><input id="input-custom-order-name" data-testid="input-custom-order-name" value={customDraft.name} onChange={(event) => setCustomDraft((current) => ({ ...current, name: event.target.value }))} placeholder="e.g. White leather sneakers" className="field-input" /></div>
                     <div><label className="field-label" htmlFor="input-custom-order-price">Price</label><div className="relative"><span className="take-order-currency">{currencySymbol()}</span><input id="input-custom-order-price" data-testid="input-custom-order-price" type="number" min="0.01" step=".01" value={customDraft.amount} onChange={(event) => setCustomDraft((current) => ({ ...current, amount: event.target.value }))} placeholder="0.00" className="field-input pl-7" /></div></div>
                   </div>
                   <div className="take-order-custom-preferences">
                     <div className="flex items-start justify-between gap-3"><div><div className="field-label">Buyer options <span className="font-normal text-[hsl(var(--muted-foreground))]">(optional)</span></div><p className="mt-1 text-[11px] leading-5 text-[hsl(var(--muted-foreground))]">Add choices like Size, Color, or Sneaker type.</p></div><button type="button" className="shrink-0 rounded-full border border-[hsl(var(--border))] px-2.5 py-1.5 text-[10px] font-bold" onClick={() => setCustomDraft((current) => ({ ...current, preferences: [...current.preferences, { label: '', options: '' }] }))}><Plus size={12} />Add group</button></div>
                     {customDraft.preferences.length > 0 && <div className="mt-3 space-y-2">{customDraft.preferences.map((preference, index) => <div key={index} className="catalog-preference-row"><input aria-label={`Custom option group ${index + 1} name`} value={preference.label} onChange={(event) => updateCustomPreference(index, 'label', event.target.value)} placeholder="Group name, e.g. Size" className="field-input" /><input aria-label={`Choices for custom option group ${index + 1}`} value={preference.options} onChange={(event) => updateCustomPreference(index, 'options', event.target.value)} placeholder="Choices separated by commas" className="field-input" /><button type="button" aria-label={`Remove custom option group ${index + 1}`} className="catalog-preference-remove" onClick={() => setCustomDraft((current) => ({ ...current, preferences: current.preferences.filter((_, preferenceIndex) => preferenceIndex !== index) }))}><X size={14} /></button></div>)}</div>}
                   </div>
                   <Button type="button" variant="outline" disabled={!customDraft.name.trim() || !customDraft.amount} onClick={addCustomItem}><Plus size={15} />Add item</Button>
                 </div>
               </div>
              <div className="take-order-items-heading"><div><div className="take-order-section-eyebrow">This order</div><h3>{items.length ? `${items.length} item${items.length === 1 ? '' : 's'} added` : 'Nothing added yet'}</h3></div>{items.length > 0 && <span className="take-order-total-chip">{moneyExact(total)}</span>}</div>
              <div className="take-order-item-list">
                 {items.length ? items.map((item, index) => <div key={item.key} className="take-order-item-row">
                  <div className="take-order-item-number">{String(index + 1).padStart(2, '0')}</div>
                  <div className="take-order-item-mark" style={{ color: item.accent }}><Package size={17} /></div>
                   <div className="take-order-item-copy"><strong>{item.name}</strong><span>{item.source === 'custom' ? `${item.preferences.length} buyer option${item.preferences.length === 1 ? '' : 's'}` : item.variants.length ? `${item.variants.length} variant${item.variants.length === 1 ? '' : 's'} · Catalog` : 'Catalog item'}</span></div>
                  <div className="take-order-item-price"><span className="take-order-currency">{currencySymbol()}</span><input aria-label={`Price for ${item.name}`} type="number" min="0" step=".01" value={item.amount} onChange={(event) => updateAmount(item.key, event.target.value)} className="field-input" /></div>
                  <button type="button" aria-label={`Remove ${item.name}`} onClick={() => setItems((current) => current.filter((candidate) => candidate.key !== item.key))} className="take-order-remove"><Trash2 size={15} /></button>
                 </div>) : <div className="take-order-empty-items"><PackageSearch size={22} /><strong>Your order starts here</strong><span>Choose how you want to add the first item.</span></div>}
              </div>
             </TakeOrderSection>}
              {step === 2 && <TakeOrderSection eyebrow="Step 02 · Confirm checkout" title="Review the client's checkout.">
               <TakeOrderCheckoutCard items={items} total={total} feedback={feedback} onRemove={(key) => { setItems((current) => current.filter((candidate) => candidate.key !== key)); setFeedback(null); }} onOneOff={() => { setItemSource('custom'); setStep(1); setFeedback(null); }} buttonTestId="button-payment-checkout" disabled={busy} showActions={false} showPayableTotal className="take-order-payment-checkout-card" />
               <div className="take-order-payment-config-card">
                  <div className="take-order-payment-config-heading"><div className="take-order-section-eyebrow">Payment configuration</div><h3>Set the checkout terms.</h3></div>
                 <div className="take-order-field-group"><div className="field-label">How should they pay?</div><div className="take-order-payment-options">{[['full', 'Pay in full', 'Collect the full total now'], ['deposit', 'Pay a deposit', 'Secure the order with part-payment'], ['reserve', 'Reserve it', 'Confirm the details first']].map(([value, title, note]) => <button type="button" key={value} onClick={() => { setPaymentMode(value as 'full' | 'deposit' | 'reserve'); setFeedback(null); }} data-testid={`button-payment-mode-${value}`} className={cn('take-order-payment-option', paymentMode === value && 'is-selected')}><span className="take-order-radio">{paymentMode === value && <span />}</span><span><strong>{title}</strong><small>{note}</small></span></button>)}</div></div>
                  {paymentMode === 'deposit' && <div className="take-order-deposit-field"><label className="field-label" htmlFor="input-order-deposit">Deposit amount <span>of {moneyExact(total)}</span></label><div className="take-order-deposit-presets" aria-label="Common deposit percentages">{[25, 50, 75].map((percentage) => { const presetAmount = (total * percentage / 100).toFixed(2); const isSelected = Math.abs(Number(depositAmount) - Number(presetAmount)) < 0.005; return <button type="button" key={percentage} className={cn('take-order-deposit-preset', isSelected && 'is-selected')} onClick={() => { setDepositAmount(presetAmount); setFeedback(null); }} data-testid={`button-deposit-preset-${percentage}`} aria-pressed={isSelected}><strong>{percentage}%</strong><span>{moneyExact(total * percentage / 100)}</span></button>; })}</div><div className="relative max-w-[260px]"><span className="take-order-currency">{currencySymbol()}</span><input id="input-order-deposit" data-testid="input-order-deposit" required type="number" min="0.01" max={total} step=".01" value={depositAmount} onChange={(event) => { setDepositAmount(event.target.value); setFeedback(null); }} className={cn('field-input pl-7', depositAmount && !validDeposit && 'is-invalid')} placeholder="0.00" /></div>{depositAmount && !validDeposit && <p className="take-order-field-error">Use an amount between {currencySymbol()}0.01 and {moneyExact(total)}.</p>}</div>}
                  <div className="take-order-field-group"><label className="field-label" htmlFor="input-order-delivery-fee">Flat delivery fee</label><div className="relative max-w-[260px]"><span className="take-order-currency">{currencySymbol()}</span><input id="input-order-delivery-fee" data-testid="input-order-delivery-fee" type="number" min="0" step=".01" value={deliveryFee} onChange={(event) => { setDeliveryFee(event.target.value); setFeedback(null); }} className={cn('field-input pl-7', deliveryFee && !validDeliveryFee && 'is-invalid')} placeholder="0.00" /></div><p className="take-order-field-help">Buyers can choose pickup or delivery. This flat fee is added only when they choose delivery.</p></div>
                 <div className="take-order-field-group"><div className="field-label">Conversation started on</div><ChannelPicker value={channel} onChange={setChannel} testId="select-order-channel" /></div>
               </div>
            </TakeOrderSection>}
              {step === 3 && <TakeOrderSection eyebrow="Step 03 · Review" title="Review checkout.">
                <TakeOrderCheckoutCard items={items} total={total} onRemove={(key) => setItems((current) => current.filter((candidate) => candidate.key !== key))} onOneOff={() => { setItemSource('custom'); setStep(1); setFeedback(null); }} buttonTestId="button-review-checkout" disabled={busy} showContinue={false} />
              <div className="take-order-review-details"><div><span>Payment</span><strong>{paymentMode === 'deposit' ? `Deposit · ${moneyExact(deposit)}` : paymentMode === 'full' ? 'Pay in full' : 'Reserve for later'}</strong></div><div><span>Conversation</span><strong><ChannelInline value={channel} /></strong></div></div>
              <div className="take-order-review-note"><CheckCircle2 size={17} /><div><strong>Buyer details stay with the order.</strong><span>They can add their name, phone number, notes, and an optional reference image on the next page.</span></div></div>
            </TakeOrderSection>}
              {!catalogStage && !choiceOnly && <><TakeOrderFeedback message={feedback} /><div className="take-order-form-footer">{step > 1 ? <Button type="button" variant="ghost" disabled={busy} onClick={() => setStep((current) => (current - 1) as TakeOrderStep)}><ArrowLeft size={15} />Back</Button> : <span className="take-order-footer-hint"><ShieldIcon /> No account connection needed</span>}<Button type="submit" disabled={!canContinue || busy || (step === 1 && productsQuery.isLoading)} data-testid="button-create-order-link">{busy && <Loader2 className="animate-spin" size={15} />}{step === 2 ? 'Confirm checkout' : step < 3 ? 'Continue' : 'Create buyer link'} {step < 3 ? <ArrowRight size={15} /> : <ArrowUpRight size={15} />}</Button></div></>}
          </form>
         </div>
         {showPreview && <aside className="take-order-preview-column">
           <div className="take-order-preview-heading"><div><div className="take-order-section-eyebrow">Buyer preview</div><h2>What your buyer sees</h2><span className="take-order-preview-status"><span />Updates as you build</span></div><Eye size={17} aria-hidden="true" /></div>
          <div className="take-order-preview-frame"><BuyerOrderSurface businessName={settingsQuery.data?.businessName || seller?.businessName || 'The Sunday Edit'} description={settingsQuery.data?.description || seller?.description} logoDataUrl={settingsQuery.data?.logoDataUrl} items={previewItems} paymentMode={paymentMode} depositAmount={paymentMode === 'deposit' ? deposit : null}>{(activeItem) => <div className="space-y-5"><div><label className="field-label">Your name</label><input disabled placeholder="Full name" className="field-input" /></div><div><label className="field-label">Phone number</label><input disabled placeholder="Best number to reach you" className="field-input" /></div>{activeItem.preferences.length > 0 && <div><label className="field-label">Choose your options</label><div className="space-y-3">{activeItem.preferences.map((preference) => <div key={preference.label}><span className="text-xs font-semibold">{preference.label}</span><div className="mt-2 flex flex-wrap gap-2">{preference.options.map((option) => <span key={option} className="rounded-full border border-[hsl(var(--border))] px-3 py-1.5 text-xs">{option}</span>)}</div></div>)}</div></div>}<div><label className="field-label">Details for the seller <span className="font-normal text-[hsl(var(--muted-foreground))]">(optional)</span></label><textarea disabled placeholder="Size, color, delivery note, or anything already agreed..." rows={3} className="field-input resize-none" /></div>{paymentMode !== 'reserve' && <div className="grid grid-cols-2 gap-2"><div className="rounded-[10px] border border-[hsl(var(--primary))] bg-[hsl(var(--primary))] p-3 text-left text-xs font-bold text-white">{paymentMode === 'deposit' ? `Pay deposit · ${depositAmount ? moneyExact(deposit) : '—'}` : `Pay ${moneyExact(total)}`}</div><div className="rounded-[10px] border border-[hsl(var(--border))] p-3 text-left text-xs font-bold">Reserve for later</div></div>}<button type="button" disabled className="flex w-full items-center justify-center gap-2 rounded-[10px] bg-[hsl(var(--primary))] py-3.5 text-sm font-bold text-white opacity-70">{paymentMode === 'reserve' ? 'Reserve these items' : 'Continue to mock payment'} <ArrowUpRight size={15} /></button></div>}</BuyerOrderSurface></div>
          <div className="take-order-preview-note"><Eye size={15} /><span>Preview updates as you build. The buyer link will open the full page.</span></div>
         </aside>}
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
    ? items.map((item) => ({ productId: item.productId ?? item.key, productName: item.name, amount: item.amount, variants: item.variants, preferences: item.preferences, source: item.source }))
    : [{ productId: 0, productName: 'Your item', amount: 0, variants: [], preferences: [], source: 'catalog' }];
  const busy = createOrder.isPending || createProduct.isPending;
  const canContinue = step === 1
    ? items.length > 0
    : total > 0 && (paymentMode !== 'deposit' || (Boolean(depositAmount) && Number(depositAmount) <= total));

  const addCatalogItem = () => {
    const product = (productsQuery.data ?? []).find((item) => item.id === Number(catalogChoice));
    if (!product) return;
    setItems((current) => [...current, { key: nextKey, source: 'catalog', productId: product.id, name: product.name, amount: product.price, variants: product.variants, preferences: product.preferences, accent: product.accent }]);
    setNextKey((current) => current + 1);
    setCatalogChoice('');
  };
  const addCustomItem = () => {
    const amount = Number(customDraft.amount);
    if (!customDraft.name.trim() || !Number.isFinite(amount) || amount < 0) return;
    setItems((current) => [...current, { key: nextKey, source: 'custom', name: customDraft.name.trim(), amount, variants: [], preferences: [], accent: '#2F5BFF' }]);
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
    const data: ProductInput = { name: item.name, category: 'Custom order', price: item.amount, cost: null, stock: 0, variants: [], preferences: [], accent: item.accent };
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
  logoDataUrl?: string | null;
  productName?: string;
  amount?: number;
  paymentMode: 'full' | 'deposit' | 'reserve';
  depositAmount: number | null | undefined;
  totalAmount?: number;
  variants?: string[];
  items?: BuyerOrderItem[];
  previewImages?: Array<string | undefined>;
  activeIndex?: number;
  onActiveIndexChange?: (index: number) => void;
  isCheckout?: boolean;
  children: ReactNode | ((item: BuyerOrderItem) => ReactNode);
};

type BuyerOrderItem = {
  productId: number;
  productName: string;
  amount: number;
  quantity?: number;
  variants: string[];
  preferences: ProductPreferenceGroup[];
  imageUrl?: string;
  imageUrls?: string[];
  sku?: string | null;
  description?: string | null;
  compareAtPrice?: number | null;
  stock?: number;
  available?: boolean;
  source: 'catalog' | 'custom';
};

export function BuyerOrderSurface({ businessName, description, logoDataUrl, productName, amount, paymentMode, depositAmount, totalAmount, variants = [], items, previewImages, activeIndex: controlledIndex, onActiveIndexChange, isCheckout = false, children }: BuyerOrderSurfaceProps) {
  const displayItems = items?.length ? items : [{ productId: 0, productName: productName || 'Your item', amount: amount || 0, variants, preferences: variants.length ? [{ label: 'Choose an option', options: variants }] : [], source: 'catalog' as const }];
  const [internalIndex, setInternalIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const activeIndex = Math.min(controlledIndex ?? internalIndex, displayItems.length - 1);
  const activeItem = displayItems[activeIndex]!;
  const total = totalAmount ?? displayItems.reduce((sum, item) => sum + item.amount * (item.quantity ?? 1), 0);
  const sellerDescription = description?.trim();
  useEffect(() => setInternalIndex(0), [displayItems.length]);
  const move = (direction: -1 | 1) => {
    const nextIndex = (activeIndex + direction + displayItems.length) % displayItems.length;
    if (onActiveIndexChange) onActiveIndexChange(nextIndex);
    else setInternalIndex(nextIndex);
  };
  const handleTouchEnd = (event: React.TouchEvent) => {
    const start = touchStartX.current;
    touchStartX.current = null;
    if (start == null || displayItems.length < 2 || onActiveIndexChange) return;
    const delta = event.changedTouches[0]!.clientX - start;
    if (Math.abs(delta) > 36) move(delta < 0 ? 1 : -1);
  };
  return <div className="buyer-checkout-surface">
    <div className="buyer-checkout-header-row">
      <header className="buyer-checkout-brand-bar">
        <div className="buyer-seller-identity">
          <SellerLogo businessName={businessName} logoDataUrl={logoDataUrl ?? undefined} className="buyer-seller-logo buyer-app-seller-mark" />
          <div className="buyer-seller-copy">
            <strong>{businessName}</strong>
            {sellerDescription && <p>{sellerDescription}</p>}
          </div>
        </div>
      </header>
      <div className="buyer-checkout-form-intro">
        <h1>Complete your order.</h1>
        <p>Your seller already has the item and price. Just provide the details they need to fulfill it.</p>
        <div className="buyer-total-amount" aria-label={`Total amount ${moneyExact(total)}`}><span>Total amount</span><strong>{moneyExact(total)}</strong></div>
      </div>
    </div>
    <div className="buyer-order-detail-layout">
      <div className="buyer-order-detail-card p-6 sm:p-8">
        {typeof children === 'function' ? children(activeItem) : children}
      </div>
      <aside className="buyer-product-rail" aria-label={displayItems.length > 1 ? 'Order items' : 'Product preview'}>
        <div className="buyer-product-rail-heading">Order items</div>
        <div className="buyer-product-list">
        {displayItems.map((item, index) => {
          const active = index === activeIndex;
            const previewImage = item.source === 'custom'
              ? previewImages?.[index] || item.imageUrls?.[0] || item.imageUrl
              : item.imageUrls?.[0] || item.imageUrl || productImageFor(item.productName);
          return <button
            type="button"
            key={`${item.productId}-${index}`}
            className={cn('buyer-product-module', active && 'is-active')}
            onClick={() => {
              if (onActiveIndexChange) onActiveIndexChange(index);
              else setInternalIndex(index);
            }}
            disabled={Boolean(onActiveIndexChange)}
            aria-current={active ? 'true' : undefined}
             aria-label={`${item.productName}, ${moneyExact(item.amount)}${active ? ', current item' : ''}`}
          >
            <span className="buyer-product-module-copy">
              <strong>{item.productName}</strong>
               <small className="buyer-product-module-price">{moneyExact(item.amount)} · qty {item.quantity ?? 1}</small>
             </span>
              <span className="buyer-product-module-art">
                {previewImage && <img src={previewImage} alt="" />}
              </span>
          </button>;
        })}
        </div>
      </aside>
    </div>
    <PoweredByTakeOrder className="mt-6" />
  </div>;
}

type BuyerOrderFormValues = {
  name: string;
  phone: string;
  deliveryMethod?: 'pickup' | 'delivery';
  address?: string;
  orderDetails?: string;
  details?: string;
  image?: string;
  imagePreview?: string;
  action?: 'pay' | 'reserve';
};

type BuyerItemFormValues = {
  preferences: Record<string, string>;
  details: string;
  image: string;
  imagePreview: string;
  quantity: number;
};

const emptyBuyerItemForm = (): BuyerItemFormValues => ({ preferences: {}, details: '', image: '', imagePreview: '', quantity: 1 });

function PublicOrderPage() {
  const { token = '' } = useParams<{ token: string }>();
  const query = useGetPublicOrder(token, { query: { enabled: Boolean(token), queryKey: getGetPublicOrderQueryKey(token) } });
  const submit = useSubmitPublicOrder();
  const queryClient = useQueryClient();
  const [submitted, setSubmitted] = useState(false);
  const [showMockPayment, setShowMockPayment] = useState(false);
  const [mockPayment, setMockPayment] = useState({ cardNumber: '', expiry: '', cvc: '' });
  const [form, setForm] = useState<BuyerOrderFormValues>({ name: '', phone: '', address: '', orderDetails: '' });
  const [contactComplete, setContactComplete] = useState(false);
  const [contactStep, setContactStep] = useState(false);
  const [itemStep, setItemStep] = useState(0);
  const [checkout, setCheckout] = useState(false);
  const [itemForms, setItemForms] = useState<BuyerItemFormValues[]>([]);
  const [submitError, setSubmitError] = useState('');
  const order = query.data;
  setActiveCurrency(order?.currency ?? 'GHS');
  useEffect(() => {
    if (order) invalidateDashboardSummary(queryClient);
  }, [order, queryClient]);
  useEffect(() => {
    if (!order) return;
    setItemForms((current) => order.items.map((_, index) => current[index] ?? emptyBuyerItemForm()));
    setContactComplete(false);
    setContactStep(false);
    setItemStep(0);
    setCheckout(false);
    setForm({ name: '', phone: '', deliveryMethod: order.deliveryDefault === 'delivery' ? 'delivery' : 'pickup', address: '', orderDetails: '' });
  }, [order?.token, order?.items.length]);
  const change = (key: 'name' | 'phone' | 'deliveryMethod' | 'address' | 'orderDetails' | 'details', value: string) => {
    if (key === 'details') {
      setItemForms((current) => current.map((item, index) => index === itemStep ? { ...item, details: value } : item));
      return;
    }
    setForm((current) => ({ ...current, [key]: key === 'deliveryMethod' ? value as 'pickup' | 'delivery' : value }));
  };
  const changeItem = (key: Exclude<keyof BuyerItemFormValues, 'quantity'>, value: string) => {
    setItemForms((current) => current.map((item, index) => index === itemStep ? { ...item, [key]: value } : item));
  };
  const changeQuantity = (value: number) => {
    setItemForms((current) => current.map((item, index) => index === itemStep ? { ...item, quantity: value } : item));
  };
  const submitForm = (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitError('');
    const activeItem = order?.items[itemStep];
    const activeForm = itemForms[itemStep] ?? emptyBuyerItemForm();
    if (!checkout) {
      if (contactStep) {
        if (!form.name.trim() || !form.phone.trim() || form.phone.trim().length < 5) return;
        if (!form.deliveryMethod) return;
        if (form.deliveryMethod === 'delivery' && !form.address?.trim()) return;
        setContactComplete(true);
        setContactStep(false);
        setCheckout(true);
        return;
      }
      const missingPreference = activeItem?.preferences.some((group) => !activeForm.preferences[group.label]);
      const missingImage = order?.checkoutAllowReferenceImages !== false && activeItem?.source === 'custom' && !activeForm.imagePreview;
      if (missingPreference || missingImage) return;
      if (order && itemStep < order.items.length - 1) {
        setItemStep((current) => current + 1);
      } else {
        setContactStep(true);
      }
      return;
    }
    const paymentAction = order?.paymentMode === 'reserve' ? 'reserve' : form.action;
    if (!paymentAction) return;
    const data: PublicOrderInput = {
      customerName: form.name.trim(),
      customerPhone: form.phone.trim(),
      buyerDetails: form.orderDetails?.trim() || undefined,
      deliveryMethod: form.deliveryMethod,
      deliveryAddress: form.deliveryMethod === 'delivery' ? form.address?.trim() || undefined : undefined,
        itemDetails: itemForms.map((item, itemIndex) => ({
        itemIndex,
          quantity: item.quantity,
          variant: Object.values(item.preferences).filter(Boolean).join(' · ') || undefined,
        details: item.details || undefined,
        referenceImage: item.image || undefined,
      })),
      paymentAction,
    };
    submit.mutate({ token, data }, {
      onSuccess: () => { invalidateDashboardSummary(queryClient); setSubmitted(true); },
      onError: (error) => setSubmitError(error instanceof Error && error.message ? error.message : 'Your order could not be sent. Check your connection and try again.'),
    });
  };
  if (query.isLoading) return <div className="min-h-[100dvh] bg-[hsl(var(--background))] p-6"><div className="mx-auto max-w-[480px]"><BrandLockup className="mx-auto mt-14 justify-center" /><Skeleton className="mx-auto mt-8 h-8 w-52" /><Skeleton className="mt-4 h-4 w-full" /><Skeleton className="mt-10 h-64 w-full" /></div></div>;
  if (query.isError || !order) return <div className="flex min-h-[100dvh] items-center justify-center p-6"><div className="text-center"><BrandLockup className="justify-center" /><div className="mt-10 font-display text-2xl font-bold">This link is no longer available.</div><p className="mt-3 text-sm text-[hsl(var(--muted-foreground))]">Ask the seller for a fresh order link.</p></div></div>;
  if (submitted) return <div className="flex min-h-[100dvh] items-center justify-center bg-[hsl(var(--background))] p-6"><div className="w-full max-w-[480px] text-center page-in"><BrandLockup className="justify-center" /><div className="mx-auto mt-10 flex h-16 w-16 items-center justify-center rounded-[20px] bg-[hsl(var(--accent))] text-white"><Check size={30} /></div><h1 className="mt-7 font-display text-4xl font-bold tracking-[-.05em]">You’re all set.</h1><p className="mx-auto mt-4 max-w-[350px] text-sm leading-6 text-[hsl(var(--muted-foreground))]">{form.action === 'pay' && order.paymentMode !== 'reserve' ? 'Your mock payment and order details were sent to the seller. No real payment was processed.' : 'Your details have been sent to the seller. They’ll be in touch with the next step.'}</p><div className="mt-8 font-mono-ui text-[10px] uppercase tracking-[.15em] text-[hsl(var(--muted-foreground))]">Order reference · {token.slice(0, 8)}</div></div></div>;
  const orderSubtotal = itemForms.length === order.items.length
    ? order.items.reduce((sum, item, index) => sum + item.amount * (itemForms[index]?.quantity ?? item.quantity ?? 1), 0)
    : order.subtotal ?? order.items.reduce((sum, item) => sum + item.amount * (item.quantity ?? 1), 0);
  const buyerDeliveryFee = form.deliveryMethod === 'delivery' ? order.deliveryFee : 0;
  const buyerTotal = orderSubtotal + buyerDeliveryFee;
  const currentItemForm = itemForms[itemStep] ?? emptyBuyerItemForm();
   return <div className="min-h-[100dvh] bg-[hsl(var(--background))] px-5 py-4 sm:py-8"><div className="mx-auto max-w-[920px]"><BuyerOrderSurface businessName={order.businessName || 'The Sunday Edit'} description={order.businessDescription} logoDataUrl={order.logoDataUrl} productName={order.productName} amount={orderSubtotal} totalAmount={buyerTotal} paymentMode={order.paymentMode} depositAmount={order.depositAmount} variants={order.variants} items={order.items.map((item, index) => ({ ...item, quantity: itemForms[index]?.quantity ?? item.quantity ?? 1 }))} previewImages={itemForms.map((item) => item.imagePreview)} activeIndex={itemStep} onActiveIndexChange={() => undefined} isCheckout={checkout}>{(activeItem) => <BuyerOrderForm paymentMode={order.paymentMode} amount={buyerTotal} depositAmount={order.depositAmount ?? 0} deliveryFee={order.deliveryFee} askForDetails={order.checkoutAskForDetails} allowReferenceImages={order.checkoutAllowReferenceImages} item={activeItem} itemIndex={itemStep} itemCount={order.items.length} items={order.items} itemForms={itemForms} contactStep={contactStep} contactComplete={contactComplete} checkout={checkout} form={form} itemForm={currentItemForm} mockPayment={mockPayment} showMockPayment={showMockPayment} submitPending={submit.isPending} submitError={submitError} onSubmit={submitForm} onChange={change} onItemChange={changeItem} onQuantityChange={changeQuantity} onPreferenceChange={(label, value) => setItemForms((current) => current.map((item, index) => index === itemStep ? { ...item, preferences: { ...item.preferences, [label]: value } } : item))} onBack={() => { if (checkout) { setCheckout(false); setShowMockPayment(false); setContactComplete(false); setContactStep(false); } else if (contactStep) { setContactStep(false); } else if (itemStep > 0) { setItemStep((current) => current - 1); } }} onBackToReview={() => setShowMockPayment(false)} onMockPaymentChange={(key, value) => setMockPayment((current) => ({ ...current, [key]: value }))} onReferenceImageChange={(event) => { const file = event.target.files?.[0]; if (!file) return; changeItem('image', file.name); changeItem('imagePreview', URL.createObjectURL(file)); }} onPaymentAction={(action) => { setForm((current) => ({ ...current, action })); setShowMockPayment(false); }} />}</BuyerOrderSurface><div className="mt-6 text-center font-mono-ui text-[9px] uppercase tracking-[.15em] text-[hsl(var(--muted-foreground))]">Powered by Take Order · made for small businesses</div></div></div>;
}

export function Connect() {
  const health = useHealthCheck();
  const settingsQuery = useGetSellerSettings();
  const saveSettingsMutation = useUpdateSellerSettings();
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
    if (settingsQuery.data?.connectedTools) {
      setConnected(settingsQuery.data.connectedTools);
      return;
    }
    const storage = getPreferenceStorage();
    if (!storage) return;

    return subscribeToPreferenceChanges(CONNECTED_TOOLS_KEY, (event) => {
      if (event.storageArea && event.storageArea !== storage) return;
      setConnected(readConnectedTools(storage));
    });
  }, [settingsQuery.data?.connectedTools]);
  const persistTools = (next: string[]) => {
    writeConnectedTools(next);
    if (settingsQuery.data) {
      saveSettingsMutation.mutate({ data: { ...settingsQuery.data, connectedTools: next } });
    }
  };
  const toggle = (name: string) => setConnected((current) => {
    const next = togglePreference(current, name);
    persistTools(next);
    return next;
  });
  const clearAll = () => {
    const next = clearPreferences();
    clearConnectedTools();
    setConnected(next);
    persistTools(next);
  };
   return <Shell><div className="mx-auto max-w-[1060px]"><div className="mx-auto max-w-[640px] text-center"><div className="font-mono-ui text-[10px] font-bold uppercase tracking-[.18em] text-[hsl(var(--muted-foreground))]">Optional setup</div><h1 className="mt-3 font-display text-[clamp(36px,5vw,58px)] font-bold leading-[.95] tracking-[-.065em]">Let’s get your tools in one view.</h1><p className="mx-auto mt-4 max-w-[560px] text-sm leading-6 text-[hsl(var(--muted-foreground))]">Choose the places you already sell or get paid. This saves a local preference for now — it does not authorize an integration.</p><div className="mt-4 inline-flex items-center gap-2 rounded-full border border-[hsl(var(--accent))]/35 bg-[hsl(var(--accent))]/10 px-3 py-2 text-[11px] font-semibold text-[hsl(var(--accent-foreground))]"><ShieldIcon />Take Order never reads personal chats.</div></div><div className="mt-10 flex flex-col gap-3 border-b border-[hsl(var(--border))] pb-3 sm:flex-row sm:items-center sm:justify-between"><div className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">Your channels and tools</div><div className="flex flex-wrap items-center gap-3"><span className="flex items-center gap-1.5 text-[10px] font-semibold text-[hsl(var(--muted-foreground))]"><span className={cn('h-2 w-2 rounded-full', health.isError ? 'bg-[hsl(var(--destructive))]' : 'bg-[hsl(var(--accent))]')} />{health.isError ? 'Workspace check unavailable' : 'Workspace ready'}</span><Button type="button" variant="outline" onClick={clearAll} disabled={!connected.length} data-testid="button-clear-connected-tools">Clear all saved choices</Button></div></div><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{tools.map((tool) => { const isConnected = connected.includes(tool.name); const mark = markCatalog[tool.markKey]; return <button key={tool.name} onClick={() => toggle(tool.name)} aria-pressed={isConnected} aria-label={connectPreferenceAriaLabel(tool.name, isConnected)} data-testid={`button-connect-${tool.name.toLowerCase().replaceAll(' ', '-')}`} className={cn('tool-tile soft-focus group rounded-[17px] border p-4 text-left', isConnected ? 'border-[hsl(var(--accent))]/55 bg-[hsl(var(--accent))]/10' : 'border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:border-[hsl(var(--muted-foreground))]/45')}><div className="flex items-start justify-between"><div className="tool-mark flex h-11 w-11 items-center justify-center rounded-[13px] bg-[hsl(var(--muted))]" style={{ color: mark.color }}><ChannelMark value={tool.markKey} size={22} /></div><span className={cn('rounded-full px-2 py-1 text-[9px] font-bold', isConnected ? 'bg-[hsl(var(--accent))]/20 text-[hsl(var(--accent-foreground))]' : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]')}>{connectPreferenceLabel(isConnected)}</span></div><div className="mt-5 flex items-end justify-between gap-2"><div><div className="text-sm font-bold">{tool.name}</div><div className="mt-1 text-[11px] leading-4 text-[hsl(var(--muted-foreground))]">{tool.detail}</div></div><span className="font-mono-ui text-[9px] uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">{tool.group}</span></div></button>; })}</div><div className="mt-8 grid gap-4 lg:grid-cols-[1.15fr_.85fr]"><Card className="flex gap-4 p-5"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"><Link2 size={17} /></div><div><h2 className="text-sm font-bold">A connection is never required to sell.</h2><p className="mt-2 text-xs leading-5 text-[hsl(var(--muted-foreground))]">Create buyer links, collect details, and track inventory without connecting a social or payment account. These tiles are simply your setup checklist until real integrations are attached.</p></div></Card><Card className="p-5"><div className="flex items-center gap-2 text-xs font-bold"><Check size={15} className="text-[hsl(var(--accent-foreground))]" />{connected.length ? `${connected.length} tool preference${connected.length === 1 ? '' : 's'} saved` : 'No tool preferences yet'}</div><p className="mt-2 text-[11px] leading-5 text-[hsl(var(--muted-foreground))]">You can change these choices any time. They stay on this device.</p></Card></div></div></Shell>;
}
type SettingsSectionId = 'general' | 'payments' | 'checkout' | 'delivery' | 'workflow' | 'domains' | 'membership' | 'seo' | 'advanced' | 'details' | 'billing' | 'staff' | 'integrations';

const settingsGroups: Array<{ label: string; items: Array<{ id: SettingsSectionId; label: string; description: string; icon: typeof Settings2 }> }> = [
  {
    label: 'Store',
    items: [
      { id: 'general', label: 'General', description: 'Your shop identity and public profile.', icon: Store },
      { id: 'payments', label: 'Payments', description: 'How buyers pay and reserve orders.', icon: CreditCard },
      { id: 'checkout', label: 'Checkout', description: 'The details buyers provide at checkout.', icon: ShoppingBag },
      { id: 'delivery', label: 'Delivery', description: 'Pickup, delivery, and fulfilment defaults.', icon: Truck },
      { id: 'workflow', label: 'Workflow', description: 'Notifications and workspace behaviour.', icon: Workflow },
      { id: 'domains', label: 'Domains', description: 'Your buyer link and custom domains.', icon: Globe2 },
      { id: 'membership', label: 'Membership', description: 'Plan and workspace access.', icon: WalletCards },
      { id: 'seo', label: 'SEO and trackings', description: 'Search previews and campaign tracking.', icon: SearchCheck },
      { id: 'advanced', label: 'Advanced', description: 'Data, privacy, and developer options.', icon: Wrench },
    ],
  },
  {
    label: 'Organization',
    items: [
      { id: 'details', label: 'Details', description: 'Business information and contact details.', icon: FileText },
      { id: 'billing', label: 'Billing', description: 'Invoices and payment history.', icon: ReceiptText },
      { id: 'staff', label: 'Staff', description: 'People who can manage this workspace.', icon: UsersRound },
      { id: 'integrations', label: 'Integrations', description: 'Connected sales and payment tools.', icon: Link2 },
    ],
  },
];

const settingsItem = (id: SettingsSectionId) => settingsGroups.flatMap((group) => group.items).find((item) => item.id === id)!;

function SettingsToggle({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="settings-row settings-toggle-row">
    <span><span className="block text-sm font-semibold">{label}</span><span className="mt-1 block text-xs leading-5 text-[hsl(var(--muted-foreground))]">{description}</span></span>
    <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="sr-only" />
    <span className={cn('settings-switch', checked && 'is-on')} aria-hidden="true"><span /></span>
  </label>;
}

function SettingsPage() {
  const queryClient = useQueryClient();
  const [activeSection, setActiveSection] = useState<string>('general');
  const [profile, setProfile] = useState<SellerProfile>(() => readSellerProfile() || { sellerName: '', businessName: '', description: '', channels: [] });
  const [preferences, setPreferences] = useState<SellerSettingsPreferences>(() => readSellerSettings());
  const settingsQuery = useGetSellerSettings();
  const saveSettingsMutation = useUpdateSellerSettings();
  const [settings, setSettings] = useState<SellerSettings>(emptySellerSettings);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [logoError, setLogoError] = useState('');
  const active = settingsItem(activeSection as SettingsSectionId);

  useEffect(() => {
    if (!settingsQuery.data) return;
    const local = readSellerProfile();
    const next = {
      ...settingsQuery.data,
      sellerName: settingsQuery.data.sellerName || local?.sellerName || '',
      businessName: settingsQuery.data.businessName || local?.businessName || '',
      description: settingsQuery.data.description || local?.description || '',
      channels: settingsQuery.data.channels.length ? settingsQuery.data.channels : local?.channels || [],
      logoDataUrl: settingsQuery.data.logoDataUrl || local?.logoDataUrl || null,
    };
    setSettings(next);
    setProfile({
      sellerName: next.sellerName,
      businessName: next.businessName,
      description: next.description,
      channels: next.channels,
      ...(next.logoDataUrl ? { logoDataUrl: next.logoDataUrl } : {}),
    });
    setPreferences({ orderUpdates: next.orderUpdates, stockAlerts: next.stockAlerts, compactTables: next.compactTables });
  }, [settingsQuery.data]);

  const updateProfile = (key: keyof SellerProfile, value: string) => {
    setProfile((current) => ({ ...current, [key]: value }));
    if (key !== 'logoDataUrl') setSettings((current) => ({ ...current, [key]: value }));
    setSaved(false);
    setSaveError('');
  };
  const saveProfile = () => {
    writeSellerProfile(profile);
    saveSettingsMutation.mutate({ data: settings }, {
      onSuccess: (data) => {
        setSettings(data);
        setSaved(true);
        setSaveError('');
        queryClient.setQueryData(getGetSellerSettingsQueryKey(), data);
      },
      onError: (error) => setSaveError(error instanceof Error ? error.message : 'Your settings could not be saved.'),
    });
  };
  const handleLogoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setLogoError('Choose an image file.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setLogoError('Choose an image smaller than 2 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') return;
      setLogoError('');
      const logoDataUrl = reader.result as string;
      setProfile((current) => ({ ...current, logoDataUrl }));
      setSettings((current) => ({ ...current, logoDataUrl }));
      setSaved(false);
    };
    reader.onerror = () => setLogoError('That image could not be read. Try another file.');
    reader.readAsDataURL(file);
  };
  const removeLogo = () => {
    setProfile((current) => {
      const next = { ...current };
      delete next.logoDataUrl;
      return next;
    });
    setSettings((current) => ({ ...current, logoDataUrl: null }));
    setSaved(false);
  };
  const setPreference = (key: keyof SellerSettingsPreferences, value: boolean) => {
    setPreferences((current) => ({ ...current, [key]: value }));
    setSettings((current) => ({ ...current, [key]: value }));
    setSaved(false);
  };
  const setSetting = <K extends keyof SellerSettings>(key: K, value: SellerSettings[K]) => {
    setSettings((current) => ({ ...current, [key]: value }));
    setSaved(false);
    setSaveError('');
  };
  const saveSettings = () => {
    setSaveError('');
    saveSettingsMutation.mutate({ data: settings }, {
      onSuccess: (data) => {
        setSettings(data);
        setProfile({
          sellerName: data.sellerName,
          businessName: data.businessName,
          description: data.description,
          channels: data.channels,
          ...(data.logoDataUrl ? { logoDataUrl: data.logoDataUrl } : {}),
        });
        writeSellerProfile({
          sellerName: data.sellerName,
          businessName: data.businessName,
          description: data.description,
          channels: data.channels,
          ...(data.logoDataUrl ? { logoDataUrl: data.logoDataUrl } : {}),
        });
        setSaved(true);
        queryClient.setQueryData(getGetSellerSettingsQueryKey(), data);
      },
      onError: (error) => setSaveError(error instanceof Error ? error.message : 'Your settings could not be saved.'),
    });
  };

  const renderSettingsContent = () => {
    if (settingsQuery.isLoading) return <div className="settings-card"><div className="flex items-center gap-3 text-sm font-semibold"><Loader2 size={16} className="animate-spin" />Loading saved settings</div><p className="mt-2 text-xs leading-5 text-[hsl(var(--muted-foreground))]">Your workspace settings are being restored.</p></div>;
    if (settingsQuery.isError) return <div className="settings-card"><div className="text-sm font-semibold">Settings could not be loaded</div><p className="mt-2 text-xs leading-5 text-[hsl(var(--muted-foreground))]">Your saved settings are still safe. Try again to continue.</p><Button type="button" variant="outline" className="mt-4" onClick={() => settingsQuery.refetch()}>Try again</Button></div>;
    const saveAction = <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[hsl(var(--border))] pt-5"><p className="text-xs text-[hsl(var(--muted-foreground))]">{saveError || (saved ? 'Saved to your seller workspace.' : 'Changes are ready to save.')}</p><Button type="button" onClick={saveSettings} disabled={saveSettingsMutation.isPending}>{saveSettingsMutation.isPending && <Loader2 size={15} className="animate-spin" />}{saved ? <><Check size={15} />Saved</> : 'Save changes'}</Button></div>;
    if (activeSection === 'general') return <div className="space-y-5">
      <div className="settings-card flex flex-col gap-5 sm:flex-row sm:items-center">
        <SellerLogo businessName={settings.businessName || 'Your shop'} logoDataUrl={settings.logoDataUrl ?? undefined} className="settings-profile-logo" />
        <div className="min-w-0 flex-1"><div className="text-sm font-semibold">{settings.logoDataUrl ? 'Your logo is ready' : 'Add a business logo'}</div><p className="mt-1 text-xs leading-5 text-[hsl(var(--muted-foreground))]">Use a square PNG, JPG, WebP, or SVG up to 2 MB. It appears on buyer order pages.</p><div className="mt-3 flex flex-wrap gap-2"><label className="inline-flex cursor-pointer items-center gap-2 rounded-[10px] bg-[hsl(var(--primary))] px-3 py-2 text-[11px] font-semibold text-[hsl(var(--primary-foreground))]"><ImagePlus size={14} />{settings.logoDataUrl ? 'Replace logo' : 'Upload logo'}<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" tabIndex={-1} className="sr-only" onChange={handleLogoChange} data-testid="input-settings-logo" /></label>{settings.logoDataUrl && <button type="button" onClick={removeLogo} className="inline-flex items-center gap-2 rounded-[10px] border border-[hsl(var(--border))] px-3 py-2 text-[11px] font-semibold hover:bg-[hsl(var(--muted))]" data-testid="button-remove-settings-logo"><X size={14} />Remove</button>}</div>{logoError && <p role="alert" className="mt-2 text-xs text-[hsl(var(--destructive))]">{logoError}</p>}</div>
      </div>
      <div className="settings-card grid gap-5 sm:grid-cols-2">
        <div><label className="field-label" htmlFor="settings-seller-name">Your name</label><input id="settings-seller-name" data-testid="input-settings-seller-name" className="field-input" value={settings.sellerName} onChange={(event) => updateProfile('sellerName', event.target.value)} placeholder="e.g. Amina Mensah" /></div>
        <div><label className="field-label" htmlFor="settings-business-name">Business or shop name</label><input id="settings-business-name" data-testid="input-settings-business-name" className="field-input" value={settings.businessName} onChange={(event) => updateProfile('businessName', event.target.value)} placeholder="e.g. The Sunday Edit" /></div>
        <div className="sm:col-span-2"><label className="field-label" htmlFor="settings-description">Short shop description</label><textarea id="settings-description" data-testid="input-settings-description" className="field-input resize-none leading-6" rows={4} value={settings.description} onChange={(event) => updateProfile('description', event.target.value)} placeholder="Tell buyers what you sell and where they can find you." /></div>
        <div className="sm:col-span-2"><label className="field-label" htmlFor="settings-currency">Store currency</label><select id="settings-currency" data-testid="select-settings-currency" className="field-input" value={settings.currency} onChange={(event) => setSetting('currency', event.target.value as SellerSettings['currency'])}>{storeCurrencyOptions.map((option) => <option key={option.currency} value={option.currency}>{option.label} ({option.currency})</option>)}</select><p className="mt-2 text-xs leading-5 text-[hsl(var(--muted-foreground))]">This currency is used for your dashboard, seller tools, and every buyer link. Prices are not automatically converted.</p></div>
        {saveAction}
      </div>
      <div className="settings-card"><div className="flex items-center gap-2 text-sm font-semibold"><Store size={16} />Public storefront</div><p className="mt-2 text-xs leading-5 text-[hsl(var(--muted-foreground))]">These saved details appear on shared buyer order pages.</p><div className="mt-4 flex flex-wrap gap-2">{profile.channels.length ? profile.channels.map((channel) => <span key={channel} className="rounded-full bg-[hsl(var(--muted))] px-3 py-1.5 text-[11px] font-semibold">{channel}</span>) : <span className="text-xs text-[hsl(var(--muted-foreground))]">No sales channels selected yet.</span>}</div></div>
    </div>;
    if (activeSection === 'workflow') return <div className="settings-card divide-y divide-[hsl(var(--border))] p-0"><SettingsToggle label="Order updates" description="Keep order status changes visible in the workspace." checked={settings.orderUpdates} onChange={(value) => setPreference('orderUpdates', value)} /><SettingsToggle label="Stock alerts" description="Highlight products that are running low or out of stock." checked={settings.stockAlerts} onChange={(value) => setPreference('stockAlerts', value)} /><SettingsToggle label="Compact tables" description="Use tighter rows when scanning orders, clients, and expenses." checked={settings.compactTables} onChange={(value) => setPreference('compactTables', value)} /><div className="p-5">{saveAction}</div></div>;
    if (activeSection === 'payments') return <div className="space-y-5"><div className="settings-card"><div className="flex items-start justify-between gap-4"><div><h3 className="text-sm font-semibold">Payment behaviour</h3><p className="mt-1 text-xs leading-5 text-[hsl(var(--muted-foreground))]">This default is used when you create a new buyer order link.</p></div><WalletCards size={19} className="text-[hsl(var(--muted-foreground))]" /></div><label className="field-label mt-5" htmlFor="settings-payment-mode">Default payment mode</label><select id="settings-payment-mode" className="field-input" value={settings.paymentMode} onChange={(event) => setSetting('paymentMode', event.target.value as SellerSettings['paymentMode'])}><option value="reserve">Reserve order and confirm payment later</option><option value="full">Pay now with demo payment</option><option value="deposit">Collect a deposit with demo payment</option></select>{saveAction}</div><div className="settings-note"><CreditCard size={16} /><p><strong>Payments are demo-only for now.</strong> No real card or mobile-money transaction is processed until a payment provider is connected.</p></div></div>;
    if (activeSection === 'checkout') return <div className="settings-card divide-y divide-[hsl(var(--border))] p-0"><SettingsToggle label="Ask for useful order details" description="Let buyers add delivery timing, access notes, or other context." checked={settings.checkoutAskForDetails} onChange={(value) => setSetting('checkoutAskForDetails', value)} /><SettingsToggle label="Allow reference images" description="Let buyers attach an image when a product needs visual guidance." checked={settings.checkoutAllowReferenceImages} onChange={(value) => setSetting('checkoutAllowReferenceImages', value)} /><div className="settings-row"><div><div className="text-sm font-semibold">Checkout reassurance</div><div className="mt-1 text-xs leading-5 text-[hsl(var(--muted-foreground))]">Buyers see a clear summary before sending an order.</div></div><span className="settings-status"><Check size={13} />Enabled</span></div><div className="p-5">{saveAction}</div></div>;
     if (activeSection === 'delivery') return <div className="settings-card"><div className="flex items-start justify-between gap-4"><div><h3 className="text-sm font-semibold">Fulfilment defaults</h3><p className="mt-1 text-xs leading-5 text-[hsl(var(--muted-foreground))]">These saved values are copied to new buyer order links.</p></div><Truck size={19} className="text-[hsl(var(--muted-foreground))]" /></div><label className="field-label mt-5" htmlFor="settings-delivery-default">Default option</label><select id="settings-delivery-default" className="field-input" value={settings.deliveryDefault} onChange={(event) => setSetting('deliveryDefault', event.target.value as SellerSettings['deliveryDefault'])}><option value="pickup">Pickup</option><option value="delivery">Delivery</option><option value="both">Let buyers choose</option></select><label className="field-label mt-5" htmlFor="settings-delivery-fee">Flat delivery fee</label><div className="relative"><span className="pointer-events-none absolute left-3 top-2.5 text-xs text-[hsl(var(--muted-foreground))]">{currencySymbol()}</span><input id="settings-delivery-fee" className="field-input pl-7" type="number" min="0" step="0.01" value={settings.deliveryFee} onChange={(event) => setSetting('deliveryFee', Math.max(0, Number(event.target.value) || 0))} /></div>{saveAction}</div>;
    if (activeSection === 'domains') return <div className="space-y-5"><div className="settings-card"><h3 className="text-sm font-semibold">Buyer link</h3><p className="mt-1 text-xs leading-5 text-[hsl(var(--muted-foreground))]">Shared order links continue to use the Take Order workspace domain.</p><div className="mt-4 flex items-center gap-3 rounded-[10px] bg-[hsl(var(--muted))] px-3 py-3 text-xs"><Globe2 size={15} /><span className="truncate">take-order.app/your-shop</span><span className="settings-status ml-auto">Live</span></div></div><div className="settings-card"><h3 className="text-sm font-semibold">Custom domain preference</h3><p className="mt-1 text-xs leading-5 text-[hsl(var(--muted-foreground))]">Save the domain you plan to use. Domain connection is not available yet, so it will not be shown as active.</p><div className="mt-4 flex gap-2"><input className="field-input" value={settings.customDomain} onChange={(event) => setSetting('customDomain', event.target.value)} placeholder="orders.yourshop.com" /><span className="settings-status self-center whitespace-nowrap">{settings.customDomain ? 'Saved preference' : 'Not configured'}</span></div>{saveAction}</div></div>;
    if (activeSection === 'seo') return <div className="settings-card space-y-5"><div><label className="field-label" htmlFor="settings-seo-title">Store title</label><input id="settings-seo-title" className="field-input" value={settings.seoTitle} onChange={(event) => setSetting('seoTitle', event.target.value)} placeholder={settings.businessName || 'Your shop'} /></div><div><label className="field-label" htmlFor="settings-seo-description">Search description</label><textarea id="settings-seo-description" className="field-input resize-none" rows={3} value={settings.seoDescription} onChange={(event) => setSetting('seoDescription', event.target.value)} placeholder="A short description for search previews." /></div><div><label className="field-label" htmlFor="settings-tracking-id">Tracking ID <span className="font-normal text-[hsl(var(--muted-foreground))]">(optional)</span></label><input id="settings-tracking-id" className="field-input" value={settings.trackingId} onChange={(event) => setSetting('trackingId', event.target.value)} placeholder="e.g. G-XXXXXXXXXX" /></div>{saveAction}</div>;
    if (activeSection === 'advanced') return <div className="space-y-5"><div className="settings-card divide-y divide-[hsl(var(--border))] p-0"><SettingsToggle label="Compact tables" description="Use tighter rows throughout the seller workspace." checked={settings.compactTables} onChange={(value) => setPreference('compactTables', value)} /><div className="settings-row"><div><div className="text-sm font-semibold">Server-saved data</div><div className="mt-1 text-xs leading-5 text-[hsl(var(--muted-foreground))]">Profile and workspace preferences follow your authenticated seller account.</div></div><span className="settings-status"><Check size={13} />Private</span></div><div className="p-5">{saveAction}</div></div><div className="settings-card"><h3 className="text-sm font-semibold">Reset saved settings</h3><p className="mt-1 text-xs leading-5 text-[hsl(var(--muted-foreground))]">This restores empty profile, delivery, checkout, SEO, and organization values. It does not delete products or orders.</p><button type="button" className="mt-4 inline-flex items-center gap-2 rounded-[10px] border border-[hsl(var(--destructive))]/35 px-3 py-2 text-xs font-semibold text-[hsl(var(--destructive))]" onClick={() => { if (!window.confirm('Reset saved seller settings?')) return; setSettings(emptySellerSettings); setProfile({ sellerName: '', businessName: '', description: '', channels: [] }); setPreferences(defaultSellerPreferences); setSaved(false); setSaveError(''); saveSettingsMutation.mutate({ data: emptySellerSettings }); }}>Reset settings</button></div></div>;
    if (false) return <div className="settings-card grid gap-5 sm:grid-cols-2"><div><label className="field-label" htmlFor="settings-org-name">Legal or trading name</label><input id="settings-org-name" className="field-input" value={settings.organizationName} onChange={(event) => setSetting('organizationName', event.target.value)} /></div><div><label className="field-label" htmlFor="settings-org-email">Business email</label><input id="settings-org-email" className="field-input" type="email" value={settings.organizationEmail} onChange={(event) => setSetting('organizationEmail', event.target.value)} placeholder="you@example.com" /></div><div><label className="field-label" htmlFor="settings-org-phone">Business phone</label><input id="settings-org-phone" className="field-input" type="tel" value={settings.organizationPhone} onChange={(event) => setSetting('organizationPhone', event.target.value)} placeholder="+233 00 000 0000" /></div><div><label className="field-label" htmlFor="settings-org-country">Country or region</label><select id="settings-org-country" className="field-input" value={settings.organizationCountry} onChange={(event) => setSetting('organizationCountry', event.target.value)}><option value="gh">Ghana</option><option value="ng">Nigeria</option><option value="za">South Africa</option><option value="other">Other</option></select></div><div className="sm:col-span-2"><label className="field-label" htmlFor="settings-org-address">Business address</label><textarea id="settings-org-address" className="field-input resize-none" rows={3} value={settings.organizationAddress} onChange={(event) => setSetting('organizationAddress', event.target.value)} placeholder="Add an address for invoices and fulfilment." /></div><div className="sm:col-span-2">{saveAction}</div></div>;
    if (activeSection === 'integrations') return <div className="space-y-5"><div className="settings-card"><div className="flex items-start justify-between gap-4"><div><h3 className="text-sm font-semibold">Connected tools</h3><p className="mt-1 text-xs leading-5 text-[hsl(var(--muted-foreground))]">Your selected tools are saved as preferences. No tool is authorized unless a connection is explicitly completed.</p></div><Link2 size={19} className="text-[hsl(var(--muted-foreground))]" /></div><div className="mt-4 text-xs text-[hsl(var(--muted-foreground))]">{settings.connectedTools.length ? `${settings.connectedTools.length} tool preference${settings.connectedTools.length === 1 ? '' : 's'} saved.` : 'No tool preferences saved yet.'}</div><Link href="/connect" className="mt-5 inline-flex items-center gap-2 rounded-[10px] border border-[hsl(var(--border))] px-3 py-2 text-xs font-semibold hover:bg-[hsl(var(--muted))]">Manage integrations <ArrowRight size={14} /></Link></div><div className="settings-note"><ShieldIcon /><p>Take Order never reads personal chats. Billing and staff access are not connected yet.</p></div></div>;
    if (activeSection === 'general') return <div className="space-y-5">
      <div className="settings-card flex flex-col gap-5 sm:flex-row sm:items-center">
        <SellerLogo businessName={profile.businessName || 'Your shop'} logoDataUrl={profile.logoDataUrl} className="settings-profile-logo" />
        <div className="min-w-0 flex-1"><div className="text-sm font-semibold">{profile.logoDataUrl ? 'Your logo is ready' : 'Add a business logo'}</div><p className="mt-1 text-xs leading-5 text-[hsl(var(--muted-foreground))]">Use a square PNG, JPG, WebP, or SVG up to 2 MB. It appears on buyer order pages.</p><div className="mt-3 flex flex-wrap gap-2"><label className="inline-flex cursor-pointer items-center gap-2 rounded-[10px] bg-[hsl(var(--primary))] px-3 py-2 text-[11px] font-semibold text-[hsl(var(--primary-foreground))]"><ImagePlus size={14} />{profile.logoDataUrl ? 'Replace logo' : 'Upload logo'}<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" tabIndex={-1} className="sr-only" onChange={handleLogoChange} data-testid="input-settings-logo" /></label>{profile.logoDataUrl && <button type="button" onClick={removeLogo} className="inline-flex items-center gap-2 rounded-[10px] border border-[hsl(var(--border))] px-3 py-2 text-[11px] font-semibold hover:bg-[hsl(var(--muted))]" data-testid="button-remove-settings-logo"><X size={14} />Remove</button>}</div>{logoError && <p role="alert" className="mt-2 text-xs text-[hsl(var(--destructive))]">{logoError}</p>}</div>
      </div>
      <div className="settings-card grid gap-5 sm:grid-cols-2">
        <div><label className="field-label" htmlFor="settings-seller-name">Your name</label><input id="settings-seller-name" data-testid="input-settings-seller-name" className="field-input" value={profile.sellerName} onChange={(event) => updateProfile('sellerName', event.target.value)} placeholder="e.g. Amina Mensah" /></div>
        <div><label className="field-label" htmlFor="settings-business-name">Business or shop name</label><input id="settings-business-name" data-testid="input-settings-business-name" className="field-input" value={profile.businessName} onChange={(event) => updateProfile('businessName', event.target.value)} placeholder="e.g. The Sunday Edit" /></div>
        <div className="sm:col-span-2"><label className="field-label" htmlFor="settings-description">Short shop description</label><textarea id="settings-description" data-testid="input-settings-description" className="field-input resize-none leading-6" rows={4} value={profile.description} onChange={(event) => updateProfile('description', event.target.value)} placeholder="Tell buyers what you sell and where they can find you." /></div>
        <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2"><p className="text-xs text-[hsl(var(--muted-foreground))]">{saved ? 'Saved to this device.' : 'Changes stay on this device until you save them.'}</p><Button type="button" onClick={saveProfile} data-testid="button-save-settings-profile">{saved ? <><Check size={15} />Saved</> : 'Save profile'}</Button></div>
      </div>
      <div className="settings-card"><div className="flex items-center gap-2 text-sm font-semibold"><Store size={16} />Public storefront</div><p className="mt-2 text-xs leading-5 text-[hsl(var(--muted-foreground))]">Your profile details are used on shared buyer order pages. Product catalogue and order data remain separate from this public introduction.</p><div className="mt-4 flex flex-wrap gap-2">{profile.channels.length ? profile.channels.map((channel) => <span key={channel} className="rounded-full bg-[hsl(var(--muted))] px-3 py-1.5 text-[11px] font-semibold">{channel}</span>) : <span className="text-xs text-[hsl(var(--muted-foreground))]">No sales channels selected yet.</span>}</div></div>
    </div>;
    if (activeSection === 'workflow') return <div className="settings-card divide-y divide-[hsl(var(--border))] p-0"><SettingsToggle label="Order updates" description="Keep order status changes visible in the workspace." checked={preferences.orderUpdates} onChange={(value) => setPreference('orderUpdates', value)} /><SettingsToggle label="Stock alerts" description="Highlight products that are running low or out of stock." checked={preferences.stockAlerts} onChange={(value) => setPreference('stockAlerts', value)} /><SettingsToggle label="Compact tables" description="Use tighter rows when scanning orders, clients, and expenses." checked={preferences.compactTables} onChange={(value) => setPreference('compactTables', value)} /></div>;
    if (activeSection === 'payments') return <div className="space-y-5"><div className="settings-card"><div className="flex items-start justify-between gap-4"><div><h3 className="text-sm font-semibold">Payment behaviour</h3><p className="mt-1 text-xs leading-5 text-[hsl(var(--muted-foreground))]">Choose what buyers can do from your shared order links.</p></div><WalletCards size={19} className="text-[hsl(var(--muted-foreground))]" /></div><label className="field-label mt-5" htmlFor="settings-payment-mode">Default payment mode</label><select id="settings-payment-mode" className="field-input" defaultValue="reserve"><option value="reserve">Reserve order and confirm payment later</option><option value="pay">Pay now with demo payment</option></select></div><div className="settings-note"><CreditCard size={16} /><p><strong>Payments are demo-only for now.</strong> No real card or mobile-money transaction is processed until a payment provider is connected.</p></div></div>;
    if (activeSection === 'checkout') return <div className="settings-card divide-y divide-[hsl(var(--border))] p-0"><SettingsToggle label="Ask for useful order details" description="Let buyers add delivery timing, access notes, or other context." checked={true} onChange={() => undefined} /><SettingsToggle label="Allow reference images" description="Let buyers attach an image when a product needs visual guidance." checked={true} onChange={() => undefined} /><div className="settings-row"><div><div className="text-sm font-semibold">Checkout reassurance</div><div className="mt-1 text-xs leading-5 text-[hsl(var(--muted-foreground))]">Buyers see a clear summary before sending an order.</div></div><span className="settings-status"><Check size={13} />Enabled</span></div></div>;
    if (activeSection === 'delivery') return <div className="space-y-5"><div className="settings-card"><div className="flex items-start justify-between gap-4"><div><h3 className="text-sm font-semibold">Fulfilment defaults</h3><p className="mt-1 text-xs leading-5 text-[hsl(var(--muted-foreground))]">These choices appear when you create a new buyer order link.</p></div><Truck size={19} className="text-[hsl(var(--muted-foreground))]" /></div><label className="field-label mt-5" htmlFor="settings-delivery-default">Default option</label><select id="settings-delivery-default" className="field-input" defaultValue="pickup"><option value="pickup">Pickup</option><option value="delivery">Delivery</option><option value="both">Let buyers choose</option></select><label className="field-label mt-5" htmlFor="settings-delivery-fee">Flat delivery fee</label><div className="relative"><span className="pointer-events-none absolute left-3 top-2.5 text-xs text-[hsl(var(--muted-foreground))]">$</span><input id="settings-delivery-fee" className="field-input pl-7" type="number" min="0" step="0.01" defaultValue="0" /></div></div></div>;
    if (activeSection === 'domains') return <div className="space-y-5"><div className="settings-card"><h3 className="text-sm font-semibold">Buyer link</h3><p className="mt-1 text-xs leading-5 text-[hsl(var(--muted-foreground))]">Shared order links use your Take Order workspace domain.</p><div className="mt-4 flex items-center gap-3 rounded-[10px] bg-[hsl(var(--muted))] px-3 py-3 text-xs"><Globe2 size={15} /><span className="truncate">take-order.app/your-shop</span><span className="settings-status ml-auto">Live</span></div></div><div className="settings-card"><h3 className="text-sm font-semibold">Custom domain</h3><p className="mt-1 text-xs leading-5 text-[hsl(var(--muted-foreground))]">Connect a domain later to give buyers a branded link.</p><div className="mt-4 flex gap-2"><input className="field-input" placeholder="orders.yourshop.com" disabled /><Button type="button" variant="outline" disabled>Connect</Button></div></div></div>;
    if (activeSection === 'membership') return <div className="settings-card"><div className="flex items-start justify-between gap-4"><div><div className="font-mono-ui text-[10px] uppercase tracking-[.15em] text-[hsl(var(--muted-foreground))]">Current workspace</div><h3 className="mt-2 font-display text-2xl font-bold">Starter</h3><p className="mt-2 max-w-[450px] text-xs leading-5 text-[hsl(var(--muted-foreground))]">Everything you need to create buyer links, manage products, and understand your day-to-day sales.</p></div><div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-[hsl(var(--muted))]"><WalletCards size={18} /></div></div><div className="mt-6 grid gap-3 sm:grid-cols-3"><div className="settings-stat"><strong>1</strong><span>workspace</span></div><div className="settings-stat"><strong>Unlimited</strong><span>buyer links</span></div><div className="settings-stat"><strong>Local</strong><span>preferences</span></div></div></div>;
    if (activeSection === 'seo') return <div className="settings-card space-y-5"><div><label className="field-label" htmlFor="settings-seo-title">Store title</label><input id="settings-seo-title" className="field-input" defaultValue={profile.businessName || 'Your shop'} /></div><div><label className="field-label" htmlFor="settings-seo-description">Search description</label><textarea id="settings-seo-description" className="field-input resize-none" rows={3} defaultValue={profile.description} placeholder="A short description for search previews." /></div><div><label className="field-label" htmlFor="settings-tracking-id">Tracking ID <span className="font-normal text-[hsl(var(--muted-foreground))]">(optional)</span></label><input id="settings-tracking-id" className="field-input" placeholder="e.g. G-XXXXXXXXXX" /></div><Button type="button" variant="outline">Save SEO settings</Button></div>;
    if (activeSection === 'advanced') return <div className="space-y-5"><div className="settings-card divide-y divide-[hsl(var(--border))] p-0"><SettingsToggle label="Compact tables" description="Use tighter rows throughout the seller workspace." checked={preferences.compactTables} onChange={(value) => setPreference('compactTables', value)} /><div className="settings-row"><div><div className="text-sm font-semibold">Browser-only data</div><div className="mt-1 text-xs leading-5 text-[hsl(var(--muted-foreground))]">Profile, channel choices, and display preferences stay in this browser.</div></div><span className="settings-status"><Check size={13} />Private</span></div></div><div className="settings-card"><h3 className="text-sm font-semibold">Reset local preferences</h3><p className="mt-1 text-xs leading-5 text-[hsl(var(--muted-foreground))]">This does not delete products or orders. It only clears seller profile and workspace preferences.</p><button type="button" className="mt-4 inline-flex items-center gap-2 rounded-[10px] border border-[hsl(var(--destructive))]/35 px-3 py-2 text-xs font-semibold text-[hsl(var(--destructive))]" onClick={() => { if (!window.confirm('Reset local seller preferences?')) return; window.localStorage.removeItem(ONBOARDING_KEY); window.localStorage.removeItem(SELLER_SETTINGS_KEY); setProfile({ sellerName: '', businessName: '', description: '', channels: [] }); setPreferences(defaultSellerPreferences); setSaved(false); }}>Reset preferences</button></div></div>;
    if (activeSection === 'details') return <div className="settings-card grid gap-5 sm:grid-cols-2"><div><label className="field-label" htmlFor="settings-org-name">Legal or trading name</label><input id="settings-org-name" className="field-input" defaultValue={profile.businessName} /></div><div><label className="field-label" htmlFor="settings-org-email">Business email</label><input id="settings-org-email" className="field-input" type="email" placeholder="you@example.com" /></div><div><label className="field-label" htmlFor="settings-org-phone">Business phone</label><input id="settings-org-phone" className="field-input" type="tel" placeholder="+233 00 000 0000" /></div><div><label className="field-label" htmlFor="settings-org-country">Country or region</label><select id="settings-org-country" className="field-input" defaultValue="gh"><option value="gh">Ghana</option><option value="ng">Nigeria</option><option value="za">South Africa</option><option value="other">Other</option></select></div><div className="sm:col-span-2"><label className="field-label" htmlFor="settings-org-address">Business address</label><textarea id="settings-org-address" className="field-input resize-none" rows={3} placeholder="Add an address for invoices and fulfilment." /></div><Button type="button" variant="outline">Save organization details</Button></div>;
    if (activeSection === 'billing') return <div className="space-y-5"><div className="settings-card"><div className="flex items-start justify-between gap-4"><div><h3 className="text-sm font-semibold">Billing is not connected</h3><p className="mt-1 text-xs leading-5 text-[hsl(var(--muted-foreground))]">Your Starter workspace has no subscription invoices or payment method yet.</p></div><ReceiptText size={19} className="text-[hsl(var(--muted-foreground))]" /></div><Button type="button" variant="outline" className="mt-5" disabled>Manage billing</Button></div><div className="settings-note"><ShieldIcon /><p>Billing details will appear here when a paid workspace plan is available.</p></div></div>;
    if (activeSection === 'staff') return <div className="space-y-5"><div className="settings-card"><h3 className="text-sm font-semibold">Workspace staff</h3><p className="mt-1 text-xs leading-5 text-[hsl(var(--muted-foreground))]">Invite people to help manage products and orders. Staff access is not connected yet.</p><div className="mt-5 flex items-center gap-3 rounded-[12px] border border-[hsl(var(--border))] p-3"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-[hsl(var(--chart-3))] text-[11px] font-bold text-white">{initials(profile.sellerName || 'Owner')}</div><div><div className="text-sm font-semibold">{profile.sellerName || 'Workspace owner'}</div><div className="text-xs text-[hsl(var(--muted-foreground))]">Owner · full access</div></div><span className="settings-status ml-auto">Active</span></div><Button type="button" variant="outline" className="mt-4" disabled>Invite staff</Button></div></div>;
    if (activeSection === 'integrations') return <div className="space-y-5"><div className="settings-card"><div className="flex items-start justify-between gap-4"><div><h3 className="text-sm font-semibold">Connected tools</h3><p className="mt-1 text-xs leading-5 text-[hsl(var(--muted-foreground))]">Choose the channels and payment tools you use. Connections are optional.</p></div><Link2 size={19} className="text-[hsl(var(--muted-foreground))]" /></div><Link href="/connect" className="mt-5 inline-flex items-center gap-2 rounded-[10px] border border-[hsl(var(--border))] px-3 py-2 text-xs font-semibold hover:bg-[hsl(var(--muted))]">Manage integrations <ArrowRight size={14} /></Link></div><div className="settings-note"><ShieldIcon /><p>Take Order never reads personal chats. Connecting a tool only saves your workspace preference until an integration is explicitly authorized.</p></div></div>;
    return <div className="settings-card"><h3 className="text-sm font-semibold">This setting is ready for configuration</h3><p className="mt-2 text-xs leading-5 text-[hsl(var(--muted-foreground))]">Review the options here and keep your store details up to date as your business grows.</p></div>;
  };

  return <Shell><div className="settings-page">
    <PageHeading eyebrow="Seller workspace" title="Profile & settings" description="Keep your shop identity, storefront behaviour, and organization details in one place." />
    <div className="settings-layout">
      <aside className="settings-nav" aria-label="Settings navigation">
        {settingsGroups.map((group) => <div key={group.label} className="settings-nav-group"><div className="settings-nav-heading">{group.label}</div><nav>{group.items.map((item) => { const Icon = item.icon; return <button type="button" key={item.id} className={cn('settings-nav-item', activeSection === item.id && 'is-active')} onClick={() => setActiveSection(item.id)} aria-current={activeSection === item.id ? 'page' : undefined} data-testid={`button-settings-${item.id}`}><Icon size={15} /><span>{item.label}</span></button>; })}</nav></div>)}
      </aside>
      <section className="settings-content" aria-live="polite">
        <div className="settings-content-heading"><div><div className="font-mono-ui text-[10px] uppercase tracking-[.15em] text-[hsl(var(--muted-foreground))]">Settings / {active.label}</div><h2 className="mt-2 font-display text-2xl font-bold tracking-[-.04em]">{active.label}</h2><p className="mt-2 max-w-[620px] text-sm leading-6 text-[hsl(var(--muted-foreground))]">{active.description}</p></div><div className="settings-content-icon"><active.icon size={19} /></div></div>
        <div className="mt-6">{renderSettingsContent()}</div>
      </section>
    </div>
    <footer className="settings-footer"><div><div className="font-mono-ui text-[10px] uppercase tracking-[.15em] text-[hsl(var(--muted-foreground))]">Take Order</div><p className="mt-2 text-xs leading-5 text-[hsl(var(--muted-foreground))]">Clear tools for independent sellers. Review the rules that guide how the workspace works.</p></div><nav className="settings-footer-links" aria-label="Legal and policy links"><a href="#terms">Terms and conditions</a><a href="#regulations">Regulations</a><a href="#privacy">Privacy policy</a><a href="#cookies">Cookie policy</a><a href="#acceptable-use">Acceptable use</a></nav></footer>
  </div></Shell>;
}

function ShieldIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3 5 6v5c0 4.5 3.8 8.2 7 10 3.2-1.8 7-5.5 7-10V6l-7-3Z" /><path d="m9 12 2 2 4-4" /></svg>; }

function OrderDetail() {
  const { id = '' } = useParams<{ id: string }>();
  const orderId = Number(id);
  const validOrderId = Number.isInteger(orderId) && orderId > 0;
  const query = useGetOrder(orderId, { query: { queryKey: getGetOrderQueryKey(orderId), enabled: validOrderId, refetchOnMount: 'always' } });
  const update = useUpdateOrder();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [copied, setCopied] = useState(false);
  const [actionError, setActionError] = useState('');
  const order = validOrderId ? query.data : undefined;

  const collected = order ? (order.status === 'paid' ? order.amount : order.status === 'deposit_paid' ? (order.depositAmount ?? 0) : 0) : 0;
  const outstanding = order ? Math.max(0, order.amount - collected) : 0;
  const itemSubtotal = order?.items.reduce((sum, item) => sum + item.amount * item.quantity, 0) ?? 0;
  const buyerLink = order ? `${window.location.origin}/o/${order.token}` : '';
  const updateOrder = (data: { status?: 'reserved' | 'deposit_paid' | 'paid'; fulfillment?: 'pending' | 'shipped' | 'delivered' }) => {
    if (!order) return;
    setActionError('');
    update.mutate({ id: order.id, data }, {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
        void queryClient.invalidateQueries({ queryKey: getGetOrderQueryKey(order.id) });
        invalidateDashboardSummary(queryClient);
      },
      onError: (error) => setActionError(error instanceof Error && error.message ? error.message : 'That update could not be saved. Try again.'),
    });
  };
  const copyBuyerLink = async () => {
    if (!buyerLink) return;
    try {
      if (navigator.clipboard) await navigator.clipboard.writeText(buyerLink);
      else {
        const input = document.createElement('input');
        input.value = buyerLink;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        input.remove();
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setActionError('The buyer link could not be copied. Select it from the order metadata instead.');
    }
  };
  const messageBuyer = () => {
    if (!order?.customerPhone) return;
    const phone = order.customerPhone.replace(/[^\d+]/g, '');
    const message = `Hi${order.customerName ? ` ${order.customerName}` : ''}, here is your Take Order link: ${buyerLink}`;
    window.open(`https://wa.me/${phone.replace(/\+/g, '')}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
  };

  if (!validOrderId) {
    return <Shell><Link href="/orders" className="order-detail-back" data-testid="link-back-orders"><ArrowLeft size={15} />Back to orders</Link><EmptyState card icon={PackageSearch} title="Order not found" description="That order number is not valid." action={<Button variant="outline" onClick={() => setLocation('/orders')} data-testid="button-return-orders">View all orders</Button>} /></Shell>;
  }
  if (query.isLoading) {
    return <Shell><div className="order-detail-loading" aria-label="Loading order"><Skeleton className="h-4 w-24" /><Skeleton className="mt-7 h-12 w-64" /><div className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]"><Skeleton className="h-[520px] w-full" /><Skeleton className="h-[420px] w-full" /></div></div></Shell>;
  }
  if (query.isError) {
    return <Shell><Link href="/orders" className="order-detail-back" data-testid="link-back-orders"><ArrowLeft size={15} />Back to orders</Link><div className="mt-7"><ErrorState retry={() => query.refetch()} /></div></Shell>;
  }
  if (!order) {
    return <Shell><Link href="/orders" className="order-detail-back" data-testid="link-back-orders"><ArrowLeft size={15} />Back to orders</Link><EmptyState card icon={PackageSearch} title="Order not found" description="This order may have been removed, or the link is no longer valid." action={<Button variant="outline" onClick={() => setLocation('/orders')} data-testid="button-return-orders">View all orders</Button>} /></Shell>;
  }

  return <Shell>
    <div className="order-detail-page" data-testid={`page-order-detail-${order.id}`}>
      <div className="order-detail-toolbar no-print">
        <Link href="/orders" className="order-detail-back" data-testid="link-back-orders"><ArrowLeft size={15} />Back to orders</Link>
        <div className="order-detail-actions">
          <button type="button" className="order-action-button" onClick={messageBuyer} disabled={!order.customerPhone} data-testid="button-message-buyer" title={order.customerPhone ? 'Open WhatsApp conversation' : 'Buyer phone not available'}><MessageSquare size={15} />Message buyer</button>
          <button type="button" className="order-action-button" onClick={copyBuyerLink} data-testid="button-copy-buyer-link"><Copy size={15} />{copied ? 'Copied' : 'Copy buyer link'}</button>
          <button type="button" className="order-action-button order-action-primary" onClick={() => window.print()} data-testid="button-print-invoice"><ReceiptText size={15} />Print invoice</button>
        </div>
      </div>

      <header className="order-detail-header">
        <div>
          <div className="order-detail-kicker">Order #{String(order.id).padStart(7, '0')} <span>·</span> {dateShort(order.createdAt)}</div>
          <h1 data-testid="text-order-detail-title">{order.customerName || 'Buyer pending'}</h1>
          <p>{order.items.length} {order.items.length === 1 ? 'item' : 'items'} · {channelName(order.channel)} · {order.deliveryMethod === 'delivery' ? 'Delivery' : order.deliveryMethod === 'pickup' ? 'Pickup' : 'Delivery method pending'}</p>
        </div>
        <div className="order-detail-header-status" data-testid="status-order-overview">
          <StatusPill tone={paymentTone(order.status)}>{paymentLabel(order)}</StatusPill>
          <StatusPill tone={fulfillmentTone(order.fulfillment)}>{fulfillmentLabel(order.fulfillment)}</StatusPill>
        </div>
      </header>

      {actionError && <div className="order-detail-error" role="alert" data-testid="status-order-action-error"><AlertTriangle size={15} />{actionError}</div>}

      <div className="order-detail-layout">
        <main className="order-detail-main">
          <Card className="order-detail-card order-items-card">
            <div className="order-card-heading"><div><div className="order-card-kicker">Order summary</div><h2>Items and total</h2></div><Package size={18} /></div>
            <div className="order-items-list">
              {order.items.map((item, index) => <div className="order-item-row" key={`${item.productId}-${index}`} data-testid={`row-order-item-${item.productId}-${index}`}>
                <img src={productImageFor(item.productName)} alt="" className="order-item-image" />
                <div className="order-item-copy"><strong>{item.productName}</strong><span>{item.quantity} × {moneyExact(item.amount)}</span></div>
                <div className="order-item-total">{moneyExact(item.amount * item.quantity)}</div>
              </div>)}
            </div>
            <div className="order-total-block">
              <div><span>Items subtotal</span><strong>{moneyExact(itemSubtotal)}</strong></div>
              <div><span>Delivery fee</span><strong>{order.deliveryFee ? moneyExact(order.deliveryFee) : 'No fee'}</strong></div>
              <div className="order-total-line"><span>Total order value</span><strong data-testid="text-order-total">{moneyExact(order.amount)}</strong></div>
              <div><span>Collected</span><strong className="order-collected" data-testid="text-order-collected">{moneyExact(collected)}</strong></div>
              <div className="order-outstanding-line"><span>Outstanding</span><strong data-testid="text-order-outstanding">{moneyExact(outstanding)}</strong></div>
            </div>
          </Card>

          <Card className="order-detail-card order-status-card no-print">
            <div className="order-card-heading"><div><div className="order-card-kicker">Order controls</div><h2>Keep the handoff current</h2></div><RefreshCw size={17} /></div>
            <div className="order-control-grid">
              <div><span className="order-control-label">Payment status</span><div className="order-status-options">{(['reserved', 'deposit_paid', 'paid'] as const).map((status) => <button type="button" key={status} className={cn('order-status-option', order.status === status && 'is-active')} disabled={update.isPending || order.status === status} onClick={() => updateOrder({ status })} data-testid={`button-order-payment-${status}`}><span>{status === 'reserved' ? 'Reserved' : status === 'deposit_paid' ? 'Deposit paid' : 'Paid in full'}</span>{order.status === status && <Check size={14} />}</button>)}</div></div>
              <div><span className="order-control-label">Fulfillment</span><div className="order-status-options">{(['pending', 'shipped', 'delivered'] as const).map((fulfillment) => <button type="button" key={fulfillment} className={cn('order-status-option', order.fulfillment === fulfillment && 'is-active')} disabled={update.isPending || order.fulfillment === fulfillment} onClick={() => updateOrder({ fulfillment })} data-testid={`button-order-fulfillment-${fulfillment}`}><span>{fulfillment === 'pending' ? 'To ship' : fulfillment[0].toUpperCase() + fulfillment.slice(1)}</span>{order.fulfillment === fulfillment && <Check size={14} />}</button>)}</div></div>
            </div>
          </Card>

          {(order.referenceImage || order.buyerDetails) && <Card className="order-detail-card order-context-card">
            <div className="order-card-heading"><div><div className="order-card-kicker">Buyer context</div><h2>Notes from checkout</h2></div><Clipboard size={17} /></div>
            {order.referenceImage && <a href={order.referenceImage} target="_blank" rel="noreferrer" className="order-reference-image-link" data-testid="link-order-reference-image"><img src={order.referenceImage} alt="Buyer reference" className="order-reference-image" /><span>Open reference image <ExternalLink size={13} /></span></a>}
            {order.buyerDetails && <p className="order-buyer-details" data-testid="text-order-buyer-details">{order.buyerDetails}</p>}
          </Card>}
        </main>

        <aside className="order-detail-sidebar">
          <Card className="order-detail-card customer-card">
            <div className="order-card-heading"><div><div className="order-card-kicker">Customer</div><h2>{order.customerName || 'Buyer pending'}</h2></div><div className="customer-avatar">{initials(order.customerName || 'Buyer')}</div></div>
            <div className="customer-contact-list">
              <div><span>Phone</span><strong data-testid="text-order-customer-phone">{order.customerPhone || 'Not provided'}</strong></div>
              <div><span>Channel</span><strong className="customer-channel"><ChannelMark value={order.channel} size={14} />{channelName(order.channel)}</strong></div>
              <div><span>Payment plan</span><strong>{order.paymentMode === 'deposit' ? `Deposit · ${moneyExact(order.depositAmount ?? 0)}` : order.paymentMode === 'reserve' ? 'Reserve' : 'Full payment'}</strong></div>
            </div>
            {order.customerPhone && <button type="button" className="customer-message-button" onClick={messageBuyer} data-testid="button-message-buyer-sidebar"><MessageSquare size={15} />Message on WhatsApp</button>}
          </Card>
          <Card className="order-detail-card delivery-card">
            <div className="order-card-heading"><div><div className="order-card-kicker">Handoff</div><h2>Delivery details</h2></div><Truck size={17} /></div>
            <dl className="order-metadata-list">
              <div><dt>Method</dt><dd>{order.deliveryMethod === 'delivery' ? 'Delivery' : order.deliveryMethod === 'pickup' ? 'Pickup' : 'Not selected'}</dd></div>
              <div><dt>Fee</dt><dd>{order.deliveryFee ? moneyExact(order.deliveryFee) : 'No fee'}</dd></div>
              <div><dt>Address</dt><dd data-testid="text-order-delivery-address">{order.deliveryAddress || 'Address not provided'}</dd></div>
            </dl>
          </Card>
          <Card className="order-detail-card activity-card">
            <div className="order-card-heading"><div><div className="order-card-kicker">Activity</div><h2>Order metadata</h2></div><Clock3 size={17} /></div>
            <dl className="order-metadata-list">
              <div><dt>Created</dt><dd>{new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(order.createdAt))}</dd></div>
              <div><dt>Buyer link opens</dt><dd>{number(order.linkOpens)}</dd></div>
              <div><dt>Shares / likes</dt><dd>{order.shares ?? '—'} / {order.likes ?? '—'}</dd></div>
              <div><dt>Order token</dt><dd className="order-token">{order.token}</dd></div>
            </dl>
          </Card>
        </aside>
      </div>
    </div>
  </Shell>;
}

const basePath = (runtimeEnv.BASE_URL ?? '/').replace(/\/$/, '');
const browserHostname = typeof window === 'undefined' ? 'localhost' : window.location.hostname;
const browserOrigin = typeof window === 'undefined' ? '' : window.location.origin;
const clerkPubKey = runtimeEnv.VITE_CLERK_PUBLISHABLE_KEY
  ? publishableKeyFromHost(browserHostname, runtimeEnv.VITE_CLERK_PUBLISHABLE_KEY)
  : '';
const clerkProxyUrl = runtimeEnv.VITE_CLERK_PROXY_URL || '';
const stripBase = (path: string) => basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path;
const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${browserOrigin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: '#111111',
    colorForeground: '#171717',
    colorMutedForeground: '#737373',
    colorDanger: '#b42318',
    colorBackground: '#ffffff',
    colorInput: '#ffffff',
    colorInputForeground: '#171717',
    colorNeutral: '#d4d4d4',
    fontFamily: 'Inter, sans-serif',
    borderRadius: '0.75rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-white rounded-2xl w-[440px] max-w-full overflow-hidden',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-neutral-950',
    headerSubtitle: 'text-neutral-600',
    socialButtonsBlockButtonText: 'text-neutral-900',
    formFieldLabel: 'text-neutral-800',
    footerActionLink: 'text-neutral-950',
    footerActionText: 'text-neutral-600',
    dividerText: 'text-neutral-500',
    formButtonPrimary: 'bg-neutral-950 hover:bg-neutral-800',
    formFieldInput: 'border-neutral-300 text-neutral-950',
    logoBox: 'h-10',
    logoImage: 'max-h-10',
  },
};

function ClerkShell() {
  const [, setLocation] = useLocation();
  const app = <QueryClientProvider client={queryClient}><TooltipProvider><Router /><Toaster /></TooltipProvider></QueryClientProvider>;
  if (!clerkPubKey) return app;
  return <ClerkProvider
    publishableKey={clerkPubKey}
    proxyUrl={clerkProxyUrl}
    appearance={clerkAppearance}
    signInUrl={`${basePath}/sign-in`}
    signUpUrl={`${basePath}/sign-up`}
    localization={{
      signIn: { start: { title: 'Welcome back', subtitle: 'Sign in to access your workspace' } },
      signUp: { start: { title: 'Create your account', subtitle: 'Set up your private seller workspace' } },
    }}
    routerPush={(to) => setLocation(stripBase(to))}
    routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
  >{app}</ClerkProvider>;
}

function Router() {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}><Switch>
    <Route path="/auth" component={() => <Redirect to="/sign-in" />} />
    <Route path="/sign-in/*?" component={SignInPage} />
    <Route path="/sign-up/*?" component={SignUpPage} />
    <Route path="/onboarding" component={OnboardingRoute} />
    <Route path="/" component={HomeRoute} />
    <Route path="/catalog/new" component={() => <ProtectedRoute page={CatalogEditorRoute} />} />
    <Route path="/catalog/edit/:id" component={() => <ProtectedRoute page={CatalogEditorRoute} />} />
    <Route path="/catalog" component={() => <ProtectedRoute page={Catalog} />} />
    <Route path="/orders/:id" component={() => <ProtectedRoute page={OrderDetail} />} />
    <Route path="/orders" component={() => <ProtectedRoute page={Orders} />} />
    <Route path="/reports/channel-conversion" component={() => <ProtectedRoute page={ChannelConversionInsight} />} />
    <Route path="/reports" component={() => <ProtectedRoute page={Reports} />} />
    <Route path="/clients" component={() => <ProtectedRoute page={Clients} />} />
    <Route path="/expenses" component={() => <ProtectedRoute page={Expenses} />} />
    <Route path="/take-order" component={() => <ProtectedRoute page={MultiItemTakeOrderModern} />} />
    <Route path="/settings" component={() => <ProtectedRoute page={SettingsPage} />} />
    <Route path="/connect" component={() => <ProtectedRoute page={Connect} />} />
    <Route path="/o/:token" component={PublicOrderPage} />
    <Route component={NotFound} />
  </Switch></ErrorBoundary>;
}

function App() {
  return <WouterRouter base={basePath}><ClerkShell /></WouterRouter>;
}
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
  deliveryFee = 0,
  askForDetails = true,
  allowReferenceImages = true,
  item: providedItem,
  itemIndex = 0,
  itemCount = 1,
  items: providedItems,
  contactStep = false,
  contactComplete = false,
  checkout = false,
  form,
  itemForm = emptyBuyerItemForm(),
  mockPayment,
  showMockPayment,
  submitPending,
  submitError,
  onSubmit,
  onChange,
  onItemChange = () => undefined,
  onQuantityChange = () => undefined,
  onPreferenceChange = () => undefined,
  onBack = () => undefined,
  onMockPaymentChange,
  onReferenceImageChange,
  onPaymentAction,
  onBackToReview,
  itemForms: providedItemForms,
}: {
  paymentMode: 'full' | 'deposit' | 'reserve';
  amount: number;
  depositAmount: number | null | undefined;
  deliveryFee?: number;
  askForDetails?: boolean;
  allowReferenceImages?: boolean;
  item?: BuyerOrderItem;
  itemIndex?: number;
  itemCount?: number;
  items?: BuyerOrderItem[];
  itemForms?: BuyerItemFormValues[];
  contactStep?: boolean;
  contactComplete?: boolean;
  checkout?: boolean;
  form: BuyerOrderFormValues;
  itemForm?: BuyerItemFormValues;
  mockPayment: MockPaymentValues;
  showMockPayment: boolean;
  submitPending: boolean;
  submitError?: string;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onChange: (key: 'name' | 'phone' | 'deliveryMethod' | 'address' | 'orderDetails' | 'details', value: string) => void;
  onItemChange?: (key: Exclude<keyof BuyerItemFormValues, 'quantity'>, value: string) => void;
  onQuantityChange?: (value: number) => void;
  onPreferenceChange?: (label: string, value: string) => void;
  onBack?: () => void;
  onMockPaymentChange: (key: keyof MockPaymentValues, value: string) => void;
  onReferenceImageChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onPaymentAction: (action: 'pay' | 'reserve') => void;
  onBackToReview?: () => void;
}) {
  const item = providedItem ?? { productId: 0, productName: 'Your item', amount, variants: [], preferences: [], source: 'custom' as const };
  const items = providedItems ?? [item];
  const itemForms = providedItemForms ?? [];
  const selectedDeliveryMethod = form.deliveryMethod;
  const deliveryCharge = selectedDeliveryMethod === 'delivery' ? deliveryFee : 0;
  const payableDeposit = Math.min((depositAmount ?? 0) + deliveryCharge, amount);
  const [editingContact, setEditingContact] = useState(false);
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const [paymentMethodConfirmed, setPaymentMethodConfirmed] = useState(false);
  const [activeGalleryIndex, setActiveGalleryIndex] = useState(0);
  const galleryImages = useMemo(() => {
    if (item.imageUrls?.length) return item.imageUrls;
    if (item.imageUrl) return [item.imageUrl];
    return [productImageFor(item.productName)];
  }, [item.imageUrl, item.imageUrls, item.productName]);
  const activeGalleryImage = galleryImages[Math.min(activeGalleryIndex, galleryImages.length - 1)] ?? productImageFor(item.productName);
  const itemRequirementsMet = item.preferences.every((preference) => Boolean(itemForm.preferences[preference.label]))
    && (item.source !== 'custom' || !allowReferenceImages || Boolean(itemForm.imagePreview))
    && (item.source === 'custom' || (item.available !== false && itemForm.quantity <= (item.stock ?? 0)));
  useEffect(() => {
    setEditingContact(false);
    setActiveGalleryIndex(0);
    setReviewConfirmed(false);
    setPaymentMethodConfirmed(false);
  }, [itemIndex, contactStep, checkout]);
  if (!providedItem) {
    return <form onSubmit={onSubmit} aria-labelledby="buyer-order-form-heading" aria-busy={submitPending} className="space-y-5" data-ask-for-details={askForDetails} data-allow-reference-images={allowReferenceImages}>
       {submitError && <div className="rounded-[10px] border border-[hsl(var(--destructive))]/20 bg-[hsl(var(--destructive))]/5 px-3 py-2 text-xs text-[hsl(var(--destructive))]" role="alert" data-testid="status-public-order-error">{submitError}</div>}
      <div><label htmlFor="buyer-name" className="field-label">Your name</label><input id="buyer-name" data-testid="input-buyer-name" required minLength={1} value={form.name} onChange={(event) => onChange('name', event.target.value)} placeholder="Full name" className="field-input" /></div>
      <div><label htmlFor="buyer-phone" className="field-label">Phone number</label><input id="buyer-phone" data-testid="input-buyer-phone" required minLength={5} value={form.phone} onChange={(event) => onChange('phone', event.target.value)} placeholder="Best number to reach you" className="field-input" /></div>
       {askForDetails && <div><label htmlFor="buyer-details" className="field-label">Details for the seller <span className="font-normal text-[hsl(var(--muted-foreground))]">(optional)</span></label><textarea id="buyer-details" data-testid="input-buyer-details" value={form.details ?? ''} onChange={(event) => onChange('details', event.target.value)} placeholder="Size, color, delivery note, or anything already agreed..." rows={3} className="field-input resize-none" /></div>}
       {allowReferenceImages && <div><span className="field-label">Reference image <span className="font-normal text-[hsl(var(--muted-foreground))]">(optional)</span></span><label htmlFor="buyer-reference-image" className="buyer-image-upload"><Clipboard aria-hidden="true" size={15} />{form.image ? form.image : 'Attach an image'}</label><input id="buyer-reference-image" data-testid="input-buyer-reference-image" aria-label="Reference image" type="file" accept="image/*" className="hidden" onChange={onReferenceImageChange} />{form.imagePreview && <img src={form.imagePreview} alt="Selected reference" className="mt-3 h-28 w-full rounded-[10px] object-cover" />}</div>}
      {showMockPayment && <div className="buyer-mock-payment" aria-labelledby="mock-payment-heading"><div className="flex items-center justify-between gap-3"><h3 id="mock-payment-heading" className="flex items-center gap-2 text-sm font-bold"><WalletCards aria-hidden="true" size={16} />Mock payment checkout</h3><StatusPill tone="gold">Demo</StatusPill></div><p className="mt-2 text-[11px] leading-5 text-[hsl(var(--muted-foreground))]">No real charge will be made. Use any test details to continue.</p><div className="mt-4 space-y-3"><div><label htmlFor="mock-card-number" className="field-label">Card number</label><input id="mock-card-number" data-testid="input-mock-card-number" required inputMode="numeric" value={mockPayment.cardNumber} onChange={(event) => onMockPaymentChange('cardNumber', event.target.value)} placeholder="4242 4242 4242 4242" className="field-input" /></div><div className="grid grid-cols-2 gap-3"><div><label htmlFor="mock-expiry" className="field-label">Expiry</label><input id="mock-expiry" data-testid="input-mock-expiry" required value={mockPayment.expiry} onChange={(event) => onMockPaymentChange('expiry', event.target.value)} placeholder="12/30" className="field-input" /></div><div><label htmlFor="mock-cvc" className="field-label">CVC</label><input id="mock-cvc" data-testid="input-mock-cvc" required inputMode="numeric" value={mockPayment.cvc} onChange={(event) => onMockPaymentChange('cvc', event.target.value)} placeholder="123" className="field-input" /></div></div></div></div>}
       {paymentMode !== 'reserve' && <fieldset className="grid grid-cols-2 gap-2" aria-label="Payment options"><legend className="sr-only">Payment options</legend><button type="button" role="radio" aria-checked={form.action === 'pay'} onClick={() => onPaymentAction('pay')} data-testid="button-buyer-pay" className={cn('buyer-payment-option', form.action === 'pay' && 'is-selected')}>{paymentMode === 'deposit' ? `Pay deposit · ${moneyExact(payableDeposit)}` : `Pay ${moneyExact(amount)}`}</button><button type="button" role="radio" aria-checked={form.action === 'reserve'} onClick={() => onPaymentAction('reserve')} data-testid="button-buyer-reserve" className={cn('buyer-payment-option', form.action === 'reserve' && 'is-selected')}>Reserve for later</button></fieldset>}
      <Button type="submit" disabled={submitPending || (paymentMode !== 'reserve' && !form.action)} className="w-full py-3.5" data-testid="button-submit-public-order">{submitPending && <Loader2 aria-hidden="true" size={15} className="animate-spin" />}{paymentMode === 'reserve' || form.action === 'reserve' ? 'Reserve these items' : showMockPayment ? 'Complete mock payment' : 'Continue to mock payment'} <ArrowUpRight aria-hidden="true" size={15} /></Button>
    </form>;
  }
  return <form onSubmit={onSubmit} aria-labelledby="buyer-order-form-heading" aria-busy={submitPending} className="buyer-order-form" data-ask-for-details={askForDetails} data-allow-reference-images={allowReferenceImages}>
     {submitError && <div className="mb-5 rounded-[10px] border border-[hsl(var(--destructive))]/20 bg-[hsl(var(--destructive))]/5 px-3 py-2 text-xs text-[hsl(var(--destructive))]" role="alert" data-testid="status-public-order-error">{submitError}</div>}
    {!checkout ? contactStep ? <div className="buyer-item-entry">
       <section className="buyer-buyer-details-section" aria-labelledby="buyer-details-heading"><div className="buyer-section-heading"><h2 id="buyer-details-heading">Contact information</h2></div><div className="buyer-form-module buyer-contact-module"><div className="buyer-contact-fields"><div><label htmlFor="buyer-name" className="field-label">Your name</label><input id="buyer-name" data-testid="input-buyer-name" required minLength={1} value={form.name} onChange={(event) => onChange('name', event.target.value)} placeholder="Full name" className="field-input" /></div><div><label htmlFor="buyer-phone" className="field-label">Phone number</label><input id="buyer-phone" data-testid="input-buyer-phone" required minLength={5} value={form.phone} onChange={(event) => onChange('phone', event.target.value)} placeholder="Best number to reach you" className="field-input" /></div></div></div><div className="buyer-subsection-heading"><h3>Delivery service <span className="font-normal text-[hsl(var(--muted-foreground))]">(required)</span></h3></div><div className="buyer-form-module buyer-delivery-module"><fieldset className="buyer-delivery-fields"><legend className="sr-only">Choose a delivery service</legend><div className="buyer-service-choice-grid"><label className={cn('buyer-service-choice', selectedDeliveryMethod === 'pickup' && 'is-selected')}><input className="buyer-service-choice-input" type="radio" name="buyer-delivery-method" value="pickup" checked={selectedDeliveryMethod === 'pickup'} onChange={(event) => onChange('deliveryMethod', event.target.value)} required /><span className="buyer-service-choice-check" aria-hidden="true">{selectedDeliveryMethod === 'pickup' && <Check size={12} strokeWidth={3} />}</span><span className="buyer-service-choice-copy"><strong>Pick up</strong><small>No delivery fee</small></span></label><label className={cn('buyer-service-choice', selectedDeliveryMethod === 'delivery' && 'is-selected')}><input className="buyer-service-choice-input" type="radio" name="buyer-delivery-method" value="delivery" checked={selectedDeliveryMethod === 'delivery'} onChange={(event) => onChange('deliveryMethod', event.target.value)} /><span className="buyer-service-choice-check" aria-hidden="true">{selectedDeliveryMethod === 'delivery' && <Check size={12} strokeWidth={3} />}</span><span className="buyer-service-choice-copy"><strong>Delivery</strong><small>{deliveryFee > 0 ? `Flat fee · ${moneyExact(deliveryFee)}` : 'No extra fee'}</small></span></label></div>{selectedDeliveryMethod === 'delivery' && <div className="page-in"><label htmlFor="buyer-address" className="field-label">Delivery address</label><textarea id="buyer-address" data-testid="input-buyer-address" required value={form.address ?? ''} onChange={(event) => onChange('address', event.target.value)} placeholder="Street, area, landmark, or pickup details..." rows={2} className="field-input resize-none" /></div>}<div><label htmlFor="buyer-order-details" className="field-label">Useful details <span className="font-normal text-[hsl(var(--muted-foreground))]">(optional)</span></label><textarea id="buyer-order-details" data-testid="input-buyer-order-details" value={form.orderDetails ?? ''} onChange={(event) => onChange('orderDetails', event.target.value)} placeholder="Delivery timing, access notes, or anything already agreed..." rows={2} className="field-input resize-none" /></div></fieldset></div></section>
        <div className="buyer-form-actions"><span /><Button type="submit" disabled={submitPending} data-testid="button-submit-public-order">Continue to payment <ArrowRight size={15} /></Button></div>
      </div> : <div className="buyer-item-entry">
         {contactComplete && <div className="buyer-contact-summary">
          <div className="buyer-contact-confirmed"><CheckCircle2 size={15} /><span>Contact details saved for {form.name || 'this order'}</span><button type="button" aria-expanded={editingContact} aria-controls="buyer-inline-contact-editor" onClick={() => setEditingContact((current) => !current)} data-testid="button-edit-buyer-contact"><Pencil aria-hidden="true" size={13} />Edit</button></div>
          {editingContact && <section id="buyer-inline-contact-editor" className="buyer-inline-contact-editor page-in" aria-labelledby="buyer-inline-contact-heading">
            <div className="buyer-subsection-heading"><h3 id="buyer-inline-contact-heading">Edit contact information</h3></div>
            <div className="buyer-contact-fields">
              <div><label htmlFor="buyer-inline-name" className="field-label">Your name</label><input id="buyer-inline-name" data-testid="input-buyer-inline-name" required minLength={1} value={form.name} onChange={(event) => onChange('name', event.target.value)} placeholder="Full name" className="field-input" /></div>
               <div><label htmlFor="buyer-inline-phone" className="field-label">Phone number</label><input id="buyer-inline-phone" data-testid="input-buyer-inline-phone" required minLength={5} value={form.phone} onChange={(event) => onChange('phone', event.target.value)} placeholder="Best number to reach you" className="field-input" /></div>
             </div>
            <div className="buyer-subsection-heading"><h3>Delivery service <span className="font-normal text-[hsl(var(--muted-foreground))]">(required)</span></h3></div>
            <fieldset className="buyer-delivery-fields">
              <legend className="sr-only">Choose a delivery service</legend>
              <div className="buyer-service-choice-grid">
                <label className={cn('buyer-service-choice', selectedDeliveryMethod === 'pickup' && 'is-selected')}><input className="buyer-service-choice-input" type="radio" name="buyer-inline-delivery-method" value="pickup" checked={selectedDeliveryMethod === 'pickup'} onChange={(event) => onChange('deliveryMethod', event.target.value)} required /><span className="buyer-service-choice-check" aria-hidden="true">{selectedDeliveryMethod === 'pickup' && <Check size={12} strokeWidth={3} />}</span><span className="buyer-service-choice-copy"><strong>Pick up</strong><small>No delivery fee</small></span></label>
                <label className={cn('buyer-service-choice', selectedDeliveryMethod === 'delivery' && 'is-selected')}><input className="buyer-service-choice-input" type="radio" name="buyer-inline-delivery-method" value="delivery" checked={selectedDeliveryMethod === 'delivery'} onChange={(event) => onChange('deliveryMethod', event.target.value)} /><span className="buyer-service-choice-check" aria-hidden="true">{selectedDeliveryMethod === 'delivery' && <Check size={12} strokeWidth={3} />}</span><span className="buyer-service-choice-copy"><strong>Delivery</strong><small>{deliveryFee > 0 ? `Flat fee · ${moneyExact(deliveryFee)}` : 'No extra fee'}</small></span></label>
              </div>
              {selectedDeliveryMethod === 'delivery' && <div className="page-in"><label htmlFor="buyer-inline-address" className="field-label">Delivery address</label><textarea id="buyer-inline-address" data-testid="input-buyer-inline-address" required value={form.address ?? ''} onChange={(event) => onChange('address', event.target.value)} placeholder="Street, area, landmark, or pickup details..." rows={2} className="field-input resize-none" /></div>}
            </fieldset>
            <div><label htmlFor="buyer-inline-order-details" className="field-label">Useful details <span className="font-normal text-[hsl(var(--muted-foreground))]">(optional)</span></label><textarea id="buyer-inline-order-details" data-testid="input-buyer-inline-order-details" value={form.orderDetails ?? ''} onChange={(event) => onChange('orderDetails', event.target.value)} placeholder="Delivery timing, access notes, or anything already agreed..." rows={2} className="field-input resize-none" /></div>
            <button type="button" className="buyer-inline-contact-done" onClick={() => setEditingContact(false)} data-testid="button-done-editing-buyer-contact">Done editing</button>
           </section>}
         </div>}
         <section className={cn('buyer-item-preferences-section buyer-product-detail', item.preferences.length > 0 && 'has-variants')} aria-labelledby="buyer-item-preferences-heading">
          <div className="buyer-item-preferences-layout">
              <div className={cn('buyer-item-visual', item.source === 'custom' ? 'buyer-custom-item-visual' : 'buyer-product-gallery')}>
               {item.source === 'custom' && allowReferenceImages ? <>
                 <label htmlFor="buyer-reference-image" className="buyer-custom-upload-area">
                   {itemForm.imagePreview ? <img src={itemForm.imagePreview} alt="Selected item reference" /> : <><ImagePlus size={24} aria-hidden="true" /><strong>Upload an item image</strong><span>Add a reference photo for the seller.</span></>}
                 </label>
                  <input id="buyer-reference-image" data-testid="input-buyer-reference-image" aria-label="Upload an item image" aria-required="true" type="file" accept="image/*" className="sr-only" onChange={onReferenceImageChange} />
                 <div className="buyer-gallery-caption"><ImagePlus size={13} aria-hidden="true" /> Buyer upload</div>
               </> : <>
                 <div className="buyer-item-hero-image buyer-product-gallery-main">
                   <img src={activeGalleryImage} alt={`${item.productName} product view ${activeGalleryIndex + 1}`} />
                   {galleryImages.length > 1 && <div className="buyer-gallery-controls">
                     <button type="button" aria-label="Previous product image" onClick={() => setActiveGalleryIndex((current) => (current - 1 + galleryImages.length) % galleryImages.length)}><ChevronLeft size={16} /></button>
                     <span>{String(activeGalleryIndex + 1).padStart(2, '0')} / {String(galleryImages.length).padStart(2, '0')}</span>
                     <button type="button" aria-label="Next product image" onClick={() => setActiveGalleryIndex((current) => (current + 1) % galleryImages.length)}><ChevronRight size={16} /></button>
                   </div>}
                 </div>
                 <div className="buyer-product-gallery-thumbs" aria-label="Product images">
                   {galleryImages.map((image, imageIndex) => <button type="button" key={`${image}-${imageIndex}`} className={cn('buyer-product-gallery-thumb', activeGalleryIndex === imageIndex && 'is-selected')} onClick={() => setActiveGalleryIndex(imageIndex)} aria-label={`Show product image ${imageIndex + 1}`} aria-pressed={activeGalleryIndex === imageIndex}><img src={image} alt="" /></button>)}
                 </div>
                 <div className="buyer-gallery-caption"><Package size={13} aria-hidden="true" /> Product preview</div>
               </>}
             </div>
            <div className="buyer-item-preferences-content buyer-product-detail-content">
              <div className="buyer-item-description buyer-product-detail-header">
                 <h2 id="buyer-item-preferences-heading">{item.productName}</h2>
                  <div className="buyer-product-price-row"><strong className="buyer-item-description-price">{moneyExact(item.amount)}</strong>{item.compareAtPrice && item.compareAtPrice > item.amount && <del className="text-xs text-[hsl(var(--muted-foreground))]">{moneyExact(item.compareAtPrice)}</del>}</div>
                  {item.description && <p>{item.description}</p>}
                  <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-[hsl(var(--muted-foreground))]">{item.sku && <span>SKU · {item.sku}</span>}{item.source === 'catalog' && <span className={item.available === false ? 'text-[hsl(var(--destructive))]' : ''}>{item.available === false ? 'Unavailable' : `${item.stock ?? 0} available`}</span>}</div>
                  <p>{item.preferences.length > 0 ? 'Choose your options' : 'This item is ready to add to your order.'}</p>
                  <div className="mt-4 flex items-center justify-between rounded-[10px] border border-[hsl(var(--border))] p-3"><div><div className="field-label">Quantity</div><div className="text-[11px] text-[hsl(var(--muted-foreground))]">{item.source === 'catalog' ? `Up to ${item.stock ?? 0} available` : 'Choose how many you need'}</div></div><div className="flex items-center gap-2"><button type="button" aria-label={`Decrease quantity for ${item.productName}`} disabled={itemForm.quantity <= 1} onClick={() => onQuantityChange(Math.max(1, itemForm.quantity - 1))} className="flex h-8 w-8 items-center justify-center rounded-full border border-[hsl(var(--border))] text-lg disabled:opacity-40">−</button><output aria-label={`Quantity for ${item.productName}`} className="min-w-6 text-center text-sm font-bold">{itemForm.quantity}</output><button type="button" aria-label={`Increase quantity for ${item.productName}`} disabled={item.source === 'catalog' && itemForm.quantity >= (item.stock ?? 0)} onClick={() => onQuantityChange(itemForm.quantity + 1)} className="flex h-8 w-8 items-center justify-center rounded-full border border-[hsl(var(--border))] text-lg disabled:opacity-40">+</button></div></div>
              </div>
              {item.preferences.map((preference, preferenceIndex) => {
                const preferenceLabel = preference.label.trim().toLowerCase();
                const isSizePreference = preferenceLabel === 'size';
                const isSwatchPreference = /colou?r|finish/.test(preferenceLabel);
                return <fieldset className={cn('buyer-color-field', isSizePreference && 'buyer-size-field', !isSizePreference && !isSwatchPreference && 'buyer-choice-field')} key={`${item.productId}-${preference.label}`}>
                  <legend className="buyer-preference-legend"><span>{preference.label}</span>{isSizePreference && <small>Select one</small>}</legend>
                  <div className={isSizePreference ? 'buyer-size-options' : isSwatchPreference ? 'buyer-color-options' : 'buyer-choice-options'}>
                    {preference.options.map((option) => isSizePreference
                      ? <label key={option} className={cn('buyer-size-option', itemForm.preferences[preference.label] === option && 'is-selected')} aria-label={`${preference.label}: ${option}`}>
                          <input type="radio" name={`buyer-preference-${item.productId}-${preferenceIndex}`} value={option} checked={itemForm.preferences[preference.label] === option} onChange={() => onPreferenceChange(preference.label, option)} aria-required="true" />
                          <span className="buyer-size-check" aria-hidden="true">{itemForm.preferences[preference.label] === option && <Check size={11} strokeWidth={3} />}</span>
                          <span>{option}</span>
                        </label>
                      : isSwatchPreference
                        ? <label key={option} className={cn('buyer-color-option', itemForm.preferences[preference.label] === option && 'is-selected')} aria-label={`${preference.label}: ${option}`}>
                            <input type="radio" name={`buyer-preference-${item.productId}-${preferenceIndex}`} value={option} checked={itemForm.preferences[preference.label] === option} onChange={() => onPreferenceChange(preference.label, option)} aria-required="true" />
                            <span className="buyer-color-option-image"><img src={productImageFor(`${item.productName} ${preference.label} ${option}`)} alt="" /></span>
                            <span className="buyer-color-option-label">{option}</span>
                            <span className="buyer-color-check" aria-hidden="true">{itemForm.preferences[preference.label] === option && <Check size={11} strokeWidth={3} />}</span>
                          </label>
                         : <label key={option} className={cn('buyer-choice-option', itemForm.preferences[preference.label] === option && 'is-selected')} aria-label={`${preference.label}: ${option}`}>
                             <input type="radio" name={`buyer-preference-${item.productId}-${preferenceIndex}`} value={option} checked={itemForm.preferences[preference.label] === option} onChange={() => onPreferenceChange(preference.label, option)} aria-required="true" />
                            <span>{option}</span>
                            {itemForm.preferences[preference.label] === option && <Check size={13} aria-hidden="true" />}
                          </label>)}
                  </div>
                </fieldset>;
              })}
              <div className="buyer-product-note-field">
                <label htmlFor="buyer-item-details" className="field-label">Note for the seller <span className="font-normal text-[hsl(var(--muted-foreground))]">(optional)</span></label>
                <textarea id="buyer-item-details" data-testid="input-buyer-item-details" value={itemForm.details} onChange={(event) => onChange('details', event.target.value)} placeholder="Add a detail about this item..." rows={2} className="field-input resize-none" />
              </div>
            </div>
          </div>
        </section>
        <div className="buyer-form-actions">{itemIndex > 0 ? <Button type="button" variant="ghost" onClick={onBack}><ArrowLeft size={15} />Back</Button> : <span /> }<Button type="submit" disabled={submitPending || !itemRequirementsMet} data-testid="button-submit-public-order">{itemIndex + 1 < itemCount ? 'Next item' : 'Continue to contact information'} <ArrowRight size={15} /></Button></div>
       </div> : (reviewConfirmed && !paymentMethodConfirmed) ? <div className="buyer-payment-page">
       <div className="buyer-final-heading"><div><div className="take-order-section-eyebrow">Payment</div><h2 id="buyer-order-form-heading">Choose how to pay.</h2></div><WalletCards size={20} /></div>
        {paymentMode !== 'reserve' && <fieldset className="buyer-payment-options" aria-label="Payment options"><legend className="field-label">How would you like to complete this</legend><button type="button" role="radio" aria-checked={form.action === 'pay'} onClick={() => onPaymentAction('pay')} data-testid="button-buyer-pay" className={cn('buyer-payment-option', form.action === 'pay' && 'is-selected')}>{paymentMode === 'deposit' ? `Pay deposit · ${moneyExact(payableDeposit)}` : `Pay ${moneyExact(amount)}`}</button><button type="button" role="radio" aria-checked={form.action === 'reserve'} onClick={() => onPaymentAction('reserve')} data-testid="button-buyer-reserve" className={cn('buyer-payment-option', form.action === 'reserve' && 'is-selected')}>Reserve for later</button></fieldset>}
        <div className="buyer-form-actions"><Button type="button" variant="ghost" onClick={() => { setReviewConfirmed(false); setPaymentMethodConfirmed(false); onBackToReview?.(); }}><ArrowLeft size={15} />Back to review</Button><Button type="button" disabled={paymentMode !== 'reserve' && !form.action} onClick={() => setPaymentMethodConfirmed(true)} data-testid="button-continue-payment-method">Continue to payment <ArrowRight size={15} /></Button></div>
     </div> : paymentMethodConfirmed ? <div className="buyer-payment-completion-page">
       <div className="buyer-final-heading"><div><div className="take-order-section-eyebrow">Payment</div><h2 id="buyer-order-form-heading">{form.action === 'reserve' ? 'Reserve your order.' : 'Complete your payment.'}</h2></div><WalletCards size={20} /></div>
       {form.action === 'pay' && <div className="buyer-mock-payment" aria-labelledby="mock-payment-heading"><div className="flex items-center justify-between gap-3"><h3 id="mock-payment-heading" className="flex items-center gap-2 text-sm font-bold"><WalletCards aria-hidden="true" size={16} />Card payment</h3><StatusPill tone="gold">Demo</StatusPill></div><p className="mt-2 text-[11px] leading-5 text-[hsl(var(--muted-foreground))]">No real charge will be made. Use any test details to continue.</p><div className="mt-4 space-y-3"><div><label htmlFor="mock-card-number" className="field-label">Card number</label><input id="mock-card-number" data-testid="input-mock-card-number" required inputMode="numeric" value={mockPayment.cardNumber} onChange={(event) => onMockPaymentChange('cardNumber', event.target.value)} placeholder="4242 4242 4242 4242" className="field-input" /></div><div className="grid grid-cols-2 gap-3"><div><label htmlFor="mock-expiry" className="field-label">Expiry</label><input id="mock-expiry" data-testid="input-mock-expiry" required value={mockPayment.expiry} onChange={(event) => onMockPaymentChange('expiry', event.target.value)} placeholder="12/30" className="field-input" /></div><div><label htmlFor="mock-cvc" className="field-label">CVC</label><input id="mock-cvc" data-testid="input-mock-cvc" required inputMode="numeric" value={mockPayment.cvc} onChange={(event) => onMockPaymentChange('cvc', event.target.value)} placeholder="123" className="field-input" /></div></div></div></div>}
       {form.action !== 'pay' && <div className="buyer-payment-reserve-note"><CheckCircle2 size={18} /><div><strong>Reserve these items</strong><p>The seller will receive your order details and follow up with the next step.</p></div></div>}
       <div className="buyer-form-actions"><Button type="button" variant="ghost" onClick={() => { setPaymentMethodConfirmed(false); onBackToReview?.(); }}><ArrowLeft size={15} />Back to payment method</Button><Button type="submit" disabled={submitPending || (paymentMode !== 'reserve' && form.action !== 'pay' && form.action !== 'reserve')} data-testid="button-submit-public-order">{submitPending && <Loader2 aria-hidden="true" size={15} className="animate-spin" />}{form.action === 'reserve' || paymentMode === 'reserve' ? 'Reserve these items' : 'Complete checkout'} <ArrowUpRight aria-hidden="true" size={15} /></Button></div>
     </div> : <div className="buyer-final-checkout">
       <div className="buyer-final-heading"><div><div className="take-order-section-eyebrow">Final checkout</div><h2 id="buyer-order-form-heading">Review your order.</h2><p>Check your items, preferences, and contact details before moving to payment.</p></div><CheckCircle2 size={20} /></div>
        <section className="buyer-review-card buyer-review-items" aria-labelledby="buyer-review-items-heading">
          <div className="buyer-review-card-heading"><div><div className="take-order-section-eyebrow">Order summary</div><h3 id="buyer-review-items-heading">Items in your order</h3></div><span>{items.length} {items.length === 1 ? 'item' : 'items'}</span></div>
          <div className="buyer-summary-list">{items.map((orderItem, index) => {
            const selectedPreferences = itemForms[index]?.preferences ?? (itemIndex === index ? itemForm.preferences : {});
            const preferenceSummary = Object.values(selectedPreferences).filter(Boolean).join(' · ');
             return <div key={`${orderItem.productId}-${index}`} className="buyer-summary-row"><div><strong>{orderItem.productName}</strong>{preferenceSummary && <small>{preferenceSummary}</small>}</div><b>{moneyExact(orderItem.amount)}</b></div>;
          })}{deliveryCharge > 0 && <div className="buyer-summary-row"><span>+</span><div><strong>Delivery</strong><small>Flat delivery fee</small></div><b>{moneyExact(deliveryCharge)}</b></div>}<div className="buyer-summary-total"><span>Total</span><strong>{moneyExact(amount)}</strong></div></div>
        </section>
        <section className="buyer-review-card buyer-review-contact" aria-labelledby="buyer-review-contact-heading">
          <div className="buyer-review-card-heading"><div><div className="take-order-section-eyebrow">Contact information</div><h3 id="buyer-review-contact-heading">Where should we reach you?</h3></div><button type="button" className="buyer-review-edit" aria-expanded={editingContact} aria-controls="buyer-inline-contact-editor" onClick={() => { setReviewConfirmed(false); setEditingContact((current) => !current); }} data-testid="button-edit-buyer-contact"><Pencil aria-hidden="true" size={13} />{editingContact ? 'Close editor' : 'Edit'}</button></div>
          <div className="buyer-review-contact-grid"><div><span>Name</span><strong>{form.name}</strong></div><div><span>Phone</span><strong>{form.phone}</strong></div><div><span>Fulfilment</span><strong>{selectedDeliveryMethod === 'delivery' ? 'Delivery' : 'Pick up'}</strong></div>{selectedDeliveryMethod === 'delivery' && <div className="buyer-review-contact-wide"><span>Address</span><strong>{form.address}</strong></div>}{form.orderDetails && <div className="buyer-review-contact-wide"><span>Useful details</span><strong>{form.orderDetails}</strong></div>}</div>
        </section>
       {editingContact && <section id="buyer-inline-contact-editor" className="buyer-inline-contact-editor page-in" aria-labelledby="buyer-inline-contact-heading">
         <div className="buyer-subsection-heading"><h3 id="buyer-inline-contact-heading">Edit contact information</h3></div>
         <div className="buyer-contact-fields">
           <div><label htmlFor="buyer-inline-name" className="field-label">Your name</label><input id="buyer-inline-name" data-testid="input-buyer-inline-name" required minLength={1} value={form.name} onChange={(event) => onChange('name', event.target.value)} placeholder="Full name" className="field-input" /></div>
           <div><label htmlFor="buyer-inline-phone" className="field-label">Phone number</label><input id="buyer-inline-phone" data-testid="input-buyer-inline-phone" required minLength={5} value={form.phone} onChange={(event) => onChange('phone', event.target.value)} placeholder="Best number to reach you" className="field-input" /></div>
         </div>
         <div className="buyer-subsection-heading"><h3>Delivery service <span className="font-normal text-[hsl(var(--muted-foreground))]">(required)</span></h3></div>
         <fieldset className="buyer-delivery-fields">
           <legend className="sr-only">Choose a delivery service</legend>
           <div className="buyer-service-choice-grid">
             <label className={cn('buyer-service-choice', selectedDeliveryMethod === 'pickup' && 'is-selected')}><input className="buyer-service-choice-input" type="radio" name="buyer-inline-delivery-method" value="pickup" checked={selectedDeliveryMethod === 'pickup'} onChange={(event) => onChange('deliveryMethod', event.target.value)} required /><span className="buyer-service-choice-check" aria-hidden="true">{selectedDeliveryMethod === 'pickup' && <Check size={12} strokeWidth={3} />}</span><span className="buyer-service-choice-copy"><strong>Pick up</strong><small>No delivery fee</small></span></label>
             <label className={cn('buyer-service-choice', selectedDeliveryMethod === 'delivery' && 'is-selected')}><input className="buyer-service-choice-input" type="radio" name="buyer-inline-delivery-method" value="delivery" checked={selectedDeliveryMethod === 'delivery'} onChange={(event) => onChange('deliveryMethod', event.target.value)} /><span className="buyer-service-choice-check" aria-hidden="true">{selectedDeliveryMethod === 'delivery' && <Check size={12} strokeWidth={3} />}</span><span className="buyer-service-choice-copy"><strong>Delivery</strong><small>{deliveryFee > 0 ? `Flat fee · ${moneyExact(deliveryFee)}` : 'No extra fee'}</small></span></label>
           </div>
           {selectedDeliveryMethod === 'delivery' && <div className="page-in"><label htmlFor="buyer-inline-address" className="field-label">Delivery address</label><textarea id="buyer-inline-address" data-testid="input-buyer-inline-address" required value={form.address ?? ''} onChange={(event) => onChange('address', event.target.value)} placeholder="Street, area, landmark, or pickup details..." rows={2} className="field-input resize-none" /></div>}
         </fieldset>
         <div><label htmlFor="buyer-inline-order-details" className="field-label">Useful details <span className="font-normal text-[hsl(var(--muted-foreground))]">(optional)</span></label><textarea id="buyer-inline-order-details" data-testid="input-buyer-inline-order-details" value={form.orderDetails ?? ''} onChange={(event) => onChange('orderDetails', event.target.value)} placeholder="Delivery timing, access notes, or anything already agreed..." rows={2} className="field-input resize-none" /></div>
         <button type="button" className="buyer-inline-contact-done" onClick={() => setEditingContact(false)} data-testid="button-done-editing-buyer-contact">Done editing</button>
       </section>}
        <div className="buyer-form-actions"><Button type="button" variant="ghost" onClick={onBack}><ArrowLeft size={15} />Back to items</Button><Button type="button" onClick={() => setReviewConfirmed(true)} data-testid="button-confirm-buyer-review">Confirm order details <Check size={15} /></Button></div>
    </div>}
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

