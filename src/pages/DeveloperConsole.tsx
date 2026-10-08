import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Bell,
  Building2,
  Clock,
  Cog,
  Database,
  Download,
  Eye,
  Grid3x3,
  Heart,
  KeyRound,
  ListOrdered,
  Lock,
  LogOut,
  Package,
  Pencil,
  Percent,
  Plus,
  RefreshCw,
  ShieldCheck,
  Tags,
  Terminal,
  Trash2,
  Truck,
  Upload,
  User as UserIcon,
  Users,
} from "lucide-react";
import { Badge, Button, Card, Field, Input, Switch, Tabs, Textarea, useConfirm } from "@/components/ui/primitives";
import { useToast, type Toast } from "@/components/ui/toast";
import { Brand } from "@/components/Brand";
import { api, useBranches, useDB } from "@/lib/store";
import { forceLogout, listPresence, type PresenceEntry } from "@/lib/presence";
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
  | "branches"
  | "features"
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
  { value: "branches", label: "Filiallar" },
  { value: "features", label: "Bo‘limlar" },
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
  const { list: branches, activeId } = useBranches();
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
          {branches.length > 1 && (
            <span className="flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
              <Building2 className="h-3.5 w-3.5" />
              {branches.find((b) => b.id === activeId)?.name}
            </span>
          )}
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
        {tab === "branches" && <BranchesAdmin notify={toast} />}
        {tab === "features" && <FeaturesAdmin notify={toast} />}
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
// Bo‘limlar: developer-only section switches. A disabled section disappears
// from the customer menu, admin navigation and waiter UI for everyone else.
// ---------------------------------------------------------------------------
const SECTION_TOGGLES: { key: string; label: string; desc: string; icon: typeof Truck }[] = [
  {
    key: "delivery",
    label: "Yetkazib berish",
    desc: "Mijoz menyusidagi tezkor bo‘lim va checkoutdagi buyurtma turi",
    icon: Truck,
  },
  {
    key: "preorder",
    label: "Oldindan zakaz",
    desc: "Oldindan buyurtma bo‘limi va checkoutdagi buyurtma turi",
    icon: Clock,
  },
  {
    key: "promotions",
    label: "Aksiyalar",
    desc: "Promo qatlam, promokod, «Aksiyalar» kategoriyasi va admin sahifasi",
    icon: Percent,
  },
  {
    key: "favorites",
    label: "Sevimlilar",
    desc: "Sevimli taomlar bo‘limi, profil bloki va yurakcha tugmalari",
    icon: Heart,
  },
  {
    key: "waiterCall",
    label: "Ofitsant chaqirish",
    desc: "Mijoz tomonidan ofitsant/hisob chaqiruv tugmasi",
    icon: Bell,
  },
];

function FeaturesAdmin({ notify }: { notify: (t: Omit<Toast, "id">) => void }) {
  const db = useDB();
  const actor = api.devActor();
  const isEnabled = (k: string) => db.features?.[k] !== false;

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <h2 className="flex items-center gap-2 font-display text-base font-bold">
          <Eye className="h-4 w-4 text-primary" /> Bo‘limlarni o‘chirish / yoqish
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          O‘chirilgan bo‘lim boshqa HECH KIM ko‘rinmaydi — mijoz menyusi, admin panel va ofitsantda
          yo‘qoladi. Qayta yoqish faqat shu konsolda. Ta’sir barcha filiallarga bir xilda
          tarqaladi.
        </p>
        <div className="mt-4 space-y-1">
          {SECTION_TOGGLES.map((s) => (
            <div
              key={s.key}
              className="flex items-center gap-3 border-t border-border/60 py-3 first:border-t-0"
            >
              <div
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                  isEnabled(s.key) ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground"
                )}
              >
                <s.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">{s.label}</p>
                <p className="truncate text-xs text-muted-foreground">{s.desc}</p>
              </div>
              <Switch
                checked={isEnabled(s.key)}
                onChange={(v) => {
                  api.setFeatures({ [s.key]: v }, actor);
                  notify({
                    type: v ? "success" : "info",
                    title: `«${s.label}» ${v ? "yoqildi" : "o‘chirildi"}`,
                    body: v ? "Bo‘lim barcha panellarda ko‘rinadi" : "Bo‘lim faqat shu konsolda qoladi",
                  });
                }}
                label={s.label}
              />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Branches (filiallar): every branch owns a completely separate database —
// own tables + QR codes (numbering from 1), menu, orders and reports.
// ---------------------------------------------------------------------------
function BranchesAdmin({ notify }: { notify: (t: Omit<Toast, "id">) => void }) {
  const { list: branches, activeId } = useBranches();
  const { confirm, node } = useConfirm();
  const [name, setName] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const create = () => {
    const clean = name.trim();
    if (!clean) {
      notify({ type: "error", title: "Filial nomini kiriting" });
      return;
    }
    if (branches.some((b) => b.name.toLowerCase() === clean.toLowerCase())) {
      notify({ type: "error", title: "Bu nomli filial allaqachon bor" });
      return;
    }
    const meta = api.createBranch(clean);
    setName("");
    notify({
      type: "success",
      title: "Filial yaratildi",
      body: `${meta.name} — stollar va QR kodlar 1 dan boshlanadi`,
    });
  };

  return (
    <div className="space-y-5">
      {node}
      <Card className="p-5">
        <h2 className="flex items-center gap-2 font-display text-base font-bold">
          <Building2 className="h-4 w-4 text-primary" /> Yangi filial (oshxona)
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Har bir filial alohida bazada ishlaydi: o‘z stollari, QR kodlari (1 dan), menyu,
          buyurtmalari va hisobotlari. Xodimlar hisoblari esa bir xil — kirishda filial
          tanlanadi.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Filial nomi (masalan: Yunusobod filiali)"
            className="max-w-sm flex-1"
            onKeyDown={(e) => e.key === "Enter" && create()}
          />
          <Button onClick={create}>
            <Plus className="h-4 w-4" /> Filial qo‘shish
          </Button>
        </div>
      </Card>

      <div className="grid gap-3 lg:grid-cols-2">
        {branches.map((b) => {
          const stats = api.branchStats(b.id);
          const active = b.id === activeId;
          return (
            <Card key={b.id} className={cn("p-5", active && "border-primary/60")}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  {renaming === b.id ? (
                    <div className="flex gap-2">
                      <Input
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        className="h-9 w-44"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && renameValue.trim()) {
                            api.renameBranch(b.id, renameValue);
                            setRenaming(null);
                            notify({ type: "success", title: "Filial nomi yangilandi" });
                          }
                          if (e.key === "Escape") setRenaming(null);
                        }}
                      />
                      <Button
                        size="sm"
                        onClick={() => {
                          if (!renameValue.trim()) return;
                          api.renameBranch(b.id, renameValue);
                          setRenaming(null);
                          notify({ type: "success", title: "Filial nomi yangilandi" });
                        }}
                      >
                        Saqlash
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <h3 className="font-display text-base font-bold">{b.name}</h3>
                      {active && <Badge tone="primary">Joriy</Badge>}
                    </div>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(b.createdAt).toLocaleDateString("uz-UZ")} dan beri
                  </p>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>
                      <span className="font-semibold text-foreground">{stats.tables}</span> stol
                      (QR 1 dan)
                    </span>
                    <span>
                      <span className="font-semibold text-foreground">{stats.orders}</span> buyurtma
                    </span>
                    <span>
                      <span className="font-semibold text-foreground">{stats.products}</span> taom
                    </span>
                    <span>
                      <span className="font-semibold text-foreground">{stats.staff}</span> xodim
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {!active && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        if (!api.switchBranch(b.id)) {
                          notify({ type: "error", title: "Filialga o‘tib bo‘lmadi" });
                          return;
                        }
                        notify({ type: "info", title: `«${b.name}» filialiga o‘tildi` });
                      }}
                    >
                      Tanlash
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setRenaming(b.id);
                      setRenameValue(b.name);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={branches.length <= 1}
                    onClick={() =>
                      confirm(
                        "Filialni o‘chirish",
                        `«${b.name}» va barcha ma’lumotlari (stollar, QR, buyurtmalar) butunlay o‘chiriladi. Davom etilsinmi?`,
                        () => {
                          if (api.deleteBranch(b.id)) {
                            notify({ type: "info", title: `«${b.name}» o‘chirildi` });
                          } else {
                            notify({ type: "error", title: "Oxirgi filialni o‘chirib bo‘lmaydi" });
                          }
                        }
                      )
                    }
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* QR health check across all branches */}
      {(() => {
        const audit = api.qrAudit();
        const healthy = audit.globalDuplicates === 0 && audit.invalidFormat === 0;
        return (
          <Card className="p-5">
            <h2 className="flex items-center gap-2 font-display text-base font-bold">
              <Grid3x3 className="h-4 w-4 text-primary" /> QR nazorati
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Barcha filiallar stol QR kodlari tekshiriladi: takroriy tokenlar va format xatolari.
              "{healthy ? "Hammasi normal" : "Muammo topildi"}" 
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[440px] text-sm">
                <thead className="text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="pb-2">Filial</th>
                    <th className="pb-2 text-right">Stollar</th>
                    <th className="pb-2 text-right">Faol emas</th>
                    <th className="pb-2 text-right">Takroriy</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.branches.map((b) => (
                    <tr key={b.id} className="border-t border-border">
                      <td className="py-2 font-medium">{b.name}</td>
                      <td className="py-2 text-right">{b.tables}</td>
                      <td className="py-2 text-right text-muted-foreground">{b.inactive}</td>
                      <td className={cn("py-2 text-right", b.duplicate ? "font-bold text-destructive" : "text-muted-foreground")}>
                        {b.duplicate}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Global takroriy: <span className={cn("font-bold", audit.globalDuplicates ? "text-destructive" : "text-foreground")}>{audit.globalDuplicates}</span>
              {' · '}Format xato: <span className={cn("font-bold", audit.invalidFormat ? "text-destructive" : "text-foreground")}>{audit.invalidFormat}</span>
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  confirm(
                    "Joriy filial QRlarini yangilash",
                    "Barcha stollar uchun yangi xavfsiz QR tokenlar yaratiladi. Eski chop etilgan QR kodlar ishlamay qoladi. Davom etilsinmi?",
                    () => {
                      const n = api.regenerateAllQr([activeId], api.devActor());
                      notify({ type: "success", title: "QR yangilandi", body: `${n} ta token yaratildi` });
                    }
                  )
                }
              >
                <RefreshCw className="h-3.5 w-3.5" /> Joriy filial QRlarini yangilash
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  confirm(
                    "Barcha filiallar QRlarini yangilash",
                    "Barcha filiallardagi barcha stollar uchun yangi QR tokenlar yaratiladi. Eski chop etilgan QR kodlar ishlamay qoladi. Davom etilsinmi?",
                    () => {
                      const n = api.regenerateAllQr(undefined, api.devActor());
                      notify({ type: "success", title: "QR yangilandi", body: `${n} ta token yaratildi` });
                    }
                  )
                }
              >
                <RefreshCw className="h-3.5 w-3.5" /> Barcha filiallar QRlarini yangilash
              </Button>
            </div>
          </Card>
        );
      })()}
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
  const [fullDump, setFullDump] = useState("");
  const [online, setOnline] = useState<PresenceEntry[]>([]);
  const [creds, setCreds] = useState({ username: db.dev?.username ?? "dev", password: "" });

  // live presence of every open tab (admin / waiter / guest devices)
  useEffect(() => {
    const tick = () => setOnline(listPresence());
    tick();
    const t = setInterval(tick, 5_000);
    return () => clearInterval(t);
  }, []);

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

      {/* full backup of EVERY branch in one file */}
      <Card className="p-5">
        <h2 className="flex items-center gap-2 font-display text-base font-bold">
          <Database className="h-4 w-4 text-primary" /> To‘liq backup (barcha filiallar)
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Barcha filiallar bitta JSON faylda: stollar, QR kodlar, menyu, buyurtmalar, hisobotlar va
          xodimlar. Tiklash hozirgi ma‘lumotni butunlay almashtiradi.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              downloadBlob(
                `yumi-backup-${new Date().toISOString().slice(0, 10)}.json`,
                api.exportAllBranches(),
                "application/json"
              );
              notify({
                type: "success",
                title: "Backup yuklab olindi",
                body: `${api.listBranches().length} ta filial bitta faylda`,
              });
            }}
          >
            <Download className="h-4 w-4" /> Barcha filiallarni eksport qilish
          </Button>
          <Button
            variant="secondary"
            onClick={() => setFullDump(api.exportAllBranches())}
          >
            <RefreshCw className="h-4 w-4" /> Joriy nusxani ko‘rsatish
          </Button>
        </div>
        <Textarea
          className="mt-3 h-40 font-mono text-[11px]"
          value={fullDump}
          onChange={(e) => setFullDump(e.target.value)}
          placeholder="Backup JSON ni shu yerga qo‘ying va «Tiklash» bosing"
        />
        <Button
          className="mt-3"
          disabled={!fullDump.trim()}
          onClick={() =>
            confirm(
              "Barcha filiallarni tiklash",
              "Hozirgi BARCHA filiallar ma‘lumotlari backup fayli bilan almashtiriladi. Davom etilsinmi?",
              () => {
                const res = api.importAllBranches(fullDump);
                notify(
                  res.ok
                    ? { type: "success", title: "Backup tiklandi" }
                    : { type: "error", title: "Tiklash xatosi", body: res.error }
                );
                if (res.ok) setFullDump("");
              }
            )
          }
        >
          <Upload className="h-4 w-4" /> Tiklash (import)
        </Button>
      </Card>

      {/* who is online right now */}
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-display text-base font-bold">
            <Users className="h-4 w-4 text-primary" /> Onlayn xodimlar
          </h2>
          <Button size="sm" variant="ghost" onClick={() => setOnline(listPresence())}>
            <RefreshCw className="h-3.5 w-3.5" /> Yangilash
          </Button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Ochiq seanslar real vaqtda ko‘rinadi (20 soniyada bir yangilanadi). "Chiqarish" xodimni
          barcha qurilmalaridan tizimdan chiqaradi.
        </p>
        <div className="mt-3">
          {online.length === 0 ? (
            <p className="rounded-xl border border-border bg-secondary/40 px-3 py-4 text-center text-sm text-muted-foreground">
              Hozircha hech kim onlayn emas
            </p>
          ) : (
            online.map((e, i) => (
              <div
                key={e.at + "-" + i}
                className="flex items-center justify-between gap-3 border-t border-border/60 py-2.5 first:border-t-0"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {e.name}
                    <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                      · {e.role === "ADMIN" ? "Admin" : e.role === "WAITER" ? "Ofitsant" : "Mehmon"}
                    </span>
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {e.branchName} · {e.page} ·{" "}
                    {Math.max(0, Math.round((Date.now() - e.at) / 60000))} daqiqa oldin
                  </p>
                </div>
                {e.staffId && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() =>
                      confirm(
                        "Majburiy chiqarish",
                        `«${e.name}» barcha qurilmalaridan tizimdan chiqarilsinmi?`,
                        () => {
                          forceLogout(e.staffId!);
                          setOnline(listPresence());
                          notify({ type: "info", title: "Sessiya yakunlandi", body: e.name });
                        }
                      )
                    }
                  >
                    Chiqarish
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
      </Card>

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
