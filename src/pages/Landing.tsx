import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  Bell,
  ChefHat,
  CreditCard,
  LayoutDashboard,
  QrCode,
  ScanLine,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Utensils,
  Zap,
} from "lucide-react";
import { Brand, LogoMark } from "@/components/Brand";
import { Button } from "@/components/ui/primitives";
import { FoodImage } from "@/components/FoodImage";
import { useDB } from "@/lib/store";

const STATS = [
  { value: "20+", label: "Stollar" },
  { value: "50+", label: "Taomlar" },
  { value: "3", label: "Til" },
  { value: "<1s", label: "Realtime" },
];

const MODULES = [
  {
    icon: Smartphone,
    title: "Mijoz ilovasi",
    desc: "QR skan → menyu → savat → buyurtma. Mobil uchun optimallashtirilgan, 3 tilli interfeys.",
    tag: "Customer",
  },
  {
    icon: Utensils,
    title: "Ofitsant paneli",
    desc: "Stollar xaritasi, chaqiruvlar, buyurtmalarni boshqarish va hisobni yopish — telefonda ham.",
    tag: "Waiter",
  },
  {
    icon: ChefHat,
    title: "Oshxona ekrani",
    desc: "Katta kartalar, minimal UI, realtime statuslar. Planshet uchun mo‘ljallangan.",
    tag: "Kitchen",
  },
  {
    icon: LayoutDashboard,
    title: "Super Admin",
    desc: "Analitika, hisobotlar, xodimlar, rollar, QR kodlar va restoran sozlamalari.",
    tag: "Admin",
  },
];

const FEATURES = [
  { icon: QrCode, title: "Xavfsiz QR kodlar", desc: "Har bir stol uchun unikal token. Mijoz stol raqamini almashtira olmaydi." },
  { icon: Zap, title: "Realtime yangilanish", desc: "Buyurtma statusi barcha panellarda bir zumda sinxronlanadi." },
  { icon: Bell, title: "Ovozli bildirishnomalar", desc: "Ofitsant chaqiruvi va tayyor buyurtmalar uchun tovush + ovoz." },
  { icon: CreditCard, title: "To‘lovni yopish", desc: "Naqd, bank kartasi, terminal. Split bill bilan bo‘lib to‘lash." },
  { icon: BarChart3, title: "Chuqur analitika", desc: "Kunlik, haftalik hisobotlar real ma’lumotlardan hisoblanadi." },
  { icon: ShieldCheck, title: "Rollar va ruxsatlar", desc: "6 xil rol, har bir amal uchun ruxsat matritsasi va audit loglar." },
];

const FLOW = [
  { step: "01", title: "QR skan", desc: "Mijoz stol ustidagi QR kodni skanerlaydi." },
  { step: "02", title: "Til va menyu", desc: "Til tanlanadi, stol avtomatik aniqlanadi." },
  { step: "03", title: "Buyurtma", desc: "Savat to‘ldiriladi va buyurtma yuboriladi." },
  { step: "04", title: "Oshxona", desc: "Buyurtma oshxona ekraniga realtime tushadi." },
  { step: "05", title: "Yetkazish", desc: "Ofitsant tayyor taomni stolga yetkazadi." },
  { step: "06", title: "To‘lov", desc: "Hisob yopiladi, stol bo‘shatiladi." },
];

export default function Landing() {
  const db = useDB();
  const products = db.products.filter((p) => p.available).slice(0, 6);
  const settings = db.settings;

  return (
    <div className="min-h-full overflow-x-hidden bg-background">
      {/* Ambient background */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -left-40 top-[-10rem] h-[34rem] w-[34rem] rounded-full bg-primary/20 blur-[140px]" />
        <div className="absolute right-[-14rem] top-[24rem] h-[30rem] w-[30rem] rounded-full bg-[#7a0d18]/40 blur-[150px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,transparent_0%,#08080a_70%)]" />
      </div>

      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-white/5 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Brand />
          <nav className="hidden items-center gap-7 text-sm font-medium text-muted-foreground md:flex">
            <a href="#modules" className="transition hover:text-foreground">Modullar</a>
            <a href="#features" className="transition hover:text-foreground">Imkoniyatlar</a>
            <a href="#flow" className="transition hover:text-foreground">Jarayon</a>
            <a href="#menu" className="transition hover:text-foreground">Menyu</a>
          </nav>
          <Link to="/t/demo">
            <Button size="sm">
              Buyurtma berish <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative mx-auto max-w-6xl px-4 pb-16 pt-12 sm:pt-20">
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1.5 text-xs font-semibold text-primary"
            >
              <Sparkles className="h-3.5 w-3.5" /> Restaurant Management & Ordering System
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="mt-5 font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-balance sm:text-5xl lg:text-6xl"
            >
              Sushi &amp; Rolls restorani uchun
              <span className="block text-primary">to‘liq boshqaruv tizimi</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg"
            >
              QR orqali buyurtma, realtime oshxona ekrani, ofitsant paneli va professional analitika —
              barchasi bitta tizimda. YÜMI restoran jarayonini boshidan oxirigacha avtomatlashtiradi.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="mt-8 flex flex-wrap items-center gap-3"
            >
              <Link to="/t/demo">
                <Button size="lg">
                  <ScanLine className="h-5 w-5" /> QR kodni sinab ko‘rish
                </Button>
              </Link>
              <a href="#menu">
                <Button size="lg" variant="outline">
                  Menyu va narxlar
                </Button>
              </a>
            </motion.div>
            <div className="mt-10 grid max-w-lg grid-cols-4 gap-4">
              {STATS.map((s) => (
                <div key={s.label}>
                  <div className="font-display text-2xl font-extrabold text-primary sm:text-3xl">{s.value}</div>
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Hero visual */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.6 }}
            className="relative mx-auto w-full max-w-md"
          >
            <div className="relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-card/60 p-3 shadow-[0_40px_120px_-30px_hsla(356,82%,46%,0.5)]">
              <FoodImage src={products[1]?.image} alt="Philadelphia roll" className="aspect-[4/5] w-full rounded-[2rem]" loading="eager" />
              <div className="absolute inset-x-6 bottom-6 rounded-2xl border border-white/10 bg-black/70 p-4 backdrop-blur-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] uppercase tracking-widest text-primary">Stol №5 · Buyurtma</p>
                    <p className="font-display text-lg font-bold">{products[1] ? products[1].nameRu : "Филадельфия"}</p>
                  </div>
                  <div className="rounded-full bg-primary px-3 py-1.5 text-sm font-bold text-primary-foreground">
                    100 000
                  </div>
                </div>
              </div>
              <div className="absolute right-6 top-6 flex items-center gap-2 rounded-full border border-white/10 bg-black/60 px-3 py-1.5 text-xs font-semibold backdrop-blur">
                <span className="h-2 w-2 animate-pulse rounded-full bg-[hsl(var(--success))]" />
                Realtime
              </div>
            </div>
            <div className="absolute -left-6 top-16 hidden rounded-2xl border border-white/10 bg-card/80 p-3 backdrop-blur-xl sm:block">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
                  <Bell className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-bold">Stol 5 chaqirmoqda</p>
                  <p className="text-[10px] text-muted-foreground">08:43</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Modules */}
      <section id="modules" className="mx-auto max-w-6xl px-4 py-16">
        <SectionHeading
          eyebrow="Tizim arxitekturasi"
          title="Bitta platforma — to‘rtta interfeys"
          subtitle="Har bir rol o‘z ekranida ishlaydi, lekin hamma real vaqtda sinxron."
        />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {MODULES.map((m, i) => (
            <motion.div
              key={m.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.07 }}
              className="group relative overflow-hidden rounded-3xl border border-border bg-card/60 p-5 transition hover:border-primary/40"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                <m.icon className="h-6 w-6" />
              </div>
              <p className="mt-4 text-[10px] font-bold uppercase tracking-widest text-primary">{m.tag}</p>
              <h3 className="mt-1 font-display text-lg font-bold">{m.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{m.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Flow */}
      <section id="flow" className="border-y border-border bg-card/30 py-16">
        <div className="mx-auto max-w-6xl px-4">
          <SectionHeading
            eyebrow="Mijoz jarayoni"
            title="QR skandan to‘lovga qadar"
            subtitle="Har bir qadam avtomatlashtirilgan va real vaqtda kuzatiladi."
          />
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FLOW.map((f, i) => (
              <motion.div
                key={f.step}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="relative rounded-3xl border border-border bg-background/60 p-5"
              >
                <span className="font-display text-3xl font-extrabold text-primary/30">{f.step}</span>
                <h3 className="mt-2 font-display text-base font-bold">{f.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-4 py-16">
        <SectionHeading
          eyebrow="Imkoniyatlar"
          title="Restoran uchun zarur bo‘lgan hamma narsa"
          subtitle="Real backend logikasi: narx, status va ruxsatlar serverda tekshiriladi."
        />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="rounded-3xl border border-border bg-card/50 p-5"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary text-primary">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-display text-base font-bold">{f.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Menu preview */}
      <section id="menu" className="mx-auto max-w-6xl px-4 py-16">
        <SectionHeading
          eyebrow="Menyu"
          title="Mashhur taomlar"
          subtitle="Har bir taom uchun 3 tilda nom, tarkib, allergen va oziqlik qiymati."
        />
        <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {products.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="overflow-hidden rounded-3xl border border-border bg-card/60"
            >
              <FoodImage src={p.image} alt={p.nameRu} className="aspect-[4/3] w-full" />
              <div className="p-4">
                <p className="line-clamp-1 font-semibold">{p.nameRu}</p>
                <p className="mt-1 text-sm font-bold text-primary">
                  {new Intl.NumberFormat("ru-RU").format(p.price)} so‘m
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 pb-20">
        <div className="relative overflow-hidden rounded-[2.5rem] border border-primary/30 bg-gradient-to-br from-primary/25 via-card to-card p-8 sm:p-12">
          <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-primary/30 blur-[100px]" />
          <div className="relative max-w-2xl">
            <h2 className="font-display text-3xl font-extrabold sm:text-4xl">
              Restoraningizni bugun raqamlashtiring
            </h2>
            <p className="mt-4 text-muted-foreground">
              Demo hisoblar bilan tizimni hoziroq sinab ko‘ring — mijoz, ofitsant, oshxona va admin panellari to‘liq ishlaydi.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link to="/t/demo">
                <Button size="lg">
                  <QrCode className="h-5 w-5" /> Stol QR kodini ochish
                </Button>
              </Link>
              <a href="#modules">
                <Button size="lg" variant="outline">
                  Tizim modullari
                </Button>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card/30 py-12">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Brand />
            <p className="mt-4 max-w-xs text-sm text-muted-foreground">{settings.description}</p>
          </div>
          <div>
            <h4 className="text-sm font-bold">Aloqa</h4>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>{settings.phone}</li>
              <li>{settings.instagram}</li>
              <li>{settings.telegram}</li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-bold">Manzil</h4>
            <p className="mt-3 text-sm text-muted-foreground">{settings.address}</p>
          </div>
          <div>
            <h4 className="text-sm font-bold">Ish vaqti</h4>
            <p className="mt-3 text-sm text-muted-foreground">{settings.workingHours}</p>
            <a href={settings.mapsUrl} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm font-semibold text-primary">
              Google Maps →
            </a>
          </div>
        </div>
        <div className="mx-auto mt-10 flex max-w-6xl items-center justify-between border-t border-border px-4 pt-6 text-xs text-muted-foreground">
          <span>{settings.footerText}</span>
          <span className="flex items-center gap-2">
            <LogoMark className="h-4 w-4" /> YÜMI System
          </span>
        </div>
      </footer>
    </div>
  );
}

function SectionHeading({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="mx-auto max-w-2xl text-center"
    >
      <p className="text-xs font-bold uppercase tracking-[0.3em] text-primary">{eyebrow}</p>
      <h2 className="mt-3 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">{title}</h2>
      <p className="mt-3 text-muted-foreground">{subtitle}</p>
    </motion.div>
  );
}
