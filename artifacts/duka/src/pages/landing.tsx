import React, { useState } from 'react';
import { Link } from 'wouter';
import {
  Check,
  ArrowRight,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Zap,
  BarChart3,
  Truck,
  MessageSquare,
  FileText,
  Shield,
  RefreshCw,
  Mail,
  ChevronRight,
  Menu,
  X,
  CreditCard,
  Lock,
} from 'lucide-react';

export function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [billingPeriod, setBillingPeriod] = useState<'annual' | 'monthly'>('annual');

  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-neutral-900 font-sans selection:bg-amber-100 selection:text-amber-900">
      {/* ── Top Header / Navigation ── */}
      <header className="sticky top-0 z-50 bg-[#FDFBF7]/95 backdrop-blur-md border-b border-neutral-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2.5 group cursor-pointer">
            <div className="h-9 w-9 rounded-xl bg-neutral-900 flex items-center justify-center text-white font-extrabold text-lg shadow-xs group-hover:bg-neutral-800 transition-colors">
              T
            </div>
            <span className="font-black tracking-tight text-xl text-neutral-950">
              Take<span className="text-[#F5B418]">Order</span>
            </span>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-neutral-600">
            <button
              type="button"
              onClick={() => scrollToSection('features')}
              className="hover:text-neutral-950 transition-colors cursor-pointer"
            >
              Features
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('pricing')}
              className="hover:text-neutral-950 transition-colors cursor-pointer"
            >
              Pricing
            </button>
            <Link href="/terms" className="hover:text-neutral-950 transition-colors">
              Terms of Service
            </Link>
            <Link href="/privacy" className="hover:text-neutral-950 transition-colors">
              Privacy Policy
            </Link>
            <Link href="/refund-policy" className="hover:text-neutral-950 transition-colors">
              Refund Policy
            </Link>
          </nav>

          {/* Action CTAs */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              href="/sign-in"
              className="px-4 py-2 rounded-xl text-sm font-semibold text-neutral-700 hover:text-neutral-950 hover:bg-neutral-100/80 transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-neutral-950 text-white text-sm font-semibold hover:bg-neutral-800 shadow-xs transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <span>Get Started</span>
              <ArrowRight size={14} />
            </Link>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center gap-2">
            <Link
              href="/sign-in"
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-neutral-950 text-white"
            >
              Sign In
            </Link>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-neutral-700 hover:bg-neutral-100"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden border-b border-neutral-200 bg-[#FDFBF7] px-4 pt-3 pb-6 space-y-3">
            <button
              type="button"
              onClick={() => scrollToSection('features')}
              className="block w-full text-left py-2 text-sm font-semibold text-neutral-800"
            >
              Features
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('pricing')}
              className="block w-full text-left py-2 text-sm font-semibold text-neutral-800"
            >
              Pricing
            </button>
            <Link href="/terms" className="block py-2 text-sm font-semibold text-neutral-800">
              Terms of Service
            </Link>
            <Link href="/privacy" className="block py-2 text-sm font-semibold text-neutral-800">
              Privacy Policy
            </Link>
            <Link href="/refund-policy" className="block py-2 text-sm font-semibold text-neutral-800">
              Refund Policy
            </Link>
            <div className="pt-2">
              <Link
                href="/sign-up"
                className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-neutral-950 text-white text-sm font-semibold shadow-xs"
              >
                <span>Create Free Seller Account</span>
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* ── Hero Section ── */}
      <section className="relative pt-16 pb-20 sm:pt-24 sm:pb-28 overflow-hidden">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-900 text-xs font-bold uppercase tracking-wider mb-6">
            <Sparkles size={14} className="text-amber-600" />
            <span>Modern Workspace for Solo Merchants</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-neutral-950 leading-[1.1] mb-6">
            Turn chat conversations into confirmed orders in seconds.
          </h1>

          <p className="text-lg sm:text-xl text-neutral-600 max-w-3xl mx-auto leading-relaxed mb-10">
            Take Order gives social commerce sellers one unified workspace to manage catalogs, generate
            instant multi-item checkout links for WhatsApp & Instagram, track deliveries, and log business expenses.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/sign-up"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-2xl bg-neutral-950 text-white text-base font-bold hover:bg-neutral-800 shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              <span>Start 7-Day Free Trial</span>
              <ArrowRight size={16} />
            </Link>
            <button
              type="button"
              onClick={() => scrollToSection('pricing')}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl border border-neutral-300 bg-white text-base font-semibold text-neutral-800 hover:bg-neutral-50 shadow-2xs transition-all cursor-pointer"
            >
              <span>View Plans & Pricing</span>
            </button>
          </div>

          {/* Trust badges */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-6 sm:gap-10 text-xs font-semibold text-neutral-500">
            <div className="flex items-center gap-2">
              <Check size={16} className="text-emerald-600 stroke-[3]" />
              <span>7-Day Free Trial on Paid Plans</span>
            </div>
            <div className="flex items-center gap-2">
              <Check size={16} className="text-emerald-600 stroke-[3]" />
              <span>Cancel Anytime</span>
            </div>
            <div className="flex items-center gap-2">
              <Check size={16} className="text-emerald-600 stroke-[3]" />
              <span>14-Day Money-Back Guarantee</span>
            </div>
            <div className="flex items-center gap-2">
              <Lock size={14} className="text-neutral-500" />
              <span>Secure Billing via Paddle</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Product Features Grid ── */}
      <section id="features" className="py-20 bg-white border-y border-neutral-200/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-xs font-bold uppercase tracking-widest text-amber-700 mb-2">
              Built for Modern Commerce
            </h2>
            <p className="text-3xl sm:text-4xl font-extrabold tracking-tight text-neutral-950">
              Everything you need to run your shop without the chaos.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="p-8 rounded-2xl bg-[#FDFBF7] border border-neutral-200/80 shadow-xs flex flex-col justify-between">
              <div>
                <div className="h-12 w-12 rounded-xl bg-amber-500/10 text-amber-800 flex items-center justify-center mb-6">
                  <ShoppingBag size={24} />
                </div>
                <h3 className="text-xl font-bold text-neutral-950 mb-3">
                  Visual Product Catalog
                </h3>
                <p className="text-sm text-neutral-600 leading-relaxed">
                  Manage inventory, pricing, item options, and multiple high-resolution photos. Keep your stock on hand organized in one clear dashboard.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-neutral-200/60 text-xs font-semibold text-neutral-500">
                Variants · Photo Uploads · Stock Alerts
              </div>
            </div>

            {/* Feature 2 */}
            <div className="p-8 rounded-2xl bg-[#FDFBF7] border border-neutral-200/80 shadow-xs flex flex-col justify-between">
              <div>
                <div className="h-12 w-12 rounded-xl bg-amber-500/10 text-amber-800 flex items-center justify-center mb-6">
                  <MessageSquare size={24} />
                </div>
                <h3 className="text-xl font-bold text-neutral-950 mb-3">
                  Instant Order Links
                </h3>
                <p className="text-sm text-neutral-600 leading-relaxed">
                  Generate polished, custom checkout links for buyers chatting on WhatsApp, Instagram, or TikTok. Buyers confirm address, delivery, and payment terms in one tap.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-neutral-200/60 text-xs font-semibold text-neutral-500">
                Multi-Item · WhatsApp Slips · Zero App Install for Buyers
              </div>
            </div>

            {/* Feature 3 */}
            <div className="p-8 rounded-2xl bg-[#FDFBF7] border border-neutral-200/80 shadow-xs flex flex-col justify-between">
              <div>
                <div className="h-12 w-12 rounded-xl bg-amber-500/10 text-amber-800 flex items-center justify-center mb-6">
                  <BarChart3 size={24} />
                </div>
                <h3 className="text-xl font-bold text-neutral-950 mb-3">
                  Real Sales & Profit Insights
                </h3>
                <p className="text-sm text-neutral-600 leading-relaxed">
                  Log your daily shop expenses (packaging, courier, ads) and see true net profit. Understand which sales channels convert highest week-over-week.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-neutral-200/60 text-xs font-semibold text-neutral-500">
                Channel Conversion · Profit Margins · CSV Export
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Pricing & Plans Section (Paddle Mandatory) ── */}
      <section id="pricing" className="py-20 sm:py-28 bg-[#FDFBF7]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h2 className="text-xs font-bold uppercase tracking-widest text-amber-700 mb-2">
              Transparent Subscription Pricing
            </h2>
            <p className="text-3xl sm:text-4xl font-extrabold tracking-tight text-neutral-950 mb-4">
              Simple, predictable plans for growing merchants.
            </p>
            <p className="text-sm text-neutral-600">
              Start with our 7-day free trial on paid plans. Subscriptions renew automatically and can be cancelled anytime with a single click.
            </p>

            {/* Billing toggle */}
            <div className="mt-8 inline-flex items-center rounded-xl p-1 bg-neutral-200/70">
              <button
                type="button"
                onClick={() => setBillingPeriod('annual')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  billingPeriod === 'annual'
                    ? 'bg-white text-neutral-950 shadow-2xs'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                Annual Billing (Save ~25%)
              </button>
              <button
                type="button"
                onClick={() => setBillingPeriod('monthly')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  billingPeriod === 'monthly'
                    ? 'bg-white text-neutral-950 shadow-2xs'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                Monthly Billing
              </button>
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-8 items-stretch">
            {/* Free Tier */}
            <div className="rounded-3xl p-8 bg-white border border-neutral-200 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-neutral-950">Starter</h3>
                  <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-neutral-100 text-neutral-600">
                    Free
                  </span>
                </div>
                <div className="mb-6">
                  <span className="text-4xl font-black text-neutral-950">$0</span>
                  <span className="text-xs text-neutral-500 ml-1">/ forever</span>
                  <p className="text-xs text-neutral-500 mt-1">Perfect for trying out order links</p>
                </div>
                <div className="space-y-3 mb-8 text-sm text-neutral-700">
                  <div className="flex items-center gap-2.5">
                    <Check size={16} className="text-emerald-600 stroke-[3] shrink-0" />
                    <span>Up to 5 catalog products</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check size={16} className="text-emerald-600 stroke-[3] shrink-0" />
                    <span>3 active Take Order checkout links</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check size={16} className="text-emerald-600 stroke-[3] shrink-0" />
                    <span>WhatsApp customer order slips</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check size={16} className="text-emerald-600 stroke-[3] shrink-0" />
                    <span>Basic sales overview</span>
                  </div>
                </div>
              </div>
              <Link
                href="/sign-up"
                className="w-full inline-flex items-center justify-center py-3 rounded-xl border border-neutral-300 bg-white text-sm font-bold text-neutral-800 hover:bg-neutral-50 shadow-2xs transition-colors"
              >
                Get Started Free
              </Link>
            </div>

            {/* Pro Tier (Popular) */}
            <div className="relative rounded-3xl p-8 bg-neutral-950 text-white shadow-xl flex flex-col justify-between border-2 border-neutral-950 ring-2 ring-[#F5B418]">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-[#F5B418] text-neutral-950 text-[10px] font-black uppercase tracking-wider shadow-xs">
                Most Popular · 7-Day Free Trial
              </div>
              <div>
                <div className="flex items-center justify-between mb-4 mt-1">
                  <h3 className="text-xl font-bold text-white">Pro</h3>
                  <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-white/10 text-amber-300">
                    Full Workspace
                  </span>
                </div>
                <div className="mb-6">
                  <span className="text-4xl font-black text-white">
                    {billingPeriod === 'annual' ? '$10' : '$12'}
                  </span>
                  <span className="text-xs text-neutral-400 ml-1">/ month</span>
                  <p className="text-xs text-neutral-400 mt-1">
                    {billingPeriod === 'annual' ? '$120 billed annually' : 'Billed monthly'}
                  </p>
                </div>
                <div className="space-y-3 mb-8 text-sm text-neutral-200">
                  <div className="flex items-center gap-2.5">
                    <Check size={16} className="text-[#F5B418] stroke-[3] shrink-0" />
                    <span className="font-semibold text-white">Unlimited catalog products</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check size={16} className="text-[#F5B418] stroke-[3] shrink-0" />
                    <span>250 active Take Order links</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check size={16} className="text-[#F5B418] stroke-[3] shrink-0" />
                    <span>Custom brand logo & accent palette</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check size={16} className="text-[#F5B418] stroke-[3] shrink-0" />
                    <span>Operating expense logging & net margins</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check size={16} className="text-[#F5B418] stroke-[3] shrink-0" />
                    <span>Channel conversion analytics</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check size={16} className="text-[#F5B418] stroke-[3] shrink-0" />
                    <span>CSV order data export</span>
                  </div>
                </div>
              </div>
              <Link
                href="/sign-up"
                className="w-full inline-flex items-center justify-center py-3.5 rounded-xl bg-[#F5B418] text-neutral-950 text-sm font-extrabold hover:bg-amber-400 shadow-md transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                Start 7-Day Free Trial
              </Link>
            </div>

            {/* Pro+ Tier */}
            <div className="rounded-3xl p-8 bg-white border border-neutral-200 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-neutral-950">Pro+</h3>
                  <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900">
                    High Volume
                  </span>
                </div>
                <div className="mb-6">
                  <span className="text-4xl font-black text-neutral-950">
                    {billingPeriod === 'annual' ? '$15' : '$20'}
                  </span>
                  <span className="text-xs text-neutral-500 ml-1">/ month</span>
                  <p className="text-xs text-neutral-500 mt-1">
                    {billingPeriod === 'annual' ? '$180 billed annually' : 'Billed monthly'}
                  </p>
                </div>
                <div className="space-y-3 mb-8 text-sm text-neutral-700">
                  <div className="flex items-center gap-2.5">
                    <Check size={16} className="text-emerald-600 stroke-[3] shrink-0" />
                    <span>Everything in Pro</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check size={16} className="text-emerald-600 stroke-[3] shrink-0" />
                    <span className="font-semibold text-neutral-950">Unlimited active checkout links</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check size={16} className="text-emerald-600 stroke-[3] shrink-0" />
                    <span>Executive sales intelligence & velocity</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check size={16} className="text-emerald-600 stroke-[3] shrink-0" />
                    <span>Multi-currency support</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check size={16} className="text-emerald-600 stroke-[3] shrink-0" />
                    <span>Priority merchant support</span>
                  </div>
                </div>
              </div>
              <Link
                href="/sign-up"
                className="w-full inline-flex items-center justify-center py-3 rounded-xl border border-neutral-300 bg-white text-sm font-bold text-neutral-800 hover:bg-neutral-50 shadow-2xs transition-colors"
              >
                Start 7-Day Free Trial
              </Link>
            </div>
          </div>

          {/* Compliance & Billing Details Notice for Underwriters */}
          <div className="mt-14 p-6 rounded-2xl bg-white border border-neutral-200 shadow-2xs text-xs text-neutral-600 space-y-2 max-w-4xl mx-auto">
            <div className="flex items-center gap-2 font-bold text-neutral-900 text-sm">
              <ShieldCheck size={16} className="text-emerald-600" />
              <span>Subscription & Billing Guarantee</span>
            </div>
            <p>
              Subscription payments are processed securely by our Merchant of Record partner, <strong>Paddle</strong>.
              All paid plans include a 7-day free trial. If you cancel before the trial concludes, your payment method will not be charged.
            </p>
            <p>
              Active subscriptions automatically renew at the frequency chosen until cancelled. You can cancel your subscription at any time with one click inside your workspace account settings.
              Subscriptions also qualify for our <strong>14-day refund guarantee</strong> — see our{' '}
              <Link href="/refund-policy" className="underline font-semibold text-neutral-900">
                Refund & Cancellation Policy
              </Link>{' '}
              for full details.
            </p>
          </div>
        </div>
      </section>

      {/* ── Policy & Compliance Hub ── */}
      <section className="py-16 bg-white border-t border-neutral-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <h2 className="text-2xl font-bold text-neutral-950 mb-2">
              Legal Transparency & Merchant Terms
            </h2>
            <p className="text-xs text-neutral-600">
              Clear, fair rules protecting both sellers and buyers across all sales channels.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <Link
              href="/terms"
              className="p-6 rounded-2xl border border-neutral-200 bg-[#FDFBF7] hover:bg-white hover:shadow-sm transition-all group block"
            >
              <div className="flex items-center justify-between mb-3">
                <FileText size={20} className="text-amber-700" />
                <ChevronRight size={16} className="text-neutral-400 group-hover:translate-x-1 transition-transform" />
              </div>
              <h3 className="font-bold text-neutral-950 text-base mb-1">
                Terms of Service
              </h3>
              <p className="text-xs text-neutral-600 leading-relaxed">
                Rules governing seller workspaces, buyer order links, prohibited items, and platform responsibility.
              </p>
            </Link>

            <Link
              href="/privacy"
              className="p-6 rounded-2xl border border-neutral-200 bg-[#FDFBF7] hover:bg-white hover:shadow-sm transition-all group block"
            >
              <div className="flex items-center justify-between mb-3">
                <Shield size={20} className="text-amber-700" />
                <ChevronRight size={16} className="text-neutral-400 group-hover:translate-x-1 transition-transform" />
              </div>
              <h3 className="font-bold text-neutral-950 text-base mb-1">
                Privacy Policy
              </h3>
              <p className="text-xs text-neutral-600 leading-relaxed">
                Compliance with Ghana Data Protection Act 2012. We never inspect or read sellers' private chat messages.
              </p>
            </Link>

            <Link
              href="/refund-policy"
              className="p-6 rounded-2xl border border-neutral-200 bg-[#FDFBF7] hover:bg-white hover:shadow-sm transition-all group block"
            >
              <div className="flex items-center justify-between mb-3">
                <RefreshCw size={20} className="text-amber-700" />
                <ChevronRight size={16} className="text-neutral-400 group-hover:translate-x-1 transition-transform" />
              </div>
              <h3 className="font-bold text-neutral-950 text-base mb-1">
                Refund & Cancellation
              </h3>
              <p className="text-xs text-neutral-600 leading-relaxed">
                14-day refund policy on subscription plans, trial cancellation rules, and order dispute guidance.
              </p>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-neutral-950 text-neutral-400 py-14 border-t border-neutral-900">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 mb-12">
            <div className="md:col-span-2 space-y-4">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-white text-neutral-950 flex items-center justify-center font-extrabold text-sm">
                  T
                </div>
                <span className="font-black tracking-tight text-lg text-white">
                  Take<span className="text-[#F5B418]">Order</span>
                </span>
              </div>
              <p className="text-xs leading-relaxed text-neutral-400 max-w-sm">
                Take Order is a digital operating workspace for independent multi-channel sellers.
                Catalog management, instant order links, fulfillment slips, and sales analytics.
              </p>
              <div className="flex items-center gap-2 text-xs text-neutral-400">
                <Mail size={14} />
                <a href="mailto:adjorloloclarke@gmail.com" className="hover:text-white transition-colors">
                  adjorloloclarke@gmail.com
                </a>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-white mb-3">
                Legal & Compliance
              </h4>
              <ul className="space-y-2 text-xs">
                <li>
                  <Link href="/terms" className="hover:text-white transition-colors">
                    Terms of Service
                  </Link>
                </li>
                <li>
                  <Link href="/privacy" className="hover:text-white transition-colors">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link href="/refund-policy" className="hover:text-white transition-colors">
                    Refund & Cancellation Policy
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-white mb-3">
                Account & App
              </h4>
              <ul className="space-y-2 text-xs">
                <li>
                  <Link href="/sign-in" className="hover:text-white transition-colors">
                    Sign In
                  </Link>
                </li>
                <li>
                  <Link href="/sign-up" className="hover:text-white transition-colors">
                    Create Seller Account
                  </Link>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => scrollToSection('pricing')}
                    className="hover:text-white transition-colors cursor-pointer text-left"
                  >
                    Pricing Plans
                  </button>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-neutral-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-neutral-500">
            <div>
              © 2026 Take Order. All rights reserved.
            </div>
            <div className="text-[11px] text-neutral-500">
              Merchant of Record & Billing partner: Paddle / Take Order
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
