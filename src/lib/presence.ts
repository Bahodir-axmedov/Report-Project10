import { api, getDB } from "./store";

/**
 * Lightweight cross-tab presence. Every open tab of the app writes a heartbeat
 * into localStorage every ~20s; the developer console reads them to show who
 * is online right now and in which branch they work. Stale entries (no beat
 * for 90s — closed tab, crashed browser) are pruned on every write/read.
 */

const KEY = "yumi.presence.v1";
const KICK_KEY = "yumi.kick.v1";
const STALE_MS = 90_000;

export interface PresenceEntry {
  staffId: string | null;
  name: string;
  role: string;
  branchId: string;
  branchName: string;
  page: string;
  at: number;
}

const TAB_ID = ((): string => {
  try {
    let id = sessionStorage.getItem("yumi.presence.tab");
    if (!id) {
      id = Math.random().toString(36).slice(2) + Date.now().toString(36);
      sessionStorage.setItem("yumi.presence.tab", id);
    }
    return id;
  } catch {
    return "tab-" + Math.random().toString(36).slice(2);
  }
})();

function readAll(): Record<string, PresenceEntry> {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, PresenceEntry>) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function prune(all: Record<string, PresenceEntry>, now = Date.now()): Record<string, PresenceEntry> {
  for (const [k, v] of Object.entries(all)) {
    if (!v || now - (v.at ?? 0) > STALE_MS) delete all[k];
  }
  return all;
}

/** Record "this tab is alive" — call on an interval from AuthProvider. */
export function touchPresence(): void {
  try {
    const now = Date.now();
    const all = prune(readAll(), now);
    const raw = localStorage.getItem("yumi.auth.v1");
    let staffId: string | null = null;
    if (raw?.startsWith("{")) {
      try {
        staffId = (JSON.parse(raw) as { staffId?: string }).staffId ?? null;
      } catch {
        staffId = null;
      }
    }
    const s = staffId ? getDB().staff.find((x) => x.id === staffId) ?? null : null;
    all[TAB_ID] = {
      staffId: s?.id ?? null,
      name: s?.name ?? "Mehmon",
      role: s?.role ?? "GUEST",
      branchId: api.activeBranchId(),
      branchName: api.activeBranch()?.name ?? "—",
      page: location.pathname,
      at: now,
    };
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* quota / private mode */
  }
}

/** Drop this tab's heartbeat (best effort on page hide). */
export function dropPresence(): void {
  try {
    const all = readAll();
    delete all[TAB_ID];
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* noop */
  }
}

/** Live entries, newest first (prunes stale ones). */
export function listPresence(): PresenceEntry[] {
  try {
    const now = Date.now();
    const all = prune(readAll(), now);
    try {
      localStorage.setItem(KEY, JSON.stringify(all));
    } catch {
      /* noop */
    }
    return Object.values(all).sort((a, b) => b.at - a.at);
  } catch {
    return [];
  }
}

/**
 * Kick a staff member out of every tab: AuthProvider sees the kick timestamp
 * (newer than the session's login time) and logs the session out.
 */
export function forceLogout(staffId: string): void {
  try {
    const raw = localStorage.getItem(KICK_KEY);
    const kicks = raw ? (JSON.parse(raw) as Record<string, number>) : {};
    kicks[staffId] = Date.now();
    localStorage.setItem(KICK_KEY, JSON.stringify(kicks));
  } catch {
    /* noop */
  }
  try {
    const all = readAll();
    for (const [k, v] of Object.entries(all)) {
      if (v?.staffId === staffId) delete all[k];
    }
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* noop */
  }
}

/** Timestamp of the newest kick for this session (0 = never kicked). */
export function kickTimestamp(staffId: string, sessionStart: number): number {
  try {
    const raw = localStorage.getItem(KICK_KEY);
    if (!raw) return 0;
    const kicks = JSON.parse(raw) as Record<string, number>;
    const ts = kicks[staffId] ?? 0;
    return ts > sessionStart ? ts : 0;
  } catch {
    return 0;
  }
}
