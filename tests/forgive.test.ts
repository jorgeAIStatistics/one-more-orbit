// Forgiving taps (the owner's rules of 2026-11-25): a tap up to 150 ms early for an opening, orb, pad or Meteor wall
// is held and performed exactly on time, counted early, never a kill; in the first two levels a tap way too early is
// ignored. But mashing must still fail: tapping much faster than the chart asks gets no buffer and no forgiveness.
import { describe, expect, it } from 'vitest';
import { AMBUSH, FINAL, FIRST, PACKS, type LevelPack } from '../src/game/packs';
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

const W1: Array<[string, LevelPack]> = [['the Drifting Edge', FIRST], ['Emberwick', EMBER], ...(['skyhigh', 'blank', 'invincible'] as const).map((id, i): [string, LevelPack] => [['Cirra', 'Glassmere', 'Verdance'][i], PACKS.find((p) => p.level.id === id)!]), ['the ambush', AMBUSH], ['the guardian', FINAL]];
/** the owner's table: the buffer, and the stretch before it where a tap way too early still hits the ring (beats) */
const TABLE: Record<string, [number, number]> = { started: [0.15, 0], heroes: [0.15, 0], skyhigh: [0.13, 0.25], blank: [0.12, 0.35], invincible: [0.1, 0.45], ambush: [0.125, 0.3], royalty: [0.09, 0.45] };
for (const [name, pack] of W1) {
  describe(`forgiving taps: ${name}`, () => {
    const c = build(pack);
    const ms = (x: number) => x / 1000 / c.spb;
    const taps = c.presses.filter((p) => !p.auto && p.act !== 'up').map((p) => p.beat);
    const kinds = { orbs: c.presses.filter((p) => p.orb).length, pads: c.presses.filter((p) => p.pad || p.sling).length, walls: c.presses.filter((p) => p.form === 'meteor' && !p.auto).length };

    it('has its rules from the table: the buffer, and how far before it a tap way too early still hits the ring', () => {
      expect([c.buffer, c.early]).toEqual(TABLE[pack.level.id]);
    });
    it('the bot clears tapping every press on time, and 50, 100 and 150 ms early: every orb, pad and Meteor wall', () => {
      expect(tapRun(c, taps).crashed).toBe(false);
      // (150 ms where the buffer is 150 ms; elsewhere the buffer itself: the owner's table narrows it from Cirra on)
      for (const off of [50, Math.min(100, c.buffer * 1000), Math.min(150, c.buffer * 1000)]) {
        const s = tapRun(c, taps.map((b) => b - ms(off)));
        expect(s.crashed, `${off} ms early: ${s.crashKind} at beat ${s.crashBeat.toFixed(2)}`).toBe(false);
      }
      console.log(`FORGIVE ${name}: ${taps.length} presses (${kinds.orbs} orbs, ${kinds.pads} pads, ${kinds.walls} Meteor walls) clear on time and 50/100/${Math.min(150, c.buffer * 1000)} ms early`);
    });
    it('...and from every checkpoint, after the run-in', () => {
      for (const cp of [...new Set([...c.checkpoints, ...(pack.level.embers ?? [])])].filter((b) => b > c.start + 1)) for (const off of [50, Math.min(100, c.buffer * 1000), Math.min(150, c.buffer * 1000)]) {
        const s = tapRun(c, taps.filter((b) => b >= cp).map((b) => b - ms(off)), cp - 4, cp);
        expect(s.crashed, `from beat ${cp}, ${off} ms early: ${s.crashKind} at beat ${s.crashBeat.toFixed(2)}`).toBe(false);
      }
    });
    it('has its embers as the table says: every section in the first two worlds, one at the drop in Cirra and Glassmere, none after', () => {
      const e = pack.level.embers ?? [];
      if (pack.level.id === 'invincible' || pack.level.id === 'ambush' || pack.level.id === 'royalty') { expect(e).toEqual([]); return; }
      if (pack.level.id === 'skyhigh' || pack.level.id === 'blank') { expect(e).toEqual([c.dropBeat]); return; }
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
      const early = Math.min(150, c.buffer * 1000) - 1;
      sim.advance(p.beat - ms(early));
      sim.out.length = 0;
      sim.press(p.beat - ms(early));
      expect(sim.ni).toBe(p.i); // not gone yet: held
      sim.advance(p.beat + 0.02);
      expect(sim.ni).toBe(p.i + 1);
      const r = sim.out.find((x) => x.kind === p.kind)!;
      expect(r.err).toBeCloseTo(-early / 1000, 2);
      expect(r.flow).toBe(false);
      expect(sim.crashed).toBe(false);
    });
    it.skipIf(TABLE[pack.level.id][1] > 0)('a tap way too early (200 or 300 ms) is ignored: the opening still waits for its tap', () => {
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
      expect(longest, 'a spam bot lasts only a few seconds from any checkpoint (2026-11-26: Emberwick had a 16.3 s stretch)').toBeLessThanOrEqual(5);
    });
    it('a real player clears: every tap a little early or late, and two stray taps round each dense cluster (five players)', () => {
      for (const seed of [1, 2, 3, 4, 5]) {
        let x = seed * 9301 + 49297;
        const rnd = () => { x = (x * 9301 + 49297) % 233280; return x / 233280; };
        const gauss = () => (rnd() + rnd() + rnd() - 1.5) * 2; // about -3..3, mostly within 1
        const late = Math.min(c.presses[0] ? 90 : 90, 0.7 * (TABLE[pack.level.id][0] * 1000)), early = Math.min(140, c.buffer * 1000 * 0.9);
        const played = taps.map((b) => { const e = gauss() * 35; return b + ms(Math.max(-early, Math.min(late, e))); });
        const strays: number[] = [];
        for (let i = 0; i < taps.length; i++) {
          // a dense cluster: presses less than three quarters of a beat apart. A bounce just after its first tap, and a stray just after its last.
          if (!(i + 1 < taps.length && taps[i + 1] - taps[i] < 0.75) || (i > 0 && taps[i] - taps[i - 1] < 0.75)) continue;
          let j = i; while (j + 1 < taps.length && taps[j + 1] - taps[j] < 0.75) j++;
          strays.push(played[i] + ms(80), played[j] + ms(110));
        }
        const s = tapRun(c, [...played, ...strays].sort((p, q) => p - q));
        expect(s.crashed, `player ${seed}, ${strays.length} strays: ${s.crashKind} at beat ${s.crashBeat.toFixed(2)}`).toBe(false);
      }
    });
    it('two close presses are always two presses: every pair a beat apart or less, each tap early, on time or late', () => {
      const ps = c.presses.filter((q) => !q.auto && q.act !== 'up');
      const offs = (q: (typeof ps)[number]) => [-Math.min(c.buffer * 1000, 150) * 0.95, -60, 0, 60, q.tol * c.spb * 1000 * 0.9];
      const fails: string[] = [];
      let pairs = 0, combos = 0;
      for (let i = 0; i + 1 < ps.length; i++) {
        const A = ps[i], B = ps[i + 1];
        if (B.beat - A.beat > 1 + 1e-6 || A.beat < c.start + 2) continue;
        pairs++;
        const rest = ps.slice(i + 2).filter((q) => q.beat < B.beat + 3).map((q) => q.beat);
        // (and for the second, just past half way from the first: earlier than the buffer, but nearer its own wall)
        const half = -((B.beat - A.beat) / 2) * c.spb * 1000 + 15;
        for (const ea of offs(A)) for (const eb of [...offs(B), ...(half < -Math.min(c.buffer * 1000, 150) ? [half] : [])]) {
          if ((B.beat + ms(eb) - (A.beat + ms(ea))) * c.spb < 0.08) continue; // (no hand taps twice in under 80 ms)
          combos++;
          const s = tapRun(c, [A.beat + ms(ea), B.beat + ms(eb), ...rest].sort((x, y) => x - y), A.beat - 4, A.beat - 1e-3);
          const ok = !(s.crashed && s.crashBeat < B.beat + B.tol + 0.05);
          if (!ok) fails.push(`${A.beat}/${B.beat} at ${Math.round(ea)}/${Math.round(eb)} ms: ${(s.log ?? []).slice(-2).map((l) => l.what).join(' | ')}`);
        }
      }
      console.log(`PAIRS ${name}: ${pairs} close pairs, ${combos} combinations, ${fails.length} dropped`);
      expect(fails, fails.slice(0, 4).join('\n')).toEqual([]);
    });
    it('a sloppy player is not a masher: one stray tap every three seconds, between presses, still clears', () => {
      const strays: number[] = [];
      for (let t = c.start + 2; t < taps[taps.length - 1]; t += 3 / c.spb) {
        const i = taps.findIndex((b) => b > t); if (i < 1) continue;
        const mid = (taps[i - 1] + taps[i]) / 2; if (taps[i] - taps[i - 1] >= 0.75 && taps[i] - mid > c.buffer / c.spb + c.early + 0.15) strays.push(mid); // (clear of the table's stretch where a tap too early still hits the ring)
      }
      const s = tapRun(c, [...taps, ...strays].sort((x, y) => x - y));
      expect(s.crashed, `${strays.length} strays: ${s.crashKind} at beat ${s.crashBeat.toFixed(2)}`).toBe(false);
    });
    it('tapping along with the count-in is never punished', () => {
      const along = [1, 2, 3, 4].map((k) => c.start - 4 + k - 1).filter((b) => b < c.start);
      expect(tapRun(c, [...along, ...taps].sort((x, y) => x - y)).crashed).toBe(false);
    });
  });
}
