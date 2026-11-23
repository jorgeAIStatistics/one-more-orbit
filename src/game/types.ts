// Shapes of the level files in /levels and of the runtime objects built from them. One button: every note is a tap.

export type Judge = 'perfect' | 'great' | 'good' | 'miss';
export type Ramp = [number, number];
export type Shape = 'circle' | 'ellipse' | 'square';

export interface Look {
  palette: string;
  bg?: 'stars' | 'tunnel' | 'grid';
  eq?: 'bars' | 'wave' | 'burst';
  zoom?: Ramp;
  rot?: Ramp;
  tilt?: Ramp;
  drain?: Ramp;
  vignette?: Ramp;
  flip?: boolean;
}

export interface SegmentDef {
  id: string;
  bars: number;
  label: string;
  lap: number; // beats per trip round a ring: smaller is faster
  shape?: Shape;
  jump?: 'out' | 'in';
  rocket?: number; // extra rings the ball launches through on entering this section
  reverse?: boolean;
  revEvery?: number;
  warn?: string;
  teach?: string;
  enter?: string;
  blackout?: boolean;
  count?: boolean;
  look: Look;
  plan?: unknown;
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
  k: 't' | 'j'; // tap gate, or spike hop (tap the pad, land half a beat later)
  v?: 'b' | 'l'; // which voice it follows: bass/kick or lead (colour only)
  a?: number; // 1 = accent: a big hit
  g?: number; // ghost gate: 1 fades early, 2 fades late (teaching)
}

export interface ChartFile {
  level: string;
  stars: number;
  /** kick and snare strength per 16th note (digits 0-9), baked from the analysis for the visuals */
  energy?: { kick: string; snare: string };
  notes: NoteDef[];
}

export interface Segment extends SegmentDef {
  index: number;
  bar0: number;
  beat0: number;
  beat1: number;
  t0: number;
  t1: number;
}

/** One ring: the ball rides it from b0 until its last gate (the exit), then jumps to the next. */
export interface Ring {
  idx: number;
  b0: number;
  exitBeat: number;
  a0: number;
  dir: number;
  lap: number;
  lvl: number; // ring size as a power of the ring spacing; inward jumps lower it
  seg: number;
  shape: Shape;
  first: number;
  last: number;
  reversed: boolean;
}

export interface RNote {
  i: number;
  kind: 'tap' | 'hop';
  t: number; // seconds of song time (0 = bar 1)
  beat: number;
  seg: number;
  ring: number;
  angle: number;
  exit: boolean;
  accent: boolean;
  ghost: number;
  voice: 'b' | 'l';
  done: boolean;
  judge: Judge | null;
  hitT: number;
}
