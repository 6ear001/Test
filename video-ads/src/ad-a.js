// Video A – «الدرج ناقص» (Der Kassenschub stimmt nie): Hook-Flüstern, Chaos, Auflösung mit dem D-Group-Kassensystem.
import { h, clamp, lerp, E, prog, px, xf, place, words, makeMascot, EXPR, mixExpr, talk, blink, shake } from './lib.js';
import { makePOS, icon } from './parts.js';
import { startVideo } from './runner.js';
import { putMascot, makeStickers, decay, endCard, bounce } from './common.js';

const POS_CFG = { taps: [{ t: 0.9, idx: 0 }, { t: 1.3, idx: 4 }, { t: 1.7, idx: 1 }, { t: 2.2, idx: 0 }], payAt: 2.8, paidAt: 3.0, printAt: 3.1 };
const POS_POS = { x: 103, y: 600, s: 0.95 };
const dark = (root, glow = '#2a0d12') => { root.style.background = `radial-gradient(ellipse at 50% 85%, ${glow} 0%, #0B0D12 62%)`; };
const tagEl = (txt, y = 150) => place(h('div', { class: 'tag', style: { width: '960px', textAlign: 'right', color: '#F5C242', fontSize: '40px' } }, txt), 60, y);

// ---- 1 Hook ----
const A1 = { from: 0, to: 3.0, build(root) {
  dark(root);
  const m = makeMascot({ scale: 1.75 }); root.append(m);
  const tag = tagEl('// ريم بتهمس');
  const bubble = h('div', { style: { position: 'absolute', left: '70px', top: '930px', padding: '22px 44px', borderRadius: '40px', background: '#fff', color: '#0E1015', fontSize: '84px', fontWeight: 900 } }, 'بس بس…');
  bubble.append(h('div', { style: { position: 'absolute', right: '120px', bottom: '-34px', width: 0, height: 0, borderLeft: '30px solid transparent', borderRight: '30px solid transparent', borderTop: '40px solid #fff' } }));
  const l1 = words(['درج', 'الكاشير'], { size: 190, cls: 'lz', color: '#fff', from: 'slam', stagger: 0.12 }); place(l1, 50, 190);
  const l2 = words(['ناقص'], { size: 360, cls: 'lz glitch red', from: 'slam' }); place(l2, 50, 360);
  const l3 = words(['كل', 'ليلة؟!'], { size: 190, cls: 'lz', color: '#fff', from: 'slam', stagger: 0.12 }); place(l3, 50, 730);
  const sticker = h('div', { class: 'mono', style: { position: 'absolute', left: '330px', top: '930px', padding: '10px 36px', borderRadius: '28px', background: '#F4343A', color: '#fff', fontWeight: 700, fontSize: '104px', boxShadow: '0 18px 0 #8f1218' } }, '−87,50 €');
  root.append(tag, bubble, l1, l2, l3, sticker);
  return { m, tag, bubble, l1, l2, l3, sticker };
}, update(lt, t, s) {
  const k = prog(lt, 0.75, 0.25, E.out), shockMouth = EXPR.shock.mouth;
  const ex = mixExpr(EXPR.whisper, EXPR.shock, k);
  ex.mouth = lt < 0.75 ? 0.08 + talk(lt, 0.1, 0.72) * 0.4 : shockMouth * (0.35 + 0.65 * talk(lt, 0.9, 2.9));
  ex.eye = ex.eye * (lt < 0.75 ? blink(lt + 0.4) : 1);
  s.m.set(ex, { bob: Math.sin(lt * 9) * 3 });
  const punch = Math.max(decay(lt, 0.85, 0.3), decay(lt, 1.2, 0.3), decay(lt, 1.6, 0.3), decay(lt, 2.1, 0.4) * 1.6);
  putMascot(s.m, { x: 15 - punch * 8, y: 700 - punch * 6, s: 1 + 0.05 * punch + lt * 0.01 });
  xf(s.tag, { o: clamp(lt * 6) * (lt > 0.8 ? 0.55 : 1) });
  const bs = lt < 0.15 ? 0 : lt < 0.85 ? prog(lt, 0.15, 0.25, E.back) : 1 - prog(lt, 0.85, 0.15, E.in);
  xf(s.bubble, { s: Math.max(bs, 0), r: -4, o: bs > 0.02 ? 1 : 0 });
  s.l1.update(lt, 0.85); s.l2.update(lt, 1.2); s.l3.update(lt, 1.6);
  s.l2.style.setProperty('--g', String(decay(lt, 1.2, 0.5) * 16 + (Math.sin(lt * 50) > 0.9 ? 6 : 0)));
  const [sx, sy] = shake(lt, 1.2, 14, 0.4); const [tx, ty] = shake(lt, 2.1, 28, 0.55);
  s.l2.style.translate = `${sx}px ${sy}px`; s.sticker.style.translate = `${tx}px ${ty}px`;
  const sk = prog(lt, 2.1, 0.3, E.back); xf(s.sticker, { s: lerp(2.5, 1, E.out5(clamp((lt - 2.1) / 0.18))), r: -7, o: lt >= 2.1 ? 1 : 0 });
  void sk;
} };

// ---- 2 Flüstern ----
const A2 = { from: 3.0, to: 5.5, enter: 'zoom', build(root) {
  dark(root, '#1a1020');
  const m = makeMascot({ scale: 2.3 }); root.append(m);
  const tag = tagEl('// بيني وبينك');
  const w = words([['المشكلة', 'red'], 'مو', 'بالموظف'], { size: 170, cls: 'lz', color: '#fff', stagger: 0.18 }); place(w, 50, 270);
  const w2 = words(['…'], { size: 170, cls: 'lz mut' }); place(w2, 50, 560);
  root.append(tag, w, w2); return { m, tag, w };
}, update(lt, t, s) {
  const ex = mixExpr(EXPR.neutral, EXPR.smirk, prog(lt, 0.1, 0.4));
  ex.mouth = ex.mouth + talk(lt, 0.15, 2.3) * 0.5; ex.eye *= blink(lt + 1);
  s.m.set(ex, { bob: Math.sin(lt * 6) * 2.5 });
  putMascot(s.m, { x: -150 - lt * 8, y: 620 - lt * 6, s: 1 + lt * 0.02 });
  xf(s.tag, { o: clamp(lt * 5) }); s.w.update(lt, 0.2);
} };

// ---- 3 Chaos ----
const A3 = { from: 5.5, to: 8.6, enter: 'right', build(root) {
  root.style.background = '#F6F0E4';
  const stickers = makeStickers(root, [
    { n: 'notebook', x: 100, y: 800, size: 260, t0: 0.5, rot: -14, spin: 90 }, { n: 'calc', x: 650, y: 760, size: 250, t0: 0.65, rot: 12, spin: -120 },
    { n: 'sticky', x: 380, y: 900, size: 210, t0: 0.8, rot: -6, spin: 60 }, { n: 'wad', x: 800, y: 1010, size: 150, t0: 1.0, rot: 20, spin: 200 },
    { n: 'wad', x: 70, y: 1090, size: 130, t0: 1.15, rot: -10, spin: -160 }, { n: 'coin', x: 520, y: 1060, size: 120, t0: 1.3, rot: 0, spin: 300 },
    { n: 'sticky', x: 770, y: 740, size: 160, t0: 1.45, rot: 14, spin: -50, arg: '#FF9AA2' },
  ]);
  const w = words(['المشكلة', ['بالورقة', 'red hl'], 'والآلة', 'الحاسبة!'], { size: 150, cls: 'lz', color: '#0B1A33', stagger: 0.2 }); place(w, 50, 200);
  const q = words(['؟!'], { size: 300, cls: 'lz red' }); place(q, 380, 1180);
  const m = makeMascot({ scale: 0.95 }); root.append(m);
  root.append(w, q); return { stickers, w, q, m };
}, update(lt, t, s) {
  s.stickers(lt); s.w.update(lt, 0.15); s.q.update(lt, 1.7);
  const ex = mixExpr(EXPR.dizzy, EXPR.facepalm, prog(lt, 0.9, 0.3)); ex.mouth = lt < 0.9 ? talk(lt, 0, 0.9) * 0.4 : 0; s.m.set(ex, { bob: Math.sin(lt * 4) * 2 });
  putMascot(s.m, { x: 190, y: 1060, s: 1.25 });
} };

// ---- 4 Auflösung ----
const A4 = { from: 8.6, to: 11.0, enter: 'left', tin: 0.22, build(root) {
  root.style.background = 'radial-gradient(circle at 50% 55%, #17305a 0%, #0B1A33 70%)';
  const disc = h('div', { style: { position: 'absolute', left: '90px', top: '520px', width: '900px', height: '900px', borderRadius: '50%', background: '#F4343A', opacity: 0.9 } });
  const pos = makePOS(); pos.style.transformOrigin = '0 0';
  const w1 = words([['الحل؟', 'gold']], { size: 190, cls: 'lz', stagger: 0 }); place(w1, 50, 120);
  const w2 = words([['كاشير', 'brush white'], ['D-Group', 'lat white']], { size: 130, cls: 'lz', stagger: 0.2, color: '#fff' }); place(w2, 50, 330);
  const m = makeMascot({ scale: 1 }); root.append(disc, pos, w1, w2, m);
  const rays = h('div', { class: 'layer', style: { background: 'repeating-conic-gradient(from 0deg at 50% 55%, rgba(255,255,255,.06) 0 6deg, transparent 6deg 16deg)' } }); root.prepend(rays);
  return { disc, pos, w1, w2, m, rays };
}, update(lt, t, s) {
  const k = clamp((lt - 0.3) / 0.9);
  xf(s.disc, { s: lerp(0.2, 1, E.back(clamp(lt / 0.5))), o: clamp(lt * 5) * 0.92 });
  s.pos.style.left = px(POS_POS.x); s.pos.style.top = px(POS_POS.y);
  xf(s.pos, { s: POS_POS.s * lerp(0.6, 1, E.elastic(k)), y: lerp(500, 0, E.out(k)), o: clamp((lt - 0.25) * 6) });
  s.pos.update(0, {});
  s.w1.update(lt, 0.1); s.w2.update(lt, 0.7);
  s.rays.style.transform = `rotate(${lt * 8}deg)`;
  const ex = mixExpr(EXPR.neutral, EXPR.excited, prog(lt, 0.4, 0.3)); ex.mouth = 0.4 + talk(lt, 0.6, 2.2) * 0.5; s.m.set(ex, { bob: Math.sin(lt * 8) * 3 });
  putMascot(s.m, { x: 380, y: 1290, s: 0.85 });
} };

// ---- 5 Verkauf ----
const A5 = { from: 11.0, to: 15.0, tin: 0, build(root) {
  root.style.background = 'radial-gradient(circle at 50% 55%, #17305a 0%, #0B1A33 70%)';
  const pos = makePOS(); pos.style.transformOrigin = '0 0';
  const w1 = words(['كل', 'بيعة'], { size: 150, cls: 'lz', color: '#fff', stagger: 0.15 }); place(w1, 50, 110);
  const w2 = words([['بتنسجل', 'brush gold'], ['لحالها', 'lz white']], { size: 170, cls: 'lz', stagger: 0.25 }); place(w2, 50, 290);
  const chip = h('div', { class: 'chip', style: { position: 'absolute', left: '640px', top: '1500px', direction: 'ltr', fontFamily: 'Outfit', fontSize: '46px' } }, icon('tse', 70), 'TSE inklusive');
  const m = makeMascot({ scale: 1 }); root.append(pos, w1, w2, chip, m);
  return { pos, w1, w2, chip, m };
}, update(lt, t, s) {
  s.pos.style.left = px(POS_POS.x); s.pos.style.top = px(POS_POS.y); s.pos.style.transform = `scale(${POS_POS.s})`;
  s.pos.update(lt, POS_CFG);
  s.w1.update(lt, 0.05); s.w2.update(lt, 0.45);
  xf(s.chip, { s: prog(lt, 3.1, 0.45, E.back), r: -4, o: lt >= 3.1 ? 1 : 0 });
  const ex = lt < 3.0 ? mixExpr(EXPR.neutral, EXPR.smirk, 0.6) : EXPR.excited; s.m.set(ex, { mouth: lt < 3.0 ? 0.1 + talk(lt, 0.2, 2.6) * 0.5 : 0.7, bob: Math.sin(lt * 7) * 3 });
  putMascot(s.m, { x: 20, y: 1330, s: 0.8 });
} };

// ---- 6 Lager und Bericht ----
const A6 = { from: 15.0, to: 18.0, enter: 'right', build(root) {
  root.style.background = '#F6F0E4';
  const w = words(['المخزون', ['بينقص', 'red'], 'لحالو'], { size: 130, cls: 'lz', color: '#0B1A33', stagger: 0.16 }); place(w, 50, 110);
  const w2 = words(['وتقرير', 'اليوم', ['بضغطة', 'brush red']], { size: 120, cls: 'lz', color: '#0B1A33', stagger: 0.16 }); place(w2, 50, 1010);
  const c1 = h('div', { class: 'card lat', style: { position: 'absolute', left: '90px', top: '420px', width: '900px', height: '330px', padding: '34px 44px' } });
  c1.innerHTML = `<div style="font-size:40px;color:#6a7390;font-weight:600">Lager · Brot</div><div class="n" style="font-size:150px;font-weight:700;color:#0B1A33;margin-top:6px"></div><div style="height:26px;border-radius:13px;background:#e8ebf3;margin-top:8px;overflow:hidden"><div class="bar" style="height:100%;background:#2FB67C"></div></div>`;
  const minus = h('div', { class: 'mono', style: { position: 'absolute', right: '60px', top: '60px', fontSize: '110px', fontWeight: 700, color: '#F4343A' } }, '−1');
  c1.append(minus);
  const auto = h('div', { class: 'chip', style: { position: 'absolute', left: '540px', top: '690px', fontSize: '42px', background: '#E3F8EE', color: '#0d6e45', boxShadow: '0 8px 0 rgba(0,0,0,.12)' } }, '✓ automatisch');
  const c2 = h('div', { class: 'card lat', style: { position: 'absolute', left: '90px', top: '1230px', width: '900px', height: '440px', padding: '34px 44px' } });
  c2.innerHTML = `<div style="font-size:40px;color:#6a7390;font-weight:600">Tagesumsatz</div><div class="sum" style="font-size:120px;font-weight:700;color:#0B1A33"></div><div class="bars" style="display:flex;align-items:flex-end;gap:18px;height:170px;margin-top:10px"></div>`;
  const bars = c2.querySelector('.bars'); const hs = [30, 52, 44, 70, 62, 90, 120]; hs.forEach(() => bars.append(h('div', { style: { flex: 1, background: '#F4343A', borderRadius: '10px 10px 0 0', height: '0px' } })));
  const m = makeMascot({ scale: 0.7 }); root.append(w, w2, c1, auto, c2, m);
  return { w, w2, c1, c2, auto, minus, bars, hs, m };
}, update(lt, t, s) {
  s.w.update(lt, 0.05); s.w2.update(lt, 1.5);
  xf(s.c1, { y: lerp(120, 0, E.out(clamp((lt - 0.2) / 0.5))), o: clamp((lt - 0.2) * 4) });
  const dec = lt > 0.9; s.c1.querySelector('.n').textContent = dec ? '47 Stk' : '48 Stk'; s.c1.querySelector('.bar').style.width = (dec ? 47 : 48) + '%';
  xf(s.minus, { s: prog(lt, 0.9, 0.3, E.back), o: dec ? 1 : 0 }); xf(s.auto, { s: prog(lt, 1.1, 0.4, E.back), o: lt > 1.1 ? 1 : 0, r: 3 });
  xf(s.c2, { y: lerp(120, 0, E.out(clamp((lt - 1.5) / 0.5))), o: clamp((lt - 1.5) * 4) });
  const g = clamp((lt - 1.8) / 1.0); s.c2.querySelector('.sum').textContent = (1284.5 * E.out(g)).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  [...s.bars.children].forEach((b, i) => { b.style.height = px(s.hs[i] * E.out(clamp((lt - 1.9 - i * 0.07) / 0.5))); });
  s.m.set(EXPR.excited, { mouth: 0.5 + talk(lt, 0.2, 2.7) * 0.4, bob: Math.sin(lt * 7) * 3 }); putMascot(s.m, { x: 650, y: 1470, s: 0.8 });
} };

// ---- 7 Schublade ----
const A7 = { from: 18.0, to: 20.5, enter: 'zoom', build(root) {
  root.style.background = 'radial-gradient(circle at 50% 55%, #17305a 0%, #0B1A33 70%)';
  const pos = makePOS(); pos.style.transformOrigin = '0 0';
  const w = words(['وآخر', 'الليل…'], { size: 150, cls: 'lz', color: '#fff', stagger: 0.15 }); place(w, 50, 100);
  const w2 = words([['الدرج', 'lz white'], ['مظبوط', 'brush green']], { size: 190, cls: 'lz', stagger: 0.3 }); place(w2, 50, 290);
  const pill = h('div', { class: 'chip mono', style: { position: 'absolute', left: '210px', top: '1500px', direction: 'ltr', fontSize: '62px', background: '#1FBF75', color: '#fff', boxShadow: '0 12px 0 #0c7a49' } }, icon('check', 80, '#0c7a49'), 'Differenz 0,00 €');
  const m = makeMascot({ scale: 1 }); root.append(pos, w, w2, pill, m);
  return { pos, w, w2, pill, m };
}, update(lt, t, s) {
  s.pos.style.left = px(POS_POS.x); s.pos.style.top = px(POS_POS.y); s.pos.style.transform = `scale(${POS_POS.s})`;
  s.pos.update(lt, { drawerAt: 0.4 });
  s.w.update(lt, 0.05); s.w2.update(lt, 0.5);
  xf(s.pill, { s: prog(lt, 1.3, 0.45, E.back), o: lt >= 1.3 ? 1 : 0, r: -2 });
  const ex = lt < 1.6 ? EXPR.smirk : EXPR.wink; s.m.set(mixExpr(ex, ex, 1), { mouth: 0.15 + (lt < 1.6 ? talk(lt, 0.1, 1.5) * 0.4 : 0.2), bob: Math.sin(lt * 7) * 2 });
  putMascot(s.m, { x: 640, y: 1380, s: 0.7 });
} };

// ---- 8 Jetzt du ----
const A8 = { from: 20.5, to: 21.6, enter: 'zoom', tin: 0.12, build(root) {
  dark(root, '#3a0f14');
  const m = makeMascot({ scale: 2.1 }); root.append(m);
  const w = words([['جرّب؟', 'brush white']], { size: 380, cls: 'lz', stagger: 0 }); place(w, 40, 220);
  root.append(w); return { m, w };
}, update(lt, t, s) { s.m.set(EXPR.grin, { mouth: 0.5, bob: Math.sin(lt * 5) * 2 }); putMascot(s.m, { x: -90, y: 560, s: 1 + lt * 0.04 }); s.w.update(lt, 0.05); } };

// ---- 9 Endkarte ----
let endUpdate;
const A9 = { from: 21.6, to: 25.6, enter: 'right', tin: 0.2, build(root) { endUpdate = endCard(root, { headline: ['الكاشير', 'والمخزون', 'والمحاسبة', 'بنظام', 'واحد'], sub: 'Kasse · Warenwirtschaft · Cloud', clickAt: 2.5 }); return {}; }, update(lt) { endUpdate(lt); } };

startVideo({
  duration: 25.6, shots: [A1, A2, A3, A4, A5, A6, A7, A8, A9],
  flashes: [[0.85, 0.12, 0.35], [2.1, 0.25, 0.8], [5.5, 0.1, 0.5], [8.6, 0.2, 0.7], [14.0, 0.18, 0.5], [18.0, 0.1, 0.4], [20.5, 0.1, 0.5], [21.6, 0.15, 0.6]],
  sfx: [[0.15, 'pop'], [0.85, 'thud'], [1.2, 'thud'], [1.6, 'thud'], [2.1, 'boom'], [3.0, 'whoosh'], [5.5, 'whoosh'], [6.0, 'pop'], [6.15, 'pop'], [6.3, 'pop'], [6.45, 'pop'], [6.6, 'pop'], [8.3, 'riser'], [8.6, 'whoosh'], [9.3, 'boom'],
    [11.9, 'beep'], [12.3, 'beep'], [12.7, 'beep'], [13.2, 'beep'], [13.8, 'click'], [14.0, 'kaching'], [14.1, 'print'], [14.1, 'ding'], [15.0, 'whoosh'], [15.9, 'tick'], [16.8, 'pop'], [18.0, 'whoosh'], [18.4, 'drawer'], [19.3, 'ding'], [20.5, 'boom'], [21.6, 'whoosh'], [22.3, 'pop'], [24.1, 'click']],
});
