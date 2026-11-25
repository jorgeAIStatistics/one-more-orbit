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

  it('things to listen to: three sketches for the new opening, then the lullaby in two voicings, a fallback and the ambush cut', () => {
    expect(LISTEN.map((l) => l.id)).toEqual(['helion', 'openinga', 'openingb', 'lullaby', 'lullabyb', 'fallback', 'ambush', 'royalty']);
    for (const l of LISTEN) { expect(l.audio.file).toMatch(/^audio\/.+\.mp3$/); expect(l.from).toBeGreaterThanOrEqual(0); expect(l.from).toBeLessThan(l.audio.length); }
    const lullaby = LISTEN.find((l) => l.id === 'lullaby')!;
    expect(lullaby.audio.bpm).toBe(80);
    expect(lullaby.audio.length).toBeGreaterThan(60);
    expect(lullaby.audio.length).toBeLessThan(90);
    for (const id of ['openinga', 'openingb']) expect(LISTEN.find((l) => l.id === id)!.audio.length).toBeGreaterThan(25); // long enough to reach the first tap and the song
  });

  it('the Meteor room has a wall on every beat the music hits, and its climax on the hook\'s eighth notes too', () => {
    const { course } = of('room-meteor');
    const inBar = (n: number) => course.presses.filter((p) => bar(p.beat) === n && !p.auto);
    const gaps = (n: number) => inBar(n).slice(1).map((p, i) => p.beat - inBar(n)[i].beat);
    for (const n of [21, 22, 23, 27, 28]) { expect(inBar(n).length, `develop/twist bar ${n}`).toBeGreaterThanOrEqual(3); expect(Math.min(...gaps(n)), `bar ${n}: never under a beat`).toBeGreaterThanOrEqual(1 - 1e-6); }
    for (const n of [29, 30, 31]) expect(inBar(n).length, `climax bar ${n}`).toBeGreaterThanOrEqual(4);
    expect([29, 30, 31].some((n) => gaps(n).some((g) => Math.abs(g - 0.5) < 1e-6)), 'the climax has eighth notes').toBe(true);
    for (const p of course.presses.filter((x) => bar(x.beat) >= 21 && bar(x.beat) <= 31 && !x.pad)) expect(p.form === 'meteor' || bar(p.beat) === 25).toBe(true);
  });

  it('the Comet room breathes: two or three actions a bar until the climax, and eighth-note pairs only there', () => {
    const { course } = of('room-comet');
    const inBar = (n: number) => course.presses.filter((p) => bar(p.beat) === n);
    for (let n = 18; n <= 28; n++) {
      expect(inBar(n).length, `bar ${n}`).toBeGreaterThanOrEqual(2);
      expect(inBar(n).length, `bar ${n}`).toBeLessThanOrEqual(3);
    }
    const close = (n: number) => inBar(n).slice(1).some((p, i) => p.beat - inBar(n)[i].beat < 1 - 1e-6);
    for (let n = 18; n <= 28; n++) expect(close(n), `bar ${n}: no eighth notes`).toBe(false);
    expect([29, 30, 31].some(close), 'the climax keeps its pairs').toBe(true);
  });

  it('the ambush: four bars of play and a roll of five before the second light note', () => {
    const { course } = of('ambush');
    for (const n of [8, 9, 10, 11]) expect(course.presses.some((p) => bar(p.beat) === n), `bar ${n} is played`).toBe(true);
    for (const n of [12, 13, 14, 15, 16]) { expect(course.inCharge((n - 1) * 4 + 1), `bar ${n} is roll`).toBe(true); expect(course.presses.some((p) => bar(p.beat) === n)).toBe(false); }
    expect(course.inCharge(7 * 4 + 1)).toBe(false);
  });

  it('the Snuffer wins when the last window goes dark: the run ends where it stands', () => {
    const { course } = of('ambush');
    const sim = new Sim(course, course.start - 3);
    sim.snuff(40);
    expect(sim.crashed).toBe(true);
    expect(sim.crashKind).toBe('snuffed');
    expect(sim.crashBeat).toBe(40);
  });
});
