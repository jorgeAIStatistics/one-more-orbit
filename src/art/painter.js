// The painter's tools for the Afterglow direction: paper grain, washes, brush strokes, skies, painted globes, Eko's
// flame, ridgelines and the Lantern. This is mockups/art/kit.js and a-dusk.js joined as one module, so the game paints
// with exactly the hand the approved stills were painted with.
// Shared tools for the art-direction stills: seeded randomness (the same picture every time), paper and grain,
// rough hand-drawn edges, washes, brush strokes, engraver's hatching, halftone dots, and the gameplay moment's
// geometry, which every direction draws in its own hand.
/* eslint-disable */
const K = (() => {
  const TAU = Math.PI * 2;
  const D = Math.PI / 180;
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const RNG = (seed) => { let s = seed >>> 0; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296; };
  const rgba = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
  const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  /** Smooth 2D value noise, 0..1. */
  function noise2(seed) {
    const p = new Float32Array(4096);
    const r = RNG(seed);
    for (let i = 0; i < 4096; i++) p[i] = r();
    const h = (x, y) => p[(Math.imul(x, 73856093) ^ Math.imul(y, 19349663)) & 4095];
    const sm = (t) => t * t * (3 - 2 * t);
    return (x, y) => {
      const xi = Math.floor(x), yi = Math.floor(y), u = sm(x - xi), v = sm(y - yi);
      const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
      return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    };
  }
  const fbm = (n, x, y) => n(x, y) * 0.5 + n(x * 2.03 + 9, y * 2.03) * 0.25 + n(x * 4.1, y * 4.1 + 5) * 0.125 + n(x * 8.3 + 3, y * 8.3) * 0.0625;
  /** A grey texture: fine grain, slow mottling, and paper fibres. Laid over a picture with a blend mode. */
  function texture(w, h, seed, o = {}) {
    const { fine = 1, mottle = 0, scale = 0.006, fibres = 0, streak = 0 } = o;
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const c = cv.getContext('2d');
    const img = c.createImageData(w, h);
    const r = RNG(seed);
    const n = noise2(seed + 7);
    for (let y = 0, i = 0; y < h; y++) for (let x = 0; x < w; x++, i += 4) {
      let v = 128 + (r() - 0.5) * 255 * fine * 0.5;
      if (mottle) v += (fbm(n, x * scale, y * scale) - 0.47) * 255 * mottle;
      if (streak) v += (n(x * 0.002, y * 0.09) - 0.5) * 255 * streak;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = clamp(v, 0, 255);
      img.data[i + 3] = 255;
    }
    c.putImageData(img, 0, 0);
    if (fibres) {
      c.lineCap = 'round';
      for (let k = 0; k < fibres; k++) {
        const x = r() * w, y = r() * h, a = r() * TAU, l = 6 + r() * 26;
        c.strokeStyle = `rgba(${r() < 0.5 ? '255,255,255' : '0,0,0'},${0.05 + r() * 0.12})`;
        c.lineWidth = 0.6 + r() * 0.8;
        c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + (r() - 0.5) * 8, y + Math.sin(a) * l * 0.5 + (r() - 0.5) * 8, x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke();
      }
    }
    return cv;
  }
  function lay(ctx, tex, mode, alpha) { ctx.save(); ctx.globalCompositeOperation = mode; ctx.globalAlpha = alpha; ctx.drawImage(tex, 0, 0); ctx.restore(); }
  /** A smooth path through points (closed or open). */
  function path(ctx, pts, closed = true) {
    const n = pts.length;
    ctx.beginPath();
    if (closed) {
      const m = (i) => [(pts[i % n][0] + pts[(i + 1) % n][0]) / 2, (pts[i % n][1] + pts[(i + 1) % n][1]) / 2];
      const s = m(n - 1);
      ctx.moveTo(s[0], s[1]);
      for (let i = 0; i < n; i++) { const e = m(i); ctx.quadraticCurveTo(pts[i][0], pts[i][1], e[0], e[1]); }
      ctx.closePath();
    } else {
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < n - 1; i++) ctx.quadraticCurveTo(pts[i][0], pts[i][1], (pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2);
      ctx.lineTo(pts[n - 1][0], pts[n - 1][1]);
    }
  }
  const jit = (pts, rnd, amp) => pts.map(([x, y]) => [x + (rnd() - 0.5) * 2 * amp, y + (rnd() - 0.5) * 2 * amp]);
  /** Points round an ellipse with a hand's unevenness. */
  function ring(cx, cy, rx, ry, n, rnd, amp = 0, rot = 0) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      const k = 1 + (rnd() - 0.5) * 2 * amp;
      const x = Math.cos(a) * rx * k, y = Math.sin(a) * ry * k;
      out.push([cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)]);
    }
    return out;
  }
  function glow(ctx, x, y, r, c, a = 1, mode = 'lighter') {
    ctx.save();
    ctx.globalCompositeOperation = mode;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba(c, a)); g.addColorStop(0.35, rgba(c, a * 0.45)); g.addColorStop(1, rgba(c, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.restore();
  }
  /** A watercolour wash: the same shape laid down a few times, never quite in the same place, with a darker rim where the paint pooled. */
  function wash(ctx, pts, c, rnd, o = {}) {
    const { layers = 3, alpha = 0.4, spread = 3, edge = 0.22, closed = true } = o;
    for (let k = 0; k < layers; k++) { path(ctx, jit(pts, rnd, spread), closed); ctx.fillStyle = rgba(c, alpha); ctx.fill(); }
    if (edge) { path(ctx, jit(pts, rnd, spread * 0.5), closed); ctx.strokeStyle = rgba(mix(c, [0, 0, 0], 0.45), edge); ctx.lineWidth = 1.6; ctx.stroke(); }
  }
  /** A brush stroke: several passes of different widths, a little apart, so the bristles show. */
  function brush(ctx, pts, width, c, rnd, o = {}) {
    const { passes = 6, alpha = 0.28, spread = 0.35 } = o;
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let k = 0; k < passes; k++) {
      const off = (rnd() - 0.5) * width * spread * 2;
      path(ctx, pts.map(([x, y]) => [x + off * 0.4 + (rnd() - 0.5) * 2, y + off + (rnd() - 0.5) * 2]), false);
      ctx.strokeStyle = rgba(c, alpha * (0.5 + rnd() * 0.8));
      ctx.lineWidth = width * (0.15 + rnd() * 0.75);
      ctx.stroke();
    }
    ctx.restore();
  }
  /** Engraver's hatching inside a clip: ruled lines that waver and break like a burin's. box = [x, y, w, h]. */
  function hatch(ctx, clip, box, angle, gap, rnd, o = {}) {
    const { color = '#e9dfc6', lw = 1, wob = 1, breakP = 0.06, alpha = 1 } = o;
    ctx.save();
    if (clip && clip(ctx) !== true) ctx.clip(); // (a shape that returns true has done its own clipping)
    const [bx, by, bw, bh] = box;
    const cx = bx + bw / 2, cy = by + bh / 2, R = Math.hypot(bw, bh) / 2;
    ctx.translate(cx, cy); ctx.rotate(angle);
    ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.globalAlpha = alpha; ctx.lineCap = 'round';
    for (let y = -R; y <= R; y += gap * (0.85 + rnd() * 0.3)) {
      ctx.beginPath();
      let pen = false;
      for (let x = -R; x <= R; x += 9) {
        if (rnd() < breakP) { pen = false; continue; }
        const yy = y + (rnd() - 0.5) * wob;
        if (pen) ctx.lineTo(x, yy); else { ctx.moveTo(x, yy); pen = true; }
      }
      ctx.stroke();
    }
    ctx.restore();
  }
  /** Halftone: dots on a turned grid, as big as the tone (0..1) at each spot. */
  function halftone(ctx, clip, box, tone, cell, color, angle = 0.26) {
    ctx.save();
    if (clip) { clip(ctx); ctx.clip(); }
    const [bx, by, bw, bh] = box;
    const cx = bx + bw / 2, cy = by + bh / 2, R = Math.hypot(bw, bh) / 2;
    const ca = Math.cos(angle), sa = Math.sin(angle);
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let v = -R; v <= R; v += cell) for (let u = -R; u <= R; u += cell) {
      const x = cx + u * ca - v * sa, y = cy + u * sa + v * ca;
      if (x < bx - cell || x > bx + bw + cell || y < by - cell || y > by + bh + cell) continue;
      const t = clamp(tone(x, y), 0, 1);
      if (t < 0.02) continue;
      const r = cell * 0.72 * Math.sqrt(t);
      ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU);
    }
    ctx.fill();
    ctx.restore();
  }
  function text(ctx, s, x, y, font, color, o = {}) {
    const { ls = 0, align = 'center', rot = 0, alpha = 1, base = 'alphabetic' } = o;
    ctx.save();
    ctx.translate(x, y); ctx.rotate(rot);
    ctx.font = font; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = base; ctx.globalAlpha = alpha;
    try { ctx.letterSpacing = `${ls}px`; } catch (e) { /* older engines */ }
    ctx.fillText(s, 0, 0);
    ctx.restore();
  }
  function vignette(ctx, w, h, a, c = [0, 0, 0], inner = 0.35) {
    const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * inner, w / 2, h / 2, Math.hypot(w, h) / 2);
    g.addColorStop(0, rgba(c, 0)); g.addColorStop(1, rgba(c, a));
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }
  const P = (cx, cy, deg, r) => [cx + Math.cos(deg * D) * r, cy + Math.sin(deg * D) * r];
  const arcPts = (cx, cy, r, a0, a1, step = 3) => { const out = []; for (let a = a0; a <= a1 + 1e-6; a += step) out.push(P(cx, cy, a, r)); return out; };

  // ---- the gameplay moment, the same in every direction: Eko rides a ring toward a white mark; the ring above is
  // closed (danger) up to its opening; gold notes on the way; a lens shard out on its branch; a lens further on.
  const G = { cx: 600, cy: 448, r: [138, 200, 262, 324], eko: 270, floor: [206, 322], mark: 318, ceil: [262, 311], floor2: [328, 392], mark2: 378, gold: [[250, 200], [288, 200], [342, 233]], shard: [356, 292], lens: 52, meter: 92, planet: 60 };
  /**
   * The foreground of the gameplay still. Everything the player must read is drawn here, last, with a dark edge under
   * it: the direction chooses colours, weights and the little shapes (its gold note, its hero, its shard), nothing else.
   */
  function playFG(ctx, S) {
    const { cx, cy } = G;
    const arc = (r, a0, a1) => { ctx.beginPath(); ctx.arc(cx, cy, r, a0 * D, a1 * D); };
    ctx.save();
    ctx.lineCap = S.cap || 'round';
    // the whole rings, faintly
    for (const r of G.r) { arc(r, 0, 360); ctx.strokeStyle = S.faint; ctx.lineWidth = S.faintW || 1.2; ctx.stroke(); }
    if (S.decor) S.decor(ctx, G);
    // the flow meter round the planet
    arc(G.meter, 0, 360); ctx.strokeStyle = S.meterBack; ctx.lineWidth = S.meterW; ctx.stroke();
    arc(G.meter, -90, -90 + 360 * 0.72); ctx.strokeStyle = S.goldCol; ctx.lineWidth = S.meterW; ctx.stroke();
    // the path of the next hop, and the branch out to the shard
    ctx.fillStyle = S.dots;
    for (let k = 1; k < 6; k++) { const t = k / 6; const [x, y] = P(cx, cy, lerp(G.mark, 334, t), lerp(G.r[1], G.r[2], 1 - (1 - t) * (1 - t)) + 11); ctx.beginPath(); ctx.arc(x, y, 2.2, 0, TAU); ctx.fill(); }
    ctx.fillStyle = S.goldCol;
    for (let a = 334; a <= 356; a += 3.2) { const [x, y] = P(cx, cy, a, G.r[2] + 11 + 19 * Math.min(1, (a - 334) / 14)); ctx.beginPath(); ctx.arc(x, y, 2, 0, TAU); ctx.fill(); }
    // floors: a dark edge, then the ring in its one clear colour
    for (const [a0, a1, r] of [[G.floor[0], G.floor[1], G.r[1]], [G.floor2[0], G.floor2[1], G.r[2]]]) {
      arc(r, a0, a1); ctx.strokeStyle = S.halo; ctx.lineWidth = S.ringW + 7; ctx.stroke();
      arc(r, a0, a1); ctx.strokeStyle = S.ring; ctx.lineWidth = S.ringW; ctx.stroke();
    }
    // the closed ring above: touching it ends the run
    arc(G.r[2], G.ceil[0], G.ceil[1]); ctx.lineCap = 'butt'; ctx.strokeStyle = S.halo; ctx.lineWidth = S.ringW + 9; ctx.stroke();
    arc(G.r[2], G.ceil[0], G.ceil[1]); ctx.strokeStyle = S.danger; ctx.lineWidth = S.ringW + 3; ctx.stroke();
    if (S.dangerCore) { arc(G.r[2], G.ceil[0], G.ceil[1]); ctx.strokeStyle = S.dangerCore; ctx.lineWidth = Math.max(1.2, S.ringW * 0.3); ctx.stroke(); }
    if (S.dangerDecor) S.dangerDecor(ctx, G);
    ctx.lineCap = S.cap || 'round';
    { const [x, y] = P(cx, cy, G.floor[1], G.r[1]); ctx.fillStyle = S.danger; ctx.beginPath(); ctx.arc(x, y, 4.5, 0, TAU); ctx.fill(); }
    // the marks: white is only ever "tap here"
    for (const [a, r, big] of [[G.mark, G.r[1], 1], [G.mark2, G.r[2], 0.8]]) {
      const [x0, y0] = P(cx, cy, a, r - S.markLen * big), [x1, y1] = P(cx, cy, a, r + S.markLen * big);
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.strokeStyle = S.halo; ctx.lineWidth = S.markW + 6; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = S.markW; ctx.stroke();
    }
    // gold: yours if you want it
    for (const [a, r] of G.gold) { const [x, y] = P(cx, cy, a, r + 11); S.gold(ctx, x, y); }
    { const [x, y] = P(cx, cy, G.shard[0], G.shard[1]); S.shard(ctx, x, y); }
    { const [x, y] = P(cx, cy, G.lens, G.r[2]); S.lens(ctx, x, y, (G.lens + 90) * D); }
    // the hero, with where he has just been
    { const [x, y] = P(cx, cy, G.eko, G.r[1] + 12); S.eko(ctx, x, y, arcPts(cx, cy, G.r[1] + 12, 228, G.eko, 3)); }
    ctx.restore();
    // what the player is told: how far, and the three shards
    S.hud(ctx);
  }
  return { TAU, D, lerp, clamp, RNG, rgba, mix, noise2, fbm, texture, lay, path, jit, ring, glow, wash, brush, hatch, halftone, text, vignette, P, arcPts, G, playFG };
})();
// Direction A: "Afterglow". Gouache and watercolour at dusk: deep air, soft volumes of light, silhouettes, paper grain.
// Eko is a small flame with a long wisp and a ring of light; the Hush is a mountain of hanging fog with an eclipse in its hood.
/* eslint-disable */
const DUSK = (() => {
  const { TAU, D, lerp, RNG, rgba, mix, noise2, fbm, P } = K;
  const SERIF = '"Hoefler Text", Baskerville, "Iowan Old Style", Palatino, Georgia, serif';
  const at = (stops, t) => { for (let i = 1; i < stops.length; i++) if (t <= stops[i][0]) return mix(stops[i - 1][1], stops[i][1], (t - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0])); return stops[stops.length - 1][1]; };
  /** The air: a graded sky, then many soft blooms of slightly wrong colour, the way a wet wash dries. */
  function sky(ctx, w, h, stops, r, blooms = 150) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    for (const [t, c] of stops) g.addColorStop(t, rgba(c));
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < blooms; i++) {
      const x = r() * w, y = r() * h, rad = 70 + r() * 240;
      const c = mix(at(stops, Math.min(1, Math.max(0, y / h + (r() - 0.5) * 0.25))), [r() * 255, r() * 160 + 60, r() * 255], 0.16);
      K.glow(ctx, x, y, rad, c, 0.07 + r() * 0.07, 'source-over');
    }
    // and the brush: long, slightly uneven strokes laid across the sky, a little lighter or darker than what is under them
    for (let i = 0; i < 70; i++) {
      const y = r() * h, x0 = r() * w - 200, len = 260 + r() * 520;
      const c = mix(at(stops, Math.min(1, Math.max(0, y / h))), r() < 0.5 ? [255, 236, 214] : [10, 8, 30], 0.2 + r() * 0.2);
      K.brush(ctx, [[x0, y], [x0 + len * 0.35, y + (r() - 0.5) * 14], [x0 + len * 0.7, y + (r() - 0.5) * 14], [x0 + len, y + (r() - 0.5) * 10]], 14 + r() * 34, c, r, { passes: 5, alpha: 0.05, spread: 0.5 });
    }
  }
  /** Stars as dabs of paint, gathered into a band; no sparkles. */
  function stars(ctx, w, h, r, n, seed = 5) {
    const nz = noise2(seed);
    for (let i = 0; i < n; i++) {
      const x = r() * w, y = r() * h;
      const band = fbm(nz, x * 0.0022 + y * 0.0016, y * 0.004 - x * 0.001);
      if (r() > band * 1.5) continue;
      const s = 0.5 + r() * r() * 2.4;
      const c = mix([255, 244, 225], r() < 0.3 ? [160, 200, 255] : [255, 190, 150], r() * 0.5);
      ctx.fillStyle = rgba(c, (0.35 + r() * 0.6) * (1 - y / h * 0.7));
      ctx.beginPath(); ctx.ellipse(x, y, s, s * (0.8 + r() * 0.4), r() * 3, 0, TAU); ctx.fill();
      if (s > 2) K.glow(ctx, x, y, s * 7, c, 0.18);
    }
  }
  /** A painted globe, lit from one side: light is `la` degrees round from east. */
  function sphere(ctx, x, y, R, base, lit, dark, la, r, o = {}) {
    const { bands = [], haze = 0.3, rim = 0.8 } = o;
    const lx = Math.cos(la * D), ly = Math.sin(la * D);
    K.glow(ctx, x, y, R * 1.7, lit, haze, 'screen');
    ctx.save();
    K.path(ctx, K.ring(x, y, R, R, 40, r, 0.012)); ctx.clip();
    const g = ctx.createRadialGradient(x + lx * R * 0.5, y + ly * R * 0.5, R * 0.05, x, y, R * 1.25);
    g.addColorStop(0, rgba(lit)); g.addColorStop(0.5, rgba(base)); g.addColorStop(1, rgba(dark));
    ctx.fillStyle = g; ctx.fillRect(x - R, y - R, R * 2, R * 2);
    for (const [off, wd, c, a] of bands) {
      const pts = [];
      for (let k = 0; k <= 8; k++) pts.push([x - R * 1.1 + (k / 8) * R * 2.2, y + off * R + Math.sin(k * 0.9 + off * 7) * R * 0.07 + (r() - 0.5) * R * 0.04]);
      K.brush(ctx, pts, wd * R, c, r, { passes: 7, alpha: a });
    }
    // the far side falls into shade, with a soft edge
    const sh = ctx.createRadialGradient(x + lx * R * 0.55, y + ly * R * 0.55, R * 0.55, x + lx * R * 0.2, y + ly * R * 0.2, R * 1.5);
    sh.addColorStop(0, rgba(dark, 0)); sh.addColorStop(1, rgba(mix(dark, [8, 6, 26], 0.6), 0.92));
    ctx.fillStyle = sh; ctx.fillRect(x - R, y - R, R * 2, R * 2);
    ctx.restore();
    ctx.save();
    ctx.globalCompositeOperation = 'screen'; ctx.lineCap = 'round';
    ctx.strokeStyle = rgba(mix(lit, [255, 255, 255], 0.4), rim); ctx.lineWidth = Math.max(1.5, R * 0.035);
    ctx.shadowColor = rgba(lit, 0.9); ctx.shadowBlur = R * 0.18;
    ctx.beginPath(); ctx.arc(x, y, R * 0.99, (la - 62) * D, (la + 62) * D); ctx.stroke();
    ctx.restore();
  }
  /** Eko: a flame with a bright seed in it, a long wisp that follows behind, and a ring of light it wears. No face. */
  function eko(ctx, x, y, s, r, o = {}) {
    const { lean = 0.2, wisp = true } = o;
    K.glow(ctx, x, y - 20 * s, 300 * s, [255, 150, 70], 0.3);
    K.glow(ctx, x, y - 10 * s, 130 * s, [255, 214, 150], 0.5);
    const T = (px, py, k = 1, dy = 0) => [x + px * s * k + lean * 60 * s * Math.pow(Math.max(0, -py) / 140, 2), y + (py * k + dy) * s];
    if (wisp) {
      const tail = [[-150, 250], [-120, 196], [-64, 150], [-20, 104], [-4, 60], [0, 30]].map(([a, b]) => [x + a * s, y + b * s]);
      K.brush(ctx, tail, 26 * s, [255, 170, 100], r, { passes: 9, alpha: 0.16, spread: 0.6 });
      K.brush(ctx, tail.slice(2), 10 * s, [255, 232, 190], r, { passes: 5, alpha: 0.3 });
    }
    const hoop = (front) => {
      ctx.save();
      ctx.translate(x, y + 16 * s); ctx.rotate(-0.3);
      ctx.strokeStyle = rgba([255, 240, 214], front ? 0.95 : 0.4); ctx.lineWidth = Math.max(1.2, 3 * s); ctx.lineCap = 'round';
      ctx.shadowColor = 'rgba(255,200,130,0.9)'; ctx.shadowBlur = 10 * s;
      ctx.beginPath(); ctx.ellipse(0, 0, 78 * s, 22 * s, 0, front ? 0.15 : Math.PI + 0.1, front ? Math.PI - 0.15 : TAU - 0.1); ctx.stroke();
      ctx.restore();
    };
    hoop(false);
    const body = [[30, 44], [0, 52], [-30, 42], [-46, 12], [-42, -24], [-26, -62], [-8, -102], [8, -142], [12, -100], [28, -66], [44, -28], [46, 10]];
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    K.wash(ctx, body.map(([a, b]) => T(a, b)), [255, 120, 50], r, { layers: 3, alpha: 0.42, spread: 3 * s, edge: 0 });
    ctx.restore();
    K.wash(ctx, body.map(([a, b]) => T(a, b, 0.7, 12)), [255, 196, 110], r, { layers: 3, alpha: 0.5, spread: 2.2 * s, edge: 0 });
    K.wash(ctx, body.map(([a, b]) => T(a, b, 0.42, 22)), [255, 240, 205], r, { layers: 2, alpha: 0.7, spread: 1.4 * s, edge: 0 });
    ctx.fillStyle = 'rgba(255,253,244,0.96)';
    ctx.beginPath(); ctx.ellipse(x, y + 22 * s, 11 * s, 15 * s, 0, 0, TAU); ctx.fill();
    hoop(true);
    for (let i = 0; i < 16; i++) { // sparks let go behind it
      const t = r(), px = x - (40 + t * 190) * s + (r() - 0.5) * 50 * s, py = y + (90 + t * 190) * s + (r() - 0.5) * 60 * s;
      ctx.fillStyle = rgba([255, 200 + r() * 40, 140], 0.25 + (1 - t) * 0.6);
      ctx.beginPath(); ctx.arc(px, py, (0.8 + r() * 2.2) * s, 0, TAU); ctx.fill();
    }
  }
  function ridge(ctx, w, h, y0, amp, seed, c, lightX, rimC, rimA) {
    const nz = noise2(seed);
    const pts = [];
    for (let x = -20; x <= w + 20; x += 20) pts.push([x, y0 + (fbm(nz, x * 0.004, seed) - 0.5) * amp * 2 + Math.pow(Math.abs(x - lightX) / w, 2) * amp * 0.6]);
    ctx.beginPath(); ctx.moveTo(-20, h + 20);
    for (const [x, y] of pts) ctx.lineTo(x, y);
    ctx.lineTo(w + 20, h + 20); ctx.closePath();
    const g = ctx.createLinearGradient(0, y0 - amp, 0, h);
    g.addColorStop(0, rgba(c)); g.addColorStop(1, rgba(mix(c, [6, 5, 20], 0.7)));
    ctx.fillStyle = g; ctx.fill();
    if (rimA) {
      const rg = ctx.createRadialGradient(lightX, y0, 10, lightX, y0, w * 0.42);
      rg.addColorStop(0, rgba(rimC, rimA)); rg.addColorStop(1, rgba(rimC, 0));
      ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.strokeStyle = rg; ctx.lineWidth = 3.5; ctx.lineJoin = 'round';
      ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); ctx.restore();
    }
  }
  function lighthouse(ctx, x, y, s, r, lit = 1) {
    ctx.save();
    ctx.translate(x, y); ctx.scale(s, s);
    K.wash(ctx, K.ring(0, 34, 96, 34, 22, r, 0.1), [22, 18, 46], r, { layers: 3, alpha: 0.7, spread: 3, edge: 0 });
    ctx.rotate(-0.09);
    ctx.fillStyle = '#17132f';
    ctx.beginPath(); ctx.moveTo(-22, 22); ctx.lineTo(22, 22); ctx.lineTo(13, -108); ctx.lineTo(-13, -108); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(70,52,110,0.55)';
    for (const [a, b] of [[-8, -30], [-58, -78]]) { ctx.beginPath(); ctx.moveTo(-20 - a * 0.07, a); ctx.lineTo(20 + a * 0.07, a); ctx.lineTo(20 + b * 0.07, b); ctx.lineTo(-20 - b * 0.07, b); ctx.closePath(); ctx.fill(); }
    ctx.fillStyle = '#0f0c22'; ctx.fillRect(-19, -114, 38, 7);
    ctx.fillStyle = rgba([255, 226, 160], 0.35 + 0.65 * lit); ctx.fillRect(-10, -136, 20, 22);
    ctx.fillStyle = '#17132f'; ctx.beginPath(); ctx.moveTo(-16, -136); ctx.lineTo(0, -160); ctx.lineTo(16, -136); ctx.closePath(); ctx.fill();
    ctx.fillStyle = rgba([255, 200, 120], 0.8 * lit); ctx.fillRect(-3, -6, 6, 12);
    ctx.restore();
  }
  /** What makes it paper: fibres and tooth over everything, a second slow mottle, and the corners falling off. */
  function finish(ctx, w, h, seed, dark = 0.42) {
    K.lay(ctx, K.texture(w, h, seed, { fine: 0.6, mottle: 0.55, scale: 0.0035, fibres: 1100 }), 'overlay', 0.4);
    K.lay(ctx, K.texture(w, h, seed + 3, { fine: 0.35, mottle: 0.35, scale: 0.012 }), 'soft-light', 0.3);
    K.vignette(ctx, w, h, dark, [8, 6, 24], 0.3);
  }
  const label = (ctx, name, song, x, y, align = 'left', a = 1) => {
    K.text(ctx, name, x, y, `italic 600 32px ${SERIF}`, '#fff1d8', { align, alpha: a });
    if (song) K.text(ctx, song.toUpperCase(), x, y + 22, `600 11px ${SERIF}`, '#e6cfae', { align, ls: 3, alpha: a * 0.8 });
  };

  return {
    tools: { sky, stars, sphere, eko, ridge, lighthouse, finish, SERIF },
    hero(ctx, w, h) {
      const r = RNG(11);
      sky(ctx, w, h, [[0, [14, 18, 46]], [0.4, [48, 34, 92]], [0.66, [140, 62, 92]], [0.86, [232, 128, 88]], [1, [250, 198, 138]]], r);
      stars(ctx, w, h * 0.62, r, 900);
      sphere(ctx, 1010, 470, 250, [150, 80, 110], [255, 170, 120], [40, 26, 70], 205, r, { bands: [[-0.3, 0.2, [255, 190, 150], 0.1], [0.1, 0.3, [90, 50, 110], 0.12], [0.45, 0.2, [255, 160, 120], 0.08]], haze: 0.22, rim: 0.5 });
      ctx.save(); ctx.filter = 'blur(26px)'; ctx.fillStyle = 'rgba(255,170,120,0.2)'; ctx.fillRect(-40, 540, w + 80, 70); ctx.restore(); // the haze where land meets air
      ridge(ctx, w, h, 600, 36, 3, [88, 46, 84], 430, [255, 190, 130], 0.35);
      ridge(ctx, w, h, 660, 30, 8, [46, 28, 66], 430, [255, 200, 140], 0.7);
      ridge(ctx, w, h, 730, 26, 14, [20, 14, 40], 430, [255, 210, 150], 0.9);
      K.glow(ctx, 400, 690, 300, [255, 160, 90], 0.22, 'screen'); // his light on the ground
      eko(ctx, 440, 330, 1.25, r);
      label(ctx, 'Eko', 'a spark from the Lantern', 76, 716);
      finish(ctx, w, h, 21);
    },
    boss(ctx, w, h) {
      const r = RNG(29);
      sky(ctx, w, h, [[0, [5, 6, 18]], [0.45, [22, 20, 52]], [0.8, [52, 40, 84]], [1, [96, 62, 92]]], r, 110);
      stars(ctx, w, h * 0.9, r, 500, 9);
      const nz = noise2(31);
      const hem = (x) => 500 + Math.sin(x * 0.006) * 34 + (fbm(nz, x * 0.012, 2) - 0.5) * 120 - Math.pow(Math.abs(x - 600) / 600, 2) * 150;
      // the mass of it: a darkness with no edge, then curtains of fog hung from the top of the picture
      ctx.save(); ctx.filter = 'blur(14px)';
      ctx.beginPath(); ctx.moveTo(40, -30);
      for (let x = 40; x <= 1160; x += 20) ctx.lineTo(x, hem(x));
      ctx.lineTo(1160, -30); ctx.closePath();
      const g = ctx.createLinearGradient(0, 0, 0, 560); g.addColorStop(0, 'rgba(4,4,12,1)'); g.addColorStop(1, 'rgba(26,20,52,0.96)');
      ctx.fillStyle = g; ctx.fill(); ctx.restore();
      for (let i = 0; i < 90; i++) {
        const x0 = 30 + r() * 1140, lenY = hem(x0) + (r() - 0.3) * 90, bend = (600 - x0) * 0.1 * r();
        const c = mix([12, 10, 28], [86, 70, 132], r() * r());
        K.brush(ctx, [[x0, -20], [x0 + bend * 0.3, lenY * 0.4], [x0 + bend, lenY * 0.8], [x0 + bend * 1.4 + (r() - 0.5) * 30, lenY]], 18 + r() * 40, c, r, { passes: 4, alpha: 0.2, spread: 0.5 });
      }
      for (let i = 0; i < 40; i++) K.glow(ctx, 60 + r() * 1080, hem(600) + 20 + r() * 120, 60 + r() * 120, [70, 58, 120], 0.1, 'source-over'); // it comes apart into mist at the hem
      // the hood, and in it the one thing that looks back: an eclipse, mostly lidded
      ctx.save(); ctx.filter = 'blur(10px)'; ctx.fillStyle = '#030208';
      ctx.beginPath(); ctx.ellipse(600, 236, 150, 186, 0, 0, TAU); ctx.fill(); ctx.restore();
      ctx.save();
      ctx.beginPath(); ctx.rect(0, 246, w, 300); ctx.clip(); // the lid: only the lower limb of the ring shows
      ctx.shadowColor = 'rgba(214,206,255,0.95)'; ctx.shadowBlur = 26; ctx.strokeStyle = 'rgba(240,234,255,0.95)'; ctx.lineWidth = 3.2;
      ctx.beginPath(); ctx.arc(600, 232, 56, 0, TAU); ctx.stroke();
      ctx.shadowBlur = 60; ctx.strokeStyle = 'rgba(190,176,255,0.35)'; ctx.lineWidth = 8; ctx.stroke();
      ctx.restore();
      K.glow(ctx, 600, 300, 150, [150, 136, 230], 0.12);
      // threads, and on them the songs it took: one small light in each jar
      const jars = [[250, 590, [255, 150, 90]], [410, 640, [255, 130, 210]], [600, 668, [255, 226, 170]], [790, 640, [150, 200, 255]], [950, 590, [150, 240, 140]]];
      for (const [x, y, c] of jars) {
        ctx.strokeStyle = 'rgba(150,60,70,0.55)'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(x + (600 - x) * 0.25, hem(x) - 30); ctx.quadraticCurveTo(x + (600 - x) * 0.05, (hem(x) + y) / 2, x, y - 26); ctx.stroke();
        K.glow(ctx, x, y, 46, c, 0.35);
        ctx.strokeStyle = 'rgba(214,226,255,0.5)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(x - 13, y + 18); ctx.lineTo(x - 13, y - 8); ctx.quadraticCurveTo(x - 13, y - 26, x, y - 26); ctx.quadraticCurveTo(x + 13, y - 26, x + 13, y - 8); ctx.lineTo(x + 13, y + 18); ctx.closePath(); ctx.stroke();
        ctx.fillStyle = rgba(mix(c, [255, 255, 255], 0.5), 0.95); ctx.beginPath(); ctx.arc(x, y + 2, 3.2, 0, TAU); ctx.fill();
      }
      ridge(ctx, w, h, 742, 14, 5, [10, 8, 24], 600, [255, 190, 130], 0.8);
      K.glow(ctx, 600, 600, 420, [255, 140, 70], 0.1, 'screen'); // the only warm light there is
      eko(ctx, 600, 716, 0.3, r, { wisp: false });
      label(ctx, 'the Hush', 'it cannot bear a sound', 76, 716);
      finish(ctx, w, h, 33, 0.6);
    },
    map(ctx, w, h) {
      const r = RNG(47);
      sky(ctx, w, h, [[0, [8, 9, 30]], [0.5, [30, 26, 78]], [0.85, [70, 44, 104]], [1, [120, 62, 100]]], r);
      stars(ctx, w, h, r, 1400, 12);
      const L = [600, 470];
      const pl = [
        ['Emberwick', 'Heroes Tonight', 235, 610, 74, [214, 96, 60], [255, 190, 120], [70, 26, 50], [[-0.2, 0.22, [255, 200, 140], 0.14], [0.3, 0.25, [150, 50, 50], 0.16]], 'left'],
        ['Cirra', 'Sky High', 960, 590, 66, [220, 110, 190], [255, 196, 232], [80, 36, 110], [[-0.1, 0.3, [255, 236, 248], 0.2], [0.4, 0.2, [255, 220, 240], 0.14]], 'right'],
        ['Glassmere', 'Blank', 290, 240, 58, [110, 160, 230], [226, 242, 255], [30, 44, 110], [[0, 0.16, [240, 250, 255], 0.2], [-0.4, 0.12, [200, 230, 255], 0.14]], 'left'],
        ['Verdance', 'Invincible', 925, 235, 68, [70, 160, 110], [196, 250, 160], [14, 60, 66], [[-0.25, 0.25, [220, 255, 170], 0.14], [0.25, 0.3, [20, 90, 80], 0.2]], 'right']
      ];
      // the beam: a soft volume of light from the lamp to the planet whose song is home
      ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.filter = 'blur(10px)';
      const lamp = [L[0] - 10, L[1] - 132];
      for (const [tx, ty, c, a] of [[235, 610, [255, 190, 120], 0.3], [960, 590, [255, 170, 220], 0.22]]) {
        const ang = Math.atan2(ty - lamp[1], tx - lamp[0]), d = Math.hypot(tx - lamp[0], ty - lamp[1]) + 60;
        const g = ctx.createLinearGradient(lamp[0], lamp[1], tx, ty); g.addColorStop(0, rgba(c, a)); g.addColorStop(1, rgba(c, a * 0.25));
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(lamp[0], lamp[1]);
        ctx.lineTo(lamp[0] + Math.cos(ang - 0.16) * d, lamp[1] + Math.sin(ang - 0.16) * d); ctx.lineTo(lamp[0] + Math.cos(ang + 0.16) * d, lamp[1] + Math.sin(ang + 0.16) * d); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
      // the road Eko travels: dabs of light from world to world
      const road = [[235, 610], [960, 590], [290, 240], [925, 235], [600, 86]];
      for (let i = 0; i + 1 < road.length; i++) for (let k = 1; k < 26; k++) {
        const t = k / 26, bend = Math.sin(t * Math.PI) * 46 * (i % 2 ? -1 : 1);
        const x = lerp(road[i][0], road[i + 1][0], t), y = lerp(road[i][1], road[i + 1][1], t) + bend;
        ctx.fillStyle = rgba([255, 226, 170], i < 2 ? 0.75 : 0.25); ctx.beginPath(); ctx.ellipse(x, y, 2.6, 1.9, r() * 3, 0, TAU); ctx.fill();
      }
      // the Hollow: no light comes off it; it only takes
      ctx.save(); ctx.filter = 'blur(16px)'; ctx.fillStyle = 'rgba(3,3,10,0.96)'; ctx.beginPath(); ctx.ellipse(600, 20, 250, 130, 0, 0, TAU); ctx.fill(); ctx.restore();
      for (let i = 0; i < 46; i++) { const x0 = 360 + r() * 480; K.brush(ctx, [[x0, -10], [x0 + (600 - x0) * 0.1, 80], [x0 + (r() - 0.5) * 40, 120 + r() * 70]], 14 + r() * 26, mix([8, 7, 20], [70, 56, 120], r() * r()), r, { passes: 3, alpha: 0.2 }); }
      ctx.save(); ctx.beginPath(); ctx.rect(0, 62, w, 80); ctx.clip(); ctx.shadowColor = 'rgba(214,206,255,0.9)'; ctx.shadowBlur = 16; ctx.strokeStyle = 'rgba(236,230,255,0.9)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(600, 56, 24, 0, TAU); ctx.stroke(); ctx.restore();
      for (const [name, song, x, y, R, base, lit, dark, bands, side] of pl) {
        const la = Math.atan2(L[1] - 130 - y, L[0] - x) / D; // every world is lit from the Lantern
        const far = name === 'Glassmere' || name === 'Verdance';
        sphere(ctx, x, y, R, far ? mix(base, [24, 20, 60], 0.72) : base, far ? mix(lit, [40, 34, 90], 0.72) : lit, dark, la, r, { bands: far ? [] : bands, haze: far ? 0.05 : 0.3, rim: far ? 0.15 : 0.85 });
        label(ctx, name, far ? 'dark and silent' : song, side === 'left' ? x + R + 22 : x - R - 22, y + 4, side === 'left' ? 'left' : 'right', far ? 0.55 : 1);
      }
      K.glow(ctx, lamp[0], lamp[1], 150, [255, 214, 150], 0.6);
      lighthouse(ctx, L[0], L[1], 1, r);
      eko(ctx, 1010, 498, 0.22, r, { wisp: false });
      K.text(ctx, 'the Galaxy of the Lantern', 60, 70, `italic 600 30px ${SERIF}`, '#fff1d8', { align: 'left' });
      label(ctx, 'the Hollow', '', 760, 96, 'left', 0.6);
      finish(ctx, w, h, 52, 0.5);
    },
    play(ctx, w, h) {
      const r = RNG(63), G = K.G;
      sky(ctx, w, h, [[0, [28, 16, 52]], [0.4, [92, 36, 76]], [0.75, [196, 84, 66]], [1, [246, 168, 104]]], r);
      stars(ctx, w, h * 0.5, r, 300, 3);
      // the drop: light thrown out from the planet in wide wet strokes
      ctx.save(); ctx.globalCompositeOperation = 'screen';
      for (let k = 0; k < 22; k++) {
        const a = (k / 22) * TAU + r() * 0.2, hw = 0.03 + r() * 0.07, len = 500 + r() * 500;
        const g = ctx.createRadialGradient(G.cx, G.cy, 40, G.cx, G.cy, len); g.addColorStop(0, rgba([255, 214, 150], 0.26)); g.addColorStop(1, rgba([255, 140, 90], 0));
        ctx.fillStyle = g;
        K.path(ctx, K.jit([[G.cx, G.cy], [G.cx + Math.cos(a - hw) * len, G.cy + Math.sin(a - hw) * len], [G.cx + Math.cos(a) * len * 1.05, G.cy + Math.sin(a) * len * 1.05], [G.cx + Math.cos(a + hw) * len, G.cy + Math.sin(a + hw) * len]], r, 8)); ctx.fill();
      }
      ctx.restore();
      ridge(ctx, w, h, 700, 30, 4, [58, 24, 58], 600, [255, 200, 140], 0.6);
      ridge(ctx, w, h, 752, 22, 9, [26, 12, 36], 600, [255, 210, 150], 0.8);
      finish(ctx, w, h, 71, 0.4);
      // the calm ground the course sits on: the wilder the picture behind, the deeper it is
      const band = ctx.createRadialGradient(G.cx, G.cy, 70, G.cx, G.cy, 430);
      band.addColorStop(0, 'rgba(14,8,28,0)'); band.addColorStop(0.2, 'rgba(14,8,28,0.62)'); band.addColorStop(0.72, 'rgba(14,8,28,0.62)'); band.addColorStop(1, 'rgba(14,8,28,0)');
      ctx.fillStyle = band; ctx.fillRect(0, 0, w, h);
      sphere(ctx, G.cx, G.cy, G.planet, [214, 96, 60], [255, 200, 130], [70, 26, 50], 225, r, { bands: [[-0.2, 0.22, [255, 200, 140], 0.16], [0.3, 0.25, [150, 50, 50], 0.18]], haze: 0.35 });
      K.playFG(ctx, {
        faint: 'rgba(255,238,214,0.17)', faintW: 1.3, meterBack: 'rgba(255,255,255,0.14)', meterW: 4, goldCol: '#ffd06a', dots: 'rgba(255,255,255,0.65)',
        halo: 'rgba(10,6,22,0.75)', ring: '#f7efe0', ringW: 4.5, danger: '#ea4a30', dangerCore: '#fff6ee', markLen: 16, markW: 5.5,
        gold(c, x, y) { c.fillStyle = 'rgba(10,6,22,0.6)'; c.beginPath(); c.arc(x, y, 11, 0, TAU); c.fill(); c.strokeStyle = '#ffd06a'; c.lineWidth = 2.4; c.beginPath(); c.arc(x, y, 7.5, 0, TAU); c.stroke(); c.fillStyle = '#ffe6a8'; c.beginPath(); c.arc(x, y, 3, 0, TAU); c.fill(); },
        shard(c, x, y) { K.glow(c, x, y, 30, [200, 240, 255], 0.5); c.fillStyle = '#d8f4ff'; c.strokeStyle = '#ffd06a'; c.lineWidth = 2; c.lineJoin = 'round'; c.beginPath(); c.moveTo(x + 1, y - 15); c.lineTo(x + 10, y - 2); c.lineTo(x + 3, y + 15); c.lineTo(x - 9, y + 4); c.closePath(); c.fill(); c.stroke(); },
        lens(c, x, y, rot) { c.save(); c.translate(x, y); c.rotate(rot); K.glow(c, 0, 0, 44, [255, 170, 110], 0.4); c.beginPath(); c.moveTo(0, -34); c.quadraticCurveTo(14, 0, 0, 34); c.quadraticCurveTo(-14, 0, 0, -34); c.fillStyle = 'rgba(255,170,110,0.25)'; c.fill(); c.strokeStyle = '#ffb07a'; c.lineWidth = 2.5; c.stroke(); c.restore(); },
        eko(c, x, y, trail) { K.brush(c, trail, 9, [255, 190, 120], r, { passes: 6, alpha: 0.3 }); eko(c, x, y + 2, 0.2, r, { wisp: false, lean: -0.6 }); },
        hud(c) {
          K.text(c, '62', 594, 70, `700 52px ${SERIF}`, '#fff1d8', { align: 'right' }); K.text(c, '%', 600, 70, `italic 500 26px ${SERIF}`, '#e6cfae', { align: 'left' });
          K.text(c, 'EMBERWICK  ·  THE DROP', 600, 98, `600 11px ${SERIF}`, '#e6cfae', { ls: 4 });
          c.fillStyle = 'rgba(255,255,255,0.16)'; c.fillRect(80, h - 44, w - 160, 3); c.fillStyle = '#ffd06a'; c.fillRect(80, h - 44, (w - 160) * 0.62, 3);
        }
      });
    }
  };
})();
export { K, DUSK };
