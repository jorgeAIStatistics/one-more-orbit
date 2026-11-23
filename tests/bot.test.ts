import { describe, expect, it } from 'vitest';
import { PACKS } from '../src/game/packs';
import { Level, buildNotes } from '../src/game/level';
import { Engine, errorStats } from '../src/game/engine';
import { botEvents } from '../src/game/bot';
import { DIFFICULTIES } from '../src/game/rules';
import type { Difficulty } from '../src/game/types';

/** Plays a chart with the given inputs, stepping the engine like 120 fps frames between them. */
function play(packIndex: number, d: Difficulty, jitter = 0, seed = 1) {
  const pack = PACKS[packIndex];
  const level = new Level(pack.level, pack.audio, pack.charts[d].laps);
  const notes = buildNotes(level, pack.charts[d]);
  const engine = new Engine(level, notes, d);
  let s = seed;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 - 0.5; };
  const events = botEvents(level, notes).map((e) => ({ ...e, t: e.t + (jitter ? rnd() * 2 * jitter : 0) })).sort((a, b) => a.t - b.t || Number(a.down) - Number(b.down));
  let t = -1;
  for (const e of events) {
    while (t + 1 / 120 < e.t) { t += 1 / 120; engine.update(t); }
    if (e.down) engine.pressAt(e.side, e.t); else engine.releaseAt(e.side, e.t);
  }
  while (t < level.endTime) { t += 1 / 120; engine.update(t); }
  return { engine, notes, level };
}

describe('autoplay bot', () => {
  PACKS.forEach((pack, pi) => {
    for (const d of DIFFICULTIES) {
      it(`${pack.level.id} ${d}: 100% PERFECT with zero error`, () => {
        const { engine, notes } = play(pi, d);
        const st = errorStats(engine.errs);
        const maxErr = engine.errs.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
        console.log(`BOT ${pack.level.id} ${d}: ${notes.length} notes, ${engine.judged}/${engine.total} judgements, perfect ${engine.counts.perfect}, great ${engine.counts.great}, good ${engine.counts.good}, miss ${engine.counts.miss}, accuracy ${engine.accuracy.toFixed(2)}%, grade ${engine.grade}, max combo ${engine.maxCombo}, mean error ${(st.mean * 1000).toFixed(3)} ms, max |error| ${(maxErr * 1000).toFixed(3)} ms, score ${engine.score}, stars ${pack.charts[d].stars}`);
        expect(engine.done).toBe(true);
        expect(engine.counts.perfect).toBe(engine.total);
        expect(engine.counts.miss + engine.counts.good + engine.counts.great).toBe(0);
        expect(maxErr).toBeLessThan(1e-6);
        expect(engine.grade).toBe('SS');
        expect(engine.health).toBe(100);
        expect(engine.failed).toBe(false);
      });
      it(`${pack.level.id} ${d}: a player within ±20 ms clears it without a miss`, () => {
        const { engine } = play(pi, d, 0.02, 7);
        expect(engine.counts.miss).toBe(0);
        expect(engine.failed).toBe(false);
      });
    }
    it(`${pack.level.id}: doing nothing fails, and Hardcore fails on the first miss`, () => {
      const level = new Level(pack.level, pack.audio);
      const idle = new Engine(level, buildNotes(level, pack.charts.normal), 'normal');
      for (let t = 0; t < level.endTime; t += 1 / 60) idle.update(t);
      expect(idle.failed).toBe(true);
      const hc = new Engine(level, buildNotes(level, pack.charts.normal), 'normal', { hardcore: true });
      for (let t = 0; t < level.endTime && !hc.failed; t += 1 / 60) hc.update(t);
      expect(hc.counts.miss).toBe(1);
    });
  });
});
