// Video B2 – «٣ ثواني» (professionelle Fassung, abgestimmt auf die ElevenLabs-Sprachspur, 29 s)
import { h, clamp, lerp, E, px, xf, place } from './lib.js';
import { makePOS, icon } from './parts.js';
import { spr, seg, rnd, rline, li, makeBurst } from './pro.js';

const NAVY = '#0A1428', RED = '#F4343A', CREAM = '#F6F0E4', GREEN = '#2FD08A', GOLD = '#FFC83D';
const stage = document.getElementById('stage');
const scenes = [];
const mk = (from, to, bg, build, update) => { const root = h('div', { class: 'shot', style: { background: bg } }); const cam = h('div', { class: 'layer', style: { pointerEvents: 'none' } }); root.append(cam); const st = build(cam, root) || {}; stage.append(root); scenes.push({ from, to, root, cam, st, update }); return scenes[scenes.length - 1]; };
const abs = (el, x, y, extra = {}) => place(el, x, y, extra);
const img = (src, w, extra = {}) => h('img', { src, style: { position: 'absolute', width: px(w), ...extra } });
const camPush = (cam, lt, len, amount = 0.06, fx = 540, fy = 960) => { cam.style.transformOrigin = `${fx}px ${fy}px`; cam.style.transform = `scale(${1 + amount * clamp(lt / len)})`; };
const glow = (c, x, y, w, h_, a = 0.4) => h('div', { class: 'layer', style: { background: `radial-gradient(${w}px ${h_}px at ${x}px ${y}px, ${c.replace('A', a)}, transparent)` } });

// ================= 1 Hook (0 – 3.8) =================
mk(0, 3.8, `linear-gradient(180deg, #FF6A60 0%, ${RED} 45%, #C21F28 100%)`, (cam) => {
  const rings = [0, 1, 2, 3].map(() => { const r = h('div', { style: { position: 'absolute', left: '210px', top: '370px', width: '660px', height: '660px', borderRadius: '50%', border: '4px solid rgba(255,255,255,.4)' } }); cam.append(r); return r; });
  const shock = h('div', { style: { position: 'absolute', left: '210px', top: '370px', width: '660px', height: '660px', borderRadius: '50%', border: '14px solid #fff' } }); cam.append(shock);
  const svg = h('svg', { viewBox: '0 0 1000 1000', width: 840, height: 840, style: { position: 'absolute', left: '120px', top: '280px' } });
  svg.innerHTML = `<circle cx="500" cy="500" r="430" fill="none" stroke="rgba(255,255,255,.28)" stroke-width="18"/><circle id="arc" cx="500" cy="500" r="430" fill="none" stroke="#fff" stroke-width="18" stroke-linecap="round" stroke-dasharray="2701.8" stroke-dashoffset="2701.8" transform="rotate(-90 500 500)"/>${[...Array(60)].map((_, i) => `<line x1="500" y1="${i % 5 ? 52 : 40}" x2="500" y2="${i % 5 ? 62 : 70}" stroke="rgba(255,255,255,.55)" stroke-width="${i % 5 ? 3 : 6}" transform="rotate(${i * 6} 500 500)"/>`).join('')}`;
  const num = h('div', { class: 'lz', style: { position: 'absolute', left: 0, top: '382px', width: '1080px', textAlign: 'center', fontSize: '660px', lineHeight: 1, color: '#fff', textShadow: '0 40px 70px rgba(120,0,10,.45)' } }, '٣');
  const sec = rline([{ w: 'ثواني!', at: 0.3, cls: 'cream' }], { size: 200 }); abs(sec, 50, 1060);
  const l2 = rline([{ w: 'هي', at: 1.11 }, { w: 'كل', at: 1.4 }, { w: 'اللي', at: 1.65 }, { w: 'عندك', at: 1.9 }], { size: 104, color: '#fff', width: 1000 }); abs(l2, 40, 1310);
  const l3 = rline([{ w: 'قبل', at: 2.33 }, { w: 'ما', at: 2.62 }, { w: 'الزبون', at: 2.8 }, { w: 'يطلع!', at: 3.12, cls: 'pill' }], { size: 100, color: '#fff', width: 1060, gap: 0.2 }); abs(l3, 10, 1445);
  const people = [0, 1, 2, 3, 4].map((i) => { const s = h('svg', { viewBox: '0 0 100 160', width: 124, height: 198, style: { position: 'absolute', left: 0, top: 0 } }); s.innerHTML = `<circle cx="50" cy="32" r="26" fill="${i % 2 ? '#0B1A33' : '#FFF1DD'}"/><path d="M12 158 C12 96 30 70 50 70 C70 70 88 96 88 158 Z" fill="${i % 2 ? '#0B1A33' : '#FFF1DD'}"/>`; cam.append(s); return s; });
  cam.prepend(h('div', { class: 'layer', style: { background: 'radial-gradient(900px 700px at 50% 42%, rgba(255,255,255,.22), transparent 70%)' } }));
  cam.append(svg, num, sec, l2, l3);
  return { rings, shock, svg, num, sec, l2, l3, people };
}, (lt, s, cam) => {
  camPush(cam, lt, 3.8, 0.07, 540, 800);
  const k = clamp(lt / 0.45); xf(s.num, { s: lerp(1.7, 1, E.out5(k)) * (1 + 0.02 * Math.sin(lt * 9) * (1 - k)), o: clamp(lt * 20) });
  const sk = clamp(lt / 0.8); xf(s.shock, { s: lerp(0.4, 2.6, E.out(sk)), o: 1 - sk });
  s.rings.forEach((r, i) => { const f = (lt * 0.55 + i / 4) % 1; xf(r, { s: 0.45 + f * 2.2, o: (1 - f) * 0.3 }); });
  s.svg.querySelector('#arc').setAttribute('stroke-dashoffset', String(2701.8 * (1 - seg(lt, 0, 3.4, E.lin))));
  s.sec.update(lt); s.l2.update(lt); s.l3.update(lt);
  s.people.forEach((p, i) => { const leave = i === 0 ? seg(lt, 3.05, 3.7, E.in) : 0; xf(p, { x: 70 + i * 150 - leave * 800, y: 1640 + Math.sin(lt * 5 + i * 1.7) * 5, o: seg(lt, 0.3 + i * 0.1, 0.4, E.out) * (1 - leave * 0.8) }); });
});

// ================= 2 Alte Methode (3.75 – 7.95) =================
mk(3.75, 7.95, CREAM, (cam) => {
  cam.append(h('div', { class: 'layer', style: { backgroundImage: 'radial-gradient(circle, rgba(11,26,51,.09) 3px, transparent 4px)', backgroundSize: '54px 54px' } }), glow('rgba(244,52,58,A)', 900, 200, 700, 500, 0.15), glow('rgba(255,170,120,A)', 100, 1500, 800, 600, 0.25));
  const chip = h('div', { class: 'ar', style: { position: 'absolute', left: '340px', top: '150px', width: '400px', padding: '16px 0', textAlign: 'center', borderRadius: '60px', background: '#0B1A33', color: '#fff', fontSize: '50px', boxShadow: '0 20px 40px rgba(11,26,51,.3)' } }, 'الطريقة القديمة');
  const t1 = rline([{ w: 'بالطريقة', at: 3.9 }, { w: 'القديمة؟', at: 4.2 }], { size: 168, color: '#0B1A33' }); abs(t1, 50, 270);
  const strike = h('div', { style: { position: 'absolute', left: '276px', top: '556px', width: '530px', height: '16px', borderRadius: '8px', background: RED, transformOrigin: '100% 50%', boxShadow: '0 6px 14px rgba(244,52,58,.4)' } });
  const n1 = h('div', { style: { position: 'absolute', left: '600px', top: '640px', width: '400px', height: '400px' } }, icon('notebook', 400));
  const n2 = h('div', { style: { position: 'absolute', left: '90px', top: '650px', width: '380px', height: '380px' } }, icon('calc', 380));
  const lb1 = rline([{ w: 'ورقة', at: 5.1 }], { size: 100, color: '#0B1A33', width: 400 }); abs(lb1, 600, 1080);
  const lb2 = rline([{ w: 'آلة', at: 5.72 }, { w: 'حاسبة', at: 5.95 }], { size: 100, color: '#0B1A33', width: 400 }); abs(lb2, 90, 1080);
  const coin = h('div', { style: { position: 'absolute', left: 0, top: 0, width: '170px', height: '170px' } }, icon('coin', 170)); 
  const coin2 = h('div', { style: { position: 'absolute', left: 0, top: 0, width: '110px', height: '110px' } }, icon('coin', 110));
  const lb3 = rline([{ w: 'وفكّة', at: 6.6, cls: 'hot' }, { w: 'ضايعة!', at: 7.0, cls: 'hot' }], { size: 150, width: 980 }); abs(lb3, 50, 1330);
  const timer = h('div', { class: 'mono', style: { position: 'absolute', left: '300px', top: '1560px', width: '480px', padding: '14px 0', textAlign: 'center', borderRadius: '30px', background: '#fff', color: RED, fontSize: '120px', fontWeight: 700, boxShadow: '0 24px 50px rgba(11,26,51,.22)' } }, '00:00');
  cam.append(chip, t1, strike, n1, n2, lb1, lb2, coin, coin2, lb3, timer);
  return { chip, t1, strike, n1, n2, lb1, lb2, coin, coin2, lb3, timer };
}, (lt, s, cam, t) => {
  camPush(cam, lt, 4.2, 0.04);
  xf(s.chip, { y: lerp(-160, 0, seg(t, 3.75, 4.2, E.out5)), o: 1 });
  s.t1.update(t); xf(s.strike, { sx: seg(t, 4.75, 5.05, E.out5), sy: 1, o: t > 4.7 ? 1 : 0 });
  const drop = (el, at, x, y, r0) => { const k = t - at; const yy = k < 0 ? -700 : lerp(-700, 0, E.out5(clamp(k / 0.55))) + (k > 0.55 ? Math.sin((k - 0.55) * 14) * 8 * Math.exp(-(k - 0.55) * 6) : 0); xf(el, { x: 0, y: yy, r: lerp(r0 * 3, r0, E.out5(clamp(k / 0.6))), o: k < 0 ? 0 : 1 }); };
  drop(s.n1, 5.07, 0, 0, -8); drop(s.n2, 5.7, 0, 0, 7);
  s.lb1.update(t); s.lb2.update(t);
  const ck = clamp((t - 6.55) / 1.3); xf(s.coin, { x: lerp(1250, -260, E.inOut(ck)), y: 1180 + Math.abs(Math.sin(ck * 16)) * -90, r: -ck * 1500, o: t >= 6.55 ? 1 : 0 });
  const c2 = clamp((t - 6.9) / 1.2); xf(s.coin2, { x: lerp(1250, -180, E.inOut(c2)), y: 1260 + Math.abs(Math.sin(c2 * 13)) * -60, r: -c2 * 1100, o: t >= 6.9 ? 1 : 0 });
  s.lb3.update(t);
  const sec = Math.min(47, 47 * E.in(clamp((t - 3.9) / 3.7)) * 0.55 + 47 * clamp((t - 3.9) / 3.7) * 0.45); s.timer.textContent = `00:${String(Math.floor(sec)).padStart(2, '0')}`;
  xf(s.timer, { s: seg(t, 3.95, 4.4, (x) => spr(x * 0.5, 12, 7)), o: t > 3.9 ? 1 : 0 }); s.timer.style.color = Math.floor(t * 6) % 2 && sec > 30 ? '#8f1218' : RED;
});

// ================= 3 Marke (7.84 – 10.7) =================
mk(7.84, 10.7, `linear-gradient(180deg, #0F2548 0%, ${NAVY} 70%)`, (cam) => {
  cam.append(glow('rgba(244,52,58,A)', 540, 1900, 1000, 800, 0.45), h('div', { class: 'layer', style: { backgroundImage: 'linear-gradient(rgba(255,255,255,.05) 2px, transparent 2px), linear-gradient(90deg, rgba(255,255,255,.05) 2px, transparent 2px)', backgroundSize: '90px 90px', maskImage: 'linear-gradient(transparent, #000 60%, transparent)', WebkitMaskImage: 'linear-gradient(transparent, #000 60%, transparent)' } }));
  const w1 = rline([{ w: 'وبكاشير', at: 7.86 }], { size: 170, color: '#fff' }); abs(w1, 50, 250);
  const card = h('div', { style: { position: 'absolute', left: '130px', top: '500px', width: '820px', height: '340px', borderRadius: '60px', background: '#fff', boxShadow: '0 50px 100px rgba(0,0,0,.45)', overflow: 'hidden' } }, h('div', { style: { position: 'absolute', left: '30px', top: '36px', width: '760px', height: '270px', overflow: 'hidden' } }, img('../img/logo-company.png', 760, { left: 0, top: '-222px', height: '760px' })));
  const nm = rline([{ w: 'مجموعة', at: 8.55 }, { w: 'دماس', at: 8.85 }, { w: 'للحلول', at: 9.4 }, { w: 'التقنية؟', at: 9.78, cls: 'gold' }], { size: 104, color: '#fff', width: 900 }); abs(nm, 90, 930);
  const bar = h('div', { style: { position: 'absolute', left: '440px', top: '1190px', width: '200px', height: '10px', borderRadius: '5px', background: RED, transformOrigin: '50% 50%' } });
  const app = img('../img/logo-app.png', 360, { left: '360px', top: '1290px', borderRadius: '82px', boxShadow: '0 40px 90px rgba(0,0,0,.5), 0 0 160px rgba(244,52,58,.55)' });
  cam.append(w1, card, nm, bar, app);
  return { w1, card, nm, bar, app };
}, (lt, s, cam, t) => {
  camPush(cam, lt, 2.9, 0.05); s.w1.update(t); s.nm.update(t);
  const k = t - 8.5; xf(s.card, { y: lerp(900, 0, E.out5(clamp(k / 0.6))) + Math.sin(t * 2) * 6, s: 1 + 0.06 * Math.exp(-Math.max(k, 0) * 5) * Math.sin(Math.max(k, 0) * 14), o: k < 0 ? 0 : 1 });
  xf(s.bar, { sx: seg(t, 9.2, 9.7, E.out5), o: t > 9.2 ? 1 : 0 });
  const a = t - 9.4; xf(s.app, { s: a < 0 ? 0 : spr(a, 11, 6), r: lerp(-14, 0, E.out5(clamp(a / 0.5))) + Math.sin(t * 2.2) * 2, y: Math.sin(t * 2.5) * 8, o: a < 0 ? 0 : 1 });
});

// ================= 4 Kasse in 3 Sekunden (10.42 – 15.0) =================
const CFG = { taps: [{ t: 0.22, idx: 1 }, { t: 0.93, idx: 4 }], payAt: 1.67, paidAt: 1.93, printAt: 2.38 };
mk(10.42, 15.0, `radial-gradient(900px 1100px at 50% 45%, #1d3a6b 0%, ${NAVY} 72%)`, (cam) => {
  cam.append(h('div', { style: { position: 'absolute', left: '140px', top: '1380px', width: '800px', height: '120px', borderRadius: '50%', background: 'radial-gradient(closest-side, rgba(0,0,0,.55), transparent)' } }));
  const persp = h('div', { style: { position: 'absolute', left: 0, top: '420px', width: '1080px', height: '960px', perspective: '2600px', perspectiveOrigin: '50% 35%' } });
  const wrap = h('div', { style: { position: 'absolute', left: '80px', top: '0', width: '920px', height: '860px', transformOrigin: '50% 60%' } });
  const pos = makePOS(); wrap.append(pos); persp.append(wrap);
  const glare = h('div', { style: { position: 'absolute', left: '30px', top: '28px', width: '860px', height: '548px', borderRadius: '22px', background: 'linear-gradient(115deg, rgba(255,255,255,.18) 0%, rgba(255,255,255,0) 38%)', pointerEvents: 'none' } }); wrap.append(glare);
  const timer = h('div', { style: { position: 'absolute', left: '250px', top: '120px', width: '580px', height: '170px', borderRadius: '85px', background: 'rgba(255,255,255,.1)', border: '3px solid rgba(255,255,255,.22)', display: 'flex', alignItems: 'center', gap: '30px', justifyContent: 'center', direction: 'ltr' } });
  const dot = h('div', { style: { width: '34px', height: '34px', borderRadius: '50%', background: RED } }); const tx = h('div', { class: 'mono', style: { color: '#fff', fontSize: '110px', fontWeight: 700, letterSpacing: '-.02em' } }, '00:00.0');
  timer.append(dot, tx); timer.style.left = '250px';
  const c1 = rline([{ w: 'ضغطة…', at: 10.64 }, { w: 'ضغطة…', at: 11.35 }, { w: 'دفع!', at: 12.09, cls: 'gold' }], { size: 122, color: '#fff', width: 1040, gap: 0.2 }); abs(c1, 20, 1600);
  const c2 = rline([{ w: 'والفاتورة', at: 12.82 }, { w: 'طلعت', at: 13.35, cls: 'gold' }], { size: 150, color: '#fff', width: 980 }); abs(c2, 50, 1570);
  const c3 = rline([{ w: '٣', at: 14.15, cls: 'green' }, { w: 'ثواني!', at: 14.3, cls: 'green' }], { size: 230, width: 980, font: 'lz' }); abs(c3, 50, 1530); c3.style.color = GREEN; c3.style.textShadow = '0 0 60px rgba(47,208,138,.6)';
  const burst = makeBurst(cam, { x: 540, y: 900, n: 44, seed: 3 });
  cam.append(persp, timer, c1, c2, c3);
  return { persp, wrap, pos, timer, dot, tx, c1, c2, c3, burst };
}, (lt, s, cam, t) => {
  const e = clamp(lt / 0.3); xf(cam, { s: lerp(0.86, 1, E.out5(e)), o: e });
  cam.style.transformOrigin = '540px 960px';
  const ry = lerp(-18, -4, seg(lt, 0, 3.2, E.out)), rx = lerp(10, 6, seg(lt, 0, 3.2, E.out));
  s.wrap.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg) scale(0.98) translateY(${Math.sin(lt * 1.6) * 8}px)`;
  s.pos.update(lt, CFG);
  const el = clamp(t - 10.64, 0, 3.0); const run = t >= 10.64 && t < 13.64; s.tx.textContent = `00:0${Math.floor(el)}.${Math.floor((el % 1) * 10)}`;
  s.tx.style.color = t >= 13.64 ? GREEN : '#fff'; s.dot.style.background = t >= 13.64 ? GREEN : RED; s.dot.style.opacity = run ? (Math.floor(t * 4) % 2 ? 1 : 0.35) : 1;
  s.timer.style.borderColor = t >= 13.64 ? GREEN : 'rgba(255,255,255,.22)';
  xf(s.timer, { s: seg(t, 10.45, 10.85, (x) => spr(x * 0.5, 12, 7)), o: 1 });
  s.c1.update(t); s.c2.update(t); s.c3.update(t);
  s.c1.style.opacity = String(1 - seg(t, 12.62, 12.8, E.lin)); s.c2.style.opacity = String(t < 12.8 ? 0 : 1 - seg(t, 14.0, 14.12, E.lin));
  s.burst(t - 14.15);
});

// ================= 5 Schnell, klar, alles am Platz (14.95 – 17.95) =================
mk(14.95, 17.95, CREAM, (cam) => {
  cam.append(h('div', { class: 'layer', style: { backgroundImage: 'radial-gradient(circle, rgba(11,26,51,.09) 3px, transparent 4px)', backgroundSize: '54px 54px' } }), glow('rgba(244,52,58,A)', 100, 300, 800, 700, 0.18));
  const rows = [['bolt', [{ w: 'سريع', at: 15.2 }], 15.2, 150], ['eye', [{ w: 'واضح', at: 15.92 }], 15.92, 150], ['grid', [{ w: 'وكل', at: 16.5 }, { w: 'شي', at: 16.8 }, { w: 'بمكانو', at: 17.0, cls: 'hot' }], 16.5, 104]].map(([ic, spec, at, size], i) => {
    const y = 280 + i * 540;
    const box = h('div', { style: { position: 'absolute', left: '730px', top: px(y), width: '290px', height: '290px', borderRadius: '70px', background: RED, boxShadow: '0 36px 70px rgba(244,52,58,.38)', display: 'grid', placeItems: 'center' } }, li(ic, 170, '#fff', 6));
    const line = rline(spec, { size, color: '#0B1A33', width: 640, align: 'flex-start' }); abs(line, 60, y + (size > 140 ? 50 : 90));
    const rule = h('div', { style: { position: 'absolute', left: '90px', top: px(y + 340), width: '640px', height: '8px', borderRadius: '4px', background: 'rgba(11,26,51,.12)' } }); const fill = h('div', { style: { width: '100%', height: '100%', borderRadius: '4px', background: RED, transformOrigin: '100% 50%' } }); rule.append(fill);
    cam.append(box, line, rule); return { box, line, fill, at, ic };
  });
  const sq = [0, 1, 2, 3].map((i) => { const q = h('div', { style: { position: 'absolute', left: 0, top: 0, width: '60px', height: '60px', borderRadius: '14px', background: '#fff' } }); cam.append(q); return q; });
  return { rows, sq };
}, (lt, s, cam, t) => {
  camPush(cam, lt, 3, 0.04);
  s.rows.forEach((r, i) => { const k = t - r.at; xf(r.box, { s: k < 0 ? 0 : spr(k, 12, 6), r: lerp(-12, 0, E.out5(clamp(k / 0.5))), o: k < 0 ? 0 : 1 }); r.line.update(t); xf(r.fill, { sx: seg(t, r.at + 0.1, r.at + 0.6, E.out5), sy: 1, o: t > r.at ? 1 : 0 }); });
  // Quadrate rasten ein (Zeile 3)
  const base = [[777, 1410], [877, 1410], [777, 1510], [877, 1510]]; const gk = seg(t, 16.55, 17.1, E.out5);
  s.sq.forEach((q, i) => { const a = rnd(11 + i) * 6.28; const ox = Math.cos(a) * 420, oy = Math.sin(a) * 420; xf(q, { x: lerp(base[i][0] + ox, base[i][0], gk), y: lerp(base[i][1] + oy, base[i][1], gk), s: 1, r: lerp(90, 0, gk), o: t > 16.5 && t < 17.1 ? 1 - gk * 0.9 : 0 }); });
});

// ================= 6 Funktionen (17.85 – 22.4) =================
const CARDS = [['shield', 'TSE', 'مضمّنة', 17.83, 'right'], ['touch', 'شاشة', 'لمس', 18.97, 'left'], ['scan', 'سكانر', 'باركود', 19.88, 'right'], ['pda', 'PDA', 'للجرد', 20.97, 'left']];
mk(17.85, 22.4, `linear-gradient(180deg, #11284d 0%, ${NAVY} 80%)`, (cam) => {
  cam.append(glow('rgba(244,52,58,A)', 540, 1950, 1100, 800, 0.4), h('div', { class: 'layer', style: { backgroundImage: 'linear-gradient(rgba(255,255,255,.04) 2px, transparent 2px), linear-gradient(90deg, rgba(255,255,255,.04) 2px, transparent 2px)', backgroundSize: '90px 90px' } }));
  const cards = CARDS.map(([ic, t1, t2, at, side], i) => {
    const x = i % 2 === 0 ? 545 : 60, y = 300 + Math.floor(i / 2) * 690;
    const c = h('div', { style: { position: 'absolute', left: px(x), top: px(y), width: '475px', height: '640px', borderRadius: '64px', background: 'rgba(255,255,255,.07)', border: '3px solid rgba(255,255,255,.18)', boxShadow: '0 50px 90px rgba(0,0,0,.35)', textAlign: 'center' } });
    const iconBox = h('div', { style: { position: 'absolute', left: '112px', top: '70px', width: '250px', height: '250px', display: 'grid', placeItems: 'center' } }, li(ic, 220, '#fff', 5)); c.append(iconBox);
    const w1 = h('div', { class: ic === 'shield' || ic === 'pda' ? 'lat' : 'lz', style: { position: 'absolute', left: 0, top: '370px', width: '100%', fontSize: '120px', fontWeight: 700, color: '#fff', lineHeight: 1.1 } }, t1);
    const w2 = h('div', { class: 'ar', style: { position: 'absolute', left: 0, top: '520px', width: '100%', fontSize: '66px', color: '#FFC83D' } }, t2);
    const scanLine = ic === 'scan' ? h('div', { style: { position: 'absolute', left: '95px', top: '130px', width: '290px', height: '8px', borderRadius: '4px', background: RED, boxShadow: '0 0 30px 6px rgba(244,52,58,.8)' } }) : null;
    const ripple = ic === 'touch' ? h('div', { style: { position: 'absolute', left: '137px', top: '95px', width: '200px', height: '200px', borderRadius: '50%', border: '6px solid rgba(255,200,61,.8)' } }) : null;
    c.append(w1, w2); if (scanLine) c.append(scanLine); if (ripple) c.append(ripple); cam.append(c); return { c, at, scanLine, ripple };
  });
  return { cards };
}, (lt, s, cam, t) => {
  camPush(cam, lt, 4.5, 0.04, 540, 1000);
  s.cards.forEach((cd, i) => { const k = t - cd.at; const on = k >= 0; xf(cd.c, { s: on ? spr(k, 12, 6.5) : 0, y: on ? 0 : 60, o: on ? 1 : 0 }); const act = on && k < 0.9 ? 1 - k / 0.9 : 0; cd.c.style.borderColor = `rgba(244,52,58,${0.25 + act * 0.75})`; cd.c.style.background = `rgba(255,255,255,${0.07 + act * 0.1})`;
    if (cd.scanLine) { const f = ((t - cd.at) * 1.6) % 1; xf(cd.scanLine, { y: 40 + (f < 0.5 ? f * 2 : 2 - f * 2) * 230, o: on ? 1 : 0 }); }
    if (cd.ripple) { const f = ((t - cd.at) * 1.1) % 1; xf(cd.ripple, { s: 0.5 + f * 1.1, o: on ? 1 - f : 0 }); } });
});

// ================= 7 Jetzt du (22.3 – 23.5) =================
mk(22.3, 23.5, 'radial-gradient(900px 1000px at 50% 55%, #4a1018 0%, #0B0D12 70%)', (cam) => {
  const a = rline([{ w: 'جرّب', at: 22.35, cls: 'white' }], { size: 330, font: 'brush', width: 1000 }); abs(a, 40, 480);
  const b = rline([{ w: 'بنفسك؟', at: 22.72, cls: 'hot' }], { size: 330, font: 'brush', width: 1000 }); abs(b, 40, 820);
  cam.append(a, b); return { a, b };
}, (lt, s, cam, t) => { camPush(cam, lt, 1.2, 0.1); s.a.update(t); s.b.update(t); });

// ================= 8 Zeit sparen (23.45 – 25.55) =================
mk(23.45, 25.55, CREAM, (cam) => {
  cam.append(h('div', { class: 'layer', style: { backgroundImage: 'radial-gradient(circle, rgba(11,26,51,.09) 3px, transparent 4px)', backgroundSize: '54px 54px' } }), glow('rgba(244,52,58,A)', 540, 300, 900, 600, 0.16));
  const mkc = (ic, x) => h('div', { style: { position: 'absolute', left: px(x), top: '500px', width: '400px', height: '400px', borderRadius: '110px', background: ic === 'clock' ? RED : '#0B1A33', boxShadow: '0 40px 80px rgba(11,26,51,.3)', display: 'grid', placeItems: 'center' } }, li(ic, 240, '#fff', 5));
  const c1 = mkc('clock', 600), c2 = mkc('user', 80);
  const hand = h('div', { style: { position: 'absolute', left: '796px', top: '620px', width: '8px', height: '90px', borderRadius: '4px', background: '#fff', transformOrigin: '50% 100%' } }); 
  const tick = h('div', { style: { position: 'absolute', left: '440px', top: '820px', width: '140px', height: '140px' } }, li('check', 140, GREEN, 12));
  const w1 = rline([{ w: 'وفّر', at: 23.5 }, { w: 'وقتك', at: 23.85, cls: 'hot' }], { size: 160, color: '#0B1A33' }); abs(w1, 50, 1040);
  const w2 = rline([{ w: 'ووقت', at: 24.4 }, { w: 'زبونك', at: 24.75, cls: 'hot' }], { size: 160, color: '#0B1A33' }); abs(w2, 50, 1250);
  cam.append(c1, c2, tick, w1, w2); return { c1, c2, tick, w1, w2 };
}, (lt, s, cam, t) => {
  camPush(cam, lt, 2.1, 0.04); s.w1.update(t); s.w2.update(t);
  xf(s.c1, { s: spr(t - 23.5, 11, 6), o: t >= 23.5 ? 1 : 0 }); xf(s.c2, { s: spr(t - 24.4, 11, 6), o: t >= 24.4 ? 1 : 0 });
  xf(s.tick, { s: spr(t - 25.0, 12, 6), o: t >= 25.0 ? 1 : 0 });
});

// ================= 9 Aufruf (25.45 – 29.0) =================
mk(25.45, 29.0, `linear-gradient(180deg, #10264a 0%, ${NAVY} 60%, #3a0d14 100%)`, (cam) => {
  cam.append(glow('rgba(244,52,58,A)', 540, 1500, 1000, 700, 0.5));
  const app = img('../img/logo-app.png', 340, { left: '370px', top: '170px', borderRadius: '78px', boxShadow: '0 40px 90px rgba(0,0,0,.5), 0 0 140px rgba(244,52,58,.5)' });
  const card = h('div', { style: { position: 'absolute', left: '210px', top: '560px', width: '660px', height: '230px', borderRadius: '50px', background: '#fff', overflow: 'hidden', boxShadow: '0 40px 80px rgba(0,0,0,.4)' } }, img('../img/logo-company.png', 640, { left: '10px', top: '-188px', height: '640px' }));
  const nm = h('div', { class: 'ar', style: { position: 'absolute', left: 0, top: '830px', width: '1080px', textAlign: 'center', fontSize: '58px', color: '#fff' } }, 'مجموعة دماس للحلول التقنية');
  const w1 = rline([{ w: 'تواصل', at: 25.54, cls: 'gold' }, { w: 'معنا', at: 25.85, cls: 'gold' }], { size: 150 }); abs(w1, 50, 960);
  const url = h('div', { class: 'lat', style: { position: 'absolute', left: '170px', top: '1190px', width: '740px', height: '130px', borderRadius: '65px', background: 'rgba(255,255,255,.1)', border: '3px solid rgba(255,255,255,.3)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '24px', fontSize: '50px', fontWeight: 700 } }, li('globe', 70, '#fff', 5), 'd-group-it-solutions.de');
  const cta = h('div', { style: { position: 'absolute', left: '120px', top: '1380px', width: '840px', height: '170px', borderRadius: '85px', background: RED, color: '#fff', display: 'grid', placeItems: 'center', fontSize: '76px', fontWeight: 900, fontFamily: 'Cairo', boxShadow: '0 20px 0 #9a1219, 0 50px 90px rgba(244,52,58,.5)' } }, 'جرّب النسخة التجريبية');
  const foot = h('div', { class: 'lat', style: { position: 'absolute', left: 0, top: '1660px', width: '1080px', textAlign: 'center', fontSize: '42px', fontWeight: 600, color: 'rgba(255,255,255,.65)', letterSpacing: '.05em' } }, 'Kasse · Warenwirtschaft · Cloud');
  const cursor = h('svg', { viewBox: '0 0 24 24', width: 140, height: 140, style: { position: 'absolute', left: 0, top: 0, filter: 'drop-shadow(0 8px 6px rgba(0,0,0,.4))' } }); cursor.innerHTML = '<path d="M5 2 L5 19 L9.5 15 L12.5 22 L15.5 20.6 L12.6 13.8 L18.5 13.4 Z" fill="#fff" stroke="#111" stroke-width="1.3" stroke-linejoin="round"/>';
  const ring = h('div', { style: { position: 'absolute', left: '840px', top: '1440px', width: '120px', height: '120px', borderRadius: '50%', border: '8px solid rgba(255,255,255,.9)' } });
  cam.append(app, card, nm, w1, url, cta, foot, ring, cursor); return { app, card, nm, w1, url, cta, foot, cursor, ring };
}, (lt, s, cam, t) => {
  camPush(cam, lt, 3.55, 0.03);
  const a = t - 25.5; xf(s.app, { s: a < 0 ? 0 : spr(a, 11, 6), y: Math.sin(t * 2.3) * 8, o: a < 0 ? 0 : 1 });
  xf(s.card, { y: lerp(120, 0, seg(t, 25.6, 26.0)), o: seg(t, 25.6, 25.9, E.lin) }); xf(s.nm, { y: lerp(40, 0, seg(t, 25.8, 26.2)), o: seg(t, 25.8, 26.1, E.lin) });
  s.w1.update(t); xf(s.url, { s: t < 25.95 ? 0 : spr(t - 25.95, 11, 6), o: t > 25.95 ? 1 : 0 });
  const c = t - 26.41; const press = t > 27.35 && t < 27.5; xf(s.cta, { s: (c < 0 ? 0 : spr(c, 11, 6)) * (press ? 0.96 : 1 + 0.015 * Math.sin(t * 7)), y: press ? 12 : 0, o: c < 0 ? 0 : 1 });
  xf(s.foot, { o: seg(t, 26.9, 27.3, E.lin) });
  const k = seg(t, 26.9, 27.35, E.inOut); xf(s.cursor, { x: lerp(1000, 871, k), y: lerp(1750, 1488, k) + (press ? 8 : 0), o: t > 26.9 ? 1 : 0 });
  const rk = clamp((t - 27.35) / 0.55); xf(s.ring, { s: 0.4 + rk * 1.8, o: t > 27.35 && rk < 1 ? 1 - rk : 0 });
});

// ================= Übergänge =================
const wipes = {
  circle1: h('div', { style: { position: 'absolute', left: '-1260px', top: '-840px', width: '3600px', height: '3600px', borderRadius: '50%', background: CREAM, display: 'none' } }),
  panel: h('div', { style: { position: 'absolute', left: 0, top: 0, width: '1080px', height: '2100px', background: `linear-gradient(180deg, #ff6a60, ${RED})`, display: 'none', borderTop: '10px solid #fff' } }),
  circle2: h('div', { style: { position: 'absolute', left: '-1260px', top: '-840px', width: '3600px', height: '3600px', borderRadius: '50%', background: NAVY, display: 'none' } }),
  flash: h('div', { style: { position: 'absolute', inset: 0, background: '#fff', opacity: 0 } }),
  vig: h('div', { style: { position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center, rgba(0,0,0,0) 58%, rgba(0,0,0,.3) 100%)' } }),
};
Object.values(wipes).forEach((w) => stage.append(w));
const FLASHES = [[0, 0.12, 0.7], [10.42, 0.12, 0.35], [12.35, 0.15, 0.4], [14.15, 0.2, 0.7], [22.3, 0.12, 0.5], [23.45, 0.1, 0.4], [25.45, 0.12, 0.5]];

window.DURATION = 29.0;
window.SFX = [[0.0, 'boom'], [0.5, 'tick'], [1.0, 'tick'], [1.5, 'tick'], [2.0, 'tick'], [2.5, 'tick'], [3.0, 'tick'], [3.1, 'pop'], [3.35, 'whoosh'], [3.9, 'pop'], [4.75, 'whoosh'], [5.07, 'thud'], [5.7, 'thud'], [6.55, 'pop'], [7.0, 'pop'], [7.4, 'whoosh'], [7.84, 'riser'], [8.5, 'thud'], [9.4, 'pop'], [10.3, 'whoosh'],
  [10.64, 'beep'], [11.35, 'beep'], [12.09, 'click'], [12.35, 'kaching'], [12.8, 'print'], [14.15, 'ding'], [14.15, 'boom'], [14.9, 'whoosh'], [15.2, 'pop'], [15.92, 'pop'], [16.5, 'pop'], [17.0, 'tick'], [17.6, 'whoosh'], [17.83, 'pop'], [18.97, 'pop'], [19.88, 'beep'], [20.97, 'pop'], [22.2, 'whoosh'], [22.35, 'boom'], [23.45, 'whoosh'], [25.0, 'ding'], [25.45, 'whoosh'], [26.41, 'pop'], [27.35, 'click']];

window.render = (t) => {
  scenes.forEach((sc, i) => {
    const on = t >= sc.from && t < sc.to; sc.root.style.display = on ? 'block' : 'none'; if (!on) return;
    sc.update(t - sc.from, sc.st, sc.cam, t);
  });
  // Szene 3 verlässt per Zoom, Szene 5/6 mit Schieben
  const s3 = scenes[2].root, s5 = scenes[4].root;
  const z = seg(t, 10.28, 10.46, E.in); s3.style.transform = z > 0 ? `scale(${1 + z * 0.7})` : 'none'; s3.style.opacity = String(1 - z);
  const sx = seg(t, 14.95, 15.25, E.out5); s5.style.transform = t < 15.25 ? `translateX(${(1 - sx) * 420}px)` : 'none';
  // Kreisblende 1: 3.35 – 3.8 (Creme)
  const c1 = seg(t, 3.3, 3.75, E.inOut); wipes.circle1.style.display = t >= 3.3 && t < 3.85 ? 'block' : 'none'; xf(wipes.circle1, { s: Math.max(c1, 0.001), o: 1 });
  // Platte: 7.4 hoch (deckt) und 7.9 – 8.3 nach oben weg
  const up = seg(t, 7.4, 7.8, E.inOut), out = seg(t, 7.84, 8.3, E.inOut);
  wipes.panel.style.display = t >= 7.4 && t < 8.35 ? 'block' : 'none'; wipes.panel.style.transform = `translateY(${t < 7.82 ? lerp(2000, 0, up) : lerp(0, -2150, out)}px)`;
  // Kreisblende 2: 17.55 – 17.85 (Marine)
  const c2 = seg(t, 17.5, 17.85, E.inOut); wipes.circle2.style.display = t >= 17.5 && t < 17.9 ? 'block' : 'none'; xf(wipes.circle2, { s: Math.max(c2, 0.001), o: 1 });
  let f = 0; for (const [t0, d, p] of FLASHES) if (t >= t0 && t < t0 + d) f = Math.max(f, p * (1 - (t - t0) / d)); wipes.flash.style.opacity = String(f);
  window.ready = true;
};
window.ready = true; window.render(0);
