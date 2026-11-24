import { describe, expect, it } from 'vitest';
import { OLD_QUESTS, ORBS } from '../src/game/extras';
import { BSIDES, FINAL, PACKS } from '../src/game/packs';
import { STARS, STAR_PLACES, STAR_TOTAL, starLit, starsLit, starsOf, type StarProgress } from '../src/game/stars';
import { GATE_CLEARS, NODES, TIERS, maxStars, nodeOf, nodeState, playable, totalStars, type Progress } from '../src/game/world';

const ids = PACKS.map((p) => p.level.id);
const progress = (cleared: string[], stars: Record<string, boolean[]> = {}, unlockAll = false): Progress => ({ cleared: (id) => cleared.includes(id), stars: (id) => stars[id] ?? [false, false, false], unlockAll });
const all3 = [true, true, true];

describe('world 1: the map', () => {
  it('has four planets in order, a moon for each, and the gate last', () => {
    expect(NODES.filter((n) => n.kind === 'planet').map((n) => n.id)).toEqual(ids);
    expect(NODES.filter((n) => n.kind === 'moon').map((n) => n.id)).toEqual(BSIDES.map((b) => b.level.id));
    expect(NODES[NODES.length - 1].kind).toBe('gate');
    expect(maxStars).toBe(15); // three in each of the four levels, and three behind the gate
    expect(TIERS[FINAL.level.id]).toBe('Singularity');
    expect(GATE_CLEARS).toBe(PACKS.length); // the gate asks for the four clears, never for shards
    for (const id of ids) expect(TIERS[id]).toBeTruthy();
  });

  it('a new player sees the first planet open, the others locked, no moons, and a locked gate', () => {
    const p = progress([]);
    expect(nodeState(nodeOf('heroes'), p)).toBe('open');
    for (const id of ids.slice(1)) { expect(nodeState(nodeOf(id), p)).toBe('locked'); expect(playable(nodeOf(id), p)).toBe(false); }
    for (const b of BSIDES) expect(nodeState(nodeOf(b.level.id), p)).toBe('hidden');
    expect(nodeState(nodeOf('gate'), p)).toBe('locked');
  });

  it('clearing a planet opens the next; clearing alone never shows a moon', () => {
    const p = progress(['heroes', 'skyhigh']);
    expect(nodeState(nodeOf('heroes'), p)).toBe('cleared');
    expect(nodeState(nodeOf('blank'), p)).toBe('open');
    expect(nodeState(nodeOf('invincible'), p)).toBe('locked');
    expect(nodeState(nodeOf('heroes-b'), p)).toBe('hidden');
    expect(playable(nodeOf('heroes'), p)).toBe(true);
  });

  it('a moon is found with all three of its planet\'s stars, and only that planet\'s', () => {
    const p = progress(['heroes'], { heroes: all3, skyhigh: [true, true, false] });
    expect(nodeState(nodeOf('heroes-b'), p)).toBe('open');
    expect(playable(nodeOf('heroes-b'), p)).toBe(true);
    expect(nodeState(nodeOf('skyhigh-b'), p)).toBe('hidden');
    expect(nodeState(nodeOf('heroes-b'), progress(['heroes', 'heroes-b'], { heroes: all3 }))).toBe('cleared');
  });

  it('the gate opens when all four planets are cleared, however few shards were kept, and the last level is behind it', () => {
    expect(GATE_CLEARS).toBe(4);
    const eight = { heroes: all3, skyhigh: all3, blank: [true, true, false] };
    expect(totalStars(progress([], eight))).toBe(8);
    expect(nodeState(nodeOf('gate'), progress(ids.slice(0, 3), { ...eight, invincible: all3 }))).toBe('locked'); // shards do not open it
    expect(nodeState(nodeOf('gate'), progress(ids))).toBe('open'); // clears do, with no shards at all
    expect(playable(nodeOf('gate'), progress(ids.slice(0, 3), eight))).toBe(false);
    expect(playable(nodeOf('gate'), progress(ids))).toBe(true);
    expect(nodeState(nodeOf('gate'), progress([...ids, FINAL.level.id]))).toBe('cleared');
    // its own three shards count toward the total
    expect(totalStars(progress([], { ...eight, [FINAL.level.id]: all3 }))).toBe(11);
  });

  it('the playtest switch opens the planets and shows the moons, but not the gate', () => {
    const p = progress([], {}, true);
    for (const n of NODES) expect(nodeState(n, p)).toBe(n.kind === 'gate' ? 'locked' : 'open');
  });
});

describe('stars (they took the place of quests and the badges screen)', () => {
  const sp = (o: { cleared?: string[]; gold?: Record<string, number>; feats?: string[] } = {}): StarProgress => ({ cleared: (id) => (o.cleared ?? []).includes(id), gold: (id) => o.gold?.[id] ?? 0, feat: (k) => (o.feats ?? []).includes(k) });
  it('five for each planet, three for the Hollow, two for the ambush, one kept by a hidden moon: 26', () => {
    for (const id of ids) expect(starsOf(id).map((s) => s.kind)).toEqual(['restore', 'shards', 'dare', 'master', 'night']);
    expect(starsOf(FINAL.level.id).map((s) => s.kind)).toEqual(['restore', 'dare', 'master']);
    expect(starsOf('ambush').length).toBe(2);
    expect(STAR_TOTAL).toBe(26);
    expect(STAR_PLACES).toEqual([...ids, 'ambush', FINAL.level.id]);
    expect(new Set(STARS.map((s) => s.id)).size).toBe(STARS.length); // (each can be a Game Center achievement later)
    for (const s of STARS) { expect(s.id).toMatch(/^star_[a-z]+_[a-z]+$/); expect(s.name.length).toBeGreaterThan(2); expect(s.what.length).toBeGreaterThan(8); }
  });
  it('nothing is lit on a new save, and the ambush cannot be lit yet', () => {
    expect(starsLit(sp())).toEqual([]);
    expect(starsOf('ambush').some((s) => starLit(s, sp({ cleared: ['ambush'], feats: ['dare:ambush', 'shards:ambush'], gold: { ambush: 100 } })))).toBe(false);
  });
  it('each star has its own condition', () => {
    const lit = (o: Parameters<typeof sp>[0]) => starsLit(sp(o)).map((s) => s.id);
    expect(lit({ cleared: ['heroes'] })).toEqual(['star_heroes_restore']);
    expect(lit({ cleared: ['heroes'], feats: ['shards:heroes'] })).toEqual(['star_heroes_restore', 'star_heroes_shards']);
    expect(lit({ cleared: ['heroes'], feats: ['dare:heroes'] })).toEqual(['star_heroes_restore', 'star_heroes_dare']);
    expect(lit({ cleared: ['heroes'], gold: { heroes: 99 } })).toEqual(['star_heroes_restore']);
    expect(lit({ cleared: ['heroes'], gold: { heroes: 100 } })).toEqual(['star_heroes_restore', 'star_heroes_master']);
    expect(lit({ cleared: ['heroes', 'heroes-b'] })).toEqual(['star_heroes_restore', 'star_heroes_night']);
    expect(lit({ cleared: [FINAL.level.id], feats: [`dare:${FINAL.level.id}`], gold: { [FINAL.level.id]: 100 } }).length).toBe(3);
  });
  it('every planet has a glow for daring it and one for its night side; the old quests are remembered two a level', () => {
    for (const id of ids) {
      expect(ORBS.some((o) => o.needs === `dare:${id}`), `daredevil glow for ${id}`).toBe(true);
      expect(ORBS.some((o) => o.needs === `moon:${id}`), `night-side glow for ${id}`).toBe(true);
      expect(OLD_QUESTS[id].length).toBe(2);
      expect(BSIDES.some((b) => b.level.id === `${id}-b`)).toBe(true);
    }
    expect(new Set(ORBS.map((o) => o.id)).size).toBe(ORBS.length);
    for (const o of ORBS) { expect(o.says.length).toBeGreaterThan(8); expect(o.how.length).toBeGreaterThan(8); }
  });
});
