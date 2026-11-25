// The variety audit (the owner's charting rules of 2026-11-25), built from the game's own courses:
//   total bars, how many bar patterns are unique (target: at least 60% of the bars played), the longest run of
//   identical bars (at most 2), taps per bar by section, the actions used in each 8-bar phrase, and the set pieces.
// A bar's pattern is its rhythm AND what it asks: each tap's place in the bar, plus the bar's height (up, down,
// weave), a turn on its bar line, spin gates, holds, a planet hop, a tempo gate, the world turning over, the form.
// Usage: npx vite-node tools/variety.ts [ids...]      (default: the first stage and Emberwick)
// Writes tools/cache/variety.json too.
import { writeFileSync } from 'node:fs';
import { FIRST, PACKS, type LevelPack } from '../src/game/packs';
import { Level } from '../src/game/level';
import { buildCourse } from '../src/gd/course';
import { accentBeats, layers, pitchLookup } from '../src/gd/presses';

type SetPiece = { bar: number; kind: string; name: string; what: string };
export interface Audit {
  id: string; title: string; bars: number; played: number; unique: number; uniquePct: number; longestRun: number; longestAt: number;
  sections: Array<{ id: string; label: string; bars: string; perBar: number[]; mean: number }>;
  phrases: Array<{ bars: string; actions: string[] }>;
  setpieces: Array<SetPiece & { found: boolean }>;
  rest: { longestGapBeats: number; at: number };
}

export function audit(pack: LevelPack): Audit {
  const level = new Level(pack.level, pack.audio, pack.chart);
  const c = buildCourse(level, layers(pack), pitchLookup(pack), pack.level.lab, accentBeats(pack));
  const nBars = Math.ceil(c.end / 4);
  const barOf = (b: number) => Math.floor(b / 4 + 1e-6);
  const holdAt = new Set(c.holds.map((h) => Math.round(h.a * 100)));
  const has = (list: number[], n: number) => list.some((b) => barOf(b) === n);
  const sig: string[] = [];
  const acts: Array<Set<string>> = [];
  for (let n = 0; n < nBars; n++) {
    const ps = c.presses.filter((p) => barOf(p.beat) === n);
    const cfg = c.bars[n];
    const a = new Set<string>();
    const rhythm = ps.map((p) => `${(p.beat - n * 4).toFixed(2)}${holdAt.has(Math.round(p.beat * 100)) ? 'h' : ''}${p.spin ? 's' : ''}${p.sling ? 'p' : ''}${p.kind === 'flip' ? 'f' : ''}${p.auto ? 'a' : ''}`).join(' ');
    const moves = [cfg?.mode ?? '', has(c.turns, n) ? 'turn' : '', c.portals.some((g) => barOf(g.beat) === n) ? `x${cfg?.speed}` : '', has(c.inverts, n) || has(c.mirrors, n) ? 'flip-world' : '', cfg?.form ?? ''].join('/');
    sig.push(ps.length ? `${rhythm} | ${moves}` : '');
    if (ps.length === 1) a.add('single');
    for (let i = 1; i < ps.length; i++) if (ps[i].beat - ps[i - 1].beat < 0.75) a.add('double');
    if (ps.length > 1 && ps.some((p, i) => i > 0 && ps[i].beat - ps[i - 1].beat >= 0.75)) a.add('single');
    if (ps.some((p) => holdAt.has(Math.round(p.beat * 100)))) a.add('hold');
    if (has(c.turns, n)) a.add('turn (spike)');
    if (ps.some((p) => p.spin)) a.add('spin gate');
    if (ps.some((p) => p.sling)) a.add('planet hop');
    if (ps.some((p) => p.weave)) a.add('weave');
    if (c.portals.some((g) => barOf(g.beat) === n)) a.add('speed gate');
    if (has(c.inverts, n) || has(c.mirrors, n)) a.add('world turns over');
    if (ps.some((p) => p.form === 'meteor' && !p.auto)) a.add('meteor dash');
    if (ps.some((p) => p.smash)) a.add('great node');
    if (n > 0 && c.bars[n - 1] && cfg && c.bars[n - 1].mode !== cfg.mode && ps.length) a.add('height change');
    acts.push(a);
  }
  const playedBars = sig.map((s, n) => (s ? n : -1)).filter((n) => n >= 0);
  const unique = new Set(playedBars.map((n) => sig[n])).size;
  let run = 0, longest = 0, longestAt = 0;
  playedBars.forEach((n, i) => { run = i > 0 && playedBars[i - 1] === n - 1 && sig[n] === sig[n - 1] ? run + 1 : 1; if (run > longest) { longest = run; longestAt = n - run + 1; } });
  // rests: the longest stretch with nothing to tap, between the first tap and the last
  let gap = 0, gapAt = 0;
  for (let i = 1; i < c.presses.length; i++) { const g = c.presses[i].beat - c.presses[i - 1].beat; if (g > gap) { gap = g; gapAt = c.presses[i - 1].beat; } }
  const sections = level.segments.map((s) => {
    const perBar = Array.from({ length: s.bars }, (_, k) => c.presses.filter((p) => barOf(p.beat) === s.bar0 + k).length);
    return { id: s.id, label: s.label, bars: `${s.bar0}-${s.bar0 + s.bars - 1}`, perBar, mean: +(perBar.reduce((x, y) => x + y, 0) / Math.max(1, perBar.length)).toFixed(1) };
  });
  const last = playedBars[playedBars.length - 1] ?? 0, first = playedBars[0] ?? 0;
  const phrases: Audit['phrases'] = [];
  for (let b = first; b <= last; b += 8) {
    const s = new Set<string>();
    for (let n = b; n < Math.min(b + 8, last + 1); n++) acts[n].forEach((x) => s.add(x));
    if (Array.from({ length: Math.min(8, last + 1 - b) }, (_, k) => b + k).some((n) => !sig[n]) || [...Array(Math.min(8, last + 1 - b)).keys()].some((k) => { const n = b + k; const ps = c.presses.filter((p) => barOf(p.beat) === n); return ps.length > 0 && (ps[0].beat - n * 4 >= 1.5 || (n + 1) * 4 - ps[ps.length - 1].beat >= 2); })) s.add('rest');
    phrases.push({ bars: `${b}-${Math.min(b + 7, last)}`, actions: [...s] });
  }
  const sp = ((pack.level as unknown as { setpieces?: SetPiece[] }).setpieces ?? []).map((p) => {
    const n = p.bar;
    const found = p.kind === 'hop' ? acts[n].has('planet hop') : p.kind === 'speed' ? acts[n].has('speed gate') : p.kind === 'invert' ? acts[n].has('world turns over') : p.kind === 'turn' ? acts[n].has('turn (spike)') && acts[n + 1]?.has('turn (spike)') : false;
    return { ...p, found };
  });
  return { id: pack.level.id, title: pack.level.title, bars: nBars, played: playedBars.length, unique, uniquePct: Math.round((100 * unique) / Math.max(1, playedBars.length)), longestRun: longest, longestAt, sections, phrases, setpieces: sp, rest: { longestGapBeats: gap, at: gapAt } };
}

const isMain = typeof process !== 'undefined' && !process.env.VITEST;
if (isMain) {
  const ids = process.argv.slice(2).filter((x) => !x.startsWith('-'));
  const packs = (ids.length ? ids : [FIRST.level.id, 'heroes']).map((id) => (id === FIRST.level.id ? FIRST : PACKS.find((p) => p.level.id === id)!));
  const out = packs.map(audit);
  for (const a of out) {
    console.log(`\n${a.id} (${a.title}): ${a.bars} bars, ${a.played} played; ${a.unique} unique patterns (${a.uniquePct}%); longest run of identical bars ${a.longestRun} (from bar ${a.longestAt}); longest stretch with no tap ${a.rest.longestGapBeats} beats (from beat ${a.rest.at})`);
    for (const s of a.sections) console.log(`  ${s.id.padEnd(7)} bars ${s.bars.padEnd(6)} taps per bar ${s.perBar.join(' ')}  (mean ${s.mean})`);
    for (const p of a.phrases) console.log(`  phrase ${p.bars.padEnd(6)} ${p.actions.join(', ')}`);
    for (const p of a.setpieces) console.log(`  set piece, bar ${p.bar}: ${p.name} (${p.what}) ${p.found ? '' : '  !! NOT FOUND IN THE COURSE'}`);
  }
  writeFileSync(new URL('./cache/variety.json', import.meta.url), JSON.stringify(out, null, 1));
}
