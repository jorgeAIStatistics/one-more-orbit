// Glows (the colour of the light Orbin gives) and the old badges: clears, flow, the drop, and playing a level cold.
// The badges screen is gone (stars took its place, see stars.ts); the badges themselves are still earned, because
// Game Center's achievements and two of the glows hang on them.
export interface Badge { id: string; name: string; desc: string }
/** needs: a badge id, or "dare:<level>" (its Daredevil star), or "moon:<level>" (its night side cleared) */
export interface Orb { id: string; name: string; rgb: [number, number, number]; needs: string | null; /** what it is, in the world's words */ says: string; /** what lights it */ how: string }

const MASTERY: Array<[string, string, string]> = [['heroes', 'Emberwick', 'Heroes Tonight'], ['skyhigh', 'Cirra', 'Sky High'], ['blank', 'Glassmere', 'Blank'], ['invincible', 'Verdance', 'Invincible'], ['royalty', 'The guardian', 'Royalty']];
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
  // mastery, per world: every piece of gold on a clear, and all three star shards
  ...MASTERY.flatMap(([id, planet, song]): Badge[] => [
    { id: `tune_${id}`, name: `In Tune: ${planet}`, desc: `Clear ${song} with every piece of gold collected` },
    { id: `mender_${id}`, name: `Shard Finder: ${planet}`, desc: `Keep all three star shards on ${song}` }
  ])
];

export const ORBS: Orb[] = [
  { id: 'cyan', name: 'Starlight', rgb: [255, 204, 112], needs: null, says: 'the light Orbin fell with', how: 'yours from the start' },
  { id: 'ember', name: 'Ember', rgb: [255, 150, 90], needs: 'clear_heroes', says: 'a coal from Ossa\u2019s forge', how: 'wake Emberwick' },
  { id: 'violet', name: 'Violet', rgb: [190, 120, 255], needs: 'clear_skyhigh', says: 'a thread from Seo\u2019s kite', how: 'wake Cirra' },
  { id: 'frost', name: 'Frost', rgb: [225, 240, 255], needs: 'clear_blank', says: 'a sliver of Vell\u2019s glass', how: 'wake Glassmere' },
  { id: 'toxic', name: 'Toxic', rgb: [160, 255, 70], needs: 'clear_invincible', says: 'a seed light from Morrow\u2019s woods', how: 'wake Verdance' },
  { id: 'gold', name: 'Tide', rgb: [0, 245, 255], needs: 'full_drop', says: 'a drop, caught whole', how: 'set off a drop at full charge' },
  { id: 'rose', name: 'Rose', rgb: [255, 90, 160], needs: 'in_flow', says: 'what keeping time looks like', how: 'wake a star with 85 taps in 100 on the beat' },
  { id: 'singular', name: 'Singular', rgb: [255, 255, 255], needs: 'clear_royalty', says: 'the guardian\u2019s own star', how: 'reignite the guardian' },
  // a planet dared: its Daredevil star (these were the quests' glows, and whoever did both of a level's quests keeps its)
  { id: 'coral', name: 'Coral', rgb: [255, 120, 110], needs: 'dare:heroes', says: 'Emberwick, dared', how: 'the Daredevil star on Emberwick' },
  { id: 'magenta', name: 'Magenta', rgb: [255, 90, 240], needs: 'dare:skyhigh', says: 'Cirra, dared', how: 'the Daredevil star on Cirra' },
  { id: 'azure', name: 'Azure', rgb: [90, 160, 255], needs: 'dare:blank', says: 'Glassmere, dared', how: 'the Daredevil star on Glassmere' },
  { id: 'mint', name: 'Mint', rgb: [90, 255, 190], needs: 'dare:invincible', says: 'Verdance, dared', how: 'the Daredevil star on Verdance' },
  // a night side cleared
  { id: 'halo', name: 'Halo', rgb: [255, 176, 40], needs: 'moon:heroes', says: 'from the night side of Emberwick', how: 'the Night side star on Emberwick' },
  { id: 'eclipse', name: 'Eclipse', rgb: [130, 110, 255], needs: 'moon:skyhigh', says: 'from the night side of Cirra', how: 'the Night side star on Cirra' },
  { id: 'silver', name: 'Silver', rgb: [200, 205, 220], needs: 'moon:blank', says: 'from the night side of Glassmere', how: 'the Night side star on Glassmere' },
  { id: 'crimson', name: 'Crimson', rgb: [255, 60, 90], needs: 'moon:invincible', says: 'from the night side of Verdance', how: 'the Night side star on Verdance' }
];
/** The old quests, two a level. They are no longer earned or shown; a save that has both of a level's keeps the glow they gave. */
export const OLD_QUESTS: Record<string, [string, string]> = { heroes: ['heroes_drop', 'heroes_holds'], skyhigh: ['skyhigh_beat', 'skyhigh_clean'], blank: ['blank_streak', 'blank_holds'], invincible: ['invincible_drop', 'invincible_beat'] };

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
