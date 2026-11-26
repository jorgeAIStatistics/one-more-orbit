// The cold open's brushes (shared with the stills in mockups/art/pass3-stills.js): the Harmonic Nebula in gold and
// drained to ash, the brothers' music of light, the Stillness with a faint ash rim so its shape reads in the dark, and
// its tendrils.
import { CANON } from './canonpaint.js';
import { DUSK, K } from './painter.js';
import { mass, reachOut } from './stillness.js';

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

/** The Stillness (the redesign of 2026-11-26, src/art/stillness.js: the ink tide), drawn live: a mass at (x, y). */
function dread(c, x, y, rx, ry, seed, near) {
  if (x < -1e4) return; // (the old warm-up calls: nothing to paint ahead any more)
  mass(c, x, y, rx, ry, { near, seed });
}

/** Tendrils of it, from (x0, y0) reaching for a point; reach: how far along they have come, 0..1. */
function tendrils(c, x0, y0, tx, ty, u, n, seed, reach = 1) {
  if (reach <= 0.01) return;
  reachOut(c, x0, y0, tx, ty, 10 * u, Math.max(3, Math.round(n * 0.6)), seed, reach);
}

export const COLDPAINT = { nebula, music, dread, tendrils };
