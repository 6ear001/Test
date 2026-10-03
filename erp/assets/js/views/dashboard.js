import { api } from '../api.js';
import { register, state, can } from '../core.js';
import { h, page, card, kpi, eur, num, dateDE, barChart, table, badge, icon, DOC_TYPES, KIND_OF_TYPE } from '../ui.js';

const greeting = () => { const hr = new Date().getHours(); return hr < 11 ? 'Guten Morgen' : hr < 18 ? 'Guten Tag' : 'Guten Abend'; };

register('/', async () => {
  const d = await api.get('/reports/dashboard');
  const tasks = (await api.get('/activities').catch(() => ({ rows: [] }))).rows;
  const tiles = [];
  if ('revenue_month_cents' in d) tiles.push(kpi('Umsatz diesen Monat (netto)', eur(d.revenue_month_cents), '', '#/reports/sales'), kpi('Umsatz dieses Jahr (netto)', eur(d.revenue_year_cents), '', '#/reports/sales'));
  if ('receivables_cents' in d) tiles.push(kpi('Offene Forderungen', eur(d.receivables_cents), d.receivables_overdue_cents > 0 ? 'warn' : '', '#/accounting/open-items'), kpi('Davon überfällig', eur(d.receivables_overdue_cents), d.receivables_overdue_cents > 0 ? 'bad' : 'good', '#/sales/invoices?overdue=1'));
  if ('payables_cents' in d) tiles.push(kpi('Offene Verbindlichkeiten', eur(d.payables_cents), d.payables_overdue_cents > 0 ? 'warn' : '', '#/accounting/open-items?type=creditors'));
  if ('cash_cents' in d) tiles.push(kpi('Bank & Kasse', eur(d.cash_cents), d.cash_cents < 0 ? 'bad' : '', '#/accounting'));
  if ('stock_value_cents' in d) tiles.push(kpi('Lagerwert', eur(d.stock_value_cents), '', '#/stock'), kpi('Artikel unter Mindestbestand', String(d.low_stock_count), d.low_stock_count ? 'warn' : 'good', '#/purchasing/reorder'));
  if ('open_orders' in d) tiles.push(kpi('Offene Aufträge', `${d.open_orders.count} (${eur(d.open_orders.net_cents)})`, '', '#/sales/orders'));
  if ('shipments_active' in d) tiles.push(kpi('Sendungen unterwegs', `${d.shipments_active}${d.shipments_late ? ` · ${d.shipments_late} verspätet` : ''}`, d.shipments_late || d.shipments_problem ? 'warn' : '', '#/logistics/shipments'));
  if (d.tasks_due) tiles.push(kpi('Fällige Aufgaben', String(d.tasks_due), 'warn', '#/customers'));

  const fresh = 'revenue_year_cents' in d && d.customers === 0 && d.leads === 0 && d.revenue_year_cents === 0;
  const start = fresh ? card('Erste Schritte',
    h('ol', { class: 'steps' }, [
      ['Firmendaten eintragen (Adresse, USt-IdNr., Bankverbindung) – erscheinen auf Ihren Belegen', '#/settings', can('admin:w')],
      ['Lager prüfen oder weitere Lagerorte anlegen', '#/warehouses', can('stock:w')],
      ['Artikel mit Preisen und Mindestbestand anlegen', '#/products/new', can('stock:w')],
      ['Kunden und Lieferanten anlegen', '#/customers/new', can('crm:w')],
      ['Erstes Angebot oder erste Rechnung schreiben', '#/sales/quotes/new', can('sales:w')],
      ['Bankkonto und Anfangsbestand unter „Eigene Konten“ erfassen', '#/accounting', can('accounting:w')],
    ].filter((x) => x[2]).map(([t, href]) => h('li', null, h('a', { href }, t))))) : null;

  return page({ title: `${greeting()}, ${state.me.user.name.split(' ')[0]}`, subtitle: `Übersicht für ${state.me.tenant.name} · ${dateDE(d.today)}` },
    start,
    h('div', { class: 'kpis' }, tiles),
    d.revenue_series ? h('div', { class: 'grid-2' },
      card('Umsatz der letzten 12 Monate (netto)', barChart(d.revenue_series)),
      card('Aufgaben & Wiedervorlagen', tasks.length ? h('ul', { class: 'tasklist' }, tasks.slice(0, 8).map((t) => h('li', null,
        h('a', { href: `#/${t.party_type === 'customer' ? 'customers' : 'suppliers'}/${t.party_id}` }, t.party_name || '–'), h('span', null, t.text),
        t.due_date ? h('small', { class: t.due_date < d.today ? 'late' : 'muted' }, `fällig ${dateDE(t.due_date)}`) : null))) : h('p', { class: 'muted' }, 'Keine offenen Aufgaben. Aufgaben legen Sie in der Kundenakte an.'))) : null,
    d.top_customers ? h('div', { class: 'grid-2' },
      card('Top-Kunden dieses Jahr', d.top_customers.length ? table({ columns: [{ label: 'Kunde', render: (r) => h('a', { href: `#/customers/${r.id}` }, r.name) }, { label: 'Umsatz netto', align: 'right', render: (r) => eur(r.cents) }], rows: d.top_customers }) : h('p', { class: 'muted' }, 'Noch keine Umsätze.')),
      card('Top-Artikel dieses Jahr', d.top_products.length ? table({ columns: [{ label: 'Artikel', render: (r) => `${r.sku ? `${r.sku} · ` : ''}${r.name}` }, { label: 'Menge', align: 'right', render: (r) => num(r.qty) }, { label: 'Umsatz netto', align: 'right', render: (r) => eur(r.cents) }], rows: d.top_products }) : h('p', { class: 'muted' }, 'Noch keine Umsätze.'))) : null,
    d.recent ? card('Letzte Belege', table({ columns: [
      { label: 'Beleg', render: (r) => h('a', { href: `#/sales/${KIND_OF_TYPE[r.type]}/${r.id}` }, `${DOC_TYPES[r.type]} ${r.number || '(Entwurf)'}`) },
      { label: 'Kunde', key: 'customer' }, { label: 'Datum', render: (r) => dateDE(r.date) }, { label: 'Status', render: (r) => badge(r.type, r.status) }, { label: 'Brutto', align: 'right', render: (r) => eur(r.gross_cents) }], rows: d.recent, empty: 'Noch keine Belege.' })) : null);
});
