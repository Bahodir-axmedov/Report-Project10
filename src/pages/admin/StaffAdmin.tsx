import { useState } from "react";
import { Pencil, Plus, ShieldCheck, Trash2, UserCog } from "lucide-react";
import { Badge, Button, Card, Field, Input, Modal, Select, Switch } from "@/components/ui/primitives";
import { StaffPageTitle } from "@/components/staff/StaffHeader";
import { useAuth } from "@/lib/auth";
import { api, useDB } from "@/lib/store";
import { useToast } from "@/components/ui/toast";
import { ALL_PERMISSIONS, ROLE_LABELS, permissionsForRole } from "@/lib/permissions";
import { cn, uid } from "@/lib/utils";
import { DEV_STAFF_USERNAME } from "@/lib/seed";
import type { PermissionKey, Role, Staff } from "@/lib/types";

/** Only two roles exist in the product: administrator and waiter. */
const ROLES: Role[] = ["ADMIN", "WAITER"];

function emptyStaff(): Staff {
  return {
    id: uid("stf"),
    name: "",
    phone: "",
    username: "",
    password: "",
    role: "WAITER",
    active: true,
    permissions: permissionsForRole("WAITER"),
    createdAt: Date.now(),
  };
}

export default function StaffAdmin() {
  const db = useDB();
  const { staff: me } = useAuth();
  const { toast } = useToast();
  const [editing, setEditing] = useState<Staff | null>(null);

  const groups = Array.from(new Set(ALL_PERMISSIONS.map((p) => p.group)));
  // the hidden developer account never shows up in the admin staff list
  const visibleStaff = db.staff.filter((s) => s.username !== DEV_STAFF_USERNAME);

  return (
    <div className="space-y-5">
      <StaffPageTitle
        title="Xodimlar va rollar"
        subtitle={`${visibleStaff.length} xodim · 2 rol (Administrator, Ofitsant)`}
        action={
          <Button onClick={() => setEditing(emptyStaff())}>
            <Plus className="h-4 w-4" /> Xodim qo‘shish
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visibleStaff.map((s) => (
          <Card key={s.id} className="p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/15 font-display text-lg font-bold text-primary">
                {s.name.slice(0, 1)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{s.name}</p>
                <p className="text-xs text-muted-foreground">{s.phone}</p>
              </div>
              <Badge tone={s.role === "ADMIN" ? "primary" : "default"}>{ROLE_LABELS[s.role]}</Badge>
            </div>
            <div className="mt-3 flex items-center justify-between rounded-xl bg-secondary/40 px-3 py-2 text-xs">
              <span className="text-muted-foreground">@{s.username}</span>
              <Badge tone={s.active ? "success" : "danger"}>{s.active ? "Faol" : "Bloklangan"}</Badge>
            </div>
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="outline" className="flex-1" onClick={() => setEditing({ ...s, password: "" })}>
                <Pencil className="h-3.5 w-3.5" /> Tahrirlash
              </Button>
              <Button
                size="sm"
                variant="ghost"
                aria-label="O‘chirish"
                disabled={s.id === me?.id}
                onClick={() => {
                  if (!me) return;
                  api.deleteStaff(s.id, me);
                  toast({ type: "info", title: "O‘chirildi" });
                }}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <Card className="p-5">
        <h2 className="flex items-center gap-2 font-display text-base font-bold">
          <ShieldCheck className="h-4 w-4 text-primary" /> Rol ruxsatlari
        </h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-xs">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="pb-2">Ruxsat</th>
                {ROLES.map((r) => (
                  <th key={r} className="pb-2 text-center">{ROLE_LABELS[r]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ALL_PERMISSIONS.map((p) => (
                <tr key={p.key} className="border-t border-border">
                  <td className="py-1.5">
                    <span className="font-medium">{p.group}</span>
                    <span className="ml-2 text-muted-foreground">{p.label}</span>
                  </td>
                  {ROLES.map((r) => {
                    const ok = permissionsForRole(r).includes(p.key);
                    return (
                      <td key={r} className="py-1.5 text-center">
                        <span className={cn("inline-block h-2.5 w-2.5 rounded-full", ok ? "bg-[hsl(var(--success))]" : "bg-border")} />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing && db.staff.some((s) => s.id === editing.id) ? "Xodimni tahrirlash" : "Yangi xodim"}
        size="lg"
        footer={
          <Button
            className="w-full"
            onClick={() => {
              if (!editing || !me) return;
              // empty password while editing = keep the stored (hashed) one
              const existing = db.staff.find((x) => x.id === editing.id);
              const password = editing.password || existing?.password || "";
              if (!editing.name || !editing.username || !password) {
                toast({ type: "error", title: "Ism, login va parolni kiriting" });
                return;
              }
              api.saveStaff({ ...editing, password }, me);
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
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="To‘liq ism">
                <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </Field>
              <Field label="Telefon">
                <Input value={editing.phone} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} placeholder="+998 90 000 00 00" />
              </Field>
              <Field label="Login">
                <Input value={editing.username} onChange={(e) => setEditing({ ...editing, username: e.target.value })} autoCapitalize="none" />
              </Field>
              <Field label="Parol">
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={editing.password}
                  placeholder={db.staff.some((x) => x.id === editing.id) ? "Bo‘sh qoldirsangiz o‘zgarmaydi" : "Parol"}
                  onChange={(e) => setEditing({ ...editing, password: e.target.value })}
                />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Rol">
                <Select
                  value={editing.role}
                  onChange={(e) => {
                    const role = e.target.value as Role;
                    setEditing({ ...editing, role, permissions: permissionsForRole(role) });
                  }}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </Select>
              </Field>
              <label className="flex items-end justify-between rounded-xl border border-border bg-secondary/40 px-3 py-2.5 text-sm">
                <span>Faol</span>
                <Switch checked={editing.active} onChange={(v) => setEditing({ ...editing, active: v })} label="Faol" />
              </label>
            </div>

            <div>
              <p className="mb-2 flex items-center gap-2 text-sm font-bold">
                <UserCog className="h-4 w-4 text-primary" /> Ruxsatlar matritsasi
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {groups.map((g) => (
                  <div key={g} className="rounded-2xl border border-border bg-secondary/30 p-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{g}</p>
                    <div className="mt-2 space-y-1.5">
                      {ALL_PERMISSIONS.filter((p) => p.group === g).map((p) => {
                        const checked = editing.permissions.includes(p.key);
                        return (
                          <label key={p.key} className="flex items-center justify-between text-sm">
                            <span>{p.label}</span>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                setEditing({
                                  ...editing,
                                  permissions: checked
                                    ? editing.permissions.filter((k) => k !== p.key)
                                    : [...editing.permissions, p.key as PermissionKey],
                                })
                              }
                              className="h-4 w-4 accent-[hsl(var(--primary))]"
                            />
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
