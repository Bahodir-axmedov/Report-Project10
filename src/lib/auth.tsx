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
import { dropPresence, kickTimestamp, touchPresence } from "./presence";
import type { PermissionKey, Role, Staff } from "./types";
import { permissionsForRole, ROLE_LABELS } from "./permissions";

const AUTH_KEY = "yumi.auth.v1";

interface AuthValue {
  staff: Staff | null;
  /** Sign in. When `expectedRole` is given the account must match that role (or one of them).
   * `branchId` is the branch picked on the login screen — the tab switches to it
   * only after the credentials check out. */
  login: (
    username: string,
    password: string,
    expectedRole?: Role | Role[],
    branchId?: string
  ) => { ok: boolean; error?: string };
  /** Trusted sign-in used by the developer console after it verifies its own credentials. */
  loginAs: (staffId: string) => void;
  logout: () => void;
  has: (key: PermissionKey) => boolean;
  role: Role | null;
}

const AuthCtx = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const db = useDB();
  const [staffId, setStaffId] = useState<string | null>(() => {
    try {
      const raw = localStorage.getItem(AUTH_KEY);
      if (!raw) return null;
      // New format: {staffId, branchId}; legacy: plain staff id.
      if (raw.startsWith("{")) return (JSON.parse(raw) as { staffId?: string }).staffId ?? null;
      return raw;
    } catch {
      return null;
    }
  });

  const staff = useMemo(() => {
    if (!staffId) return null;
    const s = db.staff.find((x) => x.id === staffId) ?? null;
    return s && s.active ? s : null;
  }, [db.staff, staffId]);

  useEffect(() => {
    if (staffId && !staff) {
      // logged-out / disabled account
      try {
        localStorage.removeItem(AUTH_KEY);
      } catch {
        /* noop */
      }
    }
  }, [staffId, staff]);

  const login = useCallback(
    (username: string, password: string, expectedRole?: Role | Role[], branchId?: string) => {
      // Role check happens BEFORE any side effects: a mismatched account never
      // switches branches and never writes an auth log.
      const { staff: s, roleMismatch } = api.login(username, password, branchId, expectedRole);
      if (roleMismatch) {
        return {
          ok: false,
          error: `Bu hisob «${ROLE_LABELS[roleMismatch]}» roliga tegishli. Yuqoridan to‘g‘ri rolni tanlang.`,
        };
      }
      if (!s) return { ok: false, error: "Login yoki parol xato" };
      try {
        localStorage.setItem(
          AUTH_KEY,
          JSON.stringify({
            staffId: s.id,
            branchId: branchId ?? api.activeBranchId(),
            loginAt: Date.now(),
          })
        );
      } catch {
        /* noop */
      }
      setStaffId(s.id);
      return { ok: true };
    },
    []
  );

  const loginAs = useCallback((id: string) => {
    try {
      localStorage.setItem(
        AUTH_KEY,
        JSON.stringify({ staffId: id, branchId: api.activeBranchId(), loginAt: Date.now() })
      );
    } catch {
      /* noop */
    }
    setStaffId(id);
  }, []);

  const logout = useCallback(() => {
    try {
      localStorage.removeItem(AUTH_KEY);
    } catch {
      /* noop */
    }
    setStaffId(null);
  }, []);

  // Cross-tab heartbeat: shows every open session in the developer console
  // "Onlayn xodimlar" card, and lets the developer kick a session out.
  useEffect(() => {
    touchPresence();
    const t = setInterval(touchPresence, 20_000);
    const onHide = () => dropPresence();
    window.addEventListener("pagehide", onHide);
    return () => {
      clearInterval(t);
      window.removeEventListener("pagehide", onHide);
    };
  }, []);

  // Forced logout: a kick newer than this session's login time ends it.
  useEffect(() => {
    const check = () => {
      if (!staffId) return;
      try {
        const raw = localStorage.getItem(AUTH_KEY);
        if (!raw?.startsWith("{")) return;
        const loginAt = (JSON.parse(raw) as { loginAt?: number }).loginAt ?? 0;
        if (kickTimestamp(staffId, loginAt)) {
          localStorage.removeItem(AUTH_KEY);
          setStaffId(null);
        }
      } catch {
        /* noop */
      }
    };
    check();
    const t = setInterval(check, 5_000);
    window.addEventListener("focus", check);
    return () => {
      clearInterval(t);
      window.removeEventListener("focus", check);
    };
  }, [staffId]);

  const has = useCallback(
    (key: PermissionKey) => {
      if (!staff) return false;
      const perms = staff.permissions?.length ? staff.permissions : permissionsForRole(staff.role);
      return perms.includes(key) || perms.includes("override");
    },
    [staff]
  );

  const value: AuthValue = {
    staff,
    login,
    loginAs,
    logout,
    has,
    role: staff?.role ?? null,
  };

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

/** Where each role should land after sign-in. */
export function homeForRole(role: Role | null): string {
  return role === "WAITER" ? "/waiter" : "/admin";
}

export function allPermissions(): PermissionKey[] {
  return permissionsForRole("ADMIN");
}
