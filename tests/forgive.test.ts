// Forgiving taps (the owner's rules of 2026-11-25): a tap up to 150 ms early for an opening, orb, pad or Meteor wall
// is held and performed exactly on time, counted early, never a kill; in the first two levels a tap way too early is
// ignored. But mashing must still fail: tapping much faster than the chart asks gets no buffer and no forgiveness.
import { describe, expect, it } from 'vitest';
import { FIRST, PACKS, type LevelPack } from '../src/game/packs';
import { Level } from '../src/game/level';
import { buildCourse, type Course } from '../src/gd/course';
import { accentBeats, layers, pitchLookup } from '../src/gd/presses';
import { Sim } from '../src/gd/sim';

const EMBER = PACKS.find((p) => p.level.id === 'heroes')!;
const build = (p: LevelPack) => { const level = new Level(p.level, p.audio, p.chart); return buildCourse(level, layers(p), pitchLookup(p), p.level.lab, accentBeats(p)); };

/** Plays quick taps (each let go 0.1 beat later) from `start`, stepping like 60 fps frames; `from` hands over after a run-in. */
export function tapRun(c: Course, taps: number[], start = c.start - 3, from = -Infinity): Sim {
  const sim = new Sim(c, start, from);
  const moves = taps.flatMap((t): Array<[number, boolean]> => [[t, true], [t + 0.1, false]]).sort((a, b) => a[0] - b[0] || Number(a[1]) - Number(b[1]));
  let i = 0;
  while (i < moves.length && moves[i][0] < start) i++;
  for (let b = start; b < c.end + 1 && !sim.crashed; b += 1 / 60 / c.spb) {
    while (i < moves.length && moves[i][0] <= b) { const [t, down] = moves[i++]; if (down) sim.press(t); else sim.release(t); }
    sim.advance(b);
  }
  return sim;
}
/** A spam bot: taps at a steady rate (taps a second) from `a` to `b`, whatever the chart asks. */
const spam = (c: Course, rate: number, phase: number, a: number, b: number) => { const out: number[] = []; for (let t = a + phase / rate / c.spb; t < b; t += 1 / rate / c.spb) out.push(t); return out; };

for (const [name, pack] of [['the Drifting Edge', FIRST], ['Emberwick', EMBER]] as const) {
  describe(`forgiving taps: ${name}`, () => {
    const c = build(pack);
    const ms = (x: number) => x / 1000 / c.spb;
    const taps = c.presses.filter((p) => !p.auto && p.act !== 'up').map((p) => p.beat);
    const kinds = { orbs: c.presses.filter((p) => p.orb).length, pads: c.presses.filter((p) => p.pad || p.sling).length, walls: c.presses.filter((p) => p.form === 'meteor' && !p.auto).length };

    it('has the first-levels rules: a 150 ms buffer, and taps way too early ignored', () => {
      expect(c.buffer).toBe(0.15);
      expect(c.early).toBe(0);
    });
    it('the bot clears tapping every press on time, and 50, 100 and 150 ms early: every orb, pad and Meteor wall', () => {
      expect(tapRun(c, taps).crashed).toBe(false);
      for (const off of [50, 100, 150]) {
        const s = tapRun(c, taps.map((b) => b - ms(off)));
        expect(s.crashed, `${off} ms early: ${s.crashKind} at beat ${s.crashBeat.toFixed(2)}`).toBe(false);
      }
      console.log(`FORGIVE ${name}: ${taps.length} presses (${kinds.orbs} orbs, ${kinds.pads} pads, ${kinds.walls} Meteor walls) clear on time and 50/100/150 ms early`);
    });
    it('...and from every checkpoint, after the run-in', () => {
      for (const cp of [...new Set([...c.checkpoints, ...(pack.level.embers ?? [])])].filter((b) => b > c.start + 1)) for (const off of [50, 100, 150]) {
        const s = tapRun(c, taps.filter((b) => b >= cp).map((b) => b - ms(off)), cp - 4, cp);
        expect(s.crashed, `from beat ${cp}, ${off} ms early: ${s.crashKind} at beat ${s.crashBeat.toFixed(2)}`).toBe(false);
      }
    });
    it('has an ember every section, never more than 13 s apart, the first at the build', () => {
      const e = pack.level.embers ?? [];
      expect(e.length).toBe(5);
      const last = taps[taps.length - 1];
      const gaps = [e[0], ...e.slice(1).map((b, i) => b - e[i]), last - e[e.length - 1]].map((g) => g * c.spb);
      expect(Math.max(...gaps)).toBeLessThanOrEqual(13);
    });
    it('a held tap goes exactly on the beat and counts as early, not on the beat', () => {
      const p = c.presses.find((q, i) => !q.auto && q.act !== 'up' && q.beat > c.start + 4 && i > 0 && q.beat - c.presses[i - 1].beat >= 1)!;
      const sim = new Sim(c, c.start - 3);
      const before = taps.filter((b) => b < p.beat);
      let k = 0;
      for (let b = c.start - 3; b < p.beat - ms(150); b += 1 / 60 / c.spb) { while (k < before.length && before[k] <= b) { sim.press(before[k]); sim.release(before[k] + 0.1); k++; } sim.advance(b); }
      sim.advance(p.beat - ms(150));
      sim.out.length = 0;
      sim.press(p.beat - ms(150));
      expect(sim.ni).toBe(p.i); // not gone yet: held
      sim.advance(p.beat + 0.02);
      expect(sim.ni).toBe(p.i + 1);
      const r = sim.out.find((x) => x.kind === p.kind)!;
      expect(r.err).toBeCloseTo(-0.15, 2);
      expect(r.flow).toBe(false);
      expect(sim.crashed).toBe(false);
    });
    it('a tap way too early (200 or 300 ms) is ignored: the opening still waits for its tap', () => {
      const sample = taps.filter((_, i) => i % 3 === 1);
      for (const off of [200, 300]) for (const b of sample) {
        const s = tapRun(c, [...taps, b - ms(off)].sort((x, y) => x - y));
        expect(s.crashed, `an extra tap ${off} ms before beat ${b}: ${s.crashKind} at ${s.crashBeat.toFixed(2)}`).toBe(false);
      }
    });
    it('but doing nothing still fails, and so does every tap 300 ms late', () => {
      expect(tapRun(c, []).crashed).toBe(true);
      expect(tapRun(c, taps.map((b) => b + ms(300))).crashed).toBe(true);
    });
    it('mashing still fails: spam bots at 3 to 12 taps a second never clear, from the first tap or from any checkpoint', () => {
      const out: string[] = [];
      let longest = 0;
      for (const rate of [3, 4, 5, 6, 8, 10, 12]) for (const phase of [0, 0.25, 0.5, 0.75]) {
        const s = tapRun(c, spam(c, rate, phase, c.start, c.end));
        expect(s.crashed, `spam ${rate}/s phase ${phase}`).toBe(true);
        if (phase === 0) out.push(`${rate}/s fell at ${((s.crashBeat - c.start) * c.spb).toFixed(1)} s`);
        for (const cp of c.checkpoints.filter((b) => b > c.start + 1 && taps.filter((x) => x >= b).length >= 4)) {
          const f = tapRun(c, spam(c, rate, phase, cp, c.end), cp - 4, cp);
          expect(f.crashed, `spam ${rate}/s phase ${phase} from beat ${cp}`).toBe(true);
          longest = Math.max(longest, (f.crashBeat - cp) * c.spb);
        }
      }
      console.log(`SPAMBOT ${name}: from the first tap ${out.join('; ')}; from a checkpoint, the longest any spam bot lasted: ${longest.toFixed(1)} s`);
    });
    it('tapping along with the count-in is never punished', () => {
      const along = [1, 2, 3, 4].map((k) => c.start - 4 + k - 1).filter((b) => b < c.start);
      expect(tapRun(c, [...along, ...taps].sort((x, y) => x - y)).crashed).toBe(false);
    });
  });
}
