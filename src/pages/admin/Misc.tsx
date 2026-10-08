import { useMemo, useState } from "react";
import { BellRing, CheckCheck, Download, Receipt, RotateCcw, Save, Users, XCircle } from "lucide-react";
import { Badge, Button, Card, EmptyState, Field, Input, Tabs, Textarea } from "@/components/ui/primitives";
import { StaffPageTitle } from "@/components/staff/StaffHeader";
import { useAuth } from "@/lib/auth";
import { api, useDB, resetDemoData } from "@/lib/store";
import { useToast } from "@/components/ui/toast";
import { downloadBlob, endOfDay, fmtDateTime, fmtNumber, startOfDay, toCSV, fmtTime } from "@/lib/utils";
import type { CallStatus, PaymentMethod } from "@/lib/types";

export function CallsPage() {
  const db = useDB();
  const { staff } = useAuth();
  const { toast } = useToast();
  const [filter, setFilter] = useState<"ALL" | CallStatus>("ALL");

  const calls = db.calls
    .filter((c) => filter === "ALL" || c.status === filter)
    .sort((a, b) => b.createdAt - a.createdAt);

  const setStatus = (id: string, status: CallStatus) => {
    if (!staff) return;
    api.setCallStatus(id, status, staff);
    toast({ type: "success", title: status === "ACCEPTED" ? "Qabul qilindi" : status === "COMPLETED" ? "Yakunlandi" : "Bekor qilindi" });
  };

  return (
    <div className="space-y-5">
      <StaffPageTitle title="Chaqiruvlar markazi" subtitle={`${db.calls.filter((c) => c.status === "PENDING").length} faol chaqiruv`} />
      <Tabs
        value={filter}
        onChange={setFilter}
        items={[
          { value: "ALL", label: "Barchasi", count: db.calls.length },
          { value: "PENDING", label: "Chaqirilmoqda", count: db.calls.filter((c) => c.status === "PENDING").length },
          { value: "ACCEPTED", label: "Qabul qilindi", count: db.calls.filter((c) => c.status === "ACCEPTED").length },
          { value: "COMPLETED", label: "Bajarildi", count: db.calls.filter((c) => c.status === "COMPLETED").length },
        ]}
      />
      {calls.length === 0 ? (
        <EmptyState icon={<BellRing className="h-8 w-8" />} title="Chaqiruvlar yo‘q" />
      ) : (
        <div className="space-y-2.5">
          {calls.map((c) => (
            <Card key={c.id} className="flex flex-wrap items-center gap-3 p-4">
              <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${c.type === "BILL" ? "bg-sky-500/15 text-sky-400" : "bg-primary/15 text-primary"}`}>
                {c.type === "BILL" ? <Receipt className="h-5 w-5" /> : <BellRing className="h-5 w-5" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  {c.type === "BILL" ? "Hisob so‘rovi" : "Ofitsant chaqiruvi"} · Stol №{c.tableNumber}
                </p>
                <p className="text-xs text-muted-foreground">
                  {fmtTime(c.createdAt)} · {c.note || "izohsiz"}
                </p>
              </div>
              <Badge tone={c.status === "PENDING" ? "primary" : c.status === "ACCEPTED" ? "warning" : c.status === "COMPLETED" ? "success" : "default"}>
                {c.status}
              </Badge>
              {c.status === "PENDING" && (
                <Button size="sm" onClick={() => setStatus(c.id, "ACCEPTED")}>Qabul</Button>
              )}
              {c.status === "ACCEPTED" && (
                <Button size="sm" variant="success" onClick={() => setStatus(c.id, "COMPLETED")}>
                  <CheckCheck className="h-4 w-4" /> Yakunlash
                </Button>
              )}
              {c.status !== "COMPLETED" && (
                <Button size="sm" variant="ghost" onClick={() => setStatus(c.id, "CANCELLED")} aria-label="Bekor qilish">
                  <XCircle className="h-4 w-4" />
                </Button>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

const METHOD_LABEL: Record<PaymentMethod, string> = {
  CASH: "Naqd",
  CARD: "Karta",
  TERMINAL: "Terminal",
  OTHER: "Boshqa",
};

export function PaymentsPage() {
  const db = useDB();
  const today = db.payments.filter((p) => p.createdAt >= startOfDay() && p.createdAt <= endOfDay());
  const total = today.reduce((s, p) => s + p.amount, 0);

  const exportCsv = () => {
    const rows: (string | number)[][] = [
      ["Vaqt", "Stol", "Summa", "Usul", "Xodim"],
      ...db.payments.map((p) => [
        fmtDateTime(p.createdAt),
        p.tableNumber,
        p.amount,
        METHOD_LABEL[p.method],
        db.staff.find((s) => s.id === p.staffId)?.name ?? "—",
      ]),
    ];
    downloadBlob(`yumi-tolovlar-${Date.now()}.csv`, toCSV(rows), "text/csv;charset=utf-8");
  };

  return (
    <div className="space-y-5">
      <StaffPageTitle
        title="To‘lovlar"
        subtitle={`Bugun: ${fmtNumber(total)} so‘m · ${today.length} to‘lov`}
        action={
          <Button variant="secondary" onClick={exportCsv}>
            <Download className="h-4 w-4" /> CSV
          </Button>
        }
      />
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Naqd</p>
          <p className="mt-1 font-display text-lg font-bold">{fmtNumber(today.filter((p) => p.method === "CASH").reduce((s, p) => s + p.amount, 0))}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Karta</p>
          <p className="mt-1 font-display text-lg font-bold">{fmtNumber(today.filter((p) => p.method === "CARD").reduce((s, p) => s + p.amount, 0))}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Terminal</p>
          <p className="mt-1 font-display text-lg font-bold">{fmtNumber(today.filter((p) => p.method === "TERMINAL").reduce((s, p) => s + p.amount, 0))}</p>
        </Card>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="w-full min-w-[620px] text-sm">
          <thead className="bg-secondary/60 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Vaqt</th>
              <th className="px-4 py-3">Stol</th>
              <th className="px-4 py-3">Summa</th>
              <th className="px-4 py-3">Usul</th>
              <th className="px-4 py-3">Xodim</th>
            </tr>
          </thead>
          <tbody>
            {db.payments.slice(0, 100).map((p) => (
              <tr key={p.id} className="border-t border-border">
                <td className="px-4 py-3 text-muted-foreground">{fmtDateTime(p.createdAt)}</td>
                <td className="px-4 py-3 font-semibold">№{p.tableNumber}</td>
                <td className="px-4 py-3 font-bold text-primary">{fmtNumber(p.amount)}</td>
                <td className="px-4 py-3">{METHOD_LABEL[p.method]}</td>
                <td className="px-4 py-3 text-muted-foreground">{db.staff.find((s) => s.id === p.staffId)?.name ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function CustomersPage() {
  const db = useDB();
  const rows = useMemo(() => {
    type Row = { customerToken: string; table: string; orders: number; total: number; last: number };
    const map = new Map<string, Row>();
    for (const o of db.orders) {
      const token = o.customerToken ?? `waiter-${o.createdByStaffId ?? "system"}`;
      const key = `${token}::${o.tableLabel}`;
      const existing = map.get(key);
      if (existing) {
        existing.orders += 1;
        existing.total += o.total;
        existing.last = Math.max(existing.last, o.createdAt);
      } else {
        map.set(key, { customerToken: token, table: o.tableLabel, orders: 1, total: o.total, last: o.createdAt });
      }
    }
    return [...map.values()].sort((a, b) => b.last - a.last).slice(0, 60);
  }, [db.orders]);

  return (
    <div className="space-y-5">
      <StaffPageTitle title="Mijozlar" subtitle="Sessiyalar bo‘yicha buyurtma tarixi" />
      {rows.length === 0 ? (
        <EmptyState icon={<Users className="h-8 w-8" />} title="Ma’lumot yo‘q" />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[620px] text-sm">
            <thead className="bg-secondary/60 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Sessiya</th>
                <th className="px-4 py-3">Stol</th>
                <th className="px-4 py-3">Buyurtmalar</th>
                <th className="px-4 py-3">Jami</th>
                <th className="px-4 py-3">Oxirgi faollik</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{r.customerToken.slice(0, 16)}</td>
                  <td className="px-4 py-3">{r.table}</td>
                  <td className="px-4 py-3">{r.orders}</td>
                  <td className="px-4 py-3 font-bold text-primary">{fmtNumber(r.total)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{fmtDateTime(r.last)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function SettingsPage() {
  const db = useDB();
  const { staff } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState(db.settings);

  const fields: { key: keyof typeof form; label: string; textarea?: boolean }[] = [
    { key: "name", label: "Restoran nomi" },
    { key: "tagline", label: "Slogan" },
    { key: "phone", label: "Telefon" },
    { key: "instagram", label: "Instagram" },
    { key: "telegram", label: "Telegram" },
    { key: "address", label: "Manzil" },
    { key: "mapsUrl", label: "Google Maps URL" },
    { key: "workingHours", label: "Ish vaqti" },
    { key: "deliveryInfo", label: "Yetkazib berish ma’lumoti" },
    { key: "footerText", label: "Footer matni" },
    { key: "description", label: "Restoran haqida", textarea: true },
  ];

  return (
    <div className="space-y-5">
      <StaffPageTitle
        title="Restoran sozlamalari"
        subtitle="Bu ma’lumotlar mijoz ilovasi va footerda ko‘rinadi"
        action={
          <Button
            onClick={() => {
              if (!staff) return;
              api.saveSettings(form, staff);
              toast({ type: "success", title: "Sozlamalar saqlandi" });
            }}
          >
            <Save className="h-4 w-4" /> Saqlash
          </Button>
        }
      />
      <Card className="p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          {fields.map((f) => (
            <div key={String(f.key)} className={f.textarea ? "sm:col-span-2" : ""}>
              <Field label={f.label}>
                {f.textarea ? (
                  <Textarea value={String(form[f.key])} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
                ) : (
                  <Input value={String(form[f.key])} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
                )}
              </Field>
            </div>
          ))}
          <Field label="Xizmat haqi (%)">
            <Input
              type="number"
              value={form.servicePercent}
              onChange={(e) => setForm({ ...form, servicePercent: Number(e.target.value) })}
            />
          </Field>
          <Field label="Valyuta">
            <Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
          </Field>
        </div>
      </Card>

      <Card className="border-destructive/40 p-5">
        <h2 className="font-display text-base font-bold text-destructive">Xavfli zona</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Barcha buyurtmalar, to‘lovlar va o‘zgarishlar o‘chirilib, tizim boshlang‘ich demo holatiga qaytariladi.
        </p>
        <Button
          variant="destructive"
          className="mt-4"
          onClick={() => {
            if (!window.confirm("Barcha ma’lumotlar o‘chiriladi va demo holat tiklanadi. Davom etilsinmi?")) return;
            resetDemoData();
            window.location.reload();
          }}
        >
          <RotateCcw className="h-4 w-4" /> Demo ma’lumotlarni tiklash
        </Button>
      </Card>
    </div>
  );
}

export function LogsPage() {
  const db = useDB();
  const [query, setQuery] = useState("");
  // The client's log shows restaurant operations only. Developer-console activity
  // stays inside the developer console (it is not part of the owner's workspace).
  const restaurantLogs = db.logs.filter((l) => l.entity !== "dev" && l.staffName !== "Developer");
  const logs = restaurantLogs.filter((l) => {
    const q = query.toLowerCase();
    return !q || l.action.toLowerCase().includes(q) || l.staffName.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-5">
      <StaffPageTitle
        title="Activity loglar"
        subtitle={`${restaurantLogs.length} yozuv · barcha muhim amallar`}
        action={
          <Button
            variant="secondary"
            onClick={() =>
              downloadBlob(
                `yumi-logs-${Date.now()}.csv`,
                toCSV([["Vaqt", "Xodim", "Rol", "Amal", "Obyekt", "Tafsilot"], ...restaurantLogs.map((l) => [fmtDateTime(l.at), l.staffName, l.role, l.action, l.entity, l.detail ?? ""])]),
                "text/csv;charset=utf-8"
              )
            }
          >
            <Download className="h-4 w-4" /> CSV
          </Button>
        }
      />
      <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Amal yoki xodim bo‘yicha qidirish..." />
      <div className="space-y-2">
        {logs.slice(0, 150).map((l) => (
          <Card key={l.id} className="flex items-center gap-3 p-3.5">
            <span className="w-14 shrink-0 text-xs text-muted-foreground">{fmtTime(l.at)}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{l.action}</p>
              <p className="text-xs text-muted-foreground">
                {l.staffName} · {l.role} {l.detail ? `· ${l.detail}` : ""}
              </p>
            </div>
            <Badge>{l.entity}</Badge>
          </Card>
        ))}
      </div>
    </div>
  );
}
