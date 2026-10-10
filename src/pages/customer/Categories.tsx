import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, LayoutGrid, Search } from "lucide-react";
import { FoodImage } from "@/components/FoodImage";
import { EmptyState } from "@/components/ui/primitives";
import { useCustomer } from "@/lib/customer";
import { useCart } from "@/lib/cart";
import { useI18n } from "@/lib/i18n";
import { useDB, useFeature } from "@/lib/store";
import { CartBar } from "@/components/customer/CartBar";

/** Menu screen (mockup screen 3): search + big category rows with photos. */
export default function Categories() {
  const db = useDB();
  const { categoryName, localizedName, t } = useI18n();
  const { sessionKey, table } = useCustomer();
  const [query, setQuery] = useState("");

  const showPromotions = useFeature("promotions");
  const all = db.categories
    .filter((c) => c.visible && (showPromotions || c.slug !== "promo"))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const q = query.trim().toLowerCase();
  const categories = useMemo(() => {
    if (!q) return all;
    return all.filter(
      (c) =>
        categoryName(c).toLowerCase().includes(q) ||
        c.nameRu.toLowerCase().includes(q) ||
        c.nameEn.toLowerCase().includes(q)
    );
  }, [all, q, categoryName]);

  // Searching a dish name directly lists matching dishes under the categories.
  const dishResults = useMemo(() => {
    if (!q) return [];
    return db.products
      .filter(
        (p) =>
          p.available &&
          (localizedName(p).toLowerCase().includes(q) ||
            p.nameRu.toLowerCase().includes(q) ||
            p.ingredients.toLowerCase().includes(q))
      )
      .slice(0, 12);
  }, [q, db.products, localizedName]);

  const dishCount = (id: string) => db.products.filter((p) => p.categoryId === id && p.available).length;
  const lines = useCart(sessionKey);

  return (
    <div className="space-y-5">
      <header className="space-y-1.5">
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-display text-[26px] font-extrabold leading-none tracking-tight">{t("menu")}</h1>
          {table && (
            <span className="rounded-full border border-primary/40 bg-primary/12 px-3 py-1 text-[11px] font-bold text-primary">
              {t("table")} №{table.number}
            </span>
          )}
        </div>
      </header>

      {/* search (mockup screen 3) */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Taom qidirish..."
          className="h-12 w-full rounded-2xl border border-border bg-secondary/50 pl-11 pr-4 text-sm text-foreground placeholder:text-muted-foreground transition focus:border-primary/50 focus:bg-secondary/70 focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      {/* direct dish hits */}
      {q && dishResults.length > 0 && (
        <section className="space-y-2">
          {dishResults.map((p) => (
            <Link
              key={p.id}
              to={`/menu/p/${p.id}`}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card/60 p-2.5 transition hover:border-primary/40"
            >
              <FoodImage src={p.image} alt={localizedName(p)} className="h-14 w-14 rounded-xl" />
              <div className="min-w-0 flex-1">
                <p className="line-clamp-1 text-sm font-semibold">{localizedName(p)}</p>
                <p className="mt-0.5 text-xs font-bold text-primary">{p.price.toLocaleString("ru-RU")} so‘m</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          ))}
        </section>
      )}

      {categories.length === 0 && (!q || dishResults.length === 0) ? (
        <EmptyState
          icon={<LayoutGrid className="h-7 w-7" />}
          title={t("no_results")}
          description={t("no_results_desc")}
        />
      ) : (
        <section className="space-y-3">
          {categories.map((c, i) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.04, 0.3) }}
            >
              <Link
                to={`/menu/c/${c.slug}`}
                className="group flex items-center gap-4 rounded-3xl border border-border bg-card/60 p-3.5 transition duration-300 hover:-translate-y-0.5 hover:border-primary/45"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-display text-lg font-extrabold leading-tight">{categoryName(c)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {c.slug === "rolls"
                      ? "Turli xil rollar"
                      : c.slug === "sushi"
                      ? "An’namaviy sushi"
                      : c.slug === "poke"
                      ? "Yangi va sog‘lom taomlar"
                      : c.slug === "drinks"
                      ? "Ichimliklar va choylar"
                      : c.slug === "promo"
                      ? "Aksiyadagi taomlar"
                      : `${dishCount(c.id)} ${t("dishes")}`}
                  </p>
                </div>
                <span className="relative block h-20 w-24 shrink-0 overflow-hidden rounded-2xl border border-border">
                  <FoodImage
                    src={c.image}
                    alt={categoryName(c)}
                    className="h-full w-full"
                    imgClassName="transition duration-500 group-hover:scale-110"
                  />
                  <span className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                  <span className="absolute bottom-1 right-1.5 text-base leading-none">{c.icon}</span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
              </Link>
            </motion.div>
          ))}
        </section>
      )}

      <CartBar />
      {lines.length === 0 && <div className="h-2" />}
    </div>
  );
}
