import { useState } from "react";
import { Banknote, CreditCard, Landmark, Receipt, Smartphone, Wallet } from "lucide-react";
import { Button, Card, EmptyState, Tabs } from "@/components/ui/primitives";
import { StaffHeader, StaffPageTitle } from "@/components/staff/StaffHeader";
import { PaymentModal } from "@/components/staff/widgets";
import { useAuth } from "@/lib/auth";
import { api, useDB, useNow } from "@/lib/store";
import { useToast } from "@/components/ui/toast";
import { activeOrdersForTable, tableSessionTotal } from "@/lib/reporting";
import { fmtDateTime, fmtNumber } from "@/lib/utils";
import type { PaymentMethod, RestaurantTable } from "@/lib/types";

const METHOD_LABEL: Record<PaymentMethod, { label: string; icon: typeof Banknote }> = {
  CASH: { label: "Naqd", icon: Banknote },
  CARD: { label: "Karta", icon: CreditCard },
  TERMINAL: { label: "Terminal", icon: Landmark },
  OTHER: { label: "Boshqa", icon: Wallet },
  CLICK: { label: "Click", icon: Smartphone },
  PAYME: { label: "Payme", icon: Wallet },
};

export default function CashierPanel() {
  const db = useDB();
  const { staff } = useAuth();
  const { toast } = useToast();
  const now = useNow(15_000);
  const [tab, setTab] = useState<"open" | "history">("open");
  const [payTable, setPayTable] = useState<RestaurantTable | null>(null);

  const openTables = db.tables.filter((t) => tableSessionTotal(db, t.id) > 0);
  const todayPayments = db.payments.filter((p) => new Date(p.createdAt).toDateString() === new Date().toDateString());
  const todayTotal = todayPayments.reduce((s, p) => s + p.amount, 0);

  return (
    <div className="min-h-full bg-background pb-10">
      <StaffHeader title="Kassa" audience="cashier" />
      <div className="mx-auto max-w-[1400px] px-4 py-6">
        <StaffPageTitle
          title="Kassa / To‘lovlar"
          subtitle={`Bugun: ${fmtNumber(todayTotal)} so‘m · ${todayPayments.length} to‘lov`}
        />

        <div className="mt-5">
          <Tabs
            value={tab}
            onChange={setTab}
            items={[
              { value: "open", label: "Ochiq hisoblar", count: openTables.length },
              { value: "history", label: "To‘lov tarixi", count: todayPayments.length },
            ]}
          />
        </div>

        <div className="mt-5">
          {tab === "open" ? (
            openTables.length === 0 ? (
              <EmptyState icon={<Receipt className="h-8 w-8" />} title="Ochiq hisob yo‘q" description="Barcha stollar yopilgan." />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {openTables.map((t) => {
                  const total = tableSessionTotal(db, t.id);
                  const orders = activeOrdersForTable(db, t.id);
                  return (
                    <Card key={t.id} className="p-4">
                      <div className="flex items-center justify-between">
                        <span className="font-display text-lg font-bold">Stol №{t.number}</span>
                        <span className="rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
                          {t.zone}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {orders.length} buyurtma · {orders.flatMap((o) => o.items).reduce((s, i) => s + i.qty, 0)} ta taom
                      </p>
                      <p className="mt-2 font-display text-2xl font-extrabold text-primary">{fmtNumber(total)} so‘m</p>
                      <Button className="mt-3 w-full" onClick={() => setPayTable(t)}>
                        To‘lovni qabul qilish
                      </Button>
                    </Card>
                  );
                })}
              </div>
            )
          ) : todayPayments.length === 0 ? (
            <EmptyState icon={<CreditCard className="h-8 w-8" />} title="To‘lovlar yo‘q" />
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-secondary/60 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Stol</th>
                    <th className="px-4 py-3">Summa</th>
                    <th className="px-4 py-3">Usul</th>
                    <th className="px-4 py-3">Vaqt</th>
                    <th className="px-4 py-3">Xodim</th>
                  </tr>
                </thead>
                <tbody>
                  {todayPayments.map((p) => {
                    const M = METHOD_LABEL[p.method];
                    const staffName = db.staff.find((s) => s.id === p.staffId)?.name ?? "—";
                    return (
                      <tr key={p.id} className="border-t border-border">
                        <td className="px-4 py-3 font-semibold">№{p.tableNumber}</td>
                        <td className="px-4 py-3 font-bold text-primary">{fmtNumber(p.amount)}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                            <M.icon className="h-3.5 w-3.5" /> {M.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{fmtDateTime(p.createdAt)}</td>
                        <td className="px-4 py-3 text-muted-foreground">{staffName}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Oxirgi yangilanish: {new Date(now).toLocaleTimeString("ru-RU")}
        </p>
      </div>

      <PaymentModal
        open={!!payTable}
        onClose={() => setPayTable(null)}
        tableNumber={payTable?.number ?? 0}
        total={payTable ? tableSessionTotal(db, payTable.id) : 0}
        onConfirm={(method) => {
          if (!payTable || !staff) return;
          const p = api.closeTable(payTable.id, method, staff);
          if (p) {
            toast({ type: "success", title: "To‘lov qabul qilindi", body: `${fmtNumber(p.amount)} so‘m` });
            setPayTable(null);
          }
        }}
      />
    </div>
  );
}
