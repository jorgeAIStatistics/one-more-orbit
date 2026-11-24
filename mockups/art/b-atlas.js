// Direction B: "Star Atlas". Ink on dark paper: a burin's fine line, hatching for shade, gold leaf for whatever
// gives light, and the music drawn as constellations. Eko is an engraved flame with a seed of gold; the Hush is an
// eclipse with a corona of hanging cloth and one stitched seam.
/* eslint-disable */
const ATLAS = (() => {
  const { TAU, D, lerp, RNG, rgba, noise2, fbm, P } = K;
  const INK = [233, 223, 198];
  const ink = (a = 1) => rgba(INK, a);
  const SC = 'Didot, "Bodoni 72", "Hoefler Text", Baskerville, Georgia, serif';
  const IT = '"Hoefler Text", Baskerville, "Iowan Old Style", Georgia, serif';
  function paper(ctx, w, h) { ctx.fillStyle = '#0c0d17'; ctx.fillRect(0, 0, w, h); K.glow(ctx, w / 2, h / 2, Math.hypot(w, h) / 1.7, [44, 40, 66], 0.5, 'source-over'); }
  function finish(ctx, w, h, seed) {
    K.lay(ctx, K.texture(w, h, seed, { fine: 0.5, mottle: 0.7, scale: 0.005, fibres: 1600 }), 'overlay', 0.34);
    K.vignette(ctx, w, h, 0.5, [3, 3, 8], 0.34);
  }
  /** Gold leaf: laid in a shape, never quite even, with the flecks and gaps leaf has. */
  function leaf(ctx, shape, box, r, a = 1) {
    ctx.save();
    if (shape(ctx) !== true) ctx.clip();
    const [x, y, w, h] = box;
    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, '#8f6b22'); g.addColorStop(0.35, '#e7c264'); g.addColorStop(0.55, '#fff2bd'); g.addColorStop(0.75, '#d3a544'); g.addColorStop(1, '#8f6b22');
    ctx.globalAlpha = a; ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
    const n = Math.max(20, (w * h) / 26);
    for (let i = 0; i < n; i++) { ctx.fillStyle = r() < 0.55 ? 'rgba(60,40,8,0.5)' : 'rgba(255,250,220,0.7)'; const s = r() * 1.6; ctx.fillRect(x + r() * w, y + r() * h, s, s); }
    ctx.restore();
  }
  /** One disc with another bitten out of it (a crescent): clips to it. */
  const minus = (ax, ay, ar, bx, by, br) => (c) => { c.beginPath(); c.arc(ax, ay, ar, 0, TAU); c.clip(); c.beginPath(); c.rect(ax - ar - 9, ay - ar - 9, ar * 2 + 18, ar * 2 + 18); c.arc(bx, by, br, 0, TAU); c.clip('evenodd'); return true; };
  const line = (ctx, x0, y0, x1, y1, a = 1, lw = 1, c = INK) => { ctx.strokeStyle = rgba(c, a); ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); };
  const circ = (ctx, x, y, r, a = 1, lw = 1, c = INK) => { ctx.strokeStyle = rgba(c, a); ctx.lineWidth = lw; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke(); };
  /** The plate: a ruled double border, its number, and the atlas's circles of declination behind everything. */
  function plate(ctx, w, h, no, cx, cy, radii, ticksAt) {
    ctx.strokeStyle = ink(0.75); ctx.lineWidth = 1.4; ctx.strokeRect(26, 26, w - 52, h - 52);
    ctx.lineWidth = 0.7; ctx.strokeRect(34, 34, w - 68, h - 68);
    K.text(ctx, no, w - 54, 62, `400 13px ${SC}`, ink(0.8), { align: 'right', ls: 4 });
    for (const R of radii) circ(ctx, cx, cy, R, 0.16, 0.8);
    for (let a = 0; a < 360; a += 30) { const [x0, y0] = P(cx, cy, a, radii[0] * 0.5), [x1, y1] = P(cx, cy, a, radii[radii.length - 1]); line(ctx, x0, y0, x1, y1, 0.09, 0.7); }
    if (ticksAt) for (let a = 0; a < 360; a += 2) { const l = a % 30 === 0 ? 12 : a % 10 === 0 ? 8 : 4; const [x0, y0] = P(cx, cy, a, ticksAt), [x1, y1] = P(cx, cy, a, ticksAt + l); line(ctx, x0, y0, x1, y1, 0.4, 0.8); }
  }
  /** A star as an engraver cuts one: a point, with rays if it is bright; hollow if its light has been taken. */
  function star(ctx, x, y, s, r, gold = false, out = false) {
    if (out) { circ(ctx, x, y, s * 0.9, 0.5, 0.8); return; }
    ctx.fillStyle = gold ? '#e7c264' : ink(0.95); ctx.beginPath(); ctx.arc(x, y, s * 0.55, 0, TAU); ctx.fill();
    if (s > 2.2) for (let k = 0; k < 8; k++) { const a = k * 45 + 22; const [x0, y0] = P(x, y, a, s * 1.1), [x1, y1] = P(x, y, a, s * (k % 2 ? 2 : 3)); line(ctx, x0, y0, x1, y1, 0.8, 0.7, gold ? [231, 194, 100] : INK); }
  }
  function field(ctx, w, h, r, n, avoid) {
    for (let i = 0; i < n; i++) { const x = 50 + r() * (w - 100), y = 50 + r() * (h - 100); if (avoid && avoid(x, y)) continue; star(ctx, x, y, 0.8 + r() * r() * 3.4, r); }
  }
  /** A globe: meridians and parallels, hatched where it turns from the light at `la` degrees, leaf on the lit limb if its song is home. */
  function globe(ctx, x, y, R, la, r, o = {}) {
    const { gold = true, a = 1 } = o;
    const lx = Math.cos(la * D), ly = Math.sin(la * D);
    const disc = (c) => { c.beginPath(); c.arc(x, y, R, 0, TAU); };
    ctx.save(); disc(ctx); ctx.fillStyle = '#0a0b14'; ctx.fill(); ctx.restore();
    if (gold) leaf(ctx, minus(x, y, R, x - lx * R * 0.34, y - ly * R * 0.34, R * 1.04), [x - R, y - R, R * 2, R * 2], r, 0.95);
    ctx.save(); disc(ctx); ctx.clip();
    for (let k = 1; k < 5; k++) { ctx.strokeStyle = ink(0.34 * a); ctx.lineWidth = 0.8; ctx.beginPath(); ctx.ellipse(x, y, R * Math.cos((k / 5) * Math.PI / 2 + 0.2), R, -0.25, 0, TAU); ctx.stroke(); }
    for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.ellipse(x, y + k * R * 0.3, R * Math.sqrt(1 - Math.pow(k * 0.3, 2)), R * 0.12, -0.25, 0, Math.PI); ctx.stroke(); }
    ctx.restore();
    const shade = (off, ang, gap, al) => K.hatch(ctx, minus(x, y, R, x + lx * R * off, y + ly * R * off, R * 0.98), [x - R, y - R, R * 2, R * 2], ang, gap, r, { color: ink(al * a), lw: 0.8, wob: 0.8 });
    shade(0.3, 0.7, 4.2, 0.75); shade(0.6, -0.6, 4.2, 0.7);
    circ(ctx, x, y, R, 0.95 * a, 1.5);
  }
  /** Eko: a flame cut in line, shaded along its own curve, with a seed of gold, a ring like an armillary's, rays, and a wisp behind. */
  function eko(ctx, x, y, s, r, o = {}) {
    const { rays = true, tail = true } = o;
    if (rays) for (let i = 0; i < 60; i++) {
      const a = i * 6 + 3;
      if (tail && a > 96 && a < 168) continue;
      const [x0, y0] = P(x, y - 30 * s, a, 124 * s), [x1, y1] = P(x, y - 30 * s, a, (i % 10 === 0 ? 236 : i % 2 ? 150 : 184) * s);
      line(ctx, x0, y0, x1, y1, 0.75, 0.9);
    }
    if (tail) for (let k = 0; k < 11; k++) {
      const ex = x - (150 + k * 9) * s, ey = y + (236 + k * 7 - Math.abs(k - 5) * 9) * s;
      ctx.strokeStyle = ink(0.8); ctx.lineWidth = 0.9;
      ctx.beginPath(); ctx.moveTo(x + (k - 5) * 5 * s, y + 46 * s); ctx.bezierCurveTo(x + (k - 5) * 4 * s, y + 110 * s, x - 60 * s, y + 170 * s, ex, ey); ctx.stroke();
      if (k % 2 === 0) star(ctx, ex - 4 * s, ey + 3 * s, 1.6 * s + 0.6, r, k === 4);
    }
    const hoop = (a0, a1, al) => { ctx.save(); ctx.translate(x, y + 16 * s); ctx.rotate(-0.3); ctx.strokeStyle = ink(al); ctx.lineWidth = 1.3; ctx.beginPath(); ctx.ellipse(0, 0, 92 * s, 26 * s, 0, a0, a1); ctx.stroke(); ctx.lineWidth = 0.6; ctx.beginPath(); ctx.ellipse(0, 0, 98 * s, 30 * s, 0, a0, a1); ctx.stroke(); ctx.restore(); };
    hoop(Math.PI, TAU, 0.45);
    const body = [[30, 44], [0, 52], [-30, 42], [-46, 12], [-42, -24], [-26, -62], [-10, -100], [10, -150], [14, -102], [28, -66], [44, -28], [46, 10]].map(([a, b]) => [x + a * s + 12 * s * Math.pow(Math.max(0, -b) / 150, 2), y + b * s]);
    ctx.save(); K.path(ctx, body); ctx.fillStyle = '#0a0b14'; ctx.fill(); ctx.clip();
    for (let k = 0; k < 17; k++) { // the shading follows the flame's own rise, closer together on the side away from the light
      const t = k / 16, bx = x + lerp(-44, 46, t * t) * s;
      ctx.strokeStyle = ink(0.35 + t * 0.55); ctx.lineWidth = 0.9;
      ctx.beginPath(); ctx.moveTo(bx, y + 52 * s); ctx.quadraticCurveTo(x + lerp(-58, 62, t * t) * s, y - 30 * s, x + 12 * s, y - 150 * s); ctx.stroke();
    }
    ctx.restore();
    K.path(ctx, body); ctx.strokeStyle = ink(1); ctx.lineWidth = Math.max(1.2, 1.9 * s); ctx.lineJoin = 'round'; ctx.stroke();
    leaf(ctx, (c) => { c.beginPath(); c.moveTo(x, y - 22 * s); c.quadraticCurveTo(x + 17 * s, y + 14 * s, x, y + 40 * s); c.quadraticCurveTo(x - 17 * s, y + 14 * s, x, y - 22 * s); }, [x - 18 * s, y - 24 * s, 36 * s, 66 * s], r);
    hoop(0.12, Math.PI - 0.12, 1);
    ctx.save(); ctx.translate(x, y + 16 * s); ctx.rotate(-0.3); ctx.fillStyle = '#e7c264'; ctx.beginPath(); ctx.arc(70 * s, 17 * s, Math.max(2, 5 * s), 0, TAU); ctx.fill(); ctx.restore();
  }
  /** The Hush: a black disc where stars should be, cloth hanging off it in every direction, one seam sewn shut, and under the seam a hair of light. */
  function hush(ctx, x, y, R, r, seed = 3) {
    const nz = noise2(seed);
    for (let i = 0; i < 300; i++) {
      const a = (i / 300) * 360 + r() * 0.8;
      const len = (26 + 190 * Math.pow(fbm(nz, a * 0.035, 1.5), 1.6)) * (R / 200) * (i % 3 === 0 ? 1 : 0.62);
      const [x0, y0] = P(x, y, a, R + 2), [x1, y1] = P(x, y, a, R + len);
      ctx.strokeStyle = ink(0.3 + r() * 0.5); ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 + len * 0.06, x1, y1 + len * 0.3); ctx.stroke(); // it hangs: every fold sags the same way
    }
    ctx.fillStyle = '#030306'; ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.fill();
    circ(ctx, x, y, R, 1, 1.7); circ(ctx, x, y, R - 7, 0.3, 0.7); circ(ctx, x, y, R - 13, 0.16, 0.7);
    const sw = R * 0.74;
    ctx.strokeStyle = ink(0.55); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x - sw, y - 4); ctx.quadraticCurveTo(x, y + R * 0.09, x + sw, y - 4); ctx.stroke();
    for (let k = -9; k <= 9; k++) { const px = x + (k / 9.6) * sw, py = y - 4 + (1 - Math.pow(k / 9.6, 2)) * R * 0.065; line(ctx, px - 2.5, py - 6, px + 2.5, py + 6, 0.5, 0.9); }
    ctx.strokeStyle = '#e7c264'; ctx.lineWidth = Math.max(1.2, R * 0.011); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(x, y - R * 0.1, R * 0.36, 28 * D, 152 * D); ctx.stroke();
  }
  function jar(ctx, x, y, r) {
    ctx.strokeStyle = ink(0.85); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x - 12, y + 18); ctx.lineTo(x - 12, y - 6); ctx.quadraticCurveTo(x - 12, y - 24, x, y - 24); ctx.quadraticCurveTo(x + 12, y - 24, x + 12, y - 6); ctx.lineTo(x + 12, y + 18); ctx.stroke();
    line(ctx, x - 16, y + 18, x + 16, y + 18, 0.85, 1.3); circ(ctx, x, y - 27, 2.4, 0.8, 0.9);
    for (let k = 0; k < 4; k++) line(ctx, x + 5 + k * 1.8, y - 14 + k * 3, x + 5 + k * 1.8, y + 14, 0.4, 0.6);
    star(ctx, x - 1, y + 2, 2.6, r, true);
  }
  function lighthouse(ctx, x, y, s, r) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    const rock = (c) => { c.beginPath(); c.moveTo(-92, 40); c.quadraticCurveTo(-70, 6, -30, 14); c.quadraticCurveTo(0, -2, 34, 12); c.quadraticCurveTo(76, 8, 94, 40); c.closePath(); };
    rock(ctx); ctx.fillStyle = '#0a0b14'; ctx.fill(); ctx.strokeStyle = ink(0.9); ctx.lineWidth = 1.3; ctx.stroke();
    K.hatch(ctx, rock, [-94, 0, 190, 42], 0.5, 4, r, { color: ink(0.6), lw: 0.7 });
    ctx.rotate(-0.09);
    const tower = (c) => { c.beginPath(); c.moveTo(-22, 16); c.lineTo(22, 16); c.lineTo(13, -108); c.lineTo(-13, -108); c.closePath(); };
    tower(ctx); ctx.fillStyle = '#0a0b14'; ctx.fill(); ctx.strokeStyle = ink(1); ctx.lineWidth = 1.4; ctx.stroke();
    K.hatch(ctx, (c) => { c.beginPath(); c.moveTo(2, 16); c.lineTo(22, 16); c.lineTo(13, -108); c.lineTo(1, -108); c.closePath(); }, [-22, -108, 44, 124], 0, 3.4, r, { color: ink(0.7), lw: 0.7 });
    for (const yy of [-20, -44, -70, -92]) line(ctx, -22 - yy * 0.072, yy, 22 + yy * 0.072, yy, 0.8, 0.9);
    ctx.strokeStyle = ink(1); ctx.lineWidth = 1.3; ctx.strokeRect(-18, -114, 36, 6); ctx.strokeRect(-10, -136, 20, 22);
    ctx.beginPath(); ctx.moveTo(-15, -136); ctx.lineTo(0, -158); ctx.lineTo(15, -136); ctx.closePath(); ctx.stroke();
    ctx.restore();
    leaf(ctx, (c) => { c.beginPath(); c.rect(x - 9 * s - 11 * s, y - 134 * s, 16 * s, 19 * s); }, [x - 22 * s, y - 136 * s, 24 * s, 24 * s], r);
  }
  const name = (ctx, n, sub, x, y, align = 'center', a = 1) => { K.text(ctx, n.toUpperCase(), x, y, `400 17px ${SC}`, ink(a), { ls: 6, align }); if (sub) K.text(ctx, sub, x, y + 20, `italic 400 14px ${IT}`, ink(a * 0.75), { align }); };
  const title = (ctx, t, sub, w, h) => { K.text(ctx, t.toUpperCase(), w / 2, h - 86, `400 34px ${SC}`, ink(1), { ls: 22 }); line(ctx, w / 2 - 150, h - 72, w / 2 + 150, h - 72, 0.5, 0.8); K.text(ctx, sub, w / 2, h - 50, `italic 400 16px ${IT}`, ink(0.8)); };
  const note = (ctx, s, x, y, tx, ty, align = 'left') => { line(ctx, x, y, tx, ty, 0.5, 0.7); K.text(ctx, s, x + (align === 'left' ? 8 : -8), y + 5, `italic 400 14px ${IT}`, ink(0.8), { align }); };

  return {
    hero(ctx, w, h) {
      const r = RNG(5);
      paper(ctx, w, h);
      plate(ctx, w, h, 'PLATE I.', 600, 372, [150, 236, 322], 322);
      field(ctx, w, h, r, 150, (x, y) => Math.hypot(x - 600, y - 372) < 330 || y > 660);
      const con = [[930, 150], [1010, 210], [1070, 170], [1040, 300], [960, 330]];
      con.forEach(([x, y], i) => { if (i) line(ctx, con[i - 1][0], con[i - 1][1], x, y, 0.4, 0.8); star(ctx, x, y, 2.6, r, i === 2); });
      eko(ctx, 600, 392, 1.05, r);
      note(ctx, 'the seed: the only gold on him', 800, 420, 612, 404);
      note(ctx, 'the ring he wears, an orbit', 240, 380, 512, 420, 'right');
      note(ctx, 'the wisp follows a beat behind', 300, 610, 468, 584, 'right');
      title(ctx, 'Eko', 'a spark of the Lantern\'s lamp', w, h);
      finish(ctx, w, h, 15);
    },
    boss(ctx, w, h) {
      const r = RNG(17);
      paper(ctx, w, h);
      plate(ctx, w, h, 'PLATE VII.', 600, 330, [250, 330, 410], 0);
      for (let i = 0; i < 190; i++) { const x = 50 + r() * 1100, y = 50 + r() * 600, d = Math.hypot(x - 600, y - 330); if (d < 215) continue; star(ctx, x, y, 0.8 + r() * r() * 3, r, false, d < 420 && r() < 0.8); } // near it, the stars are out
      const jars = [[330, 640], [465, 676], [600, 690], [735, 676], [870, 640]];
      for (const [x, y] of jars) { ctx.strokeStyle = rgba([226, 72, 58], 0.75); ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(600 + (x - 600) * 0.5, 500); ctx.quadraticCurveTo(x + (600 - x) * 0.12, 590, x, y - 30); ctx.stroke(); }
      hush(ctx, 600, 330, 196, r);
      for (const [x, y] of jars) jar(ctx, x, y, r);
      note(ctx, 'sewn shut', 852, 300, 748, 326);
      note(ctx, 'a hair of light, under the lid', 330, 420, 548, 390, 'right');
      K.text(ctx, 'THE HUSH', 600, h - 56, `400 30px ${SC}`, ink(1), { ls: 22 });
      K.text(ctx, 'silentium · it cannot bear a sound', 600, h - 34, `italic 400 15px ${IT}`, ink(0.8));
      finish(ctx, w, h, 25);
    },
    map(ctx, w, h) {
      const r = RNG(37);
      paper(ctx, w, h);
      const L = [600, 440];
      plate(ctx, w, h, 'PLATE III.', L[0], L[1], [120, 210, 300], 300);
      field(ctx, w, h, r, 170, (x, y) => Math.hypot(x - 600, y - 96) < 130);
      const pl = [['Emberwick', 'Heroes Tonight', 250, 610, 54, true], ['Cirra', 'Sky High', 950, 590, 50, true], ['Glassmere', 'Blank', 290, 236, 46, false], ['Verdance', 'Invincible', 925, 232, 52, false]];
      const lamp = [L[0] - 12, L[1] - 124];
      for (const [, , x, y, R, home] of pl) if (home) for (let k = -4; k <= 4; k++) { // the beam is a fan of ruled gold lines
        const a = Math.atan2(y - lamp[1], x - lamp[0]) + k * 0.022, d = Math.hypot(x - lamp[0], y - lamp[1]) - R - 6;
        line(ctx, lamp[0] + Math.cos(a) * 16, lamp[1] + Math.sin(a) * 16, lamp[0] + Math.cos(a) * d, lamp[1] + Math.sin(a) * d, 0.55 - Math.abs(k) * 0.08, 0.8, [231, 194, 100]);
      }
      const road = [[250, 610], [950, 590], [290, 236], [925, 232], [600, 96]];
      for (let i = 0; i + 1 < road.length; i++) { // the road is a constellation: ruled where it has been walked, pricked out where it has not
        const [x0, y0] = road[i], [x1, y1] = road[i + 1], d = Math.hypot(x1 - x0, y1 - y0), ux = (x1 - x0) / d, uy = (y1 - y0) / d;
        ctx.save(); ctx.setLineDash(i < 1 ? [] : [2, 7]); line(ctx, x0 + ux * 66, y0 + uy * 66, x1 - ux * 74, y1 - uy * 74, i < 1 ? 0.8 : 0.5, 1); ctx.restore();
      }
      hush(ctx, 600, 96, 58, r, 9);
      for (const [n, song, x, y, R, home] of pl) {
        globe(ctx, x, y, R, Math.atan2(lamp[1] - y, lamp[0] - x) / D, r, { gold: home, a: home ? 1 : 0.55 });
        name(ctx, n, home ? song : 'dark and silent', x, y + R + 30, 'center', home ? 1 : 0.6);
      }
      lighthouse(ctx, L[0], L[1], 0.95, r);
      eko(ctx, 1010, 520, 0.2, r, { rays: false, tail: false });
      for (let k = 0; k < 16; k++) { const [x0, y0] = P(1080, 660, k * 22.5, 6), [x1, y1] = P(1080, 660, k * 22.5, k % 4 === 0 ? 46 : k % 2 === 0 ? 30 : 18); line(ctx, x0, y0, x1, y1, 0.7, 0.9); }
      circ(ctx, 1080, 660, 22, 0.5, 0.8);
      K.text(ctx, 'THE GALAXY', 64, 76, `400 22px ${SC}`, ink(1), { align: 'left', ls: 10 });
      K.text(ctx, 'of the Lantern', 66, 100, `italic 400 20px ${IT}`, ink(0.85), { align: 'left' });
      name(ctx, 'The Hollow', '', 752, 104, 'left', 0.7);
      finish(ctx, w, h, 41);
    },
    play(ctx, w, h) {
      const r = RNG(53), G = K.G;
      paper(ctx, w, h);
      field(ctx, w, h, r, 120, (x, y) => Math.hypot(x - G.cx, y - G.cy) < 350);
      // the drop: a burst cut in ruled lines, and leaf thrown off it
      for (let i = 0; i < 180; i++) { const a = i * 2 + r(); const [x0, y0] = P(G.cx, G.cy, a, 350 + (i % 2) * 14), [x1, y1] = P(G.cx, G.cy, a, i % 6 === 0 ? 900 : i % 2 ? 470 : 560); line(ctx, x0, y0, x1, y1, i % 6 === 0 ? 0.5 : 0.28, 0.8); }
      for (let i = 0; i < 70; i++) { const a = r() * 360, d = 360 + r() * 420, [x, y] = P(G.cx, G.cy, a, d), s = 2 + r() * 6; leaf(ctx, (c) => { c.beginPath(); c.moveTo(x, y - s); c.lineTo(x + s * 0.7, y); c.lineTo(x, y + s * 0.6); c.lineTo(x - s * 0.8, y + s * 0.1); c.closePath(); }, [x - s, y - s, s * 2, s * 2], r, 0.9); }
      finish(ctx, w, h, 59);
      globe(ctx, G.cx, G.cy, G.planet, 225, r, { gold: true });
      const tick = (c, a, rad, l, al) => { const [x0, y0] = P(G.cx, G.cy, a, rad), [x1, y1] = P(G.cx, G.cy, a, rad + l); line(c, x0, y0, x1, y1, al, 0.8); };
      K.playFG(ctx, {
        faint: ink(0.2), faintW: 0.9, meterBack: ink(0.18), meterW: 3, goldCol: '#e7c264', dots: ink(0.75), cap: 'butt',
        halo: 'rgba(4,4,10,0.9)', ring: '#f6eedb', ringW: 3.2, danger: '#e2483a', dangerCore: null, markLen: 17, markW: 5,
        decor(c, g) { // an atlas's graduations on the rings you ride, and the gold notes joined up as a constellation
          for (let a = g.floor[0]; a <= g.floor[1]; a += 4) tick(c, a, g.r[1] - 9, 5, 0.5);
          for (let a = g.floor2[0]; a <= g.floor2[1]; a += 4) tick(c, a, g.r[2] - 9, 5, 0.5);
          c.strokeStyle = 'rgba(231,194,100,0.7)'; c.lineWidth = 0.9; c.beginPath();
          g.gold.forEach(([a, rad], i) => { const [x, y] = P(g.cx, g.cy, a, rad + 11); if (i) c.lineTo(x, y); else c.moveTo(x, y); });
          const [sx, sy] = P(g.cx, g.cy, g.shard[0], g.shard[1]); c.lineTo(sx, sy); c.stroke();
        },
        dangerDecor(c, g) { for (let a = g.ceil[0] + 1; a < g.ceil[1]; a += 2.4) { const [x0, y0] = P(g.cx, g.cy, a, g.r[2] - 3.2), [x1, y1] = P(g.cx, g.cy, a + 1.2, g.r[2] + 3.2); line(c, x0, y0, x1, y1, 0.9, 0.9, [20, 6, 6]); } },
        gold(c, x, y) { c.fillStyle = 'rgba(4,4,10,0.85)'; c.beginPath(); c.arc(x, y, 10, 0, TAU); c.fill(); star(c, x, y, 4, r, true); },
        shard(c, x, y) { const sh = (cc) => { cc.beginPath(); cc.moveTo(x + 1, y - 15); cc.lineTo(x + 10, y - 2); cc.lineTo(x + 3, y + 15); cc.lineTo(x - 9, y + 4); cc.closePath(); }; leaf(c, sh, [x - 10, y - 16, 22, 32], r); sh(c); c.strokeStyle = ink(1); c.lineWidth = 1.2; c.stroke(); },
        lens(c, x, y, rot) { c.save(); c.translate(x, y); c.rotate(rot); const ln = (cc) => { cc.beginPath(); cc.moveTo(0, -34); cc.quadraticCurveTo(14, 0, 0, 34); cc.quadraticCurveTo(-14, 0, 0, -34); }; ln(c); c.fillStyle = '#0a0b14'; c.fill(); K.hatch(c, ln, [-14, -34, 28, 68], 0.9, 3.4, r, { color: ink(0.6), lw: 0.7 }); ln(c); c.strokeStyle = ink(1); c.lineWidth = 1.4; c.stroke(); c.restore(); },
        eko(c, x, y, trail) {
          for (const off of [-4, 0, 4]) { c.strokeStyle = ink(0.75); c.lineWidth = 0.9; c.beginPath(); trail.forEach(([px, py], i) => { const k = 1 + off / 212; const qx = G.cx + (px - G.cx) * k, qy = G.cy + (py - G.cy) * k; if (i) c.lineTo(qx, qy); else c.moveTo(qx, qy); }); c.stroke(); }
          c.fillStyle = 'rgba(4,4,10,0.9)'; c.beginPath(); c.arc(x, y, 15, 0, TAU); c.fill();
          for (let k = 0; k < 12; k++) { const [x0, y0] = P(x, y, k * 30, 9), [x1, y1] = P(x, y, k * 30, k % 3 === 0 ? 20 : 14); line(c, x0, y0, x1, y1, 0.95, 1); }
          leaf(c, (cc) => { cc.beginPath(); cc.arc(x, y, 6.5, 0, TAU); }, [x - 7, y - 7, 14, 14], r);
        },
        hud(c) {
          K.text(c, '62', 596, 74, `400 50px ${SC}`, ink(1), { align: 'right' }); K.text(c, 'per cent.', 604, 74, `italic 400 18px ${IT}`, ink(0.8), { align: 'left' });
          K.text(c, 'EMBERWICK · THE DROP', 600, 100, `400 11px ${SC}`, ink(0.8), { ls: 6 });
          line(c, 80, h - 46, w - 80, h - 46, 0.5, 0.8); for (let k = 0; k <= 50; k++) line(c, 80 + (k / 50) * (w - 160), h - 46, 80 + (k / 50) * (w - 160), h - 46 - (k % 5 ? 4 : 9), 0.5, 0.8);
          line(c, 80, h - 46, 80 + (w - 160) * 0.62, h - 46, 1, 2.2, [231, 194, 100]);
        }
      });
    }
  };
})();
