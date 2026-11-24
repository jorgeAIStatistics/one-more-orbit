// The rest of the interface's painted rooms and its drawn components (Afterglow). This is mockups/art/ui-afterglow.js
// as a module: the game paints Marlow's desk, the lamp room, the hearth, the gallery and the logbook page with exactly
// the painters the approved stills were made from. UI.ROOMS paints a room without its words; UI.C holds the components
// (words, hairline, flame, the way back, a dab of light), defined once. Made by hand: when the mock changes, copy it here.
import { K, DUSK } from './painter.js';
// Afterglow, the rest of the interface, as stills: pause, the HUD and its popups, and the rooms of the Lantern
// (settings at Marlow's desk, the sync check as his four taps, Glows by the hearth, the star chart on the gallery
// rail, the credits as a logbook page), plus the components they are all made of. No boxes, no chips, no gradient
// button: words in the italic serif, hairline rules, threads with a flame for a handle, lights lit or unlit.
// Needs kit.js and a-dusk.js. Each scene is drawn for a phone (780 x 1688) and a desktop (1440 x 900).
/* eslint-disable */
const UI = (() => {
  const { TAU, D, lerp, RNG, rgba, mix } = K;
  const T = DUSK.tools;
  const SERIF = `"Cormorant Garamond", ${T.SERIF}`, FIGS = `"Cormorant Lining", ${SERIF}`;
  const CREAM = '#fff1d8', SAND = '#e6cfae';
  const DUSKY = [[0, [9, 10, 34]], [0.42, [34, 28, 84]], [0.72, [96, 50, 104]], [0.9, [206, 104, 92]], [1, [248, 178, 122]]];
  const ROOM = [[0, [10, 9, 24]], [0.55, [24, 17, 38]], [1, [40, 24, 40]]];

  // ------------------------------------------------------------------ the components, defined once
  /** Words: a dark breath under them, then the letters. Returns their width. */
  function write(ctx, s, x, y, px, o = {}) {
    const { align = 'left', alpha = 1, color = CREAM, style = 'italic', glow = 0, figs = false, ink = false } = o;
    ctx.save();
    ctx.font = `${style} 500 ${px}px ${figs ? FIGS : SERIF}`; ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
    if (glow) { ctx.shadowColor = `rgba(255,170,110,${0.6 * alpha * glow})`; ctx.shadowBlur = px * 0.4; ctx.fillStyle = `rgba(255,240,214,${0.5 * alpha})`; ctx.fillText(s, x, y); }
    if (!ink) { ctx.shadowColor = 'rgba(10,6,24,0.8)'; ctx.shadowBlur = px * 0.35; } else ctx.shadowBlur = 0;
    ctx.globalAlpha = alpha; ctx.fillStyle = color; ctx.fillText(s, x, y);
    const wd = ctx.measureText(s).width;
    ctx.restore();
    return wd;
  }
  /** A hairline rule, a little uneven, as if drawn along a straight edge by hand. */
  function rule(ctx, x0, x1, y, a = 0.22, c = [255, 236, 206]) { ctx.save(); ctx.strokeStyle = rgba(c, a); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x0, y); ctx.bezierCurveTo(lerp(x0, x1, 0.3), y - 0.8, lerp(x0, x1, 0.7), y + 0.8, x1, y); ctx.stroke(); ctx.restore(); }
  /** A small flame: the handle of a slider, a light that is lit, the place you are on a thread. */
  function flame(ctx, x, y, s, c = [255, 200, 120], lit = 1) {
    const outline = () => { ctx.beginPath(); ctx.moveTo(x, y); ctx.bezierCurveTo(x - 9 * s, y - 4 * s, x - 6 * s, y - 14 * s, x + 1.5 * s, y - 24 * s); ctx.bezierCurveTo(x + 5 * s, y - 14 * s, x + 9 * s, y - 5 * s, x, y); ctx.closePath(); };
    if (lit <= 0) { // unlit: the same flame, only its outline, and the wick
      outline(); ctx.strokeStyle = 'rgba(255,236,206,0.5)'; ctx.lineWidth = Math.max(1, 1.5 * s); ctx.lineJoin = 'round'; ctx.stroke();
      ctx.strokeStyle = 'rgba(255,236,206,0.5)'; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x, y + 1 * s); ctx.lineTo(x, y + 6 * s); ctx.stroke();
      return;
    }
    K.glow(ctx, x, y - 8 * s, 34 * s, c, 0.5);
    const shape = (k) => { ctx.beginPath(); ctx.moveTo(x, y); ctx.bezierCurveTo(x - 9 * s * k, y - 4 * s * k, x - 6 * s * k, y - 14 * s * k, x + 1.5 * s * k, y - 24 * s * k); ctx.bezierCurveTo(x + 5 * s * k, y - 14 * s * k, x + 9 * s * k, y - 5 * s * k, x, y); ctx.closePath(); };
    shape(1); ctx.fillStyle = rgba(mix(c, [255, 120, 60], 0.35), 0.9); ctx.fill();
    shape(0.66); ctx.fillStyle = rgba(mix(c, [255, 255, 255], 0.35), 0.95); ctx.fill();
    shape(0.34); ctx.fillStyle = 'rgba(255,252,240,0.98)'; ctx.fill();
  }
  /** A slider: a thread drawn taut, brighter where it has been drawn through, with a flame for a handle. */
  function slider(ctx, x0, x1, y, v, u, c = [255, 200, 120]) {
    rule(ctx, x0, x1, y, 0.3);
    ctx.save(); ctx.strokeStyle = 'rgba(255,241,216,0.85)'; ctx.lineWidth = 1.6 * u; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(lerp(x0, x1, v), y); ctx.stroke(); ctx.restore();
    for (const e of [x0, x1]) { ctx.fillStyle = 'rgba(255,236,206,0.5)'; ctx.beginPath(); ctx.arc(e, y, 1.8 * u, 0, TAU); ctx.fill(); }
    flame(ctx, lerp(x0, x1, v), y + 2 * u, 0.62 * u, c);
  }
  /** A toggle: a light, lit or not. */
  const toggle = (ctx, x, y, on, u, c) => flame(ctx, x, y + 9 * u, 0.86 * u, c, on ? 1 : 0);
  /** The way back: an arrow drawn in two strokes of ink, and where it leads. */
  function back(ctx, x, y, s, label, u, o = {}) {
    const { color = [255, 241, 216], alpha = 0.72 } = o;
    ctx.save(); ctx.strokeStyle = rgba(color, alpha); ctx.lineWidth = 1.8 * u; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(x + 9 * u, y - 8 * u); ctx.quadraticCurveTo(x + 3 * u, y - 3 * u, x, y); ctx.quadraticCurveTo(x + 4 * u, y + 3 * u, x + 9.5 * u, y + 8 * u); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 1, y); ctx.bezierCurveTo(x + 8 * u, y - 1.2 * u, x + 15 * u, y + 1 * u, x + 22 * u, y - 0.4 * u); ctx.stroke(); ctx.restore();
    if (label) write(ctx, label, x + 30 * u, y + 5 * u, s, { alpha, color: rgba(color, 1), ink: !!o.ink });
  }
  /** Pause: two short strokes of ink. */
  function pauseMark(ctx, x, y, u, a = 0.8) { ctx.save(); ctx.strokeStyle = `rgba(255,241,216,${a})`; ctx.lineWidth = 2.6 * u; ctx.lineCap = 'round'; ctx.shadowColor = 'rgba(10,6,24,0.8)'; ctx.shadowBlur = 6; for (const k of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x + k * 4.5 * u, y - 8 * u); ctx.quadraticCurveTo(x + k * 4.5 * u + 0.8, y, x + k * 4.5 * u - 0.4, y + 8 * u); ctx.stroke(); } ctx.restore(); }
  function dab(ctx, x, y, s, on) {
    if (on) { K.glow(ctx, x, y, s * 3, [255, 220, 150], 0.4); ctx.fillStyle = 'rgba(255,240,206,0.98)'; ctx.beginPath(); ctx.ellipse(x, y, s, s * 0.9, 0.4, 0, TAU); ctx.fill(); }
    else { ctx.strokeStyle = 'rgba(255,236,206,0.5)'; ctx.lineWidth = Math.max(1, s * 0.28); ctx.beginPath(); ctx.arc(x, y, s * 0.85, 0, TAU); ctx.stroke(); }
  }
  /** One row of settings: its name on the left, a hairline under it, and whatever it holds drawn by `right`. */
  function row(ctx, x0, x1, y, label, u, right, sub) {
    write(ctx, label, x0, y, 20 * u, { alpha: 0.95 });
    if (sub) write(ctx, sub, x0, y + 17 * u, 13 * u, { alpha: 0.6, color: SAND });
    if (right) right(y - 6 * u);
    rule(ctx, x0, x1, y + (sub ? 27 : 15) * u, 0.16);
    return y + (sub ? 56 : 44) * u;
  }
  const head = (ctx, s, x, y, u) => { write(ctx, s, x, y, 14.5 * u, { alpha: 0.7, color: SAND }); return y + 34 * u; };

  // ------------------------------------------------------------------ the play field behind the HUD and the pause
  function playScene(ctx, w, h, dev, seed = 63) {
    const r = RNG(seed), G = K.G, u = dev === 'phone' ? 2 : 1.15;
    const cx = w / 2, cy = dev === 'phone' ? h * 0.47 : h * 0.51, k = dev === 'phone' ? 1.08 : 1.0;
    T.sky(ctx, w, h, [[0, [28, 16, 52]], [0.4, [92, 36, 76]], [0.75, [196, 84, 66]], [1, [246, 168, 104]]], r);
    T.stars(ctx, w, h * 0.5, r, 300, 3);
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 22; i++) { const a = (i / 22) * TAU + r() * 0.2, hw = 0.03 + r() * 0.07, len = (500 + r() * 500) * (dev === 'phone' ? 1.6 : 1); const g = ctx.createRadialGradient(cx, cy, 40, cx, cy, len); g.addColorStop(0, rgba([255, 214, 150], 0.26)); g.addColorStop(1, rgba([255, 140, 90], 0)); ctx.fillStyle = g; K.path(ctx, K.jit([[cx, cy], [cx + Math.cos(a - hw) * len, cy + Math.sin(a - hw) * len], [cx + Math.cos(a) * len * 1.05, cy + Math.sin(a) * len * 1.05], [cx + Math.cos(a + hw) * len, cy + Math.sin(a + hw) * len]], r, 8)); ctx.fill(); }
    ctx.restore();
    T.ridge(ctx, w, h, h * 0.86, 30 * u, 4, [58, 24, 58], cx, [255, 200, 140], 0.6);
    T.ridge(ctx, w, h, h * 0.92, 22 * u, 9, [26, 12, 36], cx, [255, 210, 150], 0.8);
    T.finish(ctx, w, h, 71, 0.4);
    const band = ctx.createRadialGradient(cx, cy, 70 * k, cx, cy, 430 * k); band.addColorStop(0, 'rgba(14,8,28,0)'); band.addColorStop(0.2, 'rgba(14,8,28,0.62)'); band.addColorStop(0.72, 'rgba(14,8,28,0.62)'); band.addColorStop(1, 'rgba(14,8,28,0)');
    ctx.fillStyle = band; ctx.fillRect(0, 0, w, h);
    T.sphere(ctx, cx, cy, G.planet * k, [214, 96, 60], [255, 200, 130], [70, 26, 50], 225, r, { bands: [[-0.2, 0.22, [255, 200, 140], 0.16], [0.3, 0.25, [150, 50, 50], 0.18]], haze: 0.35 });
    ctx.save(); ctx.translate(cx - G.cx * k, cy - G.cy * k); ctx.scale(k, k);
    K.playFG(ctx, {
      faint: 'rgba(255,238,214,0.17)', faintW: 1.3, meterBack: 'rgba(255,255,255,0.14)', meterW: 4, goldCol: '#ffd06a', dots: 'rgba(255,255,255,0.65)',
      halo: 'rgba(10,6,22,0.75)', ring: '#f7efe0', ringW: 4.5, danger: '#ea4a30', dangerCore: '#fff6ee', markLen: 16, markW: 5.5,
      gold(c, x, y) { c.fillStyle = 'rgba(10,6,22,0.6)'; c.beginPath(); c.arc(x, y, 11, 0, TAU); c.fill(); c.strokeStyle = '#ffd06a'; c.lineWidth = 2.4; c.beginPath(); c.arc(x, y, 7.5, 0, TAU); c.stroke(); c.fillStyle = '#ffe6a8'; c.beginPath(); c.arc(x, y, 3, 0, TAU); c.fill(); },
      shard(c, x, y) { K.glow(c, x, y, 30, [200, 240, 255], 0.5); c.fillStyle = '#d8f4ff'; c.strokeStyle = '#ffd06a'; c.lineWidth = 2; c.lineJoin = 'round'; c.beginPath(); c.moveTo(x + 1, y - 15); c.lineTo(x + 10, y - 2); c.lineTo(x + 3, y + 15); c.lineTo(x - 9, y + 4); c.closePath(); c.fill(); c.stroke(); },
      lens(c, x, y, rot) { c.save(); c.translate(x, y); c.rotate(rot); K.glow(c, 0, 0, 44, [255, 170, 110], 0.4); c.beginPath(); c.moveTo(0, -34); c.quadraticCurveTo(14, 0, 0, 34); c.quadraticCurveTo(-14, 0, 0, -34); c.fillStyle = 'rgba(255,170,110,0.25)'; c.fill(); c.strokeStyle = '#ffb07a'; c.lineWidth = 2.5; c.stroke(); c.restore(); },
      eko(c, x, y, trail) { K.brush(c, trail, 9, [255, 190, 120], r, { passes: 6, alpha: 0.3 }); T.eko(c, x, y + 2, 0.2, r, { wisp: false, lean: -0.6 }); },
      hud() {}
    });
    ctx.restore();
    return { cx, cy, k, u };
  }
  /**
   * The HUD: everything in the same quiet hand. Top left, the attempt and where in the song; top centre, how far, and
   * the three shards; top right, pause. Along the bottom, the song as a thread with a flame where you are, a tick at
   * the drop and a small ring at your best. Popups are single lines near the core, never a pill.
   */
  function hud(ctx, w, h, dev, o) {
    const u = dev === 'phone' ? 2 : 1.15, m = (dev === 'phone' ? 22 : 30) * u, top = (dev === 'phone' ? 62 : 44) * u;
    write(ctx, o.attempt, m, top, 15 * u, { alpha: 0.8 });
    write(ctx, o.section, m, top + 19 * u, 13.5 * u, { alpha: 0.6, color: SAND });
    const nw = write(ctx, String(o.pct), w / 2, top + 4 * u, 30 * u, { style: 'normal', figs: true, align: 'center', glow: 0.6 });
    write(ctx, '%', w / 2 + nw / 2 + 3 * u, top + 4 * u, 15 * u, { alpha: 0.8 });
    for (let i = 0; i < 3; i++) dab(ctx, w / 2 + (i - 1) * 15 * u, top + 20 * u, 3.4 * u, !!o.shards[i]);
    pauseMark(ctx, w - m - 6 * u, top - 4 * u, u);
    // the song, as a thread
    const x0 = m + 4 * u, x1 = w - m - 4 * u, y = h - (dev === 'phone' ? 40 : 30) * u, at = lerp(x0, x1, o.pct / 100);
    rule(ctx, x0, x1, y, 0.3);
    ctx.save(); ctx.strokeStyle = 'rgba(255,241,216,0.9)'; ctx.lineWidth = 1.6 * u; ctx.lineCap = 'round'; ctx.shadowColor = 'rgba(10,6,24,0.8)'; ctx.shadowBlur = 5; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(at, y); ctx.stroke(); ctx.restore();
    { const dx = lerp(x0, x1, o.drop); ctx.strokeStyle = 'rgba(255,208,106,0.9)'; ctx.lineWidth = 1.4 * u; ctx.beginPath(); ctx.moveTo(dx, y - 6 * u); ctx.lineTo(dx, y + 6 * u); ctx.stroke(); write(ctx, 'the drop', dx, y - 11 * u, 11.5 * u, { align: 'center', alpha: 0.6, color: '#ffd06a' }); }
    if (o.best) { const bx = lerp(x0, x1, o.best / 100); ctx.strokeStyle = 'rgba(255,236,206,0.7)'; ctx.lineWidth = 1.2 * u; ctx.beginPath(); ctx.arc(bx, y, 4 * u, 0, TAU); ctx.stroke(); write(ctx, 'your best', bx, y + 19 * u, 11.5 * u, { align: 'center', alpha: 0.55, color: SAND }); }
    for (const c of o.checkpoints || []) { const px = lerp(x0, x1, c); ctx.strokeStyle = 'rgba(255,236,206,0.6)'; ctx.lineWidth = 1.2 * u; ctx.beginPath(); ctx.moveTo(px, y - 4 * u); ctx.lineTo(px, y + 4 * u); ctx.stroke(); }
    if (o.from != null) { const px = lerp(x0, x1, o.from); dab(ctx, px, y, 3.2 * u, true); write(ctx, 'from here', px, y + 19 * u, 11.5 * u, { align: 'center', alpha: 0.6, color: SAND }); }
    flame(ctx, at, y + 2 * u, 0.6 * u);
  }

  // ------------------------------------------------------------------ rooms of the Lantern
  /** A wall in lamplight: dark, warm toward the light, with the brush showing. */
  function wall(ctx, w, h, seed, light, c = [255, 170, 100], a = 0.4) {
    const r = RNG(seed);
    T.sky(ctx, w, h, ROOM, r, 90);
    K.glow(ctx, light[0], light[1], light[2], c, a, 'screen');
    K.glow(ctx, light[0], light[1], light[2] * 0.4, mix(c, [255, 255, 255], 0.3), a * 0.6, 'screen');
    return r;
  }
  /** An arched window onto the dusk, with the Hollow's one small light far up in it. */
  function windowTo(ctx, x, y, ww, hh, r, hollow = true) {
    ctx.save();
    ctx.beginPath(); ctx.moveTo(x, y + hh); ctx.lineTo(x, y + ww / 2); ctx.arc(x + ww / 2, y + ww / 2, ww / 2, Math.PI, 0); ctx.lineTo(x + ww, y + hh); ctx.closePath();
    ctx.save(); ctx.clip();
    const g = ctx.createLinearGradient(0, y, 0, y + hh); for (const [t, c] of DUSKY) g.addColorStop(t, rgba(c)); ctx.fillStyle = g; ctx.fillRect(x, y, ww, hh);
    for (let i = 0; i < 26; i++) { ctx.fillStyle = `rgba(255,244,225,${0.3 + r() * 0.6})`; ctx.beginPath(); ctx.arc(x + r() * ww, y + r() * hh * 0.6, 0.6 + r() * 1.4, 0, TAU); ctx.fill(); }
    if (hollow) { blot(ctx, x + ww * 0.72, y + hh * 0.1, ww * 0.46, hh * 0.2, 0.92); K.glow(ctx, x + ww * 0.66, y + hh * 0.2, ww * 0.12, [255, 200, 130], 0.9); ctx.fillStyle = '#ffe6b0'; ctx.beginPath(); ctx.arc(x + ww * 0.66, y + hh * 0.2, 1.8, 0, TAU); ctx.fill(); }
    ctx.restore();
    ctx.strokeStyle = 'rgba(12,9,24,0.95)'; ctx.lineWidth = Math.max(4, ww * 0.05); ctx.stroke();
    ctx.lineWidth = Math.max(2, ww * 0.022); ctx.beginPath(); ctx.moveTo(x + ww / 2, y); ctx.lineTo(x + ww / 2, y + hh); ctx.moveTo(x, y + hh * 0.55); ctx.lineTo(x + ww, y + hh * 0.55); ctx.stroke();
    ctx.restore();
    K.glow(ctx, x + ww / 2, y + hh * 0.8, ww * 1.1, [248, 178, 122], 0.12, 'screen');
  }
  /** The desk's edge, its lamp, and the logbook lying open on it. */
  function desk(ctx, w, h, y, r, u, lampX) {
    const g = ctx.createLinearGradient(0, y, 0, h); g.addColorStop(0, 'rgb(46,26,36)'); g.addColorStop(1, 'rgb(14,9,20)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-10, y + 6 * u); ctx.quadraticCurveTo(w * 0.5, y - 6 * u, w + 10, y + 4 * u); ctx.lineTo(w + 10, h + 10); ctx.lineTo(-10, h + 10); ctx.closePath(); ctx.fill();
    ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.strokeStyle = 'rgba(255,190,120,0.4)'; ctx.lineWidth = 1.6 * u; ctx.beginPath(); ctx.moveTo(-10, y + 6 * u); ctx.quadraticCurveTo(w * 0.5, y - 6 * u, w + 10, y + 4 * u); ctx.stroke(); ctx.restore();
    // the lamp: a small oil lamp, its flame the warm thing in the room
    const ly = y - 2 * u;
    ctx.fillStyle = 'rgba(16,11,24,0.98)'; ctx.beginPath(); ctx.ellipse(lampX, ly, 22 * u, 7 * u, 0, 0, TAU); ctx.fill(); ctx.fillRect(lampX - 5 * u, ly - 26 * u, 10 * u, 26 * u); ctx.beginPath(); ctx.ellipse(lampX, ly - 26 * u, 13 * u, 9 * u, 0, 0, TAU); ctx.fill();
    flame(ctx, lampX, ly - 34 * u, 1.3 * u);
  }

  const S = {
    // ---- the HUD in a run, with a hint and a shard just kept
    hud1(ctx, w, h, dev) { const P = playScene(ctx, w, h, dev), u = P.u;
      hud(ctx, w, h, dev, { attempt: 'attempt 9', section: 'Emberwick · the drop', pct: 62, shards: [1, 0, 0], drop: 0.45, best: 71 });
      write(ctx, 'spring pad: tap it, and it throws you', P.cx, dev === 'phone' ? P.cy + 396 * P.k + 30 : P.cy + 362, 17 * u, { align: 'center', alpha: 0.92 });
      write(ctx, 'a shard, kept', P.cx, (dev === 'phone' ? 62 : 44) * u + 44 * u, 14.5 * u, { align: 'center', alpha: 0.85, color: '#ffe6a8' }); },
    // ---- a practice run, just after a near miss
    hud2(ctx, w, h, dev) { const P = playScene(ctx, w, h, dev, 64), u = P.u;
      hud(ctx, w, h, dev, { attempt: 'practice', section: 'Emberwick · the drop', pct: 48, shards: [0, 0, 0], drop: 0.45, checkpoints: [0.11, 0.22, 0.28, 0.45, 0.56, 0.67, 0.78, 0.89], from: 0.28 });
      const [sx, sy, al] = dev === 'phone' ? [P.cx, P.cy - 372 * P.k - 20, 'center'] : [30 * u, h * 0.5, 'left'];
      write(ctx, 'so close: 87%', sx, sy, 30 * u, { align: al, glow: 0.8 });
      write(ctx, 'again, from the build-up', sx, sy + 26 * u, 15 * u, { align: al, alpha: 0.75, color: SAND }); },
    // ---- pause, in the middle of a level: the scene dims and holds its breath
    pause(ctx, w, h, dev) {
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      const P = playScene(cv.getContext('2d'), w, h, dev), u = P.u;
      hud(cv.getContext('2d'), w, h, dev, { attempt: 'attempt 9', section: 'Emberwick · the drop', pct: 62, shards: [1, 0, 0], drop: 0.45, best: 71 });
      ctx.filter = `blur(${2.4 * u}px) saturate(0.55)`; ctx.drawImage(cv, 0, 0); ctx.filter = 'none';
      ctx.fillStyle = 'rgba(8,6,24,0.62)'; ctx.fillRect(0, 0, w, h);
      const x = dev === 'phone' ? w * 0.12 : w * 0.1; let y = dev === 'phone' ? h * 0.27 : h * 0.26;
      write(ctx, 'held at 62%', x, y, 15 * u, { alpha: 0.7, color: SAND }); y += 62 * u;
      write(ctx, 'Resume', x, y, 58 * u, { glow: 1 }); y += 54 * u;
      for (const s of ['Restart', 'Practise from here', 'Practise the build-up and drop', 'Settings']) { write(ctx, s, x, y, 25 * u, { alpha: 0.86 }); y += 43 * u; }
      y += 8 * u; write(ctx, 'Leave for the galaxy', x, y, 25 * u, { alpha: 0.62 }); y += 54 * u;
      rule(ctx, x, x + (dev === 'phone' ? w * 0.7 : w * 0.3), y - 24 * u, 0.2);
      write(ctx, 'Your taps sit about 30 ms late.', x, y, 15.5 * u, { alpha: 0.78, color: SAND }); y += 24 * u;
      write(ctx, 'set it right   ·   tap along with Marlow', x, y, 15.5 * u, { alpha: 0.95 }); }

  };
  // ------------------------------------------------------------------ the rooms themselves, without their words
  // What the game paints once and keeps behind the live things (flames, taps, constellations) and the writing.
  // Each takes the picture's size, 'phone' or 'desktop', and u: how many pixels one point of the layout is.
  const unit = (w, h, dev) => (dev === 'phone' ? Math.min(w / 390, h / 844) : Math.min(w / 1440, h / 900) * 1.15);
  const starsFor = (w, h, dev, u, k = 1) => Math.round((w * h * k) / ((dev === 'phone' ? 470 : 1400) * u * u));
  /** Soft paint without a blur filter (not every browser has one): drawn small, laid back large. */
  function soft(ctx, w, h, px, draw, op = 'source-over') {
    const k = Math.max(2, px * 1.6), cv = document.createElement('canvas');
    cv.width = Math.ceil(w / k); cv.height = Math.ceil(h / k);
    const c = cv.getContext('2d'); c.scale(1 / k, 1 / k); draw(c);
    ctx.save(); ctx.globalCompositeOperation = op; ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(cv, 0, 0, cv.width * k, cv.height * k); ctx.restore();
  }
  /** A dark, soft-edged blot: the Hollow, far off. */
  function blot(ctx, x, y, rx, ry, a = 0.95) {
    ctx.save(); ctx.translate(x, y); ctx.scale(1, ry / rx);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx); g.addColorStop(0, `rgba(4,4,12,${a})`); g.addColorStop(0.55, `rgba(4,4,12,${a * 0.85})`); g.addColorStop(1, 'rgba(4,4,12,0)');
    ctx.fillStyle = g; ctx.fillRect(-rx, -rx, rx * 2, rx * 2); ctx.restore();
  }
  const SHAPES = { heroes: [[0, 0.9], [0.5, 0.2], [1, 0.8], [1.6, 0.1], [2.1, 0.7]], skyhigh: [[0, 0.2], [0.6, 0.8], [1.1, 0.1], [1.7, 0.7], [2.2, 0]], blank: [[0, 0.5], [0.6, 0], [1.2, 0.5], [0.6, 1], [0.6, 0.5]], invincible: [[0.5, 1], [0.5, 0.4], [0, 0], [1, 0], [0.5, -0.4]], royalty: [[0, 0], [0.7, 0.5], [1.4, 0]], ambush: [[0, 0], [0.7, 0.3]] };
  /** Where the star chart puts things: the chosen constellation large, its lines, and five places for the others. */
  const galleryLay = (w, h, dev, u) => (dev === 'phone'
    ? { big: [w * 0.12, h * 0.185, 130 * u], lines: [w * 0.09, h * 0.345], slots: [[w * 0.08, h * 0.63, 46 * u], [w * 0.42, h * 0.635, 46 * u], [w * 0.72, h * 0.645, 46 * u], [w * 0.14, h * 0.785, 54 * u], [w * 0.52, h * 0.78, 50 * u]] }
    : { big: [w * 0.08, h * 0.3, 130 * u], lines: [w * 0.36, h * 0.3], slots: [[w * 0.66, h * 0.18, 64 * u], [w * 0.84, h * 0.3, 64 * u], [w * 0.68, h * 0.5, 64 * u], [w * 0.86, h * 0.56, 60 * u], [w * 0.76, h * 0.7, 54 * u]] });
  /** One constellation: its lines, and a dab for each star, lit or not. `lit` is a count or one flag per star. */
  function constellation(ctx, pts, lit, sc, ox, oy, u, a = 1, tw = null) {
    ctx.strokeStyle = `rgba(255,236,206,${0.34 * a})`; ctx.lineWidth = 1.1 * u; ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(ox + x * sc, oy + y * sc) : ctx.moveTo(ox + x * sc, oy + y * sc))); ctx.stroke();
    pts.forEach(([x, y], i) => { const on = Array.isArray(lit) ? !!lit[i] : i < lit; dab(ctx, ox + x * sc, oy + y * sc, (on ? 4.2 : 3.2) * u * Math.min(1, sc / (60 * u) + 0.4) * (on && tw ? tw(i) : 1), on); });
  }
  const ROOMS = {
    /** Marlow's desk: the wall in lamplight, the window onto the dusk, the desk's edge and its lamp. */
    desk(ctx, w, h, dev, u) {
      const dy = h - (dev === 'phone' ? 70 : 76) * u, lampX = dev === 'phone' ? w * 0.84 : w * 0.9, r = wall(ctx, w, h, 201, [lampX, dy - 40 * u, 520 * u]);
      if (dev === 'phone') windowTo(ctx, w - 100 * u, 34 * u, 68 * u, 108 * u, r); else windowTo(ctx, w * 0.8, 70 * u, 150 * u, 250 * u, r);
      desk(ctx, w, h, dy, r, u, lampX);
      T.finish(ctx, w, h, 211, 0.55);
      return { dy, lampX };
    },
    /** The lamp room: the great glass, the dark beyond it, and far up under the Hollow, Marlow's one small light. */
    lamp(ctx, w, h, dev, u) {
      const r = RNG(221);
      T.sky(ctx, w, h, DUSKY.map(([t, c]) => [t, mix(c, [8, 8, 26], 0.45)]), r, 130); T.stars(ctx, w, h * 0.8, r, starsFor(w, h, dev, u), 5);
      const hx = dev === 'phone' ? w * 0.74 : w * 0.8, hy = dev === 'phone' ? h * 0.1 : h * 0.14, gx = dev === 'phone' ? w * 0.5 : w * 0.62, gy = dev === 'phone' ? h * 0.42 : h * 0.5;
      blot(ctx, hx + 30 * u, hy - 40 * u, 190 * u, 92 * u);
      K.glow(ctx, hx, hy, 40 * u, [255, 200, 130], 0.8); ctx.fillStyle = '#ffe6b0'; ctx.beginPath(); ctx.arc(hx, hy, 2.6 * u, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(10,8,22,0.9)'; ctx.lineWidth = 5 * u; for (const fx of dev === 'phone' ? [0.04, 0.35, 0.66, 0.97] : [0.04, 0.27, 0.5, 0.73, 0.96]) { ctx.beginPath(); ctx.moveTo(w * fx, -10); ctx.lineTo(w * fx, h); ctx.stroke(); }
      ctx.fillStyle = 'rgb(12,9,22)'; ctx.fillRect(0, h * 0.9, w, h * 0.1); K.glow(ctx, w * 0.5, h * 0.9, 300 * u, [255, 190, 120], 0.12, 'screen');
      T.finish(ctx, w, h, 231, 0.55);
      return { hx, hy, gx, gy };
    },
    /** By the hearth: the fire in its arch of stone, the mantel over it, and a second shelf above for more flames. */
    hearth(ctx, w, h, dev, u) {
      const fx = dev === 'phone' ? w * 0.5 : w * 0.68, fy = dev === 'phone' ? h * 0.84 : h * 0.82, fw = (dev === 'phone' ? 118 : 190) * u;
      const r = wall(ctx, w, h, 241, [fx, fy - 40 * u, 620 * u], [255, 150, 80], 0.5);
      ctx.fillStyle = 'rgb(12,9,20)'; ctx.beginPath(); ctx.moveTo(fx - fw - 40 * u, h + 10); ctx.lineTo(fx - fw - 40 * u, fy - fw * 1.1); ctx.lineTo(fx + fw + 40 * u, fy - fw * 1.1); ctx.lineTo(fx + fw + 40 * u, h + 10); ctx.closePath(); ctx.fill();
      const arch = () => { ctx.beginPath(); ctx.moveTo(fx - fw, h + 10); ctx.lineTo(fx - fw, fy - fw * 0.3); ctx.arc(fx, fy - fw * 0.3, fw, Math.PI, 0); ctx.lineTo(fx + fw, h + 10); ctx.closePath(); };
      ctx.save(); arch();
      const g = ctx.createRadialGradient(fx, fy + 20 * u, 10, fx, fy, fw * 1.5); g.addColorStop(0, 'rgb(150,60,40)'); g.addColorStop(0.4, 'rgb(84,30,30)'); g.addColorStop(1, 'rgb(20,10,18)'); ctx.fillStyle = g; ctx.fill(); ctx.clip();
      // logs, then the fire itself: many soft tongues laid over each other, hot at the heart
      ctx.strokeStyle = 'rgb(22,12,16)'; ctx.lineCap = 'round'; ctx.lineWidth = 18 * u; ctx.beginPath(); ctx.moveTo(fx - fw * 0.6, fy + 44 * u); ctx.lineTo(fx + fw * 0.5, fy + 20 * u); ctx.moveTo(fx - fw * 0.45, fy + 18 * u); ctx.lineTo(fx + fw * 0.62, fy + 46 * u); ctx.stroke();
      soft(ctx, w, h, 7 * u, (c) => {
        c.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 26; i++) {
          const bx = fx + (r() - 0.5) * fw * 1.1, k = 1 - Math.abs(bx - fx) / (fw * 0.75), hh = fw * (0.35 + r() * 0.75) * Math.max(0.25, k), wd = (10 + r() * 16) * u, lean = (r() - 0.5) * 30 * u;
          c.fillStyle = rgba(i % 3 === 0 ? [255, 226, 160] : i % 3 === 1 ? [255, 150, 70] : [230, 80, 50], 0.22);
          c.beginPath(); c.moveTo(bx - wd, fy + 34 * u); c.bezierCurveTo(bx - wd * 1.3, fy - hh * 0.4, bx + lean - wd * 0.2, fy - hh * 0.8, bx + lean, fy - hh); c.bezierCurveTo(bx + lean + wd * 0.4, fy - hh * 0.7, bx + wd * 1.3, fy - hh * 0.35, bx + wd, fy + 34 * u); c.closePath(); c.fill();
        }
      }, 'lighter');
      K.glow(ctx, fx, fy + 10 * u, fw * 0.8, [255, 236, 190], 0.5);
      for (let i = 0; i < 22; i++) { ctx.fillStyle = rgba([255, 200 + r() * 40, 130], 0.3 + r() * 0.6); ctx.beginPath(); ctx.arc(fx + (r() - 0.5) * fw * 1.3, fy - r() * fw * 1.1, (0.8 + r() * 1.6) * u, 0, TAU); ctx.fill(); }
      ctx.restore();
      ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.strokeStyle = 'rgba(255,170,100,0.5)'; ctx.lineWidth = 2 * u; ctx.beginPath(); ctx.moveTo(fx - fw, h + 10); ctx.lineTo(fx - fw, fy - fw * 0.3); ctx.arc(fx, fy - fw * 0.3, fw, Math.PI, 0); ctx.lineTo(fx + fw, h + 10); ctx.stroke(); ctx.restore(); // the arch's edge catches the light
      // the mantel, and a narrower shelf above it: a flame stands on them for each of Eko's glows
      const my = fy - fw * 1.1, mx0 = dev === 'phone' ? w * 0.05 : fx - fw - 54 * u, mx1 = dev === 'phone' ? w * 0.95 : fx + fw + 54 * u, sy = my - 70 * u, sx0 = mx0 + 14 * u, sx1 = mx1 - 14 * u;
      const plank = (x0, x1, y, t) => { ctx.fillStyle = 'rgb(20,14,28)'; ctx.fillRect(x0, y - t * 0.75, x1 - x0, t); ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.strokeStyle = 'rgba(255,190,120,0.45)'; ctx.lineWidth = 1.4 * u; ctx.beginPath(); ctx.moveTo(x0, y - t * 0.75); ctx.lineTo(x1, y - t * 0.75); ctx.stroke(); ctx.restore(); };
      plank(mx0, mx1, my, 12 * u); plank(sx0, sx1, sy, 7 * u);
      T.finish(ctx, w, h, 251, 0.55);
      return { fx, fy, fw, shelves: [[mx0 + 16 * u, mx1 - 16 * u, my - 10 * u], [sx0 + 16 * u, sx1 - 16 * u, sy - 6.5 * u]], eko: dev === 'phone' ? [w * 0.74, h * 0.37, 0.46 * u] : [w * 0.38, h * 0.6, 0.6 * u] };
    },
    /** The gallery rail, and the whole sky over it. */
    gallery(ctx, w, h, dev, u) {
      const r = RNG(261);
      T.sky(ctx, w, h, DUSKY.map(([t, c]) => [t, mix(c, [10, 10, 30], 0.3)]), r, 150); T.stars(ctx, w, h * 0.86, r, starsFor(w, h, dev, u, 1.3), 6);
      const ry = h * 0.9; ctx.fillStyle = 'rgb(12,9,22)'; ctx.fillRect(0, ry, w, h - ry); ctx.fillRect(0, ry - 10 * u, w, 5 * u);
      for (let x = 14 * u; x < w; x += 30 * u) ctx.fillRect(x, ry - 8 * u, 3 * u, 12 * u);
      T.finish(ctx, w, h, 271, 0.5);
      return galleryLay(w, h, dev, u);
    },
    /** The last page of the logbook, lying in lamplight. Returns where the sheet is, to write on it. */
    page(ctx, w, h, dev, u) {
      wall(ctx, w, h, 281, [w * (dev === 'phone' ? 0.9 : 0.94), h * 0.1, 700 * u], [255, 180, 110], 0.5);
      const px = dev === 'phone' ? w * 0.06 : w * 0.2, py = (dev === 'phone' ? 100 : 76) * u, pw = dev === 'phone' ? w * 0.88 : w * 0.6, ph = h - py - (dev === 'phone' ? 60 : 50) * u;
      ctx.save(); ctx.translate(px + pw / 2, py + ph / 2); ctx.rotate(-0.012); ctx.translate(-pw / 2, -ph / 2);
      ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 40 * u; ctx.shadowOffsetY = 10 * u;
      const g = ctx.createRadialGradient(pw * 0.95, 0, 20, pw * 0.6, ph * 0.4, Math.hypot(pw, ph)); g.addColorStop(0, 'rgb(238,214,170)'); g.addColorStop(0.5, 'rgb(200,168,128)'); g.addColorStop(1, 'rgb(116,86,80)');
      const sheet = () => { ctx.beginPath(); ctx.moveTo(1.5 * u, 0); ctx.lineTo(pw * 0.5, -1.5 * u); ctx.lineTo(pw, 1 * u); ctx.lineTo(pw + 1.5 * u, ph * 0.5); ctx.lineTo(pw - 1 * u, ph); ctx.lineTo(pw * 0.4, ph + 1.5 * u); ctx.lineTo(0, ph - 1 * u); ctx.lineTo(-1.5 * u, ph * 0.5); ctx.closePath(); };
      sheet(); ctx.fillStyle = g; ctx.fill(); ctx.shadowColor = 'transparent';
      ctx.save(); sheet(); ctx.clip(); K.lay(ctx, K.texture(Math.ceil(pw), Math.ceil(ph), 291, { fine: 0.5, mottle: 0.6, scale: 0.004, fibres: 700 }), 'multiply', 0.5); ctx.restore();
      ctx.restore();
      T.finish(ctx, w, h, 301, 0.5);
      return { px, py, pw, ph, rot: -0.012, ix: pw * 0.09 };
    }
  };
  /** Eko wearing a glow: his hoop and the light round him take its colour. */
  function ekoIn(ctx, x, y, s, r, c, o = {}) {
    T.eko(ctx, x, y, s, r, o);
    K.glow(ctx, x, y - 10 * s, 150 * s, c, 0.34, 'screen');
    ctx.save(); ctx.translate(x, y + 16 * s); ctx.rotate(-0.3); ctx.lineWidth = Math.max(1.2, 3.2 * s); ctx.lineCap = 'round'; ctx.shadowColor = rgba(c, 0.9); ctx.shadowBlur = 12 * s;
    ctx.strokeStyle = rgba(mix(c, [255, 255, 255], 0.25), 0.95); ctx.beginPath(); ctx.ellipse(0, 0, 78 * s, 22 * s, 0, 0.15, Math.PI - 0.15); ctx.stroke();
    ctx.restore();
  }

  Object.assign(S, {
    // ---- settings: a page of rows at Marlow's desk
    settings(ctx, w, h, dev) { const u = unit(w, h, dev), { dy } = ROOMS.desk(ctx, w, h, dev, u);
      const x0 = dev === 'phone' ? w * 0.09 : w * 0.07;
      back(ctx, x0, (dev === 'phone' ? 64 : 46) * u, 15 * u, 'out to the galaxy', u);
      write(ctx, 'Marlow’s desk', x0, (dev === 'phone' ? 122 : 108) * u, 44 * u, { glow: 0.8 });
      const cols = dev === 'phone' ? [[x0, w * 0.91]] : [[x0, w * 0.36], [w * 0.42, w * 0.72]];
      const sl = (x1) => (v) => (yy) => slider(ctx, x1 - 150 * u, x1, yy, v, u);
      const tg = (x1, on) => (yy) => toggle(ctx, x1 - 12 * u, yy - 2 * u, on, u);
      const step = (x1, val) => (yy) => { write(ctx, 'earlier', x1 - 150 * u, yy + 6 * u, 14 * u, { alpha: 0.6, color: SAND }); write(ctx, val, x1 - 70 * u, yy + 6 * u, 19 * u, { align: 'center', style: 'normal', figs: true }); write(ctx, 'later', x1, yy + 6 * u, 14 * u, { align: 'right', alpha: 0.6, color: SAND }); };
      let [a, b] = cols[0], y = (dev === 'phone' ? 176 : 170) * u;
      y = head(ctx, 'sound', a, y, u);
      y = row(ctx, a, b, y, 'Music', u, sl(b)(0.8)); y = row(ctx, a, b, y, 'Effects', u, sl(b)(0.6)); y = row(ctx, a, b, y, 'Tap sounds', u, sl(b)(0.45));
      y += 12 * u; y = head(ctx, 'keeping time', a, y, u);
      y = row(ctx, a, b, y, 'The sound arrives', u, step(b, '0 ms'), 'later, if on-time taps read late (wireless ears add 150 to 250)');
      y = row(ctx, a, b, y, 'The picture arrives', u, step(b, '0 ms'), 'later, if Eko looks behind the music');
      y = row(ctx, a, b, y, 'Tap along with Marlow', u, (yy) => write(ctx, 'ten seconds', b, yy + 6 * u, 14 * u, { align: 'right', alpha: 0.6, color: SAND }));
      if (dev !== 'phone') { [a, b] = cols[1]; y = 170 * u; } else y += 12 * u;
      y = head(ctx, 'lights', a, y, u);
      y = row(ctx, a, b, y, 'Calmer motion', u, tg(b, false)); y = row(ctx, a, b, y, 'A pulse in the hand on a hit', u, tg(b, true));
      if (dev !== 'phone') {
        y = row(ctx, a, b, y, 'Show my timing as I play', u, tg(b, false)); y = row(ctx, a, b, y, 'Game Center', u, tg(b, true));
        y += 12 * u; y = head(ctx, 'the logbook', a, y, u);
        for (const s of ['The story so far', 'The first flight, again', 'The last page: who made the music']) y = row(ctx, a, b, y, s, u);
        y += 12 * u; y = head(ctx, 'for testing', a, y, u);
        y = row(ctx, a, b, y, 'Every planet open', u, tg(b, false)); y = row(ctx, a, b, y, 'Watch a perfect run', u);
      } else { // a phone shows what fits; the page goes on under the desk's edge
        write(ctx, 'the page goes on below: more lights, the logbook, testing', a, dy - 22 * u, 13.5 * u, { alpha: 0.6, color: SAND });
      } },

    // ---- the sync check: Marlow taps the glass, and you tap along
    sync(ctx, w, h, dev) { const u = unit(w, h, dev), r = RNG(222), { hx, hy, gx, gy } = ROOMS.lamp(ctx, w, h, dev, u);
      // four taps on their way down the dark, and the rings where they land on the glass
      for (let i = 1; i <= 4; i++) { const t = i / 5; dab(ctx, lerp(hx, gx, t), lerp(hy, gy, t), (1.6 + t * 1.6) * u, true); }
      ctx.save(); ctx.globalCompositeOperation = 'screen'; for (let i = 0; i < 4; i++) { ctx.strokeStyle = `rgba(255,226,170,${0.6 - i * 0.14})`; ctx.lineWidth = (2.6 - i * 0.4) * u; ctx.beginPath(); ctx.arc(gx, gy, (20 + i * 26) * u, 0, TAU); ctx.stroke(); } ctx.restore();
      K.glow(ctx, gx, gy, 120 * u, [255, 214, 150], 0.3); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(gx, gy, 5 * u, 0, TAU); ctx.fill();
      const x0 = dev === 'phone' ? w * 0.09 : w * 0.07; let y = (dev === 'phone' ? 64 : 46) * u;
      back(ctx, x0, y, 15 * u, 'back to the desk', u);
      y = dev === 'phone' ? h * 0.6 : h * 0.34;
      write(ctx, 'Marlow taps the glass.', x0, y, 34 * u, { glow: 0.7 }); y += 34 * u;
      write(ctx, 'Tap along with him.', x0, y, 22 * u, { alpha: 0.85 }); y += 58 * u;
      let cx = x0; for (const [s, on] of [['one', 0], ['two', 0], ['three', 1], ['four', 0]]) { cx += write(ctx, s, cx, y, on ? 40 * u : 30 * u, { alpha: on ? 1 : 0.5, glow: on ? 1 : 0 }) + 26 * u; } y += 56 * u;
      // your taps so far, set down against his: left of the mark is early, right is late
      const tx0 = x0, tx1 = x0 + (dev === 'phone' ? w * 0.8 : w * 0.36), mid = (tx0 + tx1) / 2;
      rule(ctx, tx0, tx1, y, 0.3); ctx.strokeStyle = 'rgba(255,241,216,0.8)'; ctx.lineWidth = 1.5 * u; ctx.beginPath(); ctx.moveTo(mid, y - 9 * u); ctx.lineTo(mid, y + 9 * u); ctx.stroke();
      for (const d of [12, 34, 20, 46, 27, 31, 8, 39, 24]) dab(ctx, mid + d * 2.4 * u, y + (r() - 0.5) * 8 * u, 2.6 * u, true);
      write(ctx, 'early', tx0, y + 24 * u, 12.5 * u, { alpha: 0.55, color: SAND }); write(ctx, 'late', tx1, y + 24 * u, 12.5 * u, { align: 'right', alpha: 0.55, color: SAND }); write(ctx, 'him', mid, y - 16 * u, 12.5 * u, { align: 'center', alpha: 0.7 });
      y += 62 * u; write(ctx, 'You are about 28 ms behind him.', x0, y, 19 * u, { alpha: 0.95 }); y += 30 * u;
      write(ctx, 'set it right   ·   once more   ·   leave it', x0, y, 17 * u, { alpha: 0.92 });
      write(ctx, 'by ear first, then by eye', x0, y + 30 * u, 13.5 * u, { alpha: 0.55, color: SAND }); },

    // ---- Glows: Eko's trims, as flames along the mantel and the shelf over it
    glows(ctx, w, h, dev) { const u = unit(w, h, dev), r = RNG(242), G = ROOMS.hearth(ctx, w, h, dev, u);
      const TRIMS = [[255, 226, 170], [255, 150, 90], [190, 120, 255], [225, 240, 255], [160, 255, 70], [255, 214, 90], [255, 90, 160], [255, 255, 255], [255, 120, 110], [255, 90, 240], [90, 160, 255], [90, 255, 190], [255, 176, 40], [130, 110, 255], [200, 205, 220], [255, 60, 90]];
      TRIMS.forEach((c, i) => { const [a, b, yy] = G.shelves[i < 8 ? 0 : 1], x = lerp(a, b, (i % 8) / 7), on = i < 5 || i === 6; flame(ctx, x, yy, 1.05 * u, c, on ? 1 : 0); if (i === 1) { ctx.strokeStyle = 'rgba(255,241,216,0.8)'; ctx.lineWidth = 1.2 * u; ctx.beginPath(); ctx.arc(x, yy - 13 * u, 21 * u, 0, TAU); ctx.stroke(); } });
      ekoIn(ctx, G.eko[0], G.eko[1], G.eko[2], r, TRIMS[1], { wisp: true, lean: 0.2 });
      const x0 = dev === 'phone' ? w * 0.09 : w * 0.07; let y = (dev === 'phone' ? 64 : 46) * u;
      back(ctx, x0, y, 15 * u, 'out to the galaxy', u);
      y = (dev === 'phone' ? 122 : 108) * u; write(ctx, 'By the hearth', x0, y, 44 * u, { glow: 0.8 }); y += 26 * u;
      write(ctx, 'Eko’s glows', x0, y, 15 * u, { alpha: 0.7, color: SAND }); y += (dev === 'phone' ? 110 : 90) * u;
      write(ctx, 'Ember', x0, y, 40 * u, { glow: 0.6 }); y += 28 * u;
      write(ctx, 'a coal from Ossa’s forge', x0, y, 18 * u, { alpha: 0.9 }); y += 24 * u;
      write(ctx, 'worn now', x0, y, 15 * u, { alpha: 0.65, color: SAND }); y += 46 * u;
      write(ctx, 'six lit, ten still dark', x0, y, 15 * u, { alpha: 0.65, color: SAND }); y += 22 * u;
      write(ctx, 'touch a flame to wear it; touch a wick to see what lights it', x0, y, 14 * u, { alpha: 0.55, color: SAND }); },

    // ---- the star chart, from the gallery rail
    stars(ctx, w, h, dev) { const u = unit(w, h, dev), P = ROOMS.gallery(ctx, w, h, dev, u);
      constellation(ctx, SHAPES.heroes, 2, P.big[2], P.big[0], P.big[1], u);
      const lab = (name, n, of, x, y) => { write(ctx, name, x, y, 19 * u, { alpha: 0.85 }); write(ctx, `${n} of ${of}`, x, y + 18 * u, 13 * u, { alpha: 0.55, color: SAND }); };
      const [c1, c2, c3, c4, c5] = P.slots;
      constellation(ctx, SHAPES.skyhigh, 1, c1[2], c1[0], c1[1], u); lab('Cirra', 1, 5, c1[0], c1[1] + c1[2] * 0.8 + 34 * u);
      constellation(ctx, SHAPES.blank, 0, c2[2], c2[0], c2[1], u, 0.6); lab('Glassmere', 0, 5, c2[0], c2[1] + c2[2] + 34 * u);
      constellation(ctx, SHAPES.invincible, 0, c3[2], c3[0], c3[1], u, 0.6); lab('Verdance', 0, 5, c3[0], c3[1] + c3[2] + 34 * u);
      constellation(ctx, SHAPES.ambush, 1, c4[2], c4[0], c4[1], u); lab('the ambush', 1, 2, c4[0], c4[1] + 46 * u);
      constellation(ctx, SHAPES.royalty, 0, c5[2], c5[0], c5[1], u, 0.5); lab('the Hollow', 0, 3, c5[0], c5[1] + 46 * u);
      const x0 = dev === 'phone' ? w * 0.09 : w * 0.07; let y = (dev === 'phone' ? 64 : 46) * u;
      back(ctx, x0, y, 15 * u, 'out to the galaxy', u);
      y = (dev === 'phone' ? 122 : 108) * u; write(ctx, 'The star chart', x0, y, 44 * u, { glow: 0.8 });
      write(ctx, '5 of 26 lit   ·   the Hollow opens at 7', x0, y + 26 * u, 15 * u, { alpha: 0.7, color: SAND });
      // the chosen constellation's five stars, each with its one line
      let [lx, ly] = P.lines; write(ctx, 'Emberwick', lx, ly, 30 * u, { glow: 0.5 }); ly += 40 * u;
      for (const [name, what, on] of [['Restore', 'bring its song home', 1], ['Shard run', 'all three shards in one flight', 1], ['Daredevil', 'one attempt: a fall sends you home', 0], ['Rhythm master', 'touch every gold note', 0], ['Night side', 'clear its far side', 0]]) {
        dab(ctx, lx + 6 * u, ly - 6 * u, 4 * u, !!on);
        const nw = write(ctx, name, lx + 24 * u, ly, 20 * u, { alpha: on ? 1 : 0.6 });
        write(ctx, what, lx + 24 * u + nw + 12 * u, ly, 15 * u, { alpha: on ? 0.75 : 0.5, color: SAND });
        ly += 34 * u;
      } },

    // ---- credits: the last page of the logbook
    credits(ctx, w, h, dev) { const u = unit(w, h, dev), G = ROOMS.page(ctx, w, h, dev, u), { pw, ph, ix } = G;
      ctx.save(); ctx.translate(G.px + pw / 2, G.py + ph / 2); ctx.rotate(G.rot); ctx.translate(-pw / 2, -ph / 2);
      const INK = [44, 28, 40]; let y = (dev === 'phone' ? 64 : 62) * u;
      const ink = (s, px2, a = 0.92, o = {}) => write(ctx, s, o.x != null ? o.x : ix, y, px2, { color: rgba(INK, 1), alpha: a, ink: true, ...o });
      ink('The last page', 38 * u); y += 20 * u; rule(ctx, ix, pw - ix, y, 0.35, INK); y += 40 * u;
      ink('the songs, and who made them', 15 * u, 0.7); y += 40 * u;
      for (const [song, by] of [['Heroes Tonight (feat. Johnning)', 'Janji'], ['Sky High', 'Elektronomia'], ['Blank', 'Disfigure'], ['Invincible', 'DEAF KEV'], ['Royalty', 'Egzod, Maestro Chives, Neoni']]) {
        ink(song, 22 * u); y += 24 * u; ink(`${by}   ·   NCS Release`, 15.5 * u, 0.72); y += 36 * u;
      }
      ink('Music provided by NoCopyrightSounds.', 17 * u, 0.9); y += 44 * u;
      ink('The Lantern’s lullaby was written for this game.', 17 * u, 0.9); y += 54 * u;
      rule(ctx, ix, pw - ix, y - 26 * u, 0.3, INK);
      ink('ONE MORE ORBIT keeps no record of you.', 15.5 * u, 0.75); y += 24 * u; ink('the privacy note', 15.5 * u, 0.95);
      ctx.restore();
      back(ctx, dev === 'phone' ? w * 0.09 : w * 0.07, (dev === 'phone' ? 64 : 46) * u, 15 * u, 'back to the desk', u); },

    // ---- the components, once
    parts(ctx, w, h) { const u = 1.15, r = wall(ctx, w, h, 311, [w * 0.9, h * 0.1, 600 * u]); T.finish(ctx, w, h, 321, 0.5);
      const col = [w * 0.06, w * 0.38, w * 0.7]; const cap = (s, x, y) => write(ctx, s, x, y, 13 * u, { alpha: 0.6, color: SAND });
      write(ctx, 'The Afterglow interface, defined once', col[0], 70 * u, 34 * u, { glow: 0.6 });
      let y = 150 * u;
      cap('primary action: the brightest line on the screen', col[0], y); write(ctx, 'Resume', col[0], y + 54 * u, 50 * u, { glow: 1 });
      cap('action: a line of words; the whole line is the target', col[1], y); write(ctx, 'Practise from here', col[1], y + 40 * u, 25 * u, { alpha: 0.86 });
      cap('quiet action: leaving, or less likely', col[2], y); write(ctx, 'Leave for the galaxy', col[2], y + 40 * u, 25 * u, { alpha: 0.6 });
      y += 130 * u;
      cap('slider: a thread, a flame for its handle', col[0], y); slider(ctx, col[0], col[0] + 230 * u, y + 44 * u, 0.62, u);
      cap('toggle: a light, lit or unlit', col[1], y); toggle(ctx, col[1] + 14 * u, y + 36 * u, true, u); write(ctx, 'lit', col[1] + 36 * u, y + 46 * u, 16 * u, { alpha: 0.8 }); toggle(ctx, col[1] + 120 * u, y + 36 * u, false, u); write(ctx, 'unlit', col[1] + 142 * u, y + 46 * u, 16 * u, { alpha: 0.6 });
      cap('stepper: two words either side of the value', col[2], y); write(ctx, 'earlier', col[2], y + 46 * u, 15 * u, { alpha: 0.6, color: SAND }); write(ctx, '+30 ms', col[2] + 100 * u, y + 46 * u, 21 * u, { align: 'center', style: 'normal', figs: true }); write(ctx, 'later', col[2] + 150 * u, y + 46 * u, 15 * u, { alpha: 0.6, color: SAND });
      y += 120 * u;
      cap('the way back: an arrow in ink, and where it leads', col[0], y); back(ctx, col[0], y + 38 * u, 16 * u, 'out to the galaxy', u);
      cap('a row: words, a hairline, what it holds', col[1], y); row(ctx, col[1], col[1] + 300 * u, y + 44 * u, 'Music', u, (yy) => slider(ctx, col[1] + 170 * u, col[1] + 300 * u, yy, 0.8, u));
      cap('pause, and a shard kept or still to find', col[2], y); pauseMark(ctx, col[2] + 10 * u, y + 40 * u, u); dab(ctx, col[2] + 70 * u, y + 40 * u, 4.4 * u, true); dab(ctx, col[2] + 92 * u, y + 40 * u, 4.4 * u, false);
      y += 120 * u;
      cap('the song as a thread: where you are, the drop, your best', col[0], y); { const a = col[0], b = col[0] + 340 * u, yy = y + 40 * u; rule(ctx, a, b, yy, 0.3); ctx.strokeStyle = 'rgba(255,241,216,0.9)'; ctx.lineWidth = 1.6 * u; ctx.beginPath(); ctx.moveTo(a, yy); ctx.lineTo(lerp(a, b, 0.6), yy); ctx.stroke(); ctx.strokeStyle = 'rgba(255,208,106,0.9)'; ctx.beginPath(); ctx.moveTo(lerp(a, b, 0.45), yy - 6 * u); ctx.lineTo(lerp(a, b, 0.45), yy + 6 * u); ctx.stroke(); ctx.strokeStyle = 'rgba(255,236,206,0.7)'; ctx.beginPath(); ctx.arc(lerp(a, b, 0.72), yy, 4 * u, 0, TAU); ctx.stroke(); flame(ctx, lerp(a, b, 0.6), yy + 2 * u, 0.6 * u); }
      cap('a popup: one line, where you are looking', col[1] + 60 * u, y); write(ctx, 'so close: 87%', col[1] + 60 * u, y + 46 * u, 28 * u, { glow: 0.7 });
      cap('numbers: the same face, lining figures', col[2], y); write(ctx, '62', col[2], y + 50 * u, 40 * u, { style: 'normal', figs: true }); write(ctx, '%', col[2] + 44 * u, y + 50 * u, 18 * u, { alpha: 0.8 });
      y += 110 * u;
      write(ctx, 'Every target is at least 44 points tall, however small the words. White on the play field still means only “tap here”.', col[0], y + 20 * u, 15 * u, { alpha: 0.7, color: SAND }); }
  });
  return { S, ROOMS, SHAPES, C: { write, rule, flame, slider, toggle, back, pauseMark, dab, constellation, ekoIn, soft }, unit, galleryLay, draw: (ctx, w, h, name, dev) => S[name](ctx, w, h, dev) };
})();
export { UI };
