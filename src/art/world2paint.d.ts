// Types for world2paint.js (plain JavaScript shared with the art stills).
type Ctx = CanvasRenderingContext2D;
type RGB = number[];
export const WORLDS2: {
  R0: number;
  CIRRA: { masts: number[] };
  cirraLayer: (hot: boolean) => HTMLCanvasElement;
  shelvesLayer: (hot: boolean) => HTMLCanvasElement;
  kitemoonLayer: (hot: boolean) => HTMLCanvasElement;
  kite: (c: Ctx, x: number, y: number, s: number, rot: number, hot: boolean, col?: RGB) => void;
  glassLayer: (hot: boolean) => HTMLCanvasElement;
  verdLayer: (hot: boolean) => HTMLCanvasElement;
  seo: (c: Ctx, x: number, y: number, s: number, p: { wake?: number; fly?: number; sway?: number; flap?: number; lit?: number; t?: number; face?: number }) => void;
  vell: (c: Ctx, x: number, y: number, s: number, p: { wake?: number; mirror?: number; bow?: number; ripple?: number; lit?: number; t?: number }) => void;
  morrow: (c: Ctx, x: number, y: number, s: number, p: { climb?: number; reach?: number; lights?: number; breath?: number; lit?: number; t?: number }) => void;
  greatTree: (c: Ctx, x: number, y: number, s: number, grow: number, lit: number, t: number) => void;
  windSpirals: (c: Ctx, cx: number, cy: number, R: number, t: number, k: number, col?: RGB) => void;
  ripples: (c: Ctx, cx: number, cy: number, R: number, t: number, k: number, col?: RGB) => void;
  leaves: (c: Ctx, w: number, h: number, t: number, k: number, col?: RGB, n?: number) => void;
};
