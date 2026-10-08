// ---------------------------------------------------------------------------
// YÜMI — domain types (normalized model mirroring the requested Prisma schema)
// ---------------------------------------------------------------------------

export type Lang = "uz" | "ru" | "en";

// The system has exactly two staff roles: an administrator (full control) and
// a waiter (service floor). Everything else is handled by the developer console
// at /yumidev.
export type Role = "ADMIN" | "WAITER";

export type PermissionKey =
  | "dashboard.view"
  | "orders.view"
  | "orders.create"
  | "orders.edit"
  | "orders.delete"
  | "orders.status"
  | "tables.view"
  | "tables.manage"
  | "tables.transfer"
  | "products.view"
  | "products.manage"
  | "categories.manage"
  | "staff.view"
  | "staff.manage"
  | "roles.manage"
  | "reports.view"
  | "analytics.view"
  | "payments.view"
  | "payments.process"
  | "calls.view"
  | "calls.handle"
  | "promotions.manage"
  | "qr.manage"
  | "kitchen.view"
  | "settings.manage"
  | "logs.view"
  | "override";

export type TableStatus = "EMPTY" | "OCCUPIED" | "WAITING" | "BILL";

export type OrderStatus =
  | "NEW"
  | "ACCEPTED"
  | "PREPARING"
  | "READY"
  | "WAITING_FOR_WAITER"
  | "DELIVERED"
  | "COMPLETED"
  | "CANCELLED";

export type OrderType = "DINE_IN" | "PREORDER" | "DELIVERY";

export type CallType = "WAITER" | "BILL" | "KITCHEN";
export type CallStatus = "PENDING" | "ACCEPTED" | "COMPLETED" | "CANCELLED";

export type PaymentMethod = "CASH" | "CARD" | "TERMINAL" | "OTHER";

export interface Staff {
  id: string;
  name: string;
  phone: string;
  username: string;
  password: string; // demo-only local hash
  role: Role;
  active: boolean;
  permissions: PermissionKey[]; // resolved / overridden permissions
  createdAt: number;
}

export interface RestaurantTable {
  id: string;
  number: number;
  qrToken: string;
  status: TableStatus;
  active: boolean;
  seats: number;
  zone: string;
}

export type SessionState = "BROWSING" | "ORDERED" | "BILL";

/** A guest browsing a table — drives the admin "live monitor". */

export interface TableSession {
  id: string;
  tableId: string;
  createdAt: number;
  expiresAt: number;
  active: boolean;
  device: string;
  /** live presence so staff can see what the guest is doing right now */
  lastActivityAt: number;
  viewing: string;
  lastProductId: string | null;
  cart: { productId: string; qty: number }[];
  state: SessionState;
}

export interface Category {
  id: string;
  nameUz: string;
  nameRu: string;
  nameEn: string;
  slug: string;
  icon: string;
  image: string;
  sortOrder: number;
  visible: boolean;
}

export interface Product {
  id: string;
  categoryId: string;
  nameUz: string;
  nameRu: string;
  nameEn: string;
  descriptionUz: string;
  descriptionRu: string;
  descriptionEn: string;
  price: number;
  oldPrice?: number;
  /** purchase cost — used to compute profit in reports */
  cost: number;
  image: string;
  ingredients: string;
  allergens: string;
  calories: number;
  proteins: number;
  fats: number;
  carbs: number;
  weight: number;
  available: boolean;
  isPopular: boolean;
  isNew: boolean;
  isPromotion: boolean;
  sortOrder: number;
  rating: number;
  ratingCount: number;
}

export interface OrderItem {
  id: string;
  productId: string;
  nameUz: string;
  nameRu: string;
  nameEn: string;
  price: number; // price snapshot
  cost: number; // cost snapshot (for profit on historical orders)
  qty: number;
  note?: string;
  delivered: boolean;
}

export interface Order {
  id: string;
  number: number;
  tableId: string | null;
  sessionId: string | null;
  tableLabel: string;
  type: OrderType;
  status: OrderStatus;
  items: OrderItem[];
  note: string;
  subtotal: number;
  discount: number;
  total: number;
  promoCode?: string;
  paid: boolean;
  paymentMethod?: PaymentMethod;
  createdByStaffId: string | null;
  customerToken: string | null;
  createdAt: number;
  updatedAt: number;
  acceptedAt?: number;
  readyAt?: number;
  deliveredAt?: number;
  completedAt?: number;
}

export interface WaiterCall {
  id: string;
  tableId: string;
  tableNumber: number;
  type: CallType;
  status: CallStatus;
  note: string;
  createdAt: number;
  acceptedAt?: number;
  completedAt?: number;
  handledByStaffId?: string | null;
}

export interface Payment {
  id: string;
  orderIds: string[];
  tableId: string | null;
  tableNumber: number;
  amount: number;
  method: PaymentMethod;
  staffId: string | null;
  createdAt: number;
}

export interface Promotion {
  id: string;
  title: string;
  description: string;
  discountPct: number;
  code?: string;
  active: boolean;
  from: string; // "HH:MM" or date
  to: string;
  happyHours?: boolean;
  categoryId?: string | null;
}

export interface ActivityLog {
  id: string;
  at: number;
  staffId: string | null;
  staffName: string;
  role: Role | "CUSTOMER" | "SYSTEM";
  action: string;
  entity: string;
  entityId?: string;
  detail?: string;
}

export interface AppNotification {
  id: string;
  at: number;
  audience: "admin" | "waiter" | "kitchen" | "cashier" | "customer";
  sessionId?: string | null;
  type: string;
  title: string;
  body: string;
  read: boolean;
  tableNumber?: number | null;
}

export interface RestaurantSettings {
  name: string;
  tagline: string;
  description: string;
  phone: string;
  instagram: string;
  telegram: string;
  address: string;
  mapsUrl: string;
  workingHours: string;
  deliveryInfo: string;
  footerText: string;
  currency: string;
  taxPercent: number;
  servicePercent: number;
}

/**
 * A branch (filial) — a second kitchen with its own tables, QR codes, orders
 * and reports. Staff accounts live across branches: you sign in once and pick
 * the branch at login.
 */
export interface BranchMeta {
  id: string;
  name: string;
  createdAt: number;
}

export interface DB {
  version: number;
  staff: Staff[];
  tables: RestaurantTable[];
  sessions: TableSession[];
  categories: Category[];
  products: Product[];
  orders: Order[];
  calls: WaiterCall[];
  payments: Payment[];
  promotions: Promotion[];
  logs: ActivityLog[];
  notifications: AppNotification[];
  settings: RestaurantSettings;
  /** developer console credentials (separate from staff accounts) */
  dev: { username: string; password: string };
  counters: { orderNumber: number };
}

export interface OrderStatusEvent {
  type:
    | "ORDER_CREATED"
    | "ORDER_ACCEPTED"
    | "ORDER_PREPARING"
    | "ORDER_READY"
    | "ORDER_DELIVERED"
    | "ORDER_COMPLETED"
    | "ORDER_CANCELLED"
    | "WAITER_CALLED"
    | "WAITER_ACCEPTED"
    | "WAITER_CALL_COMPLETED"
    | "PAYMENT_REQUESTED"
    | "PAYMENT_COMPLETED"
    | "TABLE_STATUS_CHANGED"
    | "DATA_CHANGED";
  at: number;
  tableNumber?: number;
  orderNumber?: number;
  orderId?: string;
  message?: string;
}
