import React from 'react';
import { Link } from 'wouter';
import {
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Clock,
  Layers,
  ArrowUpRight,
  ExternalLink,
} from 'lucide-react';
import { SiWhatsapp, SiInstagram, SiTiktok } from 'react-icons/si';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export function IntegrationsComingSoonPage() {
  const upcomingIntegrations = [
    {
      name: 'WhatsApp Business Cloud API',
      category: 'Messaging & Automation',
      description: 'Automatically trigger order confirmation messages, interactive dispatch receipts, and payment reminders directly from your registered WhatsApp Business number.',
      status: 'In Private Beta',
      icon: SiWhatsapp,
      iconColor: 'text-[#25D366]',
      bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    },
    {
      name: 'Instagram DM & Story Automation',
      category: 'Social Commerce',
      description: 'Auto-reply to Instagram DM product queries with customized Take Order links when potential buyers comment keywords like "PRICE" or "ORDER" on your posts.',
      status: 'Coming Q4 2026',
      icon: SiInstagram,
      iconColor: 'text-pink-600',
      bg: 'bg-pink-50 dark:bg-pink-950/40',
    },
    {
      name: 'TikTok Direct Order Sync',
      category: 'Short Video Commerce',
      description: 'Streamline video viewers into completed orders with bio-link optimization and catalog synchronization for TikTok live sellers.',
      status: 'Under Development',
      icon: SiTiktok,
      iconColor: 'text-slate-900 dark:text-white',
      bg: 'bg-slate-100 dark:bg-slate-800',
    },
    {
      name: 'Google Sheets Live Sync',
      category: 'Accounting & Warehousing',
      description: 'Instantly append every completed order, customer address, and payout slip into your own private Google Sheet in real time without manual exporting.',
      status: 'Coming Soon',
      icon: Layers,
      iconColor: 'text-emerald-700',
      bg: 'bg-emerald-100/60 dark:bg-emerald-950/40',
    },
    {
      name: 'Direct Mobile Money & Bank Payouts',
      category: 'Settlements',
      description: 'Direct settlement gateways enabling automated buyer verification through Paystack and Flutterwave rails with same-day bank deposits.',
      status: 'Coming Soon',
      icon: CheckCircle2,
      iconColor: 'text-blue-600',
      bg: 'bg-blue-50 dark:bg-blue-950/40',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Top Banner */}
      <div className="rounded-3xl border border-slate-200/90 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-8 sm:p-12 text-white shadow-md relative overflow-hidden">
        <div className="max-w-2xl relative z-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-amber-300 backdrop-blur-xs mb-4">
            <Sparkles size={13} className="text-amber-400" />
            <span>Integrations Ecosystem</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white">
            Connect Take Order with the tools you run every day
          </h1>
          <p className="mt-3 text-sm sm:text-base text-slate-300 leading-relaxed">
            We are building native, zero-friction connections between your social media inboxes, dispatch couriers, and spreadsheets.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
              <Clock size={14} className="text-emerald-400" />
              <span>Rollout starting Q4 2026</span>
            </span>
          </div>
        </div>
      </div>

      {/* Grid of integrations */}
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {upcomingIntegrations.map((item) => {
          const Icon = item.icon;
          return (
            <Card
              key={item.name}
              className="flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 transition-all"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${item.bg}`}>
                    <Icon size={22} className={item.iconColor} />
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    {item.status}
                  </span>
                </div>
                <div className="mt-4">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    {item.category}
                  </span>
                  <h3 className="mt-1 text-base font-bold text-slate-950 dark:text-white">
                    {item.name}
                  </h3>
                  <p className="mt-2 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-500">Coming soon</span>
                <span className="text-[11px] font-bold text-slate-400">Request priority access →</span>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
