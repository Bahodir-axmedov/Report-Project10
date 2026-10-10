import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ShoppingBag } from "lucide-react";
import { useCart } from "@/lib/cart";
import { useCustomer } from "@/lib/customer";
import { useI18n } from "@/lib/i18n";
import { useDB } from "@/lib/store";
import { fmtNumber } from "@/lib/utils";

/** Sticky "continue order" bar shown at the bottom of every menu screen. */
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
