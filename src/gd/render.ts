// Picture for the ring-hop core. What the player must read (rings, marks, ceilings, flow notes, the ball) is drawn
// last, in fixed colours, on top of everything else. The world behind follows the song's measured energy, blooms or
// drains with the player's flow, and after the drop goes off as hard as the charge and flow earned.
import { audio } from '../audio/audio';
import { orbColour } from '../game/extras';
import type { Level } from '../game/level';
import { PALETTES, type Palette, type RGB } from '../render/palettes';
import { bestFor, save } from '../save';
import { flightRho, smoothstep, type Course, type Feature } from './course';
import type { GdRun } from './run';

const TWO_PI = Math.PI * 2;
const EQ_BARS = 48;
const AHEAD = 3; // beats of course drawn ahead of the ball
const LOOK = 2; // beats before an opening that the ring above shows as a ceiling
const WHITE: RGB = [255, 255, 255];
const DANGER: RGB = [255, 64, 120]; // the edge of everything that ends the run
const GOLD: RGB = [255, 214, 90]; // flow notes, flow, the smash
const VIOLET: RGB = [190, 120, 255]; // gravity flip
const CYAN: RGB = [0, 245, 255]; // speed portals, turns, planet hops
const FLOOR: RGB = [226, 234, 255]; // the rings you ride: one fixed colour, whatever the world behind is doing
const HALO = 'rgba(3,5,14,0.62)'; // the dark edge under everything in the foreground
const HINT: Record<Feature, string> = {
  charge: 'TAP THE ROLL: CHARGE THE DROP', smash: 'THE DROP: HIT THE BIG GOLD MARK', flip: 'VIOLET: GRAVITY FLIP', weave: 'WEAVE: BOUNCE BETWEEN THE TWO RINGS',
  spin: 'SPIN GATE: THE GAP COMES ROUND TO THE MARK', sling: 'CYAN ARROWS: TAP TO HOP PLANETS, THEN A BREATHER', reverse: 'THE ORBIT TURNS ROUND', faster: 'SPEED UP', slower: 'SLOW DOWN',
  twin: 'TWIN ORBIT: ONE TAP MOVES BOTH'
};

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (t: number) => { const x = clamp(t, 0, 1); return x * x * (3 - 2 * x); };
const mix = (a: RGB, b: RGB, t: number): RGB => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const rgba = (c: RGB, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

/** back: drawn behind the course (kick bursts, the drop's shards), so it can never cover a mark. */
interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; col: RGB; size: number; back?: boolean }
interface Ripple { x: number; y: number; age: number; col: RGB }
/** An expanding ring: the shockwaves of the drop, of big hits, and of on-beat taps in the loud parts. */
interface Wave { r: number; v: number; life: number; max: number; col: RGB; w: number; a: number }
/** One ring as the ball meets it: a ceiling while it is the ring above, then the floor it rides to the next note. */
interface Platform {
  lv: number; side: number; fs: number; fe: number; cs: number; ce: number; note: number; tol: number; auto: boolean;
  smash: boolean; accent: boolean; sling: boolean; after: boolean; twin: 'a' | 'b' | 'both' | null; flipAt: number; flipTol: number; pulse: boolean;
  /** the planet this ring belongs to; and, if it is entered through a spin gate, when, how wide and from which side */
  planet: number; spinAt: number; spinTol: number; enterSide: number;
}
/** Things that fly past behind the course in a drop: shards thrown out from the centre, and ring fragments in orbit. */
interface Debris { a: number; d: number; v: number; rot: number; spin: number; size: number; kind: number; hue: number }
interface Frag { r: number; a: number; len: number; w: number; v: number }

export class GdRenderer {
  private ctx: CanvasRenderingContext2D;
  private w = 0;
  private h = 0;
  private dpr = 1;
  private particles: Particle[] = [];
  private ripples: Ripple[] = [];
  private waves: Wave[] = [];
  private trail: Array<{ beat: number; rho: number; off: number; pf: number; away?: number }> = [];
  private debris: Debris[] = [];
  private frags: Frag[] = [];
  private glitch = 0;
  private bands: Array<[number, number, number]> = [];
  private flipK = 0;
  private burstK = 0;
  private camX = 0;
  private camVX = 0;
  private camVY = 0;
  // The camera's bumps as the course feels them. `punch` and `zoomKick` jump the moment a hit lands (the backdrop uses
  // them like that); these follow within a few frames, so the rings and the ball swell and settle instead of jumping.
  private punchS = 0;
  private zoomS = 0;
  private camY = 0;
  private pf = 0;
  private coreX = 0;
  private coreY = 0;
  private eq = new Float32Array(EQ_BARS);
  private stars: Array<{ a: number; d: number; s: number }> = [];
  private starPhase = 0;
  private rayTurn = 0;
  private bound: GdRun | null = null;
  private plats: Platform[] = [];
  private hints: Array<[number, number, string]> = [];
  private energy: number[] = [];
  private cam = 0;
  private camVel = 0;
  private baseR = 1;
  private inten = 0;
  private flowV = 0.5;
  private drain = 0;
  private flash = 0;
  private strobe = 0;
  private punch = 0;
  private zoomKick = 0;
  private ringFlash = 0;
  private world = 0;
  private twinV = 0;
  private kickWas = 0;
  private snareWas = 0;
  private dropAge = 99;
  private dropFull = false;
  private dropPower = 1;
  private chargeV = 0;
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
    for (let i = 0; i < 90; i++) this.stars.push({ a: Math.random() * TWO_PI, d: Math.random(), s: 0.4 + Math.random() * 1.3 });
    for (let i = 0; i < 34; i++) this.debris.push({ a: Math.random(), d: Math.random(), v: 0.25 + Math.random() * 0.5, rot: Math.random() * TWO_PI, spin: (Math.random() - 0.5) * 5, size: 5 + Math.random() * 13, kind: i % 3, hue: Math.random() });
    for (let i = 0; i < 14; i++) this.frags.push({ r: 0.3 + Math.random() * 0.75, a: Math.random() * TWO_PI, len: 0.25 + Math.random() * 0.7, w: 2 + Math.random() * 6, v: (Math.random() < 0.5 ? -1 : 1) * (0.15 + Math.random() * 0.5) });
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
    // hints: the first mark, the first gold note, and each mechanic the first time the level uses it
    this.hints = [];
    const first = c.presses[0];
    if (first) this.hints.push([c.start - 9, first.beat + 1.5, 'TAP ON EACH WHITE MARK']);
    const gold = c.flow.find((f) => !f.charge);
    if (gold) this.hints.push([gold.beat - 3, gold.beat + 2.5, 'GOLD NOTES: BONUS TAPS']);
    for (const f of c.firsts) this.hints.push(f.what === 'charge' ? [f.beat - 2.5, f.beat + 4, HINT.charge] : f.what === 'smash' ? [f.beat - 5, f.beat, HINT.smash] : [f.beat - 4.5, f.beat + 1.5, HINT[f.what]]);
    this.hints.sort((a, b) => a[0] - b[0]);
    this.energy = barEnergy(level);
    this.particles = [];
    this.ripples = [];
    this.waves = [];
    this.trail = [];
    this.flash = this.strobe = this.punch = this.zoomKick = this.ringFlash = this.landPulse = this.shake = this.dark = this.drain = this.glitch = this.flipK = this.burstK = 0;
    this.punchS = this.zoomS = 0;
    this.dropAge = 99;
    this.dropFull = run.dropFull === true;
    this.dropPower = run.dropPower;
    this.chargeV = run.sim.charge;
    const beat = run.viewTime / level.spb;
    this.world = beat >= c.dropBeat ? 1 : 0;
    this.twinV = c.twins.some(([a, z]) => beat >= a && beat < z) ? 1 : 0;
    this.cam = run.sim.rho(beat);
    this.camVel = 0;
    this.sizes();
    this.pf = this.planetOf(run, beat);
    [this.camX, this.camY] = this.planetXY(this.pf);
    this.camVX = this.camVY = 0;
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

  private sizes(): number {
    const m = Math.min(this.w, this.h * 0.94);
    this.r0 = m * 0.27;
    this.gap = this.r0 * 0.25;
    this.rb = Math.max(5.5, this.r0 * 0.058);
    return m;
  }

  /** Where a planet's core is in the world. Each planet hop goes on to the next: across on a wide screen, up on a tall one. */
  private planetXY(pf: number): [number, number] {
    const d = this.r0 * 2.75;
    const at = (k: number): [number, number] => (this.w >= this.h ? [k * d, k % 2 ? -0.42 * d : 0] : [k % 2 ? 0.4 * d : 0, -k * d]);
    const k = Math.floor(pf);
    const f = pf - k;
    if (f < 1e-6) return at(k);
    const a = at(k);
    const b = at(k + 1);
    return [lerp(a[0], b[0], f), lerp(a[1], b[1], f)];
  }

  /** Which planet the ball is at; part-way between two while it flies a planet hop. */
  private planetOf(run: GdRun, beat: number): number {
    const sim = run.sim;
    const last = run.course.presses[sim.ni - 1];
    if (!last) return 0;
    if (last.sling && sim.mode === 'flight' && sim.fl) return last.planet + smoothstep((beat - sim.fl.t0) / (sim.fl.t1 - sim.fl.t0));
    return last.planetTo;
  }

  /** Screen radius of a ring level. The camera bumps on big hits and pulls right back as the drop goes off. */
  private rad(lv: number): number {
    return (this.r0 * this.baseR + (lv - this.cam) * this.gap) * (1 + this.punchS * 0.05) * (1 - this.zoomS * 0.2);
  }

  private burst(x: number, y: number, n: number, col: RGB, speed: number, size = 1, back = false): void {
    if (save.reducedMotion) n = Math.ceil(n / 3);
    for (let i = 0; i < n && this.particles.length < 420; i++) {
      const a = Math.random() * TWO_PI;
      const v = speed * (0.3 + Math.random() * 0.7);
      this.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: 0.3 + Math.random() * 0.35, col, size: (1.2 + Math.random() * 2.2) * size, back });
    }
  }

  private wave(r: number, col: RGB, speed: number, width: number, alpha: number, life = 0.45): void {
    if (this.waves.length < 10) this.waves.push({ r, v: speed, life: 0, max: life, col, w: width, a: alpha });
  }

  private drawParticles(dt: number, back: boolean): void {
    const c = this.ctx;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      if (!!p.back !== back) continue;
      p.life += dt;
      if (p.life >= p.max) { this.particles.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 1 - dt * 2.5;
      p.vy *= 1 - dt * 2.5;
      c.fillStyle = rgba(p.col, (1 - p.life / p.max) * (back ? 0.75 : 1));
      c.beginPath(); c.arc(p.x, p.y, p.size, 0, TWO_PI); c.fill();
    }
  }

  // ---------------------------------------------------------------- the world behind the course
  /** drive: 0 in the verse, up to 1 in a fully earned drop. It is what makes the drop several times livelier than the verse. */
  private background(p: Palette, time: number, dt: number, inten: number, groove: number, dark: number, drive: number, kick: number): void {
    const c = this.ctx;
    const cx = this.w / 2;
    const cy = this.h * 0.52;
    const span = Math.max(this.w, this.h) * 0.75;
    const calm = save.reducedMotion;
    const k = 0.4 + inten * 0.95 + groove * 0.7 + drive * kick * 0.5;
    // the bass warps the backdrop: its bright centre swells on every kick
    const g = c.createRadialGradient(cx, cy, 0, cx, cy, span * (1 + (calm ? 0 : drive * kick * 0.18)));
    g.addColorStop(0, this.col([p.bg0[0] * k, p.bg0[1] * k, p.bg0[2] * k]));
    if (drive > 0.02) g.addColorStop(0.45, this.col(mix(p.bg0, p.ring, 0.22 * drive * (0.5 + kick)), 1));
    g.addColorStop(1, this.col(p.bg1));
    c.fillStyle = g;
    c.fillRect(0, 0, this.w, this.h);
    if (drive > 0.03) {
      // after the drop the world is a different place: turning light rays and a bloom, both breathing with the kick
      c.globalCompositeOperation = 'lighter';
      if (!calm) this.rayTurn += dt * (0.05 + drive * 0.12);
      const n = 14;
      c.fillStyle = this.col(p.acc, (0.035 + 0.075 * kick) * drive * (calm ? 0.5 : 1));
      c.beginPath();
      for (let i = 0; i < n; i++) {
        const a = this.rayTurn + (i / n) * TWO_PI;
        const half = 0.045 + 0.05 * ((i * 7) % 5) / 5;
        c.moveTo(cx, cy);
        c.lineTo(cx + Math.cos(a - half) * span * 1.4, cy + Math.sin(a - half) * span * 1.4);
        c.lineTo(cx + Math.cos(a + half) * span * 1.4, cy + Math.sin(a + half) * span * 1.4);
      }
      c.fill();
      const b = c.createRadialGradient(cx, cy, 0, cx, cy, span * 0.7);
      b.addColorStop(0, this.col(p.ring, (0.1 + 0.2 * kick) * drive));
      b.addColorStop(1, this.col(p.ring, 0));
      c.fillStyle = b;
      c.fillRect(0, 0, this.w, this.h);
      c.globalCompositeOperation = 'source-over';
    }
    if (drive > 0.08) {
      // chaos, all of it behind the course and all of it scaled by how big the drop was earned:
      // ring fragments in orbit...
      c.lineCap = 'round';
      const shown = Math.round(this.frags.length * Math.min(1, drive * 1.4) * (calm ? 0.4 : 1));
      for (let i = 0; i < shown; i++) {
        const f = this.frags[i];
        if (!calm) f.a += dt * f.v * (0.4 + drive * 0.9 + kick * drive * 1.5);
        c.strokeStyle = this.col(i % 2 ? p.acc : p.ring, (0.1 + 0.2 * kick) * drive);
        c.lineWidth = f.w * (1 + kick * drive);
        c.beginPath(); c.arc(cx, cy, f.r * span, f.a, f.a + f.len); c.stroke();
      }
      c.lineCap = 'butt';
      // ...and shards thrown out from the centre, repeated round it like a kaleidoscope, each second copy mirrored
      const fold = calm ? 1 : drive > 0.55 ? 6 : 4;
      const count = Math.round(this.debris.length * Math.min(1, drive * 1.5) * (calm ? 0.3 : 1));
      for (let i = 0; i < count; i++) {
        const o = this.debris[i];
        o.d += dt * o.v * (calm ? 0.12 : 0.22 + drive * 0.5 + kick * drive * 1.4);
        if (o.d > 1) { o.d -= 1; o.a = Math.random(); o.hue = Math.random(); }
        o.rot += dt * o.spin * (calm ? 0.2 : 1);
        const dist = o.d * o.d * span * 1.15;
        const size = o.size * (0.35 + o.d * 1.9);
        c.fillStyle = this.col(mix(p.ring, p.acc, o.hue), o.d * (1 - o.d) * 4 * (0.16 + 0.26 * drive));
        for (let k = 0; k < fold; k++) {
          const a = ((k % 2 ? 1 - o.a : o.a) + k) * (TWO_PI / fold);
          const x = cx + Math.cos(a) * dist;
          const y = cy + Math.sin(a) * dist;
          const rot = (k % 2 ? -o.rot : o.rot) + a;
          const ux = Math.cos(rot) * size;
          const uy = Math.sin(rot) * size;
          c.beginPath();
          if (o.kind === 0) { c.moveTo(x + ux, y + uy); c.lineTo(x - uy * 0.6, y + ux * 0.6); c.lineTo(x + uy * 0.6, y - ux * 0.6); } // shard
          else if (o.kind === 1) { c.moveTo(x + ux, y + uy); c.lineTo(x - uy * 0.5, y + ux * 0.5); c.lineTo(x - ux, y - uy); c.lineTo(x + uy * 0.5, y - ux * 0.5); } // diamond
          else { c.moveTo(x + ux * 1.6, y + uy * 1.6); c.lineTo(x - uy * 0.16, y + ux * 0.16); c.lineTo(x - ux * 1.6, y - uy * 1.6); c.lineTo(x + uy * 0.16, y - ux * 0.16); } // splinter
          c.fill();
        }
      }
    }
    if ((inten > 0.55 || drive > 0.05) && !calm) {
      // the groove: rings drifting outward, more of them and brighter in the drop
      const a = Math.max(clamp((inten - 0.55) / 0.45, 0, 1), drive);
      const n = drive > 0.3 ? 8 : 5;
      for (let i = 0; i < n; i++) {
        const f = (i / n + time * (0.16 + drive * 0.1)) % 1;
        c.lineWidth = 1.5 + f * (3 + drive * 4);
        c.strokeStyle = this.col(p.acc, (1 - f) * f * (0.8 + drive * 0.8) * a * (0.35 + groove));
        c.beginPath(); c.arc(cx, cy, f * f * span, 0, TWO_PI); c.stroke();
      }
    }
    // stars drift outward; in the drop every kick throws them forward as streaks
    this.starPhase += dt * (calm ? 0.01 : 0.01 + inten * 0.07 + drive * (0.1 + kick * 0.5));
    const streak = calm ? 0 : drive * (0.3 + kick) * 26;
    c.lineWidth = 1.4;
    for (const s of this.stars) {
      const d = (s.d + this.starPhase * s.s) % 1;
      const x = cx + Math.cos(s.a) * d * span;
      const y = cy + Math.sin(s.a) * d * span;
      const al = (0.1 + 0.4 * d) * (0.35 + inten * 0.65 + drive * 0.4);
      if (streak > 2) {
        c.strokeStyle = this.col(p.acc, al);
        c.beginPath(); c.moveTo(x, y); c.lineTo(x - Math.cos(s.a) * streak * d, y - Math.sin(s.a) * streak * d); c.stroke();
      } else {
        c.fillStyle = this.col(p.acc, al);
        c.fillRect(x, y, s.s, s.s);
      }
    }
    if (this.flipK > 0.02 && !calm) {
      // colour flip on the kick: for a moment the whole backdrop swings to its opposite
      c.globalCompositeOperation = 'difference';
      c.fillStyle = this.col(mix(p.acc, WHITE, 0.25), this.flipK * 0.6 * drive);
      c.fillRect(0, 0, this.w, this.h);
      c.globalCompositeOperation = 'source-over';
    }
    if (dark > 0.01) { c.fillStyle = `rgba(0,0,0,${dark})`; c.fillRect(0, 0, this.w, this.h); }
  }

  /** Audio-reactive equalizer round the core, with the flow meter and the drop's charge as arcs round it. */
  private core(pal: Palette, rc: number, len: number, kick: number, snare: number, dt: number, flow: number, charge: number, drive: number, span: number): void {
    const c = this.ctx;
    const spec = audio.spectrum();
    for (let i = 0; i < EQ_BARS; i++) {
      const m = i < EQ_BARS / 2 ? i : EQ_BARS - 1 - i;
      const v = spec ? Math.pow(spec[2 + Math.floor(m * 1.7)] / 255, 1.5) : kick * Math.exp(-m * 0.12) + snare * 0.7 * Math.exp(-Math.abs(m - 14) * 0.15);
      this.eq[i] += (v - this.eq[i]) * Math.min(1, dt * (v > this.eq[i] ? 40 : 9));
    }
    c.lineCap = 'round';
    if (drive > 0.05 && !save.reducedMotion) {
      // in the drop the equalizer's bars reach right across the screen on the kick, as beams behind the course
      c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < EQ_BARS; i++) {
        const v = this.eq[i];
        if (v < 0.12) continue;
        const a = (i / EQ_BARS) * TWO_PI - Math.PI / 2 + Math.PI / EQ_BARS;
        const far = rc * 1.2 + v * len + v * (0.25 + kick + this.burstK * 1.3) * drive * span; // on the kick they burst right to the edges
        c.lineWidth = 2 + v * 5 * drive;
        c.strokeStyle = this.col(mix(pal.ring, pal.acc, v), (0.05 + 0.2 * v * kick + 0.18 * this.burstK) * drive);
        c.beginPath(); c.moveTo(Math.cos(a) * rc * 1.2, Math.sin(a) * rc * 1.2); c.lineTo(Math.cos(a) * far, Math.sin(a) * far); c.stroke();
      }
      c.globalCompositeOperation = 'source-over';
    }
    const glow = c.createRadialGradient(0, 0, 0, 0, 0, rc * (1.1 + kick * 0.4));
    glow.addColorStop(0, this.col(pal.ring, 0.5 + kick * 0.35));
    glow.addColorStop(1, this.col(pal.ring, 0));
    c.fillStyle = glow;
    c.beginPath(); c.arc(0, 0, rc * (1.1 + kick * 0.4), 0, TWO_PI); c.fill();
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
      if (charge > 0.005) {
        // the drop's charge: a thicker white arc outside the flow meter, filled by tapping the roll
        const ro = rm + 8 + charge * 2;
        c.lineWidth = 5 + charge * 3;
        c.strokeStyle = 'rgba(255,255,255,0.16)';
        c.beginPath(); c.arc(0, 0, ro, 0, TWO_PI); c.stroke();
        c.strokeStyle = rgba(mix(WHITE, GOLD, charge >= 1 ? 0.6 : 0));
        c.shadowColor = 'rgba(255,255,255,0.9)';
        c.shadowBlur = 6 + charge * 14;
        c.beginPath(); c.arc(0, 0, ro, -Math.PI / 2, -Math.PI / 2 + charge * TWO_PI); c.stroke();
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

  /** Adds the stretch of a ring between two beats to the current path, following the orbit through any turn. */
  private arcPath(c0: Course, r: number, b0: number, b1: number): void {
    const c = this.ctx;
    let from = b0;
    for (const t of c0.turns) {
      if (t <= from || t >= b1) continue;
      const a0 = -Math.PI / 2 + c0.angle(from);
      const a1 = -Math.PI / 2 + c0.angle(t);
      c.arc(0, 0, r, a0, a1, a1 < a0);
      from = t;
    }
    const a0 = -Math.PI / 2 + c0.angle(from);
    const a1 = -Math.PI / 2 + c0.angle(b1);
    c.arc(0, 0, r, a0, a1, a1 < a0);
  }

  /** plain: the twin ball's side of a ring whose mark is on the other ball: somewhere to ride, nothing to read. */
  private drawPlatform(pl: Platform, c0: Course, beat: number, pal: Palette, kick: number, drop: boolean, plain: boolean, time: number): void {
    const c = this.ctx;
    const start = Math.min(pl.cs, pl.fs);
    if (start - beat > AHEAD || beat > pl.fe + 0.5) return;
    const r = this.rad(pl.lv);
    if (r < this.r0 * 0.5 || r > Math.hypot(this.w, this.h) / 2 + 40) return; // inside the core's meter, or off the screen
    const alpha = clamp((AHEAD - (start - beat)) / 0.6, 0, 1) * clamp(1 - (beat - pl.fe - 0.1) / 0.4, 0, 1) * (plain ? 0.55 : 1);
    if (alpha <= 0.01) return;
    const lo = beat - 1;
    const hi = beat + AHEAD;
    const ang = (b: number) => -Math.PI / 2 + c0.angle(b);
    const arc = (b0: number, b1: number) => { c.beginPath(); this.arcPath(c0, r, Math.max(b0, lo), Math.min(b1, hi)); };
    const { rb } = this;
    const pulse = pl.pulse ? kick : 0;
    const lit = this.ringFlash;
    // the whole ring, faintly: the lit stretch below is the part of it you can ride. After the drop the rings are
    // broken into turning shards, and every on-beat tap lights them up.
    c.globalAlpha = alpha * (0.11 + pulse * 0.06 + (drop ? 0.08 : 0) + lit * 0.3);
    c.strokeStyle = this.col(pal.ring);
    c.lineWidth = 1.5 + lit * 1.5;
    if (drop) { c.setLineDash([r * 0.2, r * 0.075]); c.lineDashOffset = -time * r * 0.3 * (pl.lv % 2 ? 1 : -1); }
    c.beginPath(); c.arc(0, 0, r, 0, TWO_PI); c.stroke();
    if (drop) c.setLineDash([]);
    c.globalAlpha = alpha;
    if (!plain) {
      if (!Number.isNaN(pl.spinAt)) {
        // spin gate: a turning ring between you and the next ring, with one gap. It comes round against the orbit
        // and its gap is over the mark exactly on the beat, so you can watch the two close on each other.
        const ahead = pl.spinAt - beat;
        if (ahead > -0.05 && ahead < 1.7) { // only the gate you are about to meet: one turning ring at a time, never a stack
          const rs = r - pl.enterSide * rb * 1.2;
          const g = ang(pl.spinAt) + (ang(pl.spinAt) - ang(beat)) * 0.75;
          const hw = Math.abs(ang(pl.spinAt + pl.spinTol) - ang(pl.spinAt)) + (rb * 1.5) / rs;
          c.globalAlpha = alpha * clamp((1.7 - ahead) / 0.45, 0, 1) * 0.9;
          c.lineCap = 'butt';
          c.beginPath(); c.arc(0, 0, rs, g + hw, g - hw + TWO_PI);
          c.strokeStyle = HALO; c.lineWidth = 7.5; c.stroke();
          c.strokeStyle = rgba(DANGER); c.lineWidth = 3.6; c.stroke();
          c.strokeStyle = '#ffffff'; c.lineWidth = 1.4; c.stroke();
          // the gap's two lips, so the opening itself is easy to follow
          c.fillStyle = '#ffffff';
          for (const e of [g - hw, g + hw]) { c.beginPath(); c.arc(Math.cos(e) * rs, Math.sin(e) * rs, 3.4, 0, TWO_PI); c.fill(); }
          c.globalAlpha = alpha;
        }
      } else if (pl.ce - pl.cs > 0.06 && pl.ce > lo && pl.cs < hi) {
        // ceiling: the ring above, closed until its opening. Hazard colours: touching it ends the run.
        arc(pl.cs, pl.ce);
        c.lineCap = 'butt';
        c.strokeStyle = HALO;
        c.lineWidth = 10;
        c.stroke();
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
        c.strokeStyle = HALO;
        c.lineWidth = 13;
        c.stroke();
        c.strokeStyle = rgba(VIOLET);
        c.lineWidth = 5;
        c.stroke();
      }
    }
    // floor: the stretch you ride, ending just past the note you leave on (drawn a little short of the real edge)
    const fe = Number.isNaN(pl.note) ? pl.fe : pl.note + pl.tol * 0.85;
    if (fe > lo && pl.fs < hi) {
      c.lineCap = 'round';
      arc(pl.fs, fe);
      // a dark edge first, then the ring in its one fixed colour: the world behind never tints what you ride
      c.strokeStyle = HALO;
      c.lineWidth = (drop ? 11.5 : 10) + (pulse + lit) * 3;
      c.stroke();
      if (pulse > 0.05 || lit > 0.05) {
        c.strokeStyle = `rgba(255,255,255,${Math.min(0.5, pulse * 0.25 + lit * 0.3)})`;
        c.lineWidth = 8 + lit * 4;
        c.stroke();
      }
      c.strokeStyle = rgba(FLOOR);
      c.lineWidth = drop ? 4.5 : 3.5;
      c.stroke();
      if (!plain && !Number.isNaN(pl.note) && pl.note > lo && pl.note < hi) {
        // the note: a bright mark across the ring. This is the moment to tap. Big hits get a bigger mark and a ring
        // that closes in on it as the ball arrives; the drop's smash is gold and bigger still.
        const a = ang(pl.note);
        const bigness = pl.smash ? 2.3 : pl.accent || pl.after ? 1.6 : 1;
        const len = rb * (1.15 + pulse * 0.5) * bigness;
        const gold = pl.auto || pl.smash;
        const wide = (gold ? 6.5 : pl.accent || pl.after ? 5 : 3.5) + pulse * 2.5;
        c.beginPath(); c.moveTo(Math.cos(a) * (r - len), Math.sin(a) * (r - len)); c.lineTo(Math.cos(a) * (r + len), Math.sin(a) * (r + len));
        c.strokeStyle = HALO;
        c.lineWidth = wide + 5;
        c.stroke();
        c.strokeStyle = gold ? rgba(GOLD) : '#ffffff';
        c.lineWidth = wide;
        c.stroke();
        const ahead = pl.note - beat;
        if ((pl.accent || pl.smash || pl.after) && ahead > 0 && ahead < 2.5) {
          c.strokeStyle = gold ? rgba(GOLD, 0.95 - ahead * 0.25) : pl.after ? rgba(CYAN, 0.95 - ahead * 0.25) : `rgba(255,255,255,${0.95 - ahead * 0.25})`;
          c.lineWidth = pl.smash ? 3.5 : 2.5;
          c.beginPath(); c.arc(Math.cos(a) * r, Math.sin(a) * r, rb * (1.5 * bigness + ahead * (pl.smash ? 4.5 : 3)), 0, TWO_PI); c.stroke();
        }
        if (pl.sling) {
          // slingshot: arrows pointing the way it throws you
          // (they pulse on every beat while you ride up to them)
          const tick = Math.exp(-(((beat % 1) + 1) % 1) * 5);
          c.strokeStyle = rgba(CYAN);
          c.lineWidth = 3 + tick * 2;
          for (let j = 0; j < 3; j++) {
            const rr = r + pl.side * rb * (3 + j * 1.7 + tick * 0.8);
            const tip = rr + pl.side * rb * 1.1;
            c.globalAlpha = alpha * (1 - j * 0.25);
            c.beginPath();
            c.moveTo(Math.cos(a - (rb * 1.1) / r) * rr, Math.sin(a - (rb * 1.1) / r) * rr);
            c.lineTo(Math.cos(a) * tip, Math.sin(a) * tip);
            c.lineTo(Math.cos(a + (rb * 1.1) / r) * rr, Math.sin(a + (rb * 1.1) / r) * rr);
            c.stroke();
          }
          c.globalAlpha = alpha;
        }
        if (!pl.auto) {
          // and the edge: ride past it and the run ends
          const e = ang(fe);
          c.fillStyle = rgba(DANGER);
          c.beginPath(); c.arc(Math.cos(e) * r, Math.sin(e) * r, 3.2, 0, TWO_PI); c.fill();
        }
      }
      c.lineCap = 'butt';
    }
    c.globalAlpha = 1;
  }

  /** Everything one ball reads and the ball itself. The twin's side is the same picture, mirrored left to right. */
  private drawSide(run: GdRun, twin: boolean, beat: number, pal: Palette, kick: number, dropStyle: boolean, time: number, skin: RGB, dt: number): void {
    const c = this.ctx;
    const course = run.course;
    const sim = run.sim;
    const { r0, rb } = this;
    const ang = (b: number) => -Math.PI / 2 + course.angle(b);
    // each ring is drawn round its own planet; `at` moves the origin there and back
    const [hx, hy] = this.planetXY(this.pf);
    const origin = (pf: number): [number, number] => { const [x, y] = this.planetXY(pf); return [x - this.camX, y - this.camY]; };
    for (const pl of this.plats) {
      if (twin ? pl.twin === null : false) continue;
      if (Math.min(pl.cs, pl.fs) - beat > AHEAD || beat > pl.fe + 0.5) continue;
      const mine = twin ? pl.twin === 'b' || pl.twin === 'both' : pl.twin !== 'b';
      const [ox, oy] = origin(pl.planet);
      c.translate(ox, oy);
      this.drawPlatform(pl, course, beat, pal, kick, dropStyle, !mine, time);
      c.translate(-ox, -oy);
    }
    const [bx0, by0] = [hx - this.camX, hy - this.camY]; // the ball's own planet
    if (!twin) {
      // where the next hops go: a faint dotted path from each note to its landing
      for (let k = sim.ni; k < Math.min(course.presses.length, sim.ni + 3); k++) {
        const p = course.presses[k];
        if (p.beat - beat > AHEAD - 0.4) break;
        const n = Math.max(3, Math.round((p.land - p.beat) * (p.sling ? 14 : 8)));
        c.fillStyle = p.sling ? rgba(CYAN, 0.8) : rgba(WHITE, k === sim.ni ? 0.5 : 0.25);
        for (let i = 1; i < n; i++) {
          const b = p.beat + ((p.land - p.beat) * i) / n;
          const r = this.rad(flightRho(p, b)) + (p.kind === 'flip' ? p.side * rb * (1 - (2 * i) / n) : p.side * rb);
          const [ox, oy] = origin(p.sling ? p.planet + smoothstep(i / n) : p.planet); // a planet hop's path crosses to the next planet
          c.beginPath(); c.arc(ox + Math.cos(ang(b)) * r, oy + Math.sin(ang(b)) * r, p.sling ? 2.2 : 1.6, 0, TWO_PI); c.fill();
        }
      }
      // planet hops: from a couple of beats before the launch until it lands, a cyan target marks the landing spot
      for (let k = Math.max(0, sim.ni - 1); k < Math.min(course.presses.length, sim.ni + 2); k++) {
        const p = course.presses[k];
        if (!p.sling || beat < p.beat - 2.5 || beat > p.land) continue;
        const [ox, oy] = origin(p.planetTo);
        const r = this.rad(p.to) + p.side * rb;
        const x = ox + Math.cos(ang(p.land)) * r;
        const y = oy + Math.sin(ang(p.land)) * r;
        const tick = Math.exp(-(((beat % 1) + 1) % 1) * 5);
        c.globalAlpha = clamp((beat - (p.beat - 2.5)) / 0.5, 0, 1);
        c.strokeStyle = HALO;
        c.lineWidth = 7;
        c.beginPath(); c.arc(x, y, rb * (2 + tick * 0.5), 0, TWO_PI); c.stroke();
        c.strokeStyle = rgba(CYAN);
        c.lineWidth = 2.5;
        c.beginPath(); c.arc(x, y, rb * (2 + tick * 0.5), 0, TWO_PI); c.stroke();
        c.beginPath(); c.arc(x, y, rb * 0.5, 0, TWO_PI); c.stroke();
        c.globalAlpha = 1;
      }
      // speed portals and turns: cyan signs across the ball's path
      const rr = this.rad(this.cam);
      for (const sp of course.portals) {
        const d = sp.beat - beat;
        if (d > AHEAD || d < -0.4) continue;
        c.save();
        c.translate(bx0, by0);
        c.rotate(ang(sp.beat) + Math.PI / 2);
        c.globalAlpha = clamp((AHEAD - d) / 0.6, 0, 1) * clamp(1 + d / 0.4, 0, 1);
        c.strokeStyle = rgba(CYAN);
        c.lineWidth = 3;
        c.lineCap = 'round';
        const way = (course.angle(sp.beat + 0.1) > course.angle(sp.beat) ? 1 : -1) * (sp.faster ? 1 : -1);
        for (let i = -1; i <= 1; i++) {
          const x = i * rb * 1.3;
          c.beginPath(); c.moveTo(x - rb * 0.6 * way, -rr - rb * 2.4); c.lineTo(x + rb * 0.6 * way, -rr); c.lineTo(x - rb * 0.6 * way, -rr + rb * 2.4); c.stroke();
        }
        c.restore();
      }
      for (const tb of course.turns) {
        const d = tb - beat;
        if (d > AHEAD || d < -0.4) continue;
        const a = ang(tb);
        c.globalAlpha = clamp((AHEAD - d) / 0.6, 0, 1) * clamp(1 + d / 0.4, 0, 1);
        c.lineCap = 'round';
        // a wall across the path with a U-turn arrow in front of it
        c.translate(bx0, by0);
        c.beginPath(); c.moveTo(Math.cos(a) * (rr - rb * 3), Math.sin(a) * (rr - rb * 3)); c.lineTo(Math.cos(a) * (rr + rb * 3), Math.sin(a) * (rr + rb * 3));
        c.strokeStyle = HALO; c.lineWidth = 8; c.stroke();
        c.strokeStyle = rgba(CYAN); c.lineWidth = 3.5; c.stroke();
        const back = course.angle(tb - 0.1) < course.angle(tb) ? -1 : 1;
        const ac = a + (back * rb * 2.6) / rr;
        c.lineWidth = 2.5;
        c.beginPath(); c.arc(Math.cos(ac) * rr, Math.sin(ac) * rr, rb * 1.3, a + Math.PI / 2 * back, a + Math.PI / 2 * back + Math.PI * 1.2 * back, back < 0); c.stroke();
        c.translate(-bx0, -by0);
        c.globalAlpha = 1;
      }
      c.lineCap = 'butt';
      c.globalAlpha = 1;
    }
    // flow notes: optional taps, on the ring or in mid-flight. Gold, and smaller than the white marks you must hit.
    for (const f of course.flow) {
      const d = f.beat - beat;
      if (d > AHEAD) break;
      if (d < -0.25 || sim.noteUsed(f.beat)) continue;
      if (twin ? !(f.twin === 'b' || f.twin === 'both') : f.twin === 'b') continue;
      const r = this.rad(f.rho) + f.side * rb;
      const [ox, oy] = origin(f.planet);
      const x = ox + Math.cos(ang(f.beat)) * r;
      const y = oy + Math.sin(ang(f.beat)) * r;
      c.globalAlpha = clamp((AHEAD - d) / 0.6, 0, 1) * clamp(1 + d / 0.25, 0, 1);
      const big = f.air ? 1 : 0.8;
      c.fillStyle = HALO;
      c.beginPath(); c.arc(x, y, rb * 1.35 * big, 0, TWO_PI); c.fill();
      c.strokeStyle = rgba(GOLD);
      c.lineWidth = Math.max(1.5, rb * 0.3);
      c.beginPath(); c.arc(x, y, rb * 0.95 * big, 0, TWO_PI); c.stroke();
      c.fillStyle = rgba(f.charge ? WHITE : GOLD, 0.95);
      c.beginPath(); c.arc(x, y, rb * 0.4 * big, 0, TWO_PI); c.fill();
      c.globalAlpha = 1;
    }
    // the ball: its place round the core is a pure function of the clock, so it moves exactly as smoothly as the clock does
    if (run.state === 'failed') return;
    const rho = sim.rho(beat);
    const squash = 4 * this.landPulse * (1 - this.landPulse); // a landing presses the ball down and lets it up again, from rest
    const off = sim.sideAt(beat) * rb * (1 - 0.3 * squash);
    // at the finish the ball launches straight out through every ring and off the screen
    const away = run.finale ? Math.pow(Math.min(1.4, run.finaleAge / 0.9), 2.2) * this.r0 * 7 : 0;
    if (away > Math.hypot(this.w, this.h)) return;
    const br = this.rad(rho) + off + away;
    const a = ang(beat);
    c.lineCap = 'round';
    const n = this.trail.length;
    for (let i = 1; i < n; i++) {
      const p0 = this.trail[i - 1];
      const p1 = this.trail[i];
      const u = i / n;
      const ra = this.rad(p0.rho) + p0.off + (p0.away ?? 0);
      const rz = this.rad(p1.rho) + p1.off + (p1.away ?? 0);
      const [x0, y0] = origin(p0.pf);
      const [x1, y1] = origin(p1.pf);
      c.strokeStyle = rgba(skin, u * u * 0.55);
      c.lineWidth = rb * 1.7 * u;
      c.beginPath(); c.moveTo(x0 + Math.cos(ang(p0.beat)) * ra, y0 + Math.sin(ang(p0.beat)) * ra); c.lineTo(x1 + Math.cos(ang(p1.beat)) * rz, y1 + Math.sin(ang(p1.beat)) * rz); c.stroke();
    }
    c.lineCap = 'butt';
    const vr = dt > 0 && this.ball.r ? (br - this.ball.r) / dt : 0;
    const stretch = sim.mode !== 'ground' ? clamp(Math.abs(vr) / (r0 * 4), 0, 0.2) : 0;
    const x = bx0 + Math.cos(a) * br;
    const y = by0 + Math.sin(a) * br;
    this.ballXY = [x, y];
    // a dark halo, so the ball reads against anything
    c.fillStyle = 'rgba(3,5,14,0.5)';
    c.beginPath(); c.arc(x, y, rb * 2.1, 0, TWO_PI); c.fill();
    this.drawBall(x, y, rb, skin, a, 1 + stretch - 0.3 * squash, 1 - stretch * 0.5 + 0.22 * squash);
    if (!twin) {
      this.ball.x = x;
      this.ball.y = y;
      this.ball.r = br;
    }
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
    const m = this.sizes();
    const span = Math.max(this.w, this.h) * 0.75;
    const { r0, rb } = this;
    const skin = orbColour(save.skin);
    const calm = save.reducedMotion;

    // the section's palette, cross-faded (at the drop it snaps: the colours explode rather than fade)
    const seg = level.segAt(Math.max(0, t));
    if (seg.look.palette !== this.palName) {
      this.palFrom = this.pal;
      this.palName = seg.look.palette;
      this.palT = seg.core?.smash ? 0.7 : 0;
    }
    const target = PALETTES[this.palName] || PALETTES.deep;
    this.palT = Math.min(1, this.palT + dt / 0.5);
    const pal: Palette = this.palT >= 1 ? target : { bg0: mix(this.palFrom.bg0, target.bg0, this.palT), bg1: mix(this.palFrom.bg1, target.bg1, this.palT), ring: mix(this.palFrom.ring, target.ring, this.palT), acc: mix(this.palFrom.acc, target.acc, this.palT) };
    this.pal = pal;

    // the song's measured energy sets the scene; the player's flow opens it up or drains it
    this.flowV += (sim.flow - this.flowV) * Math.min(1, dt * 6);
    this.drain += (sim.muffle - this.drain) * Math.min(1, dt * (sim.muffle > this.drain ? 1.4 : 9));
    this.inten += (this.energyAt(beat) - this.inten) * Math.min(1, dt * 2.5);
    const afterDrop = beat >= course.dropBeat - 0.01;
    this.chargeV += (sim.charge - this.chargeV) * Math.min(1, dt * 8);
    // before the drop the charge winds everything up; after it, the drop is as big as the charge and flow made it
    const wound = afterDrop ? 0 : this.chargeV * (course.charges.length ? 1 : 0);
    const bloom = (0.6 + 0.55 * this.flowV) * (afterDrop ? 0.6 + 0.4 * this.dropPower : 1) * (1 - this.drain * 0.4);
    const inten = clamp(this.inten * bloom + wound * 0.3, 0, 1.15);
    const kick = Math.min(1.3, level.energyAt('kick', t) * (1 + wound * 0.8));
    const snare = level.energyAt('snare', t);
    const groove = kick * inten * inten;
    // drive: nothing in the verse, everything in a drop that was earned. It scales every effect behind the course.
    this.world += ((afterDrop ? 1 : 0) - this.world) * Math.min(1, dt * 6);
    // a section the level calls a drop is always loud enough to go off, however sparse its kick
    const hot = Math.max(clamp((this.inten - 0.45) / 0.4, 0, 1), seg.label === 'DROP' ? 0.8 : 0);
    let drive = this.world * hot * (0.4 + 0.6 * this.dropPower) * (0.75 + 0.25 * this.flowV) * (1 - this.drain * 0.6);
    // the finish: everything behind the course goes off at full strength, whatever came before
    const fin = run.finale ? run.finaleAge : -1;
    if (fin >= 0) drive = Math.max(drive, clamp(1 - (fin - 3) / 1, 0.4, 1));
    this.dark += ((seg.blackout ? 0.45 : 0) - this.dark) * Math.min(1, dt * 4);

    // what just happened
    const loud = drive > 0.15 || wound > 0.05;
    for (const ev of run.events) {
      if (ev.kind === 'hop' || ev.kind === 'flip' || ev.kind === 'spark') {
        if (ev.kind !== 'spark' || ev.flow) this.ripples.push({ x: this.ball.x, y: this.ball.y, age: 0, col: ev.flow ? GOLD : [170, 180, 200] });
        if (ev.flow) this.burst(this.ball.x, this.ball.y, ev.kind === 'spark' ? 7 : 5, GOLD, r0 * 0.7, 0.8); // small sparkles: on the note
        if (ev.charge) this.punch = Math.max(this.punch, 0.2); // each roll note you catch winds the picture a little tighter
        if (ev.kind === 'flip') this.burst(this.ball.x, this.ball.y, 12, VIOLET, r0 * 0.9);
        if (ev.flow && loud) {
          // in the loud parts an on-beat tap drives the picture: a shockwave off the ball's ring, the rings light up, a burst
          const press = ev.kind !== 'spark';
          this.wave(this.ball.r || r0, press ? WHITE : GOLD, r0 * (press ? 3.2 : 2.4), press ? 4 : 2.5, press ? 0.6 : 0.45, press ? 0.5 : 0.35);
          this.ringFlash = Math.max(this.ringFlash, press ? 1 : 0.6);
          this.burst(this.ball.x, this.ball.y, press ? 12 : 8, pal.acc, r0 * 1.2);
          if (press && !calm) this.punch = Math.max(this.punch, 0.3);
        }
        if (ev.accent) {
          // a big hit: the camera bumps, a wide shockwave, a flicker of colour
          this.wave(this.ball.r || r0, WHITE, r0 * 4, 6, 0.7, 0.6);
          this.burst(this.ball.x, this.ball.y, 22, WHITE, r0 * 1.6);
          this.punch = Math.max(this.punch, calm ? 0.2 : 0.7);
          this.ringFlash = 1;
          if (!calm) this.strobe = Math.max(this.strobe, 0.6);
        }
        if (ev.sling) {
          this.burst(this.ball.x, this.ball.y, 26, CYAN, r0 * 2);
          this.wave(this.ball.r || r0, CYAN, r0 * 4, 5, 0.7, 0.6);
          if (!calm) this.zoomKick = Math.max(this.zoomKick, 0.5);
        }
      } else if (ev.kind === 'land') this.landPulse = 1;
      else if (ev.kind === 'drop') {
        const pw = ev.power ?? (ev.full ? 1 : 0.3);
        this.dropFull = !!ev.full;
        this.dropPower = pw;
        this.dropAge = 0;
        this.punch = 0.3 + 0.7 * pw;
        this.ringFlash = 1;
        if (pw >= 0.3) {
          // the drop, as big as it was earned: a flash, three shockwaves, every ring on screen shatters into shards,
          // the camera is thrown back and the world behind changes for good
          this.flash = pw;
          this.zoomKick = calm ? 0 : pw;
          this.strobe = calm ? 0 : pw;
          const rr = this.ball.r || r0;
          if (!calm) { this.burstK = 1; this.flipK = pw; }
          for (let k = 0; k < 3; k++) this.wave(rr * (0.4 + k * 0.5), k === 1 ? WHITE : pal.acc, r0 * (5 + k * 1.5) * (0.5 + pw), 10 - k * 2, 0.75, 0.7 + k * 0.12);
          const n = Math.round(150 * pw * (calm ? 0.3 : 1));
          for (let i = 0; i < n; i++) {
            const a = (i / n) * TWO_PI + Math.random() * 0.1;
            const from = rr * (0.7 + (i % 3) * 0.28);
            const sp = r0 * (1.5 + Math.random() * 4) * (0.5 + pw);
            this.particles.push({ x: this.coreX + Math.cos(a) * from, y: this.coreY + Math.sin(a) * from, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, max: 0.5 + Math.random() * 0.6, col: i % 3 === 0 ? WHITE : i % 3 === 1 ? pal.acc : pal.ring, size: 2 + Math.random() * 3.5, back: i % 2 === 0 });
          }
        }
      } else if (ev.kind === 'finale') {
        // level complete: the ball launches out through every ring and the world bursts into the level's colours
        this.flash = 1;
        this.ringFlash = 1;
        this.burstK = 1;
        this.zoomKick = calm ? 0 : 0.7;
        this.punch = 1;
        for (let k = 0; k < 4; k++) this.wave(r0 * (0.3 + k * 0.45), k % 2 ? WHITE : pal.acc, r0 * (4 + k * 1.6), 9 - k, 0.8, 0.8 + k * 0.15);
        const n = calm ? 60 : 220;
        for (let i = 0; i < n; i++) {
          const a = Math.random() * TWO_PI;
          const sp = r0 * (1 + Math.random() * 5);
          this.particles.push({ x: this.coreX + Math.cos(a) * r0 * 0.3, y: this.coreY + Math.sin(a) * r0 * 0.3, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, max: 0.7 + Math.random() * 0.9, col: [pal.ring, pal.acc, WHITE, GOLD][i % 4], size: 2 + Math.random() * 4, back: i % 3 === 0 });
        }
      } else if (ev.kind === 'crash') {
        this.burst(this.ball.x, this.ball.y, 34, WHITE, r0 * 1.5);
        this.burst(this.ball.x, this.ball.y, 16, DANGER, r0 * 1.1);
        this.shake = calm ? 0 : 1;
      }
    }
    run.events.length = 0;
    if (this.ripples.length > 8) this.ripples.splice(0, this.ripples.length - 8);

    // the music drives the drop too: every kick throws a burst off the core and bumps the camera, every snare flickers the colour
    if (kick > 0.55 && this.kickWas <= 0.55 && drive > 0.2 && run.state === 'playing') {
      if (!calm) {
        const n = Math.round(6 + 12 * drive);
        for (let i = 0; i < n && this.particles.length < 420; i++) {
          const a = Math.random() * TWO_PI;
          const sp = r0 * (1.2 + Math.random() * 2.2) * (0.6 + drive);
          this.particles.push({ x: this.coreX + Math.cos(a) * m * 0.06, y: this.coreY + Math.sin(a) * m * 0.06, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, max: 0.35 + Math.random() * 0.4, col: pal.acc, size: 1.5 + Math.random() * 2.5, back: true });
        }
        this.punch = Math.max(this.punch, 0.3 * drive);
        this.burstK = 1; // the equalizer bursts to the edges
        if (drive > 0.35) this.flipK = Math.max(this.flipK, 0.8); // and the backdrop's colours flip
      }
      this.wave(m * 0.07, pal.acc, r0 * 3.5, 3, 0.28 * drive, 0.5);
    }
    if (snare > 0.6 && this.snareWas <= 0.6 && drive > 0.35 && !calm) {
      this.strobe = Math.max(this.strobe, 0.35 * drive);
      // glitch hit: for a tenth of a second a few bands of the backdrop tear sideways
      this.glitch = 0.1;
      this.bands = Array.from({ length: 4 }, () => [Math.random() * this.h, 14 + Math.random() * 46, (Math.random() - 0.5) * 90 * drive] as [number, number, number]);
    }
    this.kickWas = kick;
    this.snareWas = snare;
    if (fin >= 0 && fin < 3.2 && !calm && Math.floor(fin / 0.28) !== Math.floor((fin - dt) / 0.28)) {
      // fireworks through the finish
      const a = Math.random() * TWO_PI;
      const d = r0 * (0.8 + Math.random() * 1.6);
      this.burst(this.coreX + Math.cos(a) * d, this.coreY + Math.sin(a) * d, 26, [pal.acc, GOLD, WHITE, pal.ring][Math.floor(fin / 0.28) % 4], r0 * 1.6, 1.2);
      this.wave(r0 * 0.4, pal.acc, r0 * 4.5, 4, 0.4, 0.6);
    }

    // spring camera: keeps the ball's ring at a steady radius; further out while it rides the inside, where the hops
    // go toward the core, and it starts moving there a couple of beats before the flip
    const rho = sim.rho(beat);
    const nextP = course.presses[sim.ni];
    const lastP = course.presses[sim.ni - 1];
    // in a weave the ball bounces between two rings on every press: the camera holds still between them
    const weaving = sim.mode === 'flight' ? !!lastP?.weave : !!nextP?.weave && (!!lastP?.weave || nextP.beat - beat < 1.5);
    const camT = weaving ? (sim.mode === 'flight' ? lastP!.camLv : nextP!.camLv) : rho;
    const om = 9;
    this.camVel += (om * om * (camT - this.cam) - 2 * om * this.camVel) * dt;
    this.cam += this.camVel * dt;
    const inward = !weaving && (sim.sideAt(beat) < 0 || (!!nextP && nextP.kind === 'flip' && !nextP.weave && nextP.side > 0 && nextP.beat - beat < 2.5));
    // the camera follows the ball from planet to planet, and leans toward the next one before a planet hop
    this.pf = this.planetOf(run, beat);
    // camera first: in a planet hop the camera reaches the next planet well before the ball, so everything there is in view on landing
    // It is one continuous move: a lean toward the next planet over the two beats before the hop (whatever the ball is
    // doing then, and held if the tap comes late), carried straight on into the crossing when the ball takes off.
    const LEAN = 0.32;
    const slinging = !!lastP?.sling && sim.mode === 'flight' && !!sim.fl;
    // the next planet hop coming up, even if another press comes before it
    let slingP: typeof nextP | undefined = undefined as typeof nextP | undefined;
    for (let i = sim.ni; i < course.presses.length && course.presses[i].beat - beat < 2.5; i++) if (course.presses[i].sling) { slingP = course.presses[i]; break; }
    const hop = slinging ? lastP!.planet + LEAN + (1 - LEAN) * smoothstep(Math.min(1, ((beat - sim.fl!.t0) / (sim.fl!.t1 - sim.fl!.t0)) * 2.4)) : this.pf;
    let [tx, ty] = this.planetXY(hop);
    if (!slinging && slingP) {
      const [nx, ny] = this.planetXY(slingP.planetTo);
      const lean = LEAN * smoothstep((2.5 - (slingP.beat - beat)) / 2);
      tx += (nx - tx) * lean;
      ty += (ny - ty) * lean;
    }
    // a spring, like the zoom: the camera picks up speed and settles, it never changes pace in a single frame
    const ok = 11;
    this.camVX += (ok * ok * (tx - this.camX) - 2 * ok * this.camVX) * dt;
    this.camVY += (ok * ok * (ty - this.camY) - 2 * ok * this.camVY) * dt;
    this.camX += this.camVX * dt;
    this.camY += this.camVY * dt;
    const [wx, wy] = this.planetXY(this.pf);
    this.coreX = wx - this.camX;
    this.coreY = wy - this.camY;
    this.baseR += ((inward ? 1.5 : 1) - wound * 0.1 - this.baseR) * Math.min(1, dt * 3.5);
    this.punch = Math.max(0, this.punch - dt / 0.45);
    this.punchS += (this.punch - this.punchS) * Math.min(1, dt / 0.06);
    this.zoomS += (this.zoomKick - this.zoomS) * Math.min(1, dt / 0.09);
    this.zoomKick = Math.max(0, this.zoomKick - dt / 0.9) * (1 - Math.min(1, dt * 1.5));
    this.flash = Math.max(0, this.flash - dt / 0.18);
    this.flipK = Math.max(0, this.flipK - dt / 0.11);
    this.burstK = Math.max(0, this.burstK - dt / 0.16);
    this.glitch = Math.max(0, this.glitch - dt);
    this.strobe = Math.max(0, this.strobe - dt / 0.12);
    this.ringFlash = Math.max(0, this.ringFlash - dt / 0.3);
    this.landPulse = Math.max(0, this.landPulse - dt / 0.12);
    this.shake = Math.max(0, this.shake - dt / 0.3);
    this.dropAge += dt;
    const twinNow = course.twins.some(([a, z]) => beat >= a - 1 && beat < z + 0.25);
    this.twinV += ((twinNow ? 1 : 0) - this.twinV) * Math.min(1, dt * 5);
    if (run.state === 'playing') {
      this.trail.push({ beat, rho, off: sim.sideAt(beat) * rb * (1 - 0.3 * 4 * this.landPulse * (1 - this.landPulse)), pf: this.pf, away: run.finale ? Math.pow(Math.min(1.4, run.finaleAge / 0.9), 2.2) * r0 * 7 : 0 });
      if (this.trail.length > 30) this.trail.shift();
    }

    // ---- behind the course: backdrop, flashes, beams, shockwaves, shards
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.background(pal, now / 1000, dt, inten, groove, this.dark, drive, kick);
    if (this.flash > 0) { c.fillStyle = `rgba(255,255,255,${this.flash * (calm ? 0.1 : 0.45)})`; c.fillRect(0, 0, this.w, this.h); }
    if (this.strobe > 0.01) { c.fillStyle = this.col(pal.acc, this.strobe * 0.16); c.fillRect(0, 0, this.w, this.h); }
    c.save();
    let cx = this.w / 2;
    let cy = this.h * 0.52;
    // the drop shakes the picture: a quick sway that dies away, not a new random place every frame
    if (this.shake > 0) { const sh = 4 * this.shake * (1 - this.shake) * 5; cx += Math.sin(now * 0.031) * sh; cy += Math.sin(now * 0.026 + 1) * sh; }
    if (this.dropPower >= 0.3 && this.dropAge < 1.2 && !calm) cx += Math.exp(-this.dropAge * 4) * Math.sin(this.dropAge * 10) * m * 0.045 * this.dropPower; // the launch swings the camera
    c.translate(cx, cy);

    // the other planets nearby: a small glowing core each, so you can see where a planet hop is going
    // (only the one a planet hop is about to go to, or has just left)
    const soon = course.presses.slice(sim.ni, sim.ni + 3).find((p) => p.sling && p.beat - beat < 3);
    const flying = lastP?.sling && sim.mode === 'flight' ? lastP : null;
    for (let k = Math.max(0, Math.floor(this.pf) - 1); k <= Math.floor(this.pf) + 2; k++) {
      if (Math.abs(k - this.pf) < 0.5 || !(soon?.planetTo === k || flying?.planet === k || flying?.planetTo === k)) continue;
      const [px, py] = this.planetXY(k);
      const g = c.createRadialGradient(px - this.camX, py - this.camY, 0, px - this.camX, py - this.camY, m * 0.09);
      g.addColorStop(0, this.col(pal.ring, 0.55));
      g.addColorStop(1, this.col(pal.ring, 0));
      c.fillStyle = g;
      c.beginPath(); c.arc(px - this.camX, py - this.camY, m * 0.09, 0, TWO_PI); c.fill();
    }
    c.translate(this.coreX, this.coreY);
    const chargeShown = afterDrop ? this.chargeV * clamp(1 - this.dropAge / 0.35, 0, 1) : course.charges.length && beat > course.charges[0][0] - 4 ? Math.max(this.chargeV, 0.006) : 0;
    this.core(pal, m * 0.045, m * 0.04 * (0.4 + 1.1 * inten) * (1 + wound * 0.7 + drive * 0.5), kick * (0.3 + 0.7 * inten), snare * inten, dt, this.flowV, chargeShown, drive, span);

    for (let i = this.waves.length - 1; i >= 0; i--) {
      const wv = this.waves[i];
      wv.life += dt;
      if (wv.life >= wv.max) { this.waves.splice(i, 1); continue; }
      wv.r += wv.v * dt;
      const u = wv.life / wv.max;
      c.strokeStyle = rgba(wv.col, (1 - u) * wv.a);
      c.lineWidth = wv.w * (1 - u * 0.6);
      c.beginPath(); c.arc(0, 0, wv.r, 0, TWO_PI); c.stroke();
    }
    c.translate(-this.coreX, -this.coreY);
    this.drawParticles(dt, true);
    if (this.glitch > 0 && !calm && this.canvas.width > 0 && this.canvas.height > 0) {
      // the glitch tears only what has been drawn so far, which is all background
      c.save();
      c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      for (const [y, hgt, dx] of this.bands) {
        const sy = Math.min(this.canvas.height - 2, Math.round(y * this.dpr));
        const sh = Math.max(1, Math.min(this.canvas.height - sy, Math.round(hgt * this.dpr)));
        try { c.drawImage(this.canvas, 0, sy, this.canvas.width, sh, dx, sy / this.dpr, this.w, sh / this.dpr); } catch { /* a canvas with no size yet: nothing to tear */ }
      }
      c.restore();
    }
    // a dark band under the play area, deeper the wilder the backdrop gets: the course always sits on a calm ground
    const dim = c.createRadialGradient(this.coreX, this.coreY, r0 * 0.45, this.coreX, this.coreY, r0 * 2.9);
    const deep = 0.14 + 0.34 * drive;
    dim.addColorStop(0, 'rgba(2,3,10,0)');
    dim.addColorStop(0.2, `rgba(2,3,10,${deep})`);
    dim.addColorStop(0.7, `rgba(2,3,10,${deep})`);
    dim.addColorStop(1, 'rgba(2,3,10,0)');
    c.fillStyle = dim;
    c.beginPath(); c.arc(this.coreX, this.coreY, r0 * 2.9, 0, TWO_PI); c.fill();

    // ---- the course, on top of all of that: rings, marks, flow notes, the ball. Nothing below here changes colour.
    const dropStyle = afterDrop && this.dropPower >= 0.3;
    this.drawSide(run, false, beat, pal, kick, dropStyle, now / 1000, skin, dt);
    if (this.twinV > 0.5) {
      // twin orbit: a second ball, mirrored left to right. One tap moves both; each mark is on one ball's ring or on both.
      c.save();
      c.translate(2 * this.coreX, 0);
      c.scale(-1, 1);
      this.drawSide(run, true, beat, pal, kick, dropStyle, now / 1000, mix(skin, VIOLET, 0.6), dt);
      c.restore();
    }

    for (const r of this.ripples) {
      r.age += dt;
      const u = r.age / 0.28;
      if (u >= 1) continue;
      c.strokeStyle = rgba(r.col, (1 - u) * 0.8);
      c.lineWidth = 2;
      c.beginPath(); c.arc(r.x, r.y, rb * (1.2 + u * 2.6), 0, TWO_PI); c.stroke();
    }
    this.drawParticles(dt, false);

    // short hints near the core, out of the ball's way: the latest one that applies
    if (run.state !== 'loading' && (!bestFor(level.id).cleared || run.opts.practice)) {
      let shown: [number, number, string] | null = null;
      for (const hnt of this.hints) if (beat >= hnt[0] && beat <= hnt[1]) shown = hnt;
      if (shown) {
        const al = Math.min(1, (beat - Math.max(shown[0], run.startAt / level.spb - 4)) / 0.5, (shown[1] - beat) / 0.5);
        this.text(shown[2], this.coreX, this.coreY - m * 0.045 * 1.2 - m * 0.04 * 1.5 - 30, clamp(m * 0.022, 10, 16), WHITE, clamp(al, 0, 1));
      }
    }
    if (run.state === 'resuming') this.text(String(Math.max(1, Math.ceil((run.resumeAt - now) / 400))), this.coreX, this.coreY + m * 0.16, m * 0.06, WHITE, 1);
    if (run.state === 'loading') this.text('LOADING', this.coreX, this.coreY + m * 0.16, clamp(m * 0.024, 11, 17), WHITE, 0.8);
    c.restore();
  }

  /** The menus choose the idle scene's palette (the focused level's) and where its centre sits (fractions of the screen). */
  idlePal = 'deep';
  idleAt: [number, number] = [0.5, 0.5];
  /** Where the ball was last drawn, in screen pixels. Read by the smoothness check (tools/smooth-check.mjs). */
  ballXY: [number, number] = [0, 0];
  /** Size of the menu scene, 1 = its usual size; the title screen fits it between the wordmark and the call to start. */
  idleScale = 1;
  private idleS = 1;
  private idleX = 0.5;
  private idleY = 0.5;
  private idleMix: Palette = PALETTES.deep;

  /** Idle picture behind the menus: a living orbit with the equalizer at its core. */
  drawIdle(now: number, dt = 0.016): void {
    const c = this.ctx;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.drain = 0;
    const to = PALETTES[this.idlePal] || PALETTES.deep;
    const k = Math.min(1, dt * 3);
    this.idleMix = { bg0: mix(this.idleMix.bg0, to.bg0, k), bg1: mix(this.idleMix.bg1, to.bg1, k), ring: mix(this.idleMix.ring, to.ring, k), acc: mix(this.idleMix.acc, to.acc, k) };
    const pal = this.idleMix;
    this.idleX += (this.idleAt[0] - this.idleX) * Math.min(1, dt * 4);
    this.idleY += (this.idleAt[1] - this.idleY) * Math.min(1, dt * 4);
    this.idleS += (this.idleScale - this.idleS) * Math.min(1, dt * 4);
    // the scene listens: when music is playing its bass drives the pulse; in silence a steady beat does
    const bass = (this.eq[0] + this.eq[1] + this.eq[2] + this.eq[EQ_BARS - 1]) / 4;
    const steady = Math.exp(-(((now / 1000) * 2) % 1) * 4) * 0.4;
    const pulse = Math.max(steady * (bass > 0.05 ? 0.3 : 1), Math.min(1, bass * 1.3));
    this.background(pal, now / 1000, dt, 0.5, pulse * 0.25, 0, 0, 0);
    const m = Math.min(this.w, this.h) * this.idleS;
    c.save();
    c.translate(this.w * this.idleX, this.h * this.idleY);
    this.core(pal, m * 0.06, m * 0.07, pulse, pulse * 0.5, dt, -1, 0, 0, 0);
    for (let n = 0; n < 4; n++) {
      c.lineWidth = n === 0 ? 3 : 2;
      c.strokeStyle = this.col(pal.ring, 0.42 - n * 0.09);
      c.beginPath(); c.arc(0, 0, m * (0.22 + n * 0.075) * (1 + pulse * 0.015 * (n + 1)), 0, TWO_PI); c.stroke();
    }
    // the ball climbs a ring every half turn, then drops back
    const turn = (now / 5200) % 1;
    const step = Math.floor(turn * 4) % 3;
    const u = smooth(((turn * 4) % 1) * 3);
    const lv = step === 2 ? 2 - 2 * u : step + u;
    const a = -Math.PI / 2 + turn * TWO_PI * 2;
    const r = m * (0.22 + lv * 0.075) + m * 0.016;
    c.lineCap = 'round';
    for (let n = 1; n <= 10; n++) {
      const b = a - n * 0.035;
      c.strokeStyle = rgba(orbColour(save.skin), 0.4 * (1 - n / 10));
      c.lineWidth = m * 0.02 * (1 - n / 11);
      c.beginPath(); c.moveTo(Math.cos(b) * r, Math.sin(b) * r); c.lineTo(Math.cos(b + 0.035) * r, Math.sin(b + 0.035) * r); c.stroke();
    }
    c.lineCap = 'butt';
    this.drawBall(Math.cos(a) * r, Math.sin(a) * r, m * 0.016, orbColour(save.skin));
    c.restore();
  }

  /** Ball crossing a mark at the top of a ring; used by the visual-offset calibration. */
  drawMetronome(now: number, phase: number): void {
    const c = this.ctx;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.drain = 0;
    const pal = PALETTES.deep;
    this.background(pal, now / 1000, 0.016, 0.4, 0, 0, 0, 0);
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
    if (prev && !prev.auto && !prev.sling) {
      // while the ball rides the ring before, this ring is the ceiling above it, up to the opening over the note
      // (a launch the game takes itself has none, and a slingshot's landing ring is far off)
      const before = out[j - 1];
      cs = Math.max(prev.beat - LOOK, before.fs);
      ce = prev.beat - prev.tol * (prev.kind === 'flip' ? 0.85 : 0.9);
    }
    const inTwin = c.twins.some(([a, z]) => (p ? p.beat : fs) >= a && (p ? p.beat : fs) < z);
    out.push({
      lv, side, fs, fe, cs, ce, note: p ? p.beat : NaN, tol: p ? p.tol : 0, auto: !!p && p.auto, smash: !!p && p.smash, accent: !!p && p.accent, sling: !!p && p.sling, after: !!p && p.after,
      twin: p ? p.twin : inTwin ? 'both' : null,
      planet: p ? p.planet : prev ? prev.planetTo : 0,
      spinAt: prev && prev.spin ? prev.beat : NaN, spinTol: prev ? prev.tol : 0, enterSide: prev ? prev.side : 1,
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
