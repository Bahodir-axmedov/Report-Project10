import { useState } from "react";
import { NavLink, Outlet, Link } from "react-router-dom";
import {
  Activity,
  BarChart3,
  Bell,
  ChefHat,
  CreditCard,
  Grid3x3,
  LayoutDashboard,
  ListOrdered,
  LogIn,
  Menu,
  Package,
  QrCode,
  Percent,
  Settings,
  Tags,
  Users,
  Utensils,
  X,
} from "lucide-react";
import { Brand } from "@/components/Brand";
import { StaffHeader } from "@/components/staff/StaffHeader";
import { useAuth } from "@/lib/auth";
import { useDB } from "@/lib/store";
import { hasPermission } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import type { PermissionKey } from "@/lib/types";

const NAV: { to: string; label: string; icon: typeof LayoutDashboard; perm?: PermissionKey; end?: boolean }[] = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, perm: "dashboard.view", end: true },
  { to: "/admin/live", label: "Jonli monitor", icon: Activity, perm: "tables.view" },
  { to: "/admin/orders", label: "Buyurtmalar", icon: ListOrdered, perm: "orders.view" },
  { to: "/admin/tables", label: "Stollar", icon: Grid3x3, perm: "tables.view" },
  { to: "/admin/kitchen", label: "Oshxona", icon: ChefHat, perm: "kitchen.view" },
  { to: "/admin/calls", label: "Chaqiruvlar", icon: Bell, perm: "calls.view" },
  { to: "/admin/products", label: "Mahsulotlar", icon: Package, perm: "products.view" },
  { to: "/admin/categories", label: "Kategoriyalar", icon: Tags, perm: "categories.manage" },
  { to: "/admin/customers", label: "Mijozlar", icon: Utensils, perm: "orders.view" },
  { to: "/admin/payments", label: "To‘lovlar", icon: CreditCard, perm: "payments.view" },
  { to: "/admin/staff", label: "Xodimlar", icon: Users, perm: "staff.view" },
  { to: "/admin/promotions", label: "Aksiyalar", icon: Percent, perm: "promotions.manage" },
  { to: "/admin/reports", label: "Hisobotlar", icon: BarChart3, perm: "reports.view" },
  { to: "/admin/analytics", label: "Analitika", icon: Activity, perm: "analytics.view" },
  { to: "/admin/qr", label: "QR kodlar", icon: QrCode, perm: "qr.manage" },
  { to: "/admin/settings", label: "Sozlamalar", icon: Settings, perm: "settings.manage" },
  { to: "/admin/logs", label: "Activity loglar", icon: LogIn, perm: "logs.view" },
];

export default function AdminLayout() {
  const { staff } = useAuth();
  const db = useDB();
  const [mobileOpen, setMobileOpen] = useState(false);

  const pendingCalls = db.calls.filter((c) => c.status === "PENDING").length;
  const items = NAV.filter((n) => !n.perm || hasPermission(staff?.permissions, n.perm));

  return (
    <div className="min-h-full bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 border-r border-border bg-card/80 backdrop-blur-xl transition-transform lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-border px-4">
          <Link to="/" className="flex items-center">
            <Brand size="sm" />
          </Link>
          <button onClick={() => setMobileOpen(false)} className="rounded-lg p-2 text-muted-foreground lg:hidden" aria-label="Yopish">
            <X className="h-4 w-4" />
          </button>
        </div>
        <nav className="h-[calc(100%-4rem)] space-y-0.5 overflow-y-auto p-3">
          {items.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                  isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                )
              }
            >
              <n.icon className="h-[18px] w-[18px] shrink-0" />
              <span className="flex-1">{n.label}</span>
              {n.label === "Chaqiruvlar" && pendingCalls > 0 && (
                <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                  {pendingCalls}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
      </aside>

      {mobileOpen && <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setMobileOpen(false)} />}

      <div className="lg:pl-64">
        <StaffHeader
          title="Administrator"
          audience="admin"
          accent={
            <button
              onClick={() => setMobileOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-secondary/60 lg:hidden"
              aria-label="Menu"
            >
              <Menu className="h-4 w-4" />
            </button>
          }
        />
        <main className="mx-auto max-w-[1600px] px-4 py-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
