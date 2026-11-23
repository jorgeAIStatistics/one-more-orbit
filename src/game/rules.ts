import type { Difficulty, Judge } from './types';

/** Timing windows in seconds either side of the note. */
export const WINDOWS: Record<Difficulty, { p: number; g: number; o: number }> = {
  normal: { p: 0.04, g: 0.075, o: 0.11 },
  hard: { p: 0.033, g: 0.062, o: 0.09 },
  insane: { p: 0.027, g: 0.05, o: 0.072 }
};

/** Hold releases are judged this much wider than taps. */
export const RELEASE_SCALE = 1.5;

/** Health is 0..100. A miss costs `miss`; PERFECT heals `heal`, GREAT half of it, GOOD nothing. */
export const HEALTH: Record<Difficulty, { miss: number; heal: number }> = {
  normal: { miss: 12, heal: 3 },
  hard: { miss: 15, heal: 2.5 },
  insane: { miss: 18, heal: 2 }
};

export const WEIGHT: Record<Judge, number> = { perfect: 100, great: 65, good: 30, miss: 0 };
export const POINTS: Record<Judge, number> = { perfect: 300, great: 195, good: 90, miss: 0 };

export const DIFFICULTIES: Difficulty[] = ['normal', 'hard', 'insane'];

export type Grade = 'SS' | 'S' | 'A' | 'B' | 'C' | 'D' | 'F';

export function gradeFor(accuracy: number, misses: number, failed: boolean): Grade {
  if (failed) return 'F';
  if (accuracy >= 99.995) return 'SS';
  if (accuracy >= 95 && misses === 0) return 'S';
  if (accuracy >= 90) return 'A';
  if (accuracy >= 80) return 'B';
  if (accuracy >= 70) return 'C';
  return 'D';
}

export function judgeFor(absErr: number, w: { p: number; g: number; o: number }, scale = 1): Judge {
  if (absErr <= w.p * scale) return 'perfect';
  if (absErr <= w.g * scale) return 'great';
  if (absErr <= w.o * scale) return 'good';
  return 'miss';
}
