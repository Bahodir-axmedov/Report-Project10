import { useMemo, useState } from "react";
import { Banknote, CreditCard, Landmark, Plus, Search, Users, Wallet } from "lucide-react";
import { Badge, Button, Input, Modal } from "@/components/ui/primitives";
import { FoodImage } from "@/components/FoodImage";
import { useDB } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import { cn, fmtNumber, ORDER_STATUS_LABELS } from "@/lib/utils";
import type { OrderStatus, PaymentMethod, RestaurantTable, TableStatus } from "@/lib/types";

export const TABLE_STATUS_META: Record<
  TableStatus,
  { label: string; dot: string; ring: string; text: string }
> = {
  EMPTY: { label: "Bo‘sh", dot: "bg-[hsl(var(--success))]", ring: "border-[hsl(var(--success))]/40", text: "text-[hsl(var(--success))]" },
  OCCUPIED: { label: "Band", dot: "bg-destructive", ring: "border-destructive/40", text: "text-destructive" },
  WAITING: { label: "Kutilmoqda", dot: "bg-[hsl(var(--warning))]", ring: "border-[hsl(var(--warning))]/40", text: "text-[hsl(var(--warning))]" },
  BILL: { label: "Hisob", dot: "bg-sky-400", ring: "border-sky-400/40", text: "text-sky-400" },
};

export const ORDER_STATUS_TONE: Record<OrderStatus, "default" | "primary" | "success" | "warning" | "danger" | "info"> = {
  NEW: "info",
  ACCEPTED: "primary",
  PREPARING: "warning",
  READY: "success",
  WAITING_FOR_WAITER: "warning",
  DELIVERED: "primary",
  COMPLETED: "success",
  CANCELLED: "danger",
};

export function OrderStatusBadge({ status, lang = "uz" }: { status: OrderStatus; lang?: "uz" | "ru" | "en" }) {
  return <Badge tone={ORDER_STATUS_TONE[status]}>{ORDER_STATUS_LABELS[status][lang]}</Badge>;
}

export function TableTile({
  table,
  activeOrders,
  onClick,
  hasCall,
}: {
  table: RestaurantTable;
  activeOrders: number;
  onClick: () => void;
  hasCall?: boolean;
}) {
  const meta = TABLE_STATUS_META[table.status];
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative flex aspect-square flex-col items-center justify-center gap-1 rounded-2xl border-2 bg-card/70 p-2 transition hover:scale-[1.02] active:scale-[0.98]",
        meta.ring
      )}
    >
      {hasCall && (
        <span className="absolute right-1.5 top-1.5 flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
        </span>
      )}
      <span className={cn("absolute left-2 top-2 h-2.5 w-2.5 rounded-full", meta.dot)} />
      <span className="font-display text-xl font-extrabold">{table.number}</span>
      <span className={cn("text-[10px] font-semibold", meta.text)}>{meta.label}</span>
      {activeOrders > 0 && (
        <span className="absolute bottom-1.5 text-[10px] text-muted-foreground">{activeOrders} buyurtma</span>
      )}
      <span className="absolute bottom-1.5 right-2 flex items-center gap-0.5 text-[10px] text-muted-foreground">
        <Users className="h-3 w-3" />
        {table.seats}
      </span>
    </button>
  );
}

export function PaymentModal({
  open,
  onClose,
  tableNumber,
  total,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  tableNumber: number;
  total: number;
  onConfirm: (method: PaymentMethod, parts: number[]) => void;
}) {
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [split, setSplit] = useState(false);
  const [parts, setParts] = useState(3);

  const methods: { value: PaymentMethod; label: string; icon: typeof Banknote }[] = [
    { value: "CASH", label: "Naqd", icon: Banknote },
    { value: "CARD", label: "Bank karta", icon: CreditCard },
    { value: "TERMINAL", label: "Terminal", icon: Landmark },
    { value: "OTHER", label: "Boshqa", icon: Wallet },
  ];

  const perPerson = Math.ceil(total / Math.max(1, parts));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Hisobni yopish · Stol ${tableNumber}`}
      footer={
        <div className="flex gap-2">
          <Button variant="ghost" className="flex-1" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button
            className="flex-1"
            onClick={() =>
              onConfirm(
                method,
                split ? Array.from({ length: parts }, () => perPerson) : [total]
              )
            }
          >
            To‘lovni tasdiqlash
          </Button>
        </div>
      }
    >
      <div className="flex items-center justify-between rounded-2xl border border-border bg-secondary/40 p-4">
        <span className="text-sm text-muted-foreground">Umumiy summa</span>
        <span className="font-display text-2xl font-extrabold text-primary">{fmtNumber(total)} so‘m</span>
      </div>

      <h3 className="mt-5 text-sm font-bold">To‘lov usuli</h3>
      <div className="mt-2.5 grid grid-cols-2 gap-2.5">
        {methods.map((m) => (
          <button
            key={m.value}
            onClick={() => setMethod(m.value)}
            className={cn(
              "flex items-center gap-2.5 rounded-xl border p-3 text-left transition",
              method === m.value ? "border-primary bg-primary/10" : "border-border bg-card/60 hover:bg-white/5"
            )}
          >
            <m.icon className={cn("h-5 w-5", method === m.value ? "text-primary" : "text-muted-foreground")} />
            <span className="text-sm font-semibold">{m.label}</span>
          </button>
        ))}
      </div>

      <div className="mt-5 rounded-2xl border border-border bg-card/60 p-4">
        <label className="flex cursor-pointer items-center justify-between">
          <span className="text-sm font-bold">Hisobni bo‘lish (split bill)</span>
          <input
            type="checkbox"
            checked={split}
            onChange={(e) => setSplit(e.target.checked)}
            className="h-4 w-4 accent-[hsl(var(--primary))]"
          />
        </label>
        {split && (
          <div className="mt-3 space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">Odamlar soni</span>
              <div className="flex items-center gap-1 rounded-xl border border-border bg-secondary/60 p-1">
                {[2, 3, 4, 5, 6].map((n) => (
                  <button
                    key={n}
                    onClick={() => setParts(n)}
                    className={cn(
                      "h-8 w-8 rounded-lg text-sm font-bold transition",
                      parts === n ? "bg-primary text-primary-foreground" : "hover:bg-white/5"
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-1.5">
              {Array.from({ length: parts }).map((_, i) => (
                <div key={i} className="flex items-center justify-between rounded-xl bg-secondary/40 px-3 py-2 text-sm">
                  <span className="text-muted-foreground">Mijoz {i + 1}</span>
                  <span className="font-semibold">{fmtNumber(perPerson)} so‘m</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

export function AddProductModal({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (productId: string, qty: number) => void;
}) {
  const db = useDB();
  const { localizedName } = useI18n();
  const [query, setQuery] = useState("");
  const [qty, setQty] = useState(1);

  const results = useMemo(() => {
    const q = query.toLowerCase();
    return db.products
      .filter((p) => p.available)
      .filter((p) => !q || localizedName(p).toLowerCase().includes(q) || p.nameRu.toLowerCase().includes(q))
      .slice(0, 30);
  }, [db.products, query, localizedName]);

  return (
    <Modal open={open} onClose={onClose} title="Mahsulot qo‘shish" size="lg">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Taom qidirish..." className="pl-9" />
        </div>
        <div className="flex items-center gap-1 rounded-xl border border-border bg-secondary/60 px-2">
          <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="h-8 w-8 rounded-lg text-lg font-bold hover:bg-white/5">
            −
          </button>
          <span className="w-6 text-center text-sm font-bold">{qty}</span>
          <button onClick={() => setQty((q) => q + 1)} className="h-8 w-8 rounded-lg text-lg font-bold hover:bg-white/5">
            +
          </button>
        </div>
      </div>
      <div className="mt-4 grid max-h-[50vh] gap-2 overflow-y-auto sm:grid-cols-2">
        {results.map((p) => (
          <button
            key={p.id}
            onClick={() => {
              onAdd(p.id, qty);
              onClose();
            }}
            className="flex items-center gap-3 rounded-2xl border border-border bg-card/60 p-2.5 text-left transition hover:border-primary/50"
          >
            <FoodImage src={p.image} alt={p.nameRu} className="h-12 w-12 rounded-xl" />
            <div className="min-w-0 flex-1">
              <p className="line-clamp-1 text-sm font-semibold">{localizedName(p)}</p>
              <p className="text-xs font-bold text-primary">{fmtNumber(p.price)} so‘m</p>
            </div>
            <Plus className="h-4 w-4 text-muted-foreground" />
          </button>
        ))}
      </div>
    </Modal>
  );
}
