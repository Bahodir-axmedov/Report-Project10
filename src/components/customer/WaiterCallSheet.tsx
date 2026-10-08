import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, ReceiptText } from "lucide-react";
import { Button, Textarea } from "@/components/ui/primitives";
import { useI18n } from "@/lib/i18n";

export function WaiterCallSheet({
  open,
  onClose,
  onWaiter,
  onBill,
}: {
  open: boolean;
  onClose: () => void;
  onWaiter: (note: string) => void;
  onBill: (note: string) => void;
}) {
  const { t } = useI18n();
  const [note, setNote] = useState("");
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[120] flex items-end justify-center sm:items-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className="glass relative z-10 w-full max-w-md rounded-t-3xl p-5 sm:rounded-3xl"
          >
            <h3 className="font-display text-lg font-bold">{t("call_waiter")}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{t("call_waiter_desc")}</p>
            <Textarea
              className="mt-3"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("note_placeholder")}
            />
            <div className="mt-4 grid gap-2">
              <Button
                size="lg"
                onClick={() => {
                  onWaiter(note);
                  setNote("");
                }}
              >
                <Bell className="h-4 w-4" /> {t("call_waiter")}
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => {
                  onBill(note);
                  setNote("");
                }}
              >
                <ReceiptText className="h-4 w-4" /> {t("request_bill")}
              </Button>
            </div>
            <button onClick={onClose} className="mt-3 w-full py-2 text-sm text-muted-foreground">
              {t("cancel")}
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
