// Types for companions.js (plain JavaScript shared with the art stills).
export const COMPANIONS: {
  kindling: (c: CanvasRenderingContext2D, x: number, y: number, s: number, col: number[], o?: { flap?: number; open?: number; alpha?: number; rot?: number }) => void;
  KINDLE: Record<string, number[]>;
};
