import { motion } from "framer-motion";
import { Heart, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { FoodImage } from "@/components/FoodImage";
import { QuantityStepper } from "@/components/customer/menu";
import { useI18n } from "@/lib/i18n";
import type { Product } from "@/lib/types";
import { cn, fmtNumber } from "@/lib/utils";

/**
 * Product cards follow the menu reference — a white card holding the dish photo,
 * the price in bold with a red add button and the dish name underneath — refined
 * with aligned rows, a favourite chip and an in-cart quantity stepper.
 */

export function FavoriteButton({
  active,
  onClick,
  className,
}: {
  active: boolean;
  onClick: (e: React.MouseEvent) => void;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={active ? "Sevimlilardan olib tashlash" : "Sevimlilarga qo‘shish"}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur transition hover:bg-black/60 active:scale-90",
        active && "text-primary",
        className
      )}
    >
      <Heart className={cn("h-4 w-4", active && "fill-primary")} />
    </button>
  );
}

function DiscountBadge({ percent }: { percent: number }) {
  return (
    <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-extrabold text-primary-foreground shadow-sm">
      −{percent}%
    </span>
  );
}

export function ProductCard({
  product,
  onAdd,
  favorite,
  onToggleFavorite,
  index = 0,
  variant = "menu",
  qty = 0,
  onInc,
  onDec,
}: {
  product: Product;
  onAdd: () => void;
  favorite?: boolean;
  onToggleFavorite?: () => void;
  index?: number;
  variant?: "menu" | "row";
  /** current quantity already in the cart (renders a stepper instead of “+”) */
  qty?: number;
  onInc?: () => void;
  onDec?: () => void;
}) {
  const { localizedName, t } = useI18n();
  const name = localizedName(product);
  const hasDiscount = !!product.oldPrice && product.oldPrice > product.price;
  const discountPct = hasDiscount ? Math.round((1 - product.price / product.oldPrice!) * 100) : 0;

  if (variant === "row") {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-card/60 p-2.5 transition hover:border-primary/30">
        <Link to={`/menu/p/${product.id}`} className="shrink-0">
          <FoodImage src={product.image} alt={name} className="h-16 w-16 rounded-xl" />
        </Link>
        <div className="min-w-0 flex-1">
          <Link to={`/menu/p/${product.id}`} className="line-clamp-1 text-sm font-semibold">
            {name}
          </Link>
          <p className="mt-0.5 text-xs text-muted-foreground">{product.weight} g</p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className={cn("text-sm font-bold", hasDiscount && "text-primary")}>
              {fmtNumber(product.price)} so‘m
            </span>
            {hasDiscount && (
              <span className="text-xs text-muted-foreground line-through">{fmtNumber(product.oldPrice!)}</span>
            )}
          </div>
        </div>
        {qty > 0 && onInc && onDec ? (
          <QuantityStepper qty={qty} onInc={onInc} onDec={onDec} size="sm" />
        ) : (
          <button
            onClick={onAdd}
            aria-label={`${name} — savatga qo‘shish`}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition active:scale-95 hover:brightness-110"
          >
            <Plus className="h-5 w-5" />
          </button>
        )}
      </div>
    );
  }

  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.3), duration: 0.35 }}
      className="group relative flex flex-col overflow-hidden rounded-2xl bg-white shadow-[0_14px_34px_-24px_rgba(0,0,0,0.9)] ring-1 ring-black/[0.07] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_22px_46px_-24px_rgba(225,29,42,0.55)]"
    >
      <Link to={`/menu/p/${product.id}`} className="relative block overflow-hidden">
        <FoodImage
          src={product.image}
          alt={name}
          className="aspect-[4/3] w-full"
          imgClassName="transition duration-500 group-hover:scale-[1.07]"
        />
        <div className="absolute inset-x-0 top-0 flex items-start justify-between p-2.5">
          <div className="flex flex-col items-start gap-1">
            {discountPct > 0 && <DiscountBadge percent={discountPct} />}
            {product.isNew && (
              <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-extrabold text-neutral-900 shadow-sm">
                NEW
              </span>
            )}
            {!product.isNew && product.isPopular && (
              <span className="rounded-full bg-neutral-900/85 px-2 py-0.5 text-[10px] font-extrabold text-white shadow-sm">
                {t("hit")}
              </span>
            )}
          </div>
          {onToggleFavorite && (
            <FavoriteButton
              active={!!favorite}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onToggleFavorite();
              }}
            />
          )}
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-display text-[17px] font-extrabold leading-none tracking-tight text-neutral-900">
              {fmtNumber(product.price)}
              <span className="ml-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">so‘m</span>
            </p>
            {hasDiscount ? (
              <p className="mt-1 text-[11px] font-medium text-neutral-400 line-through">
                {fmtNumber(product.oldPrice!)}
              </p>
            ) : (
              <p className="mt-1 text-[11px] font-medium text-neutral-400">{product.weight} g</p>
            )}
          </div>

          {qty > 0 && onInc && onDec ? (
            <QuantityStepper qty={qty} onInc={onInc} onDec={onDec} size="sm" />
          ) : (
            <button
              onClick={onAdd}
              aria-label={`${name} — savatga qo‘shish`}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition hover:brightness-110 active:scale-90"
            >
              <Plus className="h-[18px] w-[18px]" />
            </button>
          )}
        </div>

        <Link
          to={`/menu/p/${product.id}`}
          className="mt-2 line-clamp-2 min-h-[34px] text-[13px] font-medium leading-snug text-neutral-700"
        >
          {name}
        </Link>
      </div>
    </motion.article>
  );
}
