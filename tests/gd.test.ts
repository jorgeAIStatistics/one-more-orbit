import { describe, expect, it } from 'vitest';
import { PACKS } from '../src/game/packs';
import { Level } from '../src/game/level';
import { SmoothClock } from '../src/gd/clock';
import { buildCourse, TOL_S } from '../src/gd/course';
import { pitchLookup, pressTicks } from '../src/gd/presses';
import { Sim } from '../src/gd/sim';

const pack = PACKS.find((p) => p.level.id === 'skyhigh')!;
const level = new Level(pack.level, pack.audio, pack.chart);
const course = buildCourse(level, pack.chart.notes.map((n) => n.t / 12), pitchLookup(pack), pack.level.lab);
const ms = (x: number) => x / 1000 / course.spb; // milliseconds as beats
const rng = (seed: number) => { let s = seed; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 - 0.5; }; };

/** Plays the lab with taps at the given beat-times, stepping like 60 fps frames. */
function run(taps: number[], start = course.start - 3) {
  const sim = new Sim(course, start);
  let i = 0;
  while (i < taps.length && taps[i] < start) i++;
  for (let b = start; b < course.end && !sim.crashed; b += 1 / 60 / course.spb) {
    while (i < taps.length && taps[i] <= b) sim.press(taps[i++]);
    sim.advance(b);
  }
  return sim;
}

describe('sky high feel lab: ring-hop core', () => {
  it('autoplay clears it in full flow', () => {
    const s = run(course.taps);
    console.log(`LAB BOT: beats ${course.start}-${course.end}, ${course.presses.length} ring hops (${course.presses.filter((p) => p.kind === 'flip').length} gravity flip), ${course.orbs.length} orbs; cleared, flow ${s.flow.toFixed(2)}, on the beat ${s.onBeat}/${s.judged}, best streak ${s.bestStreak}`);
    expect(s.crashed).toBe(false);
    expect(s.ni).toBe(course.presses.length);
    expect(s.onBeat).toBe(course.taps.length);
    expect(s.flow).toBe(1);
    expect(s.muffle).toBe(0);
  });

  it('the tap moment is the music: every press and orb is a note of the chart, and every flight lands on the next press or within two beats', () => {
    const notes = new Set(pack.chart.notes.map((n) => (n.t / 12).toFixed(3)));
    for (const b of course.taps) expect(notes.has(b.toFixed(3))).toBe(true);
    course.presses.forEach((p, i) => {
      const next = course.presses[i + 1];
      expect(p.land - p.beat).toBeLessThanOrEqual(2 + 1e-9);
      if (next && next.beat - p.beat <= 2) expect(p.land).toBe(next.beat);
    });
  });

  it('openings are generous: about ±120 ms, never under ±100 ms in this lab', () => {
    const tol = course.presses.map((p) => p.tol * course.spb * 1000);
    console.log(`LAB OPENINGS: ±${Math.min(...tol).toFixed(0)} to ±${Math.max(...tol).toFixed(0)} ms`);
    expect(Math.max(...tol)).toBeCloseTo(TOL_S * 1000, 3);
    expect(Math.min(...tol)).toBeGreaterThanOrEqual(100);
  });

  it('survival is forgiving: every tap 100 ms early or late still clears, with no flow', () => {
    for (const off of [-100, -70, 70, 100]) {
      const s = run(course.taps.map((b) => b + ms(off)));
      expect(s.crashed, `${off} ms`).toBe(false);
      expect(s.flow, `${off} ms`).toBe(0);
    }
  });

  it('uneven timing clears: ring hops randomly up to 90 ms off, or every tap (orbs too) up to 45 ms off', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const rnd = rng(seed);
      const a = run(course.presses.map((p) => p.beat + ms(rnd() * 180)));
      expect(a.crashed, `hops, seed ${seed}: ${a.crashKind} at beat ${a.crashBeat.toFixed(2)}`).toBe(false);
      const b = run(course.taps.map((t) => t + ms(rnd() * 90)));
      expect(b.crashed, `all taps, seed ${seed}: ${b.crashKind} at beat ${b.crashBeat.toFixed(2)}`).toBe(false);
    }
  });

  it('but the openings are real: 150 ms off on every tap crashes, and so does doing nothing', () => {
    expect(run(course.taps.map((b) => b + ms(150))).crashKind).toBe('edge');
    expect(run(course.taps.map((b) => b - ms(150))).crashKind).toBe('early');
    const idle = run([]);
    expect(idle.crashKind).toBe('edge');
    expect(idle.crashBeat).toBeLessThan(course.presses[0].beat + 1);
  });

  it('taps away from any opening are free; orbs are optional', () => {
    const quiet = course.presses.findIndex((p, i) => i > 0 && p.beat - course.presses[i - 1].land >= 1.2);
    expect(quiet).toBeGreaterThan(0);
    const stray = course.presses[quiet].beat - 0.9;
    expect(run([...course.taps, stray].sort((a, b) => a - b)).crashed).toBe(false);
    const noOrbs = run(course.presses.map((p) => p.beat));
    expect(noOrbs.crashed).toBe(false);
    expect(noOrbs.flow).toBe(1);
  });

  it('the muffle starts on the third off-beat tap in a row, deepens a step at a time, and two on-beat taps clear it', () => {
    const sim = new Sim(course, course.start - 3);
    const seen: number[] = [];
    course.presses.slice(0, 10).forEach((p, k) => { sim.press(p.beat + (k < 6 ? ms(80) : 0)); seen.push(Number(sim.muffle.toFixed(2))); });
    expect(seen).toEqual([0, 0, 0.2, 0.4, 0.6, 0.8, 0.3, 0, 0, 0]);
    expect(sim.crashed).toBe(false);
  });

  for (const rate of [8, 10, 12]) {
    it(`mashing ${rate} taps a second fails: from the start and from every section start, within two bars`, () => {
      let worst = 0;
      for (const cp of course.checkpoints) for (const phase of [0, 0.25, 0.5, 0.75]) {
        const taps = course.taps.filter((b) => b < cp);
        for (let b = cp + phase / rate / course.spb; b < course.end; b += 1 / rate / course.spb) taps.push(b);
        const s = run(taps);
        expect(s.crashed, `from beat ${cp}`).toBe(true);
        worst = Math.max(worst, s.crashBeat - cp);
      }
      console.log(`LAB SPAM ${rate}/s: longest survival from any section start ${worst.toFixed(1)} beats`);
      expect(worst).toBeLessThanOrEqual(8);
    });
  }

  it('practice run-in: the game plays the notes before the checkpoint and hands over on it', () => {
    const cp = course.checkpoints[2];
    const sim = new Sim(course, cp - 3.2, cp);
    sim.advance(cp - 0.01);
    expect(sim.crashed).toBe(false);
    expect(sim.judged).toBe(0);
    expect(sim.out.every((o) => o.auto)).toBe(true);
    sim.advance(cp + 2);
    expect(sim.crashed).toBe(true); // nobody tapped after the handover
  });

  it('repeated music gives repeated presses: the two drop phrases match note for note', () => {
    const shape = (b0: number) => course.taps.filter((b) => b >= b0 && b < b0 + 16).map((b) => (b - b0).toFixed(2));
    const a = shape(100);
    const b = shape(116);
    const same = a.filter((x) => b.includes(x)).length;
    expect(same / Math.max(a.length, b.length)).toBeGreaterThan(0.85);
  });

  it('hand-recorded bars replace the chart for those bars only', () => {
    const base = pressTicks(pack);
    const fake = { ...pack, level: { ...pack.level, id: 'skyhigh-test' }, presses: { bars: { '16': { by: 'hand' as const, t: [0, 24] } } } };
    const ticks = pressTicks(fake);
    expect(ticks.filter((t) => t >= 16 * 48 && t < 17 * 48)).toEqual([16 * 48, 16 * 48 + 24]);
    expect(ticks.filter((t) => t < 16 * 48)).toEqual(base.filter((t) => t < 16 * 48));
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
