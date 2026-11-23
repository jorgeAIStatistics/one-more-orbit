import { describe, expect, it } from 'vitest';
import { PACKS, SLICE } from '../src/game/packs';
import { Level } from '../src/game/level';
import { SmoothClock } from '../src/gd/clock';
import { autoLayers, buildCourse, TOL_S } from '../src/gd/course';
import { accentBeats, layerTicks, layers, pitchLookup } from '../src/gd/presses';
import { Sim } from '../src/gd/sim';

const rng = (seed: number) => { let s = seed; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 - 0.5; }; };

for (const pack of PACKS.filter((p) => SLICE.includes(p.level.id))) {
  const id = pack.level.id;
  const level = new Level(pack.level, pack.audio, pack.chart);
  const course = buildCourse(level, layers(pack), pitchLookup(pack), pack.level.lab, accentBeats(pack));
  const ms = (x: number) => x / 1000 / course.spb; // milliseconds as beats
  const pressBeats = course.presses.map((p) => p.beat);

  /** Plays the level with taps at the given beat-times, stepping like 60 fps frames. */
  const run = (taps: number[], start = course.start - 3, until = course.end) => {
    const sim = new Sim(course, start);
    let i = 0;
    while (i < taps.length && taps[i] < start) i++;
    for (let b = start; b < until && !sim.crashed; b += 1 / 60 / course.spb) {
      while (i < taps.length && taps[i] <= b) sim.press(taps[i++]);
      sim.advance(b);
    }
    return sim;
  };
  const spam = (from: number, rate: number, phase = 0, to = course.end) => {
    const out: number[] = [];
    for (let b = from + phase / rate / course.spb; b < to; b += 1 / rate / course.spb) out.push(b);
    return out;
  };

  describe(`${id}: ring-hop level`, () => {
    it('autoplay clears it in full flow, with a full charge and the full drop', () => {
      const s = run(course.taps);
      const secs = (course.end - course.start) * course.spb;
      const kinds = (k: string) => course.presses.filter((p) => (p as unknown as Record<string, unknown>)[k]).length;
      console.log(`LEVEL ${id}: ${secs.toFixed(0)} s at ${pack.audio.bpm} BPM, drop at ${(course.dropBeat * course.spb).toFixed(1)} s; ${course.presses.length} survival presses (${(course.presses.length / secs).toFixed(2)}/s; ${kinds('smash')} smash, ${kinds('accent')} accents, ${course.presses.filter((p) => p.kind === 'flip').length} flips, ${kinds('sling')} slingshots, ${course.presses.filter((p) => p.twin).length} in twin orbit), ${course.flow.length} flow notes (${course.chargeNotes} charge); turns ${course.turns.length}, speed changes ${course.portals.length}`);
      expect(s.crashed, `${s.crashKind} at ${s.crashBeat}`).toBe(false);
      expect(s.onBeat).toBe(course.taps.length);
      expect(s.flow).toBe(1);
      expect(s.charge).toBe(1);
      expect(s.muffle).toBe(0);
      expect(secs).toBeLessThanOrEqual(120);
    });

    it('survival presses are strong beats only: never closer than a beat and never faster than 2.5 a second, openings at least ±120 ms', () => {
      const gaps = pressBeats.slice(1).map((b, i) => b - pressBeats[i]);
      expect(Math.min(...gaps)).toBeGreaterThanOrEqual(1 - 1e-9);
      expect(1 / (Math.min(...gaps) * course.spb)).toBeLessThanOrEqual(2.5);
      for (const p of course.presses) expect(p.tol * course.spb).toBeGreaterThanOrEqual(TOL_S - 1e-9);
    });

    it('every note of the chart is played in exactly one layer; flights land on the next press or within two beats', () => {
      const chart = pack.chart.notes.map((n) => n.t / 12).filter((b) => b >= course.start && b < course.end - 0.5);
      const got = new Set(course.taps.map((b) => b.toFixed(3)));
      for (const b of chart) expect(got.has(b.toFixed(3)), `note ${b}`).toBe(true);
      expect(new Set(course.taps).size).toBe(course.taps.length);
      course.presses.forEach((p, i) => {
        const next = course.presses[i + 1];
        expect(p.land - p.beat).toBeLessThanOrEqual(2 + 1e-9);
        if (next && next.beat - p.beat <= 2) expect(p.land).toBe(next.beat);
      });
    });

    it('there is a charge before the drop, nothing in it can crash, and the drop opens with the smash', () => {
      expect(course.charges.length).toBeGreaterThanOrEqual(1);
      const [c0, c1] = course.charges[course.charges.length - 1];
      expect(c1).toBeCloseTo(course.dropBeat, 1);
      expect(course.presses.filter((p) => p.beat >= c0 && p.beat < c1)).toEqual([]);
      const smash = course.presses.find((p) => Math.abs(p.beat - course.dropBeat) < 0.01);
      expect(smash?.smash).toBe(true);
      expect(smash!.tol * course.spb).toBeGreaterThan(0.15);
      const before = pressBeats.filter((b) => b < c0);
      // perfect up to the roll, then: no taps at all / mashing at 6, 10 and 14 a second / only off-beat taps. All reach the drop.
      for (const taps of [before, ...[6, 10, 14].map((r) => [...before, ...spam(c0, r, 0, c1 - 0.5)]), [...before, ...course.flow.filter((f) => f.charge).map((f) => f.beat + 0.2)]]) {
        expect(run(taps, course.start - 3, c1 - 0.3).crashed, `${taps.length - before.length} taps in the roll`).toBe(false);
      }
      // and anyone still tapping along hits the smash without trying: mashing through it clears it
      expect(run([...before, ...spam(c0, 8, 0, c1 + 0.3)], course.start - 3, c1 + 0.5).crashed).toBe(false);
    });

    it('the roll charges the drop: no taps leaves it empty, three notes in four fills it, mashing does not', () => {
      const [c0, c1] = course.charges[0];
      const before = pressBeats.filter((b) => b < c0);
      const roll = course.flow.filter((f) => f.charge).map((f) => f.beat);
      const charge = (taps: number[]) => run([...before, ...taps].sort((a, b) => a - b), course.start - 3, c1 - 0.05).charge;
      expect(charge([])).toBe(0);
      expect(charge(roll.filter((_, i) => i % 4 !== 3))).toBeGreaterThan(0.95);
      expect(charge(spam(c0, 10, 0, c1))).toBeLessThan(0.85);
    });

    it('flow notes can never hurt: skipping them all clears, and so does tapping them all 60 or 150 ms early or late', () => {
      const only = run(pressBeats);
      expect(only.crashed).toBe(false);
      for (const off of [-150, -60, 60, 150]) {
        const taps = [...pressBeats, ...course.flow.map((f) => f.beat + ms(off))].sort((a, b) => a - b);
        const s = run(taps);
        expect(s.crashed, `flow notes ${off} ms off: ${s.crashKind} at ${s.crashBeat.toFixed(2)}`).toBe(false);
      }
    });

    it('survival is forgiving: every tap 100 ms early or late still clears; uneven timing clears', () => {
      for (const off of [-100, -70, 70, 100]) {
        const s = run(course.taps.map((b) => b + ms(off)));
        expect(s.crashed, `${off} ms: ${s.crashKind} at ${s.crashBeat.toFixed(2)}`).toBe(false);
      }
      for (let seed = 1; seed <= 25; seed++) {
        const rnd = rng(seed);
        const a = run(pressBeats.map((b) => b + ms(rnd() * 200)));
        expect(a.crashed, `presses, seed ${seed}: ${a.crashKind} at beat ${a.crashBeat.toFixed(2)}`).toBe(false);
        const b = run(course.taps.map((t) => t + ms(rnd() * 90)));
        expect(b.crashed, `all taps, seed ${seed}: ${b.crashKind} at beat ${b.crashBeat.toFixed(2)}`).toBe(false);
      }
    });

    it('but the openings are real: 180 ms off on every press crashes, and so does doing nothing', () => {
      expect(run(pressBeats.map((b) => b + ms(180))).crashKind).toBe('edge');
      expect(run(pressBeats.map((b) => b - ms(180))).crashed).toBe(true);
      const idle = run([]);
      expect(idle.crashKind).toBe('edge');
      expect(idle.crashBeat).toBeLessThan(course.presses[0].beat + 1);
    });

    it('mashing never pays: from any section start it either crashes within four presses or is left with no flow and muffled music', () => {
      let crashed = 0;
      let drained = 0;
      for (const rate of [10, 12, 14]) for (const cp of course.checkpoints.filter((b) => !course.inCharge(b))) for (const phase of [0, 0.5]) {
        if (!course.presses.some((p) => p.beat >= cp + 4)) continue; // the last bars are the run home
        const stop = Math.min(cp + 12, course.charges.find(([a]) => a > cp)?.[0] ?? Infinity, course.end);
        const s = run([...course.taps.filter((b) => b < cp), ...spam(cp, rate, phase, stop)], course.start - 3, stop);
        if (s.crashed && course.presses.filter((p) => p.beat >= cp && p.beat < s.crashBeat).length <= 4) { crashed++; continue; }
        drained++;
        expect(s.flow, `flow, from beat ${cp} at ${rate}/s`).toBeLessThanOrEqual(0.15);
        expect(s.muffle, `muffle, from beat ${cp} at ${rate}/s`).toBeGreaterThanOrEqual(0.8);
      }
      console.log(`SPAM ${id}: mashing from section starts crashed early ${crashed} times, was drained and muffled ${drained} times`);
    });

    it('practice run-in: the game plays the notes before a checkpoint and hands over on it', () => {
      const cp = course.checkpoints.find((b) => b > course.start + 4 && !course.inCharge(b) && course.presses.some((p) => p.beat >= b && p.beat < b + 4))!;
      const sim = new Sim(course, cp - 3.2, cp);
      sim.advance(cp - 0.01);
      expect(sim.crashed).toBe(false);
      expect(sim.judged).toBe(0);
      sim.advance(cp + 6);
      expect(sim.crashed).toBe(true); // nobody tapped after the handover
    });

    it('same music, same pattern: sections sharing a motif have the same presses and flow notes', () => {
      const shape = (s: { beat0: number; beat1: number }) => course.taps.filter((b) => b >= s.beat0 + 1.5 && b < s.beat1 - 0.5).map((b) => `${(b - s.beat0).toFixed(2)}${pressBeats.includes(b) ? 'S' : 'f'}`).join(' ');
      const groups = new Map<string, string[]>();
      for (const s of level.segments) if (s.motif && !s.core?.charge) groups.set(s.motif, [...(groups.get(s.motif) ?? []), shape(s)]);
      for (const [motif, shapes] of groups) {
        const most = Math.max(...[...new Set(shapes)].map((x) => shapes.filter((y) => y === x).length));
        expect(most / shapes.length, `motif ${motif}`).toBeGreaterThanOrEqual(0.5);
      }
    });
  });
}

describe('sky high: the muffle', () => {
  const pack = PACKS.find((p) => p.level.id === 'skyhigh')!;
  const level = new Level(pack.level, pack.audio, pack.chart);
  const course = buildCourse(level, layers(pack), pitchLookup(pack), pack.level.lab, accentBeats(pack));
  it('starts on the third off-beat press in a row, deepens a step at a time, and two on-beat taps clear it', () => {
    const sim = new Sim(course, course.start - 3);
    const seen: number[] = [];
    course.presses.slice(0, 10).forEach((p, k) => { sim.press(p.beat + (k < 6 ? 0.08 / course.spb : 0)); seen.push(Number(sim.muffle.toFixed(2))); });
    expect(seen).toEqual([0, 0, 0.2, 0.4, 0.6, 0.8, 0.3, 0, 0, 0]);
    expect(sim.crashed).toBe(false);
  });
  it('starting at the build-up or later does not hold the drop back', () => {
    const [c0] = course.charges[0];
    expect(new Sim(course, c0 - 3.2, c0).charge).toBe(0); // from the top of the roll you charge it yourself
    expect(new Sim(course, course.dropBeat - 3.2, course.dropBeat).charge).toBe(1);
  });
});

describe('note layers', () => {
  it('generated notes: accents first, then presses on the beat, then off-beat notes with room round them; the rest are flow notes', () => {
    const l = autoLayers([0, 0.25, 0.5, 0.75, 1.25, 2.25, 2.75, 3.5, 4]);
    expect(l.survival).toEqual([0, 1.25, 2.25, 4]);
    expect(l.flow).toEqual([0.25, 0.5, 0.75, 2.75, 3.5]);
    expect(autoLayers([0, 0.75, 1, 2], [0.75]).survival).toEqual([0.75, 2]);
  });

  it('hand-recorded bars replace the chart for those bars only, keeping each note in the layer it was recorded in', () => {
    const pack = PACKS.find((p) => p.level.id === 'skyhigh')!;
    const base = layerTicks(pack);
    const fake = { ...pack, level: { ...pack.level, id: 'skyhigh-test' }, presses: { bars: { '16': { by: 'hand' as const, t: [0, 24], f: [12, 18] } } } };
    const got = layerTicks(fake);
    const inBar = (a: number[]) => a.filter((t) => t >= 16 * 48 && t < 17 * 48).map((t) => t - 16 * 48);
    expect(inBar(got.survival)).toEqual([0, 24]);
    expect(inBar(got.flow)).toEqual([12, 18]);
    expect(got.survival.filter((t) => t < 16 * 48)).toEqual(base.survival.filter((t) => t < 16 * 48));
    expect(got.flow.filter((t) => t >= 17 * 48)).toEqual(base.flow.filter((t) => t >= 17 * 48));
  });
});

describe('smooth clock', () => {
  it('never steps: with a jittery page timer and an audio clock that hitches by 10%, every frame advances within 0.6% of real time', () => {
    const clock = new SmoothClock();
    const rnd = rng(5);
    let now = 1000;
    let worst = 0;
    let drift = 0;
    let prev = 0;
    for (let f = 0; f < 60 * 70; f++) {
      const dt = 16.667 + rnd() * 3 + (f % 97 === 0 ? 17 : 0);
      now += dt;
      const real = (now - 1000) / 1000;
      const audio = Math.floor(real / 0.0107) * 0.0107 + (f % 53 === 0 ? 0.0017 : 0) + 0.004 * Math.sin(f / 200);
      const t = clock.tick(now, audio);
      if (f > 0) worst = Math.max(worst, Math.abs((t - prev) * 1000 / dt - 1));
      if (f > 600) drift = Math.max(drift, Math.abs(t - real));
      prev = t;
    }
    expect(worst).toBeLessThan(0.006);
    expect(drift).toBeLessThan(0.02);
  });
});
