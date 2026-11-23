import { describe, expect, it } from 'vitest';
import { PACKS, type LevelPack } from '../src/game/packs';
import { Level } from '../src/game/level';
import { Engine, errorStats } from '../src/game/engine';
import { botTimes } from '../src/game/bot';

/** Plays a level with the bot's taps (optionally nudged), stepping the engine like 120 fps frames between them. */
function play(pack: LevelPack, opts: { jitter?: number; startAt?: number; hardcore?: boolean; taps?: boolean; spam?: number } = {}) {
  const level = new Level(pack.level, pack.audio, pack.chart);
  const engine = new Engine(level, { startAt: opts.startAt, hardcore: opts.hardcore });
  let s = 7;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 - 0.5; };
  let taps = opts.taps === false ? [] : botTimes(level, opts.startAt).map((t) => t + (opts.jitter ? rnd() * 2 * opts.jitter : 0));
  if (opts.spam) { taps = []; for (let x = 0.013; x < level.endTime; x += 1 / opts.spam) taps.push(x); }
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
    it(`${pack.level.id}: a human within ±25 ms earns an A or better`, () => {
      const { engine } = play(pack, { jitter: 0.025 });
      expect(engine.failed).toBe(false);
      expect(engine.counts.miss).toBe(0);
      expect(engine.accuracy).toBeGreaterThanOrEqual(90);
    });
    for (const rate of [8, 12, 16]) {
      it(`${pack.level.id}: spamming ${rate} taps a second fails (or scrapes a D at most)`, () => {
        const { engine } = play(pack, { spam: rate });
        console.log(`SPAM ${pack.level.id} ${rate}/s: ${engine.failed ? 'failed at ' + engine.failT.toFixed(1) + ' s' : 'grade ' + engine.grade}, accuracy ${engine.accuracy.toFixed(1)}%, strays ${engine.strays}`);
        expect(engine.failed || engine.grade === 'D').toBe(true);
      });
    }
    it(`${pack.level.id}: each gate is judged once, and a stray tap costs combo and health`, () => {
      const level = new Level(pack.level, pack.audio, pack.chart);
      const engine = new Engine(level);
      const n0 = level.notes[0];
      const stray = engine.pressAt(n0.t - 0.5);
      expect(stray && 'stray' in stray).toBe(true);
      expect(engine.health).toBeLessThan(100);
      const early = engine.pressAt(n0.t - 0.14);
      expect(early && !('stray' in early) && early.judge === 'miss' && early.early).toBe(true);
      const again = engine.pressAt(n0.t);
      expect(again && !('stray' in again) && again.note === n0).toBe(false); // the gate is gone: it was judged by the first tap in its zone
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
