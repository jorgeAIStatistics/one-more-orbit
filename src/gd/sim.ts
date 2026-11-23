import { FLOW_S, NEAR, rise, type Course, type FlowNote, type Press } from './course';

export interface TapResult {
  /** hop / flip: a survival press. spark: a flow note. skip: a free tap. */
  kind: 'hop' | 'flip' | 'spark' | 'skip' | 'none' | 'crash';
  /** seconds from the note (negative = early), for taps that met a note */
  err?: number;
  /** true if the tap was close enough to the note to build flow */
  flow?: boolean;
  pitch?: number | null;
  /** the tap touched a charge note */
  charge?: boolean;
  /** the game pressed it itself (the launch into the drop, or the run-in before a practice checkpoint) */
  auto?: boolean;
}
interface Flight { t0: number; t1: number; from: number; to: number; bulge: number; s0: number; s1: number }

const SKIP = 0.3; // beats a free hop lasts
const DEBOUNCE_S = 0.03;
const GRACE_S = 0.25; // a tap this soon after a flow note is never punished (nor is one before a flow note still to come)
const GAIN = 1 / 10; // flow per on-beat tap
const MISS = 1 / 40; // flow lost when a flow note goes by untapped (nothing else happens)

/**
 * Fixed-timestep simulation of the ball. Deterministic: the same taps give the same run at any frame rate.
 * Survival: did the tap fall inside the opening of a press? Flow: was a tap right on a note, of either layer?
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
  private pendingQuiet = false;
  private lastTap = -99;
  private doneUntil = -99;
  private doneBeat = 0;
  private needJudge = false;
  private used = new Set<number>();
  private fi = 0;
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
  /** how charged the drop is, 0..1 */
  charge = 0;
  /** results of presses the simulation made by itself (buffered taps, launches, the run-in): the run reads and empties this */
  out: TapResult[] = [];

  constructor(readonly c: Course, start: number, private autoUntil = -Infinity) {
    this.beat = start;
    const ps = c.presses;
    while (this.ni < ps.length && ps[this.ni].beat + ps[this.ni].tol < start) this.ni++;
    while (this.fi < c.flow.length && c.flow[this.fi].beat < Math.max(start, autoUntil)) this.fi++;
    const prev = ps[this.ni - 1];
    const next = ps[this.ni];
    this.lv = next ? next.from : prev ? prev.to : 0;
    this.side = next ? next.side : prev ? (prev.kind === 'flip' ? -prev.side : prev.side) : 1;
    if (prev && prev.land > start) { this.takeoff(prev, prev.beat); this.needJudge = false; } // starting in mid-flight
    // starting after the charge has begun: there was no chance to fill it, so the drop is not held back
    if (c.charges.length && Math.max(start, autoUntil) > c.charges[0][0] + 0.5) this.charge = 1;
  }

  private takeoff(p: Press, at: number): void {
    this.fl = { t0: Math.min(at, p.land - 0.05), t1: p.land, from: p.from, to: p.to, bulge: p.bulge, s0: p.side, s1: p.kind === 'flip' ? -p.side : p.side };
    this.mode = 'flight';
    this.doneUntil = p.beat + p.tol;
    this.doneBeat = p.beat;
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

  noteUsed(beat: number): boolean {
    return this.used.has(beat);
  }

  private gain(): void {
    this.onBeat++;
    this.streak++;
    this.bestStreak = Math.max(this.bestStreak, this.streak);
    this.offRun = 0;
    this.flow = Math.min(1, this.flow + GAIN);
    this.muffle = Math.max(0, this.muffle - 0.5);
  }

  /** A survival press: on the note builds flow, off it costs a notch. */
  private judge(err: number): boolean {
    this.judged++;
    const ok = Math.abs(err) <= FLOW_S + 1e-9;
    if (ok) this.gain(); else this.off();
    return ok;
  }

  private off(): void {
    this.streak = 0;
    this.offRun++;
    this.flow = Math.max(0, this.flow - 1 / 8);
    if (this.offRun >= 3) this.muffle = Math.min(1, this.muffle + 0.2);
  }

  /** A flow note touched: on the note it builds flow, a little off it is simply not counted. It can never hurt. */
  private touch(f: FlowNote, t: number): TapResult {
    this.used.add(f.beat);
    const err = (t - f.beat) * this.c.spb;
    const ok = Math.abs(err) <= FLOW_S + 1e-9;
    this.judged++;
    if (ok) this.gain();
    if (f.charge) this.charge = Math.min(1, this.charge + 1 / Math.max(1, 0.75 * this.c.chargeNotes)); // three in four fills it
    return { kind: 'spark', err, flow: ok, pitch: f.pitch, charge: f.charge };
  }

  private crash(kind: 'edge' | 'early', at: number): TapResult {
    this.crashed = true;
    this.crashBeat = at;
    this.crashKind = kind;
    return { kind: 'crash' };
  }

  /** The flow note nearest a tap, with how far off it is in seconds. */
  private nearFlow(t: number): { f: FlowNote; d: number } | null {
    const fl = this.c.flow;
    let best: { f: FlowNote; d: number } | null = null;
    for (let i = Math.max(0, this.fi - 2); i < fl.length; i++) {
      const d = (t - fl[i].beat) * this.c.spb;
      if (d < -0.3) break;
      if (!best || Math.abs(d) < Math.abs(best.d)) best = { f: fl[i], d };
    }
    return best;
  }

  /** A tap at beat-time t. */
  press(t: number): TapResult {
    this.advance(t);
    const spb = this.c.spb;
    if (this.crashed || (t - this.lastTap) * spb < DEBOUNCE_S) return { kind: 'none' };
    this.lastTap = t;
    const p = this.c.presses[this.ni];
    const d = p ? t - p.beat : -Infinity;
    const nf = this.nearFlow(t);
    const hit = nf && Math.abs(nf.d) <= nf.f.tol * spb && !this.used.has(nf.f.beat) ? nf.f : null;
    const free = (): TapResult => {
      if (this.mode !== 'ground') return { kind: 'none' };
      this.skip(t, p ? p.beat - p.tol : Infinity);
      return { kind: 'skip' };
    };

    // Survival first: a tap inside the next opening's window always opens it...
    if (p && d >= -p.tol) {
      // ...but if it was really aimed at a flow note just before the press, the flow note gets the credit,
      // and the press is judged by the next tap inside its window (or not at all)
      const spark = hit && Math.abs(nf!.d) < Math.abs(d * spb) ? this.touch(hit, t) : null;
      if (this.mode === 'ground') {
        this.takeoff(p, t);
        this.needJudge = !!spark;
        if (spark) return { ...spark, kind: p.kind };
        return { kind: p.kind, err: d * spb, flow: this.judge(d * spb), pitch: p.pitch };
      }
      this.pending = t; // in the air: it goes the moment the ball touches down
      this.pendingQuiet = !!spark;
      return spark ?? { kind: 'none' };
    }
    if (hit) {
      const r = this.touch(hit, t);
      if (this.mode === 'ground') this.skip(t, p ? p.beat - p.tol : Infinity); // a little bounce on the note
      return r;
    }
    if (t <= this.doneUntil) {
      // a second tap inside the opening the ball has just used: it can settle that press's timing, nothing more
      if (this.needJudge) { this.needJudge = false; const err = (t - this.doneBeat) * spb; return { kind: 'none', err, flow: this.judge(err) }; }
      return { kind: 'none' };
    }
    if (this.c.inCharge(t)) {
      // charging the drop: tap away, nothing here can end the run; taps that miss the roll just leak a little charge
      this.charge = Math.max(0, this.charge - 0.4 / Math.max(1, 0.75 * this.c.chargeNotes));
      return free();
    }
    if (!p || p.auto) return free(); // nothing left to miss
    // near a flow note, or with one still to come before the opening: the tap was for the flow note, never punished
    if (this.c.flow.some((f) => f.beat < p.beat && (f.beat - t) * spb > -GRACE_S)) return free();
    if (d < -NEAR) { this.off(); return free(); } // far from any opening: free, though it is not on the beat
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
    const fl = this.c.flow;
    while (!this.crashed && this.beat < to - 1e-9) {
      const nb = Math.min(to, this.beat + step);
      this.beat = nb;
      while (this.fi < fl.length && fl[this.fi].beat + fl[this.fi].tol < nb) {
        const f = fl[this.fi++];
        if (!this.used.has(f.beat) && !f.charge) this.flow = Math.max(0, this.flow - MISS);
      }
      if (this.mode === 'flight' && this.fl && nb >= this.fl.t1) {
        this.lv = this.fl.to;
        this.side = this.fl.s1;
        this.landedAt = this.fl.t1;
        this.mode = 'ground';
        this.fl = null;
      } else if (this.mode === 'skip' && nb >= this.skipEnd) this.mode = 'ground';
      const p = ps[this.ni];
      if (!p || this.mode !== 'ground') continue;
      if (!Number.isNaN(this.pending) && nb >= p.beat - p.tol) {
        const err = (this.pending - p.beat) * this.c.spb;
        const quiet = this.pendingQuiet;
        this.takeoff(p, nb);
        this.needJudge = quiet;
        this.out.push(quiet ? { kind: p.kind } : { kind: p.kind, err, flow: this.judge(err), pitch: p.pitch });
      } else if (p.auto || p.beat < this.autoUntil) {
        if (nb >= p.beat) {
          this.takeoff(p, p.beat);
          this.needJudge = p.auto && p.beat >= this.autoUntil; // a tap right on a launch still counts for flow
          this.out.push({ kind: p.kind, err: 0, pitch: p.pitch, auto: true });
        }
      } else if (nb > p.beat + p.tol) {
        this.crashed = true; // ran off the end of the ring
        this.crashBeat = nb;
        this.crashKind = 'edge';
      }
    }
  }
}
