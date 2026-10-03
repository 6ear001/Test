// Gemeinsamer Zustand und Router (Hash-Routing, damit es auf jedem Webspace ohne Server-Regeln funktioniert).
export const state = { me: null, company: null };
export const can = (perm) => !!state.me && state.me.perms.includes(perm);

export const routes = [];
/** Registriert eine Seite: register('/sales/:kind/:id', ({params, query}) => Node | Promise<Node>, 'sales:r') */
export function register(pattern, handler, perm) {
  const names = [];
  const rx = new RegExp('^' + pattern.replace(/:[a-zA-Z]+/g, (m) => { names.push(m.slice(1)); return '([^/]+)'; }) + '$');
  routes.push({ rx, names, handler, perm, pattern });
}
export function currentRoute() {
  const raw = location.hash.slice(1) || '/';
  const [path, query = ''] = raw.split('?');
  return { path: path.replace(/\/+$/, '') || '/', query: Object.fromEntries(new URLSearchParams(query)) };
}
export const navigate = (path) => { location.hash = `#${path}`; };
export function matchRoute(path) {
  for (const r of routes) {
    const m = r.rx.exec(path);
    if (m) return { route: r, params: Object.fromEntries(r.names.map((n, i) => [n, decodeURIComponent(m[i + 1])])) };
  }
  return null;
}
export const setTitle = (t) => { document.title = t ? `${t} · D-Group ERP` : 'D-Group ERP'; };
