import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ReceiptText, Search } from "lucide-react";
import { Badge, Button, EmptyState, Input } from "@/components/ui/primitives";
import { useCustomer } from "@/lib/customer";
import { useI18n } from "@/lib/i18n";
import { useDB } from "@/lib/store";
import { fmtDateTime, fmtNumber, orderNumberLabel, ORDER_STATUS_LABELS } from "@/lib/utils";
import type { OrderStatus } from "@/lib/types";

const TONE: Record<OrderStatus, "default" | "primary" | "success" | "warning" | "danger" | "info"> = {
  NEW: "info",
  ACCEPTED: "primary",
  PREPARING: "warning",
  READY: "success",
  WAITING_FOR_WAITER: "warning",
  DELIVERED: "primary",
  COMPLETED: "success",
  CANCELLED: "danger",
};

/**
 * No-profile order tracking: the guest types the temporary order number from
 * their receipt (or scans the QR) and sees the live status. The device's own
 * orders are listed below without any registration.
 */
export default function TrackOrder() {
  const db = useDB();
  const { sessionKey, table } = useCustomer();
  const { t, lang } = useI18n();
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mine = db.orders
    .filter((o) => o.customerToken === sessionKey || (table && o.tableId === table.id))
    .sort((a, b) => b.createdAt - a.createdAt);

  const search = () => {
    const n = Number(q.replace(/\D/g, ""));
    if (!n) {
      setError("Buyurtma raqamini kiriting (masalan 25)");
      return;
    }
    const found = db.orders.find((o) => o.number === n);
    if (!found) {
      setError(`#${String(n).padStart(4, "0")} raqamli buyurtma topilmadi`);
      return;
    }
    setError(null);
    window.location.assign(`/order/${found.id}`);
  };

  return (
    <div className="mx-auto w-full max-w-md space-y-5">
      <div>
        <h1 className="font-display text-2xl font-extrabold">{t("tracking")}</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Buyurtma raqamingizni kiriting — profil yaratish shart emas.
        </p>
      </div>

      <div className="rounded-3xl border border-border bg-card/60 p-5">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && search()}
              placeholder="25"
              inputMode="numeric"
              className="pl-9 font-display text-lg font-bold"
            />
          </div>
          <Button onClick={search}>Kuzatish</Button>
        </div>
        {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
        <p className="mt-2 text-[11px] text-muted-foreground">
          Raqam chekdagi «Buyurtma raqami» yorlig‘ida (masalan {orderNumberLabel(25)}).
        </p>
      </div>

      <section>
        <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-extrabold">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
            <ReceiptText className="h-4 w-4" />
          </span>
          {mine.length ? "Bu qurilmadagi buyurtmalar" : t("my_orders")}
        </h2>

        {mine.length === 0 ? (
          <EmptyState
            icon={<ReceiptText className="h-8 w-8" />}
            title={t("empty_orders")}
            description="Menyudan buyurtma berishni boshlang."
            action={
              <Link to="/menu">
                <Button size="lg">{t("menu")}</Button>
              </Link>
            }
          />
        ) : (
          <div className="space-y-3">
            {mine.map((o) => (
              <Link
                key={o.id}
                to={`/order/${o.id}`}
                className="block rounded-2xl border border-border bg-card/60 p-4 transition hover:border-primary/40"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-display text-base font-bold">{orderNumberLabel(o.number)}</span>
                    <span className="text-xs text-muted-foreground">· {o.tableLabel}</span>
                  </div>
                  <Badge tone={TONE[o.status]}>{ORDER_STATUS_LABELS[o.status][lang]}</Badge>
                </div>
                <p className="mt-2 line-clamp-1 text-xs text-muted-foreground">
                  {o.items.map((i) => `${lang === "ru" ? i.nameRu : lang === "en" ? i.nameEn : i.nameUz} ×${i.qty}`).join(", ")}
                </p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{fmtDateTime(o.createdAt)}</span>
                  <span className="flex items-center gap-1 font-display text-sm font-bold text-primary">
                    {fmtNumber(o.total)} so‘m <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
