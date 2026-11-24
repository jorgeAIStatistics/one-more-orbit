// Types for resultpaint.js (plain JavaScript shared with the art stills).
/* eslint-disable @typescript-eslint/no-explicit-any */
type Dev = 'phone' | 'desktop';
export const RESULTS: {
  RUNS: Record<string, any>;
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number, comp: string, run: string, dev: Dev, phase?: number) => void;
  LAYERS: {
    lay: (dev: Dev) => { horizon: number; sun: number; B: { x: number; y: number; w: number }; eko: [number, number, number]; hint: [number, number, CanvasTextAlign] };
    has: (id: string) => boolean;
    scene: (ctx: CanvasRenderingContext2D, w: number, h: number, id: string, dev: Dev, u: number, mode: 'cold' | 'warm' | 'blaze') => void;
    front: (w: number, h: number, id: string, dev: Dev, u: number) => { mask: HTMLCanvasElement; lip: HTMLCanvasElement; y: number };
    eko: (ctx: CanvasRenderingContext2D, x: number, y: number, s: number, lean: number) => void;
  };
};
