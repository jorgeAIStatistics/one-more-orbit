// The cold open as a short film (the owner's brief, 2026-11-25): seven storyboard stills, phone-sized. Play, the omen,
// the strike, the reach, the pull, the loss, black. Painted with the game's brushes; not used by the game itself.
import { CANON } from '../../src/art/canonpaint.js';
import { COLDPAINT as C } from '../../src/art/coldpaint.js';
import { DUSK, K } from '../../src/art/painter.js';

const T = DUSK.tools, P = CANON.parts, TAU = Math.PI * 2;
const SERIF = '"Cormorant Garamond", "Hoefler Text", Baskerville, Palatino, Georgia, serif';
const write = (c, s, x, y, px, o = {}) => { c.save(); c.font = `italic ${o.weight ?? 500} ${px}px ${SERIF}`; c.textAlign = o.align ?? 'center'; c.shadowColor = 'rgba(6,5,18,0.9)'; c.shadowBlur = px * 0.5; c.globalAlpha = o.alpha ?? 1; c.fillStyle = o.color ?? '#fff1d8'; c.fillText(s, x, y); c.restore(); };

/** a speech bubble in the world: a soft glow with a pointer, the words in the italic serif (no box, no border) */
function bubble(c, s, x, y, tx, ty, px, warm) {
  c.save(); c.font = `italic 600 ${px}px ${SERIF}`; const w = c.measureText(s).width + px * 1.4, h = px * 1.8;
  const g = c.createRadialGradient(x, y, 0, x, y, w * 0.7); g.addColorStop(0, warm ? 'rgba(255,236,200,0.92)' : 'rgba(236,244,255,0.92)'); g.addColorStop(0.7, warm ? 'rgba(255,226,180,0.7)' : 'rgba(220,232,255,0.7)'); g.addColorStop(1, 'rgba(255,230,190,0)');
  c.fillStyle = g; c.beginPath(); c.ellipse(x, y, w * 0.62, h * 0.85, 0, 0, TAU); c.fill();
  c.beginPath(); c.moveTo(x + (tx - x) * 0.25 - 6, y + h * 0.5); c.lineTo(tx, ty); c.lineTo(x + (tx - x) * 0.25 + 6, y + h * 0.5); c.fill();
  c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = 'rgba(60,30,14,0.95)'; c.fillText(s, x, y + 1);
  c.restore();
}
/** two trails braided through the sky: Orbin's pale gold and Helion's ember, crossing and re-crossing; where they cross, a note */
function braid(c, w, h, u, gap = -1) {
  c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
  const path = (k, t) => [w * (0.05 + 0.9 * t), h * (0.48 + 0.14 * Math.sin(t * TAU * 1.6 + k * Math.PI) * (0.6 + 0.4 * t)) - 60 * u * Math.sin(t * Math.PI)];
  for (const [k, col] of [[0, [255, 236, 190]], [1, [255, 170, 110]]]) {
    for (let i = 0; i < 80; i++) {
      const t0 = i / 80, t1 = (i + 1) / 80;
      if (gap >= 0 && Math.abs(t0 - gap) < 0.035) continue; // one note missing: a break in the braid
      const [x0, y0] = path(k, t0), [x1, y1] = path(k, t1);
      c.strokeStyle = K.rgba(col, 0.15 + 0.6 * t0); c.lineWidth = (1 + 5 * t0) * u; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
    }
  }
  // where the trails cross, their song: a note of light
  for (let i = 1; i < 8; i++) { const t = i / 6.4 / 1.25; if (gap >= 0 && Math.abs(t - gap) < 0.05) continue; const [x, y] = path(0, t); K.glow(c, x, y, (6 + 8 * t) * u, [255, 244, 210], 0.7); }
  c.restore();
  return path;
}

/** the Stillness's reaching form: a vast arm of ink from the edge, its hand open, four long fingers spread toward them */
function reach(c, x0, y0, tx, ty, u, k = 1) {
  const fingers = [[-0.5, 1.0], [-0.17, 1.12], [0.16, 1.05], [0.48, 0.86]];
  const ang = Math.atan2(ty - y0, tx - x0), len = Math.hypot(tx - x0, ty - y0) * k, wx = x0 + Math.cos(ang) * len * 0.62, wy = y0 + Math.sin(ang) * len * 0.62;
  for (const [col, extra, blur] of [['rgba(170,160,190,0.4)', 10, 24], ['rgba(5,4,10,0.97)', 0, 0]]) {
    c.save(); c.shadowColor = col; c.shadowBlur = blur; c.fillStyle = col; c.strokeStyle = col; c.lineCap = 'round';
    // the arm: wide at the edge, narrowing to the wrist
    const nx = -Math.sin(ang), ny = Math.cos(ang), W0 = 170 * u + extra, W1 = 46 * u + extra;
    c.beginPath(); c.moveTo(x0 + nx * W0, y0 + ny * W0); c.quadraticCurveTo((x0 + wx) / 2 + nx * W0 * 0.4, (y0 + wy) / 2 + ny * W0 * 0.4, wx + nx * W1, wy + ny * W1);
    c.lineTo(wx - nx * W1, wy - ny * W1); c.quadraticCurveTo((x0 + wx) / 2 - nx * W0 * 0.5, (y0 + wy) / 2 - ny * W0 * 0.5, x0 - nx * W0, y0 - ny * W0); c.closePath(); c.fill();
    // the fingers: long, curling at their tips
    for (const [da, fl] of fingers) {
      const a2 = ang + da, L = len * 0.42 * fl, mx = wx + Math.cos(a2) * L * 0.55, my = wy + Math.sin(a2) * L * 0.55, ex = wx + Math.cos(a2 + 0.25) * L, ey = wy + Math.sin(a2 + 0.25) * L;
      c.lineWidth = (26 * u + extra) ; c.beginPath(); c.moveTo(wx, wy); c.quadraticCurveTo(mx, my, ex, ey); c.stroke();
      c.lineWidth = 12 * u + extra * 0.6; c.beginPath(); c.moveTo(ex, ey); c.quadraticCurveTo(ex + Math.cos(a2 + 1.2) * 26 * u, ey + Math.sin(a2 + 1.2) * 26 * u, ex + Math.cos(a2 + 2) * 30 * u, ey + Math.sin(a2 + 2) * 30 * u); c.stroke();
    }
    c.restore();
  }
}
export function cold6(c, w, h, n) {
  const u = Math.min(w / 390, h / 844), cx = w / 2, cy = h * 0.5;
  if (n === 1) {
    // play: the brothers chasing each other in loops through the bright nebula; their trails braid into their song
    C.nebula(c, w, h, false);
    const path = braid(c, w, h, u);
    const [ox, oy] = path(0, 0.72), [hx, hy] = path(1, 0.86);
    P.spark(c, ox, oy, 0.5 * u, { who: 'orbin', eyes: 'soft', arms: 'up', glow: 1, face: 1, lean: 0.4, crest: 1, ring: true, beat: 1 });
    P.spark(c, hx, hy - 10 * u, 0.5 * u, { who: 'helion', eyes: 'soft', arms: 'back', glow: 1, face: -1, lean: -0.4, crest: 1, ring: true, beat: 1, look: [-1, 0.2] });
    bubble(c, 'Catch me!', hx - 10 * u, hy - 86 * u, hx, hy - 52 * u, 17 * u, true);
    bubble(c, 'Always.', ox - 30 * u, oy + 70 * u, ox, oy + 30 * u, 17 * u, false);
    write(c, 'Two embers. One song.', cx, h * 0.17, 24 * u);
  } else if (n === 2) {
    // the omen: one note of their song goes missing; Helion stops and looks out; far off, a star goes out, then a nearer one
    C.nebula(c, w, h, false);
    c.fillStyle = 'rgba(30,26,40,0.12)'; c.fillRect(0, 0, w, h);
    const path = braid(c, w, h, u, 0.55);
    const [x, y] = path(0, 0.55); c.strokeStyle = 'rgba(60,50,70,0.8)'; c.lineWidth = 2 * u; c.beginPath(); c.arc(x, y, 14 * u, 0, TAU); c.stroke(); // the missing note
    for (const [sx, sy, r, gone] of [[0.86, 0.12, 5, 1], [0.7, 0.24, 7, 0.6]]) { K.glow(c, w * sx, h * sy, r * 4 * u, [255, 240, 210], 0.6 * (1 - gone)); c.strokeStyle = `rgba(20,16,30,${0.5 + 0.4 * gone})`; c.lineWidth = 3 * u; c.beginPath(); c.arc(w * sx, h * sy, r * 1.8 * u, 0, TAU); c.stroke(); }
    P.spark(c, w * 0.34, h * 0.62, 0.62 * u, { who: 'orbin', eyes: 'open', arms: 'rest', glow: 1, face: 1, look: [0.8, -0.4], crest: 0.9 });
    P.spark(c, w * 0.62, h * 0.56, 0.62 * u, { who: 'helion', eyes: 'wide', arms: 'rest', glow: 0.9, face: 1, look: [1, -0.9], crest: 0.7 });
  } else if (n === 3) {
    // the strike: a beat of silence, then the Stillness arrives all at once, huge and fast, swallowing stars; the colour
    // drains in a wave behind it, and the picture shakes
    C.nebula(c, w, h, false);
    c.save(); const wave = c.createLinearGradient(w, 0, w * 0.15, 0); wave.addColorStop(0, 'rgba(40,38,50,0.95)'); wave.addColorStop(0.55, 'rgba(60,56,66,0.75)'); wave.addColorStop(1, 'rgba(60,56,66,0)'); c.fillStyle = wave; c.fillRect(0, 0, w, h); c.restore();
    c.save(); c.globalCompositeOperation = 'saturation'; c.fillStyle = 'rgba(128,128,128,0.7)'; c.fillRect(w * 0.35, 0, w * 0.65, h); c.restore();
    // its body: a tide of ink from the right, and its reaching form, three long fingers coming for them
    C.dread(c, w * 1.15, h * 0.4, 360 * u, 520 * u, 77, 1);
    C.dread(c, w * 0.95, h * 0.18, 180 * u, 160 * u, 78, 0.9);
    reach(c, w * 1.12, h * 0.3, w * 0.46, h * 0.5, u, 0.92);
    for (let i = 0; i < 6; i++) { const r = K.RNG(i + 5), x = w * (0.55 + 0.4 * r()), y = h * (0.1 + 0.6 * r()); K.glow(c, x, y, 3 * u, [255, 240, 210], 0.4); c.fillStyle = 'rgba(6,5,12,0.85)'; c.beginPath(); c.arc(x + 3 * u, y, 4 * u, 0, TAU); c.fill(); } // stars, half swallowed
    // the shake: the brothers doubled, a little apart
    for (const [dx, a] of [[6, 0.35], [0, 1]]) { c.save(); c.globalAlpha = a; P.spark(c, w * 0.28 + dx * u, h * 0.6, 0.6 * u, { who: 'orbin', eyes: 'wide', arms: 'rest', glow: 1, face: 1, look: [1, -0.3], crest: 1 }); P.spark(c, w * 0.48 + dx * u, h * 0.56, 0.6 * u, { who: 'helion', eyes: 'wide', arms: 'rest', glow: 0.9, face: 1, look: [1, -0.3], crest: 1 }); c.restore(); }
  } else if (n === 4) {
    // the reach (hold): Helion is dragged away; Orbin flies after him into the Stillness's breath. Holding drives him on:
    // the headwind of ash tears embers off him, his light burns hotter, the gap between their hands closes. Let go and
    // the tide takes him back.
    c.fillStyle = 'rgb(12,10,20)'; c.fillRect(0, 0, w, h);
    C.dread(c, w * 1.1, cy - 70 * u, 300 * u, 440 * u, 48, 1);
    const hx = w * 0.7, hy = cy - 60 * u, ox = w * 0.3, oy = cy + 40 * u;
    // the headwind: streaks of ash pouring out of the dark, against him
    c.save(); c.lineCap = 'round';
    const rw = K.RNG(300); for (let i = 0; i < 46; i++) { const r = rw, y = h * (0.08 + 0.84 * r()), x = w * (0.05 + 0.95 * r()), L = (40 + 120 * r()) * u; c.strokeStyle = `rgba(178,170,200,${0.16 + 0.32 * r()})`; c.lineWidth = (1 + 2.5 * r()) * u; c.beginPath(); c.moveTo(x, y); c.lineTo(x - L, y + L * 0.18); c.stroke(); }
    c.restore();
    c.save(); c.globalAlpha = 0.85; c.translate(hx, hy); c.rotate(0.35); P.spark(c, 0, 0, 0.58 * u, { who: 'helion', eyes: 'worried', arms: 'reach', glow: 0.6, face: -1, lean: -0.5, crest: 0.6, look: [-1, 0.4] }); c.restore(); // dragged off his feet
    C.tendrils(c, w * 1.02, cy - 100 * u, hx + 8 * u, hy, u, 9, 13, 1);
    // Orbin's trail, stretched; embers torn off him and blown back
    c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
    for (let i = 0; i < 40; i++) { const t0 = i / 40, t1 = (i + 1) / 40, at = (t) => [ox - (1 - t) * 300 * u, oy + Math.sin((1 - t) * 3.2) * 70 * u * (1 - t) + (1 - t) * 40 * u]; const [x0, y0] = at(t0), [x1, y1] = at(t1); c.strokeStyle = `rgba(255,${200 + 40 * t0 | 0},150,${0.04 + 0.5 * t0})`; c.lineWidth = (1 + 12 * t0) * u; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); }
    c.restore();
    const re = K.RNG(80); for (let i = 0; i < 16; i++) { const r = re; K.glow(c, ox - (30 + 200 * r()) * u, oy - (50 - 110 * r()) * u, (2 + 4 * r()) * u, [255, 200, 130], 0.5 + 0.4 * r()); }
    K.glow(c, ox, oy, 120 * u, [255, 226, 160], 0.5, 'screen'); // burning hotter
    P.spark(c, ox, oy, 0.68 * u, { who: 'orbin', eyes: 'set', arms: 'reach', glow: 1, face: 1, lean: 0.75, crest: 1, look: [1, -0.5] });
    // their hands: a gap of a hand's width, a thread of light across it
    const ax = ox + 58 * u, ay = oy - 40 * u, bx = hx - 50 * u, by = hy + 8 * u;
    K.glow(c, ax, ay, 16 * u, [255, 244, 210], 0.9); K.glow(c, bx, by, 12 * u, [255, 190, 130], 0.7);
    c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = 'rgba(255,230,180,0.5)'; c.lineWidth = 1.5 * u; c.setLineDash([3 * u, 6 * u]); c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.stroke(); c.restore();
    // the one control: hold (a ring that fills while held, and drains when let go)
    const qx = cx, qy = h * 0.85;
    c.strokeStyle = 'rgba(255,204,72,0.25)'; c.lineWidth = 3 * u; c.beginPath(); c.arc(qx, qy, 30 * u, 0, TAU); c.stroke();
    c.strokeStyle = 'rgba(255,204,72,0.95)'; c.lineWidth = 3.4 * u; c.beginPath(); c.arc(qx, qy, 30 * u, -Math.PI / 2, -Math.PI / 2 + TAU * 0.72); c.stroke();
    write(c, 'Hold on', qx, qy + 62 * u, 24 * u, { color: '#ffe6b8' });
  } else if (n === 5) {
    // the pull (taps): their hands lock. Each tap is a heave, and a note of their song: Helion comes half out of the dark,
    // his colour coming back. Three notes ring out; the fourth never comes.
    c.fillStyle = 'rgb(14,11,20)'; c.fillRect(0, 0, w, h);
    K.glow(c, w * 0.48, cy, Math.min(w, h) * 0.75, [255, 210, 140], 0.3, 'screen');
    C.dread(c, w * 1.12, cy - 30 * u, 280 * u, 430 * u, 49, 1);
    const hx = w * 0.66, hy = cy - 24 * u, ox = w * 0.3, oy = cy + 18 * u, kx = w * 0.48, ky = cy - 14 * u;
    P.spark(c, hx, hy, 0.6 * u, { who: 'helion', eyes: 'set', arms: 'reach', glow: 0.85, face: -1, lean: -0.3, crest: 0.85, look: [-1, 0.1] });
    C.tendrils(c, w * 1.04, cy + 40 * u, hx + 26 * u, hy + 30 * u, u, 7, 21, 0.9); // its grip, on his lower half only now
    // Orbin pulling back with everything, white-hot; the shake: doubled
    for (const [dx, dy, a] of [[-7, 3, 0.3], [0, 0, 1]]) { c.save(); c.globalAlpha = a; P.spark(c, ox + dx * u, oy + dy * u, 0.68 * u, { who: 'orbin', eyes: 'set', arms: 'reach', glow: 1, face: 1, lean: -0.35, crest: 1, look: [1, -0.2] }); c.restore(); }
    K.glow(c, ox, oy, 90 * u, [255, 250, 230], 0.45, 'screen');
    // their hands, locked: the brightest thing on screen, a burst on the heave
    K.glow(c, kx, ky, 54 * u, [255, 244, 214], 0.9); K.glow(c, kx, ky, 18 * u, [255, 255, 250], 1);
    c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU + 0.2; c.strokeStyle = 'rgba(255,236,190,0.35)'; c.lineWidth = 2 * u; c.beginPath(); c.moveTo(kx + Math.cos(a) * 26 * u, ky + Math.sin(a) * 26 * u); c.lineTo(kx + Math.cos(a) * 70 * u, ky + Math.sin(a) * 70 * u); c.stroke(); }
    c.restore();
    // the notes of their song, one per heave, rising from their hands: three rung, the fourth an empty ring
    for (let i = 0; i < 4; i++) { const x = kx - 120 * u + i * 40 * u, y = ky - 150 * u - i * 14 * u; if (i < 3) K.glow(c, x, y, 14 * u, [255, 240, 200], 0.95); else { c.strokeStyle = 'rgba(120,110,140,0.8)'; c.lineWidth = 2 * u; c.beginPath(); c.arc(x, y, 12 * u, 0, TAU); c.stroke(); } }
    // the one control: tap, a pulse on each heave
    const qx = cx, qy = h * 0.85;
    for (const [r, a] of [[30, 0.95], [44, 0.45], [58, 0.18]]) { c.strokeStyle = `rgba(255,204,72,${a})`; c.lineWidth = 3 * u; c.beginPath(); c.arc(qx, qy, r * u, 0, TAU); c.stroke(); }
    write(c, 'Pull!', qx, qy + 76 * u, 26 * u, { color: '#ffe6b8', weight: 700 });
  } else if (n === 6) {
    // the loss: Helion dragged into the dark, calling his name; their song once more, broken; a shockwave throws Orbin away
    c.fillStyle = 'rgb(8,7,14)'; c.fillRect(0, 0, w, h);
    C.dread(c, w * 0.95, h * 0.3, 330 * u, 420 * u, 50, 1);
    c.save(); c.globalAlpha = 0.5; P.spark(c, w * 0.8, h * 0.24, 0.3 * u, { who: 'helion', eyes: 'wide', arms: 'reach', glow: 0.35, face: -1, crest: 0.4 }); c.restore();
    C.tendrils(c, w * 1.0, h * 0.26, w * 0.8, h * 0.24, u * 0.7, 6, 33, 1);
    bubble(c, 'Orbin!', w * 0.66, h * 0.15, w * 0.78, h * 0.2, 18 * u, true);
    // the shockwave, and Orbin thrown back, tumbling
    c.strokeStyle = 'rgba(255,250,236,0.7)'; c.lineWidth = 18 * u; c.beginPath(); c.arc(w * 0.8, h * 0.26, h * 0.42, 0, TAU); c.stroke();
    c.strokeStyle = 'rgba(255,250,236,0.25)'; c.lineWidth = 40 * u; c.stroke();
    c.save(); c.translate(w * 0.22, h * 0.74); c.rotate(-0.9); P.spark(c, 0, 0, 0.6 * u, { who: 'orbin', eyes: 'closed', arms: 'reach', glow: 0.9, face: 1, crest: 0.6 }); c.restore();
    const rs = K.RNG(40); for (let i = 0; i < 9; i++) { const r = rs; K.glow(c, w * (0.3 + 0.5 * r()), h * (0.35 + 0.35 * r()), (3 + r() * 4) * u, [255, 236, 190], 0.4 + 0.3 * r()); } // the broken song, scattered
  } else {
    // black and silence; three short lines
    c.fillStyle = 'rgb(4,4,10)'; c.fillRect(0, 0, w, h);
    write(c, 'Orbin and Helion were the two embers', cx, h * 0.42, 21 * u); write(c, 'of the Harmonic Nebula.', cx, h * 0.42 + 30 * u, 21 * u);
    write(c, 'The Stillness took Helion, and the music with him.', cx, h * 0.53, 19 * u);
    write(c, 'Wake the fallen stars. Bring your brother home.', cx, h * 0.63, 21 * u, { color: '#ffe6b8' });
  }
  T.finish(c, w, h, 61 + n, 0.25);
}
