import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Button, Card, Field, Input, Modal, Select, Switch, Textarea } from "@/components/ui/primitives";
import { StaffPageTitle } from "@/components/staff/StaffHeader";
import { FoodImage } from "@/components/FoodImage";
import { ImagePicker } from "@/components/ImagePicker";
import { useAuth } from "@/lib/auth";
import { api, useDB } from "@/lib/store";
import { useToast } from "@/components/ui/toast";
import { fmtNumber, uid } from "@/lib/utils";
import type { Category, Product } from "@/lib/types";

function emptyProduct(categoryId: string): Product {
  return {
    id: uid("prd"),
    categoryId,
    nameUz: "",
    nameRu: "",
    nameEn: "",
    descriptionUz: "",
    descriptionRu: "",
    descriptionEn: "",
    price: 0,
    cost: 0,
    image: "",
    ingredients: "",
    allergens: "",
    calories: 0,
    proteins: 0,
    fats: 0,
    carbs: 0,
    weight: 0,
    available: true,
    isPopular: false,
    isNew: false,
    isPromotion: false,
    sortOrder: 999,
    rating: 4.5,
    ratingCount: 0,
  };
}

export function ProductsAdmin() {
  const db = useDB();
  const { staff } = useAuth();
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("all");
  const [editing, setEditing] = useState<Product | null>(null);

  const list = useMemo(() => {
    const q = query.toLowerCase();
    return db.products
      .filter((p) => (cat === "all" ? true : p.categoryId === cat))
      .filter((p) => !q || p.nameUz.toLowerCase().includes(q) || p.nameRu.toLowerCase().includes(q))
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [db.products, query, cat]);

  return (
    <div className="space-y-5">
      <StaffPageTitle
        title="Mahsulotlar"
        subtitle={`${db.products.length} ta mahsulot`}
        action={
          <Button onClick={() => setEditing(emptyProduct(db.categories[0]?.id ?? ""))}>
            <Plus className="h-4 w-4" /> Mahsulot qo‘shish
          </Button>
        }
      />

      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Mahsulot qidirish..." className="pl-9" />
        </div>
        <Select value={cat} onChange={(e) => setCat(e.target.value)} className="w-[200px]">
          <option value="all">Barcha kategoriyalar</option>
          {db.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nameUz}
            </option>
          ))}
        </Select>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="bg-secondary/60 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Mahsulot</th>
              <th className="px-4 py-3">Kategoriya</th>
              <th className="px-4 py-3">Narx</th>
              <th className="px-4 py-3">Tannarx</th>
              <th className="px-4 py-3">Chegirma</th>
              <th className="px-4 py-3">Mavjud</th>
              <th className="px-4 py-3">Teglar</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {list.slice(0, 200).map((p) => (
              <tr key={p.id} className="border-t border-border hover:bg-white/[0.02]">
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-3">
                    <FoodImage src={p.image} alt={p.nameRu} className="h-10 w-10 rounded-lg" />
                    <div>
                      <p className="font-semibold">{p.nameRu}</p>
                      <p className="text-[11px] text-muted-foreground">{p.weight} g · {p.calories} kkal</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">
                  {db.categories.find((c) => c.id === p.categoryId)?.nameRu ?? "—"}
                </td>
                <td className="px-4 py-2.5">
                  <div className="font-semibold">{fmtNumber(p.price)}</div>
                  {p.oldPrice && p.oldPrice > p.price && (
                    <div className="flex items-center gap-1.5 text-[11px]">
                      <span className="text-muted-foreground line-through">{fmtNumber(p.oldPrice)}</span>
                      <span className="font-bold text-[hsl(var(--warning))]">
                        −{Math.round(((p.oldPrice - p.price) / p.oldPrice) * 100)}%
                      </span>
                    </div>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  <input
                    type="number"
                    min={0}
                    step={500}
                    defaultValue={p.cost}
                    onBlur={(e) => {
                      const v = Number(e.target.value);
                      if (!staff || !Number.isFinite(v) || v === p.cost) return;
                      api.setProductCost(p.id, v, staff);
                      toast({ type: "success", title: `Tannarx saqlandi: ${fmtNumber(v)}` });
                    }}
                    className="h-9 w-24 rounded-xl border border-border bg-secondary/60 px-2.5 text-sm"
                    aria-label={`${p.nameRu} tannarxi`}
                  />
                </td>
                <td className="px-4 py-2.5">
                  <Select
                    value=""
                    onChange={(e) => {
                      if (!staff) return;
                      const pct = Number(e.target.value);
                      api.setProductDiscount(p.id, pct, staff);
                      toast({
                        type: pct ? "success" : "info",
                        title: pct ? `−${pct}% chegirma qo‘yildi` : "Chegirma olib tashlandi",
                      });
                    }}
                    className="h-9 w-[124px] text-xs"
                    aria-label={`${p.nameRu} chegirma`}
                  >
                    <option value="">Chegirma…</option>
                    {[5, 10, 15, 20, 25, 30, 40, 50].map((pct) => (
                      <option key={pct} value={pct}>
                        −{pct}%
                      </option>
                    ))}
                    <option value={0}>Olib tashlash</option>
                  </Select>
                </td>
                <td className="px-4 py-2.5">
                  <Switch
                    checked={p.available}
                    onChange={(v) => staff && api.setProductAvailability(p.id, v, staff)}
                    label="Mavjud"
                  />
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex gap-1">
                    {p.isPopular && <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold text-primary">TOP</span>}
                    {p.isNew && <span className="rounded bg-white px-1.5 py-0.5 text-[10px] font-bold text-black">NEW</span>}
                    {p.isPromotion && <span className="rounded bg-[hsl(var(--warning))]/20 px-1.5 py-0.5 text-[10px] font-bold text-[hsl(var(--warning))]">%</span>}
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex justify-end gap-1">
                    <Button size="icon" variant="ghost" onClick={() => setEditing(p)} aria-label="Tahrirlash">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="O‘chirish"
                      onClick={() => {
                        if (!staff) return;
                        api.deleteProduct(p.id, staff);
                        toast({ type: "info", title: "O‘chirildi" });
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing && db.products.some((p) => p.id === editing.id) ? "Mahsulotni tahrirlash" : "Yangi mahsulot"}
        size="lg"
        footer={
          <Button
            className="w-full"
            onClick={() => {
              if (!editing || !staff) return;
              if (!editing.nameUz || !editing.nameRu || editing.price <= 0) {
                toast({ type: "error", title: "Nom va narxni kiriting" });
                return;
              }
              const ok = api.saveProduct(editing, staff);
              if (!ok) {
                toast({
                  type: "error",
                  title: "Saqlanmadi — xotira to‘ldi",
                  body: "Rasm hajmini kamaytiring yoki keraksiz rasmlarni o‘chiring.",
                });
                return;
              }
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
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Nomi (UZ)">
                <Input value={editing.nameUz} onChange={(e) => setEditing({ ...editing, nameUz: e.target.value })} />
              </Field>
              <Field label="Nomi (RU)">
                <Input value={editing.nameRu} onChange={(e) => setEditing({ ...editing, nameRu: e.target.value })} />
              </Field>
              <Field label="Nomi (EN)">
                <Input value={editing.nameEn} onChange={(e) => setEditing({ ...editing, nameEn: e.target.value })} />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Kategoriya">
                <Select value={editing.categoryId} onChange={(e) => setEditing({ ...editing, categoryId: e.target.value })}>
                  {db.categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nameUz}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Narx (so‘m)">
                <Input type="number" value={editing.price} onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })} />
              </Field>
              <Field label="Eski narx">
                <Input
                  type="number"
                  value={editing.oldPrice ?? ""}
                  onChange={(e) => setEditing({ ...editing, oldPrice: e.target.value ? Number(e.target.value) : undefined })}
                />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Tannarx (so‘m) — foyda hisobi uchun">
                <Input
                  type="number"
                  value={editing.cost}
                  onChange={(e) => setEditing({ ...editing, cost: Number(e.target.value) })}
                />
              </Field>
              <div className="flex items-end rounded-xl border border-border bg-secondary/30 px-3 py-2.5 text-xs text-muted-foreground">
                Foyda: {fmtNumber(Math.max(0, editing.price - editing.cost))} so‘m
                {editing.price > 0 && ` · ${Math.round((1 - editing.cost / editing.price) * 100)}% marja`}
              </div>
            </div>
            <ImagePicker
              label="Rasm"
              value={editing.image}
              onChange={(v) => setEditing({ ...editing, image: v })}
            />
            <Field label="Tavsif (UZ)">
              <Textarea value={editing.descriptionUz} onChange={(e) => setEditing({ ...editing, descriptionUz: e.target.value })} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Tarkibi">
                <Input value={editing.ingredients} onChange={(e) => setEditing({ ...editing, ingredients: e.target.value })} />
              </Field>
              <Field label="Allergenlar">
                <Input value={editing.allergens} onChange={(e) => setEditing({ ...editing, allergens: e.target.value })} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <Field label="Kkal">
                <Input type="number" value={editing.calories} onChange={(e) => setEditing({ ...editing, calories: Number(e.target.value) })} />
              </Field>
              <Field label="Oqsil">
                <Input type="number" value={editing.proteins} onChange={(e) => setEditing({ ...editing, proteins: Number(e.target.value) })} />
              </Field>
              <Field label="Yog‘">
                <Input type="number" value={editing.fats} onChange={(e) => setEditing({ ...editing, fats: Number(e.target.value) })} />
              </Field>
              <Field label="Uglevod">
                <Input type="number" value={editing.carbs} onChange={(e) => setEditing({ ...editing, carbs: Number(e.target.value) })} />
              </Field>
              <Field label="Og‘irlik (g)">
                <Input type="number" value={editing.weight} onChange={(e) => setEditing({ ...editing, weight: Number(e.target.value) })} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {([
                ["available", "Mavjud"],
                ["isPopular", "Mashhur"],
                ["isNew", "Yangi"],
                ["isPromotion", "Aksiya"],
              ] as const).map(([key, label]) => (
                <label key={key} className="flex items-center justify-between rounded-xl border border-border bg-secondary/40 px-3 py-2.5 text-sm">
                  {label}
                  <Switch
                    checked={editing[key]}
                    onChange={(v) => setEditing({ ...editing, [key]: v })}
                    label={label}
                  />
                </label>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export function CategoriesAdmin() {
  const db = useDB();
  const { staff } = useAuth();
  const { toast } = useToast();
  const [editing, setEditing] = useState<Category | null>(null);

  const cats = [...db.categories].sort((a, b) => a.sortOrder - b.sortOrder);

  const move = (c: Category, dir: -1 | 1) => {
    if (!staff) return;
    api.saveCategory({ ...c, sortOrder: c.sortOrder + dir }, staff);
  };

  return (
    <div className="space-y-5">
      <StaffPageTitle
        title="Kategoriyalar"
        subtitle={`${db.categories.length} kategoriya`}
        action={
          <Button
            onClick={() =>
              setEditing({
                id: uid("cat"),
                nameUz: "",
                nameRu: "",
                nameEn: "",
                slug: "",
                icon: "🍣",
                image: "",
                sortOrder: db.categories.length,
                visible: true,
              })
            }
          >
            <Plus className="h-4 w-4" /> Kategoriya qo‘shish
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cats.map((c) => (
          <Card key={c.id} className="flex items-center gap-3 p-3">
            <FoodImage src={c.image} alt={c.nameUz} className="h-14 w-14 rounded-xl" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{c.nameUz}</p>
              <p className="text-xs text-muted-foreground">
                {c.nameRu} · {db.products.filter((p) => p.categoryId === c.id).length} taom
              </p>
            </div>
            <div className="flex flex-col gap-1">
              <button onClick={() => move(c, -1)} className="rounded p-1 text-muted-foreground hover:bg-white/5" aria-label="Yuqoriga">
                <ArrowUp className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => move(c, 1)} className="rounded p-1 text-muted-foreground hover:bg-white/5" aria-label="Pastga">
                <ArrowDown className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="flex flex-col gap-1">
              <Button size="icon" variant="ghost" onClick={() => setEditing(c)} aria-label="Tahrirlash">
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                aria-label="O‘chirish"
                onClick={() => {
                  if (!staff) return;
                  api.deleteCategory(c.id, staff);
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
        title="Kategoriya"
        footer={
          <Button
            className="w-full"
            onClick={() => {
              if (!editing || !staff) return;
              if (!editing.nameUz) {
                toast({ type: "error", title: "Nom kiriting" });
                return;
              }
              const slug = editing.slug || editing.nameUz.toLowerCase().replace(/\s+/g, "-");
              const ok = api.saveCategory({ ...editing, slug }, staff);
              if (!ok) {
                toast({
                  type: "error",
                  title: "Saqlanmadi — xotira to‘ldi",
                  body: "Rasm hajmini kamaytiring yoki keraksiz rasmlarni o‘chiring.",
                });
                return;
              }
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
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Nomi (UZ)">
                <Input value={editing.nameUz} onChange={(e) => setEditing({ ...editing, nameUz: e.target.value })} />
              </Field>
              <Field label="Nomi (RU)">
                <Input value={editing.nameRu} onChange={(e) => setEditing({ ...editing, nameRu: e.target.value })} />
              </Field>
              <Field label="Nomi (EN)">
                <Input value={editing.nameEn} onChange={(e) => setEditing({ ...editing, nameEn: e.target.value })} />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Emoji / ikonka">
                <Input value={editing.icon} onChange={(e) => setEditing({ ...editing, icon: e.target.value })} />
              </Field>
              <Field label="Slug">
                <Input value={editing.slug} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} placeholder="rolls" />
              </Field>
            </div>
            <ImagePicker
              label="Rasm"
              emoji={editing.icon}
              value={editing.image}
              onChange={(v) => setEditing({ ...editing, image: v })}
            />
            <label className="flex items-center justify-between rounded-xl border border-border bg-secondary/40 px-3 py-2.5 text-sm">
              Ko‘rinadi
              <Switch checked={editing.visible} onChange={(v) => setEditing({ ...editing, visible: v })} label="Ko‘rinadi" />
            </label>
          </div>
        )}
      </Modal>
    </div>
  );
}

