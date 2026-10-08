import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Building2,
  LayoutDashboard,
  Lock,
  ShieldCheck,
  User as UserIcon,
  Utensils,
} from "lucide-react";
import { Brand } from "@/components/Brand";
import { Button, Field, Input } from "@/components/ui/primitives";
import { useAuth } from "@/lib/auth";
import { useBranches } from "@/lib/store";
import type { Role } from "@/lib/types";
import { cn } from "@/lib/utils";

interface RoleOption {
  key: string;
  label: string;
  desc: string;
  roles: Role[];
  home: string;
  icon: typeof Utensils;
  demo: string;
}

/** The system has exactly two roles — administrator and waiter. */
const ROLE_OPTIONS: RoleOption[] = [
  {
    key: "admin",
    label: "Administrator",
    desc: "To‘liq boshqaruv: statistika, foyda, menyu, xodimlar",
    roles: ["ADMIN"],
    home: "/admin",
    icon: LayoutDashboard,
    demo: "admin · admin123",
  },
  {
    key: "waiter",
    label: "Ofitsant",
    desc: "Stollar, chaqiruvlar, buyurtmalar, hisob",
    roles: ["WAITER"],
    home: "/waiter",
    icon: Utensils,
    demo: "aziz · waiter123",
  },
];

export default function AuthPage() {
  const { login } = useAuth();
  const { list: branches, activeId } = useBranches();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const returnTo = params.get("returnTo");

  const [selected, setSelected] = useState<RoleOption | null>(null);
  const [branchId, setBranchId] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Several kitchens → pick the branch BEFORE signing in; a single branch
  // skips the step entirely.
  const needBranchStep = !!selected && branches.length > 1 && !branchId;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setError(null);
    setLoading(true);
    const res = login(username, password, selected.roles, branchId ?? undefined);
    setLoading(false);
    if (!res.ok) {
      setError(res.error ?? "Xatolik");
      return;
    }
    const target = returnTo && returnTo !== "/auth" ? returnTo : selected.home;
    navigate(target, { replace: true });
  };

  const pick = (r: RoleOption) => {
    setSelected(r);
    setBranchId(null);
    setError(null);
    setUsername("");
    setPassword("");
  };

  return (
    <div className="relative flex min-h-full flex-col bg-background">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 top-[-8rem] h-[28rem] w-[28rem] rounded-full bg-primary/20 blur-[130px]" />
        <div className="absolute bottom-[-10rem] right-[-8rem] h-[26rem] w-[26rem] rounded-full bg-primary/10 blur-[130px]" />
      </div>

      <header className="relative z-10 mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-5">
        <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Bosh sahifa
        </Link>
        <Brand size="sm" />
      </header>

      <main className="relative z-10 mx-auto w-full max-w-5xl flex-1 px-4 pb-16">
        {!selected ? (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-3xl">
            <div className="text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                <ShieldCheck className="h-7 w-7" />
              </div>
              <h1 className="mt-4 font-display text-2xl font-extrabold sm:text-3xl">Xodimlar kabineti</h1>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                Avval rolni tanlang, so‘ng login va parolni kiriting. Tizimda faqat ikki rol bor —
                <span className="font-semibold text-foreground"> Administrator</span> va
                <span className="font-semibold text-foreground"> Ofitsant</span>. Ro‘yxatdan o‘tish
                yo‘q — ofitsant hisobini administrator yaratadi.
              </p>
            </div>

            <div className="mx-auto mt-8 grid max-w-2xl gap-3 sm:grid-cols-2">
              {ROLE_OPTIONS.map((r, i) => (
                <motion.button
                  key={r.key}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  onClick={() => pick(r)}
                  className="group flex items-center gap-4 rounded-2xl border border-border bg-card/60 p-4 text-left transition hover:border-primary/50 hover:bg-primary/5"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                    <r.icon className="h-6 w-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-base font-bold">{r.label}</p>
                    <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{r.desc}</p>
                  </div>
                </motion.button>
              ))}
            </div>

            <p className="mt-8 text-center text-xs text-muted-foreground">
              Mijozlar tizimga kirmaydi — stol QR kodini skanerlab buyurtma beradi.
            </p>
          </motion.div>
        ) : needBranchStep ? (
          <motion.div
            key="branch-step"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-auto max-w-3xl"
          >
            <div className="text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                <Building2 className="h-7 w-7" />
              </div>
              <h1 className="mt-4 font-display text-2xl font-extrabold sm:text-3xl">Filialni tanlang</h1>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                «{selected.label}» hisobi bilan qaysi oshxonada ishlashni tanlang. Filiallar ma’lumoti
                bir-biridan mustaqil — stollar, QR kodlar va buyurtmalar arashmaydi.
              </p>
            </div>

            <div className="mx-auto mt-8 grid max-w-2xl gap-3 sm:grid-cols-2">
              {branches.map((b, i) => (
                <motion.button
                  key={b.id}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  onClick={() => {
                    setBranchId(b.id);
                    setError(null);
                    setUsername("");
                    setPassword("");
                  }}
                  className={cn(
                    "group flex items-center gap-4 rounded-2xl border border-border bg-card/60 p-4 text-left transition hover:border-primary/50 hover:bg-primary/5",
                    b.id === activeId && "border-primary/50 bg-primary/5"
                  )}
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                    <Building2 className="h-6 w-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-base font-bold">{b.name}</p>
                    <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                      {new Date(b.createdAt).toLocaleDateString("uz-UZ")} dan beri
                    </p>
                  </div>
                </motion.button>
              ))}
            </div>

            <button
              onClick={() => setSelected(null)}
              className="mx-auto mt-8 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Rolni o‘zgartirish
            </button>
          </motion.div>
        ) : (
          <motion.div
            key={selected.key + (branchId ?? "")}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-auto max-w-md"
          >
            <div className="glass rounded-3xl p-6 sm:p-8">
              <button
                onClick={() => (branches.length > 1 ? setBranchId(null) : setSelected(null))}
                className="mb-5 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition hover:text-foreground"
              >
                <ArrowLeft className="h-3.5 w-3.5" />{" "}
                {branches.length > 1 ? "Filialni o‘zgartirish" : "Rolni o‘zgartirish"}
              </button>

              <div className="flex items-center gap-3">
                <div className={cn("flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/15 text-primary")}>
                  <selected.icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Tanlangan rol</p>
                  <p className="font-display text-lg font-bold">{selected.label}</p>
                  {branches.length > 1 && (
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-primary">
                      <Building2 className="h-3.5 w-3.5" />
                      {branches.find((b) => b.id === (branchId ?? activeId))?.name}
                    </p>
                  )}
                </div>
              </div>

              <form className="mt-6 space-y-4" onSubmit={submit}>
                <Field label="Login">
                  <div className="relative">
                    <UserIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="login"
                      autoCapitalize="none"
                      autoComplete="username"
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
                      autoComplete="current-password"
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
                <Button type="submit" size="lg" className="w-full" loading={loading}>
                  Kirish
                </Button>
              </form>

              <p className="mt-5 rounded-xl border border-border bg-secondary/40 px-3 py-2.5 text-xs text-muted-foreground">
                Demo hisob: <span className="font-semibold text-foreground">{selected.demo}</span>
              </p>
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}
