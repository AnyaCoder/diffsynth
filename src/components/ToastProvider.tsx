'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { registerToastHandler } from '@/utils/api';

type ToastTone = 'success' | 'error' | 'warning' | 'info';

export interface ToastInput {
  title: string;
  description?: string;
  tone?: ToastTone;
  durationMs?: number;
}

interface ToastRecord extends Required<ToastInput> {
  id: string;
  createdAt: number;
}

interface ToastContextValue {
  pushToast: (input: ToastInput) => string;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION_MS = 4200;

const toneStyles: Record<ToastTone, { shell: string; icon: string; progress: string; Icon: typeof Info }> = {
  success: {
    shell: 'border-emerald-800/60 bg-[#0f1416]/95 text-[#eefaf4] shadow-[0_18px_46px_rgba(0,0,0,0.28)]',
    icon: 'text-emerald-400',
    progress: 'from-emerald-400 via-emerald-500 to-lime-400',
    Icon: CheckCircle2,
  },
  error: {
    shell: 'border-rose-900/70 bg-[#171112]/95 text-[#fff1f3] shadow-[0_18px_46px_rgba(0,0,0,0.28)]',
    icon: 'text-rose-400',
    progress: 'from-rose-400 via-rose-500 to-orange-400',
    Icon: AlertCircle,
  },
  warning: {
    shell: 'border-amber-900/70 bg-[#17130f]/95 text-[#fff7ed] shadow-[0_18px_46px_rgba(0,0,0,0.28)]',
    icon: 'text-amber-400',
    progress: 'from-amber-300 via-amber-400 to-yellow-300',
    Icon: AlertTriangle,
  },
  info: {
    shell: 'border-sky-900/70 bg-[#0f1418]/95 text-[#eff8ff] shadow-[0_18px_46px_rgba(0,0,0,0.28)]',
    icon: 'text-sky-400',
    progress: 'from-sky-300 via-sky-400 to-cyan-300',
    Icon: Info,
  },
};

export default function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const timeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismissToast = useCallback((id: string) => {
    const existing = timeoutsRef.current.get(id);
    if (existing) {
      clearTimeout(existing);
      timeoutsRef.current.delete(id);
    }
    setToasts(current => current.filter(toast => toast.id !== id));
  }, []);

  const pushToast = useCallback((input: ToastInput) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const toast: ToastRecord = {
      id,
      title: input.title,
      description: input.description ?? '',
      tone: input.tone ?? 'info',
      durationMs: input.durationMs ?? DEFAULT_DURATION_MS,
      createdAt: Date.now(),
    };
    setToasts(current => [...current.slice(-3), toast]);
    const timeout = setTimeout(() => dismissToast(id), toast.durationMs);
    timeoutsRef.current.set(id, timeout);
    return id;
  }, [dismissToast]);

  useEffect(() => {
    registerToastHandler(payload => pushToast(payload));
    return () => {
      registerToastHandler(null);
      for (const timeout of timeoutsRef.current.values()) {
        clearTimeout(timeout);
      }
      timeoutsRef.current.clear();
    };
  }, [pushToast]);

  const value = useMemo(() => ({ pushToast, dismissToast }), [pushToast, dismissToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-5 top-5 z-[120] flex w-[min(92vw,22.5rem)] flex-col gap-2.5">
        {toasts.map(toast => (
          <ToastCard key={toast.id} toast={toast} onDismiss={() => dismissToast(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}

function ToastCard({ toast, onDismiss }: { toast: ToastRecord; onDismiss: () => void }) {
  const { shell, icon, progress, Icon } = toneStyles[toast.tone];

  return (
    <div className={`pointer-events-auto relative overflow-hidden rounded-[18px] border px-4 py-3.5 backdrop-blur-2xl ${shell}`}>
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),transparent_34%)]" />
      <div className="relative flex items-start gap-3">
        <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border border-white/8 bg-white/[0.035] ${icon}`}>
          <Icon className="h-4.5 w-4.5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold tracking-[0.01em]">{toast.title}</div>
          {toast.description ? <div className="mt-1 text-[12px] leading-5 text-white/68">{toast.description}</div> : null}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-full border border-white/8 bg-white/[0.03] p-1.5 text-white/45 transition hover:bg-white/[0.08] hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="relative mt-3.5 h-[3px] overflow-hidden rounded-full bg-white/8">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${progress} shadow-[0_0_18px_rgba(255,255,255,0.08)]`}
          style={{
            width: '100%',
            transformOrigin: 'left center',
            animation: `toast-shrink ${toast.durationMs}ms linear forwards`,
          }}
        />
      </div>
    </div>
  );
}
