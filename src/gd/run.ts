import { audio, type LoadedTrack } from '../audio/audio';
import { Level } from '../game/level';
import type { LevelPack } from '../game/packs';
import { save } from '../save';
import { SmoothClock } from './clock';
import { Sim } from './sim';
import { buildTrack, type Track } from './track';

export type RunState = 'loading' | 'playing' | 'paused' | 'resuming' | 'failed' | 'done' | 'error';
export interface RunOptions { bot?: boolean; practice?: boolean; startAt?: number; leadIn?: number }
export type RunEvent = 'jump' | 'orb' | 'land' | 'pad' | 'launch' | 'crash';

const RESUME_COUNT = 1.2;

/** One attempt in the new core: the ball moves by itself, a tap hops, a hazard ends the attempt. */
export class GdRun {
  readonly level: Level;
  readonly track: Track;
  readonly sim: Sim;
  readonly startAt: number;
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
  private songStart = 0;
  private latency = 0;
  private music: { stop: (fade?: number) => void } | null = null;
  private bi = 0;
  private ended = false;
  private lastNow = 0;
  private seenJumps = 0;
  private seenPads = 0;
  private seenLand = -9;
  private readonly leadIn: number;

  constructor(readonly pack: LevelPack, readonly opts: RunOptions, private onEnd: (run: GdRun) => void) {
    this.level = new Level(pack.level, pack.audio, pack.chart);
    this.track = buildTrack(this.level);
    this.startAt = opts.startAt ?? 0;
    this.leadIn = opts.leadIn ?? 1;
    this.time = this.viewTime = this.startAt - this.leadIn;
    this.sim = new Sim(this.track, this.time / this.level.spb);
    while (this.bi < this.track.presses.length && this.track.presses[this.bi] * this.level.spb < this.time) this.bi++;
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

  /** How far through the level, 0..1. */
  get progress(): number {
    return Math.max(0, Math.min(1, this.time / this.level.endTime));
  }

  get pct(): number {
    return this.state === 'done' ? 100 : Math.min(99, Math.floor(this.progress * 100));
  }

  /** Song time of the crash, or -1. */
  get crashTime(): number {
    return this.sim.crashed ? this.sim.crashBeat * this.level.spb : -1;
  }

  /** The one button. The tap is applied at the moment it happened, not when the next frame runs. */
  tap(perfMs: number): void {
    if (this.state !== 'playing') return;
    const r = this.sim.press(this.clock.at(perfMs) / this.level.spb);
    if (r === 'none') return;
    this.seenJumps = this.sim.jumps;
    audio.hit('hit', 1);
    this.events.push(r);
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
    if (this.opts.bot) {
      while (this.bi < this.track.presses.length && this.track.presses[this.bi] <= beat) {
        const r = this.sim.press(this.track.presses[this.bi++]);
        if (r !== 'none') { audio.hit('hit', 1); this.events.push(r); this.seenJumps = this.sim.jumps; }
      }
    }
    this.sim.advance(beat);
    if (this.sim.jumps > this.seenJumps) { this.seenJumps = this.sim.jumps; audio.hit('hit', 1); this.events.push('jump'); } // a buffered tap
    if (this.sim.padsHit > this.seenPads) {
      this.seenPads = this.sim.padsHit;
      const big = this.track.pads.some((p) => p.big && Math.abs(p.beat - (this.sim.air?.b0 ?? -9)) < 0.3);
      audio.hit(big ? 'impact' : 'hop', big ? 1 : 0.7);
      this.events.push(big ? 'launch' : 'pad');
    }
    if (this.sim.landedAt !== this.seenLand) { this.seenLand = this.sim.landedAt; this.events.push('land'); }
    if (this.sim.crashed) {
      audio.hit('miss', 0.9);
      this.events.push('crash');
      this.finish('failed', 420);
    } else if (t >= this.level.endTime) this.finish('done', 500);
  }

  private finish(state: 'failed' | 'done', delay: number): void {
    if (this.ended) return;
    this.ended = true;
    this.state = state;
    this.music?.stop(state === 'failed' ? 0.1 : 0.2);
    setTimeout(() => this.onEnd(this), delay);
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
    void audio.resume();
  }
}
