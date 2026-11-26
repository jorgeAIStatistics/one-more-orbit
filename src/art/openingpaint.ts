// The opening's pictures, painted once (shared by the opening and its paint worker: src/art/paintworker.ts). Each is a
// whole screen, laid over with paper grain pixel by pixel: heavy work, so where the browser allows it is done in a
// worker, off the main thread, and no frame of the game waits for it (the performance pass of 2026-11-26).
import { CANON } from './canonpaint.js';
import { DUSK, K } from './painter.js';

export const OPENING_H = 1688;
export type OpeningPic = 'fall' | 'close' | 'far' | 'mist' | 'path' | 'woke';
export const OPENING_PICS: OpeningPic[] = ['fall', 'close', 'far', 'mist', 'path', 'woke'];
type Canvas = HTMLCanvasElement | OffscreenCanvas;
type Ctx = CanvasRenderingContext2D;
/** Paints one of the opening's pictures. make: a canvas of a size (the page's own, or an OffscreenCanvas in the worker). */
export function paintOpening(name: OpeningPic, W: number, q: number, make: (w: number, h: number) => Canvas): Canvas {
  const H = OPENING_H, T = DUSK.tools, P = CANON.parts, R = K.RNG, mix = K.mix;
  const { VOID, DRIFT, WOKEN } = CANON.pal;
  const f = 780 / W, L = { wide: 0.22 * f, bend: 0.3 * f };
  const sheet = (hgt = H): [Canvas, Ctx] => { const cv = make(Math.round(W * q), Math.round(hgt * q)); const c = cv.getContext('2d') as unknown as Ctx; c.scale(q, q); return [cv, c]; };
  if (name === 'fall') { const [cv, c] = sheet(); T.sky(c, W, H, VOID, R(11), 30); c.fillStyle = 'rgba(2,2,8,0.6)'; c.fillRect(0, 0, W, H); P.ground(c, W, H, H * 0.8, R(12), 0); T.finish(c, W, H, 21, 0.7); return cv; }
  if (name === 'close') { const [cv, c] = sheet(); T.sky(c, W, H, VOID, R(13), 30); c.fillStyle = 'rgba(2,2,8,0.6)'; c.fillRect(0, 0, W, H); P.ground(c, W, H, H * 0.62, R(12), 0.03); T.finish(c, W, H, 22, 0.72); return cv; }
  if (name === 'far') {
    const [cv, c] = sheet(), hy = H * 0.74;
    T.sky(c, W, H, VOID.map(([t, col]: [number, number[]]) => [t, mix(col, [14, 16, 40], 0.5)] as [number, number[]]), R(15), 60);
    P.trials(c, W * 0.55, 540, 1.5, R(41)); P.guardian(c, W * 0.565, hy + 4, 0.36, R(42), 0); P.ground(c, W, H, hy, R(12), 0.04);
    T.finish(c, W, H, 24, 0.6); return cv;
  }
  if (name === 'mist') {
    // the dark mist that closes over his brother's light
    const [mv, mc] = sheet(620), r = R(77);
    for (let i = 0; i < 16; i++) { const x = W * 0.6 + (r() - 0.5) * 420, y = 300 + (r() - 0.5) * 260; K.brush(mc, [[x - 150 - r() * 80, y + (r() - 0.5) * 60], [x, y + (r() - 0.5) * 40], [x + 150 + r() * 80, y + (r() - 0.5) * 60]], 70 + r() * 50, [6, 7, 18], r, { passes: 4, alpha: 0.22 }); }
    return mv;
  }
  if (name === 'path') {
    const [cv, c] = sheet(), hy = H * 0.42;
    T.sky(c, W, H, DRIFT, R(16), 70);
    P.trials(c, W * 0.667, hy - 150, 0.6, R(41), 0.8); P.guardian(c, W * 0.72, hy + 2, 0.13, R(42), 0);
    P.ground(c, W, H, hy, R(17), 0.04); P.tiles(c, W, H, hy, R(18), 0, L);
    T.finish(c, W, H, 25, 0.55); return cv;
  }
  const [cv, c] = sheet(), hy = H * 0.42, r = R(20);
  T.sky(c, W, H, WOKEN, r, 150); T.stars(c, W, H * 0.4, r, Math.round(500 * W / 780), 3);
  P.trials(c, W * 0.667, hy - 150, 0.6, R(41), 0.7); P.guardian(c, W * 0.72, hy + 2, 0.13, R(42), 0);
  K.glow(c, W * 0.5, hy, 700, [255, 170, 110], 0.4, 'screen');
  P.ground(c, W, H, hy, R(17), 1); P.tiles(c, W, H, hy, R(18), 1, L);
  T.finish(c, W, H, 27, 0.35); return cv;
}
