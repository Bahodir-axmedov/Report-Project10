import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Cog,
  Database,
  Download,
  Eye,
  Grid3x3,
  KeyRound,
  ListOrdered,
  Lock,
  LogOut,
  Package,
  Percent,
  RefreshCw,
  ShieldCheck,
  Tags,
  Terminal,
  Upload,
  User as UserIcon,
  Users,
} from "lucide-react";
import { Badge, Button, Card, Field, Input, Tabs, Textarea, useConfirm } from "@/components/ui/primitives";
import { useToast, type Toast } from "@/components/ui/toast";
import { Brand } from "@/components/Brand";
import { api, useDB } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { DEV_STAFF_USERNAME } from "@/lib/seed";
import { cn, downloadBlob, fmtDateTime, fmtNumber, uid } from "@/lib/utils";

import { ProductsAdmin, CategoriesAdmin } from "@/pages/admin/Catalog";
import OrdersBoard from "@/pages/admin/OrdersBoard";
import LiveMonitor from "@/pages/admin/LiveMonitor";
import { TablesAdmin } from "@/pages/admin/Tables";
import StaffAdmin from "@/pages/admin/StaffAdmin";
import Promotions from "@/pages/admin/Promotions";
import { Reports } from "@/pages/admin/Reports";
import { PaymentsPage, LogsPage, SettingsPage } from "@/pages/admin/Misc";

const UNLOCK_KEY = "yumi.dev.unlocked";

type TabKey =
  | "tools"
  | "products"
  | "categories"
  | "orders"
  | "live"
  | "tables"
  | "staff"
  | "promotions"
  | "reports"
  | "payments"
  | "logs"
  | "settings";

const TABS: { value: TabKey; label: string }[] = [
  { value: "tools", label: "Developer tools" },
  { value: "products", label: "Mahsulotlar" },
  { value: "categories", label: "Kategoriyalar" },
  { value: "orders", label: "Buyurtmalar" },
  { value: "live", label: "Jonli monitor" },
  { value: "tables", label: "Stollar" },
  { value: "staff", label: "Xodimlar" },
  { value: "promotions", label: "Aksiyalar" },
  { value: "reports", label: "Hisobotlar" },
  { value: "payments", label: "To‘lovlar" },
  { value: "logs", label: "Loglar" },
  { value: "settings", label: "Sozlamalar" },
];

export default function DeveloperConsole() {
  const db = useDB();
  const { loginAs, logout } = useAuth();
  const { toast } = useToast();
  const [unlocked, setUnlocked] = useState<boolean>(() => {
    try {
      return localStorage.getItem(UNLOCK_KEY) === "1" && !!api.devActor();
    } catch {
      return false;
    }
  });
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("tools");

  const unlock = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const actor = api.devLogin(username, password);
    if (!actor) {
      setError("Developer login yoki parol xato");
      return;
    }
    // give the console the developer identity so every tool below has full control
    loginAs(actor.id);
    try {
      localStorage.setItem(UNLOCK_KEY, "1");
    } catch {
      /* noop */
    }
    setUnlocked(true);
    setUsername("");
    setPassword("");
  };

  const lock = () => {
    try {
      localStorage.removeItem(UNLOCK_KEY);
    } catch {
      /* noop */
    }
    logout();
    setUnlocked(false);
  };

  if (!unlocked) {
    return (
      <div className="relative flex min-h-full items-center justify-center bg-[#06060a] px-4 py-12">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-1/2 top-[-10rem] h-[26rem] w-[26rem] -translate-x-1/2 rounded-full bg-primary/20 blur-[130px]" />
          <div className="absolute bottom-[-12rem] right-[-6rem] h-[24rem] w-[24rem] rounded-full bg-sky-500/10 blur-[130px]" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass relative z-10 w-full max-w-md rounded-3xl p-7"
        >
          <div className="flex items-center justify-between">
            <Brand size="sm" />
            <Badge tone="primary">
              <Terminal className="h-3 w-3" /> yumidev
            </Badge>
          </div>

          <div className="mt-6 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/15 text-primary">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-display text-xl font-extrabold">Developer kirish</h1>
              <p className="text-xs text-muted-foreground">Saytning to‘liq boshqaruvi</p>
            </div>
          </div>

          <form className="mt-6 space-y-4" onSubmit={unlock}>
            <Field label="Developer login">
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="dev"
                  autoCapitalize="none"
                  className="pl-9"
                  required
                />
              </div>
            </Field>
            <Field label="Parol">
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-9"
                  required
                />
              </div>
            </Field>
            {error && (
              <p className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" size="lg" className="w-full">
              <KeyRound className="h-4 w-4" /> Kirish
            </Button>
          </form>

          <p className="mt-5 rounded-xl border border-border bg-secondary/40 px-3 py-2.5 text-xs text-muted-foreground">
            Demo: <span className="font-semibold text-foreground">dev</span> ·{" "}
            <span className="font-semibold text-foreground">yumidev2026</span> — parolni konsol ichida
            o‘zgartirishingiz mumkin.
          </p>
          <Link to="/" className="mt-4 block text-center text-xs text-muted-foreground hover:text-foreground">
            ← Saytga qaytish
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-3 px-4 py-3">
          <span className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Terminal className="h-4 w-4" />
            </span>
            <span className="font-display text-base font-extrabold">Developer Console</span>
          </span>
          <Badge tone="primary">100% nazorat</Badge>
          <div className="flex-1" />
          <Link to="/admin" className="text-xs font-semibold text-muted-foreground hover:text-foreground">
            Admin panel →
          </Link>
          <Button size="sm" variant="outline" onClick={lock}>
            <LogOut className="h-3.5 w-3.5" /> Chiqish
          </Button>
        </div>
        <div className="mx-auto max-w-[1600px] px-4 pb-3">
          <Tabs value={tab} onChange={setTab} items={TABS} />
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-4 py-5">
        {tab === "tools" && <DevTools onLock={lock} notify={toast} onNavigate={setTab} />}
        {tab === "products" && <ProductsAdmin />}
        {tab === "categories" && <CategoriesAdmin />}
        {tab === "orders" && <OrdersBoard />}
        {tab === "live" && <LiveMonitor />}
        {tab === "tables" && <TablesAdmin />}
        {tab === "staff" && <StaffAdmin />}
        {tab === "promotions" && <Promotions />}
        {tab === "reports" && <Reports />}
        {tab === "payments" && <PaymentsPage />}
        {tab === "logs" && <LogsPage />}
        {tab === "settings" && <SettingsPage />}
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Developer tools: raw database control, import/export, wipe, credentials
// ---------------------------------------------------------------------------
function DevTools({
  onLock,
  notify,
  onNavigate,
}: {
  onLock: () => void;
  notify: (t: Omit<Toast, "id">) => void;
  onNavigate: (tab: TabKey) => void;
}) {
  const quickActions: { label: string; tab: TabKey; icon: typeof Package }[] = [
    { label: "Mahsulot qo‘shish", tab: "products", icon: Package },
    { label: "Kategoriya qo‘shish", tab: "categories", icon: Tags },
    { label: "Stol qo‘shish / QR", tab: "tables", icon: Grid3x3 },
    { label: "Xodim qo‘shish", tab: "staff", icon: Users },
    { label: "Aksiya / chegirma", tab: "promotions", icon: Percent },
    { label: "Foyda hisoboti", tab: "reports", icon: Cog },
  ];
  const db = useDB();
  const { confirm, node } = useConfirm();
  const [dump, setDump] = useState("");
  const [creds, setCreds] = useState({ username: db.dev?.username ?? "dev", password: "" });

  // The client's own administrator account (never the hidden developer one).
  const ownerAccount = db.staff.find((s) => s.role === "ADMIN" && s.username !== DEV_STAFF_USERNAME);
  const [owner, setOwner] = useState({
    name: ownerAccount?.name ?? "Restoran egasi",
    username: ownerAccount?.username ?? "admin",
    password: "",
  });

  const sizeKb = useMemo(() => {
    try {
      return Math.round(JSON.stringify(db).length / 1024);
    } catch {
      return 0;
    }
  }, [db]);

  const stats = [
    { label: "Mahsulotlar", value: db.products.length, icon: Package },
    { label: "Kategoriyalar", value: db.categories.length, icon: Tags },
    { label: "Buyurtmalar", value: db.orders.length, icon: ListOrdered },
    { label: "Xodimlar", value: db.staff.length, icon: Users },
    { label: "Stollar", value: db.tables.length, icon: Grid3x3 },
    { label: "Aktiv sessiyalar", value: db.sessions.filter((s) => s.active).length, icon: Eye },
    { label: "To‘lovlar", value: db.payments.length, icon: Percent },
    { label: "Loglar", value: db.logs.length, icon: Cog },
  ];

  const wipe = (scope: "orders" | "sessions" | "logs" | "products" | "staff" | "all") =>
    confirm(
      scope === "all" ? "Zavod holatiga qaytarish" : `${scope} tozalash`,
      scope === "all"
        ? "Barcha ma’lumot o‘chib, demo seed qayta yuklanadi. Davom etilsinmi?"
        : `«${scope}» bo‘limidagi barcha yozuvlar o‘chiriladi. Davom etilsinmi?`,
      () => {
        api.devWipe(scope);
        notify({ type: "success", title: "Bajarildi" });
      }
    );

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <h2 className="font-display text-base font-bold">Tezkor amallar</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Saytning istalgan bo‘limi shu yerdan boshqariladi — to‘liq nazorat.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {quickActions.map((a) => (
            <Button key={a.label} variant="secondary" onClick={() => onNavigate(a.tab)}>
              <a.icon className="h-4 w-4" /> {a.label}
            </Button>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">{s.label}</span>
              <s.icon className="h-4 w-4 text-primary" />
            </div>
            <p className="mt-2 font-display text-lg font-extrabold">{fmtNumber(s.value)}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* export / import */}
        <Card className="p-5">
          <h2 className="flex items-center gap-2 font-display text-base font-bold">
            <Database className="h-4 w-4 text-primary" /> Baza (JSON)
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Joriy hajm: {fmtNumber(sizeKb)} KB · versiya {db.version} · oxirgi log:{" "}
            {db.logs[0] ? fmtDateTime(db.logs[0].at) : "—"}
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                downloadBlob(`yumi-db-${Date.now()}.json`, JSON.stringify(api.exportDB(), null, 2), "application/json");
                notify({ type: "success", title: "Eksport qilindi" });
              }}
            >
              <Download className="h-4 w-4" /> Export JSON
            </Button>
            <Button
              variant="secondary"
              onClick={() => setDump(JSON.stringify(api.exportDB(), null, 2))}
            >
              <Upload className="h-4 w-4" /> Bazani yuklash (tahrirlash uchun)
            </Button>
          </div>

          <Textarea
            className="mt-3 h-52 font-mono text-[11px]"
            value={dump}
            onChange={(e) => setDump(e.target.value)}
            placeholder="JSON ni shu yerga qo‘ying va «Import» bosing"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              onClick={() => {
                const res = api.importDB(dump);
                notify(
                  res.ok
                    ? { type: "success", title: "Import muvaffaqiyatli" }
                    : { type: "error", title: "Import xatosi", body: res.error }
                );
              }}
            >
              Import qilish
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setDump(JSON.stringify(api.exportDB(), null, 2));
              }}
            >
              <RefreshCw className="h-4 w-4" /> Yangilash
            </Button>
          </div>
        </Card>

        <div className="space-y-4">
          {/* developer credentials */}
          <Card className="p-5">
            <h2 className="flex items-center gap-2 font-display text-base font-bold">
              <KeyRound className="h-4 w-4 text-primary" /> Developer login / parol
            </h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="Login">
                <Input
                  value={creds.username}
                  onChange={(e) => setCreds({ ...creds, username: e.target.value })}
                  autoCapitalize="none"
                />
              </Field>
              <Field label="Yangi parol">
                <Input
                  value={creds.password}
                  onChange={(e) => setCreds({ ...creds, password: e.target.value })}
                  placeholder="bo‘sh qoldirsangiz o‘zgarmaydi"
                />
              </Field>
            </div>
            <Button
              className="mt-3"
              onClick={() => {
                if (!creds.username.trim()) {
                  notify({ type: "error", title: "Login bo‘sh bo‘lmasligi kerak" });
                  return;
                }
                api.setDevCredentials({
                  username: creds.username.trim(),
                  ...(creds.password ? { password: creds.password } : {}),
                });
                setCreds({ ...creds, password: "" });
                notify({ type: "success", title: "Developer ma’lumotlari yangilandi" });
              }}
            >
              Saqlash
            </Button>
          </Card>

          {/* danger zone */}
          <Card className="border-destructive/40 p-5">
            <h2 className="flex items-center gap-2 font-display text-base font-bold text-destructive">
              <AlertTriangle className="h-4 w-4" /> Xavfli amallar
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Bu amallar qaytarilmaydi. Faqat developer konsolidan bajariladi.
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <Button variant="outline" onClick={() => wipe("orders")}>
                Buyurtmalarni o‘chirish
              </Button>
              <Button variant="outline" onClick={() => wipe("sessions")}>
                Sessiyalarni tozalash
              </Button>
              <Button variant="outline" onClick={() => wipe("logs")}>
                Loglarni tozalash
              </Button>
              <Button variant="outline" onClick={() => wipe("products")}>
                Mahsulotlarni o‘chirish
              </Button>
              <Button variant="outline" onClick={() => wipe("staff")}>
                Xodimlarni o‘chirish
              </Button>
              <Button
                variant="destructive"
                className={cn("sm:col-span-2")}
                onClick={() => wipe("all")}
              >
                Zavod holatiga qaytarish (demo seed)
              </Button>
            </div>
          </Card>

          {/* handover: the client keeps their own clean admin access */}
          <Card className="p-5">
            <h2 className="flex items-center gap-2 font-display text-base font-bold">
              <ShieldCheck className="h-4 w-4 text-primary" /> Topshirish (mijoz admini)
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Mijoz o‘z administrator hisobiga shu yerdan ega bo‘ladi. Developer kaliti
              ({db.dev?.username}) bundan mustaqil qoladi — factory reset ham uni o‘chirmaydi.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <Field label="Egasi ismi">
                <Input value={owner.name} onChange={(e) => setOwner({ ...owner, name: e.target.value })} />
              </Field>
              <Field label="Admin login">
                <Input
                  value={owner.username}
                  onChange={(e) => setOwner({ ...owner, username: e.target.value })}
                  autoCapitalize="none"
                />
              </Field>
              <Field label="Yangi parol">
                <Input
                  value={owner.password}
                  onChange={(e) => setOwner({ ...owner, password: e.target.value })}
                  placeholder="bo‘sh qoldirsangiz o‘zgarmaydi"
                />
              </Field>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                onClick={() => {
                  const actor = api.devActor();
                  if (!actor) {
                    notify({ type: "error", title: "Developer sessiyasi topilmadi" });
                    return;
                  }
                  if (!owner.name.trim() || !owner.username.trim()) {
                    notify({ type: "error", title: "Ism va loginni kiriting" });
                    return;
                  }
                  const password = owner.password || ownerAccount?.password || "";
                  if (password.length < 5) {
                    notify({ type: "error", title: "Parol kamida 5 belgi bo‘lsin" });
                    return;
                  }
                  api.saveStaff(
                    {
                      id: ownerAccount?.id ?? uid("stf"),
                      name: owner.name.trim(),
                      phone: ownerAccount?.phone ?? "—",
                      username: owner.username.trim(),
                      password,
                      role: "ADMIN",
                      active: true,
                      permissions: ownerAccount?.permissions ?? [],
                      createdAt: ownerAccount?.createdAt ?? Date.now(),
                    },
                    actor
                  );
                  setOwner({ ...owner, password: "" });
                  notify({ type: "success", title: "Mijoz admini saqlandi" });
                }}
              >
                Saqlash
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  const text = `YÜMI boshqaruv paneli\nManzil: ${window.location.origin}/admin\nLogin: ${owner.username}\nParol: ${
                    owner.password || "(o‘zingiz kiritgan parol)"
                  }`;
                  navigator.clipboard?.writeText(text);
                  notify({ type: "info", title: "Ma’lumot nusxalandi", body: "Mijozga yuborishingiz mumkin" });
                }}
              >
                Kirish ma’lumotini nusxalash
              </Button>
            </div>
            <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
              <span className="rounded-xl border border-border bg-secondary/40 px-3 py-2">
                Admin panel: <span className="font-semibold text-foreground">/admin</span>
              </span>
              <span className="rounded-xl border border-border bg-secondary/40 px-3 py-2">
                Ofitsant paneli: <span className="font-semibold text-foreground">/waiter</span>
              </span>
              <span className="rounded-xl border border-border bg-secondary/40 px-3 py-2">
                Sizning kalit: <span className="font-semibold text-foreground">/yumidev</span>
              </span>
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="font-display text-base font-bold">Sessiya</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Developer konsol qulfini yopadi va xodim sessiyasini tugatadi.
            </p>
            <Button variant="secondary" className="mt-3" onClick={onLock}>
              <LogOut className="h-4 w-4" /> Konsolni qulflash
            </Button>
          </Card>
        </div>
      </div>

      {node}
    </div>
  );
}
