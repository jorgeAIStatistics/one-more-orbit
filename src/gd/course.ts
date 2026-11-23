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
  /** planet hop: this press slings the ball across to the next planet */
  sling: boolean;
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
}
/** An optional note: on a ring or in mid-flight, wherever the ball is at that moment. */
export interface FlowNote { beat: number; tol: number; pitch: number | null; charge: boolean; rho: number; side: number; air: boolean; twin: 'a' | 'b' | 'both' | null; planet: number }
export interface Layers { survival: number[]; flow: number[] }
/** Things a level can ask of the player; the first time each appears it gets a hint. */
export type Feature = 'smash' | 'charge' | 'flip' | 'weave' | 'spin' | 'sling' | 'reverse' | 'faster' | 'slower' | 'twin';
/** How one bar plays. */
export interface BarCfg { token: string; mode: 'up' | 'down' | 'weave'; spin: boolean; twin: boolean; sling: boolean; turn: boolean; speed: number }

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
  /** angle of the ball round the core at a beat (speed portals change the rate, turns its sign) */
  angle(beat: number): number;
  /** beats at which the orbit turns round */
  turns: number[];
  /** beats at which the orbit changes speed, and whether it gets faster */
  portals: Array<{ beat: number; faster: boolean }>;
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
export const NEAR = 0.6; // beats before an opening in which a tap is "going for it": too early and it hits the ring
export const FLOW_TOL_S = 0.07; // how close a tap must be to a flow note to touch it
export const FLOW_S = 0.04; // taps this close to a note build flow
export const MIN_GAP = 1; // beats between generated survival presses: quarter notes at most
const TWO_PI = Math.PI * 2;
/** How a flight climbs to the next ring: fast at first, so it is through the opening early and then floats down. */
export const rise = (u: number) => 1 - Math.pow(1 - u, 2.4);
export const smoothstep = (t: number) => { const x = t < 0 ? 0 : t > 1 ? 1 : t; return x * x * (3 - 2 * x); };
/** Radial position (ring levels) of a perfectly timed flight of press p at a beat. */
export const flightRho = (p: Press, beat: number): number => {
  const u = Math.max(0, Math.min(1, (beat - p.beat) / (p.land - p.beat)));
  return p.from + (p.to - p.from) * rise(u) + p.side * p.bulge * 4 * u * (1 - u);
};
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
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
 * normal set the orbit speed from that bar on.
 */
export function barPlan(level: Level): BarCfg[] {
  const out: BarCfg[] = [];
  let speed = 1;
  for (const s of level.segments) {
    const tokens = s.core?.bars?.length ? s.core.bars : ['up'];
    for (let k = 0; k < s.bars; k++) {
      const token = tokens[k % tokens.length];
      const w = token.split('+');
      if (w.includes('fast')) speed = 1.25; else if (w.includes('slow')) speed = 0.8; else if (w.includes('normal')) speed = 1;
      const twin = w.includes('twin');
      out.push({ token, mode: w.includes('weave') ? 'weave' : w.includes('down') ? 'down' : 'up', spin: w.includes('spin'), twin, sling: w.includes('sling') && !twin, turn: w.includes('turn'), speed });
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
  let ground = [...new Set([...layers.survival.map(snap).filter((b) => inRange(b) && !inCharge(b)), ...auto, ...smash])].sort((a, b) => a - b);
  // nothing else within a beat of a smash or a launch: those own their moment
  ground = ground.filter((b) => auto.has(b) || smash.has(b) || ![...auto, ...smash].some((x) => Math.abs(x - b) < MIN_GAP - 1e-6));
  const groundSet = new Set(ground);
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
  const slung = new Set<number>();
  let lastTwin: 'a' | 'b' = 'b';
  ground.forEach((beat, i) => {
    const prev = i > 0 ? beat - ground[i - 1] : 99;
    const next = i + 1 < ground.length ? ground[i + 1] - beat : 99;
    const isSmash = smash.has(beat);
    const tol = clamp(0.45 * Math.min(prev, next) * spb, TOL_MIN_S, isSmash ? TOL_SMASH_S : TOL_S) / spb;
    const seg = level.segAt((beat + 1e-6) * spb);
    const bar = Math.floor((beat + 1e-6) / 4);
    const cfg = barAt(beat);
    const land = i + 1 < ground.length ? Math.min(ground[i + 1], beat + CAP) : Math.min(beat + 1, end);
    const dur = land - beat;
    const plain = isSmash || auto.has(beat); // the drop's own press is never anything else
    // planet hop: the first press of a bar marked sling
    const sling = !plain && cfg.sling && !slung.has(bar);
    if (sling) slung.add(bar);
    // gravity: a weave flips on every press; otherwise flip only when the bar wants the other side of the ring
    const weave = !plain && !sling && cfg.mode === 'weave';
    const want = cfg.mode === 'up' ? 1 : cfg.mode === 'down' ? -1 : side;
    const flip = !plain && !sling && (weave || want !== side);
    const step = weave ? 1 : clamp(dur, 0.6, 1.4);
    const to = lv + side * step;
    // big hits: the chart's accents, and in a drop the first press of each half of the phrase
    const rel = beat - seg.beat0;
    const accent = !isSmash && (big.has(beat) || (seg.label === 'DROP' && (rel % 8) < 1 && !ground.some((g) => g < beat && g >= seg.beat0 + Math.floor(rel / 8) * 8)));
    let twin: Press['twin'] = null;
    if (cfg.twin) {
      // call and response: beats 1 and 3 of the bar on one ball, 2 and 4 on the other, off-beats with the press before; big hits on both
      const whole = Math.abs(beat - Math.round(beat)) < 0.01;
      twin = isSmash || accent ? 'both' : whole ? (Math.round(beat) % 2 === 0 ? 'a' : 'b') : lastTwin;
      if (twin !== 'both') lastTwin = twin;
      first(beat - 0.01, 'twin');
    }
    if (weave) first(beat, 'weave'); else if (flip) first(beat, 'flip');
    if (sling) first(beat, 'sling');
    if (cfg.spin && !plain) first(beat, 'spin');
    presses.push({
      i, beat, tol, kind: flip ? 'flip' : 'hop', auto: auto.has(beat), smash: isSmash, accent, sling, weave, spin: cfg.spin && !plain && !sling, twin,
      from: lv, to, side, planet, planetTo: sling ? planet + 1 : planet, camLv: weave ? lv + side * 0.5 : to,
      land, bounce: i + 1 < ground.length && ground[i + 1] === land,
      bulge: flip ? 0 : sling ? 0.5 : clamp(0.35 * dur - 0.1, 0.06, 0.7), pitch: pitchAt(beat), seg: seg.index
    });
    lv = to;
    if (flip) side = side === 1 ? -1 : 1;
    if (sling) planet++;
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
    const tw = barAt(beat).twin ? (nextP && nextP.twin ? nextP.twin : 'a') : null;
    const pl = p ? (air && p.sling ? p.planet + smoothstep((beat - p.beat) / (p.land - p.beat)) : p.planetTo) : 0;
    return { beat, tol: Math.min(FLOW_TOL_S, 0.45 * gap) / spb, pitch: pitchAt(beat), charge: inCharge(beat), rho, side: sd, air, twin: tw, planet: pl };
  });

  // angle round the core, bar by bar: `turn` reverses the orbit at the bar line, the speed words change its rate
  let dir = 1;
  const turns: number[] = [];
  const portals: Array<{ beat: number; faster: boolean }> = [];
  const twins: Array<[number, number]> = [];
  const rate = bars.map((b, n) => {
    const beat = n * 4;
    const before = n > 0 ? bars[n - 1].speed : 1;
    if (b.turn) { dir = -dir; if (beat > start && beat < end) { turns.push(beat); first(beat, 'reverse'); } }
    if (b.speed !== before && beat > start && beat < end) { portals.push({ beat, faster: b.speed > before }); first(beat, b.speed > before ? 'faster' : 'slower'); }
    if (b.twin && beat + 4 > start && beat < end) {
      const last = twins[twins.length - 1];
      if (last && last[1] === beat) last[1] = beat + 4; else twins.push([beat, beat + 4]);
    }
    return dir * (TWO_PI / LAP) * b.speed;
  });
  for (const s of segs) { if (s.core?.charge) first(s.beat0, 'charge'); if (s.core?.smash) first(s.beat0, 'smash'); }
  const a0: number[] = [];
  let acc = 0;
  rate.forEach((r) => { a0.push(acc); acc += r * 4; });
  const angle = (beat: number): number => {
    if (beat <= 0) return beat * rate[0];
    const n = Math.min(bars.length - 1, Math.floor(beat / 4));
    return a0[n] + rate[n] * (beat - n * 4);
  };

  return {
    spb, start, end, dropBeat: level.dropTime / spb, presses, flow, taps: all,
    checkpoints: segs.map((s) => s.beat0).filter((b) => b >= start && b < end),
    charges, chargeNotes: flow.filter((f) => f.charge).length, inCharge, angle, turns, portals, twins, firsts, bars
  };
}
