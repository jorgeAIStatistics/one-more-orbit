import type { Difficulty } from './game/types';
import type { Grade } from './game/rules';

const KEY = 'one_more_orbit_v4';

export interface ChartBest {
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
  audioOffset: number; // ms; raise it if you hear the music late
  visualOffset: number; // ms; raise it if the ball looks late
  reducedMotion: boolean;
  hardcore: boolean;
  errorBar: boolean;
  unlockAll: boolean;
  difficulty: Difficulty;
  bests: Record<string, ChartBest>;
  teachSeen: Record<string, boolean>;
}

const defaults = (): SaveData => ({
  music: 0.8,
  sfx: 0.7,
  audioOffset: 0,
  visualOffset: 0,
  reducedMotion: false,
  hardcore: false,
  errorBar: true,
  unlockAll: true, // playtest build: everything open. Turn off in Settings to try the real unlock chain.
  difficulty: 'normal',
  bests: {},
  teachSeen: {}
});

function load(): SaveData {
  const d = defaults();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<SaveData>;
      Object.assign(d, p, { bests: { ...(p.bests || {}) }, teachSeen: { ...(p.teachSeen || {}) } });
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

export const chartKey = (level: string, d: Difficulty) => `${level}:${d}`;

export function bestFor(level: string, d: Difficulty): ChartBest {
  return save.bests[chartKey(level, d)] || { score: 0, accuracy: 0, pct: 0, grade: '', cleared: false, attempts: 0 };
}

const ORDER: Array<Grade | ''> = ['', 'F', 'D', 'C', 'B', 'A', 'S', 'SS'];
export const gradeAtLeast = (g: Grade | '', min: Grade) => ORDER.indexOf(g) >= ORDER.indexOf(min);

/** HARD opens after clearing NORMAL; INSANE after an A or better on HARD. */
export function unlocked(level: string, d: Difficulty): boolean {
  if (save.unlockAll || d === 'normal') return true;
  if (d === 'hard') return bestFor(level, 'normal').cleared;
  return gradeAtLeast(bestFor(level, 'hard').grade, 'A');
}
