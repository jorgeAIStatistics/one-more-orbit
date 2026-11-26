// The galaxy's mechanics: Eko's forms and their lenses, gates, pads, chimes, slipstreams, dual mode, and the
// escalation from planet to planet (windows, warning, density).
import { describe, expect, it } from 'vitest';
import { FINAL, PACKS, type LevelPack } from '../src/game/packs';
import { Level } from '../src/game/level';
import { buildCourse, SLIP_FLIGHT, type Form } from '../src/gd/course';
import { accentBeats, layers, pitchLookup } from '../src/gd/presses';
import { Sim } from '../src/gd/sim';

import skyOldLevel from '../levels/skyhigh/level.json';
import skyOldAudio from '../levels/skyhigh/audio.json';
import skyOldChart from '../levels/skyhigh/chart.json';
import skyOldPresses from '../levels/skyhigh/presses.json';
import skyOldAudit from '../levels/skyhigh/audit.json';
import blankOldLevel from '../levels/blank/level.json';
import blankOldAudio from '../levels/blank/audio.json';
import blankOldChart from '../levels/blank/chart.json';
import blankOldPresses from '../levels/blank/presses.json';
import blankOldAudit from '../levels/blank/audit.json';
import invOldLevel from '../levels/invincible/level.json';
import invOldAudio from '../levels/invincible/audio.json';
import invOldChart from '../levels/invincible/chart.json';
import invOldPresses from '../levels/invincible/presses.json';
import invOldAudit from '../levels/invincible/audit.json';
// (the engine's mechanics are checked on the charts that were built to show them: Cirra, Glassmere and Verdance's
// old songs, kept in the repo since those worlds moved to new ones on 2026-11-25; the new worlds: tests/world1.test.ts)
const old = (level: unknown, audio: unknown, chart: unknown, presses: unknown, audit: unknown): LevelPack => ({ level: level as LevelPack['level'], audio: audio as LevelPack['audio'], chart: chart as LevelPack['chart'], presses: presses as LevelPack['presses'], audit: audit as LevelPack['audit'] });
const OLD: Record<string, LevelPack> = { skyhigh: old(skyOldLevel, skyOldAudio, skyOldChart, skyOldPresses, skyOldAudit), blank: old(blankOldLevel, blankOldAudio, blankOldChart, blankOldPresses, blankOldAudit), invincible: old(invOldLevel, invOldAudio, invOldChart, invOldPresses, invOldAudit) };
const ALL = [...PACKS.map((p) => OLD[p.level.id] ?? p), FINAL];
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
      // (Emberwick's double strike: two walls half a beat apart share the room between them, so they may be a little narrower)
      for (const p of plain) if (!(pack.level.id === 'heroes' && course.presses.some((q) => q !== p && Math.abs(q.beat - p.beat) < 0.99))) expect(p.tol * course.spb * 1000, `${pack.level.id} at ${p.beat}`).toBeCloseTo(tol, 3);
      // the first press after a planet hop, a lens or a gate, and the drop's big press: ±160 ms (or all the room there is)
      for (const p of course.presses.filter((x) => (x.smash || x.after) && !x.auto)) expect(p.tol * course.spb, `${pack.level.id} at ${p.beat}`).toBeGreaterThanOrEqual(0.159);
    }
  });

  it('presses a second never go over the planet\'s ceiling: 2.2, 2.2, 2.4, 2.5, 2.7', () => {
    // (the first planet is charted under the owner's 2026-11-25 rules: drops and builds 4-8 taps a bar, so its ceiling is eight a bar)
    const cap = [8 / 2.4 + 1e-9, 2.2, 2.4, 2.5, 2.7];
    built.forEach(({ course, pack }, k) => {
      for (let bar = 0; bar * 4 < course.end; bar++) {
        const n = course.presses.filter((p) => Math.floor(p.beat / 4 + 1e-6) === bar).length;
        expect(n / (4 * course.spb), `${pack.level.id} bar ${bar}`).toBeLessThanOrEqual(cap[k]);
      }
    });
    // the fourth planet is the slow song: it reaches its pace with pairs of eighth notes, the others never go under a beat
    built.forEach(({ course, pack }) => {
      const gap = Math.min(...course.presses.slice(1).map((p, i) => p.beat - course.presses[i].beat));
      expect(gap).toBe(pack.level.id === 'invincible' || pack.level.id === 'heroes' ? 0.5 : 1); // (Emberwick: the double strike, its twist)
    });
  });
});

describe('forms: one new one per planet, each with a safe introduction', () => {
  const NEW: Record<string, Form> = { heroes: 'meteor', skyhigh: 'sat', blank: 'pulsar', invincible: 'comet' };

  it('each planet brings its own form through a lens, shown first; forms from earlier planets come back with no introduction, only wider first openings', () => {
    const order: Form[] = ['meteor', 'sat', 'pulsar', 'comet'];
    for (const [id, form] of Object.entries(NEW)) {
      const { course, pack } = of(id);
      const forms = new Set(course.lenses.map((l) => l.form).filter((f) => f !== 'orb'));
      // its own form, and every form met before it: reused in new combinations
      expect([...forms].sort(), id).toEqual(order.slice(0, order.indexOf(form) + 1).sort());
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
      // a form from an earlier planet: never played for the player, and its first press here is wide
      for (const old of order.slice(0, order.indexOf(form))) {
        const lens = course.lenses.find((l) => l.form === old)!;
        expect(lens.intro, `${id}: ${old} needs no introduction`).toBe(false);
        const p = course.presses.find((x) => x.beat >= lens.beat - 1e-6 && x.form === old)!;
        expect(p.auto, `${id}: the first ${old} press is the player's`).toBe(false);
        expect(p.wide, `${id}: and it is wide`).toBe(true);
      }
    }
  });

  it('forms keep changing: from the second planet on there is a lens at least every 16 bars; the first planet has the Meteor for more than two bars running and changes form at least three times', () => {
    const bar = (b: number) => Math.round(b / 4);
    for (const id of ['skyhigh', 'blank', 'invincible']) {
      const { course } = of(id);
      const at = [0, ...course.lenses.map((l) => bar(l.beat)), Math.round(course.presses[course.presses.length - 1].beat / 4)];
      for (let k = 1; k < at.length; k++) expect(at[k] - at[k - 1], `${id}: bars ${at[k - 1] + 1} to ${at[k] + 1} without a lens`).toBeLessThanOrEqual(16);
      expect(course.lenses.length, id).toBeGreaterThanOrEqual(10);
    }
    // the first planet (the next pass): one form change in the whole level, at a section change, and the form then lasts
    // for the rest of it (at least eight bars)
    const h = of('heroes').course;
    expect(h.lenses.length).toBe(1);
    expect(h.lenses[0].form).toBe('meteor');
    expect((h.end - h.lenses[0].beat) / 4).toBeGreaterThanOrEqual(8);
    // and in those bars the player really is the Meteor: at least four presses of their own in one stretch
    expect(h.presses.filter((p) => p.form === 'meteor' && !p.auto).length).toBeGreaterThanOrEqual(8);
  });

  it('the last level has every form and no introductions; two different sparks on one tap come gently on the fourth planet, hard in its final drop, and again in the last level', () => {
    const { course } = of(FINAL.level.id);
    expect(new Set(course.lenses.map((l) => l.form))).toEqual(new Set(['orb', 'meteor', 'sat', 'pulsar', 'comet']));
    expect(course.lenses.some((l) => l.intro)).toBe(false);
    expect(course.presses.some((p) => p.intro)).toBe(false);
    expect(course.duals.length).toBe(1);
    expect(course.duals[0][0]).toBeGreaterThan(course.dropBeat);
    for (const b of built) if (b.pack !== FINAL && b.pack.level.id !== 'invincible') expect(b.course.duals).toEqual([]);
    for (const c of [course, of('invincible').course]) for (const d of c.duals) expect(c.presses.filter((p) => p.beat >= d[0] && p.beat < d[1]).every((p) => p.twin !== null && p.form === 'orb')).toBe(true);
    // Invincible: the mirrored twin orbit is still there; the echo in another form comes first before the drop, in a
    // sparse stretch (a Pulsar: it stays on one ring), and the level ends on four bars of it, most of them a Satellite
    const inv = of('invincible').course;
    const mirrored = inv.twins.flatMap(([a, z]) => { const out: number[] = []; for (let b = a; b < z; b += 4) if (!inv.duals.some((d) => b >= d[0] && b < d[1])) out.push(b); return out; });
    expect(mirrored.length).toBeGreaterThanOrEqual(4);
    expect(inv.duals.length).toBeGreaterThanOrEqual(3);
    expect(inv.duals[0][1]).toBeLessThanOrEqual(inv.dropBeat);
    expect(inv.duals[0][2]).toBe('pulsar');
    const gentle = inv.presses.filter((p) => p.beat >= inv.duals[0][0] && p.beat < inv.duals[0][1]).length / ((inv.duals[0][1] - inv.duals[0][0]) / 4);
    const final = inv.duals.filter((d) => d[0] >= inv.presses[inv.presses.length - 1].beat - 20);
    expect(final.reduce((n, d) => n + (d[1] - d[0]), 0)).toBe(16);
    expect(final.some((d) => d[2] === 'sat')).toBe(true);
    const hard = inv.presses.filter((p) => final.some((d) => p.beat >= d[0] && p.beat < d[1])).length / 4;
    expect(hard).toBeGreaterThanOrEqual(gentle * 2);
    expect(inv.firsts.some((f) => f.what === 'dual' && f.beat < inv.dropBeat)).toBe(true);
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
    // mirror and upside-down gates come in pairs, so the picture always ends the right way up and the right way round
    for (const { course } of built) { expect(course.mirrors.length % 2).toBe(0); expect(course.inverts.length % 2).toBe(0); }
  });

  it('the dosage per planet: reversals and tempo gates from the second on, mirror and upside-down gates on the third and fourth, none of it on the first', () => {
    // (corrected 2026-11-25: what the player already knows stays in play on the first planet too; it has spikes and a
    // speed gate, taught in the first stage, but no mirror or upside-down gates yet)
    const h = of('heroes').course;
    expect([h.mirrors.length, h.inverts.length]).toEqual([0, 0]);
    for (const id of ['skyhigh', 'blank', 'invincible']) {
      const { course } = of(id);
      expect(course.turns.length, `${id}: reversals`).toBeGreaterThanOrEqual(3);
      expect(course.portals.length, `${id}: tempo gates`).toBeGreaterThanOrEqual(4);
      expect(course.firsts.some((f) => f.what === 'reverse'), `${id}: a hint for the first reversal`).toBe(true);
    }
    expect(of('skyhigh').course.mirrors.length + of('skyhigh').course.inverts.length).toBe(0);
    for (const id of ['blank', 'invincible']) {
      const { course, pack } = of(id);
      expect(course.mirrors.length, `${id}: mirror gates`).toBeGreaterThanOrEqual(2);
      expect(course.inverts.length, `${id}: upside-down gates`).toBeGreaterThanOrEqual(2);
      expect(course.firsts.some((f) => f.what === 'invert')).toBe(true);
      // an upside-down gate stands on a bar line and the first press after it is wide, like any gate's
      for (const g of course.inverts) {
        expect(g % 4).toBe(0);
        const p = course.presses.find((x) => x.beat >= g - 1e-6 && x.beat < g + 4);
        if (p && !p.auto) expect(p.wide || p.after || p.smash, `${pack.level.id}: first press after the upside-down gate at ${g}`).toBe(true);
      }
    }
  });

  it('a gate is in view beforehand and then snaps: the orbit turns and changes speed on the bar line itself, with no easing', () => {
    for (const { course, pack } of built) {
      const rate = (b: number) => (course.angle(b + 0.01) - course.angle(b)) / 0.01;
      for (const g of [...course.turns, ...course.portals.map((x) => x.beat)]) {
        const before = rate(g - 0.02), justBefore = rate(g - 0.3), after = rate(g + 0.001), later = rate(g + 0.3);
        expect(before, `${pack.level.id}: no slowing into the gate at ${g}`).toBeCloseTo(justBefore, 6);
        expect(after, `${pack.level.id}: full speed straight after the gate at ${g}`).toBeCloseTo(later, 6);
        expect(Math.abs(after - before)).toBeGreaterThan(0.05);
        expect(course.angle(g + 1e-6), 'the ball itself never jumps').toBeCloseTo(course.angle(g - 1e-6), 4);
      }
      for (const g of course.turns) expect(Math.sign(rate(g - 0.1))).toBe(-Math.sign(rate(g + 0.1)));
    }
  });

  it('pads are tapped: a spring pad throws the ball to the next planet, a tide pad turns gravity over, and missing either ends the run', () => {
    // (spring pads were on the first planet; the next pass leaves Emberwick to its one idea, and they wait for a later world)
    expect(of('heroes').course.presses.some((p) => p.pad === 'spring' || p.pad === 'tide')).toBe(false); // (Ossa's hammer launches are jump pads, on the same planet)
    const tide = of('skyhigh').course.presses.filter((p) => p.pad === 'tide');
    expect(tide.length).toBeGreaterThanOrEqual(3);
    for (const p of tide) { expect(p.auto).toBe(false); expect(p.kind).toBe('flip'); }
    // nothing but a form's introduction, the launch into a drop and the run-in is ever played for the player
    for (const { course } of built) expect(course.presses.filter((p) => p.auto && !p.intro && !p.smash).every((p) => !p.pad)).toBe(true);
    for (const [id, pad] of [['skyhigh', 'tide']] as const) {
      const { course } = of(id);
      const p = course.presses.find((x) => x.pad === pad)!;
      const skipped = course.script.filter(([t]) => Math.abs(t - p.beat) > 1e-6 && !(t > p.beat && t < p.beat + 0.3));
      const sim = play(course, skipped.filter(([t]) => t < p.beat + 2), p.beat + 2);
      expect(sim.crashed, `${id}: riding over the ${pad} pad without a tap`).toBe(true);
      expect(play(course, course.script.filter(([t]) => t < p.beat + 2), p.beat + 2).crashed).toBe(false);
    }
  });

  it('orbs are tapped in mid-air, exactly where the hop before ends: a jump orb hops again, a dash orb carries for a beat, a gravity orb turns gravity over', () => {
    for (const { course, pack } of built) for (const p of course.presses) {
      const where = `${pack.level.id} at ${p.beat}`;
      if (!p.orb) { if (!p.slip) expect(p.chime, where).toBe(false); continue; }
      const before = course.presses[p.i - 1];
      expect(p.auto, where).toBe(false);
      expect(p.chime, where).toBe(true);
      expect(before.land, where).toBe(p.beat);
      expect(before.to, where).toBe(p.from);
      expect(p.form === 'orb' && p.twin === null && !p.spin && !p.sling, where).toBe(true);
      if (p.orb === 'dash') { expect(p.slip, where).toBe(true); expect(p.land - p.beat, where).toBe(SLIP_FLIGHT); expect(Math.abs(p.to - p.from), where).toBeCloseTo(2, 9); expect(p.line, where).toBe(true); }
      if (p.orb === 'grav') expect(p.kind, where).toBe('flip');
      if (p.orb === 'jump' && !p.leap) { expect(p.slip, where).toBe(false); expect(Math.abs(p.to - p.from), where).toBeGreaterThan(0.5); } // (an ember in a leap carries the flight on: it does not climb)
    }
    for (const p of of('invincible').course.presses.filter((x) => x.slip)) { expect(p.land - p.beat).toBe(SLIP_FLIGHT); expect(p.line).toBe(true); }
    // a gravity orb turns gravity over for the rest of its bar: the next press in that bar leaves from the other side
    for (const { course } of built) for (const p of course.presses.filter((x) => x.orb === 'grav')) {
      const next = course.presses[p.i + 1];
      if (next && Math.floor(next.beat / 4 + 1e-6) === Math.floor(p.beat / 4 + 1e-6)) { expect(next.side).toBe(-p.side); if (next.form === 'orb' && !next.weave && next.orb !== 'grav') expect(next.kind).toBe('hop'); }
    }
    // missing an orb ends the run like any missed mark; tapping it early is held until the ball arrives
    const sky = of('skyhigh').course;
    const orb = sky.presses.find((p) => p.orb === 'jump')!;
    expect(play(sky, sky.script.filter(([t]) => t < orb.beat - 0.3), orb.beat + 1.5).crashed).toBe(true);
    const early = sky.script.filter(([t]) => t < orb.beat + 1).map(([t, d]): [number, boolean] => [Math.abs(t - orb.beat) < 1e-6 ? t - orb.tol * 0.8 : t, d]).sort((x, y) => x[0] - y[0]);
    expect(play(sky, early, orb.beat + 0.9).crashed).toBe(false);
    // the first planet has no orbs at all; the gravity orb waits for the third
    // (the owner's table, 2026-11-25: jump orbs and jump pads from the first stage on; dash and gravity orbs come later)
    expect(of('heroes').course.presses.some((p) => p.slip || p.orb === 'dash' || p.orb === 'grav')).toBe(false);
    expect(of('skyhigh').course.presses.some((p) => p.orb === 'grav')).toBe(false);
    for (const id of ['blank', 'invincible']) expect(of(id).course.presses.filter((p) => p.orb === 'grav').length, id).toBeGreaterThanOrEqual(3);
    for (const id of ['skyhigh', 'blank', 'invincible']) for (const kind of ['jump', 'dash'] as const) expect(of(id).course.presses.filter((p) => p.orb === kind).length, `${id}: ${kind} orbs`).toBeGreaterThanOrEqual(3);
  });

  it('combos: from the second planet on, every level chains orbs on consecutive notes of the music, and its longest chain is in the drop', () => {
    const combos = (c: (typeof built)[number]['course']) => {
      const out: Array<{ beat: number; kinds: string[] }> = [];
      for (let i = 0; i < c.presses.length; i++) {
        if (!c.presses[i].orb) continue;
        let j = i; while (j + 1 < c.presses.length && c.presses[j + 1].orb) j++;
        if (j > i) out.push({ beat: c.presses[i].beat, kinds: c.presses.slice(i, j + 1).map((p) => p.orb) });
        i = j;
      }
      return out;
    };
    expect(combos(of('heroes').course).every((c) => c.kinds.every((k) => k === 'jump'))).toBe(true); // (the first planet: jump orbs only)
    const longest: number[] = [];
    for (const id of ['skyhigh', 'blank', 'invincible']) {
      const { course } = of(id);
      const all = combos(course);
      expect(all.length, `${id}: combos`).toBeGreaterThanOrEqual(3);
      const inDrop = all.filter((x) => x.beat >= course.dropBeat);
      expect(inDrop.length, `${id}: combos in the drop`).toBeGreaterThanOrEqual(2);
      const best = Math.max(...all.map((x) => x.kinds.length));
      expect(Math.max(...inDrop.map((x) => x.kinds.length)), `${id}: the longest is in the drop`).toBe(best);
      longest.push(best);
      // a combo is hop, orb, orb (, orb): each orb a beat or less after the one before, each on a note of the music
      for (const x of all) { const i = course.presses.findIndex((p) => p.beat === x.beat); for (let k = 0; k < x.kinds.length; k++) expect(course.presses[i + k].beat - course.presses[i + k - 1].beat).toBeLessThanOrEqual(2); expect(course.presses[i - 1].orb, 'it starts with a hop from the ring').toBe(''); }
      expect(all.some((x) => x.kinds[0] === 'jump' && x.kinds[1] === 'dash'), `${id}: hop, jump orb, dash orb`).toBe(true);
      expect(course.firsts.some((f) => f.what === 'combo')).toBe(true);
    }
    expect(longest[1]).toBeGreaterThanOrEqual(3); // the third and fourth planets chain three orbs
    expect(longest[2]).toBeGreaterThanOrEqual(3);
  });
});
