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
