// Orbs (ball skins) and badges for the ring-hop game: clears, flow, the drop, and playing a level cold.
export interface Badge { id: string; name: string; desc: string }
/** needs: a badge id, or "quests:<level>" (both of its quests done), or "moon:<level>" (its B-side cleared) */
export interface Orb { id: string; name: string; rgb: [number, number, number]; needs: string | null; how: string }

const MASTERY: Array<[string, string, string]> = [['heroes', 'Emberwick', 'Heroes Tonight'], ['skyhigh', 'Cirra', 'Sky High'], ['blank', 'Glassmere', 'Blank'], ['invincible', 'Verdance', 'Invincible'], ['royalty', 'The Hollow', 'Royalty']];
export const BADGES: Badge[] = [
  { id: 'clear_heroes', name: 'First Light', desc: 'Clear Heroes Tonight' },
  { id: 'clear_skyhigh', name: 'Sky High', desc: 'Clear Sky High' },
  { id: 'clear_blank', name: 'Blank Slate', desc: 'Clear Blank' },
  { id: 'clear_invincible', name: 'Invincible', desc: 'Clear Invincible' },
  { id: 'setlist', name: 'One More Orbit', desc: 'Clear all four levels' },
  { id: 'clear_royalty', name: 'Event Horizon', desc: 'Clear Royalty, the level behind the gate' },
  { id: 'in_flow', name: 'In The Pocket', desc: 'Clear a level with 85% of your taps on the beat' },
  { id: 'full_drop', name: 'Full Send', desc: 'Set off a drop at 100%: fully charged and in flow' },
  { id: 'streak', name: 'Locked In', desc: 'Reach a streak of 60 on-beat taps' },
  { id: 'few_tries', name: 'Quick Study', desc: 'Clear a level within 10 attempts' },
  { id: 'no_practice', name: 'Sight Read', desc: 'Clear a level you have never practised' },
  // mastery, per planet: every piece of gold on a clear, and all three lens shards
  ...MASTERY.flatMap(([id, planet, song]): Badge[] => [
    { id: `tune_${id}`, name: `In Tune: ${planet}`, desc: `Clear ${song} with every piece of gold collected` },
    { id: `mender_${id}`, name: `Lens Mender: ${planet}`, desc: `Keep all three lens shards on ${song}` }
  ])
];

export const ORBS: Orb[] = [
  { id: 'cyan', name: 'Classic', rgb: [0, 245, 255], needs: null, how: 'Yours from the start' },
  { id: 'ember', name: 'Ember', rgb: [255, 150, 90], needs: 'clear_heroes', how: 'Clear Heroes Tonight' },
  { id: 'violet', name: 'Violet', rgb: [190, 120, 255], needs: 'clear_skyhigh', how: 'Clear Sky High' },
  { id: 'frost', name: 'Frost', rgb: [225, 240, 255], needs: 'clear_blank', how: 'Clear Blank' },
  { id: 'toxic', name: 'Toxic', rgb: [160, 255, 70], needs: 'clear_invincible', how: 'Clear Invincible' },
  { id: 'gold', name: 'Gold', rgb: [255, 214, 90], needs: 'full_drop', how: 'Set off a drop at 100%' },
  { id: 'rose', name: 'Rose', rgb: [255, 90, 160], needs: 'in_flow', how: 'Clear a level with 85% on the beat' },
  { id: 'singular', name: 'Singular', rgb: [255, 255, 255], needs: 'clear_royalty', how: 'Clear Royalty' },
  // quests: both of a level's quests
  { id: 'coral', name: 'Coral', rgb: [255, 120, 110], needs: 'quests:heroes', how: 'Both quests on Heroes Tonight' },
  { id: 'magenta', name: 'Magenta', rgb: [255, 90, 240], needs: 'quests:skyhigh', how: 'Both quests on Sky High' },
  { id: 'azure', name: 'Azure', rgb: [90, 160, 255], needs: 'quests:blank', how: 'Both quests on Blank' },
  { id: 'mint', name: 'Mint', rgb: [90, 255, 190], needs: 'quests:invincible', how: 'Both quests on Invincible' },
  // moons: a level's B-side cleared
  { id: 'halo', name: 'Halo', rgb: [255, 176, 40], needs: 'moon:heroes', how: 'Clear the B-side of Heroes Tonight' },
  { id: 'eclipse', name: 'Eclipse', rgb: [130, 110, 255], needs: 'moon:skyhigh', how: 'Clear the B-side of Sky High' },
  { id: 'silver', name: 'Silver', rgb: [200, 205, 220], needs: 'moon:blank', how: 'Clear the B-side of Blank' },
  { id: 'crimson', name: 'Crimson', rgb: [255, 60, 90], needs: 'moon:invincible', how: 'Clear the B-side of Invincible' }
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
