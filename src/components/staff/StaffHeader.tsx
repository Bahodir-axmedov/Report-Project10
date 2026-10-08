import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, BellRing, Building2, CheckCheck, LogOut, Volume2, VolumeX, Mic, MicOff } from "lucide-react";
import { Brand } from "@/components/Brand";
import { Button } from "@/components/ui/primitives";
import { useAuth } from "@/lib/auth";
import { useNotify } from "@/lib/notifications";
import { api, useBranches, useDB } from "@/lib/store";
import { ROLE_LABELS } from "@/lib/permissions";
import { cn, fmtTime } from "@/lib/utils";

export function StaffHeader({
  title,
  audience,
  accent,
}: {
  title: string;
  audience: "admin" | "waiter" | "kitchen" | "cashier";
  accent?: React.ReactNode;
}) {
  const { staff, logout } = useAuth();
  const { settings, setSettings, enable } = useNotify();
  const db = useDB();
  const { list: branches, activeId } = useBranches();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const notifs = db.notifications.filter((n) => n.audience === audience);
  const unread = notifs.filter((n) => !n.read);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-2 px-3 sm:gap-3 sm:px-4">
        <Link to="/" className="lg:hidden">
          <Brand size="sm" tagline={false} />
        </Link>
        <div className="hidden lg:block">
          <h1 className="font-display text-lg font-bold">{title}</h1>
        </div>
        {accent}
        <div className="flex-1" />

        {branches.length > 1 && (
          <label
            className="flex h-10 min-w-0 items-center gap-1.5 rounded-xl border border-primary/40 bg-primary/10 pl-2 pr-1 text-primary"
            title="Filialni tanlash"
          >
            <Building2 className="h-4 w-4 shrink-0" />
            <select
              value={activeId}
              onChange={(e) => {
                api.switchBranch(e.target.value);
              }}
              aria-label="Filialni tanlash"
              className="h-8 max-w-[6.5rem] cursor-pointer truncate bg-transparent text-xs font-semibold text-foreground outline-none sm:max-w-[11rem]"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <button
          onClick={() => setSettings({ sound: !settings.sound })}
          aria-label={settings.sound ? "Ovozni o‘chirish" : "Ovozni yoqish"}
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-xl border transition",
            settings.sound ? "border-primary/40 bg-primary/15 text-primary" : "border-border bg-secondary/60 text-muted-foreground"
          )}
        >
          {settings.sound ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
        </button>
        <button
          onClick={() => setSettings({ voice: !settings.voice })}
          aria-label={settings.voice ? "Ovozli xabarni o‘chirish" : "Ovozli xabarni yoqish"}
          className={cn(
            "hidden h-10 w-10 items-center justify-center rounded-xl border transition sm:flex",
            settings.voice ? "border-primary/40 bg-primary/15 text-primary" : "border-border bg-secondary/60 text-muted-foreground"
          )}
        >
          {settings.voice ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
        </button>

        <div className="relative">
          <button
            onClick={() => setOpen((o) => !o)}
            aria-label="Bildirishnomalar"
            className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-secondary/60 transition hover:bg-white/10"
          >
            {unread.length > 0 ? <BellRing className="h-4 w-4 text-primary" /> : <Bell className="h-4 w-4" />}
            {unread.length > 0 && (
              <span
                className="absolute -right-1 -top-1 flex items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground"
                style={{ height: 18, minWidth: 18 }}
              >
                {unread.length}
              </span>
            )}
          </button>
          <AnimatePresence>
            {open && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.98 }}
                  className="glass absolute right-0 top-12 z-20 w-80 max-w-[88vw] overflow-hidden rounded-2xl"
                >
                  <div className="flex items-center justify-between border-b border-border px-4 py-3">
                    <span className="text-sm font-bold">Bildirishnomalar</span>
                    <button
                      onClick={() => api.markAllNotificationsRead(audience)}
                      className="flex items-center gap-1 text-xs text-primary"
                    >
                      <CheckCheck className="h-3.5 w-3.5" /> Hammasi
                    </button>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifs.length === 0 && (
                      <p className="px-4 py-6 text-center text-sm text-muted-foreground">Bildirishnomalar yo‘q</p>
                    )}
                    {notifs.slice(0, 25).map((n) => (
                      <button
                        key={n.id}
                        onClick={() => api.markNotificationRead(n.id)}
                        className={cn(
                          "flex w-full flex-col gap-0.5 border-b border-border/60 px-4 py-3 text-left transition hover:bg-white/5",
                          !n.read && "bg-primary/5"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold">{n.title}</span>
                          <span className="text-[10px] text-muted-foreground">{fmtTime(n.at)}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">{n.body}</span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        {!settings.browser && (
          <Button size="sm" variant="outline" onClick={() => void enable()} className="hidden sm:flex">
            Bildirishnomani yoqish
          </Button>
        )}

        <div className="flex items-center gap-2 pl-1">
          <div className="hidden text-right sm:block">
            <p className="text-sm font-semibold leading-tight">{staff?.name}</p>
            <p className="text-[11px] text-muted-foreground">{staff ? ROLE_LABELS[staff.role] : ""}</p>
          </div>
          <button
            onClick={() => {
              logout();
              navigate("/auth");
            }}
            aria-label="Chiqish"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-secondary/60 text-muted-foreground transition hover:bg-white/10 hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}

export function StaffPageTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl font-extrabold">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
