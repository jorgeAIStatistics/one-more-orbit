// The next pass, step 1 again (the owner's brief of 2026-11-25): stills for the cold open as a scene (no gameplay),
// the Sleeper as an ancient vessel that each star powers, and three companion designs. Painted with the game's own
// brushes (painter.js, canonpaint.js, landingpaint.js) so they look like the game. Not used by the game itself.
import { CANON } from '../../src/art/canonpaint.js';
import { DUSK, K } from '../../src/art/painter.js';
import { LANDING } from '../../src/art/landingpaint.js';

const T = DUSK.tools, P = CANON.parts, TAU = Math.PI * 2;
const SERIF = '"Cormorant Garamond", "Hoefler Text", Baskerville, Palatino, Georgia, serif';
const sm = (x) => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };
const write = (c, s, x, y, px, o = {}) => {
  c.save(); c.font = `italic ${o.weight ?? 500} ${px}px ${SERIF}`; c.textAlign = o.align ?? 'center'; c.textBaseline = 'alphabetic';
  c.shadowColor = o.shade ?? 'rgba(6,5,18,0.9)'; c.shadowBlur = px * 0.5; c.globalAlpha = o.alpha ?? 1; c.fillStyle = o.color ?? '#fff1d8';
  c.fillText(s, x, y); c.restore();
};

// ------------------------------------------------------------------ the cold open
function nebula(c, w, h, drain = 0) {
  const r = K.RNG(63);
  T.sky(c, w, h, CANON.pal.NEBULA, r, 110);
  c.save(); c.globalCompositeOperation = 'screen'; c.lineCap = 'round';
  for (let i = 0; i < 9; i++) { const rr = Math.min(w, h) * (0.5 + i * 0.13), a0 = r() * 6.28; c.strokeStyle = K.rgba([255, 236, 180], 0.05 + r() * 0.05); c.lineWidth = 10 + r() * 30; c.beginPath(); c.ellipse(w / 2, h * 0.52, rr, rr * 0.84, 0.2, a0, a0 + 1.2 + r()); c.stroke(); }
  c.restore();
  K.glow(c, w / 2, h * 0.5, Math.max(w, h) * 0.7, [255, 226, 150], 0.35 * (1 - 0.7 * drain), 'screen');
  if (drain > 0) {
    // the colour drains inward from the edge: ash, then nothing
    const g = c.createRadialGradient(w / 2, h * 0.5, Math.min(w, h) * (0.55 - 0.3 * drain), w / 2, h * 0.5, Math.hypot(w, h) * 0.55);
    g.addColorStop(0, 'rgba(60,56,64,0)'); g.addColorStop(0.5, `rgba(52,50,60,${0.55 * drain})`); g.addColorStop(1, `rgba(12,11,20,${0.92 * drain})`);
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.save(); c.globalCompositeOperation = 'saturation'; c.fillStyle = `rgba(128,128,128,${0.6 * drain})`; c.fillRect(0, 0, w, h); c.restore();
  }
  T.finish(c, w, h, 71, 0.25);
}
/** their music of light: ribbons of beads between the two of them, one per voice; `broken` kinks one (the wrong note) */
function music(c, ax, ay, bx, by, u, broken = 0, fade = 1) {
  const r = K.RNG(17);
  for (let k = 0; k < 4; k++) {
    const lift = (k - 1.5) * 26 * u, wob = 0.6 + 0.4 * r();
    const pts = []; for (let i = 0; i <= 40; i++) { const t = i / 40, x = ax + (bx - ax) * t, y = ay + (by - ay) * t - Math.sin(t * Math.PI) * (70 * u + lift) + Math.sin(t * 14 * wob + k) * 6 * u; pts.push([x, y]); }
    const bad = k === 2 && broken > 0;
    c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
    c.strokeStyle = bad ? `rgba(200,190,210,${0.35 * fade})` : `rgba(255,226,160,${0.28 * fade})`; c.lineWidth = 3 * u;
    c.beginPath(); pts.forEach(([x, y], i) => { const yy = bad && i > 18 ? y + Math.sin(i * 2.3) * 14 * u * broken + (i - 18) * 2.2 * u * broken : y; if (i) c.lineTo(x, yy); else c.moveTo(x, yy); }); c.stroke();
    for (let i = 2; i < 40; i += 4) { const [x, y0] = pts[i], y = bad && i > 18 ? y0 + Math.sin(i * 2.3) * 14 * u * broken + (i - 18) * 2.2 * u * broken : y0; K.glow(c, x, y, (bad && i > 18 ? 5 : 9) * u, bad && i > 18 ? [170, 160, 190] : [255, 240, 200], 0.7 * fade); }
    c.restore();
  }
}
/** the Stillness, with a faint ash rim so its shape reads against the dark */
function dread(c, x, y, rx, ry, seed, near) {
  c.save(); c.shadowColor = 'rgba(176,168,196,0.55)'; c.shadowBlur = 26; P.stillness(c, x, y, rx, ry, K.RNG(seed), { near }); c.restore();
  P.stillness(c, x, y, rx, ry, K.RNG(seed), { near });
}
/** tendrils of it, from (x0, y0) curling round a point: dark, tapering, rimmed in ash */
function tendrils(c, x0, y0, tx, ty, u, n, seed) {
  const r = K.RNG(seed);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + r(), ex = tx + Math.cos(a) * (14 + r() * 26) * u, ey = ty + Math.sin(a) * (20 + r() * 34) * u;
    const c1 = [x0 + (tx - x0) * 0.3 + (r() - 0.5) * 120 * u, y0 + (r() - 0.5) * 160 * u], c2 = [tx + Math.cos(a + 1.4) * 70 * u, ty + Math.sin(a + 1.4) * 70 * u];
    for (const [col, wd, blur] of [['rgba(150,142,170,0.35)', 9, 12], ['rgba(5,4,10,0.96)', 6, 0]]) {
      c.save(); c.shadowColor = col; c.shadowBlur = blur; c.strokeStyle = blur ? col : col; c.lineCap = 'round';
      const steps = 24; let px = x0, py = y0;
      for (let k = 1; k <= steps; k++) {
        const t = k / steps, m = 1 - t;
        const x = m * m * m * x0 + 3 * m * m * t * c1[0] + 3 * m * t * t * c2[0] + t * t * t * ex, y = m * m * m * y0 + 3 * m * m * t * c1[1] + 3 * m * t * t * c2[1] + t * t * t * ey;
        c.lineWidth = Math.max(0.6, wd * u * (1 - t * 0.85)); c.beginPath(); c.moveTo(px, py); c.lineTo(x, y); c.stroke(); px = x; py = y;
      }
      c.restore();
    }
  }
}
export function cold(c, w, h, n) {
  const u = Math.min(w / 390, h / 844), cx = w / 2, cy = h * 0.5;
  if (n === 1) {
    // calm: the Harmonic Nebula, the brothers playing their music of light together
    nebula(c, w, h, 0);
    music(c, cx - 92 * u, cy + 8 * u, cx + 92 * u, cy - 6 * u, u);
    P.spark(c, cx - 110 * u, cy + 40 * u, 0.62 * u, { who: 'orbin', eyes: 'soft', arms: 'up', glow: 1, face: 1, crest: 1, ring: true, beat: 1, lite: false });
    P.spark(c, cx + 110 * u, cy + 26 * u, 0.62 * u, { who: 'helion', eyes: 'soft', arms: 'up', glow: 1, face: -1, crest: 1, ring: true, beat: 1 });
    for (let i = 0; i < 5; i++) { const x = w * (0.1 + 0.2 * i), y = h * (0.12 + 0.17 * (i % 3)); c.strokeStyle = 'rgba(255,244,210,0.4)'; c.lineWidth = 1.6 * u; c.beginPath(); c.moveTo(x - 70 * u, y - 8 * u); c.lineTo(x, y); c.stroke(); K.glow(c, x, y, 6 * u, [255, 250, 232], 0.9); }
  } else if (n === 2) {
    // wrongness: a close shot; one note goes wrong, the colour drains from the edges, something dark far away
    nebula(c, w, h, 0.75);
    dread(c, w * 0.9, h * 0.1, 120 * u, 90 * u, 91, 0.35);
    tendrils(c, w * 0.9, h * 0.12, w * 0.62, h * 0.24, u, 4, 7);
    music(c, cx - 120 * u, cy + 70 * u, cx + 120 * u, cy + 50 * u, u * 1.4, 1, 0.8);
    P.spark(c, cx - 150 * u, cy + 150 * u, 1.05 * u, { who: 'orbin', eyes: 'worried', arms: 'rest', glow: 0.9, face: 1, look: [0.6, -0.8], crest: 0.7 });
    P.spark(c, cx + 140 * u, cy + 120 * u, 1.05 * u, { who: 'helion', eyes: 'wide', arms: 'rest', glow: 0.85, face: 1, look: [1, -0.6], crest: 0.7 });
  } else if (n === 3) {
    // the taking: the Stillness reaches Helion and draws him away; Orbin reaches. The one interaction: hold.
    c.fillStyle = 'rgb(9,8,18)'; c.fillRect(0, 0, w, h);
    K.glow(c, cx, cy, Math.min(w, h) * 0.75, [255, 214, 140], 0.16, 'screen');
    dread(c, w * 1.02, cy - 60 * u, 300 * u, 400 * u, 48, 1);
    // he is being drawn into it: smaller, dimmer, wrapped in it, still reaching back
    const hx0 = w * 0.72, hy0 = cy - 50 * u;
    c.save(); c.globalAlpha = 0.75; P.spark(c, hx0, hy0, 0.46 * u, { who: 'helion', eyes: 'wide', arms: 'reach', glow: 0.4, face: -1, lean: -0.25, crest: 0.5 }); c.restore();
    tendrils(c, w * 1.0, cy - 80 * u, hx0, hy0 - 10 * u, u, 7, 13);
    P.spark(c, w * 0.32, cy + 10 * u, 0.64 * u, { who: 'orbin', eyes: 'wide', arms: 'reach', glow: 1, face: 1, lean: 0.35, crest: 1 });
    K.glow(c, w * 0.5, cy - 6 * u, 26 * u, [255, 240, 200], 0.55);
    // "Reach for him": a press-and-hold, its ring filling as you hold; however long you hold, his hand slips
    const hx = cx, hy = h * 0.84;
    c.strokeStyle = 'rgba(255,204,72,0.25)'; c.lineWidth = 3 * u; c.beginPath(); c.arc(hx, hy, 30 * u, 0, TAU); c.stroke();
    c.strokeStyle = 'rgba(255,204,72,0.95)'; c.lineWidth = 3.4 * u; c.beginPath(); c.arc(hx, hy, 30 * u, -Math.PI / 2, -Math.PI / 2 + TAU * 0.72); c.stroke();
    K.glow(c, hx, hy, 14 * u, [255, 220, 150], 0.8);
    write(c, 'Reach for him', hx, hy + 62 * u, 22 * u, { color: '#ffe6b8' });
    write(c, 'hold', hx, hy + 86 * u, 15 * u, { alpha: 0.7 });
  } else if (n === 4) {
    // the shockwave has passed: black, silence, and three plain lines
    c.fillStyle = 'rgb(4,4,10)'; c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(255,250,236,0.06)'; c.lineWidth = 40 * u; c.beginPath(); c.arc(w * 0.74, cy, Math.hypot(w, h) * 0.8, 0, TAU); c.stroke();
    const lines = ['Orbin and Helion were the twin sparks', 'of the Harmonic Nebula.', 'The Stillness took Helion, and the music with him.', 'Wake the fallen stars. Bring your brother home.'];
    write(c, lines[0], cx, h * 0.42, 21 * u); write(c, lines[1], cx, h * 0.42 + 30 * u, 21 * u);
    write(c, lines[2], cx, h * 0.53, 19 * u, { alpha: 0.95 });
    write(c, lines[3], cx, h * 0.63, 21 * u, { color: '#ffe6b8' });
  }
}

// ------------------------------------------------------------------ the vessel
/** the Sleeper's back, as the game paints it (landingpaint.js, sleeper): a point at t along the curve */
function back(w, h, stars, t) {
  const { u, hy, sx, top } = LANDING.geo(w, h, stars);
  const p0 = [sx - 430 * u, hy + 150 * u], p1 = [sx - 360 * u, hy - 60 * u], p2 = [sx - 250 * u, top + 70 * u], p3 = [sx - 90 * u, top];
  const m = 1 - t, b = (i) => m * m * m * p0[i] + 3 * m * m * t * p1[i] + 3 * m * t * t * p2[i] + t * t * t * p3[i];
  return [b(0), b(1)];
}
export function vessel(c, w, h, stars, t = 3.1) {
  LANDING.paint(c, w, h, stars, t);
  const g = LANDING.geo(w, h, stars), u = g.u, N = 6, lit = Math.min(N, stars);
  // six sockets along its back, one for each of World 1's great stars; a lit one is a star set into the stone, and
  // light runs from it down the old channels in the rock to the hand that holds the fire
  const sock = Array.from({ length: N }, (_, i) => { const [x, y] = back(w, h, stars, 0.32 + i * 0.12); return [x + 10 * u, y + 16 * u]; });
  c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
  for (let i = 0; i < lit; i++) {
    const [x, y] = sock[i], col = LANDING.STAR_COLS[i % LANDING.STAR_COLS.length];
    // the channel: down the stone toward the hand, branching once
    const ex = g.fx + (i - 2.5) * 30 * u, ey = g.fy - 60 * u;
    c.strokeStyle = K.rgba([140, 230, 220], 0.32); c.lineWidth = 2.2 * u;
    c.beginPath(); c.moveTo(x, y); c.bezierCurveTo(x - 30 * u, y + 120 * u, ex + 60 * u, ey - 140 * u, ex, ey); c.stroke();
    c.strokeStyle = K.rgba([180, 250, 240], 0.5); c.lineWidth = 1 * u; c.stroke();
    if (i > 0) { const [px, py] = sock[i - 1]; c.strokeStyle = K.rgba([170, 240, 230], 0.45); c.lineWidth = 1.6 * u; c.beginPath(); c.moveTo(px, py); c.lineTo(x, y); c.stroke(); }
  }
  c.restore();
  for (let i = 0; i < N; i++) {
    const [x, y] = sock[i];
    c.fillStyle = 'rgba(2,10,14,0.85)'; c.beginPath(); c.ellipse(x, y, 13 * u, 9 * u, -0.5, 0, TAU); c.fill();
    c.strokeStyle = i < lit ? 'rgba(170,240,230,0.7)' : 'rgba(90,140,150,0.35)'; c.lineWidth = 1.4 * u; c.beginPath(); c.ellipse(x, y, 13 * u, 9 * u, -0.5, 0, TAU); c.stroke();
    if (i < lit) LANDING.star(c, x, y, 0.2 * u, LANDING.STAR_COLS[i % LANDING.STAR_COLS.length], 1, 1 + i);
  }
  // with most of the stars home it stirs: the hand lifts a little from the ground, mist runs off its edges, and the
  // line of its keel shows under the moss (the planetoid is the vessel; the Landing is its deck)
  if (stars >= 4) {
    const y0 = g.hy + 150 * u;
    const kg = c.createLinearGradient(0, y0 - 20 * u, 0, y0 + 40 * u); kg.addColorStop(0, 'rgba(150,235,225,0)'); kg.addColorStop(0.5, 'rgba(150,235,225,0.35)'); kg.addColorStop(1, 'rgba(150,235,225,0)');
    c.save(); c.globalCompositeOperation = 'screen'; c.strokeStyle = kg; c.lineWidth = 3 * u; c.beginPath(); c.moveTo(g.sx - 470 * u, y0 + 10 * u); c.quadraticCurveTo(g.sx - 120 * u, y0 + 46 * u, g.sx + 160 * u, y0 - 8 * u); c.stroke(); c.restore();
    for (let i = 0; i < 14; i++) { const r = K.RNG(700 + i); const x = g.sx - 440 * u + r() * 600 * u, y = y0 + r() * 40 * u; K.glow(c, x, y, (30 + r() * 40) * u, [150, 210, 215], 0.08, 'screen'); }
  }
}

// ------------------------------------------------------------------ companions: three directions, none a star with dot eyes
const WORLD = { ember: [255, 150, 80], glass: [150, 205, 255], leaf: [130, 230, 160] };
/** A: the Kindling. A drop of the star's own fire with two pairs of moth wings made of light; no face. */
function kindling(c, x, y, s, col, o = {}) {
  const fl = o.flap ?? 0.6;
  K.glow(c, x, y, 70 * s, col, 0.35, 'screen');
  c.save(); c.translate(x, y); c.globalCompositeOperation = 'lighter';
  for (const k of [-1, 1]) for (const [ang, len, wid] of [[-0.55, 42, 18], [0.35, 30, 12]]) {
    c.save(); c.rotate(k * (ang - 0.25 * fl)); c.scale(k, 1);
    const g = c.createRadialGradient(len * 0.5 * s, 0, 0, len * 0.5 * s, 0, len * s); g.addColorStop(0, K.rgba(K.mix(col, [255, 255, 255], 0.4), 0.55)); g.addColorStop(1, K.rgba(col, 0));
    c.fillStyle = g; c.beginPath(); c.ellipse(len * 0.55 * s, 0, len * 0.6 * s, wid * 0.5 * s, 0, 0, TAU); c.fill();
    c.strokeStyle = K.rgba(K.mix(col, [255, 255, 255], 0.6), 0.45); c.lineWidth = 0.8 * s; c.stroke();
    c.restore();
  }
  c.restore();
  // the body: a drop of fire, bright at its heart, curling to a wisp below
  c.save(); c.translate(x, y);
  const b = c.createRadialGradient(0, -4 * s, 1, 0, 0, 16 * s); b.addColorStop(0, '#fffbea'); b.addColorStop(0.45, K.rgba(K.mix(col, [255, 255, 255], 0.5))); b.addColorStop(1, K.rgba(col, 0.9));
  c.fillStyle = b; c.beginPath(); c.moveTo(0, -18 * s); c.bezierCurveTo(10 * s, -8 * s, 10 * s, 8 * s, 0, 12 * s); c.bezierCurveTo(-10 * s, 8 * s, -10 * s, -8 * s, 0, -18 * s); c.fill();
  c.strokeStyle = K.rgba(col, 0.7); c.lineWidth = 2 * s; c.lineCap = 'round'; c.beginPath(); c.moveTo(0, 12 * s); c.bezierCurveTo(6 * s, 22 * s, -8 * s, 28 * s, 2 * s, 38 * s); c.stroke();
  c.restore();
}
/** B: the Orrlet. A pebble of warm light with its own tiny moons on tilted orbits; it acts by opening its orbit. */
function orrlet(c, x, y, s, col, o = {}) {
  const open = o.open ?? 0;
  K.glow(c, x, y, 60 * s, col, 0.3, 'screen');
  const R = 13 * s;
  for (const [rx, ry, rot, ph] of [[34, 10, -0.35, 0.6], [26, 8, 0.5, 2.4]]) {
    const k = 1 + open * 0.9;
    c.save(); c.translate(x, y); c.rotate(rot);
    c.strokeStyle = K.rgba(K.mix(col, [255, 255, 255], 0.5), 0.6); c.lineWidth = 1.2 * s;
    c.beginPath(); c.ellipse(0, 0, rx * s * k, ry * s * k * (1 + open * 1.5), 0, Math.PI, TAU); c.stroke();
    c.restore();
  }
  T.sphere ? DUSK.tools.sphere(c, x, y, R, K.mix(col, [40, 30, 30], 0.3), K.mix(col, [255, 255, 255], 0.55), [40, 26, 30], -0.7, K.RNG(9)) : null;
  K.glow(c, x - 3 * s, y - 4 * s, 7 * s, [255, 250, 235], 0.8);
  for (const [rx, ry, rot, ph] of [[34, 10, -0.35, 0.6], [26, 8, 0.5, 2.4]]) {
    const k = 1 + open * 0.9;
    c.save(); c.translate(x, y); c.rotate(rot);
    c.strokeStyle = K.rgba(K.mix(col, [255, 255, 255], 0.5), 0.75); c.lineWidth = 1.2 * s;
    c.beginPath(); c.ellipse(0, 0, rx * s * k, ry * s * k * (1 + open * 1.5), 0, 0, Math.PI); c.stroke();
    const mx = Math.cos(ph) * rx * s * k, my = Math.sin(ph) * ry * s * k * (1 + open * 1.5);
    c.fillStyle = '#fff6e0'; c.beginPath(); c.arc(mx, my, 3 * s, 0, TAU); c.fill(); K.glow(c, mx, my, 8 * s, col, 0.7);
    c.restore();
  }
}
/** C: the Bellseed. A seed pod like a small hanging bell, one slit of light where it sings; three fine tendrils. */
function bellseed(c, x, y, s, col, o = {}) {
  const open = o.open ?? 0;
  K.glow(c, x, y + 6 * s, 64 * s, col, 0.3, 'screen');
  c.save(); c.translate(x, y);
  c.strokeStyle = K.rgba(K.mix(col, [255, 255, 255], 0.3), 0.7); c.lineWidth = 1.4 * s; c.lineCap = 'round';
  c.beginPath(); c.moveTo(0, -26 * s); c.bezierCurveTo(4 * s, -36 * s, -6 * s, -44 * s, 2 * s, -54 * s); c.stroke(); // the stem it hangs from
  const g = c.createLinearGradient(0, -26 * s, 0, 18 * s); g.addColorStop(0, K.rgba(K.mix(col, [30, 30, 40], 0.55))); g.addColorStop(1, K.rgba(K.mix(col, [20, 20, 30], 0.3)));
  c.fillStyle = g; c.beginPath(); c.moveTo(0, -26 * s); c.bezierCurveTo(18 * s, -24 * s, 16 * s + 10 * s * open, 6 * s, 22 * s + 14 * s * open, 16 * s); c.quadraticCurveTo(0, 10 * s - 8 * s * open, -22 * s - 14 * s * open, 16 * s); c.bezierCurveTo(-16 * s - 10 * s * open, 6 * s, -18 * s, -24 * s, 0, -26 * s); c.fill();
  c.strokeStyle = K.rgba(K.mix(col, [255, 255, 255], 0.5), 0.55); c.lineWidth = 1 * s; c.stroke();
  // its one sign of life: a slit of light across the bell, brighter when it sings (never eyes)
  // (a straight upright seam, like the split in a seed pod: never a curve that could read as a mouth)
  c.strokeStyle = 'rgba(255,250,230,0.95)'; c.lineWidth = 2 * s; c.beginPath(); c.moveTo(0, -16 * s); c.lineTo(0, 8 * s + 4 * s * open); c.stroke();
  K.glow(c, 0, -4 * s, 16 * s, [255, 240, 200], 0.6 + 0.3 * open);
  for (const k of [-1, 0, 1]) { c.strokeStyle = K.rgba(col, 0.6); c.lineWidth = 1 * s; c.beginPath(); c.moveTo(k * 8 * s, 14 * s); c.bezierCurveTo(k * 12 * s, 26 * s, k * 4 * s, 34 * s, k * 10 * s, 44 * s); c.stroke(); K.glow(c, k * 10 * s, 44 * s, 4 * s, col, 0.8); }
  c.restore();
}
export function companions(c, w, h) {
  const r = K.RNG(5);
  T.sky(c, w, h, [[0, [8, 14, 30]], [0.6, [14, 30, 46]], [1, [10, 22, 30]]], r, 60);
  T.stars(c, w, h, r, 260, 4);
  const cols = [WORLD.ember, WORLD.glass, WORLD.leaf], pw = w / 3, u = Math.min(pw / 520, h / 900);
  const kinds = [
    ['A. The Kindlings', 'a drop of its star’s fire with moth wings of light', 'as a mode portal: it opens its wings round him and he takes its shape', 'as a launch star: it folds into a burning seed and throws him', kindling],
    ['B. The Orrlets', 'a pebble of starlight with its own tiny moons', 'as a mode portal: it opens its orbit and he flies through the ring', 'as a launch star: its moons spin up, and the ring flings him on', orrlet],
    ['C. The Bellseeds', 'a seed like a small hanging bell, one slit of light where it sings', 'as a mode portal: it rings, and its note changes how he moves', 'as a launch star: the bell opens like a flower and throws him', bellseed]
  ];
  kinds.forEach(([name, what, portal, launch, draw], i) => {
    const x0 = i * pw, cx = x0 + pw / 2;
    if (i) { c.strokeStyle = 'rgba(160,210,220,0.12)'; c.lineWidth = 1; c.beginPath(); c.moveTo(x0, h * 0.08); c.lineTo(x0, h * 0.94); c.stroke(); }
    write(c, name, cx, h * 0.09, 30 * u * 1.3, { weight: 600 });
    write(c, what, cx, h * 0.09 + 34 * u * 1.3, 17 * u * 1.3, { alpha: 0.85 });
    draw(c, cx, h * 0.36, 2.6 * u * 1.3, cols[0], {});
    // its world colours: the children of different stars
    cols.forEach((col, k) => draw(c, cx + (k - 1) * 120 * u * 1.3, h * 0.6, 0.9 * u * 1.3, col, {}));
    write(c, 'Emberwick, Glassmere, Verdance', cx, h * 0.6 + 70 * u * 1.3, 14 * u * 1.3, { alpha: 0.6 });
    // in a level: the portal and the launch
    const py = h * 0.8;
    draw(c, cx - 90 * u * 1.3, py, 1.2 * u * 1.3, cols[0], { open: 0.8, flap: 1 });
    c.save(); c.strokeStyle = 'rgba(255,204,72,0.9)'; c.lineWidth = 2.4 * u; c.beginPath(); c.arc(cx - 90 * u * 1.3, py, 44 * u * 1.3, 0, TAU); c.stroke(); c.restore();
    draw(c, cx + 90 * u * 1.3, py, 1.2 * u * 1.3, cols[0], { open: 0.4 });
    write(c, portal, cx, h * 0.9, 13.5 * u * 1.3, { alpha: 0.8 });
    write(c, launch, cx, h * 0.9 + 20 * u * 1.3, 13.5 * u * 1.3, { alpha: 0.8 });
  });
  T.finish(c, w, h, 19, 0.3);
}
