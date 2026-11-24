// The galaxy's mechanics: Eko's forms and their lenses, gates, pads, chimes, slipstreams, dual mode, and the
// escalation from planet to planet (windows, warning, density).
import { describe, expect, it } from 'vitest';
import { FINAL, PACKS, type LevelPack } from '../src/game/packs';
import { Level } from '../src/game/level';
import { buildCourse, SLIP_FLIGHT, type Form } from '../src/gd/course';
import { accentBeats, layers, pitchLookup } from '../src/gd/presses';
import { Sim } from '../src/gd/sim';

const ALL = [...PACKS, FINAL];
const built = ALL.map((pack: LevelPack) => {
  const level = new Level(pack.level, pack.audio, pack.chart);
  return { pack, level, course: buildCourse(level, layers(pack), pitchLookup(pack), pack.level.lab, accentBeats(pack)) };
});
const of = (id: string) => built.find((b) => b.pack.level.id === id)!;
const play = (c: (typeof built)[number]['course'], moves: Array<[number, boolean]>, until = c.end) => {
  const sim = new Sim(c, c.start - 3);
  let i = 0;
  for (let b = c.start - 3; b < until && !sim.crashed; b += 1 / 60 / c.spb) {
    while (i < moves.length && moves[i][0] <= b) { const [t, down] = moves[i++]; if (down) sim.press(t); else sim.release(t); }
    sim.advance(b);
  }
  return sim;
};

describe('escalation: each planet is tighter, shows less and asks for more', () => {
  it('windows, warning and branch windows per planet are the approved ones, and every ordinary press has exactly its planet\'s window', () => {
    expect(built.map((b) => Math.round((b.pack.level.rules?.tol ?? 0.12) * 1000))).toEqual([140, 120, 105, 90, 80]);
    expect(built.map((b) => b.pack.level.rules?.ahead ?? 3)).toEqual([3.5, 3, 3, 2.5, 2.5]);
    expect(built.map((b) => Math.round((b.pack.level.rules?.branch ?? 0.07) * 1000))).toEqual([90, 80, 70, 60, 55]);
    for (const { pack, course } of built) {
      const tol = pack.level.rules!.tol! * 1000;
      const plain = course.presses.filter((p) => !p.smash && !p.after && !p.wide && !p.auto);
      expect(plain.length).toBeGreaterThan(20);
      for (const p of plain) expect(p.tol * course.spb * 1000, `${pack.level.id} at ${p.beat}`).toBeCloseTo(tol, 3);
      // the first press after a planet hop, a lens or a gate, and the drop's big press: ±160 ms (or all the room there is)
      for (const p of course.presses.filter((x) => (x.smash || x.after) && !x.auto)) expect(p.tol * course.spb, `${pack.level.id} at ${p.beat}`).toBeGreaterThanOrEqual(0.159);
    }
  });

  it('presses a second never go over the planet\'s ceiling: 2.2, 2.2, 2.4, 2.5, 2.7', () => {
    const cap = [2.2, 2.2, 2.4, 2.5, 2.7];
    built.forEach(({ course, pack }, k) => {
      for (let bar = 0; bar * 4 < course.end; bar++) {
        const n = course.presses.filter((p) => Math.floor(p.beat / 4 + 1e-6) === bar).length;
        expect(n / (4 * course.spb), `${pack.level.id} bar ${bar}`).toBeLessThanOrEqual(cap[k]);
      }
    });
    // the fourth planet is the slow song: it reaches its pace with pairs of eighth notes, the others never go under a beat
    built.forEach(({ course, pack }) => {
      const gap = Math.min(...course.presses.slice(1).map((p, i) => p.beat - course.presses[i].beat));
      expect(gap).toBe(pack.level.id === 'invincible' ? 0.5 : 1);
    });
  });
});

describe('forms: one new one per planet, each with a safe introduction', () => {
  const NEW: Record<string, Form> = { heroes: 'meteor', skyhigh: 'sat', blank: 'pulsar', invincible: 'comet' };

  it('each planet brings its own form through a lens; the bar after its first lens is played for the player and the next two presses are twice as wide', () => {
    for (const [id, form] of Object.entries(NEW)) {
      const { course, pack } = of(id);
      const forms = new Set(course.lenses.map((l) => l.form).filter((f) => f !== 'orb'));
      expect([...forms], id).toEqual([form]);
      const first = course.lenses.find((l) => l.form === form)!;
      expect(first.intro).toBe(true);
      expect(first.beat % 4).toBe(0); // a lens stands on a bar line
      expect(course.lenses.filter((l) => l.intro).length).toBe(1);
      const intro = course.presses.filter((p) => p.beat >= first.beat && p.beat < first.beat + 4);
      expect(intro.length).toBeGreaterThanOrEqual(1);
      for (const p of intro) expect(p.auto && p.intro, `${id}: the intro press at ${p.beat}`).toBe(true);
      // nothing in those four beats can end the run: no taps at all, or mashing, both come out the other side
      const before = course.script.filter(([t]) => t < first.beat - 0.3);
      expect(play(course, before, first.beat + 4).crashed).toBe(false);
      const mash: Array<[number, boolean]> = [];
      for (let t = first.beat; t < first.beat + 3.7; t += 0.21) mash.push([t, true], [t + 0.08, false]);
      expect(play(course, [...before, ...mash], first.beat + 3.9).crashed).toBe(false);
      // the form is used again after its introduction, and its first two real presses are generous
      const real = course.presses.filter((p) => p.form === form && !p.auto);
      expect(real.length, `${id}: real ${form} presses`).toBeGreaterThanOrEqual(6);
      const tol = pack.level.rules!.tol!;
      for (const p of real.slice(0, 2)) { expect(p.wide).toBe(true); expect(p.tol * course.spb).toBeGreaterThan(tol + 0.03); }
      expect(course.firsts.some((f) => f.what === form && f.beat === first.beat), 'a hint the first time').toBe(true);
    }
  });

  it('the last level has every form, with no introductions, and is the only one with two different sparks on one tap', () => {
    const { course } = of(FINAL.level.id);
    expect(new Set(course.lenses.map((l) => l.form))).toEqual(new Set(['orb', 'meteor', 'sat', 'pulsar', 'comet']));
    expect(course.lenses.some((l) => l.intro)).toBe(false);
    expect(course.presses.some((p) => p.intro)).toBe(false);
    expect(course.duals.length).toBe(1);
    expect(course.duals[0][0]).toBeGreaterThan(course.dropBeat);
    for (const b of built) if (b.pack !== FINAL) expect(b.course.duals).toEqual([]);
    expect(course.presses.filter((p) => p.beat >= course.duals[0][0] && p.beat < course.duals[0][1]).every((p) => p.twin !== null && p.form === 'orb')).toBe(true);
  });

  it('each form moves in its own way: the Meteor and the Pulsar stay on their ring, the Satellite and the Comet go between two', () => {
    for (const { course, pack } of built) for (const p of course.presses) {
      const where = `${pack.level.id} at ${p.beat}`;
      if (p.form === 'meteor') { expect(p.to, where).toBe(p.from); expect(p.kind, where).toBe('hop'); }
      if (p.form === 'pulsar') { expect(p.to, where).toBe(p.from); expect(p.kind, where).toBe('flip'); }
      if (p.form === 'sat') { expect(Math.abs(p.to - p.from), where).toBeCloseTo(1, 9); expect(p.kind, where).toBe('flip'); expect(p.line, where).toBe(true); }
      if (p.form === 'comet' && p.act !== 'tap') { expect(Math.abs(p.to - p.from), where).toBeCloseTo(1, 9); expect(p.kind, where).toBe('flip'); }
      if (p.sling || p.smash || p.twin) expect(p.form, where).toBe('orb');
      if (p.form !== 'comet') expect(p.act, where).toBe('tap');
    }
  });
});

describe('the Comet: press and hold on its first mark, let go on its second', () => {
  const { course, level } = of('invincible');
  const downs = course.presses.filter((p) => p.act === 'down');
  const d = downs.find((p) => !p.auto)!;
  const u = course.presses[d.i + 1];
  const ms = (x: number) => x / 1000 / course.spb;

  it('its marks come in pairs that never cross a section, so a practice checkpoint never starts on a let-go', () => {
    expect(downs.length).toBeGreaterThanOrEqual(8);
    for (const p of downs) {
      const up = course.presses[p.i + 1];
      expect(up.act).toBe('up');
      expect(up.seg).toBe(p.seg);
      expect(up.auto).toBe(p.auto);
      expect(up.beat - p.beat).toBeGreaterThanOrEqual(0.5 - 1e-9);
    }
    for (const p of course.presses.filter((x) => x.act === 'up')) expect(course.presses[p.i - 1].act).toBe('down');
    for (const cp of course.checkpoints) expect(course.presses.find((p) => p.beat >= cp - 1e-6)?.act ?? 'tap').not.toBe('up');
    // no gold lines or rails inside a Comet's bars: holding there belongs to the form
    for (const h of course.holds) expect(course.bars[Math.floor(h.a / 4 + 1e-6)].form === 'comet' && !course.bars[Math.floor(h.a / 4 + 1e-6)].twin).toBe(false);
    expect(level.segments[d.seg].core?.charge ?? false).toBe(false);
  });

  it('holding from the first mark to the second clears it; letting go early, a quick tap, or never letting go ends the run', () => {
    expect(play(course, course.script).crashed).toBe(false);
    const edit = (f: (t: number, down: boolean) => number | null) => course.script.map(([t, down]): [number, boolean] | null => { const x = f(t, down); return x === null ? null : [x, down]; }).filter((m): m is [number, boolean] => m !== null).sort((a, b) => a[0] - b[0] || Number(a[1]) - Number(b[1]));
    // let go half-way through the climb
    const early = play(course, edit((t, down) => (!down && t === u.beat ? (d.beat + u.beat) / 2 : t)), u.beat + 2);
    expect(early.crashKind).toBe('let');
    expect(early.crashBeat).toBeGreaterThan(d.beat);
    expect(early.crashBeat).toBeLessThan(u.beat);
    // a quick tap on the first mark
    expect(play(course, edit((t, down) => (!down && t === u.beat ? d.beat + 0.1 : t)), u.beat + 2).crashKind).toBe('let');
    // never letting go: it runs off the end of the ring it climbed to
    const stuck = play(course, edit((t, down) => (!down && t === u.beat ? null : t)).filter(([t]) => t <= u.beat), u.beat + 2);
    expect(stuck.crashKind).toBe('edge');
    expect(stuck.crashBeat).toBeGreaterThan(u.beat);
    // 70 ms early or late on either mark is fine (the window here is ±90 ms)
    for (const off of [-70, 70]) {
      expect(play(course, edit((t, down) => ((down && t === d.beat) || (!down && t === u.beat) ? t + ms(off) : t)), u.beat + 2).crashed, `${off} ms`).toBe(false);
    }
    // letting go 150 ms late is too late
    expect(play(course, edit((t, down) => (!down && t === u.beat ? t + ms(150) : t)), u.beat + 2).crashed).toBe(true);
  });

  it('the gold along a climb is collected by holding, never by tapping', () => {
    const ridden = course.flow.filter((f) => f.ride === 1);
    expect(ridden.length).toBeGreaterThanOrEqual(3);
    for (const f of ridden) expect(course.taps.includes(f.beat)).toBe(false);
    const s = play(course, course.script);
    for (const f of ridden) expect(s.noteUsed(f.beat), `gold at ${f.beat}`).toBe(true);
  });
});

describe('gates, pads, chimes and slipstreams', () => {
  it('every lens and gate stands on a bar line, and the first press after it is extra wide (or taken for the player)', () => {
    for (const { course, pack } of built) {
      const gates = [...course.lenses.map((l) => l.beat), ...course.portals.map((g) => g.beat), ...course.mirrors, ...course.turns];
      for (const g of gates) {
        expect(g % 4, `${pack.level.id}: gate at ${g}`).toBe(0);
        const p = course.presses.find((x) => x.beat >= g - 1e-6 && x.beat < g + 4);
        if (!p || p.auto) continue;
        const i = p.i;
        const room = 0.45 * Math.min(i > 0 ? p.beat - course.presses[i - 1].beat : 99, i + 1 < course.presses.length ? course.presses[i + 1].beat - p.beat : 99) * course.spb;
        expect(p.tol * course.spb, `${pack.level.id}: first press after the gate at ${g}`).toBeGreaterThanOrEqual(Math.min(0.16, room) - 1e-6);
      }
      // tempo gates run from half speed to double, in the five steps the design names
      for (const g of course.portals) expect([0.5, 0.75, 1, 1.25, 1.5, 2]).toContain(g.speed);
    }
    expect(of('blank').course.portals.map((g) => g.speed)).toEqual(expect.arrayContaining([0.5, 1.5, 2]));
    expect(of('skyhigh').course.portals.some((g) => g.speed === 1.5)).toBe(true);
    // mirror gates come in pairs, so the picture always ends the right way round
    for (const { course } of built) expect(course.mirrors.length % 2).toBe(0);
    expect(of('blank').course.mirrors.length).toBe(2);
  });

  it('springboards and tide pads need no tap; chimes are taken in mid-air; slipstreams carry for a beat', () => {
    const spring = of('heroes').course.presses.filter((p) => p.pad === 'spring');
    expect(spring.length).toBeGreaterThanOrEqual(2);
    for (const p of spring) { expect(p.auto).toBe(true); expect(p.sling).toBe(true); }
    expect(of('heroes').course.presses.some((p) => p.sling && !p.auto)).toBe(true); // and the tapped planet hop is still there
    const tide = of('skyhigh').course.presses.filter((p) => p.pad === 'tide');
    expect(tide.length).toBeGreaterThanOrEqual(3);
    for (const p of tide) { expect(p.auto).toBe(true); expect(p.kind).toBe('flip'); }
    const chimes = of('blank').course.presses.filter((p) => p.chime);
    expect(chimes.length).toBeGreaterThanOrEqual(4);
    for (const p of chimes) { const before = of('blank').course.presses[p.i - 1]; expect(before.land).toBe(p.beat); expect(before.to).toBe(p.from); expect(p.spin).toBe(false); }
    const slips = of('invincible').course.presses.filter((p) => p.slip);
    expect(slips.length).toBeGreaterThanOrEqual(3);
    for (const p of slips) { expect(p.land - p.beat).toBe(SLIP_FLIGHT); expect(Math.abs(p.to - p.from)).toBeCloseTo(2, 9); expect(p.line).toBe(true); }
    // the first two planets keep chimes and slipstreams off the main course
    for (const id of ['heroes', 'skyhigh']) expect(of(id).course.presses.some((p) => p.chime || p.slip)).toBe(false);
  });
});
