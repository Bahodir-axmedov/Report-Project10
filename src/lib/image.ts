/**
 * Menu photo ingest.
 *
 * The whole restaurant database lives in localStorage (~5 MB per branch), so a
 * raw phone photo (5–12 MB) would blow the quota the moment the product is
 * saved — and `persist()` swallows QuotaExceeded errors silently. Every file
 * picked through the admin/dev panels is therefore scaled down and re-encoded
 * to a compact data URL *before* it is stored.
 */

export const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/gif,image/avif,image/svg+xml";

/** Hard cap on the uploaded file itself. */
const MAX_SOURCE_BYTES = 20 * 1024 * 1024;
/** Longest edge of a stored photo. 1000px keeps tiles sharp on retina screens. */
const MAX_DIMENSION = 1000;
/** Above this, the PNG fallback (transparency-safe) would be wasteful. */
const PNG_FALLBACK_MAX_CHARS = 1_200_000;

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Faylni o‘qib bo‘lmadi"));
    reader.readAsDataURL(file);
  });
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Rasmni o‘qib bo‘lmadi"));
    };
    img.src = url;
  });
}

/**
 * Accepts an image file (gallery/photo picker, clipboard, disk) and returns a
 * web-safe data URL, resized to `MAX_DIMENSION` px on the longest edge.
 * Rejects with an Uzbek message the UI can show directly.
 */
export async function fileToImageDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Bu fayl rasm emas — jpg, png, webp yoki gif kerak");
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error("Rasm juda katta (20 MB gacha bo‘lishi kerak)");
  }

  // Vector art and small animations must not go through a canvas: re-encoding
  // would drop the SVG scalability / GIF frames.
  if (file.type === "image/svg+xml" || (file.type === "image/gif" && file.size <= 1_200_000)) {
    return readAsDataURL(file);
  }

  const img = await loadImage(file);
  if (!img.naturalWidth || !img.naturalHeight) {
    throw new Error("Rasm formatini o‘qib bo‘lmadi");
  }

  const scale = Math.min(1, MAX_DIMENSION / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return readAsDataURL(file); // canvas unavailable → store as-is
  ctx.drawImage(img, 0, 0, width, height);

  // WebP is ~30% smaller than JPEG and supported by every modern browser;
  // older Safari can't encode it, so fall back to PNG (keeps transparency)
  // only while it stays small, otherwise JPEG.
  try {
    const webp = canvas.toDataURL("image/webp", 0.85);
    if (webp.startsWith("data:image/webp")) return webp;
  } catch {
    /* encoder unsupported — fall through */
  }
  const png = canvas.toDataURL("image/png");
  if (png.length <= PNG_FALLBACK_MAX_CHARS) return png;
  return canvas.toDataURL("image/jpeg", 0.85);
}

/** Rough stored size of a data URL, used to warn before the quota fills up. */
export function dataUrlBytes(value: string): number {
  const comma = value.indexOf(",");
  const base64 = comma >= 0 ? value.slice(comma + 1) : value;
  return Math.round((base64.length * 3) / 4);
}
