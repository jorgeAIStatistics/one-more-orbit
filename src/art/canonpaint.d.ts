// Types for canonpaint.js (plain JavaScript shared with the art stills).
type Ctx = CanvasRenderingContext2D;
type Rnd = () => number;
type RGB = number[];
export interface Eyes { slant: number; open: number; big: number }
/** [elbow, hand] for the far arm and for the near one */
export type Arms = number[][][];
export type EyesName = 'open' | 'wide' | 'soft' | 'set' | 'worried' | 'closed';
export type ArmsName = 'rest' | 'reach' | 'up' | 'chest' | 'back' | 'brace';
export interface SparkOpts {
  who?: 'orbin' | 'helion'; glow?: number; lean?: number; face?: number; eyes?: EyesName | Eyes; blink?: number; look?: number[];
  crest?: number; arms?: ArmsName | Arms; ring?: boolean; beat?: number; back?: boolean; t?: number; lite?: boolean; tint?: RGB | null;
}
type Stops = Array<[number, number[]]>;
export const CANON: {
  PW: number; PH: number;
  A: Record<string, (ctx: Ctx) => void>;
  EYES: Record<EyesName, Eyes>;
  ARMS: Record<ArmsName, Arms>;
  /** a point on the path: [x, y, scale] at t 0 (at your feet) .. 1 (the horizon) */
  along: (w: number, h: number, hy: number, t: number, bend?: number) => [number, number, number];
  play: (ctx: Ctx, w: number, h: number, dev: 'phone' | 'desktop', o?: Record<string, unknown>) => void;
  parts: {
    spark: (ctx: Ctx, x: number, y: number, s: number, o?: SparkOpts) => void;
    stillness: (ctx: Ctx, x: number, y: number, rx: number, ry: number, r: Rnd, o?: { near?: number; rot?: number }) => void;
    /** state: 0 dormant, 1 stirring, 2 turned on you, 3 reignited */
    guardian: (ctx: Ctx, x: number, y: number, s: number, r: Rnd, state?: number) => void;
    trials: (ctx: Ctx, x: number, y: number, s: number, r: Rnd, a?: number) => void;
    ground: (ctx: Ctx, w: number, h: number, hy: number, r: Rnd, woke?: number, seed?: number) => { R: number; cx: number; cy: number };
    tiles: (ctx: Ctx, w: number, h: number, hy: number, r: Rnd, lit?: number, o?: { n?: number; wide?: number; seed?: number; bend?: number }) => void;
    node: (ctx: Ctx, x: number, y: number, s: number, o?: { lit?: number; cue?: number; flash?: number }) => void;
    dust: (ctx: Ctx, x: number, y: number, R: number, r: Rnd, n: number, c?: RGB) => void;
    words: (ctx: Ctx, s: string, x: number, y: number, px: number, o?: { align?: CanvasTextAlign; alpha?: number; color?: string }) => void;
  };
  pal: { VOID: Stops; DRIFT: Stops; WOKEN: Stops; NEBULA: Stops };
};
