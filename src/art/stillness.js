// The Stillness, redesigned (the owner's brief of 2026-11-26: "it has to look deliberate and powerful"). Canon: a dark with
// nothing in it, a broken rim that never repeats, whatever it reaches held mid-motion and doubled as if the picture
// skipped, the music stuttering near it. Three concepts were made (mockups/art/stillness.html); B, the ink tide, is the
// one in the game, with A's skip as its signature: drawn live every frame (no cached picture, no blur filters).
//   A  the erasure: a void that cuts the world away, its stepped edge glitching and doubling
//   B  the ink tide: a viscous dark with a rim that never repeats, curling tendrils with follow-through, grasping forms
//      half-seen inside; every so often it skips (holds a frame and leaves a pale double of where it was)
//   C  the crust: silence made visible, colour and motion freezing outward in a spreading crust of cracks
// Everything is driven by layered noise sampled at incommensurate speeds, so nothing ever loops.
import { K } from './painter.js';

const TAU = Math.PI * 2;
const N1 = K.noise2(97), N2 = K.noise2(131), N3 = K.noise2(173);
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);

/** The skip: the time as the Stillness sees it. Every half second or so (irregular, never in a pattern) it holds for a
 * few frames, and the moment it held is drawn again as a pale double. Returns [time to draw, time of the double or -1]. */
export function skip(t, seed = 0) {
  const s = t * 2.1 + seed * 7.3, i = Math.floor(s), f = s - i;
  const r = N3(i * 1.37 + seed, 0.5); // (each half-second slot decides whether it skips, and how long)
  const len = r > 0.55 ? 0.12 + 0.25 * (r - 0.55) : 0;
  if (f < len * 2.1) { const held = (i + 0) / 2.1 - seed * 7.3 / 2.1; return [held, held + 0.18]; }
  return [t, -1];
}

/** the rim's distance from the centre at angle a (about 1), never the same twice */
function edge(a, t, seed, rough = 1) {
  const x = Math.cos(a) * 1.6 + seed * 3.1, y = Math.sin(a) * 1.6 - seed;
  return 0.78 + 0.32 * N1(x + t * 0.31, y - t * 0.23) + rough * (0.16 * N2(x * 3.3 - t * 0.71, y * 3.3 + t * 0.53) + 0.07 * N1(x * 9 + t * 1.3, y * 9 - t * 1.1)) - 0.12;
}
function outline(cx, cy, R, ry, t, seed, n, rough) {
  const pts = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * TAU, e = edge(a, t, seed, rough); pts.push([cx + Math.cos(a) * R * e, cy + Math.sin(a) * ry * e]); }
  return pts;
}
function path(c, pts, close = true) { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); if (close) c.closePath(); }

// ------------------------------------------------------------------ B: the ink tide (the one in the game)
/**
 * The Stillness as a mass at (cx, cy), radius R (ry for its height). o: near 0..1 (how present: rim, tendrils, forms),
 * seed, toward [x, y] (where its tendrils reach), reach 0..1 (how far they have come), n tendrils, t (seconds; default
 * the clock), stutter (true: it skips and doubles).
 */
export function mass(c, cx, cy, R, ry, o = {}) {
  const { near = 0.7, seed = 1, toward = null, reach = 0, n = 5, stutter = true } = o;
  const t0 = o.t ?? performance.now() / 1000, [t, dbl] = stutter ? skip(t0, seed) : [t0, -1];
  if (dbl >= 0) { c.save(); c.globalAlpha *= 0.32; c.translate(R * 0.035, -R * 0.02); body(c, cx, cy, R, ry, dbl, seed, near, true); c.restore(); }
  body(c, cx, cy, R, ry, t, seed, near, false);
  if (toward && reach > 0.01) tendrilsTo(c, cx, cy, R, ry, toward[0], toward[1], t, seed, n, reach, near, dbl);
}
function body(c, cx, cy, R, ry, t, seed, near, ghost) {
  const pts = outline(cx, cy, R, ry, t, seed, 120, 1);
  c.save();
  if (ghost) { path(c, pts); c.strokeStyle = 'rgba(200,190,235,0.9)'; c.lineWidth = Math.max(1, R * 0.01); c.stroke(); c.restore(); return; }
  // its haze: three soft shells outside the dark, each with its own slow edge (smoke, not a cut-out)
  for (const [k, a, dt] of [[1.16, 0.07, 0.9], [1.09, 0.13, 0.5], [1.04, 0.22, 0.2]]) {
    path(c, outline(cx, cy, R * k, ry * k, t - dt, seed + k, 72, 1.2)); c.fillStyle = `rgba(26,18,44,${a * (0.6 + 0.4 * near)})`; c.fill();
  }
  // the dark: absolute
  path(c, pts); c.fillStyle = '#030208'; c.fill();
  // currents inside it, darker than dark against a breath of violet: they turn slowly, never in step
  c.save(); path(c, pts); c.clip();
  const g = c.createRadialGradient(cx, cy, 0, cx, cy, Math.max(R, ry)); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.75, 'rgba(14,8,26,0.5)'); g.addColorStop(1, 'rgba(40,26,70,0.55)');
  c.fillStyle = g; c.fillRect(cx - R * 1.2, cy - ry * 1.2, R * 2.4, ry * 2.4);
  c.lineCap = 'round';
  for (let i = 0; i < 11; i++) {
    // (each current is a short drifting stroke somewhere inside, curling its own way: no rings, no centre)
    const ox = cx + (N1(i * 2.9, seed + t * 0.04) - 0.5) * R * 1.1, oy = cy + (N2(i * 3.7, seed - t * 0.05) - 0.5) * ry * 1.1;
    let a = i * 2.1 + seed + t * 0.12 * (i % 2 ? 1 : -1), x = ox, y = oy;
    c.strokeStyle = `rgba(56,42,92,${(0.08 + 0.1 * N1(i, t * 0.3)) * near})`; c.lineWidth = Math.max(1, R * (0.008 + 0.008 * (i % 3)));
    c.beginPath(); c.moveTo(x, y);
    for (let k = 0; k < 14; k++) { a += (N2(i * 5 + k * 0.4, t * 0.25) - 0.5) * 0.9; x += Math.cos(a) * R * 0.035; y += Math.sin(a) * ry * 0.035; c.lineTo(x, y); }
    c.stroke();
  }
  c.restore();
  // its rim light: a cold edge where it meets the world, broken, drifting round, never in time
  c.save(); c.globalCompositeOperation = 'screen'; c.lineCap = 'round';
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * TAU + 0.5 * N1(i * 0.7, t * 0.15) + seed, len = 0.05 + 0.22 * N2(i * 1.3, t * 0.35);
    const al = clamp((N1(i * 2.3 + 9, t * 0.45) - 0.3) * 1.5, 0, 1) * near;
    if (al < 0.04) continue;
    c.strokeStyle = `rgba(165,160,215,${0.5 * al})`; c.lineWidth = Math.max(1, R * 0.007 * (1 + 1.5 * N2(i, 3)));
    c.beginPath(); for (let k = 0; k <= 8; k++) { const aa = a + (k / 8) * len, ee = edge(aa, t, seed, 1) * 1.003; const x = cx + Math.cos(aa) * R * ee, y = cy + Math.sin(aa) * ry * ee; if (k) c.lineTo(x, y); else c.moveTo(x, y); } c.stroke();
    if (al > 0.7) { const e = edge(a, t, seed, 1); K.glow(c, cx + Math.cos(a) * R * e, cy + Math.sin(a) * ry * e, R * 0.025, [200, 205, 245], 0.6 * al); }
  }
  c.restore();
  c.restore();
}
/** a ribbon along points, tapering from w0 to a fine point (filled, so it is smooth: no beads) */
function ribbon(c, pts, w0, fill) {
  const L = [], Rr = [];
  for (let k = 0; k < pts.length; k++) {
    const [x, y] = pts[k], [px, py] = pts[Math.max(0, k - 1)], [nx, ny] = pts[Math.min(pts.length - 1, k + 1)];
    const dx = nx - px, dy = ny - py, d = Math.hypot(dx, dy) || 1, q = k / (pts.length - 1), w = w0 * Math.pow(1 - q, 1.4) * (0.6 + 0.4 * Math.cos(q * 2.2));
    L.push([x - (dy / d) * w, y + (dx / d) * w]); Rr.push([x + (dy / d) * w, y - (dx / d) * w]);
  }
  c.beginPath(); L.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); for (let k = Rr.length - 1; k >= 0; k--) c.lineTo(Rr[k][0], Rr[k][1]); c.closePath();
  c.fillStyle = fill; c.fill();
}
/**
 * Tendrils from the mass toward (tx, ty): each a chain whose every point follows the one before a moment later (so the
 * tip whips and the base lags: follow-through), curling with the noise, tapering to a fine curled point; smoke round it.
 */
function tendrilsTo(c, cx, cy, R, ry, tx, ty, t, seed, n, reach, near, dbl, wBase = 0) {
  const ba = Math.atan2(ty - cy, tx - cx), dist = Math.hypot(tx - cx, ty - cy);
  for (let i = 0; i < n + 3; i++) {
    const wisp = i >= n, spread = wisp ? (N1(i * 5.3, seed) - 0.5) * 1.8 : (i - (n - 1) / 2) * 0.3, a = ba + spread, e = edge(a, t, seed, 1);
    const x0 = cx + Math.cos(a) * R * e * 0.9, y0 = cy + Math.sin(a) * ry * e * 0.9;
    const len = (dist - R * 0.9) * reach * (wisp ? 0.45 : 0.85 + 0.25 * N1(i * 2.1, seed)) * (1 - Math.abs(spread) * 0.3), steps = 28;
    if (len < 2) continue;
    const pts = [];
    for (let k = 0; k <= steps; k++) {
      const q = k / steps, lag = t - q * 0.4; // the tip follows the base 0.4 s later: follow-through
      const curl = (N2(i * 4.7 + q * 1.6, lag * 0.8) - 0.5) * 1.6 * q + (N1(i * 2.2, lag * 0.35) - 0.5) * 0.7 * q * q + (q > 0.8 ? (q - 0.8) * 4 * (N1(i, lag) - 0.4) : 0);
      const ang = a + curl, d = len * q;
      pts.push([x0 + Math.cos(ang) * d, y0 + Math.sin(ang) * d]);
    }
    const W0 = Math.max(2.5, (wBase || R) * (wisp ? 0.035 : 0.085)) * (1 - Math.abs(spread) * 0.35);
    ribbon(c, pts, W0 * 2.2, `rgba(30,22,52,${0.25 * near})`);
    ribbon(c, pts, W0 * 1.4, `rgba(130,120,185,${0.42 * near})`); // (its cold rim: it must read against its own dark too)
    ribbon(c, pts, W0, 'rgba(3,2,8,0.97)');
    if (dbl >= 0 && !wisp) { c.save(); c.globalAlpha *= 0.4; c.strokeStyle = 'rgba(200,190,235,0.9)'; c.lineWidth = 1; path(c, pts.map(([x, y]) => [x + R * 0.04, y - R * 0.02]), false); c.stroke(); c.restore(); }
  }
}
/** a stain of it, lying on a world (residue): a small mass, flat, slow, no tendrils */
export function stain(c, x, y, r, seed, t) { mass(c, x, y, r, r * 0.5, { near: 0.35, seed, t: (t ?? performance.now() / 1000) * 0.3, stutter: true }); }
/** something it has reached, held mid-motion and doubled: draw(dx, dy) is called twice, the second time pale and offset */
export function held(c, draw, R, t = performance.now() / 1000) {
  const [, dbl] = skip(t, 3);
  draw(0, 0);
  c.save(); c.globalAlpha *= dbl >= 0 ? 0.5 : 0.22; c.globalCompositeOperation = 'screen'; draw(R * 0.05, -R * 0.03); c.restore();
}

// ------------------------------------------------------------------ A: the erasure (concept)
export function erasure(c, cx, cy, R, ry, o = {}) {
  const { seed = 1, near = 0.7 } = o, t0 = o.t ?? performance.now() / 1000, [t, dbl] = skip(t0, seed);
  const step = Math.max(3, R * 0.03), pts = outline(cx, cy, R, ry, Math.floor(t * 5) / 5, seed, 120, 1.3).map(([x, y]) => [Math.round(x / step) * step, Math.round(y / step) * step]);
  for (let b = 0; b < 9; b++) { // the void in horizontal slices, each displaced a little on the skip: the picture tearing
    const y0 = cy - ry * 1.3 + (b / 9) * ry * 2.6, h = (ry * 2.6) / 9, dx = (dbl >= 0 ? 1 : 0.2) * R * 0.1 * (N2(b * 1.9, Math.floor(t * 9)) - 0.5);
    c.save(); c.beginPath(); c.rect(cx - R * 1.5, y0, R * 3, h + 1); c.clip(); c.translate(dx, 0);
    path(c, pts); c.fillStyle = '#000'; c.fill();
    c.restore();
  }
  // the edge dissolving: blocks of the world blinking out just outside it
  c.fillStyle = '#000';
  for (let i = 0; i < 70; i++) { const a = N1(i * 1.3, Math.floor(t * 7) * 0.31) * TAU, e = edge(a, t, seed, 1) * (1.02 + 0.12 * N2(i, Math.floor(t * 7))); c.fillRect(Math.round((cx + Math.cos(a) * R * e) / step) * step, Math.round((cy + Math.sin(a) * ry * e) / step) * step, step, step); }
  c.save(); c.globalAlpha = (dbl >= 0 ? 0.5 : 0.18) * near; c.translate(R * 0.05, -R * 0.025); path(c, pts); c.strokeStyle = 'rgb(220,210,255)'; c.lineWidth = 1; c.stroke(); c.restore();
}

// ------------------------------------------------------------------ C: the crust (concept)
export function crust(c, cx, cy, R, ry, o = {}) {
  const { seed = 1 } = o, t = o.t ?? performance.now() / 1000;
  // the front: colour drained under a spreading ring (the saturation of what is beneath goes), frost at its edge
  c.save(); path(c, outline(cx, cy, R * 1.35, ry * 1.35, t * 0.6, seed, 80, 0.5)); c.clip();
  c.globalCompositeOperation = 'saturation'; c.fillStyle = 'rgb(128,128,128)'; c.fillRect(cx - R * 2, cy - ry * 2, R * 4, ry * 4);
  c.restore();
  const pts = outline(cx, cy, R, ry, t * 0.6, seed, 80, 0.5);
  path(c, pts); c.fillStyle = 'rgba(30,32,44,0.85)'; c.fill();
  c.strokeStyle = 'rgba(200,214,240,0.6)'; c.lineWidth = 1.2; c.stroke();
  // cracks, crystalline, growing outward a little at a time
  c.strokeStyle = 'rgba(210,220,245,0.55)'; c.lineWidth = 1;
  for (let i = 0; i < 18; i++) { let a = (i / 18) * TAU + seed, x = cx, y = cy; c.beginPath(); c.moveTo(x, y); const L = R * (0.6 + 0.6 * N1(i, Math.floor(t * 2) * 0.3)); for (let k = 0; k < 6; k++) { a += (N2(i * 3 + k, seed) - 0.5) * 1.2; x += Math.cos(a) * L / 6; y += Math.sin(a) * L / 6 * (ry / R); c.lineTo(x, y); } c.stroke(); }
  K.glow(c, cx, cy, Math.min(R, ry) * 0.5, [0, 0, 0], 0.9, 'source-over');
  path(c, outline(cx, cy, R * 0.35, ry * 0.35, t, seed, 40, 1)); c.fillStyle = '#020204'; c.fill();
}

/** The shadow rings (where Helion was taken): three broken rings of it, each thickening and thinning with the noise,
 * tilted, turning slowly; they skip and double like the rest of it. */
export function rings(c, x, y, rx, ry, near = 0.8, t = performance.now() / 1000) {
  const [tt, dbl] = skip(t, 5);
  for (let i = 0; i < 3; i++) {
    const kx = rx * (1 + i * 0.35), ky = ry * (1 + i * 0.35), rot = -0.2 + i * 0.25 + 0.03 * Math.sin(tt * 0.2 + i);
    const n = 64;
    for (const [col, wk] of [[`rgba(150,140,190,${0.3 * near})`, 1.8], ['rgba(6,4,14,0.92)', 1]]) {
      c.strokeStyle = col; c.lineCap = 'round';
      for (let k = 0; k < n; k++) {
        const a0 = (k / n) * TAU, a1 = ((k + 1) / n) * TAU, th = Math.max(0, N1(i * 7 + k * 0.21, tt * 0.3) - 0.28) * 2;
        if (th < 0.05) continue; // (broken: never a whole ring)
        c.lineWidth = Math.max(0.6, ry * 0.18 * th * wk);
        const p = (a) => { const ex = Math.cos(a) * kx, ey = Math.sin(a) * ky; return [x + ex * Math.cos(rot) - ey * Math.sin(rot), y + ex * Math.sin(rot) + ey * Math.cos(rot)]; };
        const [x0, y0] = p(a0), [x1, y1] = p(a1); c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
      }
    }
  }
  if (dbl >= 0) { c.save(); c.globalAlpha *= 0.4; c.strokeStyle = 'rgba(200,190,235,0.9)'; c.lineWidth = 1; c.beginPath(); c.ellipse(x + rx * 0.06, y - ry * 0.05, rx * 1.35, ry * 1.35, 0.05, 0, TAU); c.stroke(); c.restore(); }
}
/** Tendrils of it reaching from (x0, y0) toward (tx, ty), w thick at the root; reach 0..1 how far they have come */
export function reachOut(c, x0, y0, tx, ty, w, n, seed, reach, t = performance.now() / 1000) {
  const [tt, dbl] = skip(t, seed);
  tendrilsTo(c, x0, y0, w * 0.4, w * 0.4, tx, ty, tt, seed, n, reach, 0.9, dbl, w * 12);
}
export const STILL = { mass, stain, held, skip, erasure, crust, reachOut, rings };
