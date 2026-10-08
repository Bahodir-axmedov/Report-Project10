import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const EMOJI_POOL = ["🍣", "🍥", "🥢", "🍱", "🍜", "🥗", "🍰", "🥤", "🔥", "🍤"];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function FoodImage({
  src,
  alt,
  emoji,
  className,
  imgClassName,
  loading = "lazy",
}: {
  src?: string;
  alt: string;
  emoji?: string;
  className?: string;
  imgClassName?: string;
  loading?: "lazy" | "eager";
}) {
  const [status, setStatus] = useState<"loading" | "ok" | "error">(src ? "loading" : "error");
  const fallback = emoji ?? EMOJI_POOL[hash(alt) % EMOJI_POOL.length];

  useEffect(() => {
    setStatus(src ? "loading" : "error");
  }, [src]);

  return (
    <div className={cn("relative overflow-hidden bg-secondary", className)}>
      <div
        aria-hidden
        className={cn(
          "absolute inset-0 flex items-center justify-center text-4xl transition-opacity duration-300",
          status === "ok" ? "opacity-0" : "opacity-100",
          status === "loading" && "animate-pulse"
        )}
        style={{
          background:
            "radial-gradient(120% 120% at 20% 0%, hsl(356 40% 22%) 0%, hsl(240 6% 8%) 60%)",
        }}
      >
        <span className="drop-shadow">{fallback}</span>
      </div>
      {status !== "error" && src && (
        <img
          src={src}
          alt={alt}
          loading={loading}
          decoding="async"
          onLoad={() => setStatus("ok")}
          onError={() => setStatus("error")}
          className={cn(
            "relative h-full w-full object-cover transition-opacity duration-500",
            status === "ok" ? "opacity-100" : "opacity-0",
            imgClassName
          )}
        />
      )}
    </div>
  );
}
