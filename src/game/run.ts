import { audio, type LoadedTrack } from '../audio/audio';
import { save } from '../save';
import { botEvents, type BotEvent } from './bot';
import { Engine, type Feedback, type JEvent } from './engine';
import { Level, buildNotes } from './level';
import type { LevelPack } from './packs';
import type { ChartFile, Difficulty, Judge, RNote, Segment, Side } from './types';

export type RunState = 'loading' | 'playing' | 'paused' | 'resuming' | 'failed' | 'done' | 'error';

/** Things that happened this frame, for the renderer and HUD to react to. */
export type Fx =
  | { type: 'judge'; ev: JEvent; auto: boolean }
  | { type: 'enter'; seg: Segment }
  | { type: 'lane'; lane: number }
  | { type: 'spin' }
  | { type: 'press'; side: Side };

export interface RunOptions {
  bot?: boolean;
  hardcore?: boolean;
}

const LEAD_IN = 1.0; // seconds between pressing play and the first sample
const RESUME_COUNT = 1.2;

/** One attempt at a chart: owns the music, the clock mapping, the judging engine and the bot. */
export class Run {
  readonly level: Level;
  readonly chart: ChartFile;
  readonly notes: RNote[];
  readonly engine: Engine;
  state: RunState = 'loading';
  /** song time (seconds from bar 1) that judging uses right now */
  time = -LEAD_IN;
  /** song time the picture is drawn at (time + visual offset) */
  viewTime = -LEAD_IN;
  fx: Fx[] = [];
  lastJudge: { judge: Judge; err: number | null; at: number; wrongSide: boolean } | null = null;
  recentErrs: Array<{ err: number; judge: Judge; at: number }> = [];
  resumeAt = 0;
  error = '';
  exactDecode = true;
  decodeShift = 0;
  private songStart = 0;
  private latency = 0;
  private music: { stop: (fade?: number) => void } | null = null;
  private bot: BotEvent[] | null = null;
  private bi = 0;
  private segIndex = -1;
  private ended = false;

  constructor(readonly pack: LevelPack, readonly difficulty: Difficulty, readonly opts: RunOptions, private onEnd: (run: Run) => void) {
    this.chart = pack.charts[difficulty];
    this.level = new Level(pack.level, pack.audio, this.chart.laps);
    this.notes = buildNotes(this.level, this.chart);
    this.engine = new Engine(this.level, this.notes, difficulty, { hardcore: opts.hardcore, noFail: opts.bot });
    if (opts.bot) this.bot = botEvents(this.level, this.notes);
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
    if (c && track) {
      const t0 = c.currentTime + LEAD_IN;
      this.music = audio.playMusic(track.buffer, t0, 0);
      // The decoded buffer's own timeline is the clock: song time 0 is bar 1 of the audio.
      this.songStart = t0 + this.pack.audio.offset + track.shift;
      this.exactDecode = track.exact;
      this.decodeShift = track.shift;
      this.latency = audio.latency();
    } else {
      this.songStart = performance.now() / 1000 + LEAD_IN + this.pack.audio.offset; // silent fallback on the page clock
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

  /** A press on one side of the screen. Returns true when it started a hold (so the caller can pair the release). */
  press(side: Side, perfMs: number): boolean {
    if (this.state !== 'playing') return false;
    const st = this.songTimeAt(perfMs);
    const res = this.engine.pressAt(side, st);
    this.fx.push({ type: 'press', side });
    if (!res) return false;
    if (res.type === 'judge') {
      this.onJudge(res, false);
      return res.kind === 'head' && res.judge !== 'miss';
    }
    this.onFeedback(res);
    return false;
  }

  release(side: Side, perfMs: number): void {
    if (this.state !== 'playing') return;
    const ev = this.engine.releaseAt(side, this.songTimeAt(perfMs));
    if (ev) this.onJudge(ev, false);
  }

  private onFeedback(f: Feedback): void {
    if (f.type === 'spinTick') { audio.hit('spin'); this.fx.push({ type: 'spin' }); }
    else if (f.type === 'lane') { audio.hit('hop'); this.fx.push({ type: 'lane', lane: f.lane ?? 0 }); }
    else audio.hit('tap', 0.2);
  }

  private onJudge(ev: JEvent, auto: boolean): void {
    const inDrop = ev.note.t >= this.level.dropTime - 1e-6;
    const j = ev.judge;
    if (j === 'miss') audio.hit('miss', auto ? 0.5 : 0.8);
    else if (ev.kind === 'tap' || ev.kind === 'head') {
      audio.hit(ev.note.hand === 'A' ? 'tap' : ev.note.hand, j === 'good' ? 0.55 : 1);
      if (j === 'perfect') audio.hit(inDrop ? 'sparkleHi' : 'sparkle', inDrop ? 0.8 : 0.6);
      if (ev.note.accent) audio.hit('impact', j === 'good' ? 0.5 : 0.9); // big hits get their own sound
    } else if (ev.kind === 'tail') {
      audio.hit('release', j === 'good' ? 0.5 : 0.9);
      if (j === 'perfect') audio.hit('sparkle', 0.5);
    } else if (ev.kind === 'spin' && j === 'perfect') audio.hit('sparkleHi', 1);
    if (ev.kind !== 'haz' || j === 'miss') this.lastJudge = { judge: j, err: ev.kind === 'tail' ? null : ev.err, at: performance.now(), wrongSide: !!ev.wrongSide };
    if (ev.err !== null && ev.kind !== 'tail') {
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
    if (this.time < 1) this.latency = audio.latency(); // the reported latency can settle just after start
    const st = this.songTimeAt(now);
    this.time = st;
    this.viewTime = st + save.visualOffset / 1000;
    if (this.bot) {
      while (this.bi < this.bot.length && this.bot[this.bi].t <= st) {
        const e = this.bot[this.bi++];
        const perf = this.perfForSong(e.t);
        if (e.down) this.press(e.side, perf); else this.release(e.side, perf);
      }
    }
    for (const ev of this.engine.update(st)) this.onJudge(ev, true);
    const seg = this.level.segAt(st);
    if (st >= 0 && seg.index !== this.segIndex) {
      this.segIndex = seg.index;
      this.fx.push({ type: 'enter', seg });
    }
    if (this.engine.failed) this.finish('failed', 900);
    else if (st >= this.level.endTime) this.finish('done', 500);
  }

  private finish(state: 'failed' | 'done', delay: number): void {
    if (this.ended) return;
    this.ended = true;
    this.state = state;
    this.music?.stop(state === 'failed' ? 0.6 : 0.2);
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
