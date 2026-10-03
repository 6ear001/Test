// Verwaltung (Firma, Benutzer, Tarif, Protokoll), eigenes Konto und die Verkaufsauswertung.
import { api, qs } from '../api.js';
import { register, state, can, navigate } from '../core.js';
import { h, page, card, kpi, table, badge, btn, kv, formDialog, form, confirmDialog, guard, toast, eur, num, dateDE, dateTimeDE, tabs, barChart, errMsg, todayISO } from '../ui.js';

const refresh = () => document.dispatchEvent(new Event('erp:refresh'));

register('/settings', async () => {
  const s = await api.get('/settings');
  const f = form([
    { type: 'heading', label: 'Firma (erscheint auf Rechnungen und Belegen)' },
    { name: 'company_name', label: 'Firmenname', required: true, wide: true, maxlength: 200 }, { name: 'street', label: 'Straße und Nr.', wide: true, maxlength: 200 }, { name: 'zip', label: 'PLZ', maxlength: 20 }, { name: 'city', label: 'Ort', maxlength: 120 },
    { name: 'phone', label: 'Telefon', maxlength: 60 }, { name: 'email', label: 'E-Mail', type: 'email', maxlength: 190 }, { name: 'website', label: 'Webseite', maxlength: 200 }, { name: 'managing_director', label: 'Geschäftsführung / Inhaber', maxlength: 200 },
    { name: 'register', label: 'Handelsregister', maxlength: 200, placeholder: 'z. B. Amtsgericht München, HRB 12345' }, { name: 'vat_id', label: 'USt-IdNr.', maxlength: 30 }, { name: 'tax_no', label: 'Steuernummer', maxlength: 30 },
    { type: 'heading', label: 'Bankverbindung (für Rechnungen)' },
    { name: 'bank_name', label: 'Bank', maxlength: 120 }, { name: 'iban', label: 'IBAN', maxlength: 40 }, { name: 'bic', label: 'BIC', maxlength: 20 },
    { type: 'heading', label: 'Belege und Lager' },
    { name: 'payment_days', label: 'Standard-Zahlungsziel (Tage)', type: 'number', empty: 14 }, { name: 'doc_footer', label: 'Zusatztext in der Fußzeile der Belege', type: 'textarea', rows: 2, wide: true, maxlength: 600 },
    { name: 'allow_negative_stock', label: 'Negative Lagerbestände erlauben (Lieferung auch ohne Bestand buchen)', type: 'checkbox', wide: true },
  ], s);
  const lock = form([{ name: 'books_closed_until', label: 'Buchhaltung festgeschrieben bis (einschließlich)', type: 'date', help: 'Bis zu diesem Datum sind keine Buchungen mehr möglich (z. B. nach der Steuererklärung oder Voranmeldung).' }], s);
  const err = h('p', { class: 'form-error', role: 'alert', hidden: true });
  const save = (getter, msg) => async (e) => { err.hidden = true; e.currentTarget.disabled = true; try { await api.put('/settings', getter()); state.company = await api.get('/company'); toast(msg); refresh(); } catch (ex) { err.textContent = ex.message || errMsg(ex); err.hidden = false; e.currentTarget.disabled = false; } };
  return page({ title: 'Firma & Einstellungen', subtitle: 'Diese Angaben erscheinen auf Ihren Belegen. Bitte vollständig und korrekt pflegen.' },
    card(null, f.el, h('div', { class: 'form-actions' }, btn('Speichern', save(() => { const v = f.get(); v.payment_days = Math.round(v.payment_days); return v; }, 'Gespeichert'), 'primary'))),
    card('Festschreibung', lock.el, h('div', { class: 'form-actions' }, btn('Festschreibung speichern', save(() => { const v = lock.get(); return { books_closed_until: v.books_closed_until || null }; }, 'Festschreibung gespeichert'), ''))), err);
}, 'admin:r');

register('/users', async () => {
  const d = await api.get('/users');
  const roles = d.roles.map((r) => [r.key, r.label]);
  const edit = (u) => formDialog({ title: u ? `Benutzer ${u.name}` : 'Neuer Benutzer', values: u || { role: 'sales' }, wide: true,
    fields: [{ name: 'name', label: 'Name', required: true, maxlength: 160 }, u ? null : { name: 'email', label: 'E-Mail', type: 'email', required: true, maxlength: 190 }, { name: 'role', label: 'Rolle', type: 'select', options: roles }, { name: 'password', label: u ? 'Neues Passwort (leer lassen = unverändert)' : 'Startpasswort', type: 'password', required: !u, help: 'Mindestens 10 Zeichen mit Buchstaben und Zahlen.' }, u ? { name: 'active', label: 'Aktiv (darf sich anmelden)', type: 'checkbox' } : null].filter(Boolean),
    onSubmit: async (v) => { if (u) await api.put(`/users/${u.id}`, { name: v.name, role: v.role, active: v.active, password: v.password || undefined }); else await api.post('/users', v); toast('Gespeichert'); refresh(); } });
  return page({ title: 'Benutzer', subtitle: 'Mitarbeiter mit Rollen: Administrator, Buchhaltung, Vertrieb, Einkauf, Lager & Logistik, Nur lesen', actions: [btn('Neuer Benutzer', () => edit(null), 'primary', 'plus')] },
    table({ rows: d.rows, columns: [{ key: 'name', label: 'Name' }, { key: 'email', label: 'E-Mail' }, { label: 'Rolle', render: (u) => roles.find((r) => r[0] === u.role)?.[1] || u.role }, { label: 'Letzte Anmeldung', render: (u) => (u.last_login ? dateTimeDE(u.last_login) : 'noch nie') }, { label: 'Status', render: (u) => (u.active ? h('span', { class: 'badge green' }, 'aktiv') : h('span', { class: 'badge gray' }, 'gesperrt')) }, { label: '', render: (u) => btn('Bearbeiten', () => edit({ ...u, password: '' }), 'small', 'edit') }] }),
    card('Rollen im Überblick', kv([['Administrator', 'Alles inklusive Einstellungen und Benutzer'], ['Buchhaltung', 'Buchhaltung, Zahlungen, Auswertungen; lesender Zugriff auf alles andere'], ['Vertrieb', 'Kunden, Angebote, Aufträge, Rechnungen'], ['Einkauf', 'Lieferanten, Bestellungen, Eingangsrechnungen'], ['Lager & Logistik', 'Artikel, Bestand, Wareneingang, Lieferung, Sendungen'], ['Nur lesen', 'Ansehen ohne Änderungen (ohne Buchhaltung)']])));
}, 'admin:r');

register('/plan', async () => {
  const d = await api.get('/plan');
  return page({ title: 'Tarif', subtitle: `Aktueller Tarif: ${d.label}` },
    h('div', { class: 'grid-2' }, card('Nutzung', kv([['Benutzer', `${d.usage.users} von ${d.limits.users}`], ['Belege diesen Monat (Angebote, Aufträge, Rechnungen)', `${d.usage.docs_this_month} von ${d.limits.docs_per_month}`]])),
      card('Tarif wechseln', h('p', null, 'Tarifwechsel und Abrechnung erfolgen über Ihren Anbieter. Bitte melden Sie sich bei Ihrem Ansprechpartner.'))),
    card('Verfügbare Tarife', table({ rows: Object.entries(d.plans).map(([k, v]) => ({ k, ...v })), columns: [{ label: 'Tarif', render: (p) => h('span', null, p.label, p.k === d.plan ? h('span', { class: 'badge blue tight' }, 'aktuell') : null) }, { label: 'Benutzer', align: 'right', render: (p) => num(p.users) }, { label: 'Belege pro Monat', align: 'right', render: (p) => num(p.docs_per_month) }] })));
}, 'admin:r');

register('/audit', async () => {
  const d = await api.get('/audit?limit=300');
  const ACTION = { create: 'angelegt', update: 'geändert', delete: 'gelöscht', issue: 'ausgestellt', cancel: 'storniert', reverse: 'storniert', order: 'bestellt', finish: 'abgeschlossen', adjust: 'korrigiert', transfer: 'umgebucht', private: 'Privatbuchung', password: 'Passwort geändert' };
  return page({ title: 'Protokoll', subtitle: 'Wer hat wann was geändert (die letzten 300 Einträge)' }, table({ rows: d.rows, exportName: 'protokoll', empty: 'Noch keine Einträge.', columns: [{ label: 'Zeit', sort: (r) => r.ts, render: (r) => dateTimeDE(r.ts), csv: (r) => r.ts }, { key: 'user_name', label: 'Benutzer' }, { key: 'entity', label: 'Objekt' }, { label: 'Aktion', render: (r) => ACTION[r.action] || r.action, csv: (r) => r.action }, { key: 'detail', label: 'Details' }] }));
}, 'admin:r');

register('/account', async () => {
  const f = form([{ name: 'current', label: 'Aktuelles Passwort', type: 'password', required: true, wide: true }, { name: 'new', label: 'Neues Passwort', type: 'password', required: true, wide: true, help: 'Mindestens 10 Zeichen mit Buchstaben und Zahlen.' }]);
  const err = h('p', { class: 'form-error', role: 'alert', hidden: true });
  return page({ title: 'Mein Konto', subtitle: `${state.me.user.name} · ${state.me.user.email} · ${state.me.user.role_label}` }, card('Passwort ändern', f.el, err, h('div', { class: 'form-actions' }, btn('Passwort ändern', async (e) => { err.hidden = true; e.currentTarget.disabled = true; try { await api.post('/auth/password', f.get()); toast('Passwort geändert'); navigate('/'); } catch (ex) { err.textContent = ex.message || errMsg(ex); err.hidden = false; e.currentTarget.disabled = false; } }, 'primary'))));
});

// ---------- Verkaufsauswertung ----------
register('/reports/sales', async ({ query }) => {
  const year = new Date().getFullYear();
  const from = query.from || `${year}-01-01`, to = query.to || `${year}-12-31`, by = ['customer', 'product', 'month'].includes(query.by) ? query.by : 'customer';
  const d = await api.get(`/reports/sales${qs({ from, to, by })}`);
  const fromEl = h('input', { type: 'date', value: from, 'aria-label': 'Von' }), toEl = h('input', { type: 'date', value: to, 'aria-label': 'Bis' });
  const go = () => navigate(`/reports/sales?by=${by}&from=${fromEl.value}&to=${toEl.value}`);
  fromEl.addEventListener('change', go); toEl.addEventListener('change', go);
  const cols = [{ label: by === 'customer' ? 'Kunde' : by === 'product' ? 'Artikel' : 'Monat', render: (r) => (by === 'product' && r.key_ ? `${r.key_} · ${r.label}` : r.label), csv: (r) => r.label }, ...(by === 'product' ? [{ label: 'Menge', align: 'right', render: (r) => num(r.qty), csv: (r) => r.qty }] : [{ label: 'Belege', align: 'right', render: (r) => r.docs }]),
    { label: 'Umsatz netto', align: 'right', sort: (r) => r.net_cents, render: (r) => eur(r.net_cents), csv: (r) => r.net_cents / 100 }, ...(by !== 'product' ? [{ label: 'Umsatz brutto', align: 'right', render: (r) => eur(r.gross_cents), csv: (r) => r.gross_cents / 100 }] : []),
    { label: 'Anteil', align: 'right', render: (r) => (d.total_net_cents ? `${Math.round((r.net_cents / d.total_net_cents) * 100)} %` : '') }];
  return page({ title: 'Verkauf & Umsatz', subtitle: 'Ausgestellte Rechnungen abzüglich Gutschriften' },
    tabs([['customer', 'Nach Kunde', `#/reports/sales?by=customer&from=${from}&to=${to}`], ['product', 'Nach Artikel', `#/reports/sales?by=product&from=${from}&to=${to}`], ['month', 'Nach Monat', `#/reports/sales?by=month&from=${from}&to=${to}`]], by),
    h('div', { class: 'filters' }, h('label', { class: 'inline' }, 'Von ', fromEl), h('label', { class: 'inline' }, 'Bis ', toEl)),
    h('div', { class: 'kpis' }, kpi('Umsatz netto im Zeitraum', eur(d.total_net_cents))),
    by === 'month' && d.rows.length ? card('Verlauf', barChart(d.rows.map((r) => ({ month: r.key_, cents: r.net_cents })))) : null,
    table({ rows: d.rows, columns: cols, exportName: `umsatz-${by}`, empty: 'Keine Umsätze im Zeitraum.' }));
}, 'reports:r');
