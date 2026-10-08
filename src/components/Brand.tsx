import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn("h-8 w-8", className)} aria-hidden>
      <defs>
        <linearGradient id="yumiGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ff3b47" />
          <stop offset="100%" stopColor="#b00d18" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="18" fill="url(#yumiGrad)" />
      <path d="M15 13h7.5l5.4 20.5L33.4 13H41l-8.6 30h-8.6z" fill="#fff" />
      <circle cx="48" cy="19" r="4" fill="#fff" opacity="0.95" />
    </svg>
  );
}

export function Brand({
  size = "md",
  tagline = true,
  className,
}: {
  size?: "sm" | "md" | "lg";
  tagline?: boolean;
  className?: string;
}) {
  const s = {
    sm: { mark: "h-7 w-7", title: "text-base", sub: "text-[8px]" },
    md: { mark: "h-9 w-9", title: "text-xl", sub: "text-[9px]" },
    lg: { mark: "h-12 w-12", title: "text-3xl", sub: "text-[11px]" },
  }[size];
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoMark className={s.mark} />
      <div className="leading-none">
        <div className={cn("font-display font-extrabold tracking-tight", s.title)}>
          YÜ<span className="text-primary">M</span>I
        </div>
        {tagline && (
          <div className={cn("mt-0.5 font-semibold uppercase tracking-[0.34em] text-muted-foreground", s.sub)}>
            Sushi &amp; Rolls
          </div>
        )}
      </div>
    </div>
  );
}
