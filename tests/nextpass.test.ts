// The next pass. The owner's rules of 2026-11-24 (one NEW idea per world, a mechanic only where the music has its
// sound, a form lasts at least eight bars, no optional gold notes, nothing red beside the tap) as corrected on
// 2026-11-25: everything the player already knows stays in play; charts follow the music's most interesting part; no
// bar pattern more than twice running and something changing every four bars; every phrase mixes its actions;
// verses 2-4 taps a bar, drops 4-8; three set pieces a planet; the first stage gentle for 20-30 s only.
import { describe, expect, it } from 'vitest';
import { FIRST, MEMORIES, PACKS, type LevelPack } from '../src/game/packs';
import { Level } from '../src/game/level';
import { buildCourse } from '../src/gd/course';
import { accentBeats, layers, pitchLookup } from '../src/gd/presses';
import { Sim } from '../src/gd/sim';
import { audit, difficulty } from '../tools/variety';

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
  it('is Volcano, about a minute (re-cut 2026-11-25: the drop 19.2 s after the first tap), swung', () => {
    expect(EMBER.level.title).toMatch(/^Volcano/);
    expect(EMBER.audio.bpm).toBe(100);
    expect((course.end - course.start) * course.spb).toBeGreaterThanOrEqual(55);
    expect((course.end - course.start) * course.spb).toBeLessThanOrEqual(80);
    expect(course.dropBeat * course.spb - course.start * course.spb).toBeLessThanOrEqual(20);
    expect(level.file.swing).toBe(true);
  });
  it('has one form change in the whole level, where the stabs begin (bar 5, 12 s in), and the Meteor then lasts to the end', () => {
    expect(course.lenses.map((l) => [l.form, bar(l.beat)])).toEqual([['meteor', 5]]);
    expect(course.lenses[0].intro).toBe(true); // named once, where it is given
    // (the drop's great node is struck, not dashed: it has no wall; Orbin stays the Meteor through it)
    for (const p of course.presses) if (!p.smash && !p.sling) expect(p.form, `press at ${p.beat}`).toBe(bar(p.beat) < 5 ? 'orb' : 'meteor'); // (a planet hop and the great node are struck as the Orb)
    for (let b = 20; b < course.end; b += 0.5) expect(course.formAt(b), `form at ${b}`).toBe('meteor');
  });
  it('the Meteor is given safely: its first walls are played for him, and the drums are not there yet', () => {
    const given = course.presses.filter((p) => bar(p.beat) === 5);
    expect(given.length).toBeGreaterThan(0);
    expect(given.every((p) => p.auto)).toBe(true);
  });
  it('has no gold notes: flow is earned on the nodes themselves', () => {
    expect(course.flow.length).toBe(0);
  });
  it('asks only what the owner\'s table allows: at most two turns and none in a drop; no spin gates, weaving, gravity, world turns or tethers; jump orbs only; a planet hop and a speed portal', () => {
    const d = difficulty(EMBER);
    expect(d.turns.length).toBeLessThanOrEqual(2);
    expect(d.turnsInDrop).toEqual([]);
    expect(course.presses.some((p) => p.spin || p.weave || (p.kind === 'flip' && !p.weave) || p.twin || p.pad === 'tide')).toBe(false);
    expect(course.inverts.length + course.mirrors.length).toBe(0);
    expect(course.holds.some((h) => h.tether)).toBe(false);
    expect(course.presses.every((p) => p.orb === '' || p.orb === 'jump')).toBe(true);
    expect(course.portals.some((g) => g.faster)).toBe(true);
    // (no planet hops since 2026-11-25: the course circles the planet that is being relit)
    expect(course.presses.some((p) => p.sling)).toBe(false);
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
  it('is the song from where its drums come in, and asks only jumps, jump orbs, a jump pad, one slow and one fast portal: no turns, spins, inverts, weaving or gravity', () => {
    expect(FIRST.level.title).toMatch(/^Where We Started/);
    expect(course.lenses.length).toBe(0);
    expect(course.flow.length).toBe(0);
    expect(course.turns.length + course.inverts.length + course.mirrors.length).toBe(0);
    expect(course.presses.some((p) => p.spin || p.weave || p.kind === 'flip' || p.twin)).toBe(false);
    expect(course.presses.some((p) => p.orb === 'jump')).toBe(true);
    expect(course.presses.some((p) => p.sling)).toBe(false); // (the course circles the planetoid: no planet hops)
    expect(course.dropBeat * course.spb - course.start * course.spb).toBeLessThanOrEqual(20);
    expect(course.portals.filter((g) => !g.faster).length).toBe(1);
    expect(course.portals.filter((g) => g.faster).length).toBe(1);
    expect(course.holds.some((h) => h.tether)).toBe(false);
  });
  it('a clean run clears, and the star rises in the song\'s own quiet after it', () => {
    expect(play(course, course.script).crashed).toBe(false);
    const last = course.presses[course.presses.length - 1];
    expect(course.end - last.beat).toBeGreaterThanOrEqual(8);
  });
});

describe('the first memory: a twin orbit, one tap moves both, nothing can fail', () => {
  // (the cold open is a scene now, not a level: only the memory is still a twin orbit)
  for (const [name, p] of [['the first memory', MEMORIES.heroes]] as const) {
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
      for (const p of a.phrases) expect(p.actions.length, `actions in bars ${p.bars}`).toBeGreaterThanOrEqual(2);
      // the owner's difficulty table: taps a second per section, bursts, turns, what is allowed, nothing stacked
      expect(difficulty(pack).verdict).toEqual([]);
      expect(a.rest.longestGapBeats, 'never long with nothing to tap').toBeLessThanOrEqual(8);
    });
  }
});
