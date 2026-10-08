import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  BellRing,
  CheckCheck,
  ChefHat,
  Minus,
  Plus,
  Receipt,
  RefreshCw,
  Trash2,
  Truck,
  Utensils,
  XCircle,
} from "lucide-react";
import { Button, Card, EmptyState, Modal, Tabs } from "@/components/ui/primitives";
import { StaffHeader, StaffPageTitle } from "@/components/staff/StaffHeader";
import {
  AddProductModal,
  OrderStatusBadge,
  PaymentModal,
  TABLE_STATUS_META,
  TableTile,
} from "@/components/staff/widgets";
import { useAuth } from "@/lib/auth";
import { api, useDB } from "@/lib/store";
import { useToast } from "@/components/ui/toast";
import { activeOrdersForTable, tableSessionTotal } from "@/lib/reporting";
import { cn, fmtNumber, fmtTime, orderNumberLabel } from "@/lib/utils";
import type { CallStatus, Order, PaymentMethod, RestaurantTable } from "@/lib/types";

type Tab = "calls" | "tables" | "orders" | "bills";

export default function WaiterPanel() {
  const db = useDB();
  const { staff } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("calls");
  const [openTable, setOpenTable] = useState<RestaurantTable | null>(null);
  const [addTo, setAddTo] = useState<Order | null>(null);
  const [payTable, setPayTable] = useState<RestaurantTable | null>(null);

  const pendingCalls = db.calls.filter((c) => c.status === "PENDING" || c.status === "ACCEPTED");
  const activeOrders = db.orders.filter((o) => o.status !== "COMPLETED" && o.status !== "CANCELLED");

  const handleCall = (id: string, status: CallStatus) => {
    if (!staff) return;
    api.setCallStatus(id, status, staff);
    toast({ type: "success", title: status === "ACCEPTED" ? "Qabul qilindi" : "Yakunlandi" });
  };

  const closePayment = (table: RestaurantTable, method: PaymentMethod) => {
    if (!staff) return;
    const payment = api.closeTable(table.id, method, staff);
    if (payment) {
      toast({ type: "success", title: "Hisob yopildi", body: `${table.number}-stol · ${fmtNumber(payment.amount)} so‘m` });
      setPayTable(null);
      setOpenTable(null);
    }
  };

  const callFor = (tableId: string) => pendingCalls.find((c) => c.tableId === tableId);

  return (
    <div className="min-h-full bg-background pb-10">
      <StaffHeader title="Ofitsant paneli" audience="waiter" />

      <div className="mx-auto max-w-[1400px] px-4 py-6">
        <div className="lg:hidden">
          <StaffPageTitle title="Ofitsant paneli" subtitle="Stollar, chaqiruvlar va buyurtmalar" />
        </div>

        <div className="mt-4 lg:mt-0">
          <Tabs
            value={tab}
            onChange={setTab}
            items={[
              { value: "calls", label: "🔔 Chaqiruvlar", count: pendingCalls.length },
              { value: "tables", label: "🍽 Stollar", count: db.tables.filter((t) => t.status !== "EMPTY").length },
              { value: "orders", label: "📋 Aktiv buyurtmalar", count: activeOrders.length },
              { value: "bills", label: "💰 Hisoblar" },
            ]}
          />
        </div>

        <div className="mt-5">
          {tab === "calls" && (
            <div className="space-y-3">
              {pendingCalls.length === 0 ? (
                <EmptyState icon={<BellRing className="h-8 w-8" />} title="Faol chaqiruv mavjud emas" description="Mijoz chaqiruvlari shu yerda realtime ko‘rinadi." />
              ) : (
                pendingCalls.map((c) => (
                  <motion.div key={c.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                    <Card className="flex flex-wrap items-center gap-3 p-4">
                      <div
                        className={cn(
                          "flex h-12 w-12 items-center justify-center rounded-2xl",
                          c.type === "BILL" ? "bg-sky-500/15 text-sky-400" : "bg-primary/15 text-primary"
                        )}
                      >
                        {c.type === "BILL" ? <Receipt className="h-6 w-6" /> : <BellRing className="h-6 w-6" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-display text-base font-bold">
                          {c.type === "BILL" ? "Hisob so‘ralmoqda" : "Ofitsant chaqirilmoqda"} · Stol №{c.tableNumber}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {fmtTime(c.createdAt)} {c.note ? `· "${c.note}"` : ""}
                        </p>
                      </div>
                      {c.status === "PENDING" ? (
                        <Button size="sm" onClick={() => handleCall(c.id, "ACCEPTED")}>
                          Qabul qilish
                        </Button>
                      ) : (
                        <Button size="sm" variant="success" onClick={() => handleCall(c.id, "COMPLETED")}>
                          <CheckCheck className="h-4 w-4" /> Yakunlash
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => handleCall(c.id, "CANCELLED")}>
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </Card>
                  </motion.div>
                ))
              )}
            </div>
          )}

          {tab === "tables" && (
            <>
              <div className="mb-4 flex flex-wrap gap-3 text-xs">
                {(Object.keys(TABLE_STATUS_META) as (keyof typeof TABLE_STATUS_META)[]).map((k) => (
                  <span key={k} className="flex items-center gap-1.5 text-muted-foreground">
                    <span className={cn("h-2.5 w-2.5 rounded-full", TABLE_STATUS_META[k].dot)} /> {TABLE_STATUS_META[k].label}
                  </span>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
                {db.tables
                  .filter((t) => t.active)
                  .sort((a, b) => a.number - b.number)
                  .map((t) => (
                    <TableTile
                      key={t.id}
                      table={t}
                      activeOrders={activeOrdersForTable(db, t.id).length}
                      hasCall={!!callFor(t.id)}
                      onClick={() => setOpenTable(t)}
                    />
                  ))}
              </div>
            </>
          )}

          {tab === "orders" && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {activeOrders.length === 0 ? (
                <div className="sm:col-span-2 lg:col-span-3">
                  <EmptyState icon={<Utensils className="h-8 w-8" />} title="Aktiv buyurtmalar yo‘q" />
                </div>
              ) : (
                activeOrders.map((o) => (
                  <OrderCard key={o.id} order={o} onAdd={() => setAddTo(o)} />
                ))
              )}
            </div>
          )}

          {tab === "bills" && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {db.tables.filter((t) => tableSessionTotal(db, t.id) > 0).length === 0 ? (
                <div className="sm:col-span-2 lg:col-span-3">
                  <EmptyState icon={<Receipt className="h-8 w-8" />} title="Yopilishi kerak hisob yo‘q" description="Band stollarning hisoblari shu yerda ko‘rinadi." />
                </div>
              ) : (
                db.tables
                  .filter((t) => tableSessionTotal(db, t.id) > 0)
                  .map((t) => {
                    const total = tableSessionTotal(db, t.id);
                    const orders = activeOrdersForTable(db, t.id);
                    return (
                      <Card key={t.id} className="p-4">
                        <div className="flex items-center justify-between">
                          <span className="font-display text-lg font-bold">Stol №{t.number}</span>
                          <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-[11px] font-bold text-primary">
                            {orders.length} buyurtma
                          </span>
                        </div>
                        <p className="mt-3 text-xs text-muted-foreground">
                          {orders.flatMap((o) => o.items).reduce((s, i) => s + i.qty, 0)} ta taom
                        </p>
                        <p className="mt-1 font-display text-2xl font-extrabold text-primary">{fmtNumber(total)} so‘m</p>
                        <div className="mt-3 flex gap-2">
                          <Button size="sm" variant="outline" className="flex-1" onClick={() => setOpenTable(t)}>
                            Ko‘rish
                          </Button>
                          <Button size="sm" className="flex-1" onClick={() => setPayTable(t)}>
                            Hisobni yopish
                          </Button>
                        </div>
                      </Card>
                    );
                  })
              )}
            </div>
          )}
        </div>
      </div>

      {/* Table detail */}
      <Modal
        open={!!openTable}
        onClose={() => setOpenTable(null)}
        title={openTable ? `Stol №${openTable.number}` : ""}
        size="lg"
        footer={
          openTable && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setAddTo(activeOrdersForTable(db, openTable.id)[0] ?? null)}>
                <Plus className="h-4 w-4" /> Mahsulot qo‘shish
              </Button>
              <div className="flex-1" />
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  api.createCall(openTable.id, "BILL", "Ofitsant chaqirdi");
                  toast({ type: "info", title: "Hisob so‘rovi yaratildi" });
                }}
              >
                <RefreshCw className="h-4 w-4" /> Hisob so‘rash
              </Button>
              <Button size="sm" onClick={() => setPayTable(openTable)}>
                <Receipt className="h-4 w-4" /> Hisobni yopish
              </Button>
            </div>
          )
        }
      >
        {openTable && (
          <TableDetail
            table={openTable}
            onAddRequest={(o) => setAddTo(o)}
            onCancelOrder={(o) => {
              if (!staff) return;
              api.cancelOrder(o.id, staff, "Ofitsant bekor qildi");
              toast({ type: "info", title: "Buyurtma bekor qilindi" });
            }}
          />
        )}
      </Modal>

      <AddProductModal
        open={!!addTo}
        onClose={() => setAddTo(null)}
        onAdd={(pid, qty) => {
          if (!staff || !addTo) return;
          api.addItemToOrder(addTo.id, pid, qty, staff);
          toast({ type: "success", title: "Mahsulot qo‘shildi" });
        }}
      />

      <PaymentModal
        open={!!payTable}
        onClose={() => setPayTable(null)}
        tableNumber={payTable?.number ?? 0}
        total={payTable ? tableSessionTotal(db, payTable.id) : 0}
        onConfirm={(method, parts) => {
          if (payTable) closePayment(payTable, method);
          void parts;
        }}
      />
    </div>
  );
}

function OrderCard({ order, onAdd }: { order: Order; onAdd: () => void }) {
  const { staff } = useAuth();
  const { toast } = useToast();
  const next: Partial<Record<Order["status"], { label: string; status: Order["status"] }>> = {
    NEW: { label: "Qabul qilish", status: "ACCEPTED" },
    ACCEPTED: { label: "Tayyorlash", status: "PREPARING" },
    PREPARING: { label: "Tayyor", status: "READY" },
    READY: { label: "Stolga yetkazish", status: "DELIVERED" },
    WAITING_FOR_WAITER: { label: "Stolga yetkazish", status: "DELIVERED" },
    DELIVERED: { label: "Yakunlash", status: "COMPLETED" },
  };
  const action = next[order.status];

  return (
    <Card className="flex flex-col p-4">
      <div className="flex items-center justify-between">
        <span className="font-display text-base font-bold">{orderNumberLabel(order.number)}</span>
        <OrderStatusBadge status={order.status} />
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {order.tableLabel} · {fmtTime(order.createdAt)} · {order.type === "DELIVERY" ? "Yetkazish" : order.type === "PREORDER" ? "Oldindan" : "Zalda"}
      </p>
      <div className="mt-3 flex-1 space-y-1">
        {order.items.map((i) => (
          <div key={i.id} className="flex items-center justify-between text-sm">
            <span className={cn("truncate", i.delivered && "text-muted-foreground line-through")}>
              {i.nameRu} ×{i.qty}
            </span>
            <span className="text-xs text-muted-foreground">{fmtNumber(i.price * i.qty)}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
        <span className="font-display font-bold">{fmtNumber(order.total)} so‘m</span>
        <div className="flex gap-1.5">
          <Button size="sm" variant="ghost" onClick={onAdd} aria-label="Mahsulot qo‘shish">
            <Plus className="h-4 w-4" />
          </Button>
          {action && staff && (
            <Button
              size="sm"
              onClick={() => {
                api.updateOrderStatus(order.id, action.status, staff);
                toast({ type: "success", title: action.label });
              }}
            >
              {action.label}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

function TableDetail({
  table,
  onAddRequest,
  onCancelOrder,
}: {
  table: RestaurantTable;
  onAddRequest: (o: Order) => void;
  onCancelOrder: (o: Order) => void;
}) {
  const db = useDB();
  const { staff } = useAuth();
  const { toast } = useToast();
  const orders = activeOrdersForTable(db, table.id);
  const total = tableSessionTotal(db, table.id);
  const calls = db.calls.filter((c) => c.tableId === table.id && c.status !== "COMPLETED");

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2.5">
        <Stat label="Status" value={TABLE_STATUS_META[table.status].label} />
        <Stat label="Buyurtmalar" value={String(orders.length)} />
        <Stat label="Jami" value={fmtNumber(total)} />
      </div>

      {calls.length > 0 && (
        <div className="rounded-2xl border border-primary/40 bg-primary/10 p-3">
          <p className="flex items-center gap-2 text-sm font-bold text-primary">
            <BellRing className="h-4 w-4" /> Faol chaqiruv
          </p>
          {calls.map((c) => (
            <p key={c.id} className="mt-1 text-xs text-muted-foreground">
              {c.type === "BILL" ? "Hisob" : "Ofitsant"} · {fmtTime(c.createdAt)}
            </p>
          ))}
        </div>
      )}

      {orders.length === 0 ? (
        <EmptyState icon={<Utensils className="h-7 w-7" />} title="Buyurtma yo‘q" description="Bu stolda hozircha buyurtma mavjud emas." />
      ) : (
        orders.map((o) => (
          <div key={o.id} className="rounded-2xl border border-border bg-card/50 p-4">
            <div className="flex items-center justify-between">
              <span className="font-display font-bold">{orderNumberLabel(o.number)}</span>
              <OrderStatusBadge status={o.status} />
            </div>
            <div className="mt-3 space-y-2">
              {o.items.map((it) => (
                <div key={it.id} className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <p className={cn("truncate text-sm font-medium", it.delivered && "text-muted-foreground line-through")}>
                      {it.nameRu}
                    </p>
                    <p className="text-xs text-muted-foreground">{fmtNumber(it.price)} so‘m</p>
                  </div>
                  <div className="flex items-center gap-0.5 rounded-xl border border-border bg-secondary/60 p-0.5">
                    <button
                      onClick={() => staff && api.updateItemQty(o.id, it.id, it.qty - 1, staff)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-white/5"
                      aria-label="Kamaytirish"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-6 text-center text-sm font-bold">{it.qty}</span>
                    <button
                      onClick={() => staff && api.updateItemQty(o.id, it.id, it.qty + 1, staff)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-white/5"
                      aria-label="Ko‘paytirish"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <button
                    onClick={() => staff && api.removeItem(o.id, it.id, staff)}
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-white/5 hover:text-destructive"
                    aria-label="O‘chirish"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
              <span className="font-display font-bold">{fmtNumber(o.total)} so‘m</span>
              <div className="flex gap-1.5">
                <Button size="sm" variant="outline" onClick={() => onAddRequest(o)}>
                  <Plus className="h-4 w-4" /> Qo‘shish
                </Button>
                {(o.status === "READY" || o.status === "WAITING_FOR_WAITER") && staff && (
                  <Button size="sm" variant="success" onClick={() => api.updateOrderStatus(o.id, "DELIVERED", staff)}>
                    <Truck className="h-4 w-4" /> Yetkazdim
                  </Button>
                )}
                {o.status === "NEW" && staff && (
                  <Button size="sm" onClick={() => api.updateOrderStatus(o.id, "ACCEPTED", staff)}>
                    <ChefHat className="h-4 w-4" /> Qabul
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => onCancelOrder(o)} aria-label="Bekor qilish">
                  <XCircle className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          </div>
        ))
      )}

      {orders.length > 0 && (
        <Button
          variant="secondary"
          className="w-full"
          onClick={() => {
            const first = orders[0];
            if (first && staff) {
              api.updateOrderStatus(first.id, "DELIVERED", staff);
              toast({ type: "success", title: "Yetkazildi" });
            }
          }}
        >
          <Truck className="h-4 w-4" /> Barchasini yetkazildi deb belgilash
        </Button>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-secondary/40 p-3 text-center">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-display text-base font-bold">{value}</p>
    </div>
  );
}
