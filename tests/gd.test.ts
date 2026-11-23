import { describe, expect, it } from 'vitest';
import { PACKS } from '../src/game/packs';
import { Level } from '../src/game/level';
import { SmoothClock } from '../src/gd/clock';
import { Sim } from '../src/gd/sim';
import { buildTrack } from '../src/gd/track';

const pack = PACKS.find((p) => p.level.id === 'heroes')!;
const level = new Level(pack.level, pack.audio, pack.chart);
const track = buildTrack(level);
const ms = (x: number) => x / 1000 / track.spb; // milliseconds as beats

/** Runs the level with taps at the given beat-times, stepping like 60 fps frames. Returns how far it got (0..1). */
function run(taps: number[], start = -2) {
  const sim = new Sim(track, start);
  let i = 0;
  while (i < taps.length && taps[i] < start) i++;
  for (let b = start; b < track.endBeat && !sim.crashed; b += 1 / 60 / track.spb) {
    while (i < taps.length && taps[i] <= b) sim.press(taps[i++]);
    sim.advance(b);
  }
  return { crashed: sim.crashed, at: sim.crashBeat, kind: sim.crashKind, pct: Math.min(1, (sim.crashed ? sim.crashBeat : track.endBeat) / track.endBeat), jumps: sim.jumps, pads: sim.padsHit };
}
const rng = (seed: number) => { let s = seed; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 - 0.5; }; };

describe('heroes: Geometry Dash-style core', () => {
  it('the autoplay bot clears the level', () => {
    const r = run(track.presses);
    const n = (k: string) => track.hazards.filter((h) => h.kind === k).length;
    console.log(`GD BOT heroes: ${track.presses.length} taps (${track.orbs.length} on jump orbs), ${n('spike')} spikes, ${n('bar')} overhead bars, ${track.pads.length} launch pads, cleared ${(r.pct * 100).toFixed(0)}%`);
    expect(r.crashed).toBe(false);
    expect(r.jumps).toBe(track.presses.length);
    expect(r.pads).toBe(track.pads.length);
  });

  it('timing is forgiving: every tap up to 80 ms early or late still clears it', () => {
    for (const off of [-80, -60, -30, 30, 60, 80]) expect(run(track.presses.map((b) => b + ms(off))).crashed, `${off} ms`).toBe(false);
  });

  it('uneven timing clears too: each tap randomly up to 60 ms early or late', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const rnd = rng(seed);
      const r = run(track.presses.map((b) => b + ms(rnd() * 120)));
      expect(r.crashed, `seed ${seed}: ${r.kind} at beat ${r.at.toFixed(2)}`).toBe(false);
    }
  });

  it('but not everything goes: 130 ms late on every tap crashes', () => {
    expect(run(track.presses.map((b) => b + ms(130))).crashed).toBe(true);
    expect(run(track.presses.map((b) => b - ms(130))).crashed).toBe(true);
  });

  it('doing nothing crashes on the first spike', () => {
    const r = run([]);
    expect(r.crashed).toBe(true);
    expect(r.kind).toBe('spike');
    expect(r.pct).toBeLessThan(0.05);
  });

  for (const rate of [8, 10, 12]) {
    it(`spamming ${rate} taps a second crashes early`, () => {
      const taps: number[] = [];
      for (let t = 0.02; t < level.endTime; t += 1 / rate) taps.push(t / track.spb);
      const r = run(taps);
      console.log(`GD SPAM heroes ${rate}/s from the start: crashed at ${(r.pct * 100).toFixed(1)}% (${r.kind})`);
      expect(r.crashed).toBe(true);
      expect(r.pct).toBeLessThan(0.05);
    });
  }

  it('mashing never carries you: play perfectly to any section, start spamming, and you crash within two bars', () => {
    let worst = 0;
    for (const cp of track.checkpoints) {
      if (cp > level.totalBeats - 12) continue; // the last phrase is the run home
      for (const rate of [8, 10, 12]) for (const phase of [0, 0.33, 0.66]) {
        const taps = track.presses.filter((b) => b < cp);
        for (let b = cp + phase / rate / track.spb; b < track.endBeat; b += 1 / rate / track.spb) taps.push(b);
        const r = run(taps);
        expect(r.crashed, `from beat ${cp} at ${rate}/s`).toBe(true);
        worst = Math.max(worst, r.at - cp);
      }
    }
    console.log(`GD SPAM heroes from every section start: longest survival ${worst.toFixed(1)} beats`);
    expect(worst).toBeLessThanOrEqual(8.5);
  });

  it('a jump at the wrong moment is punished: one extra tap in the middle of any long flat stretch crashes', () => {
    for (const h of track.hazards.filter((x) => x.kind === 'bar' && x.b1 - x.b0 > 1.2)) {
      const stray = (h.b0 + h.b1) / 2 - 0.3;
      expect(run([...track.presses, stray].sort((a, b) => a - b)).crashed, `bar ${h.b0.toFixed(1)}`).toBe(true);
    }
  });

  it('sync by design: every tap is on a note of the chart, every hop is one beat, pads sit on strong beats', () => {
    const beats = new Set(level.notes.map((n) => n.beat.toFixed(4)));
    for (const b of track.presses) expect(beats.has(b.toFixed(4))).toBe(true);
    for (const p of track.pads) expect(p.beat % 2).toBe(0);
    for (const h of track.hazards.filter((x) => x.kind === 'spike')) expect(h.b1 - h.b0).toBeGreaterThanOrEqual(0.29);
    for (const h of track.hazards) expect(h.b1).toBeGreaterThan(h.b0);
  });

  it('repeated music gets identical obstacles (the four drop phrases match, apart from the jump orbs in the last)', () => {
    const shape = (b0: number) => track.presses.filter((b) => b >= b0 && b < b0 + 16).map((b) => (b - b0).toFixed(2)).filter((x) => x !== '1.50').join(' ');
    expect(shape(80)).toBe(shape(64));
    expect(shape(96)).toBe(shape(64));
    expect(shape(112)).toBe(shape(64));
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
      const dt = 16.667 + rnd() * 3 + (f % 97 === 0 ? 17 : 0); // uneven frames and a dropped frame now and then
      now += dt;
      const real = (now - 1000) / 1000;
      const audio = Math.floor(real / 0.0107) * 0.0107 + (f % 53 === 0 ? 0.0017 : 0) + 0.004 * Math.sin(f / 200); // quantised, hitching, slowly wandering
      const t = clock.tick(now, audio);
      if (f > 0) worst = Math.max(worst, Math.abs((t - prev) * 1000 / dt - 1));
      if (f > 600) drift = Math.max(drift, Math.abs(t - real));
      prev = t;
    }
    console.log(`GD CLOCK: worst frame ${(worst * 100).toFixed(2)}% off real time, worst distance from the audio clock ${(drift * 1000).toFixed(1)} ms`);
    expect(worst).toBeLessThan(0.006);
    expect(drift).toBeLessThan(0.02);
  });
});
