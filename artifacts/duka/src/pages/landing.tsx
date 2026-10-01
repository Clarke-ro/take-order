import React, { useState } from 'react';
import { Link } from 'wouter';
import { useAppAuth } from '@/lib/auth-context';
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
  const { isSignedIn } = useAppAuth();
  const isTestAuth = typeof window !== 'undefined' && (Boolean((window as any).__DUKA_TEST_AUTH__) || localStorage.getItem('duka-test-auth') === 'true');
  const effectiveSignedIn = isSignedIn || isTestAuth;

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<number>(0);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [storeNameInput, setStoreNameInput] = useState('');
  const [previewHandle, setPreviewHandle] = useState('mystore');
  const [copiedLink, setCopiedLink] = useState(false);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('annual');

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
      tag: 'Bakery & Food',
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
      label: 'Instant order confirmation',
      name: 'Nana Yaa Boateng',
      role: 'Owner, Spice & Savor Kitchen',
      tag: 'Catering & Meals',
      image: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=400&q=80',
    },
  ];

  const featureTabs = [
    {
      id: 0,
      title: 'One-Tap Order Links',
      badge: 'Fast Order Flow',
      headline: 'Turn your social bio link into a high-converting storefront',
      description:
        'Instead of typing prices back and forth in WhatsApp and Instagram chats, share a sleek Take Order link. Buyers browse your catalog, select variants, and complete orders in under 40 seconds without creating an account.',
      metrics: ['Zero app downloads required for buyers', 'Instant order summary sent to WhatsApp', 'Works across WhatsApp, Instagram, TikTok & DMs'],
    },
    {
      id: 1,
      title: 'Order Slip & Receipt Verification',
      badge: 'Order Slip Verification',
      headline: 'Capture customer order receipts and delivery confirmations seamlessly',
      description:
        'Buyers attach their transaction confirmation slip or receipt directly into the order flow. Take Order attaches the submission, notifies you immediately, and keeps every order organized and audit-ready.',
      metrics: ['Order receipt capture (MoMo & bank slips)', 'Instant seller order notifications', 'Proof of order stored securely with each submission'],
    },
    {
      id: 2,
      title: 'Customer CRM & Repeat Orders',
      badge: 'Loyalty Engine',
      headline: 'Build a private list of your highest-paying regular customers',
      description:
        'Every completed order automatically logs the customer contact details, past purchase amounts, and favorite items. Send one-click WhatsApp dispatch updates and re-engage VIP customers with new drops.',
      metrics: ['Full customer order history & lifetime value', 'One-click WhatsApp dispatch & delivery texts', 'Automatic repeat-buyer tags'],
    },
    {
      id: 3,
      title: 'Realtime Stock & Profit Tracker',
      badge: 'Business Operations',
      headline: 'Never sell an item twice or lose money on delivery fees',
      description:
        'Stock counts auto-deduct the second an order is confirmed. Log delivery rider fees, product costs, and monitor your exact daily profit margins straight from your seller dashboard.',
      metrics: ['Live stock alerts before you run out', 'Delivery fee & distance manager', 'Daily net profit and margin analytics'],
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
      a: 'Take Order generates custom, short links for your entire store (e.g., usetakeorder.app/store/yourbrand) as well as specific single-product links. You can paste them into your Instagram bio, WhatsApp Status, TikTok link-in-bio, or directly in customer DMs.',
    },
  ];

  return (
    <div className="min-h-screen bg-white text-neutral-950 font-sans selection:bg-neutral-900 selection:text-white antialiased">
      {/* ── Top Header / Navigation (Black & White Minimalist) ── */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-neutral-200/80 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3 group cursor-pointer">
            <img
              src="/branding/takeorder-icon.png"
              alt="Take Order"
              className="h-9 w-9 rounded-xl object-contain shadow-xs group-hover:scale-105 transition-transform"
            />
            <div className="flex flex-col">
              <span className="font-bold tracking-tight text-xl leading-none text-neutral-900">
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
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-neutral-950 text-white text-sm font-bold hover:bg-neutral-800 shadow-xs transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <span>Open Dashboard</span>
                <ArrowRight size={14} className="text-[#F5B418]" />
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
                  <ArrowRight size={14} className="text-[#F5B418]" />
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
              className="p-2 rounded-lg text-neutral-700 hover:bg-neutral-100"
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

      {/* ── 1. Hero Section (Owner.com Replica Architecture in Clean Black & White) ── */}
      <section className="relative pt-12 pb-20 md:pt-20 md:pb-32 overflow-hidden bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {/* Main Headline */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.14] text-neutral-800 max-w-4xl mx-auto">
            The order platform social sellers use to{' '}
            <span className="text-neutral-900 font-extrabold">turn chats into paid orders.</span>
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
                <ArrowRight size={15} className="text-[#F5B418]" />
              </Link>
            ) : (
              <Link
                href="/sign-up"
                className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-neutral-950 text-white text-sm font-bold hover:bg-neutral-800 transition-all flex items-center justify-center gap-2 shadow-xs hover:scale-[1.02] active:scale-[0.98]"
              >
                <span>Start 7-Day Free Trial</span>
                <ArrowRight size={15} className="text-[#F5B418]" />
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

          {/* Interactive UI Showcase Mockup */}
          <div className="mt-14 max-w-4xl mx-auto relative">
            <div className="relative rounded-3xl bg-neutral-950 p-4 sm:p-7 shadow-2xl border border-neutral-800 text-left overflow-hidden">
              {/* Window Header */}
              <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-neutral-700" />
                  <div className="w-3 h-3 rounded-full bg-neutral-700" />
                  <div className="w-3 h-3 rounded-full bg-neutral-700" />
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
                  <div className="w-full max-w-[320px] rounded-3xl bg-white text-neutral-950 p-4 shadow-xl border-4 border-neutral-800">
                    <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
                      <div>
                        <h4 className="font-extrabold text-sm capitalize">@{previewHandle}</h4>
                        <p className="text-[11px] text-neutral-600 font-semibold flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#F5B418] inline-block" />
                          Accepting Orders Now
                        </p>
                      </div>
                      <div className="h-7 w-7 rounded-full bg-neutral-100 flex items-center justify-center text-xs font-bold text-neutral-900 border border-neutral-200">
                        TO
                      </div>
                    </div>

                    <div className="mt-3 space-y-2.5">
                      <div className="p-2.5 rounded-xl bg-neutral-50 border border-neutral-200 flex items-center gap-3">
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
                        <span className="text-[10px] font-bold px-2 py-1 rounded bg-neutral-950 text-white shrink-0">
                          1x
                        </span>
                      </div>

                      <div className="p-2.5 rounded-xl bg-neutral-100/70 border border-neutral-200 text-xs">
                        <div className="flex justify-between font-semibold text-neutral-700">
                          <span>Subtotal</span>
                          <span>₵450.00</span>
                        </div>
                        <div className="flex justify-between font-semibold text-neutral-700 mt-1">
                          <span>Dispatch / Delivery</span>
                          <span>₵35.00</span>
                        </div>
                        <div className="flex justify-between font-black text-neutral-950 pt-2 border-t border-neutral-300 mt-1.5">
                          <span>Total</span>
                          <span>₵485.00</span>
                        </div>
                      </div>

                      <div className="p-2.5 rounded-xl bg-neutral-100 border border-neutral-300 flex items-center gap-2">
                        <Check size={16} className="text-neutral-950 shrink-0" strokeWidth={2.5} />
                        <span className="text-[11px] font-bold text-neutral-900">
                          Customer Order Slip Attached
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-neutral-100 text-center">
                      <div className="w-full py-2.5 rounded-xl bg-neutral-950 text-white text-xs font-bold shadow-xs">
                        Place Order in 1 Tap
                      </div>
                    </div>
                  </div>
                </div>

                {/* Seller Live Alerts & Highlights */}
                <div className="md:col-span-6 space-y-4 text-white">
                  <div className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800">
                    <div className="flex items-center justify-between text-xs text-neutral-400 mb-1">
                      <span>Realtime Seller Alert</span>
                      <span className="text-neutral-300 font-semibold">Just now</span>
                    </div>
                    <p className="font-bold text-base text-neutral-100 flex items-center gap-2">
                      <PackageCheck size={18} className="text-[#F5B418]" />
                      <span>New Order #1042 Received</span>
                    </p>
                    <p className="text-xs text-neutral-400 mt-1">
                      Kofi Adams placed an order for ₵485.00. Order slip attached. Stock auto-reserved.
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-neutral-400">Total Orders Today</p>
                      <p className="text-xl font-black text-white mt-0.5">₵3,840.00</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-neutral-400">Completed Orders</p>
                      <p className="text-xl font-black text-white mt-0.5">14 confirmed</p>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800 text-neutral-300 text-xs">
                    <p className="font-bold flex items-center gap-1.5 mb-1 text-white">
                      <Sparkles size={14} className="text-[#F5B418]" />
                      <span>Zero DM Negotiation Chaos</span>
                    </p>
                    <p className="text-neutral-400 leading-relaxed">
                      All orders arrive categorized with delivery address, phone number, and fulfillment status ready for your dispatch rider.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Studio Photography Showcase Banner */}
          <div className="mt-10 max-w-4xl mx-auto rounded-3xl overflow-hidden border border-neutral-200/90 shadow-xl relative group text-left">
            <img
              src="/illustrations/hero-showcase.jpg"
              alt="Take Order Apparel & Orders Boutique Collection"
              className="w-full h-auto max-h-[440px] object-cover object-center transform group-hover:scale-[1.01] transition-transform duration-500"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent pointer-events-none" />
            <div className="absolute bottom-6 left-6 right-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4 text-white">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#F5B418] bg-black/40 px-2.5 py-1 rounded-md border border-neutral-700/60 backdrop-blur-xs">
                  Modern Social Commerce
                </span>
                <h3 className="text-xl sm:text-2xl font-extrabold mt-2 tracking-tight text-white drop-shadow-xs">
                  Built for fashion boutiques, streetwear drops, and online merchants
                </h3>
              </div>
              <Link
                href="/sign-up"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white text-neutral-950 text-xs font-bold hover:bg-neutral-100 transition-all shadow-md shrink-0 self-start sm:self-auto cursor-pointer"
              >
                <span>Start Free Trial</span>
                <ArrowRight size={13} className="text-[#F5B418]" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── 2. Metric Stories ("Grow sales like these merchants" - Black & White) ── */}
      <section id="stories" className="py-20 bg-neutral-50 border-y border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12">
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-neutral-800">
                Built for modern social commerce
              </h2>
            </div>
            <p className="text-sm text-neutral-500 max-w-md mt-4 md:mt-0 font-normal leading-relaxed">
              Designed to help online merchants eliminate DM friction, protect inventory, and turn casual chats into confirmed sales.
            </p>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {stories.map((story, idx) => (
              <div
                key={idx}
                className="group p-5 rounded-2xl bg-white border border-neutral-200 hover:border-neutral-900 hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-neutral-100 text-neutral-700">
                    {story.tag}
                  </span>
                  <div className="text-3xl font-extrabold text-neutral-800 mt-4 tracking-tight">
                    {story.metric}
                  </div>
                  <p className="text-xs font-semibold text-neutral-500 mt-1">
                    {story.label}
                  </p>
                </div>

                <div className="mt-8 pt-4 border-t border-neutral-100 flex items-center gap-3">
                  <img
                    src={story.image}
                    alt={story.name}
                    className="w-10 h-10 rounded-full object-cover border border-neutral-200"
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

      {/* ── 3. Feature Tabs ("With Take Order, you get...") ── */}
      <section id="features" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-neutral-800">
              With Take Order, you get more sales, faster order turnaround, zero chaos
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
                    ? 'bg-neutral-900 text-white shadow-xs'
                    : 'bg-neutral-100 border border-neutral-200 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200'
                }`}
              >
                {tab.title}
              </button>
            ))}
          </div>

          {/* Active Tab Panel */}
          <div className="rounded-3xl bg-neutral-50 border border-neutral-200 p-6 sm:p-10 lg:p-12 shadow-xs">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
              {/* Left Column: Description & Value Points */}
              <div className="lg:col-span-6 space-y-6">
                <span className="inline-block px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase bg-neutral-200 text-neutral-800">
                  {featureTabs[activeTab].badge}
                </span>
                <h3 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-neutral-800 leading-tight">
                  {featureTabs[activeTab].headline}
                </h3>
                <p className="text-neutral-600 text-base leading-relaxed">
                  {featureTabs[activeTab].description}
                </p>

                <div className="space-y-3 pt-2">
                  {featureTabs[activeTab].metrics.map((point, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="h-5 w-5 rounded-full bg-neutral-950 text-white flex items-center justify-center shrink-0">
                        <Check size={12} strokeWidth={3} className="text-[#F5B418]" />
                      </div>
                      <span className="text-sm font-semibold text-neutral-800">{point}</span>
                    </div>
                  ))}
                </div>

                <div className="pt-4">
                  <Link
                    href="/sign-up"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-neutral-950 text-white text-sm font-bold hover:bg-neutral-800 shadow-xs transition-all"
                  >
                    <span>Start 7-Day Free Trial</span>
                    <ArrowRight size={14} className="text-[#F5B418]" />
                  </Link>
                </div>
              </div>

              {/* Right Column: Visual Component */}
              <div className="lg:col-span-6">
                <div className="rounded-2xl bg-neutral-950 p-6 text-white shadow-xl border border-neutral-800 min-h-[340px] flex flex-col justify-center">
                  {activeTab === 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between pb-3 border-b border-neutral-800 text-xs">
                        <span className="text-neutral-400 font-mono">takeorder.link/glow</span>
                        <span className="px-2 py-0.5 rounded bg-neutral-800 text-[#F5B418] font-bold text-[10px] border border-neutral-700">
                          Active Bio Link
                        </span>
                      </div>
                      <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-sm">Glow Radiance Serum</span>
                          <span className="font-black text-white">₵180.00</span>
                        </div>
                        <p className="text-xs text-neutral-400">
                          Selected variant: 50ml Bottle • Free dispatch rider within Accra
                        </p>
                        <div className="w-full py-2.5 rounded-lg bg-white text-neutral-950 font-black text-xs text-center">
                          Buy Now via WhatsApp / Card
                        </div>
                      </div>
                      <p className="text-xs text-neutral-400 text-center">
                        ⚡ 83% of buyers complete orders within 45 seconds of tapping.
                      </p>
                    </div>
                  )}

                  {activeTab === 1 && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between pb-3 border-b border-neutral-800 text-xs">
                        <span className="text-neutral-400">Order Verification System</span>
                        <span className="text-neutral-300 font-bold">100% Direct</span>
                      </div>
                      <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 space-y-2">
                        <div className="flex items-center gap-2 text-white font-bold text-sm">
                          <ShieldCheck size={18} className="text-[#F5B418]" />
                          <span>Customer Slip Attached</span>
                        </div>
                        <p className="text-xs text-neutral-300 font-mono">
                          Order Reference: #1042 • ₵320.00
                        </p>
                        <p className="text-[11px] text-neutral-400">
                          Order confirmation slip securely stored with customer record.
                        </p>
                      </div>
                      <div className="flex justify-between text-xs text-neutral-400 px-1">
                        <span>Slip verification: Complete</span>
                        <span>Auto-summary: Sent</span>
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
                        <div className="p-3 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-between text-xs">
                          <div>
                            <p className="font-bold text-white">Esi Mensah</p>
                            <p className="text-neutral-400 text-[11px]">8 orders • ₵2,450 spent</p>
                          </div>
                          <span className="px-2 py-1 rounded bg-neutral-800 text-[#F5B418] font-bold text-[10px] border border-neutral-700">
                            VIP Buyer
                          </span>
                        </div>
                        <div className="p-3 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-between text-xs">
                          <div>
                            <p className="font-bold text-white">Michael Addo</p>
                            <p className="text-neutral-400 text-[11px]">5 orders • ₵1,800 spent</p>
                          </div>
                          <span className="px-2 py-1 rounded bg-neutral-800 text-neutral-300 font-bold text-[10px] border border-neutral-700">
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
                        <span className="text-neutral-300 font-bold">Realtime</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-center">
                        <div className="p-3 rounded-xl bg-neutral-900 border border-neutral-800">
                          <p className="text-xs text-neutral-400">Remaining Stock</p>
                          <p className="text-xl font-black text-white mt-1">42 units</p>
                        </div>
                        <div className="p-3 rounded-xl bg-neutral-900 border border-neutral-800">
                          <p className="text-xs text-neutral-400">Net Profit Margin</p>
                          <p className="text-xl font-black text-white mt-1">68.4%</p>
                        </div>
                      </div>
                      <p className="text-xs text-neutral-400 text-center">
                        Auto-alerts you before stock runs out so you never disappoint buyers.
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
      <section id="how-it-works" className="py-24 bg-neutral-50 border-y border-neutral-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-neutral-800">
              Why modern sellers are leaving manual WhatsApp DM selling behind
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* The Old Way */}
            <div className="p-8 rounded-3xl bg-white border border-neutral-200 space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neutral-100 text-neutral-800 text-xs font-bold uppercase tracking-wider border border-neutral-200">
                <span>The Chaotic DM Way</span>
              </div>
              <h3 className="text-xl font-bold text-neutral-800">
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
                  <span><strong>Items oversold</strong> because inventory is tracked in your head or loose paper notebooks.</span>
                </li>
              </ul>
            </div>

            {/* The Take Order Way */}
            <div className="p-8 rounded-3xl bg-neutral-950 text-white shadow-xl border border-neutral-800 space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neutral-800 text-white text-xs font-bold uppercase tracking-wider border border-neutral-700">
                <span>The Take Order Standard</span>
              </div>
              <h3 className="text-xl font-bold text-white">
                One-tap order link, structured order slips, clean pipeline
              </h3>
              <ul className="space-y-4 text-sm text-neutral-300">
                <li className="flex items-start gap-3">
                  <span className="text-[#F5B418] font-bold text-base mt-0.5">✓</span>
                  <span><strong>38-second average checkout</strong> directly from your Instagram bio, TikTok, or WhatsApp status.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#F5B418] font-bold text-base mt-0.5">✓</span>
                  <span><strong>Customer order slip &amp; delivery details</strong> attached directly to the order record.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#F5B418] font-bold text-base mt-0.5">✓</span>
                  <span><strong>Automatic stock reservation</strong> prevents overselling popular variants.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#F5B418] font-bold text-base mt-0.5">✓</span>
                  <span><strong>Live seller dashboard</strong> with dispatch statuses, customer phone numbers, and profit metrics.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── 5. Pricing Section (Two Paywalls: Pro $9.99/mo and Pro+ $20/mo with Annual 25% Toggle & 7-Day Free Trial) ── */}
      <section id="pricing" className="py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-neutral-800">
              Simple pricing with a 7-day free trial
            </h2>
            <p className="mt-4 text-base sm:text-lg text-neutral-600">
              Zero commissions on your sales. Take Order never touches your customer funds. Cancel anytime with one click.
            </p>

            {/* Billing Cycle Toggle (Annual Save 25% / Monthly) */}
            <div className="mt-8 flex items-center justify-center">
              <div className="inline-flex items-center p-1 rounded-full bg-neutral-100 border border-neutral-200">
                <button
                  type="button"
                  onClick={() => setBillingCycle('monthly')}
                  className={`px-5 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                    billingCycle === 'monthly'
                      ? 'bg-white text-neutral-900 shadow-xs'
                      : 'text-neutral-500 hover:text-neutral-900'
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
                      : 'text-neutral-500 hover:text-neutral-900'
                  }`}
                >
                  <span>Annual</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    billingCycle === 'annual' ? 'bg-[#F5B418] text-neutral-950' : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    Save 25%
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Exactly Two Tiers: Pro and Pro+ */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto items-stretch">
            {/* Pro Plan */}
            <div className="rounded-3xl bg-white border-2 border-neutral-200 p-8 sm:p-10 shadow-xs flex flex-col justify-between hover:border-neutral-800 transition-all">
              <div>
                <div className="flex items-center justify-between">
                  <span className="px-3 py-1 rounded-full bg-neutral-100 text-neutral-800 text-xs font-bold uppercase tracking-wider border border-neutral-200">
                    Pro
                  </span>
                  <span className="text-xs text-neutral-500 font-semibold">
                    {billingCycle === 'annual' ? 'Annual Billing' : 'Monthly Billing'}
                  </span>
                </div>

                <div className="mt-6 flex items-baseline gap-1">
                  <span className="text-4xl sm:text-5xl font-bold text-neutral-800 tracking-tight">
                    {billingCycle === 'annual' ? '$7.49' : '$9.99'}
                  </span>
                  <span className="text-sm font-medium text-neutral-500">/ month</span>
                </div>
                {billingCycle === 'annual' && (
                  <p className="mt-1 text-xs text-neutral-500 font-medium">$89.90 billed annually (save 25%)</p>
                )}

                <p className="mt-3 text-sm text-neutral-600 leading-relaxed">
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
                  className="w-full py-4 rounded-full bg-neutral-950 text-white text-sm font-bold hover:bg-neutral-800 transition-all flex items-center justify-center gap-2 shadow-xs"
                >
                  <span>Start 7-Day Free Trial</span>
                  <ArrowRight size={14} className="text-[#F5B418]" />
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
                  <span className="text-xs text-neutral-400 font-semibold">
                    {billingCycle === 'annual' ? 'Annual Billing' : 'Monthly Billing'}
                  </span>
                </div>

                <div className="mt-6 flex items-baseline gap-1">
                  <span className="text-4xl sm:text-5xl font-bold text-white tracking-tight">
                    {billingCycle === 'annual' ? '$15.00' : '$20.00'}
                  </span>
                  <span className="text-sm font-medium text-neutral-400">/ month</span>
                </div>
                {billingCycle === 'annual' && (
                  <p className="mt-1 text-xs text-neutral-400 font-medium">$180.00 billed annually (save 25%)</p>
                )}

                <p className="mt-3 text-sm text-neutral-300 leading-relaxed">
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
                  className="w-full py-4 rounded-full bg-white text-neutral-950 text-sm font-bold hover:bg-neutral-100 transition-all flex items-center justify-center gap-2 shadow-xs"
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

      {/* ── 6. Frequently Asked Questions (Accordion) ── */}
      <section id="faqs" className="py-24 bg-neutral-50 border-t border-neutral-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-neutral-800">
              Frequently Asked Questions
            </h2>
            <p className="mt-3 text-sm sm:text-base text-neutral-500">
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

      {/* ── 7. Pre-Footer Call to Action ── */}
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
              className="w-full sm:w-auto px-8 py-4 rounded-full bg-white text-neutral-950 text-base font-bold hover:bg-neutral-200 transition-all shadow-lg hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
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

      {/* ── 8. Expanded Footer ── */}
      <footer className="bg-white border-t border-neutral-200 py-24 sm:py-28 text-neutral-600 text-sm">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-10">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-12 lg:gap-16">
            {/* Brand column */}
            <div className="md:col-span-5 space-y-6">
              <Link href="/" className="inline-flex items-center gap-3">
                <img
                  src="/branding/takeorder-icon.png"
                  alt="Take Order"
                  className="h-10 w-10 rounded-xl object-contain shadow-xs"
                />
                <span className="font-bold tracking-tight text-2xl text-neutral-900">
                  Take Order
                </span>
              </Link>
              <p className="text-sm text-neutral-500 max-w-sm leading-relaxed">
                The all-in-one order management and social commerce software platform for independent sellers. Generate instant order links, track inventory stock, and manage customer dispatch records.
              </p>
              <div className="pt-2 text-xs text-neutral-400 space-y-1">
                <p>Support: <a href="mailto:support@usetakeorder.app" className="text-neutral-900 font-semibold underline underline-offset-2">support@usetakeorder.app</a></p>
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
                  <li><button type="button" onClick={() => scrollToSection('features')} className="hover:text-neutral-900 transition-colors cursor-pointer">Order Links</button></li>
                  <li><button type="button" onClick={() => scrollToSection('features')} className="hover:text-neutral-900 transition-colors cursor-pointer">Order Verification</button></li>
                  <li><button type="button" onClick={() => scrollToSection('features')} className="hover:text-neutral-900 transition-colors cursor-pointer">Customer CRM</button></li>
                  <li><button type="button" onClick={() => scrollToSection('features')} className="hover:text-neutral-900 transition-colors cursor-pointer">Stock Management</button></li>
                  <li><button type="button" onClick={() => scrollToSection('pricing')} className="hover:text-neutral-900 transition-colors cursor-pointer">Pricing</button></li>
                </ul>
              </div>

              {/* Legal & Compliance (Crucial for Paddle) */}
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
                    <li><Link href="/dashboard" className="hover:text-neutral-900 transition-colors">Seller Dashboard</Link></li>
                  ) : (
                    <>
                      <li><Link href="/sign-in" className="hover:text-neutral-900 transition-colors">Seller Sign In</Link></li>
                      <li><Link href="/sign-up" className="hover:text-neutral-900 transition-colors">Create Free Account</Link></li>
                    </>
                  )}
                  <li><Link href="/account/billing" className="hover:text-neutral-900 transition-colors">Manage Subscription</Link></li>
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
