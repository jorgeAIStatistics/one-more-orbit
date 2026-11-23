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
  /** slingshot: entering this section flies the ball to a new planet in this screen direction */
  sling?: [number, number];
  mini?: boolean; // mini mode: small, fast rings for the phrase
  orbs?: boolean; // new core: fast notes in this section become jump orbs
  pads?: boolean; // new core: long flat stretches get a launch pad on a strong beat
  chain?: number; // new core: back-to-back hops allowed before a breath (default 3)
  hazard?: string; // 'beam': hops clear a sweeping beam instead of a spike
  reverse?: boolean;
  /** the one sound this section's taps follow: arp, kick, snare or lead */
  follow?: string;
  motif?: string;
  cycle?: number;
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
  /** 16ths are swung (the off-16ths land late, on ticks 4 and 10 of 12) */
  swing?: boolean;
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
  k: 't' | 'j' | 'f' | 'p'; // tap gate, hop (over a spike or beam), flip gate (reverses direction), portal (jumps across the ring)
  v?: string; // the sound it follows: a arpeggio, k kick, s snare, l lead (gate colour)
  p?: number; // MIDI pitch of the followed note, so the hitsound can play the melody
  a?: number; // 1 = accent: a big hit
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
  portal: boolean; // entered through a portal (the ball arrives on the far side)
  planet: number;
}

export interface RNote {
  i: number;
  kind: 'tap' | 'hop' | 'flip' | 'portal';
  t: number; // seconds of song time (0 = bar 1)
  beat: number;
  seg: number;
  ring: number;
  angle: number;
  exit: boolean;
  accent: boolean;
  voice: string;
  pitch: number;
  done: boolean;
  judge: Judge | null;
  hitT: number;
}
