import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Info, X, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { uid } from "@/lib/utils";

export type ToastType = "success" | "error" | "info" | "notify";

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  body?: string;
  duration?: number;
}

interface ToastValue {
  toast: (t: Omit<Toast, "id">) => void;
}

const ToastCtx = createContext<ToastValue | null>(null);

const ICONS: Record<ToastType, ReactNode> = {
  success: <CheckCircle2 className="h-5 w-5 text-[hsl(var(--success))]" />,
  error: <AlertTriangle className="h-5 w-5 text-[hsl(var(--destructive))]" />,
  info: <Info className="h-5 w-5 text-sky-400" />,
  notify: <Bell className="h-5 w-5 text-[hsl(var(--primary))]" />,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const toast = useCallback(
    (t: Omit<Toast, "id">) => {
      const id = uid("t");
      const item: Toast = { id, duration: 4200, ...t };
      setToasts((prev) => [...prev.slice(-3), item]);
      if (item.duration) setTimeout(() => dismiss(id), item.duration);
    },
    [dismiss]
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[200] flex flex-col items-center gap-2 px-3 sm:left-auto sm:right-4 sm:items-end">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: -16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
              className={cn(
                "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border p-3.5 shadow-2xl backdrop-blur-xl",
                "glass"
              )}
            >
              <div className="mt-0.5 shrink-0">{ICONS[t.type]}</div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-tight">{t.title}</p>
                {t.body && <p className="mt-0.5 text-xs text-muted-foreground">{t.body}</p>}
              </div>
              <button
                onClick={() => dismiss(t.id)}
                aria-label="Yopish"
                className="shrink-0 rounded-full p-1 text-muted-foreground transition hover:bg-white/10 hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast(): ToastValue {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
