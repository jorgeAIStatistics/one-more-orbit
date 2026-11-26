// The paint worker: heavy pictures painted off the main thread (OffscreenCanvas), handed back as ImageBitmaps.
// (the art's own code makes its scratch canvases with document.createElement: here that is an OffscreenCanvas)
import { OPENING_PICS, paintOpening, type OpeningPic } from './openingpaint';
import { LANDING } from './landingpaint.js';
import { WORLDS } from './worldpaint.js';
import { WORLDS2 } from './world2paint.js';
import { DUSK, K } from './painter.js';

(globalThis as unknown as { document: unknown }).document = { createElement: () => new OffscreenCanvas(1, 1) };
interface Job { id: number; kind: 'opening' | 'landingSky' | 'layer' | 'sky'; name: string; W: number; q: number; key?: string; w?: number; h?: number; stars?: number; hot?: boolean; stops?: unknown; seed?: number; fin?: number }
type Ctx = CanvasRenderingContext2D;
const send = (msg: Record<string, unknown>, bmp: ImageBitmap) => (self as unknown as Worker).postMessage({ ...msg, bmp }, [bmp]);
const LAYERS = { ...WORLDS, ...WORLDS2 } as unknown as Record<string, (hot: boolean) => OffscreenCanvas>;
self.onmessage = (e: MessageEvent<Job>) => {
  const j = e.data;
  if (j.kind === 'landingSky') {
    const w = j.w!, h = j.h!, cv = new OffscreenCanvas(Math.round(w * j.q), Math.round(h * j.q)), c = cv.getContext('2d')!;
    c.scale(j.q, j.q); LANDING.sky(c as unknown as Ctx, w, h, j.stars!);
    send({ kind: j.kind, key: j.key }, cv.transferToImageBitmap());
  } else if (j.kind === 'layer' && /Layer$/.test(j.name) && LAYERS[j.name]) {
    send({ kind: j.kind, key: j.key }, LAYERS[j.name](!!j.hot).transferToImageBitmap());
  } else if (j.kind === 'sky') {
    const w = j.w!, h = j.h!, cv = new OffscreenCanvas(w, h), c = cv.getContext('2d') as unknown as Ctx, r = K.RNG(j.seed!);
    DUSK.tools.sky(c, w, h, j.stops as never, r, 70); DUSK.tools.stars(c, w, h, r, Math.round((w * h) / 1500), 3); DUSK.tools.finish(c, w, h, j.fin!, 0.3);
    send({ kind: j.kind, key: j.key }, cv.transferToImageBitmap());
  } else if (j.kind === 'opening' && OPENING_PICS.includes(j.name as OpeningPic)) {
    const cv = paintOpening(j.name as OpeningPic, j.W, j.q, (w, h) => new OffscreenCanvas(w, h)) as OffscreenCanvas;
    send({ id: j.id, name: j.name }, cv.transferToImageBitmap());
  }
};
