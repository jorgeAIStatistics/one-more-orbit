type Ctx = CanvasRenderingContext2D;
type Rnd = () => number;
export const WORLD1: {
  W: number; H: number;
  P: Record<string, (ctx: Ctx, n?: number) => void>;
  parts: {
    /** Ossa of Emberwick: lit 0 (banked, dark) to 1 (awake, its fire up); pose 'lie' or 'stand' */
    ossa: (ctx: Ctx, x: number, y: number, s: number, lit: number, r: Rnd, pose?: 'stand' | 'lie', face?: number) => void;
    /** Marlow, the lampmoth; lamp 0..1 is how bright he carries his light */
    moth: (ctx: Ctx, x: number, y: number, s: number, r: Rnd, lamp?: number) => void;
    jar: (ctx: Ctx, x: number, y: number, s: number, c: number[], open?: boolean) => void;
    tower: (ctx: Ctx, x: number, y: number, s: number, lit: number, r: Rnd) => void;
    kite: (ctx: Ctx, x: number, y: number, s: number, c: number[], lit: number, r: Rnd, rot?: number) => void;
  };
};
