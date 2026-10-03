// Logistik: Sendungen mit Sendungsverfolgung (ausgehend und eingehend), Frachtführer.
import { api, qs } from '../api.js';
import { register, can, navigate } from '../core.js';
import { h, page, card, kpi, table, badge, btn, kv, lines as textLines, formDialog, form, guard, toast, eur, num, dateDE, dateTimeDE, todayISO, statusOptions, statusLabel, tabs, errMsg } from '../ui.js';

const refresh = () => document.dispatchEvent(new Event('erp:refresh'));
const DIRECTION = { outbound: 'Ausgehend', inbound: 'Eingehend' };

const shipmentFields = (carriers, withParty) => [
  withParty ? { name: 'direction', label: 'Richtung', type: 'select', options: [['outbound', 'Ausgehend (an Kunden)'], ['inbound', 'Eingehend (von Lieferanten)']] } : null,
  withParty ? { name: 'party_name', label: 'Empfänger / Absender', required: true, maxlength: 200 } : null,
  withParty ? { name: 'address', label: 'Adresse', type: 'textarea', rows: 3, wide: true, maxlength: 500 } : null,
  { name: 'carrier_id', label: 'Frachtführer', type: 'select', options: [['', '– keiner –'], ...carriers.map((c) => [c.id, c.name])] }, { name: 'tracking_no', label: 'Sendungsnummer', maxlength: 80 },
  { name: 'ship_date', label: 'Versanddatum', type: 'date' }, { name: 'eta', label: 'Voraussichtliche Ankunft', type: 'date' },
  { name: 'packages', label: 'Pakete', type: 'number', empty: 1 }, { name: 'weight_g', label: 'Gewicht (g)', type: 'number' }, { name: 'cost_cents', label: 'Frachtkosten (€)', type: 'money' },
  { name: 'notes', label: 'Notizen', type: 'textarea', rows: 2, wide: true, maxlength: 500 },
].filter(Boolean);
const clean = (v) => ({ ...v, carrier_id: v.carrier_id ? Number(v.carrier_id) : 0, ship_date: v.ship_date || undefined, eta: v.eta || undefined });

register('/logistics/shipments', async ({ query }) => {
  const filter = query.status || 'active';
  const d = await api.get(`/logistics/shipments${qs({ status: filter, direction: query.direction, limit: 500 })}`);
  const c = d.counts;
  const active = ['planned', 'packed', 'shipped', 'in_transit', 'problem'].reduce((s, k) => s + (c[k] || 0), 0);
  const tabItems = [['active', `Aktiv (${active})`, '#/logistics/shipments'], ['planned', `Geplant (${c.planned || 0})`, '#/logistics/shipments?status=planned'], ['in_transit', `Unterwegs (${(c.shipped || 0) + (c.in_transit || 0)})`, '#/logistics/shipments?status=shipped'], ['problem', `Probleme (${c.problem || 0})`, '#/logistics/shipments?status=problem'], ['delivered', `Zugestellt (${c.delivered || 0})`, '#/logistics/shipments?status=delivered'], ['all', 'Alle', '#/logistics/shipments?status=']];
  const carriers = can('logistics:w') ? (await api.get('/logistics/carriers')).rows.filter((x) => x.active) : [];
  const late = d.rows.filter((r) => r.late).length;
  return page({ title: 'Sendungen', subtitle: 'Versand an Kunden und erwartete Lieferungen mit Sendungsverfolgung', actions: can('logistics:w') ? [btn('Neue Sendung', () => navigate('/logistics/shipments/new'), 'primary', 'plus')] : [] },
    late ? h('div', { class: 'notice warn' }, `${late} Sendung(en) sind überfällig (voraussichtliche Ankunft überschritten).`) : null,
    tabs(tabItems, filter === 'shipped' ? 'in_transit' : filter),
    table({ rows: d.rows, exportName: 'sendungen', empty: 'Keine Sendungen in dieser Ansicht.', onRow: (r) => navigate(`/logistics/shipments/${r.id}`), rowClass: (r) => (r.late || r.status === 'problem' ? 'warnrow' : ''), columns: [
      { label: 'Nr.', sort: (r) => r.number, render: (r) => h('a', { href: `#/logistics/shipments/${r.id}` }, r.number), csv: (r) => r.number }, { label: 'Richtung', render: (r) => DIRECTION[r.direction], csv: (r) => DIRECTION[r.direction] }, { key: 'party_name', label: 'Empfänger / Absender' },
      { label: 'Beleg', render: (r) => r.delivery_number || r.po_number || '', csv: (r) => r.delivery_number || r.po_number || '' }, { key: 'carrier', label: 'Frachtführer' },
      { label: 'Sendungsnummer', render: (r) => (r.track_link ? h('a', { href: r.track_link, target: '_blank', rel: 'noopener noreferrer' }, r.tracking_no) : r.tracking_no || ''), csv: (r) => r.tracking_no || '' },
      { label: 'Status', sort: (r) => r.status, render: (r) => badge('shipment', r.status), csv: (r) => statusLabel('shipment', r.status) }, { label: 'Ankunft (erw.)', sort: (r) => r.eta || '', render: (r) => h('span', { class: r.late ? 'neg' : '' }, dateDE(r.eta)), csv: (r) => r.eta || '' }, { label: 'Kosten', align: 'right', render: (r) => (r.cost_cents ? eur(r.cost_cents) : ''), csv: (r) => r.cost_cents / 100 }] }));
}, 'logistics:r');

register('/logistics/shipments/new', async () => {
  const carriers = (await api.get('/logistics/carriers')).rows.filter((x) => x.active);
  const f = form(shipmentFields(carriers, true), { direction: 'outbound', packages: 1 });
  const err = h('p', { class: 'form-error', role: 'alert', hidden: true });
  return page({ title: 'Neue Sendung', subtitle: 'Für Lieferscheine entsteht die Sendung am einfachsten direkt beim Liefern im Auftrag.', back: ['#/logistics/shipments', 'Sendungen'] }, card(null, f.el, err, h('div', { class: 'form-actions' }, btn('Abbrechen', () => navigate('/logistics/shipments')),
    btn('Speichern', async (e) => { err.hidden = true; e.currentTarget.disabled = true; try { const r = await api.post('/logistics/shipments', clean(f.get())); toast('Sendung angelegt'); navigate(`/logistics/shipments/${r.id}`); } catch (ex) { err.textContent = ex.message || errMsg(ex); err.hidden = false; e.currentTarget.disabled = false; } }, 'primary'))));
}, 'logistics:w');

register('/logistics/shipments/:id', async ({ params }) => {
  const s = await api.get(`/logistics/shipments/${params.id}`);
  const carriers = can('logistics:w') ? (await api.get('/logistics/carriers')).rows.filter((x) => x.active || x.id === s.carrier_id) : [];
  const a = [];
  if (can('logistics:w') && s.status !== 'cancelled') {
    a.push(btn('Status ändern', () => formDialog({ title: `Status · ${s.number}`, fields: [{ name: 'status', label: 'Neuer Status', type: 'select', options: statusOptions('shipment').filter(([k]) => k !== 'cancelled' || s.status === 'planned') }, { name: 'note', label: 'Notiz (optional)', maxlength: 300, wide: true }], values: { status: ({ planned: 'packed', packed: 'shipped', shipped: 'in_transit', in_transit: 'delivered' })[s.status] || s.status },
      onSubmit: async (v) => { await api.post(`/logistics/shipments/${s.id}/status`, v); toast('Status geändert'); refresh(); } }), 'primary', 'truck'),
      btn('Bearbeiten', () => formDialog({ title: 'Sendung bearbeiten', fields: shipmentFields(carriers, false), values: { ...s, carrier_id: s.carrier_id || '' }, wide: true, onSubmit: async (v) => { await api.put(`/logistics/shipments/${s.id}`, clean({ ...v, address: s.address })); toast('Gespeichert'); refresh(); } }), '', 'edit'));
  }
  a.push(btn('Drucken', () => window.print(), '', 'print'));
  return page({ title: `Sendung ${s.number}`, subtitle: `${DIRECTION[s.direction]} · ${s.party_name || ''}`, back: ['#/logistics/shipments', 'Sendungen'], actions: a },
    h('p', null, badge('shipment', s.status), s.late ? h('span', { class: 'badge red' }, 'überfällig') : null),
    h('div', { class: 'grid-2' },
      card('Sendung', kv([['Frachtführer', s.carrier], ['Sendungsnummer', s.track_link ? h('a', { href: s.track_link, target: '_blank', rel: 'noopener noreferrer' }, `${s.tracking_no} (Sendung verfolgen)`) : s.tracking_no], ['Versanddatum', dateDE(s.ship_date)], ['Voraussichtliche Ankunft', dateDE(s.eta)], ['Zugestellt am', s.delivered_at ? dateTimeDE(s.delivered_at) : null], ['Pakete', String(s.packages)], ['Gewicht', s.weight_g ? `${num(s.weight_g / 1000)} kg` : null], ['Frachtkosten', s.cost_cents ? eur(s.cost_cents) : null], ['Lieferschein', s.delivery ? h('a', { href: `#/sales/deliveries/${s.delivery.id}` }, s.delivery.number) : null], ['Bestellung', s.po ? h('a', { href: `#/purchasing/orders/${s.po.id}` }, s.po.number) : null], ['Notizen', s.notes]])),
      card('Adresse', h('p', null, textLines(s.address || s.party_name || '')))),
    card('Statusverlauf', h('ol', { class: 'timeline' }, s.events.map((e) => h('li', null, h('strong', null, statusLabel('shipment', e.status)), h('span', { class: 'muted' }, ` · ${dateTimeDE(e.ts)}${e.user_name ? ` · ${e.user_name}` : ''}`), e.note ? h('p', null, e.note) : null)))));
}, 'logistics:r');

register('/logistics/carriers', async () => {
  const d = await api.get('/logistics/carriers');
  const edit = (c) => formDialog({ title: c ? 'Frachtführer bearbeiten' : 'Neuer Frachtführer', values: c || { active: true }, fields: [{ name: 'name', label: 'Name', required: true, maxlength: 100 }, { name: 'tracking_url', label: 'Tracking-Link', maxlength: 300, wide: true, help: 'Muss mit https:// beginnen und {tracking} als Platzhalter für die Sendungsnummer enthalten.' }, c ? { name: 'active', label: 'Aktiv', type: 'checkbox' } : null].filter(Boolean),
    onSubmit: async (v) => { if (c) await api.put(`/logistics/carriers/${c.id}`, v); else await api.post('/logistics/carriers', v); toast('Gespeichert'); refresh(); } });
  return page({ title: 'Frachtführer', subtitle: 'Versanddienstleister mit Tracking-Link. Die Vorlagen bitte einmal prüfen – Anbieter ändern ihre Adressen gelegentlich.', actions: can('logistics:w') ? [btn('Neuer Frachtführer', () => edit(null), 'primary', 'plus')] : [] },
    table({ rows: d.rows, empty: 'Keine Frachtführer.', columns: [{ key: 'name', label: 'Name' }, { label: 'Tracking-Link', render: (c) => c.tracking_url || '–' }, { label: 'Status', render: (c) => (c.active ? h('span', { class: 'badge green' }, 'aktiv') : h('span', { class: 'badge gray' }, 'inaktiv')) }, ...(can('logistics:w') ? [{ label: '', render: (c) => btn('Bearbeiten', () => edit(c), 'small', 'edit') }] : [])] }));
}, 'logistics:r');
