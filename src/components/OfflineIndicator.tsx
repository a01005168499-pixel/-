import React, { useState } from 'react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { WifiOff, X } from 'lucide-react';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  const [isDismissed, setIsDismissed] = useState(false);

  if (isOnline || isDismissed) return null;

  return (
    <aside
      aria-label="حالة الاتصال بالإنترنت"
      className="fixed bottom-4 left-4 right-4 sm:right-auto sm:max-w-md z-50 flex items-center justify-between gap-3 rounded-2xl bg-amber-500/95 text-slate-950 px-4 py-3 shadow-2xl backdrop-blur-md border border-amber-300 font-sans"
    >
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-amber-400">
          <WifiOff className="h-4 w-4" />
        </div>
        <div>
          <p className="text-xs font-bold leading-tight">وضع العمل بدون إنترنت (Offline)</p>
          <p className="text-[11px] text-slate-900 leading-tight mt-0.5">
            التطبيق يعمل بكامل طاقته 100% محلياً: إصدار وحفظ الفواتير، الباركود، وإدارة الديون.
          </p>
        </div>
      </div>
      <button
        onClick={() => setIsDismissed(true)}
        className="rounded-lg p-1 text-slate-950/70 hover:text-slate-950 hover:bg-black/10 transition"
        title="إغلاق التنبيه"
      >
        <X className="h-4 w-4" />
      </button>
    </aside>
  );
};
