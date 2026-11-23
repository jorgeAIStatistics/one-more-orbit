import type { AudioMeta } from '../game/types';

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
    /** Filled in by the single-file build: audio path -> base64 MP3. */
    __OMO_AUDIO__?: Record<string, string>;
  }
}

export interface LoadedTrack {
  buffer: AudioBuffer;
  /** seconds the decoder added at the start (0 when it honours the gapless header) */
  shift: number;
  exact: boolean;
}

type HitName = 'impact' | 'tap' | 'L' | 'R' | 'sparkle' | 'sparkleHi' | 'miss' | 'spin' | 'hop' | 'release' | 'click' | 'clickHi';

/**
 * Web Audio wrapper. The audio context's clock is the game clock: `ctxTimeAt()` maps an input
 * event's timestamp onto it, so a tap is judged at the moment it happened, not when a frame ran.
 */
export class AudioEngine {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicGain!: GainNode;
  private sfxGain!: GainNode;
  private pre!: GainNode;
  private lp!: BiquadFilterNode;
  private plucks = new Map<number, AudioBuffer>();
  private analyser: AnalyserNode | null = null;
  private freq = new Uint8Array(0);
  private wave = new Uint8Array(0);
  private hits: Partial<Record<HitName, AudioBuffer>> = {};
  private tracks = new Map<string, Promise<LoadedTrack>>();
  private w0 = -Infinity;
  private w1 = -Infinity;
  private wStart = 0;
  musicVol = 0.8;
  sfxVol = 0.7;

  /** Call from a user gesture. Creates the context once and (re)starts it. */
  ensure(): boolean {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      let c: AudioContext;
      try { c = new AC({ latencyHint: 'interactive' }); } catch { c = new AC(); }
      this.ctx = c;
      const limiter = c.createDynamicsCompressor();
      limiter.threshold.value = -1.5;
      limiter.knee.value = 3;
      limiter.ratio.value = 8;
      limiter.attack.value = 0.003;
      limiter.release.value = 0.2;
      limiter.connect(c.destination);
      this.master = c.createGain();
      this.master.gain.value = 0.9;
      this.master.connect(limiter);
      this.musicGain = c.createGain();
      this.sfxGain = c.createGain();
      this.musicGain.connect(this.master);
      this.sfxGain.connect(this.master);
      // the music passes through `pre` before its volume control, so the equalizer still sees it when muted
      this.pre = c.createGain();
      this.lp = c.createBiquadFilter();
      this.lp.type = 'lowpass';
      this.lp.frequency.value = 20000;
      this.pre.connect(this.lp);
      this.lp.connect(this.musicGain);
      this.analyser = c.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.72;
      this.pre.connect(this.analyser);
      this.freq = new Uint8Array(this.analyser.frequencyBinCount);
      this.wave = new Uint8Array(this.analyser.fftSize);
      this.applyVolumes();
      this.buildHitsounds(72);
    }
    this.resume();
    return true;
  }

  resume(): Promise<void> {
    const c = this.ctx;
    if (!c || c.state === 'running' || c.state === 'closed') return Promise.resolve();
    this.w0 = this.w1 = -Infinity;
    return c.resume().catch(() => undefined);
  }

  suspend(): Promise<void> {
    const c = this.ctx;
    if (!c || c.state !== 'running') return Promise.resolve();
    return c.suspend().catch(() => undefined);
  }

  get running(): boolean {
    return !!this.ctx && this.ctx.state === 'running';
  }

  /** Output latency the browser reports (speaker / Bluetooth delay). */
  latency(): number {
    const c = this.ctx as (AudioContext & { outputLatency?: number }) | null;
    if (!c) return 0;
    let l = typeof c.outputLatency === 'number' && c.outputLatency > 0 ? c.outputLatency : c.baseLatency || 0;
    if (!(l >= 0) || l > 0.6) l = 0;
    return l;
  }

  /** Call once per frame. `currentTime` only advances in blocks, so track its largest lead over the page clock. */
  tick(now: number): void {
    const c = this.ctx;
    if (!c || c.state !== 'running') return;
    const d = c.currentTime - now / 1000;
    if (now - this.wStart > 300) { this.w0 = this.w1; this.w1 = -Infinity; this.wStart = now; }
    if (d > this.w1) this.w1 = d;
  }

  /** Audio-clock time at a page timestamp (performance.now() / event.timeStamp, in ms). */
  ctxTimeAt(perfMs: number): number {
    const c = this.ctx;
    if (!c) return perfMs / 1000;
    const off = Math.max(this.w0, this.w1);
    if (c.state !== 'running' || !isFinite(off)) return c.currentTime;
    return perfMs / 1000 + off;
  }

  /** Inverse of ctxTimeAt, used by the autoplay bot. */
  perfAt(ctxTime: number): number {
    const off = Math.max(this.w0, this.w1);
    return isFinite(off) ? (ctxTime - off) * 1000 : performance.now();
  }

  setVolumes(music: number, sfx: number): void {
    this.musicVol = music;
    this.sfxVol = sfx;
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.musicGain.gain.setTargetAtTime(this.musicVol, now, 0.03);
    this.sfxGain.gain.setTargetAtTime(this.sfxVol, now, 0.02);
  }

  // ---------------------------------------------------------------- tracks

  loadTrack(meta: AudioMeta): Promise<LoadedTrack> {
    let p = this.tracks.get(meta.file);
    if (!p) {
      p = this.fetchTrack(meta);
      p.catch(() => this.tracks.delete(meta.file));
      this.tracks.set(meta.file, p);
    }
    return p;
  }

  private async fetchTrack(meta: AudioMeta): Promise<LoadedTrack> {
    const c = this.ctx;
    if (!c) throw new Error('audio is not available');
    let data: ArrayBuffer;
    const embedded = window.__OMO_AUDIO__?.[meta.file];
    if (embedded) {
      const bin = atob(embedded);
      const u8 = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      data = u8.buffer;
    } else {
      const res = await fetch(import.meta.env.BASE_URL + meta.file);
      if (!res.ok) throw new Error(`could not load ${meta.file}`);
      data = await res.arrayBuffer();
    }
    const buffer = await new Promise<AudioBuffer>((ok, fail) => {
      const p = c.decodeAudioData(data, ok, fail);
      if (p && typeof p.then === 'function') p.then(ok, fail);
    });
    // A decoder that honours the MP3's gapless header returns exactly meta.frames samples. One that does not
    // adds padding at the start: measure it from the first audible sample so the grid still lines up.
    const sr = buffer.sampleRate;
    const extra = buffer.length - (meta.frames * sr) / 44100;
    let shift = 0;
    const exact = Math.abs(extra) < 0.008 * sr;
    if (!exact) {
      const d = buffer.getChannelData(0);
      const lim = Math.min(d.length, Math.floor(sr * 3));
      let i = 0;
      while (i < lim && Math.abs(d[i]) < 0.02) i++;
      shift = Math.min(0.06, Math.max(0, i / sr - meta.firstSig / 44100));
    }
    return { buffer, shift, exact };
  }

  /** Starts a buffer at audio-clock time `when`, from `offset` seconds in. */
  playMusic(buffer: AudioBuffer, when: number, offset = 0): { stop: (fade?: number) => void } {
    const c = this.ctx!;
    const src = c.createBufferSource();
    src.buffer = buffer;
    const g = c.createGain();
    src.connect(g);
    g.connect(this.pre);
    if (offset > 0) { g.gain.setValueAtTime(0, when); g.gain.linearRampToValueAtTime(1, when + 0.05); } // starting mid-song: no click
    src.start(when, offset);
    let stopped = false;
    return {
      stop: (fade = 0.15) => {
        if (stopped) return;
        stopped = true;
        const now = c.currentTime;
        try {
          g.gain.setTargetAtTime(0, now, Math.max(0.01, fade / 3));
          src.stop(now + fade + 0.1);
        } catch { /* already stopped */ }
        setTimeout(() => { try { g.disconnect(); } catch { /* ignore */ } }, (fade + 0.5) * 1000);
      }
    };
  }

  /** Briefly low-passes the music: the sound of a missed gate. */
  muffle(): void {
    const c = this.ctx;
    if (!c) return;
    const now = c.currentTime;
    this.lp.frequency.cancelScheduledValues(now);
    this.lp.frequency.setTargetAtTime(480, now, 0.012);
    this.lp.frequency.setTargetAtTime(20000, now + 0.26, 0.1);
  }

  /** A short plucked note at a MIDI pitch (pre-rendered once per pitch): the musical hitsound. */
  pluck(midi: number, gain = 1): void {
    const c = this.ctx;
    if (!c || c.state !== 'running') return;
    let b = this.plucks.get(midi);
    if (!b) {
      const sr = c.sampleRate;
      const n = Math.floor(0.26 * sr);
      b = c.createBuffer(1, n, sr);
      const d = b.getChannelData(0);
      const w = 2 * Math.PI * 440 * Math.pow(2, (midi - 69) / 12);
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const env = Math.min(1, t / 0.003) * Math.exp(-t * 15);
        d[i] = (Math.sin(w * t) * 0.6 + Math.sin(2 * w * t) * 0.25 * Math.exp(-t * 20) + Math.sin(3 * w * t) * 0.12 * Math.exp(-t * 30)) * env * 0.55;
      }
      for (let i = 0; i < 64; i++) d[n - 1 - i] *= i / 64;
      this.plucks.set(midi, b);
    }
    const src = c.createBufferSource();
    src.buffer = b;
    const g = c.createGain();
    g.gain.value = gain;
    src.connect(g);
    g.connect(this.sfxGain);
    src.start();
  }

  /** Live spectrum of the music (0..255 per bin), or null when there is no audio. */
  spectrum(): Uint8Array | null {
    if (!this.analyser || !this.running) return null;
    this.analyser.getByteFrequencyData(this.freq);
    return this.freq;
  }

  /** Live waveform of the music (128 = silence). */
  waveform(): Uint8Array | null {
    if (!this.analyser || !this.running) return null;
    this.analyser.getByteTimeDomainData(this.wave);
    return this.wave;
  }

  // ---------------------------------------------------------------- hitsounds

  /** Pre-renders every hitsound into a buffer so a tap only has to start one. `note` (MIDI) tunes the sparkle to the song's key. */
  buildHitsounds(note: number): void {
    const c = this.ctx;
    if (!c) return;
    const sr = c.sampleRate;
    const make = (dur: number, fn: (t: number, i: number, prev: number) => number): AudioBuffer => {
      const n = Math.floor(dur * sr);
      const b = c.createBuffer(1, n, sr);
      const d = b.getChannelData(0);
      let prev = 0;
      for (let i = 0; i < n; i++) { prev = fn(i / sr, i, prev); d[i] = prev; }
      // short fade at the end so nothing clicks
      for (let i = 0; i < 64 && i < n; i++) d[n - 1 - i] *= i / 64;
      return b;
    };
    let seed = 12345;
    const noise = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2147483648 - 1; };
    const TAU = Math.PI * 2;
    const hz = 440 * Math.pow(2, (note - 69) / 12);
    let last = 0;
    const hpNoise = () => { const n = noise(); const o = n - last; last = n; return o * 0.5; }; // crude high-pass
    this.hits.tap = make(0.05, (t) => hpNoise() * Math.exp(-t * 150) * 0.5 + Math.sin(TAU * 1500 * t) * Math.exp(-t * 110) * 0.35);
    this.hits.L = make(0.09, (t) => Math.sin(TAU * (95 * t + (120 * (1 - Math.exp(-t * 45))) / 45)) * Math.exp(-t * 34) * 0.9 + hpNoise() * Math.exp(-t * 320) * 0.25);
    this.hits.R = make(0.06, (t) => hpNoise() * Math.exp(-t * 95) * 0.6 + Math.sin(TAU * 2300 * t) * Math.exp(-t * 130) * 0.3);
    this.hits.sparkle = make(0.16, (t) => (Math.sin(TAU * hz * 4 * t) * 0.5 + Math.sin(TAU * hz * 6 * t) * 0.3) * Math.exp(-t * 26) * 0.5);
    this.hits.sparkleHi = make(0.2, (t) => (Math.sin(TAU * hz * 4 * t) * 0.4 + Math.sin(TAU * hz * 6 * t) * 0.35 + Math.sin(TAU * hz * 8 * t) * 0.25) * Math.exp(-t * 20) * 0.55);
    this.hits.impact = make(0.4, (t) => Math.sin(TAU * (55 * t + (110 * (1 - Math.exp(-t * 28))) / 28)) * Math.exp(-t * 8) * 0.85 + hpNoise() * Math.exp(-t * 13) * 0.3);
    this.hits.miss = make(0.16, (t) => Math.sin(TAU * (70 * t - 60 * t * t)) * Math.exp(-t * 22) * 0.8);
    this.hits.spin = make(0.025, (t) => hpNoise() * Math.exp(-t * 260) * 0.45);
    this.hits.hop = make(0.07, (t) => Math.sin(TAU * (600 * t + 2500 * t * t)) * Math.exp(-t * 55) * 0.4);
    this.hits.release = make(0.07, (t) => Math.sin(TAU * hz * 3 * t) * Math.exp(-t * 60) * 0.4 + hpNoise() * Math.exp(-t * 300) * 0.2);
    this.hits.click = make(0.03, (t) => Math.sin(TAU * 1320 * t) * Math.exp(-t * 160) * 0.8);
    this.hits.clickHi = make(0.03, (t) => Math.sin(TAU * 1980 * t) * Math.exp(-t * 160) * 0.9);
  }

  /** Plays a pre-rendered hitsound right now (or at audio-clock time `when`). */
  hit(name: HitName, gain = 1, when = 0): void {
    const c = this.ctx;
    const b = this.hits[name];
    if (!c || !b || c.state !== 'running') return;
    const src = c.createBufferSource();
    src.buffer = b;
    if (gain === 1) src.connect(this.sfxGain);
    else {
      const g = c.createGain();
      g.gain.value = gain;
      src.connect(g);
      g.connect(this.sfxGain);
    }
    src.start(when);
  }
}

export const audio = new AudioEngine();
