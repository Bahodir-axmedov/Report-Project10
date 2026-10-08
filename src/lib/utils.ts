import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Lang, OrderStatus } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function uid(prefix = "id"): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}${rand}`;
}

export function randomToken(len = 24): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(36).padStart(2, "0"))
    .join("")
    .slice(0, len);
}

export function fmtSom(n: number): string {
  return new Intl.NumberFormat("ru-RU").format(Math.round(n)) + " so‘m";
}

export function fmtNumber(n: number): string {
  return new Intl.NumberFormat("ru-RU").format(Math.round(n));
}

export function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function fmtDateTime(ts: number): string {
  return new Date(ts).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function orderNumberLabel(n: number): string {
  return "#" + String(n).padStart(4, "0");
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, Record<Lang, string>> = {
  NEW: { uz: "Yangi", ru: "Новый", en: "New" },
  ACCEPTED: { uz: "Qabul qilindi", ru: "Принят", en: "Accepted" },
  PREPARING: { uz: "Tayyorlanmoqda", ru: "Готовится", en: "Preparing" },
  READY: { uz: "Tayyor", ru: "Готов", en: "Ready" },
  WAITING_FOR_WAITER: { uz: "Ofitsant kutilmoqda", ru: "Ожидает официанта", en: "Waiting for waiter" },
  DELIVERED: { uz: "Yetkazildi", ru: "Доставлен", en: "Delivered" },
  COMPLETED: { uz: "Yakunlandi", ru: "Завершён", en: "Completed" },
  CANCELLED: { uz: "Bekor qilindi", ru: "Отменён", en: "Cancelled" },
};

export const ORDER_STATUS_ORDER: OrderStatus[] = [
  "NEW",
  "ACCEPTED",
  "PREPARING",
  "READY",
  "WAITING_FOR_WAITER",
  "DELIVERED",
  "COMPLETED",
  "CANCELLED",
];

// Backend-side transition validation — makes illegal status jumps impossible.
const ALLOWED: Record<OrderStatus, OrderStatus[]> = {
  NEW: ["ACCEPTED", "CANCELLED"],
  ACCEPTED: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY", "CANCELLED"],
  READY: ["WAITING_FOR_WAITER", "DELIVERED", "COMPLETED", "CANCELLED"],
  WAITING_FOR_WAITER: ["DELIVERED", "COMPLETED", "CANCELLED"],
  DELIVERED: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return (ALLOWED[from] ?? []).includes(to);
}

export function debounce<T extends (...args: never[]) => void>(fn: T, ms = 250) {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

export function downloadBlob(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function toCSV(rows: (string | number)[][]): string {
  return rows
    .map((r) =>
      r
        .map((cell) => {
          const s = String(cell);
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(",")
    )
    .join("\n");
}

export function startOfDay(d = new Date()): number {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

export function endOfDay(d = new Date()): number {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x.getTime();
}
