// What each level asks for, bar by bar: forms, gates (turn, tempo, mirror, upside-down), pads, orbs, combos, twins.
// Run: npx vite-node tools/dosage.ts [id ...] [--bars]     (bars are counted from 1)
import { FINAL, PACKS, type LevelPack } from '../src/game/packs';
import { Level } from '../src/game/level';
import { buildCourse, type Course, type Press } from '../src/gd/course';
import { accentBeats, layers, pitchLookup } from '../src/gd/presses';

const args = process.argv.slice(2);
const ids = args.filter((a) => !a.startsWith('--'));
const showBars = args.includes('--bars');
const bar = (beat: number) => Math.floor(beat / 4 + 1e-6) + 1;
const letter = (p: Press): string =>
  p.smash ? 'S' : p.intro ? 'i' : p.sling ? (p.pad === 'spring' ? 'P' : 'T') : p.orb === 'jump' ? 'J' : p.orb === 'dash' ? 'D' : p.orb === 'grav' ? 'G' : p.slip ? 'd' : p.pad === 'tide' ? 't' : p.form === 'comet' ? (p.act === 'down' ? 'v' : p.act === 'up' ? '^' : 'c') : p.form !== 'orb' ? p.form[0] : p.kind === 'flip' ? (p.weave ? 'w' : 'f') : 'h';
const runs = (xs: number[]): string => { const out: string[] = []; let a = -9, z = -9; for (const x of [...new Set(xs)].sort((p, q) => p - q)) { if (x === z + 1) z = x; else { if (a > 0) out.push(a === z ? `${a}` : `${a}-${z}`); a = z = x; } } if (a > 0) out.push(a === z ? `${a}` : `${a}-${z}`); return out.join(', ') || 'none'; };

export function dosage(pack: LevelPack): { course: Course; text: string } {
  const level = new Level(pack.level, pack.audio, pack.chart);
  const c = buildCourse(level, layers(pack), pitchLookup(pack), pack.level.lab, accentBeats(pack));
  const nBars = Math.round(c.end / 4);
  const L: string[] = [];
  L.push(`=== ${pack.level.id}: ${level.title}, ${nBars} bars, ${(60 / c.spb).toFixed(0)} BPM, window ±${Math.round((pack.level.rules?.tol ?? 0.12) * 1000)} ms`);
  if (showBars) for (let n = 0; n < nBars; n++) {
    const ps = c.presses.filter((p) => bar(p.beat) === n + 1);
    const seg = level.segAt((n * 4 + 0.01) * c.spb);
    L.push(`  ${String(n + 1).padStart(2)} ${seg.label.padEnd(6)} ${(c.bars[n]?.token ?? '').padEnd(26)} ${ps.map(letter).join('')}${c.inCharge(n * 4 + 0.5) ? ' (charge)' : ''}`);
  }
  // forms: where each is in force (bars), and the lenses
  const forms: Record<string, number[]> = {};
  for (let n = 0; n < nBars; n++) { if (c.inCharge(n * 4 + 0.5)) continue; const f = c.formAt(n * 4 + 0.01); (forms[f] ??= []).push(n + 1); }
  const lens = c.lenses.map((l) => bar(l.beat));
  const gaps: number[] = []; { const pts = [1, ...lens, nBars]; for (let i = 1; i < pts.length; i++) gaps.push(pts[i] - pts[i - 1]); }
  L.push(`  forms: ${Object.entries(forms).map(([f, b]) => `${f} ${runs(b)}`).join(' | ')}`);
  L.push(`  lenses (form changes) at bars ${c.lenses.map((l) => `${bar(l.beat)} ${l.form}${l.intro ? ' (shown first)' : ''}`).join(', ') || 'none'}; longest stretch without one: ${Math.max(...gaps)} bars`);
  L.push(`  reversals at ${runs(c.turns.map(bar))} | tempo gates at ${c.portals.map((g) => `${bar(g.beat)} (${g.speed}x)`).join(', ') || 'none'} | mirror at ${runs(c.mirrors.map(bar))} | upside-down at ${runs((c.inverts ?? []).map(bar))}`);
  const of = (f: (p: Press) => boolean) => runs(c.presses.filter(f).map((p) => bar(p.beat)));
  const n = (f: (p: Press) => boolean) => c.presses.filter(f).length;
  L.push(`  pads (tapped): spring ${of((p) => p.pad === 'spring')} | tide ${of((p) => p.pad === 'tide')} | planet hops ${of((p) => p.sling && !p.pad)}`);
  L.push(`  orbs: jump ${n((p) => p.orb === 'jump')} at ${of((p) => p.orb === 'jump')} | dash ${n((p) => p.orb === 'dash')} at ${of((p) => p.orb === 'dash')} | gravity ${n((p) => p.orb === 'grav')} at ${of((p) => p.orb === 'grav')} | slipstreams from the ring ${of((p) => p.slip && !p.orb)}`);
  // combos: two or more orbs in a row
  const combos: string[] = [];
  for (let i = 0; i < c.presses.length; i++) {
    if (!c.presses[i].orb) continue;
    let j = i; while (j + 1 < c.presses.length && c.presses[j + 1].orb) j++;
    if (j > i) combos.push(`bar ${bar(c.presses[i].beat)}${bar(c.presses[j].beat) !== bar(c.presses[i].beat) ? `-${bar(c.presses[j].beat)}` : ''}: hop ${c.presses.slice(i, j + 1).map((p) => `> ${p.orb}`).join(' ')} > land${c.presses[i].beat >= c.dropBeat ? ' (drop)' : ''}`);
    i = j;
  }
  L.push(`  combos: ${combos.join('; ') || 'none'}`);
  L.push(`  twin orbit at ${runs(c.twins.flatMap(([a, z]) => { const o: number[] = []; for (let b = a; b < z; b += 4) if (!c.duals.some(([x, y]) => b >= x && b < y)) o.push(bar(b)); return o; }))} | asymmetric twins at ${c.duals.map((d) => `${bar(d[0])}-${bar(d[1] - 1)}${d[2] ? ` (${d[2]})` : ''}`).join(', ') || 'none'}`);
  L.push(`  presses ${c.presses.length} (taken for the player: ${n((p) => p.auto && !p.smash)}), flow notes ${c.flow.length}, holds ${c.holds.length}, drop at bar ${bar(c.dropBeat)}`);
  return { course: c, text: L.join('\n') };
}

for (const pack of [...PACKS, FINAL]) if (!ids.length || ids.includes(pack.level.id)) console.log(dosage(pack).text + '\n');
