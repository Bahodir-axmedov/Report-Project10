import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { cn } from "@/lib/utils";

export function tableUrl(token: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/t/${token}`;
}

export function QRCodeImage({
  value,
  size = 220,
  className,
  dark = "#0a0a0b",
  light = "#ffffff",
}: {
  value: string;
  size?: number;
  className?: string;
  dark?: string;
  light?: string;
}) {
  const [src, setSrc] = useState<string>("");

  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(value, {
      width: size,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark, light },
    })
      .then((url) => {
        if (alive) setSrc(url);
      })
      .catch(() => {
        if (alive) setSrc("");
      });
    return () => {
      alive = false;
    };
  }, [value, size, dark, light]);

  if (!src) {
    return <div className={cn("skeleton rounded-xl", className)} style={{ width: size, height: size }} />;
  }

  return (
    <img
      src={src}
      width={size}
      height={size}
      alt="QR kod"
      className={cn("rounded-xl bg-white", className)}
    />
  );
}

export async function downloadQrPng(token: string, tableNumber: number) {
  const url = await QRCode.toDataURL(tableUrl(token), { width: 800, margin: 2 });
  const a = document.createElement("a");
  a.href = url;
  a.download = `yumi-stol-${tableNumber}-qr.png`;
  a.click();
}

/** Opens a print-ready sheet with QR cards (A6-sized), then triggers print. */
export async function printQrCards(cards: { number: number; token: string }[], restaurantName: string) {
  const withImages = await Promise.all(
    cards.map(async (c) => ({ ...c, dataUrl: await QRCode.toDataURL(tableUrl(c.token), { width: 400, margin: 1 }) }))
  );
  const win = window.open("", "_blank", "width=900,height=1200");
  if (!win) return;
  const html = `
  <html><head><title>YÜMI QR</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0;font-family:system-ui,sans-serif}
    body{background:#fff;padding:16px;display:flex;flex-wrap:wrap;gap:16px;justify-content:center}
    .card{width:380px;height:520px;border:2px solid #111;border-radius:24px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:28px;page-break-inside:avoid}
    .brand{font-weight:800;font-size:30px;letter-spacing:1px}
    .sub{font-size:12px;letter-spacing:6px;color:#666;text-transform:uppercase}
    .num{font-size:44px;font-weight:800;color:#e11d2a}
    .qr{width:220px;height:220px}
    .hint{font-size:13px;color:#444;text-align:center}
    @media print{ @page{size:A6;margin:0} body{padding:0;gap:0} .card{border:none;width:105mm;height:148mm} }
  </style></head><body>
  ${withImages
    .map(
      (c) => `<div class="card">
      <div class="brand">${restaurantName}</div>
      <div class="sub">Sushi &amp; Rolls</div>
      <img class="qr" src="${c.dataUrl}" />
      <div class="num">Stol №${c.number}</div>
      <div class="hint">Buyurtma berish uchun QR kodni skanerlang</div>
    </div>`
    )
    .join("")}
  </body></html>`;
  win.document.write(html);
  win.document.close();
  setTimeout(() => win.print(), 600);
}
