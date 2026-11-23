/**
 * A smooth monotonic game clock. It runs on the page's own timer and is only ever nudged (by at most 0.5%)
 * toward the audio clock, so the picture never steps. It re-seats only when it is badly out (start, resume).
 */
export class SmoothClock {
  t = 0;
  private last = -1;
  private rate = 1;

  reset(): void {
    this.last = -1;
    this.rate = 1;
  }

  tick(nowMs: number, target: number): number {
    if (this.last < 0 || Math.abs(target - this.t) > 0.25) {
      this.t = target;
      this.rate = 1;
    } else {
      this.t += Math.min(0.1, (nowMs - this.last) / 1000) * this.rate;
      const err = target - this.t;
      this.rate = 1 + Math.max(-0.005, Math.min(0.005, err * 0.4));
    }
    this.last = nowMs;
    return this.t;
  }

  /** Clock reading at another page timestamp (an input event's own time). */
  at(perfMs: number): number {
    return this.last < 0 ? this.t : this.t + ((perfMs - this.last) / 1000) * this.rate;
  }
}
