import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  Check,
  Clock,
  CreditCard,
  MapPin,
  Pencil,
  ShoppingBag,
  Smartphone,
  Truck,
  Utensils,
  Wallet,
} from "lucide-react";
import { Button, EmptyState, Input, Textarea } from "@/components/ui/primitives";
import { clearCart, useCart } from "@/lib/cart";
import { useCustomer } from "@/lib/customer";
import { useI18n } from "@/lib/i18n";
import { api, useDB, useFeature } from "@/lib/store";
import { useToast } from "@/components/ui/toast";
import { cn, fmtNumber } from "@/lib/utils";
import { takePendingType } from "./Home";
import type { OrderType, PaymentMethod } from "@/lib/types";

type Step = "type" | "address" | "info" | "time" | "pay";
const STEP_ORDER: Step[] = ["type", "address", "info", "time", "pay"];

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string; sub: string; icon: typeof Banknote }[] = [
  { value: "CLICK", label: "Click", sub: "Click orqali to‘lov", icon: Smartphone },
  { value: "PAYME", label: "Payme", sub: "Payme orqali to‘lov", icon: Wallet },
  { value: "CARD", label: "Karta", sub: "Visa / MasterCard", icon: CreditCard },
  { value: "CASH", label: "Naqd", sub: "Qo‘l bilan to‘lov", icon: Banknote },
];

/** Time slots offered for scheduled delivery / pre-orders (mockup screen 11). */
const TIME_SLOTS = [
  "12:00", "12:30", "13:00", "13:30",
  "14:00", "14:30", "15:00", "15:30",
  "16:00", "16:30", "17:00", "17:30",
  "18:00", "18:30", "19:00", "19:30",
];

function dayTabs(): { key: string; label: string; date: Date }[] {
  const now = new Date();
  const days = [now, new Date(now.getTime() + 86400000), new Date(now.getTime() + 2 * 86400000), new Date(now.getTime() + 3 * 86400000)];
  const uzDays = ["Yak", "Du", "Se", "Chor", "Pay", "Ju", "Sha"];
  return days.map((d, i) => {
    const label =
      i === 0
        ? `Bugun\n${d.getDate()} Okt`
        : i === 1
        ? `Ertaga\n${d.getDate()} Okt`
        : `${d.getDate()} Okt\n${uzDays[d.getDay()]}`;
    return { key: d.toDateString(), label, date: d };
  });
}

/**
 * Checkout wizard (mockup screens 7–12):
 *   type → address (delivery) → guest info (delivery) → time → payment → submit
 * Everything is order-scoped — no registration, no profile, phone + name only.
 */
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
  const [step, setStep] = useState<Step>("type");

  // delivery details
  const [addrMode, setAddrMode] = useState<"map" | "manual">("map");
  const [mapAddress, setMapAddress] = useState("");
  const [manualAddress, setManualAddress] = useState("");
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [phone, setPhone] = useState("");
  const [guestNote, setGuestNote] = useState("");
  const [asap, setAsap] = useState(true);
  const [dayKey, setDayKey] = useState(() => dayTabs()[0].key);
  const [slot, setSlot] = useState<string | null>(null);
  const [payment, setPayment] = useState<PaymentMethod>("CASH");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pending = useRef<string | null>(null);
  useEffect(() => {
    pending.current = takePendingType();
    if (pending.current === "DELIVERY" && showDelivery) {
      setType("DELIVERY");
      setStep("address");
      setPayment("CLICK");
    } else if (pending.current === "PREORDER" && showPreorder) {
      setType("PREORDER");
      setStep("time");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const items = useMemo(
    () =>
      lines
        .map((l) => ({ line: l, product: db.products.find((p) => p.id === l.productId) }))
        .filter((x) => x.product),
    [lines, db.products]
  );
  const subtotal = items.reduce((s, x) => s + x.product!.price * x.line.qty, 0);
  const promo = db.promotions.find((p) => p.active && p.code?.toUpperCase() === promoCode?.toUpperCase());
  const discount = promo ? Math.round((subtotal * promo.discountPct) / 100) : 0;
  const deliveryFee = type === "DELIVERY" ? Math.max(0, db.settings.deliveryFee ?? 0) : 0;
  const total = subtotal - discount + deliveryFee;

  const isDelivery = type === "DELIVERY";
  const needsTime = type === "PREORDER" || isDelivery;

  if (!items.length) {
    return <EmptyState icon={<ShoppingBag className="h-8 w-8" />} title={t("empty_cart")} />;
  }

  const address = isDelivery ? (addrMode === "map" ? mapAddress : manualAddress).trim() : "";
  const phoneDigits = phone.replace(/\D/g, "");

  const validate = (): string | null => {
    if (step === "address") {
      if (!address) return "Manzilni tanlang yoki kiriting";
      return null;
    }
    if (step === "info") {
      if (!first.trim()) return "Ismingizni kiriting";
      if (!last.trim()) return "Familiyangizni kiriting";
      if (phoneDigits.length < 9) return "Telefon raqamni to‘liq kiriting (+998 XX XXX XX XX)";
      return null;
    }
    if (step === "time") {
      if (!asap && type !== "PREORDER" && !slot) return "Vaqt tanlang yoki «Hoziroq» ni tanlang";
      if (type === "PREORDER" && !slot) return "Zakaz vaqtini tanlang";
      return null;
    }
    return null;
  };

  const next = () => {
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    const idx = STEP_ORDER.indexOf(step);
    const visible = STEP_ORDER.filter(
      (s) => !((s === "address" || s === "info") && !isDelivery) && !(s === "time" && !needsTime)
    );
    const cur = visible.indexOf(step);
    if (cur < visible.length - 1) setStep(visible[cur + 1]);
    else submit();
    void idx;
  };

  const back = () => {
    setError(null);
    const visible = STEP_ORDER.filter(
      (s) => !((s === "address" || s === "info") && !isDelivery) && !(s === "time" && !needsTime)
    );
    const cur = visible.indexOf(step);
    if (cur === 0) navigate("/cart");
    else setStep(visible[cur - 1]);
  };

  const submit = () => {
    setSubmitting(true);
    let scheduledFor: number | undefined;
    if (needsTime && !(isDelivery && asap)) {
      const day = dayTabs().find((d) => d.key === dayKey)?.date ?? new Date();
      if (slot) {
        const [hh, mm] = slot.split(":").map(Number);
        scheduledFor = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hh, mm, 0, 0).getTime();
      }
    }
    const order = api.createOrder({
      tableId: table?.id ?? null,
      sessionId: session?.id ?? null,
      type,
      items: lines.map((l) => ({ productId: l.productId, qty: l.qty, note: l.note })),
      note: guestNote,
      promoCode,
      customerToken: sessionKey,
      customerName: `${first.trim()} ${last.trim()}`.trim() || undefined,
      customerPhone: phoneDigits ? `+998${phoneDigits.slice(-9)}` : undefined,
      address: address || undefined,
      scheduledFor,
      deliveryFee,
      paymentMethod: payment,
    });
    setSubmitting(false);
    if (!order) {
      toast({ type: "error", title: "Buyurtma yaratilmadi", body: "Iltimos, qayta urining" });
      return;
    }
    clearCart(sessionKey);
    navigate(`/order/${order.id}?new=1`, { replace: true });
  };

  const stepTitle =
    step === "type"
      ? t("order_type")
      : step === "address"
      ? "Manzilingizni tanlang"
      : step === "info"
      ? "Ma’lumotlaringiz"
      : step === "time"
      ? type === "PREORDER"
        ? "Zakaz vaqtini tanlang"
        : "Yetkazib berish vaqti"
      : "To‘lov usuli";

  const days = useMemo(() => dayTabs(), []);

  return (
    <div className="mx-auto w-full max-w-md space-y-5">
      {/* header with progress */}
      <div>
        <div className="flex items-center gap-3">
          <button
            onClick={back}
            aria-label={t("back")}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-secondary/60 transition hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h1 className="flex-1 font-display text-xl font-extrabold tracking-tight">{stepTitle}</h1>
        </div>
        <div className="mt-3 flex gap-1.5">
          {(["type", isDelivery ? "address" : null, isDelivery ? "info" : null, needsTime ? "time" : null, "pay"] as (Step | null)[])
            .filter(Boolean)
            .map((s) => (
              <span
                key={s}
                className={cn(
                  "h-1.5 flex-1 rounded-full transition",
                  STEP_ORDER.indexOf(s as Step) <= STEP_ORDER.indexOf(step) ? "bg-primary" : "bg-border"
                )}
              />
            ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {/* ---------------- 7. order type ---------------- */}
        {step === "type" && (
          <StepPane key="type">
            <TypeCard
              icon={Utensils}
              title="Stolda zakaz berish"
              sub={table ? `Hozirgi restoranda · Stol №${table.number}` : "Hozirgi restoranda"}
              active={type === "DINE_IN"}
              onClick={() => setType("DINE_IN")}
            />
            {showPreorder && (
              <TypeCard
                icon={Clock}
                title="Oldindan zakaz (vaqt belgilang)"
                sub="Ma’lum vaqtda tayyorlab beramiz"
                active={type === "PREORDER"}
                onClick={() => setType("PREORDER")}
              />
            )}
            {showDelivery && (
              <TypeCard
                icon={Truck}
                title="Yetkazib berish (Delivery)"
                sub="Manzilingizga yetkazamiz"
                active={type === "DELIVERY"}
                onClick={() => setType("DELIVERY")}
              />
            )}
            {!table && type === "DINE_IN" && (
              <p className="rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
                Stol aniqlanmagan — menyudan chiqib, stol raqamini kiriting yoki Delivery tanlang.
              </p>
            )}
            <SummaryRow subtotal={subtotal} discount={discount} fee={0} total={subtotal - discount} />
          </StepPane>
        )}

        {/* ---------------- 8. address ---------------- */}
        {step === "address" && (
          <StepPane key="address">
            <div className="flex gap-2">
              <Pill active={addrMode === "map"} onClick={() => setAddrMode("map")}>
                Xaritadan tanlash
              </Pill>
              <Pill active={addrMode === "manual"} onClick={() => setAddrMode("manual")}>
                Manzil kiritish
              </Pill>
            </div>

            {addrMode === "map" ? (
              <AddressMap value={mapAddress} onChange={setMapAddress} />
            ) : (
              <div className="space-y-2 pt-2">
                <Textarea
                  value={manualAddress}
                  onChange={(e) => setManualAddress(e.target.value)}
                  placeholder="Toshkent, Yakkasaroy tumani, Amir Temur ko‘chasi, 12"
                  className="min-h-[96px]"
                />
                <p className="text-xs text-muted-foreground">
                  Ko‘cha, uy/ho‘jlik raqami va tumaningizni to‘liq yozing — bu kuryer tez yetib borishiga yordam
                  beradi.
                </p>
              </div>
            )}

            {address && (
              <div className="rounded-2xl border border-primary/40 bg-primary/10 p-4">
                <p className="text-[11px] font-bold uppercase tracking-wider text-primary">Tanlangan manzil</p>
                <p className="mt-1 flex items-start gap-2 text-sm font-semibold">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {address}
                </p>
              </div>
            )}

            <a
              href={db.settings.mapsUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-block text-xs font-semibold text-primary"
            >
              Google Maps / Yandex Maps’da ochish →
            </a>
          </StepPane>
        )}

        {/* ---------------- 9. guest info ---------------- */}
        {step === "info" && (
          <StepPane key="info">
            <Field2 label="Ism" required>
              <Input value={first} onChange={(e) => setFirst(e.target.value)} placeholder="Bahodir" maxLength={40} />
            </Field2>
            <Field2 label="Familiya" required>
              <Input value={last} onChange={(e) => setLast(e.target.value)} placeholder="Axmedov" maxLength={40} />
            </Field2>
            <Field2 label="Telefon raqami" required>
              <div className="flex items-center gap-2">
                <span className="flex h-11 shrink-0 items-center rounded-xl border border-border bg-secondary/60 px-3 text-sm font-bold">
                  🇺🇿 +998
                </span>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/[^\d\s]/g, "").slice(0, 12))}
                  placeholder="90 123 45 67"
                  inputMode="tel"
                  className="flex-1"
                />
              </div>
            </Field2>
            <Field2 label="Qo‘shimcha ma’lumot">
              <div className="relative">
                <Textarea
                  value={guestNote}
                  onChange={(e) => setGuestNote(e.target.value.slice(0, 200))}
                  placeholder="Kvartira, domofon kod, izoh..."
                  className="min-h-[84px] pb-6"
                />
                <span className="absolute bottom-2 right-3 text-[11px] text-muted-foreground">
                  {guestNote.length}/200
                </span>
              </div>
            </Field2>
          </StepPane>
        )}

        {/* ---------------- 10/11. time ---------------- */}
        {step === "time" && (
          <StepPane key="time">
            {isDelivery && (
              <div className="grid grid-cols-2 gap-2.5">
                <Pill big active={asap} onClick={() => setAsap(true)}>
                  Hoziroq
                </Pill>
                <Pill big active={!asap} onClick={() => setAsap(false)}>
                  Vaqt belgilash
                </Pill>
              </div>
            )}

            {(type === "PREORDER" || !asap) && (
              <>
                <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pt-1">
                  {days.map((d) => (
                    <button
                      key={d.key}
                      onClick={() => {
                        setDayKey(d.key);
                        setSlot(null);
                      }}
                      className={cn(
                        "min-w-[92px] shrink-0 whitespace-pre-line rounded-2xl border px-3 py-2.5 text-center text-xs font-bold leading-tight transition",
                        dayKey === d.key
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card/60 text-muted-foreground hover:border-primary/40"
                      )}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-4 gap-2 pt-1">
                  {TIME_SLOTS.map((s) => {
                    const disabled = isTodayKey(dayKey) && isPastSlot(s);
                    return (
                      <button
                        key={s}
                        disabled={disabled}
                        onClick={() => setSlot(s)}
                        className={cn(
                          "rounded-xl border py-2 text-sm font-bold transition disabled:opacity-35",
                          slot === s
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-card/60 hover:border-primary/40"
                        )}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {asap && isDelivery && (
              <div className="flex items-start gap-2.5 rounded-2xl border border-border bg-card/60 p-4 text-sm text-muted-foreground">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                Buyurtmangiz taxminan 30–60 daqiqada yetkaziladi.
              </div>
            )}
            {type === "PREORDER" && slot && (
              <div className="rounded-2xl border border-primary/40 bg-primary/10 p-4 text-sm font-semibold">
                Zakaz {days.find((d) => d.key === dayKey)?.label.replace("\n", " ")} kuni {slot} da tayyor bo‘ladi.
              </div>
            )}
          </StepPane>
        )}

        {/* ---------------- 12. payment ---------------- */}
        {step === "pay" && (
          <StepPane key="pay">
            <div className="space-y-2.5">
              {PAYMENT_OPTIONS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setPayment(p.value)}
                  className={cn(
                    "flex w-full items-center gap-3.5 rounded-2xl border p-4 text-left transition",
                    payment === p.value ? "border-primary bg-primary/10" : "border-border bg-card/60 hover:bg-white/5"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-11 w-11 items-center justify-center rounded-xl",
                      payment === p.value ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                    )}
                  >
                    <p.icon className="h-5 w-5" />
                  </span>
                  <span className="flex-1">
                    <span className="block text-sm font-bold">{p.label}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{p.sub}</span>
                  </span>
                  <span
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-full border",
                      payment === p.value ? "border-primary bg-primary text-primary-foreground" : "border-border"
                    )}
                  >
                    {payment === p.value && <Check className="h-3.5 w-3.5" />}
                  </span>
                </button>
              ))}
            </div>

            <SummaryRow subtotal={subtotal} discount={discount} fee={deliveryFee} total={total} />

            {(isDelivery || type === "PREORDER") && (
              <div className="space-y-1 rounded-2xl border border-border bg-card/60 p-4 text-sm">
                <Row label="Buyurtma turi" value={type === "DELIVERY" ? "Yetkazib berish" : "Oldindan zakaz"} />
                {address && <Row label="Manzil" value={address} />}
                {first && <Row label="Mijoz" value={`${first} ${last} · +998${phoneDigits.slice(-9)}`} />}
                {(type === "PREORDER" || !asap) && slot && <Row label="Vaqt" value={`${slot}`} />}
              </div>
            )}

            <Button size="lg" className="w-full" loading={submitting} onClick={submit}>
              {payment === "CASH" ? t("confirm_order") : "To‘lovni bajarish"} <ArrowRight className="h-4 w-4" />
            </Button>
            <p className="text-center text-[11px] text-muted-foreground">
              Narx va jami summa serverda qayta hisoblanadi.
            </p>
          </StepPane>
        )}
      </AnimatePresence>

      {step !== "pay" && (
        <Button size="lg" className="w-full" onClick={next}>
          Davom etish <ArrowRight className="h-4 w-4" />
        </Button>
      )}

      {error && (
        <p className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-center text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

function isTodayKey(key: string) {
  return key === new Date().toDateString();
}
function isPastSlot(slot: string) {
  const [h, m] = slot.split(":").map(Number);
  const now = new Date();
  const then = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m);
  return then.getTime() < now.getTime() + 30 * 60000; // 30-minute lead time
}

function StepPane({ children }: { children: React.ReactNode }) {
  // No exit animation: AnimatePresence "wait" mode can strand the outgoing
  // pane in the DOM when the swap happens inside a conditional chain — the
  // enter animation alone keeps the wizard feeling smooth and reliable.
  return (
    <motion.div
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.22 }}
      className="space-y-3"
    >
      {children}
    </motion.div>
  );
}

function TypeCard({
  icon: Icon,
  title,
  sub,
  active,
  onClick,
}: {
  icon: typeof Utensils;
  title: string;
  sub: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3.5 rounded-2xl border p-4 text-left transition",
        active ? "border-primary bg-primary/10" : "border-border bg-card/60 hover:bg-white/5"
      )}
    >
      <span
        className={cn(
          "flex h-11 w-11 items-center justify-center rounded-xl",
          active ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
        )}
      >
        <Icon className="h-5 w-5" />
      </span>
      <span className="flex-1">
        <span className="block text-sm font-bold">{title}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{sub}</span>
      </span>
      <span
        className={cn(
          "flex h-6 w-6 items-center justify-center rounded-full border",
          active ? "border-primary bg-primary text-primary-foreground" : "border-border"
        )}
      >
        {active && <Check className="h-3.5 w-3.5" />}
      </span>
    </button>
  );
}

function Pill({
  active,
  onClick,
  children,
  big,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  big?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-1 rounded-2xl border px-4 font-bold transition",
        big ? "py-3.5 text-sm" : "py-2.5 text-xs",
        active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card/60 text-muted-foreground hover:border-primary/40"
      )}
    >
      {children}
    </button>
  );
}

function Field2({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label} {required && <span className="text-primary">*</span>}
      </p>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="text-right font-semibold">{value}</span>
    </div>
  );
}

function SummaryRow({
  subtotal,
  discount,
  fee,
  total,
}: {
  subtotal: number;
  discount: number;
  fee: number;
  total: number;
}) {
  return (
    <div className="space-y-1.5 rounded-2xl border border-border bg-card/60 p-4">
      <Row label="Buyurtma summasi" value={`${fmtNumber(subtotal)} so‘m`} />
      {discount > 0 && <Row label="Chegirma" value={`−${fmtNumber(discount)} so‘m`} />}
      {fee > 0 && <Row label="Yetkazib berish" value={`${fmtNumber(fee)} so‘m`} />}
      <div className="my-1.5 border-t border-border" />
      <div className="flex items-center justify-between">
        <span className="font-display text-base font-bold">Jami</span>
        <span className="font-display text-xl font-extrabold text-primary">{fmtNumber(total)} so‘m</span>
      </div>
    </div>
  );
}

/** Minimal Leaflet map with a draggable pin (mockup screen 8). Falls back to
 * a manual field when tiles cannot load (offline venue). */
function AddressMap({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const elRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<{ setView: (c: number[], z?: number) => unknown; remove: () => void } | null>(null);
  const markerRef = useRef<{ setLatLng: (c: number[]) => void } | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  const TASHKENT: [number, number] = [41.3111, 69.2405];

  useEffect(() => {
    let disposed = false;
    let leafletCleanup: (() => void) | null = null;

    (async () => {
      try {
        const L = (await import("leaflet")).default;
        await import("leaflet/dist/leaflet.css");
        if (disposed || !elRef.current) return;
        const map = L.map(elRef.current, { zoomControl: false, attributionControl: false }).setView(TASHKENT, 12);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
        const marker = L.marker(TASHKENT, { draggable: true }).addTo(map);
        const label = async (lat: number, lng: number) => {
          try {
            const res = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16&accept-language=uz`,
              { headers: { Accept: "application/json" } }
            );
            const data = (await res.json()) as { display_name?: string };
            if (!disposed && data.display_name) onChange(data.display_name);
          } catch {
            if (!disposed) onChange(`Lokatsiya: ${lat.toFixed(5)}, ${lng.toFixed(5)}`);
          }
        };
        marker.on("dragend", () => {
          const ll = (marker as unknown as { getLatLng: () => { lat: number; lng: number } }).getLatLng();
          void label(ll.lat, ll.lng);
        });
        map.on("click", (e: { latlng: { lat: number; lng: number } }) => {
          marker.setLatLng([e.latlng.lat, e.latlng.lng]);
          void label(e.latlng.lat, e.latlng.lng);
        });
        mapRef.current = map as unknown as typeof mapRef.current;
        markerRef.current = marker as unknown as typeof markerRef.current;
        leafletCleanup = () => map.remove();
        setReady(true);
      } catch {
        if (!disposed) setFailed(true);
      }
    })();

    return () => {
      disposed = true;
      leafletCleanup?.();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-2 pt-1">
      <div className="relative overflow-hidden rounded-2xl border border-border">
        {failed ? (
          <div className="flex h-52 flex-col items-center justify-center gap-2 bg-secondary/40 px-6 text-center">
            <MapPin className="h-6 w-6 text-primary" />
            <p className="text-sm font-semibold">Xarita yuklanmadi</p>
            <p className="text-xs text-muted-foreground">«Manzil kiritish» tabidan manzilni qo‘lda yozing.</p>
          </div>
        ) : (
          <div ref={elRef} className="h-52 w-full bg-secondary/40" />
        )}
        {!ready && !failed && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/60 text-xs font-semibold text-muted-foreground">
            Xarita yuklanmoqda…
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 rounded-2xl border border-border bg-card/60 p-3">
        <MapPin className="h-4 w-4 shrink-0 text-primary" />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Xaritadan manzilni tanlang (pin qo‘ying)"
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>
      <p className="text-[11px] text-muted-foreground">
        Xaritada kerakli joyni bosing yoki pin’ni sudrab tashlang — manzil avtomatik aniqlanadi.
      </p>
    </div>
  );
}
