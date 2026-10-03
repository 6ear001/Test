// Einkauf: Bestellungen, Wareneingänge, Eingangsrechnungen, Nachbestell-Vorschläge.
import { api, qs } from '../api.js';
import { register, state, can, navigate } from '../core.js';
import { linesEditor } from './editor.js';
import { defaultAccount, followMethod, h, page, card, kpi, table, badge, btn, kv, lines as textLines, formDialog, form, dialog, confirmDialog, guard, toast, eur, num, dateDE, todayISO, addDaysISO, statusOptions, icon, combo, parseMoney, parseNum, moneyText, calcTotals, errMsg } from '../ui.js';

const METHODS = [['bank', 'Überweisung'], ['cash', 'Bar'], ['card', 'Karte'], ['paypal', 'PayPal'], ['other', 'Sonstige']];
const TAX = [[19, '19 %'], [7, '7 %'], [0, '0 %']];
const refresh = () => document.dispatchEvent(new Event('erp:refresh'));
const filters = (...els) => h('div', { class: 'filters' }, els);

// ---------- Bestellungen ----------
register('/purchasing/orders', async ({ query }) => {
  const wrap = h('div');
  const search = h('input', { type: 'search', class: 'search', placeholder: 'Nummer, Lieferant oder Referenz …', 'aria-label': 'Suchen' });
  const status = h('select', { 'aria-label': 'Status' }, [['', 'Alle Status'], ...statusOptions('purchase_order')].map(([v, l]) => h('option', { value: v }, l)));
  const load = async () => {
    const d = await api.get(`/purchasing/orders${qs({ q: search.value, status: status.value, supplier_id: query.supplier_id, limit: 500 })}`);
    wrap.replaceChildren(table({ rows: d.rows, exportName: 'bestellungen', empty: 'Keine Bestellungen gefunden.', onRow: (r) => navigate(`/purchasing/orders/${r.id}`), columns: [
      { label: 'Nr.', sort: (r) => r.number, render: (r) => h('a', { href: `#/purchasing/orders/${r.id}` }, r.number), csv: (r) => r.number }, { label: 'Lieferant', render: (r) => h('a', { href: `#/suppliers/${r.supplier_id}` }, r.supplier), csv: (r) => r.supplier },
      { label: 'Datum', sort: (r) => r.date, render: (r) => dateDE(r.date), csv: (r) => r.date }, { label: 'Liefertermin', render: (r) => dateDE(r.expected_date), csv: (r) => r.expected_date || '' },
      { label: 'Status', sort: (r) => r.status, render: (r) => badge('purchase_order', r.status), csv: (r) => r.status }, { label: 'Netto', align: 'right', sort: (r) => r.net_cents, render: (r) => eur(r.net_cents), csv: (r) => r.net_cents / 100 }, { label: 'Brutto', align: 'right', sort: (r) => r.gross_cents, render: (r) => eur(r.gross_cents), csv: (r) => r.gross_cents / 100 }] }));
  };
  let t;
  search.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => guard(load), 250); });
  status.addEventListener('change', () => guard(load));
  await load();
  return page({ title: 'Bestellungen', subtitle: 'Waren bei Lieferanten bestellen, Wareneingang buchen und Rechnungen zuordnen', actions: can('purchasing:w') ? [btn('Neue Bestellung', () => navigate('/purchasing/orders/new'), 'primary', 'plus')] : [] }, filters(search, status), wrap);
}, 'purchasing:r');

async function poEditor({ id, query }) {
  const existing = id ? await api.get(`/purchasing/orders/${id}`) : null;
  if (existing && existing.status !== 'draft') throw new Error('Nur Entwürfe können bearbeitet werden.');
  let supplier = existing?.supplier || null;
  const sid = Number(query.supplier) || 0;
  if (sid && !supplier) supplier = (await api.get(`/suppliers/${sid}`)).item;
  const whs = (await api.get('/warehouses')).rows.filter((w) => w.active);
  const f = form([{ name: 'date', label: 'Bestelldatum', type: 'date', required: true }, { name: 'expected_date', label: 'Gewünschter Liefertermin', type: 'date' }, { name: 'warehouse_id', label: 'Lieferung in Lager', type: 'select', options: whs.map((w) => [w.id, w.name]) }, { name: 'reference', label: 'Referenz', maxlength: 200 }, { name: 'notes', label: 'Bemerkung (erscheint auf der Bestellung)', type: 'textarea', wide: true, maxlength: 2000 }],
    { date: existing?.date || todayISO(), expected_date: existing?.expected_date || '', warehouse_id: existing?.warehouse_id || whs.find((w) => w.is_default)?.id || '', reference: existing?.reference || '', notes: existing?.notes || '' });
  const supBox = h('div', { class: 'customer-pick' });
  const showSup = () => supBox.replaceChildren(supplier
    ? h('div', { class: 'chosen' }, h('div', null, h('strong', null, supplier.name), h('small', { class: 'muted' }, ` Lieferanten-Nr. ${supplier.number || ''}`)), btn('Ändern', () => { supplier = null; showSup(); }, 'small'))
    : (() => { const c = combo({ placeholder: 'Lieferant suchen …', search: (q) => api.get(`/suppliers${qs({ q, limit: 8 })}`).then((r) => r.rows.filter((x) => x.status !== 'inactive')), label: (s) => h('span', null, h('strong', null, s.name), h('small', { class: 'muted' }, ` ${s.number} · ${s.city || ''}`)), onPick: async (s) => { supplier = (await api.get(`/suppliers/${s.id}`)).item; showSup(); } }); setTimeout(() => c.input.focus(), 0); return c.el; })());
  showSup();
  const ed = linesEditor(existing?.lines || [], { priceKey: 'cost_cents', costMode: true });
  const err = h('p', { class: 'form-error', role: 'alert', hidden: true });
  return page({ title: existing ? `Bestellung ${existing.number} bearbeiten` : 'Neue Bestellung', back: [existing ? `#/purchasing/orders/${id}` : '#/purchasing/orders', existing ? 'Zurück zur Bestellung' : 'Bestellungen'] },
    card('Lieferant', supBox), card('Details', f.el), card('Positionen', ed.el), err,
    h('div', { class: 'form-actions' }, btn('Abbrechen', () => history.back()), btn('Speichern', async (e) => {
      err.hidden = true; e.currentTarget.disabled = true;
      try {
        if (!supplier) throw new Error('Bitte einen Lieferanten wählen');
        const v = f.get();
        const body = { supplier_id: supplier.id, date: v.date, expected_date: v.expected_date || undefined, warehouse_id: Number(v.warehouse_id) || 0, reference: v.reference, notes: v.notes, lines: ed.get() };
        const r = existing ? (await api.put(`/purchasing/orders/${id}`, body), { id }) : await api.post('/purchasing/orders', body);
        toast('Bestellung gespeichert'); navigate(`/purchasing/orders/${r.id}`);
      } catch (ex) { err.textContent = ex.message || errMsg(ex); err.hidden = false; e.currentTarget.disabled = false; }
    }, 'primary')));
}
register('/purchasing/orders/new', ({ query }) => poEditor({ query }), 'purchasing:w');
register('/purchasing/orders/:id/edit', ({ params, query }) => poEditor({ id: params.id, query }), 'purchasing:w');

async function receiveDialog(po) {
  const whs = (await api.get('/warehouses')).rows.filter((w) => w.active);
  const open = po.lines.filter((l) => l.qty - l.qty_received > 1e-6);
  const wh = h('select', { 'aria-label': 'Lager' }, whs.map((w) => h('option', { value: w.id, selected: w.id === po.warehouse_id }, w.name)));
  const date = h('input', { type: 'date', value: todayISO(), 'aria-label': 'Datum' });
  const rows = open.map((l) => ({ l, qty: h('input', { type: 'text', inputmode: 'decimal', class: 'narrow', value: num(l.qty - l.qty_received).replace(/\./g, ''), 'aria-label': `Menge ${l.description}` }), cost: h('input', { type: 'text', inputmode: 'decimal', class: 'narrow', value: moneyText(l.cost_cents), 'aria-label': `Einkaufspreis ${l.description}` }) }));
  const note = h('input', { type: 'text', maxlength: 300, placeholder: 'Notiz, z. B. Lieferschein-Nr. des Lieferanten', 'aria-label': 'Notiz' });
  const err = h('p', { class: 'form-error', role: 'alert', hidden: true });
  const body = h('div', null, h('p', { class: 'muted' }, 'Tragen Sie ein, was tatsächlich angekommen ist. Der Bestand erhöht sich, der Durchschnitts-Einkaufspreis wird neu berechnet.'),
    h('div', { class: 'form-grid' }, h('div', { class: 'field' }, h('label', null, 'Lager'), wh), h('div', { class: 'field' }, h('label', null, 'Datum'), date)),
    table({ rows, columns: [{ label: 'Artikel', render: (r) => r.l.description }, { label: 'Offen', align: 'right', render: (r) => `${num(r.l.qty - r.l.qty_received)} ${r.l.unit}` }, { label: 'Angekommen', align: 'right', render: (r) => r.qty }, { label: 'Einkaufspreis €', align: 'right', render: (r) => r.cost }] }), h('div', { class: 'stack' }, note), err);
  const d = dialog({ title: `Wareneingang · ${po.number}`, body, wide: true, actions: [btn('Abbrechen', () => d.close()), btn('Wareneingang buchen', async (e) => {
    err.hidden = true; e.currentTarget.disabled = true;
    try {
      const lines = rows.map((r) => ({ line_id: r.l.id, qty: parseNum(r.qty.value) || 0, cost_cents: parseMoney(r.cost.value) ?? r.l.cost_cents })).filter((x) => x.qty > 0);
      if (!lines.length) throw new Error('Bitte mindestens eine Menge eintragen');
      const r = await api.post(`/purchasing/orders/${po.id}/receive`, { warehouse_id: Number(wh.value), date: date.value, note: note.value.trim() || undefined, lines });
      d.close(); toast(`Wareneingang ${r.number} gebucht`); refresh();
    } catch (ex) { err.textContent = ex.message || errMsg(ex); err.hidden = false; e.currentTarget.disabled = false; }
  }, 'primary')] });
}

register('/purchasing/orders/:id', async ({ params }) => {
  const d = await api.get(`/purchasing/orders/${params.id}`);
  const W = can('purchasing:w');
  const a = [];
  const doit = (path, msg) => guard(async () => { await api.post(path, {}); toast(msg); refresh(); });
  if (d.status === 'draft' && W) a.push(btn('Bearbeiten', () => navigate(`/purchasing/orders/${d.id}/edit`), '', 'edit'), btn('Bestellen', () => doit(`/purchasing/orders/${d.id}/order`, 'Bestellung aufgegeben'), 'primary', 'check'),
    btn('Löschen', async () => { if (await confirmDialog({ title: 'Entwurf löschen?', message: d.number, confirmLabel: 'Löschen', danger: true })) guard(async () => { await api.del(`/purchasing/orders/${d.id}`); navigate('/purchasing/orders'); }); }, 'danger', 'trash'));
  if (['ordered', 'partial'].includes(d.status)) {
    if (can('stock:w')) a.push(btn('Wareneingang buchen', () => guard(() => receiveDialog(d)), 'primary', 'box'));
    if (can('logistics:w')) a.push(btn('Sendung erwarten', async () => { const carriers = (await api.get('/logistics/carriers')).rows.filter((c) => c.active); formDialog({ title: 'Eingehende Sendung', fields: [{ name: 'carrier_id', label: 'Frachtführer', type: 'select', options: [['', '– unbekannt –'], ...carriers.map((c) => [c.id, c.name])] }, { name: 'tracking_no', label: 'Sendungsnummer', maxlength: 80 }, { name: 'eta', label: 'Voraussichtliche Ankunft', type: 'date' }], onSubmit: async (v) => { const r = await api.post('/logistics/shipments', { direction: 'inbound', po_id: d.id, carrier_id: v.carrier_id ? Number(v.carrier_id) : 0, tracking_no: v.tracking_no || undefined, eta: v.eta || undefined }); navigate(`/logistics/shipments/${r.id}`); } }); }, '', 'truck'));
  }
  if (['ordered', 'partial', 'received'].includes(d.status) && W) a.push(btn('Eingangsrechnung erfassen', () => navigate(`/purchasing/invoices/new?po=${d.id}`), d.status === 'received' ? 'primary' : '', 'euro'));
  if (W && ['ordered', 'partial', 'draft'].includes(d.status) && !d.receipts.length && !d.invoices.some((i) => i.status !== 'cancelled') && d.status !== 'draft') a.push(btn('Stornieren', async () => { if (await confirmDialog({ title: 'Bestellung stornieren?', message: d.number, confirmLabel: 'Stornieren', danger: true })) doit(`/purchasing/orders/${d.id}/cancel`, 'Bestellung storniert'); }, 'danger'));
  a.push(btn('Drucken / PDF', () => navigate(`/print/purchasing/orders/${d.id}`), '', 'print'));
  return page({ title: `Bestellung ${d.number}`, subtitle: `${d.supplier.name} · ${dateDE(d.date)}`, back: ['#/purchasing/orders', 'Bestellungen'], actions: a },
    h('p', null, badge('purchase_order', d.status)),
    h('div', { class: 'grid-2' }, card('Bestellung', kv([['Lieferant', h('a', { href: `#/suppliers/${d.supplier.id}` }, `${d.supplier.name} (${d.supplier.number})`)], ['Datum', dateDE(d.date)], ['Liefertermin', dateDE(d.expected_date)], ['Referenz', d.reference], d.notes ? ['Bemerkung', h('span', null, textLines(d.notes))] : null])),
      card('Summen', h('div', { class: 'totals wide' }, h('div', null, h('span', null, 'Netto'), h('strong', null, eur(d.net_cents))), ...d.totals.byRate.map((g) => h('div', null, h('span', null, `MwSt ${g.rate} % auf ${eur(g.net_cents)}`), h('span', null, eur(g.tax_cents)))), h('div', { class: 'grand' }, h('span', null, 'Brutto'), h('strong', null, eur(d.gross_cents)))))),
    card('Positionen', table({ rows: d.lines, columns: [{ label: 'Pos.', render: (l) => l.position }, { label: 'Beschreibung', render: (l) => h('span', null, l.sku ? h('small', { class: 'muted' }, `${l.sku} · `) : null, l.description) }, { label: 'Bestellt', align: 'right', render: (l) => `${num(l.qty)} ${l.unit}` }, { label: 'Geliefert', align: 'right', render: (l) => num(l.qty_received) }, { label: 'Berechnet', align: 'right', render: (l) => num(l.qty_invoiced) }, { label: 'Einkaufspreis', align: 'right', render: (l) => eur(l.cost_cents) }, { label: 'MwSt', align: 'right', render: (l) => `${l.tax_rate} %` }, { label: 'Netto', align: 'right', render: (l) => eur(l.net_cents) }] })),
    d.receipts.length || d.invoices.length || d.shipments.length ? card('Folgebelege', h('ul', { class: 'plain' }, d.receipts.map((r) => h('li', null, h('a', { href: `#/purchasing/receipts/${r.id}` }, `Wareneingang ${r.number}`), ` vom ${dateDE(r.date)}`)), d.invoices.map((i) => h('li', null, h('a', { href: `#/purchasing/invoices/${i.id}` }, `Eingangsrechnung ${i.number}`), ` (${i.supplier_ref}) `, badge('supplier_invoice', i.status))), d.shipments.map((s) => h('li', null, h('a', { href: `#/logistics/shipments/${s.id}` }, `Sendung ${s.number}`), ' ', badge('shipment', s.status))))) : null);
}, 'purchasing:r');

register('/print/purchasing/orders/:id', async ({ params }) => {
  const d = await api.get(`/purchasing/orders/${params.id}`);
  const co = state.company || {};
  const s = d.supplier;
  const addr = [s.name, s.street, [s.zip, s.city].filter(Boolean).join(' '), s.country !== 'DE' ? s.country : ''].filter(Boolean).join('\n');
  const doc = h('article', { class: 'print-doc' },
    h('header', { class: 'pd-head' }, h('div', { class: 'pd-company' }, h('strong', null, co.company_name || state.me.tenant.name), co.street ? h('div', null, co.street) : null, h('div', null, [co.zip, co.city].filter(Boolean).join(' ')), co.phone ? h('div', null, `Tel. ${co.phone}`) : null, co.email ? h('div', null, co.email) : null)),
    h('div', { class: 'pd-addr-row' }, h('div', { class: 'pd-addr' }, h('p', null, textLines(addr))), h('dl', { class: 'pd-meta' }, [['Bestell-Nr.', d.number], ['Datum', dateDE(d.date)], ['Liefertermin', dateDE(d.expected_date)], d.reference ? ['Referenz', d.reference] : null].filter(Boolean).map(([k, v]) => [h('dt', null, k), h('dd', null, v)]))),
    h('h1', { class: 'pd-title' }, `Bestellung ${d.number}`),
    h('table', { class: 'pd-table' }, h('thead', null, h('tr', null, h('th', null, 'Pos.'), h('th', null, 'Beschreibung'), h('th', { class: 'num' }, 'Menge'), h('th', { class: 'num' }, 'Einzelpreis'), h('th', { class: 'num' }, 'Netto'))),
      h('tbody', null, d.lines.map((l) => h('tr', null, h('td', null, l.position), h('td', null, l.sku ? h('small', null, `${l.sku} · `) : null, l.description), h('td', { class: 'num' }, `${num(l.qty)} ${l.unit}`), h('td', { class: 'num' }, eur(l.cost_cents)), h('td', { class: 'num' }, eur(l.net_cents)))))),
    h('div', { class: 'pd-totals' }, h('div', null, h('span', null, 'Nettobetrag'), h('span', null, eur(d.net_cents))), ...d.totals.byRate.map((g) => h('div', null, h('span', null, `Umsatzsteuer ${g.rate} %`), h('span', null, eur(g.tax_cents)))), h('div', { class: 'grand' }, h('span', null, 'Gesamtbetrag'), h('span', null, eur(d.gross_cents)))),
    d.notes ? h('p', { class: 'pd-notes' }, textLines(d.notes)) : null,
    h('footer', { class: 'pd-foot' }, [co.company_name, co.managing_director ? `Geschäftsführung: ${co.managing_director}` : '', co.vat_id ? `USt-IdNr.: ${co.vat_id}` : ''].filter(Boolean).join(' · ')));
  return h('div', { class: 'print-page' }, h('div', { class: 'print-bar no-print' }, btn('Zurück', () => history.back(), '', 'back'), btn('Drucken / als PDF speichern', () => window.print(), 'primary', 'print')), doc);
}, 'purchasing:r');

// ---------- Wareneingänge ----------
register('/purchasing/receipts', async () => {
  const d = await api.get('/purchasing/receipts');
  return page({ title: 'Wareneingänge', subtitle: 'Gebuchte Lieferungen von Lieferanten (entstehen aus Bestellungen)' }, table({ rows: d.rows, exportName: 'wareneingaenge', empty: 'Noch keine Wareneingänge.', onRow: (r) => navigate(`/purchasing/receipts/${r.id}`), columns: [{ label: 'Nr.', render: (r) => h('a', { href: `#/purchasing/receipts/${r.id}` }, r.number), csv: (r) => r.number }, { label: 'Datum', render: (r) => dateDE(r.date), csv: (r) => r.date }, { key: 'supplier', label: 'Lieferant' }, { label: 'Bestellung', render: (r) => (r.po_id ? h('a', { href: `#/purchasing/orders/${r.po_id}` }, r.po_number) : ''), csv: (r) => r.po_number || '' }, { key: 'warehouse', label: 'Lager' }, { label: 'Positionen', align: 'right', render: (r) => r.lines }] }));
}, 'purchasing:r');
register('/purchasing/receipts/:id', async ({ params }) => {
  const g = await api.get(`/purchasing/receipts/${params.id}`);
  return page({ title: `Wareneingang ${g.number}`, subtitle: `${g.supplier} · ${dateDE(g.date)} · Lager ${g.warehouse}`, back: ['#/purchasing/receipts', 'Wareneingänge'], actions: [h('button', { class: 'btn', type: 'button', onclick: () => window.print() }, icon('print', 16), 'Drucken')] },
    card(null, kv([['Bestellung', g.po_id ? h('a', { href: `#/purchasing/orders/${g.po_id}` }, g.po_number) : null], ['Notiz', g.note]]), table({ rows: g.lines, columns: [{ key: 'sku', label: 'Nr.' }, { key: 'description', label: 'Beschreibung' }, { label: 'Menge', align: 'right', render: (l) => num(l.qty) }, { label: 'Einkaufspreis', align: 'right', render: (l) => eur(l.cost_cents) }] })));
}, 'purchasing:r');

// ---------- Eingangsrechnungen ----------
register('/purchasing/invoices', async ({ query }) => {
  const wrap = h('div');
  const search = h('input', { type: 'search', class: 'search', placeholder: 'Nummer, Lieferant oder Rechnungsnr. …', 'aria-label': 'Suchen' });
  const status = h('select', { 'aria-label': 'Status' }, [['', 'Alle Status'], ...statusOptions('supplier_invoice')].map(([v, l]) => h('option', { value: v }, l)));
  const overdue = h('label', { class: 'check inline' }, h('input', { type: 'checkbox', checked: query.overdue === '1' }), 'nur überfällige');
  const load = async () => {
    const d = await api.get(`/purchasing/invoices${qs({ q: search.value, status: status.value, supplier_id: query.supplier_id, overdue: overdue.firstChild.checked ? 1 : '', limit: 500 })}`);
    const live = d.rows.filter((r) => r.status !== 'cancelled');
    wrap.replaceChildren(table({ rows: d.rows, exportName: 'eingangsrechnungen', empty: 'Keine Eingangsrechnungen gefunden.', onRow: (r) => navigate(`/purchasing/invoices/${r.id}`), columns: [
      { label: 'Nr.', sort: (r) => r.number, render: (r) => h('a', { href: `#/purchasing/invoices/${r.id}` }, r.number), csv: (r) => r.number }, { key: 'supplier_ref', label: 'Rechnungsnr. Lieferant' }, { label: 'Lieferant', render: (r) => h('a', { href: `#/suppliers/${r.supplier_id}` }, r.supplier), csv: (r) => r.supplier },
      { label: 'Datum', sort: (r) => r.date, render: (r) => dateDE(r.date), csv: (r) => r.date }, { label: 'Fällig', sort: (r) => r.due_date || '', render: (r) => h('span', { class: ['open', 'partial'].includes(r.status) && r.due_date < todayISO() ? 'neg' : '' }, dateDE(r.due_date)), csv: (r) => r.due_date || '' },
      { label: 'Status', sort: (r) => r.status, render: (r) => badge('supplier_invoice', r.status), csv: (r) => r.status }, { label: 'Brutto', align: 'right', sort: (r) => r.gross_cents, render: (r) => eur(r.gross_cents), csv: (r) => r.gross_cents / 100 },
      { label: 'Offen', align: 'right', sort: (r) => r.gross_cents - r.paid_cents, render: (r) => (['open', 'partial'].includes(r.status) ? h('strong', { class: 'neg' }, eur(r.gross_cents - r.paid_cents)) : ''), csv: (r) => (['open', 'partial'].includes(r.status) ? (r.gross_cents - r.paid_cents) / 100 : 0) }] }),
    h('p', { class: 'muted small' }, `${d.rows.length} Rechnungen · davon offen: ${eur(live.filter((r) => ['open', 'partial'].includes(r.status)).reduce((s, r) => s + r.gross_cents - r.paid_cents, 0))}`));
  };
  let t;
  search.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => guard(load), 250); });
  status.addEventListener('change', () => guard(load)); overdue.firstChild.addEventListener('change', () => guard(load));
  await load();
  return page({ title: 'Eingangsrechnungen', subtitle: 'Rechnungen von Lieferanten erfassen, buchen und bezahlen', actions: can('purchasing:w') ? [btn('Eingangsrechnung erfassen', () => navigate('/purchasing/invoices/new'), 'primary', 'plus')] : [] }, filters(search, status, overdue), wrap);
}, 'purchasing:r');

register('/purchasing/invoices/new', async ({ query }) => {
  const accounts = (await api.get('/accounting/expense-accounts')).rows;
  let po = query.po ? await api.get(`/purchasing/orders/${query.po}`) : null;
  let supplier = po?.supplier || (query.supplier ? (await api.get(`/suppliers/${query.supplier}`)).item : null);
  const f = form([{ name: 'supplier_ref', label: 'Rechnungsnummer des Lieferanten', required: true, maxlength: 80 }, { name: 'date', label: 'Rechnungsdatum', type: 'date', required: true }, { name: 'due_date', label: 'Fällig am (leer = nach Zahlungsziel)', type: 'date' }, { name: 'note', label: 'Notiz', maxlength: 300 }], { date: todayISO() });
  const supBox = h('div', { class: 'customer-pick' });
  const poBox = h('div', { class: 'stack' });
  const rowsEl = h('tbody');
  const totalsBox = h('div', { class: 'totals' });
  const rows = new Set();
  const defaultAcc = (tax) => accounts.find((a) => a.system_key === `goods_${Number(tax) === 19 ? 19 : Number(tax) === 7 ? 7 : 0}`)?.id;
  const collect = (strict) => { const out = []; for (const r of rows) { const g = r.read(); if (!g.description && g.net === '') continue; const net = parseMoney(g.net); const qty = parseNum(g.qty); if (!g.description) { if (strict) throw new Error('Jede Position braucht eine Beschreibung'); continue; } if (net === null || net < 0) { if (strict) throw new Error(`Nettobetrag ungültig bei „${g.description}“`); continue; } if (qty === null || qty < 0) { if (strict) throw new Error(`Menge ungültig bei „${g.description}“`); continue; } out.push({ description: g.description, qty, net_cents: net, tax_rate: Number(g.tax), account_id: Number(g.account), po_line_id: g.po_line_id || 0 }); } return out; };
  const update = () => { const t = calcTotals(collect(false)); totalsBox.replaceChildren(h('div', null, h('span', null, 'Netto'), h('strong', null, eur(t.net_cents))), ...t.byRate.map((g) => h('div', null, h('span', null, `Vorsteuer ${g.rate} % auf ${eur(g.net_cents)}`), h('span', null, eur(g.tax_cents)))), h('div', { class: 'grand' }, h('span', null, 'Brutto'), h('strong', null, eur(t.gross_cents)))); };
  const addRow = (d = {}) => {
    const desc = h('input', { type: 'text', value: d.description || '', maxlength: 500, 'aria-label': 'Beschreibung' });
    const qty = h('input', { type: 'text', inputmode: 'decimal', class: 'narrow', value: d.qty ?? 1, 'aria-label': 'Menge' });
    const net = h('input', { type: 'text', inputmode: 'decimal', class: 'narrow', value: d.net_cents !== undefined ? moneyText(d.net_cents) : '', 'aria-label': 'Nettobetrag gesamt' });
    const tax = h('select', { class: 'narrow', 'aria-label': 'Steuersatz' }, TAX.map(([v, l]) => h('option', { value: v, selected: Number(d.tax_rate ?? 19) === v }, l)));
    const acc = h('select', { 'aria-label': 'Konto' }, accounts.map((a) => h('option', { value: a.id, selected: a.id === (d.account_id || defaultAcc(d.tax_rate ?? 19)) }, `${a.number} ${a.name}`)));
    tax.addEventListener('change', () => { if (!d.account_id) acc.value = String(defaultAcc(tax.value)); });
    const tr = h('tr', null, h('td', { 'data-label': 'Beschreibung' }, desc), h('td', { 'data-label': 'Menge' }, qty), h('td', { 'data-label': 'Netto gesamt €' }, net), h('td', { 'data-label': 'MwSt' }, tax), h('td', { 'data-label': 'Konto' }, acc), h('td', null, h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Position entfernen', onclick: () => { rows.delete(row); tr.remove(); update(); } }, icon('trash', 16))));
    const row = { read: () => ({ description: desc.value.trim(), qty: qty.value, net: net.value.trim(), tax: tax.value, account: acc.value, po_line_id: d.po_line_id }) };
    for (const el of [desc, qty, net, tax]) el.addEventListener('input', update);
    rows.add(row); rowsEl.append(tr); update(); return desc;
  };
  const fillFromPo = (p) => { rows.clear(); rowsEl.replaceChildren(); for (const l of p.lines) { const open = l.qty - l.qty_invoiced; if (open > 1e-6) addRow({ description: l.description, qty: open, net_cents: Math.round(open * l.cost_cents), tax_rate: l.tax_rate, po_line_id: l.id }); } if (!rows.size) addRow(); update(); };
  const showPo = async () => {
    poBox.replaceChildren();
    if (po) { poBox.append(h('div', { class: 'notice' }, `Bestellung ${po.number} wird abgerechnet. `, btn('Position(en) neu aus Bestellung füllen', () => fillFromPo(po), 'small'), btn('Ohne Bestellung', () => { po = null; showPo(); }, 'small'))); return; }
    if (supplier) {
      const open = (await api.get(`/purchasing/orders${qs({ supplier_id: supplier.id, limit: 50 })}`)).rows.filter((o) => ['ordered', 'partial', 'received'].includes(o.status));
      if (open.length) { const sel = h('select', { 'aria-label': 'Bestellung zuordnen' }, [h('option', { value: '' }, '– ohne Bestellung –'), ...open.map((o) => h('option', { value: o.id }, `${o.number} · ${eur(o.gross_cents)}`))]); sel.addEventListener('change', async () => { if (!sel.value) return; po = await api.get(`/purchasing/orders/${sel.value}`); fillFromPo(po); showPo(); }); poBox.append(h('label', null, 'Zu einer Bestellung gehörig? '), sel); }
    }
  };
  const showSup = () => { supBox.replaceChildren(supplier
    ? h('div', { class: 'chosen' }, h('div', null, h('strong', null, supplier.name), h('small', { class: 'muted' }, ` Lieferanten-Nr. ${supplier.number || ''}`)), po ? null : btn('Ändern', () => { supplier = null; showSup(); }, 'small'))
    : (() => { const c = combo({ placeholder: 'Lieferant suchen …', search: (q) => api.get(`/suppliers${qs({ q, limit: 8 })}`).then((r) => r.rows.filter((x) => x.status !== 'inactive')), label: (s) => h('span', null, h('strong', null, s.name), h('small', { class: 'muted' }, ` ${s.number}`)), onPick: async (s) => { supplier = (await api.get(`/suppliers/${s.id}`)).item; showSup(); } }); setTimeout(() => c.input.focus(), 0); return c.el; })()); showPo(); };
  showSup();
  if (po) fillFromPo(po); else addRow();
  const err = h('p', { class: 'form-error', role: 'alert', hidden: true });
  const lines = h('div', { class: 'lines-editor' }, h('div', { class: 'table-wrap' }, h('table', { class: 'data lines' }, h('thead', null, h('tr', null, ['Beschreibung', 'Menge', 'Netto gesamt €', 'MwSt', 'Konto', ''].map((t) => h('th', null, t)))), rowsEl)), h('div', { class: 'lines-foot' }, btn('Position hinzufügen', () => addRow().focus(), 'small', 'plus'), totalsBox));
  return page({ title: 'Eingangsrechnung erfassen', back: ['#/purchasing/invoices', 'Eingangsrechnungen'] }, card('Lieferant', supBox, poBox), card('Rechnungsdaten', f.el), card('Positionen', lines), err,
    h('div', { class: 'form-actions' }, btn('Abbrechen', () => history.back()), btn('Erfassen und buchen', async (e) => {
      err.hidden = true; e.currentTarget.disabled = true;
      try {
        if (!supplier) throw new Error('Bitte einen Lieferanten wählen');
        const v = f.get();
        const r = await api.post('/purchasing/invoices', { supplier_id: supplier.id, po_id: po?.id || 0, supplier_ref: v.supplier_ref, date: v.date, due_date: v.due_date || undefined, note: v.note, lines: collect(true) });
        toast(`Eingangsrechnung ${r.number} gebucht`); navigate(`/purchasing/invoices/${r.id}`);
      } catch (ex) { err.textContent = ex.message || errMsg(ex); err.hidden = false; e.currentTarget.disabled = false; }
    }, 'primary')));
}, 'purchasing:w');

register('/purchasing/invoices/:id', async ({ params }) => {
  const d = await api.get(`/purchasing/invoices/${params.id}`);
  const a = [];
  if (['open', 'partial'].includes(d.status) && can('accounting:w')) a.push(btn('Zahlung erfassen', () => guard(async () => {
    const accts = (await api.get('/accounting/finance-accounts')).rows.filter((x) => x.active);
    const dlg = formDialog({ title: `Zahlung · ${d.number}`, intro: `Offen: ${eur(d.open_cents)}`, submitLabel: 'Zahlung buchen', values: { amount_cents: d.open_cents, date: todayISO(), method: 'bank', reference: d.supplier_ref, account_id: defaultAccount(accts, 'bank') },
      fields: [{ name: 'amount_cents', label: 'Betrag (€)', type: 'money', required: true }, { name: 'date', label: 'Zahldatum', type: 'date', required: true }, { name: 'method', label: 'Zahlungsart', type: 'select', options: METHODS }, { name: 'account_id', label: 'Bezahlt von Konto', type: 'select', options: accts.map((x) => [x.id, `${x.number} ${x.name}`]) }, { name: 'reference', label: 'Verwendungszweck', wide: true }],
      onSubmit: async (v) => { await api.post(`/purchasing/invoices/${d.id}/payments`, { ...v, account_id: Number(v.account_id) }); toast('Zahlung gebucht'); refresh(); } });
    followMethod(dlg.form, accts);
  }), 'primary', 'euro'));
  if (d.status !== 'cancelled' && !d.paid_cents && can('purchasing:w')) a.push(btn('Stornieren', async () => { if (await confirmDialog({ title: 'Eingangsrechnung stornieren?', message: 'Die Buchung wird per Gegenbuchung storniert.', confirmLabel: 'Stornieren', danger: true })) guard(async () => { await api.post(`/purchasing/invoices/${d.id}/cancel`); toast('Storniert'); refresh(); }); }, 'danger'));
  return page({ title: `Eingangsrechnung ${d.number}`, subtitle: `${d.supplier.name} · Rechnungsnr. ${d.supplier_ref}`, back: ['#/purchasing/invoices', 'Eingangsrechnungen'], actions: a },
    h('p', null, badge('supplier_invoice', d.status), ['open', 'partial'].includes(d.status) && d.due_date < todayISO() ? h('span', { class: 'badge red' }, `überfällig seit ${dateDE(d.due_date)}`) : null),
    h('div', { class: 'grid-2' }, card('Rechnung', kv([['Lieferant', h('a', { href: `#/suppliers/${d.supplier.id}` }, `${d.supplier.name} (${d.supplier.number})`)], ['Rechnungsdatum', dateDE(d.date)], ['Fällig am', dateDE(d.due_date)], ['Bestellung', d.po ? h('a', { href: `#/purchasing/orders/${d.po.id}` }, d.po.number) : null], ['IBAN Lieferant', d.supplier.iban], ['Notiz', d.note]])),
      card('Beträge', h('div', { class: 'totals wide' }, h('div', null, h('span', null, 'Netto'), h('strong', null, eur(d.net_cents))), h('div', null, h('span', null, 'Vorsteuer'), h('span', null, eur(d.tax_cents))), h('div', { class: 'grand' }, h('span', null, 'Brutto'), h('strong', null, eur(d.gross_cents))), h('div', null, h('span', null, 'Bezahlt'), h('span', null, eur(d.paid_cents))), h('div', { class: 'grand' }, h('span', null, 'Offen'), h('strong', { class: d.open_cents > 0 ? 'neg' : 'pos' }, eur(d.open_cents)))))),
    card('Positionen', table({ rows: d.lines, columns: [{ key: 'description', label: 'Beschreibung' }, { label: 'Menge', align: 'right', render: (l) => num(l.qty) }, { label: 'Konto', render: (l) => `${l.account_number} ${l.account_name}` }, { label: 'MwSt', align: 'right', render: (l) => `${l.tax_rate} %` }, { label: 'Netto', align: 'right', render: (l) => eur(l.net_cents) }] })),
    d.payments.length ? card('Zahlungen', table({ rows: d.payments, columns: [{ label: 'Datum', render: (p) => dateDE(p.date) }, { label: 'Konto', render: (p) => `${p.account_number} ${p.account_name}` }, { label: 'Betrag', align: 'right', render: (p) => h('span', { class: p.reversed ? 'strike' : '' }, eur(p.amount_cents)) }, { label: '', render: (p) => (p.reversed ? h('span', { class: 'badge gray' }, 'storniert') : can('accounting:w') ? btn('Stornieren', async () => { if (await confirmDialog({ title: 'Zahlung stornieren?', message: eur(p.amount_cents), confirmLabel: 'Stornieren', danger: true })) guard(async () => { await api.post(`/payments/${p.id}/reverse`); toast('Zahlung storniert'); refresh(); }); }, 'small') : '') }] })) : null);
}, 'purchasing:r');

// ---------- Nachbestellung ----------
register('/purchasing/reorder', async () => {
  const d = await api.get('/purchasing/reorder');
  const rows = d.rows.map((r) => ({ ...r, pick: h('input', { type: 'checkbox', checked: !!r.supplier_id, disabled: !r.supplier_id, 'aria-label': `${r.name} bestellen` }), qty: h('input', { type: 'text', inputmode: 'decimal', class: 'narrow', value: String(r.suggest_qty).replace('.', ','), 'aria-label': `Menge ${r.name}` }) }));
  const create = () => guard(async () => {
    const items = rows.filter((r) => r.pick.checked).map((r) => ({ product_id: r.id, qty: parseNum(r.qty.value) || 0 })).filter((x) => x.qty > 0);
    if (!items.length) { toast('Bitte mindestens einen Artikel auswählen.', 'error'); return; }
    const r = await api.post('/purchasing/reorder/create', { items });
    toast(`${r.ids.length} Bestellentwurf/-entwürfe angelegt`); navigate(r.ids.length === 1 ? `/purchasing/orders/${r.ids[0]}` : '/purchasing/orders?status=draft');
  });
  return page({ title: 'Nachbestellung', subtitle: 'Artikel, deren verfügbarer Bestand (inkl. bereits Bestelltes) den Mindestbestand erreicht hat', actions: can('purchasing:w') && rows.length ? [btn('Bestellentwürfe erzeugen', create, 'primary', 'cart')] : [] },
    rows.length ? table({ rows, columns: [{ label: '', render: (r) => r.pick }, { key: 'sku', label: 'Nr.' }, { label: 'Artikel', render: (r) => h('a', { href: `#/products/${r.id}` }, r.name) }, { label: 'Lieferant', render: (r) => r.supplier || h('span', { class: 'neg' }, 'fehlt – im Artikel hinterlegen') }, { label: 'Bestand', align: 'right', render: (r) => num(r.on_hand) }, { label: 'Reserviert', align: 'right', render: (r) => num(r.reserved) }, { label: 'Bestellt', align: 'right', render: (r) => num(r.on_order) }, { label: 'Min.', align: 'right', render: (r) => num(r.min_stock) }, { label: 'Menge', align: 'right', render: (r) => r.qty }] })
      : card(null, h('p', null, 'Alles in Ordnung: Kein Artikel hat den Mindestbestand erreicht. Mindestbestände pflegen Sie im jeweiligen Artikel.')));
}, 'purchasing:r');
