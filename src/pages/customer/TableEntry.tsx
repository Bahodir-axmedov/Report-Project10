import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { QrCode, ScanLine } from "lucide-react";
import { Brand } from "@/components/Brand";
import { Button } from "@/components/ui/primitives";
import { useCustomer } from "@/lib/customer";
import { useI18n } from "@/lib/i18n";
import { useDB } from "@/lib/store";

type View = "checking" | "error" | "choose";

/**
 * Table QR entry. A real token enters the session IMMEDIATELY and lands on
 * /menu — ordering from the table and calling the waiter are right there in
 * the menu shell, so no intermediate "scan confirmed"/language screens.
 * The manual picker is only a fallback for broken QR codes and /t/demo.
 */
export default function TableEntry() {
  const { token } = useParams();
  const db = useDB();
  const { enterWithToken, table: existing } = useCustomer();
  const { t } = useI18n();
  const navigate = useNavigate();

  const tables = useMemo(
    () => db.tables.filter((x) => x.active).sort((a, b) => a.number - b.number),
    [db.tables]
  );
  const isDemo = !token || token === "demo";

  const [view, setView] = useState<View>(isDemo ? "choose" : "checking");
  const [error, setError] = useState<string | null>(null);

  const enterToken = (tk: string) => {
    // Cross-branch aware: a QR from another branch moves this tab into that
    // branch, so we must NOT pre-check the token against the local tables.
    const res = enterWithToken(tk);
    if (!res.ok) {
      setError(res.error ?? "Xatolik");
      setView("error");
      return;
    }
    // QR → straight to the menu: order from this table + call the waiter.
    navigate("/menu", { replace: true });
  };

  // Real QR token: enter on mount, no extra taps.
  useEffect(() => {
    if (isDemo || !token) return;
    setError(null);
    setView("checking");
    enterToken(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const enterNumber = (n: number) => {
    const tbl = db.tables.find((x) => x.number === n && x.active);
    if (!tbl) {
      setError(`Stol №${n} mavjud emas`);
      return;
    }
    setError(null);
    enterToken(tbl.qrToken);
  };

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
              <Button size="lg" className="mt-6 w-full" onClick={() => setView("choose")}>
                Stolni qo‘lda tanlash
              </Button>
            </motion.div>
          )}

          {view === "choose" && (
            <motion.div
              key="choose"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              className="glass rounded-3xl p-5"
            >
              <h1 className="text-center font-display text-xl font-extrabold">{t("choose_table")}</h1>
              <p className="mt-1.5 text-center text-sm text-muted-foreground">
                Agar QR avtomatik aniqlanmasa, qo‘lda tanlang.
              </p>
              {error && (
                <p className="mt-3 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-center text-sm text-destructive">
                  {error}
                </p>
              )}
              <div className="mt-5 grid grid-cols-3 gap-2.5 sm:grid-cols-4">
                {tables.map((tb) => (
                  <button
                    key={tb.id}
                    onClick={() => enterNumber(tb.number)}
                    disabled={!tb.active}
                    className="flex aspect-square flex-col items-center justify-center rounded-2xl border border-border bg-secondary/60 text-lg font-bold transition hover:border-primary hover:bg-primary/10 disabled:opacity-40"
                  >
                    {tb.number}
                    <span className="mt-0.5 text-[10px] font-medium text-muted-foreground">{tb.zone}</span>
                  </button>
                ))}
              </div>
              {existing && (
                <Button
                  variant="ghost"
                  className="mt-4 w-full"
                  onClick={() => navigate("/menu")}
                >
                  Avvalgi sessiyaga qaytish (Stol №{existing.number})
                </Button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
