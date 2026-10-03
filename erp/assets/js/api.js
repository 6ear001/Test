// Zugriff auf die API. Alle Aufrufe tragen X-Requested-With (Schutz vor fremden Seiten) und senden/erwarten JSON.
// Die API wird über api.php?_p=/pfad angesprochen. Das funktioniert auf jedem Webspace, auch ohne mod_rewrite.
const BASE = new URL('api.php', document.baseURI).href;

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

async function request(method, path, body) {
  const opts = { method, credentials: 'same-origin', headers: { 'X-Requested-With': 'erp', Accept: 'application/json' } };
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  let res;
  try {
    const [route, query = ''] = path.split('?');
    res = await fetch(`${BASE}?_p=${encodeURIComponent(route)}${query ? `&${query}` : ''}`, opts);
  } catch {
    throw new ApiError(0, 'Keine Verbindung zum Server.');
  }
  let data = {};
  try { data = await res.json(); } catch { /* leere Antwort */ }
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/auth/')) onUnauthorized();
    throw new ApiError(res.status, data.error || `Fehler ${res.status}`);
  }
  return data;
}

export const api = {
  get: (p) => request('GET', p),
  post: (p, b = {}) => request('POST', p, b),
  put: (p, b = {}) => request('PUT', p, b),
  del: (p) => request('DELETE', p),
};

/** Baut eine Query-Zeichenkette aus einem Objekt (leere Werte werden weggelassen). */
export const qs = (obj) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(obj || {})) if (v !== '' && v !== null && v !== undefined) p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
};
