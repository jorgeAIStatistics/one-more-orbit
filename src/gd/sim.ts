import { BAR_H, BUFFER_S, JUMP, ORB_WIN, PAD_ZONE, SPIKE_H, arc, type Track } from './track';

/**
 * Fixed-timestep simulation of the ball's hop state. Pure and deterministic: the same taps always give the
 * same run, at any frame rate. There is no judge: a tap either gets the ball over the hazard or it crashes.
 */
export class Sim {
  static readonly STEP = 1 / 240; // seconds
  beat: number;
  air: { b0: number; h0: number } | null = null;
  crashed = false;
  crashBeat = -1;
  crashKind: 'spike' | 'bar' | '' = '';
  /** hops started by a tap (ground hops, buffered hops and orb taps) */
  jumps = 0;
  padsHit = 0;
  landedAt = -9;
  private buffer = -1;
  private used = new Set<number>();
  private hi = 0;
  private pi = 0;

  constructor(readonly tr: Track, start = 0) {
    this.beat = start;
    while (this.hi < tr.hazards.length && tr.hazards[this.hi].b1 < start) this.hi++;
    while (this.pi < tr.pads.length && tr.pads[this.pi].beat + PAD_ZONE < start) this.pi++;
  }

  /** Height above the track (1 = top of a hop) at beat-time b. */
  height(b = this.beat): number {
    return this.air ? Math.max(0, arc(this.air.h0, Math.max(0, b - this.air.b0) / JUMP)) : 0;
  }

  /** Vertical speed, in hop heights per beat. */
  speed(b = this.beat): number {
    return this.air ? 4 - this.air.h0 - 8 * Math.max(0, b - this.air.b0) / JUMP : 0;
  }

  orbUsed(beat: number): boolean {
    return this.used.has(beat);
  }

  /** A tap at beat-time b. On the ground it hops; in the air it uses a jump orb if one is in reach. */
  press(b: number): 'jump' | 'orb' | 'none' {
    this.advance(b);
    if (this.crashed) return 'none';
    if (!this.air) { this.air = { b0: Math.max(b, this.beat), h0: 0 }; this.jumps++; return 'jump'; }
    const o = this.tr.orbs.find((x) => !this.used.has(x.beat) && Math.abs(x.beat - b) <= ORB_WIN);
    if (o) { this.used.add(o.beat); this.air = { b0: b, h0: this.height(b) }; this.jumps++; return 'orb'; }
    this.buffer = b;
    return 'none';
  }

  advance(to: number): void {
    const step = Sim.STEP / this.tr.spb;
    const hz = this.tr.hazards;
    const pads = this.tr.pads;
    while (!this.crashed && this.beat < to - 1e-9) {
      const nb = Math.min(to, this.beat + step);
      this.beat = nb;
      if (this.air && nb - this.air.b0 >= JUMP) {
        const land = this.air.b0 + JUMP;
        this.air = null;
        this.landedAt = land;
        if (this.buffer >= 0 && (land - this.buffer) * this.tr.spb <= BUFFER_S) { this.air = { b0: land, h0: 0 }; this.jumps++; }
        this.buffer = -1;
      }
      // launch pads fire by themselves if the ball is on the track anywhere along them
      while (this.pi < pads.length && pads[this.pi].beat <= nb) {
        const p = pads[this.pi];
        if (!this.air) { this.air = { b0: Math.max(p.beat, Math.min(nb, this.landedAt)), h0: 0 }; this.padsHit++; this.pi++; }
        else if (nb > p.beat + PAD_ZONE) this.pi++;
        else break;
      }
      const y = this.height(nb);
      while (this.hi < hz.length && hz[this.hi].b1 < nb - 2) this.hi++;
      for (let i = this.hi; i < hz.length && hz[i].b0 <= nb; i++) {
        const h = hz[i];
        if (nb <= h.b1 && (h.kind === 'spike' ? y < SPIKE_H : y > BAR_H)) { this.crashed = true; this.crashBeat = nb; this.crashKind = h.kind; break; }
      }
    }
  }
}
