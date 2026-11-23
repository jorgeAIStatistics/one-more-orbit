import type { AudioMeta, ChartFile, LevelFile, RNote, Ring, Segment, Shape } from './types';

export const TICKS_PER_BEAT = 12;
const TWO_PI = Math.PI * 2;

// ---- orbit shapes. Each is a closed path; the ball moves along it at constant speed, so distance reads as time.
function rawPoint(shape: Shape, a: number): [number, number] {
  const c = Math.cos(a);
  const s = Math.sin(a);
  if (shape === 'ellipse') return [c * 1.16, s * 0.84];
  if (shape === 'square') return [Math.sign(c) * Math.pow(Math.abs(c), 0.5) * 1.04, Math.sign(s) * Math.pow(Math.abs(s), 0.5) * 1.04];
  return [c, s];
}
const TABLES = new Map<Shape, Float32Array>();
function table(shape: Shape): Float32Array {
  let t = TABLES.get(shape);
  if (!t) {
    // t[i] = raw angle at which i/N of the path's length has been travelled
    const N = 720;
    const cum = new Float32Array(N + 1);
    let [px, py] = rawPoint(shape, 0);
    for (let i = 1; i <= N; i++) {
      const [x, y] = rawPoint(shape, (i / N) * TWO_PI);
      cum[i] = cum[i - 1] + Math.hypot(x - px, y - py);
      px = x; py = y;
    }
    t = new Float32Array(N + 1);
    let j = 0;
    for (let i = 0; i <= N; i++) {
      const target = (i / N) * cum[N];
      while (j < N && cum[j + 1] < target) j++;
      const span = cum[j + 1] - cum[j] || 1;
      t[i] = ((j + (target - cum[j]) / span) / N) * TWO_PI;
    }
    TABLES.set(shape, t);
  }
  return t;
}
/** Point on a unit-sized shape after travelling `angle / 2π` of the way round it. */
export function shapePoint(shape: Shape, angle: number): [number, number] {
  if (shape === 'circle') return [Math.cos(angle), Math.sin(angle)];
  const t = table(shape);
  const N = t.length - 1;
  let u = (angle / TWO_PI) % 1;
  if (u < 0) u += 1;
  const f = u * N;
  const i = Math.floor(f);
  return rawPoint(shape, t[i] + (t[Math.min(N, i + 1)] - t[i]) * (f - i));
}

/**
 * A level's timeline: sections, notes, and the chain of rings the ball jumps through.
 * Notes close together share a ring (bursts of up to three); a ring's last gate is its exit.
 */
export class Level {
  readonly id: string;
  readonly title: string;
  readonly artist: string;
  readonly spb: number;
  readonly segments: Segment[] = [];
  readonly notes: RNote[] = [];
  readonly rings: Ring[] = [];
  readonly totalBeats: number;
  readonly endTime: number;
  readonly dropTime: number;
  private kick = '';
  private snare = '';

  constructor(readonly file: LevelFile, readonly audio: AudioMeta, readonly chart: ChartFile) {
    this.id = file.id;
    this.title = file.title;
    this.artist = file.artist;
    this.spb = 60 / audio.bpm;
    let bar = 0;
    file.segments.forEach((s, index) => {
      const beat0 = bar * 4;
      const beat1 = beat0 + s.bars * 4;
      this.segments.push({ ...s, index, bar0: bar, beat0, beat1, t0: beat0 * this.spb, t1: beat1 * this.spb });
      bar += s.bars;
    });
    this.totalBeats = bar * 4;
    this.endTime = audio.length - audio.offset - 0.05;
    this.dropTime = audio.dropTime - audio.offset;
    this.kick = chart.energy?.kick ?? '';
    this.snare = chart.energy?.snare ?? '';

    const defs = [...chart.notes].sort((a, b) => a.t - b.t);
    defs.forEach((n, i) => {
      const beat = n.t / TICKS_PER_BEAT;
      const t = beat * this.spb;
      this.notes.push({
        i, kind: n.k === 'j' ? 'hop' : 'tap', t, beat, seg: this.segAt(t + 1e-6).index, ring: 0, angle: 0, exit: false,
        accent: n.a === 1, ghost: n.g ?? 0, voice: n.v ?? 'l', pitch: n.p ?? 0, done: false, judge: null, hitT: -1
      });
    });

    let lastBeat = 0;
    let lastAngle = -Math.PI / 2;
    let dir = 1;
    let lvl = 0;
    let prevSeg = -1;
    let flipKey = '';
    let i = 0;
    while (i < this.notes.length) {
      const first = i;
      let last = i;
      while (last + 1 < this.notes.length && last - first < 2 && this.notes[last + 1].seg === this.notes[first].seg &&
        this.notes[last + 1].beat - this.notes[last].beat <= 0.5001) last++;
      const seg = this.segments[this.notes[first].seg];
      const span = this.notes[last].beat - lastBeat;
      let lap = seg.lap;
      // Ring speed is constant across a section, so the gap between gates always reads as time.
      // (Safety only: a ring is slowed if the ball would otherwise lap it before its exit gate.)
      while (span > lap * 0.875) lap *= 2;
      let reversed = false;
      if (seg.index !== prevSeg && seg.reverse) { dir = -dir; reversed = true; }
      if (seg.revEvery) {
        const key = `${seg.index}:${Math.floor((this.notes[first].beat - seg.beat0) / (seg.revEvery * 4))}`;
        if (key !== flipKey) { if (flipKey.startsWith(`${seg.index}:`)) { dir = -dir; reversed = true; } flipKey = key; }
      }
      const idx = this.rings.length;
      if (idx > 0) lvl += (seg.jump === 'in' ? -1 : 1) + (seg.index !== prevSeg && seg.rocket ? seg.rocket : 0);
      prevSeg = seg.index;
      const ring: Ring = { idx, b0: lastBeat, exitBeat: this.notes[last].beat, a0: lastAngle, dir, lap, lvl, seg: seg.index, shape: seg.shape ?? 'circle', first, last, reversed };
      for (let k = first; k <= last; k++) {
        const n = this.notes[k];
        n.ring = idx;
        n.angle = ring.a0 + (dir * TWO_PI * (n.beat - ring.b0)) / lap;
        n.exit = k === last;
      }
      this.rings.push(ring);
      lastBeat = this.notes[last].beat;
      lastAngle = this.notes[last].angle;
      i = last + 1;
    }
    // a last, empty ring to coast on after the final gate
    const end = this.segments[this.segments.length - 1];
    this.rings.push({ idx: this.rings.length, b0: lastBeat, exitBeat: Infinity, a0: lastAngle, dir, lap: 8, lvl: lvl + 1 + (end.rocket ?? 0), seg: end.index, shape: end.shape ?? 'circle', first: this.notes.length, last: this.notes.length - 1, reversed: false });
  }

  segAt(t: number): Segment {
    const segs = this.segments;
    for (let i = segs.length - 1; i >= 0; i--) if (t >= segs[i].t0) return segs[i];
    return segs[0];
  }

  /** The ring the ball is on at `beat` (it leaves a ring at its exit gate whether or not the tap landed). */
  ringAt(beat: number): Ring {
    const r = this.rings;
    let lo = 0;
    let hi = r.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (beat > r[mid].exitBeat) lo = mid + 1; else hi = mid;
    }
    return r[lo];
  }

  angleOn(ring: Ring, beat: number): number {
    return ring.a0 + (ring.dir * TWO_PI * (beat - ring.b0)) / ring.lap;
  }

  /** Baked kick / snare strength (0..1) at a song time, with a fast decay inside each 16th. */
  energyAt(which: 'kick' | 'snare', t: number): number {
    const s = which === 'kick' ? this.kick : this.snare;
    if (!s || t < 0) return 0;
    const step = this.spb / 4;
    const i = Math.floor(t / step);
    if (i >= s.length) return 0;
    const cur = (s.charCodeAt(i) - 48) / 9;
    const prev = i > 0 ? (s.charCodeAt(i - 1) - 48) / 9 : 0;
    const f = (t - i * step) / step;
    return Math.max(cur * Math.exp(-f * 2.2), prev * Math.exp(-(f + 1) * 2.2));
  }
}
