// Afterglow, step 1: the galaxy map and planet selection, as three compositions, each for a phone and a desktop.
// No cards, no tab bar, no buttons: the interface is written into the painting. The state shown in every still:
// Emberwick restored, Cirra chosen (best 38%, two of three shards), Glassmere and Verdance dark and silent.
/* eslint-disable */
const MAPS = (() => {
  const { TAU, D, lerp, RNG, rgba, mix } = K;
  const T = DUSK.tools;
  const PL = {
    heroes: { name: 'Emberwick', song: 'Heroes Tonight', base: [214, 96, 60], lit: [255, 190, 120], dark: [70, 26, 50], bands: [[-0.2, 0.22, [255, 200, 140], 0.14], [0.3, 0.25, [150, 50, 50], 0.16]] },
    skyhigh: { name: 'Cirra', song: 'Sky High', base: [220, 110, 190], lit: [255, 196, 232], dark: [80, 36, 110], bands: [[-0.1, 0.3, [255, 236, 248], 0.2], [0.4, 0.2, [255, 220, 240], 0.14]] },
    blank: { name: 'Glassmere', song: 'Blank', base: [110, 160, 230], lit: [226, 242, 255], dark: [30, 44, 110], bands: [[0, 0.16, [240, 250, 255], 0.2]] },
    invincible: { name: 'Verdance', song: 'Invincible', base: [70, 160, 110], lit: [196, 250, 160], dark: [14, 60, 66], bands: [[-0.25, 0.25, [220, 255, 170], 0.14]] }
  };
  const NIGHT = [22, 18, 56];
  /** A shard as a small star of paint: lit, or only the place where one will be. */
  function dab(ctx, x, y, s, on) {
    if (on) { K.glow(ctx, x, y, s * 5, [255, 220, 150], 0.5); ctx.fillStyle = 'rgba(255,240,206,0.98)'; ctx.beginPath(); ctx.ellipse(x, y, s, s * 0.9, 0.4, 0, TAU); ctx.fill(); }
    else { ctx.strokeStyle = 'rgba(255,236,206,0.45)'; ctx.lineWidth = Math.max(1, s * 0.28); ctx.beginPath(); ctx.arc(x, y, s * 0.85, 0, TAU); ctx.stroke(); }
  }
  /** The Hollow: a mass that gives no light, curtains of fog hung off it, and the lower limb of an eclipse under its lid. */
  function hollow(ctx, x, y, rx, ry, r, u) {
    ctx.save(); ctx.filter = `blur(${18 * u}px)`; ctx.fillStyle = 'rgba(3,3,10,0.97)'; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.fill(); ctx.restore();
    for (let i = 0; i < 54; i++) { const x0 = x - rx * 0.95 + r() * rx * 1.9, len = ry * (0.9 + r() * 1.3); K.brush(ctx, [[x0, y - ry * 0.4], [x0 + (x - x0) * 0.08, y + len * 0.4], [x0 + (r() - 0.5) * 40 * u, y + len]], (14 + r() * 28) * u, mix([8, 7, 20], [70, 56, 120], r() * r()), r, { passes: 3, alpha: 0.2 }); }
    const er = Math.min(rx, ry) * 0.2;
    ctx.save(); ctx.beginPath(); ctx.rect(x - rx, y + ry * 0.32, rx * 2, ry); ctx.clip();
    ctx.shadowColor = 'rgba(214,206,255,0.9)'; ctx.shadowBlur = 18 * u; ctx.strokeStyle = 'rgba(236,230,255,0.9)'; ctx.lineWidth = 2.2 * u;
    ctx.beginPath(); ctx.arc(x, y + ry * 0.26, er, 0, TAU); ctx.stroke(); ctx.restore();
  }
  /** One planet with what is written beside it. state: 'home' (in colour), 'open' (waking), 'dark'. */
  function planet(ctx, id, p, lamp, r, u, chosen) {
    const P = PL[id], st = p.state;
    const k = st === 'home' ? 0 : st === 'open' ? 0.42 : 0.78;
    const la = Math.atan2(lamp[1] - p.y, lamp[0] - p.x) / D; // every world is lit from the Lantern
    T.sphere(ctx, p.x, p.y, p.r, mix(P.base, NIGHT, k), mix(P.lit, [40, 34, 90], k), P.dark, la, r, { bands: st === 'dark' ? [] : P.bands, haze: st === 'home' ? 0.34 : st === 'open' ? 0.16 : 0.04, rim: st === 'home' ? 0.9 : st === 'open' ? 0.55 : 0.14 });
    if (chosen) return;
    const left = p.side === 'left', tx = p.x + (left ? -1 : 1) * (p.r + 16 * u), a = st === 'dark' ? 0.5 : 0.95;
    K.text(ctx, P.name, tx, p.y + 2 * u, `italic 600 ${24 * u}px ${T.SERIF}`, '#fff1d8', { align: left ? 'right' : 'left', alpha: a });
    if (st === 'dark') K.text(ctx, 'dark and silent', tx, p.y + 22 * u, `italic 500 ${14 * u}px ${T.SERIF}`, '#e6cfae', { align: left ? 'right' : 'left', alpha: 0.5 });
    else for (let i = 0; i < 3; i++) dab(ctx, tx + (left ? -1 : 1) * (7 + i * 16) * u, p.y + 19 * u, 3.4 * u, true);
  }
  /** The chosen planet's few soft lines: its name, its song, how far you have got, its shards; and how to go in. */
  function lines(ctx, d, u) {
    const al = d.align, sx = d.x, c1 = '#fff1d8', c2 = '#e6cfae', dir = al === 'right' ? -1 : 1;
    K.text(ctx, 'Cirra', sx, d.y, `italic 600 ${50 * u}px ${T.SERIF}`, c1, { align: al });
    K.text(ctx, 'Sky High', sx, d.y + 30 * u, `italic 500 ${19 * u}px ${T.SERIF}`, c1, { align: al, alpha: 0.92 });
    K.text(ctx, 'by Elektronomia', sx, d.y + 50 * u, `italic 500 ${13.5 * u}px ${T.SERIF}`, c2, { align: al, alpha: 0.7 });
    K.text(ctx, 'best 38%', sx, d.y + 84 * u, `italic 500 ${21 * u}px ${T.SERIF}`, c1, { align: al, alpha: 0.95 });
    for (let i = 0; i < 3; i++) dab(ctx, sx + dir * (100 + i * 18) * u, d.y + 77 * u, 4.4 * u, i < 2);
    K.text(ctx, 'tap again to fly in', sx, d.y + 118 * u, `italic 500 ${15.5 * u}px ${T.SERIF}`, c1, { align: al, alpha: 0.7 });
    K.text(ctx, 'or practise', sx, d.y + 140 * u, `italic 500 ${13.5 * u}px ${T.SERIF}`, c2, { align: al, alpha: 0.55 });
  }
  function scene(ctx, w, h, L, seed) {
    const r = RNG(seed), u = L.u;
    T.sky(ctx, w, h, L.sky, r, 170);
    T.stars(ctx, w, h * L.horizon, r, Math.round((w * h) / 1100), seed);
    const lamp = [L.lantern.x - 10 * L.lantern.s, L.lantern.y - 132 * L.lantern.s];
    // badges are constellations you have lit: a few stars joined, low in the sky, with a quiet word beside them
    ctx.strokeStyle = 'rgba(255,236,206,0.35)'; ctx.lineWidth = 1.1 * u; ctx.beginPath();
    L.stars.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
    L.stars.forEach(([x, y], i) => dab(ctx, x, y, (i % 2 ? 2.6 : 3.6) * u, i < 3));
    K.text(ctx, 'three constellations lit', L.starsAt[0], L.starsAt[1], `italic 500 ${13.5 * u}px ${T.SERIF}`, '#e6cfae', { align: L.starsAt[2] || 'left', alpha: 0.6 });
    hollow(ctx, L.hollow.x, L.hollow.y, L.hollow.rx, L.hollow.ry, r, u);
    K.text(ctx, 'the Hollow', L.hollow.tx, L.hollow.ty, `italic 600 ${22 * u}px ${T.SERIF}`, '#fff1d8', { align: L.hollow.align || 'left', alpha: 0.5 });
    // the beam: a soft volume of light from the lamp to every world whose song is home, and (fainter) to the one chosen
    ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.filter = `blur(${11 * u}px)`;
    for (const [id, a] of [['heroes', L.beam ? 0.18 : 0.3], ['skyhigh', L.beam ? 0.62 : 0.12]]) {
      const p = L.planets[id], c = PL[id].lit, ang = Math.atan2(p.y - lamp[1], p.x - lamp[0]), d = Math.hypot(p.x - lamp[0], p.y - lamp[1]) + p.r, hw = Math.min(0.3, (p.r * 1.25) / d);
      const g = ctx.createLinearGradient(lamp[0], lamp[1], p.x, p.y); g.addColorStop(0, rgba(c, a)); g.addColorStop(1, rgba(c, a * 0.3));
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(lamp[0], lamp[1]); ctx.lineTo(lamp[0] + Math.cos(ang - hw) * d, lamp[1] + Math.sin(ang - hw) * d); ctx.lineTo(lamp[0] + Math.cos(ang + hw) * d, lamp[1] + Math.sin(ang + hw) * d); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    // the road Eko travels, as dabs of light from world to world and on toward the Hollow
    const stops = [...['heroes', 'skyhigh', 'blank', 'invincible'].map((id) => [L.planets[id].x, L.planets[id].y]), [L.hollow.x, L.hollow.y + L.hollow.ry * 0.5]];
    for (let i = 0; i + 1 < stops.length; i++) { const n = Math.round(Math.hypot(stops[i + 1][0] - stops[i][0], stops[i + 1][1] - stops[i][1]) / (17 * u)); for (let k = 1; k < n; k++) { const t = k / n, bend = Math.sin(t * Math.PI) * 40 * u * (i % 2 ? -1 : 1); ctx.fillStyle = rgba([255, 226, 170], i < 1 ? 0.75 : 0.24); ctx.beginPath(); ctx.ellipse(lerp(stops[i][0], stops[i + 1][0], t) + bend * 0.4, lerp(stops[i][1], stops[i + 1][1], t) + bend, 2.6 * u, 1.9 * u, r() * 3, 0, TAU); ctx.fill(); } }
    // far worlds first, the chosen one last
    const order = Object.keys(L.planets).sort((a, b) => L.planets[a].r - L.planets[b].r);
    for (const id of order) planet(ctx, id, L.planets[id], lamp, r, u, id === 'skyhigh');
    // the land: haze where it meets the sky, then ridges, nearer and darker, each with the lamp's light on its crest
    const hy = h * L.horizon;
    ctx.save(); ctx.filter = `blur(${28 * u}px)`; ctx.fillStyle = rgba(L.sky[L.sky.length - 1][1], 0.3); ctx.fillRect(-40, hy - 30 * u, w + 80, 70 * u); ctx.restore();
    if (L.sea) {
      // water to the horizon: it holds the last of the sky, and under each lit world and the lamp a broken path of its light
      T.ridge(ctx, w, h, hy - 10 * u, 9 * u, seed + 2, [52, 30, 72], L.lantern.x, [255, 205, 140], 0.5); // the far shore, low; the water lies in front of it
      const g = ctx.createLinearGradient(0, hy, 0, h); g.addColorStop(0, rgba(mix(L.sky[L.sky.length - 1][1], [60, 30, 70], 0.3))); g.addColorStop(0.3, 'rgb(70,36,84)'); g.addColorStop(1, 'rgb(12,8,28)');
      ctx.fillStyle = g; ctx.fillRect(0, hy + 6 * u, w, h - hy);
      const paths = [[lamp[0], [255, 214, 150], 1], ...Object.keys(L.planets).filter((id) => L.planets[id].state !== 'dark').map((id) => [L.planets[id].x, PL[id].lit, L.planets[id].state === 'home' ? 0.8 : 0.5])];
      ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.lineCap = 'round';
      for (const [px, c, a] of paths) for (let k = 0; k < 46; k++) { const t = k / 46, y = hy + 8 * u + t * (h - hy) * 0.9, half = (10 + t * 46) * u * (0.4 + r()); ctx.strokeStyle = rgba(c, Math.min(1, a * (0.95 - t * 0.8) * (0.5 + r() * 0.5))); ctx.lineWidth = (1.4 + t * 3) * u; ctx.beginPath(); ctx.moveTo(px - half + (r() - 0.5) * 24 * u, y); ctx.lineTo(px + half + (r() - 0.5) * 24 * u, y + (r() - 0.5) * 2); ctx.stroke(); }
      ctx.restore();
      // the headland the Lantern stands on, on its own side of the picture
      const hx = L.lantern.x, hw = 330 * L.lantern.s, hd = (h - L.lantern.y) + 40 * u;
      ctx.fillStyle = 'rgb(16,11,32)'; ctx.beginPath(); ctx.moveTo(hx - hw, h + 10); ctx.quadraticCurveTo(hx - hw * 0.5, L.lantern.y + 10 * u, hx - 40 * L.lantern.s, L.lantern.y + 22 * u); ctx.quadraticCurveTo(hx + hw * 0.45, L.lantern.y + 30 * u, hx + hw, h + 10); ctx.lineTo(hx + hw, h + hd); ctx.closePath(); ctx.fill();
    } else L.ridges.forEach(([dy, amp, c, rim], i) => T.ridge(ctx, w, h, hy + dy * u, amp * u, seed + i * 5, c, L.lantern.x, [255, 205, 140], rim));
    K.glow(ctx, lamp[0], lamp[1], 150 * L.lantern.s, [255, 214, 150], 0.6);
    T.lighthouse(ctx, L.lantern.x, L.lantern.y, L.lantern.s, r);
    K.text(ctx, 'the Lantern', L.lantern.tx, L.lantern.ty, `italic 600 ${19 * u}px ${T.SERIF}`, '#fff1d8', { align: L.lantern.align || 'left', alpha: 0.85 });
    K.text(ctx, 'Eko’s glows  ·  settings', L.lantern.tx, L.lantern.ty + 20 * u, `italic 500 ${13.5 * u}px ${T.SERIF}`, '#e6cfae', { align: L.lantern.align || 'left', alpha: 0.6 });
    K.text(ctx, 'lens: 5 of 15 shards', L.lantern.tx, L.lantern.ty + 38 * u, `italic 500 ${13.5 * u}px ${T.SERIF}`, '#e6cfae', { align: L.lantern.align || 'left', alpha: 0.6 });
    const sel = L.planets.skyhigh;
    T.eko(ctx, L.eko.x, L.eko.y, L.eko.s, r, { wisp: true, lean: L.eko.lean || 0.2 });
    lines(ctx, L.detail, u);
    void sel;
    T.finish(ctx, w, h, seed + 9, 0.5);
  }
  const SKY = [[0, [9, 10, 34]], [0.42, [34, 28, 84]], [0.72, [96, 50, 104]], [0.9, [206, 104, 92]], [1, [248, 178, 122]]];
  const RIDGE = [[0, 30, [70, 40, 84], 0.4], [44, 26, [40, 24, 62], 0.7], [96, 22, [18, 12, 36], 0.9]];
  const phone = (o) => ({ u: 2, sky: SKY, ridges: RIDGE, ...o });
  const desk = (o) => ({ u: 1.15, sky: SKY, ridges: RIDGE, ...o });
  // phone: 780 x 1688 (a 390 x 844 screen at 2x). desktop: 1440 x 900.
  const LAYOUTS = {
    // 1. THE SHORE: the land along the bottom with the Lantern on its headland; the worlds hang over the sea of
    //    sky like moons, and the one you choose comes forward, low and large, with its lines beside it.
    shore: {
      phone: phone({ horizon: 0.74, sea: true, lantern: { x: 170, y: 1400, s: 1.6, tx: 286, ty: 1150 }, beam: false,
        planets: { heroes: { x: 590, y: 1010, r: 82, state: 'home', side: 'left' }, skyhigh: { x: 250, y: 700, r: 168, state: 'open' }, blank: { x: 640, y: 470, r: 54, state: 'dark', side: 'left' }, invincible: { x: 330, y: 300, r: 44, state: 'dark', side: 'right' } },
        hollow: { x: 700, y: 60, rx: 330, ry: 150, tx: 470, ty: 226 }, detail: { x: 446, y: 640, align: 'left' }, eko: { x: 120, y: 960, s: 0.36, lean: 0.3 },
        stars: [[90, 150], [170, 210], [120, 300], [220, 330], [60, 380]], starsAt: [70, 440] }),
      desktop: desk({ horizon: 0.74, sea: true, lantern: { x: 200, y: 740, s: 1.5, tx: 296, ty: 590 }, beam: false,
        planets: { heroes: { x: 330, y: 290, r: 70, state: 'home', side: 'right' }, skyhigh: { x: 730, y: 430, r: 150, state: 'open' }, blank: { x: 1110, y: 250, r: 56, state: 'dark', side: 'left' }, invincible: { x: 1290, y: 500, r: 46, state: 'dark', side: 'left' } },
        hollow: { x: 1330, y: 30, rx: 360, ry: 170, tx: 1010, ty: 96 }, detail: { x: 908, y: 390, align: 'left' }, eko: { x: 540, y: 560, s: 0.34 },
        stars: [[80, 110], [160, 160], [130, 250], [230, 230], [300, 130]], starsAt: [84, 300] })
    },
    // 2. THE ASCENT: the camera looks up a tall sky. The road climbs from the land at the very bottom to the Hollow at
    //    the top, the worlds left and right of it at different depths; choosing one glides the camera to it.
    ascent: {
      phone: phone({ horizon: 0.93, lantern: { x: 120, y: 1610, s: 1.05, tx: 196, ty: 1546 }, beam: false,
        planets: { heroes: { x: 230, y: 1290, r: 84, state: 'home', side: 'right' }, skyhigh: { x: 520, y: 900, r: 156, state: 'open' }, blank: { x: 210, y: 560, r: 60, state: 'dark', side: 'right' }, invincible: { x: 560, y: 350, r: 50, state: 'dark', side: 'left' } },
        hollow: { x: 400, y: 40, rx: 470, ry: 160, tx: 60, ty: 250 }, detail: { x: 330, y: 830, align: 'right' }, eko: { x: 430, y: 1130, s: 0.36 },
        stars: [[560, 1240], [640, 1310], [600, 1400], [700, 1440], [690, 1210]], starsAt: [726, 1500, 'right'] }),
      desktop: desk({ horizon: 0.9, lantern: { x: 130, y: 836, s: 1.1, tx: 210, ty: 770 }, beam: false,
        planets: { heroes: { x: 330, y: 640, r: 72, state: 'home', side: 'right' }, skyhigh: { x: 640, y: 460, r: 138, state: 'open' }, blank: { x: 960, y: 300, r: 58, state: 'dark', side: 'right' }, invincible: { x: 1170, y: 150, r: 48, state: 'dark', side: 'left' } },
        hollow: { x: 1440, y: 0, rx: 330, ry: 230, tx: 1180, ty: 270 }, detail: { x: 806, y: 540, align: 'left' }, eko: { x: 500, y: 520, s: 0.32 },
        stars: [[90, 130], [180, 200], [150, 300], [270, 280], [330, 150]], starsAt: [96, 350] })
    },
    // 3. THE BEAM: the Lantern stands tall on a crag to one side, and its beam is the cursor: it swings to the world
    //    you choose and lights it, and that world's lines are written along the edge of the light.
    beam: {
      phone: phone({ horizon: 0.84, lantern: { x: 600, y: 1470, s: 2.1, tx: 430, ty: 1500, align: 'right' }, beam: true,
        planets: { heroes: { x: 160, y: 1010, r: 76, state: 'home', side: 'right' }, skyhigh: { x: 250, y: 620, r: 150, state: 'open' }, blank: { x: 640, y: 400, r: 56, state: 'dark', side: 'left' }, invincible: { x: 250, y: 260, r: 46, state: 'dark', side: 'right' } },
        hollow: { x: 760, y: 50, rx: 300, ry: 150, tx: 560, ty: 232 }, detail: { x: 430, y: 590, align: 'left' }, eko: { x: 110, y: 850, s: 0.34, lean: 0.3 },
        stars: [[70, 1220], [150, 1280], [110, 1370], [220, 1390], [60, 1170]], starsAt: [60, 1440] }),
      desktop: desk({ horizon: 0.8, lantern: { x: 1180, y: 770, s: 2.0, tx: 1060, ty: 800, align: 'right' }, beam: true,
        planets: { heroes: { x: 210, y: 560, r: 68, state: 'home', side: 'right' }, skyhigh: { x: 560, y: 380, r: 146, state: 'open' }, blank: { x: 930, y: 190, r: 54, state: 'dark', side: 'left' }, invincible: { x: 300, y: 170, r: 46, state: 'dark', side: 'right' } },
        hollow: { x: 1420, y: 20, rx: 330, ry: 170, tx: 1110, ty: 120 }, detail: { x: 738, y: 330, align: 'left' }, eko: { x: 820, y: 560, s: 0.32, lean: -0.3 },
        stars: [[80, 300], [160, 360], [120, 440], [230, 430], [60, 250]], starsAt: [70, 490] })
    }
  };
  return { LAYOUTS, draw: (ctx, w, h, name, dev) => scene(ctx, w, h, LAYOUTS[name][dev], { shore: 101, ascent: 211, beam: 307 }[name] + (dev === 'phone' ? 0 : 1)) };
})();
