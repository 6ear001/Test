// Bausteine für die professionelle Fassung (Video B2): Federn, Maskenreveal, Strich-Symbole, Partikel.
import { h, clamp, lerp, E, px, xf, place } from './lib.js';

export const spr = (t, f = 9, d = 6) => (t <= 0 ? 0 : 1 - Math.exp(-d * t) * Math.cos(f * t));
export const seg = (t, a, b, e = E.out5) => e(clamp((t - a) / (b - a)));
export const rnd = (seed) => { const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

/** Zeile mit Maskenreveal. spec: [{ w: 'Wort', at: Sekunden, cls?: 'klasse' }] – jedes Wort erscheint exakt zum Sprechzeitpunkt. */
export function rline(spec, { size = 120, font = 'lz', color, gap = 0.24, width = 980, lh = 1.2, dur = 0.55, rise = 170, align = 'center' } = {}) {
  const root = h('div', { class: `words ${font}`, style: { fontSize: px(size), width: px(width), lineHeight: lh, columnGap: `${gap}em`, ...(color ? { color } : {}), justifyContent: align === 'center' ? 'center' : align } });
  const items = spec.map((s) => {
    const inner = h('span', { class: `inw ${s.cls || ''}`, style: { display: 'inline-block', willChange: 'transform' } }, s.w);
    const mk = h('span', { class: 'mk' }, inner); root.append(mk); return { s, inner };
  });
  root.update = (t) => items.forEach(({ s, inner }) => { const k = seg(t, s.at, s.at + dur); inner.style.transform = `translateY(${(1 - k) * rise}%)`; });
  return root;
}

const ICONS = {
  bolt: '<path d="M54 6 L20 54 H46 L40 90 L76 40 H50 Z" stroke-linejoin="round"/>',
  eye: '<path d="M6 48 C20 24 36 16 48 16 C60 16 76 24 90 48 C76 72 60 80 48 80 C36 80 20 72 6 48 Z" stroke-linejoin="round"/><circle cx="48" cy="48" r="13"/>',
  grid: '<rect x="12" y="12" width="30" height="30" rx="7"/><rect x="54" y="12" width="30" height="30" rx="7"/><rect x="12" y="54" width="30" height="30" rx="7"/><rect x="54" y="54" width="30" height="30" rx="7"/>',
  shield: '<path d="M48 7 L82 19 V46 C82 68 66 82 48 90 C30 82 14 68 14 46 V19 Z" stroke-linejoin="round"/><path d="M31 48 L43 60 L66 36" stroke-linecap="round" stroke-linejoin="round"/>',
  touch: '<path d="M38 52 V22 a8 8 0 0 1 16 0 V46" stroke-linecap="round"/><path d="M54 40 a8 8 0 0 1 16 0 V50 M70 46 a8 8 0 0 1 14 4 V64 C84 80 74 90 60 90 H50 C40 90 34 84 28 74 L16 56 a7 7 0 0 1 11-9 L38 60" stroke-linecap="round" stroke-linejoin="round"/>',
  scan: '<path d="M8 28 V10 H28 M68 10 H88 V28 M88 68 V86 H68 M28 86 H8 V68" stroke-linecap="round" stroke-linejoin="round"/><path d="M26 30 V66 M36 30 V66 M44 30 V66 M54 30 V66 M62 30 V66 M70 30 V66" stroke-linecap="round"/>',
  pda: '<rect x="26" y="6" width="44" height="84" rx="10"/><rect x="33" y="16" width="30" height="40" rx="4"/><path d="M38 26 H58 M38 34 H58 M38 42 H50" stroke-linecap="round"/><circle cx="40" cy="70" r="4"/><circle cx="56" cy="70" r="4"/>',
  clock: '<circle cx="48" cy="50" r="38"/><path d="M48 26 V50 L64 60" stroke-linecap="round" stroke-linejoin="round"/><path d="M38 8 H58" stroke-linecap="round"/>',
  user: '<circle cx="48" cy="30" r="15"/><path d="M18 88 C18 64 32 54 48 54 C64 54 78 64 78 88" stroke-linecap="round"/>',
  globe: '<circle cx="48" cy="48" r="38"/><ellipse cx="48" cy="48" rx="16" ry="38"/><path d="M10 48 H86 M16 28 H80 M16 68 H80"/>',
  check: '<path d="M22 50 L41 69 L76 31" stroke-linecap="round" stroke-linejoin="round"/>',
  cart: '<path d="M8 14 H20 L30 62 H74 L84 28 H26" stroke-linecap="round" stroke-linejoin="round"/><circle cx="36" cy="78" r="6"/><circle cx="68" cy="78" r="6"/>',
  receipt: '<path d="M22 8 H74 V90 L66 84 L58 90 L50 84 L42 90 L34 84 L22 90 Z" stroke-linejoin="round"/><path d="M34 28 H62 M34 42 H62 M34 56 H50" stroke-linecap="round"/>',
};
export function li(name, size = 96, color = '#fff', stroke = 6) {
  const s = h('svg', { viewBox: '0 0 96 96', width: size, height: size, style: { overflow: 'visible' } });
  s.innerHTML = `<g fill="none" stroke="${color}" stroke-width="${stroke}">${ICONS[name]}</g>`;
  return s;
}

/** Münzen-/Konfetti-Explosion: deterministisch */
export function makeBurst(root, { n = 40, x = 540, y = 900, colors = ['#FFC83D', '#FFFFFF', '#F4343A', '#2FD08A'], speed = 1500, seed = 1 } = {}) {
  const els = Array.from({ length: n }, (_, i) => {
    const kind = rnd(seed + i * 3) > 0.45;
    const sz = 22 + rnd(seed + i) * 34;
    const e = h('div', { style: { position: 'absolute', left: 0, top: 0, width: px(sz), height: px(kind ? sz : sz * 0.45), borderRadius: kind ? '50%' : '4px', background: colors[i % colors.length], boxShadow: kind ? 'inset 0 -6px 0 rgba(0,0,0,.18)' : 'none' } });
    root.append(e); return e;
  });
  return (t) => els.forEach((e, i) => {
    if (t < 0) { e.style.opacity = 0; return; }
    const a = rnd(seed + i * 7) * Math.PI * 2, v = (0.35 + rnd(seed + i * 11) * 0.65) * speed;
    const px_ = x + Math.cos(a) * v * t * 0.9, py_ = y + Math.sin(a) * v * t * 0.9 + 1900 * t * t * 0.5 - 250 * t;
    xf(e, { x: px_, y: py_, r: rnd(seed + i * 5) * 720 * t, o: clamp(1 - (t - 1.0) / 0.6) });
  });
}
