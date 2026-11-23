// Geometry Dash-style track for a level: the ball moves by itself, taps make it hop.
// Take-offs come from the level's rhythm-first chart (one followed sound per section); hazards are derived from them.
import type { Level } from '../game/level';

export interface Hazard { kind: 'spike' | 'bar'; b0: number; b1: number }
export interface Orb { beat: number; h: number }
export interface Pad { beat: number; big: boolean }
export interface Track {
  spb: number;
  endBeat: number;
  dropBeat: number;
  hazards: Hazard[];
  orbs: Orb[];
  pads: Pad[];
  /** every tap a perfect run makes (ground jumps and orb taps), in beats */
  presses: number[];
  checkpoints: number[];
}

export const LAP = 8; // beats per lap: one ring per two-bar phrase
export const JUMP = 1; // a hop lasts exactly one beat, so it lands on the next beat
export const SPIKE_HALF = 0.15; // spikes are deadly for 0.3 beat (they are drawn wider)
export const SPIKE_H = 0.5; // ...to half the hop's height
export const BAR_H = 0.3; // overhead bars catch anything higher than this
export const ORB_WIN = 0.22; // beats either side of a jump orb in which a tap counts
export const PAD_ZONE = 0.25; // beats of track a jump pad covers
export const BUFFER_S = 0.15; // a tap this soon before landing jumps on landing
const CHAIN = 3; // back-to-back hops before a breath, unless the section says otherwise

/** Height (1 = top of a normal hop) at fraction u of an arc that started at height h0. */
export const arc = (h0: number, u: number) => h0 * (1 - u) + 4 * u * (1 - u);

export function buildTrack(level: Level): Track {
  const hazards: Hazard[] = [];
  const orbs: Orb[] = [];
  const pads: Pad[] = [];
  const presses: number[] = [];
  const chains: Array<{ start: number; land: number }> = [];
  let from = -99;
  let h0 = 0;
  let land = -99;
  let start = -1;
  let lastOrb = -1;
  let run = 0;
  const flush = () => {
    if (start < 0) return;
    // a lone hop clears one spike in the middle of its arc; an orb chain flies over a bed of them
    hazards.push({ kind: 'spike', b0: start + 0.5 - SPIKE_HALF, b1: lastOrb < 0 ? start + 0.5 + SPIKE_HALF : lastOrb + 0.6 });
    chains.push({ start, land });
  };
  for (const n of level.notes) {
    const b = n.beat;
    const seg = level.segments[n.seg];
    if (b < 4) continue; // the first bar is free: time to find the ball
    if (b >= land - 1e-6) {
      const linked = b - land < 0.05;
      // An unbroken row of hops can be mashed through, so every few hops the track takes a breath under a bar.
      if (linked && run >= (seg.chain ?? CHAIN)) continue;
      run = linked ? run + 1 : 1;
      flush();
      presses.push(b);
      from = b; h0 = 0; land = b + JUMP; start = b; lastOrb = -1;
    } else if (seg.orbs && b - from >= 0.45 && b - from <= 0.6) { // half a beat on: the ball is at the top of its arc
      const h = arc(h0, b - from);
      orbs.push({ beat: b, h });
      presses.push(b);
      h0 = h; from = b; land = b + JUMP; lastOrb = b;
    } // any other note falls inside a hop: you are already in the air for it
  }
  flush();

  // Flat stretches between hops. Launch pads go on strong beats; everything else gets an overhead bar,
  // so jumping when there is nothing to jump (or mashing) flies straight into it.
  const launches = level.segments.filter((s) => s.rocket && s.beat0 % LAP === 0).map((s) => s.beat0);
  const bar = (a: number, b: number) => { if (b - a >= 1 - 1e-6) hazards.push({ kind: 'bar', b0: a + 0.3, b1: b - 0.35 }); };
  let rest = 0.6;
  for (const c of [...chains, { start: Infinity, land: Infinity }]) {
    let a = rest;
    const end = Math.min(c.start, level.totalBeats - 7); // nothing after the last landing but the run home
    for (;;) {
      let p = launches.find((f) => f >= a - 1e-6 && f + 1 <= end + 1e-6) ?? -1;
      const big = p >= 0;
      if (!big && level.segAt((a + 0.01) * level.spb).pads && end - a >= 3) {
        // a pad on a downbeat if there is one, else on beat 3 of a bar
        for (const mod of [4, 2]) {
          for (let q = Math.ceil(a + 0.99); q + 1 <= end + 1e-6 && p < 0; q++) if (q % mod === 0) p = q;
          if (p >= 0) break;
        }
      }
      if (p < 0) break;
      bar(a, p);
      pads.push({ beat: p, big });
      if (!big) hazards.push({ kind: 'spike', b0: p + 0.5 - SPIKE_HALF, b1: p + 0.5 + SPIKE_HALF });
      a = p + 1;
    }
    if (end > a) bar(a, end);
    rest = c.land;
  }
  hazards.sort((x, y) => x.b0 - y.b0);
  return {
    spb: level.spb,
    endBeat: level.endTime / level.spb,
    dropBeat: level.dropTime / level.spb,
    hazards, orbs, pads, presses,
    checkpoints: level.segments.map((s) => s.beat0)
  };
}
