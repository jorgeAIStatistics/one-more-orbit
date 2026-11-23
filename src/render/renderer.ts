import type { Run } from '../game/run';
import type { RNote, Segment } from '../game/types';
import { RELEASE_SCALE } from '../game/rules';
import { save } from '../save';

type RGB = [number, number, number];
interface Palette { bg0: RGB; bg1: RGB; ring: RGB; acc: RGB }

/** Section looks. Gate colours never change (cyan = left, pink = right, white = either): only the world around them does. */
const PALETTES: Record<string, Palette> = {
  deep: { bg0: [10, 18, 52], bg1: [2, 4, 14], ring: [80, 130, 255], acc: [130, 190, 255] },
  ocean: { bg0: [6, 38, 60], bg1: [2, 8, 20], ring: [40, 210, 225], acc: [120, 255, 240] },
  violet: { bg0: [40, 16, 72], bg1: [8, 3, 22], ring: [176, 96, 255], acc: [220, 170, 255] },
  split: { bg0: [16, 24, 58], bg1: [6, 4, 20], ring: [150, 165, 255], acc: [255, 255, 255] },
  dusk: { bg0: [58, 12, 30], bg1: [10, 2, 10], ring: [255, 128, 96], acc: [255, 190, 120] },
  neon: { bg0: [62, 10, 86], bg1: [10, 2, 30], ring: [255, 70, 210], acc: [255, 150, 240] },
  aqua: { bg0: [6, 60, 82], bg1: [2, 10, 26], ring: [0, 235, 255], acc: [160, 255, 250] },
  gold: { bg0: [84, 48, 8], bg1: [26, 6, 22], ring: [255, 207, 64], acc: [255, 240, 170] },
  hot: { bg0: [96, 16, 36], bg1: [34, 4, 44], ring: [255, 255, 255], acc: [255, 220, 240] }
};
const CYAN: RGB = [0, 245, 255];
const PINK: RGB = [255, 42, 133];
const WHITE: RGB = [255, 244, 214];
const RED: RGB = [255, 72, 60];
const JUDGE_COL: Record<string, RGB> = { perfect: [255, 214, 90], great: [0, 245, 255], good: [196, 181, 253], miss: [255, 90, 120] };
const TWO_PI = Math.PI * 2;

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
  private lanePos = 0;
  private spinPulse = 0;
  private sideFlash = { L: 0, R: 0 };
  private drain = 0;
  private stars: Array<{ a: number; d: number; s: number }> = [];
  private trails: Array<Array<{ x: number; y: number }>> = [[], []];
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

  reset(): void {
    this.particles = [];
    this.shocks = [];
    this.flash = this.punch = this.shake = this.lanePos = this.spinPulse = this.drain = 0;
    this.trails = [[], []];
    this.banner = null;
    this.palSwitchT = -99;
  }

  private col(c: RGB, a = 1): string {
    // "colours draining" in the build-up: pull everything toward grey
    const g = c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11;
    const d = this.drain;
    return `rgba(${(lerp(c[0], g, d)) | 0},${(lerp(c[1], g, d)) | 0},${(lerp(c[2], g, d)) | 0},${a})`;
  }

  private burst(x: number, y: number, n: number, col: RGB, speed: number): void {
    if (save.reducedMotion) n = Math.ceil(n / 3);
    for (let i = 0; i < n && this.particles.length < 260; i++) {
      const a = Math.random() * TWO_PI;
      const v = speed * (0.3 + Math.random() * 0.7);
      this.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: 0.35 + Math.random() * 0.35, col, size: 1.5 + Math.random() * 2.5 });
    }
  }

  /** Idle picture behind the menus. */
  drawIdle(now: number): void {
    const c = this.ctx;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.drain = 0;
    this.background(PALETTES.deep, 0.15 + 0.1 * Math.sin(now / 900), 0, now / 1000, 0.3);
    const cx = this.w / 2;
    const cy = this.h * 0.47;
    const R = Math.min(this.w, this.h) * 0.36;
    c.lineWidth = 2;
    c.strokeStyle = this.col(PALETTES.deep.ring, 0.25);
    c.beginPath(); c.arc(cx, cy, R, 0, TWO_PI); c.stroke();
    const a = now / 1400;
    this.ball(cx + Math.cos(a) * R, cy + Math.sin(a) * R, R * 0.05, CYAN);
  }

  /** Ball crossing a gate at the top of a ring; used by the visual-offset calibration. */
  drawMetronome(now: number, phase: number): void {
    const c = this.ctx;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.drain = 0;
    this.background(PALETTES.deep, 0.2, 0, now / 1000, 0.3);
    const cx = this.w / 2;
    const cy = this.h * 0.36;
    const R = Math.min(this.w, this.h) * 0.2;
    c.lineWidth = 3;
    c.strokeStyle = this.col(PALETTES.deep.ring, 0.5);
    c.beginPath(); c.arc(cx, cy, R, 0, TWO_PI); c.stroke();
    this.gate(cx, cy, R, -Math.PI / 2, R * 0.3, WHITE, 1);
    const a = -Math.PI / 2 + phase * TWO_PI;
    this.ball(cx + Math.cos(a) * R, cy + Math.sin(a) * R, R * 0.1, CYAN);
  }

  private background(p: Palette, pulse: number, dark: number, time: number, energy: number): void {
    const c = this.ctx;
    const cx = this.w / 2;
    const cy = this.h * 0.47;
    const g = c.createRadialGradient(cx, cy, 0, cx, cy, Math.max(this.w, this.h) * 0.75);
    const k = 1 + pulse * 0.5;
    g.addColorStop(0, this.col([p.bg0[0] * k, p.bg0[1] * k, p.bg0[2] * k]));
    g.addColorStop(1, this.col(p.bg1));
    c.fillStyle = g;
    c.fillRect(0, 0, this.w, this.h);
    // stars drift outward faster when the music is intense
    const span = Math.max(this.w, this.h) * 0.75;
    for (const s of this.stars) {
      const d = (s.d + time * (0.01 + energy * 0.12) * s.s) % 1;
      const x = cx + Math.cos(s.a) * d * span;
      const y = cy + Math.sin(s.a) * d * span;
      c.fillStyle = this.col(p.acc, (0.15 + 0.5 * d) * (0.6 + pulse * 0.4));
      const len = save.reducedMotion ? 0 : energy * 14 * d;
      if (len > 2) { c.fillRect(x, y, Math.cos(s.a) * len || 1, Math.sin(s.a) * len || 1); c.fillRect(x, y, s.s, s.s); }
      else c.fillRect(x, y, s.s, s.s);
    }
    if (dark > 0) { c.fillStyle = `rgba(0,0,0,${dark})`; c.fillRect(0, 0, this.w, this.h); }
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

  private gate(cx: number, cy: number, r: number, ang: number, len: number, col: RGB, alpha: number): void {
    const c = this.ctx;
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);
    c.lineCap = 'round';
    c.lineWidth = Math.max(4, len * 0.26);
    c.strokeStyle = this.col(col, alpha);
    c.shadowColor = this.col(col, alpha);
    c.shadowBlur = 12;
    c.beginPath();
    c.moveTo(cx + ca * (r - len / 2), cy + sa * (r - len / 2));
    c.lineTo(cx + ca * (r + len / 2), cy + sa * (r + len / 2));
    c.stroke();
    c.shadowBlur = 0;
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

    // --- react to what happened this frame
    for (const f of run.fx) {
      if (f.type === 'enter') this.onEnter(f.seg, now, run);
      else if (f.type === 'judge') this.onJudge(run, f.ev.note, f.ev.judge, f.ev.kind);
      else if (f.type === 'spin') this.spinPulse = 1;
      else if (f.type === 'press') this.sideFlash[f.side] = 1;
    }
    run.fx.length = 0;

    // --- section look, with ramps across the section (this is what drives the build-up)
    if (look.palette !== this.curPalName) { this.prevPal = PALETTES[this.curPalName] || PALETTES.deep; this.curPalName = look.palette; this.palSwitchT = now; }
    const target = PALETTES[look.palette] || PALETTES.deep;
    const pt = clamp((now - this.palSwitchT) / 350, 0, 1);
    const pal: Palette = pt >= 1 ? target : { bg0: mix(this.prevPal.bg0, target.bg0, pt), bg1: mix(this.prevPal.bg1, target.bg1, pt), ring: mix(this.prevPal.ring, target.ring, pt), acc: mix(this.prevPal.acc, target.acc, pt) };
    this.drain = ramp(look.drain, u, 0);
    const vignette = ramp(look.vignette, u, 0);
    const ringScale = ramp(look.ring, u, 1);
    const zoom = ramp(look.zoom, u, 1) * (1 + this.punch);
    const rot = rm ? 0 : ramp(look.rot, u, 0) * TWO_PI;
    const phase = beat - Math.floor(beat);
    const inDrop = t >= level.dropTime;
    const energy = seg.mode === 'spinner' ? 0.8 : inDrop ? 1 : seg.mode === 'dodge' || seg.id === 'rush' ? 0.6 : 0.3;
    const pulse = t < 0 ? 0 : Math.exp(-phase * 5) * (0.35 + 0.65 * energy);

    // --- decay effects
    this.flash = Math.max(0, this.flash - dt * 2.6);
    this.punch *= Math.exp(-dt * 7);
    this.shake = Math.max(0, this.shake - dt * 3);
    this.spinPulse = Math.max(0, this.spinPulse - dt * 8);
    this.sideFlash.L = Math.max(0, this.sideFlash.L - dt * 6);
    this.sideFlash.R = Math.max(0, this.sideFlash.R - dt * 6);
    const lane = run.engine.laneAt(run.time);
    this.lanePos += (lane - this.lanePos) * Math.min(1, dt * 28);

    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.background(pal, pulse, seg.blackout ? 0.9 : 0, Math.max(0, t), energy);

    const cx = this.w / 2;
    const cy = this.h * 0.47;
    const R = Math.min(this.w, this.h) * 0.36;
    const sx = rm ? 0 : (Math.random() - 0.5) * this.shake * 14;
    const sy = rm ? 0 : (Math.random() - 0.5) * this.shake * 14;

    c.save();
    c.translate(cx + sx, cy + sy);
    c.rotate(rot);
    c.scale(zoom, zoom);

    // --- ring geometry for the current mode
    const dual = seg.mode === 'dual';
    const dodge = seg.mode === 'dodge';
    const split = dual ? ease((t - seg.t0) / 0.35 + (level.segments[seg.index - 1]?.mode === 'dual' ? 1 : 0)) : 0;
    const rInner = R * lerp(ringScale, 0.64, split);
    const rOuter = R * lerp(ringScale, 1.02, split);
    const laneR = [R * 0.82, R * 1.0];
    const radiusOf = (n: RNote): number => (dual || level.segments[n.seg].mode === 'dual' ? (n.ring === 1 ? rOuter : rInner) : R * ringScale);
    const ringGlow = 0.5 + pulse * 0.5;

    c.lineWidth = 2 + pulse * 2.5;
    if (dodge) {
      for (const lr of laneR) { c.strokeStyle = this.col(pal.ring, 0.3 * ringGlow + 0.1); c.beginPath(); c.arc(0, 0, lr, 0, TWO_PI); c.stroke(); }
    } else {
      c.strokeStyle = this.col(dual ? CYAN : pal.ring, 0.55 * ringGlow + 0.15);
      c.shadowColor = this.col(dual ? CYAN : pal.ring, 0.8);
      c.shadowBlur = 10 + pulse * 14;
      c.beginPath(); c.arc(0, 0, rInner, 0, TWO_PI); c.stroke();
      if (dual) {
        c.strokeStyle = this.col(PINK, 0.55 * ringGlow + 0.15);
        c.shadowColor = this.col(PINK, 0.8);
        c.beginPath(); c.arc(0, 0, rOuter, 0, TWO_PI); c.stroke();
      }
      c.shadowBlur = 0;
    }

    // --- shockwaves (in the camera's space so they ride the zoom)
    for (let i = this.shocks.length - 1; i >= 0; i--) {
      const s = this.shocks[i];
      s.r += (s.max - s.r) * Math.min(1, dt * 4.5);
      s.alpha -= dt * 1.5;
      if (s.alpha <= 0) { this.shocks.splice(i, 1); continue; }
      c.lineWidth = s.w;
      c.strokeStyle = this.col(s.col, s.alpha);
      c.beginPath(); c.arc(0, 0, s.r, 0, TWO_PI); c.stroke();
    }

    // --- reverse markers
    for (let ring = 0; ring < (dual ? 2 : 1); ring++) {
      for (const rb of level.reversals(ring)) {
        const ahead = rb - beat;
        if (ahead <= 0 || ahead > 3) continue;
        const a = level.angleAt(ring, rb);
        const rr = ring === 1 ? rOuter : dodge ? lerp(laneR[0], laneR[1], this.lanePos) : rInner;
        c.fillStyle = this.col(WHITE, 0.8 * (1 - ahead / 3));
        c.save();
        c.translate(Math.cos(a) * rr, Math.sin(a) * rr);
        c.rotate(a + Math.PI / 4);
        c.fillRect(-5, -5, 10, 10);
        c.restore();
      }
    }

    // --- notes
    const gateLen = R * 0.2;
    for (const n of run.notes) {
      const lookBeats = Math.min(level.segments[n.seg].lap * 0.75, 6);
      const lookSec = lookBeats * level.spb;
      if (n.t - t > lookSec) break;
      if (n.t1 < t - 0.3) continue;
      const rem = clamp((n.t - t) / lookSec, 0, 1);
      const appear = clamp((1 - rem) * 5, 0, 1);
      if (n.kind === 'spin') continue;
      if (n.kind === 'haz') {
        if (t - n.t > 0.22) continue;
        const a = level.angleAt(0, n.beat);
        const half = (TWO_PI * 0.16) / level.segments[n.seg].lap;
        const near = clamp(1 - (n.t - t) / level.spb, 0, 1);
        const after = t > n.t ? clamp((t - n.t) / 0.22, 0, 1) : 0;
        c.lineCap = 'butt';
        c.lineWidth = R * 0.13 * (1 + (after > 0 ? (1 - after) * 0.6 : 0));
        c.strokeStyle = this.col(RED, (0.25 + 0.7 * near) * appear * (1 - after));
        c.shadowColor = this.col(RED, 0.9);
        c.shadowBlur = near * 16;
        c.beginPath(); c.arc(0, 0, laneR[n.lane], a - half, a + half); c.stroke();
        c.shadowBlur = 0;
        continue;
      }
      const col = n.hand === 'L' ? CYAN : n.hand === 'R' ? PINK : WHITE;
      const rr = radiusOf(n);
      if (n.kind === 'hold') {
        if (n.tailDone && t - n.t1 > 0.05) continue;
        const held = n.heldBy !== null;
        const b0 = held ? Math.max(n.beat, beat) : n.beat;
        const b1 = Math.min(n.beat1, beat + lookBeats);
        if (b1 > b0) {
          c.lineCap = 'round';
          c.lineWidth = R * (held ? 0.12 : 0.085);
          c.strokeStyle = this.col(col, (held ? 0.85 : n.headDone && !held ? 0.2 : 0.5) * appear);
          c.shadowColor = this.col(col, 0.9);
          c.shadowBlur = held ? 18 : 0;
          c.beginPath();
          const steps = Math.max(2, Math.ceil((b1 - b0) * 8));
          for (let i = 0; i <= steps; i++) {
            const a = level.angleAt(n.ring, lerp(b0, b1, i / steps));
            if (i === 0) c.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); else c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
          }
          c.stroke();
          c.shadowBlur = 0;
        }
        if (n.beat1 <= beat + lookBeats && !n.tailDone) this.gate(0, 0, rr, level.angleAt(n.ring, n.beat1), gateLen * 0.8, col, 0.9 * appear);
        if (n.headDone) continue;
      } else if (n.headDone) continue;
      const a = level.angleAt(n.ring, n.beat);
      const late = t > n.t ? clamp(1 - (t - n.t) / 0.12, 0, 1) : 1;
      this.gate(0, 0, rr, a, gateLen, col, appear * late);
      // approach ring closes on the gate as its beat arrives
      const gx = Math.cos(a) * rr;
      const gy = Math.sin(a) * rr;
      c.lineWidth = 2;
      c.strokeStyle = this.col(col, 0.7 * appear * (1 - rem) * late);
      c.beginPath(); c.arc(gx, gy, R * 0.07 * (1 + 1.6 * rem), 0, TWO_PI); c.stroke();
    }

    // --- balls and trails
    const balls: Array<{ a: number; r: number; col: RGB }> = [];
    if (dodge) balls.push({ a: level.angleAt(0, beat), r: lerp(laneR[0], laneR[1], this.lanePos), col: WHITE });
    else {
      balls.push({ a: level.angleAt(0, beat), r: rInner, col: CYAN });
      if (dual) balls.push({ a: level.angleAt(1, beat), r: rOuter, col: PINK });
    }
    balls.forEach((b, i) => {
      const x = Math.cos(b.a) * b.r;
      const y = Math.sin(b.a) * b.r;
      const tr = this.trails[i];
      tr.push({ x, y });
      if (tr.length > 12) tr.shift();
      for (let k = 0; k < tr.length - 1; k++) {
        c.fillStyle = this.col(b.col, (k / tr.length) * 0.35);
        c.beginPath(); c.arc(tr[k].x, tr[k].y, R * 0.045 * (k / tr.length), 0, TWO_PI); c.fill();
      }
      this.ball(x, y, R * 0.05 * (1 + pulse * 0.25), b.col);
    });
    if (!dual) this.trails[1].length = 0;

    // --- particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      if (p.life >= p.max) { this.particles.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.96; p.vy *= 0.96;
      c.fillStyle = this.col(p.col, 1 - p.life / p.max);
      c.fillRect(p.x, p.y, p.size, p.size);
    }

    // --- spinner meter
    const spin = run.engine.activeSpinner(run.time);
    if (spin) {
      const frac = clamp(spin.got / Math.max(1, spin.need), 0, 1);
      const sr = R * (0.36 + this.spinPulse * 0.03);
      c.lineWidth = R * 0.07;
      c.strokeStyle = 'rgba(255,255,255,0.14)';
      c.beginPath(); c.arc(0, 0, sr, 0, TWO_PI); c.stroke();
      c.strokeStyle = frac >= 1 ? 'rgba(255,214,90,1)' : 'rgba(255,255,255,0.95)';
      c.shadowColor = '#ffffff'; c.shadowBlur = 10 + frac * 24;
      c.beginPath(); c.arc(0, 0, sr, -Math.PI / 2, -Math.PI / 2 + frac * TWO_PI); c.stroke();
      c.shadowBlur = 0;
    }
    c.restore();

    // --- screen-space overlays
    if (spin) this.text(spin.got >= spin.need ? 'CHARGED!' : 'SPIN!', cx, cy, R * 0.16, spin.got >= spin.need ? JUDGE_COL.perfect : [255, 255, 255], 1);
    if (vignette > 0) {
      const g = c.createRadialGradient(cx, cy, Math.min(this.w, this.h) * lerp(0.75, 0.3, vignette), cx, cy, Math.max(this.w, this.h) * 0.75);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, `rgba(0,0,0,${0.55 + 0.4 * vignette})`);
      c.fillStyle = g;
      c.fillRect(0, 0, this.w, this.h);
    }
    for (const side of ['L', 'R'] as const) {
      const f = this.sideFlash[side];
      if (f <= 0) continue;
      const x0 = side === 'L' ? 0 : this.w;
      const g = c.createLinearGradient(x0, 0, side === 'L' ? this.w * 0.22 : this.w * 0.78, 0);
      const cc = side === 'L' ? CYAN : PINK;
      g.addColorStop(0, `rgba(${cc[0]},${cc[1]},${cc[2]},${0.22 * f})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g;
      c.fillRect(side === 'L' ? 0 : this.w * 0.78, 0, this.w * 0.22, this.h);
    }
    if (seg.count && t >= seg.t0) {
      const k = Math.floor((t - seg.t0) / level.spb);
      const f = (t - seg.t0) / level.spb - k;
      const label = ['3', '2', '1', ''][Math.min(3, k)];
      if (label) this.text(label, cx, cy, R * (0.7 - 0.25 * f), [255, 255, 255], 1 - f * 0.8);
    }
    if (this.flash > 0) { c.fillStyle = `rgba(255,255,255,${Math.min(rm ? 0.2 : 0.85, this.flash)})`; c.fillRect(0, 0, this.w, this.h); }
    if (t < 0 && run.state === 'playing') this.text('GET READY', cx, cy, R * 0.13, [255, 255, 255], 0.9);
    if (run.state === 'resuming') this.text(String(Math.max(1, Math.ceil((run.resumeAt - now) / 400))), cx, cy, R * 0.5, [255, 255, 255], 0.9);

    // judgement word in the middle of the ring
    const lj = run.lastJudge;
    if (lj && !spin && !seg.count && run.state === 'playing') {
      const age = (now - lj.at) / 1000;
      if (age < 0.5) {
        const al = 1 - age / 0.5;
        const word = lj.wrongSide ? 'WRONG SIDE' : lj.judge.toUpperCase();
        this.text(word, cx, cy - R * 0.04, R * (lj.judge === 'perfect' ? 0.15 : 0.12) * (1 + (1 - al) * 0.15), JUDGE_COL[lj.judge], al);
        if (lj.err !== null && lj.judge !== 'perfect' && lj.judge !== 'miss') this.text(lj.err > 0 ? 'LATE' : 'EARLY', cx, cy + R * 0.12, R * 0.07, [255, 255, 255], al * 0.8);
      }
    }
    if (this.banner && now < this.banner.until) {
      const al = clamp((this.banner.until - now) / 500, 0, 1);
      c.font = `800 ${Math.max(14, Math.min(20, this.w * 0.042))}px system-ui, sans-serif`;
      const tw = c.measureText(this.banner.text).width;
      const by = Math.max(96, cy - R * zoom - 58);
      c.fillStyle = `rgba(8,12,30,${0.8 * al})`;
      c.beginPath();
      if (c.roundRect) c.roundRect(cx - tw / 2 - 16, by - 18, tw + 32, 36, 18); else c.rect(cx - tw / 2 - 16, by - 18, tw + 32, 36);
      c.fill();
      c.fillStyle = `rgba(255,255,255,${al})`;
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(this.banner.text, cx, by);
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
    const w = run.engine.win;
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
    const R = Math.min(this.w, this.h) * 0.36;
    if (seg.teach && !save.teachSeen[seg.mode]) this.banner = { text: seg.teach, until: now + 4200 };
    else if (seg.enter === 'drop') this.banner = { text: 'DROP   ×2 SCORE', until: now + 1600 };
    const pal = PALETTES[seg.look.palette] || PALETTES.deep;
    if (seg.enter === 'drop') {
      // the release: everything the build-up wound up lets go on the first beat
      this.flash = 1;
      this.punch = save.reducedMotion ? 0 : -0.16;
      this.shake = 1;
      for (let k = 0; k < 3; k++) this.shocks.push({ r: R * (0.2 + k * 0.25), max: R * (2.4 + k * 0.9), alpha: 0.95 - k * 0.2, col: k === 1 ? [255, 255, 255] : k === 0 ? CYAN : PINK, w: 6 - k });
      this.burst(0, 0, 90, CYAN, R * 3);
      this.burst(0, 0, 90, PINK, R * 3);
    } else if (seg.enter === 'pulse') {
      this.flash = 0.35;
      this.punch = save.reducedMotion ? 0 : -0.06;
      this.shocks.push({ r: R * 0.3, max: R * 2.2, alpha: 0.8, col: pal.ring, w: 4 });
      this.burst(0, 0, 40, pal.acc, R * 2.2);
    } else if (seg.enter === 'flash') {
      this.flash = 0.8;
      this.shake = 0.6;
      this.shocks.push({ r: R * 0.3, max: R * 3, alpha: 0.9, col: [255, 255, 255], w: 5 });
      this.burst(0, 0, 80, pal.acc, R * 3);
    } else if (run.time > 0.5) {
      this.shocks.push({ r: R * 0.5, max: R * 1.6, alpha: 0.4, col: pal.ring, w: 2 });
    }
  }

  private onJudge(run: Run, n: RNote, judge: string, kind: string): void {
    const level = run.level;
    const R = Math.min(this.w, this.h) * 0.36;
    if (judge === 'miss') { this.shake = Math.max(this.shake, 0.45); return; }
    if (kind === 'spin') { this.burst(0, 0, 50, JUDGE_COL.perfect, R * 2.4); return; }
    if (kind === 'haz') return;
    const seg = level.segments[n.seg];
    const rr = seg.mode === 'dual' ? (n.ring === 1 ? R * 1.02 : R * 0.64) : R;
    const a = level.angleAt(n.ring, kind === 'tail' ? n.beat1 : n.beat);
    const col = n.hand === 'L' ? CYAN : n.hand === 'R' ? PINK : WHITE;
    const x = Math.cos(a) * rr;
    const y = Math.sin(a) * rr;
    this.burst(x, y, judge === 'perfect' ? 16 : 7, judge === 'perfect' ? JUDGE_COL.perfect : col, R * (judge === 'perfect' ? 1.5 : 0.9));
    if (judge === 'perfect') this.shocks.push({ r: rr * 0.98, max: rr * 1.1, alpha: 0.35, col, w: 2 });
  }
}
