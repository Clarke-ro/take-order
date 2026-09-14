import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Link, Route, Switch, useLocation, useParams, Router as WouterRouter } from 'wouter';
import {
  AlertTriangle, ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight, BarChart3, Boxes, Check,
  CheckCircle2, CircleDollarSign, Clipboard, Copy, ExternalLink, Eye, LayoutDashboard, Link2, Loader2, Menu, MoreHorizontal,
  Package, PackageSearch, Pencil, Plus, Receipt, RefreshCw, Search, Settings2, ShoppingBag, Sparkles, Store,
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
const initials = (name: string) => name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();

function cn(...classes: Array<string | false | undefined>) { return classes.filter(Boolean).join(' '); }

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
    <div className="flex items-center gap-3 px-7 py-7">
      <div className="flex h-9 w-9 items-center justify-center rounded-[12px] bg-[hsl(var(--sidebar-primary))] text-[hsl(var(--sidebar-primary-foreground))] shadow-[0_5px_0_hsl(42_81%_50%/.2)]"><Store size={19} strokeWidth={2.4} /></div>
      <div><div className="font-display text-[21px] font-bold tracking-[-.04em]">duka</div><div className="font-mono-ui text-[9px] uppercase tracking-[.18em] text-white/45">seller workspace</div></div>
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
  return <div className="mobile-topbar sticky top-0 z-40 items-center justify-between border-b border-[hsl(var(--border))] bg-[hsl(var(--background))]/95 px-5 py-4 backdrop-blur-md"><Link href="/" className="flex items-center gap-2 font-display text-[20px] font-bold tracking-[-.04em]"><span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"><Store size={17} /></span>duka</Link><button data-testid="button-mobile-menu" onClick={() => setOpen(!open)} className="rounded-lg p-2 hover:bg-black/5">{open ? <X size={20} /> : <Menu size={20} />}</button>{open && <div className="absolute left-0 right-0 top-full border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3 shadow-lg">{nav.map((item) => <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-3 text-sm hover:bg-[hsl(var(--muted))]">{item.label}</Link>)}</div>}</div>;
}

function Shell({ children }: { children: ReactNode }) {
  return <div className="duka-shell grain"><Sidebar /><MobileTopbar /><main className="page-content min-h-[100dvh] px-5 py-7 md:ml-[246px] md:px-10 md:py-9 lg:px-14">{children}</main></div>;
}

function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><div className="font-mono-ui text-[10px] font-bold uppercase tracking-[.18em] text-[hsl(var(--muted-foreground))]">{eyebrow}</div><h1 className="mt-2 font-display text-[clamp(30px,4vw,48px)] font-bold leading-[.98] tracking-[-.055em] text-[hsl(var(--foreground))]">{title}</h1>{description && <p className="mt-3 max-w-[540px] text-sm leading-6 text-[hsl(var(--muted-foreground))]">{description}</p>}</div>{action}</div>;
}

function Button({ children, variant = 'primary', className, ...props }: { children: ReactNode; variant?: 'primary' | 'soft' | 'outline' | 'danger' | 'ghost'; className?: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} className={cn('inline-flex items-center justify-center gap-2 rounded-[10px] px-4 py-2.5 text-[12px] font-semibold transition-all active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50', variant === 'primary' && 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] shadow-[0_3px_0_hsl(220_30%_11%/.18)] hover:brightness-110', variant === 'soft' && 'bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))] hover:bg-[hsl(var(--muted))]', variant === 'outline' && 'border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--foreground))] hover:border-[hsl(var(--muted-foreground))]', variant === 'danger' && 'bg-[hsl(var(--destructive))] text-white hover:brightness-110', variant === 'ghost' && 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]', className)} {...props}>{children}</button>;
}

function Card({ children, className = '', ...props }: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>) { return <div {...props} className={cn('rounded-[16px] border border-[hsl(var(--card-border))] bg-[hsl(var(--card))] shadow-[0_2px_8px_hsl(220_20%_20%/.035)]', className)}>{children}</div>; }
function Skeleton({ className = '' }: { className?: string }) { return <div className={cn('animate-pulse rounded-lg bg-[hsl(var(--muted))]', className)} />; }
function EmptyState({ icon: Icon, title, description, action }: { icon: typeof Package; title: string; description: string; action?: ReactNode }) { return <div className="flex flex-col items-center justify-center rounded-[16px] border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--card))] px-6 py-16 text-center"><div className="mb-4 flex h-12 w-12 items-center justify-center rounded-[14px] bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"><Icon size={22} /></div><h3 className="font-display text-lg font-bold">{title}</h3><p className="mt-2 max-w-[340px] text-sm leading-6 text-[hsl(var(--muted-foreground))]">{description}</p>{action && <div className="mt-5">{action}</div>}</div>; }
function ErrorState({ retry }: { retry: () => void }) { return <div className="rounded-[16px] border border-[hsl(var(--destructive))]/20 bg-[hsl(var(--destructive))]/5 p-8 text-center"><p className="font-semibold">Something could not load.</p><p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">Give it another try or check your connection.</p><Button className="mt-5" variant="outline" onClick={retry}><RefreshCw size={15} />Try again</Button></div>; }
function StatusPill({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'gold' | 'mint' | 'rose' | 'blue' }) { return <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold capitalize', tone === 'gold' && 'bg-[hsl(42_81%_67%/.23)] text-[hsl(31_64%_34%)]', tone === 'mint' && 'bg-[hsl(157_42%_45%/.14)] text-[hsl(165_34%_28%)]', tone === 'rose' && 'bg-[hsl(345_39%_58%/.14)] text-[hsl(345_39%_40%)]', tone === 'blue' && 'bg-[hsl(220_45%_47%/.13)] text-[hsl(220_45%_37%)]', tone === 'neutral' && 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]')}>{children}</span>; }

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
      <Link href="/" className="flex items-center gap-2 font-display text-xl font-bold tracking-[-.04em]" data-testid="link-onboarding-logo"><span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"><Store size={16} /></span>duka</Link>
      {step < 3 && <button onClick={skip} data-testid="button-skip-onboarding" className="soft-focus rounded-full px-3 py-2 text-xs font-semibold text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--card))] hover:text-[hsl(var(--foreground))]">Skip setup</button>}
    </header>
    <main className="onboarding-grid mx-auto mt-10 grid max-w-[980px] gap-8 rounded-[26px] border border-[hsl(var(--border))] bg-[hsl(var(--card))]/75 p-5 shadow-[0_18px_60px_hsl(224_27%_17%/.08)] backdrop-blur-sm sm:mt-14 sm:p-10 lg:grid-cols-[.86fr_1.14fr] lg:p-14">
      <div className="flex flex-col justify-between">
        <div><div className="font-mono-ui text-[10px] font-bold uppercase tracking-[.18em] text-[hsl(var(--muted-foreground))]">A small start</div><h1 className="mt-4 max-w-[390px] font-display text-[clamp(38px,6vw,67px)] font-bold leading-[.92] tracking-[-.07em]">{step === 3 ? 'Your shop has a home.' : 'Let’s make the busy bits lighter.'}</h1><p className="mt-5 max-w-[380px] text-sm leading-6 text-[hsl(var(--muted-foreground))]">{step === 3 ? 'Your workspace is ready. Start with one product, then add the tools that help you understand where sales come from.' : 'Tell Duka a little about how you sell. We’ll turn it into a short setup, not another admin project.'}</p></div>
        <div className="mt-10 hidden rounded-[16px] border border-[hsl(var(--border))] bg-[hsl(var(--background))]/70 p-4 lg:block"><div className="flex items-center gap-2 text-xs font-semibold"><span className="h-2 w-2 rounded-full bg-[hsl(var(--accent))]" />Private by default</div><p className="mt-2 text-[11px] leading-5 text-[hsl(var(--muted-foreground))]">Duka never reads personal chats. You decide what becomes an order.</p></div>
      </div>
      <div className="rounded-[20px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 sm:p-7">
        {step < 3 && <div className="mb-8 flex items-center gap-2" aria-label="Setup progress">{[0, 1, 2].map((item) => <span key={item} className={cn('h-1.5 flex-1 rounded-full', item <= step ? 'bg-[hsl(var(--primary))]' : 'bg-[hsl(var(--muted))]')} />)}</div>}
        {step === 0 && <div className="page-in"><div className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">First, in your own words</div><h2 className="mt-3 font-display text-2xl font-bold tracking-[-.04em]">What do you sell, and where do buyers find you?</h2><p className="mt-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">Write it like you would tell a friend. We’ll use this to shape your checklist.</p><textarea autoFocus data-testid="input-onboarding-description" value={profile.description} onChange={(event) => update('description', event.target.value)} placeholder="I sell handmade jewellery, mostly through Instagram and WhatsApp." rows={6} className="field-input mt-6 resize-none leading-6" /><div className="mt-3 flex items-start gap-2 text-[11px] leading-5 text-[hsl(var(--muted-foreground))]"><CheckCircle2 size={14} className="mt-0.5 shrink-0 text-[hsl(var(--accent-foreground))]" />No account connections are needed for setup.</div></div>}
        {step === 1 && <div className="page-in"><div className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">Make it yours</div><h2 className="mt-3 font-display text-2xl font-bold tracking-[-.04em]">What should we call your workspace?</h2><p className="mt-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">This stays on this device for now and helps Duka speak like it belongs to you.</p><div className="mt-7 space-y-5"><div><label className="field-label" htmlFor="onboarding-seller-name">Your name</label><input autoFocus id="onboarding-seller-name" data-testid="input-onboarding-seller-name" value={profile.sellerName} onChange={(event) => update('sellerName', event.target.value)} placeholder="e.g. Amina Mensah" className="field-input" /></div><div><label className="field-label" htmlFor="onboarding-business-name">Business or shop name</label><input id="onboarding-business-name" data-testid="input-onboarding-business-name" value={profile.businessName} onChange={(event) => update('businessName', event.target.value)} placeholder="e.g. The Sunday Edit" className="field-input" /></div></div></div>}
        {step === 2 && <div className="page-in"><div className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">One useful detail</div><h2 className="mt-3 font-display text-2xl font-bold tracking-[-.04em]">Where do you usually sell?</h2><p className="mt-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">Pick any that fit. These are just workspace preferences; Duka does not connect or read them.</p><div className="mt-7 grid grid-cols-2 gap-2">{onboardingChannels.map((channel) => <label key={channel} className={cn('flex cursor-pointer items-center gap-3 rounded-[12px] border p-3 text-xs font-semibold transition-colors', profile.channels.includes(channel) ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]')}><input type="checkbox" data-testid={`input-onboarding-channel-${channel.toLowerCase().replaceAll(' ', '-')}`} checked={profile.channels.includes(channel)} onChange={() => toggleChannel(channel)} className="sr-only" /><span className={cn('flex h-5 w-5 items-center justify-center rounded-full border text-[10px]', profile.channels.includes(channel) ? 'border-[hsl(var(--sidebar-primary))] bg-[hsl(var(--sidebar-primary))] text-[hsl(var(--primary-foreground))]' : 'border-[hsl(var(--border))]')}>{profile.channels.includes(channel) && <Check size={12} />}</span>{channel}</label>)}</div></div>}
        {step === 3 && <div className="page-in"><div className="flex h-12 w-12 items-center justify-center rounded-[15px] bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]"><Check size={23} /></div><div className="mt-7 font-mono-ui text-[10px] uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">Setup complete</div><h2 className="mt-3 font-display text-3xl font-bold tracking-[-.05em]">A good first week starts with one item.</h2><p className="mt-3 text-sm leading-6 text-[hsl(var(--muted-foreground))]">Your preferences are saved locally. Choose the next useful step and Duka will keep the rest tidy.</p><div className="mt-7 space-y-2"><Link href="/catalog" data-testid="link-onboarding-add-item" className="flex items-center gap-3 rounded-[13px] border border-[hsl(var(--border))] p-4 transition-colors hover:bg-[hsl(var(--muted))]"><span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[hsl(42_81%_67%/.3)] font-mono-ui text-xs font-bold">01</span><span className="flex-1"><span className="block text-sm font-bold">Add your first catalog item</span><span className="mt-1 block text-xs text-[hsl(var(--muted-foreground))]">Name, price, cost, and stock — that’s the foundation.</span></span><ArrowRight size={16} /></Link><Link href="/connect" data-testid="link-onboarding-connect-tools" className="flex items-center gap-3 rounded-[13px] border border-[hsl(var(--border))] p-4 transition-colors hover:bg-[hsl(var(--muted))]"><span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[hsl(157_42%_45%/.16)] font-mono-ui text-xs font-bold">02</span><span className="flex-1"><span className="block text-sm font-bold">Review optional tools</span><span className="mt-1 block text-xs text-[hsl(var(--muted-foreground))]">Save the channels and payment tools you use.</span></span><ArrowRight size={16} /></Link></div><Button onClick={() => setLocation('/')} className="mt-7 w-full" data-testid="button-open-workspace">Open my workspace <ArrowRight size={15} /></Button></div>}
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
  const period = 'Last 7 days';
  const summary = summaryQuery.data;
  const channels = summary?.channelPerformance ?? [];
  const daily = summary?.dailyPerformance ?? [];
  const productPerformance = summary?.productPerformance ?? [];
  const products = productsQuery.data ?? [];
  const lowStock = products.filter((product) => product.stock <= 3);
  const missingCosts = products.filter((product) => product.cost == null);
  const firstDay = daily[0]?.label;
  const lastDay = daily[daily.length - 1]?.label;
  const dateContext = firstDay && lastDay ? `${firstDay} – ${lastDay}` : 'Your latest reporting window';
  const analyticsState = getAnalyticsViewState({
    isLoading: summaryQuery.isLoading,
    isError: summaryQuery.isError,
    summary,
  });
  const statCards = [
    { label: 'Revenue', value: money(summary?.revenue), note: 'completed order value', icon: TrendingUp, tone: 'gold' },
    { label: 'Product costs', value: money(summary?.productCosts), note: 'cost of items sold', icon: Package, tone: 'rose' },
    { label: 'Operating expenses', value: money(summary?.operatingExpenses), note: 'running the shop', icon: Receipt, tone: 'blue' },
    { label: 'Combined expenses', value: money(summary?.expenses), note: 'product + operating costs', icon: ArrowDownRight, tone: 'rose' },
    { label: 'Profit', value: money(summary?.profit), note: 'revenue less expenses', icon: BarChart3, tone: 'mint' },
    { label: 'Cash balance', value: money(summary?.cashBalance), note: 'available balance', icon: WalletCards, tone: 'blue' },
  ] as const;
  return <Shell><div data-testid="dashboard-analytics" data-analytics-state={analyticsState}><AnalyticsStateMarker state={analyticsState} /><PageHeading eyebrow={`Business pulse · ${dateContext}`} title="Know where your shop stands." description="A focused read on cash, stock, and the channels bringing buyers through." action={<div className="flex flex-wrap items-center gap-2"><div className="period-chip" aria-label="Reporting period"><span className="h-2 w-2 rounded-full bg-[hsl(var(--accent-foreground))]" />{period}</div><Link href="/take-order" data-testid="link-take-order-hero"><Button><Plus size={16} />Take an order</Button></Link></div>} />
    {summaryQuery.isLoading ? <OverviewSkeleton /> : summaryQuery.isError ? <ErrorState retry={() => summaryQuery.refetch()} /> : <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((stat, index) => <Card key={stat.label} className="rise-in kpi-card p-5" style={{ animationDelay: `${index * 55}ms` }} data-testid={`card-kpi-${stat.label.toLowerCase().replaceAll(' ', '-')}`}><div className="flex items-start justify-between"><div><div className="text-[11px] font-semibold uppercase tracking-[.06em] text-[hsl(var(--muted-foreground))]">{stat.label}</div><div className="mt-4 font-display text-[clamp(25px,3vw,32px)] font-bold tracking-[-.055em]">{stat.value}</div></div><div className={cn('flex h-9 w-9 items-center justify-center rounded-[11px]', stat.tone === 'gold' && 'bg-[hsl(42_81%_67%/.26)] text-[hsl(31_64%_34%)]', stat.tone === 'rose' && 'bg-[hsl(345_39%_58%/.14)] text-[hsl(345_39%_40%)]', stat.tone === 'mint' && 'bg-[hsl(157_42%_45%/.14)] text-[hsl(165_34%_28%)]', stat.tone === 'blue' && 'bg-[hsl(220_45%_47%/.13)] text-[hsl(220_45%_37%)]')}><stat.icon size={16} /></div></div><div className="mt-2 text-[11px] text-[hsl(var(--muted-foreground))]">{stat.note}</div></Card>)}
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(300px,.8fr)]">
        <Card className="p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="font-mono-ui text-[10px] uppercase tracking-[.15em] text-[hsl(var(--muted-foreground))]">Cash flow</div><h2 className="mt-2 font-display text-xl font-bold tracking-[-.035em]">Revenue, costs, and net profit</h2><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Product costs and operating expenses stay separate</p></div><div className="rounded-[10px] border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 font-mono-ui text-[10px] text-[hsl(var(--muted-foreground))]">{period}</div></div><div className="mt-6 h-[280px]" data-testid="chart-cash-flow">{daily.length ? <ResponsiveContainer width="100%" height="100%" debounce={0}><LineChart data={daily} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}><CartesianGrid strokeDasharray="3 4" stroke="hsl(220 16% 86% / .7)" vertical={false} /><XAxis dataKey="label" tick={{ fontSize: 12, fill: '#68717d' }} stroke="#aeb5bd" tickLine={false} axisLine={false} /><YAxis tick={{ fontSize: 12, fill: '#68717d' }} stroke="#aeb5bd" tickLine={false} axisLine={false} tickFormatter={(value) => money(value)} width={58} /><RechartsTooltip content={<AnalyticsTooltip />} cursor={{ stroke: '#9ca6b2', strokeDasharray: '3 3' }} isAnimationActive={false} /><RechartsLegend wrapperStyle={{ fontSize: '12px', paddingTop: '12px' }} /><Line type="monotone" dataKey="revenue" name="Revenue" stroke="#c9943d" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} isAnimationActive={false} /><Line type="monotone" dataKey="productCosts" name="Product costs" stroke="#b66b77" strokeWidth={2} dot={false} activeDot={{ r: 5 }} isAnimationActive={false} /><Line type="monotone" dataKey="operatingExpenses" name="Operating expenses" stroke="#7b83b7" strokeWidth={2} dot={false} activeDot={{ r: 5 }} isAnimationActive={false} /><Line type="monotone" dataKey="expenses" name="Combined expenses" stroke="#c47763" strokeWidth={2} dot={false} activeDot={{ r: 5 }} isAnimationActive={false} /><Line type="monotone" dataKey="profit" name="Net profit" stroke="#438879" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} isAnimationActive={false} /></LineChart></ResponsiveContainer> : <ChartEmpty message="Cash-flow data will appear after your first activity." />}</div></Card>
        <AlertsRail outstanding={summary?.outstanding ?? 0} lowStock={lowStock} missingCosts={missingCosts} productLoading={productsQuery.isLoading} />
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,.85fr)]">
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
        <Card className="reports-primary-metric reports-profit-card rise-in p-5 sm:p-6" data-testid="card-report-tracked-profit">
          <div className="flex items-start justify-between gap-4"><div><div className="font-mono-ui text-[10px] uppercase tracking-[.15em] text-white/55">Tracked profit</div><div className="mt-4 font-display text-[clamp(32px,5vw,50px)] font-bold leading-none tracking-[-.07em] text-white" data-testid="text-report-profit">{money(summary?.profit)}</div></div><div className="reports-metric-mark reports-metric-mark-light"><TrendingUp size={18} /></div></div>
          <p className="mt-5 max-w-[270px] text-xs leading-5 text-white/55">Revenue less recorded operating expenses. Product costs are reflected only where costs are tracked.</p>
        </Card>
        <Card className="reports-primary-metric rise-in p-5 sm:p-6" style={{ animationDelay: '55ms' }} data-testid="card-report-cash-balance">
          <div className="flex items-start justify-between gap-4"><div><div className="font-mono-ui text-[10px] uppercase tracking-[.15em] text-[hsl(var(--muted-foreground))]">Cash balance</div><div className="mt-4 font-display text-[clamp(32px,5vw,50px)] font-bold leading-none tracking-[-.07em]" data-testid="text-report-cash-balance">{money(summary?.cashBalance)}</div></div><div className="reports-metric-mark reports-metric-mark-blue"><WalletCards size={18} /></div></div>
          <p className="mt-5 max-w-[270px] text-xs leading-5 text-[hsl(var(--muted-foreground))]">Available balance in the current workspace snapshot, including amounts already collected.</p>
        </Card>
        <Card className="reports-context-card rise-in p-5 sm:p-6" style={{ animationDelay: '110ms' }} data-testid="card-report-context">
          <div className="font-mono-ui text-[10px] uppercase tracking-[.15em] text-[hsl(var(--muted-foreground))]">Snapshot context</div>
          <div className="mt-4 grid grid-cols-2 gap-4"><div><div className="font-display text-2xl font-bold tracking-[-.05em]">{money(summary?.revenue)}</div><div className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">recorded revenue</div></div><div><div className="font-display text-2xl font-bold tracking-[-.05em]">{summary?.orders ?? 0}</div><div className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">recorded orders</div></div></div>
          <div className="mt-5 border-t border-[hsl(var(--border))] pt-4 text-[11px] leading-5 text-[hsl(var(--muted-foreground))]"><strong className="text-[hsl(var(--foreground))]">{summary?.bestSeller || 'No leading item yet'}</strong>{summary?.bestSeller ? ' is the current best seller by recorded performance.' : ' Add an order to start building this view.'}</div>
        </Card>
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
            return <tr key={`${item.name}-${index}`} data-testid={`row-report-item-${index}`}><td><div className="font-semibold">{item.name}</div></td><td><span className="reports-category-tag">{item.category || 'Uncategorised'}</span></td><td className="text-right font-mono-ui text-xs">{item.orders}</td><td className="text-right font-mono-ui text-xs font-bold">{money(item.revenue)}</td><td>{item.costTracked ? <span className="reports-cost-status reports-cost-tracked">{item.margin.toFixed(1)}% margin</span> : <span className="reports-cost-status reports-cost-missing">Cost not tracked</span>}</td><td className="text-right font-mono-ui text-xs">{item.stock}</td><td className="text-[11px] text-[hsl(var(--muted-foreground))]">{share ? `${share.toFixed(1)}% of recorded revenue` : 'No revenue recorded'}</td></tr>;
          })}</tbody></table></div> : <div className="p-6"><EmptyState icon={PackageSearch} title="No selling pattern yet" description="Once product performance is recorded, your highest-revenue items will appear here." /></div>}
        </Card>
      </section>
      <div className="flex items-start gap-3 rounded-[12px] border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/55 px-4 py-3 text-[11px] leading-5 text-[hsl(var(--muted-foreground))]" data-testid="text-report-data-note"><CircleDollarSign size={15} className="mt-0.5 shrink-0 text-[hsl(var(--accent-foreground))]" /><span><strong className="text-[hsl(var(--foreground))]">A note on this report:</strong> Duka currently records orders, revenue, stock, and optional product costs. It does not store item quantity or historical comparison data, so this page intentionally uses “orders” and “detail” rather than invented sales trends.</span></div>
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
  return <Card className="overflow-hidden"><div className="border-b border-[hsl(var(--border))] px-5 py-5 sm:px-6"><div className="flex items-center gap-2"><AlertTriangle size={16} className="text-[hsl(var(--chart-3))]" /><div className="font-mono-ui text-[10px] uppercase tracking-[.15em] text-[hsl(var(--muted-foreground))]">Action rail</div></div><h2 className="mt-2 font-display text-xl font-bold tracking-[-.035em]">Worth a look</h2></div><div className="divide-y divide-[hsl(var(--border))]">{alerts.map((alert) => <Link href={alert.href} key={alert.title} className="alert-row group flex gap-3 px-5 py-4 sm:px-6" data-testid={`link-alert-${alert.tone}`}><div className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px]', alert.tone === 'rose' && 'bg-[hsl(345_39%_58%/.14)] text-[hsl(345_39%_40%)]', alert.tone === 'gold' && 'bg-[hsl(42_81%_67%/.25)] text-[hsl(31_64%_34%)]', alert.tone === 'blue' && 'bg-[hsl(220_45%_47%/.13)] text-[hsl(220_45%_37%)]')}><alert.icon size={15} /></div><div className="min-w-0 flex-1"><div className="text-sm font-semibold">{alert.title}</div><p className="mt-1 text-[11px] leading-5 text-[hsl(var(--muted-foreground))]">{alert.detail}</p><div className="mt-2 text-[10px] font-bold text-[hsl(var(--primary))] group-hover:underline">{alert.action}<ArrowUpRight size={12} className="ml-1 inline" /></div></div></Link>)}</div></Card>;
}

function ProductPerformance({ products }: { products: Array<{ name: string; category: string; revenue: number; orders: number; stock: number; margin: number; costTracked: boolean }> }) {
  const ranked = [...products].sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  return <Card className="overflow-hidden"><div className="flex items-start justify-between border-b border-[hsl(var(--border))] px-5 py-5 sm:px-6"><div><div className="font-mono-ui text-[10px] uppercase tracking-[.15em] text-[hsl(var(--muted-foreground))]">Product performance</div><h2 className="mt-2 font-display text-xl font-bold tracking-[-.035em]">What is carrying the week</h2></div><Package size={18} className="text-[hsl(var(--muted-foreground))]" /></div>{ranked.length ? <div className="divide-y divide-[hsl(var(--border))]">{ranked.map((product, index) => <div key={product.name} className="px-5 py-4 sm:px-6" data-testid={`row-product-performance-${index}`}><div className="flex items-center justify-between gap-4"><div className="min-w-0"><div className="truncate text-sm font-semibold">{product.name}</div><div className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">{product.category} · {product.orders} {product.orders === 1 ? 'order' : 'orders'}</div></div><div className="text-right"><div className="font-mono-ui text-xs font-bold">{money(product.revenue)}</div><div className={cn('mt-1 text-[10px] font-semibold', product.costTracked ? 'text-[hsl(var(--accent-foreground))]' : 'text-[hsl(var(--chart-3))]')}>{product.costTracked ? `${product.margin.toFixed(1)}% margin` : 'Cost price missing'}</div></div></div><div className="mt-3 flex items-center gap-3"><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[hsl(var(--muted))]"><div className="h-full rounded-full bg-[hsl(var(--chart-1))]" style={{ width: `${Math.min(100, Math.max(0, product.margin))}%` }} /></div><span className="font-mono-ui text-[10px] text-[hsl(var(--muted-foreground))]">{product.stock} in stock</span></div></div>)}</div> : <div className="p-8"><ChartEmpty message="Product performance will appear after your first sale." /></div>}</Card>;
}

function ChannelPerformance({ channels }: { channels: Array<{ channel: string; revenue: number; orders: number; paidOrders: number; opens: number; conversionRate: number }> }) {
  const maxOpens = Math.max(...channels.map((channel) => channel.opens), 1);
  return <Card className="overflow-hidden"><div className="flex items-start justify-between border-b border-[hsl(var(--border))] px-5 py-5 sm:px-6"><div><div className="font-mono-ui text-[10px] uppercase tracking-[.15em] text-[hsl(var(--muted-foreground))]">Channel conversion</div><h2 className="mt-2 font-display text-xl font-bold tracking-[-.035em]">Turn attention into orders</h2></div><Eye size={18} className="text-[hsl(var(--muted-foreground))]" /></div>{channels.length ? <div className="divide-y divide-[hsl(var(--border))]">{channels.map((channel, index) => <div key={channel.channel} className="px-5 py-4 sm:px-6" data-testid={`row-channel-${channel.channel}`}><div className="flex items-center justify-between"><span className="text-sm font-semibold">{channelName(channel.channel)}</span><span className="font-mono-ui text-xs font-bold">{channel.conversionRate.toFixed(1)}%</span></div><div className="mt-3 flex items-center gap-3"><div className="relative h-2 flex-1 overflow-hidden rounded-full bg-[hsl(var(--muted))]"><div className="h-full rounded-full" style={{ width: `${Math.max(5, (channel.opens / maxOpens) * 100)}%`, backgroundColor: index % 2 ? 'hsl(var(--chart-2))' : 'hsl(var(--chart-4))' }} /></div><span className="font-mono-ui text-[10px] text-[hsl(var(--muted-foreground))]">{channel.opens} opens</span></div><div className="mt-2 flex gap-4 text-[11px] text-[hsl(var(--muted-foreground))]"><span><strong className="text-[hsl(var(--foreground))]">{channel.paidOrders}</strong> paid</span><span><strong className="text-[hsl(var(--foreground))]">{channel.orders}</strong> orders</span><span className="ml-auto">{money(channel.revenue)}</span></div></div>)}</div> : <div className="p-8"><ChartEmpty message="Channel conversion will appear after you share a link." /></div>}</Card>;
}

function RecentTransactions() {
  const query = useListOrders();
  const orders = (query.data ?? []).slice(0, 6);
  return <Card className="mt-5 overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-[hsl(var(--border))] px-5 py-5 sm:px-6"><div><div className="font-mono-ui text-[10px] uppercase tracking-[.15em] text-[hsl(var(--muted-foreground))]">Latest activity</div><h2 className="mt-2 font-display text-xl font-bold tracking-[-.035em]">Recent transactions</h2></div><Link href="/orders" data-testid="link-see-all-orders"><Button variant="ghost">See all <ArrowUpRight size={15} /></Button></Link></div>{query.isLoading ? <div className="space-y-4 p-6"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div> : query.isError ? <div className="p-6"><ErrorState retry={() => query.refetch()} /></div> : orders.length ? <div className="overflow-x-auto"><table className="w-full min-w-[690px] text-left"><thead className="bg-[hsl(var(--background))] text-[10px] uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]"><tr><th className="px-5 py-3 font-semibold sm:px-6">Transaction</th><th className="px-4 py-3 font-semibold">Channel</th><th className="px-4 py-3 font-semibold">Date</th><th className="px-4 py-3 text-right font-semibold">Amount</th><th className="px-5 py-3 text-right font-semibold sm:px-6">Status</th></tr></thead><tbody className="divide-y divide-[hsl(var(--border))]">{orders.map((order) => <tr key={order.id} className="transaction-row" data-testid={`row-transaction-${order.id}`}><td className="px-5 py-4 sm:px-6"><div className="flex items-center gap-3"><div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[hsl(var(--muted))] font-mono-ui text-[10px] font-bold">{initials(order.customerName || order.productName)}</div><div><div className="text-sm font-semibold">{order.productName}</div><div className="mt-0.5 text-[11px] text-[hsl(var(--muted-foreground))]">{order.customerName || 'Buyer pending'}</div></div></div></td><td className="px-4 py-4 text-sm">{channelName(order.channel)}</td><td className="px-4 py-4 text-sm text-[hsl(var(--muted-foreground))]">{dateShort(order.createdAt)}</td><td className="px-4 py-4 text-right font-mono-ui text-xs font-bold">{moneyExact(order.amount)}</td><td className="px-5 py-4 text-right sm:px-6"><StatusPill tone={order.status === 'paid' ? 'mint' : order.status === 'deposit_paid' ? 'gold' : 'neutral'}>{order.status.replace('_', ' ')}</StatusPill></td></tr>)}</tbody></table></div> : <div className="p-8"><EmptyState icon={ShoppingBag} title="No transactions yet" description="Create a shareable order link and your first buyer can get started." action={<Link href="/take-order"><Button><Plus size={15} />Create a link</Button></Link>} /></div>}</Card>;
}

function OrderRow({ order, compact = false }: { order: Order; compact?: boolean }) {
  return <div className={cn('flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between', compact && 'py-3.5')} data-testid={`row-order-${order.id}`}><div className="flex items-center gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-[hsl(var(--muted))] font-mono-ui text-[10px] font-bold">{initials(order.customerName || order.productName)}</div><div><div className="text-sm font-semibold">{order.customerName || 'Buyer pending'}</div><div className="mt-0.5 text-[11px] text-[hsl(var(--muted-foreground))]">{order.productName} · {channelName(order.channel)}</div></div></div><div className="flex items-center gap-4 pl-12 sm:pl-0"><div className="text-right"><div className="font-mono-ui text-xs font-bold">{moneyExact(order.amount)}</div><div className="mt-1 text-[10px] text-[hsl(var(--muted-foreground))]">{dateShort(order.createdAt)}</div></div><StatusPill tone={order.status === 'paid' ? 'mint' : order.status === 'deposit_paid' ? 'gold' : 'neutral'}>{order.status.replace('_', ' ')}</StatusPill></div></div>;
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
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-[hsl(220_30%_17%/.45)] p-0 backdrop-blur-sm sm:items-center sm:p-5"><div className="max-h-[92dvh] w-full max-w-[560px] overflow-y-auto rounded-t-[20px] bg-[hsl(var(--card))] p-6 shadow-2xl sm:rounded-[20px] sm:p-8"><div className="flex items-start justify-between"><div><div className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">{product ? 'Edit item' : 'New item'}</div><h2 className="mt-2 font-display text-2xl font-bold tracking-[-.04em]">{product ? 'Update your item.' : 'Add to your catalog.'}</h2></div><button onClick={onClose} data-testid="button-close-product-modal" className="rounded-lg p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]"><X size={18} /></button></div><form onSubmit={save} className="mt-7 space-y-5"><div><label className="field-label">Item name</label><input data-testid="input-product-name" autoFocus required value={form.name} onChange={(e) => change('name', e.target.value)} placeholder="e.g. Linen wrap top" className="field-input" /></div><div className="grid gap-5 sm:grid-cols-2"><div><label className="field-label">Category</label><select data-testid="select-product-category" value={form.category} onChange={(e) => change('category', e.target.value)} className="field-input"><option>Apparel</option><option>Accessories</option><option>Home</option><option>Beauty</option><option>Food & drink</option><option>Other</option></select></div><div><label className="field-label">Stock on hand</label><input data-testid="input-product-stock" type="number" min="0" required value={form.stock} onChange={(e) => change('stock', e.target.value)} className="field-input" /></div></div><div className="grid gap-5 sm:grid-cols-2"><div><label className="field-label">Selling price</label><div className="relative"><span className="absolute left-3 top-2.5 text-sm text-[hsl(var(--muted-foreground))]">$</span><input data-testid="input-product-price" type="number" min="0" step=".01" required value={form.price} onChange={(e) => change('price', e.target.value)} className="field-input pl-7" /></div></div><div><label className="field-label">Cost <span className="font-normal text-[hsl(var(--muted-foreground))]">(optional)</span></label><div className="relative"><span className="absolute left-3 top-2.5 text-sm text-[hsl(var(--muted-foreground))]">$</span><input data-testid="input-product-cost" type="number" min="0" step=".01" value={form.cost} onChange={(e) => change('cost', e.target.value)} placeholder="Not tracked" className="field-input pl-7" /></div></div></div><div><label className="field-label">Variants <span className="font-normal text-[hsl(var(--muted-foreground))]">(comma separated)</span></label><input data-testid="input-product-variants" value={form.variants} onChange={(e) => change('variants', e.target.value)} placeholder="Small, Medium, Large" className="field-input" /></div><div><label className="field-label">Accent color</label><div className="flex gap-2">{['#E6B85C', '#8BBDA9', '#D79AA9', '#96A8CE', '#D99566'].map((color) => <button type="button" key={color} onClick={() => change('accent', color)} data-testid={`button-accent-${color.slice(1)}`} className={cn('h-8 w-8 rounded-full border-2 transition-transform', form.accent === color ? 'scale-110 border-[hsl(var(--foreground))]' : 'border-transparent')} style={{ backgroundColor: color }} />)}</div></div><div className="flex justify-end gap-3 border-t border-[hsl(var(--border))] pt-5"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" disabled={pending}>{pending && <Loader2 size={15} className="animate-spin" />}{product ? 'Save changes' : 'Add item'}</Button></div></form></div></div>;
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
    <div className="max-h-[92dvh] w-full max-w-[560px] overflow-y-auto rounded-t-[20px] bg-[hsl(var(--card))] p-6 shadow-2xl sm:rounded-[20px] sm:p-8">
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
    <div className="mb-5 grid gap-4 md:grid-cols-3"><Card className="p-5"><div className="text-[10px] font-bold uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">All operating expenses</div><div className="mt-3 font-display text-3xl font-bold tracking-[-.06em]">{moneyExact(total)}</div><div className="mt-2 text-[11px] text-[hsl(var(--muted-foreground))]">{query.data?.length ?? 0} recorded expenses</div></Card><Card className="p-5"><div className="text-[10px] font-bold uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">Showing now</div><div className="mt-3 font-display text-3xl font-bold tracking-[-.06em]">{moneyExact(visibleTotal)}</div><div className="mt-2 text-[11px] text-[hsl(var(--muted-foreground))]">{expenses.length} matching entries</div></Card><Card className="flex items-center gap-4 p-5"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[hsl(var(--accent))]/25 text-[hsl(var(--accent-foreground))]"><CircleDollarSign size={18} /></div><div><div className="text-sm font-bold">A clearer profit view</div><p className="mt-1 text-[11px] leading-5 text-[hsl(var(--muted-foreground))]">Operating expenses flow into combined expenses, not gross margin.</p></div></Card></div>
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
      <Card className="catalog-summary-lead p-5 sm:p-6">
        <div className="catalog-summary-kicker">Inventory value</div>
        <div className="catalog-summary-value metric-value">{money(inventoryValue)}</div>
        <p>Current selling value across {query.data?.length ?? 0} catalog {(query.data?.length ?? 0) === 1 ? 'item' : 'items'}.</p>
      </Card>
      <Card className="catalog-summary-stat p-5"><div className="catalog-summary-stat-label">Items</div><div className="catalog-summary-stat-value metric-value">{query.data?.length ?? 0}</div><div className="catalog-summary-stat-note">in your catalog</div></Card>
      <Card className="catalog-summary-stat p-5"><div className="catalog-summary-stat-label">Low stock</div><div className={cn('catalog-summary-stat-value metric-value', lowStock > 0 && 'is-alert')}>{lowStock}</div><div className="catalog-summary-stat-note">{lowStock ? 'need attention' : 'all levels look good'}</div></Card>
      <Card className="catalog-summary-stat p-5"><div className="catalog-summary-stat-label">Categories</div><div className="catalog-summary-stat-value metric-value">{categories}</div><div className="catalog-summary-stat-note">across your shop</div></Card>
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
  return <Shell><PageHeading eyebrow="Keep things moving" title="Orders" description="Payment, fulfillment, and the next useful action for every buyer." action={<Link href="/take-order"><Button><Plus size={16} />Take an order</Button></Link>} /><div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div className="relative max-w-[360px] flex-1"><Search className="absolute left-3 top-2.5 text-[hsl(var(--muted-foreground))]" size={16} /><input data-testid="input-search-orders" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search orders" className="field-input pl-9" /></div><div className="flex flex-wrap gap-2">{['all', 'reserved', 'deposit_paid', 'paid', 'shipped'].map((value) => <button key={value} onClick={() => setFilter(value)} data-testid={`button-filter-${value}`} className={cn('rounded-full px-3 py-2 text-[10px] font-bold capitalize transition-colors', filter === value ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]')}>{value.replace('_', ' ')}</button>)}</div></div>{query.isLoading ? <Card className="space-y-5 p-6"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></Card> : query.isError ? <ErrorState retry={() => query.refetch()} /> : orders.length ? <Card className="overflow-hidden"><div className="hidden grid-cols-[1.45fr_.85fr_.7fr_.7fr_auto] gap-4 border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))]/50 px-6 py-3 text-[10px] font-bold uppercase tracking-[.13em] text-[hsl(var(--muted-foreground))] md:grid"><span>Buyer</span><span>Payment</span><span>Fulfillment</span><span>Placed</span><span /></div>{orders.map((order) => <div key={order.id} className="grid gap-3 border-b border-[hsl(var(--border))] px-5 py-4 last:border-0 md:grid-cols-[1.45fr_.85fr_.7fr_.7fr_auto] md:items-center md:gap-4 md:px-6" data-testid={`row-orders-order-${order.id}`}><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[hsl(var(--muted))] font-mono-ui text-[10px] font-bold">{initials(order.customerName || order.productName)}</div><div><div className="text-sm font-semibold">{order.customerName || 'Buyer pending'}</div><div className="mt-0.5 text-[11px] text-[hsl(var(--muted-foreground))]">{order.productName} · {channelName(order.channel)}</div></div></div><div className="flex items-center justify-between md:block"><span className="text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))] md:hidden">Payment</span><button data-testid={`button-payment-${order.id}`} onClick={() => updateOrder(order, { status: order.status === 'reserved' ? 'deposit_paid' : order.status === 'deposit_paid' ? 'paid' : 'reserved' })}><StatusPill tone={order.status === 'paid' ? 'mint' : order.status === 'deposit_paid' ? 'gold' : 'neutral'}>{order.status.replace('_', ' ')}</StatusPill></button></div><div className="flex items-center justify-between md:block"><span className="text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))] md:hidden">Delivery</span><button data-testid={`button-fulfillment-${order.id}`} onClick={() => updateOrder(order, { fulfillment: order.fulfillment === 'pending' ? 'shipped' : order.fulfillment === 'shipped' ? 'delivered' : 'pending' })}><StatusPill tone={order.fulfillment === 'delivered' ? 'mint' : order.fulfillment === 'shipped' ? 'blue' : 'neutral'}>{order.fulfillment}</StatusPill></button></div><div className="hidden font-mono-ui text-[10px] text-[hsl(var(--muted-foreground))] md:block">{dateShort(order.createdAt)}<div className="mt-1 text-[12px] font-bold text-[hsl(var(--foreground))]">{moneyExact(order.amount)}</div></div><div className="flex justify-end gap-1"><button onClick={() => copyLink(order.token)} data-testid={`button-copy-link-${order.id}`} className="rounded-lg p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]" title="Copy buyer link"><Copy size={15} /></button><Link href={`/o/${order.token}`} data-testid={`link-open-order-${order.id}`} className="rounded-lg p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]"><ExternalLink size={15} /></Link></div></div>)}</Card> : <EmptyState icon={ShoppingBag} title={search || filter !== 'all' ? 'No orders match' : 'Your order list is quiet'} description={search || filter !== 'all' ? 'Try another filter or search.' : 'When buyers use your links, their orders will show up here.'} />}</Shell>;
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
      <Card className="orders-lead-card rise-in p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div><div className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">Live order value</div><div className="mt-3 font-display text-[clamp(32px,5vw,48px)] font-bold leading-none tracking-[-.065em]" data-testid="text-live-order-value">{money(metrics.orderValue)}</div><p className="mt-3 max-w-[300px] text-xs leading-5 text-[hsl(var(--muted-foreground))]">Across {allOrders.length} {allOrders.length === 1 ? 'order' : 'orders'} currently in your workspace.</p></div>
          <div className="orders-snapshot-mark"><TrendingUp size={19} /></div>
        </div>
        <div className="mt-7 flex items-center gap-3 border-t border-[hsl(var(--border))] pt-4 text-[11px]"><span className="h-2 w-2 rounded-full bg-[hsl(var(--accent-foreground))]" /><span><strong>{money(metrics.collected)}</strong> collected</span><span className="ml-auto text-[hsl(var(--muted-foreground))]">{money(metrics.outstanding)} outstanding</span></div>
      </Card>
      <Card className="rise-in p-5 sm:p-6" style={{ animationDelay: '55ms' }}><div className="orders-metric-top"><div className="orders-metric-icon orders-icon-gold"><Receipt size={16} /></div><span className="font-mono-ui text-[10px] text-[hsl(var(--muted-foreground))]">volume</span></div><div className="mt-6 font-display text-3xl font-bold tracking-[-.06em]" data-testid="text-total-orders">{allOrders.length}</div><div className="mt-2 text-xs font-semibold">Total orders</div><p className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">{metrics.paidOrders} paid in full</p></Card>
      <Card className="rise-in p-5 sm:p-6" style={{ animationDelay: '110ms' }}><div className="orders-metric-top"><div className="orders-metric-icon orders-icon-mint"><BarChart3 size={16} /></div><span className="font-mono-ui text-[10px] text-[hsl(var(--muted-foreground))]">per order</span></div><div className="mt-6 font-display text-3xl font-bold tracking-[-.06em]" data-testid="text-average-order-value">{money(metrics.average)}</div><div className="mt-2 text-xs font-semibold">Average order value</div><p className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">Based on live order value</p></Card>
      <Card className="rise-in p-5 sm:p-6" style={{ animationDelay: '165ms' }}><div className="orders-metric-top"><div className="orders-metric-icon orders-icon-blue"><CircleDollarSign size={16} /></div><span className="font-mono-ui text-[10px] text-[hsl(var(--muted-foreground))]">collected</span></div><div className="mt-6 font-display text-3xl font-bold tracking-[-.06em]" data-testid="text-collection-rate">{metrics.collectionRate.toFixed(1)}%</div><div className="mt-2 text-xs font-semibold">Collection rate</div><p className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">Paid amount against order value</p></Card>
    </section>
    <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(280px,.75fr)]">
      <Card className="overflow-hidden">
        <div className="orders-panel-heading"><div><div className="font-mono-ui text-[10px] uppercase tracking-[.15em] text-[hsl(var(--muted-foreground))]">Revenue sources</div><h2 className="mt-2 font-display text-xl font-bold tracking-[-.04em]">Where orders start</h2><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Share of {allOrders.length} live {allOrders.length === 1 ? 'order' : 'orders'}, by channel.</p></div><div className="orders-channel-total"><span>{channelMix.length}</span><small>channels</small></div></div>
        {query.isLoading ? <div className="space-y-4 p-6"><Skeleton className="h-7 w-full" /><Skeleton className="h-7 w-4/5" /><Skeleton className="h-7 w-3/5" /></div> : channelMix.length ? <div className="space-y-4 px-5 pb-6 sm:px-6">{channelMix.slice(0, 5).map(([channel, count], index) => <div key={channel} data-testid={`row-channel-mix-${channel}`}><div className="flex items-center justify-between gap-3 text-xs"><span className="font-semibold">{channelName(channel)}</span><span className="font-mono-ui text-[10px] text-[hsl(var(--muted-foreground))]">{count} · {((count / allOrders.length) * 100).toFixed(0)}%</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-[hsl(var(--muted))]"><div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${(count / maxChannelOrders) * 100}%`, backgroundColor: index === 0 ? 'hsl(var(--chart-1))' : index % 2 ? 'hsl(var(--chart-2))' : 'hsl(var(--chart-4))' }} /></div></div>)}</div> : <div className="p-6"><ChartEmpty message="Channel mix will appear when buyers use a link." /></div>}
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
        <Card className="clients-intro-card rise-in p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div><div className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">Return visits</div><div className="mt-3 font-display text-[clamp(32px,5vw,48px)] font-bold leading-none tracking-[-.065em]" data-testid="text-client-count">{clients.length}</div><p className="mt-3 max-w-[300px] text-xs leading-5 text-[hsl(var(--muted-foreground))]">{repeatClients ? `${repeatClients} ${repeatClients === 1 ? 'client has' : 'clients have'} ordered more than once.` : 'Every new buyer begins a relationship here.'}</p></div>
            <div className="clients-summary-mark"><Users size={19} /></div>
          </div>
          <div className="mt-7 flex items-center gap-3 border-t border-[hsl(var(--border))] pt-4 text-[11px]"><span className="h-2 w-2 rounded-full bg-[hsl(var(--accent-foreground))]" /><span><strong>{money(totalCollected)}</strong> collected</span><span className="ml-auto text-[hsl(var(--muted-foreground))]">{clients.reduce((sum, client) => sum + client.orderCount, 0)} orders</span></div>
        </Card>
        <Card className="rise-in p-5 sm:p-6" style={{ animationDelay: '55ms' }}><div className="clients-metric-top"><div className="clients-metric-icon clients-icon-gold"><Receipt size={16} /></div><span className="font-mono-ui text-[10px] text-[hsl(var(--muted-foreground))]">people</span></div><div className="mt-6 font-display text-3xl font-bold tracking-[-.06em]" data-testid="text-total-clients">{clients.length}</div><div className="mt-2 text-xs font-semibold">Known clients</div><p className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">Grouped by phone or name</p></Card>
        <Card className="rise-in p-5 sm:p-6" style={{ animationDelay: '110ms' }}><div className="clients-metric-top"><div className="clients-metric-icon clients-icon-mint"><TrendingUp size={16} /></div><span className="font-mono-ui text-[10px] text-[hsl(var(--muted-foreground))]">per client</span></div><div className="mt-6 font-display text-3xl font-bold tracking-[-.06em]" data-testid="text-average-client-spend">{money(clients.length ? totalCollected / clients.length : 0)}</div><div className="mt-2 text-xs font-semibold">Average collected</div><p className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">Across known buyers</p></Card>
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

function TakeOrder() {
  const productsQuery = useListProducts(); const create = useCreateOrder(); const [, setLocation] = useLocation(); const [copied, setCopied] = useState(false);
  const [form, setForm] = useState({ productId: '', amount: '', paymentMode: 'full' as 'full' | 'deposit' | 'reserve', depositAmount: '', channel: 'whatsapp' as OrderInput['channel'] }); const [created, setCreated] = useState<Order | null>(null);
  const product = (productsQuery.data ?? []).find((item) => item.id === Number(form.productId)); const change = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const chooseProduct = (value: string) => { const found = (productsQuery.data ?? []).find((item) => item.id === Number(value)); setForm((current) => ({ ...current, productId: value, amount: found ? String(found.price) : current.amount })); };
  const submit = (e: React.FormEvent) => { e.preventDefault(); if (!form.productId) return; const data: OrderInput = { productId: Number(form.productId), amount: Number(form.amount), paymentMode: form.paymentMode, depositAmount: form.paymentMode === 'deposit' ? Number(form.depositAmount) : null, channel: form.channel }; create.mutate({ data }, { onSuccess: (order) => setCreated(order) }); };
  const link = created ? `${window.location.origin}/o/${created.token}` : ''; const copy = async () => { await navigator.clipboard?.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1800); };
  if (created) return <Shell><div className="mx-auto max-w-[620px] page-in"><div className="mb-8 flex h-16 w-16 items-center justify-center rounded-[20px] bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]"><Check size={30} /></div><div className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">Link is ready</div><h1 className="mt-2 font-display text-[clamp(34px,5vw,56px)] font-bold leading-none tracking-[-.06em]">Send it their way.</h1><p className="mt-4 max-w-[480px] leading-6 text-[hsl(var(--muted-foreground))]">Your {product?.name || 'order'} link is live. Share it in the same place you started the conversation.</p><Card className="mt-8 p-5"><div className="text-[10px] font-bold uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">Buyer link</div><div className="mt-3 flex items-center gap-3 rounded-[10px] bg-[hsl(var(--muted))] p-3"><Link2 size={16} className="shrink-0 text-[hsl(var(--muted-foreground))]" /><span className="min-w-0 flex-1 truncate font-mono-ui text-xs">{link}</span><Button onClick={copy} variant="soft" data-testid="button-copy-created-link">{copied ? <Check size={15} /> : <Copy size={15} />}{copied ? 'Copied' : 'Copy'}</Button></div></Card><div className="mt-6 flex gap-3"><Link href={`/o/${created.token}`} data-testid="link-preview-created-order"><Button variant="outline"><ExternalLink size={15} />Preview link</Button></Link><Button onClick={() => { setCreated(null); setForm({ productId: '', amount: '', paymentMode: 'full', depositAmount: '', channel: 'whatsapp' }); }} variant="ghost">Create another</Button></div></div></Shell>;
  return <Shell><PageHeading eyebrow="A quick way to sell" title="Take an order" description="Set the terms, make a link, and keep the conversation where it already is." /><div className="grid gap-6 lg:grid-cols-[1fr_360px]"><Card className="p-6 sm:p-8"><form onSubmit={submit} className="space-y-6"><div><label className="field-label">What are they buying?</label>{productsQuery.isLoading ? <Skeleton className="h-11 w-full" /> : <select data-testid="select-order-product" required value={form.productId} onChange={(e) => chooseProduct(e.target.value)} className="field-input"><option value="">Choose from catalog</option>{(productsQuery.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.name} · {moneyExact(item.price)}</option>)}</select>}{productsQuery.data?.length === 0 && <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">Add an item to your catalog first.</p>}</div><div className="grid gap-5 sm:grid-cols-2"><div><label className="field-label">Agreed price</label><div className="relative"><span className="absolute left-3 top-2.5 text-sm text-[hsl(var(--muted-foreground))]">$</span><input data-testid="input-order-amount" required type="number" min="0" step=".01" value={form.amount} onChange={(e) => change('amount', e.target.value)} className="field-input pl-7" /></div></div><div><label className="field-label">Conversation started on</label><select data-testid="select-order-channel" value={form.channel} onChange={(e) => change('channel', e.target.value)} className="field-input"><option value="whatsapp">WhatsApp</option><option value="instagram">Instagram</option><option value="tiktok">TikTok</option><option value="snapchat">Snapchat</option><option value="in_person">In person</option></select></div></div><div><label className="field-label">How should they pay?</label><div className="grid gap-2 sm:grid-cols-3">{[['full', 'Pay in full', 'Collect everything now'], ['deposit', 'Pay a deposit', 'Secure the order'], ['reserve', 'Reserve it', 'Confirm details first']].map(([value, title, note]) => <button type="button" key={value} onClick={() => change('paymentMode', value)} data-testid={`button-payment-mode-${value}`} className={cn('rounded-[12px] border p-3 text-left transition-colors', form.paymentMode === value ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]')}><div className="text-xs font-bold">{title}</div><div className={cn('mt-1 text-[10px]', form.paymentMode === value ? 'text-white/65' : 'text-[hsl(var(--muted-foreground))]')}>{note}</div></button>)}</div></div>{form.paymentMode === 'deposit' && <div className="page-in"><label className="field-label">Deposit amount</label><div className="relative max-w-[240px]"><span className="absolute left-3 top-2.5 text-sm text-[hsl(var(--muted-foreground))]">$</span><input data-testid="input-order-deposit" required type="number" min="0" step=".01" value={form.depositAmount} onChange={(e) => change('depositAmount', e.target.value)} className="field-input pl-7" /></div></div>}<div className="flex justify-end border-t border-[hsl(var(--border))] pt-6"><Button type="submit" disabled={create.isPending || !productsQuery.data?.length} data-testid="button-create-order-link">{create.isPending && <Loader2 className="animate-spin" size={15} />}Create buyer link <ArrowUpRight size={15} /></Button></div></form></Card><Card className="h-fit overflow-hidden"><div className="h-3" style={{ backgroundColor: product?.accent || '#E6B85C' }} /><div className="p-6"><div className="flex items-center justify-between"><div className="font-mono-ui text-[10px] uppercase tracking-[.15em] text-[hsl(var(--muted-foreground))]">Link preview</div><Link2 size={17} className="text-[hsl(var(--muted-foreground))]" /></div><div className="mt-9 text-center"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[18px]" style={{ backgroundColor: `${product?.accent || '#E6B85C'}45` }}><Package size={26} /></div><h3 className="mt-5 font-display text-xl font-bold">{product?.name || 'Your item'}</h3><div className="mt-2 font-mono-ui text-sm">{form.amount ? moneyExact(Number(form.amount)) : '—'}</div></div><div className="mt-8 space-y-3 border-t border-[hsl(var(--border))] pt-5 text-xs"><div className="flex justify-between"><span className="text-[hsl(var(--muted-foreground))]">Payment</span><span className="font-semibold capitalize">{form.paymentMode === 'deposit' ? `Deposit · ${form.depositAmount ? moneyExact(Number(form.depositAmount)) : '—'}` : form.paymentMode}</span></div><div className="flex justify-between"><span className="text-[hsl(var(--muted-foreground))]">Channel</span><span className="font-semibold">{channelName(form.channel)}</span></div></div></div></Card></div></Shell>;
}

function PublicOrderPage() {
  const { token = '' } = useParams<{ token: string }>();
  const query = useGetPublicOrder(token, { query: { enabled: Boolean(token), queryKey: getGetPublicOrderQueryKey(token) } });
  const submit = useSubmitPublicOrder();
  const [submitted, setSubmitted] = useState(false);
  const [showMockPayment, setShowMockPayment] = useState(false);
  const [mockPayment, setMockPayment] = useState({ cardNumber: '', expiry: '', cvc: '' });
  const [form, setForm] = useState({ name: '', phone: '', details: '', image: '', action: 'pay' as 'pay' | 'reserve' });
  const order = query.data;
  const change = (key: string, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    if (key === 'action' && value === 'reserve') setShowMockPayment(false);
  };
  const submitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (order?.paymentMode !== 'reserve' && form.action === 'pay' && !showMockPayment) {
      setShowMockPayment(true);
      return;
    }
    const data: PublicOrderInput = { customerName: form.name, customerPhone: form.phone, buyerDetails: form.details || undefined, referenceImage: form.image || undefined, paymentAction: order?.paymentMode === 'reserve' ? 'reserve' : form.action };
    submit.mutate({ token, data }, { onSuccess: () => setSubmitted(true) });
  };
  if (query.isLoading) return <div className="min-h-[100dvh] bg-[hsl(var(--background))] p-6"><div className="mx-auto max-w-[480px]"><Skeleton className="mx-auto mt-14 h-10 w-10" /><Skeleton className="mx-auto mt-8 h-8 w-52" /><Skeleton className="mt-4 h-4 w-full" /><Skeleton className="mt-10 h-64 w-full" /></div></div>;
  if (query.isError || !order) return <div className="flex min-h-[100dvh] items-center justify-center p-6"><div className="text-center"><div className="font-display text-2xl font-bold">This link is no longer available.</div><p className="mt-3 text-sm text-[hsl(var(--muted-foreground))]">Ask the seller for a fresh order link.</p></div></div>;
  if (submitted) return <div className="flex min-h-[100dvh] items-center justify-center bg-[hsl(var(--background))] p-6"><div className="w-full max-w-[480px] text-center page-in"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[20px] bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]"><Check size={30} /></div><h1 className="mt-7 font-display text-4xl font-bold tracking-[-.05em]">You’re all set.</h1><p className="mx-auto mt-4 max-w-[350px] text-sm leading-6 text-[hsl(var(--muted-foreground))]">{form.action === 'pay' && order.paymentMode !== 'reserve' ? 'Your mock payment and order details were sent to the seller. No real payment was processed.' : 'Your details have been sent to the seller. They’ll be in touch with the next step.'}</p><div className="mt-8 font-mono-ui text-[10px] uppercase tracking-[.15em] text-[hsl(var(--muted-foreground))]">Order reference · {token.slice(0, 8)}</div></div></div>;
  return <div className="min-h-[100dvh] bg-[hsl(var(--background))] px-5 py-8 sm:py-14"><div className="mx-auto max-w-[480px]"><div className="flex items-center justify-center gap-2 font-display text-xl font-bold tracking-[-.04em]"><span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"><Store size={16} /></span>duka</div><div className="mt-10 text-center"><div className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">An order from The Sunday Edit</div><h1 className="mt-3 font-display text-[clamp(32px,8vw,48px)] font-bold leading-none tracking-[-.06em]">{order.productName}</h1><div className="mt-4 font-mono-ui text-xl">{moneyExact(order.amount)}</div></div><Card className="mt-9 p-6 sm:p-8"><div className="mb-6 flex items-center justify-between border-b border-[hsl(var(--border))] pb-5"><div><div className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">Complete your order</div><p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">{order.paymentMode === 'reserve' ? 'Reserve this item and we’ll confirm the details.' : order.paymentMode === 'deposit' ? `A ${moneyExact(order.depositAmount)} deposit secures it.` : 'Pay in full to confirm your order.'}</p></div><div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-[hsl(var(--accent))]/35"><Package size={18} /></div></div><form onSubmit={submitForm} className="space-y-5"><div><label className="field-label">Your name</label><input data-testid="input-buyer-name" required minLength={1} value={form.name} onChange={(e) => change('name', e.target.value)} placeholder="Full name" className="field-input" /></div><div><label className="field-label">Phone number</label><input data-testid="input-buyer-phone" required minLength={5} value={form.phone} onChange={(e) => change('phone', e.target.value)} placeholder="Best number to reach you" className="field-input" /></div>{order.variants?.length > 0 && <div><label className="field-label">Available variants</label><div className="flex flex-wrap gap-2">{order.variants.map((variant) => <span key={variant} className="rounded-full border border-[hsl(var(--border))] px-3 py-1.5 text-xs">{variant}</span>)}</div></div>}<div><label className="field-label">Note for the seller <span className="font-normal text-[hsl(var(--muted-foreground))]">(optional)</span></label><textarea data-testid="input-buyer-details" value={form.details} onChange={(e) => change('details', e.target.value)} placeholder="Size, color, delivery note..." rows={3} className="field-input resize-none" /></div><div><label className="field-label">Reference image <span className="font-normal text-[hsl(var(--muted-foreground))]">(optional)</span></label><label className="flex cursor-pointer items-center gap-3 rounded-[10px] border border-dashed border-[hsl(var(--border))] p-3 text-xs text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]"><Clipboard size={15} />{form.image ? 'Image selected' : 'Attach an image'}<input data-testid="input-buyer-reference-image" type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) change('image', file.name); }} /></label></div>{showMockPayment && <div className="rounded-[13px] border border-[hsl(var(--accent))]/55 bg-[hsl(var(--accent))]/10 p-4 page-in"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2 text-sm font-bold"><WalletCards size={16} />Mock payment checkout</div><StatusPill tone="gold">Demo</StatusPill></div><p className="mt-2 text-[11px] leading-5 text-[hsl(var(--muted-foreground))]">No real charge will be made. Use any test details to continue.</p><div className="mt-4 space-y-3"><div><label className="field-label">Card number</label><input data-testid="input-mock-card-number" required inputMode="numeric" value={mockPayment.cardNumber} onChange={(e) => setMockPayment((current) => ({ ...current, cardNumber: e.target.value }))} placeholder="4242 4242 4242 4242" className="field-input" /></div><div className="grid grid-cols-2 gap-3"><div><label className="field-label">Expiry</label><input data-testid="input-mock-expiry" required value={mockPayment.expiry} onChange={(e) => setMockPayment((current) => ({ ...current, expiry: e.target.value }))} placeholder="12/30" className="field-input" /></div><div><label className="field-label">CVC</label><input data-testid="input-mock-cvc" required inputMode="numeric" value={mockPayment.cvc} onChange={(e) => setMockPayment((current) => ({ ...current, cvc: e.target.value }))} placeholder="123" className="field-input" /></div></div></div></div>}{order.paymentMode !== 'reserve' && <div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => { change('action', 'pay'); setShowMockPayment(false); }} data-testid="button-buyer-pay" className={cn('rounded-[10px] border p-3 text-left text-xs font-bold', form.action === 'pay' ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-white' : 'border-[hsl(var(--border))]')}>{order.paymentMode === 'deposit' ? `Pay deposit · ${moneyExact(order.depositAmount)}` : `Pay ${moneyExact(order.amount)}`}</button><button type="button" onClick={() => { change('action', 'reserve'); setShowMockPayment(false); }} data-testid="button-buyer-reserve" className={cn('rounded-[10px] border p-3 text-left text-xs font-bold', form.action === 'reserve' ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-white' : 'border-[hsl(var(--border))]')}>Reserve for later</button></div>}<Button type="submit" disabled={submit.isPending} className="w-full py-3.5" data-testid="button-submit-public-order">{submit.isPending && <Loader2 size={15} className="animate-spin" />}{order.paymentMode === 'reserve' || form.action === 'reserve' ? 'Reserve this item' : showMockPayment ? 'Complete mock payment' : 'Continue to mock payment'} <ArrowUpRight size={15} /></Button></form></Card><div className="mt-6 text-center font-mono-ui text-[9px] uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">Powered by duka · made for small businesses</div></div></div>;
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

function Router() { const [location] = useLocation(); return <ErrorBoundary resetKey={location}><Switch><Route path="/onboarding" component={Onboarding} /><Route path="/" component={HomeRoute} /><Route path="/catalog" component={Catalog} /><Route path="/orders" component={Orders} /><Route path="/reports" component={Reports} /><Route path="/clients" component={Clients} /><Route path="/expenses" component={Expenses} /><Route path="/take-order" component={TakeOrder} /><Route path="/connect" component={Connect} /><Route path="/o/:token" component={PublicOrderPage} /><Route component={NotFound} /></Switch></ErrorBoundary>; }
function App() { return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>; }
export default App;