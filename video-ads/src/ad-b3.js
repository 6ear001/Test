// Video B3 – «٣ ثواني» (Studio-Fassung 2, neuer Sprechertext, abgestimmt auf die ElevenLabs-Datei voice-b3.mp3, 42,6 s)
// Alle `at`-Werte sind absolute Sekunden der Sprachaufnahme (aus den Sprechpausen und der Hüllkurve der Datei bestimmt).
import { h, clamp, lerp, E, px, xf, place } from './lib.js';
import { makePOS, icon } from './parts.js';
import { spr, seg, rnd, rline, li, makeBurst } from './pro.js';

const NAVY = '#0A1428', RED = '#F4343A', CREAM = '#F6F0E4', GREEN = '#2FD08A', GOLD = '#FFC83D';
const stage = document.getElementById('stage');
const scenes = [];
const IMGS = [];
const mk = (from, to, bg, build, update) => { const root = h('div', { class: 'shot', style: { background: bg } }); const cam = h('div', { class: 'layer', style: { pointerEvents: 'none' } }); root.append(cam); const st = build(cam, root) || {}; stage.append(root); scenes.push({ from, to, root, cam, st, update }); return scenes[scenes.length - 1]; };
const abs = (el, x, y, extra = {}) => place(el, x, y, extra);
const img = (src, w, extra = {}) => { const i = h('img', { src, style: { position: 'absolute', width: px(w), ...extra } }); IMGS.push(i); return i; };
const camPush = (cam, lt, len, amount = 0.06, fx = 540, fy = 960) => { cam.style.transformOrigin = `${fx}px ${fy}px`; cam.style.transform = `scale(${1 + amount * clamp(lt / len)})`; };
const glow = (c, x, y, w, h_, a = 0.4) => h('div', { class: 'layer', style: { background: `radial-gradient(${w}px ${h_}px at ${x}px ${y}px, ${c.replace('A', a)}, transparent)` } });
const dots = () => h('div', { class: 'layer', style: { backgroundImage: 'radial-gradient(circle, rgba(11,26,51,.09) 3px, transparent 4px)', backgroundSize: '54px 54px' } });
const grid = (a = 0.05) => h('div', { class: 'layer', style: { backgroundImage: `linear-gradient(rgba(255,255,255,${a}) 2px, transparent 2px), linear-gradient(90deg, rgba(255,255,255,${a}) 2px, transparent 2px)`, backgroundSize: '90px 90px' } });
const person = (fill) => { const s = h('svg', { viewBox: '0 0 100 160', width: 124, height: 198, style: { position: 'absolute', left: 0, top: 0 } }); s.innerHTML = `<circle cx="50" cy="32" r="26" fill="${fill}"/><path d="M12 158 C12 96 30 70 50 70 C70 70 88 96 88 158 Z" fill="${fill}"/>`; return s; };

// Zeitleiste der Szenen (Sekunden)
const B = { s2: 2.8, s3: 6.05, s4: 10.78, s4b: 14.12, s5: 16.1, s6: 21.55, s6b: 25.03, s7: 31.5, s8: 33.98, s9: 37.16, end: 42.6 };

// ================= 1 Hook: «تلات ثواني… وخلصت العملية!» (0 – 2.8) =================
mk(0, B.s2, `linear-gradient(180deg, #FF6A60 0%, ${RED} 45%, #C21F28 100%)`, (cam) => {
  const rings = [0, 1, 2, 3].map(() => { const r = h('div', { style: { position: 'absolute', left: '210px', top: '430px', width: '660px', height: '660px', borderRadius: '50%', border: '4px solid rgba(255,255,255,.4)' } }); cam.append(r); return r; });
  const shock = h('div', { style: { position: 'absolute', left: '210px', top: '430px', width: '660px', height: '660px', borderRadius: '50%', border: '14px solid #fff' } }); cam.append(shock);
  const svg = h('svg', { viewBox: '0 0 1000 1000', width: 840, height: 840, style: { position: 'absolute', left: '120px', top: '340px' } });
  svg.innerHTML = `<circle cx="500" cy="500" r="430" fill="none" stroke="rgba(255,255,255,.28)" stroke-width="18"/><circle id="arc" cx="500" cy="500" r="430" fill="none" stroke="#fff" stroke-width="18" stroke-linecap="round" stroke-dasharray="2701.8" stroke-dashoffset="2701.8" transform="rotate(-90 500 500)"/>${[...Array(60)].map((_, i) => `<line x1="500" y1="${i % 5 ? 52 : 40}" x2="500" y2="${i % 5 ? 62 : 70}" stroke="rgba(255,255,255,.55)" stroke-width="${i % 5 ? 3 : 6}" transform="rotate(${i * 6} 500 500)"/>`).join('')}`;
  const num = h('div', { class: 'lz', style: { position: 'absolute', left: 0, top: '442px', width: '1080px', textAlign: 'center', fontSize: '660px', lineHeight: 1, color: '#fff', textShadow: '0 40px 70px rgba(120,0,10,.45)' } }, '٣');
  const sec = rline([{ w: 'ثواني!', at: 0.31, cls: 'cream' }], { size: 200 }); abs(sec, 50, 1120);
  const l2 = rline([{ w: 'وخلصت', at: 1.19 }, { w: 'العملية!', at: 1.82, cls: 'pill' }], { size: 124, color: '#fff', width: 1040, gap: 0.22 }); abs(l2, 20, 1390);
  const badge = h('div', { style: { position: 'absolute', left: '665px', top: '850px', width: '250px', height: '250px', filter: 'drop-shadow(0 20px 30px rgba(0,60,30,.45))' } }, icon('check', 250, GREEN));
  cam.prepend(h('div', { class: 'layer', style: { background: 'radial-gradient(900px 700px at 50% 42%, rgba(255,255,255,.22), transparent 70%)' } }));
  cam.append(svg, num, sec, l2, badge);
  return { rings, shock, svg, num, sec, l2, badge };
}, (lt, s, cam) => {
  camPush(cam, lt, 2.8, 0.07, 540, 850);
  const k = clamp((lt - 0.03) / 0.45); xf(s.num, { s: lerp(1.7, 1, E.out5(k)) * (1 + 0.02 * Math.sin(lt * 9) * (1 - k)), o: clamp((lt - 0.03) * 20) });
  const sk = clamp((lt - 0.03) / 0.8); const sk2 = clamp((lt - 2.28) / 0.6);
  xf(s.shock, { s: lt < 2.2 ? lerp(0.4, 2.6, E.out(sk)) : lerp(0.9, 2.0, E.out(sk2)), o: lt < 2.2 ? 1 - sk : (1 - sk2) * 0.55 });
  s.rings.forEach((r, i) => { const f = (lt * 0.55 + i / 4) % 1; xf(r, { s: 0.45 + f * 2.2, o: (1 - f) * 0.3 }); });
  const arc = s.svg.querySelector('#arc'); arc.setAttribute('stroke-dashoffset', String(2701.8 * (1 - seg(lt, 0.03, 2.3, E.lin)))); arc.setAttribute('stroke', lt >= 2.3 ? GREEN : '#fff');
  s.sec.update(lt); s.l2.update(lt);
  const bk = lt - 2.3; xf(s.badge, { s: bk < 0 ? 0 : spr(bk, 12, 7), r: lerp(-20, 0, E.out5(clamp(bk / 0.5))), o: bk < 0 ? 0 : 1 });
});

// ================= 2 Der Kunde wartet nicht (2.8 – 6.05) =================
mk(B.s2, B.s3, `linear-gradient(180deg, #0F2548 0%, ${NAVY} 75%)`, (cam) => {
  cam.append(grid(0.05), glow('rgba(244,52,58,A)', 540, 1900, 1000, 700, 0.4));
  const clock = h('svg', { viewBox: '0 0 200 200', width: 480, height: 480, style: { position: 'absolute', left: '300px', top: '190px' } });
  clock.innerHTML = `<circle cx="100" cy="100" r="92" fill="rgba(255,255,255,.07)" stroke="#fff" stroke-width="9"/>${[...Array(12)].map((_, i) => `<line x1="100" y1="${i % 3 ? 17 : 14}" x2="100" y2="${i % 3 ? 24 : 30}" stroke="#fff" stroke-width="${i % 3 ? 4 : 7}" stroke-linecap="round" transform="rotate(${i * 30} 100 100)"/>`).join('')}<g id="hh"><line x1="100" y1="100" x2="100" y2="58" stroke="#fff" stroke-width="9" stroke-linecap="round"/></g><g id="mh"><line x1="100" y1="100" x2="100" y2="32" stroke="#fff" stroke-width="6" stroke-linecap="round"/></g><g id="sh"><line x1="100" y1="116" x2="100" y2="26" stroke="${RED}" stroke-width="4" stroke-linecap="round"/></g><circle cx="100" cy="100" r="9" fill="${RED}"/>`;
  const bell1 = h('div', { style: { position: 'absolute', left: '330px', top: '170px', width: '110px', height: '110px', borderRadius: '50%', background: RED, boxShadow: '0 12px 30px rgba(244,52,58,.5)' } });
  const bell2 = h('div', { style: { position: 'absolute', left: '640px', top: '170px', width: '110px', height: '110px', borderRadius: '50%', background: RED, boxShadow: '0 12px 30px rgba(244,52,58,.5)' } });
  const ta = rline([{ w: 'الزبون', at: 2.93 }, { w: 'ما', at: 3.4 }, { w: 'بحب', at: 3.55 }, { w: 'ينتظر…', at: 3.72, cls: 'gold' }], { size: 120, color: '#fff', width: 1040, gap: 0.2 }); abs(ta, 20, 770);
  const tb1 = rline([{ w: 'وإنت', at: 4.3 }, { w: 'كمان', at: 4.52 }, { w: 'ما', at: 4.86 }, { w: 'عندك', at: 5.02 }], { size: 120, color: '#fff', width: 1040, gap: 0.2 }); abs(tb1, 20, 960);
  const tb2 = rline([{ w: 'وقت', at: 5.33, cls: 'hot' }, { w: 'تضيّعه!', at: 5.6, cls: 'hot' }], { size: 176, width: 1040 }); abs(tb2, 20, 1140);
  const people = [0, 1, 2, 3, 4].map((i) => { const p = person(i % 2 ? '#1c3a6b' : '#d9e3f5'); cam.append(p); return p; });
  cam.append(clock, ta, tb1, tb2);
  return { clock, ta, tb1, tb2, people };
}, (lt, s, cam, t) => {
  camPush(cam, lt, 3.25, 0.05);
  const spin = (lt * lt * 70) + lt * 120; // beschleunigt
  s.clock.querySelector('#mh').setAttribute('transform', `rotate(${spin} 100 100)`); s.clock.querySelector('#hh').setAttribute('transform', `rotate(${spin / 12} 100 100)`); s.clock.querySelector('#sh').setAttribute('transform', `rotate(${spin * 6} 100 100)`);
  xf(s.clock, { s: lerp(0.6, 1, E.out5(clamp(lt / 0.5))) * (1 + 0.012 * Math.sin(lt * 14)), o: clamp(lt * 6) });
  s.ta.update(t); s.tb1.update(t); s.tb2.update(t);
  const leave = [0, 0, seg(t, 5.3, 6.0, E.in), seg(t, 4.6, 5.3, E.in), seg(t, 3.78, 4.5, E.in)];
  s.people.forEach((p, i) => { const go = leave[i]; xf(p, { x: 90 + i * 190 + go * 1000, y: 1600 + Math.sin(t * 5 + i * 1.7) * 6 - Math.sin(go * Math.PI) * 30, o: seg(t, B.s2 + 0.1 + i * 0.07, B.s2 + 0.4, E.out) * (1 - go * 0.3) }); });
});

// ================= 3 Alte Methode: Fragen (6.05 – 10.7) =================
const ROWS3 = [
  { ic: 'notebook', spec: [{ w: 'لسه', at: 6.36 }, { w: 'عم', at: 6.62 }, { w: 'تكتب', at: 6.78 }, { w: 'عالورق؟', at: 7.12, cls: 'hot' }], drop: 6.4, x: 7.45 },
  { ic: 'calc', spec: [{ w: 'وتحسب', at: 7.87 }, { w: 'عالآلة', at: 8.42 }, { w: 'الحاسبة؟', at: 8.78, cls: 'hot' }], drop: 7.9, x: 9.0 },
  { ic: 'coins', spec: [{ w: 'وتدوّر', at: 9.48 }, { w: 'على', at: 10.0 }, { w: 'الفكّة؟', at: 10.2, cls: 'hot' }], drop: 9.5, x: 10.35 },
];
const coinsCluster = () => { const g = h('div', { style: { position: 'absolute', inset: 0 } }); [[10, 160, 170], [150, 70, 150], [170, 190, 140], [40, 20, 110]].forEach(([x, y, w]) => g.append(h('div', { style: { position: 'absolute', left: px(x), top: px(y), width: px(w), height: px(w) } }, icon('coin', w)))); return g; };
mk(B.s3, B.s4, CREAM, (cam) => {
  cam.append(dots(), glow('rgba(244,52,58,A)', 900, 200, 700, 500, 0.15), glow('rgba(255,170,120,A)', 100, 1500, 800, 600, 0.25));
  const chip = h('div', { class: 'ar', style: { position: 'absolute', left: '340px', top: '110px', width: '400px', padding: '16px 0', textAlign: 'center', borderRadius: '60px', background: '#0B1A33', color: '#fff', fontSize: '50px', boxShadow: '0 20px 40px rgba(11,26,51,.3)' } }, 'الطريقة القديمة');
  const rows = ROWS3.map((r, i) => {
    const y = 290 + i * 440;
    const box = h('div', { style: { position: 'absolute', left: '660px', top: px(y), width: '330px', height: '330px' } }, r.ic === 'coins' ? coinsCluster() : icon(r.ic, 320));
    const line = rline(r.spec, { size: 96, color: '#0B1A33', width: r.ic === 'coins' ? 440 : 590, align: 'flex-start', lh: 1.25 }); abs(line, r.ic === 'coins' ? 200 : 50, y + 55);
    const xb = h('div', { style: { position: 'absolute', left: '630px', top: px(y - 10), width: '110px', height: '110px' } }, icon('cross', 110));
    if (i < 2) cam.append(h('div', { style: { position: 'absolute', left: '90px', top: px(y + 385), width: '900px', height: '6px', borderRadius: '3px', background: 'rgba(11,26,51,.1)' } }));
    cam.append(box, line, xb); return { box, line, xb, r };
  });
  const coin = h('div', { style: { position: 'absolute', left: 0, top: 0, width: '150px', height: '150px' } }, icon('coin', 150));
  const coin2 = h('div', { style: { position: 'absolute', left: 0, top: 0, width: '100px', height: '100px' } }, icon('coin', 100));
  const timer = h('div', { class: 'mono', style: { position: 'absolute', left: '300px', top: '1660px', width: '480px', padding: '14px 0', textAlign: 'center', borderRadius: '30px', background: '#fff', color: RED, fontSize: '110px', fontWeight: 700, boxShadow: '0 24px 50px rgba(11,26,51,.22)' } }, '00:00');
  cam.append(chip, coin, coin2, timer);
  return { chip, rows, coin, coin2, timer };
}, (lt, s, cam, t) => {
  camPush(cam, lt, 4.65, 0.04);
  xf(s.chip, { y: lerp(-160, 0, seg(t, B.s3, B.s3 + 0.45, E.out5)), o: 1 });
  s.rows.forEach(({ box, line, xb, r }) => {
    line.update(t);
    const k = t - r.drop; const yy = k < 0 ? -800 : lerp(-800, 0, E.out5(clamp(k / 0.55))) + (k > 0.55 ? Math.sin((k - 0.55) * 14) * 8 * Math.exp(-(k - 0.55) * 6) : 0);
    xf(box, { y: yy, r: lerp(-18, r.ic === 'calc' ? 6 : -6, E.out5(clamp(k / 0.6))), o: k < 0 ? 0 : 1 });
    const xk = t - r.x; xf(xb, { s: xk < 0 ? 0 : spr(xk, 13, 7), o: xk < 0 ? 0 : 1 });
  });
  const ck = clamp((t - 10.1) / 0.6); xf(s.coin, { x: lerp(1150, 120, E.inOut(ck)), y: 1520 + Math.abs(Math.sin(ck * 9)) * -90 * (1 - ck * 0.5), r: -ck * 900, o: t >= 10.1 && ck < 1 ? 1 : 0 });
  const c2 = clamp((t - 10.2) / 0.55); xf(s.coin2, { x: lerp(1150, 80, E.inOut(c2)), y: 1580 + Math.abs(Math.sin(c2 * 8)) * -60 * (1 - c2 * 0.5), r: -c2 * 800, o: t >= 10.2 && c2 < 1 ? 1 : 0 });
  const sec = Math.min(47, 47 * clamp((t - B.s3) / (B.s4 - B.s3 - 0.1))); s.timer.textContent = `00:${String(Math.floor(sec)).padStart(2, '0')}`;
  xf(s.timer, { s: seg(t, B.s3 + 0.05, B.s3 + 0.5, (x) => spr(x * 0.5, 12, 7)), o: 1 }); s.timer.style.color = Math.floor(t * 6) % 2 && sec > 30 ? '#8f1218' : RED;
});

// ================= 4 Marke: «مع نظام الكاشير من مجموعة دماس للحلول التقنية» (10.7 – 14.12) =================
mk(B.s4, B.s4b, `linear-gradient(180deg, #0F2548 0%, ${NAVY} 70%)`, (cam) => {
  cam.append(glow('rgba(244,52,58,A)', 540, 1900, 1000, 800, 0.45), h('div', { class: 'layer', style: { backgroundImage: 'linear-gradient(rgba(255,255,255,.05) 2px, transparent 2px), linear-gradient(90deg, rgba(255,255,255,.05) 2px, transparent 2px)', backgroundSize: '90px 90px', maskImage: 'linear-gradient(transparent, #000 60%, transparent)', WebkitMaskImage: 'linear-gradient(transparent, #000 60%, transparent)' } }));
  const w1 = rline([{ w: 'مع', at: 10.93 }, { w: 'نظام', at: 11.15 }, { w: 'الكاشير', at: 11.57, cls: 'gold' }], { size: 150, color: '#fff' }); abs(w1, 40, 170);
  const app = img('../img/mark-dark.png', 540, { left: '270px', top: '420px', filter: 'drop-shadow(0 30px 50px rgba(0,0,0,.5)) drop-shadow(0 0 60px rgba(244,52,58,.45))' });
  const logo = img('../img/company-dark.png', 780, { left: '150px', top: '1010px' });
  const nm = rline([{ w: 'مجموعة', at: 12.15 }, { w: 'دماس', at: 12.62 }, { w: 'للحلول', at: 13.0 }, { w: 'التقنية', at: 13.6, cls: 'gold' }], { size: 104, color: '#fff', width: 900 }); abs(nm, 90, 1390);
  cam.append(w1, app, logo, nm);
  return { w1, app, logo, nm };
}, (lt, s, cam, t) => {
  camPush(cam, lt, 3.4, 0.05); s.w1.update(t); s.nm.update(t);
  const a = t - 11.57; xf(s.app, { s: a < 0 ? 0 : spr(a, 11, 6), r: lerp(-14, 0, E.out5(clamp(a / 0.5))) + Math.sin(t * 2.2) * 1.5, y: Math.sin(t * 2.5) * 8, o: a < 0 ? 0 : 1 });
  const l = t - 12.0; xf(s.logo, { s: l < 0 ? 0.6 : lerp(0.6, 1, E.out5(clamp(l / 0.5))) , y: lerp(60, 0, E.out5(clamp(l / 0.5))), o: seg(t, 12.0, 12.25, E.lin) });
});

// ================= 4b Aussage: «كل شي صار أسرع وأسهل!» (14.12 – 16.05) =================
mk(B.s4b, B.s5, `linear-gradient(180deg, #FF6A60 0%, ${RED} 45%, #C21F28 100%)`, (cam) => {
  const rays = h('div', { style: { position: 'absolute', left: '-700px', top: '-300px', width: '2480px', height: '2480px', borderRadius: '50%', background: 'repeating-conic-gradient(rgba(255,255,255,.14) 0deg 8deg, rgba(255,255,255,0) 8deg 24deg)', maskImage: 'radial-gradient(closest-side, #000 15%, transparent 78%)', WebkitMaskImage: 'radial-gradient(closest-side, #000 15%, transparent 78%)' } });
  const a = rline([{ w: 'كل', at: 14.26 }, { w: 'شي', at: 14.5 }, { w: 'صار', at: 14.78 }], { size: 160, color: '#fff' }); abs(a, 50, 380);
  const b = rline([{ w: 'أسرع', at: 15.06, cls: 'cream' }], { size: 400, width: 1040 }); abs(b, 20, 640);
  const c = rline([{ w: 'وأسهل!', at: 15.55, cls: 'pill' }], { size: 250, color: '#fff', width: 1040 }); abs(c, 20, 1130);
  cam.prepend(rays); cam.append(a, b, c);
  return { rays, a, b, c };
}, (lt, s, cam, t) => {
  cam.style.transformOrigin = '540px 960px'; cam.style.transform = `scale(${1 + 0.06 * clamp(lt / 1.95) + 0.14 * (1 - E.out5(clamp(lt / 0.3)))})`;
  xf(s.rays, { r: lt * 14, o: 1 });
  s.a.update(t); s.b.update(t); s.c.update(t);
});

// ================= 5 Kasse in 3 Sekunden (16.05 – 21.9) =================
const T0 = B.s5;
const CFG = { taps: [{ t: 16.75 - T0, idx: 1 }, { t: 18.15 - T0, idx: 4 }], payAt: 19.2 - T0, paidAt: 19.45 - T0, printAt: 19.75 - T0 };
const STEPS = [{ n: '١', w: 'اختار المنتج', at: 16.22, done: 17.15 }, { n: '٢', w: 'امسح الباركود', at: 17.38, done: 18.4 }, { n: '٣', w: 'استلم الدفعة', at: 18.71, done: 19.45 }];
mk(T0, B.s6 + 0.35, `radial-gradient(900px 1100px at 50% 45%, #1d3a6b 0%, ${NAVY} 72%)`, (cam) => {
  cam.append(h('div', { style: { position: 'absolute', left: '140px', top: '1380px', width: '800px', height: '120px', borderRadius: '50%', background: 'radial-gradient(closest-side, rgba(0,0,0,.55), transparent)' } }));
  const persp = h('div', { style: { position: 'absolute', left: 0, top: '400px', width: '1080px', height: '960px', perspective: '2600px', perspectiveOrigin: '50% 35%' } });
  const wrap = h('div', { style: { position: 'absolute', left: '80px', top: '0', width: '920px', height: '860px', transformOrigin: '50% 60%' } });
  const pos = makePOS(); wrap.append(pos); persp.append(wrap);
  const glare = h('div', { style: { position: 'absolute', left: '30px', top: '28px', width: '860px', height: '548px', borderRadius: '22px', background: 'linear-gradient(115deg, rgba(255,255,255,.18) 0%, rgba(255,255,255,0) 38%)', pointerEvents: 'none' } }); wrap.append(glare);
  // Barcode-Etikett mit Laser (Schritt 2)
  const scanCard = h('div', { style: { position: 'absolute', left: '250px', top: '255px', width: '300px', height: '170px', borderRadius: '20px', background: '#fff', boxShadow: '0 30px 60px rgba(0,0,0,.45)', overflow: 'hidden', opacity: 0 } });
  scanCard.innerHTML = `<svg viewBox="0 0 300 170" width="300" height="170"><g fill="#111">${[...Array(32)].map((_, i) => `<rect x="${24 + i * 8.3}" y="28" width="${i % 3 ? 3 : 6}" height="92"/>`).join('')}</g><text x="150" y="150" text-anchor="middle" font-family="Outfit" font-weight="700" font-size="22" fill="#333">4 006381 333931</text></svg>`;
  const laser = h('div', { style: { position: 'absolute', left: '-20px', top: '0', width: '340px', height: '6px', background: RED, boxShadow: '0 0 28px 8px rgba(244,52,58,.85)' } }); scanCard.append(laser); wrap.append(scanCard);
  const timer = h('div', { style: { position: 'absolute', left: '250px', top: '110px', width: '580px', height: '170px', borderRadius: '85px', background: 'rgba(255,255,255,.1)', border: '3px solid rgba(255,255,255,.22)', display: 'flex', alignItems: 'center', gap: '30px', justifyContent: 'center', direction: 'ltr' } });
  const dot = h('div', { style: { width: '34px', height: '34px', borderRadius: '50%', background: RED } }); const tx = h('div', { class: 'mono', style: { color: '#fff', fontSize: '110px', fontWeight: 700, letterSpacing: '-.02em' } }, '00:00.0');
  timer.append(dot, tx);
  const steps = STEPS.map((s, i) => {
    const row = h('div', { style: { position: 'absolute', left: '90px', top: px(1480 + i * 125), width: '900px', height: '104px', display: 'flex', alignItems: 'center', gap: '28px', direction: 'rtl' } });
    const badge = h('div', { class: 'ar', style: { width: '100px', height: '100px', flex: 'none', borderRadius: '50%', background: RED, color: '#fff', display: 'grid', placeItems: 'center', fontSize: '58px', boxShadow: '0 12px 30px rgba(244,52,58,.4)' } }, s.n);
    const label = h('div', { class: 'ar', style: { color: '#fff', fontSize: '74px', whiteSpace: 'nowrap' } }, s.w);
    row.append(badge, label); cam.append(row); return { row, badge, label, s };
  });
  const fin = rline([{ w: 'والفاتورة', at: 19.65 }, { w: 'جاهزة', at: 20.5, cls: 'gold' }, { w: 'فورًا!', at: 21.07, cls: 'gold' }], { size: 124, color: '#fff', width: 1040, gap: 0.2 }); abs(fin, 20, 1560);
  const burst = makeBurst(cam, { x: 540, y: 980, n: 46, seed: 3 });
  cam.append(persp, timer, fin);
  return { persp, wrap, pos, timer, dot, tx, steps, fin, scanCard, laser, burst };
}, (lt, s, cam, t) => {
  const e = clamp(lt / 0.3); xf(cam, { s: lerp(0.86, 1, E.out5(e)), o: e });
  cam.style.transformOrigin = '540px 960px';
  const ry = lerp(-18, -4, seg(lt, 0, 3.4, E.out)), rx = lerp(10, 6, seg(lt, 0, 3.4, E.out));
  s.wrap.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg) scale(0.98) translateY(${Math.sin(lt * 1.6) * 8}px)`;
  s.pos.update(lt, CFG);
  const t1 = 16.65, t2 = 19.65; const el = clamp(t - t1, 0, 3.0); const run = t >= t1 && t < t2; const lock = t >= t2;
  s.tx.textContent = `00:0${Math.floor(el)}.${Math.floor((el % 1) * 10)}`;
  s.tx.style.color = lock ? GREEN : '#fff'; s.dot.style.background = lock ? GREEN : RED; s.dot.style.opacity = run ? (Math.floor(t * 4) % 2 ? 1 : 0.35) : 1;
  s.timer.style.borderColor = lock ? GREEN : 'rgba(255,255,255,.22)';
  xf(s.timer, { s: seg(t, T0 + 0.05, T0 + 0.5, (x) => spr(x * 0.5, 12, 7)) * (lock ? 1 + 0.08 * Math.exp(-(t - t2) * 9) * Math.cos((t - t2) * 30) : 1), o: 1 });
  // Barcode-Etikett
  const sc = seg(t, 17.55, 17.8, E.out5), so = 1 - seg(t, 18.2, 18.35, E.lin); s.scanCard.style.opacity = String(t > 17.5 ? sc * so : 0); s.scanCard.style.transform = `translateY(${(1 - sc) * 40}px) scale(${0.92 + 0.08 * sc})`;
  s.laser.style.top = `${10 + (((t - 17.8) / 0.4) % 1) * 150}px`;
  // Schritte
  s.steps.forEach(({ row, badge, label, s: st }) => {
    const k = t - st.at; const out = seg(t, 19.52, 19.66, E.lin);
    xf(row, { x: lerp(120, 0, E.out5(clamp(k / 0.45))), s: 1, o: (k < 0 ? 0 : clamp(k / 0.2)) * (1 - out) });
    const d = t >= st.done; badge.style.background = d ? GREEN : RED; badge.textContent = d ? '✓' : st.n; badge.style.boxShadow = d ? '0 12px 30px rgba(47,208,138,.45)' : '0 12px 30px rgba(244,52,58,.4)';
    xf(badge, { s: d ? 1 + 0.2 * Math.exp(-(t - st.done) * 10) * Math.cos((t - st.done) * 26) : 1 });
  });
  s.fin.update(t);
  s.burst(t - 20.5);
});

// ================= 6 Verkauf, Konten, Verwaltung (21.55 – 24.95) =================
const ROWS6 = [['bolt', [{ w: 'مبيعات', at: 21.75 }, { w: 'أسرع', at: 22.12, cls: 'hot' }], 21.75], ['chart', [{ w: 'حسابات', at: 22.83 }, { w: 'أدق', at: 23.3, cls: 'hot' }], 22.83], ['eye', [{ w: 'إدارة', at: 23.88 }, { w: 'أوضح', at: 24.4, cls: 'hot' }], 23.88]];
mk(B.s6, B.s6b, CREAM, (cam) => {
  cam.append(dots(), glow('rgba(244,52,58,A)', 100, 300, 800, 700, 0.18));
  const rows = ROWS6.map(([ic, spec, at], i) => {
    const y = 280 + i * 540;
    const box = h('div', { style: { position: 'absolute', left: '730px', top: px(y), width: '290px', height: '290px', borderRadius: '70px', background: RED, boxShadow: '0 36px 70px rgba(244,52,58,.38)', display: 'grid', placeItems: 'center' } }, li(ic, 170, '#fff', 6));
    const line = rline(spec, { size: 124, color: '#0B1A33', width: 640, align: 'flex-start' }); abs(line, 60, y + 65);
    const rule = h('div', { style: { position: 'absolute', left: '90px', top: px(y + 340), width: '640px', height: '8px', borderRadius: '4px', background: 'rgba(11,26,51,.12)' } }); const fill = h('div', { style: { width: '100%', height: '100%', borderRadius: '4px', background: RED, transformOrigin: '100% 50%' } }); rule.append(fill);
    cam.append(box, line, rule); return { box, line, fill, at };
  });
  return { rows };
}, (lt, s, cam, t) => {
  camPush(cam, lt, 3.4, 0.04);
  s.rows.forEach((r) => { const k = t - r.at; xf(r.box, { s: k < 0 ? 0 : spr(k, 12, 6), r: lerp(-12, 0, E.out5(clamp(k / 0.5))), o: k < 0 ? 0 : 1 }); r.line.update(t); xf(r.fill, { sx: seg(t, r.at + 0.1, r.at + 0.6, E.out5), sy: 1, o: t > r.at ? 1 : 0 }); });
});

// ================= 6b Funktionen (24.95 – 31.5) =================
const CARDS = [['touch', 'شاشة', 'لمس', 25.08, 'lz'], ['scan', 'قارئ', 'باركود', 26.08, 'lz'], ['shield', 'TSE', 'مدمج', 27.1, 'lat'], ['pda', 'PDA', 'للجرد ومتابعة المخزون', 28.63, 'lat']];
mk(B.s6b, B.s7, `linear-gradient(180deg, #11284d 0%, ${NAVY} 80%)`, (cam) => {
  cam.append(glow('rgba(244,52,58,A)', 540, 1950, 1100, 800, 0.4), grid(0.04));
  const cards = CARDS.map(([ic, t1, t2, at, fnt], i) => {
    const x = i % 2 === 0 ? 545 : 60, y = 300 + Math.floor(i / 2) * 690;
    const c = h('div', { style: { position: 'absolute', left: px(x), top: px(y), width: '475px', height: '640px', borderRadius: '64px', background: 'rgba(255,255,255,.07)', border: '3px solid rgba(255,255,255,.18)', boxShadow: '0 50px 90px rgba(0,0,0,.35)', textAlign: 'center' } });
    c.append(h('div', { style: { position: 'absolute', left: '112px', top: '50px', width: '250px', height: '250px', display: 'grid', placeItems: 'center' } }, li(ic, 220, '#fff', 5)));
    const w1 = h('div', { class: fnt, style: { position: 'absolute', left: 0, top: '330px', width: '100%', fontSize: '120px', fontWeight: 700, color: '#fff', lineHeight: 1.1 } }, t1);
    const w2 = h('div', { class: 'ar', style: { position: 'absolute', left: '20px', top: '485px', width: '435px', fontSize: ic === 'pda' ? '50px' : '66px', color: '#FFC83D', lineHeight: 1.2 } }, t2);
    const scanLine = ic === 'scan' ? h('div', { style: { position: 'absolute', left: '95px', top: '110px', width: '290px', height: '8px', borderRadius: '4px', background: RED, boxShadow: '0 0 30px 6px rgba(244,52,58,.8)' } }) : null;
    const ripple = ic === 'touch' ? h('div', { style: { position: 'absolute', left: '137px', top: '75px', width: '200px', height: '200px', borderRadius: '50%', border: '6px solid rgba(255,200,61,.8)' } }) : null;
    c.append(w1, w2); if (scanLine) c.append(scanLine); if (ripple) c.append(ripple); cam.append(c); return { c, at, scanLine, ripple };
  });
  const hub = h('div', { style: { position: 'absolute', left: '440px', top: '860px', width: '200px', height: '200px', borderRadius: '50%', background: '#fff', boxShadow: '0 20px 60px rgba(0,0,0,.45), 0 0 0 10px rgba(244,52,58,.35)', display: 'grid', placeItems: 'center' } }, img('../img/mark-light.png', 130, { position: 'relative' }));
  const pulse = h('div', { style: { position: 'absolute', left: '440px', top: '860px', width: '200px', height: '200px', borderRadius: '50%', border: '6px solid rgba(255,255,255,.7)' } });
  cam.append(pulse, hub);
  return { cards, hub, pulse };
}, (lt, s, cam, t) => {
  camPush(cam, lt, 6.55, 0.04, 540, 1000);
  s.cards.forEach((cd) => { const k = t - cd.at; const on = k >= 0; xf(cd.c, { s: on ? spr(k, 12, 6.5) : 0, y: on ? 0 : 60, o: on ? 1 : 0 }); const act = on && k < 0.9 ? 1 - k / 0.9 : 0; cd.c.style.borderColor = `rgba(244,52,58,${0.25 + act * 0.75})`; cd.c.style.background = `rgba(255,255,255,${0.07 + act * 0.1})`;
    if (cd.scanLine) { const f = ((t - cd.at) * 1.6) % 1; xf(cd.scanLine, { y: 10 + (f < 0.5 ? f * 2 : 2 - f * 2) * 170, o: on ? 1 : 0 }); }
    if (cd.ripple) { const f = ((t - cd.at) * 1.1) % 1; xf(cd.ripple, { s: 0.5 + f * 1.1, o: on ? 1 - f : 0 }); } });
  const hk = t - 29.9; xf(s.hub, { s: hk < 0 ? 0 : spr(hk, 11, 6.5), o: hk < 0 ? 0 : 1 });
  const pk = ((t - 30.1) * 0.9) % 1; xf(s.pulse, { s: 1 + pk * 1.1, o: hk < 0 ? 0 : (1 - pk) * 0.8 });
});

// ================= 7 Frage (31.5 – 33.9) =================
mk(B.s7, B.s8, 'radial-gradient(900px 1000px at 50% 55%, #4a1018 0%, #0B0D12 70%)', (cam) => {
  const q = h('div', { class: 'brush', style: { position: 'absolute', left: 0, top: '380px', width: '1080px', textAlign: 'center', fontSize: '1250px', lineHeight: 1, color: 'rgba(244,52,58,.10)' } }, '؟');
  const a = rline([{ w: 'ولسه', at: 31.6, cls: 'white' }, { w: 'مو', at: 32.0, cls: 'white' }, { w: 'مصدّق؟', at: 32.2, cls: 'hot' }], { size: 200, font: 'brush', width: 1040 }); abs(a, 20, 380);
  const b = rline([{ w: 'إنو', at: 32.62, cls: 'white' }, { w: 'الموضوع', at: 32.82, cls: 'white' }], { size: 170, font: 'brush', width: 1040 }); abs(b, 20, 800);
  const c = rline([{ w: 'بهالسهولة؟', at: 33.15, cls: 'gold' }], { size: 250, font: 'brush', width: 1040 }); abs(c, 20, 1080);
  cam.append(q, a, b, c); return { q, a, b, c };
}, (lt, s, cam, t) => { camPush(cam, lt, 2.4, 0.08); s.a.update(t); s.b.update(t); s.c.update(t); xf(s.q, { r: lerp(-8, 6, lt / 2.4), s: 1 + lt * 0.05, o: seg(t, B.s7 + 0.1, B.s7 + 0.5, E.lin) }); });

// ================= 8 Aufforderung: «جرّبه بنفسك، وخلّي شغلك أسرع وأريح» (33.9 – 37.05) =================
mk(B.s8, B.s9, CREAM, (cam) => {
  cam.append(dots(), glow('rgba(244,52,58,A)', 540, 300, 900, 600, 0.16));
  const a = rline([{ w: 'جرّبه', at: 34.05 }, { w: 'بنفسك', at: 34.5, cls: 'hot' }], { size: 200, color: '#0B1A33', width: 1040 }); abs(a, 20, 230);
  const b = rline([{ w: 'وخلّي', at: 35.18 }, { w: 'شغلك', at: 35.6 }], { size: 124, color: '#0B1A33', width: 1040 }); abs(b, 20, 640);
  const mkc = (ic, x, bg) => h('div', { style: { position: 'absolute', left: px(x), top: '860px', width: '400px', height: '400px', borderRadius: '110px', background: bg, boxShadow: '0 40px 80px rgba(11,26,51,.3)', display: 'grid', placeItems: 'center' } }, li(ic, 240, '#fff', 5));
  const c1 = mkc('clock', 600, RED), c2 = mkc('smile', 80, '#0B1A33');
  const l1 = rline([{ w: 'أسرع', at: 36.05, cls: 'hot' }], { size: 140, width: 400 }); abs(l1, 600, 1310);
  const l2 = rline([{ w: 'وأريح', at: 36.5, cls: 'navy' }], { size: 140, width: 400 }); abs(l2, 80, 1310);
  const hand = h('div', { style: { position: 'absolute', left: '330px', top: '840px', width: '420px', height: '420px', borderRadius: '50%', background: '#fff', boxShadow: '0 40px 80px rgba(11,26,51,.25)', display: 'grid', placeItems: 'center' } }, li('touch', 250, '#0B1A33', 5));
  const rips = [0, 1].map(() => h('div', { style: { position: 'absolute', left: '330px', top: '840px', width: '420px', height: '420px', borderRadius: '50%', border: `8px solid ${RED}` } }));
  cam.append(a, b, ...rips, hand, c1, c2, l1, l2); return { a, b, c1, c2, l1, l2, hand, rips };
}, (lt, s, cam, t) => {
  camPush(cam, lt, 3.15, 0.04); s.a.update(t); s.b.update(t); s.l1.update(t); s.l2.update(t);
  xf(s.c1, { s: spr(t - 36.05, 11, 6), o: t >= 36.05 ? 1 : 0 }); xf(s.c2, { s: spr(t - 36.5, 11, 6), o: t >= 36.5 ? 1 : 0 });
  const hk = t - 34.25, hout = seg(t, 35.9, 36.05, E.lin); xf(s.hand, { s: (hk < 0 ? 0 : spr(hk, 11, 6)) * (1 - 0.3 * hout), o: hk < 0 ? 0 : 1 - hout });
  s.rips.forEach((r, i) => { const f = ((t - 34.6 - i * 0.55) / 1.1) % 1; xf(r, { s: 1 + f * 0.6, o: t > 34.6 + i * 0.55 && t < 36.0 ? (1 - f) * 0.7 : 0 }); });
});

// ================= 9 Endkarte (37.05 – 42.6) =================
mk(B.s9, B.end + 0.5, `linear-gradient(180deg, #10264a 0%, ${NAVY} 60%, #3a0d14 100%)`, (cam) => {
  cam.append(glow('rgba(244,52,58,A)', 540, 1500, 1000, 700, 0.5));
  const app = img('../img/mark-dark.png', 400, { left: '340px', top: '110px', filter: 'drop-shadow(0 30px 50px rgba(0,0,0,.5)) drop-shadow(0 0 60px rgba(244,52,58,.45))' });
  const logo = img('../img/company-dark.png', 700, { left: '190px', top: '560px' });
  const w1 = rline([{ w: 'تواصل', at: 37.21, cls: 'gold' }, { w: 'مع', at: 37.65, cls: 'gold' }], { size: 124 }); abs(w1, 50, 880);
  const nm = rline([{ w: 'مجموعة', at: 37.8 }, { w: 'دماس', at: 38.3 }, { w: 'للحلول', at: 38.73 }, { w: 'التقنية', at: 39.11 }], { size: 92, color: '#fff', width: 960, font: 'ar' }); abs(nm, 60, 1040);
  const cta = h('div', { style: { position: 'absolute', left: '60px', top: '1380px', width: '960px', height: '170px', borderRadius: '85px', background: RED, boxShadow: '0 20px 0 #9a1219, 0 50px 90px rgba(244,52,58,.5)', display: 'grid', placeItems: 'center', overflow: 'hidden' } });
  const ctaText = rline([{ w: 'واطلب', at: 39.81 }, { w: 'نسختك', at: 40.18 }, { w: 'التجريبية', at: 40.62 }, { w: 'اليوم!', at: 41.25 }], { size: 58, color: '#fff', width: 900, font: 'ar', gap: 0.22 }); ctaText.style.position = 'relative'; cta.append(ctaText);
  const url = h('div', { class: 'lat', style: { position: 'absolute', left: '170px', top: '1640px', width: '740px', height: '120px', borderRadius: '60px', background: 'rgba(255,255,255,.1)', border: '3px solid rgba(255,255,255,.3)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '24px', fontSize: '48px', fontWeight: 700 } }, li('globe', 66, '#fff', 5), 'd-group-it-solutions.de');
  const cursor = h('svg', { viewBox: '0 0 24 24', width: 140, height: 140, style: { position: 'absolute', left: 0, top: 0, filter: 'drop-shadow(0 8px 6px rgba(0,0,0,.4))' } }); cursor.innerHTML = '<path d="M5 2 L5 19 L9.5 15 L12.5 22 L15.5 20.6 L12.6 13.8 L18.5 13.4 Z" fill="#fff" stroke="#111" stroke-width="1.3" stroke-linejoin="round"/>';
  const ring = h('div', { style: { position: 'absolute', left: '820px', top: '1475px', width: '120px', height: '120px', borderRadius: '50%', border: '8px solid rgba(255,255,255,.9)' } });
  cam.append(app, logo, w1, nm, cta, url, ring, cursor); return { app, logo, w1, nm, cta, ctaText, url, cursor, ring };
}, (lt, s, cam, t) => {
  camPush(cam, lt, 5.55, 0.03);
  const a = t - 37.15; xf(s.app, { s: a < 0 ? 0 : spr(a, 11, 6), y: Math.sin(t * 2.3) * 8, o: a < 0 ? 0 : 1 });
  const l = t - 37.3; xf(s.logo, { s: lerp(0.8, 1, E.out5(clamp(l / 0.5))), y: lerp(60, 0, E.out5(clamp(l / 0.5))), o: seg(t, 37.3, 37.55, E.lin) });
  s.w1.update(t); s.nm.update(t); s.ctaText.update(t);
  const c = t - 39.7; const press = t > 41.95 && t < 42.12; xf(s.cta, { s: (c < 0 ? 0 : spr(c, 11, 6)) * (press ? 0.97 : 1 + 0.012 * Math.sin(t * 7)), y: press ? 12 : 0, o: c < 0 ? 0 : 1 });
  xf(s.url, { s: t < 41.45 ? 0 : spr(t - 41.45, 11, 6), o: t > 41.45 ? 1 : 0 });
  const k = seg(t, 41.4, 41.95, E.inOut); xf(s.cursor, { x: lerp(1000, 851, k), y: lerp(1750, 1523, k) + (press ? 8 : 0), o: t > 41.4 ? 1 : 0 });
  const rk = clamp((t - 41.95) / 0.5); xf(s.ring, { s: 0.4 + rk * 1.8, o: t > 41.95 && rk < 1 ? 1 - rk : 0 });
});

// ================= Übergänge =================
const WIPES = [
  { k: 'circle', c: NAVY, a: 2.5, b: B.s2, f: 0.1 }, { k: 'panel', a: 5.78, b: B.s3, x: 0.3 }, { k: 'circle', c: NAVY, a: 10.5, b: B.s4, f: 0.1 }, { k: 'circle', c: NAVY, a: 15.88, b: B.s5, f: 0.1 },
  { k: 'circle', c: NAVY, a: 24.84, b: B.s6b, f: 0.08 }, { k: 'circle', c: CREAM, a: 33.72, b: B.s8, f: 0.08 }, { k: 'circle', c: NAVY, a: 36.96, b: B.s9, f: 0.07 },
];
const wipeEls = WIPES.map((w) => {
  const el = w.k === 'circle'
    ? h('div', { style: { position: 'absolute', left: '-1260px', top: '-840px', width: '3600px', height: '3600px', borderRadius: '50%', background: w.c, display: 'none' } })
    : h('div', { style: { position: 'absolute', left: 0, top: 0, width: '1080px', height: '2100px', background: `linear-gradient(180deg, #ff6a60, ${RED})`, display: 'none', borderTop: '10px solid #fff' } });
  stage.append(el); return el;
});
const flash = h('div', { style: { position: 'absolute', inset: 0, background: '#fff', opacity: 0 } });
const vig = h('div', { style: { position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center, rgba(0,0,0,0) 58%, rgba(0,0,0,.3) 100%)' } });
stage.append(flash, vig);
const FLASHES = [[0.03, 0.12, 0.7], [2.3, 0.15, 0.35], [B.s4b, 0.14, 0.6], [20.5, 0.2, 0.6], [B.s7, 0.12, 0.5], [41.95, 0.1, 0.25]];

window.DURATION = B.end;
window.SFX = [
  [0.03, 'boom'], [0.31, 'pop'], [0.5, 'tick'], [1.0, 'tick'], [1.5, 'tick'], [2.0, 'tick'], [1.19, 'pop'], [1.82, 'pop'], [2.3, 'ding'], [2.5, 'whoosh'],
  [2.93, 'pop'], [3.72, 'pop'], [3.78, 'whoosh'], [4.3, 'pop'], [4.6, 'whoosh'], [5.33, 'pop'], [5.3, 'whoosh'], [5.8, 'whoosh'],
  [6.4, 'thud'], [7.12, 'pop'], [7.45, 'click'], [7.9, 'thud'], [9.0, 'click'], [9.5, 'thud'], [10.1, 'pop'], [10.25, 'pop'], [10.35, 'click'], [10.5, 'whoosh'], [10.2, 'riser'],
  [10.93, 'pop'], [11.57, 'pop'], [12.0, 'thud'], [12.15, 'pop'], [12.62, 'pop'], [13.0, 'pop'], [13.6, 'ding'], [14.0, 'whoosh'],
  [14.26, 'pop'], [14.5, 'pop'], [15.06, 'boom'], [15.55, 'pop'], [15.9, 'whoosh'],
  [16.22, 'pop'], [16.75, 'click'], [17.38, 'pop'], [17.8, 'beep'], [18.15, 'click'], [18.71, 'pop'], [19.2, 'click'], [19.45, 'kaching'], [19.65, 'ding'], [19.75, 'print'], [20.5, 'boom'], [21.07, 'pop'], [21.3, 'whoosh'],
  [21.75, 'pop'], [22.83, 'pop'], [23.88, 'pop'], [24.85, 'whoosh'],
  [25.08, 'pop'], [26.08, 'pop'], [27.1, 'pop'], [28.63, 'pop'], [29.9, 'ding'], [31.3, 'whoosh'],
  [31.6, 'boom'], [32.0, 'pop'], [32.62, 'pop'], [33.15, 'pop'], [33.7, 'whoosh'],
  [34.05, 'pop'], [34.5, 'pop'], [35.18, 'pop'], [36.05, 'pop'], [36.5, 'pop'], [36.95, 'whoosh'],
  [37.15, 'pop'], [37.3, 'pop'], [39.7, 'pop'], [41.45, 'pop'], [41.95, 'click'],
];

window.render = (t) => {
  scenes.forEach((sc) => {
    const on = t >= sc.from && t < sc.to; sc.root.style.display = on ? 'block' : 'none'; if (!on) return;
    sc.update(t - sc.from, sc.st, sc.cam, t);
  });
  // Szene 6 schiebt sich über Szene 5; Szene 6b verlässt per Zoom
  const s6 = scenes[6].root, s6b = scenes[7].root;
  const sx = seg(t, B.s6, B.s6 + 0.3, E.out5); s6.style.transform = t < B.s6 + 0.3 ? `translateX(${(1 - sx) * 420}px)` : 'none';
  const z = seg(t, B.s7 - 0.2, B.s7, E.in); s6b.style.transform = z > 0 ? `scale(${1 + z * 0.6})` : 'none'; s6b.style.opacity = String(1 - z);
  WIPES.forEach((w, i) => {
    const el = wipeEls[i];
    if (w.k === 'circle') {
      const c = seg(t, w.a, w.b, E.inOut); const on = t >= w.a && t < w.b + w.f;
      el.style.display = on ? 'block' : 'none'; xf(el, { s: Math.max(c, 0.001), o: t < w.b ? 1 : 1 - seg(t, w.b, w.b + w.f, E.lin) });
    } else {
      const up = seg(t, w.a, w.b, E.inOut), out = seg(t, w.b, w.b + w.x, E.inOut);
      el.style.display = t >= w.a && t < w.b + w.x + 0.04 ? 'block' : 'none'; el.style.transform = `translateY(${t < w.b ? lerp(2000, 0, up) : lerp(0, -2150, out)}px)`;
    }
  });
  let f = 0; for (const [t0, d, p] of FLASHES) if (t >= t0 && t < t0 + d) f = Math.max(f, p * (1 - (t - t0) / d)); flash.style.opacity = String(f);
  window.ready = true;
};
await Promise.all(IMGS.map((i) => i.decode().catch(() => {})));
window.ready = true; window.render(0);
