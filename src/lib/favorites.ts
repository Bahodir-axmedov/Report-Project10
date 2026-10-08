import { useSyncExternalStore } from "react";

const KEY = "yumi.favorites.v1";

function load(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

let state: string[] = load();
const listeners = new Set<() => void>();

function commit() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* noop */
  }
  listeners.forEach((l) => l());
}

export function toggleFavorite(productId: string) {
  state = state.includes(productId) ? state.filter((x) => x !== productId) : [...state, productId];
  commit();
}

export function useFavorites(): string[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => state
  );
}
