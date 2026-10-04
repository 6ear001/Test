// Bauteile für die Videos: Kassen-Terminal (POS), Symbole, Stoppuhr.
import { h, clamp, lerp, E, prog, px, xf } from './lib.js';

const ICONS = {
  coin: (c = '#F5C242') => `<circle cx="50" cy="50" r="42" fill="${c}"/><circle cx="50" cy="50" r="32" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="5"/><text x="50" y="64" font-family="Outfit" font-weight="700" font-size="42" text-anchor="middle" fill="#fff">€</text>`,
  bill: (c = '#2FB67C') => `<rect x="6" y="24" width="88" height="52" rx="8" fill="${c}"/><rect x="14" y="32" width="72" height="36" rx="5" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="3"/><circle cx="50" cy="50" r="12" fill="#fff" fill-opacity=".55"/>`,
  notebook: () => `<rect x="14" y="8" width="72" height="86" rx="8" fill="#FFF8E1" stroke="#C9B77A" stroke-width="3"/><g stroke="#9bb" stroke-width="3"><path d="M26 28h48M26 42h48M26 56h48M26 70h30"/></g><path d="M22 78 Q40 60 52 74 T80 62" stroke="#F4343A" stroke-width="5" fill="none" stroke-linecap="round"/><rect x="8" y="8" width="8" height="86" fill="#C9B77A"/>`,
  calc: () => `<rect x="18" y="6" width="64" height="88" rx="10" fill="#3A4256"/><rect x="26" y="14" width="48" height="18" rx="4" fill="#B7E4C7"/><g fill="#8A93A8"><rect x="26" y="40" width="12" height="12" rx="3"/><rect x="44" y="40" width="12" height="12" rx="3"/><rect x="62" y="40" width="12" height="12" rx="3"/><rect x="26" y="58" width="12" height="12" rx="3"/><rect x="44" y="58" width="12" height="12" rx="3"/><rect x="62" y="58" width="12" height="12" rx="3"/></g><rect x="26" y="76" width="12" height="12" rx="3" fill="#8A93A8"/><rect x="44" y="76" width="30" height="12" rx="3" fill="#F4343A"/>`,
  receipt: () => `<path d="M22 6h56v86l-8-6-7 6-7-6-7 6-7-6-7 6-6-6-7 6z" fill="#fff" stroke="#D5D9E2" stroke-width="3"/><g stroke="#B8BECC" stroke-width="4" stroke-linecap="round"><path d="M32 24h36M32 38h26M32 52h36M32 66h20"/></g>`,
  sticky: (c = '#FFE066') => `<path d="M10 10h80v62l-20 20H10z" fill="${c}"/><path d="M70 92V72h20" fill="#E5BE2E"/><g stroke="#B08900" stroke-width="4" stroke-linecap="round"><path d="M22 30h50M22 46h40M22 62h26"/></g>`,
  wad: () => `<path d="M20 40 L34 14 L60 20 L82 12 L90 44 L78 76 L48 90 L22 74 Z" fill="#fff" stroke="#C9CEDA" stroke-width="3"/><path d="M34 14 L42 48 L60 20 M42 48 L22 74 M42 48 L78 76 M60 20 L82 12" stroke="#DADFEA" stroke-width="3" fill="none"/>`,
  bag: () => `<path d="M16 34h68l6 58H10z" fill="#F4343A"/><path d="M34 34V26a16 16 0 0 1 32 0v8" stroke="#B3151B" stroke-width="7" fill="none"/>`,
  barcode: () => `<rect x="6" y="14" width="88" height="72" rx="8" fill="#fff"/><g fill="#111"><rect x="16" y="26" width="4" height="48"/><rect x="24" y="26" width="8" height="48"/><rect x="36" y="26" width="4" height="48"/><rect x="44" y="26" width="6" height="48"/><rect x="54" y="26" width="4" height="48"/><rect x="62" y="26" width="8" height="48"/><rect x="74" y="26" width="4" height="48"/></g><rect x="14" y="48" width="72" height="4" fill="#F4343A"/>`,
  check: (c = '#1FBF75') => `<circle cx="50" cy="50" r="44" fill="${c}"/><path d="M28 52 L44 68 L74 34" stroke="#fff" stroke-width="10" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  cross: (c = '#F4343A') => `<circle cx="50" cy="50" r="44" fill="${c}"/><path d="M32 32 L68 68 M68 32 L32 68" stroke="#fff" stroke-width="10" stroke-linecap="round"/>`,
  box: () => `<path d="M10 30 L50 12 L90 30 V72 L50 90 L10 72 Z" fill="#D9A066"/><path d="M10 30 L50 48 L90 30 M50 48 V90" stroke="#B57F45" stroke-width="4" fill="none"/><path d="M30 21 L70 39 V50" stroke="#F3E2C7" stroke-width="5" fill="none"/>`,
  pda: () => `<rect x="30" y="4" width="40" height="92" rx="9" fill="#1B2740"/><rect x="35" y="14" width="30" height="50" rx="3" fill="#8EC5FF"/><path d="M38 24h24M38 32h24M38 40h16" stroke="#fff" stroke-width="3"/><rect x="38" y="70" width="10" height="8" rx="2" fill="#F4343A"/><rect x="52" y="70" width="10" height="8" rx="2" fill="#6B7792"/><rect x="38" y="82" width="24" height="6" rx="2" fill="#6B7792"/>`,
  bolt: () => `<path d="M58 4 L22 56 H46 L38 96 L80 40 H54 Z" fill="#F5C242"/>`,
  tse: () => `<path d="M50 6 L88 20 V50 C88 74 70 88 50 96 C30 88 12 74 12 50 V20 Z" fill="#1F6FEB"/><path d="M30 50 L45 65 L72 36" stroke="#fff" stroke-width="9" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  touch: () => `<path d="M40 52 V20 a8 8 0 0 1 16 0 V46 l22 4 a8 8 0 0 1 6 9 L74 86 H46 L28 64 a8 8 0 0 1 12-10z" fill="#fff" stroke="#111" stroke-width="5" stroke-linejoin="round"/>`,
};
export function icon(name, size = 100, arg) {
  const svg = h('svg', { viewBox: '0 0 100 100', width: size, height: size, style: { overflow: 'visible' } });
  svg.innerHTML = ICONS[name](arg);
  return svg;
}
export const ICON_NAMES = Object.keys(ICONS);

// ---------- Kassen-Terminal ----------
const TILES = [
  { n: 'Brot', p: 120, c: '#E9A23B' }, { n: 'Kaffee', p: 250, c: '#8B5A3C' }, { n: 'Wasser', p: 100, c: '#3E8EF7' },
  { n: 'Tee', p: 220, c: '#2FB67C' }, { n: 'Croissant', p: 180, c: '#F08A4B' }, { n: 'Süßes', p: 350, c: '#E65A8A' },
];
const eur = (c) => (c / 100).toFixed(2).replace('.', ',') + ' €';
export function makePOS() {
  const el = h('div', { style: { position: 'absolute', width: '920px', height: '860px' } });
  // Bon-Schacht (Papier kommt oben rechts heraus)
  const slot = h('div', { style: { position: 'absolute', left: '620px', top: '-176px', width: '240px', height: '178px', overflow: 'hidden' } });
  const paper = h('div', { style: { position: 'absolute', left: '10px', bottom: '0', width: '220px', height: '300px', background: '#fff', borderRadius: '6px 6px 0 0', padding: '22px 18px', fontFamily: 'Outfit', direction: 'ltr', fontSize: '19px', color: '#222', boxShadow: '0 0 0 2px #e4e7ee inset' } },
    h('div', { style: { fontWeight: 700, textAlign: 'center', fontSize: '22px' } }, 'D-Group Kasse'), h('div', { style: { textAlign: 'center', color: '#888', marginBottom: '12px' } }, 'Beleg 000142'), h('div', { class: 'lines' }),
    h('div', { class: 'tse', style: { marginTop: '14px', fontSize: '15px', color: '#1F6FEB', fontWeight: 700 } }, 'TSE ✓ signiert'));
  slot.append(paper);
  const stand = h('div', { style: { position: 'absolute', left: '330px', top: '620px', width: '260px', height: '100px', background: 'linear-gradient(#18233b,#0f182b)', clipPath: 'polygon(14% 0,86% 0,100% 100%,0 100%)' } });
  const casing = h('div', { style: { position: 'absolute', left: 0, top: 0, width: '920px', height: '640px', borderRadius: '46px', background: 'linear-gradient(160deg,#25324f,#101a2e 60%)', boxShadow: '0 0 0 3px #3a4a70 inset, 0 40px 0 -10px rgba(0,0,0,.25)' } });
  const screen = h('div', { style: { position: 'absolute', left: '30px', top: '28px', width: '860px', height: '548px', borderRadius: '22px', background: '#F4F6FA', overflow: 'hidden', direction: 'ltr', fontFamily: 'Outfit' } });
  const header = h('div', { style: { position: 'absolute', left: 0, top: 0, width: '860px', height: '70px', background: '#0B1A33', color: '#fff', display: 'flex', alignItems: 'center', padding: '0 24px', gap: '14px', fontWeight: 700, fontSize: '26px' } },
    h('div', { style: { width: '38px', height: '38px', borderRadius: '10px', background: '#F4343A', display: 'grid', placeItems: 'center', fontSize: '22px' } }, 'D'), 'D-Group Kasse', h('div', { style: { marginLeft: 'auto', fontWeight: 600, fontSize: '22px', opacity: 0.75 } }, 'Kasse 1 · 14:32'));
  const grid = h('div', { style: { position: 'absolute', left: '22px', top: '92px', width: '520px', height: '440px' } });
  const tileEls = TILES.map((t, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const tile = h('div', { style: { position: 'absolute', left: px(col * 176), top: px(row * 214), width: '162px', height: '196px', borderRadius: '22px', background: '#fff', boxShadow: '0 5px 0 #dfe3ec', textAlign: 'center', paddingTop: '22px' } },
      h('div', { style: { width: '86px', height: '86px', margin: '0 auto 12px', borderRadius: '50%', background: t.c, display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 700, fontSize: '40px' } }, t.n[0]),
      h('div', { style: { fontWeight: 700, fontSize: '26px', color: '#18223a' } }, t.n), h('div', { style: { fontWeight: 600, fontSize: '23px', color: '#6a7390' } }, eur(t.p)));
    grid.append(tile); return tile;
  });
  const cart = h('div', { style: { position: 'absolute', left: '560px', top: '86px', width: '276px', height: '448px', background: '#fff', borderRadius: '22px', boxShadow: '0 5px 0 #dfe3ec', padding: '18px 18px' } });
  const cartTitle = h('div', { style: { fontWeight: 700, fontSize: '24px', color: '#6a7390', marginBottom: '10px' } }, 'Warenkorb');
  const rows = h('div', { style: { height: '236px', overflow: 'hidden' } });
  const totalBox = h('div', { style: { borderTop: '3px dashed #dfe3ec', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '26px', color: '#18223a' } }, h('span', null, 'Summe'), h('span', { class: 'sum' }, '0,00 €'));
  const pay = h('div', { style: { marginTop: '12px', height: '74px', borderRadius: '18px', background: '#F4343A', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: '30px', boxShadow: '0 6px 0 #b3151b' } }, 'Bezahlen');
  cart.append(cartTitle, rows, totalBox, pay);
  const done = h('div', { style: { position: 'absolute', left: 0, top: '70px', width: '860px', height: '478px', background: 'rgba(31,191,117,.96)', display: 'none', placeItems: 'center', color: '#fff', fontWeight: 700, fontSize: '70px', textAlign: 'center' } },
    h('div', null, h('div', { class: 'ck' }, ''), h('div', null, 'Bezahlt'), h('div', { style: { fontSize: '30px', opacity: 0.9, marginTop: '8px' } }, 'TSE ✓ · Bon wird gedruckt')));
  screen.append(header, grid, cart, done);
  const ripples = [0, 1, 2, 3, 4, 5, 6, 7].map(() => { const r = h('div', { style: { position: 'absolute', width: '90px', height: '90px', borderRadius: '50%', background: 'rgba(244,52,58,.38)', border: '4px solid rgba(244,52,58,.7)', opacity: 0 } }); screen.append(r); return r; });
  const chin = h('div', { style: { position: 'absolute', left: '40%', top: '588px', width: '20%', height: '8px', borderRadius: '4px', background: '#2f3d5e' } });
  // Kassenschublade
  const base = h('div', { style: { position: 'absolute', left: '70px', top: '700px', width: '780px', height: '150px' } });
  const tray = h('div', { style: { position: 'absolute', left: '20px', top: '10px', width: '740px', height: '120px', borderRadius: '14px', background: '#e9edf5', boxShadow: '0 0 0 4px #c9d0df inset' } });
  const cash = h('div', { style: { position: 'absolute', inset: '14px', display: 'flex', gap: '10px' } }, [0, 1, 2, 3, 4].map((i) => h('div', { style: { flex: 1, borderRadius: '8px', background: ['#2FB67C', '#5BC49A', '#3ca57c', '#74d1ac', '#2FB67C'][i], boxShadow: '0 4px 0 rgba(0,0,0,.18)' } })), h('div', { style: { width: '120px', borderRadius: '10px', background: '#C9CED8', display: 'grid', placeItems: 'center', fontSize: '30px' } }, '● ● ●'));
  tray.append(cash);
  const front = h('div', { style: { position: 'absolute', left: 0, top: 0, width: '780px', height: '150px', borderRadius: '22px', background: 'linear-gradient(#1c2946,#0f182b)', boxShadow: '0 0 0 3px #3a4a70 inset' } }, h('div', { style: { position: 'absolute', left: '300px', top: '58px', width: '180px', height: '16px', borderRadius: '8px', background: '#050912' } }), h('div', { style: { position: 'absolute', right: '40px', top: '52px', width: '28px', height: '28px', borderRadius: '50%', background: '#8f9bb8' } }));
  base.append(tray, front);
  el.append(slot, stand, base, casing, screen, chin);
  casing.after(screen);

  let lastRows = '';
  /**
   * cfg: { taps: [{t, idx}], payAt, paidAt, printAt, drawerAt }
   * Liefert { total, paid } für den Zeitpunkt lt.
   */
  el.update = (lt, cfg = {}) => {
    const taps = (cfg.taps || []).filter((x) => lt >= x.t);
    const qty = new Map(); taps.forEach((x) => qty.set(x.idx, (qty.get(x.idx) || 0) + 1));
    const key = JSON.stringify([...qty]);
    let total = 0;
    if (key !== lastRows) {
      lastRows = key; rows.replaceChildren();
      for (const [idx, q] of qty) rows.append(h('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: '23px', fontWeight: 600, color: '#18223a', padding: '7px 0', borderBottom: '2px solid #eef0f6' } }, h('span', null, `${q}× ${TILES[idx].n}`), h('span', null, eur(TILES[idx].p * q))));
    }
    for (const [idx, q] of qty) total += TILES[idx].p * q;
    totalBox.querySelector('.sum').textContent = eur(total);
    // Berührungs-Wellen
    ripples.forEach((r, i) => {
      const tp = (cfg.taps || [])[i];
      if (!tp) { r.style.opacity = 0; return; }
      const k = clamp((lt - tp.t) / 0.45);
      const col = tp.idx % 3, row = Math.floor(tp.idx / 3);
      r.style.left = px(22 + col * 176 + 81 - 45); r.style.top = px(92 + row * 214 + 100 - 45);
      r.style.opacity = lt >= tp.t && k < 1 ? 1 - k : 0; r.style.transform = `scale(${0.4 + k * 1.4})`;
      const tl = tileEls[tp.idx]; if (lt >= tp.t && lt < tp.t + 0.14) tl.style.transform = 'translateY(5px) scale(.97)'; else if (tl && i === (cfg.taps || []).findLastIndex((x) => x.idx === tp.idx && lt >= x.t)) tl.style.transform = 'none';
    });
    const payPress = cfg.payAt !== undefined && lt >= cfg.payAt && lt < cfg.payAt + 0.18;
    pay.style.transform = payPress ? 'translateY(5px)' : 'none'; pay.style.boxShadow = payPress ? '0 1px 0 #b3151b' : '0 6px 0 #b3151b';
    const paid = cfg.paidAt !== undefined && lt >= cfg.paidAt;
    done.style.display = paid ? 'grid' : 'none';
    if (paid) { const k = prog(lt, cfg.paidAt, 0.35, E.back); done.style.opacity = clamp((lt - cfg.paidAt) / 0.12); done.firstChild.style.transform = `scale(${lerp(0.7, 1, k)})`; }
    // Bon
    const pk = cfg.printAt !== undefined ? clamp((lt - cfg.printAt) / 0.9) : 0;
    paper.style.transform = `translateY(${lerp(190, 0, E.out(pk))}px)`;
    const lines = paper.querySelector('.lines'); if (lines.dataset.k !== key) { lines.dataset.k = key; lines.replaceChildren(...[...qty].map(([idx, q]) => h('div', { style: { display: 'flex', justifyContent: 'space-between' } }, h('span', null, `${q}× ${TILES[idx].n}`), h('span', null, eur(TILES[idx].p * q)))), h('div', { style: { display: 'flex', justifyContent: 'space-between', fontWeight: 700, borderTop: '2px solid #222', marginTop: '8px', paddingTop: '6px' } }, h('span', null, 'Summe'), h('span', null, eur(total)))); }
    // Schublade
    const dk = cfg.drawerAt !== undefined ? prog(lt, cfg.drawerAt, 0.5, E.back) : 0;
    tray.style.transform = `translateY(${lerp(0, 118, dk)}px) scale(${lerp(1, 1.04, dk)})`; base.style.zIndex = 0; front.style.transform = `translateY(${lerp(0, 4, dk)}px)`;
    return { total, paid };
  };
  return el;
}

// ---------- Stoppuhr ----------
export function makeStopwatch({ size = 520, color = '#F4343A', track = 'rgba(255,255,255,.25)', text = '#fff' } = {}) {
  const el = h('div', { style: { position: 'absolute', width: px(size), height: px(size) } });
  const svg = h('svg', { viewBox: '0 0 100 100', width: size, height: size });
  svg.innerHTML = `<circle cx="50" cy="50" r="44" fill="none" stroke="${track}" stroke-width="7"/><circle id="arc" cx="50" cy="50" r="44" fill="none" stroke="${color}" stroke-width="7" stroke-linecap="round" stroke-dasharray="276.46" stroke-dashoffset="276.46" transform="rotate(-90 50 50)"/><g stroke="${track}" stroke-width="1.6">${[...Array(12)].map((_, i) => `<line x1="50" y1="2" x2="50" y2="${i % 3 ? 5 : 8}" transform="rotate(${i * 30} 50 50)"/>`).join('')}</g><rect x="42" y="-7" width="16" height="8" rx="3" fill="${color}"/>`;
  const label = h('div', { class: 'mono', style: { position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontWeight: 700, color: text, fontSize: px(size * 0.26), letterSpacing: '-.02em' } });
  el.append(svg, label);
  el.set = (seconds, fraction) => { label.textContent = `00:${String(Math.floor(seconds)).padStart(2, '0')}`; svg.querySelector('#arc').setAttribute('stroke-dashoffset', String(276.46 * (1 - clamp(fraction)))); };
  return el;
}
