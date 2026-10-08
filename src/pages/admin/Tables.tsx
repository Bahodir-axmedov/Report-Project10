import { useState } from "react";
import { Download, Plus, Printer, QrCode, RefreshCw, Trash2 } from "lucide-react";
import { Button, Card, Field, Input, Modal, Select, Switch } from "@/components/ui/primitives";
import { StaffPageTitle } from "@/components/staff/StaffHeader";
import { TABLE_STATUS_META, TableTile } from "@/components/staff/widgets";
import { QRCodeImage, downloadQrPng, printQrCards, tableUrl } from "@/components/QRCodeImage";
import { useAuth } from "@/lib/auth";
import { api, useDB } from "@/lib/store";
import { useToast } from "@/components/ui/toast";
import { activeOrdersForTable } from "@/lib/reporting";
import { cn } from "@/lib/utils";
import type { RestaurantTable } from "@/lib/types";

export function TablesAdmin() {
  const db = useDB();
  const { staff } = useAuth();
  const { toast } = useToast();
  const [selected, setSelected] = useState<RestaurantTable | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [draft, setDraft] = useState({ number: db.tables.length + 1, seats: 4, zone: "Zal" });

  const sorted = [...db.tables].sort((a, b) => a.number - b.number);

  return (
    <div className="space-y-5">
      <StaffPageTitle
        title="Stollar"
        subtitle={`${db.tables.length} stol · ${db.tables.filter((t) => t.status !== "EMPTY").length} band`}
        action={
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> Stol qo‘shish
          </Button>
        }
      />

      <div className="flex flex-wrap gap-3 text-xs">
        {(Object.keys(TABLE_STATUS_META) as (keyof typeof TABLE_STATUS_META)[]).map((k) => (
          <span key={k} className="flex items-center gap-1.5 text-muted-foreground">
            <span className={cn("h-2.5 w-2.5 rounded-full", TABLE_STATUS_META[k].dot)} /> {TABLE_STATUS_META[k].label}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10">
        {sorted.map((t) => (
          <TableTile
            key={t.id}
            table={t}
            activeOrders={activeOrdersForTable(db, t.id).length}
            hasCall={db.calls.some((c) => c.tableId === t.id && c.status === "PENDING")}
            onClick={() => setSelected(t)}
          />
        ))}
      </div>

      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected ? `Stol №${selected.number}` : ""} size="md">
        {selected && (
          <div className="space-y-4">
            <div className="flex justify-center rounded-2xl border border-border bg-secondary/40 p-4">
              <QRCodeImage value={tableUrl(selected.qrToken)} size={180} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Stol raqami">
                <Input
                  type="number"
                  value={selected.number}
                  onChange={(e) => setSelected({ ...selected, number: Number(e.target.value) })}
                />
              </Field>
              <Field label="Joylar soni">
                <Input
                  type="number"
                  value={selected.seats}
                  onChange={(e) => setSelected({ ...selected, seats: Number(e.target.value) })}
                />
              </Field>
              <Field label="Zona">
                <Select value={selected.zone} onChange={(e) => setSelected({ ...selected, zone: e.target.value })}>
                  {["Zal", "Veranda", "VIP", "Terassa"].map((z) => (
                    <option key={z} value={z}>
                      {z}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Holat">
                <Select
                  value={selected.status}
                  onChange={(e) => setSelected({ ...selected, status: e.target.value as RestaurantTable["status"] })}
                >
                  <option value="EMPTY">Bo‘sh</option>
                  <option value="OCCUPIED">Band</option>
                  <option value="WAITING">Kutilmoqda</option>
                  <option value="BILL">Hisob</option>
                </Select>
              </Field>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-border bg-secondary/40 px-4 py-3">
              <span className="text-sm font-semibold">Stol faol</span>
              <Switch
                checked={selected.active}
                onChange={(v) => setSelected({ ...selected, active: v })}
                label="Faol"
              />
            </div>
            <div className="rounded-xl border border-border bg-secondary/40 p-3 text-xs text-muted-foreground">
              <p className="font-semibold text-foreground">QR URL</p>
              <p className="mt-1 break-all">{tableUrl(selected.qrToken)}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  if (!staff) return;
                  const token = api.regenerateQr(selected.id, staff);
                  setSelected({ ...selected, qrToken: token });
                  toast({ type: "success", title: "QR token yangilandi" });
                }}
              >
                <RefreshCw className="h-4 w-4" /> QR yangilash
              </Button>
              <Button size="sm" variant="secondary" onClick={() => void downloadQrPng(selected.qrToken, selected.number)}>
                <Download className="h-4 w-4" /> PNG yuklash
              </Button>
              <Button size="sm" variant="secondary" onClick={() => void printQrCards([{ number: selected.number, token: selected.qrToken }], db.settings.name)}>
                <Printer className="h-4 w-4" /> Chop etish
              </Button>
              <div className="flex-1" />
              <Button
                size="sm"
                variant="destructive"
                onClick={() => {
                  if (!staff) return;
                  api.deleteTable(selected.id, staff);
                  toast({ type: "info", title: "Stol o‘chirildi" });
                  setSelected(null);
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <Button
              className="w-full"
              onClick={() => {
                if (!staff) return;
                api.updateTable(selected.id, {
                  number: selected.number,
                  seats: selected.seats,
                  zone: selected.zone,
                  active: selected.active,
                  status: selected.status,
                }, staff);
                toast({ type: "success", title: "Saqlandi" });
                setSelected(null);
              }}
            >
              Saqlash
            </Button>
          </div>
        )}
      </Modal>

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Yangi stol"
        size="sm"
        footer={
          <Button
            className="w-full"
            onClick={() => {
              if (!staff) return;
              if (db.tables.some((t) => t.number === draft.number)) {
                toast({ type: "error", title: "Bu raqam band" });
                return;
              }
              const t = api.addTable({ number: draft.number, seats: draft.seats, zone: draft.zone }, staff);
              toast({ type: "success", title: `Stol №${t.number} qo‘shildi` });
              setDraft({ number: draft.number + 1, seats: 4, zone: "Zal" });
              setAddOpen(false);
            }}
          >
            <Plus className="h-4 w-4" /> Qo‘shish va QR yaratish
          </Button>
        }
      >
        <div className="space-y-3">
          <Field label="Stol raqami">
            <Input type="number" value={draft.number} onChange={(e) => setDraft({ ...draft, number: Number(e.target.value) })} />
          </Field>
          <Field label="Joylar soni">
            <Input type="number" value={draft.seats} onChange={(e) => setDraft({ ...draft, seats: Number(e.target.value) })} />
          </Field>
          <Field label="Zona">
            <Select value={draft.zone} onChange={(e) => setDraft({ ...draft, zone: e.target.value })}>
              {["Zal", "Veranda", "VIP", "Terassa"].map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </Select>
          </Field>
          <p className="text-xs text-muted-foreground">Yangi stol uchun xavfsiz QR token avtomatik yaratiladi.</p>
        </div>
      </Modal>
    </div>
  );
}

export function QrCodes() {
  const db = useDB();
  const { toast } = useToast();
  const [selected, setSelected] = useState<string[]>(db.tables.map((t) => t.id));

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const chosen = db.tables.filter((t) => selected.includes(t.id)).sort((a, b) => a.number - b.number);

  return (
    <div className="space-y-5">
      <StaffPageTitle
        title="QR kodlar"
        subtitle="Stollar uchun xavfsiz QR kodlarni yarating, yuklab oling va chop eting"
        action={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => setSelected(selected.length === db.tables.length ? [] : db.tables.map((t) => t.id))}
            >
              {selected.length === db.tables.length ? "Bekor qilish" : "Hammasini tanlash"}
            </Button>
            <Button
              onClick={() => {
                void printQrCards(chosen.map((t) => ({ number: t.number, token: t.qrToken })), db.settings.name);
                toast({ type: "info", title: "Chop etish oynasi ochildi", body: `${chosen.length} ta QR` });
              }}
              disabled={chosen.length === 0}
            >
              <Printer className="h-4 w-4" /> PDF / Chop etish
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {db.tables
          .slice()
          .sort((a, b) => a.number - b.number)
          .map((t) => (
            <Card key={t.id} className={cn("p-4 transition", selected.includes(t.id) && "border-primary/60")}>
              <label className="flex cursor-pointer items-center justify-between">
                <span className="font-display text-base font-bold">Stol №{t.number}</span>
                <input
                  type="checkbox"
                  checked={selected.includes(t.id)}
                  onChange={() => toggle(t.id)}
                  className="h-4 w-4 accent-[hsl(var(--primary))]"
                />
              </label>
              <div className="mt-3 flex justify-center rounded-2xl border border-border bg-white p-3">
                <QRCodeImage value={tableUrl(t.qrToken)} size={150} />
              </div>
              <p className="mt-2 truncate text-[11px] text-muted-foreground">{t.zone} · {t.seats} joy</p>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="secondary" className="flex-1" onClick={() => void downloadQrPng(t.qrToken, t.number)}>
                  <Download className="h-3.5 w-3.5" /> PNG
                </Button>
                <Button size="sm" variant="ghost" onClick={() => void printQrCards([{ number: t.number, token: t.qrToken }], db.settings.name)}>
                  <QrCode className="h-3.5 w-3.5" />
                </Button>
              </div>
            </Card>
          ))}
      </div>
      <p className="text-center text-xs text-muted-foreground">
        {chosen.length} ta stol tanlandi · jami {db.tables.length}
      </p>
    </div>
  );
}

