// How busy each level keeps the player, section by section: required presses per second, the longest wait between
// two of them, the share of time spent in waits of two beats or more, and how often a bar repeats the bar before it.
//   Usage: npx vite-node tools/activity.ts
import { PACKS, SLICE } from '../src/game/packs';
import { Level } from '../src/game/level';
import { buildCourse } from '../src/gd/course';
import { accentBeats, layers, pitchLookup } from '../src/gd/presses';

for (const pack of PACKS.filter((p) => SLICE.includes(p.level.id))) {
  const level = new Level(pack.level, pack.audio, pack.chart);
  const c = buildCourse(level, layers(pack), pitchLookup(pack), pack.level.lab, accentBeats(pack));
  const spb = c.spb;
  const row = (name: string, b0: number, b1: number, note = ''): void => {
    const ps = c.presses.filter((p) => p.beat >= b0 && p.beat < b1 && !p.auto).map((p) => p.beat);
    const fl = c.flow.filter((f) => f.beat >= b0 && f.beat < b1).length;
    const secs = (b1 - b0) * spb;
    const edges = [b0, ...ps, b1];
    let longest = 0; let idle = 0;
    for (let i = 1; i < edges.length; i++) { const g = edges[i] - edges[i - 1]; longest = Math.max(longest, g); if (g >= 2) idle += g; }
    // with everything there is to do: gold notes too, and the whole length of every hold
    const all = [b0, ...c.taps.filter((t) => t >= b0 && t < b1), b1];
    const held = (from: number, to: number) => c.holds.reduce((sum, h) => sum + Math.max(0, Math.min(h.b, to) - Math.max(h.a, from)), 0);
    let quiet = 0;
    for (let i = 1; i < all.length; i++) quiet = Math.max(quiet, all[i] - all[i - 1] - held(all[i - 1], all[i]));
    const acts = all.length - 2;
    const holdShare = held(b0, b1) / (b1 - b0);
    // a bar "repeats" when its presses fall on the same beats of the bar as the bar before
    const sig = (bar: number) => ps.filter((b) => Math.floor(b / 4 + 1e-6) === bar).map((b) => (b - bar * 4).toFixed(2)).join(',');
    let same = 0; let bars = 0;
    for (let bar = Math.round(b0 / 4) + 1; bar < Math.round(b1 / 4); bar++) { bars++; if (sig(bar) === sig(bar - 1)) same++; }
    console.log(`  ${name.padEnd(9)} ${String(secs.toFixed(0)).padStart(3)}s  presses ${String(ps.length).padStart(3)} = ${(ps.length / secs).toFixed(2)}/s  longest wait ${longest.toFixed(1)} beats (${(longest * spb).toFixed(1)}s)  waiting ${String(Math.round((idle / (b1 - b0)) * 100)).padStart(3)}%  gold ${String(fl).padStart(3)} = ${(fl / secs).toFixed(2)}/s  bars repeating ${bars ? Math.round((same / bars) * 100) : 0}%  | all actions ${(acts / secs).toFixed(2)}/s, holding ${Math.round(holdShare * 100)}%, longest quiet ${(quiet * spb).toFixed(1)}s  ${note}`);
  };
  console.log(`\n${pack.level.id} (${pack.level.difficulty}, ${pack.audio.bpm} BPM, ${level.endTime.toFixed(0)} s)`);
  for (const s of level.segments) row(s.id, s.beat0, s.beat1, [s.label, s.core?.charge ? 'charge' : '', (s.core?.bars ?? []).join(' ')].filter(Boolean).join(' | '));
  row('WHOLE', c.start, c.end);
}
