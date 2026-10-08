import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Bell, Clock, Flame, Heart, Percent, ShoppingBag, Sparkles, Truck, Utensils } from "lucide-react";
import { FoodImage } from "@/components/FoodImage";
import { ProductCard } from "@/components/customer/ProductCard";
import { CategoryRail, SearchField, SectionHeader } from "@/components/customer/menu";
import { Button } from "@/components/ui/primitives";
import { addToCart, setCartQty, useCart } from "@/lib/cart";
import { useCustomer } from "@/lib/customer";
import { useFavorites, toggleFavorite } from "@/lib/favorites";
import { useI18n } from "@/lib/i18n";
import { useDB, useFeature } from "@/lib/store";
import { useToast } from "@/components/ui/toast";
import { cn, fmtNumber } from "@/lib/utils";
import type { Product } from "@/lib/types";

export default function CustomerHome() {
  const db = useDB();
  const { sessionKey, table } = useCustomer();
  const { t, categoryName, localizedName } = useI18n();
  const favorites = useFavorites();
  const showPreorder = useFeature("preorder");
  const showDelivery = useFeature("delivery");
  const showPromotions = useFeature("promotions");
  const showFavorites = useFeature("favorites");
  const { toast } = useToast();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  const categories = db.categories
    .filter((c) => c.visible && (showPromotions || c.slug !== "promo"))
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const products = db.products.filter((p) => p.available);
  const popular = products.filter((p) => p.isPopular).slice(0, 6);
  const fresh = products.filter((p) => p.isNew).slice(0, 6);
  const promo = products.filter((p) => p.isPromotion && p.oldPrice && p.oldPrice > p.price).slice(0, 6);
  const favouriteProducts = products.filter((p) => favorites.includes(p.id)).slice(0, 6);

  const hero = promo[0] ?? products.find((p) => p.isPopular) ?? products[0];

  const cartQty = useCart(sessionKey);
  const qtyOf = (id: string) => cartQty.find((l) => l.productId === id)?.qty ?? 0;

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return products
      .filter(
        (p) =>
          localizedName(p).toLowerCase().includes(q) ||
          p.nameRu.toLowerCase().includes(q) ||
          p.ingredients.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [query, products, localizedName]);

  const categoryOf = (p: Product) => db.categories.find((c) => c.id === p.categoryId);

  const add = (p: Product, qty = 1) => {
    addToCart(sessionKey, p.id, qty);
    toast({ type: "success", title: t("added"), body: localizedName(p) });
  };

  return (
    <div className="space-y-7">
      {/* ---------------- intro ---------------- */}
      <header className="space-y-1.5">
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-display text-[26px] font-extrabold leading-none tracking-tight">{t("menu")}</h1>
          {table && (
            <span className="rounded-full border border-primary/40 bg-primary/12 px-3 py-1 text-[11px] font-bold text-primary">
              {t("table")} №{table.number}
            </span>
          )}
        </div>
        <p className="text-[13px] text-muted-foreground">{t("menu_subtitle")}</p>
      </header>

      {/* ---------------- search ---------------- */}
      <div className="relative">
        <SearchField value={query} onChange={setQuery} />
        {results.length > 0 && (
          <div className="glass absolute inset-x-0 top-[3.25rem] z-30 overflow-hidden rounded-2xl border border-border shadow-2xl">
            {results.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setQuery("");
                  navigate(`/menu/p/${p.id}`);
                }}
                className="flex w-full items-center gap-3 border-b border-border/40 p-2.5 text-left transition last:border-0 hover:bg-white/5"
              >
                <FoodImage src={p.image} alt={localizedName(p)} className="h-12 w-12 rounded-xl" />
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-sm font-semibold">{localizedName(p)}</p>
                  {categoryOf(p) && (
                    <p className="text-xs text-muted-foreground">{categoryName(categoryOf(p)!)}</p>
                  )}
                </div>
                <span className="shrink-0 text-sm font-bold text-primary">{fmtNumber(p.price)}</span>
              </button>
            ))}
          </div>
        )}
        {query.trim() && results.length === 0 && (
          <p className="mt-2 px-1 text-xs text-muted-foreground">{t("no_results")}</p>
        )}
      </div>

      {/* ---------------- categories ---------------- */}
      <section>
        <SectionHeader title={t("categories")} action={{ label: t("full_menu"), to: "/categories" }} />
        <CategoryRail categories={categories} />
      </section>

      {/* ---------------- hero ---------------- */}
      {hero && (
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-3xl border border-primary/25"
        >
          <FoodImage src={hero.image} alt={localizedName(hero)} className="aspect-[16/10] w-full sm:aspect-[16/7]" loading="eager" />
          <div className="absolute inset-0 bg-gradient-to-tr from-background via-background/85 to-background/10" />
          <div className="absolute inset-y-0 left-0 flex max-w-[78%] flex-col justify-center gap-2.5 p-5 sm:max-w-[60%]">
            <span className="flex w-fit items-center gap-1.5 rounded-full bg-primary px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-primary-foreground">
              <Percent className="h-3 w-3" />
              {t("seasonal")}
            </span>
            <h2 className="font-display text-xl font-extrabold leading-tight tracking-tight sm:text-2xl">
              {localizedName(hero)}
            </h2>
            <div className="flex items-baseline gap-2">
              <span className="font-display text-2xl font-extrabold text-primary">{fmtNumber(hero.price)}</span>
              <span className="text-xs font-semibold text-muted-foreground">so‘m</span>
              {hero.oldPrice && hero.oldPrice > hero.price && (
                <span className="text-xs text-muted-foreground line-through">{fmtNumber(hero.oldPrice)}</span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" onClick={() => navigate(`/menu/p/${hero.id}`)}>
                {t("order_now")} <ArrowRight className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant="secondary" onClick={() => navigate("/categories")}>
                {t("open_menu")}
              </Button>
            </div>
          </div>
        </motion.section>
      )}

      {/* ---------------- quick actions ---------------- */}
      <section
        className={cn(
          "grid gap-2.5",
          showPreorder && showDelivery
            ? "grid-cols-3"
            : showPreorder || showDelivery
            ? "grid-cols-2"
            : "grid-cols-1"
        )}
      >
        <QuickAction
          icon={Utensils}
          label={t("dine_in")}
          sub={table ? `Stol №${table.number}` : "—"}
          onClick={() => navigate("/categories")}
          accent
        />
        {showPreorder && (
          <QuickAction icon={Clock} label={t("preorder")} sub={t("preorder_desc")} onClick={() => navigate("/orders")} />
        )}
        {showDelivery && (
          <QuickAction icon={Truck} label={t("delivery")} sub={t("delivery_desc")} onClick={() => navigate("/about")} />
        )}
      </section>

      {/* ---------------- promo rail ---------------- */}
      {showPromotions && promo.length > 0 && (
        <section>
          <SectionHeader title={t("promo")} icon={Percent} action={{ label: t("see_all"), to: "/menu/c/promo" }} />
          <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
            {promo.map((p, i) => (
              <div key={p.id} className="w-[164px] shrink-0">
                <ProductCard
                  product={p}
                  index={i}
                  onAdd={() => add(p)}
                  qty={qtyOf(p.id)}
                  onInc={() => add(p)}
                  onDec={() => setCartQty(sessionKey, p.id, qtyOf(p.id) - 1)}
                  favorite={favorites.includes(p.id)}
                  onToggleFavorite={() => toggleFavorite(p.id)}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ---------------- popular ---------------- */}
      <section>
        <SectionHeader title={t("popular")} icon={Flame} action={{ label: t("see_all"), to: "/categories" }} />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {popular.map((p, i) => (
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

      {/* ---------------- favourites ---------------- */}
      {showFavorites && favouriteProducts.length > 0 && (
        <section>
          <SectionHeader title={t("favorites")} icon={Heart} />
          <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
            {favouriteProducts.map((p, i) => (
              <div key={p.id} className="w-[164px] shrink-0">
                <ProductCard
                  product={p}
                  index={i}
                  onAdd={() => add(p)}
                  qty={qtyOf(p.id)}
                  onInc={() => add(p)}
                  onDec={() => setCartQty(sessionKey, p.id, qtyOf(p.id) - 1)}
                  favorite
                  onToggleFavorite={() => toggleFavorite(p.id)}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ---------------- new ---------------- */}
      {fresh.length > 0 && (
        <section>
          <SectionHeader title={t("new")} icon={Sparkles} action={{ label: t("see_all"), to: "/categories" }} />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {fresh.map((p, i) => (
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

      <CartBar />
    </div>
  );
}

function QuickAction({
  icon: Icon,
  label,
  sub,
  onClick,
  accent,
}: {
  icon: typeof Bell;
  label: string;
  sub: string;
  onClick: () => void;
  accent?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col gap-2 rounded-2xl border p-3 text-left transition active:scale-[0.98]",
        accent ? "border-primary/40 bg-primary/10" : "border-border bg-card/60 hover:border-primary/30 hover:bg-white/5"
      )}
    >
      <span
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-xl",
          accent ? "bg-primary/15 text-primary" : "bg-secondary/60 text-muted-foreground"
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span>
        <span className="block text-xs font-bold leading-tight">{label}</span>
        <span className="mt-0.5 line-clamp-1 block text-[10px] text-muted-foreground">{sub}</span>
      </span>
    </button>
  );
}

export function CartBar() {
  const { sessionKey } = useCustomer();
  const lines = useCart(sessionKey);
  const db = useDB();
  const { t } = useI18n();

  if (!lines.length) return null;
  const total = lines.reduce((s, l) => {
    const p = db.products.find((x) => x.id === l.productId);
    return s + (p ? p.price * l.qty : 0);
  }, 0);
  const count = lines.reduce((s, l) => s + l.qty, 0);

  return (
    <motion.div
      initial={{ y: 60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="sticky bottom-[76px] z-20 lg:bottom-4"
    >
      <Link to="/cart">
        <div className="glow-red flex items-center gap-3 rounded-2xl border border-primary/40 bg-primary p-2 pl-4 text-primary-foreground">
          <span className="relative">
            <ShoppingBag className="h-5 w-5" />
            <span className="absolute -right-2 -top-2 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-black/70 px-1 text-[10px] font-bold">
              {count}
            </span>
          </span>
          <span className="flex-1 text-sm font-bold">{t("continue_order")}</span>
          <span className="rounded-xl bg-black/25 px-3 py-2 text-sm font-bold">{fmtNumber(total)} so‘m</span>
        </div>
      </Link>
    </motion.div>
  );
}
