import type { PermissionKey, Role } from "./types";

export const ALL_PERMISSIONS: { key: PermissionKey; label: string; group: string }[] = [
  { key: "dashboard.view", label: "Ko‘rish", group: "Dashboard" },
  { key: "orders.view", label: "Ko‘rish", group: "Buyurtmalar" },
  { key: "orders.create", label: "Yaratish", group: "Buyurtmalar" },
  { key: "orders.edit", label: "Tahrirlash", group: "Buyurtmalar" },
  { key: "orders.delete", label: "O‘chirish", group: "Buyurtmalar" },
  { key: "orders.status", label: "Status boshqarish", group: "Buyurtmalar" },
  { key: "tables.view", label: "Ko‘rish", group: "Stollar" },
  { key: "tables.manage", label: "Boshqarish", group: "Stollar" },
  { key: "tables.transfer", label: "Ko‘chirish", group: "Stollar" },
  { key: "products.view", label: "Ko‘rish", group: "Mahsulotlar" },
  { key: "products.manage", label: "Boshqarish", group: "Mahsulotlar" },
  { key: "categories.manage", label: "Boshqarish", group: "Kategoriyalar" },
  { key: "staff.view", label: "Ko‘rish", group: "Xodimlar" },
  { key: "staff.manage", label: "Boshqarish", group: "Xodimlar" },
  { key: "roles.manage", label: "Rollar", group: "Xodimlar" },
  { key: "reports.view", label: "Ko‘rish", group: "Hisobotlar" },
  { key: "analytics.view", label: "Ko‘rish", group: "Analitika" },
  { key: "payments.view", label: "Ko‘rish", group: "To‘lovlar" },
  { key: "payments.process", label: "Yakunlash", group: "To‘lovlar" },
  { key: "calls.view", label: "Ko‘rish", group: "Chaqiruvlar" },
  { key: "calls.handle", label: "Qabul qilish", group: "Chaqiruvlar" },
  { key: "promotions.manage", label: "Boshqarish", group: "Aksiyalar" },
  { key: "qr.manage", label: "QR", group: "Stollar" },
  { key: "kitchen.view", label: "Ko‘rish", group: "Oshxona" },
  { key: "settings.manage", label: "Boshqarish", group: "Sozlamalar" },
  { key: "logs.view", label: "Ko‘rish", group: "Loglar" },
  { key: "override", label: "Override", group: "Tizim" },
];

const P = ALL_PERMISSIONS.map((p) => p.key);

/** Exactly two roles: the administrator owns everything, the waiter runs the floor. */
export const ROLE_PERMISSIONS: Record<Role, PermissionKey[]> = {
  ADMIN: P,
  WAITER: [
    "orders.view",
    "orders.create",
    "orders.edit",
    "orders.status",
    "tables.view",
    "tables.transfer",
    "calls.view",
    "calls.handle",
    "kitchen.view",
    "payments.view",
    "payments.process",
    "products.view",
  ],
};

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrator",
  WAITER: "Ofitsant",
};

export const ROLES: Role[] = ["ADMIN", "WAITER"];

export function permissionsForRole(role: Role): PermissionKey[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

export function hasPermission(
  perms: PermissionKey[] | undefined,
  key: PermissionKey
): boolean {
  if (!perms) return false;
  return perms.includes(key) || perms.includes("override");
}
