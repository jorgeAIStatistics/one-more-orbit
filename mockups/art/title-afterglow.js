// Afterglow, step 2: the title, as three compositions, each for a phone and a desktop. It is the bottom of the same
// painting as the galaxy map: the land at dusk, the Lantern, Eko drifting, and the game's name written softly into
// the sky. A tap, Eko rises, and the camera glides up into the galaxy (shown as three frames for the first one).
/* eslint-disable */
const TITLES = (() => {
  const { TAU, lerp, RNG, rgba, mix } = K;
  const T = DUSK.tools;
  const SKY = [[0, [10, 11, 38]], [0.34, [38, 30, 90]], [0.6, [104, 52, 108]], [0.8, [214, 108, 92]], [0.92, [250, 176, 118]], [1, [255, 214, 150]]];
  /** The name, written into the sky: soft light under it, the letters themselves in cream, and an orbit of light round the big word. */
  function wordmark(ctx, x, y, size, align, a = 1) {
    const big = `italic 600 ${size}px ${T.SERIF}`, small = `italic 500 ${size * 0.34}px ${T.SERIF}`;
    ctx.save();
    ctx.font = big;
    const wBig = ctx.measureText('Orbit').width;
    const left = align === 'center' ? x - wBig / 2 : align === 'right' ? x - wBig : x;
    const cx = left + wBig * 0.5, cy = y - size * 0.3;
    const ring = (front) => { ctx.save(); ctx.translate(cx, cy); ctx.rotate(-0.13); ctx.strokeStyle = rgba([255, 232, 196], (front ? 0.85 : 0.3) * a); ctx.lineWidth = Math.max(1.5, size * 0.016); ctx.shadowColor = 'rgba(255,190,120,0.9)'; ctx.shadowBlur = size * 0.1; ctx.beginPath(); ctx.ellipse(0, 0, wBig * 0.68, size * 0.36, 0, front ? 0.2 : Math.PI + 0.1, front ? Math.PI - 0.5 : TAU - 0.1); ctx.stroke(); ctx.restore(); };
    ring(false);
    for (const [blur, al] of [[size * 0.5, 0.5], [size * 0.16, 0.6]]) { ctx.shadowColor = `rgba(255,170,110,${al * a})`; ctx.shadowBlur = blur; ctx.fillStyle = `rgba(255,240,214,${0.5 * a})`; ctx.font = big; ctx.textAlign = 'left'; ctx.fillText('Orbit', left, y); }
    ctx.shadowBlur = size * 0.05; ctx.shadowColor = 'rgba(40,16,50,0.5)';
    ctx.fillStyle = `rgba(255,244,224,${0.97 * a})`; ctx.fillText('Orbit', left, y);
    ctx.font = small; ctx.fillStyle = `rgba(255,236,206,${0.9 * a})`;
    try { ctx.letterSpacing = `${size * 0.03}px`; } catch (e) { /* older engines */ }
    ctx.fillText('one more', left + size * 0.07, y - size * 0.86);
    ctx.restore();
    ring(true);
    const bx = cx + Math.cos(-0.13 + 2.5) * wBig * 0.68, by = cy + Math.sin(2.5) * size * 0.36; // a spark on the orbit: where Eko has just been
    K.glow(ctx, bx, by, size * 0.2, [255, 214, 150], 0.7 * a); ctx.fillStyle = `rgba(255,248,230,${a})`; ctx.beginPath(); ctx.arc(bx, by, Math.max(2, size * 0.022), 0, TAU); ctx.fill();
  }
  function scene(ctx, w, h, L, seed, rise = 0) {
    const r = RNG(seed), u = L.u;
    T.sky(ctx, w, h, SKY.map(([t, c]) => [Math.min(1, t * (L.horizon + rise * 0.6) / 0.86), c]), r, 170);
    T.stars(ctx, w, h * (L.horizon - 0.12 + rise * 0.5), r, Math.round((w * h) / 900), seed);
    const drop = rise * h * 0.62; // as the camera rises, the land sinks out of the picture
    const hy = h * L.horizon + drop;
    // the last of the day: a low bright place on the horizon, and its light lying along the sky's edge
    K.glow(ctx, w * L.sun, hy + 10 * u, 520 * u, [255, 196, 130], 0.5, 'screen');
    ctx.save(); ctx.filter = `blur(${26 * u}px)`; ctx.fillStyle = 'rgba(255,196,140,0.4)'; ctx.fillRect(-40, hy - 46 * u, w + 80, 70 * u); ctx.restore();
    if (rise > 0) { // the first worlds come into view above
      T.sphere(ctx, w * 0.3, h * (-0.12 + rise * 0.52), 66 * u, [214, 96, 60], [255, 190, 120], [70, 26, 50], 110, r, { bands: [[-0.2, 0.22, [255, 200, 140], 0.14]], haze: 0.3, rim: 0.8 });
      for (let k = 0; k < 16; k++) { ctx.fillStyle = rgba([255, 226, 170], 0.5); ctx.beginPath(); ctx.ellipse(w * (0.36 + k * 0.022), h * (-0.06 + rise * 0.52) - k * 9 * u, 2.6 * u, 1.9 * u, k, 0, TAU); ctx.fill(); }
    }
    if (L.beam) { // the Lantern's beam, up and out of the picture: the way to go
      const lamp = [w * L.lantern[0] - 10 * L.lantern[2] * u, h * L.lantern[1] + drop - 132 * L.lantern[2] * u];
      ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.filter = `blur(${12 * u}px)`;
      const [tx, ty] = [w * L.beam[0], h * L.beam[1]], ang = Math.atan2(ty - lamp[1], tx - lamp[0]), d = Math.hypot(tx - lamp[0], ty - lamp[1]);
      const g = ctx.createLinearGradient(lamp[0], lamp[1], tx, ty); g.addColorStop(0, 'rgba(255,220,160,0.55)'); g.addColorStop(1, 'rgba(255,200,170,0.04)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(lamp[0], lamp[1]); ctx.lineTo(lamp[0] + Math.cos(ang - 0.17) * d, lamp[1] + Math.sin(ang - 0.17) * d); ctx.lineTo(lamp[0] + Math.cos(ang + 0.17) * d, lamp[1] + Math.sin(ang + 0.17) * d); ctx.closePath(); ctx.fill(); ctx.restore();
    }
    if (rise < 0.9) wordmark(ctx, w * L.title[0], h * L.title[1] + drop * 0.5, L.title[2] * u, L.title[3], 1 - rise * 1.7 > 0 ? 1 - rise * 1.7 : 0);
    // the land: ridge behind ridge, each darker and nearer, with the last light on its crest
    L.ridges.forEach(([dy, amp, c, rim], i) => T.ridge(ctx, w, h + drop, hy + dy * u, amp * u, seed + i * 7, c, w * L.sun, [255, 214, 150], rim));
    const [lx, ly, ls] = [w * L.lantern[0], h * L.lantern[1] + drop, L.lantern[2] * u];
    K.glow(ctx, lx - 10 * ls, ly - 132 * ls, 150 * ls, [255, 214, 150], 0.6);
    T.lighthouse(ctx, lx, ly, ls, r);
    if (L.near) T.ridge(ctx, w, h + drop, hy + L.near[0] * u, L.near[1] * u, seed + 40, [12, 8, 26], w * L.eko[0], [255, 190, 120], 0.9);
    // Eko, drifting; his light on whatever is under him. Rising, he leans into it and his wisp trails long.
    const ex = w * lerp(L.eko[0], 0.5, rise * 0.6), ey = h * (L.eko[1] - rise * 0.2);
    K.glow(ctx, ex, Math.min(h, hy + 30 * u), 260 * u * L.eko[2], [255, 170, 100], 0.2 * (1 - rise), 'screen');
    T.eko(ctx, ex, ey, L.eko[2] * u * (1 - rise * 0.25), r, { wisp: true, lean: rise > 0 ? 0.05 : L.eko[3] || 0.25 });
    if (rise === 0) K.text(ctx, L.hint[2], w * L.hint[0], h * L.hint[1], `italic 500 ${15.5 * u}px ${T.SERIF}`, '#fff1d8', { align: L.hint[3] || 'center', alpha: 0.72 });
    T.finish(ctx, w, h, seed + 9, 0.5);
  }
  const R4 = [[0, 34, [96, 50, 96], 0.35], [40, 30, [60, 32, 76], 0.6], [86, 26, [34, 20, 54], 0.8], [140, 22, [16, 10, 32], 0.9]];
  const ph = (o) => ({ u: 2, ridges: R4, ...o }), dk = (o) => ({ u: 1.15, ridges: R4, ...o });
  // phone: 780 x 1688. desktop: 1440 x 900. Positions are fractions of the picture.
  const LAYOUTS = {
    // 1. THE HORIZON: a wide, quiet dusk. The land is a low band, the name is large in the open sky, Eko is small
    //    and drifting where the last light is, and the Lantern is far off: a long way to go.
    horizon: {
      phone: ph({ horizon: 0.8, sun: 0.66, title: [0.5, 0.33, 108, 'center'], eko: [0.66, 0.62, 0.52, 0.3], lantern: [0.16, 0.826, 0.5], hint: [0.5, 0.945, 'tap, and rise', 'center'] }),
      desktop: dk({ horizon: 0.78, sun: 0.7, title: [0.1, 0.44, 170, 'left'], eko: [0.72, 0.5, 0.6, 0.3], lantern: [0.9, 0.81, 0.62], hint: [0.105, 0.56, 'tap, and rise', 'left'] })
    },
    // 2. THE LANTERN: close under the lighthouse on its hill. Its beam climbs out of the top of the picture, the way
    //    the camera will go; the name is written in the sky beside the light, and Eko waits near the lamp.
    lantern: {
      phone: ph({ horizon: 0.86, sun: 0.2, title: [0.08, 0.3, 104, 'left'], eko: [0.3, 0.58, 0.42, -0.2], lantern: [0.74, 0.89, 2.0], beam: [0.04, -0.1], near: [60, 30], hint: [0.09, 0.365, 'tap, and rise', 'left'] }),
      desktop: dk({ horizon: 0.84, sun: 0.22, title: [0.08, 0.46, 170, 'left'], eko: [0.56, 0.44, 0.5, -0.2], lantern: [0.8, 0.88, 2.2], beam: [0.2, -0.3], near: [70, 30], hint: [0.085, 0.585, 'tap, and rise', 'left'] })
    },
    // 3. THE SPARK: Eko close, the only warm thing in a dark foreground, lighting the ground he drifts over. The name
    //    is small and high: the picture is his.
    spark: {
      phone: ph({ horizon: 0.78, sun: 0.5, title: [0.5, 0.17, 84, 'center'], eko: [0.5, 0.56, 1.0, 0.25], lantern: [0.86, 0.8, 0.42], near: [90, 40], hint: [0.5, 0.945, 'tap, and rise', 'center'] }),
      desktop: dk({ horizon: 0.76, sun: 0.62, title: [0.08, 0.3, 120, 'left'], eko: [0.62, 0.5, 1.05, 0.25], lantern: [0.93, 0.78, 0.5], near: [100, 40], hint: [0.085, 0.4, 'tap, and rise', 'left'] })
    }
  };
  const SEED = { horizon: 401, lantern: 503, spark: 607 };
  return { LAYOUTS, draw: (ctx, w, h, name, dev, rise = 0) => scene(ctx, w, h, LAYOUTS[name][dev], SEED[name] + (dev === 'phone' ? 0 : 1), rise) };
})();
