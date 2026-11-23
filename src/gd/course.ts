// The course: a level's press moments turned into rings to hop between.
// Every press is a note. A tap on the note hops the ball to the next ring through an opening, and the flight
// lasts until the next note, so you take off on one sound and land on the next.
import type { Level } from '../game/level';

export interface Press {
  i: number;
  beat: number;
  /** half-width of the opening, in beats: tap within this of the note and you clear it */
  tol: number;
  /** hop: through an opening onto the next ring. flip: onto the facing surface of the next ring (gravity turns over) */
  kind: 'hop' | 'flip';
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
/** A note that falls in mid-flight: an optional extra tap (flow, sparkle, the hook's pitch). Never needed to survive. */
export interface OrbNote { beat: number; tol: number; press: number; pitch: number | null }

export interface Course {
  spb: number;
  start: number;
  end: number;
  dropBeat: number;
  presses: Press[];
  orbs: OrbNote[];
  /** every tap of a perfect run, in beats (presses and orbs) */
  taps: number[];
  checkpoints: number[];
  /** angle of the ball round the core at a beat (speed portals change the rate) */
  angle(beat: number): number;
}

export const LAP = 8; // beats per trip round the core at normal speed
export const CAP = 2; // a flight never lasts longer than this many beats; then you ride until the next opening
export const TOL_S = 0.12; // openings are clearable within this much either side of the note...
export const TOL_MIN_S = 0.055; // ...narrowing only when notes come faster than eighths
export const NEAR = 0.6; // beats before an opening in which a tap is "going for it": too early and it hits the ring
export const ORB_GAP = 0.3; // a note this soon after a press (a sixteenth) becomes a mid-air orb
export const ORB_TOL_S = 0.07;
export const FLOW_S = 0.04; // taps this close to the note build flow
const TWO_PI = Math.PI * 2;
/** How a flight climbs to the next ring: fast at first, so it is through the opening early and then floats down. */
export const rise = (u: number) => 1 - Math.pow(1 - u, 2.4);
/** Radial position (ring levels) of a perfectly timed flight of press p at a beat. */
export const flightRho = (p: Press, beat: number): number => {
  const u = Math.max(0, Math.min(1, (beat - p.beat) / (p.land - p.beat)));
  return p.from + (p.to - p.from) * rise(u) + p.side * p.bulge * 4 * u * (1 - u);
};
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

export function buildCourse(level: Level, beats: number[], pitchAt: (beat: number) => number | null, range?: [number, number]): Course {
  const spb = level.spb;
  const start = range ? range[0] : 0;
  const end = range ? range[1] : level.endTime / spb;
  const notes = [...new Set(beats.map((b) => Math.round(b * 12) / 12))].filter((b) => b >= start && b < end - 0.5).sort((a, b) => a - b);

  // sixteenth-note followers become orbs; everything else is a press from a ring
  const ground: number[] = [];
  const orbAt: Array<{ beat: number; press: number }> = [];
  for (const b of notes) {
    const last = ground.length ? ground[ground.length - 1] : -99;
    if (b - last <= ORB_GAP + 1e-6) orbAt.push({ beat: b, press: ground.length - 1 });
    else ground.push(b);
  }

  const presses: Press[] = [];
  let lv = 0;
  let side: 1 | -1 = 1;
  const flipped = new Set<number>();
  ground.forEach((beat, i) => {
    const prev = i > 0 ? beat - ground[i - 1] : 99;
    const next = i + 1 < ground.length ? ground[i + 1] - beat : 99;
    const tol = clamp(0.45 * Math.min(prev, next) * spb, TOL_MIN_S, TOL_S) / spb;
    const seg = level.segAt((beat + 1e-6) * spb);
    const land = i + 1 < ground.length ? Math.min(ground[i + 1], beat + CAP) : Math.min(beat + 1, end);
    const flip = !!seg.core?.flip && !flipped.has(seg.index);
    if (flip) flipped.add(seg.index);
    const dur = land - beat;
    const to = lv + side * clamp(dur, 0.6, 1.4);
    presses.push({
      i, beat, tol, kind: flip ? 'flip' : 'hop', from: lv, to, side, land, bounce: i + 1 < ground.length && ground[i + 1] === land,
      bulge: flip ? 0 : clamp(0.35 * dur - 0.1, 0.06, 0.7), pitch: pitchAt(beat), seg: seg.index
    });
    lv = to;
    if (flip) side = side === 1 ? -1 : 1;
  });

  const orbs: OrbNote[] = orbAt.map((o) => {
    const p = presses[o.press];
    const gap = Math.min(o.beat - p.beat, p.land - o.beat) * spb;
    return { beat: o.beat, press: o.press, tol: Math.min(ORB_TOL_S, 0.45 * gap) / spb, pitch: pitchAt(o.beat) };
  });

  // angle round the core: each section turns at its own speed
  const segs = level.segments;
  const rate = segs.map((s) => (TWO_PI / LAP) * (s.core?.speed ?? 1));
  const a0: number[] = [];
  let acc = 0;
  segs.forEach((s, k) => { a0.push(acc); acc += rate[k] * (s.beat1 - s.beat0); });
  const angle = (beat: number): number => {
    if (beat <= 0) return beat * rate[0];
    let k = segs.length - 1;
    for (let j = 0; j < segs.length; j++) if (beat < segs[j].beat1) { k = j; break; }
    return a0[k] + rate[k] * (beat - segs[k].beat0);
  };

  return {
    spb, start, end, dropBeat: level.dropTime / spb, presses, orbs,
    taps: [...ground, ...orbAt.map((o) => o.beat)].sort((a, b) => a - b),
    checkpoints: segs.map((s) => s.beat0).filter((b) => b >= start && b < end),
    angle
  };
}
