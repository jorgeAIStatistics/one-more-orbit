type Ctx = CanvasRenderingContext2D;
type RGB = [number, number, number] | number[];
type Dev = 'phone' | 'desktop';
interface WriteOpts { align?: CanvasTextAlign; alpha?: number; color?: string; style?: string; glow?: number; figs?: boolean; ink?: boolean }
export interface GalleryLay { big: [number, number, number]; lines: [number, number]; slots: Array<[number, number, number]> }
export const UI: {
  unit: (w: number, h: number, dev: Dev) => number;
  galleryLay: (w: number, h: number, dev: Dev, u: number) => GalleryLay;
  SHAPES: Record<string, Array<[number, number]>>;
  ROOMS: {
    desk: (ctx: Ctx, w: number, h: number, dev: Dev, u: number) => { dy: number; lampX: number };
    lamp: (ctx: Ctx, w: number, h: number, dev: Dev, u: number) => { hx: number; hy: number; gx: number; gy: number };
    hearth: (ctx: Ctx, w: number, h: number, dev: Dev, u: number) => { fx: number; fy: number; fw: number; shelves: Array<[number, number, number]>; eko: [number, number, number] };
    gallery: (ctx: Ctx, w: number, h: number, dev: Dev, u: number) => GalleryLay;
    page: (ctx: Ctx, w: number, h: number, dev: Dev, u: number) => { px: number; py: number; pw: number; ph: number; rot: number; ix: number };
  };
  C: {
    write: (ctx: Ctx, s: string, x: number, y: number, px: number, o?: WriteOpts) => number;
    rule: (ctx: Ctx, x0: number, x1: number, y: number, a?: number, c?: RGB) => void;
    flame: (ctx: Ctx, x: number, y: number, s: number, c?: RGB, lit?: number) => void;
    back: (ctx: Ctx, x: number, y: number, s: number, label: string, u: number, o?: { color?: RGB; alpha?: number; ink?: boolean }) => void;
    dab: (ctx: Ctx, x: number, y: number, s: number, on: boolean) => void;
    constellation: (ctx: Ctx, pts: Array<[number, number]>, lit: number | boolean[], sc: number, ox: number, oy: number, u: number, a?: number, tw?: ((i: number) => number) | null) => void;
    ekoIn: (ctx: Ctx, x: number, y: number, s: number, r: () => number, c: RGB, o?: { wisp?: boolean; lean?: number }) => void;
  };
};
