// Positionstabelle für Belege (Verkauf und Einkauf): Artikelsuche, Mengen, Preise, Rabatt, Steuersatz, laufende Summen.
import { api, qs } from '../api.js';
import { h, btn, icon, combo, eur, parseMoney, parseNum, moneyText, lineNet, calcTotals } from '../ui.js';

const TAX = [[19, '19 %'], [7, '7 %'], [0, '0 %']];

export function linesEditor(initial, { priceKey = 'price_cents', defaultDiscount = () => 0, searchPath = '/products', costMode = false }) {
  const tbody = h('tbody');
  const totalsBox = h('div', { class: 'totals' });
  const rows = new Set();
  const getLines = (strict) => {
    const out = [];
    for (const r of rows) {
      const g = r.read();
      if (!g.description && !g.product_id && g.priceText === '') continue;
      if (!g.description) { if (strict) throw new Error('Jede Position braucht eine Beschreibung'); continue; }
      const qty = parseNum(g.qtyText);
      if (qty === null || qty <= 0) { if (strict) throw new Error(`Menge ungültig bei „${g.description}“`); continue; }
      const price = g.priceText === '' ? 0 : parseMoney(g.priceText);
      if (price === null || price < 0) { if (strict) throw new Error(`Preis ungültig bei „${g.description}“`); continue; }
      const disc = g.discText === '' ? 0 : parseNum(g.discText);
      if (disc === null || disc < 0 || disc > 100) { if (strict) throw new Error(`Rabatt ungültig bei „${g.description}“`); continue; }
      out.push({ product_id: g.product_id || 0, description: g.description, qty, unit: g.unit || 'Stk', [priceKey]: price, discount_pct: disc, tax_rate: Number(g.tax), net_cents: lineNet(qty, price, disc) });
    }
    return out;
  };
  const update = () => {
    const t = calcTotals(getLines(false));
    totalsBox.replaceChildren(
      h('div', null, h('span', null, 'Netto'), h('strong', null, eur(t.net_cents))),
      ...t.byRate.map((g) => h('div', null, h('span', null, `MwSt ${g.rate} % auf ${eur(g.net_cents)}`), h('span', null, eur(g.tax_cents)))),
      h('div', { class: 'grand' }, h('span', null, 'Brutto'), h('strong', null, eur(t.gross_cents))));
  };
  const addRow = (data = {}) => {
    let productId = data.product_id || 0;
    const desc = h('input', { type: 'text', value: data.description || '', maxlength: 500, 'aria-label': 'Beschreibung', placeholder: 'Beschreibung' });
    const qty = h('input', { type: 'text', inputmode: 'decimal', class: 'narrow', value: data.qty ?? 1, 'aria-label': 'Menge' });
    const unit = h('input', { type: 'text', class: 'narrow', value: data.unit || 'Stk', maxlength: 12, 'aria-label': 'Einheit' });
    const price = h('input', { type: 'text', inputmode: 'decimal', class: 'narrow', value: data[priceKey] === undefined ? '' : moneyText(data[priceKey]), 'aria-label': 'Preis' });
    const disc = h('input', { type: 'text', inputmode: 'decimal', class: 'narrow', value: data.discount_pct ? String(data.discount_pct).replace('.', ',') : '', 'aria-label': 'Rabatt in Prozent', placeholder: '0' });
    const tax = h('select', { class: 'narrow', 'aria-label': 'Steuersatz' }, TAX.map(([v, l]) => h('option', { value: v, selected: Number(data.tax_rate ?? 19) === v }, l)));
    const net = h('span', { class: 'net' });
    const pick = combo({ placeholder: 'Artikel suchen …', value: data.sku || '', search: (q) => api.get(`${searchPath}${qs({ q, active: 1, limit: 8 })}`).then((r) => r.rows), label: (p) => h('span', null, h('strong', null, p.sku), ` ${p.name} `, h('small', { class: 'muted' }, costMode ? eur(p.cost_cents) : eur(p.price_cents))),
      onPick: (p) => { productId = p.id; pick.setValue(p.sku); desc.value = p.name; unit.value = p.unit; price.value = moneyText(costMode ? p.cost_cents : p.price_cents); tax.value = String(p.tax_rate); if (!costMode && !disc.value && defaultDiscount()) disc.value = String(defaultDiscount()).replace('.', ','); recalc(); } });
    pick.input.addEventListener('input', () => { if (!pick.input.value) productId = 0; });
    const recalc = () => { const q = parseNum(qty.value), p = price.value.trim() === '' ? 0 : parseMoney(price.value), d = disc.value.trim() === '' ? 0 : parseNum(disc.value); net.textContent = q !== null && p !== null && d !== null ? eur(lineNet(q, p, d)) : '–'; update(); };
    const tr = h('tr', null, h('td', { 'data-label': 'Artikel' }, pick.el), h('td', { 'data-label': 'Beschreibung' }, desc), h('td', { 'data-label': 'Menge' }, qty), h('td', { 'data-label': 'Einheit' }, unit), h('td', { 'data-label': costMode ? 'Einkaufspreis €' : 'Preis € (netto)' }, price), costMode ? null : h('td', { 'data-label': 'Rabatt %' }, disc), h('td', { 'data-label': 'MwSt' }, tax), h('td', { class: 'num', 'data-label': 'Netto' }, net),
      h('td', null, h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Position entfernen', onclick: () => { rows.delete(row); tr.remove(); update(); } }, icon('trash', 16))));
    const row = { read: () => ({ product_id: productId, description: desc.value.trim(), qtyText: qty.value, unit: unit.value.trim(), priceText: price.value.trim(), discText: disc.value.trim(), tax: tax.value }) };
    for (const el of [desc, qty, unit, price, disc, tax]) el.addEventListener('input', recalc);
    tax.addEventListener('change', recalc);
    rows.add(row);
    tbody.append(tr);
    recalc();
    return desc;
  };
  const head = h('tr', null, ['Artikel', 'Beschreibung', 'Menge', 'Einheit', costMode ? 'Einkaufspreis €' : 'Preis € (netto)', costMode ? null : 'Rabatt %', 'MwSt', 'Netto', ''].map((t) => (t === null ? null : h('th', { class: t === 'Netto' ? 'num' : '' }, t))));
  (initial.length ? initial : [{}]).forEach((l) => addRow(l));
  const el = h('div', { class: 'lines-editor' }, h('div', { class: 'table-wrap' }, h('table', { class: 'data lines' }, h('thead', null, head), tbody)),
    h('div', { class: 'lines-foot' }, btn('Position hinzufügen', () => addRow({ tax_rate: 19 }).focus(), 'small', 'plus'), totalsBox));
  return { el, get: () => getLines(true), update };
}
