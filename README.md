# YÜMI — Sushi & Rolls Restaurant Management & Ordering System

Production-style restaurant system with four integrated interfaces on one realtime data layer:

| Interface | Route | Who uses it |
|---|---|---|
| Marketing landing (design mockup) | `/` | Everyone — hero, stats, menu preview |
| Customer mobile web app | `/home`, `/t/:token`, `/menu` | Guests scanning a table QR |
| Admin panel | `/admin` | Administrator (all data, statistics, profit) |
| Waiter panel | `/waiter` | Waiters |
| Kitchen / cashier screens | `/kitchen`, `/cashier` | Administrator (used from the admin flow) |
| Developer console | `/yumidev` | Developer only (hidden, own login) |

The system has **exactly two staff roles — Administrator and Ofitsant (waiter)**. Everything else
(menu, categories, staff, promotion, database) is owned by the administrator, and the developer console
sits above both.

Design language: near-black surfaces (`#08080a`), crimson accent, white type, large radius cards and
premium food photography. The customer catalogue uses **white menu cards** (food photo, bold price,
dish name below, red add button) exactly matching the reference menu images, so the dishes stand out
against the dark shell. Mobile-first customer UI; data-rich desktop admin.

### Customer menu layout

| Screen | What it gives the guest |
|---|---|
| `/menu` | Menu title + subtitle, prominent search (live dish/ingredient results), a horizontally scrolling **category rail**, a **“Bugungi taklif” hero** pulled from the real promo data, three quick actions (dine-in / pre-order / delivery), a **promo rail**, “Mashhur taomlar”, “Sevimlilar” and “Yangi taomlar” sections, and a **sticky cart bar** with the live total |
| `/categories` | Searchable category grid — gradient photo tiles, category emoji chip, live dish count |
| `/menu/c/:slug` | Category hero with dish count, search, filter chips (Barchasi / Mashhur / Yangi / Aksiya) and a **sort control** (tavsiya etilgan · arzon → qimmat · qimmat → arzon · reyting) |
| `/menu/p/:id` | Photo hero, breadcrumb, rating/weight/badges, price block, a **quantity card showing the running line total**, the add-to-cart button carrying that total, tabs (tavsif · tarkibi · allergenlar · oziqlik) and related dishes |
| `/cart` | Item rows with unit price, a shared quantity stepper and line totals, promo-code box, summary and a **sticky total + checkout bar** |

Every card shares one interaction model: a red **+** when the dish is not in the cart, and the same
button turns into a **quantity stepper** the moment it is — so the guest can adjust an order without
leaving the page. Sticky bars sit above the mobile bottom navigation (`bottom-[76px]`, `lg:bottom-4`).

---

## 1. Tech stack & architecture

```
Customer (mobile)   Waiter   Kitchen   Cashier   Admin
        │              │        │         │        │
        └──────────────┴────────┴─────────┴────────┘
                       │
              React + TypeScript SPA (Vite)
                       │
        ┌──────────────┴───────────────┐
        │  Data layer (src/lib/store)  │
        │  · domain API + validation   │
        │  · persistent store          │
        │  · realtime pub/sub          │
        └──────────────────────────────┘
                       │
             Shared persistent database
        + realtime channel (cross-tab sync)
```

- **Frontend:** React 18, TypeScript, React Router, Tailwind CSS, Framer Motion, Lucide, Recharts.
- **Data layer:** a single normalized domain model (`src/lib/types.ts`) with every mutation funnelled
  through a validated API (`src/lib/store.tsx`). The store persists to a durable client-side database
  and broadcasts changes so every panel updates **without a refresh**.
- **Realtime:** a `BroadcastChannel` channel (`yumi.realtime.v3`) synchronises every open tab/window
  (customer phone, waiter phone, kitchen tablet, admin desktop) and a typed event bus
  (`ORDER_CREATED`, `ORDER_READY`, `WAITER_CALLED`, `PAYMENT_REQUESTED`, …) drives toasts, sounds and
  voice announcements.

> **Note on hosting:** the sandbox preview runs as a static browser app, so the database is embedded
> in the client (durable + realtime across panels). All business rules live in the store's domain API
> so the same code moves to a server (Prisma/PostgreSQL or Convex) with only the persistence layer
> swapped — the UI calls `api.*`, never raw storage.

### Project structure

```
src/
  lib/            types, seed data, store (domain API), auth, i18n, cart,
                  favorites, notifications, reporting, sound, utils
  components/     ui/ primitives (button, card, modal, tabs…),
                  customer/ (shell, product card, waiter-call),
                  staff/ (header, widgets, guard), QRCodeImage, FoodImage
  pages/          Landing, AuthPage,
                  customer/ (entry, home, categories, product, cart,
                             checkout, tracking, track-by-number, about),
                  staff/ (waiter, kitchen, cashier),
                  admin/ (layout, dashboard, orders board, tables, catalog,
                          staff, promotions, reports, misc)
```

---

## 2. Setup

```bash
bun install      # install dependencies
bun run dev      # dev server (0.0.0.0, PORT from env)
bun run build    # production build → dist/
bun tsc -b --noEmit   # type check
```

Environment variables: none are required for the current build (no third-party secrets are used).
If you later attach a server database or an image CDN, add keys via the project's Keys tab rather
than editing `.env` by hand.

### Production deploy

The build is a standard Vite static build (`dist/`). Build command: `bun run build`; output
directory: `dist`. Deploy `dist/` to any static host / CDN.

---

## 3. Demo accounts

| Role | Username | Password | Lands on |
|---|---|---|---|
| Administrator | `admin` | `admin123` | `/admin` |
| Waiter | `aziz` | `waiter123` | `/waiter` |
| Waiter | `kamola` | `waiter123` | `/waiter` |
| Developer (hidden) | `dev` | `yumidev2026` | `/yumidev` |

Passwords are stored **hashed** (`sha256` + app pepper, see `src/lib/hash.ts`) in both the browser
snapshot and the server sync data — a leaked `data/*.json` never exposes usable credentials. Legacy
plaintext snapshots are upgraded in place on the next load.

### How staff sign in

There is **no registration** and **no login entry anywhere in the public site** (the landing page and
the customer menu have no “Kirish” link — only a small “Xodimlar uchun kirish” link in the portal
footer). Staff open the panel URL directly:

| Panel | URL |
|---|---|
| Staff sign-in (role chooser) | `/auth` |
| Admin | `/admin` |
| Waiter | `/waiter` |
| Developer console | `/yumidev` |

Opening a panel URL while signed out redirects to `/auth` with the intended path preserved.
On `/auth` you first **pick your role** (Administrator or Ofitsant — these are the only two), then
enter username and password. If the account does not belong to the selected role, sign-in is refused
with an explanatory message — the account itself is never created by the user; the administrator
creates waiter accounts under Admin → **Xodimlar**.

### Developer console (`/yumidev`)

Type `/yumidev` in place of the normal path (e.g. `…/yumidev`) to open the developer console. It has its
**own login and password** (Demo: `dev` / `yumidev2026`, changeable inside the console) and nothing in
the public site links to it. It grants **100 % control of the whole product** in one place:

| Tab | What it owns |
|---|---|
| Developer tools | raw database JSON export/import, record counts, developer credential change, wipe drills (orders / sessions / logs / products / staff) and factory reset |
| Mahsulotlar | add, edit, delete, hide (availability), price, **tannarx (cost)**, one-click **discounts** |
| Kategoriyalar | create, edit, reorder, show/hide, delete |
| Buyurtmalar | every order, status changes, cancellation |
| Jonli monitor | live tables and what each guest is doing |
| Stollar / Xodimlar / Aksiyalar | tables + QR, staff (including granting the waiter role), promotions |
| Hisobotlar / To‘lovlar / Loglar / Sozlamalar | reports with profit, payments, activity log, restaurant settings |

Unlocking the console also signs the developer in as the hidden `__developer` administrator account, so
every tool below works with full permissions. The developer account is never listed in Admin → Xodimlar.

### Dev vs. admin — why they are separate

The admin panel belongs to the **restaurant**; the developer console belongs to the **person who built
the site**, so the builder keeps a master key that works long after handover:

| | Admin panel (`/admin`) | Developer console (`/yumidev`) |
|---|---|---|
| Owner | Restaurant / administrator | The developer |
| Credentials | `admin`-type account, created and handed over by the developer | Its own `db.dev` login, independent of staff accounts |
| Sees | Operations, statistics, profit, live tables, menu, staff | Everything above **plus** raw database export/import, wipe drills, factory reset, developer credential change |
| Client sees it? | Yes — it is their workspace | **No**: nothing links to it, it needs its own password, and developer actions are filtered out of the client's **Activity loglar** |

The console also has a **Topshirish (mijoz admini)** card: set the restaurant owner's name, login and
password, and copy a ready-to-send access summary (`/admin` + login). Two safeguards protect the
builder's access:

1. **The developer key survives a factory reset.** A re-seed (version bump) or the “restore demo data”
   button keeps the current `db.dev` credentials instead of rolling back to the documented defaults.
2. **An imported database cannot hijack the key.** `importDB` keeps the running developer credentials
   even when the uploaded snapshot contains different ones.

Customers do **not** log in — they enter through a table QR code.
Open `/t/demo` to pick a table manually (used when a QR is not available).

---

## 4. How the QR / table flow works

1. Every table row stores a random, unguessable `qrToken` (20+ chars).
2. The QR encodes `https://<host>/t/<qrToken>`.
3. `GET /t/:token` resolves the token → table → opens (or reuses) a **table session**, then shows the
   welcome + language screen.
4. The customer can only ever act as that table: the table is never taken from user input, so a guest
   cannot re-point an order to another table.
5. Admin → **QR kodlar** regenerates a token (invalidating old prints), downloads PNG, or prints an
   A6 sheet containing the logo, table number, QR and instructions. **Stollar → [table] → QR yangilash**
   does the same for a single table.

---

## 5. Realtime notifications

Events are emitted by the store on every meaningful transition and delivered to all open panels:

`ORDER_CREATED · ORDER_ACCEPTED · ORDER_PREPARING · ORDER_READY · ORDER_DELIVERED ·
ORDER_COMPLETED · ORDER_CANCELLED · WAITER_CALLED · PAYMENT_REQUESTED · PAYMENT_COMPLETED ·
TABLE_STATUS_CHANGED`

Each panel subscribes to its own audience. On receipt the app:

1. shows an in-app toast,
2. plays a WebAudio cue (`src/lib/sound.ts`) — distinct tones for new order / ready / call,
3. optionally speaks the message via `SpeechSynthesis`
   (“Stol 5 ofitsant chaqirmoqda”), using an autoplay-safe unlock on first user gesture,
4. optionally raises a browser notification (with permission),
5. increments the panel's notification bell.

Sound and voice can be toggled per device from the header (staff) or Profile (customer).

---

## 6. Orders, tables & payments

- **Order statuses:** `NEW → ACCEPTED → PREPARING → READY → WAITING_FOR_WAITER → DELIVERED → COMPLETED`
  (plus `CANCELLED`). Illegal jumps — e.g. `COMPLETED → PREPARING` — are rejected by
  `canTransition()` inside the store API, so drag/drop or rogue clients cannot corrupt state.
- **Totals are never trusted from the client.** The store recomputes `subtotal`, `discount` and
  `total` from the product's **current price**, and each order item snapshots the name and price so
  historical orders stay correct after a price change.
- **Multiple orders per table:** one order per send, all linked to the same table session. The waiter
  and cashier see the combined session total.
- **Waiter:** table map (🟢 empty / 🟡 waiting / 🔴 active / 🔵 bill), accept calls, add/remove items,
  change quantity, mark delivered, request/close payment.
- **Kitchen:** large high-contrast cards with elapsed-time warnings; ACCEPT → PREPARING → READY.
  When an order turns READY the waiter panel gets the sound/voice alert.
- **Cashier / closing:** choose cash / card / terminal / other, optional **split bill** into 2–6 parts;
  confirming sets the orders to `COMPLETED`, records a payment, closes the session and frees the table.

---

## 7. Reports & analytics

All numbers are computed from real order/payment rows (`src/lib/reporting.ts`):

- **Range:** today, yesterday, this week, this month, or custom date range.
- **Summary:** total revenue, orders, completed, cancelled, average cheque, products sold, discount,
  dine-in vs delivery, cash/card/terminal split, QR vs waiter orders.
- **Charts:** revenue per day, orders per hour, sales by category, per-product quantity & revenue,
  table utilisation, waiter performance (orders, revenue, cancellations, average service time).
- **Export:** CSV/Excel from the tables, print/PDF from the report view.

---

## 8. Roles & permissions

Two roles only: `ADMIN` (full control) and `WAITER` (service floor). `src/lib/permissions.ts` holds the
role → permission matrix (permissions across orders, tables, products, staff, reports, payments, calls,
promotions, QR, settings, logs). Admin → **Xodimlar** lets the administrator create staff, **give the
waiter role** and fine-tune individual permissions on the matrix; the sidebar and route guards honour
those permissions immediately. Every sensitive action writes an **activity log** (who, role, action,
entity, time) visible under Admin → **Activity loglar**.

## 8b. Profit, statistics & live table monitoring

Every product carries a purchase cost (**tannarx**) and every order line snapshots that cost, so profit
is computed from real rows (`src/lib/reporting.ts` → `profitIn`, `profitByDay`, `profitByMonth`,
`productProfit`):

- **Admin → Dashboard:** Kunlik / Haftalik / Oylik foyda cards (revenue, cost, net profit), profit margin,
  and a profit-vs-revenue chart for the last 7 days.
- **Admin → Hisobotlar:** a full profit analysis block for the selected range (sales, cost, net profit,
  average profit per order, monthly profit for 6 months, best-profit dishes) — with CSV/PDF export.
- **Admin → Jonli monitor:** real-time view of every table — occupied / waiting / bill / empty, whether
  the guest device is online or idle, **what the guest is viewing right now**, **what is in their cart**
  (item by item with quantities), the cart value, the session bill and each active order's status.
  Guest presence is a heartbeat written by the customer app (`api.touchSession`) and stale sessions are
  released automatically (`api.pruneSessions`).
- **Admin → Mahsulotlar:** inline cost editing and a one-click discount dropdown per dish (−5 % … −50 %,
  or remove) plus the availability switch that hides a dish from the customer menu.

---

## 9. Adding tables, products and categories

- **Tables:** Admin → Stollar → *Stol qo‘shish* (number, seats, zone). A secure QR token is generated
  automatically; open the table to edit, disable, regenerate the QR, download PNG or print.
- **Products:** Admin → Mahsulotlar → *Mahsulot qo‘shish* — trilingual names/descriptions, category,
  price, old price, image URL, ingredients, allergens, calories/protein/fat/carbs/weight and the
  Available / Popular / New / Promotion flags. Toggle availability inline from the list.
- **Categories:** Admin → Kategoriyalar — create, edit, reorder with the arrows, show/hide, set image,
  and delete. Categories drive the customer home carousel and menu screens.
- **Promotions:** Admin → Aksiyalar — percentage discounts, promo codes (applied in the cart) and
  happy-hours windows (e.g. 12:00–16:00 −15%), applied automatically at order time.

---

## 10. Seeded demo data

20 tables (Zal / Veranda / VIP), 13 categories and 73 products with real Uzbek prices — including the
full baked-roll, baked-sushi, maki and sushi lines (Запечённые роллы, Запечённые суши, Маки, Сушки) —
staff (one administrator, two waiters, plus the hidden developer account), ~78 historical and live orders
with cost snapshots, payments, waiter calls, promotions and system logs, so every dashboard, chart,
profit figure and report shows meaningful data on first load.

Dish prices use a realistic food-cost ratio per category (~42–55 %), so the profit numbers are sane out
of the box; edit any dish's **tannarx** in Admin → Mahsulotlar to match real purchasing.

To reset the demo data to its initial state, clear the browser storage for the site (the store
provides a `resetDemoData()` helper for this).

---

## 11. Quality & accessibility

- Mobile-first: layouts verified for 360–430 px; no horizontal scroll; sticky bottom navigation;
  ≥44 px touch targets; safe-area padding on iOS.
- Empty, loading (skeletons) and error states for every list; user-friendly messages for invalid/expired
  QR, disabled table, unavailable product, unauthorized/forbidden access.
- Semantic buttons with `aria-label`s, visible focus rings, keyboard-operable admin, tunable contrast.
- PWA manifest + icons for installability; order creation requires a live connection.

---

## 12. Deploy (Railway / Docker)

The app is a static SPA. It ships a small, dependency-free production server (`server.mjs`) that serves
the built `dist/` folder with the history fallback React Router needs, so a hard refresh on `/admin`,
`/yumidev`, `/menu/c/baked` or `/t/<token>` works instead of 404-ing.

| File | Purpose |
|---|---|
| `server.mjs` | Production static server: binds `0.0.0.0`, honours `PORT`, SPA fallback, immutable caching for hashed assets, `/healthz`, path-traversal safe |
| `Dockerfile` | Multi-stage build (`npm install` → `npm run build` → tiny runtime with only `dist/` + `server.mjs`) |
| `.dockerignore` | Keeps `node_modules`, `dist`, git data and env files out of the image build context |
| `railway.json` | Tells Railway to use that Dockerfile, run `node server.mjs` and health-check `/healthz` |
| `package.json` | `npm run build` (Vite → `dist/`), `npm start` (`node server.mjs`), `engines.node >= 20` |

### Deploy on Railway

1. **New Project → Deploy from GitHub repo** → pick this repository.
2. Railway reads `railway.json` and builds the **Dockerfile** automatically — no build/start commands to
   type, no Nixpacks guessing.
3. **No environment variables are required** (nothing in the app reads build-time or runtime config).
   Add only what a future backend needs.
4. Once the health check on `/healthz` passes, open **Settings → Networking → Generate Domain** to get
   the public URL. Point the table QR codes at `https://<your-domain>/t/<qrToken>` (Admin → QR kodlar)
   and shorten the domain on any shortener if you print stickers.

Build ≈ 1 min; the runtime image contains no `node_modules`.

### Same thing locally / any other host

```bash
npm run build && npm start        # http://localhost:3000  (PORT overrides)
docker build -t yumi . && docker run -p 3000:3000 yumi   # works on Fly, Render, VPS, k8s…
```

### Before you go live (important)

1. **Rotate the developer password.** The repository is public and the demo value
   (`/yumidev` → **Developer tools → Developer login / parol**) is known. Set a strong one — it survives a
   factory reset by design.
2. **Hand the admin panel to the owner:** `/yumidev` → **Topshirish (mijoz admini)** — set the owner's
   login/password, then send them `/admin` + those credentials.
3. **Know the data model.** The database is the browser's local storage, so each device has its own copy:
   the guest phone, the waiter phone and the owner's desktop do **not** share one dataset over the network
   (they share data only between tabs of the same browser). Everything works for a single-device demo, and
   the whole domain API (`src/lib/store.tsx`) is already the single place a real server database would plug
   in — see the note in section 1.
