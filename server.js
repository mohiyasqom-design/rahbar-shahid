"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const sqlite3 = require("sqlite3").verbose();

const PORT = Number(process.env.PORT || 3000);
const INDEX_PATH = path.join(__dirname, "index.html");
const DB_DIR = process.env.DB_DIR || path.join(__dirname, "data");
const DB_PATH = process.env.DB_PATH || path.join(DB_DIR, "gallery.sqlite");

fs.mkdirSync(DB_DIR, { recursive: true });

const db = new sqlite3.Database(DB_PATH);
db.configure("busyTimeout", 5000);

function exec(sql) {
  return new Promise((resolve, reject) => {
    db.exec(sql, (err) => (err ? reject(err) : resolve()));
  });
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });
}

function nowIso() {
  return new Date().toISOString();
}

function today() {
  return nowIso().slice(0, 10);
}

function makeId() {
  return "itm_" + crypto.randomBytes(12).toString("hex");
}

function safeEqual(a, b) {
  const ha = crypto.createHash("sha256").update(String(a)).digest();
  const hb = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function json(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(body);
}

function text(res, status, body, contentType = "text/plain; charset=utf-8") {
  res.writeHead(status, {
    "Content-Type": contentType,
    "Cache-Control": "no-cache",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(body);
}

function readBody(req, limit = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > limit) {
        req.destroy();
        reject(new Error("payload too large"));
      }
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function getToken(req) {
  const h = req.headers["authorization"] || "";
  return h.startsWith("Bearer ") ? h.slice(7) : null;
}

function cleanString(value, maxLen = 5000) {
  if (value === undefined || value === null) return "";
  const s = String(value).replace(/\u0000/g, "").trim();
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

function parseTags(value) {
  if (Array.isArray(value)) {
    return value
      .map((x) => cleanString(x, 120))
      .filter(Boolean)
      .slice(0, 32);
  }
  if (typeof value === "string") {
    return value
      .split(/[,،]/)
      .map((x) => cleanString(x, 120))
      .filter(Boolean)
      .slice(0, 32);
  }
  return [];
}

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const s = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(s)) return true;
  if (["0", "false", "no", "off"].includes(s)) return false;
  return fallback;
}

function normalizeDate(value) {
  const s = cleanString(value, 20);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : today();
}

function normalizeType(value) {
  return String(value).trim().toLowerCase() === "video" ? "video" : "image";
}

function normalizeItem(input, existing = {}) {
  const title = cleanString(input.title ?? existing.title, 200);
  if (!title) {
    const err = new Error("title_required");
    err.status = 400;
    throw err;
  }

  const media = cleanString(input.media ?? existing.media, 4096);
  const preview = cleanString(input.preview ?? existing.preview, 4096);
  const thumb = cleanString(input.thumb ?? existing.thumb, 4096);

  if (!media && !preview && !thumb) {
    const err = new Error("media_required");
    err.status = 400;
    throw err;
  }

  return {
    id: cleanString(input.id ?? existing.id, 80) || makeId(),
    title,
    category: cleanString(input.category ?? existing.category, 120),
    shortDesc: cleanString(input.shortDesc ?? existing.shortDesc, 1200),
    fullDesc: cleanString(input.fullDesc ?? existing.fullDesc, 6000),
    prompt: cleanString(input.prompt ?? existing.prompt, 12000),
    preview,
    media,
    thumb,
    type: normalizeType(input.type ?? existing.type),
    date: normalizeDate(input.date ?? existing.date),
    author: cleanString(input.author ?? existing.author, 200),
    tags: parseTags(input.tags ?? existing.tags),
    featured: parseBoolean(input.featured ?? existing.featured, false),
    published: parseBoolean(input.published ?? existing.published, true),
  };
}

function rowToItem(row) {
  return {
    id: row.id,
    title: row.title || "",
    category: row.category || "",
    shortDesc: row.short_desc || "",
    fullDesc: row.full_desc || "",
    prompt: row.prompt || "",
    preview: row.preview || "",
    media: row.media || "",
    thumb: row.thumb || "",
    type: row.type || "image",
    date: row.date || today(),
    author: row.author || "",
    tags: (() => {
      try {
        const parsed = JSON.parse(row.tags_json || "[]");
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    })(),
    featured: !!row.featured,
    published: !!row.published,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function itemToParams(item) {
  const timestamp = nowIso();
  return [
    item.id,
    item.title,
    item.category,
    item.shortDesc,
    item.fullDesc,
    item.prompt,
    item.preview,
    item.media,
    item.thumb,
    item.type,
    item.date,
    item.author,
    JSON.stringify(item.tags || []),
    item.featured ? 1 : 0,
    item.published ? 1 : 0,
    timestamp,
    timestamp,
  ];
}

const SAMPLE_ITEM = {
  id: "itm_seed_001",
  title: "نمونه اثر — قاب آغازین",
  category: "تصویر",
  shortDesc: "نخستین اثر نمونه‌ی آرشیو؛ از پنل مدیریت آثار خود را بیفزایید.",
  fullDesc:
    "این یک آیتم نمونه است. مدیر سایت می‌تواند از مسیر /admin وارد شود و آثار واقعی (تصویر یا ویدیو) را همراه با پرامپت اضافه، ویرایش یا حذف کند.",
  prompt: "cinematic wide shot, dramatic golden light, ultra-detailed, 8k --ar 16:9",
  preview: "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1200&q=80",
  media: "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=2000&q=90",
  thumb: "",
  type: "image",
  date: today(),
  author: "آکادمی جهان پرامپت",
  tags: ["نمونه", "هوش مصنوعی"],
  featured: true,
  published: true,
};

async function initDb() {
  await exec("PRAGMA journal_mode = WAL;");
  await exec("PRAGMA foreign_keys = ON;");
  await exec(`
    CREATE TABLE IF NOT EXISTS gallery_items (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT '',
      short_desc TEXT NOT NULL DEFAULT '',
      full_desc TEXT NOT NULL DEFAULT '',
      prompt TEXT NOT NULL DEFAULT '',
      preview TEXT NOT NULL DEFAULT '',
      media TEXT NOT NULL DEFAULT '',
      thumb TEXT NOT NULL DEFAULT '',
      type TEXT NOT NULL DEFAULT 'image',
      date TEXT NOT NULL DEFAULT '',
      author TEXT NOT NULL DEFAULT '',
      tags_json TEXT NOT NULL DEFAULT '[]',
      featured INTEGER NOT NULL DEFAULT 0,
      published INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  await exec("CREATE INDEX IF NOT EXISTS idx_gallery_published ON gallery_items(published);");
  await exec("CREATE INDEX IF NOT EXISTS idx_gallery_category ON gallery_items(category);");
  await exec("CREATE INDEX IF NOT EXISTS idx_gallery_date ON gallery_items(date);");
  await exec("CREATE INDEX IF NOT EXISTS idx_gallery_featured ON gallery_items(featured);");

  const count = await get("SELECT COUNT(*) AS count FROM gallery_items");
  if (!count || count.count === 0) {
    const item = normalizeItem(SAMPLE_ITEM);
    await run(
      `INSERT INTO gallery_items
        (id, title, category, short_desc, full_desc, prompt, preview, media, thumb, type, date, author, tags_json, featured, published, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      itemToParams(item)
    );
  }
}

const SESSION_TTL = 1000 * 60 * 60 * 6;
const sessions = new Map();

function createSession() {
  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, Date.now() + SESSION_TTL);
  return token;
}

function isValidSession(token) {
  if (!token || !sessions.has(token)) return false;
  if (Date.now() > sessions.get(token)) {
    sessions.delete(token);
    return false;
  }
  return true;
}

setInterval(() => {
  const now = Date.now();
  for (const [token, expiry] of sessions) {
    if (now > expiry) sessions.delete(token);
  }
}, 60_000).unref();

const attempts = new Map();
const MAX_ATTEMPTS = 8;
const WINDOW_MS = 10 * 60 * 1000;

function rateLimited(ip) {
  const now = Date.now();
  const rec = attempts.get(ip);
  if (!rec || now > rec.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  rec.count += 1;
  return rec.count > MAX_ATTEMPTS;
}

function getIp(req) {
  return ((req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
    req.socket.remoteAddress ||
    "unknown").slice(0, 128);
}

function requireAdmin(req, res) {
  const token = getToken(req);
  if (!isValidSession(token)) {
    json(res, 401, { ok: false, error: "unauthorized" });
    return null;
  }
  return token;
}

function sendCORSHeaders(res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
}

function buildWhere(query, opts = {}) {
  const conditions = [];
  const params = [];

  if (opts.publishedOnly) conditions.push("published = 1");

  const q = cleanString(query.q, 200);
  if (q) {
    const term = `%${q.toLowerCase()}%`;
    conditions.push(
      "(" +
        [
          "LOWER(title) LIKE ?",
          "LOWER(category) LIKE ?",
          "LOWER(short_desc) LIKE ?",
          "LOWER(full_desc) LIKE ?",
          "LOWER(prompt) LIKE ?",
          "LOWER(preview) LIKE ?",
          "LOWER(media) LIKE ?",
          "LOWER(thumb) LIKE ?",
          "LOWER(author) LIKE ?",
          "LOWER(tags_json) LIKE ?",
        ].join(" OR ") +
      ")"
    );
    params.push(term, term, term, term, term, term, term, term, term, term);
  }

  const category = cleanString(query.category, 120);
  if (category && category !== "همه") {
    conditions.push("category = ?");
    params.push(category);
  }

  const type = cleanString(query.type, 20).toLowerCase();
  if (type === "image" || type === "video") {
    conditions.push("type = ?");
    params.push(type);
  }

  const featured = cleanString(query.featured, 10).toLowerCase();
  if (featured === "1" || featured === "true") {
    conditions.push("featured = 1");
  } else if (featured === "0" || featured === "false") {
    conditions.push("featured = 0");
  }

  const published = cleanString(query.published, 10).toLowerCase();
  if (published === "1" || published === "true") {
    conditions.push("published = 1");
  } else if (published === "0" || published === "false") {
    conditions.push("published = 0");
  }

  return {
    where: conditions.length ? "WHERE " + conditions.join(" AND ") : "",
    params,
  };
}

function sortClause(sort) {
  const value = cleanString(sort, 20).toLowerCase();
  if (value === "old") return "ORDER BY featured DESC, date ASC, created_at ASC";
  if (value === "featured") return "ORDER BY featured DESC, date DESC, created_at DESC";
  return "ORDER BY featured DESC, date DESC, created_at DESC";
}

const clients = new Set();

function broadcastGalleryUpdate() {
  const payload = `event: gallery-updated\ndata: ${JSON.stringify({ ok: true, ts: Date.now() })}\n\n`;
  for (const res of clients) {
    try {
      res.write(payload);
    } catch {
      clients.delete(res);
    }
  }
}

async function listItems(query, opts = {}) {
  const where = buildWhere(query, opts);
  const sort = sortClause(query.sort);
  const rows = await all(
    `SELECT * FROM gallery_items ${where.where} ${sort}`,
    where.params
  );
  return rows.map(rowToItem);
}

async function getItemById(id) {
  return await get("SELECT * FROM gallery_items WHERE id = ?", [id]);
}

async function createItem(input) {
  const item = normalizeItem(input);
  const exists = await getItemById(item.id);
  if (exists) {
    const err = new Error("duplicate_id");
    err.status = 409;
    throw err;
  }

  await run(
    `INSERT INTO gallery_items
      (id, title, category, short_desc, full_desc, prompt, preview, media, thumb, type, date, author, tags_json, featured, published, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    itemToParams(item)
  );
  return item;
}

async function updateItem(id, input) {
  const existing = await getItemById(id);
  if (!existing) {
    const err = new Error("not_found");
    err.status = 404;
    throw err;
  }

  const item = normalizeItem({ ...rowToItem(existing), ...input, id }, rowToItem(existing));
  await run(
    `UPDATE gallery_items SET
      title = ?,
      category = ?,
      short_desc = ?,
      full_desc = ?,
      prompt = ?,
      preview = ?,
      media = ?,
      thumb = ?,
      type = ?,
      date = ?,
      author = ?,
      tags_json = ?,
      featured = ?,
      published = ?,
      updated_at = ?
     WHERE id = ?`,
    [
      item.title,
      item.category,
      item.shortDesc,
      item.fullDesc,
      item.prompt,
      item.preview,
      item.media,
      item.thumb,
      item.type,
      item.date,
      item.author,
      JSON.stringify(item.tags || []),
      item.featured ? 1 : 0,
      item.published ? 1 : 0,
      nowIso(),
      id,
    ]
  );
  return item;
}

async function deleteItem(id) {
  const existing = await getItemById(id);
  if (!existing) {
    const err = new Error("not_found");
    err.status = 404;
    throw err;
  }
  await run("DELETE FROM gallery_items WHERE id = ?", [id]);
}

async function seedIfNeeded() {
  await initDb();
}

function handleError(res, err) {
  const status = err && err.status ? err.status : 500;
  if (status >= 500) {
    console.error(err);
  }
  if (status === 400) return json(res, 400, { ok: false, error: "bad_request" });
  if (status === 401) return json(res, 401, { ok: false, error: "unauthorized" });
  if (status === 404) return json(res, 404, { ok: false, error: "not_found" });
  if (status === 409) return json(res, 409, { ok: false, error: "conflict" });
  if (status === 503) return json(res, 503, { ok: false, error: "not_configured" });
  return json(res, 500, { ok: false, error: "server_error" });
}

const server = http.createServer(async (req, res) => {
  sendCORSHeaders(res);

  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  try {
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
      });
      return res.end();
    }

    if (req.method === "GET" && url.pathname === "/api/events") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });
      res.write(`: connected\n\n`);
      clients.add(res);
      req.on("close", () => {
        clients.delete(res);
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/login") {
      if (rateLimited(getIp(req))) return json(res, 429, { ok: false, error: "rate" });

      const adminPassword = process.env.ADMIN;
      if (!adminPassword) {
        const err = new Error("not_configured");
        err.status = 503;
        throw err;
      }

      let password = "";
      try {
        const body = await readBody(req);
        const parsed = JSON.parse(body || "{}");
        password = cleanString(parsed.password, 256);
      } catch {
        return json(res, 400, { ok: false, error: "bad_request" });
      }

      if (password && safeEqual(password, adminPassword)) {
        attempts.delete(getIp(req));
        return json(res, 200, { ok: true, token: createSession() });
      }
      return json(res, 401, { ok: false, error: "invalid_credentials" });
    }

    if (req.method === "GET" && url.pathname === "/api/verify") {
      return isValidSession(getToken(req))
        ? json(res, 200, { ok: true })
        : json(res, 401, { ok: false, error: "unauthorized" });
    }

    if (req.method === "POST" && url.pathname === "/api/logout") {
      sessions.delete(getToken(req));
      return json(res, 200, { ok: true });
    }

    if (req.method === "GET" && url.pathname === "/api/gallery") {
      const adminRequested = ["1", "true"].includes(cleanString(url.searchParams.get("admin"), 10).toLowerCase());
      if (adminRequested && !isValidSession(getToken(req))) {
        return json(res, 401, { ok: false, error: "unauthorized" });
      }
      const items = await listItems(Object.fromEntries(url.searchParams.entries()), {
        publishedOnly: !adminRequested,
      });
      return json(res, 200, { ok: true, items });
    }

    if (req.method === "POST" && url.pathname === "/api/gallery") {
      if (!requireAdmin(req, res)) return;
      let body = {};
      try {
        body = JSON.parse(await readBody(req) || "{}");
      } catch {
        return json(res, 400, { ok: false, error: "bad_request" });
      }
      const item = await createItem(body);
      broadcastGalleryUpdate();
      return json(res, 201, { ok: true, item });
    }

    if (req.method === "PUT" && url.pathname.startsWith("/api/gallery/")) {
      if (!requireAdmin(req, res)) return;
      const id = decodeURIComponent(url.pathname.slice("/api/gallery/".length)).trim();
      if (!id) return json(res, 400, { ok: false, error: "bad_request" });
      let body = {};
      try {
        body = JSON.parse(await readBody(req) || "{}");
      } catch {
        return json(res, 400, { ok: false, error: "bad_request" });
      }
      const item = await updateItem(id, body);
      broadcastGalleryUpdate();
      return json(res, 200, { ok: true, item });
    }

    if (req.method === "DELETE" && url.pathname.startsWith("/api/gallery/")) {
      if (!requireAdmin(req, res)) return;
      const id = decodeURIComponent(url.pathname.slice("/api/gallery/".length)).trim();
      if (!id) return json(res, 400, { ok: false, error: "bad_request" });
      await deleteItem(id);
      broadcastGalleryUpdate();
      return json(res, 200, { ok: true });
    }

    if (url.pathname.startsWith("/api/")) {
      return json(res, 404, { ok: false, error: "not_found" });
    }

    if (req.method === "GET" || req.method === "HEAD") {
      fs.readFile(INDEX_PATH, (err, buf) => {
        if (err) {
          return text(res, 500, "index.html not found");
        }
        res.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-cache",
          "X-Content-Type-Options": "nosniff",
        });
        res.end(req.method === "HEAD" ? undefined : buf);
      });
      return;
    }

    return json(res, 405, { ok: false, error: "method_not_allowed" });
  } catch (err) {
    return handleError(res, err);
  }
});

(async () => {
  try {
    await seedIfNeeded();
    server.listen(PORT, () => {
      console.log(`✅ Server running on port ${PORT}`);
      console.log(`🗄️ SQLite database: ${DB_PATH}`);
      if (!process.env.ADMIN) {
        console.warn("⚠️  متغیر محیطی ADMIN تنظیم نشده — ورود مدیر تا تنظیم آن غیرفعال است.");
      }
    });
  } catch (err) {
    console.error("Failed to initialize database:", err);
    process.exit(1);
  }
})();