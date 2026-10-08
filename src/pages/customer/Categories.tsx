import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, LayoutGrid } from "lucide-react";
import { FoodImage } from "@/components/FoodImage";
import { SearchField, SectionHeader } from "@/components/customer/menu";
import { EmptyState } from "@/components/ui/primitives";
import { useI18n } from "@/lib/i18n";
import { useDB } from "@/lib/store";
import { CartBar } from "./Home";

export default function Categories() {
  const db = useDB();
  const { categoryName, t } = useI18n();
  const [query, setQuery] = useState("");

  const all = db.categories.filter((c) => c.visible).sort((a, b) => a.sortOrder - b.sortOrder);
  const categories = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (c) =>
        categoryName(c).toLowerCase().includes(q) ||
        c.nameRu.toLowerCase().includes(q) ||
        c.nameEn.toLowerCase().includes(q)
    );
  }, [all, query, categoryName]);

  const dishCount = (id: string) => db.products.filter((p) => p.categoryId === id && p.available).length;

  return (
    <div className="space-y-6">
      <header className="space-y-1.5">
        <h1 className="font-display text-[26px] font-extrabold leading-none tracking-tight">{t("categories")}</h1>
        <p className="text-[13px] text-muted-foreground">{t("menu_subtitle")}</p>
      </header>

      <SearchField value={query} onChange={setQuery} placeholder={t("search")} />

      {categories.length === 0 ? (
        <EmptyState
          icon={<LayoutGrid className="h-7 w-7" />}
          title={t("no_results")}
          description={t("no_results_desc")}
        />
      ) : (
        <section>
          <SectionHeader
            title={t("full_menu")}
            icon={LayoutGrid}
            className="mb-3.5"
          />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {categories.map((c, i) => (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.3) }}
              >
                <Link
                  to={`/menu/c/${c.slug}`}
                  className="group relative block overflow-hidden rounded-3xl border border-border bg-card/60 transition duration-300 hover:-translate-y-0.5 hover:border-primary/45"
                >
                  <FoodImage
                    src={c.image}
                    alt={categoryName(c)}
                    className="aspect-[4/3] w-full"
                    imgClassName="transition duration-500 group-hover:scale-[1.08]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-black/5" />
                  <span className="absolute left-3 top-3 flex h-8 w-8 items-center justify-center rounded-xl border border-white/15 bg-black/45 text-base backdrop-blur">
                    {c.icon}
                  </span>
                  <div className="absolute inset-x-3 bottom-3">
                    <p className="font-display text-[15px] font-extrabold leading-tight text-white drop-shadow">
                      {categoryName(c)}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-white/75">
                      {dishCount(c.id)} {t("dishes")}
                      <ArrowRight className="h-3 w-3 transition group-hover:translate-x-0.5" />
                    </p>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      <CartBar />
    </div>
  );
}
