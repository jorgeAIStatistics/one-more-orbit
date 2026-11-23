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
  /** playtest: every level open, whatever has been cleared */
  unlockAll: boolean;
}

const defaults = (): SaveData => ({
  music: 0.8, sfx: 0.7, audioOffset: 0, visualOffset: 0, reducedMotion: false, hardcore: false, errorBar: true, level: 0, skin: 'cyan', badges: {}, practiced: {}, bests: {}, teachSeen: {}, core: 4, calibrated: false, calLatency: -1, syncOverlay: false, hitVol: 1, tutorialDone: false, unlockAll: true
});

function load(): SaveData {
  const d = defaults();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<SaveData>;
      Object.assign(d, p, { bests: {}, teachSeen: { ...(p.teachSeen || {}) }, badges: { ...(p.badges || {}) }, practiced: { ...(p.practiced || {}) } });
      // bests are per level now; entries from the three-difficulty build ("skyhigh:hard") are dropped
      // ...and so are bests from the judged one-button build: its progress and clears say nothing about this core
      if (p.core === 4) for (const [k, v] of Object.entries(p.bests || {})) if (!k.includes(':')) d.bests[k] = v as LevelBest;
      d.core = 4;
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
