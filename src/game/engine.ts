import type { Judge, RNote } from './types';
import type { Level } from './level';
import { HEALTH, POINTS, WEIGHT, WINDOW, gradeFor, judgeFor, type Grade } from './rules';

export interface JEvent {
  judge: Judge;
  /** seconds late (+) or early (-); null for a gate that went by untapped */
  err: number | null;
  t: number;
  note: RNote;
}

export interface EngineOptions {
  hardcore?: boolean; // one miss = fail
  noFail?: boolean;
  /** practice: start here (song time); earlier notes do not count */
  startAt?: number;
}

/**
 * Judging for one run of a one-button chart. No DOM, no audio: it is fed timestamps in song time,
 * so the same code runs in the game, under the autoplay bot and in the tests.
 */
export class Engine {
  readonly notes: RNote[];
  private pi = 0;
  score = 0;
  combo = 0;
  maxCombo = 0;
  counts: Record<Judge, number> = { perfect: 0, great: 0, good: 0, miss: 0 };
  judged = 0;
  accSum = 0;
  health = 100;
  failed = false;
  failT = -1;
  errs: number[] = [];
  log: JEvent[] = [];
  readonly total: number;

  constructor(readonly level: Level, readonly opts: EngineOptions = {}) {
    this.notes = level.notes;
    const from = opts.startAt ?? -Infinity;
    for (const n of this.notes) { n.done = n.t < from - 1e-6; n.judge = null; n.hitT = -1; }
    this.total = this.notes.filter((n) => !n.done).length;
  }

  get accuracy(): number {
    return this.judged ? this.accSum / this.judged : 100;
  }

  get grade(): Grade {
    return gradeFor(this.accuracy, this.counts.miss, this.failed);
  }

  get done(): boolean {
    return this.judged >= this.total;
  }

  /** The next gate still to come (for the approach cue). */
  nextNote(): RNote | undefined {
    while (this.pi < this.notes.length && this.notes[this.pi].done) this.pi++;
    return this.notes[this.pi];
  }

  /** A tap at song time t. Returns the judgement, or null for a tap with no gate in range (no penalty). */
  pressAt(t: number): JEvent | null {
    if (this.failed) return null;
    const n = this.nextNote();
    if (!n || n.t - t > WINDOW.o) return null;
    const err = t - n.t;
    return this.apply({ judge: judgeFor(Math.abs(err)), err, t, note: n });
  }

  /** Advance to song time t: gates the player let go by are missed here. */
  update(t: number): JEvent[] {
    const out: JEvent[] = [];
    if (this.failed) return out;
    for (;;) {
      const n = this.nextNote();
      if (!n || t <= n.t + WINDOW.o) break;
      out.push(this.apply({ judge: 'miss', err: null, t: n.t + WINDOW.o, note: n }));
      if (this.failed) break;
    }
    return out;
  }

  private apply(ev: JEvent): JEvent {
    const j = ev.judge;
    ev.note.done = true;
    ev.note.judge = j;
    ev.note.hitT = ev.t;
    this.counts[j]++;
    this.judged++;
    this.accSum += WEIGHT[j];
    if (j === 'miss') {
      this.combo = 0;
      this.health -= HEALTH.miss;
    } else {
      this.combo++;
      if (this.combo > this.maxCombo) this.maxCombo = this.combo;
      const inDrop = ev.note.t >= this.level.dropTime - 1e-6;
      this.score += Math.round(POINTS[j] * (1 + Math.min(this.combo, 100) / 100) * (inDrop ? 2 : 1) * (ev.note.accent ? 1.5 : 1));
      this.health = Math.min(100, this.health + (j === 'perfect' ? HEALTH.heal : j === 'great' ? HEALTH.heal / 2 : 0));
    }
    if (ev.err !== null) this.errs.push(ev.err);
    this.log.push(ev);
    if (!this.opts.noFail && !this.failed && (this.health <= 0 || (this.opts.hardcore && j === 'miss'))) {
      this.health = Math.max(0, this.health);
      this.failed = true;
      this.failT = ev.t;
    }
    return ev;
  }
}

export function errorStats(errs: number[]): { mean: number; sd: number; n: number } {
  const n = errs.length;
  if (!n) return { mean: 0, sd: 0, n: 0 };
  const mean = errs.reduce((s, v) => s + v, 0) / n;
  const sd = Math.sqrt(errs.reduce((s, v) => s + (v - mean) * (v - mean), 0) / n);
  return { mean, sd, n };
}
