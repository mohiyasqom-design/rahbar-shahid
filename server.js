"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const Database = require("better-sqlite3");

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const INDEX_PATH = path.join(ROOT, "index.html");
const DB_DIR = path.join(ROOT, "data");
const DB_PATH = process.env.SQLITE_PATH
  ? path.resolve(process.env.SQLITE_PATH)
  : path.join(DB_DIR, "gallery.sqlite3");

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.pragma("busy_timeout = 5000");

db.exec(`
CREATE TABLE IF NOT EXISTS gallery_items (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  short TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  prompt TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT '',
  version TEXT NOT NULL DEFAULT '',
  image TEXT NOT NULL DEFAULT '',
  video TEXT NOT NULL DEFAULT '',
  author TEXT NOT NULL DEFAULT '',
  date TEXT NOT NULL DEFAULT '',
  featured INTEGER NOT NULL DEFAULT 0,
  published INTEGER NOT NULL DEFAULT 0,
  tags_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_gallery_items_published ON gallery_items(published);
CREATE INDEX IF NOT EXISTS idx_gallery_items_featured ON gallery_items(featured);
CREATE INDEX IF NOT EXISTS idx_gallery_items_category ON gallery_items(category);
CREATE INDEX IF NOT EXISTS idx_gallery_items_created_at ON gallery_items(created_at);
`);

const seedItems = [
  {
    id: "seed_1",
    title: "دریای بی‌پایان",
    category: "عکاسی هنری",
    short: "قابی هوایی از موج میلیونی جمعیت در مسیر تشییع.",
    description: "این اثر با ترکیب‌بندی عمودی و نور طلایی غروب، عظمت حضور مردمی را در قالبی سینمایی ثبت کرده است؛ گویی رودی از انسان‌ها به سوی افق جاری است.",
    prompt: "Aerial cinematic photograph of an endless sea of mourners at dusk, golden light, dramatic depth, ultra-wide composition, volumetric haze, 8k",
    model: "Midjourney",
    version: "v6.1",
    image: "https://picsum.photos/seed/tashi1/1200/900",
    video: "",
    author: "استودیو نور",
    date: "2026-05-02",
    featured: 1,
    published: 1,
    tags: ["هوایی", "جمعیت", "غروب"],
  },
  {
    id: "seed_2",
    title: "وداع در سکوت",
    category: "نقاشی دیجیتال",
    short: "پرترهٔ مفهومی از اندوه جمعی با پالت مونوکروم.",
    description: "نقاشی دیجیتالی با ضرب‌قلم‌های نرم و نور موضعی که سکوتِ سنگین لحظهٔ وداع را روایت می‌کند.",
    prompt: "Monochrome digital painting, collective grief, soft brush strokes, single candle light source, emotional atmosphere, fine art style",
    model: "Stable Diffusion",
    version: "XL 1.0",
    image: "https://picsum.photos/seed/tashi2/1200/900",
    video: "",
    author: "هنرمند ناشناس",
    date: "2026-05-04",
    featured: 0,
    published: 1,
    tags: ["مفهومی", "مونوکروم"],
  },
  {
    id: "seed_3",
    title: "خط و نور",
    category: "خوش‌نویسی",
    short: "ترکیب خوش‌نویسی نستعلیق با نورپردازی حجمی.",
    description: "حروف نستعلیق در فضایی از غبار نور شناورند؛ تلفیقی از سنت خوش‌نویسی ایرانی و گرافیک مدرن.",
    prompt: "Persian nastaliq calligraphy floating in volumetric light rays, dark background, gold ink particles, cinematic render, octane",
    model: "Midjourney",
    version: "v6",
    image: "https://picsum.photos/seed/tashi3/1200/900",
    video: "",
    author: "آکادمی جهان پرامپت",
    date: "2026-05-06",
    featured: 1,
    published: 1,
    tags: ["نستعلیق", "طلایی"],
  },
  {
    id: "seed_4",
    title: "مسیر گل‌باران",
    category: "عکاسی مستند",
    short: "مسیر تشییع با فرشی از گل و پرچم‌های برافراشته.",
    description: "تصویری مستند از مسیر وداع؛ گل‌ها، پرچم‌ها و چهره‌های مصمم در بستری از نور عصرگاهی.",
    prompt: "Documentary memorial procession, flower petals, raised flags, cinematic realism, soft sunset light, high detail",
    model: "Flux",
    version: "1.0",
    image: "https://picsum.photos/seed/tashi4/1200/900",
    video: "",
    author: "گروه روایت",
    date: "2026-05-08",
    featured: 0,
    published: 1,
    tags: ["مستند", "گل"],
  },
  {
    id: "seed_5",
    title: "شبِ شمع‌ها",
    category: "نقاشی دیجیتال",
    short: "هزاران شمع روشن در تاریکی؛ روایت امید و یاد.",
    description: "اثری با کنتراست بالا میان تاریکی شب و گرمای هزاران شعلهٔ کوچک که تا افق ادامه دارند.",
    prompt: "Thousands of candle flames stretching to the horizon at night, bokeh, warm-cold contrast, painterly digital art, atmospheric",
    model: "Stable Diffusion",
    version: "3.5",
    image: "https://picsum.photos/seed/tashi5/1200/900",
    video: "",
    author: "هنرمند ناشناس",
    date: "2026-05-10",
    featured: 0,
    published: 1,
    tags: ["شمع", "شب", "بوکه"],
  },
  {
    id: "seed_6",
    title: "قاب خاطره",
    category: "موشن و ویدیو",
    short: "کلیپ کوتاه سینمایی از قاب‌های ماندگار آن روز.",
    description: "مونتاژی آرام با گذارهای محو و موسیقیِ سکوت؛ برای مرور تصویریِ خاطره‌ها.",
    prompt: "Cinematic slow montage, archival memorial frames, gentle cross dissolves, film grain, 24fps, elegiac tone",
    model: "Runway",
    version: "Gen-3",
    image: "https://picsum.photos/seed/tashi6/1200/900",
    video: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
    author: "آکادمی جهان پرامپت",
    date: "2026-05-12",
    featured: 1,
    published: 1,
    tags: ["ویدیو", "مونتاژ"],
  }
];

function nowIso() {
  return new Date().toISOString();
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function toBool(v) {
  return v === true || v === 1 || v === "1" || v === "true" || v === "on" || v === "yes";
}

function cleanText(value, fallback = "") {
  if (value === undefined || value === null) return fallback;
  return String(value).replace(/\u0000/g, "").trim();
}

function normalizeDate(value, fallback = todayIsoDate()) {
  const s = cleanText(value, fallback);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : fallback;
}

function normalizeTags(value) {
  if (Array.isArray(value)) {
    return value.map((t) => cleanText(t)).filter(Boolean).slice(0, 32);
  }
  if (typeof value === "string") {
    return value.split(/[,،]/).map((t) => cleanText(t)).filter(Boolean).slice(0, 32);
  }
  return [];
}

function isHttpUrl(value) {
  const s = cleanText(value);
  if (!s) return false;
  try {
    const url = new URL(s);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function itemToRow(item) {
  return {
    ...item,
    featured: item.featured ? 1 : 0,
    published: item.published ? 1 : 0,
    tags_json: JSON.stringify(Array.isArray(item.tags) ? item.tags : []),
    updated_at: item.updated_at || nowIso(),
    created_at: item.created_at || nowIso(),
  };
}

function rowToItem(row) {
  if (!row) return null;
  let tags = [];
  try {
    tags = JSON.parse(row.tags_json || "[]");
    if (!Array.isArray(tags)) tags = [];
  } catch {
    tags = [];
  }
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    short: row.short,
    desc: row.description,
    prompt: row.prompt,
    model: row.model,
    version: row.version,
    image: row.image,
    video: row.video,
    author: row.author,
    date: row.date,
    featured: !!row.featured,
    published: !!row.published,
    tags,
    type: row.video ? "video" : "image",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function seedDatabaseIfEmpty() {
  const count = db.prepare("SELECT COUNT(*) AS c FROM gallery_items").get().c;
  if (count > 0) return;

  const insert = db.prepare(`
    INSERT INTO gallery_items (
      id, title, category, short, description, prompt, model, version,
      image, video, author, date, featured, published, tags_json, created_at, updated_at
    ) VALUES (
      @id, @title, @category, @short, @description, @prompt, @model, @version,
      @image, @video, @author, @date, @featured, @published, @tags_json, @created_at, @updated_at
    )
  `);

  const tx = db.transaction((items) => {
    for (const item of items) {
      const now = nowIso();
      insert.run(itemToRow({
        ...item,
        created_at: now,
        updated_at: now,
      }));
    }
  });

  tx(seedItems);
}
seedDatabaseIfEmpty();

function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function sendText(res, status, body, contentType = "text/plain; charset=utf-8") {
  res.writeHead(status, {
    "Content-Type": contentType,
    "Cache-Control": "no-cache",
  });
  res.end(body);
}

function readBody(req, limit = 120000) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(Object.assign(new Error("payload_too_large"), { code: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

async function readJson(req, limit) {
  const raw = await readBody(req, limit);
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch {
    const err = new Error("invalid_json");
    err.code = 400;
    throw err;
  }
}

function getIp(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || req.socket.remoteAddress || "unknown";
}

function getToken(req) {
  const auth = String(req.headers.authorization || "");
  if (auth.startsWith("Bearer ")) return auth.slice(7).trim();
  return "";
}

function safeEqual(a, b) {
  const ha = crypto.createHash("sha256").update(String(a)).digest();
  const hb = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function createSession() {
  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, Date.now() + SESSION_TTL_MS);
  return token;
}

function isValidSession(token) {
  if (!token) return false;
  const exp = sessions.get(token);
  if (!exp) return false;
  if (Date.now() > exp) {
    sessions.delete(token);
    return false;
  }
  return true;
}

function ensureAdmin(req, res) {
  if (req.method === "OPTIONS") return true;
  if (isValidSession(getToken(req))) return true;
  json(res, 401, { ok: false, error: "unauthorized" });
  return false;
}

function rateLimited(ip) {
  const now = Date.now();
  const existing = attempts.get(ip);
  if (!existing || now >= existing.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    return false;
  }
  existing.count += 1;
  return existing.count > LOGIN_MAX_ATTEMPTS;
}

setInterval(() => {
  const now = Date.now();
  for (const [token, exp] of sessions) {
    if (now > exp) sessions.delete(token);
  }
  for (const [ip, rec] of attempts) {
    if (now > rec.resetAt) attempts.delete(ip);
  }
}, 60_000).unref();

function parseIntParam(value, fallback) {
  const n = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(n) ? n : fallback;
}

function buildWhere({ q, category, type, featured, published }) {
  const clauses = [];
  const params = [];
  const qText = cleanText(q);

  if (published !== undefined && published !== null && published !== "" && published !== "all") {
    clauses.push("published = ?");
    params.push(toBool(published) ? 1 : 0);
  }

  if (category) {
    clauses.push("LOWER(category) = LOWER(?)");
    params.push(cleanText(category));
  }

  if (type === "image") {
    clauses.push("(video = '' OR video IS NULL)");
  } else if (type === "video") {
    clauses.push("(video IS NOT NULL AND TRIM(video) <> '')");
  }

  if (featured !== undefined && featured !== null && featured !== "" && featured !== "all") {
    clauses.push("featured = ?");
    params.push(toBool(featured) ? 1 : 0);
  }

  if (qText) {
    const like = `%${qText.toLowerCase()}%`;
    clauses.push(`(
      LOWER(title) LIKE ? OR
      LOWER(category) LIKE ? OR
      LOWER(short) LIKE ? OR
      LOWER(description) LIKE ? OR
      LOWER(prompt) LIKE ? OR
      LOWER(model) LIKE ? OR
      LOWER(version) LIKE ? OR
      LOWER(author) LIKE ? OR
      LOWER(tags_json) LIKE ?
    )`);
    params.push(like, like, like, like, like, like, like, like, like);
  }

  return { where: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "", params };
}

function buildOrder(sort) {
  switch (String(sort || "newest")) {
    case "oldest":
      return "ORDER BY datetime(created_at) ASC, title COLLATE NOCASE ASC";
    case "az":
      return "ORDER BY title COLLATE NOCASE ASC, datetime(created_at) DESC";
    case "za":
      return "ORDER BY title COLLATE NOCASE DESC, datetime(created_at) DESC";
    case "featured":
      return "ORDER BY featured DESC, datetime(created_at) DESC, title COLLATE NOCASE ASC";
    case "newest":
    default:
      return "ORDER BY datetime(created_at) DESC, title COLLATE NOCASE ASC";
  }
}

function listItems(filters = {}, { admin = false } = {}) {
  const where = buildWhere(filters);
  const sort = buildOrder(filters.sort);
  const limit = Math.max(1, Math.min(parseIntParam(filters.limit, admin ? 5000 : 1000), admin ? 5000 : 1000));
  const offset = Math.max(0, parseIntParam(filters.offset, 0));
  const sql = `SELECT * FROM gallery_items ${where.where} ${sort} LIMIT ? OFFSET ?`;
  const rows = db.prepare(sql).all(...where.params, limit, offset);
  return rows.map(rowToItem);
}

function getItemById(id) {
  return rowToItem(db.prepare("SELECT * FROM gallery_items WHERE id = ?").get(id));
}

function validateItemPayload(payload, existing = null) {
  const merged = {
    title: cleanText(payload.title ?? existing?.title ?? ""),
    category: cleanText(payload.category ?? existing?.category ?? ""),
    short: cleanText(payload.short ?? existing?.short ?? ""),
    description: cleanText(payload.desc ?? payload.description ?? existing?.desc ?? existing?.description ?? ""),
    prompt: cleanText(payload.prompt ?? existing?.prompt ?? ""),
    model: cleanText(payload.model ?? existing?.model ?? ""),
    version: cleanText(payload.version ?? existing?.version ?? ""),
    image: cleanText(payload.image ?? existing?.image ?? ""),
    video: cleanText(payload.video ?? existing?.video ?? ""),
    author: cleanText(payload.author ?? existing?.author ?? ""),
    date: normalizeDate(payload.date ?? existing?.date ?? ""),
    featured: toBool(payload.featured ?? existing?.featured ?? false),
    published: toBool(payload.published ?? existing?.published ?? false),
    tags: normalizeTags(payload.tags ?? existing?.tags ?? []),
  };

  const errors = {};
  if (!merged.title) errors.title = "required";
  if (!merged.category) errors.category = "required";
  if (!merged.short) errors.short = "required";
  if (!merged.image) errors.image = "required";
  if (merged.title.length > 160) errors.title = "too_long";
  if (merged.category.length > 120) errors.category = "too_long";
  if (merged.short.length > 280) errors.short = "too_long";
  if (merged.description.length > 8000) errors.description = "too_long";
  if (merged.prompt.length > 12000) errors.prompt = "too_long";
  if (merged.model.length > 120) errors.model = "too_long";
  if (merged.version.length > 60) errors.version = "too_long";
  if (merged.author.length > 120) errors.author = "too_long";
  if (merged.image && !isHttpUrl(merged.image)) errors.image = "invalid_url";
  if (merged.video && !isHttpUrl(merged.video)) errors.video = "invalid_url";

  if (Object.keys(errors).length) {
    const err = new Error("validation_error");
    err.code = 400;
    err.details = errors;
    throw err;
  }

  return merged;
}

function insertItem(payload) {
  const data = validateItemPayload(payload);
  const id = `itm_${Date.now().toString(36)}${crypto.randomBytes(3).toString("hex")}`;
  const now = nowIso();
  const record = {
    id,
    title: data.title,
    category: data.category,
    short: data.short,
    description: data.description,
    prompt: data.prompt,
    model: data.model,
    version: data.version,
    image: data.image,
    video: data.video,
    author: data.author,
    date: data.date,
    featured: data.featured ? 1 : 0,
    published: data.published ? 1 : 0,
    tags_json: JSON.stringify(data.tags),
    created_at: now,
    updated_at: now,
  };
  db.prepare(`
    INSERT INTO gallery_items (
      id, title, category, short, description, prompt, model, version,
      image, video, author, date, featured, published, tags_json, created_at, updated_at
    ) VALUES (
      @id, @title, @category, @short, @description, @prompt, @model, @version,
      @image, @video, @author, @date, @featured, @published, @tags_json, @created_at, @updated_at
    )
  `).run(record);
  return getItemById(id);
}

function updateItem(id, payload) {
  const existing = getItemById(id);
  if (!existing) return null;
  const data = validateItemPayload(payload, existing);
  const now = nowIso();
  db.prepare(`
    UPDATE gallery_items SET
      title = ?,
      category = ?,
      short = ?,
      description = ?,
      prompt = ?,
      model = ?,
      version = ?,
      image = ?,
      video = ?,
      author = ?,
      date = ?,
      featured = ?,
      published = ?,
      tags_json = ?,
      updated_at = ?
    WHERE id = ?
  `).run(
    data.title,
    data.category,
    data.short,
    data.description,
    data.prompt,
    data.model,
    data.version,
    data.image,
    data.video,
    data.author,
    data.date,
    data.featured ? 1 : 0,
    data.published ? 1 : 0,
    JSON.stringify(data.tags),
    now,
    id
  );
  return getItemById(id);
}

function deleteItem(id) {
  const result = db.prepare("DELETE FROM gallery_items WHERE id = ?").run(id);
  return result.changes > 0;
}

const SESSION_TTL_MS = 1000 * 60 * 60 * 6;
const LOGIN_WINDOW_MS = 10 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 8;
const sessions = new Map();
const attempts = new Map();

const galleryStatements = {
  count: db.prepare("SELECT COUNT(*) AS c FROM gallery_items"),
};

const server = http.createServer(async (req, res) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");

  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathName = url.pathname;
  const method = req.method || "GET";

  if (method === "POST" && pathName === "/api/login") {
    const ip = getIp(req);
    if (rateLimited(ip)) return json(res, 429, { ok: false, error: "rate_limited" });
    if (!process.env.ADMIN) return json(res, 503, { ok: false, error: "not_configured" });

    let body;
    try {
      body = await readJson(req, 20000);
    } catch (error) {
      return json(res, error.code || 400, { ok: false, error: error.message || "invalid_json" });
    }

    const password = cleanText(body.password);
    if (password && safeEqual(password, process.env.ADMIN)) {
      attempts.delete(ip);
      return json(res, 200, { ok: true, token: createSession() });
    }
    return json(res, 401, { ok: false, error: "invalid_credentials" });
  }

  if (method === "GET" && pathName === "/api/verify") {
    return isValidSession(getToken(req))
      ? json(res, 200, { ok: true })
      : json(res, 401, { ok: false, error: "unauthorized" });
  }

  if (method === "POST" && pathName === "/api/logout") {
    sessions.delete(getToken(req));
    return json(res, 200, { ok: true });
  }

  if (method === "GET" && pathName === "/api/gallery") {
    const items = listItems({
      q: url.searchParams.get("q") || url.searchParams.get("search") || "",
      category: url.searchParams.get("category") || "",
      type: url.searchParams.get("type") || "",
      featured: url.searchParams.get("featured") || "",
      published: url.searchParams.get("published") || "1",
      sort: url.searchParams.get("sort") || "newest",
      limit: url.searchParams.get("limit") || "1000",
      offset: url.searchParams.get("offset") || "0",
    });
    return json(res, 200, { ok: true, items, count: items.length });
  }

  if (pathName === "/api/admin/items" && method === "GET") {
    if (!ensureAdmin(req, res)) return;
    const items = listItems({
      q: url.searchParams.get("q") || url.searchParams.get("search") || "",
      category: url.searchParams.get("category") || "",
      type: url.searchParams.get("type") || "",
      featured: url.searchParams.get("featured") || "",
      published: url.searchParams.get("published") || "all",
      sort: url.searchParams.get("sort") || "newest",
      limit: url.searchParams.get("limit") || "5000",
      offset: url.searchParams.get("offset") || "0",
    }, { admin: true });
    return json(res, 200, { ok: true, items, count: items.length });
  }

  if (pathName === "/api/admin/items" && method === "POST") {
    if (!ensureAdmin(req, res)) return;
    try {
      const payload = await readJson(req, 50000);
      const item = insertItem(payload);
      return json(res, 201, { ok: true, item });
    } catch (error) {
      const status = error.code || 400;
      return json(res, status, { ok: false, error: error.message || "bad_request", details: error.details });
    }
  }

  if (pathName.startsWith("/api/admin/items/")) {
    if (!ensureAdmin(req, res)) return;
    const id = decodeURIComponent(pathName.split("/").pop() || "");
    if (!id) return json(res, 400, { ok: false, error: "invalid_id" });

    if (method === "GET") {
      const item = getItemById(id);
      return item ? json(res, 200, { ok: true, item }) : json(res, 404, { ok: false, error: "not_found" });
    }

    if (method === "PUT" || method === "PATCH") {
      try {
        const payload = await readJson(req, 50000);
        const item = updateItem(id, payload);
        return item ? json(res, 200, { ok: true, item }) : json(res, 404, { ok: false, error: "not_found" });
      } catch (error) {
        const status = error.code || 400;
        return json(res, status, { ok: false, error: error.message || "bad_request", details: error.details });
      }
    }

    if (method === "DELETE") {
      const removed = deleteItem(id);
      return removed ? json(res, 200, { ok: true }) : json(res, 404, { ok: false, error: "not_found" });
    }
  }

  if (pathName.startsWith("/api/")) {
    return json(res, 404, { ok: false, error: "not_found" });
  }

  if (method === "GET" || method === "HEAD") {
    fs.readFile(INDEX_PATH, (err, buf) => {
      if (err) {
        return sendText(res, 500, "index.html not found");
      }
      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-cache",
      });
      res.end(method === "HEAD" ? undefined : buf);
    });
    return;
  }

  return json(res, 405, { ok: false, error: "method_not_allowed" });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`SQLite database: ${DB_PATH}`);
  if (!process.env.ADMIN) {
    console.warn("ADMIN environment variable is not set. Admin login will be disabled until it is configured.");
  }
}); 