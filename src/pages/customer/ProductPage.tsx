import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Heart, Minus, Plus, ShoppingBag, Star, UtensilsCrossed } from "lucide-react";
import { FoodImage } from "@/components/FoodImage";
import { ProductCard } from "@/components/customer/ProductCard";
import { Button, EmptyState, Tabs } from "@/components/ui/primitives";
import { SectionHeader } from "@/components/customer/menu";
import { CartBar } from "./Home";
import { addToCart, setCartQty, useCart } from "@/lib/cart";
import { useCustomer } from "@/lib/customer";
import { useFavorites, toggleFavorite } from "@/lib/favorites";
import { useI18n } from "@/lib/i18n";
import { useDB } from "@/lib/store";
import { useToast } from "@/components/ui/toast";
import { cn, fmtNumber } from "@/lib/utils";

type Tab = "desc" | "ingredients" | "allergens" | "nutrition";

export default function ProductPage() {
  const { id } = useParams();
  const db = useDB();
  const { sessionKey } = useCustomer();
  const { t, localizedName, localizedDesc, categoryName } = useI18n();
  const favorites = useFavorites();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [qty, setQty] = useState(1);
  const [tab, setTab] = useState<Tab>("desc");

  const lines = useCart(sessionKey);
  const product = db.products.find((p) => p.id === id);
  if (!product) {
    return (
      <EmptyState
        icon={<UtensilsCrossed className="h-7 w-7" />}
        title={t("no_products")}
        action={
          <Link to="/categories" className="text-sm font-semibold text-primary">
            {t("menu")}
          </Link>
        }
      />
    );
  }

  const category = db.categories.find((c) => c.id === product.categoryId);
  const related = db.products
    .filter((p) => p.categoryId === product.categoryId && p.id !== product.id && p.available)
    .slice(0, 4);
  const isFav = favorites.includes(product.id);
  const hasDiscount = !!product.oldPrice && product.oldPrice > product.price;

  const handleAdd = () => {
    addToCart(sessionKey, product.id, qty);
    toast({ type: "success", title: t("added"), body: `${localizedName(product)} × ${qty}` });
    navigate(-1);
  };

  const nutrition = [
    { label: t("calories"), value: `${product.calories} kkal` },
    { label: t("proteins"), value: `${product.proteins} g` },
    { label: t("fats"), value: `${product.fats} g` },
    { label: t("carbs"), value: `${product.carbs} g` },
    { label: t("weight"), value: `${product.weight} g` },
  ];

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl border border-border">
        <FoodImage src={product.image} alt={localizedName(product)} className="aspect-square w-full sm:aspect-[16/9]" loading="eager" />
        <Link
          to={category ? `/menu/c/${category.slug}` : "/categories"}
          className="absolute left-3 top-3 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/50 backdrop-blur"
          aria-label={t("back")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <button
          onClick={() => toggleFavorite(product.id)}
          aria-label={t("favorites")}
          className={cn(
            "absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/50 backdrop-blur transition",
            isFav ? "text-primary" : "text-white/80"
          )}
        >
          <Heart className={cn("h-4 w-4", isFav && "fill-primary")} />
        </button>
      </div>

      <div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Link to="/categories" className="hover:text-foreground">{t("menu")}</Link>
          <span>/</span>
          {category && <Link to={`/menu/c/${category.slug}`} className="hover:text-foreground">{categoryName(category)}</Link>}
        </div>
        <h1 className="mt-2 font-display text-2xl font-extrabold sm:text-3xl">{localizedName(product)}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-1 text-sm font-semibold">
            <Star className="h-4 w-4 fill-[hsl(var(--warning))] text-[hsl(var(--warning))]" />
            {product.rating.toFixed(1)}
            <span className="text-xs font-normal text-muted-foreground">({product.ratingCount})</span>
          </span>
          <span className="text-sm text-muted-foreground">{product.weight} g</span>
          {product.isPopular && <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">MASHHUR</span>}
          {product.isNew && <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-black">NEW</span>}
        </div>

        <div className="mt-4 flex items-end gap-3">
          <span className={cn("font-display text-3xl font-extrabold", hasDiscount && "text-primary")}>
            {fmtNumber(product.price)}
          </span>
          <span className="pb-1 text-sm text-muted-foreground">so‘m</span>
          {hasDiscount && (
            <span className="pb-1 text-sm text-muted-foreground line-through">{fmtNumber(product.oldPrice!)}</span>
          )}
        </div>
      </div>

      {/* Quantity + add */}
      <div className="rounded-2xl border border-border bg-card/60 p-3.5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {t("quantity")}
            </p>
            <p className="mt-0.5 font-display text-xl font-extrabold leading-none">
              {fmtNumber(product.price * qty)} so‘m
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1 rounded-2xl border border-border bg-secondary/60 p-1">
            <button
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              aria-label="Kamaytirish"
              className="flex h-10 w-10 items-center justify-center rounded-xl transition hover:bg-white/5 active:scale-90"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="w-10 text-center font-display text-lg font-extrabold">{qty}</span>
            <button
              onClick={() => setQty((q) => Math.min(99, q + 1))}
              aria-label="Ko‘paytirish"
              className="flex h-10 w-10 items-center justify-center rounded-xl transition hover:bg-white/5 active:scale-90"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>
        <Button size="lg" className="mt-3 w-full" onClick={handleAdd}>
          <ShoppingBag className="h-5 w-5" /> {t("add_to_cart")} · {fmtNumber(product.price * qty)} so‘m
        </Button>
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { value: "desc", label: t("description") },
          { value: "ingredients", label: t("ingredients") },
          { value: "allergens", label: t("allergens") },
          { value: "nutrition", label: t("nutrition") },
        ]}
      />

      <motion.div
        key={tab}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-border bg-card/60 p-4"
      >
        {tab === "desc" && <p className="text-sm leading-relaxed text-muted-foreground">{localizedDesc(product)}</p>}
        {tab === "ingredients" && (
          <div className="flex flex-wrap gap-2">
            {product.ingredients.split(",").map((ing) => (
              <span key={ing} className="rounded-full border border-border bg-secondary/60 px-3 py-1 text-xs font-medium">
                {ing.trim()}
              </span>
            ))}
          </div>
        )}
        {tab === "allergens" && (
          <p className="text-sm text-muted-foreground">
            {product.allergens ? product.allergens : "Allergenlar aniqlanmagan"}
          </p>
        )}
        {tab === "nutrition" && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {nutrition.map((n) => (
              <div key={n.label} className="rounded-xl border border-border bg-secondary/40 px-3 py-2.5">
                <p className="text-xs text-muted-foreground">{n.label}</p>
                <p className="mt-0.5 font-display text-base font-bold">{n.value}</p>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {related.length > 0 && (
        <section>
          <SectionHeader title={t("related")} />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {related.map((p, i) => (
              <ProductCard
                key={p.id}
                product={p}
                index={i}
                onAdd={() => {
                  addToCart(sessionKey, p.id, 1);
                  toast({ type: "success", title: t("added"), body: localizedName(p) });
                }}
                favorite={favorites.includes(p.id)}
                onToggleFavorite={() => toggleFavorite(p.id)}
                qty={lines.find((l) => l.productId === p.id)?.qty ?? 0}
                onInc={() => {
                  addToCart(sessionKey, p.id, 1);
                  toast({ type: "success", title: t("added"), body: localizedName(p) });
                }}
                onDec={() =>
                  setCartQty(sessionKey, p.id, (lines.find((l) => l.productId === p.id)?.qty ?? 0) - 1)
                }
              />
            ))}
          </div>
        </section>
      )}

      <CartBar />
    </div>
  );
}
