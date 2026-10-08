import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Search, XCircle } from "lucide-react";
import { Button, Card, Input, Select, Tabs } from "@/components/ui/primitives";
import { StaffPageTitle } from "@/components/staff/StaffHeader";
import { OrderStatusBadge } from "@/components/staff/widgets";
import { useAuth } from "@/lib/auth";
import { api, useDB } from "@/lib/store";
import { useToast } from "@/components/ui/toast";
import { canTransition, cn, fmtNumber, fmtTime, orderNumberLabel } from "@/lib/utils";
import type { Order, OrderStatus } from "@/lib/types";

const COLUMNS: OrderStatus[] = ["NEW", "ACCEPTED", "PREPARING", "READY", "DELIVERED", "COMPLETED", "CANCELLED"];

const NEXT: Partial<Record<OrderStatus, OrderStatus>> = {
  NEW: "ACCEPTED",
  ACCEPTED: "PREPARING",
  PREPARING: "READY",
  READY: "DELIVERED",
  WAITING_FOR_WAITER: "DELIVERED",
  DELIVERED: "COMPLETED",
};

export default function OrdersBoard() {
  const db = useDB();
  const { staff } = useAuth();
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"ALL" | "DINE_IN" | "PREORDER" | "DELIVERY">("ALL");
  const [view, setView] = useState<"board" | "table">("board");

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return db.orders.filter((o) => {
      if (typeFilter !== "ALL" && o.type !== typeFilter) return false;
      if (!q) return true;
      return (
        orderNumberLabel(o.number).toLowerCase().includes(q) ||
        o.tableLabel.toLowerCase().includes(q) ||
        o.items.some((i) => i.nameRu.toLowerCase().includes(q))
      );
    });
  }, [db.orders, query, typeFilter]);

  const advance = (o: Order, to: OrderStatus) => {
    if (!staff) return;
    if (!canTransition(o.status, to)) {
      toast({ type: "error", title: "Status o‘zgartirilmadi", body: `${o.status} → ${to} ruxsat etilmagan` });
      return;
    }
    api.updateOrderStatus(o.id, to, staff);
    toast({ type: "success", title: "Status yangilandi", body: `${orderNumberLabel(o.number)} → ${to}` });
  };

  return (
    <div className="space-y-5">
      <StaffPageTitle title="Buyurtmalar" subtitle={`${filtered.length} buyurtma · kanban va jadval ko‘rinishi`} />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buyurtma №, stol yoki taom..." className="pl-9" />
        </div>
        <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)} className="w-[180px]">
          <option value="ALL">Barcha turlar</option>
          <option value="DINE_IN">Zalda</option>
          <option value="PREORDER">Oldindan</option>
          <option value="DELIVERY">Yetkazib berish</option>
        </Select>
        <Tabs
          value={view}
          onChange={setView}
          items={[
            { value: "board", label: "Kanban" },
            { value: "table", label: "Jadval" },
          ]}
        />
      </div>

      {view === "board" ? (
        <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-2">
          {COLUMNS.map((col) => {
            const items = filtered.filter((o) => o.status === col);
            return (
              <div key={col} className="flex w-[280px] shrink-0 flex-col gap-2.5">
                <div className="flex items-center justify-between rounded-xl border border-border bg-card/60 px-3 py-2">
                  <OrderStatusBadge status={col} />
                  <span className="text-xs font-bold text-muted-foreground">{items.length}</span>
                </div>
                <div className="space-y-2.5">
                  {items.slice(0, 20).map((o) => (
                    <motion.div key={o.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                      <Card className="p-3">
                        <div className="flex items-center justify-between">
                          <span className="font-display text-sm font-bold">{orderNumberLabel(o.number)}</span>
                          <span className="text-[11px] text-muted-foreground">{fmtTime(o.createdAt)}</span>
                        </div>
                        <p className="mt-0.5 text-xs font-semibold text-primary">{o.tableLabel}</p>
                        <div className="mt-2 space-y-0.5">
                          {o.items.slice(0, 3).map((i) => (
                            <p key={i.id} className="truncate text-[11px] text-muted-foreground">
                              {i.nameRu} ×{i.qty}
                            </p>
                          ))}
                          {o.items.length > 3 && <p className="text-[11px] text-muted-foreground">+{o.items.length - 3} ta</p>}
                        </div>
                        <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
                          <span className="text-sm font-bold">{fmtNumber(o.total)}</span>
                          <div className="flex gap-1">
                            {NEXT[o.status] && canTransition(o.status, NEXT[o.status]!) && (
                              <Button size="sm" className="h-7 px-2 text-[11px]" onClick={() => advance(o, NEXT[o.status]!)}>
                                {NEXT[o.status]}
                              </Button>
                            )}
                            {o.status !== "COMPLETED" && o.status !== "CANCELLED" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2"
                                onClick={() => advance(o, "CANCELLED")}
                                aria-label="Bekor qilish"
                              >
                                <XCircle className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-secondary/60 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Stol</th>
                <th className="px-4 py-3">Tur</th>
                <th className="px-4 py-3">Taomlar</th>
                <th className="px-4 py-3">Summa</th>
                <th className="px-4 py-3">Holat</th>
                <th className="px-4 py-3">Vaqt</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 100).map((o) => (
                <tr key={o.id} className="border-t border-border hover:bg-white/[0.02]">
                  <td className="px-4 py-3 font-semibold">{orderNumberLabel(o.number)}</td>
                  <td className="px-4 py-3">{o.tableLabel}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {o.type === "DINE_IN" ? "Zalda" : o.type === "PREORDER" ? "Oldindan" : "Yetkazish"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {o.items.reduce((s, i) => s + i.qty, 0)} dona
                  </td>
                  <td className={cn("px-4 py-3 font-bold", o.status === "CANCELLED" && "text-muted-foreground line-through")}>
                    {fmtNumber(o.total)}
                  </td>
                  <td className="px-4 py-3">
                    <OrderStatusBadge status={o.status} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{fmtTime(o.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
