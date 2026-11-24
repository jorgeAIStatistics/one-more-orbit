// The story's painted scenes (Afterglow). This is mockups/art/story-afterglow.js as a module: the game paints its
// story with exactly the scenes the approved stills were made from. STORIES.draw(ctx, w, h, scene, 'phone' | 'desktop', -1, u)
// paints the picture alone; the game writes the words over it itself.
import { K, DUSK } from './painter.js';
// Afterglow, step 3: the story, as painted scenes with the words written into them. No card, no dots, no buttons:
// the picture fills the screen, the words fade in a sentence at a time, and a tap anywhere goes on.
// Five of the twelve scenes are painted here, for a phone and a desktop, plus three frames of how the words arrive.
/* eslint-disable */
const STORIES = (() => {
  const { TAU, D, lerp, RNG, rgba, mix } = K;
  const T = DUSK.tools;
  const PAL = {
    heroes: [[214, 96, 60], [255, 190, 120], [70, 26, 50], [[-0.2, 0.22, [255, 200, 140], 0.14], [0.3, 0.25, [150, 50, 50], 0.16]]],
    skyhigh: [[220, 110, 190], [255, 196, 232], [80, 36, 110], [[-0.1, 0.3, [255, 236, 248], 0.2], [0.4, 0.2, [255, 220, 240], 0.14]]],
    blank: [[110, 160, 230], [226, 242, 255], [30, 44, 110], [[0, 0.16, [240, 250, 255], 0.2]]],
    invincible: [[70, 160, 110], [196, 250, 160], [14, 60, 66], [[-0.25, 0.25, [220, 255, 170], 0.14]]]
  };
  const DUSKY = [[0, [9, 10, 34]], [0.42, [34, 28, 84]], [0.72, [96, 50, 104]], [0.9, [206, 104, 92]], [1, [248, 178, 122]]];
  const COLD = [[0, [5, 6, 18]], [0.45, [20, 20, 50]], [0.8, [46, 38, 80]], [1, [84, 58, 90]]];
  const EMBER = [[0, [24, 14, 48]], [0.4, [86, 34, 74]], [0.72, [190, 80, 64]], [0.9, [244, 150, 96]], [1, [255, 206, 140]]];
  const DAWN = [[0, [40, 44, 112]], [0.4, [120, 84, 150]], [0.7, [236, 140, 124]], [0.88, [255, 196, 130]], [1, [255, 232, 180]]];
  const ROSE = [[0, [20, 14, 52]], [0.4, [84, 40, 110]], [0.72, [196, 96, 170]], [0.9, [250, 170, 200]], [1, [255, 220, 220]]];
  const ICE = [[0, [8, 14, 44]], [0.4, [30, 50, 110]], [0.72, [80, 130, 200]], [0.9, [170, 210, 240]], [1, [230, 244, 255]]];
  const LEAF = [[0, [8, 22, 36]], [0.4, [20, 70, 80]], [0.72, [60, 150, 110]], [0.9, [170, 230, 150]], [1, [230, 255, 190]]];
  const TURN = [[0, [10, 10, 34]], [0.5, [50, 36, 90]], [0.8, [150, 80, 110]], [1, [240, 160, 120]]];
  const planet = (ctx, id, x, y, R, la, r, k = 0) => { const [b, l, d, bands] = PAL[id]; T.sphere(ctx, x, y, R, mix(b, [22, 18, 56], k), mix(l, [40, 34, 90], k), d, la, r, { bands: k > 0.5 ? [] : bands, haze: 0.34 * (1 - k), rim: 0.9 * (1 - k * 0.8) }); };
  const beam = (ctx, lamp, x, y, R, c, a, u) => { ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.filter = `blur(${11 * u}px)`; const ang = Math.atan2(y - lamp[1], x - lamp[0]), d = Math.hypot(x - lamp[0], y - lamp[1]) + R, hw = Math.min(0.3, (R * 1.25) / d); const g = ctx.createLinearGradient(lamp[0], lamp[1], x, y); g.addColorStop(0, rgba(c, a)); g.addColorStop(1, rgba(c, a * 0.3)); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(lamp[0], lamp[1]); ctx.lineTo(lamp[0] + Math.cos(ang - hw) * d, lamp[1] + Math.sin(ang - hw) * d); ctx.lineTo(lamp[0] + Math.cos(ang + hw) * d, lamp[1] + Math.sin(ang + hw) * d); ctx.closePath(); ctx.fill(); ctx.restore(); };
  /** Curtains of fog hung from above, and (if `eye`) the hood with the lower limb of an eclipse under its lid. */
  function hush(ctx, w, x, y, wide, tall, r, u, eye = true, open = false) {
    ctx.save(); ctx.filter = `blur(${16 * u}px)`; ctx.fillStyle = 'rgba(4,4,12,0.96)'; ctx.beginPath(); ctx.ellipse(x, y - tall * 0.5, wide, tall, 0, 0, TAU); ctx.fill(); ctx.restore();
    for (let i = 0; i < 80; i++) { const x0 = x - wide + r() * wide * 2, len = tall * (0.5 + r() * 0.75) + y - tall * 0.5, bend = (x - x0) * 0.1 * r(); K.brush(ctx, [[x0, -20], [x0 + bend * 0.3, len * 0.4], [x0 + bend, len * 0.8], [x0 + bend * 1.4 + (r() - 0.5) * 30 * u, len]], (16 + r() * 36) * u, mix([12, 10, 28], [86, 70, 132], r() * r()), r, { passes: 4, alpha: 0.2, spread: 0.5 }); }
    if (!eye) return;
    const er = 52 * u;
    ctx.save(); ctx.filter = `blur(${9 * u}px)`; ctx.fillStyle = '#030208'; ctx.beginPath(); ctx.ellipse(x, y, er * 2.6, er * 3.2, 0, 0, TAU); ctx.fill(); ctx.restore();
    if (open) { K.glow(ctx, x, y, er * 6, [255, 200, 130], 0.5); K.glow(ctx, x, y, er * 2.4, [255, 236, 200], 0.6); } // the seam undone: all of its light, and warm
    ctx.save(); ctx.beginPath(); ctx.rect(0, open ? 0 : y + er * 0.25, w, open ? y + er * 5 : er * 4); ctx.clip();
    ctx.shadowColor = open ? 'rgba(255,214,150,0.95)' : 'rgba(214,206,255,0.95)'; ctx.shadowBlur = 24 * u; ctx.strokeStyle = 'rgba(240,234,255,0.95)'; ctx.lineWidth = 3 * u; ctx.beginPath(); ctx.arc(x, y, er, 0, TAU); ctx.stroke();
    ctx.shadowBlur = 56 * u; ctx.strokeStyle = 'rgba(190,176,255,0.35)'; ctx.lineWidth = 7 * u; ctx.stroke(); ctx.restore();
  }
  function jar(ctx, x, y, s, c, r) {
    K.glow(ctx, x, y, 46 * s, c, 0.35);
    ctx.strokeStyle = 'rgba(214,226,255,0.5)'; ctx.lineWidth = 1.5 * s;
    ctx.beginPath(); ctx.moveTo(x - 13 * s, y + 18 * s); ctx.lineTo(x - 13 * s, y - 8 * s); ctx.quadraticCurveTo(x - 13 * s, y - 26 * s, x, y - 26 * s); ctx.quadraticCurveTo(x + 13 * s, y - 26 * s, x + 13 * s, y - 8 * s); ctx.lineTo(x + 13 * s, y + 18 * s); ctx.closePath(); ctx.stroke();
    ctx.fillStyle = rgba(mix(c, [255, 255, 255], 0.5), 0.95); ctx.beginPath(); ctx.arc(x, y + 2 * s, 3.2 * s, 0, TAU); ctx.fill();
  }
  /** Marlow: a lampmoth seen against his own lantern. A silhouette with light on the edges of his wings; no face. */
  function moth(ctx, x, y, s, r) {
    K.glow(ctx, x + 26 * s, y + 54 * s, 190 * s, [255, 190, 110], 0.42);
    const wing = (k, up) => { ctx.beginPath(); if (up) { ctx.moveTo(x, y - 12 * s); ctx.bezierCurveTo(x + k * 50 * s, y - 100 * s, x + k * 160 * s, y - 104 * s, x + k * 150 * s, y - 34 * s); ctx.bezierCurveTo(x + k * 144 * s, y + 8 * s, x + k * 70 * s, y + 22 * s, x, y + 12 * s); } else { ctx.moveTo(x, y + 8 * s); ctx.bezierCurveTo(x + k * 78 * s, y + 16 * s, x + k * 116 * s, y + 62 * s, x + k * 86 * s, y + 102 * s); ctx.bezierCurveTo(x + k * 56 * s, y + 126 * s, x + k * 24 * s, y + 80 * s, x, y + 46 * s); } ctx.closePath(); };
    for (const k of [-1, 1]) for (const up of [false, true]) {
      wing(k, up); ctx.fillStyle = up ? 'rgba(30,20,48,0.96)' : 'rgba(44,26,54,0.94)'; ctx.fill();
      ctx.save(); wing(k, up); ctx.clip(); K.glow(ctx, x + 26 * s, y + 60 * s, 130 * s, [255, 170, 100], 0.34); ctx.restore(); // the lantern shines through the thin of the wing
      ctx.save(); ctx.globalCompositeOperation = 'screen'; wing(k, up); ctx.strokeStyle = rgba([255, 200, 140], k > 0 ? 0.75 : 0.4); ctx.lineWidth = 1.8 * s; ctx.shadowColor = 'rgba(255,180,110,0.9)'; ctx.shadowBlur = 8 * s; ctx.stroke(); ctx.restore();
    }
    ctx.fillStyle = 'rgba(20,14,34,0.98)'; ctx.beginPath(); ctx.ellipse(x, y + 22 * s, 13 * s, 52 * s, 0, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(x, y - 38 * s, 9 * s, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(20,14,34,0.95)'; ctx.lineWidth = 2 * s; ctx.lineCap = 'round';
    for (const k of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x + k * 4 * s, y - 44 * s); ctx.bezierCurveTo(x + k * 14 * s, y - 84 * s, x + k * 40 * s, y - 104 * s, x + k * 66 * s, y - 106 * s); ctx.stroke(); }
    ctx.fillStyle = 'rgba(255,236,190,0.98)'; ctx.beginPath(); ctx.ellipse(x + 26 * s, y + 58 * s, 5 * s, 8 * s, 0, 0, TAU); ctx.fill();
  }
  /** The words: written into the picture where it is darkest, a sentence at a time. `shown` sentences are in; the next is part-way. */
  function words(ctx, w, h, text, B, u, shown = 99) {
    const size = B.size * u, font = `italic 500 ${size}px ${T.SERIF}`;
    const g = ctx.createLinearGradient(0, h * (B.y - 0.14), 0, h); g.addColorStop(0, 'rgba(8,6,22,0)'); g.addColorStop(0.45, 'rgba(8,6,22,0.6)'); g.addColorStop(1, 'rgba(8,6,22,0.86)');
    if (B.band === false) K.glow(ctx, w * (B.x + B.w * 0.45), h * (B.y + 0.07), w * B.w * 0.95, [8, 6, 22], 0.62, 'source-over'); // words up in the picture: only the air round them darkens
    else { ctx.fillStyle = g; ctx.fillRect(0, h * (B.y - 0.14), w, h); } // words low in the picture: it simply darkens toward the bottom. Never a panel.
    ctx.font = font;
    const sentences = text.match(/[^.?!]+[.?!]+\s*/g) || [text];
    let y = h * B.y, lineH = size * 1.42;
    sentences.forEach((sen, si) => {
      const a = si < shown ? 0.97 : si === shown ? 0.4 : 0;
      let line = '';
      const flush = () => { if (line.trim()) { if (a > 0) K.text(ctx, line.trim(), w * B.x, y, font, '#fff1d8', { align: B.align, alpha: a }); y += lineH; } line = ''; };
      for (const word of sen.trim().split(' ')) { if (ctx.measureText(line + word).width > w * B.w && line) flush(); line += word + ' '; }
      flush();
      y += size * 0.3;
    });
    if (shown >= sentences.length) { const sx = B.align === 'center' ? w * B.x : w * B.x + (B.align === 'left' ? 6 * u : -6 * u), sy = y + size * 0.5; K.glow(ctx, sx, sy, 16 * u, [255, 214, 150], 0.6); ctx.fillStyle = 'rgba(255,244,220,0.95)'; ctx.beginPath(); ctx.arc(sx, sy, 2.4 * u, 0, TAU); ctx.fill(); } // a small spark when it is ready to go on
  }
  const SCENES = {
    // 1. opening: the Lantern, its beams, and every world humming in its own colour
    lantern: { text: 'In the middle of a small galaxy stands the Lantern, a crooked old lighthouse. Its lamp hums, and every planet hums back in its own colour.',
      phone: { sky: DUSKY, horizon: 0.6, lh: [0.3, 0.615, 1.0], pl: [['heroes', 0.2, 0.3, 36], ['skyhigh', 0.78, 0.36, 32], ['blank', 0.56, 0.17, 24], ['invincible', 0.84, 0.12, 20]], eko: [0.56, 0.42, 0.24], B: { x: 0.5, y: 0.75, w: 0.84, align: 'center', size: 20 } },
      desktop: { sky: DUSKY, horizon: 0.66, lh: [0.24, 0.68, 1.5], pl: [['heroes', 0.5, 0.44, 62], ['skyhigh', 0.72, 0.24, 54], ['blank', 0.4, 0.15, 44], ['invincible', 0.9, 0.42, 46]], eko: [0.34, 0.36, 0.34], B: { x: 0.44, y: 0.79, w: 0.5, align: 'left', size: 23 } } },
    // 2. opening: the Hush comes, and takes the songs
    hush: { text: 'Then the Hush came, which cannot bear a sound. It took every planet’s song, and their colour went with it. It carried Marlow off to the Hollow.',
      phone: { sky: COLD, horizon: 0.68, hush: [0.5, 0.22, 0.6, 0.5], jars: [[0.16, 0.5], [0.34, 0.55], [0.5, 0.58], [0.66, 0.55], [0.84, 0.5]], eko: [0.5, 0.655, 0.15], B: { x: 0.5, y: 0.75, w: 0.84, align: 'center', size: 20 } },
      desktop: { sky: COLD, horizon: 0.74, hush: [0.62, 0.3, 0.46, 0.62], jars: [[0.4, 0.62], [0.51, 0.67], [0.62, 0.7], [0.73, 0.67], [0.84, 0.62]], eko: [0.62, 0.725, 0.2], B: { x: 0.06, y: 0.56, w: 0.3, align: 'left', size: 23, band: false } } },
    // 3. a planet restored: its song home, its colour with it
    ember: { text: 'Emberwick sings again, and its embers are warm again. One song is home, and the Lantern’s beam finds its way there.',
      phone: { sky: EMBER, horizon: 0.64, big: ['heroes', 0.62, 0.3, 118], eko: [0.24, 0.5, 0.36], B: { x: 0.5, y: 0.76, w: 0.84, align: 'center', size: 20 } },
      desktop: { sky: EMBER, horizon: 0.7, big: ['heroes', 0.7, 0.4, 210], eko: [0.36, 0.5, 0.5], B: { x: 0.06, y: 0.72, w: 0.34, align: 'left', size: 23 } } },
    // 4. before the Hollow: Marlow, under glass
    marlow: { text: 'Marlow taps on the glass: one, two, three, four. Even here, he keeps the beat. Go on, little spark.',
      phone: { sky: COLD, horizon: 0.7, hush: [0.5, 0.0, 0.7, 0.3, false], moth: [0.5, 0.36, 0.72], eko: [0.2, 0.635, 0.16], B: { x: 0.5, y: 0.77, w: 0.84, align: 'center', size: 20 } },
      desktop: { sky: COLD, horizon: 0.78, hush: [0.5, 0.0, 0.6, 0.4, false], moth: [0.64, 0.44, 1.0], eko: [0.3, 0.735, 0.22], B: { x: 0.06, y: 0.4, w: 0.32, align: 'left', size: 23, band: false } } },
    // 5. the ending: the quietest song
    dawn: { text: 'The Hush is given the quietest song there is, and falls asleep beside the lamp. One more orbit, Eko?',
      phone: { sky: DAWN, horizon: 0.6, lh: [0.36, 0.615, 1.0], pl: [['heroes', 0.2, 0.3, 36], ['skyhigh', 0.8, 0.34, 32], ['blank', 0.58, 0.16, 24], ['invincible', 0.86, 0.1, 20]], eko: [0.6, 0.36, 0.24], sleeper: [0.62, 0.6, 1], B: { x: 0.5, y: 0.77, w: 0.84, align: 'center', size: 20 } },
      desktop: { sky: DAWN, horizon: 0.66, lh: [0.3, 0.68, 1.5], pl: [['heroes', 0.54, 0.42, 62], ['skyhigh', 0.74, 0.22, 54], ['blank', 0.44, 0.14, 44], ['invincible', 0.9, 0.4, 46]], eko: [0.38, 0.3, 0.34], sleeper: [0.43, 0.665, 1.5], B: { x: 0.52, y: 0.8, w: 0.42, align: 'left', size: 23 } } },
    // the other seven, in the same hand
    eko: { text: '',
      phone: { sky: DUSKY, horizon: 0.64, lh: [0.28, 0.655, 1.3], beamTo: [0.98, 0.1, 0.5], eko: [0.62, 0.34, 0.5], moth: [0.15, 0.37, 0.2, true], B: { x: 0.5, y: 0.76, w: 0.84, align: 'center', size: 20 } },
      desktop: { sky: DUSKY, horizon: 0.7, lh: [0.22, 0.72, 1.7], beamTo: [0.99, 0.06, 0.5], eko: [0.58, 0.34, 0.62], moth: [0.12, 0.4, 0.3, true], B: { x: 0.44, y: 0.8, w: 0.5, align: 'left', size: 23 } } },
    cirra: { text: '',
      phone: { sky: ROSE, horizon: 0.64, big: ['skyhigh', 0.62, 0.3, 118], eko: [0.24, 0.5, 0.36], B: { x: 0.5, y: 0.76, w: 0.84, align: 'center', size: 20 } },
      desktop: { sky: ROSE, horizon: 0.7, big: ['skyhigh', 0.7, 0.4, 210], eko: [0.36, 0.5, 0.5], B: { x: 0.06, y: 0.72, w: 0.34, align: 'left', size: 23 } } },
    glass: { text: '',
      phone: { sky: ICE, horizon: 0.64, big: ['blank', 0.62, 0.3, 118], eko: [0.24, 0.5, 0.36], B: { x: 0.5, y: 0.76, w: 0.84, align: 'center', size: 20 } },
      desktop: { sky: ICE, horizon: 0.7, big: ['blank', 0.7, 0.4, 210], eko: [0.36, 0.5, 0.5], B: { x: 0.06, y: 0.72, w: 0.34, align: 'left', size: 23 } } },
    verd: { text: '',
      phone: { sky: LEAF, horizon: 0.64, big: ['invincible', 0.62, 0.3, 118], eko: [0.24, 0.5, 0.36], B: { x: 0.5, y: 0.76, w: 0.84, align: 'center', size: 20 } },
      desktop: { sky: LEAF, horizon: 0.7, big: ['invincible', 0.7, 0.4, 210], eko: [0.36, 0.5, 0.5], B: { x: 0.06, y: 0.72, w: 0.34, align: 'left', size: 23 } } },
    hollow: { text: '',
      phone: { sky: COLD, horizon: 0.72, hush: [0.58, 0.24, 0.62, 0.52], lh: [0.14, 0.735, 0.5], beamTo: [0.36, 0.5, 0.3], eko: [0.34, 0.6, 0.2], B: { x: 0.5, y: 0.76, w: 0.84, align: 'center', size: 20 } },
      desktop: { sky: COLD, horizon: 0.76, hush: [0.66, 0.3, 0.42, 0.62], lh: [0.1, 0.79, 0.7], beamTo: [0.3, 0.54, 0.3], eko: [0.3, 0.6, 0.26], B: { x: 0.06, y: 0.26, w: 0.3, align: 'left', size: 23, band: false } } },
    unstitch: { text: '',
      phone: { sky: TURN, horizon: 0.7, hush: [0.5, 0.22, 0.5, 0.42, true, true], motes: [[0.2, 0.5], [0.36, 0.44], [0.5, 0.4], [0.64, 0.44], [0.8, 0.5]], eko: [0.5, 0.63, 0.22], B: { x: 0.5, y: 0.76, w: 0.84, align: 'center', size: 20 } },
      desktop: { sky: TURN, horizon: 0.76, hush: [0.64, 0.3, 0.4, 0.54, true, true], motes: [[0.44, 0.62], [0.54, 0.54], [0.64, 0.5], [0.74, 0.54], [0.84, 0.62]], eko: [0.64, 0.72, 0.26], B: { x: 0.06, y: 0.52, w: 0.3, align: 'left', size: 23, band: false } } },
    relight: { text: '',
      phone: { sky: DAWN, horizon: 0.6, lh: [0.36, 0.615, 1.0], pl: [['heroes', 0.2, 0.3, 36], ['skyhigh', 0.8, 0.34, 32], ['blank', 0.58, 0.16, 24], ['invincible', 0.86, 0.1, 20]], eko: [0.62, 0.4, 0.24], moth: [0.17, 0.42, 0.19, true], B: { x: 0.5, y: 0.76, w: 0.84, align: 'center', size: 20 } },
      desktop: { sky: DAWN, horizon: 0.66, lh: [0.3, 0.68, 1.5], pl: [['heroes', 0.54, 0.42, 62], ['skyhigh', 0.74, 0.22, 54], ['blank', 0.44, 0.14, 44], ['invincible', 0.9, 0.4, 46]], eko: [0.4, 0.3, 0.34], moth: [0.18, 0.4, 0.3, true], B: { x: 0.52, y: 0.8, w: 0.42, align: 'left', size: 23 } } },
    lens: { text: '',
      phone: { sky: DAWN, horizon: 0.6, lh: [0.36, 0.615, 1.0], flare: true, pl: [['heroes', 0.2, 0.3, 36], ['skyhigh', 0.8, 0.34, 32], ['blank', 0.58, 0.16, 24], ['invincible', 0.86, 0.1, 20]], eko: [0.6, 0.36, 0.24], B: { x: 0.5, y: 0.76, w: 0.84, align: 'center', size: 20 } },
      desktop: { sky: DAWN, horizon: 0.66, lh: [0.3, 0.68, 1.5], flare: true, pl: [['heroes', 0.54, 0.42, 62], ['skyhigh', 0.74, 0.22, 54], ['blank', 0.44, 0.14, 44], ['invincible', 0.9, 0.4, 46]], eko: [0.38, 0.3, 0.34], B: { x: 0.52, y: 0.8, w: 0.42, align: 'left', size: 23 } } }
  };
  function draw(ctx, w, h, name, dev, shown = 99, uo = 0) {
    const S = SCENES[name], L = S[dev], u = uo || (dev === 'phone' ? 2 : 1.15), r = RNG(name.length * 97 + (dev === 'phone' ? 3 : 4));
    T.sky(ctx, w, h, L.sky, r, 160);
    T.stars(ctx, w, h * L.horizon, r, Math.round((w * h) / 950), name.length * 13);
    const hy = h * L.horizon;
    const lamp = L.lh ? [w * L.lh[0] - 10 * L.lh[2] * u, h * L.lh[1] - 132 * L.lh[2] * u] : [w * 0.5, hy];
    if (L.hush) { const [x, y, hw, ht, eye, open] = L.hush; hush(ctx, w, w * x, h * y, w * hw, h * ht, r, u, eye !== false, !!open); }
    if (L.motes) L.motes.forEach(([x, y], i) => { const c = [[255, 150, 90], [255, 130, 210], [255, 226, 170], [150, 200, 255], [150, 240, 140]][i]; for (let k = 0; k < 9; k++) { ctx.fillStyle = rgba(c, 0.5 - k * 0.05); ctx.beginPath(); ctx.arc(w * x + Math.sin(k * 1.3 + i) * 4 * u, h * y + k * 9 * u, (2.4 - k * 0.2) * u, 0, TAU); ctx.fill(); } K.glow(ctx, w * x, h * y, 40 * u, c, 0.5); ctx.fillStyle = rgba(mix(c, [255, 255, 255], 0.6), 1); ctx.beginPath(); ctx.arc(w * x, h * y, 3.4 * u, 0, TAU); ctx.fill(); }); // the songs, let go: they rise
    if (L.jars) L.jars.forEach(([x, y], i) => { const c = [[255, 150, 90], [255, 130, 210], [255, 226, 170], [150, 200, 255], [150, 240, 140]][i]; ctx.strokeStyle = 'rgba(150,60,70,0.55)'; ctx.lineWidth = 1.2 * u; ctx.beginPath(); ctx.moveTo(w * lerp(x, L.hush[0], 0.3), h * (L.hush[1] + 0.14)); ctx.quadraticCurveTo(w * x, h * (y - 0.08), w * x, h * y - 26 * u); ctx.stroke(); jar(ctx, w * x, h * y, u, c, r); });
    if (L.beamTo) beam(ctx, lamp, w * L.beamTo[0], h * L.beamTo[1], 60 * u, [255, 220, 160], L.beamTo[2], u);
    if (L.flare) { K.glow(ctx, lamp[0], lamp[1], 620 * u, [255, 226, 170], 0.6, 'screen'); K.glow(ctx, lamp[0], lamp[1], 240 * u, [255, 246, 220], 0.7, 'screen'); }
    if (L.pl) { for (const [id, x, y, R] of L.pl) beam(ctx, lamp, w * x, h * y, R * u, PAL[id][1], 0.34, u); for (const [id, x, y, R] of L.pl) planet(ctx, id, w * x, h * y, R * u, Math.atan2(lamp[1] - h * y, lamp[0] - w * x) / D, r); }
    if (L.big) { const [id, x, y, R] = L.big; ctx.save(); ctx.globalCompositeOperation = 'screen'; for (let k = 0; k < 18; k++) { const a = (k / 18) * TAU + r() * 0.2, hw = 0.03 + r() * 0.06, len = R * u * (3 + r() * 3); const g = ctx.createRadialGradient(w * x, h * y, R * u * 0.6, w * x, h * y, len); g.addColorStop(0, rgba(mix(PAL[id][1], [255, 255, 255], 0.2), 0.2)); g.addColorStop(1, rgba(PAL[id][0], 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(w * x, h * y); ctx.lineTo(w * x + Math.cos(a - hw) * len, h * y + Math.sin(a - hw) * len); ctx.lineTo(w * x + Math.cos(a + hw) * len, h * y + Math.sin(a + hw) * len); ctx.closePath(); ctx.fill(); } ctx.restore(); planet(ctx, id, w * x, h * y, R * u, 200, r); }
    if (L.moth) { // the jar hangs on its thread out of the dark above; Marlow is inside, against his lantern
      const [x, y, s, free] = L.moth, mx = w * x, my = h * y, ms = s * u;
      if (!free) { ctx.strokeStyle = 'rgba(150,60,70,0.6)'; ctx.lineWidth = 1.4 * u; ctx.beginPath(); ctx.moveTo(mx, 0); ctx.lineTo(mx, my - 196 * ms); ctx.stroke(); }
      moth(ctx, mx, my, ms, r);
      if (!free) {
      ctx.strokeStyle = 'rgba(214,226,255,0.5)'; ctx.lineWidth = 2 * u;
      ctx.beginPath(); ctx.moveTo(mx - 190 * ms, my + 150 * ms); ctx.lineTo(mx - 190 * ms, my - 40 * ms); ctx.bezierCurveTo(mx - 190 * ms, my - 180 * ms, mx + 190 * ms, my - 180 * ms, mx + 190 * ms, my - 40 * ms); ctx.lineTo(mx + 190 * ms, my + 150 * ms); ctx.closePath(); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 3 * u; ctx.beginPath(); ctx.moveTo(mx - 168 * ms, my + 100 * ms); ctx.lineTo(mx - 168 * ms, my - 30 * ms); ctx.bezierCurveTo(mx - 168 * ms, my - 100 * ms, mx - 130 * ms, my - 138 * ms, mx - 80 * ms, my - 150 * ms); ctx.stroke(); // the glass catches a little light
      }
    }
    ctx.save(); ctx.filter = `blur(${26 * u}px)`; ctx.fillStyle = rgba(L.sky[L.sky.length - 1][1], 0.3); ctx.fillRect(-40, hy - 30 * u, w + 80, 66 * u); ctx.restore();
    const land = L.sky === COLD ? [[0, 16, [26, 20, 50], 0.3], [50, 14, [10, 8, 24], 0.7]] : [[0, 30, [86, 46, 90], 0.4], [44, 26, [48, 28, 68], 0.7], [96, 22, [20, 13, 38], 0.9]];
    const lx = L.eko ? w * L.eko[0] : w / 2;
    land.forEach(([dy, amp, c, rim], i) => T.ridge(ctx, w, h, hy + dy * u, amp * u, name.length * 7 + i * 5, c, L.lh ? w * L.lh[0] : lx, [255, 205, 140], rim));
    if (L.lh) { K.glow(ctx, lamp[0], lamp[1], 150 * L.lh[2] * u, [255, 214, 150], 0.6); T.lighthouse(ctx, w * L.lh[0], h * L.lh[1], L.lh[2] * u, r); }
    if (L.sleeper) { // the Hush, small after all: a heap of soft dark beside the lamp, its one light closed to a line
      const [x, y, s] = L.sleeper, sx = w * x, sy = h * y, ss = s * u;
      ctx.save(); ctx.filter = `blur(${5 * u}px)`; ctx.fillStyle = 'rgba(24,18,46,0.96)'; ctx.beginPath(); ctx.ellipse(sx, sy, 46 * ss, 24 * ss, 0, Math.PI, TAU); ctx.fill(); ctx.restore();
      for (let i = 0; i < 14; i++) K.brush(ctx, [[sx - 40 * ss + i * 6 * ss, sy - (20 - Math.abs(i - 7) * 2.4) * ss], [sx - 42 * ss + i * 6.4 * ss, sy]], 7 * ss, mix([20, 16, 40], [84, 66, 124], r() * 0.6), r, { passes: 3, alpha: 0.3 });
      ctx.strokeStyle = 'rgba(236,230,255,0.75)'; ctx.lineWidth = 1.4 * ss; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(sx, sy - 16 * ss, 9 * ss, 0.25 * Math.PI, 0.75 * Math.PI); ctx.stroke();
    }
    if (L.eko) { K.glow(ctx, w * L.eko[0], Math.min(hy + 20 * u, h), 240 * u * L.eko[2], [255, 170, 100], 0.22, 'screen'); T.eko(ctx, w * L.eko[0], h * L.eko[1], L.eko[2] * u, r, { wisp: L.eko[2] > 0.18, lean: 0.25 }); }
    T.finish(ctx, w, h, name.length * 31, 0.5);
    if (shown >= 0) words(ctx, w, h, S.text, L.B, u, shown);
  }
  return { SCENES, draw };
})();
export { STORIES };
