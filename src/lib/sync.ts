/**
 * Cross-device sync engine.
 *
 * The SPA never talks to a server by itself (everything lives in localStorage),
 * but a restaurant runs many devices at once: a guest phone scanning the table
 * QR, the waiter tablet, the kitchen screen and the admin PC. This module
 * keeps them consistent through the small sync API in `server.mjs`:
 *
 *   POST /api/sync — the records this device changed (last-write-wins on `rev`)
 *   GET  /api/sync — the records this device has not seen yet (cursor = `now`)
 *
 * It is deliberately forgiving: if the API is missing (static hosting), the
 * app keeps working exactly as before, and the engine only logs a warning and
 * retries every few minutes. Network loss mid-shift is the normal case in a
 * restaurant, so failures back off instead of hammering the connection.
 */
import {
  SYNC_REGISTRY_KEY,
  allChangesForSync,
  api,
  applyRemoteRecords,
  getRegistryForSync,
  hasLocalEdits,
  mergeRegistryFromSync,
  subscribeLocal,
  type SyncChange,
  type SyncRecord,
} from "./store";
import type { BranchMeta } from "./types";

const STATE_KEY = "yumi.sync.v1";
const PULL_MS = 3_000;
const FLUSH_MS = 250;
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_BACKOFF_MS = 30_000;
const NO_API_RETRY_MS = 300_000;

/** Optional shared secret: server SYNC_TOKEN ⇄ build-time VITE_SYNC_TOKEN. */
const TOKEN = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_SYNC_TOKEN ?? "";

interface SyncState {
  cursors: Record<string, number>;
}

interface PullResponse {
  ok: boolean;
  now: number;
  records: SyncRecord[];
}

function loadState(): SyncState {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    const parsed = raw ? (JSON.parse(raw) as SyncState) : null;
    if (parsed && typeof parsed === "object" && parsed.cursors) return parsed;
  } catch {
    /* fresh state */
  }
  return { cursors: {} };
}

let state: SyncState = loadState();

function saveState(): void {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch {
    /* quota — a lost cursor only costs one extra full pull */
  }
}

/** Unsent changes per branch (key = `col:id`, newest revision wins). */
const pending = new Map<string, Map<string, SyncChange>>();
let registryPending: SyncChange | null = null;
const inFlight = new Set<string>();

let started = false;
let timer: ReturnType<typeof setInterval> | null = null;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let failures = 0;
let disabledUntil = 0;

function key(ch: SyncChange): string {
  return `${ch.col}:${ch.id}`;
}

function onLocalChange(branchId: string, changes: SyncChange[]): void {
  if (!changes.length) return;
  if (branchId === SYNC_REGISTRY_KEY) {
    registryPending = changes[changes.length - 1];
  } else {
    let map = pending.get(branchId);
    if (!map) {
      map = new Map();
      pending.set(branchId, map);
    }
    for (const ch of changes) map.set(key(ch), ch);
  }
  scheduleFlush();
}

function scheduleFlush(): void {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void tick();
  }, FLUSH_MS);
}

function disable(message: string): void {
  disabledUntil = Date.now() + NO_API_RETRY_MS;
  // eslint-disable-next-line no-console -- operator needs to know sync is off
  console.warn(`[yumi:sync] o‘chirildi: ${message} (5 daqiqadan keyin qayta urinadi)`);
}

function backoff(): void {
  failures += 1;
  const wait = Math.min(MAX_BACKOFF_MS, 1_500 * 2 ** Math.min(failures, 5));
  disabledUntil = Date.now() + wait;
}

async function call(
  branch: string,
  since: number,
  changes: SyncChange[]
): Promise<PullResponse | null> {
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (TOKEN) headers["X-Sync-Token"] = TOKEN;
    const res = changes.length
      ? await fetch("/api/sync", {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ branch, since, changes }),
          signal: ctrl.signal,
        })
      : await fetch(`/api/sync?branch=${encodeURIComponent(branch)}&since=${since}`, {
          headers,
          signal: ctrl.signal,
        });

    if (res.status === 404 || res.status === 405) {
      disable("serverda sync API yo‘q");
      return null;
    }
    if (res.status === 401) {
      disable("SYNC_TOKEN mos emas");
      return null;
    }
    if (res.status === 403) {
      disable("server so‘rovni manbasi uchun rad etdi (Origin)");
      return null;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      disable("JSON javob kelmadi");
      return null;
    }
    const data = (await res.json()) as PullResponse;
    if (!data || !Array.isArray(data.records)) throw new Error("bad payload");
    failures = 0;
    return data;
  } catch {
    backoff();
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/** Merge a server response into local storage and advance the cursor. */
function applyResponse(branch: string, res: PullResponse, since: number): void {
  const records = res.records ?? [];
  if (branch === SYNC_REGISTRY_KEY) {
    // Each registry record carries the full branch list — flatten; the merge
    // is a union by id, so duplicates from several snapshots are harmless.
    const metas = records
      .filter((r) => r.col === "branches" && r.val !== null)
      .map((r) => r.val as unknown as BranchMeta[])
      .flat();
    if (metas.length) mergeRegistryFromSync(metas);
  } else if (records.length) {
    // First-ever sync of a device that never edited anything: the server wins
    // outright, so a fresh phone does not keep its demo seed alongside the
    // restaurant's real menu. A device with local edits keeps union-merge.
    const full = since === 0 && !hasLocalEdits(branch);
    applyRemoteRecords(branch, records, full);
  }
  state.cursors[branch] = res.now;
  saveState();
}

/** POST pending changes (or bootstrap the whole branch), then pull. */
async function syncOne(branch: string, changes: SyncChange[]): Promise<void> {
  if (inFlight.has(branch)) return;
  inFlight.add(branch);
  try {
    const since = state.cursors[branch] ?? 0;
    let payload = changes;
    // First contact with this branch: hand the server EVERYTHING we have so
    // it becomes a complete copy (the pull below then rebuilds a fresh device
    // from a server that is already whole). Records the server knows with an
    // equal revision are ignored, so seeding twice is harmless.
    if (!payload.length && since === 0) {
      payload =
        branch === SYNC_REGISTRY_KEY
          ? [{ col: "branches", id: "_", rev: 0, val: getRegistryForSync() as unknown as Record<string, unknown> }]
          : allChangesForSync(branch);
    }

    const res = await call(branch, since, payload);
    if (!res) return; // disabled/backing off — keep changes queued

    // Drop the changes the server accepted (a newer local edit keeps its slot).
    const map = pending.get(branch);
    if (map && payload.length) {
      for (const ch of payload) {
        const current = map.get(key(ch));
        if (current && current.rev === ch.rev) map.delete(key(ch));
      }
      if (!map.size) pending.delete(branch);
    }

    applyResponse(branch, res, since);
  } finally {
    inFlight.delete(branch);
  }
}

async function tick(): Promise<void> {
  if (Date.now() < disabledUntil) return;

  // 1) push everything we owe, any branch (mirrored staff/features land here)
  for (const [branch, map] of [...pending]) {
    if (map.size) await syncOne(branch, [...map.values()]);
  }
  if (registryPending) {
    const ch = registryPending;
    registryPending = null;
    await syncOne(SYNC_REGISTRY_KEY, [ch]);
  }

  // 2) pull the branch this tab is looking at + the branch registry
  if (!inFlight.has(api.activeBranchId())) await syncOne(api.activeBranchId(), []);
  if (!inFlight.has(SYNC_REGISTRY_KEY)) await syncOne(SYNC_REGISTRY_KEY, []);
}

/**
 * Start the engine. Call once at boot (main.tsx). Returns a stop function.
 * Fully offline-safe: nothing here is required for the app to work.
 */
export function startSync(): () => void {
  if (started) return () => undefined;
  started = true;
  state = loadState();
  const unsubscribe = subscribeLocal(onLocalChange);
  void tick();
  timer = setInterval(() => void tick(), PULL_MS);
  return () => {
    started = false;
    unsubscribe();
    if (timer) clearInterval(timer);
    if (flushTimer) clearTimeout(flushTimer);
    timer = null;
    flushTimer = null;
  };
}

/** Force an immediate push+pull (used after a branch switch / focus). */
export function syncNow(): void {
  if (started) void tick();
}

/** Is the engine currently talking to a server? (developer console status) */
export function syncStatus(): { active: boolean; pending: number; cursor: number } {
  let queued = registryPending ? 1 : 0;
  for (const map of pending.values()) queued += map.size;
  const branch = api.activeBranchId();
  return {
    active: started && Date.now() >= disabledUntil,
    pending: queued,
    cursor: state.cursors[branch] ?? 0,
  };
}
