import type { Judge } from './types';

/** Timing windows in seconds either side of the note: one set for the whole game. */
export const WINDOW = { p: 0.033, g: 0.062, o: 0.09 };

/** Health is 0..100. A miss costs `miss`; PERFECT heals `heal`, GREAT half of it, GOOD nothing. */
export const HEALTH = { miss: 14, heal: 2.5, stray: 4 };

/** A tap this close before a gate, but outside its GOOD window, is an EARLY MISS for that gate (seconds). */
export const EARLY_ZONE = 0.18;

export const WEIGHT: Record<Judge, number> = { perfect: 100, great: 65, good: 30, miss: 0 };
export const POINTS: Record<Judge, number> = { perfect: 300, great: 195, good: 90, miss: 0 };

/** Each ring is this much bigger than the one inside it (v3's spacing). */
export const ORBIT_RATIO = 1.38;
/** A spike hop lasts this many beats from pad to landing. */
export const HOP_BEATS = 0.5;

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

export function judgeFor(absErr: number): Judge {
  if (absErr <= WINDOW.p) return 'perfect';
  if (absErr <= WINDOW.g) return 'great';
  if (absErr <= WINDOW.o) return 'good';
  return 'miss';
}
