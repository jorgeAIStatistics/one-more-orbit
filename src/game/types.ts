// Shapes of the level files in /levels and of the runtime objects built from them.

export type Hand = 'L' | 'R' | 'A'; // cyan-left, pink-right, either
export type Side = 'L' | 'R';
export type Mode = 'tap' | 'hold' | 'colour' | 'dodge' | 'spinner' | 'dual';
export type Difficulty = 'normal' | 'hard' | 'insane';
export type Judge = 'perfect' | 'great' | 'good' | 'miss';
export type Ramp = [number, number];

export interface Look {
  palette: string;
  zoom?: Ramp;
  rot?: Ramp;
  drain?: Ramp;
  vignette?: Ramp;
  ring?: Ramp;
}

export interface SegmentDef {
  id: string;
  bars: number;
  label: string;
  mode: Mode;
  lap: number;
  dir?: number;
  revEvery?: number;
  counter?: boolean;
  teach?: string;
  enter?: string;
  blackout?: boolean;
  count?: boolean;
  look: Look;
  gen?: unknown;
}

export interface LevelFile {
  id: string;
  title: string;
  artist: string;
  release: string;
  hitsoundNote: number;
  segments: SegmentDef[];
}

export interface AudioMeta {
  file: string;
  frames: number; // sample count at 44.1 kHz, used to check the decoder
  firstSig: number;
  bpm: number;
  offset: number; // seconds from the start of the file to bar 1
  length: number;
  dropTime: number;
}

export interface NoteDef {
  t: number; // ticks, 12 per beat, from bar 1
  k: 't' | 'h' | 'z' | 's';
  h?: Hand;
  d?: number;
  lane?: number;
  n?: number;
  a?: number; // 1 = accent: a big hit, drawn larger with an impact sound
}

export interface ChartFile {
  level: string;
  difficulty: Difficulty;
  stars: number;
  /** beats per lap for each section, chosen by the chart tool so dense passages spread out */
  laps?: Record<string, number>;
  notes: NoteDef[];
}

/** One stretch of constant ring speed and direction. */
export interface OrbitPiece {
  b0: number;
  b1: number;
  lap: number;
  dir: number;
  a0: number;
}

export interface Segment extends SegmentDef {
  index: number;
  bar0: number;
  beat0: number;
  beat1: number;
  t0: number;
  t1: number;
}

export interface RNote {
  i: number;
  kind: 'tap' | 'hold' | 'haz' | 'spin';
  hand: Hand;
  t: number; // seconds of song time (0 = bar 1)
  t1: number;
  beat: number;
  beat1: number;
  lane: number;
  need: number;
  seg: number;
  ring: number;
  accent: boolean;
  // judging state
  headDone: boolean;
  tailDone: boolean;
  headJudge: Judge | null;
  heldBy: Side | null;
  got: number;
  hitT: number;
}
