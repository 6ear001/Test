// Buchhaltung: Eigene Konten (Bank/Kasse), Journal, Buchen, Kontenplan, Kontoblatt, Offene Posten, Zahlungen, Auswertungen.
import { api, qs } from '../api.js';
import { register, can, navigate } from '../core.js';
import { h, page, card, kpi, table, badge, btn, kv, formDialog, form, dialog, confirmDialog, guard, toast, eur, num, dateDE, dateTimeDE, todayISO, tabs, icon, parseMoney, moneyText, errMsg } from '../ui.js';

const refresh = () => document.dispatchEvent(new Event('erp:refresh'));
const TYPE_LABEL = { asset: 'Aktiv', liability: 'Passiv', equity: 'Eigenkapital', revenue: 'Erlös', expense: 'Aufwand' };
const SOURCE = { manual: 'Manuell', invoice: 'Rechnung', credit_note: 'Gutschrift', payment: 'Zahlung', supplier_invoice: 'Eingangsrechnung', transfer: 'Umbuchung', private: 'Privat', storno: 'Storno' };
const sh = (cents) => `${eur(Math.abs(cents))} ${cents >= 0 ? 'S' : 'H'}`; // Soll/Haben
const year = new Date().getFullYear();
const range = (query) => ({ from: query.from || `${year}-01-01`, to: query.to || `${year}-12-31` });
const rangeBar = (query, base) => {
  const r = range(query);
  const from = h('input', { type: 'date', value: r.from, 'aria-label': 'Von' }), to = h('input', { type: 'date', value: r.to, 'aria-label': 'Bis' });
  const go = () => { const p = new URLSearchParams(location.hash.split('?')[1] || ''); p.set('from', from.value); p.set('to', to.value); navigate(`${base}?${p}`); };
  from.addEventListener('change', go); to.addEventListener('change', go);
  return h('div', { class: 'filters' }, h('label', { class: 'inline' }, 'Von ', from), h('label', { class: 'inline' }, 'Bis ', to));
};

// ---------- Eigene Konten ----------
register('/accounting', async () => {
  const [fa, journal, ar, ap] = await Promise.all([api.get('/accounting/finance-accounts'), api.get(`/accounting/journal${qs({ limit: 8 })}`), api.get('/accounting/open-items?type=debtors'), api.get('/accounting/open-items?type=creditors')]);
  const W = can('accounting:w');
  const accts = fa.rows.filter((a) => a.active);
  const newAccount = () => formDialog({ title: 'Neues Bank- oder Kassenkonto', fields: [{ name: 'kind', label: 'Art', type: 'select', options: [['bank', 'Bankkonto'], ['cash', 'Kasse']] }, { name: 'name', label: 'Bezeichnung', required: true, maxlength: 200 }, { name: 'bank_name', label: 'Bank', maxlength: 120 }, { name: 'iban', label: 'IBAN', maxlength: 40 }, { name: 'bic', label: 'BIC', maxlength: 20 }, { name: 'opening_cents', label: 'Anfangsbestand (€)', type: 'money', empty: 0, help: 'Kontostand zum Start; wird gegen „Saldenvorträge“ gebucht' }, { name: 'opening_date', label: 'Stichtag Anfangsbestand', type: 'date' }], values: { kind: 'bank', opening_date: todayISO() }, wide: true,
    onSubmit: async (v) => { await api.post('/accounting/finance-accounts', { ...v, opening_date: v.opening_date || undefined }); toast('Konto angelegt'); refresh(); } });
  const transfer = () => formDialog({ title: 'Umbuchung zwischen eigenen Konten', fields: [{ name: 'from_account_id', label: 'Von', type: 'select', options: accts.map((a) => [a.id, `${a.number} ${a.name}`]) }, { name: 'to_account_id', label: 'Nach', type: 'select', options: accts.map((a) => [a.id, `${a.number} ${a.name}`]).reverse() }, { name: 'amount_cents', label: 'Betrag (€)', type: 'money', required: true }, { name: 'date', label: 'Datum', type: 'date', required: true }, { name: 'text', label: 'Buchungstext', maxlength: 300, wide: true, placeholder: 'z. B. Bareinzahlung, Kassenentnahme' }], values: { date: todayISO() }, onSubmit: async (v) => { await api.post('/accounting/transfer', { ...v, from_account_id: Number(v.from_account_id), to_account_id: Number(v.to_account_id), text: v.text || undefined }); toast('Umgebucht'); refresh(); } });
  const priv = () => formDialog({ title: 'Privatentnahme / Privateinlage', intro: 'Für Einzelunternehmen und Personengesellschaften: Geld, das Sie privat entnehmen oder in die Firma einlegen.', fields: [{ name: 'type', label: 'Art', type: 'select', options: [['withdrawal', 'Privatentnahme (Geld aus der Firma)'], ['deposit', 'Privateinlage (Geld in die Firma)']], wide: true }, { name: 'account_id', label: 'Konto', type: 'select', options: accts.map((a) => [a.id, `${a.number} ${a.name}`]) }, { name: 'amount_cents', label: 'Betrag (€)', type: 'money', required: true }, { name: 'date', label: 'Datum', type: 'date', required: true }, { name: 'text', label: 'Buchungstext', maxlength: 300, wide: true }], values: { date: todayISO(), type: 'withdrawal' }, onSubmit: async (v) => { await api.post('/accounting/private', { ...v, account_id: Number(v.account_id), text: v.text || undefined }); toast('Gebucht'); refresh(); } });
  return page({ title: 'Eigene Konten', subtitle: 'Bank- und Kassenkonten Ihrer Firma, Forderungen und Verbindlichkeiten', actions: W ? [btn('Neues Konto', newAccount, '', 'plus'), btn('Umbuchung', transfer, '', 'euro'), btn('Privat', priv, '', 'users')] : [] },
    h('div', { class: 'kpis' }, kpi('Bank & Kasse gesamt', eur(fa.total_cents), fa.total_cents < 0 ? 'bad' : ''), kpi('Forderungen an Kunden', eur(ar.total_cents), '', '#/accounting/open-items'), kpi('Verbindlichkeiten bei Lieferanten', eur(ap.total_cents), '', '#/accounting/open-items?type=creditors'), kpi('Davon überfällig (Kunden)', eur(ar.total_cents - ar.buckets.not_due), ar.total_cents - ar.buckets.not_due > 0 ? 'bad' : 'good')),
    h('div', { class: 'account-cards' }, fa.rows.map((a) => h('a', { class: `account-card${a.active ? '' : ' inactive'}`, href: `#/accounting/accounts/${a.id}` }, h('span', { class: 'ac-kind' }, a.kind === 'cash' ? 'Kasse' : 'Bankkonto', ' · ', a.number), h('strong', null, a.name), a.iban ? h('small', null, a.iban.replace(/(.{4})/g, '$1 ').trim()) : (a.bank_name ? h('small', null, a.bank_name) : null), h('span', { class: `ac-balance${a.balance_cents < 0 ? ' neg' : ''}` }, eur(a.balance_cents))))),
    card('Letzte Buchungen', table({ rows: journal.rows, empty: 'Noch keine Buchungen.', onRow: (r) => navigate('/accounting/journal'), columns: [{ key: 'number', label: 'Buchung' }, { label: 'Datum', render: (r) => dateDE(r.date) }, { key: 'text', label: 'Text' }, { label: 'Quelle', render: (r) => SOURCE[r.source] || r.source }, { label: 'Betrag', align: 'right', render: (r) => eur(r.amount_cents) }] }), h('div', { class: 'card-foot' }, h('a', { href: '#/accounting/journal' }, 'Alle Buchungen im Journal'))));
}, 'accounting:r');

// ---------- Journal ----------
async function entryDialog(id) {
  const e = await api.get(`/accounting/journal/${id}`);
  const rev = ['manual', 'transfer', 'private'].includes(e.source) && !e.reversed_by_id && !e.reverses_id && can('accounting:w');
  const d = dialog({ title: `Buchung ${e.number}`, wide: true, body: h('div', null, kv([['Datum', dateDE(e.date)], ['Text', e.text], ['Quelle', SOURCE[e.source] || e.source], e.reversed_by_id ? ['Status', h('span', { class: 'badge gray' }, 'storniert')] : null, e.reverses_id ? ['Status', h('span', { class: 'badge gray' }, 'Stornobuchung')] : null]),
    table({ rows: e.lines, columns: [{ label: 'Konto', render: (l) => h('a', { href: `#/accounting/accounts/${l.account_id}`, onclick: () => d.close() }, `${l.account_number} ${l.account_name}`) }, { key: 'text', label: 'Text' }, { label: 'Soll', align: 'right', render: (l) => (l.debit_cents ? eur(l.debit_cents) : '') }, { label: 'Haben', align: 'right', render: (l) => (l.credit_cents ? eur(l.credit_cents) : '') }] })),
    actions: [btn('Schließen', () => d.close()), rev ? btn('Stornieren', async () => { if (await confirmDialog({ title: 'Buchung stornieren?', message: 'Es wird eine Gegenbuchung erzeugt. Die ursprüngliche Buchung bleibt zur Nachvollziehbarkeit erhalten.', confirmLabel: 'Stornieren', danger: true })) guard(async () => { await api.post(`/accounting/journal/${e.id}/reverse`, {}); d.close(); toast('Storniert'); refresh(); }); }, 'danger') : null].filter(Boolean) });
}
register('/accounting/journal', async ({ query }) => {
  const r = range(query);
  const d = await api.get(`/accounting/journal${qs({ from: r.from, to: r.to, source: query.source, q: query.q, limit: 1000 })}`);
  const src = h('select', { 'aria-label': 'Quelle' }, [['', 'Alle Quellen'], ...Object.entries(SOURCE)].map(([v, l]) => h('option', { value: v, selected: v === (query.source || '') }, l)));
  const search = h('input', { type: 'search', class: 'search', placeholder: 'Buchungstext oder -nummer …', value: query.q || '', 'aria-label': 'Suchen' });
  const apply = () => { const p = new URLSearchParams({ from: r.from, to: r.to }); if (src.value) p.set('source', src.value); if (search.value) p.set('q', search.value); navigate(`/accounting/journal?${p}`); };
  src.addEventListener('change', apply); search.addEventListener('keydown', (e) => { if (e.key === 'Enter') apply(); });
  return page({ title: 'Journal', subtitle: 'Alle Buchungen in zeitlicher Reihenfolge – Buchungen werden nie gelöscht, nur storniert', actions: can('accounting:w') ? [btn('Neue Buchung', () => navigate('/accounting/book'), 'primary', 'plus')] : [] },
    rangeBar(query, '/accounting/journal'), h('div', { class: 'filters' }, src, search),
    table({ rows: d.rows, exportName: 'journal', empty: 'Keine Buchungen im Zeitraum.', onRow: (row) => guard(() => entryDialog(row.id)), rowClass: (row) => (row.reversed_by_id || row.reverses_id ? 'inactive' : ''), columns: [
      { label: 'Buchung', sort: (x) => x.number, render: (x) => h('a', { href: '#', onclick: (e) => { e.preventDefault(); guard(() => entryDialog(x.id)); } }, x.number), csv: (x) => x.number }, { label: 'Datum', sort: (x) => x.date, render: (x) => dateDE(x.date), csv: (x) => x.date }, { key: 'text', label: 'Text' }, { label: 'Quelle', render: (x) => SOURCE[x.source] || x.source, csv: (x) => SOURCE[x.source] || x.source },
      { label: 'Betrag', align: 'right', sort: (x) => x.amount_cents, render: (x) => eur(x.amount_cents), csv: (x) => x.amount_cents / 100 }, { label: '', render: (x) => (x.reversed_by_id ? h('span', { class: 'badge gray' }, 'storniert') : x.reverses_id ? h('span', { class: 'badge gray' }, 'Storno') : ''), csv: (x) => (x.reversed_by_id ? 'storniert' : '') }] }));
}, 'accounting:r');

// ---------- Buchen ----------
register('/accounting/book', async () => {
  const accts = (await api.get('/accounting/accounts?kind=general&active=1&limit=2000')).rows;
  const f = form([{ name: 'date', label: 'Buchungsdatum', type: 'date', required: true }, { name: 'text', label: 'Buchungstext', required: true, maxlength: 300 }], { date: todayISO() });
  const tbody = h('tbody');
  const rows = new Set();
  const diff = h('div', { class: 'diff' });
  const sums = () => { let d = 0, c = 0; for (const r of rows) { const x = r.read(); d += parseMoney(x.debit) || 0; c += parseMoney(x.credit) || 0; } return [d, c]; };
  const upd = () => { const [d, c] = sums(); diff.className = `diff ${d === c && d > 0 ? 'ok' : 'bad'}`; diff.textContent = d === c ? (d > 0 ? `Ausgeglichen: Soll = Haben = ${eur(d)}` : 'Bitte Beträge eintragen') : `Differenz: Soll ${eur(d)} · Haben ${eur(c)} · offen ${eur(Math.abs(d - c))}`; };
  const add = () => {
    const sel = h('select', { 'aria-label': 'Konto' }, [h('option', { value: '' }, '– Konto wählen –'), ...accts.map((a) => h('option', { value: a.id }, `${a.number} ${a.name}`))]);
    const debit = h('input', { type: 'text', inputmode: 'decimal', class: 'narrow', 'aria-label': 'Soll' }), credit = h('input', { type: 'text', inputmode: 'decimal', class: 'narrow', 'aria-label': 'Haben' }), text = h('input', { type: 'text', maxlength: 200, 'aria-label': 'Zeilentext' });
    const tr = h('tr', null, h('td', { 'data-label': 'Konto' }, sel), h('td', { 'data-label': 'Soll €' }, debit), h('td', { 'data-label': 'Haben €' }, credit), h('td', { 'data-label': 'Text' }, text), h('td', null, h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Zeile entfernen', onclick: () => { rows.delete(row); tr.remove(); upd(); } }, icon('trash', 16))));
    const row = { read: () => ({ account: sel.value, debit: debit.value, credit: credit.value, text: text.value }) };
    for (const el of [debit, credit]) el.addEventListener('input', upd);
    rows.add(row); tbody.append(tr); upd();
  };
  add(); add();
  const err = h('p', { class: 'form-error', role: 'alert', hidden: true });
  return page({ title: 'Buchen', subtitle: 'Manuelle Buchung nach doppelter Buchführung (Soll an Haben). Kunden- und Lieferantenkonten werden über Belege gebucht.', back: ['#/accounting/journal', 'Journal'] },
    card(null, f.el), card('Buchungszeilen', h('div', { class: 'table-wrap' }, h('table', { class: 'data lines' }, h('thead', null, h('tr', null, ['Konto', 'Soll €', 'Haben €', 'Text', ''].map((t) => h('th', null, t)))), tbody)), h('div', { class: 'lines-foot' }, btn('Zeile hinzufügen', add, 'small', 'plus'), diff)), err,
    h('div', { class: 'form-actions' }, btn('Abbrechen', () => history.back()), btn('Buchen', async (e) => {
      err.hidden = true; e.currentTarget.disabled = true;
      try {
        const v = f.get();
        const lines = []; for (const r of rows) { const x = r.read(); const d = x.debit.trim() === '' ? 0 : parseMoney(x.debit), c = x.credit.trim() === '' ? 0 : parseMoney(x.credit); if (!x.account && !d && !c) continue; if (!x.account) throw new Error('Bitte für jede Zeile ein Konto wählen'); if (d === null || c === null) throw new Error('Bitte gültige Beträge eingeben (z. B. 12,50)'); lines.push({ account_id: Number(x.account), debit_cents: d, credit_cents: c, text: x.text.trim() || undefined }); }
        const r = await api.post('/accounting/journal', { date: v.date, text: v.text, lines });
        toast(`Buchung ${r.number} gespeichert`); navigate('/accounting/journal');
      } catch (ex) { err.textContent = ex.message || errMsg(ex); err.hidden = false; e.currentTarget.disabled = false; }
    }, 'primary')));
}, 'accounting:w');

// ---------- Kontenplan, Kontoblatt ----------
register('/accounting/accounts', async ({ query }) => {
  const kind = query.kind || 'general';
  const d = await api.get(`/accounting/accounts${qs({ kind, limit: 2000 })}`);
  const W = can('accounting:w');
  const add = () => formDialog({ title: 'Neues Sachkonto', fields: [{ name: 'number', label: 'Kontonummer (4-stellig)', required: true, maxlength: 4 }, { name: 'name', label: 'Bezeichnung', required: true, maxlength: 200 }, { name: 'type', label: 'Kontoart', type: 'select', options: Object.entries(TYPE_LABEL) }], onSubmit: async (v) => { await api.post('/accounting/accounts', v); toast('Konto angelegt'); refresh(); } });
  const edit = (a) => formDialog({ title: `Konto ${a.number}`, values: a, fields: [{ name: 'name', label: 'Bezeichnung', required: true, maxlength: 200 }, a.system_key ? null : { name: 'active', label: 'Aktiv', type: 'checkbox' }].filter(Boolean), onSubmit: async (v) => { await api.put(`/accounting/accounts/${a.id}`, { name: v.name, ...(a.system_key ? {} : { active: v.active }) }); toast('Gespeichert'); refresh(); } });
  return page({ title: 'Kontenplan', subtitle: 'Kontenrahmen angelehnt an SKR03 (Auszug). Bitte mit Ihrem Steuerberater abstimmen.', actions: W && kind === 'general' ? [btn('Neues Sachkonto', add, 'primary', 'plus')] : [] },
    tabs([['general', 'Sachkonten', '#/accounting/accounts'], ['debtor', 'Debitoren (Kunden)', '#/accounting/accounts?kind=debtor'], ['creditor', 'Kreditoren (Lieferanten)', '#/accounting/accounts?kind=creditor']], kind),
    table({ rows: d.rows, exportName: 'kontenplan', empty: 'Keine Konten.', onRow: (a) => navigate(`/accounting/accounts/${a.id}`), rowClass: (a) => (a.active ? '' : 'inactive'), columns: [
      { key: 'number', label: 'Nr.', render: (a) => h('a', { href: `#/accounting/accounts/${a.id}` }, a.number) }, { key: 'name', label: 'Bezeichnung' }, { label: 'Art', render: (a) => TYPE_LABEL[a.type], csv: (a) => TYPE_LABEL[a.type] },
      { label: 'Saldo', align: 'right', sort: (a) => a.balance_cents, render: (a) => (a.balance_cents ? sh(a.balance_cents) : '–'), csv: (a) => a.balance_cents / 100 }, ...(W && kind === 'general' ? [{ label: '', render: (a) => btn('', () => edit(a), 'icon', 'edit') }] : [])] }));
}, 'accounting:r');

register('/accounting/accounts/:id', async ({ params, query }) => {
  const r = range(query);
  const l = await api.get(`/accounting/accounts/${params.id}/ledger${qs({ from: query.from || '', to: query.to || '' })}`);
  const a = l.account;
  const rows = [{ date: '', number: '', text: 'Anfangsbestand', debit_cents: 0, credit_cents: 0, balance_cents: l.opening_cents }, ...l.rows];
  const party = a.kind === 'debtor' ? `#/customers/${a.party_id}` : a.kind === 'creditor' ? `#/suppliers/${a.party_id}` : null;
  return page({ title: `${a.number} ${a.name}`, subtitle: `${TYPE_LABEL[a.type]}konto${a.iban ? ` · IBAN ${a.iban}` : ''}`, back: [a.kind === 'bank' || a.kind === 'cash' ? '#/accounting' : '#/accounting/accounts', 'Zurück'], actions: [party ? h('a', { class: 'btn', href: party }, 'Zum Stammsatz') : null, btn('Drucken', () => window.print(), '', 'print')] },
    h('div', { class: 'kpis' }, kpi('Saldo', sh(l.closing_cents), l.closing_cents < 0 && a.type === 'asset' ? 'bad' : ''), kpi('Anfangsbestand', sh(l.opening_cents)), kpi('Buchungen im Zeitraum', String(l.rows.length))),
    h('form', { class: 'filters', onsubmit: (e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); navigate(`/accounting/accounts/${params.id}?from=${fd.get('from')}&to=${fd.get('to')}`); } }, h('label', { class: 'inline' }, 'Von ', h('input', { type: 'date', name: 'from', value: query.from || '' })), h('label', { class: 'inline' }, 'Bis ', h('input', { type: 'date', name: 'to', value: query.to || '' })), h('button', { class: 'btn small', type: 'submit' }, 'Anzeigen')),
    table({ rows, exportName: `konto-${a.number}`, columns: [{ label: 'Datum', render: (x) => dateDE(x.date), csv: (x) => x.date }, { label: 'Buchung', render: (x) => (x.entry_id ? h('a', { href: '#', onclick: (e) => { e.preventDefault(); guard(() => entryDialog(x.entry_id)); } }, x.number) : ''), csv: (x) => x.number }, { key: 'text', label: 'Text' }, { label: 'Gegenkonto', render: (x) => x.counter || '' }, { label: 'Soll', align: 'right', render: (x) => (x.debit_cents ? eur(x.debit_cents) : ''), csv: (x) => x.debit_cents / 100 }, { label: 'Haben', align: 'right', render: (x) => (x.credit_cents ? eur(x.credit_cents) : ''), csv: (x) => x.credit_cents / 100 }, { label: 'Saldo', align: 'right', render: (x) => sh(x.balance_cents), csv: (x) => x.balance_cents / 100 }] }));
}, 'accounting:r');

// ---------- Offene Posten, Zahlungen ----------
register('/accounting/open-items', async ({ query }) => {
  const type = query.type === 'creditors' ? 'creditors' : 'debtors';
  const d = await api.get(`/accounting/open-items?type=${type}`);
  const b = d.buckets;
  return page({ title: 'Offene Posten', subtitle: 'Nicht bezahlte Rechnungen mit Altersstruktur nach Fälligkeit' },
    tabs([['debtors', 'Debitoren (Kunden)', '#/accounting/open-items'], ['creditors', 'Kreditoren (Lieferanten)', '#/accounting/open-items?type=creditors']], type),
    h('div', { class: 'kpis' }, kpi('Offen gesamt', eur(d.total_cents)), kpi('Nicht fällig', eur(b.not_due)), kpi('1–30 Tage überfällig', eur(b.d1_30), b.d1_30 ? 'warn' : ''), kpi('31–60 Tage', eur(b.d31_60), b.d31_60 ? 'warn' : ''), kpi('61–90 Tage', eur(b.d61_90), b.d61_90 ? 'bad' : ''), kpi('über 90 Tage', eur(b.d90), b.d90 ? 'bad' : '')),
    table({ rows: d.rows, exportName: `offene-posten-${type}`, empty: 'Keine offenen Posten – alles bezahlt.', rowClass: (r) => (r.days_overdue > 0 ? 'warnrow' : ''), columns: [
      { label: type === 'debtors' ? 'Kunde' : 'Lieferant', render: (r) => h('a', { href: `#/${type === 'debtors' ? 'customers' : 'suppliers'}/${r.party_id}` }, r.party), csv: (r) => r.party }, { label: 'Beleg', render: (r) => h('a', { href: type === 'debtors' ? `#/sales/invoices/${r.id}` : `#/purchasing/invoices/${r.id}` }, r.number), csv: (r) => r.number },
      ...(type === 'creditors' ? [{ key: 'supplier_ref', label: 'Rechnungsnr. Lieferant' }] : []), { label: 'Datum', sort: (r) => r.date, render: (r) => dateDE(r.date), csv: (r) => r.date }, { label: 'Fällig', sort: (r) => r.due_date || '', render: (r) => dateDE(r.due_date), csv: (r) => r.due_date || '' },
      { label: 'Überfällig', align: 'right', sort: (r) => r.days_overdue, render: (r) => (r.days_overdue ? h('span', { class: 'neg' }, `${r.days_overdue} Tage`) : '–'), csv: (r) => r.days_overdue }, { label: 'Brutto', align: 'right', render: (r) => eur(r.gross_cents), csv: (r) => r.gross_cents / 100 }, { label: 'Offen', align: 'right', sort: (r) => r.open_cents, render: (r) => h('strong', null, eur(r.open_cents)), csv: (r) => r.open_cents / 100 }] }));
}, 'accounting:r');

register('/accounting/payments', async ({ query }) => {
  const r = range(query);
  const d = await api.get(`/accounting/payments${qs({ from: r.from, to: r.to })}`);
  return page({ title: 'Zahlungen', subtitle: 'Alle erfassten Zahlungseingänge und -ausgänge' }, rangeBar(query, '/accounting/payments'),
    table({ rows: d.rows, exportName: 'zahlungen', empty: 'Keine Zahlungen im Zeitraum.', rowClass: (x) => (x.reversed ? 'inactive' : ''), columns: [
      { label: 'Datum', sort: (x) => x.date, render: (x) => dateDE(x.date), csv: (x) => x.date }, { label: 'Art', render: (x) => (x.kind === 'customer' ? 'Eingang' : 'Ausgang'), csv: (x) => (x.kind === 'customer' ? 'Eingang' : 'Ausgang') }, { key: 'party', label: 'Kunde / Lieferant' },
      { label: 'Beleg', render: (x) => h('a', { href: x.ref_type === 'invoice' ? `#/sales/invoices/${x.ref_id}` : `#/purchasing/invoices/${x.ref_id}` }, x.doc_number), csv: (x) => x.doc_number }, { label: 'Konto', render: (x) => `${x.account_number} ${x.account_name}`, csv: (x) => `${x.account_number} ${x.account_name}` }, { key: 'reference', label: 'Verwendungszweck' },
      { label: 'Betrag', align: 'right', sort: (x) => x.amount_cents, render: (x) => h('span', { class: `${x.kind === 'customer' ? 'pos' : 'neg'}${x.reversed ? ' strike' : ''}` }, `${x.kind === 'customer' ? '+' : '−'}${eur(x.amount_cents)}`), csv: (x) => (x.kind === 'customer' ? 1 : -1) * x.amount_cents / 100 }, { label: '', render: (x) => (x.reversed ? h('span', { class: 'badge gray' }, 'storniert') : '') }] }));
}, 'accounting:r');

// ---------- Auswertungen ----------
const REPORTS = [['susa', 'Summen- & Saldenliste'], ['pnl', 'Gewinn und Verlust'], ['bilanz', 'Bilanz-Übersicht'], ['ust', 'Umsatzsteuer']];
register('/accounting/reports', async ({ query }) => {
  const rep = REPORTS.some((r) => r[0] === query.r) ? query.r : 'susa';
  const r = rep === 'ust' ? { from: query.from || new Date().toISOString().slice(0, 8) + '01', to: query.to || new Date(year, new Date().getMonth() + 1, 0).toLocaleDateString('sv-SE') } : range(query);
  const toBalance = query.to || todayISO();
  const from = h('input', { type: 'date', value: r.from, 'aria-label': 'Von' }), to = h('input', { type: 'date', value: rep === 'bilanz' ? toBalance : r.to, 'aria-label': 'Bis' });
  const go = () => navigate(`/accounting/reports?r=${rep}&from=${from.value}&to=${to.value}`);
  from.addEventListener('change', go); to.addEventListener('change', go);
  const bar = h('div', { class: 'filters' }, rep === 'bilanz' ? null : h('label', { class: 'inline' }, 'Von ', from), h('label', { class: 'inline' }, rep === 'bilanz' ? 'Stichtag ' : 'Bis ', to));
  let body;
  if (rep === 'susa') {
    const d = await api.get(`/reports/trial-balance${qs({ from: r.from, to: r.to, detail: query.detail })}`);
    body = h('div', null, h('label', { class: 'check inline' }, h('input', { type: 'checkbox', checked: query.detail === '1', onchange: (e) => navigate(`/accounting/reports?r=susa&from=${r.from}&to=${r.to}${e.target.checked ? '&detail=1' : ''}`) }), 'Personenkonten einzeln anzeigen'),
      table({ rows: d.rows, exportName: 'summen-und-saldenliste', foot: h('tr', { class: 'total' }, h('td', { colspan: 3 }, 'Summe'), h('td', { class: 'num' }, eur(d.totals.debit_cents)), h('td', { class: 'num' }, eur(d.totals.credit_cents)), h('td', { class: 'num' }, sh(d.totals.closing_cents))),
        columns: [{ key: 'number', label: 'Konto', render: (x) => (x.id ? h('a', { href: `#/accounting/accounts/${x.id}` }, x.number) : x.number) }, { key: 'name', label: 'Bezeichnung' }, { label: 'Anfangssaldo', align: 'right', render: (x) => (x.opening_cents ? sh(x.opening_cents) : ''), csv: (x) => x.opening_cents / 100 }, { label: 'Soll', align: 'right', render: (x) => (x.debit_cents ? eur(x.debit_cents) : ''), csv: (x) => x.debit_cents / 100 }, { label: 'Haben', align: 'right', render: (x) => (x.credit_cents ? eur(x.credit_cents) : ''), csv: (x) => x.credit_cents / 100 }, { label: 'Endsaldo', align: 'right', render: (x) => sh(x.closing_cents), csv: (x) => x.closing_cents / 100 }] }));
  } else if (rep === 'pnl') {
    const d = await api.get(`/reports/pnl${qs({ from: r.from, to: r.to })}`);
    const block = (title, items, total) => card(title, table({ rows: items, empty: 'Keine Buchungen', columns: [{ key: 'number', label: 'Konto' }, { key: 'name', label: 'Bezeichnung' }, { label: 'Betrag', align: 'right', render: (x) => eur(x.cents) }], foot: h('tr', { class: 'total' }, h('td', { colspan: 2 }, 'Summe'), h('td', { class: 'num' }, eur(total))) }));
    body = h('div', null, h('div', { class: 'kpis' }, kpi('Erlöse', eur(d.revenue_total_cents)), kpi('Rohertrag (Erlöse − Wareneinsatz)', eur(d.gross_profit_cents)), kpi('Aufwand gesamt', eur(d.expense_total_cents)), kpi(d.result_cents >= 0 ? 'Gewinn' : 'Verlust', eur(d.result_cents), d.result_cents >= 0 ? 'good' : 'bad')),
      block('Erlöse', d.revenue, d.revenue_total_cents), ...d.groups.map((g) => block(g.label, g.items, g.total_cents)),
      h('p', { class: 'muted small' }, 'Hinweis: Der Wareneinsatz wird nach dem Wareneinkaufskonto-Verfahren in der Eingangsrechnung gebucht; Bestandsveränderungen zum Jahresende buchen Sie manuell (3980/3960).'));
  } else if (rep === 'bilanz') {
    const d = await api.get(`/reports/balance-sheet${qs({ to: toBalance })}`);
    const side = (title, items, extra, total) => card(title, table({ rows: [...items, ...extra], empty: 'Keine Konten', columns: [{ key: 'number', label: 'Konto' }, { key: 'name', label: 'Bezeichnung' }, { label: 'Betrag', align: 'right', render: (x) => eur(x.cents) }], foot: h('tr', { class: 'total' }, h('td', { colspan: 2 }, 'Summe'), h('td', { class: 'num' }, eur(total))) }));
    body = h('div', { class: 'grid-2' }, side('Aktiva (Vermögen)', d.assets, [], d.assets_total_cents), side('Passiva (Kapital und Schulden)', [...d.liabilities, ...d.equity], [{ number: '', name: d.result_cents >= 0 ? 'Gewinn laufender Zeitraum' : 'Verlust laufender Zeitraum', cents: d.result_cents }], d.passiva_total_cents));
  } else {
    const d = await api.get(`/reports/vat${qs({ from: r.from, to: r.to })}`);
    body = h('div', null, h('div', { class: 'kpis' }, kpi('Umsatzsteuer', eur(d.output_total_cents)), kpi('Abziehbare Vorsteuer', eur(d.input_total_cents)), kpi(d.payable_cents >= 0 ? 'Zahllast an das Finanzamt' : 'Erstattung vom Finanzamt', eur(Math.abs(d.payable_cents)), d.payable_cents > 0 ? 'warn' : 'good')),
      card('Umsätze', table({ rows: d.sales, columns: [{ key: 'label', label: 'Art' }, { label: 'Bemessungsgrundlage (netto)', align: 'right', render: (x) => eur(x.net_cents) }, { label: 'Steuer', align: 'right', render: (x) => eur(x.tax_cents) }] })),
      card('Vorsteuer', table({ rows: d.input, columns: [{ key: 'label', label: 'Art' }, { label: 'Steuer', align: 'right', render: (x) => eur(x.tax_cents) }] })),
      h('p', { class: 'muted small' }, 'Vereinfachte Auswertung nach Soll-Versteuerung aus den gebuchten Konten (ohne innergemeinschaftliche Lieferungen, Reverse-Charge und Sondersachverhalte). Sie ersetzt keine Umsatzsteuer-Voranmeldung über ELSTER – bitte mit dem Steuerberater abstimmen.'));
  }
  return page({ title: 'Auswertungen', subtitle: 'Summen- und Saldenliste, GuV, Bilanz-Übersicht und Umsatzsteuer aus den Buchungen', actions: [btn('Drucken', () => window.print(), '', 'print')] },
    tabs(REPORTS.map(([k, l]) => [k, l, `#/accounting/reports?r=${k}`]), rep), bar, body);
}, 'accounting:r');
