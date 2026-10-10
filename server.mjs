/**
 * YÜMI — production static server (Railway-ready).
 *
 * Dependency-free Node server that serves the built SPA from `dist/`:
 *   • binds 0.0.0.0 and honours the PORT env var Railway injects
 *   • history fallback so deep links (/admin, /yumidev, /menu/c/baked, /t/<token>)
 *     resolve on a hard refresh instead of 404
 *   • long-lived immutable caching for hashed assets, no-cache for index.html
 *   • /healthz endpoint for the platform health check
 *
 * Run locally with:  npm run build && npm start
 */
import { createServer as createHttpServer } from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { timingSafeEqual } from "node:crypto";
import { extname, join, normalize, resolve, sep } from "node:path";

const DIST = resolve(process.cwd(), "dist");
const INDEX = join(DIST, "index.html");
const PORT = Number(process.env.PORT) || 3000;
const HOST = "0.0.0.0";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".pdf": "application/pdf",
};

function contentType(file) {
  return MIME[extname(file).toLowerCase()] ?? "application/octet-stream";
}

/** Cache policy: hashed build output is immutable, the shell must revalidate. */
function cacheControl(file) {
  if (file.startsWith(join(DIST, "assets") + sep)) return "public, max-age=31536000, immutable";
  if (file === INDEX) return "no-cache, must-revalidate";
  return "public, max-age=3600";
}

function baseHeaders() {
  return {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Frame-Options": "SAMEORIGIN",
    "Permissions-Policy": "camera=(), geolocation=(), payment=(), usb=()",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
    // Railway terminates TLS in front of the container; HSTS is a no-op on
    // plain-HTTP local runs and pins the domain to HTTPS in real deployments.
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  };
}

function send(res, status, body, headers = {}, method = "GET") {
  const payload = Buffer.from(body);
  res.writeHead(status, {
    ...baseHeaders(),
    "Content-Type": "text/plain; charset=utf-8",
    "Content-Length": payload.length,
    ...headers,
  });
  res.end(method === "HEAD" ? undefined : payload);
}

function sendJson(res, status, obj, method = "GET") {
  const payload = Buffer.from(JSON.stringify(obj));
  res.writeHead(status, {
    ...baseHeaders(),
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": payload.length,
    "Cache-Control": "no-store",
  });
  res.end(method === "HEAD" ? undefined : payload);
}

// ---------------------------------------------------------------------------
// Realtime sync API
//
// The SPA keeps its database in localStorage (one universe per device), so
// restaurant devices need a shared source of truth: every device POSTs the
// records it changed and GETs the records it has not seen yet.
//
//   GET  /api/sync?branch=<id>&since=<srv>   → records with srv > since
//   POST /api/sync {branch, since, changes[]} → merge (LWW by rev) + pull
//
// Each record is { rev, srv, val }:
//   rev — client wall-clock of the edit (last-write-wins across devices)
//   srv — SERVER-assigned, strictly monotonic receipt stamp (pull cursor)
// Storage is a JSON snapshot per branch in DATA_DIR (point a Railway volume
// there so data survives redeploys). Optional SYNC_TOKEN env locks the API.
// ---------------------------------------------------------------------------

const DATA_DIR = process.env.DATA_DIR || join(process.cwd(), "data");
const SYNC_TOKEN = process.env.SYNC_TOKEN || "";
const BRANCH_RE = /^[A-Za-z0-9_.-]{1,64}$/;
const COL_RE = /^[A-Za-z][A-Za-z0-9_]{0,39}$/;
const MAX_BODY = 12 * 1024 * 1024;
const MAX_RECORD_BYTES = 1024 * 1024; // one synced record (data-URL photo allowed)
const MAX_RECORDS_PER_BRANCH = 200_000;

// ---------------------------------------------------------------------------
// Simple per-IP rate limiter for the sync API (in-memory, no dependencies).
// A restaurant LAN has a handful of devices; anything above this is either a
// misbehaving client or an attacker brute-forcing the token.
// ---------------------------------------------------------------------------
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 120; // API requests / window / IP for GET
const RATE_MAX_POST = 30; // POST is expensive (merge + persist)
const RATE_MAX_STATIC = 600; // asset hammering guard (a page loads ~20 files)
const rateBuckets = new Map(); // ip -> { windowStart, get, post, static }

function rateOk(ip, mode = "get") {
  const now = Date.now();
  let b = rateBuckets.get(ip);
  if (!b || now - b.windowStart >= RATE_WINDOW_MS) {
    b = { windowStart: now, get: 0, post: 0, static: 0 };
    rateBuckets.set(ip, b);
    // bound memory: drop stale buckets when too many distinct IPs showed up
    if (rateBuckets.size > 10_000) {
      for (const [k, v] of rateBuckets) {
        if (now - v.windowStart >= RATE_WINDOW_MS) rateBuckets.delete(k);
      }
    }
  }
  if (mode === "post") {
    b.post += 1;
    return b.post <= RATE_MAX_POST;
  }
  if (mode === "static") {
    b.static += 1;
    return b.static <= RATE_MAX_STATIC;
  }
  b.get += 1;
  return b.get <= RATE_MAX;
}

/** True for loopback / RFC1918 / CGNAT peers — i.e. a local reverse proxy
 * (Railway's edge, nginx) rather than a direct internet client. */
function isTrustedProxy(addr) {
  if (!addr) return false;
  const a = addr.replace(/^::ffff:/, "");
  if (a === "::1" || a === "127.0.0.1") return true;
  const parts = a.split(".");
  if (parts.length !== 4) return a.startsWith("fc") || a.startsWith("fd") || a.startsWith("fe80");
  const [x, y] = parts.map(Number);
  if (x === 10) return true;
  if (x === 127) return true;
  if (x === 192 && y === 168) return true;
  if (x === 172 && y >= 16 && y <= 31) return true;
  if (x === 100 && y >= 64 && y <= 127) return true; // Railway / Cloudflare CGNAT
  return false;
}

/** Per-IP identity for the rate limiter.
 *
 * X-Forwarded-For is attacker-controlled on a direct connection — trusting it
 * unconditionally lets anyone rotate the header and reset their bucket. The
 * header is therefore only honoured when the TCP peer is a private/loopback
 * address we control (the platform proxy); otherwise the socket address wins. */
function clientIp(req) {
  const peer = req.socket.remoteAddress ?? "unknown";
  if (!isTrustedProxy(peer)) return peer;
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length && fwd.length < 200) {
    return fwd.split(",")[0].trim();
  }
  return peer;
}

/** Constant-time secret comparison that tolerates length mismatches. */
function secretEquals(a, b) {
  const ba = Buffer.from(String(a ?? ""));
  const bb = Buffer.from(String(b ?? ""));
  if (ba.length !== bb.length) return false;
  if (ba.length === 0) return false;
  return timingSafeEqual(ba, bb);
}

/** Cross-site request guard for the write endpoint: browsers always attach an
 * Origin header to cross-origin POSTs, and same-site proxies pass the host
 * through. Anything that claims a foreign origin is rejected before parsing. */
function originAllowed(req) {
  const origin = req.headers.origin;
  if (!origin) return true; // curl / server-to-server / same-origin navigations
  try {
    const host = req.headers.host ?? "";
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** branch → col → id → { rev, srv, val } (val === null is a tombstone) */
const stores = new Map();
const lastSrv = new Map();
const persistTimers = new Map();
let storesLoaded = null;

async function ensureStoresLoaded() {
  if (storesLoaded) return storesLoaded;
  storesLoaded = (async () => {
    try {
      await mkdir(DATA_DIR, { recursive: true });
      const files = await readdir(DATA_DIR);
      for (const f of files) {
        if (!f.endsWith(".json")) continue;
        try {
          const parsed = JSON.parse(await readFile(join(DATA_DIR, f), "utf8"));
          if (parsed && typeof parsed === "object") {
            const branch = f.slice(0, -5);
            stores.set(branch, parsed.cols ?? {});
            lastSrv.set(branch, parsed.lastSrv ?? 0);
          }
        } catch {
          /* skip corrupt snapshot */
        }
      }
    } catch {
      /* data dir unreadable → start empty */
    }
  })();
  return storesLoaded;
}

function snapshotOf(branch) {
  return { version: 1, lastSrv: lastSrv.get(branch) ?? 0, cols: stores.get(branch) ?? {} };
}

function persistBranch(branch, delay = 400) {
  clearTimeout(persistTimers.get(branch));
  persistTimers.set(
    branch,
    setTimeout(() => {
      persistTimers.delete(branch);
      const file = join(DATA_DIR, `${branch}.json`);
      writeFile(file, JSON.stringify(snapshotOf(branch)), "utf8").catch(() => {
        /* disk full / read-only fs — in-memory copy still serves */
      });
    }, delay)
  );
}

async function flushAll() {
  for (const [branch, t] of persistTimers) {
    clearTimeout(t);
    persistTimers.delete(branch);
    try {
      await mkdir(DATA_DIR, { recursive: true });
      await writeFile(join(DATA_DIR, `${branch}.json`), JSON.stringify(snapshotOf(branch)), "utf8");
    } catch {
      /* noop */
    }
  }
}

function nextSrv(branch, now) {
  const next = Math.max(now, (lastSrv.get(branch) ?? 0) + 1);
  lastSrv.set(branch, next);
  return next;
}

function pullRecords(branch, since) {
  const cols = stores.get(branch);
  const records = [];
  if (cols) {
    for (const col of Object.keys(cols)) {
      const map = cols[col] || {};
      for (const id of Object.keys(map)) {
        const rec = map[id];
        if (rec && rec.srv > since) records.push({ col, id, rev: rec.rev, srv: rec.srv, val: rec.val });
      }
    }
  }
  const cursor = Math.max(Date.now(), lastSrv.get(branch) ?? 0);
  return { ok: true, now: cursor, records };
}/** Merge incoming changes with last-write-wins on `rev`, stamp `srv`. */
function applyChanges(branch, changes) {
  let accepted = 0;
  let cols = stores.get(branch);
  if (!cols) {
    cols = {};
    stores.set(branch, cols);
  }

  for (const ch of changes) {
    if (!ch || typeof ch.col !== "string" || typeof ch.id !== "string") continue;
    if (!COL_RE.test(ch.col) || ch.id.length > 120 || ch.id.length === 0) continue;
    // reject records that would bloat memory/disk (zip bombs, huge payloads)
    if (ch.val !== null) {
      let size;
      try {
        size = JSON.stringify(ch.val).length;
      } catch {
        continue; // non-serializable — never store it
      }
      if (size > MAX_RECORD_BYTES) continue;
    }
    const rev = Number(ch.rev);
    if (!Number.isFinite(rev) || rev < 0) continue;
    let map = cols[ch.col];
    if (!map) {
      // cap collection count per branch
      if (Object.keys(cols).length > 500) continue;
      map = {};
      cols[ch.col] = map;
    }
    const existing = map[ch.id];
    if (existing && rev <= existing.rev) continue; // stale write loses
    // cap total records per branch so a runaway client cannot fill the disk
    if (!existing && Object.keys(map).length >= MAX_RECORDS_PER_BRANCH) continue;
    map[ch.id] = { rev, srv: nextSrv(branch, Date.now()), val: ch.val === null ? null : ch.val };
    accepted++;
  }
  return accepted;
}

function readBody(req) {
  return new Promise((resolve) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        resolve(null);
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => {
      if (size > MAX_BODY) return resolve(null);
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        resolve(null);
      }
    });
    req.on("error", () => resolve(null));
  });
}

async function handleSync(req, res, method, searchParams) {
  await ensureStoresLoaded();
  if (!rateOk(clientIp(req), method === "POST" ? "post" : "get")) {
    return send(res, 429, "Too Many Requests", { "Retry-After": "60" }, method);
  }
  if (method === "POST" && !originAllowed(req)) {
    return send(res, 403, "Forbidden origin", {}, method);
  }
  if (SYNC_TOKEN && !secretEquals(req.headers["x-sync-token"], SYNC_TOKEN)) {
    return send(res, 401, "Unauthorized", {}, method);
  }

  if (method === "GET") {
    const branch = searchParams.get("branch") ?? "";
    const since = Number(searchParams.get("since") || 0) || 0;
    if (!BRANCH_RE.test(branch)) return send(res, 400, "Bad branch", {}, method);
    return sendJson(res, 200, pullRecords(branch, since), method);
  }

  if (method === "POST") {
    const body = await readBody(req);
    if (!body || typeof body !== "object") return send(res, 400, "Bad JSON", {}, method);
    const branch = String(body.branch ?? "");
    const since = Number(body.since || 0) || 0;
    if (!BRANCH_RE.test(branch)) return send(res, 400, "Bad branch", {}, method);
    const changes = Array.isArray(body.changes) ? body.changes.slice(0, 50000) : [];
    applyChanges(branch, changes);
    await mkdir(DATA_DIR, { recursive: true }).catch(() => {});
    persistBranch(branch);
    return sendJson(res, 200, pullRecords(branch, since), method);
  }

  return send(res, 405, "Method Not Allowed", { Allow: "GET, POST" }, method);
}

/** Dotfiles (.env, .git, .DS_Store …) are never part of the build output.
 * They must 404 outright — not fall through to the SPA shell — so a probe
 * cannot even confirm the fallback behaviour. */
function isDotfilePath(pathname) {
  let rel;
  try {
    rel = decodeURIComponent(pathname);
  } catch {
    return true; // undecodable = suspicious
  }
  return normalize(rel)
    .split(/[/\\]/)
    .some((seg) => seg.startsWith(".") && seg !== "." && seg !== "..");
}

/** Resolve a URL pathname to a real file inside dist (or null when missing). */
async function resolveFile(pathname) {
  let rel;
  try {
    rel = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  const clean = normalize(rel).replace(/^([/\\])+/, "");
  // never escape the dist directory (also catches `..` segments)
  if (clean.split(/[/\\]/).some((seg) => seg === "..")) return null;
  const target = join(DIST, clean);
  // never escape the dist directory
  if (target !== DIST && !target.startsWith(DIST + sep)) return null;
  try {
    const info = await stat(target);
    if (info.isFile()) return { file: target, size: info.size, mtime: info.mtime };
    if (info.isDirectory()) {
      const nested = join(target, "index.html");
      const nestedInfo = await stat(nested);
      if (nestedInfo.isFile()) return { file: nested, size: nestedInfo.size, mtime: nestedInfo.mtime };
    }
  } catch {
    /* not found */
  }
  return null;
}

async function handle(req, res) {
  const method = req.method ?? "GET";

  let parsedUrl;
  try {
    parsedUrl = new URL(req.url ?? "/", "http://localhost");
  } catch {
    return send(res, 400, "Bad Request", {}, method);
  }
  const pathname = parsedUrl.pathname;

  // sync API first — it also accepts POST
  if (pathname === "/api/sync") return await handleSync(req, res, method, parsedUrl.searchParams);
  if (pathname.startsWith("/api/")) return send(res, 404, "Not Found", {}, method);

  if (method !== "GET" && method !== "HEAD") {
    return send(res, 405, "Method Not Allowed", { Allow: "GET, HEAD" }, method);
  }

  if (!rateOk(clientIp(req), "static")) {
    return send(res, 429, "Too Many Requests", { "Retry-After": "60" }, method);
  }

  if (pathname === "/healthz") return send(res, 200, "ok", {}, method);

  if (isDotfilePath(pathname)) return send(res, 404, "Not Found", {}, method);

  const hit = await resolveFile(pathname);
  const isAssetPath = extname(pathname) !== "";

  // SPA history fallback: unknown *routes* get the app shell, unknown *files* 404.
  const entry = hit ?? (!isAssetPath ? { file: INDEX } : null);
  if (!entry) return send(res, 404, "Not Found", {}, method);

  try {
    const info = await stat(entry.file);
    const etag = `W/"${info.size}-${info.mtimeMs}"`;
    const headers = {
      "Content-Type": contentType(entry.file),
      "Content-Length": info.size,
      "Cache-Control": cacheControl(entry.file),
      ETag: etag,
      "Last-Modified": info.mtime.toUTCString(),
    };
    if (req.headers["if-none-match"] === etag) {
      res.writeHead(304, { ...baseHeaders(), ETag: etag, "Cache-Control": cacheControl(entry.file), "Last-Modified": headers["Last-Modified"] });
      return res.end();
    }
    res.writeHead(200, { ...baseHeaders(), ...headers });
    if (method === "HEAD") return res.end();
    const stream = createReadStream(entry.file);
    stream.on("error", () => res.destroy());
    stream.pipe(res);
  } catch {
    send(res, 500, "Internal Server Error", {}, method);
  }
}

export { clientIp, isTrustedProxy, originAllowed, secretEquals };

export function createStaticServer() {
  return createHttpServer((req, res) => {
    handle(req, res).catch(() => {
      if (!res.headersSent) send(res, 500, "Internal Server Error");
      else res.destroy();
    });
  });
}

const isMain = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;

if (isMain) {
  const server = createStaticServer();
  // slowloris mitigation: refuse clients that dribble headers / bodies
  server.headersTimeout = 15_000;
  server.requestTimeout = 60_000;
  server.keepAliveTimeout = 10_000;
  server.listen(PORT, HOST, async () => {
    if (!SYNC_TOKEN) {
      console.warn(
        "[yumi] OGohlANTIRISH: SYNC_TOKEN sozlanmagan — /api/sync ochiq. Ishlab chiqarishda SYNC_TOKEN (server) va VITE_SYNC_TOKEN (build) ni bir xil qiymatga qo‘ying."
      );
    }
    let ready = false;
    try {
      await stat(INDEX);
      ready = true;
    } catch {
      /* handled below */
    }
    if (!ready) {
      console.error(`[yumi] dist/index.html topilmadi (${INDEX}). Avval "npm run build" qiling.`);
      process.exit(1);
    }
    console.log(`[yumi] xizmat ishga tushdi: http://${HOST}:${PORT} (dist: ${DIST})`);
  });
  for (const sig of ["SIGTERM", "SIGINT"]) {
    process.on(sig, async () => {
      await flushAll().catch(() => {});
      server.close(() => process.exit(0));
    });
  }
}
