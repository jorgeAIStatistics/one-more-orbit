import { audio, type LoadedTrack } from '../audio/audio';
import { Level } from '../game/level';
import type { LevelPack } from '../game/packs';
import { save } from '../save';
import { SmoothClock } from './clock';
import { buildCourse, type Course } from './course';
import { accentBeats, layers, pitchLookup } from './presses';
import { Sim, type TapResult } from './sim';

export type RunState = 'loading' | 'playing' | 'paused' | 'resuming' | 'failed' | 'done' | 'error';
/** partial: started part-way through from the menu ("start at the build-up"); plays like a normal run but is not saved */
/** tutorial: the first-run lesson: nothing ends the run, missed marks are taken for the player, and it stops after a few bars */
export interface RunOptions { bot?: boolean; practice?: boolean; partial?: boolean; tutorial?: boolean; startAt?: number; leadIn?: number; /** the ambush, from a checkpoint: how each light note before it went */ lights?: Array<boolean | null> }
/** beats the tutorial lasts */
export const TUTORIAL_BEATS = 24;
export interface RunEvent { kind: 'hop' | 'flip' | 'spark' | 'skip' | 'land' | 'crash' | 'drop' | 'finale' | 'tick' | 'held' | 'release' | 'star' | 'starlost'; star?: number; flow?: boolean; charge?: boolean; accent?: boolean; smash?: boolean; sling?: boolean; full?: boolean; power?: number }

const RESUME_COUNT = 1.2;
/** a light note is struck true within this many seconds of it (it can be taken, off the beat, within the press's own wider window) */
export const LIGHT_S = 0.06;
/** the Lantern's windows in the ambush */
export const WINDOWS = 4;

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
  /** light notes (the ambush): each of the level's big presses, and whether it was struck on the beat (null: still to come) */
  lights: Array<{ beat: number; on: boolean | null }> = [];
  /** the finish: from the moment the last press lands, the level is won and the ending plays out */
  finale = false;
  finaleAt = Infinity;
  private songStart = 0;
  private latency = 0;
  private music: { stop: (fade?: number) => void } | null = null;
  private bi = 0;
  private tickRun = 0;
  private ended = false;
  /** a light note set off by the roll's last tap, waiting for its own strike */
  private awaiting: { beat: number; on: boolean | null } | null = null;
  private lastNow = 0;
  private seenLand = -99;
  private readonly leadIn: number;
  private endTimer = 0;

  constructor(readonly pack: LevelPack, readonly opts: RunOptions, private onEnd: (run: GdRun) => void) {
    this.level = new Level(pack.level, pack.audio, pack.chart);
    const spb = this.level.spb;
    this.course = buildCourse(this.level, layers(pack), pitchLookup(pack), pack.level.lab, accentBeats(pack));
    this.t0 = this.course.start * spb;
    this.t1 = Math.min(this.course.end * spb, this.level.endTime);
    this.startAt = Math.max(this.t0, opts.startAt ?? this.t0);
    this.leadIn = opts.leadIn ?? 1;
    this.time = this.viewTime = this.startAt - this.leadIn;
    // from a checkpoint, the game plays the notes of the run-in itself and hands over on the checkpoint
    this.sim = new Sim(this.course, this.time / spb, this.startAt > this.t0 ? this.startAt / spb : -Infinity, !!opts.tutorial);
    const lastPress = this.course.presses[this.course.presses.length - 1];
    if (lastPress && !opts.tutorial) this.finaleAt = lastPress.land * spb;
    while (this.bi < this.course.script.length && this.course.script[this.bi][0] * spb < this.startAt) this.bi++;
    if (this.startAt / spb > this.course.dropBeat) this.dropFull = true;
    this.lights = this.course.presses.filter((p) => p.smash).map((p, i) => ({ beat: p.beat, on: p.beat * spb < this.startAt ? opts.lights?.[i] ?? true : null }));
  }

  /**
   * The Lantern's windows still lit: a light note struck off the beat lets one go dark, one struck on the beat
   * relights one. lost: has any window gone dark at any point. When the last one goes dark the Snuffer has won, and
   * the run ends there.
   */
  get windows(): { lit: number; lost: boolean; struck: number } {
    let lit = WINDOWS, lost = false, struck = 0;
    for (const l of this.lights) { if (l.on === false) { lit = Math.max(0, lit - 1); lost = true; } else if (l.on) { lit = Math.min(WINDOWS, lit + 1); struck++; } }
    return { lit, lost, struck };
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
    const p = Math.max(0, Math.min(1, (this.time - this.t0) / (this.t1 - this.t0)));
    return this.finale ? p + (1 - p) * Math.min(1, this.finaleAge / 1.4) : p; // the bar fills to 100 as the finish goes off
  }

  get pct(): number {
    return this.state === 'done' ? 100 : this.finale ? Math.min(100, Math.round(this.progress * 100)) : Math.min(99, Math.floor(this.progress * 100));
  }

  /** seconds since the finish began */
  get finaleAge(): number {
    return this.finale ? this.time - this.finaleAt : 0;
  }

  /** Song time of the crash, or -1. */
  get crashTime(): number {
    return this.sim.crashed ? this.sim.crashBeat * this.level.spb : -1;
  }

  private react(r: TapResult): void {
    if (this.awaiting && !Number.isNaN(this.sim.openErr)) this.strike(this.awaiting, Math.abs(this.sim.openErr) <= LIGHT_S); // the strike that was waited for
    if (r.kind === 'none' || r.kind === 'crash') return;
    if (r.kind === 'skip') { audio.hit('stray', 0.3); this.events.push({ kind: 'skip' }); return; }
    if (r.kind === 'tick') {
      // gold along a hold: each piece plays the next step up the song's scale, so a full hold is a little run of notes
      const scale = this.pack.level.scale ?? [0, 2, 4, 5, 7, 9, 11];
      const k = this.tickRun++ % 8;
      audio.pluck(72 + 12 * Math.floor(k / scale.length) + scale[k % scale.length], 0.32 * save.hitVol);
      this.events.push({ kind: 'tick' });
      return;
    }
    if (r.kind === 'held') { this.tickRun = 0; this.events.push({ kind: 'held', full: !!r.full }); if (r.full) audio.hit('hit', 0.5 * save.hitVol); return; }
    if (r.kind === 'star') {
      // a star: three quick notes up the song's scale
      const scale = this.pack.level.scale ?? [0, 2, 4, 5, 7, 9, 11];
      [0, 2, 4].forEach((k, n) => window.setTimeout(() => audio.pluck(84 + scale[k % scale.length], 0.5 * save.hitVol), n * 70));
      audio.hit('hit', 0.8 * save.hitVol);
      this.events.push({ kind: 'star', star: r.star });
      return;
    }
    if (r.kind === 'starlost') { audio.pluck(48, 0.35 * save.hitVol); this.events.push({ kind: 'starlost', star: r.star }); return; }
    if (r.kind === 'release') { if (r.flow) audio.hit('hit', 0.6 * save.hitVol); this.events.push({ kind: 'release', flow: !!r.flow }); return; }
    // one hit sound for every tap that meets a note; on the beat in a hook section it also plays the hook's pitch
    audio.hit('hit', (r.auto ? 0.55 : r.kind === 'spark' ? 0.8 : 1) * save.hitVol);
    const hook = this.level.segAt(Math.max(0, this.time)).follow === 'lead';
    if (r.flow && hook && r.pitch) audio.pluck(r.pitch, 0.5 * save.hitVol);
    if (r.charge) {
      // charging the drop: each tap on the roll plays the next step up the song's scale
      const scale = this.pack.level.scale ?? [0, 2, 4, 5, 7, 9, 11];
      const k = Math.min(14, Math.floor(this.sim.charge * 14));
      audio.pluck(60 + 12 * Math.floor(k / scale.length) + scale[k % scale.length], 0.4 * save.hitVol);
    }
    const press = r.kind === 'spark' ? null : this.course.presses[this.sim.ni - 1];
    if (press?.smash) {
      const l = this.lights.find((x) => x.beat === press.beat);
      // (a roll runs right up to a light note: if the tap that set it off was the roll's last, the strike itself is still to come)
      if (l && l.on === null) { if (r.auto) l.on = true; else if (Number.isNaN(this.sim.openErr)) this.awaiting = l; else this.strike(l, Math.abs(this.sim.openErr) <= LIGHT_S); }
    }
    this.events.push({ kind: r.kind, flow: !!r.flow || !!r.auto, charge: !!r.charge, accent: !!press?.accent, smash: !!press?.smash, sling: !!press?.sling });
  }

  /** A light note is settled: struck on the beat, or not. When the last window goes dark the Snuffer has won. */
  private strike(l: { beat: number; on: boolean | null }, on: boolean): void {
    l.on = on;
    this.awaiting = null;
    if (!on && this.lights.length > 1 && this.windows.lit === 0) this.sim.snuff(Math.max(l.beat, this.time / this.level.spb));
  }

  /** The one button. The tap is applied at the moment it happened, not when the next frame runs. */
  tap(perfMs: number): void {
    if (this.state !== 'playing' || this.finale) return;
    this.react(this.sim.press(this.clock.at(perfMs) / this.level.spb));
  }

  /** The button comes up. Only holds care. */
  release(perfMs: number): void {
    if (this.state !== 'playing' || this.finale) { this.sim.down = false; return; }
    this.react(this.sim.release(this.clock.at(perfMs) / this.level.spb));
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
    if (this.opts.bot) while (this.bi < this.course.script.length && this.course.script[this.bi][0] <= beat) { const [at, down] = this.course.script[this.bi++]; this.react(down ? this.sim.press(at) : this.sim.release(at)); }
    this.sim.advance(beat);
    while (this.sim.out.length) this.react(this.sim.out.shift()!);
    // a light note whose strike never came (only the roll's last tap did): the window goes dark
    if (this.awaiting && beat > this.awaiting.beat + 0.2 / this.level.spb) this.strike(this.awaiting, false);
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
      this.finish('failed', 520);
    } else if (this.opts.tutorial) {
      if (beat >= TUTORIAL_BEATS) this.finish('done', 200);
    } else {
      if (!this.finale && t >= this.finaleAt) {
        // the last press has landed: the level is won. The music plays out while the finish goes off.
        this.finale = true;
        audio.setMuffle(0);
        audio.hit('impact', 1);
        this.events.push({ kind: 'finale' });
      }
      if (t >= Math.max(this.t1, this.finaleAt + 3.6)) this.finish('done', 0);
    }
  }

  private finish(state: 'failed' | 'done', delay: number): void {
    if (this.ended) return;
    this.ended = true;
    this.state = state;
    this.music?.stop(state === 'failed' ? 0.1 : 0.8);
    this.endTimer = window.setTimeout(() => { audio.setMuffle(0); this.onEnd(this); }, delay);
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

  /** Ends a crashed attempt's short pause at once (a tap restarts immediately). */
  skipWait(): void {
    if (this.state !== 'failed') return;
    clearTimeout(this.endTimer);
    audio.setMuffle(0);
    this.onEnd(this);
  }

  stop(): void {
    clearTimeout(this.endTimer);
    this.ended = true;
    this.music?.stop(0.08);
    this.state = 'done';
    audio.setMuffle(0);
    void audio.resume();
  }
}
