// Picture for the ring-hop core. What the player must read (rings, note marks, ceilings, orbs, the ball) is drawn
// in fixed colours; the world behind follows the song's measured energy, and blooms or drains with the player's flow.
import { audio } from '../audio/audio';
import { orbColour } from '../game/extras';
import type { Level } from '../game/level';
import { PALETTES, type Palette, type RGB } from '../render/palettes';
import { bestFor, save } from '../save';
import { flightRho, type Course } from './course';
import type { GdRun } from './run';

const TWO_PI = Math.PI * 2;
const EQ_BARS = 48;
const AHEAD = 3; // beats of course drawn ahead of the ball
const LOOK = 2; // beats before an opening that the ring above shows as a ceiling
const WHITE: RGB = [255, 255, 255];
const DANGER: RGB = [255, 64, 120]; // the edge of everything that ends the run
const GOLD: RGB = [255, 214, 90]; // orbs, flow
const VIOLET: RGB = [190, 120, 255]; // gravity flip
const CYAN: RGB = [0, 245, 255];

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (t: number) => { const x = clamp(t, 0, 1); return x * x * (3 - 2 * x); };
const mix = (a: RGB, b: RGB, t: number): RGB => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const rgba = (c: RGB, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; col: RGB; size: number }
interface Ripple { x: number; y: number; age: number; col: RGB }
/** One ring as the ball meets it: a ceiling while it is the ring above, then the floor it rides to the next note. */
interface Platform { lv: number; side: number; fs: number; fe: number; cs: number; ce: number; note: number; tol: number; flipAt: number; flipTol: number; pulse: boolean }

export class GdRenderer {
  private ctx: CanvasRenderingContext2D;
  private w = 0;
  private h = 0;
  private dpr = 1;
  private particles: Particle[] = [];
  private ripples: Ripple[] = [];
  private trail: Array<{ beat: number; rho: number; off: number }> = [];
  private eq = new Float32Array(EQ_BARS);
  private stars: Array<{ a: number; d: number; s: number }> = [];
  private bound: GdRun | null = null;
  private plats: Platform[] = [];
  private portals: Array<{ beat: number; faster: boolean }> = [];
  private energy: number[] = [];
  private cam = 0;
  private camVel = 0;
  private baseR = 1;
  private inten = 0;
  private flowV = 0.5;
  private drain = 0;
  private flash = 0;
  private shock = -1;
  private punch = 0;
  private dropAge = 99;
  private dropFull = false;
  private landPulse = 0;
  private shake = 0;
  private dark = 0;
  private pal: Palette = PALETTES.deep;
  private palFrom: Palette = PALETTES.deep;
  private palName = '';
  private palT = 1;
  private ball = { x: 0, y: 0, r: 0 };
  // sizes for this frame
  private r0 = 100;
  private gap = 24;
  private rb = 6;

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
    const c = run.course;
    this.plats = platforms(c, level);
    this.portals = [];
    level.segments.forEach((s, i) => {
      const a = i > 0 ? level.segments[i - 1].core?.speed ?? 1 : 1;
      const b = s.core?.speed ?? 1;
      if (a !== b && s.beat0 > c.start && s.beat0 < c.end) this.portals.push({ beat: s.beat0, faster: b > a });
    });
    this.energy = barEnergy(level);
    this.particles = [];
    this.ripples = [];
    this.trail = [];
    this.flash = this.punch = this.landPulse = this.shake = this.dark = this.drain = 0;
    this.shock = -1;
    this.dropAge = 99;
    this.dropFull = run.dropFull === true;
    const beat = run.viewTime / level.spb;
    this.cam = run.sim.rho(beat);
    this.camVel = 0;
    this.baseR = run.sim.side > 0 ? 1 : 1.5;
    this.flowV = run.sim.flow;
    this.inten = this.energyAt(beat);
    this.palName = level.segAt(Math.max(0, run.viewTime)).look.palette;
    this.pal = this.palFrom = PALETTES[this.palName] || PALETTES.deep;
    this.palT = 1;
    this.ball.r = 0;
  }

  private energyAt(beat: number): number {
    const e = this.energy;
    if (!e.length) return 0.5;
    const x = clamp(beat / 4 - 0.5, 0, e.length - 1);
    const i = Math.floor(x);
    return lerp(e[i], e[Math.min(e.length - 1, i + 1)], x - i);
  }

  /** Palette colour; when the player has lost the rhythm the world's colours drain toward grey. */
  private col(c: RGB, a = 1): string {
    const g = c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11;
    const d = this.drain * 0.85;
    return `rgba(${lerp(c[0], g, d) | 0},${lerp(c[1], g, d) | 0},${lerp(c[2], g, d) | 0},${a})`;
  }

  /** Screen radius of a ring level. */
  private rad(lv: number): number {
    return (this.r0 * this.baseR + (lv - this.cam) * this.gap) * (1 + this.punch * 0.04);
  }

  private burst(x: number, y: number, n: number, col: RGB, speed: number, size = 1): void {
    if (save.reducedMotion) n = Math.ceil(n / 3);
    for (let i = 0; i < n && this.particles.length < 220; i++) {
      const a = Math.random() * TWO_PI;
      const v = speed * (0.3 + Math.random() * 0.7);
      this.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: 0.3 + Math.random() * 0.35, col, size: (1.2 + Math.random() * 2.2) * size });
    }
  }

  // ---------------------------------------------------------------- the world behind the course
  private background(p: Palette, time: number, inten: number, groove: number, dark: number): void {
    const c = this.ctx;
    const cx = this.w / 2;
    const cy = this.h * 0.52;
    const span = Math.max(this.w, this.h) * 0.75;
    const k = 0.4 + inten * 0.95 + groove * 0.7;
    const g = c.createRadialGradient(cx, cy, 0, cx, cy, span);
    g.addColorStop(0, this.col([p.bg0[0] * k, p.bg0[1] * k, p.bg0[2] * k]));
    g.addColorStop(1, this.col(p.bg1));
    c.fillStyle = g;
    c.fillRect(0, 0, this.w, this.h);
    const speed = save.reducedMotion ? 0.01 : 0.01 + inten * 0.07;
    if (inten > 0.55 && !save.reducedMotion) {
      // the groove: slow rings drifting outward, only when the music is full
      const a = (inten - 0.55) / 0.45;
      for (let i = 0; i < 5; i++) {
        const f = (i / 5 + time * 0.16) % 1;
        c.lineWidth = 1.5 + f * 3;
        c.strokeStyle = this.col(p.acc, (1 - f) * f * 0.8 * a * (0.35 + groove));
        c.beginPath(); c.arc(cx, cy, f * f * span, 0, TWO_PI); c.stroke();
      }
    }
    for (const s of this.stars) {
      const d = (s.d + time * speed * s.s) % 1;
      c.fillStyle = this.col(p.acc, (0.1 + 0.4 * d) * (0.35 + inten * 0.65));
      c.fillRect(cx + Math.cos(s.a) * d * span, cy + Math.sin(s.a) * d * span, s.s, s.s);
    }
    if (dark > 0.01) { c.fillStyle = `rgba(0,0,0,${dark})`; c.fillRect(0, 0, this.w, this.h); }
  }

  /** Audio-reactive equalizer round the core, with the flow meter as a thin arc round it. */
  private core(pal: Palette, rc: number, len: number, kick: number, snare: number, dt: number, flow: number): void {
    const c = this.ctx;
    const spec = audio.spectrum();
    for (let i = 0; i < EQ_BARS; i++) {
      const m = i < EQ_BARS / 2 ? i : EQ_BARS - 1 - i;
      const v = spec ? Math.pow(spec[2 + Math.floor(m * 1.7)] / 255, 1.5) : kick * Math.exp(-m * 0.12) + snare * 0.7 * Math.exp(-Math.abs(m - 14) * 0.15);
      this.eq[i] += (v - this.eq[i]) * Math.min(1, dt * (v > this.eq[i] ? 40 : 9));
    }
    const glow = c.createRadialGradient(0, 0, 0, 0, 0, rc * (1.1 + kick * 0.4));
    glow.addColorStop(0, this.col(pal.ring, 0.5 + kick * 0.35));
    glow.addColorStop(1, this.col(pal.ring, 0));
    c.fillStyle = glow;
    c.beginPath(); c.arc(0, 0, rc * (1.1 + kick * 0.4), 0, TWO_PI); c.fill();
    c.lineCap = 'round';
    c.lineWidth = Math.max(2, ((rc * TWO_PI) / EQ_BARS) * 0.5);
    for (let i = 0; i < EQ_BARS; i++) {
      const a = (i / EQ_BARS) * TWO_PI - Math.PI / 2 + Math.PI / EQ_BARS;
      const v = this.eq[i];
      c.strokeStyle = this.col(mix(pal.ring, pal.acc, v), 0.4 + v * 0.6);
      c.beginPath(); c.moveTo(Math.cos(a) * rc * 1.12, Math.sin(a) * rc * 1.12); c.lineTo(Math.cos(a) * (rc * 1.2 + v * len), Math.sin(a) * (rc * 1.2 + v * len)); c.stroke();
    }
    if (flow >= 0) {
      // flow meter: fills as taps land on the notes, turns gold when the music is fully open
      const rm = rc * 1.2 + len + 7;
      const hot = flow >= 0.66;
      c.lineWidth = 3.5;
      c.strokeStyle = 'rgba(255,255,255,0.13)';
      c.beginPath(); c.arc(0, 0, rm, 0, TWO_PI); c.stroke();
      if (flow > 0.005) {
        c.strokeStyle = hot ? rgba(GOLD) : rgba(mix(pal.acc, WHITE, 0.4), 0.9);
        if (hot) { c.shadowColor = rgba(GOLD, 0.9); c.shadowBlur = 10; }
        c.beginPath(); c.arc(0, 0, rm, -Math.PI / 2, -Math.PI / 2 + flow * TWO_PI); c.stroke();
        c.shadowBlur = 0;
      }
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

  private text(s: string, x: number, y: number, size: number, col: RGB, alpha: number): void {
    if (alpha <= 0.01) return;
    const c = this.ctx;
    c.font = `800 ${Math.round(size)}px ui-rounded, "SF Pro Rounded", system-ui, sans-serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = `rgba(0,0,8,${alpha * 0.6})`;
    const w = c.measureText(s).width + size * 1.4;
    c.beginPath();
    c.roundRect(x - w / 2, y - size * 0.95, w, size * 1.9, size * 0.95);
    c.fill();
    c.fillStyle = rgba(col, alpha);
    c.fillText(s, x, y + 1);
  }

  private drawPlatform(pl: Platform, c0: Course, beat: number, pal: Palette, kick: number, drop: boolean): void {
    const c = this.ctx;
    const start = Math.min(pl.cs, pl.fs);
    if (start - beat > AHEAD || beat > pl.fe + 0.5) return;
    const r = this.rad(pl.lv);
    if (r < this.r0 * 0.5 || r > Math.hypot(this.w, this.h) / 2 + 40) return; // inside the core's meter, or off the screen
    const alpha = clamp((AHEAD - (start - beat)) / 0.6, 0, 1) * clamp(1 - (beat - pl.fe - 0.1) / 0.4, 0, 1);
    if (alpha <= 0.01) return;
    const lo = beat - 1;
    const hi = beat + AHEAD;
    const ang = (b: number) => -Math.PI / 2 + c0.angle(b);
    const arc = (b0: number, b1: number) => { c.beginPath(); c.arc(0, 0, r, ang(Math.max(b0, lo)), ang(Math.min(b1, hi))); };
    const { rb } = this;
    const pulse = pl.pulse ? kick : 0;
    // the whole ring, faintly: the lit stretch below is the part of it you can ride
    c.globalAlpha = alpha * (0.11 + pulse * 0.06);
    c.strokeStyle = this.col(pal.ring);
    c.lineWidth = 1.5;
    c.beginPath(); c.arc(0, 0, r, 0, TWO_PI); c.stroke();
    c.globalAlpha = alpha;
    // ceiling: the ring above, closed until its opening. Hazard colours: touching it ends the run.
    if (pl.ce - pl.cs > 0.06 && pl.ce > lo && pl.cs < hi) {
      arc(pl.cs, pl.ce);
      c.lineCap = 'butt';
      c.strokeStyle = rgba(DANGER);
      c.lineWidth = 5;
      c.stroke();
      c.strokeStyle = '#ffffff';
      c.lineWidth = 2;
      c.stroke();
    }
    // gravity flip: the ring above takes you on its underside
    if (!Number.isNaN(pl.flipAt)) {
      arc(pl.flipAt - pl.flipTol * 0.85, pl.fs);
      c.lineCap = 'round';
      c.strokeStyle = rgba(VIOLET, 0.35);
      c.lineWidth = 12;
      c.stroke();
      c.strokeStyle = rgba(VIOLET);
      c.lineWidth = 5;
      c.stroke();
    }
    // floor: the stretch you ride, ending just past the note you leave on (drawn a little short of the real edge)
    const fe = Number.isNaN(pl.note) ? pl.fe : pl.note + pl.tol * 0.85;
    if (fe > lo && pl.fs < hi) {
      c.lineCap = 'round';
      arc(pl.fs, fe);
      if (drop || pulse > 0.05) {
        c.strokeStyle = this.col(pal.ring, drop ? 0.22 + pulse * 0.2 : pulse * 0.35);
        c.lineWidth = drop ? 11 : 9;
        c.stroke();
      }
      c.strokeStyle = this.col(mix(pal.ring, WHITE, drop ? 0.55 : 0.3));
      c.lineWidth = drop ? 4.5 : 3.5;
      c.stroke();
      if (!Number.isNaN(pl.note) && pl.note > lo && pl.note < hi) {
        // the note: a bright mark across the ring. This is the moment to tap.
        const a = ang(pl.note);
        const len = rb * (1.15 + pulse * 0.5);
        c.strokeStyle = '#ffffff';
        c.lineWidth = 3.5 + pulse * 2.5;
        c.beginPath(); c.moveTo(Math.cos(a) * (r - len), Math.sin(a) * (r - len)); c.lineTo(Math.cos(a) * (r + len), Math.sin(a) * (r + len)); c.stroke();
        // and the edge: ride past it and the run ends
        const e = ang(fe);
        c.fillStyle = rgba(DANGER);
        c.beginPath(); c.arc(Math.cos(e) * r, Math.sin(e) * r, 3.2, 0, TWO_PI); c.fill();
      }
      c.lineCap = 'butt';
    }
    c.globalAlpha = 1;
  }

  // ---------------------------------------------------------------- a frame of play
  draw(run: GdRun, now: number, dt: number): void {
    if (this.bound !== run) this.bind(run);
    const c = this.ctx;
    const level = run.level;
    const course = run.course;
    const sim = run.sim;
    const t = run.viewTime;
    const beat = t / level.spb;
    const m = Math.min(this.w, this.h * 0.94);
    this.r0 = m * 0.27;
    this.gap = this.r0 * 0.25;
    this.rb = Math.max(5.5, this.r0 * 0.058);
    const { r0, rb } = this;
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

    // the song's measured energy sets the scene; the player's flow opens it up or drains it
    this.flowV += (sim.flow - this.flowV) * Math.min(1, dt * 6);
    this.drain += (sim.muffle - this.drain) * Math.min(1, dt * (sim.muffle > this.drain ? 1.4 : 9));
    this.inten += (this.energyAt(beat) - this.inten) * Math.min(1, dt * 2.5);
    const afterDrop = beat >= course.dropBeat;
    const bloom = (0.6 + 0.55 * this.flowV) * (afterDrop && !this.dropFull ? 0.75 : 1) * (1 - this.drain * 0.4);
    const inten = clamp(this.inten * bloom, 0, 1.15);
    const kick = level.energyAt('kick', t);
    const snare = level.energyAt('snare', t);
    const groove = kick * inten * inten;
    this.dark += ((seg.blackout ? 0.45 : 0) - this.dark) * Math.min(1, dt * 4);

    // what just happened
    for (const ev of run.events) {
      if (ev.kind === 'hop' || ev.kind === 'flip' || ev.kind === 'orb') {
        this.ripples.push({ x: this.ball.x, y: this.ball.y, age: 0, col: ev.flow ? GOLD : [170, 180, 200] });
        if (ev.flow) this.burst(this.ball.x, this.ball.y, ev.kind === 'orb' ? 9 : 5, GOLD, r0 * 0.7, 0.8); // small sparkles: on the note
        if (ev.kind === 'flip') this.burst(this.ball.x, this.ball.y, 12, VIOLET, r0 * 0.9);
      } else if (ev.kind === 'land') this.landPulse = 1;
      else if (ev.kind === 'drop') {
        this.dropFull = !!ev.full;
        this.dropAge = 0;
        if (ev.full) {
          // the earned drop: one flash, one shockwave, the old rings shatter, the camera kicks out
          this.flash = 1;
          this.shock = 0;
          this.punch = 1;
          const rr = this.ball.r || r0;
          for (let i = 0; i < 70; i++) {
            const a = (i / 70) * TWO_PI;
            this.particles.push({ x: Math.cos(a) * rr, y: Math.sin(a) * rr, vx: Math.cos(a) * r0 * (1.5 + Math.random() * 2.5), vy: Math.sin(a) * r0 * (1.5 + Math.random() * 2.5), life: 0, max: 0.45 + Math.random() * 0.4, col: i % 3 ? pal.acc : WHITE, size: 2 + Math.random() * 3 });
          }
        } else this.punch = 0.35;
      } else if (ev.kind === 'crash') {
        this.burst(this.ball.x, this.ball.y, 34, WHITE, r0 * 1.5);
        this.burst(this.ball.x, this.ball.y, 16, DANGER, r0 * 1.1);
        this.shake = save.reducedMotion ? 0 : 1;
      }
    }
    run.events.length = 0;
    if (this.ripples.length > 8) this.ripples.splice(0, this.ripples.length - 8);

    // spring camera: keeps the ball's ring at a steady radius, a little further out while it rides the inside
    const rho = sim.rho(beat);
    const om = 9;
    this.camVel += (om * om * (rho - this.cam) - 2 * om * this.camVel) * dt;
    this.cam += this.camVel * dt;
    // riding the inside, the hops go toward the core: the ball's ring is held further out to leave them room,
    // and the camera starts moving there a couple of beats before the flip
    const nextP = course.presses[sim.ni];
    const inward = sim.sideAt(beat) < 0 || (!!nextP && nextP.kind === 'flip' && nextP.side > 0 && nextP.beat - beat < 2.5);
    this.baseR += ((inward ? 1.5 : 1) - this.baseR) * Math.min(1, dt * 3.5);
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
    if (this.dropFull && this.dropAge < 1.2 && !save.reducedMotion) cx += Math.exp(-this.dropAge * 4) * Math.sin(this.dropAge * 10) * m * 0.035; // the drop's slingshot swing
    c.translate(cx, cy);

    this.core(pal, m * 0.045, m * 0.04 * (0.4 + 1.1 * inten), kick * (0.3 + 0.7 * inten), snare * inten, dt, this.flowV);

    if (this.shock >= 0) {
      this.shock += dt / 0.6;
      if (this.shock >= 1) this.shock = -1;
      else {
        c.strokeStyle = rgba(pal.acc, (1 - this.shock) * 0.6);
        c.lineWidth = 2 + (1 - this.shock) * 8;
        c.beginPath(); c.arc(0, 0, r0 * 0.3 + this.shock * Math.max(this.w, this.h) * 0.75, 0, TWO_PI); c.stroke();
      }
    }

    const ang = (b: number) => -Math.PI / 2 + course.angle(b);
    const dropStyle = afterDrop && this.dropFull;
    for (const pl of this.plats) this.drawPlatform(pl, course, beat, pal, kick, dropStyle);

    // where the next hops go: a faint dotted path from each note to its landing
    for (let k = sim.ni; k < Math.min(course.presses.length, sim.ni + 3); k++) {
      const p = course.presses[k];
      if (p.beat - beat > AHEAD - 0.4) break;
      const n = Math.max(3, Math.round((p.land - p.beat) * 8));
      c.fillStyle = rgba(WHITE, k === sim.ni ? 0.5 : 0.25);
      for (let i = 1; i < n; i++) {
        const b = p.beat + ((p.land - p.beat) * i) / n;
        const r = this.rad(flightRho(p, b)) + (p.kind === 'flip' ? p.side * rb * (1 - (2 * i) / n) : p.side * rb);
        c.beginPath(); c.arc(Math.cos(ang(b)) * r, Math.sin(ang(b)) * r, 1.6, 0, TWO_PI); c.fill();
      }
    }

    // speed portals
    for (const sp of this.portals) {
      const d = sp.beat - beat;
      if (d > AHEAD || d < -0.4) continue;
      const a = ang(sp.beat);
      c.save();
      c.rotate(a + Math.PI / 2);
      c.globalAlpha = clamp((AHEAD - d) / 0.6, 0, 1) * clamp(1 + d / 0.4, 0, 1);
      c.strokeStyle = rgba(CYAN);
      c.lineWidth = 3;
      c.lineCap = 'round';
      const rr = this.rad(this.cam);
      for (let i = -1; i <= 1; i++) {
        const x = i * rb * 1.3 * (sp.faster ? 1 : -1);
        c.beginPath(); c.moveTo(x - rb * 0.6, -rr - rb * 2.4); c.lineTo(x + rb * 0.6, -rr); c.lineTo(x - rb * 0.6, -rr + rb * 2.4); c.stroke();
      }
      c.restore();
      c.lineCap = 'butt';
    }

    // orbs: optional extra taps on notes that fall in mid-flight
    for (const o of course.orbs) {
      const d = o.beat - beat;
      if (d > AHEAD || d < -0.25 || sim.orbUsed(o.beat)) continue;
      const p = course.presses[o.press];
      const r = this.rad(flightRho(p, o.beat)) + p.side * rb;
      const x = Math.cos(ang(o.beat)) * r;
      const y = Math.sin(ang(o.beat)) * r;
      c.globalAlpha = clamp((AHEAD - d) / 0.6, 0, 1) * clamp(1 + d / 0.25, 0, 1);
      c.strokeStyle = rgba(GOLD);
      c.lineWidth = Math.max(2, rb * 0.36);
      c.beginPath(); c.arc(x, y, rb * 1.15, 0, TWO_PI); c.stroke();
      c.fillStyle = rgba(GOLD, 0.9);
      c.beginPath(); c.arc(x, y, rb * 0.4, 0, TWO_PI); c.fill();
      c.globalAlpha = 1;
    }

    for (const r of this.ripples) {
      r.age += dt;
      const u = r.age / 0.28;
      if (u >= 1) continue;
      c.strokeStyle = rgba(r.col, (1 - u) * 0.8);
      c.lineWidth = 2;
      c.beginPath(); c.arc(r.x, r.y, rb * (1.2 + u * 2.6), 0, TWO_PI); c.stroke();
    }

    // the ball: its place round the core is a pure function of the clock, so it moves exactly as smoothly as the clock does
    const off = sim.sideAt(beat) * rb * (1 - 0.3 * this.landPulse);
    const br = this.rad(rho) + off;
    const a = ang(beat);
    const bx = Math.cos(a) * br;
    const by = Math.sin(a) * br;
    if (run.state !== 'failed') {
      if (playing) {
        this.trail.push({ beat, rho, off });
        if (this.trail.length > 30) this.trail.shift();
      }
      c.lineCap = 'round';
      const n = this.trail.length;
      for (let i = 1; i < n; i++) {
        const p0 = this.trail[i - 1];
        const p1 = this.trail[i];
        const u = i / n;
        const ra = this.rad(p0.rho) + p0.off;
        const rz = this.rad(p1.rho) + p1.off;
        c.strokeStyle = rgba(skin, u * u * 0.55);
        c.lineWidth = rb * 1.7 * u;
        c.beginPath(); c.moveTo(Math.cos(ang(p0.beat)) * ra, Math.sin(ang(p0.beat)) * ra); c.lineTo(Math.cos(ang(p1.beat)) * rz, Math.sin(ang(p1.beat)) * rz); c.stroke();
      }
      c.lineCap = 'butt';
      const vr = dt > 0 && this.ball.r ? (br - this.ball.r) / dt : 0;
      const stretch = sim.mode !== 'ground' ? clamp(Math.abs(vr) / (r0 * 4), 0, 0.2) : 0;
      this.drawBall(bx, by, rb, skin, a, 1 + stretch - 0.3 * this.landPulse, 1 - stretch * 0.5 + 0.22 * this.landPulse);
      this.ball.x = bx;
      this.ball.y = by;
      this.ball.r = br;
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

    // short hints, near the core and out of the ball's way
    if (run.state !== 'loading' && (!bestFor(level.id).cleared || run.opts.practice)) {
      const first = course.presses[0];
      const flip = course.presses.find((p) => p.kind === 'flip');
      const orb = course.orbs[0];
      const hints: Array<[number, number, string]> = [];
      if (first) hints.push([course.start - 9, first.beat + 1.5, 'TAP ON EACH MARK']);
      if (orb) hints.push([orb.beat - 5, orb.beat, 'GOLD ORB: BONUS TAP']);
      if (flip) hints.push([flip.beat - 5, flip.beat, 'VIOLET: GRAVITY FLIP']);
      for (const [b0, b1, s] of hints) {
        if (beat < b0 || beat > b1) continue;
        const al = Math.min(1, (beat - Math.max(b0, run.startAt / level.spb - 4)) / 0.5, (b1 - beat) / 0.5);
        this.text(s, 0, -m * 0.045 * 1.2 - m * 0.04 * 1.5 - 30, clamp(m * 0.022, 10, 16), WHITE, clamp(al, 0, 1));
        break;
      }
    }
    if (run.state === 'resuming') this.text(String(Math.max(1, Math.ceil((run.resumeAt - now) / 400))), 0, m * 0.16, m * 0.06, WHITE, 1);
    if (run.state === 'loading') this.text('LOADING', 0, m * 0.16, clamp(m * 0.024, 11, 17), WHITE, 0.8);
    c.restore();

    if (this.flash > 0) { c.fillStyle = `rgba(255,255,255,${this.flash * (save.reducedMotion ? 0.1 : 0.38)})`; c.fillRect(0, 0, this.w, this.h); }
  }

  /** Idle picture behind the menus. */
  drawIdle(now: number, dt = 0.016): void {
    const c = this.ctx;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.drain = 0;
    const pal = PALETTES.deep;
    const pulse = Math.exp(-(((now / 1000) * 2) % 1) * 4) * 0.5;
    this.background(pal, now / 1000, 0.45, pulse * 0.2, 0);
    const m = Math.min(this.w, this.h);
    c.save();
    c.translate(this.w / 2, this.h * 0.5);
    this.core(pal, m * 0.06, m * 0.05, pulse, pulse * 0.5, dt, -1);
    for (let k = 0; k < 3; k++) {
      c.lineWidth = 2;
      c.strokeStyle = rgba(pal.ring, 0.3 - k * 0.08);
      c.beginPath(); c.arc(0, 0, m * (0.24 + k * 0.07), 0, TWO_PI); c.stroke();
    }
    // the ball climbs a ring every half turn, then drops back
    const turn = (now / 5200) % 1;
    const step = Math.floor(turn * 4) % 3;
    const u = smooth(((turn * 4) % 1) * 3);
    const lv = step === 2 ? 2 - 2 * u : step + u;
    const a = -Math.PI / 2 + turn * TWO_PI * 2;
    const r = m * (0.24 + lv * 0.07) + m * 0.014;
    this.drawBall(Math.cos(a) * r, Math.sin(a) * r, m * 0.014, orbColour(save.skin));
    c.restore();
  }

  /** Ball crossing a mark at the top of a ring; used by the visual-offset calibration. */
  drawMetronome(now: number, phase: number): void {
    const c = this.ctx;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.drain = 0;
    const pal = PALETTES.deep;
    this.background(pal, now / 1000, 0.4, 0, 0);
    const cx = this.w / 2;
    const cy = this.h * 0.36;
    const R = Math.min(this.w, this.h) * 0.2;
    c.lineWidth = 3;
    c.strokeStyle = rgba(pal.ring, 0.5);
    c.beginPath(); c.arc(cx, cy, R, 0, TWO_PI); c.stroke();
    c.lineCap = 'round';
    c.lineWidth = 5;
    c.strokeStyle = '#ffffff';
    c.beginPath(); c.moveTo(cx, cy - R * 0.87); c.lineTo(cx, cy - R * 1.13); c.stroke();
    c.lineCap = 'butt';
    const a = -Math.PI / 2 + phase * TWO_PI;
    this.drawBall(cx + Math.cos(a) * (R + R * 0.1), cy + Math.sin(a) * (R + R * 0.1), R * 0.1, CYAN);
  }
}

/** Turns the presses into the rings the ball meets, in order. */
function platforms(c: Course, level: Level): Platform[] {
  const ps = c.presses;
  const out: Platform[] = [];
  for (let j = 0; j <= ps.length; j++) {
    const p = ps[j];
    const prev = ps[j - 1];
    const lv = p ? p.from : prev ? prev.to : 0;
    const side = p ? p.side : prev ? (prev.kind === 'flip' ? -prev.side : prev.side) : 1;
    const fs = prev ? prev.land - (prev.bounce && p ? p.tol * 0.85 : 0.1) : c.start - 16;
    const fe = p ? p.beat + p.tol : c.end + 16;
    let cs = Infinity;
    let ce = -Infinity;
    if (prev) {
      // while the ball rides the ring before, this ring is the ceiling above it, up to the opening over the note
      const before = out[j - 1];
      cs = Math.max(prev.beat - LOOK, before.fs);
      ce = prev.beat - prev.tol * (prev.kind === 'flip' ? 0.85 : 0.9);
    }
    out.push({
      lv, side, fs, fe, cs, ce, note: p ? p.beat : NaN, tol: p ? p.tol : 0,
      flipAt: prev && prev.kind === 'flip' ? prev.beat : NaN, flipTol: prev ? prev.tol : 0,
      pulse: !!level.segAt(((p ? p.beat : c.end) + 1e-6) * c.spb).core?.pulse
    });
  }
  return out;
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
