import { describe, expect, it } from 'vitest';
import { PACKS, SLICE } from '../src/game/packs';
import { Level } from '../src/game/level';
import { SmoothClock } from '../src/gd/clock';
import { autoLayers, buildCourse, HOLD_MAX, HOLD_MIN, landingGrace, LINE_TIGHT, SLING_FLIGHT, TOL_S } from '../src/gd/course';
import { accentBeats, layerTicks, layers, pitchLookup } from '../src/gd/presses';
import { Sim } from '../src/gd/sim';

const rng = (seed: number) => { let s = seed; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 - 0.5; }; };

for (const pack of PACKS.filter((p) => SLICE.includes(p.level.id))) {
  const id = pack.level.id;
  const level = new Level(pack.level, pack.audio, pack.chart);
  const course = buildCourse(level, layers(pack), pitchLookup(pack), pack.level.lab, accentBeats(pack));
  const ms = (x: number) => x / 1000 / course.spb; // milliseconds as beats
  const pressBeats = course.presses.map((p) => p.beat);

  /** Plays the level from a list of button moves ([beat, down?]), stepping like 60 fps frames. */
  const play = (moves: Array<[number, boolean]>, start = course.start - 3, until = course.end) => {
    const sim = new Sim(course, start);
    let i = 0;
    while (i < moves.length && moves[i][0] < start) i++;
    for (let b = start; b < until && !sim.crashed; b += 1 / 60 / course.spb) {
      while (i < moves.length && moves[i][0] <= b) { const [t, down] = moves[i++]; if (down) sim.press(t); else sim.release(t); }
      sim.advance(b);
    }
    return sim;
  };
  /** Quick taps at the given beat-times: each is let go a moment later (so no hold is ever held). */
  const run = (taps: number[], start = course.start - 3, until = course.end) =>
    play(taps.flatMap((t, i): Array<[number, boolean]> => [[t, true], [Math.min(t + 0.12, i + 1 < taps.length ? Math.max(t, taps[i + 1] - 0.02) : t + 0.12), false]]), start, until);
  const spam = (from: number, rate: number, phase = 0, to = course.end) => {
    const out: number[] = [];
    for (let b = from + phase / rate / course.spb; b < to; b += 1 / rate / course.spb) out.push(b);
    return out;
  };

  describe(`${id}: ring-hop level`, () => {
    it('autoplay clears it in full flow, with a full charge and the full drop', () => {
      const s = play(course.script);
      const secs = (course.end - course.start) * course.spb;
      const kinds = (k: string) => course.presses.filter((p) => (p as unknown as Record<string, unknown>)[k]).length;
      console.log(`LEVEL ${id}: ${secs.toFixed(0)} s at ${pack.audio.bpm} BPM, drop at ${(course.dropBeat * course.spb).toFixed(1)} s; ${course.presses.length} survival presses (${(course.presses.length / secs).toFixed(2)}/s; ${kinds('smash')} smash, ${kinds('accent')} accents, ${kinds('sling')} planet hops, ${kinds('weave')} weave, ${course.presses.filter((p) => p.kind === 'flip' && !p.weave).length} other flips, ${kinds('spin')} spin gates, ${course.presses.filter((p) => p.twin).length} twin), ${course.flow.length} flow notes (${course.chargeNotes} charge); turns ${course.turns.length}, speed changes ${course.portals.length}, planets ${course.presses[course.presses.length - 1].planetTo + 1}`);
      expect(s.crashed, `${s.crashKind} at ${s.crashBeat}`).toBe(false);
      expect(s.onBeat).toBe(course.taps.length + course.holds.length); // every tap, and every hold let go on its end
      expect(s.holdsFull).toBe(course.holds.length);
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
      const got = new Set([...course.taps, ...course.holds.flatMap((h) => h.ticks)].map((b) => b.toFixed(3))); // a tap, or gold along a hold
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
      for (let b = cp - 3; b < cp - 0.05; b += 0.13) sim.press(b); // tapping along during the run-in does nothing
      sim.advance(cp - 0.01);
      expect(sim.crashed).toBe(false);
      expect(sim.judged).toBe(0);
      sim.advance(cp + 6);
      expect(sim.crashed).toBe(true); // nobody tapped after the handover
    });

    it('variety: no mode runs longer than 8 bars, sections mix several kinds of bar, and the level\'s own mode stars in its drop', () => {
      const playable = (n: number) => !course.inCharge(n * 4) && n * 4 < course.end - 4;
      let run = 0;
      let worst = 0;
      course.bars.forEach((b, n) => {
        run = n > 0 && playable(n) && playable(n - 1) && course.bars[n - 1].token === b.token ? run + 1 : 1;
        worst = Math.max(worst, run);
      });
      expect(worst).toBeLessThanOrEqual(8);
      const kindsOf = (s: { bar0: number; bars: number }) => new Set(course.bars.slice(s.bar0, s.bar0 + s.bars).map((b) => b.token)).size;
      const first = id === 'heroes';
      for (const s of level.segments) {
        if (s.core?.charge || s.bars < 4 || s.label === 'INTRO' || s.label === 'END') continue;
        expect(kindsOf(s), `section ${s.id}`).toBeGreaterThanOrEqual(first ? 2 : 3);
      }
      const star = { heroes: 'sling', skyhigh: 'weave', blank: 'spin', invincible: 'twin' }[id] as 'sling' | 'weave' | 'spin' | 'twin';
      const has = (p: (typeof course.presses)[number]) => (star === 'twin' ? !!p.twin : p[star]);
      const inDrop = course.presses.filter((p) => p.beat >= course.dropBeat && has(p)).length;
      const before = course.presses.filter((p) => p.beat < course.dropBeat && has(p)).length;
      expect(before, 'introduced before the drop').toBeGreaterThanOrEqual(1);
      expect(inDrop, 'stars in the drop').toBeGreaterThanOrEqual(star === 'sling' ? 3 : 8);
      if (id !== 'invincible') expect(course.presses.some((p) => p.twin)).toBe(false); // the twin orbit stays in the last level
    });

    it('transitions are fair: every planet hop launches on a strong beat at a phrase boundary, and after it lands the next press is at least 1.5 beats away, on the ring you landed on, and extra wide', () => {
      const hops = course.presses.filter((p) => p.sling);
      expect(landingGrace(course.spb)).toBeGreaterThanOrEqual(1.5);
      expect(landingGrace(course.spb) * course.spb).toBeGreaterThanOrEqual(0.85);
      for (const p of hops) {
        const seg = level.segments[p.seg];
        const bar = Math.floor((p.beat + 1e-6) / 4);
        expect(Math.abs(p.beat - Math.round(p.beat)), `hop at ${p.beat} is on the beat`).toBeLessThan(0.01);
        expect((bar - seg.bar0) % 2, `hop at ${p.beat} starts a phrase or its second half`).toBe(0);
        expect(p.beat - bar * 4, `hop at ${p.beat} is in the first half of its bar`).toBeLessThan(2);
        expect(p.land - p.beat).toBe(SLING_FLIGHT);
        expect(p.twin, 'no planet hops in a twin orbit').toBe(null);
        const next = course.presses[p.i + 1];
        if (!next) continue;
        expect(next.beat - p.land, `press after the hop at ${p.beat}`).toBeGreaterThanOrEqual(landingGrace(course.spb) - 1e-9);
        expect(next.planet, 'on the planet you landed on').toBe(p.planetTo);
        expect(next.from, 'on the ring you landed on, so it is on screen with the ball').toBe(p.to);
        expect(next.after).toBe(true);
        if (!next.smash) expect(next.tol * course.spb, 'extra wide').toBeGreaterThanOrEqual(0.159);
        // nothing at all can end the run between launch and the end of the grace: no taps, or mashing, both survive it
        const before = pressBeats.filter((b) => b <= p.beat);
        expect(run(before, course.start - 3, next.beat - next.tol - 0.05).crashed, `no taps after the hop at ${p.beat}`).toBe(false);
        expect(run([...before, ...spam(p.beat + 0.3, 10, 0, next.beat - next.tol - 0.1)], course.start - 3, next.beat - next.tol - 0.05).crashed, `mashing after the hop at ${p.beat}`).toBe(false);
      }
      console.log(`HOPS ${id}: ${hops.length} planet hops at beats ${hops.map((p) => p.beat).join(', ')}; landing grace ${landingGrace(course.spb)} beats (${(landingGrace(course.spb) * course.spb).toFixed(2)} s)`);
    });

    it('holds can never end the run, leave time to let go, and swallow the notes they cover', () => {
      if (!level.file.holds) { expect(course.holds).toEqual([]); return; }
      expect(course.holds.length).toBeGreaterThan(8);
      course.holds.forEach((h, i) => {
        expect(h.b - h.a, `hold at ${h.a}`).toBeGreaterThanOrEqual(HOLD_MIN - 1e-9);
        expect(h.b - h.a, `hold at ${h.a}`).toBeLessThanOrEqual(HOLD_MAX + 1e-9);
        if (i > 0) expect(h.a - course.holds[i - 1].b, `gap before the hold at ${h.a}`).toBeGreaterThanOrEqual(0.5 - 1e-9);
        // after a hold ends there is time to let go before the next white mark
        const next = course.presses.find((p) => p.beat > h.a + 1e-6);
        if (next) expect(next.beat - h.b, `after the hold at ${h.a}`).toBeGreaterThanOrEqual(LINE_TIGHT - 1e-9);
        // a rail starts on a white mark, a line on a gold note; nothing else asks for a tap inside either
        if (h.rail) expect(pressBeats.includes(h.a)).toBe(true); else expect(course.flow.some((f) => f.beat === h.a && f.hold === i)).toBe(true);
        expect(course.taps.filter((t) => t > h.a + 1e-6 && t <= h.b + 1e-6), `taps inside the hold at ${h.a}`).toEqual([]);
        expect(course.inCharge(h.a) || course.inCharge(h.b)).toBe(false);
      });
      // never holding at all clears (quick taps), with no gold from the holds
      const taps = run(course.taps);
      expect(taps.crashed).toBe(false);
      expect(taps.holdsFull).toBe(0);
      // holding everything (the button stays down from each tap until just before the next) clears too
      const legato = play(course.taps.flatMap((t, i): Array<[number, boolean]> => [[t, true], [i + 1 < course.taps.length ? course.taps[i + 1] - 0.08 : t + 0.5, false]]));
      expect(legato.crashed, `held throughout: ${legato.crashKind} at ${legato.crashBeat.toFixed(2)}`).toBe(false);
      // letting go 150 ms early or late on every hold costs a little gold at most, never the run
      for (const off of [-150, 150]) {
        const s = play(course.script.map(([t, down]): [number, boolean] => [down || !course.holds.some((h) => h.b === t) ? t : t + ms(off), down]).sort((x, y) => x[0] - y[0] || Number(x[1]) - Number(y[1])));
        expect(s.crashed, `let go ${off} ms off`).toBe(false);
        expect(s.holdsFull, `let go ${off} ms off`).toBeGreaterThanOrEqual(off > 0 ? course.holds.length : 0);
      }
      // starting every hold 120 ms late still collects nearly all of it
      const late = play(course.script.map(([t, down]): [number, boolean] => [down && course.holds.some((h) => !h.rail && h.a === t) ? t + ms(120) : t, down]));
      expect(late.crashed).toBe(false);
      console.log(`HOLDS ${id}: ${course.holds.filter((h) => h.rail).length} rails and ${course.holds.filter((h) => !h.rail).length} lines; late starts collected ${late.holdsFull} of ${course.holds.length} in full`);
    });

    it('a drop keeps you busy: never more than two beats with nothing to do, and no bar rhythm more than twice running', () => {
      if (!level.file.holds) return;
      for (const s of level.segments.filter((x) => x.label === 'DROP')) {
        // things to do: taps, and the whole length of every hold
        const marks = [s.beat0, ...course.taps.filter((t) => t >= s.beat0 && t < s.beat1), s.beat1];
        const busy = (from: number, to: number) => course.holds.filter((h) => h.b > from && h.a < to).reduce((left, h) => Math.max(0, left - (Math.min(h.b, to) - Math.max(h.a, from))), to - from);
        let worst = 0;
        for (let i = 1; i < marks.length; i++) worst = Math.max(worst, busy(marks[i - 1], marks[i]));
        expect(worst, `longest wait in ${s.id}`).toBeLessThanOrEqual(2 + 1e-9);
        const acts = course.taps.filter((t) => t >= s.beat0 && t < s.beat1).length;
        expect(acts / ((s.beat1 - s.beat0) * course.spb), `actions a second in ${s.id}`).toBeGreaterThanOrEqual(1);
        const sig = (bar: number) => [...course.taps.filter((t) => Math.floor(t / 4 + 1e-6) === bar).map((t) => (t - bar * 4).toFixed(2)), ...course.holds.filter((h) => Math.floor(h.a / 4 + 1e-6) === bar).map((h) => `h${(h.a - bar * 4).toFixed(2)}-${(h.b - h.a).toFixed(1)}`)].join(' ');
        let same = 1;
        for (let bar = s.bar0 + 1; bar < s.bar0 + s.bars; bar++) { same = sig(bar) === sig(bar - 1) ? same + 1 : 1; expect(same, `bar ${bar} of ${s.id}`).toBeLessThanOrEqual(2); }
      }
    });

    it('three star trails: a clean run collects them all; a stray tap, a missed gold note, a hold let go or mashing loses that star and nothing else', () => {
      const perfect = play(course.script);
      expect(course.stars.length).toBe(3);
      expect(perfect.stars).toEqual([1, 1, 1]);
      const inside = (st: { a: number; b: number }, h: { a: number; b: number }) => h.a >= st.a - 1e-6 && h.b <= st.b + 1e-6;
      course.stars.forEach((st, i) => {
        expect(st.b - st.a, `length of star ${i + 1}`).toBeGreaterThanOrEqual(4);
        expect(st.b - st.a, `length of star ${i + 1}`).toBeLessThanOrEqual(8);
        expect(st.gold, `gold in star ${i + 1}`).toBeGreaterThanOrEqual(8);
        if (i > 0) expect(st.a - course.stars[i - 1].b).toBeGreaterThanOrEqual(8);
        // it starts on something to tap and ends on its last piece of gold; no hold hangs over either end
        expect(course.taps.includes(st.a), `star ${i + 1} starts on a tap`).toBe(true);
        expect(course.flow.some((f) => f.beat === st.b) || course.holds.some((h) => h.b === st.b), `star ${i + 1} ends on gold`).toBe(true);
        for (const h of course.holds) expect(h.b <= st.a + 1e-6 || h.a >= st.b - 1e-6 || inside(st, h), `hold at ${h.a} and star ${i + 1}`).toBe(true);
        const others = (got: number[]) => got.filter((_, k) => k !== i);
        // one tap that meets nothing, somewhere in the trail
        let stray: number[] | null = null;
        for (let t = st.a + 0.05; t < st.b && !stray; t += 0.05) {
          if (course.taps.some((x) => Math.abs(x - t) < 0.25) || course.holds.some((h) => t > h.a - 0.05 && t < h.b + 0.3)) continue;
          const sim = play([...course.script, [t, true] as [number, boolean], [t + 0.04, false] as [number, boolean]].sort((x, y) => x[0] - y[0]));
          if (!sim.crashed) stray = sim.stars;
        }
        if (stray) { expect(stray[i], `a stray tap in star ${i + 1}`).toBe(-1); expect(others(stray)).toEqual([1, 1]); }
        // one gold note left out
        const note = course.flow.find((f) => f.beat > st.a + 1e-6 && f.beat <= st.b + 1e-6 && f.hold < 0);
        if (note) {
          const k = course.script.findIndex(([t, down]) => down && t === note.beat);
          const miss = play(course.script.filter((_, j) => j !== k && j !== k + 1));
          expect(miss.crashed).toBe(false);
          expect(miss.stars[i], `a missed note in star ${i + 1}`).toBe(-1);
          expect(others(miss.stars)).toEqual([1, 1]);
        }
        // a hold in the trail let go half a beat early
        const hold = course.holds.find((h) => inside(st, h));
        if (hold) {
          const early = play(course.script.map(([t, down]): [number, boolean] => [!down && t === hold.b ? t - 0.6 : t, down]).sort((x, y) => x[0] - y[0] || Number(x[1]) - Number(y[1])));
          expect(early.crashed).toBe(false);
          expect(early.stars[i], `a hold let go early in star ${i + 1}`).toBe(-1);
          expect(others(early.stars)).toEqual([1, 1]);
        }
        // mashing through it never wins it, and nor does joining it part-way from a practice checkpoint
        for (const rate of [7, 9, 12]) {
          const mash = run([...course.taps.filter((t) => t < st.a - 1), ...spam(st.a - 0.5, rate, 0, st.b + 0.5)], course.start - 3, st.b + 1);
          expect(mash.stars[i], `mashing at ${rate} a second through star ${i + 1}`).not.toBe(1);
        }
        expect(new Sim(course, st.a + 1 - 3.2, st.a + 1).stars[i]).toBe(-1);
      });
      expect(course.stars[0].b).toBeLessThan(course.dropBeat);
      expect(course.stars[2].a).toBeGreaterThan(course.dropBeat);
      // tapping only the white marks clears the level with no stars; quick taps on everything keep only the trails with no hold in them
      const only = run(pressBeats);
      expect(only.crashed).toBe(false);
      expect(only.stars).toEqual([-1, -1, -1]);
      const quick = run(course.taps);
      course.stars.forEach((st, i) => expect(quick.stars[i], `quick taps, star ${i + 1}`).toBe(course.holds.some((h) => inside(st, h)) ? -1 : 1));
      // a little late or early throughout still collects them all (the fastest notes leave about ±45 ms)
      for (const off of [-40, 40]) expect(play(course.script.map(([t, down]): [number, boolean] => [t + ms(off), down])).stars, `${off} ms off`).toEqual([1, 1, 1]);
      console.log(`STARS ${id}: ${course.stars.map((st) => `beats ${st.a}-${st.b} (${((st.b - st.a) * course.spb).toFixed(1)} s, ${st.gold} gold)`).join('; ')}`);
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
