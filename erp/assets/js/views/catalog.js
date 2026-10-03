// Artikel, Lager, Bestand, Bewegungen, Umlagerung, Korrektur, Inventur.
import { api, qs } from '../api.js';
import { register, can, navigate } from '../core.js';
import { h, page, card, kpi, table, badge, btn, kv, formDialog, form, confirmDialog, guard, toast, eur, num, dateTimeDE, icon, combo, errMsg, statusOptions, tabs } from '../ui.js';

const TAX = [[19, '19 %'], [7, '7 %'], [0, '0 %']];
const KINDS = { receipt: 'Wareneingang', issue: 'Warenausgang', return: 'Retoure', adjustment: 'Korrektur', inventory: 'Inventur', transfer_in: 'Umlagerung (Zugang)', transfer_out: 'Umlagerung (Abgang)' };

const productFields = (suppliers) => [
  { type: 'heading', label: 'Artikel' },
  { name: 'sku', label: 'Artikelnummer', required: true, maxlength: 40 }, { name: 'name', label: 'Bezeichnung', required: true, maxlength: 200, wide: true },
  { name: 'category', label: 'Kategorie', maxlength: 100 }, { name: 'unit', label: 'Einheit', maxlength: 12, help: 'z. B. Stk, kg, Std' },
  { name: 'barcode', label: 'Barcode / EAN', maxlength: 60 }, { name: 'weight_g', label: 'Gewicht (g)', type: 'number' },
  { name: 'description', label: 'Beschreibung', type: 'textarea', wide: true, maxlength: 2000 },
  { type: 'heading', label: 'Preise' },
  { name: 'price_cents', label: 'Verkaufspreis netto (€)', type: 'money' }, { name: 'cost_cents', label: 'Einkaufspreis netto (€)', type: 'money' },
  { name: 'tax_rate', label: 'Steuersatz', type: 'select', options: TAX },
  { type: 'heading', label: 'Lager' },
  { name: 'track_stock', label: 'Bestand führen (Ware – nicht für Dienstleistungen)', type: 'checkbox', wide: true },
  { name: 'min_stock', label: 'Mindestbestand', type: 'number', help: 'Darunter erscheint der Artikel in der Nachbestellung' }, { name: 'reorder_qty', label: 'Nachbestellmenge', type: 'number', help: 'Auffüllen auf Mindestbestand + diese Menge' },
  { name: 'supplier_id', label: 'Standard-Lieferant', type: 'select', options: [['', '– keiner –'], ...suppliers.map((s) => [s.id, `${s.number} ${s.name}`])], wide: true },
  { name: 'active', label: 'Aktiv (in neuen Belegen auswählbar)', type: 'checkbox', wide: true },
];
const cleanProduct = (v) => ({ ...v, tax_rate: Number(v.tax_rate), supplier_id: v.supplier_id ? Number(v.supplier_id) : 0 });
const loadSuppliers = () => (can('purchasing:r') ? api.get('/suppliers?limit=500').then((r) => r.rows).catch(() => []) : Promise.resolve([]));

register('/products', async ({ query }) => {
  const wrap = h('div');
  const search = h('input', { type: 'search', class: 'search', placeholder: 'Artikel suchen …', 'aria-label': 'Suchen', value: query.q || '' });
  const first = await api.get('/products?limit=1000');
  const cat = h('select', { 'aria-label': 'Kategorie' }, [['', 'Alle Kategorien'], ...first.categories.map((c) => [c, c])].map(([v, l]) => h('option', { value: v }, l)));
  const low = h('label', { class: 'check inline' }, h('input', { type: 'checkbox', id: 'low' }), 'nur Unterbestand');
  const draw = (res) => wrap.replaceChildren(table({ exportName: 'artikel', empty: 'Noch keine Artikel.', onRow: (r) => navigate(`/products/${r.id}`), rowClass: (r) => (r.active ? '' : 'inactive'), rows: res.rows, columns: [
    { key: 'sku', label: 'Nr.' }, { label: 'Bezeichnung', sort: (r) => r.name, csv: (r) => r.name, render: (r) => h('a', { href: `#/products/${r.id}` }, r.name, r.active ? null : h('span', { class: 'badge gray tight' }, 'inaktiv')) }, { key: 'category', label: 'Kategorie' },
    { label: 'VK netto', align: 'right', sort: (r) => r.price_cents, render: (r) => eur(r.price_cents), csv: (r) => r.price_cents / 100 },
    { label: 'EK (Ø)', align: 'right', sort: (r) => r.avg_cost_cents, render: (r) => (r.track_stock ? eur(r.avg_cost_cents) : ''), csv: (r) => r.avg_cost_cents / 100 },
    { label: 'Marge', align: 'right', sort: (r) => r.price_cents - r.avg_cost_cents, render: (r) => (r.track_stock && r.price_cents ? `${Math.round(((r.price_cents - r.avg_cost_cents) / r.price_cents) * 100)} %` : '') },
    { label: 'Bestand', align: 'right', sort: (r) => r.on_hand, render: (r) => (r.track_stock ? h('span', { class: r.min_stock > 0 && r.on_hand - r.reserved <= r.min_stock ? 'neg' : '' }, `${num(r.on_hand)} ${r.unit}`) : 'Dienstleistung'), csv: (r) => r.on_hand },
    { label: 'Verfügbar', align: 'right', sort: (r) => r.on_hand - r.reserved, render: (r) => (r.track_stock ? num(r.on_hand - r.reserved) : ''), csv: (r) => r.on_hand - r.reserved }] }));
  const load = async () => draw(await api.get(`/products${qs({ q: search.value, category: cat.value, low: low.firstChild.checked ? 1 : '', limit: 1000 })}`));
  let t;
  search.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => guard(load), 250); });
  cat.addEventListener('change', () => guard(load));
  low.firstChild.addEventListener('change', () => guard(load));
  draw(first);
  return page({ title: 'Artikel', subtitle: 'Waren und Dienstleistungen mit Preisen, Steuersatz und Mindestbestand', actions: can('stock:w') ? [btn('Neuer Artikel', () => navigate('/products/new'), 'primary', 'plus')] : [] }, h('div', { class: 'filters' }, search, cat, low), wrap);
}, 'sales:r');

register('/products/new', async () => {
  const suppliers = await loadSuppliers();
  const f = form(productFields(suppliers), { unit: 'Stk', tax_rate: 19, track_stock: true, active: true });
  const err = h('p', { class: 'form-error', role: 'alert', hidden: true });
  return page({ title: 'Neuer Artikel', back: ['#/products', 'Artikel'] }, card(null, f.el, err, h('div', { class: 'form-actions' }, btn('Abbrechen', () => navigate('/products')),
    btn('Speichern', async (e) => { err.hidden = true; e.currentTarget.disabled = true; try { const r = await api.post('/products', cleanProduct(f.get())); toast('Artikel angelegt'); navigate(`/products/${r.id}`); } catch (ex) { err.textContent = ex.message || errMsg(ex); err.hidden = false; e.currentTarget.disabled = false; } }, 'primary'))));
}, 'stock:w');

function adjustDialog(product, warehouses, levels, done) {
  formDialog({ title: `Bestand korrigieren: ${product.name}`, intro: 'Tragen Sie entweder die gezählte Menge oder die Änderung ein. Jede Korrektur wird im Bewegungsprotokoll festgehalten.',
    fields: [{ name: 'warehouse_id', label: 'Lager', type: 'select', options: warehouses.map((w) => [w.id, `${w.name}${levels?.[w.id] !== undefined ? ` (aktuell ${num(levels[w.id])})` : ''}`]), wide: true }, { name: 'counted', label: 'Gezählte Menge', type: 'number', empty: '' }, { name: 'delta', label: 'oder Änderung (+/−)', type: 'number', empty: '' }, { name: 'reason', label: 'Grund', required: true, wide: true, maxlength: 300, placeholder: 'z. B. Bruch, Fund, Zählung' }],
    onSubmit: async (v) => { const body = { product_id: product.id, warehouse_id: Number(v.warehouse_id), reason: v.reason }; if (v.counted !== '' && v.counted !== null) body.counted = v.counted; else if (v.delta !== '' && v.delta !== null) body.delta = v.delta; else throw new Error('Bitte gezählte Menge oder Änderung eintragen'); await api.post('/stock/adjust', body); toast('Bestand korrigiert'); done(); } });
}
function transferDialog(product, warehouses, done) {
  if (warehouses.length < 2) { toast('Für eine Umlagerung werden mindestens zwei Lager benötigt.', 'error'); return; }
  const opts = warehouses.map((w) => [w.id, w.name]);
  formDialog({ title: `Umlagern: ${product.name}`, fields: [{ name: 'from_warehouse_id', label: 'Von Lager', type: 'select', options: opts }, { name: 'to_warehouse_id', label: 'Nach Lager', type: 'select', options: opts.slice().reverse() }, { name: 'qty', label: 'Menge', type: 'number', required: true }, { name: 'note', label: 'Notiz', maxlength: 300, wide: true }],
    onSubmit: async (v) => { await api.post('/stock/transfer', { product_id: product.id, from_warehouse_id: Number(v.from_warehouse_id), to_warehouse_id: Number(v.to_warehouse_id), qty: v.qty, note: v.note }); toast('Umgelagert'); done(); } });
}

register('/products/:id', async ({ params }) => {
  const d = await api.get(`/products/${params.id}`);
  const p = d.item;
  const suppliers = await loadSuppliers();
  const wh = d.levels.map((l) => ({ id: l.warehouse_id, name: l.warehouse }));
  const refresh = () => document.dispatchEvent(new Event('erp:refresh'));
  const levelsMap = Object.fromEntries(d.levels.map((l) => [l.warehouse_id, l.qty]));
  const actions = [];
  if (can('stock:w')) {
    if (p.track_stock) actions.push(btn('Bestand korrigieren', () => adjustDialog(p, wh, levelsMap, refresh), '', 'check'), btn('Umlagern', () => transferDialog(p, wh, refresh), '', 'truck'));
    actions.push(btn('Bearbeiten', () => formDialog({ title: 'Artikel bearbeiten', fields: productFields(suppliers), values: p, wide: true, onSubmit: async (v) => { await api.put(`/products/${p.id}`, cleanProduct(v)); toast('Gespeichert'); refresh(); } }), '', 'edit'),
      btn('Löschen', async () => { if (await confirmDialog({ title: 'Artikel löschen?', message: `${p.sku} ${p.name} wird gelöscht (nur möglich, solange er nirgends verwendet wird).`, confirmLabel: 'Löschen', danger: true })) guard(async () => { await api.del(`/products/${p.id}`); toast('Gelöscht'); navigate('/products'); }); }, 'danger', 'trash'));
  }
  const tiles = p.track_stock ? [kpi('Bestand gesamt', `${num(d.on_hand)} ${p.unit}`), kpi('Reserviert (Aufträge)', num(d.reserved)), kpi('Verfügbar', num(d.on_hand - d.reserved), p.min_stock > 0 && d.on_hand - d.reserved <= p.min_stock ? 'bad' : 'good'), kpi('Bestellt (unterwegs)', num(d.on_order)), kpi('Lagerwert', eur(Math.round(d.on_hand * p.avg_cost_cents)))] : [kpi('Art', 'Dienstleistung (kein Bestand)')];
  return page({ title: p.name, subtitle: `Artikelnummer ${p.sku}${p.category ? ` · ${p.category}` : ''}`, back: ['#/products', 'Artikel'], actions },
    p.active ? null : h('div', { class: 'notice' }, 'Dieser Artikel ist inaktiv und in neuen Belegen nicht auswählbar.'),
    h('div', { class: 'kpis' }, tiles),
    h('div', { class: 'grid-2' },
      card('Stammdaten', kv([['Verkaufspreis netto', eur(p.price_cents)], ['Einkaufspreis (letzter)', eur(p.cost_cents)], ['Einkaufspreis (Durchschnitt)', p.track_stock ? eur(p.avg_cost_cents) : null], ['Steuersatz', `${p.tax_rate} %`], ['Einheit', p.unit], ['Barcode', p.barcode], ['Gewicht', p.weight_g ? `${p.weight_g} g` : null], ['Mindestbestand', p.track_stock ? num(p.min_stock) : null], ['Nachbestellmenge', p.track_stock && p.reorder_qty ? num(p.reorder_qty) : null], ['Standard-Lieferant', p.supplier_id ? h('a', { href: `#/suppliers/${p.supplier_id}` }, suppliers.find((s) => s.id === p.supplier_id)?.name || 'Lieferant') : null], ['Beschreibung', p.description]])),
      p.track_stock ? card('Bestand je Lager', table({ columns: [{ key: 'warehouse', label: 'Lager' }, { label: 'Bestand', align: 'right', render: (r) => `${num(r.qty)} ${p.unit}` }, { label: 'Lagerplatz', render: (r) => (can('stock:w') ? h('button', { class: 'linklike', type: 'button', onclick: () => formDialog({ title: `Lagerplatz in ${r.warehouse}`, fields: [{ name: 'bin', label: 'Lagerplatz', maxlength: 40, help: 'z. B. Regal A-03' }], values: { bin: r.bin }, onSubmit: async (v) => { await api.put('/stock/bin', { product_id: p.id, warehouse_id: r.warehouse_id, bin: v.bin }); refresh(); } }) }, r.bin || 'festlegen') : r.bin || '–') }], rows: d.levels })) : null),
    p.track_stock ? card('Letzte Bewegungen', table({ columns: [{ label: 'Zeit', render: (r) => dateTimeDE(r.ts) }, { label: 'Art', render: (r) => KINDS[r.kind] || r.kind }, { key: 'warehouse', label: 'Lager' }, { label: 'Menge', align: 'right', render: (r) => h('span', { class: r.delta < 0 ? 'neg' : 'pos' }, `${r.delta > 0 ? '+' : ''}${num(r.delta)}`) }, { label: 'Beleg', render: (r) => r.ref_number || '' }, { key: 'note', label: 'Notiz' }], rows: d.movements, empty: 'Noch keine Bewegungen.' })) : null);
}, 'sales:r');

// ---------- Bestand ----------
register('/stock', async ({ query }) => {
  const wrap = h('div');
  const search = h('input', { type: 'search', class: 'search', placeholder: 'Artikel suchen …', 'aria-label': 'Suchen' });
  const low = h('label', { class: 'check inline' }, h('input', { type: 'checkbox', checked: query.low === '1' }), 'nur Unterbestand');
  const kp = h('div', { class: 'kpis' });
  const load = async () => {
    const d = await api.get(`/stock${qs({ q: search.value, low: low.firstChild.checked ? 1 : '' })}`);
    kp.replaceChildren(kpi('Lagerwert (zum Ø-Einkaufspreis)', eur(d.value_cents)), kpi('Artikel mit Bestandsführung', String(d.rows.length)), kpi('Unter Mindestbestand', String(d.rows.filter((r) => r.low).length), d.rows.some((r) => r.low) ? 'warn' : 'good', '#/purchasing/reorder'));
    const cols = [{ key: 'sku', label: 'Nr.' }, { label: 'Artikel', sort: (r) => r.name, csv: (r) => r.name, render: (r) => h('a', { href: `#/products/${r.id}` }, r.name) },
      ...d.warehouses.map((w) => ({ label: w.code, align: 'right', sort: (r) => r.levels[w.id]?.qty ?? 0, render: (r) => (r.levels[w.id] ? num(r.levels[w.id].qty) : '–'), csv: (r) => r.levels[w.id]?.qty ?? 0 })),
      { label: 'Gesamt', align: 'right', sort: (r) => r.total, render: (r) => h('strong', null, `${num(r.total)} ${r.unit}`), csv: (r) => r.total },
      { label: 'Reserviert', align: 'right', render: (r) => num(r.reserved), csv: (r) => r.reserved }, { label: 'Verfügbar', align: 'right', sort: (r) => r.available, render: (r) => h('span', { class: r.low ? 'neg' : '' }, num(r.available)), csv: (r) => r.available },
      { label: 'Bestellt', align: 'right', render: (r) => num(r.on_order), csv: (r) => r.on_order }, { label: 'Min.', align: 'right', render: (r) => (r.min_stock ? num(r.min_stock) : ''), csv: (r) => r.min_stock }, { label: 'Wert', align: 'right', sort: (r) => r.value_cents, render: (r) => eur(r.value_cents), csv: (r) => r.value_cents / 100 }];
    wrap.replaceChildren(table({ columns: cols, rows: d.rows, onRow: (r) => navigate(`/products/${r.id}`), rowClass: (r) => (r.low ? 'warnrow' : ''), exportName: 'bestand', empty: 'Keine Artikel mit Bestandsführung.' }));
  };
  let t;
  search.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => guard(load), 250); });
  low.firstChild.addEventListener('change', () => guard(load));
  await load();
  const actions = [];
  if (can('stock:w')) {
    const pickProduct = async (fn) => { const r = await api.get('/products?active=1&limit=1000'); const ws = (await api.get('/warehouses')).rows.filter((w) => w.active); const opts = r.rows.filter((p) => p.track_stock); if (!opts.length) { toast('Es gibt noch keine Artikel mit Bestandsführung.', 'error'); return; }
      const sel = formDialog({ title: 'Artikel wählen', fields: [{ name: 'product_id', label: 'Artikel', type: 'select', options: opts.map((p) => [p.id, `${p.sku} · ${p.name}`]), wide: true }], submitLabel: 'Weiter', onSubmit: async (v) => { const p = opts.find((x) => x.id === Number(v.product_id)); const det = await api.get(`/products/${p.id}`); setTimeout(() => fn(p, ws, Object.fromEntries(det.levels.map((l) => [l.warehouse_id, l.qty]))), 0); } }); void sel; };
    actions.push(btn('Korrektur', () => pickProduct((p, ws, lv) => adjustDialog(p, ws, lv, () => document.dispatchEvent(new Event('erp:refresh')))), '', 'check'), btn('Umlagerung', () => pickProduct((p, ws) => transferDialog(p, ws, () => document.dispatchEvent(new Event('erp:refresh')))), '', 'truck'));
  }
  return page({ title: 'Bestand', subtitle: 'Bestand je Lager, reserviert für offene Aufträge und bestellt', actions }, kp, h('div', { class: 'filters' }, search, low), wrap);
}, 'stock:r');

register('/stock/movements', async ({ query }) => {
  const [prods, whs] = await Promise.all([api.get('/products?limit=1000'), api.get('/warehouses')]);
  const prod = h('select', { 'aria-label': 'Artikel' }, [['', 'Alle Artikel'], ...prods.rows.filter((p) => p.track_stock).map((p) => [p.id, `${p.sku} · ${p.name}`])].map(([v, l]) => h('option', { value: v, selected: String(v) === (query.product_id || '') }, l)));
  const whSel = h('select', { 'aria-label': 'Lager' }, [['', 'Alle Lager'], ...whs.rows.map((w) => [w.id, w.name])].map(([v, l]) => h('option', { value: v }, l)));
  const wrap = h('div');
  const load = async () => {
    const d = await api.get(`/stock/movements${qs({ product_id: prod.value, warehouse_id: whSel.value, limit: 300 })}`);
    wrap.replaceChildren(table({ rows: d.rows, exportName: 'lagerbewegungen', empty: 'Keine Bewegungen.', columns: [{ label: 'Zeit', sort: (r) => r.ts, render: (r) => dateTimeDE(r.ts), csv: (r) => r.ts }, { label: 'Art', render: (r) => KINDS[r.kind] || r.kind }, { label: 'Artikel', render: (r) => h('a', { href: `#/products/${r.product_id ?? ''}` }, `${r.sku} ${r.product}`), csv: (r) => `${r.sku} ${r.product}` }, { key: 'warehouse', label: 'Lager' }, { label: 'Menge', align: 'right', sort: (r) => r.delta, render: (r) => h('span', { class: r.delta < 0 ? 'neg' : 'pos' }, `${r.delta > 0 ? '+' : ''}${num(r.delta)}`), csv: (r) => r.delta }, { label: 'Beleg', render: (r) => r.ref_number || '' }, { key: 'note', label: 'Notiz' }] }));
  };
  prod.addEventListener('change', () => guard(load)); whSel.addEventListener('change', () => guard(load));
  await load();
  return page({ title: 'Lagerbewegungen', subtitle: 'Jede Bestandsänderung ist nachvollziehbar protokolliert' }, h('div', { class: 'filters' }, prod, whSel), wrap);
}, 'stock:r');

// ---------- Lagerorte ----------
register('/warehouses', async () => {
  const d = await api.get('/warehouses');
  const edit = (w) => formDialog({ title: w ? 'Lager bearbeiten' : 'Neues Lager', values: w || { active: true }, fields: [{ name: 'name', label: 'Name', required: true, maxlength: 120 }, { name: 'code', label: 'Kürzel', required: true, maxlength: 20, help: 'wird in Tabellen angezeigt' }, { name: 'address', label: 'Adresse', maxlength: 300, wide: true }, w ? { name: 'active', label: 'Aktiv', type: 'checkbox' } : null, w && !w.is_default ? { name: 'is_default', label: 'Als Standardlager verwenden', type: 'checkbox' } : null].filter(Boolean),
    onSubmit: async (v) => { if (w) await api.put(`/warehouses/${w.id}`, v); else await api.post('/warehouses', v); toast('Gespeichert'); document.dispatchEvent(new Event('erp:refresh')); } });
  return page({ title: 'Lagerorte', subtitle: 'Mehrere Lager mit getrenntem Bestand', actions: can('stock:w') ? [btn('Neues Lager', () => edit(null), 'primary', 'plus')] : [] },
    table({ rows: d.rows, empty: 'Keine Lager.', columns: [{ key: 'code', label: 'Kürzel' }, { key: 'name', label: 'Name' }, { key: 'address', label: 'Adresse' }, { label: 'Status', render: (w) => h('span', null, w.is_default ? h('span', { class: 'badge blue' }, 'Standard') : null, w.active ? null : h('span', { class: 'badge gray' }, 'inaktiv')) }, ...(can('stock:w') ? [{ label: '', render: (w) => btn('Bearbeiten', () => edit(w), 'small', 'edit') }] : [])] }));
}, 'stock:r');

// ---------- Inventur ----------
register('/inventory', async () => {
  const [d, whs] = await Promise.all([api.get('/inventory'), api.get('/warehouses')]);
  const start = () => formDialog({ title: 'Neue Inventur', intro: 'Es wird eine Zählliste mit dem aktuellen Sollbestand aller Artikel des Lagers erstellt.', fields: [{ name: 'warehouse_id', label: 'Lager', type: 'select', options: whs.rows.filter((w) => w.active).map((w) => [w.id, w.name]), wide: true }], submitLabel: 'Zählliste erstellen',
    onSubmit: async (v) => { const r = await api.post('/inventory', { warehouse_id: Number(v.warehouse_id) }); navigate(`/inventory/${r.id}`); } });
  return page({ title: 'Inventur', subtitle: 'Bestand zählen und Differenzen automatisch verbuchen', actions: can('stock:w') ? [btn('Neue Inventur', start, 'primary', 'plus')] : [] },
    table({ rows: d.rows, empty: 'Noch keine Inventur.', onRow: (r) => navigate(`/inventory/${r.id}`), columns: [{ label: 'Nr.', render: (r) => h('a', { href: `#/inventory/${r.id}` }, r.number) }, { key: 'warehouse', label: 'Lager' }, { label: 'Gestartet', render: (r) => dateTimeDE(r.created_at) }, { label: 'Status', render: (r) => badge('inventory', r.status) }, { label: 'Gezählt', align: 'right', render: (r) => `${r.counted} / ${r.lines}` }] }));
}, 'stock:r');

register('/inventory/:id', async ({ params }) => {
  const d = await api.get(`/inventory/${params.id}`);
  const open = d.item.status === 'open';
  const inputs = new Map();
  const rows = d.lines.map((l) => {
    const inp = h('input', { type: 'text', inputmode: 'decimal', class: 'qty-input', value: l.counted ?? '', disabled: !open || !can('stock:w'), 'aria-label': `Gezählt: ${l.name}` });
    inputs.set(l.id, inp);
    const diff = h('span');
    const show = () => { const v = inp.value.trim().replace(',', '.'); const dv = v === '' ? null : Number(v) - l.expected; diff.className = dv < 0 ? 'neg' : dv > 0 ? 'pos' : ''; diff.textContent = dv === null || Number.isNaN(dv) ? '' : `${dv > 0 ? '+' : ''}${num(dv)}`; };
    inp.addEventListener('input', show);
    show();
    return { ...l, inp, diff };
  });
  const collect = () => rows.map((r) => ({ id: r.id, counted: r.inp.value.trim() === '' ? null : r.inp.value.trim().replace(',', '.') }));
  const actions = open && can('stock:w') ? [
    btn('Zwischenstand speichern', () => guard(async () => { await api.put(`/inventory/${d.item.id}`, { lines: collect() }); toast('Gespeichert'); }), '', 'check'),
    btn('Abschließen und Differenzen buchen', async () => { if (await confirmDialog({ title: 'Inventur abschließen?', message: 'Für alle gezählten Artikel wird der Bestand auf die gezählte Menge gesetzt. Nicht gezählte Zeilen bleiben unverändert.', confirmLabel: 'Abschließen' })) guard(async () => { await api.put(`/inventory/${d.item.id}`, { lines: collect() }); const r = await api.post(`/inventory/${d.item.id}/finish`); toast(`Inventur abgeschlossen, ${r.differences} Differenz(en) gebucht`); document.dispatchEvent(new Event('erp:refresh')); }); }, 'primary', 'check'),
    btn('Verwerfen', async () => { if (await confirmDialog({ title: 'Inventur verwerfen?', message: 'Die Zählliste wird gelöscht.', confirmLabel: 'Verwerfen', danger: true })) guard(async () => { await api.del(`/inventory/${d.item.id}`); navigate('/inventory'); }); }, 'danger', 'trash')] : [btn('Drucken', () => window.print(), '', 'print')];
  return page({ title: `Inventur ${d.item.number}`, subtitle: `${d.item.warehouse} · ${open ? 'läuft' : 'abgeschlossen'}`, back: ['#/inventory', 'Inventuren'], actions },
    table({ rows, columns: [{ key: 'sku', label: 'Nr.' }, { key: 'name', label: 'Artikel' }, { label: 'Soll', align: 'right', render: (r) => `${num(r.expected)} ${r.unit}` }, { label: 'Gezählt', align: 'right', render: (r) => r.inp }, { label: 'Differenz', align: 'right', render: (r) => r.diff }] }));
}, 'stock:r');
