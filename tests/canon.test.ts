// The canon's first ten minutes, as far as rules can check them: the level behind the opening's first tap, the gentle
// first bars, and the first memory of Helion.
import { describe, expect, it } from 'vitest';
import { MEMORIES, PACKS, type LevelPack } from '../src/game/packs';
import { Level } from '../src/game/level';
import { buildCourse } from '../src/gd/course';
import { accentBeats, layers, pitchLookup } from '../src/gd/presses';
import { Sim } from '../src/gd/sim';

const courseOf = (p: LevelPack) => { const level = new Level(p.level, p.audio, p.chart); return { level, course: buildCourse(level, layers(p), pitchLookup(p), p.level.lab, accentBeats(p)) }; };
/** Lets a level play with nobody tapping, a sixteenth at a time, until `to` (or a fall). */
const idle = (sim: Sim, from: number, to: number, each?: (b: number) => void) => { for (let b = from; b <= to && !sim.crashed; b += 0.25) { each?.(b); sim.advance(b); sim.out.length = 0; } };

describe('the opening\'s first tap starts Emberwick', () => {
  const { course } = courseOf(PACKS[0]);
  it('the song begins on the tap, and its first bar asks for nothing: the bloom has four beats to play out', () => {
    expect(course.start).toBe(0);
    expect(course.presses[0].beat).toBeGreaterThanOrEqual(4);
  });
  it('the first sixteen beats are gentle (a Star-Node nobody taps is taken for the player); after that a missed one ends the flight', () => {
    const sim = new Sim(course, 0, -Infinity, true);
    idle(sim, 0, 40, (b) => { if (b >= 16) sim.forgiving = false; });
    expect(sim.crashed).toBe(true);
    expect(sim.crashBeat).toBeGreaterThan(16);
    expect(sim.helped).toBeGreaterThanOrEqual(5); // (the nodes of the first bars, taken for a player who only watched)
  });
});

describe('the first memory of Helion', () => {
  const p = MEMORIES[PACKS[0].level.id], { level, course } = courseOf(p);
  it('is a twin orbit from its first beat to its last, about twenty-six seconds of Memory Box (its first part), the brothers in step', () => {
    expect(p.level.title).toBe('Memory Box');
    expect(course.twins).toEqual([[0, 64]]); // sixteen bars at 150 beats a minute
    expect(level.endTime).toBeGreaterThan(24); expect(level.endTime).toBeLessThan(30);
    expect(course.presses.length).toBeGreaterThanOrEqual(20);
    expect(course.presses.every((x) => x.twin === 'both')).toBe(true); // one tap moves both
  });
  it('is simple: a tap a beat at most, and nothing but the orbit (no forms, gates, pads or holds)', () => {
    for (let i = 1; i < course.presses.length; i++) expect(course.presses[i].beat - course.presses[i - 1].beat).toBeGreaterThanOrEqual(1 - 1e-6);
    expect(course.holds.length).toBe(0);
    expect(course.lenses.length).toBe(0);
    expect(course.presses.every((x) => x.form === 'orb' && !x.smash)).toBe(true);
  });
  it('cannot be failed: with nobody tapping at all it plays to its end', () => {
    const sim = new Sim(course, -4, -Infinity, true);
    idle(sim, -4, course.end);
    expect(sim.crashed).toBe(false);
    expect(sim.helped).toBe(course.presses.length);
  });
});
