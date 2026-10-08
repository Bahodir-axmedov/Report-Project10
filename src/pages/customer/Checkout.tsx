import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Check, Clock, ShoppingBag, Truck, Utensils } from "lucide-react";
import { Button, EmptyState, Textarea } from "@/components/ui/primitives";
import { clearCart, useCart } from "@/lib/cart";
import { useCustomer } from "@/lib/customer";
import { useI18n } from "@/lib/i18n";
import { api, useDB, useFeature } from "@/lib/store";
import { useToast } from "@/components/ui/toast";
import { cn, fmtNumber } from "@/lib/utils";
import type { OrderType } from "@/lib/types";

export default function Checkout() {
  const db = useDB();
  const { sessionKey, session, table } = useCustomer();
  const lines = useCart(sessionKey);
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const promoCode = (location.state as { promoCode?: string } | null)?.promoCode;

  const showPreorder = useFeature("preorder");
  const showDelivery = useFeature("delivery");

  const [type, setType] = useState<OrderType>("DINE_IN");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const items = lines
    .map((l) => ({ line: l, product: db.products.find((p) => p.id === l.productId) }))
    .filter((x) => x.product);
  const subtotal = items.reduce((s, x) => s + x.product!.price * x.line.qty, 0);
  const promo = db.promotions.find((p) => p.active && p.code?.toUpperCase() === promoCode?.toUpperCase());
  const discount = promo ? Math.round((subtotal * promo.discountPct) / 100) : 0;
  const total = subtotal - discount;

  if (!items.length) {
    return <EmptyState icon={<ShoppingBag className="h-8 w-8" />} title={t("empty_cart")} />;
  }

  // Disabled sections (developer "Bo‘limlar") never appear as an order type.
  const options: { value: OrderType; title: string; desc: string; icon: typeof Utensils }[] = [
    { value: "DINE_IN", title: t("dine_in"), desc: table ? `Stol №${table.number} · ${t("dine_in_desc")}` : t("dine_in_desc"), icon: Utensils },
    ...(showPreorder
      ? [{ value: "PREORDER" as OrderType, title: t("preorder"), desc: t("preorder_desc"), icon: Clock }]
      : []),
    ...(showDelivery
      ? [{ value: "DELIVERY" as OrderType, title: t("delivery"), desc: t("delivery_desc"), icon: Truck }]
      : []),
  ];
  const activeType: OrderType = options.some((o) => o.value === type) ? type : "DINE_IN";

  const submit = () => {
    setSubmitting(true);
    const order = api.createOrder({
      tableId: type === "DINE_IN" ? table?.id ?? null : table?.id ?? null,
      sessionId: session?.id ?? null,
      type: activeType,
      items: lines.map((l) => ({ productId: l.productId, qty: l.qty, note: l.note })),
      note,
      promoCode,
      customerToken: sessionKey,
    });
    setSubmitting(false);
    if (!order) {
      toast({ type: "error", title: "Buyurtma yaratilmadi", body: "Iltimos, qayta urining" });
      return;
    }
    clearCart(sessionKey);
    navigate(`/order/${order.id}?new=1`, { replace: true });
  };

  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl font-extrabold">{t("order_type")}</h1>

      <div className="space-y-2.5">
        {options.map((o, i) => (
          <motion.button
            key={o.value}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            onClick={() => setType(o.value)}
            className={cn(
              "flex w-full items-center gap-3.5 rounded-2xl border p-4 text-left transition",
              type === o.value ? "border-primary bg-primary/10" : "border-border bg-card/60 hover:bg-white/5"
            )}
          >
            <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl", type === o.value ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground")}>
              <o.icon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">{o.title}</p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{o.desc}</p>
            </div>
            <div className={cn("flex h-6 w-6 items-center justify-center rounded-full border", type === o.value ? "border-primary bg-primary text-primary-foreground" : "border-border")}>
              {type === o.value && <Check className="h-3.5 w-3.5" />}
            </div>
          </motion.button>
        ))}
      </div>

      <div>
        <h2 className="mb-2 text-sm font-bold">{t("special_instruction")}</h2>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("note_placeholder")} />
      </div>

      <div className="rounded-2xl border border-border bg-card/60 p-4">
        <h2 className="mb-3 text-sm font-bold">{t("cart")}</h2>
        <div className="space-y-2">
          {items.map(({ line, product }) => (
            <div key={line.productId} className="flex items-center justify-between text-sm">
              <span className="min-w-0 flex-1 truncate text-muted-foreground">
                {db.products.find((p) => p.id === line.productId)?.nameRu} × {line.qty}
              </span>
              <span className="font-semibold">{fmtNumber(product!.price * line.qty)}</span>
            </div>
          ))}
        </div>
        <div className="my-3 border-t border-border" />
        {discount > 0 && (
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t("discount")} ({promoCode})</span>
            <span className="font-semibold text-[hsl(var(--success))]">−{fmtNumber(discount)}</span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="font-display text-base font-bold">{t("total")}</span>
          <span className="font-display text-xl font-extrabold text-primary">{fmtNumber(total)} so‘m</span>
        </div>
      </div>

      <Button size="lg" className="w-full" loading={submitting} onClick={submit}>
        {t("confirm_order")}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Narx va jami summa serverda qayta hisoblanadi.
      </p>
    </div>
  );
}
