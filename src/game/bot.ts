import type { Level } from './level';

/** The taps a perfect player would make: one exactly on every gate from `startAt` on. */
export function botTimes(level: Level, startAt = -Infinity): number[] {
  return level.notes.filter((n) => n.t >= startAt - 1e-6).map((n) => n.t);
}
