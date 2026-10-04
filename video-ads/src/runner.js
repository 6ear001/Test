// Startet ein Video: baut alle Szenen einmal auf und stellt render(t) bereit (rein zeitgesteuert).
import { h, clamp, lerp, E, xf } from './lib.js';

export function startVideo({ duration, shots, flashes = [], sfx = [] }) {
  const stage = document.getElementById('stage');
  const flash = h('div', { class: 'layer', style: { background: '#fff', opacity: 0, zIndex: 50 } });
  const vignette = h('div', { class: 'layer', style: { zIndex: 40, background: 'radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(0,0,0,.28) 100%)' } });
  for (const s of shots) { s.root = h('div', { class: 'shot' }); s.state = s.build ? s.build(s.root) : {}; stage.append(s.root); }
  stage.append(vignette, flash);
  window.DURATION = duration; window.SFX = sfx;
  window.render = (t) => {
    for (const s of shots) {
      const on = t >= s.from && t < s.to;
      s.root.style.display = on ? 'block' : 'none';
      if (!on) continue;
      const lt = t - s.from, len = s.to - s.from;
      s.update(lt, t, s.state, s.root, len);
      // Übergänge: kurzes Wischen/Verwischen am Anfang
      const tin = s.tin ?? 0.18;
      if (s.enter && lt < tin) { const k = E.out(lt / tin); const dir = s.enter === 'left' ? -1 : 1; const x = s.enter === 'zoom' ? 0 : dir * (1 - k) * 260; s.root.style.transform = `translateX(${x}px) scale(${s.enter === 'zoom' ? lerp(1.18, 1, k) : 1})`; s.root.style.filter = `blur(${(1 - k) * 18}px)`; }
      else { s.root.style.transform = 'none'; s.root.style.filter = 'none'; }
    }
    let f = 0;
    for (const [t0, dur, peak = 0.9] of flashes) if (t >= t0 && t < t0 + dur) f = Math.max(f, peak * (1 - (t - t0) / dur));
    flash.style.opacity = String(f);
    window.ready = true;
  };
  window.ready = true;
  window.render(0);
}
export const whenFontsReady = () => document.fonts.ready;
