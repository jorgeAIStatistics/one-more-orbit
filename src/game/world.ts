// World 1 as a map: the four levels are planets along one route, each with a hidden moon (its B-side), and a gate at
// the end that opens on stars. This file is the rules only (what is open, hidden or cleared); the map screen draws them.
import { BSIDES, FINAL, PACKS } from './packs';

/** Stars needed to open the gate, out of the twelve in the four levels. */
export const GATE_STARS = 9;
/** The level behind the gate. */
export const FINAL_ID = FINAL.level.id;
/** The difficulty ladder, by level: how far from home each one is. */
export const TIERS: Record<string, string> = { heroes: 'Low Orbit', skyhigh: 'High Orbit', blank: 'Escape Velocity', invincible: 'Deep Space', [FINAL.level.id]: 'Singularity' };

export type NodeKind = 'planet' | 'moon' | 'gate';
/** open: playable. cleared: played through. locked: shown, not yet playable. hidden: a moon nobody has found. */
export type NodeState = 'open' | 'cleared' | 'locked' | 'hidden';
export interface MapNode {
  /** the level's id (a moon's is its planet's with "-b"); the gate is "gate" */
  id: string;
  kind: NodeKind;
  /** the planet it belongs to (its own id for a planet, "" for the gate) and that planet's place on the route */
  planet: string;
  index: number;
}
/** What the rules need to know about the player. */
export interface Progress { cleared: (id: string) => boolean; stars: (id: string) => boolean[]; unlockAll: boolean }

const ids = PACKS.map((p) => p.level.id);
/** Every place on the map, in route order: each planet, then its moon; the gate last. */
export const NODES: MapNode[] = [
  ...ids.flatMap((id, index): MapNode[] => [{ id, kind: 'planet', planet: id, index }, { id: BSIDES[index].level.id, kind: 'moon', planet: id, index }]),
  { id: 'gate', kind: 'gate', planet: '', index: ids.length }
];
export const nodeOf = (id: string): MapNode => NODES.find((n) => n.id === id) ?? NODES[0];

/** Stars kept, in the four levels and in the one behind the gate (three each). */
export const totalStars = (p: Progress): number => [...ids, FINAL_ID].reduce((n, id) => n + p.stars(id).filter(Boolean).length, 0);
export const maxStars = (ids.length + 1) * 3;

/**
 * A planet opens when the one before it is cleared. A moon is found when all three of its planet's stars are kept.
 * The gate opens on GATE_STARS stars, and the last level is behind it. The playtest switch ("All levels open") opens
 * the planets and shows the moons; the gate always needs its stars.
 */
export function nodeState(n: MapNode, p: Progress): NodeState {
  if (n.kind === 'gate') return totalStars(p) < GATE_STARS ? 'locked' : p.cleared(FINAL_ID) ? 'cleared' : 'open';
  if (p.cleared(n.id)) return 'cleared';
  if (n.kind === 'moon') return p.unlockAll || p.stars(n.planet).every(Boolean) ? 'open' : 'hidden';
  return n.index === 0 || p.unlockAll || p.cleared(ids[n.index - 1]) ? 'open' : 'locked';
}
/** Can it be played right now. */
export const playable = (n: MapNode, p: Progress): boolean => nodeState(n, p) === 'open' || nodeState(n, p) === 'cleared';
