import { describe, expect, it } from 'vitest';
import { PACKS } from '../src/game/packs';
import { Level } from '../src/game/level';
import { SmoothClock } from '../src/gd/clock';
import { autoLayers, buildCourse, TOL_S } from '../src/gd/course';
import { layerTicks, layers, pitchLookup } from '../src/gd/presses';
import { Sim } from '../src/gd/sim';

const pack = PACKS.find((p) => p.level.id === 'skyhigh')!;
const level = new Level(pack.level, pack.audio, pack.chart);
const course = buildCourse(level, layers(pack), pitchLookup(pack), pack.level.lab);
const ms = (x: number) => x / 1000 / course.spb; // milliseconds as beats
const rng = (seed: number) => { let s = seed; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 - 0.5; }; };
const pressBeats = course.presses.map((p) => p.beat);
const [c0, c1] = course.charges[0];

/** Plays the lab with taps at the given beat-times, stepping like 60 fps frames. */
function run(taps: number[], start = course.start - 3, until = course.end) {
  const sim = new Sim(course, start);
  let i = 0;
  while (i < taps.length && taps[i] < start) i++;
  for (let b = start; b < until && !sim.crashed; b += 1 / 60 / course.spb) {
    while (i < taps.length && taps[i] <= b) sim.press(taps[i++]);
    sim.advance(b);
  }
  return sim;
}
const spam = (from: number, rate: number, phase = 0, to = course.end) => {
  const out: number[] = [];
  for (let b = from + phase / rate / course.spb; b < to; b += 1 / rate / course.spb) out.push(b);
  return out;
};

describe('sky high feel lab: two layers of notes', () => {
  it('autoplay clears it in full flow, with a full charge and the full drop', () => {
    const s = run(course.taps);
    console.log(`LAB BOT: beats ${course.start}-${course.end}: ${course.presses.length} survival presses (${course.presses.filter((p) => p.auto).length} taken by the game, ${course.presses.filter((p) => p.kind === 'flip').length} gravity flip), ${course.flow.length} flow notes (${course.chargeNotes} of them charge the drop); cleared, flow ${s.flow.toFixed(2)}, on the beat ${s.onBeat}/${s.judged}, charge ${s.charge.toFixed(2)}`);
    expect(s.crashed).toBe(false);
    expect(s.onBeat).toBe(course.taps.length);
    expect(s.flow).toBe(1);
    expect(s.charge).toBe(1);
    expect(s.muffle).toBe(0);
  });

  it('survival presses are strong beats only: never closer than a beat (2.1 a second here), with openings of ±120 ms', () => {
    const gaps = pressBeats.slice(1).map((b, i) => b - pressBeats[i]);
    const tol = course.presses.map((p) => p.tol * course.spb * 1000);
    console.log(`LAB PRESSES: closest pair ${Math.min(...gaps)} beats (${(1 / (Math.min(...gaps) * course.spb)).toFixed(1)} a second), openings ±${Math.min(...tol).toFixed(0)} to ±${Math.max(...tol).toFixed(0)} ms`);
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(1);
    expect(Math.min(...tol)).toBeCloseTo(TOL_S * 1000, 3);
  });

  it('every note of the chart is in exactly one layer, and every flight lands on the next press or within two beats', () => {
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

  it('nothing can crash in the build-up: from the last press before the roll to the launch into the drop there is no survival press', () => {
    expect(course.presses.filter((p) => p.beat >= c0 && p.beat < c1 && !p.auto)).toEqual([]);
    expect(course.presses.find((p) => p.beat === course.dropBeat)?.auto).toBe(true);
    const before = pressBeats.filter((b) => b < c0);
    // perfect up to the roll, then: no taps at all / mashing at 6, 10 and 14 a second / only off-beat taps
    for (const taps of [before, ...[6, 10, 14].map((r) => [...before, ...spam(c0, r, 0, course.dropBeat + 0.5)]), [...before, ...course.flow.filter((f) => f.charge).map((f) => f.beat + 0.2)]]) {
      const s = run(taps, course.start - 3, course.dropBeat + 0.6);
      expect(s.crashed, `${taps.length - before.length} taps in the roll`).toBe(false);
    }
  });

  it('the roll charges the drop: no taps leaves it empty, three notes in four fills it, a bit of spam is fine', () => {
    const before = pressBeats.filter((b) => b < c0);
    const roll = course.flow.filter((f) => f.charge).map((f) => f.beat);
    const charge = (taps: number[]) => run([...before, ...taps].sort((a, b) => a - b), course.start - 3, course.dropBeat).charge;
    expect(charge([])).toBe(0);
    expect(charge(roll.filter((_, i) => i % 2 === 0))).toBeGreaterThan(0.6);
    expect(charge(roll.filter((_, i) => i % 2 === 0))).toBeLessThan(0.75);
    expect(charge(roll.filter((_, i) => i % 4 !== 3))).toBe(1);
    expect(charge(roll.map((b) => b + ms(50)))).toBe(1); // touching the notes charges even when not dead on
    expect(charge([...roll, ...roll.map((b) => b + 0.25)].sort((a, b) => a - b))).toBeGreaterThan(0.6); // doubling the roll leaks some
    const mash = run([...before, ...spam(c0, 10, 0, course.dropBeat)], course.start - 3, course.dropBeat);
    console.log(`LAB CHARGE: half the roll ${charge(roll.filter((_, i) => i % 2 === 0)).toFixed(2)}, mashing 10 a second ${mash.charge.toFixed(2)} with flow ${mash.flow.toFixed(2)}`);
    expect(mash.charge).toBeGreaterThan(0.2);
    expect(mash.charge).toBeLessThan(0.8); // mashing is safe here but does not earn the full drop
  });

  it('flow notes can never hurt: skipping them all clears, and so does tapping them all 60 ms early, 60 ms late or 150 ms off', () => {
    const only = run(pressBeats);
    expect(only.crashed).toBe(false);
    expect(only.flow).toBeGreaterThan(0.5);
    for (const off of [-150, -60, 60, 150]) {
      const taps = [...pressBeats, ...course.flow.map((f) => f.beat + ms(off))].sort((a, b) => a - b);
      expect(run(taps).crashed, `flow notes ${off} ms off`).toBe(false);
    }
  });

  it('survival is forgiving: every tap 100 ms early or late still clears', () => {
    for (const off of [-100, -70, 70, 100]) {
      const s = run(course.taps.map((b) => b + ms(off)));
      expect(s.crashed, `${off} ms: ${s.crashKind} at ${s.crashBeat.toFixed(2)}`).toBe(false);
      expect(s.flow, `${off} ms`).toBeLessThan(0.2);
    }
  });

  it('uneven timing clears: presses randomly up to 100 ms off, or every tap (flow notes too) up to 45 ms off', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const rnd = rng(seed);
      const a = run(pressBeats.map((b) => b + ms(rnd() * 200)));
      expect(a.crashed, `presses, seed ${seed}: ${a.crashKind} at beat ${a.crashBeat.toFixed(2)}`).toBe(false);
      const b = run(course.taps.map((t) => t + ms(rnd() * 90)));
      expect(b.crashed, `all taps, seed ${seed}: ${b.crashKind} at beat ${b.crashBeat.toFixed(2)}`).toBe(false);
    }
  });

  it('but the openings are real: 150 ms off on every press crashes, and so does doing nothing', () => {
    expect(run(pressBeats.map((b) => b + ms(150))).crashKind).toBe('edge');
    expect(run(pressBeats.map((b) => b - ms(150))).crashKind).toBe('early');
    const idle = run([]);
    expect(idle.crashKind).toBe('edge');
    expect(idle.crashBeat).toBeLessThan(course.presses[0].beat + 1);
  });

  it('a tap aimed at a flow note just before a press is credited to the flow note, and the press is still made', () => {
    const pair = course.flow.find((f) => course.presses.some((p) => !p.auto && p.beat - f.beat > 0 && p.beat - f.beat <= 0.26));
    expect(pair).toBeTruthy();
    const s = run(course.taps);
    expect(s.onBeat).toBe(course.taps.length); // the bot taps both, both count
  });

  it('the muffle starts on the third off-beat press in a row, deepens a step at a time, and two on-beat taps clear it', () => {
    const sim = new Sim(course, course.start - 3);
    const seen: number[] = [];
    course.presses.slice(0, 10).forEach((p, k) => { sim.press(p.beat + (k < 6 ? ms(80) : 0)); seen.push(Number(sim.muffle.toFixed(2))); });
    expect(seen).toEqual([0, 0, 0.2, 0.4, 0.6, 0.8, 0.3, 0, 0, 0]);
    expect(sim.crashed).toBe(false);
  });

  for (const rate of [8, 10, 12]) {
    it(`mashing ${rate} taps a second does not carry you through the survival parts: within two bars from any of their starts`, () => {
      let worst = 0;
      for (const cp of course.checkpoints.filter((b) => !course.inCharge(b))) for (const phase of [0, 0.25, 0.5, 0.75]) {
        const s = run([...course.taps.filter((b) => b < cp), ...spam(cp, rate, phase)]);
        expect(s.crashed, `from beat ${cp}`).toBe(true);
        worst = Math.max(worst, s.crashBeat - cp);
      }
      // and mashing through the roll is allowed, but it ends soon after the launch into the drop
      const after = run([...course.taps.filter((b) => b < c0), ...spam(c0, rate)]);
      expect(after.crashed).toBe(true);
      expect(after.crashBeat).toBeGreaterThan(course.dropBeat);
      worst = Math.max(worst, after.crashBeat - course.dropBeat);
      console.log(`LAB SPAM ${rate}/s: longest survival in a survival part ${worst.toFixed(1)} beats`);
      expect(worst).toBeLessThanOrEqual(8);
    });
  }

  it('practice run-in: the game plays the notes before the checkpoint and hands over on it', () => {
    const cp = course.checkpoints[0] + 8;
    const sim = new Sim(course, cp - 3.2, cp);
    sim.advance(cp - 0.01);
    expect(sim.crashed).toBe(false);
    expect(sim.judged).toBe(0);
    expect(sim.out.every((o) => o.auto)).toBe(true);
    sim.advance(cp + 2);
    expect(sim.crashed).toBe(true); // nobody tapped after the handover
  });

  it('starting at the build-up or later does not hold the drop back', () => {
    expect(new Sim(course, c0 - 3.2, c0).charge).toBe(0); // from the top of the roll you charge it yourself
    expect(new Sim(course, course.dropBeat - 3.2, course.dropBeat).charge).toBe(1);
  });
});

describe('note layers', () => {
  it('generated notes: presses on the beat first, then off-beat accents with room round them; the rest are flow notes', () => {
    const l = autoLayers([0, 0.25, 0.5, 0.75, 1.25, 2.25, 2.75, 3.5, 4]);
    expect(l.survival).toEqual([0, 1.25, 2.25, 4]);
    expect(l.flow).toEqual([0.25, 0.5, 0.75, 2.75, 3.5]);
  });

  it('hand-recorded bars replace the chart for those bars only, keeping each note in the layer it was recorded in', () => {
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
