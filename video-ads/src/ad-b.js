// Video B – «٣ ثواني»: Tempo-Idee. Stoppuhr-Hook, alte Methode gegen die D-Group-Kasse, Funktionen, Endkarte.
import { h, clamp, lerp, E, prog, px, xf, place, words, makeMascot, EXPR, mixExpr, talk, blink, shake } from './lib.js';
import { makePOS, makeStopwatch, icon } from './parts.js';
import { startVideo } from './runner.js';
import { putMascot, makeStickers, decay, endCard, bounce } from './common.js';

const label = (txt, y, color = '#fff') => place(h('div', { class: 'tag', style: { width: '960px', textAlign: 'right', color, fontSize: '40px' } }, txt), 60, y);
const person = (c, size = 150) => { const s = h('svg', { viewBox: '0 0 100 160', width: size, height: size * 1.6 }); s.innerHTML = `<circle cx="50" cy="32" r="26" fill="${c}"/><path d="M12 158 C12 96 30 70 50 70 C70 70 88 96 88 158 Z" fill="${c}"/>`; return s; };
const PEOPLE = ['#0B1A33', '#FFE9E0', '#1D2E57', '#FFFFFF', '#0B1A33', '#FFE9E0'];

// ---- 1 Hook: Stoppuhr ----
const B1 = { from: 0, to: 3.2, build(root) {
  root.style.background = 'radial-gradient(circle at 50% 38%, #ff5a52 0%, #F4343A 55%, #c81f26 100%)';
  const sw = makeStopwatch({ size: 900, color: '#fff', track: 'rgba(255,255,255,.28)', text: 'transparent' }); place(sw, 90, 120);
  const three = h('div', { class: 'lz', style: { position: 'absolute', left: 0, top: '170px', width: '1080px', textAlign: 'center', fontSize: '640px', color: '#fff', lineHeight: 1, textShadow: '0 24px 0 rgba(0,0,0,.18)' } }, '٣');
  const sec = words([['ثواني!', 'navy']], { size: 240, cls: 'lz', stagger: 0 }); place(sec, 50, 1000);
  const tag = label('// زبون واقف بالدور', 70);
  const cap = words(['هي', 'كل', 'اللي', 'عندك'], { size: 96, cls: 'lz', color: '#fff', stagger: 0.12 }); place(cap, 50, 1290);
  const cap2 = words(['قبل', 'ما', 'الزبون', ['يطلع!', 'navy']], { size: 120, cls: 'lz', color: '#fff', stagger: 0.14 }); place(cap2, 50, 1410);
  const queue = h('div', { style: { position: 'absolute', left: 0, top: '1620px', width: '1080px', height: '300px' } });
  const folks = PEOPLE.map((c, i) => { const p = person(c, 100); place(p, 0, 0); queue.append(p); return p; });
  const m = makeMascot({ scale: 0.8 }); root.append(sw, three, sec, tag, cap, cap2, queue, m);
  return { sw, three, sec, tag, cap, cap2, folks, m };
}, update(lt, t, s) {
  s.sw.set(0, clamp(lt / 3.0));
  const beat = decay(lt % 0.5, 0, 0.18);
  xf(s.three, { s: prog(lt, 0, 0.35, E.back) * (1 + 0.04 * beat), y: shake(lt, 0, 10, 0.3)[1], o: 1 });
  s.sec.update(lt, 0.35); xf(s.tag, { o: clamp(lt * 6) }); s.cap.update(lt, 1.0); s.cap2.update(lt, 1.7);
  s.folks.forEach((p, i) => { const leave = i === 0 ? clamp((lt - 2.5) / 0.6) : 0; xf(p, { x: 60 + i * 105 - E.in(leave) * 500, y: 40 + Math.sin(lt * 6 + i) * 3, o: clamp((lt - 0.2 - i * 0.08) * 6) * (1 - leave * 0.7) }); });
  const ex = lt < 1.0 ? EXPR.shock : mixExpr(EXPR.shock, EXPR.think, prog(lt, 1.0, 0.3)); s.m.set(ex, { mouth: talk(lt, 0.1, 2.8) * 0.8, bob: Math.sin(lt * 9) * 3 });
  putMascot(s.m, { x: 660, y: 1500, s: 0.8 });
} };

// ---- 2 Alte Methode ----
const B2 = { from: 3.2, to: 6.6, enter: 'right', build(root) {
  root.style.background = '#F6F0E4';
  const pill = h('div', { class: 'ar', style: { position: 'absolute', left: '280px', top: '110px', width: '520px', padding: '16px 0', textAlign: 'center', borderRadius: '60px', background: '#0B1A33', color: '#fff', fontSize: '66px' } }, 'الطريقة القديمة');
  const sw = makeStopwatch({ size: 520, color: '#F4343A', track: '#e0d8c6', text: '#F4343A' }); place(sw, 280, 290);
  const stickers = makeStickers(root, [
    { n: 'notebook', x: 60, y: 780, size: 260, t0: 0.3, rot: -12, spin: 80 }, { n: 'calc', x: 760, y: 760, size: 250, t0: 0.5, rot: 10, spin: -110 },
    { n: 'sticky', x: 370, y: 900, size: 200, t0: 0.7, rot: -5, spin: 50 }, { n: 'coin', x: 220, y: 1080, size: 110, t0: 0.9, rot: 0, spin: 260 }, { n: 'coin', x: 690, y: 1100, size: 110, t0: 1.05, rot: 0, spin: -260 }, { n: 'wad', x: 870, y: 1010, size: 120, t0: 1.2, rot: 18, spin: 150 },
  ]);
  const w = words(['ورقة…', 'آلة', 'حاسبة…'], { size: 120, cls: 'lz', color: '#0B1A33', stagger: 0.25 }); place(w, 50, 1230);
  const w2 = words(['وفكّة', ['ضايعة!', 'red']], { size: 130, cls: 'lz', color: '#0B1A33', stagger: 0.25 }); place(w2, 50, 1390);
  const m = makeMascot({ scale: 0.8 }); root.append(pill, sw, w, w2, m);
  return { pill, sw, stickers, w, w2, m };
}, update(lt, t, s) {
  xf(s.pill, { s: prog(lt, 0.05, 0.35, E.back) });
  const secs = 47 * E.in(clamp(lt / 2.6)) * 0.6 + 47 * clamp(lt / 2.6) * 0.4; s.sw.set(Math.min(47, secs), clamp(secs / 47));
  s.stickers(lt); s.w.update(lt, 0.4); s.w2.update(lt, 1.5);
  s.m.set(mixExpr(EXPR.dizzy, EXPR.facepalm, prog(lt, 1.8, 0.3)), { mouth: lt < 1.8 ? talk(lt, 0.1, 1.7) * 0.5 : 0, bob: Math.sin(lt * 5) * 2 });
  putMascot(s.m, { x: 620, y: 1500, s: 0.8 });
} };

// ---- 3 Wende ----
const B3 = { from: 6.6, to: 8.4, enter: 'left', tin: 0.22, build(root) {
  root.style.background = 'radial-gradient(circle at 50% 50%, #17305a 0%, #0B1A33 70%)';
  const rays = h('div', { class: 'layer', style: { background: 'repeating-conic-gradient(from 0deg at 50% 50%, rgba(255,255,255,.06) 0 6deg, transparent 6deg 16deg)' } });
  const w = words(['وبكاشير'], { size: 200, cls: 'lz', color: '#fff', stagger: 0 }); place(w, 50, 220);
  const w2 = words([['D-Group؟', 'lat gold']], { size: 220, cls: 'lz', stagger: 0 }); place(w2, 50, 460);
  const app = h('img', { src: '../img/logo-app.png', style: { position: 'absolute', left: '290px', top: '800px', width: '500px', height: '500px', borderRadius: '112px', boxShadow: '0 40px 0 rgba(0,0,0,.3), 0 0 120px rgba(244,52,58,.6)' } });
  root.append(rays, w, w2, app); return { rays, w, w2, app };
}, update(lt, t, s) { s.rays.style.transform = `rotate(${lt * 10}deg)`; s.w.update(lt, 0.1); s.w2.update(lt, 0.45); xf(s.app, { s: lerp(0.3, 1, E.elastic(clamp((lt - 0.5) / 0.8))), o: clamp((lt - 0.5) * 6), r: Math.sin(lt * 4) * 2 }); } };

// ---- 4 Demo in 3 Sekunden ----
const T0 = 0.2, TAPS = { taps: [{ t: 0.7, idx: 1 }, { t: 1.2, idx: 4 }, { t: 1.7, idx: 0 }, { t: 2.2, idx: 3 }], payAt: 2.7, paidAt: 3.0, printAt: 3.05 };
const B4 = { from: 8.4, to: 13.6, enter: 'zoom', tin: 0.15, build(root) {
  root.style.background = 'radial-gradient(circle at 50% 50%, #17305a 0%, #0B1A33 70%)';
  const sw = makeStopwatch({ size: 340, color: '#F4343A', track: 'rgba(255,255,255,.25)', text: '#fff' }); place(sw, 370, 90);
  const pos = makePOS(); pos.style.transformOrigin = '0 0'; pos.style.left = '103px'; pos.style.top = '700px';
  const w = words(['ضغطة…', 'ضغطة…', ['دفع!', 'gold']], { size: 130, cls: 'lz', color: '#fff', stagger: 0.5 }); place(w, 50, 1560);
  const burst = h('div', { class: 'lz', style: { position: 'absolute', left: 0, top: '445px', width: '1080px', textAlign: 'center', fontSize: '190px', color: '#1FBF75', textShadow: '0 12px 0 rgba(0,0,0,.35)' } }, '٣ ثواني!');
  const w2 = words(['والفاتورة', ['طلعت!', 'gold']], { size: 130, cls: 'lz', color: '#fff', stagger: 0.2 }); place(w2, 50, 1560);
  const m = makeMascot({ scale: 0.9 }); root.append(sw, pos, w, w2, burst, m);
  return { sw, pos, w, w2, burst, m };
}, update(lt, t, s) {
  const el = clamp(lt - T0, 0, 3.0); s.sw.set(el, el / 3.0);
  s.pos.style.transform = `scale(0.95)`; s.pos.update(lt - 0.2, TAPS);
  const done = lt >= 3.2;
  s.w.root = null; s.w.style.display = done ? 'none' : 'flex'; s.w2.style.display = done ? 'flex' : 'none';
  s.w.update(lt, 0.5); s.w2.update(lt, 3.3);
  xf(s.burst, { s: prog(lt, 3.2, 0.4, E.back) * (1 + 0.02 * Math.sin(lt * 8)), r: -4, o: done ? 1 : 0 });
  const ex = done ? EXPR.excited : EXPR.smirk; s.m.set(ex, { mouth: done ? 0.7 : 0.1, bob: Math.sin(lt * 7) * 3 });
  putMascot(s.m, { x: 650, y: 1500, s: 0.75, o: done ? 1 : 0 });
} };

// ---- 5 Funktionen ----
const FEATS = [['tse', 'TSE', 'مضمّنة'], ['touch', 'شاشة لمس', 'سريعة وواضحة'], ['barcode', 'سكانر', 'باركود'], ['pda', 'PDA', 'للجرد وانت ماشي']];
const B5 = { from: 13.6, to: 17.6, enter: 'right', build(root) {
  root.style.background = 'radial-gradient(circle at 50% 50%, #17305a 0%, #0B1A33 70%)';
  const w = words(['سريع،', 'واضح،', ['وكل', 'gold'], ['شي', 'gold'], 'بمكانو'], { size: 120, cls: 'lz', color: '#fff', stagger: 0.14 }); place(w, 50, 90);
  const cards = FEATS.map(([ic, t1, t2], i) => { const c = h('div', { class: 'card', style: { position: 'absolute', left: px(60 + (i % 2) * 495), top: px(410 + Math.floor(i / 2) * 470), width: '465px', height: '440px', textAlign: 'center', paddingTop: '40px' } }, icon(ic, 170), h('div', { class: 'ar', style: { fontSize: '66px', color: '#0B1A33', marginTop: '10px' } }, t1), h('div', { class: 'ar', style: { fontSize: '44px', color: '#5b6478' } }, t2)); root.append(c); return c; });
  const m = makeMascot({ scale: 0.9 }); root.append(w, m);
  return { w, cards, m };
}, update(lt, t, s) {
  s.w.update(lt, 0.05);
  s.cards.forEach((c, i) => { const k = prog(lt, 0.7 + i * 0.5, 0.45, E.back); xf(c, { s: k, r: (i % 2 ? 2 : -2) * (1 - E.out(clamp((lt - 0.7 - i * 0.5) / 0.5))) * 6, o: lt >= 0.7 + i * 0.5 ? 1 : 0 }); });
  s.m.set(EXPR.excited, { mouth: 0.4 + talk(lt, 0.2, 3.6) * 0.5, bob: Math.sin(lt * 7) * 3 });
  putMascot(s.m, { x: 330, y: 1400, s: 0.85 });
} };

// ---- 6 Jetzt du ----
const B6 = { from: 17.6, to: 18.8, enter: 'zoom', tin: 0.12, build(root) {
  root.style.background = 'radial-gradient(ellipse at 50% 85%, #3a0f14 0%, #0B0D12 62%)';
  const m = makeMascot({ scale: 2.1 }); root.append(m);
  const w = words([['جرّب', 'brush white'], ['بنفسك؟', 'brush red']], { size: 250, cls: 'lz', stagger: 0.3 }); place(w, 40, 200);
  root.append(w); return { m, w };
}, update(lt, t, s) { s.m.set(EXPR.wink, { mouth: 0.4, bob: Math.sin(lt * 5) * 2 }); putMascot(s.m, { x: -90, y: 560, s: 1 + lt * 0.04 }); s.w.update(lt, 0.05); } };

// ---- 7 Endkarte ----
let endUpdate;
const B7 = { from: 18.8, to: 23.2, enter: 'right', tin: 0.2, build(root) { endUpdate = endCard(root, { headline: ['وفّر', 'وقتك…', 'ووقت', 'زبونك'], sub: 'Kasse · Warenwirtschaft · Cloud', clickAt: 2.6 }); return {}; }, update(lt) { endUpdate(lt); } };

startVideo({
  duration: 23.2, shots: [B1, B2, B3, B4, B5, B6, B7],
  flashes: [[0.0, 0.15, 0.6], [2.5, 0.12, 0.4], [3.2, 0.12, 0.5], [6.6, 0.15, 0.7], [11.6, 0.2, 0.7], [13.6, 0.1, 0.4], [17.6, 0.1, 0.5], [18.8, 0.15, 0.6]],
  sfx: [[0.0, 'boom'], [0.5, 'tick'], [1.0, 'tick'], [1.5, 'tick'], [2.0, 'tick'], [2.5, 'tick'], [2.55, 'whoosh'], [3.0, 'tick'], [3.2, 'whoosh'], [3.9, 'pop'], [4.3, 'pop'], [4.7, 'pop'], [5.3, 'pop'], [6.3, 'riser'], [6.6, 'whoosh'], [7.2, 'boom'],
    [8.6, 'whoosh'], [9.1, 'beep'], [9.6, 'beep'], [10.1, 'beep'], [10.6, 'beep'], [11.1, 'click'], [11.4, 'kaching'], [11.45, 'print'], [11.6, 'ding'], [13.6, 'whoosh'], [14.3, 'pop'], [14.8, 'pop'], [15.3, 'pop'], [15.8, 'pop'], [17.6, 'boom'], [18.8, 'whoosh'], [19.5, 'pop'], [21.4, 'click']],
});
