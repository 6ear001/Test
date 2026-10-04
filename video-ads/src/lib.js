// Mini-Engine für die Videos: deterministisch (alles hängt nur von der Zeit t ab), damit Bild für Bild gerendert werden kann.
export const W = 1080, H = 1920;
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const E = {
  lin: (t) => t,
  out: (t) => 1 - Math.pow(1 - t, 3),
  out5: (t) => 1 - Math.pow(1 - t, 5),
  in: (t) => t * t * t,
  inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  back: (t) => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  elastic: (t) => (t === 0 || t === 1 ? t : Math.pow(2, -9 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1),
};
/** Fortschritt 0..1 eines Vorgangs, der bei s beginnt und d Sekunden dauert */
export const prog = (t, s, d, ease = E.out) => ease(clamp((t - s) / d));
export const noise = (x) => Math.sin(x * 12.9898) * 43758.5453 % 1;
/** Abklingendes Zittern ab Zeitpunkt t0 */
export const shake = (t, t0, amp = 14, dur = 0.5) => { const k = clamp((t - t0) / dur); if (t < t0 || k >= 1) return [0, 0]; const a = amp * (1 - k) * (1 - k); return [Math.sin(t * 91) * a, Math.cos(t * 77) * a]; };

export function h(tag, attrs, ...kids) {
  const el = tag === 'svg' || tag.startsWith('svg:') ? document.createElementNS('http://www.w3.org/2000/svg', tag.replace('svg:', '')) : document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(Infinity)) if (c !== null && c !== undefined && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c)));
  return el;
}
export const px = (n) => `${n}px`;
export function place(el, x, y, extra = {}) { Object.assign(el.style, { position: 'absolute', left: px(x), top: px(y), ...extra }); return el; }
export function xf(el, { x = 0, y = 0, s = 1, r = 0, sx, sy, o = 1, blur = 0 } = {}) {
  el.style.transform = `translate(${x}px, ${y}px) rotate(${r}deg) scale(${sx ?? s}, ${sy ?? s})`;
  el.style.opacity = String(o);
  el.style.filter = blur > 0.05 ? `blur(${blur}px)` : 'none';
}

/** Wort-für-Wort-Text. tokens: ["Wort", ["Wort", "klasse"], ...]. Arabische Wörter bleiben ganz (Schrift verbindet sich). */
export function words(tokens, { size = 120, cls = 'lz', color = 'inherit', gap = 0.26, lh = 1.15, width = 980, stagger = 0.12, dur = 0.38, from = 'pop' } = {}) {
  const root = h('div', { class: 'words ' + cls, style: { fontSize: px(size), ...(color !== 'inherit' ? { color } : {}), width: px(width), lineHeight: lh, columnGap: `${gap}em` } });
  const spans = tokens.map((tk) => { const [txt, c] = Array.isArray(tk) ? tk : [tk, '']; const s = h('span', { class: 'w ' + c }, txt); root.append(s); return s; });
  root.update = (lt, start = 0) => spans.forEach((s, i) => {
    const k = clamp((lt - start - i * stagger) / dur);
    if (from === 'pop') xf(s, { s: lerp(0.5, 1, E.back(k)), y: lerp(40, 0, E.out(k)), o: clamp(k * 3), blur: (1 - E.out(k)) * 14 });
    else if (from === 'slam') xf(s, { s: lerp(2.4, 1, E.out5(k)), o: clamp(k * 4), blur: (1 - E.out(k)) * 10 });
    else xf(s, { y: lerp(60, 0, E.out(k)), o: clamp(k * 3) });
  });
  root.spans = spans;
  return root;
}

// ---------------- Figur: Ria, Unternehmerin (Vektor) ----------------
const SKIN = '#E8B48F', SKIN_D = '#D39A74', HAIR = '#2A1A15', NAVY = '#14213D', LIP = '#C41E3A';
export const EXPR = {
  neutral: { browL: 0, browR: 0, tiltL: 0, tiltR: 0, eye: 1, px: 0, py: 0, mouth: 0.05, smile: 0.25, blush: 0.25, tilt: 0 },
  whisper: { browL: -6, browR: -6, tiltL: 10, tiltR: 10, eye: 0.62, px: 0.2, py: 0, mouth: 0.18, smile: -0.2, blush: 0.15, tilt: -2 },
  shock: { browL: 22, browR: 22, tiltL: -4, tiltR: -4, eye: 1.25, px: 0, py: 0, mouth: 0.9, smile: -0.4, blush: 0.1, tilt: 0 },
  smirk: { browL: 14, browR: -4, tiltL: -4, tiltR: 6, eye: 0.8, px: -0.7, py: 0, mouth: 0.05, smile: 0.7, blush: 0.35, tilt: 4 },
  facepalm: { browL: 6, browR: 6, tiltL: -12, tiltR: -12, eye: 0.08, px: 0, py: 0.4, mouth: 0.0, smile: -0.8, blush: 0.1, tilt: -3 },
  excited: { browL: 18, browR: 18, tiltL: -6, tiltR: -6, eye: 1.1, px: 0, py: -0.2, mouth: 0.75, smile: 1, blush: 0.5, tilt: 3 },
  wink: { browL: 12, browR: 0, tiltL: -4, tiltR: 8, eye: 1, eyeR: 0.06, px: 0, py: 0, mouth: 0.25, smile: 0.95, blush: 0.5, tilt: 5 },
  grin: { browL: 8, browR: 8, tiltL: 14, tiltR: 14, eye: 0.7, px: 0, py: 0, mouth: 0.55, smile: 1, blush: 0.4, tilt: 0 },
  think: { browL: 12, browR: 4, tiltL: -2, tiltR: 4, eye: 0.9, px: 0.9, py: -0.8, mouth: 0.04, smile: -0.1, blush: 0.2, tilt: -4 },
  dizzy: { browL: 4, browR: 4, tiltL: 8, tiltR: 8, eye: 0.9, px: 0, py: 0, mouth: 0.3, smile: -0.5, blush: 0.2, tilt: 0 },
};
export const mixExpr = (a, b, k) => { const o = {}; for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) o[key] = lerp(a[key] ?? b[key], b[key] ?? a[key], k); return o; };
/** Sprechbewegung des Mundes (0..1) für die Zeitspanne [s, e] */
export const talk = (t, s, e) => (t < s || t > e ? 0 : clamp(Math.abs(Math.sin(t * 17.3)) * (0.55 + 0.45 * Math.sin(t * 6.1 + 1)) * 1.25) * clamp((t - s) / 0.05) * clamp((e - t) / 0.08));
export const blink = (t) => { const k = (t % 3.1); return k < 0.12 ? Math.abs(k - 0.06) / 0.06 : 1; };

export function makeMascot({ scale = 1 } = {}) {
  const svg = h('svg', { viewBox: '0 0 600 780', width: 600 * scale, height: 780 * scale, style: { overflow: 'visible' } });
  svg.innerHTML = `
  <defs><clipPath id="clipL"><ellipse id="clipLe" cx="246" cy="338" rx="31" ry="21"/></clipPath><clipPath id="clipR"><ellipse id="clipRe" cx="354" cy="338" rx="31" ry="21"/></clipPath>
  <clipPath id="clipM"><path id="clipMp" d=""/></clipPath></defs>
  <g id="hairBack"><path d="M128 340 C 96 140 504 140 472 340 L 506 640 L 94 640 Z" fill="${HAIR}"/></g>
  <g id="body">
   <path d="M262 470 L338 470 L338 585 Q300 612 262 585 Z" fill="${SKIN_D}"/>
   <path d="M40 780 C 40 640 150 580 300 580 C 450 580 560 640 560 780 Z" fill="${NAVY}"/>
   <path d="M232 584 L300 704 L368 584 Q300 612 232 584 Z" fill="#FF4A43"/>
   <path d="M232 584 L286 700 L214 640 Z M368 584 L314 700 L386 640 Z" fill="#1D2E57"/>
   <path d="M262 585 Q300 612 338 585" stroke="${SKIN_D}" stroke-width="8" fill="none"/>
   </g><g id="all"><ellipse cx="300" cy="340" rx="121" ry="143" fill="${SKIN}"/>
   <ellipse cx="180" cy="352" rx="14" ry="26" fill="${SKIN}"/><ellipse cx="420" cy="352" rx="14" ry="26" fill="${SKIN}"/>
   
   <ellipse id="blushL" cx="226" cy="392" rx="26" ry="15" fill="#FF7A7A" opacity=".25"/><ellipse id="blushR" cx="374" cy="392" rx="26" ry="15" fill="#FF7A7A" opacity=".25"/>
   <g id="eyeL"><ellipse id="whiteL" cx="246" cy="338" rx="31" ry="21" fill="#fff"/><g clip-path="url(#clipL)"><circle id="irisL" cx="246" cy="338" r="16" fill="#4A2A1A"/><circle id="pupL" cx="246" cy="338" r="8" fill="#111"/><circle id="hiL" cx="251" cy="332" r="4.5" fill="#fff"/></g><path id="lidL" d="" stroke="#1a100c" stroke-width="7" stroke-linecap="round" fill="none"/></g>
   <g id="eyeR"><ellipse id="whiteR" cx="354" cy="338" rx="31" ry="21" fill="#fff"/><g clip-path="url(#clipR)"><circle id="irisR" cx="354" cy="338" r="16" fill="#4A2A1A"/><circle id="pupR" cx="354" cy="338" r="8" fill="#111"/><circle id="hiR" cx="359" cy="332" r="4.5" fill="#fff"/></g><path id="lidR" d="" stroke="#1a100c" stroke-width="7" stroke-linecap="round" fill="none"/></g>
   <path id="browL" d="" stroke="${HAIR}" stroke-width="12" stroke-linecap="round" fill="none"/><path id="browR" d="" stroke="${HAIR}" stroke-width="12" stroke-linecap="round" fill="none"/>
   <path d="M300 352 Q 289 392 307 399" stroke="${SKIN_D}" stroke-width="6" stroke-linecap="round" fill="none"/>
   <g id="mouth"><path id="mIn" d="" fill="#5A1420"/><g clip-path="url(#clipM)"><rect id="teeth" x="240" y="400" width="120" height="14" fill="#fff"/></g><path id="mLip" d="" stroke="${LIP}" stroke-width="11" stroke-linejoin="round" stroke-linecap="round" fill="none"/></g>
   <path d="M172 380 C 158 450 172 520 204 585 L 236 585 C 212 505 206 445 212 392 Z" fill="${HAIR}"/><path d="M428 380 C 442 450 428 520 396 585 L 364 585 C 388 505 394 445 388 392 Z" fill="${HAIR}"/>
   <path d="M176 322 C 166 168 436 146 426 322 C 404 254 338 206 262 214 C 222 224 192 262 176 322 Z" fill="${HAIR}"/>
   <g><circle cx="178" cy="384" r="8" fill="#F5C242"/><circle cx="422" cy="384" r="8" fill="#F5C242"/><path d="M178 395 L178 418 M422 395 L422 418" stroke="#F5C242" stroke-width="5"/><circle cx="184" cy="424" r="10" fill="#F5C242"/><circle cx="422" cy="424" r="10" fill="#F5C242"/></g><path d="M232 214 C 300 190 380 214 408 268" stroke="#4a3027" stroke-width="7" stroke-linecap="round" fill="none" opacity=".55"/>
  </g>`;
  const $ = (id) => svg.querySelector('#' + id);
  const root = h('div', { style: { position: 'absolute', transformOrigin: '50% 90%' } }, svg);
  const lid = (cx, o) => { const top = 338 - 24 * o - 4; return `M${cx - 33} 341 Q ${cx} ${top - 9} ${cx + 33} 341`; };
  root.set = (e, extra = {}) => {
    const p = { ...EXPR.neutral, ...e, ...extra };
    const eyeL = p.eyeL ?? p.eye, eyeR = p.eyeR ?? p.eye;
    for (const [side, cx, o] of [['L', 246, eyeL], ['R', 354, eyeR]]) {
      const ry = Math.max(1.5, 21 * clamp(o, 0, 1.3));
      for (const id of ['white' + side, 'clip' + side + 'e']) { $(id).setAttribute('ry', ry); }
      const ix = cx + p.px * 7, iy = 338 + p.py * 5;
      for (const id of ['iris', 'pup', 'hi']) { const el = $(id + side); const off = id === 'hi' ? 5 : 0; el.setAttribute('cx', ix + off); el.setAttribute('cy', iy - (id === 'hi' ? 5 : 0)); }
      $('lid' + side).setAttribute('d', lid(cx, clamp(o, 0.05, 1.3)));
    }
    const bl = (x1, x2, side) => { const r = side === 'L' ? p.browL : p.browR, t = side === 'L' ? p.tiltL : p.tiltR; const yo = 292 - r, xi = side === 'L' ? x2 : x1; const inner = side === 'L' ? [x2, yo + t] : [x1, yo + t]; const outer = side === 'L' ? [x1, yo - t * 0.4] : [x2, yo - t * 0.4]; return `M${outer[0]} ${outer[1]} Q ${(x1 + x2) / 2} ${yo - 14 - r * 0.15} ${inner[0]} ${inner[1]}`; };
    $('browL').setAttribute('d', bl(208, 284, 'R')); $('browR').setAttribute('d', bl(316, 392, 'L'));
    const cy = 420, w = 40 + 14 * p.smile, o = p.mouth * 40, corner = -p.smile * 12;
    const L = [300 - w, cy + corner], R = [300 + w, cy + corner];
    const top = cy - 10 - p.smile * 4 + corner * 0.2, bot = cy + 6 + o + Math.max(0, p.smile) * 8;
    const mouthPath = `M${L[0]} ${L[1]} Q 300 ${top} ${R[0]} ${R[1]} Q 300 ${bot * 1.0 + o * 0.2} ${L[0]} ${L[1]} Z`;
    $('mIn').setAttribute('d', mouthPath); $('clipMp').setAttribute('d', mouthPath);
    $('mLip').setAttribute('d', mouthPath);
    $('teeth').setAttribute('y', top - 2); $('teeth').setAttribute('opacity', p.mouth > 0.22 ? 1 : 0);
    $('blushL').setAttribute('opacity', p.blush); $('blushR').setAttribute('opacity', p.blush);
    const tf = `rotate(${p.tilt} 300 560) translate(0 ${p.bob || 0})`; $('all').setAttribute('transform', tf); $('hairBack').setAttribute('transform', tf);
  };
  root.set(EXPR.neutral);
  return root;
}
