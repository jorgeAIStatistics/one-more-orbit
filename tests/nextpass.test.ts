// The next pass (the owner's rules of 2026-11-24): one main idea per world, a mechanic only where the music has its
// sound, a form lasts at least eight bars, no optional gold notes (flow is earned on the nodes), nothing red or
// sudden beside the tap; and the first ten minutes: the cold open, the first stage, Emberwick, the first memory.
import { describe, expect, it } from 'vitest';
import { COLD, FIRST, MEMORIES, PACKS, type LevelPack } from '../src/game/packs';
import { Level } from '../src/game/level';
import { buildCourse } from '../src/gd/course';
import { accentBeats, layers, pitchLookup } from '../src/gd/presses';
import { Sim } from '../src/gd/sim';

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
    for (const p of course.presses) if (!p.smash) expect(p.form, `press at ${p.beat}`).toBe(bar(p.beat) < 9 ? 'orb' : 'meteor');
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
  it('has nothing the plan leaves out: no pads, orbs, portals, gates, flips, twins, slings or tethers', () => {
    expect(course.presses.some((p) => p.pad || p.orb || p.sling || p.twin || p.kind === 'flip')).toBe(false);
    expect(course.portals.length + course.turns.length + course.mirrors.length + course.inverts.length + course.twins.length).toBe(0);
    expect(course.holds.some((h) => h.tether)).toBe(false);
  });
  it('one hold: the charge in bar 16, let go on the drop', () => {
    expect(course.holds.map((h) => bar(h.a))).toEqual([16]);
    expect(Math.abs(course.holds[0].b + 0.75 - course.dropBeat)).toBeLessThan(0.76);
  });
  it('taps are at least a beat apart (0.6 s), except the double strike: two walls half a beat apart, only in the drop\'s second half, never two bars running before its last two', () => {
    const doubles: number[] = [];
    for (let i = 1; i < course.presses.length; i++) {
      const g = course.presses[i].beat - course.presses[i - 1].beat;
      if (g < 1 - 1e-6) { expect(g).toBeGreaterThanOrEqual(0.5 - 1e-6); doubles.push(bar(course.presses[i].beat)); }
    }
    expect(doubles.length).toBeGreaterThanOrEqual(3);
    expect(Math.min(...doubles)).toBeGreaterThanOrEqual(25);
    const early = doubles.filter((b) => b < 31);
    for (let i = 1; i < early.length; i++) expect(early[i] - early[i - 1]).toBeGreaterThanOrEqual(2);
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
  it('is the song from where its drums come in, taught on Star-Nodes and the ribbon only', () => {
    expect(FIRST.level.title).toMatch(/^Where We Started/);
    expect(course.lenses.length).toBe(0);
    expect(course.flow.length).toBe(0);
    expect(course.presses.every((p) => p.form === 'orb' && !p.pad && !p.orb && !p.sling && p.kind !== 'flip')).toBe(true);
    expect(course.holds.some((h) => h.tether)).toBe(false);
    expect(course.holds.length).toBe(4); // three in the quiet stretch, and the charge
  });
  it('starts slow: its first eight bars are taps two beats apart (0.8 s)', () => {
    const first = course.presses.filter((p) => bar(p.beat) < 8);
    for (let i = 1; i < first.length; i++) expect(first[i].beat - first[i - 1].beat).toBeGreaterThanOrEqual(2 - 1e-6);
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
