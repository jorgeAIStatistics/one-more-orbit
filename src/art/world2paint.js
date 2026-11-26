// The worlds of World 1 after Emberwick (the owner's brief of 2026-11-25): each is the planet itself in the middle of
// the ring, painted once cold (the Stillness's residue on it) and once relit, and its inhabitant beside it, rigged as a
// cutout (every part on its own joint, so it moves through in-betweens). The atmosphere darkens toward the guardian:
//   Cirra, still hopeful: a world of cloud banks and kite masts; Seo, all folded sailcloth and angles, keeps the kites.
//   Glassmere, quieter and stranger: a lake world, its surface a mirror; Vell is only ever seen as a reflection.
//   Verdance, gloomy and serious: the great tree's world, its roots round the planet; Morrow, a huge slow climber with a
//   mossed back where the seed-lights live.
// No faces on the inhabitants (as Ossa): what they feel is in how they move.
import { DUSK, K } from './painter.js';

const T = DUSK.tools, TAU = Math.PI * 2;
const R0 = 200; // (as worldpaint: planets painted at this radius, in a square of side 2.7 R0, and scaled)
const lerp = (a, b, t) => a + (b - a) * t;
const sheet = () => { const S = Math.round(R0 * 2.7), cv = document.createElement('canvas'); cv.width = cv.height = S; const c = cv.getContext('2d'); c.translate(S / 2, S / 2); return [cv, c]; };
function onSurface(c, a, r, draw) { c.save(); c.translate(Math.cos(a) * r, Math.sin(a) * r); c.rotate(a + Math.PI / 2); draw(); c.restore(); }
/** the Stillness's residue on a cold planet: dark violet stains, smudged */
function residue(c, r, n, col = 'rgba(34,20,52,0.62)') {
  c.filter = 'blur(5px)';
  for (let k = 0; k < n; k++) { const a = r() * TAU, d = R0 * (0.15 + 0.78 * r()); c.fillStyle = col; c.beginPath(); c.ellipse(Math.cos(a) * d, Math.sin(a) * d, 18 + r() * 36, 9 + r() * 16, a, 0, TAU); c.fill(); }
  c.filter = 'none';
}

// ---------------------------------------------------------------- Cirra
/** the kite masts round the rim (angles), where the strings run from */
const CIRRA = { masts: [-Math.PI / 2, -Math.PI * 0.1, Math.PI * 0.3, Math.PI * 0.72, Math.PI * 1.12] };
function cirraLayer(hot) {
  const [cv, c] = sheet(), r = K.RNG(41);
  T.sphere(c, 0, 0, R0, hot ? [120, 70, 120] : [58, 54, 70], hot ? [250, 196, 232] : [120, 118, 134], [16, 12, 28], -0.8, r);
  c.save(); c.beginPath(); c.arc(0, 0, R0, 0, TAU); c.clip();
  // cloud banks, in bands that wrap the planet (still when cold; when relit, swept into spirals by the wind)
  for (let b = 0; b < 7; b++) {
    const y = -R0 * 0.8 + b * R0 * 0.27, sw = hot ? 0.5 : 0.08;
    for (let i = 0; i < 9; i++) {
      const x = -R0 + r() * R0 * 2, rx = 30 + r() * 60, ry = 10 + r() * 16;
      c.fillStyle = hot ? K.rgba(K.mix([255, 220, 245], [200, 150, 220], r()), 0.35 + 0.25 * r()) : `rgba(150,148,166,${0.12 + 0.15 * r()})`;
      c.beginPath(); c.ellipse(x, y + Math.sin(x / 40) * 8, rx, ry, sw * Math.sin(b + i), 0, TAU); c.fill();
    }
  }
  if (hot) { // the wind, drawn: spirals of light swept round the globe
    c.lineCap = 'round';
    for (let i = 0; i < 9; i++) { const cx = (r() - 0.5) * R0 * 1.4, cy = (r() - 0.5) * R0 * 1.4, rr = 24 + r() * 40; c.strokeStyle = 'rgba(255,240,250,0.45)'; c.lineWidth = 2.4; c.beginPath(); for (let k = 0; k < 40; k++) { const a = k * 0.32, d = rr * (1 - k / 46); (k ? c.lineTo : c.moveTo).call(c, cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.6); } c.stroke(); }
    K.glow(c, 0, -R0 * 0.4, R0 * 1.1, [255, 200, 240], 0.25, 'screen');
  } else residue(c, r, 20);
  c.restore();
  c.strokeStyle = hot ? 'rgba(255,214,245,0.7)' : 'rgba(150,160,200,0.28)'; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, R0, 0, TAU); c.stroke();
  // the masts: tall thin poles of pale wood with a crossbar, the kite strings tied to them (slack when cold)
  for (const a of CIRRA.masts) onSurface(c, a, R0 * 0.98, () => {
    c.strokeStyle = hot ? 'rgb(120,80,110)' : 'rgb(40,38,52)'; c.lineWidth = 5; c.lineCap = 'round';
    c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -64); c.moveTo(-14, -52); c.lineTo(14, -52); c.stroke();
    c.strokeStyle = hot ? 'rgba(255,230,250,0.75)' : 'rgba(140,140,160,0.45)'; c.lineWidth = 1.4;
    c.beginPath(); c.moveTo(0, -64); if (hot) c.quadraticCurveTo(22, -90, 36, -120); else c.quadraticCurveTo(12, -40, 26, -8); c.stroke();
  });
  return cv;
}
/**
 * Seo: tall and thin, all angles, folded sailcloth. p: wake 0 (slumped, tangled in its lines) .. 1 (standing, the lines
 * free); fly 0..1 (arms up, kites aloft); sway (radians, the body leaning with the wind); flap 0..1 (the cloth's
 * flutter, lagging); lit 0..1; t: seconds (for the kites' drift). face 1 or -1.
 */
function seo(c, x, y, s, p) {
  const { wake = 0, fly = 0, sway = 0, flap = 0, lit = 0, t = 0, face = 1 } = p;
  c.save(); c.translate(x, y); c.scale(s * face, s);
  const cloth = K.rgba(K.mix([70, 64, 88], [236, 214, 236], lit * 0.85)), fold = K.rgba(K.mix([44, 40, 60], [190, 150, 200], lit * 0.8)), rim = `rgba(255,230,250,${0.3 + 0.5 * lit})`;
  const slump = 1 - wake;
  c.rotate(sway * 0.6 + slump * 0.5);
  // the kites, above and behind: diamonds on lines that run to its hands (tangled and fallen when asleep)
  const hands = [[-26 - 30 * fly, -150 - 40 * fly], [24 + 34 * fly, -146 - 50 * fly]];
  for (let k = 0; k < 3; k++) {
    const hk = hands[k % 2], up = fly * (1 - 0.1 * k), kx = hk[0] + (k - 1) * 90 + Math.sin(t * 0.9 + k) * 18 * up, ky = lerp(-40 + k * 10, -420 - k * 70, up) + Math.cos(t * 1.3 + k) * 14 * up;
    c.strokeStyle = `rgba(255,235,250,${0.25 + 0.45 * lit})`; c.lineWidth = 1.2; c.beginPath(); c.moveTo(hk[0], hk[1]); c.quadraticCurveTo((hk[0] + kx) / 2 + 40 * up, (hk[1] + ky) / 2 + 30, kx, ky); c.stroke();
    c.save(); c.translate(kx, ky); c.rotate(0.3 * Math.sin(t * 1.7 + k) * up + (1 - up) * 1.2);
    c.fillStyle = k === 1 ? K.rgba(K.mix([60, 50, 70], [255, 170, 220], lit)) : K.rgba(K.mix([50, 46, 64], [220, 180, 255], lit)); c.beginPath(); c.moveTo(0, -26); c.lineTo(18, 0); c.lineTo(0, 30); c.lineTo(-18, 0); c.closePath(); c.fill();
    c.strokeStyle = rim; c.lineWidth = 1.5; c.stroke();
    c.strokeStyle = `rgba(255,235,250,${0.3 + 0.4 * lit})`; c.beginPath(); c.moveTo(0, 30); c.quadraticCurveTo(10 + 8 * Math.sin(t * 3 + k), 52, 0, 74); c.stroke(); // its tail
    c.restore();
  }
  // legs: two long folded struts
  c.fillStyle = fold; c.beginPath(); c.moveTo(-14, -70 + 30 * slump); c.lineTo(-30, 0); c.lineTo(-20, 0); c.lineTo(-4, -64 + 30 * slump); c.closePath(); c.fill();
  c.beginPath(); c.moveTo(6, -66 + 30 * slump); c.lineTo(26, 0); c.lineTo(36, 0); c.lineTo(16, -70 + 30 * slump); c.closePath(); c.fill();
  // the body: panels of sailcloth, one over another, each lagging the one before (the flutter)
  const panels = [[[-24, -70], [24, -70], [16, -128], [-18, -126]], [[-20, -120], [20, -124], [12, -176], [-14, -170]], [[-16, -166], [16, -172], [6, -214], [-10, -208]]];
  panels.forEach((pts, i) => {
    c.save(); c.translate(0, 30 * slump * (1 - i * 0.2)); c.rotate((flap * 0.08 + slump * 0.15) * (i + 1) * (i % 2 ? -1 : 1));
    c.fillStyle = i % 2 ? fold : cloth; K.path(c, pts); c.fill();
    c.strokeStyle = rim; c.lineWidth = 1.4; c.stroke();
    c.restore();
  });
  // the head: one folded triangle, tipped forward when asleep, lifted when awake (no face)
  c.save(); c.translate(0, -208 + 40 * slump); c.rotate(-0.2 + slump * 0.9 + sway * 0.3);
  c.fillStyle = cloth; c.beginPath(); c.moveTo(-14, 0); c.lineTo(16, -4); c.lineTo(2, -46); c.closePath(); c.fill(); c.strokeStyle = rim; c.lineWidth = 1.6; c.stroke();
  c.restore();
  // arms: long and angular, up to the kite lines when flying, round its knees when asleep
  for (const [k, hk] of [[-1, hands[0]], [1, hands[1]]]) {
    c.strokeStyle = cloth; c.lineWidth = 7; c.lineCap = 'round'; c.lineJoin = 'round';
    const sx = k * 14, sy = -178 + 34 * slump, ex = lerp(k * 20, hk[0], wake), ey = lerp(-80, hk[1], wake), mx = (sx + ex) / 2 + k * 26, my = (sy + ey) / 2 + 10;
    c.beginPath(); c.moveTo(sx, sy); c.lineTo(mx, my); c.lineTo(ex, ey); c.stroke();
  }
  // tangled: its own lines wound round it, while it sleeps
  if (slump > 0.05) { c.strokeStyle = `rgba(150,150,170,${0.5 * slump})`; c.lineWidth = 1.2; for (let i = 0; i < 6; i++) { c.beginPath(); c.ellipse(0, -110 + i * 14, 34 - i * 2, 8, 0.4 * (i % 2 ? 1 : -1), 0, TAU); c.stroke(); } }
  if (lit > 0.2) K.glow(c, 0, -150, 160, [255, 200, 240], 0.18 * lit, 'screen');
  c.restore();
}

// ---------------------------------------------------------------- Glassmere
function glassLayer(hot) {
  const [cv, c] = sheet(), r = K.RNG(53);
  T.sphere(c, 0, 0, R0, hot ? [30, 70, 120] : [30, 38, 54], hot ? [140, 205, 255] : [84, 96, 116], [8, 12, 24], -0.8, r);
  c.save(); c.beginPath(); c.arc(0, 0, R0, 0, TAU); c.clip();
  // the lake: the whole face of the planet is water; reflections of stars lie in it, and ripples ring out (when relit)
  for (let i = 0; i < 70; i++) { const a = r() * TAU, d = r() * R0; const x = Math.cos(a) * d, y = Math.sin(a) * d; if (hot) K.glow(c, x, y, 3 + r() * 5, [220, 240, 255], 0.5 + 0.4 * r()); else { c.fillStyle = 'rgba(160,170,200,0.25)'; c.fillRect(x, y, 1.5, 1.5); } }
  c.lineCap = 'round';
  for (let i = 0; i < 6; i++) { const cx = (r() - 0.5) * R0, cy = (r() - 0.5) * R0; for (let k = 1; k <= 4; k++) { c.strokeStyle = hot ? `rgba(200,235,255,${0.32 - k * 0.06})` : `rgba(130,140,170,${0.12 - k * 0.02})`; c.lineWidth = 1.6; c.beginPath(); c.ellipse(cx, cy, k * 14, k * 6, 0, 0, TAU); c.stroke(); } }
  // islands of glass: still and dark when cold, catching the light when relit
  for (let i = 0; i < 5; i++) { const a = r() * TAU, d = R0 * (0.3 + 0.5 * r()); c.fillStyle = hot ? 'rgba(190,230,255,0.35)' : 'rgba(20,24,34,0.7)'; c.beginPath(); c.ellipse(Math.cos(a) * d, Math.sin(a) * d, 16 + r() * 20, 7 + r() * 8, a, 0, TAU); c.fill(); }
  if (!hot) residue(c, r, 18, 'rgba(26,18,48,0.66)'); else K.glow(c, 0, 0, R0 * 0.9, [150, 210, 255], 0.25, 'screen');
  c.restore();
  // the surface's edge: a thin bright line, as water meets air
  c.strokeStyle = hot ? 'rgba(200,240,255,0.8)' : 'rgba(150,160,200,0.3)'; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, R0, 0, TAU); c.stroke();
  return cv;
}
/**
 * Vell: seen only as a reflection, hanging under the waterline (y), upside-down, under whoever stands above. Formal,
 * precise: a tall narrow figure in a long fitted coat, a high collar, a ring of light where its head would be.
 * p: wake 0..1 (from a still shape to standing straight), mirror (-1..1, a step to one side, matching a flip above),
 * bow 0..1, ripple 0..1 (the water over it, disturbed), lit 0..1, t: seconds.
 */
function vell(c, x, y, s, p) {
  const { wake = 0, mirror = 0, bow = 0, ripple = 0, lit = 0, t = 0 } = p;
  // the waterline, and the water: the figure is seen through it, wavering
  c.save();
  c.strokeStyle = `rgba(200,235,255,${0.35 + 0.35 * lit})`; c.lineWidth = 2; c.beginPath(); c.moveTo(x - 220 * s, y); for (let i = 0; i <= 40; i++) { const xx = x - 220 * s + i * 11 * s; c.lineTo(xx, y + Math.sin(i * 0.8 + t * 2) * (1.5 + 4 * ripple) * s); } c.stroke();
  c.beginPath(); c.rect(x - 400 * s, y, 800 * s, 800 * s); c.clip();
  c.translate(x + mirror * 26 * s, y); c.scale(s, -s); // upside-down: a reflection
  const wob = (k) => Math.sin(t * 2.2 + k * 0.7) * (1.2 + 5 * ripple);
  const coat = K.rgba(K.mix([62, 72, 104], [140, 190, 235], lit * 0.7)), line = `rgba(210,240,255,${0.45 + 0.45 * lit})`;
  c.globalAlpha = 0.7 + 0.3 * wake;
  K.glow(c, 0, -120, 160, [150, 200, 240], 0.12 + 0.2 * lit, 'screen');
  c.rotate(-bow * 0.35);
  // the coat: long, narrow, fitted; it stands straighter as it wakes
  const h = lerp(150, 210, wake);
  c.fillStyle = coat; c.beginPath(); c.moveTo(-22 + wob(1), 0); c.lineTo(-30 + wob(2), -h * 0.55); c.lineTo(-18 + wob(3), -h); c.lineTo(18 + wob(3), -h); c.lineTo(30 + wob(2), -h * 0.55); c.lineTo(22 + wob(1), 0); c.closePath(); c.fill();
  c.strokeStyle = line; c.lineWidth = 1.6; c.stroke();
  c.beginPath(); c.moveTo(0, -h); c.lineTo(0, -h * 0.2); c.stroke(); // its seam
  // the high collar, and the ring of light in place of a head
  c.fillStyle = coat; c.beginPath(); c.moveTo(-20, -h); c.lineTo(-12, -h - 22); c.lineTo(12, -h - 22); c.lineTo(20, -h); c.closePath(); c.fill();
  c.strokeStyle = `rgba(210,240,255,${0.35 + 0.55 * lit})`; c.lineWidth = 2.4; c.beginPath(); c.ellipse(0, -h - 40, 16, 16, 0, 0, TAU); c.stroke();
  if (lit > 0.1) K.glow(c, 0, -h - 40, 40, [180, 225, 255], 0.4 * lit);
  // arms: held formally, hands folded; they open in a bow
  c.strokeStyle = coat; c.lineWidth = 7; c.lineCap = 'round';
  for (const k of [-1, 1]) { c.beginPath(); c.moveTo(k * 24, -h + 18); c.lineTo(k * (30 + 30 * bow), -h * 0.6); c.lineTo(k * (8 + 40 * bow), -h * 0.45 + 30 * bow); c.stroke(); }
  c.restore();
}

// ---------------------------------------------------------------- Verdance
function verdLayer(hot) {
  const [cv, c] = sheet(), r = K.RNG(67);
  T.sphere(c, 0, 0, R0, hot ? [34, 70, 44] : [32, 36, 38], hot ? [120, 190, 120] : [76, 84, 80], [8, 12, 10], -0.8, r);
  c.save(); c.beginPath(); c.arc(0, 0, R0, 0, TAU); c.clip();
  // the great tree's roots, wrapped round the whole planet, and moss between them
  c.lineCap = 'round'; c.lineJoin = 'round';
  for (let k = 0; k < 11; k++) {
    let a = r() * TAU, x = Math.cos(a) * R0 * 0.2, y = Math.sin(a) * R0 * 0.2;
    c.strokeStyle = hot ? 'rgba(60,40,30,0.9)' : 'rgba(22,22,24,0.95)'; c.lineWidth = 14 - k * 0.6; c.beginPath(); c.moveTo(x, y);
    for (let i = 0; i < 12; i++) { a += (r() - 0.5) * 0.6; x += Math.cos(a) * 24; y += Math.sin(a) * 24; c.lineTo(x, y); }
    c.stroke();
    c.strokeStyle = hot ? 'rgba(150,230,150,0.25)' : 'rgba(110,120,120,0.12)'; c.lineWidth = 2; c.stroke();
  }
  for (let i = 0; i < 40; i++) { const a = r() * TAU, d = r() * R0; c.fillStyle = hot ? `rgba(90,170,90,${0.25 + 0.2 * r()})` : `rgba(40,46,44,${0.3})`; c.beginPath(); c.ellipse(Math.cos(a) * d, Math.sin(a) * d, 8 + r() * 18, 5 + r() * 9, a, 0, TAU); c.fill(); }
  // seed-lights in the moss: dark when cold, alight when relit
  for (let i = 0; i < 46; i++) { const a = r() * TAU, d = R0 * (0.15 + 0.8 * r()); if (hot) K.glow(c, Math.cos(a) * d, Math.sin(a) * d, 4 + r() * 6, [170, 255, 170], 0.7); }
  if (!hot) residue(c, r, 26, 'rgba(20,14,30,0.72)'); else K.glow(c, 0, 0, R0, [120, 230, 140], 0.2, 'screen');
  c.restore();
  c.strokeStyle = hot ? 'rgba(170,240,170,0.6)' : 'rgba(140,150,170,0.25)'; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, R0, 0, TAU); c.stroke();
  // the trunk: it rises off the planet's crown, out of the ring's middle (only its base; the tree itself is in the sky)
  onSurface(c, -Math.PI / 2, R0 * 0.94, () => { c.fillStyle = hot ? 'rgb(62,44,34)' : 'rgb(24,24,26)'; c.beginPath(); c.moveTo(-46, 8); c.quadraticCurveTo(-30, -30, -26, -70); c.lineTo(26, -70); c.quadraticCurveTo(30, -30, 46, 8); c.closePath(); c.fill(); c.strokeStyle = hot ? 'rgba(170,240,170,0.4)' : 'rgba(140,150,170,0.2)'; c.lineWidth = 2; c.stroke(); });
  return cv;
}
/**
 * Morrow: huge and slow, a climber gripping the great tree's trunk at the edge of the picture, its back mossed, the
 * seed-lights living in the moss. p: climb 0..1 (how far up the trunk), reach 0..1 (one long arm up to the next hold),
 * lights 0..1 (the seed-lights alight), breath 0..1, lit 0..1, t: seconds. Drawn from its hip (x, y). No face: a heavy
 * hooded brow with one slow seed-light under it.
 */
function morrow(c, x, y, s, p) {
  const { climb = 0, reach = 0, lights = 0, breath = 0, lit = 0, t = 0 } = p;
  c.save(); c.translate(x, y - climb * 120 * s); c.scale(s, s);
  const hide = K.rgba(K.mix([26, 28, 28], [70, 82, 60], lit * 0.7)), moss = K.rgba(K.mix([34, 44, 38], [80, 150, 90], lit)), rim = `rgba(190,240,190,${0.12 + 0.4 * lit})`;
  const sw = 1 + 0.03 * Math.sin(breath * TAU);
  // the lower arm, gripping below; the upper arm reaching (overlapping action: the hand lags the shoulder)
  const arm = (sx, sy, ex, ey, wd) => { c.strokeStyle = hide; c.lineWidth = wd; c.lineCap = 'round'; c.lineJoin = 'round'; const mx = (sx + ex) / 2 - 30, my = (sy + ey) / 2; c.beginPath(); c.moveTo(sx, sy); c.lineTo(mx, my); c.lineTo(ex, ey); c.stroke(); c.strokeStyle = rim; c.lineWidth = 2; c.stroke(); c.fillStyle = hide; for (let f = 0; f < 3; f++) { c.beginPath(); c.ellipse(ex + 8 + f * 6, ey - 4 + f * 6, 12, 5, 0.6, 0, TAU); c.fill(); } };
  arm(-10, -140, 40, 10, 26);
  arm(-6, -230, lerp(30, 50, reach), lerp(-300, -420, reach), 24);
  // the body: a great hunched back, mossed, swelling with each slow breath
  c.save(); c.scale(sw, sw);
  c.fillStyle = hide; c.beginPath(); c.moveTo(-40, 0); c.quadraticCurveTo(-120, -60, -100, -170); c.quadraticCurveTo(-80, -260, 0, -260); c.quadraticCurveTo(30, -200, 20, -110); c.quadraticCurveTo(10, -30, -40, 0); c.closePath(); c.fill();
  c.strokeStyle = rim; c.lineWidth = 2.2; c.stroke();
  c.fillStyle = moss; c.beginPath(); c.moveTo(-96, -60); c.quadraticCurveTo(-130, -160, -70, -240); c.quadraticCurveTo(-60, -170, -40, -100); c.quadraticCurveTo(-60, -60, -96, -60); c.closePath(); c.fill();
  // the seed-lights in the moss: out, then one by one alight, breathing
  const sr = K.RNG(5);
  for (let i = 0; i < 16; i++) { const lx = -100 + sr() * 50, ly = -80 - sr() * 150, on = Math.max(0, Math.min(1, lights * 18 - i)); if (on > 0) K.glow(c, lx, ly, 8 + 4 * Math.sin(t * 2 + i), [170, 255, 170], 0.8 * on); else { c.fillStyle = 'rgba(14,18,16,0.9)'; c.beginPath(); c.arc(lx, ly, 3, 0, TAU); c.fill(); } }
  c.restore();
  // the head: a heavy hooded brow, turned toward the planet; one slow light beneath it
  c.save(); c.translate(-8, -262); c.rotate(-0.3 + 0.1 * Math.sin(t * 0.4));
  c.fillStyle = hide; c.beginPath(); c.ellipse(0, 0, 44, 36, 0.2, 0, TAU); c.fill(); c.strokeStyle = rim; c.lineWidth = 2; c.stroke();
  c.fillStyle = moss; c.beginPath(); c.ellipse(-4, -18, 40, 16, 0.1, Math.PI, TAU); c.fill();
  K.glow(c, -22, 6, 10 + 6 * lit, [170, 255, 170], 0.3 + 0.6 * Math.max(lit, lights));
  c.restore();
  c.restore();
}
/** The great tree in the sky above Verdance: a dark trunk rising behind the ring, its branches reaching (they grow as it relights). */
function greatTree(c, x, y, s, grow, lit, t) {
  c.save(); c.translate(x, y); c.scale(s, s);
  const bark = K.rgba(K.mix([14, 16, 18], [50, 40, 32], lit)), rim = `rgba(170,240,170,${0.08 + 0.3 * lit})`;
  c.fillStyle = bark; c.beginPath(); c.moveTo(-70, 0); c.quadraticCurveTo(-40, -300, -30, -900); c.lineTo(30, -900); c.quadraticCurveTo(40, -300, 70, 0); c.closePath(); c.fill();
  c.strokeStyle = rim; c.lineWidth = 3; c.stroke();
  const r = K.RNG(9);
  for (let i = 0; i < 9; i++) {
    const by = -160 - i * 80, side = i % 2 ? 1 : -1, len = (180 + r() * 160) * Math.min(1, grow * 1.6 - i * 0.08);
    if (len <= 0) continue;
    c.strokeStyle = bark; c.lineWidth = 18 - i; c.lineCap = 'round'; c.beginPath(); c.moveTo(0, by); c.quadraticCurveTo(side * len * 0.5, by - 30 + Math.sin(t * 0.5 + i) * 4, side * len, by - 60 - r() * 40); c.stroke();
    if (lit > 0.2) for (let k = 0; k < 4; k++) K.glow(c, side * len * (0.4 + 0.15 * k), by - 40 - k * 6, 6, [170, 255, 170], 0.6 * lit);
  }
  c.restore();
}

/** The element of each world, as designed shapes (the cinematic pass): wind spirals, ripples, leaves. Live. */
function windSpirals(c, cx, cy, R, t, k, col = [255, 220, 245]) {
  if (k <= 0.01) return;
  c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
  for (let i = 0; i < 7; i++) {
    const a0 = i * 0.9 + t * (0.6 + 0.1 * i), rr = R * (1.08 + 0.1 * i);
    c.strokeStyle = K.rgba(col, 0.22 * k); c.lineWidth = 2 + 2 * k;
    c.beginPath(); c.arc(cx, cy, rr, a0, a0 + 1.1 + 0.4 * Math.sin(t + i)); c.stroke();
    c.beginPath(); const ex = cx + Math.cos(a0 + 1.1) * rr, ey = cy + Math.sin(a0 + 1.1) * rr; for (let j = 0; j < 14; j++) { const a = a0 + 1.1 + j * 0.35, d = 16 * (1 - j / 14) * (1 + k); (j ? c.lineTo : c.moveTo).call(c, ex + Math.cos(a) * d, ey + Math.sin(a) * d); } c.stroke();
  }
  c.restore();
}
function ripples(c, cx, cy, R, t, k, col = [200, 235, 255]) {
  if (k <= 0.01) return;
  c.save(); c.lineCap = 'round';
  for (let i = 0; i < 5; i++) { const ph = ((t * 0.35 + i / 5) % 1), rr = R * (1 + 0.9 * ph); c.strokeStyle = K.rgba(col, 0.3 * k * (1 - ph)); c.lineWidth = 2 + 3 * (1 - ph); c.beginPath(); c.ellipse(cx, cy, rr, rr * 0.92, 0, 0, TAU); c.stroke(); }
  c.restore();
}
function leaves(c, w, h, t, k, col = [150, 230, 150], n = 26) {
  if (k <= 0.01) return;
  for (let i = 0; i < n; i++) {
    const r = K.RNG(i * 17 + 3), ph = (t * (0.05 + 0.04 * r()) + r()) % 1, x = (r() * w + Math.sin(t * 0.7 + i) * 40), y = ph * (h + 60) - 30, a = t * (1 + r()) + i;
    c.save(); c.translate(x, y); c.rotate(a); c.globalAlpha = k * (0.4 + 0.4 * r());
    c.fillStyle = K.rgba(K.mix(col, [255, 240, 200], r() * 0.3)); c.beginPath(); c.ellipse(0, 0, 6 + 4 * r(), 2.5, 0, 0, TAU); c.fill();
    c.restore();
  }
}

export const WORLDS2 = { R0, CIRRA, cirraLayer, seo, glassLayer, vell, verdLayer, morrow, greatTree, windSpirals, ripples, leaves };
