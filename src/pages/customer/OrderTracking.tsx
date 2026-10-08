import { Link, useParams, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Bell, CheckCircle2, ChefHat, CircleDot, PackageCheck, ReceiptText, Utensils } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { WaiterCallButton } from "@/components/customer/WaiterCallButton";
import { useCustomer } from "@/lib/customer";
import { useI18n } from "@/lib/i18n";
import { useDB } from "@/lib/store";
import { cn, fmtDateTime, fmtNumber, orderNumberLabel, ORDER_STATUS_LABELS } from "@/lib/utils";
import type { OrderStatus } from "@/lib/types";

const STEPS: { key: string; label: string; icon: typeof Utensils; statuses: OrderStatus[] }[] = [
  { key: "new", label: "Buyurtma qabul qilindi", icon: CheckCircle2, statuses: ["ACCEPTED", "PREPARING", "READY", "WAITING_FOR_WAITER", "DELIVERED", "COMPLETED"] },
  { key: "prep", label: "Tayyorlanmoqda", icon: ChefHat, statuses: ["PREPARING", "READY", "WAITING_FOR_WAITER", "DELIVERED", "COMPLETED"] },
  { key: "ready", label: "Tayyor", icon: PackageCheck, statuses: ["READY", "WAITING_FOR_WAITER", "DELIVERED", "COMPLETED"] },
  { key: "delivered", label: "Stolga yetkazildi", icon: Utensils, statuses: ["DELIVERED", "COMPLETED"] },
  { key: "done", label: "Yakunlandi", icon: CheckCircle2, statuses: ["COMPLETED"] },
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
        <Link to="/orders" className="mt-3 inline-block text-sm font-semibold text-primary">
          {t("my_orders")}
        </Link>
      </div>
    );
  }

  const statusLabel = ORDER_STATUS_LABELS[order.status][lang];

  return (
    <div className="space-y-5">
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
            className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground glow-red"
          >
            <CheckCircle2 className="h-8 w-8" />
          </motion.div>
          <h1 className="mt-4 font-display text-2xl font-extrabold">{t("order_accepted")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t("order_sent")}</p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-border bg-background/50 p-3">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{t("order_number")}</p>
              <p className="mt-0.5 font-display text-lg font-bold">{orderNumberLabel(order.number)}</p>
            </div>
            <div className="rounded-2xl border border-border bg-background/50 p-3">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{t("est_time")}</p>
              <p className="mt-0.5 font-display text-lg font-bold">15–20 {t("minutes")}</p>
            </div>
          </div>
        </motion.div>
      )}

      <div className="rounded-3xl border border-border bg-card/60 p-5">
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
          {STEPS.map((step, i) => {
            const done = step.statuses.includes(order.status);
            const active = !done && i > 0 && STEPS[i - 1].statuses.includes(order.status);
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
                    {done ? <CheckCircle2 className="h-4 w-4" /> : active ? <CircleDot className="h-4 w-4" /> : <step.icon className="h-4 w-4" />}
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={cn("my-0.5 h-6 w-0.5 rounded", done ? "bg-primary" : "bg-border")} />
                  )}
                </div>
                <div className="pb-2 pt-1.5">
                  <p className={cn("text-sm font-semibold", done ? "text-foreground" : "text-muted-foreground")}>{step.label}</p>
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
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t("discount")}</span>
            <span className="font-semibold text-[hsl(var(--success))]">−{fmtNumber(order.discount)}</span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="font-bold">{t("total")}</span>
          <span className="font-display text-xl font-extrabold text-primary">{fmtNumber(order.total)} so‘m</span>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{fmtDateTime(order.createdAt)}</p>
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2">
        <WaiterCallButton variant="inline" />
        <Link to="/menu">
          <Button variant="outline" size="lg" className="w-full">
            <ReceiptText className="h-4 w-4" /> {t("add_more")}
          </Button>
        </Link>
      </div>

      <Link to="/menu" className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <Bell className="h-4 w-4" /> {table ? `${t("table")} №${table.number}` : ""} · {t("back_home")}
      </Link>
    </div>
  );
}
