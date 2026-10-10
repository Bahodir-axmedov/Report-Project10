import { useRef, useState } from "react";
import { ImagePlus, Link2, Trash2 } from "lucide-react";
import { Button, Input } from "@/components/ui/primitives";
import { FoodImage } from "@/components/FoodImage";
import { IMAGE_ACCEPT, dataUrlBytes, fileToImageDataUrl } from "@/lib/image";

/**
 * Shared image field for the admin panel and the developer console (both render
 * the same Catalog editors). Two ways to set a photo:
 *   1. pick one from the device gallery / files — resized to ~1000px and stored
 *      as a compact data URL, so it works offline and inside localStorage;
 *   2. paste any image URL.
 */
export function ImagePicker({
  value,
  onChange,
  emoji,
  label = "Rasm",
  placeholder = "https://… yoki https://t.me/…",
}: {
  value: string;
  onChange: (next: string) => void;
  emoji?: string;
  label?: string;
  placeholder?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      onChange(await fileToImageDataUrl(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Rasmni yuklab bo‘lmadi");
    } finally {
      setBusy(false);
    }
  };

  const isData = value.startsWith("data:");
  const meta = value
    ? isData
      ? `Yuklangan rasm · ${Math.max(1, Math.round(dataUrlBytes(value) / 1024))} KB`
      : "Tashqi havola (URL)"
    : "Rasm tanlanmagan";

  return (
    <div className="space-y-2">
      <span className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>

      <div className="flex items-start gap-3">
        <FoodImage
          src={value || undefined}
          alt={label}
          emoji={emoji}
          className="h-24 w-24 shrink-0 rounded-xl border border-border"
        />

        <div className="min-w-0 flex-1 space-y-2">
          <input
            ref={fileRef}
            type="file"
            accept={IMAGE_ACCEPT}
            className="hidden"
            onChange={(e) => {
              void handleFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" size="sm" loading={busy} onClick={() => fileRef.current?.click()}>
              {!busy && <ImagePlus className="h-4 w-4" />}
              Galeriyadan / fayldan
            </Button>
            {value && (
              <Button type="button" variant="ghost" size="sm" onClick={() => onChange("")}>
                <Trash2 className="h-4 w-4" />
                O‘chirish
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
            <Input
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
              className="h-9"
              aria-label={`${label} URL`}
            />
          </div>

          <p className={`text-xs ${error ? "text-destructive" : "text-muted-foreground"}`}>{error ?? meta}</p>
        </div>
      </div>
    </div>
  );
}
