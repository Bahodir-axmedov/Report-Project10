import { Link, useParams, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  ChefHat,
  CircleDot,
  Clock,
  MapPin,
  PackageCheck,
  Phone,
  ReceiptText,
  Truck,
  Utensils,
} from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { WaiterCallButton } from "@/components/customer/WaiterCallButton";
import { useCustomer } from "@/lib/customer";
import { useI18n } from "@/lib/i18n";
import { useDB } from "@/lib/store";
import { cn, fmtDateTime, fmtNumber, fmtTime, orderNumberLabel, ORDER_STATUS_LABELS } from "@/lib/utils";
import type { OrderStatus } from "@/lib/types";

const STEPS: { key: string; label: string; icon: typeof Utensils; statuses: OrderStatus[]; timeKey?: "acceptedAt" | "preparingAt" | "readyAt" | "deliveredAt" | "completedAt" }[] = [
  { key: "new", label: "Buyurtma qabul qilindi", icon: CheckCircle2, statuses: ["ACCEPTED", "PREPARING", "READY", "WAITING_FOR_WAITER", "DELIVERED", "COMPLETED"], timeKey: "acceptedAt" },
  { key: "prep", label: "Tayyorlanmoqda", icon: ChefHat, statuses: ["PREPARING", "READY", "WAITING_FOR_WAITER", "DELIVERED", "COMPLETED"], timeKey: "preparingAt" },
  { key: "ready", label: "Tayyor", icon: PackageCheck, statuses: ["READY", "WAITING_FOR_WAITER", "DELIVERED", "COMPLETED"], timeKey: "readyAt" },
  { key: "courier", label: "Kuryerga topshirildi", icon: Truck, statuses: ["DELIVERED", "COMPLETED"], timeKey: "deliveredAt", },
  { key: "done", label: "Yetkazildi", icon: CheckCircle2, statuses: ["COMPLETED"], timeKey: "completedAt" },
];

const TABLE_STEPS: typeof STEPS = [
  STEPS[0],
  STEPS[1],
  STEPS[2],
  { key: "served", label: "Stolga yetkazildi", icon: Utensils, statuses: ["WAITING_FOR_WAITER", "DELIVERED", "COMPLETED"], timeKey: "deliveredAt" },
  STEPS[4],
];

export default function OrderTracking() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const isNew = params.get("new") === "1";
  const db = useDB();
  const { table } = useCustomer();
  const { t, lang, localizedName } = useI18n();

  const order = db.orders.find((o) => o.id === id);

  if (!order) {
    return (
      <div className="py-16 text-center">
        <p className="font-display text-lg font-bold">Buyurtma topilmadi</p>
        <Link to="/menu" className="mt-3 inline-block text-sm font-semibold text-primary">
          {t("menu")}
        </Link>
      </div>
    );
  }

  const delivery = order.type === "DELIVERY";
  const steps = delivery ? STEPS : TABLE_STEPS;
  const statusLabel = ORDER_STATUS_LABELS[order.status][lang];
  const estMinutes = delivery ? "30–60" : "15–20";

  return (
    <div className="mx-auto w-full max-w-md space-y-5">
      {/* ---------------- 13. confirmation ---------------- */}
      {isNew && (
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-3xl border border-primary/40 bg-gradient-to-br from-primary/20 to-card p-6 text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 16, delay: 0.1 }}
            className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary text-primary-foreground glow-red"
          >
            <CheckCircle2 className="h-10 w-10" />
          </motion.div>
          <h1 className="mt-4 font-display text-2xl font-extrabold">Buyurtma qabul qilindi!</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Rahmat, buyurtmangiz qabul qilindi. Tez orada tayyorlanadi.
          </p>

          <div className="mt-5 space-y-2 text-left">
            <div className="flex items-center justify-between rounded-2xl border border-border bg-background/50 p-3">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Buyurtma raqami</span>
              <span className="font-display text-base font-bold">{orderNumberLabel(order.number)}</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-border bg-background/50 p-3">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Buyurtma turi</span>
              <span className="text-sm font-bold">
                {delivery ? "Yetkazib berish" : order.type === "PREORDER" ? "Oldindan zakaz" : "Stolda zakaz"}
              </span>
            </div>
            {order.address && (
              <div className="rounded-2xl border border-border bg-background/50 p-3">
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Manzil</span>
                <p className="mt-0.5 flex items-start gap-1.5 text-sm font-semibold">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" /> {order.address}
                </p>
              </div>
            )}
            <div className="flex items-center justify-between rounded-2xl border border-border bg-background/50 p-3">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                {order.scheduledFor ? "Tanlangan vaqt" : "Taxminiy vaqt"}
              </span>
              <span className="font-display text-base font-bold">
                {order.scheduledFor ? fmtDateTime(order.scheduledFor) : `${estMinutes} ${t("minutes")}`}
              </span>
            </div>
          </div>

          <div className="mt-5 grid gap-2.5">
            <Link to="/">
              <Button size="lg" className="w-full">
                Bosh sahifaga qaytish
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="w-full" onClick={() => document.getElementById("tracking-card")?.scrollIntoView({ behavior: "smooth" })}>
              Buyurtmani kuzatish ↓
            </Button>
          </div>
        </motion.div>
      )}

      {/* ---------------- 14. status timeline ---------------- */}
      <div id="tracking-card" className="rounded-3xl border border-border bg-card/60 p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">{t("tracking")}</p>
            <p className="mt-0.5 font-display text-lg font-bold">
              {orderNumberLabel(order.number)} · {order.tableLabel}
            </p>
          </div>
          <span
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-bold",
              order.status === "COMPLETED"
                ? "bg-[hsl(var(--success))]/15 text-[hsl(var(--success))]"
                : order.status === "CANCELLED"
                ? "bg-destructive/15 text-destructive"
                : "bg-primary/15 text-primary"
            )}
          >
            {statusLabel}
          </span>
        </div>

        <div className="mt-5 space-y-0.5">
          {steps.map((step, i) => {
            const done = step.statuses.includes(order.status);
            const active = !done && i > 0 && steps[i - 1].statuses.includes(order.status);
            const at = step.timeKey ? order[step.timeKey] : undefined;
            return (
              <div key={step.key} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition",
                      done
                        ? "border-primary bg-primary text-primary-foreground"
                        : active
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border bg-secondary/50 text-muted-foreground"
                    )}
                  >
                    {done ? <CheckCircle2 className="h-4 w-4" /> : active ? <CircleDot className="h-4 w-4 animate-pulse" /> : <step.icon className="h-4 w-4" />}
                  </div>
                  {i < steps.length - 1 && (
                    <div className={cn("my-0.5 h-6 w-0.5 rounded", done ? "bg-primary" : "bg-border")} />
                  )}
                </div>
                <div className="pb-2 pt-1.5">
                  <p className={cn("text-sm font-semibold", done ? "text-foreground" : "text-muted-foreground")}>{step.label}</p>
                  {at && <p className="text-[11px] text-muted-foreground">{fmtTime(at)}</p>}
                </div>
              </div>
            );
          })}
        </div>

        {order.status === "CANCELLED" && (
          <p className="mt-3 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            Buyurtma bekor qilindi.
          </p>
        )}
      </div>

      {/* ---------------- details ---------------- */}
      <div className="rounded-3xl border border-border bg-card/60 p-5">
        <h2 className="text-sm font-bold">{t("cart")}</h2>
        <div className="mt-3 space-y-2.5">
          {order.items.map((it) => (
            <div key={it.id} className="flex items-center justify-between text-sm">
              <span className="min-w-0 flex-1 truncate">
                {lang === "ru" ? it.nameRu : lang === "en" ? it.nameEn : it.nameUz}
                <span className="ml-2 text-muted-foreground">×{it.qty}</span>
              </span>
              <span className="font-semibold">{fmtNumber(it.price * it.qty)}</span>
            </div>
          ))}
        </div>
        <div className="my-3 border-t border-border" />
        {order.discount > 0 && (
          <div className="mb-1.5 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t("discount")}</span>
            <span className="font-semibold text-[hsl(var(--success))]">−{fmtNumber(order.discount)}</span>
          </div>
        )}
        {order.deliveryFee ? (
          <div className="mb-1.5 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Yetkazib berish</span>
            <span className="font-semibold">{fmtNumber(order.deliveryFee)}</span>
          </div>
        ) : null}
        <div className="flex items-center justify-between">
          <span className="font-bold">{t("total")}</span>
          <span className="font-display text-xl font-extrabold text-primary">{fmtNumber(order.total)} so‘m</span>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{fmtDateTime(order.createdAt)}</p>
      </div>

      {(order.customerPhone || order.address) && (
        <div className="rounded-3xl border border-border bg-card/60 p-5 text-sm">
          <h2 className="font-bold">Yetkazib berish ma’lumotlari</h2>
          <div className="mt-3 space-y-2 text-muted-foreground">
            {order.customerName && <p className="font-semibold text-foreground">{order.customerName}</p>}
            {order.customerPhone && (
              <p className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-primary" /> {order.customerPhone}
              </p>
            )}
            {order.address && (
              <p className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {order.address}
              </p>
            )}
            {order.scheduledFor && (
              <p className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" /> {fmtDateTime(order.scheduledFor)}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="grid gap-2.5 sm:grid-cols-2">
        <WaiterCallButton variant="inline" />
        <Link to="/menu">
          <Button variant="outline" size="lg" className="w-full">
            <ReceiptText className="h-4 w-4" /> {t("add_more")}
          </Button>
        </Link>
      </div>

      <Link to="/" className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
        {table ? `${t("table")} №${table.number} · ` : ""} {t("back_home")}
      </Link>
    </div>
  );
}
