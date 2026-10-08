import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api, useDB } from "./store";
import type { RestaurantTable, TableSession } from "./types";

const KEY = "yumi.customer.v1";

interface Stored {
  sessionId: string;
  tableId: string;
  createdAt: number;
  /** Branch this guest session belongs to (QR tokens map 1:1 to a branch). */
  branchId?: string;
}

interface CustomerValue {
  session: TableSession | null;
  table: RestaurantTable | null;
  sessionKey: string;
  /** Resolves a QR token across ALL branches (switches this tab into the
   * owning branch) and opens a session there. Returns the resolved table so
   * callers never have to re-search the local database. */
  enterWithToken: (
    token: string
  ) => { ok: boolean; error?: string; table?: RestaurantTable; number?: number };
  leave: () => void;
}

const Ctx = createContext<CustomerValue | null>(null);

function deviceId(): string {
  let d = "";
  try {
    d = localStorage.getItem("yumi.device") ?? "";
    if (!d) {
      d = Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem("yumi.device", d);
    }
  } catch {
    d = "unknown";
  }
  return d;
}

export function CustomerProvider({ children }: { children: ReactNode }) {
  const db = useDB();
  const [stored, setStored] = useState<Stored | null>(() => {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? (JSON.parse(raw) as Stored) : null;
    } catch {
      return null;
    }
  });

  // A guest session lives in exactly ONE branch (QR tokens map 1:1 to a
  // branch). While this tab is still switching branches after a cross-branch
  // scan, `db` can be one render behind — resolving against the branch the
  // session belongs to keeps both the session and its table stable.
  const sourceDb = useMemo(() => {
    const id = stored?.branchId;
    if (!id) return db;
    return api.branchDb(id) ?? db;
  }, [db, stored?.branchId]);

  const session = useMemo(
    () => (stored ? sourceDb.sessions.find((s) => s.id === stored.sessionId) ?? null : null),
    [sourceDb.sessions, stored]
  );
  // The table only resolves while its session is still *active*, so a dangling,
  // closed or reset session can never be used to place an order (checked at
  // render time, not in an effect, to avoid a flash of the menu).
  const table = useMemo(
    () =>
      stored && session && session.active
        ? sourceDb.tables.find((t) => t.id === stored.tableId) ?? null
        : null,
    [sourceDb.tables, stored, session]
  );

  // Drop a stored session that no longer exists in the database (e.g. after a
  // data reset/version bump), was closed by staff, or whose table was removed,
  // so the guest is asked to scan again instead of acting on a stale reference.
  // Checked against the session's OWN branch: a QR from another branch must
  // never look like a dead session just because the tab hasn't caught up yet.
  useEffect(() => {
    if (!stored) return;
    const live = sourceDb.sessions.find((s) => s.id === stored.sessionId);
    const sessionGone = !live || !live.active;
    const tableGone = !sourceDb.tables.some((t) => t.id === stored.tableId);
    if (sessionGone || tableGone) {
      try {
        localStorage.removeItem(KEY);
      } catch {
        /* noop */
      }
      setStored(null);
    }
  }, [stored, sourceDb]);

  const enterWithToken = useCallback(
    (token: string) => {
      // Resolving a QR from another branch moves this tab into that branch,
      // so the session is created in the correct database — branches never
      // share tables, orders or sessions.
      const t = api.resolveTableByToken(token);
      if (!t) return { ok: false, error: "QR kod yaroqsiz yoki topilmadi" };
      if (!t.active) return { ok: false, error: "Bu stol hozircha faol emas" };
      const s = api.getOrCreateSession(t.id, deviceId());
      const next: Stored = {
        sessionId: s.id,
        tableId: t.id,
        createdAt: Date.now(),
        branchId: api.activeBranchId(),
      };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* noop */
      }
      setStored(next);
      return { ok: true, table: t, number: t.number };
    },
    []
  );

  const leave = useCallback(() => {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* noop */
    }
    setStored(null);
  }, []);

  const value: CustomerValue = {
    session,
    table,
    sessionKey: stored?.sessionId ?? stored?.tableId ?? "guest",
    enterWithToken,
    leave,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCustomer(): CustomerValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCustomer must be used within CustomerProvider");
  return ctx;
}
