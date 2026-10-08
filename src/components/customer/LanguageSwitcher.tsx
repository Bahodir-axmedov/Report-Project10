import { useState } from "react";
import { Check, Globe } from "lucide-react";
import { LANGS, useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { lang, setLang } = useI18n();
  const [open, setOpen] = useState(false);
  const current = LANGS.find((l) => l.code === lang)!;

  if (compact) {
    return (
      <div className="relative">
        <button
          onClick={() => setOpen((o) => !o)}
          aria-label="Tilni tanlash"
          className="flex h-10 items-center gap-1.5 rounded-xl border border-border bg-secondary/60 px-3 text-sm font-semibold transition hover:bg-white/10"
        >
          <Globe className="h-4 w-4 text-muted-foreground" />
          <span className="uppercase">{current.code}</span>
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <div className="glass absolute right-0 top-12 z-20 w-40 overflow-hidden rounded-2xl p-1.5">
              {LANGS.map((l) => (
                <button
                  key={l.code}
                  onClick={() => {
                    setLang(l.code);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm transition hover:bg-white/10",
                    l.code === lang && "bg-primary/15 text-primary"
                  )}
                >
                  <span>{l.flag}</span>
                  <span className="flex-1 text-left">{l.label}</span>
                  {l.code === lang && <Check className="h-3.5 w-3.5" />}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-2.5">
      {LANGS.map((l) => (
        <button
          key={l.code}
          onClick={() => setLang(l.code)}
          className={cn(
            "flex items-center gap-3 rounded-2xl border px-4 py-3.5 text-left font-semibold transition",
            l.code === lang
              ? "border-primary bg-primary text-primary-foreground glow-red"
              : "border-border bg-secondary/50 hover:bg-white/10"
          )}
        >
          <span className="text-xl">{l.flag}</span>
          <span className="flex-1">{l.label}</span>
          {l.code === lang && <Check className="h-4 w-4" />}
        </button>
      ))}
    </div>
  );
}
