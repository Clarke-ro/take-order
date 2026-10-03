import React, { useState } from 'react';
import { Link } from 'wouter';
import { useAppAuth } from '@/lib/auth-context';
import {
  Check,
  ArrowRight,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  BarChart3,
  TrendingUp,
  Share2,
  PackageCheck,
  ChevronDown,
  Menu,
  X,
  Lock,
  Users,
  Clock,
  Truck,
  DollarSign,
} from 'lucide-react';

export function LandingPage() {
  const { isSignedIn } = useAppAuth();
  const isTestAuth =
    typeof window !== 'undefined' &&
    (Boolean((window as any).__DUKA_TEST_AUTH__) ||
      localStorage.getItem('duka-test-auth') === 'true');
  const effectiveSignedIn = isSignedIn || isTestAuth;

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('annual');
  const [storeNameInput, setStoreNameInput] = useState('');
  const [previewHandle, setPreviewHandle] = useState('mystore');
  const [copiedLink, setCopiedLink] = useState(false);

  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleStorePreview = (e: React.FormEvent) => {
    e.preventDefault();
    if (storeNameInput.trim()) {
      const cleanHandle = storeNameInput
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '');
      setPreviewHandle(cleanHandle || 'mystore');
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(`https://www.usetakeorder.app/store/${previewHandle}`);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const featureCards = [
    {
      icon: ShoppingBag,
      tag: 'Fast Order Flow',
      title: 'One-Tap Order Links',
      headline: 'Turn your social bio link into a high-converting storefront',
      description:
        'Instead of typing prices back and forth in WhatsApp and Instagram chats, share a sleek Take Order link. Buyers browse your catalog, select variants, and complete orders in under 40 seconds without creating an account.',
      points: [
        'Zero app downloads required for buyers',
        'Works across WhatsApp, Instagram, TikTok & DMs',
        'Instant order summary sent to chat',
      ],
    },
    {
      icon: ShieldCheck,
      tag: 'Slip Verification',
      title: 'Order Slip & Receipt Verification',
      headline: 'Capture customer order receipts and delivery confirmations seamlessly',
      description:
        'Buyers attach their transaction confirmation slip or receipt directly into the order flow. Take Order logs the submission, notifies you immediately, and keeps every order organized and audit-ready.',
      points: [
        'Order receipt capture for MoMo and bank transfers',
        'Instant seller order notifications',
        'Proof of order stored securely with each submission',
      ],
    },
    {
      icon: Users,
      tag: 'Loyalty Engine',
      title: 'Customer CRM & Repeat Orders',
      headline: 'Build a private list of your highest-paying regular customers',
      description:
        'Every completed order automatically logs customer contact details, past purchase amounts, and favorite items. Send one-click WhatsApp dispatch updates and re-engage VIP customers with new drops.',
      points: [
        'Full customer order history & lifetime spend',
        'One-click WhatsApp dispatch & delivery updates',
        'Automatic repeat-buyer tags',
      ],
    },
    {
      icon: TrendingUp,
      tag: 'Business Operations',
      title: 'Realtime Stock & Profit Tracker',
      headline: 'Never sell an item twice or lose money on delivery fees',
      description:
        'Stock counts auto-deduct the second an order is confirmed. Log delivery rider fees, product costs, and monitor your exact daily profit margins straight from your seller dashboard.',
      points: [
        'Live stock alerts before you run out',
        'Delivery fee & distance manager',
        'Daily net profit and margin analytics',
      ],
    },
  ];

  const workflowSteps = [
    {
      num: '01',
      title: 'Instant Order Link',
      desc: 'Lock in price, variants, deposit, or reserve right in chat without back-and-forth messaging.',
    },
    {
      num: '02',
      title: 'Track by Status',
      desc: 'Follow orders clearly through new, paid, out for delivery, and completed fulfillment.',
    },
    {
      num: '03',
      title: 'Deposit & Balance Clarity',
      desc: 'Always know who owes what with automated deposit tracking and clear outstanding balances.',
    },
    {
      num: '04',
      title: 'One-Tap Dispatch',
      desc: 'Send packaged order details, customer addresses, and contacts directly to your riders.',
    },
  ];

  const faqs = [
    {
      q: 'Do my buyers need to download an app or sign up to order?',
      a: 'No! Buyers never need to download an app or create an account. When they tap your Take Order link in WhatsApp, Instagram, or TikTok, your store opens immediately in their mobile browser for a lightning-fast 30-second checkout.',
    },
    {
      q: 'How do customers complete orders with Take Order?',
      a: 'Take Order is a SaaS order management platform. Customers select products, provide delivery information, and submit their order confirmation directly to your dashboard. Take Order does not process or touch customer payments; you receive 100% of your customer funds directly through your own chosen accounts.',
    },
    {
      q: 'What is the difference between Pro ($9.99/mo) and Pro+ ($20/mo)?',
      a: 'Pro ($9.99/mo) gives you unlimited active order links, up to 100 catalog products, automated receipts, and core sales tracking. Pro+ ($20/mo) unlocks unlimited catalog products, custom branding with your own store logo/colors, multi-currency display, customer CRM insights, and VIP concierge support.',
    },
    {
      q: 'How long is the free trial for Take Order?',
      a: 'Take Order includes a full 7-day free trial on both Pro and Pro+ plans. You can set up your catalog, generate live order links, and test real checkouts. You will not be charged during the 7-day trial, and you can cancel anytime with one click in your account settings.',
    },
    {
      q: 'Can I cancel my subscription at any time?',
      a: 'Yes, absolutely. There are no long-term contracts or cancellation penalties. You can manage or cancel your subscription at any time with a single click inside your Account Billing settings.',
    },
    {
      q: 'How do I share my order links on social media?',
      a: 'Take Order generates custom, short links for your entire store (e.g. usetakeorder.app/store/yourbrand) as well as specific single-product links. You can paste them into your Instagram bio, WhatsApp Status, TikTok link-in-bio, or directly in customer DMs.',
    },
  ];

  return (
    <div
      data-route="/"
      className="min-h-screen bg-white text-neutral-900 font-sans selection:bg-neutral-900 selection:text-white antialiased"
    >
      {/* ── 1. Top Header / Navigation ── */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-neutral-200/80 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3 group cursor-pointer">
            <img
              src="/branding/takeorder-icon.png"
              alt="Take Order"
              className="h-9 w-9 rounded-xl object-contain shadow-xs group-hover:scale-105 transition-transform"
            />
            <div className="flex flex-col">
              <span className="font-bold tracking-tight text-xl leading-none text-neutral-950">
                Take Order
              </span>
              <span className="text-[10px] uppercase tracking-wider font-semibold text-neutral-400 mt-0.5">
                Social Commerce OS
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-8 text-[14px] font-semibold text-neutral-600">
            <button
              type="button"
              onClick={() => scrollToSection('features')}
              className="hover:text-neutral-950 transition-colors cursor-pointer"
            >
              Product
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('how-it-works')}
              className="hover:text-neutral-950 transition-colors cursor-pointer"
            >
              How it works
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('comparison')}
              className="hover:text-neutral-950 transition-colors cursor-pointer"
            >
              Comparison
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('pricing')}
              className="hover:text-neutral-950 transition-colors cursor-pointer"
            >
              Pricing
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('faqs')}
              className="hover:text-neutral-950 transition-colors cursor-pointer"
            >
              FAQs
            </button>
          </nav>

          {/* Right Action CTAs */}
          <div className="hidden md:flex items-center gap-3">
            {effectiveSignedIn ? (
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-neutral-950 text-white text-sm font-bold hover:bg-neutral-800 shadow-xs transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <span>Open Dashboard</span>
                <ArrowRight size={14} className="text-amber-400" />
              </Link>
            ) : (
              <>
                <Link
                  href="/sign-in"
                  className="px-4 py-2.5 rounded-full text-sm font-semibold text-neutral-700 hover:text-neutral-950 hover:bg-neutral-100 transition-all"
                >
                  Sign In
                </Link>
                <Link
                  href="/sign-up"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-neutral-950 text-white text-sm font-bold hover:bg-neutral-800 shadow-xs transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  <span>Start 7-Day Trial</span>
                  <ArrowRight size={14} className="text-amber-400" />
                </Link>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center gap-2">
            {effectiveSignedIn ? (
              <Link
                href="/dashboard"
                className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-neutral-950 text-white"
              >
                Dashboard
              </Link>
            ) : (
              <Link
                href="/sign-in"
                className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-neutral-950 text-white"
              >
                Sign In
              </Link>
            )}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-neutral-700 hover:bg-neutral-100 cursor-pointer"
              aria-label="Toggle navigation"
            >
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-b border-neutral-200 px-4 pt-3 pb-6 space-y-3">
            <button
              type="button"
              onClick={() => scrollToSection('features')}
              className="block w-full text-left py-2 text-sm font-semibold text-neutral-700 hover:text-neutral-950"
            >
              Product
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('how-it-works')}
              className="block w-full text-left py-2 text-sm font-semibold text-neutral-700 hover:text-neutral-950"
            >
              How it works
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('comparison')}
              className="block w-full text-left py-2 text-sm font-semibold text-neutral-700 hover:text-neutral-950"
            >
              Comparison
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('pricing')}
              className="block w-full text-left py-2 text-sm font-semibold text-neutral-700 hover:text-neutral-950"
            >
              Pricing
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('faqs')}
              className="block w-full text-left py-2 text-sm font-semibold text-neutral-700 hover:text-neutral-950"
            >
              FAQs
            </button>
            <div className="pt-2 border-t border-neutral-200 flex flex-col gap-2">
              {effectiveSignedIn ? (
                <Link
                  href="/dashboard"
                  className="w-full text-center py-2.5 rounded-xl bg-neutral-950 text-white font-bold text-sm"
                >
                  Open Dashboard
                </Link>
              ) : (
                <Link
                  href="/sign-up"
                  className="w-full text-center py-2.5 rounded-xl bg-neutral-950 text-white font-bold text-sm"
                >
                  Start 7-Day Free Trial
                </Link>
              )}
            </div>
          </div>
        )}
      </header>

      {/* ── 2. Hero Section ── */}
      <section className="relative pt-12 pb-20 md:pt-20 md:pb-32 overflow-hidden bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {/* Subtle Tag */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-neutral-100 text-neutral-800 text-xs font-bold uppercase tracking-wider mb-6 border border-neutral-200">
            <span>Built For Social Commerce</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.14] text-neutral-900 max-w-4xl mx-auto">
            The order platform social sellers use to{' '}
            <span className="font-extrabold text-neutral-950">turn chats into paid orders.</span>
          </h1>

          {/* Subtitle */}
          <p className="mt-5 text-base sm:text-lg text-neutral-600 max-w-2xl mx-auto font-normal leading-relaxed">
            Replace chaotic WhatsApp &amp; Instagram DM negotiations with branded order links, organized customer order slips, and real-time inventory tracking.
          </p>

          {/* Action CTAs */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3.5">
            {effectiveSignedIn ? (
              <Link
                href="/dashboard"
                className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-neutral-950 text-white text-sm font-bold hover:bg-neutral-800 transition-all flex items-center justify-center gap-2 shadow-xs hover:scale-[1.02] active:scale-[0.98]"
              >
                <span>Open Seller Dashboard</span>
                <ArrowRight size={15} className="text-amber-400" />
              </Link>
            ) : (
              <Link
                href="/sign-up"
                className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-neutral-950 text-white text-sm font-bold hover:bg-neutral-800 transition-all flex items-center justify-center gap-2 shadow-xs hover:scale-[1.02] active:scale-[0.98]"
              >
                <span>Start 7-Day Free Trial</span>
                <ArrowRight size={15} className="text-amber-400" />
              </Link>
            )}
            <button
              type="button"
              onClick={() => scrollToSection('pricing')}
              className="w-full sm:w-auto px-7 py-3.5 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-sm font-semibold transition-all cursor-pointer"
            >
              View Pricing
            </button>
          </div>

          <p className="mt-3.5 text-xs text-neutral-400 flex items-center justify-center gap-3">
            <span>7-day free trial</span>
            <span>•</span>
            <span>No credit card needed</span>
            <span>•</span>
            <span>Cancel anytime</span>
          </p>

          {/* ── Sales Banner Showcase Visual (High-Detail Lifestyle Photo with Widget) ── */}
          <div className="mt-14 max-w-4xl mx-auto relative group">
            <div className="relative rounded-3xl sm:rounded-[36px] overflow-hidden bg-neutral-950 border border-neutral-200 shadow-2xl">
              <img
                src="/illustrations/sales-banner.jpg"
                alt="Take Order seller in cafe with phone, branded bag and live sales report"
                className="w-full h-auto max-h-[520px] object-cover object-center transform group-hover:scale-[1.01] transition-transform duration-700"
              />
              <div className="absolute bottom-6 left-6 right-6 hidden sm:flex items-center justify-between text-white bg-black/50 backdrop-blur-md px-5 py-3 rounded-2xl border border-neutral-700/60">
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs font-semibold text-neutral-200">
                    Active Social Commerce Storefront • 100% Direct Payouts
                  </span>
                </div>
                <span className="text-xs font-bold text-amber-300">
                  Zero DM Chaos
                </span>
              </div>
            </div>
          </div>

          {/* ── Interactive Live Storefront Generator ── */}
          <div className="mt-12 max-w-3xl mx-auto p-6 rounded-3xl bg-neutral-50 border border-neutral-200 text-left">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex-1 w-full">
                <label htmlFor="store-name-input" className="block text-xs font-bold uppercase tracking-wider text-neutral-500 mb-1">
                  Preview Your Live Store Link
                </label>
                <form onSubmit={handleStorePreview} className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-2.5 text-xs font-mono text-neutral-400 select-none">
                      usetakeorder.app/store/
                    </span>
                    <input
                      id="store-name-input"
                      type="text"
                      value={storeNameInput}
                      onChange={(e) => setStoreNameInput(e.target.value)}
                      placeholder={previewHandle}
                      className="w-full pl-44 pr-3 py-2 text-xs font-mono rounded-xl border border-neutral-300 bg-white text-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-neutral-900 text-white text-xs font-bold rounded-xl hover:bg-neutral-800 transition cursor-pointer"
                  >
                    Set
                  </button>
                </form>
              </div>
              <button
                type="button"
                onClick={handleCopyLink}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-white border border-neutral-300 hover:bg-neutral-100 text-xs font-semibold text-neutral-800 transition flex items-center justify-center gap-2 cursor-pointer shrink-0"
              >
                <Share2 size={13} />
                <span>{copiedLink ? 'Copied link!' : 'Copy Link'}</span>
              </button>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto text-left">
            <div className="p-5 rounded-2xl bg-neutral-50 border border-neutral-200">
              <p className="text-2xl sm:text-3xl font-black text-neutral-950">38 sec</p>
              <p className="text-xs text-neutral-500 font-medium mt-1">Average buyer checkout</p>
            </div>
            <div className="p-5 rounded-2xl bg-neutral-50 border border-neutral-200">
              <p className="text-2xl sm:text-3xl font-black text-neutral-950">0%</p>
              <p className="text-xs text-neutral-500 font-medium mt-1">Sales commission taken</p>
            </div>
            <div className="p-5 rounded-2xl bg-neutral-50 border border-neutral-200">
              <p className="text-2xl sm:text-3xl font-black text-neutral-950">100%</p>
              <p className="text-xs text-neutral-500 font-medium mt-1">Direct to your bank or MoMo</p>
            </div>
            <div className="p-5 rounded-2xl bg-neutral-50 border border-neutral-200">
              <p className="text-2xl sm:text-3xl font-black text-neutral-950">24/7</p>
              <p className="text-xs text-neutral-500 font-medium mt-1">Automated order intake</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. Feature Section: Large Cards with Spacious Layout ── */}
      <section id="features" className="py-24 sm:py-32 bg-white border-t border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16 sm:mb-20">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-500 mb-2 block">
              Core Capabilities
            </span>
            <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-neutral-900">
              Built for how social sellers actually sell
            </h2>
            <p className="mt-4 text-base sm:text-lg text-neutral-600 font-normal leading-relaxed">
              Everything you need to turn casual Instagram scrollers and WhatsApp contacts into organized, paying buyers.
            </p>
          </div>

          {/* Large Cards Grid (2 on top, 2 on bottom) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-10">
            {featureCards.map((card, idx) => {
              const IconComp = card.icon;
              return (
                <div
                  key={idx}
                  className="p-8 sm:p-12 rounded-3xl bg-neutral-50 border border-neutral-200 hover:border-neutral-400 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-6">
                      <div className="w-12 h-12 rounded-2xl bg-white border border-neutral-200 flex items-center justify-center text-neutral-900 shadow-2xs">
                        <IconComp size={22} strokeWidth={2.2} />
                      </div>
                      <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide bg-neutral-200 text-neutral-800">
                        {card.tag}
                      </span>
                    </div>

                    <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900 mb-3">
                      {card.title}
                    </h3>

                    <p className="text-base text-neutral-600 leading-relaxed font-normal mb-8">
                      {card.description}
                    </p>

                    <div className="space-y-3 pt-4 border-t border-neutral-200/80">
                      {card.points.map((pt, pIdx) => (
                        <div key={pIdx} className="flex items-center gap-3">
                          <div className="h-5 w-5 rounded-full bg-neutral-900 text-white flex items-center justify-center shrink-0">
                            <Check size={11} strokeWidth={3} className="text-amber-400" />
                          </div>
                          <span className="text-sm font-semibold text-neutral-800">
                            {pt}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── 4. Section: The 4-Step Operational Flow ("What Take Order Does") ── */}
      <section id="how-it-works" className="py-24 sm:py-32 bg-neutral-50 border-t border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16 sm:mb-20">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-500 mb-2 block">
              Workflow
            </span>
            <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-neutral-900">
              What Take Order does
            </h2>
            <p className="mt-4 text-base sm:text-lg text-neutral-600 font-normal">
              An order management and record-keeping app for sellers who do business in their DMs.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
            {workflowSteps.map((step, idx) => (
              <div
                key={idx}
                className="p-8 rounded-3xl bg-white border border-neutral-200 hover:border-neutral-400 transition-all shadow-2xs flex flex-col justify-between"
              >
                <div>
                  <span className="text-xs font-bold text-neutral-400 block mb-4">
                    Step {step.num}
                  </span>
                  <h3 className="text-xl font-bold text-neutral-900 mb-2">
                    {step.title}
                  </h3>
                  <p className="text-sm text-neutral-600 leading-relaxed font-normal">
                    {step.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 5. Comparison: Chaotic DMs vs Take Order Standard ── */}
      <section id="comparison" className="py-24 sm:py-32 bg-white border-t border-neutral-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16 sm:mb-20">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-500 mb-2 block">
              Comparison
            </span>
            <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-neutral-900">
              Why modern sellers are leaving manual DM selling behind
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-10">
            {/* The Old Way */}
            <div className="p-8 sm:p-10 rounded-3xl bg-neutral-50 border border-neutral-200 space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neutral-200 text-neutral-800 text-xs font-bold uppercase tracking-wider">
                <span>The Chaotic DM Way</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-neutral-900">
                Messy chats, lost buyers, and unorganized orders
              </h3>
              <ul className="space-y-4 text-sm text-neutral-600">
                <li className="flex items-start gap-3">
                  <span className="text-neutral-400 font-bold text-base mt-0.5">✕</span>
                  <span><strong>15+ back-and-forth messages</strong> just to confirm price, size, and delivery address.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-neutral-400 font-bold text-base mt-0.5">✕</span>
                  <span><strong>Customers ghost halfway</strong> through chat negotiations and buy elsewhere.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-neutral-400 font-bold text-base mt-0.5">✕</span>
                  <span><strong>Unorganized chat screenshots</strong> causing delayed dispatches and missed details.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-neutral-400 font-bold text-base mt-0.5">✕</span>
                  <span><strong>Items oversold</strong> because inventory is tracked in your head or paper notebooks.</span>
                </li>
              </ul>
            </div>

            {/* The Take Order Way */}
            <div className="p-8 sm:p-10 rounded-3xl bg-neutral-950 text-white shadow-xl border border-neutral-800 space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neutral-800 text-white text-xs font-bold uppercase tracking-wider border border-neutral-700">
                <span>The Take Order Standard</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-white">
                One-tap order link, structured order slips, clean pipeline
              </h3>
              <ul className="space-y-4 text-sm text-neutral-300">
                <li className="flex items-start gap-3">
                  <span className="text-amber-400 font-bold text-base mt-0.5">✓</span>
                  <span><strong>38-second average checkout</strong> directly from your Instagram bio, TikTok, or WhatsApp status.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-amber-400 font-bold text-base mt-0.5">✓</span>
                  <span><strong>Customer order slip &amp; delivery details</strong> attached directly to the order record.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-amber-400 font-bold text-base mt-0.5">✓</span>
                  <span><strong>Automatic stock reservation</strong> prevents overselling popular variants.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-amber-400 font-bold text-base mt-0.5">✓</span>
                  <span><strong>Live seller dashboard</strong> with dispatch statuses, customer phone numbers, and profit metrics.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── 6. Pricing Section (Two Paywalls: Pro and Pro+ with Paddle Compliance) ── */}
      <section id="pricing" className="py-24 sm:py-32 bg-neutral-50 border-t border-neutral-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-500 mb-2 block">
              Pricing Plans
            </span>
            <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-neutral-900">
              Simple pricing with a 7-day free trial
            </h2>
            <p className="mt-4 text-base sm:text-lg text-neutral-600 font-normal">
              Zero commissions on your sales. Take Order never touches your customer funds. Cancel anytime with one click.
            </p>

            {/* Billing Cycle Toggle */}
            <div className="mt-8 flex items-center justify-center">
              <div className="inline-flex items-center p-1 rounded-full bg-neutral-200 border border-neutral-300">
                <button
                  type="button"
                  onClick={() => setBillingCycle('monthly')}
                  className={`px-5 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                    billingCycle === 'monthly'
                      ? 'bg-white text-neutral-950 shadow-xs'
                      : 'text-neutral-600 hover:text-neutral-950'
                  }`}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  onClick={() => setBillingCycle('annual')}
                  className={`flex items-center gap-2 px-5 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                    billingCycle === 'annual'
                      ? 'bg-neutral-950 text-white shadow-xs'
                      : 'text-neutral-600 hover:text-neutral-950'
                  }`}
                >
                  <span>Annual</span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      billingCycle === 'annual'
                        ? 'bg-amber-400 text-neutral-950'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    Save 25%
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Pricing Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto items-stretch">
            {/* Pro Plan */}
            <div className="rounded-3xl bg-white border-2 border-neutral-200 p-8 sm:p-10 shadow-xs flex flex-col justify-between hover:border-neutral-900 transition-all">
              <div>
                <div className="flex items-center justify-between">
                  <span className="px-3 py-1 rounded-full bg-neutral-100 text-neutral-800 text-xs font-bold uppercase tracking-wider">
                    Pro
                  </span>
                  <span className="text-xs text-neutral-500 font-medium">
                    {billingCycle === 'annual' ? 'Annual Billing' : 'Monthly Billing'}
                  </span>
                </div>

                <div className="mt-6 flex items-baseline gap-1">
                  <span className="text-4xl sm:text-5xl font-black text-neutral-950 tracking-tight">
                    {billingCycle === 'annual' ? '$7.49' : '$9.99'}
                  </span>
                  <span className="text-sm font-medium text-neutral-500">/ month</span>
                </div>
                {billingCycle === 'annual' && (
                  <p className="mt-1 text-xs text-neutral-500 font-medium">
                    $89.90 billed annually (save 25%)
                  </p>
                )}

                <p className="mt-3 text-sm text-neutral-600 leading-relaxed font-normal">
                  Ideal for rising social sellers ready to eliminate manual chat order negotiations and organize their catalog.
                </p>

                <div className="mt-8 pt-6 border-t border-neutral-100 space-y-3.5 text-sm font-medium text-neutral-700">
                  <div className="flex items-center gap-3">
                    <Check size={16} className="text-neutral-950 shrink-0" strokeWidth={2.5} />
                    <span><strong>Unlimited</strong> active order links &amp; checkouts</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Check size={16} className="text-neutral-950 shrink-0" strokeWidth={2.5} />
                    <span>Up to <strong>100 catalog products</strong></span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Check size={16} className="text-neutral-950 shrink-0" strokeWidth={2.5} />
                    <span>Automated customer order receipt &amp; slip capture</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Check size={16} className="text-neutral-950 shrink-0" strokeWidth={2.5} />
                    <span>WhatsApp &amp; SMS customer receipt templates</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Check size={16} className="text-neutral-950 shrink-0" strokeWidth={2.5} />
                    <span>Real-time inventory reservation</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Check size={16} className="text-neutral-950 shrink-0" strokeWidth={2.5} />
                    <span>Standard sales analytics &amp; order export</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Check size={16} className="text-neutral-950 shrink-0" strokeWidth={2.5} />
                    <span>Dedicated email &amp; in-app support</span>
                  </div>
                </div>
              </div>

              <div className="mt-10">
                <Link
                  href={`/sign-up?plan=pro&cycle=${billingCycle}`}
                  className="w-full py-4 rounded-full bg-neutral-950 text-white text-sm font-bold hover:bg-neutral-800 transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                >
                  <span>Start 7-Day Free Trial</span>
                  <ArrowRight size={14} className="text-amber-400" />
                </Link>
                <p className="mt-2.5 text-center text-xs text-neutral-400">
                  Includes full 7-day trial • Cancel anytime
                </p>
              </div>
            </div>

            {/* Pro+ Plan (Featured) */}
            <div className="rounded-3xl bg-neutral-950 text-white border-2 border-neutral-800 p-8 sm:p-10 shadow-xl flex flex-col justify-between relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-[#F5B418] text-neutral-950 text-[11px] font-bold uppercase tracking-wider px-4 py-1 rounded-bl-xl shadow-xs">
                Most Popular
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <span className="px-3 py-1 rounded-full bg-neutral-800 text-white text-xs font-bold uppercase tracking-wider border border-neutral-700">
                    Pro+
                  </span>
                  <span className="text-xs text-neutral-400 font-medium">
                    {billingCycle === 'annual' ? 'Annual Billing' : 'Monthly Billing'}
                  </span>
                </div>

                <div className="mt-6 flex items-baseline gap-1">
                  <span className="text-4xl sm:text-5xl font-black text-white tracking-tight">
                    {billingCycle === 'annual' ? '$15.00' : '$20.00'}
                  </span>
                  <span className="text-sm font-medium text-neutral-400">/ month</span>
                </div>
                {billingCycle === 'annual' && (
                  <p className="mt-1 text-xs text-neutral-400 font-medium">
                    $180.00 billed annually (save 25%)
                  </p>
                )}

                <p className="mt-3 text-sm text-neutral-300 leading-relaxed font-normal">
                  For established brands and high-volume sellers needing unlimited capacity, custom branding, and priority support.
                </p>

                <div className="mt-8 pt-6 border-t border-neutral-800 space-y-3.5 text-sm font-medium text-neutral-200">
                  <div className="flex items-center gap-3">
                    <Check size={16} className="text-[#F5B418] shrink-0" strokeWidth={2.5} />
                    <span><strong>Everything in Pro</strong>, plus:</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Check size={16} className="text-[#F5B418] shrink-0" strokeWidth={2.5} />
                    <span><strong>Unlimited</strong> catalog products &amp; categories</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Check size={16} className="text-[#F5B418] shrink-0" strokeWidth={2.5} />
                    <span><strong>Custom store branding</strong> (logo, banner, colors)</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Check size={16} className="text-[#F5B418] shrink-0" strokeWidth={2.5} />
                    <span>Customer CRM with VIP repeat-buyer tags</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Check size={16} className="text-[#F5B418] shrink-0" strokeWidth={2.5} />
                    <span>Advanced profit margin &amp; expense breakdown</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Check size={16} className="text-[#F5B418] shrink-0" strokeWidth={2.5} />
                    <span>Multi-currency display for international buyers</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Check size={16} className="text-[#F5B418] shrink-0" strokeWidth={2.5} />
                    <span><strong>Priority WhatsApp &amp; Concierge Support</strong></span>
                  </div>
                </div>
              </div>

              <div className="mt-10">
                <Link
                  href={`/sign-up?plan=pro_plus&cycle=${billingCycle}`}
                  className="w-full py-4 rounded-full bg-white text-neutral-950 text-sm font-bold hover:bg-neutral-100 transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                >
                  <span>Start 7-Day Free Trial</span>
                  <ArrowRight size={14} className="text-neutral-950" />
                </Link>
                <p className="mt-2.5 text-center text-xs text-neutral-400">
                  Includes full 7-day trial • Cancel anytime
                </p>
              </div>
            </div>
          </div>

          {/* Paddle Security Note */}
          <div className="mt-12 text-center text-xs text-neutral-500 max-w-xl mx-auto flex items-center justify-center gap-2">
            <Lock size={13} className="text-neutral-400 shrink-0" />
            <span>
              Secure billing handled by Paddle. Zero hidden transaction fees. Cancel anytime in one click.
            </span>
          </div>
        </div>
      </section>

      {/* ── 7. Frequently Asked Questions ── */}
      <section id="faqs" className="py-24 sm:py-32 bg-white border-t border-neutral-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-500 mb-2 block">
              Support &amp; Answers
            </span>
            <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-neutral-900">
              Frequently Asked Questions
            </h2>
            <p className="mt-3 text-base text-neutral-600 font-normal">
              Everything you need to know about setting up Take Order for your store.
            </p>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={idx}
                  className="rounded-2xl border border-neutral-200 bg-white overflow-hidden transition-all"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full p-6 text-left flex items-center justify-between gap-4 font-bold text-base sm:text-lg text-neutral-800 hover:text-neutral-950 cursor-pointer"
                  >
                    <span>{faq.q}</span>
                    <ChevronDown
                      size={18}
                      className={`text-neutral-400 shrink-0 transition-transform duration-200 ${
                        isOpen ? 'rotate-180 text-black' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-6 pb-6 text-sm text-neutral-600 leading-relaxed border-t border-neutral-100 pt-4">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── 8. Pre-Footer Call to Action ── */}
      <section className="py-24 bg-neutral-950 text-white relative overflow-hidden">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-tight text-white">
            Over 70% of social media sellers lose orders to messy DMs and chaotic order tracking.
          </h2>
          <p className="mt-5 text-neutral-300 text-base sm:text-lg max-w-2xl mx-auto font-normal leading-relaxed">
            Take Order replaces manual chat confusion with 1-tap order links, organized order slips, and automated stock reservation.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/sign-up"
              className="w-full sm:w-auto px-8 py-4 rounded-full bg-white text-neutral-950 text-base font-bold hover:bg-neutral-200 transition-all shadow-lg hover:scale-105 active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Start Your 7-Day Free Trial</span>
              <ArrowRight size={16} />
            </Link>
            <button
              type="button"
              onClick={() => scrollToSection('pricing')}
              className="w-full sm:w-auto px-8 py-4 rounded-full bg-neutral-900 border border-neutral-800 text-white text-base font-semibold hover:bg-neutral-800 transition-all cursor-pointer"
            >
              View Pricing
            </button>
          </div>
        </div>
      </section>

      {/* ── 9. Expanded Footer ── */}
      <footer className="bg-white border-t border-neutral-200 py-24 sm:py-28 text-neutral-600 text-sm">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-10">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-12 lg:gap-16">
            {/* Brand column */}
            <div className="md:col-span-5 space-y-6">
              <Link href="/" className="inline-flex items-center gap-3 group cursor-pointer">
                <img
                  src="/branding/takeorder-icon.png"
                  alt="Take Order"
                  className="h-10 w-10 rounded-xl object-contain shadow-xs"
                />
                <span className="font-bold tracking-tight text-2xl text-neutral-900">
                  Take Order
                </span>
              </Link>
              <p className="text-sm text-neutral-500 max-w-sm leading-relaxed font-normal">
                The all-in-one order management and social commerce software platform for independent sellers. Generate instant order links, track inventory stock, and manage customer dispatch records.
              </p>
              <div className="pt-2 text-xs text-neutral-400 space-y-1">
                <p>
                  Support:{' '}
                  <a
                    href="mailto:support@usetakeorder.app"
                    className="text-neutral-900 font-semibold underline underline-offset-2"
                  >
                    support@usetakeorder.app
                  </a>
                </p>
                <p className="text-[11px] text-neutral-500">
                  Take Order is a B2B Software-as-a-Service (SaaS) order &amp; inventory tracking platform.
                </p>
                <p className="text-[11px] text-neutral-500">
                  Subscription orders are processed by our Merchant of Record, Paddle.com.
                </p>
              </div>
            </div>

            {/* Navigation Columns */}
            <div className="md:col-span-7 grid grid-cols-2 sm:grid-cols-3 gap-8 sm:gap-12">
              {/* Product Links */}
              <div>
                <p className="font-bold text-xs uppercase tracking-wider text-neutral-700 mb-5">
                  Product
                </p>
                <ul className="space-y-3.5 text-sm text-neutral-500 font-medium">
                  <li>
                    <button
                      type="button"
                      onClick={() => scrollToSection('features')}
                      className="hover:text-neutral-900 transition-colors cursor-pointer"
                    >
                      Order Links
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => scrollToSection('features')}
                      className="hover:text-neutral-900 transition-colors cursor-pointer"
                    >
                      Order Verification
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => scrollToSection('features')}
                      className="hover:text-neutral-900 transition-colors cursor-pointer"
                    >
                      Customer CRM
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => scrollToSection('features')}
                      className="hover:text-neutral-900 transition-colors cursor-pointer"
                    >
                      Stock Management
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => scrollToSection('pricing')}
                      className="hover:text-neutral-900 transition-colors cursor-pointer"
                    >
                      Pricing
                    </button>
                  </li>
                </ul>
              </div>

              {/* Legal & Policies */}
              <div>
                <p className="font-bold text-xs uppercase tracking-wider text-neutral-700 mb-5">
                  Legal &amp; Policies
                </p>
                <ul className="space-y-3.5 text-sm text-neutral-500 font-medium">
                  <li>
                    <Link href="/terms" className="hover:text-neutral-900 transition-colors">
                      Terms of Service
                    </Link>
                  </li>
                  <li>
                    <Link href="/privacy" className="hover:text-neutral-900 transition-colors">
                      Privacy Policy
                    </Link>
                  </li>
                  <li>
                    <Link href="/refund-policy" className="hover:text-neutral-900 transition-colors">
                      Refund Policy
                    </Link>
                  </li>
                </ul>
              </div>

              {/* Account */}
              <div>
                <p className="font-bold text-xs uppercase tracking-wider text-neutral-700 mb-5">
                  Account
                </p>
                <ul className="space-y-3.5 text-sm text-neutral-500 font-medium">
                  {effectiveSignedIn ? (
                    <li>
                      <Link href="/dashboard" className="hover:text-neutral-900 transition-colors">
                        Seller Dashboard
                      </Link>
                    </li>
                  ) : (
                    <>
                      <li>
                        <Link href="/sign-in" className="hover:text-neutral-900 transition-colors">
                          Seller Sign In
                        </Link>
                      </li>
                      <li>
                        <Link href="/sign-up" className="hover:text-neutral-900 transition-colors">
                          Create Free Account
                        </Link>
                      </li>
                    </>
                  )}
                  <li>
                    <Link href="/account/billing" className="hover:text-neutral-900 transition-colors">
                      Manage Subscription
                    </Link>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div className="mt-20 pt-8 border-t border-neutral-100 flex flex-col sm:flex-row items-center justify-between text-xs text-neutral-400 gap-4">
            <p>© {new Date().getFullYear()} Take Order. All rights reserved.</p>
            <p>Built for ambitious social commerce brands worldwide.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
