// Side quests: two per level, each a way of clearing it well. A quest is done by a counted clear that meets it
// (not practice, not autoplay). Both quests of a level give an orb.
export interface QuestStats {
  /** share of judged taps that were on the beat, 0..100 */
  onBeatPct: number;
  /** how big the drop was, 0..1 */
  dropPower: number;
  bestStreak: number;
  holdsFull: number;
  holds: number;
  /** taps that met nothing at all */
  strays: number;
}
export interface Quest { id: string; level: string; name: string; desc: string; done: (s: QuestStats) => boolean }

const fullDrop = (s: QuestStats) => s.dropPower >= 0.995;
const everyHold = (s: QuestStats) => s.holds > 0 && s.holdsFull >= s.holds;
const onBeat90 = (s: QuestStats) => s.onBeatPct >= 90;

export const QUESTS: Quest[] = [
  { id: 'heroes_drop', level: 'heroes', name: 'Ignition', desc: 'Clear it with the drop at 100%', done: fullDrop },
  { id: 'heroes_holds', level: 'heroes', name: 'Rail Rider', desc: 'Clear it with every hold collected in full', done: everyHold },
  { id: 'skyhigh_beat', level: 'skyhigh', name: 'Metronome', desc: 'Clear it with 90% of your taps on the beat', done: onBeat90 },
  { id: 'skyhigh_clean', level: 'skyhigh', name: 'Nothing Wasted', desc: 'Clear it without a single tap that meets nothing', done: (s) => s.strays === 0 },
  { id: 'blank_streak', level: 'blank', name: 'Unbroken', desc: 'Clear it with a streak of 80 on-beat taps', done: (s) => s.bestStreak >= 80 },
  { id: 'blank_holds', level: 'blank', name: 'Glide Path', desc: 'Clear it with every hold collected in full', done: everyHold },
  { id: 'invincible_drop', level: 'invincible', name: 'Critical Mass', desc: 'Clear it with the drop at 100%', done: fullDrop },
  { id: 'invincible_beat', level: 'invincible', name: 'Twin Pulse', desc: 'Clear it with 90% of your taps on the beat', done: onBeat90 }
];

export const questsFor = (level: string): Quest[] => QUESTS.filter((q) => q.level === level);
/** Quests of this level that this clear completes and that were not done before. */
export const questsEarned = (level: string, s: QuestStats, have: Record<string, boolean>): Quest[] => questsFor(level).filter((q) => !have[q.id] && q.done(s));
/** Both quests of a level done. */
export const questSet = (level: string, have: Record<string, boolean>): boolean => { const q = questsFor(level); return q.length > 0 && q.every((x) => !!have[x.id]); };
