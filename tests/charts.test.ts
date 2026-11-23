import { describe, expect, it } from 'vitest';
import { PACKS } from '../src/game/packs';
import { Level, buildNotes } from '../src/game/level';
import { DIFFICULTIES } from '../src/game/rules';
import type { SegmentDef } from '../src/game/types';

const lookKey = (s: SegmentDef) => JSON.stringify([s.mode, s.lap, s.dir ?? 0, s.revEvery ?? 0, !!s.counter, !!s.swap, !!s.holds, s.look.palette, s.look.rot ?? 0, s.look.zoom ?? 0]);

for (const pack of PACKS) {
  const level = new Level(pack.level, pack.audio);
  describe(`${pack.level.id}: level layout`, () => {
    it('is at most 2:00 and the layout covers the excerpt', () => {
      expect(pack.audio.length).toBeLessThanOrEqual(120);
      expect(level.segments[level.segments.length - 1].t1).toBeLessThanOrEqual(pack.audio.length - pack.audio.offset + 4 * level.spb);
      expect(level.dropTime).toBeGreaterThan(0);
    });
    it('has enough mechanics and mode switches for its length, and something new at least every 20 s', () => {
      const len = pack.audio.length;
      const modes = new Set(level.segments.map((s) => s.mode));
      let switches = 0;
      let lastChange = 0;
      let worst = 0;
      level.segments.forEach((s, i) => {
        if (i === 0) return;
        const prev = level.segments[i - 1];
        if (s.mode !== prev.mode) switches++;
        if (lookKey(s) !== lookKey(prev)) { worst = Math.max(worst, s.t0 - lastChange); lastChange = s.t0; }
      });
      worst = Math.max(worst, level.endTime - lastChange);
      expect(modes.size).toBeGreaterThanOrEqual(len <= 60 ? 2 : len <= 90 ? 4 : 5);
      expect(switches).toBeGreaterThanOrEqual(len <= 60 ? 1 : 2);
      expect(worst).toBeLessThanOrEqual(20);
    });
  });

  for (const d of DIFFICULTIES) {
    const chart = pack.charts[d];
    const notes = buildNotes(level, chart);
    describe(`${pack.level.id} ${d}: chart`, () => {
      it('every note is on the 16th-note grid and inside the excerpt', () => {
        for (const n of chart.notes) {
          expect(Number.isInteger(n.t) && n.t % 3 === 0, `tick ${n.t}`).toBe(true);
          if (n.d !== undefined) expect(n.d % 3 === 0 && n.d >= 6, `length ${n.d} at ${n.t}`).toBe(true);
        }
        for (const n of notes) expect(n.t1).toBeLessThan(level.endTime);
      });
      it('notes sit in the right kind of section', () => {
        for (const n of notes) {
          const mode = level.segments[n.seg].mode;
          if (n.kind === 'haz') expect(mode).toBe('dodge');
          else if (n.kind === 'spin') expect(mode).toBe('spinner');
          else expect(['dodge', 'spinner']).not.toContain(mode);
          if (n.hand !== 'A') expect(['hold', 'colour', 'dual']).toContain(mode);
        }
      });
      it('no overlaps: each hand has room between notes, and nothing lands on a hand that is holding', () => {
        const minGap = (d === 'normal' ? 6 : 3) / 12 * level.spb - 1e-6;
        for (const side of ['L', 'R'] as const) {
          const mine = notes.filter((n) => (n.kind === 'tap' || n.kind === 'hold') && (n.hand === side || n.hand === 'A'));
          for (let i = 1; i < mine.length; i++) {
            const prev = mine[i - 1];
            expect(mine[i].t - prev.t, `gap at ${mine[i].t.toFixed(2)}s`).toBeGreaterThanOrEqual(minGap);
            if (prev.kind === 'hold') expect(mine[i].t, `note during hold at ${mine[i].t.toFixed(2)}s`).toBeGreaterThan(prev.t1 + minGap * 0.99);
          }
        }
      });
      it('dodge sections can be solved with unhurried hops', () => {
        for (const seg of level.segments.filter((s) => s.mode === 'dodge')) {
          const hz = notes.filter((n) => n.kind === 'haz' && n.seg === seg.index);
          expect(hz.length).toBeGreaterThan(0);
          expect(hz[0].t - seg.t0).toBeGreaterThanOrEqual(level.spb * 0.9);
          for (let i = 1; i < hz.length; i++) expect(hz[i].t - hz[i - 1].t).toBeGreaterThanOrEqual(0.2);
        }
      });
      it('no 4-bar pattern repeats back to back unless the section around it changes', () => {
        const sig = (bar: number) => notes.filter((n) => Math.floor(n.beat / 4) === bar).map((n) => `${n.kind}${n.hand}${Math.round((n.beat % 4) * 12)}:${Math.round((n.beat1 - n.beat) * 12)}`).join(',');
        const bars = Math.floor(level.totalBeats / 4);
        for (let b = 0; b + 8 <= bars; b++) {
          const a = [0, 1, 2, 3].map((k) => sig(b + k)).join('|');
          const c = [4, 5, 6, 7].map((k) => sig(b + k)).join('|');
          if (a.replace(/\|/g, '') === '' || a !== c) continue;
          const s1 = level.segAt((b * 4 + 0.01) * level.spb);
          const s2 = level.segAt(((b + 4) * 4 + 0.01) * level.spb);
          expect(lookKey(s1), `bars ${b + 1}-${b + 8} repeat with nothing changed`).not.toBe(lookKey(s2));
        }
      });
    });
  }
}
