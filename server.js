/**
 * ============================================================
 *  آرشیو آثار تشییع رهبر شهید — سرور احراز هویت مدیر
 * ------------------------------------------------------------
 *  مسئولیت این فایل فقط و فقط:
 *    1) سرو کردن index.html (برای همه مسیرها از جمله /admin)
 *    2) احراز هویت امن مدیر از طریق متغیر محیطی ADMIN
 *
 *  ⚠️ رمز عبور هرگز در کد وجود ندارد.
 *     پس از استقرار، متغیر محیطی ADMIN را در پنل هاست
 *     (Railway / Render / …) تعریف کنید. مقدار آن، رمز مدیر است.
 *
 *  بدون هیچ وابستگی خارجی (فقط ماژول‌های داخلی Node.js)
 *  اجرا:  node server.js
 * ============================================================
 */

"use strict";

const http   = require("http");
const fs     = require("fs");
const path   = require("path");
const crypto = require("crypto");

const PORT       = process.env.PORT || 3000;
const INDEX_PATH = path.join(__dirname, "index.html");

/* ------------------------------------------------------------
   1) مدیریت نشست‌ها (توکن‌های موقت در حافظه)
------------------------------------------------------------ */
const SESSION_TTL = 1000 * 60 * 60 * 6; // ۶ ساعت
const sessions = new Map(); // token -> expiry timestamp

function createSession() {
  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, Date.now() + SESSION_TTL);
  return token;
}
function isValidSession(token) {
  if (!token || !sessions.has(token)) return false;
  if (Date.now() > sessions.get(token)) { sessions.delete(token); return false; }
  return true;
}
// پاک‌سازی دوره‌ای نشست‌های منقضی
setInterval(() => {
  const now = Date.now();
  for (const [t, exp] of sessions) if (now > exp) sessions.delete(t);
}, 60_000).unref();

/* ------------------------------------------------------------
   2) محدودسازی نرخ تلاش ورود (ضد Brute-Force)
------------------------------------------------------------ */
const attempts = new Map(); // ip -> { count, resetAt }
const MAX_ATTEMPTS = 8;
const WINDOW_MS    = 10 * 60 * 1000; // ۱۰ دقیقه

function rateLimited(ip) {
  const now = Date.now();
  const rec = attempts.get(ip);
  if (!rec || now > rec.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  rec.count++;
  return rec.count > MAX_ATTEMPTS;
}

/* ------------------------------------------------------------
   3) مقایسه امن رمز (مقاوم در برابر Timing Attack)
------------------------------------------------------------ */
function safeEqual(a, b) {
  const ha = crypto.createHash("sha256").update(String(a)).digest();
  const hb = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

/* ------------------------------------------------------------
   4) ابزارهای پاسخ
------------------------------------------------------------ */
function json(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function readBody(req, limit = 4096) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > limit) { req.destroy(); reject(new Error("payload too large")); }
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function getToken(req) {
  const h = req.headers["authorization"] || "";
  return h.startsWith("Bearer ") ? h.slice(7) : null;
}

/* ------------------------------------------------------------
   5) سرور HTTP
------------------------------------------------------------ */
const server = http.createServer(async (req, res) => {
  // هدرهای امنیتی پایه
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const ip  = (req.headers["x-forwarded-for"] || "").split(",")[0].trim()
              || req.socket.remoteAddress || "unknown";

  /* ---- POST /api/login — احراز هویت مدیر ---- */
  if (req.method === "POST" && url.pathname === "/api/login") {
    if (rateLimited(ip)) return json(res, 429, { ok: false, error: "rate" });

    const adminPassword = process.env.ADMIN;
    if (!adminPassword) {
      // مالک سایت هنوز متغیر محیطی ADMIN را تنظیم نکرده است
      return json(res, 503, { ok: false, error: "not_configured" });
    }

    let password = "";
    try {
      const body = await readBody(req);
      password = (JSON.parse(body || "{}").password || "").toString();
    } catch {
      return json(res, 400, { ok: false });
    }

    if (password && safeEqual(password, adminPassword)) {
      attempts.delete(ip); // بازنشانی شمارنده پس از ورود موفق
      return json(res, 200, { ok: true, token: createSession() });
    }
    // پاسخ شکست — بدون هیچ اطلاعات حساسی
    return json(res, 401, { ok: false });
  }

  /* ---- GET /api/verify — بررسی اعتبار نشست ---- */
  if (req.method === "GET" && url.pathname === "/api/verify") {
    return isValidSession(getToken(req))
      ? json(res, 200, { ok: true })
      : json(res, 401, { ok: false });
  }

  /* ---- POST /api/logout — پایان نشست ---- */
  if (req.method === "POST" && url.pathname === "/api/logout") {
    sessions.delete(getToken(req));
    return json(res, 200, { ok: true });
  }

  /* ---- سایر مسیرهای /api — ناشناخته ---- */
  if (url.pathname.startsWith("/api/")) {
    return json(res, 404, { ok: false });
  }

  /* ---- سرو کردن اپلیکیشن (SPA) — همه مسیرها از جمله /admin ---- */
  if (req.method === "GET" || req.method === "HEAD") {
    fs.readFile(INDEX_PATH, (err, buf) => {
      if (err) {
        res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
        return res.end("index.html not found");
      }
      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-cache",
      });
      res.end(req.method === "HEAD" ? undefined : buf);
    });
    return;
  }

  json(res, 405, { ok: false });
});

server.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  if (!process.env.ADMIN) {
    console.warn("⚠️  متغیر محیطی ADMIN تنظیم نشده — ورود مدیر تا تنظیم آن غیرفعال است.");
  }
});