import { audio } from '../audio/audio';
import type { JEvent } from '../game/engine';
import { orbColour } from '../game/extras';
import { shapePoint } from '../game/level';
import { HOP_BEATS, ORBIT_RATIO, WINDOW } from '../game/rules';
import type { Run } from '../game/run';
import type { Ring, Segment } from '../game/types';
import { save } from '../save';

import { PALETTES, type Palette, type RGB } from './palettes';

const CYAN: RGB = [0, 245, 255];
const PINK: RGB = [255, 60, 150];
const GOLD: RGB = [255, 226, 130];
const RED: RGB = [255, 72, 60];
/** Gate colour = the sound the section follows: arpeggio, kick, snare/clap, lead. */
const VOICE_COL: Record<string, RGB> = { a: [214, 226, 255], k: CYAN, b: CYAN, s: [255, 176, 80], l: PINK };
const JUDGE_COL: Record<string, RGB> = { perfect: [255, 214, 90], great: [0, 245, 255], good: [196, 181, 253], miss: [255, 90, 120] };
const TWO_PI = Math.PI * 2;
const EQ_BARS = 48;

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ramp = (r: [number, number] | undefined, u: number, d: number) => (r ? lerp(r[0], r[1], u) : d);
const mix = (a: RGB, b: RGB, t: number): RGB => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const ease = (t: number) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);

interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; col: RGB; size: number }
interface Shock { r: number; max: number; alpha: number; col: RGB; w: number }

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private w = 0;
  private h = 0;
  private dpr = 1;
  private particles: Particle[] = [];
  private shocks: Shock[] = [];
  private flash = 0;
  private punch = 0;
  private shake = 0;
  private drain = 0;
  private tapPulse = 0;
  private camLevel = 0;
  private camBias = 0;
  private flipAngle = 0;
  private flipTarget = 0;
  private ringIdx = -1;
  private jumpT = 1;
  private jumpFrom = 0;
  private hopUntil = -1;
  private kickWas = 0;
  private camVel = 0;
  private landed = true;
  private landPulse = 0;
  private panT = 1;
  private panFrom = { x: 0, y: 0 };
  private lastBall = { x: 0, y: 0 };
  private redAt = { x: 0, y: 0, a: 0 };
  private planetVec = new Map<number, [number, number]>();
  private eq = new Float32Array(EQ_BARS);
  private stars: Array<{ a: number; d: number; s: number }> = [];
  private trail: Array<{ x: number; y: number }> = [];
  private banner: { text: string; until: number } | null = null;
  private prevPal: Palette = PALETTES.deep;
  private curPalName = 'deep';
  private palSwitchT = -99;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    for (let i = 0; i < 90; i++) this.stars.push({ a: Math.random() * TWO_PI, d: Math.random(), s: 0.4 + Math.random() * 1.4 });
    this.resize();
  }

  resize(): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
  }

  reset(startLevel = 0): void {
    this.particles = [];
    this.shocks = [];
    this.flash = this.punch = this.shake = this.drain = this.tapPulse = this.camBias = 0;
    this.flipAngle = this.flipTarget = 0;
    this.camLevel = startLevel;
    this.camVel = 0;
    this.panT = 1;
    this.landPulse = 0;
    this.redAt.a = 0;
    this.planetVec.clear();
    this.ringIdx = -1;
    this.jumpT = 1;
    this.hopUntil = -1;
    this.trail = [];
    this.banner = null;
    this.palSwitchT = -99;
  }

  private col(c: RGB, a = 1): string {
    // "colours draining" in the build-up: pull everything toward grey
    const g = c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11;
    const d = this.drain;
    return `rgba(${lerp(c[0], g, d) | 0},${lerp(c[1], g, d) | 0},${lerp(c[2], g, d) | 0},${a})`;
  }

  private burst(x: number, y: number, n: number, col: RGB, speed: number): void {
    if (save.reducedMotion) n = Math.ceil(n / 3);
    for (let i = 0; i < n && this.particles.length < 280; i++) {
      const a = Math.random() * TWO_PI;
      const v = speed * (0.3 + Math.random() * 0.7);
      this.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: 0.35 + Math.random() * 0.35, col, size: 1.5 + Math.random() * 2.5 });
    }
  }

  private background(p: Palette, style: string, pulse: number, dark: number, time: number, energy: number): void {
    const c = this.ctx;
    const cx = this.w / 2;
    const cy = this.h * 0.47;
    const span = Math.max(this.w, this.h) * 0.75;
    const g = c.createRadialGradient(cx, cy, 0, cx, cy, span);
    const k = 1 + pulse * 0.55;
    g.addColorStop(0, this.col([p.bg0[0] * k, p.bg0[1] * k, p.bg0[2] * k]));
    g.addColorStop(1, this.col(p.bg1));
    c.fillStyle = g;
    c.fillRect(0, 0, this.w, this.h);
    const speed = save.reducedMotion ? 0.02 : 0.02 + energy * 0.16;
    if (style === 'tunnel') {
      // rings rushing outward: a tunnel that speeds up with the music
      for (let i = 0; i < 8; i++) {
        const f = (i / 8 + time * speed * 1.6) % 1;
        c.lineWidth = 1 + f * 3;
        c.strokeStyle = this.col(p.acc, (1 - f) * f * 0.5 * (0.5 + pulse));
        c.beginPath(); c.arc(cx, cy, f * f * span, 0, TWO_PI); c.stroke();
      }
    } else if (style === 'grid') {
      // spokes and rings turning slowly: a radar grid that flashes on the beat
      const turn = time * 0.12;
      c.lineWidth = 1;
      c.strokeStyle = this.col(p.acc, 0.07 + pulse * 0.1);
      c.beginPath();
      for (let i = 0; i < 16; i++) { const a = turn + (i / 16) * TWO_PI; c.moveTo(cx, cy); c.lineTo(cx + Math.cos(a) * span, cy + Math.sin(a) * span); }
      for (let i = 1; i <= 5; i++) { c.moveTo(cx + (i / 5) * span, cy); c.arc(cx, cy, (i / 5) * span, 0, TWO_PI); }
      c.stroke();
    }
    for (const s of this.stars) {
      const d = (s.d + time * speed * 0.7 * s.s) % 1;
      const x = cx + Math.cos(s.a) * d * span;
      const y = cy + Math.sin(s.a) * d * span;
      c.fillStyle = this.col(p.acc, (0.15 + 0.5 * d) * (0.6 + pulse * 0.4));
      const len = save.reducedMotion ? 0 : energy * 16 * d;
      if (len > 2) c.fillRect(x, y, Math.cos(s.a) * len || 1, Math.sin(s.a) * len || 1);
      c.fillRect(x, y, s.s, s.s);
    }
    if (dark > 0) { c.fillStyle = `rgba(0,0,0,${dark})`; c.fillRect(0, 0, this.w, this.h); }
  }

  /** Audio-reactive equalizer round the core. Uses the live spectrum; falls back to the baked kick/snare energy. */
  private equalizer(style: string, pal: Palette, rc: number, len: number, kick: number, snare: number, dt: number): void {
    const c = this.ctx;
    const spec = audio.spectrum();
    for (let i = 0; i < EQ_BARS; i++) {
      const m = i < EQ_BARS / 2 ? i : EQ_BARS - 1 - i; // mirrored: bass at the top, treble at the bottom
      let v: number;
      if (spec) v = Math.pow(spec[2 + Math.floor(m * 1.7)] / 255, 1.5);
      else v = kick * Math.exp(-m * 0.12) + snare * 0.7 * Math.exp(-Math.abs(m - 14) * 0.15);
      this.eq[i] += (v - this.eq[i]) * Math.min(1, dt * (v > this.eq[i] ? 40 : 9));
    }
    const glow = c.createRadialGradient(0, 0, 0, 0, 0, rc * (1.1 + kick * 0.5));
    glow.addColorStop(0, this.col(pal.ring, 0.55 + kick * 0.4));
    glow.addColorStop(1, this.col(pal.ring, 0));
    c.fillStyle = glow;
    c.beginPath(); c.arc(0, 0, rc * (1.1 + kick * 0.5), 0, TWO_PI); c.fill();
    if (style === 'wave') {
      const wave = audio.waveform();
      c.lineWidth = 2.5;
      c.strokeStyle = this.col(pal.acc, 0.9);
      c.shadowColor = this.col(pal.acc, 0.9);
      c.shadowBlur = 8 + kick * 14;
      c.beginPath();
      const N = 96;
      for (let i = 0; i <= N; i++) {
        const a = (i / N) * TWO_PI - Math.PI / 2;
        const s = wave ? (wave[(i % N) * 2] - 128) / 128 : Math.sin(a * 6) * kick * 0.4;
        const r = rc * (1.25 + s * 0.9 + this.eq[Math.floor((i % N) / 2)] * 0.5);
        if (i === 0) c.moveTo(Math.cos(a) * r, Math.sin(a) * r); else c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      c.stroke();
      c.shadowBlur = 0;
      return;
    }
    c.lineCap = 'round';
    c.lineWidth = Math.max(2, ((rc * TWO_PI) / EQ_BARS) * 0.5);
    for (let i = 0; i < EQ_BARS; i++) {
      const a = (i / EQ_BARS) * TWO_PI - Math.PI / 2 + Math.PI / EQ_BARS;
      const v = this.eq[i];
      const r1 = rc * 1.2 + v * len * (style === 'burst' ? 1.35 : 1);
      c.strokeStyle = this.col(mix(pal.ring, pal.acc, v), 0.45 + v * 0.55);
      c.beginPath(); c.moveTo(Math.cos(a) * rc * 1.12, Math.sin(a) * rc * 1.12); c.lineTo(Math.cos(a) * r1, Math.sin(a) * r1); c.stroke();
    }
    if (style === 'burst' && kick > 0.6 && this.kickWas <= 0.6) this.burst(0, 0, 14, pal.acc, rc * 9); // sparks fly off the core on every kick
  }

  private ball(x: number, y: number, r: number, col: RGB): void {
    const c = this.ctx;
    c.shadowColor = this.col(col, 0.9);
    c.shadowBlur = r * 2.2;
    c.fillStyle = '#ffffff';
    c.beginPath(); c.arc(x, y, r, 0, TWO_PI); c.fill();
    c.shadowBlur = 0;
    c.lineWidth = r * 0.35;
    c.strokeStyle = this.col(col, 0.95);
    c.beginPath(); c.arc(x, y, r * 1.25, 0, TWO_PI); c.stroke();
  }

  private ringPath(ring: Ring, rad: number): void {
    const c = this.ctx;
    c.beginPath();
    if (ring.shape === 'circle') { c.arc(0, 0, rad, 0, TWO_PI); return; }
    for (let i = 0; i <= 96; i++) {
      const [x, y] = shapePoint(ring.shape, (i / 96) * TWO_PI);
      if (i === 0) c.moveTo(x * rad, y * rad); else c.lineTo(x * rad, y * rad);
    }
  }

  /** Idle picture behind the menus. */
  drawIdle(now: number, dt = 0.016): void {
    const c = this.ctx;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.drain = 0;
    const beat = (now / 1000) * 2;
    const pulse = Math.exp(-(beat % 1) * 4) * 0.5;
    this.background(PALETTES.deep, 'stars', pulse * 0.4, 0, now / 1000, 0.25);
    const m = Math.min(this.w, this.h);
    c.save();
    c.translate(this.w / 2, this.h * 0.47);
    this.equalizer('bars', PALETTES.deep, m * 0.07, m * 0.06, pulse, pulse * 0.5, dt);
    for (let k = 0; k < 3; k++) {
      c.lineWidth = 2;
      c.strokeStyle = this.col(PALETTES.deep.ring, 0.3 - k * 0.08);
      c.beginPath(); c.arc(0, 0, m * 0.27 * Math.pow(ORBIT_RATIO, k), 0, TWO_PI); c.stroke();
    }
    const a = now / 1400;
    this.ball(Math.cos(a) * m * 0.27, Math.sin(a) * m * 0.27, m * 0.017, CYAN);
    c.restore();
  }

  /** Ball crossing a gate at the top of a ring; used by the visual-offset calibration. */
  drawMetronome(now: number, phase: number): void {
    const c = this.ctx;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.drain = 0;
    this.background(PALETTES.deep, 'stars', 0.2, 0, now / 1000, 0.3);
    const cx = this.w / 2;
    const cy = this.h * 0.36;
    const R = Math.min(this.w, this.h) * 0.2;
    c.lineWidth = 3;
    c.strokeStyle = this.col(PALETTES.deep.ring, 0.5);
    c.beginPath(); c.arc(cx, cy, R, 0, TWO_PI); c.stroke();
    c.lineCap = 'round';
    c.lineWidth = 7;
    c.strokeStyle = this.col(GOLD, 1);
    c.beginPath(); c.moveTo(cx, cy - R * 0.85); c.lineTo(cx, cy - R * 1.15); c.stroke();
    const a = -Math.PI / 2 + phase * TWO_PI;
    this.ball(cx + Math.cos(a) * R, cy + Math.sin(a) * R, R * 0.1, CYAN);
  }

  draw(run: Run, now: number, dt: number): void {
    const c = this.ctx;
    const level = run.level;
    const t = run.viewTime;
    const beat = t / level.spb;
    const seg = level.segAt(Math.max(0, t));
    const u = clamp((t - seg.t0) / (seg.t1 - seg.t0), 0, 1);
    const look = seg.look;
    const rm = save.reducedMotion;
    const m = Math.min(this.w, this.h);
    const cx = this.w / 2;
    const cy = this.h * 0.47;
    const scr = (lvl: number) => m * 0.27 * Math.pow(ORBIT_RATIO, lvl - this.camLevel + this.camBias);

    for (const f of run.fx) {
      if (f.type === 'enter') this.onEnter(f.seg, now, run);
      else if (f.type === 'judge') this.onJudge(run, f.ev, scr);
      else if (f.type === 'stray') this.redAt = { x: this.lastBall.x, y: this.lastBall.y, a: 1 };
      else this.tapPulse = 1;
    }
    run.fx.length = 0;

    // --- section look, with ramps across the section (this is what drives the build-up)
    if (look.palette !== this.curPalName) { this.prevPal = PALETTES[this.curPalName] || PALETTES.deep; this.curPalName = look.palette; this.palSwitchT = now; }
    const target = PALETTES[look.palette] || PALETTES.deep;
    const pt = clamp((now - this.palSwitchT) / 350, 0, 1);
    const pal: Palette = pt >= 1 ? target : { bg0: mix(this.prevPal.bg0, target.bg0, pt), bg1: mix(this.prevPal.bg1, target.bg1, pt), ring: mix(this.prevPal.ring, target.ring, pt), acc: mix(this.prevPal.acc, target.acc, pt) };
    this.drain = ramp(look.drain, u, 0);
    const vignette = ramp(look.vignette, u, 0);
    const inDrop = t >= level.dropTime && seg.label === 'DROP';
    const energy = inDrop ? 1 : seg.label === 'BUILD' ? 0.6 : 0.3;
    const kick = level.energyAt('kick', t);
    const snare = level.energyAt('snare', t);
    const phase = beat - Math.floor(beat);
    const pulse = t < 0 ? 0 : Math.max(Math.exp(-phase * 5) * (0.3 + 0.5 * energy), kick * 0.8);

    // --- the ball's ring, the jump between rings, and the camera that follows it
    const ring = level.ringAt(beat);
    if (ring.idx !== this.ringIdx) {
      const prev = this.ringIdx >= 0 ? level.rings[this.ringIdx] : ring;
      if (this.ringIdx < 0) { this.camLevel = ring.lvl; this.camVel = 0; }
      this.jumpFrom = prev.lvl;
      this.jumpT = this.ringIdx < 0 ? 1 : 0;
      this.landed = this.ringIdx < 0;
      if (ring.planet !== prev.planet) { this.panT = 0; this.panFrom = { x: this.lastBall.x, y: this.lastBall.y }; this.trail = []; }
      if (Math.abs(ring.lvl - prev.lvl) > 1.5 && !rm) { this.shake = Math.max(this.shake, 0.7); this.burst(0, 0, 60, pal.acc, scr(ring.lvl) * 4); } // rocket
      this.ringIdx = ring.idx;
    }
    this.jumpT = Math.min(1, this.jumpT + dt / clamp(0.34 * level.spb, 0.11, 0.2)); // the jump lasts a third of a beat
    if (this.jumpT >= 1 && !this.landed) { this.landed = true; this.landPulse = 1; }
    this.landPulse = Math.max(0, this.landPulse - dt * 9);
    this.redAt.a = Math.max(0, this.redAt.a - dt * 4);
    // one critically damped spring follows the ball's ring: no sudden camera speed changes, rockets included
    const kCam = 170;
    for (let s = 0; s < 2; s++) {
      this.camVel += (kCam * (ring.lvl - this.camLevel) - 2 * Math.sqrt(kCam) * this.camVel) * (dt / 2);
      this.camLevel += this.camVel * (dt / 2);
    }
    this.panT = Math.min(1, this.panT + dt / 0.34);
    const pe = this.panT * this.panT * (3 - 2 * this.panT);
    // slingshot: each planet has its own centre; the camera pans from the old one to the new one
    const vecOf = (q: number): [number, number] => {
      let v = this.planetVec.get(q);
      if (!v) { const fr = level.rings.find((x) => x.planet === q); v = (fr && level.segments[fr.seg].sling) || [1, 0]; this.planetVec.set(q, v); }
      return v;
    };
    const planetOff = (q: number): [number, number] => {
      const v = vecOf(Math.max(q, ring.planet));
      const k = (q - (ring.planet - 1 + pe)) * m * 1.05;
      return [v[0] * k, v[1] * k];
    };
    this.camBias += ((seg.jump === 'in' ? 1.25 : 0) + (seg.mini ? -0.85 : 0) - this.camBias) * Math.min(1, dt * 3);
    this.flash = Math.max(0, this.flash - dt * 2.6);
    this.punch *= Math.exp(-dt * 7);
    this.shake = Math.max(0, this.shake - dt * 3);
    this.tapPulse = Math.max(0, this.tapPulse - dt * 7);
    this.flipAngle += (this.flipTarget - this.flipAngle) * Math.min(1, dt * 8);
    // never zoom so far that the ball's ring (and its gates) leaves the screen
    const extent = ring.shape === 'ellipse' ? 1.16 : ring.shape === 'square' ? 1.22 : 1;
    const zoomCap = 0.455 / (0.27 * Math.pow(ORBIT_RATIO, this.camBias) * extent);
    const zoom = Math.min(ramp(look.zoom, u, 1), zoomCap) * (1 + this.punch) * (1 + (rm ? 0 : kick * 0.022 * energy));
    const rot = rm ? 0 : ramp(look.rot, u, 0) * TWO_PI + this.flipAngle;
    const tilt = rm ? 0 : ramp(look.tilt, u, 0);

    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.background(pal, look.bg || 'stars', pulse, seg.blackout ? 0.9 : 0, Math.max(0, t), energy);

    const sx = rm ? 0 : (Math.random() - 0.5) * this.shake * 14;
    const sy = rm ? 0 : (Math.random() - 0.5) * this.shake * 14;
    c.save();
    c.translate(cx + sx, cy + sy);
    c.rotate(rot);
    c.scale(zoom, zoom * (1 - tilt));

    // --- equalizer round the core
    if (!seg.blackout) {
      const [eox, eoy] = planetOff(ring.planet);
      c.save();
      c.translate(eox, eoy);
      this.equalizer(look.eq || 'bars', pal, m * (0.085 - Math.max(0, this.camBias) * 0.02), m * 0.075, kick, snare, dt);
      c.restore();
    }
    this.kickWas = kick;

    // --- shockwaves
    for (let i = this.shocks.length - 1; i >= 0; i--) {
      const s = this.shocks[i];
      s.r += (s.max - s.r) * Math.min(1, dt * 4.5);
      s.alpha -= dt * 1.5;
      if (s.alpha <= 0) { this.shocks.splice(i, 1); continue; }
      c.lineWidth = s.w;
      c.strokeStyle = this.col(s.col, s.alpha);
      c.beginPath(); c.arc(0, 0, s.r, 0, TWO_PI); c.stroke();
    }

    // --- rings: the one the ball is on, the one it just left, and the next few it will jump to
    const next = run.engine.nextNote();
    const gateLen = m * 0.052;
    for (let k = Math.max(0, ring.idx - 1); k <= Math.min(level.rings.length - 1, ring.idx + 3); k++) {
      const r = level.rings[k];
      const rad = scr(r.lvl) * (1 + (k === ring.idx ? pulse * 0.02 : 0));
      if (rad > Math.max(this.w, this.h) * 0.8 || rad < m * 0.03) continue;
      const d = k - ring.idx;
      // only the next ring is previewed with its gates; the one after is a faint outline, anything further is hidden
      const ra = d < 0 ? 0.3 * (1 - this.jumpT) : d === 0 ? 1 : d === 1 ? 0.6 : d === 2 ? 0.12 : 0;
      if (ra <= 0.01) continue;
      const [rox, roy] = planetOff(r.planet);
      c.save();
      c.translate(rox, roy);
      c.lineWidth = d === 0 ? 2.5 + pulse * 2.5 : 1.5;
      c.strokeStyle = this.col(pal.ring, ra * (0.45 + (d === 0 ? pulse * 0.4 : 0)));
      c.shadowColor = this.col(pal.ring, 0.8);
      c.shadowBlur = d === 0 ? 8 + pulse * 16 : 0;
      this.ringPath(r, rad);
      c.stroke();
      c.shadowBlur = 0;
      if (r.reversed && d > 0) {
        // a reversed ring wears a spinning marker where the ball will land on it
        const [mx, my] = shapePoint(r.shape, r.a0);
        c.save(); c.translate(mx * rad, my * rad); c.rotate(now / 300);
        c.fillStyle = this.col([255, 255, 255], ra); c.fillRect(-5, -5, 10, 10); c.restore();
      }
      for (let i = r.first; i <= r.last && d <= 1; i++) {
        const n = level.notes[i];
        if (n.done) continue;
        const alpha = Math.pow(ra, 0.7); // gates stay fully visible until they are hit
        const [ux, uy] = shapePoint(r.shape, n.angle);
        const hyp = Math.hypot(ux, uy) || 1;
        const ox = ux / hyp;
        const oy = uy / hyp;
        const gx = ux * rad;
        const gy = uy * rad;
        const col = VOICE_COL[n.voice] || PINK;
        const len = gateLen * (n.accent ? 1.5 : 1) * (d === 0 ? 1 : 0.8);
        if (alpha > 0.01) {
          c.lineCap = 'round';
          if (n.kind === 'hop') {
            // hop: ONE thing to tap, a solid arrow, and the hazard it carries you over (a spike, or a sweeping beam)
            if (level.segments[n.seg].hazard === 'beam') {
              // the beam sweeps round to meet the ball in the middle of its hop
              const ab = n.angle + (r.dir * TWO_PI * (0.5 * HOP_BEATS + (n.beat + 0.5 * HOP_BEATS - beat))) / r.lap;
              const near = clamp(1 - (n.beat - beat) / 2, 0, 1);
              if (n.beat - beat < 2) {
                c.lineWidth = 5;
                c.strokeStyle = this.col(RED, alpha * (0.25 + 0.75 * near));
                c.shadowColor = this.col(RED, 0.9);
                c.shadowBlur = 14 * near;
                c.beginPath(); c.moveTo(Math.cos(ab) * rad * 0.3, Math.sin(ab) * rad * 0.3); c.lineTo(Math.cos(ab) * rad * 1.28, Math.sin(ab) * rad * 1.28); c.stroke();
                c.shadowBlur = 0;
              }
            } else {
              const [px, py] = shapePoint(r.shape, n.angle + (r.dir * TWO_PI * 0.5 * HOP_BEATS) / r.lap);
              const ph = Math.hypot(px, py) || 1;
              c.fillStyle = this.col(RED, alpha);
              c.beginPath();
              c.moveTo(px * rad + (px / ph) * len * 0.95, py * rad + (py / ph) * len * 0.95);
              c.lineTo(px * rad - (py / ph) * len * 0.34, py * rad + (px / ph) * len * 0.34);
              c.lineTo(px * rad + (py / ph) * len * 0.34, py * rad - (px / ph) * len * 0.34);
              c.fill();
            }
            c.fillStyle = this.col(col, alpha);
            c.shadowColor = this.col(col, alpha);
            c.shadowBlur = 12;
            c.beginPath();
            c.moveTo(gx + ox * len * 0.7, gy + oy * len * 0.7);
            c.lineTo(gx - oy * len * 0.5 - ox * len * 0.35, gy + ox * len * 0.5 - oy * len * 0.35);
            c.lineTo(gx + oy * len * 0.5 - ox * len * 0.35, gy - ox * len * 0.5 - oy * len * 0.35);
            c.fill();
            c.shadowBlur = 0;
          } else {
            if (n.accent) {
              c.lineWidth = 13;
              c.strokeStyle = `rgba(255,255,255,${0.8 * alpha})`;
              c.beginPath(); c.moveTo(gx - (ox * len) / 2, gy - (oy * len) / 2); c.lineTo(gx + (ox * len) / 2, gy + (oy * len) / 2); c.stroke();
            }
            c.lineWidth = 6;
            c.strokeStyle = this.col(col, alpha);
            c.shadowColor = this.col(col, alpha);
            c.shadowBlur = 12;
            c.beginPath(); c.moveTo(gx - (ox * len) / 2, gy - (oy * len) / 2); c.lineTo(gx + (ox * len) / 2, gy + (oy * len) / 2); c.stroke();
            c.shadowBlur = 0;
          }
        }
        if (alpha > 0.01 && n.kind === 'flip') {
          // flip gate: arrowheads on both sides, because tapping it turns the ball round
          c.fillStyle = `rgba(255,255,255,${alpha})`;
          for (const sg of [-1, 1]) {
            const tx = -oy * sg;
            const ty = ox * sg;
            c.beginPath();
            c.moveTo(gx + tx * len, gy + ty * len);
            c.lineTo(gx + tx * len * 0.42 + ox * len * 0.34, gy + ty * len * 0.42 + oy * len * 0.34);
            c.lineTo(gx + tx * len * 0.42 - ox * len * 0.34, gy + ty * len * 0.42 - oy * len * 0.34);
            c.fill();
          }
        } else if (alpha > 0.01 && n.kind === 'portal') {
          // portal: a violet ring on the gate and its twin on the far side, where the ball comes out
          c.lineWidth = 3;
          c.strokeStyle = this.col([200, 150, 255], alpha);
          c.beginPath(); c.arc(gx, gy, len * 0.66, 0, TWO_PI); c.stroke();
          c.beginPath(); c.arc(-gx, -gy, len * 0.5, 0, TWO_PI); c.stroke();
        }
        const after = level.rings[r.idx + 1];
        if (alpha > 0.01 && n.exit && after && after.planet !== r.planet) {
          // launch gate: a gold arrow along the slingshot's flight path
          const v = vecOf(after.planet);
          const vl = Math.hypot(v[0], v[1]) || 1;
          c.lineWidth = 4;
          c.strokeStyle = this.col(GOLD, alpha);
          c.beginPath(); c.moveTo(gx, gy); c.lineTo(gx + (v[0] / vl) * len * 2.2, gy + (v[1] / vl) * len * 2.2); c.stroke();
          c.beginPath(); c.arc(gx + (v[0] / vl) * len * 2.2, gy + (v[1] / vl) * len * 2.2, 4, 0, TWO_PI); c.fillStyle = this.col(GOLD, alpha); c.fill();
        }
        // approach circle on the very next gate: it closes on the gate exactly on the beat
        if (n === next && t <= n.t) {
          const rem = clamp((n.t - t) / (1.5 * level.spb), 0, 1);
          c.lineWidth = 2.5;
          c.strokeStyle = this.col(col, 0.85 * (1 - rem * 0.6));
          c.beginPath(); c.arc(gx, gy, gateLen * (0.62 + 2.2 * rem), 0, TWO_PI); c.stroke();
        }
      }
      c.restore();
    }

    // --- ball: rides the ring's shape, slides between rings on a jump, arcs over spikes on a hop
    // the jump is a short arc: ease off the old ring, overshoot a little, settle on the new one
    const jp = this.jumpT;
    const je = jp * jp * (3 - 2 * jp);
    const rFrom = scr(this.jumpFrom);
    const rTo = scr(ring.lvl);
    const brad = lerp(rFrom, rTo, je) + Math.sin(Math.PI * jp) * (rTo - rFrom) * 0.2;
    // reversals turn round smoothly: angular speed ramps through zero over a few frames either side of the jump
    let ang = level.angleOn(ring, beat);
    const wOf = (q: Ring) => (q.dir * TWO_PI) / (q.lap * level.spb);
    const EASE = 0.09;
    const prv = level.rings[ring.idx - 1];
    const nxt = level.rings[ring.idx + 1];
    if (ring.reversed && prv) { const tau = t - ring.b0 * level.spb; if (tau >= 0 && tau < EASE / 2) ang += ((wOf(ring) - wOf(prv)) * Math.pow(EASE / 2 - tau, 2)) / (2 * EASE); }
    if (nxt && nxt.reversed) { const tau = ring.exitBeat * level.spb - t; if (tau >= 0 && tau < EASE / 2) ang += ((wOf(nxt) - wOf(ring)) * Math.pow(EASE / 2 - tau, 2)) / (2 * EASE); }
    const [bx0, by0] = shapePoint(ring.shape, ang);
    let hop = 1;
    if (beat < this.hopUntil) hop = 1 + 0.2 * Math.sin(Math.PI * (1 - (this.hopUntil - beat) / HOP_BEATS));
    const [pox, poy] = planetOff(ring.planet);
    let bx = bx0 * brad * hop + pox;
    let by = by0 * brad * hop + poy;
    if (this.panT < 1) { bx = lerp(this.panFrom.x, bx, pe); by = lerp(this.panFrom.y, by, pe); } // the slingshot flight is a straight line
    this.lastBall = { x: bx, y: by };
    this.trail.push({ x: bx, y: by });
    if (this.trail.length > 12) this.trail.shift();
    for (let k = 0; k < this.trail.length - 1; k++) {
      c.fillStyle = this.col(orbColour(save.skin), (k / this.trail.length) * 0.35);
      c.beginPath(); c.arc(this.trail[k].x, this.trail[k].y, m * 0.016 * (k / this.trail.length), 0, TWO_PI); c.fill();
    }
    this.ball(bx, by, m * 0.018 * (1 + pulse * 0.2 + this.tapPulse * 0.35 + this.landPulse * 0.3), orbColour(save.skin));
    if (this.redAt.a > 0) { // a miss (or a stray tap) flashes red right where it happened
      c.fillStyle = `rgba(255,60,70,${0.55 * this.redAt.a})`;
      c.beginPath(); c.arc(this.redAt.x, this.redAt.y, m * 0.05 * (1.4 - this.redAt.a * 0.4), 0, TWO_PI); c.fill();
    }

    // --- particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      if (p.life >= p.max) { this.particles.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.96; p.vy *= 0.96;
      c.fillStyle = this.col(p.col, 1 - p.life / p.max);
      c.fillRect(p.x, p.y, p.size, p.size);
    }
    c.restore();

    // --- screen-space overlays
    if (vignette > 0) {
      const g = c.createRadialGradient(cx, cy, m * lerp(0.75, 0.3, vignette), cx, cy, Math.max(this.w, this.h) * 0.75);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, `rgba(0,0,0,${0.55 + 0.4 * vignette})`);
      c.fillStyle = g;
      c.fillRect(0, 0, this.w, this.h);
    }
    if (seg.count && t >= seg.t0) {
      const k = Math.floor((t - seg.t0) / level.spb);
      const f = (t - seg.t0) / level.spb - k;
      const label = ['3', '2', '1', ''][Math.min(3, k)];
      if (label) this.text(label, cx, cy, m * (0.26 - 0.09 * f), [255, 255, 255], 1 - f * 0.8);
    }
    // heads-up before the world changes: label plus a pulsing frame in the next section's colour, two beats ahead
    const nextSeg = level.segments[seg.index + 1];
    if (nextSeg && nextSeg.warn && !seg.count && t >= 0 && nextSeg.t0 - t <= 2 * level.spb) {
      const np = PALETTES[nextSeg.look.palette] || PALETTES.deep;
      const bp = Math.exp(-phase * 4);
      const edge = 5 + 9 * bp;
      c.fillStyle = `rgba(${np.ring[0]},${np.ring[1]},${np.ring[2]},${0.35 + 0.5 * bp})`;
      c.fillRect(0, 0, this.w, edge); c.fillRect(0, this.h - edge, this.w, edge); c.fillRect(0, 0, edge, this.h); c.fillRect(this.w - edge, 0, edge, this.h);
      this.text(`NEXT  ${nextSeg.warn}`, cx, Math.max(104, cy - m * 0.47), Math.max(15, Math.min(22, this.w * 0.05)) * (1 + 0.12 * bp), [255, 255, 255], 0.9);
    }
    if (this.flash > 0) { c.fillStyle = `rgba(255,255,255,${Math.min(rm ? 0.2 : 0.85, this.flash)})`; c.fillRect(0, 0, this.w, this.h); }
    const below = Math.min(this.h - 104, cy + m * 0.46);
    if (t < run.startAt && run.state === 'playing') this.text('GET READY', cx, below, m * 0.05, [255, 255, 255], 0.9);
    if (run.state === 'resuming') this.text(String(Math.max(1, Math.ceil((run.resumeAt - now) / 400))), cx, cy, m * 0.2, [255, 255, 255], 0.9);
    const lj = run.lastJudge;
    if (lj && !seg.count && run.state === 'playing') {
      const age = (now - lj.at) / 1000;
      if (age < 0.5) {
        const al = 1 - age / 0.5;
        this.text(lj.label, cx, below, m * (lj.judge === 'perfect' ? 0.058 : 0.048) * (1 + (1 - al) * 0.15), JUDGE_COL[lj.judge], al);
        if (lj.err !== null && lj.judge !== 'perfect' && lj.judge !== 'miss') this.text(lj.err > 0 ? 'LATE' : 'EARLY', cx, below + m * 0.05, m * 0.03, [255, 255, 255], al * 0.8);
      }
    }
    if (this.banner && now < this.banner.until) {
      const al = clamp((this.banner.until - now) / 500, 0, 1);
      c.font = `800 ${Math.max(14, Math.min(20, this.w * 0.042))}px system-ui, sans-serif`;
      const tw = c.measureText(this.banner.text).width;
      const by2 = Math.max(100, cy - m * 0.47);
      c.fillStyle = `rgba(8,12,30,${0.8 * al})`;
      c.beginPath();
      if (c.roundRect) c.roundRect(cx - tw / 2 - 16, by2 - 18, tw + 32, 36, 18); else c.rect(cx - tw / 2 - 16, by2 - 18, tw + 32, 36);
      c.fill();
      c.fillStyle = `rgba(255,255,255,${al})`;
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(this.banner.text, cx, by2);
    }
    if (save.errorBar) this.errorBar(run, now);
  }

  private text(s: string, x: number, y: number, size: number, col: RGB, alpha: number): void {
    const c = this.ctx;
    c.font = `900 ${Math.round(size)}px system-ui, -apple-system, sans-serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.shadowColor = `rgba(${col[0]},${col[1]},${col[2]},${alpha})`;
    c.shadowBlur = size * 0.4;
    c.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${alpha})`;
    c.fillText(s, x, y);
    c.shadowBlur = 0;
  }

  /** osu!-style hit-error bar: each tap leaves a tick, left = early, right = late. */
  private errorBar(run: Run, now: number): void {
    const c = this.ctx;
    const w = WINDOW;
    const bw = Math.min(this.w * 0.72, 340);
    const x0 = this.w / 2 - bw / 2;
    const y = this.h - 46;
    const px = (sec: number) => this.w / 2 + (clamp(sec, -w.o, w.o) / w.o) * (bw / 2);
    const zone = (lim: number, col: RGB, a: number) => { c.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${a})`; c.fillRect(px(-lim), y - 3, px(lim) - px(-lim), 6); };
    zone(w.o, JUDGE_COL.good, 0.35);
    zone(w.g, JUDGE_COL.great, 0.45);
    zone(w.p, JUDGE_COL.perfect, 0.7);
    c.fillStyle = 'rgba(255,255,255,0.9)';
    c.fillRect(this.w / 2 - 1, y - 9, 2, 18);
    let sum = 0;
    let n = 0;
    for (const e of run.recentErrs) {
      const age = (now - e.at) / 1000;
      if (age > 4) continue;
      const col = JUDGE_COL[e.judge];
      c.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${1 - age / 4})`;
      c.fillRect(px(e.err) - 1.5, y - 11, 3, 22);
      sum += e.err; n++;
    }
    if (n >= 3) {
      const mx = px(sum / n);
      c.fillStyle = '#ffffff';
      c.beginPath(); c.moveTo(mx, y - 14); c.lineTo(mx - 5, y - 22); c.lineTo(mx + 5, y - 22); c.fill();
    }
    c.font = '700 9px system-ui, sans-serif';
    c.fillStyle = 'rgba(255,255,255,0.5)';
    c.textBaseline = 'middle';
    c.textAlign = 'right'; c.fillText('EARLY', x0 - 6, y);
    c.textAlign = 'left'; c.fillText('LATE', x0 + bw + 6, y);
  }

  private onEnter(seg: Segment, now: number, run: Run): void {
    const R = Math.min(this.w, this.h) * 0.27;
    if (seg.teach && !save.teachSeen[seg.id]) this.banner = { text: seg.teach, until: now + 4200 };
    else if (seg.enter === 'drop') this.banner = { text: 'DROP   ×2 SCORE', until: now + 1600 };
    if (seg.look.flip && !save.reducedMotion) this.flipTarget += Math.PI;
    const pal = PALETTES[seg.look.palette] || PALETTES.deep;
    if (seg.enter === 'drop') {
      // the release: everything the build-up wound up lets go on the first beat
      this.flash = 1;
      this.punch = save.reducedMotion ? 0 : -0.16;
      this.shake = 1;
      for (let k = 0; k < 3; k++) this.shocks.push({ r: R * (0.2 + k * 0.25), max: R * (2.6 + k * 0.9), alpha: 0.95 - k * 0.2, col: k === 1 ? [255, 255, 255] : k === 0 ? CYAN : PINK, w: 6 - k });
      this.burst(0, 0, 90, CYAN, R * 4);
      this.burst(0, 0, 90, PINK, R * 4);
    } else if (seg.enter === 'pulse') {
      this.flash = 0.35;
      this.punch = save.reducedMotion ? 0 : -0.06;
      this.shocks.push({ r: R * 0.3, max: R * 2.4, alpha: 0.8, col: pal.ring, w: 4 });
      this.burst(0, 0, 40, pal.acc, R * 3);
    } else if (seg.enter === 'flash') {
      this.flash = 0.8;
      this.shake = 0.6;
      this.shocks.push({ r: R * 0.3, max: R * 3.2, alpha: 0.9, col: [255, 255, 255], w: 5 });
      this.burst(0, 0, 80, pal.acc, R * 4);
    } else if (run.time > 0.5) {
      this.shocks.push({ r: R * 0.5, max: R * 1.7, alpha: 0.4, col: pal.ring, w: 2 });
    }
  }

  private onJudge(run: Run, ev: JEvent, scr: (lvl: number) => number): void {
    const n = ev.note;
    const ring = run.level.rings[n.ring];
    const rad = scr(ring.lvl);
    const [ux, uy] = shapePoint(ring.shape, n.angle);
    const x = ux * rad;
    const y = uy * rad;
    if (ev.judge === 'miss') {
      this.shake = Math.max(this.shake, 0.45);
      this.burst(x, y, 10, RED, rad * 1.2);
      this.redAt = { x, y, a: 1 };
      return;
    }
    const col = VOICE_COL[n.voice] || PINK;
    if (n.kind === 'hop') this.hopUntil = n.beat + HOP_BEATS;
    this.burst(x, y, ev.judge === 'perfect' ? 16 : 7, ev.judge === 'perfect' ? JUDGE_COL.perfect : col, rad * (ev.judge === 'perfect' ? 1.6 : 1));
    if (n.exit) this.shocks.push({ r: rad, max: rad * ORBIT_RATIO, alpha: 0.4, col, w: 2 }); // the jump to the next ring
    if (n.accent) {
      // big hits land harder: extra sparks, a wave off the ring and a short kick of the camera
      this.burst(x, y, 26, col, rad * 2.4);
      this.shocks.push({ r: rad, max: rad * 1.7, alpha: 0.7, col, w: 4 });
      this.flash = Math.max(this.flash, 0.16);
      if (!save.reducedMotion) { this.punch = Math.min(this.punch, -0.035); this.shake = Math.max(this.shake, 0.35); }
    }
  }
}
