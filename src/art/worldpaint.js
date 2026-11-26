// The worlds you play on (the owner's brief, 2026-11-25: the level IS the story). The planet in the middle of the ring
// is the place itself, painted once cold and once relit, with its landmarks; and its inhabitant, rigged as a cutout
// (every part on its own joint) so it moves through in-betweens instead of swapping poses.
//   Emberwick: basalt and slag; the forge (where the relighting starts, at the top), the anvil (facing Ossa, low left),
//   the lava channels running out from the forge, and the Stillness's residue lying dark on the cold ground.
//   Ossa: a giant beast of cooled slag with a fire banked in its ribs and antlers like tuning forks, beside the planet.
//   The Drifting Edge: a small grey planetoid, the Sleeper curled round it, its stone hand cupped round an empty pit.
import { CANON } from './canonpaint.js';
import { DUSK, K } from './painter.js';

const T = DUSK.tools, TAU = Math.PI * 2;
const R0 = 200; // the planets are painted at this radius and scaled
const lerp = (a, b, t) => a + (b - a) * t;

// ---------------------------------------------------------------- Emberwick
/** where the landmarks stand (angle round the planet, 0 = right, -PI/2 = top) */
const EMBER = { forge: -Math.PI / 2, anvil: Math.PI * 0.62, channels: 9 };

function channelsOf(seed) {
  const rr = K.RNG(seed), out = [];
  for (let k = 0; k < EMBER.channels; k++) {
    let a = EMBER.forge + (k - 4) * 0.62, d0 = R0 * 0.1;
    const pts = [[Math.cos(EMBER.forge) * R0 * 0.62 + Math.cos(a) * d0, Math.sin(EMBER.forge) * R0 * 0.62 + Math.sin(a) * d0]];
    let x = pts[0][0], y = pts[0][1];
    for (let i = 0; i < 9; i++) { a += (rr() - 0.5) * 0.45; x += Math.cos(a) * R0 * 0.13; y += Math.sin(a) * R0 * 0.13; if (Math.hypot(x, y) > R0 * 0.97) break; pts.push([x, y]); }
    out.push(pts);
  }
  return out;
}
const CHANNELS = channelsOf(31);

function forgeShape(c, s, hot) {
  // a great squat furnace of stone, wider than tall, with a deep mouth and a chimney; it stands on the planet's crown
  c.fillStyle = hot ? 'rgb(54,30,30)' : 'rgb(30,26,36)';
  c.beginPath(); c.moveTo(-70 * s, 4); c.lineTo(-58 * s, -54 * s); c.lineTo(-24 * s, -74 * s); c.lineTo(-18 * s, -132 * s); c.lineTo(18 * s, -132 * s); c.lineTo(24 * s, -74 * s); c.lineTo(58 * s, -54 * s); c.lineTo(70 * s, 4); c.closePath(); c.fill();
  c.strokeStyle = hot ? 'rgba(255,170,100,0.55)' : 'rgba(150,150,190,0.28)'; c.lineWidth = 2.2; c.stroke();
  for (let i = 0; i < 5; i++) { c.strokeStyle = hot ? 'rgba(120,60,40,0.7)' : 'rgba(18,14,24,0.8)'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(-62 * s + i * 4 * s, -12 * s - i * 9 * s); c.lineTo(62 * s - i * 4 * s, -12 * s - i * 9 * s); c.stroke(); } // courses of stone
  c.fillStyle = hot ? 'rgba(255,170,80,0.9)' : 'rgb(8,6,12)';
  c.beginPath(); c.ellipse(0, -26 * s, 30 * s, 24 * s, 0, Math.PI, TAU); c.lineTo(30 * s, -6 * s); c.lineTo(-30 * s, -6 * s); c.closePath(); c.fill();
  if (hot) K.glow(c, 0, -22 * s, 80 * s, [255, 140, 60], 0.55, 'screen');
}
function anvilShape(c, s, hot) {
  c.fillStyle = hot ? 'rgb(46,32,36)' : 'rgb(26,22,32)';
  c.beginPath(); c.moveTo(-22 * s, 2); c.lineTo(-16 * s, -30 * s); c.lineTo(-48 * s, -38 * s); c.lineTo(-66 * s, -56 * s); c.lineTo(58 * s, -56 * s); c.lineTo(44 * s, -38 * s); c.lineTo(16 * s, -30 * s); c.lineTo(22 * s, 2); c.closePath(); c.fill();
  c.strokeStyle = hot ? 'rgba(255,200,140,0.5)' : 'rgba(150,150,190,0.3)'; c.lineWidth = 2; c.stroke();
  c.fillStyle = hot ? 'rgba(255,220,170,0.35)' : 'rgba(150,150,190,0.12)'; c.fillRect(-60 * s, -58 * s, 112 * s, 4 * s); // its face
}
/** On the surface at angle a: translated to the ground there and turned so its up is away from the middle. */
function onSurface(c, a, r, draw) { c.save(); c.translate(Math.cos(a) * r, Math.sin(a) * r); c.rotate(a + Math.PI / 2); draw(); c.restore(); }

/** The planet painted once, cold (asleep, residue) or hot (relit), centred in a square canvas of side 2.7 R0. */
function emberLayer(hot) {
  const S = Math.round(R0 * 2.7), cv = document.createElement('canvas'); cv.width = cv.height = S;
  const c = cv.getContext('2d'); c.translate(S / 2, S / 2);
  const r = K.RNG(7);
  T.sphere(c, 0, 0, R0, hot ? [70, 40, 40] : [44, 40, 52], hot ? [150, 96, 80] : [96, 88, 100], [12, 10, 18], -0.8, r);
  c.save(); c.beginPath(); c.arc(0, 0, R0, 0, TAU); c.clip();
  // cooled slag in plates, and the lava channels
  for (let i = 0; i < 60; i++) { const a = r() * TAU, d = r() * R0; c.fillStyle = hot ? `rgba(30,14,14,${0.15 + 0.2 * r()})` : `rgba(14,12,20,${0.18 + 0.2 * r()})`; c.beginPath(); c.ellipse(Math.cos(a) * d, Math.sin(a) * d, 8 + r() * 24, 5 + r() * 12, r() * 3, 0, TAU); c.fill(); }
  for (const pts of CHANNELS) {
    c.lineCap = 'round'; c.lineJoin = 'round';
    // (relit, they glow red-orange and stay under the course: the gold belongs to the tap alone)
    if (hot) { c.shadowColor = 'rgba(230,80,40,0.5)'; c.shadowBlur = 8; c.strokeStyle = 'rgba(214,88,46,0.62)'; c.lineWidth = 6; }
    else { c.strokeStyle = 'rgba(16,12,22,0.95)'; c.lineWidth = 5.5; }
    c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke(); c.shadowBlur = 0;
    if (hot) { c.strokeStyle = 'rgba(255,150,100,0.3)'; c.lineWidth = 2; c.stroke(); }
  }
  if (!hot) { // the Stillness's residue: dark violet stains, smudged
    c.filter = 'blur(5px)';
    for (let k = 0; k < 22; k++) { const a = r() * TAU, d = R0 * (0.2 + 0.72 * r()); c.fillStyle = 'rgba(34,20,52,0.62)'; c.beginPath(); c.ellipse(Math.cos(a) * d, Math.sin(a) * d, 20 + r() * 34, 10 + r() * 16, a, 0, TAU); c.fill(); }
    c.filter = 'none';
  } else K.glow(c, 0, -R0 * 0.5, R0 * 1.1, [255, 120, 60], 0.22, 'screen');
  c.restore();
  // the rim: cool asleep, ember when relit
  c.strokeStyle = hot ? 'rgba(255,150,80,0.7)' : 'rgba(150,160,200,0.28)'; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, R0, 0, TAU); c.stroke();
  // the landmarks, big enough to read at a glance: the forge on the crown, the anvil facing Ossa
  onSurface(c, EMBER.forge, R0 * 0.97, () => forgeShape(c, 1.05, hot));
  onSurface(c, EMBER.anvil, R0 * 0.98, () => anvilShape(c, 1.0, hot));
  return cv;
}

// ---------------------------------------------------------------- Ossa, rigged
/**
 * Ossa as a cutout: body, four legs (thigh and shin, a knee each), neck and head, two antler forks, a short tail.
 * p: rise 0 (lying) .. 1 (standing); rear 0 .. 1 (forequarters up, for a strike); head (radians, + is down);
 * antler (extra sway, radians, lags the head); tail (radians, lags the body); breath 0..1; lit 0 (a dead coal) ..
 * 1 (the forge alight); flicker 0..1 (the rib-fire's pulse, its blink); face 1 or -1.
 */
function ossa(c, x, y, s, p) {
  const { rise = 1, rear = 0, head = 0, antler = 0, tail = 0, breath = 0, lit = 0, flicker = 0.5, face = 1 } = p;
  c.save(); c.translate(x, y); c.scale(s * face, s);
  const slag = K.rgba(K.mix([24, 17, 32], [62, 32, 40], lit * 0.6)), edge = K.rgba([255, 200, 140], 0.12 + 0.4 * lit);
  const sink = 34 * (1 - rise);
  // the forequarters lift about the hind hips (a rear), the whole body sinks when lying
  const pivot = [-77, -62 + sink], ang = -0.38 * rear;
  const body = (f) => { c.save(); c.translate(pivot[0], pivot[1]); c.rotate(ang); c.translate(-pivot[0], -pivot[1]); f(); c.restore(); };
  if (lit > 0.1) K.glow(c, 20, -86 + sink, 230, [255, 140, 70], 0.3 * lit);
  // legs: thigh from the hip, shin from the knee; folded under when lying, the forelegs reaching when rearing
  const leg = (hx, hy, fore) => {
    const fold = 1 - rise, reach = fore ? rear : 0;
    const th = (fore ? 0.15 : -0.1) + fold * (fore ? -1.25 : 1.2) + reach * -0.9, sh = fold * (fore ? 2.3 : -2.2) + reach * 1.2;
    c.save(); c.translate(hx, hy); c.rotate(th);
    c.fillStyle = slag; c.beginPath(); c.moveTo(-12, -2); c.lineTo(12, -2); c.lineTo(9, 34); c.lineTo(-9, 34); c.closePath(); c.fill();
    c.translate(0, 32); c.rotate(sh);
    c.beginPath(); c.moveTo(-9, 0); c.lineTo(9, 0); c.lineTo(7, 32); c.lineTo(-7, 32); c.closePath(); c.fill();
    c.fillStyle = 'rgb(14,10,18)'; c.fillRect(-9, 30, 18, 6); // the hoof
    c.restore();
  };
  body(() => { leg(-92, -62 + sink, false); leg(-62, -62 + sink, false); });
  // the tail: a short heavy sweep of slag, lagging the body
  body(() => { c.save(); c.translate(-128, -76 + sink); c.rotate(0.5 + tail); c.strokeStyle = slag; c.lineWidth = 12; c.lineCap = 'round'; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(-22, 18, -16, 46); c.stroke(); c.restore(); });
  body(() => {
    c.save(); c.translate(0, sink);
    // breathing: the barrel swells a little (about its belly)
    c.translate(0, -44); c.scale(1, 1 + 0.025 * Math.sin(breath * TAU)); c.translate(0, 44);
    const shape = [[-122, -90], [-76, -124], [-6, -128], [56, -146], [108, -116], [112, -66], [64, -44], [-20, -40], [-100, -48], [-130, -68]];
    c.fillStyle = slag; K.path(c, shape); c.fill();
    c.save(); K.path(c, shape); c.clip();
    const glowA = (0.15 + 0.7 * lit) * (0.75 + 0.25 * flicker);
    K.glow(c, 60, -94, 80, [255, 150, 70], glowA);
    for (let i = 0; i < 4; i++) { c.strokeStyle = K.rgba([255, 160 + i * 10, 80], 0.1 + 0.85 * lit * (0.8 + 0.2 * flicker)); c.lineWidth = 6; c.lineCap = 'round'; if (lit > 0.3) { c.shadowColor = 'rgba(255,130,60,0.9)'; c.shadowBlur = 14 * lit; } c.beginPath(); c.moveTo(20 + i * 16, -126); c.quadraticCurveTo(34 + i * 16, -96, 24 + i * 16, -60); c.stroke(); c.shadowBlur = 0; }
    c.restore();
    c.strokeStyle = edge; c.lineWidth = 2.4; c.beginPath(); [[-122, -90], [-76, -124], [-6, -128], [56, -146], [100, -122]].forEach(([px, py], i) => (i ? c.lineTo(px, py) : c.moveTo(px, py))); c.stroke();
    c.restore();
  });
  body(() => { leg(64, -62 + sink, true); leg(92, -62 + sink, true); });
  // neck and head about the shoulder; the antlers about the brow, swaying after the head
  body(() => {
    c.save(); c.translate(86, -104 + sink); c.rotate(head); c.translate(-86, 104);
    c.fillStyle = slag;
    K.path(c, [[66, -120], [98, -152], [130, -180], [152, -172], [124, -138], [108, -96]]); c.fill();
    K.path(c, [[126, -182], [176, -176], [192, -162], [152, -152], [124, -160]]); c.fill();
    c.save(); c.translate(146, -170); c.rotate(antler);
    for (const [ox, oy, k, a] of [[14, 4, 0.8, 0.7], [0, 0, 1, 1]]) {
      c.save(); c.translate(ox, oy); c.scale(k, k); c.rotate(-0.12);
      c.strokeStyle = K.rgba(K.mix([40, 28, 44], [255, 214, 150], lit * 0.75), a); c.lineWidth = 6; c.lineCap = 'round'; c.lineJoin = 'round';
      if (lit > 0.4) { c.shadowColor = 'rgba(255,200,130,0.9)'; c.shadowBlur = 12 * lit; }
      c.beginPath(); c.moveTo(0, 8); c.lineTo(0, -26); c.moveTo(-13, -82); c.lineTo(-13, -38); c.quadraticCurveTo(-13, -26, 0, -26); c.quadraticCurveTo(13, -26, 13, -38); c.lineTo(13, -82); c.stroke();
      c.restore();
    }
    c.restore();
    c.restore();
  });
  c.restore();
}
/** Where Ossa's forehooves come down (relative to x, y, before scale and face): for the strike's flash. */
const OSSA_HOOF = [78, 0];

function hearthStone(c, x, y, s, flash) {
  c.save(); c.translate(x, y);
  c.fillStyle = 'rgb(22,16,26)'; c.beginPath(); c.moveTo(-70 * s, 6 * s); c.lineTo(-56 * s, -20 * s); c.lineTo(50 * s, -24 * s); c.lineTo(72 * s, 6 * s); c.closePath(); c.fill();
  c.strokeStyle = flash > 0.05 ? `rgba(255,210,150,${0.3 + 0.6 * flash})` : 'rgba(150,150,190,0.25)'; c.lineWidth = 2; c.stroke();
  if (flash > 0.02) K.glow(c, 0, -22 * s, 110 * s, [255, 200, 130], 0.7 * flash, 'screen');
  c.restore();
}

// ---------------------------------------------------------------- the Drifting Edge
/** the planetoid, painted once: grey rock, a few craters, the pit on its crown where the first star will rest */
function edgeLayer(lit) {
  const S = Math.round(R0 * 2.7), cv = document.createElement('canvas'); cv.width = cv.height = S;
  const c = cv.getContext('2d'); c.translate(S / 2, S / 2);
  const r = K.RNG(17);
  T.sphere(c, 0, 0, R0, lit ? [52, 70, 78] : [50, 54, 66], lit ? [130, 170, 170] : [110, 116, 130], [10, 14, 22], -0.8, r);
  c.save(); c.beginPath(); c.arc(0, 0, R0, 0, TAU); c.clip();
  for (let i = 0; i < 16; i++) { const a = r() * TAU, d = r() * R0 * 0.9, rr = 8 + r() * 22; c.fillStyle = 'rgba(10,14,22,0.35)'; c.beginPath(); c.arc(Math.cos(a) * d, Math.sin(a) * d, rr, 0, TAU); c.fill(); c.strokeStyle = 'rgba(160,180,200,0.12)'; c.lineWidth = 1.5; c.beginPath(); c.arc(Math.cos(a) * d + 1, Math.sin(a) * d + 1, rr, Math.PI, TAU); c.stroke(); }
  if (lit) { c.fillStyle = 'rgba(70,130,100,0.35)'; for (let i = 0; i < 40; i++) { const a = r() * TAU, d = R0 * (0.3 + 0.65 * r()); c.beginPath(); c.ellipse(Math.cos(a) * d, Math.sin(a) * d, 14 + r() * 20, 6 + r() * 8, a, 0, TAU); c.fill(); } } // moss and grass come back
  c.restore();
  c.strokeStyle = lit ? 'rgba(150,235,220,0.5)' : 'rgba(150,160,200,0.25)'; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, R0, 0, TAU); c.stroke();
  return cv;
}
/**
 * The Sleeper, curled round the planetoid: a long body of stone hugging its lower side, its head at one end with a
 * closed seam of light, its hand cupped round the pit on the crown. p: wake 0..1 (the seam opens, the head lifts),
 * curl 0..1 (the fingers close round the pit), breath 0..1.
 */
function sleeper(c, R, p) {
  const { wake = 0, curl = 0.6, breath = 0 } = p, k = R / R0;
  c.save(); c.scale(k, k);
  const sw = 1 + 0.02 * Math.sin(breath * TAU);
  // the body: a thick curve of stone round the lower side, just inside the rim
  c.save(); c.scale(sw, sw);
  // (a pale rim of starlight on its back, so its shape reads against the rock)
  c.strokeStyle = 'rgba(150,225,235,0.35)'; c.lineWidth = 54; c.lineCap = 'round';
  c.beginPath(); c.arc(0, 0, R0 * 0.78, Math.PI * 0.05, Math.PI * 0.95); c.stroke();
  c.strokeStyle = 'rgb(20,40,48)'; c.lineWidth = 48; c.stroke();
  c.strokeStyle = 'rgba(150,225,235,0.55)'; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, R0 * 0.78 + 22, Math.PI * 0.08, Math.PI * 0.92); c.stroke();
  for (let i = 0; i < 7; i++) { const a = Math.PI * (0.15 + i * 0.11); c.strokeStyle = 'rgba(8,18,24,0.7)'; c.lineWidth = 3; c.beginPath(); c.moveTo(Math.cos(a) * R0 * 0.66, Math.sin(a) * R0 * 0.66); c.lineTo(Math.cos(a) * R0 * 0.9, Math.sin(a) * R0 * 0.9); c.stroke(); } // the plates of its back
  c.restore();
  // the head at the right end, lifting a little as it wakes; one long seam of light where an eye would be
  c.save(); c.rotate(Math.PI * 0.02 - 0.18 * wake); c.translate(R0 * 0.78, 0);
  c.fillStyle = 'rgba(150,225,235,0.35)'; c.beginPath(); c.ellipse(0, -14, 58, 46, -0.4, 0, TAU); c.fill();
  c.fillStyle = 'rgb(22,44,52)'; c.beginPath(); c.ellipse(0, -14, 55, 43, -0.4, 0, TAU); c.fill();
  const open = 2 + 10 * wake;
  c.strokeStyle = `rgba(150,235,225,${0.35 + 0.55 * wake})`; c.lineWidth = 2.6; c.lineCap = 'round';
  c.beginPath(); c.moveTo(-32, -16); c.quadraticCurveTo(0, -16 + open, 32, -22); c.stroke();
  if (wake > 0.05) K.glow(c, 0, -16, 46, [120, 230, 215], 0.35 * wake);
  c.restore();
  // the hand on the crown: four fingers and a thumb cupped round the pit; they close a little as it sleeps, open as it wakes
  c.save(); c.translate(0, -R0 * 0.86);
  c.fillStyle = 'rgba(30,26,22,0.9)'; c.beginPath(); c.ellipse(0, 6, 26, 9, 0, 0, TAU); c.fill(); // the pit
  for (let i = 0; i < 5; i++) {
    const side = i < 2 ? -1 : 1, j = i < 2 ? i : i - 2, base = side * (30 + j * 12), bend = (0.9 - 0.5 * curl) * side;
    c.save(); c.translate(base, 8); c.rotate(-side * 0.2 - bend * 0.6);
    c.strokeStyle = 'rgba(150,225,235,0.4)'; c.lineWidth = i === 0 || i === 4 ? 19 : 17; c.lineCap = 'round';
    c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(-side * 6, -26, -side * (14 + 10 * curl), -36 - j * 4); c.stroke();
    c.strokeStyle = 'rgb(22,42,50)'; c.lineWidth = i === 0 || i === 4 ? 16 : 14;
    c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(-side * 6, -26, -side * (14 + 10 * curl), -36 - j * 4); c.stroke();
    c.restore();
  }
  c.restore();
  c.restore();
}

export const WORLDS = { R0, EMBER, CHANNELS, emberLayer, edgeLayer, ossa, OSSA_HOOF, hearthStone, sleeper, onSurface, forgeShape, anvilShape };
