import type { AudioMeta, ChartFile, Hand, LevelFile, OrbitPiece, RNote, Segment } from './types';

export const TICKS_PER_BEAT = 12;
const TWO_PI = Math.PI * 2;

/** A level's timeline: segments in seconds and beats, plus where each ball is on its ring at any beat. */
export class Level {
  readonly id: string;
  readonly title: string;
  readonly artist: string;
  readonly spb: number;
  readonly segments: Segment[] = [];
  readonly totalBeats: number;
  readonly endTime: number; // song time at which the level is over
  readonly dropTime: number; // song time of the main drop
  private orbit: OrbitPiece[][] = [[], []];

  constructor(readonly file: LevelFile, readonly audio: AudioMeta, laps?: Record<string, number>) {
    this.id = file.id;
    this.title = file.title;
    this.artist = file.artist;
    this.spb = 60 / audio.bpm;
    let bar = 0;
    file.segments.forEach((s, index) => {
      const beat0 = bar * 4;
      const beat1 = beat0 + s.bars * 4;
      this.segments.push({ ...s, lap: laps?.[s.id] ?? s.lap, index, bar0: bar, beat0, beat1, t0: beat0 * this.spb, t1: beat1 * this.spb });
      bar += s.bars;
    });
    this.totalBeats = bar * 4;
    this.endTime = audio.length - audio.offset - 0.05;
    this.dropTime = audio.dropTime - audio.offset;

    // Ring 0 is the main (cyan) ring; ring 1 is the outer (pink) ring used in dual orbit.
    for (let ring = 0; ring < 2; ring++) {
      let angle = -Math.PI / 2;
      let dir = 1;
      for (const s of this.segments) {
        if (s.dir) dir = s.dir;
        const step = s.revEvery ? s.revEvery * 4 : s.beat1 - s.beat0;
        for (let b = s.beat0, k = 0; b < s.beat1 - 1e-6; b += step, k++) {
          if (k > 0) dir = -dir;
          const d = ring === 1 && s.counter ? -dir : dir;
          const b1 = Math.min(s.beat1, b + step);
          this.orbit[ring].push({ b0: b, b1, lap: s.lap, dir: d, a0: angle });
          angle += (d * TWO_PI * (b1 - b)) / s.lap;
        }
      }
    }
  }

  timeOfBeat(beat: number): number {
    return beat * this.spb;
  }

  segAt(t: number): Segment {
    const segs = this.segments;
    for (let i = segs.length - 1; i >= 0; i--) if (t >= segs[i].t0) return segs[i];
    return segs[0];
  }

  pieceAt(ring: number, beat: number): OrbitPiece {
    const p = this.orbit[ring];
    for (let i = p.length - 1; i >= 0; i--) if (beat >= p[i].b0) return p[i];
    return p[0];
  }

  /** Angle of the ball on `ring` at `beat` (before bar 1 and after the end it keeps coasting). */
  angleAt(ring: number, beat: number): number {
    const p = this.orbit[ring];
    let piece = p[0];
    if (beat >= p[p.length - 1].b0) piece = p[p.length - 1];
    else for (let i = p.length - 1; i >= 0; i--) if (beat >= p[i].b0) { piece = p[i]; break; }
    return piece.a0 + (piece.dir * TWO_PI * (beat - piece.b0)) / piece.lap;
  }

  /** Beats where a ring changes direction (drawn as reverse markers). */
  reversals(ring: number): number[] {
    const out: number[] = [];
    const p = this.orbit[ring];
    for (let i = 1; i < p.length; i++) if (p[i].dir !== p[i - 1].dir) out.push(p[i].b0);
    return out;
  }
}

export function buildNotes(level: Level, chart: ChartFile): RNote[] {
  const notes: RNote[] = chart.notes.map((n, i) => {
    const beat = n.t / TICKS_PER_BEAT;
    const beat1 = (n.t + (n.d ?? 0)) / TICKS_PER_BEAT;
    const t = beat * level.spb;
    const seg = level.segAt(t + 1e-6);
    const hand: Hand = n.h ?? 'A';
    return {
      i,
      kind: n.k === 't' ? 'tap' : n.k === 'h' ? 'hold' : n.k === 'z' ? 'haz' : 'spin',
      hand,
      t,
      t1: beat1 * level.spb,
      beat,
      beat1,
      lane: n.lane ?? 0,
      need: n.n ?? 0,
      seg: seg.index,
      ring: seg.mode === 'dual' && hand === 'R' ? 1 : 0,
      accent: n.a === 1,
      headDone: false,
      tailDone: false,
      headJudge: null,
      heldBy: null,
      got: 0,
      hitT: -1
    };
  });
  notes.sort((a, b) => a.t - b.t || a.i - b.i);
  return notes;
}
