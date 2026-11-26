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
    const rhythm = ps.map((p) => `${(p.beat - n * 4).toFixed(2)}${holdAt.has(Math.round(p.beat * 100)) ? 'h' : ''}${p.spin ? 's' : ''}${p.sling ? 'p' : ''}${p.kind === 'flip' ? 'f' : ''}${p.auto ? 'a' : ''}${p.pad ? 'P' : ''}`).join(' ');
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
    if (ps.some((p) => p.orb === 'jump')) a.add('jump orb');
    if (ps.some((p) => p.pad === 'spring' || p.pad === 'jump')) a.add(ps.some((p) => p.pad === 'jump' && p.land - p.beat > 2.5) ? 'throw' : 'jump pad');
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
    const found = p.kind === 'hop' ? acts[n].has('planet hop') : p.kind === 'speed' ? acts[n].has('speed gate') : p.kind === 'invert' ? acts[n].has('world turns over') : p.kind === 'turn' ? acts[n].has('turn (spike)') : p.kind === 'orb' ? acts[n].has('jump orb') : p.kind === 'drop' ? acts[n].has('great node') : p.kind === 'pad' ? acts[n].has('jump pad') || acts[n].has('throw') : p.kind === 'story' ? acts[n].size > 0 : false;
    return { ...p, found };
  });
  return { id: pack.level.id, title: pack.level.title, bars: nBars, played: playedBars.length, unique, uniquePct: Math.round((100 * unique) / Math.max(1, playedBars.length)), longestRun: longest, longestAt, sections, phrases, setpieces: sp, rest: { longestGapBeats: gap, at: gapAt } };
}

/**
 * The difficulty table (the owner's hard limits of 2026-11-25), per stage: taps a second in calm sections and at the
 * peak (a drop, or a build at its top), the opening's half-width, and what a stage may ask. Bursts above the peak may
 * last two bars at most; never two demands (a speed change, a form change, a turn, a gravity change) within two beats.
 */
export const LIMITS: Record<string, { calm: number; peak: number; tolMs: number; maxTurns: number; turnsInDrop: boolean; forbid: string[] }> = {
  started: { calm: 0.7, peak: 1.5, tolMs: 160, maxTurns: 0, turnsInDrop: false, forbid: ['turn', 'spin gate', 'world turns over', 'weave', 'gravity'] },
  heroes: { calm: 1, peak: 2, tolMs: 140, maxTurns: 2, turnsInDrop: false, forbid: ['spin gate', 'world turns over', 'weave', 'gravity'] },
  skyhigh: { calm: 1.2, peak: 2.4, tolMs: 125, maxTurns: 99, turnsInDrop: true, forbid: [] },
  blank: { calm: 1.3, peak: 2.7, tolMs: 110, maxTurns: 99, turnsInDrop: true, forbid: [] },
  invincible: { calm: 1.4, peak: 3, tolMs: 100, maxTurns: 99, turnsInDrop: true, forbid: [] },
  royalty: { calm: 1.5, peak: 3.5, tolMs: 90, maxTurns: 99, turnsInDrop: true, forbid: [] }
};
export interface Difficulty {
  id: string; tolMs: number; limit: (typeof LIMITS)[string];
  sections: Array<{ id: string; label: string; kind: 'calm' | 'peak'; perSec: number; worstBarPerSec: number; limit: number; ok: boolean }>;
  bursts: Array<{ from: number; bars: number; perSec: number }>;
  turns: number[]; turnsInDrop: number[]; forbidden: Array<{ what: string; bars: number[] }>;
  stacked: Array<{ beat: number; what: string[] }>;
  verdict: string[];
}
export function difficulty(pack: LevelPack): Difficulty {
  const level = new Level(pack.level, pack.audio, pack.chart);
  const c = buildCourse(level, layers(pack), pitchLookup(pack), pack.level.lab, accentBeats(pack));
  const L = LIMITS[pack.level.id] ?? LIMITS.royalty, spb = c.spb, barS = 4 * spb;
  const barOf = (b: number) => Math.floor(b / 4 + 1e-6);
  const inBar = (n: number) => c.presses.filter((p) => barOf(p.beat) === n && !p.auto).length;
  const sections = level.segments.filter((s) => c.presses.some((p) => barOf(p.beat) >= s.bar0 && barOf(p.beat) < s.bar0 + s.bars)).map((s) => {
    const kind: 'calm' | 'peak' = /DROP|BUILD|READY/.test(s.label) ? 'peak' : 'calm';
    const n = Array.from({ length: s.bars }, (_, k) => inBar(s.bar0 + k));
    const perSec = n.reduce((a, b) => a + b, 0) / (s.bars * barS), worst = Math.max(...n) / barS, limit = kind === 'calm' ? L.calm : L.peak;
    return { id: s.id, label: s.label, kind, perSec: +perSec.toFixed(2), worstBarPerSec: +worst.toFixed(2), limit, ok: perSec <= limit + 1e-9 };
  });
  const bursts: Difficulty['bursts'] = [];
  let run = 0;
  for (let n = 0; n <= barOf(c.end) + 1; n++) {
    const over = inBar(n) / barS > L.peak + 1e-9;
    if (over) run++;
    if ((!over || n === barOf(c.end) + 1) && run) { const from = n - run; bursts.push({ from, bars: run, perSec: +(Math.max(...Array.from({ length: run }, (_, k) => inBar(from + k))) / barS).toFixed(2) }); run = 0; }
  }
  const drops = level.segments.filter((s) => /DROP/.test(s.label));
  const inDrop = (b: number) => drops.some((s) => b >= s.beat0 && b < s.beat1);
  // what each stretch asks, for the forbidden list and for stacking
  const demands: Array<{ beat: number; what: string }> = [];
  for (const t of c.turns) demands.push({ beat: t, what: 'turn' });
  for (const g of c.portals) demands.push({ beat: g.beat, what: 'speed change' });
  for (const l of c.lenses) demands.push({ beat: l.beat, what: 'mode change' });
  for (const b of [...c.inverts, ...c.mirrors]) demands.push({ beat: b, what: 'gravity / world turns over' });
  for (const p of c.presses) if (p.kind === 'flip' && !p.weave) demands.push({ beat: p.beat, what: 'gravity / world turns over' });
  const stacked: Difficulty['stacked'] = [];
  demands.sort((a, b) => a.beat - b.beat).forEach((d, i) => {
    const near = demands.filter((e, j) => j !== i && Math.abs(e.beat - d.beat) < 2 && e.what !== d.what);
    if (near.length && !stacked.some((s) => Math.abs(s.beat - d.beat) < 2)) stacked.push({ beat: d.beat, what: [d.what, ...near.map((e) => e.what)] });
  });
  const used = (what: string): number[] => {
    const bars = new Set<number>();
    if (what === 'turn') c.turns.forEach((b) => bars.add(barOf(b)));
    if (what === 'spin gate') c.presses.filter((p) => p.spin).forEach((p) => bars.add(barOf(p.beat)));
    if (what === 'world turns over') [...c.inverts, ...c.mirrors].forEach((b) => bars.add(barOf(b)));
    if (what === 'weave') c.presses.filter((p) => p.weave).forEach((p) => bars.add(barOf(p.beat)));
    if (what === 'gravity') c.presses.filter((p) => p.kind === 'flip' && !p.weave).forEach((p) => bars.add(barOf(p.beat)));
    return [...bars].sort((a, b) => a - b);
  };
  const forbidden = L.forbid.map((what) => ({ what, bars: used(what) })).filter((f) => f.bars.length);
  const tolMs = Math.round((pack.level.rules?.tol ?? 0.12) * 1000);
  const turnsInDrop = c.turns.filter(inDrop);
  const verdict: string[] = [];
  for (const s of sections) if (!s.ok) verdict.push(`${s.id}: ${s.perSec} taps/s, over the ${s.kind} limit of ${s.limit}`);
  for (const b of bursts) if (b.bars > 2) verdict.push(`a burst of ${b.bars} bars above the peak from bar ${b.from} (limit: 2)`);
  if (c.turns.length > L.maxTurns) verdict.push(`${c.turns.length} direction turns (limit: ${L.maxTurns})`);
  if (!L.turnsInDrop && turnsInDrop.length) verdict.push(`${turnsInDrop.length} turns inside a drop (none allowed)`);
  for (const f of forbidden) verdict.push(`${f.what} is not allowed here (bars ${f.bars.join(', ')})`);
  if (stacked.length) verdict.push(`${stacked.length} places where two demands stack within two beats`);
  if (tolMs < L.tolMs) verdict.push(`openings of ±${tolMs} ms, narrower than ±${L.tolMs}`);
  return { id: pack.level.id, tolMs, limit: L, sections, bursts, turns: c.turns.map(barOf), turnsInDrop: turnsInDrop.map(barOf), forbidden, stacked, verdict };
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
  console.log('\nDIFFICULTY (taps a second against the table)');
  const diffs = packs.map(difficulty);
  for (const d of diffs) {
    console.log(`\n${d.id}: openings ±${d.tolMs} ms (table: ±${d.limit.tolMs}); calm ≤ ${d.limit.calm}/s, peak ≤ ${d.limit.peak}/s`);
    for (const s of d.sections) console.log(`  ${s.id.padEnd(7)} ${s.kind.padEnd(5)} ${s.perSec.toFixed(2)} taps/s (busiest bar ${s.worstBarPerSec.toFixed(2)}/s), limit ${s.limit}  ${s.ok ? 'ok' : 'OVER'}`);
    console.log(`  bars above the peak: ${d.bursts.map((b) => `${b.from}${b.bars > 1 ? `-${b.from + b.bars - 1}` : ''} (${b.perSec}/s)`).join(', ') || 'none'}`);
    console.log(`  direction turns: ${d.turns.length} (bars ${d.turns.join(', ') || '-'}), in a drop: ${d.turnsInDrop.length}`);
    for (const f of d.forbidden) console.log(`  not allowed here: ${f.what} in bars ${f.bars.join(', ')}`);
    console.log(`  stacked demands: ${d.stacked.length ? d.stacked.map((s) => `beat ${s.beat} (${s.what.join(' + ')})`).join('; ') : 'none'}`);
    console.log(`  VERDICT: ${d.verdict.length ? d.verdict.join('; ') : 'within the table'}`);
  }
  writeFileSync(new URL('./cache/difficulty.json', import.meta.url), JSON.stringify(diffs, null, 1));
}
