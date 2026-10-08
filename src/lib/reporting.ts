import type { DB, Order, OrderType, PaymentMethod } from "./types";

export function paidOrders(orders: Order[]): Order[] {
  return orders.filter((o) => o.paid && o.status !== "CANCELLED");
}

export function ordersInRange(db: DB, from: number, to: number): Order[] {
  return db.orders.filter((o) => o.createdAt >= from && o.createdAt <= to);
}

export interface ProductSale {
  productId: string;
  name: string;
  qty: number;
  revenue: number;
  categoryId: string;
}

export interface Summary {
  revenue: number;
  orders: number;
  completed: number;
  cancelled: number;
  active: number;
  preparing: number;
  waiting: number;
  avgOrder: number;
  productsSold: number;
  discount: number;
  deliveryRevenue: number;
  dineInRevenue: number;
  cashSales: number;
  cardSales: number;
  terminalSales: number;
  qrOrders: number;
  waiterOrders: number;
  deliveryOrders: number;
  productSales: ProductSale[];
  categorySales: { categoryId: string; revenue: number; qty: number }[];
  topProduct: ProductSale | null;
  worstProduct: ProductSale | null;
  topCategoryId: string | null;
}

export function summarize(db: DB, from: number, to: number): Summary {
  const orders = ordersInRange(db, from, to);
  const valid = orders.filter((o) => o.status !== "CANCELLED");
  const paid = paidOrders(orders);
  const completed = orders.filter((o) => o.status === "COMPLETED").length;
  const cancelled = orders.filter((o) => o.status === "CANCELLED").length;
  const preparing = orders.filter((o) => o.status === "PREPARING" || o.status === "ACCEPTED").length;
  const waiting = orders.filter((o) => o.status === "READY" || o.status === "WAITING_FOR_WAITER" || o.status === "DELIVERED").length;
  const active = orders.filter((o) => o.status !== "COMPLETED" && o.status !== "CANCELLED").length;

  const productMap = new Map<string, ProductSale>();
  for (const o of valid) {
    for (const it of o.items) {
      const product = db.products.find((p) => p.id === it.productId);
      const key = it.productId;
      const cur = productMap.get(key) ?? {
        productId: key,
        name: it.nameRu,
        qty: 0,
        revenue: 0,
        categoryId: product?.categoryId ?? "",
      };
      cur.qty += it.qty;
      cur.revenue += it.price * it.qty;
      productMap.set(key, cur);
    }
  }
  const productSales = [...productMap.values()].sort((a, b) => b.revenue - a.revenue);

  const catMap = new Map<string, { categoryId: string; revenue: number; qty: number }>();
  for (const ps of productSales) {
    const cur = catMap.get(ps.categoryId) ?? { categoryId: ps.categoryId, revenue: 0, qty: 0 };
    cur.revenue += ps.revenue;
    cur.qty += ps.qty;
    catMap.set(ps.categoryId, cur);
  }
  const categorySales = [...catMap.values()].sort((a, b) => b.revenue - a.revenue);

  const sumByType = (type: OrderType) =>
    valid.filter((o) => o.type === type).reduce((s, o) => s + o.total, 0);
  const sumByMethod = (m: PaymentMethod) =>
    paid.filter((o) => o.paymentMethod === m).reduce((s, o) => s + o.total, 0);

  const revenue = paid.reduce((s, o) => s + o.total, 0);
  const productsSold = valid.reduce((s, o) => s + o.items.reduce((x, i) => x + i.qty, 0), 0);

  const sold = productSales.filter((p) => p.qty > 0);
  return {
    revenue,
    orders: orders.length,
    completed,
    cancelled,
    active,
    preparing,
    waiting,
    avgOrder: paid.length ? Math.round(revenue / paid.length) : 0,
    productsSold,
    discount: paid.reduce((s, o) => s + o.discount, 0),
    deliveryRevenue: sumByType("DELIVERY"),
    dineInRevenue: sumByType("DINE_IN"),
    cashSales: sumByMethod("CASH"),
    cardSales: sumByMethod("CARD"),
    terminalSales: sumByMethod("TERMINAL"),
    qrOrders: valid.filter((o) => o.createdByStaffId === null && o.type === "DINE_IN").length,
    waiterOrders: valid.filter((o) => o.createdByStaffId !== null).length,
    deliveryOrders: valid.filter((o) => o.type === "DELIVERY").length,
    productSales,
    categorySales,
    topProduct: sold[0] ?? null,
    worstProduct: sold.length > 1 ? sold[sold.length - 1] : null,
    topCategoryId: categorySales[0]?.categoryId ?? null,
  };
}

export function revenueByDay(db: DB, days: number): { label: string; revenue: number; orders: number }[] {
  const out: { label: string; revenue: number; orders: number }[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const from = d.getTime();
    const to = from + 86_400_000 - 1;
    const orders = db.orders.filter((o) => o.createdAt >= from && o.createdAt <= to && o.paid && o.status !== "CANCELLED");
    out.push({
      label: d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" }),
      revenue: orders.reduce((s, o) => s + o.total, 0),
      orders: db.orders.filter((o) => o.createdAt >= from && o.createdAt <= to).length,
    });
  }
  return out;
}

export function ordersByHour(db: DB, from: number, to: number): { hour: string; orders: number; revenue: number }[] {
  const buckets = Array.from({ length: 24 }, (_, h) => ({
    hour: String(h).padStart(2, "0"),
    orders: 0,
    revenue: 0,
  }));
  for (const o of ordersInRange(db, from, to)) {
    const h = new Date(o.createdAt).getHours();
    buckets[h].orders += 1;
    if (o.paid) buckets[h].revenue += o.total;
  }
  // trim leading/trailing empty hours for a cleaner chart
  const first = buckets.findIndex((b) => b.orders > 0);
  const last = buckets.length - 1 - [...buckets].reverse().findIndex((b) => b.orders > 0);
  if (first === -1) return buckets.slice(10, 23);
  return buckets.slice(Math.max(0, first - 1), Math.min(24, last + 2));
}

export interface WaiterPerf {
  staffId: string;
  name: string;
  orders: number;
  revenue: number;
  calls: number;
  cancelled: number;
  avgServiceMinutes: number;
}

export function waiterPerformance(db: DB, from: number, to: number): WaiterPerf[] {
  const orders = ordersInRange(db, from, to).filter((o) => o.createdByStaffId);
  const map = new Map<string, WaiterPerf>();
  for (const o of orders) {
    const id = o.createdByStaffId!;
    const staff = db.staff.find((s) => s.id === id);
    const cur =
      map.get(id) ??
      { staffId: id, name: staff?.name ?? "—", orders: 0, revenue: 0, calls: 0, cancelled: 0, avgServiceMinutes: 0 };
    cur.orders += 1;
    if (o.paid) cur.revenue += o.total;
    if (o.status === "CANCELLED") cur.cancelled += 1;
    if (o.deliveredAt) cur.avgServiceMinutes += (o.deliveredAt - o.createdAt) / 60000;
    map.set(id, cur);
  }
  return [...map.values()]
    .map((w) => ({ ...w, avgServiceMinutes: w.orders ? Math.round(w.avgServiceMinutes / w.orders) : 0 }))
    .sort((a, b) => b.revenue - a.revenue);
}

// ---------------------------------------------------------------------------
// Profit engine — revenue vs purchase cost (snapshotted on every order item)
// ---------------------------------------------------------------------------

export interface Profit {
  revenue: number;
  cost: number;
  profit: number;
  marginPct: number;
  orders: number;
  productsSold: number;
  avgProfit: number;
}

/** Cost of a single order line, falling back to the product's current cost. */
export function itemCost(db: DB, productId: string, snapshot?: number): number {
  if (typeof snapshot === "number") return snapshot;
  return db.products.find((p) => p.id === productId)?.cost ?? 0;
}

export function orderCost(db: DB, order: Order): number {
  return order.items.reduce((s, i) => s + itemCost(db, i.productId, i.cost) * i.qty, 0);
}

/** Profit over a window, computed from real order rows (cancelled excluded). */
export function profitIn(db: DB, from: number, to: number): Profit {
  const orders = db.orders.filter(
    (o) => o.createdAt >= from && o.createdAt <= to && o.status !== "CANCELLED"
  );
  let revenue = 0;
  let cost = 0;
  let productsSold = 0;
  for (const o of orders) {
    revenue += o.total;
    cost += orderCost(db, o);
    productsSold += o.items.reduce((s, i) => s + i.qty, 0);
  }
  const profit = revenue - cost;
  return {
    revenue,
    cost,
    profit,
    marginPct: revenue > 0 ? Math.round((profit / revenue) * 1000) / 10 : 0,
    orders: orders.length,
    productsSold,
    avgProfit: orders.length ? Math.round(profit / orders.length) : 0,
  };
}

export interface ProfitBucket extends Profit {
  label: string;
  from: number;
  to: number;
}

/** Profit per day for the last `days` days (oldest first). */
export function profitByDay(db: DB, days: number): ProfitBucket[] {
  const out: ProfitBucket[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const from = d.getTime();
    const to = from + 86_400_000 - 1;
    out.push({
      label: d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" }),
      from,
      to,
      ...profitIn(db, from, to),
    });
  }
  return out;
}

/** Profit per month for the last `months` months (oldest first). */
export function profitByMonth(db: DB, months: number): ProfitBucket[] {
  const out: ProfitBucket[] = [];
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const from = new Date(now.getFullYear(), now.getMonth() - i, 1, 0, 0, 0, 0).getTime();
    const to = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999).getTime();
    out.push({
      label: new Date(from).toLocaleDateString("ru-RU", { month: "short", year: "2-digit" }),
      from,
      to,
      ...profitIn(db, from, to),
    });
  }
  return out;
}

/** Per-product profit ranking for a window. */
export function productProfit(db: DB, from: number, to: number) {
  const map = new Map<
    string,
    { productId: string; name: string; qty: number; revenue: number; cost: number; profit: number }
  >();
  for (const o of db.orders) {
    if (o.createdAt < from || o.createdAt > to || o.status === "CANCELLED") continue;
    for (const i of o.items) {
      const cost = itemCost(db, i.productId, i.cost);
      const cur =
        map.get(i.productId) ??
        { productId: i.productId, name: i.nameRu, qty: 0, revenue: 0, cost: 0, profit: 0 };
      cur.qty += i.qty;
      cur.revenue += i.price * i.qty;
      cur.cost += cost * i.qty;
      cur.profit += (i.price - cost) * i.qty;
      map.set(i.productId, cur);
    }
  }
  return [...map.values()].sort((a, b) => b.profit - a.profit);
}

export function tableSessionTotal(db: DB, tableId: string): number {
  return db.orders
    .filter((o) => o.tableId === tableId && o.status !== "CANCELLED" && !o.paid)
    .reduce((s, o) => s + o.total, 0);
}

export function activeOrdersForTable(db: DB, tableId: string): Order[] {
  return db.orders.filter(
    (o) => o.tableId === tableId && o.status !== "COMPLETED" && o.status !== "CANCELLED"
  );
}
