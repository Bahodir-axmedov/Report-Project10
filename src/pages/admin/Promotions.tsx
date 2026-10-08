import { useState } from "react";
import { Clock, Pencil, Percent, Plus, Trash2 } from "lucide-react";
import { Badge, Button, Card, Field, Input, Modal, Switch, Textarea } from "@/components/ui/primitives";
import { StaffPageTitle } from "@/components/staff/StaffHeader";
import { useAuth } from "@/lib/auth";
import { api, useDB } from "@/lib/store";
import { useToast } from "@/components/ui/toast";
import { uid } from "@/lib/utils";
import type { Promotion } from "@/lib/types";

export default function Promotions() {
  const db = useDB();
  const { staff } = useAuth();
  const { toast } = useToast();
  const [editing, setEditing] = useState<Promotion | null>(null);

  return (
    <div className="space-y-5">
      <StaffPageTitle
        title="Aksiyalar"
        subtitle="Chegirmalar, promokodlar va happy hours"
        action={
          <Button
            onClick={() =>
              setEditing({
                id: uid("prom"),
                title: "",
                description: "",
                discountPct: 10,
                active: true,
                from: "",
                to: "",
              })
            }
          >
            <Plus className="h-4 w-4" /> Aksiya qo‘shish
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {db.promotions.map((p) => (
          <Card key={p.id} className="relative overflow-hidden p-5">
            <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-primary/20 blur-2xl" />
            <div className="flex items-start justify-between">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                {p.happyHours ? <Clock className="h-5 w-5" /> : <Percent className="h-5 w-5" />}
              </div>
              <Badge tone={p.active ? "success" : "default"}>{p.active ? "Faol" : "Nofaol"}</Badge>
            </div>
            <p className="mt-3 font-display text-lg font-bold">{p.title || "—"}</p>
            <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Badge tone="primary">−{p.discountPct}%</Badge>
              {p.code && <Badge>Kod: {p.code}</Badge>}
              {p.happyHours && <Badge tone="warning">{p.from}–{p.to}</Badge>}
            </div>
            <div className="mt-4 flex gap-2">
              <Button size="sm" variant="outline" className="flex-1" onClick={() => setEditing(p)}>
                <Pencil className="h-3.5 w-3.5" /> Tahrirlash
              </Button>
              <Button
                size="sm"
                variant="ghost"
                aria-label="O‘chirish"
                onClick={() => {
                  if (!staff) return;
                  api.deletePromotion(p.id, staff);
                  toast({ type: "info", title: "O‘chirildi" });
                }}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title="Aksiya"
        footer={
          <Button
            className="w-full"
            onClick={() => {
              if (!editing || !staff) return;
              if (!editing.title) {
                toast({ type: "error", title: "Nom kiriting" });
                return;
              }
              api.savePromotion(editing, staff);
              toast({ type: "success", title: "Saqlandi" });
              setEditing(null);
            }}
          >
            Saqlash
          </Button>
        }
      >
        {editing && (
          <div className="space-y-3">
            <Field label="Nomi">
              <Input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} placeholder="Sushi Set -20%" />
            </Field>
            <Field label="Tavsif">
              <Textarea value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Chegirma %">
                <Input
                  type="number"
                  value={editing.discountPct}
                  onChange={(e) => setEditing({ ...editing, discountPct: Number(e.target.value) })}
                />
              </Field>
              <Field label="Promokod (ixtiyoriy)">
                <Input
                  value={editing.code ?? ""}
                  onChange={(e) => setEditing({ ...editing, code: e.target.value.toUpperCase() || undefined })}
                  placeholder="PROMO10"
                />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={editing.happyHours ? "Boshlanish (HH:MM)" : "Boshlanish sanasi"}>
                <Input value={editing.from} onChange={(e) => setEditing({ ...editing, from: e.target.value })} placeholder={editing.happyHours ? "12:00" : "2026-01-01"} />
              </Field>
              <Field label={editing.happyHours ? "Tugash (HH:MM)" : "Tugash sanasi"}>
                <Input value={editing.to} onChange={(e) => setEditing({ ...editing, to: e.target.value })} placeholder={editing.happyHours ? "16:00" : "2026-12-31"} />
              </Field>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/40 px-3 py-2.5 text-sm">
              Happy hours
              <Switch checked={!!editing.happyHours} onChange={(v) => setEditing({ ...editing, happyHours: v })} label="Happy hours" />
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/40 px-3 py-2.5 text-sm">
              Faol
              <Switch checked={editing.active} onChange={(v) => setEditing({ ...editing, active: v })} label="Faol" />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
