// The course: a level's notes turned into rings to hop between.
// Two layers of notes. SURVIVAL presses are the strong beats: a tap on one hops the ball to the next ring through
// an opening, and the flight lasts until the next press. FLOW notes are every faster note in the music: optional
// taps that build flow (and, in a charge section, the drop) and can never end the run.
// How each bar plays (its mode) comes from the level file; the notes themselves never change with the mode, so the
// same music always asks for the same taps.
import type { Level } from '../game/level';

export interface Press {
  i: number;
  beat: number;
  /** half-width of the opening, in beats: tap within this of the note and you clear it */
  tol: number;
  /** hop: through an opening onto the next ring. flip: onto the facing surface of the next ring (gravity turns over) */
  kind: 'hop' | 'flip';
  /** the game takes this one itself on the beat; a tap on it still counts for flow */
  auto: boolean;
  /** the drop downbeat: a big, extra-generous press that sets the drop off */
  smash: boolean;
  /** one of the phrase's big hits: an ordinary press, drawn and answered bigger */
  accent: boolean;
  /** planet hop: this press slings the ball across to the next planet (a two-beat flight) */
  sling: boolean;
  /** the first press after a planet hop: at least a beat and a half after landing, with a wider opening, and highlighted */
  after: boolean;
  /** weave: one of a run of flips that bounce the ball between two rings */
  weave: boolean;
  /** spin gate: the opening is a gap in a turning ring that comes round to the mark on the beat */
  spin: boolean;
  /** twin orbit: which ball's ring carries the mark (both balls hop on every tap); null outside twin bars */
  twin: 'a' | 'b' | 'both' | null;
  /** ring level it leaves and the one it lands on */
  from: number;
  to: number;
  /** side ridden before the press: 1 = outside of the ring (hops go outward), -1 = inside (hops go inward) */
  side: 1 | -1;
  /** planet it leaves and the one it lands on (they differ only for a planet hop) */
  planet: number;
  planetTo: number;
  /** where the camera should sit for this hop; a weave holds it between the two rings */
  camLv: number;
  /** beat it lands on: the next press, or two beats on if the next press is further away */
  land: number;
  bounce: boolean;
  /** how far the flight floats above the ring it lands on, in ring levels */
  bulge: number;
  pitch: number | null;
  seg: number;
  /** the form Eko is in for this press (a planet hop, the drop's big press and a twin orbit are always the Orb) */
  form: Form;
  /** Comet: what the button does on this mark. down: press and keep holding. up: let go. tap: everywhere else. */
  act: 'tap' | 'down' | 'up';
  /** the flight is a straight line (the Satellite's zig-zag, a slipstream) instead of a hop's arc */
  line: boolean;
  /** the mark hangs in mid-air, where the hop before it ends; there is no ring under it (every orb is one of these) */
  chime: boolean;
  /** a slipstream: the tap is carried along an arrow for a beat, two rings on */
  slip: boolean;
  /**
   * An orb: a mark tapped in mid-air, at the end of the hop before it. jump: another hop from where you are.
   * dash: a slipstream from where you are. grav: gravity turns over in mid-air. '' : not an orb.
   */
  orb: '' | 'jump' | 'dash' | 'grav';
  /** a pad on the ring, tapped like any mark: a spring pad throws the ball to the next planet, a tide pad turns gravity over */
  pad: '' | 'spring' | 'tide' | 'jump' | 'vent';
  /** part of a form's safe introduction: the game plays it, to show the move */
  intro: boolean;
  /** the first press after a lens or a gate: a wider opening, and tapping early for it is never punished */
  wide: boolean;
}
/** The forms Eko can take. A lens changes it; each form answers a tap in its own way. */
export type Form = 'orb' | 'meteor' | 'sat' | 'pulsar' | 'comet';
/** An optional note: on a ring or in mid-flight, wherever the ball is at that moment. `hold`: it starts that gold line. */
export interface FlowNote {
  beat: number; tol: number; pitch: number | null; charge: boolean; rho: number; side: number; air: boolean; twin: 'a' | 'b' | 'both' | null; planet: number; hold: number;
  /** 0: a note to tap. 1: gold along a Comet's climb, collected by holding. 2: collected for the player (a form's introduction). */
  ride: 0 | 1 | 2;
  /** on a shard branch: which one (-1: none) */
  branch: number;
}
/**
 * A hold: keep the button down from `a` to `b` and the gold along it is yours. It can never end the run.
 * A rail rides a long hop: press on the white mark as usual, and keep holding through the flight.
 * A line floats above an empty stretch of ring: press on its first gold note and the ball lifts to ride along it.
 */
export interface Hold {
  i: number;
  a: number;
  b: number;
  rail: boolean;
  /** gold along it, in beats: every half beat, plus the music's own notes in the stretch. Collected while held. */
  ticks: number[];
  /** points along it, for drawing */
  path: Array<{ beat: number; rho: number; side: number; planet: number }>;
  /** in a twin orbit: both balls ride it */
  twin: boolean;
  /** a tether: a rail that must be held. Let go before its end and the run is over. */
  tether: boolean;
}
/**
 * A star trail: a stretch of the level to play clean. Collect every piece of gold from `a` to `b` (notes and holds)
 * with no tap that misses, and the star at the end is yours. It never ends the run; one slip and that star is gone
 * for the attempt.
 */
export interface Star {
  i: number;
  a: number;
  b: number;
  /** gold in the trail: flow notes, and the gold along its holds */
  gold: number;
  /** where the trail starts and where the star waits, as the ball will be at those beats */
  from: { rho: number; side: number; planet: number };
  at: { rho: number; side: number; planet: number };
}
export interface Layers { survival: number[]; flow: number[] }
/** Things a level can ask of the player; the first time each appears it gets a hint. */
export type Feature = 'smash' | 'charge' | 'flip' | 'weave' | 'spin' | 'sling' | 'reverse' | 'faster' | 'slower' | 'twin' | 'rail' | 'line' | 'tether' | 'meteor' | 'sat' | 'pulsar' | 'comet' | 'spring' | 'tide' | 'chime' | 'slip' | 'grav' | 'combo' | 'mirror' | 'invert' | 'dual';
/** How one bar plays. */
export interface BarCfg { token: string; mode: 'up' | 'down' | 'weave'; pad: boolean; throw: boolean; vent: boolean; mini: boolean; snap: boolean; spin: boolean; twin: boolean; dual: boolean; echo: Form; sling: boolean; spring: boolean; tide: boolean; turn: boolean; mirror: boolean; invert: boolean; long: boolean; tether: boolean; chime: boolean; slip: boolean; grav: boolean; combo: string; sparse: boolean; strong: boolean; beats: boolean; every: boolean; hold: boolean; sync: boolean; speed: number; form: Form }

export interface Course {
  spb: number;
  start: number;
  end: number;
  dropBeat: number;
  presses: Press[];
  flow: FlowNote[];
  /** every tap of a perfect run, in beats (presses and flow notes): each time the button goes down */
  taps: number[];
  /** notes a perfect run plays without a tap: a Comet's second marks (letting go) and the gold collected by riding */
  rides: number[];
  /** the holds, in order; they never overlap */
  holds: Hold[];
  /** a perfect run as the button sees it: [beat, true] = down, [beat, false] = up */
  script: Array<[number, boolean]>;
  /** the star trails, in order (three in a finished level) */
  stars: Star[];
  checkpoints: number[];
  /**
   * Forgiving taps (the owner's rule of 2026-11-25): a tap up to `buffer` seconds before an opening (or an orb, a pad,
   * a Meteor wall) is held and performed exactly on its beat. A tap earlier than that is ignored, unless it falls in the
   * last `early` beats before the buffer: there it still hits the ring (0 = never: the first two levels).
   */
  buffer: number;
  early: number;
  /** every mark a tap answers, in order (presses and gold notes to tap): what the anti-mash rule compares tapping with */
  marks: number[];
  /** stretches where nothing can end the run and on-beat taps charge the drop: [from, to] in beats */
  charges: Array<[number, number]>;
  chargeNotes: number;
  inCharge(beat: number): boolean;
  /** angle of the ball round the core at a beat (speed portals change the rate, turns its sign) */
  angle(beat: number): number;
  /** beats at which the orbit turns round */
  turns: number[];
  /** beats at which the orbit changes speed (tempo gates), whether it gets faster, and the new speed */
  portals: Array<{ beat: number; faster: boolean; speed: number }>;
  /** lenses: beats at which Eko changes form. intro: the form is new to the level, and the bar after it is played for the player */
  lenses: Array<{ beat: number; form: Form; intro: boolean }>;
  /** mirror gates: beats at which the picture flips left to right */
  mirrors: number[];
  /** upside-down gates: beats at which the picture flips top to bottom */
  inverts: number[];
  /** stretches of twin orbit in which the second spark is another form on a path of its own: [from, to, its form] */
  duals: Array<[number, number, Form]>;
  /** the form in force at a beat */
  formAt(beat: number): Form;
  /** where a perfect run is at a beat: ring level, side of the ring, planet */
  at(beat: number): { rho: number; side: number; planet: number };
  /** stretches played as a twin orbit */
  twins: Array<[number, number]>;
  /** the first time each mechanic appears: where the hint goes */
  firsts: Array<{ beat: number; what: Feature }>;
  /** one entry per bar of the level */
  bars: BarCfg[];
}

export const LAP = 8; // beats per trip round the core at normal speed
export const CAP = 2; // a flight never lasts longer than this many beats; then you ride until the next opening
export const TOL_S = 0.12; // openings are clearable within this much either side of the note...
export const TOL_SMASH_S = 0.16; // the drop's smash is wider still
export const TOL_MIN_S = 0.055; // ...narrowing only if someone records presses faster than eighths
export const BUFFER_S = 0.09; // a level's tap buffer when it sets none (the strictest of the owner's table)
export const EARLY_ZONE = 0.45; // ...and the beats before it where a tap way too early still hits the ring
export const NEAR = 0.6; // beats before an opening in which a tap is "going for it": too early and it hits the ring
export const FLOW_TOL_S = 0.07; // how close a tap must be to a flow note to touch it
export const FLOW_S = 0.04; // taps this close to a note build flow
export const MIN_GAP = 1; // beats between generated survival presses: quarter notes at most
export const SLING_FLIGHT = 2; // beats a planet hop spends in the air
export const COUNT_IN = 4; // beats at the very start of a level with no survival press: the 3, 2, 1
export const LIFT = 0.42; // ring levels a held ball floats above its ring
export const HOLD_MIN = 1; // beats: no hold is shorter
export const HOLD_MAX = 2; // ...and no gold line longer
export const HOLDS_FROM = 16; // beats: a level's opening bars are taps only
export const RAIL_FLIGHT = 2; // a hop that flies this long becomes a rail
export const LINE_CLEAR = 0.75; // beats between the end of a gold line and the next white mark: time to let go and tap
export const TETHER_GRIP = 0.3; // beats after a tether's mark by which the button must be down...
export const TETHER_LET_S = 0.12; // ...and it may come up this many seconds before the tether's end
export const TURN_EASE = 0; // a turn or a speed change happens on the bar line itself: it is telegraphed, then it snaps
export const LINE_TIGHT = 0.5; // ...or this, where the ride is too short for a line otherwise (a rail leaves no more either)
/** Beats after a planet hop lands in which nothing can end the run: at least 1.5, and at least 0.85 s at any tempo. */
export const landingGrace = (spb: number) => Math.max(1.5, Math.ceil((0.85 / spb) * 2) / 2);
const TWO_PI = Math.PI * 2;
/** How a flight climbs to the next ring: fast at first, so it is through the opening early and then floats down. */
/**
 * How far through a hop the ball is, 0 to 1, for a share u of its flight time. It leaves the ring from rest, is
 * fastest a fifth of the way in and settles onto the next ring: no sudden start, so the ball never jumps on the tap.
 */
/** Beats a Meteor's dash, a Pulsar's flip and a Comet's climb take at most. */
export const QUICK = 0.5;
export const SLIP_FLIGHT = 1; // beats a slipstream carries the ball
const RISE_K = 5;
const RISE_END = 1 - (1 + RISE_K) * Math.exp(-RISE_K);
export const rise = (u: number) => (u <= 0 ? 0 : u >= 1 ? 1 : (1 - (1 + RISE_K * u) * Math.exp(-RISE_K * u)) / RISE_END);
/** The arc of a hop that comes back to the same height: up and down from rest, 0 at both ends and 1 in the middle. */
export const arc = (u: number) => { const s = Math.sin(Math.PI * (u < 0 ? 0 : u > 1 ? 1 : u)); return s * s; };
export const smoothstep = (t: number) => { const x = t < 0 ? 0 : t > 1 ? 1 : t; return x * x * (3 - 2 * x); };
/** Radial position (ring levels) of a perfectly timed flight of press p at a beat. */
export const flightRho = (p: Press, beat: number): number => {
  const u = Math.max(0, Math.min(1, (beat - p.beat) / (p.land - p.beat)));
  if (p.line) return p.from + (p.to - p.from) * u;
  return p.from + (p.to - p.from) * rise(u) + p.side * p.bulge * arc(u);
};
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const FORMS: Form[] = ['orb', 'meteor', 'sat', 'pulsar', 'comet'];
const snap = (b: number) => Math.round(b * 12) / 12;

/**
 * Splits generated notes into the two layers. Survival presses are the strong beats, never closer than a beat:
 * the chart's accents first, then notes on the beat, then half-beats, then the rest, each only if no chosen press
 * is within a beat of it. Everything else is a flow note. Hand-recorded bars skip this: Record Mode sets each
 * note's layer itself. (Swung songs put their off-beats at a third or two thirds of the beat; those rank with the
 * other off-beats.)
 */
export function autoLayers(beats: number[], accents: number[] = []): Layers {
  const notes = [...new Set(beats.map(snap))].sort((a, b) => a - b);
  const big = new Set(accents.map(snap));
  const frac = (b: number) => Math.abs(b - Math.round(b));
  const rank = (b: number) => (big.has(b) ? -1 : frac(b) < 0.01 ? 0 : Math.abs(frac(b) - 0.5) < 0.01 ? 1 : 2);
  const chosen: number[] = [];
  for (const r of [-1, 0, 1, 2]) for (const b of notes) if (rank(b) === r && chosen.every((c) => Math.abs(c - b) >= MIN_GAP - 1e-6)) chosen.push(b);
  const set = new Set(chosen);
  return { survival: notes.filter((b) => set.has(b)), flow: notes.filter((b) => !set.has(b)) };
}

/**
 * One entry per bar, from each section's `core.bars` (repeated to fill the section). A bar's token is words joined
 * by "+": up | down | weave set how the ball moves between rings; spin, twin, sling, turn add to it; fast | slow |
 * normal set the orbit speed from that bar on. long: the bar is played in two long strides (its presses on beats 2
 * and 4 fold into the hop before them, which becomes a rail to hold); for bars that are a press on every beat.
 * tether: the bar's rails must be held (never a planet hop's).
 * x0.5 ... x2: a tempo gate, the orbit speed from that bar on. orb | meteor | sat | pulsar | comet: Eko's form from
 * that bar on (a lens stands on the bar line). spring: the bar's first press is a planet hop the game takes itself.
 * tide: the bar's first press is taken by the game (with a change of up/down: a gravity flip without a tap).
 * chime: the bar's chained hops are jump orbs (taken in mid-air). slip: its hops are slipstreams. grav: its chained
 * hops are gravity orbs. c=<letters>: a combo, one letter per press of the bar in order: j jump orb, d dash orb,
 * g gravity orb, anything else an ordinary press (c=.jd is hop, jump orb, dash orb). An orb is only ever a press that
 * the hop before lands on exactly; where the music does not chain the hops, the press stays an ordinary one.
 * mirror: the picture flips left to right at the bar line. invert: it flips top to bottom.
 * dual: a twin orbit whose second spark is a Pulsar; dual=sat: a Satellite.
 * sparse: only the bar's first and third beats are presses; its other presses become gold (for fast songs played early).
 * strong: only the bar's three strongest presses stay (its downbeat, then the hardest hits); the rest become gold.
 * beats: a press on every beat of the bar that the music clearly hits (a kick or a snare), charted or not.
 * every: the same, and also on the charted eighth notes between them that are hit as hard (a climax: "a wall on every beat").
 * hold: the bar's last press is kept down: a ribbon runs on from it along the path, to three quarters of a beat before
 * the next mark (the charge before a drop; a held note over a pad). It can never end the run.
 * sync: in a twin orbit, every press is taken by both sparks at once (the brothers in step).
 */
export function barPlan(level: Level): BarCfg[] {
  const out: BarCfg[] = [];
  let speed = 1;
  let form: Form = 'orb';
  for (const s of level.segments) {
    const tokens = s.core?.bars?.length ? s.core.bars : ['up'];
    for (let k = 0; k < s.bars; k++) {
      const token = tokens[k % tokens.length];
      const w = token.split('+');
      if (w.includes('fast')) speed = 1.25; else if (w.includes('slow')) speed = 0.75; else if (w.includes('normal')) speed = 1;
      const x = w.find((s) => /^x\d/.test(s)); // a tempo gate: x0.5, x0.75, x1.25, x1.5, x2
      if (x) speed = clamp(parseFloat(x.slice(1)) || 1, 0.5, 2);
      for (const f of FORMS) if (w.includes(f)) form = f;
      const dw = w.find((s) => s === 'dual' || s.startsWith('dual='));
      const dual = !!dw;
      const echo: Form = dw && dw.endsWith('=sat') ? 'sat' : 'pulsar';
      const twin = w.includes('twin') || dual;
      const combo = (w.find((s) => s.startsWith('c=')) ?? '').slice(2);
      // a planet hop only ever starts a phrase or its second half (every other bar), and never in a twin orbit
      out.push({ token, mode: w.includes('weave') ? 'weave' : w.includes('down') ? 'down' : 'up', pad: w.includes('pad'), throw: w.includes('throw'), vent: w.includes('vent'), mini: w.includes('mini'), snap: w.includes('snap'), spin: w.includes('spin'), twin, dual, echo, sling: w.includes('sling') && !twin && k % 2 === 0, spring: w.includes('spring') && !twin && k % 2 === 0, tide: w.includes('tide') && !twin, turn: w.includes('turn'), mirror: w.includes('mirror'), invert: w.includes('invert'), long: w.includes('long'), tether: w.includes('tether'), chime: w.includes('chime'), slip: w.includes('slip'), grav: w.includes('grav'), combo, sparse: w.includes('sparse'), strong: w.includes('strong'), beats: w.includes('beats') || w.includes('every'), every: w.includes('every'), hold: w.includes('hold'), sync: w.includes('sync'), speed, form });
    }
  }
  return out;
}

export function buildCourse(level: Level, layers: Layers, pitchAt: (beat: number) => number | null, range?: [number, number], accents: number[] = []): Course {
  const spb = level.spb;
  const start = range ? range[0] : 0;
  const end = range ? range[1] : level.endTime / spb;
  const segs = level.segments;
  const bars = barPlan(level);
  const barAt = (beat: number) => bars[clamp(Math.floor((beat + 1e-6) / 4), 0, bars.length - 1)];
  const inRange = (b: number) => b >= start && b < end - 0.5;
  const charges: Array<[number, number]> = [];
  for (const s of segs) {
    if (!s.core?.charge || s.beat1 <= start || s.beat0 >= end) continue;
    const last = charges[charges.length - 1];
    if (last && Math.abs(last[1] - s.beat0) < 1e-6) last[1] = s.beat1; else charges.push([s.beat0, s.beat1]);
  }
  const inCharge = (b: number) => charges.some(([a, z]) => b >= a - 1e-6 && b < z - 1e-6);

  // In a charge section every note is a flow note. A section marked `smash` opens with the drop's big press on its
  // first beat (`launch`: the game takes that press itself).
  const auto = new Set(segs.filter((s) => s.core?.launch && inRange(s.beat0)).map((s) => s.beat0));
  const smash = new Set(segs.filter((s) => s.core?.smash && inRange(s.beat0)).map((s) => s.beat0));
  // the level's first bar is the count-in: its notes are flow notes, so the first press never comes as a surprise
  const counted = (b: number) => !!range || b >= COUNT_IN - 1e-6;
  let ground = [...new Set([...layers.survival.map(snap).filter((b) => inRange(b) && !inCharge(b) && counted(b)), ...auto, ...smash])].sort((a, b) => a - b);
  // nothing else within a beat of a smash or a launch: those own their moment
  ground = ground.filter((b) => auto.has(b) || smash.has(b) || ![...auto, ...smash].some((x) => Math.abs(x - b) < MIN_GAP - 1e-6));
  // A bar marked `sparse` keeps only the presses on its first and third beats: the rest are gold, there to take or leave.
  ground = ground.filter((b) => { if (!barAt(b).sparse || auto.has(b) || smash.has(b)) return true; const off = b - Math.floor((b + 1e-6) / 4) * 4; return Math.abs(off) < 0.01 || Math.abs(off - 2) < 0.01; });
  // A bar marked `strong` keeps its three strongest presses: the downbeat if it has one, then the hardest hits (an
  // accent first, then kick or snare). The rest are gold. For a form that needs room to breathe between actions.
  const loud = (b: number) => Math.max(level.energyAt('kick', (b + 0.02) * spb), level.energyAt('snare', (b + 0.02) * spb));
  if (bars.some((b) => b.strong)) {
    const big = new Set(accents.map(snap));
    const keep = new Set<number>();
    bars.forEach((cfg, bar) => {
      if (!cfg.strong) return;
      const mine = ground.filter((b) => Math.floor((b + 1e-6) / 4) === bar);
      const rank = (b: number) => (Math.abs(b - bar * 4) < 0.01 ? 9 : 0) + (big.has(b) ? 2 : 0) + loud(b);
      for (const b of [...mine].sort((x, y) => rank(y) - rank(x) || x - y).slice(0, 3)) keep.add(b);
    });
    ground = ground.filter((b) => !barAt(b).strong || keep.has(b) || auto.has(b) || smash.has(b));
  }
  // A bar marked `beats` takes a press on every beat the music clearly hits (a kick or a snare under it), whether or
  // not the chart had a note there; `every` also takes the charted eighth notes between them that are hit as hard.
  // Never beside the drop's big press.
  if (bars.some((b) => b.beats)) {
    const charted = new Set([...layers.survival, ...layers.flow].map(snap));
    const all = [...ground];
    bars.forEach((cfg, bar) => {
      if (!cfg.beats) return;
      for (let k = 0; k < 8; k++) {
        const b = snap(bar * 4 + k / 2);
        // (`beats` keeps a beat between presses: it fills in the beats the chart left bare. `every` goes down to eighth notes.)
        if (!inRange(b) || inCharge(b) || !counted(b) || all.some((x) => Math.abs(x - b) < (cfg.every ? 0.5 : MIN_GAP) - 1e-6) || [...auto, ...smash].some((x) => Math.abs(x - b) < MIN_GAP - 1e-6)) continue;
        if (loud(b) >= 0.5 && (k % 2 === 0 || (cfg.every && charted.has(b)))) all.push(b);
      }
    });
    ground = all.sort((a, b) => a - b);
  }
  // A level whose rules allow `pairs` (the slow, heavy one) also takes some of its eighth notes as presses: up to that
  // many a bar, each a note on the half beat with a press on the beat before it and a kick or snare under it, and
  // never two within two beats of each other. So the presses come in pairs, never in runs.
  const pairs = level.file.side ? 0 : level.file.rules?.pairs ?? 0;
  if (pairs > 0) {
    const has = new Set(ground);
    const cand = [...new Set(layers.flow.map(snap))].filter((b) => inRange(b) && !inCharge(b) && counted(b) && Math.abs(b - Math.floor(b) - 0.5) < 0.01 && has.has(snap(b - 0.5)) && loud(b) >= 0.5 && !barAt(b).long && !barAt(b).sparse && !barAt(b).strong && ![...auto, ...smash].some((x) => Math.abs(x - b) < MIN_GAP - 1e-6));
    const took: number[] = [];
    for (const b of cand.sort((x, y) => x - y)) { // in order through the bar, so a phrase that repeats gets the same pairs every time
      const bar = Math.floor(b / 4);
      if (took.filter((t) => Math.floor(t / 4) === bar).length >= pairs || took.some((t) => Math.abs(t - b) < 2 - 1e-6)) continue;
      took.push(b);
    }
    ground = [...ground, ...took].sort((a, b) => a - b);
  }
  // Long strides. In a bar marked `long` the presses on beats 2 and 4 fold into the press a beat before: that hop
  // flies two beats and becomes a rail, and the folded note is gold along it. (Levels with holds, after the opening.)
  if (level.file.holds) {
    const has = new Set(ground);
    ground = ground.filter((b) => {
      const bar = Math.floor((b + 1e-6) / 4);
      const off = b - bar * 4;
      if (!bars[bar]?.long || bar * 4 < Math.max(HOLDS_FROM, start + COUNT_IN) - 1e-6 || auto.has(b) || smash.has(b)) return true;
      return !((Math.abs(off - 1) < 0.01 || Math.abs(off - 3) < 0.01) && has.has(snap(b - 1)));
    });
  }
  // Planet hops. One launches from the first press of a bar marked `sling`, if that press is on the beat in the
  // bar's first half: a strong beat at a phrase boundary. The flight lasts two beats, and after it lands nothing can
  // end the run for the landing grace: presses that fall in the flight or the grace become flow notes.
  const grace = landingGrace(spb);
  const slings = new Set<number>();
  const springs = new Set<number>();
  const afters = new Set<number>();
  const kept: number[] = [];
  let hold = -Infinity;
  let waiting = false;
  for (const b of ground) {
    const fixed = smash.has(b) || auto.has(b);
    if (b < hold - 1e-6 && !fixed) continue;
    const bar = Math.floor((b + 1e-6) / 4);
    const firstInBar = !kept.some((x) => Math.floor((x + 1e-6) / 4) === bar);
    if (waiting) { afters.add(b); waiting = false; }
    if (!fixed && (barAt(b).sling || barAt(b).spring) && firstInBar && Math.abs(b - Math.round(b)) < 0.01 && b - bar * 4 < 2 - 1e-6) {
      slings.add(b);
      if (barAt(b).spring && !barAt(b).sling) springs.add(b); // a springboard: the same throw, with no tap
      hold = b + SLING_FLIGHT + grace;
      waiting = true;
    }
    kept.push(b);
  }
  ground = kept;
  const groundSet = new Set(ground);
  const barOf = (b: number) => Math.floor((b + 1e-6) / 4);
  // Lenses: where the form changes, bar by bar. The first time a form appears in a level, the bar after its lens is
  // its safe introduction: the game plays that bar's presses itself, to show the move, and nothing in it can end the run.
  const lenses: Course['lenses'] = [];
  const introBars = new Set<number>();
  const softBars = new Set<number>(); // a form met on an earlier planet comes back: no introduction, but its first two presses are wide
  const gates: number[] = []; // every bar line something changes on: the first press after it gets a wider opening
  {
    const met = new Set<Form>(['orb']);
    const known = new Set<string>(level.file.rules?.known ?? []);
    bars.forEach((b, n) => {
      const was = n > 0 ? bars[n - 1] : null;
      const beat = n * 4;
      if (b.form !== (was ? was.form : 'orb')) {
        const fresh = !met.has(b.form) && !level.file.side && level.file.rules?.intro !== false;
        const intro = fresh && !known.has(b.form);
        met.add(b.form);
        if (beat >= start - 1e-6 && beat < end) { lenses.push({ beat, form: b.form, intro }); gates.push(beat); if (intro) introBars.add(n); else if (fresh) softBars.add(n); }
      }
      if (was && (b.turn || b.mirror || b.invert || b.speed !== was.speed) && beat > start && beat < end) gates.push(beat);
    });
  }
  const formOf = (b: number): Form => (smash.has(b) || auto.has(b) || slings.has(b) || barAt(b).twin ? 'orb' : barAt(b).form);
  // a form's introduction is played for the player. Pads are not: a spring pad (the bar's planet hop) and a tide pad
  // (the bar's first press, where gravity turns over) are marks to tap like any other, drawn as pads.
  const gift = new Map<number, 'intro' | 'spring' | 'tide'>();
  {
    const firstOf = new Map<number, number>();
    for (const b of ground) if (!firstOf.has(barOf(b))) firstOf.set(barOf(b), b);
    for (const b of ground) {
      if (smash.has(b) || auto.has(b)) continue;
      if (springs.has(b)) gift.set(b, 'spring');
      else if (introBars.has(barOf(b)) && !slings.has(b)) gift.set(b, 'intro');
      else if (barAt(b).tide && firstOf.get(barOf(b)) === b && !slings.has(b)) gift.set(b, 'tide');
    }
  }
  const wide = new Set<number>();
  for (const g of gates) { const b = ground.find((x) => x >= g - 1e-6 && x < g + 4 - 1e-6); if (b !== undefined && gift.get(b) !== 'intro') wide.add(b); }
  // after its introduction, a form's first two real presses have openings twice as wide
  const easy = new Set<number>();
  for (const n of introBars) {
    const f = bars[n].form;
    let left = 2;
    for (const b of ground) { if (b < (n + 1) * 4 - 1e-6 || left === 0) continue; if (barAt(b).form !== f) break; if (formOf(b) === f && gift.get(b) !== 'intro') { easy.add(b); left--; } }
  }
  for (const n of softBars) {
    const f = bars[n].form;
    let left = 2;
    for (const b of ground) { if (b < n * 4 - 1e-6 || left === 0) continue; if (barAt(b).form !== f) break; if (formOf(b) === f) { easy.add(b); left--; } }
  }
  // The Comet: its marks come in pairs. Press on the first and keep holding (it climbs to the ring above), let go on
  // the second (it falls back). Pairs never cross a section, so a practice checkpoint always starts with a press; a
  // mark left over at the end of a run of them is an ordinary tap.
  const acts = new Map<number, 'down' | 'up'>();
  {
    let run: number[] = [];
    const close = () => { for (let k = 0; k + 1 < run.length; k += 2) { acts.set(run[k], 'down'); acts.set(run[k + 1], 'up'); } run = []; };
    let key = '';
    for (const b of ground) {
      const k = formOf(b) === 'comet' ? `${level.segAt((b + 1e-6) * spb).index}:${gift.get(b) === 'intro' ? 1 : 0}` : '';
      if (k !== key) close();
      key = k;
      if (k) run.push(b);
    }
    close();
  }
  const baseTol = level.file.side?.tol ?? level.file.rules?.tol ?? TOL_S;
  // every note that is not a press is a flow note: the flow layer, plus presses inside a charge or crowded out by a smash
  const flowBeats = [...new Set([...layers.flow, ...layers.survival].map(snap))].filter((b) => inRange(b) && !groundSet.has(b)).sort((a, b) => a - b);
  const big = new Set(accents.map(snap));

  const firsts: Array<{ beat: number; what: Feature }> = [];
  const seen = new Set<Feature>();
  const first = (beat: number, what: Feature) => { if (!seen.has(what) && beat >= start && beat < end) { seen.add(what); firsts.push({ beat, what }); } };

  const presses: Press[] = [];
  let lv = 0;
  let side: 1 | -1 = 1;
  let planet = 0;
  let lastTwin: 'a' | 'b' = 'b';
  let gravBar = -1; // the bar in which a gravity orb has turned gravity over: it stays that way to the bar's end
  const nthInBar = new Map<number, number>();
  ground.forEach((beat, i) => {
    const prev = i > 0 ? beat - ground[i - 1] : 99;
    const next = i + 1 < ground.length ? ground[i + 1] - beat : 99;
    const isSmash = smash.has(beat);
    const after = afters.has(beat);
    const isWide = wide.has(beat);
    const top = Math.max(baseTol, isSmash || after || isWide ? TOL_SMASH_S : 0, easy.has(beat) ? 2 * baseTol : 0);
    const tol = clamp(0.45 * Math.min(prev, next) * spb, TOL_MIN_S, top) / spb;
    const seg = level.segAt((beat + 1e-6) * spb);
    const cfg = barAt(beat);
    const sling = slings.has(beat);
    const plain = isSmash || auto.has(beat); // the drop's own press is never anything else
    const form = formOf(beat);
    const act = acts.get(beat) ?? 'tap';
    const before = presses[i - 1];
    const orb = form === 'orb';
    // Orbs. The hop before ends exactly here, so this mark is taken in mid-air: there is no ring under it. Which orb
    // it is comes from the bar's combo (one letter per press of the bar), or from the bar's own word for all of them.
    const nth = nthInBar.get(barOf(beat)) ?? 0;
    nthInBar.set(barOf(beat), nth + 1);
    const ask = cfg.combo ? cfg.combo[nth] ?? '.' : '';
    const free = orb && !sling && !plain && !cfg.twin;
    const chained = free && !!before && before.form === 'orb' && !before.sling && !before.auto && Math.abs(before.land - beat) < 1e-6;
    // a slipstream carries the ball for a beat, two rings on (from the ring, or as a dash orb from mid-air)
    const slip = free && (ask === 'd' || (!cfg.combo && cfg.slip)) && next >= SLIP_FLIGHT - 1e-6;
    const grav = chained && !slip && (ask === 'g' || (!cfg.combo && cfg.grav));
    const kindOf: Press['orb'] = !chained ? '' : slip && ask === 'd' ? 'dash' : grav ? 'grav' : ask === 'j' || (!cfg.combo && cfg.chime && !slip) ? 'jump' : '';
    const chime = kindOf !== '';
    // a jump pad (the bar's first press, on its downbeat): a long high hop on the same planet, two beats in the air (the
    // Drifting Edge's flowers, Ossa's hammer); a throw: the same, a whole bar in the air (the Sleeper's hand)
    const padK = !plain && !sling && !cfg.twin && (cfg.pad || cfg.throw || cfg.vent) && nth === 0 && Math.abs(beat - barOf(beat) * 4) < 0.01;
    // a teleport vent (Emberwick's second idea, 2026-11-25): the same, but it throws him across the orbit in one beat
    const padTo = padK ? Math.min(i + 1 < ground.length ? ground[i + 1] : end, beat + (cfg.throw ? 4 : cfg.vent ? 1 : 2)) : 0;
    // (a snap, Verdance's: the Pulsar's flip made instant, a spider's jump from branch to branch)
    const quick = form === 'pulsar' && cfg.snap ? Math.min(0.12, next) : form === 'meteor' || form === 'pulsar' || (form === 'comet' && act === 'tap') ? Math.min(QUICK, next) : form === 'comet' ? Math.min(QUICK, next * 0.5) : 0;
    const land = padK ? padTo : sling ? beat + SLING_FLIGHT : quick ? beat + quick : slip ? beat + SLIP_FLIGHT : i + 1 < ground.length ? Math.min(ground[i + 1], beat + CAP) : Math.min(beat + 1, end);
    const dur = land - beat;
    // gravity: a weave flips on every press (so do the Satellite and the Comet, which travel between two rings);
    // a Pulsar flips on its own ring; otherwise flip only when the bar wants the other side of the ring
    const pair = form === 'sat' || (form === 'comet' && act !== 'tap');
    const weave = !plain && !sling && (pair || (orb && cfg.mode === 'weave'));
    const want = gravBar === barOf(beat) ? side : cfg.mode === 'up' ? 1 : cfg.mode === 'down' ? -1 : side;
    // (a tide pad is only there where the bar turns gravity over: otherwise the press is an ordinary one to tap)
    const given = gift.get(beat) === 'tide' && !(orb && want !== side) ? '' : gift.get(beat) ?? '';
    const still = form === 'meteor' || form === 'pulsar' || (form === 'comet' && act === 'tap'); // stays on its ring
    const flip = !plain && !sling && (weave || form === 'pulsar' || (orb && want !== side) || grav);
    if (grav) gravBar = barOf(beat);
    const step = still ? 0 : weave ? 1 : slip ? 2 : clamp(dur, 0.6, 1.4);
    const to = lv + side * step;
    // big hits: the chart's accents, and in a drop the first press of each half of the phrase
    const rel = beat - seg.beat0;
    const accent = !isSmash && (big.has(beat) || (seg.label === 'DROP' && (rel % 8) < 1 && !ground.some((g) => g < beat && g >= seg.beat0 + Math.floor(rel / 8) * 8)));
    let twin: Press['twin'] = null;
    if (cfg.twin) {
      // call and response: beats 1 and 3 of the bar on one ball, 2 and 4 on the other, off-beats with the press before; big hits on both
      const whole = Math.abs(beat - Math.round(beat)) < 0.01;
      twin = isSmash || accent || cfg.sync || (cfg.long && !!level.file.holds) ? 'both' : whole ? (Math.round(beat) % 2 === 0 ? 'a' : 'b') : lastTwin;
      if (twin !== 'both') lastTwin = twin;
      first(beat - 0.01, cfg.dual ? 'dual' : 'twin');
    }
    if (orb) { if (weave) first(beat, 'weave'); else if (flip && given !== 'tide') first(beat, 'flip'); }
    if (sling) first(beat, given === 'spring' ? 'spring' : 'sling');
    if (given === 'tide') first(beat, 'tide');
    if (kindOf === 'jump') first(beat, 'chime');
    if (kindOf === 'grav') first(beat, 'grav');
    if (slip) first(beat, 'slip');
    if (kindOf && before && before.orb) first(before.beat, 'combo');
    const spin = orb && cfg.spin && !plain && !sling && !chime && !slip;
    if (spin) first(beat, 'spin');
    presses.push({
      i, beat, tol, kind: flip ? 'flip' : 'hop', auto: auto.has(beat) || given === 'intro', smash: isSmash, accent, sling, after, weave, spin, twin,
      from: lv, to, side, planet, planetTo: sling ? planet + 1 : planet, camLv: weave ? lv + side * 0.5 : to,
      land, bounce: i + 1 < ground.length && ground[i + 1] === land,
      // (mini, Cirra's tight gusts: Orbin small, his hops half as high)
      bulge: (cfg.mini ? 0.45 : 1) * (padK ? (cfg.throw ? 1.0 : cfg.vent ? 0.55 : 0.75) : form === 'meteor' ? 0.28 : form === 'comet' && act === 'tap' ? 0.45 : flip || slip ? 0 : sling ? 0.5 : clamp(0.35 * dur - 0.1, 0.06, 0.7)), pitch: pitchAt(beat), seg: seg.index,
      form, act, line: form === 'sat' || slip, chime, slip, orb: kindOf, pad: padK ? (cfg.vent ? 'vent' : 'jump') : given === 'spring' || given === 'tide' ? given : '', intro: given === 'intro', wide: isWide || easy.has(beat)
    });
    lv = to;
    if (flip) side = side === 1 ? -1 : 1;
    if (sling) planet++;
  });

  // ---- holds (levels that have them): rails on long hops, gold lines over empty stretches of ring
  const holds: Hold[] = [];
  const flowStart = new Map<number, number>(); // beat of a line's first note -> hold index
  let free = flowBeats;
  if (level.file.holds || bars.some((b) => b.hold)) {
    const half = (b: number) => Math.round(b * 2) / 2;
    const okAt = (b: number) => b >= Math.max(HOLDS_FROM, start + COUNT_IN) - 1e-6 && !inCharge(b) && !barAt(b).twin && barAt(b).form !== 'comet' && !introBars.has(barOf(b));
    // rails also run in a twin orbit (both balls ride them), and a planet hop is a rail from the level's first bars on
    const railAt = (p: Press) => p.beat >= (p.sling ? start + COUNT_IN : Math.max(HOLDS_FROM, start + COUNT_IN)) - 1e-6 && !inCharge(p.beat) && (p.form === 'orb' || p.form === 'sat') && !p.slip;
    const mk = (a: number, b: number, rail: boolean, pos: (beat: number) => { rho: number; side: number; planet: number }, tether = false): void => {
      const eat = free.filter((f) => f > a + 1e-6 && f <= b + 1e-6);
      free = free.filter((f) => !(f > a + 1e-6 && f <= b + 1e-6));
      const grid: number[] = [];
      for (let t = a + 0.5; t <= b + 1e-6; t += 0.5) grid.push(snap(t));
      const ticks = [...new Set([...grid, ...eat])].sort((x, y) => x - y);
      const path: Hold['path'] = [];
      const n = Math.max(2, Math.round((b - a) * 8));
      for (let k = 0; k <= n; k++) { const beat = a + ((b - a) * k) / n; path.push({ beat, ...pos(beat) }); }
      holds.push({ i: 0, a, b, rail, ticks, path, twin: barAt(a).twin, tether });
      first(a, tether ? 'tether' : rail ? 'rail' : 'line');
    };
    presses.forEach((p, i) => {
      const next = presses[i + 1];
      // a held note (a bar marked `hold`): the bar's last press is kept down, and the ribbon runs on from its mark along
      // the ball's own path (its hop, then the ring it lands on) until there is just time to let go and tap again
      if (barAt(p.beat).hold && !p.auto && !p.smash && !p.sling && next && barOf(next.beat) !== barOf(p.beat) && !inCharge(p.beat)) {
        const b = Math.min(half(next.beat - LINE_CLEAR - 0.249), p.beat + 3.5);
        if (b - p.beat >= HOLD_MIN - 1e-6) {
          const after = p.kind === 'flip' ? -p.side : p.side;
          mk(p.beat, b, true, (beat) => (beat < p.land ? { rho: flightRho(p, beat), side: p.side, planet: p.planetTo } : { rho: p.to, side: after, planet: p.planetTo }));
          return;
        }
      }
      if (!level.file.holds) return;
      // a rail: the hop is long enough to hold through. It ends on the landing, or half a beat before it when the
      // next white mark is right there, so there is always time to let go and tap again.
      if (!p.auto && railAt(p) && p.land - p.beat >= RAIL_FLIGHT - 1e-6) {
        let b = next && next.beat - p.land < LINE_CLEAR - 1e-6 ? p.land - 0.5 : p.land;
        // a charge roll starting under the hop: let go half a beat before it, to be ready to tap
        const roll = charges.find(([c0]) => c0 > p.beat && c0 <= b + 1e-6);
        if (roll) b = roll[0] - 0.5;
        if (b - p.beat >= HOLD_MIN - 1e-6) {
          // (a gravity flip crosses to the other side of the ring line on the way, as the ball does)
          const u = (beat: number) => (beat - p.beat) / (p.land - p.beat);
          mk(p.beat, b, true, (beat) => ({ rho: flightRho(p, beat), side: p.kind === 'flip' ? p.side * (1 - 2 * (p.line ? clamp(u(beat), 0, 1) : smoothstep(u(beat)))) : p.side, planet: p.sling ? p.planet + smoothstep(u(beat)) : p.planetTo }), barAt(p.beat).tether && !p.sling && !p.auto && !p.smash);
        }
      }
      // a line: the ball has landed and nothing asks for a tap for a while
      if (!next) return;
      const sideNow = p.kind === 'flip' ? -p.side : p.side;
      const railed = holds.length && holds[holds.length - 1].a === p.beat ? holds[holds.length - 1].b : -Infinity;
      let a = half(Math.max(p.land, railed) + 0.5 + 0.249);
      const lim = next.beat - LINE_CLEAR;
      // start it on a note of the music if one is there
      const lead = free.find((f) => f >= Math.max(p.land + 0.25, railed + 0.5) - 1e-6 && f <= a + 1e-6);
      if (lead !== undefined) a = lead;
      let b = Math.min(half(lim - 0.249), a + HOLD_MAX);
      if (b - a < HOLD_MIN - 1e-6) b = Math.min(half(next.beat - LINE_TIGHT - 0.249), a + HOLD_MAX); // a two-beat ride still fits a one-beat line
      if (b - a < HOLD_MIN - 1e-6 || !okAt(a) || !okAt(b) || next.chime || next.form === 'comet') return;
      mk(a, b, false, (beat) => ({ rho: p.to + sideNow * LIFT * smoothstep((beat - a) / 0.35), side: sideNow, planet: p.planetTo }));
      flowStart.set(a, holds.length - 1);
      if (!free.includes(a)) free = [...free, a].sort((x, y) => x - y);
    });
    holds.sort((x, y) => x.a - y.a);
    holds.forEach((h, i) => { h.i = i; });
    for (const [beat] of flowStart) flowStart.set(beat, holds.findIndex((h) => !h.rail && h.a === beat));
  }

  // shard branches, from the level file: [from, to] in beats. Their notes have the level's own (tighter or wider) window.
  const branches: Array<[number, number]> = (level.file.shards ?? level.file.stars ?? []).map(([a, b]): [number, number] => [snap(a), snap(b)]).filter(([a, b]) => a >= start && b < end);
  const branchTol = level.file.rules?.branch ?? FLOW_TOL_S;
  // where the ball is when each flow note comes round: on a ring, or somewhere along a flight
  const all = [...ground, ...free].sort((a, b) => a - b);
  let k = -1;
  const flow: FlowNote[] = free.map((beat) => {
    while (k + 1 < presses.length && presses[k + 1].beat <= beat) k++;
    const p = presses[k];
    const air = !!p && beat < p.land - 1e-6;
    const rho = p ? (air ? flightRho(p, beat) : p.to) : presses[0] ? presses[0].from : 0;
    const sd = p ? (p.kind === 'flip' ? (air ? p.side : -p.side) : p.side) : 1;
    const j = all.indexOf(beat);
    const gap = Math.min(j > 0 ? beat - all[j - 1] : 9, j + 1 < all.length ? all[j + 1] - beat : 9) * spb;
    const nextP = presses[k + 1];
    const tw = barAt(beat).twin ? (barAt(beat).dual ? 'a' : nextP && nextP.twin ? nextP.twin : 'a') : null;
    // gold along a Comet's climb is collected by holding; in a form's introduction it is collected for the player
    const ride: FlowNote['ride'] = p && p.form === 'comet' && p.act === 'down' && nextP && beat < nextP.beat ? (p.auto ? 2 : 1) : introBars.has(barOf(beat)) && !inCharge(beat) ? 2 : 0;
    const branch = branches.findIndex(([a, b]) => beat >= a - 1e-6 && beat <= b + 1e-6);
    const pl = p ? (air && p.sling ? p.planet + smoothstep((beat - p.beat) / (p.land - p.beat)) : p.planetTo) : 0;
    return { beat, tol: Math.min(branch >= 0 ? branchTol : FLOW_TOL_S, 0.45 * gap) / spb, pitch: pitchAt(beat), charge: inCharge(beat), rho, side: sd, air, twin: tw, planet: pl, hold: flowStart.get(beat) ?? -1, ride, branch };
  });
  // ---- star trails, from the level file: [from, to] in beats
  const where = (beat: number): { rho: number; side: number; planet: number } => {
    let j = -1;
    while (j + 1 < presses.length && presses[j + 1].beat <= beat + 1e-6) j++;
    const p = presses[j];
    if (!p) return { rho: presses[0] ? presses[0].from : 0, side: 1, planet: 0 };
    const air = beat < p.land - 1e-6;
    return { rho: air ? flightRho(p, beat) : p.to, side: p.kind === 'flip' ? (air ? p.side : -p.side) : p.side, planet: air && p.sling ? p.planet + smoothstep((beat - p.beat) / (p.land - p.beat)) : p.planetTo };
  };
  const stars: Star[] = branches.map(([a, b], i) => {
    const gold = flow.filter((f) => f.beat >= a - 1e-6 && f.beat <= b + 1e-6).length + holds.filter((h) => h.a >= a - 1e-6 && h.b <= b + 1e-6).reduce((n, h) => n + h.ticks.length, 0);
    // the star sits on the ball's own path: on the last piece of gold, lifted if that is the end of a gold line
    const on = (beat: number) => {
      const h = holds.find((x) => !x.rail && beat > x.a + 0.3 && beat <= x.b + 1e-6);
      return h ? { ...where(beat), rho: h.path[h.path.length - 1].rho } : where(beat);
    };
    return { i, a, b, gold, from: on(a), at: on(b) };
  });
  // a perfect run, as the button sees it: down on every tap, up again at once, or at the end of the hold it starts
  // (a Comet's pair is one long press: down on its first mark, up on its second; gold collected by riding is not tapped)
  const endOf = new Map(holds.map((h) => [h.a, h.b]));
  const script: Array<[number, boolean]> = [];
  const ups = new Set<number>();
  presses.forEach((p, j) => { if (p.act === 'down' && presses[j + 1]) { endOf.set(p.beat, presses[j + 1].beat); ups.add(presses[j + 1].beat); } });
  const ridden = new Set(flow.filter((f) => f.ride !== 0).map((f) => f.beat));
  const tapped = all.filter((t) => !ups.has(t) && !ridden.has(t));
  tapped.forEach((t, j) => {
    script.push([t, true]);
    script.push([endOf.get(t) ?? Math.min(t + 0.15, j + 1 < tapped.length ? tapped[j + 1] - 0.03 : t + 0.15), false]);
  });

  // angle round the core, bar by bar: `turn` reverses the orbit at the bar line, the speed words change its rate
  let dir = level.file.side?.mirror ? -1 : 1;
  const quick = level.file.side?.speed ?? 1;
  const turns: number[] = [];
  const portals: Course['portals'] = [];
  const twins: Array<[number, number]> = [];
  const duals: Course['duals'] = [];
  const mirrors: number[] = [];
  const inverts: number[] = [];
  const rate = bars.map((b, n) => {
    const beat = n * 4;
    const before = n > 0 ? bars[n - 1].speed : 1;
    if (b.turn) { dir = -dir; if (beat > start && beat < end) { turns.push(beat); first(beat, 'reverse'); } }
    if (b.speed !== before && beat > start && beat < end) { portals.push({ beat, faster: b.speed > before, speed: b.speed }); first(beat, b.speed > before ? 'faster' : 'slower'); }
    if (b.mirror && beat > start && beat < end) { mirrors.push(beat); first(beat, 'mirror'); }
    if (b.invert && beat > start && beat < end) { inverts.push(beat); first(beat, 'invert'); }
    if (b.dual && beat + 4 > start && beat < end) {
      const last = duals[duals.length - 1];
      if (last && last[1] === beat && last[2] === b.echo) last[1] = beat + 4; else duals.push([beat, beat + 4, b.echo]);
    }
    if (b.twin && beat + 4 > start && beat < end) {
      const last = twins[twins.length - 1];
      if (last && last[1] === beat) last[1] = beat + 4; else twins.push([beat, beat + 4]);
    }
    return dir * (TWO_PI / LAP) * b.speed * quick;
  });
  for (const s of segs) { if (s.core?.charge) first(s.beat0, 'charge'); if (s.core?.smash) first(s.beat0, 'smash'); }
  for (const l of lenses) if (l.form !== 'orb') first(l.beat, l.form);
  const a0: number[] = [];
  let acc = 0;
  rate.forEach((r) => { a0.push(acc); acc += r * 4; });
  // Where the orbit turns round or changes speed, it does so on the bar line itself: the gate is in view for beats
  // beforehand, and then the change snaps. (TURN_EASE > 0 would spread it over that many beats either side.)
  const W = TURN_EASE;
  const blend = (n: number, x: number) => a0[n] + rate[n - 1] * x + ((rate[n] - rate[n - 1]) * (x + W) * (x + W)) / (4 * W); // x: beats from bar line n
  // a vent's throw: half a turn round the orbit added over its flight (eased, so the ball is flung and lands softly)
  const vents = presses.filter((p) => p.pad === 'vent').map((p) => [p.beat, p.land, rate[Math.min(rate.length - 1, Math.floor(p.beat / 4))] >= 0 ? 1 : -1] as const);
  const thrown = (beat: number): number => { let a = 0; for (const [v0, v1, d] of vents) if (beat > v0) a += d * Math.PI * smoothstep((beat - v0) / Math.max(0.1, v1 - v0)); return a; };
  const angle = (beat: number): number => (vents.length ? baseAngle(beat) + thrown(beat) : baseAngle(beat));
  const baseAngle = (beat: number): number => {
    if (beat <= 0) return beat * rate[0];
    const n = Math.min(bars.length - 1, Math.floor(beat / 4));
    const x = beat - n * 4;
    if (W > 0 && n > 0 && x < W && rate[n] !== rate[n - 1]) return blend(n, x);
    if (W > 0 && n + 1 < bars.length && x > 4 - W && rate[n + 1] !== rate[n]) return blend(n + 1, x - 4);
    return a0[n] + rate[n] * x;
  };

  return {
    spb, start, end, dropBeat: level.dropTime / spb, presses, flow, taps: tapped, rides: all.filter((t) => ups.has(t) || ridden.has(t)), holds, script, stars,
    checkpoints: segs.map((s) => s.beat0).filter((b) => b >= start && b < end),
    buffer: level.file.rules?.buffer ?? BUFFER_S, early: level.file.rules?.early ?? EARLY_ZONE,
    marks: [...presses.filter((p) => !p.auto && p.act !== 'up').map((p) => p.beat), ...flow.filter((f) => f.ride === 0).map((f) => f.beat)].sort((a, b) => a - b),
    charges, chargeNotes: flow.filter((f) => f.charge).length, inCharge, angle, turns, portals, twins, firsts, bars,
    lenses, mirrors, inverts, duals, formAt: (beat: number) => (barAt(beat).twin ? 'orb' : barAt(beat).form), at: where
  };
}
