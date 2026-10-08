import { Clock, Instagram, MapPin, Phone, Send, ShieldCheck, Sparkles, Truck } from "lucide-react";
import { Brand } from "@/components/Brand";
import { Button, Card } from "@/components/ui/primitives";
import { FoodImage } from "@/components/FoodImage";
import { useI18n } from "@/lib/i18n";
import { useDB } from "@/lib/store";

export default function About() {
  const db = useDB();
  const s = db.settings;
  const { t } = useI18n();

  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-3xl border border-border">
        <FoodImage src={db.categories[2]?.image} alt="YÜMI" className="aspect-[16/9] w-full" loading="eager" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        <div className="absolute inset-x-5 bottom-5">
          <Brand size="md" />
          <p className="mt-2 max-w-md text-sm text-muted-foreground">{s.description}</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="p-5">
          <h2 className="font-display text-base font-bold">{t("contacts")}</h2>
          <ul className="mt-3 space-y-3 text-sm">
            <li className="flex items-center gap-2.5">
              <Phone className="h-4 w-4 text-primary" /> {s.phone}
            </li>
            <li className="flex items-center gap-2.5">
              <Instagram className="h-4 w-4 text-primary" /> {s.instagram}
            </li>
            <li className="flex items-center gap-2.5">
              <Send className="h-4 w-4 text-primary" /> {s.telegram}
            </li>
          </ul>
        </Card>
        <Card className="p-5">
          <h2 className="font-display text-base font-bold">{t("address")}</h2>
          <p className="mt-3 flex items-start gap-2.5 text-sm text-muted-foreground">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {s.address}
          </p>
          <p className="mt-3 flex items-center gap-2.5 text-sm text-muted-foreground">
            <Clock className="h-4 w-4 text-primary" /> {s.workingHours}
          </p>
          <a href={s.mapsUrl} target="_blank" rel="noreferrer" className="mt-4 inline-block">
            <Button variant="secondary" size="sm">
              {t("open_map")}
            </Button>
          </a>
        </Card>
      </div>

      <Card className="p-5">
        <h2 className="font-display text-base font-bold">Nega YÜMI?</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Feature icon={ShieldCheck} title="Sifatli mahsulotlar" desc="Har kuni yangi masalliqlar" />
          <Feature icon={Sparkles} title="Professional oshpazlar" desc="Yapon mutaxassislari tajribasi" />
          <Feature icon={Truck} title="Tez xizmat" desc={s.deliveryInfo} />
        </div>
      </Card>

      <div className="rounded-3xl border border-border bg-card/60 p-6 text-center">
        <p className="font-display text-lg font-bold">{s.footerText}</p>
        <p className="mt-1 text-xs text-muted-foreground">YÜMI — Sushi &amp; Rolls</p>
      </div>
    </div>
  );
}

function Feature({ icon: Icon, title, desc }: { icon: typeof Clock; title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-border bg-secondary/40 p-4">
      <Icon className="h-5 w-5 text-primary" />
      <p className="mt-2.5 text-sm font-bold">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{desc}</p>
    </div>
  );
}
