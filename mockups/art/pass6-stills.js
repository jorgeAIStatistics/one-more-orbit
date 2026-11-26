// Emberwick as a journey (the owner's brief, 2026-11-26): a storyboard, painted with the game's brushes. The route
// through four places (a cold outer moon, the forge ring, a chain of small lava moons, the dive into the core), the
// launches between them, the new path shapes, Emberwick's own objects, and three interactions (pad, orb, wall) each in
// three beats: anticipation, contact, follow-through. Not used by the game.
import { DUSK, K } from '../../src/art/painter.js';
import { WORLDS as W } from '../../src/art/worldpaint.js';
import { COMPANIONS } from '../../src/art/companions.js';
import { CANON } from '../../src/art/canonpaint.js';

const T = DUSK.tools, TAU = Math.PI * 2, P = CANON.parts;
const SERIF = '"Cormorant Garamond", "Hoefler Text", Baskerville, Palatino, Georgia, serif';
const TAP = [255, 204, 72], STONE = [84, 94, 140], WOKEN = [128, 150, 222], HALO = 'rgba(3,5,14,0.88)', EMB = [255, 140, 60], SOFT = [150, 190, 255];
const lerp = (a, b, t) => a + (b - a) * t;
const KIN = COMPANIONS.KINDLE.heroes;

// ---------------------------------------------------------------- the pieces
function sky(c, w, h, warm, seed = 11) {
  const r = K.RNG(seed);
  T.sky(c, w, h, warm ? [[0, [24, 10, 26]], [0.55, [70, 30, 46]], [1, [120, 60, 52]]] : [[0, [10, 10, 22]], [0.55, [26, 22, 40]], [1, [34, 26, 40]]], r, 70);
  T.stars(c, w, h, r, Math.round((w * h) / 1600), 3);
}
function words(c, s, x, y, px, o = {}) {
  c.save(); c.font = `italic ${o.weight ?? 500} ${px}px ${SERIF}`; c.textAlign = o.align ?? 'center'; c.textBaseline = 'middle';
  c.shadowColor = 'rgba(6,5,18,0.95)'; c.shadowBlur = px * 0.6; c.globalAlpha = o.alpha ?? 1; c.fillStyle = o.color ?? '#fff1d8'; c.fillText(s, x, y); c.restore();
}
/** Emberwick itself: the game's own painting of the planet, cold or relit */
let layers = null;
function ember(c, x, y, R, hot) {
  layers ??= { cold: W.emberLayer(false), hot: W.emberLayer(true) };
  const cv = hot ? layers.hot : layers.cold, S = cv.width * (R / W.R0);
  c.drawImage(cv, x - S / 2, y - S / 2, S, S);
}
/** a small moon: the cold outer one (ash and frost), or a lava moonlet (a crust cracked over fire) */
function moon(c, x, y, R, kind, seed) {
  const r = K.RNG(seed);
  if (kind === 'ash') {
    T.sphere(c, x, y, R, [52, 54, 68], [140, 146, 170], [12, 12, 22], -0.8, r, { haze: 0.12, rim: 0.6 });
    c.save(); c.beginPath(); c.arc(x, y, R, 0, TAU); c.clip();
    for (let i = 0; i < 26; i++) { const a = r() * TAU, d = r() * R; c.fillStyle = `rgba(200,210,235,${0.06 + 0.1 * r()})`; c.beginPath(); c.ellipse(x + Math.cos(a) * d, y + Math.sin(a) * d, R * (0.06 + 0.12 * r()), R * (0.03 + 0.05 * r()), a, 0, TAU); c.fill(); }
    for (let i = 0; i < 7; i++) { const a = r() * TAU, d = r() * R * 0.8; c.strokeStyle = 'rgba(14,12,24,0.6)'; c.lineWidth = Math.max(1, R * 0.03); c.beginPath(); c.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, R * (0.06 + 0.1 * r()), 0, TAU); c.stroke(); }
    c.restore();
    return;
  }
  K.glow(c, x, y, R * 2.2, [255, 110, 50], 0.35, 'screen');
  T.sphere(c, x, y, R, [60, 30, 30], [150, 80, 60], [14, 8, 12], -0.8, r, { haze: 0.2, rim: 0.7 });
  c.save(); c.beginPath(); c.arc(x, y, R, 0, TAU); c.clip(); c.lineCap = 'round';
  for (let k = 0; k < 7; k++) {
    let a = r() * TAU, px = x + Math.cos(a) * R * 0.1, py = y + Math.sin(a) * R * 0.1;
    c.strokeStyle = 'rgba(255,150,70,0.85)'; c.shadowColor = 'rgba(255,110,40,0.8)'; c.shadowBlur = R * 0.15; c.lineWidth = Math.max(1.2, R * 0.045);
    c.beginPath(); c.moveTo(px, py); for (let i = 0; i < 6; i++) { a += (r() - 0.5) * 0.9; px += Math.cos(a) * R * 0.2; py += Math.sin(a) * R * 0.2; c.lineTo(px, py); } c.stroke();
  }
  c.restore();
}
/** a path as points: closed shapes go round, open ones go along */
const SHAPES = {
  circle: (cx, cy, r) => (u) => [cx + Math.cos(u * TAU - Math.PI / 2) * r, cy + Math.sin(u * TAU - Math.PI / 2) * r],
  ellipse: (cx, cy, rx, ry, rot = 0) => (u) => { const a = u * TAU - Math.PI / 2, x = Math.cos(a) * rx, y = Math.sin(a) * ry; return [cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)]; },
  // the figure-eight round two moons: a lemniscate laid round both, crossing between them
  eight: (cx, cy, a, b, rot = 0) => (u) => { const t = u * TAU, d = 1 + Math.sin(t) ** 2, x = (a * Math.cos(t)) / d, y = (b * Math.sin(t) * Math.cos(t)) / d * 2; return [cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)]; },
  line: (x0, y0, x1, y1) => (u) => [lerp(x0, x1, u), lerp(y0, y1, u)],
  // the dive: round and round, inward, to a point
  spiral: (cx, cy, r0, r1, turns, a0) => (u) => { const a = a0 + u * turns * TAU, r = lerp(r0, r1, u ** 0.8); return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; },
};
const pts = (f, u0, u1, n = 160) => { const o = []; for (let i = 0; i <= n; i++) o.push(f(lerp(u0, u1, i / n))); return o; };
const stroke = (c, P) => { c.beginPath(); P.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke(); };
/** the course along any path, as the one-signal look draws it: woken tiles behind Orbin, stone ahead */
function course(c, f, u0, uAt, u1, k = 1) {
  c.save(); c.lineCap = 'butt'; c.lineJoin = 'round';
  c.strokeStyle = HALO; c.lineWidth = 11 * k; stroke(c, pts(f, u0, u1));
  c.setLineDash([9 * k, 3 * k]); c.lineWidth = 6 * k;
  c.strokeStyle = K.rgba(WOKEN); stroke(c, pts(f, u0, uAt));
  c.strokeStyle = K.rgba(STONE); stroke(c, pts(f, uAt, u1));
  c.restore();
}
/** a stone node on the path; lit: the next tap, in gold, with its closing ring (one gold signal at a time) */
function node(c, x, y, lit, cue = 0.5, k = 1) {
  c.fillStyle = HALO; c.beginPath(); c.arc(x, y, (lit ? 11 : 7) * k, 0, TAU); c.fill();
  if (!lit) { c.fillStyle = K.rgba(STONE, 0.9); c.beginPath(); c.arc(x, y, 4.6 * k, 0, TAU); c.fill(); return; }
  c.fillStyle = K.rgba(TAP); c.beginPath(); for (let i = 0; i < 10; i++) { const q = (i * Math.PI) / 5 - Math.PI / 2, r = (i % 2 ? 2.8 : 6.6) * k; if (i) c.lineTo(x + Math.cos(q) * r, y + Math.sin(q) * r); else c.moveTo(x + Math.cos(q) * r, y + Math.sin(q) * r); } c.closePath(); c.fill();
  const rr = (10.5 + cue * 28) * k;
  c.strokeStyle = HALO; c.lineWidth = 6 * k; c.beginPath(); c.arc(x, y, rr, 0, TAU); c.stroke();
  c.strokeStyle = K.rgba(TAP); c.lineWidth = 3 * k; c.beginPath(); c.arc(x, y, rr, 0, TAU); c.stroke();
}
/** where the next landing will be: a soft blue target (shown before every launch) */
function target(c, x, y, k = 1) {
  c.save(); c.strokeStyle = K.rgba(SOFT, 0.85); c.lineWidth = 2 * k; c.setLineDash([5 * k, 4 * k]);
  for (const r of [10, 18]) { c.beginPath(); c.arc(x, y, r * k, 0, TAU); c.stroke(); }
  c.setLineDash([]); K.glow(c, x, y, 16 * k, SOFT, 0.35); c.restore();
}
/** a flight between places: a dotted arc (the course in the air) */
function flight(c, P, k = 1) {
  c.save(); c.fillStyle = K.rgba(SOFT, 0.7);
  for (let i = 0; i < P.length; i += 4) { const [x, y] = P[i]; c.beginPath(); c.arc(x, y, 1.9 * k, 0, TAU); c.fill(); }
  c.restore();
}
/** Orbin: squash (sx, sy), lean into curves, tail streaming back along `dir`, sparks shed; meteor: his dash form */
function orbin(c, x, y, s, o = {}) {
  const { dir = 0, rot = null, sx = 1, sy = 1, meteor = false, trail = 60, lean = -0.4, glow = 1 } = o;
  c.save();
  // the tail: a streak of his light back along where he came from
  const bx = -Math.cos(dir), by = -Math.sin(dir), L = trail * s / 0.18;
  const g = c.createLinearGradient(x, y, x + bx * L, y + by * L); g.addColorStop(0, meteor ? 'rgba(255,200,130,0.95)' : 'rgba(255,236,190,0.7)'); g.addColorStop(1, 'rgba(255,140,60,0)');
  c.strokeStyle = g; c.lineCap = 'round'; c.lineWidth = (meteor ? 13 : 6) * s / 0.18; c.beginPath(); c.moveTo(x, y); c.lineTo(x + bx * L, y + by * L); c.stroke();
  for (let i = 0; i < 6; i++) { const r = K.RNG(i + 3), q = 0.3 + 0.7 * r(); K.glow(c, x + bx * L * q + (r() - 0.5) * 14 * s / 0.18, y + by * L * q + (r() - 0.5) * 14 * s / 0.18, (1.5 + r() * 2.5) * s / 0.18, [255, 200, 120], 0.8); }
  if (meteor) K.glow(c, x, y, 34 * s / 0.18, [255, 160, 80], 0.6, 'screen');
  c.translate(x, y); c.rotate(rot ?? dir); c.scale(sx, sy); // (his up is the path's outside: travelling right, up is up)
  P.spark(c, 0, -10, s, { who: 'orbin', lite: true, glow, lean, crest: 1, arms: meteor ? 'back' : 'rest', face: 1, eyes: 'set', beat: 1 });
  c.restore();
}
/** Emberwick's objects. The bellows (the pad): leather and iron; draw: 0 open (breathing in) .. 1 slammed shut */
function bellows(c, x, y, a, s, shut, heat) {
  c.save(); c.translate(x, y); c.rotate(a + Math.PI / 2); c.scale(s, s);
  const top = lerp(-46, -16, shut);
  // the leather between the boards: folds, drawn in when open
  c.fillStyle = 'rgb(46,30,30)'; c.beginPath(); c.moveTo(-34, -4); c.quadraticCurveTo(-44, (top - 4) / 2, -30, top); c.lineTo(30, top); c.quadraticCurveTo(44, (top - 4) / 2, 34, -4); c.closePath(); c.fill();
  c.strokeStyle = 'rgba(110,70,60,0.8)'; c.lineWidth = 1.4; for (let i = 1; i < 4; i++) { const yy = lerp(-4, top, i / 4); c.beginPath(); c.moveTo(-36 + 4 * Math.sin(i), yy); c.lineTo(36 - 4 * Math.sin(i), yy); c.stroke(); }
  // the boards, the iron nozzle (glowing as it draws heat), the handle
  c.fillStyle = 'rgb(28,22,30)'; c.fillRect(-38, -6, 76, 7); c.fillRect(-36, top - 6, 72, 7);
  c.strokeStyle = heat > 0.05 ? K.rgba([255, 180, 110], 0.4 + 0.5 * heat) : 'rgba(150,150,190,0.3)'; c.lineWidth = 1.6; c.strokeRect(-36, top - 6, 72, 7);
  c.fillStyle = 'rgb(36,30,40)'; c.beginPath(); c.moveTo(-8, top - 6); c.lineTo(-4, top - 26); c.lineTo(4, top - 26); c.lineTo(8, top - 6); c.fill();
  if (heat > 0.02) K.glow(c, 0, top - 26, 26 * (0.5 + heat), EMB, 0.7 * heat, 'screen');
  c.restore();
}
/** an anvil of Ossa's, standing across the path (the Meteor's wall); crack: 0 whole .. 1 split; heat: its face */
function anvilWall(c, x, y, a, s, heat, crack = 0) {
  c.save(); c.translate(x, y); c.rotate(a); c.scale(s, s);
  for (const side of crack > 0 ? [-1, 1] : [0]) {
    c.save();
    if (side) { c.translate(side * 22 * crack, -10 * crack); c.rotate(side * 0.5 * crack); c.beginPath(); c.rect(side < 0 ? -60 : 0, -60, 60, 120); c.clip(); }
    c.fillStyle = 'rgb(30,22,32)'; c.beginPath(); c.moveTo(-14, 28); c.lineTo(-10, 8); c.lineTo(-30, 2); c.lineTo(-40, -12); c.lineTo(36, -12); c.lineTo(28, 2); c.lineTo(10, 8); c.lineTo(14, 28); c.closePath(); c.fill();
    c.strokeStyle = K.rgba([255, 200, 140], 0.25 + 0.6 * heat); c.lineWidth = 1.8; c.stroke();
    c.fillStyle = K.rgba(K.mix([90, 60, 60], [255, 220, 170], heat), 0.5 + 0.5 * heat); c.fillRect(-38, -14, 72, 4);
    c.restore();
  }
  if (heat > 0.05) K.glow(c, 0, -12, 50 * heat + 10, [255, 190, 120], 0.6 * heat, 'screen');
  c.restore();
}
/** an ember in the air (the orb): a coal turning, its rim brightening as the beat comes */
function coal(c, x, y, s, bright, burst = 0) {
  if (burst > 0) {
    for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU, d = (10 + 40 * burst) * s; K.glow(c, x + Math.cos(a) * d, y + Math.sin(a) * d, (2 + 3 * (1 - burst)) * s, [255, 210, 140], 0.9 * (1 - burst * 0.6)); }
    K.glow(c, x, y, 40 * s * (1 - burst * 0.5), [255, 240, 200], 0.8 * (1 - burst), 'screen');
    return;
  }
  K.glow(c, x, y, 26 * s * (0.6 + bright), EMB, 0.5 + 0.4 * bright, 'screen');
  c.fillStyle = 'rgb(40,22,24)'; c.beginPath(); c.arc(x, y, 8 * s, 0, TAU); c.fill();
  c.strokeStyle = K.rgba([255, 170, 90], 0.5 + 0.5 * bright); c.lineWidth = 2 * s; c.beginPath(); c.arc(x, y, 8 * s, -0.4 + bright * 2, 2.2 + bright * 2); c.stroke();
}
/** a lava vent on the ground: dormant (a dark mouth with a glow) or erupting (a column) */
function vent(c, x, y, a, s, erupt) {
  c.save(); c.translate(x, y); c.rotate(a + Math.PI / 2); c.scale(s, s);
  c.fillStyle = 'rgb(26,18,24)'; c.beginPath(); c.moveTo(-18, 2); c.lineTo(-8, -10); c.lineTo(8, -10); c.lineTo(18, 2); c.fill();
  K.glow(c, 0, -10, 14, EMB, 0.8, 'screen');
  if (erupt > 0) { const g = c.createLinearGradient(0, -10, 0, -10 - 90 * erupt); g.addColorStop(0, 'rgba(255,200,120,0.9)'); g.addColorStop(1, 'rgba(255,110,50,0)'); c.fillStyle = g; c.beginPath(); c.moveTo(-7, -10); c.lineTo(-14, -10 - 90 * erupt); c.lineTo(14, -10 - 90 * erupt); c.lineTo(7, -10); c.fill(); }
  c.restore();
}
/** the hammer's ring of fire closing on a pad (Ossa's strike) */
function hammerRing(c, x, y, k, close) {
  const r = (16 + 46 * (1 - close)) * k;
  c.save(); c.strokeStyle = 'rgba(255,120,50,0.75)'; c.lineWidth = 4 * k; c.shadowColor = 'rgba(255,100,40,0.8)'; c.shadowBlur = 10 * k; c.beginPath(); c.arc(x, y, r, 0, TAU); c.stroke(); c.restore();
}
/** Ossa, in the dark behind the chain, the hammer raised */
function ossaFar(c, x, y, s, lit) { W.ossa(c, x, y, s, { rise: 1, rear: 0.6, head: -0.2, antler: 0.4, lit, flicker: 0.6, face: -1 }); }

// ---------------------------------------------------------------- the route, whole
export function route(c, w, h) {
  sky(c, w, h, false, 13);
  const u = w / 1560;
  // far off, the guardian's rings and Helion's signal (always in sight)
  c.save(); c.strokeStyle = 'rgba(10,8,20,0.8)'; c.lineWidth = 3; for (let i = 0; i < 3; i++) { c.beginPath(); c.ellipse(w * 0.06, h * 0.1, 26 + i * 9, 8 + i * 3, -0.2 + i * 0.25, 0, TAU); c.stroke(); } c.restore();
  K.glow(c, w * 0.06, h * 0.1, 14, [255, 214, 140], 0.5);
  const E = [w * 0.44, h * 0.54], ER = 150 * u, ring = ER + 40 * u;
  // 1. the Ash Moon, and its ellipse
  const A = [w * 0.13, h * 0.36], AR = 62 * u, aPath = SHAPES.ellipse(A[0], A[1], AR + 52 * u, AR + 30 * u, -0.15);
  moon(c, A[0], A[1], AR, 'ash', 5);
  course(c, aPath, 0, 0.7, 1);
  bellows(c, ...aPath(0.33), Math.atan2(aPath(0.33)[1] - A[1], aPath(0.33)[0] - A[0]), 0.5 * u, 0.2, 0.2);
  // the fling: from the moon's rim to the forge ring, two embers in the air
  const f1 = (q) => { const p0 = aPath(0.86), p1 = [E[0] - ring * 0.8, E[1] - ring * 0.6]; return [lerp(p0[0], p1[0], q), lerp(p0[1], p1[1], q) - Math.sin(q * Math.PI) * 120 * u]; };
  flight(c, pts(f1, 0, 1, 80), u); coal(c, ...f1(0.4), u * 0.9, 0.5); coal(c, ...f1(0.68), u * 0.9, 0.5);
  COMPANIONS.kindling(c, ...aPath(0.86), 0.28 * u, KIN, { flap: 0.8, open: 0.6 });
  // 2. Emberwick and its forge ring (Ossa's anvils on it)
  ember(c, E[0], E[1], ER, false);
  const ePath = SHAPES.circle(E[0], E[1], ring);
  course(c, ePath, 0.75, 0.9, 1.6);
  for (const q of [0.95, 1.08, 1.2]) { const [x, y] = ePath(q); anvilWall(c, x, y, Math.atan2(y - E[1], x - E[0]) + Math.PI / 2, 0.42 * u, 0.3); }
  target(c, E[0] - ring * 0.8, E[1] - ring * 0.6, u);
  // 3. the lava moons: the Crucible (ellipse), the Twins (figure-eight), the Slag Bridge (straight), back to Emberwick
  const Cr = [w * 0.7, h * 0.24], cPath = SHAPES.ellipse(Cr[0], Cr[1], 82 * u, 52 * u, 0.3);
  const f2 = (q) => { const p0 = ePath(1.6), p1 = cPath(0.6); return [lerp(p0[0], p1[0], q), lerp(p0[1], p1[1], q) - Math.sin(q * Math.PI) * 70 * u]; };
  flight(c, pts(f2, 0, 1, 60), u);
  moon(c, Cr[0], Cr[1], 34 * u, 'lava', 21); course(c, cPath, 0, 1, 1); vent(c, ...cPath(0.2), -Math.PI / 2, 0.5 * u, 0.6);
  const Tw = [w * 0.86, h * 0.5], tPath = SHAPES.eight(Tw[0], Tw[1], 150 * u, 70 * u, 0.2);
  const f3 = (q) => { const p0 = cPath(0.35), p1 = tPath(0.75); return [lerp(p0[0], p1[0], q), lerp(p0[1], p1[1], q) - Math.sin(q * Math.PI) * 60 * u]; };
  flight(c, pts(f3, 0, 1, 60), u); hammerRing(c, ...cPath(0.35), u, 0.6);
  moon(c, Tw[0] - 82 * u * Math.cos(0.2), Tw[1] - 82 * u * Math.sin(0.2), 30 * u, 'lava', 33); moon(c, Tw[0] + 82 * u * Math.cos(0.2), Tw[1] + 82 * u * Math.sin(0.2), 26 * u, 'lava', 44);
  course(c, tPath, 0, 1, 1);
  const B0 = [w * 0.8, h * 0.8], B1 = [E[0] + ring * 0.95, E[1] + ring * 0.55], bPath = SHAPES.line(...B0, ...B1);
  const f4 = (q) => { const p0 = tPath(0.25), p1 = B0; return [lerp(p0[0], p1[0], q), lerp(p0[1], p1[1], q) - Math.sin(q * Math.PI) * 50 * u]; };
  flight(c, pts(f4, 0, 1, 50), u); hammerRing(c, ...tPath(0.25), u, 0.6);
  // the bridge: a causeway of cooled crust over the dark, lava showing in its cracks
  c.save(); c.strokeStyle = 'rgba(40,28,32,0.95)'; c.lineWidth = 26 * u; c.lineCap = 'round'; stroke(c, [B0, B1]); c.strokeStyle = 'rgba(255,130,60,0.35)'; c.lineWidth = 2 * u; c.setLineDash([12 * u, 20 * u]); stroke(c, [B0, B1]); c.restore();
  course(c, bPath, 0, 1, 1); vent(c, ...bPath(0.5), Math.atan2(B1[1] - B0[1], B1[0] - B0[0]) - Math.PI / 2, 0.45 * u, 0.4);
  // 4. the dive: back onto Emberwick, round and round, down into the forge's mouth
  const sPath = SHAPES.spiral(E[0], E[1] - ER * 0.62, ER * 0.5, 6 * u, 1.3, 0.2);
  c.save(); c.globalAlpha = 0.9; course(c, sPath, 0, 0, 1, 0.7); c.restore();
  K.glow(c, E[0], E[1] - ER * 0.62, 30 * u, [255, 240, 200], 0.8, 'screen');
  // the heart (already built), an inset
  const H0 = [w * 0.13, h * 0.8], HR = 90 * u;
  c.save(); c.beginPath(); c.arc(H0[0], H0[1], HR, 0, TAU); c.clip(); c.fillStyle = 'rgb(60,18,14)'; c.fillRect(H0[0] - HR, H0[1] - HR, HR * 2, HR * 2);
  for (let i = 0; i < 10; i++) { const r = K.RNG(i + 70); c.strokeStyle = `rgba(255,${120 + 60 * r()},60,0.5)`; c.lineWidth = 3 * u; c.beginPath(); c.arc(H0[0], H0[1], HR * (0.3 + 0.07 * i), r() * TAU, r() * TAU + 2); c.stroke(); }
  K.glow(c, H0[0], H0[1], 40 * u, [255, 236, 180], 0.95, 'screen'); course(c, SHAPES.circle(H0[0], H0[1], HR * 0.7), 0, 0.4, 1, 0.8); c.restore();
  c.strokeStyle = 'rgba(255,200,150,0.5)'; c.lineWidth = 1.5; c.beginPath(); c.arc(H0[0], H0[1], HR, 0, TAU); c.stroke();
  // the words: each place, each launch, with its time
  const L = (s, x, y, px = 21, col) => words(c, s, x, y, px * u, { color: col });
  L('1  the Ash Moon', A[0], A[1] - 128 * u, 24); L('0:00 – 0:09.6 · an ellipse · the bellows wake', A[0], A[1] - 102 * u, 16, '#e8dcc8');
  L('the Kindling’s fling', (A[0] + E[0]) / 2 - 30 * u, h * 0.15, 20); L('0:09.6 – 0:12.0 · four beats in the air, two embers to tap', (A[0] + E[0]) / 2 - 30 * u, h * 0.15 + 24 * u, 15, '#e8dcc8');
  L('2  the forge ring', E[0], E[1] + ring + 34 * u, 24); L('0:12.0 – 0:19.2 · the Meteor · Ossa’s anvils · the switchback', E[0], E[1] + ring + 60 * u, 16, '#e8dcc8');
  L('3  the lava moons', w * 0.79, h * 0.07, 24); L('0:19.2 – 0:34.8 · three hops on Ossa’s hammer', w * 0.79, h * 0.07 + 26 * u, 16, '#e8dcc8');
  L('the Crucible · ellipse', Cr[0] - 10 * u, Cr[1] + 76 * u, 16); L('the Twins · figure-eight', Tw[0], Tw[1] + 92 * u, 16); L('the Slag Bridge · straight', (B0[0] + B1[0]) / 2 + 40 * u, (B0[1] + B1[1]) / 2 + 44 * u, 16);
  L('4  the dive', E[0] + ER * 0.9, E[1] - ER * 1.42, 24); L('0:34.8 – 0:38.4 · a spiral into the forge', E[0] + ER * 0.9, E[1] - ER * 1.42 + 24 * u, 16, '#e8dcc8');
  L('the heart (built)', H0[0], H0[1] - HR - 34 * u, 20); L('0:38.4 – 0:56.7 · the seal', H0[0], H0[1] - HR - 12 * u, 15, '#e8dcc8');
  T.finish(c, w, h, 41, 0.3);
}

// ---------------------------------------------------------------- the places, phone-sized
export function place(c, w, h, n) {
  const u = Math.min(w / 390, h / 844), cx = w / 2;
  if (n === 1) {
    // the Ash Moon: a wide calm ellipse; a sleeping bellows ahead, the next tap on it; far off, Emberwick, dark
    sky(c, w, h, false, 17);
    ember(c, w * 0.82, h * 0.14, 46 * u, false); K.glow(c, w * 0.82, h * 0.14 - 46 * u * 0.62, 8 * u, EMB, 0.6);
    const M = [cx, h * 0.52], R = 118 * u, f = SHAPES.ellipse(M[0], M[1], R + 52 * u, R + 22 * u, -0.1);
    moon(c, M[0], M[1], R, 'ash', 5);
    course(c, f, 0.55, 0.92, 1.5);
    const bq = 1.12, [bx, by] = f(bq); bellows(c, bx, by, Math.atan2(by - M[1], bx - M[0]), 0.62 * u, 0.15, 0.25);
    node(c, ...f(1.04), true, 0.6, u); node(c, ...f(1.25), false, 0, u); node(c, ...f(1.36), false, 0, u);
    const [ox, oy] = f(0.92), [px, py] = f(0.91); orbin(c, ox, oy - 4 * u, 0.2 * u, { dir: Math.atan2(oy - py, ox - px) });
    words(c, 'Cold. Since the music stopped.', cx, h * 0.88, 19 * u);
  } else if (n === 2) {
    // the fling: the Kindling curls into a launch ring at the rim; Orbin flung across the dark; two embers in the air;
    // the landing on the forge ring already shown
    sky(c, w, h, false, 19);
    const M = [w * 0.2, h * 0.84], R = 120 * u; moon(c, M[0], M[1], R, 'ash', 5);
    const E = [w * 0.8, h * 0.16], ER = 110 * u; ember(c, E[0], E[1], ER, false);
    course(c, SHAPES.circle(E[0], E[1], ER + 30 * u), 0.45, 0.45, 0.85);
    const L0 = [M[0] + R * 0.55, M[1] - R * 0.9], L1 = [E[0] - (ER + 30 * u) * 0.62, E[1] + (ER + 30 * u) * 0.78];
    const fl = (q) => [lerp(L0[0], L1[0], q) - Math.sin(q * Math.PI) * 70 * u, lerp(L0[1], L1[1], q) - Math.sin(q * Math.PI) * 40 * u];
    flight(c, pts(fl, 0, 1, 100), u);
    COMPANIONS.kindling(c, L0[0], L0[1] + 6 * u, 0.42 * u, KIN, { flap: 1, open: 0.8 });
    for (let i = 0; i < 14; i++) { const a = (i / 14) * TAU; K.glow(c, L0[0] + Math.cos(a) * 30 * u, L0[1] + 6 * u + Math.sin(a) * 30 * u, 2.4 * u, [255, 190, 120], 0.8); }
    coal(c, ...fl(0.45), u * 1.2, 0.9); hammerRing(c, ...fl(0.45), u * 0.6, 0.7); coal(c, ...fl(0.72), u * 1.1, 0.3);
    node(c, ...fl(0.45), true, 0.35, u);
    target(c, ...L1, u * 1.2);
    const [ox, oy] = fl(0.27), [px, py] = fl(0.25); orbin(c, ox, oy, 0.22 * u, { dir: Math.atan2(oy - py, ox - px), sx: 0.85, sy: 1.2, trail: 90 });
    words(c, 'Hold on to the beat. I’ll throw you.', cx, h * 0.6, 18 * u, { color: '#ffd9b0' });
  } else if (n === 3) {
    // the forge ring: the Meteor; Ossa's anvils across the path; the first one cracked behind him
    sky(c, w, h, true, 23);
    const E = [cx, h * 0.5], ER = 128 * u, ring = ER + 38 * u, f = SHAPES.circle(E[0], E[1], ring);
    K.glow(c, E[0], E[1], w * 0.8, [255, 130, 70], 0.2, 'screen');
    ember(c, E[0], E[1], ER, true);
    ossaFar(c, w * 0.16, h * 0.86, 0.32 * u, 0.6);
    course(c, f, 0.2, 0.62, 1.1);
    const a = (q) => { const [x, y] = f(q); return [x, y, Math.atan2(y - E[1], x - E[0]) + Math.PI / 2]; };
    { const [x, y, r] = a(0.57); anvilWall(c, x, y, r, 0.8 * u, 0.2, 0.8); }
    { const [x, y, r] = a(0.7); anvilWall(c, x, y, r, 0.8 * u, 0.8); node(c, x, y, true, 0.3, u); }
    { const [x, y, r] = a(0.8); anvilWall(c, x, y, r, 0.8 * u, 0.15); }
    { const [x, y, r] = a(0.9); anvilWall(c, x, y, r, 0.8 * u, 0.1); }
    const [ox, oy] = f(0.62), [px, py] = f(0.61); orbin(c, ox, oy, 0.2 * u, { dir: Math.atan2(oy - py, ox - px), meteor: true, trail: 80 });
  } else if (n === 4) {
    // the Twins: a figure-eight round two lava moonlets; Orbin at the crossing; the hammer's ring closing on the pad ahead
    sky(c, w, h, true, 29);
    ossaFar(c, w * 0.5, h * 0.95, 0.5 * u, 1);
    const C = [cx, h * 0.46], f = SHAPES.eight(C[0], C[1], 165 * u, 120 * u, Math.PI / 2);
    moon(c, C[0], C[1] - 95 * u, 54 * u, 'lava', 33); moon(c, C[0], C[1] + 95 * u, 46 * u, 'lava', 44);
    course(c, f, 0.1, 0.5, 1.02);
    node(c, ...f(0.58), true, 0.45, u); node(c, ...f(0.66), false, 0, u);
    const [hx, hy] = f(0.8); hammerRing(c, hx, hy, u, 0.4); node(c, hx, hy, false, 0, u);
    target(c, w * 0.12, h * 0.12, u);
    const [ox, oy] = f(0.5), [px, py] = f(0.49); orbin(c, ox, oy, 0.2 * u, { dir: Math.atan2(oy - py, ox - px), lean: 0.4 });
  } else if (n === 5) {
    // the Slag Bridge: straight, over the dark, toward Emberwick; crust slabs to dash; a vent mid-way
    sky(c, w, h, true, 31);
    const E = [cx, h * 0.12], ER = 150 * u; K.glow(c, E[0], E[1], 260 * u, [255, 120, 60], 0.3, 'screen'); ember(c, E[0], E[1], ER, true);
    const B0 = [w * 0.62, h * 0.98], B1 = [w * 0.45, h * 0.3], f = SHAPES.line(...B0, ...B1), dir = Math.atan2(B1[1] - B0[1], B1[0] - B0[0]);
    c.save(); c.strokeStyle = 'rgba(40,28,32,0.97)'; c.lineWidth = 46 * u; c.lineCap = 'round'; stroke(c, [B0, B1]);
    c.strokeStyle = 'rgba(255,130,60,0.45)'; c.lineWidth = 2.2 * u; c.setLineDash([14 * u, 22 * u]); stroke(c, [[B0[0] - 14 * u, B0[1]], [B1[0] - 14 * u, B1[1]]]); stroke(c, [[B0[0] + 14 * u, B0[1]], [B1[0] + 14 * u, B1[1]]]); c.restore();
    for (let i = 0; i < 30; i++) { const r = K.RNG(i + 90); K.glow(c, r() * w, h * (0.35 + 0.65 * r()), 2 + 3 * r(), [255, 150, 80], 0.5); }
    course(c, f, 0, 0.3, 1);
    { const [x, y] = f(0.45); anvilWall(c, x, y, dir + Math.PI / 2, 0.85 * u, 0.7); node(c, x, y, true, 0.4, u); }
    { const [x, y] = f(0.62); vent(c, x + 24 * u, y, dir - Math.PI / 2 + Math.PI, 0.5 * u, 0); }
    { const [x, y] = f(0.78); anvilWall(c, x, y, dir + Math.PI / 2, 0.85 * u, 0.1); }
    const [ox, oy] = f(0.3); orbin(c, ox, oy, 0.22 * u, { dir, meteor: true, trail: 90 });
  } else if (n === 6) {
    // the dive: round and round, down into the forge's mouth; the camera tipping in after him
    sky(c, w, h, true, 37);
    const E = [cx, h * 0.62], ER = 250 * u; ember(c, E[0], E[1], ER, true);
    const M = [cx, E[1] - ER * 0.66]; K.glow(c, M[0], M[1], 120 * u, [255, 230, 180], 0.75, 'screen');
    const f = SHAPES.spiral(M[0], M[1], 170 * u, 10 * u, 2.1, -0.2);
    course(c, f, 0, 0.35, 0.97);
    node(c, ...f(0.48), true, 0.5, u); node(c, ...f(0.62), false, 0, u); node(c, ...f(0.75), false, 0, u);
    const [ox, oy] = f(0.35), [px, py] = f(0.34); orbin(c, ox, oy, 0.2 * u, { dir: Math.atan2(oy - py, ox - px), lean: 0.5, trail: 70 });
    words(c, 'Into the heart.', cx, h * 0.08, 20 * u);
  }
  T.finish(c, w, h, 41 + n, 0.3);
}

// ---------------------------------------------------------------- three interactions, three beats each
/** kind: 'pad' | 'orb' | 'wall'; beat: 0 anticipation, 1 contact, 2 follow-through */
export function beat(c, w, h, kind, k) {
  const u = w / 360;
  sky(c, w, h, kind !== 'orb', 50 + k);
  // the ground: a sweep of Emberwick's surface, the path just above it
  const G = (x) => h * 0.78 + Math.sin(x / w * 1.4 + 0.4) * 10 * u;
  c.fillStyle = 'rgb(30,22,30)'; c.beginPath(); c.moveTo(0, h); for (let x = 0; x <= w; x += 8) c.lineTo(x, G(x)); c.lineTo(w, h); c.fill();
  c.strokeStyle = 'rgba(255,150,80,0.35)'; c.lineWidth = 1.5 * u; c.beginPath(); for (let x = 0; x <= w; x += 8) (x ? c.lineTo(x, G(x)) : c.moveTo(x, G(x))); c.stroke();
  const pathY = (x) => G(x) - 34 * u, f = (q) => [q * w, pathY(q * w)];
  const shake = k === 1 && kind !== 'orb' ? 5 * u : 0;
  c.save(); c.translate(shake, -shake * 0.6);
  course(c, f, 0, kind === 'pad' ? [0.4, 0.5, 0.5][k] : [0.35, 0.5, 0.75][k], 1, u);
  if (kind === 'pad') {
    const bx = w * 0.5, by = G(bx);
    bellows(c, bx, by, -Math.PI / 2, 1.35 * u, [0, 1, 0.35][k], [0.9, 1, 0.3][k]);
    if (k === 0) {
      node(c, bx, pathY(bx) - 4 * u, true, 0.25, u);
      // breathing in: ash drawn toward the nozzle
      for (let i = 0; i < 10; i++) { const r = K.RNG(i + 5), a = r() * TAU, d = (30 + r() * 30) * u; K.glow(c, bx + Math.cos(a) * d, by - 70 * u + Math.sin(a) * d * 0.5, 2 * u, [200, 190, 210], 0.6); }
      orbin(c, w * 0.34, pathY(w * 0.34) - 4 * u, 0.3 * u, { dir: 0, sx: 1.08, sy: 0.9, trail: 50, lean: -0.6 });
    } else if (k === 1) {
      // the blast: a cone of air and sparks, a flash; Orbin squashed flat on the boards for this one frame
      const g = c.createLinearGradient(bx, by - 30 * u, bx, by - 230 * u); g.addColorStop(0, 'rgba(255,230,180,0.85)'); g.addColorStop(1, 'rgba(255,150,80,0)');
      c.fillStyle = g; c.beginPath(); c.moveTo(bx - 12 * u, by - 30 * u); c.lineTo(bx - 70 * u, by - 230 * u); c.lineTo(bx + 70 * u, by - 230 * u); c.lineTo(bx + 12 * u, by - 30 * u); c.fill();
      K.glow(c, bx, by - 40 * u, 110 * u, [255, 240, 210], 0.7, 'screen');
      for (let i = 0; i < 22; i++) { const r = K.RNG(i + 11), a = -Math.PI / 2 + (r() - 0.5) * 1.3, d = (40 + r() * 150) * u; K.glow(c, bx + Math.cos(a) * d, by - 30 * u + Math.sin(a) * d, (1.5 + 2 * r()) * u, [255, 210, 140], 0.9); }
      orbin(c, bx, pathY(bx) - 30 * u, 0.3 * u, { dir: -Math.PI / 2, rot: 0, sx: 1.3, sy: 0.7, trail: 10 });
    } else {
      // high in the air, stretched along the arc, tail streaming; the bellows wheezing open; ash puffs drifting
      const arc = (q) => [lerp(w * 0.5, w * 0.95, q), pathY(w * 0.5) - Math.sin(q * Math.PI * 0.9 + 0.3) * 170 * u];
      flight(c, pts(arc, 0, 1, 60), u);
      for (let i = 0; i < 6; i++) { const r = K.RNG(i + 31); K.glow(c, bx + (r() - 0.5) * 60 * u, by - (40 + r() * 70) * u, (8 + r() * 10) * u, [170, 160, 180], 0.25); }
      const [ox, oy] = arc(0.4), [px, py] = arc(0.37); orbin(c, ox, oy, 0.3 * u, { dir: Math.atan2(oy - py, ox - px), sx: 0.85, sy: 1.2, trail: 100, lean: 0.2 });
      // where he lands, a soft target (and there: a squash and a ring of embers)
      const [lx, ly] = arc(1); target(c, lx, pathY(lx) + 4 * u, u);
    }
  } else if (kind === 'orb') {
    const ox0 = w * 0.55, oy0 = pathY(ox0) - 90 * u;
    if (k === 0) {
      coal(c, ox0, oy0, 1.6 * u, 0.9); node(c, ox0, oy0, true, 0.3, u);
      orbin(c, w * 0.36, pathY(w * 0.36) - 4 * u, 0.3 * u, { dir: 0, sx: 1.06, sy: 0.92, lean: -0.6 });
    } else if (k === 1) {
      coal(c, ox0, oy0, 1.6 * u, 1, 0.25);
      orbin(c, ox0, oy0, 0.3 * u, { dir: -1.2, rot: -0.3, sx: 0.85, sy: 1.2, trail: 80 });
    } else {
      // the husk falls, dark; his sparks trail with him as he comes down the far side
      c.fillStyle = 'rgb(34,22,26)'; c.beginPath(); c.arc(ox0 - 10 * u, oy0 + 50 * u, 6 * u, 0, TAU); c.fill();
      coal(c, ox0, oy0, 1.6 * u, 1, 0.85);
      const [x, y] = [w * 0.76, pathY(w * 0.76) - 60 * u]; orbin(c, x, y, 0.3 * u, { dir: 0.6, trail: 110, lean: 0.3 });
      for (let i = 0; i < 9; i++) { const r = K.RNG(i + 61), q = r(); K.glow(c, lerp(ox0, x, q), lerp(oy0, y, q) + (r() - 0.5) * 20 * u, 2.2 * u, [255, 210, 140], 0.9); }
    }
  } else {
    const ax = w * 0.6, ay = pathY(ax);
    if (k === 0) {
      anvilWall(c, ax, ay - 2 * u, 0, 1.1 * u, 0.9); node(c, ax, ay, true, 0.2, u);
      for (let i = 0; i < 10; i++) { const r = K.RNG(i + 71); K.glow(c, ax + (r() - 0.5) * 50 * u, ay - (20 + r() * 80) * u, 1.8 * u, [255, 200, 130], 0.8); }
      orbin(c, w * 0.32, ay - 4 * u, 0.3 * u, { dir: 0, meteor: true, sx: 1.15, sy: 0.88, lean: -0.8, trail: 80 });
    } else if (k === 1) {
      // contact: the punch (the anvil a size up for a frame), the flash, the shake; visual only, the music never stops
      K.glow(c, ax, ay, 170 * u, [255, 236, 200], 0.85, 'screen');
      anvilWall(c, ax, ay - 2 * u, 0, 1.25 * u, 1, 0.15);
      c.strokeStyle = 'rgba(255,240,210,0.8)'; c.lineWidth = 2 * u; for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU, d0 = 50 * u, d1 = 95 * u; c.beginPath(); c.moveTo(ax + Math.cos(a) * d0, ay + Math.sin(a) * d0); c.lineTo(ax + Math.cos(a) * d1, ay + Math.sin(a) * d1); c.stroke(); }
      orbin(c, ax - 18 * u, ay, 0.3 * u, { dir: 0, meteor: true, sx: 1.25, sy: 0.75, trail: 90 });
    } else {
      anvilWall(c, ax, ay - 2 * u, 0, 1.1 * u, 0.25, 1);
      for (let i = 0; i < 8; i++) { const r = K.RNG(i + 81); c.fillStyle = 'rgba(255,150,70,0.85)'; c.beginPath(); c.arc(ax + (r() - 0.5) * 60 * u, ay + (10 + r() * 40) * u, (1.5 + 2 * r()) * u, 0, TAU); c.fill(); }
      orbin(c, w * 0.88, pathY(w * 0.88) - 4 * u, 0.3 * u, { dir: 0, meteor: true, trail: 160, lean: -0.3 });
      for (let i = 0; i < 12; i++) { const r = K.RNG(i + 91), a = r() * TAU; K.glow(c, w * 0.88 - 50 * u + Math.cos(a) * 30 * u, pathY(w * 0.88) + Math.sin(a) * 18 * u, 2 * u, [255, 190, 120], 0.8); }
    }
  }
  c.restore();
  T.finish(c, w, h, 60 + k, 0.25);
}
