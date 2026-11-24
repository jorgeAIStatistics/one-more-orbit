// World 1, storyboards (Afterglow): the prologue, the hub at 0 / 2 / 4 planets restored, one planet's arc, the
// ambush, the finale, and the cast. Storyboard quality: the same painters as the approved stills, with each new
// character as a lit silhouette. Nothing here is in the game yet. Needs kit.js, a-dusk.js, results-afterglow.js.
/* eslint-disable */
const WORLD1 = (() => {
  const { TAU, D, lerp, RNG, rgba, mix } = K;
  const T = DUSK.tools;
  const SERIF = `"Cormorant Garamond", ${T.SERIF}`;
  const W = 1200, H = 750;
  const DUSKY = [[0, [9, 10, 34]], [0.42, [34, 28, 84]], [0.72, [96, 50, 104]], [0.9, [206, 104, 92]], [1, [248, 178, 122]]];
  const COLD = [[0, [5, 6, 18]], [0.45, [20, 20, 50]], [0.8, [46, 38, 80]], [1, [84, 58, 90]]];
  const DAWN = [[0, [40, 44, 112]], [0.4, [120, 84, 150]], [0.7, [236, 140, 124]], [0.88, [255, 196, 130]], [1, [255, 232, 180]]];
  const NIGHT = [22, 18, 56];
  const PAL = {
    heroes: [[214, 96, 60], [255, 190, 120], [70, 26, 50], [[-0.2, 0.22, [255, 200, 140], 0.14], [0.3, 0.25, [150, 50, 50], 0.16]]],
    skyhigh: [[220, 110, 190], [255, 196, 232], [80, 36, 110], [[-0.1, 0.3, [255, 236, 248], 0.2], [0.4, 0.2, [255, 220, 240], 0.14]]],
    blank: [[110, 160, 230], [226, 242, 255], [30, 44, 110], [[0, 0.16, [240, 250, 255], 0.2]]],
    invincible: [[70, 160, 110], [196, 250, 160], [14, 60, 66], [[-0.25, 0.25, [220, 255, 170], 0.14]]]
  };
  const IDS = ['heroes', 'skyhigh', 'blank', 'invincible'];
  const SONG = [[255, 150, 90], [255, 130, 210], [150, 200, 255], [150, 240, 140], [255, 226, 170]];
  const INKC = 'rgba(18,13,32,0.98)';

  const planet = (ctx, id, x, y, R, la, r, k = 0) => { const [b, l, d, bands] = PAL[id]; T.sphere(ctx, x, y, R, mix(b, NIGHT, k), mix(l, [40, 34, 90], k), d, la, r, { bands: k > 0.5 ? [] : bands, haze: 0.34 * (1 - k), rim: 0.9 * (1 - k * 0.8) }); };
  const beam = (ctx, from, x, y, R, c, a, blur = 11) => { ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.filter = `blur(${blur}px)`; const ang = Math.atan2(y - from[1], x - from[0]), d = Math.hypot(y - from[1], x - from[0]) + R, hw = Math.min(0.3, (R * 1.25) / d); const g = ctx.createLinearGradient(from[0], from[1], x, y); g.addColorStop(0, rgba(c, a)); g.addColorStop(1, rgba(c, a * 0.3)); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(from[0], from[1]); ctx.lineTo(from[0] + Math.cos(ang - hw) * d, from[1] + Math.sin(ang - hw) * d); ctx.lineTo(from[0] + Math.cos(ang + hw) * d, from[1] + Math.sin(ang + hw) * d); ctx.closePath(); ctx.fill(); ctx.restore(); };
  /** The Hush: curtains of fog hung from above and, in its hood, an eclipse. lid 0 = shut to a sliver, 1 = wide open. warm: the seam undone. */
  function hush(ctx, x, y, wide, tall, r, o = {}) {
    const { eye = true, lid = 0.25, warm = false, er = 46, strokes = 80 } = o;
    ctx.save(); ctx.filter = 'blur(16px)'; ctx.fillStyle = 'rgba(4,4,12,0.96)'; ctx.beginPath(); ctx.ellipse(x, y - tall * 0.5, wide, tall, 0, 0, TAU); ctx.fill(); ctx.restore();
    for (let i = 0; i < strokes; i++) { const x0 = x - wide + r() * wide * 2, len = tall * (0.5 + r() * 0.75) + y - tall * 0.5, bend = (x - x0) * 0.1 * r(); K.brush(ctx, [[x0, -20], [x0 + bend * 0.3, len * 0.4], [x0 + bend, len * 0.8], [x0 + bend * 1.4 + (r() - 0.5) * 30, len]], 16 + r() * 36, mix([12, 10, 28], [86, 70, 132], r() * r()), r, { passes: 4, alpha: 0.2, spread: 0.5 }); }
    if (!eye) return;
    ctx.save(); ctx.filter = 'blur(9px)'; ctx.fillStyle = '#030208'; ctx.beginPath(); ctx.ellipse(x, y, er * 2.6, er * 3.2, 0, 0, TAU); ctx.fill(); ctx.restore();
    if (warm) { K.glow(ctx, x, y, er * 6, [255, 200, 130], 0.5); K.glow(ctx, x, y, er * 2.4, [255, 236, 200], 0.6); }
    ctx.save(); ctx.beginPath(); ctx.rect(x - er * 3, y + er * (1 - 2 * lid) - er * 0.2, er * 6, er * 6); ctx.clip();
    ctx.shadowColor = warm ? 'rgba(255,214,150,0.95)' : 'rgba(214,206,255,0.95)'; ctx.shadowBlur = 24; ctx.strokeStyle = 'rgba(240,234,255,0.95)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, er, 0, TAU); ctx.stroke();
    ctx.shadowBlur = 56; ctx.strokeStyle = 'rgba(190,176,255,0.35)'; ctx.lineWidth = 7; ctx.stroke(); ctx.restore();
  }
  function jar(ctx, x, y, s, c, open = false) {
    K.glow(ctx, x, y, 46 * s, c, 0.35);
    ctx.strokeStyle = 'rgba(214,226,255,0.5)'; ctx.lineWidth = 1.5 * s;
    ctx.beginPath(); ctx.moveTo(x - 13 * s, y + 18 * s); ctx.lineTo(x - 13 * s, y - 8 * s); ctx.quadraticCurveTo(x - 13 * s, y - 26 * s, x, y - 26 * s); ctx.quadraticCurveTo(x + 13 * s, y - 26 * s, x + 13 * s, y - 8 * s); ctx.lineTo(x + 13 * s, y + 18 * s); if (!open) ctx.closePath(); ctx.stroke();
    ctx.fillStyle = rgba(mix(c, [255, 255, 255], 0.5), 0.95); ctx.beginPath(); ctx.arc(x, y + (open ? 34 : 2) * s, 3.2 * s, 0, TAU); ctx.fill();
  }
  /** Marlow, the Keeper: a lampmoth seen against his own lantern. A silhouette with light on the edges of his wings; no face. */
  function moth(ctx, x, y, s, r, lamp = 1) {
    K.glow(ctx, x + 26 * s, y + 54 * s, 190 * s, [255, 190, 110], 0.42 * lamp);
    const wing = (k, up) => { ctx.beginPath(); if (up) { ctx.moveTo(x, y - 12 * s); ctx.bezierCurveTo(x + k * 50 * s, y - 100 * s, x + k * 160 * s, y - 104 * s, x + k * 150 * s, y - 34 * s); ctx.bezierCurveTo(x + k * 144 * s, y + 8 * s, x + k * 70 * s, y + 22 * s, x, y + 12 * s); } else { ctx.moveTo(x, y + 8 * s); ctx.bezierCurveTo(x + k * 78 * s, y + 16 * s, x + k * 116 * s, y + 62 * s, x + k * 86 * s, y + 102 * s); ctx.bezierCurveTo(x + k * 56 * s, y + 126 * s, x + k * 24 * s, y + 80 * s, x, y + 46 * s); } ctx.closePath(); };
    for (const k of [-1, 1]) for (const up of [false, true]) {
      wing(k, up); ctx.fillStyle = up ? 'rgba(30,20,48,0.96)' : 'rgba(44,26,54,0.94)'; ctx.fill();
      ctx.save(); wing(k, up); ctx.clip(); K.glow(ctx, x + 26 * s, y + 60 * s, 130 * s, [255, 170, 100], 0.34 * lamp); ctx.restore();
      ctx.save(); ctx.globalCompositeOperation = 'screen'; wing(k, up); ctx.strokeStyle = rgba([255, 200, 140], (k > 0 ? 0.75 : 0.4) * (0.3 + 0.7 * lamp)); ctx.lineWidth = Math.max(1, 1.8 * s); ctx.shadowColor = 'rgba(255,180,110,0.9)'; ctx.shadowBlur = 8 * s; ctx.stroke(); ctx.restore();
    }
    ctx.fillStyle = 'rgba(20,14,34,0.98)'; ctx.beginPath(); ctx.ellipse(x, y + 22 * s, 13 * s, 52 * s, 0, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(x, y - 38 * s, 9 * s, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(20,14,34,0.95)'; ctx.lineWidth = Math.max(1, 2 * s); ctx.lineCap = 'round';
    for (const k of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x + k * 4 * s, y - 44 * s); ctx.bezierCurveTo(x + k * 14 * s, y - 84 * s, x + k * 40 * s, y - 104 * s, x + k * 66 * s, y - 106 * s); ctx.stroke(); }
    ctx.fillStyle = rgba([255, 236, 190], 0.98 * lamp); ctx.beginPath(); ctx.ellipse(x + 26 * s, y + 58 * s, 5 * s, 8 * s, 0, 0, TAU); ctx.fill();
  }
  const poly = (ctx, pts) => { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); };
  const rimStroke = (ctx, pts, c, a, w = 2) => { ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.strokeStyle = rgba(c, a); ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.shadowColor = rgba(c, 0.8); ctx.shadowBlur = 6; ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); ctx.restore(); };

  /**
   * Ossa, the smith of Emberwick: a great slow beast of cooled slag with a fire banked in its ribs and antlers like
   * tuning forks. lit 0 = a dead coal, 1 = the forge alight. pose 'lie' = banked, head down.
   */
  function ossa(ctx, x, y, s, lit, r, pose = 'stand', face = 1) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s * face, s);
    const lie = pose === 'lie';
    if (lie) ctx.translate(0, 34);
    const slag = rgba(mix([24, 17, 32], [58, 30, 40], lit * 0.6));
    if (lit > 0.1) K.glow(ctx, 20, -86, 210, [255, 140, 70], 0.34 * lit);
    ctx.fillStyle = slag;
    if (!lie) for (const [lx, lw] of [[-92, 26], [-62, 22], [64, 22], [92, 26]]) poly(ctx, [[lx - lw / 2, -62], [lx + lw / 2, -62], [lx + lw * 0.36, 0], [lx - lw * 0.36, 0]]), ctx.fill();
    else for (const lx of [-84, 70]) { ctx.beginPath(); ctx.ellipse(lx, -40, 30, 12, 0, 0, TAU); ctx.fill(); }
    const body = [[-122, -90], [-76, -124], [-6, -128], [56, -146], [108, -116], [112, -66], [64, -44], [-20, -40], [-100, -48], [-130, -68]]; // a heavy shoulder, a low back
    K.path(ctx, body); ctx.fill();
    // the fire in its ribs: slits of light, clipped to the body
    ctx.save(); K.path(ctx, body); ctx.clip();
    K.glow(ctx, 60, -94, 70, [255, 150, 70], 0.2 + 0.6 * lit);
    for (let i = 0; i < 4; i++) { ctx.strokeStyle = rgba([255, 160 + i * 10, 80], 0.12 + 0.85 * lit); ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.shadowColor = 'rgba(255,130,60,0.9)'; ctx.shadowBlur = 14 * lit; ctx.beginPath(); ctx.moveTo(34 + i * 17, -134 + i * 4); ctx.quadraticCurveTo(22 + i * 17, -98, 32 + i * 16, -62); ctx.stroke(); }
    for (let i = 0; i < 9; i++) { const cx0 = -110 + r() * 150, cy0 = -110 + r() * 50; ctx.strokeStyle = rgba([255, 140, 70], (0.05 + 0.3 * lit) * r()); ctx.lineWidth = 1.4; ctx.shadowBlur = 0; ctx.beginPath(); ctx.moveTo(cx0, cy0); ctx.lineTo(cx0 + (r() - 0.5) * 26, cy0 + 8 + r() * 14); ctx.lineTo(cx0 + (r() - 0.5) * 30, cy0 + 22 + r() * 16); ctx.stroke(); } // cracks in the slag where the heat shows
    ctx.restore();
    // neck, head and the two forks, turned down when it is banked
    ctx.save(); ctx.translate(86, -104); ctx.rotate(lie ? 0.62 : 0); ctx.translate(-86, 104);
    ctx.fillStyle = slag;
    poly(ctx, [[66, -120], [98, -152], [130, -180], [152, -172], [124, -138], [108, -96]]); ctx.fill();
    poly(ctx, [[126, -182], [176, -176], [192, -162], [152, -152], [124, -160]]); ctx.fill();
    for (const [ox, oy, k, a] of [[14, 4, 0.8, 0.7], [0, 0, 1, 1]]) {
      ctx.save(); ctx.translate(146 + ox, -170 + oy); ctx.scale(k, k); ctx.rotate(-0.12);
      ctx.strokeStyle = rgba(mix([40, 28, 44], [255, 214, 150], lit * 0.75), a); ctx.lineWidth = 5.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      if (lit > 0.4) { ctx.shadowColor = 'rgba(255,200,130,0.9)'; ctx.shadowBlur = 10 * lit; }
      ctx.beginPath(); ctx.moveTo(0, 8); ctx.lineTo(0, -26); ctx.moveTo(-13, -82); ctx.lineTo(-13, -38); ctx.quadraticCurveTo(-13, -26, 0, -26); ctx.quadraticCurveTo(13, -26, 13, -38); ctx.lineTo(13, -82); ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
    rimStroke(ctx, [[-122, -90], [-76, -124], [-6, -128], [56, -146], [100, -122]], [255, 200, 140], 0.18 + 0.4 * lit, 2.2);
    ctx.restore();
    if (lit > 0.5) for (let i = 0; i < 26; i++) { const px = x + (r() - 0.5) * 300 * s, py = y - r() * 330 * s, sz = (0.8 + r() * 2.2) * s; ctx.fillStyle = rgba([255, 180 + r() * 50, 110], 0.3 + r() * 0.6); ctx.beginPath(); ctx.arc(px, py, sz, 0, TAU); ctx.fill(); }
  }
  /** A kite: a diamond of cloth on two spars, with a ribbon. up: flying; otherwise fallen. */
  function kite(ctx, x, y, s, c, lit, r, rot = 0) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    const pts = [[0, -34 * s], [22 * s, 0], [0, 44 * s], [-22 * s, 0]];
    if (lit > 0.2) K.glow(ctx, 0, 0, 60 * s, c, 0.3 * lit);
    poly(ctx, pts); ctx.fillStyle = rgba(mix([34, 28, 60], c, 0.15 + 0.7 * lit), 0.95); ctx.fill();
    ctx.strokeStyle = rgba(mix([60, 50, 90], [255, 244, 230], lit), 0.7); ctx.lineWidth = Math.max(1, 1.2 * s); ctx.beginPath(); ctx.moveTo(0, -34 * s); ctx.lineTo(0, 44 * s); ctx.moveTo(-22 * s, 0); ctx.lineTo(22 * s, 0); ctx.stroke();
    K.brush(ctx, [[0, 44 * s], [10 * s, 70 * s], [-6 * s, 96 * s], [12 * s, 124 * s]], 5 * s, mix([60, 50, 90], c, lit), r, { passes: 3, alpha: 0.5 });
    ctx.restore();
  }
  /** Sèo, the kite-keeper of Cirra: a tall thin figure of folded sailcloth, all angles. lit 0 = wing folded, 1 = wing up, lines taut. */
  function seo(ctx, x, y, s, lit, r, face = 1) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s * face, s);
    const dark = mix([26, 20, 48], [120, 84, 140], lit * 0.5), pale = mix([44, 36, 76], [255, 214, 236], lit * 0.75);
    if (lit > 0.2) K.glow(ctx, 0, -170, 190, [255, 170, 220], 0.22 * lit);
    ctx.strokeStyle = rgba(dark); ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const [x0, k] of [[-4, -1], [14, 1]]) { ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x0 + k * 3, -56); ctx.lineTo(x0 - 4, -112); ctx.stroke(); }
    poly(ctx, [[-50, -112], [40, -192], [0, -106]]); ctx.fillStyle = rgba(dark); ctx.fill();
    poly(ctx, [[40, -192], [60, -120], [0, -106]]); ctx.fillStyle = rgba(pale); ctx.fill();
    // the wing: a sail, raised when there is wind
    const tip = lit > 0.5 ? [124, -306] : [96, -96];
    poly(ctx, [[32, -184], tip, [72, -150]]); ctx.fillStyle = rgba(mix(dark, pale, 0.55), 0.96); ctx.fill();
    ctx.strokeStyle = rgba(dark); ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(-36, -130); ctx.bezierCurveTo(-78, -170, -30, -214, -62, -262); ctx.stroke();
    poly(ctx, [[-76, -272], [-52, -264], [-60, -250]]); ctx.fillStyle = rgba(dark); ctx.fill();
    poly(ctx, [[-76, -272], [-134, -256], [-64, -256]]); ctx.fill();
    rimStroke(ctx, [[40, -192], [60, -120]], [255, 220, 240], 0.2 + 0.5 * lit, 2);
    rimStroke(ctx, [[32, -184], tip], [255, 220, 240], 0.15 + 0.5 * lit, 2);
    ctx.restore();
    return [x + tip[0] * s * face, y + tip[1] * s];
  }
  /** Vell, of Glassmere: seen only in the water, standing under whoever stands above. Feet at the waterline, a ring of light for a head. */
  function vell(ctx, x, y0, s, lit, r) {
    const hgt = 250 * s, col = mix([70, 90, 150], [226, 242, 255], lit);
    if (lit > 0.2) K.glow(ctx, x, y0 + hgt * 0.55, 150 * s, [150, 200, 255], 0.2 * lit);
    ctx.save(); ctx.lineCap = 'round';
    for (let yy = 4 * s; yy < hgt * 0.8; yy += 5.2 * s) { // the robe, as broken lines of reflected light
      const t = yy / (hgt * 0.8), half = (20 + 26 * Math.pow(t, 0.7) - (t > 0.84 ? (t - 0.84) * 150 : 0)) * s;
      ctx.strokeStyle = rgba(col, (0.14 + 0.62 * lit) * (0.5 + r() * 0.5) * (1 - t * 0.35)); ctx.lineWidth = (1.6 + r() * 1.6) * s;
      ctx.beginPath(); ctx.moveTo(x - half + (r() - 0.5) * 10 * s, y0 + yy); ctx.lineTo(x + half + (r() - 0.5) * 10 * s, y0 + yy + (r() - 0.5) * 2); ctx.stroke();
    }
    ctx.strokeStyle = rgba(col, 0.25 + 0.7 * lit); ctx.lineWidth = 3 * s; ctx.shadowColor = rgba([170, 210, 255], 0.9); ctx.shadowBlur = 12 * lit;
    ctx.beginPath(); ctx.ellipse(x, y0 + hgt * 0.9, 17 * s, 15 * s, 0, 0, TAU); ctx.stroke();
    ctx.restore();
    for (const k of [-1, 1]) { ctx.strokeStyle = rgba(col, 0.3 + 0.4 * lit); ctx.lineWidth = 1.4 * s; ctx.beginPath(); ctx.ellipse(x + k * 12 * s, y0, 15 * s, 3.4 * s, 0, 0, TAU); ctx.stroke(); } // where its feet meet yours
  }
  /** Morrow, of Verdance: a great slow climber with a mossed back where the seed-lights live. pose 'hang' or 'curl'. */
  function morrow(ctx, x, y, s, lit, r, pose = 'hang') {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    const fur = rgba(mix([14, 22, 28], [30, 58, 50], lit * 0.6));
    ctx.fillStyle = fur; ctx.strokeStyle = fur; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const back = pose === 'hang' ? [[-70, 10], [-86, 80], [-60, 150], [0, 176], [58, 150], [80, 80], [60, 10], [0, -14]] : [[-110, -60], [-96, -108], [-30, -134], [50, -126], [104, -92], [112, -40], [70, -8], [-60, -6]];
    if (lit > 0.2) K.glow(ctx, 0, pose === 'hang' ? 80 : -70, 200, [150, 240, 140], 0.2 * lit);
    if (pose === 'hang') {
      ctx.lineWidth = 26; for (const k of [-1, 1]) { ctx.beginPath(); ctx.moveTo(k * 50, 30); ctx.quadraticCurveTo(k * 78, -70, k * 34, -150); ctx.stroke(); }
      ctx.lineWidth = 20; for (const k of [-1, 1]) { ctx.beginPath(); ctx.moveTo(k * 40, 150); ctx.quadraticCurveTo(k * 70, 196, k * 30, 214); ctx.stroke(); }
      ctx.beginPath(); ctx.ellipse(0, -6, 30, 26, 0, 0, TAU); ctx.fill();
    } else { ctx.lineWidth = 24; ctx.beginPath(); ctx.moveTo(84, -70); ctx.quadraticCurveTo(140, -40, 96, -10); ctx.stroke(); ctx.beginPath(); ctx.ellipse(108, -52, 26, 22, 0, 0, TAU); ctx.fill(); }
    K.path(ctx, back); ctx.fill();
    ctx.save(); K.path(ctx, back); ctx.clip();
    for (let i = 0; i < 70; i++) { const bx = (r() - 0.5) * 220, by = pose === 'hang' ? r() * 190 - 10 : -r() * 130; K.brush(ctx, [[bx, by], [bx + 6, by + 14], [bx + 2, by + 26]], 8, mix([20, 40, 36], [80, 150, 96], r() * (0.3 + 0.7 * lit)), r, { passes: 2, alpha: 0.35 }); }
    ctx.restore();
    for (let i = 0; i < 16; i++) { // the seed-lights on its back
      const a = r() * TAU, d = r() * 0.8, bx = Math.cos(a) * 62 * d + (pose === 'hang' ? 0 : 0), by = (pose === 'hang' ? 82 : -70) + Math.sin(a) * (pose === 'hang' ? 84 : 52) * d;
      if (lit > 0.15) K.glow(ctx, bx, by, 16, [190, 255, 140], 0.5 * lit);
      ctx.fillStyle = rgba(mix([40, 60, 50], [236, 255, 170], lit), 0.4 + 0.6 * lit); ctx.beginPath(); ctx.arc(bx, by, 2.6, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
  /** The Snuffer, the Hush's hand: a brass cap on a long crooked pole, with fog hanging from its mouth and a sliver of the eclipse inside. */
  function snuffer(ctx, x, y, s, r, rot = 0) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
    ctx.strokeStyle = 'rgba(16,12,28,0.98)'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(0, -104); ctx.bezierCurveTo(30, -220, 150, -260, 210, -400); ctx.stroke();
    for (const [kx, ky] of [[36, -196], [128, -276]]) { ctx.fillStyle = 'rgba(16,12,28,0.98)'; ctx.beginPath(); ctx.arc(kx, ky, 7, 0, TAU); ctx.fill(); }
    ctx.beginPath(); ctx.arc(0, -98, 9, 0, TAU); ctx.lineWidth = 5; ctx.stroke();
    const bell = [[-12, -90], [12, -90], [34, -26], [52, 0], [-52, 0], [-34, -26]];
    for (let i = 0; i < 34; i++) { const x0 = -46 + r() * 92, len = 60 + r() * 170; K.brush(ctx, [[x0, -4], [x0 + (r() - 0.5) * 16, len * 0.5], [x0 + (r() - 0.5) * 40, len]], 10 + r() * 20, mix([10, 9, 24], [80, 66, 126], r() * r()), r, { passes: 3, alpha: 0.22 }); }
    poly(ctx, bell); ctx.fillStyle = 'rgba(22,16,30,0.99)'; ctx.fill();
    rimStroke(ctx, [[12, -90], [34, -26], [52, 0]], [214, 170, 96], 0.55, 2.4);
    rimStroke(ctx, [[-52, 0], [52, 0]], [214, 170, 96], 0.3, 2);
    ctx.save(); ctx.beginPath(); ctx.rect(-50, 2, 100, 40); ctx.clip(); ctx.shadowColor = 'rgba(214,206,255,0.95)'; ctx.shadowBlur = 14; ctx.strokeStyle = 'rgba(240,234,255,0.95)'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.arc(0, -8, 26, 0, TAU); ctx.stroke(); ctx.restore();
    ctx.restore();
  }
  /** The Lantern as the hub: a tall crooked tower with four rooms that relight one by one. lit = how many (0..4). */
  function tower(ctx, x, y, s, lit, r) {
    const ROOM = [[255, 150, 80], [255, 170, 220], [170, 210, 255], [255, 226, 160]];
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    K.wash(ctx, K.ring(0, 26, 150, 40, 22, r, 0.1), [16, 12, 34], r, { layers: 3, alpha: 0.8, spread: 3, edge: 0 });
    ctx.rotate(-0.055);
    const half = (yy) => lerp(74, 38, Math.min(1, -yy / 470));
    ctx.beginPath(); ctx.moveTo(-half(0), 10); ctx.lineTo(half(0), 10); ctx.lineTo(half(-470), -470); ctx.lineTo(-half(-470), -470); ctx.closePath();
    const g = ctx.createLinearGradient(-70, 0, 70, 0); g.addColorStop(0, '#131029'); g.addColorStop(1, '#1d1838'); ctx.fillStyle = g; ctx.fill();
    ctx.fillStyle = 'rgba(70,52,110,0.4)';
    for (const [a, b] of [[-130, -168], [-270, -300], [-400, -424]]) { ctx.beginPath(); ctx.moveTo(-half(a), a); ctx.lineTo(half(a), a); ctx.lineTo(half(b), b); ctx.lineTo(-half(b), b); ctx.closePath(); ctx.fill(); }
    const win = (i, draw) => { const on = i < lit, c = ROOM[i]; if (on) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; draw(true, c); ctx.restore(); } ctx.fillStyle = on ? rgba(mix(c, [255, 255, 255], 0.35)) : 'rgba(8,7,20,0.95)'; ctx.strokeStyle = on ? rgba(c, 0.9) : 'rgba(120,104,170,0.35)'; ctx.lineWidth = 1.6; draw(false, c); };
    // 1 the hearth: the door and a low window
    win(0, (glow, c) => { if (glow) { K.glow(ctx, -6, -44, 130, c, 0.5); return; } ctx.beginPath(); ctx.moveTo(-26, 8); ctx.lineTo(-26, -40); ctx.quadraticCurveTo(-8, -66, 10, -40); ctx.lineTo(10, 8); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.rect(26, -86, 18, 26); ctx.fill(); ctx.stroke(); });
    // 2 the gallery: a railed walk and three windows
    ctx.fillStyle = '#0f0c22'; ctx.fillRect(-half(-214) - 14, -218, half(-214) * 2 + 28, 7);
    win(1, (glow, c) => { if (glow) { K.glow(ctx, 0, -244, 120, c, 0.45); return; } for (const wx of [-34, -8, 18]) { ctx.beginPath(); ctx.rect(wx, -258, 16, 30); ctx.fill(); ctx.stroke(); } });
    // 3 the lens room: one round window
    win(2, (glow, c) => { if (glow) { K.glow(ctx, 0, -352, 110, c, 0.5); return; } ctx.beginPath(); ctx.arc(0, -352, 19, 0, TAU); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-19, -352); ctx.lineTo(19, -352); ctx.moveTo(0, -371); ctx.lineTo(0, -333); ctx.stroke(); });
    // 4 the lamp room: the glass cage and its cap
    ctx.fillStyle = '#0f0c22'; ctx.fillRect(-half(-470) - 12, -478, half(-470) * 2 + 24, 9);
    win(3, (glow, c) => { if (glow) { K.glow(ctx, 0, -508, 190, c, 0.6); return; } ctx.beginPath(); ctx.rect(-26, -536, 52, 58); ctx.fill(); ctx.stroke(); });
    if (lit < 4) { ctx.fillStyle = rgba([255, 226, 160], 0.9); ctx.beginPath(); ctx.ellipse(0, -494, 3.4, 6, 0, 0, TAU); ctx.fill(); K.glow(ctx, 0, -496, 40, [255, 200, 130], 0.55); } // the wick: one spark was always left
    ctx.fillStyle = '#131029'; ctx.beginPath(); ctx.moveTo(-36, -536); ctx.lineTo(0, -590); ctx.lineTo(36, -536); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  const words = (ctx, s, x, y, px, o = {}) => { const { align = 'left', alpha = 0.95, color = '#fff1d8' } = o; ctx.save(); ctx.font = `italic 500 ${px}px ${SERIF}`; ctx.textAlign = align; ctx.shadowColor = 'rgba(8,6,22,0.9)'; ctx.shadowBlur = px * 0.45; ctx.globalAlpha = alpha; ctx.fillStyle = color; ctx.fillText(s, x, y); ctx.fillText(s, x, y); ctx.restore(); };
  const mark = (ctx, x, y, len, rot) => { ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(6,5,16,0.8)'; ctx.lineWidth = 11; ctx.beginPath(); ctx.moveTo(0, -len); ctx.lineTo(0, len); ctx.stroke(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 5.5; ctx.stroke(); ctx.restore(); };
  const land3 = (ctx, hy, seed, lx, cold) => (cold ? [[0, 18, [26, 20, 50], 0.3], [56, 16, [10, 8, 24], 0.7]] : [[0, 30, [86, 46, 90], 0.4], [44, 26, [48, 28, 68], 0.7], [96, 22, [20, 13, 38], 0.9]]).forEach(([dy, amp, c, rim], i) => T.ridge(ctx, W, H, hy + dy, amp, seed + i * 5, c, lx, [255, 205, 140], rim));
  const lamp = (lx, ly, s) => [lx - 10 * s, ly - 132 * s];
  /** The four planets on their road up to the Hollow, each in colour if its song is home. Returns their places. */
  function road(ctx, r, pts, home, o = {}) {
    const { from = null, wake = -1 } = o;
    pts.forEach(([x, y, R], i) => { if (from && i < home) beam(ctx, from, x, y, R, PAL[IDS[i]][1], 0.4); });
    for (let i = 0; i + 1 < pts.length; i++) { const n = Math.round(Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]) / 17); for (let k = 1; k < n; k++) { const t = k / n; ctx.fillStyle = rgba([255, 226, 170], i < home ? 0.8 : 0.2); ctx.beginPath(); ctx.ellipse(lerp(pts[i][0], pts[i + 1][0], t), lerp(pts[i][1], pts[i + 1][1], t) + Math.sin(t * Math.PI) * 18, 2.6, 1.9, r() * 3, 0, TAU); ctx.fill(); } }
    pts.forEach(([x, y, R], i) => { if (i < 4) planet(ctx, IDS[i], x, y, R, from ? Math.atan2(from[1] - y, from[0] - x) / D : 200, r, i < home ? 0 : i === wake ? 0.42 : 0.8); });
  }

  // ---------------------------------------------------------------- the panels (1200 x 750)
  const P = {
    // ---- the prologue
    pro1(ctx) { const r = RNG(11), hy = H * 0.72; T.sky(ctx, W, H, DUSKY, r, 160); T.stars(ctx, W, hy, r, 900, 3);
      const L = [420, hy + 14, 2.5], lp = lamp(...L);
      [[820, 250, 40], [960, 180, 34], [700, 130, 26], [1090, 100, 22]].forEach(([x, y, R], i) => { beam(ctx, lp, x, y, R, PAL[IDS[i]][1], 0.26); planet(ctx, IDS[i], x, y, R, Math.atan2(lp[1] - y, lp[0] - x) / D, r); });
      land3(ctx, hy, 5, L[0], false); K.glow(ctx, lp[0], lp[1], 330, [255, 214, 150], 0.6); T.lighthouse(ctx, L[0], L[1], L[2], r);
      moth(ctx, lp[0] + 92, lp[1] - 30, 0.42, r); T.eko(ctx, lp[0] + 4, lp[1] - 16, 0.12, r, { wisp: false });
      T.finish(ctx, W, H, 21, 0.5); },
    pro2(ctx) { const r = RNG(12), hy = H * 0.84; T.sky(ctx, W, H, DUSKY, r, 160); T.stars(ctx, W, hy, r, 900, 4);
      const L = [150, hy + 10, 1.5], lp = lamp(...L);
      ctx.save(); ctx.globalCompositeOperation = 'screen'; for (const [R, a] of [[300, 0.5], [430, 0.36], [560, 0.24]]) { ctx.strokeStyle = rgba([255, 214, 150], a); ctx.lineWidth = 5; ctx.shadowColor = 'rgba(255,190,120,0.9)'; ctx.shadowBlur = 16; ctx.beginPath(); ctx.arc(lp[0], lp[1], R, -1.25, 0.1); ctx.stroke(); } ctx.restore(); // rings of lamplight he draws for the spark to hop between
      land3(ctx, hy, 6, L[0], false); K.glow(ctx, lp[0], lp[1], 200, [255, 214, 150], 0.6); T.lighthouse(ctx, L[0], L[1], L[2], r);
      const a = -0.62, ex = lp[0] + Math.cos(a) * 300, ey = lp[1] + Math.sin(a) * 300;
      for (let k = 1; k < 7; k++) { const t = k / 7, aa = lerp(a, -0.36, t), rr = lerp(300, 430, 1 - (1 - t) * (1 - t)); ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.arc(lp[0] + Math.cos(aa) * rr, lp[1] + Math.sin(aa) * rr, 2.6, 0, TAU); ctx.fill(); }
      mark(ctx, lp[0] + Math.cos(-0.36) * 430, lp[1] + Math.sin(-0.36) * 430, 17, -0.36 + Math.PI / 2);
      moth(ctx, 760, 250, 0.62, r); T.eko(ctx, ex, ey - 6, 0.3, r, { wisp: true, lean: 0.3 });
      T.finish(ctx, W, H, 22, 0.5); words(ctx, '“With the beat, little spark. Not before it.”', 640, 640, 27); },
    pro3(ctx) { const r = RNG(13), hy = H * 0.88; T.sky(ctx, W, H, DUSKY, r, 170); T.stars(ctx, W, hy, r, 1000, 5);
      const L = [130, hy + 8, 1.2], lp = lamp(...L), pts = [[380, 470, 62], [640, 330, 56], [880, 220, 46], [1060, 120, 38]];
      pts.forEach(([x, y, R], i) => { beam(ctx, lp, x, y, R, PAL[IDS[i]][1], 0.5); for (let k = 0; k < 3; k++) { ctx.strokeStyle = rgba(PAL[IDS[i]][1], 0.34 - k * 0.1); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, R * (1.5 + k * 0.42), 0, TAU); ctx.stroke(); } planet(ctx, IDS[i], x, y, R, Math.atan2(lp[1] - y, lp[0] - x) / D, r); });
      land3(ctx, hy, 7, L[0], false); K.glow(ctx, lp[0], lp[1], 170, [255, 214, 150], 0.6); T.lighthouse(ctx, L[0], L[1], L[2], r);
      moth(ctx, 300, 250, 0.4, r); T.eko(ctx, 500, 190, 0.34, r, { wisp: true, lean: 0.3 });
      T.finish(ctx, W, H, 23, 0.5); },
    pro4(ctx) { const r = RNG(14), hy = H * 0.86; T.sky(ctx, W, H, COLD, r, 120); T.stars(ctx, W, hy, r, 500, 6);
      const pts = [[300, 500, 54], [470, 380, 48], [300, 250, 40], [480, 150, 34]], hx = 860, hyy = 250;
      hush(ctx, hx, hyy, 420, 400, r, { lid: 0.5, er: 60 });
      pts.forEach(([x, y, R], i) => { planet(ctx, IDS[i], x, y, R, 20, r, 0.86); ctx.strokeStyle = rgba(SONG[i], 0.55); ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(x + R * 0.6, y - R * 0.3); ctx.quadraticCurveTo(lerp(x, hx, 0.5), y - 90, hx - 150 + i * 44, hyy + 150); ctx.stroke(); for (let k = 0; k < 7; k++) { const t = 0.2 + k * 0.1; ctx.fillStyle = rgba(SONG[i], 0.85 - k * 0.08); const qx = (1 - t) * (1 - t) * (x + R * 0.6) + 2 * (1 - t) * t * lerp(x, hx, 0.5) + t * t * (hx - 150 + i * 44), qy = (1 - t) * (1 - t) * (y - R * 0.3) + 2 * (1 - t) * t * (y - 90) + t * t * (hyy + 150); ctx.beginPath(); ctx.arc(qx, qy, 2.6, 0, TAU); ctx.fill(); } jar(ctx, hx - 150 + i * 44, hyy + 172, 0.9, SONG[i]); });
      // Marlow, already half under glass, throws the spark clear
      moth(ctx, 800, 520, 0.5, r, 0.8);
      ctx.strokeStyle = 'rgba(214,226,255,0.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(705, 600); ctx.lineTo(705, 500); ctx.bezierCurveTo(705, 430, 895, 430, 895, 500); ctx.lineTo(895, 600); ctx.stroke();
      ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.setLineDash([3, 9]); ctx.strokeStyle = 'rgba(140,230,214,0.9)'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(770, 520); ctx.quadraticCurveTo(520, 380, 190, 640); ctx.stroke(); ctx.restore();
      land3(ctx, hy, 8, 200, true); T.lighthouse(ctx, 1080, hy + 8, 1.1, r, 0.15);
      T.eko(ctx, 300, 566, 0.24, r, { wisp: true, lean: -0.5 });
      T.finish(ctx, W, H, 24, 0.6); words(ctx, '“Go.”', 690, 470, 30); },
    pro5(ctx) { const r = RNG(15), hy = H * 0.8; T.sky(ctx, W, H, COLD.map(([t, c]) => [t, mix(c, [3, 3, 10], 0.55)]), r, 80); T.stars(ctx, W, hy, r, 160, 7);
      hush(ctx, 600, -40, 700, 240, r, { eye: false, strokes: 60 });
      land3(ctx, hy, 9, 600, true); T.lighthouse(ctx, 250, hy + 8, 1.4, r, 0);
      K.glow(ctx, 640, hy + 20, 220, [255, 160, 90], 0.16, 'screen'); T.eko(ctx, 640, hy - 70, 0.26, r, { wisp: false });
      ctx.strokeStyle = 'rgba(255,241,216,0.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(640, hy - 64, 150, -0.9, -0.35); ctx.stroke();
      mark(ctx, 640 + Math.cos(-0.45) * 150, hy - 64 + Math.sin(-0.45) * 150, 15, -0.45 + Math.PI / 2);
      T.finish(ctx, W, H, 25, 0.7); },
    pro6(ctx) { const r = RNG(16), hy = H * 0.9; T.sky(ctx, W, H, COLD.map(([t, c]) => [t, mix(c, DUSKY[Math.min(4, Math.round(t * 4))][1], 0.25)]), r, 140); T.stars(ctx, W, hy, r, 900, 8);
      const pts = [[330, 560, 56], [540, 430, 50], [740, 310, 42], [910, 210, 36], [1100, 90, 10]];
      hush(ctx, 1110, 70, 250, 200, r, { lid: 0.2, er: 26, strokes: 46 });
      road(ctx, r, pts, 0);
      K.glow(ctx, 1052, 150, 34, [255, 190, 110], 0.7); jar(ctx, 1052, 150, 0.8, [255, 200, 130]); // one small light, far up: the Keeper's own lantern, under glass
      land3(ctx, hy, 10, 120, true); T.lighthouse(ctx, 120, hy + 6, 1.2, r, 0.1);
      T.eko(ctx, 210, 560, 0.24, r, { wisp: true, lean: 0.3 });
      T.finish(ctx, W, H, 26, 0.55); words(ctx, 'Four songs. One keeper. A long way up.', 70, 110, 32); },

    // ---- the hub at 0, 2 and 4 planets restored
    hub(ctx, n) { const r = RNG(31), hy = H * 0.9, sky = n >= 4 ? DUSKY : COLD.map(([t, c]) => [t, mix(c, DUSKY[Math.min(4, Math.round(t * 4))][1], 0.2 + n * 0.16)]);
      T.sky(ctx, W, H, sky, r, 150); T.stars(ctx, W, hy, r, 900, 9);
      const lp = [262, hy + 4 - 506 * 1.12], pts = [[560, 520, 60], [760, 400, 52], [930, 290, 44], [1060, 200, 38], [1130, 70 + n * 8, 10]];
      const menace = 1 + n * 0.16; hush(ctx, 1120 - n * 14, 60 + n * 10, 190 * menace, 150 * menace, r, { lid: 0.15 + n * 0.11, er: 20 * menace, strokes: 40 + n * 12 });
      if (n < 4) beam(ctx, lp, pts[n][0], pts[n][1], pts[n][2], [255, 226, 170], 0.22); else beam(ctx, lp, pts[4][0] - 30, pts[4][1] + 60, 40, [255, 226, 170], 0.5);
      road(ctx, r, pts, n, { from: lp, wake: n });
      // stars earned, as a constellation low in the sky
      const st = [[470, 150], [540, 110], [610, 160], [560, 220], [650, 90], [700, 170], [760, 110], [800, 200]]; ctx.strokeStyle = 'rgba(255,236,206,0.3)'; ctx.lineWidth = 1.2; ctx.beginPath(); st.slice(0, Math.max(1, n * 2)).forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
      st.forEach(([x, y], i) => { if (i < n * 2) { K.glow(ctx, x, y, 16, [255, 220, 150], 0.5); ctx.fillStyle = 'rgba(255,240,206,0.98)'; ctx.beginPath(); ctx.arc(x, y, 3.2, 0, TAU); ctx.fill(); } else { ctx.strokeStyle = 'rgba(255,236,206,0.3)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, 2.6, 0, TAU); ctx.stroke(); } });
      land3(ctx, hy, 11, 262, n < 2);
      tower(ctx, 262, hy + 4, 1.12, n, r);
      // what each world sent home with the spark
      if (n >= 1) { K.glow(ctx, 386, hy - 6, 40, [255, 150, 80], 0.6); ctx.fillStyle = 'rgba(255,190,120,0.95)'; ctx.beginPath(); ctx.ellipse(386, hy - 4, 9, 6, 0.3, 0, TAU); ctx.fill(); }
      if (n >= 2) { ctx.strokeStyle = 'rgba(255,236,246,0.5)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(300, hy - 240); ctx.quadraticCurveTo(360, hy - 330, 420, hy - 360); ctx.stroke(); kite(ctx, 420, hy - 372, 0.6, [255, 150, 220], 1, r, 0.3); }
      if (n >= 3) { ctx.fillStyle = 'rgba(200,230,255,0.9)'; poly(ctx, [[150, hy - 6], [158, hy - 40], [166, hy - 6]]); ctx.fill(); }
      if (n >= 4) for (let i = 0; i < 14; i++) { const t = i / 13, x = 262 - 60 + Math.sin(t * 9) * 44 * (1 - t * 0.4) + 28 * t, y = hy - 20 - t * 520; K.glow(ctx, x, y, 12, [190, 255, 140], 0.55); ctx.fillStyle = 'rgba(236,255,170,0.95)'; ctx.beginPath(); ctx.arc(x, y, 2.2, 0, TAU); ctx.fill(); }
      T.eko(ctx, 430, hy - 190, 0.2, r, { wisp: true, lean: 0.25 });
      T.finish(ctx, W, H, 40 + n, 0.5); },
    hub0(ctx) { P.hub(ctx, 0); }, hub2(ctx) { P.hub(ctx, 2); }, hub4(ctx) { P.hub(ctx, 4); },

    // ---- one planet's arc: Emberwick
    arc1(ctx) { const r = RNG(51), u = 0.958; RESULTS.LAYERS.scene(ctx, W, H, 'heroes', 'desktop', u, 'cold');
      ossa(ctx, 420, H * 0.74 + 86, 1.25, 0.06, r, 'lie'); T.eko(ctx, 900, 380, 0.3, r, { wisp: true, lean: -0.3 });
      words(ctx, 'Emberwick. Its hills used to ring.', 70, 110, 30); },
    arc2(ctx) { const r = RNG(52); DUSK.play(ctx, W, H);
      ossa(ctx, 150, H - 26, 0.62, 1, r, 'stand');
      ctx.save(); ctx.globalCompositeOperation = 'screen'; for (let k = 0; k < 3; k++) { ctx.strokeStyle = rgba([255, 200, 140], 0.5 - k * 0.14); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(250, H - 150, 40 + k * 26, -1.2, 0.2); ctx.stroke(); } ctx.restore(); },
    arc3(ctx) { const r = RNG(53), u = 0.958; RESULTS.LAYERS.scene(ctx, W, H, 'heroes', 'desktop', u, 'blaze');
      ossa(ctx, 400, H * 0.74 + 60, 1.25, 1, r, 'stand');
      ctx.save(); ctx.globalCompositeOperation = 'screen'; for (let k = 0; k < 4; k++) { ctx.strokeStyle = rgba([255, 226, 170], 0.5 - k * 0.1); ctx.lineWidth = 2.6; ctx.beginPath(); ctx.arc(585, 250, 30 + k * 24, -2.4, -0.6); ctx.stroke(); } ctx.restore(); // its forks ring
      // the gift: a coal that does not stop for walls
      K.glow(ctx, 760, 420, 70, [255, 150, 70], 0.7); ctx.fillStyle = 'rgba(255,214,150,0.98)'; ctx.beginPath(); ctx.ellipse(760, 420, 10, 7, 0.4, 0, TAU); ctx.fill();
      K.brush(ctx, [[640, 380], [690, 400], [740, 416]], 8, [255, 170, 100], r, { passes: 5, alpha: 0.3 });
      T.eko(ctx, 850, 380, 0.34, r, { wisp: true, lean: -0.2 });
      words(ctx, '“Take it. It does not stop for walls.”', 620, 150, 28); },
    arc4(ctx) { const r = RNG(54), hy = H * 0.92; T.sky(ctx, W, H, COLD.map(([t, c]) => [t, mix(c, DUSKY[Math.min(4, Math.round(t * 4))][1], 0.42)]), r, 150); T.stars(ctx, W, hy, r, 900, 10);
      const lp = [170, hy - 150], pts = [[420, 520, 70], [760, 330, 60], [990, 200, 40], [1110, 120, 30]];
      beam(ctx, lp, pts[1][0], pts[1][1], 60, [255, 226, 170], 0.42, 14);
      road(ctx, r, pts, 1, { from: lp, wake: 1 });
      for (let k = 0; k < 3; k++) { ctx.strokeStyle = rgba([255, 196, 232], 0.3 - k * 0.08); ctx.lineWidth = 2; ctx.setLineDash([4, 8]); ctx.beginPath(); ctx.arc(760, 330, 60 * (1.5 + k * 0.4), -1.8, 0.4); ctx.stroke(); ctx.setLineDash([]); } // its song, muffled
      kite(ctx, 880, 250, 0.5, [255, 150, 220], 0.25, r, 1.2);
      land3(ctx, hy, 12, 170, false); K.glow(ctx, lp[0], lp[1], 160, [255, 214, 150], 0.6); T.lighthouse(ctx, 180, hy + 6, 1.15, r);
      T.eko(ctx, 330, 300, 0.24, r, { wisp: true });
      T.finish(ctx, W, H, 27, 0.5);
      ctx.save(); ctx.translate(250, hy - 190); ctx.rotate(Math.atan2(330 - (hy - 150), 760 - 170)); words(ctx, 'I heard that. All the way up here.', 0, -14, 25, { alpha: 0.9 }); ctx.restore();
      words(ctx, 'Cirra is waking…', 850, 470, 30); },

    // ---- the ambush after the second planet
    ambush(ctx) { const r = RNG(61), hy = H * 0.9; T.sky(ctx, W, H, COLD.map(([t, c]) => [t, mix(c, DUSKY[Math.min(4, Math.round(t * 4))][1], 0.3)]), r, 140); T.stars(ctx, W, hy, r, 800, 11);
      const lp = [300, hy + 4 - 506 * 1.0], sx = 700, sy = 250;
      planet(ctx, 'heroes', 980, 560, 50, 200, r); planet(ctx, 'skyhigh', 1100, 400, 42, 200, r);
      beam(ctx, lp, sx - 30, sy + 30, 40, [255, 226, 170], 0.6, 12); // the beam, cut short where the cap sits on it
      land3(ctx, hy, 13, 300, false); tower(ctx, 300, hy + 4, 1.0, 2, r);
      snuffer(ctx, sx, sy, 1.0, r, 0.5);
      T.eko(ctx, 520, 430, 0.28, r, { wisp: true, lean: 0.35 });
      T.finish(ctx, W, H, 28, 0.55); words(ctx, 'It has come to put the lamp out.', 70, 110, 30); },

    // ---- the finale on the Hollow
    fin1(ctx) { const r = RNG(71), hy = H * 0.86; T.sky(ctx, W, H, COLD, r, 110); T.stars(ctx, W, hy, r, 400, 12);
      hush(ctx, 600, 250, 520, 430, r, { lid: 0.22, er: 62 });
      [[250, 520], [420, 570], [600, 596], [780, 570], [950, 520]].forEach(([x, y], i) => { ctx.strokeStyle = 'rgba(150,60,70,0.55)'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(lerp(x, 600, 0.3), 380); ctx.quadraticCurveTo(x, y - 90, x, y - 26); ctx.stroke(); jar(ctx, x, y, 1.1, SONG[i]); });
      for (const x of [330, 510]) { ctx.strokeStyle = 'rgba(205,178,255,0.9)'; ctx.lineWidth = 12; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x, hy - 96); ctx.lineTo(x, hy - 20); ctx.stroke(); ctx.strokeStyle = 'rgba(78,42,150,1)'; ctx.lineWidth = 8; ctx.stroke(); }
      land3(ctx, hy, 14, 600, true); K.glow(ctx, 200, hy - 30, 240, [255, 150, 80], 0.14, 'screen');
      K.brush(ctx, [[120, hy - 56], [170, hy - 58], [215, hy - 60]], 9, [255, 190, 120], r, { passes: 5, alpha: 0.35 }); T.eko(ctx, 230, hy - 60, 0.22, r, { wisp: false, lean: 0.7 });
      T.finish(ctx, W, H, 29, 0.6); words(ctx, 'One: the curtains. Every gift, one at a time.', 70, 100, 28); },
    fin2(ctx) { const r = RNG(72), hy = H * 0.9; T.sky(ctx, W, H, COLD, r, 110); T.stars(ctx, W, hy, r, 300, 13);
      hush(ctx, 600, 270, 560, 470, r, { lid: 1, er: 96 });
      ctx.save(); ctx.globalCompositeOperation = 'screen'; for (let i = 0; i < 7; i++) { const a = 0.5 + i * 0.36; ctx.strokeStyle = 'rgba(234,74,48,0.75)'; ctx.lineWidth = 3; ctx.shadowColor = 'rgba(234,74,48,0.9)'; ctx.shadowBlur = 10; ctx.beginPath(); ctx.moveTo(600 + Math.cos(a) * 100, 270 + Math.sin(a) * 100); ctx.lineTo(600 + Math.cos(a) * 520, 270 + Math.sin(a) * 520); ctx.stroke(); } ctx.restore();
      // the four worlds' songs arrive from below, each in its colour
      [[140, 0], [380, 1], [820, 2], [1060, 3]].forEach(([x, i]) => { beam(ctx, [x, H + 40], lerp(x, 600, 0.55), 420, 30, SONG[i], 0.6, 9); K.glow(ctx, lerp(x, 600, 0.55), 420, 40, SONG[i], 0.6); });
      jar(ctx, 420, 560, 1.1, SONG[1], true);
      land3(ctx, hy, 15, 600, true);
      T.eko(ctx, 600, 560, 0.26, r, { wisp: true });
      K.glow(ctx, 600, 366, 60, [255, 255, 255], 0.5); mark(ctx, 600, 366, 20, Math.PI / 2);
      T.finish(ctx, W, H, 30, 0.55); words(ctx, 'Two: the eye opens. Strike on the light notes; the four songs come to help.', 70, 100, 28); },
    fin3(ctx) { const r = RNG(73), hy = H * 0.88; T.sky(ctx, W, H, [[0, [10, 10, 34]], [0.5, [50, 36, 90]], [0.8, [150, 80, 110]], [1, [240, 160, 120]]], r, 150); T.stars(ctx, W, hy, r, 500, 14);
      hush(ctx, 700, 260, 430, 400, r, { lid: 1, er: 70, warm: true, strokes: 50 });
      [[380, 470], [520, 400], [700, 370], [880, 400], [1020, 470]].forEach(([x, y], i) => { for (let k = 0; k < 9; k++) { ctx.fillStyle = rgba(SONG[i], 0.5 - k * 0.05); ctx.beginPath(); ctx.arc(x + Math.sin(k * 1.3 + i) * 4, y + k * 9, 2.4 - k * 0.2, 0, TAU); ctx.fill(); } K.glow(ctx, x, y, 40, SONG[i], 0.5); ctx.fillStyle = rgba(mix(SONG[i], [255, 255, 255], 0.6), 1); ctx.beginPath(); ctx.arc(x, y, 3.4, 0, TAU); ctx.fill(); });
      // the seam, coming undone stitch by stitch
      ctx.strokeStyle = 'rgba(255,214,150,0.9)'; ctx.lineWidth = 2; for (let k = 0; k < 7; k++) { ctx.beginPath(); ctx.moveTo(700 - 8, 138 + k * 14); ctx.lineTo(700 + 8, 146 + k * 14); ctx.stroke(); }
      land3(ctx, hy, 16, 300, false);
      moth(ctx, 300, 420, 0.5, r); T.eko(ctx, 440, 470, 0.28, r, { wisp: true, lean: 0.3 });
      T.finish(ctx, W, H, 31, 0.5); words(ctx, 'Three: two sparks on one tap. The Keeper flies beside you again.', 70, 100, 28); },
    fin4(ctx) { const r = RNG(74), hy = H * 0.74; T.sky(ctx, W, H, DAWN, r, 160); T.stars(ctx, W, hy * 0.6, r, 300, 15);
      const L = [330, hy + 14, 2.0], lp = lamp(...L);
      [[640, 300, 52], [820, 200, 46], [560, 150, 36], [960, 110, 30]].forEach(([x, y, R], i) => { beam(ctx, lp, x, y, R, PAL[IDS[i]][1], 0.4); planet(ctx, IDS[i], x, y, R, Math.atan2(lp[1] - y, lp[0] - x) / D, r); });
      // far off, on the edge of the picture: another lamp, unlit, under a light that is not ours
      K.glow(ctx, 1120, hy - 6, 150, [120, 220, 210], 0.3, 'screen'); ctx.save(); ctx.globalAlpha = 0.85; T.lighthouse(ctx, 1120, hy + 4, 0.42, r, 0); ctx.restore();
      land3(ctx, hy, 17, L[0], false); K.glow(ctx, lp[0], lp[1], 420, [255, 226, 170], 0.6, 'screen'); K.glow(ctx, lp[0], lp[1], 200, [255, 246, 220], 0.6, 'screen'); T.lighthouse(ctx, L[0], L[1], L[2], r);
      const sx = 470, sy = hy + 12; ctx.save(); ctx.filter = 'blur(5px)'; ctx.fillStyle = 'rgba(24,18,46,0.96)'; ctx.beginPath(); ctx.ellipse(sx, sy, 70, 36, 0, Math.PI, TAU); ctx.fill(); ctx.restore();
      for (let i = 0; i < 14; i++) K.brush(ctx, [[sx - 60 + i * 9, sy - (30 - Math.abs(i - 7) * 3.6)], [sx - 63 + i * 9.6, sy]], 10, mix([20, 16, 40], [84, 66, 124], r() * 0.6), r, { passes: 3, alpha: 0.3 });
      ctx.strokeStyle = 'rgba(236,230,255,0.75)'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(sx, sy - 24, 13, 0.25 * Math.PI, 0.75 * Math.PI); ctx.stroke();
      moth(ctx, lp[0] + 80, lp[1] - 20, 0.36, r); T.eko(ctx, lp[0] + 150, lp[1] - 90, 0.2, r, { wisp: true });
      T.finish(ctx, W, H, 32, 0.45); words(ctx, '“That one is not ours.”', 900, 420, 26); },

    // ---- the cast
    cast(ctx) { const r = RNG(81), hy = H * 0.8; T.sky(ctx, W, H, DUSKY.map(([t, c]) => [t, mix(c, [14, 12, 40], 0.35)]), r, 150); T.stars(ctx, W, hy * 0.7, r, 500, 16);
      hush(ctx, 1150, 150, 150, 330, r, { lid: 0.3, er: 30, strokes: 40 });
      land3(ctx, hy, 18, 500, false);
      // a strip of still water for the one who lives under it
      ctx.fillStyle = 'rgba(30,40,90,0.9)'; ctx.fillRect(560, hy + 6, 160, H - hy); ctx.strokeStyle = 'rgba(200,226,255,0.5)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(560, hy + 6); ctx.lineTo(720, hy + 6); ctx.stroke();
      T.eko(ctx, 70, hy - 60, 0.2, r, { wisp: false }); moth(ctx, 170, hy - 110, 0.5, r);
      ossa(ctx, 340, hy + 8, 0.82, 0.9, r, 'stand');
      const tip = seo(ctx, 520, hy + 6, 0.62, 1, r); ctx.strokeStyle = 'rgba(255,236,246,0.5)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(tip[0], tip[1]); ctx.lineTo(600, 150); ctx.stroke(); kite(ctx, 600, 140, 0.5, [255, 150, 220], 1, r, 0.2);
      vell(ctx, 640, hy + 6, 0.56, 1, r);
      K.brush(ctx, [[760, 0], [780, 260], [770, hy + 10]], 34, [18, 26, 30], r, { passes: 6, alpha: 0.6 }); K.brush(ctx, [[760, 250], [900, 236], [990, 250]], 20, [18, 26, 30], r, { passes: 6, alpha: 0.6 });
      morrow(ctx, 880, 390, 0.6, 1, r, 'hang');
      snuffer(ctx, 1010, hy - 20, 0.5, r, 0.1);
      T.finish(ctx, W, H, 33, 0.5);
      const name = (s, x, sub) => { words(ctx, s, x, hy + 86, 22, { align: 'center' }); words(ctx, sub, x, hy + 108, 15, { align: 'center', alpha: 0.7, color: '#e6cfae' }); };
      name('Eko', 70, 'the spark'); name('Marlow', 170, 'the Keeper'); name('Ossa', 340, 'Emberwick'); name('Sèo', 500, 'Cirra'); name('Vell', 640, 'Glassmere'); name('Morrow', 880, 'Verdance'); name('the Snuffer', 1012, 'the Hush’s hand'); name('the Hush', 1140, 'the Hollow'); }
  };
  return { W, H, P, parts: { ossa, seo, vell, morrow, snuffer, tower, kite } };
})();
