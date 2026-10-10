import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Delete, QrCode, ScanLine } from "lucide-react";
import { Brand } from "@/components/Brand";
import { Button } from "@/components/ui/primitives";
import { useCustomer } from "@/lib/customer";
import { useI18n } from "@/lib/i18n";
import { useDB } from "@/lib/store";

type View = "checking" | "error" | "keypad";

/**
 * Table entry (mockup screen 2): a big numeric keypad with "Davom etish".
 * A real QR token still enters the session immediately on mount — the keypad
 * is the manual fallback for broken QR codes and /t/demo.
 */
export default function TableEntry() {
  const { token } = useParams();
  const db = useDB();
  const { enterWithToken, table: existing } = useCustomer();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const returnTo = params.get("returnTo") || "/menu";

  const tables = useMemo(
    () => db.tables.filter((x) => x.active).sort((a, b) => a.number - b.number),
    [db.tables]
  );
  const isDemo = !token || token === "demo";

  const [view, setView] = useState<View>(isDemo ? "keypad" : "checking");
  const [error, setError] = useState<string | null>(null);
  const [digits, setDigits] = useState("");
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const enterToken = (tk: string) => {
    const res = enterWithToken(tk);
    if (!res.ok) {
      setError(res.error ?? "Xatolik");
      setView("error");
      return;
    }
    navigate(returnTo, { replace: true });
  };

  // Real QR token: enter on mount, no extra taps.
  useEffect(() => {
    if (isDemo || !token) return;
    setError(null);
    setView("checking");
    enterToken(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const press = (d: string) => {
    setError(null);
    setDigits((prev) => (prev.length >= 3 ? prev : prev + d));
  };
  const backspace = () => setDigits((prev) => prev.slice(0, -1));

  const submit = () => {
    const n = Number(digits);
    if (!digits || !Number.isFinite(n)) return;
    const tbl = db.tables.find((x) => x.number === n && x.active);
    if (!tbl) {
      setError(`Stol №${n} mavjud emas`);
      timers.current.push(setTimeout(() => setDigits(""), 1200));
      return;
    }
    enterToken(tbl.qrToken);
  };

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

  return (
    <div className="relative min-h-full overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 top-[-8rem] h-[28rem] w-[28rem] rounded-full bg-primary/20 blur-[130px]" />
      </div>

      <header className="relative z-10 mx-auto flex w-full max-w-md items-center justify-center px-4 py-6">
        <Brand size="lg" />
      </header>

      <main className="relative z-10 mx-auto w-full max-w-md px-4 pb-16">
        <AnimatePresence mode="wait">
          {view === "checking" && (
            <motion.div
              key="checking"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              className="glass rounded-3xl p-6 text-center"
            >
              <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-3xl bg-primary/15 text-primary">
                <ScanLine className="h-11 w-11 animate-pulse" />
              </div>
              <h1 className="mt-5 font-display text-xl font-extrabold">Stol aniqlanmoqda…</h1>
              <p className="mt-2 text-sm text-muted-foreground">Menyu ochilmoqda</p>
            </motion.div>
          )}

          {view === "error" && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              className="glass rounded-3xl p-6 text-center"
            >
              <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-3xl bg-primary/15 text-primary">
                <QrCode className="h-11 w-11" />
              </div>
              <h1 className="mt-5 font-display text-xl font-extrabold">QR kod xatosi</h1>
              <p className="mt-2 text-sm text-muted-foreground">{error}</p>
              <Button size="lg" className="mt-6 w-full" onClick={() => { setError(null); setDigits(""); setView("keypad"); }}>
                Stol raqamini qo‘lda kiriting
              </Button>
            </motion.div>
          )}

          {view === "keypad" && (
            <motion.div
              key="keypad"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
            >
              <h1 className="text-center font-display text-2xl font-extrabold">Stol raqamini kiriting</h1>
              <p className="mt-2 text-center text-sm text-muted-foreground">
                Raqamni kiriting yoki QR kodni skanerlang
              </p>

              <div className="mt-6 flex min-h-[72px] items-center justify-center gap-2.5">
                <span
                  className={
                    "font-display text-5xl font-extrabold tracking-widest " +
                    (error ? "text-destructive" : "text-foreground")
                  }
                >
                  {digits ? `№ ${digits}` : <span className="text-muted-foreground/40">№ —</span>}
                </span>
              </div>
              {error && <p className="mt-1 text-center text-sm font-semibold text-destructive">{error}</p>}

              <div className="mx-auto mt-4 grid w-full max-w-[320px] grid-cols-3 gap-2.5">
                {keys.map((k) => (
                  <button
                    key={k}
                    onClick={() => press(k)}
                    className="flex h-16 items-center justify-center rounded-2xl border border-border bg-card/70 font-display text-2xl font-extrabold transition hover:border-primary/50 hover:bg-primary/10 active:scale-95"
                  >
                    {k}
                  </button>
                ))}
                <button
                  onClick={backspace}
                  aria-label="O‘chirish"
                  className="flex h-16 items-center justify-center rounded-2xl border border-border bg-card/40 text-muted-foreground transition hover:bg-white/5 active:scale-95"
                >
                  <Delete className="h-5 w-5" />
                </button>
                <button
                  onClick={() => press("0")}
                  className="flex h-16 items-center justify-center rounded-2xl border border-border bg-card/70 font-display text-2xl font-extrabold transition hover:border-primary/50 hover:bg-primary/10 active:scale-95"
                >
                  0
                </button>
                <div className="flex h-16 items-center justify-center rounded-2xl border border-transparent">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                    stol
                  </span>
                </div>
              </div>

              <Button size="lg" className="mt-5 w-full" disabled={!digits} onClick={submit}>
                Davom etish <ArrowRight className="h-5 w-5" />
              </Button>

              <button
                onClick={() => {
                  setError("QR kodni kamerangizda ochib, stol ustidagi skanerlang");
                }}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card/60 px-4 py-3.5 text-sm font-semibold text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
              >
                <QrCode className="h-4.5 w-4.5" style={{ height: 18, width: 18 }} /> QR kodni skanerlash
              </button>

              {existing && (
                <button
                  onClick={() => navigate("/menu")}
                  className="mt-4 w-full text-center text-sm font-semibold text-primary"
                >
                  Avvalgi sessiyaga qaytish (Stol №{existing.number})
                </button>
              )}

              {tables.length === 0 && (
                <p className="mt-4 text-center text-xs text-muted-foreground">
                  Faol stollar topilmadi — administrator bilan bog‘laning.
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
