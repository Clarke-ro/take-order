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
  Shield,
  Star,
  ChevronDown,
  ChevronRight,
  Menu,
  X,
  CreditCard,
  Lock,
  Layers,
  Smartphone,
  TrendingUp,
  Clock,
  HeartHandshake,
  DollarSign,
  Share2,
  PackageCheck,
  FileCheck2,
} from 'lucide-react';

export function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<number>(0);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
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

  const stories = [
    {
      metric: '+$18,400',
      label: 'Direct sales in 60 days',
      name: 'Sarah Mensah',
      role: 'Founder, Bella Luxe Studio',
      tag: 'Fashion & Apparel',
      image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
    },
    {
      metric: '+165%',
      label: 'Growth in repeat orders',
      name: 'Kwame Asante',
      role: 'Owner, Accra Artisan Bakes',
      tag: 'Bakery & Desserts',
      image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
    },
    {
      metric: '3x Faster',
      label: 'Customer checkout speed',
      name: 'Cynthia K.',
      role: 'Director, Glow Botanics',
      tag: 'Beauty & Skincare',
      image: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=80',
    },
    {
      metric: '$0 Fees',
      label: 'Zero commissions on sales',
      name: 'David Tetteh',
      role: 'Creator, Urban Kicks GH',
      tag: 'Sneakers & Streetwear',
      image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
    },
    {
      metric: '99.4%',
      label: 'Verified payment confirmation',
      name: 'Nana Yaa Boateng',
      role: 'Owner, Spice & Savor Kitchen',
      tag: 'Food & Catering',
      image: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=400&q=80',
    },
  ];

  const featureTabs = [
    {
      id: 0,
      title: 'One-Tap Order Links',
      badge: 'Frictionless Checkout',
      headline: 'Turn your bio link into an instant storefront',
      description:
        'Instead of sending messy price lists in WhatsApp and Instagram chats, drop a clean Take Order link. Buyers browse real photos, select variants, and order in under 40 seconds without creating an account.',
      metrics: ['Zero app downloads required for buyers', 'Instant WhatsApp order summary', 'Works across IG, TikTok, WhatsApp & Twitter'],
      mockupType: 'link',
    },
    {
      id: 1,
      title: 'Automated Payment Verification',
      badge: 'Zero Fake Proofs',
      headline: 'Stop matching bank screenshots by hand',
      description:
        'Buyers upload their Mobile Money transaction ID or payment slip directly into the checkout flow. Take Order verifies the details, notifies you instantly, and keeps your records neat and audit-ready.',
      metrics: ['Mobile Money (MTN, Telecel, AT) support', 'Bank card & transfer reconciliation', 'Fraud protection with image proof storage'],
      mockupType: 'payment',
    },
    {
      id: 2,
      title: 'Customer CRM & Repeat Orders',
      badge: 'Loyalty Engine',
      headline: 'Build a private list of your highest-paying regulars',
      description:
        'Every order automatically logs customer contact details, past purchase amounts, and favorite items. Send one-click WhatsApp dispatch updates and re-engage VIP customers with new releases.',
      metrics: ['Full customer order history & lifetime value', 'Automated dispatch & pickup SMS/WhatsApp text', 'One-click customer re-engagement'],
      mockupType: 'crm',
    },
    {
      id: 3,
      title: 'Realtime Stock & Profit Tracker',
      badge: 'Business Operations',
      headline: 'Never sell an item twice or lose money on delivery',
      description:
        'Stock counts auto-deduct the second an order is confirmed. Log delivery rider fees, product costs, and monitor your exact daily profit margins straight from your seller dashboard.',
      metrics: ['Live stock alerts before you run out', 'Delivery fee & distance manager', 'Daily net profit and margin analytics'],
      mockupType: 'inventory',
    },
  ];

  const faqs = [
    {
      q: 'Do my buyers need to download an app or sign up to order?',
      a: 'No! Buyers never need to download an app or create an account. When they tap your Take Order link in WhatsApp, Instagram, or TikTok, your store opens immediately in their mobile browser for a lightning-fast 30-second checkout.',
    },
    {
      q: 'How does payment processing work with Take Order?',
      a: 'Take Order enables seamless checkout for your customers. Buyers can pay via Mobile Money (MTN, Telecel, AT), Debit/Credit cards, or Bank Transfer, and upload proof directly. You retain 100% of your customer funds directly without middleman holdbacks.',
    },
    {
      q: 'What is the difference between Pro ($9.99/mo) and Pro+ ($20/mo)?',
      a: 'Pro ($9.99/mo) gives you unlimited active order links, up to 100 catalog products, automated receipts, and core sales tracking. Pro+ ($20/mo) unlocks unlimited catalog products, custom branding with your own store logo/colors, multi-currency support, customer CRM insights, and VIP concierge support.',
    },
    {
      q: 'Can I cancel my subscription at any time?',
      a: 'Yes, absolutely. There are no long-term contracts or cancellation penalties. You can manage or cancel your subscription at any time with a single click inside your Account Billing settings.',
    },
    {
      q: 'How do I share my order links on social media?',
      a: 'Take Order generates custom, short links for your entire store (e.g., usetakeorder.app/store/yourbrand) as well as specific single-product links. You can paste them into your Instagram bio, WhatsApp Status, TikTok link-in-bio, or directly in customer DMs.',
    },
    {
      q: 'Is there a free trial to test Take Order?',
      a: 'Yes! Every new seller gets full access to set up their catalog, customize their store, and experience the workflow before billing starts. We offer a 14-day money-back satisfaction guarantee on all plans.',
    },
  ];

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-[#121212] font-sans selection:bg-amber-200 selection:text-neutral-900 antialiased">
      {/* ── Top Header / Navigation (Owner.com Replica Style) ── */}
      <header className="sticky top-0 z-50 bg-[#FDFBF7]/90 backdrop-blur-md border-b border-black/[0.06] transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3 group cursor-pointer">
            <div className="h-10 w-10 rounded-xl bg-[#121212] flex items-center justify-center text-white font-extrabold text-xl shadow-sm group-hover:scale-105 transition-transform">
              <ShoppingBag size={20} className="text-[#F5B418]" />
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold tracking-tight text-xl leading-none text-[#121212]">
                Take<span className="text-[#F5B418]">Order</span>
              </span>
              <span className="text-[10px] uppercase tracking-widest font-semibold text-neutral-400 mt-0.5">
                Social Commerce OS
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-8 text-[14px] font-semibold text-neutral-600">
            <button
              type="button"
              onClick={() => scrollToSection('features')}
              className="hover:text-black transition-colors cursor-pointer"
            >
              Product
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('how-it-works')}
              className="hover:text-black transition-colors cursor-pointer"
            >
              How it works
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('stories')}
              className="hover:text-black transition-colors cursor-pointer"
            >
              Stories
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('pricing')}
              className="hover:text-black transition-colors cursor-pointer"
            >
              Pricing
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('faqs')}
              className="hover:text-black transition-colors cursor-pointer"
            >
              FAQs
            </button>
          </nav>

          {/* Right Action CTAs */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              href="/sign-in"
              className="px-4 py-2.5 rounded-full text-sm font-semibold text-neutral-700 hover:text-black hover:bg-black/5 transition-all"
            >
              Sign In
            </Link>
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#121212] text-white text-sm font-bold hover:bg-neutral-800 shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <span>Start Free Trial</span>
              <ArrowRight size={14} className="text-[#F5B418]" />
            </Link>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center gap-2">
            <Link
              href="/sign-in"
              className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-[#121212] text-white"
            >
              Sign In
            </Link>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-neutral-700 hover:bg-black/5"
            >
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-[#FDFBF7] border-b border-black/10 px-4 pt-3 pb-6 space-y-3">
            <button
              type="button"
              onClick={() => scrollToSection('features')}
              className="block w-full text-left py-2 text-sm font-semibold text-neutral-700 hover:text-black"
            >
              Product
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('how-it-works')}
              className="block w-full text-left py-2 text-sm font-semibold text-neutral-700 hover:text-black"
            >
              How it works
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('stories')}
              className="block w-full text-left py-2 text-sm font-semibold text-neutral-700 hover:text-black"
            >
              Stories
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('pricing')}
              className="block w-full text-left py-2 text-sm font-semibold text-neutral-700 hover:text-black"
            >
              Pricing
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('faqs')}
              className="block w-full text-left py-2 text-sm font-semibold text-neutral-700 hover:text-black"
            >
              FAQs
            </button>
            <div className="pt-2 border-t border-black/10 flex flex-col gap-2">
              <Link
                href="/sign-up"
                className="w-full text-center py-2.5 rounded-xl bg-[#121212] text-white font-bold text-sm"
              >
                Start Free Trial
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* ── 1. Hero Section (Owner.com Replica Architecture) ── */}
      <section className="relative pt-12 pb-20 md:pt-20 md:pb-32 overflow-hidden">
        {/* Subtle Ambient Radial Glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-gradient-to-tr from-amber-200/30 via-yellow-100/20 to-transparent blur-3xl pointer-events-none -z-10" />

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {/* Top Rating Badge */}
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-black/[0.04] border border-black/[0.08] mb-8">
            <span className="text-xs font-black text-neutral-900 tracking-tight">4.9</span>
            <div className="flex items-center text-[#F5B418]">
              {[...Array(5)].map((_, i) => (
                <Star key={i} size={13} className="fill-[#F5B418]" />
              ))}
            </div>
            <span className="text-xs font-medium text-neutral-500">
              across 1,200+ active social sellers
            </span>
          </div>

          {/* Main Headline */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-[1.08] text-[#121212] max-w-5xl mx-auto">
            <span className="text-neutral-500 font-extrabold block text-3xl sm:text-5xl lg:text-5xl mb-2">
              The order platform social sellers use to
            </span>
            <span className="bg-gradient-to-r from-neutral-950 via-neutral-800 to-amber-700 bg-clip-text text-transparent">
              turn chats into paid orders.
            </span>
          </h1>

          {/* Subtitle */}
          <p className="mt-6 text-lg sm:text-xl text-neutral-600 max-w-2xl mx-auto font-normal leading-relaxed">
            Replace messy WhatsApp &amp; Instagram chat negotiations with branded order links, automated Mobile Money payment confirmation, and real-time inventory tracking.
          </p>

          {/* Interactive Input Form (Owner.com Replica Bar) */}
          <div className="mt-10 max-w-2xl mx-auto">
            <form
              onSubmit={handleStorePreview}
              className="p-2 sm:p-2.5 rounded-2xl sm:rounded-full bg-white border border-black/10 shadow-lg shadow-black/[0.04] flex flex-col sm:flex-row items-center gap-2 focus-within:border-black/30 focus-within:ring-4 focus-within:ring-amber-500/10 transition-all"
            >
              <div className="flex items-center gap-2.5 px-4 w-full">
                <span className="text-neutral-400 font-semibold text-sm">usetakeorder.app/store/</span>
                <input
                  type="text"
                  value={storeNameInput}
                  onChange={(e) => setStoreNameInput(e.target.value)}
                  placeholder="your-brand-name"
                  className="w-full bg-transparent text-sm sm:text-base font-bold text-neutral-900 placeholder:text-neutral-300 focus:outline-none"
                />
              </div>
              <button
                type="submit"
                className="w-full sm:w-auto shrink-0 px-6 py-3.5 rounded-xl sm:rounded-full bg-[#121212] text-white text-sm font-bold hover:bg-neutral-800 transition-all flex items-center justify-center gap-2 group cursor-pointer shadow-sm hover:scale-[1.02]"
              >
                <span>Preview My Link</span>
                <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform text-[#F5B418]" />
              </button>
            </form>
            <p className="mt-3 text-xs text-neutral-500 flex items-center justify-center gap-4">
              <span>✓ Free 14-day trial</span>
              <span>✓ No credit card needed</span>
              <span>✓ Zero commissions</span>
            </p>
          </div>

          {/* Interactive UI Showcase Mockup */}
          <div className="mt-14 max-w-4xl mx-auto relative">
            <div className="relative rounded-3xl bg-neutral-900 p-3 sm:p-6 shadow-2xl border border-neutral-800 text-left overflow-hidden">
              {/* Window Header */}
              <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500/80" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                  <div className="w-3 h-3 rounded-full bg-green-500/80" />
                  <span className="ml-3 text-xs text-neutral-400 font-mono">
                    https://www.usetakeorder.app/store/{previewHandle}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="px-3 py-1 rounded-md bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-neutral-200 transition-colors flex items-center gap-1.5"
                >
                  <Share2 size={12} />
                  <span>{copiedLink ? 'Copied!' : 'Copy Link'}</span>
                </button>
              </div>

              {/* Mock Store Content */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 pt-6 items-center">
                {/* Mobile Preview Screen */}
                <div className="md:col-span-6 flex justify-center">
                  <div className="w-full max-w-[320px] rounded-3xl bg-white text-neutral-900 p-4 shadow-xl border-4 border-neutral-800">
                    <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
                      <div>
                        <h4 className="font-extrabold text-sm capitalize">@{previewHandle}</h4>
                        <p className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                          Accepting Orders Now
                        </p>
                      </div>
                      <div className="h-7 w-7 rounded-full bg-amber-100 flex items-center justify-center text-xs font-bold text-amber-900">
                        TO
                      </div>
                    </div>

                    <div className="mt-3 space-y-2.5">
                      <div className="p-2.5 rounded-xl bg-neutral-50 border border-neutral-100 flex items-center gap-3">
                        <div className="w-12 h-12 rounded-lg bg-neutral-200 shrink-0 overflow-hidden">
                          <img
                            src="https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=150&q=80"
                            alt="Product"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-xs truncate">Signature Urban Runner</p>
                          <p className="text-xs font-black text-neutral-900 mt-0.5">₵450.00</p>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-1 rounded bg-black text-white shrink-0">
                          1x
                        </span>
                      </div>

                      <div className="p-2.5 rounded-xl bg-amber-50/60 border border-amber-200/60 text-xs">
                        <div className="flex justify-between font-semibold text-neutral-700">
                          <span>Subtotal</span>
                          <span>₵450.00</span>
                        </div>
                        <div className="flex justify-between font-semibold text-neutral-700 mt-1">
                          <span>Dispatch / Delivery</span>
                          <span>₵35.00</span>
                        </div>
                        <div className="flex justify-between font-black text-neutral-950 pt-2 border-t border-amber-200/50 mt-1.5">
                          <span>Total</span>
                          <span>₵485.00</span>
                        </div>
                      </div>

                      <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-2">
                        <Check size={16} className="text-emerald-600 shrink-0" />
                        <span className="text-[11px] font-bold text-emerald-800">
                          MTN Momo Payment Slip Attached
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-neutral-100 text-center">
                      <div className="w-full py-2.5 rounded-xl bg-[#121212] text-white text-xs font-bold shadow-xs">
                        Place Order in 1 Tap
                      </div>
                    </div>
                  </div>
                </div>

                {/* Seller Live Alerts & Highlights */}
                <div className="md:col-span-6 space-y-4 text-white">
                  <div className="p-4 rounded-2xl bg-neutral-800/80 border border-neutral-700/80">
                    <div className="flex items-center justify-between text-xs text-neutral-400 mb-1">
                      <span>Realtime Seller Alert</span>
                      <span className="text-emerald-400 font-semibold">Just now</span>
                    </div>
                    <p className="font-bold text-base text-neutral-100 flex items-center gap-2">
                      <PackageCheck size={18} className="text-emerald-400" />
                      <span>New Order #1042 Received</span>
                    </p>
                    <p className="text-xs text-neutral-400 mt-1">
                      Kofi Adams placed an order for ₵485.00. Momo proof verified. Stock auto-reserved.
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-neutral-800/80 border border-neutral-700/80 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-neutral-400">Total Sales Today</p>
                      <p className="text-xl font-black text-[#F5B418] mt-0.5">₵3,840.00</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-neutral-400">Paid Orders</p>
                      <p className="text-xl font-black text-white mt-0.5">14 completed</p>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs">
                    <p className="font-bold flex items-center gap-1.5 mb-1">
                      <Sparkles size={14} className="text-[#F5B418]" />
                      <span>Zero DM Negotiation Chaos</span>
                    </p>
                    <p className="text-amber-200/80 leading-relaxed">
                      All orders arrive categorized with delivery address, phone number, and payment status ready for your dispatch rider.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 2. Metric Stories ("Grow sales like these owners" - Owner.com Replica) ── */}
      <section id="stories" className="py-20 bg-white border-y border-black/[0.06]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12">
            <div>
              <p className="text-xs uppercase tracking-widest font-black text-[#E5A00D]">
                Verified Social Sellers
              </p>
              <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-[#121212] mt-2">
                Grow sales like these merchants
              </h2>
            </div>
            <p className="text-sm text-neutral-500 max-w-md mt-4 md:mt-0 font-medium">
              Over 1,200 independent brands use Take Order to stop losing customers in messy DMs.
            </p>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {stories.map((story, idx) => (
              <div
                key={idx}
                className="group p-5 rounded-2xl bg-[#FDFBF7] border border-black/[0.08] hover:border-black/20 hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-black/5 text-neutral-600">
                    {story.tag}
                  </span>
                  <div className="text-3xl font-black text-neutral-950 mt-4 tracking-tight">
                    {story.metric}
                  </div>
                  <p className="text-xs font-semibold text-neutral-500 mt-1">
                    {story.label}
                  </p>
                </div>

                <div className="mt-8 pt-4 border-t border-black/5 flex items-center gap-3">
                  <img
                    src={story.image}
                    alt={story.name}
                    className="w-10 h-10 rounded-full object-cover border border-black/10"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-neutral-900 truncate">{story.name}</p>
                    <p className="text-[11px] text-neutral-500 truncate">{story.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 3. Owner-Stack Feature Tabs ("With Take Order, you get...") ── */}
      <section id="features" className="py-24 bg-[#FDFBF7]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs uppercase tracking-widest font-black text-[#E5A00D]">
              Complete Commerce System
            </span>
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-[#121212] mt-3">
              With Take Order, you get more sales, faster payments, zero chaos
            </h2>
            <p className="mt-4 text-base sm:text-lg text-neutral-600">
              Everything you need to turn casual Instagram scrollers and WhatsApp contacts into loyal paying customers.
            </p>
          </div>

          {/* Interactive Tab Selectors */}
          <div className="flex flex-wrap justify-center gap-2 sm:gap-3 mb-10">
            {featureTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-5 py-3 rounded-full text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-[#121212] text-white shadow-md scale-105'
                    : 'bg-white border border-black/10 text-neutral-600 hover:text-black hover:bg-neutral-50'
                }`}
              >
                {tab.title}
              </button>
            ))}
          </div>

          {/* Active Tab Panel */}
          <div className="rounded-3xl bg-white border border-black/[0.08] p-6 sm:p-10 lg:p-12 shadow-sm">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
              {/* Left Column: Description & Value Points */}
              <div className="lg:col-span-6 space-y-6">
                <span className="inline-block px-3 py-1 rounded-full text-xs font-black tracking-wide uppercase bg-amber-100 text-amber-900">
                  {featureTabs[activeTab].badge}
                </span>
                <h3 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-neutral-950 leading-tight">
                  {featureTabs[activeTab].headline}
                </h3>
                <p className="text-neutral-600 text-base leading-relaxed">
                  {featureTabs[activeTab].description}
                </p>

                <div className="space-y-3 pt-2">
                  {featureTabs[activeTab].metrics.map((point, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="h-5 w-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                        <Check size={13} strokeWidth={3} />
                      </div>
                      <span className="text-sm font-semibold text-neutral-800">{point}</span>
                    </div>
                  ))}
                </div>

                <div className="pt-4">
                  <Link
                    href="/sign-up"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#121212] text-white text-sm font-bold hover:bg-neutral-800 shadow-sm transition-all"
                  >
                    <span>Try it free on your store</span>
                    <ArrowRight size={14} className="text-[#F5B418]" />
                  </Link>
                </div>
              </div>

              {/* Right Column: Visual Component */}
              <div className="lg:col-span-6">
                <div className="rounded-2xl bg-neutral-900 p-6 text-white shadow-xl border border-neutral-800 min-h-[340px] flex flex-col justify-center">
                  {activeTab === 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between pb-3 border-b border-neutral-800 text-xs">
                        <span className="text-neutral-400 font-mono">takeorder.link/glow</span>
                        <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold text-[10px]">
                          Active Bio Link
                        </span>
                      </div>
                      <div className="p-4 rounded-xl bg-neutral-800/90 border border-neutral-700 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-sm">Glow Radiance Serum</span>
                          <span className="font-black text-[#F5B418]">₵180.00</span>
                        </div>
                        <p className="text-xs text-neutral-400">
                          Selected variant: 50ml Bottle • Free dispatch rider within Accra
                        </p>
                        <div className="w-full py-2.5 rounded-lg bg-[#F5B418] text-neutral-950 font-black text-xs text-center">
                          Buy Now via WhatsApp / Card
                        </div>
                      </div>
                      <p className="text-xs text-neutral-400 text-center">
                        ⚡ 83% of buyers complete order within 45 seconds of tapping.
                      </p>
                    </div>
                  )}

                  {activeTab === 1 && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between pb-3 border-b border-neutral-800 text-xs">
                        <span className="text-neutral-400">Payment Verification Engine</span>
                        <span className="text-emerald-400 font-bold">100% Direct</span>
                      </div>
                      <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/30 space-y-2">
                        <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                          <ShieldCheck size={18} />
                          <span>MTN Mobile Money Verified</span>
                        </div>
                        <p className="text-xs text-neutral-300 font-mono">
                          Transaction ID: 29840192837 • ₵320.00
                        </p>
                        <p className="text-[11px] text-neutral-400">
                          Buyer payment snapshot securely stored in Supabase private vault.
                        </p>
                      </div>
                      <div className="flex justify-between text-xs text-neutral-400 px-1">
                        <span>Fake slip risk: 0%</span>
                        <span>Auto-sms receipt: Sent</span>
                      </div>
                    </div>
                  )}

                  {activeTab === 2 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between pb-3 border-b border-neutral-800 text-xs">
                        <span className="text-neutral-400">Top Repeat Customers</span>
                        <span className="text-[#F5B418] font-bold">VIP Hub</span>
                      </div>
                      <div className="space-y-2">
                        <div className="p-3 rounded-xl bg-neutral-800 border border-neutral-700 flex items-center justify-between text-xs">
                          <div>
                            <p className="font-bold text-white">Esi Mensah</p>
                            <p className="text-neutral-400 text-[11px]">8 orders • ₵2,450 spent</p>
                          </div>
                          <span className="px-2 py-1 rounded bg-amber-500/20 text-[#F5B418] font-bold text-[10px]">
                            VIP Buyer
                          </span>
                        </div>
                        <div className="p-3 rounded-xl bg-neutral-800 border border-neutral-700 flex items-center justify-between text-xs">
                          <div>
                            <p className="font-bold text-white">Michael Addo</p>
                            <p className="text-neutral-400 text-[11px]">5 orders • ₵1,800 spent</p>
                          </div>
                          <span className="px-2 py-1 rounded bg-emerald-500/20 text-emerald-400 font-bold text-[10px]">
                            Regular
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 3 && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between pb-3 border-b border-neutral-800 text-xs">
                        <span className="text-neutral-400">Inventory &amp; Margins</span>
                        <span className="text-emerald-400 font-bold">Realtime</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-center">
                        <div className="p-3 rounded-xl bg-neutral-800 border border-neutral-700">
                          <p className="text-xs text-neutral-400">Remaining Stock</p>
                          <p className="text-xl font-black text-white mt-1">42 units</p>
                        </div>
                        <div className="p-3 rounded-xl bg-neutral-800 border border-neutral-700">
                          <p className="text-xs text-neutral-400">Net Profit Margin</p>
                          <p className="text-xl font-black text-emerald-400 mt-1">68.4%</p>
                        </div>
                      </div>
                      <p className="text-xs text-neutral-400 text-center">
                        Auto-alerts you before stock depletes so you never disappoint buyers.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 4. Comparison Section ("The Old Way vs Take Order Way") ── */}
      <section id="how-it-works" className="py-24 bg-white border-y border-black/[0.06]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs uppercase tracking-widest font-black text-[#E5A00D]">
              Direct Comparison
            </span>
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-[#121212] mt-3">
              Why modern sellers are leaving manual WhatsApp DM selling behind
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* The Old Way */}
            <div className="p-8 rounded-3xl bg-neutral-50 border border-neutral-200/80 space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-100 text-red-800 text-xs font-black uppercase tracking-wider">
                <span>The Chaotic DM Way</span>
              </div>
              <h3 className="text-xl font-black text-neutral-900">
                Messy chats, lost buyers, and fake payment slips
              </h3>
              <ul className="space-y-4 text-sm text-neutral-600">
                <li className="flex items-start gap-3">
                  <span className="text-red-500 font-bold text-base mt-0.5">✕</span>
                  <span><strong>15+ back-and-forth messages</strong> just to confirm price, size, and delivery address.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-red-500 font-bold text-base mt-0.5">✕</span>
                  <span><strong>Customers ghost halfway</strong> through chat negotiations and buy elsewhere.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-red-500 font-bold text-base mt-0.5">✕</span>
                  <span><strong>Risk of fake edited screenshots</strong> causing you to dispatch unpaid goods.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-red-500 font-bold text-base mt-0.5">✕</span>
                  <span><strong>Items oversold</strong> because inventory is tracked in your head or loose paper notebooks.</span>
                </li>
              </ul>
            </div>

            {/* The Take Order Way */}
            <div className="p-8 rounded-3xl bg-neutral-950 text-white shadow-xl border border-neutral-800 space-y-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-black uppercase tracking-wider">
                <span>The Take Order Standard</span>
              </div>
              <h3 className="text-xl font-black text-white">
                One-tap order link, automated payments, clean pipeline
              </h3>
              <ul className="space-y-4 text-sm text-neutral-300">
                <li className="flex items-start gap-3">
                  <span className="text-emerald-400 font-bold text-base mt-0.5">✓</span>
                  <span><strong>38-second average checkout</strong> directly from your Instagram bio, TikTok, or WhatsApp status.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-emerald-400 font-bold text-base mt-0.5">✓</span>
                  <span><strong>Verified Mobile Money &amp; Card proof</strong> attached directly to the order record.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-emerald-400 font-bold text-base mt-0.5">✓</span>
                  <span><strong>Automatic stock reservation</strong> prevents overselling popular variants.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-emerald-400 font-bold text-base mt-0.5">✓</span>
                  <span><strong>Live seller dashboard</strong> with dispatch statuses, customer phone numbers, and profit metrics.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── 5. Pricing Section (Exact User Specifications: Pro $9.99/mo, Pro+ $20/mo) ── */}
      <section id="pricing" className="py-24 bg-[#FDFBF7]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs uppercase tracking-widest font-black text-[#E5A00D]">
              Transparent Subscriptions
            </span>
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-[#121212] mt-3">
              Simple pricing that pays for itself in one order
            </h2>
            <p className="mt-4 text-base sm:text-lg text-neutral-600">
              Zero commissions on your sales. Keep 100% of customer payments. Cancel anytime with one click.
            </p>
          </div>

          {/* Exactly Two Tiers: Pro and Pro+ */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto items-stretch">
            {/* Pro Plan ($9.99/month) */}
            <div className="rounded-3xl bg-white border border-black/10 p-8 sm:p-10 shadow-sm flex flex-col justify-between hover:border-black/20 transition-all">
              <div>
                <div className="flex items-center justify-between">
                  <span className="px-3 py-1 rounded-full bg-neutral-100 text-neutral-800 text-xs font-black uppercase tracking-wider">
                    Pro
                  </span>
                  <span className="text-xs text-neutral-400 font-semibold">Monthly Plan</span>
                </div>

                <div className="mt-6 flex items-baseline gap-1">
                  <span className="text-5xl font-black text-neutral-950 tracking-tight">$9.99</span>
                  <span className="text-sm font-bold text-neutral-500">/ month</span>
                </div>

                <p className="mt-3 text-sm text-neutral-600 leading-relaxed">
                  Ideal for rising social sellers ready to eliminate manual chat order negotiations and organize their catalog.
                </p>

                <div className="mt-8 pt-6 border-t border-black/5 space-y-3.5 text-sm font-medium text-neutral-700">
                  <div className="flex items-center gap-3">
                    <Check size={16} className="text-emerald-600 shrink-0" strokeWidth={2.5} />
                    <span><strong>Unlimited</strong> active order links &amp; checkouts</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Check size={16} className="text-emerald-600 shrink-0" strokeWidth={2.5} />
                    <span>Up to <strong>100 catalog products</strong></span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Check size={16} className="text-emerald-600 shrink-0" strokeWidth={2.5} />
                    <span>Automated Mobile Money &amp; Card payment proof</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Check size={16} className="text-emerald-600 shrink-0" strokeWidth={2.5} />
                    <span>WhatsApp &amp; SMS customer receipt templates</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Check size={16} className="text-emerald-600 shrink-0" strokeWidth={2.5} />
                    <span>Real-time inventory reservation</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Check size={16} className="text-emerald-600 shrink-0" strokeWidth={2.5} />
                    <span>Standard sales analytics &amp; order export</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Check size={16} className="text-emerald-600 shrink-0" strokeWidth={2.5} />
                    <span>Dedicated email &amp; in-app support</span>
                  </div>
                </div>
              </div>

              <div className="mt-10">
                <Link
                  href="/sign-up?plan=pro"
                  className="w-full py-4 rounded-full bg-[#121212] text-white text-sm font-bold hover:bg-neutral-800 transition-all flex items-center justify-center gap-2 shadow-sm"
                >
                  <span>Start Pro Plan</span>
                  <ArrowRight size={14} className="text-[#F5B418]" />
                </Link>
                <p className="mt-2 text-center text-xs text-neutral-400">
                  14-day free trial • Cancel anytime
                </p>
              </div>
            </div>

            {/* Pro+ Plan ($20.00/month - Featured) */}
            <div className="rounded-3xl bg-neutral-950 text-white border-2 border-[#F5B418] p-8 sm:p-10 shadow-xl flex flex-col justify-between relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-[#F5B418] text-neutral-950 text-[11px] font-black uppercase tracking-wider px-4 py-1 rounded-bl-xl shadow-xs">
                Most Popular
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <span className="px-3 py-1 rounded-full bg-[#F5B418]/20 text-[#F5B418] text-xs font-black uppercase tracking-wider">
                    Pro+
                  </span>
                  <span className="text-xs text-neutral-400 font-semibold">Ultimate Growth</span>
                </div>

                <div className="mt-6 flex items-baseline gap-1">
                  <span className="text-5xl font-black text-white tracking-tight">$20.00</span>
                  <span className="text-sm font-bold text-neutral-400">/ month</span>
                </div>

                <p className="mt-3 text-sm text-neutral-300 leading-relaxed">
                  For established brands and high-volume sellers needing unlimited capacity, custom branding, and VIP support.
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
                    <span>Multi-currency display for diaspora buyers</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Check size={16} className="text-[#F5B418] shrink-0" strokeWidth={2.5} />
                    <span><strong>Priority WhatsApp &amp; Concierge Support</strong></span>
                  </div>
                </div>
              </div>

              <div className="mt-10">
                <Link
                  href="/sign-up?plan=pro_plus"
                  className="w-full py-4 rounded-full bg-[#F5B418] text-neutral-950 text-sm font-black hover:bg-yellow-400 transition-all flex items-center justify-center gap-2 shadow-sm"
                >
                  <span>Start Pro+ Plan</span>
                  <ArrowRight size={14} className="text-neutral-950" />
                </Link>
                <p className="mt-2 text-center text-xs text-neutral-400">
                  14-day free trial • Cancel anytime
                </p>
              </div>
            </div>
          </div>

          {/* Paddle Security Note */}
          <div className="mt-12 text-center text-xs text-neutral-500 max-w-xl mx-auto flex items-center justify-center gap-2">
            <Lock size={13} className="text-neutral-400 shrink-0" />
            <span>
              Secure checkout handled by Paddle. 100% money-back guarantee within 14 days. Zero hidden transaction fees.
            </span>
          </div>
        </div>
      </section>

      {/* ── 6. Frequently Asked Questions (Accordion) ── */}
      <section id="faqs" className="py-24 bg-white border-t border-black/[0.06]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="text-xs uppercase tracking-widest font-black text-[#E5A00D]">
              Clear Answers
            </span>
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-[#121212] mt-3">
              Frequently Asked Questions
            </h2>
            <p className="mt-3 text-sm sm:text-base text-neutral-500">
              Have questions? We are here to help you get started smoothly.
            </p>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={idx}
                  className="rounded-2xl border border-black/[0.08] bg-[#FDFBF7] overflow-hidden transition-all"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full p-6 text-left flex items-center justify-between gap-4 font-bold text-base sm:text-lg text-neutral-900 hover:text-black cursor-pointer"
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
                    <div className="px-6 pb-6 text-sm text-neutral-600 leading-relaxed border-t border-black/[0.04] pt-4">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── 7. Final High-Contrast CTA Banner (Owner.com Replica) ── */}
      <section className="py-20 bg-neutral-950 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-amber-600/10 via-transparent to-yellow-600/10 pointer-events-none" />
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <span className="inline-block px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-white/10 text-amber-300 mb-6">
            Get Started Today
          </span>
          <h2 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-tight">
            Ready to turn your followers into paying customers?
          </h2>
          <p className="mt-5 text-neutral-400 text-base sm:text-lg max-w-2xl mx-auto font-normal">
            Join over 1,200 ambitious merchants who manage orders in seconds, eliminate fake payment slips, and scale without chaos.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/sign-up"
              className="w-full sm:w-auto px-8 py-4 rounded-full bg-[#F5B418] text-neutral-950 text-base font-black hover:bg-yellow-400 transition-all shadow-lg hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
            >
              <span>Start Your Free Trial</span>
              <ArrowRight size={16} />
            </Link>
            <button
              type="button"
              onClick={() => scrollToSection('pricing')}
              className="w-full sm:w-auto px-8 py-4 rounded-full bg-white/10 text-white text-base font-bold hover:bg-white/15 transition-all cursor-pointer"
            >
              View Pricing ($9.99 / $20)
            </button>
          </div>
        </div>
      </section>

      {/* ── 8. Footer (Fully Compliant for Paddle & Legal Audits) ── */}
      <footer className="bg-white border-t border-black/10 py-16 text-neutral-600 text-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-10">
            {/* Brand column */}
            <div className="md:col-span-2 space-y-4">
              <Link href="/" className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-[#121212] flex items-center justify-center text-white font-extrabold text-lg">
                  <ShoppingBag size={18} className="text-[#F5B418]" />
                </div>
                <span className="font-extrabold tracking-tight text-xl text-[#121212]">
                  Take<span className="text-[#F5B418]">Order</span>
                </span>
              </Link>
              <p className="text-xs text-neutral-500 max-w-sm leading-relaxed">
                The all-in-one order management and social commerce platform for independent sellers. Generate instant checkout links, track inventory, and verify Mobile Money &amp; Card payments.
              </p>
              <div className="pt-2 text-xs text-neutral-400">
                <p>Support: <a href="mailto:support@usetakeorder.app" className="text-black font-semibold underline underline-offset-2">support@usetakeorder.app</a></p>
              </div>
            </div>

            {/* Product Links */}
            <div>
              <p className="font-black text-xs uppercase tracking-widest text-neutral-900 mb-4">
                Product
              </p>
              <ul className="space-y-2.5 text-xs font-semibold">
                <li><button type="button" onClick={() => scrollToSection('features')} className="hover:text-black">Order Links</button></li>
                <li><button type="button" onClick={() => scrollToSection('features')} className="hover:text-black">Payment Proof Verification</button></li>
                <li><button type="button" onClick={() => scrollToSection('features')} className="hover:text-black">Customer CRM</button></li>
                <li><button type="button" onClick={() => scrollToSection('features')} className="hover:text-black">Stock Management</button></li>
                <li><button type="button" onClick={() => scrollToSection('pricing')} className="hover:text-black">Pricing</button></li>
              </ul>
            </div>

            {/* Legal & Compliance (Crucial for Paddle) */}
            <div>
              <p className="font-black text-xs uppercase tracking-widest text-neutral-900 mb-4">
                Legal &amp; Policies
              </p>
              <ul className="space-y-2.5 text-xs font-semibold">
                <li>
                  <Link href="/terms" className="hover:text-black">
                    Terms of Service
                  </Link>
                </li>
                <li>
                  <Link href="/privacy" className="hover:text-black">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link href="/refund-policy" className="hover:text-black">
                    Refund Policy
                  </Link>
                </li>
              </ul>
            </div>

            {/* Account */}
            <div>
              <p className="font-black text-xs uppercase tracking-widest text-neutral-900 mb-4">
                Account
              </p>
              <ul className="space-y-2.5 text-xs font-semibold">
                <li><Link href="/sign-in" className="hover:text-black">Seller Sign In</Link></li>
                <li><Link href="/sign-up" className="hover:text-black">Create Free Account</Link></li>
                <li><Link href="/account/billing" className="hover:text-black">Manage Subscription</Link></li>
              </ul>
            </div>
          </div>

          <div className="mt-14 pt-8 border-t border-black/5 flex flex-col sm:flex-row items-center justify-between text-xs text-neutral-400 gap-4">
            <p>© {new Date().getFullYear()} Take Order. All rights reserved.</p>
            <p>Built for ambitious social commerce brands worldwide.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
