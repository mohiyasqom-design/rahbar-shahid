/* ============================================================================
   script.js — آرشیو آثار تشییع رهبر شهید
   Architecture (modular, no globals leaked):
     Utils → Store (LocalStorage) → Seed → Toast → FX (cursor/particles/reveal)
     → Theme → Nav → Gallery → Viewer → Auth → Admin → Boot
   ============================================================================ */
(() => {
"use strict";

/* ───────────────────────── 1. UTILITIES ───────────────────────── */
const $  = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const faDigits = n => String(n).replace(/\d/g, d => "۰۱۲۳۴۵۶۷۸۹"[d]);
const uid = () => "art_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const escapeHTML = s => String(s ?? "").replace(/[&<>"']/g, m =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
const debounce = (fn, ms = 250) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const fmtDate = iso => { try { return new Intl.DateTimeFormat("fa-IR", { dateStyle: "long" }).format(new Date(iso)); } catch { return iso; } };
const highlight = (text, q) => {
  const safe = escapeHTML(text);
  if (!q) return safe;
  const rx = new RegExp("(" + q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "gi");
  return safe.replace(rx, "<mark>$1</mark>");
};

/* ───────────────────────── 2. STORAGE LAYER ─────────────────────
   Namespaced keys so settings / items / drafts never collide.     */
const Store = {
  KEYS: { items: "tashi.items.v1", theme: "tashi.theme", session: "tashi.admin.session" },
  read(key, fallback) {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
    catch { return fallback; }
  },
  write(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { console.warn("Storage full:", e); } },
  items()      { return this.read(this.KEYS.items, []); },
  saveItems(v) { this.write(this.KEYS.items, v); }
};

/* ───────────────────────── 3. SEED CONTENT ─────────────────────
   Realistic sample artworks; fully editable through the admin.    */
const SEED = [
  {
    title: "دریای بی‌پایان", category: "عکاسی هنری",
    short: "قابی هوایی از موج میلیونی جمعیت در مسیر تشییع.",
    desc: "این اثر با ترکیب‌بندی عمودی و نور طلایی غروب، عظمت حضور مردمی را در قالبی سینمایی ثبت کرده است؛ گویی رودی از انسان‌ها به سوی افق جاری است.",
    prompt: "Aerial cinematic photograph of an endless sea of mourners at dusk, golden light, dramatic depth, ultra-wide composition, volumetric haze, 8k",
    model: "Midjourney", version: "v6.1",
    image: "https://picsum.photos/seed/tashi1/1200/900",
    video: "", tags: ["هوایی", "جمعیت", "غروب"], author: "استودیو نور",
    date: "2026-05-02", featured: true, published: true
  },
  {
    title: "وداع در سکوت", category: "نقاشی دیجیتال",
    short: "پرترهٔ مفهومی از اندوه جمعی با پالت مونوکروم.",
    desc: "نقاشی دیجیتالی با ضرب‌قلم‌های نرم و نور موضعی که سکوتِ سنگین لحظهٔ وداع را روایت می‌کند.",
    prompt: "Monochrome digital painting, collective grief, soft brush strokes, single candle light source, emotional atmosphere, fine art style",
    model: "Stable Diffusion", version: "XL 1.0",
    image: "https://picsum.photos/seed/tashi2/1200/900",
    video: "", tags: ["مفهومی", "مونوکروم"], author: "هنرمند ناشناس",
    date: "2026-05-04", featured: false, published: true
  },
  {
    title: "خط و نور", category: "خوش‌نویسی",
    short: "ترکیب خوش‌نویسی نستعلیق با نورپردازی حجمی.",
    desc: "حروف نستعلیق در فضایی از غبار نور شناورند؛ تلفیقی از سنت خوش‌نویسی ایرانی و گرافیک مدرن.",
    prompt: "Persian nastaliq calligraphy floating in volumetric light rays, dark background, gold ink particles, cinematic render, octane",
    model: "Midjourney", version: "v6",
    image: "https://picsum.photos/seed/tashi3/1200/900",
    video: "", tags: ["نستعلیق", "طلایی"], author: "آکادمی جهان پرامپت",
    date: "2026-05-06", featured: true, published: true
  },
  {
    title: "مسیر گل‌باران", category: "عکاسی هنری",
    short: "لحظهٔ باریدن گلبرگ‌ها بر مسیر عبور.",
    desc: "شاتِ اسلوموشن از گلبرگ‌های معلق در هوا؛ نمادی از احترام و بدرقهٔ مردمی.",
    prompt: "Slow-motion rose petals falling over a procession path, backlit, shallow depth of field, cinematic 35mm, emotional documentary style",
    model: "DALL·E", version: "3",
    image: "https://picsum.photos/seed/tashi4/1200/900",
    video: "", tags: ["گلبرگ", "اسلوموشن"], author: "استودیو نور",
    date: "2026-05-08", featured: false, published: true
  },
  {
    title: "شبِ شمع‌ها", category: "نقاشی دیجیتال",
    short: "هزاران شمع روشن در تاریکی؛ روایت امید و یاد.",
    desc: "اثری با کنتراست بالا میان تاریکی شب و گرمای هزاران شعلهٔ کوچک که تا افق ادامه دارند.",
    prompt: "Thousands of candle flames stretching to the horizon at night, bokeh, warm-cold contrast, painterly digital art, atmospheric",
    model: "Stable Diffusion", version: "3.5",
    image: "https://picsum.photos/seed/tashi5/1200/900",
    video: "", tags: ["شمع", "شب", "بوکه"], author: "هنرمند ناشناس",
    date: "2026-05-10", featured: false, published: true
  },
  {
    title: "قاب خاطره", category: "موشن و ویدیو",
    short: "کلیپ کوتاه سینمایی از قاب‌های ماندگار آن روز.",
    desc: "مونتاژی آرام با گذارهای محو و موسیقیِ سکوت؛ برای مرور تصویریِ خاطره‌ها.",
    prompt: "Cinematic slow montage, archival memorial frames, gentle cross dissolves, film grain, 24fps, elegiac tone",
    model: "Runway", version: "Gen-3",
    image: "https://picsum.photos/seed/tashi6/1200/900",
    video: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
    tags: ["ویدیو", "مونتاژ"], author: "آکادمی جهان پرامپت",
    date: "2026-05-12", featured: true, published: true
  }
].map(x => ({ id: uid(), ...x }));

if (!localStorage.getItem(Store.KEYS.items)) Store.saveItems(SEED);

/* ───────────────────────── 4. TOASTS ───────────────────────── */
const Toast = {
  show(msg, type = "info", ms = 3200) {
    const el = document.createElement("div");
    el.className = `toast toast--${type}`;
    el.innerHTML = `<span>${type === "success" ? "✅" : type === "error" ? "⚠️" : "ℹ️"}</span><span>${escapeHTML(msg)}</span>`;
    $("#toasts").appendChild(el);
    setTimeout(() => { el.classList.add("is-leaving"); el.addEventListener("animationend", () => el.remove()); }, ms);
  }
};

/* ───────────────────────── 5. FX: cursor, particles, reveal, ripple ── */
const FX = {
  init() { this.cursor(); this.particles(); this.reveal(); this.ripple(); this.split(); this.progress(); },

  /* Split headline text into per-character spans for staggered entrance */
  split() {
    $$("[data-split]").forEach(el => {
      const text = el.textContent.trim();
      el.textContent = "";
      [...text].forEach((ch, i) => {
        const s = document.createElement("span");
        s.className = "ch"; s.style.setProperty("--i", i);
        s.textContent = ch === " " ? "\u00A0" : ch;
        el.appendChild(s);
      });
    });
  },

  /* Custom cursor + trailing glow (pointer devices only) */
  cursor() {
    if (matchMedia("(pointer:coarse)").matches) return;
    const dot = $("#cursor"), glow = $("#cursorGlow");
    let x = 0, y = 0, gx = 0, gy = 0;
    addEventListener("mousemove", e => { x = e.clientX; y = e.clientY; dot.style.transform = `translate(${x}px,${y}px) translate(-50%,-50%)`; });
    (function loop() { gx += (x - gx) * .12; gy += (y - gy) * .12;
      glow.style.transform = `translate(${gx}px,${gy}px) translate(-50%,-50%)`; requestAnimationFrame(loop); })();
    document.addEventListener("mouseover", e =>
      dot.classList.toggle("is-hover", !!e.target.closest("a,button,input,select,textarea,.card")));
  },

  /* Lightweight ambient particle field */
  particles() {
    const cv = $("#particles"), ctx = cv.getContext("2d");
    let W, H, pts;
    const resize = () => { W = cv.width = innerWidth; H = cv.height = innerHeight;
      pts = Array.from({ length: Math.min(70, W / 22) }, () => ({
        x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.8 + .4,
        vx: (Math.random() - .5) * .25, vy: (Math.random() - .5) * .25, a: Math.random() * .5 + .15 })); };
    resize(); addEventListener("resize", debounce(resize, 200));
    (function loop() {
      ctx.clearRect(0, 0, W, H); ctx.fillStyle = "#d4af37";
      for (const p of pts) {
        p.x = (p.x + p.vx + W) % W; p.y = (p.y + p.vy + H) % H;
        ctx.globalAlpha = p.a; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill();
      }
      requestAnimationFrame(loop);
    })();
  },

  /* Scroll-reveal via IntersectionObserver (also used for lazy cards) */
  observer: new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add("in-view"); FX.observer.unobserve(e.target); }
  }), { threshold: .12 }),
  reveal() { $$(".reveal").forEach(el => this.observer.observe(el)); },
  watch(el) { this.observer.observe(el); },

  /* Ripple micro-interaction on all buttons */
  ripple() {
    document.addEventListener("click", e => {
      const btn = e.target.closest(".btn"); if (!btn) return;
      const r = document.createElement("span"), rect = btn.getBoundingClientRect(), d = Math.max(rect.width, rect.height);
      r.className = "ripple";
      Object.assign(r.style, { width: d + "px", height: d + "px",
        left: e.clientX - rect.left - d / 2 + "px", top: e.clientY - rect.top - d / 2 + "px" });
      btn.appendChild(r); setTimeout(() => r.remove(), 650);
    });
  },

  /* Reading progress bar */
  progress() {
    addEventListener("scroll", () => {
      const h = document.documentElement, p = h.scrollTop / (h.scrollHeight - h.clientHeight) * 100;
      $("#scrollProgress").style.width = p + "%";
    }, { passive: true });
  },

  /* Animated numeric counters (hero stats) */
  count(el, target) {
    const dur = 1200, t0 = performance.now();
    (function tick(t) {
      const k = Math.min(1, (t - t0) / dur), eased = 1 - Math.pow(1 - k, 3);
      el.textContent = faDigits(Math.round(target * eased));
      if (k < 1) requestAnimationFrame(tick);
    })(t0);
  }
};

/* ───────────────────────── 6. THEME ───────────────────────── */
const Theme = {
  init() {
    const saved = Store.read(Store.KEYS.theme, "dark");
    document.body.dataset.theme = saved;
    $("#themeToggle").addEventListener("click", () => {
      const next = document.body.dataset.theme === "dark" ? "light" : "dark";
      document.body.dataset.theme = next;
      Store.write(Store.KEYS.theme, next);
      Toast.show(next === "dark" ? "پوستهٔ تیره فعال شد" : "پوستهٔ روشن فعال شد", "info", 2000);
    });
  }
};

/* ───────────────────────── 7. NAVIGATION ───────────────────── */
const Nav = {
  init() {
    const nav = $("#nav"); let lastY = 0;
    addEventListener("scroll", () => { // hide on scroll-down, show on scroll-up
      const y = scrollY;
      nav.classList.toggle("is-hidden", y > lastY && y > 140);
      lastY = y;
    }, { passive: true });

    const burger = $("#burger"), links = $("#navLinks");
    burger.addEventListener("click", () => {
      const open = links.classList.toggle("is-open");
      burger.setAttribute("aria-expanded", open);
    });
    $$("[data-nav]").forEach(a => a.addEventListener("click", e => {
      const id = a.getAttribute("href");
      if (id && id.startsWith("#")) { e.preventDefault(); $(id)?.scrollIntoView({ behavior: "smooth" }); }
      links.classList.remove("is-open"); burger.setAttribute("aria-expanded", "false");
      $$("#navLinks a").forEach(x => x.classList.toggle("is-active", x === a));
    }));

    $("#backToTop").addEventListener("click", () => scrollTo({ top: 0, behavior: "smooth" }));
    $("#enterBtn").addEventListener("click", () =>
      $("#gallery").scrollIntoView({ behavior: "smooth" }));
  }
};

/* ───────────────────────── 8. GALLERY ─────────────────────── */
const Gallery = {
  state: { q: "", type: "all", cats: new Set(), sort: "newest" },

  init() {
    $("#searchInput").addEventListener("input", debounce(e => { this.state.q = e.target.value.trim(); this.render(); }, 200));
    $("#sortSelect").addEventListener("change", e => { this.state.sort = e.target.value; this.render(); });
    $$(".toolbar__types .chip").forEach(b => b.addEventListener("click", () => {
      $$(".toolbar__types .chip").forEach(x => x.classList.remove("is-active"));
      b.classList.add("is-active"); this.state.type = b.dataset.type; this.render();
    }));
    $("#clearFilters").addEventListener("click", () => {
      Object.assign(this.state, { q: "", type: "all", cats: new Set(), sort: "newest" });
      $("#searchInput").value = ""; $("#sortSelect").value = "newest";
      $$(".toolbar__types .chip").forEach((x, i) => x.classList.toggle("is-active", i === 0));
      this.render(); this.renderChips();
    });
    this.renderChips(); this.render(); this.updateHeroStats();
  },

  published() { return Store.items().filter(i => i.published); },

  filtered() {
    const { q, type, cats, sort } = this.state;
    let list = this.published();
    if (type === "image") list = list.filter(i => !i.video);
    if (type === "video") list = list.filter(i => !!i.video);
    if (cats.size) list = list.filter(i => cats.has(i.category));
    if (q) {
      const s = q.toLowerCase();
      list = list.filter(i => [i.title, i.short, i.desc, i.prompt, i.category, (i.tags || []).join(" ")]
        .join(" ").toLowerCase().includes(s));
    }
    const by = {
      newest:   (a, b) => b.date.localeCompare(a.date),
      oldest:   (a, b) => a.date.localeCompare(b.date),
      az:       (a, b) => a.title.localeCompare(b.title, "fa"),
      za:       (a, b) => b.title.localeCompare(a.title, "fa"),
      featured: (a, b) => (b.featured - a.featured) || b.date.localeCompare(a.date)
    };
    list.sort(by[sort] || by.newest);
    // featured always float to top on default view
    if (sort === "newest") list.sort((a, b) => b.featured - a.featured);
    return list;
  },

  renderChips() {
    const cats = [...new Set(this.published().map(i => i.category))];
    $("#categoryChips").innerHTML = cats.map(c =>
      `<button class="chip ${this.state.cats.has(c) ? "is-active" : ""}" data-cat="${escapeHTML(c)}">${escapeHTML(c)}</button>`).join("");
    $$("#categoryChips .chip").forEach(b => b.addEventListener("click", () => {
      const c = b.dataset.cat;
      this.state.cats.has(c) ? this.state.cats.delete(c) : this.state.cats.add(c);
      b.classList.toggle("is-active"); this.render();
    }));
  },

  render() {
    const grid = $("#galleryGrid"), list = this.filtered(), q = this.state.q;
    $("#emptyState").hidden = list.length > 0;
    grid.innerHTML = list.map(i => `
      <article aria-label="${escapeHTML(i.title)}" class="card glass" data-id="${i.id}" tabindex="0">
<div class="card__media skeleton">
<span class="badge badge--cat">${escapeHTML(i.category)}</span>
          ${i.featured ? '<span class="badge badge--featured">★ برگزیده</span>' : ""}
          ${i.video ? '<span class="badge badge--video">🎬 ویدیو</span>' : ""}
          <img alt="${escapeHTML(i.title)}" data-src="${escapeHTML(i.image)}" loading="lazy"/>
<div class="card__overlay"><button class="btn btn--primary btn--sm" data-view="${i.id}">مشاهده</button></div>
</div>
<div class="card__body">
<h3 class="card__title">${highlight(i.title, q)}</h3>
<p class="card__desc">${highlight(i.short, q)}</p>
<div class="card__tags">${(i.tags || []).map(t => `<span>#${escapeHTML(t)}</span>`).join("")}</div>
<div class="card__foot"><span class="card__date">${fmtDate(i.date)}</span></div>
</div>
</article>`).join("");

    // Lazy-load imgs + entrance animation
    $$(".card", grid).forEach((card, idx) => {
      card.style.transitionDelay = (idx % 6) * 60 + "ms";
      FX.watch(card);
      const img = $("img", card);
      const io = new IntersectionObserver(es => es.forEach(e => {
        if (!e.isIntersecting) return;
        img.src = img.dataset.src;
        img.addEventListener("load", () => { img.classList.add("is-loaded"); img.parentElement.classList.remove("skeleton"); }, { once: true });
        img.addEventListener("error", () => img.parentElement.classList.remove("skeleton"), { once: true });
        io.disconnect();
      }), { rootMargin: "200px" });
      io.observe(card);
      card.addEventListener("keydown", e => { if (e.key === "Enter") Viewer.open(card.dataset.id); });
    });
    $$("[data-view]", grid).forEach(b => b.addEventListener("click", () => Viewer.open(b.dataset.view)));
  },

  updateHeroStats() {
    const items = this.published();
    FX.count($("#statItems"), items.length);
    FX.count($("#statCats"), new Set(items.map(i => i.category)).size);
    FX.count($("#statFeatured"), items.filter(i => i.featured).length);
  }
};

/* ───────────────────────── 9. ARTWORK VIEWER ───────────────── */
const Viewer = {
  list: [], index: -1,

  init() {
    const m = $("#viewerModal");
    $$("[data-close]", m).forEach(b => b.addEventListener("click", () => this.close()));
    $("#prevItem").addEventListener("click", () => this.step(1));   // RTL: prev = next in list
    $("#nextItem").addEventListener("click", () => this.step(-1));
    addEventListener("keydown", e => {
      if (!m.classList.contains("is-open")) return;
      if (e.key === "Escape") this.close();
      if (e.key === "ArrowRight") this.step(1);
      if (e.key === "ArrowLeft") this.step(-1);
    });
    $("#copyPrompt").addEventListener("click", () => this.copyPrompt());
    $("#shareBtn").addEventListener("click", () => this.share());
    $("#togglePrompt").addEventListener("click", () => {
      const pre = $("#modalPrompt"), col = pre.classList.toggle("is-collapsed");
      $("#togglePrompt").textContent = col ? "نمایش کامل" : "جمع‌کردن";
    });
  },

  open(id) {
    this.list = Gallery.filtered();
    this.index = this.list.findIndex(i => i.id === id);
    if (this.index < 0) return;
    this.renderCurrent();
    $("#viewerModal").classList.add("is-open");
    $("#viewerModal").setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  },

  renderCurrent() {
    const i = this.list[this.index]; if (!i) return;
    const media = $("#modalMedia");
    media.innerHTML = i.video
      ? `<video controls="" playsinline="" poster="${escapeHTML(i.image)}" src="${escapeHTML(i.video)}"></video>`
      : `<img alt="${escapeHTML(i.title)}" src="${escapeHTML(i.image)}"/>`;
    const img = $("img", media);
    if (img) img.addEventListener("click", () => img.classList.toggle("is-zoomed")); // click-to-zoom

    $("#modalTitle").textContent = i.title;
    $("#modalDesc").textContent = i.desc || i.short;
    $("#modalBadges").innerHTML =
      `<span class="badge badge--cat">${escapeHTML(i.category)}</span>` +
      (i.featured ? '<span class="badge badge--featured">★ برگزیده</span>' : "");
    $("#modalPrompt").textContent = i.prompt || "—";
    $("#modalPrompt").classList.add("is-collapsed");
    $("#togglePrompt").textContent = "نمایش کامل";
    $("#promptCount").textContent = faDigits((i.prompt || "").length) + " نویسه";
    $("#modalPromptMeta").textContent = [i.model, i.version].filter(Boolean).join(" · ");
    $("#modalMeta").innerHTML = `
      <dt>پدیدآورنده</dt><dd>${escapeHTML(i.author || "—")}</dd>
<dt>تاریخ ایجاد</dt><dd>${fmtDate(i.date)}</dd>
<dt>برچسب‌ها</dt><dd>${(i.tags || []).map(t => "#" + escapeHTML(t)).join(" ") || "—"}</dd>`;
    const dl = $("#downloadBtn");
    dl.href = i.video || i.image; dl.setAttribute("download", i.title);
  },

  step(dir) {
    if (!this.list.length) return;
    this.index = (this.index + dir + this.list.length) % this.list.length;
    const panel = $(".modal__panel", $("#viewerModal"));
    panel.style.opacity = 0;                                  // quick cross-fade between items
    setTimeout(() => { this.renderCurrent(); panel.style.opacity = 1; }, 180);
  },

  close() {
    $("#viewerModal").classList.remove("is-open");
    $("#viewerModal").setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  },

  async copyPrompt() {
    const i = this.list[this.index]; if (!i?.prompt) return;
    try {
      await navigator.clipboard.writeText(i.prompt);
      const btn = $("#copyPrompt"), old = btn.innerHTML;
      btn.innerHTML = "✔ کپی شد";
      setTimeout(() => (btn.innerHTML = old), 1600);
      Toast.show("پرامپت کپی شد", "success");
    } catch { Toast.show("کپی انجام نشد", "error"); }
  },

  async share() {
    const i = this.list[this.index];
    const data = { title: i.title, text: i.short, url: location.href };
    if (navigator.share) { try { await navigator.share(data); } catch {} }
    else { await navigator.clipboard.writeText(location.href); Toast.show("پیوند کپی شد", "success"); }
  }
};

/* ───────────────────────── 10. ADMIN AUTH ─────────────────── */
const Auth = {
  PASS: "251433",
  init() {
    $("#adminTrigger").addEventListener("click", () => this.openLogin());
    addEventListener("keydown", e => { // hidden shortcut: Ctrl+Shift+A
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "a") { e.preventDefault(); this.openLogin(); } });
    $$("#loginModal [data-close]").forEach(b => b.addEventListener("click", () => this.closeLogin()));
    $("#togglePass").addEventListener("click", () => {
      const inp = $("#passwordInput");
      inp.type = inp.type === "password" ? "text" : "password";
    });
    $("#loginForm").addEventListener("submit", e => { e.preventDefault(); this.tryLogin(); });
    if (Store.read(Store.KEYS.session, false)) Admin.open(); // restore session
  },
  openLogin() {
    if (Store.read(Store.KEYS.session, false)) return Admin.open();
    $("#loginModal").classList.add("is-open");
    $("#loginModal").setAttribute("aria-hidden", "false");
    setTimeout(() => $("#passwordInput").focus(), 300);
  },
  closeLogin() {
    $("#loginModal").classList.remove("is-open");
    $("#loginModal").setAttribute("aria-hidden", "true");
    $("#passwordInput").value = ""; $("#loginError").hidden = true;
  },
  tryLogin() {
    const btn = $("#loginBtn"), input = $("#passwordInput");
    btn.querySelector("span").textContent = "در حال بررسی…";
    setTimeout(() => { // simulated verification delay for elegant feedback
      btn.querySelector("span").textContent = "ورود";
      if (input.value === this.PASS) {
        Store.write(Store.KEYS.session, true);
        this.closeLogin(); Admin.open();
        Toast.show("خوش آمدید؛ به داشبورد وارد شدید", "success");
      } else {
        $("#loginError").hidden = false;
        input.parentElement.classList.remove("shake");
        void input.parentElement.offsetWidth;              // restart animation
        input.parentElement.classList.add("shake");
        Toast.show("گذرواژه نادرست است", "error");
      }
    }, 650);
  }
};

/* ───────────────────────── 11. ADMIN DASHBOARD ─────────────── */
const Admin = {
  state: { q: "", filter: "all", pendingDelete: null },

  init() {
    $$(".admin__nav button").forEach(b => b.addEventListener("click", () => this.switchView(b.dataset.adminView, b)));
    $("#adminExit").addEventListener("click", () => this.exit());
    $("#adminSearch").addEventListener("input", debounce(e => { this.state.q = e.target.value.trim(); this.renderTable(); }, 200));
    $("#adminFilter").addEventListener("change", e => { this.state.filter = e.target.value; this.renderTable(); });

    $("#editorForm").addEventListener("submit", e => { e.preventDefault(); this.save(true); });
    $("#saveDraft").addEventListener("click", () => this.save(false));
    $("#resetForm").addEventListener("click", () => this.fillForm(null));

    $("#confirmYes").addEventListener("click", () => this.confirmDelete(true));
    $("#confirmNo").addEventListener("click", () => this.confirmDelete(false));
  },

  open()  { $("#adminPanel").hidden = false; document.body.style.overflow = "hidden"; this.refresh(); },
  exit()  {
    Store.write(Store.KEYS.session, false);
    $("#adminPanel").hidden = true; document.body.style.overflow = "";
    Toast.show("از بخش مدیریت خارج شدید", "info");
  },
  refresh() { this.renderStats(); this.renderRecent(); this.renderTable(); this.fillCatDatalist(); },

  switchView(name, btn) {
    $$(".admin__nav button").forEach(b => b.classList.toggle("is-active", b === btn));
    $$(".admin__view").forEach(v => (v.hidden = v.dataset.view !== name));
    if (name === "editor" && !$("#fId").value) $("#editorTitle").textContent = "افزودن اثر جدید";
  },

  /* ── Overview ── */
  renderStats() {
    const items = Store.items();
    const stats = [
      ["کل آثار", items.length], ["تصاویر", items.filter(i => !i.video).length],
      ["ویدیوها", items.filter(i => i.video).length],
      ["منتشرشده", items.filter(i => i.published).length],
      ["پیش‌نویس", items.filter(i => !i.published).length],
      ["برگزیده", items.filter(i => i.featured).length],
      ["دسته‌بندی‌ها", new Set(items.map(i => i.category)).size],
      ["برچسب‌ها", new Set(items.flatMap(i => i.tags || [])).size]
    ];
    $("#adminStats").innerHTML = stats.map(([l, v]) =>
      `<div class="stat-card"><b>${faDigits(v)}</b><span>${l}</span></div>`).join("");
  },
  renderRecent() {
    const recent = [...Store.items()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
    $("#adminRecent").innerHTML = recent.map(i => `
      <div class="recent-item">
<img alt="" loading="lazy" src="${escapeHTML(i.image)}"/>
<div><b>${escapeHTML(i.title)}</b><small>${fmtDate(i.date)}</small></div>
</div>`).join("") || "<p>هنوز اثری ثبت نشده است.</p>";
  },

  /* ── Content table ── */
  renderTable() {
    const { q, filter } = this.state;
    let list = Store.items();
    if (filter === "published") list = list.filter(i => i.published);
    if (filter === "draft")     list = list.filter(i => !i.published);
    if (filter === "featured")  list = list.filter(i => i.featured);
    if (q) list = list.filter(i => (i.title + i.category + (i.tags || []).join(" ")).toLowerCase().includes(q.toLowerCase()));

    $("#adminTableBody").innerHTML = list.map(i => `
      <tr data-id="${i.id}">
<td><img alt="" loading="lazy" src="${escapeHTML(i.image)}"/></td>
<td>${escapeHTML(i.title)} ${i.featured ? "⭐" : ""}</td>
<td>${escapeHTML(i.category)}</td>
<td><span class="status ${i.published ? "status--pub" : "status--draft"}">${i.published ? "منتشرشده" : "پیش‌نویس"}</span></td>
<td>${fmtDate(i.date)}</td>
<td><div class="row-actions">
<button class="btn btn--icon" data-act="view" title="مشاهده">👁</button>
<button class="btn btn--icon" data-act="edit" title="ویرایش">✏️</button>
<button class="btn btn--icon" data-act="dup" title="تکثیر">⧉</button>
<button class="btn btn--icon" data-act="feature" title="برگزیده">★</button>
<button class="btn btn--icon" data-act="toggle" title="${i.published ? "لغو انتشار" : "انتشار"}">${i.published ? "⏸" : "▶"}</button>
<button class="btn btn--icon" data-act="del" title="حذف">🗑</button>
</div></td>
</tr>`).join("") || `<tr><td colspan="6" style="text-align:center;padding:2rem">موردی یافت نشد.</td></tr>`;

    $$("#adminTableBody [data-act]").forEach(b => b.addEventListener("click", () => {
      const id = b.closest("tr").dataset.id;
      ({ view: () => { $("#adminPanel").hidden = true; document.body.style.overflow = ""; Viewer.open(id); },
         edit: () => this.edit(id), dup: () => this.duplicate(id), del: () => this.askDelete(id),
         feature: () => this.mutate(id, i => (i.featured = !i.featured), "وضعیت برگزیده تغییر کرد"),
         toggle:  () => this.mutate(id, i => (i.published = !i.published), "وضعیت انتشار تغییر کرد")
      })[b.dataset.act]();
    }));
  },

  mutate(id, fn, msg) {
    const items = Store.items(), it = items.find(x => x.id === id);
    if (!it) return;
    fn(it); Store.saveItems(items);
    this.refresh(); Gallery.renderChips(); Gallery.render(); Gallery.updateHeroStats();
    Toast.show(msg, "success");
  },

  duplicate(id) {
    const items = Store.items(), src = items.find(x => x.id === id);
    if (!src) return;
    items.unshift({ ...src, id: uid(), title: src.title + " (کپی)", published: false, featured: false });
    Store.saveItems(items); this.refresh();
    Toast.show("یک نسخهٔ پیش‌نویس ایجاد شد", "success");
  },

  askDelete(id) {
    this.state.pendingDelete = id;
    $("#confirmModal").classList.add("is-open");
    $("#confirmModal").setAttribute("aria-hidden", "false");
  },
  confirmDelete(yes) {
    $("#confirmModal").classList.remove("is-open");
    $("#confirmModal").setAttribute("aria-hidden", "true");
    if (!yes || !this.state.pendingDelete) return;
    const items = Store.items().filter(i => i.id !== this.state.pendingDelete);
    Store.saveItems(items); this.state.pendingDelete = null;
    this.refresh(); Gallery.render(); Gallery.renderChips(); Gallery.updateHeroStats();
    Toast.show("اثر حذف شد", "success");
  },

  /* ── Editor ── */
  fillCatDatalist() {
    $("#catList").innerHTML = [...new Set(Store.items().map(i => i.category))]
      .map(c => `<option value="${escapeHTML(c)}">`).join("");
  },
  edit(id) {
    const it = Store.items().find(x => x.id === id); if (!it) return;
    this.fillForm(it);
    this.switchView("editor", $$('[data-admin-view="editor"]')[0]);
    $("#editorTitle").textContent = "ویرایش اثر";
  },
  fillForm(i) {
    const f = id => $(id);
    f("#fId").value = i?.id || "";
    f("#fTitle").value = i?.title || ""; f("#fCategory").value = i?.category || "";
    f("#fAuthor").value = i?.author || ""; f("#fDate").value = i?.date || new Date().toISOString().slice(0, 10);
    f("#fShort").value = i?.short || ""; f("#fDesc").value = i?.desc || "";
    f("#fPrompt").value = i?.prompt || ""; f("#fModel").value = i?.model || ""; f("#fVersion").value = i?.version || "";
    f("#fImage").value = i?.image || ""; f("#fVideo").value = i?.video || "";
    f("#fTags").value = (i?.tags || []).join("، ");
    f("#fFeatured").checked = !!i?.featured; f("#fPublished").checked = i ? !!i.published : true;
    $("#editorError").hidden = true;
    $$(".field--float").forEach(x => x.classList.remove("is-invalid"));
    if (!i) $("#editorTitle").textContent = "افزودن اثر جدید";
  },
  save(publishIntent) {
    // Validation with per-field highlighting
    const required = [["#fTitle", "عنوان"], ["#fCategory", "دسته‌بندی"], ["#fShort", "توضیح کوتاه"], ["#fImage", "آدرس تصویر"]];
    let bad = [];
    required.forEach(([sel, name]) => {
      const inp = $(sel), ok = inp.value.trim().length > 0;
      inp.parentElement.classList.toggle("is-invalid", !ok);
      if (!ok) bad.push(name);
    });
    const err = $("#editorError");
    if (bad.length) { err.hidden = false; err.textContent = "فیلدهای الزامی را کامل کنید: " + bad.join("، "); return; }
    err.hidden = true;

    const items = Store.items(), id = $("#fId").value;
    const data = {
      title: $("#fTitle").value.trim(), category: $("#fCategory").value.trim(),
      author: $("#fAuthor").value.trim(), date: $("#fDate").value || new Date().toISOString().slice(0, 10),
      short: $("#fShort").value.trim(), desc: $("#fDesc").value.trim(),
      prompt: $("#fPrompt").value.trim(), model: $("#fModel").value.trim(), version: $("#fVersion").value.trim(),
      image: $("#fImage").value.trim(), video: $("#fVideo").value.trim(),
      tags: $("#fTags").value.split(/[,،]/).map(t => t.trim()).filter(Boolean),
      featured: $("#fFeatured").checked,
      published: publishIntent ? $("#fPublished").checked : false
    };
    if (id) Object.assign(items.find(x => x.id === id) || {}, data);
    else items.unshift({ id: uid(), ...data });
    Store.saveItems(items);

    // Instant public gallery update — no refresh needed
    Gallery.renderChips(); Gallery.render(); Gallery.updateHeroStats();
    this.refresh(); this.fillForm(null);
    Toast.show(publishIntent ? "اثر با موفقیت ذخیره / منتشر شد" : "پیش‌نویس ذخیره شد", "success");
    this.switchView("content", $$('[data-admin-view="content"]')[0]);
  }
};

/* ───────────────────────── 12. PRELOADER + BOOT ────────────── */
const Boot = {
  preload() {
    const bar = $("#preloaderBar"), pct = $("#preloaderPercent");
    let p = 0;
    const timer = setInterval(() => {
      p = Math.min(100, p + Math.random() * 14 + 4);   // organic loading curve
      bar.style.width = p + "%"; pct.textContent = faDigits(Math.round(p)) + "٪";
      if (p >= 100) {
        clearInterval(timer);
        setTimeout(() => {
          $("#preloader").classList.add("is-done");
          document.body.style.overflow = "";
        }, 500);
      }
    }, 180);
  },

  init() {
    document.body.style.overflow = "hidden"; // locked while the preloader plays
    FX.init();
    Theme.init();
    Nav.init();
    Gallery.init();
    Viewer.init();
    Auth.init();
    Admin.init();
    this.preload();
  }
};

Boot.init();

})();