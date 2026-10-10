import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";
import { DataProvider } from "./lib/store";
import { AuthProvider } from "./lib/auth";
import { I18nProvider } from "./lib/i18n";
import { ToastProvider } from "./components/ui/toast";
import { NotificationProvider } from "./lib/notifications";
import { startSync } from "./lib/sync";

// Cross-device sync (see lib/sync.ts): pushes this device's changes to the
// restaurant server and pulls everyone else's. No-op when the API is absent.
startSync();

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root element #root not found");

createRoot(rootEl).render(
  <StrictMode>
    <BrowserRouter>
      <I18nProvider>
        <AuthProvider>
          <DataProvider>
            <ToastProvider>
              <NotificationProvider>
                <App />
              </NotificationProvider>
            </ToastProvider>
          </DataProvider>
        </AuthProvider>
      </I18nProvider>
    </BrowserRouter>
  </StrictMode>
);
