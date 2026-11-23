import { audio, type LoadedTrack } from '../audio/audio';
import { Level } from '../game/level';
import type { LevelPack } from '../game/packs';
import { save } from '../save';
import { SmoothClock } from './clock';
import { buildCourse, type Course } from './course';
import { layers, pitchLookup } from './presses';
import { Sim, type TapResult } from './sim';

export type RunState = 'loading' | 'playing' | 'paused' | 'resuming' | 'failed' | 'done' | 'error';
/** partial: started part-way through from the menu ("start at the build-up"); plays like a normal run but is not saved */
export interface RunOptions { bot?: boolean; practice?: boolean; partial?: boolean; startAt?: number; leadIn?: number }
export interface RunEvent { kind: 'hop' | 'flip' | 'spark' | 'skip' | 'land' | 'crash' | 'drop'; flow?: boolean; charge?: boolean; full?: boolean; power?: number }

const RESUME_COUNT = 1.2;

/** One attempt: the ball orbits by itself, a tap on a note hops it to the next ring, a missed opening ends it. */
export class GdRun {
  readonly level: Level;
  readonly course: Course;
  readonly sim: Sim;
  /** song times: where this attempt starts, and where the built stretch of the level starts and ends */
  readonly startAt: number;
  readonly t0: number;
  readonly t1: number;
  readonly clock = new SmoothClock();
  state: RunState = 'loading';
  time: number;
  viewTime: number;
  resumeAt = 0;
  error = '';
  /** what just happened, for the renderer: it empties the list each frame */
  events: RunEvent[] = [];
  /** song milliseconds per page millisecond, frame by frame: 1.000 is perfectly smooth */
  stepLog: number[] = [];
  /** whether the drop went off in full (null until it happens), and how big it was, 0..1: charge times flow */
  dropFull: boolean | null = null;
  dropPower = 1;
  private songStart = 0;
  private latency = 0;
  private music: { stop: (fade?: number) => void } | null = null;
  private bi = 0;
  private ended = false;
  private lastNow = 0;
  private seenLand = -99;
  private readonly leadIn: number;

  constructor(readonly pack: LevelPack, readonly opts: RunOptions, private onEnd: (run: GdRun) => void) {
    this.level = new Level(pack.level, pack.audio, pack.chart);
    const spb = this.level.spb;
    this.course = buildCourse(this.level, layers(pack), pitchLookup(pack), pack.level.lab);
    this.t0 = this.course.start * spb;
    this.t1 = Math.min(this.course.end * spb, this.level.endTime);
    this.startAt = Math.max(this.t0, opts.startAt ?? this.t0);
    this.leadIn = opts.leadIn ?? 1;
    this.time = this.viewTime = this.startAt - this.leadIn;
    // from a checkpoint, the game plays the notes of the run-in itself and hands over on the checkpoint
    this.sim = new Sim(this.course, this.time / spb, this.startAt > this.t0 ? this.startAt / spb : -Infinity);
    while (this.bi < this.course.taps.length && this.course.taps[this.bi] * spb < this.startAt) this.bi++;
    if (this.startAt / spb > this.course.dropBeat) this.dropFull = true;
  }

  async start(): Promise<void> {
    let track: LoadedTrack | null = null;
    if (audio.ensure()) {
      try {
        audio.buildHitsounds(this.pack.level.hitsoundNote);
        track = await audio.loadTrack(this.pack.audio);
      } catch (e) {
        this.state = 'error';
        this.error = e instanceof Error ? e.message : String(e);
        return;
      }
    }
    if (this.ended) return;
    await audio.resume();
    audio.setMuffle(0);
    const c = audio.ctx;
    const off = this.pack.audio.offset;
    if (c && track) {
      const pos = off + track.shift + this.startAt - this.leadIn;
      const t0 = c.currentTime + (pos < 0 ? -pos : 0) + 0.1;
      this.music = audio.playMusic(track.buffer, t0, Math.max(0, pos));
      this.songStart = t0 - (Math.max(0, pos) - off - track.shift);
      this.latency = audio.latency();
    } else this.songStart = performance.now() / 1000 + this.leadIn - this.startAt;
    this.clock.reset();
    this.state = 'playing';
  }

  private target(now: number): number {
    return audio.ctxTimeAt(now) - this.songStart - this.latency - save.audioOffset / 1000;
  }

  /** How far through the built stretch, 0..1. */
  get progress(): number {
    return Math.max(0, Math.min(1, (this.time - this.t0) / (this.t1 - this.t0)));
  }

  get pct(): number {
    return this.state === 'done' ? 100 : Math.min(99, Math.floor(this.progress * 100));
  }

  /** Song time of the crash, or -1. */
  get crashTime(): number {
    return this.sim.crashed ? this.sim.crashBeat * this.level.spb : -1;
  }

  private react(r: TapResult): void {
    if (r.kind === 'none' || r.kind === 'crash') return;
    if (r.kind === 'skip') { audio.hit('stray', 0.3); this.events.push({ kind: 'skip' }); return; }
    // one hit sound for every tap that meets a note; on the beat in a hook section it also plays the hook's pitch
    audio.hit('hit', r.auto ? 0.55 : r.kind === 'spark' ? 0.8 : 1);
    const hook = this.level.segAt(Math.max(0, this.time)).follow === 'lead';
    if (r.flow && hook && r.pitch) audio.pluck(r.pitch, 0.5);
    if (r.charge) {
      // charging the drop: each tap on the roll plays the next step up the song's scale
      const scale = this.pack.level.scale ?? [0, 2, 4, 5, 7, 9, 11];
      const k = Math.min(14, Math.floor(this.sim.charge * 14));
      audio.pluck(60 + 12 * Math.floor(k / scale.length) + scale[k % scale.length], 0.4);
    }
    this.events.push({ kind: r.kind, flow: !!r.flow || !!r.auto, charge: !!r.charge });
  }

  /** The one button. The tap is applied at the moment it happened, not when the next frame runs. */
  tap(perfMs: number): void {
    if (this.state !== 'playing') return;
    this.react(this.sim.press(this.clock.at(perfMs) / this.level.spb));
  }

  frame(now: number): void {
    audio.tick(now);
    if (this.state === 'resuming' && now >= this.resumeAt) { this.state = 'playing'; this.clock.reset(); this.lastNow = 0; void audio.resume(); }
    if (this.state !== 'playing') return;
    if (this.time < this.startAt + 1) this.latency = audio.latency();
    const prev = this.clock.t;
    const t = this.clock.tick(now, this.target(now));
    if (this.lastNow && now > this.lastNow) {
      this.stepLog.push(((t - prev) * 1000) / (now - this.lastNow));
      if (this.stepLog.length > 6000) this.stepLog.shift();
    }
    this.lastNow = now;
    this.time = t;
    this.viewTime = t + save.visualOffset / 1000;
    const beat = t / this.level.spb;
    if (this.opts.bot) while (this.bi < this.course.taps.length && this.course.taps[this.bi] <= beat) this.react(this.sim.press(this.course.taps[this.bi++]));
    this.sim.advance(beat);
    while (this.sim.out.length) this.react(this.sim.out.shift()!);
    if (this.sim.landedAt !== this.seenLand) { this.seenLand = this.sim.landedAt; this.events.push({ kind: 'land' }); }
    audio.setMuffle(this.sim.muffle);
    if (this.dropFull === null && beat >= this.course.dropBeat) {
      // the drop is as big as you made it: the charge from the roll, times how well you are in flow
      this.dropPower = this.sim.charge * Math.min(1, this.sim.flow / 0.6) * (1 - 0.5 * this.sim.muffle);
      this.dropFull = this.dropPower >= 0.8;
      audio.hit('impact', 0.3 + 0.7 * this.dropPower);
      this.events.push({ kind: 'drop', full: this.dropFull, power: this.dropPower });
    }
    if (this.sim.crashed) {
      audio.hit('miss', 0.9);
      this.events.push({ kind: 'crash' });
      this.finish('failed', 420);
    } else if (t >= this.t1) this.finish('done', 600);
  }

  private finish(state: 'failed' | 'done', delay: number): void {
    if (this.ended) return;
    this.ended = true;
    this.state = state;
    this.music?.stop(state === 'failed' ? 0.1 : 0.5);
    setTimeout(() => { audio.setMuffle(0); this.onEnd(this); }, delay);
  }

  /** Autoplay proof of smooth movement: how evenly the game clock advanced, frame by frame. */
  smoothness(): { frames: number; worstPct: number; meanPct: number } {
    let worst = 0;
    let sum = 0;
    for (const r of this.stepLog) { const d = Math.abs(r - 1); sum += d; if (d > worst) worst = d; }
    return { frames: this.stepLog.length, worstPct: worst * 100, meanPct: this.stepLog.length ? (sum / this.stepLog.length) * 100 : 0 };
  }

  pause(): void {
    if (this.state !== 'playing' && this.state !== 'resuming') return;
    this.state = 'paused';
    void audio.suspend();
  }

  resume(): void {
    if (this.state !== 'paused') return;
    this.state = 'resuming';
    this.resumeAt = performance.now() + RESUME_COUNT * 1000;
  }

  stop(): void {
    this.ended = true;
    this.music?.stop(0.08);
    this.state = 'done';
    audio.setMuffle(0);
    void audio.resume();
  }
}
