import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { buildSeedDB, DEFAULT_SETTINGS, DEV_STAFF_USERNAME } from "./seed";
import type {
  ActivityLog,
  AppNotification,
  CallStatus,
  CallType,
  Category,
  DB,
  Order,
  OrderItem,
  OrderStatus,
  OrderStatusEvent,
  OrderType,
  Payment,
  PaymentMethod,
  PermissionKey,
  Product,
  Promotion,
  RestaurantTable,
  Role,
  Staff,
  TableSession,
  TableStatus,
  WaiterCall,
  BranchMeta,
} from "./types";
import { canTransition, randomToken, uid } from "./utils";
import { permissionsForRole } from "./permissions";
import { hashPassword, isHashed, verifyPassword } from "./hash";

const DB_KEY = "yumi.db.v5";
const BRANCH_KEY = "yumi.branches.v1";
const TAB_BRANCH_KEY = "yumi.activeBranch.v1";
const CHANNEL = "yumi.realtime.v5";
const CURRENT_VERSION = 3;

/** Session storage keys owned by auth/customer — read once at startup to
 * restore the branch a signed-in device or a guest session belongs to. */
export const AUTH_KEY = "yumi.auth.v1";
export const CUSTOMER_KEY = "yumi.customer.v1";

// ---------------------------------------------------------------------------
// Cross-device sync (lib/sync.ts drives the network side)
//
// The restaurant runs several devices (guest phones, waiter, kitchen, admin),
// each with its own localStorage. Every local change is therefore diffed per
// record, stamped with a revision and broadcast to sync subscribers; remote
// changes are merged back under the same last-write-wins rule, so a device
// that was offline catches up without losing newer local edits.
// ---------------------------------------------------------------------------

export interface SyncChange {
  /** collection name (DB key) */
  col: string;
  /** record id ("_" for singleton objects) */
  id: string;
  /** client wall-clock of the edit — last write wins across devices */
  rev: number;
  /** current value, or null when the record was removed */
  val: Record<string, unknown> | null;
}
export type SyncRecord = SyncChange;

/** Pseudo-branch key that carries the global branch registry document. */
export const SYNC_REGISTRY_KEY = "__registry__";

export const ARRAY_COLS = [
  "staff",
  "tables",
  "sessions",
  "categories",
  "products",
  "orders",
  "calls",
  "payments",
  "promotions",
  "logs",
  "notifications",
] as const;
export const SINGLE_COLS = ["settings", "dev", "counters", "features"] as const;

type AnyRecord = { id: string } & Record<string, unknown>;

const localListeners = new Set<(branchId: string, changes: SyncChange[]) => void>();
/** Registry JSON at the moment of the last notify — detects branch changes. */
let lastRegistryJson = "";

export function subscribeLocal(cb: (branchId: string, changes: SyncChange[]) => void): () => void {
  localListeners.add(cb);
  return () => {
    localListeners.delete(cb);
  };
}

export function notifyLocal(branchId: string, changes: SyncChange[]): void {
  if (!changes.length) return;
  for (const l of [...localListeners]) {
    try {
      l(branchId, changes);
    } catch {
      /* a broken subscriber must never break the write */
    }
  }
}

// ---------------------------------------------------------------------------
// Branches (filiallar)
//
// Every branch owns a COMPLETELY separate database (tables + QR codes,
// orders, menu, settings, reports) so two kitchens never share a record.
// The branch registry itself is global; the active branch is per-tab
// (sessionStorage) so an admin tab and a developer tab can work in different
// branches side by side. Staff accounts are mirrored into every branch, so
// the same admin / waiter login works in any branch — the branch is chosen
// at sign-in.
// ---------------------------------------------------------------------------

interface BranchRegistry {
  version: 1;
  activeId: string;
  branches: BranchMeta[];
}

function branchKey(id: string): string {
  // The very first branch keeps the legacy key so existing installs upgrade
  // without moving a single byte.
  return id === "main" ? DB_KEY : `${DB_KEY}.${id}`;
}

function readRegistry(): BranchRegistry {
  try {
    const raw = localStorage.getItem(BRANCH_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as BranchRegistry;
      if (parsed?.version === 1 && Array.isArray(parsed.branches) && parsed.branches.length) {
        if (!parsed.branches.some((b) => b.id === parsed.activeId)) parsed.activeId = parsed.branches[0].id;
        return parsed;
      }
    }
  } catch {
    /* fall through to migration */
  }
  // First run on an existing install: the single database becomes branch 1.
  const registry: BranchRegistry = {
    version: 1,
    activeId: "main",
    branches: [{ id: "main", name: "Markaziy filial", createdAt: Date.now() }],
  };
  writeRegistry(registry);
  return registry;
}

function writeRegistry(r: BranchRegistry): void {
  try {
    localStorage.setItem(BRANCH_KEY, JSON.stringify(r));
  } catch {
    /* quota */
  }
  // A new/renamed/removed branch must reach the other devices too.
  const json = JSON.stringify(r.branches);
  if (json !== lastRegistryJson) {
    lastRegistryJson = json;
    notifyLocal(SYNC_REGISTRY_KEY, [{ col: "branches", id: "_", rev: Date.now(), val: r.branches as unknown as Record<string, unknown> }]);
  }
}

/** Read a branch database WITHOUT touching the active one. */
function readBranch(id: string): DB | null {
  try {
    const raw = localStorage.getItem(branchKey(id));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DB;
    return parsed && Array.isArray(parsed.products) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Startup priority: signed-in staff session → guest session → this tab's own
 * choice → last used on this device → first branch.
 */
function initialBranchId(reg: BranchRegistry): string {
  const known = (id: string | null | undefined): string | null =>
    id && reg.branches.some((b) => b.id === id) ? id : null;
  const candidates: (string | null)[] = [];
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (raw?.startsWith("{")) candidates.push((JSON.parse(raw) as { branchId?: string }).branchId ?? null);
  } catch {
    /* noop */
  }
  try {
    const raw = localStorage.getItem(CUSTOMER_KEY);
    if (raw) candidates.push((JSON.parse(raw) as { branchId?: string }).branchId ?? null);
  } catch {
    /* noop */
  }
  try {
    candidates.push(sessionStorage.getItem(TAB_BRANCH_KEY));
  } catch {
    /* noop */
  }
  candidates.push(reg.activeId, reg.branches[0].id);
  for (const c of candidates) {
    const hit = known(c);
    if (hit) return hit;
  }
  return reg.branches[0].id;
}

let registry: BranchRegistry = readRegistry();
let activeId: string = initialBranchId(registry);
try {
  sessionStorage.setItem(TAB_BRANCH_KEY, activeId);
} catch {
  /* noop */
}

/** Stable snapshot for React (useSyncExternalStore) — replaced on every
 * branch change so selectors re-render. */
let branchState: { list: BranchMeta[]; activeId: string } = {
  list: registry.branches,
  activeId,
};
function syncBranchState(): void {
  const sameList =
    branchState.list.length === registry.branches.length &&
    branchState.list.every(
      (b, i) =>
        b.id === registry.branches[i].id &&
        b.name === registry.branches[i].name &&
        b.createdAt === registry.branches[i].createdAt
    );
  if (sameList && branchState.activeId === activeId) return; // keep stable ref
  branchState = { list: registry.branches, activeId };
}

export function getBranchState(): { list: BranchMeta[]; activeId: string } {
  return branchState;
}

/** Re-read the registry (other tabs may have created/renamed/removed a
 * branch) and make sure this tab still points at an existing branch. */
function refreshActive(): void {
  registry = readRegistry();
  if (!registry.branches.some((b) => b.id === activeId)) {
    activeId = registry.activeId;
    try {
      sessionStorage.setItem(TAB_BRANCH_KEY, activeId);
    } catch {
      /* noop */
    }
  }
  syncBranchState();
}

/** Strip URLs of the dead image host (loremflickr.com returns 401 for
 * everyone) so <FoodImage> shows its brand fallback immediately instead of
 * firing failing requests. Returns true when something changed. */
/** Upgrade legacy plaintext staff/dev passwords to salted hashes in place.
 * Returns true when something changed so the caller can persist the snapshot. */
function migratePasswords(d: DB): boolean {
  let changed = false;
  for (const s of d.staff) {
    if (s.password && !isHashed(s.password)) {
      s.password = hashPassword(s.password);
      changed = true;
    }
  }
  if (d.dev?.password && !isHashed(d.dev.password)) {
    d.dev = { ...d.dev, password: hashPassword(d.dev.password) };
    changed = true;
  }
  return changed;
}

function migrateDeadImages(d: DB): boolean {
  let changed = false;
  for (const p of d.products) {
    if (p.image && p.image.includes("loremflickr.com")) {
      p.image = "";
      changed = true;
    }
  }
  for (const c of d.categories) {
    if (c.image && c.image.includes("loremflickr.com")) {
      c.image = "";
      changed = true;
    }
  }
  return changed;
}

function load(id: string = activeId): DB {
  // The developer key belongs to the developer, not to the seeded demo data:
  // a version bump / factory reset must never roll it back to the defaults.
  let keepDev: DB["dev"] | null = null;
  try {
    const raw = localStorage.getItem(branchKey(id));
    if (raw) {
      const parsed = JSON.parse(raw) as DB;
      if (parsed?.dev?.password) keepDev = parsed.dev;
      if (parsed && parsed.version === CURRENT_VERSION && Array.isArray(parsed.products)) {
        const imgChanged = migrateDeadImages(parsed);
        const pwChanged = migratePasswords(parsed);
        if (imgChanged || pwChanged) {
          try {
            localStorage.setItem(branchKey(id), JSON.stringify(parsed));
          } catch {
            /* quota */
          }
        }
        // Fill in settings fields added after this snapshot was written, so an
        // old browser copy keeps working after an update (deliveryFee, …).
        let settingsTouched = false;
        const s = parsed.settings as unknown as Record<string, unknown>;
        for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
          if (s[k] === undefined) {
            s[k] = v;
            settingsTouched = true;
          }
        }
        if (settingsTouched) {
          try {
            localStorage.setItem(branchKey(id), JSON.stringify(parsed));
          } catch {
            /* quota */
          }
        }
        return parsed;
      }
    }
  } catch {
    /* ignore corrupt storage */
  }
  const seeded = buildSeedDB();
  if (keepDev) seeded.dev = keepDev;
  try {
    localStorage.setItem(branchKey(id), JSON.stringify(seeded));
  } catch {
    /* quota */
  }
  return seeded;
}

/** Generate a QR token for a table. Non-main branches get a branch prefix so
 * tokens can never collide across kitchens; the table number always starts at 1
 * within each branch. */
function qrTokenFor(tableNumber: number, branchId: string = activeId): string {
  const prefix = branchId === "main" ? "yumi" : `yumi-${branchId}`;
  return `${prefix}-${tableNumber}-${randomToken(12)}`;
}

/** Move THIS tab to another branch (per-tab choice + device last-used). */
function setActiveBranch(id: string): void {
  refreshActive();
  if (!registry.branches.some((b) => b.id === id)) return;
  activeId = id;
  registry.activeId = id;
  writeRegistry(registry);
  try {
    sessionStorage.setItem(TAB_BRANCH_KEY, id);
  } catch {
    /* noop */
  }
  // A signed-in staff member picked this branch explicitly — remember it as
  // the branch their session belongs to, so a reload lands here too.
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (raw?.startsWith("{")) {
      const parsed = JSON.parse(raw) as { staffId?: string; branchId?: string };
      if (parsed?.staffId) localStorage.setItem(AUTH_KEY, JSON.stringify({ ...parsed, branchId: id }));
    }
  } catch {
    /* noop */
  }
  db = load(id);
  syncBranchState();
}

/** Staff accounts and the developer key are global: after any change, copy them
 * into every branch so one login works in all branches. */
function mirrorStaffToAll(): void {
  refreshActive();
  for (const b of registry.branches) {
    if (b.id === activeId) continue;
    const other = readBranch(b.id);
    if (!other) continue;
    try {
      localStorage.setItem(branchKey(b.id), JSON.stringify({ ...other, staff: db.staff, dev: db.dev }));
      const rev = Date.now();
      notifyLocal(
        b.id,
        [
          ...db.staff.map((s) => ({ col: "staff", id: s.id, rev, val: s as unknown as Record<string, unknown> })),
          { col: "dev", id: "_", rev, val: db.dev as unknown as Record<string, unknown> },
        ]
      );
    } catch {
      /* quota */
    }
  }
}

let db: DB = load();
const listeners = new Set<() => void>();
const eventListeners = new Set<(e: OrderStatusEvent) => void>();
let channel: BroadcastChannel | null = null;
try {
  channel = new BroadcastChannel(CHANNEL);
} catch {
  channel = null;
}

function emit() {
  listeners.forEach((l) => l());
}

function persist(): boolean {
  try {
    localStorage.setItem(branchKey(activeId), JSON.stringify(db));
    return true;
  } catch {
    /* quota — caller surfaces it (uploaded images are the usual cause) */
    return false;
  }
}

/** Apply a mutation atomically, persist, notify local + other tabs.
 * Returns false when the write hit the localStorage quota, so callers can
 * warn instead of pretending the change was saved. */
function mutate(fn: (d: DB) => void): boolean {
  const branchId = activeId;
  const before = colJson(db);
  fn(db);
  db = { ...db };
  const changes = diffAndStamp(db, before);
  const ok = persist();
  emit();
  channel?.postMessage({ kind: "sync", at: Date.now(), branchId: activeId });
  notifyLocal(branchId, changes);
  return ok;
}

// ----------------------------- sync plumbing ------------------------------

/** JSON fingerprint of every synced collection (cheap enough per mutation:
 * the whole branch database is only tens of kilobytes). */
function colJson(d: DB): { arrays: Map<string, Map<string, string>>; singles: Map<string, string | undefined> } {
  const arrays = new Map<string, Map<string, string>>();
  const src = d as unknown as Record<string, unknown>;
  for (const col of ARRAY_COLS) {
    const m = new Map<string, string>();
    const arr = src[col];
    if (Array.isArray(arr)) {
      for (const r of arr as AnyRecord[]) {
        if (r && typeof r.id === "string") m.set(r.id, JSON.stringify(r));
      }
    }
    arrays.set(col, m);
  }
  const singles = new Map<string, string | undefined>();
  for (const col of SINGLE_COLS) {
    const v = src[col];
    singles.set(col, v === undefined || v === null ? undefined : JSON.stringify(v));
  }
  return { arrays, singles };
}

/** Which records changed (or disappeared) since `before`? Stamp them with a
 * fresh revision and hand the changes to the sync layer. */
function diffAndStamp(
  d: DB,
  before: { arrays: Map<string, Map<string, string>>; singles: Map<string, string | undefined> }
): SyncChange[] {
  const now = Date.now();
  const revs: Record<string, Record<string, number>> = { ...(d.__revs ?? {}) };
  const changes: SyncChange[] = [];
  const src = d as unknown as Record<string, unknown>;

  for (const col of ARRAY_COLS) {
    const prev = before.arrays.get(col) ?? new Map<string, string>();
    const arr = (src[col] as AnyRecord[]) ?? [];
    const seen = new Set<string>();
    for (const rec of arr) {
      if (!rec || typeof rec.id !== "string") continue;
      seen.add(rec.id);
      if (prev.get(rec.id) === JSON.stringify(rec)) continue; // untouched
      revs[col] = { ...(revs[col] ?? {}), [rec.id]: now };
      changes.push({ col, id: rec.id, rev: now, val: rec as Record<string, unknown> });
    }
    for (const id of prev.keys()) {
      if (seen.has(id)) continue;
      revs[col] = { ...(revs[col] ?? {}), [id]: now };
      changes.push({ col, id, rev: now, val: null });
    }
  }

  for (const col of SINGLE_COLS) {
    const prev = before.singles.get(col);
    const v = src[col];
    const next = v === undefined || v === null ? undefined : JSON.stringify(v);
    if (prev === next) continue;
    revs[col] = { ...(revs[col] ?? {}), _: now };
    changes.push({ col, id: "_", rev: now, val: next === undefined ? null : (v as Record<string, unknown>) });
  }

  d.__revs = revs;
  return changes;
}

/** Full list of this branch's records — used to bootstrap a server that has
 * never seen this device (deploy day). */
export function allChangesForSync(branchId: string): SyncChange[] {
  const d = branchId === activeId ? db : readBranch(branchId);
  if (!d) return [];
  const out: SyncChange[] = [];
  const src = d as unknown as Record<string, unknown>;
  for (const col of ARRAY_COLS) {
    const arr = (src[col] as AnyRecord[]) ?? [];
    for (const rec of arr) {
      if (!rec || typeof rec.id !== "string") continue;
      out.push({ col, id: rec.id, rev: d.__revs?.[col]?.[rec.id] ?? 0, val: rec as Record<string, unknown> });
    }
  }
  for (const col of SINGLE_COLS) {
    const v = src[col];
    if (v === undefined || v === null) continue;
    out.push({ col, id: "_", rev: d.__revs?.[col]?.["_"] ?? 0, val: v as Record<string, unknown> });
  }
  return out;
}

/** Has this device edited anything since the feature shipped? (Decides whether
 * the first sync may treat the server as the source of truth.) */
export function hasLocalEdits(branchId: string): boolean {
  const d = branchId === activeId ? db : readBranch(branchId);
  return !!d && !!d.__revs && Object.keys(d.__revs).length > 0;
}

const ORDER_EVENT: Record<string, OrderStatusEvent["type"]> = {
  NEW: "ORDER_CREATED",
  ACCEPTED: "ORDER_ACCEPTED",
  PREPARING: "ORDER_PREPARING",
  READY: "ORDER_READY",
  WAITING_FOR_WAITER: "WAITER_CALLED",
  DELIVERED: "ORDER_DELIVERED",
  COMPLETED: "ORDER_COMPLETED",
  CANCELLED: "ORDER_CANCELLED",
};

/** Merge records that arrived from another device. `full` means the server is
 * the source of truth (first sync of a fresh device): synced collections are
 * rebuilt from the server instead of unioned with the local demo seed. */
export function applyRemoteRecords(branchId: string, records: SyncRecord[], full: boolean): void {
  if (!records.length) return;
  const events: OrderStatusEvent[] = [];

  const merge = (target: DB): DB => {
    const next: DB = { ...target };
    const revs: Record<string, Record<string, number>> = { ...(target.__revs ?? {}) };
    const src = next as unknown as Record<string, unknown>;
    const byCol = new Map<string, SyncRecord[]>();
    for (const r of records) {
      const list = byCol.get(r.col) ?? [];
      list.push(r);
      byCol.set(r.col, list);
    }

    for (const [col, recs] of byCol) {
      if ((ARRAY_COLS as readonly string[]).includes(col)) {
        const existing = ((src[col] as AnyRecord[]) ?? []).filter((r) => r && typeof r.id === "string");
        const base = full ? [] : existing;
        const order = base.map((r) => r.id);
        const map = new Map<string, AnyRecord>(base.map((r) => [r.id, r]));
        for (const rec of recs) {
          const localRev = revs[col]?.[rec.id] ?? 0;
          if (rec.rev < localRev) continue; // local copy is newer — keep it
          if (rec.val === null) {
            map.delete(rec.id);
          } else {
            const prev = map.get(rec.id);
            if (col === "orders") {
              const before = (prev as unknown as { status?: string } | undefined)?.status;
              const after = (rec.val as { status?: string }).status;
              if (after && after !== before) {
                events.push({
                  type: ORDER_EVENT[after] ?? "DATA_CHANGED",
                  at: Date.now(),
                  orderId: rec.id,
                  orderNumber: (rec.val as { number?: number }).number,
                  message: "Buyurtma yangilandi",
                });
              }
            }
            map.set(rec.id, rec.val as AnyRecord);
          }
          revs[col] = { ...(revs[col] ?? {}), [rec.id]: rec.rev };
        }
        const ordered = order.filter((id) => map.has(id)).map((id) => map.get(id) as AnyRecord);
        const orderSet = new Set(order);
        for (const [id, rec] of map) if (!orderSet.has(id)) ordered.push(rec);
        src[col] = ordered;
        continue;
      }

      if ((SINGLE_COLS as readonly string[]).includes(col)) {
        for (const rec of recs) {
          const localRev = revs[col]?.["_"] ?? 0;
          if (rec.rev < localRev) continue;
          if (col === "counters") {
            // Monotonic counter: never let a merge reset order numbering.
            const local = (src[col] as { orderNumber?: number } | undefined)?.orderNumber ?? 0;
            const remote = (rec.val as { orderNumber?: number } | null)?.orderNumber ?? 0;
            if (rec.val === null) continue;
            src[col] = { ...(src[col] as object), orderNumber: Math.max(local, remote) };
          } else if (rec.val === null) {
            delete src[col];
          } else {
            src[col] = rec.val;
          }
          revs[col] = { ...(revs[col] ?? {}), _: rec.rev };
        }
      }
    }

    next.__revs = revs;
    return next;
  };

  if (branchId === activeId) {
    db = merge(db);
    persist();
    emit();
    for (const e of events) emitEvent(e);
    return;
  }

  // Another branch: update its storage directly; tabs showing it re-read on
  // the native `storage` event.
  try {
    const other = readBranch(branchId) ?? load(branchId);
    localStorage.setItem(branchKey(branchId), JSON.stringify(merge(other)));
  } catch {
    /* quota */
  }
}

// ------------------------- registry (filiallar) ---------------------------

export function getRegistryForSync(): BranchMeta[] {
  refreshActive();
  return registry.branches;
}

/** Union of local + remote branches: creating a branch is rare and admin-only,
 * so a merge by id never loses a filial. Writes quietly (no echo push). */
export function mergeRegistryFromSync(metas: BranchMeta[]): void {
  if (!Array.isArray(metas) || !metas.length) return;
  refreshActive();
  const byId = new Map<string, BranchMeta>();
  for (const b of registry.branches) byId.set(b.id, b);
  for (const b of metas) if (b && typeof b.id === "string") byId.set(b.id, b);
  const merged = [...byId.values()];
  const changed =
    merged.length !== registry.branches.length ||
    merged.some((b, i) => {
      const cur = registry.branches.find((x) => x.id === b.id);
      return !cur || cur.name !== b.name || cur.createdAt !== b.createdAt;
    });
  if (!changed) return;
  registry = { ...registry, branches: merged };
  if (!registry.branches.some((b) => b.id === activeId)) {
    activeId = registry.activeId = registry.branches[0].id;
    try {
      sessionStorage.setItem(TAB_BRANCH_KEY, activeId);
    } catch {
      /* noop */
    }
    db = load(activeId);
    emit();
  }
  try {
    localStorage.setItem(BRANCH_KEY, JSON.stringify(registry));
    lastRegistryJson = JSON.stringify(registry.branches);
  } catch {
    /* quota */
  }
  syncBranchState();
}

function emitEvent(e: OrderStatusEvent) {
  eventListeners.forEach((l) => l(e));
  // Tag the event with its branch so another branch's tab never toasts it.
  channel?.postMessage({ kind: "event", event: e, branchId: activeId });
}

function pushLog(
  d: DB,
  role: Role | "CUSTOMER" | "SYSTEM",
  staffName: string,
  action: string,
  entity: string,
  entityId?: string,
  detail?: string,
  staffId: string | null = null
) {
  const log: ActivityLog = {
    id: uid("log"),
    at: Date.now(),
    staffId,
    staffName,
    role,
    action,
    entity,
    entityId,
    detail,
  };
  d.logs = [log, ...d.logs].slice(0, 500);
}

function pushNotification(
  d: DB,
  audience: AppNotification["audience"],
  type: string,
  title: string,
  body: string,
  tableNumber?: number | null,
  sessionId?: string | null
) {
  const n: AppNotification = {
    id: uid("ntf"),
    at: Date.now(),
    audience,
    type,
    title,
    body,
    read: false,
    tableNumber: tableNumber ?? null,
    sessionId: sessionId ?? null,
  };
  d.notifications = [n, ...d.notifications].slice(0, 300);
}

// ---------------------------------------------------------------------------
// Realtime channel
// ---------------------------------------------------------------------------
if (channel) {
  channel.onmessage = (ev: MessageEvent) => {
    const data = ev.data as
      | { kind: "sync"; branchId?: string }
      | { kind: "event"; event: OrderStatusEvent; branchId?: string }
      | { kind: "request-sync" };
    // Another branch's traffic must never wake this tab up.
    if (data?.kind === "sync") {
      if (data.branchId && data.branchId !== activeId) return;
      refreshActive();
      db = load();
      emit();
    } else if (data?.kind === "event") {
      if (data.branchId && data.branchId !== activeId) return;
      eventListeners.forEach((l) => l(data.event));
    } else if (data?.kind === "request-sync") {
      channel?.postMessage({ kind: "sync", at: Date.now(), branchId: activeId });
    }
  };
  channel.postMessage({ kind: "request-sync" });
}

export function getDB(): DB {
  return db;
}

export function resetDemoData() {
  // Keep the developer credentials across a factory reset (handover safety)
  // and the site-wide section switches (they are config, not demo data —
  // otherwise branches would drift apart after a reset).
  const keepDev = db.dev;
  const keepFeatures = db.features;
  const keepRevs = db.__revs;
  const before = colJson(db);
  refreshActive();
  localStorage.removeItem(branchKey(activeId));
  db = load();
  let patched = false;
  if (keepDev?.password) {
    db = { ...db, dev: keepDev };
    patched = true;
  }
  if (keepFeatures) {
    db = { ...db, features: keepFeatures };
    patched = true;
  }
  // Carry the old revisions and diff against the pre-reset snapshot: records
  // the reset deleted are pushed as tombstones, so other devices drop them too.
  db.__revs = keepRevs;
  const changes = diffAndStamp(db, before);
  persist();
  emit();
  channel?.postMessage({ kind: "sync", at: Date.now(), branchId: activeId });
  notifyLocal(activeId, changes);
}

// ---------------------------------------------------------------------------
// React bindings
// ---------------------------------------------------------------------------
const DataCtx = createContext<{ db: DB }>({ db });

export function DataProvider({ children }: { children: ReactNode }) {
  const snapshot = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    getDB,
    getDB
  );
  // Re-sync from shared storage when the tab regains focus (other tab/branch
  // may have written a newer snapshot).
  useEffect(() => {
    const onFocus = () => {
      // Registry may have changed in another tab (branch created/removed) —
      // re-read it first so this tab never points at a deleted branch.
      refreshActive();
      db = load();
      emit();
    };
    window.addEventListener("focus", onFocus);
    window.addEventListener("storage", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("storage", onFocus);
    };
  }, []);
  return <DataCtx.Provider value={{ db: snapshot }}>{children}</DataCtx.Provider>;
}

export function useDB(): DB {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    getDB,
    getDB
  );
}

/** Is this section enabled? Default: enabled (absent key = true). */
export function useFeature(key: string): boolean {
  const db = useDB();
  return db.features?.[key] !== false;
}

/** Branch list + active branch for this tab (re-renders on any change). */
export function useBranches(): { list: BranchMeta[]; activeId: string } {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    getBranchState,
    getBranchState
  );
}

export function useRealtimeEvent(handler: (e: OrderStatusEvent) => void) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const cb = (e: OrderStatusEvent) => ref.current(e);
    eventListeners.add(cb);
    return () => {
      eventListeners.delete(cb);
    };
  }, []);
}

export function subscribeEvents(cb: (e: OrderStatusEvent) => void) {
  eventListeners.add(cb);
  return () => eventListeners.delete(cb);
}

// ---------------------------------------------------------------------------
// Domain API (all validation happens here — never trust the caller)
// ---------------------------------------------------------------------------
export const api = {
  // ---------- branches (filiallar) ----------
  /** All branches; the active one for THIS tab. */
  listBranches(): BranchMeta[] {
    refreshActive();
    return registry.branches;
  },

  activeBranchId(): string {
    refreshActive();
    return activeId;
  },

  /** Read a branch database WITHOUT moving this tab. Guest sessions are
   * branch-scoped: while a tab is still switching branches after a
   * cross-branch QR scan, callers must validate against the branch the record
   * actually lives in instead of the (still stale) active database. */
  branchDb(id: string): DB | null {
    if (!id) return null;
    refreshActive();
    return id === activeId ? db : readBranch(id);
  },

  activeBranch(): BranchMeta {
    refreshActive();
    return registry.branches.find((b) => b.id === activeId) ?? registry.branches[0];
  },

  /** Lightweight per-branch counters for the developer "Filiallar" tab. */
  branchStats(id: string): { tables: number; orders: number; products: number; staff: number } {
    if (id === activeId) {
      return {
        tables: db.tables.length,
        orders: db.orders.length,
        products: db.products.length,
        staff: db.staff.length,
      };
    }
    const other = readBranch(id);
    return other
      ? {
          tables: other.tables.length,
          orders: other.orders.length,
          products: other.products.length,
          staff: other.staff.length,
        }
      : { tables: 0, orders: 0, products: 0, staff: 0 };
  },

  /** Move this tab to another branch. Signed-in staff stay signed in because
   * accounts are mirrored across branches. */
  switchBranch(id: string): boolean {
    if (id === activeId) {
      try {
        sessionStorage.setItem(TAB_BRANCH_KEY, activeId);
      } catch {
        /* noop */
      }
      return true;
    }
    if (!registry.branches.some((b) => b.id === id)) return false;
    setActiveBranch(id);
    emit();
    channel?.postMessage({ kind: "sync", at: Date.now(), branchId: activeId });
    return true;
  },

  /** Create a second (third, …) kitchen. It gets a COMPLETELY separate
   * database: its own tables + QR codes numbered from 1, menu, orders and
   * reports. Staff accounts are copied so the same logins work there. */
  createBranch(name: string): BranchMeta {
    refreshActive();
    const meta: BranchMeta = {
      id: uid("br"),
      name: name.trim() || `Filial ${registry.branches.length + 1}`,
      createdAt: Date.now(),
    };
    registry = { ...registry, branches: [...registry.branches, meta] };
    writeRegistry(registry);
    const seeded = buildSeedDB();
    // fresh branch: no demo history, table numbering + QR start from 1
    seeded.orders = [];
    seeded.payments = [];
    seeded.calls = [];
    seeded.sessions = [];
    seeded.notifications = [];
    seeded.counters = { orderNumber: 0 };
    seeded.staff = db.staff; // same logins everywhere
    seeded.dev = db.dev;
    seeded.tables = seeded.tables.map((t) => ({
      ...t,
      status: "EMPTY" as TableStatus,
      qrToken: qrTokenFor(t.number, meta.id),
    }));
    seeded.logs = [
      {
        id: uid("log"),
        at: Date.now(),
        staffId: null,
        staffName: "Developer",
        role: "SYSTEM",
        action: `Filial yaratildi: ${meta.name}`,
        entity: "branch",
        entityId: meta.id,
      },
    ];
    try {
      localStorage.setItem(branchKey(meta.id), JSON.stringify(seeded));
    } catch {
      /* quota */
    }
    syncBranchState();
    emit();
    return meta;
  },

  renameBranch(id: string, name: string): boolean {
    refreshActive();
    const clean = name.trim();
    if (!clean) return false;
    if (!registry.branches.some((b) => b.id === id)) return false;
    registry = {
      ...registry,
      branches: registry.branches.map((b) => (b.id === id ? { ...b, name: clean } : b)),
    };
    writeRegistry(registry);
    syncBranchState();
    emit();
    return true;
  },

  /** Remove a branch and ALL of its data. The last remaining branch is kept. */
  deleteBranch(id: string): boolean {
    refreshActive();
    if (registry.branches.length <= 1) return false;
    if (!registry.branches.some((b) => b.id === id)) return false;
    const branches = registry.branches.filter((b) => b.id !== id);
    registry = {
      ...registry,
      branches,
      activeId: registry.activeId === id ? branches[0].id : registry.activeId,
    };
    writeRegistry(registry);
    try {
      localStorage.removeItem(branchKey(id));
    } catch {
      /* noop */
    }
    if (activeId === id) {
      activeId = registry.activeId;
      try {
        sessionStorage.setItem(TAB_BRANCH_KEY, activeId);
      } catch {
        /* noop */
      }
      db = load();
    }
    syncBranchState();
    emit();
    channel?.postMessage({ kind: "sync", at: Date.now(), branchId: activeId });
    return true;
  },

  /** Full backup: registry + EVERY branch database in one JSON document. */
  exportAllBranches(): string {
    refreshActive();
    const payload = {
      yumiBackup: 1,
      exportedAt: Date.now(),
      branches: registry.branches.map((b) => ({
        meta: b,
        db: b.id === activeId ? db : readBranch(b.id),
      })),
    };
    return JSON.stringify(payload, null, 2);
  },

  /** Restore a backup created by `exportAllBranches` — replaces the whole
   * branch set (metadatabases + registry) and reloads this tab. */
  importAllBranches(raw: string): { ok: boolean; error?: string } {
    try {
      const parsed = JSON.parse(raw) as {
        yumiBackup?: number;
        branches?: { meta: BranchMeta; db: DB }[];
      };
      if (parsed?.yumiBackup !== 1 || !Array.isArray(parsed.branches) || !parsed.branches.length) {
        return { ok: false, error: "Bu fayl to‘liq backup emas (yumiBackup topilmadi)" };
      }
      const branches: BranchMeta[] = [];
      for (const entry of parsed.branches) {
        const m = entry?.meta;
        const d = entry?.db;
        if (!m?.id || !d || !Array.isArray(d.products) || !Array.isArray(d.tables) || !Array.isArray(d.staff)) {
          return { ok: false, error: "Backup ichida buzilgan filial ma‘lumoti bor" };
        }
        const meta: BranchMeta = {
          id: String(m.id),
          name: String(m.name || "Filial"),
          createdAt: Number(m.createdAt) || Date.now(),
        };
        try {
          localStorage.setItem(branchKey(meta.id), JSON.stringify(d));
        } catch {
          return { ok: false, error: "Saqlashda xato — brauzer xotirasi to‘lgan bo‘lishi mumkin" };
        }
        branches.push(meta);
      }
      registry = {
        version: 1,
        activeId: branches.some((b) => b.id === activeId) ? activeId : branches[0].id,
        branches,
      };
      writeRegistry(registry);
      try {
        sessionStorage.setItem(TAB_BRANCH_KEY, activeId);
      } catch {
        /* noop */
      }
      db = load();
      syncBranchState();
      emit();
      channel?.postMessage({ kind: "sync", at: Date.now(), branchId: activeId });
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "JSON o‘qib bo‘lmadi" };
    }
  },

  /** Health check of every table QR code across all branches. */
  qrAudit(): {
    branches: { id: string; name: string; tables: number; inactive: number; duplicate: number }[];
    globalDuplicates: number;
    invalidFormat: number;
  } {
    refreshActive();
    const seen = new Map<string, number>();
    const rows: { id: string; name: string; tables: number; inactive: number; duplicate: number }[] = [];
    let invalidFormat = 0;
    for (const b of registry.branches) {
      const data = b.id === activeId ? db : readBranch(b.id);
      const tables = data?.tables ?? [];
      const local = new Set<string>();
      let duplicate = 0;
      for (const t of tables) {
        seen.set(t.qrToken, (seen.get(t.qrToken) ?? 0) + 1);
        if (local.has(t.qrToken)) duplicate += 1;
        else local.add(t.qrToken);
        if (!t.qrToken || !t.qrToken.startsWith("yumi-")) invalidFormat += 1;
      }
      rows.push({
        id: b.id,
        name: b.name,
        tables: tables.length,
        inactive: tables.filter((t) => !t.active).length,
        duplicate,
      });
    }
    const globalDuplicates = [...seen.values()].filter((n) => n > 1).length;
    return { branches: rows, globalDuplicates, invalidFormat };
  },

  /** Issue fresh branch-scoped QR tokens for every table (default: all
   * branches). Printed codes with old tokens stop working — warn the user. */
  regenerateAllQr(branchIds?: string[], staff?: Staff | null): number {
    refreshActive();
    const targets = branchIds?.length ? branchIds : registry.branches.map((b) => b.id);
    let changed = 0;
    for (const id of targets) {
      if (id === activeId) {
        const count = db.tables.length;
        mutate((d) => {
          d.tables = d.tables.map((t) => ({ ...t, qrToken: qrTokenFor(t.number, activeId) }));
          pushLog(
            d,
            staff?.role ?? "SYSTEM",
            staff?.name ?? "Developer",
            `Barcha QR tokenlar yangilandi (${count} ta)`,
            "qr",
            undefined,
            undefined,
            staff?.id ?? null
          );
        });
        changed += count;
      } else {
        const other = readBranch(id);
        if (!other) continue;
        const tables = other.tables.map((t) => ({ ...t, qrToken: qrTokenFor(t.number, id) }));
        const log: ActivityLog = {
          id: uid("log"),
          at: Date.now(),
          staffId: staff?.id ?? null,
          staffName: staff?.name ?? "Developer",
          role: "SYSTEM",
          action: `Barcha QR tokenlar yangilandi (${tables.length} ta)`,
          entity: "qr",
        };
        try {
          localStorage.setItem(
            branchKey(id),
            JSON.stringify({ ...other, tables, logs: [log, ...other.logs].slice(0, 500) })
          );
        } catch {
          /* quota */
        }
        changed += tables.length;
      }
    }
    emit();
    channel?.postMessage({ kind: "sync", at: Date.now(), branchId: activeId });
    return changed;
  },

  // ---------- auth ----------
  // ---------- bo'limlar (developer section switches) ----------
  /**
   * Turn whole sections on/off (delivery, preorder, promotions, favorites,
   * waiter calls…). A disabled section disappears for everyone except this
   * console. Site-wide: the flag is mirrored into every branch database.
   */
  setFeatures(patch: Record<string, boolean>, actor?: Staff | null) {
    mutate((d) => {
      d.features = { ...(d.features ?? {}), ...patch };
      pushLog(
        d,
        actor?.role ?? "SYSTEM",
        actor?.name ?? "Developer",
        `Bo‘limlar: ${Object.entries(patch)
          .map(([k, v]) => `${k} → ${v ? "yoqildi" : "o‘chirildi"}`)
          .join(", ")}`,
        "features",
        undefined,
        undefined,
        actor?.id ?? null
      );
    });
    refreshActive();
    for (const b of registry.branches) {
      if (b.id === activeId) continue;
      const other = readBranch(b.id);
      if (!other) continue;
      try {
        localStorage.setItem(branchKey(b.id), JSON.stringify({ ...other, features: db.features }));
        if (db.features !== undefined) {
          notifyLocal(b.id, [{ col: "features", id: "_", rev: Date.now(), val: db.features as Record<string, unknown> }]);
        }
      } catch {
        /* quota */
      }
    }
  },

  // ---------- auth ----------
  /**
   * Sign in. `branchId` (picked on the login screen) is validated first and the
   * tab switches to that branch only after ALL checks pass. A role mismatch
   * neither switches branches nor writes an auth log — the caller gets
   * `roleMismatch` and decides on the message.
   */
  login(
    username: string,
    password: string,
    branchId?: string,
    requireRole?: Role | Role[]
  ): { staff: Staff | null; roleMismatch: Role | null } {
    refreshActive();
    const target = branchId && branchId !== activeId && registry.branches.some((b) => b.id === branchId)
      ? branchId
      : null;
    const source = target ? readBranch(target) : db;
    if (!source) return { staff: null, roleMismatch: null };
    const s = source.staff.find(
      (x) =>
        x.username.toLowerCase() === username.trim().toLowerCase() &&
        verifyPassword(x.password, password)
    );
    if (!s || !s.active) return { staff: null, roleMismatch: null };
    if (requireRole) {
      const allowed = Array.isArray(requireRole) ? requireRole : [requireRole];
      if (!allowed.includes(s.role)) return { staff: null, roleMismatch: s.role };
    }
    if (target) setActiveBranch(target); // db reloaded to the chosen branch
    pushLog(db, s.role, s.name, "Tizimga kirdi", "auth", s.id);
    db = { ...db };
    persist();
    emit();
    channel?.postMessage({ kind: "sync", at: Date.now(), branchId: activeId });
    return { staff: s, roleMismatch: null };
  },

  // ---------- tables ----------
  /**
   * QR lookup: the token belongs to exactly one branch. If the scanned table
   * lives in another branch, this tab moves there so the guest session is
   * created in the right database — branches never share records.
   */
  resolveTableByToken(token: string): RestaurantTable | null {
    let t = db.tables.find((x) => x.qrToken === token) ?? null;
    if (!t) {
      refreshActive();
      for (const b of registry.branches) {
        if (b.id === activeId) continue;
        const other = readBranch(b.id);
        if (other?.tables.some((x) => x.qrToken === token)) {
          setActiveBranch(b.id);
          t = db.tables.find((x) => x.qrToken === token) ?? null;
          break;
        }
      }
    }
    return t;
  },

  getOrCreateSession(tableId: string, device: string): TableSession {
    const existing = db.sessions.find(
      (s) => s.tableId === tableId && s.active && s.expiresAt > Date.now()
    );
    if (existing) {
      // Re-open a session that was idle for a long time.
      if (Date.now() - (existing.lastActivityAt ?? existing.createdAt) < 45 * 60_000) return existing;
      mutate((d) => {
        d.sessions = d.sessions.map((s) =>
          s.id === existing.id
            ? { ...s, active: false, state: "BILL" as const, cart: [] }
            : s
        );
      });
    }
    const session: TableSession = {
      id: uid("ses"),
      tableId,
      createdAt: Date.now(),
      expiresAt: Date.now() + 1000 * 60 * 60 * 6,
      active: true,
      device,
      lastActivityAt: Date.now(),
      viewing: "menu",
      lastProductId: null,
      cart: [],
      state: "BROWSING",
    };
    mutate((d) => {
      d.sessions = [...d.sessions, session];
      d.tables = d.tables.map((t) =>
        t.id === tableId && t.status === "EMPTY" ? { ...t, status: "OCCUPIED" as TableStatus } : t
      );
      pushLog(d, "CUSTOMER", "Mijoz", "Stol sessiyasi ochildi", "session", session.id);
    });
    return session;
  },

  /**
   * Live presence heartbeat from a guest device: what they are looking at right
   * now and what is sitting in their cart. Powers the admin live table monitor.
   */
  touchSession(
    sessionId: string,
    patch: { viewing?: string; lastProductId?: string | null; cart?: { productId: string; qty: number }[]; state?: TableSession["state"] }
  ) {
    if (!db.sessions.some((s) => s.id === sessionId && s.active)) return;
    mutate((d) => {
      d.sessions = d.sessions.map((s) =>
        s.id === sessionId ? { ...s, ...patch, lastActivityAt: Date.now() } : s
      );
    });
  },

  /** Close a guest session (table freed). */
  endSession(sessionId: string, staff?: Staff) {
    mutate((d) => {
      const session = d.sessions.find((s) => s.id === sessionId);
      if (!session) return;
      d.sessions = d.sessions.map((s) =>
        s.id === sessionId ? { ...s, active: false, cart: [] } : s
      );
      // Close every unpaid session on the table as well.
      d.tables = d.tables.map((t) =>
        t.id === session.tableId ? { ...t, status: "EMPTY" as TableStatus } : t
      );
      pushLog(d, staff?.role ?? "SYSTEM", staff?.name ?? "Tizim", "Stol sessiyasi yopildi", "session", sessionId, undefined, staff?.id ?? null);
    });
  },

  /** Mark sessions with no heartbeat for `idleMs` as inactive. */
  pruneSessions(idleMs = 20 * 60_000) {
    const cutoff = Date.now() - idleMs;
    if (!db.sessions.some((s) => s.active && (s.lastActivityAt ?? s.createdAt) < cutoff)) return;
    mutate((d) => {
      d.sessions = d.sessions.map((s) =>
        s.active && (s.lastActivityAt ?? s.createdAt) < cutoff ? { ...s, active: false } : s
      );
    });
  },

  setTableStatus(tableId: string, status: TableStatus, staff?: Staff) {
    mutate((d) => {
      d.tables = d.tables.map((t) => (t.id === tableId ? { ...t, status } : t));
      const t = d.tables.find((x) => x.id === tableId);
      pushLog(d, staff?.role ?? "SYSTEM", staff?.name ?? "Tizim", `Stol statusi: ${status}`, "table", tableId, `Stol ${t?.number}`);
    });
    const t = db.tables.find((x) => x.id === tableId);
    emitEvent({ type: "TABLE_STATUS_CHANGED", at: Date.now(), tableNumber: t?.number });
  },

  addTable(input: { number: number; seats: number; zone: string }, staff: Staff) {
    const table: RestaurantTable = {
      id: uid("tbl"),
      number: input.number,
      qrToken: qrTokenFor(input.number),
      status: "EMPTY",
      active: true,
      seats: input.seats,
      zone: input.zone,
    };
    mutate((d) => {
      d.tables = [...d.tables, table].sort((a, b) => a.number - b.number);
      pushLog(d, staff.role, staff.name, `Stol qo‘shildi: №${input.number}`, "table", table.id, undefined, staff.id);
    });
    return table;
  },

  updateTable(id: string, patch: Partial<RestaurantTable>, staff: Staff) {
    mutate((d) => {
      d.tables = d.tables.map((t) => (t.id === id ? { ...t, ...patch } : t));
      pushLog(d, staff.role, staff.name, "Stol tahrirlandi", "table", id, undefined, staff.id);
    });
  },

  deleteTable(id: string, staff: Staff) {
    mutate((d) => {
      d.tables = d.tables.filter((t) => t.id !== id);
      pushLog(d, staff.role, staff.name, "Stol o‘chirildi", "table", id, undefined, staff.id);
    });
  },

  regenerateQr(id: string, staff: Staff) {
    const num = db.tables.find((t) => t.id === id)?.number ?? 1;
    const token = qrTokenFor(num);
    mutate((d) => {
      d.tables = d.tables.map((t) => (t.id === id ? { ...t, qrToken: token } : t));
      pushLog(d, staff.role, staff.name, "QR token yangilandi", "table", id, undefined, staff.id);
    });
    return token;
  },

  // ---------- catalog ----------
  saveProduct(p: Product, staff: Staff) {
    return mutate((d) => {
      const exists = d.products.some((x) => x.id === p.id);
      d.products = exists ? d.products.map((x) => (x.id === p.id ? p : x)) : [...d.products, p];
      pushLog(d, staff.role, staff.name, exists ? "Mahsulot tahrirlandi" : "Mahsulot qo‘shildi", "product", p.id, p.nameUz, staff.id);
    });
  },
  deleteProduct(id: string, staff: Staff) {
    mutate((d) => {
      d.products = d.products.filter((x) => x.id !== id);
      pushLog(d, staff.role, staff.name, "Mahsulot o‘chirildi", "product", id, undefined, staff.id);
    });
  },
  setProductAvailability(id: string, available: boolean, staff: Staff) {
    mutate((d) => {
      d.products = d.products.map((x) => (x.id === id ? { ...x, available } : x));
      pushLog(d, staff.role, staff.name, available ? "Mahsulot yoqildi" : "Mahsulot o‘chirildi (mavjud emas)", "product", id, undefined, staff.id);
    });
  },

  /**
   * One-click discount on a menu item. The price stays the selling price and
   * `oldPrice` carries the crossed-out original, which the customer card reads
   * as `−N%`. Passing 0 removes the discount.
   */
  setProductDiscount(id: string, percent: number, staff: Staff) {
    const pct = Math.max(0, Math.min(90, Math.round(percent)));
    mutate((d) => {
      const p = d.products.find((x) => x.id === id);
      if (!p) return;
      if (pct === 0 || p.price <= 0) {
        d.products = d.products.map((x) => (x.id === id ? { ...x, oldPrice: undefined, isPromotion: false } : x));
      } else {
        const base = p.oldPrice && p.oldPrice > p.price ? p.oldPrice : p.price;
        const nextPrice = Math.round((base * (100 - pct)) / 100 / 500) * 500;
        d.products = d.products.map((x) =>
          x.id === id
            ? { ...x, price: nextPrice, oldPrice: base, isPromotion: true }
            : x
        );
      }
      pushLog(
        d,
        staff.role,
        staff.name,
        pct === 0 ? `Chegirma olib tashlandi: ${p.nameUz}` : `Chegirma ${pct}%: ${p.nameUz}`,
        "product",
        id,
        p.nameUz,
        staff.id
      );
    });
  },

  /** Purchase cost used for profit reporting. */
  setProductCost(id: string, cost: number, staff: Staff) {
    mutate((d) => {
      const p = d.products.find((x) => x.id === id);
      if (!p) return;
      d.products = d.products.map((x) => (x.id === id ? { ...x, cost: Math.max(0, Math.round(cost)) } : x));
      pushLog(d, staff.role, staff.name, `Tannarx o‘zgartirildi: ${p.nameUz}`, "product", id, `Eski: ${p.cost} → Yangi: ${cost}`, staff.id);
    });
  },
  saveCategory(c: Category, staff: Staff) {
    return mutate((d) => {
      const exists = d.categories.some((x) => x.id === c.id);
      d.categories = exists
        ? d.categories.map((x) => (x.id === c.id ? c : x))
        : [...d.categories, c];
      d.categories = [...d.categories].sort((a, b) => a.sortOrder - b.sortOrder);
      pushLog(d, staff.role, staff.name, exists ? "Kategoriya tahrirlandi" : "Kategoriya qo‘shildi", "category", c.id, c.nameUz, staff.id);
    });
  },
  deleteCategory(id: string, staff: Staff) {
    mutate((d) => {
      d.categories = d.categories.filter((x) => x.id !== id);
      pushLog(d, staff.role, staff.name, "Kategoriya o‘chirildi", "category", id, undefined, staff.id);
    });
  },

  // ---------- orders ----------
  createOrder(input: {
    tableId: string | null;
    sessionId: string | null;
    type: OrderType;
    items: { productId: string; qty: number; note?: string }[];
    note?: string;
    promoCode?: string;
    customerToken?: string | null;
    staff?: Staff | null;
    /** Delivery / pre-order details (no registration — order-scoped). */
    customerName?: string;
    customerPhone?: string;
    address?: string;
    scheduledFor?: number;
    deliveryFee?: number;
    paymentMethod?: PaymentMethod;
  }): Order | null {
    if (!input.items.length) return null;
    // A guest order must belong to a live table session — a closed session can
    // never place another order (staff may have settled that table already).
    if (input.sessionId) {
      const session = db.sessions.find((s) => s.id === input.sessionId);
      if (!session || !session.active) return null;
    }
    let created: Order | null = null;
    mutate((d) => {
      const table = input.tableId ? d.tables.find((t) => t.id === input.tableId) : null;
      const items: OrderItem[] = [];
      for (const line of input.items) {
        const product = d.products.find((p) => p.id === line.productId);
        if (!product || !product.available) continue;
        const qty = Math.max(1, Math.min(99, Math.floor(line.qty)));
        items.push({
          id: uid("itm"),
          productId: product.id,
          nameUz: product.nameUz,
          nameRu: product.nameRu,
          nameEn: product.nameEn,
          price: product.price, // server-side price snapshot
          cost: product.cost ?? 0, // cost snapshot → profit reporting
          qty,
          note: line.note,
          delivered: false,
        });
      }
      if (!items.length) return;
      const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
      // promotions
      let discountPct = 0;
      const code = input.promoCode?.trim().toUpperCase();
      if (code) {
        const promo = d.promotions.find((p) => p.active && p.code?.toUpperCase() === code);
        if (promo) discountPct = promo.discountPct;
      }
      if (!discountPct) {
        const hh = d.promotions.find((p) => p.active && p.happyHours);
        if (hh) {
          const h = new Date().getHours();
          const from = Number(hh.from.split(":")[0]);
          const to = Number(hh.to.split(":")[0]);
          if (h >= from && h < to) discountPct = hh.discountPct;
        }
      }
      const discount = Math.round((subtotal * discountPct) / 100);
      const deliveryFee = input.type === "DELIVERY" ? Math.max(0, Math.floor(input.deliveryFee ?? 0)) : 0;
      const total = subtotal - discount + deliveryFee;
      const number = d.counters.orderNumber + 1;
      const order: Order = {
        id: uid("ord"),
        number,
        tableId: input.tableId,
        sessionId: input.sessionId,
        tableLabel: table ? `Stol ${table.number}` : "—",
        type: input.type,
        status: "NEW",
        items,
        note: input.note ?? "",
        subtotal,
        discount,
        total,
        promoCode: code || undefined,
        paid: false,
        paymentMethod: input.paymentMethod,
        customerName: input.customerName?.trim() || undefined,
        customerPhone: input.customerPhone?.trim() || undefined,
        address: input.address?.trim() || undefined,
        scheduledFor: input.scheduledFor,
        deliveryFee: deliveryFee || undefined,
        createdByStaffId: input.staff?.id ?? null,
        customerToken: input.customerToken ?? null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      d.orders = [order, ...d.orders];
      d.counters = { orderNumber: number };
      if (table) {
        d.tables = d.tables.map((t) => (t.id === table.id ? { ...t, status: "OCCUPIED" as TableStatus } : t));
      }
      pushLog(
        d,
        input.staff?.role ?? "CUSTOMER",
        input.staff?.name ?? "Mijoz",
        `Buyurtma yaratildi #${String(number).padStart(4, "0")}`,
        "order",
        order.id,
        table ? `Stol ${table.number}` : undefined,
        input.staff?.id ?? null
      );
      pushNotification(d, "kitchen", "ORDER_CREATED", "Yangi buyurtma", `#${String(number).padStart(4, "0")} · ${order.tableLabel}`, table?.number);
      pushNotification(d, "admin", "ORDER_CREATED", "Yangi buyurtma", `#${String(number).padStart(4, "0")} · ${order.tableLabel}`, table?.number);
      pushNotification(d, "waiter", "ORDER_CREATED", "Yangi buyurtma", `#${String(number).padStart(4, "0")} · ${order.tableLabel}`, table?.number);
      created = order;
    });
    const order = created as Order | null;
    if (order) {
      emitEvent({ type: "ORDER_CREATED", at: Date.now(), orderId: order.id, orderNumber: order.number, tableNumber: db.tables.find((t) => t.id === order.tableId)?.number, message: "Yangi buyurtma" });
    }
    return order;
  },

  updateOrderStatus(orderId: string, next: OrderStatus, staff?: Staff | null) {
    mutate((d) => {
      const order = d.orders.find((o) => o.id === orderId);
      if (!order) return;
      if (!canTransition(order.status, next)) return;
      const now = Date.now();
      const patch: Partial<Order> = { status: next, updatedAt: now };
      if (next === "ACCEPTED") patch.acceptedAt = now;
      if (next === "PREPARING") patch.preparingAt = now;
      if (next === "READY") patch.readyAt = now;
      if (next === "DELIVERED") {
        patch.deliveredAt = now;
        patch.items = order.items.map((i) => ({ ...i, delivered: true }));
      }
      if (next === "COMPLETED") patch.completedAt = now;
      d.orders = d.orders.map((o) => (o.id === orderId ? { ...o, ...patch } : o));
      const t = order.tableId ? d.tables.find((x) => x.id === order.tableId) : null;
      pushLog(d, staff?.role ?? "SYSTEM", staff?.name ?? "Tizim", `Buyurtma statusi: ${next}`, "order", orderId, `#${String(order.number).padStart(4, "0")}`, staff?.id ?? null);
      // audience-specific notifications
      if (next === "READY") {
        pushNotification(d, "waiter", "ORDER_READY", "Buyurtma tayyor!", `${order.tableLabel} · #${String(order.number).padStart(4, "0")}`, t?.number);
      }
      if (next === "DELIVERED") {
        pushNotification(d, "customer", "ORDER_DELIVERED", "Buyurtmangiz yetkazildi", `${order.tableLabel} buyurtmasi stolingizga yetkazildi.`, t?.number, order.sessionId);
      }
      if (next === "ACCEPTED") {
        pushNotification(d, "customer", "ORDER_ACCEPTED", "Buyurtma qabul qilindi", "Buyurtmangiz qabul qilindi.", t?.number, order.sessionId);
      }
      if (next === "PREPARING") {
        pushNotification(d, "customer", "ORDER_PREPARING", "Tayyorlanmoqda", "Buyurtmangiz tayyorlanmoqda.", t?.number, order.sessionId);
      }
    });
    const order = db.orders.find((o) => o.id === orderId);
    emitEvent({
      type:
        next === "ACCEPTED"
          ? "ORDER_ACCEPTED"
          : next === "PREPARING"
          ? "ORDER_PREPARING"
          : next === "READY"
          ? "ORDER_READY"
          : next === "DELIVERED"
          ? "ORDER_DELIVERED"
          : next === "COMPLETED"
          ? "ORDER_COMPLETED"
          : next === "CANCELLED"
          ? "ORDER_CANCELLED"
          : "DATA_CHANGED",
      at: Date.now(),
      orderId,
      orderNumber: order?.number,
      tableNumber: db.tables.find((t) => t.id === order?.tableId)?.number,
    });
  },

  addItemToOrder(orderId: string, productId: string, qty: number, staff: Staff) {
    mutate((d) => {
      const order = d.orders.find((o) => o.id === orderId);
      const product = d.products.find((p) => p.id === productId);
      if (!order || !product) return;
      if (order.status === "COMPLETED" || order.status === "CANCELLED") return;
      const existing = order.items.find((i) => i.productId === productId);
      let items: OrderItem[];
      if (existing) {
        items = order.items.map((i) => (i.id === existing.id ? { ...i, qty: i.qty + qty } : i));
      } else {
        items = [
          ...order.items,
          { id: uid("itm"), productId: product.id, nameUz: product.nameUz, nameRu: product.nameRu, nameEn: product.nameEn, price: product.price, cost: product.cost ?? 0, qty, delivered: false },
        ];
      }
      const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
      const discount = Math.round((subtotal * (order.subtotal ? order.discount / order.subtotal : 0)) * 100) / 100;
      d.orders = d.orders.map((o) => (o.id === orderId ? { ...o, items, subtotal, discount, total: subtotal - discount, updatedAt: Date.now() } : o));
      pushLog(d, staff.role, staff.name, `Mahsulot qo‘shildi: ${product.nameUz} x${qty}`, "order", orderId, `#${String(order.number).padStart(4, "0")}`, staff.id);
      pushNotification(d, "customer", "ORDER_UPDATED", "Buyurtma yangilandi", `${product.nameUz} x${qty} qo‘shildi.`, null, order.sessionId);
    });
    const order = db.orders.find((o) => o.id === orderId);
    emitEvent({ type: "DATA_CHANGED", at: Date.now(), orderId, orderNumber: order?.number, message: "Buyurtma yangilandi" });
  },

  updateItemQty(orderId: string, itemId: string, qty: number, staff: Staff) {
    mutate((d) => {
      const order = d.orders.find((o) => o.id === orderId);
      if (!order || order.status === "COMPLETED" || order.status === "CANCELLED") return;
      const items = order.items
        .map((i) => (i.id === itemId ? { ...i, qty } : i))
        .filter((i) => i.qty > 0);
      const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
      const ratio = order.subtotal ? order.discount / order.subtotal : 0;
      const discount = Math.round(subtotal * ratio);
      d.orders = d.orders.map((o) => (o.id === orderId ? { ...o, items, subtotal, discount, total: subtotal - discount, updatedAt: Date.now() } : o));
      pushLog(d, staff.role, staff.name, "Buyurtma miqdori o‘zgartirildi", "order", orderId, undefined, staff.id);
    });
  },

  removeItem(orderId: string, itemId: string, staff: Staff) {
    mutate((d) => {
      const order = d.orders.find((o) => o.id === orderId);
      if (!order || order.status === "COMPLETED" || order.status === "CANCELLED") return;
      const items = order.items.filter((i) => i.id !== itemId);
      const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
      const ratio = order.subtotal ? order.discount / order.subtotal : 0;
      const discount = Math.round(subtotal * ratio);
      d.orders = d.orders.map((o) => (o.id === orderId ? { ...o, items, subtotal, discount, total: subtotal - discount, updatedAt: Date.now() } : o));
      pushLog(d, staff.role, staff.name, "Mahsulot o‘chirildi", "order", orderId, undefined, staff.id);
    });
  },

  cancelOrder(orderId: string, staff: Staff, reason: string) {
    mutate((d) => {
      const order = d.orders.find((o) => o.id === orderId);
      if (!order) return;
      d.orders = d.orders.map((o) => (o.id === orderId ? { ...o, status: "CANCELLED" as OrderStatus, updatedAt: Date.now() } : o));
      pushLog(d, staff.role, staff.name, "Buyurtma bekor qilindi", "order", orderId, reason, staff.id);
    });
    emitEvent({ type: "ORDER_CANCELLED", at: Date.now(), orderId });
  },

  transferTable(orderId: string, newTableId: string, staff: Staff) {
    mutate((d) => {
      const order = d.orders.find((o) => o.id === orderId);
      const table = d.tables.find((t) => t.id === newTableId);
      if (!order || !table) return;
      d.orders = d.orders.map((o) =>
        o.id === orderId ? { ...o, tableId: table.id, tableLabel: `Stol ${table.number}`, updatedAt: Date.now() } : o
      );
      pushLog(d, staff.role, staff.name, `Buyurtma ko‘chirildi → Stol ${table.number}`, "order", orderId, undefined, staff.id);
    });
  },

  // ---------- waiter calls ----------
  createCall(tableId: string, type: CallType, note: string, tableNumber?: number): WaiterCall | null {
    const table = db.tables.find((t) => t.id === tableId);
    if (!table) return null;
    const call: WaiterCall = {
      id: uid("call"),
      tableId,
      tableNumber: tableNumber ?? table.number,
      type,
      status: "PENDING",
      note,
      createdAt: Date.now(),
      handledByStaffId: null,
    };
    mutate((d) => {
      d.calls = [call, ...d.calls];
      pushLog(d, "CUSTOMER", "Mijoz", type === "BILL" ? "Hisob so‘raldi" : "Ofitsant chaqirildi", "call", call.id, `Stol ${call.tableNumber}`);
      pushNotification(
        d,
        type === "BILL" ? "cashier" : "waiter",
        "WAITER_CALLED",
        type === "BILL" ? "Hisob so‘ralmoqda" : "Ofitsant chaqirilmoqda",
        `Stol №${call.tableNumber}${note ? " · " + note : ""}`,
        call.tableNumber
      );
      pushNotification(d, "admin", "WAITER_CALLED", "Chaqiruv", `Stol №${call.tableNumber}`, call.tableNumber);
    });
    emitEvent({
      type: type === "BILL" ? "PAYMENT_REQUESTED" : "WAITER_CALLED",
      at: Date.now(),
      tableNumber: call.tableNumber,
      message: type === "BILL" ? "Hisob so‘ralmoqda" : "Ofitsant chaqirilmoqda",
    });
    return call;
  },

  setCallStatus(callId: string, status: CallStatus, staff: Staff) {
    mutate((d) => {
      d.calls = d.calls.map((c) =>
        c.id === callId
          ? {
              ...c,
              status,
              acceptedAt: status === "ACCEPTED" ? Date.now() : c.acceptedAt,
              completedAt: status === "COMPLETED" ? Date.now() : c.completedAt,
              handledByStaffId: staff.id,
            }
          : c
      );
      const call = d.calls.find((c) => c.id === callId);
      pushLog(d, staff.role, staff.name, `Chaqiruv: ${status}`, "call", callId, call ? `Stol ${call.tableNumber}` : undefined, staff.id);
    });
  },

  // ---------- payments ----------
  closeTable(tableId: string, method: PaymentMethod, staff: Staff): Payment | null {
    let payment: Payment | null = null;
    mutate((d) => {
      const table = d.tables.find((t) => t.id === tableId);
      if (!table) return;
      const active = d.orders.filter(
        (o) => o.tableId === tableId && o.status !== "CANCELLED" && !o.paid
      );
      if (!active.length) return;
      const amount = active.reduce((s, o) => s + o.total, 0);
      payment = {
        id: uid("pay"),
        orderIds: active.map((o) => o.id),
        tableId,
        tableNumber: table.number,
        amount,
        method,
        staffId: staff.id,
        createdAt: Date.now(),
      };
      d.payments = [payment, ...d.payments];
      d.orders = d.orders.map((o) =>
        active.some((a) => a.id === o.id)
          ? { ...o, paid: true, paymentMethod: method, status: "COMPLETED" as OrderStatus, completedAt: Date.now(), updatedAt: Date.now() }
          : o
      );
      d.sessions = d.sessions.map((s) => (s.tableId === tableId ? { ...s, active: false } : s));
      d.tables = d.tables.map((t) => (t.id === tableId ? { ...t, status: "EMPTY" as TableStatus } : t));
      d.calls = d.calls.map((c) =>
        c.tableId === tableId && c.status !== "COMPLETED" ? { ...c, status: "COMPLETED" as CallStatus, completedAt: Date.now() } : c
      );
      pushLog(d, staff.role, staff.name, `Hisob yopildi: ${amount}`, "payment", payment.id, `Stol ${table.number}`, staff.id);
      active.forEach((o) => {
        pushNotification(d, "customer", "ORDER_COMPLETED", "Rahmat!", "Buyurtmangiz muvaffaqiyatli yakunlandi.", table.number, o.sessionId);
      });
    });
    if (payment) {
      emitEvent({ type: "PAYMENT_COMPLETED", at: Date.now(), tableNumber: db.tables.find((t) => t.id === tableId)?.number });
    }
    return payment;
  },

  // ---------- staff ----------
  saveStaff(s: Staff, actor: Staff) {
    // never persist a plaintext password — hashing is idempotent, so edit
    // forms that re-submit the stored hash leave it untouched
    const rec: Staff = { ...s, password: hashPassword(s.password) };
    mutate((d) => {
      const exists = d.staff.some((x) => x.id === rec.id);
      d.staff = exists ? d.staff.map((x) => (x.id === rec.id ? rec : x)) : [...d.staff, rec];
      pushLog(d, actor.role, actor.name, exists ? "Xodim tahrirlandi" : "Xodim qo‘shildi", "staff", rec.id, rec.name, actor.id);
    });
    mirrorStaffToAll(); // the same login must work in every branch
  },
  deleteStaff(id: string, actor: Staff) {
    mutate((d) => {
      d.staff = d.staff.filter((x) => x.id !== id);
      pushLog(d, actor.role, actor.name, "Xodim o‘chirildi", "staff", id, undefined, actor.id);
    });
    mirrorStaffToAll();
  },
  setStaffPermissions(id: string, permissions: PermissionKey[], actor: Staff) {
    mutate((d) => {
      d.staff = d.staff.map((x) => (x.id === id ? { ...x, permissions } : x));
      pushLog(d, actor.role, actor.name, "Ruxsatlar yangilandi", "staff", id, undefined, actor.id);
    });
    mirrorStaffToAll();
  },

  // ---------- promotions ----------
  savePromotion(p: Promotion, actor: Staff) {
    mutate((d) => {
      const exists = d.promotions.some((x) => x.id === p.id);
      d.promotions = exists ? d.promotions.map((x) => (x.id === p.id ? p : x)) : [...d.promotions, p];
      pushLog(d, actor.role, actor.name, exists ? "Aksiya tahrirlandi" : "Aksiya qo‘shildi", "promotion", p.id, p.title, actor.id);
    });
  },
  deletePromotion(id: string, actor: Staff) {
    mutate((d) => {
      d.promotions = d.promotions.filter((x) => x.id !== id);
      pushLog(d, actor.role, actor.name, "Aksiya o‘chirildi", "promotion", id, undefined, actor.id);
    });
  },

  // ---------- settings ----------
  saveSettings(patch: Partial<DB["settings"]>, actor: Staff) {
    mutate((d) => {
      d.settings = { ...d.settings, ...patch };
      pushLog(d, actor.role, actor.name, "Sozlamalar yangilandi", "settings", undefined, undefined, actor.id);
    });
  },

  // ---------- notifications ----------
  markNotificationRead(id: string) {
    mutate((d) => {
      d.notifications = d.notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
    });
  },
  markAllNotificationsRead(audience: AppNotification["audience"]) {
    mutate((d) => {
      d.notifications = d.notifications.map((n) => (n.audience === audience ? { ...n, read: true } : n));
    });
  },

  // ---------- developer console (/yumidev) ----------
  /**
   * Separate developer credentials, independent of staff accounts. On success
   * the caller receives the hidden developer staff record which acts as the
   * author of every developer-console mutation (so logs stay truthful).
   */
  devLogin(username: string, password: string): Staff | null {
    const match =
      db.dev &&
      db.dev.username.toLowerCase() === username.trim().toLowerCase() &&
      verifyPassword(db.dev.password, password);
    if (!match) return null;
    const actor = db.staff.find((s) => s.username === DEV_STAFF_USERNAME) ?? null;
    if (actor) {
      pushLog(db, actor.role, "Developer", "Developer konsoliga kirdi", "dev", actor.id, undefined, actor.id);
      db = { ...db };
      persist();
      emit();
    }
    return actor;
  },

  devActor(): Staff | null {
    return db.staff.find((s) => s.username === DEV_STAFF_USERNAME) ?? null;
  },

  setDevCredentials(patch: { username?: string; password?: string }) {
    mutate((d) => {
      d.dev = {
        ...d.dev,
        ...patch,
        ...(patch.password ? { password: hashPassword(patch.password) } : {}),
      };
    });
    mirrorStaffToAll(); // developer key works from any branch
  },

  /** Raw dump of the whole database (developer export / inspection). */
  exportDB(): DB {
    return JSON.parse(JSON.stringify(db)) as DB;
  },

  importDB(raw: string): { ok: boolean; error?: string } {
    try {
      const parsed = JSON.parse(raw) as DB;
      if (!parsed || !Array.isArray(parsed.products) || !Array.isArray(parsed.tables)) {
        return { ok: false, error: "Noto‘g‘ri format: products va tables massiv bo‘lishi kerak" };
      }
      const keepDev = db.dev;
      mutate((d) => {
        Object.assign(d, parsed);
        // an imported snapshot must not be able to hijack the developer key
        d.dev = keepDev?.password ? keepDev : d.dev ?? { username: "dev", password: hashPassword("yumidev2026") };
        // an imported dump may carry legacy plaintext credentials
        migratePasswords(d);
      });
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "JSON o‘qib bo‘lmadi" };
    }
  },

  /** Wipe selected collections. `all` restores the full factory seed. */
  devWipe(scope: "orders" | "sessions" | "logs" | "products" | "staff" | "all") {
    if (scope === "all") {
      resetDemoData();
      return;
    }
    mutate((d) => {
      if (scope === "orders") {
        d.orders = [];
        d.payments = [];
        d.calls = [];
        d.tables = d.tables.map((t) => ({ ...t, status: "EMPTY" as TableStatus }));
      }
      if (scope === "sessions") {
        d.sessions = [];
        d.tables = d.tables.map((t) => ({ ...t, status: "EMPTY" as TableStatus }));
      }
      if (scope === "logs") d.logs = [];
      if (scope === "products") d.products = [];
      if (scope === "staff") d.staff = d.staff.filter((s) => s.username === DEV_STAFF_USERNAME);
      pushLog(d, "SYSTEM", "Developer", `Developer: ${scope} tozalandi`, "dev", undefined, undefined, null);
    });
  },
};

export function usePermission(staff: Staff | null, key: PermissionKey): boolean {
  return useMemo(() => {
    if (!staff) return false;
    const perms = staff.permissions?.length ? staff.permissions : permissionsForRole(staff.role);
    return perms.includes(key) || perms.includes("override");
  }, [staff, key]);
}

// Convenience context hook used by admin/waiter shells
export function useDataContext() {
  return useContext(DataCtx);
}

export function useNow(interval = 30_000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(t);
  }, [interval]);
  return now;
}
