import { Link } from "react-router-dom";
import { ReceiptText } from "lucide-react";
import { Badge, Button, EmptyState } from "@/components/ui/primitives";
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

export default function MyOrders() {
  const db = useDB();
  const { sessionKey, table } = useCustomer();
  const { t, lang } = useI18n();

  const orders = db.orders
    .filter((o) => o.customerToken === sessionKey || (table && o.tableId === table.id))
    .sort((a, b) => b.createdAt - a.createdAt);

  if (!orders.length) {
    return (
      <EmptyState
        icon={<ReceiptText className="h-8 w-8" />}
        title={t("empty_orders")}
        description={t("order_sent").replace("Buyurtmangiz qabul qilindi, tez orada tayyorlanadi.", "Menyudan buyurtma berishni boshlang.")}
        action={
          <Link to="/categories">
            <Button size="lg">{t("menu")}</Button>
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-extrabold">{t("my_orders")}</h1>
      <div className="space-y-3">
        {orders.map((o) => (
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
              <span className="font-display text-sm font-bold text-primary">{fmtNumber(o.total)} so‘m</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
