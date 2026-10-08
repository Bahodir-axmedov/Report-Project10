import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, SlidersHorizontal, UtensilsCrossed } from "lucide-react";
import { FoodImage } from "@/components/FoodImage";
import { ProductCard } from "@/components/customer/ProductCard";
import { SearchField, SectionHeader } from "@/components/customer/menu";
import { EmptyState, Tabs } from "@/components/ui/primitives";
import { addToCart, setCartQty, useCart } from "@/lib/cart";
import { useCustomer } from "@/lib/customer";
import { useFavorites, toggleFavorite } from "@/lib/favorites";
import { useI18n } from "@/lib/i18n";
import { useDB } from "@/lib/store";
import { useToast } from "@/components/ui/toast";
import { CartBar } from "./Home";
import type { Product } from "@/lib/types";

type Filter = "all" | "popular" | "new" | "promo";
type Sort = "recommended" | "price_asc" | "price_desc" | "rating";

export default function CategoryPage() {
  const { slug } = useParams();
  const db = useDB();
  const { sessionKey } = useCustomer();
  const { t, categoryName, localizedName } = useI18n();
  const favorites = useFavorites();
  const { toast } = useToast();
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("recommended");
  const [query, setQuery] = useState("");

  const category = db.categories.find((c) => c.slug === slug);

  const products = useMemo(() => {
    let list = db.products.filter((p) => p.categoryId === category?.id && p.available);
    if (filter === "popular") list = list.filter((p) => p.isPopular);
    if (filter === "new") list = list.filter((p) => p.isNew);
    if (filter === "promo") list = list.filter((p) => p.isPromotion);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (p) =>
          localizedName(p).toLowerCase().includes(q) ||
          p.nameRu.toLowerCase().includes(q) ||
          p.ingredients.toLowerCase().includes(q)
      );
    }
    const sorted = [...list];
    if (sort === "price_asc") sorted.sort((a, b) => a.price - b.price);
    else if (sort === "price_desc") sorted.sort((a, b) => b.price - a.price);
    else if (sort === "rating") sorted.sort((a, b) => b.rating - a.rating);
    else sorted.sort((a, b) => a.sortOrder - b.sortOrder);
    return sorted;
  }, [db.products, category, filter, query, sort, localizedName]);

  const lines = useCart(sessionKey);
  const qtyOf = (id: string) => lines.find((l) => l.productId === id)?.qty ?? 0;

  const add = (p: Product) => {
    addToCart(sessionKey, p.id, 1);
    toast({ type: "success", title: t("added"), body: localizedName(p) });
  };

  if (!category) {
    return (
      <EmptyState
        icon={<UtensilsCrossed className="h-7 w-7" />}
        title="Kategoriya topilmadi"
        action={
          <Link to="/categories" className="text-sm font-semibold text-primary">
            Kategoriyalarga qaytish
          </Link>
        }
      />
    );
  }

  const total = db.products.filter((p) => p.categoryId === category.id && p.available).length;

  return (
    <div className="space-y-5">
      {/* ---------------- category header ---------------- */}
      <div className="relative overflow-hidden rounded-3xl border border-border">
        <FoodImage src={category.image} alt={categoryName(category)} className="aspect-[16/8] w-full" loading="eager" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/10" />
        <Link
          to="/categories"
          className="absolute left-3 top-3 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/50 backdrop-blur transition active:scale-90"
          aria-label={t("back")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="absolute inset-x-4 bottom-3.5">
          <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold leading-none tracking-tight">
            <span className="text-xl">{category.icon}</span>
            {categoryName(category)}
          </h1>
          <p className="mt-1.5 text-[12px] font-medium text-muted-foreground">
            {total} {t("dishes")}
          </p>
        </div>
      </div>

      {/* ---------------- controls ---------------- */}
      <div className="space-y-3">
        <SearchField value={query} onChange={setQuery} />

        <div className="flex items-center gap-2">
          <Tabs
            value={filter}
            onChange={setFilter}
            className="flex-1"
            items={[
              { value: "all", label: t("all") },
              { value: "popular", label: t("popular") },
              { value: "new", label: t("new") },
              { value: "promo", label: t("promo") },
            ]}
          />
          <label className="relative flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-secondary/50 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span className="sr-only">{t("sort")}</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              className="appearance-none bg-transparent pr-1 text-xs font-semibold text-foreground focus:outline-none"
              aria-label={t("sort")}
            >
              <option value="recommended">{t("sort_recommended")}</option>
              <option value="price_asc">{t("sort_price_asc")}</option>
              <option value="price_desc">{t("sort_price_desc")}</option>
              <option value="rating">{t("sort_rating")}</option>
            </select>
          </label>
        </div>
      </div>

      {/* ---------------- dishes ---------------- */}
      {products.length === 0 ? (
        <EmptyState
          icon={<UtensilsCrossed className="h-7 w-7" />}
          title={t("no_results")}
          description={t("no_results_desc")}
        />
      ) : (
        <section>
          <SectionHeader title={`${products.length} ${t("dishes")}`} className="mb-3.5" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((p, i) => (
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
