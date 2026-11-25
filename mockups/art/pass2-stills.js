// Stills for the next pass (step 1: for approval, nothing here is in the game): the star collection, the camera rise
// from the first stage to the galaxy map, and the legend of the one-signal visual language. Painted with the game's
// own painters. Open mockups/art/render-pass2.html through the dev server.
import { CANON } from '/src/art/canonpaint.js';
import { DUSK, K } from '/src/art/painter.js';
import { RESULTS } from '/src/art/resultpaint.js';
import { WORLD1 } from '/src/art/world1paint.js';

const T = DUSK.tools, P = CANON.parts, Y = RESULTS.LAYERS, TAU = Math.PI * 2;
const SERIF = '"Cormorant Garamond", Georgia, serif';
const W = 780, H = 1688, U = 2; // a 390 x 844 phone at 2x
const TAP = [255, 204, 72], HOLD = [110, 206, 222], STONE = [84, 94, 140], WOKEN = [128, 150, 222], DANGER = [232, 70, 54];
const say = (c, s, x, y, px, o = {}) => { c.save(); c.font = `${o.plain ? '' : 'italic '}500 ${px}px ${SERIF}`; c.textAlign = o.align || 'left'; c.shadowColor = 'rgba(4,4,14,0.9)'; c.shadowBlur = px * 0.5; c.globalAlpha = o.alpha ?? 0.96; c.fillStyle = o.color || '#fff1d8'; c.fillText(s, x, y); c.fillText(s, x, y); c.restore(); };
const note = (c, s) => say(c, s, W - 22, 60, 26, { align: 'right', alpha: 0.8, color: '#e6cfae' });
/** Our own star: a node's star, risen. A small hot heart, eight uneven rays, and a thin orbit tilted round it in the world's colour. */
function star(c, x, y, s, col = [255, 190, 120], a = 1) {
  K.glow(c, x, y, 150 * s, [255, 226, 160], 0.75 * a); K.glow(c, x, y, 60 * s, [255, 252, 236], 0.9 * a);
  c.save(); c.translate(x, y); c.globalAlpha = a;
  c.fillStyle = '#fff6dc'; c.beginPath();
  for (let i = 0; i < 16; i++) { const q = -Math.PI / 2 + (i * Math.PI) / 8, r = (i % 2 ? 9 : i % 4 === 0 ? 34 : 22) * s; c.lineTo(Math.cos(q) * r, Math.sin(q) * r); }
  c.closePath(); c.fill();
  c.rotate(-0.4); c.strokeStyle = K.rgba(col, 0.95); c.lineWidth = 2.6 * s; c.beginPath(); c.ellipse(0, 0, 46 * s, 13 * s, 0, 0, TAU); c.stroke();
  c.fillStyle = K.rgba(col); c.beginPath(); c.arc(40 * s, 6.5 * s, 4 * s, 0, TAU); c.fill();
  c.restore();
}
const ossa = (c, hy, lit) => WORLD1.parts.ossa(c, W * 0.3, hy + 150, 1.6, lit, K.RNG(53), 'stand');
const world = (c, mode) => { Y.scene(c, W, H, 'heroes', 'phone', U, mode); return H * Y.lay('phone').horizon; };

// ---------------------------------------------------------------- the star collection (a first clear: about five seconds)
export const COLLECT = [
  ['1 · the song’s last big hit', (c) => { const hy = world(c, 'warm'); ossa(c, hy, 0.7); for (let k = 0; k < 4; k++) { c.strokeStyle = K.rgba(k % 2 ? [150, 190, 255] : [255, 226, 160], 0.6 - k * 0.12); c.lineWidth = 8 - k; c.beginPath(); c.arc(W * 0.58, H * 0.44, 70 + k * 80, 0, TAU); c.stroke(); } K.glow(c, W * 0.58, H * 0.44, 420, [255, 226, 160], 0.7); P.spark(c, W * 0.58, H * 0.44, 0.7, { arms: 'up', eyes: 'wide', crest: 1 }); note(c, '0.0 s  ·  the last node: the song’s final hit'); }],
  ['2 · the star rises out of the world', (c) => { const hy = world(c, 'warm'); ossa(c, hy, 1); const x = W * 0.56, g = c.createLinearGradient(0, hy, 0, H * 0.3); g.addColorStop(0, 'rgba(255,226,160,0.55)'); g.addColorStop(1, 'rgba(255,226,160,0)'); c.fillStyle = g; c.beginPath(); c.moveTo(x - 46, hy + 20); c.lineTo(x - 12, H * 0.3); c.lineTo(x + 12, H * 0.3); c.lineTo(x + 46, hy + 20); c.fill(); star(c, x, H * 0.34, 1.6); P.spark(c, W * 0.8, H * 0.52, 0.62, { eyes: 'wide', look: [-0.8, -0.8], face: -1, arms: 'rest', crest: 0.8 }); note(c, '0.4 s  ·  it rises from the land Ossa stands on'); }],
  ['3 · Orbin flies to it', (c) => { const hy = world(c, 'warm'); ossa(c, hy, 1); star(c, W * 0.5, H * 0.3, 1.7); const g = c.createLinearGradient(W * 0.84, H * 0.56, W * 0.6, H * 0.36); g.addColorStop(0, 'rgba(255,214,130,0)'); g.addColorStop(1, 'rgba(255,226,160,0.8)'); c.strokeStyle = g; c.lineWidth = 12; c.lineCap = 'round'; c.beginPath(); c.moveTo(W * 0.84, H * 0.56); c.quadraticCurveTo(W * 0.8, H * 0.4, W * 0.61, H * 0.345); c.stroke(); P.spark(c, W * 0.62, H * 0.36, 0.6, { face: -1, arms: 'reach', eyes: 'wide', look: [1, -0.6], lean: 0.4, crest: 1 }); note(c, '1.2 s  ·  an arc, eased: fast out, slow in'); }],
  ['4 · the catch: a burst, and the camera turns round him', (c) => { const hy = world(c, 'blaze'); ossa(c, hy, 1); K.glow(c, W * 0.5, H * 0.34, 900, [255, 236, 190], 0.85); for (let k = 0; k < 3; k++) { c.strokeStyle = `rgba(255,244,214,${0.5 - k * 0.14})`; c.lineWidth = 5; c.beginPath(); c.ellipse(W * 0.5, H * 0.36, 210 + k * 70, 60 + k * 22, -0.2, 0.3 + k, 0.3 + k + 3.6); c.stroke(); } const r = K.RNG(7); P.dust(c, W * 0.5, H * 0.33, 460, r, 170); star(c, W * 0.5, H * 0.325, 1.2); P.spark(c, W * 0.5, H * 0.36, 0.95, { arms: 'chest', eyes: 'closed', crest: 1, beat: 1 }); note(c, '1.9 s  ·  the sting plays; the camera makes one slow turn'); }],
  ['5 · “Emberwick restored”, written softly in the sky', (c) => { const hy = world(c, 'blaze'); ossa(c, hy, 1); K.glow(c, W * 0.5, hy, 900, [255, 200, 130], 0.4, 'screen'); P.spark(c, W * 0.62, H * 0.5, 0.7, { arms: 'chest', eyes: 'soft', crest: 0.9, look: [-0.5, -0.6], face: -1 }); star(c, W * 0.585, H * 0.488, 0.5); say(c, 'Emberwick', W / 2, H * 0.2, 96, { align: 'center' }); say(c, 'restored', W / 2, H * 0.245, 46, { align: 'center', color: '#ffe6b8' }); note(c, '3.0 s  ·  the whole world in colour'); }],
  ['6 · the flight home: the star takes its place, the path lights', (c) => { const r = K.RNG(16), hy = H * 0.8; T.sky(c, W, H, CANON.pal.DRIFT.map(([t, col]) => [t, K.mix(col, CANON.pal.WOKEN[Math.min(4, Math.round(t * 4))][1], 0.3)]), r, 80); T.stars(c, W, hy, r, 260, 3); P.trials(c, W * 0.6, 210, 1.0, K.RNG(41), 0.9); P.guardian(c, W * 0.62, 420, 0.2, K.RNG(42), 1); T.sphere(c, W * 0.3, H * 0.45, 86, [214, 96, 60], [255, 200, 130], [70, 26, 50], 225, r, { haze: 0.35 }); for (let i = 1; i < 22; i++) { const q = i / 22, on = q < 0.62; c.fillStyle = K.rgba([255, 226, 170], on ? 0.85 : 0.22); c.beginPath(); c.ellipse(W * (0.3 + 0.12 * Math.sin(q * 3)) + (W * 0.2) * (1 - q) * 0.4, H * 0.5 + (hy - H * 0.5 - 40) * q, 5, 3.6, 0, 0, TAU); c.fill(); } P.ground(c, W, H, hy, K.RNG(17), 0.35); star(c, W * 0.74, H * 0.6, 0.9); for (let k = 0; k < 2; k++) { c.strokeStyle = `rgba(255,226,160,${0.5 - k * 0.2})`; c.lineWidth = 3; c.beginPath(); c.arc(W * 0.74, H * 0.6, 60 + k * 44, 0, TAU); c.stroke(); } P.spark(c, W * 0.5, hy - 40, 0.62, { arms: 'up', eyes: 'open', look: [0.8, -0.8], crest: 0.9 }); say(c, '1', W * 0.74 + 74, H * 0.6 + 14, 54, {}); say(c, 'star awake', W * 0.74 + 74, H * 0.6 + 52, 28, { color: '#e6cfae' }); note(c, '4.5 s  ·  at the Landing: the count ticks up'); }]
];

// ---------------------------------------------------------------- the camera rise: one move, no cut
function rise(c, k) { // k: 0 (on the planetoid, its star just caught) .. 1 (the galaxy map)
  const r = K.RNG(16), hy = H * (0.42 + 0.5 * k), lit = 1 - 0.55 * k;
  T.sky(c, W, H, CANON.pal.DRIFT.map(([t, col]) => [t, K.mix(col, CANON.pal.WOKEN[Math.min(4, Math.round(t * 4))][1], 0.5 * lit)]), r, 90); T.stars(c, W, hy, r, Math.round(120 + 500 * k), 3);
  // the galaxy's edge: far and small at first, the top of the picture at the end
  const ey = H * (0.3 - 0.2 * k) + 40, es = 0.6 + 0.5 * k;
  P.trials(c, W * 0.62, ey - 150 * es, es, K.RNG(41), 0.85); P.guardian(c, W * 0.66, ey + 2, 0.13 * es / 0.6, K.RNG(42), 0);
  K.glow(c, W * 0.64, ey - 150 * es, 26 + 20 * k, [255, 206, 120], 0.55); // his brother's signal
  // the sleeping worlds come into the picture as the camera goes up
  const worlds = [[0.28, 0.72, 56, [214, 96, 60]], [0.7, 0.55, 64, [150, 90, 190]], [0.26, 0.38, 44, [70, 110, 190]], [0.72, 0.24, 38, [60, 150, 120]]];
  worlds.forEach(([x, y, R, col], i) => { const a = Math.max(0, Math.min(1, (k - 0.2 - i * 0.12) / 0.4)); if (a <= 0) return; c.globalAlpha = a; T.sphere(c, W * x, H * (y + (1 - k) * 0.5), R * U * 0.5 * (0.6 + 0.4 * k) * 2, K.mix(col, [24, 20, 60], 0.72), K.mix(col, [60, 54, 110], 0.6), [14, 12, 36], 225, r, { haze: 0.05, rim: 0.15 }); c.globalAlpha = 1; });
  P.ground(c, W, H, hy, K.RNG(17), lit); if (k < 0.5) P.tiles(c, W, H, hy, K.RNG(18), 1, {});
  return hy;
}
export const RISE = [
  ['1 · the first stage ends: the planetoid’s own star, caught', (c) => { const hy = rise(c, 0); star(c, W * 0.5, H * 0.3, 1.5); P.spark(c, W * 0.5, H * 0.335, 0.8, { arms: 'chest', eyes: 'soft', crest: 1 }); P.dust(c, W * 0.5, H * 0.3, 380, K.RNG(3), 110); note(c, 'the first star of all'); }],
  ['2 · the camera begins to rise: the land falls away', (c) => { const hy = rise(c, 0.34); P.spark(c, W * 0.5, hy - 110, 0.5, { back: true, crest: 1, arms: 'back' }); star(c, W * 0.5, hy - 220, 0.7); note(c, '+2 s  ·  the song begins to fade under the Landing’s theme'); }],
  ['3 · higher: the sleeping worlds come into view', (c) => { const hy = rise(c, 0.68); P.spark(c, W * 0.46, hy - 70, 0.3, { back: true, crest: 1, arms: 'back' }); star(c, W * 0.78, hy - 250, 0.5); note(c, '+4 s  ·  the planetoid stays in the picture: it is the Landing now'); }],
  ['4 · the galaxy map: the same picture, come to rest', (c) => { const hy = rise(c, 1); P.spark(c, W * 0.42, hy - 44, 0.2, { crest: 0.7, look: [0.5, -0.8] }); star(c, W * 0.8, hy - 190, 0.36); say(c, 'the Landing', W * 0.3, hy + 60, 36, {}); say(c, 'Emberwick', W * 0.28 + 96, H * 0.72 + 8, 40, {}); say(c, 'asleep', W * 0.28 + 96, H * 0.72 + 44, 28, { color: '#e6cfae' }); say(c, 'One star awake. He’s a little clearer.', W / 2, hy - 60, 38, { align: 'center' }); note(c, '+6 s  ·  no screen was cut'); }]
];

// ---------------------------------------------------------------- the legend: every kind of object in the one-signal look
export function legend(c, w, h) {
  const r = K.RNG(63), u = 1.5, cx = w * 0.3, cy = h * 0.52, R0 = 190 * u, R1 = 250 * u;
  T.sky(c, w, h, CANON.pal.DRIFT, r, 80); T.stars(c, w, h, r, 300, 3);
  const band = c.createRadialGradient(cx, cy, 40, cx, cy, R1 + 160); band.addColorStop(0, 'rgba(8,8,24,0.5)'); band.addColorStop(0.8, 'rgba(8,8,24,0.5)'); band.addColorStop(1, 'rgba(8,8,24,0)'); c.fillStyle = band; c.fillRect(0, 0, w, h);
  T.sphere(c, cx, cy, 58 * u, [70, 70, 110], [130, 130, 180], [20, 22, 44], 225, r, { haze: 0.12 });
  const at = (R, a) => [cx + Math.cos(a) * R, cy + Math.sin(a) * R];
  const tiles = (R, a0, a1, col) => { c.strokeStyle = K.rgba(col); c.lineWidth = 9 * u; c.lineCap = 'butt'; c.setLineDash([15 * u, 5 * u]); c.beginPath(); c.arc(cx, cy, R, a0, a1); c.stroke(); c.setLineDash([]); };
  const ring = (x, y, rr, far) => { c.strokeStyle = 'rgba(3,5,14,0.88)'; c.lineWidth = 7; c.beginPath(); c.arc(x, y, rr, 0, TAU); c.stroke(); c.strokeStyle = K.rgba(TAP, 1.1 - far * 0.42); c.lineWidth = 4.4 - far; c.beginPath(); c.arc(x, y, rr, 0, TAU); c.stroke(); };
  const node = (x, y, a, lit, far = 0) => { const nr = 15 * u; c.fillStyle = 'rgba(3,5,14,0.88)'; c.beginPath(); c.arc(x, y, (lit ? nr : 9 * u) + 3, 0, TAU); c.fill(); if (!lit) { c.fillStyle = K.rgba(STONE); c.beginPath(); c.arc(x, y, 6.5 * u, 0, TAU); c.fill(); return; } c.fillStyle = 'rgba(16,18,40,0.96)'; c.beginPath(); c.arc(x, y, nr, 0, TAU); c.fill(); c.strokeStyle = K.rgba(TAP, 0.85); c.lineWidth = 2.4; c.beginPath(); c.arc(x, y, nr, 0, TAU); c.stroke(); c.fillStyle = K.rgba(TAP); c.beginPath(); for (let i = 0; i < 10; i++) { const q = a + (i * Math.PI) / 5, rr = nr * (i % 2 ? 0.34 : 0.78); c.lineTo(x + Math.cos(q) * rr, y + Math.sin(q) * rr); } c.closePath(); c.fill(); ring(x, y, nr + 3 + far * 30 * u, far); };
  const A = -2.5; // where Orbin is; the course runs clockwise from him
  tiles(R0, A - 1.5, A, WOKEN); tiles(R0, A, A + 2.3, STONE); tiles(R1, A + 2.1, A + 4.3, STONE);
  // the star stretch: a quiet dotted line well outside the path
  c.fillStyle = K.rgba([150, 158, 204], 0.55); for (let q = A + 0.25; q < A + 1.5; q += 0.07) { const [x, y] = at(R0 + 40 * u, q); c.beginPath(); c.arc(x, y, 2.6, 0, TAU); c.fill(); }
  { const [x, y] = at(R0 + 62 * u, A + 0.9); c.fillStyle = K.rgba([150, 158, 204], 0.8); c.beginPath(); for (let i = 0; i < 10; i++) { const q = (i * Math.PI) / 5, rr = i % 2 ? 4 : 10; c.lineTo(x + Math.cos(q) * rr, y + Math.sin(q) * rr); } c.fill(); }
  // 1: the next tap (ring nearly closed); 2: the one after (ring far out); then nodes that wait, unlit
  let p = at(R0, A + 0.55); node(p[0], p[1], A + 0.55, true, 0.25); const N1 = p;
  p = at(R0, A + 1.25); node(p[0], p[1], A + 1.25, true, 1.4); const N2 = p;
  p = at(R0, A + 1.9); node(p[0], p[1], 0, false); const N3 = p;
  // danger: the closed ring above, a wall, the edge of the path
  c.strokeStyle = 'rgba(3,5,14,0.88)'; c.lineWidth = 12; c.beginPath(); c.arc(cx, cy, R1, A + 0.2, A + 1.0); c.stroke(); c.strokeStyle = K.rgba(DANGER); c.lineWidth = 6; c.stroke(); const D1 = at(R1, A + 0.6);
  { const [x, y] = at(R0, A + 2.3); c.fillStyle = K.rgba(DANGER); c.beginPath(); c.arc(x, y, 5, 0, TAU); c.fill(); }
  // a hold: tap on the node, then follow the ribbon with the finger down, and let go where it ends
  p = at(R1, A + 2.5); node(p[0], p[1], A + 2.5, false); const H0 = p;
  c.lineCap = 'round'; c.strokeStyle = 'rgba(3,5,14,0.8)'; c.lineWidth = 16 * u; c.beginPath(); c.arc(cx, cy, R1 + 16 * u, A + 2.62, A + 3.5); c.stroke(); c.strokeStyle = K.rgba(HOLD, 0.35); c.lineWidth = 11 * u; c.stroke(); c.strokeStyle = K.rgba(HOLD); c.lineWidth = 4 * u; c.stroke();
  { const [x, y] = at(R1 + 16 * u, A + 3.5); c.strokeStyle = K.rgba(HOLD); c.lineWidth = 3; c.beginPath(); c.arc(x, y, 9 * u, 0, TAU); c.stroke(); } const H1 = at(R1 + 16 * u, A + 3.05);
  // an orb in mid-air, a pad on the path, a gate across it: each is a shape in the quiet family, and each wears the same ring when it is a tap
  p = at(R1 + 70 * u, A + 3.95); c.fillStyle = 'rgba(3,5,14,0.88)'; c.beginPath(); c.arc(p[0], p[1], 20 * u, 0, TAU); c.fill(); c.strokeStyle = K.rgba(WOKEN); c.lineWidth = 3; c.beginPath(); c.arc(p[0], p[1], 15 * u, 0, TAU); c.stroke(); c.fillStyle = K.rgba(WOKEN, 0.7); c.beginPath(); c.arc(p[0], p[1], 6 * u, 0, TAU); c.fill(); const O1 = p;
  c.strokeStyle = 'rgba(3,5,14,0.88)'; c.lineWidth = 20; c.lineCap = 'butt'; c.beginPath(); c.arc(cx, cy, R1, A + 4.05, A + 4.25); c.stroke(); c.strokeStyle = K.rgba(WOKEN); c.lineWidth = 13; c.stroke(); const PD = at(R1, A + 4.15);
  // Orbin: gold is his, but pale, and his trail is short and dim
  p = at(R0, A); c.strokeStyle = 'rgba(255,214,150,0.22)'; c.lineWidth = 10 * u; c.lineCap = 'round'; c.beginPath(); c.arc(cx, cy, R0, A - 0.22, A); c.stroke();
  c.save(); c.translate(p[0], p[1]); c.rotate(A + Math.PI / 2); P.spark(c, 0, -34 * 0.3, 0.3, { lite: true, lean: -0.42, arms: 'back', crest: 1, eyes: 'set' }); c.restore(); const OB = p;
  T.finish(c, w, h, 71, 0.4);
  // the legend
  const lx = w * 0.6; let y = 96;
  say(c, 'One signal', lx, y, 54, {}); y += 40; say(c, 'what each thing on the course is, and the only thing that means “tap”', lx, y, 22, { color: '#e6cfae' }); y += 56;
  const rows = [
    [TAP, 'A gold ring closing on a star', 'TAP. It touches the node’s edge exactly on the beat. Nothing else is gold.', N1],
    [TAP, 'The second ring, further out', 'the tap after that. Never more than two are lit.', N2],
    [STONE, 'A small unlit stone', 'a node whose turn has not come. No ring: no tap.', N3],
    [HOLD, 'A blue ribbon', 'a hold: tap its node, keep the finger down along it, let go where it ends.', H1],
    [DANGER, 'Vermilion', 'the one danger colour: a closed ring above, a wall, the end of the path.', D1],
    [WOKEN, 'Soft blue shapes', 'orbs, pads and gates. Each wears the same gold ring when it is the next tap.', O1],
    [WOKEN, 'The path', 'stone asleep ahead of Orbin, soft blue behind him. Never gold.', null],
    [[150, 158, 204], 'A dotted line off the path', 'the stretch that counts for a star: play it clean. Nothing more on the course.', null],
    [[255, 226, 170], 'Orbin', 'pale gold, with a short dim trail. Particles and the drop’s light stay behind the course.', OB]
  ];
  rows.forEach(([col, a, b], i) => { c.fillStyle = K.rgba(col); c.beginPath(); c.arc(lx + 9, y - 8, 9, 0, TAU); c.fill(); if (i < 2) { c.strokeStyle = K.rgba(TAP); c.lineWidth = 3; c.beginPath(); c.arc(lx + 9, y - 8, 15, 0, TAU); c.stroke(); } say(c, a, lx + 40, y, 28, {}); say(c, b, lx + 40, y + 28, 20, { color: '#e6cfae' }); y += 78; });
  say(c, 'Gone from the course: gold bonus notes, gold beads on holds, the gold star trail,', lx, y + 6, 20, { color: '#cdbfae', alpha: 0.9 });
  say(c, 'the white dots. Tapping the nodes themselves on the beat is what builds flow.', lx, y + 32, 20, { color: '#cdbfae', alpha: 0.9 });
  // numbers on the picture, matching nothing but position (the legend's first lines are the lit nodes)
  [[N1, 'tap'], [N2, 'next'], [N3, 'waits'], [H1, 'hold'], [D1, 'danger'], [O1, 'orb'], [PD, 'pad'], [OB, 'Orbin']].forEach(([q, s]) => say(c, s, q[0] + 30, q[1] - 30, 22, { color: '#ffffff', alpha: 0.9 }));
}

// ---------------------------------------------------------------- the Landing as a resting place (mood from the owner's reference; every shape our own)
// Two lights in conversation: cool starlight over everything, one warm fire as the heart. Five layers, each hazier and
// cooler with distance: flowers and grass / Orbin and the fire / the Sleeper (the planetoid itself, an old being of
// stone: its hand cups the fire, its bowed head is the hill behind) / mist / the far horizon with the guardian, the
// three rings and Helion's signal. stars: how many have been brought home (0..4).
export function landing(c, w, h, stars) {
  const tall = h > w, u = tall ? h / 1688 * 1.15 : h / 1350 * 1.25, r = K.RNG(301), k = stars / 4;
  const hy = h * (tall ? 0.52 : 0.5), fx = w * (tall ? 0.6 : 0.56), fy = h * (tall ? 0.8 : 0.8);
  // 5: the sky and the far horizon
  T.sky(c, w, h, [[0, [3, 7, 20]], [0.45, [7, 22, 44]], [0.8, [12, 46, 66]], [1, [22, 72, 84]]], r, 90);
  T.stars(c, w, hy, r, Math.round((w * h) / 2600 * (0.5 + 0.8 * k)), 5);
  K.glow(c, w * 0.2, h * 0.1, 520 * u, [150, 220, 235], 0.4, 'screen'); K.glow(c, w * 0.2, h * 0.1, 90 * u, [225, 248, 255], 0.75); // the cool light: a pale cluster, high and to one side
  const ex = w * (tall ? 0.27 : 0.24);
  P.trials(c, ex, hy - 120 * u, 0.5 * u, K.RNG(41), 0.9); P.guardian(c, ex + 18 * u, hy + 4, 0.1 * u, K.RNG(42), stars >= 1 ? 1 : 0);
  K.glow(c, ex + 6 * u, hy - 124 * u, (16 + 9 * stars) * u, [255, 214, 140], 0.35 + 0.1 * stars); c.fillStyle = 'rgba(255,240,205,0.9)'; c.beginPath(); c.arc(ex + 6 * u, hy - 124 * u, 1.8 * u, 0, TAU); c.fill(); // his brother's signal: small, far, always there
  c.fillStyle = 'rgba(10,30,46,0.55)'; c.fillRect(0, hy - 40 * u, w, 60 * u); // distance: cooler, hazier
  // 4: mist
  for (let i = 0; i < 7; i++) { const y = hy + (i - 1) * 16 * u, g = c.createLinearGradient(0, y - 30 * u, 0, y + 30 * u); g.addColorStop(0, 'rgba(120,190,200,0)'); g.addColorStop(0.5, `rgba(120,190,200,${0.05 + 0.03 * (i % 3)})`); g.addColorStop(1, 'rgba(120,190,200,0)'); c.fillStyle = g; c.fillRect(0, y - 30 * u, w, 60 * u); }
  c.fillStyle = 'rgb(6,20,30)'; c.beginPath(); c.moveTo(0, hy + 26 * u); for (let x = 0; x <= w; x += w / 24) c.lineTo(x, hy + 20 * u + Math.sin(x * 0.004 + 1) * 12 * u + Math.sin(x * 0.013) * 5 * u); c.lineTo(w, h); c.lineTo(0, h); c.fill();
  // 3: the Sleeper: its bowed head and shoulder are the hill behind the fire
  const sx = w * (tall ? 0.8 : 0.78), top = hy - (tall ? 210 : 250) * u;
  const head = () => { c.beginPath(); c.moveTo(sx - 430 * u, hy + 150 * u); c.bezierCurveTo(sx - 360 * u, hy - 60 * u, sx - 250 * u, top + 70 * u, sx - 90 * u, top); c.bezierCurveTo(sx + 60 * u, top - 50 * u, sx + 220 * u, top + 40 * u, sx + 300 * u, hy - 30 * u); c.lineTo(w + 20, hy + 20 * u); c.lineTo(w + 20, hy + 220 * u); c.lineTo(sx - 430 * u, hy + 220 * u); c.closePath(); };
  head(); const hg = c.createLinearGradient(0, top, 0, hy + 200 * u); hg.addColorStop(0, 'rgb(10,34,44)'); hg.addColorStop(1, 'rgb(5,16,24)'); c.fillStyle = hg; c.fill();
  c.save(); head(); c.clip(); c.strokeStyle = 'rgba(150,225,235,0.5)'; c.lineWidth = 5 * u; c.beginPath(); c.moveTo(sx - 430 * u, hy + 150 * u); c.bezierCurveTo(sx - 360 * u, hy - 60 * u, sx - 250 * u, top + 70 * u, sx - 90 * u, top); c.stroke(); // the cool light on its near edge
  if (k > 0) for (let i = 0; i < 60 * k; i++) { const x = sx - 380 * u + r() * 620 * u, y = top + 20 * u + r() * 300 * u; c.strokeStyle = `rgba(70,150,120,${0.25 + 0.3 * r()})`; c.lineWidth = 1.6 * u; c.beginPath(); c.moveTo(x, y); c.lineTo(x + (r() - 0.5) * 8 * u, y - (8 + r() * 12) * u); c.stroke(); } // moss and grass come back on it
  c.restore();
  // its one sign of life: a long closed seam where an eye would be, a little open once stars are home (never a face)
  { const ax = sx - 60 * u, ay = top + 150 * u, open = 4 * u + 16 * u * k; c.strokeStyle = `rgba(150,235,225,${0.35 + 0.5 * k})`; c.lineWidth = 2.4 * u; c.beginPath(); c.moveTo(ax - 90 * u, ay); c.quadraticCurveTo(ax, ay + open, ax + 90 * u, ay - 6 * u); c.stroke(); if (k > 0) { K.glow(c, ax, ay + open * 0.3, 120 * u, [120, 230, 215], 0.25 * k); c.beginPath(); c.moveTo(ax - 90 * u, ay); c.quadraticCurveTo(ax, ay - open * 0.5, ax + 90 * u, ay - 6 * u); c.stroke(); } }
  // the ground he rests on, and the Sleeper's hand: three great fingers of rock curled round the fire
  const gg = c.createLinearGradient(0, hy + 100 * u, 0, h); gg.addColorStop(0, 'rgb(6,24,30)'); gg.addColorStop(1, 'rgb(3,10,16)');
  c.fillStyle = gg; c.beginPath(); c.moveTo(0, hy + 190 * u); c.quadraticCurveTo(w * 0.5, hy + 110 * u, w, hy + 170 * u); c.lineTo(w, h); c.lineTo(0, h); c.fill();
  const fire = 0.12 + 0.88 * Math.sqrt(k), F = (26 + 150 * fire) * u; // its height: an ember, then a fire
  K.glow(c, fx, fy, (220 + 620 * fire) * u, [255, 150, 70], 0.18 + 0.34 * fire, 'screen');
  for (const [dx, lean, len] of [[-210, 0.5, 250], [150, -0.34, 300], [300, -0.6, 220]]) {
    const bx = fx + dx * u, by = fy + 30 * u, tx = bx + lean * len * u, ty = by - len * u * (0.8 + 0.25 * k);
    c.fillStyle = 'rgb(5,17,24)'; c.beginPath(); c.moveTo(bx - 46 * u, by + 40 * u); c.quadraticCurveTo(bx - 30 * u + lean * 60 * u, (by + ty) / 2, tx - 8 * u, ty); c.quadraticCurveTo(tx + 14 * u, ty + 6 * u, tx + 12 * u, ty + 30 * u); c.quadraticCurveTo(bx + 44 * u + lean * 50 * u, (by + ty) / 2, bx + 50 * u, by + 40 * u); c.closePath(); c.fill();
    c.strokeStyle = `rgba(255,170,96,${0.12 + 0.5 * fire})`; c.lineWidth = 3 * u; c.beginPath(); if (dx < 0) { c.moveTo(bx + 50 * u, by + 30 * u); c.quadraticCurveTo(bx + 44 * u + lean * 50 * u, (by + ty) / 2, tx + 12 * u, ty + 30 * u); } else { c.moveTo(bx - 46 * u, by + 30 * u); c.quadraticCurveTo(bx - 30 * u + lean * 60 * u, (by + ty) / 2, tx - 8 * u, ty); } c.stroke(); // the fire's light on the side that faces it
  }
  // 2: the fire, made of the stars brought home; and Orbin, resting beside it
  c.save(); c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 6 + 16 * fire; i++) { const bx = fx + (r() - 0.5) * F * 0.9, kk = 1 - Math.abs(bx - fx) / (F * 0.6), hh = F * (0.5 + r() * 0.9) * Math.max(0.25, kk), wd = (7 + r() * 11) * u * (0.5 + fire), lean = (r() - 0.5) * 22 * u; c.fillStyle = K.rgba(i % 3 === 0 ? [255, 228, 160] : i % 3 === 1 ? [255, 150, 70] : [230, 84, 50], 0.22); c.beginPath(); c.moveTo(bx - wd, fy + 10 * u); c.bezierCurveTo(bx - wd * 1.3, fy - hh * 0.4, bx + lean - wd * 0.2, fy - hh * 0.8, bx + lean, fy - hh); c.bezierCurveTo(bx + lean + wd * 0.4, fy - hh * 0.7, bx + wd * 1.3, fy - hh * 0.35, bx + wd, fy + 10 * u); c.closePath(); c.fill(); }
  c.restore();
  K.glow(c, fx, fy, F * 0.7, [255, 238, 196], 0.55);
  for (let i = 0; i < stars; i++) { const a = -Math.PI / 2 + (i - (stars - 1) / 2) * 0.7; star(c, fx + Math.cos(a) * F * 0.34, fy - 8 * u + Math.sin(a) * F * 0.16, 0.24 * u, [[214, 96, 60], [170, 110, 220], [90, 140, 230], [80, 190, 140]][i]); } // each star, small, in the heart of it
  for (let i = 0; i < 8 + 34 * fire; i++) { const t = r(), x = fx + (r() - 0.5) * (40 + 160 * t) * u, y = fy - F * (0.7 + 2.4 * t); c.fillStyle = `rgba(255,${200 + r() * 40},130,${(1 - t) * 0.8})`; c.beginPath(); c.arc(x, y, (0.8 + r() * 1.8) * u, 0, TAU); c.fill(); } // sparks, rising
  c.strokeStyle = 'rgb(8,14,18)'; c.lineCap = 'round'; c.lineWidth = 13 * u; c.beginPath(); c.moveTo(fx - F * 0.5, fy + 18 * u); c.lineTo(fx + F * 0.42, fy + 4 * u); c.moveTo(fx - F * 0.36, fy + 2 * u); c.lineTo(fx + F * 0.5, fy + 20 * u); c.stroke();
  { const ox = fx - (tall ? 230 : 290) * u, oy = fy + 4 * u; c.fillStyle = 'rgb(7,20,26)'; c.beginPath(); c.ellipse(ox - 60 * u, oy + 22 * u, 90 * u, 34 * u, -0.1, 0, TAU); c.fill(); // the stone he leans on
    c.save(); c.translate(ox, oy); c.rotate(-1.02); P.spark(c, 0, 0, 0.5 * u, { glow: 0.55 + 0.3 * k, eyes: 'closed', crest: 0.15, arms: 'rest', ring: true, face: -1, beat: 0.4 }); c.restore(); }
  // 1: the foreground: grass and small flowers, dark against the fire, lit warm where they face it
  const flowers = Math.round((6 + 64 * k) * (w / 780));
  for (let i = 0; i < 40 + flowers * 2; i++) { const x = r() * w, y = h - r() * r() * 300 * u, len = (14 + r() * 30) * u, near = Math.max(0, 1 - Math.hypot(x - fx, y - fy) / (700 * u)); c.strokeStyle = K.rgba(K.mix([14, 60, 54], [220, 150, 80], near * fire * 0.8), 0.75); c.lineWidth = 2.2 * u; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + (r() - 0.5) * 10 * u, y - len * 0.6, x + (r() - 0.5) * 16 * u, y - len); c.stroke(); }
  for (let i = 0; i < flowers; i++) { const x = r() * w, y = h - r() * 330 * u, s2 = (3.2 + r() * 3.2) * u, near = Math.max(0, 1 - Math.hypot(x - fx, y - fy) / (700 * u)); K.glow(c, x, y, s2 * 3.4, K.mix([150, 230, 225], [255, 220, 160], near), 0.28); c.fillStyle = K.rgba(K.mix([210, 245, 240], [255, 240, 205], near)); for (let p2 = 0; p2 < 5; p2++) { c.beginPath(); c.arc(x + Math.cos(p2 * 1.257) * s2, y + Math.sin(p2 * 1.257) * s2, s2 * 0.62, 0, TAU); c.fill(); } }
  for (let i = 0; i < 30 + 50 * k; i++) { c.fillStyle = `rgba(160,240,230,${0.15 + r() * 0.4})`; c.beginPath(); c.arc(r() * w, hy + r() * (h - hy), (0.8 + r() * 1.8) * u, 0, TAU); c.fill(); } // motes of light, drifting
  T.finish(c, w, h, 311, 0.55);
}
export const LANDING = [
  ['1 · the first visit: an ember, bare stone, the Sleeper fast asleep', (c) => { landing(c, W, H, 0); note(c, 'no stars home yet'); }],
  ['2 · three stars home: a real fire, flowers and grass, its seam of light a little open', (c) => { landing(c, W, H, 3); note(c, 'three stars home'); }]
];
