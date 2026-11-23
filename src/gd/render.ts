// Picture for the Geometry Dash-style core. Everything the player must read (track, spikes, bars, orbs, pads,
// ball) is drawn in fixed high-contrast colours over a dark track bed; only the world behind it follows the music.
import { audio } from '../audio/audio';
import { orbColour } from '../game/extras';
import type { Level } from '../game/level';
import { PALETTES, type Palette, type RGB } from '../render/palettes';
import { bestFor, save } from '../save';
import type { GdRun } from './run';
import { LAP, PAD_ZONE } from './track';

const TWO_PI = Math.PI * 2;
const EQ_BARS = 48;
const GROW = 1.36; // each ring is this much bigger than the one inside it
const WHITE: RGB = [255, 255, 255];
const DANGER: RGB = [255, 64, 120]; // the edge of everything that kills
const GOLD: RGB = [255, 214, 90]; // jump orbs and the big launch pad
const CYAN: RGB = [0, 245, 255]; // launch pads

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (t: number) => { const x = clamp(t, 0, 1); return x * x * (3 - 2 * x); };
const mix = (a: RGB, b: RGB, t: number): RGB => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const rgba = (c: RGB, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
/** Hops chained through jump orbs climb past one hop's height; the picture eases that off so the ball stays between rings. */
const shown = (h: number) => (h <= 1 ? h : 1 + 0.25 * (1 - Math.exp(-1.6 * (h - 1))));

interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; col: RGB; size: number }
interface Ripple { beat: number; h: number; lv: number; age: number; col: RGB }

const HINTS: Array<{ when: (run: GdRun) => [number, number] | null; text: string }> = [
  { when: () => [-9, 3.2], text: 'BARS: STAY LOW' },
  { when: () => [3.2, 7.5], text: 'SPIKES: TAP TO HOP' },
  { when: (r) => { const p = r.track.pads.find((x) => !x.big); return p ? [p.beat - 3, p.beat + 0.5] : null; }, text: 'PAD: IT JUMPS FOR YOU' },
  { when: (r) => { const o = r.track.orbs[0]; return o ? [o.beat - 4.5, o.beat] : null; }, text: 'GOLD ORB: TAP IN MID-AIR' }
];

export class GdRenderer {
  private ctx: CanvasRenderingContext2D;
  private w = 0;
  private h = 0;
  private dpr = 1;
  private particles: Particle[] = [];
  private ripples: Ripple[] = [];
  private trail: Array<{ beat: number; h: number; lv: number }> = [];
  private eq = new Float32Array(EQ_BARS);
  private stars: Array<{ a: number; d: number; s: number }> = [];
  private bound: GdRun | null = null;
  private launch: boolean[] = [];
  private energy: number[] = [];
  private cam = 0;
  private camVel = 0;
  private inten = 0;
  private flash = 0;
  private shock = -1;
  private punch = 0;
  private dropAge = 99;
  private landPulse = 0;
  private shake = 0;
  private dark = 0;
  private pal: Palette = PALETTES.deep;
  private palFrom: Palette = PALETTES.deep;
  private palName = '';
  private palT = 1;
  private ball = { x: 0, y: 0 };
  // sizes for this frame
  private rs = 100;
  private hop = 20;
  private rb = 5;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    for (let i = 0; i < 80; i++) this.stars.push({ a: Math.random() * TWO_PI, d: Math.random(), s: 0.4 + Math.random() * 1.3 });
    this.resize();
  }

  resize(): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
  }

  reset(): void {
    this.bound = null;
  }

  private bind(run: GdRun): void {
    this.bound = run;
    const level = run.level;
    const laps = Math.ceil(level.totalBeats / LAP) + 2;
    this.launch = Array.from({ length: laps }, (_, k) => run.track.pads.some((p) => p.big && p.beat === k * LAP));
    this.energy = barEnergy(level);
    this.particles = [];
    this.ripples = [];
    this.trail = [];
    this.flash = this.punch = this.landPulse = this.shake = this.dark = 0;
    this.shock = -1;
    this.dropAge = 99;
    this.cam = this.lvl(run.viewTime / level.spb);
    this.camVel = 0;
    const seg = level.segAt(Math.max(0, run.viewTime));
    this.inten = this.energyAt(run.viewTime / level.spb);
    this.palName = seg.look.palette;
    this.pal = this.palFrom = PALETTES[this.palName] || PALETTES.deep;
    this.palT = 1;
  }

  /** Ring level under the ball: whole numbers on a ring, in between while it rides a ramp or flies off a launch pad. */
  private lvl(beat: number): number {
    const k = Math.floor(beat / LAP); // the run-in before beat 0 is a ring of its own, one level down
    const f = beat - k * LAP;
    if (this.launch[k] && f < 1) return k - 1 + smooth(f);
    if (!this.launch[k + 1] && f > LAP - 0.5) return k + smooth((f - (LAP - 0.5)) / 0.5);
    return k;
  }

  /** Ring level of lap k's own track at a beat (the ramp at its end leads up to the next ring). */
  private trackLvl(k: number, beat: number): number {
    const f = beat - k * LAP;
    return !this.launch[k + 1] && f > LAP - 0.5 ? k + smooth((f - (LAP - 0.5)) / 0.5) : k;
  }

  private energyAt(beat: number): number {
    const e = this.energy;
    if (!e.length) return 0.5;
    const x = clamp(beat / 4 - 0.5, 0, e.length - 1);
    const i = Math.floor(x);
    return lerp(e[i], e[Math.min(e.length - 1, i + 1)], x - i);
  }

  private scale(lv: number): number {
    return Math.pow(GROW, lv - this.cam) * (1 + this.punch * 0.05);
  }

  /** Screen point (relative to the core) at a beat, `hpx` above the track of ring level `lv`. */
  private pt(beat: number, hpx: number, lv: number): [number, number] {
    const a = -Math.PI / 2 + (TWO_PI * beat) / LAP;
    const r = (this.rs + hpx) * this.scale(lv);
    return [Math.cos(a) * r, Math.sin(a) * r];
  }

  private burst(x: number, y: number, n: number, col: RGB, speed: number): void {
    if (save.reducedMotion) n = Math.ceil(n / 3);
    for (let i = 0; i < n && this.particles.length < 160; i++) {
      const a = Math.random() * TWO_PI;
      const v = speed * (0.3 + Math.random() * 0.7);
      this.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: 0.3 + Math.random() * 0.35, col, size: 1.5 + Math.random() * 2.5 });
    }
  }

  // ---------------------------------------------------------------- the world behind the track
  private background(p: Palette, time: number, inten: number, groove: number, dark: number): void {
    const c = this.ctx;
    const cx = this.w / 2;
    const cy = this.h * 0.52;
    const span = Math.max(this.w, this.h) * 0.75;
    const k = 0.4 + inten * 0.95 + groove * 0.7;
    const g = c.createRadialGradient(cx, cy, 0, cx, cy, span);
    g.addColorStop(0, rgba([p.bg0[0] * k, p.bg0[1] * k, p.bg0[2] * k]));
    g.addColorStop(1, rgba(p.bg1));
    c.fillStyle = g;
    c.fillRect(0, 0, this.w, this.h);
    const speed = save.reducedMotion ? 0.01 : 0.01 + inten * 0.07;
    if (inten > 0.55 && !save.reducedMotion) {
      // the groove: slow rings drifting outward, only when the music is full
      const a = (inten - 0.55) / 0.45;
      for (let i = 0; i < 5; i++) {
        const f = (i / 5 + time * 0.16) % 1;
        c.lineWidth = 1.5 + f * 3;
        c.strokeStyle = rgba(p.acc, (1 - f) * f * 0.8 * a * (0.35 + groove));
        c.beginPath(); c.arc(cx, cy, f * f * span, 0, TWO_PI); c.stroke();
      }
    }
    for (const s of this.stars) {
      const d = (s.d + time * speed * s.s) % 1;
      c.fillStyle = rgba(p.acc, (0.1 + 0.4 * d) * (0.35 + inten * 0.65));
      c.fillRect(cx + Math.cos(s.a) * d * span, cy + Math.sin(s.a) * d * span, s.s, s.s);
    }
    if (dark > 0.01) { c.fillStyle = `rgba(0,0,0,${dark})`; c.fillRect(0, 0, this.w, this.h); }
  }

  /** Audio-reactive equalizer round the core: the live spectrum, or the baked kick and snare when there is no audio. */
  private core(pal: Palette, rc: number, len: number, kick: number, snare: number, dt: number): void {
    const c = this.ctx;
    const spec = audio.spectrum();
    for (let i = 0; i < EQ_BARS; i++) {
      const m = i < EQ_BARS / 2 ? i : EQ_BARS - 1 - i;
      const v = spec ? Math.pow(spec[2 + Math.floor(m * 1.7)] / 255, 1.5) : kick * Math.exp(-m * 0.12) + snare * 0.7 * Math.exp(-Math.abs(m - 14) * 0.15);
      this.eq[i] += (v - this.eq[i]) * Math.min(1, dt * (v > this.eq[i] ? 40 : 9));
    }
    const glow = c.createRadialGradient(0, 0, 0, 0, 0, rc * (1.1 + kick * 0.4));
    glow.addColorStop(0, rgba(pal.ring, 0.5 + kick * 0.35));
    glow.addColorStop(1, rgba(pal.ring, 0));
    c.fillStyle = glow;
    c.beginPath(); c.arc(0, 0, rc * (1.1 + kick * 0.4), 0, TWO_PI); c.fill();
    c.lineCap = 'round';
    c.lineWidth = Math.max(2, ((rc * TWO_PI) / EQ_BARS) * 0.5);
    for (let i = 0; i < EQ_BARS; i++) {
      const a = (i / EQ_BARS) * TWO_PI - Math.PI / 2 + Math.PI / EQ_BARS;
      const v = this.eq[i];
      c.strokeStyle = rgba(mix(pal.ring, pal.acc, v), 0.4 + v * 0.6);
      c.beginPath(); c.moveTo(Math.cos(a) * rc * 1.12, Math.sin(a) * rc * 1.12); c.lineTo(Math.cos(a) * (rc * 1.2 + v * len), Math.sin(a) * (rc * 1.2 + v * len)); c.stroke();
    }
    c.lineCap = 'butt';
  }

  private drawBall(x: number, y: number, r: number, col: RGB, angle = 0, along = 1, across = 1): void {
    const c = this.ctx;
    c.save();
    c.translate(x, y);
    c.rotate(angle);
    c.scale(along, across);
    c.shadowColor = rgba(col, 0.9);
    c.shadowBlur = r * 2.2;
    c.fillStyle = '#ffffff';
    c.beginPath(); c.arc(0, 0, r, 0, TWO_PI); c.fill();
    c.shadowBlur = 0;
    c.lineWidth = r * 0.35;
    c.strokeStyle = rgba(col, 0.95);
    c.beginPath(); c.arc(0, 0, r * 1.25, 0, TWO_PI); c.stroke();
    c.restore();
  }

  /** Traces lap k's track, `hpx` above it, from beat b0 to b1 (both inside the lap). */
  private path(k: number, b0: number, b1: number, hpx: number): void {
    const c = this.ctx;
    const rampAt = this.launch[k + 1] ? Infinity : k * LAP + LAP - 0.5;
    c.beginPath();
    const flat = Math.min(b1, rampAt);
    if (flat > b0) {
      const a0 = -Math.PI / 2 + (TWO_PI * b0) / LAP;
      c.arc(0, 0, (this.rs + hpx) * this.scale(k), a0, a0 + (TWO_PI * (flat - b0)) / LAP);
    }
    if (b1 > rampAt) {
      const from = Math.max(b0, rampAt);
      const n = Math.max(2, Math.ceil((b1 - from) * 24));
      for (let i = flat > b0 ? 1 : 0; i <= n; i++) {
        const b = from + ((b1 - from) * i) / n;
        const [x, y] = this.pt(b, hpx, this.trackLvl(k, b));
        if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
      }
    }
  }

  private drawLap(run: GdRun, k: number, alpha: number, beat: number, pal: Palette, glow: number): void {
    if (alpha <= 0.01 || k < -1) return;
    const c = this.ctx;
    const tr = run.track;
    const b0 = k * LAP;
    const b1 = b0 + LAP;
    const s = this.scale(k);
    const { hop, rb } = this;
    c.globalAlpha = alpha;
    // the dark bed everything is read against
    c.lineCap = 'butt';
    c.strokeStyle = 'rgba(0,0,10,0.34)';
    c.lineWidth = (hop * 1.3 + rb * 2) * s;
    this.path(k, b0, b1, (hop * 1.3 + rb * 2) / 2 - 1);
    c.stroke();
    // the track
    this.path(k, b0, b1, 0);
    if (glow > 0.05) { // the ring breathes with the kick once the music is full
      c.strokeStyle = rgba(pal.ring, glow * 0.3);
      c.lineWidth = 12 * s;
      c.stroke();
    }
    c.strokeStyle = rgba(mix(pal.ring, WHITE, 0.25 + glow * 0.4));
    c.lineWidth = Math.max(2, (2.5 + glow * 2) * s);
    c.stroke();

    const fade = (end: number) => clamp(1 - (beat - end - 0.25) / 0.5, 0, 1);
    c.lineJoin = 'round';
    for (const h of tr.hazards) {
      if (h.b1 <= b0 || h.b0 >= b1) continue;
      const f = fade(h.b1);
      if (f <= 0) continue;
      c.globalAlpha = alpha * f;
      if (h.kind === 'spike') {
        // drawn a little wider and taller than the part that kills
        const d0 = Math.max(b0, h.b0 - 0.05);
        const d1 = Math.min(b1, h.b1 + 0.05);
        const n = Math.max(1, Math.round((d1 - d0) / 0.135));
        const tip = hop * 0.5 + rb * 0.4;
        c.beginPath();
        for (let i = 0; i < n; i++) {
          const x0 = d0 + ((d1 - d0) * i) / n;
          const x1 = d0 + ((d1 - d0) * (i + 1)) / n;
          const [ax, ay] = this.pt(x0, 0, this.trackLvl(k, x0));
          const [mx, my] = this.pt((x0 + x1) / 2, tip, this.trackLvl(k, (x0 + x1) / 2));
          const [ex, ey] = this.pt(x1, 0, this.trackLvl(k, x1));
          if (i === 0) c.moveTo(ax, ay);
          c.lineTo(mx, my);
          c.lineTo(ex, ey);
        }
        for (let i = n - 1; i > 0; i--) { // back along the track, so a long bed follows the curve
          const x = d0 + ((d1 - d0) * i) / n;
          const [px, py] = this.pt(x, -1.5, this.trackLvl(k, x));
          c.lineTo(px, py);
        }
        c.closePath();
        c.fillStyle = '#ffffff';
        c.fill();
        c.strokeStyle = rgba(DANGER);
        c.lineWidth = Math.max(1.5, 2 * s);
        c.stroke();
      } else {
        // overhead bar: a slab above the track, with room for the ball to roll under
        const d0 = Math.max(b0, h.b0 - 0.04);
        const d1 = Math.min(b1, h.b1 + 0.04);
        const th = this.rs * 0.05;
        const mid = hop * 0.3 + rb * 1.6 + th / 2;
        this.path(k, d0, d1, mid);
        c.strokeStyle = rgba(DANGER);
        c.lineWidth = (th + 4) * s;
        c.stroke();
        this.path(k, d0 + 0.012, d1 - 0.012, mid);
        c.strokeStyle = '#ffffff';
        c.lineWidth = th * s;
        c.stroke();
      }
    }
    for (const p of tr.pads) {
      // a big pad fires from the end of the ring before the one it lands on
      const lap = p.big ? p.beat / LAP - 1 : Math.floor(p.beat / LAP);
      if (lap !== k) continue;
      const f = fade(p.beat + PAD_ZONE);
      if (f <= 0) continue;
      c.globalAlpha = alpha * f;
      const col = p.big ? GOLD : CYAN;
      const lv = p.big ? k : this.trackLvl(k, p.beat);
      const z = p.big ? PAD_ZONE * 1.3 : PAD_ZONE;
      const a0 = -Math.PI / 2 + (TWO_PI * (p.beat - (p.big ? z / 2 : 0))) / LAP;
      c.lineCap = 'round';
      c.strokeStyle = rgba(col);
      c.lineWidth = rb * (p.big ? 1.1 : 0.85) * s;
      c.beginPath(); c.arc(0, 0, this.rs * this.scale(lv), a0, a0 + (TWO_PI * z) / LAP); c.stroke();
      // two chevrons pointing the way it throws you
      const mid = p.beat + (p.big ? 0 : z / 2);
      c.lineWidth = Math.max(1.5, 2.2 * s);
      for (let j = 0; j < 2; j++) {
        const base = rb * (1.5 + j * 1.1);
        const [lx, ly] = this.pt(mid - 0.07, base, lv);
        const [tx, ty] = this.pt(mid, base + rb * 0.9, lv);
        const [rx, ry] = this.pt(mid + 0.07, base, lv);
        c.globalAlpha = alpha * f * (j === 0 ? 1 : 0.55);
        c.beginPath(); c.moveTo(lx, ly); c.lineTo(tx, ty); c.lineTo(rx, ry); c.stroke();
      }
      c.lineCap = 'butt';
    }
    for (const o of tr.orbs) {
      if (o.beat < b0 || o.beat >= b1 || run.sim.orbUsed(o.beat)) continue;
      const f = fade(o.beat);
      if (f <= 0) continue;
      c.globalAlpha = alpha * f;
      const [x, y] = this.pt(o.beat, rb + shown(o.h) * hop, this.trackLvl(k, o.beat));
      const pulse = 1 + 0.12 * Math.sin(beat * Math.PI * 2);
      c.strokeStyle = rgba(GOLD);
      c.lineWidth = Math.max(2, rb * 0.42 * s);
      c.beginPath(); c.arc(x, y, rb * 1.35 * s * pulse, 0, TWO_PI); c.stroke();
      c.fillStyle = rgba(GOLD, 0.9);
      c.beginPath(); c.arc(x, y, rb * 0.5 * s, 0, TWO_PI); c.fill();
    }
    c.globalAlpha = 1;
  }

  private text(s: string, x: number, y: number, size: number, col: RGB, alpha: number): void {
    if (alpha <= 0.01) return;
    const c = this.ctx;
    c.font = `800 ${Math.round(size)}px ui-rounded, "SF Pro Rounded", system-ui, sans-serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = `rgba(0,0,8,${alpha * 0.55})`;
    const w = c.measureText(s).width + size * 1.4;
    c.beginPath();
    c.roundRect(x - w / 2, y - size * 0.95, w, size * 1.9, size * 0.95);
    c.fill();
    c.fillStyle = rgba(col, alpha);
    c.fillText(s, x, y + 1);
  }

  // ---------------------------------------------------------------- a frame of play
  draw(run: GdRun, now: number, dt: number): void {
    if (this.bound !== run) this.bind(run);
    const c = this.ctx;
    const level = run.level;
    const sim = run.sim;
    const t = run.viewTime;
    const beat = t / level.spb;
    const m = Math.min(this.w, this.h * 0.94);
    this.rs = m * 0.29;
    this.hop = this.rs * 0.21;
    this.rb = Math.max(5, this.rs * 0.052);
    const { rs, hop, rb } = this;
    const skin = orbColour(save.skin);
    const playing = run.state === 'playing';

    // the section's palette, cross-faded
    const seg = level.segAt(Math.max(0, t));
    if (seg.look.palette !== this.palName) {
      this.palFrom = this.pal;
      this.palName = seg.look.palette;
      this.palT = 0;
    }
    const target = PALETTES[this.palName] || PALETTES.deep;
    this.palT = Math.min(1, this.palT + dt / 0.5);
    const pal: Palette = this.palT >= 1 ? target : { bg0: mix(this.palFrom.bg0, target.bg0, this.palT), bg1: mix(this.palFrom.bg1, target.bg1, this.palT), ring: mix(this.palFrom.ring, target.ring, this.palT), acc: mix(this.palFrom.acc, target.acc, this.palT) };
    this.pal = pal;

    // one intensity value from the measured energy of each bar; it drives everything behind the track
    this.inten += (this.energyAt(beat) - this.inten) * Math.min(1, dt * 2.5);
    const inten = this.inten;
    const kick = level.energyAt('kick', t);
    const snare = level.energyAt('snare', t);
    const groove = kick * inten * inten;
    this.dark += ((seg.blackout ? 0.5 : 0) - this.dark) * Math.min(1, dt * 4);

    // what just happened
    for (const ev of run.events) {
      if (ev === 'jump' || ev === 'orb') {
        this.ripples.push({ beat, h: rb + shown(sim.height(beat)) * hop, lv: this.lvl(beat), age: 0, col: ev === 'orb' ? GOLD : skin });
        if (ev === 'orb') this.burst(this.ball.x, this.ball.y, 10, GOLD, rs * 0.9);
      } else if (ev === 'land') this.landPulse = 1;
      else if (ev === 'pad') this.burst(this.ball.x, this.ball.y, 8, CYAN, rs * 0.8);
      else if (ev === 'launch') {
        this.punch = 1;
        if (Math.abs(beat - run.track.dropBeat) < 1) { this.flash = 1; this.shock = 0; this.dropAge = 0; } // the one big moment
        this.burst(this.ball.x, this.ball.y, 18, GOLD, rs * 1.3);
      } else if (ev === 'crash') {
        this.burst(this.ball.x, this.ball.y, 34, WHITE, rs * 1.5);
        this.burst(this.ball.x, this.ball.y, 16, DANGER, rs * 1.1);
        this.shake = save.reducedMotion ? 0 : 1;
      }
    }
    run.events.length = 0;
    if (this.ripples.length > 8) this.ripples.splice(0, this.ripples.length - 8);

    // spring camera: follows the ring the ball is on, a touch ahead of it
    const want = this.lvl(beat + 0.3);
    const om = 11;
    this.camVel += (om * om * (want - this.cam) - 2 * om * this.camVel) * dt;
    this.cam += this.camVel * dt;
    this.punch = Math.max(0, this.punch - dt / 0.45);
    this.flash = Math.max(0, this.flash - dt / 0.15);
    this.landPulse = Math.max(0, this.landPulse - dt / 0.12);
    this.shake = Math.max(0, this.shake - dt / 0.3);
    this.dropAge += dt;

    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.background(pal, now / 1000, inten, groove, this.dark);
    c.save();
    let cx = this.w / 2;
    let cy = this.h * 0.52;
    if (this.shake > 0) { cx += (Math.random() - 0.5) * 10 * this.shake; cy += (Math.random() - 0.5) * 10 * this.shake; }
    if (this.dropAge < 1.2 && !save.reducedMotion) cx += Math.exp(-this.dropAge * 4) * Math.sin(this.dropAge * 10) * m * 0.03; // the drop's slingshot swing
    c.translate(cx, cy);

    this.core(pal, m * 0.05, m * 0.05 * (0.4 + 1.1 * inten), kick * (0.3 + 0.7 * inten), snare * inten, dt);

    if (this.shock >= 0) {
      this.shock += dt / 0.6;
      if (this.shock >= 1) this.shock = -1;
      else {
        c.strokeStyle = rgba(pal.acc, (1 - this.shock) * 0.6);
        c.lineWidth = 2 + (1 - this.shock) * 8;
        c.beginPath(); c.arc(0, 0, rs * 0.3 + this.shock * Math.max(this.w, this.h) * 0.75, 0, TWO_PI); c.stroke();
      }
    }

    // rings: the one just left (fading), the one the ball is on, and the next one so its obstacles can be read early
    const kc = Math.floor(beat / LAP);
    const f = beat - kc * LAP;
    const ringGlow = groove * 0.8;
    if (this.launch[kc]) this.drawLap(run, kc - 1, 1 - smooth((f - 0.2) / 1.2), beat, pal, 0);
    else this.drawLap(run, kc - 1, 1 - smooth(f / 0.9), beat, pal, 0);
    this.drawLap(run, kc + 1, 0.32 + 0.68 * smooth((f - (LAP - 2.5)) / 2), beat, pal, 0);
    this.drawLap(run, kc, 1, beat, pal, ringGlow);

    // tap ripples: the same small ring on every hop
    for (const r of this.ripples) {
      r.age += dt;
      const u = r.age / 0.28;
      if (u >= 1) continue;
      const [x, y] = this.pt(r.beat, r.h, r.lv);
      c.strokeStyle = rgba(r.col, (1 - u) * 0.8);
      c.lineWidth = 2;
      c.beginPath(); c.arc(x, y, rb * (1.2 + u * 2.6), 0, TWO_PI); c.stroke();
    }

    // the ball: a pure function of the clock, so it moves exactly as smoothly as the clock does
    const lv = this.lvl(beat);
    const air = !!sim.air;
    const hNow = rb * (1 - 0.3 * this.landPulse) + shown(sim.height(beat)) * hop;
    const [bx, by] = this.pt(beat, hNow, lv);
    if (run.state !== 'failed') {
      if (playing) {
        this.trail.push({ beat, h: hNow, lv });
        if (this.trail.length > 30) this.trail.shift();
      }
      c.lineCap = 'round';
      const n = this.trail.length;
      for (let i = 1; i < n; i++) {
        const a = this.trail[i - 1];
        const b = this.trail[i];
        const u = i / n;
        const [x0, y0] = this.pt(a.beat, a.h, a.lv);
        const [x1, y1] = this.pt(b.beat, b.h, b.lv);
        c.strokeStyle = rgba(skin, u * u * 0.55);
        c.lineWidth = rb * 1.7 * u;
        c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
      }
      c.lineCap = 'butt';
      const stretch = air ? clamp(Math.abs(sim.speed(beat)) / 4, 0, 1) * 0.2 : 0;
      const ang = -Math.PI / 2 + (TWO_PI * beat) / LAP;
      this.drawBall(bx, by, rb, skin, ang, 1 + stretch - 0.3 * this.landPulse, 1 - stretch * 0.5 + 0.22 * this.landPulse);
      this.ball.x = bx;
      this.ball.y = by;
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      if (p.life >= p.max) { this.particles.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 1 - dt * 2.5;
      p.vy *= 1 - dt * 2.5;
      c.fillStyle = rgba(p.col, 1 - p.life / p.max);
      c.beginPath(); c.arc(p.x, p.y, p.size, 0, TWO_PI); c.fill();
    }

    // short hints, inside the ring and out of the ball's way
    if (run.state !== 'loading' && (!bestFor(level.id).cleared || run.opts.practice)) {
      for (const hint of HINTS) {
        const span = hint.when(run);
        if (!span || beat < span[0] || beat > span[1]) continue;
        const a = Math.min(1, (beat - Math.max(span[0], run.startAt / level.spb - 3)) / 0.5, (span[1] - beat) / 0.5);
        this.text(hint.text, 0, rs * 0.5, clamp(m * 0.024, 11, 17), WHITE, clamp(a, 0, 1));
        break;
      }
    }
    if (run.state === 'resuming') this.text(String(Math.max(1, Math.ceil((run.resumeAt - now) / 400))), 0, -rs * 0.5, m * 0.07, WHITE, 1);
    if (run.state === 'loading') this.text('LOADING', 0, rs * 0.5, clamp(m * 0.024, 11, 17), WHITE, 0.8);
    c.restore();

    if (this.flash > 0) { c.fillStyle = `rgba(255,255,255,${this.flash * (save.reducedMotion ? 0.12 : 0.5)})`; c.fillRect(0, 0, this.w, this.h); }
  }

  /** Idle picture behind the menus. */
  drawIdle(now: number, dt = 0.016): void {
    const c = this.ctx;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const pal = PALETTES.deep;
    const pulse = Math.exp(-(((now / 1000) * 2) % 1) * 4) * 0.5;
    this.background(pal, now / 1000, 0.45, pulse * 0.2, 0);
    const m = Math.min(this.w, this.h);
    c.save();
    c.translate(this.w / 2, this.h * 0.5);
    this.core(pal, m * 0.06, m * 0.05, pulse, pulse * 0.5, dt);
    for (let k = 0; k < 2; k++) {
      c.lineWidth = 2;
      c.strokeStyle = rgba(pal.ring, 0.32 - k * 0.14);
      c.beginPath(); c.arc(0, 0, m * 0.27 * Math.pow(GROW, k), 0, TWO_PI); c.stroke();
    }
    // the ball rolls round and hops once a lap
    const turn = (now / 5200) % 1;
    const u = (turn * 8) % 1;
    const hopH = Math.floor(turn * 8) % 4 === 1 ? 4 * u * (1 - u) : 0;
    const a = -Math.PI / 2 + turn * TWO_PI;
    const r = m * 0.27 + m * 0.014 + hopH * m * 0.055;
    this.drawBall(Math.cos(a) * r, Math.sin(a) * r, m * 0.014, orbColour(save.skin));
    c.restore();
  }

  /** Ball crossing a mark at the top of a ring; used by the visual-offset calibration. */
  drawMetronome(now: number, phase: number): void {
    const c = this.ctx;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const pal = PALETTES.deep;
    this.background(pal, now / 1000, 0.4, 0, 0);
    const cx = this.w / 2;
    const cy = this.h * 0.36;
    const R = Math.min(this.w, this.h) * 0.2;
    c.lineWidth = 3;
    c.strokeStyle = rgba(pal.ring, 0.5);
    c.beginPath(); c.arc(cx, cy, R, 0, TWO_PI); c.stroke();
    c.lineCap = 'round';
    c.lineWidth = 7;
    c.strokeStyle = rgba(GOLD);
    c.beginPath(); c.moveTo(cx, cy - R * 0.85); c.lineTo(cx, cy - R * 1.15); c.stroke();
    c.lineCap = 'butt';
    const a = -Math.PI / 2 + phase * TWO_PI;
    this.drawBall(cx + Math.cos(a) * R, cy + Math.sin(a) * R, R * 0.1, CYAN);
  }
}

/** Measured energy of each bar, 0..1: the kick and snare strengths baked into the chart, averaged and lightly smoothed. */
function barEnergy(level: Level): number[] {
  const bars = Math.ceil(level.totalBeats / 4);
  const raw: number[] = [];
  for (let b = 0; b < bars; b++) {
    let sum = 0;
    for (let i = 0; i < 16; i++) {
      const t = (b * 4 + i / 4 + 0.01) * level.spb;
      sum += level.energyAt('kick', t) + 0.5 * level.energyAt('snare', t);
    }
    raw.push(sum / 16);
  }
  const top = Math.max(0.001, ...raw);
  const norm = raw.map((v) => v / top);
  return norm.map((v, i) => (norm[Math.max(0, i - 1)] + 2 * v + norm[Math.min(bars - 1, i + 1)]) / 4);
}
