import { describe, expect, it } from 'vitest';
import { PACKS, type LevelPack } from '../src/game/packs';
import { Level } from '../src/game/level';
import { Engine, errorStats } from '../src/game/engine';
import { botTimes } from '../src/game/bot';

/** Plays a level with the bot's taps (optionally nudged), stepping the engine like 120 fps frames between them. */
function play(pack: LevelPack, opts: { jitter?: number; startAt?: number; hardcore?: boolean; taps?: boolean } = {}) {
  const level = new Level(pack.level, pack.audio, pack.chart);
  const engine = new Engine(level, { startAt: opts.startAt, hardcore: opts.hardcore });
  let s = 7;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 - 0.5; };
  const taps = opts.taps === false ? [] : botTimes(level, opts.startAt).map((t) => t + (opts.jitter ? rnd() * 2 * opts.jitter : 0));
  let t = (opts.startAt ?? 0) - 1;
  for (const tap of taps) {
    while (t + 1 / 120 < tap) { t += 1 / 120; engine.update(t); if (engine.failed) return { engine, level }; }
    engine.pressAt(tap);
  }
  while (t < level.endTime && !engine.failed) { t += 1 / 120; engine.update(t); }
  return { engine, level };
}

describe('autoplay bot', () => {
  for (const pack of PACKS) {
    it(`${pack.level.id}: 100% PERFECT with zero error`, () => {
      const { engine } = play(pack);
      const st = errorStats(engine.errs);
      const maxErr = engine.errs.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
      console.log(`BOT ${pack.level.id}: ${engine.judged}/${engine.total} gates, perfect ${engine.counts.perfect}, great ${engine.counts.great}, good ${engine.counts.good}, miss ${engine.counts.miss}, accuracy ${engine.accuracy.toFixed(2)}%, grade ${engine.grade}, max combo ${engine.maxCombo}, mean error ${(st.mean * 1000).toFixed(3)} ms, max |error| ${(maxErr * 1000).toFixed(3)} ms, score ${engine.score}, rating ${pack.chart.stars}`);
      expect(engine.done).toBe(true);
      expect(engine.counts.perfect).toBe(engine.total);
      expect(maxErr).toBeLessThan(1e-6);
      expect(engine.grade).toBe('SS');
      expect(engine.health).toBe(100);
    });
    it(`${pack.level.id}: a player within ±15 ms clears it without a miss`, () => {
      const { engine } = play(pack, { jitter: 0.015 });
      expect(engine.counts.miss).toBe(0);
      expect(engine.failed).toBe(false);
    });
    it(`${pack.level.id}: doing nothing fails, and Hardcore fails on the first miss`, () => {
      expect(play(pack, { taps: false }).engine.failed).toBe(true);
      const hc = play(pack, { taps: false, hardcore: true }).engine;
      expect(hc.failed).toBe(true);
      expect(hc.counts.miss).toBe(1);
    });
    it(`${pack.level.id}: practice from the drop only counts the gates after it`, () => {
      const level = new Level(pack.level, pack.audio, pack.chart);
      const { engine } = play(pack, { startAt: level.dropTime });
      expect(engine.total).toBe(level.notes.filter((n) => n.t >= level.dropTime - 1e-6).length);
      expect(engine.counts.perfect).toBe(engine.total);
    });
  }
});
