// The next pass. The owner's rules of 2026-11-24 (one NEW idea per world, a mechanic only where the music has its
// sound, a form lasts at least eight bars, no optional gold notes, nothing red beside the tap) as corrected on
// 2026-11-25: everything the player already knows stays in play; charts follow the music's most interesting part; no
// bar pattern more than twice running and something changing every four bars; every phrase mixes its actions;
// verses 2-4 taps a bar, drops 4-8; three set pieces a planet; the first stage gentle for 20-30 s only.
import { describe, expect, it } from 'vitest';
import { COLD, FIRST, MEMORIES, PACKS, type LevelPack } from '../src/game/packs';
import { Level } from '../src/game/level';
import { buildCourse } from '../src/gd/course';
import { accentBeats, layers, pitchLookup } from '../src/gd/presses';
import { Sim } from '../src/gd/sim';
import { audit } from '../tools/variety';

const build = (p: LevelPack) => { const level = new Level(p.level, p.audio, p.chart); return { level, course: buildCourse(level, layers(p), pitchLookup(p), p.level.lab, accentBeats(p)) }; };
const play = (c: ReturnType<typeof build>['course'], moves: Array<[number, boolean]>) => {
  const sim = new Sim(c, c.start - 3);
  let i = 0;
  for (let b = c.start - 3; b < c.end && !sim.crashed; b += 1 / 60 / c.spb) {
    while (i < moves.length && moves[i][0] <= b) { const [t, down] = moves[i++]; if (down) sim.press(t); else sim.release(t); }
    sim.advance(b);
  }
  return sim;
};
const bar = (beat: number) => Math.floor(beat / 4 + 1e-6);
const EMBER = PACKS.find((p) => p.level.id === 'heroes')!;

describe('Emberwick on Volcano: the Meteor, and nothing the song is not playing', () => {
  const { level, course } = build(EMBER);
  it('is Volcano, about eighty seconds, swung', () => {
    expect(EMBER.level.title).toMatch(/^Volcano/);
    expect(EMBER.audio.bpm).toBe(100);
    expect((course.end - course.start) * course.spb).toBeGreaterThan(70);
    expect((course.end - course.start) * course.spb).toBeLessThan(90);
    expect(level.file.swing).toBe(true);
  });
  it('has one form change in the whole level, where the stabs begin (bar 9), and the Meteor then lasts to the end', () => {
    expect(course.lenses.map((l) => [l.form, bar(l.beat)])).toEqual([['meteor', 9]]);
    expect(course.lenses[0].intro).toBe(true); // named once, where it is given
    // (the drop's great node is struck, not dashed: it has no wall; Orbin stays the Meteor through it)
    for (const p of course.presses) if (!p.smash && !p.sling) expect(p.form, `press at ${p.beat}`).toBe(bar(p.beat) < 9 ? 'orb' : 'meteor'); // (a planet hop and the great node are struck as the Orb)
    for (let b = 36; b < course.end; b += 0.5) expect(course.formAt(b), `form at ${b}`).toBe('meteor');
  });
  it('the Meteor is given safely: its first walls are played for him, and the drums are not there yet', () => {
    const given = course.presses.filter((p) => bar(p.beat) === 9);
    expect(given.length).toBeGreaterThan(0);
    expect(given.every((p) => p.auto)).toBe(true);
  });
  it('has no gold notes: flow is earned on the nodes themselves', () => {
    expect(course.flow.length).toBe(0);
  });
  it('keeps everything the first stage taught in play: spikes, spin gates, holds, doubles, height changes, a planet hop and a speed gate; no pads, orbs, twins or tethers', () => {
    expect(course.turns.length).toBeGreaterThanOrEqual(3);
    expect(course.presses.some((p) => p.spin)).toBe(true);
    expect(course.presses.some((p) => p.sling)).toBe(true);
    expect(course.portals.some((g) => g.faster)).toBe(true);
    expect(course.holds.length).toBeGreaterThanOrEqual(2);
    expect(course.presses.some((p) => p.pad || p.orb || p.twin)).toBe(false);
    expect(course.holds.some((h) => h.tether)).toBe(false);
  });
  it('a clean run clears with a full drop; doing nothing, or tapping 180 ms late everywhere, does not', () => {
    const s = play(course, course.script);
    expect(s.crashed).toBe(false);
    expect(s.charge * Math.min(1, s.flow / 0.6)).toBeGreaterThanOrEqual(0.99);
    expect(play(course, []).crashed).toBe(true);
    expect(play(course, course.script.map(([t, d]) => [t + 0.18 / course.spb, d] as [number, boolean])).crashed).toBe(true);
  });
});

describe('the first stage: the Drifting Edge, on Where We Started', () => {
  const { course } = build(FIRST);
  it('is the song from where its drums come in: no forms, no gold notes, no tethers; it teaches the tap, the double, the spike, the ribbon, the spin gate, the weave, the planet hop and the speed gate', () => {
    expect(FIRST.level.title).toMatch(/^Where We Started/);
    expect(course.lenses.length).toBe(0);
    expect(course.flow.length).toBe(0);
    expect(course.presses.every((p) => p.form === 'orb' && !p.pad && !p.orb)).toBe(true);
    expect(course.holds.some((h) => h.tether)).toBe(false);
    expect(course.holds.length).toBeGreaterThanOrEqual(3);
    expect(course.turns.length).toBeGreaterThanOrEqual(3);
    expect(course.presses.some((p) => p.spin) && course.presses.some((p) => p.weave) && course.presses.some((p) => p.sling)).toBe(true);
    expect(course.portals.some((g) => g.faster)).toBe(true);
  });
  it('is gentle for its first twenty-odd seconds only (2-4 taps a bar), then a real level', () => {
    const perBar = (n: number) => course.presses.filter((p) => bar(p.beat) === n).length;
    for (let n = 1; n < 16; n++) { expect(perBar(n), `bar ${n}`).toBeGreaterThanOrEqual(2); expect(perBar(n), `bar ${n}`).toBeLessThanOrEqual(4); }
    expect(16 * 4 * course.spb).toBeLessThanOrEqual(30);
  });
  it('a clean run clears, and the star rises in the song\'s own quiet after it', () => {
    expect(play(course, course.script).crashed).toBe(false);
    const last = course.presses[course.presses.length - 1];
    expect(course.end - last.beat).toBeGreaterThanOrEqual(8);
  });
});

describe('the cold open and the first memory: twin orbits, one tap moves both, nothing can fail', () => {
  for (const [name, p] of [['the cold open', COLD], ['the first memory', MEMORIES.heroes]] as const) {
    it(name, () => {
      const { course } = build(p);
      expect(course.presses.length).toBeGreaterThan(8);
      expect(course.presses.every((x) => x.twin === 'both')).toBe(true);
      const sim = new Sim(course, -4, -Infinity, true);
      for (let b = -4; b <= course.end && !sim.crashed; b += 0.25) { sim.advance(b); sim.out.length = 0; }
      expect(sim.crashed).toBe(false);
    });
  }
});

describe('the variety audit: the owner\'s charting rules, measured on the courses the game builds', () => {
  for (const pack of [FIRST, EMBER]) {
    it(pack.level.id, () => {
      const a = audit(pack);
      expect(a.uniquePct, 'unique bar patterns').toBeGreaterThanOrEqual(60);
      expect(a.longestRun, 'identical bars in a row').toBeLessThanOrEqual(2);
      expect(a.setpieces.length).toBeGreaterThanOrEqual(3);
      for (const sp of a.setpieces) expect(sp.found, sp.name).toBe(true);
      for (const p of a.phrases) expect(p.actions.length, `actions in bars ${p.bars}`).toBeGreaterThanOrEqual(4);
      for (const s of a.sections) {
        if (/VERSE/.test(s.label)) { expect(s.mean, s.id).toBeGreaterThanOrEqual(2); expect(Math.max(...s.perBar), s.id).toBeLessThanOrEqual(4); }
        if (/DROP/.test(s.label)) { expect(s.mean, s.id).toBeGreaterThanOrEqual(4); expect(Math.max(...s.perBar), s.id).toBeLessThanOrEqual(8); }
      }
      expect(a.rest.longestGapBeats, 'never long with nothing to tap').toBeLessThanOrEqual(4);
    });
  }
});
