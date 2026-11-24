import type { Grade } from './game/rules';

const KEY = 'one_more_orbit_v4';

export interface LevelBest {
  score: number;
  accuracy: number;
  pct: number;
  grade: Grade | '';
  cleared: boolean;
  attempts: number;
  /** furthest reached in practice mode, percent */
  prac?: number;
}

export interface SaveData {
  music: number;
  sfx: number;
  audioOffset: number; // ms; raise it if your taps read late
  visualOffset: number; // ms; raise it if the ball looks behind the music
  reducedMotion: boolean;
  hardcore: boolean;
  errorBar: boolean;
  level: number;
  skin: string;
  badges: Record<string, boolean>;
  practiced: Record<string, boolean>;
  bests: Record<string, LevelBest>;
  teachSeen: Record<string, boolean>;
  /** which core the bests belong to: 4 = the ring-hop levels (progress and attempts, no grades) */
  core: number;
  /** the quick sync check has been done (or skipped) on this device */
  calibrated: boolean;
  /** the output delay the device reported when it was last calibrated: a change means new headphones or speakers */
  calLatency: number;
  /** show the live sync overlay while playing */
  syncOverlay: boolean;
  /** volume of the tap sounds, apart from the other effects */
  hitVol: number;
  /** the first-run tutorial on level 1 has been played or skipped */
  tutorialDone: boolean;
  /** playtest: every level open, whatever has been cleared. Off in the released game. */
  unlockAll: boolean;
  /** which release's one-off changes this save has had (1: "all levels open", on in every playtest save, switched off) */
  rel: number;
  /** touches you can feel on taps, the drop, a crash and a clear */
  haptics: boolean;
  /** stars kept, per level: one entry per star trail. A star is kept when the run that collected it clears the level. */
  stars: Record<string, boolean[]>;
  /** the old side quests done, by quest id (no longer earned; kept because a glow can hang on them) */
  quests: Record<string, boolean>;
  /** feats done once, for the stars: "shards:<level>" (all three shards in one flight), "dare:<level>" (a daredevil clear) */
  feats: Record<string, boolean>;
  /** the place on the world map the player was last at (a level id, a B-side's, or "gate") */
  at: string;
  /** story chapters already shown (open, a planet's id, hollow, end, lens) */
  story: Record<string, boolean>;
  /** best share of a level's gold collected on a counted clear, percent */
  gold: Record<string, number>;
}

const defaults = (): SaveData => ({
  music: 0.8, sfx: 0.7, audioOffset: 0, visualOffset: 0, reducedMotion: false, hardcore: false, errorBar: true, level: 0, skin: 'cyan', badges: {}, practiced: {}, bests: {}, teachSeen: {}, core: 4, calibrated: false, calLatency: -1, syncOverlay: false, hitVol: 1, tutorialDone: false, unlockAll: false, rel: 1, haptics: true, stars: {}, quests: {}, at: '', story: {}, gold: {}, feats: {}
});

function load(): SaveData {
  const d = defaults();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<SaveData>;
      Object.assign(d, p, { bests: {}, teachSeen: { ...(p.teachSeen || {}) }, badges: { ...(p.badges || {}) }, practiced: { ...(p.practiced || {}) }, stars: { ...(p.stars || {}) }, quests: { ...(p.quests || {}) }, story: { ...(p.story || {}) }, gold: { ...(p.gold || {}) }, feats: { ...(p.feats || {}) } });
      // bests are per level now; entries from the three-difficulty build ("skyhigh:hard") are dropped
      // ...and so are bests from the judged one-button build: its progress and clears say nothing about this core
      if (p.core === 4) for (const [k, v] of Object.entries(p.bests || {})) if (!k.includes(':')) d.bests[k] = v as LevelBest;
      d.core = 4;
      // the release: the playtest builds saved "all levels open" as on for everyone. It goes off once; clears, stars and
      // everything else stay, and it can still be switched back on in Settings.
      if (!(Number(p.rel) >= 1)) d.unlockAll = false;
      d.rel = 1;
    }
  } catch { /* storage unavailable: play with defaults */ }
  // volumes are always a number from 0 to 1, whatever an older save holds
  const vol = (v: unknown, fallback: number): number => (typeof v === 'number' && isFinite(v) ? Math.max(0, Math.min(1, v)) : fallback);
  d.music = vol(d.music, 0.8);
  d.sfx = vol(d.sfx, 0.7);
  d.hitVol = vol(d.hitVol, 1);
  d.audioOffset = Math.max(-200, Math.min(400, Math.round(Number(d.audioOffset) || 0)));
  d.visualOffset = Math.max(-200, Math.min(400, Math.round(Number(d.visualOffset) || 0)));
  return d;
}

export const save: SaveData = load();

export function persist(): void {
  try { localStorage.setItem(KEY, JSON.stringify(save)); } catch { /* ignore */ }
}

export function bestFor(level: string): LevelBest {
  return save.bests[level] || { score: 0, accuracy: 0, pct: 0, grade: '', cleared: false, attempts: 0 };
}

/** The stars kept on a level, always three entries. */
export function starsFor(level: string): boolean[] {
  const s = save.stars[level] || [];
  return [!!s[0], !!s[1], !!s[2]];
}
export const starCount = (): number => Object.values(save.stars).reduce((n, s) => n + s.filter(Boolean).length, 0);
