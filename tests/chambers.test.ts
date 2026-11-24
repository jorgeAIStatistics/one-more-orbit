// The test chambers: one short room per gift, laid out as introduce, develop, twist, climax, and the ambush.
import { describe, expect, it } from 'vitest';
import { CHAMBERS, LISTEN } from '../src/game/chambers';
import { Level } from '../src/game/level';
import { buildCourse, type Form } from '../src/gd/course';
import { accentBeats, layers, pitchLookup } from '../src/gd/presses';
import { Sim } from '../src/gd/sim';

const built = CHAMBERS.map((c) => {
  const level = new Level(c.pack.level, c.pack.audio, c.pack.chart);
  return { c, level, course: buildCourse(level, layers(c.pack), pitchLookup(c.pack), c.pack.level.lab, accentBeats(c.pack)) };
});
const of = (id: string) => built.find((b) => b.c.id === id)!;
const play = (c: (typeof built)[number]['course'], moves: Array<[number, boolean]>, until = c.end) => {
  const sim = new Sim(c, c.start - 3);
  let i = 0;
  for (let b = c.start - 3; b < until && !sim.crashed; b += 1 / 60 / c.spb) {
    while (i < moves.length && moves[i][0] <= b) { const [t, down] = moves[i++]; if (down) sim.press(t); else sim.release(t); }
    sim.advance(b);
  }
  return sim;
};
const bar = (beat: number) => Math.floor(beat / 4 + 1e-6) + 1;
const GIFT: Record<string, Form> = { 'room-meteor': 'meteor', 'room-satellite': 'sat', 'room-pulsar': 'pulsar', 'room-comet': 'comet' };

describe('test chambers', () => {
  it('there is a room for each gift and one for the ambush, each under a minute and clearable by a perfect run', () => {
    expect(CHAMBERS.map((c) => c.id)).toEqual(['room-meteor', 'room-satellite', 'room-pulsar', 'room-comet', 'ambush']);
    for (const { c, course } of built) {
      const secs = (course.end - course.start) * course.spb;
      expect(secs, `${c.id}: length`).toBeGreaterThan(25);
      expect(secs, `${c.id}: length`).toBeLessThan(60);
      const sim = play(course, course.script);
      expect(sim.crashed, `${c.id}: a perfect run, crash at ${sim.crashBeat}`).toBe(false);
      expect(play(course, [], course.end).crashed, `${c.id}: doing nothing`).toBe(true);
    }
  });

  it('a gift\'s room is that gift alone, in four beats: shown first, then developed, twisted and brought to a climax', () => {
    for (const [id, form] of Object.entries(GIFT)) {
      const { c, course } = of(id);
      const forms = new Set(course.lenses.map((l) => l.form).filter((f) => f !== 'orb'));
      expect([...forms], id).toEqual([form]);
      // introduce: the first lens is in the first beat, and the bar after it is played for the player
      const lens = course.lenses.find((l) => l.form === form)!;
      expect(lens.intro, `${id}: shown first`).toBe(true);
      expect(bar(lens.beat)).toBeGreaterThanOrEqual(c.beats[0].bar);
      expect(bar(lens.beat)).toBeLessThan(c.beats[1].bar);
      const shown = course.presses.filter((p) => bar(p.beat) === bar(lens.beat));
      expect(shown.length).toBeGreaterThan(0);
      for (const p of shown) expect(p.auto && p.intro).toBe(true);
      // every beat has real presses in the gift's form (the spring pad's own throw apart)
      c.beats.forEach((b, i) => {
        const to = i + 1 < c.beats.length ? c.beats[i + 1].bar : bar(course.end - 1) + 1;
        const mine = course.presses.filter((p) => bar(p.beat) >= b.bar && bar(p.beat) < to && p.form === form && !p.auto);
        expect(mine.length, `${id}: ${b.label}`).toBeGreaterThanOrEqual(i === 0 ? 2 : 4);
      });
      // the twist changes the rules: a gate (turn, tempo, mirror or upside-down) or a pad stands in its bars and not before
      const gates = [...course.turns, ...course.portals.map((g) => g.beat), ...course.mirrors, ...course.inverts, ...course.presses.filter((p) => p.pad).map((p) => p.beat)].map(bar);
      const [, dev, twist, climax] = c.beats.map((b) => b.bar);
      expect(gates.some((g) => g >= twist && g < climax), `${id}: something turns in the twist`).toBe(true);
      if (id !== 'room-pulsar') expect(gates.some((g) => g < twist), `${id}: nothing turns before the twist`).toBe(false);
      expect(dev).toBeGreaterThan(c.beats[0].bar);
      // and it ends as the Orb, the right way up and the right way round
      expect(course.formAt(course.end - 2)).toBe('orb');
      expect(course.inverts.length % 2).toBe(0);
      expect(course.mirrors.length % 2).toBe(0);
    }
  });

  it('the ambush: six light notes, a roll before each, both gifts so far, and presses spare until its last phrases', () => {
    const { course, level } = of('ambush');
    const lights = course.presses.filter((p) => p.smash);
    expect(lights.map((p) => bar(p.beat))).toEqual([5, 17, 21, 25, 29, 33]);
    for (const p of lights) {
      expect(p.auto).toBe(false);
      expect(p.tol * course.spb).toBeGreaterThanOrEqual(0.159); // wide: it can always be taken
      expect(course.inCharge(p.beat - 1), `a roll runs up to the light note at bar ${bar(p.beat)}`).toBe(true);
      expect(course.presses.some((x) => x.beat < p.beat && x.beat > p.beat - 4), 'nothing can end the run in the bar before it').toBe(false);
    }
    expect(new Set(course.lenses.map((l) => l.form))).toEqual(new Set(['orb', 'meteor', 'sat']));
    expect(course.lenses.some((l) => l.intro)).toBe(false);
    // 160 BPM, played after the second planet: two presses a bar until bar 25, then every beat
    for (let b = 1; b < 25; b++) expect(course.presses.filter((p) => bar(p.beat) === b).length, `bar ${b}`).toBeLessThanOrEqual(2);
    expect(course.presses.filter((p) => bar(p.beat) >= 25).length).toBeGreaterThanOrEqual(16);
    expect(course.presses.some((p) => p.orb === 'jump') && course.presses.some((p) => p.orb === 'dash')).toBe(true);
    const secs = level.endTime;
    expect(secs).toBeGreaterThan(45);
    expect(secs).toBeLessThan(60);
  });

  it('there are two voicings of the lullaby, a fallback and the ambush cut to listen to', () => {
    expect(LISTEN.map((l) => l.id)).toEqual(['lullaby', 'lullabyb', 'fallback', 'ambush', 'royalty']);
    for (const l of LISTEN) { expect(l.audio.file).toMatch(/^audio\/.+\.mp3$/); expect(l.from).toBeGreaterThanOrEqual(0); expect(l.from).toBeLessThan(l.audio.length); }
    expect(LISTEN[0].audio.bpm).toBe(80);
    expect(LISTEN[0].audio.length).toBeGreaterThan(60);
    expect(LISTEN[0].audio.length).toBeLessThan(90);
  });
});
