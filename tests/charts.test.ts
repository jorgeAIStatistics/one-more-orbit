import { describe, expect, it } from 'vitest';
import { PACKS } from '../src/game/packs';
import { Level } from '../src/game/level';
import type { SegmentDef } from '../src/game/types';

const lookKey = (s: SegmentDef) => JSON.stringify([s.lap, s.shape ?? 'circle', s.jump ?? 'out', !!s.reverse, s.revEvery ?? 0, s.rocket ?? 0, s.look.palette, s.look.bg, s.look.eq, s.look.rot ?? 0, !!s.look.flip]);

for (const pack of PACKS) {
  const level = new Level(pack.level, pack.audio, pack.chart);
  const notes = level.notes;
  describe(`${pack.level.id}: one-button chart`, () => {
    it('is at most 2:00 and the layout covers the excerpt', () => {
      expect(pack.audio.length).toBeLessThanOrEqual(120);
      expect(level.segments[level.segments.length - 1].t1).toBeLessThanOrEqual(pack.audio.length - pack.audio.offset + 4 * level.spb);
      expect(level.dropTime).toBeGreaterThan(0);
    });
    it('every note is on the 16th-note grid, inside the excerpt, one tap at a time', () => {
      let prev = -99;
      for (const n of pack.chart.notes) {
        expect(Number.isInteger(n.t) && n.t % 3 === 0, `tick ${n.t}`).toBe(true);
        expect(n.t - prev, `two taps at once near tick ${n.t}`).toBeGreaterThanOrEqual(3);
        prev = n.t;
      }
      for (const n of notes) expect(n.t).toBeLessThan(level.endTime);
    });
    it('fast runs stay short: never more than four 16ths in a row', () => {
      let run = 1;
      for (let i = 1; i < notes.length; i++) {
        run = notes[i].beat - notes[i - 1].beat < 0.26 ? run + 1 : 1;
        expect(run, `bar ${Math.floor(notes[i].beat / 4) + 1}`).toBeLessThanOrEqual(4);
      }
    });
    it('rings: bursts of at most three, the ball never laps a ring, gates at least 22 degrees apart', () => {
      for (const r of level.rings.slice(0, -1)) {
        expect(r.last - r.first + 1).toBeLessThanOrEqual(3);
        expect(r.exitBeat - r.b0).toBeLessThanOrEqual(r.lap * 0.875 + 1e-6);
        for (let k = r.first + 1; k <= r.last; k++) expect(((notes[k].beat - notes[k - 1].beat) / r.lap) * 360).toBeGreaterThanOrEqual(22);
        expect(notes[r.last].exit).toBe(true);
      }
    });
    it('follows one sound per section, at one ring speed, so spacing reads as time', () => {
      for (const s of level.segments) {
        const mine = notes.filter((n) => n.seg === s.index);
        expect(new Set(mine.map((n) => n.voice)).size, `${s.id}: voices`).toBeLessThanOrEqual(1);
        expect(new Set(level.rings.filter((r) => r.seg === s.index && r.last >= r.first).map((r) => r.lap)).size, `${s.id}: ring speeds`).toBeLessThanOrEqual(1);
      }
    });
    it('same music = same taps: every repeat of a phrase is charted identically', () => {
      const groups = new Map<string, { cycle: number; bars: number[] }>();
      for (const s of level.segments) {
        if (!s.motif) continue;
        const g = groups.get(s.motif) ?? { cycle: s.cycle ?? 4, bars: [] };
        for (let b = 0; b < s.bars; b++) g.bars.push(s.bar0 + b);
        groups.set(s.motif, g);
      }
      const sig = (bar: number) => notes.filter((n) => Math.floor(n.beat / 4 + 1e-6) === bar).map((n) => Math.round((n.beat - bar * 4) * 12)).join(',');
      for (const [name, g] of groups) {
        for (let j = 0; j < g.cycle; j++) {
          const pats = new Set(g.bars.filter((_, k) => k % g.cycle === j).map(sig));
          expect(pats.size, `motif ${name}, bar ${j + 1} of the phrase`).toBe(1);
        }
      }
    });
    it('big hits are marked: the drop starts with an accent', () => {
      const first = notes.filter((n) => Math.abs(n.t - level.dropTime) < 0.01);
      expect(first.length).toBe(1);
      expect(first[0].accent).toBe(true);
    });
    it('uses enough one-button elements for its length, with something new at least every 20 s', () => {
      const used = new Set<string>();
      if (level.rings.some((r) => r.last > r.first)) used.add('bursts');
      if (notes.some((n) => n.ghost)) used.add('ghost gates');
      if (notes.some((n) => n.kind === 'hop')) used.add('spike hops');
      if (level.rings.some((r) => r.reversed)) used.add('reversals');
      if (new Set(level.segments.map((s) => s.lap)).size > 1) used.add('speed changes');
      if (new Set(level.segments.map((s) => s.shape ?? 'circle')).size > 1) used.add('orbit shapes');
      if (level.segments.some((s) => s.jump === 'in')) used.add('inward jumps');
      if (level.segments.some((s) => s.rocket)) used.add('rocket');
      const len = pack.audio.length;
      expect(used.size, [...used].join(', ')).toBeGreaterThanOrEqual(len <= 60 ? 3 : len <= 90 ? 4 : 5);
      let lastChange = 0;
      let worst = 0;
      level.segments.forEach((s, i) => {
        if (i > 0 && lookKey(s) !== lookKey(level.segments[i - 1])) { worst = Math.max(worst, s.t0 - lastChange); lastChange = s.t0; }
      });
      expect(Math.max(worst, level.endTime - lastChange)).toBeLessThanOrEqual(20);
    });
    it('new elements get a safe first moment: a teaching banner and an easy first bar', () => {
      for (const s of level.segments.filter((x) => x.teach)) {
        const firstBar = notes.filter((n) => n.seg === s.index && n.beat < s.beat0 + 4);
        expect(firstBar.length, s.id).toBeLessThanOrEqual(6);
      }
    });
  });
}
