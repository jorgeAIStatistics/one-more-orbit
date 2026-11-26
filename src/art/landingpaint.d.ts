// Types for landingpaint.js (plain JavaScript shared with the art stills).
type Ctx = CanvasRenderingContext2D;
export interface LandGeo { tall: boolean; u: number; k: number; hy: number; fx: number; fy: number; fire: number; F: number; sx: number; top: number; ex: number; signal: [number, number]; seam: [number, number]; orbin: [number, number] }
type Layer = (c: Ctx, w: number, h: number, stars: number) => void;
export const LANDING: {
  STAR_COLS: number[][];
  star: (c: Ctx, x: number, y: number, s: number, col?: number[], a?: number, turn?: number) => void;
  geo: (w: number, h: number, stars?: number) => LandGeo;
  sky: Layer; far: Layer; sleeper: Layer; ground: Layer; front: Layer;
  seam: (c: Ctx, w: number, h: number, stars: number, breath?: number) => void;
  flames: (c: Ctx, w: number, h: number, stars: number, t: number, grow?: number, lift?: number) => void;
  motes: (c: Ctx, w: number, h: number, stars: number, t: number) => void;
  signal: (c: Ctx, w: number, h: number, stars: number, t: number) => void;
  paint: (c: Ctx, w: number, h: number, stars: number, t?: number) => void;
  /** the vessel: its six sockets (layer space), and the channel from socket i to the fire, as a bezier [x0, y0, c1x, c1y, c2x, c2y, x1, y1] */
  sockets: (w: number, h: number, stars: number) => Array<[number, number]>;
  channel: (w: number, h: number, stars: number, i: number) => number[];
  SOCKETS: number;
};
