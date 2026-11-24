import { describe, expect, it } from 'vitest';
import { ORBS } from '../src/game/extras';
import { BSIDES, FINAL, PACKS } from '../src/game/packs';
import { QUESTS, questSet, questsEarned, questsFor, type QuestStats } from '../src/game/quests';
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

describe('quests', () => {
  const stats = (s: Partial<QuestStats>): QuestStats => ({ onBeatPct: 0, dropPower: 0, bestStreak: 0, holdsFull: 0, holds: 30, strays: 5, ...s });
  it('two per level, each with a name and what to do', () => {
    for (const id of ids) expect(questsFor(id).length).toBe(2);
    expect(new Set(QUESTS.map((q) => q.id)).size).toBe(QUESTS.length);
    for (const q of QUESTS) { expect(q.name.length).toBeGreaterThan(2); expect(q.desc.length).toBeGreaterThan(10); }
  });
  it('a plain clear completes none; a perfect one completes both; done quests are not given twice', () => {
    for (const id of ids) {
      expect(questsEarned(id, stats({}), {})).toEqual([]);
      const perfect = stats({ onBeatPct: 100, dropPower: 1, bestStreak: 200, holdsFull: 30, strays: 0 });
      const got = questsEarned(id, perfect, {});
      expect(got.length).toBe(2);
      const have = Object.fromEntries(got.map((q) => [q.id, true]));
      expect(questsEarned(id, perfect, have)).toEqual([]);
      expect(questSet(id, have)).toBe(true);
      expect(questSet(id, { [got[0].id]: true })).toBe(false);
    }
  });
  it('each condition is its own: the drop at 99%, 89% on the beat, one hold short or one stray tap each miss theirs', () => {
    const names = (id: string, s: Partial<QuestStats>) => questsEarned(id, stats({ onBeatPct: 100, dropPower: 1, bestStreak: 200, holdsFull: 30, strays: 0, ...s }), {}).map((q) => q.id);
    expect(names('heroes', { dropPower: 0.98 })).toEqual(['heroes_holds']);
    expect(names('heroes', { holdsFull: 29 })).toEqual(['heroes_drop']);
    expect(names('skyhigh', { onBeatPct: 89 })).toEqual(['skyhigh_clean']);
    expect(names('skyhigh', { strays: 1 })).toEqual(['skyhigh_beat']);
    expect(names('blank', { bestStreak: 79 })).toEqual(['blank_holds']);
    expect(names('invincible', { dropPower: 0.5 })).toEqual(['invincible_beat']);
  });
  it('every level has an orb for its quests and one for its moon', () => {
    for (const id of ids) {
      expect(ORBS.some((o) => o.needs === `quests:${id}`), `quest orb for ${id}`).toBe(true);
      expect(ORBS.some((o) => o.needs === `moon:${id}`), `moon orb for ${id}`).toBe(true);
    }
    expect(new Set(ORBS.map((o) => o.id)).size).toBe(ORBS.length);
  });
});
