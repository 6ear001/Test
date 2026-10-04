// Video Y1 – YouTube-Werbung (16:9, 1920×1080) «٧ أدوات صارو نظام واحد» – ein Tag im Laden mit dem ganzen System.
// Alle `at`-Werte sind absolute Sekunden der ElevenLabs-Aufnahme voice-y1.mp3 (63,6 s).
import { h, clamp, lerp, E, px, xf, place } from './lib.js';
import { makePOS, icon } from './parts.js';
import { spr, seg, rnd, rline, li, makeBurst } from './pro.js';

const NAVY = '#0A1428', RED = '#F4343A', CREAM = '#F6F0E4', GREEN = '#2FD08A', GOLD = '#FFC83D', INK = '#0B1A33';
const stage = document.getElementById('stage');
stage.style.width = '1920px'; stage.style.height = '1080px'; stage.style.background = NAVY;
const scenes = [];
const IMGS = [];
const mk = (from, to, bg, build, update, slide = false) => { const root = h('div', { class: 'shot', style: { background: bg } }); const cam = h('div', { class: 'layer', style: { pointerEvents: 'none' } }); root.append(cam); const st = build(cam, root) || {}; stage.append(root); const sc = { from, to, root, cam, st, update, slide }; scenes.push(sc); return sc; };
const abs = (el, x, y, extra = {}) => place(el, x, y, extra);
const img = (src, w, extra = {}) => { const i = h('img', { src, style: { position: 'absolute', width: px(w), ...extra } }); IMGS.push(i); return i; };
const camPush = (cam, lt, len, amount = 0.05, fx = 960, fy = 540) => { cam.style.transformOrigin = `${fx}px ${fy}px`; cam.style.transform = `scale(${1 + amount * clamp(lt / len)})`; };
const glow = (c, x, y, w, h_, a = 0.4) => h('div', { class: 'layer', style: { background: `radial-gradient(${w}px ${h_}px at ${x}px ${y}px, ${c.replace('A', a)}, transparent)` } });
const grid = (a = 0.05) => h('div', { class: 'layer', style: { backgroundImage: `linear-gradient(rgba(255,255,255,${a}) 2px, transparent 2px), linear-gradient(90deg, rgba(255,255,255,${a}) 2px, transparent 2px)`, backgroundSize: '90px 90px' } });
const dots = () => h('div', { class: 'layer', style: { backgroundImage: 'radial-gradient(circle, rgba(11,26,51,.09) 3px, transparent 4px)', backgroundSize: '54px 54px' } });
const ctr = (el, y, w = 1920) => abs(el, (1920 - w) / 2, y, { width: px(w) });

// ---------- kleine Symbole ----------
const svgIcon = (inner, sz) => { const s = h('svg', { viewBox: '0 0 100 100', width: sz, height: sz, style: { overflow: 'visible' } }); s.innerHTML = inner; return s; };
const TOOL = {
  notebook: (z) => icon('notebook', z),
  calc: (z) => icon('calc', z),
  sticky: (z) => icon('sticky', z),
  sheet: (z) => svgIcon('<rect x="8" y="8" width="84" height="84" rx="10" fill="#fff" stroke="#BFD9C8" stroke-width="3"/><rect x="8" y="8" width="84" height="22" rx="10" fill="#1E9E5E"/><rect x="8" y="20" width="84" height="10" fill="#1E9E5E"/><g stroke="#C9D8CF" stroke-width="2.5"><path d="M8 48 H92 M8 66 H92 M8 82 H92 M36 30 V92 M64 30 V92"/></g><g fill="#7ACB9C"><rect x="12" y="34" width="20" height="10"/><rect x="40" y="52" width="20" height="10"/><rect x="68" y="70" width="20" height="10"/></g>', z),
  chat: (z) => svgIcon('<path d="M14 14 H86 a8 8 0 0 1 8 8 V60 a8 8 0 0 1 -8 8 H48 L26 88 V68 H14 a8 8 0 0 1 -8 -8 V22 a8 8 0 0 1 8 -8Z" fill="#25D366"/><g fill="#fff"><circle cx="32" cy="41" r="5.5"/><circle cx="50" cy="41" r="5.5"/><circle cx="68" cy="41" r="5.5"/></g><circle cx="90" cy="14" r="11" fill="#F4343A"/>', z),
  phone: (z) => svgIcon('<rect x="28" y="4" width="44" height="92" rx="9" fill="#1B2740"/><rect x="33" y="14" width="34" height="62" rx="3" fill="#8EC5FF"/><path d="M38 28 H62 M38 38 H62 M38 48 H52" stroke="#fff" stroke-width="3" stroke-linecap="round"/><circle cx="50" cy="86" r="4" fill="#fff"/>', z),
  receipts: (z) => { const g = h('div', { style: { position: 'relative', width: px(z), height: px(z) } }); [[-14, -8, 0.82], [10, 4, 0.9], [-2, 10, 1]].forEach(([r, x, s], i) => g.append(h('div', { style: { position: 'absolute', left: px(z * 0.1 + x * 3), top: px(z * 0.02 + i * 8), width: px(z * 0.8 * s), height: px(z * 0.8 * s), transform: `rotate(${r}deg)` } }, icon('receipt', z * 0.8 * s)))); return g; },
};

// ================= 1 Hook: «دفتر… إكسل… آلة حاسبة… واتساب… وكوم فواتير! لسه عم تدير محلك بسبع أدوات؟» (0 – 7.25) =================
const HOOK = [
  { k: 'notebook', lbl: 'دفتر', at: 0.08, x: 340, y: 150, s: 270, r: -10 },
  { k: 'sheet', lbl: 'إكسل', at: 0.94, x: 1450, y: 70, s: 270, r: 8 },
  { k: 'calc', lbl: 'آلة حاسبة', at: 1.75, x: 1490, y: 560, s: 260, r: -6 },
  { k: 'chat', lbl: 'واتساب', at: 2.69, x: 170, y: 560, s: 260, r: 7 },
  { k: 'receipts', lbl: 'وكوم فواتير', at: 3.46, x: 820, y: 700, s: 270, r: -4 },
  { k: 'sticky', lbl: '', at: 4.35, x: 900, y: 40, s: 200, r: 12 },
  { k: 'phone', lbl: '', at: 5.0, x: 520, y: 30, s: 190, r: -12 },
];
mk(0, 7.3, CREAM, (cam) => {
  cam.append(dots(), glow('rgba(244,52,58,A)', 1700, 100, 900, 600, 0.16), glow('rgba(255,170,120,A)', 200, 1000, 900, 600, 0.25));
  const items = HOOK.map((it) => {
    const box = h('div', { style: { position: 'absolute', left: px(it.x), top: px(it.y), width: px(it.s), height: px(it.s) } }, TOOL[it.k](it.s));
    box.style.filter = 'drop-shadow(0 22px 26px rgba(11,26,51,.28))';
    const lbl = it.lbl ? rline([{ w: it.lbl, at: it.at + 0.05 }], { size: 64, color: INK, width: 460 }) : null; if (lbl) abs(lbl, it.x + it.s / 2 - 230, it.y + it.s + 6);
    cam.append(box); if (lbl) cam.append(lbl); return { box, lbl, it };
  });
  const l1 = rline([{ w: 'لسه', at: 4.8 }, { w: 'عم', at: 5.1 }, { w: 'تدير', at: 5.3 }, { w: 'محلك', at: 5.65 }], { size: 112, color: INK, width: 1100, gap: 0.22 }); ctr(l1, 350, 1100); l1.style.left = '410px';
  const l2 = rline([{ w: 'بسبع', at: 6.05 }, { w: 'أدوات؟', at: 6.4, cls: 'hot' }], { size: 170, color: INK, width: 1100, gap: 0.22 }); abs(l2, 410, 500, { width: '1100px' });
  cam.append(l1, l2);
  return { items, l1, l2 };
}, (lt, s, cam, t) => {
  const suck = seg(t, 7.0, 7.28, E.in);
  const amp = 6 + 26 * seg(t, 4.8, 6.8, E.lin);
  s.items.forEach(({ box, lbl, it }, i) => {
    const k = t - it.at; const pop = k < 0 ? 0 : spr(k, 12, 6.5);
    const dx = Math.sin(t * 1.3 + i * 1.7) * amp + (t > 6.75 ? Math.sin(t * 60 + i) * 6 : 0), dy = Math.cos(t * 1.1 + i * 2.3) * amp * 0.7;
    const cx = it.x + it.s / 2, cy = it.y + it.s / 2;
    xf(box, { x: dx + (960 - cx) * suck, y: dy + (540 - cy) * suck, s: pop * (1 - 0.92 * suck), r: it.r + Math.sin(t * 2 + i) * 4 + (1 - pop) * -50, o: k < 0 ? 0 : 1 });
    if (lbl) { lbl.update(t); xf(lbl, { x: dx * 0.6, y: dy * 0.6, o: 1 - suck }); }
  });
  s.l1.update(t); s.l2.update(t); xf(s.l1, { o: 1 - seg(t, 6.95, 7.15, E.lin) }); xf(s.l2, { o: 1 - seg(t, 6.95, 7.15, E.lin) });
});

// ================= Hintergrund für alles danach (7.2 – 51.3) =================
const bgSc = mk(7.2, 51.3, `linear-gradient(180deg, #0F2548 0%, ${NAVY} 80%)`, (cam) => {
  const g = glow('rgba(244,52,58,A)', 960, 1200, 1500, 700, 0.35);
  cam.append(grid(0.045), g);
  const gl = h('div', { style: { position: 'absolute', left: '-300px', top: '-300px', width: '900px', height: '900px', borderRadius: '50%', background: 'radial-gradient(closest-side, rgba(70,130,255,.16), transparent)' } });
  cam.append(gl); return { g, gl };
}, (lt, s) => { xf(s.gl, { x: Math.sin(lt * 0.15) * 400 + 500, y: Math.cos(lt * 0.12) * 120 + 300 }); });

// ---------- Fenster-Baustein im System-Stil ----------
const win = (title, w = 860, hh = 700) => {
  const el = h('div', { style: { position: 'absolute', width: px(w), height: px(hh), borderRadius: '30px', background: '#F4F6FA', boxShadow: '0 60px 120px rgba(0,0,0,.55), 0 0 0 2px rgba(255,255,255,.1)', overflow: 'hidden', direction: 'ltr', fontFamily: 'Outfit' } });
  const bar = h('div', { style: { height: '76px', background: INK, color: '#fff', display: 'flex', alignItems: 'center', gap: '16px', padding: '0 28px', fontWeight: 700, fontSize: '29px' } }, h('div', { style: { width: '42px', height: '42px', borderRadius: '12px', background: RED, display: 'grid', placeItems: 'center', fontSize: '25px' } }, 'D'), title, h('div', { style: { marginLeft: 'auto', opacity: 0.6, fontWeight: 600, fontSize: '23px' } }, 'D-Group'));
  const body = h('div', { style: { position: 'absolute', left: 0, top: '76px', width: px(w), height: px(hh - 76) } });
  el.append(bar, body); el.body = body; return el;
};
const txt = (s, style = {}) => h('div', { style: { position: 'absolute', whiteSpace: 'nowrap', ...style } }, s);
const chip = (s, bg, color = '#fff', style = {}) => h('div', { style: { position: 'absolute', padding: '8px 22px', borderRadius: '30px', background: bg, color, fontWeight: 700, fontSize: '25px', whiteSpace: 'nowrap', ...style } }, s);
const eur = (n) => n.toFixed(2).replace('.', ',') + ' €';
const pop = (t, at, f = 12, d = 7) => (t < at ? 0 : spr(t - at, f, d));
const press = (btn, t, at, label, doneLabel, base = RED, shadow = '#b3151b') => { const p = t >= at && t < at + 0.16; btn.style.transform = p ? 'translateY(6px)' : 'none'; btn.style.boxShadow = p ? `0 1px 0 ${shadow}` : `0 7px 0 ${shadow}`; const done = t >= at + 0.2; btn.textContent = done ? doneLabel : label; btn.style.background = done ? '#1FBF75' : base; if (done) btn.style.boxShadow = '0 7px 0 #138a54'; };

// ---------- Modul-Szenen ----------
const MODS = [
  { ic: 'cart', time: '08:00', from: 14.8, to: 21.25, kick: [{ w: 'الصبح؟', at: 14.99 }], title: 'الشراء', titleAt: 15.2, lines: [[{ w: 'اطلب', at: 16.95 }, { w: 'من', at: 17.35 }, { w: 'المورّد', at: 17.5 }, { w: 'بضغطة', at: 17.95 }], [{ w: 'أمر', at: 18.56 }, { w: 'الشراء', at: 18.95 }, { w: 'جاهز', at: 19.35 }], [{ w: 'كل', at: 19.87 }, { w: 'طلب', at: 20.2 }, { w: 'محفوظ', at: 20.5 }]] },
  { ic: 'receipt', time: '10:00', from: 21.25, to: 28.45, kick: [{ w: 'الزبون', at: 21.41 }, { w: 'وصل؟', at: 21.8 }], title: 'الكاشير', titleAt: 21.7, lines: [[{ w: 'اختار', at: 22.41 }, { w: 'المنتج', at: 22.8 }], [{ w: 'امسح', at: 23.47 }, { w: 'الباركود', at: 23.85 }], [{ w: 'استلم', at: 24.56 }, { w: 'الدفعة', at: 24.95 }], [{ w: 'الفاتورة', at: 25.56 }, { w: 'جاهزة', at: 26.1 }], [{ w: 'TSE', at: 26.77 }, { w: 'مدمج', at: 27.4 }]] },
  { ic: 'box', time: '12:00', from: 28.45, to: 36.0, kick: [{ w: 'والمخزون؟', at: 28.56 }], title: 'المخزون', titleAt: 28.9, lines: [[{ w: 'بينقص', at: 29.37 }, { w: 'لحالو', at: 29.8 }, { w: 'مع', at: 30.2 }, { w: 'كل', at: 30.4 }, { w: 'بيعة', at: 30.55 }], [{ w: 'بينبّهك', at: 31.05 }, { w: 'قبل', at: 31.65 }, { w: 'ما', at: 31.95 }, { w: 'تخلص', at: 32.15 }], [{ w: 'PDA', at: 33.02 }, { w: 'بتجرد', at: 34.26 }, { w: 'بدقايق', at: 34.9 }]] },
  { ic: 'truck', time: '15:00', from: 36.0, to: 39.75, kick: [{ w: 'في', at: 36.08 }, { w: 'بضاعة', at: 36.3 }, { w: 'لازم', at: 36.65 }, { w: 'توصل؟', at: 36.9 }], title: 'التوصيل', titleAt: 37.1, lines: [[{ w: 'تابع', at: 37.45 }, { w: 'الشحنات', at: 37.85 }], [{ w: 'والتسليم', at: 38.45 }], [{ w: 'من', at: 38.95 }, { w: 'نفس', at: 39.1 }, { w: 'الشاشة', at: 39.25 }]] },
  { ic: 'users', time: '18:00', from: 39.75, to: 44.45, kick: [{ w: 'وحساب', at: 39.85 }, { w: 'كل', at: 40.3 }, { w: 'زبون', at: 40.55 }, { w: 'ومورّد؟', at: 40.95 }], title: 'الحسابات', titleAt: 41.3, lines: [[{ w: 'واضح', at: 41.61 }], [{ w: 'مين', at: 42.19 }, { w: 'دفع', at: 42.45 }], [{ w: 'ومين', at: 42.91 }, { w: 'باقي', at: 43.2 }, { w: 'عليه', at: 43.45 }], [{ w: 'وكم', at: 43.95 }]] },
  { ic: 'chart', time: '22:00', from: 44.45, to: 50.95, kick: [{ w: 'وآخر', at: 44.59 }, { w: 'اليوم؟', at: 44.95 }], title: 'المحاسبة', titleAt: 45.3, lines: [[{ w: 'المحاسبة', at: 45.61 }, { w: 'جاهزة', at: 46.2 }], [{ w: 'المبيعات', at: 46.84 }], [{ w: 'المصاريف', at: 47.6 }], [{ w: 'والربح', at: 48.88 }], [{ w: 'بضغطة', at: 50.0 }, { w: 'وحدة', at: 50.35 }]] },
];

// Fenster-Inhalte je Modul
const VIS = [
  // --- Einkauf ---
  (par) => {
    const w = win('Einkauf · Bestellung', 860, 700); abs(w, 100, 150); const b = w.body;
    b.append(h('div', { style: { position: 'absolute', left: '34px', top: '22px', width: '56px', height: '56px', borderRadius: '50%', background: '#E9A23B', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: '28px' } }, 'A'), txt('Lieferant: Al-Sham Trading', { left: '108px', top: '26px', fontSize: '30px', fontWeight: 700, color: INK }));
    b.append(chip('Bestellung #1042', '#E3E9F5', '#3a4a70', { right: '34px', top: '24px' }));
    b.append(txt('Artikel', { left: '40px', top: '104px', fontSize: '22px', color: '#6a7390', fontWeight: 600 }), txt('Menge', { left: '470px', top: '104px', fontSize: '22px', color: '#6a7390', fontWeight: 600 }), txt('Summe', { left: '690px', top: '104px', fontSize: '22px', color: '#6a7390', fontWeight: 600 }));
    const items = [['Kaffee 1 kg', '20 ×', 168], ['Tee 500 g', '15 ×', 63], ['Zucker 1 kg', '30 ×', 33]];
    const rows = items.map(([n, q, v], i) => { const r = h('div', { style: { position: 'absolute', left: '28px', top: px(140 + i * 74), width: '804px', height: '62px', borderRadius: '16px', background: '#fff', boxShadow: '0 5px 0 #dfe3ec' } }, txt(n, { left: '18px', top: '14px', fontSize: '28px', fontWeight: 600, color: INK }), txt(q, { left: '446px', top: '14px', fontSize: '28px', fontWeight: 600, color: INK }), txt(eur(v), { left: '640px', top: '14px', fontSize: '28px', fontWeight: 700, color: INK })); b.append(r); return r; });
    b.append(txt('Summe', { left: '40px', top: '378px', fontSize: '30px', fontWeight: 700, color: '#6a7390' }), txt(eur(264), { left: '170px', top: '372px', fontSize: '42px', fontWeight: 700, color: INK }));
    const btn = h('div', { style: { position: 'absolute', left: '440px', top: '440px', width: '390px', height: '96px', borderRadius: '24px', background: RED, color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: '36px' } }, 'Bestellen'); b.append(btn);
    const c1 = chip('Bestellung bereit ✓', '#1FBF75', '#fff', { left: '34px', top: '446px', fontSize: '27px' }), c2 = chip('Gespeichert ✓', INK, '#fff', { left: '34px', top: '510px', fontSize: '27px' }); b.append(c1, c2);
    par.append(w);
    return { el: w, update: (t) => { rows.forEach((r, i) => { const k = t - (16.0 + i * 0.4); xf(r, { x: lerp(-700, 0, E.out5(clamp(k / 0.5))), o: k < 0 ? 0 : 1 }); }); press(btn, t, 17.95, 'Bestellen', 'Gesendet ✓'); xf(c1, { s: pop(t, 18.7), o: t >= 18.7 ? 1 : 0 }); xf(c2, { s: pop(t, 20.0), o: t >= 20.0 ? 1 : 0 }); } };
  },
  // --- Kasse ---
  (par) => {
    const wrap = h('div', { style: { position: 'absolute', left: '120px', top: '200px', width: '920px', height: '860px', transformOrigin: '50% 0', perspective: '2400px' } });
    const inner = h('div', { style: { position: 'absolute', inset: 0, transformOrigin: '50% 50%' } }); wrap.append(inner);
    const pos = makePOS(); inner.append(pos);
    const scanCard = h('div', { style: { position: 'absolute', left: '250px', top: '255px', width: '300px', height: '170px', borderRadius: '20px', background: '#fff', boxShadow: '0 30px 60px rgba(0,0,0,.45)', overflow: 'hidden', opacity: 0 } });
    scanCard.innerHTML = `<svg viewBox="0 0 300 170" width="300" height="170"><g fill="#111">${[...Array(32)].map((_, i) => `<rect x="${24 + i * 8.3}" y="28" width="${i % 3 ? 3 : 6}" height="92"/>`).join('')}</g><text x="150" y="150" text-anchor="middle" font-family="Outfit" font-weight="700" font-size="22" fill="#333">4 006381 333931</text></svg>`;
    const laser = h('div', { style: { position: 'absolute', left: '-20px', top: '0', width: '340px', height: '6px', background: RED, boxShadow: '0 0 28px 8px rgba(244,52,58,.85)' } }); scanCard.append(laser); inner.append(scanCard);
    const tse = h('div', { style: { position: 'absolute', left: '60px', top: '640px', padding: '14px 34px', borderRadius: '40px', background: '#1F6FEB', color: '#fff', fontFamily: 'Outfit', fontWeight: 700, fontSize: '40px', boxShadow: '0 20px 40px rgba(31,111,235,.45)' } }, '🛡 TSE ✓ signiert'); inner.append(tse);
    wrap.style.transform = 'scale(.8)'; wrap.style.left = '70px'; wrap.style.top = '150px';
    par.append(wrap);
    const B0 = 21.25, CFG = { taps: [{ t: 22.85 - B0, idx: 1 }, { t: 24.0 - B0, idx: 4 }], payAt: 24.95 - B0, paidAt: 25.2 - B0, printAt: 25.75 - B0 };
    return { el: wrap, update: (t) => {
      const lt = t - B0; inner.style.transform = `rotateX(6deg) rotateY(${lerp(14, 8, seg(lt, 0, 3, E.out))}deg) translateY(${Math.sin(lt * 1.6) * 6}px)`;
      pos.update(lt, CFG);
      const sc = seg(t, 23.5, 23.75, E.out5), so = 1 - seg(t, 24.05, 24.2, E.lin); scanCard.style.opacity = String(t > 23.45 ? sc * so : 0); scanCard.style.transform = `translateY(${(1 - sc) * 40}px) scale(${0.92 + 0.08 * sc})`; laser.style.top = `${10 + (((t - 23.75) / 0.4) % 1) * 150}px`;
      xf(tse, { s: pop(t, 26.9, 11, 6.5), o: t >= 26.9 ? 1 : 0 });
    } };
  },
  // --- Lager ---
  (par) => {
    const w = win('Lager · Bestand', 860, 700); abs(w, 100, 150); const b = w.body;
    const ST = [['Kaffee', 18, 60], ['Tee', 42, 60], ['Brot', 36, 60], ['Wasser', 52, 60], ['Croissant', 28, 60]];
    const rows = ST.map(([n, v], i) => { const y = 24 + i * 82; const name = txt(n, { left: '40px', top: px(y + 12), fontSize: '30px', fontWeight: 600, color: INK }); const num = txt(String(v), { left: '260px', top: px(y + 6), fontSize: '40px', fontWeight: 700, color: INK }); const track = h('div', { style: { position: 'absolute', left: '350px', top: px(y + 18), width: '470px', height: '30px', borderRadius: '15px', background: '#E3E9F5', overflow: 'hidden' } }); const fill = h('div', { style: { height: '100%', borderRadius: '15px', background: GREEN } }); track.append(fill); b.append(name, num, track); return { num, fill, v }; });
    const toast = h('div', { style: { position: 'absolute', left: '90px', top: '440px', width: '680px', height: '150px', borderRadius: '24px', background: '#fff', boxShadow: '0 30px 60px rgba(0,0,0,.35), 0 0 0 4px #F4343A inset', display: 'flex', alignItems: 'center', gap: '24px', padding: '0 30px' } }, h('div', { style: { width: '78px', height: '78px', borderRadius: '50%', background: RED, color: '#fff', display: 'grid', placeItems: 'center', fontSize: '46px', fontWeight: 700 } }, '!'), h('div', { style: { whiteSpace: 'nowrap' } }, h('div', { style: { fontSize: '27px', fontWeight: 700, color: INK } }, 'Kaffee · Bestand niedrig'), h('div', { style: { fontSize: '22px', fontWeight: 600, color: '#6a7390' } }, 'Mindestbestand erreicht (3)')), h('div', { style: { marginLeft: 'auto', padding: '14px 22px', borderRadius: '16px', background: RED, color: '#fff', fontWeight: 700, fontSize: '24px', whiteSpace: 'nowrap' } }, 'Nachbestellen')); b.append(toast);
    // PDA
    const pda = h('div', { style: { position: 'absolute', left: '660px', top: '420px', width: '300px', height: '560px', borderRadius: '44px', background: 'linear-gradient(160deg,#2a3858,#111a2e)', boxShadow: '0 50px 90px rgba(0,0,0,.6), 0 0 0 4px #3a4a70 inset', direction: 'ltr', fontFamily: 'Outfit' } });
    const pscr = h('div', { style: { position: 'absolute', left: '22px', top: '30px', width: '256px', height: '380px', borderRadius: '24px', background: '#F4F6FA', overflow: 'hidden' } }, txt('Inventur', { left: '24px', top: '20px', fontWeight: 700, fontSize: '32px', color: INK }));
    const pcount = txt('0 / 120', { left: '24px', top: '110px', fontWeight: 700, fontSize: '56px', color: INK }); const ptrack = h('div', { style: { position: 'absolute', left: '24px', top: '210px', width: '208px', height: '22px', borderRadius: '11px', background: '#E3E9F5', overflow: 'hidden' } }, h('div', { class: 'pf', style: { height: '100%', background: GREEN } })); const pok = txt('✓ fertig', { left: '24px', top: '270px', fontWeight: 700, fontSize: '40px', color: '#1FBF75' });
    const pbeam = h('div', { style: { position: 'absolute', left: '0', top: '0', width: '256px', height: '5px', background: RED, boxShadow: '0 0 20px 6px rgba(244,52,58,.8)' } }); const pcode = h('div', { style: { position: 'absolute', left: '40px', top: '292px', width: '176px', height: '70px', display: 'flex', gap: '5px', opacity: 0 } }, [...Array(18)].map((_, i) => h('div', { style: { flex: i % 3 ? 1 : 2, background: INK } })));
    pscr.append(pcount, ptrack, pok, pcode, pbeam); pda.append(pscr, h('div', { style: { position: 'absolute', left: '100px', top: '460px', width: '100px', height: '36px', borderRadius: '18px', background: RED } })); par.append(w); par.append(pda);
    pda.style.left = '760px'; pda.style.top = '300px';
    return { el: w, update: (t) => {
      const sold = clamp(Math.floor((t - 29.4) / 0.1), 0, 15); const kv = 18 - sold; rows[0].num.textContent = String(kv); const low = kv <= 5; rows[0].fill.style.width = `${(kv / 60) * 100}%`; rows[0].fill.style.background = low ? RED : GREEN; rows[0].num.style.color = low ? RED : INK;
      rows.slice(1).forEach((r, i) => { const d = i === 0 && t > 29.7 ? Math.floor((t - 29.7) / 0.5) : 0; const val = r.v - Math.min(d, 4); r.num.textContent = String(val); r.fill.style.width = `${(val / 60) * 100}%`; });
      const tk = seg(t, 31.05, 31.5, E.out5); xf(toast, { y: lerp(-200, 0, tk), o: tk * (1 - seg(t, 32.7, 33.0, E.lin)) });
      const pk = seg(t, 33.02, 33.6, E.out5); xf(pda, { y: lerp(900, 0, pk), r: lerp(14, -4, pk), o: t >= 33.0 ? 1 : 0 });
      const pr = seg(t, 34.26, 35.5, E.inOut); pcount.textContent = `${Math.round(pr * 120)} / 120`; ptrack.firstChild.style.width = `${pr * 100}%`; pok.style.opacity = pr >= 1 ? '1' : '0'; const scanning = pr < 1 && t > 34.2; pbeam.style.top = `${285 + (((t * 1.8) % 1)) * 85}px`; pbeam.style.opacity = scanning ? '1' : '0'; pcode.style.opacity = scanning ? '1' : '0';
    } };
  },
  // --- Logistik ---
  (par) => {
    const w = win('Logistik · Sendungen', 860, 700); abs(w, 100, 150); const b = w.body;
    const route = h('div', { style: { position: 'absolute', left: '30px', top: '26px', width: '800px', height: '230px', borderRadius: '24px', background: '#E8EEF9' } });
    const A = h('div', { style: { position: 'absolute', left: '50px', top: '80px', width: '96px', height: '96px', borderRadius: '24px', background: INK, display: 'grid', placeItems: 'center' } }, li('box', 60, '#fff', 5)); const Bn = h('div', { style: { position: 'absolute', left: '654px', top: '80px', width: '96px', height: '96px', borderRadius: '24px', background: '#fff', boxShadow: '0 0 0 4px #1FBF75 inset', display: 'grid', placeItems: 'center' } }, li('cart', 60, INK, 5));
    const line = h('div', { style: { position: 'absolute', left: '160px', top: '126px', width: '480px', height: '0', borderTop: '6px dashed #9aa8c8' } });
    const done = h('div', { style: { position: 'absolute', left: '690px', top: '62px', width: '56px', height: '56px' } }, icon('check', 56));
    const truck = h('div', { style: { position: 'absolute', left: '0', top: '88px', width: '96px', height: '80px', background: RED, borderRadius: '16px', display: 'grid', placeItems: 'center', boxShadow: '0 14px 26px rgba(244,52,58,.45)' } }, li('truck', 66, '#fff', 5));
    route.append(A, Bn, line, truck, done); b.append(route);
    const SH = [['#S-2201', 'Berlin · 14 Pakete'], ['#S-2202', 'Köln · 6 Pakete'], ['#S-2203', 'Essen · 9 Pakete']];
    const rows = SH.map(([id, d], i) => { const st = chip('Unterwegs', '#F5C242', INK, { right: '22px', top: '10px', fontSize: '24px' }); const r = h('div', { style: { position: 'absolute', left: '30px', top: px(290 + i * 100), width: '800px', height: '82px', borderRadius: '18px', background: '#fff', boxShadow: '0 5px 0 #dfe3ec' } }, txt(id, { left: '24px', top: '20px', fontSize: '29px', fontWeight: 700, color: INK }), txt(d, { left: '200px', top: '22px', fontSize: '26px', fontWeight: 600, color: '#6a7390' }), st); b.append(r); return { r, st }; });
    par.append(w);
    return { el: w, update: (t) => {
      const p = seg(t, 36.7, 39.2, E.inOut); xf(truck, { x: 120 + p * 400, y: 0 }); truck.style.left = '40px';
      rows.forEach(({ r, st }, i) => { const k = t - (36.6 + i * 0.2); xf(r, { y: lerp(60, 0, E.out5(clamp(k / 0.45))), o: k < 0 ? 0 : 1 }); });
      const dn = t >= 39.3; rows[0].st.textContent = dn ? 'Geliefert ✓' : 'Unterwegs'; rows[0].st.style.background = dn ? '#1FBF75' : '#F5C242'; rows[0].st.style.color = dn ? '#fff' : INK; xf(done, { s: pop(t, 39.3), o: t >= 39.3 ? 1 : 0 });
    } };
  },
  // --- Kunden / Konten ---
  (par) => {
    const w = win('Konten · Kunden & Lieferanten', 860, 700); abs(w, 100, 150); const b = w.body;
    const tabK = chip('Kunden', RED, '#fff', { left: '34px', top: '18px', fontSize: '26px' }), tabL = chip('Lieferanten', '#E3E9F5', '#3a4a70', { left: '190px', top: '18px', fontSize: '26px' }); b.append(tabK, tabL);
    const ROWS = [['Bäckerei Nour', 0, 'paid'], ['Markt Al-Salam', 120, 'open'], ['Café Damas', 0, 'paid'], ['Kiosk Mitte', 340, 'open'], ['Imbiss Yasmin', 0, 'paid'], ['Laden Rami', 780, 'open']];
    const rows = ROWS.map(([n, v, st], i) => { const chipEl = chip(st === 'paid' ? 'Bezahlt ✓' : `Offen ${eur(v)}`, '#E3E9F5', '#3a4a70', { right: '22px', top: '14px', fontSize: '25px' }); const r = h('div', { style: { position: 'absolute', left: '28px', top: px(86 + i * 82), width: '804px', height: '68px', borderRadius: '18px', background: '#fff', boxShadow: '0 5px 0 #dfe3ec' } }, h('div', { style: { position: 'absolute', left: '16px', top: '12px', width: '44px', height: '44px', borderRadius: '50%', background: ['#E9A23B', '#3E8EF7', '#2FB67C', '#E65A8A', '#8B5A3C', '#7a5af8'][i], color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: '22px' } }, n[0]), txt(n, { left: '76px', top: '16px', fontSize: '28px', fontWeight: 600, color: INK }), chipEl); b.append(r); return { r, chipEl, st, v }; });
    const tot = h('div', { style: { position: 'absolute', left: '28px', top: '590px', width: '804px', height: '10px' } }); const totTxt = txt('Offen gesamt: ' + eur(1240), { left: '36px', top: '0px', fontSize: '34px', fontWeight: 700, color: RED }); tot.append(totTxt); b.append(tot);
    par.append(w);
    return { el: w, update: (t) => {
      rows.forEach(({ r, chipEl, st }, i) => { const k = t - (40.0 + i * 0.22); xf(r, { x: lerp(-500, 0, E.out5(clamp(k / 0.5))), o: k < 0 ? 0 : 1 });
        const on = st === 'paid' ? t >= 42.19 : t >= 42.91; chipEl.style.background = on ? (st === 'paid' ? '#1FBF75' : RED) : '#E3E9F5'; chipEl.style.color = on ? '#fff' : '#3a4a70'; });
      const sw = t >= 40.95 && t < 41.5; tabL.style.background = sw ? RED : '#E3E9F5'; tabL.style.color = sw ? '#fff' : '#3a4a70'; tabK.style.background = sw ? '#E3E9F5' : RED; tabK.style.color = sw ? '#3a4a70' : '#fff';
      xf(totTxt, { s: 1 + 0.12 * Math.exp(-Math.max(0, t - 43.95) * 6) * Math.cos(Math.max(0, t - 43.95) * 22), o: seg(t, 43.9, 44.1, E.lin) }); totTxt.style.transformOrigin = '0 50%';
    } };
  },
  // --- Buchhaltung ---
  (par) => {
    const w = win('Buchhaltung · Tagesabschluss', 860, 700); abs(w, 100, 150); const b = w.body;
    const BARS = [['Einnahmen', 1840, GREEN, 46.84], ['Ausgaben', 600, RED, 47.6], ['Gewinn', 1240, GOLD, 48.88]];
    const els = BARS.map(([n, v, c, at], i) => { const x = 60 + i * 262; const bar = h('div', { style: { position: 'absolute', left: px(x), top: '420px', width: '200px', height: '0px', borderRadius: '20px 20px 0 0', background: c } }); const val = txt(eur(0), { left: px(x - 20), top: '40px', width: '240px', textAlign: 'center', fontSize: '36px', fontWeight: 700, color: INK }); const lbl = txt(n, { left: px(x), top: '432px', width: '200px', textAlign: 'center', fontSize: '28px', fontWeight: 600, color: '#6a7390' }); b.append(bar, val, lbl); return { bar, val, v, at }; });
    const btn = h('div', { style: { position: 'absolute', left: '230px', top: '505px', width: '400px', height: '84px', borderRadius: '22px', background: RED, color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: '32px' } }, 'Tagesabschluss'); b.append(btn);
    par.append(w);
    return { el: w, update: (t) => {
      els.forEach(({ bar, val, v, at }) => { const k = seg(t, at, at + 0.9, E.out5); const hh = (v / 1840) * 330 * k; bar.style.height = `${hh}px`; bar.style.top = `${420 - hh}px`; val.textContent = eur(v * k); val.style.top = `${420 - hh - 56}px`; val.style.opacity = t >= at ? '1' : '0'; });
      press(btn, t, 50.0, 'Tagesabschluss', 'Abgeschlossen ✓');
    } };
  },
];

const modScenes = MODS.map((m, mi) => mk(m.from, m.to, 'transparent', (cam) => {
  const body = h('div', { class: 'layer' }); cam.append(body);
  const kick = rline(m.kick, { size: 66, color: GOLD, width: 820, align: 'flex-start', font: 'ar' }); abs(kick, 1000, 112);
  const ttl = rline([{ w: m.title, at: m.titleAt }], { size: 200, color: '#fff', width: 820, align: 'flex-start' }); abs(ttl, 1000, 190);
  const rule = h('div', { style: { position: 'absolute', left: '1000px', top: '440px', width: '820px', height: '8px', borderRadius: '4px', background: 'rgba(255,255,255,.14)' } }, h('div', { class: 'f', style: { width: '100%', height: '100%', borderRadius: '4px', background: RED, transformOrigin: '100% 50%' } }));
  const step = m.lines.length > 4 ? 84 : 98; const rows = m.lines.map((ln, i) => {
    const row = h('div', { style: { position: 'absolute', left: '1000px', top: px(480 + i * step), width: '820px', height: '84px', display: 'flex', alignItems: 'center', gap: '20px', direction: 'rtl' } });
    const chars = ln.reduce((a, x) => a + x.w.length, 0) + ln.length - 1; const fs = Math.floor(Math.min(m.lines.length > 4 ? 64 : 72, 730 / (chars * 0.6)));
    const bullet = h('div', { style: { width: '46px', height: '46px', flex: 'none' } }, icon('check', 46)); const tx = rline(ln, { size: fs, color: '#fff', width: 740, align: 'flex-start', font: 'ar', lh: 1.1 }); tx.style.flexWrap = 'nowrap'; row.append(bullet, tx); body.append(row); return { bullet, tx, at: ln[0].at };
  });
  body.append(kick, ttl, rule);
  const vis = VIS[mi](body);
  return { kick, ttl, rule, rows, vis };
}, (lt, s, cam, t) => {
  s.kick.update(t); s.ttl.update(t); xf(s.rule.firstChild, { sx: seg(t, m.titleAt + 0.2, m.titleAt + 0.8, E.out5), sy: 1 });
  s.rows.forEach(({ bullet, tx, at }) => { tx.update(t); xf(bullet, { s: pop(t, at, 12, 7), o: t >= at ? 1 : 0 }); });
  s.vis.update(t);
}, true));

// ================= 2 Enthüllung: «مع مجموعة داماس للحلول الرقمية… كل شي بنظام واحد! من الصبح لآخر الليل… نظام واحد بيدير محلك كلو» (7.25 – 14.8) =================
const CHIPS = [['cart', '08:00'], ['receipt', '10:00'], ['box', '12:00'], ['truck', '15:00'], ['users', '18:00'], ['chart', '22:00']];
mk(7.25, 14.85, 'transparent', (cam) => {
  const logo = img('../img/company-dark.png', 920, { left: '500px', top: '170px' });
  const ring = h('div', { style: { position: 'absolute', left: '660px', top: '90px', width: '600px', height: '600px', borderRadius: '50%', border: '6px solid rgba(255,255,255,.25)' } });
  const nm = rline([{ w: 'مع', at: 7.19 }, { w: 'مجموعة', at: 7.45 }, { w: 'داماس', at: 7.85 }, { w: 'للحلول', at: 8.35 }, { w: 'الرقمية', at: 8.8, cls: 'gold' }], { size: 104, color: '#fff', width: 1700, font: 'ar', gap: 0.25 }); abs(nm, 110, 620);
  const one = rline([{ w: 'كل', at: 9.5 }, { w: 'شي', at: 9.75 }, { w: 'بنظام', at: 10.0 }, { w: 'واحد!', at: 10.45, cls: 'gold' }], { size: 210, color: '#fff', width: 1700, gap: 0.22 }); abs(one, 110, 150);
  const day = rline([{ w: 'من', at: 11.13 }, { w: 'الصبح', at: 11.3 }, { w: 'لآخر', at: 11.85 }, { w: 'الليل…', at: 12.1, cls: 'gold' }], { size: 150, color: '#fff', width: 1700, gap: 0.22 }); abs(day, 110, 130);
  const path = h('div', { style: { position: 'absolute', left: '420px', top: '470px', width: '1080px', height: '0', borderTop: '6px dashed rgba(255,255,255,.28)' } });
  const sun = h('div', { style: { position: 'absolute', left: '0', top: '0', width: '110px', height: '110px' } }, li('sun', 110, GOLD, 5)); const moon = h('div', { style: { position: 'absolute', left: '0', top: '0', width: '110px', height: '110px' } }, li('moon', 110, '#cfe0ff', 5));
  const all = rline([{ w: 'نظام', at: 12.69 }, { w: 'واحد', at: 13.0, cls: 'gold' }, { w: 'بيدير', at: 13.4 }, { w: 'محلك', at: 13.9 }, { w: 'كلو', at: 14.3, cls: 'gold' }], { size: 112, color: '#fff', width: 1700, gap: 0.24 }); abs(all, 110, 770);
  cam.append(ring, logo, nm, one, day, path, sun, moon, all);
  return { logo, ring, nm, one, day, path, sun, moon, all };
}, (lt, s, cam, t) => {
  const lg = t - 7.3; xf(s.logo, { s: lg < 0 ? 0 : spr(lg, 9, 5.5), o: lg < 0 ? 0 : 1 - seg(t, 9.25, 9.45, E.lin) });
  xf(s.ring, { s: 0.6 + 0.9 * seg(t, 7.3, 8.2, E.out), o: 0.8 * (1 - seg(t, 7.3, 8.2, E.lin)) });
  s.nm.update(t); xf(s.nm, { o: 1 - seg(t, 9.25, 9.45, E.lin) });
  s.one.update(t); xf(s.one, { o: 1 - seg(t, 10.85, 11.05, E.lin) });
  s.day.update(t); xf(s.day, { o: (t < 11.0 ? 0 : 1) * (1 - seg(t, 12.5, 12.68, E.lin)) });
  const p = seg(t, 11.13, 12.45, E.inOut); const sx = lerp(1500, 420, p); const night = p > 0.82;
  xf(s.path, { o: t >= 11.1 && t < 12.7 ? 1 : 0 }); xf(s.sun, { x: sx + 420 - 55 - 420 + 0, y: 470 - 55 + Math.sin(p * Math.PI) * -150, s: night ? 0 : 1 + 0.2 * Math.sin(t * 6), o: t >= 11.1 && t < 12.7 ? 1 : 0 });
  xf(s.moon, { x: sx - 55, y: 470 - 55 + Math.sin(p * Math.PI) * -150, s: night ? 1 : 0, o: t >= 11.1 && t < 12.7 ? 1 : 0 }); s.sun.style.left = '0px'; s.moon.style.left = '0px';
  s.all.update(t); xf(s.all, { o: 1 });
});
// Sonne läuft entlang x: Position als absolute links/oben setzen
// (xf übernimmt translate; left=0 → Zielposition = x)

// ================= HUD: sechs Stationen (werden aus der Mitte zur Zeitleiste) =================
const hud = h('div', { style: { position: 'absolute', inset: 0, pointerEvents: 'none' } });
const railLine = h('div', { style: { position: 'absolute', left: '190px', top: '982px', width: '1540px', height: '8px', borderRadius: '4px', background: 'rgba(255,255,255,.14)' } }, h('div', { class: 'f', style: { width: '100%', height: '100%', borderRadius: '4px', background: RED, transformOrigin: '100% 50%' } }));
hud.append(railLine);
const chips = CHIPS.map(([ic, tm], i) => {
  const el = h('div', { style: { position: 'absolute', left: '0', top: '0', width: '170px', height: '170px' } });
  const box = h('div', { style: { position: 'absolute', inset: 0, borderRadius: '38px', background: RED, display: 'grid', placeItems: 'center', boxShadow: '0 30px 60px rgba(244,52,58,.4)' } }, li(ic, 96, '#fff', 5)); el.append(box);
  const lbl = h('div', { style: { position: 'absolute', left: '-20px', top: '178px', width: '210px', textAlign: 'center', fontFamily: 'Outfit', fontWeight: 700, fontSize: '36px', color: '#fff', direction: 'ltr' } }, tm); el.append(lbl);
  const ck = h('div', { style: { position: 'absolute', right: '-14px', top: '-14px', width: '56px', height: '56px' } }, icon('check', 56)); el.append(ck);
  hud.append(el); return { el, box, lbl, ck, i };
});
stage.append(hud);
const ACT = MODS.map((m) => m.kick[0].at - 0.15);
const bigPos = (i) => ({ x: 960 + (2.5 - i) * 232, y: 640 });
const railPos = (i) => ({ x: 1680 - i * 288, y: 985 });
const updateHud = (t) => {
  const vis = t >= 9.55 && t < 51.0;
  hud.style.display = vis ? 'block' : 'none'; if (!vis) return;
  const outA = 1 - seg(t, 50.8, 51.0, E.lin);
  let active = -1; ACT.forEach((a, i) => { if (t >= a) active = i; });
  const toRail = seg(t, 13.3, 14.4, E.inOut);
  chips.forEach(({ el, box, lbl, ck, i }) => {
    const k = t - (9.6 + i * 0.12); const appear = k < 0 ? 0 : spr(k, 11, 6.5);
    const fly = clamp(seg(t, 13.3 + i * 0.1, 14.3 + i * 0.1, E.inOut));
    const b = bigPos(i), r = railPos(i); const sz = lerp(1, 0.56, fly);
    const x = lerp(b.x, r.x, fly) - 85, y = lerp(b.y, r.y, fly) - 85;
    const fadeBig = t >= 11.0 && t < 13.3 ? 1 : 1; // Reihe bleibt sichtbar
    const isAct = i === active && t < 50.9, done = i < active || (active === 5 && i === 5 && t > 50.2);
    const hover = fly < 1 ? Math.sin(t * 2 + i) * 6 * (1 - fly) : 0;
    xf(el, { x, y: y + hover, s: appear * sz * (isAct ? 1.18 : 1), o: appear * outA * fadeBig });
    box.style.background = fly < 0.5 ? RED : (isAct ? RED : done ? GREEN : 'rgba(255,255,255,.14)');
    box.style.boxShadow = isAct ? '0 0 0 8px rgba(244,52,58,.35), 0 20px 50px rgba(244,52,58,.5)' : '0 30px 60px rgba(0,0,0,.25)';
    lbl.style.opacity = String(fly > 0.7 ? 1 : 0); lbl.style.color = isAct ? '#fff' : 'rgba(255,255,255,.65)';
    xf(ck, { s: done ? pop(t, ACT[i + 1] ?? 50.9, 12, 7) : 0, o: done ? 1 : 0 });
  });
  const prog = active < 0 ? 0 : (active + (active === 5 ? clamp((t - ACT[5]) / 5.8) : clamp((t - ACT[active]) / (ACT[active + 1] - ACT[active])))) / 5;
  xf(railLine, { o: toRail * outA }); xf(railLine.firstChild, { sx: clamp(prog), sy: 1 });
};

// ================= 3 Schluss: «مبيعات أسرع… حسابات أدق… وإدارة أوضح» (50.95 – 54.4) =================
const TRIO = [['bolt', 'مبيعات', 'أسرع', 51.0, 51.45], ['chart', 'حسابات', 'أدق', 52.0, 52.45], ['eye', 'إدارة', 'أوضح', 53.21, 53.75]];
mk(50.95, 54.4, `linear-gradient(180deg, #FF6A60 0%, ${RED} 45%, #C21F28 100%)`, (cam) => {
  const rays = h('div', { style: { position: 'absolute', left: '-300px', top: '-1000px', width: '2520px', height: '2520px', borderRadius: '50%', background: 'repeating-conic-gradient(rgba(255,255,255,.12) 0deg 8deg, rgba(255,255,255,0) 8deg 24deg)', maskImage: 'radial-gradient(closest-side, #000 15%, transparent 78%)', WebkitMaskImage: 'radial-gradient(closest-side, #000 15%, transparent 78%)' } });
  cam.append(rays);
  const cols = TRIO.map(([ic, a, b2, t1, t2], i) => {
    const cx = 1500 - i * 540;
    const box = h('div', { style: { position: 'absolute', left: px(cx - 110), top: '170px', width: '220px', height: '220px', borderRadius: '60px', background: '#fff', boxShadow: '0 40px 80px rgba(120,0,10,.4)', display: 'grid', placeItems: 'center' } }, li(ic, 130, RED, 6));
    const l1 = rline([{ w: a, at: t1, cls: 'white' }], { size: 92, color: '#fff', width: 520, font: 'ar' }); abs(l1, cx - 260, 430);
    const l2 = rline([{ w: b2, at: t2, cls: 'cream' }], { size: 250, width: 520 }); abs(l2, cx - 260, 560);
    cam.append(box, l1, l2); return { box, l1, l2, t1 };
  });
  return { rays, cols };
}, (lt, s, cam, t) => {
  camPush(cam, lt, 3.4, 0.05); xf(s.rays, { r: lt * 12 });
  s.cols.forEach(({ box, l1, l2, t1 }) => { box && xf(box, { s: pop(t, t1 - 0.05, 11, 6.5), r: lerp(-14, 0, E.out5(clamp((t - t1) / 0.5))), o: t >= t1 - 0.05 ? 1 : 0 }); l1.update(t); l2.update(t); });
});

// ================= 4 Zusammensetzen: «كل قطعة بمكانها… ونظام واحد لكل شغلك» (54.4 – 58.8) =================
mk(54.4, 58.8, `radial-gradient(1100px 900px at 50% 55%, #1d3a6b 0%, ${NAVY} 72%)`, (cam) => {
  cam.append(grid(0.04));
  const a = rline([{ w: 'كل', at: 54.52 }, { w: 'قطعة', at: 54.9 }, { w: 'بمكانها', at: 55.4, cls: 'gold' }], { size: 150, color: '#fff', width: 1700, gap: 0.22 }); abs(a, 110, 60);
  const pieces = CHIPS.map(([ic], i) => { const el = h('div', { style: { position: 'absolute', left: '0', top: '0', width: '200px', height: '200px', borderRadius: '44px', background: [RED, '#1d3a6b', RED, '#1d3a6b', RED, '#1d3a6b'][i], border: '4px solid rgba(255,255,255,.22)', display: 'grid', placeItems: 'center', boxShadow: '0 30px 60px rgba(0,0,0,.4)' } }, li(ic, 110, '#fff', 5)); cam.append(el); return el; });
  const mark = img('../img/puzzle.png', 480, { left: '720px', top: '300px', filter: 'drop-shadow(0 0 70px rgba(244,52,58,.6))' });
  const b = rline([{ w: 'ونظام', at: 56.54 }, { w: 'واحد', at: 57.0, cls: 'gold' }, { w: 'لكل', at: 57.6 }, { w: 'شغلك', at: 58.0 }], { size: 140, color: '#fff', width: 1700, gap: 0.22 }); abs(b, 110, 800);
  const burst = makeBurst(cam, { x: 960, y: 520, n: 50, seed: 7 });
  cam.append(a, mark, b);
  return { a, pieces, mark, b, burst };
}, (lt, s, cam, t) => {
  s.a.update(t); xf(s.a, { o: 1 - seg(t, 56.4, 56.6, E.lin) }); s.b.update(t);
  s.pieces.forEach((el, i) => {
    const col = i % 3, row = Math.floor(i / 3); const fx = 960 + (1 - col) * 218 - 100, fy = 520 + (row - 0.5) * 218 - 100;
    const a0 = 54.52 + i * 0.13, k = t - a0; const ang = rnd(i + 3) * 6.28; const sx = Math.cos(ang) * 1500, sy = Math.sin(ang) * 900;
    const arrive = clamp(k / 0.65); const e = E.out5(arrive);
    const merge = seg(t, 56.45, 56.75, E.in);
    xf(el, { x: lerp(fx + sx, fx, e) + (960 - 100 - fx) * merge, y: lerp(fy + sy, fy, e) + (520 - 100 - fy) * merge, s: (k < 0 ? 0 : 1) * (1 - 0.9 * merge) * (1 + (k > 0.6 && k < 0.9 ? 0.06 * Math.sin((k - 0.6) / 0.3 * Math.PI) : 0)), r: lerp(360, 0, e), o: k < 0 ? 0 : 1 - merge });
  });
  const mk0 = t - 56.7; xf(s.mark, { s: mk0 < 0 ? 0 : spr(mk0, 10, 5.5), r: lerp(-20, 0, E.out5(clamp(mk0 / 0.6))), o: mk0 < 0 ? 0 : 1 });
  s.burst(t - 56.7);
});

// ================= 5 Aufruf: «جرّب النسخة التجريبية من مجموعة داماس للحلول الرقمية… واطلبها اليوم!» (58.8 – 64.4) =================
mk(58.8, 64.4, `linear-gradient(180deg, #10264a 0%, ${NAVY} 60%, #3a0d14 100%)`, (cam) => {
  cam.append(glow('rgba(244,52,58,A)', 960, 1250, 1700, 520, 0.22), grid(0.04));
  const app = img('../img/app-mark.png', 520, { left: '210px', top: '90px', filter: 'drop-shadow(0 30px 50px rgba(0,0,0,.5)) drop-shadow(0 0 60px rgba(244,52,58,.45))' });
  const logo = img('../img/company-dark.png', 640, { left: '150px', top: '640px' });
  const a = rline([{ w: 'جرّب', at: 58.91 }, { w: 'النسخة', at: 59.3 }, { w: 'التجريبية', at: 59.75, cls: 'gold' }], { size: 124, color: '#fff', width: 860, align: 'flex-start', gap: 0.2 }); abs(a, 1000, 130);
  const nm = rline([{ w: 'من', at: 60.35 }, { w: 'مجموعة', at: 60.6 }, { w: 'داماس', at: 61.05 }, { w: 'للحلول', at: 61.5 }, { w: 'الرقمية', at: 61.9, cls: 'gold' }], { size: 66, color: '#fff', width: 860, align: 'flex-start', font: 'ar', gap: 0.25 }); abs(nm, 1000, 470);
  const cta = h('div', { style: { position: 'absolute', left: '1080px', top: '690px', width: '720px', height: '160px', borderRadius: '80px', background: RED, boxShadow: '0 20px 0 #9a1219, 0 50px 90px rgba(244,52,58,.5)', display: 'grid', placeItems: 'center', overflow: 'hidden' } });
  const ct = rline([{ w: 'واطلبها', at: 62.47 }, { w: 'اليوم!', at: 62.9 }], { size: 78, color: '#fff', width: 640, font: 'ar', gap: 0.24 }); ct.style.position = 'relative'; cta.append(ct);
  const url = h('div', { class: 'lat', style: { position: 'absolute', left: '1190px', top: '900px', width: '500px', height: '84px', borderRadius: '42px', background: 'rgba(255,255,255,.1)', border: '3px solid rgba(255,255,255,.3)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', fontSize: '33px', fontWeight: 700 } }, li('globe', 46, '#fff', 5), 'd-group-it-solutions.de');
  const cursor = h('svg', { viewBox: '0 0 24 24', width: 130, height: 130, style: { position: 'absolute', left: 0, top: 0, filter: 'drop-shadow(0 8px 6px rgba(0,0,0,.4))' } }); cursor.innerHTML = '<path d="M5 2 L5 19 L9.5 15 L12.5 22 L15.5 20.6 L12.6 13.8 L18.5 13.4 Z" fill="#fff" stroke="#111" stroke-width="1.3" stroke-linejoin="round"/>';
  const ring = h('div', { style: { position: 'absolute', left: '1680px', top: '740px', width: '120px', height: '120px', borderRadius: '50%', border: '8px solid rgba(255,255,255,.9)' } });
  cam.append(app, logo, a, nm, cta, url, ring, cursor);
  return { app, logo, a, nm, cta, ct, url, cursor, ring };
}, (lt, s, cam, t) => {
  camPush(cam, lt, 5.6, 0.03);
  const k = t - 58.85; xf(s.app, { s: k < 0 ? 0 : spr(k, 10, 6), y: Math.sin(t * 2.3) * 8, o: k < 0 ? 0 : 1 });
  const l = t - 59.0; xf(s.logo, { s: lerp(0.8, 1, E.out5(clamp(l / 0.5))), y: lerp(50, 0, E.out5(clamp(l / 0.5))), o: seg(t, 59.0, 59.3, E.lin) });
  s.a.update(t); s.nm.update(t); s.ct.update(t);
  const c = t - 62.35; const pr = t > 63.1 && t < 63.28; xf(s.cta, { s: (c < 0 ? 0 : spr(c, 11, 6)) * (pr ? 0.97 : 1 + 0.012 * Math.sin(t * 7)), y: pr ? 12 : 0, o: c < 0 ? 0 : 1 });
  xf(s.url, { s: t < 62.6 ? 0 : spr(t - 62.6, 11, 6), o: t > 62.6 ? 1 : 0 });
  const m = seg(t, 62.6, 63.1, E.inOut); xf(s.cursor, { x: lerp(1850, 1713, m), y: lerp(1040, 789, m) + (pr ? 8 : 0), o: t > 62.6 ? 1 : 0 });
  const rk = clamp((t - 63.1) / 0.5); xf(s.ring, { s: 0.4 + rk * 1.8, o: t > 63.1 && rk < 1 ? 1 - rk : 0 });
});

// ================= Logo-Wasserzeichen, Übergänge =================
const bugL = img('../img/company-light.png', 250, { left: '54px', top: '34px' }), bugD = img('../img/company-dark.png', 250, { left: '54px', top: '34px' });
stage.append(bugL, bugD);
const wipe = h('div', { style: { position: 'absolute', left: '-1040px', top: '-1460px', width: '4000px', height: '4000px', borderRadius: '50%', background: NAVY, display: 'none' } }); stage.append(wipe);
const flash = h('div', { style: { position: 'absolute', inset: 0, background: '#fff', opacity: 0 } });
const vig = h('div', { style: { position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center, rgba(0,0,0,0) 62%, rgba(0,0,0,.32) 100%)' } });
stage.append(flash, vig);
const FLASHES = [[0.08, 0.1, 0.5], [7.25, 0.18, 0.55], [9.5, 0.1, 0.25], [50.95, 0.14, 0.6], [54.4, 0.14, 0.5], [56.7, 0.2, 0.7], [58.75, 0.12, 0.35]];

window.DURATION = 64.4;
window.SFX = [
  [0.08, 'pop'], [0.94, 'pop'], [1.75, 'pop'], [2.69, 'pop'], [3.46, 'pop'], [4.35, 'pop'], [5.0, 'pop'], [6.4, 'tick'], [6.85, 'riser'], [7.0, 'whoosh'], [7.3, 'boom'],
  [7.45, 'pop'], [7.85, 'pop'], [8.35, 'pop'], [8.8, 'ding'], [9.5, 'pop'], [10.45, 'pop'], [9.6, 'tick'], [9.72, 'tick'], [9.84, 'tick'], [9.96, 'tick'], [10.08, 'tick'], [10.2, 'tick'], [11.13, 'whoosh'], [12.3, 'pop'], [12.69, 'pop'], [13.3, 'whoosh'], [14.35, 'ding'], [14.7, 'whoosh'],
  [15.2, 'pop'], [16.0, 'tick'], [16.4, 'tick'], [16.8, 'tick'], [17.95, 'click'], [18.7, 'ding'], [20.0, 'pop'], [21.2, 'whoosh'], [21.7, 'pop'],
  [22.85, 'click'], [23.55, 'beep'], [24.0, 'click'], [24.95, 'click'], [25.2, 'kaching'], [25.75, 'print'], [26.9, 'ding'], [28.35, 'whoosh'], [28.9, 'pop'],
  [29.4, 'tick'], [29.8, 'tick'], [30.2, 'tick'], [30.6, 'tick'], [31.05, 'beep'], [31.1, 'pop'], [33.1, 'whoosh'], [34.3, 'tick'], [34.6, 'tick'], [34.9, 'tick'], [35.5, 'ding'], [35.9, 'whoosh'], [37.1, 'pop'], [36.7, 'tick'], [39.3, 'ding'], [39.65, 'whoosh'],
  [40.0, 'tick'], [40.4, 'tick'], [40.8, 'tick'], [41.3, 'pop'], [42.19, 'ding'], [42.91, 'beep'], [43.95, 'pop'], [44.35, 'whoosh'], [45.3, 'pop'], [46.84, 'pop'], [47.6, 'pop'], [48.88, 'ding'], [50.0, 'click'], [50.2, 'kaching'],
  [50.9, 'whoosh'], [51.0, 'boom'], [51.45, 'pop'], [52.0, 'pop'], [52.45, 'pop'], [53.21, 'pop'], [53.75, 'pop'], [54.3, 'whoosh'],
  [54.52, 'pop'], [54.65, 'pop'], [54.78, 'pop'], [54.91, 'pop'], [55.04, 'pop'], [55.17, 'pop'], [56.45, 'riser'], [56.7, 'boom'], [56.9, 'ding'], [58.7, 'whoosh'],
  [58.9, 'pop'], [59.75, 'pop'], [61.9, 'ding'], [62.35, 'pop'], [62.6, 'whoosh'], [63.1, 'click'],
];

window.render = (t) => {
  scenes.forEach((sc) => {
    const on = t >= sc.from && t < sc.to; sc.root.style.display = on ? 'block' : 'none'; if (!on) return;
    sc.update(t - sc.from, sc.st, sc.cam, t);
    if (sc.slide) { const enter = seg(t, sc.from, sc.from + 0.5, E.out5), exit = seg(t, sc.to - 0.3, sc.to, E.in); sc.cam.style.transform = `translateX(${(1 - enter) * -1500 + exit * 1500}px)`; }
  });
  updateHud(t);
  // Wasserzeichen
  const bl = t < 7.0 ? 1 : 0, bd = t >= 14.7 && t < 51.0 ? 1 : 0;
  bugL.style.opacity = String(bl * seg(t, 0.2, 0.5, E.lin) * (1 - seg(t, 6.9, 7.1, E.lin))); bugD.style.opacity = String(bd * seg(t, 14.7, 15.0, E.lin) * (1 - seg(t, 50.8, 51.0, E.lin)));
  // Kreisblende Hook → Navy
  const c = seg(t, 6.95, 7.25, E.inOut); wipe.style.display = t >= 6.95 && t < 7.4 ? 'block' : 'none'; xf(wipe, { s: Math.max(c, 0.001), o: t < 7.25 ? 1 : 1 - seg(t, 7.25, 7.4, E.lin) });
  let f = 0; for (const [t0, d, p] of FLASHES) if (t >= t0 && t < t0 + d) f = Math.max(f, p * (1 - (t - t0) / d)); flash.style.opacity = String(f);
  window.ready = true;
};
await Promise.all(IMGS.map((i) => i.decode().catch(() => {})));
window.ready = true; window.render(0);
