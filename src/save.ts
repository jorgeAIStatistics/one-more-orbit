import type { Grade } from './game/rules';

const KEY = 'one_more_orbit_v4';

export interface LevelBest {
  score: number;
  accuracy: number;
  pct: number;
  grade: Grade | '';
  cleared: boolean;
  attempts: number;
}

export interface SaveData {
  music: number;
  sfx: number;
  audioOffset: number; // ms; raise it if your taps read late
  visualOffset: number; // ms; raise it if the ball looks behind the music
  reducedMotion: boolean;
  hardcore: boolean;
  errorBar: boolean;
  bests: Record<string, LevelBest>;
  teachSeen: Record<string, boolean>;
}

const defaults = (): SaveData => ({
  music: 0.8, sfx: 0.7, audioOffset: 0, visualOffset: 0, reducedMotion: false, hardcore: false, errorBar: true, bests: {}, teachSeen: {}
});

function load(): SaveData {
  const d = defaults();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<SaveData>;
      Object.assign(d, p, { bests: {}, teachSeen: { ...(p.teachSeen || {}) } });
      // bests are per level now; entries from the three-difficulty build ("skyhigh:hard") are dropped
      for (const [k, v] of Object.entries(p.bests || {})) if (!k.includes(':')) d.bests[k] = v as LevelBest;
    }
  } catch { /* storage unavailable: play with defaults */ }
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
