// The canon (the owner's story): Orbin and Helion, the Stillness, the guardian, and the opening as written.
// Character designs and animatic stills in the Afterglow hand. Nothing here is in the game yet.
// Needs kit.js and a-dusk.js. Phone stills are 780 x 1688 (a 390 x 844 phone at 2x); sheets are built by the page.
/* eslint-disable */
const CANON = (() => {
  const { TAU, lerp, RNG, rgba, mix, clamp } = K;
  const T = DUSK.tools;
  const SERIF = `"Cormorant Garamond", ${T.SERIF}`;
  const VOID = [[0, [2, 2, 8]], [0.6, [5, 6, 16]], [1, [10, 12, 26]]];
  const DRIFT = [[0, [4, 5, 14]], [0.5, [10, 14, 34]], [0.85, [22, 28, 58]], [1, [34, 40, 76]]];        // the quiet galaxy: blue-grey, no warmth
  const WOKEN = [[0, [10, 10, 40]], [0.45, [34, 40, 110]], [0.78, [120, 70, 130]], [0.93, [240, 150, 100]], [1, [255, 214, 140]]]; // where a star has been woken
  const NEBULA = [[0, [60, 30, 20]], [0.35, [170, 90, 40]], [0.7, [250, 180, 80]], [1, [255, 236, 170]]]; // the Harmonic Nebula, remembered: all gold
  const STONE = [70, 82, 108], STONE_D = [26, 32, 52], GOLD = [255, 214, 130];
  const smooth = (x) => { const t = clamp(x, 0, 1); return t * t * (3 - 2 * t); };
  const words = (ctx, s, x, y, px, o = {}) => { const { align = 'left', alpha = 0.96, color = '#fff1d8' } = o; ctx.save(); ctx.font = `italic 500 ${px}px ${SERIF}`; ctx.textAlign = align; ctx.shadowColor = 'rgba(4,4,14,0.9)'; ctx.shadowBlur = px * 0.5; ctx.globalAlpha = alpha; ctx.fillStyle = color; ctx.fillText(s, x, y); ctx.fillText(s, x, y); ctx.restore(); };

  // ------------------------------------------------------------------ the twins
  const WHO = {
    // Orbin: golden, the smaller of the two, a little fragile. A thin orbit tilted round his head, with one bead on it.
    orbin: { top: [255, 240, 186], low: [246, 164, 70], core: [255, 252, 234], aura: [255, 204, 112], eye: [58, 26, 22], k: 1, wide: 1 },
    // Helion: the warm one, sun-like. Taller, broader in the mantle, a corona behind his head, a bigger heart of light.
    helion: { top: [255, 226, 140], low: [255, 108, 36], core: [255, 252, 240], aura: [255, 140, 50], eye: [74, 22, 12], k: 1.24, wide: 1.2 }
  };
  /**
   * A twin, drawn with his chest at (x, y). s: size (1 is about 250 px from crown to the tip of his tail for Orbin).
   * A slender figure of light: a small head with a long plume streaming from the crown, a pointed mantle on narrow
   * shoulders, long thin arms, and a body that tapers into a tail of light (he hovers; he has no feet).
   * o.who 'orbin' | 'helion'; o.glow 0..1 how alight he is; o.lean -1..1; o.face 1 | -1 which way he faces;
   * o.eyes 'open' | 'wide' | 'soft' | 'set' | 'worried' | 'closed'; o.look [-1..1, -1..1];
   * o.crest 0 (the plume hangs) .. 1 (it streams); o.arms 'rest' | 'reach' | 'up' | 'chest' | 'back';
   * o.ring false to leave his orbit off; o.beat 0..1 his heart, lit.
   */
  function spark(ctx, x, y, s, o = {}) {
    const { who = 'orbin', glow = 1, lean = 0, face = 1, eyes = 'open', look = [0, 0], crest = 1, arms = 'rest', ring = true, beat = 0.5 } = o;
    const W = WHO[who], k = W.k, g = clamp(glow, 0, 1), dim = (c) => mix([58, 52, 72], c, 0.14 + 0.86 * g), hel = who === 'helion';
    ctx.save(); ctx.translate(x, y); ctx.scale(s * k * face, s * k);
    const sk = (px, py) => [px + lean * (py + 70) * 0.34, py]; // he leans from the crown down: the tail trails
    const curve = (pts) => { ctx.beginPath(); pts.forEach(([px, py, a, b, c2, d], i) => { const [X, Y] = sk(px, py); if (!i) ctx.moveTo(X, Y); else if (a === undefined) ctx.lineTo(X, Y); else { const [p1x, p1y] = sk(a, b), [p2x, p2y] = sk(c2, d); ctx.bezierCurveTo(p1x, p1y, p2x, p2y, X, Y); } }); ctx.closePath(); };
    /** a limb or a ribbon: a curve that tapers from w0 to w1 */
    const taper = (p0, p1, p2, w0, w1, col, a = 1) => { const n = 14, L = [], R = []; for (let i = 0; i <= n; i++) { const t = i / n, u = 1 - t, px = u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], py = u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1], dx = 2 * u * (p1[0] - p0[0]) + 2 * t * (p2[0] - p1[0]), dy = 2 * u * (p1[1] - p0[1]) + 2 * t * (p2[1] - p1[1]), d = Math.hypot(dx, dy) || 1, wd = lerp(w0, w1, t) / 2; L.push([px - (dy / d) * wd, py + (dx / d) * wd]); R.push([px + (dy / d) * wd, py - (dx / d) * wd]); } ctx.beginPath(); L.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); R.reverse().forEach(([px, py]) => ctx.lineTo(px, py)); ctx.closePath(); ctx.fillStyle = rgba(col, a); ctx.fill(); };
    // the light he gives
    if (g > 0.05) { K.glow(ctx, 0, -20, 210 * (0.55 + 0.45 * g), W.aura, 0.3 * g); K.glow(ctx, 0, -10, 70, W.core, 0.28 * g * (0.6 + 0.4 * beat)); }
    const [hx, hy] = sk(0, -76);
    // Helion's corona: a thin disc of light behind his head and short rays off it, uneven, like a sun's edge
    if (hel) { ctx.save(); ctx.strokeStyle = rgba(dim([255, 214, 140]), 0.8); ctx.lineWidth = 1.6; if (g > 0.3) { ctx.shadowColor = rgba(W.aura, 0.9); ctx.shadowBlur = 10; } ctx.beginPath(); ctx.arc(hx - 2, hy - 2, 31, 0, TAU); ctx.stroke(); ctx.restore(); for (let i = 0; i < 11; i++) { const a = -Math.PI * 1.08 + i * (Math.PI * 1.16 / 10), len = (i % 3 === 0 ? 20 : i % 3 === 1 ? 11 : 15) * (0.5 + 0.5 * crest); taper([hx - 2 + Math.cos(a) * 34, hy - 2 + Math.sin(a) * 34], [hx - 2 + Math.cos(a + 0.08) * (34 + len * 0.5), hy - 2 + Math.sin(a + 0.08) * (34 + len * 0.5)], [hx - 2 + Math.cos(a + 0.05) * (34 + len), hy - 2 + Math.sin(a + 0.05) * (34 + len)], 4.6, 0.4, dim(mix(W.top, W.core, 0.3)), 0.9); } }
    // the plume: from the crown, streaming back when he moves or is lit; hanging when he is low
    if (!hel) { const [cx0, cy0] = sk(-3, -98), len = 92, dx = -len * (0.45 + 0.55 * crest), dy = lerp(70, 6, crest); taper([cx0, cy0], [cx0 + dx * 0.45, cy0 - 14 * crest - 2], [cx0 + dx, cy0 + dy], 11, 0.5, dim(mix(W.top, W.low, 0.3)), 0.92); taper([cx0 + 2, cy0 + 4], [cx0 + dx * 0.4, cy0 - 4 * crest + 8], [cx0 + dx * 0.74, cy0 + dy + 14], 5, 0.3, dim(W.core), 0.6); }
    // his orbit: a thin ring tilted round the head, with one bead on it (Orbin). The far half goes behind him.
    const orbit = (front) => { if (!ring || hel) return; ctx.save(); ctx.translate(hx, hy + 2); ctx.rotate(-0.34); ctx.strokeStyle = rgba(dim([255, 244, 214]), front ? 0.95 : 0.4); ctx.lineWidth = 1.7; ctx.lineCap = 'round'; if (g > 0.3) { ctx.shadowColor = rgba(W.aura, 0.9); ctx.shadowBlur = 8; } ctx.beginPath(); ctx.ellipse(0, 0, 36, 9.5, 0, front ? 0.1 : Math.PI + 0.08, front ? Math.PI - 0.1 : TAU - 0.08); ctx.stroke(); if (front) { ctx.fillStyle = rgba(dim(W.core), 1); ctx.beginPath(); ctx.arc(-27, 6.2, 2.6, 0, TAU); ctx.fill(); } ctx.restore(); };
    orbit(false);
    const POSE = { rest: [[[-26, 6], [-21, 44]], [[26, 6], [21, 44]]], reach: [[[-25, 4], [-20, 40]], [[38, -36], [74, -58]]], up: [[[-34, -52], [-26, -104]], [[34, -52], [26, -104]]], chest: [[[-24, 4], [-5, -6]], [[24, 4], [6, -2]]], back: [[[-36, -8], [-62, 12]], [[-8, 6], [-40, 26]]] }[arms] || [[[-26, 6], [-21, 44]], [[26, 6], [21, 44]]];
    const arm = (side, [el, hd]) => { const sh = sk(side * 15 * W.wide, -32), e = sk(el[0], el[1]), h2 = sk(hd[0], hd[1]); taper(sh, e, h2, 7.4, 3, dim(mix(W.top, W.low, 0.35))); taper(h2, [h2[0] + (h2[0] - e[0]) * 0.12, h2[1] + (h2[1] - e[1]) * 0.12], [h2[0] + (h2[0] - e[0]) * 0.24, h2[1] + (h2[1] - e[1]) * 0.24], 4.4, 0.6, dim(W.top)); }; // (the hand: a small leaf of light at the end of the arm)
    arm(-1, POSE[0]);
    // the body: narrow, long, a slight curve, tapering to a tail of light with two ribbons off it
    taper(sk(-8, 60), sk(-26, 96), sk(-34 - lean * 20, 136), 9, 0.5, dim(W.low), 0.5); taper(sk(8, 64), sk(16, 104), sk(6 - lean * 26, 150), 8, 0.5, dim(W.low), 0.4);
    curve([[0, -44], [16 * W.wide, -38, 6, -44, 13 * W.wide, -42], [15 * W.wide, 18, 18 * W.wide, -20, 13 * W.wide, 0], [-4, 150, 26 * W.wide, 60, 12, 112], [-15 * W.wide, 18, -16, 104, -26 * W.wide, 58], [-16 * W.wide, -38, -13 * W.wide, 0, -18 * W.wide, -20], [0, -44, -13 * W.wide, -42, -6, -44]]);
    const bg = ctx.createLinearGradient(0, -44, 0, 150); bg.addColorStop(0, rgba(dim(W.top))); bg.addColorStop(0.5, rgba(dim(W.low))); bg.addColorStop(1, rgba(dim(W.low), 0));
    ctx.fillStyle = bg; ctx.fill();
    // the mantle: two points off the shoulders and a notch at the throat
    curve([[0, -47], [20 * W.wide, -44], [32 * W.wide, -27, 26 * W.wide, -40, 30 * W.wide, -34], [15 * W.wide, -16, 26 * W.wide, -22, 20 * W.wide, -18], [0, -26, 9, -15, 4, -22], [-15 * W.wide, -16, -4, -22, -9, -15], [-32 * W.wide, -27, -20 * W.wide, -18, -26 * W.wide, -22], [-20 * W.wide, -44, -30 * W.wide, -34, -26 * W.wide, -40]]);
    ctx.fillStyle = rgba(dim(mix(W.top, W.core, 0.4))); ctx.fill();
    // his heart: the beat lives here (and, for Orbin, his brother's signal)
    { const [qx, qy] = sk(0, -4), r = (hel ? 12 : 8.5) * (0.85 + 0.3 * beat); const cg = ctx.createRadialGradient(qx, qy, 0, qx, qy, r * 2.6); cg.addColorStop(0, rgba(W.core, 0.25 + 0.75 * g)); cg.addColorStop(0.35, rgba(W.core, (0.12 + 0.5 * g) * (0.5 + 0.5 * beat))); cg.addColorStop(1, rgba(W.core, 0)); ctx.fillStyle = cg; ctx.fillRect(qx - r * 2.6, qy - r * 2.6, r * 5.2, r * 5.2); }
    // the head: small, a drop of light drawn up to a point at the crown
    ctx.beginPath(); ctx.moveTo(hx, hy + 24); ctx.bezierCurveTo(hx + 17, hy + 22, hx + 21, hy + 2, hx + 16, hy - 12); ctx.bezierCurveTo(hx + 11, hy - 24, hx + 2, hy - 24, hx - 4, hy - 30); ctx.bezierCurveTo(hx - 8, hy - 22, hx - 19, hy - 16, hx - 19, hy); ctx.bezierCurveTo(hx - 19, hy + 14, hx - 12, hy + 24, hx, hy + 24); ctx.closePath();
    const hg = ctx.createRadialGradient(hx + 6, hy - 4, 2, hx, hy, 30); hg.addColorStop(0, rgba(dim(W.core))); hg.addColorStop(0.6, rgba(dim(W.top))); hg.addColorStop(1, rgba(dim(mix(W.top, W.low, 0.7))));
    ctx.fillStyle = hg; ctx.fill();
    // the eyes: small and low on the face, like sunspots. Dark, narrow, slanted; no mouth. Their slant and their lids do the feeling.
    const eye = (side) => {
      const ex = hx + side * 7.4 + look[0] * 2.4 + 2.6, ey = hy + 5.5 + look[1] * 2, big = eyes === 'wide' ? 1.25 : 1;
      const slant = side * ({ set: 0.42, worried: -0.4, soft: 0.1, wide: 0, open: 0.14, closed: 0.1 }[eyes] ?? 0.14), open = { set: 0.62, worried: 0.8, soft: 0.5, wide: 1.1, open: 0.86, closed: 0 }[eyes] ?? 0.86;
      ctx.save(); ctx.translate(ex, ey); ctx.rotate(-slant);
      if (eyes === 'closed') { ctx.strokeStyle = rgba(W.eye, 0.85); ctx.lineWidth = 1.5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-4.2, 0); ctx.quadraticCurveTo(0, 2.6, 4.2, 0); ctx.stroke(); ctx.restore(); return; }
      const hw = 5 * big, hh = 5 * big * open;
      ctx.beginPath(); ctx.moveTo(-hw, 0); ctx.quadraticCurveTo(0, -hh * 1.5, hw, 0); ctx.quadraticCurveTo(0, hh * 1.5, -hw, 0); ctx.closePath();
      ctx.strokeStyle = rgba(mix(W.low, [255, 110, 50], 0.4), 0.55); ctx.lineWidth = 1.5; ctx.stroke(); // the ember rim
      ctx.fillStyle = rgba(W.eye, 0.95); ctx.fill();
      ctx.restore();
    };
    eye(-1); eye(1);
    arm(1, POSE[1]);
    orbit(true);
    ctx.restore();
  }

  // ------------------------------------------------------------------ the Stillness
  /**
   * A shadow with no shape and no tempo. It has no edge of its own: where it is, things simply stop. So it is painted
   * as what it does: a dark with nothing in it, a broken rim that never repeats, and whatever it has reached held
   * mid-motion, doubled, as if the picture had skipped. near: 0 (far, a held breath) .. 1 (it is here).
   */
  function stillness(ctx, x, y, rx, ry, r, o = {}) {
    const { near = 0.6, rot = 0 } = o;
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    // the dark itself: soft at the edge, absolute inside
    ctx.save(); ctx.scale(1, ry / rx);
    const g = ctx.createRadialGradient(0, 0, rx * 0.25, 0, 0, rx); g.addColorStop(0, 'rgba(2,2,6,1)'); g.addColorStop(0.62, 'rgba(3,3,9,0.97)'); g.addColorStop(1, 'rgba(4,5,14,0)');
    ctx.fillStyle = g; ctx.fillRect(-rx, -rx, rx * 2, rx * 2); ctx.restore();
    // its rim: cold strokes of different lengths at different distances, never a ring, never in time
    ctx.lineCap = 'round';
    for (let i = 0; i < 46; i++) {
      const a = r() * TAU, d = 0.7 + r() * 0.34, len = (0.03 + r() * r() * 0.3) * (0.6 + near), ex = Math.cos(a) * rx * d, ey = Math.sin(a) * ry * d;
      ctx.strokeStyle = rgba([150, 170, 220], (0.05 + r() * 0.22) * near); ctx.lineWidth = 1 + r() * 2.2;
      ctx.beginPath(); ctx.ellipse(0, 0, rx * d, ry * d, 0, a, a + len); ctx.stroke();
      if (r() < 0.3) { ctx.fillStyle = rgba([190, 205, 240], 0.25 * near); ctx.fillRect(ex - 1, ey - 1, 2 + r() * 14, 1.6); } // a star, stopped mid-fall
    }
    // tendrils that reach out and stop: each a few stuttered copies of itself
    for (let i = 0; i < 4; i++) { // (few, and short: it is not a creature with limbs)
      const a = r() * TAU, n = 2 + Math.floor(r() * 3), reach = 0.95 + (0.1 + r() * 0.22) * near;
      for (let kk = 0; kk < n; kk++) { const off = kk * (6 + r() * 16); ctx.strokeStyle = rgba([6, 6, 16], 0.9 - kk * 0.22); ctx.lineWidth = (16 - kk * 3) * (0.6 + near * 0.6); ctx.beginPath(); ctx.moveTo(Math.cos(a) * rx * 0.7, Math.sin(a) * ry * 0.7); ctx.quadraticCurveTo(Math.cos(a + 0.3) * rx * 0.95 + off, Math.sin(a + 0.3) * ry * 0.95, Math.cos(a + 0.12) * rx * reach + off, Math.sin(a + 0.12) * ry * reach + off * 0.4); ctx.stroke(); }
    }
    ctx.restore();
  }

  // ------------------------------------------------------------------ the guardian at the galaxy's edge
  /**
   * Colossal, kneeling at the edge. Made of the same dormant star-stone as the worlds, with broken orbits for
   * shoulders and one great dull Star-Node in its chest. No face: a helm with one slit. It was this galaxy's keeper;
   * the Stillness stopped it mid-watch and wears it as a gate.
   * state: 0 dormant (head bowed) .. 1 stirring (head up, the slit lit cold) .. 2 turned on you (shadow pouring out)
   *        .. 3 reignited (its star is lit: gold, head bowed again, this time by choice)
   */
  function guardian(ctx, x, y, s, r, state = 0) {
    const cold = state >= 1 && state < 3, hot = state >= 3, up = clamp(state, 0, 1) - (hot ? 1 : 0);
    const base = hot ? [70, 52, 60] : [20, 24, 42], lit = hot ? [255, 206, 130] : [120, 150, 220], rimA = hot ? 0.8 : 0.18 + 0.22 * clamp(state, 0, 2);
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    const poly = (pts, c, a = 1) => { ctx.beginPath(); pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.closePath(); ctx.fillStyle = rgba(c, a); ctx.fill(); };
    const rim = (pts, a = rimA, w = 3) => { ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.strokeStyle = rgba(lit, a); ctx.lineWidth = w; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.beginPath(); pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.stroke(); ctx.restore(); };
    if (state >= 2 && !hot) for (let i = 0; i < 14; i++) { const a = -Math.PI * r(), len = 300 + r() * 500; K.brush(ctx, [[(r() - 0.5) * 300, -420 + r() * 300], [Math.cos(a) * len * 0.5, -300 + Math.sin(a) * len * 0.5], [Math.cos(a) * len, -300 + Math.sin(a) * len]], 30 + r() * 50, [4, 4, 12], r, { passes: 3, alpha: 0.3 }); } // the shadow it holds pours out
    if (hot) K.glow(ctx, 0, -330, 620, [255, 190, 110], 0.35);
    // the kneeling mass: one knee up, one hand on the ground
    poly([[-330, 0], [-250, -150], [-120, -220], [60, -210], [250, -120], [360, 0]], mix(base, [0, 0, 0], 0.25));          // the folded legs
    poly([[110, 0], [150, -250], [240, -300], [300, -250], [330, 0]], base);                                                 // the raised knee
    poly([[-190, -170], [-150, -470], [-60, -560], [90, -560], [190, -460], [210, -200], [40, -150], [-100, -150]], base);   // the torso
    poly([[-150, -470], [-330, -430], [-390, -300], [-350, -40], [-290, 0], [-250, -40], [-270, -280], [-190, -360]], mix(base, [0, 0, 0], 0.15)); // the arm that leans on the ground
    if (state >= 2 && !hot) poly([[190, -470], [300, -500], [420, -640], [470, -760], [540, -770], [560, -690], [470, -560], [330, -400], [230, -380]], mix(base, [0, 0, 0], 0.1)); // turned on you: the arm that lay on its knee is raised
    else poly([[190, -460], [300, -440], [330, -330], [270, -250], [220, -300], [230, -390]], mix(base, [0, 0, 0], 0.1));         // the arm on the knee
    // its shoulders: broken orbits
    ctx.save(); ctx.lineCap = 'round'; ctx.strokeStyle = rgba(mix(base, lit, hot ? 0.7 : 0.2), 0.95); ctx.lineWidth = 16;
    for (const [cx, cy, rx2, ry2, rot, a0, a1] of [[-190, -480, 150, 46, -0.35, 2.6, 5.9], [200, -470, 140, 42, 0.3, 3.6, 6.9], [-190, -480, 190, 60, -0.35, 3.3, 4.6]]) { ctx.beginPath(); ctx.ellipse(cx, cy, rx2, ry2, rot, a0, a1); ctx.stroke(); }
    ctx.restore();
    // the head: a helm with one slit. Bowed when it sleeps and when it yields; raised when the Stillness looks out of it.
    const hy = -600 - up * 34, hx = 10 + up * 14, tilt = (1 - up) * 0.34 * (hot ? 1 : 1);
    ctx.save(); ctx.translate(hx, hy); ctx.rotate(tilt);
    poly([[-58, 44], [-66, -40], [-30, -84], [34, -84], [66, -38], [58, 44], [0, 64]], mix(base, [0, 0, 0], 0.05));
    if (cold || hot) { ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = rgba(hot ? [255, 220, 150] : [150, 190, 255], hot ? 0.9 : 0.5 + 0.4 * clamp(state - 1, 0, 1)); ctx.shadowColor = rgba(lit, 0.9); ctx.shadowBlur = 24; ctx.fillRect(-40, -18, 80, 8); ctx.restore(); }
    else { ctx.fillStyle = 'rgba(4,5,12,0.9)'; ctx.fillRect(-40, -18, 80, 8); }
    rim([[-66, -40], [-30, -84], [34, -84], [66, -38]]);
    ctx.restore();
    // the great Star-Node in its chest: dull, until it is the last thing you strike
    const nx = 14, ny = -360, nr = 62;
    ctx.fillStyle = rgba(hot ? [255, 230, 170] : mix(base, [90, 100, 140], 0.5)); ctx.beginPath(); ctx.arc(nx, ny, nr, 0, TAU); ctx.fill();
    ctx.strokeStyle = rgba(hot ? [255, 255, 255] : [150, 160, 200], hot ? 0.9 : 0.35); ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(nx, ny, nr, 0, TAU); ctx.stroke();
    if (hot) { K.glow(ctx, nx, ny, 260, [255, 214, 130], 0.8); for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU; ctx.strokeStyle = rgba([255, 226, 160], 0.5); ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(nx + Math.cos(a) * (nr + 14), ny + Math.sin(a) * (nr + 14)); ctx.lineTo(nx + Math.cos(a) * (nr + 60), ny + Math.sin(a) * (nr + 60)); ctx.stroke(); } }
    // cracks: where the light (or the dark) shows through
    ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.strokeStyle = rgba(lit, hot ? 0.7 : 0.1 + 0.2 * clamp(state, 0, 2)); ctx.lineWidth = 3; ctx.lineCap = 'round';
    for (const c of [[[-120, -500], [-90, -430], [-110, -380], [-70, -300]], [[120, -520], [100, -450], [130, -400]], [[-300, -330], [-320, -220], [-300, -140]], [[230, -260], [250, -160], [220, -80]], [[-40, -210], [-80, -120], [-60, -40]]]) { ctx.beginPath(); c.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.stroke(); }
    ctx.restore();
    rim([[-150, -470], [-60, -560], [90, -560], [190, -460]]); rim([[-330, -430], [-390, -300]], rimA * 0.7); rim([[150, -250], [240, -300], [300, -250]], rimA * 0.7);
    ctx.restore();
  }
  /** The three trials, far off: shattered rings of shadow hanging in the sky, one behind another. */
  function trials(ctx, x, y, s, r, a = 1) {
    K.glow(ctx, x + 40 * s, y - 20 * s, 300 * s, [70, 84, 150], 0.3 * a, 'screen'); // a pale haze behind them: what is left of the light they shut out
    ctx.save(); ctx.translate(x, y); ctx.lineCap = 'butt';
    [[1, 0, 0, 1], [0.72, 60, -40, 0.7], [0.5, 104, -70, 0.45]].forEach(([k, dx, dy, al], n) => {
      const rr = 150 * s * k;
      for (let i = 0; i < 9; i++) { // each ring is in pieces: arcs with gaps, some slipped out of line
        if (r() < 0.22) continue;
        const a0 = (i / 9) * TAU + r() * 0.15, a1 = a0 + 0.3 + r() * 0.32, slip = r() < 0.3 ? (r() - 0.5) * 22 * s : 0;
        ctx.strokeStyle = rgba([3, 3, 10], 0.92 * al * a); ctx.lineWidth = (15 - n * 3) * s; ctx.beginPath(); ctx.ellipse(dx * s + slip, dy * s + slip * 0.4, rr, rr * 0.36, -0.3, a0, a1); ctx.stroke();
        ctx.strokeStyle = rgba([150, 170, 230], 0.34 * al * a); ctx.lineWidth = 1.6 * s; ctx.beginPath(); ctx.ellipse(dx * s + slip, dy * s + slip * 0.4 - 6 * s, rr, rr * 0.36, -0.3, a0, a1); ctx.stroke();
      }
    });
    ctx.restore();
  }

  // ------------------------------------------------------------------ the land: the planetoid, its path, its Star-Nodes
  /** The planetoid seen from just above its ground: a big curve of cracked stone. woke: 0 (dormant, blue-grey) .. 1 (in colour). */
  function ground(ctx, w, h, hy, r, woke = 0, seed = 5) {
    const R = w * 2.1, cx = w * 0.5, cy = hy + R;
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.clip();
    const g = ctx.createLinearGradient(0, hy, 0, h); g.addColorStop(0, rgba(mix(mix(STONE, [92, 110, 190], woke * 0.7), [255, 200, 130], woke * 0.25))); g.addColorStop(0.35, rgba(mix(STONE_D, [40, 44, 110], woke * 0.8))); g.addColorStop(1, rgba([8, 9, 20]));
    ctx.fillStyle = g; ctx.fillRect(0, hy - 4, w, h - hy + 4);
    const nz = K.noise2(seed);
    for (let i = 0; i < 26; i++) { // fractures
      let px = r() * w, py = hy + 20 + r() * (h - hy) * 0.9; ctx.strokeStyle = rgba(woke > 0.5 ? [255, 214, 150] : [8, 10, 22], woke > 0.5 ? 0.14 : 0.5); ctx.lineWidth = 1 + r() * 2.4; ctx.beginPath(); ctx.moveTo(px, py);
      for (let kk = 0; kk < 5; kk++) { px += (r() - 0.5) * 120; py += (r() - 0.3) * 60; ctx.lineTo(px, py); } ctx.stroke();
    }
    for (let i = 0; i < 120; i++) { const px = r() * w, py = hy + r() * (h - hy), v = K.fbm(nz, px * 0.01, py * 0.01); ctx.fillStyle = rgba(v > 0.5 ? [150, 165, 200] : [6, 8, 18], 0.05 + r() * 0.08); ctx.beginPath(); ctx.ellipse(px, py, 4 + r() * 22, 2 + r() * 7, 0, 0, TAU); ctx.fill(); }
    ctx.restore();
    // the rim of the world catches what light there is
    ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.strokeStyle = rgba(mix([120, 140, 190], [255, 210, 140], woke), 0.3 + 0.4 * woke); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, R, Math.PI * 1.2, Math.PI * 1.8); ctx.stroke(); ctx.restore();
    return { R, cx, cy };
  }
  /** A point on the path: it runs from the bottom of the picture away over the curve of the world. t: 0 (at your feet) .. 1 (the horizon). */
  const along = (w, h, hy, t, bend = 0.3) => { const e = Math.pow(t, 0.62); return [w * (0.5 + Math.sin(t * 2.9 - 0.25) * bend * (0.35 + 0.65 * t) * (1 - t * 0.35)), lerp(h * 0.985, hy + 6, e), lerp(1, 0.07, e)]; };
  /** The path of stone tiles. lit: how far along it has been woken (0..1). */
  function tiles(ctx, w, h, hy, r, lit = 0, o = {}) {
    const { n = 30, wide = 0.22 } = o;
    for (let i = n - 1; i >= 0; i--) {
      const t0 = i / n, t1 = (i + 0.82) / n, [x0, y0, s0] = along(w, h, hy, t0), [x1, y1, s1] = along(w, h, hy, t1), on = t0 < lit;
      const j0 = (r() - 0.5) * 0.05, j1 = (r() - 0.5) * 0.05; // (each stone is a little out of true)
      ctx.beginPath(); ctx.moveTo(x0 - w * (wide + j0) * s0, y0); ctx.lineTo(x0 + w * (wide - j0) * s0, y0 - 6 * s0); ctx.lineTo(x1 + w * (wide + j1) * s1, y1); ctx.lineTo(x1 - w * (wide - j1) * s1, y1 + 5 * s1); ctx.closePath();
      ctx.fillStyle = on ? rgba(mix([70, 90, 190], [255, 206, 130], 0.25 + 0.5 * r()), 0.9) : rgba(mix(STONE_D, STONE, 0.3 + r() * 0.3), 0.96); ctx.fill();
      ctx.strokeStyle = on ? 'rgba(255,236,190,0.75)' : 'rgba(150,165,205,0.22)'; ctx.lineWidth = Math.max(1, 3 * s0); ctx.stroke();
      if (on && r() < 0.8) for (const side of [-1, 1]) { // flowers of light spring up beside a woken tile
        const fx = x0 + side * w * (wide + 0.05 + r() * 0.08) * s0, fy = y0 - 4 * s0, fs = (10 + r() * 16) * s0;
        ctx.strokeStyle = 'rgba(160,230,200,0.7)'; ctx.lineWidth = Math.max(1, 2.2 * s0); ctx.beginPath(); ctx.moveTo(fx, fy); ctx.quadraticCurveTo(fx + side * fs * 0.3, fy - fs, fx + side * fs * 0.1, fy - fs * 2); ctx.stroke();
        K.glow(ctx, fx + side * fs * 0.1, fy - fs * 2, fs * 2.4, r() < 0.5 ? [255, 214, 130] : [150, 200, 255], 0.7); ctx.fillStyle = 'rgba(255,250,230,0.95)'; ctx.beginPath(); ctx.arc(fx + side * fs * 0.1, fy - fs * 2, Math.max(1.4, fs * 0.28), 0, TAU); ctx.fill();
      }
    }
  }
  /**
   * A Star-Node, set in the ground. lit 0 (dull) .. 1 (woken). cue: the golden ring that closes on it, 1 (far out)
   * .. 0 (on its edge: now). flash: it echoes the beat weakly while it sleeps.
   */
  function node(ctx, x, y, s, o = {}) {
    const { lit = 0, cue = -1, flash = 0 } = o;
    ctx.save(); ctx.translate(x, y); ctx.scale(1, 0.42); // it lies flat in the ground: seen at an angle
    ctx.fillStyle = rgba(mix([40, 48, 74], [255, 226, 150], lit)); ctx.beginPath(); ctx.arc(0, 0, 44 * s, 0, TAU); ctx.fill();
    ctx.strokeStyle = rgba(mix([150, 165, 205], [255, 255, 255], Math.max(lit, flash)), 0.5 + 0.5 * Math.max(lit, flash)); ctx.lineWidth = 5 * s; ctx.beginPath(); ctx.arc(0, 0, 44 * s, 0, TAU); ctx.stroke();
    ctx.fillStyle = rgba(mix([86, 98, 136], [255, 255, 255], Math.max(lit, flash * 0.7))); for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * TAU / 5; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 26 * s, Math.sin(a) * 26 * s); ctx.lineTo(Math.cos(a + 0.5) * 9 * s, Math.sin(a + 0.5) * 9 * s); ctx.lineTo(0, 0); ctx.lineTo(Math.cos(a - 0.5) * 9 * s, Math.sin(a - 0.5) * 9 * s); ctx.closePath(); ctx.fill(); } // the star cut into it (five soft points)
    if (cue >= 0) { ctx.strokeStyle = rgba(GOLD, 0.95 - cue * 0.45); ctx.lineWidth = (4.5 - cue * 1.5) * s; ctx.shadowColor = 'rgba(255,200,110,0.9)'; ctx.shadowBlur = 12 * s; ctx.beginPath(); ctx.arc(0, 0, (44 + 4 + cue * 120) * s, 0, TAU); ctx.stroke(); }
    ctx.restore();
    if (lit > 0 || flash > 0) K.glow(ctx, x, y, 150 * s * (0.4 + 0.6 * Math.max(lit, flash)), GOLD, 0.55 * Math.max(lit, flash * 0.5));
  }
  const dust = (ctx, x, y, R, r, n, c = GOLD) => { for (let i = 0; i < n; i++) { const a = r() * TAU, d = Math.pow(r(), 0.6) * R; ctx.fillStyle = rgba(mix(c, [255, 255, 255], r() * 0.6), 0.3 + r() * 0.7); ctx.beginPath(); ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.8, 1 + r() * 4, 0, TAU); ctx.fill(); } };
  const timing = (ctx, w, s, t) => words(ctx, t, w - 22 * s, 30 * s, 13 * s, { align: 'right', alpha: 0.7, color: '#e6cfae' });

  // ------------------------------------------------------------------ the opening, as written: animatic stills (780 x 1688)
  const PW = 780, PH = 1688, U = 2;
  const A = {
    a1(ctx) { const r = RNG(11), w = PW, h = PH; T.sky(ctx, w, h, VOID, r, 30); // pitch black: no stars at all
      const hy = h * 0.8; ground(ctx, w, h, hy, RNG(12), 0);
      K.brush(ctx, [[60, 250], [190, 380], [300, 520]], 5, [255, 190, 110], r, { passes: 5, alpha: 0.25 }); dust(ctx, 180, 380, 150, r, 26);
      K.glow(ctx, 330, 560, 60, [255, 200, 120], 0.5); ctx.fillStyle = 'rgba(255,236,190,0.95)'; ctx.beginPath(); ctx.arc(330, 560, 5, 0, TAU); ctx.fill();
      T.finish(ctx, w, h, 21, 0.7); timing(ctx, w, U, '0:00 to 0:06  ·  silence, a low hollow wind'); },
    a2(ctx) { const r = RNG(13), w = PW, h = PH; T.sky(ctx, w, h, VOID, r, 30); const hy = h * 0.62; ground(ctx, w, h, hy, RNG(12), 0);
      // he has rolled to a stop: lying on the stone, his light almost out
      ctx.save(); ctx.translate(400, hy + 150); ctx.rotate(1.25); spark(ctx, 0, 0, 1.25, { glow: 0.12, eyes: 'closed', crest: 0, arms: 'rest', ring: false }); ctx.restore();
      ctx.strokeStyle = 'rgba(230,220,200,0.2)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(470, hy + 196, 62, 14, 0.1, 0, TAU); ctx.stroke(); // his ring, come off, lying by him
      T.finish(ctx, w, h, 22, 0.72); timing(ctx, w, U, '0:06 to 0:10  ·  his light flickers, dims, almost goes out'); },
    a3(ctx) { const r = RNG(14), w = PW, h = PH; T.sky(ctx, w, h, VOID, r, 30); const hy = h * 0.62; ground(ctx, w, h, hy, RNG(12), 0.04);
      // thump-thump: the light flares, he is upright, turning to the horizon
      for (let k = 0; k < 2; k++) { ctx.strokeStyle = rgba(GOLD, 0.4 - k * 0.2); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(390, hy + 60, 120 + k * 70, 0, TAU); ctx.stroke(); }
      spark(ctx, 390, hy + 70, 1.5, { glow: 0.85, eyes: 'wide', look: [0.8, -0.6], crest: 0.9, arms: 'chest', lean: 0.12, beat: 1 });
      T.finish(ctx, w, h, 23, 0.62); timing(ctx, w, U, '0:10 to 0:13  ·  thump-thump. A music box, as if from under an ocean'); },
    a4(ctx) { const r = RNG(15), w = PW, h = PH; T.sky(ctx, w, h, VOID.map(([t, c]) => [t, mix(c, [14, 16, 40], 0.5)]), r, 60); const hy = h * 0.74;
      // far across the dark: three shattered rings of shadow, the guardian under them, and behind them one pulse of gold
      K.glow(ctx, 470, 520, 34, [255, 200, 110], 0.95); ctx.fillStyle = '#fff3cf'; ctx.beginPath(); ctx.arc(470, 520, 4, 0, TAU); ctx.fill(); for (let k = 0; k < 2; k++) { ctx.strokeStyle = rgba(GOLD, 0.5 - k * 0.25); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(470, 520, 30 + k * 26, 0, TAU); ctx.stroke(); }
      trials(ctx, 430, 540, 1.5, RNG(41));
      for (let i = 0; i < 9; i++) K.brush(ctx, [[260 + r() * 360, 470 + r() * 150], [300 + r() * 320, 500 + r() * 150]], 60, [6, 7, 18], r, { passes: 3, alpha: 0.2 }); // dark mist, closing over it
      guardian(ctx, 440, hy + 4, 0.36, RNG(42), 0);
      ground(ctx, w, h, hy, RNG(12), 0.04);
      spark(ctx, 250, hy + 190, 1.35, { glow: 0.8, eyes: 'worried', look: [1, -0.5], crest: 0.8, arms: 'reach', lean: 0.2, face: 1 });
      T.finish(ctx, w, h, 24, 0.6); words(ctx, 'He’s still out there.', w / 2, h * 0.24, 46, { align: 'center' }); timing(ctx, w, U, '0:13 to 0:20  ·  Helion pulses once, and is swallowed'); },
    a5(ctx) { const r = RNG(16), w = PW, h = PH; T.sky(ctx, w, h, DRIFT, r, 70); const hy = h * 0.42;
      trials(ctx, 520, hy - 150, 0.6, RNG(41), 0.8); guardian(ctx, 560, hy + 2, 0.13, RNG(42), 0);
      ground(ctx, w, h, hy, RNG(17), 0.04); tiles(ctx, w, h, hy, RNG(18), 0);
      const [nx, ny, ns] = along(w, h, hy, 0.2); node(ctx, nx, ny, 1.5 * ns * 1.4, { lit: 0 });
      spark(ctx, w * 0.5, h * 0.9, 1.7, { glow: 0.75, eyes: 'open', crest: 0.8, arms: 'rest', face: 1, look: [0, -0.8] });
      T.finish(ctx, w, h, 25, 0.55); timing(ctx, w, U, '0:20 to 0:24  ·  the camera comes down behind him'); },
    a6(ctx) { const r = RNG(16), w = PW, h = PH; T.sky(ctx, w, h, DRIFT, r, 70); const hy = h * 0.42;
      trials(ctx, 520, hy - 150, 0.6, RNG(41), 0.8); guardian(ctx, 560, hy + 2, 0.13, RNG(42), 0);
      ground(ctx, w, h, hy, RNG(17), 0.04); tiles(ctx, w, h, hy, RNG(18), 0);
      const [nx, ny, ns] = along(w, h, hy, 0.2); node(ctx, nx, ny, 2.1 * ns, { lit: 0, flash: 0.7 });
      ctx.save(); ctx.translate(w * 0.5, h * 0.84); ctx.scale(1, 0.42); for (let k = 0; k < 2; k++) { ctx.strokeStyle = rgba(GOLD, 0.6 - k * 0.3); ctx.lineWidth = 5; ctx.shadowColor = 'rgba(255,200,110,0.9)'; ctx.shadowBlur = 14; ctx.beginPath(); ctx.arc(0, 0, 190 + k * 110, 0, TAU); ctx.stroke(); } ctx.restore(); // the ring that goes out from him on the beat, and comes back
      spark(ctx, w * 0.5, h * 0.9, 1.7, { glow: 0.9, eyes: 'open', crest: 0.9, arms: 'rest', look: [0, -0.8], beat: 1 });
      T.finish(ctx, w, h, 25, 0.55); timing(ctx, w, U, '0:24 to 0:28  ·  thum… thum… a ring goes out from him and comes back'); },
    a7(ctx) { const r = RNG(16), w = PW, h = PH; T.sky(ctx, w, h, DRIFT, r, 70); const hy = h * 0.42;
      trials(ctx, 520, hy - 150, 0.6, RNG(41), 0.8); guardian(ctx, 560, hy + 2, 0.13, RNG(42), 0);
      ground(ctx, w, h, hy, RNG(17), 0.04); tiles(ctx, w, h, hy, RNG(18), 0);
      const [nx, ny, ns] = along(w, h, hy, 0.2); node(ctx, nx, ny, 2.1 * ns, { lit: 0, flash: 1, cue: 0.02 });
      // he lifts off the ground and leans toward it; the world waits
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(w * 0.5, h * 0.93, 70, 16, 0, 0, TAU); ctx.fill();
      spark(ctx, w * 0.5, h * 0.84, 1.7, { glow: 1, eyes: 'set', crest: 1, arms: 'back', lean: 0.0, look: [0, -1], beat: 1 });
      T.finish(ctx, w, h, 25, 0.5);
      words(ctx, 'tap', nx, ny - 150, 60, { align: 'center', color: '#ffffff' }); // the prompt: one word, white (white means "tap here"), pulsing with the beat
      timing(ctx, w, U, 'held for as long as it takes  ·  plink. The world waits'); },
    a8(ctx) { const r = RNG(19), w = PW, h = PH; T.sky(ctx, w, h, DRIFT.map(([t, c]) => [t, mix(c, [60, 50, 120], 0.4)]), r, 90); const hy = h * 0.42;
      trials(ctx, 520, hy - 150, 0.6, RNG(41), 0.8); guardian(ctx, 560, hy + 2, 0.13, RNG(42), 0);
      ground(ctx, w, h, hy, RNG(17), 0.3); tiles(ctx, w, h, hy, RNG(18), 0.12);
      const [nx, ny, ns] = along(w, h, hy, 0.2);
      // the first tap: the arc, the strike, the burst
      K.brush(ctx, [[w * 0.5, h * 0.84], [w * 0.47, h * 0.6], [nx, ny - 30]], 16, [255, 214, 130], r, { passes: 8, alpha: 0.3 });
      for (let k = 0; k < 4; k++) { ctx.save(); ctx.translate(nx, ny); ctx.scale(1, 0.42); ctx.strokeStyle = rgba(k % 2 ? [150, 190, 255] : GOLD, 0.9 - k * 0.2); ctx.lineWidth = 9 - k * 1.6; ctx.shadowColor = 'rgba(255,214,140,0.9)'; ctx.shadowBlur = 22; ctx.beginPath(); ctx.arc(0, 0, 80 + k * 120, 0, TAU); ctx.stroke(); ctx.restore(); }
      K.glow(ctx, nx, ny, 520, [255, 220, 150], 0.9); node(ctx, nx, ny, 2.1 * ns, { lit: 1 }); dust(ctx, nx, ny - 60, 420, r, 150);
      spark(ctx, nx + 4, ny - 86, 1.25, { glow: 1, eyes: 'wide', crest: 1, arms: 'up', lean: 0.1, beat: 1 });
      T.finish(ctx, w, h, 26, 0.4); timing(ctx, w, U, 'the first tap  ·  a rich chord, at once; the song begins'); },
    a9(ctx) { const r = RNG(20), w = PW, h = PH; T.sky(ctx, w, h, WOKEN, r, 150); T.stars(ctx, w, h * 0.4, r, 500, 3); const hy = h * 0.42;
      trials(ctx, 520, hy - 150, 0.6, RNG(41), 0.7); guardian(ctx, 560, hy + 2, 0.13, RNG(42), 0);
      K.glow(ctx, w * 0.5, hy, 700, [255, 170, 110], 0.4, 'screen');
      ground(ctx, w, h, hy, RNG(17), 1); tiles(ctx, w, h, hy, RNG(18), 0.62);
      // the colour runs out over the stone, flowers of light come up along the path, and node after node lights toward the horizon
      for (const t of [0.2, 0.38, 0.52, 0.64, 0.74]) { const [nx, ny, ns] = along(w, h, hy, t); node(ctx, nx, ny, 2.1 * ns, { lit: t < 0.6 ? 1 : 0.3 }); }
      const [ex, ey, es] = along(w, h, hy, 0.3); spark(ctx, ex + 30, ey - 150 * es - 60, 1.15, { glow: 1, eyes: 'open', crest: 1, arms: 'back', lean: 0.5, beat: 1 }); dust(ctx, ex, ey - 60, 260, r, 60);
      T.finish(ctx, w, h, 27, 0.35); timing(ctx, w, U, '+0.6 s to +2.5 s  ·  colour runs out over the stone'); },
    a10(ctx) { const r = RNG(21), w = PW, h = PH; play(ctx, w, h, 'phone', { nodes: [[0.9, 0.5, 1], [0.9, 1.5, 0.55]], lit: 0.25, hud: true });
      words(ctx, 'Wake the stars.', w / 2, h * 0.2, 46, { align: 'center', alpha: 0.9 });
      timing(ctx, w, U, '+2.5 s  ·  he glides with the tempo; the first markers come'); }
  };

  // ------------------------------------------------------------------ how it maps onto the game: the play view
  /**
   * The same game as now, re-dressed. The world is in the middle, seen whole. The gravity path is the ring Orbin rides
   * round it (dormant stone ahead of him, in colour behind him). Each white mark is a Star-Node set in the path, and
   * its cue is a golden ring that closes on it and touches its edge exactly on the beat.
   * o.nodes: [ring index 0..1, turns ahead of Orbin, cue 0..1]; o.lit: how much of the world is awake.
   */
  function play(ctx, w, h, dev, o = {}) {
    const { nodes = [], lit = 0.3, hud = false, twin = false } = o, r = RNG(63), u = dev === 'phone' ? 2 : 1.15;
    const cx = w / 2, cy = dev === 'phone' ? h * 0.5 : h * 0.52, R0 = (dev === 'phone' ? 150 : 150) * u, R1 = R0 + 70 * u;
    T.sky(ctx, w, h, twin ? NEBULA : DRIFT.map(([t, c]) => [t, mix(c, WOKEN[Math.min(4, Math.round(t * 4))][1], lit * 0.8)]), r, 110); if (!twin) T.stars(ctx, w, h * 0.5, r, Math.round(lit * 700), 3);
    if (!twin) { trials(ctx, w * 0.72, h * 0.13, 0.5 * u * 0.5, RNG(41), 0.7); guardian(ctx, w * 0.74, h * 0.2, 0.06 * u, RNG(42), 0); }
    const band = ctx.createRadialGradient(cx, cy, 40 * u, cx, cy, R1 + 150 * u); band.addColorStop(0, 'rgba(8,8,24,0)'); band.addColorStop(0.3, `rgba(8,8,24,${twin ? 0.3 : 0.6})`); band.addColorStop(0.8, `rgba(8,8,24,${twin ? 0.3 : 0.6})`); band.addColorStop(1, 'rgba(8,8,24,0)'); ctx.fillStyle = band; ctx.fillRect(0, 0, w, h);
    // the world itself
    T.sphere(ctx, cx, cy, 64 * u, twin ? [255, 190, 90] : mix([70, 84, 120], [214, 96, 60], lit), twin ? [255, 240, 190] : mix([150, 165, 200], [255, 200, 130], lit), twin ? [150, 70, 30] : [22, 26, 50], 225, r, { haze: 0.2 + 0.3 * lit });
    // the gravity paths: rings of stone tiles. Behind Orbin they are awake; ahead they sleep
    const at = (ring, a) => [cx + Math.cos(a) * (ring ? R1 : R0), cy + Math.sin(a) * (ring ? R1 : R0)];
    const a0 = -2.2; // where Orbin is
    for (const ring of [0, 1]) for (let i = 0; i < (ring ? 46 : 36); i++) {
      const n = ring ? 46 : 36, a = (i / n) * TAU, da = TAU / n * 0.42, RR = ring ? R1 : R0, behind = ring === 0 && ((a0 - a + TAU * 2) % TAU) < 2.3;
      if (ring === 1 && !(((a - a0 + TAU * 2) % TAU) > 0.5 && ((a - a0 + TAU * 2) % TAU) < 3.2)) continue; // the next path up shows only where it is coming
      ctx.strokeStyle = twin ? 'rgba(255,240,200,0.8)' : behind ? rgba(mix([90, 120, 220], [255, 210, 130], (i % 3) / 2.4), 0.95) : 'rgba(120,134,170,0.55)'; ctx.lineWidth = (ring ? 7 : 9) * u; ctx.lineCap = 'butt';
      ctx.beginPath(); ctx.arc(cx, cy, RR, a - da, a + da); ctx.stroke();
    }
    // Star-Nodes on the path, each with its golden ring closing on it
    for (const [ring, ahead, cue] of nodes) {
      const a = a0 + ahead, [nx, ny] = at(ring > 0.5 ? 0 : 0, a);
      ctx.fillStyle = 'rgba(8,8,22,0.85)'; ctx.beginPath(); ctx.arc(nx, ny, 17 * u, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); for (let i = 0; i < 10; i++) { const q = -Math.PI / 2 + i * TAU / 10, rr = (i % 2 ? 5.2 : 11.5) * u; ctx.lineTo(nx + Math.cos(q) * rr, ny + Math.sin(q) * rr); } ctx.closePath(); ctx.fill(); // white: tap here
      ctx.strokeStyle = rgba(GOLD, 1 - cue * 0.5); ctx.lineWidth = (3.4 - cue) * u; ctx.shadowColor = 'rgba(255,200,110,0.9)'; ctx.shadowBlur = 8 * u; ctx.beginPath(); ctx.arc(nx, ny, (17 + 3 + cue * 44) * u, 0, TAU); ctx.stroke(); ctx.shadowBlur = 0;
    }
    // gold notes: flowers of light beside the path
    for (const d of [0.28, 0.72, 1.18]) { const [gx, gy] = at(0, a0 + d); K.glow(ctx, gx, gy, 16 * u, GOLD, 0.7); ctx.fillStyle = '#ffe6a8'; ctx.beginPath(); ctx.arc(gx, gy, 3.6 * u, 0, TAU); ctx.fill(); }
    const [ox, oy] = at(0, a0);
    K.brush(ctx, K.arcPts(cx, cy, R0, (a0 - 0.9) * 180 / Math.PI, a0 * 180 / Math.PI, 4), 8 * u, [255, 200, 120], r, { passes: 6, alpha: 0.3 });
    spark(ctx, ox, oy + 6 * u, 0.34 * u, { glow: 1, eyes: 'set', lean: 0.5, arms: 'back', crest: 1, ring: false });
    if (twin) { const [hx2, hy2] = at(0, a0 + Math.PI); spark(ctx, hx2, hy2 + 6 * u, 0.34 * u, { who: 'helion', glow: 1, eyes: 'soft', lean: -0.5, arms: 'back', crest: 1, ring: false, face: -1 }); ctx.strokeStyle = 'rgba(255,240,200,0.35)'; ctx.lineWidth = 1.5 * u; ctx.setLineDash([4 * u, 7 * u]); ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(hx2, hy2); ctx.stroke(); ctx.setLineDash([]); }
    T.finish(ctx, w, h, 71, twin ? 0.25 : 0.42);
    if (hud) { words(ctx, 'attempt 1', 44, 124, 30, { alpha: 0.85 }); words(ctx, 'Emberwick  ·  intro', 44, 162, 28, { alpha: 0.9, color: '#e6cfae' }); words(ctx, '2', w / 2, 132, 60, { align: 'center' }); }
    return { cx, cy, R0, R1, u };
  }

  return { PW, PH, A, play, parts: { spark, stillness, guardian, trials, ground, tiles, node, dust, words }, pal: { VOID, DRIFT, WOKEN, NEBULA } };
})();
