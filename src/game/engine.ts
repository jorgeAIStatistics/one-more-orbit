import type { Difficulty, Judge, RNote, Side } from './types';
import type { Level } from './level';
import { HEALTH, POINTS, RELEASE_SCALE, WEIGHT, WINDOWS, gradeFor, judgeFor, type Grade } from './rules';

export interface JEvent {
  type: 'judge';
  kind: 'tap' | 'head' | 'tail' | 'haz' | 'spin';
  judge: Judge;
  /** seconds late (+) or early (-); null where timing does not apply */
  err: number | null;
  t: number;
  note: RNote;
  side?: Side;
  wrongSide?: boolean;
}

export interface Feedback {
  type: 'lane' | 'spinTick' | 'ghost';
  t: number;
  side: Side;
  lane?: number;
}

export interface EngineOptions {
  hardcore?: boolean; // one miss = fail
  noFail?: boolean;
}

/**
 * Judging for one run. No DOM, no audio: it is fed timestamps in song time, so the same code
 * runs in the game, under the autoplay bot and in the tests.
 */
export class Engine {
  readonly win: { p: number; g: number; o: number };
  private readonly press: RNote[];
  private readonly hazards: RNote[];
  private readonly spinners: RNote[];
  private pi = 0;
  private hz = 0;
  private sp = 0;
  private held: Partial<Record<Side, RNote>> = {};
  private laneLog: Array<[number, number]> = [];

  score = 0;
  combo = 0;
  maxCombo = 0;
  counts: Record<Judge, number> = { perfect: 0, great: 0, good: 0, miss: 0 };
  judged = 0;
  accSum = 0;
  health = 100;
  failed = false;
  failT = -1;
  spinTaps = 0;
  /** signed tap errors in seconds (taps and hold starts) */
  errs: number[] = [];
  log: JEvent[] = [];
  readonly total: number;

  constructor(readonly level: Level, readonly notes: RNote[], readonly difficulty: Difficulty, readonly opts: EngineOptions = {}) {
    this.win = WINDOWS[difficulty];
    this.press = notes.filter((n) => n.kind === 'tap' || n.kind === 'hold');
    this.hazards = notes.filter((n) => n.kind === 'haz');
    this.spinners = notes.filter((n) => n.kind === 'spin');
    this.total = notes.reduce((s, n) => s + (n.kind === 'hold' ? 2 : 1), 0);
    for (const s of level.segments) if (s.mode === 'dodge') this.laneLog.push([s.t0, 0]);
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

  /** Which dodge lane the ball is in at song time t. */
  laneAt(t: number): number {
    let best = -Infinity;
    let lane = 0;
    for (const [lt, l] of this.laneLog) if (lt <= t && lt >= best) { best = lt; lane = l; }
    return lane;
  }

  activeSpinner(t: number): RNote | null {
    for (let i = this.sp; i < this.spinners.length; i++) {
      const s = this.spinners[i];
      if (t >= s.t && t <= s.t1) return s;
      if (s.t > t) break;
    }
    return null;
  }

  heldNote(side: Side): RNote | undefined {
    return this.held[side];
  }

  pressAt(side: Side, t: number): JEvent | Feedback | null {
    if (this.failed) return null;
    // A note that is due takes the tap first, so a slightly late hit on the last note before a
    // dodge or spinner section still counts as that note.
    const w = this.win;
    let match: RNote | undefined;
    let wrong: RNote | undefined;
    for (let i = this.pi; i < this.press.length; i++) {
      const n = this.press[i];
      if (n.t - t > w.o) break;
      if (n.headDone || t - n.t > w.o) continue;
      if (n.hand === 'A' || n.hand === side) { match = n; break; }
      if (!wrong && Math.abs(t - n.t) <= w.g) wrong = n;
    }
    if (!match) {
      const spin = this.activeSpinner(t);
      if (spin) {
        spin.got++;
        this.spinTaps++;
        this.score += 10;
        return { type: 'spinTick', t, side };
      }
      if (this.level.segAt(t).mode === 'dodge') {
        const lane = this.laneAt(t) ^ 1;
        this.laneLog.push([t, lane]);
        return { type: 'lane', t, side, lane };
      }
    }
    if (match) {
      const err = t - match.t;
      const judge = judgeFor(Math.abs(err), w);
      match.headDone = true;
      match.headJudge = judge;
      match.hitT = t;
      if (match.kind === 'hold') {
        match.heldBy = side;
        this.held[side] = match;
        return this.apply({ type: 'judge', kind: 'head', judge, err, t, note: match, side });
      }
      return this.apply({ type: 'judge', kind: 'tap', judge, err, t, note: match, side });
    }
    if (wrong) {
      wrong.headDone = true;
      wrong.headJudge = 'miss';
      const ev = this.apply({ type: 'judge', kind: wrong.kind === 'hold' ? 'head' : 'tap', judge: 'miss', err: null, t, note: wrong, side, wrongSide: true });
      if (wrong.kind === 'hold') { wrong.tailDone = true; this.apply({ type: 'judge', kind: 'tail', judge: 'miss', err: null, t, note: wrong }); }
      return ev;
    }
    return { type: 'ghost', t, side };
  }

  releaseAt(side: Side, t: number): JEvent | null {
    const n = this.held[side];
    if (!n) return null;
    delete this.held[side];
    n.heldBy = null;
    if (n.tailDone || this.failed) return null;
    n.tailDone = true;
    const err = t - n.t1;
    const judge = err < -this.win.o * RELEASE_SCALE ? 'miss' : judgeFor(Math.abs(err), this.win, RELEASE_SCALE);
    return this.apply({ type: 'judge', kind: 'tail', judge, err, t, note: n, side });
  }

  /** Advance to song time t: anything the player let go by is judged here. */
  update(t: number): JEvent[] {
    const out: JEvent[] = [];
    if (this.failed) return out;
    const w = this.win;
    while (this.pi < this.press.length) {
      const n = this.press[this.pi];
      if (!n.headDone) {
        if (t <= n.t + w.o) break;
        n.headDone = true;
        n.headJudge = 'miss';
        out.push(this.apply({ type: 'judge', kind: n.kind === 'hold' ? 'head' : 'tap', judge: 'miss', err: null, t: n.t + w.o, note: n }));
        if (n.kind === 'hold') { n.tailDone = true; out.push(this.apply({ type: 'judge', kind: 'tail', judge: 'miss', err: null, t: n.t + w.o, note: n })); }
      }
      this.pi++;
    }
    for (const side of ['L', 'R'] as Side[]) {
      const n = this.held[side];
      if (n && t > n.t1 + w.o * RELEASE_SCALE) {
        delete this.held[side];
        n.heldBy = null;
        n.tailDone = true;
        out.push(this.apply({ type: 'judge', kind: 'tail', judge: 'good', err: null, t, note: n, side })); // held on too long
      }
    }
    while (this.hz < this.hazards.length && t >= this.hazards[this.hz].t) {
      const h = this.hazards[this.hz++];
      const hit = this.laneAt(h.t) === h.lane;
      h.headDone = true;
      h.headJudge = hit ? 'miss' : 'perfect';
      out.push(this.apply({ type: 'judge', kind: 'haz', judge: hit ? 'miss' : 'perfect', err: null, t: h.t, note: h }));
    }
    while (this.sp < this.spinners.length && t >= this.spinners[this.sp].t1) {
      const s = this.spinners[this.sp++];
      const r = s.need > 0 ? s.got / s.need : 1;
      s.headDone = true;
      s.headJudge = r >= 1 ? 'perfect' : r >= 0.75 ? 'great' : r >= 0.5 ? 'good' : 'miss';
      out.push(this.apply({ type: 'judge', kind: 'spin', judge: s.headJudge, err: null, t: s.t1, note: s }));
    }
    return out;
  }

  private apply(ev: JEvent): JEvent {
    const j = ev.judge;
    this.counts[j]++;
    this.judged++;
    this.accSum += WEIGHT[j];
    const h = HEALTH[this.difficulty];
    if (j === 'miss') {
      this.combo = 0;
      this.health -= h.miss;
    } else {
      this.combo++;
      if (this.combo > this.maxCombo) this.maxCombo = this.combo;
      const inDrop = ev.note.t >= this.level.dropTime - 1e-6;
      this.score += Math.round(POINTS[j] * (1 + Math.min(this.combo, 100) / 100) * (inDrop ? 2 : 1));
      this.health = Math.min(100, this.health + (j === 'perfect' ? h.heal : j === 'great' ? h.heal / 2 : 0));
    }
    if (ev.err !== null && ev.kind !== 'tail') this.errs.push(ev.err);
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
