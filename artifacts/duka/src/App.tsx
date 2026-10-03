import React, { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Link, Redirect, Route, Switch, useLocation, useParams, Router as WouterRouter } from 'wouter';
import { ClerkProvider, SignIn, SignUp, useAuth, useClerk, useUser, AuthenticateWithRedirectCallback } from '@clerk/react';
import { shadcn } from '@clerk/themes';
import {
  AlertCircle, AlertTriangle, ArrowDown, ArrowDownRight, ArrowLeft, ArrowRight, ArrowUp, ArrowUpRight, BarChart3, Boxes, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Clock3,
  CheckCircle2, CircleDollarSign, Clipboard, Copy, CreditCard, Crown, Download, ExternalLink, Eye, EyeOff, FileText, Globe2, Info, LayoutDashboard, LayoutGrid, Link2, List, Loader2, Mail, Menu, Minus, MoreHorizontal,
  ImagePlus, MessageSquare, Package, PackageSearch, PackageX, Pencil, Percent, Plus, Receipt, ReceiptText, RefreshCw, Search, SearchCheck, Settings2, ShoppingBag, SlidersHorizontal, Sparkles, Store,
  Trash2, TrendingUp, Truck, UserRound, Users, UsersRound, WalletCards, Workflow, Wrench, X,
  Lock, ShieldCheck, Signal, Wifi, WifiOff, Save, Smartphone, Building2, PanelLeftClose, PanelLeftOpen, LogOut, KeyRound, Bell, Zap, Settings, QrCode, Send,
  Shirt, Scissors, Coffee, Heart
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
  useUpdateSellerSettings, customFetch, setAuthTokenGetter
} from '@workspace/api-client-react';
import type { Expense, ExpenseInput, ExpenseUpdate, Order, OrderInput, Product, ProductInput, ProductPreferenceGroup, PublicOrderInput, SellerSettings } from '@workspace/api-client-react';
import NotFound from '@/pages/not-found';
import { TermsPage } from '@/pages/terms';
import { PrivacyPage } from '@/pages/privacy';
import { RefundPolicyPage } from '@/pages/refund-policy';
import { LandingPage } from '@/pages/landing';
import { ErrorBoundary } from '@/components/error-boundary';
import { StatCard } from '@/components/stat-card';
import { SidebarProCard } from '@/components/sidebar-pro-card';
import { RecentUpdatesTabs } from '@/components/recent-updates-tabs';
import { PageHeader, MobileNavContext } from '@/components/page-header';
import { DataTable, type DataTableColumn } from '@/components/data-table';
import { SegmentedControl } from '@/components/segmented-control';
import { OrderSummaryDrawer } from '@/components/order-summary-drawer';
import { generateOrdersCsv, downloadCsvFile, sanitizeCsvCell } from '@/lib/order-export';
import { getSafeRedirectUrl } from '@/lib/redirect';
import { ClientDetailPage } from '@/pages/client-detail';
import { IntegrationsComingSoonPage } from '@/pages/integrations';
import { AnalyticsPage } from '@/pages/analytics';
import { Toaster } from '@/components/ui/toaster';
import { useToast } from '@/hooks/use-toast';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AnalyticsStateMarker, getAnalyticsViewState } from '@/lib/analytics-state';
import { catalogValue } from '@/lib/catalog-metrics';
import {
  type SellerProfile,
  type SellerSettingsPreferences,
  defaultSellerProfile,
  defaultSellerPreferences,
  getScopedKey,
  readSellerProfile,
  writeSellerProfile,
  readSellerSettings,
  writeSellerSettings,
  readOnboardingStep,
  writeOnboardingStep,
  readOnboardingComplete,
  finishOnboarding,
  readConnectedTools,
  writeConnectedTools,
  clearConnectedTools,
  readChecklistDismissed,
  writeChecklistDismissed,
  clearAllSellerStorage,
  setActiveSellerUserId,
} from '@/lib/seller-storage';

export { readConnectedTools, writeConnectedTools, clearConnectedTools };
import {
  ProUpgradeFeatureCard,
  EmptyStateOnboardingCard,
} from '@/components/pro-upgrade-card';
import { countryNameForCode, currencyForCode, currencyForLanguage, currentCurrency, formatCompactMoney, formatMoney, setActiveCurrency, storeCurrencyOptions } from '@/lib/currency';
import {
  clearPreferences,
  connectPreferenceAriaLabel,
  connectPreferenceLabel,
  onboardingChannels,
  orderChannels,
  subscribeToPreferenceChanges,
  togglePreference,
} from '@/lib/channel-preferences';
import { formatUserFacingError } from '@/lib/user-facing-errors';
import {
  buildClientBalanceReminderMessage,
  buildDeliveryDispatchMessage,
  buildOrderConfirmationMessage,
  buildPaymentReminderMessage,
  buildRiderDispatchSlip,
  buildTextReceipt,
  openWhatsApp,
} from '@/lib/social-messaging';
import { buildPublicOrderLink } from '@/lib/order-links';
import { configureRevenueCat, isProActive, useEntitlement } from '@/lib/revenuecat';
import { useEntitlements, FREE_CATALOG_LIMIT, FREE_ACTIVE_LINK_LIMIT, PRO_ACTIVE_LINK_LIMIT } from '@/lib/entitlements';
import { ContextualUpgradeDialog, type UpgradeReason } from '@/components/contextual-upgrade-dialog';
import { AuthContext, useAppAuth, type AuthContextValue, type AuthState } from '@/lib/auth-context';
import { SubscribePage } from '@/pages/subscribe';
import { BillingPage } from '@/pages/billing';

const queryClient = new QueryClient();
const runtimeEnv = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env ?? {};
const basePath = (runtimeEnv.BASE_URL ?? '/').replace(/\/$/, '');
const browserHostname = typeof window === 'undefined' ? 'localhost' : window.location.hostname;
const browserOrigin = typeof window === 'undefined' ? '' : window.location.origin;
const rawClerkKey = (runtimeEnv.VITE_CLERK_PUBLISHABLE_KEY || runtimeEnv.CLERK_PUBLISHABLE_KEY || '').trim();
const clerkPubKey = rawClerkKey;
const clerkProxyUrl = runtimeEnv.VITE_CLERK_PROXY_URL || runtimeEnv.CLERK_PROXY_URL || '';

type PaywallContextValue = {
  isPaywallOpen: boolean;
  openPaywall: () => void;
  closePaywall: () => void;
};

const PaywallContext = React.createContext<PaywallContextValue>({
  isPaywallOpen: false,
  openPaywall: () => {},
  closePaywall: () => {},
});

export function usePaywall(): PaywallContextValue {
  return React.useContext(PaywallContext);
}

function PaywallProvider({ children }: { children: ReactNode }) {
  const [, setLocation] = useLocation();
  const value = useMemo(
    () => ({
      isPaywallOpen: false,
      openPaywall: () => setLocation('/subscribe'),
      closePaywall: () => {},
    }),
    [setLocation]
  );

  return (
    <PaywallContext.Provider value={value}>
      {children}
    </PaywallContext.Provider>
  );
}

function ClerkAuthBridge({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const clerk = useClerk();
  const { user } = useUser();
  const isTestAuth = typeof window !== 'undefined' && (Boolean((window as any).__DUKA_TEST_AUTH__) || localStorage.getItem('duka-test-auth') === 'true');
  const testUserId = typeof window !== 'undefined' ? ((window as any).__DUKA_TEST_USER_ID__ || localStorage.getItem('duka-test-user-id') || null) : null;
  const effectiveUserId = auth.userId || (isTestAuth ? testUserId : null);
  const effectiveEmail = user?.primaryEmailAddress?.emailAddress || null;

  const prevUserIdRef = useRef<string | null>(effectiveUserId);

  useEffect(() => {
    setActiveSellerUserId(effectiveUserId);
    // When active seller identity changes (sign in, sign out, switch account), clear query cache immediately
    if (prevUserIdRef.current && prevUserIdRef.current !== effectiveUserId) {
      queryClient.clear();
    }
    prevUserIdRef.current = effectiveUserId;
  }, [effectiveUserId]);

  useEffect(() => {
    if (auth.isSignedIn && auth.getToken) {
      setAuthTokenGetter(async () => {
        try {
          return await auth.getToken();
        } catch {
          return null;
        }
      });
    } else if (isTestAuth && effectiveUserId) {
      setAuthTokenGetter(() => `test-${effectiveUserId}`);
    } else {
      setAuthTokenGetter(null);
    }
  }, [auth.isSignedIn, auth.getToken, isTestAuth, effectiveUserId]);

  useEffect(() => {
    if (effectiveUserId) {
      void configureRevenueCat(effectiveUserId);
    }
  }, [effectiveUserId]);

  const signOut = async () => {
    setActiveSellerUserId(null);
    queryClient.clear();
    clearAllSellerStorage();
    try {
      if (clerk?.signOut) {
        await clerk.signOut();
      }
    } catch (e) {
      console.warn('Clerk sign out error', e);
    }
    window.location.href = '/sign-in';
  };

  const value = useMemo((): AuthContextValue => {
    const isLoaded = Boolean(auth.isLoaded || isTestAuth);
    const isSignedIn = Boolean(auth.isSignedIn || (isTestAuth && Boolean(testUserId)));
    const authState: AuthState = !isLoaded ? 'loading' : isSignedIn ? 'signed_in' : 'signed_out';
    return {
      isLoaded,
      isSignedIn,
      authState,
      userId: effectiveUserId,
      email: effectiveEmail,
      signOut,
    };
  }, [auth.isLoaded, auth.isSignedIn, isTestAuth, testUserId, effectiveUserId, effectiveEmail]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const CHANNEL_CONVERSION_REFRESH_INTERVAL_MS = 5_000;
const money = (value: number | null | undefined) => formatCompactMoney(value);
const moneyExact = (value: number | null | undefined) => formatMoney(value);
const currencySymbol = (code?: string | null) => {
  if (code) {
    return currencyForCode(code).symbol;
  }
  return currentCurrency().symbol;
};
const number = (value: number | null | undefined) => new Intl.NumberFormat('en-US').format(value || 0);
const dateShort = (value: string | null | undefined) => {
  if (!value) return '—';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
};
const dateFull = (value: string | null | undefined) => {
  if (!value) return '—';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const day = date.getDate();
  const month = new Intl.DateTimeFormat('en-GB', { month: 'short' }).format(date);
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
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
  wave: '/branding/takeorder-wave.png',
} as const;

function BrandMark({ variant = 'app', className = '' }: { variant?: keyof typeof brandAssets; className?: string }) {
  return <img src={brandAssets[variant]} alt="Take Order" aria-hidden="true" className={cn('object-contain', className)} />;
}

function BrandWordmark({ inverted = false, className = '' }: { inverted?: boolean; className?: string }) {
  return (
    <span className={cn('inline-flex items-center font-bold tracking-tight leading-none select-none text-[1.15em]', inverted ? 'text-white' : 'text-neutral-900 dark:text-white', className)}>
      Take Order
    </span>
  );
}

function BrandLockup({ inverted = false, className = '', iconClassName = 'h-7 w-7' }: { inverted?: boolean; className?: string; iconClassName?: string }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)} aria-label="Take Order">
      <img src={brandAssets.icon} alt="" className={cn('rounded-lg object-contain shadow-2xs shrink-0', iconClassName)} />
      <BrandWordmark inverted={inverted} className="text-lg" />
    </div>
  );
}

function SellerLogo({ businessName, logoDataUrl, className = '' }: { businessName: string; logoDataUrl?: string; className?: string }) {
  if (logoDataUrl) return <img src={logoDataUrl} alt={`${businessName} logo`} className={cn('seller-logo-image object-contain', className)} />;
  return <span className={cn('seller-logo-graphic', className)} role="img" aria-label={`${businessName} graphic logo`}><span>{initials(businessName || 'Shop')}</span><i aria-hidden="true" /></span>;
}

function PoweredByTakeOrder({ className = '' }: { className?: string }) {
  return (
    <div className={cn('flex items-center justify-center gap-1.5 text-[11px] text-[hsl(var(--muted-foreground))]', className)}>
      <span>Powered by</span>
      <div className="inline-flex items-center gap-1 font-bold text-neutral-900 dark:text-neutral-100">
        <img src={brandAssets.icon} alt="" className="h-3.5 w-3.5 rounded-[4px] object-contain shadow-2xs" />
        <span>Take Order</span>
      </div>
    </div>
  );
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

export function ChannelPicker({ value, onChange, testId }: { value: OrderInput['channel'] | ''; onChange: (value: OrderInput['channel']) => void; testId: string }) {
  return <div data-testid={testId} className="take-order-channel-picker grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Conversation channel">
    {orderChannels.map((channel) => {
      const selected = value === channel.value;
      return <button key={channel.value} type="button" role="radio" aria-label={channel.label} aria-checked={selected} data-testid={`${testId}-${channel.value}`} onClick={() => onChange(channel.value)} className={cn('take-order-channel-option flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-center text-xs font-semibold transition-all', selected ? 'border-[hsl(var(--foreground))] bg-[hsl(var(--foreground))] text-[hsl(var(--background))] shadow-sm' : 'border-[hsl(var(--border))] bg-white dark:bg-[hsl(var(--card))] hover:bg-[hsl(var(--muted))] text-[hsl(var(--foreground))]')}>
        <ChannelMark value={channel.value} size={15} colorful={!selected} className={selected ? 'text-[hsl(var(--background))]' : 'text-[hsl(var(--foreground))]'} />
        <span className="truncate">{channel.label}</span>
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

export const CONNECTED_TOOLS_KEY = 'duka-connected-tools';
const PENDING_SETTINGS_SYNC_KEY = 'duka-pending-settings-sync';
const DRAFT_AUTH_KEY = 'duka-draft-auth';

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

type CatalogView = 'grid' | 'list';
const CATALOG_VIEW_KEY = 'duka-catalog-view';
const readCatalogView = (storage: Pick<Storage, 'getItem'> | null = getPreferenceStorage()): CatalogView => {
  try {
    return storage?.getItem(CATALOG_VIEW_KEY) === 'list' ? 'list' : 'grid';
  } catch {
    return 'grid';
  }
};
const writeCatalogView = (view: CatalogView, storage: Pick<Storage, 'setItem'> | null = getPreferenceStorage()) => {
  try { storage?.setItem(CATALOG_VIEW_KEY, view); } catch { /* Storage can be unavailable in privacy-restricted browsers. */ }
};

const dashboardPeriods = new Set<DashboardPeriod>(['day', 'week', 'month', 'year', 'custom']);
type DraftAuth = {
  signInEmail?: string;
  signUpFullName?: string;
  signUpEmail?: string;
};

const readDraftAuth = (): DraftAuth => {
  try {
    const val = window.sessionStorage.getItem(DRAFT_AUTH_KEY) || window.localStorage.getItem(DRAFT_AUTH_KEY);
    return val ? (JSON.parse(val) as DraftAuth) : {};
  } catch { return {}; }
};

const writeDraftAuth = (patch: Partial<DraftAuth>) => {
  try {
    const current = readDraftAuth();
    const next = { ...current, ...patch };
    const serialized = JSON.stringify(next);
    window.sessionStorage.setItem(DRAFT_AUTH_KEY, serialized);
    window.localStorage.setItem(DRAFT_AUTH_KEY, serialized);
  } catch { /* Storage can be unavailable in privacy-restricted browsers. */ }
};

const clearDraftAuth = (keys?: (keyof DraftAuth)[]) => {
  try {
    if (!keys) {
      window.sessionStorage.removeItem(DRAFT_AUTH_KEY);
      window.localStorage.removeItem(DRAFT_AUTH_KEY);
      return;
    }
    const current = readDraftAuth();
    keys.forEach((k) => delete current[k]);
    const serialized = JSON.stringify(current);
    window.sessionStorage.setItem(DRAFT_AUTH_KEY, serialized);
    window.localStorage.setItem(DRAFT_AUTH_KEY, serialized);
  } catch { /* Storage can be unavailable in privacy-restricted browsers. */ }
};

const readPendingSettingsSync = (): SellerSettings | null => {
  try {
    const val = window.localStorage.getItem(PENDING_SETTINGS_SYNC_KEY);
    return val ? (JSON.parse(val) as SellerSettings) : null;
  } catch { return null; }
};

const writePendingSettingsSync = (settings: SellerSettings) => {
  try {
    window.localStorage.setItem(PENDING_SETTINGS_SYNC_KEY, JSON.stringify(settings));
  } catch { /* Storage can be unavailable in privacy-restricted browsers. */ }
};

const clearPendingSettingsSync = () => {
  try {
    window.localStorage.removeItem(PENDING_SETTINGS_SYNC_KEY);
  } catch { /* Storage can be unavailable in privacy-restricted browsers. */ }
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


function useIsOnline() {
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== 'undefined' && 'onLine' in navigator ? navigator.onLine : true));
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  return isOnline;
}
export function Sidebar({
  collapsed = false,
  onToggleCollapse = () => {},
  isMobile = false,
  onMobileClose,
}: {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  isMobile?: boolean;
  onMobileClose?: () => void;
} = {}) {
  const [location] = useLocation();
  const { userId, signOut } = useAppAuth();
  const seller = readSellerProfile(userId);
  const entitlements = useEntitlements(userId);
  const { isPro, isProPlus, isTrial } = entitlements;
  const { openPaywall } = usePaywall();
  const ordersQuery = useListOrders();
  const pendingOrdersCount = (ordersQuery.data ?? []).filter((o) => o.fulfillment === 'pending').length;

  const links = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/catalog', label: 'Catalog', icon: Boxes },
    { href: '/orders', label: 'Orders', icon: ShoppingBag, badge: pendingOrdersCount > 0 ? String(pendingOrdersCount) : null },
    { href: '/analytics', label: 'Analytics', icon: BarChart3 },
    { href: '/clients', label: 'Clients', icon: Users },
    { href: '/expenses', label: 'Expenses', icon: Receipt },
    { href: '/take-order', label: 'Take an order', icon: Link2, dot: true },
  ];

  return (
    <aside
      className={cn(
        isMobile
          ? 'flex flex-col h-full w-full bg-[hsl(var(--sidebar))] text-[hsl(var(--sidebar-foreground))] border-r border-[hsl(var(--sidebar-border))]'
          : 'desktop-sidebar fixed inset-y-0 left-0 z-30 hidden md:flex flex-col bg-[hsl(var(--sidebar))] text-[hsl(var(--sidebar-foreground))] transition-all duration-200 ease-in-out border-r border-[hsl(var(--sidebar-border))]',
        !isMobile && (collapsed ? 'w-[72px]' : 'w-[272px]')
      )}
      aria-label="App navigation"
    >
      {/* ── Workspace switcher / brand header ─── */}
      {isMobile ? (
        <div className="flex h-[60px] items-center justify-between border-b border-[hsl(var(--sidebar-border))] px-4">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] bg-[hsl(var(--primary))] text-white text-[11px] font-bold shadow-xs">
              T
            </div>
            <span className="truncate text-[13.5px] font-semibold text-[hsl(var(--foreground))]">Take Order App</span>
          </div>
          {onMobileClose && (
            <button
              type="button"
              onClick={onMobileClose}
              aria-label="Close sidebar"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--foreground))] transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          )}
        </div>
      ) : collapsed ? (
        <div className="flex h-[60px] items-center justify-center border-b border-[hsl(var(--sidebar-border))]">
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label="Expand sidebar"
            title="Expand sidebar"
            className="group relative flex h-10 w-10 items-center justify-center rounded-xl hover:bg-[hsl(var(--sidebar-accent))] transition-colors cursor-pointer"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-[6px] bg-[hsl(var(--primary))] text-white text-[11px] font-bold transition-all duration-200 group-hover:scale-0 group-hover:opacity-0">
              T
            </div>
            <PanelLeftOpen
              size={18}
              className="absolute text-[hsl(var(--sidebar-foreground))] transition-all duration-200 scale-0 opacity-0 group-hover:scale-100 group-hover:opacity-100"
            />
          </button>
        </div>
      ) : (
        <div className="flex h-[60px] items-center justify-between border-b border-[hsl(var(--sidebar-border))] px-4">
          {/* Workspace switcher button */}
          <Link
            href="/dashboard"
            aria-label="Dashboard"
            className="flex items-center gap-2.5 min-w-0 flex-1 hover:bg-[hsl(var(--sidebar-accent))] rounded-[8px] px-2 py-1.5 -mx-2 transition-colors"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] bg-[hsl(var(--primary))] text-white text-[11px] font-bold shadow-xs">
              T
            </div>
            <span className="truncate text-[13.5px] font-semibold text-[hsl(var(--foreground))]">Take Order App</span>
            <ChevronDown size={13} className="shrink-0 text-[hsl(var(--muted-foreground))] ml-auto" />
          </Link>
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label="Collapse sidebar"
            title="Collapse sidebar"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--foreground))] transition-colors ml-1"
          >
            <PanelLeftClose size={15} />
          </button>
        </div>
      )}

      {/* ── Navigation Links ── */}
      <nav aria-label="Navigation" className={cn('sidebar-scroll flex-1 overflow-y-auto pt-3 pb-2', collapsed ? 'px-2' : 'px-3')}>
        {links.map(({ href, label, icon: Icon, badge, dot }) => {
          const isActive = location === href;
          return (
            <Link
              key={href}
              href={href}
              data-testid={`link-${label.toLowerCase().replaceAll(' ', '-')}`}
              aria-current={isActive ? 'page' : undefined}
              title={collapsed ? label : undefined}
              className={cn(
                'group flex items-center transition-colors rounded-[8px] text-[13.5px]',
                collapsed
                  ? 'h-10 w-10 mx-auto justify-center mb-1'
                  : 'gap-2.5 px-3 py-2 mb-0.5',
                isActive
                  ? 'bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--foreground))] font-semibold'
                  : 'font-medium text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--foreground))]'
              )}
            >
              <Icon
                aria-hidden="true"
                size={17}
                strokeWidth={isActive ? 2 : 1.7}
                className="shrink-0"
              />
              {!collapsed && (
                <div className="flex items-center justify-between flex-1 min-w-0">
                  <span className="truncate">{label}</span>
                  {badge && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] shrink-0">
                      {badge}
                    </span>
                  )}
                  {dot && !badge && (
                    <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--primary))] shrink-0" />
                  )}
                  {!entitlements.isLoading && entitlements.tier === 'free' && (href === '/analytics' || href === '/reports') && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-[4px] bg-[hsl(var(--primary))] text-white shadow-2xs shrink-0">
                      PRO
                    </span>
                  )}
                </div>
              )}
            </Link>
          );
        })}

        <div className={cn('my-3 h-px bg-[hsl(var(--sidebar-border))]', collapsed ? 'mx-1' : 'mx-2')} />

        <Link
          href="/settings"
          data-testid="link-settings"
          aria-current={location === '/settings' ? 'page' : undefined}
          title={collapsed ? 'Profile & settings' : undefined}
          className={cn(
            'group flex items-center transition-colors rounded-[11px] font-medium text-sm',
            collapsed
              ? 'h-10 w-10 mx-auto justify-center mb-1.5'
              : 'gap-3 px-3.5 py-2.5 mb-1',
            location === '/settings'
              ? 'bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-accent-foreground))] font-semibold shadow-xs'
              : 'text-[hsl(var(--sidebar-foreground))]/60 hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-foreground))]'
          )}
        >
          <UserRound aria-hidden="true" size={18} className="shrink-0" />
          {!collapsed && <span>Profile & settings</span>}
        </Link>

        <Link
          href="/connect"
          data-testid="link-connect"
          aria-current={location === '/connect' ? 'page' : undefined}
          title={collapsed ? 'Connect tools' : undefined}
          className={cn(
            'group flex items-center transition-colors rounded-[11px] font-medium text-sm',
            collapsed
              ? 'h-10 w-10 mx-auto justify-center mb-1.5'
              : 'gap-3 px-3.5 py-2.5 mb-1',
            location === '/connect'
              ? 'bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-accent-foreground))] font-semibold shadow-xs'
              : 'text-[hsl(var(--sidebar-foreground))]/60 hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-foreground))]'
          )}
        >
          <Settings2 aria-hidden="true" size={18} className="shrink-0" />
          {!collapsed && <span>Connect tools</span>}
        </Link>
      </nav>

      {/* Upgrade / Subscription Action Card */}
      <SidebarProCard collapsed={collapsed} />

      {/* Bottom Profile Bar with Account Popover */}
      <Popover>
        <PopoverTrigger asChild>
          {collapsed ? (
            <div className="flex h-16 items-center justify-center border-t border-[hsl(var(--sidebar-border))]">
              <button
                type="button"
                aria-label="Open profile and settings"
                title={`${seller?.sellerName || 'Amina Mensah'} · Account`}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[hsl(var(--chart-3))] text-xs font-bold text-white shadow-xs hover:ring-2 hover:ring-[hsl(var(--primary))]/30 transition-all cursor-pointer"
              >
                {initials(seller?.sellerName || 'Amina Mensah')}
              </button>
            </div>
          ) : (
            <button
              type="button"
              aria-label="Open profile and settings"
              className="w-full text-left flex items-center gap-3 border-t border-[hsl(var(--sidebar-border))] px-3.5 py-3 transition-colors hover:bg-[hsl(var(--sidebar-accent))] cursor-pointer group"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[hsl(var(--chart-3))] text-xs font-bold text-white shrink-0 shadow-2xs">
                {initials(seller?.sellerName || 'Amina Mensah')}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-semibold">{seller?.sellerName || 'Amina Mensah'}</div>
                <div className="flex items-center gap-1.5 truncate">
                  <span className="truncate text-[11px] text-[hsl(var(--sidebar-foreground))]/55">{seller?.businessName || 'The Sunday Edit'}</span>
                  {isProPlus ? (
                    <span className="inline-flex items-center justify-center h-3.5 w-3.5 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 shrink-0 shadow-2xs" title="Verified Pro+ Seller">
                      <Check size={9} strokeWidth={3.5} />
                    </span>
                  ) : isPro ? (
                    <span className="inline-flex items-center justify-center h-3.5 w-3.5 rounded-full bg-[#1d9bf0] text-white shrink-0 shadow-2xs" title="Verified Pro Seller">
                      <Check size={9} strokeWidth={3.5} />
                    </span>
                  ) : null}
                </div>
              </div>
              <MoreHorizontal aria-hidden="true" className="ml-auto text-[hsl(var(--sidebar-foreground))]/45 group-hover:text-[hsl(var(--sidebar-foreground))]" size={15} />
            </button>
          )}
        </PopoverTrigger>
        <PopoverContent
          side="top"
          align={collapsed ? 'start' : 'center'}
          sideOffset={8}
          className="w-56 p-2 rounded-2xl shadow-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]"
        >
          <div className="px-2.5 py-2 border-b border-[hsl(var(--border))] mb-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[hsl(var(--foreground))] truncate">
              <span className="truncate">{seller?.businessName || 'The Sunday Edit'}</span>
              {isProPlus ? (
                <span className="inline-flex items-center justify-center h-3.5 w-3.5 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 shrink-0" title="Verified Pro+ Seller">
                  <Check size={9} strokeWidth={3.5} />
                </span>
              ) : isPro ? (
                <span className="inline-flex items-center justify-center h-3.5 w-3.5 rounded-full bg-[#1d9bf0] text-white shrink-0" title="Verified Pro Seller">
                  <Check size={9} strokeWidth={3.5} />
                </span>
              ) : null}
            </div>
            <div className="text-[11px] text-[hsl(var(--muted-foreground))] truncate">
              {seller?.sellerName || 'Store Owner'}
            </div>
          </div>
          <div className="space-y-0.5">
            <Link
              href="/settings"
              className="flex items-center gap-2.5 px-2.5 py-2 text-xs font-medium rounded-xl text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors"
            >
              <UserRound size={14} className="text-[hsl(var(--muted-foreground))]" />
              <span>Profile & Settings</span>
            </Link>
            <Link
              href="/account/billing"
              className="flex items-center justify-between px-2.5 py-2 text-xs font-medium rounded-xl text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors"
            >
              <span className="flex items-center gap-2.5">
                <Crown size={14} className="text-amber-500" />
                <span>Subscription</span>
              </span>
              {isPro && <span className="text-[9px] font-bold uppercase text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">Pro</span>}
            </Link>
            <Link
              href="/terms"
              className="flex items-center gap-2.5 px-2.5 py-2 text-xs font-medium rounded-xl text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors"
            >
              <FileText size={14} className="text-[hsl(var(--muted-foreground))]" />
              <span>Terms & Policies</span>
            </Link>
          </div>
          <div className="border-t border-[hsl(var(--border))] mt-1.5 pt-1">
            <button
              type="button"
              onClick={() => void signOut()}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 text-xs font-semibold rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors cursor-pointer"
            >
              <LogOut size={14} />
              <span>Log out</span>
            </button>
          </div>
        </PopoverContent>
      </Popover>
    </aside>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('takeorder-sidebar-collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const toggleCollapse = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('takeorder-sidebar-collapsed', String(next));
      } catch {}
      return next;
    });
  };

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [location] = useLocation();

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location]);

  return (
    <MobileNavContext.Provider
      value={{
        openMobileNav: () => setMobileNavOpen(true),
      }}
    >
      <div className="take-order-shell grain min-h-screen bg-[hsl(var(--background))]">
        {/* Desktop Sidebar (hidden on mobile) */}
        <Sidebar collapsed={collapsed} onToggleCollapse={toggleCollapse} />

        {/* Mobile Slide-Over Drawer */}
        {mobileNavOpen && (
          <div
            className="fixed inset-0 z-50 md:hidden flex"
            role="dialog"
            aria-modal="true"
            aria-label="Mobile Navigation"
          >
            <div
              className="fixed inset-0 bg-black/45 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
              onClick={() => setMobileNavOpen(false)}
              aria-hidden="true"
            />
            <div className="relative z-50 w-[280px] max-w-[85vw] h-full shadow-2xl flex flex-col animate-in slide-in-from-left duration-200">
              <Sidebar isMobile onMobileClose={() => setMobileNavOpen(false)} />
            </div>
          </div>
        )}

        {/* Main Content Area — starts right at the top with generous padding */}
        <main
          className={cn(
            'page-content min-h-[100dvh] transition-all duration-200 ease-in-out',
            collapsed ? 'md:ml-[72px]' : 'md:ml-[272px]'
          )}
        >
          <div className="px-5 sm:px-8 lg:px-10 py-8 max-w-[1120px] w-full">
            {children}
          </div>
        </main>
      </div>
    </MobileNavContext.Provider>
  );
}

export function MobileMenuButton({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={open ? 'Close navigation menu' : 'Open navigation menu'}
      aria-expanded={open}
      className="md:hidden flex h-10 w-10 min-h-[44px] min-w-[44px] items-center justify-center rounded-[8px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition shrink-0 cursor-pointer"
    >
      {open ? <X size={18} /> : <Menu size={18} />}
    </button>
  );
}

function PageHeading({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return (
    <PageHeader
      breadcrumbs={eyebrow}
      title={title}
      primaryAction={action}
      children={description ? <p className="mt-1.5 max-w-[580px] text-sm text-[hsl(var(--muted-foreground))] leading-relaxed">{description}</p> : undefined}
    />
  );
}

function Button({ children, variant = 'primary', className, ...props }: { children: ReactNode; variant?: 'primary' | 'soft' | 'outline' | 'danger' | 'ghost'; className?: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} className={cn('inline-flex min-h-[40px] items-center justify-center gap-2 rounded-full px-5 py-2 text-sm font-semibold tracking-[-.01em] transition-all duration-200 ease-out active:scale-[0.985] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--ring))] disabled:cursor-not-allowed disabled:opacity-50', variant === 'primary' && 'bg-[#0f172a] text-white shadow-sm hover:bg-[#1e293b]', variant === 'soft' && 'bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))] hover:bg-[hsl(var(--muted))]', variant === 'outline' && 'border border-slate-200 bg-[hsl(var(--card))] text-[hsl(var(--foreground))] hover:border-slate-400 hover:bg-slate-50', variant === 'danger' && 'border border-[hsl(var(--destructive))]/30 bg-[hsl(var(--destructive))]/10 text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive))]/20', variant === 'ghost' && 'border border-transparent bg-transparent text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]', className)} {...props}>{children}</button>;
}

export function CatalogActions({
  productId,
  productName,
  onEdit,
  onDelete,
  deleteDisabled = false,
}: {
  productId?: number;
  productName?: string;
  onEdit: () => void;
  onDelete: () => void;
  deleteDisabled?: boolean;
}) {
  return <div className="catalog-actions-cell flex items-center justify-end gap-1.5"><button type="button" onClick={onEdit} aria-label={productName ? `Edit ${productName}` : 'Edit item'} data-testid={productId ? `button-edit-product-${productId}` : 'button-edit-product'} className="rounded-lg p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]"><Pencil size={15} /></button><button type="button" onClick={onDelete} disabled={deleteDisabled} aria-label={productName ? `Delete ${productName}` : 'Delete item'} data-testid={productId ? `button-delete-product-${productId}` : 'button-delete-product'} className="rounded-lg p-2 text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive))]/10 disabled:opacity-40"><Trash2 size={15} /></button></div>;
}

export function ExpenseActions({
  expenseId,
  expenseTitle,
  onEdit,
  onDelete,
  deleteDisabled = false,
}: {
  expenseId?: number;
  expenseTitle?: string;
  onEdit: () => void;
  onDelete: () => void;
  deleteDisabled?: boolean;
}) {
  return <div className="flex items-center justify-end gap-1"><button type="button" onClick={onEdit} aria-label={expenseTitle ? `Edit ${expenseTitle}` : 'Edit expense'} data-testid={expenseId ? `button-edit-expense-${expenseId}` : 'button-edit-expense'} className="rounded-lg p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]"><Pencil size={15} /></button><button type="button" onClick={onDelete} disabled={deleteDisabled} aria-label={expenseTitle ? `Delete ${expenseTitle}` : 'Delete expense'} data-testid={expenseId ? `button-delete-expense-${expenseId}` : 'button-delete-expense'} className="rounded-lg p-2 text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive))]/10 disabled:opacity-40"><Trash2 size={15} /></button></div>;
}

function Card({ children, className = '', ...props }: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>) { return <div {...props} className={cn('app-card', className)}>{children}</div>; }
function Skeleton({ className = '' }: { className?: string }) { return <div className={cn('animate-pulse rounded-lg bg-[hsl(var(--muted))]', className)} />; }
function EmptyState({ icon: Icon, title, description, action, card = false }: { icon: typeof Package; title: string; description?: string; action?: ReactNode; card?: boolean }) { return <div className={cn(card && 'app-card', 'flex flex-col items-center justify-center px-6 py-16 text-center')}><div className="mb-4 flex h-12 w-12 items-center justify-center rounded-[14px] bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"><Icon size={22} /></div><h2 className="type-h2">{title}</h2>{description && <p className="mt-2 max-w-[340px] type-body">{description}</p>}{action && <div className="mt-5">{action}</div>}</div>; }
function ErrorState({ retry }: { retry: () => void }) { return <div className="rounded-[16px] border border-[hsl(var(--destructive))]/20 bg-[hsl(var(--destructive))]/5 p-8 text-center"><p className="font-semibold">Something could not load.</p><p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">Give it another try or check your connection.</p><Button className="mt-5" variant="outline" onClick={retry}><RefreshCw size={15} />Try again</Button></div>; }
function StatusPill({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'gold' | 'mint' | 'rose' | 'blue' | 'reserved' }) {
  const paid = tone === 'mint';
  const deposit = tone === 'gold';
  const reserved = tone === 'reserved';
  const shipped = tone === 'blue';
  const rose = tone === 'rose';
  return <span data-tone={tone} className={cn(
    'inline-flex items-center gap-1 rounded-[6px] px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.06em] border transition-colors',
    paid && 'border-emerald-200/50 bg-[#eaf8ee] text-[#15803d] dark:border-emerald-800/40 dark:bg-emerald-950/40 dark:text-emerald-300',
    deposit && 'border-amber-200/60 bg-amber-50 text-amber-700 dark:border-amber-800/40 dark:bg-amber-950/40 dark:text-amber-300',
    reserved && 'border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
    shipped && 'border-sky-200/60 bg-sky-50 text-sky-700 dark:border-sky-800/40 dark:bg-sky-950/40 dark:text-sky-300',
    rose && 'border-rose-200/60 bg-rose-50 text-rose-700 dark:border-rose-800/40 dark:bg-rose-950/40 dark:text-rose-300',
    !paid && !deposit && !reserved && !shipped && !rose && 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400'
  )}>
    {paid && <Check size={11} strokeWidth={3} aria-hidden="true" />}
    {deposit && <CircleDollarSign size={11} strokeWidth={2.5} aria-hidden="true" />}
    {reserved && <Clock3 size={11} strokeWidth={2.5} aria-hidden="true" />}
    {shipped && <ArrowUpRight size={11} strokeWidth={2.5} aria-hidden="true" />}
    {children}
  </span>;
}

const paymentTone = (status: Order['status']): 'neutral' | 'gold' | 'mint' | 'reserved' =>
  status === 'paid' ? 'mint' : status === 'deposit_paid' ? 'gold' : status === 'reserved' ? 'reserved' : 'neutral';
const paymentLabel = (order: Order) => order.status === 'deposit_paid' ? 'Deposit paid' : order.status === 'paid' ? 'Paid in full' : 'Awaiting payment';
const fulfillmentLabel = (value: Order['fulfillment']) => value === 'pending' ? 'To ship' : value[0].toUpperCase() + value.slice(1);
type MetricTrend = { direction: 'up' | 'down'; percentage: number | null; tone?: 'positive' | 'negative' | 'neutral' };
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
  const effectiveTone = trend?.tone || indicator?.tone;
  const isNeutral = trend?.percentage === null || effectiveTone === 'neutral' || (!effectiveTone && !trend?.direction && (!indicator?.direction || indicator.direction === 'neutral'));
  const indicatorTone = isNeutral
    ? 'metric-trend-neutral'
    : effectiveTone === 'positive'
      ? 'metric-trend-up'
      : effectiveTone === 'negative'
        ? 'metric-trend-down'
        : (trend?.direction === 'up' || indicator?.direction === 'up')
          ? 'metric-trend-up'
          : (trend?.direction === 'down' || indicator?.direction === 'down')
            ? 'metric-trend-down'
            : 'metric-trend-neutral';
  const isGreen = indicatorTone === 'metric-trend-up';
  const isRed = indicatorTone === 'metric-trend-down';
  const indicatorLabel = trend ? (trend.percentage === null ? 'New' : `${isGreen ? '+' : isRed ? '-' : ''}${trend.percentage}%`) : `${indicator?.percentage.toFixed(1)}%`;
  const indicatorAriaLabel = trend ? (trend.percentage === null ? 'New activity' : `${isGreen ? 'Up' : isRed ? 'Down' : 'Neutral'} ${trend.percentage}%`) : `${isGreen ? 'Up' : isRed ? 'Down' : 'Neutral'} ${indicator?.percentage.toFixed(1)}%`;
  const IndicatorIcon = isGreen ? ArrowUp : isRed ? ArrowDown : null;
  return <Card className={cn('metric-card p-6 sm:p-7 flex flex-col justify-between min-h-[176px]', className)} style={style} data-testid={dataTestId}>
    <div>
      <div className="flex items-start justify-between gap-3">
        <div className="metric-card-heading">
          <div className="type-stat-label">{label}</div>
        </div>
        {loading ? <Skeleton className="h-6 w-14 rounded-full" /> : (trend || indicator) && <span className={cn('metric-trend-badge', indicatorTone)} aria-label={indicatorAriaLabel}>
          {IndicatorIcon && <IndicatorIcon size={12} strokeWidth={2.5} aria-hidden="true" />}
          <span>{indicatorLabel}</span>
        </span>}
      </div>
      <div className="metric-value-row mt-3.5 type-stat-value">
        {loading ? <Skeleton className="h-10 w-28" /> : <>{valueAccessory}<span className="metric-value-content">{value}</span></>}
      </div>
    </div>
    {note && (loading ? <Skeleton className="mt-4 h-4 w-40" /> : <div className="mt-4 pt-2 type-body-small text-[hsl(var(--muted-foreground))]">{note}</div>)}
  </Card>;
}
function InsightCard({ icon: Icon, title, description, className = '', dataTestId }: { icon: typeof CircleDollarSign; title: string; description?: string; className?: string; dataTestId?: string }) {
  return <Card className={cn('flex items-center gap-4 p-6 sm:p-7 min-h-[176px]', className)} data-testid={dataTestId}><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-[hsl(var(--accent))]/15 text-[hsl(var(--foreground))]"><Icon size={22} /></div><div><div className="type-h3">{title}</div>{description && <p className="mt-1.5 type-body">{description}</p>}</div></Card>;
}

function GoogleIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
      />
    </svg>
  );
}

function AppleIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.61-.75 1.04-1.8 1.01-2.87-.96.04-2.07.65-2.73 1.41-.57.66-.99 1.69-.93 2.76 1.05.08 2.06-.57 2.65-1.3z" />
    </svg>
  );
}

function AuthShowcaseCard() {
  return (
    <div className="relative w-full h-full overflow-hidden flex items-center justify-center bg-white select-none">
      <img
        src="/illustrations/takemarket1_3.jpg"
        alt="Take Order Showcase"
        className="w-full h-full object-cover object-center select-none pointer-events-none"
      />
    </div>
  );
}

const onboardingCategoryImages: Record<string, string> = {
  'Fashion & Apparel': 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=700&h=500&q=80',
  'Beauty & Skincare': 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=700&h=500&q=80',
  'Sneakers & Shoes': 'https://images.unsplash.com/photo-1552346154-21d32810aba3?auto=format&fit=crop&w=700&h=500&q=80',
  'Jewelry & Accessories': 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=700&h=500&q=80',
  'Perfumes & Scents': 'https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?auto=format&fit=crop&w=700&h=500&q=80',
  'Tech & Gadgets': 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=700&h=500&q=80',
  'Food & Bakery': 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=700&h=500&q=80',
  'Home & Living': 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=700&h=500&q=80',
  'Other Products': 'https://images.unsplash.com/photo-1472851294608-062f824d29cc?auto=format&fit=crop&w=700&h=500&q=80',
};

export function OnboardingShowcase({ step, profile }: { step: number; profile: SellerProfile }) {
  const symbol = currencySymbol(profile.currency || 'GHS');
  
  if (step === 0) {
    const fullName = `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || 'Sarah Mensah';
    return (
      <div className="onboarding-showcase-container">
        <div className="onboarding-showcase-card">
          <div className="onboarding-showcase-image-wrap">
            <img
              src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=700&h=500&q=80"
              alt="Take Order seller"
              loading="lazy"
            />
            <span className="onboarding-showcase-badge">SELLER IDENTITY · STEP 1 OF 4</span>
          </div>
          <div className="onboarding-showcase-body">
            <h2 className="text-lg font-bold text-neutral-900 tracking-tight">Your Private Seller Identity</h2>
            <p className="mt-1 text-xs text-neutral-600 leading-relaxed">
              Set up your verified merchant profile. Connect your contact details and home currency for automated calculations.
            </p>
            <div className="onboarding-showcase-subcard space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-500 font-medium">Merchant:</span>
                <strong className="text-neutral-900">{fullName}</strong>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-500 font-medium">Contact:</span>
                <span className="font-mono-ui text-neutral-800">{profile.phone || profile.whatsappPhone || '+233 24 123 4567'}</span>
              </div>
              <div className="flex items-center justify-between text-xs pt-1 border-t border-neutral-200/60">
                <span className="text-neutral-500 font-medium">Country & Currency:</span>
                <span className="font-semibold text-emerald-700">{profile.country || 'Ghana'} ({profile.currency || 'GHS'} · {symbol})</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === 1) {
    const storeName = profile.businessName.trim() || 'Your Store Name';
    const storeSlug = profile.businessName ? profile.businessName.toLowerCase().replace(/[^a-z0-9]/g, '') : 'store';
    return (
      <div className="onboarding-showcase-container">
        <div className="onboarding-showcase-card">
          <div className="onboarding-showcase-image-wrap">
            <img
              src="https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=700&h=500&q=80"
              alt="Boutique storefront"
              loading="lazy"
            />
            <span className="onboarding-showcase-badge">STOREFRONT · STEP 2 OF 4</span>
          </div>
          <div className="onboarding-showcase-body">
            <h2 className="text-lg font-bold text-neutral-900 tracking-tight">Instant Live Storefront</h2>
            <p className="mt-1 text-xs text-neutral-600 leading-relaxed">
              Your storefront link is generated live as you type. Share it directly in WhatsApp, Instagram DMs, or TikTok chats.
            </p>
            <div className="onboarding-showcase-subcard space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-500 font-medium">Store name:</span>
                <strong className="text-neutral-900">{storeName}</strong>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-500 font-medium">Public link:</span>
                <span className="font-mono-ui font-semibold text-blue-600">takeorder.io/@{storeSlug}</span>
              </div>
              <div className="flex items-center justify-between text-xs pt-1 border-t border-neutral-200/60">
                <span className="text-neutral-500 font-medium">Status:</span>
                <span className="inline-flex items-center gap-1 font-semibold text-emerald-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Ready to take orders
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === 2) {
    const selectedCat = profile.category || 'Fashion & Apparel';
    const catImage = onboardingCategoryImages[selectedCat] || onboardingCategoryImages['Fashion & Apparel'];
    return (
      <div className="onboarding-showcase-container">
        <div className="onboarding-showcase-card">
          <div className="onboarding-showcase-image-wrap">
            <img
              src={catImage}
              alt={selectedCat}
              loading="lazy"
            />
            <span className="onboarding-showcase-badge">CATALOG · STEP 3 OF 4</span>
          </div>
          <div className="onboarding-showcase-body">
            <h2 className="text-lg font-bold text-neutral-900 tracking-tight">Tailored Product Catalog</h2>
            <p className="mt-1 text-xs text-neutral-600 leading-relaxed">
              Take Order configures variant options, sizing, and color swatches matching your specific commerce category.
            </p>
            <div className="onboarding-showcase-subcard space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-500 font-medium">Category:</span>
                <strong className="text-neutral-900">{selectedCat}</strong>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-500 font-medium">Features enabled:</span>
                <span className="text-neutral-800 font-medium">Sizes · Colors · Qty counters</span>
              </div>
              <div className="flex items-center justify-between text-xs pt-1 border-t border-neutral-200/60">
                <span className="text-neutral-500 font-medium">Sample item quote:</span>
                <span className="font-mono-ui font-bold text-neutral-900">{symbol} 250.00</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === 3) {
    const teamLabel = profile.teamSize || 'Just me (Solo seller)';
    return (
      <div className="onboarding-showcase-container">
        <div className="onboarding-showcase-card">
          <div className="onboarding-showcase-image-wrap">
            <img
              src="https://images.unsplash.com/photo-1556742049-0a67e557224b?auto=format&fit=crop&w=700&h=500&q=80"
              alt="Fulfillment workflow"
              loading="lazy"
            />
            <span className="onboarding-showcase-badge">OPERATIONS · STEP 4 OF 4</span>
          </div>
          <div className="onboarding-showcase-body">
            <h2 className="text-lg font-bold text-neutral-900 tracking-tight">Order Fulfillment & Delivery</h2>
            <p className="mt-1 text-xs text-neutral-600 leading-relaxed">
              Coordinate deliveries with copyable motorbike rider slips, and track deposits and balances due upon delivery.
            </p>
            <div className="onboarding-showcase-subcard space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-500 font-medium">Team structure:</span>
                <strong className="text-neutral-900">{teamLabel}</strong>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-500 font-medium">Courier workflow:</span>
                <span className="text-neutral-800 font-medium">Motorbike Rider Dispatch Slips</span>
              </div>
              <div className="flex items-center justify-between text-xs pt-1 border-t border-neutral-200/60">
                <span className="text-neutral-500 font-medium">Balance protection:</span>
                <span className="font-semibold text-emerald-600">Track paid vs due on delivery</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Step 4: Pro Trial Paywall Showcase
  return (
    <div className="onboarding-showcase-container">
      <div className="onboarding-showcase-card">
        <div className="onboarding-showcase-image-wrap">
          <img
            src="https://images.unsplash.com/photo-1556742049-0a67e557224b?auto=format&fit=crop&w=700&h=500&q=80"
            alt="Pro Seller Experience"
            loading="lazy"
          />
          <span className="onboarding-showcase-badge">7-DAY FREE TRIAL · PRO ACCESS</span>
        </div>
        <div className="onboarding-showcase-body">
          <h2 className="text-lg font-bold text-neutral-900 tracking-tight">Pro Seller Experience</h2>
          <p className="mt-1 text-xs text-neutral-600 leading-relaxed">
            Close DM buyers faster with custom order checkout links, WhatsApp receipts, and full analytics.
          </p>
          <div className="onboarding-showcase-subcard space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-neutral-500 font-medium">Free trial:</span>
              <strong className="text-emerald-600 font-semibold">7 Days Free</strong>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-neutral-500 font-medium">Order links:</span>
              <span className="font-semibold text-neutral-900">Unlimited capacity</span>
            </div>
            <div className="flex items-center justify-between text-xs pt-1 border-t border-neutral-200/60">
              <span className="text-neutral-500 font-medium">Cancellation:</span>
              <span className="text-neutral-700">Cancel anytime in 1-click</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AuthSplitLayout({
  children,
  showcase,
}: {
  children: ReactNode;
  rightVariant?: 'default' | 'onboarding';
  showcase?: ReactNode;
}) {
  return (
    <div className="auth-split-wrapper">
      <div className="auth-split-left">
        <div className="w-full max-w-[420px] mx-auto my-auto py-2 flex flex-col justify-center">
          {children}
        </div>
      </div>

      {/* Right Column Showcase */}
      <div className="auth-split-right" aria-hidden="true">
        {showcase || <AuthShowcaseCard />}
      </div>
    </div>
  );
}

const countryCurrencyMap: Record<string, SellerSettings['currency']> = {
  'Ghana': 'GHS',
  'Nigeria': 'NGN',
  'Kenya': 'KES',
  'South Africa': 'ZAR',
  'United Kingdom': 'GBP',
  'United States': 'USD',
  'Canada': 'CAD',
  'Other': 'USD',
};

const countryDialPrefixMap: Record<string, string> = {
  'Ghana': '+233',
  'Nigeria': '+234',
  'Kenya': '+254',
  'South Africa': '+27',
  'United Kingdom': '+44',
  'United States': '+1',
  'Canada': '+1',
  'Other': '+1',
};

const onboardingCategories = [
  { id: 'fashion', label: 'Fashion & Apparel', icon: <Shirt size={22} className="stroke-[1.75]" /> },
  { id: 'beauty', label: 'Beauty & Skincare', icon: <Sparkles size={22} className="stroke-[1.75]" /> },
  { id: 'sneakers', label: 'Sneakers & Shoes', icon: <Package size={22} className="stroke-[1.75]" /> },
  { id: 'jewelry', label: 'Jewelry & Accessories', icon: <Sparkles size={22} className="stroke-[1.75]" /> },
  { id: 'hair', label: 'Hair & Salon', icon: <Scissors size={22} className="stroke-[1.75]" /> },
  { id: 'barber', label: 'Barber & Grooming', icon: <Scissors size={22} className="stroke-[1.75]" /> },
  { id: 'electronics', label: 'Tech & Gadgets', icon: <Smartphone size={22} className="stroke-[1.75]" /> },
  { id: 'food', label: 'Food & Bakery', icon: <Coffee size={22} className="stroke-[1.75]" /> },
  { id: 'home', label: 'Home & Living', icon: <Building2 size={22} className="stroke-[1.75]" /> },
  { id: 'fragrance', label: 'Perfumes & Scents', icon: <Zap size={22} className="stroke-[1.75]" /> },
  { id: 'wellness', label: 'Fitness & Recovery', icon: <Heart size={22} className="stroke-[1.75]" /> },
  { id: 'other', label: 'Other Products & Services', icon: <ShoppingBag size={22} className="stroke-[1.75]" /> },
];

const teamSizeOptions = [
  { id: 'solo', label: "I'm an Independent", subtitle: 'Solo seller or creator' },
  { id: '2-5', label: '2-5 people', subtitle: 'Small team' },
  { id: '6-10', label: '6-10 people', subtitle: 'Growing business' },
  { id: '11-20', label: '11-20 people', subtitle: 'Mid-sized operation' },
  { id: '20+', label: '20+ people', subtitle: 'Established team' },
];

export function Onboarding() {
  const [, setLocation] = useLocation();
  const { userId } = useAppAuth();
  const { user } = useUser();
  const isOnline = useIsOnline();
  const [step, setStep] = useState(() => Math.min(readOnboardingStep(userId), 4));
  const [profile, setProfile] = useState<SellerProfile>(() => readSellerProfile(userId));
  const [onboardingSaveError, setOnboardingSaveError] = useState('');
  const [offlineSavedNotice, setOfflineSavedNotice] = useState(false);
  const [agreedOutreach, setAgreedOutreach] = useState(false);
  const [agreedTerms, setAgreedTerms] = useState(true);
  const [isSubmittingStep0, setIsSubmittingStep0] = useState(false);
  const settingsQuery = useGetSellerSettings();
  const saveOnboardingSettingsMutation = useUpdateSellerSettings();

  useEffect(() => {
    if (user && (!profile.firstName || !profile.lastName)) {
      setProfile((prev) => {
        let changed = false;
        const next = { ...prev };
        if (!next.firstName && user.firstName) {
          next.firstName = user.firstName;
          changed = true;
        }
        if (!next.lastName && user.lastName) {
          next.lastName = user.lastName;
          changed = true;
        }
        if (changed) {
          writeSellerProfile(next, userId);
          return next;
        }
        return prev;
      });
    }
  }, [user, userId, profile.firstName, profile.lastName]);

  useEffect(() => {
    writeSellerProfile(profile, userId);
  }, [profile, userId]);

  useEffect(() => {
    writeOnboardingStep(step, userId);
  }, [step, userId]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      writeSellerProfile(profile, userId);
      writeOnboardingStep(step, userId);
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [profile, step, userId]);

  const update = (key: keyof SellerProfile, value: string) => {
    setProfile((prev) => {
      const next = { ...prev, [key]: value };
      writeSellerProfile(next, userId);
      return next;
    });
  };

  const handleCountryChange = (countryName: string) => {
    const currency = countryCurrencyMap[countryName] || 'USD';
    setProfile((prev) => {
      const next = { ...prev, country: countryName, currency };
      writeSellerProfile(next, userId);
      setActiveCurrency(currency);
      return next;
    });
  };

  const changeStep = (nextStep: number) => {
    writeOnboardingStep(nextStep, userId);
    setStep(nextStep);
  };

  const finishSetup = (forceOffline = false) => {
    const finalCurrency = profile.currency || 'GHS';
    const existing = settingsQuery.data ?? emptySellerSettings;
    const finalSellerName = `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || profile.sellerName.trim() || 'Store Owner';
    const finalBusinessName = profile.businessName.trim() || 'Take Order Store';
    const finalDescription = profile.category ? `${finalBusinessName} · ${profile.category}` : `${finalBusinessName} store`;

    const updatedSettings: SellerSettings = {
      ...existing,
      sellerName: finalSellerName,
      businessName: finalBusinessName,
      description: finalDescription,
      channels: profile.channels?.length ? profile.channels : ['whatsapp', 'instagram'],
      currency: (finalCurrency as SellerSettings['currency']) || 'GHS',
      organizationPhone: profile.phone || profile.whatsappPhone || existing.organizationPhone,
    };

    const finalizedProfile: SellerProfile = {
      ...profile,
      sellerName: finalSellerName,
      businessName: finalBusinessName,
      currency: finalCurrency,
    };

    writeSellerProfile(finalizedProfile, userId);

    if (!isOnline || forceOffline) {
      writePendingSettingsSync(updatedSettings);
      queryClient.setQueryData(getGetSellerSettingsQueryKey(), updatedSettings);
      finishOnboarding(userId);
      changeStep(4);
      return;
    }

    saveOnboardingSettingsMutation.mutate({
      data: updatedSettings,
    }, {
      onSuccess: (data) => {
        clearPendingSettingsSync();
        queryClient.setQueryData(getGetSellerSettingsQueryKey(), data);
        setOnboardingSaveError('');
        finishOnboarding(userId);
        changeStep(4);
      },
      onError: (error) => {
        writePendingSettingsSync(updatedSettings);
        queryClient.setQueryData(getGetSellerSettingsQueryKey(), updatedSettings);
        setOnboardingSaveError(formatUserFacingError(error, 'Connection issue detected. Your details are saved safely on this device.'));
        setOfflineSavedNotice(true);
      },
    });
  };

  const handleStep0Continue = async () => {
    setIsSubmittingStep0(true);
    const firstName = profile.firstName?.trim() || '';
    const lastName = profile.lastName?.trim() || '';
    const fullName = `${firstName} ${lastName}`.trim();
    if (fullName) {
      update('sellerName', fullName);
    }
    if (user && (firstName || lastName)) {
      try {
        await user.update({
          firstName: firstName || undefined,
          lastName: lastName || undefined,
        });
      } catch (err) {
        console.warn('Could not sync user profile to Clerk:', err);
      }
    }
    setIsSubmittingStep0(false);
    changeStep(1);
  };

  // STEP 0: Finish signing up / User details - SPLIT LAYOUT WITH RIGHT IMAGE PANEL
  if (step === 0) {
    return (
      <AuthSplitLayout showcase={<AuthShowcaseCard />}>
        <div className="w-full">
          {/* Top back button */}
          <div className="w-full flex items-center justify-start mb-3">
            <button
              type="button"
              onClick={() => setLocation('/sign-in')}
              className="inline-flex items-center text-neutral-600 hover:text-neutral-900 transition-colors cursor-pointer"
              aria-label="Back to sign in"
            >
              <ArrowLeft size={20} />
            </button>
          </div>

          <div className="text-center mb-3.5">
            <h1 className="text-[24px] sm:text-[26px] font-bold tracking-tight text-neutral-900">
              Continue signing up
            </h1>
            <p className="mt-1 text-sm text-neutral-500">
              We need a couple more details from you
            </p>
          </div>

          {!isOnline && (
            <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-[10px] bg-amber-50 border border-amber-200 text-xs font-medium text-amber-900" role="status">
              <WifiOff size={15} className="shrink-0 text-amber-600" />
              <span>Working offline. All your entries are safely saved on this device.</span>
            </div>
          )}

          <div className="space-y-3.5">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-neutral-900 mb-1" htmlFor="onboarding-first-name">
                  First name
                </label>
                <input
                  autoFocus
                  id="onboarding-first-name"
                  data-testid="input-onboarding-first-name"
                  type="text"
                  value={profile.firstName ?? ''}
                  onChange={(e) => update('firstName', e.target.value)}
                  placeholder="Ama"
                  className="w-full h-11 px-3.5 rounded-xl border border-neutral-300 bg-white text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-900 focus:border-neutral-900 transition"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-neutral-900 mb-1" htmlFor="onboarding-last-name">
                  Last name
                </label>
                <input
                  id="onboarding-last-name"
                  data-testid="input-onboarding-last-name"
                  type="text"
                  value={profile.lastName ?? ''}
                  onChange={(e) => update('lastName', e.target.value)}
                  placeholder="Mensah"
                  className="w-full h-11 px-3.5 rounded-xl border border-neutral-300 bg-white text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-900 focus:border-neutral-900 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-neutral-900 mb-1" htmlFor="onboarding-phone">
                Mobile number
              </label>
              <div className="flex gap-2">
                <div className="w-[84px] shrink-0 h-11 rounded-xl border border-neutral-300 bg-neutral-50 flex items-center justify-center text-sm font-semibold text-neutral-700">
                  {countryDialPrefixMap[profile.country ?? 'Ghana'] || '+233'}
                </div>
                <input
                  id="onboarding-phone"
                  data-testid="input-onboarding-phone"
                  type="tel"
                  value={profile.phone ?? profile.whatsappPhone ?? ''}
                  onChange={(e) => {
                    update('phone', e.target.value);
                    update('whatsappPhone', e.target.value);
                  }}
                  placeholder="24 123 4567"
                  className="w-full h-11 px-3.5 rounded-xl border border-neutral-300 bg-white text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-900 focus:border-neutral-900 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-neutral-900 mb-1" htmlFor="onboarding-country">
                Country
              </label>
              <select
                id="onboarding-country"
                data-testid="select-onboarding-country"
                value={profile.country ?? 'Ghana'}
                onChange={(e) => handleCountryChange(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl border border-neutral-300 bg-white text-sm text-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900 focus:border-neutral-900 transition cursor-pointer"
              >
                <option value="Ghana">🇬🇭 Ghana (GHS)</option>
                <option value="Nigeria">🇳🇬 Nigeria (NGN)</option>
                <option value="Kenya">🇰🇪 Kenya (KES)</option>
                <option value="South Africa">🇿🇦 South Africa (ZAR)</option>
                <option value="United Kingdom">🇬🇧 United Kingdom (GBP)</option>
                <option value="United States">🇺🇸 United States (USD)</option>
                <option value="Canada">🇨🇦 Canada (CAD)</option>
                <option value="Other">🌐 Other (USD)</option>
              </select>
            </div>

            <div className="space-y-2.5 pt-1">
              <label className="flex items-start gap-2.5 cursor-pointer text-xs text-neutral-600 leading-normal">
                <input
                  type="checkbox"
                  checked={agreedOutreach}
                  onChange={(e) => setAgreedOutreach(e.target.checked)}
                  className="mt-0.5 h-3.5 w-3.5 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900"
                />
                <span>
                  I agree to receive outreach texts about onboarding from Take Order. Message frequency varies and message & data rates may apply. Reply STOP to unsubscribe or HELP for help.
                </span>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer text-xs text-neutral-600 leading-normal">
                <input
                  type="checkbox"
                  checked={agreedTerms}
                  onChange={(e) => setAgreedTerms(e.target.checked)}
                  className="mt-0.5 h-3.5 w-3.5 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900"
                />
                <span>
                  I agree to the{' '}
                  <Link href="/privacy" className="text-[#6366F1] underline underline-offset-2">Privacy Policy</Link>,{' '}
                  <Link href="/terms" className="text-[#6366F1] underline underline-offset-2">Terms of Service</Link> and Terms of Business.
                </span>
              </label>
            </div>

            <button
              type="button"
              onClick={handleStep0Continue}
              disabled={!(profile.firstName?.trim() && profile.lastName?.trim() && (profile.phone?.trim() || profile.whatsappPhone?.trim())) || !agreedTerms || isSubmittingStep0}
              className="w-full h-11 mt-3 rounded-full bg-[#111111] hover:bg-[#262626] text-white font-semibold text-sm transition-colors flex items-center justify-center cursor-pointer shadow-xs disabled:opacity-40 disabled:cursor-not-allowed gap-2"
              data-testid="button-onboarding-step0-continue"
            >
              {isSubmittingStep0 ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                'Continue'
              )}
            </button>
          </div>
        </div>
      </AuthSplitLayout>
    );
  }

  // STEPS 1-4: ONE FULL PAGE (NO RIGHT PANEL)
  return (
    <div className="min-h-screen w-full bg-white flex flex-col justify-between">
      {/* Top progress bar and navigation row */}
      <div className="w-full">
        {/* Multi-segment progress bar spanning the top edge */}
        <div className="w-full px-6 pt-3 pb-2 flex items-center gap-2">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={cn(
                'h-1.5 flex-1 rounded-full transition-all duration-300',
                s <= step ? 'bg-[#5B5BF0]' : 'bg-[#E5E7EB]'
              )}
            />
          ))}
        </div>

        {/* Top navigation row */}
        <div className="w-full px-6 py-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => changeStep(step - 1)}
            className="w-10 h-10 rounded-full border border-neutral-200 flex items-center justify-center hover:bg-neutral-50 transition cursor-pointer shadow-2xs"
            data-testid={step === 1 ? 'button-onboarding-step1-back' : step === 2 ? 'button-onboarding-step2-back' : 'button-onboarding-step3-back'}
            aria-label="Back"
          >
            <ArrowLeft size={18} className="text-neutral-700" />
          </button>

          {step < 3 ? (
            <button
              type="button"
              onClick={() => changeStep(step + 1)}
              disabled={step === 1 ? !profile.businessName.trim() : !profile.category}
              className="h-10 px-6 rounded-full bg-[#111111] hover:bg-[#262626] text-white font-semibold text-sm flex items-center gap-2 transition cursor-pointer shadow-xs disabled:opacity-40 disabled:cursor-not-allowed"
              data-testid={step === 1 ? 'button-onboarding-step1-continue' : 'button-onboarding-step2-continue'}
            >
              <span>Continue</span>
              <ArrowRight size={15} />
            </button>
          ) : step === 3 ? (
            <button
              type="button"
              onClick={() => finishSetup(false)}
              disabled={saveOnboardingSettingsMutation.isPending}
              className="h-10 px-6 rounded-full bg-[#111111] hover:bg-[#262626] text-white font-semibold text-sm flex items-center gap-2 transition cursor-pointer shadow-xs disabled:opacity-50"
              data-testid="button-onboarding-finish"
            >
              {saveOnboardingSettingsMutation.isPending ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  <span>Setting up…</span>
                </>
              ) : (
                <>
                  <span>Continue</span>
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          ) : null}
        </div>
      </div>

      {/* Main content area */}
      <main className="w-full max-w-[840px] mx-auto px-6 py-6 flex-1 flex flex-col justify-start">
        {!isOnline && (
          <div className="mb-6 flex items-center gap-2 px-3.5 py-2.5 rounded-[10px] bg-amber-50 border border-amber-200 text-xs font-medium text-amber-900" role="status">
            <WifiOff size={15} className="shrink-0 text-amber-600" />
            <span>Working offline. All your entries are safely saved on this device.</span>
          </div>
        )}

        {/* STEP 1: What's your business name? */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <div className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">Account setup</div>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-neutral-900">What's your business name?</h1>
              <p className="mt-2 text-sm text-neutral-500">
                This is the name your buyers will see on checkout links and receipts.
              </p>
            </div>

            <div className="pt-2">
              <input
                autoFocus
                id="onboarding-business-name"
                data-testid="input-onboarding-business-name"
                value={profile.businessName}
                onChange={(e) => update('businessName', e.target.value)}
                placeholder="e.g. The Sunday Edit or Kicks Vault"
                className="w-full h-14 px-5 rounded-2xl border border-neutral-300 bg-white text-lg text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-900 transition shadow-xs"
              />
            </div>
          </div>
        )}

        {/* STEP 2: Categories (Image 2) */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <div className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">Account setup</div>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-neutral-900">
                Select categories that best describe your business
              </h1>
              <p className="mt-2 text-sm text-neutral-500">
                Choose your primary and up to 3 related service type
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-2" role="group" aria-label="Select business category">
              {onboardingCategories.map((cat) => {
                const isSelected = profile.category === cat.label;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => update('category', cat.label)}
                    className={cn(
                      'flex flex-col items-start p-5 rounded-2xl border text-left transition-all cursor-pointer group bg-white',
                      isSelected
                        ? 'border-neutral-900 ring-2 ring-neutral-900 bg-neutral-50/60 shadow-xs'
                        : 'border-neutral-200 hover:border-neutral-400 hover:shadow-2xs'
                    )}
                  >
                    <div className={cn("mb-3 transition-colors", isSelected ? "text-neutral-900" : "text-neutral-600 group-hover:text-neutral-900")}>
                      {cat.icon}
                    </div>
                    <span className="text-sm font-semibold text-neutral-900">{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 3: Team size (Image 3) */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <div className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">Account setup</div>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-neutral-900">What's your team size?</h1>
              <p className="mt-2 text-sm text-neutral-500">This will help us set up your workspace correctly</p>
            </div>

            <div className="space-y-3 max-w-[680px] pt-2" role="group" aria-label="Select team size">
              {teamSizeOptions.map((opt) => {
                const isSelected = (profile.teamSize === opt.label) || (opt.id === 'solo' && profile.teamSize === 'Just me');
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => update('teamSize', opt.label)}
                    className={cn(
                      'w-full flex items-center justify-between p-5 rounded-2xl border text-left transition-all cursor-pointer bg-white',
                      isSelected
                        ? 'border-neutral-900 ring-2 ring-neutral-900 bg-neutral-50/60 shadow-xs'
                        : 'border-neutral-200 hover:border-neutral-400 hover:bg-neutral-50/30'
                    )}
                  >
                    <div>
                      <div className="text-base font-semibold text-neutral-900">{opt.label}</div>
                      <div className="text-xs text-neutral-500 mt-0.5">{opt.subtitle}</div>
                    </div>
                    <div className={cn(
                      'w-5 h-5 rounded-full border flex items-center justify-center transition',
                      isSelected ? 'border-neutral-900 bg-neutral-900' : 'border-neutral-300'
                    )}>
                      {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                  </button>
                );
              })}
            </div>

            {onboardingSaveError && (
              <div role="alert" className="p-3.5 rounded-[12px] bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-2 mt-4">
                <div className="flex items-center gap-1.5 font-medium">
                  <WifiOff size={14} className="shrink-0 text-amber-700" />
                  <span>{onboardingSaveError}</span>
                </div>
                {offlineSavedNotice && (
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => finishSetup(true)}
                      className="px-3 py-1.5 rounded-[8px] bg-[#111111] text-white text-xs font-semibold hover:bg-[#262626] transition-colors cursor-pointer"
                      data-testid="button-onboarding-offline-proceed"
                    >
                      Proceed to workspace
                    </button>
                    <button
                      type="button"
                      onClick={() => finishSetup(false)}
                      className="px-3 py-1.5 rounded-[8px] border border-[#E3E3EC] bg-white text-[#111827] text-xs font-semibold hover:bg-[#F9F9FC] transition-colors cursor-pointer"
                      data-testid="button-onboarding-offline-retry"
                    >
                      Retry sync
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* STEP 4: 7-Day Free Trial Paywall */}
        {step === 4 && (
          <div className="space-y-6 max-w-[600px]">
            <div>
              <div className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">Account setup</div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold mb-3">
                <Sparkles size={13} className="text-blue-600" />
                <span>7-Day Free Trial</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-neutral-900">Start your 7-day free trial</h1>
              <p className="mt-2 text-sm text-neutral-500">
                Unlock full access for <strong className="text-neutral-900">{profile.businessName || 'your business'}</strong>. No charge today.
              </p>
            </div>

            <div className="rounded-2xl border border-neutral-200 bg-neutral-50/60 p-6 space-y-3.5 text-sm text-neutral-700">
              <div className="flex items-center gap-3 text-neutral-900 font-medium">
                <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <Check size={12} strokeWidth={3} />
                </div>
                <span>Unlimited Take Order links for WhatsApp, IG & TikTok</span>
              </div>
              <div className="flex items-center gap-3 text-neutral-900 font-medium">
                <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <Check size={12} strokeWidth={3} />
                </div>
                <span>Accept Mobile Money and Card payments instantly</span>
              </div>
              <div className="flex items-center gap-3 text-neutral-900 font-medium">
                <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <Check size={12} strokeWidth={3} />
                </div>
                <span>Auto receipts, customer database & inventory tracking</span>
              </div>
              <div className="flex items-center gap-3 text-neutral-900 font-medium">
                <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <Check size={12} strokeWidth={3} />
                </div>
                <span>Real-time sales analytics and exportable reports</span>
              </div>
            </div>

            <div className="rounded-2xl border border-neutral-300 bg-white p-5 space-y-1 shadow-2xs">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-semibold text-neutral-900">Take Order Pro</span>
                <span className="text-base font-bold text-neutral-900">$19<span className="text-xs font-normal text-neutral-500">/mo</span></span>
              </div>
              <p className="text-xs text-neutral-500">
                7 days free, then $19/month. Cancel anytime in one click from settings.
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  if (userId) {
                    const trialState = {
                      tier: 'pro',
                      isPro: true,
                      isProPlus: false,
                      isTrial: true,
                      trial: {
                        active: true,
                        startedAt: new Date().toISOString(),
                        daysRemaining: 7,
                      },
                      limits: {
                        catalogLimit: { limit: null, unlimited: true },
                        activeLinkLimit: { limit: 500, unlimited: false },
                        catalogLimitReached: false,
                        activeLinkLimitReached: false,
                      },
                      usage: {
                        catalogProductCount: 0,
                        activeLinkCount: 0,
                      },
                      canAccessReports: true,
                      canExportAnalytics: true,
                    };
                    try {
                      localStorage.setItem(`duka_entitlements_${userId}`, JSON.stringify(trialState));
                      sessionStorage.setItem(`duka_entitlements_${userId}`, JSON.stringify(trialState));
                    } catch {}
                  }
                  finishOnboarding(userId);
                  setLocation('/dashboard');
                }}
                className="w-full h-12 rounded-full bg-[#111111] text-white text-sm font-semibold hover:bg-[#262626] active:scale-[0.99] transition shadow-xs cursor-pointer flex items-center justify-center gap-2"
                data-testid="button-onboarding-start-trial"
              >
                <span>Start 7-Day Free Trial</span>
                <ArrowRight size={15} />
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    finishOnboarding(userId);
                    setLocation('/dashboard');
                  }}
                  className="text-xs font-medium text-neutral-500 hover:text-neutral-900 cursor-pointer transition-colors"
                  data-testid="button-onboarding-skip-trial"
                >
                  Skip and continue with Free plan
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="w-full py-6 text-center text-xs text-neutral-400">
        Take Order • Account Setup
      </footer>
    </div>
  );
}

const stripBase = (path: string) => basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path;

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'none' as const,
  },
  variables: {
    colorPrimary: '#111111',
    colorForeground: '#111827',
    colorMutedForeground: '#6B7280',
    colorDanger: '#EF4444',
    colorBackground: '#ffffff',
    colorInput: '#ffffff',
    colorInputForeground: '#111827',
    colorNeutral: '#E5E7EB',
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
    borderRadius: '0.75rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center scrollbar-none',
    cardBox: 'w-full flex justify-center !shadow-none !border-0 !bg-transparent !p-0 scrollbar-none',
    card: '!w-full max-w-[420px] !rounded-none !border-0 !bg-transparent !p-0 !shadow-none scrollbar-none',
    headerTitle: '!text-[24px] sm:!text-[26px] !font-bold !tracking-tight !text-[#111827] !text-center',
    headerSubtitle: '!mt-1 !text-[13.5px] !text-[#6B7280] !text-center',
    socialButtonsBlockButton: '!w-full !h-11 !rounded-full !border !border-neutral-300 !bg-white hover:!bg-neutral-50 !text-neutral-900 !text-sm !font-semibold transition-all !shadow-2xs !cursor-pointer flex items-center justify-center gap-3',
    socialButtonsBlockButtonText: '!text-neutral-900 !font-semibold !text-sm',
    socialButtonsProviderIcon: '!h-4.5 !w-4.5',
    dividerRow: '!my-3.5 !flex !items-center !justify-center',
    dividerLine: '!border-neutral-200',
    dividerText: '!text-neutral-400 !text-xs !font-semibold !uppercase !tracking-wider !bg-white !px-3',
    formFieldLabel: '!text-sm !font-semibold !text-neutral-900 !mb-1.5',
    formFieldInput: '!w-full !h-11 !rounded-xl !border !border-neutral-300 !bg-white !text-sm !text-neutral-900 placeholder:!text-neutral-400 focus:!border-neutral-900 focus:!ring-1 focus:!ring-neutral-900 transition-all',
    formFieldRow__firstName: '!hidden',
    formFieldRow__lastName: '!hidden',
    formFieldRow__first_name: '!hidden',
    formFieldRow__last_name: '!hidden',
    formField__firstName: '!hidden',
    formField__lastName: '!hidden',
    formField__first_name: '!hidden',
    formField__last_name: '!hidden',
    formButtonPrimary: '!w-full !h-11 !rounded-full !bg-[#111111] hover:!bg-[#262626] !text-white !text-sm !font-semibold transition-all !shadow-xs !cursor-pointer flex items-center justify-center !mt-3 active:scale-[0.99]',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none !mt-4 !pt-3 !border-t !border-neutral-200 text-center',
    footerAction: '!text-sm !text-neutral-500',
    footerActionText: '!text-sm !text-neutral-500',
    footerActionLink: '!font-semibold !text-neutral-900 hover:!underline !text-sm',
    footerPages: 'hidden',
    identityPreview: '!rounded-xl !border !border-neutral-200 !p-3.5 !bg-neutral-50',
    identityPreviewText: '!text-sm !font-medium !text-neutral-900',
    identityPreviewEditButton: '!text-xs !text-[#6366F1] hover:underline',
    otpCodeFieldInput: '!h-11 !rounded-xl !border !border-neutral-300 !bg-neutral-50 !text-lg !font-mono text-center focus:!border-neutral-900 focus:!bg-white',
    formFieldAction: '!text-xs !text-neutral-500 hover:!text-neutral-900 !font-medium',
    logoBox: 'hidden',
    logoImage: 'hidden',
    internal: 'hidden',
  },
};

function FallbackSignInForm() {
  const draft = readDraftAuth();
  const [email, setEmail] = useState(() => draft.signInEmail || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [, setLocation] = useLocation();

  const handleMobileAuth = () => {
    const derivedUserId = `seller_mobile_${Date.now()}`;
    localStorage.setItem('duka-test-auth', 'true');
    localStorage.setItem('duka-test-user-id', derivedUserId);
    if (typeof window !== 'undefined') {
      (window as any).__DUKA_TEST_USER_ID__ = derivedUserId;
    }
    setActiveSellerUserId(derivedUserId);
    queryClient.clear();
    setLocation('/onboarding');
  };

  const handleGoogleAuth = () => {
    const derivedUserId = `seller_google_${Date.now()}`;
    localStorage.setItem('duka-test-auth', 'true');
    localStorage.setItem('duka-test-user-id', derivedUserId);
    if (typeof window !== 'undefined') {
      (window as any).__DUKA_TEST_USER_ID__ = derivedUserId;
    }
    setActiveSellerUserId(derivedUserId);
    queryClient.clear();
    setLocation('/onboarding');
  };

  const handleAppleAuth = () => {
    const derivedUserId = `seller_apple_${Date.now()}`;
    localStorage.setItem('duka-test-auth', 'true');
    localStorage.setItem('duka-test-user-id', derivedUserId);
    if (typeof window !== 'undefined') {
      (window as any).__DUKA_TEST_USER_ID__ = derivedUserId;
    }
    setActiveSellerUserId(derivedUserId);
    queryClient.clear();
    setLocation('/onboarding');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }
    clearDraftAuth(['signInEmail']);
    const cleanEmail = email.trim().toLowerCase();
    const emailHash = cleanEmail.replace(/[^a-z0-9]/g, '_');
    const derivedUserId = `seller_${emailHash}`;
    localStorage.setItem('duka-test-auth', 'true');
    localStorage.setItem('duka-test-user-id', derivedUserId);
    if (typeof window !== 'undefined') {
      (window as any).__DUKA_TEST_USER_ID__ = derivedUserId;
    }
    setActiveSellerUserId(derivedUserId);
    queryClient.clear();
    const existing = readSellerProfile(derivedUserId);
    const completed = readOnboardingComplete(derivedUserId);
    if (completed && existing.businessName?.trim()) {
      setLocation('/dashboard');
    } else {
      setLocation('/onboarding');
    }
  };

  return (
    <div className="w-full">
      {/* Top back button */}
      <div className="w-full flex items-center justify-start mb-3">
        <Link
          href="/"
          className="inline-flex items-center text-neutral-600 hover:text-neutral-900 transition-colors cursor-pointer"
          aria-label="Back to home"
        >
          <ArrowLeft size={20} />
        </Link>
      </div>

      <div className="text-center mb-3.5">
        <h1 className="text-[24px] sm:text-[26px] font-bold tracking-tight text-neutral-900">
          Take Order for sellers
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Create an account or log in to manage your business
        </p>
      </div>

      {error && (
        <div className="mb-3 p-2 rounded-[10px] bg-rose-50 border border-rose-200 text-xs text-rose-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3.5">
        <div>
          <label className="block text-sm font-semibold text-neutral-900 mb-1" htmlFor="signin-email-fallback">
            Email
          </label>
          <div className="relative flex items-center">
            <input
              id="signin-email-fallback"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                writeDraftAuth({ signInEmail: e.target.value });
                setError('');
              }}
              placeholder="Your email"
              autoComplete="email"
              className="w-full h-11 px-3.5 rounded-xl border border-neutral-300 bg-white text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-900 focus:border-neutral-900 transition"
            />
          </div>
          <p className="text-xs text-neutral-500 mt-1">
            We'll send you a verification code.
          </p>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-semibold text-neutral-900" htmlFor="signin-password-fallback">
              Password
            </label>
            <button
              type="button"
              onClick={() => alert('Password reset instructions will be sent to your registered email.')}
              className="text-xs text-neutral-500 hover:text-neutral-900 font-medium transition cursor-pointer"
            >
              Forgot password?
            </button>
          </div>
          <div className="relative flex items-center">
            <input
              id="signin-password-fallback"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              autoComplete="current-password"
              className="w-full h-11 pl-3.5 pr-10 rounded-xl border border-neutral-300 bg-white text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-900 focus:border-neutral-900 transition"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 text-neutral-400 hover:text-neutral-700 p-1 cursor-pointer transition"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          className="w-full h-11 mt-1 rounded-full bg-[#111111] hover:bg-[#262626] text-white font-semibold text-sm transition-colors flex items-center justify-center cursor-pointer shadow-xs active:scale-[0.99]"
          data-testid="button-auth-signin"
        >
          Continue
        </button>
      </form>

      {/* OR Divider */}
      <div className="relative my-3.5 flex items-center justify-center">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-neutral-200" />
        </div>
        <span className="relative bg-white px-3 text-xs font-semibold text-neutral-400 uppercase tracking-wider">
          OR
        </span>
      </div>

      {/* 3 Pill buttons */}
      <div className="space-y-2.5">
        <button
          type="button"
          onClick={handleMobileAuth}
          className="w-full h-11 rounded-full border border-neutral-300 hover:bg-neutral-50 text-neutral-900 font-semibold text-sm flex items-center justify-center gap-3 transition cursor-pointer relative shadow-2xs"
        >
          <Smartphone size={17} className="text-neutral-700 absolute left-5" />
          <span>Continue with mobile</span>
        </button>

        <button
          type="button"
          onClick={handleGoogleAuth}
          className="w-full h-11 rounded-full border border-neutral-300 hover:bg-neutral-50 text-neutral-900 font-semibold text-sm flex items-center justify-center gap-3 transition cursor-pointer relative shadow-2xs"
        >
          <GoogleIcon className="h-4.5 w-4.5 absolute left-5" />
          <span>Continue with Google</span>
        </button>

        <button
          type="button"
          onClick={handleAppleAuth}
          className="w-full h-11 rounded-full border border-neutral-300 hover:bg-neutral-50 text-neutral-900 font-semibold text-sm flex items-center justify-center gap-3 transition cursor-pointer relative shadow-2xs"
        >
          <AppleIcon className="h-4.5 w-4.5 text-neutral-900 absolute left-5" />
          <span>Continue with Apple</span>
        </button>
      </div>

      {/* Buyer tracking prompt */}
      <div className="mt-3.5 text-center">
        <p className="text-xs font-semibold text-neutral-900">Are you a customer looking to track an order?</p>
        <Link href="/track" className="text-xs font-semibold text-[#6366F1] hover:underline mt-0.5 inline-block">
          Go to Take Order for buyers
        </Link>
      </div>

      {/* Switch to sign-up */}
      <div className="mt-2.5 text-center text-xs text-neutral-500">
        Don't have an account?{' '}
        <Link href="/sign-up" className="font-semibold text-neutral-900 hover:underline" data-testid="link-auth-sign-up">
          Sign up
        </Link>
      </div>

      {/* reCAPTCHA footer */}
      <div className="mt-3 text-center text-[10.5px] text-neutral-400 leading-relaxed">
        <p>This site is protected by reCAPTCHA</p>
        <p>Google Privacy Policy and Terms of Service apply</p>
      </div>
    </div>
  );
}

function FallbackSignUpForm() {
  const draft = readDraftAuth();
  const [businessName, setBusinessName] = useState(() => draft.signUpFullName || '');
  const [email, setEmail] = useState(() => draft.signUpEmail || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [, setLocation] = useLocation();

  const handleMobileAuth = () => {
    const newUserId = `seller_mobile_${Date.now()}`;
    localStorage.setItem('duka-test-auth', 'true');
    localStorage.setItem('duka-test-user-id', newUserId);
    if (typeof window !== 'undefined') {
      (window as any).__DUKA_TEST_USER_ID__ = newUserId;
    }
    setActiveSellerUserId(newUserId);
    queryClient.clear();
    writeOnboardingStep(0, newUserId);
    setLocation('/onboarding');
  };

  const handleGoogleAuth = () => {
    const newUserId = `seller_google_${Date.now()}`;
    localStorage.setItem('duka-test-auth', 'true');
    localStorage.setItem('duka-test-user-id', newUserId);
    if (typeof window !== 'undefined') {
      (window as any).__DUKA_TEST_USER_ID__ = newUserId;
    }
    setActiveSellerUserId(newUserId);
    queryClient.clear();
    writeOnboardingStep(0, newUserId);
    setLocation('/onboarding');
  };

  const handleAppleAuth = () => {
    const newUserId = `seller_apple_${Date.now()}`;
    localStorage.setItem('duka-test-auth', 'true');
    localStorage.setItem('duka-test-user-id', newUserId);
    if (typeof window !== 'undefined') {
      (window as any).__DUKA_TEST_USER_ID__ = newUserId;
    }
    setActiveSellerUserId(newUserId);
    queryClient.clear();
    writeOnboardingStep(0, newUserId);
    setLocation('/onboarding');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }
    clearDraftAuth(['signUpFullName', 'signUpEmail']);
    const cleanEmail = email.trim().toLowerCase();
    const emailHash = cleanEmail.replace(/[^a-z0-9]/g, '_');
    const newUserId = `seller_${emailHash}_${Date.now()}`;
    localStorage.setItem('duka-test-auth', 'true');
    localStorage.setItem('duka-test-user-id', newUserId);
    if (typeof window !== 'undefined') {
      (window as any).__DUKA_TEST_USER_ID__ = newUserId;
    }
    setActiveSellerUserId(newUserId);
    queryClient.clear();

    const cleanBiz = businessName.trim() || 'My Online Store';
    const freshProfile: SellerProfile = {
      ...defaultSellerProfile,
      businessName: cleanBiz,
      sellerName: cleanBiz,
    };
    writeSellerProfile(freshProfile, newUserId);
    writeOnboardingStep(0, newUserId);
    setLocation('/onboarding');
  };

  return (
    <div className="w-full">
      {/* Top back button */}
      <div className="w-full flex items-center justify-start mb-3">
        <Link
          href="/"
          className="inline-flex items-center text-neutral-600 hover:text-neutral-900 transition-colors cursor-pointer"
          aria-label="Back to home"
        >
          <ArrowLeft size={20} />
        </Link>
      </div>

      <div className="text-center mb-3.5">
        <h1 className="text-[24px] sm:text-[26px] font-bold tracking-tight text-neutral-900">
          Take Order for sellers
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Create an account or log in to manage your business
        </p>
      </div>

      {error && (
        <div className="mb-3 p-2 rounded-[10px] bg-rose-50 border border-rose-200 text-xs text-rose-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3.5">
        <div>
          <label className="block text-sm font-semibold text-neutral-900 mb-1" htmlFor="signup-email-fallback">
            Email
          </label>
          <div className="relative flex items-center">
            <input
              id="signup-email-fallback"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                writeDraftAuth({ signUpEmail: e.target.value });
                setError('');
              }}
              placeholder="Your email"
              autoComplete="email"
              className="w-full h-11 px-3.5 rounded-xl border border-neutral-300 bg-white text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-900 focus:border-neutral-900 transition"
            />
          </div>
          <p className="text-xs text-neutral-500 mt-1">
            We'll send you a verification code.
          </p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-neutral-900 mb-1" htmlFor="signup-password-fallback">
            Password
          </label>
          <div className="relative flex items-center">
            <input
              id="signup-password-fallback"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              autoComplete="new-password"
              className="w-full h-11 pl-3.5 pr-10 rounded-xl border border-neutral-300 bg-white text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-900 focus:border-neutral-900 transition"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 text-neutral-400 hover:text-neutral-700 p-1 cursor-pointer transition"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          className="w-full h-11 mt-1 rounded-full bg-[#111111] hover:bg-[#262626] text-white font-semibold text-sm transition-colors flex items-center justify-center cursor-pointer shadow-xs active:scale-[0.99]"
          data-testid="button-auth-signup"
        >
          Continue
        </button>
      </form>

      {/* OR Divider */}
      <div className="relative my-3.5 flex items-center justify-center">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-neutral-200" />
        </div>
        <span className="relative bg-white px-3 text-xs font-semibold text-neutral-400 uppercase tracking-wider">
          OR
        </span>
      </div>

      {/* 3 Pill buttons */}
      <div className="space-y-2.5">
        <button
          type="button"
          onClick={handleMobileAuth}
          className="w-full h-11 rounded-full border border-neutral-300 hover:bg-neutral-50 text-neutral-900 font-semibold text-sm flex items-center justify-center gap-3 transition cursor-pointer relative shadow-2xs"
        >
          <Smartphone size={17} className="text-neutral-700 absolute left-5" />
          <span>Continue with mobile</span>
        </button>

        <button
          type="button"
          onClick={handleGoogleAuth}
          className="w-full h-11 rounded-full border border-neutral-300 hover:bg-neutral-50 text-neutral-900 font-semibold text-sm flex items-center justify-center gap-3 transition cursor-pointer relative shadow-2xs"
        >
          <GoogleIcon className="h-4.5 w-4.5 absolute left-5" />
          <span>Continue with Google</span>
        </button>

        <button
          type="button"
          onClick={handleAppleAuth}
          className="w-full h-11 rounded-full border border-neutral-300 hover:bg-neutral-50 text-neutral-900 font-semibold text-sm flex items-center justify-center gap-3 transition cursor-pointer relative shadow-2xs"
        >
          <AppleIcon className="h-4.5 w-4.5 text-neutral-900 absolute left-5" />
          <span>Continue with Apple</span>
        </button>
      </div>

      {/* Buyer tracking link */}
      <div className="mt-3.5 text-center">
        <p className="text-xs font-semibold text-neutral-900">Are you a customer looking to track an order?</p>
        <Link href="/track" className="text-xs font-semibold text-[#6366F1] hover:underline mt-0.5 inline-block">
          Go to Take Order for buyers
        </Link>
      </div>

      {/* Switch between sign-up and sign-in */}
      <div className="mt-2.5 text-center text-xs text-neutral-500">
        Already have an account?{' '}
        <Link href="/sign-in" className="font-semibold text-neutral-900 hover:underline" data-testid="link-auth-sign-in">
          Log in
        </Link>
      </div>

      {/* reCAPTCHA footer */}
      <div className="mt-3 text-center text-[10.5px] text-neutral-400 leading-relaxed">
        <p>This site is protected by reCAPTCHA</p>
        <p>Google Privacy Policy and Terms of Service apply</p>
      </div>
    </div>
  );
}

function SignInPage() {
  const [, setLocation] = useLocation();
  const { authState, isLoaded, isSignedIn } = useAppAuth();
  const isTestAuth = typeof window !== 'undefined' && (Boolean((window as any).__DUKA_TEST_AUTH__) || localStorage.getItem('duka-test-auth') === 'true');
  const effectiveSignedIn = isSignedIn || isTestAuth;
  const target = getSafeRedirectUrl(typeof window !== 'undefined' ? window.location.search : '', '/dashboard');

  useEffect(() => {
    if (isLoaded && effectiveSignedIn && authState !== 'loading') {
      setLocation(target);
    }
  }, [isLoaded, effectiveSignedIn, authState, setLocation, target]);

  return (
    <AuthSplitLayout>
      {clerkPubKey ? (
        <div className="w-full flex flex-col items-center">
          <SignIn
            routing="path"
            path={`${basePath}/sign-in`}
            signUpUrl={`${basePath}/sign-up`}
            fallbackRedirectUrl={target}
            forceRedirectUrl={target}
            appearance={clerkAppearance}
          />
        </div>
      ) : (
        <FallbackSignInForm />
      )}
    </AuthSplitLayout>
  );
}

function SignUpPage() {
  const [, setLocation] = useLocation();
  const { authState, isLoaded, isSignedIn } = useAppAuth();
  const isTestAuth = typeof window !== 'undefined' && (Boolean((window as any).__DUKA_TEST_AUTH__) || localStorage.getItem('duka-test-auth') === 'true');
  const effectiveSignedIn = isSignedIn || isTestAuth;
  const target = getSafeRedirectUrl(typeof window !== 'undefined' ? window.location.search : '', '/onboarding');

  useEffect(() => {
    if (isLoaded && effectiveSignedIn && authState !== 'loading') {
      setLocation(target);
    }
  }, [isLoaded, effectiveSignedIn, authState, setLocation, target]);

  useEffect(() => {
    const cleanInputs = () => {
      const inputs = document.querySelectorAll<HTMLInputElement>(
        '.cl-signUp-root input[name="firstName"], .cl-signUp-root input[name="lastName"], .cl-signUp-root input[name="first_name"], .cl-signUp-root input[name="last_name"]'
      );
      inputs.forEach((input) => {
        if (input.hasAttribute('required')) {
          input.removeAttribute('required');
        }
        if (!input.value) {
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
          nativeInputValueSetter?.call(input, 'Store');
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });
    };
    const interval = setInterval(cleanInputs, 200);
    return () => clearInterval(interval);
  }, []);

  return (
    <AuthSplitLayout>
      {clerkPubKey ? (
        <div className="w-full flex flex-col items-center">
          <SignUp
            routing="path"
            path={`${basePath}/sign-up`}
            signInUrl={`${basePath}/sign-in`}
            fallbackRedirectUrl={target}
            forceRedirectUrl={target}
            appearance={clerkAppearance}
          />
        </div>
      ) : (
        <FallbackSignUpForm />
      )}
    </AuthSplitLayout>
  );
}

function SellerRoute({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const { authState, isLoaded, isSignedIn, userId } = useAppAuth();
  const isTestAuth = typeof window !== 'undefined' && (Boolean((window as any).__DUKA_TEST_AUTH__) || localStorage.getItem('duka-test-auth') === 'true');
  const effectiveSignedIn = isSignedIn || isTestAuth;
  const settingsQuery = useGetSellerSettings({
    query: {
      enabled: Boolean(clerkPubKey && isLoaded && effectiveSignedIn),
      queryKey: getGetSellerSettingsQueryKey(),
    },
  });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const syncPending = async () => {
      if (typeof window === 'undefined' || !navigator.onLine) return;
      const pending = readPendingSettingsSync();
      if (!pending) return;
      try {
        await customFetch('/api/settings', {
          method: 'PUT',
          body: JSON.stringify(pending),
        });
        clearPendingSettingsSync();
        queryClient.invalidateQueries({ queryKey: getGetSellerSettingsQueryKey() });
      } catch {
        // Will retry on next online event
      }
    };

    syncPending();
    window.addEventListener('online', syncPending);
    return () => window.removeEventListener('online', syncPending);
  }, []);

  useEffect(() => {
    // 1. While auth is loading or resolving session, DO NOT REDIRECT
    if (!isTestAuth && (authState === 'loading' || !isLoaded)) {
      return;
    }

    // 2. Only redirect once definitively resolved to unauthenticated
    if (!effectiveSignedIn || authState === 'signed_out') {
      const redirectParam = location && location !== '/' && !location.startsWith('/sign-in') && !location.startsWith('/sign-up')
        ? `?redirect=${encodeURIComponent(location)}`
        : '';
      setLocation(`/sign-in${redirectParam}`);
      return;
    }

    // 3. Do not redirect while seller profile query is resolving on initial load or refresh
    if (clerkPubKey && (settingsQuery.isLoading || settingsQuery.isPending) && !settingsQuery.data) {
      return;
    }

    const completed = readOnboardingComplete(userId);
    const localProfile = readSellerProfile(userId);
    const hasBusinessProfile = Boolean(settingsQuery.data?.businessName?.trim() || localProfile?.businessName?.trim());

    if (hasBusinessProfile && !completed) {
      finishOnboarding(userId);
    }

    // Only redirect to /onboarding if query succeeded and user definitely has no business setup
    if (settingsQuery.isSuccess && !completed && !hasBusinessProfile) {
      setLocation('/onboarding');
      return;
    }
    setReady(true);
  }, [authState, isLoaded, effectiveSignedIn, isTestAuth, userId, settingsQuery.isLoading, settingsQuery.isPending, settingsQuery.isSuccess, settingsQuery.data?.businessName, setLocation, location]);

  setActiveCurrency(settingsQuery.data?.currency ?? 'GHS');

  if (!clerkPubKey && !isTestAuth) {
    const redirectParam = location && location !== '/' ? `?redirect=${encodeURIComponent(location)}` : '';
    return <Redirect to={`/sign-in${redirectParam}`} />;
  }

  // Render stable loading skeleton while restoring session or fetching initial seller settings
  if ((authState === 'loading' || !isLoaded || !effectiveSignedIn || !ready) && !isTestAuth) {
    // If definitively unauthenticated, perform safe redirect
    if (authState === 'signed_out') {
      const redirectParam = location && location !== '/' ? `?redirect=${encodeURIComponent(location)}` : '';
      return <Redirect to={`/sign-in${redirectParam}`} />;
    }
    return (
      <div className="onboarding-shell flex min-h-[100dvh] items-center justify-center p-6">
        <div className="w-full max-w-[320px]">
          <Skeleton className="mx-auto h-10 w-10 rounded-[14px]" />
          <Skeleton className="mx-auto mt-6 h-8 w-48" />
          <Skeleton className="mx-auto mt-3 h-3 w-60" />
        </div>
      </div>
    );
  }
  return <>{children}</>;
}

function ProtectedRoute({ page: Page }: { page: React.ComponentType }) {
  return <SellerRoute><Page /></SellerRoute>;
}

function HomeRoute() {
  return <LandingPage />;
}

function OnboardingRoute() {
  const { authState, isLoaded, isSignedIn, userId } = useAppAuth();
  const isTestAuth = typeof window !== 'undefined' && (Boolean((window as any).__DUKA_TEST_AUTH__) || localStorage.getItem('duka-test-auth') === 'true');
  const effectiveSignedIn = isSignedIn || isTestAuth;
  const [, setLocation] = useLocation();
  const settingsQuery = useGetSellerSettings({
    query: {
      enabled: Boolean(clerkPubKey && isLoaded && effectiveSignedIn),
      queryKey: getGetSellerSettingsQueryKey(),
    },
  });

  useEffect(() => {
    if (!isTestAuth && (authState === 'loading' || !isLoaded)) return;
    if (!effectiveSignedIn || authState === 'signed_out') {
      setLocation('/sign-in?redirect=/onboarding');
      return;
    }
    if (clerkPubKey && (settingsQuery.isLoading || settingsQuery.isPending) && !settingsQuery.data) return;
    const completed = readOnboardingComplete(userId);
    const localProfile = readSellerProfile(userId);
    const hasBusinessProfile = Boolean(settingsQuery.data?.businessName?.trim() || localProfile?.businessName?.trim());
    if (completed || hasBusinessProfile) {
      if (hasBusinessProfile && !completed) {
        finishOnboarding(userId);
      }
      setLocation('/dashboard');
    }
  }, [authState, isLoaded, effectiveSignedIn, isTestAuth, userId, settingsQuery.isLoading, settingsQuery.isPending, settingsQuery.data?.businessName, setLocation]);

  if (!isTestAuth && (authState === 'loading' || !isLoaded)) {
    return (
      <div className="onboarding-shell flex min-h-[100dvh] items-center justify-center p-6">
        <div className="w-full max-w-[320px]">
          <Skeleton className="mx-auto h-10 w-10 rounded-[14px]" />
          <Skeleton className="mx-auto mt-6 h-8 w-48" />
          <Skeleton className="mx-auto mt-3 h-3 w-60" />
        </div>
      </div>
    );
  }
  if (!effectiveSignedIn || authState === 'signed_out') return <Redirect to="/sign-in?redirect=/onboarding" />;
  return <Onboarding />;
}

function FirstRunChecklist({
  productCount,
  orderCount,
  onDismiss,
}: {
  productCount: number;
  orderCount: number;
  onDismiss: () => void;
}) {
  const seller = readSellerProfile();
  return (
    <Card className="p-6 sm:p-8 bg-gradient-to-b from-white to-slate-50/60 border border-slate-200/90 shadow-sm rounded-2xl mb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200/60 text-amber-800 text-[11px] font-bold uppercase tracking-wider mb-2">
            <Sparkles size={12} className="text-amber-600" />
            <span>Getting Started Checklist</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Welcome to Take Order, {seller.businessName || 'Seller'}!
          </h2>
          <p className="text-sm text-slate-600 mt-1 max-w-xl">
            Complete these two quick steps to take your first order and start tracking sales in real time.
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="text-xs text-slate-400 hover:text-slate-700 underline self-start sm:self-center transition-colors"
        >
          Skip checklist
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3 mt-6">
        {/* Step 1 */}
        <div className={cn(
          'p-5 rounded-xl border transition-all flex flex-col justify-between',
          productCount > 0 ? 'bg-emerald-50/40 border-emerald-200/80' : 'bg-white border-slate-200 shadow-2xs'
        )}>
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className={cn(
                'inline-flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold',
                productCount > 0 ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-white'
              )}>
                {productCount > 0 ? <Check size={14} strokeWidth={2.5} /> : '1'}
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Step 1</span>
            </div>
            <h3 className="font-bold text-slate-900 text-base">Add your first product</h3>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              Add your merchandise with prices, buyer variants, and stock counts.
            </p>
          </div>
          <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
            {productCount > 0 ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                <Check size={13} strokeWidth={2.5} />
                <span>Product added</span>
              </span>
            ) : (
              <Link href="/catalog/new" className="w-full">
                <Button variant="primary" className="w-full text-xs h-9">
                  <Plus size={14} />
                  <span>Add product</span>
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* Step 2 */}
        <div className={cn(
          'p-5 rounded-xl border transition-all flex flex-col justify-between',
          orderCount > 0 ? 'bg-emerald-50/40 border-emerald-200/80' : 'bg-white border-slate-200 shadow-2xs'
        )}>
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className={cn(
                'inline-flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold',
                orderCount > 0 ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'
              )}>
                {orderCount > 0 ? <Check size={14} strokeWidth={2.5} /> : '2'}
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Step 2</span>
            </div>
            <h3 className="font-bold text-slate-900 text-base">Create your first link</h3>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              Generate a secure buyer checkout link to share on WhatsApp, Instagram, or TikTok.
            </p>
          </div>
          <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
            {orderCount > 0 ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                <Check size={13} strokeWidth={2.5} />
                <span>Link created</span>
              </span>
            ) : (
              <Link href="/take-order" className="w-full">
                <Button variant={productCount > 0 ? 'primary' : 'outline'} className="w-full text-xs h-9">
                  <Link2 size={14} />
                  <span>Take an order</span>
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* Step 3 */}
        <div className="p-5 rounded-xl border border-slate-200/80 bg-slate-50/50 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-200 text-slate-600 text-xs font-bold">
                3
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Step 3</span>
            </div>
            <h3 className="font-bold text-slate-900 text-base">Explore live dashboard</h3>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              Cash flow charts, conversion rates, and client ledgers update as orders arrive.
            </p>
          </div>
          <div className="mt-5 pt-3 border-t border-slate-100">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400">
              <Clock3 size={13} />
              <span>Unlocks with first order</span>
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}

export function Overview() {
  const { userId } = useAppAuth();
  const entitlements = useEntitlements(userId);
  const { isPro, isProPlus, isTrial, tier } = entitlements;
  const [isExporting, setIsExporting] = useState(false);
  const [upgradeDialogReason, setUpgradeDialogReason] = useState<UpgradeReason | null>(null);

  const handleExportCsv = async () => {
    if (!entitlements.canExportAnalytics) {
      setUpgradeDialogReason('analytics_export');
      return;
    }
    setIsExporting(true);
    try {
      const blob = await customFetch<Blob>('/api/dashboard/export', { responseType: 'blob' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `take-order-export-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      if (err?.status === 403) {
        setUpgradeDialogReason('analytics_export');
        return;
      }
      console.error('Failed to export CSV:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const today = inputDate(new Date());
  const [savedDashboardPeriod] = useState<DashboardPeriodPreference | null>(() => readDashboardPeriodPreference());
  const [period, setPeriod] = useState<DashboardPeriod>(() => savedDashboardPeriod?.period ?? 'week');
  const [draftPeriod, setDraftPeriod] = useState<DashboardPeriod>(() => savedDashboardPeriod?.period ?? 'week');
  const [periodMenuOpen, setPeriodMenuOpen] = useState(false);
  const periodMenuRef = useRef<HTMLDivElement>(null);
  const periodTriggerRef = useRef<HTMLButtonElement>(null);
  const periodMenuWasOpen = useRef(false);
  const [connectedTools, setConnectedTools] = useState<string[]>(readConnectedTools);
  const [onboardingDismissed, setOnboardingDismissed] = useState(() => readChecklistDismissed(userId));
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
  const settingsQuery = useGetSellerSettings();
  const summary = summaryQuery.data;
  const daily = summary?.dailyPerformance ?? [];
  const products = productsQuery.data ?? [];
  const orders = ordersQuery.data ?? [];
  const isDataLoading = productsQuery.isLoading || ordersQuery.isLoading || (summaryQuery.isLoading && !summaryQuery.data);
  const isNewSeller = !isDataLoading && products.length === 0 && orders.length === 0;
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
    if (earlier === 0) return recent > 0 ? { direction: 'up', percentage: null, tone: 'positive' } : undefined;
    const percentage = Math.round(((recent - earlier) / earlier) * 100);
    return { direction: percentage >= 0 && recent > 0 ? 'up' : 'down', percentage: Math.abs(percentage), tone: percentage >= 0 ? 'positive' : 'negative' };
  };
  const salesTrend = movement('orders');
  const revenueTrend = movement('revenue');
  const primaryStatCards: DashboardStatCard[] = [
    { label: 'Sales', value: ordersQuery.isLoading ? '—' : periodOrders.length, trend: salesTrend, note: periodOrders.length > 0 ? `${paidConversion}% paid conversion · ${waitingPayments} waiting payments` : 'No orders in this period' },
    { label: 'Revenue', value: money(summary?.revenue ?? 0), trend: revenueTrend, note: 'Money received from recorded orders' },
    { label: 'Outstanding balances', value: money(summary?.outstanding ?? 0), note: waitingPayments > 0 ? `${waitingPayments} waiting payments` : 'All customer balances cleared' },
    { label: 'Orders', value: summary?.orders ?? 0, trend: movement('orders'), note: shippedOrders > 0 ? `${shippedOrders} shipped` : 'Track fulfillment as orders arrive' },
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
  return (
    <Shell>
      <div data-testid="dashboard-analytics" data-analytics-state={analyticsState}>
        <AnalyticsStateMarker state={analyticsState} />

        {/* ── Page Header (Page title + Period filter + Take an order on the same line) ────── */}
        <PageHeader
          title="Dashboard"
          primaryAction={
            <Link
              href="/take-order"
              data-testid="button-dashboard-take-order"
              className="inline-flex items-center gap-1.5 h-9 px-3 sm:px-4 rounded-[8px] bg-[hsl(var(--primary))] text-[12.5px] sm:text-[13px] font-semibold text-white hover:opacity-90 transition whitespace-nowrap shadow-xs cursor-pointer shrink-0"
            >
              <Plus size={14} strokeWidth={2.5} />
              <span className="hidden sm:inline">Take an order</span>
              <span className="sm:hidden">Order</span>
            </Link>
          }
          secondaryActions={
            <div className="relative shrink-0" ref={periodMenuRef}>
              <button
                ref={periodTriggerRef}
                type="button"
                className="inline-flex items-center gap-1.5 sm:gap-2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-2.5 sm:px-3.5 py-1.5 text-[12px] sm:text-[12.5px] font-semibold text-[hsl(var(--foreground))] shadow-2xs hover:bg-[hsl(var(--muted))] transition cursor-pointer shrink-0"
                aria-label="Reporting period"
                aria-expanded={periodMenuOpen}
                onClick={() => {
                  setDraftPeriod(period);
                  setPeriodMenuOpen((open) => !open);
                }}
                data-testid="button-dashboard-period"
              >
                <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                <span className="hidden sm:inline max-w-[140px] truncate">{periodLabel}</span>
                <span className="sm:hidden">{period === 'day' ? 'Today' : period === 'week' ? '7d' : period === 'month' ? '30d' : period === 'year' ? '1y' : periodLabel}</span>
                <ChevronDown
                  size={13}
                  className={cn('transition-transform text-[hsl(var(--muted-foreground))] shrink-0', periodMenuOpen && 'rotate-180')}
                />
              </button>
              {periodMenuOpen && (
                <div
                  className="absolute right-0 top-full mt-2 z-50 min-w-[200px] rounded-2xl border border-[hsl(var(--border))] bg-white p-2 shadow-xl dark:bg-neutral-950"
                  role="dialog"
                  aria-label="Choose reporting period"
                >
                  {draftPeriod !== 'custom' ? (
                    <div className="space-y-1">
                      {dashboardPeriodOptions.map((option) => (
                        <button
                          type="button"
                          key={option.value}
                          className={cn(
                            'w-full flex items-center justify-between rounded-xl px-3 py-2 text-xs font-medium text-left transition cursor-pointer',
                            period === option.value
                              ? 'bg-[hsl(var(--foreground))] text-[hsl(var(--background))] font-semibold'
                              : 'text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]'
                          )}
                          onClick={() => {
                            setPeriod(option.value);
                            setDraftPeriod(option.value);
                            setPeriodMenuOpen(false);
                          }}
                          aria-pressed={draftPeriod === option.value}
                        >
                          <span>{option.label}</span>
                          {period === option.value && <Check size={13} />}
                        </button>
                      ))}
                      <button
                        type="button"
                        className="w-full flex items-center justify-between rounded-xl px-3 py-2 text-xs font-medium text-left text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition cursor-pointer"
                        onClick={chooseCustomPeriod}
                        data-testid="button-dashboard-period-custom"
                      >
                        <span>Custom date range…</span>
                      </button>
                    </div>
                  ) : (
                    <DashboardCustomRangePicker
                      from={draftCustomRange.from}
                      to={draftCustomRange.to}
                      onFromChange={(from) => setDraftCustomRange((current) => ({ ...current, from }))}
                      onToChange={(to) => setDraftCustomRange((current) => ({ ...current, to }))}
                      onClose={closePeriodMenu}
                      onApply={applyCustomPeriod}
                      canApply={Boolean(draftPeriodRange)}
                    />
                  )}
                </div>
              )}
            </div>
          }
        />

        {/* Pro+ Executive Intelligence Row (only when seller has orders) */}
        {!isNewSeller && isProPlus && (
          <section className="mb-6 grid gap-4 sm:grid-cols-3" aria-label="Executive Intelligence" data-testid="executive-intelligence-row">
            <Card className="p-4 bg-gradient-to-br from-slate-900 to-slate-800 text-white border-0 shadow-md">
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span className="font-semibold uppercase tracking-wider text-[10px]">Average Order Value</span>
                <Sparkles size={13} className="text-amber-400" />
              </div>
              <div className="mt-2 text-xl font-bold tracking-tight">
                {money(summary?.orders ? (summary.revenue / summary.orders) : 0)}
              </div>
              <p className="mt-1 text-[11px] text-slate-400">
                Net margin health: {summary?.revenue ? Math.round(((summary.profit) / summary.revenue) * 100) : 0}%
              </p>
            </Card>
            <Card className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="font-semibold uppercase tracking-wider text-[10px]">Settlement Velocity</span>
                <CheckCircle2 size={13} className="text-emerald-500" />
              </div>
              <div className="mt-2 text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                {summary?.orders ? Math.round(((summary.orders - waitingPayments) / Math.max(1, summary.orders)) * 100) : 100}%
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                {waitingPayments === 0 ? 'All orders settled in full' : `${waitingPayments} awaiting completion`}
              </p>
            </Card>
            <Card className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="font-semibold uppercase tracking-wider text-[10px]">Top Channel Conversion</span>
                <ArrowUpRight size={13} className="text-amber-500" />
              </div>
              <div className="mt-2 text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                {summary?.channelPerformance?.[0] ? `${channelName(summary.channelPerformance[0].channel)} (${summary.channelPerformance[0].conversionRate}%)` : 'WhatsApp (Direct)'}
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                Highest revenue conversion channel
              </p>
            </Card>
          </section>
        )}

        {/* Clean Empty State Pattern: If new seller, show only the onboarding guide/empty state */}
        {isDataLoading ? (
          <OverviewSkeleton />
        ) : isNewSeller ? (
          !onboardingDismissed ? (
            <EmptyStateOnboardingCard
              businessName={settingsQuery.data?.businessName || readSellerProfile(userId).businessName}
              productCount={products.length}
              orderCount={orders.length}
              onDismiss={() => {
                setOnboardingDismissed(true);
                writeChecklistDismissed(true, userId);
              }}
            />
          ) : (
            <EmptyState
              card
              icon={Store}
              title="Your store is ready"
              description="Create your first catalog item or generate a Take Order link to start seeing sales, revenue, and customer activity here."
              action={
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <Link href="/take-order" data-testid="link-dashboard-empty-order">
                    <Button><Plus size={15} />Take an order</Button>
                  </Link>
                  <Link href="/catalog/new" data-testid="link-dashboard-empty-product">
                    <Button variant="outline"><Package size={15} className="mr-1.5" />Add product</Button>
                  </Link>
                </div>
              }
            />
          )
        ) : (
          <>
            {(productsQuery.isError || ordersQuery.isError) && (
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-[hsl(var(--destructive))]/20 bg-[hsl(var(--destructive))]/5 px-4 py-3 text-xs text-[hsl(var(--destructive))]" role="alert" data-testid="status-dashboard-auxiliary-error">
                <span>Some dashboard lists could not be refreshed, so related counts may be incomplete.</span>
                <div className="flex gap-3">
                  {productsQuery.isError && <button type="button" className="font-bold underline" onClick={() => productsQuery.refetch()}>Retry catalog</button>}
                  {ordersQuery.isError && <button type="button" className="font-bold underline" onClick={() => ordersQuery.refetch()}>Retry orders</button>}
                </div>
              </div>
            )}
            {summaryQuery.isError && !summaryQuery.data ? (
              <ErrorState retry={() => summaryQuery.refetch()} />
            ) : (
              <>
                {/* ── Snapshot period label ─────────────────────── */}
                <div className="flex justify-end mb-4">
                  <span className="text-[12.5px] text-[hsl(var(--muted-foreground))]">{periodLabel}</span>
                </div>

                {/* ── 3 SaaS stat cards ─────────────────────────────────────── */}
                <div className="grid gap-5 sm:grid-cols-3">
                  <StatCard
                    label="Total Sales"
                    value={money(summary?.revenue ?? 0)}
                    description="Total revenue collected from settled orders in this period"
                  />
                  <StatCard
                    label="Total Orders"
                    value={ordersQuery.isLoading ? '—' : periodOrders.length}
                    description="Number of orders placed in this period"
                  />
                  <StatCard
                    label="Outstanding Balance"
                    value={money(summary?.outstanding ?? 0)}
                    description="Uncollected balances from unpaid and deposit orders"
                    suffix={summary?.outstanding && summary.outstanding > 0 ? `${waitingPayments} unpaid` : undefined}
                  />
                </div>

                {/* Recent Updates Interactive Group Card with Filter Routing */}
                <RecentUpdatesTabs
                  orders={orders}
                  products={products}
                  outstanding={summary?.outstanding ?? 0}
                  loading={summaryRefreshing}
                />

                {/* Full-width Recent Transactions section */}
                <div className="mt-8">
                  <RecentTransactions />
                </div>
              </>
            )}
          </>
        )}
        <ContextualUpgradeDialog
          open={Boolean(upgradeDialogReason)}
          onOpenChange={(open) => !open && setUpgradeDialogReason(null)}
          reason={upgradeDialogReason || 'analytics_export'}
          tier={tier}
        />
      </div>
    </Shell>
  );
}

function OverviewSkeleton() {
  return <div className="space-y-8 sm:space-y-10" aria-label="Loading overview"><div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">{[1, 2, 3, 4].map((i) => <Card key={i} className="h-[176px] p-6 sm:p-7 flex flex-col justify-between"><Skeleton className="h-4 w-20" /><Skeleton className="h-10 w-32" /><Skeleton className="h-4 w-36" /></Card>)}</div><div className="grid gap-6 sm:gap-8 xl:grid-cols-[1.7fr_.8fr]"><Card className="h-[390px] p-6"><Skeleton className="h-4 w-36" /><Skeleton className="mt-3 h-3 w-52" /><Skeleton className="mt-8 h-[260px] w-full" /></Card><Card className="h-[390px] p-6"><Skeleton className="h-4 w-28" /><Skeleton className="mt-6 h-16 w-full" /><Skeleton className="mt-3 h-16 w-full" /><Skeleton className="mt-3 h-16 w-full" /></Card></div></div>;
}

function Reports() {
  const { userId } = useAppAuth();
  const entitlements = useEntitlements(userId);
  const isFree = !entitlements.isLoading && entitlements.tier === 'free';
  const [period, setPeriod] = useState<DashboardPeriod>('month');
  const [customRange, setCustomRange] = useState<DashboardDateRange>({ from: '', to: '' });
  const [periodMenuOpen, setPeriodMenuOpen] = useState(false);
  const [exported, setExported] = useState(false);
  const periodRange = useMemo(() => dashboardPeriodRange(period, customRange.from, customRange.to), [period, customRange]);
  const periodLabel = dashboardPeriodLabel(period, customRange.from, customRange.to);

  const summaryQuery = useGetDashboardSummary(periodRange, {
    query: {
      queryKey: getGetDashboardSummaryQueryKey(periodRange ?? undefined),
      enabled: !isFree,
    },
  });
  const productsQuery = useListProducts();
  const ordersQuery = useListOrders();

  const summary = summaryQuery.data;
  const products = productsQuery.data ?? [];
  const allOrders = ordersQuery.data ?? [];

  const periodOrders = useMemo(() => periodRange ? allOrders.filter((order) => {
    const date = new Date(order.createdAt).toISOString().slice(0, 10);
    return date >= periodRange.from && date <= periodRange.to;
  }) : allOrders, [allOrders, periodRange]);

  // Catalog Stats (centralized from Catalog page)
  const totalStockUnits = products.reduce((total, p) => total + (p.stock || 0), 0);
  const inventoryValue = products.reduce((total, p) => total + (p.stock || 0) * (p.cost ?? p.price ?? 0), 0);
  const lowStockCount = products.filter((p) => p.stock <= 3).length;
  const categoriesCount = new Set(products.map((p) => p.category?.trim()).filter(Boolean)).size;

  // Order Stats (centralized from Orders page)
  const totalOrderValue = periodOrders.reduce((sum, o) => sum + o.amount, 0);
  const paidOrders = periodOrders.filter((o) => o.status === 'paid');
  const paidRevenue = paidOrders.reduce((sum, o) => sum + o.amount, 0);
  const orderCount = periodOrders.length;
  const avgOrderValue = orderCount > 0 ? (totalOrderValue / orderCount) : 0;
  const collectionRate = totalOrderValue > 0 ? (paidRevenue / totalOrderValue) * 100 : 0;
  const paidConversionRate = orderCount > 0 ? Math.round((paidOrders.length / orderCount) * 100) : 0;

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
  const palette = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899', '#6366f1'];

  const handleExportAnnualReport = () => {
    const headers = ['Report Period', 'Gross Sales', 'COGS', 'Operating Expenses', 'Net Profit', 'Total Orders', 'Paid Orders', 'Catalog Inventory Value', 'Active Products'];
    const row = [
      sanitizeCsvCell(periodLabel),
      sanitizeCsvCell((summary?.revenue ?? 0).toFixed(2)),
      sanitizeCsvCell((summary?.productCosts ?? 0).toFixed(2)),
      sanitizeCsvCell((summary?.operatingExpenses ?? 0).toFixed(2)),
      sanitizeCsvCell((summary?.profit ?? 0).toFixed(2)),
      sanitizeCsvCell(orderCount),
      sanitizeCsvCell(paidOrders.length),
      sanitizeCsvCell(inventoryValue.toFixed(2)),
      sanitizeCsvCell(products.length)
    ];
    const csvContent = '\uFEFF' + [headers.join(','), row.join(',')].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `takeorder-business-report-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setExported(true);
    setTimeout(() => setExported(false), 3000);
  };

  return (
    <Shell>
      {!isFree && (
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-6">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Financial Intelligence</div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-950 tracking-tight">Analytics & Business Report</h1>
            <p className="mt-1 text-sm text-slate-500 max-w-xl">
              Complete performance overview across orders, product inventory, margins, and revenue.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Timeframe Selector Pill */}
            <div className="relative">
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-full border border-slate-200/90 bg-white px-4 py-2 text-xs font-semibold text-slate-800 shadow-2xs hover:bg-slate-50 transition cursor-pointer"
                onClick={() => setPeriodMenuOpen((v) => !v)}
              >
                <CalendarDays size={14} className="text-slate-500" />
                <span>{periodLabel}</span>
                <ChevronDown size={14} className={cn('transition-transform text-slate-400', periodMenuOpen && 'rotate-180')} />
              </button>
              {periodMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-48 rounded-2xl border border-slate-200/90 bg-white p-1.5 shadow-xl z-20">
                  {dashboardPeriodOptions.map((opt) => (
                    <button
                      type="button"
                      key={opt.value}
                      onClick={() => {
                        setPeriod(opt.value);
                        setPeriodMenuOpen(false);
                      }}
                      className={cn(
                        'w-full rounded-xl px-3 py-2 text-left text-xs font-semibold transition',
                        period === opt.value ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setPeriod('custom');
                      setPeriodMenuOpen(false);
                    }}
                    className={cn(
                      'w-full rounded-xl px-3 py-2 text-left text-xs font-semibold transition',
                      period === 'custom' ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
                    )}
                  >
                    Custom timeframe
                  </button>
                </div>
              )}
            </div>

            {/* Export Full Annual/Period Report Button */}
            <Button
              type="button"
              variant="outline"
              onClick={handleExportAnnualReport}
              className="rounded-full h-9 px-4 text-xs font-semibold gap-1.5 shadow-2xs"
            >
              {exported ? <Check size={13} className="text-emerald-500" /> : <Download size={13} />}
              <span>{exported ? 'Report Downloaded' : 'Export Full Report'}</span>
            </Button>
          </div>
        </div>
      )}

      {isFree ? (
        <ProUpgradeFeatureCard
          pageTitle="Analytics"
          title="Track your complete business growth"
          description="Access annual reports, product margins, catalog valuation, and channel analytics with Take Order Pro."
          learnMoreHref="/subscribe"
          previewLabel="Total views"
          previewValue="130"
        />
      ) : summaryQuery.isLoading ? (
        <ReportsSkeleton />
      ) : summaryQuery.isError ? (
        <ErrorState retry={() => summaryQuery.refetch()} />
      ) : (
        <div className="space-y-10">
          {/* Section 1: Orders Snapshot (Relocated from Orders Page) */}
          <section aria-labelledby="analytics-orders-title" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-blue-600">Order Performance</div>
                <h2 id="analytics-orders-title" className="text-lg font-bold text-slate-950">Orders & Fulfillment Summary</h2>
              </div>
              <Link href="/orders" className="text-xs font-semibold text-slate-600 hover:text-slate-950 inline-flex items-center gap-1">
                View orders <ArrowUpRight size={13} />
              </Link>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label="Total Orders"
                value={orderCount}
                icon={<ShoppingBag size={17} className="text-blue-700" />}
                iconBg="bg-blue-100 text-blue-700"
                sparklineTone="blue"
              />
              <StatCard
                label="Paid in Full"
                value={`${paidConversionRate}%`}
                icon={<CheckCircle2 size={17} className="text-emerald-700" />}
                iconBg="bg-emerald-100 text-emerald-700"
                sparklineTone="emerald"
              />
              <StatCard
                label="Average Order Value"
                value={money(avgOrderValue)}
                icon={<Percent size={17} className="text-purple-700" />}
                iconBg="bg-purple-100 text-purple-700"
                sparklineTone="purple"
              />
              <StatCard
                label="Collection Rate"
                value={`${collectionRate.toFixed(1)}%`}
                icon={<CircleDollarSign size={17} className="text-amber-700" />}
                iconBg="bg-amber-100 text-amber-700"
                sparklineTone="amber"
              />
            </div>
          </section>

          {/* Section 2: Catalog Snapshot (Relocated from Catalog Page) */}
          <section aria-labelledby="analytics-catalog-title" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-purple-600">Catalog Performance</div>
                <h2 id="analytics-catalog-title" className="text-lg font-bold text-slate-950">Inventory & Catalog Valuation</h2>
              </div>
              <Link href="/catalog" className="text-xs font-semibold text-slate-600 hover:text-slate-950 inline-flex items-center gap-1">
                Manage catalog <ArrowUpRight size={13} />
              </Link>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label="Catalog Value"
                value={money(inventoryValue)}
                icon={<Boxes size={17} className="text-purple-700" />}
                iconBg="bg-purple-100 text-purple-700"
                sparklineTone="purple"
              />
              <StatCard
                label="Active Products"
                value={products.length}
                icon={<Package size={17} className="text-blue-700" />}
                iconBg="bg-blue-100 text-blue-700"
                sparklineTone="blue"
              />
              <StatCard
                label="Total Units in Stock"
                value={totalStockUnits}
                icon={<PackageSearch size={17} className="text-emerald-700" />}
                iconBg="bg-emerald-100 text-emerald-700"
                sparklineTone="emerald"
              />
              <StatCard
                label="Low-Stock Alerts"
                value={lowStockCount}
                icon={<AlertTriangle size={17} className="text-amber-700" />}
                iconBg="bg-amber-100 text-amber-700"
                sparklineTone="amber"
              />
            </div>
          </section>

          {/* Section 3: Financial & Profit Breakdown (Full Business / Annual Report View) */}
          <section aria-labelledby="analytics-report-title" className="space-y-4">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">Executive Report</div>
              <h2 id="analytics-report-title" className="text-lg font-bold text-slate-950">Net Profit & Operating Statement</h2>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-xs">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="text-xl font-bold text-slate-950">Statement of Revenue & Net Profit</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Net take-home profit after subtracting inventory product costs (COGS) and shop operating expenses.
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
                    {moneyExact(summary?.profit ?? 0)}
                  </div>
                  <div className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                    <span>{summary?.revenue ? Math.round(((summary.profit) / summary.revenue) * 100) : 0}% Net margin</span>
                  </div>
                </div>
              </div>

              {/* Progress bar visualizing COGS, Expenses, Profit */}
              <div className="mt-6 h-3.5 w-full rounded-full bg-slate-100 flex overflow-hidden p-0.5 gap-0.5">
                <div
                  className="bg-rose-400 rounded-l-full transition-all"
                  style={{ width: `${summary?.revenue ? Math.min(100, Math.round(((summary.productCosts ?? 0) / summary.revenue) * 100)) : 0}%` }}
                  title={`Product costs: ${moneyExact(summary?.productCosts ?? 0)}`}
                />
                <div
                  className="bg-indigo-400 transition-all"
                  style={{ width: `${summary?.revenue ? Math.min(100, Math.round(((summary.operatingExpenses ?? 0) / summary.revenue) * 100)) : 0}%` }}
                  title={`Operating expenses: ${moneyExact(summary?.operatingExpenses ?? 0)}`}
                />
                <div
                  className="bg-emerald-500 rounded-r-full transition-all"
                  style={{ width: `${summary?.revenue && summary.profit > 0 ? Math.min(100, Math.round((summary.profit / summary.revenue) * 100)) : 0}%` }}
                  title={`Net take-home profit: ${moneyExact(summary?.profit ?? 0)}`}
                />
              </div>

              <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-100">
                  <span className="text-slate-500 block">Gross Sales</span>
                  <strong className="text-base font-bold text-slate-950 mt-1 block">{moneyExact(summary?.revenue ?? 0)}</strong>
                </div>
                <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-100">
                  <span className="flex items-center gap-1.5 text-slate-500">
                    <span className="h-2 w-2 rounded-full bg-rose-400" /> COGS (Product Costs)
                  </span>
                  <strong className="text-base font-bold text-slate-950 mt-1 block">{moneyExact(summary?.productCosts ?? 0)}</strong>
                </div>
                <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-100">
                  <span className="flex items-center gap-1.5 text-slate-500">
                    <span className="h-2 w-2 rounded-full bg-indigo-400" /> Shop Expenses
                  </span>
                  <strong className="text-base font-bold text-slate-950 mt-1 block">{moneyExact(summary?.operatingExpenses ?? 0)}</strong>
                </div>
                <div className="rounded-xl bg-emerald-50/80 p-3.5 border border-emerald-200/60">
                  <span className="flex items-center gap-1.5 text-emerald-800 font-semibold">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" /> Net Take-Home
                  </span>
                  <strong className="text-base font-bold text-emerald-700 mt-1 block">{moneyExact(summary?.profit ?? 0)}</strong>
                </div>
              </div>
            </div>
          </section>

          {/* Section 4: Visual Breakdown (Donut Chart & Top Items) */}
          <section className="grid gap-8 lg:grid-cols-12 items-start">
            <div className="lg:col-span-5 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs overflow-hidden">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Revenue Distribution</div>
                  <h3 className="text-base font-bold text-slate-950 mt-0.5">Category Breakdown</h3>
                </div>
                <BarChart3 size={18} className="text-slate-400" />
              </div>
              <div className="h-[260px] mt-4">
                {categoryData.length && totalCategoryRevenue > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="47%" innerRadius="54%" outerRadius="73%" paddingAngle={2} stroke="#ffffff" strokeWidth={3} isAnimationActive={false}>
                        {categoryData.map((item, index) => <Cell key={item.name} fill={palette[index % palette.length]} />)}
                      </Pie>
                      <RechartsTooltip formatter={(value: number) => moneyExact(value)} contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', background: '#ffffff', fontSize: 12 }} isAnimationActive={false} />
                      <RechartsLegend verticalAlign="bottom" height={30} iconType="circle" wrapperStyle={{ fontSize: 11, color: '#64748b' }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <ChartEmpty message="Category revenue will appear after your first recorded sale." />
                )}
              </div>
            </div>

            <div className="lg:col-span-7 rounded-[12px] border border-[#E3E3EC] bg-white dark:border-neutral-800 dark:bg-neutral-900 shadow-none overflow-hidden">
              <div className="flex items-center justify-between p-5 border-b border-[#E3E3EC] dark:border-neutral-800">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Leaderboard</div>
                  <h3 className="text-base font-bold text-slate-950 dark:text-neutral-100 mt-0.5">Top-Selling Products</h3>
                </div>
                <Package size={18} className="text-slate-400" />
              </div>
              {rankedProducts.length ? (
                <div className="overflow-x-auto w-full scrollbar-thin">
                  <table className="list-table w-full min-w-[500px] text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#E3E3EC] bg-[#F0F0F8] dark:border-neutral-800 dark:bg-neutral-800/80 h-[48px]">
                        <th className="px-4 py-3 text-[14px] font-semibold text-[#111827] dark:text-neutral-100 normal-case">Item</th>
                        <th className="px-4 py-3 text-[14px] font-semibold text-[#111827] dark:text-neutral-100 normal-case text-right">Orders</th>
                        <th className="px-4 py-3 text-[14px] font-semibold text-[#111827] dark:text-neutral-100 normal-case text-right">Revenue</th>
                        <th className="px-4 py-3 text-[14px] font-semibold text-[#111827] dark:text-neutral-100 normal-case text-right">Margin</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E8E8EE] dark:divide-neutral-800/80">
                      {rankedProducts.map((item, index) => (
                        <tr key={`${item.name}-${index}`} className="hover:bg-[#F9F9FC] dark:hover:bg-neutral-800/40 transition-colors h-[56px]">
                          <td className="px-4 py-3.5 text-[14px] font-medium text-[#111827] dark:text-neutral-100 whitespace-nowrap truncate" title={item.name}>{item.name}</td>
                          <td className="px-4 py-3.5 text-right font-mono-ui text-[14px] text-[#6B7280] dark:text-neutral-400 whitespace-nowrap">{item.orders}</td>
                          <td className="px-4 py-3.5 text-right font-mono-ui text-[14px] font-semibold text-[#111827] dark:text-neutral-100 whitespace-nowrap">{money(item.revenue)}</td>
                          <td className="px-4 py-3.5 text-right whitespace-nowrap">
                            <span className="inline-flex items-center justify-center font-medium font-mono-ui text-[12px] h-6 px-2.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60 whitespace-nowrap">
                              {item.margin.toFixed(0)}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-12 px-6 text-center text-[#6B7280] dark:text-neutral-400">
                  <p className="text-[14px] font-medium text-[#111827] dark:text-neutral-200">No product sales recorded</p>
                  <p className="text-[13px] mt-1 text-[#6B7280] dark:text-neutral-400">No sales recorded for this period.</p>
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </Shell>
  );
}

function ReportsSkeleton() {
  return <div className="space-y-8 sm:space-y-10" aria-label="Loading reports"><div className="reports-metric-grid"><Card className="h-[176px] p-6 sm:p-7 flex flex-col justify-between"><Skeleton className="h-4 w-24" /><Skeleton className="h-10 w-40" /><Skeleton className="h-4 w-56" /></Card><Card className="h-[176px] p-6 sm:p-7 flex flex-col justify-between"><Skeleton className="h-4 w-24" /><Skeleton className="h-10 w-40" /><Skeleton className="h-4 w-56" /></Card><Card className="h-[176px] p-6 sm:p-7 flex flex-col justify-between"><Skeleton className="h-4 w-28" /><Skeleton className="h-10 w-40" /><Skeleton className="h-4 w-40" /></Card></div><Card className="h-[180px] p-6"><Skeleton className="h-4 w-40" /><Skeleton className="mt-4 h-6 w-full" /><Skeleton className="mt-6 h-12 w-full" /></Card><div className="grid gap-6 sm:gap-8 xl:grid-cols-[.88fr_1.12fr]"><Card className="h-[465px] p-6"><Skeleton className="h-4 w-36" /><Skeleton className="mt-3 h-3 w-52" /><Skeleton className="mx-auto mt-10 h-56 w-56 rounded-full" /></Card><Card className="h-[465px] p-6"><Skeleton className="h-4 w-44" /><Skeleton className="mt-3 h-3 w-64" /><Skeleton className="mt-9 h-10 w-full" /><Skeleton className="mt-4 h-14 w-full" /><Skeleton className="mt-3 h-14 w-full" /><Skeleton className="mt-3 h-14 w-full" /></Card></div></div>;
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

function AlertsRail({ outstanding, lowStock, missingCosts, productLoading, productCount, orderCount, unfulfilledCount = 0, loading = false, orders = [] }: { outstanding: number; lowStock: Product[]; missingCosts: Product[]; productLoading: boolean; productCount: number; orderCount: number; unfulfilledCount?: number; loading?: boolean; orders?: Order[] }) {
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

  const recentOrderAlerts = orders.slice(0, 2).map((order) => ({
    id: `order-${order.id}`,
    icon: ShoppingBag,
    tone: 'mint' as const,
    title: `Order from ${order.customerName || 'Buyer'}`,
    detail: `${order.productName} · ${moneyExact(order.amount)} via ${channelName(order.channel)}`,
    href: `/orders/${order.id}`,
    action: 'View order details',
  }));

  const alerts = [
    ...recentOrderAlerts,
    ...(unfulfilledCount > 0 ? [{ id: 'fulfillment', icon: Truck, tone: 'mint' as const, title: `${unfulfilledCount} ${unfulfilledCount === 1 ? 'order' : 'orders'} to dispatch`, detail: 'Pack and ship pending orders to keep your buyers updated.', href: '/orders', action: 'Review orders' }] : []),
    { id: 'rose', icon: Receipt, tone: 'rose' as const, title: outstanding > 0 ? `${money(outstanding)} outstanding` : 'No outstanding balances', detail: outstanding > 0 ? 'Follow up on unpaid buyer balances before they go cold.' : 'Your orders are all accounted for.', href: '/orders', action: outstanding > 0 ? 'Review orders' : 'Open orders' },
    { id: 'gold', icon: PackageSearch, tone: 'gold' as const, title: productLoading ? 'Checking stock levels' : `${lowStock.length} low-stock ${lowStock.length === 1 ? 'item' : 'items'}`, detail: lowStock.length ? lowStock.slice(0, 2).map((item) => item.name).join(' · ') : 'Nothing needs a restock right now.', href: '/catalog', action: 'Review catalog' },
    { id: 'blue', icon: CircleDollarSign, tone: 'blue' as const, title: productLoading ? 'Checking cost prices' : `${missingCosts.length} missing cost ${missingCosts.length === 1 ? 'price' : 'prices'}`, detail: missingCosts.length ? 'Add costs to keep margin reporting honest.' : 'All catalog costs are tracked.', href: '/catalog', action: 'Add costs' },
  ];
  const additionalAlerts = [
    { id: 'share', icon: Link2, tone: 'mint' as const, title: orderCount ? 'Share your order link' : 'Share your first order link', detail: orderCount ? 'Keep your link visible wherever buyers find you.' : 'Send it to buyers to start collecting orders.', href: '/take-order', action: 'Open order link' },
    { id: 'catalog', icon: Package, tone: 'gold' as const, title: productCount ? 'Review your catalog' : 'Add your first product', detail: productCount ? 'Keep product details, prices, and stock ready for buyers.' : 'Add an item so you can start building order links.', href: '/catalog', action: productCount ? 'Open catalog' : 'Add product' },
    { id: 'reports', icon: BarChart3, tone: 'blue' as const, title: 'Review performance', detail: 'See what is selling and where buyers are coming from.', href: '/reports', action: 'Open analytics' },
    { id: 'connect', icon: Settings2, tone: 'gold' as const, title: 'Tune your tools', detail: 'Update the channels and payment tools you use.', href: '/connect', action: 'Review tools' },
  ];
  const visibleAlerts = expanded ? [...alerts, ...additionalAlerts] : alerts;
  return <>
    {expanded && <button type="button" className="alerts-backdrop" aria-label="Close action center" onClick={() => setExpanded(false)} />}
    <div className={cn('rounded-2xl border border-slate-200/80 bg-white shadow-xs overflow-hidden transition-all', expanded && 'is-expanded')}>
      <div className="border-b border-slate-100 dark:border-slate-800 px-5 py-5 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-700">
              <Bell size={13} />
            </span>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Activity Center</div>
          </div>
          <button
            type="button"
            className="alerts-expand-button text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
            aria-expanded={expanded}
            aria-controls="dashboard-action-list"
            onClick={() => setExpanded((value) => !value)}
            data-testid="button-toggle-dashboard-actions"
          >
            {expanded ? 'Close' : 'Show all'}{expanded ? <X size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
        <h3 className="type-h3 mt-2 text-lg font-bold text-slate-950">Recent updates</h3>
      </div>
      <div id="dashboard-action-list" className={cn('alerts-list divide-y divide-slate-100 dark:divide-slate-800', expanded && 'is-expanded')}>
        {loading ? (
          <div className="space-y-4 p-5 sm:p-6">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          visibleAlerts.map((alert) => (
            <Link
              href={alert.href}
              key={alert.id}
              className="alert-row group flex gap-3.5 px-5 py-4 sm:px-6 hover:bg-slate-50/80 transition-colors"
              data-testid={`link-alert-${alert.id}`}
            >
              <div className={cn(
                'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-2xs',
                alert.tone === 'rose' && 'bg-rose-50 text-rose-600 border border-rose-100',
                alert.tone === 'gold' && 'bg-amber-50 text-amber-600 border border-amber-100',
                alert.tone === 'blue' && 'bg-blue-50 text-blue-600 border border-blue-100',
                alert.tone === 'mint' && 'bg-emerald-50 text-emerald-600 border border-emerald-100'
              )}>
                <alert.icon size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-semibold text-slate-900">{alert.title}</div>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{alert.detail}</p>
                <div className="mt-1.5 text-xs font-semibold text-slate-900 group-hover:underline inline-flex items-center gap-1">
                  {alert.action}
                  <ArrowUpRight size={13} />
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  </>;
}

function ProductPerformance({ products, loading = false }: { products: Array<{ name: string; category: string; revenue: number; orders: number; stock: number; margin: number; costTracked: boolean; marginStatus: 'tracked' | 'estimated' | 'unavailable'; snapshotOrders: number; legacyOrders: number }>; loading?: boolean }) {
  const ranked = [...products].sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  return <section className="overview-stat-section overview-product-card" aria-labelledby="product-performance-title">
    <div className="overview-card-title">
      <div className="type-eyebrow">Product performance</div>
      <h3 className="type-h3 mt-2" id="product-performance-title">Best-selling items</h3>
    </div>
    {loading ? <div className="mt-5"><DashboardRowsSkeleton /></div> : ranked.length ? <div className="overview-card-table" role="table" aria-label="Best-selling items">
      <div className="overview-card-table-head" role="row"><span role="columnheader">Item</span><span role="columnheader">Orders</span><span className="text-right" role="columnheader">Revenue</span></div>
      {ranked.map((product, index) => <div key={product.name} className="overview-card-table-row product-performance-row" data-testid={`row-product-performance-${index}`} role="row">
        <span className="min-w-0 truncate font-medium" role="cell">{product.name}</span>
         <span className="overview-product-orders data-value text-sm font-medium" role="cell"><span>{number(product.orders)}</span><span className={cn('overview-product-signal', product.orders > 0 ? 'overview-product-signal-up' : 'overview-product-signal-down')} aria-label={product.orders > 0 ? 'Sales activity up' : 'No sales activity'} title={product.orders > 0 ? 'Sales activity up' : 'No sales activity'}>{product.orders > 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}</span></span>
         <span className="data-value text-right text-sm font-semibold" role="cell">{money(product.revenue)}</span>
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
  const { userId } = useAppAuth();
  const { isPro } = useEntitlement(userId);
  const { openPaywall } = usePaywall();
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
    {!isPro ? (
      <ProUpgradeFeatureCard
        pageTitle="Channel conversion"
        title="Track channel conversion"
        description="Discover which social channels (WhatsApp, Instagram, TikTok) drive actual paying customers. Compare attention and conversion."
        learnMoreHref="/account/billing"
        previewLabel="Total views"
        previewValue={number(totalViews) || '130'}
        onUpgrade={openPaywall}
      />
    ) : (
      <>
        <PageHeading title="Channel conversion" action={<Link href="/dashboard"><Button variant="outline"><ArrowLeft size={15} />Back to dashboard</Button></Link>} />
    {summaryQuery.isLoading ? <div className="space-y-8 sm:space-y-10" aria-label="Loading channel conversion"><div className="reports-metric-grid">{[1, 2, 3, 4].map((item) => <Card key={item} className="h-[176px] p-6 sm:p-7 flex flex-col justify-between"><Skeleton className="h-4 w-24" /><Skeleton className="h-10 w-28" /><Skeleton className="h-4 w-36" /></Card>)}</div><Card className="space-y-4 p-6"><Skeleton className="h-5 w-44" /><Skeleton className="h-14 w-full" /><Skeleton className="h-14 w-full" /><Skeleton className="h-14 w-full" /></Card></div> : summaryQuery.isError ? <ErrorState retry={() => summaryQuery.refetch()} /> : <div className="channel-insight-page space-y-8 sm:space-y-10">
       <ChannelConversionRefreshStatus refreshing={summaryRefreshing} />
      <section className="reports-metric-grid" aria-label="Channel conversion summary">
        <MetricCard dataTestId="card-channel-insight-views" label="Total views" value={number(totalViews)} note="Recorded link views" />
        <MetricCard dataTestId="card-channel-insight-sales" label="Paid sales" value={number(totalSales)} indicator={{ direction: totalSales > 0 ? 'up' : 'down', percentage: totalViews ? (totalSales / totalViews) * 100 : 0 }} note="Completed sales from channels" />
        <MetricCard dataTestId="card-channel-insight-revenue" label="Revenue" value={money(totalRevenue)} note="Recorded channel revenue" />
        <MetricCard dataTestId="card-channel-insight-conversion" label="Overall conversion" value={`${totalConversion.toFixed(1)}%`} indicator={{ direction: totalConversion > 0 ? 'up' : 'down', percentage: totalConversion }} note="Paid sales divided by views" />
      </section>
      <Card className="channel-insight-card" data-testid="card-channel-conversion-detail">
        <div className="channel-insight-heading">
          <div><div className="type-eyebrow">Channel breakdown</div><h3 className="type-h3 mt-2">Where views become sales</h3><p className="mt-1 type-body text-[hsl(var(--muted-foreground))]">Compare attention, paid sales, and revenue for {selectedChannelLabel}.</p></div>
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
      </>
    )}
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
  return <div className="mt-8 sm:mt-10 space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><div className="type-eyebrow">Latest activity</div><h3 className="type-h3 mt-1 text-lg font-bold">Recent transactions</h3></div>
      <Link href="/orders" data-testid="link-see-all-orders"><Button variant="ghost">See all <ArrowUpRight size={15} /></Button></Link>
    </div>
    <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="relative w-full sm:max-w-[320px]">
        <input
          type="search"
          aria-label="Search recent transactions"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search transactions..."
          className="w-full h-[40px] min-h-[40px] pl-3.5 pr-10 rounded-[10px] border border-[#E3E3EC] bg-white text-[13.5px] text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/20 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder:text-neutral-500 transition shadow-2xs"
        />
        {search ? (
          <button
            type="button"
            onClick={() => setSearch('')}
            aria-label="Clear search"
            className="absolute right-8 top-1/2 -translate-y-1/2 p-1 text-[#9CA3AF] hover:text-[#111827] dark:hover:text-white transition cursor-pointer"
          >
            <X size={14} />
          </button>
        ) : null}
        <Search
          size={15}
          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none"
        />
      </div>
      <SegmentedControl
        ariaLabel="Recent transaction filters"
        value={filter}
        onChange={(val) => setFilter(val)}
        options={filterOptions}
        size="default"
      />
    </div>
    <Card className="recent-transactions-card overflow-hidden rounded-[12px] border border-[#E3E3EC] bg-white dark:border-neutral-800 dark:bg-neutral-900 shadow-none">
      {query.isLoading ? (
        <RecentTransactionsSkeleton />
      ) : query.isError ? (
        <div className="p-6"><ErrorState retry={() => query.refetch()} /></div>
      ) : orders.length ? (
        <div className="overflow-x-auto w-full scrollbar-thin">
          <table className="list-table w-full min-w-[780px] text-left border-collapse">
            <thead>
              <tr className="border-b border-[#E3E3EC] bg-[#F0F0F8] dark:border-neutral-800 dark:bg-neutral-800/80 h-[48px]">
                <th className="px-4 py-3 text-[14px] font-semibold text-[#111827] dark:text-neutral-100 normal-case whitespace-nowrap">Order ID</th>
                <th className="px-4 py-3 text-[14px] font-semibold text-[#111827] dark:text-neutral-100 normal-case whitespace-nowrap">Customer</th>
                <th className="px-4 py-3 text-[14px] font-semibold text-[#111827] dark:text-neutral-100 normal-case text-center whitespace-nowrap">Traffic</th>
                <th className="px-4 py-3 text-[14px] font-semibold text-[#111827] dark:text-neutral-100 normal-case whitespace-nowrap">Order value</th>
                <th className="px-4 py-3 text-[14px] font-semibold text-[#111827] dark:text-neutral-100 normal-case whitespace-nowrap">Payment</th>
                <th className="px-4 py-3 text-[14px] font-semibold text-[#111827] dark:text-neutral-100 normal-case text-right whitespace-nowrap">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8E8EE] dark:divide-neutral-800/80">
              {orders.map((order) => {
                const isAwaiting = !order.customerPhone && (!order.customerName || order.customerName.toLowerCase() === 'waiting for buyer' || order.customerName.toLowerCase() === 'buyer pending');
                return (
                  <tr key={order.id} className="transaction-row hover:bg-[#F9F9FC] dark:hover:bg-neutral-800/40 transition-colors h-[56px]" data-testid={`row-transaction-${order.id}`}>
                    <td className="px-4 py-3.5 whitespace-nowrap" data-testid={`text-transaction-order-id-${order.id}`}>
                      <Link href={`/orders/${order.id}`} className="orders-order-id orders-order-id-link text-[13.5px] font-mono-ui font-medium text-[#111827] hover:text-[hsl(var(--primary))] dark:text-neutral-200" data-testid={`link-recent-order-${order.id}`} aria-label={`Open order ${order.id}`}>
                        #{String(order.id).padStart(7, '0')}
                      </Link>
                    </td>
                    <td className="px-4 py-3.5 min-w-0">
                      <div className={cn("text-[14px] truncate whitespace-nowrap", isAwaiting ? "italic text-[#9CA3AF] font-normal" : "font-medium text-[#111827] dark:text-neutral-100")} title={isAwaiting ? 'Awaiting buyer' : order.customerName}>
                        {isAwaiting ? 'Awaiting' : order.customerName}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-center whitespace-nowrap">
                      <div className="orders-traffic-cell flex justify-center">
                        <span className="orders-traffic-icon" data-testid={`text-transaction-traffic-${order.id}`} title={channelName(order.channel)} aria-label={`Traffic source: ${channelName(order.channel)}`}>
                          <ChannelMark value={order.channel} size={17} />
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 font-mono-ui text-[14px] font-medium text-[#111827] dark:text-neutral-100 whitespace-nowrap">{moneyExact(order.amount)}</td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <StatusPill tone={paymentTone(order.status)}>{paymentLabel(order)}</StatusPill>
                    </td>
                    <td className="px-4 py-3.5 text-[13px] text-[#6B7280] dark:text-neutral-400 font-mono-ui whitespace-nowrap text-right">{dateFull(order.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="py-12 px-6 text-center text-[#6B7280] dark:text-neutral-400">
          <p className="text-[14px] font-medium text-[#111827] dark:text-neutral-200">No transactions match</p>
          <p className="text-[13px] mt-1 text-[#6B7280] dark:text-neutral-400">Try adjusting your search terms or filter.</p>
        </div>
      )}
    </Card>
  </div>;
}

function RecentTransactionsSkeleton() {
  return (
    <div className="overflow-x-auto w-full scrollbar-thin" aria-label="Loading transactions">
      <table className="list-table w-full min-w-[780px] text-left border-collapse">
        <thead>
          <tr className="border-b border-[#E3E3EC] bg-[#F0F0F8] dark:border-neutral-800 dark:bg-neutral-800/80 h-[48px]">
            <th className="px-4 py-3 text-[14px] font-semibold text-[#111827] dark:text-neutral-100 normal-case whitespace-nowrap">Order ID</th>
            <th className="px-4 py-3 text-[14px] font-semibold text-[#111827] dark:text-neutral-100 normal-case whitespace-nowrap">Customer</th>
            <th className="px-4 py-3 text-[14px] font-semibold text-[#111827] dark:text-neutral-100 normal-case text-center whitespace-nowrap">Traffic</th>
            <th className="px-4 py-3 text-[14px] font-semibold text-[#111827] dark:text-neutral-100 normal-case whitespace-nowrap">Order value</th>
            <th className="px-4 py-3 text-[14px] font-semibold text-[#111827] dark:text-neutral-100 normal-case whitespace-nowrap">Payment</th>
            <th className="px-4 py-3 text-[14px] font-semibold text-[#111827] dark:text-neutral-100 normal-case text-right whitespace-nowrap">Date</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#E8E8EE] dark:divide-neutral-800/80">
          {Array.from({ length: 5 }).map((_, i) => (
            <tr key={i} className="h-[56px]">
              <td className="px-4 py-3.5"><div className="h-4 w-16 rounded-[8px] bg-[#F4F4FA] dark:bg-neutral-800 animate-pulse" /></td>
              <td className="px-4 py-3.5"><div className="h-4 w-28 rounded-[8px] bg-[#F4F4FA] dark:bg-neutral-800 animate-pulse" /></td>
              <td className="px-4 py-3.5"><div className="flex justify-center"><div className="h-7 w-7 rounded-[8px] bg-[#F4F4FA] dark:bg-neutral-800 animate-pulse" /></div></td>
              <td className="px-4 py-3.5"><div className="h-4 w-16 rounded-[8px] bg-[#F4F4FA] dark:bg-neutral-800 animate-pulse" /></td>
              <td className="px-4 py-3.5"><div className="h-6 w-20 rounded-full bg-[#F4F4FA] dark:bg-neutral-800 animate-pulse" /></td>
              <td className="px-4 py-3.5"><div className="flex justify-end"><div className="h-4 w-20 rounded-[8px] bg-[#F4F4FA] dark:bg-neutral-800 animate-pulse" /></div></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OrderRow({ order, compact = false }: { order: Order; compact?: boolean }) {
  return <div className={cn('flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between', compact && 'py-3.5')} data-testid={`row-order-${order.id}`}><div className="flex items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] bg-[hsl(var(--muted))] font-mono-ui text-xs font-bold">{initials(order.customerName || order.productName)}</div><div><div className="text-[15px] font-semibold">{order.customerName || 'Buyer pending'}</div><div className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{order.productName} · <ChannelInline value={order.channel} /></div></div></div><div className="flex items-center gap-4 pl-12 sm:pl-0"><div className="text-right"><div className="font-mono-ui text-sm font-semibold">{moneyExact(order.amount)}</div><div className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{dateShort(order.createdAt)}</div></div><StatusPill tone={paymentTone(order.status)}>{order.status.replace('_', ' ')}</StatusPill></div></div>;
}

export type ProductPreferenceDraft = { label: string; options: string };
export type ProductCustomFieldDraft = { label: string; value: string };
export type ProductFormState = { name: string; category: string; sku: string; description: string; price: string; compareAtPrice: string; cost: string; stock: string; preferences: ProductPreferenceDraft[]; customFields: ProductCustomFieldDraft[]; imageUrl: string; imageUrls: string; images?: string[]; accent: string };
export const blankProduct: ProductFormState = { name: '', category: '', sku: '', description: '', price: '', compareAtPrice: '', cost: '', stock: '0', preferences: [], customFields: [], imageUrl: '', imageUrls: '', images: [], accent: '' };

export function calculateProfitAndMargin(priceStr: string, costStr: string) {
  const priceNum = parseFloat(priceStr);
  const costNum = parseFloat(costStr);
  const hasPricingInfo = !isNaN(priceNum) && priceNum > 0;
  const hasCostInfo = !isNaN(costNum) && costNum >= 0;
  const grossProfit = hasPricingInfo && hasCostInfo ? priceNum - costNum : null;
  const marginPercent = hasPricingInfo && hasCostInfo && priceNum > 0 ? ((grossProfit! / priceNum) * 100) : null;
  return { hasPricingInfo, hasCostInfo, grossProfit, marginPercent, priceNum, costNum };
}

export function resolveStockStatus(stock: string | number) {
  const stockNum = typeof stock === 'number' ? stock : parseInt(String(stock), 10);
  if (isNaN(stockNum) || stockNum <= 0) {
    return { label: 'Out of stock', tone: 'neutral' as const, quantity: isNaN(stockNum) ? 0 : stockNum };
  }
  if (stockNum < 5) {
    return { label: 'Low stock', tone: 'gold' as const, quantity: stockNum };
  }
  return { label: 'In stock', tone: 'mint' as const, quantity: stockNum };
}
const PRODUCT_IMAGE_MAX_BYTES = 15 * 1024 * 1024; // 15 MB
const PRODUCT_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

async function compressImageFile(file: File, maxDim = 1400, quality = 0.85): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      if (typeof dataUrl !== 'string') {
        reject(new Error('Failed reading image'));
        return;
      }
      if (file.type === 'image/svg+xml' || file.type === 'image/gif') {
        resolve(dataUrl);
        return;
      }
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width <= maxDim && height <= maxDim && file.size < 800 * 1024) {
          resolve(dataUrl);
          return;
        }
        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    };
    reader.onerror = () => reject(new Error('Failed reading image'));
    reader.readAsDataURL(file);
  });
}
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
  updateCustomField: (index: number, key: keyof ProductCustomFieldDraft, value: string) => void;
  imageError: string;
  onImageChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveImage: () => void;
  onRemoveImageAt?: (index: number) => void;
  onSetPrimaryImage?: (index: number) => void;
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
  updateCustomField,
  imageError,
  onImageChange,
  onRemoveImage,
  onRemoveImageAt,
  onSetPrimaryImage,
}: ReferenceProductEditorProps) {
  const productsQuery = useListProducts();
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isAddingNewCategory, setIsAddingNewCategory] = useState(false);
  const [categorySearch, setCategorySearch] = useState('');
  const [customCategories, setCustomCategories] = useState<string[]>([]);

  const defaultCategories = useMemo(() => [
    'Apparel',
    'Accessories',
    'Bags',
    'Footwear',
    'Beauty & Cosmetics',
    'Jewelry',
    'Home & Living',
    'Electronics',
    'Food & Drink',
    'Art & Crafts',
  ], []);

  const allCategories = useMemo(() => {
    const fromProducts = (productsQuery.data ?? [])
      .map((p) => p.category?.trim())
      .filter(Boolean) as string[];
    const merged = Array.from(new Set([
      ...defaultCategories,
      ...fromProducts,
      ...customCategories,
      ...(form.category ? [form.category] : []),
    ]));
    return merged.sort((a, b) => a.localeCompare(b));
  }, [productsQuery.data, defaultCategories, customCategories, form.category]);

  const filteredCategories = useMemo(() => {
    if (!categorySearch.trim()) return allCategories;
    return allCategories.filter((c) => c.toLowerCase().includes(categorySearch.toLowerCase()));
  }, [allCategories, categorySearch]);

  const handleAddNewCategory = (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = newCategoryName.trim();
    if (!trimmed) return;
    setCustomCategories((prev) => [...prev, trimmed]);
    change('category', trimmed);
    setNewCategoryName('');
    setIsAddingNewCategory(false);
    setCategoryOpen(false);
  };

  const allImages = useMemo(() => {
    if (form.images && form.images.length > 0) return form.images;
    if (form.imageUrl) return [form.imageUrl];
    return [];
  }, [form.images, form.imageUrl]);

  const addOption = () => setForm((current) => ({
    ...current,
    preferences: [...current.preferences, { label: '', options: '' }],
  }));
  const removeOption = (index: number) => setForm((current) => ({
    ...current,
    preferences: current.preferences.filter((_, i) => i !== index),
  }));
  const addCustomField = () => setForm((current) => ({
    ...current,
    customFields: [...current.customFields, { label: '', value: '' }],
  }));
  const removeCustomField = (index: number) => setForm((current) => ({
    ...current,
    customFields: current.customFields.filter((_, i) => i !== index),
  }));

  const { priceNum, costNum, hasPricingInfo, hasCostInfo, grossProfit, marginPercent } = calculateProfitAndMargin(form.price, form.cost);
  const stockStatus = resolveStockStatus(form.stock);
  const stockNum = stockStatus.quantity;

  const content = (
    <div className="catalog-editor-container">
      {fullPage ? (
        <PageHeader
          breadcrumbs={
            <button
              type="button"
              onClick={onClose}
              data-testid="button-back-product"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition cursor-pointer"
            >
              <ArrowLeft size={13} />
              <span>Back to catalog</span>
            </button>
          }
          title={product ? `Edit ${product.name || 'item'}` : 'Add new product'}
          secondaryActions={
            <Button type="button" variant="outline" onClick={onClose}>
              Discard
            </Button>
          }
          primaryAction={
            <Button
              type="button"
              disabled={pending}
              data-testid="button-save-product"
              onClick={(e) => {
                const formEl = document.getElementById('catalog-product-form') as HTMLFormElement | null;
                if (formEl) formEl.requestSubmit();
                else onSubmit(e as unknown as React.FormEvent);
              }}
            >
              {pending && <Loader2 size={15} className="animate-spin mr-1.5" />}
              {product ? 'Save changes' : 'Save product'}
            </Button>
          }
        />
      ) : (
        <div className="catalog-editor-header flex flex-col gap-4 border-b border-[hsl(var(--border))] pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3.5">
            <button
              type="button"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--foreground))] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[hsl(var(--muted))] active:scale-95 cursor-pointer"
              onClick={onClose}
              aria-label="Back to catalog"
              data-testid="button-back-product"
            >
              <ArrowLeft size={18} aria-hidden="true" />
            </button>
            <div className="min-w-0">
              <div className="type-eyebrow">Catalog inventory</div>
              <h1 className="type-h1 mt-1">{product ? `Edit ${product.name || 'item'}` : 'Add new product'}</h1>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2.5 self-end sm:self-center">
            <Button type="button" variant="outline" onClick={onClose}>
              Discard
            </Button>
            <Button
              type="button"
              disabled={pending}
              data-testid="button-save-product"
              onClick={(e) => {
                const formEl = document.getElementById('catalog-product-form') as HTMLFormElement | null;
                if (formEl) formEl.requestSubmit();
                else onSubmit(e as unknown as React.FormEvent);
              }}
            >
              {pending && <Loader2 size={15} className="animate-spin mr-1.5" />}
              {product ? 'Save changes' : 'Save product'}
            </Button>
          </div>
        </div>
      )}

      <form id="catalog-product-form" className="catalog-editor-layout mt-6" onSubmit={onSubmit}>
        {/* Left Column: General Info, Pricing, Buyer Options, Custom Specifications */}
        <div className="catalog-editor-main space-y-6">
          {/* Card 1: General Info */}
          <section className="catalog-editor-card">
            <div className="catalog-editor-card-header">
              <div>
                <div className="type-eyebrow">Information</div>
                <h2 className="type-h3 mt-1">General details</h2>
              </div>
            </div>

            <div className="catalog-field">
              <label htmlFor="product-name-reference">Product name <span className="required" aria-hidden="true">*</span></label>
              <input
                id="product-name-reference"
                data-testid="input-product-name"
                autoFocus
                required
                value={form.name}
                onChange={(event) => change('name', event.target.value)}
                placeholder="e.g. Vintage Leather Jacket, Handcrafted Ceramic Mug"
              />
            </div>

            <div className="catalog-field mt-4">
              <label htmlFor="product-category-reference">Category <span className="required" aria-hidden="true">*</span></label>
              <Popover open={categoryOpen} onOpenChange={setCategoryOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    id="product-category-reference"
                    data-testid="select-product-category"
                    aria-label="Select product category"
                    className={cn(
                      'field-input flex items-center justify-between text-left h-10 px-3 cursor-pointer rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]',
                      !form.category && 'text-[hsl(var(--muted-foreground))]'
                    )}
                  >
                    <span className="truncate">
                      {form.category || 'Select a category...'}
                    </span>
                    <ChevronDown size={15} className={cn('shrink-0 text-[hsl(var(--muted-foreground))] transition-transform duration-200', categoryOpen && 'rotate-180')} />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  side="bottom"
                  sideOffset={4}
                  data-testid="card-category-dropdown"
                  className="z-50 w-72 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-2 text-[hsl(var(--foreground))] shadow-xl"
                >
                  <div className="flex items-center justify-between pb-2 mb-1.5 border-b border-[hsl(var(--border))]">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[hsl(var(--muted-foreground))] font-mono-ui">
                      Select Category
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsAddingNewCategory((prev) => !prev)}
                      title="Add a new category"
                      data-testid="button-add-category"
                      className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold text-[hsl(var(--primary))] hover:bg-[hsl(var(--muted))] transition-colors cursor-pointer"
                    >
                      <Plus size={13} />
                      <span>New</span>
                    </button>
                  </div>

                  {isAddingNewCategory ? (
                    <form onSubmit={handleAddNewCategory} className="mb-2 p-2 rounded-lg bg-[hsl(var(--muted))]/50 border border-[hsl(var(--border))]">
                      <div className="text-[11px] font-semibold text-[hsl(var(--foreground))] mb-1.5">Add new category</div>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          autoFocus
                          placeholder="e.g. Footwear"
                          value={newCategoryName}
                          onChange={(e) => setNewCategoryName(e.target.value)}
                          data-testid="input-new-category-name"
                          className="field-input h-8 text-xs flex-1 px-2 rounded-md"
                        />
                        <button
                          type="submit"
                          disabled={!newCategoryName.trim()}
                          data-testid="button-save-new-category"
                          className="h-8 px-2.5 rounded-md bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] text-xs font-medium hover:opacity-90 disabled:opacity-40 cursor-pointer"
                        >
                          Add
                        </button>
                        <button
                          type="button"
                          onClick={() => { setIsAddingNewCategory(false); setNewCategoryName(''); }}
                          className="h-8 px-2 rounded-md hover:bg-[hsl(var(--muted))] text-xs text-[hsl(var(--muted-foreground))] cursor-pointer"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="relative mb-1.5">
                      <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
                      <input
                        type="text"
                        placeholder="Search categories..."
                        value={categorySearch}
                        onChange={(e) => setCategorySearch(e.target.value)}
                        style={{ paddingLeft: '2.15rem' }}
                        className="field-input h-8 pr-2.5 text-xs rounded-lg whitespace-nowrap overflow-hidden text-ellipsis"
                      />
                    </div>
                  )}

                  <div className="max-h-48 overflow-y-auto space-y-0.5">
                    {filteredCategories.length > 0 ? (
                      filteredCategories.map((category) => {
                        const isSelected = form.category === category;
                        return (
                          <button
                            key={category}
                            type="button"
                            data-testid={`option-category-${category.toLowerCase().replace(/\s+/g, '-')}`}
                            onClick={() => {
                              change('category', category);
                              setCategoryOpen(false);
                            }}
                            className={cn(
                              'flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-left transition-colors cursor-pointer',
                              isSelected
                                ? 'bg-[hsl(var(--muted))] text-[hsl(var(--foreground))] font-semibold'
                                : 'text-[hsl(var(--foreground))]/80 hover:bg-[hsl(var(--muted))]/60'
                            )}
                          >
                            <span>{category}</span>
                            {isSelected && <Check size={13} className="shrink-0 text-[hsl(var(--primary))]" />}
                          </button>
                        );
                      })
                    ) : (
                      <div className="py-3 text-center text-xs text-[hsl(var(--muted-foreground))]">
                        No category found.{' '}
                        <button
                          type="button"
                          onClick={() => {
                            setNewCategoryName(categorySearch.trim());
                            setIsAddingNewCategory(true);
                          }}
                          className="text-[hsl(var(--primary))] font-semibold underline cursor-pointer"
                        >
                          Add "{categorySearch}"
                        </button>
                      </div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <div className="catalog-field mt-4">
              <label htmlFor="product-description-reference">Description</label>
              <textarea
                id="product-description-reference"
                value={form.description}
                onChange={(event) => change('description', event.target.value)}
                placeholder="Write a clear, compelling description of your product for buyers..."
                rows={4}
              />
            </div>

            <div className="catalog-field mt-5 border-t border-[hsl(var(--border))] pt-4">
              <label>Store accent theme</label>
              <div className="catalog-accent-options mt-1">
                {accentOptions.map(({ value, label }) => (
                  <button
                    type="button"
                    key={value}
                    onClick={() => change('accent', value)}
                    aria-label={`Use ${label} accent color`}
                    aria-pressed={form.accent === value}
                    data-testid={`button-accent-${value.slice(1)}`}
                    className={cn('catalog-accent-swatch', form.accent === value && 'is-selected')}
                    style={{ backgroundColor: value }}
                  />
                ))}
              </div>
            </div>
          </section>

          {/* Card 2: Pricing & Profitability (Strictly Two Prices: Selling price and Cost price) */}
          <section className="catalog-editor-card">
            <div className="catalog-editor-card-header">
              <div>
                <div className="type-eyebrow">Financials</div>
                <h2 className="type-h3 mt-1">Pricing & Profitability</h2>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="catalog-field">
                <label htmlFor="product-price-reference">Selling price <span className="required" aria-hidden="true">*</span></label>
                <div className="catalog-currency-wrap">
                  <span>{currencySymbol()}</span>
                  <input
                    id="product-price-reference"
                    data-testid="input-product-price"
                    type="number"
                    min="0"
                    step=".01"
                    required
                    value={form.price}
                    onChange={(event) => change('price', event.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <span className="text-[11px] text-[hsl(var(--muted-foreground))] mt-1">Price charged to buyer</span>
              </div>

              <div className="catalog-field">
                <label htmlFor="product-cost-reference">Cost price <span className="text-[11px] font-normal text-[hsl(var(--muted-foreground))]">(optional)</span></label>
                <div className="catalog-currency-wrap">
                  <span>{currencySymbol()}</span>
                  <input
                    id="product-cost-reference"
                    data-testid="input-product-cost"
                    type="number"
                    min="0"
                    step=".01"
                    value={form.cost}
                    onChange={(event) => change('cost', event.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <span className="text-[11px] text-[hsl(var(--muted-foreground))] mt-1">What you bought the item at. Used in Net Profit analytics.</span>
              </div>
            </div>

            {hasPricingInfo && hasCostInfo && grossProfit !== null && marginPercent !== null ? (
              <div className="mt-5 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/30 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-2.5">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      'flex h-7 w-7 items-center justify-center rounded-lg',
                      grossProfit >= 0 ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                    )}>
                      <Percent size={14} />
                    </div>
                    <div>
                      <div className="text-xs font-semibold">Profit & Margin Overview</div>
                      <div className="text-[10.5px] text-[hsl(var(--muted-foreground))]">Per unit sold to buyer</div>
                    </div>
                  </div>
                  <StatusPill tone={grossProfit >= 0 ? 'mint' : 'rose'}>
                    {marginPercent.toFixed(1)}% profit margin
                  </StatusPill>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[hsl(var(--border))]/50 text-center sm:text-left">
                  <div className="p-2 rounded-lg bg-[hsl(var(--card))] border border-[hsl(var(--border))]/60">
                    <div className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase tracking-wider font-semibold">Selling Price</div>
                    <div className="font-mono-ui text-sm font-bold mt-0.5">{moneyExact(priceNum)}</div>
                  </div>
                  <div className="p-2 rounded-lg bg-[hsl(var(--card))] border border-[hsl(var(--border))]/60">
                    <div className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase tracking-wider font-semibold">Unit Cost</div>
                    <div className="font-mono-ui text-sm font-bold text-slate-500 mt-0.5">{moneyExact(costNum)}</div>
                  </div>
                  <div className="p-2 rounded-lg bg-[hsl(var(--card))] border border-[hsl(var(--border))]/60">
                    <div className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase tracking-wider font-semibold">Gross Profit</div>
                    <div className={cn('font-mono-ui text-sm font-bold mt-0.5', grossProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
                      {grossProfit >= 0 ? '+' : ''}{moneyExact(grossProfit)}
                    </div>
                  </div>
                </div>
              </div>
            ) : hasPricingInfo && !hasCostInfo ? (
              <div className="mt-4 flex items-center gap-2 rounded-lg bg-[hsl(var(--muted))]/20 p-2.5 text-xs text-[hsl(var(--muted-foreground))]">
                <Info size={14} className="shrink-0 text-[hsl(var(--muted-foreground))]" />
                <span>Add what you bought the item at (cost price) to track estimated gross profit and margin automatically. If blank, Analytics warns about missing costs.</span>
              </div>
            ) : null}
          </section>

          {/* Card 3: Buyer Options */}
          <section className="catalog-editor-card">
            <div className="catalog-editor-card-header">
              <div>
                <div className="type-eyebrow">Variants</div>
                <h2 className="type-h3 mt-1">Buyer Options</h2>
              </div>
              <Button type="button" variant="soft" onClick={addOption} className="text-xs">
                <Plus size={14} /> Add option
              </Button>
            </div>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              Provide choices for buyers such as Size, Color, Finish, or Material.
            </p>

            {form.preferences.length > 0 ? (
              <div className="mt-4 space-y-3">
                {form.preferences.map((preference, index) => {
                  const chips = preference.options.split(',').map((o) => o.trim()).filter(Boolean);
                  return (
                    <div key={`pref-${index}`} className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/20 p-3">
                      <div className="catalog-option-row">
                        <input
                          aria-label={`Option ${index + 1} name`}
                          required
                          value={preference.label}
                          onChange={(e) => updatePreference(index, 'label', e.target.value)}
                          placeholder="Name, e.g. Size"
                          className="field-input text-xs"
                        />
                        <input
                          aria-label={`Option ${index + 1} values`}
                          required
                          value={preference.options}
                          onChange={(e) => updatePreference(index, 'options', e.target.value)}
                          placeholder="Options, comma-separated e.g. S, M, L, XL"
                          className="field-input text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => removeOption(index)}
                          aria-label={`Remove option ${index + 1}`}
                          className="rounded-lg p-2 text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--destructive))]/10 hover:text-[hsl(var(--destructive))]"
                        >
                          <X size={15} />
                        </button>
                      </div>
                      {chips.length > 0 && (
                        <div className="mt-2.5 flex flex-wrap items-center gap-1.5 pt-2 border-t border-[hsl(var(--border))]/50">
                          <span className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider mr-1">Preview:</span>
                          {chips.map((chip, chipIdx) => (
                            <span key={chipIdx} className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-2 py-0.5 font-mono-ui text-[11px] text-[hsl(var(--foreground))]">
                              {chip}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-dashed border-[hsl(var(--border))] p-4 text-center text-xs text-[hsl(var(--muted-foreground))]">
                No buyer options defined yet. This item will be purchased as a standard single variant.
              </div>
            )}
          </section>

          {/* Card 4: Custom Specifications */}
          <section className="catalog-editor-card">
            <div className="catalog-editor-card-header">
              <div>
                <div className="type-eyebrow">Specifications</div>
                <h2 className="type-h3 mt-1">Custom Details</h2>
              </div>
              <Button type="button" variant="soft" onClick={addCustomField} className="text-xs">
                <Plus size={14} /> Add specification
              </Button>
            </div>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              Add non-selectable product specifications like Material, Care Guide, Dimensions, or Origin.
            </p>

            {form.customFields.length > 0 ? (
              <div className="mt-4 space-y-3">
                {form.customFields.map((field, index) => (
                  <div key={`spec-${index}`} className="catalog-option-row">
                    <input
                      aria-label={`Custom specification ${index + 1} label`}
                      value={field.label}
                      onChange={(e) => updateCustomField(index, 'label', e.target.value)}
                      placeholder="Label, e.g. Material"
                      className="field-input text-xs"
                    />
                    <input
                      aria-label={`Custom specification ${index + 1} value`}
                      value={field.value}
                      onChange={(e) => updateCustomField(index, 'value', e.target.value)}
                      placeholder="Value, e.g. 100% Pure Organic Linen"
                      className="field-input text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => removeCustomField(index)}
                      aria-label={`Remove custom field ${index + 1}`}
                      className="rounded-lg p-2 text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--destructive))]/10 hover:text-[hsl(var(--destructive))]"
                    >
                      <X size={15} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-dashed border-[hsl(var(--border))] p-4 text-center text-xs text-[hsl(var(--muted-foreground))]">
                No extra custom specifications added.
              </div>
            )}
          </section>

          {(error || hasMutationError) && (
            <div className="rounded-xl border border-[hsl(var(--destructive))]/25 bg-[hsl(var(--destructive))]/10 p-4 text-xs font-medium text-[hsl(var(--destructive))]" role="alert" data-testid="status-product-form-error">
              {error || 'This item could not be saved. Try again.'}
            </div>
          )}

          {/* Bottom mobile action buttons */}
          <div className="flex items-center justify-end gap-3 sm:hidden pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Discard
            </Button>
            <Button type="submit" disabled={pending} data-testid="button-save-product-mobile" className="flex-1">
              {pending && <Loader2 size={15} className="animate-spin mr-1.5" />}
              {product ? 'Save changes' : 'Save product'}
            </Button>
          </div>
        </div>

        {/* Right Column: Media, Inventory, Live Preview */}
        <aside className="catalog-editor-sidebar space-y-6">
          {/* Media Card (Multiple Product Images) */}
          <section className="catalog-editor-card">
            <div className="catalog-editor-card-header flex items-center justify-between">
              <div>
                <div className="type-eyebrow">Media</div>
                <h2 className="type-h3 mt-1">Product Images</h2>
              </div>
              {allImages.length > 0 && (
                <span className="text-xs text-[hsl(var(--muted-foreground))] font-mono-ui">
                  {allImages.length} {allImages.length === 1 ? 'image' : 'images'}
                </span>
              )}
            </div>

            {allImages.length > 0 ? (
              <div className="space-y-3">
                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted))] group/hero">
                  <img src={allImages[0]} alt="Cover product visual" className="h-full w-full object-cover" />
                  <div className="absolute top-2 left-2 rounded-full bg-slate-900/80 backdrop-blur-sm px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm flex items-center gap-1">
                    <Check size={10} /> Cover Photo
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemoveImageAt ? onRemoveImageAt(0) : onRemoveImage()}
                    data-testid="button-remove-product-image"
                    title="Remove cover photo"
                    className="absolute top-2 right-2 rounded-lg bg-black/60 hover:bg-rose-600 p-1.5 text-white transition-colors cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  {allImages.map((imgUrl, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        'group/thumb relative aspect-square rounded-lg overflow-hidden border transition-all',
                        idx === 0
                          ? 'border-[hsl(var(--primary))] ring-2 ring-[hsl(var(--primary))]/20'
                          : 'border-[hsl(var(--border))] hover:border-[hsl(var(--foreground))]/40'
                      )}
                    >
                      <img src={imgUrl} alt={`Product thumbnail ${idx + 1}`} className="h-full w-full object-cover" />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center gap-1">
                        {idx !== 0 && onSetPrimaryImage && (
                          <button
                            type="button"
                            onClick={() => onSetPrimaryImage(idx)}
                            title="Make cover photo"
                            className="rounded px-1.5 py-0.5 bg-white/95 text-slate-900 hover:bg-white text-[9px] font-bold cursor-pointer"
                          >
                            Cover
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onRemoveImageAt ? onRemoveImageAt(idx) : onRemoveImage()}
                          title="Delete image"
                          data-testid={`button-delete-image-${idx}`}
                          className="rounded p-1 bg-rose-600 text-white hover:bg-rose-700 cursor-pointer"
                        >
                          <X size={11} />
                        </button>
                      </div>
                      {idx === 0 && (
                        <span className="absolute bottom-1 left-1 rounded bg-black/75 px-1 text-[8px] font-bold text-white uppercase tracking-wider">
                          Main
                        </span>
                      )}
                    </div>
                  ))}

                  <label
                    htmlFor="product-image-upload"
                    className="aspect-square flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-[hsl(var(--border))] hover:border-[hsl(var(--primary))] bg-[hsl(var(--muted))]/20 hover:bg-[hsl(var(--muted))]/50 cursor-pointer transition-colors p-2 text-center"
                  >
                    <Plus size={16} className="text-[hsl(var(--muted-foreground))]" />
                    <span className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))] mt-0.5">Add more</span>
                  </label>
                </div>
              </div>
            ) : (
              <label htmlFor="product-image-upload" className="catalog-upload-dropzone">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--card))] shadow-sm text-[hsl(var(--muted-foreground))]">
                  <ImagePlus size={20} />
                </div>
                <div className="text-xs font-semibold text-[hsl(var(--foreground))]">Upload product visuals</div>
                <p className="text-[11px] text-[hsl(var(--muted-foreground))]">Select multiple photos (PNG, JPG, WebP up to 15 MB each)</p>
              </label>
            )}

            <input
              id="product-image-upload"
              data-testid="input-product-image"
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="sr-only"
              onChange={onImageChange}
            />

            {imageError && (
              <p className="mt-2 text-xs font-medium text-[hsl(var(--destructive))]" role="alert" data-testid="status-product-image-error">
                {imageError}
              </p>
            )}
          </section>

          {/* Inventory Card (Proper Stock Management) */}
          <section className="catalog-editor-card">
            <div className="catalog-editor-card-header flex items-center justify-between">
              <div>
                <div className="type-eyebrow">Stock management</div>
                <h2 className="type-h3 mt-1">Inventory</h2>
              </div>
              <div data-testid="pill-stock-status">
                <StatusPill tone={stockStatus.tone}>{stockStatus.label}</StatusPill>
              </div>
            </div>

            <div className="catalog-field">
              <label htmlFor="product-stock-reference">Stock on hand <span className="required" aria-hidden="true">*</span></label>
              <div className="mt-1 flex items-center gap-2">
                <button
                  type="button"
                  aria-label="Decrease stock"
                  data-testid="button-stock-decrement"
                  onClick={() => {
                    const current = Math.max(0, (parseInt(form.stock, 10) || 0) - 1);
                    change('stock', String(current));
                  }}
                  disabled={parseInt(form.stock, 10) <= 0}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] active:scale-95 disabled:opacity-40 cursor-pointer"
                >
                  <Minus size={15} />
                </button>

                <input
                  id="product-stock-reference"
                  data-testid="input-product-stock"
                  type="number"
                  min="0"
                  step="1"
                  required
                  value={form.stock}
                  onChange={(event) => change('stock', event.target.value)}
                  placeholder="0"
                  className="text-center font-mono-ui font-semibold"
                />

                <button
                  type="button"
                  aria-label="Increase stock"
                  data-testid="button-stock-increment"
                  onClick={() => {
                    const current = (parseInt(form.stock, 10) || 0) + 1;
                    change('stock', String(current));
                  }}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] active:scale-95 cursor-pointer"
                >
                  <Plus size={15} />
                </button>
              </div>

              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))] mr-1">Quick:</span>
                {[5, 10, 25, 50].map((delta) => (
                  <button
                    key={delta}
                    type="button"
                    data-testid={`button-stock-add-${delta}`}
                    onClick={() => {
                      const current = (parseInt(form.stock, 10) || 0) + delta;
                      change('stock', String(current));
                    }}
                    className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-2 py-0.5 text-[11px] font-mono-ui font-medium text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors cursor-pointer"
                  >
                    +{delta}
                  </button>
                ))}
                <button
                  type="button"
                  data-testid="button-stock-set-0"
                  onClick={() => change('stock', '0')}
                  className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-2 py-0.5 text-[11px] font-mono-ui text-[hsl(var(--muted-foreground))] hover:text-rose-600 hover:border-rose-200 transition-colors cursor-pointer"
                >
                  Set 0
                </button>
              </div>
            </div>

            <div className="catalog-field mt-4 border-t border-[hsl(var(--border))]/50 pt-3">
              <div className="flex items-center justify-between">
                <label htmlFor="product-sku-reference">SKU / Item code <span className="text-[11px] font-normal text-[hsl(var(--muted-foreground))]">(optional)</span></label>
                <button
                  type="button"
                  data-testid="button-generate-sku"
                  onClick={() => {
                    const prefix = (form.category || form.name || 'SKU')
                      .replace(/[^a-zA-Z]/g, '')
                      .slice(0, 3)
                      .toUpperCase() || 'SKU';
                    const randomNum = Math.floor(1000 + Math.random() * 9000);
                    change('sku', `${prefix}-${randomNum}`);
                  }}
                  className="text-[11px] font-semibold text-[hsl(var(--primary))] hover:underline cursor-pointer"
                >
                  Generate SKU
                </button>
              </div>
              <input
                id="product-sku-reference"
                data-testid="input-product-sku"
                value={form.sku}
                onChange={(event) => change('sku', event.target.value)}
                placeholder="e.g. APP-4081"
                className="mt-1 font-mono-ui"
              />
            </div>
          </section>

          {/* Live Buyer Preview Card */}
          <section className="catalog-editor-card lg:sticky lg:top-24">
            <div className="catalog-editor-card-header">
              <div>
                <div className="type-eyebrow">Customer view</div>
                <h3 className="type-h3 mt-1 flex items-center gap-1.5">
                  <Eye size={15} /> Storefront Preview
                </h3>
              </div>
            </div>

            <div className="catalog-preview-mockup">
              <div className="relative aspect-[4/3] w-full overflow-hidden bg-[hsl(var(--muted))]">
                {allImages[0] ? (
                  <img src={allImages[0]} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center text-[hsl(var(--muted-foreground))]">
                    <Package size={32} className="opacity-40" />
                    <span className="mt-1 text-[11px]">No image uploaded</span>
                  </div>
                )}
                <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                  <span className="rounded-full bg-[hsl(var(--card))]/90 backdrop-blur-sm px-2.5 py-0.5 text-[10px] font-semibold text-[hsl(var(--foreground))] shadow-sm">
                    {form.category || 'Category'}
                  </span>
                  <span className="h-2.5 w-2.5 rounded-full ring-2 ring-white shadow-sm" style={{ backgroundColor: form.accent }} />
                </div>
                {allImages.length > 1 && (
                  <div className="absolute bottom-2.5 right-2.5 rounded-full bg-black/70 backdrop-blur-sm px-2 py-0.5 text-[10px] font-mono-ui text-white">
                    1 / {allImages.length}
                  </div>
                )}
              </div>

              <div className="p-4">
                <div className="truncate text-sm font-bold text-[hsl(var(--foreground))]">
                  {form.name || 'Product name'}
                </div>
                {form.description && (
                  <div className="mt-1 line-clamp-2 text-xs text-[hsl(var(--muted-foreground))]">
                    {form.description}
                  </div>
                )}

                <div className="mt-3 flex items-baseline gap-2">
                  <span className="font-mono-ui text-base font-bold text-[hsl(var(--foreground))]">
                    {hasPricingInfo ? moneyExact(priceNum) : `${currencySymbol()}0.00`}
                  </span>
                </div>

                {form.preferences.some((p) => p.label && p.options) && (
                  <div className="mt-3 flex flex-wrap gap-1 border-t border-[hsl(var(--border))] pt-2.5">
                    {form.preferences
                      .filter((p) => p.label && p.options)
                      .map((p, idx) => (
                        <span key={idx} className="rounded-md bg-[hsl(var(--muted))] px-2 py-0.5 text-[10px] text-[hsl(var(--muted-foreground))]">
                          {p.label}: {p.options.split(',').length} options
                        </span>
                      ))}
                  </div>
                )}
              </div>
            </div>
            <p className="mt-3 text-center text-[11px] text-[hsl(var(--muted-foreground))]">
              Real-time preview of how buyers will see this item on mobile & web.
            </p>
          </section>
        </aside>
      </form>
    </div>
  );

  return fullPage
    ? <div className="catalog-editor-page">{content}</div>
    : <div className="fixed inset-0 z-50 flex items-end justify-center bg-[hsl(220_30%_17%/.45)] p-0 backdrop-blur-sm sm:items-center sm:p-5"><div className="catalog-editor-modal max-h-[92dvh] w-full max-w-[960px] overflow-y-auto rounded-2xl bg-[hsl(var(--background))] p-6 shadow-2xl">{content}</div></div>;
}

export function ProductModal({ product, onClose, fullPage = false }: { product?: Product; onClose: () => void; fullPage?: boolean }) {
  const queryClient = useQueryClient();
  const create = useCreateProduct(); const update = useUpdateProduct();
  const [error, setError] = useState('');
  const [imageError, setImageError] = useState('');

  const initialImages = useMemo(() => {
    if (!product) return [];
    const list: string[] = [];
    if (product.imageUrl) list.push(product.imageUrl);
    if (product.imageUrls) {
      for (const url of product.imageUrls) {
        if (url && !list.includes(url)) list.push(url);
      }
    }
    return list;
  }, [product]);

  const [form, setForm] = useState<ProductFormState>(() => product ? {
    name: product.name,
    category: product.category,
    sku: product.sku ?? '',
    description: product.description ?? '',
    price: String(product.price),
    compareAtPrice: '',
    cost: product.cost == null ? '' : String(product.cost),
    stock: String(product.stock),
    preferences: product.preferences.length
      ? product.preferences.map((group) => ({ label: group.label, options: group.options.join(', ') }))
      : product.variants.length
        ? [{ label: 'Option', options: product.variants.join(', ') }]
        : [],
    customFields: product.customFields.map((field) => ({ label: field.label, value: field.value })),
    imageUrl: initialImages[0] ?? '',
    imageUrls: initialImages.slice(1).join('\n'),
    images: initialImages,
    accent: product.accent,
  } : blankProduct);

  const pending = create.isPending || update.isPending;
  const change = (key: keyof ProductFormState, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const updatePreference = (index: number, key: keyof ProductPreferenceDraft, value: string) => setForm((current) => ({ ...current, preferences: current.preferences.map((preference, preferenceIndex) => preferenceIndex === index ? { ...preference, [key]: value } : preference) }));
  const updateCustomField = (index: number, key: keyof ProductCustomFieldDraft, value: string) => setForm((current) => ({ ...current, customFields: current.customFields.map((field, fieldIndex) => fieldIndex === index ? { ...field, [key]: value } : field) }));

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (!files.length) return;

    for (const file of files) {
      if (!PRODUCT_IMAGE_TYPES.has(file.type)) {
        setImageError('Choose PNG, JPG, WebP, or GIF images.');
        return;
      }
      if (file.size > PRODUCT_IMAGE_MAX_BYTES) {
        setImageError(`"${file.name}" is larger than 15 MB. Choose images under 15 MB.`);
        return;
      }
    }

    setImageError('');
    Promise.all(files.map((file) => compressImageFile(file, 1400, 0.85)))
      .then((dataUrls) => {
        setForm((current) => {
          const existing = current.images ?? (current.imageUrl ? [current.imageUrl] : []);
          const combined = Array.from(new Set([...existing, ...dataUrls]));
          return {
            ...current,
            images: combined,
            imageUrl: combined[0] || '',
            imageUrls: combined.slice(1).join('\n'),
          };
        });
      })
      .catch(() => {
        setImageError('One or more images could not be read. Try another file.');
      });
  };

  const removeImageAt = (index: number) => {
    setForm((current) => {
      const existing = current.images ?? (current.imageUrl ? [current.imageUrl] : []);
      const updated = existing.filter((_, i) => i !== index);
      return {
        ...current,
        images: updated,
        imageUrl: updated[0] || '',
        imageUrls: updated.slice(1).join('\n'),
      };
    });
    setImageError('');
  };

  const setPrimaryImage = (index: number) => {
    setForm((current) => {
      const existing = [...(current.images ?? (current.imageUrl ? [current.imageUrl] : []))];
      if (index <= 0 || index >= existing.length) return current;
      const [chosen] = existing.splice(index, 1);
      existing.unshift(chosen);
      return {
        ...current,
        images: existing,
        imageUrl: existing[0] || '',
        imageUrls: existing.slice(1).join('\n'),
      };
    });
  };

  const removeImage = () => {
    setForm((current) => ({ ...current, imageUrl: '', imageUrls: '', images: [] }));
    setImageError('');
  };

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setImageError('');

    if (!form.category.trim()) {
      setError('Please select or add a category for this item.');
      return;
    }

    const preferences: ProductPreferenceGroup[] = form.preferences
      .map((preference) => ({
        label: preference.label.trim(),
        options: Array.from(new Set(preference.options.split(',').map((option) => option.trim()).filter(Boolean))),
      }))
      .filter((preference) => preference.label && preference.options.length > 0);

    const price = Number(form.price);
    const cost = form.cost.trim() === '' ? null : Number(form.cost);
    const stock = Number(form.stock);

    const imageUrls = form.images && form.images.length > 0
      ? form.images
      : Array.from(new Set([form.imageUrl.trim(), ...form.imageUrls.split(/[\n,]+/).map((url) => url.trim()).filter(Boolean)].filter(Boolean)));

    const invalidImageUrl = imageUrls.find((url) => !isProductImageValue(url));

    if (!form.name.trim() || !form.category.trim() || !Number.isFinite(price) || price < 0 || (cost !== null && (!Number.isFinite(cost) || cost < 0)) || !Number.isInteger(stock) || stock < 0) {
      setError('Add a name, category, valid price, and non-negative whole-number stock.');
      return;
    }

    if (invalidImageUrl) {
      setError('One or more product images are invalid.');
      return;
    }

    const data: ProductInput = {
      name: form.name.trim(),
      category: form.category.trim(),
      sku: form.sku.trim() || null,
      description: form.description.trim() || null,
      price,
      compareAtPrice: null, // Strictly 2 prices: Compare-at price removed
      cost,
      stock,
      variants: preferences.flatMap((preference) => preference.options),
      preferences,
      customFields: form.customFields.filter(f => f.label.trim() && f.value.trim()),
      imageUrl: imageUrls[0] || null,
      imageUrls,
      accent: form.accent,
    };

    const onSuccess = () => {
      void queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
      invalidateDashboardSummary(queryClient);
      onClose();
    };

    const onError = (mutationError: unknown) => setError(mutationError instanceof Error && mutationError.message ? mutationError.message : 'This item could not be saved. Try again.');

    product ? update.mutate({ id: product.id, data }, { onSuccess, onError }) : create.mutate({ data }, { onSuccess, onError });
  };

  return (
    <ReferenceProductEditor
      product={product}
      fullPage={fullPage}
      form={form}
      pending={pending}
      error={error}
      hasMutationError={create.isError || update.isError}
      onClose={onClose}
      onSubmit={save}
      change={change}
      setForm={setForm}
      updatePreference={updatePreference}
      updateCustomField={updateCustomField}
      imageError={imageError}
      onImageChange={handleImageChange}
      onRemoveImage={removeImage}
      onRemoveImageAt={removeImageAt}
      onSetPrimaryImage={setPrimaryImage}
    />
  );
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
    const onError = (mutationError: unknown) => setError(formatUserFacingError(mutationError, 'This expense could not be saved. Try again.'));
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
        onError: (error) => setActionError(formatUserFacingError(error, 'This expense could not be deleted. Try again.')),
      });
    }
  };
  return <Shell>
    <PageHeader
      title="Expenses"
      primaryAction={
        <Button onClick={() => setModal('new')} data-testid="button-new-expense" className="bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/90 text-white font-medium rounded-[8px] h-9 px-4 gap-1.5 inline-flex items-center text-[13px]">
          <Plus size={15} />Add expense
        </Button>
      }
      search={(query.data ?? []).length > 0 ? {
        value: search,
        onChange: setSearch,
        placeholder: "Search expenses...",
      } : undefined}
      filters={(query.data ?? []).length > 0 ? (
        <div className="relative inline-flex items-center">
          <select
            aria-label="Filter expenses by category"
            data-testid="select-filter-expenses"
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            className="h-[40px] min-h-[40px] appearance-none pl-3.5 pr-8 rounded-[10px] border border-[#E3E3EC] bg-white text-[13px] font-medium text-[#374151] dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200 outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/20 transition cursor-pointer select-none shadow-2xs"
          >
            <option value="all">All categories</option>
            {expenseCategories.map((item) => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
          </select>
          <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </div>
        </div>
      ) : undefined}
    />
    {query.isLoading ? (
      <ExpensesTableSkeleton />
    ) : query.isError ? (
      <div className="p-6"><ErrorState retry={() => query.refetch()} /></div>
    ) : !(query.data ?? []).length ? (
      <EmptyState
        card
        icon={Receipt}
        title="No operating expenses yet"
        description="Record rent, delivery, supplies, and other costs that keep your shop moving."
        action={
          <Button onClick={() => setModal('new')} data-testid="button-new-expense-empty">
            <Plus size={15} />Add your first expense
          </Button>
        }
      />
    ) : (
      <>
        {actionError && <div className="mb-4 rounded-[12px] border border-[hsl(var(--destructive))]/20 bg-[hsl(var(--destructive))]/5 px-4 py-3 text-xs text-[hsl(var(--destructive))]" role="alert" data-testid="status-expense-action-error">{actionError}</div>}
        <Card className="expenses-table-card overflow-hidden rounded-[12px] border border-[#E3E3EC] bg-white dark:border-neutral-800 dark:bg-neutral-900 shadow-none">
          <div className="expenses-table" role="table" aria-label="Expenses">
            <div className="expenses-table-head border-b border-[#E3E3EC] dark:border-neutral-800" role="row">
              <span role="columnheader">Expense</span>
              <span role="columnheader">Category</span>
              <span role="columnheader">Date</span>
              <span role="columnheader" className="is-numeric">Amount</span>
              <span role="columnheader" className="text-right">Actions</span>
            </div>
            {expenses.length ? (
              expenses.map((expense) => (
                <div key={expense.id} className="expenses-table-row border-b border-[#E8E8EE] dark:border-neutral-800/80 last:border-b-0 hover:bg-[#F9F9FC] dark:hover:bg-neutral-800/40 transition-colors" data-testid={`row-expense-${expense.id}`} role="row">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]">
                        <Receipt size={16} />
                      </div>
                      <div className="min-w-0">
                        <div
                          className="truncate text-[14px] font-medium text-[#111827] dark:text-neutral-100 whitespace-nowrap"
                          title={expense.note ? `${expense.title} · ${expense.note}` : expense.title}
                        >
                          {expense.title}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="expenses-table-cell text-[13.5px] text-[#6B7280] dark:text-neutral-400 whitespace-nowrap" data-label="Category">{expenseCategoryLabel(expense.category)}</div>
                  <div className="expenses-table-cell text-[13px] text-[#6B7280] dark:text-neutral-400 whitespace-nowrap" data-label="Date">{dateShort(expense.date)}</div>
                  <div className="expenses-table-cell expenses-table-amount text-right font-mono-ui font-medium text-[14px] text-[#111827] dark:text-neutral-100 whitespace-nowrap" data-label="Amount">{moneyExact(expense.amount)}</div>
                  <div className="flex justify-end">
                    <ExpenseActions expenseId={expense.id} expenseTitle={expense.title} onEdit={() => setModal(expense)} onDelete={() => remove(expense)} deleteDisabled={deleteExpense.isPending} />
                  </div>
                </div>
              ))
            ) : (
              <div className="py-12 px-6 text-center text-[#6B7280] dark:text-neutral-400">
                <p className="text-[14px] font-medium text-[#111827] dark:text-neutral-200">No matching expenses</p>
                <p className="text-[13px] mt-1 text-[#6B7280] dark:text-neutral-400">Try adjusting your search terms or category.</p>
              </div>
            )}
            {expenses.length > 0 && (
              <div className="border-t border-[#E8E8EE] dark:border-neutral-800 px-4 py-3 text-[13px] text-[#6B7280] dark:text-neutral-400 flex items-center justify-between">
                <span>{expenses.length} {expenses.length === 1 ? 'expense' : 'expenses'}</span>
              </div>
            )}
          </div>
        </Card>
      </>
    )}
    {modal && <ExpenseModal expense={modal === 'new' ? undefined : modal} onClose={() => setModal(null)} />}
  </Shell>;
}

function ExpensesTableSkeleton() {
  return (
    <Card className="expenses-table-card overflow-hidden rounded-[12px] border border-[#E3E3EC] bg-white dark:border-neutral-800 dark:bg-neutral-900 shadow-none" aria-label="Loading expenses">
      <div className="expenses-table" role="table">
        <div className="expenses-table-head border-b border-[#E3E3EC] dark:border-neutral-800" role="row">
          <span role="columnheader">Expense</span>
          <span role="columnheader">Category</span>
          <span role="columnheader">Date</span>
          <span role="columnheader" className="is-numeric">Amount</span>
          <span role="columnheader" className="text-right">Actions</span>
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="expenses-table-row border-b border-[#E8E8EE] dark:border-neutral-800/80 last:border-b-0 h-[56px]">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-[11px] bg-[#F4F4FA] dark:bg-neutral-800 animate-pulse shrink-0" />
              <div className="h-4 w-32 rounded-[8px] bg-[#F4F4FA] dark:bg-neutral-800 animate-pulse flex-1 min-w-0" />
            </div>
            <div><div className="h-4 w-20 rounded-[8px] bg-[#F4F4FA] dark:bg-neutral-800 animate-pulse" /></div>
            <div><div className="h-4 w-16 rounded-[8px] bg-[#F4F4FA] dark:bg-neutral-800 animate-pulse" /></div>
            <div className="flex justify-end"><div className="h-4 w-16 rounded-[8px] bg-[#F4F4FA] dark:bg-neutral-800 animate-pulse" /></div>
            <div className="flex justify-end"><div className="h-7 w-14 rounded-[8px] bg-[#F4F4FA] dark:bg-neutral-800 animate-pulse" /></div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function CatalogEditorRoute() {
  const params = useParams<{ id?: string }>();
  const query = useListProducts();
  const [, setLocation] = useLocation();
  const product = params.id ? (query.data ?? []).find((item) => item.id === Number(params.id)) : undefined;

  if (params.id && query.isLoading) {
    return (
      <Shell>
        <PageHeader
          breadcrumbs={
            <button
              type="button"
              onClick={() => setLocation('/catalog')}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition cursor-pointer"
            >
              <ArrowLeft size={13} />
              <span>Back to catalog</span>
            </button>
          }
          title="Edit item"
        />
        <div className="rounded-[12px] border border-[hsl(var(--card-border))] bg-white p-8">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="mt-4 h-10 w-full" />
          <Skeleton className="mt-4 h-32 w-full" />
        </div>
      </Shell>
    );
  }

  if (params.id && !product) {
    return (
      <Shell>
        <PageHeader
          breadcrumbs={
            <button
              type="button"
              onClick={() => setLocation('/catalog')}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition cursor-pointer"
            >
              <ArrowLeft size={13} />
              <span>Back to catalog</span>
            </button>
          }
          title="Edit item"
        />
        <ErrorState retry={() => query.refetch()} />
      </Shell>
    );
  }

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
      <img src={product.imageUrls?.[0] ?? product.imageUrl ?? productImageFor(product.name)} alt={product.name} />
      <div className="catalog-grid-actions"><CatalogActions productId={product.id} productName={product.name} onEdit={onEdit} onDelete={onDelete} deleteDisabled={deleteDisabled} /></div>
    </div>
    <div className="catalog-grid-details">
      <h3 title={product.name} className="text-[14px] font-medium leading-[20px] h-[40px] text-[#111827] dark:text-neutral-100 line-clamp-2 overflow-hidden text-ellipsis">
        {product.name}
      </h3>
      <div className="catalog-price-stock-row flex items-center justify-between mt-1 whitespace-nowrap">
        <strong className="text-[14px] font-semibold text-[#111827] dark:text-neutral-100 font-mono-ui whitespace-nowrap">{moneyExact(product.price)}</strong>
        <span className={cn('text-[13px] font-medium whitespace-nowrap', product.stock === 0 ? 'text-rose-600 font-semibold' : product.stock < 5 ? 'text-amber-600' : 'text-[#6B7280] dark:text-neutral-400')}>
          {product.stock === 0 ? 'Out of stock' : `${product.stock} in stock`}
        </span>
      </div>
    </div>
  </div>;
}

export const STOCK_FILTER_OPTIONS = [
  {
    value: 'all' as const,
    label: 'All stock',
    hint: 'Show all catalog items',
    icon: Package,
    iconClass: 'text-slate-500 dark:text-slate-400',
  },
  {
    value: 'low' as const,
    label: 'Low stock',
    hint: 'Fewer than 5 units left',
    icon: AlertTriangle,
    iconClass: 'text-amber-500 dark:text-amber-400',
  },
  {
    value: 'out' as const,
    label: 'Out of stock',
    hint: '0 units remaining',
    icon: PackageX,
    iconClass: 'text-rose-500 dark:text-rose-400',
  },
];

export function StockFilterPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const clearTimer = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const handleMouseEnter = () => {
    clearTimer();
    setOpen(true);
  };

  const handleMouseLeave = () => {
    clearTimer();
    timeoutRef.current = setTimeout(() => {
      setOpen(false);
    }, 200);
  };

  useEffect(() => {
    return () => clearTimer();
  }, []);

  const handleSelect = (newValue: string) => {
    clearTimer();
    setOpen(false);
    if (value !== newValue) {
      onChange(newValue);
    }
  };

  const activeOption = STOCK_FILTER_OPTIONS.find((opt) => opt.value === value) ?? STOCK_FILTER_OPTIONS[0];
  const ActiveIcon = activeOption.icon;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onPointerEnter={handleMouseEnter}
          onPointerLeave={handleMouseLeave}
          onMouseOver={handleMouseEnter}
          aria-label={`Filter by stock. Current: ${activeOption.label}`}
          title="Click or hover to view stock options"
          data-testid="select-filter-products-stock"
          onClick={(e) => {
            e.stopPropagation();
            setOpen((prev) => !prev);
          }}
          className="group/trigger relative inline-flex h-10 items-center justify-between gap-2 rounded-[10px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 text-xs sm:text-sm font-medium text-[hsl(var(--foreground))] outline-none hover:bg-[hsl(var(--muted))] focus-visible:border-[hsl(var(--ring))] focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))/0.2] transition-colors cursor-pointer select-none shrink-0"
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <ActiveIcon size={14} className={cn('shrink-0', activeOption.iconClass)} />
            <span className="truncate">{activeOption.label}</span>
          </div>
          <ChevronDown
            size={13}
            className={cn(
              'opacity-60 transition-transform duration-200 group-hover/trigger:opacity-100 shrink-0',
              open && 'rotate-180'
            )}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={6}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onPointerEnter={handleMouseEnter}
        onPointerLeave={handleMouseLeave}
        onMouseOver={handleMouseEnter}
        onClick={(e) => e.stopPropagation()}
        data-testid="card-stock-filter-picker"
        className="z-50 min-w-[155px] w-auto rounded-xl border border-slate-200/90 bg-white p-1 text-slate-900 shadow-lg dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 animate-in fade-in-0 zoom-in-95 duration-100"
      >
        <div className="space-y-0.5" role="menu" aria-label="Stock filter options">
          {STOCK_FILTER_OPTIONS.map((opt) => {
            const isSelected = value === opt.value;
            const Icon = opt.icon;
            return (
              <button
                key={opt.value}
                type="button"
                role="menuitem"
                title={opt.hint}
                data-testid={`option-stock-filter-${opt.value}`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelect(opt.value);
                }}
                className={cn(
                  'group/opt w-full flex items-center justify-between gap-3 px-2.5 py-1.5 rounded-lg text-xs font-medium text-left transition-colors cursor-pointer select-none outline-none',
                  isSelected
                    ? 'bg-slate-100 text-slate-900 font-semibold dark:bg-slate-800 dark:text-slate-100'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 dark:text-slate-300 dark:hover:text-slate-100 dark:hover:bg-slate-800/60'
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Icon size={14} className={cn('shrink-0', opt.iconClass)} />
                  <span className="truncate">{opt.label}</span>
                </div>
                {isSelected && (
                  <Check size={13} className="shrink-0 text-slate-900 dark:text-slate-100 stroke-[2.5]" />
                )}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Catalog() {
  const { userId } = useAppAuth();
  const entitlements = useEntitlements(userId);
  const query = useListProducts(); const deleteProduct = useDeleteProduct(); const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [stockFilter, setStockFilter] = useState(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      if (p.get('filter') === 'low-stock') return 'low';
    }
    return 'all';
  });
  const [missingCostsOnly, setMissingCostsOnly] = useState(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      return p.get('filter') === 'missing-costs';
    }
    return false;
  });
  const [view, setView] = useState<CatalogView>(readCatalogView);
  const [actionError, setActionError] = useState('');
  const allProducts = query.data ?? [];
  const products = useMemo(() => allProducts.filter((product) => {
    const textMatches = `${product.name} ${product.category} ${product.customFields.map((field) => `${field.label} ${field.value}`).join(' ')}`.toLowerCase().includes(search.trim().toLowerCase());
    const categoryMatches = categoryFilter === 'all' || product.category === categoryFilter;
    const stockMatches = stockFilter === 'all' || (stockFilter === 'in_stock' ? (product.stock ?? 0) >= 5 : stockFilter === 'low' ? (product.stock ?? 0) > 0 && (product.stock ?? 0) < 5 : (product.stock ?? 0) === 0);
    const costMatches = !missingCostsOnly || (product.cost == null || product.cost === 0);
    return textMatches && categoryMatches && stockMatches && costMatches;
  }), [allProducts, search, categoryFilter, stockFilter, missingCostsOnly]);

  const handleAddItem = () => {
    setLocation('/catalog/new');
  };

  const remove = (product: Product) => {
    if (window.confirm(`Delete ${product.name} from your catalog?`)) {
      setActionError('');
      deleteProduct.mutate({ id: product.id }, {
        onSuccess: () => {
          void queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
          invalidateDashboardSummary(queryClient);
        },
        onError: (error) => setActionError(formatUserFacingError(error, 'This item could not be deleted. Try again.')),
      });
    }
  };
  const inventoryValue = catalogValue(query.data ?? []);
  const totalStockUnits = (query.data ?? []).reduce((sum, product) => sum + Math.max(0, product.stock ?? 0), 0);
  const lowStock = (query.data ?? []).filter((product) => product.stock < 5).length;
  const categories = new Set((query.data ?? []).map((product) => product.category)).size;
  const catalogCategories = ['all', ...Array.from(new Set(allProducts.map((product) => product.category).filter(Boolean))).sort()];
  const catalogFilterCards = useMemo(() => [
    { id: 'all', label: 'All', count: allProducts.length, active: stockFilter === 'all', onClick: () => setStockFilter('all') },
    { id: 'in_stock', label: 'In stock', count: allProducts.filter((p) => (p.stock ?? 0) >= 5).length, active: stockFilter === 'in_stock', onClick: () => setStockFilter('in_stock') },
    { id: 'low', label: 'Low stock', count: allProducts.filter((p) => (p.stock ?? 0) > 0 && (p.stock ?? 0) < 5).length, active: stockFilter === 'low', onClick: () => setStockFilter('low') },
    { id: 'out', label: 'Out of stock', count: allProducts.filter((p) => (p.stock ?? 0) === 0).length, active: stockFilter === 'out', onClick: () => setStockFilter('out') },
  ], [allProducts, stockFilter]);

   useEffect(() => { writeCatalogView(view); }, [view]);
   return <Shell>
      <PageHeader
        title="Catalog"
        primaryAction={
          <Button onClick={handleAddItem} data-testid="button-new-product" className="bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/90 text-white font-medium rounded-[8px] h-9 px-4 gap-1.5 inline-flex items-center text-[13px]">
            <Plus size={15} />Add product
          </Button>
        }
        search={allProducts.length > 0 ? {
          value: search,
          onChange: setSearch,
          placeholder: "Search products...",
        } : undefined}
        filters={allProducts.length > 0 ? (
          <div className="flex items-center gap-3">
            <div className="relative inline-flex items-center">
              <select
                aria-label="Filter catalog by category"
                data-testid="select-filter-products-category"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="h-[40px] min-h-[40px] appearance-none pl-3.5 pr-8 rounded-[10px] border border-[#E3E3EC] bg-white text-[13px] font-medium text-[#374151] dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200 outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/20 transition cursor-pointer select-none shadow-2xs"
              >
                <option value="all">All categories</option>
                {catalogCategories.filter((c) => c !== 'all').map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </div>
            </div>
            <StockFilterPicker value={stockFilter} onChange={setStockFilter} />
            <SegmentedControl
              ariaLabel="Catalog view"
              value={view}
              onChange={(val) => setView(val as 'grid' | 'list')}
              size="default"
              options={[
                { value: 'grid', label: '', icon: <LayoutGrid size={15} /> },
                { value: 'list', label: '', icon: <List size={15} /> },
              ]}
            />
          </div>
        ) : undefined}
        filterCards={allProducts.length > 0 ? catalogFilterCards : undefined}
      />
      {query.isLoading ? (
        <CatalogLoadingSkeleton view={view} />
      ) : query.isError ? (
        <div className="p-6"><ErrorState retry={() => query.refetch()} /></div>
      ) : !allProducts.length ? (
        <EmptyState
          card
          icon={Package}
          title="Your catalog is waiting"
          description="Keep the products, prices, stock, and buyer choices you reuse most in one place."
          action={
            <Button onClick={handleAddItem} data-testid="button-new-product-empty">
              <Plus size={15} />Add your first product
            </Button>
          }
        />
      ) : (
        <>
          <div className="space-y-4">
            {actionError && <div className="rounded-[12px] border border-[hsl(var(--destructive))]/20 bg-[hsl(var(--destructive))]/5 px-4 py-3 text-xs text-[hsl(var(--destructive))]" role="alert" data-testid="status-catalog-action-error">{actionError}</div>}
            <Card className="catalog-workspace list-card overflow-hidden rounded-[12px] border border-[#E3E3EC] bg-white dark:border-neutral-800 dark:bg-neutral-900 shadow-none">
              {products.length ? (
                <div className={cn(view === 'grid' ? 'catalog-grid' : 'catalog-list')} role="list">
                  {view === 'list' && (
                    <div className="catalog-list-head border-b border-[#E3E3EC] dark:border-neutral-800" role="row">
                      <span role="columnheader">Product</span>
                      <span role="columnheader">SKU / Code</span>
                      <span role="columnheader">Category</span>
                      <span role="columnheader">Price</span>
                      <span role="columnheader">Stock</span>
                      <span role="columnheader" className="text-right">Actions</span>
                    </div>
                  )}
                  {products.map((product, index) => view === 'grid'
                    ? <CatalogGridCard key={product.id} product={product} animationDelay={`${index * 50}ms`} onEdit={() => setLocation(`/catalog/edit/${product.id}`)} onDelete={() => remove(product)} deleteDisabled={deleteProduct.isPending} />
                    : <div key={product.id} className="catalog-product-row border-b border-[#E8E8EE] dark:border-neutral-800/80 last:border-b-0 hover:bg-[#F9F9FC] dark:hover:bg-neutral-800/40 transition-colors rise-in" style={{ animationDelay: `${index * 50}ms` }} data-testid={`card-product-${product.id}`} role="listitem">
                      <div className="catalog-product-main min-w-0 flex items-center gap-3">
                        <div className="catalog-product-thumb rounded-[10px] overflow-hidden shrink-0">
                          <img src={product.imageUrls?.[0] ?? product.imageUrl ?? productImageFor(product.name)} alt="" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="truncate font-medium text-[14px] text-[#111827] dark:text-neutral-100 whitespace-nowrap" title={product.name}>{product.name}</h3>
                        </div>
                      </div>
                      <div className="catalog-sku min-w-0 text-[13px] font-mono-ui text-[#6B7280] dark:text-neutral-400 truncate whitespace-nowrap" title={product.sku || '—'}>{product.sku || '—'}</div>
                      <div className="catalog-category min-w-0 text-[13.5px] text-[#6B7280] dark:text-neutral-400 truncate whitespace-nowrap" title={product.category || '—'}>{product.category || '—'}</div>
                      <div className="catalog-number min-w-0">
                        <span className="font-mono-ui text-[14px] font-medium text-[#111827] dark:text-neutral-100 whitespace-nowrap" title={product.cost != null ? `Price: ${moneyExact(product.price)} · Cost: ${moneyExact(product.cost)}` : `Price: ${moneyExact(product.price)}`}>{moneyExact(product.price)}</span>
                      </div>
                      <div className="catalog-stock min-w-0">
                        <div className="inline-flex items-center gap-1.5 whitespace-nowrap">
                          <strong className={cn("font-mono-ui text-[13.5px]", product.stock < 5 && 'is-alert')}>{product.stock}</strong>
                          <span className={cn('catalog-stock-status text-[11.5px] px-2 py-0.5 rounded-full font-semibold whitespace-nowrap', product.stock === 0 ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300' : product.stock < 5 ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300')}>
                            {product.stock === 0 ? 'Out of stock' : product.stock < 5 ? 'Low stock' : 'In stock'}
                          </span>
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <CatalogActions productId={product.id} productName={product.name} onEdit={() => setLocation(`/catalog/edit/${product.id}`)} onDelete={() => remove(product)} deleteDisabled={deleteProduct.isPending} />
                      </div>
                    </div>)}
                </div>
              ) : (
                <div className="py-12 px-6 text-center text-[#6B7280] dark:text-neutral-400">
                  <p className="text-[14px] font-medium text-[#111827] dark:text-neutral-200">No matching products</p>
                  <p className="text-[13px] mt-1 text-[#6B7280] dark:text-neutral-400">Try adjusting your search terms or filter, or add a new product.</p>
                </div>
              )}
              {products.length > 0 && (
                <div className="border-t border-[#E8E8EE] dark:border-neutral-800 px-4 py-3 text-[13px] text-[#6B7280] dark:text-neutral-400 flex items-center justify-between">
                  <span>{products.length} {products.length === 1 ? 'product' : 'products'}</span>
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </Shell>;
}

function CatalogLoadingSkeleton({ view }: { view: CatalogView }) {
  if (view === 'grid') {
    return (
      <div className="catalog-grid grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 p-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="rounded-[12px] border border-[#E3E3EC] bg-white dark:border-neutral-800 dark:bg-neutral-900 p-3 space-y-3">
            <div className="aspect-square w-full rounded-[10px] bg-[#F4F4FA] dark:bg-neutral-800 animate-pulse" />
            <div className="h-4 w-3/4 rounded-[8px] bg-[#F4F4FA] dark:bg-neutral-800 animate-pulse" />
            <div className="h-4 w-1/2 rounded-[8px] bg-[#F4F4FA] dark:bg-neutral-800 animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <Card className="catalog-workspace list-card overflow-hidden rounded-[12px] border border-[#E3E3EC] bg-white dark:border-neutral-800 dark:bg-neutral-900 shadow-none" aria-label="Loading catalog">
      <div className="catalog-list" role="list">
        <div className="catalog-list-head border-b border-[#E3E3EC] dark:border-neutral-800" role="row">
          <span role="columnheader">Product</span>
          <span role="columnheader">SKU / Code</span>
          <span role="columnheader">Category</span>
          <span role="columnheader">Price</span>
          <span role="columnheader">Stock</span>
          <span role="columnheader" className="text-right">Actions</span>
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="catalog-product-row border-b border-[#E8E8EE] dark:border-neutral-800/80 last:border-b-0 h-[56px]">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-[10px] bg-[#F4F4FA] dark:bg-neutral-800 animate-pulse shrink-0" />
              <div className="h-4 w-32 rounded-[8px] bg-[#F4F4FA] dark:bg-neutral-800 animate-pulse" />
            </div>
            <div><div className="h-4 w-16 rounded-[8px] bg-[#F4F4FA] dark:bg-neutral-800 animate-pulse" /></div>
            <div><div className="h-4 w-20 rounded-[8px] bg-[#F4F4FA] dark:bg-neutral-800 animate-pulse" /></div>
            <div><div className="h-4 w-16 rounded-[8px] bg-[#F4F4FA] dark:bg-neutral-800 animate-pulse" /></div>
            <div><div className="h-6 w-20 rounded-full bg-[#F4F4FA] dark:bg-neutral-800 animate-pulse" /></div>
            <div className="flex justify-end"><div className="h-7 w-16 rounded-[8px] bg-[#F4F4FA] dark:bg-neutral-800 animate-pulse" /></div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function LegacyOrders() {
  const query = useListOrders(); const update = useUpdateOrder(); const [filter, setFilter] = useState('all'); const [search, setSearch] = useState(''); const queryClient = useQueryClient();
  const orders = useMemo(() => (query.data ?? []).filter((order) => (filter === 'all' || order.status === filter || order.fulfillment === filter) && `${order.customerName} ${order.productName} ${order.token}`.toLowerCase().includes(search.toLowerCase())), [query.data, filter, search]);
  const updateOrder = (order: Order, data: { status?: 'reserved' | 'deposit_paid' | 'paid'; fulfillment?: 'pending' | 'shipped' | 'delivered' }) => update.mutate({ id: order.id, data }, { onSuccess: () => { void queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() }); invalidateDashboardSummary(queryClient); } });
  const copyLink = async (token: string) => { await navigator.clipboard?.writeText(buildPublicOrderLink(token)); };
  return <Shell><PageHeading title="Orders" action={<Link href="/take-order"><Button><Plus size={16} />Take an order</Button></Link>} /><div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div className="relative max-w-[360px] flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" size={16} /><input data-testid="input-search-orders" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search orders" style={{ paddingLeft: '2.75rem' }} className="field-input text-sm whitespace-nowrap overflow-hidden text-ellipsis" /></div><div className="flex flex-wrap gap-2">{['all', 'reserved', 'deposit_paid', 'paid', 'shipped'].map((value) => <button key={value} onClick={() => setFilter(value)} aria-pressed={filter === value} data-testid={`button-filter-${value}`} className={cn('soft-focus rounded-full px-3.5 py-2 text-xs font-semibold capitalize transition-colors', filter === value ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] ring-2 ring-[hsl(var(--primary))] ring-offset-2 ring-offset-[hsl(var(--background))]' : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]')}>{value.replace('_', ' ')}</button>)}</div></div>{query.isLoading ? <Card className="space-y-5 p-6"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></Card> : query.isError ? <ErrorState retry={() => query.refetch()} /> : orders.length ? <Card className="overflow-hidden"><div className="hidden grid-cols-[1.45fr_.85fr_.7fr_.7fr_auto] gap-4 border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))]/50 px-6 py-3 text-xs font-semibold uppercase tracking-[.13em] text-[hsl(var(--muted-foreground))] md:grid"><span>Buyer</span><span>Payment</span><span>Fulfillment</span><span>Placed</span><span /></div>{orders.map((order) => <div key={order.id} className="grid gap-3 border-b border-[hsl(var(--border))] px-5 py-4 last:border-0 md:grid-cols-[1.45fr_.85fr_.7fr_.7fr_auto] md:items-center md:gap-4 md:px-6" data-testid={`row-orders-order-${order.id}`}><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[hsl(var(--muted))] font-mono-ui text-xs font-bold">{initials(order.customerName || order.productName)}</div><div><div className="text-[15px] font-semibold">{order.customerName || 'Buyer pending'}</div><div className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">{order.productName} · {channelName(order.channel)}</div></div></div><div className="flex items-center justify-between md:block"><span className="text-xs uppercase tracking-wider text-[hsl(var(--muted-foreground))] md:hidden">Payment</span><button data-testid={`button-payment-${order.id}`} onClick={() => updateOrder(order, { status: order.status === 'reserved' ? 'deposit_paid' : order.status === 'deposit_paid' ? 'paid' : 'reserved' })}><StatusPill tone={paymentTone(order.status)}>{order.status.replace('_', ' ')}</StatusPill></button></div><div className="flex items-center justify-between md:block"><span className="text-xs uppercase tracking-wider text-[hsl(var(--muted-foreground))] md:hidden">Delivery</span><FulfillmentPickerCell order={order} disabled={update.isPending} onUpdateFulfillment={(targetOrder, fulfillment) => updateOrder(targetOrder, { fulfillment })} /></div><div className="hidden font-mono-ui text-xs text-[hsl(var(--muted-foreground))] md:block">{dateShort(order.createdAt)}<div className="mt-1 text-sm font-bold text-[hsl(var(--foreground))]">{moneyExact(order.amount)}</div></div><div className="flex justify-end gap-1"><button type="button" onClick={() => copyLink(order.token)} aria-label="Copy buyer link" data-testid={`button-copy-link-${order.id}`} className="rounded-lg p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]" title="Copy buyer link"><Copy aria-hidden="true" size={15} /></button><Link href={`/o/${order.token}`} data-testid={`link-open-order-${order.id}`} aria-label="Open buyer preview" className="rounded-lg p-2 text-xs text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]"><ExternalLink aria-hidden="true" size={15} /></Link></div></div>)}</Card> : <EmptyState icon={ShoppingBag} title={search || filter !== 'all' ? 'No orders match' : 'Your order list is quiet'} description={search || filter !== 'all' ? 'Try another filter or search.' : 'When buyers use your links, their orders will show up here.'} />}</Shell>;
}

export const FULFILLMENT_OPTIONS = [
  {
    value: 'pending' as const,
    label: 'To ship',
    hint: 'Awaiting packing or courier dispatch',
    icon: Package,
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/40',
    iconClass: 'text-amber-600 dark:text-amber-400',
  },
  {
    value: 'shipped' as const,
    label: 'Shipped',
    hint: 'In transit with rider / delivery team',
    icon: Truck,
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200/80 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/40',
    iconClass: 'text-blue-600 dark:text-blue-400',
  },
  {
    value: 'delivered' as const,
    label: 'Delivered',
    hint: 'Confirmed delivery to customer',
    icon: CheckCircle2,
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40',
    iconClass: 'text-emerald-600 dark:text-emerald-400',
  },
];

export function FulfillmentPickerCell({
  order,
  disabled = false,
  onUpdateFulfillment,
  forceMount,
}: {
  order: Order;
  disabled?: boolean;
  onUpdateFulfillment: (order: Order, fulfillment: 'pending' | 'shipped' | 'delivered') => void;
  forceMount?: true;
}) {
  const [open, setOpen] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const clearTimer = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const handleMouseEnter = () => {
    clearTimer();
    setOpen(true);
  };

  const handleMouseLeave = () => {
    clearTimer();
    timeoutRef.current = setTimeout(() => {
      setOpen(false);
    }, 200);
  };

  useEffect(() => {
    return () => clearTimer();
  }, []);

  const handleSelect = (newFulfillment: 'pending' | 'shipped' | 'delivered') => {
    clearTimer();
    setOpen(false);
    if (order.fulfillment !== newFulfillment) {
      onUpdateFulfillment(order, newFulfillment);
    }
  };

  const currentLabel = order.fulfillment === 'pending' ? 'To ship' : order.fulfillment === 'shipped' ? 'Shipped' : 'Delivered';
  const currentTone = order.fulfillment === 'delivered' ? 'mint' : order.fulfillment === 'shipped' ? 'blue' : 'neutral';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onPointerEnter={handleMouseEnter}
          onPointerLeave={handleMouseLeave}
          onMouseOver={handleMouseEnter}
          aria-label={`Change fulfillment status for order ${order.id}. Current: ${currentLabel}`}
          title="Hover to view fulfillment options"
          data-testid={`button-fulfillment-${order.id}`}
          onClick={(e) => {
            e.stopPropagation();
            setOpen((prev) => !prev);
          }}
          className="group/trigger relative inline-flex items-center outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 rounded-full cursor-pointer transition-transform active:scale-95"
        >
          <StatusPill tone={currentTone}>
            <span>{currentLabel}</span>
            <ChevronDown
              size={11}
              className={cn(
                'ml-0.5 opacity-60 transition-transform duration-200 group-hover/trigger:opacity-100',
                open && 'rotate-180'
              )}
            />
          </StatusPill>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="bottom"
        sideOffset={6}
        forceMount={forceMount}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onPointerEnter={handleMouseEnter}
        onPointerLeave={handleMouseLeave}
        onMouseOver={handleMouseEnter}
        onClick={(e) => e.stopPropagation()}
        data-testid={`card-fulfillment-picker-${order.id}`}
        className="z-50 min-w-[150px] w-auto rounded-xl border border-slate-200/90 bg-white p-1 text-slate-900 shadow-lg dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 animate-in fade-in-0 zoom-in-95 duration-100"
      >
        <div className="space-y-0.5" role="menu" aria-label="Fulfillment options">
          {FULFILLMENT_OPTIONS.map((opt) => {
            const isSelected = order.fulfillment === opt.value;
            const Icon = opt.icon;
            return (
              <button
                key={opt.value}
                type="button"
                role="menuitem"
                disabled={disabled}
                title={opt.hint}
                data-testid={`option-fulfillment-${order.id}-${opt.value}`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelect(opt.value);
                }}
                className={cn(
                  'group/opt w-full flex items-center justify-between gap-3 px-2.5 py-1.5 rounded-lg text-xs font-medium text-left transition-colors cursor-pointer select-none outline-none',
                  isSelected
                    ? 'bg-slate-100 text-slate-900 font-semibold dark:bg-slate-800 dark:text-slate-100'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 dark:text-slate-300 dark:hover:text-slate-100 dark:hover:bg-slate-800/60'
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Icon size={14} className={cn('shrink-0', opt.iconClass)} />
                  <span className="truncate">{opt.label}</span>
                </div>
                {isSelected && (
                  <Check size={13} className="shrink-0 text-slate-900 dark:text-slate-100 stroke-[2.5]" />
                )}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Orders() {
  const [location, setLocation] = useLocation();
  const query = useListOrders();
  const update = useUpdateOrder();
  const queryClient = useQueryClient();
  const [activeFilter, setActiveFilter] = useState(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      const f = p.get('filter') || p.get('fulfillment') || p.get('status');
      if (f) return f;
    }
    return 'all';
  });
  const [search, setSearch] = useState(() => new URLSearchParams(window.location.search).get('customer') ?? '');
  const [mutationError, setMutationError] = useState('');
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const c = p.get('customer');
    if (c !== null) setSearch(c);
    const f = p.get('filter') || p.get('fulfillment') || p.get('status');
    if (f) setActiveFilter(f);
  }, [location]);
  const allOrders = query.data ?? [];
  const orders = useMemo(() => allOrders.filter((order) => {
    let matchesFilter = true;
    if (activeFilter === 'to_ship' || activeFilter === 'pending') {
      matchesFilter = order.fulfillment === 'pending';
    } else if (activeFilter === 'shipped') {
      matchesFilter = order.fulfillment === 'shipped';
    } else if (activeFilter === 'delivered') {
      matchesFilter = order.fulfillment === 'delivered';
    } else if (activeFilter === 'paid') {
      matchesFilter = order.status === 'paid';
    } else if (activeFilter === 'deposit_paid' || activeFilter === 'deposit') {
      matchesFilter = order.status === 'deposit_paid';
    } else if (activeFilter === 'reserved') {
      matchesFilter = order.status === 'reserved';
    } else if (activeFilter === 'unpaid') {
      matchesFilter = order.status !== 'paid';
    }
    const haystack = `${order.customerName} ${order.productName} ${order.token} ${order.customerPhone ?? ''}`.toLowerCase();
    return matchesFilter && haystack.includes(search.trim().toLowerCase());
  }), [allOrders, activeFilter, search]);
  const collectedFor = (order: Order) => order.status === 'paid' ? order.amount : order.status === 'deposit_paid' ? (order.depositAmount ?? 0) : 0;
  const updateOrder = (order: Order, data: { status?: 'reserved' | 'deposit_paid' | 'paid'; fulfillment?: 'pending' | 'shipped' | 'delivered' }) => {
    setMutationError('');
    update.mutate({ id: order.id, data }, {
      onSuccess: () => { void queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() }); invalidateDashboardSummary(queryClient); },
      onError: (error) => setMutationError(formatUserFacingError(error, 'That order update could not be saved. Try again.')),
    });
  };
  const orderFilterOptions = useMemo(() => [
    { value: 'all', label: 'All', count: allOrders.length },
    { value: 'to_ship', label: 'To ship', count: allOrders.filter((o) => o.fulfillment === 'pending').length },
    { value: 'paid', label: 'Paid', count: allOrders.filter((o) => o.status === 'paid').length },
    { value: 'deposit_paid', label: 'Deposit', count: allOrders.filter((o) => o.status === 'deposit_paid').length },
    { value: 'reserved', label: 'Reserved', count: allOrders.filter((o) => o.status === 'reserved').length },
    { value: 'shipped', label: 'Shipped', count: allOrders.filter((o) => o.fulfillment === 'shipped').length },
    { value: 'delivered', label: 'Delivered', count: allOrders.filter((o) => o.fulfillment === 'delivered').length },
  ], [allOrders]);
  const orderFilterCards = useMemo(() => orderFilterOptions.map((opt) => ({
    id: opt.value,
    label: opt.label,
    count: opt.count,
    active: activeFilter === opt.value || (opt.value === 'to_ship' && activeFilter === 'pending'),
    onClick: () => setActiveFilter(opt.value),
  })), [orderFilterOptions, activeFilter]);
  const fulfillmentLabel = (value: Order['fulfillment']) => value === 'pending' ? 'To ship' : value;
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  const handleExport = async () => {
    if (orders.length === 0) return;
    setIsExporting(true);
    try {
      const csv = generateOrdersCsv(orders, currencySymbol());
      const dateStr = new Date().toISOString().split('T')[0];
      downloadCsvFile(`orders-${dateStr}.csv`, csv);
      toast({
        title: 'Export complete',
        description: `Exported ${orders.length} ${orders.length === 1 ? 'order' : 'orders'} to CSV.`,
      });
    } catch (err) {
      toast({
        title: 'Export failed',
        description: 'Could not generate CSV export. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const orderColumns: DataTableColumn<Order>[] = useMemo(() => [
    {
      id: 'id',
      header: 'Order ID',
      cell: (order) => (
        <Link
          href={`/orders/${order.id}`}
          className="orders-order-id orders-order-id-link text-[13.5px] font-mono-ui font-medium text-[#111827] hover:text-[hsl(var(--primary))] dark:text-neutral-200 whitespace-nowrap"
          data-testid={`link-order-${order.id}`}
          aria-label={`Open order ${order.id}`}
        >
          #{String(order.id).padStart(7, '0')}
        </Link>
      ),
    },
    {
      id: 'customer',
      header: 'Customer',
      cell: (order) => {
        const isAwaiting = !order.customerPhone && (!order.customerName || order.customerName.toLowerCase() === 'waiting for buyer' || order.customerName.toLowerCase() === 'buyer pending');
        return (
          <span
            className={cn('text-[14px] whitespace-nowrap', isAwaiting ? 'italic text-[#9CA3AF] font-normal' : 'font-medium text-[#111827] dark:text-neutral-100')}
            title={isAwaiting ? 'Awaiting buyer' : order.customerName}
          >
            {isAwaiting ? 'Awaiting' : order.customerName}
          </span>
        );
      },
    },
    {
      id: 'traffic',
      header: 'Traffic',
      align: 'center',
      cell: (order) => (
        <span
          className="orders-traffic-icon inline-flex justify-center"
          data-testid={`text-order-traffic-${order.id}`}
          title={channelName(order.channel)}
          aria-label={`Traffic source: ${channelName(order.channel)}`}
        >
          <ChannelMark value={order.channel} size={17} />
        </span>
      ),
    },
    {
      id: 'amount',
      header: 'Order value',
      cell: (order) => (
        <span className="font-mono-ui text-[14px] font-medium text-[#111827] dark:text-neutral-100 whitespace-nowrap">
          {moneyExact(order.amount)}
        </span>
      ),
    },
    {
      id: 'collected',
      header: 'Collected',
      cell: (order) => (
        <span className="font-mono-ui text-[13.5px] text-[#6B7280] dark:text-neutral-400 whitespace-nowrap">
          {moneyExact(collectedFor(order))}
        </span>
      ),
    },
    {
      id: 'payment',
      header: 'Payment',
      cell: (order) => (
        <button
          type="button"
          disabled={update.isPending}
          aria-label={`Advance payment status for ${order.customerName || order.productName}`}
          title="Advance payment status"
          data-testid={`button-payment-${order.id}`}
          className="whitespace-nowrap cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            const status: 'reserved' | 'deposit_paid' | 'paid' =
              order.status === 'reserved'
                ? 'deposit_paid'
                : order.status === 'deposit_paid'
                ? 'paid'
                : 'reserved';
            updateOrder(order, { status });
          }}
        >
          <StatusPill tone={order.status === 'paid' ? 'mint' : order.status === 'deposit_paid' ? 'gold' : 'neutral'}>
            {paymentLabel(order)}
          </StatusPill>
        </button>
      ),
    },
    {
      id: 'fulfillment',
      header: 'Fulfillment',
      cell: (order) => (
        <div onClick={(e) => e.stopPropagation()} className="whitespace-nowrap">
          <FulfillmentPickerCell
            order={order}
            disabled={update.isPending}
            onUpdateFulfillment={(targetOrder, fulfillment) => updateOrder(targetOrder, { fulfillment })}
          />
        </div>
      ),
    },
    {
      id: 'date',
      header: 'Date',
      align: 'right',
      cell: (order) => (
        <span className="font-mono-ui text-[13px] text-[#6B7280] dark:text-neutral-400 whitespace-nowrap">
          {dateFull(order.createdAt)}
        </span>
      ),
    },
  ], [update.isPending]);

  return <Shell>
    <PageHeader
      title="Orders"
      primaryAction={
        <Link href="/take-order" data-testid="link-take-order-orders">
          <Button className="bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/90 text-white font-medium rounded-[8px] h-9 px-4 gap-1.5 inline-flex items-center text-[13px]">
            <Plus size={15} />Take an order
          </Button>
        </Link>
      }
      search={allOrders.length > 0 ? {
        value: search,
        onChange: setSearch,
        placeholder: "Search orders or clients...",
      } : undefined}
      filterCards={allOrders.length > 0 ? orderFilterCards : undefined}
      filterBarActions={allOrders.length > 0 ? (
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Button
            type="button"
            variant="outline"
            disabled={orders.length === 0 || isExporting}
            onClick={handleExport}
            className="flex-1 md:flex-initial h-10 px-3.5 rounded-[10px] border border-[#E3E3EC] bg-white text-[13px] font-medium text-[#111827] hover:bg-[#F9F9FC] dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800 shadow-none gap-2 inline-flex items-center justify-center min-h-[44px] md:min-h-[40px] cursor-pointer"
            data-testid="button-orders-export"
          >
            {isExporting ? <Loader2 size={15} className="animate-spin text-[#6B7280]" /> : <Download size={15} className="text-[#6B7280] dark:text-neutral-400" />}
            <span>Export</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsSummaryOpen(true)}
            className="flex-1 md:flex-initial h-10 px-3.5 rounded-[10px] border border-[#E3E3EC] bg-white text-[13px] font-medium text-[#111827] hover:bg-[#F9F9FC] dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800 shadow-none gap-2 inline-flex items-center justify-center min-h-[44px] md:min-h-[40px] cursor-pointer"
            data-testid="button-orders-summary"
          >
            <BarChart3 size={15} className="text-[#6B7280] dark:text-neutral-400" />
            <span>Summary</span>
          </Button>
        </div>
      ) : undefined}
    />
    {query.isLoading ? (
      <OrdersTableSkeleton />
    ) : query.isError ? (
      <div className="p-5 sm:p-6"><ErrorState retry={() => query.refetch()} /></div>
    ) : !allOrders.length ? (
      <EmptyState
        card
        icon={ShoppingBag}
        title="Your order list is quiet"
        description="When buyers use your links, their orders and payment status will show up here."
        action={
          <Link href="/take-order" data-testid="link-create-first-order">
            <Button><Plus size={15} />Create an order link</Button>
          </Link>
        }
      />
    ) : (
      <>
        <section className="space-y-4">
          {mutationError && <div className="rounded-[12px] border border-[hsl(var(--destructive))]/20 bg-[hsl(var(--destructive))]/5 px-4 py-3 text-xs text-[hsl(var(--destructive))]" role="alert" data-testid="status-order-action-error">{mutationError}</div>}
          <DataTable<Order>
            columns={orderColumns}
            data={orders}
            keyExtractor={(order) => order.id}
            onRowClick={(order) => setLocation(`/orders/${order.id}`)}
            rowAriaLabel={(order) => `Open order ${order.id} details`}
            rowTestId={(order) => `row-orders-order-${order.id}`}
            ariaLabel="Orders"
            itemCountNoun="links"
            emptyState={{
              isFiltered: true,
              noResultsTitle: 'No matching orders',
              noResultsMessage: 'Try adjusting your search terms or filter.',
            }}
          />
        </section>
        <OrderSummaryDrawer
          isOpen={isSummaryOpen}
          onClose={() => setIsSummaryOpen(false)}
          orders={orders}
          currencySymbol={currencySymbol()}
          activeFilterLabel={orderFilterOptions.find((o) => o.value === activeFilter)?.label || 'All'}
          searchQuery={search}
        />
      </>
    )}
  </Shell>;
}

function OrdersTableSkeleton() {
  return (
    <Card className="orders-table-card overflow-hidden rounded-[12px] border border-[#E3E3EC] bg-white dark:border-neutral-800 dark:bg-neutral-900 shadow-none" aria-label="Loading orders">
      <div className="overflow-x-auto w-full scrollbar-thin">
        <table className="w-full text-left border-collapse" style={{ minWidth: '100%', width: 'max-content' }}>
          <thead>
            <tr className="border-b border-[#E3E3EC] bg-[#F0F0F8] dark:border-neutral-800 dark:bg-neutral-800/80 h-[48px]">
              <th className="px-4 py-3 text-[14px] font-semibold text-[#111827] dark:text-neutral-100 normal-case whitespace-nowrap">Order ID</th>
              <th className="px-4 py-3 text-[14px] font-semibold text-[#111827] dark:text-neutral-100 normal-case whitespace-nowrap">Customer</th>
              <th className="px-4 py-3 text-[14px] font-semibold text-[#111827] dark:text-neutral-100 normal-case whitespace-nowrap text-center">Traffic</th>
              <th className="px-4 py-3 text-[14px] font-semibold text-[#111827] dark:text-neutral-100 normal-case whitespace-nowrap">Order value</th>
              <th className="px-4 py-3 text-[14px] font-semibold text-[#111827] dark:text-neutral-100 normal-case whitespace-nowrap">Collected</th>
              <th className="px-4 py-3 text-[14px] font-semibold text-[#111827] dark:text-neutral-100 normal-case whitespace-nowrap">Payment</th>
              <th className="px-4 py-3 text-[14px] font-semibold text-[#111827] dark:text-neutral-100 normal-case whitespace-nowrap">Fulfillment</th>
              <th className="px-4 py-3 text-[14px] font-semibold text-[#111827] dark:text-neutral-100 normal-case whitespace-nowrap text-right">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E8E8EE] dark:divide-neutral-800/80">
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="h-[56px]">
                <td className="px-4 py-3.5"><div className="h-4 w-16 rounded-[8px] bg-[#F4F4FA] dark:bg-neutral-800 animate-pulse" /></td>
                <td className="px-4 py-3.5"><div className="h-4 w-28 rounded-[8px] bg-[#F4F4FA] dark:bg-neutral-800 animate-pulse" /></td>
                <td className="px-4 py-3.5"><div className="flex justify-center"><div className="h-7 w-7 rounded-[8px] bg-[#F4F4FA] dark:bg-neutral-800 animate-pulse" /></div></td>
                <td className="px-4 py-3.5"><div className="h-4 w-16 rounded-[8px] bg-[#F4F4FA] dark:bg-neutral-800 animate-pulse" /></td>
                <td className="px-4 py-3.5"><div className="h-4 w-16 rounded-[8px] bg-[#F4F4FA] dark:bg-neutral-800 animate-pulse" /></td>
                <td className="px-4 py-3.5"><div className="h-6 w-20 rounded-full bg-[#F4F4FA] dark:bg-neutral-800 animate-pulse" /></td>
                <td className="px-4 py-3.5"><div className="h-7 w-20 rounded-[8px] bg-[#F4F4FA] dark:bg-neutral-800 animate-pulse" /></td>
                <td className="px-4 py-3.5"><div className="flex justify-end"><div className="h-4 w-20 rounded-[8px] bg-[#F4F4FA] dark:bg-neutral-800 animate-pulse" /></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
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
      const isPlaceholder = !name || name.toLowerCase() === 'waiting for buyer' || name.toLowerCase() === 'buyer pending' || name.toLowerCase() === 'awaiting buyer';
      if (!phone && isPlaceholder) {
        // Exclude uncompleted/no-identity orders from the Clients directory entirely!
        return;
      }
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
  const clientFilterCards = useMemo(() => clientFilters.map((f) => ({
    id: f.value,
    label: f.label,
    count: f.count,
    active: clientFilter === f.value,
    onClick: () => setClientFilter(f.value),
  })), [clientFilters, clientFilter]);

  return <Shell>
    <PageHeader
      title="Clients"
      search={clients.length > 0 ? {
        value: search,
        onChange: setSearch,
        placeholder: "Search clients...",
      } : undefined}
      filterCards={clients.length > 0 ? clientFilterCards : undefined}
    />
    {query.isLoading ? <ClientsSkeleton /> : query.isError ? <ErrorState retry={() => query.refetch()} /> : !clients.length ? <EmptyState card icon={Users} title="Your client list starts with an order" description="When a buyer shares their details, Take Order will keep their purchase history together here." action={<Link href="/take-order" data-testid="link-clients-empty-order"><Button className="bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/90 text-white font-medium rounded-[8px] h-9 px-4 gap-1.5 inline-flex items-center text-[13px]"><Plus size={15} />Take an order</Button></Link>} /> : <>
       <section className="clients-list-section space-y-4">
         <Card className="clients-table-card overflow-hidden rounded-[12px] border border-[#E3E3EC] bg-white dark:border-neutral-800 dark:bg-neutral-900 shadow-none">
           <div className="clients-table-wrap" role="table" aria-label="Clients">
             <div className="clients-table-head border-b border-[#E3E3EC] dark:border-neutral-800" role="row">
               <span role="columnheader">Customer</span>
               <span role="columnheader">Phone</span>
               <span role="columnheader" className="is-numeric">Orders</span>
               <span role="columnheader" className="is-numeric">Collected</span>
               <span role="columnheader" className="is-numeric">Balance due</span>
               <span role="columnheader" className="is-numeric">Last purchase</span>
               <span role="columnheader" className="text-right">Details</span>
             </div>
             {filteredClients.length ? (
               filteredClients.map((client) => (
                 <div
                   key={client.key}
                   className="clients-table-row border-b border-[#E8E8EE] dark:border-neutral-800/80 last:border-b-0 hover:bg-[#F9F9FC] dark:hover:bg-neutral-800/40 transition-colors"
                   role="row"
                   data-testid={`row-client-${client.key.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`}
                 >
                   <div className="clients-buyer-cell min-w-0">
                     <div className="truncate text-[14px] font-medium text-[#111827] dark:text-neutral-100 whitespace-nowrap" data-testid={`text-client-name-${client.key}`} title={client.displayName}>
                       {client.displayName}
                     </div>
                   </div>
                   <div className="clients-cell-labeled clients-phone-cell">
                     <span className="clients-mobile-label">Phone</span>
                     <span className="inline-flex items-center gap-1.5 text-[13.5px] text-[#6B7280] dark:text-neutral-400">
                       <span>{client.phone || '—'}</span>
                       {client.phone && (
                         <button
                           type="button"
                           className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-50 text-[#25D366] hover:bg-emerald-100 transition-colors cursor-pointer"
                           title={`Open WhatsApp chat with ${client.displayName}`}
                           aria-label={`Open WhatsApp chat with ${client.displayName}`}
                           onClick={() => openWhatsApp(client.phone, `Hi ${client.displayName}!`)}
                         >
                           <SiWhatsapp size={13} />
                         </button>
                       )}
                     </span>
                   </div>
                   <div className="clients-cell-labeled clients-numeric-cell text-right">
                     <span className="clients-mobile-label">Orders</span>
                     <span className="font-mono-ui text-[14px] font-medium text-[#111827] dark:text-neutral-100">{client.orderCount}</span>
                   </div>
                   <div className="clients-cell-labeled clients-numeric-cell text-right">
                     <span className="clients-mobile-label">Collected</span>
                     <span className="font-mono-ui text-[14px] font-medium text-[#111827] dark:text-neutral-100">{moneyExact(client.collected)}</span>
                   </div>
                   <div className="clients-cell-labeled clients-numeric-cell text-right">
                     <span className="clients-mobile-label">Balance due</span>
                     <span className="font-mono-ui text-[14px] font-medium text-[#111827] dark:text-neutral-100">{client.outstanding ? moneyExact(client.outstanding) : '—'}</span>
                   </div>
                   <div className="clients-cell-labeled clients-numeric-cell text-right">
                     <span className="clients-mobile-label">Last purchase</span>
                     <span className="font-mono-ui text-[13px] text-[#6B7280] dark:text-neutral-400">{dateShort(client.latestPurchase)}</span>
                   </div>
                   <div className="clients-actions flex items-center justify-end gap-2">
                     {client.outstanding > 0 && client.phone && (
                       <button
                         type="button"
                         className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100 transition-colors cursor-pointer"
                         title="Send balance reminder on WhatsApp"
                         onClick={() => {
                           const profile = readSellerProfile();
                           const msg = buildClientBalanceReminderMessage({
                             clientName: client.displayName,
                             balanceDue: client.outstanding,
                             shopName: profile?.businessName || 'our shop',
                             currencySymbol: currencySymbol(),
                           });
                           openWhatsApp(client.phone, msg);
                         }}
                       >
                         <MessageSquare size={12} />
                         <span>Remind</span>
                       </button>
                     )}
                     <Link href={`/clients/${encodeURIComponent(client.key)}`} data-testid={`link-view-client-${client.key}`} className="clients-view-link text-[13px] font-medium">
                       <span>View</span>
                       <ArrowRight size={13} />
                     </Link>
                   </div>
                 </div>
               ))
             ) : (
               <div className="py-12 px-6 text-center text-[#6B7280] dark:text-neutral-400">
                 <p className="text-[14px] font-medium text-[#111827] dark:text-neutral-200">No matching clients</p>
                 <p className="text-[13px] mt-1 text-[#6B7280] dark:text-neutral-400">Try adjusting your search terms or filter.</p>
               </div>
             )}
             {filteredClients.length > 0 && (
               <div className="border-t border-[#E8E8EE] dark:border-neutral-800 px-4 py-3 text-[13px] text-[#6B7280] dark:text-neutral-400 flex items-center justify-between">
                 <span>{filteredClients.length} {filteredClients.length === 1 ? 'client' : 'clients'}</span>
               </div>
             )}
           </div>
         </Card>
       </section>
    </>}
  </Shell>;
}

function ClientsSkeleton() {
  return (
    <div className="space-y-6" aria-label="Loading clients">
      <div className="clients-overview">
        {Array.from({ length: 4 }, (_, index) => (
          <Card key={index} className="h-[176px] p-6 sm:p-7 flex flex-col justify-between rounded-[12px] border border-[#E3E3EC] bg-white dark:border-neutral-800 dark:bg-neutral-900 shadow-none">
            <Skeleton className="h-4 w-24 rounded-[8px]" />
            <Skeleton className="h-10 w-16 rounded-[8px]" />
            <Skeleton className="h-4 w-32 rounded-[8px]" />
          </Card>
        ))}
      </div>
      <Card className="clients-table-card overflow-hidden rounded-[12px] border border-[#E3E3EC] bg-white dark:border-neutral-800 dark:bg-neutral-900 shadow-none">
        <div className="clients-table-wrap" role="table">
          <div className="clients-table-head border-b border-[#E3E3EC] dark:border-neutral-800" role="row">
            <span role="columnheader">Customer</span>
            <span role="columnheader">Phone</span>
            <span role="columnheader" className="is-numeric">Orders</span>
            <span role="columnheader" className="is-numeric">Collected</span>
            <span role="columnheader" className="is-numeric">Balance due</span>
            <span role="columnheader" className="is-numeric">Last purchase</span>
            <span role="columnheader" className="text-right">Details</span>
          </div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="clients-table-row border-b border-[#E8E8EE] dark:border-neutral-800/80 last:border-b-0 h-[56px]">
              <div>
                <div className="h-4 w-28 rounded-[8px] bg-[#F4F4FA] dark:bg-neutral-800 animate-pulse" />
              </div>
              <div><div className="h-4 w-24 rounded-[8px] bg-[#F4F4FA] dark:bg-neutral-800 animate-pulse" /></div>
              <div className="flex justify-end"><div className="h-4 w-10 rounded-[8px] bg-[#F4F4FA] dark:bg-neutral-800 animate-pulse" /></div>
              <div className="flex justify-end"><div className="h-4 w-16 rounded-[8px] bg-[#F4F4FA] dark:bg-neutral-800 animate-pulse" /></div>
              <div className="flex justify-end"><div className="h-4 w-16 rounded-[8px] bg-[#F4F4FA] dark:bg-neutral-800 animate-pulse" /></div>
              <div className="flex justify-end"><div className="h-4 w-16 rounded-[8px] bg-[#F4F4FA] dark:bg-neutral-800 animate-pulse" /></div>
              <div className="flex justify-end"><div className="h-7 w-16 rounded-[8px] bg-[#F4F4FA] dark:bg-neutral-800 animate-pulse" /></div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
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
     channel: '' as OrderInput['channel'] | '',
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
     : Boolean(form.amount) && Number(form.amount) >= 0 && Boolean(form.channel) && (form.paymentMode !== 'deposit' || (Boolean(form.depositAmount) && Number(form.depositAmount) <= Number(form.amount)));
  const createLink = (productId: number) => {
    const data: OrderInput = {
      productId,
      amount: Number(form.amount),
      paymentMode: form.paymentMode,
      depositAmount: form.paymentMode === 'deposit' ? Number(form.depositAmount) : null,
       channel: form.channel as OrderInput['channel'],
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
  const link = created ? buildPublicOrderLink(created.token) : '';
  const copy = async () => {
    await navigator.clipboard?.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  const reset = () => {
    setCreated(null);
    setStep(1);
    setPath('catalog');
     setForm({ productId: '', customName: '', amount: '', paymentMode: 'full', depositAmount: '', channel: '' });
  };

  if (created) {
    return <Shell><div className="mx-auto max-w-[620px] page-in">
      <div className="mb-8 flex h-16 w-16 items-center justify-center rounded-[20px] bg-[hsl(var(--accent))] text-white"><Check size={30} /></div>
      <div className="font-mono-ui text-xs font-semibold uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">Link is ready</div>
      <h1 className="mt-2 font-display text-[clamp(34px,5vw,56px)] font-bold leading-none tracking-[-.06em]">Send it their way.</h1>
      <p className="mt-4 max-w-[480px] text-base leading-relaxed text-[hsl(var(--muted-foreground))]">Your {created.productName} link is live. Share it in the same place you started the conversation.</p>
      <Card className="mt-8 p-5"><div className="text-xs font-bold uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">Buyer link</div><div className="mt-3 flex items-center gap-3 rounded-[10px] bg-[hsl(var(--muted))] p-3"><Link2 size={16} className="shrink-0 text-[hsl(var(--muted-foreground))]" /><span className="min-w-0 flex-1 truncate font-mono-ui text-sm">{link}</span><Button onClick={copy} variant="soft" data-testid="button-copy-created-link">{copied ? <Check size={15} /> : <Copy size={15} />}{copied ? 'Copied' : 'Copy'}</Button></div></Card>
      <div className="mt-6 flex flex-wrap gap-3"><Link href={`/o/${created.token}`} data-testid="link-preview-created-order"><Button variant="outline"><ExternalLink size={15} />Preview buyer page</Button></Link><Button onClick={reset} variant="ghost">Create another</Button></div>
    </div></Shell>;
  }

  return <Shell><PageHeading title="Take an order" />
    <div className="mb-6 flex items-center gap-2 overflow-x-auto pb-1">
      {(['Item', 'Payment', 'Preview'] as const).map((label, index) => { const number = index + 1; return <button key={label} type="button" onClick={() => number < step && setStep(number as TakeOrderStep)} className={cn('flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-sm font-semibold', step === number ? 'bg-[hsl(var(--primary))] text-white' : step > number ? 'bg-[hsl(var(--accent))]/15 text-[hsl(var(--accent-foreground))]' : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]')}><span className="font-mono-ui text-xs">{number}</span>{label}</button>; })}
    </div>
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <Card className="p-6 sm:p-8"><form onSubmit={submit} className="space-y-6">
        {step === 1 && <div className="page-in space-y-6">
          <div><div className="field-label">What are they buying?</div><p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">Use an existing catalog item or create the lightweight item you already agreed in chat.</p></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={() => setPath('catalog')} className={cn('rounded-[14px] border p-4 text-left', path === 'catalog' ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/[.06]' : 'border-[hsl(var(--border))]')}><Boxes size={18} className="text-[hsl(var(--primary))]" /><div className="mt-3 text-base font-semibold">Catalog item</div><div className="mt-1 text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">Pick something already in your catalog.</div></button>
            <button type="button" onClick={() => setPath('custom')} className={cn('rounded-[14px] border p-4 text-left', path === 'custom' ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/[.06]' : 'border-[hsl(var(--border))]')}><Sparkles size={18} className="text-[hsl(var(--primary))]" /><div className="mt-3 text-base font-semibold">New item from chat</div><div className="mt-1 text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">Create just the name and price now.</div></button>
          </div>
          {path === 'catalog' ? <div>{productsQuery.isLoading ? <Skeleton className="h-11 w-full" /> : <select data-testid="select-order-product" required value={form.productId} onChange={(event) => chooseProduct(event.target.value)} className="field-input"><option value="">Choose from catalog</option>{(productsQuery.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.name} · {moneyExact(item.price)}</option>)}</select>}{productsQuery.data?.length === 0 && <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">No catalog items yet. Choose “New item from chat” to create one as you make the link.</p>}</div> : <div><label className="field-label" htmlFor="custom-order-name">Item name</label><input id="custom-order-name" data-testid="input-custom-order-name" required value={form.customName} onChange={(event) => change('customName', event.target.value)} placeholder="e.g. Hand-painted denim jacket" className="field-input" /><p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">This keeps a temporary item on the buyer link without adding it to your Catalog.</p></div>}
        </div>}
        {step === 2 && <div className="page-in space-y-6">
          <div><div className="field-label">Set the agreed terms</div><p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">These terms are already negotiated. The buyer will see them before they pay or reserve.</p></div>
          <div className="grid gap-5 sm:grid-cols-2"><div><label className="field-label" htmlFor="order-amount">Agreed price</label><div className="relative"><span className="absolute left-3 top-2.5 text-sm text-[hsl(var(--muted-foreground))]">$</span><input id="order-amount" data-testid="input-order-amount" required type="number" min="0" step=".01" value={form.amount} onChange={(event) => change('amount', event.target.value)} className="field-input pl-7" /></div></div><div><label className="field-label">Conversation started on</label><ChannelPicker value={form.channel} onChange={(value) => change('channel', value)} testId="select-order-channel" /></div></div>
          <div><div className="field-label">How should they pay?</div><div className="grid gap-2 sm:grid-cols-3">{[['full', 'Pay in full', 'Collect everything now'], ['deposit', 'Pay a deposit', 'Secure the order'], ['reserve', 'Reserve it', 'Confirm details first']].map(([value, title, note]) => <button type="button" key={value} onClick={() => change('paymentMode', value)} data-testid={`button-payment-mode-${value}`} className={cn('rounded-[12px] border p-3 text-left transition-colors', form.paymentMode === value ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]')}><div className="text-sm font-semibold">{title}</div><div className={cn('mt-1 text-xs', form.paymentMode === value ? 'text-white' : 'text-[hsl(var(--muted-foreground))]')}>{note}</div></button>)}</div></div>
          {form.paymentMode === 'deposit' && <div className="page-in"><label className="field-label" htmlFor="order-deposit">Deposit amount</label><div className="relative max-w-[240px]"><span className="absolute left-3 top-2.5 text-sm text-[hsl(var(--muted-foreground))]">$</span><input id="order-deposit" data-testid="input-order-deposit" required type="number" min="0" step=".01" value={form.depositAmount} onChange={(event) => change('depositAmount', event.target.value)} className="field-input pl-7" /></div></div>}
        </div>}
        {step === 3 && <div className="page-in space-y-5"><div><div className="field-label">Review the buyer page</div><p className="mt-1 text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">This is exactly what your buyer will see when they open the link.</p></div><div className="rounded-[14px] border border-[hsl(var(--border))] bg-white overflow-hidden shadow-sm"><div className="px-4 py-3 border-b border-[hsl(var(--border))]"><div className="text-[11px] font-bold text-[hsl(var(--primary))] uppercase tracking-wide">Step 1 of 2 · Contact &amp; Delivery</div><div className="text-base font-bold mt-0.5">Contact information</div></div><div className="px-4 py-4 space-y-4"><div><div className="text-xs font-semibold mb-1">Your name <span className="text-destructive">*</span></div><div className="field-input pointer-events-none text-[hsl(var(--muted-foreground))] text-sm">Full name</div></div><div><div className="text-xs font-semibold mb-1">Phone number <span className="text-destructive">*</span></div><div className="field-input pointer-events-none text-[hsl(var(--muted-foreground))] text-sm">Best number to reach you</div></div><div><div className="text-xs font-semibold mb-1">Delivery service <span className="text-destructive">*</span></div><div className="grid grid-cols-2 gap-2"><div className="rounded-[10px] border-2 border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/[.04] p-3 flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-[hsl(var(--primary))] flex items-center justify-center shrink-0"><Check size={10} className="text-white stroke-[3]" /></div><div><div className="text-xs font-bold">Pick up</div><div className="text-[10px] text-[hsl(var(--muted-foreground))]">No delivery fee</div></div></div><div className="rounded-[10px] border border-[hsl(var(--border))] p-3 flex items-center gap-2"><div className="w-4 h-4 rounded-full border-2 border-[hsl(var(--border))] shrink-0" /><div><div className="text-xs font-bold">Delivery</div><div className="text-[10px] text-[hsl(var(--muted-foreground))]">Free</div></div></div></div></div><div><div className="text-xs font-semibold mb-1 text-[hsl(var(--muted-foreground))]">Useful details <span className="font-normal">(optional)</span></div><div className="field-input pointer-events-none text-[hsl(var(--muted-foreground))] text-sm">Delivery timing, access notes, or anything agreed...</div></div><button type="button" disabled className="flex w-full items-center justify-center gap-2 rounded-[12px] bg-[hsl(var(--primary))] py-3.5 text-sm font-bold text-white opacity-80">Continue to payment →</button><div className="text-center text-[11px] text-[hsl(var(--muted-foreground))]">Select your payment provider on the next step</div></div></div></div>}
        <div className="flex justify-between border-t border-[hsl(var(--border))] pt-6">{step > 1 ? <Button type="button" variant="ghost" disabled={busy} onClick={() => setStep((current) => (current - 1) as TakeOrderStep)}><ArrowLeft size={15} />Back</Button> : <span aria-hidden="true" />}<Button type="submit" disabled={!validStep || busy || (path === 'catalog' && productsQuery.isLoading)} data-testid="button-create-order-link">{busy && <Loader2 className="animate-spin" size={15} />}{step < 3 ? 'Continue' : 'Create buyer link'} {step < 3 ? <ArrowRight size={15} /> : <ArrowUpRight size={15} />}</Button></div>
      </form></Card>
      <Card className="h-fit overflow-hidden"><div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-6 py-4"><div className="font-mono-ui text-xs font-semibold uppercase tracking-[.15em] text-[hsl(var(--muted-foreground))]">Buyer page preview</div><Eye size={17} className="text-[hsl(var(--muted-foreground))]" /></div><div className="max-h-[760px] overflow-hidden p-6" style={{ background: '#EDE8DF' }}><div className="rounded-2xl bg-white p-5 shadow-sm space-y-4 text-left"><div className="border-b border-neutral-100 pb-3"><div className="text-[11px] font-semibold text-blue-600 tracking-tight">Step 1 of 2 · Contact &amp; Delivery</div><h3 className="text-lg font-bold text-neutral-900 mt-0.5">Contact information</h3></div><div className="space-y-3.5"><div><label className="block text-xs font-semibold text-neutral-800 mb-1">Your name <span className="text-red-500">*</span></label><input disabled placeholder="Full name" className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 bg-white text-xs text-neutral-400 cursor-not-allowed" /></div><div><label className="block text-xs font-semibold text-neutral-800 mb-1">Phone number <span className="text-red-500">*</span></label><input disabled placeholder="Best number to reach you" className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 bg-white text-xs text-neutral-400 cursor-not-allowed" /></div><div><label className="block text-xs font-semibold text-neutral-800 mb-1.5">Delivery service <span className="text-red-500">*</span></label><div className="grid grid-cols-2 gap-2"><div className="rounded-xl border-2 border-neutral-900 p-2.5 flex items-center gap-2 bg-neutral-50/50"><div className="w-4 h-4 rounded-full bg-neutral-900 flex items-center justify-center shrink-0"><Check size={10} className="text-white stroke-[3]" /></div><div><div className="text-xs font-bold text-neutral-900">Pick up</div><div className="text-[10px] text-neutral-500">No delivery fee</div></div></div><div className="rounded-xl border border-neutral-200 p-2.5 flex items-center gap-2"><div className="w-4 h-4 rounded-full border border-neutral-300 shrink-0" /><div><div className="text-xs font-semibold text-neutral-700">Delivery</div><div className="text-[10px] text-neutral-400">Free</div></div></div></div></div><div><label className="block text-xs font-semibold text-neutral-800 mb-1">Useful details <span className="font-normal text-neutral-400">(optional)</span></label><textarea disabled placeholder="Delivery timing, access notes, or anything agreed..." rows={2} className="w-full px-3.5 py-2 rounded-xl border border-neutral-200 bg-white text-xs text-neutral-400 resize-none cursor-not-allowed" /></div><button type="button" disabled className="flex w-full items-center justify-center gap-2 rounded-xl bg-neutral-900 py-3 text-xs font-bold text-white shadow-xs cursor-not-allowed">Continue to payment →</button><p className="text-center text-[10px] text-neutral-400 pt-0.5">Select your payment provider on the next step</p></div></div></div></Card>
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
  imageUrl?: string;
  imageUrls?: string[];
  description?: string | null;
  sku?: string | null;
  compareAtPrice?: number | null;
  stock?: number;
  available?: boolean;
};

const takeOrderStepMeta: Array<{ step: TakeOrderStep; label: string; detail: string }> = [
  { step: 1, label: 'Items', detail: 'Build the basket' },
  { step: 2, label: 'Checkout', detail: 'Confirm items and payment' },
  { step: 3, label: 'Preview', detail: 'Live buyer preview' },
];

function TakeOrderStepRail({ step, onStepChange }: { step: TakeOrderStep; onStepChange: (step: TakeOrderStep) => void }) {
  return <nav className="take-order-step-rail" aria-label="Order link setup">
    <div className="take-order-step-pill-container">
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
            <span className="take-order-step-number">{complete ? <Check size={13} strokeWidth={2.5} /> : item.step}</span>
            <span className="min-w-0 text-left">
              <span className="take-order-step-label">{item.label}</span>
              <span className="take-order-step-detail">{item.detail}</span>
            </span>
          </button>
          {index < takeOrderStepMeta.length - 1 && <span className={cn('take-order-step-line', step > item.step && 'is-complete')} aria-hidden="true" />}
        </React.Fragment>;
      })}
    </div>
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
    <button type="button" data-testid="button-choose-catalog-item" aria-pressed={selected === 'catalog'} className={cn('take-order-choice-card group', selected === 'catalog' && 'is-active')} onClick={() => onSelect('catalog')}>
      <span className="take-order-choice-mark"><Boxes size={22} /></span>
      <span className="take-order-choice-copy">
        <strong>From catalog</strong>
        <small>Use a saved product, inventory, and preset price.</small>
        <span className="take-order-choice-pill">Saved inventory</span>
      </span>
      <ChevronRight size={18} className="take-order-choice-arrow" aria-hidden="true" />
    </button>
    <button type="button" data-testid="button-choose-custom-item" aria-pressed={selected === 'custom'} className={cn('take-order-choice-card is-custom-card group', selected === 'custom' && 'is-active')} onClick={() => onSelect('custom')}>
      <span className="take-order-choice-mark is-custom"><Sparkles size={22} /></span>
      <span className="take-order-choice-copy">
        <strong>Not from catalog</strong>
        <small>Add a one-off item from your conversation.</small>
        <span className="take-order-choice-pill is-accent">Instant quote</span>
      </span>
      <ChevronRight size={18} className="take-order-choice-arrow" aria-hidden="true" />
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
       {items.length ? items.map((item) => <div key={item.key} className="take-order-catalog-selection-row"><div className="take-order-item-mark"><img src={item.imageUrls?.[0] ?? item.imageUrl ?? productImageFor(item.name)} alt="" /></div><span>{item.name}</span><b>{moneyExact(item.amount)}</b><button type="button" aria-label={`Remove ${item.name}`} onClick={() => onRemove(item.key)}><X size={14} /></button></div>) : <div className="take-order-catalog-selection-empty">Your selected products will appear here.</div>}
    </div>
    {showPayableTotal && <div className="take-order-checkout-payable"><span>Total payable amount</span><strong>{moneyExact(total)}</strong></div>}
    {feedback && <TakeOrderFeedback message={feedback} />}
    {showActions && <>{showContinue && <Button type="submit" className="take-order-catalog-continue" disabled={disabled || !items.length || items.some((item) => item.amount <= 0)} data-testid={buttonTestId}>Continue to checkout <ArrowRight size={15} /></Button>}<button type="button" className="take-order-catalog-custom-link" onClick={onOneOff}>Add a one-off item instead</button></>}
  </div>;
}

function TakeOrderCustomOrderPanel({ items, total, canContinue, busy, onRemove, onUpdateAmount }: { items: DraftOrderItem[]; total: number; canContinue: boolean; busy: boolean; onRemove: (key: number) => void; onUpdateAmount: (key: number, value: string) => void }) {
  return <aside className="take-order-custom-order-panel">
    <div className="take-order-custom-order-body">
      <div className="take-order-custom-order-label">This order</div>
      {items.length ? <div className="take-order-custom-order-items">
         {items.map((item) => <div key={item.key} className="take-order-custom-order-row">
           <div className="take-order-custom-order-mark"><img src={item.imageUrls?.[0] ?? item.imageUrl ?? productImageFor(item.name)} alt="" /></div>
          <div className="take-order-custom-order-copy take-order-item-copy"><strong>{item.name}</strong><span>{item.preferences.length ? `${item.preferences.length} buyer option${item.preferences.length === 1 ? '' : 's'}` : 'Custom item'}</span></div>
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

function TakeOrderCheckoutSummary({ items, total, paymentMode, deposit, deliveryFee = 0 }: { items: DraftOrderItem[]; total: number; paymentMode: 'full' | 'deposit' | 'reserve' | null; deposit: number; deliveryFee?: number }) {
  const paymentLabel = paymentMode === 'deposit'
    ? `Deposit · ${moneyExact(deposit)}`
    : paymentMode === 'reserve'
      ? 'Make Reservation · Pay on delivery'
      : paymentMode === 'full'
        ? 'Full Payment'
        : 'Select payment option';
  const effectiveTotal = total + (deliveryFee || 0);
  return <aside className="take-order-checkout-summary">
    <div className="take-order-checkout-summary-body">
      <div className="take-order-checkout-summary-heading"><ShoppingBag size={20} /><div><strong>Basket</strong><span>Order summary</span></div></div>
      <div className="take-order-checkout-summary-section">
        <div className="take-order-checkout-summary-label">Items ({items.length})</div>
         <div className="take-order-checkout-summary-items">{items.map((item) => <div key={item.key}><span className="take-order-summary-item-copy"><img src={item.imageUrls?.[0] ?? item.imageUrl ?? productImageFor(item.name)} alt="" />{item.name} × 1</span><strong>{moneyExact(item.amount)}</strong></div>)}</div>
      </div>
      <div className="take-order-checkout-summary-divider" />
      <div className="take-order-checkout-summary-line"><span>Subtotal</span><strong>{moneyExact(total)}</strong></div>
      {deliveryFee > 0 && <div className="take-order-checkout-summary-line"><span>Delivery fee</span><strong>+{moneyExact(deliveryFee)}</strong></div>}
      <div className="take-order-checkout-summary-line"><span>Payment method</span><strong>{paymentLabel}</strong></div>
      <div className="take-order-checkout-summary-total"><div><span>Total</span><strong>{moneyExact(effectiveTotal)}</strong></div><small>Final total payable on confirmation</small></div>
    </div>
    <div className="take-order-checkout-summary-note">Summary will be confirmed on step 3</div>
  </aside>;
}

function ApplePhonePreview({
  businessName,
  items,
  total,
  paymentMode,
  deposit,
  deliveryFee,
  channel,
}: {
  businessName: string;
  items: DraftOrderItem[];
  total: number;
  paymentMode: 'full' | 'deposit' | 'reserve' | null;
  deposit: number;
  deliveryFee: number;
  channel: string;
}) {
  const payableToday = paymentMode === 'deposit' ? deposit : paymentMode === 'reserve' ? 0 : total + deliveryFee;
  return (
    <div className="take-order-apple-phone" aria-label="Buyer mobile page preview">
      <div className="take-order-phone-speaker">
        <div className="take-order-phone-dynamic-island">
          <div className="take-order-phone-camera" />
        </div>
      </div>
      <div className="take-order-phone-status-bar">
        <span className="take-order-phone-time">9:41</span>
        <div className="take-order-phone-icons">
          <Signal size={12} strokeWidth={2.2} />
          <Wifi size={12} strokeWidth={2.2} />
          <div className="take-order-phone-battery"><div className="take-order-phone-battery-level" /></div>
        </div>
      </div>
      <div className="take-order-phone-screen">
        <div className="take-order-phone-browser-bar">
          <Lock size={10} className="text-neutral-400" />
          <span className="truncate">takeorder.app/o/checkout</span>
        </div>

        <div className="take-order-phone-scroll-body">
          <div className="take-order-phone-store-header">
            <div className="take-order-phone-avatar">{businessName.slice(0, 2).toUpperCase()}</div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1 font-semibold text-xs text-neutral-900 dark:text-neutral-100 truncate">
                <span>{businessName}</span>
                <CheckCircle2 size={12} className="text-blue-500 shrink-0" />
              </div>
              <div className="text-[10px] text-neutral-500 capitalize">{channelName(channel as any)} checkout link</div>
            </div>
          </div>

          <div className="take-order-phone-pass-card">
            <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-2">Order Items ({items.length})</div>
            <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1">
              {items.map((item) => (
                <div key={item.key} className="flex items-center gap-2">
                  <img
                    src={item.imageUrls?.[0] ?? item.imageUrl ?? productImageFor(item.name)}
                    alt=""
                    className="w-9 h-9 rounded-lg object-cover bg-neutral-100 dark:bg-neutral-800 shrink-0 border border-neutral-200/50 dark:border-neutral-700/50"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 truncate">{item.name}</div>
                    <div className="text-[10px] text-neutral-500">{item.source === 'catalog' ? 'Catalog item' : 'Custom'}</div>
                  </div>
                  <div className="text-xs font-bold font-mono-ui text-neutral-900 dark:text-neutral-100">{moneyExact(item.amount)}</div>
                </div>
              ))}
            </div>

            <div className="mt-3 pt-2.5 border-t border-neutral-200/70 dark:border-neutral-800 space-y-1 text-xs">
              <div className="flex justify-between text-neutral-500 text-[11px]">
                <span>Subtotal</span>
                <span className="font-mono-ui">{moneyExact(total)}</span>
              </div>
              {deliveryFee > 0 && (
                <div className="flex justify-between text-neutral-500 text-[11px]">
                  <span>Delivery fee</span>
                  <span className="font-mono-ui">{moneyExact(deliveryFee)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-neutral-900 dark:text-white pt-1 text-xs">
                <span>Total amount</span>
                <span className="font-mono-ui text-sm">{moneyExact(total + deliveryFee)}</span>
              </div>
              {paymentMode === 'deposit' && (
                <div className="flex justify-between font-bold text-blue-600 dark:text-blue-400 text-[11px] pt-0.5">
                  <span>Payable today (Deposit)</span>
                  <span className="font-mono-ui">{moneyExact(deposit)}</span>
                </div>
              )}
            </div>
          </div>

          <div className="take-order-phone-buyer-inputs-mock">
            <div className="mock-input-row"><span>Customer name</span><span>Customer in conversation</span></div>
            <div className="mock-input-row"><span>Phone number</span><span>Entered at checkout</span></div>
            <div className="mock-input-row"><span>Fulfilment</span><span>Pickup / Delivery</span></div>
          </div>

          <div className="take-order-phone-pay-action">
            <div className="take-order-phone-apple-pay-btn">
              <span className="font-semibold text-xs tracking-tight">
                {paymentMode === 'reserve' ? 'Reserve order' : `Pay ${moneyExact(payableToday)}`}
              </span>
            </div>
            <div className="text-center text-[9px] text-neutral-400 mt-2 flex items-center justify-center gap-1">
              <ShieldCheck size={11} className="text-emerald-500" />
              <span>Apple Pay & Card payments supported</span>
            </div>
          </div>
        </div>

        <div className="take-order-phone-home-indicator" />
      </div>
    </div>
  );
}

function TakeOrderBuyerPreviewForm({
  item,
  items,
  paymentMode,
  subtotal,
  deposit,
  deliveryFee = 0,
  itemIndex = 0,
  onActiveIndexChange,
}: {
  item: BuyerOrderItem;
  items: BuyerOrderItem[];
  paymentMode: 'full' | 'deposit' | 'reserve' | null;
  subtotal: number;
  deposit: number;
  deliveryFee?: number;
  itemIndex?: number;
  onActiveIndexChange?: (index: number) => void;
}) {
  const [form, setForm] = useState<BuyerOrderFormValues>({
    name: '',
    phone: '',
    deliveryMethod: undefined,
    address: '',
    orderDetails: '',
  });
  const [itemForms, setItemForms] = useState<BuyerItemFormValues[]>(() =>
    items.map(() => emptyBuyerItemForm())
  );
  const [activeItemStep, setActiveItemStep] = useState(itemIndex);
  const [submitError, setSubmitError] = useState('');
  const [previewCompleted, setPreviewCompleted] = useState(false);

  useEffect(() => {
    setActiveItemStep(itemIndex);
  }, [itemIndex]);

  useEffect(() => {
    setItemForms((current) => items.map((_, idx) => current[idx] ?? emptyBuyerItemForm()));
  }, [items.length]);

  const currentItem = items[activeItemStep] ?? item;
  const currentItemForm = itemForms[activeItemStep] ?? emptyBuyerItemForm();

  const currentSubtotal = itemForms.length === items.length
    ? items.reduce((sum, itm, idx) => sum + itm.amount * (itemForms[idx]?.quantity ?? 1), 0)
    : subtotal;
  const currentDeliveryFee = form.deliveryMethod === 'delivery' ? deliveryFee : 0;
  const currentTotal = currentSubtotal + currentDeliveryFee;

  if (previewCompleted) {
    return (
      <div className="buyer-order-detail-card p-8 sm:p-10 text-center space-y-4 my-auto">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600">
          <Check size={28} strokeWidth={2.5} />
        </div>
        <h3 className="text-xl font-bold text-neutral-900">Preview: Order Submitted</h3>
        <p className="text-sm text-neutral-500 max-w-sm mx-auto leading-relaxed">
          {paymentMode === 'reserve'
            ? 'When a buyer reserves, you’ll get an instant notification to confirm fulfillment.'
            : 'When a buyer completes checkout, payment is collected and logged directly in your Orders list.'}
        </p>
        <button
          type="button"
          onClick={() => setPreviewCompleted(false)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-neutral-200 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 transition-colors"
        >
          Reset preview form
        </button>
      </div>
    );
  }

  return (
    <BuyerOrderForm
      paymentMode={paymentMode}
      amount={currentTotal}
      depositAmount={paymentMode === 'deposit' ? deposit : null}
      deliveryFee={deliveryFee}
      askForDetails={true}
      allowReferenceImages={true}
      item={currentItem}
      itemIndex={activeItemStep}
      itemCount={items.length}
      items={items}
      itemForms={itemForms}
      itemForm={currentItemForm}
      form={form}
      submitPending={false}
      submitError={submitError}
      onSubmit={(event) => {
        event.preventDefault();
        setPreviewCompleted(true);
      }}
      onChange={(key, value) => {
        setSubmitError('');
        if (key === 'details') {
          setItemForms((curr) => curr.map((it, idx) => idx === activeItemStep ? { ...it, details: value } : it));
        } else {
          setForm((curr) => ({ ...curr, [key]: value }));
        }
      }}
      onItemChange={(key, value) => {
        setSubmitError('');
        setItemForms((curr) => curr.map((it, idx) => idx === activeItemStep ? { ...it, [key]: value } : it));
      }}
      onQuantityChange={(qty) => {
        setItemForms((curr) => curr.map((it, idx) => idx === activeItemStep ? { ...it, quantity: qty } : it));
      }}
      onPreferenceChange={(label, value) => {
        setSubmitError('');
        setItemForms((curr) => curr.map((it, idx) => idx === activeItemStep ? { ...it, preferences: { ...it.preferences, [label]: value } } : it));
      }}
      onNextItem={() => {
        if (activeItemStep < items.length - 1) {
          const nextIdx = activeItemStep + 1;
          setActiveItemStep(nextIdx);
          onActiveIndexChange?.(nextIdx);
        }
      }}
      onPrevItem={() => {
        if (activeItemStep > 0) {
          const prevIdx = activeItemStep - 1;
          setActiveItemStep(prevIdx);
          onActiveIndexChange?.(prevIdx);
        }
      }}
      onBack={() => {
        if (activeItemStep > 0) {
          const prevIdx = activeItemStep - 1;
          setActiveItemStep(prevIdx);
          onActiveIndexChange?.(prevIdx);
        }
      }}
      onReferenceImageChange={(event) => {
        const file = event.target.files?.[0];
        if (file) {
          const previewUrl = URL.createObjectURL(file);
          setItemForms((curr) => curr.map((it, idx) => idx === activeItemStep ? { ...it, imagePreview: previewUrl, image: file.name } : it));
        }
      }}
      onError={setSubmitError}
    />
  );
}

function MultiItemTakeOrderModern() {
  const { userId } = useAppAuth();
  const entitlements = useEntitlements(userId);
  const productsQuery = useListProducts();
  const settingsQuery = useGetSellerSettings();
  const createOrder = useCreateOrder();
  const createProduct = useCreateProduct();
  const seller = readSellerProfile();
  const [upgradeDialogReason, setUpgradeDialogReason] = useState<UpgradeReason | null>(null);
  const [step, setStep] = useState<TakeOrderStep>(1);
  const [items, setItems] = useState<DraftOrderItem[]>([]);
  const [nextKey, setNextKey] = useState(1);
  const [itemSource, setItemSource] = useState<TakeOrderItemSource | null>(null);
  const [customDraft, setCustomDraft] = useState<{ name: string; amount: string; preferences: ProductPreferenceDraft[] }>({ name: '', amount: '', preferences: [] });
  const [paymentMode, setPaymentMode] = useState<'full' | 'deposit' | 'reserve' | null>(null);
  const [depositAmount, setDepositAmount] = useState('');
  const [deliveryFee, setDeliveryFee] = useState('0');
  const [channel, setChannel] = useState<OrderInput['channel'] | ''>('');
  const [catalogSearch, setCatalogSearch] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [created, setCreated] = useState<Order | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  useEffect(() => {
    if (!settingsQuery.data) return;
    if (settingsQuery.data.deliveryFee != null) {
      setDeliveryFee(String(settingsQuery.data.deliveryFee));
    }
  }, [settingsQuery.data]);
  const total = items.reduce((sum, item) => sum + item.amount, 0);
  const catalogProducts = productsQuery.data ?? [];
  const filteredCatalogProducts = useMemo(() => {
    const search = catalogSearch.trim().toLowerCase();
    return catalogProducts.filter((product) => {
      const matchesSearch = !search || `${product.name} ${product.category} ${product.description ?? ''}`.toLowerCase().includes(search);
      return matchesSearch;
    });
  }, [catalogProducts, catalogSearch]);
  const choiceOnly = step === 1 && itemSource === null && items.length === 0;
  const catalogStage = step === 1 && itemSource === 'catalog';
  const [previewIndex, setPreviewIndex] = useState(0);
  useEffect(() => {
    setPreviewIndex(0);
  }, [items.length]);
  const previewItems: BuyerOrderItem[] = useMemo(() => {
    if (!items.length) {
      return [{
        productId: 0,
        productName: 'Your item',
        amount: 0,
        variants: [],
        preferences: [],
        source: 'catalog' as const,
      }];
    }
    return items.map((item) => {
      const img = item.imageUrls?.[0] ?? item.imageUrl ?? productImageFor(item.name);
      return {
        productId: item.productId ?? item.key,
        productName: item.name,
        amount: item.amount,
        variants: item.variants,
        preferences: item.preferences,
        imageUrl: img,
        imageUrls: item.imageUrls?.length ? item.imageUrls : [img],
        stock: item.stock,
        description: item.description,
        compareAtPrice: item.compareAtPrice,
        available: item.available ?? true,
        source: item.source,
      };
    });
  }, [items]);
  const busy = createOrder.isPending || createProduct.isPending;
  const deposit = Number(depositAmount);
  const validDeposit = paymentMode !== 'deposit' || (Number.isFinite(deposit) && deposit > 0 && deposit <= total);
  const deliveryFeeAmount = Number(deliveryFee);
  const validDeliveryFee = Number.isFinite(deliveryFeeAmount) && deliveryFeeAmount >= 0;
   const canContinue = step === 1
     ? items.length > 0 && items.every((item) => item.amount > 0)
     : total > 0 && paymentMode !== null && validDeposit && validDeliveryFee && Boolean(channel);
  const showPreview = step === 3;
  const goToStep = (nextStep: TakeOrderStep) => {
    if (nextStep === 1) {
      setStep(1);
      setFeedback(null);
      return;
    }
    if (!items.length || items.some((item) => item.amount <= 0)) {
      setFeedback('Add at least one item with a price greater than 0.00 before continuing.');
      setStep(1);
      return;
    }
    setFeedback(null);
    setStep(nextStep);
  };

  const getErrorMessage = (error: unknown, fallback: string) => formatUserFacingError(error, fallback);
  const toggleCatalogProduct = (product: Product) => {
    setItems((current) => {
      const existing = current.some((item) => item.productId === product.id);
      if (existing) return current.filter((item) => item.productId !== product.id);
       return [...current, { key: nextKey, source: 'catalog', productId: product.id, name: product.name, amount: product.price, variants: product.variants, preferences: product.preferences, accent: product.accent, imageUrl: product.imageUrl ?? undefined, imageUrls: product.imageUrls, description: product.description, sku: product.sku, compareAtPrice: product.compareAtPrice, stock: product.stock, available: product.stock > 0 }];
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
          const variantSummary = product.preferences?.length
            ? product.preferences.map((preference) => `${preference.label}: ${preference.options.join(', ')}`).join(' · ')
            : product.variants?.length
              ? product.variants.join(' · ')
              : null;
          return <button type="button" key={product.id} className={cn('take-order-product-card', selected && 'is-selected')} onClick={() => toggleCatalogProduct(product)} aria-label={`${selected ? 'Remove' : 'Add'} ${product.name} ${selected ? 'from' : 'to'} order`} aria-pressed={selected}>
            <img src={product.imageUrl ?? productImageFor(product.name)} alt="" className="take-order-product-image" />
            <span className="take-order-product-copy"><strong className="font-semibold">{product.name}</strong><small>{variantSummary || (product.category ? `${product.category}${product.description ? ` · ${product.description}` : ''}` : product.description || 'Catalog item')}</small><b className="font-semibold">{moneyExact(product.price)}</b></span>
            <span className="take-order-product-add" aria-hidden="true">{selected ? <Check size={16} strokeWidth={3} /> : <Plus size={18} />}</span>
          </button>;
        })}</div>
        : <div className="p-8 text-center" data-testid="catalog-search-empty">
            <p className="take-order-help">{catalogProducts.length ? `No products match “${catalogSearch}”.` : 'No saved products yet.'}</p>
            <Button type="button" variant="outline" className="mt-3 text-xs rounded-xl" onClick={() => { setItemSource('custom'); setFeedback(null); }}>
              <Sparkles size={14} className="mr-1.5 text-blue-600 dark:text-blue-400" />
              Take a custom product instead
            </Button>
          </div>;
  const updateAmount = (key: number, value: string) => {
    const amount = Number(value);
    setItems((current) => current.map((item) => item.key === key ? { ...item, amount: Number.isFinite(amount) && amount >= 0 ? amount : 0 } : item));
    setFeedback(null);
  };
  const createLink = (productIds: number[]) => {
    if (entitlements.tier === 'free' && (entitlements.limits.activeLinkLimitReached || entitlements.usage.activeLinkCount >= FREE_ACTIVE_LINK_LIMIT)) {
      setUpgradeDialogReason('link_limit');
      return;
    }
    const data: OrderInput = {
      items: items.map((item, index) => ({ productId: productIds[index]!, amount: item.amount })),
      paymentMode: paymentMode ?? 'full',
      depositAmount: paymentMode === 'deposit' ? deposit : null,
      deliveryFee: deliveryFeeAmount,
      channel: channel as OrderInput['channel'],
      customerName: customerName.trim() || undefined,
      customerPhone: customerPhone.trim() || undefined,
      deliveryAddress: deliveryAddress.trim() || undefined,
      buyerDetails: orderNotes.trim() || undefined,
    };
    createOrder.mutate({ data }, {
      onSuccess: (order) => { setFeedback(null); setCreated(order); },
      onError: (error) => {
        const errorMsg = (error as any)?.message || '';
        const errorCode = (error as any)?.code || (error as any)?.response?.data?.code;
        if (errorCode === 'LINK_LIMIT_REACHED' || errorMsg.includes('Active link limit reached') || errorMsg.includes('LINK_LIMIT_REACHED')) {
          setUpgradeDialogReason('link_limit');
        } else {
          setFeedback(getErrorMessage(error, 'The buyer link could not be created. Check your connection and try again.'));
        }
      },
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
      setFeedback(items.length ? `Every item needs a price greater than ${currencySymbol()}0.00.` : 'Add at least one item to continue.');
      return;
    }
    if (step === 2 && !paymentMode) {
      setFeedback('Choose how the buyer should pay before continuing.');
      return;
    }
    if (step === 2 && !validDeposit) {
      setFeedback(`The deposit must be greater than ${currencySymbol()}0.00 and no more than the order total.`);
      return;
    }
    if (step === 2 && !validDeliveryFee) {
      setFeedback(`The delivery fee must be ${currencySymbol()}0.00 or more.`);
      return;
    }
    if (step === 2 && !channel) {
      setFeedback('Choose the conversation channel before continuing.');
      return;
    }
    if (step < 3) {
      setStep((current) => (current + 1) as TakeOrderStep);
      return;
    }
    if (entitlements.limits.activeLinkLimitReached) {
      setUpgradeDialogReason('link_limit');
      return;
    }
    resolveItems(0);
  };
  const link = created ? buildPublicOrderLink(created.token) : '';
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
    setCustomDraft({ name: '', amount: '', preferences: [] });
    setCatalogSearch('');
    setCustomerName('');
    setCustomerPhone('');
    setDeliveryAddress('');
    setOrderNotes('');
    setPaymentMode(null);
    setDepositAmount('');
    setDeliveryFee('0');
    setChannel('');
  };

  if (created) {
    const buyerPhone = (created.customerPhone || '').replace(/[^0-9]/g, '');
    const whatsappMsg = `Hi ${created.customerName && created.customerName !== 'Waiting for buyer' ? created.customerName : 'there'}! Here is your order link for ${moneyExact(total)}: ${link}`;
    const whatsappUrl = buyerPhone
      ? `https://wa.me/${buyerPhone}?text=${encodeURIComponent(whatsappMsg)}`
      : `https://wa.me/?text=${encodeURIComponent(whatsappMsg)}`;

    return (
      <Shell>
        <div className="max-w-[620px] mx-auto py-8">
          <div className="rounded-[16px] border border-[hsl(var(--card-border))] bg-white p-6 sm:p-8 shadow-sm dark:bg-neutral-900 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 mb-4">
              <Check size={28} strokeWidth={2.5} />
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Order Link Ready</span>
            <h1 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900 dark:text-white">Send it to your buyer</h1>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
              Live link generated with {items.length} item{items.length === 1 ? '' : 's'} and total of <strong>{moneyExact(total)}</strong>.
            </p>

            {/* Link Box */}
            <div className="mt-6 p-4 rounded-[12px] border border-[hsl(var(--border))] bg-neutral-50 dark:bg-neutral-800/50 text-left">
              <div className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-1.5">Direct buyer link</div>
              <div className="flex items-center justify-between gap-2 bg-white dark:bg-neutral-900 p-2.5 rounded-[8px] border border-[hsl(var(--border))]">
                <span className="truncate text-xs font-mono text-neutral-800 dark:text-neutral-200">{link}</span>
                <button
                  type="button"
                  onClick={copy}
                  data-testid="button-copy-created-link"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-neutral-900 text-white text-xs font-medium hover:bg-neutral-800 transition shrink-0 cursor-pointer"
                >
                  {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                  <span>{copied ? 'Copied' : 'Copy link'}</span>
                </button>
              </div>
            </div>

            {/* Quick Actions: WhatsApp Share + Preview */}
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 h-11 px-4 rounded-[10px] bg-[#25D366] text-white text-xs font-semibold hover:opacity-90 transition shadow-xs"
              >
                <Send size={14} />
                <span>Share via WhatsApp</span>
              </a>

              <Link
                href={`/o/${created.token}`}
                target="_blank"
                className="inline-flex items-center justify-center gap-2 h-11 px-4 rounded-[10px] border border-[hsl(var(--border))] bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs font-semibold hover:bg-neutral-50 dark:hover:bg-neutral-700 transition"
                data-testid="link-preview-created-order"
              >
                <ExternalLink size={14} />
                <span>Preview checkout</span>
              </Link>
            </div>

            {/* QR Code Container */}
            <div className="mt-6 pt-6 border-t border-[hsl(var(--border))] flex flex-col items-center">
              <span className="text-xs font-semibold text-neutral-500 mb-3">Scan QR to open checkout on phone</span>
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(link)}`}
                alt="Order Link QR Code"
                className="w-36 h-36 rounded-lg border border-[hsl(var(--border))] bg-white p-2 shadow-2xs"
                loading="lazy"
              />
            </div>

            {/* Bottom Reset */}
            <div className="mt-6 pt-4 border-t border-[hsl(var(--border))] flex justify-center">
              <button
                type="button"
                onClick={reset}
                className="text-xs font-semibold text-neutral-600 hover:text-neutral-950 dark:text-neutral-400 dark:hover:text-white transition cursor-pointer"
              >
                + Take another order
              </button>
            </div>
          </div>
        </div>
      </Shell>
    );
  }

  const canGoBack = step > 1 || (step === 1 && (itemSource !== null || items.length > 0));
  const handleBack = () => {
    if (step === 3) {
      goToStep(2);
    } else if (step === 2) {
      goToStep(1);
    } else if (step === 1) {
      setItemSource(null);
    }
  };

  const isLinkLimitReached = entitlements.tier === 'free' && (entitlements.limits.activeLinkLimitReached || entitlements.usage.activeLinkCount >= FREE_ACTIVE_LINK_LIMIT);
  const isLinkNearLimit = entitlements.tier === 'free' && (entitlements.usage.activeLinkCount / FREE_ACTIVE_LINK_LIMIT) >= 0.8;

  return <Shell>
    <PageHeader
      title={
        <div className="flex items-center gap-2.5">
          {canGoBack && (
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-[8px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition cursor-pointer"
              onClick={handleBack}
              aria-label="Go back"
              title="Go back"
            >
              <ArrowLeft size={16} strokeWidth={2} />
            </button>
          )}
          <h1 className="text-[24px] sm:text-[28px] md:text-[30px] font-semibold tracking-tight text-[hsl(var(--foreground))] leading-none">
            Take an order
          </h1>
        </div>
      }
      secondaryActions={
        <div className="flex items-center gap-2">
          {entitlements.tier === 'free' ? (
            <div
              className={cn(
                'inline-flex items-center gap-2 px-3 py-1.5 rounded-[8px] border text-xs font-medium',
                isLinkLimitReached
                  ? 'border-rose-300 bg-rose-50 text-rose-800'
                  : isLinkNearLimit
                    ? 'border-amber-300 bg-amber-50 text-amber-800'
                    : 'border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--muted-foreground))]'
              )}
            >
              <span>
                {entitlements.usage.activeLinkCount} of {FREE_ACTIVE_LINK_LIMIT} active links
              </span>
              {(isLinkNearLimit || isLinkLimitReached) && (
                <button
                  type="button"
                  onClick={() => setUpgradeDialogReason('link_limit')}
                  className="font-bold underline text-neutral-900 dark:text-white ml-1 cursor-pointer"
                >
                  Upgrade
                </button>
              )}
            </div>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 text-xs font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Unlimited links
            </span>
          )}
        </div>
      }
      primaryAction={step === 3 ? (
        <Button
          type="submit"
          form="take-order-form"
          className="bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/90 text-white font-medium rounded-[8px] h-9 px-4 gap-1.5 inline-flex items-center text-[13px]"
          disabled={!canContinue || busy}
          data-testid="button-create-order-link"
        >
          {busy && <Loader2 className="animate-spin" size={14} />}
          Create buyer link <ArrowUpRight size={14} />
        </Button>
      ) : undefined}
    />
    <div className="take-order-page">
      <div className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mb-6">
        Create an order link to send directly to your buyer
      </div>
      <div className={cn('take-order-layout mt-6 sm:mt-8', choiceOnly && 'is-choice-only')}>
        <div className={cn('take-order-builder-card take-order-flow-panel', catalogStage && 'take-order-catalog-stage-card', choiceOnly && 'take-order-choice-stage-card')}>
          <form id="take-order-form" onSubmit={submit}>
            {choiceOnly && (
              <div className="take-order-choice-stage">
                <div className="sr-only"><h2>How would you like to add an item?</h2></div>
                <TakeOrderChoiceCards selected={itemSource} onSelect={(source) => { setItemSource(source); setFeedback(null); }} />
              </div>
            )}

            {step === 1 && catalogStage && (
              <div className={cn('take-order-catalog-stage', items.length > 0 && 'has-selection')}>
                {!productsQuery.isLoading && !productsQuery.isError && catalogProducts.length === 0 ? (
                  <>
                    <div className="take-order-catalog-browser">
                      <div
                        className="take-order-catalog-empty-prompt flex flex-col items-center justify-center p-8 sm:p-14 text-center rounded-2xl border border-dashed border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-900/30 my-2 shadow-xs"
                        data-testid="catalog-empty-prompt"
                      >
                        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white dark:bg-neutral-800 shadow-sm border border-neutral-200/70 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200">
                          <Boxes size={28} strokeWidth={1.75} />
                        </div>
                        <h3 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
                          No products in your catalog yet
                        </h3>
                        <p className="mt-2 max-w-md text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
                          You haven't added any products to your catalog yet. Add a new product to save details and pricing for future orders, or take a custom product to create this order right away.
                        </p>
                        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                          <Link href="/catalog/new" data-testid="button-catalog-empty-add-product">
                            <Button type="button" className="h-10 px-5 text-sm font-semibold rounded-xl">
                              <Plus size={16} className="mr-1.5" />
                              Add a new product
                            </Button>
                          </Link>
                          <Button
                            type="button"
                            variant="outline"
                            className="h-10 px-5 text-sm font-semibold rounded-xl"
                            data-testid="button-catalog-empty-custom-item"
                            onClick={() => {
                              setItemSource('custom');
                              setFeedback(null);
                            }}
                          >
                            <Sparkles size={16} className="mr-1.5 text-blue-600 dark:text-blue-400" />
                            Take a custom product
                          </Button>
                        </div>
                      </div>
                    </div>
                    {items.length > 0 && (
                      <div className="take-order-catalog-selection-column">
                        <TakeOrderCheckoutCard items={items} total={total} feedback={feedback} onRemove={(key) => setItems((current) => current.filter((candidate) => candidate.key !== key))} onOneOff={() => { setItemSource('custom'); setFeedback(null); }} buttonTestId="button-continue-catalog" disabled={busy || productsQuery.isLoading} showActions={true} />
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="take-order-catalog-browser">
                      <div className="take-order-catalog-toolbar">
                        <div className="take-order-search">
                          <Search size={18} aria-hidden="true" />
                          <input aria-label="Search catalog" value={catalogSearch} onChange={(event) => setCatalogSearch(event.target.value)} placeholder="Search your catalog or type product name..." />
                        </div>
                        <button type="button" className="take-order-custom-action" onClick={() => { setItemSource('custom'); setFeedback(null); }}><Plus size={18} />Add custom item</button>
                      </div>
                      {(catalogProducts.length > 0 || productsQuery.isLoading || productsQuery.isError) && (
                        <section className="take-order-recent-products" aria-label="Recent products">
                          <div className="take-order-catalog-section-heading"><h2>{catalogSearch ? 'Products' : 'Catalog products'}</h2><span>{filteredCatalogProducts.length} available</span></div>
                          {catalogItems}
                        </section>
                      )}
                    </div>
                    {items.length > 0 && (
                      <div className="take-order-catalog-selection-column">
                        <TakeOrderCheckoutCard items={items} total={total} feedback={feedback} onRemove={(key) => setItems((current) => current.filter((candidate) => candidate.key !== key))} onOneOff={() => { setItemSource('custom'); setFeedback(null); }} buttonTestId="button-continue-catalog" disabled={busy || productsQuery.isLoading} showActions={true} />
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {step === 1 && itemSource === 'custom' && (
              <div className="take-order-custom-stage">
                <TakeOrderFeedback message={feedback} />
                <div className="take-order-custom-columns">
                  <section className="take-order-custom-form-panel" aria-label="Custom item details">
                    <div className="take-order-custom-field">
                      <label className="field-label font-semibold" htmlFor="input-custom-order-name">What are they buying?</label>
                      <input id="input-custom-order-name" data-testid="input-custom-order-name" value={customDraft.name} onChange={(event) => setCustomDraft((current) => ({ ...current, name: event.target.value }))} placeholder="White leather sneakers size 42" className="field-input" />
                    </div>
                    <div className="take-order-custom-field">
                      <label className="field-label font-semibold" htmlFor="input-custom-order-price">Price</label>
                      <div className="take-order-custom-price-input"><span>{currencySymbol()}</span><input id="input-custom-order-price" data-testid="input-custom-order-price" type="number" min="0.01" step=".01" value={customDraft.amount} onChange={(event) => setCustomDraft((current) => ({ ...current, amount: event.target.value }))} placeholder="0.00" /></div>
                    </div>
                    <div className="take-order-custom-options take-order-custom-preferences">
                      <div className="take-order-custom-options-heading">
                        <div className="field-label font-semibold">Buyer options <span className="font-normal text-neutral-500">(optional)</span></div>
                        <button type="button" className="take-order-custom-add-group" onClick={() => setCustomDraft((current) => ({ ...current, preferences: [...current.preferences, { label: '', options: '' }] }))}><Plus size={16} />Add group</button>
                      </div>
                      <div className="take-order-custom-variant-label sr-only">Variant options area</div>
                      <div className="take-order-custom-option-chips" aria-label="Custom variant options">
                        {customDraft.preferences.flatMap((preference) => preference.options.split(',').map((option) => option.trim()).filter(Boolean)).map((option, index) => <span key={`${option}-${index}`} className="take-order-custom-option-chip">{option}<X size={12} aria-hidden="true" /></span>)}
                        {!customDraft.preferences.some((preference) => preference.options.split(',').some((option) => option.trim())) && <span className="take-order-custom-option-placeholder text-xs text-neutral-400">Add a group to define options</span>}
                      </div>
                      {customDraft.preferences.length > 0 && (
                        <div className="take-order-custom-preference-list">
                          {customDraft.preferences.map((preference, index) => (
                            <div key={index} className="take-order-custom-preference-row">
                              <input aria-label={`Custom option group ${index + 1} name`} value={preference.label} onChange={(event) => updateCustomPreference(index, 'label', event.target.value)} placeholder="Group name, e.g. Size" className="field-input" />
                              <input aria-label={`Choices for custom option group ${index + 1}`} value={preference.options} onChange={(event) => updateCustomPreference(index, 'options', event.target.value)} placeholder="Choices separated by commas" className="field-input" />
                              <button type="button" aria-label={`Remove custom option group ${index + 1}`} className="take-order-custom-preference-remove" onClick={() => setCustomDraft((current) => ({ ...current, preferences: current.preferences.filter((_, preferenceIndex) => preferenceIndex !== index) }))}><X size={14} /></button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="take-order-custom-builder">
                      <Button type="button" className="take-order-custom-add-item" variant="outline" disabled={!customDraft.name.trim() || !customDraft.amount} onClick={addCustomItem}><Plus size={15} />Add item</Button>
                    </div>
                  </section>
                  <TakeOrderCustomOrderPanel items={items} total={total} canContinue={canContinue} busy={busy} onRemove={(key) => setItems((current) => current.filter((candidate) => candidate.key !== key))} onUpdateAmount={updateAmount} />
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="take-order-checkout-wrapper">
                <div className="take-order-section sr-only"><h2>Review the client's checkout.</h2></div>
                <div className="take-order-checkout-stage">
                  <div className="take-order-step2-summary take-order-payment-checkout-card">
                    <TakeOrderCheckoutSummary items={items} total={total} paymentMode={paymentMode} deposit={deposit} deliveryFee={Number(deliveryFee) || 0} />
                  </div>

                  <div className="take-order-checkout-main">
                    <div className="rounded-[12px] border border-[hsl(var(--card-border))] bg-[hsl(var(--card))] p-5 shadow-xs mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-[14px] font-semibold text-[hsl(var(--foreground))]">Customer Details</div>
                        <span className="text-[12px] text-[hsl(var(--muted-foreground))]">Optional</span>
                      </div>
                      <p className="text-[12.5px] text-[hsl(var(--muted-foreground))] mb-3.5">
                        Pre-fill customer details from your chat, or leave blank to let the buyer fill them at checkout.
                      </p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <label className="block text-[12px] font-medium text-[hsl(var(--foreground))] mb-1" htmlFor="input-customer-name">
                            Customer Name
                          </label>
                          <input
                            id="input-customer-name"
                            data-testid="input-customer-name"
                            type="text"
                            value={customerName}
                            onChange={(e) => setCustomerName(e.target.value)}
                            placeholder="e.g. Sarah Mensah"
                            className="w-full h-9 px-3 rounded-[8px] border border-[hsl(var(--input))] bg-[hsl(var(--card))] text-[13px] text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/30 transition"
                          />
                        </div>
                        <div>
                          <label className="block text-[12px] font-medium text-[hsl(var(--foreground))] mb-1" htmlFor="input-customer-phone">
                            Phone / WhatsApp
                          </label>
                          <input
                            id="input-customer-phone"
                            data-testid="input-customer-phone"
                            type="tel"
                            value={customerPhone}
                            onChange={(e) => setCustomerPhone(e.target.value)}
                            placeholder="e.g. +233 24 123 4567"
                            className="w-full h-9 px-3 rounded-[8px] border border-[hsl(var(--input))] bg-[hsl(var(--card))] text-[13px] text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/30 transition"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-[12px] font-medium text-[hsl(var(--foreground))] mb-1" htmlFor="input-delivery-address">
                            Delivery Address
                          </label>
                          <input
                            id="input-delivery-address"
                            data-testid="input-delivery-address"
                            type="text"
                            value={deliveryAddress}
                            onChange={(e) => setDeliveryAddress(e.target.value)}
                            placeholder="e.g. House 14, East Legon, Accra"
                            className="w-full h-9 px-3 rounded-[8px] border border-[hsl(var(--input))] bg-[hsl(var(--card))] text-[13px] text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/30 transition"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="take-order-payment-config-card">
                      <div className="take-order-field-group">
                        <div className="field-label text-base font-semibold mb-2.5">How should they pay?</div>
                        <div className="take-order-payment-options">
                          {[
                            { value: 'full', title: 'Full Payment', note: 'Pay full total upfront' },
                            { value: 'deposit', title: 'Pay a Deposit', note: 'Part-payment upfront' },
                            { value: 'reserve', title: 'Make Reservation', note: 'Pay on delivery' },
                          ].map((opt) => (
                            <button
                              type="button"
                              key={opt.value}
                              onClick={() => { setPaymentMode(opt.value as 'full' | 'deposit' | 'reserve'); setFeedback(null); }}
                              data-testid={`button-payment-mode-${opt.value}`}
                              className={cn('take-order-payment-option', paymentMode === opt.value && 'is-selected')}
                            >
                              <div className="flex items-center justify-between w-full">
                                <span className={cn('take-order-radio', paymentMode === opt.value && 'is-selected')}>
                                  {paymentMode === opt.value && <span />}
                                </span>
                              </div>
                              <span>
                                <strong className="text-[13px] font-semibold">{opt.title}</strong>
                                <small className="text-[11px] text-neutral-500 leading-tight block mt-0.5">{opt.note}</small>
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {paymentMode === 'deposit' && (
                        <div className="take-order-deposit-field">
                          <label className="field-label font-semibold" htmlFor="input-order-deposit">
                            Deposit amount <span className="font-normal text-neutral-500">against {moneyExact(total)}</span>
                          </label>
                          <div className="take-order-deposit-presets" aria-label="Common deposit percentages">
                            {[25, 50, 75].map((percentage) => {
                              const presetAmount = (total * percentage / 100).toFixed(2);
                              const isSelected = Math.abs(Number(depositAmount) - Number(presetAmount)) < 0.005;
                              return (
                                <button
                                  type="button"
                                  key={percentage}
                                  className={cn('take-order-deposit-preset', isSelected && 'is-selected')}
                                  onClick={() => { setDepositAmount(presetAmount); setFeedback(null); }}
                                  data-testid={`button-deposit-preset-${percentage}`}
                                  aria-pressed={isSelected}
                                >
                                  <strong>{percentage}%</strong>
                                  <span>{moneyExact(total * percentage / 100)}</span>
                                </button>
                              );
                            })}
                          </div>
                          <div className="take-order-input-group mt-3">
                            <span className="take-order-input-prefix">{currencySymbol()}</span>
                            <input
                              id="input-order-deposit"
                              data-testid="input-order-deposit"
                              required
                              type="number"
                              min="0.01"
                              max={total}
                              step=".01"
                              value={depositAmount}
                              onFocus={(e) => e.target.select()}
                              onChange={(event) => { setDepositAmount(event.target.value); setFeedback(null); }}
                              className={cn('take-order-input-field', depositAmount && !validDeposit && 'is-invalid')}
                              placeholder="0.00"
                            />
                          </div>
                          {depositAmount && !validDeposit && <p className="take-order-field-error">Use an amount between {currencySymbol()}0.01 and {moneyExact(total)}.</p>}
                        </div>
                      )}

                      <div className="take-order-field-group">
                        <label className="field-label font-semibold" htmlFor="input-order-delivery-fee">Flat delivery fee</label>
                        <div className="take-order-input-group mt-1.5">
                          <span className="take-order-input-prefix">{currencySymbol()}</span>
                          <input
                            id="input-order-delivery-fee"
                            data-testid="input-order-delivery-fee"
                            type="number"
                            min="0"
                            step=".01"
                            value={deliveryFee}
                            onFocus={(e) => e.target.select()}
                            onChange={(event) => { setDeliveryFee(event.target.value); setFeedback(null); }}
                            className={cn('take-order-input-field', deliveryFee && !validDeliveryFee && 'is-invalid')}
                            placeholder="0.00"
                          />
                        </div>
                        <p className="take-order-field-help text-xs text-neutral-500 mt-1.5">Buyers choose pickup or delivery at checkout. This fee is only applied when they choose delivery.</p>
                      </div>

                      <div className="take-order-field-group">
                        <div className="field-label font-semibold mb-2">Conversation started on</div>
                        <ChannelPicker value={channel} onChange={setChannel} testId="select-order-channel" />
                      </div>

                      <div className="take-order-checkout-confirm-block pt-5 mt-2 border-t border-[hsl(var(--border))]">
                        {feedback && <TakeOrderFeedback message={feedback} />}
                        <Button
                          type="submit"
                          className="w-full h-11 text-sm font-semibold rounded-xl"
                          disabled={!canContinue || busy}
                          data-testid="button-create-order-link"
                        >
                          {busy && <Loader2 className="animate-spin" size={15} />}
                          Confirm checkout <ArrowRight size={15} />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="take-order-preview-stage">
                <div className="take-order-section sr-only"><h2>Review checkout.</h2></div>
                {feedback && (
                  <div className="max-w-[1180px] mx-auto mb-4">
                    <TakeOrderFeedback message={feedback} />
                  </div>
                )}

                <div className="mb-6 flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-2xl border border-border bg-card/80 backdrop-blur-sm shadow-xs">
                  <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 font-bold">
                      <Eye size={14} />
                    </span>
                    <span>
                      <strong className="font-semibold text-foreground">Interactive Buyer Checkout Preview:</strong> Try selecting options, entering details, or switching between pickup and delivery.
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-muted text-foreground">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Live Link Preview
                    </span>
                  </div>
                </div>

                <div className="take-order-buyer-preview-wrapper">
                  <BuyerOrderSurface
                    businessName={settingsQuery.data?.businessName || seller?.businessName || 'The Sunday Edit'}
                    description={seller?.description}
                    logoDataUrl={settingsQuery.data?.logoDataUrl || seller?.logoDataUrl}
                    productName={previewItems[previewIndex]?.productName}
                    amount={total}
                    totalAmount={total + deliveryFeeAmount}
                    paymentMode={paymentMode}
                    depositAmount={paymentMode === 'deposit' ? deposit : null}
                    variants={previewItems[previewIndex]?.variants ?? []}
                    items={previewItems}
                    previewImages={previewItems.map((p) => p.imageUrl || p.imageUrls?.[0] || '')}
                    activeIndex={previewIndex}
                    onActiveIndexChange={setPreviewIndex}
                    customLayout={true}
                  >
                    {(activeItem) => (
                      <TakeOrderBuyerPreviewForm
                        item={activeItem}
                        items={previewItems}
                        paymentMode={paymentMode}
                        subtotal={total}
                        deposit={deposit}
                        deliveryFee={deliveryFeeAmount}
                        itemIndex={previewIndex}
                        onActiveIndexChange={setPreviewIndex}
                      />
                    )}
                  </BuyerOrderSurface>
                </div>
              </div>
            )}

            {!catalogStage && !choiceOnly && !(step === 1 && itemSource === 'custom') && step === 1 && (
              <>
                <TakeOrderFeedback message={feedback} />
                <div className="take-order-form-footer">
                  <span className="take-order-footer-hint"><ShieldIcon /> No account connection needed</span>
                  <Button type="submit" disabled={!canContinue || busy || (step === 1 && productsQuery.isLoading)} data-testid="button-create-order-link">
                    {busy && <Loader2 className="animate-spin" size={15} />}
                    Continue <ArrowRight size={15} />
                  </Button>
                </div>
              </>
            )}
          </form>
        </div>
      </div>
      <ContextualUpgradeDialog
        open={Boolean(upgradeDialogReason)}
        onOpenChange={(open) => !open && setUpgradeDialogReason(null)}
        reason={upgradeDialogReason || 'link_limit'}
        tier={entitlements.tier}
      />
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
  const [paymentMode, setPaymentMode] = useState<'full' | 'deposit' | 'reserve' | null>(null);
  const [depositAmount, setDepositAmount] = useState('');
  const [channel, setChannel] = useState<OrderInput['channel'] | ''>('');
  const [created, setCreated] = useState<Order | null>(null);
  const [copied, setCopied] = useState(false);
  const total = items.reduce((sum, item) => sum + item.amount, 0);
  const previewItems: BuyerOrderItem[] = items.length
     ? items.map((item) => ({ productId: item.productId ?? item.key, productName: item.name, amount: item.amount, variants: item.variants, preferences: item.preferences, imageUrl: item.imageUrl, imageUrls: item.imageUrls, description: item.description, sku: item.sku, compareAtPrice: item.compareAtPrice, stock: item.stock, available: item.available, source: item.source }))
    : [{ productId: 0, productName: 'Your item', amount: 0, variants: [], preferences: [], source: 'catalog' }];
  const busy = createOrder.isPending || createProduct.isPending;
  const canContinue = step === 1
    ? items.length > 0
    : total > 0 && paymentMode !== null && Boolean(channel) && (paymentMode !== 'deposit' || (Boolean(depositAmount) && Number(depositAmount) <= total));

  const addCatalogItem = () => {
    const product = (productsQuery.data ?? []).find((item) => item.id === Number(catalogChoice));
    if (!product) return;
     setItems((current) => [...current, { key: nextKey, source: 'catalog', productId: product.id, name: product.name, amount: product.price, variants: product.variants, preferences: product.preferences, accent: product.accent, imageUrl: product.imageUrl ?? undefined, imageUrls: product.imageUrls, description: product.description, sku: product.sku, compareAtPrice: product.compareAtPrice, stock: product.stock, available: product.stock > 0 }]);
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
      paymentMode: paymentMode as OrderInput['paymentMode'],
      depositAmount: paymentMode === 'deposit' ? Number(depositAmount) : null,
      channel: channel as OrderInput['channel'],
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
  const link = created ? buildPublicOrderLink(created.token) : '';
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
  paymentMode: 'full' | 'deposit' | 'reserve' | null;
  depositAmount: number | null | undefined;
  totalAmount?: number;
  variants?: string[];
  items?: BuyerOrderItem[];
  previewImages?: Array<string | undefined>;
  activeIndex?: number;
  onActiveIndexChange?: (index: number) => void;
  isCheckout?: boolean;
  customLayout?: boolean;
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

export function BuyerOrderSurface({ businessName, description, logoDataUrl, productName, amount, paymentMode, depositAmount, totalAmount, variants = [], items, previewImages, activeIndex: controlledIndex, onActiveIndexChange, isCheckout = false, customLayout = false, children }: BuyerOrderSurfaceProps) {
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
        <h1 className="type-h2">Complete your order.</h1>
        <p className="mt-2 type-body">Your seller already has the item and price. Just provide the details they need to fulfill it.</p>
        <div className="buyer-total-amount" aria-label={`Total amount ${moneyExact(total)}`}><span>Total amount</span><strong>{moneyExact(total)}</strong></div>
      </div>
    </div>
    {customLayout ? (
      typeof children === 'function' ? children(activeItem) : children
    ) : (
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
    )}
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
  const [form, setForm] = useState<BuyerOrderFormValues>({ name: '', phone: '', deliveryMethod: undefined, address: '', orderDetails: '' });
  const [itemStep, setItemStep] = useState(0);
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
    setItemStep(0);
    setForm({ name: '', phone: '', deliveryMethod: undefined, address: '', orderDetails: '' });
  }, [order?.token, order?.items.length]);
  const change = (key: 'name' | 'phone' | 'deliveryMethod' | 'address' | 'orderDetails' | 'details', value: string) => {
    setSubmitError('');
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
  const handleNextItem = () => {
    if (order && itemStep < order.items.length - 1) {
      const activeItem = order.items[itemStep];
      const activeForm = itemForms[itemStep] ?? emptyBuyerItemForm();
      const missingPref = activeItem?.preferences.find((p) => !activeForm.preferences[p.label]);
      if (missingPref) {
        setSubmitError(`Please choose an option for ${missingPref.label}`);
        return;
      }
      const missingImg = order.checkoutAllowReferenceImages !== false && activeItem?.source === 'custom' && !activeForm.imagePreview;
      if (missingImg) {
        setSubmitError(`Please attach a reference photo for ${activeItem.productName}`);
        return;
      }
      setSubmitError('');
      setItemStep((prev) => prev + 1);
    }
  };
  const handlePrevItem = () => {
    setSubmitError('');
    setItemStep((prev) => Math.max(0, prev - 1));
  };
  const submitForm = (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitError('');

    if (order?.items) {
      for (let i = 0; i < order.items.length; i++) {
        const itm = order.items[i];
        const f = itemForms[i] ?? emptyBuyerItemForm();
        const missingPref = itm.preferences.find((p) => !f.preferences[p.label]);
        if (missingPref) {
          setItemStep(i);
          setSubmitError(`Please choose an option for ${missingPref.label}`);
          return;
        }
        const missingImg = order.checkoutAllowReferenceImages !== false && itm.source === 'custom' && !f.imagePreview;
        if (missingImg) {
          setItemStep(i);
          setSubmitError(`Please attach a reference photo for ${itm.productName}`);
          return;
        }
      }
    }

    if (!form.name.trim()) {
      setSubmitError('Please enter your name');
      return;
    }
    if (!form.phone.trim() || form.phone.trim().length < 5) {
      setSubmitError('Please enter your phone number');
      return;
    }
    if (!form.deliveryMethod) {
      setSubmitError('Please choose a delivery service');
      return;
    }
    if (form.deliveryMethod === 'delivery' && !form.address?.trim()) {
      setSubmitError('Please enter your delivery address');
      return;
    }

    const paymentAction = order?.paymentMode === 'reserve' ? 'reserve' : 'pay';
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
  if (submitted) return <div className="flex min-h-[100dvh] items-center justify-center bg-[hsl(var(--background))] p-6"><div className="w-full max-w-[480px] text-center page-in"><BrandLockup className="justify-center" /><div className="mx-auto mt-10 flex h-16 w-16 items-center justify-center rounded-[20px] bg-[hsl(var(--accent))] text-white"><Check size={30} /></div><h1 className="mt-7 font-display text-4xl font-bold tracking-[-.05em]">You’re all set.</h1><p className="mx-auto mt-4 max-w-[350px] text-sm leading-6 text-[hsl(var(--muted-foreground))]">{order.paymentMode === 'reserve' ? 'Your details have been sent to the seller. They’ll be in touch with the next step.' : 'Your order and payment details have been sent to the seller. They’ll be in touch with the next step.'}</p><div className="mt-8 font-mono-ui text-[10px] uppercase tracking-[.15em] text-[hsl(var(--muted-foreground))]">Order reference · {token.slice(0, 8)}</div></div></div>;
  const orderSubtotal = itemForms.length === order.items.length
    ? order.items.reduce((sum, item, index) => sum + item.amount * (itemForms[index]?.quantity ?? item.quantity ?? 1), 0)
    : order.subtotal ?? order.items.reduce((sum, item) => sum + item.amount * (item.quantity ?? 1), 0);
  const buyerDeliveryFee = form.deliveryMethod === 'delivery' ? order.deliveryFee : 0;
  const buyerTotal = orderSubtotal + buyerDeliveryFee;
  const uploadReferenceImage = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64Data = reader.result as string;
          const res = await customFetch<{ url: string }>('/api/upload', {
            method: 'POST',
            body: JSON.stringify({
              data: base64Data,
              filename: file.name,
            }),
          });
          resolve(res.url);
        } catch {
          resolve(file.name);
        }
      };
      reader.onerror = () => resolve(file.name);
      reader.readAsDataURL(file);
    });
  };
  const currentItemForm = itemForms[itemStep] ?? emptyBuyerItemForm();
  return <div className="min-h-[100dvh] bg-[hsl(var(--background))] px-4 sm:px-6 py-4 sm:py-8"><div className="mx-auto max-w-[1180px]"><BuyerOrderSurface businessName={order.businessName || 'The Sunday Edit'} description={order.businessDescription} logoDataUrl={order.logoDataUrl} productName={order.productName} amount={orderSubtotal} totalAmount={buyerTotal} paymentMode={order.paymentMode} depositAmount={order.depositAmount} variants={order.variants} items={order.items.map((item, index) => ({ ...item, quantity: itemForms[index]?.quantity ?? item.quantity ?? 1 }))} previewImages={itemForms.map((item) => item.imagePreview)} activeIndex={itemStep} onActiveIndexChange={() => undefined} customLayout={true}>{(activeItem) => <BuyerOrderForm paymentMode={order.paymentMode} amount={buyerTotal} depositAmount={order.depositAmount ?? 0} deliveryFee={order.deliveryFee} askForDetails={order.checkoutAskForDetails} allowReferenceImages={order.checkoutAllowReferenceImages} item={activeItem} itemIndex={itemStep} itemCount={order.items.length} items={order.items} itemForms={itemForms} form={form} itemForm={currentItemForm} submitPending={submit.isPending} submitError={submitError} onSubmit={submitForm} onChange={change} onItemChange={changeItem} onQuantityChange={changeQuantity} onPreferenceChange={(label, value) => { setSubmitError(''); setItemForms((current) => current.map((item, index) => index === itemStep ? { ...item, preferences: { ...item.preferences, [label]: value } } : item)); }} onNextItem={handleNextItem} onPrevItem={handlePrevItem} onBack={handlePrevItem} onReferenceImageChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; setSubmitError(''); changeItem('imagePreview', URL.createObjectURL(file)); changeItem('image', file.name); const uploadedUrl = await uploadReferenceImage(file); changeItem('image', uploadedUrl); }} onError={setSubmitError} />}</BuyerOrderSurface><div className="mt-6 text-center font-mono-ui text-[9px] uppercase tracking-[.15em] text-[hsl(var(--muted-foreground))] flex flex-wrap items-center justify-center gap-2"><span>Powered by Take Order · made for small businesses</span><span>·</span><Link href="/terms" target="_blank" className="hover:underline">Terms</Link><span>·</span><Link href="/privacy" target="_blank" className="hover:underline">Privacy</Link><span>·</span><Link href="/refund-policy" target="_blank" className="hover:underline">Refund Policy</Link></div></div></div>;
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
   return <Shell><div className="mx-auto max-w-[1060px]"><div className="mx-auto max-w-[640px] text-center"><div className="type-eyebrow text-[hsl(var(--muted-foreground))]">Store setup</div><h1 className="mt-3 font-display text-[clamp(32px,5vw,52px)] font-bold leading-[1.05] tracking-[-.04em]">Where you sell & how you get paid.</h1><p className="mx-auto mt-3 max-w-[560px] text-base leading-relaxed text-[hsl(var(--muted-foreground))]">Select the channels where you post stories and chat with buyers, plus your payment methods. These configure your order link channels and checkout preferences.</p><div className="mt-4 inline-flex items-center gap-2 rounded-full border border-[hsl(var(--accent))]/35 bg-[hsl(var(--accent))]/10 px-4 py-1.5 text-sm font-semibold text-[hsl(var(--accent-foreground))]"><ShieldIcon />Take Order works alongside your chats without requiring account access.</div></div><div className="mt-8 flex flex-col gap-3 border-b border-[hsl(var(--border))] pb-3 sm:flex-row sm:items-center sm:justify-between"><div className="type-eyebrow text-[hsl(var(--muted-foreground))]">Your active channels & rails</div><div className="flex flex-wrap items-center gap-3"><span className="flex items-center gap-1.5 text-sm font-semibold text-[hsl(var(--muted-foreground))]"><span className={cn('h-2 w-2 rounded-full', health.isError ? 'bg-[hsl(var(--destructive))]' : 'bg-[hsl(var(--accent))]')} />{health.isError ? 'Workspace check unavailable' : 'Workspace ready'}</span><Button type="button" variant="outline" onClick={clearAll} disabled={!connected.length} data-testid="button-clear-connected-tools">Clear all saved choices</Button></div></div><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{tools.map((tool) => { const isConnected = connected.includes(tool.name); const mark = markCatalog[tool.markKey]; return <button key={tool.name} onClick={() => toggle(tool.name)} aria-pressed={isConnected} aria-label={connectPreferenceAriaLabel(tool.name, isConnected)} data-testid={`button-connect-${tool.name.toLowerCase().replaceAll(' ', '-')}`} className={cn('tool-tile soft-focus group rounded-[17px] border p-4 text-left transition-all', isConnected ? 'border-[hsl(var(--accent))]/55 bg-[hsl(var(--accent))]/10 shadow-sm' : 'border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:border-[hsl(var(--muted-foreground))]/45')}><div className="flex items-start justify-between"><div className="tool-mark flex h-11 w-11 items-center justify-center rounded-[13px] bg-[hsl(var(--muted))]" style={{ color: mark.color }}><ChannelMark value={tool.markKey} size={22} /></div><span className={cn('rounded-full px-2.5 py-1 text-xs font-semibold', isConnected ? 'bg-[hsl(var(--accent))]/20 text-[hsl(var(--accent-foreground))]' : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]')}>{connectPreferenceLabel(isConnected)}</span></div><div className="mt-5 flex items-end justify-between gap-2"><div><div className="text-base font-bold">{tool.name}</div><div className="mt-1 text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">{tool.detail}</div></div><span className="font-mono-ui text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">{tool.group}</span></div></button>; })}</div><div className="mt-8 grid gap-4 lg:grid-cols-[1.15fr_.85fr]"><Card className="flex gap-4 p-5"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"><Link2 size={18} /></div><div><h2 className="text-base font-bold">No integration required to start selling.</h2><p className="mt-1.5 text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">Create buyer links, collect details, and track customer balances without connecting a personal social media account. These preferences configure your channel labels across Take Order.</p></div></Card><Card className="p-5"><div className="flex items-center gap-2 text-base font-bold"><Check size={16} className="text-[hsl(var(--accent-foreground))]" />{connected.length ? `${connected.length} channel preference${connected.length === 1 ? '' : 's'} active` : 'No channel preferences yet'}</div><p className="mt-2 text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">You can update these anytime. Your choices stay stored on this device.</p></Card></div></div></Shell>;
}
type SettingsSectionId = 'shop' | 'payments' | 'delivery' | 'preferences' | 'security' | 'billing' | 'data';

const settingsNavItems: Array<{
  id: SettingsSectionId;
  label: string;
  description: string;
  icon: any;
  keywords: string[];
}> = [
  { id: 'shop', label: 'General', description: 'Store identity, seller handle, storefront logo, active channels, and currency.', icon: Settings2, keywords: ['general', 'shop', 'profile', 'name', 'handle', 'logo', 'currency', 'channels', 'whatsapp', 'bio'] },
  { id: 'payments', label: 'Payments & Payouts', description: 'Payment defaults, deposit presets, and Mobile Money / Bank payout details.', icon: CreditCard, keywords: ['payments', 'payouts', 'momo', 'mobile money', 'bank', 'deposit', 'reserve', 'account'] },
  { id: 'delivery', label: 'Fulfillment & Pickup', description: 'Fulfillment options, flat delivery fee, and store pickup location.', icon: Truck, keywords: ['delivery', 'fulfillment', 'pickup', 'shipping', 'fee', 'address', 'hours'] },
  { id: 'preferences', label: 'Store Preferences', description: 'Workspace alert toggles, status updates, and table density.', icon: SlidersHorizontal, keywords: ['preferences', 'alerts', 'notifications', 'compact', 'tables', 'updates', 'stock'] },
  { id: 'security', label: 'Security & Login', description: 'Active session, multi-factor authentication, and account access.', icon: ShieldCheck, keywords: ['security', 'login', 'mfa', 'auth', 'password', 'sign out', 'logout', 'session'] },
  { id: 'billing', label: 'Billing & Subscription', description: 'Take Order Pro plan, billing status, and subscription management.', icon: Crown, keywords: ['billing', 'subscription', 'plan', 'pro', 'upgrade', 'revenuecat'] },
  { id: 'data', label: 'Data & Export', description: 'Export order data to CSV, workspace reset, and data controls.', icon: Clipboard, keywords: ['data', 'export', 'csv', 'download', 'backup', 'reset', 'danger'] },
];

const settingsItem = (id: string) => {
  if (id === 'general') return settingsNavItems[0];
  if (id === 'workflow' || id === 'advanced' || id === 'checkout') return settingsNavItems[3];
  if (id === 'pro' || id === 'pricing') return settingsNavItems[5];
  return settingsNavItems.find((item) => item.id === id) || settingsNavItems[0];
};

function SwitchControl({ checked, onChange, testId }: { checked: boolean; onChange: (checked: boolean) => void; testId?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      data-testid={testId}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none',
        checked ? 'bg-[#2563EB]' : 'bg-neutral-200 dark:bg-neutral-700'
      )}
    >
      <span
        className={cn(
          'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out mt-0.5',
          checked ? 'translate-x-5' : 'translate-x-0.5'
        )}
      />
    </button>
  );
}

type SettingsTab = 'profile' | 'store' | 'billing' | 'account';

function SettingsPage() {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const { userId, email, signOut } = useAppAuth();
  const clerk = useClerk();
  const entitlements = useEntitlements(userId);
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [searchQuery, setSearchQuery] = useState('');
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [showCurrencyModal, setShowCurrencyModal] = useState(false);
  const [pendingCurrency, setPendingCurrency] = useState<SellerSettings['currency'] | null>(null);
  const [settingsBillingCadence, setSettingsBillingCadence] = useState<'monthly' | 'annual'>('annual');

  const [profile, setProfile] = useState<SellerProfile>(() => readSellerProfile() || { sellerName: '', businessName: '', description: '', channels: [] });
  const [preferences, setPreferences] = useState<SellerSettingsPreferences>(() => readSellerSettings());
  const settingsQuery = useGetSellerSettings();
  const saveSettingsMutation = useUpdateSellerSettings();
  const ordersQuery = useListOrders();
  const [settings, setSettings] = useState<SellerSettings>(emptySellerSettings);

  const [savingSection, setSavingSection] = useState<string | null>(null);
  const [savedSection, setSavedSection] = useState<string | null>(null);
  const [sectionErrors, setSectionErrors] = useState<Record<string, string>>({});
  const [logoError, setLogoError] = useState('');
  const [exported, setExported] = useState(false);
  const [copiedPayment, setCopiedPayment] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

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
      organizationPhone: local?.whatsappPhone || settingsQuery.data.organizationPhone || '',
      organizationAddress: local?.pickupAddress || settingsQuery.data.organizationAddress || '',
      trackingId: local?.pickupHours || settingsQuery.data.trackingId || '',
      seoTitle: local?.momoNetwork || settingsQuery.data.seoTitle || 'MTN MoMo',
      customDomain: local?.momoNumber || settingsQuery.data.customDomain || '',
      organizationName: local?.momoName || settingsQuery.data.organizationName || '',
      organizationEmail: local?.bankName || settingsQuery.data.organizationEmail || '',
      seoDescription: local?.bankAccount || settingsQuery.data.seoDescription || '',
    };
    setSettings(next);
    setProfile({
      sellerName: next.sellerName,
      businessName: next.businessName,
      description: next.description,
      channels: next.channels,
      whatsappPhone: next.organizationPhone,
      pickupAddress: next.organizationAddress,
      pickupHours: next.trackingId,
      momoNetwork: next.seoTitle,
      momoNumber: next.customDomain,
      momoName: next.organizationName,
      bankName: next.organizationEmail,
      bankAccount: next.seoDescription,
      currency: next.currency,
      ...(next.logoDataUrl ? { logoDataUrl: next.logoDataUrl } : {}),
    });
    setPreferences({ orderUpdates: next.orderUpdates, stockAlerts: next.stockAlerts, compactTables: next.compactTables });
  }, [settingsQuery.data]);

  const updateProfileField = (key: keyof SellerProfile, value: string) => {
    setProfile((current) => ({ ...current, [key]: value }));
    if (key !== 'logoDataUrl') setSettings((current) => ({ ...current, [key]: value }));
    setHasUnsavedChanges(true);
    setSavedSection(null);
  };

  const setSetting = <K extends keyof SellerSettings>(key: K, value: SellerSettings[K]) => {
    setSettings((current) => ({ ...current, [key]: value }));
    setHasUnsavedChanges(true);
    setSavedSection(null);
  };

  const setPreference = (key: keyof SellerSettingsPreferences, value: boolean) => {
    const updated = { ...preferences, [key]: value };
    setPreferences(updated);
    setSettings((current) => ({ ...current, [key]: value }));
    writeSellerSettings(updated);
    if (key === 'compactTables') {
      document.body.classList.toggle('compact-tables-active', value);
    }
    setHasUnsavedChanges(true);
    setSavedSection(null);
  };

  const validateE164Phone = (phone: string): boolean => {
    if (!phone.trim()) return true;
    const stripped = phone.replace(/[\s\-\(\)]/g, '');
    return /^\+[1-9]\d{6,14}$/.test(stripped);
  };

  const saveCardSection = (sectionName: string) => {
    // Validation
    const errors: Record<string, string> = {};
    const phoneToValidate = profile.whatsappPhone || settings.organizationPhone;
    if (phoneToValidate && !validateE164Phone(phoneToValidate)) {
      errors.phone = 'Phone must be in international E.164 format (e.g. +233 24 123 4567)';
    }

    if (Object.keys(errors).length > 0) {
      setSectionErrors(errors);
      return;
    }

    setSectionErrors({});
    setSavingSection(sectionName);

    saveSettingsMutation.mutate({ data: settings }, {
      onSuccess: (data) => {
        setSettings(data);
        const mergedProfile = {
          ...profile,
          sellerName: data.sellerName,
          businessName: data.businessName,
          description: data.description,
          channels: data.channels,
          currency: data.currency,
          whatsappPhone: data.organizationPhone,
          pickupAddress: data.organizationAddress,
          pickupHours: data.trackingId,
          momoNetwork: data.seoTitle,
          momoNumber: data.customDomain,
          momoName: data.organizationName,
          bankName: data.organizationEmail,
          bankAccount: data.seoDescription,
          ...(data.logoDataUrl ? { logoDataUrl: data.logoDataUrl } : {}),
        };
        setProfile(mergedProfile);
        writeSellerProfile(mergedProfile);
        writeSellerSettings({ orderUpdates: data.orderUpdates, stockAlerts: data.stockAlerts, compactTables: data.compactTables });
        setActiveCurrency(data.currency);
        queryClient.setQueryData(getGetSellerSettingsQueryKey(), data);
        setSavingSection(null);
        setSavedSection(sectionName);
        setHasUnsavedChanges(false);
        setTimeout(() => setSavedSection((curr) => (curr === sectionName ? null : curr)), 3000);
      },
      onError: (error) => {
        setSavingSection(null);
        setSectionErrors({ [sectionName]: formatUserFacingError(error, 'Could not save settings. Please retry.') });
      },
    });
  };

  const handleLogoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setLogoError('Choose an image file (PNG, JPG, WebP, SVG).');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setLogoError('Image size must be smaller than 10 MB.');
      return;
    }
    compressImageFile(file, 600, 0.9).then((logoDataUrl) => {
      setLogoError('');
      setProfile((current) => ({ ...current, logoDataUrl }));
      setSettings((current) => ({ ...current, logoDataUrl }));
      setHasUnsavedChanges(true);
    }).catch(() => {
      setLogoError('That image could not be read. Try another file.');
    });
  };

  const removeLogo = () => {
    setProfile((current) => {
      const next = { ...current };
      delete next.logoDataUrl;
      return next;
    });
    setSettings((current) => ({ ...current, logoDataUrl: null }));
    setHasUnsavedChanges(true);
  };

  const copyPaymentDetails = async () => {
    const net = profile.momoNetwork || settings.seoTitle || 'MTN MoMo';
    const num = profile.momoNumber || settings.customDomain || '';
    const name = profile.momoName || settings.organizationName || profile.businessName || '';
    const bank = profile.bankName || settings.organizationEmail || '';
    const bankAcc = profile.bankAccount || settings.seoDescription || '';
    let text = `💳 Payment Details for ${profile.businessName || 'our shop'}:\n`;
    if (num) text += `• ${net}: ${num} (${name})\n`;
    if (bank && bankAcc) text += `• Bank: ${bank} — A/C: ${bankAcc}\n`;
    try {
      if (navigator.clipboard) await navigator.clipboard.writeText(text);
      setCopiedPayment(true);
      setTimeout(() => setCopiedPayment(false), 2000);
    } catch {}
  };

  const testWhatsAppLink = () => {
    const phone = profile.whatsappPhone || settings.organizationPhone;
    if (!phone) {
      alert('Please enter your WhatsApp contact number first.');
      return;
    }
    openWhatsApp(phone, `Hello! Testing WhatsApp contact connection from ${profile.businessName || 'my Take Order store'}.`);
  };

  const handleCurrencySelect = (newCurr: SellerSettings['currency']) => {
    const ordersCount = ordersQuery.data?.length ?? 0;
    if (ordersCount > 0 && newCurr !== settings.currency) {
      setPendingCurrency(newCurr);
      setShowCurrencyModal(true);
    } else {
      setSetting('currency', newCurr);
      updateProfileField('currency', newCurr);
      setActiveCurrency(newCurr);
    }
  };

  const confirmCurrencyChange = () => {
    if (pendingCurrency) {
      setSetting('currency', pendingCurrency);
      updateProfileField('currency', pendingCurrency);
      setActiveCurrency(pendingCurrency);
      setShowCurrencyModal(false);
      setPendingCurrency(null);
    }
  };

  const exportOrdersToCsv = (orders: Order[]) => {
    const headers = ['Order ID', 'Date', 'Customer Name', 'Phone', 'Product / Items', 'Channel', 'Delivery Fee', 'Total', 'Payment Mode', 'Status', 'Fulfillment'];
    const rows = orders.map((o) => [
      sanitizeCsvCell(`#${o.id}`),
      sanitizeCsvCell(o.createdAt ? new Date(o.createdAt).toLocaleDateString() : ''),
      sanitizeCsvCell(o.customerName || ''),
      sanitizeCsvCell(o.customerPhone || ''),
      sanitizeCsvCell(o.productName || ''),
      sanitizeCsvCell(o.channel || ''),
      sanitizeCsvCell((o.deliveryFee || 0).toFixed(2)),
      sanitizeCsvCell(o.amount.toFixed(2)),
      sanitizeCsvCell(o.paymentMode || 'full'),
      sanitizeCsvCell(o.status),
      sanitizeCsvCell(o.fulfillment),
    ]);
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `takeorder-orders-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const resetWorkspace = () => {
    if (resetConfirmText.trim().toUpperCase() !== 'RESET') return;
    setSettings(emptySellerSettings);
    setProfile({ sellerName: '', businessName: '', description: '', channels: [] });
    setPreferences(defaultSellerPreferences);
    saveSettingsMutation.mutate({ data: emptySellerSettings });
    setShowResetModal(false);
    setResetConfirmText('');
  };

  const filteredMatchesSearch = (keywords: string[]) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return keywords.some((k) => k.toLowerCase().includes(q));
  };

  // Card footer with Save button
  const renderCardFooter = (sectionKey: string) => {
    const isSaving = savingSection === sectionKey;
    const isSaved = savedSection === sectionKey;
    const errorMsg = sectionErrors[sectionKey];

    return (
      <div className="pt-4 mt-5 border-t border-[hsl(var(--border))] flex items-center justify-between gap-3">
        <div>
          {errorMsg ? (
            <span className="text-xs text-rose-600 font-medium">{errorMsg}</span>
          ) : isSaved ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
              <CheckCircle2 size={13} />
              <span>Saved successfully</span>
            </span>
          ) : (
            <span className="text-[11px] text-[hsl(var(--muted-foreground))]">
              {hasUnsavedChanges ? 'Unsaved changes' : 'All changes saved'}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => saveCardSection(sectionKey)}
          disabled={isSaving}
          className="inline-flex items-center gap-1.5 h-9 px-4 rounded-[8px] bg-neutral-900 text-white text-xs font-medium hover:bg-neutral-800 disabled:opacity-50 transition cursor-pointer dark:bg-white dark:text-neutral-900"
          data-testid={`button-save-${sectionKey}`}
        >
          {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
          <span>{isSaving ? 'Saving...' : 'Save changes'}</span>
        </button>
      </div>
    );
  };

  return (
    <Shell>
      <PageHeader
        title="Settings"
        tabs={
          <div className="overflow-x-auto pb-1">
            <SegmentedControl
              ariaLabel="Settings navigation tabs"
              value={activeTab}
              onChange={(val) => setActiveTab(val as SettingsTab)}
              options={[
                { value: 'profile', label: 'Profile', icon: <UserRound size={14} />, testId: 'tab-settings-profile' },
                { value: 'store', label: 'Store & Payments', icon: <Store size={14} />, testId: 'tab-settings-store' },
                { value: 'billing', label: 'Billing & Plan', icon: <Crown size={14} />, testId: 'tab-settings-billing' },
                { value: 'account', label: 'Account & Security', icon: <ShieldCheck size={14} />, testId: 'tab-settings-account' },
              ]}
            />
          </div>
        }
        search={{
          value: searchQuery,
          onChange: setSearchQuery,
          placeholder: 'Search settings...',
        }}
      />

      <div className="max-w-[840px] mx-auto pb-12">

        {/* Loading Skeletons */}
        {settingsQuery.isLoading && (
          <div className="space-y-5 animate-pulse">
            <div className="h-48 rounded-[12px] bg-neutral-100 dark:bg-neutral-800" />
            <div className="h-48 rounded-[12px] bg-neutral-100 dark:bg-neutral-800" />
          </div>
        )}

        {/* Error State */}
        {settingsQuery.isError && (
          <div className="rounded-[12px] border border-rose-200 bg-rose-50 p-6 text-center dark:bg-rose-950/20 dark:border-rose-900">
            <AlertTriangle className="mx-auto text-rose-600 mb-2" size={24} />
            <h3 className="text-sm font-semibold text-rose-900 dark:text-rose-200">Unable to load settings</h3>
            <p className="text-xs text-rose-700 dark:text-rose-400 mt-1">Please check your network connection and retry.</p>
            <Button type="button" variant="outline" className="mt-4" onClick={() => settingsQuery.refetch()}>
              Retry
            </Button>
          </div>
        )}

        {!settingsQuery.isLoading && !settingsQuery.isError && (
          <div className="space-y-6">
            {/* 1. PROFILE TAB */}
            {activeTab === 'profile' && (
              <>
                {filteredMatchesSearch(['storefront', 'identity', 'business', 'name', 'handle', 'bio', 'logo']) && (
                  <div className="rounded-[12px] border border-[hsl(var(--card-border))] bg-white p-6 shadow-xs dark:bg-neutral-900">
                    <div className="mb-4">
                      <h3 className="text-[15px] font-semibold text-[hsl(var(--foreground))]">Storefront Identity</h3>
                      <p className="text-[12px] text-[hsl(var(--muted-foreground))] mt-0.5">
                        Your public business profile displayed on order checkout links.
                      </p>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="block text-[12px] font-medium text-[hsl(var(--foreground))] mb-1" htmlFor="input-settings-bizname">
                          Business / Shop Name <span className="text-rose-500">*</span>
                        </label>
                        <input
                          id="input-settings-bizname"
                          data-testid="input-settings-business-name"
                          type="text"
                          value={settings.businessName}
                          onChange={(e) => updateProfileField('businessName', e.target.value)}
                          placeholder="e.g. The Sunday Edit"
                          className="w-full h-10 px-3.5 rounded-[8px] border border-[hsl(var(--input))] bg-[hsl(var(--card))] text-[13px] text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/30 transition"
                        />
                      </div>

                      <div>
                        <label className="block text-[12px] font-medium text-[hsl(var(--foreground))] mb-1" htmlFor="input-settings-sellerhandle">
                          Seller Handle
                        </label>
                        <input
                          id="input-settings-sellerhandle"
                          data-testid="input-settings-seller-name"
                          type="text"
                          value={settings.sellerName}
                          onChange={(e) => updateProfileField('sellerName', e.target.value)}
                          placeholder="e.g. @amina.style"
                          className="w-full h-10 px-3.5 rounded-[8px] border border-[hsl(var(--input))] bg-[hsl(var(--card))] text-[13px] text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/30 transition"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-[12px] font-medium text-[hsl(var(--foreground))] mb-1" htmlFor="input-settings-shopbio">
                          Shop Bio / Description
                        </label>
                        <textarea
                          id="input-settings-shopbio"
                          data-testid="input-settings-description"
                          rows={2}
                          maxLength={300}
                          value={settings.description}
                          onChange={(e) => updateProfileField('description', e.target.value)}
                          placeholder="Brief description shown to buyers on your order links..."
                          className="w-full px-3.5 py-2 rounded-[8px] border border-[hsl(var(--input))] bg-[hsl(var(--card))] text-[13px] text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/30 transition resize-none"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-[12px] font-medium text-[hsl(var(--foreground))] mb-1">
                          Storefront Logo
                        </label>
                        <div className="flex items-center gap-3 mt-1.5">
                          <SellerLogo
                            businessName={settings.businessName || 'Your store'}
                            logoDataUrl={settings.logoDataUrl ?? undefined}
                            className="h-12 w-12 rounded-[10px] object-cover border border-[hsl(var(--border))] shrink-0"
                          />
                          <div className="flex items-center gap-2">
                            <label className="inline-flex cursor-pointer items-center gap-1.5 px-3 py-1.5 rounded-[8px] border border-[hsl(var(--border))] bg-white dark:bg-neutral-800 text-xs font-semibold text-neutral-800 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-700 transition">
                              <ImagePlus size={13} />
                              <span>{settings.logoDataUrl ? 'Change' : 'Upload logo'}</span>
                              <input
                                type="file"
                                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                                className="sr-only"
                                onChange={handleLogoChange}
                              />
                            </label>
                            {settings.logoDataUrl && (
                              <button
                                type="button"
                                onClick={removeLogo}
                                className="px-2.5 py-1.5 rounded-[8px] border border-[hsl(var(--border))] text-xs text-rose-600 hover:border-rose-300 transition cursor-pointer"
                              >
                                <X size={13} />
                              </button>
                            )}
                          </div>
                        </div>
                        {logoError && <p className="text-xs text-rose-600 mt-1">{logoError}</p>}
                      </div>
                    </div>

                    {renderCardFooter('identity')}
                  </div>
                )}

                {filteredMatchesSearch(['whatsapp', 'phone', 'contact', 'channels', 'social', 'instagram', 'tiktok']) && (
                  <div className="rounded-[12px] border border-[hsl(var(--card-border))] bg-white p-6 shadow-xs dark:bg-neutral-900">
                    <div className="mb-4">
                      <h3 className="text-[15px] font-semibold text-[hsl(var(--foreground))]">Contact & Active Channels</h3>
                      <p className="text-[12px] text-[hsl(var(--muted-foreground))] mt-0.5">
                        Buyer inquiry channels and WhatsApp links.
                      </p>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[12px] font-medium text-[hsl(var(--foreground))]" htmlFor="input-settings-whatsapp">
                            WhatsApp Contact Number
                          </label>
                          {(profile.whatsappPhone || settings.organizationPhone) && (
                            <button
                              type="button"
                              onClick={testWhatsAppLink}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 hover:underline cursor-pointer"
                            >
                              <Send size={11} className="text-[#25D366]" />
                              <span>Test link</span>
                            </button>
                          )}
                        </div>
                        <input
                          id="input-settings-whatsapp"
                          data-testid="input-settings-whatsapp-phone"
                          type="tel"
                          value={profile.whatsappPhone ?? settings.organizationPhone}
                          onChange={(e) => {
                            updateProfileField('whatsappPhone', e.target.value);
                            setSetting('organizationPhone', e.target.value);
                          }}
                          placeholder="+233 24 123 4567"
                          className={cn(
                            'w-full h-10 px-3.5 rounded-[8px] border bg-[hsl(var(--card))] text-[13px] text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/30 transition',
                            sectionErrors.phone ? 'border-rose-400' : 'border-[hsl(var(--input))]'
                          )}
                        />
                        <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-1">
                          Must be in international E.164 format including country code (e.g. +233241234567).
                        </p>
                        {sectionErrors.phone && <p className="text-xs text-rose-600 mt-1">{sectionErrors.phone}</p>}
                      </div>

                      <div>
                        <label className="block text-[12px] font-medium text-[hsl(var(--foreground))] mb-2">
                          Active Sales Channels
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {[
                            { key: 'WhatsApp', mark: 'whatsapp' },
                            { key: 'Instagram', mark: 'instagram' },
                            { key: 'TikTok', mark: 'tiktok' },
                            { key: 'Snapchat', mark: 'snapchat' },
                            { key: 'Facebook', mark: 'facebook' },
                            { key: 'X', mark: 'x' },
                          ].map((ch) => {
                            const isActive = profile.channels.includes(ch.key);
                            return (
                              <button
                                type="button"
                                key={ch.key}
                                onClick={() => {
                                  const updated = isActive
                                    ? profile.channels.filter((c) => c !== ch.key)
                                    : [...profile.channels, ch.key];
                                  setProfile((prev) => ({ ...prev, channels: updated }));
                                  setSettings((prev) => ({ ...prev, channels: updated }));
                                  setHasUnsavedChanges(true);
                                }}
                                className={cn(
                                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition cursor-pointer',
                                  isActive
                                    ? 'bg-neutral-900 text-white border-neutral-900 dark:bg-white dark:text-neutral-900'
                                    : 'bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700 hover:border-neutral-400'
                                )}
                              >
                                <ChannelMark value={ch.mark as any} size={12} colorful={!isActive} />
                                <span>{ch.key}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {renderCardFooter('channels')}
                  </div>
                )}
              </>
            )}

            {/* 2. STORE & PAYMENTS TAB */}
            {activeTab === 'store' && (
              <>
                {filteredMatchesSearch(['currency', 'base', 'cedi', 'pricing', 'money']) && (
                  <div className="rounded-[12px] border border-[hsl(var(--card-border))] bg-white p-6 shadow-xs dark:bg-neutral-900">
                    <div className="mb-4">
                      <h3 className="text-[15px] font-semibold text-[hsl(var(--foreground))]">Store Base Currency</h3>
                      <p className="text-[12px] text-[hsl(var(--muted-foreground))] mt-0.5">
                        The primary currency used for order totals, pricing, and analytics.
                      </p>
                    </div>

                    <div className="max-w-xs">
                      <label className="block text-[12px] font-medium text-[hsl(var(--foreground))] mb-1" htmlFor="select-settings-currency">
                        Base Currency
                      </label>
                      <div className="relative">
                        <select
                          id="select-settings-currency"
                          data-testid="select-settings-currency"
                          value={settings.currency}
                          onChange={(e) => handleCurrencySelect(e.target.value as SellerSettings['currency'])}
                          className="w-full appearance-none h-10 pl-3.5 pr-8 rounded-[8px] border border-[hsl(var(--input))] bg-[hsl(var(--card))] text-[13px] font-medium text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/30 transition cursor-pointer"
                        >
                          {storeCurrencyOptions.map((opt) => (
                            <option key={opt.currency} value={opt.currency}>
                              {opt.label} ({opt.currency})
                            </option>
                          ))}
                        </select>
                        <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                      </div>
                      <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-1.5">
                        Orders count: {ordersQuery.data?.length ?? 0} existing order{(ordersQuery.data?.length ?? 0) === 1 ? '' : 's'}.
                      </p>
                    </div>

                    {renderCardFooter('currency')}
                  </div>
                )}

                {filteredMatchesSearch(['delivery', 'fulfillment', 'pickup', 'shipping', 'fee', 'address', 'hours']) && (
                  <div className="rounded-[12px] border border-[hsl(var(--card-border))] bg-white p-6 shadow-xs dark:bg-neutral-900">
                    <div className="mb-4">
                      <h3 className="text-[15px] font-semibold text-[hsl(var(--foreground))]">Fulfillment & Pickup</h3>
                      <p className="text-[12px] text-[hsl(var(--muted-foreground))] mt-0.5">
                        Options presented to buyers when choosing how they receive their items.
                      </p>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="block text-[12px] font-medium text-[hsl(var(--foreground))] mb-1" htmlFor="select-settings-fulfillment">
                          Fulfillment Mode
                        </label>
                        <select
                          id="select-settings-fulfillment"
                          value={settings.deliveryDefault}
                          onChange={(e) => setSetting('deliveryDefault', e.target.value as SellerSettings['deliveryDefault'])}
                          className="w-full h-10 px-3 rounded-[8px] border border-[hsl(var(--input))] bg-[hsl(var(--card))] text-[13px] text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/30 transition"
                        >
                          <option value="both">Let buyers choose (Delivery or Pickup)</option>
                          <option value="delivery">Delivery only</option>
                          <option value="pickup">Store pickup only</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[12px] font-medium text-[hsl(var(--foreground))] mb-1" htmlFor="input-settings-deliveryfee">
                          Flat Delivery Fee
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-neutral-500">
                            {currencySymbol()}
                          </span>
                          <input
                            id="input-settings-deliveryfee"
                            data-testid="input-settings-delivery-fee"
                            type="number"
                            min="0"
                            step="0.01"
                            value={settings.deliveryFee != null && settings.deliveryFee > 0 ? settings.deliveryFee : ''}
                            onChange={(e) => setSetting('deliveryFee', Math.max(0, Number(e.target.value) || 0))}
                            placeholder="0.00"
                            className="w-full h-10 pl-8 pr-3.5 rounded-[8px] border border-[hsl(var(--input))] bg-[hsl(var(--card))] text-[13px] text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/30 transition"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[12px] font-medium text-[hsl(var(--foreground))] mb-1" htmlFor="input-settings-pickupaddr">
                          Store Pickup Address
                        </label>
                        <input
                          id="input-settings-pickupaddr"
                          data-testid="input-settings-pickup-address"
                          type="text"
                          value={profile.pickupAddress ?? settings.organizationAddress}
                          onChange={(e) => {
                            updateProfileField('pickupAddress', e.target.value);
                            setSetting('organizationAddress', e.target.value);
                          }}
                          placeholder="e.g. Shop 14, Osu Oxford Street, Accra"
                          className="w-full h-10 px-3.5 rounded-[8px] border border-[hsl(var(--input))] bg-[hsl(var(--card))] text-[13px] text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/30 transition"
                        />
                      </div>

                      <div>
                        <label className="block text-[12px] font-medium text-[hsl(var(--foreground))] mb-1" htmlFor="input-settings-pickuphours">
                          Collection Hours
                        </label>
                        <input
                          id="input-settings-pickuphours"
                          data-testid="input-settings-pickup-hours"
                          type="text"
                          value={profile.pickupHours ?? settings.trackingId}
                          onChange={(e) => {
                            updateProfileField('pickupHours', e.target.value);
                            setSetting('trackingId', e.target.value);
                          }}
                          placeholder="e.g. Mon–Sat 9:00 AM – 6:30 PM"
                          className="w-full h-10 px-3.5 rounded-[8px] border border-[hsl(var(--input))] bg-[hsl(var(--card))] text-[13px] text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/30 transition"
                        />
                      </div>
                    </div>

                    {renderCardFooter('fulfillment')}
                  </div>
                )}

                {filteredMatchesSearch(['payment', 'payout', 'momo', 'mobile money', 'bank', 'transfer']) && (
                  <div className="rounded-[12px] border border-[hsl(var(--card-border))] bg-white p-6 shadow-xs dark:bg-neutral-900">
                    <div className="mb-4">
                      <h3 className="text-[15px] font-semibold text-[hsl(var(--foreground))]">Payment & Payout Rails</h3>
                      <p className="text-[12px] text-[hsl(var(--muted-foreground))] mt-0.5">
                        The recipient accounts shown to buyers sending Mobile Money or bank transfers.
                      </p>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="block text-[12px] font-medium text-[hsl(var(--foreground))] mb-1" htmlFor="select-settings-momonet">
                          Mobile Money Network
                        </label>
                        <select
                          id="select-settings-momonet"
                          value={profile.momoNetwork || settings.seoTitle || 'MTN MoMo'}
                          onChange={(e) => {
                            updateProfileField('momoNetwork', e.target.value);
                            setSetting('seoTitle', e.target.value);
                          }}
                          className="w-full h-10 px-3 rounded-[8px] border border-[hsl(var(--input))] bg-[hsl(var(--card))] text-[13px] text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/30 transition"
                        >
                          {['MTN MoMo', 'Telecel Cash', 'AT Money', 'M-Pesa', 'Other'].map((net) => (
                            <option key={net} value={net}>
                              {net}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[12px] font-medium text-[hsl(var(--foreground))] mb-1" htmlFor="input-settings-momonum">
                          MoMo Phone / Till Number
                        </label>
                        <input
                          id="input-settings-momonum"
                          data-testid="input-settings-momo-number"
                          type="text"
                          value={profile.momoNumber ?? settings.customDomain}
                          onChange={(e) => {
                            updateProfileField('momoNumber', e.target.value);
                            setSetting('customDomain', e.target.value);
                          }}
                          placeholder="e.g. 024 123 4567"
                          className="w-full h-10 px-3.5 rounded-[8px] border border-[hsl(var(--input))] bg-[hsl(var(--card))] text-[13px] text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/30 transition"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-[12px] font-medium text-[hsl(var(--foreground))] mb-1" htmlFor="input-settings-momoname">
                          MoMo Account Name
                        </label>
                        <input
                          id="input-settings-momoname"
                          data-testid="input-settings-momo-name"
                          type="text"
                          value={profile.momoName ?? settings.organizationName}
                          onChange={(e) => {
                            updateProfileField('momoName', e.target.value);
                            setSetting('organizationName', e.target.value);
                          }}
                          placeholder="e.g. Amina Mensah / Sunday Edit"
                          className="w-full h-10 px-3.5 rounded-[8px] border border-[hsl(var(--input))] bg-[hsl(var(--card))] text-[13px] text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/30 transition"
                        />
                      </div>

                      <div>
                        <label className="block text-[12px] font-medium text-[hsl(var(--foreground))] mb-1" htmlFor="input-settings-bankname">
                          Bank Name <span className="font-normal text-neutral-400">(optional)</span>
                        </label>
                        <input
                          id="input-settings-bankname"
                          data-testid="input-settings-bank-name"
                          type="text"
                          value={profile.bankName ?? settings.organizationEmail}
                          onChange={(e) => {
                            updateProfileField('bankName', e.target.value);
                            setSetting('organizationEmail', e.target.value);
                          }}
                          placeholder="e.g. Ecobank / Access Bank"
                          className="w-full h-10 px-3.5 rounded-[8px] border border-[hsl(var(--input))] bg-[hsl(var(--card))] text-[13px] text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/30 transition"
                        />
                      </div>

                      <div>
                        <label className="block text-[12px] font-medium text-[hsl(var(--foreground))] mb-1" htmlFor="input-settings-bankacc">
                          Bank Account Number / IBAN <span className="font-normal text-neutral-400">(optional)</span>
                        </label>
                        <input
                          id="input-settings-bankacc"
                          data-testid="input-settings-bank-account"
                          type="text"
                          value={profile.bankAccount ?? settings.seoDescription}
                          onChange={(e) => {
                            updateProfileField('bankAccount', e.target.value);
                            setSetting('seoDescription', e.target.value);
                          }}
                          placeholder="e.g. 0123456789012"
                          className="w-full h-10 px-3.5 rounded-[8px] border border-[hsl(var(--input))] bg-[hsl(var(--card))] text-[13px] text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/30 transition"
                        />
                      </div>
                    </div>

                    {/* Payment Prompt Preview */}
                    <div className="mt-5 p-4 rounded-[10px] border border-[hsl(var(--border))] bg-neutral-50 dark:bg-neutral-800/40">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
                          Buyer Payment Prompt Preview
                        </span>
                        <button
                          type="button"
                          onClick={copyPaymentDetails}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] bg-white dark:bg-neutral-700 border border-[hsl(var(--border))] text-xs font-medium text-neutral-800 dark:text-neutral-200 hover:bg-neutral-50 transition cursor-pointer"
                        >
                          {copiedPayment ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                          <span>{copiedPayment ? 'Copied' : 'Copy prompt'}</span>
                        </button>
                      </div>
                      <div className="text-xs space-y-1 text-neutral-700 dark:text-neutral-300">
                        <div>
                          <strong>{profile.momoNetwork || settings.seoTitle || 'MTN MoMo'}:</strong>{' '}
                          <span className="font-mono">{profile.momoNumber || settings.customDomain || 'No number set'}</span>{' '}
                          ({profile.momoName || settings.organizationName || 'Name'})
                        </div>
                        {(profile.bankName || settings.organizationEmail) && (
                          <div>
                            <strong>Bank:</strong> {profile.bankName || settings.organizationEmail} —{' '}
                            <span className="font-mono">{profile.bankAccount || settings.seoDescription}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {renderCardFooter('payouts')}
                  </div>
                )}

                {filteredMatchesSearch(['preference', 'alert', 'notification', 'compact', 'table']) && (
                  <div className="rounded-[12px] border border-[hsl(var(--card-border))] bg-white p-6 shadow-xs dark:bg-neutral-900">
                    <div className="mb-4">
                      <h3 className="text-[15px] font-semibold text-[hsl(var(--foreground))]">Store Preferences</h3>
                      <p className="text-[12px] text-[hsl(var(--muted-foreground))] mt-0.5">
                        Alert toggles and dashboard display density.
                      </p>
                    </div>

                    <div className="divide-y divide-[hsl(var(--border))]">
                      <div className="py-3 flex items-center justify-between">
                        <div>
                          <span className="text-[13px] font-medium text-[hsl(var(--foreground))]">Order Status Updates</span>
                          <p className="text-[11.5px] text-[hsl(var(--muted-foreground))]">
                            Notify you when buyers complete checkout or confirm payment.
                          </p>
                        </div>
                        <SwitchControl checked={settings.orderUpdates} onChange={(val) => setPreference('orderUpdates', val)} />
                      </div>

                      <div className="py-3 flex items-center justify-between">
                        <div>
                          <span className="text-[13px] font-medium text-[hsl(var(--foreground))]">Low Stock Alerts</span>
                          <p className="text-[11.5px] text-[hsl(var(--muted-foreground))]">
                            Highlight catalog products with fewer than 5 units left.
                          </p>
                        </div>
                        <SwitchControl checked={settings.stockAlerts} onChange={(val) => setPreference('stockAlerts', val)} />
                      </div>

                      <div className="py-3 flex items-center justify-between">
                        <div>
                          <span className="text-[13px] font-medium text-[hsl(var(--foreground))]">Compact Tables</span>
                          <p className="text-[11.5px] text-[hsl(var(--muted-foreground))]">
                            Use denser row padding across orders and catalog tables.
                          </p>
                        </div>
                        <SwitchControl checked={settings.compactTables} onChange={(val) => setPreference('compactTables', val)} />
                      </div>
                    </div>

                    {renderCardFooter('preferences')}
                  </div>
                )}
              </>
            )}

            {/* 3. BILLING TAB */}
            {activeTab === 'billing' && (
              <>
                <div className="rounded-[12px] border border-[hsl(var(--card-border))] bg-white p-6 shadow-xs dark:bg-neutral-900">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[hsl(var(--border))]">
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Current Plan</span>
                      <h3 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 mt-0.5">
                        {entitlements.isProPlus ? 'Take Order Pro+' : entitlements.isPro ? 'Take Order Pro' : 'Take Order Free'}
                      </h3>
                      <p className="text-xs text-neutral-500 mt-1">
                        {entitlements.isTrial ? `${entitlements.trial.daysRemaining} days remaining in trial` : 'Standard merchant features active'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Link
                        href="/account/billing"
                        className="inline-flex items-center gap-1.5 h-9 px-4 rounded-[8px] border border-[hsl(var(--border))] bg-white dark:bg-neutral-800 text-xs font-medium text-neutral-800 dark:text-neutral-200 hover:bg-neutral-50 transition"
                      >
                        <CreditCard size={13} />
                        <span>Manage Subscription</span>
                      </Link>
                    </div>
                  </div>

                  <div className="mt-4 grid sm:grid-cols-2 gap-3 text-xs text-neutral-700 dark:text-neutral-300">
                    <div className="flex items-center gap-2"><Check size={14} className="text-emerald-500" /><span>{entitlements.isProPlus ? 'Unlimited active Take Order links' : entitlements.isPro ? '500 active links' : '15 active links'}</span></div>
                    <div className="flex items-center gap-2"><Check size={14} className="text-emerald-500" /><span>Unlimited catalog items</span></div>
                    <div className="flex items-center gap-2"><Check size={14} className="text-emerald-500" /><span>Business intelligence & financial analytics</span></div>
                    <div className="flex items-center gap-2"><Check size={14} className="text-emerald-500" /><span>WhatsApp & SMS dispatch slips</span></div>
                  </div>
                </div>

                <div className="rounded-[12px] border border-[hsl(var(--card-border))] bg-white p-6 shadow-xs dark:bg-neutral-900">
                  <div className="flex items-center justify-between pb-4 border-b border-[hsl(var(--border))]">
                    <div>
                      <h3 className="text-[15px] font-semibold text-[hsl(var(--foreground))]">Upgrade Options</h3>
                      <p className="text-[12px] text-[hsl(var(--muted-foreground))] mt-0.5">Switch billing cycle or upgrade for higher volume.</p>
                    </div>
                    <div className="inline-flex items-center gap-1 rounded-[8px] bg-neutral-100 dark:bg-neutral-800 p-1 text-xs">
                      <button
                        type="button"
                        onClick={() => setSettingsBillingCadence('monthly')}
                        className={cn('px-2.5 py-1 rounded-[6px] font-medium transition cursor-pointer', settingsBillingCadence === 'monthly' ? 'bg-white dark:bg-neutral-900 font-semibold shadow-xs' : 'text-neutral-500')}
                      >
                        Monthly
                      </button>
                      <button
                        type="button"
                        onClick={() => setSettingsBillingCadence('annual')}
                        className={cn('px-2.5 py-1 rounded-[6px] font-medium transition cursor-pointer', settingsBillingCadence === 'annual' ? 'bg-white dark:bg-neutral-900 font-semibold shadow-xs' : 'text-neutral-500')}
                      >
                        Annual (25% off)
                      </button>
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4 pt-4">
                    {/* Pro Card */}
                    <div className="rounded-[10px] border border-[hsl(var(--border))] p-4 bg-white dark:bg-neutral-800/50 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm">Take Order Pro</span>
                        <span className="text-[10px] font-bold text-blue-600 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded-full">Popular</span>
                      </div>
                      <div className="text-2xl font-bold">
                        {settingsBillingCadence === 'annual' ? '$89.91/yr' : '$9.99/mo'}
                      </div>
                      <p className="text-xs text-neutral-500">500 active links, full reports, profit breakdown & custom branding.</p>
                      <Link
                        href="/subscribe"
                        className="block w-full text-center py-2 rounded-[8px] bg-neutral-900 text-white text-xs font-semibold hover:bg-neutral-800 transition dark:bg-white dark:text-neutral-900"
                      >
                        {entitlements.isPro && !entitlements.isProPlus ? 'Current Plan' : 'Select Pro'}
                      </Link>
                    </div>

                    {/* Pro+ Card */}
                    <div className="rounded-[10px] border-2 border-neutral-900 dark:border-white p-4 bg-white dark:bg-neutral-800/50 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm">Take Order Pro+</span>
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-100 dark:bg-amber-950/60 px-2 py-0.5 rounded-full">Unlimited</span>
                      </div>
                      <div className="text-2xl font-bold">
                        {settingsBillingCadence === 'annual' ? '$180/yr' : '$20/mo'}
                      </div>
                      <p className="text-xs text-neutral-500">Unlimited order links, VIP support, conversion intelligence.</p>
                      <Link
                        href="/subscribe"
                        className="block w-full text-center py-2 rounded-[8px] bg-neutral-900 text-white text-xs font-semibold hover:bg-neutral-800 transition dark:bg-white dark:text-neutral-900"
                      >
                        {entitlements.isProPlus ? 'Current Plan' : 'Select Pro+'}
                      </Link>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* 4. ACCOUNT & SECURITY TAB */}
            {activeTab === 'account' && (
              <>
                <div className="rounded-[12px] border border-[hsl(var(--card-border))] bg-white p-6 shadow-xs dark:bg-neutral-900">
                  <div className="mb-4">
                    <h3 className="text-[15px] font-semibold text-[hsl(var(--foreground))]">Account Credentials</h3>
                    <p className="text-[12px] text-[hsl(var(--muted-foreground))] mt-0.5">
                      Your authenticated email and login settings.
                    </p>
                  </div>

                  <div className="divide-y divide-[hsl(var(--border))]">
                    <div className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <span className="text-[12px] font-medium text-neutral-500 block">Signed-in Email</span>
                        <span className="text-[13px] font-semibold text-neutral-900 dark:text-neutral-100">{email || 'Authenticated Merchant'}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (clerk && clerk.openUserProfile) {
                            clerk.openUserProfile();
                          } else {
                            alert('Password reset instructions have been sent to your email.');
                          }
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] border border-[hsl(var(--border))] text-xs font-medium text-neutral-800 dark:text-neutral-200 hover:bg-neutral-50 transition cursor-pointer self-start sm:self-auto"
                      >
                        <KeyRound size={13} />
                        <span>Manage Account & Password</span>
                      </button>
                    </div>

                    <div className="py-3 flex items-center justify-between">
                      <div>
                        <span className="text-[13px] font-medium text-[hsl(var(--foreground))]">Active Session</span>
                        <p className="text-[11.5px] text-[hsl(var(--muted-foreground))]">This browser device is currently active.</p>
                      </div>
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        <span>Connected</span>
                      </span>
                    </div>

                    <div className="pt-3 flex items-center justify-between">
                      <div>
                        <span className="text-[13px] font-medium text-[hsl(var(--foreground))]">Log Out</span>
                        <p className="text-[11.5px] text-[hsl(var(--muted-foreground))]">End your active session on this device.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowLogoutConfirm(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] border border-rose-200 bg-rose-50 text-rose-700 text-xs font-semibold hover:bg-rose-100 transition cursor-pointer dark:bg-rose-950/30 dark:border-rose-900 dark:text-rose-300"
                      >
                        <LogOut size={13} />
                        <span>Log out</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="rounded-[12px] border border-[hsl(var(--card-border))] bg-white p-6 shadow-xs dark:bg-neutral-900">
                  <div className="mb-4">
                    <h3 className="text-[15px] font-semibold text-[hsl(var(--foreground))]">Data Export</h3>
                    <p className="text-[12px] text-[hsl(var(--muted-foreground))] mt-0.5">
                      Download spreadsheet records of all historical orders and customer information.
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <div>
                      <span className="text-[13px] font-medium text-[hsl(var(--foreground))]">Export Orders to CSV</span>
                      <p className="text-[11.5px] text-[hsl(var(--muted-foreground))]">
                        {(ordersQuery.data ?? []).length} orders available for export.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-[8px] h-9 px-3.5 text-xs font-semibold gap-1.5"
                      onClick={() => {
                        if (!ordersQuery.data || ordersQuery.data.length === 0) {
                          alert('No orders found to export yet.');
                          return;
                        }
                        exportOrdersToCsv(ordersQuery.data);
                        setExported(true);
                        setTimeout(() => setExported(false), 3000);
                      }}
                      disabled={ordersQuery.isLoading}
                      data-testid="button-export-orders-csv"
                    >
                      {exported ? <Check size={13} className="text-emerald-500" /> : <Download size={13} />}
                      <span>{exported ? 'Downloaded CSV' : 'Export Orders to CSV'}</span>
                    </Button>
                  </div>
                </div>

                <div className="rounded-[12px] border border-rose-200 bg-rose-50/40 p-6 shadow-xs dark:bg-rose-950/20 dark:border-rose-900">
                  <div className="mb-3">
                    <h3 className="text-[15px] font-semibold text-rose-900 dark:text-rose-200">Danger Zone</h3>
                    <p className="text-[12px] text-rose-700/80 dark:text-rose-400 mt-0.5">
                      Clear shop bio, saved payment rails, and reset workspace preferences back to defaults.
                    </p>
                  </div>

                  <div className="pt-2 flex items-center justify-between">
                    <div>
                      <span className="text-[13px] font-medium text-rose-900 dark:text-rose-200">Reset Workspace</span>
                      <p className="text-[11.5px] text-rose-700/70 dark:text-rose-400">Requires typed confirmation.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setResetConfirmText('');
                        setShowResetModal(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] border border-rose-300 bg-white text-rose-700 text-xs font-semibold hover:bg-rose-50 transition cursor-pointer dark:bg-neutral-900 dark:text-rose-300 dark:border-rose-800"
                    >
                      <Trash2 size={13} />
                      <span>Reset workspace</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Currency Change Warning Modal */}
        {showCurrencyModal && pendingCurrency && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-[16px] p-6 shadow-xl border border-[hsl(var(--border))] space-y-4">
              <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center">
                <AlertTriangle size={20} />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                  Change store base currency to {pendingCurrency}?
                </h3>
                <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                  You have <strong>{ordersQuery.data?.length ?? 0} existing order{(ordersQuery.data?.length ?? 0) === 1 ? '' : 's'}</strong> recorded in {settings.currency}.
                  Changing your store currency will <strong>not convert previous order amounts or historical revenues</strong>.
                  All new checkout links and prices will use {pendingCurrency}.
                </p>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCurrencyModal(false);
                    setPendingCurrency(null);
                  }}
                  className="px-3.5 py-2 rounded-[8px] border border-[hsl(var(--border))] text-xs font-medium hover:bg-neutral-50 transition cursor-pointer"
                >
                  Keep {settings.currency}
                </button>
                <button
                  type="button"
                  onClick={confirmCurrencyChange}
                  className="px-3.5 py-2 rounded-[8px] bg-neutral-900 text-white text-xs font-medium hover:bg-neutral-800 transition cursor-pointer"
                >
                  Change to {pendingCurrency}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Workspace Reset Typed Confirmation Modal */}
        {showResetModal && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="w-full max-w-sm bg-white dark:bg-neutral-900 rounded-[16px] p-6 shadow-xl border border-[hsl(var(--border))] space-y-4">
              <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
                <Trash2 size={20} />
              </div>
              <div className="text-center space-y-1.5">
                <h3 className="text-base font-bold text-neutral-900 dark:text-white">Reset Workspace Settings?</h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  This will clear custom store details and restore defaults. Type <strong>RESET</strong> below to confirm.
                </p>
              </div>
              <input
                type="text"
                value={resetConfirmText}
                onChange={(e) => setResetConfirmText(e.target.value)}
                placeholder="Type RESET"
                className="w-full h-10 px-3 rounded-[8px] border border-[hsl(var(--input))] text-center font-mono text-sm tracking-widest uppercase focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowResetModal(false)}
                  className="flex-1 py-2 rounded-[8px] border border-[hsl(var(--border))] text-xs font-semibold hover:bg-neutral-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={resetConfirmText.trim().toUpperCase() !== 'RESET'}
                  onClick={resetWorkspace}
                  className="flex-1 py-2 rounded-[8px] bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white text-xs font-semibold transition cursor-pointer"
                >
                  Confirm Reset
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Logout Confirmation Modal */}
        {showLogoutConfirm && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="w-full max-w-sm bg-white dark:bg-neutral-900 rounded-[16px] p-6 shadow-xl border border-[hsl(var(--border))] space-y-4">
              <div className="w-10 h-10 rounded-full bg-rose-50 dark:bg-red-950/40 text-rose-600 flex items-center justify-center mx-auto">
                <LogOut size={20} />
              </div>
              <div className="text-center space-y-1.5">
                <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">Confirm Log Out</h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Are you sure you want to end your session on this device?
                </p>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowLogoutConfirm(false)}
                  className="flex-1 py-2 rounded-[8px] border border-[hsl(var(--border))] text-xs font-semibold hover:bg-neutral-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setShowLogoutConfirm(false);
                    try {
                      if (signOut) await signOut();
                      else if (clerk?.signOut) await clerk.signOut();
                    } catch {}
                    setLocation('/sign-in');
                  }}
                  className="flex-1 py-2 rounded-[8px] bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition cursor-pointer"
                >
                  Log out
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
}


function ShieldIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3 5 6v5c0 4.5 3.8 8.2 7 10 3.2-1.8 7-5.5 7-10V6l-7-3Z" /><path d="m9 12 2 2 4-4" /></svg>; }

export function OrderReceiptModal({ order, onClose }: { order: Order; onClose: () => void }) {
  const profile = readSellerProfile();
  const [copied, setCopied] = useState(false);
  const collected = order.status === 'paid' ? order.amount : order.status === 'deposit_paid' ? (order.depositAmount ?? 0) : 0;
  const balance = Math.max(0, order.amount - collected);

  const copyReceipt = async () => {
    const text = buildTextReceipt({
      order,
      shopName: profile?.businessName || 'Take Order Store',
      sellerHandle: profile?.sellerName,
      currencySymbol: currencySymbol(),
    });
    try {
      if (navigator.clipboard) await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const shareWhatsApp = () => {
    const text = buildTextReceipt({
      order,
      shopName: profile?.businessName || 'Take Order Store',
      sellerHandle: profile?.sellerName,
      currencySymbol: currencySymbol(),
    });
    openWhatsApp(order.customerPhone || '', text);
  };

  return (
    <div className="receipt-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="receipt-card receipt-print-area" role="dialog" aria-modal="true" aria-label="Official receipt">
        <div className="receipt-header-row">
          <div className="flex items-center gap-3">
            <SellerLogo businessName={profile?.businessName || 'Take Order'} logoDataUrl={profile?.logoDataUrl} className="h-11 w-11 rounded-[12px]" />
            <div className="min-w-0">
              <h2 className="truncate text-base font-bold text-[hsl(var(--foreground))]">{profile?.businessName || 'Take Order Store'}</h2>
              <p className="truncate text-xs text-[hsl(var(--muted-foreground))]">{profile?.sellerName ? `Managed by ${profile.sellerName}` : 'Official Storefront'}</p>
            </div>
          </div>
          <div className="text-right">
            <div className={cn('receipt-stamp', order.status === 'paid' ? 'is-paid' : order.status === 'deposit_paid' ? 'is-deposit' : 'is-reserved')}>
              {order.status === 'paid' ? <><Check size={12} /> PAID IN FULL</> : order.status === 'deposit_paid' ? 'DEPOSIT PAID' : 'RESERVED'}
            </div>
            <div className="mt-1.5 font-mono-ui text-xs text-[hsl(var(--muted-foreground))]">#{String(order.id).padStart(7, '0')}</div>
          </div>
        </div>

        <div className="receipt-section">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="block text-xs text-[hsl(var(--muted-foreground))]">Customer</span>
              <strong className="text-[15px] font-semibold text-[hsl(var(--foreground))]">{order.customerName || 'Customer'}</strong>
              {order.customerPhone && <div className="text-xs text-[hsl(var(--muted-foreground))]">{order.customerPhone}</div>}
            </div>
            <div>
              <span className="block text-xs text-[hsl(var(--muted-foreground))]">Date & Channel</span>
              <strong className="font-semibold text-[hsl(var(--foreground))]">{dateShort(order.createdAt)}</strong>
              <div className="capitalize text-xs text-[hsl(var(--muted-foreground))]">{channelName(order.channel)}</div>
            </div>
          </div>
          {order.deliveryAddress && (
            <div className="mt-3 text-sm">
              <span className="block text-xs text-[hsl(var(--muted-foreground))]">Delivery address</span>
              <p className="font-medium text-[hsl(var(--foreground))]">{order.deliveryAddress}</p>
            </div>
          )}
        </div>

        <div className="receipt-section">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Order Items</div>
          <div className="divide-y divide-[hsl(var(--border))]/50">
            {order.items.map((item, idx) => {
              const prefsObj = (item as { preferences?: Record<string, string> }).preferences;
              return (
                <div key={idx} className="receipt-line-item text-sm">
                  <div>
                    <div className="font-semibold">{item.productName}</div>
                    <div className="text-xs text-[hsl(var(--muted-foreground))]">
                      Qty: {item.quantity} × {moneyExact(item.amount)}
                      {prefsObj && Object.entries(prefsObj).map(([k, v]) => ` · ${k}: ${v}`)}
                    </div>
                  </div>
                  <div className="font-mono-ui font-semibold">{moneyExact(item.amount * item.quantity)}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="receipt-section">
          <div className="receipt-totals-row text-sm">
            <span className="text-[hsl(var(--muted-foreground))]">Subtotal</span>
            <span className="font-mono-ui">{moneyExact(order.amount - order.deliveryFee)}</span>
          </div>
          {order.deliveryFee > 0 && (
            <div className="receipt-totals-row text-sm">
              <span className="text-[hsl(var(--muted-foreground))]">Delivery fee</span>
              <span className="font-mono-ui">{moneyExact(order.deliveryFee)}</span>
            </div>
          )}
          <div className="receipt-totals-row border-t border-[hsl(var(--border))] pt-2 font-bold text-base">
            <span>Total</span>
            <span className="font-mono-ui text-lg">{moneyExact(order.amount)}</span>
          </div>
          <div className="receipt-totals-row text-sm text-[hsl(var(--muted-foreground))]">
            <span>Amount paid</span>
            <span className="font-mono-ui font-semibold text-emerald-600">{moneyExact(collected)}</span>
          </div>
          {balance > 0 && (
            <div className="receipt-totals-row text-sm font-bold text-amber-600">
              <span>Balance due on delivery</span>
              <span className="font-mono-ui">{moneyExact(balance)}</span>
            </div>
          )}
        </div>

        <div className="no-print mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-[hsl(var(--border))] pt-4">
          <button type="button" onClick={onClose} className="rounded-lg px-3.5 py-2 text-sm font-semibold text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]">
            Close
          </button>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={copyReceipt} className="px-3.5 py-2 text-sm">
              <Copy size={14} /> {copied ? 'Copied!' : 'Copy text'}
            </Button>
            {order.customerPhone && (
              <Button type="button" variant="outline" onClick={shareWhatsApp} className="border-emerald-600/40 text-emerald-700 dark:text-emerald-300 px-3.5 py-2 text-sm">
                <SiWhatsapp size={14} /> Send on WhatsApp
              </Button>
            )}
            <Button type="button" onClick={() => window.print()} className="px-3.5 py-2 text-sm">
              <ReceiptText size={14} /> Print / Save PDF
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function OrderDetail() {
  const { id = '' } = useParams<{ id: string }>();
  const orderId = Number(id);
  const validOrderId = Number.isInteger(orderId) && orderId > 0;
  const query = useGetOrder(orderId, { query: { queryKey: getGetOrderQueryKey(orderId), enabled: validOrderId, refetchOnMount: 'always' } });
  const update = useUpdateOrder();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [copied, setCopied] = useState(false);
  const [riderCopied, setRiderCopied] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [whatsAppMenuOpen, setWhatsAppMenuOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [actionError, setActionError] = useState('');
  const order = validOrderId ? query.data : undefined;

  const collected = order ? (order.status === 'paid' ? order.amount : order.status === 'deposit_paid' ? (order.depositAmount ?? 0) : 0) : 0;
  const outstanding = order ? Math.max(0, order.amount - collected) : 0;
  const itemSubtotal = order?.items.reduce((sum, item) => sum + item.amount * item.quantity, 0) ?? 0;
  const buyerLink = order ? buildPublicOrderLink(order.token) : '';
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
  const copyRiderSlip = async () => {
    if (!order) return;
    const profile = readSellerProfile();
    const slip = buildRiderDispatchSlip({
      order,
      shopName: profile?.businessName || 'Take Order Store',
      sellerPhone: profile?.sellerName,
      currencySymbol: currencySymbol(),
    });
    try {
      if (navigator.clipboard) await navigator.clipboard.writeText(slip);
      setRiderCopied(true);
      window.setTimeout(() => setRiderCopied(false), 2000);
    } catch {
      setActionError('The rider slip could not be copied to clipboard.');
    }
  };
  const copyAddress = async () => {
    if (!order?.deliveryAddress) return;
    try {
      if (navigator.clipboard) await navigator.clipboard.writeText(order.deliveryAddress);
      setCopiedAddress(true);
      window.setTimeout(() => setCopiedAddress(false), 1800);
    } catch {
      setActionError('The delivery address could not be copied to clipboard.');
    }
  };
  const copyToken = async () => {
    if (!order?.token) return;
    try {
      if (navigator.clipboard) await navigator.clipboard.writeText(order.token);
      setCopiedToken(true);
      window.setTimeout(() => setCopiedToken(false), 1800);
    } catch {
      setActionError('The order token could not be copied to clipboard.');
    }
  };
  const copyCustomerPhone = async () => {
    if (!order?.customerPhone) return;
    try {
      if (navigator.clipboard) await navigator.clipboard.writeText(order.customerPhone);
      setCopiedPhone(true);
      window.setTimeout(() => setCopiedPhone(false), 1800);
    } catch {
      setActionError('The phone number could not be copied to clipboard.');
    }
  };
  const messageBuyer = () => {
    if (!order?.customerPhone) return;
    const profile = readSellerProfile();
    const message = buildOrderConfirmationMessage({
      order,
      shopName: profile?.businessName || 'our shop',
      buyerLink,
      currencySymbol: currencySymbol(),
    });
    openWhatsApp(order.customerPhone, message);
  };
  const sendDispatchUpdate = () => {
    if (!order?.customerPhone) return;
    const profile = readSellerProfile();
    const message = buildDeliveryDispatchMessage({
      order,
      shopName: profile?.businessName || 'our shop',
      currencySymbol: currencySymbol(),
    });
    openWhatsApp(order.customerPhone, message);
  };
  const sendBalanceReminder = () => {
    if (!order?.customerPhone) return;
    const profile = readSellerProfile();
    const message = buildPaymentReminderMessage({
      order,
      shopName: profile?.businessName || 'our shop',
      buyerLink,
      currencySymbol: currencySymbol(),
    });
    openWhatsApp(order.customerPhone, message);
  };

  if (!validOrderId) {
    return (
      <Shell>
        <PageHeader
          breadcrumbs={
            <Link href="/orders" className="inline-flex items-center gap-1.5 text-xs font-medium text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition cursor-pointer" data-testid="link-back-orders">
              <ArrowLeft size={13} />
              <span>Back to orders</span>
            </Link>
          }
          title="Order not found"
        />
        <div className="rounded-[12px] border border-[hsl(var(--card-border))] bg-white p-8">
          <EmptyState card={false} icon={PackageSearch} title="Order not found" description="That order number is not valid." action={<Button variant="outline" onClick={() => setLocation('/orders')} data-testid="button-return-orders">View all orders</Button>} />
        </div>
      </Shell>
    );
  }
  if (query.isLoading) {
    return (
      <Shell>
        <PageHeader
          breadcrumbs={
            <Link href="/orders" className="inline-flex items-center gap-1.5 text-xs font-medium text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition cursor-pointer" data-testid="link-back-orders">
              <ArrowLeft size={13} />
              <span>Back to orders</span>
            </Link>
          }
          title="Loading order..."
        />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="rounded-[12px] border border-[hsl(var(--card-border))] bg-white p-6 space-y-4">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
          <div className="rounded-[12px] border border-[hsl(var(--card-border))] bg-white p-6 space-y-4">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </div>
      </Shell>
    );
  }
  if (query.isError) {
    return (
      <Shell>
        <PageHeader
          breadcrumbs={
            <Link href="/orders" className="inline-flex items-center gap-1.5 text-xs font-medium text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition cursor-pointer" data-testid="link-back-orders">
              <ArrowLeft size={13} />
              <span>Back to orders</span>
            </Link>
          }
          title="Order error"
        />
        <div className="rounded-[12px] border border-[hsl(var(--card-border))] bg-white p-8">
          <ErrorState retry={() => query.refetch()} />
        </div>
      </Shell>
    );
  }
  if (!order) {
    return (
      <Shell>
        <PageHeader
          breadcrumbs={
            <Link href="/orders" className="inline-flex items-center gap-1.5 text-xs font-medium text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition cursor-pointer" data-testid="link-back-orders">
              <ArrowLeft size={13} />
              <span>Back to orders</span>
            </Link>
          }
          title="Order not found"
        />
        <div className="rounded-[12px] border border-[hsl(var(--card-border))] bg-white p-8">
          <EmptyState card={false} icon={PackageSearch} title="Order not found" description="This order may have been removed, or the link is no longer valid." action={<Button variant="outline" onClick={() => setLocation('/orders')} data-testid="button-return-orders">View all orders</Button>} />
        </div>
      </Shell>
    );
  }

  return <Shell>
    <div className="order-detail-page" data-testid={`page-order-detail-${order.id}`}>
      <PageHeader
        breadcrumbs={
          <Link
            href="/orders"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition cursor-pointer no-print"
            data-testid="link-back-orders"
          >
            <ArrowLeft size={13} />
            <span>Back to orders</span>
          </Link>
        }
        title={
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-[20px] sm:text-[24px] font-bold text-[#111827] tracking-tight">
              Order #{String(order.id).padStart(7, '0')}
            </span>
            <div className="flex items-center gap-1.5" data-testid="status-order-overview">
              <StatusPill tone={paymentTone(order.status)}>{paymentLabel(order)}</StatusPill>
              <StatusPill tone={fulfillmentTone(order.fulfillment)}>{fulfillmentLabel(order.fulfillment)}</StatusPill>
            </div>
          </div>
        }
        secondaryActions={
          <div className="flex flex-wrap items-center gap-2 no-print">
            <div className="relative">
              <button
                type="button"
                className="order-action-button"
                onClick={() => setWhatsAppMenuOpen((prev) => !prev)}
                disabled={!order.customerPhone}
                data-testid="button-message-buyer"
                title={order.customerPhone ? 'WhatsApp quick actions' : 'Buyer phone not available'}
              >
                <SiWhatsapp size={14} className="text-[#25D366]" />
                <span>Message buyer</span>
                <ChevronDown size={12} className={cn('transition-transform', whatsAppMenuOpen && 'rotate-180')} />
              </button>
              {whatsAppMenuOpen && (
                <div className="absolute left-0 top-full mt-1.5 z-40 w-56 rounded-[12px] border border-[hsl(var(--border))] bg-white p-1.5 shadow-lg">
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold hover:bg-[hsl(var(--muted))] cursor-pointer"
                    onClick={() => { setWhatsAppMenuOpen(false); messageBuyer(); }}
                  >
                    <MessageSquare size={13} className="text-emerald-600" />
                    Order confirmation
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold hover:bg-[hsl(var(--muted))] cursor-pointer"
                    onClick={() => { setWhatsAppMenuOpen(false); sendDispatchUpdate(); }}
                  >
                    <Truck size={13} className="text-blue-600" />
                    Out for delivery notice
                  </button>
                  {outstanding > 0 && (
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold hover:bg-[hsl(var(--muted))] cursor-pointer"
                      onClick={() => { setWhatsAppMenuOpen(false); sendBalanceReminder(); }}
                    >
                      <CircleDollarSign size={13} className="text-amber-600" />
                      Payment reminder
                    </button>
                  )}
                </div>
              )}
            </div>
            <button
              type="button"
              className="order-action-button"
              onClick={copyRiderSlip}
              data-testid="button-copy-rider-slip"
              title="Copy formatted delivery slip for motorbike rider or courier app"
            >
              <Truck size={14} />
              <span>{riderCopied ? 'Copied slip!' : 'Copy rider slip'}</span>
            </button>
            <button
              type="button"
              className="order-action-button"
              onClick={() => setReceiptOpen(true)}
              data-testid="button-view-receipt"
              title="View branded digital receipt"
            >
              <Receipt size={14} />
              <span>E-Receipt</span>
            </button>
            <button
              type="button"
              className="order-action-button"
              onClick={copyBuyerLink}
              data-testid="button-copy-buyer-link"
            >
              <Copy size={14} />
              <span>{copied ? 'Copied link' : 'Copy buyer link'}</span>
            </button>
          </div>
        }
        primaryAction={
          <button
            type="button"
            className="order-action-button order-action-primary no-print"
            onClick={() => window.print()}
            data-testid="button-print-invoice"
          >
            <ReceiptText size={14} />
            <span>Print invoice</span>
          </button>
        }
      />

      <div className="flex flex-wrap items-center gap-2 text-xs text-[#6B7280] mb-6 -mt-2">
        <span>Placed on {dateShort(order.createdAt)}</span>
        <span className="text-[#D1D5DB]">·</span>
        <span className="font-medium text-[#111827]">{order.customerName || 'Awaiting buyer'}</span>
        <span className="text-[#D1D5DB]">·</span>
        <span>{order.items.length} {order.items.length === 1 ? 'item' : 'items'} via {channelName(order.channel)}</span>
      </div>

      {actionError && <div className="order-detail-error" role="alert" data-testid="status-order-action-error"><AlertTriangle size={15} />{actionError}</div>}

      <div className="order-detail-layout">
        <main className="order-detail-main">
          <Card className="order-detail-card order-items-card">
            <div className="order-card-heading">
              <div>
                <div className="order-card-kicker">Order summary</div>
                <h2>Items and total</h2>
              </div>
              <Package size={18} />
            </div>
            <div className="order-items-list">
              {order.items.map((rawItem, index) => {
                const item = rawItem as Order['items'][number] & {
                  buyerVariant?: string | null;
                  source?: string | null;
                  sku?: string | null;
                  buyerDetails?: string | null;
                  imageUrls?: string[] | null;
                };
                const itemImg = item.imageUrls?.[0] || productImageFor(item.productName);
                return (
                  <div className="order-item-row" key={`${item.productId}-${index}`} data-testid={`row-order-item-${item.productId}-${index}`}>
                    <img src={itemImg} alt={item.productName} className="order-item-image" />
                    <div className="order-item-copy">
                      <div className="flex items-center gap-2 flex-wrap">
                        <strong>{item.productName}</strong>
                        {item.buyerVariant && (
                          <span className="order-item-variant-badge">
                            {item.buyerVariant}
                          </span>
                        )}
                        {item.source === 'custom' && (
                          <span className="order-item-custom-badge">
                            Custom item
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">
                        <span>{item.quantity} × {moneyExact(item.amount)}</span>
                        {item.sku && <span>· SKU: {item.sku}</span>}
                      </div>
                      {item.buyerDetails && (
                        <div className="order-item-note mt-1 text-xs text-[hsl(var(--muted-foreground))] bg-slate-50 border border-slate-100 px-2 py-1 rounded-md">
                          Note: {item.buyerDetails}
                        </div>
                      )}
                    </div>
                    <div className="order-item-total">{moneyExact(item.amount * item.quantity)}</div>
                  </div>
                );
              })}
            </div>
            <div className="order-total-block">
              <div><span>Items subtotal</span><strong>{moneyExact(itemSubtotal)}</strong></div>
              <div><span>Delivery fee</span><strong>{order.deliveryFee ? moneyExact(order.deliveryFee) : 'Free / No fee'}</strong></div>
              <div className="order-total-line"><span>Total order value</span><strong data-testid="text-order-total">{moneyExact(order.amount)}</strong></div>
              <div><span>Collected</span><strong className="order-collected" data-testid="text-order-collected">{moneyExact(collected)}</strong></div>
              <div className="order-outstanding-line">
                <span>Outstanding balance</span>
                <strong data-testid="text-order-outstanding">
                  {outstanding > 0 ? moneyExact(outstanding) : `Cleared (${moneyExact(0)})`}
                </strong>
              </div>
            </div>
          </Card>

          <Card className="order-detail-card order-status-card no-print">
            <div className="order-card-heading">
              <div>
                <div className="order-card-kicker">Order controls</div>
                <h2>Status & fulfillment</h2>
              </div>
              <RefreshCw size={17} />
            </div>
            <div className="order-control-grid">
              <div>
                <span className="order-control-label">Payment status</span>
                <div className="order-status-options">
                  {(['reserved', 'deposit_paid', 'paid'] as const).map((status) => (
                    <button
                      type="button"
                      key={status}
                      className={cn('order-status-option', order.status === status && 'is-active')}
                      disabled={update.isPending || order.status === status}
                      onClick={() => updateOrder({ status })}
                      data-testid={`button-order-payment-${status}`}
                    >
                      <span>{status === 'reserved' ? 'Reserved' : status === 'deposit_paid' ? 'Deposit paid' : 'Paid in full'}</span>
                      {order.status === status && <Check size={14} className="ml-1" />}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <span className="order-control-label">Fulfillment status</span>
                <div className="order-status-options">
                  {(['pending', 'shipped', 'delivered'] as const).map((fulfillment) => (
                    <button
                      type="button"
                      key={fulfillment}
                      className={cn('order-status-option', order.fulfillment === fulfillment && 'is-active')}
                      disabled={update.isPending || order.fulfillment === fulfillment}
                      onClick={() => updateOrder({ fulfillment })}
                      data-testid={`button-order-fulfillment-${fulfillment}`}
                    >
                      <span>{fulfillment === 'pending' ? 'To ship' : fulfillment[0].toUpperCase() + fulfillment.slice(1)}</span>
                      {order.fulfillment === fulfillment && <Check size={14} className="ml-1" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          {(order.referenceImage || order.buyerDetails) && (
            <Card className="order-detail-card order-context-card">
              <div className="order-card-heading">
                <div>
                  <div className="order-card-kicker">Buyer context</div>
                  <h2>Notes from checkout</h2>
                </div>
                <Clipboard size={17} />
              </div>
              {order.referenceImage && (
                <div className="p-4 pb-0">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">Attached reference photo</span>
                  <a href={order.referenceImage} target="_blank" rel="noreferrer" className="order-reference-image-link group" data-testid="link-order-reference-image">
                    <img src={order.referenceImage} alt="Buyer reference" className="order-reference-image" />
                    <span className="order-reference-caption">
                      Open full reference image <ExternalLink size={13} />
                    </span>
                  </a>
                </div>
              )}
              {order.buyerDetails && (
                <div className="p-4 pt-3">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">Special buyer instructions</span>
                  <p className="order-buyer-details" data-testid="text-order-buyer-details">{order.buyerDetails}</p>
                </div>
              )}
            </Card>
          )}
        </main>

        <aside className="order-detail-sidebar">
          <Card className="order-detail-card customer-card">
            <div className="order-card-heading">
              <div>
                <div className="order-card-kicker">Customer</div>
                <h2>{order.customerName || 'Buyer pending'}</h2>
              </div>
              <div className="customer-avatar">{initials(order.customerName || 'Buyer')}</div>
            </div>
            <div className="customer-contact-list">
              <div>
                <span>Phone</span>
                <div className="inline-flex items-center justify-end gap-1.5">
                  <strong data-testid="text-order-customer-phone">{order.customerPhone || 'Not provided'}</strong>
                  {order.customerPhone && (
                    <button
                      type="button"
                      onClick={copyCustomerPhone}
                      className="inline-flex items-center text-slate-400 hover:text-slate-700 p-0.5 rounded transition-colors"
                      title={copiedPhone ? 'Copied phone!' : 'Copy phone number'}
                      aria-label="Copy customer phone"
                      data-testid="button-copy-customer-phone"
                    >
                      {copiedPhone ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                    </button>
                  )}
                </div>
              </div>
              <div>
                <span>Channel</span>
                <strong className="customer-channel">
                  <ChannelMark value={order.channel} size={14} />
                  {channelName(order.channel)}
                </strong>
              </div>
              <div>
                <span>Payment plan</span>
                <strong>{order.paymentMode === 'deposit' ? `Deposit · ${moneyExact(order.depositAmount ?? 0)}` : order.paymentMode === 'reserve' ? 'Reserve only' : 'Full payment'}</strong>
              </div>
            </div>
            {order.customerPhone && (
              <div className="px-5 pt-3">
                <button
                  type="button"
                  className="customer-message-button"
                  onClick={messageBuyer}
                  data-testid="button-message-buyer-sidebar"
                >
                  <SiWhatsapp size={14} className="text-[#25D366]" />
                  Chat on WhatsApp
                </button>
              </div>
            )}
          </Card>

          <Card className="order-detail-card delivery-card">
            <div className="order-card-heading">
              <div>
                <div className="order-card-kicker">Handoff</div>
                <h2>Delivery details</h2>
              </div>
              <Truck size={17} />
            </div>
            <dl className="order-metadata-list">
              <div>
                <dt>Method</dt>
                <dd>
                  <span className={cn(
                    'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold',
                    order.deliveryMethod === 'delivery' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                    order.deliveryMethod === 'pickup' ? 'bg-purple-50 text-purple-700 border border-purple-200' :
                    'bg-slate-100 text-slate-600'
                  )}>
                    {order.deliveryMethod === 'delivery' ? 'Courier Delivery' : order.deliveryMethod === 'pickup' ? 'Store Pickup' : 'Not selected'}
                  </span>
                </dd>
              </div>
              <div>
                <dt>Fee</dt>
                <dd>{order.deliveryFee ? moneyExact(order.deliveryFee) : 'Free / No fee'}</dd>
              </div>
              <div>
                <dt>Address</dt>
                <dd className="space-y-1.5" data-testid="text-order-delivery-address">
                  <div>{order.deliveryAddress || 'Address not provided'}</div>
                  {order.deliveryAddress && (
                    <button
                      type="button"
                      onClick={copyAddress}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-full transition-colors"
                      data-testid="button-copy-delivery-address"
                    >
                      {copiedAddress ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                      {copiedAddress ? 'Address copied' : 'Copy address'}
                    </button>
                  )}
                </dd>
              </div>
            </dl>
          </Card>

          <Card className="order-detail-card activity-card">
            <div className="order-card-heading">
              <div>
                <div className="order-card-kicker">Activity</div>
                <h2>Order metadata</h2>
              </div>
              <Clock3 size={17} />
            </div>
            <dl className="order-metadata-list">
              <div>
                <dt>Placed</dt>
                <dd>{new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(order.createdAt))}</dd>
              </div>
              <div>
                <dt>Buyer link opens</dt>
                <dd>{number(order.linkOpens)}</dd>
              </div>
              <div>
                <dt>Shares / Likes</dt>
                <dd>{order.shares ?? '—'} / {order.likes ?? '—'}</dd>
              </div>
              <div>
                <dt>Order token</dt>
                <dd className="space-y-1">
                  <div className="order-token">{order.token}</div>
                  <button
                    type="button"
                    onClick={copyToken}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-800 transition-colors"
                    data-testid="button-copy-order-token"
                  >
                    {copiedToken ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
                    {copiedToken ? 'Token copied' : 'Copy token'}
                  </button>
                </dd>
              </div>
            </dl>
          </Card>
        </aside>
      </div>
    </div>
    {receiptOpen && <OrderReceiptModal order={order} onClose={() => setReceiptOpen(false)} />}
  </Shell>;
}


function ClerkShell() {
  const [, setLocation] = useLocation();
  const innerApp = (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <PaywallProvider>
          <Router />
          <Toaster />
        </PaywallProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );

  if (!clerkPubKey) {
    const isTestAuth = typeof window !== 'undefined' && (Boolean((window as any).__DUKA_TEST_AUTH__) || localStorage.getItem('duka-test-auth') === 'true');
    const testUserId = typeof window !== 'undefined' ? ((window as any).__DUKA_TEST_USER_ID__ || localStorage.getItem('duka-test-user-id') || 'test-seller-id') : 'test-seller-id';
    const effectiveUserId = isTestAuth ? testUserId : null;
    const testSignOut = async () => {
      localStorage.removeItem('duka-test-auth');
      localStorage.removeItem('duka-test-user-id');
      localStorage.removeItem('duka-auth-user');
      localStorage.removeItem('duka-seller-profile');
      localStorage.removeItem('duka-onboarding-dismissed');
      window.location.href = '/sign-in';
    };
    return (
      <AuthContext.Provider value={{
        isLoaded: true,
        isSignedIn: Boolean(isTestAuth),
        authState: isTestAuth ? 'signed_in' : 'signed_out',
        userId: effectiveUserId,
        signOut: testSignOut,
      }}>
        {innerApp}
      </AuthContext.Provider>
    );
  }

  return (
    <ClerkProvider
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
    >
      <ClerkAuthBridge>
        {innerApp}
      </ClerkAuthBridge>
    </ClerkProvider>
  );
}

function ClientDetailRoute() {
  return (
    <Shell>
      <ClientDetailPage />
    </Shell>
  );
}

function ConnectRoute() {
  return (
    <Shell>
      <PageHeader title="Connect" />
      <IntegrationsComingSoonPage />
    </Shell>
  );
}


function AnalyticsRoute() {
  return (
    <Shell>
      <AnalyticsPage />
    </Shell>
  );
}

function Router() {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}><Switch>
    <Route path="/auth" component={() => <Redirect to="/sign-in" />} />
    <Route path="/sso-callback" component={() => <AuthenticateWithRedirectCallback />} />
    <Route path="/sign-in/*?" component={SignInPage} />
    <Route path="/sign-up/*?" component={SignUpPage} />
    <Route path="/onboarding" component={OnboardingRoute} />
    <Route path="/dashboard" component={() => <ProtectedRoute page={Overview} />} />
    <Route path="/overview" component={() => <Redirect to="/dashboard" />} />
    <Route path="/app" component={() => <Redirect to="/dashboard" />} />
    <Route path="/workspace" component={() => <Redirect to="/dashboard" />} />
    <Route path="/" component={HomeRoute} />
    <Route path="/catalog/new" component={() => <ProtectedRoute page={CatalogEditorRoute} />} />
    <Route path="/catalog/edit/:id" component={() => <ProtectedRoute page={CatalogEditorRoute} />} />
    <Route path="/catalog" component={() => <ProtectedRoute page={Catalog} />} />
    <Route path="/orders/:id" component={() => <ProtectedRoute page={OrderDetail} />} />
    <Route path="/orders" component={() => <ProtectedRoute page={Orders} />} />
    <Route path="/reports/channel-conversion" component={() => <ProtectedRoute page={ChannelConversionInsight} />} />
    <Route path="/analytics" component={() => <ProtectedRoute page={AnalyticsRoute} />} />
    <Route path="/reports" component={() => <ProtectedRoute page={AnalyticsRoute} />} />
    <Route path="/clients/:key" component={() => <ProtectedRoute page={ClientDetailRoute} />} />
    <Route path="/clients" component={() => <ProtectedRoute page={Clients} />} />
    <Route path="/expenses" component={() => <ProtectedRoute page={Expenses} />} />
    <Route path="/take-order" component={() => <ProtectedRoute page={MultiItemTakeOrderModern} />} />
    <Route path="/subscribe" component={SubscribePage} />
    <Route path="/account/billing" component={BillingPage} />
    <Route path="/billing" component={() => <Redirect to="/account/billing" />} />
    <Route path="/subscription" component={() => <Redirect to="/subscribe" />} />
    <Route path="/paywall" component={() => <Redirect to="/subscribe" />} />
    <Route path="/pricing" component={() => <Redirect to="/subscribe" />} />
    <Route path="/settings/billing" component={() => <Redirect to="/account/billing" />} />
    <Route path="/settings/subscription" component={() => <Redirect to="/account/billing" />} />
    <Route path="/settings/pro" component={() => <Redirect to="/account/billing" />} />
    <Route path="/settings" component={() => <ProtectedRoute page={SettingsPage} />} />
    <Route path="/connect" component={() => <SellerRoute><ConnectRoute /></SellerRoute>} />
    <Route path="/integrations" component={() => <SellerRoute><ConnectRoute /></SellerRoute>} />
    <Route path="/terms" component={TermsPage} />
    <Route path="/terms-of-service" component={() => <Redirect to="/terms" />} />
    <Route path="/privacy" component={PrivacyPage} />
    <Route path="/privacy-policy" component={() => <Redirect to="/privacy" />} />
    <Route path="/refund-policy" component={RefundPolicyPage} />
    <Route path="/refunds" component={() => <Redirect to="/refund-policy" />} />
    <Route path="/cancellation-policy" component={() => <Redirect to="/refund-policy" />} />
    <Route path="/o/:token" component={PublicOrderPage} />
    <Route component={NotFound} />
  </Switch></ErrorBoundary>;
}

function App() {
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const prefs = readSellerSettings();
      document.body.classList.toggle('compact-tables-active', prefs.compactTables);
    }
  }, []);
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
  form,
  itemForm = emptyBuyerItemForm(),
  submitPending,
  submitError,
  onSubmit,
  onChange,
  onItemChange = () => undefined,
  onQuantityChange = () => undefined,
  onPreferenceChange = () => undefined,
  onNextItem = () => undefined,
  onPrevItem = () => undefined,
  onBack = () => undefined,
  onReferenceImageChange,
  itemForms: providedItemForms,
  onError,
}: {
  paymentMode: 'full' | 'deposit' | 'reserve' | null;
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
  mockPayment?: MockPaymentValues;
  showMockPayment?: boolean;
  submitPending: boolean;
  submitError?: string;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onChange: (key: 'name' | 'phone' | 'deliveryMethod' | 'address' | 'orderDetails' | 'details', value: string) => void;
  onItemChange?: (key: Exclude<keyof BuyerItemFormValues, 'quantity'>, value: string) => void;
  onQuantityChange?: (value: number) => void;
  onPreferenceChange?: (label: string, value: string) => void;
  onNextItem?: () => void;
  onPrevItem?: () => void;
  onBack?: () => void;
  onMockPaymentChange?: (key: keyof MockPaymentValues, value: string) => void;
  onReferenceImageChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onPaymentAction?: (action: 'pay' | 'reserve') => void;
  onBackToReview?: () => void;
  onError?: (message: string) => void;
}) {
  const item = providedItem ?? { productId: 0, productName: 'Your item', amount, variants: [], preferences: [], source: 'custom' as const };
  const items = providedItems ?? [item];
  const itemForms = providedItemForms;
  const totalItemCount = providedItems?.length ?? itemCount ?? 1;
  const selectedDeliveryMethod = form.deliveryMethod ?? (deliveryFee === 0 ? 'pickup' : undefined);
  const deliveryCharge = selectedDeliveryMethod === 'delivery' ? deliveryFee : 0;
  const payableDeposit = Math.min((depositAmount ?? 0) + deliveryCharge, amount);
  const [activeGalleryIndex, setActiveGalleryIndex] = useState(0);
  const [checkoutStep, setCheckoutStep] = useState<'contact' | 'payment'>('contact');
  const [paymentProvider, setPaymentProvider] = useState<'momo' | 'card' | 'reserve' | 'bank'>(
    paymentMode === 'reserve' ? 'reserve' : 'momo'
  );
  const [momoNetwork, setMomoNetwork] = useState<'mtn' | 'telecel' | 'at'>('mtn');
  const [momoPhone, setMomoPhone] = useState(form.phone || '');
  const [cardData, setCardData] = useState({ number: '', expiry: '', cvc: '', name: form.name || '' });

  useEffect(() => {
    if (form.phone && !momoPhone) setMomoPhone(form.phone);
  }, [form.phone]);

  useEffect(() => {
    if (form.name && !cardData.name) setCardData((c) => ({ ...c, name: form.name }));
  }, [form.name]);

  const handleProceedToPayment = (e?: React.MouseEvent | React.FormEvent) => {
    if (e) e.preventDefault();
    try {
      if (items && items.length > 0) {
        for (let i = 0; i < items.length; i++) {
          const itm = items[i];
          const f = itemForms?.[i] ?? (i === itemIndex ? itemForm : undefined);
          if (f && itm.preferences && itm.preferences.length > 0) {
            const missingPref = itm.preferences.find((p) => !f.preferences?.[p.label]);
            if (missingPref) {
              onError?.(`Please choose an option for ${missingPref.label}`);
              return;
            }
            if (allowReferenceImages !== false && itm.source === 'custom' && !f.imagePreview) {
              onError?.(`Please attach a reference photo for ${itm.productName}`);
              return;
            }
          }
        }
      }

      if (!form.name?.trim()) {
        onError?.('Please enter your name');
        const el = document.getElementById('buyer-name') as HTMLInputElement;
        if (el) el.focus();
        return;
      }
      if (!form.phone?.trim() || form.phone.trim().length < 5) {
        onError?.('Please enter your phone number');
        const el = document.getElementById('buyer-phone') as HTMLInputElement;
        if (el) el.focus();
        return;
      }
      const finalDelivery = form.deliveryMethod ?? (deliveryFee === 0 ? 'pickup' : undefined);
      if (!finalDelivery) {
        onError?.('Please choose a delivery service');
        return;
      }
      if (!form.deliveryMethod && deliveryFee === 0) {
        onChange('deliveryMethod', 'pickup');
      }
      if (finalDelivery === 'delivery' && !form.address?.trim()) {
        onError?.('Please enter your delivery address');
        const el = document.getElementById('buyer-address') as HTMLTextAreaElement;
        if (el) el.focus();
        return;
      }

      onError?.('');
      if (!momoPhone.trim()) setMomoPhone(form.phone || '');
      if (!cardData.name.trim()) setCardData((c) => ({ ...c, name: form.name || '' }));
      setCheckoutStep('payment');
    } catch (err: any) {
      console.error('Error proceeding to payment:', err);
      onError?.(err?.message || 'Failed to proceed to payment');
    }
  };

  const handleFormSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (checkoutStep === 'contact') {
      handleProceedToPayment(event);
      return;
    }
    if (paymentProvider === 'momo' && (!momoPhone.trim() || momoPhone.trim().length < 5)) {
      onError?.('Please enter your Mobile Money phone number');
      return;
    }
    onSubmit(event);
  };

  const galleryImages = useMemo(() => {
    if (item.imageUrls?.length) return item.imageUrls;
    if (item.imageUrl) return [item.imageUrl];
    return [productImageFor(item.productName)];
  }, [item.imageUrl, item.imageUrls, item.productName]);
  const activeGalleryImage = galleryImages[Math.min(activeGalleryIndex, galleryImages.length - 1)] ?? productImageFor(item.productName);

  useEffect(() => {
    setActiveGalleryIndex(0);
  }, [itemIndex]);

  if (!providedItem) {
    return <form onSubmit={onSubmit} aria-labelledby="buyer-order-form-heading" aria-busy={submitPending} className="space-y-5" data-ask-for-details={askForDetails} data-allow-reference-images={allowReferenceImages}>
      {submitError && <div className="rounded-[10px] border border-[hsl(var(--destructive))]/20 bg-[hsl(var(--destructive))]/5 px-3 py-2 text-xs text-[hsl(var(--destructive))]" role="alert" data-testid="status-public-order-error">{submitError}</div>}
      <div><label htmlFor="buyer-name" className="field-label">Your name <b className="text-rose-500 font-bold ml-0.5" aria-hidden="true">*</b></label><input id="buyer-name" data-testid="input-buyer-name" required minLength={1} value={form.name} onChange={(event) => onChange('name', event.target.value)} placeholder="Full name" className="field-input" /></div>
      <div><label htmlFor="buyer-phone" className="field-label">Phone number <b className="text-rose-500 font-bold ml-0.5" aria-hidden="true">*</b></label><input id="buyer-phone" data-testid="input-buyer-phone" required minLength={5} value={form.phone} onChange={(event) => onChange('phone', event.target.value)} placeholder="Best number to reach you" className="field-input" /></div>
      {askForDetails && <div><label htmlFor="buyer-details" className="field-label">Details for the seller <span className="font-normal text-[hsl(var(--muted-foreground))]">(optional)</span></label><textarea id="buyer-details" data-testid="input-buyer-details" value={form.details ?? ''} onChange={(event) => onChange('details', event.target.value)} placeholder="Size, color, delivery note, or anything already agreed..." rows={3} className="field-input resize-none" /></div>}
      {allowReferenceImages && <div><span className="field-label">Reference image <span className="font-normal text-[hsl(var(--muted-foreground))]">(optional)</span></span><label htmlFor="buyer-reference-image" className="buyer-image-upload"><Clipboard aria-hidden="true" size={15} />{form.image ? form.image : 'Attach an image'}</label><input id="buyer-reference-image" data-testid="input-buyer-reference-image" aria-label="Reference image" type="file" accept="image/*" className="hidden" onChange={onReferenceImageChange} />{form.imagePreview && <img src={form.imagePreview} alt="Selected reference" className="mt-3 h-28 w-full rounded-[10px] object-cover" />}</div>}
      <Button type="submit" disabled={submitPending} className="w-full py-3.5" data-testid="button-submit-public-order">
        {submitPending && <Loader2 aria-hidden="true" size={15} className="animate-spin" />}
        {paymentMode === 'reserve' ? 'Reserve order' : paymentMode === 'deposit' ? `Make payment · ${moneyExact(payableDeposit)}` : `Make payment · ${moneyExact(amount)}`} <ArrowUpRight aria-hidden="true" size={15} />
      </Button>
      <div className="text-center text-[11px] text-neutral-400 pt-1 leading-normal">
        By placing your order, you agree to Take Order's{' '}
        <Link href="/terms" target="_blank" className="underline hover:text-neutral-600">Terms</Link>,{' '}
        <Link href="/privacy" target="_blank" className="underline hover:text-neutral-600">Privacy Policy</Link>, and{' '}
        <Link href="/refund-policy" target="_blank" className="underline hover:text-neutral-600">Refund Policy</Link>.
      </div>
    </form>;
  }

  return <form noValidate onSubmit={handleFormSubmit} aria-labelledby="buyer-order-form-heading" aria-busy={submitPending} className="buyer-order-detail-layout" data-ask-for-details={askForDetails} data-allow-reference-images={allowReferenceImages}>
    {/* Left Column: Product Customization & Preferences */}
    <div className="buyer-order-detail-card p-6 sm:p-8">
      {submitError && <div className="mb-5 rounded-[10px] border border-[hsl(var(--destructive))]/20 bg-[hsl(var(--destructive))]/5 px-3 py-2 text-xs text-[hsl(var(--destructive))]" role="alert" data-testid="status-public-order-error">{submitError}</div>}
      
      <section className={cn('buyer-item-preferences-section buyer-product-detail', item.preferences.length > 0 && 'has-variants')} aria-labelledby="buyer-item-preferences-heading">
        <div className="buyer-item-preferences-layout">
          <div className={cn('buyer-item-visual', item.source === 'custom' ? 'buyer-custom-item-visual' : 'buyer-product-gallery')}>
            {item.source === 'custom' && allowReferenceImages ? <>
              <label htmlFor="buyer-reference-image" className="buyer-custom-upload-area">
                {itemForm?.imagePreview ? <img src={itemForm.imagePreview} alt="Selected item reference" /> : <><ImagePlus size={24} aria-hidden="true" /><strong>Upload an item image <b className="text-rose-500 font-bold ml-0.5" aria-hidden="true">*</b></strong><span>Add a reference photo for the seller.</span></>}
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
              <div className="mt-4 flex items-center justify-between rounded-[10px] border border-[hsl(var(--border))] p-3">
                <div>
                  <div className="field-label">Quantity</div>
                  <div className="text-[11px] text-[hsl(var(--muted-foreground))]">{item.source === 'catalog' ? `Up to ${item.stock ?? 0} available` : 'Choose how many you need'}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" aria-label={`Decrease quantity for ${item.productName}`} disabled={itemForm.quantity <= 1} onClick={() => onQuantityChange(Math.max(1, itemForm.quantity - 1))} className="flex h-8 w-8 items-center justify-center rounded-full border border-[hsl(var(--border))] text-lg disabled:opacity-40">−</button>
                  <output aria-label={`Quantity for ${item.productName}`} className="min-w-6 text-center text-sm font-bold">{itemForm.quantity}</output>
                  <button type="button" aria-label={`Increase quantity for ${item.productName}`} disabled={item.source === 'catalog' && itemForm.quantity >= (item.stock ?? 0)} onClick={() => onQuantityChange(itemForm.quantity + 1)} className="flex h-8 w-8 items-center justify-center rounded-full border border-[hsl(var(--border))] text-lg disabled:opacity-40">+</button>
                </div>
              </div>
            </div>

            {item.preferences.map((preference, preferenceIndex) => {
              const preferenceLabel = preference.label.trim().toLowerCase();
              const isSizePreference = preferenceLabel === 'size';
              const isSwatchPreference = /colou?r|finish/.test(preferenceLabel);
              const isPreferenceMissing = Boolean(
                submitError &&
                submitError.toLowerCase().includes(preference.label.toLowerCase()) &&
                !itemForm?.preferences?.[preference.label]
              );
              return <fieldset
                className={cn(
                  'buyer-color-field transition-all',
                  isSizePreference && 'buyer-size-field',
                  !isSizePreference && !isSwatchPreference && 'buyer-choice-field',
                  isPreferenceMissing && 'p-3 rounded-xl border border-rose-300 bg-rose-50/50 ring-1 ring-rose-200'
                )}
                key={`${item.productId}-${preference.label}`}
              >
                <legend className="buyer-preference-legend">
                  <span>{preference.label}</span>
                  <b className="text-rose-500 font-bold ml-1" aria-hidden="true">*</b>
                  {isSizePreference && <small>Select one</small>}
                </legend>
                <div className={isSizePreference ? 'buyer-size-options' : isSwatchPreference ? 'buyer-color-options' : 'buyer-choice-options'}>
                  {preference.options.map((option) => isSizePreference
                    ? <label key={option} className={cn('buyer-size-option', itemForm?.preferences?.[preference.label] === option && 'is-selected')} aria-label={`${preference.label}: ${option}`}>
                        <input type="radio" name={`buyer-preference-${item.productId}-${preferenceIndex}`} value={option} checked={itemForm?.preferences?.[preference.label] === option} onChange={() => onPreferenceChange?.(preference.label, option)} aria-required="true" />
                        <span className="buyer-size-check" aria-hidden="true">{itemForm?.preferences?.[preference.label] === option && <Check size={11} strokeWidth={3} />}</span>
                        <span>{option}</span>
                      </label>
                    : isSwatchPreference
                      ? <label key={option} className={cn('buyer-color-option', itemForm?.preferences?.[preference.label] === option && 'is-selected')} aria-label={`${preference.label}: ${option}`}>
                          <input type="radio" name={`buyer-preference-${item.productId}-${preferenceIndex}`} value={option} checked={itemForm?.preferences?.[preference.label] === option} onChange={() => onPreferenceChange?.(preference.label, option)} aria-required="true" />
                          <span className="buyer-color-option-image"><img src={productImageFor(`${item.productName} ${preference.label} ${option}`)} alt="" /></span>
                          <span className="buyer-color-option-label">{option}</span>
                          <span className="buyer-color-check" aria-hidden="true">{itemForm?.preferences?.[preference.label] === option && <Check size={11} strokeWidth={3} />}</span>
                        </label>
                       : <label key={option} className={cn('buyer-choice-option', itemForm?.preferences?.[preference.label] === option && 'is-selected')} aria-label={`${preference.label}: ${option}`}>
                           <input type="radio" name={`buyer-preference-${item.productId}-${preferenceIndex}`} value={option} checked={itemForm?.preferences?.[preference.label] === option} onChange={() => onPreferenceChange?.(preference.label, option)} aria-required="true" />
                          <span>{option}</span>
                          {itemForm?.preferences?.[preference.label] === option && <Check size={13} aria-hidden="true" />}
                        </label>)}
                </div>
                {isPreferenceMissing && (
                  <div className="mt-2.5 flex items-center gap-1.5 text-xs font-semibold text-rose-600 page-in" role="alert">
                    <AlertCircle size={14} className="shrink-0 text-rose-500" />
                    <span>Please choose an option for {preference.label}</span>
                  </div>
                )}
              </fieldset>;
            })}

            <div className="buyer-product-note-field">
              <label htmlFor="buyer-item-details" className="field-label">Note for the seller <span className="font-normal text-[hsl(var(--muted-foreground))]">(optional)</span></label>
              <textarea id="buyer-item-details" data-testid="input-buyer-item-details" value={itemForm.details} onChange={(event) => onChange('details', event.target.value)} placeholder="Add a detail about this item..." rows={2} className="field-input resize-none" />
            </div>
          </div>
        </div>
      </section>

      {/* If checkout contains multiple items, show Next / Previous under catalog item preview */}
      {totalItemCount > 1 && (
        <div className="mt-6 pt-5 border-t border-[hsl(var(--border))] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {itemIndex > 0 ? (
              <Button type="button" variant="outline" onClick={onPrevItem ?? onBack} data-testid="button-prev-item" className="gap-1.5">
                <ArrowLeft size={14} /> Previous
              </Button>
            ) : null}
            <span className="text-xs text-slate-500 font-medium">Item {itemIndex + 1} of {totalItemCount}</span>
          </div>

          {itemIndex + 1 < totalItemCount ? (
            <Button type="button" onClick={onNextItem} data-testid="button-next-item" className="gap-1.5">
              Next <ArrowRight size={14} />
            </Button>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
              <CheckCircle2 size={13} /> All items customized
            </span>
          )}
        </div>
      )}
    </div>

    {/* Right Column: Contact Information step followed by Payment Provider selection step */}
    <aside className="buyer-product-rail" aria-label={checkoutStep === 'payment' ? 'Payment method' : 'Contact information'}>
      <div className="buyer-rail-card space-y-4">
        {checkoutStep === 'contact' ? (
          <>
            <div className="buyer-section-heading">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-blue-600 mb-1">
                <span>Step 1 of 2</span>
                <span className="text-slate-300">·</span>
                <span className="text-slate-500 font-normal">Contact & Delivery</span>
              </div>
              <h2 id="buyer-details-heading" className="text-base font-bold text-slate-900">Contact information</h2>
              <p className="text-xs text-slate-500 mt-0.5">Enter your details to complete your order</p>
            </div>

            <div className="space-y-3">
              <div>
                <label htmlFor="buyer-name" className="field-label">Your name <b className="text-rose-500 font-bold ml-0.5" aria-hidden="true">*</b></label>
                <input
                  id="buyer-name"
                  data-testid="input-buyer-name"
                  value={form.name}
                  onChange={(event) => onChange('name', event.target.value)}
                  placeholder="Full name"
                  className="field-input"
                />
              </div>
              <div>
                <label htmlFor="buyer-phone" className="field-label">Phone number <b className="text-rose-500 font-bold ml-0.5" aria-hidden="true">*</b></label>
                <input
                  id="buyer-phone"
                  data-testid="input-buyer-phone"
                  value={form.phone}
                  onChange={(event) => onChange('phone', event.target.value)}
                  placeholder="Best number to reach you"
                  className="field-input"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <div className="field-label mb-2 font-semibold text-slate-800">Delivery service <b className="text-rose-500 font-bold ml-0.5" aria-hidden="true">*</b></div>
              <div className="grid grid-cols-2 gap-2">
                <label className={cn('buyer-service-choice', selectedDeliveryMethod === 'pickup' && 'is-selected')}>
                  <input
                    className="buyer-service-choice-input"
                    type="radio"
                    name="buyer-delivery-method"
                    value="pickup"
                    checked={selectedDeliveryMethod === 'pickup'}
                    onChange={(event) => onChange('deliveryMethod', event.target.value)}
                  />
                  <span className="buyer-service-choice-check" aria-hidden="true">{selectedDeliveryMethod === 'pickup' && <Check size={12} strokeWidth={3} />}</span>
                  <span className="buyer-service-choice-copy"><strong>Pick up</strong><small>No delivery fee</small></span>
                </label>
                <label className={cn('buyer-service-choice', selectedDeliveryMethod === 'delivery' && 'is-selected')}>
                  <input
                    className="buyer-service-choice-input"
                    type="radio"
                    name="buyer-delivery-method"
                    value="delivery"
                    checked={selectedDeliveryMethod === 'delivery'}
                    onChange={(event) => onChange('deliveryMethod', event.target.value)}
                  />
                  <span className="buyer-service-choice-check" aria-hidden="true">{selectedDeliveryMethod === 'delivery' && <Check size={12} strokeWidth={3} />}</span>
                  <span className="buyer-service-choice-copy"><strong>Delivery</strong><small>{deliveryFee > 0 ? moneyExact(deliveryFee) : 'Free'}</small></span>
                </label>
              </div>

              {selectedDeliveryMethod === 'delivery' && (
                <div className="mt-3 page-in">
                  <label htmlFor="buyer-address" className="field-label">Delivery address <b className="text-rose-500 font-bold ml-0.5" aria-hidden="true">*</b></label>
                  <textarea
                    id="buyer-address"
                    data-testid="input-buyer-address"
                    value={form.address ?? ''}
                    onChange={(event) => onChange('address', event.target.value)}
                    placeholder="Street, area, landmark, or delivery directions..."
                    rows={2}
                    className="field-input resize-none"
                  />
                </div>
              )}

              {askForDetails && (
                <div className="mt-3">
                  <label htmlFor="buyer-order-details" className="field-label">Useful details <span className="font-normal text-[hsl(var(--muted-foreground))]">(optional)</span></label>
                  <textarea
                    id="buyer-order-details"
                    data-testid="input-buyer-order-details"
                    value={form.orderDetails ?? ''}
                    onChange={(event) => onChange('orderDetails', event.target.value)}
                    placeholder="Delivery timing, access notes, or anything agreed..."
                    rows={2}
                    className="field-input resize-none"
                  />
                </div>
              )}
            </div>

            {submitError && (
              <div data-testid="status-public-order-error" className="rounded-[10px] border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 flex items-center gap-2 page-in" role="alert">
                <AlertCircle size={14} className="text-rose-500 shrink-0" />
                <span>{submitError}</span>
              </div>
            )}

            {/* Action button going to making the payment */}
            <div className="pt-3 border-t border-slate-100">
              <Button
                type="submit"
                onClick={handleProceedToPayment}
                className="w-full py-3.5 text-base font-semibold"
                data-testid="button-continue-payment"
              >
                Continue to payment <ArrowRight aria-hidden="true" size={16} />
              </Button>
              <p className="mt-2 text-center text-[11px] text-slate-500">
                Select your payment provider on the next step
              </p>
            </div>
          </>
        ) : (
          /* Payment Step: Select payment provider and make payment */
          <>
            {/* Contact recap card with Edit button */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 space-y-1.5 page-in">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Order Contact</span>
                <button
                  type="button"
                  onClick={() => setCheckoutStep('contact')}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700 underline"
                >
                  Edit
                </button>
              </div>
              <div className="flex items-center gap-2 text-xs font-medium text-slate-800">
                <UserRound size={13} className="text-slate-400 shrink-0" />
                <span className="truncate">{form.name}</span>
                <span className="text-slate-300">·</span>
                <span className="font-mono text-slate-600">{form.phone}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <Truck size={13} className="text-slate-400 shrink-0" />
                <span className="truncate">
                  {selectedDeliveryMethod === 'delivery' ? `Delivery: ${form.address}` : 'Store Pickup (Free)'}
                </span>
              </div>
            </div>

            <div className="buyer-section-heading">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-blue-600 mb-1">
                <span>Step 2 of 2</span>
                <span className="text-slate-300">·</span>
                <span className="text-slate-500 font-normal">Payment</span>
              </div>
              <h2 id="buyer-payment-heading" className="text-base font-bold text-slate-900">Select payment provider</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {paymentMode === 'reserve' ? 'Select how you would like to settle your order' : 'Select a provider to make your payment'}
              </p>
            </div>

            {/* Payment provider options styled like modern checkout */}
            <div className="rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-200/80 bg-white shadow-xs">
              {/* Option 1: Mobile Money */}
              <div className={cn('p-3.5 transition-colors', paymentProvider === 'momo' && 'bg-blue-50/20')}>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="buyer-payment-provider"
                    value="momo"
                    checked={paymentProvider === 'momo'}
                    onChange={() => setPaymentProvider('momo')}
                    className="mt-1 h-4 w-4 text-blue-600 border-slate-300 focus:ring-blue-500"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-sm text-slate-900 flex items-center gap-2">
                        <Smartphone size={16} className="text-blue-600" />
                        Mobile Money
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">Instant</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">MTN MoMo, Telecel Cash, AT Money</p>
                  </div>
                </label>
                {paymentProvider === 'momo' && (
                  <div className="mt-3 pt-3 border-t border-slate-100 space-y-3 page-in">
                    <div>
                      <span className="text-[11px] font-medium text-slate-600 mb-1.5 block">Select network provider</span>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => setMomoNetwork('mtn')}
                          className={cn('py-1.5 px-2 rounded-lg text-xs font-semibold border transition-all text-center', momoNetwork === 'mtn' ? 'border-amber-400 bg-amber-50 text-amber-900 shadow-xs' : 'border-slate-200 text-slate-600 hover:bg-slate-50')}
                        >
                          MTN MoMo
                        </button>
                        <button
                          type="button"
                          onClick={() => setMomoNetwork('telecel')}
                          className={cn('py-1.5 px-2 rounded-lg text-xs font-semibold border transition-all text-center', momoNetwork === 'telecel' ? 'border-rose-400 bg-rose-50 text-rose-900 shadow-xs' : 'border-slate-200 text-slate-600 hover:bg-slate-50')}
                        >
                          Telecel Cash
                        </button>
                        <button
                          type="button"
                          onClick={() => setMomoNetwork('at')}
                          className={cn('py-1.5 px-2 rounded-lg text-xs font-semibold border transition-all text-center', momoNetwork === 'at' ? 'border-blue-400 bg-blue-50 text-blue-900 shadow-xs' : 'border-slate-200 text-slate-600 hover:bg-slate-50')}
                        >
                          AT Money
                        </button>
                      </div>
                    </div>
                    <div>
                      <label htmlFor="momo-phone-input" className="text-[11px] font-medium text-slate-600 mb-1 block">Mobile Money number</label>
                      <input
                        id="momo-phone-input"
                        data-testid="input-momo-phone"
                        type="tel"
                        value={momoPhone}
                        onChange={(e) => setMomoPhone(e.target.value)}
                        placeholder="024 XXX XXXX"
                        className="field-input text-sm"
                      />
                      <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                        <Info size={12} className="text-slate-400 shrink-0" />
                        A prompt will be sent to this number to approve payment.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Option 2: Card Payment */}
              <div className={cn('p-3.5 transition-colors', paymentProvider === 'card' && 'bg-blue-50/20')}>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="buyer-payment-provider"
                    value="card"
                    checked={paymentProvider === 'card'}
                    onChange={() => setPaymentProvider('card')}
                    className="mt-1 h-4 w-4 text-blue-600 border-slate-300 focus:ring-blue-500"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-sm text-slate-900 flex items-center gap-2">
                        <CreditCard size={16} className="text-slate-700" />
                        Debit / Credit Card
                      </span>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">VISA</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">Mastercard</span>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">Pay securely with bank card</p>
                  </div>
                </label>
                {paymentProvider === 'card' && (
                  <div className="mt-3 pt-3 border-t border-slate-100 space-y-3 page-in">
                    <div>
                      <label htmlFor="card-number-input" className="text-[11px] font-medium text-slate-600 mb-1 block">Card number</label>
                      <input
                        id="card-number-input"
                        data-testid="input-card-number"
                        type="text"
                        value={cardData.number}
                        onChange={(e) => setCardData((c) => ({ ...c, number: e.target.value }))}
                        placeholder="4000 1234 5678 9010"
                        maxLength={19}
                        className="field-input text-sm font-mono"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label htmlFor="card-expiry-input" className="text-[11px] font-medium text-slate-600 mb-1 block">Expiry date</label>
                        <input
                          id="card-expiry-input"
                          data-testid="input-card-expiry"
                          type="text"
                          value={cardData.expiry}
                          onChange={(e) => setCardData((c) => ({ ...c, expiry: e.target.value }))}
                          placeholder="MM / YY"
                          maxLength={5}
                          className="field-input text-sm"
                        />
                      </div>
                      <div>
                        <label htmlFor="card-cvc-input" className="text-[11px] font-medium text-slate-600 mb-1 block">Security code (CVC)</label>
                        <input
                          id="card-cvc-input"
                          data-testid="input-card-cvc"
                          type="password"
                          value={cardData.cvc}
                          onChange={(e) => setCardData((c) => ({ ...c, cvc: e.target.value }))}
                          placeholder="123"
                          maxLength={4}
                          className="field-input text-sm font-mono"
                        />
                      </div>
                    </div>
                    <div>
                      <label htmlFor="card-name-input" className="text-[11px] font-medium text-slate-600 mb-1 block">Name on card</label>
                      <input
                        id="card-name-input"
                        data-testid="input-card-name"
                        type="text"
                        value={cardData.name}
                        onChange={(e) => setCardData((c) => ({ ...c, name: e.target.value }))}
                        placeholder="Full name on card"
                        className="field-input text-sm"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Option 3: Pay on Delivery / Collection (if reserve mode) or Bank Transfer */}
              {paymentMode === 'reserve' ? (
                <div className={cn('p-3.5 transition-colors', paymentProvider === 'reserve' && 'bg-blue-50/20')}>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="buyer-payment-provider"
                      value="reserve"
                      checked={paymentProvider === 'reserve'}
                      onChange={() => setPaymentProvider('reserve')}
                      className="mt-1 h-4 w-4 text-blue-600 border-slate-300 focus:ring-blue-500"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-sm text-slate-900 flex items-center gap-2">
                          <Package size={16} className="text-slate-700" />
                          Pay on Delivery / Pickup
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">Cash / MoMo</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">Pay when your order is delivered or collected</p>
                    </div>
                  </label>
                </div>
              ) : (
                <div className={cn('p-3.5 transition-colors', paymentProvider === 'bank' && 'bg-blue-50/20')}>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="buyer-payment-provider"
                      value="bank"
                      checked={paymentProvider === 'bank'}
                      onChange={() => setPaymentProvider('bank')}
                      className="mt-1 h-4 w-4 text-blue-600 border-slate-300 focus:ring-blue-500"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-sm text-slate-900 flex items-center gap-2">
                          <Building2 size={16} className="text-slate-700" />
                          Bank Transfer
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">Direct</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">Direct transfer to merchant bank account</p>
                    </div>
                  </label>
                </div>
              )}
            </div>

            {/* Order breakdown summary */}
            <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-200/80 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-500">
                <span>Subtotal</span>
                <span className="font-mono-ui font-medium">{moneyExact(amount - (selectedDeliveryMethod === 'delivery' ? (deliveryFee || 0) : 0))}</span>
              </div>
              {deliveryFee > 0 && (
                <div className="flex justify-between text-slate-500">
                  <span>Delivery fee ({selectedDeliveryMethod === 'delivery' ? 'Courier' : 'Pickup'})</span>
                  <span className="font-mono-ui font-medium">{selectedDeliveryMethod === 'delivery' ? moneyExact(deliveryFee) : 'Free'}</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-2 border-t border-slate-200 font-bold text-slate-900 text-sm">
                <span>{paymentMode === 'deposit' ? 'Deposit payable today' : 'Total payable'}</span>
                <span className="font-mono-ui text-base font-extrabold text-slate-900">
                  {moneyExact(paymentMode === 'deposit' ? payableDeposit : amount)}
                </span>
              </div>
              {paymentMode === 'deposit' && (
                <p className="text-[11px] text-slate-500 pt-0.5">
                  Remaining balance of {moneyExact(amount - payableDeposit)} payable upon delivery.
                </p>
              )}
            </div>

            {submitError && (
              <div className="rounded-[10px] border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 flex items-center gap-2 page-in" role="alert">
                <AlertCircle size={14} className="text-rose-500 shrink-0" />
                <span>{submitError}</span>
              </div>
            )}

            {/* Primary Action Button: Make payment */}
            <div className="pt-2 space-y-2">
              <Button
                type="submit"
                disabled={submitPending}
                className="w-full py-3.5 text-base font-semibold"
                data-testid="button-submit-public-order"
              >
                {submitPending && <Loader2 aria-hidden="true" size={16} className="animate-spin" />}
                {paymentMode === 'reserve' && paymentProvider === 'reserve'
                  ? 'Confirm reservation · Pay on delivery'
                  : paymentProvider === 'momo'
                    ? `Pay ${moneyExact(payableDeposit || amount)} via Mobile Money`
                    : paymentProvider === 'card'
                      ? `Pay ${moneyExact(payableDeposit || amount)} with Card`
                      : `Make payment · ${moneyExact(payableDeposit || amount)}`}
                <ArrowUpRight aria-hidden="true" size={16} />
              </Button>

              <button
                type="button"
                onClick={() => setCheckoutStep('contact')}
                className="w-full text-center text-xs text-slate-500 hover:text-slate-800 transition-colors py-1 flex items-center justify-center gap-1 font-medium"
              >
                <ArrowLeft size={13} /> Back to contact information
              </button>

              <div className="flex items-center justify-center gap-1.5 text-center text-[11px] text-slate-400 pt-1">
                <ShieldCheck size={13} className="text-emerald-500 shrink-0" />
                <span>256-bit encrypted · Direct payment to seller</span>
              </div>

              <div className="text-center text-[10.5px] text-slate-400 pt-0.5 leading-normal">
                By placing your order, you agree to Take Order's{' '}
                <Link href="/terms" target="_blank" className="underline hover:text-slate-600">Terms</Link>,{' '}
                <Link href="/privacy" target="_blank" className="underline hover:text-slate-600">Privacy</Link>, and{' '}
                <Link href="/refund-policy" target="_blank" className="underline hover:text-slate-600">Refund Policy</Link>.
              </div>
            </div>
          </>
        )}
      </div>
    </aside>
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

