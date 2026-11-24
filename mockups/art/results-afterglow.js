// Afterglow, step 4: the results, as three compositions, each for a phone and a desktop. No panel, no stat tiles,
// no buttons: the planet answers the run, and the few things worth knowing are written into the picture.
//   1. DAYBREAK   you are under the planet's own sky. Its colour rises from the horizon as far as the song got;
//                 on a clear it reaches the top, and on a first clear it blazes.
//   2. THE ORBIT  the planet from above, with the run drawn round it as an arc of light.
//   3. THE GALAXY no separate screen at all: you are back in the galaxy, and the planet has changed.
// A tap anywhere flies the song again. One quiet line leads back to the galaxy, one opens more about the run.
/* eslint-disable */
const RESULTS = (() => {
  const { TAU, D, lerp, RNG, rgba, mix, noise2, fbm } = K;
  const T = DUSK.tools;
  const SERIF = `"Cormorant Garamond", ${T.SERIF}`, FIGS = `"Cormorant Lining", ${SERIF}`;
  const CREAM = '#fff1d8', SAND = '#e6cfae';
  const smooth = (x) => { const t = x < 0 ? 0 : x > 1 ? 1 : x; return t * t * (3 - 2 * t); };
  const COLD = [[0, [5, 6, 18]], [0.45, [20, 20, 50]], [0.8, [46, 38, 80]], [1, [84, 58, 90]]];
  const DUSKY = [[0, [9, 10, 34]], [0.42, [34, 28, 84]], [0.72, [96, 50, 104]], [0.9, [206, 104, 92]], [1, [248, 178, 122]]];
  const NIGHT = [22, 18, 56];
  const PL = {
    heroes: { name: 'Emberwick', song: 'Heroes Tonight', base: [214, 96, 60], lit: [255, 190, 120], dark: [70, 26, 50], bands: [[-0.2, 0.22, [255, 200, 140], 0.14], [0.3, 0.25, [150, 50, 50], 0.16]],
      sky: [[0, [24, 14, 48]], [0.4, [86, 34, 74]], [0.72, [190, 80, 64]], [0.9, [244, 150, 96]], [1, [255, 206, 140]]], aur: [[255, 126, 56], [255, 84, 128], [255, 196, 96]], land: [[112, 46, 66], [66, 26, 52], [26, 12, 30]] },
    skyhigh: { name: 'Cirra', song: 'Sky High', base: [220, 110, 190], lit: [255, 196, 232], dark: [80, 36, 110], bands: [[-0.1, 0.3, [255, 236, 248], 0.2], [0.4, 0.2, [255, 220, 240], 0.14]],
      sky: [[0, [20, 14, 52]], [0.4, [84, 40, 110]], [0.72, [196, 96, 170]], [0.9, [250, 170, 200]], [1, [255, 220, 220]]], aur: [[255, 150, 220], [190, 150, 255], [255, 220, 236]], land: [[132, 84, 150], [84, 50, 112], [34, 20, 58]] },
    blank: { name: 'Glassmere', song: 'Blank', base: [110, 160, 230], lit: [226, 242, 255], dark: [30, 44, 110], bands: [[0, 0.16, [240, 250, 255], 0.2]] }
  };

  /** Words written into the picture: a dark breath under them so they hold on any sky, then the letters. Returns their width. */
  function write(ctx, s, x, y, px, o = {}) {
    const { align = 'left', alpha = 1, color = CREAM, style = 'italic', glow = 0, figs = false } = o;
    ctx.save();
    ctx.font = `${style} 500 ${px}px ${figs ? FIGS : SERIF}`; ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
    if (glow) { ctx.shadowColor = `rgba(255,170,110,${0.6 * alpha * glow})`; ctx.shadowBlur = px * 0.4; ctx.fillStyle = `rgba(255,240,214,${0.5 * alpha})`; ctx.fillText(s, x, y); }
    ctx.shadowColor = 'rgba(10,6,24,0.8)'; ctx.shadowBlur = px * 0.35; ctx.globalAlpha = alpha; ctx.fillStyle = color; ctx.fillText(s, x, y);
    const wd = ctx.measureText(s).width;
    ctx.restore();
    return wd;
  }
  /** A lens shard as a small star of paint: kept, just won (a ring of light round it), or only the place where one will be. */
  function dab(ctx, x, y, s, on, fresh) {
    if (on) {
      if (fresh) { K.glow(ctx, x, y, s * 4.2, [255, 226, 170], 0.3); ctx.strokeStyle = 'rgba(255,236,206,0.6)'; ctx.lineWidth = Math.max(1, s * 0.2); ctx.beginPath(); ctx.arc(x, y, s * 1.75, 0, TAU); ctx.stroke(); }
      K.glow(ctx, x, y, s * 3, [255, 220, 150], 0.4); ctx.fillStyle = 'rgba(255,240,206,0.98)'; ctx.beginPath(); ctx.ellipse(x, y, s, s * 0.9, 0.4, 0, TAU); ctx.fill();
    } else { ctx.strokeStyle = 'rgba(255,236,206,0.5)'; ctx.lineWidth = Math.max(1, s * 0.28); ctx.beginPath(); ctx.arc(x, y, s * 0.85, 0, TAU); ctx.stroke(); }
  }
  /**
   * What the run came to, in a few soft lines: the planet, its song, how far, its shards, and what has changed.
   * `upto`: 0 nothing yet, 1 the name alone, 9 all of it (the lines arrive one after another, as the story's do).
   */
  function words(ctx, w, h, S, B, u, upto = 9) {
    if (upto <= 0) return;
    const P = PL[S.id], x = w * B.x, k = B.k || 1, U = u * k;
    let y = h * B.y;
    if (B.air !== 0) K.glow(ctx, x + w * B.w * 0.42, y + 130 * U, w * B.w * 1.05, [8, 6, 22], B.air || 0.5, 'source-over'); // only the air round the words darkens
    write(ctx, P.name, x, y, 50 * U, { glow: 1 });
    y += 30 * U; write(ctx, P.song + (S.tag ? `  ·  ${S.tag}` : ''), x, y, 19 * U, { alpha: 0.92 });
    if (upto < 2) return;
    y += 98 * U;
    const nw = write(ctx, String(S.pct), x - 3 * U, y, 100 * U, { style: 'normal', glow: 1, figs: true });
    write(ctx, '%', x + nw + 3 * U, y, 42 * U, { alpha: 0.9 });
    y += 36 * U;
    for (let i = 0; i < 3; i++) dab(ctx, x + (8 + i * 27) * U, y - 5.5 * U, 5.4 * U, !!S.shards[i], !!(S.fresh && S.fresh[i]));
    if (S.shardLine) write(ctx, S.shardLine, x + 92 * U, y, 16.5 * U, { alpha: 0.8, color: SAND });
    y += 48 * U;
    ctx.font = `italic 500 ${19.5 * U}px ${SERIF}`;
    const wrap = (s, px) => { ctx.font = `italic 500 ${px}px ${SERIF}`; const out = []; let line = ''; for (const word of s.split(' ')) { if (line && ctx.measureText(line + word).width > w * B.w) { out.push(line.trim()); line = ''; } line += `${word} `; } out.push(line.trim()); return out; };
    for (const s of S.lines || []) for (const l of wrap(s, 19.5 * U)) { write(ctx, l, x, y, 19.5 * U, { alpha: 0.96 }); y += 27 * U; }
    y += 12 * U;
    if (Array.isArray(S.more)) {
      // "more about this run", opened: the same hand, a little smaller. Nothing here is needed to go on.
      for (const s of S.more) for (const l of wrap(s, 16.5 * U)) { write(ctx, l, x, y, 16.5 * U, { alpha: 0.86, color: SAND }); y += 23.5 * U; }
      y += 8 * U;
      if (S.act) write(ctx, S.act, x, y, 16.5 * U, { alpha: 0.95 });
    } else if (S.more !== false) write(ctx, 'more about this run', x, y, 15 * U, { alpha: 0.64, color: SAND });
  }

  /** The planet's sky: cold where the song has not reached, in its own colour below that; `blaze` on a clear. */
  function floodSky(ctx, w, h, P, f, hor, sunX, seed, u, blaze) {
    const r = RNG(seed), hy = h * hor;
    const fit = (stops) => stops.map(([t, c]) => [Math.min(1, (t * hor) / 0.9), c]);
    T.sky(ctx, w, h, fit(COLD), r, 120);
    T.stars(ctx, w, hy, r, Math.round((w * h) / 800), seed);
    if (f > 0) {
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      const c = cv.getContext('2d');
      T.sky(c, w, h, fit(P.sky), RNG(seed + 1), 170);
      if (f < 1) {
        // the front of the colour: not a line but a tide, higher here and lower there, soft all along
        const nz = noise2(seed + 5), top = hy * (1 - f);
        const front = (x) => top + (fbm(nz, (x * 0.0032) / u, 3) - 0.5) * 170 * u;
        const m = document.createElement('canvas'); m.width = w; m.height = h;
        const mc = m.getContext('2d');
        mc.filter = `blur(${44 * u}px)`; mc.fillStyle = '#000'; mc.beginPath(); mc.moveTo(-300, h + 300);
        for (let x = -300; x <= w + 300; x += 20) mc.lineTo(x, front(x));
        mc.lineTo(w + 300, h + 300); mc.closePath(); mc.fill();
        c.globalCompositeOperation = 'destination-in'; c.drawImage(m, 0, 0);
        ctx.drawImage(cv, 0, 0);
        const e = document.createElement('canvas'); e.width = w; e.height = h; // where it has got to, it is brightest: a soft lip of light
        const ec = e.getContext('2d');
        for (let k = 0; k < 34; k++) { const x0 = r() * w * 1.3 - w * 0.15, len = (160 + r() * 360) * u; K.brush(ec, [0, 0.33, 0.66, 1].map((t) => [x0 + len * t, front(x0 + len * t) + (r() - 0.1) * 70 * u]), (14 + r() * 30) * u, mix(P.lit, P.aur[k % 3], 0.3 + r() * 0.6), r, { passes: 4, alpha: 0.16, spread: 0.7 }); }
        ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.filter = `blur(${9 * u}px)`; ctx.globalAlpha = 0.8; ctx.drawImage(e, 0, 0); ctx.restore();
      } else ctx.drawImage(cv, 0, 0);
    }
    const sx = w * sunX;
    if (blaze > 0) {
      ctx.save(); ctx.globalCompositeOperation = 'screen';
      const n = Math.round(12 + 14 * blaze);
      for (let k = 0; k < n; k++) { // light thrown up from the horizon in wide wet strokes
        const a = -Math.PI * (0.04 + (0.92 * (k + r() * 0.8)) / n), hw = 0.02 + r() * 0.06, len = h * (0.5 + r() * 0.75);
        const g = ctx.createRadialGradient(sx, hy, 30 * u, sx, hy, len); g.addColorStop(0, rgba(mix(P.lit, [255, 255, 255], 0.3), 0.3 * blaze)); g.addColorStop(1, rgba(P.base, 0));
        ctx.fillStyle = g; K.path(ctx, K.jit([[sx, hy], [sx + Math.cos(a - hw) * len, hy + Math.sin(a - hw) * len], [sx + Math.cos(a) * len * 1.05, hy + Math.sin(a) * len * 1.05], [sx + Math.cos(a + hw) * len, hy + Math.sin(a + hw) * len]], r, 8 * u)); ctx.fill();
      }
      ctx.restore();
      // and curtains of it high up, hung in three folds: each a hem of light with rays standing on it, fading upward
      const a = document.createElement('canvas'); a.width = w; a.height = h;
      const ac = a.getContext('2d'), nz = noise2(seed + 9);
      for (let band = 0; band < 3; band++) {
        const col = P.aur[band], step = 5 * u;
        for (let x = -step; x < w + step; x += step) {
          const q = (x * 0.0026) / u, hem = h * (0.27 + band * 0.105) + (fbm(nz, q, band * 3) - 0.5) * h * 0.26 + Math.sin(q * 3 + band * 2) * 26 * u;
          const strength = smooth((fbm(nz, q * 2.2 + 7, band * 5 + 1) - 0.3) / 0.35) * (0.55 + 0.45 * fbm(nz, q * 14, band + 9)), tall = (150 + fbm(nz, q * 5 + 3, band) * 330) * u;
          if (strength < 0.02) continue;
          const low = 34 * u, g = ac.createLinearGradient(0, hem + low, 0, hem - tall), t0 = low / (tall + low); g.addColorStop(0, rgba(col, 0)); g.addColorStop(t0, rgba(mix(col, [255, 240, 220], 0.2), 0.85 * strength)); g.addColorStop(t0 + (1 - t0) * 0.3, rgba(col, 0.42 * strength)); g.addColorStop(1, rgba(col, 0));
          ac.fillStyle = g; ac.fillRect(x, hem - tall, step * (1 + r() * 1.6), tall + low);
        }
      }
      ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.filter = `blur(${6 * u}px)`; ctx.globalAlpha = Math.min(1, 0.9 * blaze); ctx.drawImage(a, 0, 0);
      ctx.filter = `blur(${30 * u}px)`; ctx.globalAlpha = 0.3 * blaze; ctx.drawImage(a, 0, 0); ctx.restore(); // and its glow in the air round it
      { const g = ctx.createLinearGradient(0, 0, 0, hy); g.addColorStop(0, rgba(P.aur[1], 0.2 * blaze)); g.addColorStop(0.5, rgba(P.aur[0], 0.12 * blaze)); g.addColorStop(1, rgba(P.aur[0], 0)); ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = g; ctx.fillRect(0, 0, w, hy); ctx.restore(); }
      K.glow(ctx, sx, hy, 900 * u, P.base, 0.4 * blaze, 'screen');
      K.glow(ctx, sx, hy, 640 * u, P.lit, 0.55 * blaze, 'screen');
      K.glow(ctx, sx, hy, 210 * u, [255, 248, 230], 0.6 * blaze, 'screen');
    }
  }
  /** Emberwick: a far, worn fire-hill with a broken crown, a warm mouth and a plume. Never a neat cone. */
  function cone(ctx, x, y, bw, ch, c, lit, warm, r, u, seed = 1) {
    const nz = noise2(seed * 13 + 5), pts = [], base = y + 34 * u;
    for (let i = 0; i <= 44; i++) {
      const t = (i / 44) * 2 - 1, e = 1 - Math.abs(t);
      let hgt = Math.pow(e, t < 0 ? 1.5 : 1.15) * ch;
      hgt = Math.min(hgt, ch * (0.74 + 0.07 * Math.sin(t * 11 + seed) + (t > 0 ? 0.05 : 0))); // the crown, broken off unevenly
      hgt += (fbm(nz, t * 3.4, 2) - 0.5) * ch * 0.2 * (0.35 + e * 0.65);
      pts.push([x + t * bw * (t < 0 ? 1.25 : 0.85), base - Math.max(0, hgt)]);
    }
    ctx.beginPath(); ctx.moveTo(pts[0][0], base + 10 * u); for (const [px, py] of pts) ctx.lineTo(px, py); ctx.lineTo(pts[pts.length - 1][0], base + 10 * u); ctx.closePath();
    const g = ctx.createLinearGradient(0, base - ch, 0, base); g.addColorStop(0, rgba(mix(c, lit, 0.26 * warm))); g.addColorStop(1, rgba(mix(c, lit, 0.08 * warm))); ctx.fillStyle = g; ctx.fill();
    if (warm < 0.2) return;
    const top = pts.reduce((a, b) => (b[1] < a[1] ? b : a));
    ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.filter = `blur(${1.2 * u}px)`;
    ctx.strokeStyle = rgba(lit, 0.5 * warm); ctx.lineWidth = 2.2 * u; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); pts.slice(24, 43).forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.stroke(); // the day on the flank that faces it
    ctx.filter = `blur(${7 * u}px)`;
    K.brush(ctx, [[top[0], top[1]], [top[0] - 14 * u, top[1] - 66 * u], [top[0] - 56 * u, top[1] - 136 * u], [top[0] - 130 * u, top[1] - 190 * u]], 40 * u, mix(lit, [255, 120, 90], 0.4), r, { passes: 6, alpha: 0.1 * warm, spread: 0.7 });
    ctx.restore();
    K.glow(ctx, top[0], top[1] + 2 * u, 50 * u, [255, 150, 80], 0.5 * warm);
  }
  /** Cirra: a bank of cloud, its tops catching what light there is. */
  function cloudbank(ctx, w, h, y0, amp, seed, c, rimC, rimA, u, lightX) {
    const r = RNG(seed), nz = noise2(seed), puffs = [];
    for (let x = -90 * u; x <= w + 90 * u; x += 40 * u) puffs.push([x + (r() - 0.5) * 20 * u, y0 + (fbm(nz, (x * 0.002) / u, 1) - 0.5) * amp * 2, (52 + r() * 70) * u, (20 + r() * 28) * u]);
    ctx.save(); ctx.filter = `blur(${6 * u}px)`;
    const g = ctx.createLinearGradient(0, y0 - amp, 0, h); g.addColorStop(0, rgba(c)); g.addColorStop(1, rgba(mix(c, [8, 6, 24], 0.72)));
    ctx.fillStyle = g; ctx.beginPath();
    for (const [x, y, rx, ry] of puffs) { ctx.moveTo(x + rx, y); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); }
    ctx.rect(-60, y0 + amp * 0.2, w + 120, h); ctx.fill(); ctx.restore();
    if (rimA <= 0) return;
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    ctx.filter = `blur(${5 * u}px)`;
    for (let i = 0; i + 3 < puffs.length; i += 2 + Math.floor(r() * 3)) { const seg = puffs.slice(i, i + 3 + Math.floor(r() * 2)), near = Math.max(0, 1 - Math.abs(seg[0][0] - lightX) / (w * 0.6)); K.brush(ctx, seg.map(([x, y, , ry]) => [x, y - ry * 0.72]), (9 + r() * 12) * u, rimC, r, { passes: 3, alpha: rimA * 0.3 * (0.25 + 0.75 * near), spread: 0.5 }); }
    ctx.restore();
  }
  /** The ground of each world, as a silhouette against its sky. `warm`: 0 night .. 1 in its colour. */
  function land(ctx, w, h, id, hy, seed, u, lightX, warm) {
    const P = PL[id], r = RNG(seed + 70), end = P.sky[P.sky.length - 1][1];
    ctx.save(); ctx.filter = `blur(${26 * u}px)`; ctx.fillStyle = rgba(mix([84, 58, 90], end, warm), 0.36); ctx.fillRect(-40, hy - 36 * u, w + 80, 72 * u); ctx.restore();
    const cols = P.land.map((c) => mix(mix(c, [16, 13, 40], 0.72), c, warm));
    const rim = (a) => a * (0.15 + 0.85 * warm);
    if (id === 'heroes') {
      cone(ctx, lightX - w * 0.43, hy + 6 * u, 200 * u, 108 * u, mix(cols[0], end, 0.12 * warm), P.lit, warm, r, u, 3);
      cone(ctx, lightX - w * 0.17, hy + 8 * u, 110 * u, 50 * u, mix(cols[0], end, 0.2 * warm), P.lit, warm, r, u, 8);
      T.ridge(ctx, w, h, hy + 4 * u, 28 * u, seed, cols[0], lightX, P.lit, rim(0.45));
      T.ridge(ctx, w, h, hy + 48 * u, 26 * u, seed + 5, cols[1], lightX, P.lit, rim(0.7));
      T.ridge(ctx, w, h, hy + 102 * u, 22 * u, seed + 10, cols[2], lightX, P.lit, rim(0.9));
      for (let i = 0; i < 90 * warm; i++) { // its embers, warm again, going up
        const x = r() * w, t = r() * r(), y = hy + 90 * u - t * hy * 0.62, s = (0.7 + r() * 2.1) * u;
        ctx.fillStyle = rgba([255, 170 + r() * 60, 110], (0.25 + r() * 0.65) * (1 - t * 0.7)); ctx.beginPath(); ctx.ellipse(x, y, s, s * 0.85, r() * 3, 0, TAU); ctx.fill();
        if (s > 2 * u) K.glow(ctx, x, y, s * 6, [255, 160, 90], 0.3);
      }
    } else {
      cloudbank(ctx, w, h, hy + 4 * u, 20 * u, seed, cols[0], P.lit, rim(0.5), u, lightX);
      cloudbank(ctx, w, h, hy + 56 * u, 24 * u, seed + 5, cols[1], P.lit, rim(0.7), u, lightX);
      cloudbank(ctx, w, h, hy + 118 * u, 26 * u, seed + 10, cols[2], P.lit, rim(0.85), u, lightX);
    }
  }

  // ---- 1. DAYBREAK
  const A = {
    phone: { horizon: 0.76, sun: 0.7, B: { x: 0.09, y: 0.165, w: 0.8 }, eko: [0.72, 0.6, 0.5], hint: [0.5, 0.955, 'center'] },
    desktop: { horizon: 0.74, sun: 0.66, B: { x: 0.07, y: 0.2, w: 0.34 }, eko: [0.66, 0.47, 0.64], hint: [0.66, 0.93, 'center'] }
  };
  function daybreak(ctx, w, h, S, dev) {
    const L = A[dev], P = PL[S.id], u = dev === 'phone' ? 2 : 1.15, seed = S.id.length * 131 + (dev === 'phone' ? 3 : 4), r = RNG(seed + 50);
    const ph = S.phase == null ? 1 : S.phase; // a clear: how far the flood has got, 0..1
    const f = S.cleared ? ph : S.pct / 100;
    const blaze = S.cleared ? (S.first ? 1 : 0.4) * smooth((ph - 0.75) / 0.25) : 0;
    const warm = S.cleared ? 0.2 + 0.8 * smooth(ph) : S.home ? 1 : 0.1 + 0.22 * f;
    const hy = h * L.horizon;
    floodSky(ctx, w, h, P, S.home ? 1 : f, L.horizon, L.sun, seed, u, blaze);
    if (!S.cleared) K.glow(ctx, w * L.sun, hy, 380 * u, P.lit, 0.22 + 0.2 * f, 'screen');
    land(ctx, w, h, S.id, hy, seed, u, w * L.sun, warm);
    // Eko: after a clear he is up in the new light; after a fall he is back near the ground, waiting
    const [ex, ey, es] = S.cleared ? L.eko : [L.eko[0] - 0.04, L.horizon - 0.075, L.eko[2] * 0.62];
    K.glow(ctx, w * ex, hy + 30 * u, 260 * u * es, [255, 170, 100], 0.2, 'screen');
    T.eko(ctx, w * ex, h * ey, es * u, r, { wisp: true, lean: S.cleared ? 0.3 : 0.12 });
    T.finish(ctx, w, h, seed + 9, 0.45);
    const upto = !S.cleared || ph >= 1 ? 9 : ph > 0.5 ? 1 : 0;
    words(ctx, w, h, S, L.B, u, upto);
    if (upto >= 9) {
      write(ctx, 'tap, for one more orbit', w * L.hint[0], h * L.hint[1], 17.5 * u, { align: L.hint[2], alpha: 0.86 });
      write(ctx, 'up to the galaxy', w - 22 * u, (dev === 'phone' ? 64 : 40) * u, 15.5 * u, { align: 'right', alpha: 0.66 });
    }
  }

  // ---- 2. THE ORBIT
  const O = {
    phone: { p: [0.56, 0.705, 100], la: 205, B: { x: 0.09, y: 0.135, w: 0.8, air: 0.3 }, hint: [0.5, 0.962, 'center'] },
    desktop: { p: [0.67, 0.53, 138], la: 200, B: { x: 0.07, y: 0.2, w: 0.3, air: 0.3 }, hint: [0.07, 0.9, 'left'] }
  };
  function orbit(ctx, w, h, S, dev) {
    const L = O[dev], P = PL[S.id], u = dev === 'phone' ? 2 : 1.15, seed = S.id.length * 173 + (dev === 'phone' ? 5 : 6), r = RNG(seed);
    T.sky(ctx, w, h, [[0, [6, 7, 22]], [0.5, mix([20, 18, 54], P.dark, 0.4)], [1, mix([30, 22, 64], P.base, S.cleared ? 0.42 : 0.2)]], r, 150);
    T.stars(ctx, w, h, r, Math.round((w * h) / 700), seed);
    const px = w * L.p[0], py = h * L.p[1], R = L.p[2] * u, r1 = R * 1.52, r2 = R * 1.96;
    const k = S.cleared ? 0 : S.home ? 0 : 0.6; // an unrestored world is still mostly night
    if (S.cleared) { // its colour, out into the dark round it
      for (let i = 0; i < 16; i++) K.glow(ctx, px + (r() - 0.5) * R * 5.5, py + (r() - 0.5) * R * 5.5, R * (1.5 + r() * 2.6), mix(P.base, P.aur[i % 3], r()), 0.16, 'screen');
      ctx.save(); ctx.globalCompositeOperation = 'screen';
      ctx.filter = `blur(${7 * u}px)`;
      for (let i = 0; i < 13; i++) { const a = (i / 13) * TAU + r() * 0.4, hw = 0.04 + r() * r() * 0.16, len = R * (2.6 + r() * 4); const g = ctx.createRadialGradient(px, py, R * 0.6, px, py, len); g.addColorStop(0, rgba(mix(P.aur[i % 3], [255, 255, 255], 0.15), S.first ? 0.3 : 0.12)); g.addColorStop(1, rgba(P.base, 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + Math.cos(a - hw) * len, py + Math.sin(a - hw) * len); ctx.lineTo(px + Math.cos(a + hw) * len, py + Math.sin(a + hw) * len); ctx.closePath(); ctx.fill(); }
      ctx.restore();
    }
    T.sphere(ctx, px, py, R, mix(P.base, NIGHT, k), mix(P.lit, [40, 34, 90], k), P.dark, L.la, r, { bands: k > 0.5 ? [] : P.bands, haze: 0.36 * (1 - k), rim: 0.9 * (1 - k * 0.7) });
    // the two rings of the course, faintly; then the run itself, drawn as far as it got
    ctx.save(); ctx.lineCap = 'round';
    for (const rr of [r1, r2]) { ctx.strokeStyle = 'rgba(255,238,214,0.2)'; ctx.lineWidth = 1.3 * u; ctx.beginPath(); ctx.arc(px, py, rr, 0, TAU); ctx.stroke(); }
    ctx.restore();
    const a0 = -Math.PI / 2, a1 = a0 + TAU * (S.pct / 100) - (S.pct >= 100 ? 0.16 : 0), trail = [];
    for (let a = a0; a <= a1; a += 0.05) trail.push([px + Math.cos(a) * r1, py + Math.sin(a) * r1]);
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    K.brush(ctx, trail, 22 * u, [255, 170, 100], r, { passes: 9, alpha: 0.13, spread: 0.6 });
    K.brush(ctx, trail, 8 * u, [255, 226, 180], r, { passes: 6, alpha: 0.3, spread: 0.5 });
    ctx.restore();
    ctx.save(); ctx.lineCap = 'round'; ctx.shadowColor = 'rgba(255,200,130,0.95)'; ctx.shadowBlur = 12 * u; ctx.strokeStyle = 'rgba(255,244,222,0.95)'; ctx.lineWidth = 2.2 * u; ctx.beginPath(); ctx.arc(px, py, r1, a0, a1); ctx.stroke(); ctx.restore();
    // where the drop is, as a small mark across the ring with its name
    const da = a0 + TAU * S.drop, dx = Math.cos(da), dy = Math.sin(da);
    ctx.strokeStyle = 'rgba(255,241,216,0.85)'; ctx.lineWidth = 2 * u; ctx.beginPath(); ctx.moveTo(px + dx * (r1 - 9 * u), py + dy * (r1 - 9 * u)); ctx.lineTo(px + dx * (r1 + 9 * u), py + dy * (r1 + 9 * u)); ctx.stroke();
    write(ctx, 'the drop', px + dx * (r1 + 16 * u), py + dy * (r1 + 16 * u) + 5 * u, 13.5 * u, { align: dx > 0 ? 'left' : 'right', alpha: 0.7, color: SAND });
    // the three shards, out on the far ring where their branches were
    S.at.forEach((t, i) => { const a = a0 + TAU * t; dab(ctx, px + Math.cos(a) * r2, py + Math.sin(a) * r2, 6 * u, !!S.shards[i], !!(S.fresh && S.fresh[i])); });
    // Eko at the end of the arc: home again at the top after a clear, or where he fell
    const ex = px + Math.cos(a1) * r1, ey = py + Math.sin(a1) * r1;
    T.eko(ctx, ex, ey + 4 * u, 0.2 * u, r, { wisp: false, lean: -0.5 });
    T.finish(ctx, w, h, seed + 9, 0.5);
    words(ctx, w, h, S, L.B, u, 9);
    write(ctx, 'tap, for one more orbit', w * L.hint[0], h * L.hint[1], 17.5 * u, { align: L.hint[2], alpha: 0.86 });
    write(ctx, 'out to the galaxy', w - 22 * u, (dev === 'phone' ? 64 : 40) * u, 15.5 * u, { align: 'right', alpha: 0.66 });
  }

  // ---- 3. THE GALAXY
  const G = {
    phone: { p: [0.36, 0.43, 104], next: [0.77, 0.185, 56], far: [0.2, 0.075, 28], hollow: [0.95, 0.0, 0.5, 0.07], lamp: [-0.25, 1.0], eko: [0.7, 0.36, 0.3], B: { x: 0.09, y: 0.625, w: 0.84, k: 0.8, air: 0.5 }, hint: [0.09, 0.943], home: [0.945, 0.976] },
    desktop: { p: [0.3, 0.56, 150], next: [0.72, 0.3, 74], far: [0.84, 0.64, 40], hollow: [1.0, 0.0, 0.26, 0.2], lamp: [-0.1, 1.2], eko: [0.47, 0.34, 0.34], B: { x: 0.47, y: 0.5, w: 0.3, k: 0.9, air: 0.4 }, hint: [0.47, 0.93], home: [0.975, 0.955] }
  };
  function galaxy(ctx, w, h, S, dev) {
    const L = G[dev], P = PL[S.id], N = PL.skyhigh, F = PL.blank, u = dev === 'phone' ? 2 : 1.15, seed = S.id.length * 191 + (dev === 'phone' ? 7 : 8), r = RNG(seed);
    T.sky(ctx, w, h, [[0, [9, 10, 34]], [0.5, [30, 26, 78]], [0.82, [70, 42, 100]], [1, [112, 58, 104]]], r, 170);
    T.stars(ctx, w, h, r, Math.round((w * h) / 900), seed);
    // the Hollow, at the edge of the picture: still there, still dark
    const [hx, hyy, hrx, hry] = [w * L.hollow[0], h * L.hollow[1], w * L.hollow[2], h * L.hollow[3]];
    ctx.save(); ctx.filter = `blur(${18 * u}px)`; ctx.fillStyle = 'rgba(3,3,10,0.97)'; ctx.beginPath(); ctx.ellipse(hx, hyy, hrx, hry, 0, 0, TAU); ctx.fill(); ctx.restore();
    for (let i = 0; i < 40; i++) { const x0 = hx - hrx * 0.95 + r() * hrx * 1.9, len = hry * (0.9 + r() * 1.3); K.brush(ctx, [[x0, hyy - hry * 0.4], [x0 + (hx - x0) * 0.08, hyy + len * 0.4], [x0 + (r() - 0.5) * 40 * u, hyy + len]], (14 + r() * 28) * u, mix([8, 7, 20], [70, 56, 120], r() * r()), r, { passes: 3, alpha: 0.2 }); }
    const px = w * L.p[0], py = h * L.p[1], R = L.p[2] * u, lamp = [w * L.lamp[0], h * L.lamp[1]];
    const nx = w * L.next[0], ny = h * L.next[1], nR = L.next[2] * u;
    // the Lantern's beam has found it: a wide, warm volume of light from below
    ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.filter = `blur(${14 * u}px)`;
    { const ang = Math.atan2(py - lamp[1], px - lamp[0]), d0 = Math.hypot(py - lamp[1], px - lamp[0]), d = d0 * 2.2, hw = Math.min(0.3, (R * 1.3) / d0); const g = ctx.createLinearGradient(lamp[0], lamp[1], lamp[0] + Math.cos(ang) * d, lamp[1] + Math.sin(ang) * d); g.addColorStop(0, rgba(P.lit, 0.6)); g.addColorStop(0.45, rgba(P.lit, 0.3)); g.addColorStop(0.62, rgba(P.lit, 0.08)); g.addColorStop(1, rgba(P.lit, 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(lamp[0], lamp[1]); ctx.lineTo(lamp[0] + Math.cos(ang - hw) * d, lamp[1] + Math.sin(ang - hw) * d); ctx.lineTo(lamp[0] + Math.cos(ang + hw) * d, lamp[1] + Math.sin(ang + hw) * d); ctx.closePath(); ctx.fill(); }
    ctx.restore();
    for (let i = 0; i < 12; i++) K.glow(ctx, px + (r() - 0.5) * R * 4.4, py + (r() - 0.5) * R * 4.4, R * (1.3 + r() * 2), mix(P.base, P.aur[i % 3], r()), 0.085, 'screen');
    // the road on to the next world, now lit; and past it, not yet
    const fx = w * L.far[0], fy = h * L.far[1], fR = L.far[2] * u;
    const road = (ax, ay, bx, by, a, bendK) => { const n = Math.round(Math.hypot(bx - ax, by - ay) / (17 * u)); for (let i = 1; i < n; i++) { const t = i / n, bend = Math.sin(t * Math.PI) * 44 * u * bendK; ctx.fillStyle = rgba([255, 226, 170], a); ctx.beginPath(); ctx.ellipse(lerp(ax, bx, t) + bend * 0.5, lerp(ay, by, t) + bend, 2.7 * u, 2 * u, r() * 3, 0, TAU); ctx.fill(); if (a > 0.5 && i % 3 === 0) K.glow(ctx, lerp(ax, bx, t) + bend * 0.5, lerp(ay, by, t) + bend, 14 * u, [255, 214, 150], 0.3); } };
    road(px, py, nx, ny, 0.85, 1); road(nx, ny, fx, fy, 0.22, -1);
    const la = (x, y) => Math.atan2(lamp[1] - y, lamp[0] - x) / D;
    T.sphere(ctx, fx, fy, fR, mix(F.base, NIGHT, 0.78), mix(F.lit, [40, 34, 90], 0.78), F.dark, la(fx, fy), r, { bands: [], haze: 0.04, rim: 0.14 });
    T.sphere(ctx, nx, ny, nR, mix(N.base, NIGHT, 0.42), mix(N.lit, [40, 34, 90], 0.42), N.dark, la(nx, ny), r, { bands: N.bands, haze: 0.16, rim: 0.55 });
    T.sphere(ctx, px, py, R, P.base, P.lit, P.dark, la(px, py), r, { bands: P.bands, haze: 0.4, rim: 0.95 });
    T.eko(ctx, w * L.eko[0], h * L.eko[1], L.eko[2] * u, r, { wisp: true, lean: 0.3 });
    T.finish(ctx, w, h, seed + 9, 0.5);
    const tx = nx - nR - 16 * u;
    write(ctx, N.name, tx, ny + 2 * u, 24 * u, { align: 'right' });
    write(ctx, 'the way is lit', tx, ny + 23 * u, 14.5 * u, { align: 'right', alpha: 0.75, color: SAND });
    write(ctx, F.name, fx + fR + 14 * u, fy + 2 * u, 20 * u, { alpha: 0.5 });
    write(ctx, 'dark and silent', fx + fR + 14 * u, fy + 20 * u, 13.5 * u, { alpha: 0.45, color: SAND });
    words(ctx, w, h, S, L.B, u, 9);
    write(ctx, 'tap it again, for one more orbit', w * L.hint[0], h * L.hint[1], 17.5 * u, { alpha: 0.86 });
    write(ctx, 'down to the horizon', w * L.home[0], h * L.home[1], 14.5 * u, { align: 'right', alpha: 0.55, color: SAND });
  }

  // ---- the runs shown
  const RUNS = {
    // a first clear of Emberwick, with two of its three shards
    first: { id: 'heroes', cleared: true, first: true, pct: 100, drop: 0.58, at: [0.2, 0.46, 0.8], shards: [1, 1, 0], fresh: [1, 1, 0], shardLine: 'two lens shards kept', lines: ['Its song is home, and its colour with it.', 'The way to Cirra is lit.'] },
    // a run on Cirra left at 62%, the furthest yet; its song is not home, so its sky is still cold above the tide
    left: { id: 'skyhigh', cleared: false, pct: 62, drop: 0.71, at: [0.2, 0.46, 0.8], shards: [0, 0, 0], shardLine: 'no shards yet', lines: ['Your furthest yet.', 'The colour rose this far, and waits.'] },
    // Emberwick cleared again, the last shard won, and "more about this run" opened
    again: { id: 'heroes', cleared: true, first: false, pct: 100, drop: 0.58, at: [0.2, 0.46, 0.8], shards: [1, 1, 1], fresh: [0, 0, 1], shardLine: 'all three lens shards', lines: ['The last shard is home.'],
      more: ['Attempt 12. On the beat 91%, best streak 58.', 'The drop played at full charge.', 'Your taps ran about 30 ms late.'], act: 'set it right   ·   check again, 10 s' }
  };
  const draw = (ctx, w, h, comp, run, dev, phase) => ({ daybreak, orbit, galaxy })[comp](ctx, w, h, phase == null ? RUNS[run] : { ...RUNS[run], phase }, dev);
  return { RUNS, draw };
})();
