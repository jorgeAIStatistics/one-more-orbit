import { FLOW_S, FLOW_TOL_S, NEAR, TETHER_GRIP, TETHER_LET_S, arc, rise, smoothstep, type Course, type FlowNote, type Hold, type Press } from './course';

export interface TapResult {
  /** hop / flip: a survival press. spark: a flow note. skip: a free tap. tick: gold collected along a hold. held: a hold has gone by. release: let go right on a hold's end. */
  kind: 'hop' | 'flip' | 'spark' | 'skip' | 'none' | 'crash' | 'tick' | 'held' | 'release' | 'star' | 'starlost';
  /** star, starlost: which star trail */
  star?: number;
  /** held: every piece of gold along the hold was collected */
  full?: boolean;
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
interface Flight { t0: number; t1: number; from: number; to: number; bulge: number; s0: number; s1: number; lin: boolean }

const SKIP = 0.3; // beats a free hop lasts
const DEBOUNCE_S = 0.03;
/** a second tap this soon after a press was taken is a bounce on it: never wasted, never a crash (2026-11-26) */
const BOUNCE_S = 0.15;
const GRACE_S = 0.25; // a tap this soon after a flow note is never punished (nor is one before a flow note still to come)
const GAIN = 1 / 10; // flow per on-beat tap
const MASH_TAPS = 9; // this many taps inside a second is mashing: it keeps you alive where the level allows, but earns nothing
const MISS = 1 / 40; // flow lost when a flow note goes by untapped (nothing else happens)
const TICK_GAIN = 1 / 20; // flow per piece of gold collected along a hold

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
  /** the pending tap was early and is held for its beat (forgiving taps): it goes exactly on the beat, not on landing */
  private pendingBuf = false;
  /** the taps of the last second, for the anti-mash rule */
  private lately: number[] = [];
  /** the tap log (the owner's debug view, 2026-11-26): every tap, and how it was judged */
  log: Array<{ beat: number; what: string; press: number }> = [];
  private why = '';
  private indep: number[] = [];
  private lastAny = -Infinity;
  private mashState = false;
  /** the last few wasted taps (beats) */
  private wasted: number[] = [];
  private lastTap = -99;
  private doneUntil = -99;
  private doneBeat = 0;
  /** when the last press was taken (the Comet's hold is checked from here) */
  private tookAt = -99;
  private needJudge = false;
  private used = new Set<number>();
  private fi = 0;
  private recent: number[] = [];
  private mashing = false;
  crashed = false;
  crashBeat = -1;
  /** edge: rode off a ring. early: tapped into the ring before an opening. let: let go of a tether. */
  crashKind: 'edge' | 'early' | 'let' | 'snuffed' | '' = '';
  /**
   * How far off the beat (seconds) the last press was struck. Where the tap that opened it was really aimed at a gold
   * note just before it (a roll runs right up to a light note), this is not known yet (NaN) until the next tap inside
   * the opening settles it.
   */
  openErr = 0;
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
  /** every tap that met a note, as seconds off it (negative = early): the raw material of the sync check */
  offsets = { press: [] as number[], flow: [] as number[] };
  /** results of presses the simulation made by itself (buffered taps, launches, the run-in): the run reads and empties this */
  out: TapResult[] = [];

  /** times the game stepped in for the player (tutorial only) */
  helped = 0;
  // ---- holds
  /** is the button down right now */
  down = false;
  private downAt = -99;
  private upAt = -99;
  private hi = 0;
  private ti = 0;
  private got = 0;
  private ticked = new Set<number>();
  private let = new Set<number>();
  /** holds that have gone by, and how many of them were collected in full */
  holdsSeen = 0;
  holdsFull = 0;

  // ---- star trails
  /** one entry per star: 0 = still to play (or being played), 1 = collected on this attempt, -1 = lost on it */
  stars: number[];
  /** the beat each star was collected or lost at */
  starBeat: number[];
  private si = 0;

  /** taps that met nothing at all (free taps), over the whole attempt */
  strays = 0;

  /** forgiving: nothing ends the run. A missed mark is taken for the player and an early tap is ignored (the tutorial). */
  constructor(readonly c: Course, start: number, private autoUntil = -Infinity, public forgiving = false) {
    this.beat = start;
    const ps = c.presses;
    while (this.ni < ps.length && ps[this.ni].beat + ps[this.ni].tol < start) this.ni++;
    while (this.fi < c.flow.length && c.flow[this.fi].beat < Math.max(start, autoUntil)) this.fi++;
    while (this.hi < c.holds.length && c.holds[this.hi].b < start) this.hi++;
    // a trail the attempt joins part-way (a practice checkpoint) cannot be won on it
    const from = Math.max(start, autoUntil);
    this.stars = c.stars.map((st) => (from > st.a - 0.5 ? -1 : 0));
    this.starBeat = c.stars.map(() => -99);
    while (this.si < c.stars.length && this.stars[this.si] !== 0) this.si++;
    const prev = ps[this.ni - 1];
    const next = ps[this.ni];
    this.lv = next ? next.from : prev ? prev.to : 0;
    this.side = next ? next.side : prev ? (prev.kind === 'flip' ? -prev.side : prev.side) : 1;
    if (prev && prev.land > start) { this.takeoff(prev, prev.beat); this.needJudge = false; } // starting in mid-flight
    // starting after the charge has begun: there was no chance to fill it, so the drop is not held back
    if (c.charges.length && Math.max(start, autoUntil) > c.charges[0][0] + 0.5) this.charge = 1;
    // a level with no roll to charge (the new charts: no gold notes) holds nothing back: the drop's power is the flow the
    // nodes themselves built, tapped on the beat
    if (!c.charges.length || !c.chargeNotes) this.charge = 1;
  }

  private takeoff(p: Press, at: number): void {
    this.fl = { t0: Math.min(at, p.land - 0.05), t1: p.land, from: p.from, to: p.to, bulge: p.bulge, s0: p.side, s1: p.kind === 'flip' ? -p.side : p.side, lin: p.line };
    this.tookAt = at;
    this.mode = 'flight';
    this.doneUntil = p.beat + p.tol;
    this.doneBeat = p.beat;
    this.ni = p.i + 1;
    this.pending = NaN;
    this.pendingBuf = false;
  }

  /** Radial position in ring levels at a beat (for the picture). */
  rho(b = this.beat): number {
    if (this.mode === 'flight' && this.fl) {
      const f = this.fl;
      const u = Math.max(0, Math.min(1, (b - f.t0) / (f.t1 - f.t0)));
      if (f.lin) return f.from + (f.to - f.from) * u; // the Satellite's zig-zag and a slipstream: a straight line
      return f.from + (f.to - f.from) * rise(u) + f.s1 * f.bulge * arc(u) * (f.s0 === f.s1 ? 1 : 0);
    }
    if (this.mode === 'skip') {
      const u = Math.max(0, Math.min(1, (b - this.skipStart) / (this.skipEnd - this.skipStart)));
      // a bounce cut short by an opening coming up is a lower bounce, not a faster one: the ball never snaps up and down
      const room = Math.min(1, (this.skipEnd - this.skipStart) / SKIP);
      return this.lv + this.side * 0.3 * room * room * arc(u);
    }
    return this.lv;
  }

  /** Which side of the ring line the ball's centre sits on, -1..1 (it slides across during a gravity flip). */
  sideAt(b = this.beat): number {
    if (this.mode === 'flight' && this.fl && this.fl.s0 !== this.fl.s1) {
      const u = Math.max(0, Math.min(1, (b - this.fl.t0) / (this.fl.t1 - this.fl.t0)));
      return this.fl.s0 + (this.fl.s1 - this.fl.s0) * (this.fl.lin ? u : smoothstep(u)); // crossing a ring: eased (a straight flight: evenly)
    }
    return this.mode === 'flight' && this.fl ? this.fl.s1 : this.side;
  }

  noteUsed(beat: number): boolean {
    return this.used.has(beat);
  }

  /** Has this piece of gold on a hold been collected (or gone by). */
  tickGone(beat: number): boolean {
    return this.ticked.has(beat);
  }

  /** The hold the ball is on at a beat, if any. */
  holdAt(t: number): Hold | null {
    for (let i = Math.max(0, this.hi - 1); i < this.c.holds.length; i++) {
      const h = this.c.holds[i];
      if (h.a > t + 0.3) break;
      if (t >= h.a - 0.3 && t <= h.b + 1e-6) return h;
    }
    return null;
  }

  /** The star trail being played at a beat, if it is still whole. */
  trailAt(t: number): number {
    const st = this.c.stars[this.si];
    const g = FLOW_TOL_S / this.c.spb;
    return st && this.stars[this.si] === 0 && t >= st.a - g && t <= st.b + g ? this.si : -1;
  }

  /** A slip inside a star trail: that star is gone for this attempt. */
  private slip(t: number): void {
    const i = this.trailAt(t);
    if (i < 0) return;
    this.stars[i] = -1;
    this.starBeat[i] = t;
    this.si++;
    this.out.push({ kind: 'starlost', star: i });
  }

  private gain(): void {
    if (this.mashing) return;
    this.onBeat++;
    this.streak++;
    this.bestStreak = Math.max(this.bestStreak, this.streak);
    this.offRun = 0;
    this.flow = Math.min(1, this.flow + GAIN);
    this.muffle = Math.max(0, this.muffle - 0.5);
  }

  /**
   * The anti-mash rule (the owner's, revised 2026-11-26: the earlier "two wasted taps in two seconds" caught honest
   * players in dense stretches). Mashing is a sustained pattern: four or more wasted taps within three seconds, or a
   * full second of tapping well over twice the chart's rate (at least four taps, and more than twice the marks in that
   * second plus one). While it holds, the buffer does not apply and a stray tap near an opening hits the ring.
   */
  private mashed(t: number): boolean {
    const w = 1 / this.c.spb;
    if ((t - this.lastAny) * this.c.spb > BOUNCE_S) this.indep.push(t);
    this.lastAny = t;
    this.lately.push(t);
    while (this.lately.length && this.lately[0] < t - w) this.lately.shift();
    const ws = this.wasted;
    if (ws.length >= 4 && t - ws[ws.length - 4] <= 3 * w) return true;
    const m = this.c.marks;
    const marks = (from: number, to: number): number => { let lo = 0, hi = m.length; while (lo < hi) { const mid = (lo + hi) >> 1; if (m[mid] < from) lo = mid + 1; else hi = mid; } let k = 0; for (let i = lo; i < m.length && m[i] <= to; i++) k++; return k; };
    // three seconds of taps (bounces apart) running three or more ahead of the chart: a steady spammer, whatever its rate
    while (this.indep.length && this.indep[0] < t - 3 * w) this.indep.shift();
    if (this.indep.length >= marks(t - 3 * w, t + 0.25 * w) + 3) return true;
    const n = this.lately.length;
    if (n < 4) return false;
    return n > 2 * marks(t - w, t + 0.25 * w) + 1;
  }

  /** A held (buffered) press: on the note builds flow; early, it is counted as early, and costs nothing else. */
  private judgeHeld(err: number): boolean {
    if (Math.abs(err) <= FLOW_S + 1e-9) return this.judge(err);
    this.judged++;
    this.offsets.press.push(err);
    return false;
  }

  /** A survival press: on the note builds flow, off it costs a notch. */
  private judge(err: number): boolean {
    this.judged++;
    this.offsets.press.push(err);
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
    this.offsets.flow.push(err);
    if (ok) this.gain();
    if (f.charge) this.charge = Math.min(1, this.charge + 1 / Math.max(1, 0.75 * this.c.chargeNotes)); // three in four fills it
    return { kind: 'spark', err, flow: ok, pitch: f.pitch, charge: f.charge };
  }

  /** The ambush: the last of the Lantern's windows has gone dark. The run ends where it stands. */
  snuff(at: number): void {
    this.crashed = true;
    this.crashBeat = at;
    this.crashKind = 'snuffed';
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
      if (fl[i].ride !== 0) continue; // gold collected by riding is never tapped
      if (!best || Math.abs(d) < Math.abs(best.d)) best = { f: fl[i], d };
    }
    return best;
  }

  /** A tap at beat-time t. */
  press(t: number): TapResult {
    const pend = this.pending, ni = this.ni, last = this.lastTap;
    this.why = '';
    const r = this.pressAt(t);
    // a wasted tap: taken (not the run-in, not a bounce), but it opened nothing, was not held for an opening, touched
    // no note and picked up no hold (four of them within three seconds is mashing: see mashed())
    const taken = this.lastTap !== last;
    const used = (r.kind !== 'none' && r.kind !== 'skip') || r.err !== undefined || this.ni !== ni || !Object.is(this.pending, pend) || this.holdAt(t) || this.c.inCharge(t) || this.why.startsWith('second tap');
    if (taken && !used && t >= this.c.start) { this.wasted.push(t); if (this.wasted.length > 6) this.wasted.shift(); }
    this.log.push({ beat: t, what: this.why + (this.mashState ? ' [mashing]' : ''), press: this.c.presses[ni]?.beat ?? NaN });
    if (this.log.length > 400) this.log.shift();
    return r;
  }
  private pressAt(t: number): TapResult {
    this.advance(t);
    const spb = this.c.spb;
    if (!this.down) { this.down = true; this.downAt = t; }
    if (this.crashed || (t - this.lastTap) * spb < DEBOUNCE_S) { this.why = this.crashed ? 'after the fall' : 'bounce (under 30 ms)'; return { kind: 'none' }; }
    // the game is still playing the run-in: taps do nothing until it hands over (a tap held early for the first press
    // after the handover is the player's own)
    const nx = this.c.presses[this.ni];
    const handing = !!nx && nx.beat >= this.autoUntil && t >= nx.beat - Math.max(nx.tol, this.c.buffer / spb) - 1e-6;
    if (t < this.autoUntil && !handing) { this.why = 'run-in (the game plays it)'; return { kind: 'none' }; }
    this.lastTap = t;
    // mashing (outside a charge) is read as off-beat tapping: flow drains and the music muffles, whatever it happens to hit
    this.recent.push(t);
    if (this.recent.length > MASH_TAPS) this.recent.shift();
    this.mashing = this.recent.length === MASH_TAPS && (t - this.recent[0]) * spb < 1 && !this.c.inCharge(t);
    if (this.mashing) { this.off(); this.slip(t); }
    const mash = this.mashed(t);
    this.mashState = mash;
    const p = this.c.presses[this.ni];
    const up = !!p && p.act === 'up'; // a Comet's second mark is taken by letting go, never by a tap
    const d = p ? t - p.beat : -Infinity;
    // the early side of the opening: its own window, or the level's buffer if that is wider (never while mashing)
    const win = p ? Math.max(p.tol, mash ? 0 : this.c.buffer / spb) + 1e-6 : 0;
    const nf = this.nearFlow(t);
    const hit = nf && Math.abs(nf.d) <= nf.f.tol * spb && !this.used.has(nf.f.beat) ? nf.f : null;
    const free = (why = 'wasted'): TapResult => {
      this.why = why;
      this.slip(t); // a tap that met nothing: in a star trail that is a slip
      this.strays++;
      if (this.mode !== 'ground') return { kind: 'none' };
      this.skip(t, p ? p.beat - p.tol : Infinity);
      return { kind: 'skip' };
    };

    // Two close presses are always two presses (2026-11-26): where the next opening is at most a beat after the one
    // just taken, a tap nearer the next one than the last is for the next one, held and performed on its beat (it used to
    // be read as re-timing the last press, and the next press then waited for a tap that had already come)
    const A = this.doneBeat;
    const close = !!p && !up && !mash && t > A && p.beat - A <= 1 + 1e-6 && p.beat - t < t - A && d < -win;
    // Survival first: a tap inside the next opening's window always opens it...
    if (p && !up && (d >= -win || close)) {
      // ...but if it was really aimed at a flow note just before the press, the flow note gets the credit,
      // and the press is judged by the next tap inside its window (or not at all)
      const spark = hit && Math.abs(nf!.d) < Math.abs(d * spb) ? this.touch(hit, t) : null;
      // an early tap is held and performed exactly on the beat (forgiving taps); never while mashing
      const held = !mash && !spark && d < 0;
      if (this.mode === 'ground' && held) {
        this.why = close ? `held for the next press (close pair), ${Math.round(-d * spb * 1000)} ms early` : `held, ${Math.round(-d * spb * 1000)} ms early`;
        if (Number.isNaN(this.pending)) { this.pending = t; this.pendingQuiet = false; this.pendingBuf = true; }
        return { kind: 'none' };
      }
      if (this.mode === 'ground') {
        this.openErr = spark ? NaN : d * spb;
        this.takeoff(p, t);
        this.needJudge = !!spark;
        this.why = spark ? 'hit (a gold note first)' : `hit, ${d >= 0 ? '+' : ''}${Math.round(d * spb * 1000)} ms`;
        if (spark) return { ...spark, kind: p.kind };
        return { kind: p.kind, err: d * spb, flow: this.judge(d * spb), pitch: p.pitch };
      }
      this.why = held ? `held in the air for the next press, ${Math.round(-d * spb * 1000)} ms early` : 'in the air: taken on landing';
      this.pending = t; // in the air: it goes the moment the ball touches down (held for the beat, if it was early)
      this.pendingQuiet = !!spark;
      this.pendingBuf = held;
      return spark ?? { kind: 'none' };
    }
    if (hit) {
      this.why = 'a gold note';
      const r = this.touch(hit, t);
      if (this.mode === 'ground') this.skip(t, p ? p.beat - p.tol : Infinity); // a little bounce on the note
      return r;
    }
    if (t <= this.doneUntil || (t - this.tookAt) * spb <= BOUNCE_S) {
      // a second tap inside the opening the ball has just used (or a bounce just after the tap that took it): it can
      // settle that press's timing, nothing more
      this.why = 'second tap on the press just taken';
      if (this.needJudge) { this.needJudge = false; const err = (t - this.doneBeat) * spb; this.openErr = err; return { kind: 'none', err, flow: this.judge(err) }; }
      return { kind: 'none' };
    }
    if (up) { this.why = 'a tap on a let-go mark'; return { kind: 'none' }; }
    if (this.holdAt(t)) return free('a hold picked up'); // picking a hold up part-way along: never punished
    if (this.c.inCharge(t)) {
      // charging the drop: tap away, nothing here can end the run; taps that miss the roll just leak a little charge
      this.charge = Math.max(0, this.charge - 0.4 / Math.max(1, 0.75 * this.c.chargeNotes));
      return free('in the charge');
    }
    if (!p || p.auto || p.after || p.wide) return free(); // nothing left to miss, or the first press after a planet hop: tapping early there is never punished
    // near a flow note, or with one still to come before the opening: the tap was for the flow note, never punished
    if (this.c.flow.some((f) => f.ride === 0 && f.beat < p.beat && (f.beat - t) * spb > -GRACE_S)) return free();
    // mashing: a stray tap in the two beats before an opening hits the ring (never in the count-in) (a steady spammer would otherwise always have a tap
    // inside every window)
    if (mash && !this.forgiving && t >= this.c.start && d >= -2) { this.why = 'MASHING: a stray tap hit the ring'; return this.crash('early', t); }
    if (d < -NEAR) { this.off(); return free(); } // far from any opening: free, though it is not on the beat
    if (this.forgiving) return free();
    // way too early, but not mashing: ignored (the opening still waits for its tap), except in the level's last stretch
    // before the buffer, where it still hits the ring (none in the first two levels)
    if (!mash && (this.c.early <= 0 || d < -(win + this.c.early))) { this.why = `way too early, ignored (${Math.round(-d * spb * 1000)} ms)`; return { kind: 'none' }; }
    this.why = `too early: hit the ring (${Math.round(-d * spb * 1000)} ms)`;
    return this.crash('early', t); // went for the opening too soon and hit the ring
  }

  /** Was the button down at a beat that has just gone by (give or take g). */
  private heldAt(b: number, g: number): boolean {
    return (this.down && this.downAt <= b + g) || (!this.down && this.upAt >= b - g && this.downAt <= b + g);
  }

  /** The button comes up at beat-time t. Letting go right on a hold's end counts like an on-beat tap; nothing else happens. */
  release(t: number): TapResult {
    this.advance(t);
    if (!this.down) return { kind: 'none' };
    this.down = false;
    this.upAt = t;
    if (this.crashed || t < this.autoUntil) return { kind: 'none' };
    const spb = this.c.spb;
    // the Comet: letting go on its second mark is the press. (Letting go before it is caught by the hold check.)
    const cp = this.c.presses[this.ni];
    if (cp && cp.act === 'up' && !cp.auto && this.mode === 'ground' && t >= cp.beat - cp.tol) {
      const err = (t - cp.beat) * spb;
      this.takeoff(cp, t);
      this.needJudge = false;
      return { kind: cp.kind, err, flow: this.judge(err), pitch: cp.pitch };
    }
    for (let i = Math.max(0, this.hi - 1); i < this.c.holds.length && i <= this.hi + 1; i++) {
      const h = this.c.holds[i];
      const err = (t - h.b) * spb;
      if (Math.abs(err) > FLOW_TOL_S || this.let.has(h.i) || (t - this.downAt) < 0.5) continue;
      this.let.add(h.i);
      this.judged++;
      const ok = Math.abs(err) <= FLOW_S + 1e-9;
      if (ok) this.gain();
      return { kind: 'release', err, flow: ok };
    }
    return { kind: 'none' };
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
        if (this.used.has(f.beat)) continue;
        if (f.ride !== 0 && (f.ride === 2 || f.beat < this.autoUntil || this.heldAt(f.beat, FLOW_TOL_S / this.c.spb))) {
          // gold along the Comet's climb (or in a form's introduction): collected by being there
          this.used.add(f.beat);
          if (!this.mashing) this.flow = Math.min(1, this.flow + TICK_GAIN);
          if (f.beat >= this.autoUntil) this.out.push({ kind: 'tick' });
          continue;
        }
        if (!f.charge) this.flow = Math.max(0, this.flow - MISS);
        if (f.beat >= this.autoUntil) this.slip(f.beat);
      }
      // gold along a hold: yours if the button is down as the ball reaches it (or came up only just before)
      const g = FLOW_TOL_S / this.c.spb;
      while (this.hi < this.c.holds.length) {
        const h = this.c.holds[this.hi];
        while (this.ti < h.ticks.length && h.ticks[this.ti] + g < nb) {
          const tk = h.ticks[this.ti++];
          this.ticked.add(tk);
          if (tk < this.autoUntil) { this.got++; continue; }
          if ((this.down && this.downAt <= tk + g) || (!this.down && this.upAt >= tk - g && this.downAt <= tk + g)) {
            this.got++;
            if (!this.mashing) this.flow = Math.min(1, this.flow + TICK_GAIN);
            this.out.push({ kind: 'tick' });
          } else { this.flow = Math.max(0, this.flow - MISS); this.slip(tk); }
        }
        if (this.ti < h.ticks.length || nb <= h.b + g) break;
        this.holdsSeen++;
        const full = this.got === h.ticks.length;
        if (full) this.holdsFull++;
        if (h.b >= this.autoUntil) this.out.push({ kind: 'held', full });
        this.hi++;
        this.ti = 0;
        this.got = 0;
      }
      // a tether: once the ball is on it the button must stay down until just before its end
      const th = this.c.holds[this.hi];
      if (th && th.tether && !this.down && !this.forgiving && th.a >= this.autoUntil && this.mode === 'flight' && this.doneBeat === th.a && nb > th.a + TETHER_GRIP && nb < th.b - TETHER_LET_S / this.c.spb) {
        this.crashed = true;
        this.crashBeat = nb;
        this.crashKind = 'let';
        break;
      }
      // the Comet: between its two marks the button must stay down (as on a tether)
      const cp = ps[this.ni];
      if (cp && cp.act === 'up' && !cp.auto && !this.down && !this.forgiving && cp.beat >= this.autoUntil && nb > Math.max(this.doneBeat, this.tookAt) + TETHER_GRIP && nb < cp.beat - cp.tol) {
        this.crashed = true;
        this.crashBeat = nb;
        this.crashKind = 'let';
        break;
      }
      // a star trail played through to its end with no slip: the star is collected
      const st = this.c.stars[this.si];
      if (st && nb > st.b + g + 2 * step) {
        if (this.stars[this.si] === 0) { this.stars[this.si] = 1; this.starBeat[this.si] = st.b; this.out.push({ kind: 'star', star: this.si }); }
        this.si++;
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
      if (!Number.isNaN(this.pending) && nb >= (this.pendingBuf ? p.beat : p.beat - p.tol)) {
        const err = (this.pending - p.beat) * this.c.spb;
        const quiet = this.pendingQuiet;
        const buf = this.pendingBuf;
        this.openErr = quiet ? NaN : err;
        this.takeoff(p, buf ? p.beat : nb);
        this.needJudge = quiet;
        this.out.push(quiet ? { kind: p.kind } : { kind: p.kind, err, flow: buf ? this.judgeHeld(err) : this.judge(err), pitch: p.pitch });
      } else if (p.auto || p.beat < this.autoUntil) {
        if (nb >= p.beat) {
          this.takeoff(p, p.beat);
          this.needJudge = p.auto && p.beat >= this.autoUntil; // a tap right on a launch still counts for flow
          this.out.push({ kind: p.kind, err: 0, pitch: p.pitch, auto: true });
        }
      } else if (nb > p.beat + p.tol && this.forgiving) {
        this.takeoff(p, nb);
        this.helped++;
        this.out.push({ kind: p.kind, err: 0, pitch: p.pitch, auto: true });
      } else if (nb > p.beat + p.tol) {
        this.crashed = true; // ran off the end of the ring
        this.crashBeat = nb;
        this.crashKind = 'edge';
      }
    }
  }
}
