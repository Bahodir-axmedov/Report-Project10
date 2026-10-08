import { useEffect, useMemo } from "react";
import {
  Activity,
  Bell,
  CircleDollarSign,
  Eye,
  Percent,
  ShoppingBag,
  TrendingUp,
  Users,
  Wifi,
  WifiOff,
} from "lucide-react";
import { Badge, Card, EmptyState, Progress } from "@/components/ui/primitives";
import { StaffPageTitle } from "@/components/staff/StaffHeader";
import { ORDER_STATUS_TONE } from "@/components/staff/widgets";
import { api, useDB, useNow } from "@/lib/store";
import { activeOrdersForTable, profitIn, tableSessionTotal } from "@/lib/reporting";
import { cn, endOfDay, fmtNumber, startOfDay, ORDER_STATUS_LABELS } from "@/lib/utils";

/** Sessions with no heartbeat for this long are shown as disconnected. */
const LIVE_WINDOW = 2 * 60_000;

function ago(ts: number, now: number): string {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 60) return `${s} soniya oldin`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} daqiqa oldin`;
  const h = Math.round(m / 60);
  return `${h} soat oldin`;
}

function viewingLabel(path: string): string {
  if (path.startsWith("/menu/p/")) return "Taomni ko‘rmoqda";
  if (path.startsWith("/menu/c/")) return "Kategoriyani ko‘rmoqda";
  if (path.startsWith("/cart")) return "Savatda";
  if (path.startsWith("/checkout")) return "Buyurtma bermoqda";
  if (path.startsWith("/orders") || path.startsWith("/order/")) return "Buyurtmasini kuzatmoqda";
  if (path.startsWith("/profile")) return "Profil";
  if (path.startsWith("/categories")) return "Menyu bo‘limida";
  return "Menyuni ko‘rmoqda";
}

export default function LiveMonitor() {
  const db = useDB();
  const now = useNow(5_000);

  // House-keeping: a table whose guest stopped sending heartbeats is freed.
  useEffect(() => {
    api.pruneSessions(20 * 60_000);
  }, []);

  const today = useMemo(() => profitIn(db, startOfDay(), endOfDay()), [db, now]);
  const week = useMemo(
    () => profitIn(db, startOfDay(new Date(Date.now() - 6 * 86400000)), endOfDay()),
    [db, now]
  );
  const month = useMemo(() => {
    const d = new Date();
    return profitIn(db, new Date(d.getFullYear(), d.getMonth(), 1).getTime(), endOfDay());
  }, [db, now]);

  const liveSessions = db.sessions
    .filter((s) => s.active)
    .sort((a, b) => (b.lastActivityAt ?? 0) - (a.lastActivityAt ?? 0));

  const byTable = new Map(liveSessions.map((s) => [s.tableId, s]));
  const pendingCalls = db.calls.filter((c) => c.status === "PENDING");

  const money = (n: number) => `${fmtNumber(n)} so‘m`;

  return (
    <div className="space-y-5">
      <StaffPageTitle
        title="Jonli monitoring"
        subtitle="Qaysi stolda odam bor, nima tanlayapti, savatiga nima qo‘shgan — hammasi real vaqtda"
        action={
          <span className="inline-flex items-center gap-2 rounded-xl border border-[hsl(var(--success))]/40 bg-[hsl(var(--success))]/10 px-3 py-2 text-xs font-semibold text-[hsl(var(--success))]">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[hsl(var(--success))] opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[hsl(var(--success))]" />
            </span>
            LIVE
          </span>
        }
      />

      {/* ---------------- profit strip ---------------- */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { label: "Kunlik foyda", p: today, icon: CircleDollarSign },
          { label: "Haftalik foyda", p: week, icon: TrendingUp },
          { label: "Oylik foyda", p: month, icon: Activity },
        ].map(({ label, p, icon: Icon }) => (
          <Card key={label} className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
              <Icon className="h-4 w-4 text-primary" />
            </div>
            <p
              className={cn(
                "mt-2 font-display text-2xl font-extrabold leading-none",
                p.profit >= 0 ? "text-[hsl(var(--success))]" : "text-destructive"
              )}
            >
              {money(p.profit)}
            </p>
            <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Savdo: {money(p.revenue)}</span>
              <span>Tannarx: {money(p.cost)}</span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <Progress value={p.marginPct} />
              <span className="shrink-0 text-[11px] font-semibold">{p.marginPct}%</span>
            </div>
          </Card>
        ))}
      </div>

      {/* ---------------- table grid ---------------- */}
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-display text-base font-bold">
            <Eye className="h-4 w-4 text-primary" /> Stollar holati
          </h2>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-destructive" /> band / odam bor
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[hsl(var(--warning))]" /> kutilmoqda
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-sky-400" /> hisob
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[hsl(var(--success))]" /> bo‘sh
            </span>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {db.tables.map((t) => {
            const session = byTable.get(t.id);
            const orders = activeOrdersForTable(db, t.id);
            const sessionTotal = tableSessionTotal(db, t.id);
            const hasCall = pendingCalls.some((c) => c.tableNumber === t.number);
            const isLive = session ? now - (session.lastActivityAt ?? 0) < LIVE_WINDOW : false;

            return (
              <div
                key={t.id}
                className={cn(
                  "rounded-2xl border bg-card/60 p-3.5 transition",
                  t.status === "EMPTY" && !session
                    ? "border-[hsl(var(--success))]/30"
                    : t.status === "BILL"
                    ? "border-sky-400/40"
                    : "border-destructive/40"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-xl font-display text-sm font-extrabold",
                        t.status === "EMPTY" && !session
                          ? "bg-[hsl(var(--success))]/15 text-[hsl(var(--success))]"
                          : "bg-primary/15 text-primary"
                      )}
                    >
                      {t.number}
                    </span>
                    <div className="leading-tight">
                      <p className="text-sm font-bold">Stol {t.number}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {t.zone} · {t.seats} joy
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {session ? (
                      isLive ? (
                        <Badge tone="success">
                          <Wifi className="h-3 w-3" /> online
                        </Badge>
                      ) : (
                        <Badge tone="warning">
                          <WifiOff className="h-3 w-3" /> uzilgan
                        </Badge>
                      )
                    ) : (
                      <Badge>Bo‘sh</Badge>
                    )}
                    {hasCall && (
                      <Badge tone="danger">
                        <Bell className="h-3 w-3" /> chaqiruv
                      </Badge>
                    )}
                  </div>
                </div>

                {session ? (
                  <div className="mt-3 space-y-2">
                    <div className="rounded-xl bg-secondary/40 px-3 py-2">
                      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        <Users className="h-3 w-3" /> Hozir nima qilmoqda
                      </p>
                      <p className="mt-0.5 text-xs font-medium">{viewingLabel(session.viewing)}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        Aktivlik: {ago(session.lastActivityAt ?? session.createdAt, now)}
                      </p>
                    </div>

                    <div className="rounded-xl bg-secondary/40 px-3 py-2">
                      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        <ShoppingBag className="h-3 w-3" /> Savatida ({session.cart.length})
                      </p>
                      {session.cart.length === 0 ? (
                        <p className="mt-1 text-xs text-muted-foreground">Savat hozircha bo‘sh</p>
                      ) : (
                        <ul className="mt-1 space-y-1">
                          {session.cart.slice(0, 4).map((line) => {
                            const p = db.products.find((x) => x.id === line.productId);
                            return (
                              <li key={line.productId} className="flex items-center justify-between gap-2 text-xs">
                                <span className="min-w-0 flex-1 truncate">{p?.nameRu ?? "Mahsulot"}</span>
                                <span className="shrink-0 font-semibold text-primary">×{line.qty}</span>
                              </li>
                            );
                          })}
                          {session.cart.length > 4 && (
                            <li className="text-[11px] text-muted-foreground">
                              +{session.cart.length - 4} ta yana
                            </li>
                          )}
                        </ul>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="mt-3 rounded-xl bg-secondary/30 px-3 py-4 text-center text-xs text-muted-foreground">
                    Hozircha hech kim QR skanerlamagan
                  </p>
                )}

                {orders.length > 0 && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {orders.map((o) => (
                      <Badge key={o.id} tone={ORDER_STATUS_TONE[o.status]}>
                        #{String(o.number).padStart(4, "0")} · {ORDER_STATUS_LABELS[o.status].uz}
                      </Badge>
                    ))}
                    <Badge tone="primary">Hisob: {money(sessionTotal)}</Badge>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* ---------------- live guests ---------------- */}
      <Card className="p-5">
        <h2 className="flex items-center gap-2 font-display text-base font-bold">
          <Users className="h-4 w-4 text-primary" /> Hozir zalda ({liveSessions.length})
        </h2>
        {liveSessions.length === 0 ? (
          <EmptyState
            icon={<Users className="h-7 w-7" />}
            title="Hozir aktiv mijoz yo‘q"
            description="Mijoz stol QR kodini skanerlaganda bu ro‘yxat real vaqtda to‘ldiriladi."
          />
        ) : (
          <div className="mt-4 space-y-2">
            {liveSessions.map((s) => {
              const t = db.tables.find((x) => x.id === s.tableId);
              const orders = activeOrdersForTable(db, s.tableId);
              const total = tableSessionTotal(db, s.tableId);
              const cartValue = s.cart.reduce((sum, line) => {
                const p = db.products.find((x) => x.id === line.productId);
                return sum + (p?.price ?? 0) * line.qty;
              }, 0);
              return (
                <div
                  key={s.id}
                  className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-secondary/30 px-3.5 py-3"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary font-display text-sm font-extrabold text-primary-foreground">
                    {t?.number ?? "—"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">
                      Stol {t?.number ?? "—"} · {viewingLabel(s.viewing)}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Savat: {s.cart.reduce((n, l) => n + l.qty, 0)} dona ({money(cartValue)}) ·{" "}
                      {s.cart.length ? "tanlab bo‘ldi" : "hali tanlamoqda"} ·{" "}
                      {ago(s.lastActivityAt ?? s.createdAt, now)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {orders.map((o) => (
                      <Badge key={o.id} tone={ORDER_STATUS_TONE[o.status]}>
                        #{String(o.number).padStart(4, "0")}
                      </Badge>
                    ))}
                    {total > 0 && <Badge tone="primary">{money(total)}</Badge>}
                    {now - (s.lastActivityAt ?? 0) > LIVE_WINDOW && <Badge tone="warning">uzilgan</Badge>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <p className="mt-4 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Percent className="h-3 w-3" />
          Foyda = savdo − tannarx. Har bir buyurtma qatorida tannarx saqlanadi, shuning uchun eski
          buyurtmalar ham to‘g‘ri hisoblanadi.
        </p>
      </Card>
    </div>
  );
}
