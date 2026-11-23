// Orbs (ball skins) and badges, carried over from v3 and adapted to levels, grades and practice mode.
import type { Grade } from './rules';

export interface Badge { id: string; name: string; desc: string }
export interface Orb { id: string; name: string; rgb: [number, number, number]; needs: string | null; how: string }

export const BADGES: Badge[] = [
  { id: 'clear_heroes', name: 'First Light', desc: 'Clear Heroes Tonight' },
  { id: 'clear_skyhigh', name: 'Sky High', desc: 'Clear Sky High' },
  { id: 'clear_blank', name: 'Blank Slate', desc: 'Clear Blank' },
  { id: 'clear_invincible', name: 'Invincible', desc: 'Clear Invincible' },
  { id: 'setlist', name: 'One More Orbit', desc: 'Clear all four levels' },
  { id: 'full_combo', name: 'In The Pocket', desc: 'Clear a level without a single miss' },
  { id: 's_rank', name: 'Laser Focus', desc: 'Earn an S rank on any level' },
  { id: 'ss_rank', name: 'Untouchable', desc: 'Earn SS: every gate PERFECT' },
  { id: 'hardcore', name: 'No Second Chances', desc: 'Clear a level on Hardcore' },
  { id: 'no_practice', name: 'Sight Read', desc: 'Clear a level you have never practised' }
];

export const ORBS: Orb[] = [
  { id: 'cyan', name: 'Classic', rgb: [0, 245, 255], needs: null, how: 'Yours from the start' },
  { id: 'ember', name: 'Ember', rgb: [255, 150, 90], needs: 'clear_heroes', how: 'Clear Heroes Tonight' },
  { id: 'violet', name: 'Violet', rgb: [190, 120, 255], needs: 'clear_skyhigh', how: 'Clear Sky High' },
  { id: 'frost', name: 'Frost', rgb: [225, 240, 255], needs: 'clear_blank', how: 'Clear Blank' },
  { id: 'toxic', name: 'Toxic', rgb: [160, 255, 70], needs: 'clear_invincible', how: 'Clear Invincible' },
  { id: 'gold', name: 'Gold', rgb: [255, 214, 90], needs: 's_rank', how: 'Earn an S rank' },
  { id: 'rose', name: 'Rose', rgb: [255, 90, 160], needs: 'full_combo', how: 'Clear a level without a miss' }
];

export const orbColour = (id: string) => (ORBS.find((o) => o.id === id) || ORBS[0]).rgb;

/** Badges a finished, counted, cleared run has earned. */
export function earned(levelId: string, grade: Grade, misses: number, hardcore: boolean, practised: boolean, cleared: string[]): string[] {
  const out = [`clear_${levelId}`];
  if (cleared.length >= 4) out.push('setlist');
  if (misses === 0) out.push('full_combo');
  if (grade === 'S' || grade === 'SS') out.push('s_rank');
  if (grade === 'SS') out.push('ss_rank');
  if (hardcore) out.push('hardcore');
  if (!practised) out.push('no_practice');
  return out;
}
