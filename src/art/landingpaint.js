// The Landing as a resting place (Afterglow): the planetoid Orbin fell on, at night. Two lights: cool starlight over
// everything, and one warm fire, made of the stars he has brought home. Five layers, each hazier and cooler with
// distance, painted once each so they can slide past one another when the camera moves:
//   sky      the night, a pale cluster high to one side, and on the horizon the guardian, the three rings, his brother's signal
//   far      mist, and the far ridge
//   sleeper  the Sleeper: the planetoid itself, an old being of stone. The hill is its bowed head and shoulder
//   ground   the ground he rests on, and the Sleeper's open hand behind the fire: four thick fingers, close together
//   front    the heel of that hand and its thumb, the stone he leans on, grass and small flowers
// The fire, its sparks, the stars in its heart, the motes and Orbin are drawn live, between `ground` and `front`.
// Every shape is our own. Plain JavaScript, shared with the stills (mockups/art).
import { CANON } from './canonpaint.js';
import { DUSK, K } from './painter.js';

const T = DUSK.tools, P = CANON.parts, TAU = Math.PI * 2;
/** each star's own colour, for the thin orbit round it: the planetoid's, then the four worlds' */
const STAR_COLS = [[255, 226, 170], [214, 96, 60], [170, 110, 220], [90, 140, 230], [80, 190, 140], [255, 240, 200]];
const NIGHT = [[0, [3, 7, 20]], [0.45, [7, 22, 44]], [0.8, [12, 46, 66]], [1, [22, 72, 84]]];

/** Our own star: a node's star, risen. A small hot heart, eight uneven rays, and one thin orbit tilted round it in its world's colour. */
function star(c, x, y, s, col = STAR_COLS[0], a = 1, turn = 0) {
  K.glow(c, x, y, 150 * s, [255, 226, 160], 0.75 * a); K.glow(c, x, y, 60 * s, [255, 252, 236], 0.9 * a);
  c.save(); c.translate(x, y); c.globalAlpha = a;
  c.fillStyle = '#fff6dc'; c.beginPath();
  for (let i = 0; i < 16; i++) { const q = -Math.PI / 2 + (i * Math.PI) / 8, r = (i % 2 ? 9 : i % 4 === 0 ? 34 : 22) * s; c.lineTo(Math.cos(q) * r, Math.sin(q) * r); }
  c.closePath(); c.fill();
  c.rotate(-0.4); c.strokeStyle = K.rgba(col, 0.95); c.lineWidth = Math.max(1, 2.6 * s); c.beginPath(); c.ellipse(0, 0, 46 * s, 13 * s, 0, 0, TAU); c.stroke();
  c.fillStyle = K.rgba(col); c.beginPath(); c.arc(Math.cos(turn) * 46 * s, Math.sin(turn) * 13 * s, Math.max(1, 4 * s), 0, TAU); c.fill();
  c.restore();
}

/** Where things are at this size. stars: how many are home (0..5). */
function geo(w, h, stars = 0) {
  const tall = h > w, u = tall ? (h / 1688) * 1.15 : (h / 1350) * 1.25, k = Math.max(0, Math.min(1, stars / 5));
  const hy = h * (tall ? 0.52 : 0.5), fx = w * (tall ? 0.56 : 0.54), fy = h * 0.8;
  const fire = stars <= 0 ? 0 : 0.12 + 0.88 * Math.sqrt(k), F = (26 + 150 * fire) * u;
  const sx = w * (tall ? 0.8 : 0.78), top = hy - (tall ? 210 : 250) * u, ex = w * (tall ? 0.27 : 0.24);
  return { tall, u, k, hy, fx, fy, fire, F, sx, top, ex, signal: [ex + 6 * u, hy - 124 * u], seam: [sx - 60 * u, top + 150 * u], orbin: [fx - (tall ? 250 : 320) * u, fy + 6 * u] };
}

function sky(c, w, h, stars) {
  const g = geo(w, h, stars), { u, k, hy, ex } = g, r = K.RNG(301);
  T.sky(c, w, h, NIGHT, r, 90);
  T.stars(c, w, hy, r, Math.round(((w * h) / 2600) * (0.5 + 0.8 * k)), 5);
  K.glow(c, w * 0.2, h * 0.1, 520 * u, [150, 220, 235], 0.4, 'screen'); K.glow(c, w * 0.2, h * 0.1, 90 * u, [225, 248, 255], 0.75); // the cool light
  P.trials(c, ex, hy - 120 * u, 0.5 * u, K.RNG(41), 0.9); P.guardian(c, ex + 18 * u, hy + 4, 0.1 * u, K.RNG(42), stars >= 2 ? 1 : 0);
  c.fillStyle = 'rgba(10,30,46,0.55)'; c.fillRect(0, hy - 40 * u, w, 60 * u + h); // distance: cooler, hazier (and nothing below the horizon shows through the layers in front)
  T.finish(c, w, h, 311, 0.4);
}

function far(c, w, h, stars) {
  const { u, hy } = geo(w, h, stars);
  for (let i = 0; i < 7; i++) { const y = hy + (i - 1) * 16 * u, g = c.createLinearGradient(0, y - 30 * u, 0, y + 30 * u); g.addColorStop(0, 'rgba(120,190,200,0)'); g.addColorStop(0.5, `rgba(120,190,200,${0.05 + 0.03 * (i % 3)})`); g.addColorStop(1, 'rgba(120,190,200,0)'); c.fillStyle = g; c.fillRect(-w, y - 30 * u, w * 3, 60 * u); }
  c.fillStyle = 'rgb(6,20,30)'; c.beginPath(); c.moveTo(-w, hy + 26 * u); for (let x = -w; x <= w * 2; x += w / 24) c.lineTo(x, hy + 20 * u + Math.sin(x * 0.004 + 1) * 12 * u + Math.sin(x * 0.013) * 5 * u); c.lineTo(w * 2, h * 2); c.lineTo(-w, h * 2); c.fill();
}

function sleeper(c, w, h, stars) {
  const { u, k, hy, sx, top } = geo(w, h, stars), r = K.RNG(305);
  const head = () => { c.beginPath(); c.moveTo(sx - 430 * u, hy + 150 * u); c.bezierCurveTo(sx - 360 * u, hy - 60 * u, sx - 250 * u, top + 70 * u, sx - 90 * u, top); c.bezierCurveTo(sx + 60 * u, top - 50 * u, sx + 220 * u, top + 40 * u, sx + 300 * u, hy - 30 * u); c.lineTo(w * 2, hy + 20 * u); c.lineTo(w * 2, h * 2); c.lineTo(sx - 430 * u, h * 2); c.closePath(); };
  head(); const hg = c.createLinearGradient(0, top, 0, hy + 200 * u); hg.addColorStop(0, 'rgb(10,34,44)'); hg.addColorStop(1, 'rgb(5,16,24)'); c.fillStyle = hg; c.fill();
  c.save(); head(); c.clip();
  c.strokeStyle = 'rgba(150,225,235,0.5)'; c.lineWidth = 5 * u; c.beginPath(); c.moveTo(sx - 430 * u, hy + 150 * u); c.bezierCurveTo(sx - 360 * u, hy - 60 * u, sx - 250 * u, top + 70 * u, sx - 90 * u, top); c.stroke(); // the cool light on its near edge
  for (let i = 0; i < 70 * k; i++) { const x = sx - 380 * u + r() * 620 * u, y = top + 20 * u + r() * 300 * u; c.strokeStyle = `rgba(70,150,120,${0.25 + 0.3 * r()})`; c.lineWidth = 1.6 * u; c.beginPath(); c.moveTo(x, y); c.lineTo(x + (r() - 0.5) * 8 * u, y - (8 + r() * 12) * u); c.stroke(); } // moss and grass come back on it
  c.restore();
}

/** Its one sign of life: a long closed seam where an eye would be, a little open once stars are home (never a face). breath: 0..1, live. */
function seam(c, w, h, stars, breath = 0) {
  const { u, k, seam: [ax, ay] } = geo(w, h, stars), open = 4 * u + 16 * u * k + 2 * u * breath;
  c.strokeStyle = `rgba(150,235,225,${0.3 + 0.5 * k + 0.08 * breath})`; c.lineWidth = 2.4 * u; c.lineCap = 'round';
  c.beginPath(); c.moveTo(ax - 90 * u, ay); c.quadraticCurveTo(ax, ay + open, ax + 90 * u, ay - 6 * u); c.stroke();
  if (k > 0) { K.glow(c, ax, ay + open * 0.3, 120 * u, [120, 230, 215], (0.2 + 0.08 * breath) * Math.min(1, k * 2)); c.beginPath(); c.moveTo(ax - 90 * u, ay); c.quadraticCurveTo(ax, ay - open * 0.5, ax + 90 * u, ay - 6 * u); c.stroke(); }
}

/** A limb of stone drawn as one thick curved stroke (a finger, the thumb, the palm): body, then its two lights. */
function limb(c, pts, wd, u, warm, inner, body = 'rgb(7,22,28)') {
  const path = () => { c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); c.bezierCurveTo(pts[1][0], pts[1][1], pts[2][0], pts[2][1], pts[3][0], pts[3][1]); };
  c.lineCap = 'round'; c.lineJoin = 'round';
  path(); c.strokeStyle = 'rgba(2,8,12,0.55)'; c.lineWidth = wd + 5 * u; c.stroke();   // a dark edge, so one finger stands off the next
  path(); c.strokeStyle = body; c.lineWidth = wd; c.stroke();
  // light: warm on the side that faces the fire (inner: -1 left of the stroke's direction, +1 right), cool starlight on the other
  const side = (k, col, lw) => {
    c.beginPath();
    for (let i = 0; i <= 20; i++) {
      const t = 0.08 + 0.84 * (i / 20), m = 1 - t;
      const x = m * m * m * pts[0][0] + 3 * m * m * t * pts[1][0] + 3 * m * t * t * pts[2][0] + t * t * t * pts[3][0], y = m * m * m * pts[0][1] + 3 * m * m * t * pts[1][1] + 3 * m * t * t * pts[2][1] + t * t * t * pts[3][1];
      const dx = 3 * m * m * (pts[1][0] - pts[0][0]) + 6 * m * t * (pts[2][0] - pts[1][0]) + 3 * t * t * (pts[3][0] - pts[2][0]), dy = 3 * m * m * (pts[1][1] - pts[0][1]) + 6 * m * t * (pts[2][1] - pts[1][1]) + 3 * t * t * (pts[3][1] - pts[2][1]), d = Math.hypot(dx, dy) || 1;
      const px = x + (-dy / d) * k * wd * 0.44, py = y + (dx / d) * k * wd * 0.44;
      if (i) c.lineTo(px, py); else c.moveTo(px, py);
    }
    c.strokeStyle = col; c.lineWidth = lw; c.stroke();
  };
  side(inner, `rgba(255,172,98,${0.08 + 0.5 * warm})`, 3 * u);
  side(-inner, 'rgba(150,225,235,0.26)', 2.2 * u);
}
/** where a finger bends: a short crease across it */
function crease(c, pts, t, wd, u) {
  const m = 1 - t, x = m * m * m * pts[0][0] + 3 * m * m * t * pts[1][0] + 3 * m * t * t * pts[2][0] + t * t * t * pts[3][0], y = m * m * m * pts[0][1] + 3 * m * m * t * pts[1][1] + 3 * m * t * t * pts[2][1] + t * t * t * pts[3][1];
  const dx = 3 * m * m * (pts[1][0] - pts[0][0]) + 6 * m * t * (pts[2][0] - pts[1][0]) + 3 * t * t * (pts[3][0] - pts[2][0]), dy = 3 * m * m * (pts[1][1] - pts[0][1]) + 6 * m * t * (pts[2][1] - pts[1][1]) + 3 * t * t * (pts[3][1] - pts[2][1]), d = Math.hypot(dx, dy) || 1;
  c.strokeStyle = 'rgba(2,8,12,0.6)'; c.lineWidth = 2 * u; c.beginPath(); c.moveTo(x - (-dy / d) * wd * 0.34, y - (dx / d) * wd * 0.34); c.lineTo(x + (-dy / d) * wd * 0.34, y + (dx / d) * wd * 0.34); c.stroke();
}
/** The Sleeper's hand, cupped round the fire, seen from the side: the fingers rise behind it and curl over; the palm is under it. */
const hand = (g) => { const { u, fx, fy, tall } = g, s = (tall ? 1 : 1.1) * u, at = (x, y) => [fx + x * s, fy + y * s];
  return { s,
    fingers: [3, 2, 1, 0].map((i) => ({ wd: (74 - i * 5) * s, body: `rgb(${7 + i * 2},${22 + i * 5},${28 + i * 6})`, pts: [at(196 + 10 * i, 34 - 4 * i), at(318 + 16 * i, -70 - 16 * i), at(262 + 12 * i, -214 - 30 * i), at(112 - 2 * i, -236 - 34 * i)] })),
    palm: { wd: 64 * s, pts: [at(-118, 50), at(-40, 86), at(120, 88), at(214, 40)] },
    thumb: { wd: 78 * s, pts: [at(-108, 54), at(-196, 30), at(-206, -64), at(-128, -104)] } }; };

function ground(c, w, h, stars) {
  const g = geo(w, h, stars), { u, hy, fx, fy, fire } = g, H = hand(g), s = H.s;
  const gg = c.createLinearGradient(0, hy + 100 * u, 0, h); gg.addColorStop(0, 'rgb(6,24,30)'); gg.addColorStop(1, 'rgb(3,10,16)');
  c.fillStyle = gg; c.beginPath(); c.moveTo(-w, hy + 200 * u); c.quadraticCurveTo(w * 0.5, hy + 110 * u, w * 2, hy + 180 * u); c.lineTo(w * 2, h * 2); c.lineTo(-w, h * 2); c.fill();
  if (fire > 0) K.glow(c, fx, fy, (190 + 420 * fire) * u, [255, 150, 70], 0.1 + 0.2 * fire, 'screen'); // the fire's light on the ground (its flicker is live)
  // the arm: a long low ridge from the shoulder down to the wrist
  c.strokeStyle = 'rgb(6,20,27)'; c.lineCap = 'round'; c.lineWidth = 120 * s; c.beginPath(); c.moveTo(fx + 250 * s, fy + 62 * s); c.bezierCurveTo(fx + 520 * s, fy + 40 * s, fx + 700 * s, fy - 60 * s, w * 1.6, hy + 190 * u); c.stroke();
  c.strokeStyle = 'rgba(150,225,235,0.2)'; c.lineWidth = 2.4 * u; c.beginPath(); c.moveTo(fx + 300 * s, fy + 2 * s); c.bezierCurveTo(fx + 520 * s, fy - 20 * s, fx + 700 * s, fy - 120 * s, w * 1.6, hy + 130 * u); c.stroke();
  for (const f of H.fingers) { limb(c, f.pts, f.wd, u, fire, -1, f.body); crease(c, f.pts, 0.38, f.wd, u); crease(c, f.pts, 0.68, f.wd, u); }
  limb(c, H.palm.pts, H.palm.wd, u, fire, -1, 'rgb(7,22,28)');
}

function front(c, w, h, stars) {
  const g = geo(w, h, stars), { u, k, fx, fy, fire, orbin: [ox, oy] } = g, r = K.RNG(307), H = hand(g);
  // the thumb, curled in on the near side
  limb(c, H.thumb.pts, H.thumb.wd, u, fire, 1, 'rgb(6,19,25)'); crease(c, H.thumb.pts, 0.5, H.thumb.wd, u);
  // the stone he leans on
  c.fillStyle = 'rgb(7,20,26)'; c.beginPath(); c.ellipse(ox - 62 * u, oy + 30 * u, 96 * u, 40 * u, -0.1, 0, TAU); c.fill();
  c.strokeStyle = `rgba(255,176,104,${0.08 + 0.3 * fire})`; c.lineWidth = 2.4 * u; c.beginPath(); c.ellipse(ox - 62 * u, oy + 30 * u, 96 * u, 40 * u, -0.1, -1.3, -0.1); c.stroke();
  // grass and small flowers: dark against the fire, lit warm where they face it
  const flowers = Math.round((4 + 64 * k) * (w / 780) * (g.tall ? 2 : 1));
  for (let i = 0; i < 44 + flowers * 2; i++) { const x = -w * 0.3 + r() * w * 1.6, y = h - r() * r() * 280 * u, len = (14 + r() * 30) * u, near = Math.max(0, 1 - Math.hypot(x - fx, y - fy) / (700 * u)); c.strokeStyle = K.rgba(K.mix([14, 60, 54], [220, 150, 80], near * fire * 0.8), 0.75); c.lineWidth = 2.2 * u; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + (r() - 0.5) * 10 * u, y - len * 0.6, x + (r() - 0.5) * 16 * u, y - len); c.stroke(); }
  for (let i = 0; i < flowers; i++) { const x = r() * w, y = h - r() * 240 * u, s2 = (3.2 + r() * 3.2) * u, near = Math.max(0, 1 - Math.hypot(x - fx, y - fy) / (700 * u)); K.glow(c, x, y, s2 * 3.4, K.mix([150, 230, 225], [255, 220, 160], near), 0.28); c.fillStyle = K.rgba(K.mix([210, 245, 240], [255, 240, 205], near)); for (let p2 = 0; p2 < 5; p2++) { c.beginPath(); c.arc(x + Math.cos(p2 * 1.257) * s2, y + Math.sin(p2 * 1.257) * s2, s2 * 0.62, 0, TAU); c.fill(); } }
}

/** The fire, live: its light on the ground, its flames, the stars in its heart, its sparks. t: seconds. grow: 0..1 extra (a star just set in it). */
function flames(c, w, h, stars, t, grow = 0, lift = 1) {
  const g = geo(w, h, stars), { u, fx, fy } = g, fire = Math.min(1, g.fire * lift + 0.25 * grow), F = (26 + 150 * fire) * u;
  if (fire <= 0.001) return;
  const flick = 0.9 + 0.1 * Math.sin(t * 9.1) * Math.sin(t * 3.7);
  K.glow(c, fx, fy - F * 0.3, (110 + 250 * fire) * u * flick, [255, 150, 70], 0.1 + 0.16 * fire, 'screen');
  c.save(); c.globalCompositeOperation = 'lighter';
  const n = Math.round(6 + 14 * fire);
  for (let i = 0; i < n; i++) {
    const q = i * 2.399, ph = t * (1.6 + (i % 5) * 0.37) + q, bx = fx + Math.sin(q * 1.7) * F * 0.42, kk = 1 - Math.abs(bx - fx) / (F * 0.6);
    const hh = F * (0.62 + 0.3 * Math.sin(ph) + 0.16 * Math.sin(ph * 2.3 + 1)) * Math.max(0.25, kk), wd = (8 + (i % 4) * 3) * u * (0.5 + fire), lean = Math.sin(ph * 0.7 + i) * 14 * u;
    c.fillStyle = K.rgba(i % 3 === 0 ? [255, 228, 160] : i % 3 === 1 ? [255, 150, 70] : [230, 84, 50], 0.2);
    c.beginPath(); c.moveTo(bx - wd, fy + 10 * u); c.bezierCurveTo(bx - wd * 1.3, fy - hh * 0.4, bx + lean - wd * 0.2, fy - hh * 0.8, bx + lean, fy - hh); c.bezierCurveTo(bx + lean + wd * 0.4, fy - hh * 0.7, bx + wd * 1.3, fy - hh * 0.35, bx + wd, fy + 10 * u); c.closePath(); c.fill();
  }
  c.restore();
  K.glow(c, fx, fy, F * 0.7, [255, 238, 196], 0.5 * flick);
  // each star, small, in the heart of it, turning slowly
  for (let i = 0; i < stars; i++) { const a = -Math.PI / 2 + (i - (stars - 1) / 2) * 0.62; star(c, fx + Math.cos(a) * F * 0.34, fy - 8 * u + Math.sin(a) * F * 0.16 + Math.sin(t * 1.3 + i) * 1.5 * u, Math.max(0.1, 0.22 * u), STAR_COLS[i % STAR_COLS.length], 1, t * 0.8 + i); }
  // sparks, rising
  const sn = Math.round(6 + 26 * fire);
  for (let i = 0; i < sn; i++) { const life = (t * (0.22 + (i % 7) * 0.03) + i * 0.137) % 1, x = fx + Math.sin(i * 12.9 + life * 3) * (20 + 90 * life) * u, y = fy - F * (0.5 + 2.6 * life); c.fillStyle = `rgba(255,${200 + (i % 3) * 20},130,${(1 - life) * 0.8})`; c.beginPath(); c.arc(x, y, (0.9 + (i % 3) * 0.7) * u, 0, TAU); c.fill(); }
  // the wood
  c.strokeStyle = 'rgb(8,14,18)'; c.lineCap = 'round'; c.lineWidth = Math.max(4, 12 * u * (0.6 + 0.4 * fire)); c.beginPath(); c.moveTo(fx - F * 0.42, fy + 18 * u); c.lineTo(fx + F * 0.36, fy + 6 * u); c.moveTo(fx - F * 0.3, fy + 4 * u); c.lineTo(fx + F * 0.42, fy + 20 * u); c.stroke();
}

/** Motes of light, drifting: live. */
function motes(c, w, h, stars, t) {
  const { u, k, hy } = geo(w, h, stars), n = Math.round(24 + 50 * k);
  for (let i = 0; i < n; i++) { const sp = 0.012 + (i % 5) * 0.004, x = ((i * 0.6180339 + t * sp) % 1) * w, y = hy + ((i * 0.3819 + Math.sin(t * 0.2 + i) * 0.03 + 1) % 1) * (h - hy); c.fillStyle = `rgba(160,240,230,${0.14 + 0.3 * (0.5 + 0.5 * Math.sin(t * 0.9 + i * 2.1))})`; c.beginPath(); c.arc(x, y, (0.8 + (i % 3) * 0.6) * u, 0, TAU); c.fill(); }
}

/** His brother's signal on the horizon: small, far, always there; thump-thump. Live. */
function signal(c, w, h, stars, t) {
  const { u, signal: [x, y] } = geo(w, h, stars), ph = (t * 0.55) % 1, beat = Math.max(Math.exp(-ph * 9), ph > 0.18 ? Math.exp(-(ph - 0.18) * 9) : 0);
  K.glow(c, x, y, (16 + 7 * stars + 12 * beat) * u, [255, 214, 140], (0.3 + 0.08 * stars) * (0.6 + 0.4 * beat)); c.fillStyle = 'rgba(255,240,205,0.9)'; c.beginPath(); c.arc(x, y, Math.max(1, 1.8 * u), 0, TAU); c.fill();
}

/** The whole picture at once, still (for the stills, and for anything that wants one frame). */
function paint(c, w, h, stars, t = 2) {
  sky(c, w, h, stars); signal(c, w, h, stars, t); far(c, w, h, stars); sleeper(c, w, h, stars); seam(c, w, h, stars); ground(c, w, h, stars); flames(c, w, h, stars, t);
  const g = geo(w, h, stars);
  c.save(); c.translate(g.orbin[0], g.orbin[1] - 44 * g.u); c.rotate(-0.5); P.spark(c, 0, 0, 0.74 * g.u, { glow: 0.6 + 0.3 * g.k, eyes: 'closed', crest: 0.2, arms: 'rest', ring: true, face: 1, beat: 0.4 }); c.restore();
  front(c, w, h, stars); motes(c, w, h, stars, t);
}

export const LANDING = { STAR_COLS, star, geo, sky, far, sleeper, seam, ground, front, flames, motes, signal, paint };
