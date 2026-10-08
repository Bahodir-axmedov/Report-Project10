import { Link } from "react-router-dom";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowUpRight,
  Bell,
  ChefHat,
  CircleDollarSign,
  Grid3x3,
  ListOrdered,
  Percent,
  Wallet,
  TrendingUp,
  Utensils,
  XCircle,
} from "lucide-react";
import { Card } from "@/components/ui/primitives";
import { StaffPageTitle } from "@/components/staff/StaffHeader";
import { useDB } from "@/lib/store";
import { ordersByHour, profitByDay, profitIn, revenueByDay, summarize } from "@/lib/reporting";
import { endOfDay, fmtNumber, startOfDay } from "@/lib/utils";

const COLORS = ["#e11d2a", "#ff6b3d", "#f5a524", "#3ddc97", "#4aa3ff", "#a855f7", "#f472b6", "#8b8f9a"];

export default function Dashboard() {
  const db = useDB();
  const today = summarize(db, startOfDay(), endOfDay());
  const week = summarize(db, startOfDay(new Date(Date.now() - 6 * 86400000)), endOfDay());
  const revenueSeries = revenueByDay(db, 7);
  const hourly = ordersByHour(db, startOfDay(), endOfDay());

  // ---- profit: today / this week / this month + last 7 days trend ----
  const monthStart = (() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  })();
  const dayProfit = profitIn(db, startOfDay(), endOfDay());
  const weekProfit = profitIn(db, startOfDay(new Date(Date.now() - 6 * 86400000)), endOfDay());
  const monthProfit = profitIn(db, monthStart, endOfDay());
  const profitSeries = profitByDay(db, 7);

  const categorySeries = today.categorySales
    .map((c) => ({
      name: db.categories.find((x) => x.id === c.categoryId)?.nameRu ?? "—",
      value: c.revenue,
    }))
    .filter((c) => c.value > 0)
    .slice(0, 6);

  const activeTables = db.tables.filter((t) => t.status !== "EMPTY").length;
  const pendingCalls = db.calls.filter((c) => c.status === "PENDING").length;

  const kpis = [
    { label: "Bugungi savdo", value: `${fmtNumber(today.revenue)} so‘m`, sub: `Hafta: ${fmtNumber(week.revenue)}`, icon: CircleDollarSign, tone: "primary" },
    { label: "Buyurtmalar", value: String(today.orders), sub: `${today.completed} yakunlangan`, icon: ListOrdered },
    { label: "Zalda", value: `${fmtNumber(today.dineInRevenue)}`, sub: `${today.qrOrders} QR buyurtma`, icon: Utensils },
    { label: "Yetkazib berish", value: `${fmtNumber(today.deliveryRevenue)}`, sub: `${today.deliveryOrders} buyurtma`, icon: TrendingUp },
    { label: "Aktiv stollar", value: `${activeTables} / ${db.tables.length}`, sub: `${today.active} aktiv buyurtma`, icon: Grid3x3 },
    { label: "Ofitsant chaqiruvlari", value: String(pendingCalls), sub: `${db.calls.length} jami`, icon: Bell, tone: pendingCalls ? "primary" : undefined },
    { label: "Tayyorlanmoqda", value: String(today.preparing), sub: `${today.waiting} kutilmoqda`, icon: ChefHat },
    { label: "Bekor qilingan", value: String(today.cancelled), sub: `O‘rtacha chek: ${fmtNumber(today.avgOrder)}`, icon: XCircle },
  ];

  return (
    <div className="space-y-6">
      <StaffPageTitle
        title="Dashboard"
        subtitle="Bugungi restoran ko‘rsatkichlari real ma’lumotlardan hisoblanadi"
        action={
          <Link to="/admin/reports" className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-secondary/60 px-3.5 py-2 text-sm font-semibold transition hover:bg-white/10">
            Hisobotlar <ArrowUpRight className="h-4 w-4" />
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label} className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">{k.label}</span>
              <k.icon className={`h-4 w-4 ${k.tone === "primary" ? "text-primary" : "text-muted-foreground"}`} />
            </div>
            <p className="mt-2 font-display text-lg font-extrabold leading-tight sm:text-xl">{k.value}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{k.sub}</p>
          </Card>
        ))}
      </div>

      {/* ---------------- profit ---------------- */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Kunlik foyda", p: dayProfit, icon: CircleDollarSign },
          { label: "Haftalik foyda", p: weekProfit, icon: TrendingUp },
          { label: "Oylik foyda", p: monthProfit, icon: Wallet },
        ].map(({ label, p, icon: Icon }) => (
          <Card key={label} className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">{label}</span>
              <Icon className="h-4 w-4 text-primary" />
            </div>
            <p className={`mt-2 font-display text-lg font-extrabold leading-tight sm:text-xl ${p.profit >= 0 ? "text-[hsl(var(--success))]" : "text-destructive"}`}>
              {fmtNumber(p.profit)} so‘m
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Savdo {fmtNumber(p.revenue)} · Tannarx {fmtNumber(p.cost)}
            </p>
          </Card>
        ))}
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Foyda marjasi (bugun)</span>
            <Percent className="h-4 w-4 text-primary" />
          </div>
          <p className="mt-2 font-display text-lg font-extrabold leading-tight sm:text-xl">{dayProfit.marginPct}%</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {dayProfit.productsSold} dona mahsulot · o‘rtacha foyda {fmtNumber(dayProfit.avgProfit)}
          </p>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-bold">Foyda va savdo (7 kun)</h2>
            <span className="text-xs text-muted-foreground">so‘m</span>
          </div>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={profitSeries}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#e11d2a" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#e11d2a" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="label" stroke="#6b6b76" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#6b6b76" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} />
                <Tooltip
                  contentStyle={{ background: "#141418", border: "1px solid #2a2a31", borderRadius: 12, color: "#fff" }}
                  formatter={(v: number, name: string) => [
                    `${fmtNumber(v)} so‘m`,
                    name === "profit" ? "Foyda" : name === "cost" ? "Tannarx" : "Savdo",
                  ]}
                />
                <Area type="monotone" dataKey="revenue" stroke="#6b6b76" strokeWidth={1.5} fill="none" strokeDasharray="4 4" />
                <Area type="monotone" dataKey="profit" stroke="#e11d2a" strokeWidth={2.5} fill="url(#rev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="font-display text-base font-bold">Kategoriyalar bo‘yicha</h2>
          <div className="mt-2 h-64">
            {categorySeries.length === 0 ? (
              <p className="pt-20 text-center text-sm text-muted-foreground">Ma’lumot yo‘q</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={categorySeries} dataKey="value" nameKey="name" innerRadius={48} outerRadius={80} paddingAngle={3}>
                    {categorySeries.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="transparent" />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "#141418", border: "1px solid #2a2a31", borderRadius: 12, color: "#fff" }}
                    formatter={(v: number) => `${fmtNumber(v)} so‘m`}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            {categorySeries.map((c, i) => (
              <div key={c.name} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className="h-2 w-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                <span className="truncate">{c.name}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="font-display text-base font-bold">Soatlar bo‘yicha buyurtmalar</h2>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourly}>
                <XAxis dataKey="hour" stroke="#6b6b76" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#6b6b76" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  cursor={{ fill: "rgba(255,255,255,0.04)" }}
                  contentStyle={{ background: "#141418", border: "1px solid #2a2a31", borderRadius: 12, color: "#fff" }}
                />
                <Bar dataKey="orders" fill="#e11d2a" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="font-display text-base font-bold">Eng ko‘p sotilgan taomlar</h2>
          <div className="mt-4 space-y-2.5">
            {today.productSales.slice(0, 6).map((p, i) => (
              <div key={p.productId} className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-secondary text-xs font-bold">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate text-sm">{p.name}</span>
                <span className="text-xs text-muted-foreground">{p.qty} dona</span>
                <span className="text-sm font-semibold">{fmtNumber(p.revenue)}</span>
              </div>
            ))}
            {today.productSales.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Ma’lumot yo‘q</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}
