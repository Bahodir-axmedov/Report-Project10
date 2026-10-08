import { Minus, Plus, Search } from "lucide-react";
import { Link } from "react-router-dom";
import { FoodImage } from "@/components/FoodImage";
import { useI18n } from "@/lib/i18n";
import { useDB } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { Category } from "@/lib/types";

/** Consistent section heading used across every menu screen. */
export function SectionHeader({
  title,
  icon: Icon,
  action,
  className,
}: {
  title: string;
  icon?: typeof Search;
  action?: { label: string; to: string };
  className?: string;
}) {
  return (
    <div className={cn("mb-3 flex items-center gap-2.5", className)}>
      {Icon && (
        <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </span>
      )}
      <h2 className="flex-1 font-display text-lg font-extrabold tracking-tight">{title}</h2>
      {action && (
        <Link
          to={action.to}
          className="rounded-full border border-border bg-secondary/50 px-3 py-1.5 text-[11px] font-semibold text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}

/** Search field with the shared menu styling. */
export function SearchField({
  value,
  onChange,
  placeholder,
  className,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}) {
  const { t } = useI18n();
  return (
    <div className={cn("relative", className)}>
      <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? t("search_hint")}
        autoFocus={autoFocus}
        className="h-12 w-full rounded-2xl border border-border bg-secondary/50 pl-11 pr-4 text-sm text-foreground placeholder:text-muted-foreground transition focus:border-primary/50 focus:bg-secondary/70 focus:outline-none focus:ring-2 focus:ring-primary/20"
      />
    </div>
  );
}

/** Horizontal category rail — image tile + label, used on the menu home. */
export function CategoryRail({ categories, className }: { categories: Category[]; className?: string }) {
  const { categoryName } = useI18n();
  return (
    <div className={cn("no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1", className)}>
      {categories.map((c) => (
        <Link
          key={c.id}
          to={`/menu/c/${c.slug}`}
          className="group flex w-[88px] shrink-0 flex-col items-center gap-2"
        >
          <span className="relative block overflow-hidden rounded-2xl border border-border transition group-hover:-translate-y-0.5 group-hover:border-primary/50">
            <FoodImage
              src={c.image}
              alt={categoryName(c)}
              className="h-[74px] w-[74px]"
              imgClassName="transition duration-500 group-hover:scale-110"
            />
            <span className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" />
            <span className="absolute bottom-1 right-1 text-base leading-none">{c.icon}</span>
          </span>
          <span className="line-clamp-2 text-center text-[11px] font-semibold leading-tight">
            {categoryName(c)}
          </span>
        </Link>
      ))}
    </div>
  );
}

/** Quantity control shared by the card, the product page and the cart. */
export function QuantityStepper({
  qty,
  onInc,
  onDec,
  size = "md",
}: {
  qty: number;
  onInc: () => void;
  onDec: () => void;
  size?: "sm" | "md" | "lg";
}) {
  const dims = {
    sm: { box: "h-9 w-9", text: "text-sm", icon: "h-3.5 w-3.5", w: "w-6" },
    md: { box: "h-10 w-10", text: "text-base", icon: "h-4 w-4", w: "w-8" },
    lg: { box: "h-11 w-11", text: "text-lg", icon: "h-4 w-4", w: "w-10" },
  }[size];

  return (
    <div className="flex items-center gap-0.5 rounded-full bg-primary p-1 text-primary-foreground shadow-md">
      <button
        onClick={onDec}
        aria-label="Kamaytirish"
        className={cn(
          "flex items-center justify-center rounded-full transition hover:bg-black/15 active:scale-90",
          dims.box
        )}
      >
        <Minus className={dims.icon} />
      </button>
      <span className={cn("text-center font-display font-extrabold", dims.w, dims.text)}>{qty}</span>
      <button
        onClick={onInc}
        aria-label="Ko‘paytirish"
        className={cn(
          "flex items-center justify-center rounded-full transition hover:bg-black/15 active:scale-90",
          dims.box
        )}
      >
        <Plus className={dims.icon} />
      </button>
    </div>
  );
}

/** Small, reusable dish count badge (e.g. "12 ta taom"). */
export function DishCount({ categoryId }: { categoryId: string }) {
  const db = useDB();
  const { t } = useI18n();
  const count = db.products.filter((p) => p.categoryId === categoryId && p.available).length;
  return <>{`${count} ${t("dishes")}`}</>;
}
