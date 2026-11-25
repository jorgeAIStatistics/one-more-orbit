// Stars: the one thing to collect. Each world has a constellation of five, the guardian has three, the ambush two and
// the hidden moon one: 26 in all. They take the place of the old quests and of the badges screen. This file is the
// rules only (which star is lit); the sky from the rim draws them.
// Every star's id is stable ("star_heroes_dare"), so each can be given a Game Center achievement later.
import { FINAL, PACKS } from './packs';

export type StarKind = 'restore' | 'shards' | 'dare' | 'master' | 'night' | 'soon';
export interface Star {
  id: string;
  /** the constellation it belongs to: a level's id, or "ambush" */
  place: string;
  kind: StarKind;
  name: string;
  /** its one line: what it asks */
  what: string;
}
/** What the rules read from the saved game. */
export interface StarProgress {
  cleared: (level: string) => boolean;
  /** the best share of a level's gold collected on a clear, percent */
  gold: (level: string) => number;
  /** a feat done once: "shards:<level>" (all three shards in one flight), "dare:<level>" (cleared on a daredevil flight) */
  feat: (key: string) => boolean;
}

const FINAL_ID = FINAL.level.id;
const star = (place: string, kind: StarKind, name: string, what: string, tag: string = kind): Star => ({ id: `star_${place}_${tag}`, place, kind, name, what });
const five = (id: string): Star[] => [
  star(id, 'restore', 'Reignite', 'wake its star'),
  star(id, 'shards', 'Shard run', 'all three shards in one flight'),
  star(id, 'dare', 'Daredevil', 'one attempt: a fall sends you home'),
  star(id, 'master', 'Rhythm master', 'touch every gold note'),
  star(id, 'night', 'Night side', 'clear its far side')
];
export const STARS: Star[] = [
  ...PACKS.flatMap((p) => five(p.level.id)),
  // the ambush is not in the sky yet: its two stars are shown, faint, and cannot be lit
  star('ambush', 'soon', 'Stand', 'come through it', 'stand'),
  star('ambush', 'soon', 'Every window', 'lose none of the four', 'windows'),
  star(FINAL_ID, 'restore', 'Reignite', 'light the guardian\u2019s star'),
  star(FINAL_ID, 'dare', 'Daredevil', 'one attempt: a fall sends you home'),
  star(FINAL_ID, 'master', 'Rhythm master', 'touch every gold note')
];
/** All there are to light in World 1: the ones above, and one more that a hidden moon keeps. */
export const STAR_TOTAL = STARS.length + 1;
/** The constellations, in the order the chart shows them. */
export const STAR_PLACES: string[] = [...PACKS.map((p) => p.level.id), 'ambush', FINAL_ID];

export function starLit(s: Star, p: StarProgress): boolean {
  switch (s.kind) {
    case 'restore': return p.cleared(s.place);
    case 'shards': return p.feat(`shards:${s.place}`);
    case 'dare': return p.feat(`dare:${s.place}`);
    case 'master': return p.cleared(s.place) && p.gold(s.place) >= 100;
    case 'night': return p.cleared(`${s.place}-b`);
    default: return false;
  }
}
export const starsOf = (place: string): Star[] => STARS.filter((s) => s.place === place);
export const starsLit = (p: StarProgress): Star[] => STARS.filter((s) => starLit(s, p));
