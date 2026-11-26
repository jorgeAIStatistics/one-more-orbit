// Types for coldpaint.js (plain JavaScript shared with the art stills).
type Ctx = CanvasRenderingContext2D;
export const COLDPAINT: {
  nebula: (c: Ctx, w: number, h: number, ash?: boolean) => void;
  music: (c: Ctx, ax: number, ay: number, bx: number, by: number, u: number, t?: number, broken?: number, fade?: number) => void;
  dread: (c: Ctx, x: number, y: number, rx: number, ry: number, seed: number, near: number) => void;
  tendrils: (c: Ctx, x0: number, y0: number, tx: number, ty: number, u: number, n: number, seed: number, reach?: number) => void;
};
