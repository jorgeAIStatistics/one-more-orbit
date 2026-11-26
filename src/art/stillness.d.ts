type Ctx = CanvasRenderingContext2D;
export interface MassOpts { near?: number; seed?: number; toward?: [number, number] | null; reach?: number; n?: number; stutter?: boolean; t?: number }
export function skip(t: number, seed?: number): [number, number];
export function mass(c: Ctx, cx: number, cy: number, R: number, ry: number, o?: MassOpts): void;
export function stain(c: Ctx, x: number, y: number, r: number, seed: number, t?: number): void;
export function held(c: Ctx, draw: (dx: number, dy: number) => void, R: number, t?: number): void;
export function erasure(c: Ctx, cx: number, cy: number, R: number, ry: number, o?: { seed?: number; near?: number; t?: number }): void;
export function crust(c: Ctx, cx: number, cy: number, R: number, ry: number, o?: { seed?: number; t?: number }): void;
export function reachOut(c: Ctx, x0: number, y0: number, tx: number, ty: number, w: number, n: number, seed: number, reach: number, t?: number): void;
export function rings(c: Ctx, x: number, y: number, rx: number, ry: number, near?: number, t?: number): void;
export const STILL: { mass: typeof mass; stain: typeof stain; held: typeof held; skip: typeof skip; erasure: typeof erasure; crust: typeof crust; reachOut: typeof reachOut; rings: typeof rings };
