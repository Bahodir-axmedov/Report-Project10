import { Link, useNavigate } from "react-router-dom";
import { Bell, Heart, LogOut, MapPin, Phone, Volume2 } from "lucide-react";
import { Brand } from "@/components/Brand";
import { Button, Card, Switch } from "@/components/ui/primitives";
import { LanguageSwitcher } from "@/components/customer/LanguageSwitcher";
import { FoodImage } from "@/components/FoodImage";
import { useCustomer } from "@/lib/customer";
import { useFavorites } from "@/lib/favorites";
import { useI18n } from "@/lib/i18n";
import { useNotify } from "@/lib/notifications";
import { useDB, useFeature } from "@/lib/store";
import { fmtDateTime } from "@/lib/utils";

export default function Profile() {
  const db = useDB();
  const { table, session, leave } = useCustomer();
  const { t } = useI18n();
  const favorites = useFavorites();
  const showFavorites = useFeature("favorites");
  const { settings, setSettings, enable } = useNotify();
  const navigate = useNavigate();

  const favProducts = db.products.filter((p) => favorites.includes(p.id));
  const settingsData = db.settings;

  return (
    <div className="space-y-5">
      <div className="flex flex-col items-center gap-3 rounded-3xl border border-border bg-card/60 p-6 text-center">
        <Brand size="lg" />
        <div>
          <p className="font-display text-xl font-extrabold">
            {table ? `${t("table")} №${table.number}` : "Mehmon"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {session ? `Sessiya: ${fmtDateTime(session.createdAt)}` : "QR kod orqali kiring"}
          </p>
        </div>
        {table && (
          <div className="flex items-center gap-2 rounded-full border border-primary/40 bg-primary/15 px-3 py-1 text-xs font-bold text-primary">
            <MapPin className="h-3.5 w-3.5" /> {table.zone} · {table.seats} {t("seats")}
          </div>
        )}
      </div>

      <Card className="p-5">
        <h2 className="text-sm font-bold">{t("lang")}</h2>
        <div className="mt-3">
          <LanguageSwitcher />
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <Bell className="h-4 w-4 text-primary" /> {t("notifications")}
        </h2>
        <div className="mt-4 space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Volume2 className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-semibold">Ovozli bildirishnoma</p>
                <p className="text-xs text-muted-foreground">Buyurtma yangilanganda ovoz</p>
              </div>
            </div>
            <Switch checked={settings.sound} onChange={(v) => setSettings({ sound: v })} label="Ovoz" />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Bell className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-semibold">Brauzer bildirishnomasi</p>
                <p className="text-xs text-muted-foreground">Tizim bildirishnomalari</p>
              </div>
            </div>
            <Switch
              checked={settings.browser}
              onChange={(v) => (v ? void enable() : setSettings({ browser: false }))}
              label="Bildirishnoma"
            />
          </div>
        </div>
      </Card>

      {showFavorites && (
      <Card className="p-5">
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <Heart className="h-4 w-4 text-primary" /> {t("favorites")}
        </h2>
        {favProducts.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Sevimli taomlar yo‘q</p>
        ) : (
          <div className="mt-3 grid grid-cols-3 gap-2.5 sm:grid-cols-4">
            {favProducts.slice(0, 8).map((p) => (
              <Link key={p.id} to={`/menu/p/${p.id}`} className="group">
                <FoodImage src={p.image} alt={p.nameRu} className="aspect-square w-full rounded-2xl border border-border" />
                <p className="mt-1.5 line-clamp-1 text-[11px] font-semibold">{p.nameRu}</p>
              </Link>
            ))}
          </div>
        )}
      </Card>
      )}

      <Card className="p-5">
        <h2 className="text-sm font-bold">{t("about")}</h2>
        <ul className="mt-3 space-y-2.5 text-sm text-muted-foreground">
          <li className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-primary" /> {settingsData.phone}
          </li>
          <li className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" /> {settingsData.address}
          </li>
          <li>🕒 {settingsData.workingHours}</li>
          <li>📸 {settingsData.instagram}</li>
        </ul>
      </Card>

      <div className="grid gap-2.5 sm:grid-cols-2">
        <Link to="/about">
          <Button variant="outline" size="lg" className="w-full">
            {t("about")}
          </Button>
        </Link>
        {table && (
          <Button
            variant="secondary"
            size="lg"
            className="w-full"
            onClick={() => {
              leave();
              navigate("/");
            }}
          >
            <LogOut className="h-4 w-4" /> Sessiyani yakunlash
          </Button>
        )}
      </div>
    </div>
  );
}
