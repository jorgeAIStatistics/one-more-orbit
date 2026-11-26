// Types for worldpaint.js (plain JavaScript shared with the art stills).
type Ctx = CanvasRenderingContext2D;
export interface OssaPose { rise?: number; rear?: number; head?: number; antler?: number; tail?: number; breath?: number; lit?: number; flicker?: number; face?: number }
export const WORLDS: {
  R0: number;
  EMBER: { forge: number; anvil: number; channels: number };
  CHANNELS: number[][][];
  emberLayer: (hot: boolean) => HTMLCanvasElement;
  edgeLayer: (lit: boolean) => HTMLCanvasElement;
  ashLayer: (hot: boolean) => HTMLCanvasElement;
  crucibleLayer: (hot: boolean) => HTMLCanvasElement;
  twinaLayer: (hot: boolean) => HTMLCanvasElement;
  twinbLayer: (hot: boolean) => HTMLCanvasElement;
  ossa: (c: Ctx, x: number, y: number, s: number, p: OssaPose) => void;
  OSSA_HOOF: [number, number];
  hearthStone: (c: Ctx, x: number, y: number, s: number, flash: number) => void;
  sleeper: (c: Ctx, R: number, p: { wake?: number; curl?: number; breath?: number }) => void;
  onSurface: (c: Ctx, a: number, r: number, draw: () => void) => void;
  forgeShape: (c: Ctx, s: number, hot: boolean) => void;
  anvilShape: (c: Ctx, s: number, hot: boolean) => void;
};
