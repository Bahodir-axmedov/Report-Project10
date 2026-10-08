import { useSyncExternalStore } from "react";

export interface CartLine {
  productId: string;
  qty: number;
  note?: string;
}

const KEY = "yumi.cart.v1";

type CartMap = Record<string, CartLine[]>;

function load(): CartMap {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as CartMap) : {};
  } catch {
    return {};
  }
}

let state: CartMap = load();
const listeners = new Set<() => void>();

/** Shared immutable fallback — getSnapshot must return the SAME reference
 * between changes, otherwise useSyncExternalStore loops forever (React
 * "getSnapshot should be cached" crash that blanked the customer menu). */
const EMPTY_LINES: CartLine[] = [];

function commit() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* noop */
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function getCart(sessionKey: string): CartLine[] {
  return state[sessionKey] ?? EMPTY_LINES;
}

export function addToCart(sessionKey: string, productId: string, qty = 1, note?: string) {
  const lines = [...(state[sessionKey] ?? [])];
  const idx = lines.findIndex((l) => l.productId === productId);
  if (idx >= 0) lines[idx] = { ...lines[idx], qty: lines[idx].qty + qty };
  else lines.push({ productId, qty, note });
  state = { ...state, [sessionKey]: lines };
  commit();
}

export function setCartQty(sessionKey: string, productId: string, qty: number) {
  let lines = [...(state[sessionKey] ?? [])];
  if (qty <= 0) lines = lines.filter((l) => l.productId !== productId);
  else lines = lines.map((l) => (l.productId === productId ? { ...l, qty } : l));
  state = { ...state, [sessionKey]: lines };
  commit();
}

export function removeFromCart(sessionKey: string, productId: string) {
  state = { ...state, [sessionKey]: (state[sessionKey] ?? []).filter((l) => l.productId !== productId) };
  commit();
}

export function clearCart(sessionKey: string) {
  state = { ...state, [sessionKey]: [] };
  commit();
}

export function useCart(sessionKey: string): CartLine[] {
  return useSyncExternalStore(
    subscribe,
    () => state[sessionKey] ?? EMPTY_LINES,
    () => state[sessionKey] ?? EMPTY_LINES
  );
}

export function cartCount(lines: CartLine[]): number {
  return lines.reduce((s, l) => s + l.qty, 0);
}
