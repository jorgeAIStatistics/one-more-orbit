// Emberwick as the world itself (the owner's brief, 2026-11-25): the planet in the middle of the ring is the place,
// large and detailed (the dead forge, the anvil, the cold lava channels, Ossa), the course runs round it and over its
// features, and the relighting happens in play. Three stills: the cold start, mid-verse half relit, the drop.
// Painted with the game's brushes; the course is drawn as the game's one-signal look draws it. Not used by the game.
import { DUSK, K } from '../../src/art/painter.js';
import { WORLD1 } from '../../src/art/world1paint.js';
import { COMPANIONS } from '../../src/art/companions.js';
import { CANON } from '../../src/art/canonpaint.js';

const T = DUSK.tools, TAU = Math.PI * 2, P = CANON.parts;
const sm = (x) => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };
const SERIF = '"Cormorant Garamond", "Hoefler Text", Baskerville, Palatino, Georgia, serif';
const TAP = [255, 204, 72], STONE = [84, 94, 140], WOKEN = [128, 150, 222], HALO = 'rgba(3,5,14,0.88)', INK = [70, 36, 120];
const EMBER = [255, 140, 60];

/** relit: 0..1, how much of the planet is relit, going round from the start (angle a0) the way Orbin runs */
function sky(c, w, h, warm) {
  const r = K.RNG(11);
  const cold = [[0, [10, 10, 22]], [0.55, [26, 22, 40]], [1, [34, 26, 40]]], hot = [[0, [24, 10, 26]], [0.55, [92, 40, 54]], [1, [150, 74, 60]]];
  T.sky(c, w, h, warm > 0.5 ? hot : cold, r, 70);
  T.stars(c, w, h, r, 220, 3);
  // far off, small: the guardian's three rings of shadow, and Helion's signal behind them (always in sight)
  const gx = w * 0.2, gy = h * 0.14;
  c.save(); c.strokeStyle = 'rgba(10,8,20,0.8)'; c.lineWidth = 3; for (let i = 0; i < 3; i++) { c.beginPath(); c.ellipse(gx, gy, 26 + i * 9, 8 + i * 3, -0.2 + i * 0.25, 0, TAU); c.stroke(); } c.restore();
  K.glow(c, gx, gy, 14, [255, 214, 140], 0.5);
}

function planet(c, cx, cy, R, relit, a0, drop) {
  const r = K.RNG(7);
  // the world: basalt and slag, cold blue-grey where it is still asleep, warm where it is relit
  T.sphere(c, cx, cy, R, [44, 40, 52], [96, 88, 100], [12, 10, 18], -0.8, r);
  const lit = (a) => { let d = ((a - a0) % TAU + TAU) % TAU; return d < relit * TAU ? 1 : 0; };
  c.save(); c.beginPath(); c.arc(cx, cy, R, 0, TAU); c.clip();
  // relit zones: warm light pooled on the ground
  for (let k = 0; k < 24; k++) { const a = (k / 24) * TAU; if (!lit(a)) continue; K.glow(c, cx + Math.cos(a) * R * 0.75, cy + Math.sin(a) * R * 0.75, R * 0.5, [255, 120, 60], drop ? 0.22 : 0.12, 'screen'); }
  // the lava channels: cracks running out from the forge across the planet; dead and dark until relit
  const rr = K.RNG(31);
  for (let k = 0; k < 9; k++) {
    let a = -0.9 + k * 0.72, x = cx + Math.cos(a) * R * 0.15, y = cy + Math.sin(a) * R * 0.15;
    const pts = [[x, y]];
    for (let i = 0; i < 7; i++) { a += (rr() - 0.5) * 0.5; const d = R * (0.15 + 0.13 * (i + 1)); pts.push([cx + Math.cos(a) * d, cy + Math.sin(a) * d]); }
    const on = lit(Math.atan2(pts[4][1] - cy, pts[4][0] - cx));
    c.lineCap = 'round'; c.lineJoin = 'round';
    // (bright enough to read as fire, never as bright as the course and its gold: the planet stays behind)
    c.strokeStyle = on ? `rgba(240,${drop ? 140 : 115},60,${drop ? 0.72 : 0.62})` : 'rgba(20,16,26,0.9)'; c.lineWidth = on ? 2.8 : 2.6;
    if (on) { c.shadowColor = 'rgba(255,110,50,0.6)'; c.shadowBlur = drop ? 8 : 5; }
    c.beginPath(); pts.forEach(([px, py], i) => (i ? c.lineTo(px, py) : c.moveTo(px, py))); c.stroke(); c.shadowBlur = 0;
  }
  // what the Stillness left: dark violet residue lying on the ground (it burns off where the world is relit)
  // (smudged, dark and dull: a stain, not a decoration)
  c.save(); c.filter = 'blur(3px)';
  for (let k = 0; k < 16; k++) { const a = r() * TAU, d = R * (0.3 + 0.6 * r()); if (lit(a)) continue; c.fillStyle = 'rgba(34,20,52,0.6)'; c.beginPath(); c.ellipse(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 12 + r() * 18, 6 + r() * 8, a, 0, TAU); c.fill(); }
  c.restore();
  c.restore();
  // its rim: cool where asleep, ember where relit
  for (let k = 0; k < 48; k++) { const a = (k / 48) * TAU, a1 = a + TAU / 48; c.strokeStyle = lit(a) ? 'rgba(255,150,80,0.7)' : 'rgba(150,160,200,0.25)'; c.lineWidth = 2; c.beginPath(); c.arc(cx, cy, R, a, a1); c.stroke(); }
}

/** something standing on the planet's surface at angle a (its feet on the ground, upright away from the middle) */
function onSurface(c, cx, cy, R, a, draw) { c.save(); c.translate(cx + Math.cos(a) * R, cy + Math.sin(a) * R); c.rotate(a + Math.PI / 2); draw(); c.restore(); }

function forge(c, s, heat) {
  // a squat furnace of stone with a mouth and a chimney; its fire banked (cold) or roaring
  c.fillStyle = 'rgb(30,24,34)'; c.beginPath(); c.moveTo(-34 * s, 2); c.lineTo(-28 * s, -40 * s); c.lineTo(-10 * s, -52 * s); c.lineTo(-8 * s, -84 * s); c.lineTo(8 * s, -84 * s); c.lineTo(10 * s, -52 * s); c.lineTo(28 * s, -40 * s); c.lineTo(34 * s, 2); c.closePath(); c.fill();
  c.strokeStyle = heat > 0.1 ? `rgba(255,160,90,${0.3 + 0.5 * heat})` : 'rgba(150,150,190,0.25)'; c.lineWidth = 1.6; c.stroke();
  c.fillStyle = heat > 0.05 ? `rgba(255,${120 + 80 * heat},60,${0.25 + 0.75 * heat})` : 'rgb(8,6,12)'; c.beginPath(); c.ellipse(0, -16 * s, 13 * s, 10 * s, 0, Math.PI, TAU); c.lineTo(13 * s, -6 * s); c.lineTo(-13 * s, -6 * s); c.fill();
  if (heat > 0.05) { K.glow(c, 0, -14 * s, 60 * s * (0.6 + heat), EMBER, 0.5 * heat, 'screen'); for (let i = 0; i < 10 * heat; i++) { const r = K.RNG(80 + i); K.glow(c, (r() - 0.5) * 14 * s, -84 * s - r() * 60 * s * heat, (2 + r() * 3) * s, [255, 200, 120], 0.8); } }
}
function anvil(c, s, flash) {
  c.fillStyle = 'rgb(24,20,30)';
  c.beginPath(); c.moveTo(-10 * s, 0); c.lineTo(-7 * s, -14 * s); c.lineTo(-22 * s, -18 * s); c.lineTo(-30 * s, -26 * s); c.lineTo(26 * s, -26 * s); c.lineTo(20 * s, -18 * s); c.lineTo(7 * s, -14 * s); c.lineTo(10 * s, 0); c.closePath(); c.fill();
  c.strokeStyle = flash > 0.05 ? `rgba(255,220,160,${0.4 + 0.5 * flash})` : 'rgba(150,150,190,0.25)'; c.lineWidth = 1.4; c.stroke();
  if (flash > 0) { K.glow(c, 0, -28 * s, 70 * s, [255, 210, 140], 0.9 * flash, 'screen'); for (let i = 0; i < 14; i++) { const a = -Math.PI / 2 + (i - 7) * 0.2, d = (20 + i * 3) * s; c.strokeStyle = `rgba(255,220,150,${0.7 * flash})`; c.lineWidth = 1.4; c.beginPath(); c.moveTo(Math.cos(a) * d * 0.5, -28 * s + Math.sin(a) * d * 0.5); c.lineTo(Math.cos(a) * d, -28 * s + Math.sin(a) * d); c.stroke(); } }
}

/** the course, as the one-signal look draws it: stone tiles ahead, woken tiles behind, nodes, walls of residue */
function course(c, cx, cy, Rr, o) {
  const { from, to, at, nodes, cue, walls, meteor } = o;
  c.save(); c.lineCap = 'butt';
  c.strokeStyle = HALO; c.lineWidth = 11; c.beginPath(); c.arc(cx, cy, Rr, from, to); c.stroke();
  c.setLineDash([9, 3]); c.lineWidth = 6;
  c.strokeStyle = K.rgba(WOKEN); c.beginPath(); c.arc(cx, cy, Rr, from, at); c.stroke();
  c.strokeStyle = K.rgba(STONE); c.beginPath(); c.arc(cx, cy, Rr, at, to); c.stroke();
  c.setLineDash([]);
  // walls of residue across the path (the Meteor dashes through them): violet stone, a pale rim, cracked
  for (const [a, broken] of walls) {
    const x0 = cx + Math.cos(a) * (Rr - 15), y0 = cy + Math.sin(a) * (Rr - 15), x1 = cx + Math.cos(a) * (Rr + 15), y1 = cy + Math.sin(a) * (Rr + 15);
    if (broken) { for (let i = 0; i < 9; i++) { const r = K.RNG(i + Math.round(a * 100)); K.glow(c, x0 + (x1 - x0) * r() + (r() - 0.5) * 18, y0 + (y1 - y0) * r() + (r() - 0.5) * 18, 3 + r() * 3, [255, 170, 100], 0.8); } continue; }
    c.lineCap = 'round'; c.strokeStyle = HALO; c.lineWidth = 9; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
    c.strokeStyle = K.rgba([150, 120, 210], 0.9); c.lineWidth = 6; c.stroke();
    c.strokeStyle = K.rgba(INK); c.lineWidth = 3.4; c.stroke();
  }
  // the nodes: unlit stones, and the next one or two in gold with their closing rings
  nodes.forEach((a, i) => {
    const x = cx + Math.cos(a) * Rr, y = cy + Math.sin(a) * Rr, lit = i < cue.length;
    c.fillStyle = HALO; c.beginPath(); c.arc(x, y, lit ? 11 : 7, 0, TAU); c.fill();
    if (!lit) { c.fillStyle = K.rgba(STONE, 0.9); c.beginPath(); c.arc(x, y, 4.6, 0, TAU); c.fill(); return; }
    c.fillStyle = 'rgba(16,18,40,0.96)'; c.beginPath(); c.arc(x, y, 9, 0, TAU); c.fill();
    c.strokeStyle = K.rgba(TAP, 0.85); c.lineWidth = 1.4; c.stroke();
    c.fillStyle = K.rgba(TAP); c.beginPath(); for (let k = 0; k < 10; k++) { const q = a + (k * Math.PI) / 5, r = k % 2 ? 2.8 : 6.6; if (k) c.lineTo(x + Math.cos(q) * r, y + Math.sin(q) * r); else c.moveTo(x + Math.cos(q) * r, y + Math.sin(q) * r); } c.closePath(); c.fill();
    const rr = 10.5 + cue[i] * 28;
    c.strokeStyle = HALO; c.lineWidth = 6; c.beginPath(); c.arc(x, y, rr, 0, TAU); c.stroke();
    c.strokeStyle = K.rgba(TAP); c.lineWidth = 3; c.beginPath(); c.arc(x, y, rr, 0, TAU); c.stroke();
  });
  // Orbin, on the path
  const ox = cx + Math.cos(at) * (Rr + 12), oy = cy + Math.sin(at) * (Rr + 12);
  if (meteor) { const g = c.createLinearGradient(ox, oy, ox + Math.sin(at) * 50, oy - Math.cos(at) * 50); g.addColorStop(0, 'rgba(255,200,130,0.9)'); g.addColorStop(1, 'rgba(255,120,60,0)'); c.strokeStyle = g; c.lineWidth = 9; c.lineCap = 'round'; c.beginPath(); c.moveTo(ox, oy); c.lineTo(ox + Math.sin(at) * 50, oy - Math.cos(at) * 50); c.stroke(); }
  c.save(); c.translate(ox, oy); c.rotate(at + Math.PI / 2); P.spark(c, 0, -10, 0.18, { who: 'orbin', lite: true, glow: 1, lean: -0.4, crest: 1, arms: 'back', face: 1, eyes: 'set', beat: 1 }); c.restore();
  c.restore();
}

function line(c, s, x, y, px, a = 1) {
  c.save(); c.font = `italic 500 ${px}px ${SERIF}`; c.textAlign = 'center'; c.shadowColor = 'rgba(6,5,18,0.95)'; c.shadowBlur = px * 0.6; c.globalAlpha = a; c.fillStyle = '#fff1d8'; c.fillText(s, x, y); c.restore();
}

/** phase: 'cold' | 'half' | 'drop' */
export function emberPlay(c, w, h, phase) {
  const warm = phase === 'drop' ? 1 : 0, cx = w / 2, cy = h * 0.47, R = w * 0.29, Rr = R + 34;
  sky(c, w, h, warm);
  const a0 = -Math.PI / 2 - 0.3;  // the forge, where the relighting starts
  const relit = phase === 'cold' ? 0 : phase === 'half' ? 0.5 : 1;
  if (phase === 'drop') { K.glow(c, cx, cy, w * 0.9, [255, 130, 70], 0.28, 'screen'); for (let i = 0; i < 40; i++) { const r = K.RNG(200 + i); K.glow(c, r() * w, r() * h * 0.9, 1.5 + r() * 2.5, [255, 190, 120], 0.7); } }
  planet(c, cx, cy, R, relit, a0, phase === 'drop');
  // its features, standing on the surface: the forge (where it starts), the anvil, Ossa
  const heat = phase === 'cold' ? 0 : phase === 'half' ? 0.35 : 1;
  onSurface(c, cx, cy, R, a0, () => forge(c, 0.62, heat));
  onSurface(c, cx, cy, R, -Math.PI / 2 + 0.55, () => anvil(c, 0.7, phase === 'drop' ? 1 : 0));
  onSurface(c, cx, cy, R, -Math.PI / 2 + 1.0, () => WORLD1.parts.ossa(c, 10, 6, 0.36, phase === 'cold' ? 0.04 : phase === 'half' ? 0.3 : 1, K.RNG(53), phase === 'cold' ? 'lie' : 'stand', -1));
  if (phase === 'half') COMPANIONS.kindling(c, cx + Math.cos(a0) * (R + 50), cy + Math.sin(a0) * (R + 50), 0.34, COMPANIONS.KINDLE.heroes, { flap: 0.7, alpha: 0.9 });
  // the course round it: the start of the ring is the forge; behind Orbin the tiles are awake
  const at = phase === 'cold' ? a0 + 0.35 : phase === 'half' ? a0 + Math.PI : a0 + 4.1;
  const nodes = phase === 'drop' ? [at + 0.32, at + 0.62, at + 0.9, at + 1.25] : [at + 0.45, at + 1.05, at + 1.6];
  const cue = phase === 'drop' ? [0.15, 0.9] : [0.5];
  const walls = phase === 'drop' ? [[at - 0.25, true], [at + 0.38, false], [at + 0.68, false], [at + 0.96, false]] : [];
  course(c, cx, cy, Rr, { from: a0, to: a0 + TAU * 0.92, at, nodes, cue, walls, meteor: phase === 'drop' });
  // the inhabitant speaks only in calm moments, low on the screen, never over the course
  if (phase === 'cold') line(c, 'Cold. Since the music stopped.', cx, h * 0.86, 19, 0.9);
  if (phase === 'half') line(c, 'There. A spark.', cx, h * 0.86, 19, 0.9);
  T.finish(c, w, h, 41, 0.3);
}
