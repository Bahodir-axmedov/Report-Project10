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
import type { PermissionKey, Role, Staff } from "./types";
import { permissionsForRole, ROLE_LABELS } from "./permissions";

const AUTH_KEY = "yumi.auth.v1";

interface AuthValue {
  staff: Staff | null;
  /** Sign in. When `expectedRole` is given the account must match that role (or one of them). */
  login: (username: string, password: string, expectedRole?: Role | Role[]) => { ok: boolean; error?: string };
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
      return localStorage.getItem(AUTH_KEY);
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
    (username: string, password: string, expectedRole?: Role | Role[]) => {
      const s = api.login(username, password);
      if (!s) return { ok: false, error: "Login yoki parol xato" };
      const allowed = expectedRole ? (Array.isArray(expectedRole) ? expectedRole : [expectedRole]) : null;
      if (allowed && !allowed.includes(s.role)) {
        return {
          ok: false,
          error: `Bu hisob «${ROLE_LABELS[s.role]}» roliga tegishli. Yuqoridan to‘g‘ri rolni tanlang.`,
        };
      }
      try {
        localStorage.setItem(AUTH_KEY, s.id);
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
      localStorage.setItem(AUTH_KEY, id);
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
