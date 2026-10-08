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

/** Resolve a URL pathname to a real file inside dist (or null when missing). */
async function resolveFile(pathname) {
  let rel;
  try {
    rel = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  const clean = normalize(rel).replace(/^([/\\])+/, "");
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
  if (method !== "GET" && method !== "HEAD") {
    return send(res, 405, "Method Not Allowed", { Allow: "GET, HEAD" }, method);
  }

  let pathname = "/";
  try {
    pathname = new URL(req.url ?? "/", "http://localhost").pathname;
  } catch {
    return send(res, 400, "Bad Request", {}, method);
  }

  if (pathname === "/healthz") return send(res, 200, "ok", {}, method);

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
  server.listen(PORT, HOST, async () => {
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
    process.on(sig, () => server.close(() => process.exit(0)));
  }
}
