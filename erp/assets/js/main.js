import { api, setUnauthorizedHandler } from './api.js';
import { state, can, currentRoute, matchRoute, navigate, setTitle } from './core.js';
import { h, icon, clear, toast, errMsg, form, loading, card } from './ui.js';
import './views/dashboard.js';
import './views/crm.js';
import './views/catalog.js';
import './views/sales.js';
import './views/purchasing.js';
import './views/logistics.js';
import './views/accounting.js';
import './views/admin.js';

const app = document.getElementById('app');

// ---------- Navigation ----------
const NAV = [
  { title: null, items: [['/', 'Übersicht', 'home', null]] },
  { title: 'Verkauf', items: [
    ['/customers', 'Kunden', 'users', 'crm:r'], ['/sales/quotes', 'Angebote', 'doc', 'sales:r'], ['/sales/orders', 'Aufträge', 'cart', 'sales:r'],
    ['/sales/deliveries', 'Lieferscheine', 'truck', 'sales:r'], ['/sales/invoices', 'Rechnungen', 'euro', 'sales:r'], ['/sales/credit-notes', 'Gutschriften', 'doc', 'sales:r'] ] },
  { title: 'Einkauf', items: [
    ['/suppliers', 'Lieferanten', 'users', 'purchasing:r'], ['/purchasing/orders', 'Bestellungen', 'cart', 'purchasing:r'], ['/purchasing/receipts', 'Wareneingänge', 'box', 'purchasing:r'],
    ['/purchasing/invoices', 'Eingangsrechnungen', 'euro', 'purchasing:r'], ['/purchasing/reorder', 'Nachbestellung', 'warn', 'purchasing:r'] ] },
  { title: 'Lager', items: [
    ['/products', 'Artikel', 'box', 'sales:r'], ['/stock', 'Bestand', 'box', 'stock:r'], ['/stock/movements', 'Bewegungen', 'doc', 'stock:r'],
    ['/inventory', 'Inventur', 'check', 'stock:r'], ['/warehouses', 'Lagerorte', 'home', 'stock:r'] ] },
  { title: 'Logistik', items: [['/logistics/shipments', 'Sendungen', 'truck', 'logistics:r'], ['/logistics/carriers', 'Frachtführer', 'truck', 'logistics:r']] },
  { title: 'Buchhaltung', items: [
    ['/accounting', 'Eigene Konten', 'book', 'accounting:r'], ['/accounting/journal', 'Journal', 'book', 'accounting:r'], ['/accounting/book', 'Buchen', 'plus', 'accounting:w'],
    ['/accounting/open-items', 'Offene Posten', 'euro', 'accounting:r'], ['/accounting/payments', 'Zahlungen', 'euro', 'accounting:r'],
    ['/accounting/accounts', 'Kontenplan', 'book', 'accounting:r'], ['/accounting/reports', 'Auswertungen', 'chart', 'accounting:r'] ] },
  { title: 'Auswertung', items: [['/reports/sales', 'Verkauf & Umsatz', 'chart', 'reports:r']] },
  { title: 'Verwaltung', items: [['/settings', 'Firma & Einstellungen', 'gear', 'admin:r'], ['/users', 'Benutzer', 'users', 'admin:r'], ['/plan', 'Tarif', 'gear', 'admin:r'], ['/audit', 'Protokoll', 'doc', 'admin:r']] },
];
const QUICK = [
  ['Kunde', '/customers/new', 'crm:w'], ['Angebot', '/sales/quotes/new', 'sales:w'], ['Auftrag', '/sales/orders/new', 'sales:w'], ['Rechnung', '/sales/invoices/new', 'sales:w'],
  ['Artikel', '/products/new', 'stock:w'], ['Bestellung', '/purchasing/orders/new', 'purchasing:w'], ['Eingangsrechnung', '/purchasing/invoices/new', 'purchasing:w'], ['Sendung', '/logistics/shipments/new', 'logistics:w'],
];

let mainEl;
let navEl;

function shell() {
  navEl = h('nav', { class: 'nav', 'aria-label': 'Hauptmenü' }, NAV.map((g) => {
    const items = g.items.filter(([, , , perm]) => !perm || can(perm));
    if (!items.length) return null;
    return h('div', { class: 'nav-group' }, g.title ? h('h2', null, g.title) : null, items.map(([href, label, ic]) => h('a', { href: `#${href}`, class: 'nav-link', dataset: { href } }, icon(ic, 17), label)));
  }));
  const quick = QUICK.filter(([, , perm]) => can(perm));
  const menu = h('details', { class: 'menu' },
    h('summary', { class: 'btn primary small' }, icon('plus', 16), 'Neu'),
    h('div', { class: 'menu-list' }, quick.map(([label, href]) => h('a', { href: `#${href}`, onclick: () => { menu.open = false; } }, label))));
  document.addEventListener('click', (e) => { if (menu.open && !menu.contains(e.target)) menu.open = false; });
  mainEl = h('main', { class: 'main', id: 'main', tabindex: -1 });
  const side = h('aside', { class: 'sidebar' },
    h('a', { class: 'brand', href: '#/' }, h('span', { class: 'brand-mark', 'aria-hidden': 'true' }, 'D'), h('span', null, h('strong', null, 'D-Group ERP'), h('small', null, state.me.tenant.name))),
    navEl);
  const top = h('header', { class: 'topbar no-print' },
    h('button', { class: 'icon-btn nav-toggle', type: 'button', 'aria-label': 'Menü', onclick: () => document.body.classList.toggle('nav-open') }, icon('menu', 22)),
    quick.length ? menu : null,
    h('span', { class: 'spacer' }),
    h('span', { class: 'who' }, h('strong', null, state.me.user.name), h('small', null, `${state.me.user.role_label} · ${state.me.tenant.plan_label}`)),
    h('button', { class: 'btn small', type: 'button', onclick: logout }, icon('logout', 16), 'Abmelden'));
  clear(app).className = 'layout';
  app.append(side, h('div', { class: 'content' }, top, mainEl), h('div', { class: 'scrim', onclick: () => document.body.classList.remove('nav-open') }));
  app.prepend(h('a', { class: 'skip', href: '#main', onclick: (e) => { e.preventDefault(); mainEl.focus(); } }, 'Zum Inhalt springen'));
}

async function logout() {
  try { await api.post('/auth/logout'); } catch { /* egal */ }
  state.me = null;
  history.replaceState(null, '', location.pathname);
  showLogin();
}

// ---------- Anmeldung und Registrierung ----------
function showLogin(mode = 'login') {
  document.body.classList.remove('nav-open');
  const isSignup = mode === 'signup';
  const f = form(isSignup
    ? [{ name: 'company', label: 'Firmenname', required: true, wide: true, maxlength: 200 }, { name: 'name', label: 'Ihr Name', required: true, maxlength: 160 }, { name: 'email', label: 'E-Mail', type: 'email', required: true, maxlength: 190 },
       { name: 'password', label: 'Passwort', type: 'password', required: true, wide: true, help: 'Mindestens 10 Zeichen mit Buchstaben und Zahlen.' }]
    : [{ name: 'email', label: 'E-Mail', type: 'email', required: true, wide: true }, { name: 'password', label: 'Passwort', type: 'password', required: true, wide: true }]);
  f.el.classList.add('stack');
  const err = h('p', { class: 'form-error', role: 'alert', hidden: true });
  const go = h('button', { class: 'btn primary block', type: 'submit' }, isSignup ? 'Firma registrieren' : 'Anmelden');
  const el = h('form', { class: 'login-form', novalidate: true, onsubmit: async (e) => {
    e.preventDefault();
    err.hidden = true;
    go.disabled = true;
    try {
      const body = f.get();
      state.me = await api.post(isSignup ? '/auth/signup' : '/auth/login', body);
      await boot();
    } catch (ex) {
      err.textContent = ex.message || errMsg(ex);
      err.hidden = false;
    } finally { go.disabled = false; }
  } }, h('h1', null, isSignup ? 'Neue Firma anlegen' : 'Anmelden'), f.el, err, go,
  h('p', { class: 'switch' }, isSignup ? 'Schon registriert? ' : 'Noch kein Konto? ', h('a', { href: '#', onclick: (e) => { e.preventDefault(); showLogin(isSignup ? 'login' : 'signup'); } }, isSignup ? 'Anmelden' : 'Firma registrieren')));
  clear(app).className = 'login-layout';
  app.append(h('div', { class: 'login-side' },
    h('div', { class: 'brand light' }, h('span', { class: 'brand-mark', 'aria-hidden': 'true' }, 'D'), h('strong', null, 'D-Group ERP')),
    h('h2', null, 'Alles für Ihr Geschäft in einem System.'),
    h('ul', null, ['Verkauf: Angebot, Auftrag, Lieferschein, Rechnung', 'Einkauf und Wareneingang mit Nachbestell-Vorschlägen', 'Lager mit Bestand, Umlagerung und Inventur', 'Logistik mit Sendungsverfolgung', 'Buchhaltung mit Kunden-, Lieferanten- und Bankkonten', 'Kundenverwaltung mit Aufgaben und Kundenakte'].map((t) => h('li', null, icon('check', 16), t)))),
  h('div', { class: 'login-main' }, el));
  setTitle(isSignup ? 'Registrieren' : 'Anmelden');
  f.el.querySelector('input')?.focus();
}

// ---------- Router ----------
let renderToken = 0;
async function renderRoute() {
  if (!state.me || !mainEl) return;
  const token = ++renderToken;
  const { path, query } = currentRoute();
  document.body.classList.remove('nav-open');
  // Aktiver Menüpunkt: der mit dem längsten passenden Pfad
  let best = null;
  for (const a of navEl.querySelectorAll('.nav-link')) {
    const href = a.dataset.href;
    const hit = href === '/' ? path === '/' : path === href || path.startsWith(`${href}/`);
    if (hit && (!best || href.length > best.dataset.href.length)) best = a;
  }
  for (const a of navEl.querySelectorAll('.nav-link')) {
    a.classList.toggle('active', a === best);
    if (a === best) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  }
  const m = matchRoute(path);
  clear(mainEl).append(loading());
  if (!m) { clear(mainEl).append(card('Seite nicht gefunden', h('p', null, 'Diese Seite gibt es nicht. '), h('a', { href: '#/' }, 'Zur Übersicht'))); return; }
  if (m.route.perm && !can(m.route.perm)) { clear(mainEl).append(card('Keine Berechtigung', h('p', null, 'Für diesen Bereich fehlt Ihnen die Berechtigung. Bitte wenden Sie sich an Ihren Administrator.'))); return; }
  try {
    setTitle('');
    const node = await m.route.handler({ params: m.params, query });
    if (token !== renderToken) return;
    clear(mainEl).append(node);
    const t = mainEl.querySelector('h1')?.textContent;
    if (t) setTitle(t);
    window.scrollTo(0, 0);
  } catch (e) {
    if (token !== renderToken) return;
    clear(mainEl).append(card('Fehler', h('p', { class: 'form-error' }, errMsg(e)), h('button', { class: 'btn', type: 'button', onclick: renderRoute }, 'Erneut versuchen')));
  }
}
window.addEventListener('hashchange', renderRoute);
document.addEventListener('erp:refresh', renderRoute);

async function boot() {
  try {
    state.company = await api.get('/company');
  } catch { state.company = {}; }
  shell();
  await renderRoute();
}

setUnauthorizedHandler(() => { if (state.me) { state.me = null; toast('Die Sitzung ist abgelaufen. Bitte neu anmelden.', 'error'); showLogin(); } });

(async () => {
  try {
    const me = await api.get('/auth/me');
    if (!me.user) { showLogin(); return; }
    state.me = me;
    await boot();
  } catch {
    showLogin();
  }
})();
