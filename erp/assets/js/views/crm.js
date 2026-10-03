// Kundenverwaltung (CRM) und Lieferanten: Listen, Kundenakte, Ansprechpartner, Aktivitäten, Kontoauszug.
import { api, qs } from '../api.js';
import { register, can, navigate } from '../core.js';
import { h, page, card, kpi, table, badge, btn, kv, lines, formDialog, form, confirmDialog, guard, toast, eur, dateDE, dateTimeDE, todayISO, statusOptions, DOC_TYPES, KIND_OF_TYPE, icon, tabs, errMsg } from '../ui.js';

const COUNTRIES = [['DE', 'Deutschland'], ['AT', 'Österreich'], ['CH', 'Schweiz'], ['NL', 'Niederlande'], ['FR', 'Frankreich'], ['IT', 'Italien'], ['PL', 'Polen'], ['TR', 'Türkei'], ['GB', 'Großbritannien'], ['US', 'USA']];

const customerFields = () => [
  { type: 'heading', label: 'Stammdaten' },
  { name: 'name', label: 'Name / Firma', required: true, wide: true, maxlength: 200 },
  { name: 'kind', label: 'Art', type: 'select', options: [['company', 'Firma'], ['person', 'Privatperson']] },
  { name: 'status', label: 'Status', type: 'select', options: statusOptions('customer') },
  { name: 'email', label: 'E-Mail', type: 'email', maxlength: 190 }, { name: 'phone', label: 'Telefon', maxlength: 60 },
  { name: 'website', label: 'Webseite', maxlength: 200 }, { name: 'vat_id', label: 'USt-IdNr.', maxlength: 30 },
  { type: 'heading', label: 'Adresse' },
  { name: 'street', label: 'Straße und Nr.', wide: true, maxlength: 200 }, { name: 'zip', label: 'PLZ', maxlength: 20 }, { name: 'city', label: 'Ort', maxlength: 120 },
  { name: 'country', label: 'Land', type: 'select', options: COUNTRIES },
  { type: 'heading', label: 'Konditionen' },
  { name: 'payment_days', label: 'Zahlungsziel (Tage)', type: 'number', empty: 14 }, { name: 'discount_pct', label: 'Rabatt (%)', type: 'number' },
  { name: 'credit_limit_cents', label: 'Kreditlimit (€, 0 = keins)', type: 'money' }, { name: 'tags', label: 'Schlagwörter', maxlength: 200, help: 'z. B. Stammkunde, Gastro' },
  { name: 'notes', label: 'Interne Notizen', type: 'textarea', wide: true, maxlength: 4000 },
];
const supplierFields = () => [
  { type: 'heading', label: 'Stammdaten' },
  { name: 'name', label: 'Name / Firma', required: true, wide: true, maxlength: 200 },
  { name: 'status', label: 'Status', type: 'select', options: statusOptions('supplier') },
  { name: 'email', label: 'E-Mail', type: 'email', maxlength: 190 }, { name: 'phone', label: 'Telefon', maxlength: 60 },
  { name: 'website', label: 'Webseite', maxlength: 200 }, { name: 'vat_id', label: 'USt-IdNr.', maxlength: 30 },
  { type: 'heading', label: 'Adresse' },
  { name: 'street', label: 'Straße und Nr.', wide: true, maxlength: 200 }, { name: 'zip', label: 'PLZ', maxlength: 20 }, { name: 'city', label: 'Ort', maxlength: 120 },
  { name: 'country', label: 'Land', type: 'select', options: COUNTRIES },
  { type: 'heading', label: 'Konditionen und Bank' },
  { name: 'payment_days', label: 'Zahlungsziel (Tage)', type: 'number', empty: 14 }, { name: 'lead_days', label: 'Lieferzeit (Tage)', type: 'number', empty: 3 },
  { name: 'iban', label: 'IBAN', maxlength: 40 }, { name: 'bic', label: 'BIC', maxlength: 20 },
  { name: 'notes', label: 'Interne Notizen', type: 'textarea', wide: true, maxlength: 4000 },
];

const CFG = {
  customer: { plural: 'customers', label: 'Kunde', labels: 'Kunden', area: 'crm', fields: customerFields, acct: 'Debitorenkonto' },
  supplier: { plural: 'suppliers', label: 'Lieferant', labels: 'Lieferanten', area: 'purchasing', fields: supplierFields, acct: 'Kreditorenkonto' },
};

function listPage(type) {
  const c = CFG[type];
  return async ({ query }) => {
    const wrap = h('div');
    const search = h('input', { type: 'search', class: 'search', placeholder: `${c.labels} suchen …`, 'aria-label': 'Suchen', value: query.q || '' });
    const status = h('select', { 'aria-label': 'Status' }, [['', 'Alle Status'], ...statusOptions(type)].map(([v, l]) => h('option', { value: v, selected: v === (query.status || '') }, l)));
    const load = async () => {
      const res = await api.get(`/${c.plural}${qs({ q: search.value, status: status.value, limit: 500 })}`);
      const cols = [
        { key: 'number', label: 'Nr.' },
        { key: 'name', label: 'Name', render: (r) => h('a', { href: `#/${c.plural}/${r.id}` }, r.name), csv: (r) => r.name },
        { label: 'Status', sort: (r) => r.status, render: (r) => badge(type, r.status), csv: (r) => r.status },
        { key: 'city', label: 'Ort' }, { key: 'email', label: 'E-Mail' }, { key: 'phone', label: 'Telefon' },
        ...(type === 'customer'
          ? [{ label: 'Umsatz', align: 'right', sort: (r) => r.revenue_cents, render: (r) => eur(r.revenue_cents), csv: (r) => r.revenue_cents / 100 }]
          : [{ label: 'Einkaufsvolumen', align: 'right', sort: (r) => r.volume_cents, render: (r) => eur(r.volume_cents), csv: (r) => r.volume_cents / 100 }]),
        { label: 'Offen', align: 'right', sort: (r) => r.open_cents, render: (r) => h('span', { class: r.open_cents > 0 ? 'neg' : '' }, eur(r.open_cents)), csv: (r) => r.open_cents / 100 },
      ];
      wrap.replaceChildren(table({ columns: cols, rows: res.rows, onRow: (r) => navigate(`/${c.plural}/${r.id}`), exportName: c.plural, empty: `Noch keine ${c.labels} – legen Sie den ersten an.` }), h('p', { class: 'muted small' }, `${res.total} ${c.labels}`));
    };
    let t;
    search.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => guard(load), 250); });
    status.addEventListener('change', () => guard(load));
    await load();
    return page({ title: c.labels, subtitle: type === 'customer' ? 'Kundenverwaltung mit Kundenakte, Aufgaben und Kundenkonto' : 'Lieferanten mit Konditionen und Kreditorenkonto', actions: can(`${c.area}:w`) ? [btn(`Neuer ${c.label}`, () => navigate(`/${c.plural}/new`), 'primary', 'plus')] : [] },
      h('div', { class: 'filters' }, search, status), wrap);
  };
}

function newPage(type) {
  const c = CFG[type];
  return async () => {
    const f = form(c.fields(), type === 'customer' ? { kind: 'company', status: 'customer', country: 'DE', payment_days: 14 } : { status: 'active', country: 'DE', payment_days: 14, lead_days: 3 });
    const err = h('p', { class: 'form-error', role: 'alert', hidden: true });
    return page({ title: `Neuer ${c.label}`, back: [`#/${c.plural}`, c.labels] }, card(null, f.el, err, h('div', { class: 'form-actions' },
      btn('Abbrechen', () => navigate(`/${c.plural}`)),
      btn('Speichern', async (e) => {
        err.hidden = true; e.currentTarget.disabled = true;
        try { const r = await api.post(`/${c.plural}`, f.get()); toast(`${c.label} ${r.number} angelegt`); navigate(`/${c.plural}/${r.id}`); } catch (ex) { err.textContent = ex.message || errMsg(ex); err.hidden = false; e.currentTarget.disabled = false; }
      }, 'primary'))));
  };
}

const ACTIVITY_KINDS = [['note', 'Notiz'], ['call', 'Telefonat'], ['email', 'E-Mail'], ['meeting', 'Termin / Besuch'], ['task', 'Aufgabe / Wiedervorlage']];
const kindLabel = (k) => ACTIVITY_KINDS.find((x) => x[0] === k)?.[1] ?? k;

function detailPage(type) {
  const c = CFG[type];
  return async ({ params }) => {
    const d = await api.get(`/${c.plural}/${params.id}`);
    const it = d.item;
    const refresh = () => document.dispatchEvent(new Event('erp:refresh'));
    const canW = can(`${c.area}:w`);
    const stats = d.stats;
    const actions = [];
    if (type === 'customer') {
      if (can('sales:w')) actions.push(btn('Angebot', () => navigate(`/sales/quotes/new?customer=${it.id}`), '', 'doc'), btn('Rechnung', () => navigate(`/sales/invoices/new?customer=${it.id}`), '', 'euro'));
    } else if (can('purchasing:w')) actions.push(btn('Bestellung', () => navigate(`/purchasing/orders/new?supplier=${it.id}`), '', 'cart'));
    actions.push(btn('Kontoauszug', () => navigate(`/${c.plural}/${it.id}/statement`), '', 'book'));
    if (canW) actions.push(
      btn('Bearbeiten', () => formDialog({ title: `${c.label} bearbeiten`, fields: c.fields(), values: it, wide: true, onSubmit: async (v) => { await api.put(`/${c.plural}/${it.id}`, v); toast('Gespeichert'); refresh(); } }), '', 'edit'),
      btn('Löschen', async () => { if (await confirmDialog({ title: `${c.label} löschen?`, message: `„${it.name}“ wird endgültig gelöscht. Das geht nur, solange es keine Belege oder Buchungen gibt.`, confirmLabel: 'Löschen', danger: true })) guard(async () => { await api.del(`/${c.plural}/${it.id}`); toast('Gelöscht'); navigate(`/${c.plural}`); }); }, 'danger', 'trash'));

    const tiles = type === 'customer'
      ? [kpi('Umsatz gesamt (netto)', eur(stats.revenue_cents)), kpi('Umsatz dieses Jahr', eur(stats.revenue_year_cents)), kpi('Offene Posten', eur(stats.open_cents), stats.open_cents ? 'warn' : ''), kpi('Davon überfällig', eur(stats.overdue_cents), stats.overdue_cents ? 'bad' : 'good'), kpi('Offene Aufträge', String(stats.open_orders))]
      : [kpi('Einkaufsvolumen (netto)', eur(stats.volume_cents)), kpi('Offene Posten', eur(stats.open_cents), stats.open_cents ? 'warn' : ''), kpi('Offene Bestellungen', String(stats.open_orders))];
    const over = type === 'customer' && it.credit_limit_cents > 0 && stats.open_cents > it.credit_limit_cents;

    const contactsCard = card('Ansprechpartner',
      d.contacts.length ? table({ columns: [{ key: 'name', label: 'Name', render: (r) => h('span', null, r.name, r.is_primary ? h('span', { class: 'badge blue tight' }, 'Haupt') : null) }, { key: 'role', label: 'Funktion' }, { label: 'E-Mail', render: (r) => (r.email ? h('a', { href: `mailto:${r.email}` }, r.email) : '') }, { key: 'phone', label: 'Telefon' },
        ...(canW ? [{ label: '', render: (r) => h('span', { class: 'row-actions' }, btn('', () => contactDialog(r), 'icon', 'edit'), btn('', async () => { if (await confirmDialog({ title: 'Ansprechpartner löschen?', message: r.name, confirmLabel: 'Löschen', danger: true })) guard(async () => { await api.del(`/contacts/${r.id}`); refresh(); }); }, 'icon', 'trash')) }] : [])], rows: d.contacts }) : h('p', { class: 'muted' }, 'Noch keine Ansprechpartner.'),
      canW ? h('div', { class: 'card-foot' }, btn('Ansprechpartner hinzufügen', () => contactDialog(null), 'small', 'plus')) : null);
    function contactDialog(row) {
      formDialog({ title: row ? 'Ansprechpartner bearbeiten' : 'Ansprechpartner hinzufügen', values: row || {}, fields: [{ name: 'name', label: 'Name', required: true, wide: true }, { name: 'role', label: 'Funktion' }, { name: 'phone', label: 'Telefon' }, { name: 'email', label: 'E-Mail', type: 'email', wide: true }, { name: 'is_primary', label: 'Hauptansprechpartner', type: 'checkbox' }],
        onSubmit: async (v) => { if (row) await api.put(`/contacts/${row.id}`, v); else await api.post(`/${c.plural}/${it.id}/contacts`, v); refresh(); } });
    }
    const act = (a) => h('li', { class: `activity${a.done ? ' done' : ''}` },
      canW && (a.kind === 'task' || a.due_date) ? h('input', { type: 'checkbox', checked: !!a.done, 'aria-label': 'Erledigt', onchange: (e) => guard(async () => { await api.put(`/activities/${a.id}`, { done: e.target.checked }); refresh(); }) }) : h('span', { class: 'dot', 'aria-hidden': 'true' }),
      h('div', null, h('strong', null, kindLabel(a.kind)), a.due_date ? h('span', { class: a.due_date < todayISO() && !a.done ? 'late' : 'muted' }, ` · fällig ${dateDE(a.due_date)}`) : null, h('p', null, lines(a.text)), h('small', { class: 'muted' }, `${a.user_name || ''} · ${dateTimeDE(a.created_at)}`)),
      canW ? btn('', async () => { if (await confirmDialog({ title: 'Eintrag löschen?', message: a.text.slice(0, 80), confirmLabel: 'Löschen', danger: true })) guard(async () => { await api.del(`/activities/${a.id}`); refresh(); }); }, 'icon', 'trash') : null);
    const actCard = card('Aktivitäten & Aufgaben', d.activities.length ? h('ul', { class: 'activities' }, d.activities.map(act)) : h('p', { class: 'muted' }, 'Noch keine Einträge. Halten Sie Telefonate, Gespräche und Wiedervorlagen hier fest.'),
      canW ? h('div', { class: 'card-foot' }, btn('Eintrag hinzufügen', () => formDialog({ title: 'Neuer Eintrag', fields: [{ name: 'kind', label: 'Art', type: 'select', options: ACTIVITY_KINDS }, { name: 'due_date', label: 'Fällig am (optional)', type: 'date' }, { name: 'text', label: 'Text', type: 'textarea', required: true, wide: true, maxlength: 2000 }], values: { kind: 'note' },
        onSubmit: async (v) => { await api.post(`/${c.plural}/${it.id}/activities`, v); refresh(); } }), 'small', 'plus')) : null);

    const docs = type === 'customer'
      ? table({ columns: [{ label: 'Beleg', render: (r) => h('a', { href: `#/sales/${KIND_OF_TYPE[r.type]}/${r.id}` }, `${DOC_TYPES[r.type]} ${r.number || '(Entwurf)'}`) }, { label: 'Datum', render: (r) => dateDE(r.date) }, { label: 'Status', render: (r) => badge(r.type, r.status) }, { label: 'Brutto', align: 'right', render: (r) => eur(r.gross_cents) }, { label: 'Bezahlt', align: 'right', render: (r) => (r.type === 'invoice' ? eur(r.paid_cents) : '') }], rows: d.documents, empty: 'Noch keine Belege.' })
      : table({ columns: [{ label: 'Bestellung', render: (r) => h('a', { href: `#/purchasing/orders/${r.id}` }, r.number) }, { label: 'Datum', render: (r) => dateDE(r.date) }, { label: 'Status', render: (r) => badge('purchase_order', r.status) }, { label: 'Brutto', align: 'right', render: (r) => eur(r.gross_cents) }], rows: d.documents, empty: 'Noch keine Bestellungen.' });

    return page({ title: it.name, subtitle: `${c.labels === 'Kunden' ? 'Kunden-Nr.' : 'Lieferanten-Nr.'} ${it.number} · ${c.acct} ${it.number}`, back: [`#/${c.plural}`, c.labels], actions },
      h('p', null, badge(type, it.status), it.tags ? h('span', { class: 'tags' }, it.tags.split(',').map((t) => h('span', { class: 'tag' }, t.trim()))) : null),
      over ? h('div', { class: 'notice warn' }, icon('warn', 18), `Kreditlimit überschritten: offene Posten ${eur(stats.open_cents)} bei einem Limit von ${eur(it.credit_limit_cents)}.`) : null,
      h('div', { class: 'kpis' }, tiles),
      h('div', { class: 'grid-2' },
        card('Stammdaten', kv([['Adresse', h('span', null, lines([it.street, [it.zip, it.city].filter(Boolean).join(' '), it.country !== 'DE' ? it.country : ''].filter(Boolean).join('\n')) )], ['E-Mail', it.email ? h('a', { href: `mailto:${it.email}` }, it.email) : null], ['Telefon', it.phone], ['Webseite', it.website], ['USt-IdNr.', it.vat_id],
          ['Zahlungsziel', `${it.payment_days} Tage`], type === 'customer' ? ['Rabatt', it.discount_pct ? `${it.discount_pct} %` : null] : ['Lieferzeit', `${it.lead_days} Tage`], type === 'customer' ? ['Kreditlimit', it.credit_limit_cents ? eur(it.credit_limit_cents) : 'keins'] : ['IBAN', it.iban], ['Notizen', it.notes ? h('span', null, lines(it.notes)) : null]])),
        contactsCard),
      actCard,
      card(type === 'customer' ? 'Belege' : 'Bestellungen', docs),
      type === 'supplier' && d.invoices ? card('Eingangsrechnungen', table({ columns: [{ label: 'Nr.', render: (r) => h('a', { href: `#/purchasing/invoices/${r.id}` }, r.number) }, { key: 'supplier_ref', label: 'Rechnungsnr. Lieferant' }, { label: 'Datum', render: (r) => dateDE(r.date) }, { label: 'Fällig', render: (r) => dateDE(r.due_date) }, { label: 'Status', render: (r) => badge('supplier_invoice', r.status) }, { label: 'Brutto', align: 'right', render: (r) => eur(r.gross_cents) }], rows: d.invoices, empty: 'Noch keine Eingangsrechnungen.' })) : null,
      type === 'customer' && d.shipments?.length ? card('Letzte Sendungen', table({ columns: [{ label: 'Sendung', render: (r) => h('a', { href: `#/logistics/shipments/${r.id}` }, r.number) }, { label: 'Status', render: (r) => badge('shipment', r.status) }, { key: 'tracking_no', label: 'Sendungsnummer' }, { label: 'Versand', render: (r) => dateDE(r.ship_date) }], rows: d.shipments })) : null);
  };
}

function statementPage(type) {
  const c = CFG[type];
  return async ({ params, query }) => {
    const s = await api.get(`/${c.plural}/${params.id}/statement${qs({ from: query.from, to: query.to })}`);
    const L = s.ledger;
    const sign = type === 'customer' ? 1 : -1; // Debitor: Soll positiv; Kreditor: Haben als positive Schuld
    const bal = (cents) => eur(cents * sign);
    const rows = [{ date: '', number: '', text: 'Anfangsbestand', debit_cents: 0, credit_cents: 0, balance_cents: L.opening_cents, opening: true }, ...L.rows];
    return page({ title: `Kontoauszug ${s.party.name}`, subtitle: `${c.acct} ${s.party.number}`, back: [`#/${c.plural}/${s.party.id}`, s.party.name], actions: [btn('Drucken', () => window.print(), '', 'print')] },
      h('div', { class: 'kpis' }, kpi(type === 'customer' ? 'Forderung (Saldo)' : 'Verbindlichkeit (Saldo)', bal(L.closing_cents), L.closing_cents * sign > 0 ? 'warn' : 'good'), kpi('Offene Posten', String(s.open_items.length))),
      card('Offene Posten', s.open_items.length ? table({ columns: [{ label: 'Beleg', render: (r) => h('a', { href: type === 'customer' ? `#/sales/invoices/${r.id}` : `#/purchasing/invoices/${r.id}` }, r.number) }, { label: 'Datum', render: (r) => dateDE(r.date) }, { label: 'Fällig', render: (r) => dateDE(r.due_date) }, { label: 'Überfällig', align: 'right', render: (r) => (r.days_overdue ? h('span', { class: 'neg' }, `${r.days_overdue} Tage`) : '–') }, { label: 'Offen', align: 'right', render: (r) => eur(r.open_cents) }], rows: s.open_items }) : h('p', { class: 'muted' }, 'Keine offenen Posten.')),
      card('Kontoblatt', table({ columns: [{ label: 'Datum', render: (r) => dateDE(r.date) }, { key: 'number', label: 'Buchung' }, { key: 'text', label: 'Text' }, { label: 'Soll', align: 'right', render: (r) => (r.debit_cents ? eur(r.debit_cents) : '') }, { label: 'Haben', align: 'right', render: (r) => (r.credit_cents ? eur(r.credit_cents) : '') }, { label: 'Saldo', align: 'right', render: (r) => bal(r.balance_cents) }], rows, exportName: `kontoauszug-${s.party.number}` })));
  };
}

for (const type of ['customer', 'supplier']) {
  const c = CFG[type];
  register(`/${c.plural}`, listPage(type), `${c.area}:r`);
  register(`/${c.plural}/new`, newPage(type), `${c.area}:w`);
  register(`/${c.plural}/:id`, detailPage(type), `${c.area}:r`);
  register(`/${c.plural}/:id/statement`, statementPage(type), `${c.area}:r`);
}
