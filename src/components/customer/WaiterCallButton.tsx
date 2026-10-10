import { useState } from "react";
import { Bell } from "lucide-react";
import { api, useFeature } from "@/lib/store";
import { useCustomer } from "@/lib/customer";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/components/ui/toast";
import { WaiterCallSheet } from "./WaiterCallSheet";
import { cn } from "@/lib/utils";

export function WaiterCallButton({ variant = "fab" }: { variant?: "fab" | "sidebar" | "inline" }) {
  const { table } = useCustomer();
  const { t } = useI18n();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const waiterCallEnabled = useFeature("waiterCall");

  const callWaiter = (note: string) => {
    if (!table) return;
    api.createCall(table.id, "WAITER", note);
    toast({ type: "success", title: t("waiter_called"), body: t("call_waiter_desc") });
    setOpen(false);
  };
  const callBill = (note: string) => {
    if (!table) return;
    api.createCall(table.id, "BILL", note);
    toast({ type: "success", title: t("bill_requested"), body: t("bill_desc") });
    setOpen(false);
  };

  // Developer "Bo‘limlar" o‘chirilgan bo‘lsa yoki stol sessiya bo‘lmasa
  // (delivery/pre-order), tugma butunlay yo‘qoladi.
  if (!waiterCallEnabled || !table) return null;

  if (variant === "sidebar") {
    return (
      <>
        <button
          onClick={() => setOpen(true)}
          className="flex w-full items-center gap-3 rounded-2xl border border-primary/40 bg-primary/15 px-4 py-3 text-sm font-semibold text-primary transition hover:bg-primary/25"
        >
          <Bell className="h-5 w-5" /> {t("call_waiter")}
        </button>
        <WaiterCallSheet open={open} onClose={() => setOpen(false)} onWaiter={callWaiter} onBill={callBill} />
      </>
    );
  }

  if (variant === "inline") {
    return (
      <>
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 rounded-2xl border border-primary/40 bg-primary/15 px-4 py-3 text-sm font-semibold text-primary transition hover:bg-primary/25"
        >
          <Bell className="h-4 w-4" /> {t("call_waiter")}
        </button>
        <WaiterCallSheet open={open} onClose={() => setOpen(false)} onWaiter={callWaiter} onBill={callBill} />
      </>
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={t("call_waiter")}
        className={cn(
          "relative flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground transition active:scale-95",
          "shadow-[0_12px_36px_-8px_hsla(356,82%,46%,0.85)]"
        )}
      >
        <span className="absolute inset-0 rounded-full bg-primary/60 animate-pulse-ring" aria-hidden />
        <Bell className="relative h-6 w-6" />
      </button>
      <WaiterCallSheet open={open} onClose={() => setOpen(false)} onWaiter={callWaiter} onBill={callBill} />
    </>
  );
}
