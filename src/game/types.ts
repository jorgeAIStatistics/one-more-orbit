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
  orbs?: boolean; // hop-slice core (tag gd-hop-slice)
  pads?: boolean;
  chain?: number;
  /**
   * ring-hop core. pulse: marks breathe with the kick. charge: nothing here can end the run; every note is a flow note
   * that charges the drop. smash: the section opens with the drop's big press on its first beat (launch: the game takes
   * that press itself). bars: how each bar plays, repeated to fill the section; a bar is words joined by "+":
   *   up | down | weave   ride the outside and hop outward / ride the inside and hop inward / flip on every press, bouncing between two rings
   *   spin                the opening is a gap in a turning ring          twin   twin orbit: a mirrored second ball
   *   sling               the bar's first press is a planet hop           turn   the orbit reverses at the bar line
   *   fast | slow | normal   orbit speed from this bar on
   * record: one of the passages worth recording by hand (Record Mode lists these first).
   */
  core?: { pulse?: boolean; charge?: boolean; launch?: boolean; smash?: boolean; bars?: string[]; record?: boolean };
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
  /** pitch classes of the song's scale, lowest first (used for the rising notes while the drop charges) */
  scale?: number[];
  /** shown on the level card: Easy, Normal, Hard, Insane... */
  difficulty?: string;
  /** what this level adds, for the level card */
  adds?: string;
  /** ring-hop core: the stretch of the level (in beats) that is built so far */
  lab?: [number, number];
  /** holds: long hops become gold rails to hold through, and empty stretches of ring get gold lines to float along */
  holds?: boolean;
  /**
   * A B-side: this level played on the night side of its planet. Same song and notes as the level `of`, harder rules:
   * tol = half-width of the openings in seconds, ahead = beats of course shown ahead of the ball, mirror = the orbit
   * runs the other way, speed = how much faster it turns.
   */
  side?: { of: string; tol?: number; ahead?: number; mirror?: boolean; speed?: number };
  /** star trails: [from, to] in beats. Play each stretch clean (every piece of gold, no stray taps) for its star. */
  stars?: Array<[number, number]>;
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
