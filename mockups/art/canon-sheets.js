// The sheets of the revised bible: the cast, the opening's animatic, and the supporting stills. Each is one canvas.
/* eslint-disable */
const SHEETS = (() => {
  const { RNG, rgba, mix, TAU, lerp } = K, T = DUSK.tools, P = CANON.parts, W = CANON.parts.words, PAL = CANON.pal;
  const cap = (ctx, s, x, y, px = 21, o = {}) => W(ctx, s, x, y, px, { color: '#e9dcc0', alpha: 0.95, ...o });
  const sub = (ctx, s, x, y, px = 17, o = {}) => W(ctx, s, x, y, px, { color: '#e6cfae', alpha: 0.86, ...o });
  const backdrop = (ctx, w, h, seed, stops) => { const r = RNG(seed); T.sky(ctx, w, h, stops, r, 120); return r; };
  const floor = (ctx, w, y) => { ctx.strokeStyle = 'rgba(255,236,206,0.14)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(40, y); ctx.lineTo(w - 40, y); ctx.stroke(); };
  const wrap = (ctx, text, x, y, maxW, px = 17, lh = 21) => { ctx.font = `italic 500 ${px}px "Cormorant Garamond", Georgia, serif`; ctx.fillStyle = '#e9dcc0'; ctx.textBaseline = 'top'; let line = '', yy = y; for (const word of text.split(' ')) { if (ctx.measureText(line + word).width > maxW && line) { ctx.fillText(line.trim(), x, yy); yy += lh; line = ''; } line += word + ' '; } ctx.fillText(line.trim(), x, yy); ctx.textBaseline = 'alphabetic'; return yy + lh; };
  /** Frames in a grid, each with what happens under it. draw(id) paints one frame at fw2 x fh2 (twice the cell). */
  const grid = (frames, cols, fw, fh, paint, capH = 76) => { const gap = 16, rows = Math.ceil(frames.length / cols); return { w: cols * fw + (cols - 1) * gap, h: rows * (fh + capH) + (rows - 1) * gap, draw(ctx, w, h) { ctx.fillStyle = '#0b0a14'; ctx.fillRect(0, 0, w, h); ctx.imageSmoothingQuality = 'high'; frames.forEach(([id, text], i) => { const cv = document.createElement('canvas'); cv.width = fw * 2; cv.height = fh * 2; paint(cv.getContext('2d'), id, cv.width, cv.height); const x = (i % cols) * (fw + gap), y = Math.floor(i / cols) * (fh + capH + gap); ctx.drawImage(cv, x, y, fw, fh); wrap(ctx, text, x + 4, y + fh + 8, fw - 10); }); } }; };
  const anim = (frames, cols) => grid(frames, cols, 390, 844, (c, id) => CANON.A[id](c));

  // ---- supporting stills (phone, 780 x 1688)
  const S = {
    // a memory of Helion: the Harmonic Nebula, all gold; the brothers on one orbit, opposite each other, one tap for both
    memory(ctx, w, h) { CANON.play(ctx, w, h, 'phone', { twin: true, nodes: [[0.9, 0.6, 1], [0.9, 1.5, 0.5]] });
      W(ctx, 'a memory', 44, 124, 30, { alpha: 0.85 }); W(ctx, 'the Harmonic Nebula', 44, 162, 28, { color: '#ffe9b8', alpha: 0.9 });
      W(ctx, '“Keep up, little brother.”', w / 2, h * 0.84, 40, { align: 'center' }); W(ctx, '“We’re the same age.”', w / 2, h * 0.84 + 56, 34, { align: 'center', color: '#ffe9b8', alpha: 0.9 }); },
    // the play view, with the old names beside the new
    play(ctx, w, h) { CANON.play(ctx, w, h, 'phone', { nodes: [[0.9, 0.55, 0.9], [0.9, 1.5, 0.45]], lit: 0.3, hud: true }); },
    // the hub: the planetoid where he fell, at nothing woken, one star, and four
    hub(ctx, w, h, n) { const r = RNG(401), hy = h * 0.6, k = n / 4;
      T.sky(ctx, w, h, PAL.DRIFT.map(([t, c], i) => [t, mix(c, PAL.WOKEN[Math.min(4, i + (i > 1 ? 1 : 0))][1], k * 0.85)]), r, 110); T.stars(ctx, w, hy, r, Math.round(120 + k * 800), 3);
      // the galaxy's edge: always there. The guardian under the three rings; its wall of shadow cracks as stars are woken
      P.trials(ctx, w * 0.62, h * 0.2, 1.0, RNG(41), 1 - k * 0.3); for (let i = 0; i < 8 - n; i++) K.brush(ctx, [[w * 0.3 + r() * w * 0.6, h * 0.24 + r() * 160], [w * 0.36 + r() * w * 0.5, h * 0.3 + r() * 160]], 70, [5, 6, 16], r, { passes: 3, alpha: 0.22 });
      P.guardian(ctx, w * 0.64, hy + 4, 0.3, RNG(42), n >= 4 ? 2 : n >= 1 ? 1 : 0);
      // the path of woken stars toward it: lit a stretch at a time
      const stops = [[w * 0.2, hy - 40], [w * 0.36, hy - 170], [w * 0.3, hy - 330], [w * 0.48, hy - 440], [w * 0.6, hy - 380]];
      for (let i = 0; i + 1 < stops.length; i++) { const on = i < n, [x0, y0] = stops[i], [x1, y1] = stops[i + 1], m = Math.round(Math.hypot(x1 - x0, y1 - y0) / 22); for (let j = 1; j < m; j++) { const q = j / m; ctx.fillStyle = on ? 'rgba(255,226,160,0.9)' : 'rgba(150,165,205,0.22)'; ctx.beginPath(); ctx.arc(lerp(x0, x1, q), lerp(y0, y1, q) + Math.sin(q * Math.PI) * 14, on ? 3.4 : 2.4, 0, TAU); ctx.fill(); } }
      [[214, 96, 60], [220, 110, 190], [110, 160, 230], [70, 160, 110]].forEach((c, i) => { const [x, y] = stops[i + 1].map((v, q) => v + (q ? 0 : 0)); const on = i < n; T.sphere(ctx, x, y, 34 - i * 3, on ? c : [52, 60, 86], on ? mix(c, [255, 255, 255], 0.5) : [110, 122, 160], [16, 18, 36], 200, r, { haze: on ? 0.4 : 0.05 }); });
      const G = P.ground(ctx, w, h, hy, RNG(17), k * 0.9);
      // what gathers there: the crater where he fell (always), then a fire, kites, a still pool, a tree of seed-lights
      ctx.fillStyle = 'rgba(6,7,16,0.7)'; ctx.beginPath(); ctx.ellipse(w * 0.3, hy + 190, 150, 34, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = `rgba(${n ? '255,214,150' : '150,165,205'},0.4)`; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(w * 0.3, hy + 190, 150, 34, 0, Math.PI, TAU); ctx.stroke();
      if (n >= 1) { K.glow(ctx, w * 0.62, hy + 250, 190, [255, 150, 70], 0.7); for (let i = 0; i < 5; i++) { ctx.fillStyle = rgba([255, 190 - i * 14, 90], 0.8); ctx.beginPath(); ctx.moveTo(w * 0.62 - 30 + i * 15, hy + 270); ctx.quadraticCurveTo(w * 0.62 - 24 + i * 13, hy + 210 - (i % 2) * 30, w * 0.62 - 14 + i * 9, hy + 180 - (i % 2) * 40); ctx.quadraticCurveTo(w * 0.62 + i * 12, hy + 230, w * 0.62 - 10 + i * 15, hy + 270); ctx.fill(); } }
      if (n >= 4) { for (let i = 0; i < 3; i++) { ctx.strokeStyle = 'rgba(255,236,246,0.5)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(w * 0.12 + i * 40, hy + 120); ctx.quadraticCurveTo(w * 0.1 + i * 50, hy - 40, w * 0.08 + i * 70, hy - 150 - i * 40); ctx.stroke(); ctx.fillStyle = rgba([255, 150, 220], 0.9); ctx.beginPath(); ctx.moveTo(w * 0.08 + i * 70, hy - 180 - i * 40); ctx.lineTo(w * 0.08 + i * 70 + 22, hy - 150 - i * 40); ctx.lineTo(w * 0.08 + i * 70, hy - 116 - i * 40); ctx.lineTo(w * 0.08 + i * 70 - 22, hy - 150 - i * 40); ctx.closePath(); ctx.fill(); }
        ctx.fillStyle = 'rgba(150,200,255,0.5)'; ctx.beginPath(); ctx.ellipse(w * 0.82, hy + 330, 110, 22, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(30,60,50,0.95)'; ctx.lineWidth = 14; ctx.beginPath(); ctx.moveTo(w * 0.9, hy + 190); ctx.quadraticCurveTo(w * 0.88, hy + 60, w * 0.92, hy - 60); ctx.stroke(); for (let i = 0; i < 12; i++) { const x = w * 0.92 + (r() - 0.5) * 150, y = hy - 60 + (r() - 0.6) * 150; K.glow(ctx, x, y, 24, [190, 255, 140], 0.7); ctx.fillStyle = 'rgba(236,255,170,0.95)'; ctx.beginPath(); ctx.arc(x, y, 3, 0, TAU); ctx.fill(); } }
      P.spark(ctx, w * 0.3, hy + 120, 1.0, { glow: 0.6 + 0.4 * k, eyes: n >= 4 ? 'set' : 'open', look: [0.9, -0.6], crest: 0.4 + 0.6 * k, arms: n >= 4 ? 'rest' : 'chest', beat: 0.3 + 0.7 * k });
      // Helion's signal: a pulse in Orbin's chest, and its echo far off behind the rings, clearer with every star
      for (let q = 0; q < 1 + n; q++) { ctx.strokeStyle = rgba([255, 214, 130], 0.5 - q * 0.08); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(w * 0.66, h * 0.17, 14 + q * 16, 0, TAU); ctx.stroke(); } K.glow(ctx, w * 0.66, h * 0.17, 20 + n * 10, [255, 200, 110], 0.5 + 0.1 * n);
      T.finish(ctx, w, h, 410 + n, 0.45); },
    hub0(ctx, w, h) { S.hub(ctx, w, h, 0); }, hub1(ctx, w, h) { S.hub(ctx, w, h, 1); }, hub4(ctx, w, h) { S.hub(ctx, w, h, 4); },
    // the Stillness reaching a world mid-level: the picture skips, the beat is lost
    still(ctx, w, h) { CANON.play(ctx, w, h, 'phone', { nodes: [[0.9, 0.6, 0.8]], lit: 0.5 }); P.stillness(ctx, w * 0.9, h * 0.3, 420, 520, RNG(77), { near: 1, rot: 0.3 });
      ctx.save(); ctx.globalAlpha = 0.35; ctx.drawImage(ctx.canvas, 26, 0); ctx.restore(); // the picture, doubled: it has skipped
      W(ctx, 'the music stutters: for two beats there is no beat', w / 2, h * 0.86, 30, { align: 'center' }); },
    // the guardian fight, phase three: Helion's echo beside him
    fight(ctx, w, h) { const r = RNG(91); T.sky(ctx, w, h, PAL.DRIFT.map(([t, c]) => [t, mix(c, [60, 30, 70], 0.4)]), r, 100);
      P.trials(ctx, w * 0.5, h * 0.12, 1.3, RNG(41)); P.guardian(ctx, w * 0.5, h * 0.62, 0.62, RNG(42), 2);
      const cx = w / 2, cy = h * 0.72; for (const [R, a] of [[190, 0.9], [270, 0.5]]) { ctx.strokeStyle = `rgba(255,240,200,${a})`; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke(); }
      const nx = cx + Math.cos(-0.9) * 190, ny = cy + Math.sin(-0.9) * 190; ctx.fillStyle = 'rgba(8,8,22,0.85)'; ctx.beginPath(); ctx.arc(nx, ny, 34, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); for (let i = 0; i < 10; i++) { const q = -Math.PI / 2 + i * TAU / 10, rr = i % 2 ? 10 : 23; ctx.lineTo(nx + Math.cos(q) * rr, ny + Math.sin(q) * rr); } ctx.closePath(); ctx.fill(); ctx.strokeStyle = 'rgba(255,214,130,0.95)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(nx, ny, 60, 0, TAU); ctx.stroke();
      P.spark(ctx, cx + Math.cos(-2.2) * 190, cy + Math.sin(-2.2) * 190 + 10, 0.62, { glow: 1, eyes: 'set', lean: 0.5, arms: 'back', ring: false });
      ctx.globalAlpha = 0.6; P.spark(ctx, cx + Math.cos(-2.2 + Math.PI) * 190, cy + Math.sin(-2.2 + Math.PI) * 190 + 10, 0.62, { who: 'helion', glow: 1, eyes: 'set', lean: -0.5, arms: 'back', face: -1 }); ctx.globalAlpha = 1;
      T.finish(ctx, w, h, 93, 0.45); W(ctx, 'the last trial of this galaxy: his echo flies it with you', w / 2, h * 0.95, 30, { align: 'center' }); }
  };
  const still = (frames, cols) => grid(frames, cols, 390, 844, (c, id, w, h) => S[id](c, w, h));

  return {
    // ---- the twins: to scale with each other, five moods each
    'cast-twins': { w: 1800, h: 1000, draw(ctx, w, h) {
      backdrop(ctx, w, h, 301, [[0, [8, 9, 26]], [0.6, [22, 22, 60]], [1, [50, 36, 78]]]); T.finish(ctx, w, h, 302, 0.45);
      cap(ctx, 'Orbin', 70, 78, 46); sub(ctx, 'golden, the smaller twin, a little fragile. A thin orbit round his head; a plume that shows how he is.', 70, 110, 20);
      floor(ctx, w, 470);
      const O = [[{ glow: 0.14, eyes: 'closed', crest: 0, arms: 'rest' }, 'nearly out'], [{ glow: 0.9, eyes: 'wide', crest: 0.95, arms: 'chest', look: [0.7, -0.5], beat: 1 }, 'he hears it'], [{ glow: 0.85, eyes: 'worried', crest: 0.7, arms: 'reach', lean: 0.2, look: [1, -0.4] }, 'reaching'], [{ glow: 1, eyes: 'set', crest: 1, arms: 'back', lean: 0.4 }, 'set on it'], [{ glow: 1, eyes: 'soft', crest: 1, arms: 'up', lean: -0.05 }, 'a star woken']];
      O.forEach(([o, label], i) => { const x = 200 + i * 340; P.spark(ctx, x, 290, 1.1, { who: 'orbin', ...o }); sub(ctx, label, x, 462, 19, { align: 'center' }); });
      cap(ctx, 'Helion', 70, 560, 46); sub(ctx, 'the warm one, sun-like: taller, steadier, a corona behind his head. He keeps the beat for both of them.', 70, 592, 20);
      floor(ctx, w, 968);
      const H = [[{ eyes: 'soft', arms: 'rest' }, 'at ease'], [{ eyes: 'open', arms: 'reach', lean: -0.2, face: -1, look: [1, 0] }, '“Keep up, little brother.”'], [{ eyes: 'wide', arms: 'chest', look: [0.9, -0.7] }, 'he hears the silence first'], [{ eyes: 'set', arms: 'back', lean: 0.3 }, 'between it and Orbin'], [{ eyes: 'worried', arms: 'reach', lean: 0.35, glow: 0.6 }, 'the last beat']];
      H.forEach(([o, label], i) => { const x = 200 + i * 340; P.spark(ctx, x, 770, 1.0, { who: 'helion', crest: 1, glow: 1, ...o }); sub(ctx, label, x, 960, 19, { align: 'center' }); });
    } },
    // ---- the two together, and the hands
    'cast-pair': { w: 1800, h: 760, draw(ctx, w, h) {
      const r = backdrop(ctx, w, h, 311, PAL.NEBULA); T.finish(ctx, w, h, 312, 0.3);
      // in the nebula: dancing in sync
      for (const R of [150, 230]) { ctx.strokeStyle = 'rgba(255,246,214,0.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(420, 400, R, R * 0.36, -0.1, 0, TAU); ctx.stroke(); }
      P.spark(ctx, 300, 380, 1.0, { who: 'orbin', glow: 1, eyes: 'soft', arms: 'reach', lean: 0.25, crest: 1 }); P.spark(ctx, 560, 350, 1.0, { who: 'helion', glow: 1, eyes: 'soft', arms: 'reach', lean: -0.25, face: -1 });
      W(ctx, 'in the Harmonic Nebula: one orbit, opposite each other, in step', 420, 700, 22, { align: 'center', color: '#3a1c10', alpha: 0.9 });
      // the last beat: hands brushing
      ctx.save(); ctx.beginPath(); ctx.rect(900, 0, 900, h); ctx.clip(); T.sky(ctx, w, h, [[0, [4, 4, 12]], [0.5, [20, 12, 30]], [1, [90, 50, 40]]], RNG(313), 60); P.stillness(ctx, 1560, 300, 420, 380, RNG(77), { near: 1 });
      P.spark(ctx, 1150, 420, 1.0, { who: 'orbin', glow: 0.9, eyes: 'worried', arms: 'reach', lean: 0.3, crest: 0.9, look: [1, 0] }); P.spark(ctx, 1330, 432, 1.0, { who: 'helion', glow: 0.55, eyes: 'worried', arms: 'reach', lean: -0.2, face: -1, look: [1, 0] });
      K.glow(ctx, 1234, 362, 30, [255, 240, 200], 0.9); T.finish(ctx, w, h, 314, 0.5); ctx.restore();
      W(ctx, 'the last memory: their hands, for one beat', 1350, 700, 22, { align: 'center' });
    } },
    // ---- the Stillness and the guardian
    'cast-dark': { w: 1800, h: 1240, draw(ctx, w, h) {
      const r = backdrop(ctx, w, h, 321, [[0, [6, 7, 18]], [0.6, [16, 18, 44]], [1, [40, 34, 70]]]); T.stars(ctx, w, h * 0.5, r, 500, 4);
      // the Stillness: far (a held breath) and here
      P.stillness(ctx, 330, 300, 150, 120, RNG(71), { near: 0.3 }); P.stillness(ctx, 1180, 300, 300, 170, RNG(72), { near: 1, rot: 0.1 });
      // the guardian: dormant, stirring, turned on you, reignited
      [0, 1, 2, 3].forEach((st, i) => P.guardian(ctx, 240 + i * 440, 1150, 0.5, RNG(42), st));
      T.finish(ctx, w, h, 322, 0.42);
      cap(ctx, 'The Stillness', 70, 70, 44); sub(ctx, 'no shape and no tempo. It has no edge of its own: where it is, things stop mid-motion and the picture skips.', 70, 102, 20);
      sub(ctx, 'far: a held breath', 330, 480, 19, { align: 'center' }); sub(ctx, 'here: the beat is lost', 1180, 540, 19, { align: 'center' });
      cap(ctx, 'The guardian at the galaxy’s edge', 70, 630, 44); sub(ctx, 'this galaxy’s own keeper, stopped mid-watch and worn as a gate. A fallen star too: the largest. No face: a helm with one slit.', 70, 662, 20);
      ['dormant: the first scene', 'stirring: after the first star', 'turned on you: the fight', 'reignited: it bows, and opens the way'].forEach((s2, i) => sub(ctx, s2, 240 + i * 440, 1200, 19, { align: 'center' }));
      P.spark(ctx, 1730, 1120, 0.14, { glow: 1, ring: false }); sub(ctx, 'Orbin, to scale', 1730, 1150 + 18, 16, { align: 'center' });
    } },
    // ---- the opening, as written: ten stills with their timings
    'opening-1': anim([['a1', '1. Pitch black. A tiny ember tumbles into frame, trailing sparks. Below, a fractured, dormant planetoid. No stars.'], ['a2', '2. He bounces onto the cold stone and rolls to a stop. His light flickers, dims, almost goes out.'], ['a3', '3. Thump-thump, and a distant chime. His light flares upright. He turns toward the horizon.'], ['a4', '4. Three shattered rings of shadow; the guardian under them. Behind them a twin spark pulses once, and is swallowed.'], ['a5', '5. The camera comes down behind him. A path of dormant tiles runs away over the curve of the world; one dull Star-Node ahead.']], 5),
    'opening-2': anim([['a6', '6. A soft bass pulse. With each beat a golden ring goes out from Orbin and comes back; the node echoes it weakly.'], ['a7', '7. A piano note. He lifts, leaning toward the node; the ring closes on its edge. One word, pulsing. No timer: the world waits.'], ['a8', '8. THE FIRST TAP. He arcs into the node: a burst of golden stardust, shockwaves of colour, a rich chord at once.'], ['a9', '9. Colour runs out over the stone. Flowers of light come up along the path; node after node lights over the horizon.'], ['a10', '10. The camera sweeps up into the play view as he glides with the tempo. The words fade as the first markers arrive.']], 5),
    // ---- how it maps onto the game, a memory, the Stillness in a level, the fight
    'play': still([['play', 'The play view, re-dressed. The world in the middle; the gravity path is the ring he rides (asleep ahead of him, in colour behind); each white Star-Node has a golden ring closing on it.'], ['memory', 'A memory of Helion: the same play, as a twin orbit in the nebula’s gold. One tap moves both.'], ['still', 'The Stillness reaches a world: the picture skips and the music loses its beat for a moment.'], ['fight', 'The guardian: the last star of this galaxy. In its last phase Helion’s echo flies beside Orbin.']], 4),
    // ---- the hub, growing
    'hub': still([['hub0', 'The hub at nothing woken: the crater where he fell. The guardian and the three rings are on the horizon from the start; the path to them is dark.'], ['hub1', 'One star woken (Emberwick): Ossa’s fire burns by the crater, the first stretch of the path is lit, the guardian has raised its head. Helion’s signal is a little clearer.'], ['hub4', 'All four: fire, kites, a still pool, a tree of seed-lights. The path is lit to the edge and the guardian has turned toward him.']], 3)
  };
})();
