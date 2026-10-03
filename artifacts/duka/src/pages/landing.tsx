import React, { useState } from 'react';
import { Link } from 'wouter';
import { useAppAuth } from '@/lib/auth-context';
import {
  Check,
  ArrowRight,
  ArrowUpRight,
  ShoppingBag,
  DollarSign,
  PackageCheck,
  Sparkles,
  Percent,
  ChevronDown,
  Menu,
  X,
  Lock,
  Instagram,
  Linkedin,
  Facebook,
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

  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const featureCards = [
    {
      icon: ShoppingBag,
      title: 'Your own online store',
      description:
        'Take orders and payments through a real storefront, mobile money and cards, without a single back-and-forth DM.',
    },
    {
      icon: DollarSign,
      title: 'Capture every sale',
      description:
        'Sell through WhatsApp with instant checkout, send payment links, and record offline sales so nothing slips through.',
    },
    {
      icon: PackageCheck,
      title: 'Stay on top of orders and stock',
      description:
        'Track every order from placed to delivered, and watch your inventory update itself as you sell.',
    },
    {
      icon: Sparkles,
      title: 'Know your business',
      description:
        "See what's selling, who your best customers are, and what each one is worth, with insights that actually help you decide.",
    },
    {
      icon: Percent,
      title: 'Run sales and bring in your team',
      description:
        'Launch promotions and coupons when you want a push, coordinate dispatch riders, and fulfill orders without missing a beat.',
    },
  ];

  const steps = [
    {
      step: '01',
      title: 'Create your store',
      description:
        'Upload your logo, pick your colors, and choose your store link. Live in minutes.',
    },
    {
      step: '02',
      title: 'Add your products',
      description:
        'Photos, prices, variants, and stock — everything your customers need to buy without asking.',
    },
    {
      step: '03',
      title: 'Share your link',
      description:
        'Customers browse, choose, and pay on their own. You get notified immediately when orders come in.',
    },
  ];

  const testimonials = [
    {
      quote:
        'What began with endless WhatsApp conversations has grown into a shopping experience designed for convenience. Now, our collections are available 24/7, so customers can shop whenever inspiration strikes.',
      author: 'Nana Adoma',
      role: 'Owner, Heels By Adoma',
    },
    {
      quote:
        "Running an online store with Take Order has been one of the best decisions for my business. My collection now works for me, even while I'm sleeping.",
      author: 'Mira',
      role: 'Owner, DivaLuxe Collections',
    },
    {
      quote:
        'I used to have to send a customer 30+ photos on WhatsApp before making a sale. Now for the first time, I can make sales while I sleep.',
      author: 'Harriet',
      role: 'Owner, Blazer World Ghana',
    },
  ];

  const faqs = [
    {
      q: 'Do my buyers need to download an app or sign up to order?',
      a: 'No! Buyers never need to download an app or create an account. When they tap your Take Order link in WhatsApp, Instagram, or TikTok, your store opens immediately in their mobile browser for a lightning-fast checkout.',
    },
    {
      q: 'How do customers complete orders with Take Order?',
      a: 'Take Order is a SaaS order management platform. Customers select products, provide delivery details, and submit their order confirmation directly to your seller dashboard. Take Order does not hold customer payments — you receive 100% of your funds directly through your own chosen accounts.',
    },
    {
      q: 'What is the difference between Pro and Pro+?',
      a: 'Pro ($9.99/mo) gives you unlimited active order links, up to 100 catalog products, automated receipts, and core sales tracking. Pro+ ($20/mo) unlocks unlimited catalog products, custom branding with your own store logo/colors, multi-currency display, customer CRM insights, and VIP concierge support.',
    },
    {
      q: 'How long is the free trial for Take Order?',
      a: 'Take Order includes a full 7-day free trial on both Pro and Pro+ plans. You can set up your catalog, generate live order links, and test real checkouts. You will not be charged during the trial, and you can cancel anytime with one click in your account settings.',
    },
    {
      q: 'Can I cancel my subscription at any time?',
      a: 'Yes, absolutely. There are no long-term contracts or cancellation penalties. You can manage or cancel your subscription at any time with a single click inside your Account Billing settings.',
    },
    {
      q: 'How do I share my order links on social media?',
      a: 'Take Order generates custom short links for your entire store (e.g. usetakeorder.app/store/yourbrand) as well as specific single-product links. You can paste them into your Instagram bio, WhatsApp Status, TikTok link-in-bio, or directly in customer DMs.',
    },
  ];

  return (
    <div
      data-route="/"
      className="min-h-screen bg-white text-neutral-900 font-sans selection:bg-blue-600 selection:text-white antialiased"
    >
      {/* ── 1. Top Header / Navigation ── */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-neutral-200/80 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3 group cursor-pointer">
            <img
              src="/branding/takeorder-icon.png"
              alt="Take Order"
              className="h-9 w-9 rounded-xl object-contain shadow-xs group-hover:scale-105 transition-transform"
            />
            <span className="font-bold tracking-tight text-xl leading-none text-neutral-950">
              Take Order
            </span>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-8 text-[14px] font-medium text-neutral-600">
            <button
              type="button"
              onClick={() => scrollToSection('features')}
              className="hover:text-neutral-950 transition-colors cursor-pointer"
            >
              Features
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
              onClick={() => scrollToSection('stories')}
              className="hover:text-neutral-950 transition-colors cursor-pointer"
            >
              Stories
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
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-neutral-950 text-white text-sm font-semibold hover:bg-neutral-800 shadow-xs transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <span>Open Dashboard</span>
                <ArrowRight size={14} className="text-blue-400" />
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
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-neutral-950 text-white text-sm font-semibold hover:bg-neutral-800 shadow-xs transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  <span>Start 7-Day Trial</span>
                  <ArrowRight size={14} className="text-blue-400" />
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
              aria-label="Toggle navigation menu"
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
              Features
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
              onClick={() => scrollToSection('stories')}
              className="block w-full text-left py-2 text-sm font-semibold text-neutral-700 hover:text-neutral-950"
            >
              Stories
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

      {/* ── 2. Hero Section (Glolly Style Clean Layout + Sales Banner Showcase) ── */}
      <section className="relative pt-12 pb-20 sm:pt-20 sm:pb-28 overflow-hidden bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {/* Subtle Tag */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-xs font-semibold mb-6">
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
            <span>Built for how social sellers actually sell</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-neutral-950 leading-[1.1] max-w-4xl mx-auto">
            Your customers don't have to DM you to buy.
          </h1>

          {/* Subtitle */}
          <p className="mt-6 text-lg sm:text-xl text-neutral-600 max-w-2xl mx-auto font-normal leading-relaxed">
            Take Order is the online storefront and order manager for WhatsApp, Instagram, and TikTok sellers. Real storefront, payments, and delivery built in. Customers buy on their own. You run your business.
          </p>

          {/* Action CTAs */}
          <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3.5">
            {effectiveSignedIn ? (
              <Link
                href="/dashboard"
                className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-neutral-950 text-white text-sm font-bold hover:bg-neutral-800 transition-all flex items-center justify-center gap-2 shadow-xs hover:scale-[1.02] active:scale-[0.98]"
              >
                <span>Open Seller Dashboard</span>
                <ArrowRight size={15} className="text-blue-400" />
              </Link>
            ) : (
              <Link
                href="/sign-up"
                className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-neutral-950 text-white text-sm font-bold hover:bg-neutral-800 transition-all flex items-center justify-center gap-2 shadow-xs hover:scale-[1.02] active:scale-[0.98]"
              >
                <span>Start 7-Day Free Trial</span>
                <ArrowRight size={15} className="text-blue-400" />
              </Link>
            )}
            <button
              type="button"
              onClick={() => scrollToSection('features')}
              className="w-full sm:w-auto px-7 py-3.5 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-sm font-semibold transition-all cursor-pointer"
            >
              See How It Works
            </button>
          </div>

          {/* Trust points */}
          <p className="mt-4 text-xs text-neutral-400 flex items-center justify-center gap-3">
            <span>7-day free trial</span>
            <span>•</span>
            <span>No credit card needed</span>
            <span>•</span>
            <span>Cancel anytime</span>
          </p>

          {/* ── Sales Banner Showcase (User Uploaded High-Detail Photo with Floating Card) ── */}
          <div className="mt-12 sm:mt-16 max-w-4xl mx-auto relative group">
            <div className="relative rounded-3xl sm:rounded-[36px] overflow-hidden bg-neutral-950 border border-neutral-200/90 shadow-2xl">
              <img
                src="/illustrations/sales-banner.jpg"
                alt="Take Order seller in cafe with phone, branded bag and live sales report"
                className="w-full h-auto max-h-[560px] object-cover object-center transform group-hover:scale-[1.01] transition-transform duration-700"
              />
              <div className="absolute top-4 sm:top-6 right-4 sm:right-6 hidden sm:flex items-center gap-2 px-4 py-2 rounded-full bg-white/95 backdrop-blur-md shadow-md border border-neutral-200/80 text-neutral-950 text-xs font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Live Storefront Active</span>
              </div>
            </div>
          </div>

          {/* ── Quick Glolly-Style Metrics Ribbon ── */}
          <div className="mt-10 sm:mt-12 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto text-left">
            <div className="p-5 rounded-2xl bg-neutral-50 border border-neutral-200/70">
              <p className="text-2xl sm:text-3xl font-black text-neutral-950 tracking-tight">2 min</p>
              <p className="text-xs text-neutral-500 font-medium mt-1">Setup time from your phone</p>
            </div>
            <div className="p-5 rounded-2xl bg-neutral-50 border border-neutral-200/70">
              <p className="text-2xl sm:text-3xl font-black text-neutral-950 tracking-tight">0%</p>
              <p className="text-xs text-neutral-500 font-medium mt-1">Zero commission on orders</p>
            </div>
            <div className="p-5 rounded-2xl bg-neutral-50 border border-neutral-200/70">
              <p className="text-2xl sm:text-3xl font-black text-neutral-950 tracking-tight">24/7</p>
              <p className="text-xs text-neutral-500 font-medium mt-1">Automatic order capture</p>
            </div>
            <div className="p-5 rounded-2xl bg-neutral-50 border border-neutral-200/70">
              <p className="text-2xl sm:text-3xl font-black text-neutral-950 tracking-tight">100%</p>
              <p className="text-xs text-neutral-500 font-medium mt-1">Direct to your MoMo or bank</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. Feature Section: "Built for how you actually sell" (Glolly Layout & Style) ── */}
      <section id="features" className="py-24 sm:py-32 bg-white border-t border-neutral-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Section Header */}
          <div className="text-center max-w-3xl mx-auto mb-16 sm:mb-20">
            <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-neutral-950">
              Built for how you actually sell
            </h2>
            <p className="mt-4 text-base sm:text-lg text-neutral-600 font-normal leading-relaxed">
              Storefront, WhatsApp, payment links, offline, Take Order captures every sale, then helps you manage what comes next.
            </p>
          </div>

          {/* Cards Grid: 2 Large Cards on Top, 3 Large Cards on Bottom */}
          <div className="space-y-6 lg:space-y-8">
            {/* Top Row: 2 Large Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
              {featureCards.slice(0, 2).map((card, idx) => {
                const IconComponent = card.icon;
                return (
                  <div
                    key={idx}
                    className="p-8 sm:p-12 rounded-3xl bg-[#F8FAFB] border border-[#E5E9EB] hover:border-neutral-300 transition-all shadow-2xs flex flex-col justify-between"
                  >
                    <div>
                      {/* Clean Icon Badge (Glolly Emerald/Green Pill) */}
                      <div className="w-12 h-12 rounded-2xl bg-[#EDFCF4] text-[#12A066] flex items-center justify-center mb-6">
                        <IconComponent size={24} strokeWidth={2.2} />
                      </div>
                      <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-950 mb-3">
                        {card.title}
                      </h3>
                      <p className="text-base text-neutral-600 leading-relaxed font-normal">
                        {card.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom Row: 3 Large Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
              {featureCards.slice(2).map((card, idx) => {
                const IconComponent = card.icon;
                return (
                  <div
                    key={idx}
                    className="p-8 sm:p-10 rounded-3xl bg-[#F8FAFB] border border-[#E5E9EB] hover:border-neutral-300 transition-all shadow-2xs flex flex-col justify-between"
                  >
                    <div>
                      {/* Clean Icon Badge */}
                      <div className="w-12 h-12 rounded-2xl bg-[#EDFCF4] text-[#12A066] flex items-center justify-center mb-6">
                        <IconComponent size={24} strokeWidth={2.2} />
                      </div>
                      <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-950 mb-3">
                        {card.title}
                      </h3>
                      <p className="text-sm sm:text-base text-neutral-600 leading-relaxed font-normal">
                        {card.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ── 4. Section: "Here's how it works" (Glolly 3-Step Simple Flow) ── */}
      <section id="how-it-works" className="py-24 sm:py-32 bg-[#F9FBFA] border-t border-neutral-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16 sm:mb-20">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-500 mb-2 block">
              Live in minutes
            </span>
            <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-neutral-950">
              Here's how it works
            </h2>
            <p className="mt-4 text-base sm:text-lg text-neutral-600 font-normal">
              Create your online store in under 5 minutes. Start taking orders today.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
            {steps.map((item, idx) => (
              <div
                key={idx}
                className="p-8 sm:p-10 rounded-3xl bg-white border border-[#E5E9EB] hover:border-neutral-300 transition-all shadow-2xs flex flex-col justify-between"
              >
                <div>
                  <span className="inline-block text-xs font-bold text-neutral-500 bg-neutral-100 px-3 py-1 rounded-full mb-6">
                    Step {item.step}
                  </span>
                  <h3 className="text-xl sm:text-2xl font-bold text-neutral-950 mb-3">
                    {item.title}
                  </h3>
                  <p className="text-sm sm:text-base text-neutral-600 leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 5. Section: Seller Testimonials ("Real businesses use Take Order everyday") ── */}
      <section id="stories" className="py-24 sm:py-32 bg-white border-t border-neutral-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16 sm:mb-20">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-500 mb-2 block">
              From the people already selling
            </span>
            <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-neutral-950">
              Real businesses use Take Order everyday
            </h2>
            <p className="mt-4 text-base sm:text-lg text-neutral-600 font-normal">
              Hear how independent sellers put an end to messy DM negotiations.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
            {testimonials.map((t, idx) => (
              <div
                key={idx}
                className="p-8 sm:p-10 rounded-3xl bg-[#F8FAFB] border border-[#E5E9EB] hover:border-neutral-300 transition-all shadow-2xs flex flex-col justify-between"
              >
                <p className="text-base text-neutral-700 leading-relaxed font-normal mb-8">
                  "{t.quote}"
                </p>
                <div className="pt-4 border-t border-neutral-200/80">
                  <p className="font-bold text-sm text-neutral-950">{t.author}</p>
                  <p className="text-xs text-neutral-500 mt-0.5">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 6. Pricing Section (Two Paywalls: Pro and Pro+ with Paddle Compliance) ── */}
      <section id="pricing" className="py-24 sm:py-32 bg-[#F9FBFA] border-t border-neutral-200/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-neutral-950">
              Simple, transparent pricing
            </h2>
            <p className="mt-4 text-base sm:text-lg text-neutral-600 font-normal">
              Zero commissions on your sales. Take Order never touches your customer funds. Cancel anytime.
            </p>

            {/* Billing Cycle Toggle */}
            <div className="mt-8 flex items-center justify-center">
              <div className="inline-flex items-center p-1 rounded-full bg-neutral-200/70 border border-neutral-300">
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
                  <span>Yearly</span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      billingCycle === 'annual'
                        ? 'bg-blue-400 text-neutral-950'
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
            <div className="rounded-3xl bg-white border border-[#E5E9EB] p-8 sm:p-10 shadow-xs flex flex-col justify-between hover:border-neutral-400 transition-all">
              <div>
                <div className="flex items-center justify-between">
                  <span className="px-3 py-1 rounded-full bg-neutral-100 text-neutral-800 text-xs font-bold uppercase tracking-wider">
                    Pro
                  </span>
                  <span className="text-xs text-neutral-500 font-medium">
                    {billingCycle === 'annual' ? 'Billed annually' : 'Billed monthly'}
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
                    <span>Unlimited active order links &amp; checkouts</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Check size={16} className="text-neutral-950 shrink-0" strokeWidth={2.5} />
                    <span>Up to 100 catalog products</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Check size={16} className="text-neutral-950 shrink-0" strokeWidth={2.5} />
                    <span>Automated customer order receipt capture</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Check size={16} className="text-neutral-950 shrink-0" strokeWidth={2.5} />
                    <span>WhatsApp &amp; SMS customer receipt templates</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Check size={16} className="text-neutral-950 shrink-0" strokeWidth={2.5} />
                    <span>Real-time inventory stock reservation</span>
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
                  <ArrowRight size={14} className="text-blue-400" />
                </Link>
                <p className="mt-2.5 text-center text-xs text-neutral-400">
                  Full 7-day trial • Cancel anytime
                </p>
              </div>
            </div>

            {/* Pro+ Plan (Featured) */}
            <div className="rounded-3xl bg-neutral-950 text-white border-2 border-neutral-800 p-8 sm:p-10 shadow-xl flex flex-col justify-between relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-blue-600 text-white text-[11px] font-bold uppercase tracking-wider px-4 py-1 rounded-bl-xl shadow-xs">
                Most Popular
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <span className="px-3 py-1 rounded-full bg-neutral-800 text-white text-xs font-bold uppercase tracking-wider border border-neutral-700">
                    Pro+
                  </span>
                  <span className="text-xs text-neutral-400 font-medium">
                    {billingCycle === 'annual' ? 'Billed annually' : 'Billed monthly'}
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
                    <Check size={16} className="text-blue-400 shrink-0" strokeWidth={2.5} />
                    <span>Everything in Pro, plus:</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Check size={16} className="text-blue-400 shrink-0" strokeWidth={2.5} />
                    <span>Unlimited catalog products &amp; categories</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Check size={16} className="text-blue-400 shrink-0" strokeWidth={2.5} />
                    <span>Custom store branding (logo, banner, colors)</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Check size={16} className="text-blue-400 shrink-0" strokeWidth={2.5} />
                    <span>Customer CRM with VIP repeat-buyer tags</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Check size={16} className="text-blue-400 shrink-0" strokeWidth={2.5} />
                    <span>Advanced profit margin &amp; expense breakdown</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Check size={16} className="text-blue-400 shrink-0" strokeWidth={2.5} />
                    <span>Multi-currency display for global shoppers</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Check size={16} className="text-blue-400 shrink-0" strokeWidth={2.5} />
                    <span>Priority WhatsApp Concierge support</span>
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
                  Full 7-day trial • Cancel anytime
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
      <section id="faqs" className="py-24 sm:py-32 bg-white border-t border-neutral-200/80">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-neutral-950">
              Frequently asked questions
            </h2>
            <p className="mt-3 text-base text-neutral-600 font-normal">
              Find answers to the most common questions about using Take Order.
            </p>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={idx}
                  className="rounded-2xl border border-neutral-200/90 bg-white overflow-hidden transition-all"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full p-6 text-left flex items-center justify-between gap-4 font-bold text-base sm:text-lg text-neutral-900 hover:text-neutral-950 cursor-pointer"
                  >
                    <span>{faq.q}</span>
                    <ChevronDown
                      size={18}
                      className={`text-neutral-400 shrink-0 transition-transform duration-200 ${
                        isOpen ? 'rotate-180 text-neutral-900' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-6 pb-6 text-sm sm:text-base text-neutral-600 leading-relaxed border-t border-neutral-100 pt-4">
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
      <section className="py-24 sm:py-28 bg-[#102832] text-white relative overflow-hidden">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
            Ready to give your business a real store?
          </h2>
          <p className="mt-5 text-neutral-300 text-base sm:text-lg max-w-2xl mx-auto font-normal leading-relaxed">
            Join hundreds of ambitious sellers turning social media traffic into organized, automated orders.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/sign-up"
              className="w-full sm:w-auto px-8 py-4 rounded-full bg-white text-neutral-950 text-base font-bold hover:bg-neutral-100 transition-all shadow-lg hover:scale-105 active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Start 7-Day Free Trial</span>
              <ArrowRight size={16} />
            </Link>
            <button
              type="button"
              onClick={() => scrollToSection('pricing')}
              className="w-full sm:w-auto px-8 py-4 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white text-base font-semibold transition-all cursor-pointer"
            >
              View Pricing
            </button>
          </div>
        </div>
      </section>

      {/* ── 9. Glolly-Style Dark Slate/Teal Footer (Screenshot Replica) ── */}
      <footer className="bg-[#112b36] text-white pt-20 pb-12 sm:pt-24 sm:pb-16 relative overflow-hidden border-t border-white/10">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-10 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-12 lg:gap-16 pb-16 border-b border-white/10">
            {/* Brand Column */}
            <div className="md:col-span-6 space-y-6">
              <Link href="/" className="inline-flex items-center gap-3 group cursor-pointer">
                <img
                  src="/branding/takeorder-icon.png"
                  alt="Take Order"
                  className="h-10 w-10 rounded-xl object-contain shadow-xs"
                />
                <span className="font-bold tracking-tight text-2xl text-white">
                  Take Order
                </span>
              </Link>
              <p className="text-sm text-neutral-300 max-w-md leading-relaxed font-normal">
                Running a business from your DMs is hard enough. Take Order gives you a real online store with Mobile Money (MoMo) and card payments built in so the orders, payments, and chaos finally sort themselves out.
              </p>

              {/* Social Links */}
              <div className="pt-2">
                <p className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-3">
                  Social
                </p>
                <div className="flex items-center gap-3">
                  <a
                    href="https://facebook.com"
                    target="_blank"
                    rel="noreferrer"
                    className="w-9 h-9 rounded-full border border-white/20 flex items-center justify-center text-neutral-300 hover:text-white hover:border-white transition-colors"
                    aria-label="Facebook"
                  >
                    <Facebook size={16} />
                  </a>
                  <a
                    href="https://linkedin.com"
                    target="_blank"
                    rel="noreferrer"
                    className="w-9 h-9 rounded-full border border-white/20 flex items-center justify-center text-neutral-300 hover:text-white hover:border-white transition-colors"
                    aria-label="LinkedIn"
                  >
                    <Linkedin size={16} />
                  </a>
                  <a
                    href="https://instagram.com"
                    target="_blank"
                    rel="noreferrer"
                    className="w-9 h-9 rounded-full border border-white/20 flex items-center justify-center text-neutral-300 hover:text-white hover:border-white transition-colors"
                    aria-label="Instagram"
                  >
                    <Instagram size={16} />
                  </a>
                  <a
                    href="https://x.com"
                    target="_blank"
                    rel="noreferrer"
                    className="w-9 h-9 rounded-full border border-white/20 flex items-center justify-center text-neutral-300 hover:text-white hover:border-white transition-colors font-bold text-xs"
                    aria-label="X (formerly Twitter)"
                  >
                    𝕏
                  </a>
                </div>
              </div>
            </div>

            {/* Navigation Columns */}
            <div className="md:col-span-6 grid grid-cols-2 gap-8 sm:gap-12 md:pl-10">
              {/* Main Pages */}
              <div>
                <p className="font-bold text-sm text-white mb-5">
                  Main Pages
                </p>
                <ul className="space-y-3.5 text-sm text-neutral-300 font-normal">
                  <li>
                    <button
                      type="button"
                      onClick={() => scrollToSection('features')}
                      className="hover:text-white transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <span>Home</span>
                      <ArrowUpRight size={14} className="text-neutral-400" />
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => scrollToSection('how-it-works')}
                      className="hover:text-white transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <span>How it works</span>
                      <ArrowUpRight size={14} className="text-neutral-400" />
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => scrollToSection('pricing')}
                      className="hover:text-white transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <span>Pricing</span>
                      <ArrowUpRight size={14} className="text-neutral-400" />
                    </button>
                  </li>
                  <li>
                    {effectiveSignedIn ? (
                      <Link
                        href="/dashboard"
                        className="hover:text-white transition-colors flex items-center gap-1"
                      >
                        <span>Seller Dashboard</span>
                        <ArrowUpRight size={14} className="text-neutral-400" />
                      </Link>
                    ) : (
                      <Link
                        href="/sign-in"
                        className="hover:text-white transition-colors flex items-center gap-1"
                      >
                        <span>Sign In</span>
                        <ArrowUpRight size={14} className="text-neutral-400" />
                      </Link>
                    )}
                  </li>
                </ul>
              </div>

              {/* Company & Legal */}
              <div>
                <p className="font-bold text-sm text-white mb-5">
                  Company
                </p>
                <ul className="space-y-3.5 text-sm text-neutral-300 font-normal">
                  <li>
                    <Link
                      href="/terms"
                      className="hover:text-white transition-colors flex items-center gap-1"
                    >
                      <span>Terms &amp; Condition</span>
                      <ArrowUpRight size={14} className="text-neutral-400" />
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/privacy"
                      className="hover:text-white transition-colors flex items-center gap-1"
                    >
                      <span>Privacy Policy</span>
                      <ArrowUpRight size={14} className="text-neutral-400" />
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/refund-policy"
                      className="hover:text-white transition-colors flex items-center gap-1"
                    >
                      <span>Refund Policy</span>
                      <ArrowUpRight size={14} className="text-neutral-400" />
                    </Link>
                  </li>
                  <li>
                    <a
                      href="mailto:support@usetakeorder.app"
                      className="hover:text-white transition-colors flex items-center gap-1"
                    >
                      <span>Contact</span>
                      <ArrowUpRight size={14} className="text-neutral-400" />
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Faint Background Watermark like in Glolly Screenshot */}
          <div className="pt-8 select-none pointer-events-none">
            <span className="text-6xl sm:text-8xl lg:text-9xl font-black text-white/[0.04] tracking-wider block font-sans">
              TAKE ORDER
            </span>
          </div>

          {/* Bottom Bar */}
          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-neutral-400 gap-4">
            <p>
              Copyright © 2026 Take Order Technologies Ltd. All Rights Reserved.
            </p>
            <p>
              Made in Ghana With Love
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
