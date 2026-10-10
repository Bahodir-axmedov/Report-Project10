import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Clock,
  Percent,
  Info,
  Instagram,
  MapPin,
  Phone,
  Send,
  Sparkles,
  Truck,
  Utensils,
} from "lucide-react";
import { Brand, LogoMark } from "@/components/Brand";
import { FoodImage } from "@/components/FoodImage";
import { LanguageSwitcher } from "@/components/customer/LanguageSwitcher";
import { ProductCard } from "@/components/customer/ProductCard";
import { Button } from "@/components/ui/primitives";
import { addToCart, setCartQty, useCart } from "@/lib/cart";
import { useCustomer } from "@/lib/customer";
import { useFavorites, toggleFavorite } from "@/lib/favorites";
import { useI18n } from "@/lib/i18n";
import { useDB, useFeature } from "@/lib/store";
import { useToast } from "@/components/ui/toast";
import { cn, fmtNumber } from "@/lib/utils";
import type { Product } from "@/lib/types";

const PENDING_TYPE_KEY = "yumi.pendingType";

/** Remember which order type the guest picked on the home screen so the
 * checkout wizard opens on the right step. */
export function setPendingType(type: string) {
  try {
    sessionStorage.setItem(PENDING_TYPE_KEY, type);
  } catch {
    /* noop */
  }
}

export function takePendingType(): string | null {
  try {
    const v = sessionStorage.getItem(PENDING_TYPE_KEY);
    sessionStorage.removeItem(PENDING_TYPE_KEY);
    return v;
  } catch {
    return null;
  }
}

export default function CustomerHome() {
  const db = useDB();
  const { sessionKey, table } = useCustomer();
  const { t, categoryName, localizedName } = useI18n();
  const favorites = useFavorites();
  const showPromotions = useFeature("promotions");
  const showDelivery = useFeature("delivery");
  const showPreorder = useFeature("preorder");
  const { toast } = useToast();
  const navigate = useNavigate();

  const products = db.products.filter((p) => p.available);
  const popular = useMemo(() => products.filter((p) => p.isPopular).slice(0, 8), [products]);
  const hero = products.find((p) => p.isPromotion && p.oldPrice) ?? products.find((p) => p.isPopular) ?? products[0];
  const s = db.settings;

  const lines = useCart(sessionKey);
  const qtyOf = (id: string) => lines.find((l) => l.productId === id)?.qty ?? 0;
  const add = (p: Product) => {
    addToCart(sessionKey, p.id, 1);
    toast({ type: "success", title: t("added"), body: localizedName(p) });
  };

  const startTableOrder = () => {
    if (table) {
      navigate("/menu");
    } else {
      navigate("/t/demo?returnTo=/menu");
    }
  };
  const startTyped = (type: "DELIVERY" | "PREORDER") => {
    setPendingType(type);
    navigate("/menu");
  };

  return (
    <div className="min-h-full bg-background pb-10">
      {/* ---------------- hero (mockup screen 1) ---------------- */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          {hero ? (
            <FoodImage src={hero.image} alt={localizedName(hero)} className="h-full w-full" loading="eager" />
          ) : (
            <div className="h-full w-full bg-[radial-gradient(circle_at_50%_20%,hsl(356,82%,24%),hsl(240,6%,6%))]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/60 to-background" />
        </div>

        <div className="relative mx-auto flex min-h-[78vh] w-full max-w-md flex-col px-4 pb-8 pt-5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 rounded-full border border-white/15 bg-black/40 px-3 py-1.5 backdrop-blur">
              <LogoMark className="h-5 w-5" />
              <span className="text-xs font-extrabold tracking-tight">YÜMI</span>
            </span>
            <LanguageSwitcher compact />
          </div>

          <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
              <Brand size="lg" className="justify-center" />
            </motion.div>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="mt-5 font-display text-xl font-extrabold text-white drop-shadow"
            >
              Mazali taomlar, yaxshi kayfiyat!
            </motion.p>
          </div>

          <div className="space-y-2.5">
            <motion.button
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              onClick={startTableOrder}
              className="glow-red flex w-full items-center gap-3.5 rounded-2xl bg-primary p-4 text-left text-primary-foreground transition active:scale-[0.98]"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-black/20">
                <Utensils className="h-5 w-5" />
              </span>
              <span className="flex-1">
                <span className="block text-[15px] font-extrabold">Stolda zakaz berish</span>
                <span className="mt-0.5 block text-xs opacity-85">
                  {table ? `Stol №${table.number} · davom eting` : "Stol raqamini kiriting"}
                </span>
              </span>
              <ArrowRight className="h-5 w-5" />
            </motion.button>

            {showDelivery && (
              <motion.button
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.22 }}
                onClick={() => startTyped("DELIVERY")}
                className="flex w-full items-center gap-3.5 rounded-2xl border border-white/12 bg-black/55 p-4 text-left backdrop-blur transition hover:border-primary/50 active:scale-[0.98]"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/8">
                  <Truck className="h-5 w-5 text-primary" />
                </span>
                <span className="flex-1">
                  <span className="block text-[15px] font-extrabold">Yetkazib berish (Delivery)</span>
                  <span className="mt-0.5 block text-xs text-white/60">Manzilingizga yetkazamiz</span>
                </span>
                <ArrowRight className="h-4 w-4 text-white/50" />
              </motion.button>
            )}

            {showPreorder && (
              <motion.button
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.28 }}
                onClick={() => startTyped("PREORDER")}
                className="flex w-full items-center gap-3.5 rounded-2xl border border-white/12 bg-black/55 p-4 text-left backdrop-blur transition hover:border-primary/50 active:scale-[0.98]"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/8">
                  <Clock className="h-5 w-5 text-primary" />
                </span>
                <span className="flex-1">
                  <span className="block text-[15px] font-extrabold">Oldindan zakaz</span>
                  <span className="mt-0.5 block text-xs text-white/60">Ma’lum vaqtda tayyorlab beramiz</span>
                </span>
                <ArrowRight className="h-4 w-4 text-white/50" />
              </motion.button>
            )}

            <div className="grid grid-cols-2 gap-2.5 pt-1.5">
              <Link
                to={showPromotions ? "/menu/c/promo" : "/menu"}
                className="flex items-center gap-2.5 rounded-2xl border border-white/12 bg-black/45 px-3.5 py-3 text-left backdrop-blur transition hover:border-primary/50"
              >
                <Percent className="text-primary" style={{ height: 18, width: 18 }} />
                <span className="text-[13px] font-bold leading-tight">
                  Aksiya va
                  <br />
                  takliflar
                </span>
              </Link>
              <Link
                to="/about"
                className="flex items-center gap-2.5 rounded-2xl border border-white/12 bg-black/45 px-3.5 py-3 text-left backdrop-blur transition hover:border-primary/50"
              >
                <Info style={{ height: 18, width: 18 }} className="text-primary" />
                <span className="text-[13px] font-bold leading-tight">
                  Restoran
                  <br />
                  haqida
                </span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- popular dishes ---------------- */}
      {popular.length > 0 && (
        <section className="mx-auto w-full max-w-md px-4 pt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-display text-lg font-extrabold">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
                <Sparkles className="h-4 w-4" />
              </span>
              {t("popular")}
            </h2>
            <Link to="/menu" className="rounded-full border border-border bg-secondary/50 px-3 py-1.5 text-[11px] font-semibold text-muted-foreground transition hover:border-primary/40 hover:text-foreground">
              {t("full_menu")}
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {popular.slice(0, 4).map((p, i) => (
              <ProductCard
                key={p.id}
                product={p}
                index={i}
                onAdd={() => add(p)}
                qty={qtyOf(p.id)}
                onInc={() => add(p)}
                onDec={() => setCartQty(sessionKey, p.id, qtyOf(p.id) - 1)}
                favorite={favorites.includes(p.id)}
                onToggleFavorite={() => toggleFavorite(p.id)}
              />
            ))}
          </div>
        </section>
      )}

      {/* ---------------- about + contacts ---------------- */}
      <section className="mx-auto w-full max-w-md space-y-3 px-4 pt-8">
        <div className="rounded-3xl border border-border bg-card/60 p-5">
          <h2 className="font-display text-base font-bold">{t("about")}</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.description}</p>
          <div className="mt-4 grid gap-2.5 text-sm">
            <p className="flex items-center gap-2.5 text-muted-foreground">
              <Phone className="h-4 w-4 shrink-0 text-primary" /> {s.phone}
            </p>
            <p className="flex items-center gap-2.5 text-muted-foreground">
              <MapPin className="h-4 w-4 shrink-0 text-primary" /> {s.address}
            </p>
            <p className="flex items-center gap-2.5 text-muted-foreground">
              <Clock className="h-4 w-4 shrink-0 text-primary" /> {s.workingHours}
            </p>
            <p className="flex items-center gap-2.5 text-muted-foreground">
              <Instagram className="h-4 w-4 shrink-0 text-primary" /> {s.instagram}
            </p>
            <p className="flex items-center gap-2.5 text-muted-foreground">
              <Send className="h-4 w-4 shrink-0 text-primary" /> {s.telegram}
            </p>
          </div>
          <div className="mt-4 flex gap-2.5">
            <a href={s.mapsUrl} target="_blank" rel="noreferrer" className="flex-1">
              <Button variant="secondary" className="w-full">
                <MapPin className="h-4 w-4" /> {t("open_map")}
              </Button>
            </a>
            <Link to="/about" className="flex-1">
              <Button variant="outline" className="w-full">
                {t("about")}
              </Button>
            </Link>
          </div>
        </div>

        <p className={cn("pb-2 text-center text-[11px] text-muted-foreground")}>{s.footerText}</p>
        <p className="pb-4 text-center text-[11px]">
          <Link to="/auth" className="text-muted-foreground/70 underline-offset-2 hover:text-primary hover:underline">
            Xodimlar uchun kirish →
          </Link>
        </p>
      </section>
    </div>
  );
}
