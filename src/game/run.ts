import { audio, type LoadedTrack } from '../audio/audio';
import { save } from '../save';
import { botTimes } from './bot';
import { Engine, type JEvent } from './engine';
import { Level } from './level';
import type { LevelPack } from './packs';
import type { Judge, Segment } from './types';

export type RunState = 'loading' | 'playing' | 'paused' | 'resuming' | 'failed' | 'done' | 'error';

/** Things that happened this frame, for the renderer and HUD to react to. */
export type Fx = { type: 'judge'; ev: JEvent; auto: boolean } | { type: 'enter'; seg: Segment } | { type: 'tap' } | { type: 'stray' };

export interface RunOptions {
  bot?: boolean;
  hardcore?: boolean;
  practice?: boolean;
  /** song time to start from (practice checkpoints) */
  startAt?: number;
}

const LEAD_IN = 1.0; // seconds of run-up before the first sample (or before a checkpoint)
const RESUME_COUNT = 1.2;

/** One attempt at a level: owns the music, the clock mapping, the judging engine and the bot. */
export class Run {
  readonly level: Level;
  readonly engine: Engine;
  readonly startAt: number;
  state: RunState = 'loading';
  /** song time (seconds from bar 1) that judging uses right now */
  time: number;
  /** song time the picture is drawn at (time + visual offset) */
  viewTime: number;
  fx: Fx[] = [];
  lastJudge: { judge: Judge; err: number | null; at: number; label: string } | null = null;
  recentErrs: Array<{ err: number; judge: Judge; at: number }> = [];
  resumeAt = 0;
  error = '';
  exactDecode = true;
  decodeShift = 0;
  private songStart = 0;
  private latency = 0;
  private music: { stop: (fade?: number) => void } | null = null;
  private bot: number[] | null = null;
  private bi = 0;
  private segIndex = -1;
  private ended = false;

  constructor(readonly pack: LevelPack, readonly opts: RunOptions, private onEnd: (run: Run) => void) {
    this.level = new Level(pack.level, pack.audio, pack.chart);
    this.startAt = opts.startAt ?? 0;
    this.time = this.viewTime = this.startAt - LEAD_IN;
    this.engine = new Engine(this.level, { hardcore: opts.hardcore, noFail: opts.bot, startAt: opts.startAt });
    if (opts.bot) this.bot = botTimes(this.level, this.startAt);
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
      // The decoded buffer's own timeline is the clock: song time 0 is bar 1 of the audio.
      const pos = off + track.shift + this.startAt - LEAD_IN; // where in the buffer playback begins
      const t0 = c.currentTime + (pos < 0 ? -pos : 0) + 0.12;
      this.music = audio.playMusic(track.buffer, t0, Math.max(0, pos));
      this.songStart = t0 - (Math.max(0, pos) - off - track.shift);
      this.exactDecode = track.exact;
      this.decodeShift = track.shift;
      this.latency = audio.latency();
    } else {
      this.songStart = performance.now() / 1000 + LEAD_IN - this.startAt; // silent fallback on the page clock
    }
    this.state = 'playing';
  }

  songTimeAt(perfMs: number): number {
    return audio.ctxTimeAt(perfMs) - this.songStart - this.latency - save.audioOffset / 1000;
  }

  private perfForSong(t: number): number {
    return audio.perfAt(t + this.songStart + this.latency + save.audioOffset / 1000);
  }

  get progress(): number {
    return Math.max(0, Math.min(1, this.time / this.level.endTime));
  }

  /** The one input: a tap, stamped with the time it happened. */
  tap(perfMs: number): void {
    if (this.state !== 'playing') return;
    const st = this.songTimeAt(perfMs);
    for (const late of this.engine.update(st)) this.onJudge(late, true); // gates already gone are settled first
    const ev = this.engine.pressAt(st);
    this.fx.push({ type: 'tap' });
    if (!ev) return;
    if ('stray' in ev) {
      audio.hit('stray', 0.8); // a stray tap never sounds like a hit
      this.lastJudge = { judge: 'miss', err: null, at: performance.now(), label: 'STRAY TAP' };
      this.fx.push({ type: 'stray' });
    } else this.onJudge(ev, false);
  }

  private onJudge(ev: JEvent, auto: boolean): void {
    const inDrop = ev.note.t >= this.level.dropTime - 1e-6;
    const j = ev.judge;
    if (j === 'miss') {
      audio.hit('miss', auto ? 0.6 : 0.85);
      audio.muffle(); // you hear that the rhythm broke
    } else {
      // ONE core hit sound for every successful tap, always the same. Extras only ever sit on top of it.
      audio.hit('hit', 1);
      if (ev.note.pitch) audio.pluck(ev.note.pitch, 0.3);
      if (j === 'perfect') audio.hit(inDrop ? 'sparkleHi' : 'sparkle', 0.45);
      if (ev.note.accent) audio.hit('impact', 0.8);
    }
    this.lastJudge = { judge: j, err: ev.err, at: performance.now(), label: j === 'miss' ? (ev.early ? 'TOO EARLY' : 'MISS') : j.toUpperCase() };
    if (ev.err !== null) {
      this.recentErrs.push({ err: ev.err, judge: j, at: performance.now() });
      if (this.recentErrs.length > 24) this.recentErrs.shift();
    }
    this.fx.push({ type: 'judge', ev, auto });
  }

  /** Once per animation frame. */
  frame(now: number): void {
    audio.tick(now);
    if (this.state === 'resuming' && now >= this.resumeAt) {
      this.state = 'playing';
      void audio.resume();
    }
    if (this.state !== 'playing') return;
    if (this.time < this.startAt + 1) this.latency = audio.latency(); // the reported latency can settle just after start
    const st = this.songTimeAt(now);
    this.time = st;
    this.viewTime = audio.viewTimeAt(now) - this.songStart - this.latency - save.audioOffset / 1000 + save.visualOffset / 1000;
    if (this.bot) while (this.bi < this.bot.length && this.bot[this.bi] <= st) this.tap(this.perfForSong(this.bot[this.bi++]));
    for (const ev of this.engine.update(st)) this.onJudge(ev, true);
    const seg = this.level.segAt(st);
    if (st >= 0 && seg.index !== this.segIndex) {
      this.segIndex = seg.index;
      this.fx.push({ type: 'enter', seg });
    }
    if (this.engine.failed) this.finish('failed', this.opts.practice ? 500 : 900);
    else if (st >= this.level.endTime) this.finish('done', 500);
  }

  private finish(state: 'failed' | 'done', delay: number): void {
    if (this.ended) return;
    this.ended = true;
    this.state = state;
    this.music?.stop(state === 'failed' ? 0.5 : 0.2);
    setTimeout(() => this.onEnd(this), delay);
  }

  pause(): void {
    if (this.state !== 'playing' && this.state !== 'resuming') return;
    this.state = 'paused';
    void audio.suspend(); // the audio clock stops with the music, so nothing can drift while paused
  }

  resume(): void {
    if (this.state !== 'paused') return;
    this.state = 'resuming';
    this.resumeAt = performance.now() + RESUME_COUNT * 1000;
  }

  /** Abandon the run (restart or quit). */
  stop(): void {
    this.ended = true;
    this.music?.stop(0.08);
    this.state = 'done';
    void audio.resume();
  }
}
