import { FLOW_S, NEAR, rise, type Course, type Press } from './course';

export interface TapResult {
  kind: 'hop' | 'flip' | 'orb' | 'skip' | 'none' | 'crash';
  /** seconds from the note (negative = early), for taps that met a note */
  err?: number;
  /** true if the tap was close enough to the note to build flow */
  flow?: boolean;
  pitch?: number | null;
  /** the game pressed it for you (the run-in before a practice checkpoint) */
  auto?: boolean;
}
interface Flight { t0: number; t1: number; from: number; to: number; bulge: number; s0: number; s1: number }

const SKIP = 0.3; // beats a free hop lasts
const DEBOUNCE_S = 0.03;
const ORB_GRACE_S = 0.11;

/**
 * Fixed-timestep simulation of the ball. Deterministic: the same taps give the same run at any frame rate.
 * Two layers: survival (did the tap fall inside the opening?) and flow (was it right on the note?).
 */
export class Sim {
  static readonly STEP = 1 / 240; // seconds
  beat: number;
  /** index of the next press */
  ni = 0;
  mode: 'ground' | 'flight' | 'skip' = 'ground';
  lv = 0;
  side = 1;
  fl: Flight | null = null;
  private skipEnd = 0;
  private skipStart = 0;
  private pending = NaN;
  private lastTap = -99;
  private doneUntil = -99;
  private usedOrbs = new Set<number>();
  crashed = false;
  crashBeat = -1;
  crashKind: 'edge' | 'early' | '' = '';
  landedAt = -99;
  // flow
  flow = 0.5;
  streak = 0;
  bestStreak = 0;
  offRun = 0;
  /** how muffled the music should be, 0..1: rises only after three off-beat taps in a row, drops fast on the beat */
  muffle = 0;
  onBeat = 0;
  judged = 0;
  /** results of presses the simulation made by itself (buffered taps, the run-in): the run reads and empties this */
  out: TapResult[] = [];

  constructor(readonly c: Course, start: number, private autoUntil = -Infinity) {
    this.beat = start;
    const ps = c.presses;
    while (this.ni < ps.length && ps[this.ni].beat + ps[this.ni].tol < start) this.ni++;
    const prev = ps[this.ni - 1];
    const next = ps[this.ni];
    this.lv = next ? next.from : prev ? prev.to : 0;
    this.side = next ? next.side : prev ? (prev.kind === 'flip' ? -prev.side : prev.side) : 1;
    if (prev && prev.land > start) this.takeoff(prev, prev.beat); // starting in mid-flight
  }

  private takeoff(p: Press, at: number): void {
    this.fl = { t0: Math.min(at, p.land - 0.05), t1: p.land, from: p.from, to: p.to, bulge: p.bulge, s0: p.side, s1: p.kind === 'flip' ? -p.side : p.side };
    this.mode = 'flight';
    this.doneUntil = p.beat + p.tol;
    this.ni = p.i + 1;
    this.pending = NaN;
  }

  /** Radial position in ring levels at a beat (for the picture). */
  rho(b = this.beat): number {
    if (this.mode === 'flight' && this.fl) {
      const f = this.fl;
      const u = Math.max(0, Math.min(1, (b - f.t0) / (f.t1 - f.t0)));
      return f.from + (f.to - f.from) * rise(u) + f.s1 * f.bulge * 4 * u * (1 - u) * (f.s0 === f.s1 ? 1 : 0);
    }
    if (this.mode === 'skip') {
      const u = Math.max(0, Math.min(1, (b - this.skipStart) / (this.skipEnd - this.skipStart)));
      return this.lv + this.side * 0.3 * 4 * u * (1 - u);
    }
    return this.lv;
  }

  /** Which side of the ring line the ball's centre sits on, -1..1 (it slides across during a gravity flip). */
  sideAt(b = this.beat): number {
    if (this.mode === 'flight' && this.fl && this.fl.s0 !== this.fl.s1) {
      const u = Math.max(0, Math.min(1, (b - this.fl.t0) / (this.fl.t1 - this.fl.t0)));
      return this.fl.s0 + (this.fl.s1 - this.fl.s0) * u;
    }
    return this.mode === 'flight' && this.fl ? this.fl.s1 : this.side;
  }

  orbUsed(beat: number): boolean {
    return this.usedOrbs.has(beat);
  }

  private judge(err: number): boolean {
    this.judged++;
    const ok = Math.abs(err) <= FLOW_S + 1e-9;
    if (ok) {
      this.onBeat++;
      this.streak++;
      this.bestStreak = Math.max(this.bestStreak, this.streak);
      this.offRun = 0;
      this.flow = Math.min(1, this.flow + 1 / 8);
      this.muffle = Math.max(0, this.muffle - 0.5);
    } else this.off();
    return ok;
  }

  private off(): void {
    this.streak = 0;
    this.offRun++;
    this.flow = Math.max(0, this.flow - 1 / 8);
    if (this.offRun >= 3) this.muffle = Math.min(1, this.muffle + 0.2);
  }

  private crash(kind: 'edge' | 'early', at: number): TapResult {
    this.crashed = true;
    this.crashBeat = at;
    this.crashKind = kind;
    return { kind: 'crash' };
  }

  /** A tap at beat-time t. */
  press(t: number): TapResult {
    this.advance(t);
    const spb = this.c.spb;
    if (this.crashed || (t - this.lastTap) * spb < DEBOUNCE_S) return { kind: 'none' };
    this.lastTap = t;
    const p = this.c.presses[this.ni];
    const d = p ? t - p.beat : -Infinity;
    // Survival first: a tap inside the next opening's window always belongs to that opening.
    if (p && d >= -p.tol) {
      if (this.mode === 'ground') {
        this.takeoff(p, t);
        return { kind: p.kind, err: d * spb, flow: this.judge(d * spb), pitch: p.pitch };
      }
      this.pending = t; // in the air: it goes the moment the ball touches down
      return { kind: 'none' };
    }
    if (this.mode === 'flight') {
      // an orb in reach? A tap near one is never punished: on it, it sparkles; off it, nothing happens.
      for (const o of this.c.orbs) {
        if (o.beat < t - 0.5) continue;
        if (o.beat > t + 0.5) break;
        const od = t - o.beat;
        if (Math.abs(od) <= o.tol && !this.usedOrbs.has(o.beat)) {
          this.usedOrbs.add(o.beat);
          return { kind: 'orb', err: od * spb, flow: this.judge(od * spb), pitch: o.pitch };
        }
        if (Math.abs(od) * spb <= ORB_GRACE_S) { this.off(); return { kind: 'none' }; }
      }
      if (t <= this.doneUntil) return { kind: 'none' }; // a second tap inside the opening the ball has just used
    }
    if (!p) { if (this.mode === 'ground') this.skip(t, Infinity); return { kind: 'none' }; }
    if (d < -NEAR) {
      // far from any opening: free
      this.off();
      if (this.mode === 'ground') { this.skip(t, p.beat - p.tol); return { kind: 'skip' }; }
      return { kind: 'none' };
    }
    return this.crash('early', t); // went for the opening too soon and hit the ring
  }

  private skip(t: number, before: number): void {
    this.mode = 'skip';
    this.skipStart = t;
    this.skipEnd = Math.min(t + SKIP, Math.max(t + 0.1, before));
  }

  advance(to: number): void {
    const step = Sim.STEP / this.c.spb;
    const ps = this.c.presses;
    while (!this.crashed && this.beat < to - 1e-9) {
      const nb = Math.min(to, this.beat + step);
      this.beat = nb;
      if (this.mode === 'flight' && this.fl && nb >= this.fl.t1) {
        this.lv = this.fl.to;
        this.side = this.fl.s1;
        this.landedAt = this.fl.t1;
        this.mode = 'ground';
        this.fl = null;
      } else if (this.mode === 'skip' && nb >= this.skipEnd) this.mode = 'ground';
      const p = ps[this.ni];
      if (!p || this.mode !== 'ground') continue;
      if (p.beat < this.autoUntil) {
        if (nb >= p.beat) { this.takeoff(p, p.beat); this.out.push({ kind: p.kind, err: 0, pitch: p.pitch, auto: true }); }
      } else if (!Number.isNaN(this.pending) && nb >= p.beat - p.tol) {
        const err = (this.pending - p.beat) * this.c.spb;
        this.takeoff(p, nb);
        this.out.push({ kind: p.kind, err, flow: this.judge(err), pitch: p.pitch });
      } else if (nb > p.beat + p.tol) {
        this.crashed = true; // ran off the end of the ring
        this.crashBeat = nb;
        this.crashKind = 'edge';
      }
    }
  }
}
