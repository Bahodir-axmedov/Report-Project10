import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  Home,
  Info,
  LayoutGrid,
  Route,
  ShoppingBag,
  X,
} from "lucide-react";
import { Brand } from "@/components/Brand";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { WaiterCallButton } from "./WaiterCallButton";
import { useCustomer } from "@/lib/customer";
import { useCart, cartCount } from "@/lib/cart";
import { useI18n } from "@/lib/i18n";
import { api, useDB } from "@/lib/store";
import { cn, fmtTime } from "@/lib/utils";

// No profile/registration anywhere in the guest app: track by order number.
const NAV: { to: string; label: string; icon: typeof Home; end?: boolean }[] = [
  { to: "/", label: "home", icon: Home, end: true },
  { to: "/menu", label: "menu", icon: LayoutGrid },
  { to: "/cart", label: "cart", icon: ShoppingBag },
  { to: "/track", label: "tracking", icon: Route },
];

export function CustomerShell() {
  const { table, session, sessionKey, leave } = useCustomer();
  const lines = useCart(sessionKey);
  const count = cartCount(lines);
  const { t } = useI18n();
  const db = useDB();
  const navigate = useNavigate();
  const location = useLocation();
  const [notifOpen, setNotifOpen] = useState(false);

  const sessionId = session?.id ?? null;

  // ---- live presence: what this table is viewing and what is in the cart ----
  const cartKey = useMemo(
    () => JSON.stringify(lines.map((l) => [l.productId, l.qty])),
    [lines]
  );
  const cartSnapshot = useMemo(
    () => JSON.parse(cartKey) as [string, number][],
    [cartKey]
  );
  useEffect(() => {
    if (!sessionId) return;
    api.touchSession(sessionId, {
      cart: cartSnapshot.map(([productId, qty]) => ({ productId, qty })),
      state: cartSnapshot.length ? "ORDERED" : "BROWSING",
    });
  }, [sessionId, cartSnapshot]);

  useEffect(() => {
    if (!sessionId) return;
    api.touchSession(sessionId, {
      viewing: location.pathname,
      lastProductId: location.pathname.startsWith("/menu/p/")
        ? location.pathname.replace("/menu/p/", "")
        : null,
    });
  }, [sessionId, location.pathname]);

  // heartbeat so the admin live monitor knows the guest is still connected
  useEffect(() => {
    if (!sessionId) return;
    const t = setInterval(() => api.touchSession(sessionId, {}), 25_000);
    return () => clearInterval(t);
  }, [sessionId]);

  const myNotifs = db.notifications.filter((n) => n.audience === "customer" && n.sessionId === sessionKey);
  const unread = myNotifs.filter((n) => !n.read);

  return (
    <div className="min-h-full bg-background pb-24 lg:pb-0">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
          <Link to="/" className="flex items-center">
            <Brand size="sm" />
          </Link>
          {table && (
            <span className="rounded-full border border-primary/40 bg-primary/15 px-3 py-1 text-xs font-bold text-primary">
              {t("table")} №{table.number}
            </span>
          )}
          <div className="flex-1" />
          <div className="hidden sm:block">
            <LanguageSwitcher compact />
          </div>
          <div className="relative">
            <button
              onClick={() => setNotifOpen((o) => !o)}
              aria-label={t("notifications")}
              className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-secondary/60 transition hover:bg-white/10"
            >
              <Bell style={{ height: 18, width: 18 }} />
              {unread.length > 0 && (
                <span
                  className="absolute -right-1 -top-1 flex items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground"
                  style={{ height: 18, minWidth: 18 }}
                >
                  {unread.length}
                </span>
              )}
            </button>
            <AnimatePresence>
              {notifOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setNotifOpen(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.98 }}
                    className="glass absolute right-0 top-12 z-20 w-80 max-w-[86vw] overflow-hidden rounded-2xl"
                  >
                    <div className="flex items-center justify-between border-b border-border px-4 py-3">
                      <span className="text-sm font-bold">{t("notifications")}</span>
                      <button onClick={() => api.markAllNotificationsRead("customer")} className="text-xs text-primary">
                        {t("all")}
                      </button>
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {myNotifs.length === 0 && (
                        <p className="px-4 py-6 text-center text-sm text-muted-foreground">{t("empty_orders")}</p>
                      )}
                      {myNotifs.slice(0, 20).map((n) => (
                        <button
                          key={n.id}
                          onClick={() => api.markNotificationRead(n.id)}
                          className={cn(
                            "flex w-full flex-col gap-0.5 border-b border-border/60 px-4 py-3 text-left transition hover:bg-white/5",
                            !n.read && "bg-primary/5"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold">{n.title}</span>
                            <span className="text-[10px] text-muted-foreground">{fmtTime(n.at)}</span>
                          </div>
                          <span className="text-xs text-muted-foreground">{n.body}</span>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl gap-8 px-4">
        <aside className="hidden w-60 shrink-0 py-6 lg:block">
          <nav className="sticky top-24 space-y-1.5">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition",
                    isActive
                      ? "bg-primary text-primary-foreground glow-red"
                      : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                  )
                }
              >
                <item.icon className="h-5 w-5" />
                <span className="flex-1">{t(item.label)}</span>
                {item.label === "cart" && count > 0 && (
                  <span className="rounded-full bg-black/25 px-2 py-0.5 text-xs">{count}</span>
                )}
              </NavLink>
            ))}
            <div className="pt-3">
              <LanguageSwitcher />
            </div>
            <div className="mt-4 space-y-2">
              <WaiterCallButton variant="sidebar" />
              <Link
                to="/about"
                className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-muted-foreground transition hover:bg-white/5 hover:text-foreground"
              >
                <Info className="h-5 w-5" /> {t("about")}
              </Link>
              {table && (
                <button
                  onClick={() => {
                    leave();
                    navigate("/");
                  }}
                  className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-muted-foreground transition hover:bg-white/5 hover:text-foreground"
                >
                  <X className="h-5 w-5" /> {t("logout")}
                </button>
              )}
            </div>
          </nav>
        </aside>

        <main className="min-w-0 flex-1 py-4">
          <Outlet />
        </main>
      </div>

      <div className="fixed bottom-24 right-4 z-30 lg:hidden">
        <WaiterCallButton variant="fab" />
      </div>

      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/90 pb-1 pt-1.5 backdrop-blur-xl lg:hidden">
        <div className="flex items-stretch justify-around">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "relative mx-0.5 flex flex-1 flex-col items-center gap-1 rounded-2xl py-2 text-[10px] font-semibold transition",
                  isActive ? "bg-primary/10 text-primary" : "text-muted-foreground active:bg-white/5"
                )
              }
            >
              {({ isActive }) => (
                <>
                  <div className="relative">
                    <item.icon style={{ height: 22, width: 22 }} />
                    {item.label === "cart" && count > 0 && (
                      <span
                        className="absolute -right-2 -top-2 flex items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground"
                        style={{ minWidth: 16, height: 16 }}
                      >
                        {count}
                      </span>
                    )}
                    {isActive && (
                      <motion.span
                        layoutId="navdot"
                        className="absolute -bottom-2 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-primary"
                      />
                    )}
                  </div>
                  <span className="leading-none">{t(item.label)}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
