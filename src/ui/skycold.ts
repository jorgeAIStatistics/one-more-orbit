// The cold open as a short film (the owner's brief of 2026-11-25, approved in seven beats). In one sentence: two
// brothers made of light are playing in their song when a dark thing swallows the stars and drags one of them away,
// and the other fights to hold on and loses him.
//   0-8    play: the brothers chase each other in loops, their trails braiding into their song; two bubbles; one line
//   8-14   the omen: a note goes missing, the loop skips, Helion stops and looks out, two stars go out
//   14-20  the strike: half a second of silence and stillness, then the Stillness all at once, huge and fast; the colour
//          drains in a wave, the picture shakes
//   then the struggle, as long as the player makes it (the first thing the player does at all):
//   the reach: HOLD and Orbin drives forward against a headwind of ash, embers torn off him, the gap between their hands
//          closing; let go and the tide takes him back
//   the pull: their hands lock; each TAP is a heave and a note of their song; three ring out, the fourth never comes
//   the loss: his fingers slip; Helion is dragged into the dark calling "Orbin!"; a shockwave; black; three lines
// Nothing can fail and nothing can stall: left alone for four seconds, Orbin goes on by himself, slower.
// The sound: tools/pass2.py coldfilm (the film, a bed for the struggle made to go round, and the loss), plus live
// sounds that answer the hold and the taps (a heartbeat, a swell, the heaves and their notes).
import coldAudio from '../../levels/coldopen/audio.json';
import { audio, type LoadedTrack } from '../audio/audio';
import { CANON } from '../art/canonpaint.js';
import { COLDPAINT as C } from '../art/coldpaint.js';
import { K } from '../art/painter.js';
import type { AudioMeta } from '../game/types';
import { save } from '../save';

const META = coldAudio as AudioMeta;
const P = CANON.parts, TAU = Math.PI * 2;
const SERIF = '"Cormorant Garamond", "Hoefler Text", Baskerville, Palatino, Georgia, serif';
const sm = (x: number) => { const t = x < 0 ? 0 : x > 1 ? 1 : x; return t * t * (3 - 2 * t); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
/** when things happen in the film, in seconds; the loss is timed from the slip (`L`) */
export const COLD_T = { miss: 8.4, skip: 9.0, stop: 9.5, star1: 10.5, star2: 12.0, stutter: [12.8, 13.4], hush: 14.0, strike: 14.5, struggle: 20, idle: 4 };
const L = { call: 0.4, drag: 0.9, wave: 3.2, black: 3.6, lines: [4.4, 6.0, 7.6], out: 10.4, end: 11.5 };
/** the three lines (approved 2026-11-25) */
export const COLD_LINES = [['Orbin and Helion were the two embers', 'of the Harmonic Nebula.'], ['The Stillness took Helion, and the music with him.'], ['Wake the fallen stars. Bring your brother home.']];
/** the notes of their song, as the heaves play them (the theme's first notes, in the film's key); the fourth never comes */
const HEAVE_NOTES = [72, 75, 80];

type Phase = 'film' | 'reach' | 'pull' | 'loss';

/** Live sound for the struggle, made on the audio clock (nothing if there is no sound). */
class Live {
  private swell: { o: OscillatorNode[]; f: BiquadFilterNode; g: GainNode } | null = null;
  private hope: { o: OscillatorNode[]; g: GainNode } | null = null;
  private noise: AudioBuffer | null = null;
  private nextBeat = 0;
  private get c(): AudioContext | null { return audio.ctx && audio.running && audio.sfxOut() ? audio.ctx : null; }
  private out(): AudioNode { return audio.sfxOut()!; }
  private noiseBuf(c: AudioContext): AudioBuffer {
    if (!this.noise) { const n = c.sampleRate; this.noise = c.createBuffer(1, n, c.sampleRate); const d = this.noise.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; }
    return this.noise;
  }
  /** a low thud, pitch falling (the heart's beat, a heave) */
  thud(at: number, f0: number, f1: number, gain: number, dur = 0.22): void {
    const c = this.c; if (!c) return;
    const o = c.createOscillator(), g = c.createGain();
    o.frequency.setValueAtTime(f0, at); o.frequency.exponentialRampToValueAtTime(f1, at + dur);
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(gain, at + 0.008); g.gain.exponentialRampToValueAtTime(0.0008, at + dur);
    o.connect(g); g.connect(this.out()); o.start(at); o.stop(at + dur + 0.05);
  }
  /** filtered noise: a creak of the ink, the sizzle of an ember torn away, a dead click */
  hiss(at: number, lo: number, hi: number, gain: number, dur: number): void {
    const c = this.c; if (!c) return;
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noiseBuf(c); f.type = 'bandpass'; f.frequency.value = Math.sqrt(lo * hi); f.Q.value = Math.sqrt(lo * hi) / (hi - lo);
    g.gain.setValueAtTime(gain, at); g.gain.exponentialRampToValueAtTime(0.0005, at + dur);
    s.connect(f); f.connect(g); g.connect(this.out()); s.start(at, Math.random() * 0.5); s.stop(at + dur + 0.02);
  }
  /** the heart: lub-dub, at a rate (seconds between beats) */
  heart(rate: number): void {
    const c = this.c; if (!c) return;
    if (this.nextBeat < c.currentTime) this.nextBeat = c.currentTime + 0.05;
    while (this.nextBeat < c.currentTime + 0.15) { this.thud(this.nextBeat, 70, 38, 0.55); this.thud(this.nextBeat + 0.26 * Math.min(1, rate), 64, 36, 0.36); this.nextBeat += rate; }
  }
  /** the swell: a string-like rising tone, its brightness and loudness following how close he is */
  swellTo(close: number, on: boolean): void {
    const c = this.c; if (!c) return;
    if (!this.swell) {
      const f = c.createBiquadFilter(), g = c.createGain(); f.type = 'lowpass'; f.Q.value = 0.8; g.gain.value = 0;
      const o = [98, 147.5, 196.4].map((hz, i) => { const x = c.createOscillator(); x.type = i === 2 ? 'triangle' : 'sawtooth'; x.frequency.value = hz; x.connect(f); x.start(); return x; });
      f.connect(g); g.connect(this.out()); this.swell = { o, f, g };
    }
    const t = c.currentTime, s = this.swell;
    s.f.frequency.setTargetAtTime(260 + 2400 * close * close, t, 0.15);
    s.g.gain.setTargetAtTime(on ? 0.025 + 0.06 * close : 0.012 + 0.02 * close, t, on ? 0.2 : 0.35);
    s.o.forEach((x, i) => x.frequency.setTargetAtTime([98, 147.5, 196.4][i] * (1 + 0.5 * close), t, 0.3));
  }
  endSwell(fade = 0.4): void { const c = this.c, s = this.swell; this.swell = null; if (!c || !s) return; s.g.gain.setTargetAtTime(0, c.currentTime, fade / 3); s.o.forEach((x) => x.stop(c.currentTime + fade + 0.2)); }
  /** after the third heave: the chord swells, hopeful */
  hopeOn(): void {
    const c = this.c; if (!c || this.hope) return;
    const g = c.createGain(); g.gain.value = 0; g.connect(this.out());
    const o = [68, 72, 75, 80].map((m) => { const x = c.createOscillator(); x.type = 'sine'; x.frequency.value = 440 * Math.pow(2, (m - 69) / 12); x.connect(g); x.start(); return x; });
    g.gain.setTargetAtTime(0.05, c.currentTime, 0.35);
    this.hope = { o, g };
  }
  /** the fourth heave: no note. Everything cuts. */
  cut(): void {
    const c = this.c; if (!c) return;
    const h = this.hope; this.hope = null;
    if (h) { h.g.gain.cancelScheduledValues(c.currentTime); h.g.gain.setValueAtTime(h.g.gain.value, c.currentTime); h.g.gain.linearRampToValueAtTime(0, c.currentTime + 0.03); h.o.forEach((x) => x.stop(c.currentTime + 0.1)); }
    this.endSwell(0.05);
    this.hiss(c.currentTime, 1800, 4000, 0.25, 0.02);
  }
  stopAll(): void { this.endSwell(0.3); const c = this.c, h = this.hope; this.hope = null; if (c && h) { h.g.gain.setTargetAtTime(0, c.currentTime, 0.1); h.o.forEach((x) => x.stop(c.currentTime + 0.5)); } }
  now(): number { return this.c ? this.c.currentTime : 0; }
}

export class SkyCold {
  private ctx: CanvasRenderingContext2D;
  private key = ''; private w = 0; private h = 0; private dpr = 1;
  private gold: HTMLCanvasElement | null = null; private ash: HTMLCanvasElement | null = null;
  private track: LoadedTrack | null = null;
  private parts: Array<{ stop: (fade?: number, at?: number) => void }> = [];
  private bed: { stop: (fade?: number, at?: number) => void } | null = null;
  private live = new Live();
  state: 'wait' | 'scene' | 'done' = 'wait';
  private touched = false; private touchAt = 0; private waitFrom = 0;
  private own = false; private perf0 = 0; private t0 = 0;
  private down = false; private last = 0;
  // the struggle
  phase: Phase = 'film';
  /** how far apart their hands are in the reach, 1..0 */
  gap = 1;
  private idleFrom = 0; private touchT = -99; heaves: number[] = []; private slipT = -99; private cutT = -99; private everHeld = false;
  private embers: Array<{ x: number; y: number; vx: number; vy: number; at: number }> = [];
  private sizzleAt = 0;
  onDone: (() => void) | null = null;
  /** a returning player may skip (one quiet word in the corner); a first launch cannot */
  canSkip = false;
  /** called once, the moment his hand slips (for the haptic) */
  onSlip: (() => void) | null = null;
  /** each heave (for the haptic) */
  onHeave: (() => void) | null = null;
  /** once, in the black after the three lines are up (nothing moves): the game paints what comes next there */
  onQuiet: (() => void) | null = null;
  private quiet = false; private warm = false;
  /** for tests and recordings: Orbin goes on by himself after this long left alone (seconds) */
  idleAfter = COLD_T.idle;

  constructor(private canvas: HTMLCanvasElement) { this.ctx = canvas.getContext('2d')!; }

  start(canSkip: boolean): void {
    this.stopSound(0.05);
    Object.assign(this, { quiet: false, state: 'wait', touched: false, touchAt: 0, waitFrom: 0, own: false, down: false, last: 0, canSkip, phase: 'film', gap: 1, idleFrom: 0, touchT: -99, heaves: [], slipT: -99, cutT: -99, everHeld: false, embers: [], idleAfter: COLD_T.idle });
    if (audio.prime()) void audio.loadTrack(META).then((t) => { this.track = t; }, () => undefined);
    this.layout();
  }
  private stopSound(fade: number): void { for (const p of this.parts) p.stop(fade); this.parts = []; this.bed = null; this.live.stopAll(); }
  stop(): void { this.stopSound(0.3); this.state = 'done'; }

  private layout(): void {
    const w = window.innerWidth, h = window.innerHeight, key = `${w}x${h}`;
    this.dpr = this.canvas.width / Math.max(1, w);
    if (key === this.key) return;
    this.key = key; this.w = w; this.h = h;
    const paint = (ash: boolean) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; C.nebula(cv.getContext('2d')!, w, h, ash); return cv; };
    this.gold = paint(false); this.ash = paint(true);
  }

  /** seconds since the film began, as heard */
  time(now = performance.now()): number {
    if (this.state === 'wait') return -1;
    if (this.own || !audio.ctx) return (now - this.perf0) / 1000;
    return audio.ctxTimeAt(now) - this.t0 - audio.latency() - save.audioOffset / 1000;
  }
  private begin(now: number): void {
    this.state = 'scene';
    const c = audio.ctx;
    audio.setVolumes(save.music, save.sfx);
    if (!c || !audio.running || !this.track) { this.own = true; this.perf0 = now + 150; return; }
    this.t0 = c.currentTime + 0.15;
    this.parts.push(audio.playPart(this.track, META, this.t0, 0, { dur: 20.2 }));
    this.bed = audio.playPart(this.track, META, this.t0 + 20, 20, { loop: 10 });
    this.parts.push(this.bed);
  }
  /** For tests and stills: be at second `t` of the film (its sound does not follow). The struggle is left to play itself. */
  seek(t: number): void { this.stopSound(0.05); this.state = 'scene'; this.own = true; this.perf0 = performance.now() - t * 1000; }

  /** The finger: down and up. Before the film starts a touch only wakes the sound; during the film it does nothing. */
  press(down: boolean, x = -1, y = -1): void {
    if (this.state === 'done') return;
    if (down && this.canSkip && x > window.innerWidth - 96 && y >= 0 && y < 70) { this.finish(); return; }
    if (this.state === 'wait') { if (down) { this.touched = true; audio.ensure(); } return; }
    this.down = down;
    const t = this.time();
    if (down && this.phase === 'pull') this.heave(t);
    if (this.phase === 'reach' || this.phase === 'pull') this.idleFrom = t;
  }
  private heave(t: number): void {
    const n = this.heaves.length;
    if (n >= 4 || (n && t - this.heaves[n - 1] < 0.32) || t - this.touchT < 0.25) return;
    this.heaves.push(t);
    this.onHeave?.();
    const at = this.live.now();
    this.live.thud(at, 82, 42, 0.7, 0.3);
    this.live.hiss(at + 0.02, 380, 900, 0.12, 0.32);
    if (n < 3) { audio.pluck(HEAVE_NOTES[n], 0.5 + 0.15 * n); audio.pluck(HEAVE_NOTES[n] + 12, 0.18 + 0.06 * n); }
    if (n === 2) this.live.hopeOn();
    if (n === 3) { this.live.cut(); this.cutT = t; }
  }
  private finish(): void { if (this.state === 'done') return; this.stop(); const f = this.onDone; f?.(); }

  private write(s: string, x: number, y: number, px: number, a: number, color = '#fff1d8', weight = 500): void {
    if (a <= 0.004) return;
    const c = this.ctx;
    c.save(); c.font = `italic ${weight} ${px}px ${SERIF}`; c.textAlign = 'center'; c.textBaseline = 'alphabetic';
    c.shadowColor = 'rgba(6,5,18,0.9)'; c.shadowBlur = px * 0.5; c.globalAlpha = a; c.fillStyle = color; c.fillText(s, x, y); c.restore();
  }
  /** a speech bubble in the world: a soft glow with a pointer, the words in the italic serif (no box, no border) */
  private bubble(s: string, x: number, y: number, tx: number, ty: number, px: number, warm: boolean, a: number): void {
    if (a <= 0.004) return;
    const c = this.ctx; c.save(); c.globalAlpha = a; c.font = `italic 600 ${px}px ${SERIF}`; const w = c.measureText(s).width + px * 1.4, h = px * 1.8;
    const g = c.createRadialGradient(x, y, 0, x, y, w * 0.7); g.addColorStop(0, warm ? 'rgba(255,236,200,0.92)' : 'rgba(236,244,255,0.92)'); g.addColorStop(0.7, warm ? 'rgba(255,226,180,0.7)' : 'rgba(220,232,255,0.7)'); g.addColorStop(1, 'rgba(255,230,190,0)');
    c.fillStyle = g; c.beginPath(); c.ellipse(x, y, w * 0.62, h * 0.85, 0, 0, TAU); c.fill();
    c.beginPath(); c.moveTo(x + (tx - x) * 0.25 - 6, y + (ty > y ? h * 0.5 : -h * 0.5)); c.lineTo(tx, ty); c.lineTo(x + (tx - x) * 0.25 + 6, y + (ty > y ? h * 0.5 : -h * 0.5)); c.fill();
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = 'rgba(60,30,14,0.95)'; c.fillText(s, x, y + 1);
    c.restore();
  }
  /** the braid: where the two trails are at a share u of the way across */
  private path(k: number, u: number): [number, number] {
    const { w, h } = this, s = Math.min(w / 390, h / 844);
    return [w * (0.06 + 0.88 * u), h * (0.47 + 0.12 * Math.sin(u * TAU * 1.6 + k * Math.PI) * (0.6 + 0.4 * u)) - 60 * s * Math.sin(u * Math.PI)];
  }
  /** the Stillness's reaching form: a vast arm of ink, its hand open, long fingers; close: how far they have closed */
  private arm(x0: number, y0: number, tx: number, ty: number, u: number, close: number): void {
    const c = this.ctx, fingers = [[-0.5, 1.0], [-0.17, 1.12], [0.16, 1.05], [0.48, 0.86]];
    const ang = Math.atan2(ty - y0, tx - x0), len = Math.hypot(tx - x0, ty - y0), wx = x0 + Math.cos(ang) * len * 0.62, wy = y0 + Math.sin(ang) * len * 0.62;
    for (const [col, extra, blur] of [['rgba(170,160,190,0.4)', 10, 24], ['rgba(5,4,10,0.97)', 0, 0]] as Array<[string, number, number]>) {
      c.save(); c.shadowColor = col; c.shadowBlur = blur; c.fillStyle = col; c.strokeStyle = col; c.lineCap = 'round';
      const nx = -Math.sin(ang), ny = Math.cos(ang), W0 = 170 * u + extra, W1 = 46 * u + extra;
      c.beginPath(); c.moveTo(x0 + nx * W0, y0 + ny * W0); c.quadraticCurveTo((x0 + wx) / 2 + nx * W0 * 0.4, (y0 + wy) / 2 + ny * W0 * 0.4, wx + nx * W1, wy + ny * W1);
      c.lineTo(wx - nx * W1, wy - ny * W1); c.quadraticCurveTo((x0 + wx) / 2 - nx * W0 * 0.5, (y0 + wy) / 2 - ny * W0 * 0.5, x0 - nx * W0, y0 - ny * W0); c.closePath(); c.fill();
      for (const [da0, fl] of fingers) {
        const da = da0 * (1 - 0.6 * close), a2 = ang + da, Lf = len * 0.42 * fl, mx = wx + Math.cos(a2) * Lf * 0.55, my = wy + Math.sin(a2) * Lf * 0.55, bend = 0.25 + 1.1 * close;
        const ex = wx + Math.cos(a2 + bend * Math.sign(da || 1) * -1 * 0.5) * Lf, ey = wy + Math.sin(a2 + bend * Math.sign(da || 1) * -1 * 0.5) * Lf;
        c.lineWidth = 26 * u + extra; c.beginPath(); c.moveTo(wx, wy); c.quadraticCurveTo(mx, my, ex, ey); c.stroke();
        c.lineWidth = 12 * u + extra * 0.6; c.beginPath(); c.moveTo(ex, ey); c.quadraticCurveTo(ex + Math.cos(a2 + 1.2 + close) * 26 * u, ey + Math.sin(a2 + 1.2 + close) * 26 * u, ex + Math.cos(a2 + 2 + close) * 30 * u, ey + Math.sin(a2 + 2 + close) * 30 * u); c.stroke();
      }
      c.restore();
    }
  }

  draw(now: number): void {
    this.layout();
    const c = this.ctx, { w, h } = this, u = Math.min(w / 390, h / 844), cx = w / 2, cy = h * 0.5;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.shadowBlur = 0;
    if (this.state === 'wait') {
      c.fillStyle = 'rgb(6,5,12)'; c.fillRect(0, 0, w, h);
      if (!this.waitFrom) this.waitFrom = now;
      if (this.touched && !this.touchAt) this.touchAt = now;
      // while it waits (a dark screen), the Stillness is painted at every size the film will ask for, so its first
      // appearance and its surge never stop the picture (the performance pass of 2026-11-25)
      if (!this.warm) { this.warm = true; for (const s of [0, 0.5, 1]) { C.dread(c, -1e5, -1e5, (300 + 60 * s) * u, (460 + 80 * s) * u, 48, 1); } C.dread(c, -1e5, -1e5, 190 * u, 170 * u, 78, 0.9); }
      const sound = !!audio.ctx && audio.running && !!this.track;
      if (sound || !audio.ctx || (this.touched && now - this.touchAt > 2000)) { this.begin(now); return; }
      if (!this.touched && now - this.waitFrom > 500) this.write('touch to begin', cx, h * 0.56, 20 * u, 0.45 + 0.25 * Math.sin(now / 520));
      return;
    }
    if (this.state === 'done') return;
    const t = this.time(now), dt = this.last ? Math.min(0.05, (now - this.last) / 1000) : 0; this.last = now;
    const T = COLD_T;
    // ---------------- the struggle's rules, step by step
    if (this.phase === 'film' && t >= T.struggle) { this.phase = 'reach'; this.idleFrom = t; }
    let holding = false;
    if (this.phase === 'reach') {
      const auto = !this.down && t - this.idleFrom > this.idleAfter; // left alone: he goes on by himself, slower
      holding = this.down || auto;
      if (this.down) this.everHeld = true;
      this.gap = clamp01(this.gap + (this.down ? -dt / 2.5 : auto ? -dt / 5 : dt / 3));
      this.live.swellTo(1 - this.gap, holding);
      this.live.heart(lerp(1.0, 0.45, (1 - this.gap) * (holding ? 1 : 0.6)));
      if (holding && t - this.sizzleAt > 0.09) { this.sizzleAt = t; this.live.hiss(this.live.now(), 3000, 8000, 0.035, 0.08); }
      if (this.gap <= 0) {
        this.phase = 'pull'; this.touchT = t; this.idleFrom = t;
        this.live.endSwell(0.5); audio.pluck(80, 0.6); audio.pluck(92, 0.25); // one clear note: their fingers touch
      }
    }
    if (this.phase === 'pull') {
      this.live.heart(0.5);
      const lastAct = Math.max(this.idleFrom, this.heaves[this.heaves.length - 1] ?? -99);
      if (this.heaves.length < 4 && t - lastAct > (this.heaves.length ? Math.min(this.idleAfter, 1.4) : this.idleAfter) && t - this.touchT > 0.6) this.heave(t);
      if (this.heaves.length === 4 && t - this.cutT > 0.6) {
        this.phase = 'loss'; this.slipT = t; this.onSlip?.();
        this.bed?.stop(0.6); this.bed = null;
        if (audio.ctx && this.track && !this.own) this.parts.push(audio.playPart(this.track, META, audio.ctx.currentTime + 0.02, 30, { dur: 12 }));
      }
    }
    const tau = this.phase === 'loss' ? t - this.slipT : -1;
    // ---------------- the picture
    // the camera's shake: the strike, each heave, the shockwave
    let shake = t > T.strike ? 14 * Math.exp(-(t - T.strike) / 0.9) : 0;
    for (const hv of this.heaves) shake += 7 * Math.exp(-(t - hv) / 0.18) * (t >= hv ? 1 : 0);
    if (tau >= L.wave) shake += 16 * Math.exp(-(tau - L.wave) / 0.5);
    for (const st of T.stutter) if (t > st && t < st + 0.09) shake += 6;
    if (save.reduceFlash) shake *= 0.25; // (softer flashes and shake)
    const sx = shake * u * Math.sin(now * 0.091) * Math.sin(now * 0.037), sy = shake * u * Math.cos(now * 0.083);
    c.save(); c.translate(sx, sy);
    // the sky: gold; a little drained by the omen; then the strike's wave of grey sweeps across from the right
    const front = t < T.strike ? w * 1.2 : lerp(w * 1.2, -w * 0.4, sm((t - T.strike) / 2.2));
    if (this.gold) c.drawImage(this.gold, -20, -20, w + 40, h + 40);
    const omenDrain = sm((t - T.miss) / 5.6) * 0.3;
    if (this.ash) {
      if (omenDrain > 0) { c.globalAlpha = omenDrain; c.drawImage(this.ash, -20, -20, w + 40, h + 40); c.globalAlpha = 1; }
      if (front < w * 1.2) { c.save(); c.beginPath(); c.rect(front, -40, w * 2, h + 80); c.clip(); c.drawImage(this.ash, -20, -20, w + 40, h + 40); c.restore(); const g = c.createLinearGradient(front - 80 * u, 0, front + 40 * u, 0); g.addColorStop(0, 'rgba(70,66,80,0)'); g.addColorStop(1, 'rgba(70,66,80,0.6)'); c.fillStyle = g; c.fillRect(front - 80 * u, -40, 120 * u, h + 80); }
    }
    const dark = this.phase === 'film' ? sm((t - T.strike - 2.5) / 3) : 1;
    if (dark > 0) { c.fillStyle = `rgba(10,8,18,${0.9 * dark})`; c.fillRect(-40, -40, w + 80, h + 80); }
    // the stars: two that go out in the omen, and a field the strike's wave swallows as it passes
    for (const [sxx, syy, r, at] of [[0.86, 0.12, 5, T.star1], [0.7, 0.24, 7, T.star2]] as Array<[number, number, number, number]>) {
      const gone = sm((t - at) / 0.4);
      if (dark < 1) K.glow(c, w * sxx, h * syy, r * 4 * u * (1 - 0.7 * gone), [255, 240, 210], 0.75 * (1 - gone) * (1 - dark));
      if (gone > 0 && dark < 1) { c.strokeStyle = `rgba(20,16,30,${0.7 * gone * (1 - dark)})`; c.lineWidth = 3 * u; c.beginPath(); c.arc(w * sxx, h * syy, r * 1.8 * u, 0, TAU); c.stroke(); }
    }
    if (t < T.strike + 3) for (let i = 0; i < 18; i++) { const r = K.RNG(i * 7 + 3), x = w * (0.35 + 0.65 * r()), y = h * (0.05 + 0.85 * r()); if (x < front) K.glow(c, x, y, (2 + 2 * r()) * u, [255, 244, 220], 0.55 * (1 - dark)); }
    // the brothers' places
    let ox: number, oy: number, hx: number, hy: number, os = 0.6, hs = 0.6;
    const play = t < T.stop ? 0.24 + 0.5 * (t / T.stop) - 0.04 * Math.sin((t / T.stop) * Math.PI * 3) : 0.74;
    [hx, hy] = this.path(1, play); [ox, oy] = this.path(0, play - 0.11); hy -= 22 * u; oy -= 22 * u;
    const film = this.phase === 'film';
    // the strike pulls them toward where the struggle begins: Helion to the right, toward the dark; Orbin left
    const toStruggle = film ? sm((t - T.strike - 1.2) / 4.0) : 1;
    const HX = w * 0.7, HY = cy - 60 * u;
    const reachGap = this.phase === 'reach' ? this.gap : this.phase === 'film' ? 1 : 0;
    const OX = HX - 100 * u - reachGap * w * 0.36, OY = cy + 40 * u - reachGap * 10 * u;
    ox = lerp(ox, OX, toStruggle); oy = lerp(oy, OY, toStruggle); hx = lerp(hx, HX, toStruggle); hy = lerp(hy, HY, toStruggle);
    os = lerp(0.48, 0.68, toStruggle); hs = lerp(0.48, 0.58, toStruggle);
    // the pull: their hands locked between them, Helion coming out of the dark heave by heave; the loss: drawn away
    const nH = this.heaves.length, kick = nH ? Math.exp(-(t - this.heaves[nH - 1]) / 0.25) : 0;
    if (this.phase === 'pull' || this.phase === 'loss') {
      const kx = w * 0.48, ky = cy - 14 * u, out = Math.min(3, nH) / 3;
      const touchK = sm((t - this.touchT) / 0.5);
      hx = lerp(HX, w * 0.68 - out * w * 0.1, touchK); hy = lerp(HY, cy - 24 * u, touchK);
      ox = lerp(OX, w * 0.3 - kick * 10 * u, touchK); oy = lerp(OY, cy + 18 * u, touchK);
      void kx; void ky;
    }
    let ha = 1, orbinAngle = 0;
    if (tau >= 0) {
      const away = sm((tau - L.drag) / 2.1);
      hx = lerp(hx, w * 0.84, away); hy = lerp(hy, h * 0.22, away); hs = lerp(0.6, 0.28, away); ha = 1 - 0.6 * away;
      const thrown = sm((tau - L.wave) / 0.7);
      ox = lerp(ox, w * 0.2, thrown); oy = lerp(oy, h * 0.78, thrown); orbinAngle = -1.1 * thrown;
    }
    // the Stillness: from the strike on, from the right, huge; it surges at the slip
    if (t > T.strike) {
      const come = sm((t - T.strike) / 1.1), surge = tau >= 0 ? sm(tau / 1.4) : 0, ebb = this.phase === 'pull' ? 0.08 * Math.min(3, nH) / 3 : 0;
      C.dread(c, lerp(w * 1.7, w * 1.08, come) + ebb * w, cy - 40 * u, (300 + 60 * surge) * u, (460 + 80 * surge) * u, 48, 1);
      C.dread(c, lerp(w * 1.5, w * 0.98, come) + ebb * w, h * 0.14, 190 * u, 170 * u, 78, 0.9);
      if (film) {
        // the reaching hand: it comes all at once, then its fingers close round Helion
        const tip = come, close = sm((t - T.strike - 2.2) / 2.5);
        this.arm(w * 1.15, h * 0.3, lerp(w * 1.4, hx + 30 * u, tip), lerp(h * 0.4, hy, tip), u, close);
      }
    }
    // the omen: Helion stops and looks out; Orbin follows his look
    const looking = t > T.stop && film && t < T.strike;
    // the play: the braid, with a note at every crossing (one missing from the omen on)
    if (dark < 1) {
      const fade = 1 - dark;
      c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
      const missU = (T.miss / T.stop) * 0.62 + 0.12;
      for (const [k, col, head] of [[0, [255, 236, 190], play - 0.11], [1, [255, 170, 110], play]] as Array<[number, number[], number]>) {
        for (let i = 0; i < 60; i++) {
          const u0 = head - 0.55 + (0.55 * i) / 60, u1 = u0 + 0.55 / 60;
          if (u0 < 0) continue;
          if (t > T.miss && Math.abs(u0 - missU) < 0.03) continue; // the break in the braid where a note did not come
          const [x0, y0] = this.path(k, u0), [x1, y1] = this.path(k, u1), q = i / 60;
          c.strokeStyle = `rgba(${col[0]},${col[1]},${col[2]},${(0.08 + 0.6 * q) * fade})`; c.lineWidth = (1 + 5 * q) * u;
          c.beginPath(); c.moveTo(x0, y0 - 22 * u); c.lineTo(x1, y1 - 22 * u); c.stroke();
        }
      }
      c.restore();
      for (let n = 1; n <= 3; n++) {
        const un = n / 3.2; if (un > play) continue;
        const [x, y] = this.path(0, un), since = (play - un) * 9;
        if (t > T.miss && Math.abs(un - missU) < 0.12) { c.strokeStyle = `rgba(60,50,70,${0.8 * fade})`; c.lineWidth = 2 * u; c.beginPath(); c.arc(x, y - 22 * u, 12 * u, 0, TAU); c.stroke(); continue; }
        K.glow(c, x, y - 22 * u, (10 + 10 * Math.exp(-since * 2)) * u, [255, 244, 210], 0.8 * fade);
      }
    }
    // Helion
    const strikeK = t > T.strike ? 1 : 0;
    const hEyes = tau >= 0 ? 'wide' : this.phase === 'pull' ? (nH >= 3 ? 'soft' : 'set') : this.phase === 'reach' ? 'worried' : strikeK ? 'wide' : t > T.stop ? 'open' : 'soft';
    const laugh = Math.exp(-Math.abs(t - 1.7) * 3);
    c.save(); c.globalAlpha = ha; c.translate(hx, hy); c.rotate(this.phase === 'reach' ? 0.35 : film ? 0.3 * toStruggle : 0);
    P.spark(c, 0, 0, hs * u, { who: 'helion', eyes: hEyes, arms: this.phase !== 'film' || toStruggle > 0.3 ? 'reach' : t < T.stop ? 'up' : 'rest', glow: this.phase === 'pull' ? 0.55 + 0.12 * Math.min(3, nH) : lerp(1, 0.55, toStruggle), face: this.phase === 'film' && toStruggle < 0.3 ? 1 : -1, look: looking ? [1, -0.9] : this.phase === 'pull' && nH >= 3 ? [-1, 0.1] : [-1, 0.3], crest: 0.6 + 0.4 * (1 - toStruggle) + 0.3 * laugh, ring: true, beat: 1, lean: this.phase === 'film' ? -0.3 * toStruggle : -0.4 });
    c.restore();
    // its grip on him: tendrils (on his lower half only once he is coming out)
    if (t > T.strike + 1.5 && tau < L.wave) {
      const pullOut = this.phase === 'pull' ? Math.min(3, nH) / 3 : 0;
      C.tendrils(c, w * 1.04, cy + (pullOut * 60 - 80) * u, hx + 10 * u, hy + pullOut * 28 * u, u, 9 - Math.round(3 * pullOut), 13, sm((t - T.strike - 1.5) / 2));
    }
    // the headwind of ash in the reach: streaks pouring out of the dark against him, faster while he drives
    if (this.phase === 'reach' || (film && t > T.strike + 2)) {
      const a = this.phase === 'reach' ? 1 : sm((t - T.strike - 2) / 2);
      c.save(); c.lineCap = 'round';
      const rw = K.RNG(300), speed = (420 + 520 * (holding ? 1 : 0)) * u;
      for (let i = 0; i < 46; i++) { const y = h * (0.08 + 0.84 * rw()), L0 = (40 + 120 * rw()) * u, x = w + 200 * u - (((rw() * 9000 + t * speed) % (w + 400 * u))); c.strokeStyle = `rgba(178,170,200,${(0.1 + 0.25 * rw()) * a})`; c.lineWidth = (1 + 2.5 * rw()) * u; c.beginPath(); c.moveTo(x, y); c.lineTo(x + L0, y - L0 * 0.18); c.stroke(); }
      c.restore();
    }
    // embers torn off Orbin as he drives into it
    if (holding && Math.random() < dt * 40) this.embers.push({ x: ox, y: oy, vx: -(120 + Math.random() * 180) * u, vy: (Math.random() - 0.5) * 80 * u, at: t });
    for (let i = this.embers.length - 1; i >= 0; i--) { const e = this.embers[i], a = t - e.at; if (a > 1.1 || a < 0) { this.embers.splice(i, 1); continue; } K.glow(c, e.x + e.vx * a, e.y + e.vy * a, (2 + 3 * (1 - a)) * u, [255, 200, 130], 0.8 * (1 - a / 1.1)); }
    // Orbin
    const drive = this.phase === 'reach' ? (holding ? 1 : 0) : 0;
    if (drive) K.glow(c, ox, oy, 120 * u, [255, 226, 160], 0.35 + 0.25 * (1 - this.gap), 'screen');
    if (this.phase === 'pull') K.glow(c, ox, oy, 90 * u, [255, 250, 230], 0.3 + 0.4 * kick, 'screen');
    c.save(); c.translate(ox, oy); c.rotate(orbinAngle);
    const oEyes = tau >= L.wave ? 'closed' : this.phase === 'reach' || this.phase === 'pull' ? 'set' : strikeK ? 'wide' : t > T.stop + 1 ? 'worried' : 'soft';
    P.spark(c, 0, 0, os * u, { who: 'orbin', eyes: oEyes, arms: this.phase !== 'film' || toStruggle > 0.3 ? 'reach' : t < T.stop ? 'up' : 'rest', glow: 1, face: 1, look: t > T.stop + 1.2 && film && t < T.strike ? [1, -0.8] : [1, -0.3], crest: 1, ring: true, beat: 1, lean: this.phase === 'reach' ? 0.45 + 0.3 * drive : this.phase === 'pull' ? -0.35 - 0.2 * kick : film ? 0.3 * toStruggle : 0 });
    c.restore();
    // their hands: the gap and a thread of light in the reach; locked, the brightest thing on screen, in the pull
    if (this.phase === 'reach') {
      const ax = ox + 58 * u, ay = oy - 40 * u, bx = hx - 50 * u, by = hy + 8 * u;
      K.glow(c, ax, ay, (12 + 8 * drive) * u, [255, 244, 210], 0.9); K.glow(c, bx, by, 12 * u, [255, 190, 130], 0.7);
      if (this.gap < 0.6) { c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = `rgba(255,230,180,${0.6 * (1 - this.gap / 0.6)})`; c.lineWidth = 1.5 * u; c.setLineDash([3 * u, 6 * u]); c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.stroke(); c.restore(); }
    }
    if (this.phase === 'pull' || (tau >= 0 && tau < 2.4)) {
      const kx = (ox + hx) / 2 + (tau >= 0 ? 0 : 0), ky = (oy + hy) / 2 - 18 * u;
      const apart = tau >= 0 ? sm(tau / 1.6) : 0, flash = Math.exp(-(t - this.touchT) / 0.6);
      K.glow(c, kx - apart * 30 * u, ky, (40 + 30 * kick + 40 * flash) * u * (1 - 0.5 * apart), [255, 244, 214], 0.9 * (1 - apart));
      K.glow(c, kx + apart * 30 * u, ky, 14 * u, [255, 255, 250], 1 - apart);
      if (kick > 0.05 && tau < 0) { c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round'; for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU + nH; c.strokeStyle = `rgba(255,236,190,${0.45 * kick})`; c.lineWidth = 2 * u; c.beginPath(); c.moveTo(kx + Math.cos(a) * 26 * u, ky + Math.sin(a) * 26 * u); c.lineTo(kx + Math.cos(a) * (40 + 50 * (1 - kick)) * u, ky + Math.sin(a) * (40 + 50 * (1 - kick)) * u); c.stroke(); } c.restore(); }
      // the notes of their song, one per heave, rising from their hands; the fourth an empty ring
      for (let i = 0; i < nH && tau < 1.0; i++) {
        const age = t - this.heaves[i], x = kx - 60 * u + i * 40 * u, y = ky - 170 * u - i * 10 * u - Math.min(1, age) * 20 * u;
        if (i < 3) K.glow(c, x, y, (14 + 10 * Math.exp(-age * 3)) * u, [255, 240, 200], 0.95 * (tau >= 0 ? 1 - tau : 1));
        else { c.strokeStyle = 'rgba(120,110,140,0.8)'; c.lineWidth = 2 * u; c.beginPath(); c.arc(x, y, 12 * u, 0, TAU); c.stroke(); }
      }
    }
    // the loss: "Orbin!"; their song once more, broken, scattered; the shockwave; black
    if (tau >= 0) {
      this.bubble('Orbin!', hx - 50 * u, hy - 70 * u, hx - 8 * u, hy - 36 * u, 18 * u, true, sm((tau - L.call) / 0.25) * (1 - sm((tau - 2.6) / 0.4)));
      if (tau > 1 && tau < 3.4) for (let i = 0; i < 9; i++) { const r = K.RNG(i + 40), q = (tau - 1) / 2.4; K.glow(c, lerp(hx, w * (0.3 + 0.5 * r()), q), lerp(hy, h * (0.35 + 0.35 * r()), q) + q * q * 60 * u, (3 + r() * 4) * u, [255, 236, 190], (0.5 + 0.3 * r()) * (1 - q)); }
    }
    c.restore(); // (the shake)
    if (tau >= L.wave - 0.05) {
      const k = tau - L.wave, R = Math.hypot(w, h);
      c.strokeStyle = `rgba(255,250,236,${Math.max(0, 1 - k / 0.5)})`; c.lineWidth = 30 * u; c.beginPath(); c.arc(w * 0.8, h * 0.24, Math.max(1, k * R * 2.4), 0, TAU); c.stroke();
      c.fillStyle = `rgba(255,250,236,${sm(k / 0.12) * (1 - sm((k - 0.25) / 0.4)) * (save.reduceFlash ? 0.35 : 1)})`; c.fillRect(0, 0, w, h);
      c.fillStyle = `rgba(4,4,10,${sm((k - (L.black - L.wave) + 0.1) / 0.6)})`; c.fillRect(0, 0, w, h);
      const out = 1 - sm((tau - L.out) / 0.9);
      // (Orbin, tiny and alone in all that dark: what is left of him after the loss)
      { const a = sm((tau - L.black - 0.1) / 0.8) * out, x = w * 0.24 + (tau - L.black) * 4 * u, y = h * 0.82 + (tau - L.black) * 2 * u; if (a > 0.01) { K.glow(c, x, y, 26 * u, [255, 226, 170], 0.35 * a); c.save(); c.globalAlpha = a * 0.85; c.translate(x, y); c.rotate(-0.9 + 0.08 * (tau - L.black)); P.spark(c, 0, 0, 0.16 * u, { who: 'orbin', eyes: 'closed', arms: 'rest', glow: 0.5, face: 1, crest: 0.3 }); c.restore(); } }
      L.lines.forEach((at, i) => {
        const a = sm((tau - at) / 1.0) * out, line = COLD_LINES[i], y0 = h * [0.42, 0.53, 0.63][i];
        line.forEach((s, j) => this.write(s, cx, y0 + j * 30 * u, (i === 1 ? 19 : 21) * u, a, i === 2 ? '#ffe6b8' : '#fff1d8'));
      });
    }
    // words: the play's bubbles and its line; the struggle's one control
    if (film) {
      this.write('Two embers. One song.', cx, h * 0.17, 24 * u, sm((t - 0.6) / 0.8) * (1 - sm((t - 7.4) / 0.8)));
      this.bubble('Catch me!', hx - 10 * u, hy - 70 * u, hx, hy - 36 * u, 17 * u, true, sm((t - 1.7) / 0.25) * (1 - sm((t - 4.0) / 0.3)));
      this.bubble('Always.', ox - 20 * u, oy + 66 * u, ox, oy + 30 * u, 17 * u, false, sm((t - 3.9) / 0.25) * (1 - sm((t - 6.2) / 0.3)));
    }
    const qx = cx, qy = h * 0.85;
    if (this.phase === 'reach') {
      const a = sm((t - T.struggle) / 0.6), fill = 1 - this.gap;
      c.globalAlpha = a;
      c.strokeStyle = 'rgba(255,204,72,0.25)'; c.lineWidth = 3 * u; c.beginPath(); c.arc(qx, qy, 30 * u, 0, TAU); c.stroke();
      c.strokeStyle = 'rgba(255,204,72,0.95)'; c.lineWidth = 3.4 * u; c.beginPath(); c.arc(qx, qy, 30 * u, -Math.PI / 2, -Math.PI / 2 + TAU * fill); c.stroke();
      if (this.down) K.glow(c, qx, qy, 14 * u, [255, 220, 150], 0.8);
      c.globalAlpha = 1;
      this.write('Hold on', qx, qy + 62 * u, 24 * u, a, '#ffe6b8');
      if (!this.everHeld) this.write('press and hold', qx, qy + 86 * u, 15 * u, a * 0.7);
    }
    if (this.phase === 'pull' && nH < 4) {
      const a = sm((t - this.touchT - 0.3) / 0.4), pulse = nH ? Math.exp(-(t - this.heaves[nH - 1]) / 0.3) : 0;
      for (const [r, al] of [[30, 0.95], [44 + 16 * pulse, 0.45], [58 + 22 * pulse, 0.18]] as Array<[number, number]>) { c.strokeStyle = `rgba(255,204,72,${al * a})`; c.lineWidth = 3 * u; c.beginPath(); c.arc(qx, qy, r * u, 0, TAU); c.stroke(); }
      this.write('Pull!', qx, qy + 76 * u, 26 * u, a, '#ffe6b8', 700);
      if (!nH) this.write('tap', qx, qy + 100 * u, 15 * u, a * 0.7);
    }
    if (this.canSkip && !(tau >= L.black)) this.write('skip', w - 44, 64, 16, 0.55);
    if (tau >= 8.8 && !this.quiet) { this.quiet = true; this.onQuiet?.(); }
    if (tau >= L.end) this.finish();
  }
}
