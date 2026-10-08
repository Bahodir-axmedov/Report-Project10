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
import { buildSeedDB, DEV_STAFF_USERNAME } from "./seed";
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
} from "./types";
import { canTransition, randomToken, uid } from "./utils";
import { permissionsForRole } from "./permissions";

const DB_KEY = "yumi.db.v5";
const CHANNEL = "yumi.realtime.v5";
const CURRENT_VERSION = 3;

function load(): DB {
  // The developer key belongs to the developer, not to the seeded demo data:
  // a version bump / factory reset must never roll it back to the defaults.
  let keepDev: DB["dev"] | null = null;
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DB;
      if (parsed?.dev?.password) keepDev = parsed.dev;
      if (parsed && parsed.version === CURRENT_VERSION && Array.isArray(parsed.products)) return parsed;
    }
  } catch {
    /* ignore corrupt storage */
  }
  const seeded = buildSeedDB();
  if (keepDev) seeded.dev = keepDev;
  localStorage.setItem(DB_KEY, JSON.stringify(seeded));
  return seeded;
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

function persist() {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  } catch {
    /* quota */
  }
}

/** Apply a mutation atomically, persist, notify local + other tabs. */
function mutate(fn: (d: DB) => void): void {
  fn(db);
  db = { ...db };
  persist();
  emit();
  channel?.postMessage({ kind: "sync", at: Date.now() });
}

function emitEvent(e: OrderStatusEvent) {
  eventListeners.forEach((l) => l(e));
  channel?.postMessage({ kind: "event", event: e });
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
      | { kind: "sync" }
      | { kind: "event"; event: OrderStatusEvent }
      | { kind: "request-sync" };
    if (data?.kind === "sync") {
      db = load();
      emit();
    } else if (data?.kind === "event") {
      eventListeners.forEach((l) => l(data.event));
    } else if (data?.kind === "request-sync") {
      channel?.postMessage({ kind: "sync", at: Date.now() });
    }
  };
  channel.postMessage({ kind: "request-sync" });
}

export function getDB(): DB {
  return db;
}

export function resetDemoData() {
  // Keep the developer credentials across a factory reset (handover safety).
  const keepDev = db.dev;
  localStorage.removeItem(DB_KEY);
  db = load();
  if (keepDev?.password) {
    db = { ...db, dev: keepDev };
    persist();
  }
  emit();
  channel?.postMessage({ kind: "sync", at: Date.now() });
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
  // ---------- auth ----------
  login(username: string, password: string): Staff | null {
    const s = db.staff.find(
      (x) => x.username.toLowerCase() === username.trim().toLowerCase() && x.password === password
    );
    if (!s || !s.active) return null;
    pushLog(db, s.role, s.name, "Tizimga kirdi", "auth", s.id);
    db = { ...db };
    persist();
    emit();
    return s;
  },

  // ---------- tables ----------
  resolveTableByToken(token: string): RestaurantTable | null {
    const t = db.tables.find((x) => x.qrToken === token);
    return t && t.active ? t : t ?? null;
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
      qrToken: "yumi-" + input.number + "-" + randomToken(12),
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
    const token = "yumi-" + randomToken(16);
    mutate((d) => {
      d.tables = d.tables.map((t) => (t.id === id ? { ...t, qrToken: token } : t));
      pushLog(d, staff.role, staff.name, "QR token yangilandi", "table", id, undefined, staff.id);
    });
    return token;
  },

  // ---------- catalog ----------
  saveProduct(p: Product, staff: Staff) {
    mutate((d) => {
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
    mutate((d) => {
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
      const total = subtotal - discount;
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
    mutate((d) => {
      const exists = d.staff.some((x) => x.id === s.id);
      d.staff = exists ? d.staff.map((x) => (x.id === s.id ? s : x)) : [...d.staff, s];
      pushLog(d, actor.role, actor.name, exists ? "Xodim tahrirlandi" : "Xodim qo‘shildi", "staff", s.id, s.name, actor.id);
    });
  },
  deleteStaff(id: string, actor: Staff) {
    mutate((d) => {
      d.staff = d.staff.filter((x) => x.id !== id);
      pushLog(d, actor.role, actor.name, "Xodim o‘chirildi", "staff", id, undefined, actor.id);
    });
  },
  setStaffPermissions(id: string, permissions: PermissionKey[], actor: Staff) {
    mutate((d) => {
      d.staff = d.staff.map((x) => (x.id === id ? { ...x, permissions } : x));
      pushLog(d, actor.role, actor.name, "Ruxsatlar yangilandi", "staff", id, undefined, actor.id);
    });
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
      db.dev.password === password;
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
      d.dev = { ...d.dev, ...patch };
    });
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
        d.dev = keepDev?.password ? keepDev : d.dev ?? { username: "dev", password: "yumidev2026" };
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
