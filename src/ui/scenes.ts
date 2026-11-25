// World 1's own story scenes (Afterglow), painted for the story player: a planet before its song comes back, its
// soul giving Eko the gift, and the homecoming at the Lantern. Each is a painter and where its words go, for a phone
// and for a desktop. (The older scenes are in art/storypaint.js; these are built from the planets' own skies, the
// characters of art/world1paint.js and the rooms of art/uipaint.js.)
import { K, DUSK } from '../art/painter.js';
import { RESULTS } from '../art/resultpaint.js';
import { UI } from '../art/uipaint.js';
import { WORLD1 } from '../art/world1paint.js';

type Dev = 'phone' | 'desktop';
export interface Block { x: number; y: number; w: number; align: CanvasTextAlign; size: number; band?: boolean }
export interface Scene { paint: (c: CanvasRenderingContext2D, w: number, h: number, dev: Dev, u: number) => void; phone: Block; desktop: Block }
const Y = RESULTS.LAYERS, T = DUSK.tools;

export const SCENES: Record<string, Scene> = {
  // Emberwick, before: the forge-hills dark, and Ossa banked like a dead coal
  'ossa-dark': {
    paint(c, w, h, dev, u) {
      Y.scene(c, w, h, 'heroes', dev, u, 'cold');
      const hy = h * Y.lay(dev).horizon, s = (dev === 'phone' ? 0.86 : 1.25) * u;
      WORLD1.parts.ossa(c, dev === 'phone' ? w * 0.4 : w * 0.34, hy + (dev === 'phone' ? 96 : 110) * u, s, 0.06, K.RNG(51), 'lie');
      T.eko(c, dev === 'phone' ? w * 0.78 : w * 0.74, dev === 'phone' ? h * 0.46 : h * 0.44, (dev === 'phone' ? 0.24 : 0.32) * u, K.RNG(5), { wisp: true, lean: -0.3 });
    },
    phone: { x: 0.09, y: 0.2, w: 0.82, align: 'left', size: 22, band: false },
    desktop: { x: 0.07, y: 0.2, w: 0.4, align: 'left', size: 25, band: false }
  },
  // Emberwick, after: its sky ablaze, Ossa awake with its forks ringing, and the coal it gives
  'ossa-gift': {
    paint(c, w, h, dev, u) {
      Y.scene(c, w, h, 'heroes', dev, u, 'blaze');
      const hy = h * Y.lay(dev).horizon, s = (dev === 'phone' ? 0.86 : 1.25) * u, ox = dev === 'phone' ? w * 0.36 : w * 0.32, oy = hy + (dev === 'phone' ? 74 : 86) * u;
      WORLD1.parts.ossa(c, ox, oy, s, 1, K.RNG(53), 'stand');
      c.save(); c.globalCompositeOperation = 'screen'; // its forks ring
      for (let k = 0; k < 4; k++) { c.strokeStyle = K.rgba([255, 226, 170], 0.5 - k * 0.1); c.lineWidth = 2.4 * u; c.beginPath(); c.arc(ox + 148 * s, oy - 172 * s, (26 + k * 22) * s, -2.4, -0.6); c.stroke(); }
      c.restore();
      // the gift: a coal that does not stop for walls, on its way to the spark
      const gx = dev === 'phone' ? w * 0.66 : w * 0.6, gy = dev === 'phone' ? h * 0.56 : h * 0.54;
      K.brush(c, [[ox + 150 * s, oy - 110 * s], [(ox + 150 * s + gx) / 2, gy - 30 * u], [gx - 14 * u, gy - 2 * u]], 7 * u, [255, 170, 100], K.RNG(54), { passes: 5, alpha: 0.3 });
      K.glow(c, gx, gy, 62 * u, [255, 150, 70], 0.7); c.fillStyle = 'rgba(255,214,150,0.98)'; c.beginPath(); c.ellipse(gx, gy, 9 * u, 6.4 * u, 0.4, 0, Math.PI * 2); c.fill();
      T.eko(c, gx + (dev === 'phone' ? 54 : 84) * u, gy - 34 * u, (dev === 'phone' ? 0.26 : 0.34) * u, K.RNG(5), { wisp: true, lean: -0.2 });
    },
    phone: { x: 0.09, y: 0.17, w: 0.82, align: 'left', size: 22, band: false },
    desktop: { x: 0.07, y: 0.2, w: 0.42, align: 'left', size: 25, band: false }
  },
  // home: the hearth takes Ossa's coal, and is lit again
  'hearth-lit': {
    paint(c, w, h, dev, u) {
      const G = UI.ROOMS.hearth(c, w, h, dev, u);
      UI.C.ekoIn(c, G.eko[0], G.eko[1], G.eko[2], K.RNG(242), [255, 150, 90], { wisp: true, lean: 0.2 });
      // the coal on the mantel: the first flame there
      UI.C.flame(c, G.shelves[0][0], G.shelves[0][2], 1.2 * u, [255, 150, 90], 1);
    },
    phone: { x: 0.09, y: 0.14, w: 0.82, align: 'left', size: 22, band: false },
    desktop: { x: 0.07, y: 0.2, w: 0.4, align: 'left', size: 25, band: false }
  }
};
