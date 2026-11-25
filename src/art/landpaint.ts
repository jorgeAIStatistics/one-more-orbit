// The Landing's places (Afterglow): the pictures behind the screens that used to be rooms of the Lantern. They are on
// the planetoid where Orbin fell, at night, with the guardian and the three rings far off on its horizon.
//   desk     the crater, where he landed: behind the settings
//   lamp     listening for Helion: the sync check. His heartbeat comes down the dark to Orbin's chest
//   hearth   Ossa's fire: Orbin's glows, a flame on the stones for each
//   gallery  the sky from the rim: the stars
//   page     the still pool: the story so far, and who made the music, written on the water
// Each painter returns the same places its old room did (the live layers and the words are laid out from them).
import { CANON } from './canonpaint.js';
import { DUSK, K } from './painter.js';
import { UI, type GalleryLay } from './uipaint.js';
import { WORLD1 } from './world1paint.js';

type Ctx = CanvasRenderingContext2D;
type Dev = 'phone' | 'desktop';
const T = DUSK.tools, P = CANON.parts;
const NIGHT: Array<[number, number[]]> = [[0, [4, 5, 16]], [0.5, [12, 15, 40]], [0.85, [26, 30, 66]], [1, [44, 44, 84]]];

/** The planetoid at night: sky, a few stars, the edge of the galaxy far off, the ground. hy: where the ground's curve tops out. */
function night(ctx: Ctx, w: number, h: number, u: number, hy: number, seed: number, o: { edge?: [number, number]; stars?: number; warm?: number } = {}): void {
  const r = K.RNG(seed);
  T.sky(ctx, w, h, NIGHT, r, 90);
  T.stars(ctx, w, hy, r, o.stars ?? Math.round((w * h) / (5200 * u * u)), seed);
  if (o.edge) { P.trials(ctx, o.edge[0], o.edge[1] - 62 * u, 0.3 * u, K.RNG(41), 0.85); P.guardian(ctx, o.edge[0] + 12 * u, o.edge[1] + 2 * u, 0.07 * u, K.RNG(42), 0); }
  P.ground(ctx, w, h, hy, K.RNG(seed + 1), o.warm ?? 0.06, seed);
}
const crater = (ctx: Ctx, x: number, y: number, rx: number, u: number): void => {
  ctx.fillStyle = 'rgba(5,6,16,0.82)'; ctx.beginPath(); ctx.ellipse(x, y, rx, rx * 0.2, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(170,186,230,0.4)'; ctx.lineWidth = 1.6 * u; ctx.beginPath(); ctx.ellipse(x, y, rx, rx * 0.2, 0, Math.PI * 1.04, Math.PI * 1.96); ctx.stroke();
  ctx.strokeStyle = 'rgba(8,9,22,0.7)'; ctx.lineWidth = 5 * u; ctx.beginPath(); ctx.ellipse(x, y + 2 * u, rx * 1.06, rx * 0.24, 0, Math.PI * 0.04, Math.PI * 0.96); ctx.stroke();
};

export const LAND = {
  /** The crater, where he landed. */
  desk(ctx: Ctx, w: number, h: number, dev: Dev, u: number): { dy: number; lampX: number } {
    const dy = h - (dev === 'phone' ? 70 : 76) * u, lampX = dev === 'phone' ? w * 0.84 : w * 0.9, hy = h * (dev === 'phone' ? 0.78 : 0.7);
    night(ctx, w, h, u, hy, 201, { edge: [dev === 'phone' ? w * 0.24 : w * 0.16, hy + 2 * u] });
    crater(ctx, dev === 'phone' ? w * 0.52 : w * 0.66, dy + 6 * u, (dev === 'phone' ? 150 : 260) * u, u);
    // he sits on its rim, small, looking at where he has to go
    P.spark(ctx, lampX, dy - 44 * u, 0.3 * u, { glow: 0.85, eyes: 'soft', crest: 0.4, arms: 'rest', face: -1, look: [0.8, -0.5] });
    ctx.fillStyle = 'rgba(6,6,18,0.5)'; ctx.fillRect(0, 0, w, h); // (the settings are read over this: it stays quiet)
    T.finish(ctx, w, h, 221, 0.6);
    return { dy, lampX };
  },
  /** Listening for Helion: his light far behind the rings, and Orbin with a hand to his chest, where the beat arrives. */
  lamp(ctx: Ctx, w: number, h: number, dev: Dev, u: number): { hx: number; hy: number; gx: number; gy: number } {
    const hx = dev === 'phone' ? w * 0.74 : w * 0.8, hy = dev === 'phone' ? h * 0.1 : h * 0.14, gx = dev === 'phone' ? w * 0.5 : w * 0.62, gy = dev === 'phone' ? h * 0.42 : h * 0.5, ground = h * (dev === 'phone' ? 0.5 : 0.62);
    night(ctx, w, h, u, ground, 231);
    P.trials(ctx, hx - 16 * u, hy + 10 * u, 0.42 * u, K.RNG(41), 0.9);
    K.glow(ctx, hx, hy, 30 * u, [255, 206, 120], 0.8); ctx.fillStyle = '#fff3cf'; ctx.beginPath(); ctx.arc(hx, hy, 2.4 * u, 0, Math.PI * 2); ctx.fill();
    P.spark(ctx, gx, gy, (dev === 'phone' ? 0.5 : 0.62) * u, { glow: 0.9, eyes: 'closed', crest: 0.5, arms: 'chest', look: [0, 0], beat: 1 });
    ctx.fillStyle = 'rgba(6,6,18,0.3)'; ctx.fillRect(0, ground, w, h - ground);
    T.finish(ctx, w, h, 233, 0.6);
    return { hx, hy, gx, gy };
  },
  /** Ossa's fire, by the crater: flat stones round it, a flame on them for each glow, and Ossa itself lying by its warmth. */
  hearth(ctx: Ctx, w: number, h: number, dev: Dev, u: number): { fx: number; fy: number; fw: number; shelves: Array<[number, number, number]>; eko: [number, number, number] } {
    const fx = dev === 'phone' ? w * 0.5 : w * 0.68, fy = dev === 'phone' ? h * 0.84 : h * 0.82, fw = (dev === 'phone' ? 118 : 190) * u;
    const my = fy - fw * 1.1, mx0 = dev === 'phone' ? w * 0.05 : fx - fw - 54 * u, mx1 = dev === 'phone' ? w * 0.95 : fx + fw + 54 * u, sy = my - 70 * u, sx0 = mx0 + 14 * u, sx1 = mx1 - 14 * u;
    night(ctx, w, h, u, sy - 150 * u, 241, { warm: 0.3, edge: [dev === 'phone' ? w * 0.2 : w * 0.12, sy - 150 * u + 2 * u] });
    // Ossa lies beside it, away from the flames, banked and content
    WORLD1.parts.ossa(ctx, dev === 'phone' ? fx + fw * 1.02 : fx - fw * 1.7, fy + (dev === 'phone' ? 16 : 40) * u, (dev === 'phone' ? 0.4 : 0.7) * u, 0.6, K.RNG(53), 'lie', dev === 'phone' ? -1 : 1);
    K.glow(ctx, fx, fy, fw * 4.2, [255, 150, 80], 0.5, 'screen');
    // the fire: tongues of light laid over each other, hot at the heart
    const r = K.RNG(243);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 22; i++) {
      const bx = fx + (r() - 0.5) * fw * 0.9, k = 1 - Math.abs(bx - fx) / (fw * 0.6), hh = fw * (0.3 + r() * 0.6) * Math.max(0.25, k), wd = (9 + r() * 14) * u, lean = (r() - 0.5) * 26 * u;
      ctx.fillStyle = K.rgba(i % 3 === 0 ? [255, 226, 160] : i % 3 === 1 ? [255, 150, 70] : [230, 80, 50], 0.2);
      ctx.beginPath(); ctx.moveTo(bx - wd, fy + 30 * u); ctx.bezierCurveTo(bx - wd * 1.3, fy - hh * 0.4, bx + lean - wd * 0.2, fy - hh * 0.8, bx + lean, fy - hh); ctx.bezierCurveTo(bx + lean + wd * 0.4, fy - hh * 0.7, bx + wd * 1.3, fy - hh * 0.35, bx + wd, fy + 30 * u); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    K.glow(ctx, fx, fy + 10 * u, fw * 0.7, [255, 236, 190], 0.5);
    // the stones the flames stand on: two long flat ledges of the planetoid's own rock
    const ledge = (x0: number, x1: number, y: number, t: number): void => { ctx.fillStyle = 'rgb(18,16,34)'; ctx.beginPath(); ctx.moveTo(x0 - 6 * u, y + t * 0.3); ctx.lineTo(x0 + 4 * u, y - t * 0.75); ctx.lineTo(x1 - 4 * u, y - t * 0.75); ctx.lineTo(x1 + 6 * u, y + t * 0.3); ctx.closePath(); ctx.fill(); ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.strokeStyle = 'rgba(255,190,120,0.45)'; ctx.lineWidth = 1.4 * u; ctx.beginPath(); ctx.moveTo(x0 + 4 * u, y - t * 0.75); ctx.lineTo(x1 - 4 * u, y - t * 0.75); ctx.stroke(); ctx.restore(); };
    ledge(mx0, mx1, my, 12 * u); ledge(sx0, sx1, sy, 8 * u);
    T.finish(ctx, w, h, 251, 0.55);
    return { fx, fy, fw, shelves: [[mx0 + 16 * u, mx1 - 16 * u, my - 10 * u], [sx0 + 16 * u, sx1 - 16 * u, sy - 6.5 * u]], eko: dev === 'phone' ? [w * 0.74, h * 0.37, 0.46 * u] : [w * 0.38, h * 0.6, 0.6 * u] };
  },
  /** The sky from the rim of the crater. */
  gallery(ctx: Ctx, w: number, h: number, dev: Dev, u: number): GalleryLay {
    night(ctx, w, h, u, h * 0.9, 261, { stars: Math.round((w * h) / (1500 * u * u)) });
    ctx.fillStyle = 'rgba(6,6,18,0.35)'; ctx.fillRect(0, h * 0.88, w, h * 0.12);
    T.finish(ctx, w, h, 271, 0.5);
    return UI.galleryLay(w, h, dev, u);
  },
  /** The still pool: dark water in the stone, the sky lying in it. Returns where the water is, to write on it. */
  page(ctx: Ctx, w: number, h: number, dev: Dev, u: number): { px: number; py: number; pw: number; ph: number; rot: number; ix: number } {
    const px = dev === 'phone' ? w * 0.06 : w * 0.2, py = (dev === 'phone' ? 100 : 76) * u, pw = dev === 'phone' ? w * 0.88 : w * 0.6, ph = h - py - (dev === 'phone' ? 60 : 50) * u;
    const r = K.RNG(281);
    // the stone round it, seen from above
    ctx.fillStyle = 'rgb(20,24,44)'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 160; i++) { ctx.fillStyle = K.rgba(r() < 0.5 ? [120, 136, 180] : [4, 5, 14], 0.05 + r() * 0.08); ctx.beginPath(); ctx.ellipse(r() * w, r() * h, (6 + r() * 40) * u, (3 + r() * 14) * u, r() * 3, 0, Math.PI * 2); ctx.fill(); }
    const pool = (grow = 0): void => { const x0 = px - grow, y0 = py - grow, x1 = px + pw + grow, y1 = py + ph + grow, c = 46 * u; ctx.beginPath(); ctx.moveTo(x0 + c, y0); ctx.quadraticCurveTo((x0 + x1) / 2, y0 - 10 * u, x1 - c, y0 + 4 * u); ctx.quadraticCurveTo(x1 + 4 * u, y0 + 6 * u, x1, y0 + c); ctx.quadraticCurveTo(x1 + 8 * u, (y0 + y1) / 2, x1 - 3 * u, y1 - c); ctx.quadraticCurveTo(x1 - 2 * u, y1 + 3 * u, x1 - c, y1); ctx.quadraticCurveTo((x0 + x1) / 2, y1 + 9 * u, x0 + c, y1 - 3 * u); ctx.quadraticCurveTo(x0 - 3 * u, y1 - 2 * u, x0, y1 - c); ctx.quadraticCurveTo(x0 - 7 * u, (y0 + y1) / 2, x0 + 2 * u, y0 + c); ctx.quadraticCurveTo(x0, y0, x0 + c, y0); ctx.closePath(); };
    pool(7 * u); ctx.fillStyle = 'rgba(4,5,14,0.85)'; ctx.fill(); // its lip, in shadow
    ctx.save(); pool(); ctx.clip();
    const g = ctx.createLinearGradient(0, py, 0, py + ph); g.addColorStop(0, 'rgb(16,22,56)'); g.addColorStop(0.5, 'rgb(8,11,32)'); g.addColorStop(1, 'rgb(4,5,18)'); ctx.fillStyle = g; ctx.fillRect(px - 20, py - 20, pw + 40, ph + 40);
    ctx.save(); ctx.translate(px, py); T.stars(ctx, pw, ph, r, Math.round((pw * ph) / (2600 * u * u)), 283); ctx.restore(); // the sky, lying in it
    K.glow(ctx, px + pw * 0.8, py + 10 * u, 280 * u, [255, 200, 120], 0.16, 'screen'); // and, small and far, a gold light that is not a star
    ctx.fillStyle = 'rgba(4,5,16,0.4)'; ctx.fillRect(px - 20, py - 20, pw + 40, ph + 40); // (words are read on this water: it stays dark)
    ctx.restore();
    ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.strokeStyle = 'rgba(170,190,240,0.35)'; ctx.lineWidth = 1.6 * u; pool(); ctx.stroke(); ctx.restore();
    T.finish(ctx, w, h, 301, 0.5);
    return { px, py, pw, ph, rot: 0, ix: pw * 0.09 };
  }
};
