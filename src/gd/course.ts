// The course: a level's notes turned into rings to hop between.
// Two layers of notes. SURVIVAL presses are the strong beats: a tap on one hops the ball to the next ring through
// an opening, and the flight lasts until the next press. FLOW notes are every faster note in the music: optional
// taps that build flow (and, in a charge section, the drop) and can never end the run.
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
  /** slingshot: this press flings the ball several rings out, to a new planet */
  sling: boolean;
  /** twin orbit: which ball's ring carries the mark (both balls hop on every tap); null outside twin sections */
  twin: 'a' | 'b' | 'both' | null;
  /** ring level it leaves and the one it lands on */
  from: number;
  to: number;
  /** side ridden before the press: 1 = outside of the ring (hops go outward), -1 = inside (hops go inward) */
  side: 1 | -1;
  /** beat it lands on: the next press, or two beats on if the next press is further away */
  land: number;
  bounce: boolean;
  /** how far the flight floats above the ring it lands on, in ring levels */
  bulge: number;
  pitch: number | null;
  seg: number;
}
/** An optional note: on a ring or in mid-flight, wherever the ball is at that moment. */
export interface FlowNote { beat: number; tol: number; pitch: number | null; charge: boolean; rho: number; side: number; air: boolean; twin: 'a' | 'b' | 'both' | null }
export interface Layers { survival: number[]; flow: number[] }
/** What the level file says about each section, for the hints: [beat, feature] the first time each feature appears. */
export type Feature = 'smash' | 'charge' | 'flip' | 'sling' | 'reverse' | 'faster' | 'slower' | 'twin';

export interface Course {
  spb: number;
  start: number;
  end: number;
  dropBeat: number;
  presses: Press[];
  flow: FlowNote[];
  /** every tap of a perfect run, in beats (presses and flow notes) */
  taps: number[];
  checkpoints: number[];
  /** stretches where nothing can end the run and on-beat taps charge the drop: [from, to] in beats */
  charges: Array<[number, number]>;
  chargeNotes: number;
  inCharge(beat: number): boolean;
  /** angle of the ball round the core at a beat (speed portals change the rate, reversals its sign) */
  angle(beat: number): number;
  /** beats at which the orbit turns round */
  turns: number[];
  /** beats at which the orbit changes speed, and whether it gets faster */
  portals: Array<{ beat: number; faster: boolean }>;
  /** stretches played as a twin orbit */
  twins: Array<[number, number]>;
  /** the first time each mechanic appears: where the hint goes */
  firsts: Array<{ beat: number; what: Feature }>;
}

export const LAP = 8; // beats per trip round the core at normal speed
export const CAP = 2; // a flight never lasts longer than this many beats; then you ride until the next opening
export const TOL_S = 0.12; // openings are clearable within this much either side of the note...
export const TOL_SMASH_S = 0.16; // the drop's smash is wider still
export const TOL_MIN_S = 0.055; // ...narrowing only if someone records presses faster than eighths
export const NEAR = 0.6; // beats before an opening in which a tap is "going for it": too early and it hits the ring
export const FLOW_TOL_S = 0.07; // how close a tap must be to a flow note to touch it
export const FLOW_S = 0.04; // taps this close to a note build flow
export const MIN_GAP = 1; // beats between generated survival presses: quarter notes at most
const TWO_PI = Math.PI * 2;
/** How a flight climbs to the next ring: fast at first, so it is through the opening early and then floats down. */
export const rise = (u: number) => 1 - Math.pow(1 - u, 2.4);
/** Radial position (ring levels) of a perfectly timed flight of press p at a beat. */
export const flightRho = (p: Press, beat: number): number => {
  const u = Math.max(0, Math.min(1, (beat - p.beat) / (p.land - p.beat)));
  return p.from + (p.to - p.from) * rise(u) + p.side * p.bulge * 4 * u * (1 - u);
};
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const snap = (b: number) => Math.round(b * 12) / 12;

/**
 * Splits generated notes into the two layers. Survival presses are the strong beats, never closer than a beat:
 * notes on the beat first, then half-beats, then the rest, each only if no chosen press is within a beat of it.
 * Everything else is a flow note. Hand-recorded bars skip this: Record Mode sets each note's layer itself.
 * (Swung songs put their off-beats at a third or two thirds of the beat; those rank with the other off-beats.)
 */
export function autoLayers(beats: number[], accents: number[] = []): Layers {
  const notes = [...new Set(beats.map(snap))].sort((a, b) => a - b);
  const big = new Set(accents.map(snap));
  const frac = (b: number) => Math.abs(b - Math.round(b));
  // the chart's accents come first of all: the biggest hits are always presses
  const rank = (b: number) => (big.has(b) ? -1 : frac(b) < 0.01 ? 0 : Math.abs(frac(b) - 0.5) < 0.01 ? 1 : 2);
  const chosen: number[] = [];
  for (const r of [-1, 0, 1, 2]) for (const b of notes) if (rank(b) === r && chosen.every((c) => Math.abs(c - b) >= MIN_GAP - 1e-6)) chosen.push(b);
  const set = new Set(chosen);
  return { survival: notes.filter((b) => set.has(b)), flow: notes.filter((b) => !set.has(b)) };
}

export function buildCourse(level: Level, layers: Layers, pitchAt: (beat: number) => number | null, range?: [number, number], accents: number[] = []): Course {
  const spb = level.spb;
  const start = range ? range[0] : 0;
  const end = range ? range[1] : level.endTime / spb;
  const segs = level.segments;
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
  let ground = [...new Set([...layers.survival.map(snap).filter((b) => inRange(b) && !inCharge(b)), ...auto, ...smash])].sort((a, b) => a - b);
  // nothing else within a beat of a smash or a launch: those own their moment
  ground = ground.filter((b) => auto.has(b) || smash.has(b) || ![...auto, ...smash].some((x) => Math.abs(x - b) < MIN_GAP - 1e-6));
  const big = new Set(accents.map(snap));
  const twins: Array<[number, number]> = segs.filter((s) => s.core?.twin && s.beat1 > start && s.beat0 < end).map((s) => [s.beat0, s.beat1]);
  const groundSet = new Set(ground);
  // every note that is not a press is a flow note: the flow layer, plus presses inside a charge or crowded out by a smash
  const flowBeats = [...new Set([...layers.flow, ...layers.survival].map(snap))].filter((b) => inRange(b) && !groundSet.has(b)).sort((a, b) => a - b);

  const presses: Press[] = [];
  let lv = 0;
  let side: 1 | -1 = 1;
  const flipped = new Set<number>();
  const slung = new Set<number>();
  let lastTwin: 'a' | 'b' = 'b';
  ground.forEach((beat, i) => {
    const prev = i > 0 ? beat - ground[i - 1] : 99;
    const next = i + 1 < ground.length ? ground[i + 1] - beat : 99;
    const isSmash = smash.has(beat);
    const tol = clamp(0.45 * Math.min(prev, next) * spb, TOL_MIN_S, isSmash ? TOL_SMASH_S : TOL_S) / spb;
    const seg = level.segAt((beat + 1e-6) * spb);
    const land = i + 1 < ground.length ? Math.min(ground[i + 1], beat + CAP) : Math.min(beat + 1, end);
    const flip = !!seg.core?.flip && !flipped.has(seg.index);
    if (flip) flipped.add(seg.index);
    const dur = land - beat;
    const sling = !flip && !!seg.core?.sling && !slung.has(seg.index);
    if (sling) slung.add(seg.index);
    const to = lv + side * (clamp(dur, 0.6, 1.4) + (sling ? 3 : 0));
    // big hits: the chart's accents, and in a drop the first press of each half of the phrase
    const rel = beat - seg.beat0;
    const accent = !isSmash && (big.has(beat) || (seg.label === 'DROP' && (rel % 8) < 1 && !ground.some((g) => g < beat && g >= seg.beat0 + Math.floor(rel / 8) * 8)));
    let twin: Press['twin'] = null;
    if (seg.core?.twin) {
      // call and response: beats 1 and 3 of the bar on one ball, 2 and 4 on the other, off-beats with the press before; big hits on both
      const whole = Math.abs(beat - Math.round(beat)) < 0.01;
      twin = isSmash || accent ? 'both' : whole ? (Math.round(beat) % 2 === 0 ? 'a' : 'b') : lastTwin;
      if (twin !== 'both') lastTwin = twin;
    }
    presses.push({
      i, beat, tol, kind: flip ? 'flip' : 'hop', auto: auto.has(beat), smash: isSmash, accent, sling, twin, from: lv, to, side, land, bounce: i + 1 < ground.length && ground[i + 1] === land,
      bulge: flip ? 0 : sling ? 0.9 : clamp(0.35 * dur - 0.1, 0.06, 0.7), pitch: pitchAt(beat), seg: seg.index
    });
    lv = to;
    if (flip) side = side === 1 ? -1 : 1;
  });

  // where the ball is when each flow note comes round: on a ring, or somewhere along a flight
  const all = [...ground, ...flowBeats].sort((a, b) => a - b);
  let k = -1;
  const flow: FlowNote[] = flowBeats.map((beat) => {
    while (k + 1 < presses.length && presses[k + 1].beat <= beat) k++;
    const p = presses[k];
    const air = !!p && beat < p.land - 1e-6;
    const rho = p ? (air ? flightRho(p, beat) : p.to) : presses[0] ? presses[0].from : 0;
    const sd = p ? (p.kind === 'flip' ? (air ? p.side : -p.side) : p.side) : 1;
    const j = all.indexOf(beat);
    const gap = Math.min(j > 0 ? beat - all[j - 1] : 9, j + 1 < all.length ? all[j + 1] - beat : 9) * spb;
    const nextP = presses[k + 1];
    const tw = twins.some(([a, z]) => beat >= a && beat < z) ? (nextP && nextP.twin ? nextP.twin : 'a') : null;
    return { beat, tol: Math.min(FLOW_TOL_S, 0.45 * gap) / spb, pitch: pitchAt(beat), charge: inCharge(beat), rho, side: sd, air, twin: tw };
  });

  // angle round the core: each section turns at its own speed, and a `reverse` section turns the orbit round
  let dir = 1;
  const turns: number[] = [];
  const portals: Array<{ beat: number; faster: boolean }> = [];
  const firsts: Array<{ beat: number; what: Feature }> = [];
  const seen = new Set<Feature>();
  const first = (beat: number, what: Feature) => { if (!seen.has(what) && beat >= start && beat < end) { seen.add(what); firsts.push({ beat, what }); } };
  const rate = segs.map((s, n) => {
    const sp = s.core?.speed ?? 1;
    const before = n > 0 ? segs[n - 1].core?.speed ?? 1 : 1;
    if (s.core?.reverse) { dir = -dir; if (s.beat0 > start && s.beat0 < end) turns.push(s.beat0); first(s.beat0, 'reverse'); }
    if (sp !== before && s.beat0 > start && s.beat0 < end) { portals.push({ beat: s.beat0, faster: sp > before }); first(s.beat0, sp > before ? 'faster' : 'slower'); }
    if (s.core?.charge) first(s.beat0, 'charge');
    if (s.core?.smash) first(s.beat0, 'smash');
    if (s.core?.flip) first(s.beat0, 'flip');
    if (s.core?.sling) first(s.beat0, 'sling');
    if (s.core?.twin) first(s.beat0, 'twin');
    return dir * (TWO_PI / LAP) * sp;
  });
  const a0: number[] = [];
  let acc = 0;
  segs.forEach((s, n) => { a0.push(acc); acc += rate[n] * (s.beat1 - s.beat0); });
  const angle = (beat: number): number => {
    if (beat <= 0) return beat * rate[0];
    let n = segs.length - 1;
    for (let j = 0; j < segs.length; j++) if (beat < segs[j].beat1) { n = j; break; }
    return a0[n] + rate[n] * (beat - segs[n].beat0);
  };

  return {
    spb, start, end, dropBeat: level.dropTime / spb, presses, flow, taps: all,
    checkpoints: segs.map((s) => s.beat0).filter((b) => b >= start && b < end),
    charges, chargeNotes: flow.filter((f) => f.charge).length, inCharge, angle, turns, portals, twins, firsts
  };
}
