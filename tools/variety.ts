// The variety audit (the owner's charting rules of 2026-11-25), built from the game's own courses:
//   total bars, how many bar patterns are unique (target: at least 60% of the bars played), the longest run of
//   identical bars (at most 2), taps per bar by section, the actions used in each 8-bar phrase, and the set pieces.
// A bar's pattern is its rhythm AND what it asks: each tap's place in the bar, plus the bar's height (up, down,
// weave), a turn on its bar line, spin gates, holds, a planet hop, a tempo gate, the world turning over, the form.
// Usage: npx vite-node tools/variety.ts [ids...]      (default: the first stage and Emberwick)
// Writes tools/cache/variety.json too.
import { writeFileSync } from 'node:fs';
import { AMBUSH, FINAL, FIRST, PACKS, type LevelPack } from '../src/game/packs';
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
    const rhythm = ps.map((p) => `${(p.beat - n * 4).toFixed(2)}${holdAt.has(Math.round(p.beat * 100)) ? 'h' : ''}${p.spin ? 's' : ''}${p.sling ? 'p' : ''}${p.kind === 'flip' ? 'f' : ''}${p.auto ? 'a' : ''}${p.pad ? 'P' : ''}${p.leap ? (p.leap.ember ? 'e' : 'L') : ''}${p.chime ? 'o' : ''}`).join(' ');
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
    if (ps.some((p) => p.pad === 'vent')) a.add('teleport vent');
    if (ps.some((p) => p.pad === 'spring' || p.pad === 'jump')) a.add(ps.some((p) => p.pad === 'jump' && p.land - p.beat > 2.5) ? 'throw' : 'jump pad');
    if (ps.some((p) => p.smash)) a.add('great node');
    if (n > 0 && c.bars[n - 1] && cfg && c.bars[n - 1].mode !== cfg.mode && ps.length) a.add('height change');
    acts.push(a);
  }
  const playedBars = sig.map((s, n) => (s ? n : -1)).filter((n) => n >= 0);
  if (process.env.DUPS) { const g = new Map<string, number[]>(); playedBars.forEach((n) => g.set(sig[n], [...(g.get(sig[n]) ?? []), n])); for (const [k, v] of g) if (v.length > 1) console.log('DUP', v.join(','), k); }
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
    const found = p.kind === 'leap' ? c.presses.some((q) => barOf(q.beat) === n && !!q.leap && !q.leap.ember) : p.kind === 'hop' ? acts[n].has('planet hop') : p.kind === 'speed' ? acts[n].has('speed gate') : p.kind === 'invert' ? acts[n].has('world turns over') : p.kind === 'turn' ? acts[n].has('turn (spike)') : p.kind === 'orb' ? acts[n].has('jump orb') : p.kind === 'drop' ? acts[n].has('great node') : p.kind === 'pad' ? acts[n].has('jump pad') || acts[n].has('throw') : p.kind === 'vent' ? acts[n].has('teleport vent') : p.kind === 'story' ? acts[n].size > 0 : false;
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
  ambush: { calm: 1.2, peak: 2.5, tolMs: 120, maxTurns: 99, turnsInDrop: true, forbid: [] },
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
  // (in ball and snap mode, the Pulsar, every tap turns him to the other side: that is the mode itself, its own action,
  // not a change stacked on others; a gravity change is one outside it: a gravity orb, a tide pad, a side swapped)
  for (const p of c.presses) if (p.kind === 'flip' && !p.weave && p.form !== 'pulsar') demands.push({ beat: p.beat, what: 'gravity / world turns over' });
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

/**
 * The journey's measures (the owner's brief of 2026-11-26), reported for every level next to the old ones:
 *   distinct action types in each 8-bar phrase (at least 4, at least one of them an object), interactive objects a
 *   minute, places visited and hops between them, and the longest stretch of nothing but plain taps (at most 4 bars
 *   outside the calm intro). Objects: the things of the world you act on (Emberwick: Ossa's anvils as the Meteor's
 *   walls, the bellows as pads, lava vents, embers in the air, Ossa's strikes that launch you, the great node).
 */
export interface Journey {
  id: string; places: number; hops: number; objectsPerMin: number; objects: number; minutes: number;
  phrases: Array<{ bars: string; types: string[]; objects: string[]; ok: boolean }>;
  plain: { bars: number; from: number; to: number; ok: boolean };
  /** local density (2026-11-26): the shortest gap between taps (s), and the longest run of quick taps (each under 0.45 s
   * after the one before; a quick double is a run of 2). The first planets allow nothing tighter than one double. */
  shortestGap: number; quickRun: { taps: number; at: number; ok: boolean };
  /** after every leap: the time from landing to the first tap (s) */
  landing: { shortest: number; ok: boolean };
}
/** the first planets: a single quick double at most, nothing closer than 0.45 s otherwise */
export const EARLY = new Set(['started', 'heroes']);
export const QUICK_S = 0.45;
/** each level's local limits (the owner's table of 2026-11-26): the shortest gap, and the longest run of quick taps */
export const LOCAL: Record<string, { floor: number; dbl: number; run: number }> = {
  started: { floor: 0.39, dbl: 0.45, run: 2 }, heroes: { floor: 0.29, dbl: 0.45, run: 2 }, skyhigh: { floor: 0.23, dbl: 0.35, run: 3 },
  ambush: { floor: 0.33, dbl: 0.33, run: 3 }, blank: { floor: 0.29, dbl: 0.29, run: 4 }, invincible: { floor: 0.25, dbl: 0.25, run: 4 }, throne: { floor: 0.19, dbl: 0.19, run: 6 }, royalty: { floor: 0.19, dbl: 0.19, run: 6 }
};
const OBJECT = new Set<string>(['leap (the signal, the hand)', 'leap', 'a light in the air (in a leap)', 'stone flower (pad)', 'mote of light (jump orb)', 'anvil (Meteor wall)', 'bellows (pad)', 'lava vent', 'ember in the air', 'launch (a strike, a fling)', 'great node', 'jump pad', 'spring']);
export function journey(pack: LevelPack): Journey {
  const level = new Level(pack.level, pack.audio, pack.chart);
  const c = buildCourse(level, layers(pack), pitchLookup(pack), pack.level.lab, accentBeats(pack));
  const barOf = (b: number) => Math.floor(b / 4 + 1e-6);
  const holdAt = new Set(c.holds.map((h) => Math.round(h.a * 100)));
  const ember = pack.level.id === 'heroes';
  // each world's own objects (2026-11-26): what its pads, launches, mid-air taps and form moves are in that world
  const NAMES: Record<string, Partial<Record<'pad' | 'leap' | 'ember' | 'sat' | 'pulsar' | 'meteor' | 'orb' | 'vent' | 'dual', string>>> = {
    royalty: { dual: 'two sparks, his and Helion’s (dual)', pad: 'its hand, sweeping (pad)', leap: 'a throw (launch)', ember: 'a light (in the air)', meteor: 'a seal (Meteor wall)', sat: 'a seal-knot (wave turn)', pulsar: 'a shard of its stone (flip)', orb: 'a light' },
    ambush: { pad: 'a slab of debris (pad)', leap: 'a throw into the dark (launch)', ember: 'a light to catch (in the air)', sat: 'a wreck’s edge (wave turn)', meteor: 'a dead fragment (Meteor wall)', vent: 'the skip (vent)', orb: 'a light to catch' },
    skyhigh: { pad: 'kite (pad)', leap: 'gust (launch)', ember: 'wind chime (in the air)', sat: 'knot of residue (wave turn)', orb: 'wind chime' },
    blank: { pad: 'ripple (pad)', leap: 'mirror portal (launch)', ember: 'droplet of light (in the air)', pulsar: 'ice shard (ball flip)', orb: 'droplet of light' },
    invincible: { dual: 'two sparks (dual)', pad: 'seed pod (pad)', leap: 'vine (launch)', ember: 'seed-light (in the air)', pulsar: 'thorn knot (snap)', orb: 'seed-light' },
  };
  const nm = NAMES[pack.level.id] ?? {};
  for (const v of Object.values(nm)) OBJECT.add(v);
  const kind0 = (p: (typeof c.presses)[number]): string => {
    if (p.leap && !p.leap.ember && nm.leap) return nm.leap;
    if (p.leap?.ember && nm.ember) return nm.ember;
    if (p.pad === 'jump' && nm.pad) return nm.pad;
    if (p.pad === 'vent' && nm.vent) return nm.vent;
    if (c.bars[barOf(p.beat)]?.dual && nm.dual && !p.leap) return nm.dual;
    if (p.orb === 'jump' && !p.leap && nm.orb) return nm.orb;
    if (holdAt.has(Math.round(p.beat * 100))) return 'hold';
    if (c.bars[barOf(p.beat)]?.mini && !p.leap && !p.pad) return 'mini (tight gust)';
    if (p.form !== 'orb' && !p.leap && !p.smash && (nm as Record<string, string>)[p.form]) return (nm as Record<string, string>)[p.form];
    return kind(p);
  };
  const kind = (p: (typeof c.presses)[number]): string => {
    if (p.leap && !p.leap.ember) return ember ? 'launch (a strike, a fling)' : pack.level.id === 'started' ? 'leap (the signal, the hand)' : 'leap';
    if (p.leap?.ember) return ember ? 'ember in the air' : 'a light in the air (in a leap)';
    if (p.smash) return 'great node';
    if (p.pad === 'vent') return 'lava vent';
    if (p.pad === 'jump') return ember ? 'bellows (pad)' : pack.level.id === 'started' ? 'stone flower (pad)' : 'jump pad';
    if (p.pad === 'spring') return 'spring';
    if (p.sling) return 'planet hop';
    if (p.orb === 'jump') return ember ? 'ember in the air' : pack.level.id === 'started' ? 'mote of light (jump orb)' : 'jump orb';
    if (p.orb) return `${p.orb} orb`;
    if (p.form === 'meteor') return ember ? 'anvil (Meteor wall)' : 'Meteor wall';
    if (p.form !== 'orb') return `${p.form} move`;
    if (holdAt.has(Math.round(p.beat * 100))) return 'hold';
    if (p.spin) return 'spin gate';
    if (p.weave) return 'weave';
    if (p.kind === 'flip') return 'gravity flip';
    return 'tap';
  };
  const ps = c.presses.filter((p) => !p.auto && p.act !== 'up');
  const types = ps.map(kind0);
  const objects = types.filter((t) => OBJECT.has(t)).length;
  const minutes = ps.length ? ((ps[ps.length - 1].beat - ps[0].beat) * c.spb) / 60 : 1;
  const first = barOf(ps[0]?.beat ?? 0), last = barOf(ps[ps.length - 1]?.beat ?? 0);
  const phrases: Journey['phrases'] = [];
  for (let b = first; b <= last; b += 8) {
    const t = new Set<string>(), o = new Set<string>();
    ps.forEach((p, i) => { if (barOf(p.beat) >= b && barOf(p.beat) < b + 8) { t.add(types[i]); if (OBJECT.has(types[i])) o.add(types[i]); } });
    for (const g of c.turns) if (barOf(g) >= b && barOf(g) < b + 8) t.add('turn');
    for (const g of c.portals) if (barOf(g.beat) >= b && barOf(g.beat) < b + 8) t.add('speed gate');
    for (const g of [...c.mirrors, ...c.inverts]) if (barOf(g) >= b && barOf(g) < b + 8) { t.add(nm.leap === 'mirror portal (launch)' ? 'mirror portal (the world turns over)' : 'world turns over'); }
    phrases.push({ bars: `${b}-${Math.min(b + 7, last)}`, types: [...t], objects: [...o], ok: t.size >= 4 && o.size >= 1 });
  }
  // plain taps: a run of ordinary hops with nothing else on them (not counted in the calm intro, before the first build or drop)
  const calmEnd = (level.segments.find((g) => !/VERSE|INTRO|CALM/i.test(g.label))?.bar0 ?? 0) * 4;
  const event = (b: number) => c.turns.some((g) => Math.abs(g - b) < 1e-6) || c.portals.some((g) => Math.abs(g.beat - b) < 1e-6);
  let best = { bars: 0, from: 0, to: 0 }, start = -1;
  ps.forEach((p, i) => {
    const plain = types[i] === 'tap' && !event(p.beat);
    if (plain && start < 0) start = i;
    if ((!plain || i === ps.length - 1) && start >= 0) {
      const a = start > 0 ? ps[start - 1].beat : ps[start].beat, z = plain ? ps[i].beat : p.beat;
      const from = Math.max(a, calmEnd), len = (z - from) / 4;
      if (z > calmEnd && len > best.bars) best = { bars: +len.toFixed(2), from: barOf(from), to: barOf(z) };
      start = -1;
    }
  });
  const places = pack.level.places?.length ?? new Set(c.presses.map((p) => p.planetTo)).size;
  const hops = c.presses.filter((p) => (p.leap && !p.leap.ember) || p.sling).length;
  let shortest = Infinity, run = 1, worst = { taps: 1, at: 0 };
  for (let i = 1; i < ps.length; i++) {
    const g = (ps[i].beat - ps[i - 1].beat) * c.spb;
    shortest = Math.min(shortest, g);
    run = g < QUICK_S - 1e-6 ? run + 1 : 1;
    if (run > worst.taps) worst = { taps: run, at: +(ps[i - run + 1].beat * c.spb).toFixed(2) };
  }
  const lands = c.presses.filter((p) => p.leap && !p.leap.ember).map((p) => { const b1 = p.leap!.b1, nx = ps.find((q) => q.beat > b1 - 1e-6); return nx ? (nx.beat - b1) * c.spb : 99; });
  return { id: pack.level.id, places, hops, objects, objectsPerMin: +(objects / Math.max(0.1, minutes)).toFixed(1), minutes: +minutes.toFixed(2), phrases, plain: { ...best, ok: best.bars <= 4 },
    shortestGap: +shortest.toFixed(3), quickRun: { ...worst, ok: worst.taps <= (LOCAL[pack.level.id]?.run ?? 99) && shortest >= (LOCAL[pack.level.id]?.floor ?? 0) - 1e-3 },
    landing: { shortest: +(lands.length ? Math.min(...lands) : 99).toFixed(2), ok: lands.every((x) => x >= c.spb - 1e-6) } };
}

const isMain = typeof process !== 'undefined' && !process.env.VITEST;
if (isMain) {
  const ids = process.argv.slice(2).filter((x) => !x.startsWith('-'));
  const packs = (ids.length ? ids : [FIRST.level.id, 'heroes']).map((id) => (id === FIRST.level.id ? FIRST : id === 'ambush' ? AMBUSH : id === 'royalty' ? FINAL : PACKS.find((p) => p.level.id === id)!));
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
  console.log('\nTHE JOURNEY (places, hops, objects, actions per phrase, plain taps)');
  const js = packs.map(journey);
  for (const j of js) {
    console.log(`\n${j.id}: shortest gap ${j.shortestGap} s; longest run of quick taps ${j.quickRun.taps} (at ${j.quickRun.at} s) ${j.quickRun.ok ? 'ok' : `OVER (table: gap ${LOCAL[j.id]?.floor} s, run ${LOCAL[j.id]?.run})`}; landing to first tap ${j.landing.shortest === 99 ? '-' : `${j.landing.shortest} s`} ${j.landing.ok ? 'ok' : 'UNDER A BEAT'}`);
    console.log(`${j.id}: ${j.places} places, ${j.hops} hops; ${j.objects} object interactions, ${j.objectsPerMin} a minute; longest plain-tap stretch ${j.plain.bars} bars (bars ${j.plain.from}-${j.plain.to}) ${j.plain.ok ? 'ok' : 'OVER 4'}`);
    for (const p of j.phrases) console.log(`  phrase ${p.bars.padEnd(6)} ${p.types.length} action types (${p.types.join(', ')}); objects: ${p.objects.join(', ') || 'none'}  ${p.ok ? 'ok' : 'UNDER'}`);
  }
  writeFileSync(new URL('./cache/journey.json', import.meta.url), JSON.stringify(js, null, 1));
}
