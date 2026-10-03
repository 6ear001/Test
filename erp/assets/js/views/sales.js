// Verkauf: Listen, Belegeditor, Belegansicht mit Aktionen (liefern, abrechnen, bezahlen, gutschreiben), Druckansicht.
import { api, qs } from '../api.js';
import { register, state, can, navigate } from '../core.js';
import { linesEditor } from './editor.js';
import { defaultAccount, followMethod, h, page, card, kpi, table, badge, btn, kv, lines as textLines, formDialog, form, dialog, confirmDialog, guard, toast, eur, num, pct, dateDE, todayISO, addDaysISO, statusOptions, DOC_TYPES, KIND_OF_TYPE, icon, combo, parseMoney, parseNum, moneyText, lineNet, calcTotals, errMsg } from '../ui.js';

const TYPE = { quotes: 'quote', orders: 'order', deliveries: 'delivery', invoices: 'invoice', 'credit-notes': 'credit_note' };
const TITLES = { quote: ['Angebote', 'Angebot'], order: ['Aufträge', 'Auftrag'], delivery: ['Lieferscheine', 'Lieferschein'], invoice: ['Rechnungen', 'Rechnung'], credit_note: ['Gutschriften', 'Gutschrift'] };
const SUBTITLES = { quote: 'Angebote erstellen, versenden und in Aufträge übernehmen', order: 'Aufträge liefern und abrechnen – offene Mengen sind im Lager reserviert', delivery: 'Lieferscheine entstehen beim Liefern aus einem Auftrag und buchen die Ware aus dem Lager', invoice: 'Rechnungen ausstellen, Zahlungen erfassen, Gutschriften schreiben', credit_note: 'Gutschriften entstehen aus ausgestellten Rechnungen' };
const METHODS = [['bank', 'Überweisung'], ['cash', 'Bar'], ['card', 'Karte'], ['paypal', 'PayPal'], ['other', 'Sonstige']];
const TAX = [[19, '19 %'], [7, '7 %'], [0, '0 %']];
const NEW_LABEL = { quote: 'Neues Angebot', order: 'Neuer Auftrag', invoice: 'Neue Rechnung' };
const refresh = () => document.dispatchEvent(new Event('erp:refresh'));
const docLink = (type, d) => h('a', { href: `#/sales/${KIND_OF_TYPE[type]}/${d.id}` }, `${DOC_TYPES[type]} ${d.number || '(Entwurf)'}`);

// ---------- Listen ----------
register('/sales/:kind', async ({ params, query }) => {
  const type = TYPE[params.kind];
  if (!type) throw new Error('Unbekannte Belegart');
  const [titles, one] = TITLES[type];
  const wrap = h('div');
  const search = h('input', { type: 'search', class: 'search', placeholder: 'Nummer, Kunde oder Referenz …', 'aria-label': 'Suchen' });
  const status = h('select', { 'aria-label': 'Status' }, [['', 'Alle Status'], ...statusOptions(type)].map(([v, l]) => h('option', { value: v }, l)));
  const overdue = type === 'invoice' ? h('label', { class: 'check inline' }, h('input', { type: 'checkbox', checked: query.overdue === '1' }), 'nur überfällige') : null;
  const load = async () => {
    const d = await api.get(`/sales/${params.kind}${qs({ q: search.value, status: status.value, customer_id: query.customer_id, overdue: overdue?.firstChild.checked ? 1 : '', limit: 500 })}`);
    const cols = [
      { label: 'Nr.', sort: (r) => r.number || '', csv: (r) => r.number || 'Entwurf', render: (r) => h('a', { href: `#/sales/${params.kind}/${r.id}` }, r.number || '(Entwurf)') },
      { label: 'Kunde', render: (r) => h('a', { href: `#/customers/${r.customer_id}` }, r.customer), csv: (r) => r.customer },
      { label: 'Datum', sort: (r) => r.date, render: (r) => dateDE(r.date), csv: (r) => r.date },
      ...(type === 'invoice' ? [{ label: 'Fällig', sort: (r) => r.due_date || '', render: (r) => (r.due_date ? h('span', { class: ['open', 'partial'].includes(r.status) && r.due_date < todayISO() ? 'neg' : '' }, dateDE(r.due_date)) : ''), csv: (r) => r.due_date || '' }] : []),
      ...(type === 'quote' ? [{ label: 'Gültig bis', render: (r) => dateDE(r.valid_until), csv: (r) => r.valid_until || '' }] : []),
      { label: 'Status', sort: (r) => r.status, render: (r) => badge(type, r.status), csv: (r) => r.status },
      ...(type !== 'delivery' ? [{ label: 'Netto', align: 'right', sort: (r) => r.net_cents, render: (r) => eur(r.net_cents), csv: (r) => r.net_cents / 100 }, { label: 'Brutto', align: 'right', sort: (r) => r.gross_cents, render: (r) => eur(r.gross_cents), csv: (r) => r.gross_cents / 100 }] : []),
      ...(type === 'invoice' ? [{ label: 'Offen', align: 'right', sort: (r) => r.gross_cents - r.paid_cents - r.credited_cents, render: (r) => (['open', 'partial'].includes(r.status) ? h('strong', { class: 'neg' }, eur(r.gross_cents - r.paid_cents - r.credited_cents)) : ''), csv: (r) => (['open', 'partial'].includes(r.status) ? (r.gross_cents - r.paid_cents - r.credited_cents) / 100 : 0) }] : []),
      { label: 'Bezug', render: (r) => r.parent_number || '', csv: (r) => r.parent_number || '' },
    ];
    const live = d.rows.filter((r) => r.status !== 'cancelled' && r.status !== 'draft' && r.status !== 'rejected');
    wrap.replaceChildren(
      table({ columns: cols, rows: d.rows, onRow: (r) => navigate(`/sales/${params.kind}/${r.id}`), exportName: params.kind, empty: `Keine ${titles} gefunden.` }),
      type !== 'delivery' ? h('p', { class: 'muted small' }, `${d.rows.length} ${titles} · Summe brutto (ohne Entwürfe/Stornos): ${eur(live.reduce((s, r) => s + r.gross_cents, 0))}${type === 'invoice' ? ` · davon offen: ${eur(live.filter((r) => ['open', 'partial'].includes(r.status)).reduce((s, r) => s + r.gross_cents - r.paid_cents - r.credited_cents, 0))}` : ''}`) : null);
  };
  let t;
  search.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => guard(load), 250); });
  status.addEventListener('change', () => guard(load));
  overdue?.firstChild.addEventListener('change', () => guard(load));
  await load();
  return page({ title: titles, subtitle: SUBTITLES[type], actions: ['quote', 'order', 'invoice'].includes(type) && can('sales:w') ? [btn(NEW_LABEL[type], () => navigate(`/sales/${params.kind}/new${query.customer_id ? `?customer=${query.customer_id}` : ''}`), 'primary', 'plus')] : [] },
    h('div', { class: 'filters' }, search, status, overdue), wrap);
}, 'sales:r');

// ---------- Editor ----------
async function editorPage({ kind, type, id, query }) {
  const existing = id ? await api.get(`/sales/${kind}/${id}`) : null;
  if (existing && !['draft', 'sent', 'open'].includes(existing.status)) throw new Error('Dieser Beleg kann nicht mehr bearbeitet werden.');
  const [titles, one] = TITLES[type];
  let customer = existing?.customer || null;
  let discount = 0;
  const custId = existing?.customer_id || Number(query.customer) || 0;
  const whs = can('stock:r') ? (await api.get('/warehouses')).rows.filter((w) => w.active) : [];
  if (custId && !customer) customer = (await api.get(`/customers/${custId}`)).item;
  if (customer?.id) discount = (await api.get(`/customers/${customer.id}`).catch(() => ({ item: {} }))).item.discount_pct || 0;
  const defaultDays = type === 'quote' ? 30 : 0;
  const fields = [
    { name: 'date', label: 'Datum', type: 'date', required: true },
    type === 'quote' ? { name: 'valid_until', label: 'Gültig bis', type: 'date' } : null,
    { name: 'reference', label: 'Ihre Referenz / Bestellnummer', maxlength: 200 },
    type === 'invoice' ? { name: 'warehouse_id', label: 'Lager für Warenausgang', type: 'select', options: [['', '– nicht nötig –'], ...whs.map((w) => [w.id, w.name])], help: 'Nur bei Direktrechnung ohne Auftrag: Ware wird beim Ausstellen aus diesem Lager gebucht.' } : null,
    { name: 'bill_to', label: 'Rechnungsadresse', type: 'textarea', rows: 4, maxlength: 500 },
    type !== 'quote' ? { name: 'ship_to', label: 'Lieferadresse', type: 'textarea', rows: 4, maxlength: 500 } : null,
    { name: 'notes', label: 'Bemerkung (erscheint auf dem Beleg)', type: 'textarea', wide: true, maxlength: 2000 },
  ].filter(Boolean);
  const f = form(fields, { date: existing?.date || todayISO(), valid_until: existing?.valid_until || (defaultDays ? addDaysISO(todayISO(), defaultDays) : ''), reference: existing?.reference || '', warehouse_id: existing?.warehouse_id || '', bill_to: existing?.bill_to || '', ship_to: existing?.ship_to || '', notes: existing?.notes || '' });
  const custBox = h('div', { class: 'customer-pick' });
  const showCustomer = () => custBox.replaceChildren(customer
    ? h('div', { class: 'chosen' }, h('div', null, h('strong', null, customer.name), h('small', { class: 'muted' }, ` Kunden-Nr. ${customer.number || ''}`)), btn('Ändern', () => { customer = null; showCustomer(); }, 'small'))
    : (() => { const c = combo({ placeholder: 'Kunde suchen (Name, Nummer, Ort) …', search: (q) => api.get(`/customers${qs({ q, limit: 8 })}`).then((r) => r.rows.filter((x) => x.status !== 'inactive')), label: (c) => h('span', null, h('strong', null, c.name), h('small', { class: 'muted' }, ` ${c.number} · ${c.city || ''}`)),
      onPick: async (c) => { const full = (await api.get(`/customers/${c.id}`)).item; customer = full; discount = full.discount_pct || 0; const addr = [full.name, full.street, [full.zip, full.city].filter(Boolean).join(' '), full.country !== 'DE' ? full.country : ''].filter(Boolean).join('\n'); f.set('bill_to', addr); if (f.input('ship_to')) f.set('ship_to', addr); showCustomer(); } }); setTimeout(() => c.input.focus(), 0); return c.el; })());
  showCustomer();
  const ed = linesEditor(existing?.lines || [], { defaultDiscount: () => discount });
  const err = h('p', { class: 'form-error', role: 'alert', hidden: true });
  const save = async (e) => {
    err.hidden = true; e.currentTarget.disabled = true;
    try {
      if (!customer) throw new Error('Bitte einen Kunden wählen');
      const v = f.get();
      const body = { customer_id: customer.id, date: v.date, valid_until: v.valid_until || undefined, reference: v.reference, warehouse_id: v.warehouse_id ? Number(v.warehouse_id) : 0, bill_to: v.bill_to, ship_to: v.ship_to, notes: v.notes, lines: ed.get() };
      const r = existing ? (await api.put(`/sales/${kind}/${id}`, body), { id }) : await api.post(`/sales/${kind}`, body);
      toast(`${one} gespeichert`);
      navigate(`/sales/${kind}/${r.id}`);
    } catch (ex) { err.textContent = ex.message || errMsg(ex); err.hidden = false; e.currentTarget.disabled = false; }
  };
  return page({ title: existing ? `${one} ${existing.number || '(Entwurf)'} bearbeiten` : NEW_LABEL[type], back: [existing ? `#/sales/${kind}/${id}` : `#/sales/${kind}`, existing ? 'Zurück zum Beleg' : titles] },
    card('Kunde', custBox), card('Details', f.el), card('Positionen', ed.el), err,
    h('div', { class: 'form-actions' }, btn('Abbrechen', () => history.back()), btn('Speichern', save, 'primary')));
}
register('/sales/:kind/new', ({ params, query }) => { const type = TYPE[params.kind]; if (!['quote', 'order', 'invoice'].includes(type)) throw new Error('Dieser Beleg wird aus einem anderen Beleg erzeugt.'); return editorPage({ kind: params.kind, type, query }); }, 'sales:w');
register('/sales/:kind/:id/edit', ({ params, query }) => editorPage({ kind: params.kind, type: TYPE[params.kind], id: params.id, query }), 'sales:w');

// ---------- Dialoge zu Belegen ----------
async function payDialog(inv) {
  const accounts = (await api.get('/accounting/finance-accounts')).rows.filter((a) => a.active);
  const dlg = formDialog({ title: `Zahlung erfassen · ${inv.number}`, intro: `Offen: ${eur(inv.open_cents)}`, submitLabel: 'Zahlung buchen',
    fields: [{ name: 'amount_cents', label: 'Betrag (€)', type: 'money', required: true }, { name: 'date', label: 'Zahldatum', type: 'date', required: true }, { name: 'method', label: 'Zahlungsart', type: 'select', options: METHODS }, { name: 'account_id', label: 'Eingang auf Konto', type: 'select', options: accounts.map((a) => [a.id, `${a.number} ${a.name}`]) }, { name: 'reference', label: 'Verwendungszweck', wide: true, maxlength: 200 }],
    values: { amount_cents: inv.open_cents, date: todayISO(), method: 'bank', account_id: defaultAccount(accounts, 'bank') },
    onSubmit: async (v) => { await api.post(`/sales/invoices/${inv.id}/payments`, { ...v, account_id: Number(v.account_id) }); toast('Zahlung gebucht'); refresh(); } });
  followMethod(dlg.form, accounts);
}
async function deliverDialog(order) {
  const [whs, carriers] = await Promise.all([api.get('/warehouses').then((r) => r.rows.filter((w) => w.active)), can('logistics:r') ? api.get('/logistics/carriers').then((r) => r.rows.filter((c) => c.active)) : { rows: [] }.rows]);
  const open = order.lines.filter((l) => l.track_stock && l.qty - l.qty_delivered > 1e-6);
  if (!open.length) { toast('Es gibt nichts zu liefern (nur Waren mit Bestandsführung werden geliefert).', 'error'); return; }
  const wh = h('select', { 'aria-label': 'Lager' }, whs.map((w) => h('option', { value: w.id }, w.name)));
  const inputs = open.map((l) => ({ l, el: h('input', { type: 'text', inputmode: 'decimal', class: 'narrow', value: num(l.qty - l.qty_delivered).replace(/\./g, ''), 'aria-label': `Menge ${l.description}` }) }));
  const ship = h('input', { type: 'checkbox', id: 'mkship', checked: can('logistics:w') });
  const carrier = h('select', { 'aria-label': 'Frachtführer' }, [h('option', { value: '' }, '– später wählen –'), ...carriers.map((c) => h('option', { value: c.id }, c.name))]);
  const tracking = h('input', { type: 'text', placeholder: 'Sendungsnummer (optional)', maxlength: 80, 'aria-label': 'Sendungsnummer' });
  const err = h('p', { class: 'form-error', role: 'alert', hidden: true });
  const body = h('div', null, h('p', { class: 'muted' }, 'Wählen Sie das Lager und die Mengen, die jetzt geliefert werden. Die Ware wird aus dem Bestand gebucht.'),
    h('div', { class: 'field' }, h('label', null, 'Lager'), wh),
    table({ columns: [{ key: 'description', label: 'Artikel', render: (r) => r.l.description }, { label: 'Offen', align: 'right', render: (r) => `${num(r.l.qty - r.l.qty_delivered)} ${r.l.unit}` }, { label: 'Jetzt liefern', align: 'right', render: (r) => r.el }], rows: inputs }),
    can('logistics:w') ? h('div', { class: 'stack' }, h('label', { class: 'check', for: 'mkship' }, ship, 'Sendung anlegen'), carrier, tracking) : null, err);
  const d = dialog({ title: `Liefern · ${order.number}`, body, wide: true, actions: [btn('Abbrechen', () => d.close()), btn('Lieferschein erstellen', async (e) => {
    err.hidden = true; e.currentTarget.disabled = true;
    try {
      const lines = inputs.map(({ l, el }) => ({ line_id: l.id, qty: parseNum(el.value) || 0 })).filter((x) => x.qty > 0);
      const r = await api.post(`/sales/orders/${order.id}/deliver`, { warehouse_id: Number(wh.value), lines, create_shipment: ship.checked, carrier_id: carrier.value ? Number(carrier.value) : 0, tracking_no: tracking.value.trim() || undefined });
      d.close(); toast(`Lieferschein ${r.number} erstellt`); navigate(`/sales/deliveries/${r.id}`);
    } catch (ex) { err.textContent = ex.message || errMsg(ex); err.hidden = false; e.currentTarget.disabled = false; }
  }, 'primary')] });
}
async function creditDialog(inv) {
  const whs = can('stock:r') ? (await api.get('/warehouses')).rows.filter((w) => w.active) : [];
  const rows = inv.lines.filter((l) => l.qty - l.qty_credited > 1e-6).map((l) => ({ l, max: l.qty - l.qty_credited, el: h('input', { type: 'text', inputmode: 'decimal', class: 'narrow', value: '0', 'aria-label': `Gutschrift-Menge ${l.description}` }) }));
  const reason = h('input', { type: 'text', maxlength: 300, placeholder: 'z. B. Retoure, Preisnachlass', 'aria-label': 'Grund' });
  const restock = h('select', { 'aria-label': 'Ware zurück ins Lager' }, [h('option', { value: '' }, 'Ware nicht zurück einlagern'), ...whs.map((w) => h('option', { value: w.id }, `Zurück ins Lager: ${w.name}`))]);
  const err = h('p', { class: 'form-error', role: 'alert', hidden: true });
  const body = h('div', null, h('p', { class: 'muted' }, 'Mengen eintragen, die gutgeschrieben werden. Die Gutschrift mindert Umsatz und Forderung.'),
    table({ columns: [{ label: 'Position', render: (r) => r.l.description }, { label: 'Berechnet', align: 'right', render: (r) => num(r.l.qty) }, { label: 'Bereits gutgeschrieben', align: 'right', render: (r) => num(r.l.qty_credited) }, { label: 'Gutschreiben', align: 'right', render: (r) => r.el }], rows }),
    h('div', { class: 'stack' }, btn('Alles gutschreiben', () => rows.forEach((r) => { r.el.value = num(r.max).replace(/\./g, ''); }), 'small'), reason, whs.length ? restock : null), err);
  const d = dialog({ title: `Gutschrift zu ${inv.number}`, body, wide: true, actions: [btn('Abbrechen', () => d.close()), btn('Gutschrift ausstellen', async (e) => {
    err.hidden = true; e.currentTarget.disabled = true;
    try {
      const lines = rows.map((r) => ({ line_id: r.l.id, qty: parseNum(r.el.value) || 0 })).filter((x) => x.qty > 0);
      if (!lines.length) throw new Error('Bitte mindestens eine Menge eintragen');
      const r = await api.post(`/sales/invoices/${inv.id}/credit-note`, { lines, reason: reason.value.trim() || undefined, restock_warehouse_id: restock.value ? Number(restock.value) : 0 });
      d.close(); toast(`Gutschrift ${r.number} ausgestellt`); navigate(`/sales/credit-notes/${r.id}`);
    } catch (ex) { err.textContent = ex.message || errMsg(ex); err.hidden = false; e.currentTarget.disabled = false; }
  }, 'primary')] });
}

// ---------- Belegansicht ----------
register('/sales/:kind/:id', async ({ params }) => {
  const type = TYPE[params.kind];
  if (!type) throw new Error('Unbekannte Belegart');
  const d = await api.get(`/sales/${params.kind}/${params.id}`);
  const [titles] = TITLES[type];
  const W = can('sales:w');
  const a = [];
  const doit = (path, body, msg) => guard(async () => { const r = await api.post(path, body || {}); if (msg) toast(msg); return r; });
  const kind = params.kind;
  if (type === 'quote' && W && d.status !== 'converted') {
    if (['draft', 'sent'].includes(d.status)) a.push(btn('Bearbeiten', () => navigate(`/sales/quotes/${d.id}/edit`), '', 'edit'));
    if (d.status === 'draft') a.push(btn('Als gesendet markieren', async () => { await doit(`/sales/quotes/${d.id}/status`, { status: 'sent' }, 'Status geändert'); refresh(); }));
    if (['draft', 'sent'].includes(d.status)) a.push(btn('Angenommen', async () => { await doit(`/sales/quotes/${d.id}/status`, { status: 'accepted' }, 'Status geändert'); refresh(); }), btn('Abgelehnt', async () => { await doit(`/sales/quotes/${d.id}/status`, { status: 'rejected' }, 'Status geändert'); refresh(); }));
    if (d.status !== 'rejected') a.push(btn('In Auftrag übernehmen', async () => { const r = await doit(`/sales/quotes/${d.id}/convert`, {}, 'Auftrag erstellt'); if (r) navigate(`/sales/orders/${r.id}`); }, 'primary', 'cart'));
  }
  if (type === 'order' && d.status !== 'cancelled') {
    if (W && d.status === 'open' && !d.children.length) a.push(btn('Bearbeiten', () => navigate(`/sales/orders/${d.id}/edit`), '', 'edit'));
    if (can('stock:w') && ['open', 'partial'].includes(d.status) && d.lines.some((l) => l.track_stock && l.qty - l.qty_delivered > 1e-6)) a.push(btn('Liefern …', () => deliverDialog(d), 'primary', 'truck'));
    if (W && d.status !== 'completed') a.push(btn('Rechnung erstellen', async () => { const r = await doit(`/sales/orders/${d.id}/invoice`, {}, 'Rechnungsentwurf erstellt'); if (r) navigate(`/sales/invoices/${r.id}`); }, d.lines.every((l) => !l.track_stock || l.qty_delivered >= l.qty) ? 'primary' : '', 'euro'));
    if (W && !d.children.some((c) => c.status !== 'cancelled')) a.push(btn('Stornieren', async () => { if (await confirmDialog({ title: 'Auftrag stornieren?', message: `${d.number} wird storniert und die Reservierung im Lager aufgehoben.`, confirmLabel: 'Stornieren', danger: true })) { await doit(`/sales/orders/${d.id}/cancel`, {}, 'Auftrag storniert'); refresh(); } }, 'danger'));
  }
  if (type === 'delivery' && d.status === 'delivered') {
    if (can('logistics:w') && !d.shipments.length) a.push(btn('Sendung anlegen', async () => { const carriers = (await api.get('/logistics/carriers')).rows.filter((c) => c.active); formDialog({ title: 'Sendung anlegen', fields: [{ name: 'carrier_id', label: 'Frachtführer', type: 'select', options: [['', '– später wählen –'], ...carriers.map((c) => [c.id, c.name])] }, { name: 'tracking_no', label: 'Sendungsnummer', maxlength: 80 }], onSubmit: async (v) => { const r = await api.post('/logistics/shipments', { direction: 'outbound', delivery_id: d.id, carrier_id: v.carrier_id ? Number(v.carrier_id) : 0, tracking_no: v.tracking_no || undefined }); navigate(`/logistics/shipments/${r.id}`); } }); }, 'primary', 'truck'));
    if (can('stock:w')) a.push(btn('Stornieren', async () => { if (await confirmDialog({ title: 'Lieferschein stornieren?', message: 'Die Ware wird ins Lager zurückgebucht.', confirmLabel: 'Stornieren', danger: true })) { await doit(`/sales/deliveries/${d.id}/cancel`, {}, 'Lieferschein storniert'); refresh(); } }, 'danger'));
  }
  if (type === 'invoice') {
    if (d.status === 'draft' && W) {
      a.push(btn('Bearbeiten', () => navigate(`/sales/invoices/${d.id}/edit`), '', 'edit'),
        btn('Ausstellen', () => formDialog({ title: 'Rechnung ausstellen', intro: 'Die Rechnung erhält ihre fortlaufende Nummer und wird gebucht. Danach kann sie nicht mehr geändert werden – Korrekturen erfolgen über eine Gutschrift.', fields: [{ name: 'date', label: 'Rechnungsdatum', type: 'date', required: true }], values: { date: d.date || todayISO() }, submitLabel: 'Jetzt ausstellen',
          onSubmit: async (v) => { const r = await api.post(`/sales/invoices/${d.id}/issue`, { date: v.date }); toast(`Rechnung ${r.number} ausgestellt`); refresh(); } }), 'primary', 'check'),
        btn('Löschen', async () => { if (await confirmDialog({ title: 'Entwurf löschen?', message: 'Der Rechnungsentwurf wird gelöscht.', confirmLabel: 'Löschen', danger: true })) guard(async () => { await api.del(`/sales/invoices/${d.id}`); toast('Gelöscht'); navigate('/sales/invoices'); }); }, 'danger', 'trash'));
    }
    if (['open', 'partial'].includes(d.status) && can('accounting:w')) a.push(btn('Zahlung erfassen', () => guard(() => payDialog(d)), 'primary', 'euro'));
    if (['open', 'partial', 'paid'].includes(d.status) && W) a.push(btn('Gutschrift …', () => creditDialog(d), '', 'doc'));
  }
  if (d.status !== 'draft' || type !== 'invoice') a.push(btn('Drucken / PDF', () => navigate(`/print/sales/${kind}/${d.id}`), '', 'print'));
  else a.push(btn('Vorschau', () => navigate(`/print/sales/${kind}/${d.id}`), '', 'print'));

  const showPrices = type !== 'delivery';
  const prog = type === 'order';
  const totalsCard = showPrices ? card('Summen', h('div', { class: 'totals wide' },
    h('div', null, h('span', null, 'Netto'), h('strong', null, eur(d.net_cents))),
    ...d.totals.byRate.map((g) => h('div', null, h('span', null, `MwSt ${g.rate} % auf ${eur(g.net_cents)}`), h('span', null, eur(g.tax_cents)))),
    h('div', { class: 'grand' }, h('span', null, 'Brutto'), h('strong', null, eur(d.gross_cents))),
    type === 'invoice' && d.status !== 'draft' ? [h('div', null, h('span', null, 'Bezahlt'), h('span', null, eur(d.paid_cents))), d.credited_cents ? h('div', null, h('span', null, 'Gutgeschrieben'), h('span', null, eur(d.credited_cents))) : null, h('div', { class: 'grand' }, h('span', null, 'Offen'), h('strong', { class: d.open_cents > 0 ? 'neg' : 'pos' }, eur(d.open_cents)))] : null)) : null;
  const lineCols = [{ label: 'Pos.', render: (l) => l.position }, { label: 'Beschreibung', render: (l) => h('span', null, l.sku ? h('small', { class: 'muted' }, `${l.sku} · `) : null, l.description) }, { label: 'Menge', align: 'right', render: (l) => `${num(l.qty)} ${l.unit}` },
    ...(prog ? [{ label: 'Geliefert', align: 'right', render: (l) => (l.track_stock ? num(l.qty_delivered) : '–') }, { label: 'Berechnet', align: 'right', render: (l) => num(l.qty_invoiced) }] : []),
    ...(type === 'invoice' && d.lines.some((l) => l.qty_credited) ? [{ label: 'Gutgeschrieben', align: 'right', render: (l) => (l.qty_credited ? num(l.qty_credited) : '') }] : []),
    ...(showPrices ? [{ label: 'Einzelpreis', align: 'right', render: (l) => eur(l.price_cents) }, { label: 'Rabatt', align: 'right', render: (l) => (l.discount_pct ? pct(l.discount_pct) : '') }, { label: 'MwSt', align: 'right', render: (l) => `${l.tax_rate} %` }, { label: 'Netto', align: 'right', render: (l) => eur(l.net_cents) }] : [])];
  const payments = type === 'invoice' && d.payments.length ? card('Zahlungen', table({ columns: [{ label: 'Datum', render: (p) => dateDE(p.date) }, { label: 'Konto', render: (p) => `${p.account_number} ${p.account_name}` }, { label: 'Betrag', align: 'right', render: (p) => h('span', { class: p.reversed ? 'strike' : '' }, eur(p.amount_cents)) }, { label: 'Verwendungszweck', render: (p) => p.reference || '' }, { label: '', render: (p) => (p.reversed ? h('span', { class: 'badge gray' }, 'storniert') : can('accounting:w') ? btn('Stornieren', async () => { if (await confirmDialog({ title: 'Zahlung stornieren?', message: `Die Zahlung über ${eur(p.amount_cents)} wird per Gegenbuchung storniert.`, confirmLabel: 'Stornieren', danger: true })) guard(async () => { await api.post(`/payments/${p.id}/reverse`); toast('Zahlung storniert'); refresh(); }); }, 'small') : '') }], rows: d.payments })) : null;
  const related = [...d.children.map((c) => ({ ...c })), ...d.shipments.map((s) => ({ shipment: s }))];
  return page({ title: `${TITLES[type][1]} ${d.number || '(Entwurf)'}`, subtitle: `${d.customer.name} · ${dateDE(d.date)}`, back: [`#/sales/${kind}`, titles], actions: a },
    h('p', null, badge(type, d.status), d.type === 'invoice' && ['open', 'partial'].includes(d.status) && d.due_date && d.due_date < todayISO() ? h('span', { class: 'badge red' }, `überfällig seit ${dateDE(d.due_date)}`) : null),
    h('div', { class: 'grid-2' },
      card('Beleg', kv([['Kunde', h('a', { href: `#/customers/${d.customer.id}` }, `${d.customer.name} (${d.customer.number})`)], ['Datum', dateDE(d.date)], type === 'invoice' ? ['Fällig am', d.due_date ? dateDE(d.due_date) : 'wird beim Ausstellen berechnet'] : null, type === 'quote' ? ['Gültig bis', dateDE(d.valid_until)] : null, ['Referenz', d.reference], d.parent ? ['Bezug', docLink(d.parent.type, d.parent)] : null, d.notes ? ['Bemerkung', h('span', null, textLines(d.notes))] : null])),
      card('Adressen', h('div', { class: 'addresses' }, h('div', null, h('h3', null, 'Rechnungsadresse'), h('p', null, textLines(d.bill_to))), type !== 'quote' ? h('div', null, h('h3', null, 'Lieferadresse'), h('p', null, textLines(d.ship_to))) : null))),
    card('Positionen', table({ columns: lineCols, rows: d.lines })), totalsCard, payments,
    related.length ? card('Folgebelege und Sendungen', h('ul', { class: 'plain' }, related.map((r) => h('li', null, r.shipment ? h('a', { href: `#/logistics/shipments/${r.shipment.id}` }, `Sendung ${r.shipment.number}`) : docLink(r.type, r), ' ', r.shipment ? badge('shipment', r.shipment.status) : badge(r.type, r.status))))) : null);
}, 'sales:r');

// ---------- Druckansicht ----------
register('/print/sales/:kind/:id', async ({ params }) => {
  const type = TYPE[params.kind];
  const d = await api.get(`/sales/${params.kind}/${params.id}`);
  const co = state.company || {};
  const prices = type !== 'delivery';
  const addrLine = [co.company_name, co.street, [co.zip, co.city].filter(Boolean).join(' ')].filter(Boolean).join(' · ');
  const meta = [[`${DOC_TYPES[type]}-Nr.`, d.number || 'Entwurf'], ['Datum', dateDE(d.date)], ['Kunden-Nr.', d.customer.number], d.reference ? ['Referenz', d.reference] : null, type === 'quote' ? ['Gültig bis', dateDE(d.valid_until)] : null, type === 'invoice' && d.due_date ? ['Fällig am', dateDE(d.due_date)] : null, d.parent ? ['Bezug', d.parent.number] : null].filter(Boolean);
  const bank = [co.bank_name, co.iban ? `IBAN ${co.iban.replace(/(.{4})/g, '$1 ').trim()}` : '', co.bic ? `BIC ${co.bic}` : ''].filter(Boolean).join(' · ');
  const doc = h('article', { class: 'print-doc' },
    h('header', { class: 'pd-head' }, h('div', { class: 'pd-company' }, h('strong', null, co.company_name || state.me.tenant.name), co.street ? h('div', null, co.street) : null, h('div', null, [co.zip, co.city].filter(Boolean).join(' ')), co.phone ? h('div', null, `Tel. ${co.phone}`) : null, co.email ? h('div', null, co.email) : null)),
    h('div', { class: 'pd-addr-row' }, h('div', { class: 'pd-addr' }, h('small', null, addrLine), h('p', null, textLines(d.bill_to || d.customer.name))), h('dl', { class: 'pd-meta' }, meta.map(([k, v]) => [h('dt', null, k), h('dd', null, v)]))),
    h('h1', { class: 'pd-title' }, `${DOC_TYPES[type]}${d.number ? ` ${d.number}` : ' (Entwurf)'}`),
    type === 'delivery' && d.ship_to ? h('p', null, h('strong', null, 'Lieferadresse: '), d.ship_to.replace(/\n/g, ', ')) : null,
    h('table', { class: 'pd-table' }, h('thead', null, h('tr', null, h('th', null, 'Pos.'), h('th', null, 'Beschreibung'), h('th', { class: 'num' }, 'Menge'), prices ? [h('th', { class: 'num' }, 'Einzelpreis'), h('th', { class: 'num' }, 'Rabatt'), h('th', { class: 'num' }, 'MwSt'), h('th', { class: 'num' }, 'Netto')] : null)),
      h('tbody', null, d.lines.map((l) => h('tr', null, h('td', null, l.position), h('td', null, l.sku ? h('small', null, `${l.sku} · `) : null, l.description), h('td', { class: 'num' }, `${num(l.qty)} ${l.unit}`), prices ? [h('td', { class: 'num' }, eur(l.price_cents)), h('td', { class: 'num' }, l.discount_pct ? pct(l.discount_pct) : ''), h('td', { class: 'num' }, `${l.tax_rate} %`), h('td', { class: 'num' }, eur(l.net_cents))] : null)))),
    prices ? h('div', { class: 'pd-totals' }, h('div', null, h('span', null, type === 'credit_note' ? 'Gutschrift netto' : 'Nettobetrag'), h('span', null, eur(d.net_cents))), ...d.totals.byRate.map((g) => h('div', null, h('span', null, `Umsatzsteuer ${g.rate} % auf ${eur(g.net_cents)}`), h('span', null, eur(g.tax_cents)))), h('div', { class: 'grand' }, h('span', null, type === 'credit_note' ? 'Gutschriftbetrag' : 'Gesamtbetrag'), h('span', null, eur(d.gross_cents)))) : null,
    d.notes ? h('p', { class: 'pd-notes' }, textLines(d.notes)) : null,
    type === 'invoice' ? h('div', { class: 'pd-pay' }, h('p', null, d.due_date ? `Bitte überweisen Sie den Betrag bis zum ${dateDE(d.due_date)} unter Angabe der Rechnungsnummer ${d.number || ''}.` : 'Zahlungsbedingungen werden beim Ausstellen festgelegt.'), bank ? h('p', null, bank) : null, h('p', { class: 'small' }, 'Das Leistungsdatum entspricht dem Rechnungsdatum, sofern nicht anders angegeben.')) : null,
    type === 'quote' ? h('p', { class: 'pd-pay' }, `Dieses Angebot ist gültig bis ${dateDE(d.valid_until)}.`) : null,
    h('footer', { class: 'pd-foot' }, [co.company_name, co.managing_director ? `Geschäftsführung: ${co.managing_director}` : '', co.register, co.vat_id ? `USt-IdNr.: ${co.vat_id}` : '', co.tax_no ? `Steuernr.: ${co.tax_no}` : '', co.website].filter(Boolean).join(' · '), co.doc_footer ? h('div', null, co.doc_footer) : null));
  return h('div', { class: 'print-page' }, h('div', { class: 'print-bar no-print' }, btn('Zurück', () => history.back(), '', 'back'), btn('Drucken / als PDF speichern', () => window.print(), 'primary', 'print'),
    d.status === 'draft' ? h('span', { class: 'muted' }, 'Entwurf: Nummer und Fälligkeit werden erst beim Ausstellen vergeben.') : null,
    !co.street || !co.iban ? h('a', { href: '#/settings' }, 'Firmendaten und Bankverbindung vervollständigen') : null), doc);
}, 'sales:r');
