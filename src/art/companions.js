// The companions (the owner chose A, the Kindlings, on 2026-11-25): children of each reignited star. A drop of the
// star's own fire with two pairs of moth wings made of light; no face. They live by the fire at the Landing, and in a
// level a Kindling IS the mechanic: its wings open across the path, and Orbin takes its shape as he passes through.
import { K } from './painter.js';

const TAU = Math.PI * 2;
/** each world's Kindling, in its star's colour */
export const KINDLE = { heroes: [255, 150, 80], skyhigh: [240, 170, 230], blank: [150, 205, 255], invincible: [130, 230, 160], started: [255, 226, 170] };

/** flap: 0..1, how far the wings are raised (it beats them slowly); open: how far they spread round something passing */
function kindling(c, x, y, s, col, o = {}) {
  const fl = o.flap ?? 0.6, open = o.open ?? 0, a = o.alpha ?? 1;
  if (a <= 0.01) return;
  c.save(); c.globalAlpha *= a;
  K.glow(c, x, y, 70 * s * (1 + open), col, 0.35, 'screen');
  c.save(); c.translate(x, y); c.rotate(o.rot ?? 0); c.globalCompositeOperation = 'lighter';
  for (const k of [-1, 1]) for (const [ang, len, wid] of [[-0.55, 42, 18], [0.35, 30, 12]]) {
    c.save(); c.rotate(k * (ang - 0.25 * fl - 0.6 * open)); c.scale(k, 1);
    const L = len * (1 + 0.8 * open);
    const g = c.createRadialGradient(L * 0.5 * s, 0, 0, L * 0.5 * s, 0, L * s); g.addColorStop(0, K.rgba(K.mix(col, [255, 255, 255], 0.4), 0.55)); g.addColorStop(1, K.rgba(col, 0));
    c.fillStyle = g; c.beginPath(); c.ellipse(L * 0.55 * s, 0, L * 0.6 * s, wid * 0.5 * s, 0, 0, TAU); c.fill();
    c.strokeStyle = K.rgba(K.mix(col, [255, 255, 255], 0.6), 0.45); c.lineWidth = 0.8 * s; c.stroke();
    c.restore();
  }
  c.restore();
  c.save(); c.translate(x, y); c.rotate(o.rot ?? 0);
  const b = c.createRadialGradient(0, -4 * s, 1, 0, 0, 16 * s); b.addColorStop(0, '#fffbea'); b.addColorStop(0.45, K.rgba(K.mix(col, [255, 255, 255], 0.5))); b.addColorStop(1, K.rgba(col, 0.9));
  c.fillStyle = b; c.beginPath(); c.moveTo(0, -18 * s); c.bezierCurveTo(10 * s, -8 * s, 10 * s, 8 * s, 0, 12 * s); c.bezierCurveTo(-10 * s, 8 * s, -10 * s, -8 * s, 0, -18 * s); c.fill();
  c.strokeStyle = K.rgba(col, 0.7); c.lineWidth = 2 * s; c.lineCap = 'round'; c.beginPath(); c.moveTo(0, 12 * s); c.bezierCurveTo(6 * s, 22 * s, -8 * s, 28 * s, 2 * s, 38 * s); c.stroke();
  c.restore();
  c.restore();
}
export const COMPANIONS = { kindling, KINDLE };
