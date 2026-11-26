// The paint worker, and what it has painted (the performance pass of 2026-11-26). Whole-screen pictures laid over with
// paper grain are heavy (80-120 ms each), and so are the planets (each painted cold and relit): they are painted in a
// worker, off the main thread, ahead of time, and kept here as ImageBitmaps. Where a browser has no worker or
// OffscreenCanvas, or a picture is needed before it has come back, it is painted on the page as before.
let worker: Worker | null | undefined;
const done = new Map<string, ImageBitmap>();
const asked = new Set<string>();
const askedAt = new Map<string, number>();
/** One paint worker for the page, or none. */
export function paintWorker(): Worker | null {
  if (worker !== undefined) return worker;
  try { worker = typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined' && 'transferToImageBitmap' in OffscreenCanvas.prototype ? new Worker(new URL('./paintworker.ts', import.meta.url), { type: 'module' }) : null; } catch { worker = null; }
  if (worker) worker.addEventListener('message', (e: MessageEvent<{ key?: string; bmp?: ImageBitmap }>) => { if (e.data.key && e.data.bmp) done.set(e.data.key, e.data.bmp); });
  return worker;
}
function ask(key: string, job: Record<string, unknown>): void {
  const wk = paintWorker();
  if (!wk || done.has(key) || asked.has(key)) return;
  asked.add(key); askedAt.set(key, performance.now()); wk.postMessage({ ...job, key });
}

const skyKey = (w: number, h: number, q: number, stars: number) => `landing:${w}x${h}@${q.toFixed(3)}:${stars}`;
/** The Landing's sky, if the worker has painted it at this size. */
export function landingSky(w: number, h: number, q: number, stars: number): ImageBitmap | null { return done.get(skyKey(w, h, q, stars)) ?? null; }
/** Ask for the Landing's sky at this size, ahead of its being needed. */
export function askLandingSky(w: number, h: number, q: number, stars: number): void { ask(skyKey(w, h, q, stars), { kind: 'landingSky', w, h, q, stars }); }

/** the planets the worker can paint (worldpaint's and world2paint's layers) */
export type LayerName = 'emberLayer' | 'edgeLayer' | 'cirraLayer' | 'glassLayer' | 'verdLayer' | 'ashLayer' | 'crucibleLayer' | 'twinaLayer' | 'twinbLayer' | 'shardsLayer' | 'rocksLayer' | 'hearthLayer' | 'shelvesLayer' | 'kitemoonLayer';
/** A planet's picture, cold or relit, if the worker has painted it. */
export function planetLayer(name: LayerName, hot: boolean): ImageBitmap | null { return done.get(`${name}:${hot}`) ?? null; }
/** Ask for a planet's two pictures. */
export function askPlanet(name: LayerName): void { for (const hot of [false, true]) ask(`${name}:${hot}`, { kind: 'layer', name, hot }); }

/** a level's backdrop sky: gradient stops, its random seed and grain seed */
export interface SkySpec { stops: unknown; seed: number; fin: number }
const levelKey = (w: number, h: number, s: SkySpec) => `sky:${w}x${h}:${s.seed}:${s.fin}:${JSON.stringify(s.stops)}`;
/** A level's sky, if the worker has painted it at this size. */
export function levelSky(w: number, h: number, s: SkySpec): ImageBitmap | null { return done.get(levelKey(w, h, s)) ?? null; }
/** Ask for a level's sky at this size. */
export function askLevelSky(w: number, h: number, s: SkySpec): void { ask(levelKey(w, h, s), { kind: 'sky', w, h, ...s }); }

/**
 * A planet's pictures (cold, relit) now, if they are ready: from the worker; or, while the worker is still painting them
 * (up to 2.5 s), nothing yet (the world fades them in when they come); or, with no worker or after that, painted here.
 * (Painting them on the page as a level opened was a 100-200 ms frame; 2026-11-26.)
 */
export function pairNow(name: LayerName, make: (hot: boolean) => HTMLCanvasElement): [ImageBitmap | HTMLCanvasElement, ImageBitmap | HTMLCanvasElement] | null {
  const a = planetLayer(name, false), b = planetLayer(name, true);
  if (a && b) return [a, b];
  const wk = paintWorker();
  if (wk) {
    if (!asked.has(`${name}:false`)) askPlanet(name);
    const t = askedAt.get(`${name}:false`) ?? performance.now();
    if (performance.now() - t < 2500) return null;
  }
  return [a ?? make(false), b ?? make(true)];
}
