import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useToast } from "@/components/ui/toast";
import { useRealtimeEvent } from "./store";
import {
  browserNotify,
  playTone,
  requestNotificationPermission,
  speak,
  unlockAudio,
  uzNumber,
} from "./sound";

interface NotifySettings {
  sound: boolean;
  voice: boolean;
  browser: boolean;
}

interface NotifyValue {
  settings: NotifySettings;
  setSettings: (patch: Partial<NotifySettings>) => void;
  enable: () => Promise<void>;
}

const KEY = "yumi.notify.v1";

const NotifyCtx = createContext<NotifyValue | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [settings, setSettingsState] = useState<NotifySettings>(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return { sound: true, voice: false, browser: true, ...JSON.parse(raw) };
    } catch {
      /* noop */
    }
    return { sound: true, voice: false, browser: true };
  });

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(settings));
    } catch {
      /* noop */
    }
  }, [settings]);

  // unlock audio on first user gesture (autoplay policy)
  useEffect(() => {
    const unlock = () => {
      unlockAudio();
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  const setSettings = useCallback((patch: Partial<NotifySettings>) => {
    setSettingsState((s) => ({ ...s, ...patch }));
  }, []);

  const enable = useCallback(async () => {
    unlockAudio();
    const granted = await requestNotificationPermission();
    setSettingsState((s) => ({ ...s, sound: true, browser: granted }));
  }, []);

  useRealtimeEvent((e) => {
    const voice = (text: string) => {
      if (settings.sound) playTone(e.type === "ORDER_READY" ? "ready" : e.type === "WAITER_CALLED" ? "call" : "order");
      if (settings.voice) speak(text);
    };

    switch (e.type) {
      case "ORDER_CREATED":
        voice(`Yangi buyurtma. Stol ${uzNumber(e.tableNumber ?? 0)}`);
        toast({ type: "notify", title: "Yangi buyurtma", body: `Stol ${e.tableNumber ?? "—"} · #${String(e.orderNumber ?? 0).padStart(4, "0")}` });
        if (settings.browser) browserNotify("Yangi buyurtma", `Stol ${e.tableNumber ?? "—"}`);
        break;
      case "ORDER_READY":
        voice(`Stol ${uzNumber(e.tableNumber ?? 0)} buyurtmasi tayyor`);
        toast({ type: "success", title: "Buyurtma tayyor!", body: `Stol ${e.tableNumber ?? "—"}` });
        if (settings.browser) browserNotify("Buyurtma tayyor", `Stol ${e.tableNumber ?? "—"}`);
        break;
      case "WAITER_CALLED":
        voice(`Stol ${uzNumber(e.tableNumber ?? 0)} ofitsant chaqirmoqda`);
        toast({ type: "notify", title: "Ofitsant chaqirilmoqda", body: `Stol №${e.tableNumber ?? "—"}` });
        if (settings.browser) browserNotify("Ofitsant chaqirilmoqda", `Stol №${e.tableNumber ?? "—"}`);
        break;
      case "PAYMENT_REQUESTED":
        voice(`Stol ${uzNumber(e.tableNumber ?? 0)} hisob so‘ramoqda`);
        toast({ type: "notify", title: "Hisob so‘ralmoqda", body: `Stol №${e.tableNumber ?? "—"}` });
        break;
      case "ORDER_DELIVERED":
        voice("Buyurtma yetkazildi");
        toast({ type: "success", title: "Buyurtma yetkazildi", body: `Stol ${e.tableNumber ?? "—"}` });
        break;
      case "ORDER_COMPLETED":
        toast({ type: "success", title: "To‘lov yakunlandi", body: `Stol ${e.tableNumber ?? "—"}` });
        break;
      case "ORDER_CANCELLED":
        toast({ type: "error", title: "Buyurtma bekor qilindi", body: e.orderNumber ? `#${String(e.orderNumber).padStart(4, "0")}` : undefined });
        break;
      default:
        break;
    }
  });

  const value = useMemo(() => ({ settings, setSettings, enable }), [settings, setSettings, enable]);
  return <NotifyCtx.Provider value={value}>{children}</NotifyCtx.Provider>;
}

export function useNotify(): NotifyValue {
  const ctx = useContext(NotifyCtx);
  if (!ctx) throw new Error("useNotify must be used within NotificationProvider");
  return ctx;
}
