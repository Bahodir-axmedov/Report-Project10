import { useState } from "react";
import { motion } from "framer-motion";
import { ChefHat, CheckCircle2, Clock, Flame } from "lucide-react";
import { Button, Tabs } from "@/components/ui/primitives";
import { StaffHeader } from "@/components/staff/StaffHeader";
import { useAuth } from "@/lib/auth";
import { api, useDB, useNow } from "@/lib/store";
import { useToast } from "@/components/ui/toast";
import { cn, fmtTime, orderNumberLabel } from "@/lib/utils";
import type { Order } from "@/lib/types";

type Tab = "new" | "preparing" | "ready";

export default function KitchenPanel() {
  const db = useDB();
  const { staff } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("new");
  const now = useNow(30_000);

  const kitchenOrders = db.orders.filter((o) =>
    ["NEW", "ACCEPTED", "PREPARING", "READY", "WAITING_FOR_WAITER"].includes(o.status)
  );
  const newOrders = kitchenOrders.filter((o) => o.status === "NEW" || o.status === "ACCEPTED");
  const preparing = kitchenOrders.filter((o) => o.status === "PREPARING");
  const ready = kitchenOrders.filter((o) => o.status === "READY" || o.status === "WAITING_FOR_WAITER");

  const list = tab === "new" ? newOrders : tab === "preparing" ? preparing : ready;

  return (
    <div className="min-h-full bg-background pb-10">
      <StaffHeader title="Oshxona ekrani" audience="kitchen" />

      <div className="mx-auto max-w-[1600px] px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-extrabold">Oshxona</h1>
            <p className="text-sm text-muted-foreground">Buyurtmalarni qabul qiling va tayyorlang</p>
          </div>
          <div className="flex items-center gap-2 rounded-2xl border border-border bg-card/60 px-4 py-2.5">
            <Flame className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">{kitchenOrders.length} aktiv buyurtma</span>
          </div>
        </div>

        <div className="mt-5">
          <Tabs
            value={tab}
            onChange={setTab}
            items={[
              { value: "new", label: "🆕 Yangi", count: newOrders.length },
              { value: "preparing", label: "🧑‍🍳 Tayyorlanmoqda", count: preparing.length },
              { value: "ready", label: "✅ Tayyor", count: ready.length },
            ]}
          />
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.length === 0 && (
            <div className="col-span-full rounded-3xl border border-dashed border-border py-16 text-center text-muted-foreground">
              Bu bo‘limda buyurtma yo‘q
            </div>
          )}
          {list.map((o) => (
            <KitchenCard key={o.id} order={o} />
          ))}
        </div>
      </div>
    </div>
  );

  function KitchenCard({ order }: { order: Order }) {
    const elapsedMin = Math.round((now - order.createdAt) / 60000);
    const urgent = elapsedMin > 20 && order.status !== "READY" && order.status !== "WAITING_FOR_WAITER";

    return (
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className={cn(
          "flex flex-col rounded-3xl border-2 bg-card/70 p-5",
          urgent ? "border-destructive/60" : order.status === "READY" ? "border-[hsl(var(--success))]/50" : "border-border"
        )}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="font-display text-2xl font-extrabold">{orderNumberLabel(order.number)}</p>
            <p className="text-lg font-bold text-primary">{order.tableLabel}</p>
          </div>
          <div className={cn("flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold", urgent ? "bg-destructive/15 text-destructive" : "bg-secondary text-muted-foreground")}>
            <Clock className="h-4 w-4" /> {elapsedMin} daq
          </div>
        </div>

        <div className="mt-4 flex-1 space-y-2.5">
          {order.items.map((i) => (
            <div key={i.id} className="flex items-center gap-3 rounded-xl bg-secondary/40 px-3 py-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-extrabold text-primary-foreground">
                {i.qty}
              </span>
              <span className="text-base font-medium">{i.nameRu}</span>
              {i.note && <span className="ml-auto text-xs text-muted-foreground">{i.note}</span>}
            </div>
          ))}
        </div>

        {order.note && (
          <p className="mt-3 rounded-xl border border-[hsl(var(--warning))]/40 bg-[hsl(var(--warning))]/10 px-3 py-2 text-sm">
            📝 {order.note}
          </p>
        )}

        <div className="mt-4 flex gap-2">
          {(order.status === "NEW" || order.status === "ACCEPTED") && (
            <Button
              size="lg"
              className="flex-1"
              onClick={() => {
                api.updateOrderStatus(order.id, "PREPARING", staff);
                toast({ type: "success", title: "Tayyorlash boshlandi" });
              }}
            >
              <ChefHat className="h-5 w-5" /> Tayyorlash
            </Button>
          )}
          {order.status === "PREPARING" && (
            <Button
              size="lg"
              variant="success"
              className="flex-1"
              onClick={() => {
                api.updateOrderStatus(order.id, "READY", staff);
                toast({ type: "success", title: "Tayyor!", body: `${order.tableLabel} buyurtmasi tayyor` });
              }}
            >
              <CheckCircle2 className="h-5 w-5" /> Tayyor
            </Button>
          )}
          {(order.status === "READY" || order.status === "WAITING_FOR_WAITER") && (
            <div className="flex-1 rounded-2xl bg-[hsl(var(--success))]/15 py-3 text-center font-bold text-[hsl(var(--success))]">
              Ofitsant olib ketishini kutmoqda
            </div>
          )}
        </div>
      </motion.div>
    );
  }
}
