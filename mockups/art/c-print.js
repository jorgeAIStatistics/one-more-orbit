// Direction C: "Night Press". A screen-printed poster: one flood of midnight ink on cream stock, two or three spot
// inks per planet, halftone for every gradient, shapes that never quite register. Eko is a flame cut from two
// leaves of colour; the Hush is the top of the sheet printed solid black, with one slit left unprinted.
/* eslint-disable */
const PRINT = (() => {
  const { TAU, D, lerp, RNG, rgba, P } = K;
  const NAVY = '#141a3c', CREAM = '#f1e7d0', ORANGE = '#ff5a36', PINK = '#ff4f9a', AQUA = '#27cfc4', YELLOW = '#ffd23f', VIOLET = '#5a3fd0', GREEN = '#6fdc5a', BLACK = '#07070f';
  const HEAVY = '"Avenir Next Condensed", "Futura", "Arial Narrow", Impact, sans-serif';
  /** The sheet: cream stock, then the flood of night ink inside a margin, laid a little unevenly. */
  function sheet(ctx, w, h, r) {
    ctx.fillStyle = CREAM; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = NAVY; ctx.fillRect(30, 30, w - 60, h - 60);
    ctx.save(); ctx.beginPath(); ctx.rect(30, 30, w - 60, h - 60); ctx.clip();
    for (let i = 0; i < 26; i++) K.glow(ctx, r() * w, r() * h, 120 + r() * 260, r() < 0.5 ? [40, 50, 110] : [8, 10, 30], 0.18, 'source-over');
  }
  /** Closes the sheet: ink never lies flat, so grain goes over all of it; then registration marks in the margin. */
  function finish(ctx, w, h, seed, tag) {
    ctx.restore();
    K.lay(ctx, K.texture(w, h, seed, { fine: 0.85, mottle: 0.3, scale: 0.02 }), 'overlay', 0.3);
    K.lay(ctx, K.texture(w, h, seed + 1, { fine: 0.2, mottle: 0.6, scale: 0.004 }), 'multiply', 0.22);
    ctx.strokeStyle = NAVY; ctx.lineWidth = 1;
    for (const [x, y] of [[15, 15], [w - 15, 15], [15, h - 15], [w - 15, h - 15]]) { ctx.beginPath(); ctx.arc(x, y, 5, 0, TAU); ctx.moveTo(x - 9, y); ctx.lineTo(x + 9, y); ctx.moveTo(x, y - 9); ctx.lineTo(x, y + 9); ctx.stroke(); }
    [ORANGE, PINK, AQUA, YELLOW].forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(w / 2 - 34 + i * 17, h - 21, 14, 9); });
    K.text(ctx, tag, 44, h - 12, `700 9px ${HEAVY}`, NAVY, { align: 'left', ls: 2 });
  }
  const disc = (x, y, R) => (c) => { c.beginPath(); c.arc(x, y, R, 0, TAU); };
  const fill = (ctx, shape, col) => { shape(ctx); ctx.fillStyle = col; ctx.fill(); };
  /** A planet: one flat ink, a second ink in bands, and its shade as halftone on the side away from the light. */
  function planet(ctx, x, y, R, a, b, la, bandsY = [-0.25, 0.3], dim = false) {
    const lx = Math.cos(la * D), ly = Math.sin(la * D);
    fill(ctx, disc(x + 5, y - 4, R), dim ? '#2a3166' : b); // the second ink, out of register
    fill(ctx, disc(x, y, R), dim ? '#222a5c' : a);
    if (!dim) { ctx.save(); disc(x, y, R)(ctx); ctx.clip(); ctx.fillStyle = b; for (const by of bandsY) { ctx.beginPath(); ctx.ellipse(x, y + by * R, R * 1.2, R * 0.13, -0.2, 0, TAU); ctx.fill(); } ctx.restore(); }
    K.halftone(ctx, disc(x, y, R), [x - R, y - R, R * 2, R * 2], (px, py) => { const d = ((px - x) * -lx + (py - y) * -ly) / R; return (d + 0.25) * 0.85; }, Math.max(4, R * 0.085), NAVY, 0.5);
  }
  /** Eko: two leaves of flame, one over the other and never quite in register, a seed of unprinted paper, and a ring. */
  function eko(ctx, x, y, s, rot = 0.16, echo = true) {
    const flame = (k, dx = 0, dy = 0) => (c) => { c.beginPath(); c.moveTo(dx, 56 * k + dy); c.bezierCurveTo(-58 * k + dx, 40 * k + dy, -56 * k + dx, -50 * k + dy, 8 * k + dx, -150 * k + dy); c.bezierCurveTo(30 * k + dx, -70 * k + dy, 62 * k + dx, -10 * k + dy, dx, 56 * k + dy); c.closePath(); };
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
    if (echo) for (let k = 3; k >= 1; k--) { ctx.save(); ctx.translate(-k * 46, k * 62); ctx.rotate(-k * 0.07); K.halftone(ctx, flame(1 - k * 0.12), [-70, -160, 140, 230], () => 0.7 - k * 0.17, 7, YELLOW, 0.4); ctx.restore(); } // where he has just been
    const hoop = (a0, a1) => { ctx.save(); ctx.translate(0, 18); ctx.rotate(-0.35); ctx.strokeStyle = AQUA; ctx.lineWidth = 11; ctx.beginPath(); ctx.ellipse(0, 0, 96, 30, 0, a0, a1); ctx.stroke(); ctx.restore(); };
    hoop(Math.PI, TAU);
    fill(ctx, flame(1), ORANGE);
    fill(ctx, flame(0.66, 4, 16), PINK);
    fill(ctx, flame(0.36, 2, 30), YELLOW);
    ctx.strokeStyle = AQUA; ctx.lineWidth = 2.5; flame(1, 7, -5)(ctx); ctx.stroke(); // the key line, printed a little off
    fill(ctx, (c) => { c.beginPath(); c.arc(1, 30, 9, 0, TAU); }, CREAM);
    hoop(0.1, Math.PI - 0.1);
    ctx.restore();
  }
  /** The Hush: the top of the sheet printed solid, quilted in a second dark ink, with a rim out of register and one slit of bare paper. */
  function hush(ctx, cx, cy, R, r, slitY, slitW) {
    K.halftone(ctx, null, [cx - R - 200, cy, (R + 200) * 2, R + 260], (x, y) => { const d = Math.hypot(x - cx, y - cy); return d < R ? 0 : 0.8 - (d - R) / 230; }, 9, BLACK, 0.3); // its shadow falls ahead of it
    ctx.strokeStyle = PINK; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(cx + 9, cy + 7, R, 0, TAU); ctx.stroke();
    fill(ctx, disc(cx, cy, R), BLACK);
    ctx.save(); disc(cx, cy, R)(ctx); ctx.clip();
    ctx.strokeStyle = '#231a4f'; ctx.lineWidth = 3;
    for (let row = 0; row < 14; row++) for (let k = -14; k <= 14; k++) { const sx = cx + k * 72 + (row % 2) * 36, sy = cy + R - 30 - row * 44; ctx.beginPath(); ctx.arc(sx, sy, 36, 0, Math.PI); ctx.stroke(); }
    ctx.restore();
    // the slit: bare paper, heavy-lidded, with the pupil a bar of the same black
    ctx.fillStyle = CREAM; ctx.beginPath(); ctx.moveTo(cx - slitW, slitY); ctx.quadraticCurveTo(cx, slitY + slitW * 0.16, cx + slitW, slitY); ctx.quadraticCurveTo(cx, slitY + slitW * 0.05, cx - slitW, slitY); ctx.fill();
    ctx.fillStyle = BLACK; ctx.fillRect(cx - slitW * 0.09, slitY + slitW * 0.02, slitW * 0.18, slitW * 0.09);
  }
  function lighthouse(ctx, x, y, s) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.fillStyle = VIOLET; ctx.beginPath(); ctx.arc(0, 46, 96, Math.PI, TAU); ctx.fill();
    ctx.rotate(-0.09);
    ctx.fillStyle = PINK; ctx.beginPath(); ctx.moveTo(-19, 22); ctx.lineTo(31, 22); ctx.lineTo(20, -112); ctx.lineTo(-8, -112); ctx.closePath(); ctx.fill(); // the second ink, off register
    ctx.fillStyle = CREAM; ctx.beginPath(); ctx.moveTo(-25, 22); ctx.lineTo(25, 22); ctx.lineTo(14, -112); ctx.lineTo(-14, -112); ctx.closePath(); ctx.fill();
    ctx.fillStyle = ORANGE; for (const [a, b] of [[-6, -34], [-62, -90]]) { ctx.beginPath(); ctx.moveTo(-24 - a * 0.082, a); ctx.lineTo(24 + a * 0.082, a); ctx.lineTo(24 + b * 0.082, b); ctx.lineTo(-24 - b * 0.082, b); ctx.closePath(); ctx.fill(); }
    ctx.fillStyle = NAVY; ctx.fillRect(-20, -120, 40, 8);
    ctx.fillStyle = YELLOW; ctx.fillRect(-12, -146, 24, 26);
    ctx.fillStyle = ORANGE; ctx.beginPath(); ctx.moveTo(-18, -146); ctx.lineTo(0, -174); ctx.lineTo(18, -146); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  const tagLabel = (ctx, name, sub, x, y, rot, col = CREAM) => {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    ctx.font = `800 24px ${HEAVY}`; try { ctx.letterSpacing = '3px'; } catch (e) { /* older engines */ }
    const tw = ctx.measureText(name.toUpperCase()).width + 22;
    ctx.fillStyle = col; ctx.fillRect(-tw / 2, -22, tw, 31);
    ctx.fillStyle = NAVY; ctx.textAlign = 'center'; ctx.fillText(name.toUpperCase(), 0, 2);
    ctx.restore();
    if (sub) K.text(ctx, sub.toUpperCase(), x, y + 28, `700 11px ${HEAVY}`, CREAM, { ls: 3, rot });
  };

  return {
    hero(ctx, w, h) {
      const r = RNG(7);
      sheet(ctx, w, h, r);
      K.halftone(ctx, null, [0, 0, w, h], (x, y) => (x + (h - y) * 0.9 > 760 && x + (h - y) * 0.9 < 930 ? 0.1 : 0), 9, CREAM, 0.26); // a beam across the whole sheet
      fill(ctx, disc(742, 372, 268), '#243074');
      K.halftone(ctx, disc(742, 372, 268), [470, 100, 540, 540], (x, y) => 0.12 + (y - 104) / 560 * 0.9, 10, ORANGE, 0.26); // the world he is leaving, as one disc of dots
      ctx.strokeStyle = YELLOW; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(742, 372, 286, -1.2, 0.5); ctx.stroke();
      eko(ctx, 748, 430, 1.62);
      K.text(ctx, 'EKO', 70, 690, `800 190px ${HEAVY}`, CREAM, { align: 'left', ls: 4 });
      ctx.fillStyle = ORANGE; ctx.fillRect(74, 706, 250, 9);
      K.text(ctx, 'A SPARK FROM THE LANTERN', 74, 742, `700 16px ${HEAVY}`, CREAM, { align: 'left', ls: 5 });
      K.text(ctx, 'ONE MORE ORBIT', w - 70, 86, `800 20px ${HEAVY}`, YELLOW, { align: 'right', ls: 8 });
      finish(ctx, w, h, 13, 'ONE MORE ORBIT · 1/4 · HERO');
    },
    boss(ctx, w, h) {
      const r = RNG(19);
      sheet(ctx, w, h, r);
      hush(ctx, 600, -170, 640, r, 300, 150);
      const jars = [[300, 590, ORANGE], [450, 640, PINK], [600, 664, YELLOW], [750, 640, AQUA], [900, 590, GREEN]];
      for (const [x, y, c] of jars) {
        ctx.strokeStyle = CREAM; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, 470 - Math.pow((x - 600) / 300, 2) * 60); ctx.lineTo(x, y - 30); ctx.stroke();
        ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, 28, 0, TAU); ctx.stroke();
        fill(ctx, disc(x + 3, y - 2, 11), c);
      }
      fill(ctx, disc(600, 742, 26), YELLOW);
      eko(ctx, 600, 742, 0.2, 0, false);
      K.text(ctx, 'THE', w - 76, 628, `800 54px ${HEAVY}`, PINK, { align: 'right', ls: 10 });
      K.text(ctx, 'HUSH', w - 70, 744, `800 150px ${HEAVY}`, CREAM, { align: 'right', ls: 6 });
      K.text(ctx, 'IT CANNOT BEAR A SOUND', 74, 742, `700 16px ${HEAVY}`, CREAM, { align: 'left', ls: 5 });
      finish(ctx, w, h, 23, 'ONE MORE ORBIT · 2/4 · BOSS');
    },
    map(ctx, w, h) {
      const r = RNG(31);
      sheet(ctx, w, h, r);
      const L = [600, 470], lamp = [588, 336];
      for (const [tx, ty, c] of [[240, 610, YELLOW], [960, 590, PINK]]) { // the beam: a wedge of dots, heavier near the lamp
        const a = Math.atan2(ty - lamp[1], tx - lamp[0]), d = Math.hypot(tx - lamp[0], ty - lamp[1]);
        K.halftone(ctx, (cc) => { cc.beginPath(); cc.moveTo(lamp[0], lamp[1]); cc.lineTo(lamp[0] + Math.cos(a - 0.2) * (d + 40), lamp[1] + Math.sin(a - 0.2) * (d + 40)); cc.lineTo(lamp[0] + Math.cos(a + 0.2) * (d + 40), lamp[1] + Math.sin(a + 0.2) * (d + 40)); cc.closePath(); }, [0, 0, w, h], (x, y) => 0.75 - Math.hypot(x - lamp[0], y - lamp[1]) / d * 0.6, 8, c, 0.3);
      }
      const road = [[240, 610], [960, 590], [290, 236], [925, 232], [600, 40]];
      ctx.lineWidth = 6; ctx.lineCap = 'butt';
      for (let i = 0; i + 1 < road.length; i++) { ctx.strokeStyle = i < 1 ? CREAM : '#4a5296'; ctx.setLineDash([16, 12]); ctx.beginPath(); ctx.moveTo(road[i][0], road[i][1]); ctx.quadraticCurveTo((road[i][0] + road[i + 1][0]) / 2, (road[i][1] + road[i + 1][1]) / 2 + (i % 2 ? -70 : 70), road[i + 1][0], road[i + 1][1]); ctx.stroke(); }
      ctx.setLineDash([]);
      hush(ctx, 600, -250, 400, r, 96, 70);
      const la = (x, y) => Math.atan2(lamp[1] - y, lamp[0] - x) / D;
      planet(ctx, 240, 610, 78, ORANGE, YELLOW, la(240, 610));
      planet(ctx, 960, 590, 70, PINK, CREAM, la(960, 590), [-0.1, 0.35]);
      planet(ctx, 290, 236, 60, AQUA, CREAM, la(290, 236), [0], true);
      planet(ctx, 925, 232, 70, GREEN, YELLOW, la(925, 232), [0], true);
      lighthouse(ctx, L[0], L[1], 1);
      fill(ctx, disc(1052, 506, 22), YELLOW);
      eko(ctx, 1052, 510, 0.17, 0, false);
      tagLabel(ctx, 'Emberwick', 'Heroes Tonight', 250, 716, -0.04);
      tagLabel(ctx, 'Cirra', 'Sky High', 960, 688, 0.04);
      tagLabel(ctx, 'Glassmere', 'dark and silent', 300, 324, 0.03, '#8d95c8');
      tagLabel(ctx, 'Verdance', 'dark and silent', 925, 330, -0.03, '#8d95c8');
      K.text(ctx, 'THE GALAXY', 64, 108, `800 50px ${HEAVY}`, CREAM, { align: 'left', ls: 4 });
      K.text(ctx, 'OF THE LANTERN', 66, 138, `800 24px ${HEAVY}`, YELLOW, { align: 'left', ls: 6 });
      finish(ctx, w, h, 37, 'ONE MORE ORBIT · 3/4 · MAP');
    },
    play(ctx, w, h) {
      const r = RNG(43), G = K.G;
      sheet(ctx, w, h, r);
      // the drop: the sheet splits into wedges of two inks, all halftone, turning round the planet
      for (let k = 0; k < 14; k++) {
        const a0 = (k / 14) * TAU + 0.1, a1 = a0 + TAU / 28;
        K.halftone(ctx, (c) => { c.beginPath(); c.moveTo(G.cx, G.cy); c.arc(G.cx, G.cy, 900, a0, a1); c.closePath(); }, [0, 0, w, h], (x, y) => Math.min(0.85, Math.max(0, (Math.hypot(x - G.cx, y - G.cy) - 300) / 420)), 9, k % 2 ? ORANGE : PINK, 0.3);
      }
      ctx.strokeStyle = YELLOW; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(G.cx, G.cy, 396, 2.2, 3.6); ctx.stroke(); ctx.beginPath(); ctx.arc(G.cx, G.cy, 396, -0.5, 0.7); ctx.stroke();
      fill(ctx, disc(G.cx, G.cy, 352), 'rgba(13,17,42,0.9)'); // the course sits on a plain disc of the night ink
      finish(ctx, w, h, 47, 'ONE MORE ORBIT · 4/4 · THE DROP');
      planet(ctx, G.cx, G.cy, G.planet, ORANGE, YELLOW, 225);
      K.playFG(ctx, {
        faint: 'rgba(241,231,208,0.2)', faintW: 1.6, meterBack: 'rgba(241,231,208,0.2)', meterW: 6, goldCol: YELLOW, dots: CREAM, cap: 'butt',
        halo: 'rgba(7,7,15,0.9)', ring: CREAM, ringW: 7, danger: '#ff3d5e', dangerCore: null, markLen: 19, markW: 8,
        dangerDecor(c, g) { c.strokeStyle = BLACK; c.lineWidth = 3; for (let a = g.ceil[0] + 2; a < g.ceil[1]; a += 4.5) { const [x0, y0] = P(g.cx, g.cy, a, g.r[2] - 5), [x1, y1] = P(g.cx, g.cy, a + 2.2, g.r[2] + 5); c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); } },
        gold(c, x, y) { fill(c, disc(x, y, 12), BLACK); fill(c, disc(x, y, 9), YELLOW); fill(c, disc(x, y, 3.4), NAVY); },
        shard(c, x, y) { for (const [dx, dy, col] of [[4, -3, PINK], [0, 0, CREAM]]) { c.fillStyle = col; c.beginPath(); c.moveTo(x + 1 + dx, y - 17 + dy); c.lineTo(x + 12 + dx, y - 2 + dy); c.lineTo(x + 3 + dx, y + 17 + dy); c.lineTo(x - 11 + dx, y + 4 + dy); c.closePath(); c.fill(); } },
        lens(c, x, y, rot) { c.save(); c.translate(x, y); c.rotate(rot); for (const [dx, col] of [[5, PINK], [0, AQUA]]) { c.fillStyle = col; c.beginPath(); c.moveTo(dx, -38); c.quadraticCurveTo(18 + dx, 0, dx, 38); c.quadraticCurveTo(-18 + dx, 0, dx, -38); c.fill(); } c.restore(); },
        eko(c, x, y, trail) {
          c.strokeStyle = ORANGE; c.lineWidth = 9; c.setLineDash([3, 9]); c.beginPath(); trail.forEach(([px, py], i) => (i ? c.lineTo(px, py) : c.moveTo(px, py))); c.stroke(); c.setLineDash([]);
          fill(c, disc(x, y, 19), BLACK);
          eko(c, x, y + 6, 0.2, 1.3, false);
        },
        hud(c) {
          K.text(c, '62%', 600, 96, `800 62px ${HEAVY}`, CREAM, { ls: 2 });
          K.text(c, 'EMBERWICK · THE DROP', 600, 118, `700 12px ${HEAVY}`, YELLOW, { ls: 6 });
          c.fillStyle = 'rgba(241,231,208,0.25)'; c.fillRect(80, h - 60, w - 160, 8); c.fillStyle = YELLOW; c.fillRect(80, h - 60, (w - 160) * 0.62, 8);
        }
      });
    }
  };
})();
