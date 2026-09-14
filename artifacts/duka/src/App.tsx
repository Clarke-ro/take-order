import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Link, Route, Switch, useLocation, useParams, Router as WouterRouter } from 'wouter';
import {
  AlertTriangle, ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight, BarChart3, Boxes, Check, Clock3,
  CheckCircle2, CircleDollarSign, Clipboard, Copy, ExternalLink, Eye, LayoutDashboard, Link2, Loader2, Menu, MoreHorizontal,
  Package, PackageSearch, Pencil, Plus, Receipt, RefreshCw, Search, Settings2, ShoppingBag, Sparkles,
  Trash2, TrendingUp, Truck, Users, WalletCards, X
} from 'lucide-react';
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

const queryClient = new QueryClient();
const money = (value: number | null | undefined) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value || 0);
const moneyExact = (value: number | null | undefined) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value || 0);
const dateShort = (value: string) => {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
};
const channelName = (value: string) => value.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const chartFills = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'] as const;
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

function BrandLockup({ inverted = false, markVariant, className = '' }: { inverted?: boolean; markVariant?: 'icon' | 'inverted' | 'app'; className?: string }) {
  return <div className={cn('flex items-center gap-3', className)}><BrandMark variant={markVariant ?? (inverted ? 'inverted' : 'app')} className="h-9 w-9 shrink-0 rounded-[12px]" /><BrandWordmark inverted={inverted} className="h-7 w-auto" /></div>;
}
function Store({ size = 16 }: { size?: number }) {
  return <BrandMark variant="icon" className={size >= 18 ? 'h-5 w-5' : 'h-4 w-4'} />;
}

type SellerProfile = { sellerName: string; businessName: string; description: string; channels: string[] };
const ONBOARDING_KEY = 'duka-onboarding-profile';
const ONBOARDING_DONE_KEY = 'duka-onboarding-complete';
const readSellerProfile = (): SellerProfile | null => {
  try {
    const value = window.localStorage.getItem(ONBOARDING_KEY);
    return value ? JSON.parse(value) as SellerProfile : null;
  } catch { return null; }
};
const finishOnboarding = () => window.localStorage.setItem(ONBOARDING_DONE_KEY, 'true');

function Sidebar() {
  const [location] = useLocation();
  const seller = readSellerProfile();
  const links = [
    { href: '/', label: 'Overview', icon: LayoutDashboard },
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
    <nav className="sidebar-scroll mt-3 flex-1 overflow-y-auto px-3">
      {links.map(({ href, label, icon: Icon }) => <Link key={href} href={href} data-testid={`link-${label.toLowerCase().replaceAll(' ', '-')}`} className={cn('group mb-1 flex items-center gap-3 rounded-[12px] px-4 py-3 text-[13px] font-medium transition-colors', location === href ? 'bg-[hsl(var(--sidebar-accent))] text-white' : 'text-white/58 hover:bg-white/5 hover:text-white')}>
        <Icon size={17} strokeWidth={location === href ? 2.3 : 1.8} /><span>{label}</span>{label === 'Orders' && <span className="ml-auto rounded-full bg-[hsl(var(--sidebar-primary))] px-1.5 py-0.5 font-mono-ui text-[9px] text-[hsl(var(--sidebar-primary-foreground))]">12</span>}
      </Link>)}
      <div className="my-5 h-px bg-white/10" />
      <div className="px-1 text-[10px] font-semibold uppercase tracking-[.16em] text-white/35">Settings</div>
      <Link href="/connect" data-testid="link-connect" className={cn('mt-3 flex items-center gap-3 rounded-[12px] px-4 py-3 text-[13px] font-medium transition-colors', location === '/connect' ? 'bg-[hsl(var(--sidebar-accent))] text-white' : 'text-white/58 hover:bg-white/5 hover:text-white')}><Settings2 size={17} /><span>Connect tools</span><span className="ml-auto h-2 w-2 rounded-full bg-[hsl(var(--accent))]" /></Link>
    </nav>
    <div className="m-4 rounded-[15px] border border-white/10 bg-white/[.045] p-4">
      <div className="flex items-center gap-2 text-[11px] font-semibold text-white/75"><span className="h-2 w-2 rounded-full bg-[hsl(var(--accent))]" /> All systems ready</div>
      <p className="mt-2 text-[11px] leading-relaxed text-white/40">Your links are live and ready to share.</p>
    </div>
     <div className="flex items-center gap-3 border-t border-white/10 px-6 py-5"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-[hsl(var(--chart-3))] text-[11px] font-bold text-white">{initials(seller?.sellerName || 'Amina Mensah')}</div><div className="min-w-0"><div className="truncate text-[12px] font-semibold">{seller?.sellerName || 'Amina Mensah'}</div><div className="truncate text-[10px] text-white/40">{seller?.businessName || 'The Sunday Edit'}</div></div><MoreHorizontal className="ml-auto text-white/35" size={16} /></div>
  </aside>;
}

function MobileTopbar() {
  const [open, setOpen] = useState(false);
  const nav = [{ href: '/', label: 'Overview' }, { href: '/catalog', label: 'Catalog' }, { href: '/orders', label: 'Orders' }, { href: '/reports', label: 'Reports' }, { href: '/clients', label: 'Clients' }, { href: '/expenses', label: 'Expenses' }, { href: '/take-order', label: 'Take an order' }, { href: '/connect', label: 'Connect tools' }];
  return <div className="mobile-topbar sticky top-0 z-40 items-center justify-between border-b border-[hsl(var(--border))] bg-[hsl(var(--background))]/95 px-5 py-4 backdrop-blur-md"><Link href="/" aria-label="Duka overview"><BrandLockup className="gap-2" /></Link><button data-testid="button-mobile-menu" onClick={() => setOpen(!open)} className="rounded-lg p-2 hover:bg-black/5">{open ? <X size={20} /> : <Menu size={20} />}</button>{open && <div className="absolute left-0 right-0 top-full border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3">{nav.map((item) => <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-3 text-sm hover:bg-[hsl(var(--muted))]">{item.label}</Link>)}</div>}</div>;
}

function Shell({ children }: { children: ReactNode }) {
  return <div className="duka-shell grain"><Sidebar /><MobileTopbar /><main className="page-content min-h-[100dvh] px-5 py-7 md:ml-[246px] md:px-10 md:py-9 lg:px-14">{children}</main></div>;
}

function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><div className="font-mono-ui text-[10px] font-bold uppercase tracking-[.18em] text-[hsl(var(--muted-foreground))]">{eyebrow}</div><h1 className="mt-2 font-display text-[clamp(30px,4vw,48px)] font-bold leading-[.98] tracking-[-.055em] text-[hsl(var(--foreground))]">{title}</h1>{description && <p className="mt-3 max-w-[540px] text-base leading-7 text-[hsl(var(--muted-foreground))]">{description}</p>}</div>{action}</div>;
}

function Button({ children, variant = 'primary', className, ...props }: { children: ReactNode; variant?: 'primary' | 'soft' | 'outline' | 'danger' | 'ghost'; className?: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} className={cn('inline-flex items-center justify-center gap-2 rounded-[10px] px-3.5 py-2 text-[11px] font-semibold tracking-[-.01em] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--ring))] disabled:cursor-not-allowed disabled:opacity-50', variant === 'primary' && 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--primary))]', variant === 'soft' && 'bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))] hover:bg-[hsl(var(--muted))]', variant === 'outline' && 'border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--foreground))] hover:border-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]', variant === 'danger' && 'border border-[hsl(var(--foreground))] bg-[hsl(var(--card))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]', variant === 'ghost' && 'border border-transparent bg-transparent text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]', className)} {...props}>{children}</button>;
}

function Card({ children, className = '', ...props }: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>) { return <div {...props} className={cn('rounded-[16px] border border-[hsl(var(--card-border))] bg-[hsl(var(--card))]', className)}>{children}</div>; }
function Skeleton({ className = '' }: { className?: string }) { return <div className={cn('animate-pulse rounded-lg bg-[hsl(var(--muted))]', className)} />; }
function EmptyState({ icon: Icon, title, description, action }: { icon: typeof Package; title: string; description: string; action?: ReactNode }) { return <div className="flex flex-col items-center justify-center rounded-[16px] border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--card))] px-6 py-16 text-center"><div className="mb-4 flex h-12 w-12 items-center justify-center rounded-[14px] bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"><Icon size={22} /></div><h3 className="font-display text-lg font-bold">{title}</h3><p className="mt-2 max-w-[340px] text-sm leading-6 text-[hsl(var(--muted-foreground))]">{description}</p>{action && <div className="mt-5">{action}</div>}</div>; }
function ErrorState({ retry }: { retry: () => void }) { return <div className="rounded-[16px] border border-[hsl(var(--destructive))]/20 bg-[hsl(var(--destructive))]/5 p-8 text-center"><p className="font-semibold">Something could not load.</p><p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">Give it another try or check your connection.</p><Button className="mt-5" variant="outline" onClick={retry}><RefreshCw size={15} />Try again</Button></div>; }
function StatusPill({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'gold' | 'mint' | 'rose' | 'blue' | 'reserved' }) {
  const paid = tone === 'mint';
  const deposit = tone === 'gold';
  const reserved = tone === 'reserved';
  const shipped = tone === 'blue';
  return <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold capitalize', paid && 'border border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]', deposit && 'border-2 border-[hsl(var(--foreground))] bg-[hsl(var(--card))] text-[hsl(var(--foreground))]', reserved && 'border border-dashed border-[hsl(var(--foreground))] bg-[hsl(var(--muted))] text-[hsl(var(--foreground))]', shipped && 'border border-dotted border-[hsl(var(--foreground))] bg-[hsl(var(--card))] text-[hsl(var(--foreground))]', !paid && !deposit && !reserved && !shipped && 'border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--muted-foreground))]')}>{paid && <Check size={11} strokeWidth={3} aria-hidden="true" />}{deposit && <CircleDollarSign size={11} strokeWidth={2.5} aria-hidden="true" />}{reserved && <Clock3 size={11} strokeWidth={2.5} aria-hidden="true" />}{shipped && <ArrowUpRight size={11} strokeWidth={2.5} aria-hidden="true" />}{children}</span>;
}

const paymentTone = (status: Order['status']): 'neutral' | 'gold' | 'mint' | 'reserved' =>
  status === 'paid' ? 'mint' : status === 'deposit_paid' ? 'gold' : status === 'reserved' ? 'reserved' : 'neutral';
function MetricCard({ label, value, note, dataTestId, className = '', style }: { label: string; value: ReactNode; note: ReactNode; dataTestId?: string; className?: string; style?: React.CSSProperties }) {
  return <Card className={cn('p-5', className)} style={style} data-testid={dataTestId}><div className="text-[10px] font-normal uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">{label}</div><div className="mt-3 font-display text-3xl font-bold tracking-[-.06em] metric-value">{value}</div><div className="mt-2 text-xs font-normal leading-5 text-[hsl(var(--muted-foreground))]">{note}</div></Card>;
}
function InsightCard({ icon: Icon, title, description, className = '', dataTestId }: { icon: typeof CircleDollarSign; title: string; description: string; className?: string; dataTestId?: string }) {
  return <Card className={cn('flex items-center gap-4 p-5', className)} data-testid={dataTestId}><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[hsl(var(--accent))]/25 text-[hsl(var(--accent-foreground))]"><Icon size={18} /></div><div><div className="text-sm font-bold">{title}</div><p className="mt-1 text-xs leading-5 text-[hsl(var(--muted-foreground))]">{description}</p></div></Card>;
}

const onboardingChannels = ['WhatsApp', 'Instagram', 'TikTok', 'Snapchat', 'In person', 'Other'];
function Onboarding() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState<SellerProfile>(() => readSellerProfile() || { sellerName: '', businessName: '', description: '', channels: [] });
  useEffect(() => {
    window.localStorage.setItem(ONBOARDING_KEY, JSON.stringify(profile));
  }, [profile]);
  const update = (key: keyof SellerProfile, value: string) => setProfile((current) => ({ ...current, [key]: value }));
  const toggleChannel = (channel: string) => setProfile((current) => ({ ...current, channels: current.channels.includes(channel) ? current.channels.filter((item) => item !== channel) : [...current.channels, channel] }));
  const skip = () => { finishOnboarding(); setLocation('/'); };
  const next = () => {
    if (step === 0 && profile.description.trim()) setStep(1);
    else if (step === 1 && profile.sellerName.trim() && profile.businessName.trim()) setStep(2);
    else if (step === 2) { finishOnboarding(); setStep(3); }
  };
  const canContinue = step === 0 ? Boolean(profile.description.trim()) : step === 1 ? Boolean(profile.sellerName.trim() && profile.businessName.trim()) : true;
  return <div className="onboarding-shell min-h-[100dvh] px-5 py-5 sm:px-8 sm:py-8">
    <header className="mx-auto flex max-w-[980px] items-center justify-between">
      <Link href="/" data-testid="link-onboarding-logo" aria-label="Duka overview"><BrandLockup markVariant="icon" className="gap-2" /></Link>
      {step < 3 && <button onClick={skip} data-testid="button-skip-onboarding" className="soft-focus rounded-full px-3 py-2 text-xs font-semibold text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--card))] hover:text-[hsl(var(--foreground))]">Skip setup</button>}
    </header>
    <main className="onboarding-grid mx-auto mt-10 grid max-w-[980px] gap-8 rounded-[26px] border border-[hsl(var(--border))] bg-[hsl(var(--card))]/75 p-5 backdrop-blur-sm sm:mt-14 sm:p-10 lg:grid-cols-[.86fr_1.14fr] lg:p-14">
      <div className="flex flex-col justify-between">
        <div><div className="font-mono-ui text-[10px] font-bold uppercase tracking-[.18em] text-[hsl(var(--muted-foreground))]">A small start</div><h1 className="mt-4 max-w-[390px] font-display text-[clamp(38px,6vw,67px)] font-bold leading-[.92] tracking-[-.07em]">{step === 3 ? 'Your shop has a home.' : 'Let’s make the busy bits lighter.'}</h1><p className="mt-5 max-w-[380px] text-sm leading-6 text-[hsl(var(--muted-foreground))]">{step === 3 ? 'Your workspace is ready. Start with one product, then add the tools that help you understand where sales come from.' : 'Tell Duka a little about how you sell. We’ll turn it into a short setup, not another admin project.'}</p></div>
        <div className="mt-10 hidden rounded-[16px] border border-[hsl(var(--border))] bg-[hsl(var(--background))]/70 p-4 lg:block"><div className="flex items-center gap-2 text-xs font-semibold"><span className="h-2 w-2 rounded-full bg-[hsl(var(--accent))]" />Private by default</div><p className="mt-2 text-[11px] leading-5 text-[hsl(var(--muted-foreground))]">Duka never reads personal chats. You decide what becomes an order.</p></div>
      </div>
      <div className="rounded-[20px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 sm:p-7">
        {step < 3 && <div className="mb-8 flex items-center gap-2" aria-label="Setup progress">{[0, 1, 2].map((item) => <span key={item} className={cn('h-1.5 flex-1 rounded-full', item <= step ? 'bg-[hsl(var(--primary))]' : 'bg-[hsl(var(--muted))]')} />)}</div>}
        {step === 0 && <div className="page-in"><div className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">First, in your own words</div><h2 className="mt-3 font-display text-2xl font-bold tracking-[-.04em]">What do you sell, and where do buyers find you?</h2><p className="mt-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">Write it like you would tell a friend. We’ll use this to shape your checklist.</p><textarea autoFocus data-testid="input-onboarding-description" value={profile.description} onChange={(event) => update('description', event.target.value)} placeholder="I sell handmade jewellery, mostly through Instagram and WhatsApp." rows={6} className="field-input mt-6 resize-none leading-6" /><div className="mt-3 flex items-start gap-2 text-[11px] leading-5 text-[hsl(var(--muted-foreground))]"><CheckCircle2 size={14} className="mt-0.5 shrink-0 text-[hsl(var(--accent-foreground))]" />No account connections are needed for setup.</div></div>}
        {step === 1 && <div className="page-in"><div className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">Make it yours</div><h2 className="mt-3 font-display text-2xl font-bold tracking-[-.04em]">What should we call your workspace?</h2><p className="mt-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">This stays on this device for now and helps Duka speak like it belongs to you.</p><div className="mt-7 space-y-5"><div><label className="field-label" htmlFor="onboarding-seller-name">Your name</label><input autoFocus id="onboarding-seller-name" data-testid="input-onboarding-seller-name" value={profile.sellerName} onChange={(event) => update('sellerName', event.target.value)} placeholder="e.g. Amina Mensah" className="field-input" /></div><div><label className="field-label" htmlFor="onboarding-business-name">Business or shop name</label><input id="onboarding-business-name" data-testid="input-onboarding-business-name" value={profile.businessName} onChange={(event) => update('businessName', event.target.value)} placeholder="e.g. The Sunday Edit" className="field-input" /></div></div></div>}
        {step === 2 && <div className="page-in"><div className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">One useful detail</div><h2 className="mt-3 font-display text-2xl font-bold tracking-[-.04em]">Where do you usually sell?</h2><p className="mt-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">Pick any that fit. These are just workspace preferences; Duka does not connect or read them.</p><div className="mt-7 grid grid-cols-2 gap-2">{onboardingChannels.map((channel) => <label key={channel} className={cn('flex cursor-pointer items-center gap-3 rounded-[12px] border p-3 text-xs font-semibold transition-colors', profile.channels.includes(channel) ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]')}><input type="checkbox" data-testid={`input-onboarding-channel-${channel.toLowerCase().replaceAll(' ', '-')}`} checked={profile.channels.includes(channel)} onChange={() => toggleChannel(channel)} className="sr-only" /><span className={cn('flex h-5 w-5 items-center justify-center rounded-full border text-[10px]', profile.channels.includes(channel) ? 'border-[hsl(var(--sidebar-primary))] bg-[hsl(var(--sidebar-primary))] text-[hsl(var(--primary-foreground))]' : 'border-[hsl(var(--border))]')}>{profile.channels.includes(channel) && <Check size={12} />}</span>{channel}</label>)}</div></div>}
        {step === 3 && <div className="page-in"><div className="flex h-12 w-12 items-center justify-center rounded-[15px] bg-[hsl(var(--accent))] text-white"><Check size={23} /></div><div className="mt-7 font-mono-ui text-[10px] uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">Setup complete</div><h2 className="mt-3 font-display text-3xl font-bold tracking-[-.05em]">A good first week starts with one item.</h2><p className="mt-3 text-sm leading-6 text-[hsl(var(--muted-foreground))]">Your preferences are saved locally. Choose the next useful step and Duka will keep the rest tidy.</p><div className="mt-7 space-y-2"><Link href="/catalog" data-testid="link-onboarding-add-item" className="flex items-center gap-3 rounded-[13px] border border-[hsl(var(--border))] p-4 transition-colors hover:bg-[hsl(var(--muted))]"><span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[hsl(42_81%_67%/.3)] font-mono-ui text-xs font-bold">01</span><span className="flex-1"><span className="block text-sm font-bold">Add your first catalog item</span><span className="mt-1 block text-xs text-[hsl(var(--muted-foreground))]">Name, price, cost, and stock — that’s the foundation.</span></span><ArrowRight size={16} /></Link><Link href="/connect" data-testid="link-onboarding-connect-tools" className="flex items-center gap-3 rounded-[13px] border border-[hsl(var(--border))] p-4 transition-colors hover:bg-[hsl(var(--muted))]"><span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[hsl(157_42%_45%/.16)] font-mono-ui text-xs font-bold">02</span><span className="flex-1"><span className="block text-sm font-bold">Review optional tools</span><span className="mt-1 block text-xs text-[hsl(var(--muted-foreground))]">Save the channels and payment tools you use.</span></span><ArrowRight size={16} /></Link></div><Button onClick={() => setLocation('/')} className="mt-7 w-full" data-testid="button-open-workspace">Open my workspace <ArrowRight size={15} /></Button></div>}
        {step < 3 && <div className="mt-8 flex items-center justify-between border-t border-[hsl(var(--border))] pt-5"><button onClick={() => step === 0 ? skip() : setStep(step - 1)} data-testid="button-onboarding-back" className="soft-focus inline-flex items-center gap-2 rounded-[10px] px-2 py-2 text-xs font-semibold text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]">{step === 0 ? 'Not now' : <><ArrowLeft size={14} />Back</>}</button><Button onClick={next} disabled={!canContinue} data-testid="button-onboarding-continue">{step === 2 ? 'Finish setup' : 'Continue'}<ArrowRight size={15} /></Button></div>}
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

function Overview() {
  const summaryQuery = useGetDashboardSummary();
  const productsQuery = useListProducts();
  const ordersQuery = useListOrders();
  const period = 'Last 7 days';
  const summary = summaryQuery.data;
  const channels = summary?.channelPerformance ?? [];
  const daily = summary?.dailyPerformance ?? [];
  const productPerformance = summary?.productPerformance ?? [];
  const products = productsQuery.data ?? [];
  const orders = ordersQuery.data ?? [];
  const lowStock = products.filter((product) => product.stock <= 3);
  const missingCosts = products.filter((product) => product.cost == null);
  const totalOpens = channels.reduce((sum, channel) => sum + channel.opens, 0);
  const activeChannels = channels.filter((channel) => channel.opens > 0).length;
  const namedClients = new Set(orders.map((order) => order.customerName?.trim()).filter(Boolean)).size;
  const waitingPayments = orders.filter((order) => order.status === 'reserved' || order.status === 'deposit_paid').length;
  const shippedOrders = orders.filter((order) => order.fulfillment === 'shipped' || order.fulfillment === 'delivered').length;
  const paidConversion = orders.length ? Math.round(((summary?.orders ?? 0) / orders.length) * 100) : 0;
  const firstDay = daily[0]?.label;
  const lastDay = daily[daily.length - 1]?.label;
  const dateContext = firstDay && lastDay ? `${firstDay} – ${lastDay}` : 'Your latest reporting window';
  const primaryStatCards = [
    { label: 'Sales', value: ordersQuery.isLoading ? '—' : orders.length, note: `${paidConversion}% paid conversion · ${waitingPayments} waiting payments` },
    { label: 'Revenue', value: money(summary?.revenue), note: 'completed order value' },
    { label: 'New clients', value: ordersQuery.isLoading ? '—' : namedClients, note: `${namedClients} named buyers` },
    { label: 'Active users', value: totalOpens, note: `${activeChannels} active channels` },
  ] as const;
  const secondaryStatCards = [
    { label: 'Outstanding balances', value: money(summary?.outstanding), note: `${waitingPayments} waiting payments` },
    { label: 'Orders', value: summary?.orders ?? 0, note: `${shippedOrders} shipped` },
    { label: 'Shares', value: '—', note: 'Connect a channel to track' },
    { label: 'Likes', value: '—', note: 'Connect a channel to track' },
  ] as const;
  const analyticsState = getAnalyticsViewState({
    isLoading: summaryQuery.isLoading,
    isError: summaryQuery.isError,
    summary,
  });
  return <Shell><div data-testid="dashboard-analytics" data-analytics-state={analyticsState}><AnalyticsStateMarker state={analyticsState} /><PageHeading eyebrow={`Business pulse · ${dateContext}`} title="Know where your shop stands." description="A focused read on cash, stock, and the channels bringing buyers through." action={<div className="flex flex-wrap items-center gap-2"><div className="period-chip" aria-label="Reporting period"><span className="h-2 w-2 rounded-full bg-[hsl(var(--accent-foreground))]" />{period}</div><Link href="/take-order" data-testid="link-take-order-hero"><Button><Plus size={16} />Take an order</Button></Link></div>} />
    {summaryQuery.isLoading ? <OverviewSkeleton /> : summaryQuery.isError ? <ErrorState retry={() => summaryQuery.refetch()} /> : <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {primaryStatCards.map((stat, index) => <MetricCard key={`${stat.label}-${index}`} className="rise-in" style={{ animationDelay: `${index * 55}ms` }} dataTestId={`card-kpi-${stat.label.toLowerCase().replaceAll(' ', '-')}`} label={stat.label} value={stat.value} note={stat.note} />)}
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {secondaryStatCards.map((stat, index) => <MetricCard key={`${stat.label}-${index}`} className="overview-secondary-card rise-in" style={{ animationDelay: `${(index + 4) * 55}ms` }} dataTestId={`card-kpi-secondary-${stat.label.toLowerCase().replaceAll(' ', '-')}`} label={stat.label} value={stat.value} note={stat.note} />)}
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(300px,.8fr)]">
        <Card className="p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="font-mono-ui text-[10px] uppercase tracking-[.15em] text-[hsl(var(--muted-foreground))]">Cash flow</div><h2 className="mt-2 font-display text-xl font-bold tracking-[-.035em]">Revenue, costs, and net profit</h2><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Product costs and operating expenses stay separate</p></div><div className="rounded-[10px] border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 font-mono-ui text-[10px] text-[hsl(var(--muted-foreground))]">{period}</div></div><div className="mt-6 h-[280px]" data-testid="chart-cash-flow">{daily.length ? <ResponsiveContainer width="100%" height="100%" debounce={0}><LineChart data={daily} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}><CartesianGrid strokeDasharray="3 4" stroke="hsl(220 16% 86% / .7)" vertical={false} /><XAxis dataKey="label" tick={{ fontSize: 12, fill: '#68717d' }} stroke="#aeb5bd" tickLine={false} axisLine={false} /><YAxis tick={{ fontSize: 12, fill: '#68717d' }} stroke="#aeb5bd" tickLine={false} axisLine={false} tickFormatter={(value) => money(value)} width={58} /><RechartsTooltip content={<AnalyticsTooltip />} cursor={{ stroke: '#9ca6b2', strokeDasharray: '3 3' }} isAnimationActive={false} /><RechartsLegend wrapperStyle={{ fontSize: '12px', paddingTop: '12px' }} /><Line type="monotone" dataKey="revenue" name="Revenue" stroke="#c9943d" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} isAnimationActive={false} /><Line type="monotone" dataKey="productCosts" name="Product costs" stroke="#b66b77" strokeWidth={2} dot={false} activeDot={{ r: 5 }} isAnimationActive={false} /><Line type="monotone" dataKey="operatingExpenses" name="Operating expenses" stroke="#7b83b7" strokeWidth={2} dot={false} activeDot={{ r: 5 }} isAnimationActive={false} /><Line type="monotone" dataKey="expenses" name="Combined expenses" stroke="#c47763" strokeWidth={2} dot={false} activeDot={{ r: 5 }} isAnimationActive={false} /><Line type="monotone" dataKey="profit" name="Net profit" stroke="#438879" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} isAnimationActive={false} /></LineChart></ResponsiveContainer> : <ChartEmpty message="Cash-flow data will appear after your first activity." />}</div></Card>
        <AlertsRail outstanding={summary?.outstanding ?? 0} lowStock={lowStock} missingCosts={missingCosts} productLoading={productsQuery.isLoading} />
      </div>
      <div className="mt-5 grid gap-5 xl:gap-12 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,.85fr)]">
        <ProductPerformance products={productPerformance} />
        <ChannelPerformance channels={channels} />
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
      eyebrow="Business reports · All recorded activity"
      title="See what is selling."
      description="A clear read on tracked profitability and product demand. This report uses the activity currently recorded in Duka; it does not infer quantities or historical trends."
      action={<div className="reports-period-note" data-testid="text-reports-period"><span className="h-2 w-2 rounded-full bg-[hsl(var(--accent-foreground))]" />Current snapshot</div>}
    />
    {summaryQuery.isLoading ? <ReportsSkeleton /> : summaryQuery.isError ? <ErrorState retry={() => summaryQuery.refetch()} /> : <div className="space-y-5">
      <section className="reports-metric-grid" aria-label="Profitability summary">
         <MetricCard className="rise-in" dataTestId="card-report-tracked-profit" label="Reported profit" value={<span data-testid="text-report-profit">{money(summary?.profit)}</span>} note={summary?.legacyOrders ? `${summary.legacyOrders} legacy ${summary.legacyOrders === 1 ? 'sale uses' : 'sales use'} estimated costs.` : 'Revenue less recorded product and operating costs.'} />
        <MetricCard className="rise-in" style={{ animationDelay: '55ms' }} dataTestId="card-report-cash-balance" label="Cash balance" value={<span data-testid="text-report-cash-balance">{money(summary?.cashBalance)}</span>} note="Available balance in the current workspace snapshot." />
        <MetricCard className="rise-in" style={{ animationDelay: '110ms' }} dataTestId="card-report-context" label="Snapshot context" value={money(summary?.revenue)} note={`${summary?.orders ?? 0} recorded orders${summary?.bestSeller ? ` · ${summary.bestSeller} leads` : ''}`} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,.88fr)_minmax(0,1.12fr)]">
        <Card className="overflow-hidden" data-testid="card-report-category-breakdown">
          <div className="reports-panel-heading"><div><div className="font-mono-ui text-[10px] uppercase tracking-[.15em] text-[hsl(var(--muted-foreground))]">Where revenue sits</div><h2 className="mt-2 font-display text-xl font-bold tracking-[-.035em]">Category breakdown</h2><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Revenue share from product performance</p></div><BarChart3 size={18} className="text-[hsl(var(--muted-foreground))]" /></div>
          <div className="reports-donut-area">
            {categoryData.length && totalCategoryRevenue > 0 ? <ResponsiveContainer width="100%" height="100%"><PieChart>
              <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="47%" innerRadius="54%" outerRadius="73%" paddingAngle={2} stroke="hsl(var(--card))" strokeWidth={3} isAnimationActive={false} label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={{ stroke: '#9aa1a8', strokeWidth: 1 }}>
                {categoryData.map((item, index) => <Cell key={item.name} fill={palette[index % palette.length]} />)}
              </Pie>
              <RechartsTooltip formatter={(value: number) => moneyExact(value)} contentStyle={{ borderRadius: 10, border: '1px solid hsl(42 20% 86%)', background: 'hsl(48 40% 99%)', fontSize: 12 }} itemStyle={{ color: 'hsl(224 27% 17%)' }} isAnimationActive={false} />
              <RechartsLegend verticalAlign="bottom" height={30} iconType="circle" wrapperStyle={{ fontSize: 11, color: '#68717d' }} />
            </PieChart></ResponsiveContainer> : <ChartEmpty message="Category revenue will appear after your first recorded sale." />}
          </div>
          <div className="border-t border-[hsl(var(--border))] px-5 py-4 text-[11px] leading-5 text-[hsl(var(--muted-foreground))] sm:px-6"><strong className="text-[hsl(var(--foreground))]">{categoryData.length ? `${categoryData.length} ${categoryData.length === 1 ? 'category' : 'categories'}` : 'No categories yet'}</strong>{categoryData.length ? ' represented in the current product-performance snapshot.' : ' Product categories will be grouped here once revenue is recorded.'}</div>
       </Card>
        <Card className="overflow-hidden" data-testid="card-report-selling-items">
          <div className="reports-panel-heading"><div><div className="font-mono-ui text-[10px] uppercase tracking-[.15em] text-[hsl(var(--muted-foreground))]">Product performance</div><h2 className="mt-2 font-display text-xl font-bold tracking-[-.035em]">Top-selling items</h2><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Ranked by recorded revenue, not quantity sold</p></div><Package size={18} className="text-[hsl(var(--muted-foreground))]" /></div>
          {rankedProducts.length ? <div className="reports-table-wrap"><table className="reports-table"><thead><tr><th>Item</th><th>Category</th><th className="text-right">Orders</th><th className="text-right">Revenue</th><th>Margin / cost</th><th className="text-right">Stock</th><th>Detail</th></tr></thead><tbody>{rankedProducts.map((item, index) => {
            const share = totalCategoryRevenue ? (item.revenue / totalCategoryRevenue) * 100 : 0;
             return <tr key={`${item.name}-${index}`} data-testid={`row-report-item-${index}`}><td><div className="font-semibold">{item.name}</div></td><td><span className="reports-category-tag">{item.category || 'Uncategorised'}</span></td><td className="text-right font-mono-ui text-xs">{item.orders}</td><td className="text-right font-mono-ui text-xs font-bold">{money(item.revenue)}</td><td>{item.marginStatus === 'tracked' ? <span className="reports-cost-status reports-cost-tracked">{item.margin.toFixed(1)}% margin</span> : item.marginStatus === 'estimated' ? <span className="reports-cost-status reports-cost-missing" title={`${item.legacyOrders} legacy ${item.legacyOrders === 1 ? 'sale' : 'sales'} included`}>{item.margin.toFixed(1)}% estimated</span> : <span className="reports-cost-status reports-cost-missing">Cost not tracked</span>}</td><td className="text-right font-mono-ui text-xs">{item.stock}</td><td className="text-[11px] text-[hsl(var(--muted-foreground))]">{item.legacyOrders ? `${item.legacyOrders} legacy ${item.legacyOrders === 1 ? 'sale' : 'sales'} · ${share ? `${share.toFixed(1)}% of revenue` : 'no revenue share'}` : share ? `${share.toFixed(1)}% of recorded revenue` : 'No revenue recorded'}</td></tr>;
          })}</tbody></table></div> : <div className="p-6"><EmptyState icon={PackageSearch} title="No selling pattern yet" description="Once product performance is recorded, your highest-revenue items will appear here." /></div>}
        </Card>
      </section>
       <div className="flex items-start gap-3 rounded-[12px] border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/55 px-4 py-3 text-[11px] leading-5 text-[hsl(var(--muted-foreground))]" data-testid="text-report-data-note"><CircleDollarSign size={15} className="mt-0.5 shrink-0 text-[hsl(var(--accent-foreground))]" /><span><strong className="text-[hsl(var(--foreground))]">A note on this report:</strong> Duka currently records orders, revenue, stock, and optional product costs. {summary?.legacyOrders ? `${summary.legacyOrders} legacy ${summary.legacyOrders === 1 ? 'sale has' : 'sales have'} no captured sale-time cost, so affected margins and product costs are estimates based on today’s catalog.` : 'All paid sales have captured sale-time costs.'} It does not store item quantity or historical comparison data, so this page intentionally uses “orders” and “detail” rather than invented sales trends.</span></div>
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

function AlertsRail({ outstanding, lowStock, missingCosts, productLoading }: { outstanding: number; lowStock: Product[]; missingCosts: Product[]; productLoading: boolean }) {
  const alerts = [
    { icon: Receipt, tone: 'rose', title: outstanding > 0 ? `${money(outstanding)} outstanding` : 'No outstanding deposits', detail: outstanding > 0 ? 'Follow up on deposits before they go cold.' : 'Your deposits are all accounted for.', href: '/orders', action: outstanding > 0 ? 'Review orders' : 'Open orders' },
    { icon: PackageSearch, tone: 'gold', title: productLoading ? 'Checking stock levels' : `${lowStock.length} low-stock ${lowStock.length === 1 ? 'item' : 'items'}`, detail: lowStock.length ? lowStock.slice(0, 2).map((item) => item.name).join(' · ') : 'Nothing needs a restock right now.', href: '/catalog', action: 'Review catalog' },
    { icon: CircleDollarSign, tone: 'blue', title: productLoading ? 'Checking cost prices' : `${missingCosts.length} missing cost ${missingCosts.length === 1 ? 'price' : 'prices'}`, detail: missingCosts.length ? 'Add costs to keep margin reporting honest.' : 'All catalog costs are tracked.', href: '/catalog', action: 'Add costs' },
  ];
  return <Card className="overflow-hidden"><div className="border-b border-[hsl(var(--border))] px-5 py-5 sm:px-6"><div className="flex items-center gap-2"><AlertTriangle size={16} className="text-[hsl(var(--chart-3))]" /><div className="font-mono-ui text-[10px] uppercase tracking-[.15em] text-[hsl(var(--muted-foreground))]">Action rail</div></div><h2 className="mt-2 font-display text-xl font-bold tracking-[-.035em]">Worth a look</h2></div><div className="divide-y divide-[hsl(var(--border))]">{alerts.map((alert) => <Link href={alert.href} key={alert.title} className="alert-row group flex gap-3 px-5 py-4 sm:px-6" data-testid={`link-alert-${alert.tone}`}><div className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px]', alert.tone === 'rose' && 'bg-[hsl(345_39%_58%/.14)] text-[hsl(345_39%_40%)]', alert.tone === 'gold' && 'bg-[hsl(42_81%_67%/.25)] text-[hsl(31_64%_34%)]', alert.tone === 'blue' && 'bg-[hsl(220_45%_47%/.13)] text-[hsl(220_45%_37%)]')}><alert.icon size={15} /></div><div className="min-w-0 flex-1"><div className="text-sm font-semibold">{alert.title}</div><p className="mt-1 text-xs leading-5 text-[hsl(var(--muted-foreground))]">{alert.detail}</p><div className="mt-2 text-[10px] font-bold text-[hsl(var(--primary))] group-hover:underline">{alert.action}<ArrowUpRight size={12} className="ml-1 inline" /></div></div></Link>)}</div></Card>;
}

function ProductPerformance({ products }: { products: Array<{ name: string; category: string; revenue: number; orders: number; stock: number; margin: number; costTracked: boolean; marginStatus: 'tracked' | 'estimated' | 'unavailable'; snapshotOrders: number; legacyOrders: number }> }) {
  const ranked = [...products].sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  const maxRevenue = Math.max(...ranked.map((product) => product.revenue), 1);
  return <section className="overview-stat-section overview-product-card" aria-labelledby="product-performance-title"><div className="overview-stat-heading flex items-start justify-between gap-4"><div><div className="font-mono-ui text-[10px] uppercase tracking-[.15em] text-[hsl(var(--muted-foreground))]">Product performance</div><h2 id="product-performance-title" className="mt-2 font-display text-xl font-bold tracking-[-.035em]">Best-performing items</h2></div><Package size={18} className="text-[hsl(var(--muted-foreground))]" /></div>{ranked.length ? <div className="overview-stat-list mt-5">{ranked.map((product, index) => { const barWidth = Math.max(8, (product.revenue / maxRevenue) * 100); return <div key={product.name} className="product-performance-row" data-testid={`row-product-performance-${index}`}><div className="flex items-center justify-between gap-4"><div className="min-w-0 truncate text-sm font-semibold">{product.name}</div><div className="product-performance-value font-mono-ui text-sm font-bold">{money(product.revenue)}</div></div><div className="product-performance-track mt-2" role="progressbar" aria-label={`${product.name} revenue`} aria-valuemin={0} aria-valuemax={maxRevenue} aria-valuenow={product.revenue}><div className="product-performance-fill" style={{ width: `${barWidth}%` }} /></div></div>; })}</div> : <div className="mt-5"><ChartEmpty message="Product performance will appear after your first sale." /></div>}</section>;
}

function ChannelPerformance({ channels }: { channels: Array<{ channel: string; revenue: number; orders: number; paidOrders: number; opens: number; conversionRate: number }> }) {
  const maxOpens = Math.max(...channels.map((channel) => channel.opens), 1);
  return <section className="overview-stat-section overview-channel-card" aria-labelledby="channel-performance-title"><div className="overview-stat-heading flex items-start justify-between gap-4"><div><div className="font-mono-ui text-[10px] uppercase tracking-[.15em] text-[hsl(var(--muted-foreground))]">Channel conversion</div><h2 id="channel-performance-title" className="mt-2 font-display text-xl font-bold tracking-[-.035em]">Turn attention into orders</h2><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Open-to-order performance by channel</p></div><Eye size={18} className="text-[hsl(var(--muted-foreground))]" /></div>{channels.length ? <div className="overview-stat-list mt-6">{channels.map((channel) => <div key={channel.channel} className="channel-performance-row" data-testid={`row-channel-${channel.channel}`}><div className="flex items-center justify-between gap-4"><span className="text-sm font-semibold">{channelName(channel.channel)}</span><span className="font-mono-ui text-sm font-bold">{channel.conversionRate.toFixed(1)}%</span></div><div className="mt-3 flex items-center gap-3"><div className="relative h-2 flex-1 overflow-hidden rounded-full bg-[hsl(var(--muted))]"><div className="h-full rounded-full bg-[hsl(var(--primary))]" style={{ width: `${Math.max(5, (channel.opens / maxOpens) * 100)}%` }} /></div><span className="font-mono-ui text-[10px] text-[hsl(var(--muted-foreground))]">{channel.opens} opens</span></div><div className="mt-2 flex gap-4 text-[11px] text-[hsl(var(--muted-foreground))]"><span><strong className="text-[hsl(var(--foreground))]">{channel.paidOrders}</strong> paid</span><span><strong className="text-[hsl(var(--foreground))]">{channel.orders}</strong> orders</span><span className="ml-auto">{money(channel.revenue)}</span></div></div>)}</div> : <div className="mt-6"><ChartEmpty message="Channel conversion will appear after you share a link." /></div>}</section>;
}

function RecentTransactions() {
  const query = useListOrders();
  const orders = (query.data ?? []).slice(0, 6);
  return <Card className="mt-5 overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-[hsl(var(--border))] px-5 py-5 sm:px-6"><div><div className="font-mono-ui text-[10px] uppercase tracking-[.15em] text-[hsl(var(--muted-foreground))]">Latest activity</div><h2 className="mt-2 font-display text-xl font-bold tracking-[-.035em]">Recent transactions</h2></div><Link href="/orders" data-testid="link-see-all-orders"><Button variant="ghost">See all <ArrowUpRight size={15} /></Button></Link></div>{query.isLoading ? <div className="space-y-4 p-6"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div> : query.isError ? <div className="p-6"><ErrorState retry={() => query.refetch()} /></div> : orders.length ? <div className="overflow-x-auto"><table className="w-full min-w-[690px] text-left"><thead className="bg-[hsl(var(--background))] text-[10px] uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]"><tr><th className="px-5 py-3 font-semibold sm:px-6">Transaction</th><th className="px-4 py-3 font-semibold">Channel</th><th className="px-4 py-3 font-semibold">Date</th><th className="px-4 py-3 text-right font-semibold">Amount</th><th className="px-5 py-3 text-right font-semibold sm:px-6">Status</th></tr></thead><tbody className="divide-y divide-[hsl(var(--border))]">{orders.map((order) => <tr key={order.id} className="transaction-row" data-testid={`row-transaction-${order.id}`}><td className="px-5 py-4 sm:px-6"><div className="flex items-center gap-3"><div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[hsl(var(--muted))] font-mono-ui text-[10px] font-bold">{initials(order.customerName || order.productName)}</div><div><div className="text-sm font-semibold">{order.productName}</div><div className="mt-0.5 text-[11px] text-[hsl(var(--muted-foreground))]">{order.customerName || 'Buyer pending'}</div></div></div></td><td className="px-4 py-4 text-sm">{channelName(order.channel)}</td><td className="px-4 py-4 text-sm text-[hsl(var(--muted-foreground))]">{dateShort(order.createdAt)}</td><td className="px-4 py-4 text-right font-mono-ui text-xs font-bold">{moneyExact(order.amount)}</td><td className="px-5 py-4 text-right sm:px-6"><StatusPill tone={paymentTone(order.status)}>{order.status.replace('_', ' ')}</StatusPill></td></tr>)}</tbody></table></div> : <div className="p-8"><EmptyState icon={ShoppingBag} title="No transactions yet" description="Create a shareable order link and your first buyer can get started." action={<Link href="/take-order"><Button><Plus size={15} />Create a link</Button></Link>} /></div>}</Card>;
}

function OrderRow({ order, compact = false }: { order: Order; compact?: boolean }) {
  return <div className={cn('flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between', compact && 'py-3.5')} data-testid={`row-order-${order.id}`}><div className="flex items-center gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-[hsl(var(--muted))] font-mono-ui text-[10px] font-bold">{initials(order.customerName || order.productName)}</div><div><div className="text-sm font-semibold">{order.customerName || 'Buyer pending'}</div><div className="mt-0.5 text-[11px] text-[hsl(var(--muted-foreground))]">{order.productName} · {channelName(order.channel)}</div></div></div><div className="flex items-center gap-4 pl-12 sm:pl-0"><div className="text-right"><div className="font-mono-ui text-xs font-bold">{moneyExact(order.amount)}</div><div className="mt-1 text-[10px] text-[hsl(var(--muted-foreground))]">{dateShort(order.createdAt)}</div></div><StatusPill tone={paymentTone(order.status)}>{order.status.replace('_', ' ')}</StatusPill></div></div>;
}

type ProductFormState = { name: string; category: string; price: string; cost: string; stock: string; variants: string; accent: string };
const blankProduct: ProductFormState = { name: '', category: 'Apparel', price: '', cost: '', stock: '0', variants: '', accent: '#E6B85C' };
function ProductModal({ product, onClose }: { product?: Product; onClose: () => void }) {
  const queryClient = useQueryClient();
  const create = useCreateProduct(); const update = useUpdateProduct();
  const [form, setForm] = useState<ProductFormState>(product ? { name: product.name, category: product.category, price: String(product.price), cost: product.cost == null ? '' : String(product.cost), stock: String(product.stock), variants: product.variants.join(', '), accent: product.accent } : blankProduct);
  const pending = create.isPending || update.isPending;
  const change = (key: keyof ProductFormState, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const save = (event: React.FormEvent) => { event.preventDefault(); const data: ProductInput = { name: form.name.trim(), category: form.category, price: Number(form.price), cost: form.cost === '' ? null : Number(form.cost), stock: Number(form.stock), variants: form.variants.split(',').map((item) => item.trim()).filter(Boolean), accent: form.accent }; if (!data.name || Number.isNaN(data.price)) return; const onSuccess = () => { queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() }); onClose(); }; product ? update.mutate({ id: product.id, data }, { onSuccess }) : create.mutate({ data }, { onSuccess }); };
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-[hsl(220_30%_17%/.45)] p-0 backdrop-blur-sm sm:items-center sm:p-5"><div className="max-h-[92dvh] w-full max-w-[560px] overflow-y-auto rounded-t-[20px] border border-[hsl(var(--card-border))] bg-[hsl(var(--card))] p-6 sm:rounded-[20px] sm:p-8"><div className="flex items-start justify-between"><div><div className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">{product ? 'Edit item' : 'New item'}</div><h2 className="mt-2 font-display text-2xl font-bold tracking-[-.04em]">{product ? 'Update your item.' : 'Add to your catalog.'}</h2></div><button onClick={onClose} data-testid="button-close-product-modal" className="rounded-lg p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]"><X size={18} /></button></div><form onSubmit={save} className="mt-7 space-y-5"><div><label className="field-label">Item name</label><input data-testid="input-product-name" autoFocus required value={form.name} onChange={(e) => change('name', e.target.value)} placeholder="e.g. Linen wrap top" className="field-input" /></div><div className="grid gap-5 sm:grid-cols-2"><div><label className="field-label">Category</label><select data-testid="select-product-category" value={form.category} onChange={(e) => change('category', e.target.value)} className="field-input"><option>Apparel</option><option>Accessories</option><option>Home</option><option>Beauty</option><option>Food & drink</option><option>Other</option></select></div><div><label className="field-label">Stock on hand</label><input data-testid="input-product-stock" type="number" min="0" required value={form.stock} onChange={(e) => change('stock', e.target.value)} className="field-input" /></div></div><div className="grid gap-5 sm:grid-cols-2"><div><label className="field-label">Selling price</label><div className="relative"><span className="absolute left-3 top-2.5 text-sm text-[hsl(var(--muted-foreground))]">$</span><input data-testid="input-product-price" type="number" min="0" step=".01" required value={form.price} onChange={(e) => change('price', e.target.value)} className="field-input pl-7" /></div></div><div><label className="field-label">Cost <span className="font-normal text-[hsl(var(--muted-foreground))]">(optional)</span></label><div className="relative"><span className="absolute left-3 top-2.5 text-sm text-[hsl(var(--muted-foreground))]">$</span><input data-testid="input-product-cost" type="number" min="0" step=".01" value={form.cost} onChange={(e) => change('cost', e.target.value)} placeholder="Not tracked" className="field-input pl-7" /></div></div></div><div><label className="field-label">Variants <span className="font-normal text-[hsl(var(--muted-foreground))]">(comma separated)</span></label><input data-testid="input-product-variants" value={form.variants} onChange={(e) => change('variants', e.target.value)} placeholder="Small, Medium, Large" className="field-input" /></div><div><label className="field-label">Accent color</label><div className="flex gap-2">{['#E6B85C', '#8BBDA9', '#D79AA9', '#96A8CE', '#D99566'].map((color) => <button type="button" key={color} onClick={() => change('accent', color)} data-testid={`button-accent-${color.slice(1)}`} className={cn('h-8 w-8 rounded-full border-2 transition-transform', form.accent === color ? 'scale-110 border-[hsl(var(--foreground))]' : 'border-transparent')} style={{ backgroundColor: color }} />)}</div></div><div className="flex justify-end gap-3 border-t border-[hsl(var(--border))] pt-5"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" disabled={pending}>{pending && <Loader2 size={15} className="animate-spin" />}{product ? 'Save changes' : 'Add item'}</Button></div></form></div></div>;
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

function ExpenseModal({ expense, onClose }: { expense?: Expense; onClose: () => void }) {
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
      <div className="flex items-start justify-between"><div><div className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">{expense ? 'Edit expense' : 'New expense'}</div><h2 className="mt-2 font-display text-2xl font-bold tracking-[-.04em]">{expense ? 'Keep the record accurate.' : 'Record a shop expense.'}</h2><p className="mt-2 text-xs leading-5 text-[hsl(var(--muted-foreground))]">Operating expenses stay separate from product costs in your dashboard.</p></div><button onClick={onClose} data-testid="button-close-expense-modal" className="rounded-lg p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]"><X size={18} /></button></div>
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
  return <Shell><PageHeading eyebrow="Keep the full picture" title="Expenses" description="Record the running costs of your shop. These stay separate from product costs so profit means what you think it means." action={<Button onClick={() => setModal('new')} data-testid="button-new-expense"><Plus size={16} />Add expense</Button>} />
    <div className="mb-5 grid gap-4 md:grid-cols-3"><MetricCard dataTestId="card-expenses-total" label="All operating expenses" value={moneyExact(total)} note={`${query.data?.length ?? 0} recorded expenses`} /><MetricCard dataTestId="card-expenses-visible" label="Showing now" value={moneyExact(visibleTotal)} note={`${expenses.length} matching entries`} /><InsightCard dataTestId="card-expenses-profit-note" icon={CircleDollarSign} title="A clearer profit view" description="Operating expenses flow into combined expenses, not gross margin." /></div>
    <Card className="overflow-hidden"><div className="flex flex-col gap-3 border-b border-[hsl(var(--border))] p-5 sm:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-2.5 text-[hsl(var(--muted-foreground))]" size={16} /><input data-testid="input-search-expenses" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search expenses" className="field-input pl-9" /></div><select data-testid="select-filter-expenses" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="field-input sm:max-w-[220px]"><option value="all">All categories</option>{expenseCategories.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
      {query.isLoading ? <div className="space-y-4 p-6"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div> : query.isError ? <div className="p-6"><ErrorState retry={() => query.refetch()} /></div> : expenses.length ? <div className="divide-y divide-[hsl(var(--border))]">{expenses.map((expense) => <div key={expense.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6" data-testid={`row-expense-${expense.id}`}><div className="min-w-0"><div className="flex items-center gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"><Receipt size={16} /></div><div className="min-w-0"><div className="truncate text-sm font-semibold">{expense.title}</div><div className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">{expenseCategoryLabel(expense.category)} · {dateShort(expense.date)}{expense.note ? ` · ${expense.note}` : ''}</div></div></div></div><div className="flex items-center justify-between gap-4 sm:justify-end"><div className="font-mono-ui text-sm font-bold">{moneyExact(expense.amount)}</div><div className="flex gap-1"><button onClick={() => setModal(expense)} data-testid={`button-edit-expense-${expense.id}`} className="rounded-lg p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]"><Pencil size={15} /></button><button onClick={() => remove(expense)} disabled={deleteExpense.isPending} data-testid={`button-delete-expense-${expense.id}`} className="rounded-lg p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--destructive))]/10 hover:text-[hsl(var(--destructive))]"><Trash2 size={15} /></button></div></div></div>)}</div> : <div className="p-6"><EmptyState icon={Receipt} title={search || categoryFilter !== 'all' ? 'No matching expenses' : 'No operating expenses yet'} description={search || categoryFilter !== 'all' ? 'Try another search or category.' : 'Record rent, delivery, supplies, and other costs that keep your shop moving.'} action={<Button onClick={() => setModal('new')}><Plus size={15} />Add your first expense</Button>} /></div>}
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
    <PageHeading eyebrow="Your products" title="Catalog" description="A calm inventory desk for the items behind every buyer link." action={<Button onClick={() => setModal('new')} data-testid="button-new-product"><Plus size={16} />Add item</Button>} />
    <section className="catalog-summary" aria-label="Catalog summary">
      <MetricCard className="rise-in" dataTestId="card-catalog-inventory-value" label="Inventory value" value={money(inventoryValue)} note={`Current selling value across ${query.data?.length ?? 0} catalog ${(query.data?.length ?? 0) === 1 ? 'item' : 'items'}.`} />
      <MetricCard className="rise-in" style={{ animationDelay: '55ms' }} dataTestId="card-catalog-items" label="Items" value={query.data?.length ?? 0} note="In your catalog" />
      <MetricCard className="rise-in" style={{ animationDelay: '110ms' }} dataTestId="card-catalog-low-stock" label="Low stock" value={<span className={cn(lowStock > 0 && 'text-[hsl(var(--destructive))]')}>{lowStock}</span>} note={lowStock ? 'Need attention' : 'All levels look good'} />
      <MetricCard className="rise-in" style={{ animationDelay: '165ms' }} dataTestId="card-catalog-categories" label="Categories" value={categories} note="Across your shop" />
    </section>
    <Card className="catalog-workspace mt-5 overflow-hidden">
      <div className="catalog-toolbar">
        <div><div className="catalog-toolbar-kicker">Inventory list</div><h2 className="font-display text-xl font-bold tracking-[-.04em]">Everything you sell</h2></div>
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
          <div className="catalog-actions"><button onClick={() => setModal(product)} data-testid={`button-edit-product-${product.id}`} className="catalog-icon-button" title={`Edit ${product.name}`}><Pencil size={15} /></button><button onClick={() => remove(product)} disabled={deleteProduct.isPending} data-testid={`button-delete-product-${product.id}`} className="catalog-icon-button is-danger" title={`Delete ${product.name}`}><Trash2 size={15} /></button></div>
        </div>)}
      </div> : <div className="p-6"><EmptyState icon={Package} title={search ? 'No matching items' : 'Your catalog is waiting'} description={search ? 'Try a different name or category.' : 'Add your first item to start sending buyers a link.'} action={!search && <Button onClick={() => setModal('new')}><Plus size={15} />Add your first item</Button>} /></div>}
    </Card>
    {modal && <ProductModal product={modal === 'new' ? undefined : modal} onClose={() => setModal(null)} />}
  </Shell>;
}

function LegacyOrders() {
  const query = useListOrders(); const update = useUpdateOrder(); const [filter, setFilter] = useState('all'); const [search, setSearch] = useState(''); const queryClient = useQueryClient();
  const orders = useMemo(() => (query.data ?? []).filter((order) => (filter === 'all' || order.status === filter || order.fulfillment === filter) && `${order.customerName} ${order.productName} ${order.token}`.toLowerCase().includes(search.toLowerCase())), [query.data, filter, search]);
  const updateOrder = (order: Order, data: { status?: 'reserved' | 'deposit_paid' | 'paid'; fulfillment?: 'pending' | 'shipped' | 'delivered' }) => update.mutate({ id: order.id, data }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() }) });
  const copyLink = async (token: string) => { await navigator.clipboard?.writeText(`${window.location.origin}/o/${token}`); };
  return <Shell><PageHeading eyebrow="Keep things moving" title="Orders" description="Payment, fulfillment, and the next useful action for every buyer." action={<Link href="/take-order"><Button><Plus size={16} />Take an order</Button></Link>} /><div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div className="relative max-w-[360px] flex-1"><Search className="absolute left-3 top-2.5 text-[hsl(var(--muted-foreground))]" size={16} /><input data-testid="input-search-orders" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search orders" className="field-input pl-9" /></div><div className="flex flex-wrap gap-2">{['all', 'reserved', 'deposit_paid', 'paid', 'shipped'].map((value) => <button key={value} onClick={() => setFilter(value)} aria-pressed={filter === value} data-testid={`button-filter-${value}`} className={cn('soft-focus rounded-full px-3 py-2 text-[10px] font-bold capitalize transition-colors', filter === value ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] ring-2 ring-[hsl(var(--primary))] ring-offset-2 ring-offset-[hsl(var(--background))]' : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]')}>{value.replace('_', ' ')}</button>)}</div></div>{query.isLoading ? <Card className="space-y-5 p-6"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></Card> : query.isError ? <ErrorState retry={() => query.refetch()} /> : orders.length ? <Card className="overflow-hidden"><div className="hidden grid-cols-[1.45fr_.85fr_.7fr_.7fr_auto] gap-4 border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))]/50 px-6 py-3 text-[10px] font-bold uppercase tracking-[.13em] text-[hsl(var(--muted-foreground))] md:grid"><span>Buyer</span><span>Payment</span><span>Fulfillment</span><span>Placed</span><span /></div>{orders.map((order) => <div key={order.id} className="grid gap-3 border-b border-[hsl(var(--border))] px-5 py-4 last:border-0 md:grid-cols-[1.45fr_.85fr_.7fr_.7fr_auto] md:items-center md:gap-4 md:px-6" data-testid={`row-orders-order-${order.id}`}><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[hsl(var(--muted))] font-mono-ui text-[10px] font-bold">{initials(order.customerName || order.productName)}</div><div><div className="text-sm font-semibold">{order.customerName || 'Buyer pending'}</div><div className="mt-0.5 text-[11px] text-[hsl(var(--muted-foreground))]">{order.productName} · {channelName(order.channel)}</div></div></div><div className="flex items-center justify-between md:block"><span className="text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))] md:hidden">Payment</span><button data-testid={`button-payment-${order.id}`} onClick={() => updateOrder(order, { status: order.status === 'reserved' ? 'deposit_paid' : order.status === 'deposit_paid' ? 'paid' : 'reserved' })}><StatusPill tone={paymentTone(order.status)}>{order.status.replace('_', ' ')}</StatusPill></button></div><div className="flex items-center justify-between md:block"><span className="text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))] md:hidden">Delivery</span><button data-testid={`button-fulfillment-${order.id}`} onClick={() => updateOrder(order, { fulfillment: order.fulfillment === 'pending' ? 'shipped' : order.fulfillment === 'shipped' ? 'delivered' : 'pending' })}><StatusPill tone={fulfillmentTone(order.fulfillment)}>{order.fulfillment}</StatusPill></button></div><div className="hidden font-mono-ui text-[10px] text-[hsl(var(--muted-foreground))] md:block">{dateShort(order.createdAt)}<div className="mt-1 text-[12px] font-bold text-[hsl(var(--foreground))]">{moneyExact(order.amount)}</div></div><div className="flex justify-end gap-1"><button onClick={() => copyLink(order.token)} data-testid={`button-copy-link-${order.id}`} className="rounded-lg p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]" title="Copy buyer link"><Copy size={15} /></button><Link href={`/o/${order.token}`} data-testid={`link-open-order-${order.id}`} className="rounded-lg p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]"><ExternalLink size={15} /></Link></div></div>)}</Card> : <EmptyState icon={ShoppingBag} title={search || filter !== 'all' ? 'No orders match' : 'Your order list is quiet'} description={search || filter !== 'all' ? 'Try another filter or search.' : 'When buyers use your links, their orders will show up here.'} />}</Shell>;
}

function Orders() {
  const [location] = useLocation();
  const query = useListOrders();
  const update = useUpdateOrder();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState(() => new URLSearchParams(window.location.search).get('customer') ?? '');
  const [copiedId, setCopiedId] = useState<number | null>(null);
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
    update.mutate({ id: order.id, data }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() }) });
  };
  const copyLink = async (order: Order) => {
    await navigator.clipboard?.writeText(`${window.location.origin}/o/${order.token}`);
    setCopiedId(order.id);
    window.setTimeout(() => setCopiedId((current) => current === order.id ? null : current), 1800);
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
  const paymentLabel = (order: Order) => order.status === 'deposit_paid' ? 'Deposit paid' : order.status === 'paid' ? 'Paid in full' : 'Awaiting payment';
  const fulfillmentLabel = (value: Order['fulfillment']) => value === 'pending' ? 'To ship' : value;
  const pendingFulfillment = allOrders.filter((order) => order.fulfillment === 'pending').length;

  return <Shell>
    <PageHeading eyebrow="Transaction workspace" title="Orders, in motion." description="See what came in, what is collected, and the next handoff for every buyer." action={<Link href="/take-order" data-testid="link-take-order-orders"><Button><Plus size={16} />Take an order</Button></Link>} />
    <section className="orders-snapshot" aria-label="Order performance summary">
      <MetricCard className="rise-in" dataTestId="card-orders-live-value" label="Live order value" value={<span data-testid="text-live-order-value">{money(metrics.orderValue)}</span>} note={`${money(metrics.collected)} collected · ${money(metrics.outstanding)} outstanding`} />
      <MetricCard className="rise-in" style={{ animationDelay: '55ms' }} dataTestId="card-orders-total" label="Total orders" value={<span data-testid="text-total-orders">{allOrders.length}</span>} note={`${metrics.paidOrders} paid in full`} />
      <MetricCard className="rise-in" style={{ animationDelay: '110ms' }} dataTestId="card-orders-average" label="Average order value" value={<span data-testid="text-average-order-value">{money(metrics.average)}</span>} note="Based on live order value" />
      <MetricCard className="rise-in" style={{ animationDelay: '165ms' }} dataTestId="card-orders-collection-rate" label="Collection rate" value={<span data-testid="text-collection-rate">{metrics.collectionRate.toFixed(1)}%</span>} note="Paid amount against order value" />
    </section>
    <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(280px,.75fr)]">
      <Card className="overflow-hidden">
        <div className="orders-panel-heading"><div><div className="font-mono-ui text-[10px] uppercase tracking-[.15em] text-[hsl(var(--muted-foreground))]">Revenue sources</div><h2 className="mt-2 font-display text-xl font-bold tracking-[-.04em]">Where orders start</h2><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Share of {allOrders.length} live {allOrders.length === 1 ? 'order' : 'orders'}, by channel.</p></div><div className="orders-channel-total"><span>{channelMix.length}</span><small>channels</small></div></div>
         {query.isLoading ? <div className="space-y-4 p-6"><Skeleton className="h-7 w-full" /><Skeleton className="h-7 w-4/5" /><Skeleton className="h-7 w-3/5" /></div> : channelMix.length ? <div className="space-y-4 px-5 pb-6 sm:px-6">{channelMix.slice(0, 5).map(([channel, count], index) => <div key={channel} data-testid={`row-channel-mix-${channel}`}><div className="flex items-center justify-between gap-3 text-xs"><span className="font-semibold">{channelName(channel)}</span><span className="font-mono-ui text-[10px] text-[hsl(var(--muted-foreground))]">{count} · {((count / allOrders.length) * 100).toFixed(0)}%</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-[hsl(var(--muted))]"><div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${(count / maxChannelOrders) * 100}%`, backgroundColor: chartFills[index % chartFills.length] }} /></div></div>)}</div> : <div className="p-6"><ChartEmpty message="Channel mix will appear when buyers use a link." /></div>}
      </Card>
      <Card className="orders-signal-card p-5 sm:p-6"><div className="flex items-center gap-2"><Sparkles size={16} className="text-[hsl(var(--chart-1))]" /><div className="font-mono-ui text-[10px] uppercase tracking-[.15em] text-[hsl(var(--muted-foreground))]">Next useful move</div></div><h2 className="mt-3 font-display text-xl font-bold tracking-[-.04em]">{metrics.outstanding > 0 ? 'Follow up on collection.' : pendingFulfillment ? 'Move a delivery forward.' : 'Your desk is caught up.'}</h2><p className="mt-2 text-xs leading-5 text-[hsl(var(--muted-foreground))]">{metrics.outstanding > 0 ? `${money(metrics.outstanding)} is still outstanding across ${allOrders.filter((order) => order.status !== 'paid').length} orders.` : pendingFulfillment ? `${pendingFulfillment} ${pendingFulfillment === 1 ? 'order is' : 'orders are'} ready for a fulfillment update.` : 'Payment and fulfillment have no pending handoffs.'}</p><div className="orders-signal-rule" /><div className="flex items-center justify-between text-[11px]"><span className="text-[hsl(var(--muted-foreground))]">Orders to ship</span><strong data-testid="text-orders-to-ship">{pendingFulfillment}</strong></div><div className="mt-3 flex items-center justify-between text-[11px]"><span className="text-[hsl(var(--muted-foreground))]">Delivered</span><strong data-testid="text-orders-delivered">{allOrders.filter((order) => order.fulfillment === 'delivered').length}</strong></div></Card>
    </section>
    <section className="mt-5">
      <Card className="overflow-hidden">
        <div className="orders-workspace-heading"><div><div className="font-mono-ui text-[10px] uppercase tracking-[.15em] text-[hsl(var(--muted-foreground))]">Orders / transactions</div><h2 className="mt-2 font-display text-xl font-bold tracking-[-.04em]">The handoff desk</h2><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Click a payment or delivery status to advance it.</p></div><div className="orders-result-count" data-testid="text-orders-result-count"><strong>{orders.length}</strong> of {allOrders.length}</div></div>
        <div className="orders-controls"><div className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-3 top-2.5 text-[hsl(var(--muted-foreground))]" size={16} /><input aria-label="Search orders" data-testid="input-search-orders" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search buyer, product, phone, or link token" className="field-input pl-9" /></div><div className="orders-filter-label">Filter by stage</div><div className="orders-filter-scroll" role="group" aria-label="Order filters">{filterOptions.map((option) => <button type="button" key={option.value} onClick={() => setFilter(option.value)} aria-pressed={filter === option.value} data-testid={`button-filter-${option.value}`} className={cn('orders-filter-button', filter === option.value && 'is-active')}>{option.label}</button>)}</div></div>
        {query.isLoading ? <div className="space-y-4 p-5 sm:p-6" aria-label="Loading orders"><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></div> : query.isError ? <div className="p-5 sm:p-6"><ErrorState retry={() => query.refetch()} /></div> : orders.length ? <div className="orders-table-wrap"><div className="orders-table-head"><span>Buyer / item</span><span>Payment</span><span>Fulfillment</span><span>Order value</span><span>Placed</span><span className="sr-only">Actions</span></div>{orders.map((order) => <div key={order.id} className="orders-table-row" data-testid={`row-orders-order-${order.id}`}><div className="orders-buyer-cell"><div className="orders-avatar">{initials(order.customerName || order.productName)}</div><div className="min-w-0"><div className="truncate text-sm font-semibold">{order.customerName || 'Buyer pending'}</div><div className="mt-1 truncate text-[11px] text-[hsl(var(--muted-foreground))]">{order.productName} <span className="mx-1 opacity-50">·</span> {channelName(order.channel)} <span className="mx-1 opacity-50">·</span> {order.linkOpens} opens</div></div></div><div className="orders-cell-labeled"><span className="orders-mobile-label">Payment</span><button type="button" disabled={update.isPending} aria-label={`Advance payment status for ${order.customerName || order.productName}`} title="Advance payment status" data-testid={`button-payment-${order.id}`} onClick={() => { const status: 'reserved' | 'deposit_paid' | 'paid' = order.status === 'reserved' ? 'deposit_paid' : order.status === 'deposit_paid' ? 'paid' : 'reserved'; updateOrder(order, { status }); }}><StatusPill tone={order.status === 'paid' ? 'mint' : order.status === 'deposit_paid' ? 'gold' : 'neutral'}>{paymentLabel(order)}</StatusPill></button></div><div className="orders-cell-labeled"><span className="orders-mobile-label">Fulfillment</span><button type="button" disabled={update.isPending} aria-label={`Advance fulfillment status for ${order.customerName || order.productName}`} title="Advance fulfillment status" data-testid={`button-fulfillment-${order.id}`} onClick={() => { const fulfillment: 'pending' | 'shipped' | 'delivered' = order.fulfillment === 'pending' ? 'shipped' : order.fulfillment === 'shipped' ? 'delivered' : 'pending'; updateOrder(order, { fulfillment }); }}><StatusPill tone={order.fulfillment === 'delivered' ? 'mint' : order.fulfillment === 'shipped' ? 'blue' : 'neutral'}>{fulfillmentLabel(order.fulfillment)}</StatusPill></button></div><div className="orders-value-cell"><span className="orders-mobile-label">Order value</span><div className="font-mono-ui text-xs font-bold">{moneyExact(order.amount)}</div><div className="mt-1 text-[10px] text-[hsl(var(--muted-foreground))]">{moneyExact(collectedFor(order))} collected</div></div><div className="orders-date-cell"><span className="orders-mobile-label">Placed</span><span className="font-mono-ui text-[10px] text-[hsl(var(--muted-foreground))]">{dateShort(order.createdAt)}</span></div><div className="orders-actions"><button type="button" onClick={() => copyLink(order)} data-testid={`button-copy-link-${order.id}`} className="soft-focus orders-icon-button" title="Copy buyer link" aria-label={`Copy buyer link for ${order.customerName || order.productName}`}>{copiedId === order.id ? <Check size={15} /> : <Copy size={15} />}</button><Link href={`/o/${order.token}`} data-testid={`link-open-order-${order.id}`} className="soft-focus orders-icon-button" title="Open buyer preview" aria-label={`Open buyer preview for ${order.customerName || order.productName}`}><ExternalLink size={15} /></Link></div></div>)}</div> : <div className="p-5 sm:p-6"><EmptyState icon={ShoppingBag} title={search || filter !== 'all' ? 'No orders match' : 'Your order list is quiet'} description={search || filter !== 'all' ? 'Try another filter or search.' : 'When buyers use your links, their orders will show up here.'} action={!search && filter === 'all' ? <Link href="/take-order" data-testid="link-create-first-order"><Button><Plus size={15} />Create a link</Button></Link> : undefined} /></div>}
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
      eyebrow="Customer memory · order history"
      title="Clients"
      description="A living list of the people behind your orders, ready when it is time to welcome them back."
      action={<div className="clients-header-note"><Users size={15} /><span>Built from your order history</span></div>}
    />
    {query.isLoading ? <ClientsSkeleton /> : query.isError ? <ErrorState retry={() => query.refetch()} /> : !clients.length ? <EmptyState icon={Users} title="Your client list starts with an order" description="When a buyer shares their details, Duka will keep their purchase history together here." action={<Link href="/take-order" data-testid="link-clients-empty-order"><Button><Plus size={15} />Take an order</Button></Link>} /> : <>
      <section className="clients-overview" aria-label="Client summary">
        <MetricCard className="rise-in" dataTestId="card-clients-return-visits" label="Return visits" value={<span data-testid="text-client-count">{clients.length}</span>} note={repeatClients ? `${repeatClients} ${repeatClients === 1 ? 'client has' : 'clients have'} ordered more than once.` : 'Every new buyer begins a relationship here.'} />
        <MetricCard className="rise-in" style={{ animationDelay: '55ms' }} dataTestId="card-clients-known" label="Known clients" value={<span data-testid="text-total-clients">{clients.length}</span>} note={`${money(totalCollected)} collected across ${clients.reduce((sum, client) => sum + client.orderCount, 0)} orders`} />
        <MetricCard className="rise-in" style={{ animationDelay: '110ms' }} dataTestId="card-clients-average" label="Average collected" value={<span data-testid="text-average-client-spend">{money(clients.length ? totalCollected / clients.length : 0)}</span>} note="Across known buyers" />
      </section>
      <section className="mt-5">
        <Card className="overflow-hidden">
          <div className="clients-workspace-heading">
            <div><div className="font-mono-ui text-[10px] uppercase tracking-[.15em] text-[hsl(var(--muted-foreground))]">Clients / repeat buyers</div><h2 className="mt-2 font-display text-xl font-bold tracking-[-.04em]">People worth remembering</h2><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Sorted by the latest purchase. Select a client to see their orders.</p></div>
            <div className="clients-result-count" data-testid="text-clients-result-count"><strong>{filteredClients.length}</strong> of {clients.length}</div>
          </div>
          <div className="clients-controls"><div className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-3 top-2.5 text-[hsl(var(--muted-foreground))]" size={16} /><input aria-label="Search clients" data-testid="input-search-clients" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by client name or phone" className="field-input pl-9" /></div><span className="clients-search-hint">Search is based on buyer details</span></div>
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

  return <Shell><PageHeading eyebrow="A quick way to sell" title="Take an order" description="Turn an agreed conversation into a polished buyer page in three quick steps." />
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
          <div className="grid gap-5 sm:grid-cols-2"><div><label className="field-label" htmlFor="order-amount">Agreed price</label><div className="relative"><span className="absolute left-3 top-2.5 text-sm text-[hsl(var(--muted-foreground))]">$</span><input id="order-amount" data-testid="input-order-amount" required type="number" min="0" step=".01" value={form.amount} onChange={(event) => change('amount', event.target.value)} className="field-input pl-7" /></div></div><div><label className="field-label">Conversation started on</label><select data-testid="select-order-channel" value={form.channel} onChange={(event) => change('channel', event.target.value)} className="field-input"><option value="whatsapp">WhatsApp</option><option value="instagram">Instagram</option><option value="tiktok">TikTok</option><option value="snapchat">Snapchat</option><option value="in_person">In person</option></select></div></div>
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

  return <Shell><PageHeading eyebrow="A quick way to sell" title="Take an order" description="Combine agreed catalog and custom items into one buyer page with swipeable items and one checkout total." /><div className="mb-6 flex items-center gap-2 overflow-x-auto pb-1">{(['Items', 'Payment', 'Preview'] as const).map((label, index) => { const number = index + 1; return <button key={label} type="button" onClick={() => number < step && setStep(number as TakeOrderStep)} className={cn('flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-xs font-bold', step === number ? 'bg-[hsl(var(--primary))] text-white' : step > number ? 'bg-[hsl(var(--accent))]/15 text-[hsl(var(--accent-foreground))]' : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]')}><span className="font-mono-ui text-[10px]">{number}</span>{label}</button>; })}</div><div className="grid gap-6 lg:grid-cols-[1fr_360px]"><Card className="p-6 sm:p-8"><form onSubmit={submit} className="space-y-6">
    {step === 1 && <div className="page-in space-y-6"><div><div className="field-label">Items in this order</div><p className="mt-1 text-xs leading-5 text-[hsl(var(--muted-foreground))]">Add as many catalog or already-negotiated custom items as the buyer needs. Each item keeps its own price.</p></div><div className="grid gap-3 rounded-[14px] border border-[hsl(var(--border))] p-4 sm:grid-cols-[1fr_auto]"><div><label className="field-label">Add from catalog</label><select data-testid="select-order-product" value={catalogChoice} onChange={(event) => setCatalogChoice(event.target.value)} className="field-input"><option value="">Choose an item</option>{(productsQuery.data ?? []).map((product) => <option key={product.id} value={product.id}>{product.name} · {moneyExact(product.price)}</option>)}</select></div><Button type="button" variant="outline" disabled={!catalogChoice} onClick={addCatalogItem}><Plus size={15} />Add item</Button></div><div className="grid gap-3 rounded-[14px] border border-dashed border-[hsl(var(--border))] p-4 sm:grid-cols-[1fr_150px_auto]"><div><label className="field-label">New item from chat</label><input data-testid="input-custom-order-name" value={customDraft.name} onChange={(event) => setCustomDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Item name" className="field-input" /></div><div><label className="field-label">Price</label><div className="relative"><span className="absolute left-3 top-2.5 text-sm text-[hsl(var(--muted-foreground))]">$</span><input data-testid="input-custom-order-price" type="number" min="0" step=".01" value={customDraft.amount} onChange={(event) => setCustomDraft((current) => ({ ...current, amount: event.target.value }))} placeholder="0.00" className="field-input pl-7" /></div></div><Button type="button" variant="outline" disabled={!customDraft.name.trim() || !customDraft.amount} onClick={addCustomItem}><Plus size={15} />Add custom</Button></div><div className="space-y-2">{items.length ? items.map((item, index) => <div key={item.key} className="flex items-center gap-3 rounded-[12px] bg-[hsl(var(--muted))] p-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-white" style={{ color: item.accent }}><Package size={17} /></div><div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{index + 1}. {item.name}</div><div className="mt-1 text-[10px] uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">{item.source === 'custom' ? 'Custom item' : 'Catalog item'}</div></div><div className="relative w-28"><span className="absolute left-2.5 top-2.5 text-xs text-[hsl(var(--muted-foreground))]">$</span><input aria-label={`Price for ${item.name}`} type="number" min="0" step=".01" value={item.amount} onChange={(event) => updateAmount(item.key, event.target.value)} className="field-input pl-6 text-right text-xs" /></div><button type="button" aria-label={`Remove ${item.name}`} onClick={() => setItems((current) => current.filter((candidate) => candidate.key !== item.key))} className="rounded-full p-2 text-[hsl(var(--muted-foreground))] hover:bg-white hover:text-[hsl(var(--destructive))]"><Trash2 size={15} /></button></div>) : <div className="rounded-[12px] border border-dashed border-[hsl(var(--border))] p-5 text-center text-xs text-[hsl(var(--muted-foreground))]">Add at least one item to build this link.</div>}</div>{items.length > 0 && <div className="flex items-center justify-between border-t border-[hsl(var(--border))] pt-4 text-sm"><span className="text-[hsl(var(--muted-foreground))]">Combined total</span><strong className="font-mono-ui">{moneyExact(total)}</strong></div>}</div>}
    {step === 2 && <div className="page-in space-y-6"><div><div className="field-label">Set the checkout terms</div><p className="mt-1 text-xs leading-5 text-[hsl(var(--muted-foreground))]">The buyer will see every item price and pay or reserve the combined total.</p></div><div><div className="field-label">How should they pay?</div><div className="grid gap-2 sm:grid-cols-3">{[['full', 'Pay in full', 'Collect everything now'], ['deposit', 'Pay a deposit', 'Secure the order'], ['reserve', 'Reserve it', 'Confirm details first']].map(([value, title, note]) => <button type="button" key={value} onClick={() => setPaymentMode(value as 'full' | 'deposit' | 'reserve')} data-testid={`button-payment-mode-${value}`} className={cn('rounded-[12px] border p-3 text-left transition-colors', paymentMode === value ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]')}><div className="text-xs font-bold">{title}</div><div className={cn('mt-1 text-[10px]', paymentMode === value ? 'text-white' : 'text-[hsl(var(--muted-foreground))]')}>{note}</div></button>)}</div></div>{paymentMode === 'deposit' && <div><label className="field-label">Deposit amount against {moneyExact(total)}</label><div className="relative max-w-[240px]"><span className="absolute left-3 top-2.5 text-sm text-[hsl(var(--muted-foreground))]">$</span><input data-testid="input-order-deposit" required type="number" min="0" max={total} step=".01" value={depositAmount} onChange={(event) => setDepositAmount(event.target.value)} className="field-input pl-7" /></div></div>}<div><label className="field-label">Conversation started on</label><select data-testid="select-order-channel" value={channel} onChange={(event) => setChannel(event.target.value as OrderInput['channel'])} className="field-input"><option value="whatsapp">WhatsApp</option><option value="instagram">Instagram</option><option value="tiktok">TikTok</option><option value="snapchat">Snapchat</option><option value="in_person">In person</option></select></div></div>}
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

function BuyerOrderSurface({ businessName, description, productName, amount, paymentMode, depositAmount, variants = [], items, children }: BuyerOrderSurfaceProps) {
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
      <BrandLockup markVariant="icon" className="gap-2" />
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
        <div><div className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">Complete your order</div><p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">{paymentMode === 'reserve' ? 'Reserve these items and we’ll confirm the details.' : paymentMode === 'deposit' ? `A ${moneyExact(depositAmount)} deposit secures the order.` : 'Pay in full to confirm your order.'}</p></div>
        <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-[hsl(var(--accent))]/35"><Package size={18} /></div>
      </div>
      <div className="mb-5 flex items-center justify-between rounded-[10px] bg-[hsl(var(--muted))] px-3 py-2.5 text-xs"><span className="text-[hsl(var(--muted-foreground))]">{displayItems.length === 1 ? 'Order total' : `${displayItems.length} items`}</span><strong className="font-mono-ui">{moneyExact(total)}</strong></div>
      {typeof children === 'function' ? children(activeItem) : children}
    </Card>
  </>;
}

function PublicOrderPage() {
  const { token = '' } = useParams<{ token: string }>();
  const query = useGetPublicOrder(token, { query: { enabled: Boolean(token), queryKey: getGetPublicOrderQueryKey(token) } });
  const submit = useSubmitPublicOrder();
  const seller = readSellerProfile();
  const businessName = seller?.businessName || 'The Sunday Edit';
  const [submitted, setSubmitted] = useState(false);
  const [showMockPayment, setShowMockPayment] = useState(false);
  const [mockPayment, setMockPayment] = useState({ cardNumber: '', expiry: '', cvc: '' });
  const [form, setForm] = useState({ name: '', phone: '', details: '', image: '', imagePreview: '', action: 'pay' as 'pay' | 'reserve' });
  const order = query.data;
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
    submit.mutate({ token, data }, { onSuccess: () => setSubmitted(true) });
  };
  if (query.isLoading) return <div className="min-h-[100dvh] bg-[hsl(var(--background))] p-6"><div className="mx-auto max-w-[480px]"><BrandLockup markVariant="icon" className="mx-auto mt-14 justify-center" /><Skeleton className="mx-auto mt-8 h-8 w-52" /><Skeleton className="mt-4 h-4 w-full" /><Skeleton className="mt-10 h-64 w-full" /></div></div>;
  if (query.isError || !order) return <div className="flex min-h-[100dvh] items-center justify-center p-6"><div className="text-center"><BrandLockup markVariant="icon" className="justify-center" /><div className="mt-10 font-display text-2xl font-bold">This link is no longer available.</div><p className="mt-3 text-sm text-[hsl(var(--muted-foreground))]">Ask the seller for a fresh order link.</p></div></div>;
  if (submitted) return <div className="flex min-h-[100dvh] items-center justify-center bg-[hsl(var(--background))] p-6"><div className="w-full max-w-[480px] text-center page-in"><BrandLockup className="justify-center" /><div className="mx-auto mt-10 flex h-16 w-16 items-center justify-center rounded-[20px] bg-[hsl(var(--accent))] text-white"><Check size={30} /></div><h1 className="mt-7 font-display text-4xl font-bold tracking-[-.05em]">You’re all set.</h1><p className="mx-auto mt-4 max-w-[350px] text-sm leading-6 text-[hsl(var(--muted-foreground))]">{form.action === 'pay' && order.paymentMode !== 'reserve' ? 'Your mock payment and order details were sent to the seller. No real payment was processed.' : 'Your details have been sent to the seller. They’ll be in touch with the next step.'}</p><div className="mt-8 font-mono-ui text-[10px] uppercase tracking-[.15em] text-[hsl(var(--muted-foreground))]">Order reference · {token.slice(0, 8)}</div></div></div>;
  return <div className="min-h-[100dvh] bg-[hsl(var(--background))] px-5 py-8 sm:py-14"><div className="mx-auto max-w-[480px]"><BuyerOrderSurface businessName={businessName} description={seller?.description} productName={order.productName} amount={order.amount} paymentMode={order.paymentMode} depositAmount={order.depositAmount} variants={order.variants} items={order.items}><form onSubmit={submitForm} className="space-y-5"><div><label className="field-label">Your name</label><input data-testid="input-buyer-name" required minLength={1} value={form.name} onChange={(event) => change('name', event.target.value)} placeholder="Full name" className="field-input" /></div><div><label className="field-label">Phone number</label><input data-testid="input-buyer-phone" required minLength={5} value={form.phone} onChange={(event) => change('phone', event.target.value)} placeholder="Best number to reach you" className="field-input" /></div>{order.variants?.length > 0 && <div><label className="field-label">Available variants</label><div className="flex flex-wrap gap-2">{order.variants.map((variant) => <span key={variant} className="rounded-full border border-[hsl(var(--border))] px-3 py-1.5 text-xs">{variant}</span>)}</div></div>}<div><label className="field-label">Details for the seller <span className="font-normal text-[hsl(var(--muted-foreground))]">(optional)</span></label><textarea data-testid="input-buyer-details" value={form.details} onChange={(event) => change('details', event.target.value)} placeholder="Size, color, delivery note, or anything already agreed..." rows={3} className="field-input resize-none" /></div><div><label className="field-label">Reference image <span className="font-normal text-[hsl(var(--muted-foreground))]">(optional)</span></label><label className="flex cursor-pointer items-center gap-3 rounded-[10px] border border-dashed border-[hsl(var(--border))] p-3 text-xs text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]"><Clipboard size={15} />{form.image ? form.image : 'Attach an image'}<input data-testid="input-buyer-reference-image" type="file" accept="image/*" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; setForm((current) => ({ ...current, image: file.name, imagePreview: URL.createObjectURL(file) })); }} /></label>{form.imagePreview && <img src={form.imagePreview} alt="Selected reference" className="mt-3 h-28 w-full rounded-[10px] object-cover" />}</div>{showMockPayment && <div className="rounded-[13px] border border-[hsl(var(--accent))]/55 bg-[hsl(var(--accent))]/10 p-4 page-in"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2 text-sm font-bold"><WalletCards size={16} />Mock payment checkout</div><StatusPill tone="gold">Demo</StatusPill></div><p className="mt-2 text-[11px] leading-5 text-[hsl(var(--muted-foreground))]">No real charge will be made. Use any test details to continue.</p><div className="mt-4 space-y-3"><div><label className="field-label">Card number</label><input data-testid="input-mock-card-number" required inputMode="numeric" value={mockPayment.cardNumber} onChange={(event) => setMockPayment((current) => ({ ...current, cardNumber: event.target.value }))} placeholder="4242 4242 4242 4242" className="field-input" /></div><div className="grid grid-cols-2 gap-3"><div><label className="field-label">Expiry</label><input data-testid="input-mock-expiry" required value={mockPayment.expiry} onChange={(event) => setMockPayment((current) => ({ ...current, expiry: event.target.value }))} placeholder="12/30" className="field-input" /></div><div><label className="field-label">CVC</label><input data-testid="input-mock-cvc" required inputMode="numeric" value={mockPayment.cvc} onChange={(event) => setMockPayment((current) => ({ ...current, ...current, cvc: event.target.value }))} placeholder="123" className="field-input" /></div></div></div></div>}{order.paymentMode !== 'reserve' && <div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => { change('action', 'pay'); setShowMockPayment(false); }} data-testid="button-buyer-pay" className={cn('rounded-[10px] border p-3 text-left text-xs font-bold', form.action === 'pay' ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-white' : 'border-[hsl(var(--border))]')}>{order.paymentMode === 'deposit' ? `Pay deposit · ${moneyExact(order.depositAmount)}` : `Pay ${moneyExact(order.amount)}`}</button><button type="button" onClick={() => { change('action', 'reserve'); setShowMockPayment(false); }} data-testid="button-buyer-reserve" className={cn('rounded-[10px] border p-3 text-left text-xs font-bold', form.action === 'reserve' ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-white' : 'border-[hsl(var(--border))]')}>Reserve for later</button></div>}<Button type="submit" disabled={submit.isPending} className="w-full py-3.5" data-testid="button-submit-public-order">{submit.isPending && <Loader2 size={15} className="animate-spin" />}{order.paymentMode === 'reserve' || form.action === 'reserve' ? 'Reserve these items' : showMockPayment ? 'Complete mock payment' : 'Continue to mock payment'} <ArrowUpRight size={15} /></Button></form></BuyerOrderSurface><div className="mt-6 text-center font-mono-ui text-[9px] uppercase tracking-[.15em] text-[hsl(var(--muted-foreground))]">Powered by Take Order · made for small businesses</div></div></div>;
}

function Connect() {
  const health = useHealthCheck();
  const tools = [
    { name: 'WhatsApp', detail: 'Share buyer links in a chat', color: '#25D366', mark: 'W', group: 'Social' },
    { name: 'Instagram', detail: 'Keep sales from DMs easy to trace', color: '#D45A8D', mark: 'I', group: 'Social' },
    { name: 'TikTok', detail: 'Tag short-form sales as they happen', color: '#252525', mark: 'T', group: 'Social' },
    { name: 'Facebook Ads', detail: 'Add campaign context to your numbers', color: '#4774D8', mark: 'F', group: 'Social' },
    { name: 'Snapchat', detail: 'Keep your manual channel notes close', color: '#F4D20A', mark: 'S', group: 'Social' },
    { name: 'Paystack', detail: 'Save the payment tool you use', color: '#123B5D', mark: 'P', group: 'Payments' },
    { name: 'Mobile Money', detail: 'Remember your preferred payout rail', color: '#F39A10', mark: 'M', group: 'Payments' },
    { name: 'X', detail: 'Keep sales from X in your view', color: '#171717', mark: 'X', group: 'Social' },
  ];
  const [connected, setConnected] = useState<string[]>(() => {
    try { return JSON.parse(window.localStorage.getItem('duka-connected-tools') || '[]') as string[]; } catch { return []; }
  });
  const toggle = (name: string) => setConnected((current) => {
    const next = current.includes(name) ? current.filter((item) => item !== name) : [...current, name];
    window.localStorage.setItem('duka-connected-tools', JSON.stringify(next));
    return next;
  });
  return <Shell><div className="mx-auto max-w-[1060px]"><div className="mx-auto max-w-[640px] text-center"><div className="font-mono-ui text-[10px] font-bold uppercase tracking-[.18em] text-[hsl(var(--muted-foreground))]">Optional setup</div><h1 className="mt-3 font-display text-[clamp(36px,5vw,58px)] font-bold leading-[.95] tracking-[-.065em]">Let’s get your tools in one view.</h1><p className="mx-auto mt-4 max-w-[560px] text-sm leading-6 text-[hsl(var(--muted-foreground))]">Choose the places you already sell or get paid. This saves a local preference for now — it does not authorize an integration.</p><div className="mt-4 inline-flex items-center gap-2 rounded-full border border-[hsl(var(--accent))]/35 bg-[hsl(var(--accent))]/10 px-3 py-2 text-[11px] font-semibold text-[hsl(var(--accent-foreground))]"><ShieldIcon />Duka never reads personal chats.</div></div><div className="mt-10 flex items-center justify-between border-b border-[hsl(var(--border))] pb-3"><div className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">Your channels and tools</div><span className="flex items-center gap-1.5 text-[10px] font-semibold text-[hsl(var(--muted-foreground))]"><span className={cn('h-2 w-2 rounded-full', health.isError ? 'bg-[hsl(var(--destructive))]' : 'bg-[hsl(var(--accent))]')} />{health.isError ? 'Workspace check unavailable' : 'Workspace ready'}</span></div><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{tools.map((tool, index) => { const isConnected = connected.includes(tool.name); return <button key={tool.name} onClick={() => toggle(tool.name)} aria-pressed={isConnected} data-testid={`button-connect-${tool.name.toLowerCase().replaceAll(' ', '-')}`} className={cn('tool-tile soft-focus group rounded-[17px] border p-4 text-left', isConnected ? 'border-[hsl(var(--accent))]/55 bg-[hsl(var(--accent))]/10' : 'border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:border-[hsl(var(--muted-foreground))]/45')}><div className="flex items-start justify-between"><div className="tool-mark flex h-11 w-11 items-center justify-center rounded-[13px] text-base font-bold" style={{ backgroundColor: tool.color, color: tool.name === 'Snapchat' ? '#1d2a29' : '#fff' }}>{tool.mark}</div><span className={cn('rounded-full px-2 py-1 text-[9px] font-bold', isConnected ? 'bg-[hsl(var(--accent))]/20 text-[hsl(var(--accent-foreground))]' : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]')}>{isConnected ? 'Connected' : 'Not connected'}</span></div><div className="mt-5 flex items-end justify-between gap-2"><div><div className="text-sm font-bold">{tool.name}</div><div className="mt-1 text-[11px] leading-4 text-[hsl(var(--muted-foreground))]">{tool.detail}</div></div><span className="font-mono-ui text-[9px] uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">{tool.group}</span></div></button>; })}</div><div className="mt-8 grid gap-4 lg:grid-cols-[1.15fr_.85fr]"><Card className="flex gap-4 p-5"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"><Link2 size={17} /></div><div><h2 className="text-sm font-bold">A connection is never required to sell.</h2><p className="mt-2 text-xs leading-5 text-[hsl(var(--muted-foreground))]">Create Take Order links, collect details, and track inventory without connecting a social or payment account. These tiles are simply your setup checklist until real integrations are attached.</p></div></Card><Card className="p-5"><div className="flex items-center gap-2 text-xs font-bold"><Check size={15} className="text-[hsl(var(--accent-foreground))]" />{connected.length ? `${connected.length} tool preference${connected.length === 1 ? '' : 's'} saved` : 'No tool preferences yet'}</div><p className="mt-2 text-[11px] leading-5 text-[hsl(var(--muted-foreground))]">You can change these choices any time. They stay on this device.</p></Card></div></div></Shell>;
}
function ShieldIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3 5 6v5c0 4.5 3 8.2 7 10 4-1.8 7-5.5 7-10V6l-7-3Z" /><path d="m9 12 2 2 4-4" /></svg>; }

function Router() { const [location] = useLocation(); return <ErrorBoundary resetKey={location}><Switch><Route path="/onboarding" component={Onboarding} /><Route path="/" component={HomeRoute} /><Route path="/catalog" component={Catalog} /><Route path="/orders" component={Orders} /><Route path="/reports" component={Reports} /><Route path="/clients" component={Clients} /><Route path="/expenses" component={Expenses} /><Route path="/take-order" component={MultiItemTakeOrder} /><Route path="/connect" component={Connect} /><Route path="/o/:token" component={PublicOrderPage} /><Route component={NotFound} /></Switch></ErrorBoundary>; }
function App() { return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>; }
export default App;

const fulfillmentTone = (fulfillment: Order['fulfillment']): 'neutral' | 'mint' | 'blue' =>
  fulfillment === 'delivered' ? 'mint' : fulfillment === 'shipped' ? 'blue' : 'neutral';
