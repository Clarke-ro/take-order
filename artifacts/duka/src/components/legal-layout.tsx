import React, { type ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { ArrowLeft, FileText, Shield, RefreshCw, Mail, CheckCircle2 } from 'lucide-react';

interface LegalLayoutProps {
  title: string;
  subtitle: string;
  lastUpdated: string;
  activeTab: 'terms' | 'privacy' | 'refunds';
  children: ReactNode;
}

export function LegalLayout({
  title,
  subtitle,
  lastUpdated,
  activeTab,
  children,
}: LegalLayoutProps) {
  const [location] = useLocation();

  const tabs = [
    { id: 'terms', label: 'Terms of Service', href: '/terms', icon: FileText },
    { id: 'privacy', label: 'Privacy Policy', href: '/privacy', icon: Shield },
    { id: 'refunds', label: 'Refund & Cancellation', href: '/refund-policy', icon: RefreshCw },
  ];

  return (
    <div className="min-h-screen bg-white text-neutral-900 font-sans selection:bg-amber-100 selection:text-amber-900">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-neutral-200/80">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-2 group text-sm font-semibold text-neutral-700 hover:text-neutral-900 transition-colors"
            >
              <div className="h-8 w-8 rounded-lg bg-neutral-900 flex items-center justify-center text-white font-bold text-base shadow-xs group-hover:bg-neutral-800 transition-colors">
                T
              </div>
              <span className="font-extrabold tracking-tight text-lg text-neutral-900">
                Take Order
              </span>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined' && window.history.length > 1) {
                  window.history.back();
                } else {
                  window.location.href = '/';
                }
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 bg-white text-xs font-semibold text-neutral-700 hover:text-neutral-900 hover:bg-neutral-50 shadow-2xs transition-all cursor-pointer"
            >
              <ArrowLeft size={13} />
              <span>Back</span>
            </button>
            <Link
              href="/dashboard"
              className="inline-flex items-center px-3.5 py-1.5 rounded-lg bg-neutral-900 text-white text-xs font-semibold hover:bg-neutral-800 shadow-xs transition-colors"
            >
              Open Dashboard
            </Link>
          </div>
        </div>

        {/* Legal Document Tabs */}
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-2 -mb-px">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <Link
                  key={tab.id}
                  href={tab.href}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    isActive
                      ? 'bg-neutral-900 text-white shadow-xs'
                      : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/50'
                  }`}
                >
                  <Icon size={14} className={isActive ? 'text-amber-400' : 'text-neutral-400'} />
                  <span>{tab.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        {/* Document Header */}
        <div className="mb-10 pb-8 border-b border-neutral-200">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-800 text-[11px] font-bold uppercase tracking-wider mb-4">
            <CheckCircle2 size={13} className="text-amber-600" />
            <span>Official Policy</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-neutral-900 mb-3">
            {title}
          </h1>
          <p className="text-base text-neutral-600 leading-relaxed max-w-2xl mb-4">
            {subtitle}
          </p>
          <div className="flex flex-wrap items-center gap-4 text-xs text-neutral-500">
            <span>Last updated: {lastUpdated}</span>
            <span>·</span>
            <span>Applies to sellers & buyers</span>
            <span>·</span>
            <span>Republic of Ghana</span>
          </div>
        </div>

        {/* Legal Text Body */}
        <div className="prose prose-neutral max-w-none prose-headings:font-bold prose-headings:tracking-tight prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-3 prose-p:text-neutral-700 prose-p:leading-relaxed prose-li:text-neutral-700 prose-strong:text-neutral-900">
          {children}
        </div>

        {/* Contact Banner */}
        <div className="mt-14 p-6 sm:p-8 rounded-2xl border border-neutral-200 bg-white shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-neutral-900 mb-1">
                Have questions about our software terms or subscriptions?
              </h3>
              <p className="text-xs text-neutral-500 leading-relaxed">
                Take Order Technologies • Accra, Ghana • Support &amp; compliance team ready to assist.
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <a
                href="mailto:support@usetakeorder.app"
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-neutral-900 text-white text-xs font-semibold hover:bg-neutral-800 shadow-xs transition-colors"
              >
                <Mail size={14} />
                <span>support@usetakeorder.app</span>
              </a>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-200/80 bg-white py-8 mt-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-neutral-500">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <span className="font-bold text-neutral-900">Take Order Technologies</span>
            <span>·</span>
            <span>Accra, Ghana</span>
            <span>·</span>
            <span>© 2026. All rights reserved.</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/terms" className="hover:text-neutral-900 transition-colors">
              Terms of Service
            </Link>
            <span>·</span>
            <Link href="/privacy" className="hover:text-neutral-900 transition-colors">
              Privacy Policy
            </Link>
            <span>·</span>
            <Link href="/refund-policy" className="hover:text-neutral-900 transition-colors">
              Refund Policy
            </Link>
          </div>
        </div>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 mt-3 text-center text-[11px] text-neutral-400">
          Take Order is a B2B Software-as-a-Service (SaaS) platform. Paddle.com is the authorized Merchant of Record for all Take Order Pro subscriptions.
        </div>
      </footer>
    </div>
  );
}
