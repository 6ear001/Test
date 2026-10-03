// Kleine Oberflächen-Bausteine ohne Framework. Inhalte werden nie als HTML eingefügt (immer Textknoten),
// damit Daten aus der Datenbank keinen Code einschleusen können.
import { ApiError } from './api.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Erzeugt ein Element: h('div', {class: 'x', onclick: fn}, 'Text', [weitere], null) */
export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v === null || v === undefined) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k === 'value') el.value = v;
    else if (k === 'checked' || k === 'selected' || k === 'disabled' || k === 'readOnly') el[k] = !!v;
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  append(el, children);
  return el;
}
export function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}
export const clear = (el) => { el.replaceChildren(); return el; };

// ---------- Symbole ----------
const ICONS = {
  home: 'M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10',
  users: 'M16 11a4 4 0 10-8 0 4 4 0 008 0zM4 21c0-4 3.6-6 8-6s8 2 8 6',
  doc: 'M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6',
  cart: 'M3 4h2l2.5 11h10L20 7H6.5M9 20a1 1 0 100-2 1 1 0 000 2zM17 20a1 1 0 100-2 1 1 0 000 2z',
  box: 'M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10',
  truck: 'M2 6h11v10H2zM13 9h4l3 3v4h-7M6 19a2 2 0 100-4 2 2 0 000 4zM17 19a2 2 0 100-4 2 2 0 000 4z',
  book: 'M5 4h12a2 2 0 012 2v14H7a2 2 0 01-2-2zM5 18a2 2 0 012-2h12M9 8h6',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  gear: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19 12l2-1-2-4-2 1a7 7 0 00-2-1l-.5-2h-4L10 7a7 7 0 00-2 1L6 7 4 11l2 1a7 7 0 000 2l-2 1 2 4 2-1a7 7 0 002 1l.5 2h4l.5-2a7 7 0 002-1l2 1 2-4-2-1a7 7 0 000-2z',
  plus: 'M12 5v14M5 12h14',
  search: 'M11 18a7 7 0 100-14 7 7 0 000 14zM21 21l-5-5',
  print: 'M7 9V3h10v6M7 17H4v-6h16v6h-3M7 14h10v7H7z',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
  check: 'M5 12.5l4.5 4.5L19 7',
  x: 'M6 6l12 12M18 6L6 18',
  menu: 'M4 7h16M4 12h16M4 17h16',
  euro: 'M18 6a7 7 0 100 12M4 10h9M4 14h9',
  warn: 'M12 4l10 17H2zM12 10v5M12 18v.5',
  logout: 'M10 4H5v16h5M15 8l4 4-4 4M19 12H9',
  download: 'M12 4v11M7 11l5 5 5-5M5 20h14',
  back: 'M15 5l-7 7 7 7',
};
export function icon(name, size = 18) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.8');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', ICONS[name] || ICONS.doc);
  svg.append(path);
  return svg;
}

// ---------- Formate ----------
const eurFmt = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
const numFmt = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 3 });
export const eur = (cents) => eurFmt.format((Number(cents) || 0) / 100);
export const num = (n) => numFmt.format(Number(n) || 0);
export const pct = (n) => `${numFmt.format(Number(n) || 0)} %`;
export function dateDE(d) {
  if (!d) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : String(d);
}
export const dateTimeDE = (d) => (d ? `${dateDE(d)} ${String(d).slice(11, 16)}` : '');
export const todayISO = () => new Date().toISOString().slice(0, 10);
export const addDaysISO = (iso, n) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

/** "1.234,56" → 123456 (Cent); ungültig → null */
export function parseMoney(s) {
  if (typeof s === 'number') return Math.round(s * 100);
  const t = String(s ?? '').trim().replace(/\s|€/g, '');
  if (t === '') return null;
  if (!/^-?\d{1,3}(\.\d{3})*(,\d+)?$|^-?\d+([.,]\d+)?$/.test(t)) return null;
  const normalized = /,/.test(t) ? t.replace(/\./g, '').replace(',', '.') : t;
  const n = Number(normalized);
  return Number.isFinite(n) ? Math.round(n * 100 + (n >= 0 ? 1e-7 : -1e-7)) : null;
}
export const moneyText = (cents) => (cents === null || cents === undefined ? '' : (cents / 100).toFixed(2).replace('.', ','));
export function parseNum(s) {
  const t = String(s ?? '').trim().replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
export const roundC = (x) => Math.sign(x) * Math.round(Math.abs(x) + 1e-9);
export const lineNet = (qty, priceCents, disc = 0) => roundC(qty * priceCents * (1 - disc / 100));
/** Summen wie auf dem Server: Steuer je Steuersatz auf die Netto-Summe. */
export function calcTotals(lines) {
  const groups = new Map();
  let net = 0;
  for (const l of lines) { net += l.net_cents; groups.set(l.tax_rate, (groups.get(l.tax_rate) || 0) + l.net_cents); }
  const byRate = [...groups].sort((a, b) => b[0] - a[0]).map(([rate, n]) => ({ rate, net_cents: n, tax_cents: roundC((n * rate) / 100) }));
  const tax = byRate.reduce((s, g) => s + g.tax_cents, 0);
  return { net_cents: net, tax_cents: tax, gross_cents: net + tax, byRate };
}

// ---------- Status ----------
const STATUS = {
  quote: { draft: ['Entwurf', 'gray'], sent: ['Gesendet', 'blue'], accepted: ['Angenommen', 'green'], rejected: ['Abgelehnt', 'red'], converted: ['In Auftrag übernommen', 'gray'] },
  order: { open: ['Offen', 'blue'], partial: ['Teilweise', 'amber'], delivered: ['Geliefert', 'amber'], completed: ['Abgeschlossen', 'green'], cancelled: ['Storniert', 'gray'] },
  delivery: { delivered: ['Geliefert', 'green'], cancelled: ['Storniert', 'gray'] },
  invoice: { draft: ['Entwurf', 'gray'], open: ['Offen', 'blue'], partial: ['Teilweise bezahlt', 'amber'], paid: ['Bezahlt', 'green'], cancelled: ['Gutgeschrieben', 'gray'] },
  credit_note: { issued: ['Ausgestellt', 'green'] },
  purchase_order: { draft: ['Entwurf', 'gray'], ordered: ['Bestellt', 'blue'], partial: ['Teilweise geliefert', 'amber'], received: ['Geliefert', 'amber'], completed: ['Abgeschlossen', 'green'], cancelled: ['Storniert', 'gray'] },
  supplier_invoice: { open: ['Offen', 'blue'], partial: ['Teilweise bezahlt', 'amber'], paid: ['Bezahlt', 'green'], cancelled: ['Storniert', 'gray'] },
  shipment: { planned: ['Geplant', 'gray'], packed: ['Gepackt', 'blue'], shipped: ['Versendet', 'blue'], in_transit: ['Unterwegs', 'blue'], delivered: ['Zugestellt', 'green'], problem: ['Problem', 'red'], cancelled: ['Storniert', 'gray'] },
  customer: { lead: ['Interessent', 'amber'], customer: ['Kunde', 'green'], inactive: ['Inaktiv', 'gray'] },
  supplier: { active: ['Aktiv', 'green'], inactive: ['Inaktiv', 'gray'] },
  inventory: { open: ['Läuft', 'blue'], done: ['Abgeschlossen', 'green'] },
};
export const statusLabel = (type, s) => STATUS[type]?.[s]?.[0] ?? s;
export const statusOptions = (type) => Object.entries(STATUS[type] || {}).map(([k, v]) => [k, v[0]]);
export function badge(type, status) {
  const [label, tone] = STATUS[type]?.[status] ?? [status, 'gray'];
  return h('span', { class: `badge ${tone}` }, label);
}
export const DOC_TYPES = { quote: 'Angebot', order: 'Auftragsbestätigung', delivery: 'Lieferschein', invoice: 'Rechnung', credit_note: 'Gutschrift', purchase_order: 'Bestellung' };
export const KIND_OF_TYPE = { quote: 'quotes', order: 'orders', delivery: 'deliveries', invoice: 'invoices', credit_note: 'credit-notes' };

// ---------- Meldungen ----------
let toastHost;
export function toast(message, kind = 'ok') {
  if (!toastHost) { toastHost = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' }); document.body.append(toastHost); }
  const t = h('div', { class: `toast ${kind}` }, message);
  toastHost.append(t);
  while (toastHost.children.length > 3) toastHost.firstChild.remove();
  setTimeout(() => t.remove(), kind === 'error' ? 7000 : 3500);
}
export const errMsg = (e) => (e instanceof ApiError ? e.message : 'Unerwarteter Fehler. Bitte erneut versuchen.');
export async function guard(fn) {
  try { return await fn(); } catch (e) { toast(errMsg(e), 'error'); return undefined; }
}

/** Wählt zur Zahlungsart das passende Konto vor (Bar → Kasse, sonst Bank). */
export const defaultAccount = (accounts, method) => (accounts.find((a) => a.kind === (method === 'cash' ? 'cash' : 'bank')) || accounts[0])?.id;
export function followMethod(f, accounts) {
  f.input('method')?.addEventListener('change', (e) => { const id = defaultAccount(accounts, e.target.value); if (id) f.set('account_id', id); });
}

// ---------- Dialoge ----------
export function dialog({ title, body, actions = [], wide = false, onClose }) {
  const dlg = h('dialog', { class: `dlg${wide ? ' wide' : ''}`, 'aria-label': title });
  const close = () => { dlg.close(); dlg.remove(); onClose?.(); };
  dlg.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
  dlg.addEventListener('click', (e) => { if (e.target === dlg) close(); });
  append(dlg, [
    h('header', { class: 'dlg-head' }, h('h2', null, title), h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Schließen', onclick: close }, icon('x'))),
    h('div', { class: 'dlg-body' }, body),
    actions.length ? h('footer', { class: 'dlg-foot' }, actions) : null,
  ]);
  document.body.append(dlg);
  dlg.showModal();
  dlg.querySelector('input:not([type=hidden]), select, textarea')?.focus();
  return { el: dlg, close };
}
export function confirmDialog({ title, message, confirmLabel = 'OK', danger = false }) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (!done) { done = true; resolve(v); } };
    const d = dialog({
      title, onClose: () => finish(false),
      body: h('p', null, message),
      actions: [
        h('button', { class: 'btn', type: 'button', onclick: () => { finish(false); d.close(); } }, 'Abbrechen'),
        h('button', { class: `btn ${danger ? 'danger' : 'primary'}`, type: 'button', onclick: () => { finish(true); d.close(); } }, confirmLabel),
      ],
    });
  });
}

// ---------- Formulare ----------
/**
 * Felder: { name, label, type: text|email|tel|number|money|date|select|textarea|checkbox|combo, options, required, help, wide, placeholder, maxlength, step, min }
 * Rückgabe: { el, get(), set(name, value), input(name) }. Geldfelder liefern Cent, Zahlenfelder Zahlen.
 */
export function form(fields, values = {}) {
  const inputs = {};
  const grid = h('div', { class: 'form-grid' });
  for (const f of fields) {
    if (f.type === 'heading') { grid.append(h('h3', { class: 'form-heading wide' }, f.label)); continue; }
    const id = `f_${f.name}_${Math.random().toString(36).slice(2, 7)}`;
    const v = values[f.name];
    let input;
    if (f.type === 'select') {
      input = h('select', { id, name: f.name }, (f.options || []).map(([val, label]) => h('option', { value: val, selected: String(v ?? '') === String(val) }, label)));
    } else if (f.type === 'textarea') {
      input = h('textarea', { id, name: f.name, rows: f.rows || 3, maxlength: f.maxlength, placeholder: f.placeholder }, v ?? '');
    } else if (f.type === 'checkbox') {
      input = h('input', { id, name: f.name, type: 'checkbox', checked: !!v });
    } else {
      const type = f.type === 'money' || f.type === 'number' ? 'text' : (f.type || 'text');
      const val = f.type === 'money' ? (v === null || v === undefined ? '' : moneyText(v)) : (v ?? '');
      input = h('input', { id, name: f.name, type, value: val, maxlength: f.maxlength, placeholder: f.placeholder, inputmode: f.type === 'money' || f.type === 'number' ? 'decimal' : undefined, autocomplete: 'off', required: f.required, min: f.min, max: f.max });
    }
    inputs[f.name] = { input, f };
    const label = f.type === 'checkbox'
      ? h('label', { class: 'check', for: id }, input, f.label)
      : h('label', { for: id }, f.label, f.required ? h('span', { class: 'req', 'aria-hidden': 'true' }, ' *') : null);
    grid.append(h('div', { class: `field${f.wide ? ' wide' : ''}${f.type === 'checkbox' ? ' is-check' : ''}` }, label, f.type === 'checkbox' ? null : input, f.help ? h('small', { class: 'help' }, f.help) : null));
  }
  return {
    el: grid,
    input: (name) => inputs[name]?.input,
    set(name, value) { const i = inputs[name]; if (!i) return; if (i.f.type === 'checkbox') i.input.checked = !!value; else i.input.value = i.f.type === 'money' ? moneyText(value) : (value ?? ''); },
    get() {
      const out = {};
      for (const [name, { input, f }] of Object.entries(inputs)) {
        if (f.type === 'checkbox') out[name] = input.checked;
        else if (f.type === 'money') {
          const raw = input.value.trim();
          if (raw === '') out[name] = f.required ? null : (f.empty ?? 0);
          else { const c = parseMoney(raw); if (c === null) throw new Error(`${f.label}: bitte einen gültigen Betrag eingeben (z. B. 12,50)`); out[name] = c; }
        } else if (f.type === 'number') {
          const raw = input.value.trim();
          if (raw === '') out[name] = f.empty ?? 0;
          else { const n = parseNum(raw); if (n === null) throw new Error(`${f.label}: bitte eine gültige Zahl eingeben`); out[name] = n; }
        } else out[name] = input.value.trim() === '' ? (f.type === 'select' ? '' : null) : input.value.trim();
        if (f.required && (out[name] === null || out[name] === '')) throw new Error(`${f.label} fehlt`);
      }
      return out;
    },
  };
}
/** Dialog mit Formular; onSubmit(values) darf Fehler werfen (werden im Dialog angezeigt). */
export function formDialog({ title, fields, values, submitLabel = 'Speichern', onSubmit, wide = false, intro, extra }) {
  const f = form(fields, values);
  const errBox = h('p', { class: 'form-error', role: 'alert', hidden: true });
  const submit = h('button', { class: 'btn primary', type: 'submit' }, submitLabel);
  const formEl = h('form', { novalidate: true, onsubmit: async (e) => {
    e.preventDefault();
    errBox.hidden = true;
    submit.disabled = true;
    try {
      await onSubmit(f.get());
      d.close();
    } catch (err) {
      errBox.textContent = err instanceof ApiError ? err.message : err.message || 'Fehler';
      errBox.hidden = false;
    } finally { submit.disabled = false; }
  } }, intro ? h('p', { class: 'muted' }, intro) : null, f.el, extra || null, errBox,
  h('div', { class: 'dlg-foot inline' }, h('button', { class: 'btn', type: 'button', onclick: () => d.close() }, 'Abbrechen'), submit));
  const d = dialog({ title, body: formEl, wide });
  return { dialog: d, form: f };
}

// ---------- Tabellen ----------
const csvCell = (v) => {
  let s = v === null || v === undefined ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // verhindert Formel-Ausführung in Tabellenprogrammen
  return `"${s.replace(/"/g, '""')}"`;
};
export function downloadCsv(filename, header, rows) {
  const text = '﻿' + [header, ...rows].map((r) => r.map(csvCell).join(';')).join('\r\n');
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const a = h('a', { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
/**
 * columns: [{ key, label, render?(row), csv?(row), align: 'right', sort?(row) }]
 * Rückgabe: Element (mit Tabellenkopf zum Sortieren). exportName zeigt einen CSV-Button.
 */
export function table({ columns, rows, onRow, empty = 'Keine Einträge', exportName, rowClass, foot }) {
  let data = rows.slice();
  let sortKey = null;
  let dir = 1;
  const tbody = h('tbody');
  const head = h('tr');
  const draw = () => {
    clear(tbody);
    if (!data.length) tbody.append(h('tr', null, h('td', { class: 'empty', colspan: columns.length }, empty)));
    for (const row of data) {
      const tr = h('tr', { class: [onRow ? 'click' : '', rowClass?.(row) || ''].join(' ').trim(), tabindex: onRow ? 0 : undefined });
      if (onRow) {
        tr.addEventListener('click', (e) => { if (!e.target.closest('a,button,input,select')) onRow(row); });
        tr.addEventListener('keydown', (e) => { if (e.key === 'Enter') onRow(row); });
      }
      for (const c of columns) {
        const content = c.render ? c.render(row) : (row[c.key] ?? '');
        const t = textOf(content);
        const short = typeof t === 'string' && /^\S{1,24}$/.test(t.trim()); // Nummern und kurze Einzelwörter nicht umbrechen
        tr.append(h('td', { class: [c.align === 'right' ? 'num' : (c.class || ''), short ? 'nowrap' : ''].join(' ').trim(), 'data-label': c.label }, content));
      }
      tbody.append(tr);
    }
  };
  for (const c of columns) {
    const sortable = c.sort || c.key;
    head.append(h('th', { class: c.align === 'right' ? 'num' : '', scope: 'col', 'aria-sort': 'none', onclick: sortable ? (e) => {
      const k = c.key || c.label;
      dir = sortKey === k ? -dir : 1;
      sortKey = k;
      const val = c.sort || ((r) => r[c.key]);
      data.sort((a, b) => { const x = val(a), y = val(b); return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x ?? '').localeCompare(String(y ?? ''), 'de', { numeric: true })) * dir; });
      for (const th of head.children) th.setAttribute('aria-sort', 'none');
      e.currentTarget.setAttribute('aria-sort', dir === 1 ? 'ascending' : 'descending');
      draw();
    } : undefined }, c.label));
  }
  draw();
  const tbl = h('table', { class: 'data' }, h('thead', null, head), tbody, foot ? h('tfoot', null, foot) : null);
  const wrap = h('div', { class: 'table-wrap' }, tbl);
  if (exportName) {
    const cell = (c, r) => (c.csv ? c.csv(r) : c.render ? textOf(c.render(r)) : r[c.key]);
    const exportCsv = () => downloadCsv(`${exportName}-${todayISO()}.csv`, columns.map((c) => c.label), data.map((r) => columns.map((c) => cell(c, r))));
    wrap.prepend(h('div', { class: 'table-tools no-print' }, h('button', { class: 'btn small', type: 'button', onclick: exportCsv }, icon('download', 16), 'CSV')));
  }
  return wrap;
}
const textOf = (v) => (v instanceof Node ? v.textContent : v);

// ---------- Seitenaufbau ----------
export function page({ title, subtitle, actions, back }, ...content) {
  return h('section', { class: 'page' },
    h('header', { class: 'page-head' },
      h('div', null, back ? h('a', { class: 'crumb', href: back[0] }, icon('back', 14), back[1]) : null, h('h1', null, title), subtitle ? h('p', { class: 'muted' }, subtitle) : null),
      h('div', { class: 'page-actions no-print' }, actions || [])),
    content);
}
export const card = (title, ...content) => h('section', { class: 'card' }, title ? h('h2', { class: 'card-title' }, title) : null, content);
export const kpi = (label, value, tone = '', href) => h(href ? 'a' : 'div', { class: `kpi ${tone}`, href }, h('span', { class: 'kpi-label' }, label), h('strong', { class: 'kpi-value' }, value));
export const btn = (label, onclick, cls = '', ic) => h('button', { class: `btn ${cls}`.trim(), type: 'button', onclick }, ic ? icon(ic, 16) : null, label);
export const link = (label, href, cls = '') => h('a', { class: cls, href }, label);
export const loading = () => h('div', { class: 'loading' }, 'Lädt …');
export const tabs = (items, active) => h('nav', { class: 'tabs', 'aria-label': 'Bereiche' }, items.map(([key, label, href]) => h('a', { class: key === active ? 'active' : '', href, 'aria-current': key === active ? 'page' : undefined }, label)));
export const kv = (pairs) => h('dl', { class: 'kv' }, pairs.filter(Boolean).map(([k, v]) => [h('dt', null, k), h('dd', null, v ?? '–')]));
export const lines = (text) => { const out = []; String(text ?? '').split('\n').forEach((l, i) => { if (i) out.push(h('br')); out.push(l); }); return out; };

/** Eingabefeld mit Vorschlagsliste (lädt Treffer vom Server beim Tippen). */
export function combo({ placeholder, search, label, onPick, value = '' }) {
  const input = h('input', { type: 'text', class: 'combo-input', placeholder, value, autocomplete: 'off', role: 'combobox', 'aria-expanded': 'false', 'aria-label': placeholder });
  const list = h('ul', { class: 'combo-list', role: 'listbox', hidden: true });
  const wrap = h('div', { class: 'combo' }, input, list);
  let timer;
  let seq = 0;
  const show = (items) => {
    clear(list);
    list.hidden = !items.length;
    input.setAttribute('aria-expanded', String(!!items.length));
    for (const it of items) list.append(h('li', { role: 'option', tabindex: -1, onmousedown: (e) => { e.preventDefault(); list.hidden = true; onPick(it); } }, label(it)));
  };
  input.addEventListener('input', () => {
    clearTimeout(timer);
    const mine = ++seq;
    timer = setTimeout(async () => { try { const items = await search(input.value.trim()); if (mine === seq) show(items.slice(0, 8)); } catch { /* ignorieren */ } }, 180);
  });
  input.addEventListener('focus', () => { if (!input.value) input.dispatchEvent(new Event('input')); });
  input.addEventListener('blur', () => setTimeout(() => { list.hidden = true; }, 120));
  input.addEventListener('keydown', (e) => { if (e.key === 'Escape') list.hidden = true; });
  return { el: wrap, input, setValue: (v) => { input.value = v; } };
}

/** Balkendiagramm als SVG (Monatsumsätze). */
export function barChart(series, { height = 180 } = {}) {
  const W = 640, pad = 26, max = Math.max(1, ...series.map((s) => s.cents));
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${height + 24}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Umsatz der letzten 12 Monate');
  svg.setAttribute('class', 'chart');
  const bw = (W - pad) / series.length;
  series.forEach((s, i) => {
    const hgt = Math.round((Math.max(s.cents, 0) / max) * (height - 10));
    const rect = document.createElementNS(SVG_NS, 'rect');
    rect.setAttribute('x', String(pad + i * bw + bw * 0.18));
    rect.setAttribute('y', String(height - hgt));
    rect.setAttribute('width', String(bw * 0.64));
    rect.setAttribute('height', String(Math.max(hgt, 1)));
    rect.setAttribute('rx', '3');
    rect.setAttribute('class', 'bar');
    const title = document.createElementNS(SVG_NS, 'title');
    title.textContent = `${s.month}: ${eur(s.cents)}`;
    rect.append(title);
    const t = document.createElementNS(SVG_NS, 'text');
    t.setAttribute('x', String(pad + i * bw + bw / 2));
    t.setAttribute('y', String(height + 16));
    t.setAttribute('text-anchor', 'middle');
    t.setAttribute('class', 'axis');
    t.textContent = s.month.slice(5) + '/' + s.month.slice(2, 4);
    svg.append(rect, t);
  });
  return svg;
}
