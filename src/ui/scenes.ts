// World 1's own story scenes (Afterglow), painted for the story player. Each is a painter and where its words go, for
// a phone and for a desktop. (A first clear is told by live moments, ui/skymoment.ts; these are the still ones.)
import { CANON } from '../art/canonpaint.js';
import { K, DUSK } from '../art/painter.js';
import { RESULTS } from '../art/resultpaint.js';
import { UI } from '../art/uipaint.js';
import { WORLD1 } from '../art/world1paint.js';

type Dev = 'phone' | 'desktop';
export interface Block { x: number; y: number; w: number; align: CanvasTextAlign; size: number; band?: boolean }
export interface Scene { paint: (c: CanvasRenderingContext2D, w: number, h: number, dev: Dev, u: number) => void; phone: Block; desktop: Block }
const Y = RESULTS.LAYERS, T = DUSK.tools;

/** The galaxy's edge: the guardian under the three rings (dormant, or with its star lit). */
const edge = (state: number): Scene => ({
  paint(c, w, h, dev, u) {
    const r = K.RNG(15), hy = h * 0.74, big = (dev === 'phone' ? 0.36 : 0.5) * u;
    T.sky(c, w, h, (state >= 3 ? CANON.pal.WOKEN : CANON.pal.DRIFT), r, 80);
    if (state >= 3) T.stars(c, w, h * 0.5, r, Math.round((w * h) / 900), 3);
    CANON.parts.trials(c, w * 0.52, hy - 330 * big * 2.2, 1.5 * big * 2.2, K.RNG(41), state >= 3 ? 0.4 : 1);
    CANON.parts.guardian(c, w * 0.54, hy + 4, big, K.RNG(42), state);
    CANON.parts.ground(c, w, h, hy, K.RNG(12), state >= 3 ? 0.8 : 0.05);
    CANON.parts.spark(c, w * 0.24, hy + 90 * u, 0.5 * u, { eyes: state >= 3 ? 'wide' : 'set', look: [1, -0.6], lean: 0.1, arms: state >= 3 ? 'chest' : 'rest' });
    T.finish(c, w, h, 24, 0.55);
  },
  phone: { x: 0.09, y: 0.14, w: 0.82, align: 'left', size: 22, band: false },
  desktop: { x: 0.07, y: 0.2, w: 0.4, align: 'left', size: 25, band: false }
});

export const SCENES: Record<string, Scene> = {
  edge: edge(0), 'edge-lit': edge(3),
};
