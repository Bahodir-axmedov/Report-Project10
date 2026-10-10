import { Navigate, Route, Routes } from "react-router-dom";
import { CustomerProvider } from "@/lib/customer";
import { RequireStaff } from "@/components/staff/RequireStaff";

import AuthPage from "@/pages/AuthPage";

import { CustomerShell } from "@/components/customer/CustomerShell";
import Landing from "@/pages/Landing";
import TableEntry from "@/pages/customer/TableEntry";
import CustomerHome from "@/pages/customer/Home";
import Categories from "@/pages/customer/Categories";
import CategoryPage from "@/pages/customer/CategoryPage";
import ProductPage from "@/pages/customer/ProductPage";
import Cart from "@/pages/customer/Cart";
import Checkout from "@/pages/customer/Checkout";
import OrderTracking from "@/pages/customer/OrderTracking";
import TrackOrder from "@/pages/customer/TrackOrder";
import About from "@/pages/customer/About";

import WaiterPanel from "@/pages/staff/WaiterPanel";
import KitchenPanel from "@/pages/staff/KitchenPanel";
import CashierPanel from "@/pages/staff/CashierPanel";

import AdminLayout from "@/pages/admin/AdminLayout";
import Dashboard from "@/pages/admin/Dashboard";
import OrdersBoard from "@/pages/admin/OrdersBoard";
import { TablesAdmin, QrCodes } from "@/pages/admin/Tables";
import { ProductsAdmin, CategoriesAdmin } from "@/pages/admin/Catalog";
import StaffAdmin from "@/pages/admin/StaffAdmin";
import Promotions from "@/pages/admin/Promotions";
import { Reports, Analytics } from "@/pages/admin/Reports";
import LiveMonitor from "@/pages/admin/LiveMonitor";
import DeveloperConsole from "@/pages/DeveloperConsole";
import { CallsPage, PaymentsPage, CustomersPage, SettingsPage, LogsPage } from "@/pages/admin/Misc";

export default function App() {
  return (
    <CustomerProvider>
      <Routes>
        {/* Marketing landing (mockup) — the guest portal lives at /home. */}
        <Route path="/" element={<Landing />} />
        {/* Portal home — no registration, no profile: order at table, delivery,
            pre-order, promotions and restaurant info (mockup screen 1). */}
        <Route path="/home" element={<CustomerHome />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/t/:token" element={<TableEntry />} />
        <Route path="/table/:token" element={<TableEntry />} />
        <Route path="/t" element={<TableEntry />} />

        {/* Customer app — works with OR without a table session (delivery and
            pre-orders never need one; dine-in picks a table at checkout). */}
        <Route element={<CustomerShell />}>
          <Route path="/menu" element={<Categories />} />
          <Route path="/menu/c/:slug" element={<CategoryPage />} />
          <Route path="/menu/p/:id" element={<ProductPage />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/order/:id" element={<OrderTracking />} />
          <Route path="/track" element={<TrackOrder />} />
          <Route path="/about" element={<About />} />
          <Route path="/categories" element={<Navigate to="/menu" replace />} />
        </Route>

        {/* Developer console — only reachable by opening /yumidev directly */}
        <Route path="/yumidev" element={<DeveloperConsole />} />

        {/* Staff — only two roles exist: ADMIN and WAITER */}
        <Route
          path="/waiter"
          element={
            <RequireStaff roles={["ADMIN", "WAITER"]}>
              <WaiterPanel />
            </RequireStaff>
          }
        />
        <Route
          path="/kitchen"
          element={
            <RequireStaff roles={["ADMIN"]}>
              <KitchenPanel />
            </RequireStaff>
          }
        />
        <Route
          path="/cashier"
          element={
            <RequireStaff roles={["ADMIN"]}>
              <CashierPanel />
            </RequireStaff>
          }
        />

        {/* Admin */}
        <Route
          path="/admin"
          element={
            <RequireStaff roles={["ADMIN"]}>
              <AdminLayout />
            </RequireStaff>
          }
        >
          <Route path="live" element={<LiveMonitor />} />
          <Route index element={<Dashboard />} />
          <Route path="orders" element={<OrdersBoard />} />
          <Route path="tables" element={<TablesAdmin />} />
          <Route path="kitchen" element={<Navigate to="/kitchen" replace />} />
          <Route path="calls" element={<CallsPage />} />
          <Route path="customers" element={<CustomersPage />} />
          <Route path="payments" element={<PaymentsPage />} />
          <Route path="products" element={<ProductsAdmin />} />
          <Route path="categories" element={<CategoriesAdmin />} />
          <Route path="staff" element={<StaffAdmin />} />
          <Route path="promotions" element={<Promotions />} />
          <Route path="reports" element={<Reports />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="qr" element={<QrCodes />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="logs" element={<LogsPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </CustomerProvider>
  );
}
