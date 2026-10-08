import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { FileSpreadsheet, Printer } from "lucide-react";
import { Button, Card, EmptyState, Tabs } from "@/components/ui/primitives";
import { StaffPageTitle } from "@/components/staff/StaffHeader";
import { useDB } from "@/lib/store";
import {
  ordersByHour,
  productProfit,
  profitByMonth,
  profitIn,
  revenueByDay,
  summarize,
  waiterPerformance,
} from "@/lib/reporting";
import { downloadBlob, endOfDay, fmtNumber, startOfDay, toCSV } from "@/lib/utils";

type RangeKey = "today" | "yesterday" | "week" | "month" | "custom";

const COLORS = ["#e11d2a", "#ff6b3d", "#f5a524", "#3ddc97", "#4aa3ff", "#a855f7"];

function rangeFor(key: RangeKey, customFrom: string, customTo: string): { from: number; to: number; label: string } {
  const now = new Date();
  if (key === "today") return { from: startOfDay(now), to: endOfDay(now), label: "Bugun" };
  if (key === "yesterday") {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    return { from: startOfDay(y), to: endOfDay(y), label: "Kecha" };
  }
  if (key === "week") {
    const w = new Date(now);
    w.setDate(w.getDate() - 6);
    return { from: startOfDay(w), to: endOfDay(now), label: "Shu hafta" };
  }
  if (key === "month") {
    const m = new Date(now);
    m.setDate(m.getDate() - 29);
    return { from: startOfDay(m), to: endOfDay(now), label: "Shu oy" };
  }
  const from = customFrom ? startOfDay(new Date(customFrom)) : startOfDay(now);
  const to = customTo ? endOfDay(new Date(customTo)) : endOfDay(now);
  return { from, to, label: `${customFrom || "—"} → ${customTo || "—"}` };
}

export function Reports() {
  const db = useDB();
  const [range, setRange] = useState<RangeKey>("today");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const { from, to, label } = useMemo(() => rangeFor(range, customFrom, customTo), [range, customFrom, customTo]);
  const s = useMemo(() => summarize(db, from, to), [db, from, to]);
  const series = revenueByDay(db, 7);
  const hourly = ordersByHour(db, from, to);
  const profit = useMemo(() => profitIn(db, from, to), [db, from, to]);
  const perProductProfit = useMemo(() => productProfit(db, from, to), [db, from, to]);
  const monthlyProfit = profitByMonth(db, 6);

  const exportCsv = () => {
    const rows: (string | number)[][] = [
      ["Mahsulot", "Kategoriya", "Miqdor", "Summa (so'm)"],
      ...s.productSales.map((p) => [
        p.name,
        db.categories.find((c) => c.id === p.categoryId)?.nameRu ?? "",
        p.qty,
        p.revenue,
      ]),
    ];
    downloadBlob(`yumi-hisobot-${Date.now()}.csv`, toCSV(rows), "text/csv;charset=utf-8");
  };

  return (
    <div className="space-y-5">
      <StaffPageTitle
        title="Hisobotlar"
        subtitle={`${label} · real ma’lumotlar`}
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={exportCsv}>
              <FileSpreadsheet className="h-4 w-4" /> CSV / Excel
            </Button>
            <Button variant="secondary" onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> PDF
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <Tabs
          value={range}
          onChange={setRange}
          items={[
            { value: "today", label: "Bugun" },
            { value: "yesterday", label: "Kecha" },
            { value: "week", label: "Hafta" },
            { value: "month", label: "Oy" },
            { value: "custom", label: "Sana oralig‘i" },
          ]}
        />
        {range === "custom" && (
          <div className="flex gap-2">
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="h-9 rounded-xl border border-border bg-secondary/60 px-3 text-sm"
            />
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="h-9 rounded-xl border border-border bg-secondary/60 px-3 text-sm"
            />
          </div>
        )}
      </div>

      {/* ---------------- profit ---------------- */}
      <Card className="min-w-0 p-5">
        <h2 className="font-display text-base font-bold">Foyda tahlili · {label}</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KPI label="Savdo" value={`${fmtNumber(profit.revenue)} so‘m`} />
          <KPI label="Tannarx" value={`${fmtNumber(profit.cost)} so‘m`} sub={`${profit.productsSold} dona mahsulot`} />
          <KPI label="Sof foyda" value={`${fmtNumber(profit.profit)} so‘m`} sub={`Marja ${profit.marginPct}%`} />
          <KPI label="O‘rtacha foyda / buyurtma" value={`${fmtNumber(profit.avgProfit)} so‘m`} sub={`${profit.orders} buyurtma`} />
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-muted-foreground">Oylik foyda (6 oy)</h3>
            <div className="mt-3 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyProfit}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#22222a" vertical={false} />
                  <XAxis dataKey="label" stroke="#6b6b76" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#6b6b76" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} />
                  <Tooltip
                    cursor={{ fill: "rgba(255,255,255,0.04)" }}
                    contentStyle={{ background: "#141418", border: "1px solid #2a2a31", borderRadius: 12, color: "#fff" }}
                    formatter={(v: number, name: string) => [`${fmtNumber(v)} so‘m`, name === "profit" ? "Foyda" : "Savdo"]}
                  />
                  <Legend formatter={(v) => (v === "profit" ? "Foyda" : "Savdo")} />
                  <Bar dataKey="revenue" fill="#6b6b76" radius={[5, 5, 0, 0]} />
                  <Bar dataKey="profit" fill="#3ddc97" radius={[5, 5, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-muted-foreground">Eng foydali taomlar</h3>
            <div className="mt-3 max-h-56 space-y-2 overflow-y-auto pr-1">
              {perProductProfit.slice(0, 12).map((p) => (
                <div key={p.productId} className="flex items-center gap-3 rounded-xl bg-secondary/30 px-3 py-2">
                  <span className="min-w-0 flex-1 truncate text-sm">{p.name}</span>
                  <span className="text-xs text-muted-foreground">{p.qty} dona</span>
                  <span className="text-xs text-muted-foreground">{fmtNumber(p.cost)}</span>
                  <span className="text-sm font-bold text-[hsl(var(--success))]">{fmtNumber(p.profit)}</span>
                </div>
              ))}
              {perProductProfit.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">Bu oraliqda savdo yo‘q</p>
              )}
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KPI label="Umumiy savdo" value={`${fmtNumber(s.revenue)} so‘m`} />
        <KPI label="Buyurtmalar" value={String(s.orders)} sub={`${s.completed} yakunlangan · ${s.cancelled} bekor`} />
        <KPI label="O‘rtacha chek" value={`${fmtNumber(s.avgOrder)} so‘m`} />
        <KPI label="Sotilgan taomlar" value={String(s.productsSold)} />
        <KPI label="Zalda" value={fmtNumber(s.dineInRevenue)} />
        <KPI label="Yetkazib berish" value={fmtNumber(s.deliveryRevenue)} />
        <KPI label="Naqd / Karta" value={`${fmtNumber(s.cashSales)} / ${fmtNumber(s.cardSales)}`} />
        <KPI label="Chegirma" value={fmtNumber(s.discount)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="min-w-0 p-5">
          <h2 className="font-display text-base font-bold">Savdo grafigi (7 kun)</h2>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series}>
                <CartesianGrid strokeDasharray="3 3" stroke="#232329" />
                <XAxis dataKey="label" stroke="#6b6b76" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#6b6b76" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} />
                <Tooltip contentStyle={{ background: "#141418", border: "1px solid #2a2a31", borderRadius: 12, color: "#fff" }} />
                <Line type="monotone" dataKey="revenue" stroke="#e11d2a" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="min-w-0 p-5">
          <h2 className="font-display text-base font-bold">Soatlar bo‘yicha</h2>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourly}>
                <CartesianGrid strokeDasharray="3 3" stroke="#232329" />
                <XAxis dataKey="hour" stroke="#6b6b76" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#6b6b76" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip cursor={{ fill: "rgba(255,255,255,0.04)" }} contentStyle={{ background: "#141418", border: "1px solid #2a2a31", borderRadius: 12, color: "#fff" }} />
                <Bar dataKey="orders" fill="#e11d2a" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card className="min-w-0 p-5">
        <h2 className="font-display text-base font-bold">Mahsulotlar savdosi</h2>
        {s.productSales.length === 0 ? (
          <EmptyState title="Ma’lumot yo‘q" description="Tanlangan davrda buyurtmalar mavjud emas." />
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="pb-2">Mahsulot</th>
                  <th className="pb-2">Kategoriya</th>
                  <th className="pb-2 text-right">Miqdor</th>
                  <th className="pb-2 text-right">Summa</th>
                </tr>
              </thead>
              <tbody>
                {s.productSales.slice(0, 40).map((p) => (
                  <tr key={p.productId} className="border-t border-border">
                    <td className="py-2">{p.name}</td>
                    <td className="py-2 text-muted-foreground">
                      {db.categories.find((c) => c.id === p.categoryId)?.nameRu ?? "—"}
                    </td>
                    <td className="py-2 text-right font-semibold">{p.qty}</td>
                    <td className="py-2 text-right font-bold text-primary">{fmtNumber(p.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

export function Analytics() {
  const db = useDB();
  const s = summarize(db, startOfDay(new Date(Date.now() - 29 * 86400000)), endOfDay());
  const series = revenueByDay(db, 14);
  const perf = waiterPerformance(db, startOfDay(new Date(Date.now() - 29 * 86400000)), endOfDay());

  const categoryData = s.categorySales
    .map((c) => ({ name: db.categories.find((x) => x.id === c.categoryId)?.nameRu ?? "—", value: c.revenue, qty: c.qty }))
    .filter((c) => c.value > 0);

  const tableUse = db.tables
    .map((t) => ({
      name: `№${t.number}`,
      orders: db.orders.filter((o) => o.tableId === t.id).length,
    }))
    .sort((a, b) => b.orders - a.orders)
    .slice(0, 12);

  return (
    <div className="space-y-5">
      <StaffPageTitle title="Analitika" subtitle="Oxirgi 30 kun · real savdo ma’lumotlari" />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="min-w-0 p-5 lg:col-span-2">
          <h2 className="font-display text-base font-bold">Savdo dinamikasi (14 kun)</h2>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series}>
                <CartesianGrid strokeDasharray="3 3" stroke="#232329" />
                <XAxis dataKey="label" stroke="#6b6b76" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#6b6b76" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} />
                <Tooltip contentStyle={{ background: "#141418", border: "1px solid #2a2a31", borderRadius: 12, color: "#fff" }} />
                <Legend />
                <Line type="monotone" dataKey="revenue" name="Savdo" stroke="#e11d2a" strokeWidth={2.5} />
                <Line type="monotone" dataKey="orders" name="Buyurtmalar" stroke="#4aa3ff" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="min-w-0 p-5">
          <h2 className="font-display text-base font-bold">Kategoriya ulushi</h2>
          <div className="mt-2 h-72">
            {categoryData.length === 0 ? (
              <p className="pt-24 text-center text-sm text-muted-foreground">Ma’lumot yo‘q</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={categoryData} dataKey="value" nameKey="name" innerRadius={52} outerRadius={90} paddingAngle={3}>
                    {categoryData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="transparent" />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "#141418", border: "1px solid #2a2a31", borderRadius: 12, color: "#fff" }} formatter={(v: number) => `${fmtNumber(v)} so‘m`} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {categoryData.slice(0, 6).map((c, i) => (
              <div key={c.name} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className="h-2 w-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                <span className="truncate">{c.name}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="min-w-0 p-5">
          <h2 className="font-display text-base font-bold">Ofitsantlar samaradorligi</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="pb-2">Ofitsant</th>
                  <th className="pb-2 text-right">Buyurtma</th>
                  <th className="pb-2 text-right">Savdo</th>
                  <th className="pb-2 text-right">Bekor</th>
                  <th className="pb-2 text-right">O‘rt. xizmat</th>
                </tr>
              </thead>
              <tbody>
                {perf.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-muted-foreground">Ma’lumot yo‘q</td>
                  </tr>
                )}
                {perf.map((w) => (
                  <tr key={w.staffId} className="border-t border-border">
                    <td className="py-2 font-medium">{w.name}</td>
                    <td className="py-2 text-right">{w.orders}</td>
                    <td className="py-2 text-right font-bold text-primary">{fmtNumber(w.revenue)}</td>
                    <td className="py-2 text-right text-muted-foreground">{w.cancelled}</td>
                    <td className="py-2 text-right text-muted-foreground">{w.avgServiceMinutes} daq</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="min-w-0 p-5">
          <h2 className="font-display text-base font-bold">Stollar yuklamasi</h2>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={tableUse} layout="vertical">
                <XAxis type="number" stroke="#6b6b76" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" stroke="#6b6b76" fontSize={12} tickLine={false} axisLine={false} width={44} />
                <Tooltip cursor={{ fill: "rgba(255,255,255,0.04)" }} contentStyle={{ background: "#141418", border: "1px solid #2a2a31", borderRadius: 12, color: "#fff" }} />
                <Bar dataKey="orders" fill="#e11d2a" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KPI label="Eng ko‘p sotilgan" value={s.topProduct?.name ?? "—"} sub={s.topProduct ? `${s.topProduct.qty} dona` : ""} />
        <KPI label="Eng kam sotilgan" value={s.worstProduct?.name ?? "—"} sub={s.worstProduct ? `${s.worstProduct.qty} dona` : ""} />
        <KPI
          label="Eng yaxshi kategoriya"
          value={db.categories.find((c) => c.id === s.topCategoryId)?.nameRu ?? "—"}
          sub={s.categorySales[0] ? `${fmtNumber(s.categorySales[0].revenue)} so‘m` : ""}
        />
        <KPI label="QR buyurtmalar" value={String(s.qrOrders)} sub={`${s.waiterOrders} ofitsant orqali`} />
      </div>
    </div>
  );
}

function KPI({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1.5 truncate font-display text-lg font-extrabold">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>}
    </Card>
  );
}

