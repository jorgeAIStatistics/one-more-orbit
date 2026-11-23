// Orbs (ball skins) and badges for the ring-hop game: clears, flow, the drop, and playing a level cold.
export interface Badge { id: string; name: string; desc: string }
export interface Orb { id: string; name: string; rgb: [number, number, number]; needs: string | null; how: string }

export const BADGES: Badge[] = [
  { id: 'clear_heroes', name: 'First Light', desc: 'Clear Heroes Tonight' },
  { id: 'clear_skyhigh', name: 'Sky High', desc: 'Clear Sky High' },
  { id: 'clear_blank', name: 'Blank Slate', desc: 'Clear Blank' },
  { id: 'clear_invincible', name: 'Invincible', desc: 'Clear Invincible' },
  { id: 'setlist', name: 'One More Orbit', desc: 'Clear all four levels' },
  { id: 'in_flow', name: 'In The Pocket', desc: 'Clear a level with 85% of your taps on the beat' },
  { id: 'full_drop', name: 'Full Send', desc: 'Set off a drop at 100%: fully charged and in flow' },
  { id: 'streak', name: 'Locked In', desc: 'Reach a streak of 60 on-beat taps' },
  { id: 'few_tries', name: 'Quick Study', desc: 'Clear a level within 10 attempts' },
  { id: 'no_practice', name: 'Sight Read', desc: 'Clear a level you have never practised' }
];

export const ORBS: Orb[] = [
  { id: 'cyan', name: 'Classic', rgb: [0, 245, 255], needs: null, how: 'Yours from the start' },
  { id: 'ember', name: 'Ember', rgb: [255, 150, 90], needs: 'clear_heroes', how: 'Clear Heroes Tonight' },
  { id: 'violet', name: 'Violet', rgb: [190, 120, 255], needs: 'clear_skyhigh', how: 'Clear Sky High' },
  { id: 'frost', name: 'Frost', rgb: [225, 240, 255], needs: 'clear_blank', how: 'Clear Blank' },
  { id: 'toxic', name: 'Toxic', rgb: [160, 255, 70], needs: 'clear_invincible', how: 'Clear Invincible' },
  { id: 'gold', name: 'Gold', rgb: [255, 214, 90], needs: 'full_drop', how: 'Set off a drop at 100%' },
  { id: 'rose', name: 'Rose', rgb: [255, 90, 160], needs: 'in_flow', how: 'Clear a level with 85% on the beat' }
];

export const orbColour = (id: string) => (ORBS.find((o) => o.id === id) || ORBS[0]).rgb;

export interface ClearStats { onBeatPct: number; dropPower: number; bestStreak: number; attempts: number; practised: boolean }
/** Badges a finished, counted, cleared run has earned. */
export function earned(levelId: string, s: ClearStats, cleared: string[]): string[] {
  const out = [`clear_${levelId}`];
  if (cleared.length >= 4) out.push('setlist');
  if (s.onBeatPct >= 85) out.push('in_flow');
  if (s.dropPower >= 0.995) out.push('full_drop');
  if (s.bestStreak >= 60) out.push('streak');
  if (s.attempts <= 10) out.push('few_tries');
  if (!s.practised) out.push('no_practice');
  return out;
}
