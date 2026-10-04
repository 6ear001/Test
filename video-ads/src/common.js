import { h, clamp, lerp, E, prog, px, xf, place, words, makeMascot } from './lib.js';
import { icon } from './parts.js';

export const bounce = (t) => { const n1 = 7.5625, d1 = 2.75; if (t < 1 / d1) return n1 * t * t; if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75; if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375; return n1 * (t -= 2.625 / d1) * t + 0.984375; };
export const decay = (t, t0, dur = 0.35) => (t < t0 ? 0 : Math.max(0, 1 - (t - t0) / dur));
/** Figur platzieren (Position der linken oberen Ecke der 600×780-Zeichnung) */
export function putMascot(m, { x = 0, y = 0, s = 1, r = 0, o = 1, flip = false } = {}) {
  m.style.left = px(x); m.style.top = px(y); m.style.transformOrigin = '50% 100%';
  m.style.transform = `scale(${flip ? -s : s}, ${s}) rotate(${r}deg)`; m.style.opacity = String(o);
}
/** Fallende Gegenstände (Chaos): items = [{n:'bill', x, y, size, t0, rot, spin, arg}] */
export function makeStickers(root, items) {
  const els = items.map((it) => { const e = place(icon(it.n, it.size, it.arg), 0, 0); e.style.position = 'absolute'; root.append(e); return e; });
  return (lt) => items.forEach((it, i) => {
    const k = clamp((lt - it.t0) / (it.dur || 0.7));
    const yy = lerp(-260, it.y, bounce(k));
    xf(els[i], { x: it.x, y: yy, r: it.rot + it.spin * (1 - E.out(k)) + Math.sin(lt * 2 + i) * 1.5, o: k > 0 ? 1 : 0 });
  });
}
/** Schwebende Gegenstände (Endkarte) */
export function makeFloaters(root, items) {
  const els = items.map((it) => { const e = place(icon(it.n, it.size, it.arg), 0, 0); root.append(e); return e; });
  return (lt) => items.forEach((it, i) => xf(els[i], { x: it.x + Math.sin(lt * 1.1 + i) * 14, y: it.y + Math.cos(lt * 0.9 + i * 2) * 18, r: it.rot + Math.sin(lt + i) * 6, s: prog(lt, it.t0 ?? 0.2 + i * 0.08, 0.5, E.back), o: 0.95 }));
}
export function endCard(root, { headline, sub, cta = 'جرّب الديمو الحي', url = 'd-group-it-solutions.de', clickAt = 2.3, bg = '#F6F0E4' }) {
  root.style.background = bg;
  const glow = h('div', { class: 'layer', style: { background: 'radial-gradient(circle at 50% 30%, rgba(244,52,58,.16), transparent 55%)' } });
  const floaters = makeFloaters(root, [
    { n: 'coin', x: 70, y: 250, size: 130, rot: -14 }, { n: 'receipt', x: 870, y: 190, size: 150, rot: 12, t0: 0.35 }, { n: 'bag', x: 60, y: 1170, size: 140, rot: -10, t0: 0.5 },
    { n: 'bill', x: 850, y: 1150, size: 170, rot: 8, t0: 0.6 }, { n: 'barcode', x: 40, y: 700, size: 120, rot: 8, t0: 0.7 }, { n: 'pda', x: 920, y: 640, size: 130, rot: -10, t0: 0.45 },
  ]);
  const app = h('img', { src: '../img/logo-app.png', style: { position: 'absolute', left: '360px', top: '170px', width: '360px', height: '360px', borderRadius: '82px', boxShadow: '0 30px 0 rgba(11,26,51,.18)' } });
  const logoWrap = h('div', { style: { position: 'absolute', left: '160px', top: '570px', width: '760px', height: '270px', overflow: 'hidden' } }, h('img', { src: '../img/logo-company.png', style: { position: 'absolute', left: 0, top: '-222px', width: '760px', height: '760px' } }));
  const head = words(headline, { size: 100, cls: 'lz', color: '#0B1A33', width: 820, stagger: 0.1 }); place(head, 130, 900);
  const subEl = h('div', { class: 'lat', style: { position: 'absolute', left: 0, top: '1250px', width: '1080px', textAlign: 'center', fontSize: '46px', fontWeight: 600, color: '#5b6478', letterSpacing: '.04em' } }, sub);
  const btn = h('div', { style: { position: 'absolute', left: '150px', top: '1350px', width: '780px', height: '150px', borderRadius: '75px', background: '#F4343A', color: '#fff', display: 'grid', placeItems: 'center', fontSize: '76px', fontWeight: 900, boxShadow: '0 16px 0 #b3151b' } }, cta);
  const urlEl = h('div', { class: 'lat', style: { position: 'absolute', left: 0, top: '1560px', width: '1080px', textAlign: 'center', fontSize: '60px', fontWeight: 700, color: '#0B1A33' } }, url);
  const cursor = h('svg', { viewBox: '0 0 24 24', width: 130, height: 130, style: { position: 'absolute', left: 0, top: 0, zIndex: 5, filter: 'drop-shadow(0 8px 0 rgba(0,0,0,.25))' } });
  cursor.innerHTML = '<path d="M5 2 L5 19 L9.5 15 L12.5 22 L15.5 20.6 L12.6 13.8 L18.5 13.4 Z" fill="#fff" stroke="#111" stroke-width="1.3" stroke-linejoin="round"/>';
  const ring = h('div', { style: { position: 'absolute', width: '120px', height: '120px', borderRadius: '50%', border: '8px solid rgba(255,255,255,.9)', opacity: 0 } });
  root.append(glow, app, logoWrap, head, subEl, btn, urlEl, ring, cursor);
  return (lt) => {
    floaters(lt);
    xf(app, { s: lerp(0.4, 1, E.elastic(clamp(lt / 0.8))), o: clamp(lt * 6), y: Math.sin(lt * 2) * 6 });
    xf(logoWrap, { y: lerp(40, 0, E.out(clamp((lt - 0.3) / 0.5))), o: clamp((lt - 0.3) * 4) });
    head.update(lt, 0.7);
    xf(subEl, { y: lerp(30, 0, E.out(clamp((lt - 1.3) / 0.5))), o: clamp((lt - 1.3) * 3) });
    const pulse = 1 + 0.03 * Math.sin(lt * 7);
    const press = lt > clickAt && lt < clickAt + 0.14;
    xf(btn, { s: prog(lt, 1.5, 0.5, E.back) * (press ? 0.95 : pulse), y: press ? 10 : 0, o: clamp((lt - 1.5) * 4) });
    xf(urlEl, { y: lerp(30, 0, E.out(clamp((lt - 1.9) / 0.5))), o: clamp((lt - 1.9) * 3) });
    const k = clamp((lt - 1.7) / 0.6), ck = clamp((lt - clickAt) / 0.5);
    const cx = lerp(900, 640, E.inOut(k)), cy = lerp(1700, 1440, E.inOut(k));
    xf(cursor, { x: cx, y: cy + (press ? 8 : 0), o: lt > 1.7 ? 1 : 0 }); xf(ring, { x: 640 - 40, y: 1440 - 20, s: lerp(0.4, 1.6, ck), o: lt > clickAt && ck < 1 ? 1 - ck : 0 });
  };
}
