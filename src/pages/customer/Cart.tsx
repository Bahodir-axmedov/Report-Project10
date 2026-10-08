import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, ShoppingBag, Tag, Trash2 } from "lucide-react";
import { FoodImage } from "@/components/FoodImage";
import { QuantityStepper } from "@/components/customer/menu";
import { Button, EmptyState, Input } from "@/components/ui/primitives";
import { setCartQty, removeFromCart, useCart } from "@/lib/cart";
import { useCustomer } from "@/lib/customer";
import { useI18n } from "@/lib/i18n";
import { useDB } from "@/lib/store";
import { cn, fmtNumber } from "@/lib/utils";
import { useState } from "react";

export default function Cart() {
  const db = useDB();
  const { sessionKey, table } = useCustomer();
  const lines = useCart(sessionKey);
  const { t, localizedName } = useI18n();
  const navigate = useNavigate();
  const [promo, setPromo] = useState("");
  const [applied, setApplied] = useState<{ code: string; pct: number } | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);

  const items = lines
    .map((l) => ({ line: l, product: db.products.find((p) => p.id === l.productId) }))
    .filter((x) => x.product);

  const subtotal = items.reduce((s, x) => s + x.product!.price * x.line.qty, 0);
  const discount = applied ? Math.round((subtotal * applied.pct) / 100) : 0;
  const total = subtotal - discount;

  const applyPromo = () => {
    setPromoError(null);
    const p = db.promotions.find((x) => x.active && x.code?.toUpperCase() === promo.trim().toUpperCase());
    if (!p) {
      setPromoError("Promokod topilmadi");
      setApplied(null);
      return;
    }
    setApplied({ code: p.code!, pct: p.discountPct });
  };

  if (!items.length) {
    return (
      <EmptyState
        icon={<ShoppingBag className="h-8 w-8" />}
        title={t("empty_cart")}
        description="Menyudan taom tanlab, savatga qo‘shing."
        action={
          <Link to="/categories">
            <Button size="lg">{t("menu")}</Button>
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-extrabold">{t("cart")}</h1>
        {table && (
          <span className="rounded-full border border-primary/40 bg-primary/15 px-3 py-1 text-xs font-bold text-primary">
            {t("table")} №{table.number}
          </span>
        )}
      </div>

      <div className="space-y-3">
        {items.map(({ line, product }) => (
          <div
            key={line.productId}
            className="flex gap-3 rounded-2xl border border-border bg-card/60 p-3 transition hover:border-primary/25"
          >
            <Link to={`/menu/p/${product!.id}`} className="shrink-0">
              <FoodImage src={product!.image} alt={localizedName(product!)} className="h-20 w-20 rounded-xl" />
            </Link>
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex items-start justify-between gap-2">
                <Link to={`/menu/p/${product!.id}`} className="line-clamp-2 text-sm font-semibold leading-snug">
                  {localizedName(product!)}
                </Link>
                <button
                  onClick={() => removeFromCart(sessionKey, line.productId)}
                  aria-label="O‘chirish"
                  className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition hover:bg-white/5 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {fmtNumber(product!.price)} so‘m / dona
              </p>
              <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                <QuantityStepper
                  qty={line.qty}
                  size="sm"
                  onInc={() => setCartQty(sessionKey, line.productId, line.qty + 1)}
                  onDec={() => setCartQty(sessionKey, line.productId, line.qty - 1)}
                />
                <span className="font-display text-[15px] font-extrabold">
                  {fmtNumber(product!.price * line.qty)} so‘m
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-card/60 p-4">
        <div className="flex items-center gap-2">
          <Tag className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">{t("promo_code")}</span>
        </div>
        <div className="mt-2.5 flex gap-2">
          <Input value={promo} onChange={(e) => setPromo(e.target.value)} placeholder="PROMO10" />
          <Button variant="secondary" onClick={applyPromo}>
            {t("apply")}
          </Button>
        </div>
        {promoError && <p className="mt-2 text-xs text-destructive">{promoError}</p>}
        {applied && (
          <p className="mt-2 text-xs text-[hsl(var(--success))]">
            {applied.code} qo‘llandi — {applied.pct}% chegirma
          </p>
        )}
      </div>

      <div className="space-y-2 rounded-2xl border border-border bg-card/60 p-4">
        <Row label={t("subtotal")} value={`${fmtNumber(subtotal)} so‘m`} />
        {discount > 0 && <Row label={t("discount")} value={`−${fmtNumber(discount)} so‘m`} accent />}
        <div className="my-1 border-t border-border" />
        <div className="flex items-center justify-between">
          <span className="font-display text-base font-bold">{t("total")}</span>
          <span className="font-display text-xl font-extrabold text-primary">{fmtNumber(total)} so‘m</span>
        </div>
      </div>

      {/* sticky confirmation bar, so the total and CTA are always in reach */}
      <div className="sticky bottom-[76px] z-20 lg:bottom-4">
        <div className="glass flex items-center gap-2.5 rounded-2xl border border-border p-2 pl-4 shadow-2xl">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t("total")}</p>
            <p className="font-display text-lg font-extrabold leading-none text-primary">{fmtNumber(total)} so‘m</p>
          </div>
          <Link to="/categories">
            <Button variant="secondary" size="sm">
              {t("add_more")}
            </Button>
          </Link>
          <Button size="sm" onClick={() => navigate("/checkout", { state: { promoCode: applied?.code } })}>
            {t("checkout")} <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-semibold", accent && "text-[hsl(var(--success))]")}>{value}</span>
    </div>
  );
}
