// D-Group Website – Verhalten der Seite. Keine Abhängigkeiten, läuft als ES-Modul.

const API_BASE = (document.querySelector('meta[name="dgroup-api"]')?.content || "").replace(/\/$/, "");
const REDUCED_MOTION = matchMedia("(prefers-reduced-motion: reduce)").matches;

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const eur = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });
const money = (cents) => eur.format(cents / 100);

async function api(path, options = {}) {
  const res = await fetch(API_BASE + path, { ...options, headers: { Accept: "application/json", ...options.headers } });
  let body = null;
  try {
    body = await res.json();
  } catch {
    /* Antwort ohne JSON */
  }
  if (!res.ok) {
    const err = new Error(body?.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

// Kleiner DOM-Helfer: Inhalte immer als Text setzen, nie als HTML.
function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value == null || value === false) continue;
    if (key === "class") el.className = value;
    else if (key === "text") el.textContent = value;
    else el.setAttribute(key, value === true ? "" : value);
  }
  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    el.append(child.nodeType ? child : document.createTextNode(child));
  }
  return el;
}

function icon(name) {
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("class", "ico");
  svg.setAttribute("aria-hidden", "true");
  const use = document.createElementNS(NS, "use");
  use.setAttribute("href", `#${name}`);
  svg.append(use);
  return svg;
}

// ---------------------------------------------------------------- Kopfbereich
function initHeader() {
  const header = $("#header");
  const nav = $("#nav");
  const btn = $("#menu-btn");

  const onScroll = () => header.classList.toggle("is-scrolled", scrollY > 8);
  onScroll();
  addEventListener("scroll", onScroll, { passive: true });

  const setOpen = (open) => {
    nav.classList.toggle("is-open", open);
    btn.setAttribute("aria-expanded", String(open));
    btn.setAttribute("aria-label", open ? "Menü schließen" : "Menü öffnen");
    $("#menu-icon").setAttribute("href", open ? "#i-close" : "#i-menu");
  };
  btn.addEventListener("click", () => setOpen(!nav.classList.contains("is-open")));
  nav.addEventListener("click", (e) => e.target.closest("a") && setOpen(false));
  addEventListener("keydown", (e) => e.key === "Escape" && setOpen(false));

  // Aktiven Menüpunkt beim Scrollen markieren
  const links = new Map($$('.nav a[href^="#"]:not(.btn)').map((a) => [a.getAttribute("href").slice(1), a]));
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        links.forEach((a) => a.classList.remove("is-active"));
        links.get(entry.target.id)?.classList.add("is-active");
      }
    },
    { rootMargin: "-45% 0px -50% 0px" },
  );
  $$("main > section[id]").forEach((section) => io.observe(section));
}

// ---------------------------------------------------------------- Scroll-Animation
function initReveal() {
  const els = $$(".reveal");
  if (REDUCED_MOTION || !("IntersectionObserver" in window)) {
    els.forEach((el) => el.classList.remove("reveal"));
    return;
  }
  const seen = new Map();
  for (const el of els) {
    const index = seen.get(el.parentElement) || 0;
    seen.set(el.parentElement, index + 1);
    el.style.setProperty("--d", `${Math.min(index * 70, 350)}ms`);
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const el = entry.target;
        io.unobserve(el);
        el.classList.add("is-in");
        // Danach wieder die normalen Hover-Übergänge der Karten nutzen
        setTimeout(() => {
          el.classList.remove("reveal", "is-in");
          el.style.removeProperty("--d");
        }, 1100);
      }
    },
    { threshold: 0.12, rootMargin: "0px 0px -40px 0px" },
  );
  els.forEach((el) => io.observe(el));
}

function initStickyCta() {
  const bar = $("#sticky-cta");
  const link = $("a", bar);
  let heroOut = false;
  const blockers = new Set(); // Bereiche, in denen der Button stören würde (Formular, Demo-Kasse mit Zahlen-Buttons)
  const update = () => {
    const show = heroOut && blockers.size === 0;
    bar.classList.toggle("is-visible", show);
    bar.setAttribute("aria-hidden", String(!show));
    link.tabIndex = show ? 0 : -1;
  };
  new IntersectionObserver(([e]) => ((heroOut = !e.isIntersecting), update())).observe($("#top"));
  const watchBlocker = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => (e.isIntersecting ? blockers.add(e.target.id) : blockers.delete(e.target.id)));
      update();
    },
    { threshold: 0.1 },
  );
  ["kontakt", "pos"].forEach((id) => watchBlocker.observe(document.getElementById(id)));
}

// ---------------------------------------------------------------- Seitendaten aus der API
let siteInfo = null;

async function initSite() {
  $("#year").textContent = new Date().getFullYear();
  try {
    siteInfo = await api("/api/site");
  } catch (err) {
    console.warn("Seitendaten nicht geladen, statische Inhalte bleiben:", err.message);
    return;
  }

  $$("[data-site]").forEach((el) => {
    const value = el.dataset.site.split(".").reduce((obj, key) => obj?.[key], siteInfo);
    if (typeof value === "string" && value) el.textContent = value;
  });

  for (const plan of $$(".plan[data-plan]")) {
    const price = siteInfo.packages?.[plan.dataset.plan]?.price;
    if (!price || typeof price.amount !== "number") continue;
    const fmt = new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: Number.isInteger(price.amount) ? 0 : 2,
    });
    $("[data-price]", plan).textContent = (price.from ? "ab " : "") + fmt.format(price.amount);
    $("[data-price-unit]", plan).textContent = price.unit || "";
  }

  const direct = $("#contact-direct");
  const { email, phone } = siteInfo.contact || {};
  if (email) direct.append(h("li", {}, h("a", { href: `mailto:${email}` }, icon("i-mail"), email)));
  if (phone) direct.append(h("li", {}, h("a", { href: `tel:${phone.replace(/[^\d+]/g, "")}` }, icon("i-call"), phone)));
  direct.hidden = !direct.children.length;
}

// ---------------------------------------------------------------- Demo-Daten (geteilt von Kasse und PDA)
const FALLBACK_ITEMS = [
  { id: "wasser", name: "Mineralwasser 1 L", icon: "💧" },
  { id: "broetchen", name: "Brötchen", icon: "🥐" },
  { id: "schoko", name: "Schokoriegel", icon: "🍫" },
  { id: "apfel", name: "Äpfel 1 kg", icon: "🍎" },
];
const productsPromise = api("/api/products").catch((err) => {
  console.warn("Demo-Artikel nicht geladen:", err.message);
  return null;
});

// ---------------------------------------------------------------- Kassen-Demo
async function initPos() {
  const grid = $("#pos-grid");
  const catsEl = $("#pos-cats");
  const linesEl = $("#cart-lines");
  const emptyEl = $("#cart-empty");
  const sumsEl = $("#cart-sums");
  const totalEl = $("#cart-total");
  const countEl = $("#cart-count");
  const clearBtn = $("#cart-clear");
  const payCash = $("#pay-cash");
  const payCard = $("#pay-card");
  const dialog = $("#receipt");

  const data = await productsPromise;
  if (!data) {
    $("#pos-status").textContent = "Die Demo-Artikel konnten gerade nicht geladen werden. Bitte laden Sie die Seite neu.";
    return;
  }

  const items = new Map(
    data.items.map((i) => [i.id, { ...i, cents: Math.round(i.price * 100), depositCents: Math.round((i.deposit || 0) * 100) }]),
  );
  const cart = new Map(); // id -> Menge
  let category = "alle";
  let query = "";
  let billNo = 0;

  // Warengruppen
  data.categories.forEach((cat) =>
    catsEl.append(h("button", { class: "cat", type: "button", "data-cat": cat.id, "aria-pressed": String(cat.id === category), text: cat.name })),
  );
  catsEl.addEventListener("click", (e) => {
    const btn = e.target.closest(".cat");
    if (!btn) return;
    category = btn.dataset.cat;
    $$(".cat", catsEl).forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
    renderTiles();
  });
  $("#pos-search").addEventListener("input", (e) => {
    query = e.target.value;
    renderTiles();
  });

  // Artikelkacheln (werden nur bei Filterwechsel neu aufgebaut, damit der Fokus beim Antippen erhalten bleibt)
  function renderTiles() {
    const q = query.trim().toLowerCase();
    const list = [...items.values()].filter(
      (i) => (category === "alle" || i.category === category) && (!q || i.name.toLowerCase().includes(q)),
    );
    if (!list.length) {
      grid.replaceChildren(h("p", { class: "pos-status", text: "Kein Artikel gefunden." }));
      return;
    }
    grid.replaceChildren(
      ...list.map((i) =>
        h(
          "button",
          { class: "tile", type: "button", "data-id": i.id, "aria-label": `${i.name}, ${money(i.cents)}${i.depositCents ? " zuzüglich Pfand" : ""}, hinzufügen` },
          h("span", { class: "tile-icon", "aria-hidden": "true", text: i.icon }),
          h("span", { class: "tile-name", text: i.name }),
          h("span", { class: "tile-price", text: money(i.cents) }),
        ),
      ),
    );
    updateBadges();
  }

  function updateBadges() {
    for (const tile of $$(".tile", grid)) {
      const qty = cart.get(tile.dataset.id) || 0;
      let badge = $(".tile-qty", tile);
      if (!qty) badge?.remove();
      else if (!badge) tile.prepend(h("span", { class: "tile-qty", text: qty }));
      else badge.textContent = qty;
    }
  }

  grid.addEventListener("click", (e) => {
    const tile = e.target.closest(".tile");
    if (tile) change(tile.dataset.id, 1);
  });
  linesEl.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-action]");
    if (btn) change(btn.dataset.id, btn.dataset.action === "inc" ? 1 : -1);
  });

  function change(id, delta) {
    const qty = (cart.get(id) || 0) + delta;
    if (qty <= 0) cart.delete(id);
    else cart.set(id, Math.min(qty, 99));
    renderCart(`${delta > 0 ? "inc" : "dec"}:${id}`);
    updateBadges();
  }

  function totals() {
    let gross = 0;
    let deposit = 0;
    const byRate = new Map();
    for (const [id, qty] of cart) {
      const item = items.get(id);
      gross += item.cents * qty;
      deposit += item.depositCents * qty;
      byRate.set(item.vat, (byRate.get(item.vat) || 0) + item.cents * qty);
    }
    const vat = [...byRate]
      .sort((a, b) => a[0] - b[0])
      .map(([rate, base]) => ({ rate, base, amount: Math.round((base * rate) / (100 + rate)) }));
    return { gross, deposit, total: gross + deposit, vat };
  }

  function renderCart(focusKey) {
    const t = totals();
    const has = cart.size > 0;

    linesEl.replaceChildren(
      ...[...cart].map(([id, qty]) => {
        const item = items.get(id);
        const meta = `${qty} × ${money(item.cents)}` + (item.depositCents ? ` · Pfand ${money(item.depositCents * qty)}` : "");
        return h(
          "li",
          { class: "line" },
          h("span", { class: "line-name", text: item.name }),
          h("span", { class: "line-sum", text: money(item.cents * qty) }),
          h("span", { class: "line-meta", text: meta }),
          h(
            "span",
            { class: "stepper" },
            h("button", { type: "button", "data-action": "dec", "data-id": id, "aria-label": `Menge verringern: ${item.name}`, text: "−" }),
            h("output", { "aria-label": `Menge ${qty}`, text: qty }),
            h("button", { type: "button", "data-action": "inc", "data-id": id, "aria-label": `Menge erhöhen: ${item.name}`, text: "+" }),
          ),
        );
      }),
    );

    emptyEl.hidden = has;
    sumsEl.hidden = !has;
    clearBtn.hidden = !has;
    payCash.disabled = payCard.disabled = !has;
    countEl.textContent = `${cart.size} Pos.`;
    totalEl.textContent = money(t.total);
    sumsEl.replaceChildren(
      ...t.vat.map((v) => h("div", {}, h("dt", { text: `inkl. ${v.rate} % MwSt.` }), h("dd", { text: money(v.amount) }))),
      ...(t.deposit ? [h("div", {}, h("dt", { text: "Pfand" }), h("dd", { text: money(t.deposit) }))] : []),
    );

    // Fokus nach dem Neuaufbau zurückholen (Tastatur- und Screenreader-Nutzung)
    if (focusKey) {
      const [action, id] = focusKey.split(":");
      (linesEl.querySelector(`button[data-action="${action}"][data-id="${id}"]`) || linesEl.querySelector("button"))?.focus({ preventScroll: true });
    }
  }

  clearBtn.addEventListener("click", () => {
    cart.clear();
    renderCart();
    updateBadges();
  });

  // Bezahlen -> Bon
  const date = () => new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date());
  const row = (left, right, cls = "") => h("div", { class: `rc-row ${cls}`.trim() }, h("span", { text: left }), h("span", { text: right }));

  function openReceipt(method) {
    const t = totals();
    billNo += 1;

    let payment;
    if (method === "cash") {
      const bills = [5, 10, 20, 50, 100];
      const given = (bills.find((b) => b * 100 >= t.total) ?? Math.ceil(t.total / 5000) * 50) * 100;
      payment = [row("Bar gegeben", money(given)), row("Rückgeld", money(given - t.total))];
    } else {
      payment = [row("Karte (kontaktlos)", money(t.total))];
    }

    $("#receipt-body").replaceChildren(
      h("div", { class: "rc-head" }, h("strong", { id: "receipt-title", text: "D-GROUP DEMO-MARKT" }), h("small", { text: "Beispielbeleg – kein echter Kassenbon" })),
      h("hr", { class: "rc-sep" }),
      ...[...cart].flatMap(([id, qty]) => {
        const item = items.get(id);
        const lines = [row(`${qty}× ${item.name}`, money(item.cents * qty))];
        if (item.depositCents) lines.push(row("Pfand", money(item.depositCents * qty), "rc-sub"));
        return lines;
      }),
      h("hr", { class: "rc-sep" }),
      row("SUMME", money(t.total), "rc-total"),
      ...t.vat.map((v) => row(`inkl. ${v.rate} % MwSt.`, money(v.amount), "rc-sub")),
      h("hr", { class: "rc-sep" }),
      ...payment,
      h("hr", { class: "rc-sep" }),
      h("p", { class: "rc-note", text: "In der echten Kasse sichert die Cloud-TSE jeden Verkauf ab." }),
      h("p", { class: "rc-foot", text: `Bon-Nr. ${String(billNo).padStart(4, "0")} · ${date()}` }),
      h("p", { class: "rc-foot", text: "Vielen Dank für Ihren Einkauf!" }),
    );
    dialog.showModal();
  }

  payCash.addEventListener("click", () => openReceipt("cash"));
  payCard.addEventListener("click", () => openReceipt("card"));
  $("#receipt-new").addEventListener("click", () => dialog.close());
  $("#receipt-cta").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (e) => e.target === dialog && dialog.close());
  dialog.addEventListener("close", () => {
    cart.clear();
    renderCart();
    updateBadges();
  });

  renderTiles();
  renderCart();
}

// ---------------------------------------------------------------- PDA-Demo
async function initPda() {
  const btn = $("#pda-btn");
  const label = $("#pda-btn-label");
  const menu = $("#pda-menu");
  const scan = $("#pda-scan");
  const finder = $("#pda-viewfinder");
  const result = $("#pda-result");

  const data = await productsPromise;
  const list = data?.items?.length ? data.items : FALLBACK_ITEMS;
  let index = Math.floor(Math.random() * list.length);
  let busy = false;

  // Stabile Beispieldaten pro Artikel, damit derselbe Artikel immer dieselbe EAN und denselben Bestand zeigt
  const hash = (s) => [...s].reduce((acc, ch) => (Math.imul(acc, 31) + ch.charCodeAt(0)) >>> 0, 7);
  function fakeEan(id) {
    let seed = hash(id);
    const digits = Array.from({ length: 12 }, () => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0), (seed >>> 16) % 10));
    digits[0] = 4;
    digits[1] = 0;
    const check = (10 - (digits.reduce((sum, d, i) => sum + d * (i % 2 ? 3 : 1), 0) % 10)) % 10;
    return [...digits, check].join("");
  }

  btn.addEventListener("click", async () => {
    if (busy) return;
    busy = true;
    btn.disabled = true;
    label.textContent = "Scannt …";
    menu.hidden = true;
    scan.hidden = false;
    finder.classList.add("is-scanning");
    result.replaceChildren(h("p", { class: "scan-hint", text: "Barcode wird gelesen …" }));

    await sleep(REDUCED_MOTION ? 250 : 1300);

    const item = list[index % list.length];
    index += 1;
    finder.classList.remove("is-scanning");
    result.replaceChildren(
      h(
        "div",
        { class: "result-card" },
        h("div", { class: "result-name" }, h("span", { class: "emoji", "aria-hidden": "true", text: item.icon }), item.name),
        h("div", { class: "result-ean", text: `EAN ${fakeEan(item.id)}` }),
        h("div", { class: "result-stock" }, h("span", { text: "Bestand im Lager" }), h("strong", { text: `${3 + (hash(item.id) % 46)} Stk.` })),
      ),
    );
    label.textContent = "Nächsten Artikel scannen";
    btn.disabled = false;
    busy = false;
  });
}

// ---------------------------------------------------------------- Kontaktformular
function initContact() {
  const form = $("#contact-form");
  const success = $("#form-success");
  const statusEl = $("#form-status");
  const submit = $("#form-submit");
  const interest = $("#f-interest");
  const fields = { name: $("#f-name"), contact: $("#f-contact"), consent: $("#f-consent") };

  // Paket-Buttons und ?produkt=… aus dem Link wählen das passende Interesse vor
  const fromText = (text) => {
    const t = String(text).toLowerCase();
    if (t.includes("komplett") || t.includes("set")) return "komplett";
    if (t.includes("pda")) return "kasse-pda";
    if (t.includes("kasse")) return "kasse";
    return null;
  };
  const preset = fromText(new URLSearchParams(location.search).get("produkt") || "");
  if (preset) interest.value = preset;
  $$("[data-interest]").forEach((a) => a.addEventListener("click", () => (interest.value = a.dataset.interest)));

  const setError = (key, message) => {
    const el = $(`#e-${key}`);
    if (el) el.textContent = message || "";
    fields[key]?.setAttribute("aria-invalid", message ? "true" : "false");
  };
  const clearErrors = () => {
    Object.keys(fields).forEach((k) => setError(k, ""));
    statusEl.textContent = "";
    statusEl.classList.remove("is-error");
  };

  function validate(d) {
    const errors = {};
    if (d.name.trim().length < 2) errors.name = "Bitte geben Sie Ihren Namen an.";
    const c = d.contact.trim();
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(c);
    const isPhone = /^\+?[\d\s()\-./]{6,25}$/.test(c) && c.replace(/\D/g, "").length >= 6;
    if (!isEmail && !isPhone) errors.contact = "Bitte geben Sie eine gültige E-Mail-Adresse oder Telefonnummer an.";
    if (!d.consent) errors.consent = "Bitte stimmen Sie der Verarbeitung Ihrer Angaben zu.";
    return errors;
  }

  function showErrors(errors) {
    Object.entries(errors).forEach(([key, message]) => setError(key, message));
    fields[Object.keys(errors).find((k) => fields[k])]?.focus();
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearErrors();
    // FormData statt form.name: Letzteres wäre das name-Attribut des Formulars, nicht das Eingabefeld.
    const fd = new FormData(form);
    const payload = {
      name: fd.get("name") || "",
      contact: fd.get("contact") || "",
      shopType: fd.get("shopType") || "",
      interest: fd.get("interest") || "",
      message: fd.get("message") || "",
      website: fd.get("website") || "",
      consent: fd.get("consent") === "on",
    };

    const errors = validate(payload);
    if (Object.keys(errors).length) return showErrors(errors);

    submit.disabled = true;
    statusEl.textContent = "Wird gesendet …";
    try {
      await api("/api/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      statusEl.textContent = "";
      form.hidden = true;
      success.hidden = false;
      success.focus();
    } catch (err) {
      if (err.status === 400 && err.body?.errors) {
        statusEl.textContent = "";
        showErrors(err.body.errors);
      } else {
        const mail = siteInfo?.contact?.email;
        statusEl.textContent =
          err.status === 429
            ? err.message
            : `Das Senden hat leider nicht geklappt. Bitte versuchen Sie es später erneut${mail ? ` oder schreiben Sie uns an ${mail}` : ""}.`;
        statusEl.classList.add("is-error");
      }
    } finally {
      submit.disabled = false;
    }
  });

  $("#form-reset").addEventListener("click", () => {
    form.reset();
    clearErrors();
    success.hidden = true;
    form.hidden = false;
    fields.name.focus();
  });
}

// ---------------------------------------------------------------- Start
initHeader();
initReveal();
initStickyCta();
initSite();
initPos();
initPda();
initContact();
