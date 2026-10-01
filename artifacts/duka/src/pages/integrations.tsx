import React from 'react';
import { Plug } from 'lucide-react';

export function IntegrationsComingSoonPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center px-6">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800">
        <Plug size={26} />
      </div>
      <p className="text-base text-slate-500 dark:text-slate-400">App integrations coming soon.</p>
    </div>
  );
}
