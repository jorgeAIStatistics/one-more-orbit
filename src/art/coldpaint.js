// The cold open's brushes (shared with the stills in mockups/art/pass3-stills.js): the Harmonic Nebula in gold and
// drained to ash, the brothers' music of light, the Stillness with a faint ash rim so its shape reads in the dark, and
// its tendrils.
import { CANON } from './canonpaint.js';
import { DUSK, K } from './painter.js';

const T = DUSK.tools, P = CANON.parts, TAU = Math.PI * 2;

/** The nebula, painted once: gold, or drained to ash (the same picture, its colour gone and its edges dark). */
function nebula(c, w, h, ash = false) {
  const r = K.RNG(63);
  T.sky(c, w, h, CANON.pal.NEBULA, r, 110);
  c.save(); c.globalCompositeOperation = 'screen'; c.lineCap = 'round';
  for (let i = 0; i < 9; i++) { const rr = Math.min(w, h) * (0.5 + i * 0.13), a0 = r() * 6.28; c.strokeStyle = K.rgba([255, 236, 180], 0.05 + r() * 0.05); c.lineWidth = 10 + r() * 30; c.beginPath(); c.ellipse(w / 2, h * 0.52, rr, rr * 0.84, 0.2, a0, a0 + 1.2 + r()); c.stroke(); }
  c.restore();
  K.glow(c, w / 2, h * 0.5, Math.max(w, h) * 0.7, [255, 226, 150], ash ? 0.1 : 0.35, 'screen');
  if (ash) {
    c.save(); c.globalCompositeOperation = 'saturation'; c.fillStyle = 'rgba(128,128,128,0.75)'; c.fillRect(0, 0, w, h); c.restore();
    const g = c.createRadialGradient(w / 2, h * 0.5, Math.min(w, h) * 0.25, w / 2, h * 0.5, Math.hypot(w, h) * 0.55);
    g.addColorStop(0, 'rgba(60,56,64,0.1)'); g.addColorStop(0.5, 'rgba(46,44,56,0.5)'); g.addColorStop(1, 'rgba(10,9,18,0.92)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  }
  T.finish(c, w, h, 71, 0.25);
}

/**
 * Their music of light: ribbons of beads between the two of them, one per voice, the beads travelling along at the
 * music's pace (t: seconds). broken: how far the third voice has gone wrong. fade: how much of the music is left.
 */
function music(c, ax, ay, bx, by, u, t = 0, broken = 0, fade = 1) {
  const r = K.RNG(17);
  for (let k = 0; k < 4; k++) {
    const lift = (k - 1.5) * 26 * u, wob = 0.6 + 0.4 * r(), bad = k === 2 && broken > 0, a = fade * (k === 3 ? Math.min(1, fade * 2 - 1) : 1);
    if (a <= 0.01) continue;
    const at = (i) => { const q = i / 40, x = ax + (bx - ax) * q, y0 = ay + (by - ay) * q - Math.sin(q * Math.PI) * (70 * u + lift) + Math.sin(q * 14 * wob + k + t * 1.2) * 6 * u; return [x, bad && i > 18 ? y0 + Math.sin(i * 2.3 + t * 3) * 14 * u * broken + (i - 18) * 2.2 * u * broken : y0]; };
    c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
    c.strokeStyle = bad ? `rgba(200,190,210,${0.35 * a})` : `rgba(255,226,160,${0.28 * a})`; c.lineWidth = 3 * u;
    c.beginPath(); for (let i = 0; i <= 40; i++) { const [x, y] = at(i); if (i) c.lineTo(x, y); else c.moveTo(x, y); } c.stroke();
    for (let j = 0; j < 10; j++) { const i = Math.floor(((j * 4 + t * 9 * (k % 2 ? -1 : 1)) % 40 + 40) % 40); const [x, y] = at(i); K.glow(c, x, y, (bad && i > 18 ? 5 : 9) * u, bad && i > 18 ? [170, 160, 190] : [255, 240, 200], 0.7 * a); }
    c.restore();
  }
}

/** The Stillness, with a faint ash rim so its shape reads against the dark. */
// (painted once into an image at the screen's own resolution, at a size rounded to 32 px, and drawn at the exact size:
// its blurred rim was the cold open's biggest cost, four times a frame)
const DREAD = new Map();
function dread(c, x, y, rx, ry, seed, near) {
  const t = c.getTransform(), k = Math.min(3, Math.hypot(t.a, t.b)) || 1;
  const RX = Math.max(32, Math.round(rx / 32) * 32), RY = Math.max(8, Math.round((ry / rx) * RX)), N = Math.round(near * 40) / 40;
  const key = `${seed}|${RX}|${RY}|${N}|${k.toFixed(2)}`;
  let e = DREAD.get(key);
  if (!e) {
    const pad = Math.max(RX, RY) * 0.6 + 70, W = (RX + pad) * 2, H = (RY + pad) * 2;
    const cv = document.createElement('canvas'); cv.width = Math.min(4096, Math.ceil(W * k)); cv.height = Math.min(4096, Math.ceil(H * k));
    const g = cv.getContext('2d'); g.setTransform(cv.width / W, 0, 0, cv.height / H, 0, 0);
    g.save(); g.shadowColor = 'rgba(176,168,196,0.55)'; g.shadowBlur = 26 * (cv.width / W) / k; P.stillness(g, W / 2, H / 2, RX, RY, K.RNG(seed), { near: N }); g.restore();
    P.stillness(g, W / 2, H / 2, RX, RY, K.RNG(seed), { near: N });
    e = { cv, W, H }; DREAD.set(key, e);
    if (DREAD.size > 10) DREAD.delete(DREAD.keys().next().value);
  }
  const sx = rx / RX, sy = ry / RY;
  c.drawImage(e.cv, x - (e.W / 2) * sx, y - (e.H / 2) * sy, e.W * sx, e.H * sy);
}

/** Tendrils of it, from (x0, y0) curling round a point; reach: how far along they have come, 0..1. */
function tendrils(c, x0, y0, tx, ty, u, n, seed, reach = 1) {
  const r = K.RNG(seed);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + r(), ex = tx + Math.cos(a) * (14 + r() * 26) * u, ey = ty + Math.sin(a) * (20 + r() * 34) * u;
    const c1 = [x0 + (tx - x0) * 0.3 + (r() - 0.5) * 120 * u, y0 + (r() - 0.5) * 160 * u], c2 = [tx + Math.cos(a + 1.4) * 70 * u, ty + Math.sin(a + 1.4) * 70 * u];
    const len = Math.max(0, Math.min(1, reach * (1.15 - i * 0.03)));
    if (len <= 0.02) continue;
    for (const [col, wd, blur] of [['rgba(150,142,170,0.35)', 9, 12], ['rgba(5,4,10,0.96)', 6, 0]]) {
      c.save(); c.shadowColor = col; c.shadowBlur = blur; c.strokeStyle = col; c.lineCap = 'round';
      const steps = 24; let px = x0, py = y0;
      if (blur) {
        // the soft rim: one path (blurred once), as wide as the tendril is on average, rather than 24 blurred pieces
        c.lineWidth = Math.max(0.6, wd * u * 0.62); c.beginPath(); c.moveTo(x0, y0);
        for (let k = 1; k <= steps * len; k++) { const q = k / steps, m = 1 - q; c.lineTo(m * m * m * x0 + 3 * m * m * q * c1[0] + 3 * m * q * q * c2[0] + q * q * q * ex, m * m * m * y0 + 3 * m * m * q * c1[1] + 3 * m * q * q * c2[1] + q * q * q * ey); }
        c.stroke(); c.restore(); continue;
      }
      for (let k = 1; k <= steps * len; k++) {
        const q = k / steps, m = 1 - q;
        const x = m * m * m * x0 + 3 * m * m * q * c1[0] + 3 * m * q * q * c2[0] + q * q * q * ex, y = m * m * m * y0 + 3 * m * m * q * c1[1] + 3 * m * q * q * c2[1] + q * q * q * ey;
        c.lineWidth = Math.max(0.6, wd * u * (1 - q * 0.85)); c.beginPath(); c.moveTo(px, py); c.lineTo(x, y); c.stroke(); px = x; py = y;
      }
      c.restore();
    }
  }
}

export const COLDPAINT = { nebula, music, dread, tendrils };
